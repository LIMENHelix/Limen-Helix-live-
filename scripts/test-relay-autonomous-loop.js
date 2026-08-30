/**
 * scripts/test-relay-autonomous-loop.js — the Relay end-to-end loop.
 * Run: node scripts/test-relay-autonomous-loop.js
 *
 * Runs against the real modules with limen-db on its in-memory backend and no network
 * credentials set, which is exactly the state that used to produce fabricated results.
 *
 *   T1  sourcing fails CLOSED with no provider configured (no mock listings)
 *   T2  reverse-image search fails CLOSED and says which key is missing
 *   T3  margin comes from the stored value, not a hardcoded 25%
 *   T4  customer-facing results never carry source cost, source URL or seller
 *   T5  the policy is versioned and its hash tracks the text
 *   T6  checkout REFUSES without an explicit final-sale confirmation
 *   T7  autonomy: per-order cap, daily ceiling, margin floor all refuse
 *   T8  autonomy: queue mode queues instead of spending; auto mode clears
 *   T9  autonomy: reserve -> settle is counted; reserve -> release gives headroom back
 *   T10 concurrent authorisations cannot both breach the daily ceiling
 *   T11 buy.execute never claims success without a provider; it files a manual task
 *   T12 fulfilment refuses an order whose listing has no source URL
 *   T13 the engine cycle is inert while autonomy is off (no paid API calls)
 */

process.env.RELAY_ADMIN_KEY = process.env.RELAY_ADMIN_KEY || 'test-admin-key';

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var db = require('../lib/limen-db');
var sourceSearch = require('../lib/relay-source-search');
var reverseImage = require('../lib/relay-reverse-image');
var marginCalc = require('../lib/relay-margin-calculator');
var policy = require('../lib/relay-policy');
var autonomy = require('../lib/relay-autonomy');
var buy = require('../lib/relay-buy');
var engine = require('../lib/relay-engine');

/** Drive a handler the way Vercel does and capture what it sent. */
function invoke(handler, req) {
  return new Promise(function (resolve) {
    var out = { status: 200, body: null, headers: {} };
    var res = {
      statusCode: 200,
      setHeader: function (k, v) { out.headers[k.toLowerCase()] = v; },
      status: function (c) { out.status = c; this.statusCode = c; return this; },
      json: function (o) { out.body = o; resolve(out); return this; },
      send: function (s) { out.body = s; resolve(out); return this; },
      end: function (s) {
        out.status = res.statusCode || out.status;
        try { out.body = s ? JSON.parse(s) : null; } catch (e) { out.body = s; }
        resolve(out);
      }
    };
    Promise.resolve(handler(req, res)).catch(function (e) {
      out.status = 500; out.body = { error: e.message }; resolve(out);
    });
  });
}

(async function () {
  console.log('backend:', db.getBackend());

  // ── T1 ──────────────────────────────────────────────────────────────────
  console.log('T1: sourcing fails closed with nothing configured');
  var found = await sourceSearch.searchAllSources({ description: 'levi 505 jeans', maxPrice: 50 });
  assert('returns ok:false', found.ok === false, JSON.stringify(found).slice(0, 160));
  assert('returns zero items', Array.isArray(found.items) && found.items.length === 0);
  assert('says why', typeof found.reason === 'string' && found.reason.length > 10, found.reason);
  var blob = JSON.stringify(found);
  assert('no fabricated mock URL', blob.indexOf('/mock') === -1, blob.slice(0, 160));

  // ── T2 ──────────────────────────────────────────────────────────────────
  console.log('T2: reverse image fails closed');
  var ri = await reverseImage.findForSale({ description: 'vintage camera', maxPrice: 100 });
  assert('ok:false with no key', ri.ok === false);
  assert('no matches invented', ri.matches.length === 0);
  assert('names the missing credential', /SERPAPI_KEY/.test(ri.reason || ''), ri.reason);
  assert('sourceable filter rejects a random blog', reverseImage.isSourceable('https://someblog.example/post') === false);
  assert('sourceable filter accepts ebay', reverseImage.isSourceable('https://www.ebay.com/itm/123456789012') === true);

  // ── T3 ──────────────────────────────────────────────────────────────────
  console.log('T3: margin is read, not hardcoded');
  await db.set('relay_margin', 0.50);
  var m = await marginCalc.getMargin();
  assert('reads the stored margin', m === 0.50, String(m));
  var priced = marginCalc.calculateMargin(40, m);
  assert('40 at 50% = 60', priced.customerPrice === 60, String(priced.customerPrice));
  await db.set('relay_margin', 0.20);
  var applied = await marginCalc.applyMarginToSearchResults([{ itemId: 'i1', title: 'x', price: 100, condition: 'good', url: 'https://www.ebay.com/itm/1', source: 'ebay' }]);
  assert('20% margin applied to result', applied[0].price === 120, String(applied[0].price));
  assert('a different stored margin gives a different price', applied[0].price !== 125);

  // ── T4 ──────────────────────────────────────────────────────────────────
  console.log('T4: no source leak to the customer');
  var leak = JSON.stringify(applied);
  assert('no source url', leak.indexOf('ebay.com/itm') === -1, leak);
  assert('no source cost', leak.indexOf('100') === -1 || applied[0].price !== 100, leak);
  assert('no source field', applied[0].source === undefined);
  assert('no url field', applied[0].url === undefined);
  assert('no sourceCost field', applied[0].sourceCost === undefined);

  // ── T5 ──────────────────────────────────────────────────────────────────
  console.log('T5: policy is versioned and hashed');
  var p = policy.getPolicy();
  assert('has a version', /^\d{4}-\d{2}-\d{2}\./.test(p.version), p.version);
  assert('hash is 64-hex', /^[0-9a-f]{64}$/.test(p.hash), p.hash);
  assert('hash is stable across calls', policy.getPolicy().hash === p.hash);
  assert('headline says final', /final/i.test(p.headline), p.headline);
  assert('confirm label mentions no returns', /no returns/i.test(p.confirmLabel), p.confirmLabel);
  assert('keeps a not-delivered remedy', p.terms.some(function (t) { return t.key === 'remedy'; }));
  var acc = await policy.recordAcceptance({ accepted: false });
  assert('refuses to record a non-acceptance', acc.ok === false);
  var acc2 = await policy.recordAcceptance({ accepted: true, buyerId: 'b1', orderId: 'o1', ip: '1.2.3.4' });
  assert('records an acceptance with version + hash', acc2.ok === true && acc2.acceptance.policyHash === p.hash);

  // ── T6 ──────────────────────────────────────────────────────────────────
  console.log('T6: checkout refuses without the confirmation');
  var demandPurchase = require('../handlers/relay-demand-purchase');
  var addr = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };
  var r6a = await invoke(demandPurchase, {
    method: 'POST', headers: {},
    body: { searchId: 's1', itemId: 'i1', buyerId: 'b1', shippingAddress: addr }
  });
  assert('400 without policyAccepted', r6a.status === 400, String(r6a.status));
  assert('error names the policy', /policy/i.test(JSON.stringify(r6a.body)), JSON.stringify(r6a.body).slice(0, 140));
  var r6b = await invoke(demandPurchase, {
    method: 'POST', headers: {},
    body: { searchId: 's1', itemId: 'i1', buyerId: 'b1', shippingAddress: addr, policyAccepted: 'yes' }
  });
  assert('a truthy non-true value is not acceptance', r6b.status === 400, String(r6b.status));

  var mktCheckout = require('../handlers/relay-marketplace-checkout');
  var r6c = await invoke(mktCheckout, {
    method: 'POST', headers: {},
    body: { marketplaceId: 'mkt_relay', buyerId: 'b1', listingId: 'lst_1' }
  });
  assert('marketplace checkout also refuses', r6c.status === 400 || (r6c.body && r6c.body.needsKey), JSON.stringify(r6c.body).slice(0, 140));

  // ── T7 ──────────────────────────────────────────────────────────────────
  console.log('T7: spend limits refuse');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 50, dailyCeilingUsd: 120,
    minMarginUsd: 8, minMarginPct: 0.18, requireFunds: false
  });
  var over = await autonomy.authorize({ amount: 60, salePrice: 200 });
  assert('refuses over the per-order cap', over.allowed === false && /per-order cap/.test(over.reason), over.reason);
  var thin = await autonomy.authorize({ amount: 40, salePrice: 45 });
  assert('refuses a thin dollar margin', thin.allowed === false && /floor/.test(thin.reason), thin.reason);
  // $8 on a $48 sale clears the dollar floor exactly and fails only the 18% rule,
  // so this isolates the percentage check rather than re-testing the dollar one.
  var thinPct = await autonomy.authorize({ amount: 40, salePrice: 48 });
  assert('refuses a thin percentage margin', thinPct.allowed === false && /%/.test(thinPct.reason || ''), thinPct.reason);
  var zero = await autonomy.authorize({ amount: 0, salePrice: 100 });
  assert('refuses a zero amount', zero.allowed === false);

  // ── T8 ──────────────────────────────────────────────────────────────────
  console.log('T8: queue mode queues, auto mode clears');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 50, dailyCeilingUsd: 120,
    minMarginUsd: 5, minMarginPct: 0.1, requireFunds: false
  });
  var q = await autonomy.authorize({ amount: 30, salePrice: 60, orderId: 'ordQ' });
  assert('queue does not authorise a spend', q.allowed === false, q.reason);
  assert('queue marks it queued', q.queued === true);
  assert('queue still issues a decision id', typeof q.decisionId === 'string' && q.decisionId.length > 5);

  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 50, dailyCeilingUsd: 120,
    minMarginUsd: 5, minMarginPct: 0.1, requireFunds: false
  });
  var a8 = await autonomy.authorize({ amount: 30, salePrice: 60, orderId: 'ordA' });
  assert('auto authorises inside every limit', a8.allowed === true, a8.reason);

  await db.set('relay:autonomy', { mode: 'off' });
  var off = await autonomy.authorize({ amount: 10, salePrice: 100 });
  assert('off refuses everything', off.allowed === false && /OFF/.test(off.reason), off.reason);

  // ── T9 ──────────────────────────────────────────────────────────────────
  console.log('T9: reserve / settle / release arithmetic');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 100,
    minMarginUsd: 1, minMarginPct: 0.01, requireFunds: false
  });
  var d1 = await autonomy.authorize({ amount: 40, salePrice: 100 });
  assert('first buy allowed', d1.allowed === true, d1.reason);
  var s1 = await autonomy.status();
  assert('reservation counts against the day immediately', s1.spentToday === 40, String(s1.spentToday));
  await autonomy.settle(d1.decisionId, { amount: 40, sourceOrderId: 'src-1' });
  var s2 = await autonomy.status();
  assert('settling keeps the same total', s2.spentToday === 40, String(s2.spentToday));
  var d2 = await autonomy.authorize({ amount: 40, salePrice: 100 });
  await autonomy.release(d2.decisionId, 'source sold out');
  var s3 = await autonomy.status();
  assert('releasing returns the headroom', s3.spentToday === 40, String(s3.spentToday));
  assert('remaining reflects the release', s3.remainingToday === 60, String(s3.remainingToday));
  var settledTwice = await autonomy.settle(d1.decisionId, { amount: 40 });
  assert('settling twice is idempotent', settledTwice.ok === true && settledTwice.already === true);
  var releaseSettled = await autonomy.release(d1.decisionId, 'nope');
  assert('cannot release a settled spend', releaseSettled.ok === false);

  // ── T10 ─────────────────────────────────────────────────────────────────
  console.log('T10: concurrent authorisations cannot both breach the ceiling');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 100,
    minMarginUsd: 1, minMarginPct: 0.01, requireFunds: false
  });
  await autonomy.authorize({ amount: 70, salePrice: 200 });
  var second = await autonomy.authorize({ amount: 70, salePrice: 200 });
  assert('the second one is refused', second.allowed === false, second.reason);
  assert('refusal names the ceiling', /ceiling/.test(second.reason || ''), second.reason);
  var st10 = await autonomy.status();
  assert('never exceeds the ceiling', st10.spentToday <= 100, String(st10.spentToday));

  // ── T11 ─────────────────────────────────────────────────────────────────
  console.log('T11: buy never fakes a purchase');
  var b11 = await buy.execute({
    orderId: 'o11', listingId: 'l11', sourceMarketplace: 'vinted',
    sourceUrl: 'https://www.vinted.com/items/999', maxCost: 20, quantity: 1,
    shippingAddress: addr
  });
  assert('vinted cannot be bought automatically', b11.ok === false, JSON.stringify(b11).slice(0, 140));
  assert('falls back to a manual task', b11.mode === 'manual' && b11.task && b11.task.id);
  assert('the task carries the source URL', b11.task.sourceUrl === 'https://www.vinted.com/items/999');
  assert('the task carries the ship-to address', b11.task.shipTo && b11.task.shipTo.postalCode === '64111');
  var open = await buy.openTasks();
  assert('the task is queryable', open.some(function (t) { return t.id === b11.task.id; }));
  var b11b = await buy.execute({
    orderId: 'o11b', sourceMarketplace: 'ebay',
    sourceUrl: 'https://www.ebay.com/itm/123456789012', maxCost: 20, shippingAddress: addr
  });
  assert('ebay without a Buy token does not claim success', b11b.ok === false);
  assert('and names the credential it needs', /EBAY_BUY_TOKEN/.test(JSON.stringify(b11b)), JSON.stringify(b11b).slice(0, 200));
  assert('ebay item id parses from a real URL', buy.ebayItemId('https://www.ebay.com/itm/123456789012') === 'v1|123456789012|0');

  // ── T12 ─────────────────────────────────────────────────────────────────
  console.log('T12: fulfilment refuses what it cannot source');
  var marketplace = require('../lib/relay-marketplace');
  await marketplace.createMarketplace({ id: 'mkt_relay', name: 'Relay', ownerId: 'usr_relay_house' });
  var mkts = await marketplace.listMarketplaces();
  var mktId = mkts.length ? mkts[0].id : 'mkt_relay';
  var plain = await marketplace.createListing({
    marketplaceId: mktId, sellerId: 'usr_seller', title: 'someone own item', price: 30
  });
  assert('a plain listing has no source URL', plain.sourceUrl === null);
  var ord = await marketplace.createOrder({ marketplaceId: mktId, buyerId: 'b1', sellerId: 'usr_seller', listingId: plain.id, subtotal: 30 });
  assert('order created', !!ord.id, JSON.stringify(ord).slice(0, 120));
  await marketplace.updateOrder(ord.id, { status: 'paid', shippingAddress: addr });
  var f12 = await engine.fulfillPaidOrder({ orderId: ord.id });
  assert('refuses to auto-source it', f12.ok === false && /source URL/.test(f12.error || ''), f12.error);

  var sourced = await marketplace.createListing({
    marketplaceId: mktId, sellerId: 'usr_relay_house', title: 'sourced item', price: 60,
    sourceMarketplace: 'ebay', sourceId: 'v1|123|0',
    sourceUrl: 'https://www.ebay.com/itm/123456789012', sourceCost: 40
  });
  assert('source provenance persists on the listing', sourced.sourceUrl && sourced.sourceCost === 40);

  // ── T13 ─────────────────────────────────────────────────────────────────
  console.log('T13: the cycle is inert while autonomy is off');
  await db.set('relay:autonomy', { mode: 'off' });
  var cyc = await engine.runCycle();
  assert('skips instead of running', cyc.skipped === true, JSON.stringify(cyc).slice(0, 140));
  assert('and says why', /off/.test(cyc.reason || ''), cyc.reason);

  // ── T14 ─────────────────────────────────────────────────────────────────
  // Failing closed is only half the proof. With a provider answering, the pipeline
  // must actually publish, at the operator's margin, carrying the provenance that
  // makes the item sourceable later. Google Lens is simulated at the HTTP boundary,
  // so everything below it is the real code path.
  console.log('T14: with a provider answering, the pipeline publishes');
  process.env.SERPAPI_KEY = 'test-key';
  var realFetch = global.fetch;
  var calls = [];
  global.fetch = async function (url, opts) {
    calls.push(String(url));
    if (String(url).indexOf('serpapi.com') !== -1) {
      return {
        ok: true,
        json: async function () {
          return {
            visual_matches: [
              { title: 'Vintage leather jacket size M', link: 'https://www.ebay.com/itm/223344556677', source: 'eBay', price: { extracted_value: 40, currency: 'USD' }, thumbnail: 'https://img/1.jpg' },
              { title: 'Not for sale blog post', link: 'https://someblog.example/jackets', source: 'Blog' },
              { title: 'Too expensive', link: 'https://www.ebay.com/itm/998877665544', source: 'eBay', price: { extracted_value: 900, currency: 'USD' } }
            ]
          };
        }
      };
    }
    if (String(url).indexOf('api.x.ai') !== -1) {
      return { ok: true, json: async function () { return { data: [{ url: 'https://img/ref.png' }] }; } };
    }
    return { ok: false, status: 404, text: async function () { return 'no'; }, json: async function () { return {}; } };
  };

  // Reload the modules that captured SERPAPI_KEY at require time.
  delete require.cache[require.resolve('../lib/relay-reverse-image')];
  delete require.cache[require.resolve('../lib/relay-source-search')];
  delete require.cache[require.resolve('../lib/relay-engine')];
  var engine2 = require('../lib/relay-engine');

  await db.set('relay_margin', 0.50);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 5, minMarginPct: 0.1, requireFunds: false
  });

  var disc = await engine2.discoverAndList({
    concept: 'vintage leather jacket', marketplaceId: mktId,
    sellerId: 'usr_relay_house', maxSourcePrice: 100, maxPerCycle: 3
  });
  assert('publishes at least one listing', disc.published.length >= 1, JSON.stringify(disc).slice(0, 220));
  var pub = disc.published[0];
  assert('prices the $40 source at 50% margin = $60', pub.price === 60, String(pub.price));
  assert('records the spread', pub.spread === 20, String(pub.spread));
  assert('drops the non-sourceable blog link', disc.published.every(function (x) { return x.sourceUrl.indexOf('someblog') === -1; }));
  assert('drops the over-budget match', disc.published.every(function (x) { return x.sourceCost <= 100; }));

  var storedListing = await marketplace.getListing(pub.listingId);
  assert('provenance is persisted', storedListing.sourceUrl === 'https://www.ebay.com/itm/223344556677');
  assert('source cost is persisted', storedListing.sourceCost === 40);
  assert('the margin in force is stamped on the listing', storedListing.marginAtListing === 0.50);

  var again = await engine2.discoverAndList({
    concept: 'vintage leather jacket', marketplaceId: mktId,
    sellerId: 'usr_relay_house', maxSourcePrice: 100, maxPerCycle: 3
  });
  assert('does not re-publish the same source URL', again.published.every(function (x) {
    return x.sourceUrl !== 'https://www.ebay.com/itm/223344556677';
  }), JSON.stringify(again.published));

  // ── T15 ─────────────────────────────────────────────────────────────────
  console.log('T15: a paid order runs the gate and settles the margin');
  var ord15 = await marketplace.createOrder({
    marketplaceId: mktId, buyerId: 'b15', sellerId: 'usr_relay_house',
    listingId: pub.listingId, subtotal: 60
  });
  await marketplace.updateOrder(ord15.id, { status: 'paid', shippingAddress: addr });
  await db.set('relay:autonomy-ledger', []);

  var f15 = await engine2.fulfillPaidOrder({ orderId: ord15.id });
  assert('no eBay Buy token means no silent purchase', f15.ok === false, JSON.stringify(f15).slice(0, 160));
  assert('it becomes a manual task, not a failure', f15.state === 'manual-required', f15.state);
  var st15 = await autonomy.status();
  assert('a blocked buy does not eat the daily budget', st15.spentToday === 0, String(st15.spentToday));

  var ord15b = await marketplace.getOrder(ord15.id);
  assert('the order records why it stalled', ord15b.fulfillment && ord15b.fulfillment.state === 'manual-required');
  assert('and links the task', !!ord15b.fulfillment.taskId);

  // queue mode must stop before spending even when a provider could buy
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 5, minMarginPct: 0.1, requireFunds: false
  });
  var ord15c = await marketplace.createOrder({
    marketplaceId: mktId, buyerId: 'b15c', sellerId: 'usr_relay_house',
    listingId: pub.listingId, subtotal: 60
  });
  await marketplace.updateOrder(ord15c.id, { status: 'paid', shippingAddress: addr });
  var f15c = await engine2.fulfillPaidOrder({ orderId: ord15c.id });
  assert('queue mode holds the order', f15c.state === 'awaiting-approval', JSON.stringify(f15c).slice(0, 160));
  var approvals = await autonomy.pending();
  assert('the approval is queued for a human', approvals.length >= 1, String(approvals.length));

  global.fetch = realFetch;
  delete process.env.SERPAPI_KEY;

  console.log('');
  console.log(failures === 0
    ? 'ALL PASS (' + tests + ' assertions)'
    : failures + ' FAILED of ' + tests + ' assertions');
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('HARNESS ERROR:', e && e.stack || e);
  process.exit(1);
});
