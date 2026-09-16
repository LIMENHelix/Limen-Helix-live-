/**
 * scripts/test-relay-p0-integrity.js — P0 transaction integrity: atomic money state.
 * Run: node scripts/test-relay-p0-integrity.js
 *
 * Pins the fixes for the three P0s:
 *   A  the autonomy ledger and the store maps mutate through an atomic
 *      compare-and-replace (lib/relay-strict-store.js), so concurrent lambdas cannot
 *      lose each other's reservations, listings or orders.
 *   B  a CJ purchase whose answer was lost is reconciled against CJ's own order book
 *      (getOrderDetail) before anything re-places or releases the reservation.
 *   C  the legacy /api/relay-checkout money path is retired: 410, no Stripe call.
 *
 * HERMETIC: no Redis, no CJ, no Stripe. Redis is a fake implementing GET/EVAL with
 * promise gates between them, so the concurrency tests produce REAL interleavings
 * rather than sequential calls. CJ is stubbed at the module seam, exactly as
 * scripts/test-relay-autonomous-loop.js does it.
 */

'use strict';

// The ledger/config fixtures ride limen-db's memory backend; real credentials would make
// it reach for a live store.
['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'CJ_API_KEY', 'STRIPE_SECRET_KEY']
  .forEach(function (k) { delete process.env[k]; });

let failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const db = require('../lib/limen-db');
const strict = require('../lib/relay-strict-store');
const autonomy = require('../lib/relay-autonomy');
const store = require('../lib/relay-store');

const LEDGER = 'limen:relay:autonomy-ledger';
const LISTINGS = 'limen:relay:store:listings';
const ORDERS = 'limen:relay:store:orders';

const ADDR = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };

// ── fake Redis with controlled yield points ─────────────────────────────────
// get() and eval() each await their hooks first; the compare-and-set inside eval is
// synchronous, so the ONLY interleaving window is the one the test opens on purpose.
function FakeRedis() {
  const map = new Map();
  return {
    map: map,
    hooks: { get: [], eval: [] },
    counts: { get: 0, eval: 0 },
    get: async function (k) {
      this.counts.get++;
      for (const h of this.hooks.get) await h(k);
      return map.has(k) ? map.get(k) : null;
    },
    eval: async function (script, keys, args) {
      this.counts.eval++;
      for (const h of this.hooks.eval) await h(keys[0]);
      if (script !== strict.CAS_SCRIPT) throw new Error('unexpected script');
      const cur = map.has(keys[0]) ? map.get(keys[0]) : '';
      if (cur !== args[0]) return 0;
      map.set(keys[0], args[1]);
      return 1;
    }
  };
}

function gate() {
  let release;
  const promise = new Promise(function (r) { release = r; });
  return { promise: promise, release: function () { release(); } };
}

function tick() { return new Promise(function (r) { setImmediate(r); }); }

function seedLedger(rows) { strict._setClient.__fake.map.set(LEDGER, JSON.stringify(rows)); }

function useFake() {
  const fake = FakeRedis();
  strict._setClient(fake);
  strict._setClient.__fake = fake;
  return fake;
}

async function setConfig(patch) {
  await db.set('relay:autonomy', Object.assign({
    mode: 'auto', perOrderCapUsd: 1000, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.01, requireFunds: false,
    velocityMaxOrders: 1000, velocityMaxUsd: 1000000
  }, patch || {}));
}

function ledgerRows() {
  const raw = strict._setClient.__fake.map.get(LEDGER);
  return raw ? JSON.parse(raw) : [];
}

/** Both callers read the SAME version before either commits: the lost-update window. */
function firstTwoReadsGate(fake, key) {
  const g = gate();
  let arrived = 0;
  fake.hooks.get.push(async function (k) {
    if (k !== key) return;
    if (arrived >= 2) return;
    arrived++;
    if (arrived === 2) g.release();
    await g.promise;
  });
  return g;
}

(async function () {

  // ── S1: the primitive itself ─────────────────────────────────────────────
  console.log('S1: strict store rejects foreign keys and fails closed on outage');
  const fake = useFake();
  let threw = null;
  try { await strict.read('limen:relay:autonomy'); } catch (e) { threw = e; }
  assert('a non-ledger relay key is refused', !!threw && /not allowed/.test(threw.message));
  threw = null;
  try { await strict.mutate('limen:other', function () { return { write: true, value: 1 }; }); } catch (e) { threw = e; }
  assert('mutation of a foreign key is refused', !!threw && /not allowed/.test(threw.message));

  strict._setClient({
    get: async function () { throw new Error('redis down'); },
    eval: async function () { throw new Error('redis down'); }
  });
  threw = null;
  try { await strict.read(LEDGER); } catch (e) { threw = e; }
  assert('a read during an outage throws (no silent null)', !!threw && /redis down/.test(threw.message));
  threw = null;
  try { await strict.mutate(LEDGER, function () { return { write: true, value: [] }; }); } catch (e) { threw = e; }
  assert('a mutation during an outage throws (fails closed)', !!threw && /redis down/.test(threw.message));

  // ── S2: concurrent authorisations ────────────────────────────────────────
  console.log('S2: two concurrent authorizes that both fit both land durably');
  useFake();
  seedLedger([]);
  await setConfig();
  firstTwoReadsGate(strict._setClient.__fake, LEDGER);
  const a1 = autonomy.authorize({ amount: 30, salePrice: 90, orderId: 'c1', marketplace: 'cj' });
  const a2 = autonomy.authorize({ amount: 40, salePrice: 90, orderId: 'c2', marketplace: 'cj' });
  const r1 = await a1, r2 = await a2;
  assert('both are allowed', r1.allowed === true && r2.allowed === true,
    JSON.stringify({ a: r1.reason, b: r2.reason }));
  assert('and BOTH reservations survive', ledgerRows().length === 2,
    JSON.stringify(ledgerRows().map(function (r) { return r.id; })));
  assert('with distinct decision ids', ledgerRows()[0].id !== ledgerRows()[1].id);

  console.log('S3: under the daily ceiling only one of two concurrent authorizes succeeds');
  useFake();
  seedLedger([]);
  await setConfig({ dailyCeilingUsd: 100 });
  firstTwoReadsGate(strict._setClient.__fake, LEDGER);
  const b = await Promise.all([
    autonomy.authorize({ amount: 60, salePrice: 200, orderId: 'd1', marketplace: 'cj' }),
    autonomy.authorize({ amount: 60, salePrice: 200, orderId: 'd2', marketplace: 'cj' })
  ]);
  assert('exactly one is allowed',
    b.filter(function (r) { return r.allowed; }).length === 1, JSON.stringify(b.map(function (r) { return r.reason; })));
  assert('the loser is refused on the ceiling', /ceiling/.test(String((b.find(function (r) { return !r.allowed; }) || {}).reason)));
  assert('and exactly one reservation exists', ledgerRows().length === 1, String(ledgerRows().length));
  assert('the day never exceeded the ceiling',
    ledgerRows().reduce(function (s, r) { return s + (r.amount || 0); }, 0) <= 100);

  console.log('S4: the velocity cap holds across a race');
  useFake();
  seedLedger([]);
  await setConfig({ velocityMaxOrders: 1, velocityMaxUsd: 1000000 });
  firstTwoReadsGate(strict._setClient.__fake, LEDGER);
  const v = await Promise.all([
    autonomy.authorize({ amount: 10, salePrice: 90, orderId: 'v1', marketplace: 'cj' }),
    autonomy.authorize({ amount: 10, salePrice: 90, orderId: 'v2', marketplace: 'cj' })
  ]);
  assert('exactly one passes the rate limit', v.filter(function (r) { return r.allowed; }).length === 1,
    JSON.stringify(v.map(function (r) { return r.reason; })));
  assert('the refusal names the limit', /limit/.test(String((v.find(function (r) { return !r.allowed; }) || {}).reason)));
  assert('only one reservation was written', ledgerRows().length === 1);

  console.log('S5: settle vs release race ends in exactly one terminal state');
  useFake();
  await setConfig();
  const pre = await autonomy.authorize({ amount: 20, salePrice: 90, orderId: 'sr', marketplace: 'cj' });
  firstTwoReadsGate(strict._setClient.__fake, LEDGER);
  const sr = await Promise.all([
    autonomy.settle(pre.decisionId, { amount: 20, sourceOrderId: 'cj_sr' }),
    autonomy.release(pre.decisionId, 'raced')
  ]);
  const srRow = ledgerRows().find(function (r) { return r.id === pre.decisionId; });
  assert('exactly one transition succeeded', sr.filter(function (r) { return r.ok; }).length === 1,
    JSON.stringify(sr));
  assert('the loser was refused', sr.filter(function (r) { return r.ok === false; }).length === 1);
  assert('the row is in exactly one terminal state',
    srRow && (srRow.state === 'settled' || srRow.state === 'released') &&
    !(srRow.settledAt && srRow.releaseReason === 'raced'),
    JSON.stringify({ state: srRow && srRow.state, settledAt: !!(srRow && srRow.settledAt), releasedAt: !!(srRow && srRow.releasedAt) }));

  console.log('S6: two concurrent settles are idempotent');
  const pre6 = await autonomy.authorize({ amount: 20, salePrice: 90, orderId: 'ss', marketplace: 'cj' });
  firstTwoReadsGate(strict._setClient.__fake, LEDGER);
  const ss = await Promise.all([
    autonomy.settle(pre6.decisionId, { amount: 20, sourceOrderId: 'cj_ss' }),
    autonomy.settle(pre6.decisionId, { amount: 20, sourceOrderId: 'cj_ss' })
  ]);
  const ssRow = ledgerRows().find(function (r) { return r.id === pre6.decisionId; });
  assert('both settles report ok', ss.every(function (r) { return r.ok === true; }), JSON.stringify(ss));
  assert('one of them observed the other', ss.some(function (r) { return r.already === true; }));
  assert('and the row is settled exactly once', ssRow && ssRow.state === 'settled' && ssRow.sourceOrderId === 'cj_ss');

  console.log('S7: Redis unavailable → authorize fails closed, no reservation, in both modes');
  useFake();
  seedLedger([]);
  await setConfig({ mode: 'auto' });
  strict._setClient({
    get: async function () { throw new Error('redis down'); },
    eval: async function () { throw new Error('redis down'); }
  });
  const dead1 = await autonomy.authorize({ amount: 10, salePrice: 90, orderId: 'dead1', marketplace: 'cj' });
  assert('auto mode refuses', dead1.allowed === false && /unreachable|failing closed/.test(String(dead1.reason)), dead1.reason);
  await setConfig({ mode: 'queue' });
  const dead2 = await autonomy.authorize({ amount: 10, salePrice: 90, orderId: 'dead2', marketplace: 'cj' });
  assert('queue mode refuses too (does NOT queue)', dead2.allowed === false && dead2.queued === false, JSON.stringify(dead2.reason));
  const deadSettle = await autonomy.settle('auth_anything', { amount: 1 });
  assert('settle fails closed as well', deadSettle.ok === false, JSON.stringify(deadSettle));

  // ── S8: the store maps ───────────────────────────────────────────────────
  console.log('S8: concurrent listing and order creation lose nothing');
  useFake();
  const f8 = strict._setClient.__fake;
  f8.map.set(LISTINGS, JSON.stringify({}));
  f8.map.set(ORDERS, JSON.stringify({}));
  firstTwoReadsGate(f8, LISTINGS);
  const l = await Promise.all([
    store.createListing({ title: 'one', price: 10 }),
    store.createListing({ title: 'two', price: 20 })
  ]);
  const allL = JSON.parse(f8.map.get(LISTINGS));
  assert('both listings survive the race', Object.keys(allL).length === 2 &&
    allL[l[0].id] && allL[l[1].id], Object.keys(allL).join(','));

  firstTwoReadsGate(f8, ORDERS);
  const o = await Promise.all([
    store.createOrder({ lines: [{ listingId: l[0].id, qty: 1, unitPrice: 10 }] }),
    store.createOrder({ lines: [{ listingId: l[1].id, qty: 1, unitPrice: 20 }] })
  ]);
  const allO = JSON.parse(f8.map.get(ORDERS));
  assert('both orders survive the race', Object.keys(allO).length === 2 &&
    allO[o[0].id] && allO[o[1].id], Object.keys(allO).join(','));

  console.log('S9: concurrent updates to DIFFERENT orders keep both');
  firstTwoReadsGate(f8, ORDERS);
  await Promise.all([
    store.updateOrder(o[0].id, { status: 'awaiting-payment', paymentLinkId: 'pl_a' }),
    store.updateOrder(o[1].id, { status: 'awaiting-payment', paymentLinkId: 'pl_b' })
  ]);
  const after9 = JSON.parse(f8.map.get(ORDERS));
  assert('first order kept its update', after9[o[0].id].paymentLinkId === 'pl_a', JSON.stringify(after9[o[0].id].status));
  assert('second order kept its update', after9[o[1].id].paymentLinkId === 'pl_b');

  console.log('S10: a stale writer cannot pull an order back from a terminal state');
  // Writer B computes from a snapshot where the order is merely paid; writer A then
  // completes the purchase. B commits second, and its stale 'failed' must not land.
  const bRead = gate();
  const aCommitted = gate();
  let bEvalWaiting = true;
  f8.hooks.eval.push(async function (k) {
    if (k !== ORDERS || !bEvalWaiting) return;
    bEvalWaiting = false;                    // only B's first eval blocks
    await aCommitted.promise;
  });
  f8.hooks.get.push(async function (k) { if (k === ORDERS) bRead.release(); });
  const pB = store.updateOrder(o[0].id, { fulfillment: { state: 'failed', lines: [], reason: 'stale failure' } });
  await bRead.promise;
  await store.updateOrder(o[0].id, {
    status: 'shipped',
    fulfillment: { state: 'purchased', lines: [{ listingId: l[0].id, state: 'purchased', sourceOrderId: 'cj_1' }] }
  });
  aCommitted.release();
  const rB = await pB;
  const finalO = JSON.parse(f8.map.get(ORDERS))[o[0].id];
  assert('the stale write did not overwrite fulfilment', finalO.fulfillment.state === 'purchased',
    JSON.stringify(finalO.fulfillment));
  assert('and did not overwrite the terminal status', finalO.status === 'shipped', finalO.status);
  assert('the stale writer was answered the row as committed',
    rB && rB.fulfillment && rB.fulfillment.state === 'purchased');

  console.log('S10b: equal-rank partial repairs merge line progress instead of erasing it');
  const l10a = await store.createListing({ title: 'line A', price: 20 });
  const l10b = await store.createListing({ title: 'line B', price: 20 });
  const o10b = await store.createOrder({ lines: [
    { listingId: l10a.id, qty: 1, unitPrice: 20 },
    { listingId: l10b.id, qty: 1, unitPrice: 20 }
  ] });
  await store.updateOrder(o10b.id, { status: 'paid', fulfillment: { state: 'failed', lines: [
    { listingId: l10a.id, state: 'failed' },
    { listingId: l10b.id, state: 'failed' }
  ] } });
  firstTwoReadsGate(f8, ORDERS);
  await Promise.all([
    store.updateOrder(o10b.id, { fulfillment: { state: 'partial', lines: [
      { listingId: l10a.id, state: 'purchased', sourceOrderId: 'cj_a' },
      { listingId: l10b.id, state: 'failed' }
    ] } }),
    store.updateOrder(o10b.id, { fulfillment: { state: 'partial', lines: [
      { listingId: l10a.id, state: 'failed' },
      { listingId: l10b.id, state: 'purchased', sourceOrderId: 'cj_b' }
    ] } })
  ]);
  const merged10b = await store.getOrder(o10b.id);
  assert('both independently purchased lines survive',
    merged10b.fulfillment.lines.every(function (line) { return line.state === 'purchased'; }),
    JSON.stringify(merged10b.fulfillment));
  assert('the fresh CAS view promotes the completed order',
    merged10b.fulfillment.state === 'purchased' && merged10b.status === 'shipped',
    JSON.stringify({ status: merged10b.status, fulfillment: merged10b.fulfillment.state }));

  console.log('S10c: payment-review cannot be cleared by a stale paid writer');
  const o10c = await store.createOrder({ lines: [{ listingId: l10a.id, qty: 1, unitPrice: 20 }] });
  await store.updateOrder(o10c.id, { status: 'awaiting-payment' });
  await store.updateOrder(o10c.id, { status: 'payment-review', reviewReason: 'duplicate charge' });
  await store.updateOrder(o10c.id, { status: 'paid', stripeSessionId: 'stale_exact_result' });
  const held10c = await store.getOrder(o10c.id);
  assert('the safety hold dominates ordinary paid', held10c.status === 'payment-review', held10c.status);
  assert('and its reason remains visible', held10c.reviewReason === 'duplicate charge', held10c.reviewReason);

  // ── S11: CJ readback normalization (mocked at fetch, like the CJ tests) ──
  console.log('S11: getOrderDetail binds exactly, or it is not a match');
  process.env.CJ_API_KEY = 'test-key-not-real';
  const cjPath = require.resolve('../lib/relay-cj');
  delete require.cache[cjPath];
  const cj = require('../lib/relay-cj');
  const realFetch = global.fetch;
  let CJ_BODY = null;
  let CJ_THROW = null;
  global.fetch = async function (u) {
    const url = String(u);
    if (url.indexOf('getAccessToken') !== -1) {
      return { ok: true, status: 200, json: async function () {
        return { result: true, data: { accessToken: 'tok', refreshToken: 'r' } }; } };
    }
    if (url.indexOf('getOrderDetail') !== -1) {
      if (CJ_THROW) throw new Error(CJ_THROW);
      return { ok: true, status: 200, json: async function () { return CJ_BODY; } };
    }
    throw new Error('unexpected CJ call: ' + url);
  };

  CJ_BODY = { result: true, data: {
    orderId: 'CJ-100', orderNum: 'ord-1-lst-1', orderStatus: 'CREATED', orderAmount: 21.50,
    productList: [{ vid: 'v_good', quantity: 2 }],
    shippingCustomerName: 'A B', shippingCountryCode: 'US',
    trackNumber: 'TRK1', logisticName: 'CJPacket'
  } };
  const g1 = await cj.getOrderDetail('ord-1-lst-1', { vid: 'v_good', quantity: 2 });
  assert('an exactly-bound order is found', g1.found === true, JSON.stringify(g1).slice(0, 200));
  assert('and normalized', g1.cjOrderId === 'CJ-100' && g1.amountUsd === 21.50 &&
    g1.products[0].vid === 'v_good' && g1.products[0].quantity === 2 &&
    g1.tracking.number === 'TRK1' && g1.shipping.country === 'US', JSON.stringify(g1).slice(0, 240));

  const g2 = await cj.getOrderDetail('ord-1-lst-1', { vid: 'v_WRONG', quantity: 2 });
  assert('a wrong variant is NOT accepted as reconciliation',
    g2.found === 'ambiguous' && g2.mismatch === true, JSON.stringify(g2).slice(0, 200));

  const g3 = await cj.getOrderDetail('ord-1-lst-1', { vid: 'v_good', quantity: 5 });
  assert('a wrong quantity is not accepted either', g3.found !== true, JSON.stringify(g3).slice(0, 160));

  CJ_BODY = { result: true, data: { orderId: 'CJ-OTHER', orderNum: 'someone-else' } };
  const g4 = await cj.getOrderDetail('ord-1-lst-1', {});
  assert('a record that does not bind to the number is ambiguous, never a match',
    g4.found === 'ambiguous' && g4.mismatch === true, JSON.stringify(g4).slice(0, 200));

  CJ_BODY = { result: true, data: null };
  const g5 = await cj.getOrderDetail('ord-none', {});
  assert('null data is a definitive absence', g5.found === false, JSON.stringify(g5));

  CJ_BODY = { result: false, message: 'Order does not exist' };
  const g6 = await cj.getOrderDetail('ord-none', {});
  assert('an explicit not-found is a definitive absence', g6.found === false, JSON.stringify(g6));

  CJ_THROW = 'socket hang up';
  const g7 = await cj.getOrderDetail('ord-1-lst-1', {});
  assert('a transport error is ambiguous, not absent', g7.found === 'ambiguous', JSON.stringify(g7));
  CJ_THROW = null;

  global.fetch = realFetch;
  delete process.env.CJ_API_KEY;
  delete require.cache[cjPath];

  // ── S12: reconcile-before-replace in the buy path ────────────────────────
  console.log('S12: an existing CJ order prevents a second createOrderV2');
  const buyPath = require.resolve('../lib/relay-buy');
  const realCjMod = require('../lib/relay-cj');
  let placeCalls = [];
  let lookupResult = null;
  function stubCj() {
    require.cache[cjPath] = { id: cjPath, filename: cjPath, loaded: true, exports: Object.assign({}, realCjMod, {
      configured: function () { return true; },
      placeOrder: async function (po) { placeCalls.push(po); return { ok: true, sourceOrderId: 'CJ-NEW', amount: 20 }; },
      getOrderDetail: async function () { return lookupResult; }
    }) };
    delete require.cache[buyPath];
    return require('../lib/relay-buy');
  }

  useFake();
  await setConfig();
  seedLedger([{
    id: 'd_prior', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: 'ordP', listingId: 'lstP',
    cjAttemptedAt: new Date().toISOString(), cjOrderNumber: 'ordP-lstP'
  }]);
  placeCalls = [];
  lookupResult = { found: true, orderNumber: 'ordP-lstP', cjOrderId: 'CJ-EXISTS', amountUsd: 20,
    products: [{ vid: 'vP', quantity: 1 }] };
  let buyX = stubCj();
  const rec1 = await buyX.buyFromCJ({ orderId: 'ordP', listingId: 'lstP', sourceId: 'vP',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_prior' });
  assert('the retry recovers instead of re-placing', rec1.ok === true && rec1.recovered === true, JSON.stringify(rec1));
  assert('createOrderV2 was never called', placeCalls.length === 0, String(placeCalls.length));
  const priorRow = ledgerRows().find(function (r) { return r.id === 'd_prior'; });
  assert('and the reservation is settled with the provider identity',
    priorRow.state === 'settled' && priorRow.sourceOrderId === 'CJ-EXISTS', JSON.stringify(priorRow));

  console.log('S13: an ambiguous lookup holds the reservation and places nothing');
  useFake();
  seedLedger([{
    id: 'd_amb', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: 'ordA', listingId: 'lstA',
    cjAttemptedAt: new Date().toISOString(), cjOrderNumber: 'ordA-lstA'
  }]);
  placeCalls = [];
  lookupResult = { found: 'ambiguous', error: 'timeout' };
  buyX = stubCj();
  const hold1 = await buyX.buyFromCJ({ orderId: 'ordA', listingId: 'lstA', sourceId: 'vA',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_amb' });
  assert('nothing was placed', placeCalls.length === 0 && hold1.ok === false);
  assert('the result is marked reconciliation-pending', hold1.reconciliationPending === true, JSON.stringify(hold1));
  const ambRow = ledgerRows().find(function (r) { return r.id === 'd_amb'; });
  assert('the reservation stays held', ambRow.state === 'settled' ? false : ambRow.state === 'reserved', ambRow.state);
  assert('and the row carries the marker for the reconciliation pass',
    !!ambRow.reconciliationPending && ambRow.reconciliationPending.orderNumber === 'ordA-lstA',
    JSON.stringify(ambRow.reconciliationPending));

  console.log('S14: ambiguous create + successful lookup recovers and settles exactly once');
  useFake();
  seedLedger([{
    id: 'd_lost', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: 'ordL', listingId: 'lstL'
  }]);
  placeCalls = [];
  lookupResult = { found: true, orderNumber: 'ordL-lstL', cjOrderId: 'CJ-LOST', amountUsd: 19.75,
    products: [{ vid: 'vL', quantity: 1 }] };
  require.cache[cjPath].exports = Object.assign({}, realCjMod, {
    configured: function () { return true; },
    placeOrder: async function (po) { placeCalls.push(po); return { ok: false, error: 'CJ request failed: The operation timed out' }; },
    getOrderDetail: async function () { return lookupResult; }
  });
  delete require.cache[buyPath];
  buyX = require('../lib/relay-buy');
  const rec2 = await buyX.buyFromCJ({ orderId: 'ordL', listingId: 'lstL', sourceId: 'vL',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_lost' });
  assert('the lost create is recovered as a success', rec2.ok === true && rec2.recovered === true, JSON.stringify(rec2));
  assert('at the amount CJ actually charged', rec2.amount === 19.75, String(rec2.amount));
  const lostRow = ledgerRows().find(function (r) { return r.id === 'd_lost'; });
  assert('and the reservation settled with the provider id',
    lostRow.state === 'settled' && lostRow.sourceOrderId === 'CJ-LOST', JSON.stringify(lostRow));
  const again = await autonomy.settle('d_lost', { amount: 19.75, sourceOrderId: 'CJ-LOST' });
  assert('the engine settling it again is a no-op', again.ok === true && again.already === true);
  // A full second run of the retry path must not place or change anything either.
  const rec3 = await buyX.buyFromCJ({ orderId: 'ordL', listingId: 'lstL', sourceId: 'vL',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_lost' });
  assert('a second recovery run is idempotent', rec3.ok === true && placeCalls.length === 1,
    JSON.stringify({ ok: rec3.ok, places: placeCalls.length }));

  console.log('S15: ambiguous create + ambiguous lookup leaves the reservation held');
  useFake();
  seedLedger([{
    id: 'd_unk', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: 'ordU', listingId: 'lstU'
  }]);
  placeCalls = [];
  lookupResult = { found: 'ambiguous', error: 'CJ 429: rate limited' };
  buyX = stubCj();
  require.cache[cjPath].exports.placeOrder = async function (po) {
    placeCalls.push(po); return { ok: false, error: 'CJ accepted the order but returned no order id' };
  };
  const unk = await buyX.buyFromCJ({ orderId: 'ordU', listingId: 'lstU', sourceId: 'vU',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_unk' });
  assert('the outcome is held, not released', unk.ok === false && unk.reconciliationPending === true, JSON.stringify(unk));
  const unkRow = ledgerRows().find(function (r) { return r.id === 'd_unk'; });
  assert('the reservation is still reserved', unkRow.state === 'reserved', unkRow.state);
  assert('and marked for reconciliation', !!unkRow.reconciliationPending &&
    unkRow.cjOrderNumber === 'ordU-lstU', JSON.stringify(unkRow.reconciliationPending));
  const throughExecute = await buyX.execute({ orderId: 'ordU', listingId: 'lstU', sourceId: 'vU',
    sourceMarketplace: 'cj', sourceUrl: 'https://www.cjdropshipping.com/product/-p-U.html',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_unk' });
  assert('the public execute wrapper preserves reconciliationPending',
    throughExecute.ok === false && throughExecute.reconciliationPending === true && throughExecute.transient === true,
    JSON.stringify(throughExecute));

  console.log('S16: definitive absence permits a fresh placement; failure then releases cleanly');
  useFake();
  seedLedger([{
    id: 'd_abs', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: 'ordD', listingId: 'lstD',
    cjAttemptedAt: new Date().toISOString(), cjOrderNumber: 'ordD-lstD'
  }]);
  placeCalls = [];
  lookupResult = { found: false, orderNumber: 'ordD-lstD' };
  buyX = stubCj();
  const placed = await buyX.buyFromCJ({ orderId: 'ordD', listingId: 'lstD', sourceId: 'vD',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_abs' });
  assert('the placement proceeds after definitive absence', placed.ok === true && placeCalls.length === 1,
    JSON.stringify({ ok: placed.ok, places: placeCalls.length }));

  // An ambiguous create where CJ says there is NOTHING: the ordinary failure path, so the
  // caller's release is legal.
  useFake();
  seedLedger([{
    id: 'd_nf', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: 'ordN', listingId: 'lstN'
  }]);
  placeCalls = [];
  lookupResult = { found: false, orderNumber: 'ordN-lstN' };
  require.cache[cjPath].exports = Object.assign({}, realCjMod, {
    configured: function () { return true; },
    placeOrder: async function (po) { placeCalls.push(po); return { ok: false, error: 'CJ request failed: The operation timed out' }; },
    getOrderDetail: async function () { return lookupResult; }
  });
  delete require.cache[buyPath];
  buyX = require('../lib/relay-buy');
  const nf = await buyX.buyFromCJ({ orderId: 'ordN', listingId: 'lstN', sourceId: 'vN',
    maxCost: 20, quantity: 1, shippingAddress: ADDR, decisionId: 'd_nf' });
  assert('a proven-unplaced timeout is a plain failure (release is legal)',
    nf.ok === false && !nf.reconciliationPending, JSON.stringify(nf));

  console.log('S17: fulfilment does not release a reconciliation-pending reservation');
  useFake();
  await setConfig();
  seedLedger([]);
  const f17 = strict._setClient.__fake;
  f17.map.set(LISTINGS, JSON.stringify({}));
  f17.map.set(ORDERS, JSON.stringify({}));
  const l17 = await store.createListing({
    title: 'held line', price: 40, sourceMarketplace: 'cj', sourceId: 'v17',
    sourceUrl: 'https://www.cjdropshipping.com/product/-p-17.html', sourceCost: 20
  });
  const o17 = await store.createOrder({
    shippingAddress: ADDR,
    lines: [{ listingId: l17.id, qty: 1, unitPrice: 40, sourceCost: 20 }]
  });
  await store.updateOrder(o17.id, { status: 'paid', paidAt: new Date().toISOString() });
  require.cache[buyPath].exports = Object.assign({}, realCjMod && require('../lib/relay-buy'), {
    execute: async function () {
      return { ok: false, transient: true, reconciliationPending: true, error: 'outcome unknown' };
    }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  const eng17 = require('../lib/relay-engine');
  const fl17 = await eng17.fulfillPaidOrder({ orderId: o17.id });
  const held17 = ledgerRows().filter(function (r) { return r.state === 'reserved'; });
  assert('the line reports reconciliation-pending',
    fl17.lines && fl17.lines[0] && fl17.lines[0].reconciliationPending === true,
    JSON.stringify((fl17.lines || [])[0]).slice(0, 200));
  assert('and the reservation was NOT released', held17.length === 1, JSON.stringify(ledgerRows()));

  console.log('S18: the reconciliation pass settles once, repairs the order, and repeats cleanly');
  useFake();
  await setConfig();
  const f18 = strict._setClient.__fake;
  seedLedger([{
    id: 'd_rec', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: null, listingId: null
  }]);
  const l18 = await store.createListing({
    title: 'reconciled line', price: 40, sourceMarketplace: 'cj', sourceId: 'v18',
    sourceUrl: 'https://www.cjdropshipping.com/product/-p-18.html', sourceCost: 20
  });
  const o18 = await store.createOrder({
    lines: [{ listingId: l18.id, qty: 2, unitPrice: 40, sourceCost: 20 }]
  });
  await store.updateOrder(o18.id, { status: 'paid', paidAt: new Date().toISOString() });
  await store.updateOrder(o18.id, { fulfillment: { state: 'failed', lines: [
    { listingId: l18.id, ok: false, state: 'failed', error: 'outcome unknown' }
  ] } });
  seedLedger([{
    id: 'd_rec', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 40, marketplace: 'cj', orderId: o18.id, listingId: l18.id,
    cjAttemptedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    cjOrderNumber: o18.id + '-' + l18.id
  }]);
  let reconcileExpected = null;
  require.cache[cjPath].exports = Object.assign({}, realCjMod, {
    configured: function () { return true; },
    getOrderDetail: async function (orderNumber, expected) {
      reconcileExpected = expected;
      return { found: true, orderNumber: orderNumber, cjOrderId: 'CJ-REC', amountUsd: 40,
        products: [{ vid: 'v18', quantity: 2 }] };
    }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  const eng18 = require('../lib/relay-engine');
  const pass1 = await eng18.reconcileCjAttempts();
  assert('the pass settles the stuck reservation',
    pass1.ok === true && pass1.results.length === 1 && pass1.results[0].settled === true,
    JSON.stringify(pass1));
  const recRow = ledgerRows().find(function (r) { return r.id === 'd_rec'; });
  assert('the row is settled with the provider identity',
    recRow.state === 'settled' && recRow.sourceOrderId === 'CJ-REC', JSON.stringify(recRow));
  assert('background readback binds the real cart quantity',
    reconcileExpected && reconcileExpected.vid === 'v18' && reconcileExpected.quantity === 2,
    JSON.stringify(reconcileExpected));
  const repaired = await store.getOrder(o18.id);
  assert('the order line is repaired to purchased',
    repaired.fulfillment.lines[0].state === 'purchased' &&
    repaired.fulfillment.lines[0].sourceOrderId === 'CJ-REC', JSON.stringify(repaired.fulfillment.lines[0]));
  assert('and the order ships', repaired.status === 'shipped' && repaired.fulfillment.state === 'purchased',
    JSON.stringify({ status: repaired.status, state: repaired.fulfillment.state }));

  const pass2 = await eng18.reconcileCjAttempts();
  assert('running the pass again has exactly no effect',
    pass2.ok === true && pass2.results.length === 0, JSON.stringify(pass2));
  const recRow2 = ledgerRows().find(function (r) { return r.id === 'd_rec'; });
  assert('and the ledger is unchanged', recRow2.state === 'settled' && !recRow2.releasedAt);

  console.log('S19: definitive absence in the pass releases the reservation');
  useFake();
  const f19 = strict._setClient.__fake;
  seedLedger([{
    id: 'd_gone', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 33, marketplace: 'cj', orderId: 'ordG', listingId: 'lstG',
    cjAttemptedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), cjOrderNumber: 'ordG-lstG'
  }]);
  f19.map.set(LISTINGS, JSON.stringify({}));
  f19.map.set(ORDERS, JSON.stringify({}));
  require.cache[cjPath].exports = Object.assign({}, realCjMod, {
    configured: function () { return true; },
    getOrderDetail: async function (orderNumber) { return { found: false, orderNumber: orderNumber }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  const eng19 = require('../lib/relay-engine');
  const pass3 = await eng19.reconcileCjAttempts();
  assert('the pass releases on definitive absence',
    pass3.results.length === 1 && pass3.results[0].released === true, JSON.stringify(pass3));
  assert('the row is released', ledgerRows()[0].state === 'released', ledgerRows()[0].state);

  console.log('S20: an ambiguous pass leaves everything held');
  useFake();
  const f20 = strict._setClient.__fake;
  seedLedger([{
    id: 'd_hold', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 33, marketplace: 'cj', orderId: 'ordH', listingId: 'lstH',
    cjAttemptedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), cjOrderNumber: 'ordH-lstH',
    reconciliationPending: { at: new Date().toISOString(), orderNumber: 'ordH-lstH', error: 'x' }
  }]);
  f20.map.set(LISTINGS, JSON.stringify({}));
  f20.map.set(ORDERS, JSON.stringify({}));
  require.cache[cjPath].exports = Object.assign({}, realCjMod, {
    configured: function () { return true; },
    getOrderDetail: async function () { return { found: 'ambiguous', error: 'CJ 503' }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  const eng20 = require('../lib/relay-engine');
  const pass4 = await eng20.reconcileCjAttempts();
  assert('nothing settles and nothing releases',
    pass4.results.length === 1 && pass4.results[0].held === true, JSON.stringify(pass4));
  assert('the reservation is still held', ledgerRows()[0].state === 'reserved', ledgerRows()[0].state);

  console.log('S20b: a failed ledger settlement cannot repair or ship the order');
  useFake();
  await setConfig();
  const l20b = await store.createListing({ title: 'settlement fence', price: 40,
    sourceMarketplace: 'cj', sourceId: 'v20b', sourceUrl: 'https://www.cjdropshipping.com/product/-p-20b.html', sourceCost: 20 });
  const o20b = await store.createOrder({ lines: [{ listingId: l20b.id, qty: 1, unitPrice: 40, sourceCost: 20 }] });
  await store.updateOrder(o20b.id, { status: 'paid', fulfillment: { state: 'failed', lines: [
    { listingId: l20b.id, state: 'failed', reconciliationPending: true }
  ] } });
  seedLedger([{ id: 'd20b', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: o20b.id, listingId: l20b.id,
    cjAttemptedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), cjOrderNumber: o20b.id + '-' + l20b.id }]);
  require.cache[cjPath].exports.getOrderDetail = async function (orderNumber) {
    return { found: true, orderNumber: orderNumber, cjOrderId: 'CJ-20B', amountUsd: 20 };
  };
  const realSettle = autonomy.settle;
  autonomy.settle = async function () { return { ok: false, error: 'forced settlement failure' }; };
  const settleFence = await eng20.reconcileCjAttempts();
  autonomy.settle = realSettle;
  const unchanged20b = await store.getOrder(o20b.id);
  assert('the reconciliation reports settlement failure',
    settleFence.results[0] && settleFence.results[0].settlementFailed === true, JSON.stringify(settleFence));
  assert('the line is not falsely repaired', unchanged20b.fulfillment.lines[0].state === 'failed',
    JSON.stringify(unchanged20b.fulfillment));
  assert('and the order is not marked shipped', unchanged20b.status === 'paid', unchanged20b.status);

  console.log('S20c: off mode still reconciles a provider order without placing one');
  useFake();
  await setConfig({ mode: 'off' });
  const l20c = await store.createListing({ title: 'off reconcile', price: 40,
    sourceMarketplace: 'cj', sourceId: 'v20c', sourceUrl: 'https://www.cjdropshipping.com/product/-p-20c.html', sourceCost: 20 });
  const o20c = await store.createOrder({ lines: [{ listingId: l20c.id, qty: 1, unitPrice: 40, sourceCost: 20 }] });
  await store.updateOrder(o20c.id, { status: 'paid', fulfillment: { state: 'failed', lines: [
    { listingId: l20c.id, state: 'failed', reconciliationPending: true }
  ] } });
  seedLedger([{ id: 'd20c', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: o20c.id, listingId: l20c.id,
    cjAttemptedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), cjOrderNumber: o20c.id + '-' + l20c.id }]);
  let offPlaceCalls = 0;
  require.cache[cjPath].exports.getOrderDetail = async function (orderNumber) {
    return { found: true, orderNumber: orderNumber, cjOrderId: 'CJ-OFF', amountUsd: 20 };
  };
  require.cache[cjPath].exports.placeOrder = async function () { offPlaceCalls++; return { ok: true }; };
  const offCycle = await eng20.runCycle();
  const offOrder = await store.getOrder(o20c.id);
  assert('the cycle remains inhibited for new work', offCycle.skipped === true && offCycle.mode === 'off', JSON.stringify(offCycle));
  assert('but the old ambiguous purchase is reconciled',
    offCycle.cjAttemptsReconciled.length === 1 && ledgerRows()[0].state === 'settled' && offOrder.status === 'shipped',
    JSON.stringify({ cycle: offCycle.cjAttemptsReconciled, ledger: ledgerRows()[0], status: offOrder.status }));
  assert('and reconciliation made no new supplier order', offPlaceCalls === 0, String(offPlaceCalls));

  console.log('S20d: definitive absence clears a partial line for a safe retry');
  useFake();
  await setConfig();
  const l20d1 = await store.createListing({ title: 'already bought', price: 40,
    sourceMarketplace: 'cj', sourceId: 'v20d1', sourceUrl: 'https://www.cjdropshipping.com/product/-p-20d1.html', sourceCost: 20 });
  const l20d2 = await store.createListing({ title: 'absent retry', price: 40,
    sourceMarketplace: 'cj', sourceId: 'v20d2', sourceUrl: 'https://www.cjdropshipping.com/product/-p-20d2.html', sourceCost: 20 });
  const o20d = await store.createOrder({ shippingAddress: ADDR, lines: [
    { listingId: l20d1.id, qty: 1, unitPrice: 40, sourceCost: 20 },
    { listingId: l20d2.id, qty: 1, unitPrice: 40, sourceCost: 20 }
  ] });
  await store.updateOrder(o20d.id, { status: 'paid', fulfillment: { state: 'partial', lines: [
    { listingId: l20d1.id, ok: true, state: 'purchased', sourceOrderId: 'CJ-DONE', margin: 20 },
    { listingId: l20d2.id, ok: false, state: 'failed', reconciliationPending: true, decisionId: 'd20d' }
  ] } });
  seedLedger([{ id: 'd20d', day: new Date().toISOString().slice(0, 10), ts: new Date().toISOString(),
    state: 'reserved', amount: 20, marketplace: 'cj', orderId: o20d.id, listingId: l20d2.id,
    cjAttemptedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), cjOrderNumber: o20d.id + '-' + l20d2.id }]);
  require.cache[cjPath].exports.getOrderDetail = async function (orderNumber) {
    return { found: false, orderNumber: orderNumber };
  };
  const absent20d = await eng20.reconcileCjAttempts();
  const retryable20d = await store.getOrder(o20d.id);
  const retryLine20d = retryable20d.fulfillment.lines.find(function (line) { return line.listingId === l20d2.id; });
  assert('the absent reservation is released only after order repair',
    absent20d.results[0].released === true && ledgerRows()[0].state === 'released', JSON.stringify(absent20d));
  assert('the failed line no longer claims an unknown provider outcome',
    retryLine20d.state === 'failed' && retryLine20d.reconciliationPending === false, JSON.stringify(retryLine20d));

  console.log('S20e: an unreadable ledger is reported as a failed reconciliation scan');
  strict._setClient({
    get: async function () { throw new Error('redis unavailable'); },
    eval: async function () { throw new Error('redis unavailable'); }
  });
  const unreadable20e = await eng20.reconcileCjAttempts();
  assert('the scan does not masquerade as an empty success',
    unreadable20e.ok === false && /unreadable|unavailable/.test(String(unreadable20e.error)),
    JSON.stringify(unreadable20e));

  // restore the real seams
  require.cache[cjPath] = { id: cjPath, filename: cjPath, loaded: true, exports: realCjMod };
  delete require.cache[buyPath];
  delete require.cache[require.resolve('../lib/relay-engine')];

  // ── S21: the retired legacy checkout ─────────────────────────────────────
  console.log('S21: the legacy checkout answers 410 and moves no money');
  strict._resetClient();
  const fbPath = require.resolve('../lib/relay-finance-bridge');
  const realFb = require('../lib/relay-finance-bridge');
  let paymentCalls = 0;
  require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: Object.assign({}, realFb, {
    paymentsEnabled: function () { return true; },
    createPayment: async function () { paymentCalls++; return { ok: true, url: 'https://buy.stripe.com/x' }; }
  }) };
  delete require.cache[require.resolve('../handlers/relay-checkout')];
  const legacy = require('../handlers/relay-checkout');
  const ordersBefore = Object.keys((await db.get('relay:store:orders')) || {}).length;

  function invokeLegacy(method) {
    return new Promise(function (resolve) {
      const out = { status: 0, body: null };
      const res = {
        statusCode: 200,
        setHeader: function () {},
        end: function (s) { out.status = res.statusCode; try { out.body = JSON.parse(s); } catch (e) { out.body = s; } resolve(out); }
      };
      Promise.resolve(legacy({ method: method, headers: {}, body: { items: [{ id: 'x', qty: 1 }], policyAccepted: true } }, res))
        .catch(function (e) { out.status = 500; out.body = String(e); resolve(out); });
    });
  }

  const gonePost = await invokeLegacy('POST');
  assert('POST is 410 Gone', gonePost.status === 410, String(gonePost.status));
  assert('with the retirement message', !!gonePost.body && gonePost.body.gone === true &&
    /nothing has been charged/i.test(JSON.stringify(gonePost.body)), JSON.stringify(gonePost.body).slice(0, 160));
  const goneGet = await invokeLegacy('GET');
  const goneOpt = await invokeLegacy('OPTIONS');
  assert('every method is retired', goneGet.status === 410 && goneOpt.status === 410,
    goneGet.status + '/' + goneOpt.status);
  assert('no payment was ever created', paymentCalls === 0, String(paymentCalls));
  assert('and nothing was written to the store',
    Object.keys((await db.get('relay:store:orders')) || {}).length === ordersBefore);
  require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: realFb };
  delete require.cache[require.resolve('../handlers/relay-checkout')];

  console.log('');
  console.log(failures === 0
    ? 'ALL PASS (' + tests + ' assertions)'
    : failures + ' FAILED of ' + tests + ' assertions');
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('HARNESS ERROR:', e && e.stack || e);
  process.exit(1);
});
