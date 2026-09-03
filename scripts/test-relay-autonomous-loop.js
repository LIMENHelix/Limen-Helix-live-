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

// ── HERMETIC BY CONSTRUCTION ────────────────────────────────────────────────────────
// This suite must behave identically on a developer box holding every credential and on
// a bare CI runner holding none. Two failures already proved it did not:
//   - it passed locally and failed in CI purely because XAI_API_KEY happened to exist
//   - with SERPAPI_KEY set it made a REAL request to serpapi.com
// and with a real CJ_API_KEY, T23's placeOrder calls would have spent from the prepaid
// wallet. A failing assertion does not halt the run, so absence of a credential is far
// too weak a guard for a money-moving call.
//
// So: every provider credential is stripped, AND the transport itself is blocked. A test
// that needs a network answer installs its own stub and restores to this blocker, never
// to the real fetch.
['CJ_API_KEY', 'EBAY_BUY_TOKEN', 'EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET', 'EBAY_TOKEN',
 'SERPAPI_KEY', 'SERP_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_VISION_KEY', 'GOOGLE_CSE_ID',
 'GOOGLE_SEARCH_ENGINE_ID', 'XAI_API_KEY', 'GROK_API_KEY', 'STRIPE_SECRET_KEY'
].forEach(function (k) { delete process.env[k]; });

var LEAKED_REQUESTS = [];
var BLOCK_NETWORK = async function (u) {
  LEAKED_REQUESTS.push(String(u));
  throw new Error('BLOCKED: this suite must never make a real network request');
};
global.fetch = BLOCK_NETWORK;

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
var cj = require('../lib/relay-cj');
var store = require('../lib/relay-store');

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
  // The source filter is a DENY-list, not an allow-list. It used to name 16 marketplaces
  // and reject Walmart, REI, Reverb, AbeBooks and every independent store, which threw
  // away most of the supply. Anything with a price and a product page is now a lead;
  // only places that show products WITHOUT selling them are refused.
  assert('accepts a shop it has never heard of', reverseImage.isSourceable('https://someindiestore.com/products/jacket') === true);
  assert('accepts big retail', reverseImage.isSourceable('https://www.walmart.com/ip/1') === true);
  assert('accepts a specialist reseller', reverseImage.isSourceable('https://reverb.com/item/1') === true);
  assert('accepts a subdomain store', reverseImage.isSourceable('https://shop.goodwill.com/x') === true);
  assert('rejects a pin board', reverseImage.isSourceable('https://www.pinterest.com/pin/1') === false);
  assert('rejects an encyclopedia', reverseImage.isSourceable('https://en.wikipedia.org/wiki/Jacket') === false);
  assert('rejects our own storefront', reverseImage.isSourceable('https://limenhelix.com/api/relay') === false);
  assert('marks ebay auto-buyable and others manual',
    reverseImage.buyMode('https://www.ebay.com/itm/1') === 'auto' &&
    reverseImage.buyMode('https://reverb.com/item/1') === 'manual');

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

  // The cart checkout is the OTHER route that takes money in the firewalled core, so it
  // must enforce the same gate. (handlers/relay-marketplace-checkout is deliberately NOT
  // checked here: it writes the trade-shared store, sits outside the firewall, and was
  // left exactly as it was. See scripts/test-relay-firewall.js.)
  var cartEarly = require('../handlers/relay-cart-checkout');
  var r6c = await invoke(cartEarly, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: 'nope', qty: 1 }], shippingAddress: addr, buyerEmail: 'a@b.com' }
  });
  assert('cart checkout also refuses without the tick',
    r6c.status === 400 && /policy/.test(JSON.stringify(r6c.body)), JSON.stringify(r6c.body).slice(0, 140));

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
  // Relay uses its OWN store now. lib/relay-marketplace is the TRADE domain's auction
  // store and is off limits; scripts/test-relay-firewall.js enforces that.
  var mktId = 'mkt_relay_test';
  var plain = await store.createListing({
    marketplaceId: mktId, sellerId: 'usr_seller', title: 'listing with no source', price: 30
  });
  assert('a listing with no source URL is stored as such', plain.sourceUrl === null);
  var ord = await store.createOrder({
    buyerId: 'b1',
    lines: [{ listingId: plain.id, qty: 1, unitPrice: 30, title: plain.title }],
    shippingAddress: addr
  });
  assert('order created', !!ord.id, JSON.stringify(ord).slice(0, 120));
  await store.updateOrder(ord.id, { status: 'paid' });
  var f12 = await engine.fulfillPaidOrder({ orderId: ord.id });
  assert('refuses to auto-source it', f12.ok === false && f12.state === 'failed', JSON.stringify(f12).slice(0, 160));
  assert('and says the listing has no source', /source URL/.test(JSON.stringify(f12.lines || [])), JSON.stringify(f12.lines));

  var sourced = await store.createListing({
    marketplaceId: mktId, sellerId: 'usr_relay_house', title: 'sourced item', price: 60,
    sourceMarketplace: 'ebay', sourceId: 'v1|123|0',
    sourceUrl: 'https://www.ebay.com/itm/123456789012', sourceCost: 40
  });
  assert('source provenance persists on the listing', sourced.sourceUrl && sourced.sourceCost === 40);
  assert('and never reaches a customer', store.publicListing(sourced).sourceUrl === undefined);

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
      // BOTH response shapes on purpose. Which provider answers depends on whether a
      // reference image was generated, which depends on XAI_API_KEY being present in the
      // environment. Returning only visual_matches made this test pass on a machine that
      // happened to have that key and fail in CI, which is exactly the kind of
      // environment-dependent test that certifies nothing.
      const matches = [
        { title: 'Vintage leather jacket size M', link: 'https://reverb.com/item/223344556677', source: 'Reverb', price: { extracted_value: 40, currency: 'USD' }, thumbnail: 'https://img/1.jpg' },
        { title: 'Not for sale blog post', link: 'https://someblog.example/jackets', source: 'Blog' },
        { title: 'Too expensive', link: 'https://reverb.com/item/998877665544', source: 'Reverb', price: { extracted_value: 900, currency: 'USD' } }
      ];
      const shopping = matches.map(function (m) {
        return {
          title: m.title,
          product_link: m.link,
          source: m.source,
          extracted_price: m.price ? m.price.extracted_value : undefined,
          thumbnail: m.thumbnail
        };
      });
      return { ok: true, json: async function () { return { visual_matches: matches, shopping_results: shopping }; } };
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

  var storedListing = await store.getListing(pub.listingId);
  assert('provenance is persisted', storedListing.sourceUrl === 'https://reverb.com/item/223344556677');
  assert('source cost is persisted', storedListing.sourceCost === 40);
  assert('the margin in force is stamped on the listing', storedListing.marginAtListing === 0.50);

  var again = await engine2.discoverAndList({
    concept: 'vintage leather jacket', marketplaceId: mktId,
    sellerId: 'usr_relay_house', maxSourcePrice: 100, maxPerCycle: 3
  });
  assert('does not re-publish the same source URL', again.published.every(function (x) {
    return x.sourceUrl !== 'https://reverb.com/item/223344556677';
  }), JSON.stringify(again.published));

  // ── T15 ─────────────────────────────────────────────────────────────────
  console.log('T15: a paid order runs the gate and settles the margin');
  var ord15 = await store.createOrder({
    buyerId: 'b15',
    lines: [{ listingId: pub.listingId, qty: 1, unitPrice: 60, title: pub.title }],
    shippingAddress: addr
  });
  await store.updateOrder(ord15.id, { status: 'paid' });
  await db.set('relay:autonomy-ledger', []);

  var f15 = await engine2.fulfillPaidOrder({ orderId: ord15.id });
  assert('no eBay Buy token means no silent purchase', f15.ok === false, JSON.stringify(f15).slice(0, 160));
  assert('it becomes a manual task, not a failure', f15.state === 'manual-required', f15.state);
  var st15 = await autonomy.status();
  assert('a blocked buy does not eat the daily budget', st15.spentToday === 0, String(st15.spentToday));

  var ord15b = await store.getOrder(ord15.id);
  assert('the order records why it stalled', ord15b.fulfillment && ord15b.fulfillment.state === 'manual-required');
  assert('and links the task', !!ord15b.fulfillment.taskId);

  // queue mode must stop before spending even when a provider could buy
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 5, minMarginPct: 0.1, requireFunds: false
  });
  var ord15c = await store.createOrder({
    buyerId: 'b15c',
    lines: [{ listingId: pub.listingId, qty: 1, unitPrice: 60, title: pub.title }],
    shippingAddress: addr
  });
  await store.updateOrder(ord15c.id, { status: 'paid' });
  var f15c = await engine2.fulfillPaidOrder({ orderId: ord15c.id });
  assert('queue mode holds the order', f15c.state === 'awaiting-approval', JSON.stringify(f15c).slice(0, 160));
  var approvals = await autonomy.pending();
  assert('the approval is queued for a human', approvals.length >= 1, String(approvals.length));

  // ── T16 ─────────────────────────────────────────────────────────────────
  // The highest-stakes path in Relay: /api/relay-checkout will mint a real Stripe
  // payment link from a feed it does not own. If that feed is serving demo data, a
  // customer can pay for something nobody can ship. Stripe IS configured in
  // production, so this guard is the only thing standing in the way.
  console.log('T16: checkout refuses supply that cannot be fulfilled');

  // Pretend Stripe is configured, so the guard is what we are actually testing and
  // not the missing-key early return.
  var railPath = require.resolve('../lib/stripe-rail');
  var realRail = require('../lib/stripe-rail');
  require.cache[railPath].exports = {
    hasKey: function () { return true; },
    createPaymentLink: async function (o) {
      return { ok: true, url: 'https://buy.stripe.com/test_LINK', paymentLinkId: 'plink_test', amount: o.amount };
    }
  };
  delete require.cache[require.resolve('../handlers/relay-checkout')];
  var checkout = require('../handlers/relay-checkout');

  var feedSource = 'sample';
  var feedItems = [{ id: 'dj1', price: 13.49, url: null }];
  global.fetch = async function (url) {
    if (String(url).indexOf('/api/feed') !== -1) {
      return { ok: true, json: async function () { return { source: feedSource, live: true, items: feedItems }; } };
    }
    return { ok: false, status: 404, json: async function () { return {}; }, text: async function () { return ''; } };
  };

  var c1 = await invoke(checkout, {
    method: 'POST', headers: {},
    body: { items: [{ id: 'dj1', qty: 1 }], policyAccepted: true }
  });
  assert('demo supply is refused', c1.status === 409, String(c1.status) + ' ' + JSON.stringify(c1.body).slice(0, 140));
  assert('says nothing was charged', /nothing has been charged/i.test(JSON.stringify(c1.body)), JSON.stringify(c1.body).slice(0, 160));
  assert('reports the supply source', c1.body && c1.body.supplySource === 'sample');

  var c2 = await invoke(checkout, {
    method: 'POST', headers: {},
    body: { items: [{ id: 'dj1', qty: 1 }] }
  });
  assert('refuses without the final-sale confirmation', c2.status === 400 && /policy/.test(JSON.stringify(c2.body)), JSON.stringify(c2.body).slice(0, 140));

  // Real supply, but the item carries no source listing: still unbuyable.
  feedSource = 'ebay';
  feedItems = [{ id: 'e1', price: 50, url: null }];
  var c3 = await invoke(checkout, {
    method: 'POST', headers: {},
    body: { items: [{ id: 'e1', qty: 1 }], policyAccepted: true }
  });
  assert('real supply with no source URL is still refused', c3.status === 409, String(c3.status) + ' ' + JSON.stringify(c3.body).slice(0, 140));
  assert('names the unsourceable item', /e1/.test(JSON.stringify(c3.body || {})), JSON.stringify(c3.body).slice(0, 140));

  // Real, sourceable supply: this is the only case that may take money.
  feedItems = [{ id: 'e1', price: 50, url: 'https://www.ebay.com/itm/112233445566' }];
  var c4 = await invoke(checkout, {
    method: 'POST', headers: {},
    body: { items: [{ id: 'e1', qty: 1 }], policyAccepted: true }
  });
  assert('real sourceable supply is allowed through', c4.status === 200 && c4.body && c4.body.ok === true, JSON.stringify(c4.body).slice(0, 160));
  assert('charges price plus shipping under $75', c4.body.total === 55.99, String(c4.body && c4.body.total));
  assert('stamps the policy version on the sale', !!(c4.body && c4.body.policyVersion));

  // ── T17 ─────────────────────────────────────────────────────────────────
  console.log('T17: the storefront catalogue cannot leak what we paid');
  process.env.RELAY_MARKETPLACE_ID = mktId;
  delete require.cache[require.resolve('../handlers/relay-storefront')];
  var storefront = require('../handlers/relay-storefront');

  var cat = await invoke(storefront, { method: 'GET', url: '/api/relay-storefront?format=json', headers: {} });
  assert('catalogue responds', cat.status === 200 && cat.body && cat.body.ok === true, JSON.stringify(cat.body).slice(0, 140));
  var catBlob = JSON.stringify(cat.body);
  assert('no source URL in the catalogue', catBlob.indexOf('ebay.com/itm') === -1, catBlob.slice(0, 200));
  assert('no sourceCost field', catBlob.indexOf('sourceCost') === -1);
  assert('no sourceMarketplace field', catBlob.indexOf('sourceMarketplace') === -1);
  assert('no marginAtListing field', catBlob.indexOf('marginAtListing') === -1);
  assert('the engine item IS on the shelf', (cat.body.listings || []).some(function (l) { return l.id === pub.listingId; }));
  // `plain` is a seller's own listing (no sourceUrl) but not a house listing, so it stays.
  // A HOUSE listing with no source must be hidden: nothing could ever ship.
  var orphan = await store.createListing({
    marketplaceId: mktId, sellerId: 'usr_relay_house', title: 'house item with no source', price: 20
  });
  var cat2 = await invoke(storefront, { method: 'GET', url: '/api/relay-storefront?format=json', headers: {} });
  assert('an unsourceable house listing is hidden', !(cat2.body.listings || []).some(function (l) { return l.id === orphan.id; }));

  var pageResp = await invoke(storefront, { method: 'GET', url: '/api/relay-storefront', headers: {} });
  assert('the store page renders', pageResp.status === 200 && typeof pageResp.body === 'string' && pageResp.body.indexOf('<!DOCTYPE html>') === 0);
  assert('the page ships the final-sale banner', pageResp.body.indexOf('All sales are final') !== -1);

  // ── T18 ─────────────────────────────────────────────────────────────────
  console.log('T18: cart checkout is one order, priced server-side');
  require.cache[railPath].exports = {
    hasKey: function () { return true; },
    createPaymentLink: async function (o) {
      return { ok: true, url: 'https://buy.stripe.com/test_CART', paymentLinkId: 'plink_cart', amount: o.amount };
    }
  };
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];
  var cartCheckout = require('../handlers/relay-cart-checkout');

  var goodAddr = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };

  var k1 = await invoke(cartCheckout, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: pub.listingId, qty: 1 }], shippingAddress: goodAddr, buyerEmail: 'a@b.com' }
  });
  assert('refuses without the final-sale tick', k1.status === 400 && /policy/.test(JSON.stringify(k1.body)), JSON.stringify(k1.body).slice(0, 140));

  var k2 = await invoke(cartCheckout, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: pub.listingId, qty: 1 }], shippingAddress: { name: 'A' }, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('refuses an incomplete address', k2.status === 400 && Array.isArray(k2.body.missing) && k2.body.missing.length >= 4, JSON.stringify(k2.body).slice(0, 160));

  var k3 = await invoke(cartCheckout, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: pub.listingId, qty: 1 }], shippingAddress: goodAddr, buyerEmail: 'nope', policyAccepted: true }
  });
  assert('refuses an invalid email', k3.status === 400 && /email/.test(JSON.stringify(k3.body)));

  var k4 = await invoke(cartCheckout, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: orphan.id, qty: 1 }], shippingAddress: goodAddr, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('refuses a house item with no source', k4.status === 409 && /cannot be sourced/.test(JSON.stringify(k4.body)), JSON.stringify(k4.body).slice(0, 160));

  var k5 = await invoke(cartCheckout, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: pub.listingId, qty: 99 }], shippingAddress: goodAddr, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('refuses more than we hold', k5.status === 409 && /only 1 available/.test(JSON.stringify(k5.body)), JSON.stringify(k5.body).slice(0, 160));

  // A second sourced item, so the cart is genuinely multi-line.
  var second = await store.createListing({
    marketplaceId: mktId, sellerId: 'usr_relay_house', title: 'second sourced item', price: 30,
    sourceMarketplace: 'ebay', sourceId: 'v1|777|0',
    sourceUrl: 'https://www.ebay.com/itm/777788889999', sourceCost: 20, quantity: 1
  });

  var k6 = await invoke(cartCheckout, {
    method: 'POST', headers: { 'user-agent': 'test-agent' },
    body: {
      // The client sends a price; the server must ignore it entirely.
      items: [{ listingId: pub.listingId, qty: 1, price: 0.01 }, { listingId: second.id, qty: 1 }],
      shippingAddress: goodAddr, buyerEmail: 'a@b.com', policyAccepted: true
    }
  });
  assert('a valid cart is accepted', k6.status === 200 && k6.body.ok === true, JSON.stringify(k6.body).slice(0, 180));
  // 60 + 30 = 90 subtotal, over the $75 free-shipping line
  assert('total is recomputed from the listings, not the client', k6.body.total === 90, String(k6.body.total));
  assert('shipping is free over $75', k6.body.shipping === 0, String(k6.body.shipping));
  assert('stamps the policy version', !!k6.body.policyVersion);

  var cartOrder = await store.getOrder(k6.body.orderId);
  assert('the order carries both lines', cartOrder.lines && cartOrder.lines.length === 2, JSON.stringify(cartOrder.lines));
  assert('the address is stored for fulfilment', cartOrder.shippingAddress && cartOrder.shippingAddress.postalCode === '64111');
  assert('the acceptance is stored on the order', cartOrder.policyAcceptance && /^[0-9a-f]{64}$/.test(cartOrder.policyAcceptance.policyHash));
  assert('the user agent is captured as evidence', cartOrder.policyAcceptance.userAgent === 'test-agent');

  // ── T19 ─────────────────────────────────────────────────────────────────
  console.log('T19: a multi-line order authorises each line separately');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 5, minMarginPct: 0.1, requireFunds: false
  });
  await store.updateOrder(k6.body.orderId, { status: 'paid' });
  var f19 = await engine2.fulfillPaidOrder({ orderId: k6.body.orderId });
  assert('both lines were attempted', f19.lines && f19.lines.length === 2, JSON.stringify(f19).slice(0, 180));
  assert('neither silently succeeded without a Buy token', f19.ok === false && f19.state === 'manual-required', f19.state);
  assert('each line got its own decision', f19.lines[0].decisionId !== f19.lines[1].decisionId);
  var st19 = await autonomy.status();
  assert('no budget consumed by blocked lines', st19.spentToday === 0, String(st19.spentToday));

  require.cache[railPath].exports = realRail;
  global.fetch = realFetch;
  delete process.env.SERPAPI_KEY;

  // ── T20 ─────────────────────────────────────────────────────────────────
  // The operator's on/off switch. The complaint this answers: nothing on any screen
  // ever said the loop was stopped or why, so "fails closed" was invisible.
  console.log('T20: the on/off control');
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var control = require('../handlers/relay-autonomous-control');

  var pg = await invoke(control, { method: 'GET', url: '/api/relay?view=control', headers: {} });
  assert('the console page serves without a key', pg.status === 200 &&
    typeof pg.body === 'string' && pg.body.indexOf('Relay Control') !== -1);
  assert('the page ships an OFF switch', typeof pg.body === 'string' && /data-m="off"/.test(pg.body));
  assert('and a QUEUE and AUTO switch', /data-m="queue"/.test(pg.body) && /data-m="auto"/.test(pg.body));

  var noKey = await invoke(control, { method: 'GET', url: '/api/relay?view=control&action=readiness', headers: {} });
  assert('but data still needs the key', noKey.status === 403, String(noKey.status));

  var rd = await invoke(control, {
    method: 'GET', url: '/api/relay?view=control&action=readiness&key=' + process.env.RELAY_ADMIN_KEY, headers: {}
  });
  assert('readiness reports what is connected', rd.status === 200 && Array.isArray(rd.body.credentials) && rd.body.credentials.length >= 6);
  assert('it says whether sourcing is possible at all', typeof rd.body.canSource === 'boolean');
  assert('it says whether we can charge at all', typeof rd.body.canCharge === 'boolean');
  // The whole point of booleans: a console that leaks the key it is gated by is worse
  // than no console.
  assert('no credential VALUE is ever returned',
    JSON.stringify(rd.body).indexOf(process.env.RELAY_ADMIN_KEY) === -1);

  var off = await invoke(control, {
    method: 'POST', url: '/api/relay?view=control', headers: {},
    body: { action: 'set-mode', mode: 'off', key: process.env.RELAY_ADMIN_KEY }
  });
  assert('the switch turns the loop OFF', off.status === 200 && off.body.config.mode === 'off', JSON.stringify(off.body).slice(0, 120));
  var offCycle = await engine.runCycle();
  assert('and OFF actually stops the cycle', offCycle.skipped === true, JSON.stringify(offCycle).slice(0, 120));

  var badKey = await invoke(control, {
    method: 'POST', url: '/api/relay?view=control', headers: {},
    body: { action: 'set-mode', mode: 'auto', key: 'wrong' }
  });
  assert('a wrong key cannot flip the switch', badKey.status === 403, String(badKey.status));

  // ── T21 ───────────────────────────────────────────
  // Price extraction, after code review found seven ways it silently produced a WRONG
  // number. Each of these is a money bug: the figure here becomes the acquisition cost
  // that the spend cap and the margin floor are checked against.
  console.log('T21: a price is read only when it is unambiguous');

  // Silence is not USD. A GBP shop that omits the currency field must not price as dollars.
  assert('missing currency is refused', reverseImage.priceFromPagemap({ offer: [{ price: '75.00' }] }) === null);
  assert('explicit USD is accepted', reverseImage.priceFromPagemap({ offer: [{ price: '75.00', pricecurrency: 'USD' }] }) === 75);
  assert('explicit GBP is refused', reverseImage.priceFromPagemap({ offer: [{ price: '75.00', pricecurrency: 'GBP' }] }) === null);

  // An out-of-stock offer still carries a price. Sourcing it means selling what we cannot buy.
  assert('OutOfStock is refused', reverseImage.priceFromPagemap({ offer: [{ price: '50', pricecurrency: 'USD', availability: 'https://schema.org/OutOfStock' }] }) === null);
  assert('InStock is accepted', reverseImage.priceFromPagemap({ offer: [{ price: '50', pricecurrency: 'USD', availability: 'https://schema.org/InStock' }] }) === 50);

  // twitter:data1 is a generic slot holding "5 minutes", an SKU or a stock count.
  assert('unlabelled twitter:data1 is refused', reverseImage.priceFromPagemap({ metatags: [{ 'twitter:data1': '5 minutes', 'og:price:currency': 'USD' }] }) === null);
  assert('twitter:data1 labelled Price is accepted', reverseImage.priceFromPagemap({ metatags: [{ 'twitter:label1': 'Price', 'twitter:data1': '42.00', 'og:price:currency': 'USD' }] }) === 42);

  // A category or comparison page carries several products and no way to know which one
  // the result URL is about.
  assert('multi-product page is refused', reverseImage.priceFromPagemap({ product: [{ price: '10', pricecurrency: 'USD' }, { price: '20', pricecurrency: 'USD' }] }) === null);
  assert('the same price repeated is fine', reverseImage.priceFromPagemap({ product: [{ price: '10', pricecurrency: 'USD' }, { price: '10', pricecurrency: 'USD' }] }) === 10);

  // Stripping separators turns 1.299,00 into 1.29900 and reads $1.30 for a $1,299 item.
  assert('European format is refused', reverseImage.parseAmount('1.299,00') === null);
  assert('decimal comma is refused', reverseImage.parseAmount('1299,00') === null);
  assert('exponent form is refused', reverseImage.parseAmount('1.2e2') === null);
  assert('US format parses exactly', reverseImage.parseAmount('$1,299.00') === 1299);
  assert('plain decimal parses', reverseImage.parseAmount('49.99') === 49.99);

  assert('separate shipping is read', reverseImage.shippingFromPagemap({ offer: [{ shippingrate: '7.50' }] }) === 7.5);
  assert('absent shipping is null, not zero', reverseImage.shippingFromPagemap({ offer: [{ price: '10' }] }) === null);

  // ── T22 ───────────────────────────────────────────
  // Full automation means the item must be buyable NOW at a stated price. An auction lot
  // cannot be: you bid and wait and may lose. Publishing one takes a customer's money for
  // something we cannot guarantee obtaining, which manufactures the never-arrives refund.
  console.log('T22: auction lots are never sourced on demand');
  ['https://www.govdeals.com/x', 'https://www.propertyroom.com/x', 'https://www.liveauctioneers.com/x',
   'https://www.shopgoodwill.com/x', 'https://www.hibid.com/x', 'https://www.liquidation.com/x']
    .forEach(function (u) { assert('auction refused: ' + reverseImage.hostOf(u), reverseImage.isFixedPrice(u) === false); });
  ['https://www.ebay.com/itm/1', 'https://www.etsy.com/listing/1', 'https://www.walmart.com/ip/1',
   'https://reverb.com/item/1', 'https://www.mercari.com/item/1']
    .forEach(function (u) { assert('buy-now host allowed: ' + reverseImage.hostOf(u), reverseImage.isFixedPrice(u) === true); });

  // A hostname test is not enough: eBay, Etsy and Catawiki run auctions AND buy-it-now on
  // the same domain, and on an auction page the number shown is the current BID.
  assert('auction wording is caught anywhere',
    reverseImage.isBuyableNow({ url: 'https://www.ebay.com/itm/1', title: 'Vintage jacket 3 bids' }) === false);
  assert('a mixed-format host with no buy-now signal is refused',
    reverseImage.isBuyableNow({ url: 'https://www.ebay.com/itm/1', title: 'Vintage jacket' }) === false);
  assert('a confirmed buy-now on eBay is allowed',
    reverseImage.isBuyableNow({ url: 'https://www.ebay.com/itm/1', title: 'Vintage jacket', fixedPriceConfirmed: true }) === true);
  assert('a plain shop needs no extra signal',
    reverseImage.isBuyableNow({ url: 'https://reverb.com/item/1', title: 'Guitar' }) === true);
  assert('an auction host is still refused',
    reverseImage.isBuyableNow({ url: 'https://www.govdeals.com/x', title: 'Lot' }) === false);

  // ── T23 ───────────────────────────────────────────
  // CJ is the ONLY provider that spends money without a human, so its refusals matter
  // more than its successes. eBay denied the Buy API; this is the whole automation path.
  console.log('T23: the CJ supplier path');
  assert('unconfigured CJ reports it, does not throw', cj.configured() === false);
  var cjOff = await cj.search({ keyword: 'phone case' });
  assert('search fails closed with no key', cjOff.ok === false && cjOff.items.length === 0);
  assert('and names the missing credential', /CJ_API_KEY/.test(cjOff.reason || ''), cjOff.reason);
  var cjOrder = await cj.placeOrder({ orderNumber: 'o1', vid: '123', shippingAddress: addr });
  assert('placing an order with no key is refused', cjOrder.ok === false && /CJ_API_KEY/.test(cjOrder.error));

  // Address and idempotency are checked BEFORE any spend, because a half-placed order
  // against a prepaid wallet is money gone with nothing to ship.
  // TRANSPORT-LEVEL MOCK, not merely an absent credential.
  //
  // These calls exercise placeOrder, and placeOrder spends from a prepaid wallet. An
  // audit made the point correctly: relying on CJ_API_KEY being unset is one stray
  // process.env restore away from a real purchase, and a failing assertion does not halt
  // the run. So fetch itself is replaced for this block. Even with a live key present and
  // every other guard defeated, no request can leave the machine.
  var realFetchCj = global.fetch;
  var escaped = [];
  global.fetch = async function (u) {
    escaped.push(String(u));
    throw new Error('BLOCKED: the test suite must never reach a live supplier');
  };
  process.env.CJ_API_KEY = 'TEST-NOT-A-REAL-KEY@api@0000';
  delete require.cache[require.resolve('../lib/relay-cj')];
  var cj2 = require('../lib/relay-cj');

  var noAddr = await cj2.placeOrder({ orderNumber: 'o1', vid: '1', shippingAddress: { name: 'A' } });
  assert('an incomplete address is refused before spending', noAddr.ok === false && /address missing/.test(noAddr.error), noAddr.error);
  var noVid = await cj2.placeOrder({ orderNumber: 'o1', shippingAddress: addr });
  assert('a missing variant id is refused', noVid.ok === false && /vid required/.test(noVid.error));
  var noOrd = await cj2.placeOrder({ vid: '1', shippingAddress: addr });
  assert('a missing order number is refused (idempotency)', noOrd.ok === false && /orderNumber required/.test(noOrd.error));

  // The point of the mock: prove every one of those refusals happened BEFORE the network,
  // rather than being caught by a request that failed for some other reason.
  assert('no CJ request was attempted at all', escaped.length === 0, escaped.join(', '));

  // And prove the mock would actually catch an escape, so it is not a guard that has
  // never been shown to work.
  var wouldEscape = await cj2.placeOrder({ orderNumber: 'o2', vid: '1', shippingAddress: addr });
  assert('a fully-formed order is stopped at the transport', wouldEscape.ok === false);
  assert('and the block is what stopped it', escaped.length > 0 && /cjdropshipping/.test(escaped[0]), escaped.join(', '));

  global.fetch = realFetchCj;
  delete process.env.CJ_API_KEY;
  delete require.cache[require.resolve('../lib/relay-cj')];

  // ── T24 ───────────────────────────────────────────
  console.log('T24: a CJ order never silently overspends its authorisation');
  var cjPath = require.resolve('../lib/relay-cj');
  var realCj = require('../lib/relay-cj');
  delete require.cache[require.resolve('../lib/relay-buy')];
  require.cache[cjPath].exports = {
    configured: function () { return true; },
    placeOrder: async function () { return { ok: true, sourceOrderId: 'CJ-1', amount: 120 }; }
  };
  var buy2 = require('../lib/relay-buy');
  // CJ has ALREADY charged the wallet by the time we see the amount. Reporting ok:false
  // released the reservation, filed a manual task and understated the day's spend, while
  // inviting a human or a retry to buy the same thing again. The purchase stands and is
  // flagged instead.
  var over = await buy2.buyFromCJ({ orderId: 'o9', listingId: 'l9', sourceId: 'v1', maxCost: 40, shippingAddress: addr });
  assert('an overspent order is still recorded as bought', over.ok === true, JSON.stringify(over));
  assert('and it is flagged for review', over.needsReview === true);
  assert('the review names the CJ order', /CJ-1/.test(over.reviewReason || ''), over.reviewReason);
  assert('and it settles at what was actually charged', over.amount === 120, String(over.amount));

  require.cache[cjPath].exports = {
    configured: function () { return true; },
    placeOrder: async function () { return { ok: true, sourceOrderId: 'CJ-2', amount: 41 }; }
  };
  delete require.cache[require.resolve('../lib/relay-buy')];
  var buy3 = require('../lib/relay-buy');
  var okBuy = await buy3.buyFromCJ({ orderId: 'o10', listingId: 'l10', sourceId: 'v1', maxCost: 40, shippingAddress: addr });
  assert('a small variance within tolerance is accepted', okBuy.ok === true && okBuy.sourceOrderId === 'CJ-2', JSON.stringify(okBuy));
  assert('and it is NOT flagged for review', okBuy.needsReview === false);
  assert('and it is marked as a real automated purchase', okBuy.provider === 'cj');

  // CJ's orderNumber is an idempotency key. Two CJ lines in one cart must not collide.
  var seen = [];
  require.cache[cjPath].exports = {
    configured: function () { return true; },
    placeOrder: async function (o) { seen.push(o.orderNumber); return { ok: true, sourceOrderId: 'CJ-' + seen.length, amount: 10 }; }
  };
  delete require.cache[require.resolve('../lib/relay-buy')];
  var buyIdem = require('../lib/relay-buy');
  await buyIdem.buyFromCJ({ orderId: 'ordX', listingId: 'lstA', sourceId: 'v1', maxCost: 20, shippingAddress: addr });
  await buyIdem.buyFromCJ({ orderId: 'ordX', listingId: 'lstB', sourceId: 'v2', maxCost: 20, shippingAddress: addr });
  assert('each cart line gets its own CJ order number', seen[0] !== seen[1], JSON.stringify(seen));
  assert('and the number is stable per line', /lstA/.test(seen[0]) && /lstB/.test(seen[1]), JSON.stringify(seen));

  // A timeout or 429 is not a job for a human: the engine's sweep only retries failed
  // fulfilments, so marking it manual removed a paid order from retry forever.
  require.cache[cjPath].exports = {
    configured: function () { return true; },
    placeOrder: async function () { return { ok: false, error: 'CJ request failed: timeout' }; }
  };
  delete require.cache[require.resolve('../lib/relay-buy')];
  var buyT = require('../lib/relay-buy');
  var tr = await buyT.execute({ orderId: 'o12', listingId: 'l12', sourceMarketplace: 'cj', sourceId: 'v1', sourceUrl: 'https://www.cjdropshipping.com/product/-p-1.html', maxCost: 40, shippingAddress: addr });
  assert('a transient failure stays retryable', tr.ok === false && tr.transient === true, JSON.stringify(tr).slice(0, 140));
  assert('and does NOT become a manual task', tr.mode !== 'manual');

  // An empty wallet is a top-up, not a broken integration. The operator must be able to
  // tell those apart from the task that gets filed.
  require.cache[cjPath].exports = {
    configured: function () { return true; },
    placeOrder: async function () { return { ok: false, error: 'CJ 200: insufficient balance', insufficientBalance: true }; }
  };
  delete require.cache[require.resolve('../lib/relay-buy')];
  var buy4 = require('../lib/relay-buy');
  var broke = await buy4.execute({ orderId: 'o11', sourceMarketplace: 'cj', sourceId: 'v1', sourceUrl: 'https://www.cjdropshipping.com/product/-p-1.html', maxCost: 40, shippingAddress: addr });
  assert('an empty wallet does not claim success', broke.ok === false);
  assert('it is flagged as a balance problem', broke.insufficientBalance === true, JSON.stringify(broke).slice(0, 160));
  assert('and a human task is filed with the source URL', !!broke.task && /cjdropshipping/.test(broke.task.sourceUrl));

  require.cache[cjPath].exports = realCj;
  delete require.cache[require.resolve('../lib/relay-buy')];

  // ── T25 ───────────────────────────────────────────
  // Product provenance is the operator's view and must never be reachable publicly: it
  // is the only place supplier, cost and spread appear together.
  console.log('T25: inventory provenance is operator-only');
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var ctl2 = require('../handlers/relay-autonomous-control');

  var invNoKey = await invoke(ctl2, { method: 'GET', url: '/api/relay?view=control&action=inventory', headers: {} });
  assert('inventory refuses without the operator key', invNoKey.status === 403, String(invNoKey.status));

  var invKeyed = await invoke(ctl2, {
    method: 'GET', url: '/api/relay?view=control&action=inventory&key=' + process.env.RELAY_ADMIN_KEY, headers: {}
  });
  assert('inventory answers for the operator', invKeyed.status === 200 && invKeyed.body.ok === true);
  assert('and reports a supplier breakdown', typeof invKeyed.body.bySupplier === 'object');

  // Put a fully sourced listing on the shelf and check both views of it.
  var provListing = await store.createListing({
    marketplaceId: 'mkt_relay_test', sellerId: 'usr_relay_house',
    title: 'provenance probe', price: 60,
    sourceMarketplace: 'cj', sourceId: 'v-probe',
    sourceUrl: 'https://www.cjdropshipping.com/product/-p-probe.html',
    sourceCost: 40, sourceShipping: 5, sourceFromCountry: 'US', sourceCarrier: 'CJPacket'
  });

  var inv2 = await invoke(ctl2, {
    method: 'GET', url: '/api/relay?view=control&action=inventory&key=' + process.env.RELAY_ADMIN_KEY, headers: {}
  });
  var row = (inv2.body.listings || []).find(function (l) { return l.id === provListing.id; });
  assert('the operator sees the supplier', row && row.supplier === 'cj', JSON.stringify(row || {}).slice(0, 120));
  assert('the operator sees what we paid', row && row.cost === 40);
  assert('the operator sees the spread', row && row.spread === 20);
  assert('the operator sees the source URL', row && /cjdropshipping/.test(row.sourceUrl || ''));
  assert('the operator sees the shipping warehouse', row && row.warehouse === 'US');

  // The same listing through the customer-facing catalogue.
  delete require.cache[require.resolve('../handlers/relay-storefront')];
  var sf2 = require('../handlers/relay-storefront');
  var pub2 = await invoke(sf2, { method: 'GET', url: '/api/relay?view=catalog&format=json', headers: {} });
  var pubBlob = JSON.stringify(pub2.body);
  assert('the customer catalogue carries no supplier', pubBlob.indexOf('"cj"') === -1 && pubBlob.indexOf('sourceMarketplace') === -1);
  assert('no source URL reaches the customer', pubBlob.indexOf('cjdropshipping') === -1);
  assert('no cost reaches the customer', pubBlob.indexOf('sourceCost') === -1 && pubBlob.indexOf('"cost"') === -1);
  assert('no spread or warehouse reaches the customer',
    pubBlob.indexOf('spread') === -1 && pubBlob.indexOf('sourceFromCountry') === -1);

  // ── T26 ─────────────────────────────────────────────────────────────────
  // A concept nothing can satisfy used to pin itself to rank one forever: the unmet
  // bonus was permanent. Observed in production, the same term picked at 14:05, 14:35,
  // 15:05 and 15:35, publishing nothing, while every other recorded term went untried.
  console.log('T26: a concept that never yields stops being re-picked');
  await db.set('relay:searches', [
    { description: 'unsatisfiable thing', resultCount: 0, ts: new Date().toISOString() },
    { description: 'untried thing', resultCount: 0, ts: new Date().toISOString() }
  ]);
  await db.set('relay:engine-misses', {});
  var first = await engine.pickConcept();
  assert('an unmet term is picked first', first.origin === 'demand', JSON.stringify(first));

  for (var i = 0; i < 3; i++) await engine.recordOutcome(first.concept, 0);
  var next = await engine.pickConcept();
  assert('after repeated failure it is dropped', next.concept !== first.concept, next.concept + ' vs ' + first.concept);

  // A concept that DID work has its failures forgiven.
  await engine.recordOutcome(first.concept, 2);
  var misses = await db.get('relay:engine-misses');
  assert('a successful cycle clears the miss count', !misses[first.concept.toLowerCase()], JSON.stringify(misses));

  assert('seed concepts match the buyable supplier, not the old resale model',
    engine.SEED_CONCEPTS.every(function (c) { return !/vintage|retro|first edition|vinyl|film camera/i.test(c); }),
    engine.SEED_CONCEPTS.join(', '));

  // ── T27 ───────────────────────────────────────────
  // Two fail-open auth gates, same class. Both are the pattern where a missing
  // credential DISABLES the check instead of denying the request.
  console.log('T27: auth gates fail closed, not open');

  var mp = require('../handlers/relay-marketplace');
  var savedAdmin = process.env.RELAY_ADMIN_KEY;

  // The committed fallback 'relay-admin-demo' is in a public repo. With RELAY_ADMIN_KEY
  // unset it used to unlock every admin action.
  delete process.env.RELAY_ADMIN_KEY;
  var demoKey = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=verify-admin-key&key=relay-admin-demo', headers: {} });
  assert('the committed demo key does not unlock anything', demoKey.status === 401, String(demoKey.status));
  var noKey = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=verify-admin-key', headers: {} });
  assert('no key with no secret is refused', noKey.status === 401, String(noKey.status));
  var blank = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=verify-admin-key&key=', headers: {} });
  assert('a blank key is refused', blank.status === 401, String(blank.status));
  var listUnset = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=list-marketplace&key=relay-admin-demo', headers: {} });
  assert('an admin action is refused with the demo key', listUnset.status === 401, String(listUnset.status));

  process.env.RELAY_ADMIN_KEY = 'a-real-secret';
  var wrong = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=verify-admin-key&key=relay-admin-demo', headers: {} });
  assert('the demo key still fails once a real one is set', wrong.status === 401, String(wrong.status));
  var right = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=verify-admin-key&key=a-real-secret', headers: {} });
  assert('the real key works', right.status === 200, String(right.status));

  // Trade reads action=list-listings on this same handler and it must stay ungated.
  var tradeRead = await invoke(mp, { method: 'GET', url: '/api/relay-marketplace?action=list-listings&marketplaceId=mkt_relay', headers: {} });
  assert('trade list-listings read is NOT gated by this change', tradeRead.status === 200, String(tradeRead.status));

  if (savedAdmin === undefined) delete process.env.RELAY_ADMIN_KEY;
  else process.env.RELAY_ADMIN_KEY = savedAdmin;

  // The webhook reaches cj.placeOrder through handleCheckoutSuccess. With no secret set
  // the signature check used to be skipped entirely, so any POST could spend.
  var savedWh = process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete require.cache[require.resolve('../handlers/relay-stripe-webhook')];
  var wh = require('../handlers/relay-stripe-webhook');
  // The webhook reads its RAW body off the request stream for signature verification,
  // so the fixture has to behave like one.
  var rawEvent = JSON.stringify({ type: 'checkout.session.completed', data: { object: { metadata: { orderId: 'x' } } } });
  function streamReq(headers) {
    return {
      method: 'POST',
      url: '/api/relay-stripe-webhook',
      headers: headers || {},
      on: function (ev, cb) {
        if (ev === 'data') cb(Buffer.from(rawEvent));
        if (ev === 'end') cb();
        return this;
      }
    };
  }
  var unconfigured = await invoke(wh, streamReq({}));
  assert('an unconfigured webhook REFUSES rather than skipping the check',
    unconfigured.status === 503, String(unconfigured.status) + ' ' + JSON.stringify(unconfigured.body));

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  delete require.cache[require.resolve('../handlers/relay-stripe-webhook')];
  var wh2 = require('../handlers/relay-stripe-webhook');
  var badSig = await invoke(wh2, streamReq({ 'stripe-signature': 't=1,v1=deadbeef' }));
  assert('a bad signature is refused', badSig.status === 403, String(badSig.status));

  if (savedWh === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = savedWh;
  delete require.cache[require.resolve('../handlers/relay-stripe-webhook')];

  // ── T28 ───────────────────────────────────────────
  // The CJ probe reports supplier costs and source ids, so it is operator-only like the
  // inventory view. It is also read-only: it must never reach placeOrder.
  console.log('T28: the CJ probe is gated and read-only');
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var ctl3 = require('../handlers/relay-autonomous-control');

  var probeNoKey = await invoke(ctl3, { method: 'GET', url: '/api/relay?view=control&action=cj-probe', headers: {} });
  assert('cj-probe refuses without the operator key', probeNoKey.status === 403, String(probeNoKey.status));

  var probeKeyed = await invoke(ctl3, {
    method: 'GET', url: '/api/relay?view=control&action=cj-probe&key=' + process.env.RELAY_ADMIN_KEY, headers: {}
  });
  assert('cj-probe answers for the operator', probeKeyed.status === 200 && probeKeyed.body.ok === true, String(probeKeyed.status));
  assert('and reports every stage even with no key configured',
    probeKeyed.body.probe && probeKeyed.body.probe.stages &&
    ['listed', 'variantFound', 'inStock', 'freightQuoted', 'underBudget']
      .every(function (k) { return typeof probeKeyed.body.probe.stages[k] === 'number'; }),
    JSON.stringify(probeKeyed.body.probe && probeKeyed.body.probe.stages));
  assert('with CJ unconfigured it says so rather than throwing',
    probeKeyed.body.probe.configured === false &&
    /CJ_API_KEY/.test((probeKeyed.body.probe.errors || []).join(' ')),
    JSON.stringify(probeKeyed.body.probe.errors));

  // The probe shares relay-cj with the purchase path, so pin that it cannot order.
  var probeSrc = require('fs').readFileSync(require('path').join(__dirname, '../lib/relay-cj.js'), 'utf8');
  var probeBody = probeSrc.slice(probeSrc.indexOf('async function probe('), probeSrc.indexOf('module.exports'));
  assert('probe() never calls placeOrder', probeBody.indexOf('placeOrder') === -1);
  assert('probe() never hits the order endpoint', probeBody.indexOf('createOrder') === -1);

  // ── T29 ───────────────────────────────────────────
  // EVERY provider's results must reach the merge.
  //
  // CJ was added to the Promise.all in searchAllSources but left out of the concat one
  // line below, so it was queried on every cycle and every customer search — roughly 17
  // seconds of auth, list and per-product variant/stock/freight calls — and its results
  // were discarded immediately. The symptom read as "CJ returned nothing"; CJ was
  // returning five priced, in-stock items every time.
  //
  // Structural, so it holds for a provider added later too: the number of promises
  // gathered must equal the number of result slots concatenated.
  console.log('T29: no provider is silently dropped from the merge');
  var ssSrc = require('fs').readFileSync(require('path').join(__dirname, '../lib/relay-source-search.js'), 'utf8');
  // Bound the block by indexOf, not a regex: a non-greedy match stops at the first `])`,
  // which is inside `Promise.resolve([])`, and silently reports zero providers.
  var openAt = ssSrc.indexOf('const results = await Promise.all([');
  var closeAt = ssSrc.indexOf(']);', openAt);
  var gathered = openAt !== -1 ? ssSrc.slice(openAt, closeAt) : '';
  var providerCount = (gathered.match(/\bsearch[A-Z]\w*\(/g) || []).length;
  var concatLine = (ssSrc.match(/\[\]\.concat\(([^)]*)\)/) || [])[1] || '';
  // Compare the exact SET of indices, not how many appear. A count alone passes on
  // `results[0], results[2], results[2]` — three references, three providers, and the
  // reverse-image slot silently dropped while the behavioural assertion below still
  // finds CJ and goes green.
  var slots = (concatLine.match(/results\[(\d+)\]/g) || [])
    .map(function (s) { return parseInt(s.replace(/\D/g, ''), 10); });
  var want = [];
  for (var pi = 0; pi < providerCount; pi++) want.push(pi);
  var got = slots.slice().sort(function (a, b) { return a - b; });
  assert('every provider gathered is also concatenated, exactly once',
    providerCount > 0 && got.join(',') === want.join(','),
    providerCount + ' providers gathered, merged slots [' + got.join(',') +
    '], expected [' + want.join(',') + ']: ' + concatLine);

  // And behaviourally: a provider returning items must produce items out of the merge.
  // An earlier block set SERPAPI_KEY, and re-requiring the source-search chain here would
  // rebuild relay-reverse-image with it and attempt a real SerpAPI call. The transport
  // blocker catches it, but an attempted request is still a leak: this suite must reach
  // the network zero times.
  var savedSerp = process.env.SERPAPI_KEY;
  delete process.env.SERPAPI_KEY;
  delete require.cache[require.resolve('../lib/relay-reverse-image')];

  var ssPath = require.resolve('../lib/relay-source-search');
  var realSS = require('../lib/relay-source-search');
  delete require.cache[ssPath];
  var cjPath2 = require.resolve('../lib/relay-cj');
  var realCj2 = require('../lib/relay-cj');
  require.cache[cjPath2].exports = {
    configured: function () { return true; },
    search: async function () {
      return { ok: true, reason: null, items: [{
        itemId: 'v1', source: 'cj', title: 'stub case', price: 7.57, shipping: 4.87,
        shippingKnown: true, condition: 'new',
        url: 'https://www.cjdropshipping.com/product/-p-STUB.html',
        image: null, seller: 'CJ', vid: 'v1', stock: 100, buyable: true, provider: 'cj'
      }] };
    }
  };
  var ss2 = require('../lib/relay-source-search');
  var merged = await ss2.searchAllSources({ description: 'phone case', maxPrice: 500 });
  assert('a CJ result survives the merge', merged.ok === true && merged.items.length === 1,
    JSON.stringify({ ok: merged.ok, n: merged.items.length, reason: merged.reason }));
  assert('and is attributed to cj', (merged.sources || []).indexOf('cj') !== -1, JSON.stringify(merged.sources));
  assert('with its freight-inclusive cost intact', merged.items[0] && merged.items[0].price === 7.57);

  require.cache[cjPath2].exports = realCj2;
  if (savedSerp === undefined) delete process.env.SERPAPI_KEY;
  else process.env.SERPAPI_KEY = savedSerp;
  delete require.cache[ssPath];
  delete require.cache[require.resolve('../lib/relay-reverse-image')];
  require('../lib/relay-source-search');

  // ── T30 ─────────────────────────────────────────────────────────────────
  // A cheap result Relay CANNOT buy alone must not outrank one it can. Every eBay item
  // carries buyable:true because eBay has a Buy API, but that API refuses every call
  // until an approved keyset is in EBAY_BUY_TOKEN (lib/relay-buy.js:73-78). Ranking on
  // `buyable` alone let twenty $1 eBay results sort ahead of CJ on price and the
  // .slice(0, 20) then cut CJ out, so the loop published three listings that each stall
  // waiting for a human.
  console.log('T30: unattended stock outranks cheaper manual stock');
  var FREIGHT_OVERRIDE;   // undefined = quote as searched, a number = that price, null = refuse
  var STOCK_QTY = 100;    // what the supplier says it still holds
  var realFetchRank = global.fetch;
  var savedEbayId = process.env.EBAY_CLIENT_ID, savedEbaySecret = process.env.EBAY_CLIENT_SECRET;
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  // Local stub. Serves eBay's two endpoints from memory and reaches nothing.
  global.fetch = async function (u) {
    var url = String(u);
    if (url.indexOf('identity/v1/oauth2/token') !== -1) {
      return { ok: true, status: 200, json: async function () { return { access_token: 'tok', expires_in: 7200 }; } };
    }
    if (url.indexOf('item_summary/search') !== -1) {
      var summaries = [];
      for (var ei = 0; ei < 25; ei++) {
        summaries.push({
          itemId: 'ebay' + ei, title: 'cheap case ' + ei,
          price: { value: '1.00', currency: 'USD' },
          itemWebUrl: 'https://www.ebay.com/itm/' + ei,
          condition: 'Used'
        });
      }
      return { ok: true, status: 200, json: async function () { return { itemSummaries: summaries }; } };
    }
    return BLOCK_NETWORK(u);
  };
  delete require.cache[ssPath];
  var FREIGHT_CALLS = [];
  var cjStub30 = {
    configured: function () { return true; },
    // The destination requote. Returns the same $4.87 the search quoted unless a test
    // sets FREIGHT_OVERRIDE, so the ordinary path is unchanged and the interesting cases
    // are explicit.
    freight: async function (vid, qty, country, zip, fromCountry) {
      FREIGHT_CALLS.push({ vid: vid, qty: qty, country: country, zip: zip, fromCountry: fromCountry });
      if (FREIGHT_OVERRIDE === null) return null;
      return { price: FREIGHT_OVERRIDE == null ? 4.87 : FREIGHT_OVERRIDE, carrier: 'CJPacket' };
    },
    // A freight quote says nothing about inventory, so the revalidation asks separately.
    stock: async function () { return { qty: STOCK_QTY, from: 'US' }; },
    search: async function () {
      return { ok: true, reason: null, items: [{
        itemId: 'v9', source: 'cj', title: 'CJ case', price: 7.57, shipping: 4.87,
        shippingKnown: true, carrier: 'CJPacket', fromCountry: 'US', condition: 'new',
        url: 'https://www.cjdropshipping.com/product/-p-RANK.html',
        image: null, seller: 'CJ Dropshipping', vid: 'v9', stock: 100,
        buyable: true, provider: 'cj'
      }] };
    }
  };
  require.cache[cjPath2].exports = cjStub30;
  var ss3 = require('../lib/relay-source-search');
  var ranked = await ss3.searchAllSources({ description: 'phone case', maxPrice: 500 });
  assert('both providers merged', ranked.ok === true && ranked.items.length === 20,
    JSON.stringify({ n: ranked.items.length, sources: ranked.sources }));
  assert('the CJ item ranks first despite costing 7x more',
    ranked.items[0] && ranked.items[0].source === 'cj',
    ranked.items[0] && ranked.items[0].source + ' @ $' + ranked.items[0].price);
  assert('and therefore survives the truncation',
    ranked.items.some(function (i) { return i.source === 'cj'; }));
  assert('eBay without a Buy keyset is not treated as unattended',
    ss3.unattended({ source: 'ebay' }) === false);
  // The rank follows the credential, not the marketplace name: load the keyset and the
  // cheaper eBay item is genuinely orderable, so price decides again.
  process.env.EBAY_BUY_TOKEN = 'test-buy-token';
  var rankedWithToken = await ss3.searchAllSources({ description: 'phone case', maxPrice: 500 });
  assert('with the keyset loaded, cheapest wins again',
    rankedWithToken.items[0] && rankedWithToken.items[0].source === 'ebay',
    rankedWithToken.items[0] && rankedWithToken.items[0].source);
  delete process.env.EBAY_BUY_TOKEN;

  // ── T31 ─────────────────────────────────────────────────────────────────
  // The customer path must carry the same freight provenance the engine records.
  // buyFromCJ only requotes shipping to the buyer's real country when sourceShipping is
  // present (lib/relay-buy.js:185). relay-demand-search recorded only id/cost/url/buyable,
  // so a customer-initiated CJ order skipped that requote, was charged against a quote to
  // CJ's DEFAULT destination, and with fromCountry null asked the default CN warehouse to
  // ship a variant quoted from US stock.
  console.log('T31: freight provenance survives the customer path');
  // Checkout now asks the fulfilment gate before charging, so these fixtures need limits
  // that would actually let the purchase happen. $3.79 on an $11.36 sale is a real spread
  // but under the DEFAULT $8 floor, which is the subject of its own assertion below.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  var financePath = require.resolve('../lib/relay-finance-bridge');
  var realFinance = require('../lib/relay-finance-bridge');
  require.cache[financePath].exports = Object.assign({}, realFinance, {
    paymentsEnabled: function () { return true; },
    createPayment: async function () {
      return { ok: true, url: 'https://pay.test/x', paymentLinkId: 'plink_test' };
    }
  });
  // relay-supplier-quote holds its own reference to relay-cj, so it must be rebuilt after
  // the stub is installed or it revalidates against the real module.
  delete require.cache[require.resolve('../lib/relay-supplier-quote')];
  delete require.cache[require.resolve('../handlers/relay-demand-search')];
  delete require.cache[require.resolve('../handlers/relay-demand-purchase')];
  var dSearch = require('../handlers/relay-demand-search');
  var dPurchase = require('../handlers/relay-demand-purchase');

  await db.set('relay:searches', []);
  var sRes = await invoke(dSearch, {
    method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 500 }
  });
  assert('the search returned the CJ item', sRes.status === 200 && sRes.body && sRes.body.resultCount > 0,
    JSON.stringify(sRes.body && sRes.body.message || sRes.body).slice(0, 160));
  var recorded = (await db.get('relay:searches') || [])[0] || {};
  var cjMap = (recorded.sourceMapping || []).find(function (m) { return m.source === 'cj'; }) || {};
  assert('the mapping keeps the freight quote', cjMap.sourceShipping === 4.87, String(cjMap.sourceShipping));
  assert('the mapping keeps the carrier', cjMap.sourceCarrier === 'CJPacket', String(cjMap.sourceCarrier));
  assert('the mapping keeps the warehouse country', cjMap.sourceFromCountry === 'US', String(cjMap.sourceFromCountry));

  var pRes = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: {
      searchId: recorded.searchId, itemId: cjMap.itemId, buyerId: 'b_t31',
      policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' }
    }
  });
  assert('the purchase created a listing', pRes.status === 200 && pRes.body && pRes.body.listingId,
    JSON.stringify(pRes.body).slice(0, 200));
  var t31Listing = pRes.body && pRes.body.listingId ? await store.getListing(pRes.body.listingId) : null;
  assert('the listing fulfilment reads keeps the freight quote',
    t31Listing && t31Listing.sourceShipping === 4.87, t31Listing && String(t31Listing.sourceShipping));
  assert('and the warehouse country, so it does not ship blind from CN',
    t31Listing && t31Listing.sourceFromCountry === 'US', t31Listing && String(t31Listing.sourceFromCountry));
  assert('and the carrier the quote was priced on',
    t31Listing && t31Listing.sourceCarrier === 'CJPacket', t31Listing && String(t31Listing.sourceCarrier));
  // The condition buyFromCJ actually branches on, stated as the test's own subject.
  assert('so buyFromCJ will requote to the buyer address instead of skipping it',
    t31Listing && t31Listing.sourceShipping != null);
  // The buyer is charged against the variant they chose, not the words they typed.
  assert('the listing is titled with the chosen variant, not the search text',
    t31Listing && t31Listing.title === 'CJ case', t31Listing && t31Listing.title);
  assert('and describes the condition of what actually ships',
    t31Listing && t31Listing.condition === 'new', t31Listing && t31Listing.condition);
  // Freight was priced to THIS address before the payment link existed, not after.
  assert('freight was requoted to the buyer address before charging',
    FREIGHT_CALLS.length === 1 && FREIGHT_CALLS[0].country === 'US' && FREIGHT_CALLS[0].zip === '64111',
    JSON.stringify(FREIGHT_CALLS));
  assert('and against the warehouse holding the stock',
    FREIGHT_CALLS[0] && FREIGHT_CALLS[0].fromCountry === 'US', JSON.stringify(FREIGHT_CALLS[0]));

  // A CHEAPER destination is priced in: the requote, not the search quote, is what the
  // order is costed and authorised on.
  FREIGHT_OVERRIDE = 3.87;
  var sResC = await invoke(dSearch, { method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 500 } });
  var recC = (await db.get('relay:searches') || []).slice(-1)[0];
  var mapC = (recC.sourceMapping || []).find(function (m) { return m.source === 'cj'; });
  var pResC = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: recC.searchId, itemId: mapC.itemId, buyerId: 'b_t31c', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  var listingC = pResC.body && pResC.body.listingId ? await store.getListing(pResC.body.listingId) : null;
  assert('the requote, not the search quote, is what the order is costed on',
    listingC && listingC.sourceCost === 6.57, listingC && String(listingC.sourceCost));

  // A DEARER destination is refused. The customer clicked a displayed price and
  // pages/relay.html:825-837 sends them straight to Stripe without showing a revised one,
  // so charging the higher figure would charge a price they never saw. Before gate 2 this
  // difference surfaced only inside buyFromCJ, AFTER the money was taken, where it refuses
  // past 10% (lib/relay-buy.js:199-207) and leaves a paid order needing a human.
  // $5.50 freight against $4.87 quoted is only 8% dearer, so it clears the drift rule that
  // mirrors buyFromCJ — and still prices the item ABOVE what the customer was shown. That
  // is the case the displayed-price gate exists for; the drift rule alone would let it
  // through.
  FREIGHT_OVERRIDE = 5.50;
  var sResS = await invoke(dSearch, { method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 500 } });
  var recS = (await db.get('relay:searches') || []).slice(-1)[0];
  var mapS = (recS.sourceMapping || []).find(function (m) { return m.source === 'cj'; });
  var ordersBeforeShown = Object.keys((await db.get('relay:store:orders')) || {}).length;
  var pResS = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: recS.searchId, itemId: mapS.itemId, buyerId: 'b_t31s', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  assert('a price above the one displayed is refused, not charged',
    pResS.status === 409, String(pResS.status));
  assert('and the refusal names both figures',
    pResS.body && pResS.body.currentPrice > pResS.body.shownPrice,
    JSON.stringify(pResS.body).slice(0, 200));
  assert('and no order exists for it',
    Object.keys((await db.get('relay:store:orders')) || {}).length === ordersBeforeShown);

  // Far dearer: refused earlier still, by the rule that mirrors what fulfilment would do.
  FREIGHT_OVERRIDE = 9.87;
  var sRes2 = await invoke(dSearch, { method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 500 } });
  var rec2 = (await db.get('relay:searches') || []).slice(-1)[0];
  var map2 = (rec2.sourceMapping || []).find(function (m) { return m.source === 'cj'; });
  var ordersBeforeDear = Object.keys((await db.get('relay:store:orders')) || {}).length;
  var pRes2 = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: rec2.searchId, itemId: map2.itemId, buyerId: 'b_t31b', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'Toronto', state: 'ON', postalCode: 'M5V', country: 'CA' } }
  });
  assert('a cost fulfilment would refuse is not sold in the first place',
    pRes2.status === 409 && pRes2.body && pRes2.body.code === 'cost-drift',
    JSON.stringify(pRes2.body).slice(0, 200));
  assert('and no order exists for that one either',
    Object.keys((await db.get('relay:store:orders')) || {}).length === ordersBeforeDear);

  // A variant that sold out since the search. A freight quote still succeeds for it, so
  // quoting and trusting that is exactly how someone pays for nothing.
  FREIGHT_OVERRIDE = undefined;
  STOCK_QTY = 0;
  var ordersBeforeStock = Object.keys((await db.get('relay:store:orders')) || {}).length;
  var pResOut = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: rec2.searchId, itemId: map2.itemId, buyerId: 'b_t31o', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  assert('a sold-out variant is refused before the charge',
    pResOut.status === 409 && pResOut.body && pResOut.body.code === 'out-of-stock',
    JSON.stringify(pResOut.body).slice(0, 200));
  assert('and nothing was charged for it',
    Object.keys((await db.get('relay:store:orders')) || {}).length === ordersBeforeStock);
  STOCK_QTY = 100;

  // The SAME gate on the other route that takes money. Engine-published CJ listings are
  // sold through relay-cart-checkout, which charged the stored default-destination price
  // to an arbitrary address with no requote and no stock check at all. Two checkout paths
  // with one revalidation is the reason lib/relay-supplier-quote exists.
  var cjListing = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'engine CJ case',
    price: 11.36, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v9', sourceUrl: 'https://www.cjdropshipping.com/product/-p-ENGINE.html',
    sourceCost: 7.57, sourceShipping: 4.87, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];
  var cart2 = require('../handlers/relay-cart-checkout');
  var cartAddr = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };

  STOCK_QTY = 0;
  var ordersBeforeCart = Object.keys((await db.get('relay:store:orders')) || {}).length;
  var cOut = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('the cart refuses a sold-out supplier line', cOut.status === 409, String(cOut.status));
  assert('and names it rather than failing vaguely',
    /sold out/i.test(JSON.stringify(cOut.body)), JSON.stringify(cOut.body).slice(0, 200));
  assert('and creates no order', Object.keys((await db.get('relay:store:orders')) || {}).length === ordersBeforeCart);

  STOCK_QTY = 100;
  FREIGHT_OVERRIDE = 9.87;
  var cDrift = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('the cart refuses a destination fulfilment would not ship to at that price',
    cDrift.status === 409 && /costs \$9\.87/.test(JSON.stringify(cDrift.body)),
    JSON.stringify(cDrift.body).slice(0, 220));
  FREIGHT_OVERRIDE = undefined;

  // Repeats collapse BEFORE the stock check. Two qty-1 entries of one listing each passed
  // the quantity and stock checks on their own and together asked the supplier for two of
  // something there may be one of, with the customer charged for both.
  STOCK_QTY = 1;
  var cDup = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }, { listingId: cjListing.id, qty: 1 }],
      shippingAddress: cartAddr, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('two entries of one listing are counted as two, not twice as one',
    cDup.status === 409 && /only 1 left/.test(JSON.stringify(cDup.body)),
    JSON.stringify(cDup.body).slice(0, 220));
  STOCK_QTY = 100;

  // What the supplier quoted for THIS address must reach fulfilment. The listing keeps
  // its discovery-time quote, because it is a shared catalogue entry; the ORDER LINE
  // carries the revalidated numbers, and relay-store must not drop them on the way in.
  FREIGHT_OVERRIDE = 4.20;
  var cGood = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('a revalidated line checks out', cGood.status === 200 && cGood.body && cGood.body.orderId,
    JSON.stringify(cGood.body).slice(0, 200));
  var cOrder = cGood.body && cGood.body.orderId ? await store.getOrder(cGood.body.orderId) : null;
  var cLine = cOrder && cOrder.lines && cOrder.lines[0];
  assert('the order line carries the freight quoted for this address',
    cLine && cLine.sourceShipping === 4.20, cLine && String(cLine.sourceShipping));
  assert('and the cost it was authorised against',
    cLine && cLine.sourceCost === 6.90, cLine && String(cLine.sourceCost));
  assert('and the warehouse the stock is actually in',
    cLine && cLine.sourceFromCountry === 'US', cLine && String(cLine.sourceFromCountry));
  assert('while the shared listing keeps its own default-destination quote',
    (await store.getListing(cjListing.id)).sourceShipping === 4.87);

  // Multi-unit: cj.freight() quotes the WHOLE quantity, listing.sourceCost is per unit,
  // and relay-engine multiplies the line cost by qty. Adding the whole quote to a
  // per-unit cost therefore counts the freight twice over, and compares a two-unit
  // freight against a one-unit cost in the drift gate — so an unchanged two-unit order
  // gets refused as drift, or authorised at an inflated cost.
  FREIGHT_OVERRIDE = 9.74;          // 4.87 a unit for two, i.e. no change at all
  var cTwo = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 2 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('an unchanged two-unit order is not refused as drift',
    cTwo.status === 200, JSON.stringify(cTwo.body).slice(0, 220));
  var twoLine = cTwo.body && cTwo.body.orderId
    ? ((await store.getOrder(cTwo.body.orderId)).lines || [])[0] : null;
  assert('and its line cost stays per unit, so fulfilment does not double the freight',
    twoLine && twoLine.sourceCost === 7.57, twoLine && String(twoLine.sourceCost));
  assert('with the per-unit freight recorded, not the whole-order quote',
    twoLine && twoLine.sourceShipping === 4.87, twoLine && String(twoLine.sourceShipping));
  FREIGHT_OVERRIDE = undefined;

  // A dry run reserves nothing, so without accumulation every line of a cart sees the
  // same untouched ledger: each fits the remaining ceiling, the cart as a whole does not,
  // the customer is charged for all of it, and the SECOND real authorisation during
  // fulfilment is what discovers it — on a paid order that can only be half filled.
  var second = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'second engine CJ case',
    price: 11.36, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v9', sourceUrl: 'https://www.cjdropshipping.com/product/-p-ENGINE2.html',
    sourceCost: 7.57, sourceShipping: 4.87, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  // $10 left today. Either line alone fits at $7.57; the two together are $15.14.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 10,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  var cOne = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('one line inside the remaining ceiling still sells', cOne.status === 200,
    JSON.stringify(cOne.body).slice(0, 200));
  var cBoth = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }, { listingId: second.id, qty: 1 }],
      shippingAddress: cartAddr, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('a cart whose TOTAL breaks the ceiling is refused',
    cBoth.status === 409 && /already in this cart/.test(JSON.stringify(cBoth.body)),
    JSON.stringify(cBoth.body).slice(0, 260));

  // The per-unit/aggregate seam, one layer down. buyFromCJ computes
  // maxCost - sourceShipping + requote.price: maxCost is the LINE total and cj.freight()
  // quotes the whole quantity, so handing it one unit of freight subtracts one and adds
  // all of them. On two units that alone clears the 10% drift threshold, after payment,
  // on an order that never changed.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  // Warehouse choice has to be quantity-aware. Preferring the destination's own warehouse
  // on ANY stock refused a two-unit order against {qty:1,from:'US'} while a CN warehouse
  // held ten. This exercises the real cj.stock() against a stubbed CJ response, because
  // the defect is in how the warehouses are compared, not in how they are fetched.
  var cjRealMod = require.cache[cjPath2].exports;
  delete require.cache[cjPath2];
  // relay-cj reads CJ_API_KEY at module load and the suite deletes it at the top, so a
  // fresh require without one is unconfigured and every call short-circuits.
  process.env.CJ_API_KEY = 'test-key-not-real';
  var cjLive = require('../lib/relay-cj');
  var realFetchStock = global.fetch;
  global.fetch = async function (u) {
    var url = String(u);
    if (url.indexOf('getAccessToken') !== -1) {
      return { ok: true, status: 200, json: async function () {
        return { result: true, data: { accessToken: 'tok', refreshToken: 'r' } }; } };
    }
    if (url.indexOf('stock/queryByVid') !== -1) {
      return { ok: true, status: 200, json: async function () {
        return { result: true, data: [
          { countryCode: 'US', totalInventoryNum: 1 },
          { countryCode: 'CN', totalInventoryNum: 10 }
        ] }; } };
    }
    return BLOCK_NETWORK(u);
  };
  var oneUnit = await cjLive.stock('v_wh', 'US', 1);
  assert('one unit ships from the destination warehouse that holds it',
    oneUnit.qty === 1 && oneUnit.from === 'US', JSON.stringify(oneUnit));
  var twoUnits = await cjLive.stock('v_wh', 'US', 2);
  assert('two units fall back to the warehouse that can actually fill them',
    twoUnits.qty === 10 && twoUnits.from === 'CN', JSON.stringify(twoUnits));
  var twentyUnits = await cjLive.stock('v_wh', 'US', 20);
  assert('and a quantity nothing can fill refuses with the largest real number',
    twentyUnits.qty === 10, JSON.stringify(twentyUnits));
  global.fetch = realFetchStock;
  delete process.env.CJ_API_KEY;
  delete require.cache[cjPath2];
  require.cache[cjPath2] = { id: cjPath2, filename: cjPath2, loaded: true, exports: cjRealMod };

  var buyPath = require.resolve('../lib/relay-buy');
  var realBuy = require('../lib/relay-buy');
  var EXEC_JOBS = [];
  require.cache[buyPath].exports = Object.assign({}, realBuy, {
    execute: async function (job) {
      EXEC_JOBS.push(job);
      return { ok: true, provider: 'cj', sourceOrderId: 'cjo_test', amount: job.maxCost };
    }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  var engine2 = require('../lib/relay-engine');
  var twoOrder = await store.createOrder({
    buyerId: 'b_agg', buyerEmail: 'a@b.com', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: cjListing.id, qty: 2, unitPrice: 11.36, title: 'engine CJ case',
      sourceCost: 7.57, sourceShipping: 4.87, sourceCarrier: 'CJPacket', sourceFromCountry: 'US' }]
  });
  await store.updateOrder(twoOrder.id, { status: 'paid' });
  await engine2.fulfillPaidOrder({ orderId: twoOrder.id });
  var job = EXEC_JOBS[0];
  assert('fulfilment is handed the line total to spend against',
    job && job.maxCost === 15.14, job && String(job.maxCost));
  assert('and freight for the whole quantity, matching it',
    job && job.sourceShipping === 9.74, job && String(job.sourceShipping));
  require.cache[buyPath].exports = realBuy;
  delete require.cache[require.resolve('../lib/relay-engine')];
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });

  // A supplier that will not quote is a refusal, not a guess. Nothing may be charged.
  FREIGHT_OVERRIDE = null;
  var ordersBefore = ((await db.get('relay:store:orders')) || {});
  var beforeCount = Object.keys(ordersBefore).length;
  var pRes3 = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: rec2.searchId, itemId: map2.itemId, buyerId: 'b_t31c', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  assert('no shipping quote means no sale', pRes3.status === 409, String(pRes3.status));
  assert('and says plainly that nothing was charged',
    /nothing was charged/i.test(JSON.stringify(pRes3.body)), JSON.stringify(pRes3.body).slice(0, 160));
  assert('and no order was written',
    Object.keys((await db.get('relay:store:orders')) || {}).length === beforeCount);
  FREIGHT_OVERRIDE = undefined;

  // The supplier going away between the search and the confirmation must close the sale,
  // not wave it through. Skipping the freight gate because CJ is unreachable charges the
  // customer, and fulfilment then reaches buyFromCJ, finds the same missing key, and files
  // a manual task against money already taken.
  var cfgReal = require.cache[cjPath2].exports.configured;
  require.cache[cjPath2].exports.configured = function () { return false; };
  var beforeUnconf = Object.keys((await db.get('relay:store:orders')) || {}).length;
  var pRes4 = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: rec2.searchId, itemId: map2.itemId, buyerId: 'b_t31d', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  assert('an unconfigured supplier closes the sale rather than bypassing the gate',
    pRes4.status === 409, String(pRes4.status));
  assert('and still charges nothing',
    Object.keys((await db.get('relay:store:orders')) || {}).length === beforeUnconf);
  require.cache[cjPath2].exports.configured = cfgReal;

  // The loop's own limits, asked BEFORE the charge. relay-engine.fulfillLine authorises
  // every purchase against these; a $3.79 spread clears the positive-spread test and then
  // fails the default $8 floor, so without this the customer pays and the order is marked
  // blocked. Same rules, same code, one release earlier in the sequence.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 8, minMarginPct: 0.18, requireFunds: false
  });
  var beforeThin = Object.keys((await db.get('relay:store:orders')) || {}).length;
  var pResThin = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: rec2.searchId, itemId: map2.itemId, buyerId: 'b_t31t', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  assert('a spread fulfilment would refuse is not sold',
    pResThin.status === 409 && /floor/.test(JSON.stringify(pResThin.body)),
    JSON.stringify(pResThin.body).slice(0, 200));
  assert('and nothing was charged for that either',
    Object.keys((await db.get('relay:store:orders')) || {}).length === beforeThin);
  // A dry run must not consume the day's ceiling: it reserves nothing.
  assert('the pre-check reserves no spend',
    ((await db.get('relay:autonomy-ledger')) || []).length === 0,
    JSON.stringify((await db.get('relay:autonomy-ledger')) || []).slice(0, 160));
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });

  require.cache[financePath].exports = realFinance;
  require.cache[cjPath2].exports = realCj2;
  global.fetch = realFetchRank;
  if (savedEbayId === undefined) delete process.env.EBAY_CLIENT_ID; else process.env.EBAY_CLIENT_ID = savedEbayId;
  if (savedEbaySecret === undefined) delete process.env.EBAY_CLIENT_SECRET; else process.env.EBAY_CLIENT_SECRET = savedEbaySecret;
  delete require.cache[ssPath];
  delete require.cache[require.resolve('../handlers/relay-demand-search')];
  delete require.cache[require.resolve('../handlers/relay-demand-purchase')];
  require('../lib/relay-source-search');

  // ── T32 ─────────────────────────────────────────────────────────────────
  // Reverse-image searches the open web, and CJ products are ON the open web, so both can
  // return the same cjdropshipping URL. Deduplicating in concat order kept whichever
  // arrived first — the reverse-image record, whose itemId is a synthetic 'img_...' hash
  // rather than the CJ variant id. lib/relay-buy.js:51 routes any cjdropshipping URL to
  // CJ regardless, so a PAID order handed that synthetic id to cj.freight()/placeOrder()
  // and could never be fulfilled. The fix is to rank before deduplicating.
  console.log('T32: the record kept for a shared URL is the one Relay can order');
  var CJ_URL = 'https://www.cjdropshipping.com/product/-p-DUPE.html';
  var riPath = require.resolve('../lib/relay-reverse-image');
  var realRi = require('../lib/relay-reverse-image');
  require.cache[riPath].exports = {
    findForSale: async function () {
      return { ok: true, matches: [{
        // Cheaper, so it wins on price and would be kept by any order-based dedup.
        url: CJ_URL, title: 'same product, open web', price: 1.00, shipping: 0,
        thumbnail: null, sourceName: 'cjdropshipping', provider: 'serpapi_shopping'
      }] };
    },
    hostOf: function (u) { return String(u).replace(/^https?:\/\//, '').split('/')[0]; },
    availableProviders: function () { return ['serpapi_shopping']; },
    isSourceable: function () { return true; },
    buyMode: function () { return 'manual'; }
  };
  require.cache[cjPath2].exports = {
    configured: function () { return true; },
    search: async function () {
      return { ok: true, reason: null, items: [{
        itemId: 'v_real', source: 'cj', title: 'CJ case — Blue', variantKey: 'Blue',
        price: 7.57, shipping: 4.87, shippingKnown: true, carrier: 'CJPacket',
        fromCountry: 'US', condition: 'new', url: CJ_URL, image: null,
        seller: 'CJ Dropshipping', vid: 'v_real', stock: 100, buyable: true, provider: 'cj'
      }] };
    }
  };
  delete require.cache[ssPath];
  var ss4 = require('../lib/relay-source-search');
  var deduped = await ss4.searchAllSources({ description: 'phone case', maxPrice: 500 });
  assert('the shared URL collapses to one item', deduped.items.length === 1, String(deduped.items.length));
  assert('and it is the CJ record, not the cheaper open-web one',
    deduped.items[0] && deduped.items[0].source === 'cj',
    deduped.items[0] && deduped.items[0].source + ' @ $' + deduped.items[0].price);
  // This is the field that decides whether a paid order can be fulfilled at all.
  assert('so the order carries the CJ variant id, not a synthetic img_ hash',
    deduped.items[0] && deduped.items[0].itemId === 'v_real',
    deduped.items[0] && deduped.items[0].itemId);

  // CJ manufactures: every item is new. A used-tier request cannot be filled from it, and
  // since CJ now ranks first it would otherwise fill the page with new goods that
  // relay-demand-purchase then labelled with the condition the customer ASKED for.
  var usedReq = await ss4.searchAllSources({ description: 'phone case', maxPrice: 500, condition: 'good' });
  assert('a used-tier request returns no CJ stock',
    !(usedReq.items || []).some(function (i) { return i.source === 'cj'; }),
    JSON.stringify((usedReq.items || []).map(function (i) { return i.source; })));
  assert('and does not claim cj as a source it filled from',
    (usedReq.sources || []).indexOf('cj') === -1, JSON.stringify(usedReq.sources));
  var newReq = await ss4.searchAllSources({ description: 'phone case', maxPrice: 500, condition: 'new' });
  assert('a new request still gets it', (newReq.sources || []).indexOf('cj') !== -1,
    JSON.stringify(newReq.sources));

  // The harder half of the same defect: an open-web cjdropshipping URL that CJ's OWN
  // search did not return has no verified record to lose the dedup to. Ranking cannot
  // save it, and lib/relay-buy.js:51 still routes it to buyFromCJ by its domain, so it
  // would be sold and paid for before anyone found out it could not be ordered.
  require.cache[riPath].exports = Object.assign({}, require.cache[riPath].exports, {
    findForSale: async function () {
      return { ok: true, matches: [{
        url: 'https://www.cjdropshipping.com/product/-p-NOTINOURSEARCH.html',
        title: 'a CJ product CJ did not return to us', price: 2.00, shipping: 0,
        thumbnail: null, sourceName: 'cjdropshipping', provider: 'serpapi_shopping'
      }] };
    }
  });
  require.cache[cjPath2].exports = {
    configured: function () { return true; },
    search: async function () { return { ok: true, reason: null, items: [] }; }
  };
  delete require.cache[ssPath];
  var ss5 = require('../lib/relay-source-search');
  var unverified = await ss5.searchAllSources({ description: 'phone case', maxPrice: 500 });
  assert('an unverified open-web supplier URL is refused, not sold',
    (unverified.items || []).length === 0, JSON.stringify((unverified.items || []).map(function (i) { return i.itemId; })));
  assert('and nothing carrying a synthetic id reaches a supplier route',
    !(unverified.items || []).some(function (i) { return /^img_/.test(i.itemId); }));

  // Matched on the hostname. An honest merchant whose product slug happens to contain the
  // supplier's name is a sourceable lead, and a whole-URL substring test threw it away.
  assert('a supplier name in the path is not a supplier domain',
    ss5.isDirectSupplierUrl('https://legitshop.com/products/cjdropshipping-style-case') === false);
  assert('a tracking parameter is not one either',
    ss5.isDirectSupplierUrl('https://legitshop.com/p/1?ref=cjdropshipping.com') === false);
  assert('the supplier domain itself still is',
    ss5.isDirectSupplierUrl('https://www.cjdropshipping.com/product/-p-X.html') === true);
  assert('and so is a subdomain of it',
    ss5.isDirectSupplierUrl('https://cdn.cjdropshipping.com/p/1') === true);
  // Unparseable cuts the permissive way only if you let it. It cannot be ordered either
  // way, so it is refused.
  assert('an unparseable URL is refused, not admitted',
    ss5.isDirectSupplierUrl('not a url') === true);

  require.cache[riPath].exports = realRi;
  require.cache[cjPath2].exports = realCj2;
  delete require.cache[ssPath];
  require('../lib/relay-source-search');

  // ── T33 ─────────────────────────────────────────────────────────────────
  // "Max Price" is the price the CUSTOMER pays. The search filtered on acquisition cost,
  // so a $100 maximum admitted a $90 item and pages/relay.html then displayed it at
  // $121.50 under the default 35% margin — over the budget they had just typed in.
  console.log('T33: the buyer maximum is the price the buyer pays');
  await db.set('relay_margin', 0.35);
  require.cache[cjPath2].exports = {
    configured: function () { return true; },
    freight: async function () { return { price: 0, carrier: 'CJPacket' }; },
    search: async function (o) {
      // Answers against whatever ceiling it is given, the way CJ does. One item sits
      // under a $100 cost ceiling but over it once the margin is added; the other clears
      // both, so the test distinguishes "filtered correctly" from "found nothing".
      var ceiling = o && o.maxPrice != null ? parseFloat(o.maxPrice) : Infinity;
      return { ok: true, reason: null, items: [
        { cost: 90.00, id: 'v_costly', name: 'costly case' },
        { cost: 50.00, id: 'v_ok', name: 'affordable case' },
        // Sits exactly on the rounding edge for a $7 maximum at 35%.
        { cost: 5.19, id: 'v_edge', name: 'edge case' }
      ].filter(function (x) { return x.cost <= ceiling; }).map(function (x) {
        return {
          itemId: x.id, source: 'cj', title: x.name, price: x.cost, shipping: 0,
          shippingKnown: true, carrier: 'CJPacket', fromCountry: 'US', condition: 'new',
          url: 'https://www.cjdropshipping.com/product/-p-' + x.id + '.html', image: null,
          seller: 'CJ Dropshipping', vid: x.id, stock: 10, buyable: true, provider: 'cj'
        };
      }) };
    }
  };
  delete require.cache[ssPath];
  delete require.cache[require.resolve('../lib/relay-margin-calculator')];
  delete require.cache[require.resolve('../handlers/relay-demand-search')];
  var dSearch2 = require('../handlers/relay-demand-search');
  var budget = await invoke(dSearch2, {
    method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 100 }
  });
  var shown = (budget.body && budget.body.results) || [];
  var over = shown.filter(function (r) { return r.price > 100; });
  assert('affordable items are still offered', shown.length > 0, JSON.stringify(shown.map(function (r) { return r.price; })));
  assert('no result is priced above the maximum the customer set',
    over.length === 0, JSON.stringify(over.map(function (r) { return r.price; })));
  // And the refusal quotes their figure, not the internal cost ceiling of $74.07.
  assert('a refusal quotes the budget they typed',
    !budget.body || !budget.body.reason || /\$100/.test(String(budget.body.reason)) || budget.body.resultCount > 0,
    String(budget.body && budget.body.reason));

  // The rounding edge, one cent wide. At 35% a $7 maximum divides to $5.185: rounded to
  // the nearest cent that is a $5.19 ceiling, and $5.19 sells for $7.01 — a cent over the
  // number the customer typed, offered and then refused at purchase with nothing having
  // changed. Floored, $5.18 excludes it.
  var edge = await invoke(dSearch2, {
    method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 7 }
  });
  var edgeOver = ((edge.body && edge.body.results) || []).filter(function (r) { return r.price > 7; });
  assert('a cent over the maximum is still over the maximum',
    edgeOver.length === 0, JSON.stringify(edgeOver.map(function (r) { return r.price; })));

  // One snapshot, used for both the ceiling and the display. An operator moving the
  // slider while a provider search is in flight otherwise prices the results on a margin
  // they were never filtered against, which puts a result over the customer's maximum by
  // exactly the mechanism the ceiling exists to prevent.
  var mcPath = require.resolve('../lib/relay-margin-calculator');
  var realMc = require('../lib/relay-margin-calculator');
  var marginReads = 0;
  var appliedWith = [];
  require.cache[mcPath].exports = Object.assign({}, realMc, {
    getMargin: async function () { marginReads++; return marginReads === 1 ? 0.35 : 0.99; },
    applyMarginToSearchResults: async function (list, m) {
      appliedWith.push(m);
      return realMc.applyMarginToSearchResults(list, m);
    }
  });
  delete require.cache[require.resolve('../handlers/relay-demand-search')];
  var dSearch3 = require('../handlers/relay-demand-search');
  var moved = await invoke(dSearch3, {
    method: 'POST', headers: {}, body: { description: 'phone case', maxPrice: 100 } });
  var movedPrices = ((moved.body && moved.body.results) || []).map(function (r) { return r.price; });
  assert('a margin change mid-search cannot reprice what was already filtered',
    movedPrices.every(function (p) { return p <= 100; }), JSON.stringify(movedPrices));
  assert('and the results are priced on the snapshot that set the ceiling',
    movedPrices.indexOf(67.5) !== -1, JSON.stringify(movedPrices));
  // The wiring itself: display is handed the snapshot, not left to read the margin again.
  assert('the display margin is the one the ceiling was computed from',
    appliedWith.length === 1 && appliedWith[0] === 0.35, JSON.stringify(appliedWith));
  require.cache[mcPath].exports = realMc;
  delete require.cache[require.resolve('../handlers/relay-demand-search')];

  require.cache[cjPath2].exports = realCj2;
  delete require.cache[ssPath];
  delete require.cache[require.resolve('../handlers/relay-demand-search')];
  require('../lib/relay-source-search');

  // ── T34 ─────────────────────────────────────────────────────────────────
  // THE PAID-ORDER GAP. Both checkout routes wrote 'awaiting-payment' and nothing on
  // earth then wrote 'paid' to relay:store:orders — relay-stripe-webhook writes the
  // trade-shared marketplace store, relay-demand-webhook reads a legacy array, and the
  // engine only sweeps 'paid'. A customer could be charged and the supplier never asked
  // to ship. This drives the REAL handlers with a stubbed Stripe response, from checkout
  // through to the job handed to buy.execute.
  console.log('T34: a paid order becomes paid, and gets fulfilled');
  var savedStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key';

  var STRIPE_SESSIONS = [];          // what Stripe will say when asked
  var STRIPE_CALLS = [];
  var STRIPE_FAIL = null;            // set to an HTTP status to make the read fail
  var realFetchPay = global.fetch;
  global.fetch = async function (u, o) {
    var url = String(u);
    if (url.indexOf('api.stripe.com/v1/checkout/sessions') !== -1) {
      STRIPE_CALLS.push(url);
      if (STRIPE_FAIL) {
        return { ok: false, status: STRIPE_FAIL,
          json: async function () { return { error: { message: 'stubbed failure' } }; } };
      }
      return { ok: true, status: 200, json: async function () { return { data: STRIPE_SESSIONS }; } };
    }
    return BLOCK_NETWORK(u);
  };

  var fbPath = require.resolve('../lib/relay-finance-bridge');
  var realFb = require('../lib/relay-finance-bridge');
  var LEDGER_WRITES = [];
  require.cache[fbPath].exports = Object.assign({}, realFb, {
    paymentsEnabled: function () { return true; },
    createPayment: async function (o) {
      return { ok: true, url: 'https://pay.test/x', paymentLinkId: 'plink_' + o.orderId };
    },
    reportIncome: async function (e) { LEDGER_WRITES.push(e); return { ok: true, recorded: true }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];
  var engine3 = require('../lib/relay-engine');
  var cart3 = require('../handlers/relay-cart-checkout');

  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  var payListing = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'paid-path case',
    price: 11.36, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v9', sourceUrl: 'https://www.cjdropshipping.com/product/-p-PAID.html',
    sourceCost: 7.57, sourceShipping: 4.87, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  var buyRes = await invoke(cart3, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: payListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  assert('checkout produced an order', buyRes.status === 200 && buyRes.body && buyRes.body.orderId,
    JSON.stringify(buyRes.body).slice(0, 200));
  var payOrderId = buyRes.body.orderId;
  assert('and it starts unpaid, awaiting the customer',
    (await store.getOrder(payOrderId)).status === 'awaiting-payment',
    (await store.getOrder(payOrderId)).status);

  // ── the negative first: an unpaid link must NEVER settle an order ──
  STRIPE_SESSIONS = [{ id: 'cs_1', status: 'open', payment_status: 'unpaid' }];
  var rec1 = await engine3.reconcilePayments({ limit: 25 });
  assert('an unpaid link leaves the order alone',
    (await store.getOrder(payOrderId)).status === 'awaiting-payment',
    (await store.getOrder(payOrderId)).status);
  assert('and reports it as asked-and-unpaid, not as unknown',
    (rec1.checked || []).some(function (c) { return c.orderId === payOrderId && c.paid === false && c.asked === true; }),
    JSON.stringify(rec1.checked).slice(0, 200));

  // A completed FLOW that was not actually paid is also not a payment.
  STRIPE_SESSIONS = [{ id: 'cs_2', status: 'complete', payment_status: 'unpaid' }];
  await engine3.reconcilePayments({ limit: 25 });
  assert('a complete-but-unpaid session is not a payment either',
    (await store.getOrder(payOrderId)).status === 'awaiting-payment');

  // Nor is a failure to reach Stripe. This is the one that would buy stock against money
  // nobody sent, so an error must never read as paid.
  STRIPE_FAIL = 503;
  var recErr = await engine3.reconcilePayments({ limit: 25 });
  assert('an unreachable payment rail is not a payment',
    (await store.getOrder(payOrderId)).status === 'awaiting-payment');
  assert('and is reported as could-not-ask rather than unpaid',
    (recErr.checked || []).some(function (c) { return c.orderId === payOrderId && c.asked === false && /refused|reach/.test(String(c.reason)); }),
    JSON.stringify(recErr.checked).slice(0, 220));
  STRIPE_FAIL = null;

  // ── now the real payment ──
  STRIPE_SESSIONS = [{ id: 'cs_paid', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_abc', amount_total: 1735, currency: 'usd' }];
  var rec2 = await engine3.reconcilePayments({ limit: 25 });
  var paidOrder = await store.getOrder(payOrderId);
  assert('a paid link marks the order paid', paidOrder.status === 'paid', paidOrder.status);
  assert('and records which Stripe session settled it',
    paidOrder.stripeSessionId === 'cs_paid' && paidOrder.stripePaymentId === 'pi_abc',
    JSON.stringify({ s: paidOrder.stripeSessionId, p: paidOrder.stripePaymentId }));
  // Scoped to THIS order: earlier blocks left their own orders awaiting payment, and the
  // reconcile correctly settles those too against the same stubbed Stripe answer.
  var mine = function () { return LEDGER_WRITES.filter(function (w) { return w.orderId === payOrderId; }); };
  assert('income reached finance once, for what was actually collected',
    mine().length === 1 && mine()[0].amount === 17.35,
    JSON.stringify(mine()).slice(0, 200));
  assert('with the source cost carried so the margin is real, not assumed',
    mine()[0].sourceCostTotal === 7.57 && mine()[0].margin === 9.78,
    JSON.stringify(mine()[0]).slice(0, 200));

  // Idempotence. The cron and a manual reconcile both run; neither may double-report.
  var writesBefore = LEDGER_WRITES.length;
  var rec3 = await engine3.reconcilePayments({ limit: 25 });
  assert('reconciling again reports no income at all',
    LEDGER_WRITES.length === writesBefore,
    'before ' + writesBefore + ', after ' + LEDGER_WRITES.length);
  assert('and this order in particular is still reported exactly once',
    mine().length === 1, 'writes for this order: ' + mine().length);
  assert('and does not re-list it as newly paid',
    !(rec3.checked || []).some(function (c) { return c.orderId === payOrderId; }),
    JSON.stringify(rec3.checked).slice(0, 160));

  // The status is written BEFORE the ledger call on purpose: a customer's payment is a
  // fact that must survive our bookkeeping failing. That leaves a window — crash between
  // the two and the income is never reported, and the awaiting-payment loop will never
  // look at that order again. incomeReportedAt is what lets a later cycle find it.
  var stranded = await store.createOrder({
    buyerId: 'b_orphan', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(stranded.id, { status: 'paid' });   // paid, income never reported
  await engine3.reconcilePayments({ limit: 25 });
  var orphanWrites = LEDGER_WRITES.filter(function (w) { return w.orderId === stranded.id; });
  assert('income stranded by a crash after payment is picked up later',
    orphanWrites.length === 1, 'writes: ' + orphanWrites.length);
  assert('and is then marked, so the next cycle leaves it alone',
    !!(await store.getOrder(stranded.id)).incomeReportedAt);
  await engine3.reconcilePayments({ limit: 25 });
  assert('which it does', LEDGER_WRITES.filter(function (w) { return w.orderId === stranded.id; }).length === 1,
    'writes after second pass: ' + LEDGER_WRITES.filter(function (w) { return w.orderId === stranded.id; }).length);

  // ── the acceptance criterion: the engine's paid sweep can now see it ──
  var sweepSeen = (await store.ordersByStatus('paid', 50)).some(function (o) { return o.id === payOrderId; });
  assert('the paid sweep can now see the order', sweepSeen);
  require.cache[buyPath].exports = Object.assign({}, realBuy, {
    execute: async function (job) { EXEC_JOBS.push(job); return { ok: true, provider: 'cj', sourceOrderId: 'cjo_paid', amount: job.maxCost }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  var engine4 = require('../lib/relay-engine');
  EXEC_JOBS.length = 0;
  await engine4.fulfillPaidOrder({ orderId: payOrderId });
  assert('and fulfilment actually buys it from the supplier',
    EXEC_JOBS.length === 1 && EXEC_JOBS[0].orderId === payOrderId,
    JSON.stringify(EXEC_JOBS.map(function (j) { return j.orderId; })));
  assert('against the cost the order was authorised on',
    EXEC_JOBS[0] && EXEC_JOBS[0].maxCost === 7.57, EXEC_JOBS[0] && String(EXEC_JOBS[0].maxCost));

  // A ledger that is down must not un-pay a customer who paid.
  require.cache[fbPath].exports = Object.assign({}, require.cache[fbPath].exports, {
    reportIncome: async function () { return { ok: true, recorded: false, queued: true, error: 'ledger down' }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  var engine5 = require('../lib/relay-engine');
  var order2 = await store.createOrder({
    buyerId: 'b_led', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(order2.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + order2.id });
  await engine5.reconcilePayments({ limit: 25 });
  assert('a ledger outage still leaves the order paid',
    (await store.getOrder(order2.id)).status === 'paid',
    (await store.getOrder(order2.id)).status);

  require.cache[fbPath].exports = realFb;
  require.cache[buyPath].exports = realBuy;
  global.fetch = realFetchPay;
  if (savedStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedStripeKey;
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];

  // ── hermetic check ──────────────────────────────────────────────────────
  // Every stub is scoped to its own block and restores to the blocker. If anything
  // reached the network, a credential-holding machine ran a different test than CI did.
  console.log('HERMETIC: no request left the machine');
  assert('nothing escaped to the network', LEAKED_REQUESTS.length === 0,
    LEAKED_REQUESTS.slice(0, 5).join(', '));

  console.log('');
  console.log(failures === 0
    ? 'ALL PASS (' + tests + ' assertions)'
    : failures + ' FAILED of ' + tests + ' assertions');
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('HARNESS ERROR:', e && e.stack || e);
  process.exit(1);
});
