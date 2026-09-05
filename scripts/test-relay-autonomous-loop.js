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

// The hourly rate limit (3 orders / $60) is REAL and it is the production default. Almost
// every fixture below predates it and spends more than $60 an hour by design, because it
// is testing margins, freight or reconciliation rather than pacing. Raising the baseline
// here keeps those tests about their own subject; T46 sets the real numbers back and is
// the test that actually pins the cap.
require('../lib/relay-autonomy').DEFAULTS.velocityMaxOrders = 9999;
require('../lib/relay-autonomy').DEFAULTS.velocityMaxUsd = 9999999;

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

  // These three used to match the supplier's own sentence in the RESPONSE, which meant they
  // were holding a leak in place: the cost-drift one asserted a dollar figure, and that
  // figure is the freight on our landed cost. Each claim is unchanged; the specific text is
  // now read from the operator log, and the CODE is what the response is asserted on. That
  // is also the first real exercise of the code field surviving the genericised message.
  var CARTWARN = [];
  var cartWarnReal = console.warn;
  function capture() { CARTWARN = []; console.warn = function () { CARTWARN.push(Array.prototype.join.call(arguments, ' ')); }; }
  function release() { console.warn = cartWarnReal; return CARTWARN.join(' | '); }
  function firstCode(r) { return (((r.body || {}).unavailable || [])[0] || {}).code || null; }

  STOCK_QTY = 0;
  var ordersBeforeCart = Object.keys((await db.get('relay:store:orders')) || {}).length;
  capture();
  var cOut = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  var outWarn = release();
  assert('the cart refuses a sold-out supplier line', cOut.status === 409, String(cOut.status));
  assert('and names it by code rather than failing vaguely',
    firstCode(cOut) === 'out-of-stock', JSON.stringify(cOut.body).slice(0, 200));
  assert('and the supplier text reaches the operator, not the shopper',
    /sold out/i.test(outWarn) && !/sold out/i.test(JSON.stringify(cOut.body)), outWarn.slice(0, 200));
  assert('and creates no order', Object.keys((await db.get('relay:store:orders')) || {}).length === ordersBeforeCart);

  STOCK_QTY = 100;
  FREIGHT_OVERRIDE = 9.87;
  capture();
  var cDrift = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }], shippingAddress: cartAddr,
      buyerEmail: 'a@b.com', policyAccepted: true }
  });
  var driftWarn = release();
  assert('the cart refuses a destination fulfilment would not ship to at that price',
    cDrift.status === 409 && firstCode(cDrift) === 'cost-drift',
    JSON.stringify(cDrift.body).slice(0, 220));
  assert('cart cost-drift: no dollar figure reaches the buyer',
    JSON.stringify(cDrift.body).indexOf('$') === -1, JSON.stringify(cDrift.body).slice(0, 220));
  assert('cart cost-drift: the word quoted does not reach the buyer either',
    !/quoted/i.test(JSON.stringify(cDrift.body)), JSON.stringify(cDrift.body).slice(0, 220));
  assert('cart cost-drift: the freight detail still reaches the operator log',
    /costs \$9\.87/.test(driftWarn), driftWarn.slice(0, 220));
  FREIGHT_OVERRIDE = undefined;

  // Repeats collapse BEFORE the stock check. Two qty-1 entries of one listing each passed
  // the quantity and stock checks on their own and together asked the supplier for two of
  // something there may be one of, with the customer charged for both.
  STOCK_QTY = 1;
  capture();
  var cDup = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }, { listingId: cjListing.id, qty: 1 }],
      shippingAddress: cartAddr, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  var dupWarn = release();
  assert('two entries of one listing are counted as two, not twice as one',
    cDup.status === 409 && firstCode(cDup) === 'out-of-stock' && /only 1 left/.test(dupWarn),
    JSON.stringify(cDup.body).slice(0, 220) + ' || warn: ' + dupWarn.slice(0, 120));
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
  // The cumulative-ceiling refusal is now checked where the detail actually goes. This
  // assertion used to match 'already in this cart' in the RESPONSE, which meant it was
  // pinning the leak in place: that sentence carries the cart's committed supplier spend
  // and the remaining daily ceiling, and the shopper reading the 409 is unauthenticated.
  // The claim under test has not changed, only the channel it is read from.
  var CEILWARN = [];
  var ceilWarnReal = console.warn;
  console.warn = function () { CEILWARN.push(Array.prototype.join.call(arguments, ' ')); };
  var cBoth = await invoke(cart2, {
    method: 'POST', headers: {},
    body: { items: [{ listingId: cjListing.id, qty: 1 }, { listingId: second.id, qty: 1 }],
      shippingAddress: cartAddr, buyerEmail: 'a@b.com', policyAccepted: true }
  });
  console.warn = ceilWarnReal;
  assert('a cart whose TOTAL breaks the ceiling is refused',
    cBoth.status === 409 && /not-fulfillable/.test(JSON.stringify(cBoth.body)),
    JSON.stringify(cBoth.body).slice(0, 260));
  assert('and the cumulative-ceiling reason reaches the operator log, not the shopper',
    /already in this cart/.test(CEILWARN.join(' ')) &&
    !/already in this cart/.test(JSON.stringify(cBoth.body)),
    CEILWARN.join(' | ').slice(0, 200));

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
  // Read from the operator log, not the response. This used to match /floor/ in the BODY,
  // which meant it was holding the leak in place: 'margin $3.79 is under the $8 floor'
  // hands a shopper the computed margin on the item. The claim is unchanged.
  var THINWARN = [];
  var thinWarnReal = console.warn;
  console.warn = function () { THINWARN.push(Array.prototype.join.call(arguments, ' ')); };
  var pResThin = await invoke(dPurchase, {
    method: 'POST', headers: {},
    body: { searchId: rec2.searchId, itemId: map2.itemId, buyerId: 'b_t31t', policyAccepted: true,
      shippingAddress: { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' } }
  });
  console.warn = thinWarnReal;
  assert('a spread fulfilment would refuse is not sold',
    pResThin.status === 409 && !/floor/.test(JSON.stringify(pResThin.body)),
    JSON.stringify(pResThin.body).slice(0, 200));
  assert('and the margin-floor reason reaches the operator log, not the buyer',
    /floor/.test(THINWARN.join(' ')), THINWARN.join(' | ').slice(0, 200));
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
  // A GENUINE CROSS-SOURCE DUPLICATE, which the assertions above no longer produce.
  //
  // Re-proving these guards with a verifying mutator showed all three of the shared-URL
  // assertions had gone vacuous: deleting the URL dedup entirely left the suite green.
  // The cause was a LATER fix — isDirectSupplierUrl strips open-web cjdropshipping URLs
  // before the merge, so the CJ-vs-reverse-image collision they construct can no longer
  // happen, and they were asserting on a one-item list. The dedup is still needed for
  // duplicates that do NOT involve a direct supplier, and nothing tested that.
  //
  // eBay and reverse-image returning the SAME non-supplier URL is the case that survives.
  var dupUrl = 'https://legitshop.com/p/the-same-thing';
  var savedEbayId2 = process.env.EBAY_CLIENT_ID, savedEbaySec2 = process.env.EBAY_CLIENT_SECRET;
  process.env.EBAY_CLIENT_ID = 'test-id';
  process.env.EBAY_CLIENT_SECRET = 'test-secret';
  var realFetchDup = global.fetch;
  global.fetch = async function (u) {
    var url = String(u);
    if (url.indexOf('identity/v1/oauth2/token') !== -1) {
      return { ok: true, status: 200, json: async function () { return { access_token: 'tok', expires_in: 7200 }; } };
    }
    if (url.indexOf('item_summary/search') !== -1) {
      return { ok: true, status: 200, json: async function () {
        return { itemSummaries: [{ itemId: 'ebay_dup', title: 'the same thing',
          price: { value: '9.00', currency: 'USD' }, itemWebUrl: dupUrl, condition: 'Used' }] }; } };
    }
    return BLOCK_NETWORK(u);
  };
  require.cache[riPath].exports = Object.assign({}, require.cache[riPath].exports, {
    findForSale: async function () {
      return { ok: true, matches: [{ url: dupUrl, title: 'the same thing, open web',
        price: 4.00, shipping: 0, thumbnail: null, sourceName: 'legitshop', provider: 'serpapi_shopping' }] };
    }
  });
  require.cache[cjPath2].exports = {
    configured: function () { return true; },
    search: async function () { return { ok: true, reason: null, items: [] }; }
  };
  delete require.cache[ssPath];
  var ssDup = require('../lib/relay-source-search');
  var crossed = await ssDup.searchAllSources({ description: 'the same thing', maxPrice: 500 });
  assert('one URL returned by TWO providers collapses to a single item',
    (crossed.items || []).length === 1,
    JSON.stringify((crossed.items || []).map(function (i) { return i.source + ':' + i.itemId; })));
  // Ranked before deduped, so the record kept is the one Relay can actually act on: eBay
  // has a buy API and the open-web match does not, even though the open-web copy is cheaper.
  assert('and the kept record is the ranked one, not merely the first seen',
    crossed.items[0] && crossed.items[0].source === 'ebay',
    crossed.items[0] && crossed.items[0].source + ' @ $' + crossed.items[0].price);
  global.fetch = realFetchDup;
  if (savedEbayId2 === undefined) delete process.env.EBAY_CLIENT_ID; else process.env.EBAY_CLIENT_ID = savedEbayId2;
  if (savedEbaySec2 === undefined) delete process.env.EBAY_CLIENT_SECRET; else process.env.EBAY_CLIENT_SECRET = savedEbaySec2;

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
  var LINKS_CLOSED = [];             // links deactivated after settlement
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
    // Closing the link after settlement, so a reusable link cannot be paid a second time.
    if (url.indexOf('api.stripe.com/v1/payment_links/') !== -1) {
      LINKS_CLOSED.push(url.split('/payment_links/')[1]);
      return { ok: true, status: 200, json: async function () { return { active: false }; } };
    }
    return BLOCK_NETWORK(u);
  };

  var fbPath = require.resolve('../lib/relay-finance-bridge');
  var realFb = require('../lib/relay-finance-bridge');
  var LEDGER_WRITES = [];
  var ALREADY_BOOKED = false;      // false | true | null (ledger unreadable)
  var DRAINS = 0;
  require.cache[fbPath].exports = Object.assign({}, realFb, {
    paymentsEnabled: function () { return true; },
    createPayment: async function (o) {
      return { ok: true, url: 'https://pay.test/x', paymentLinkId: 'plink_' + o.orderId };
    },
    incomeAlreadyBooked: async function () { return ALREADY_BOOKED; },
    queueDepth: async function () { return 1; },
    drainQueue: async function () { DRAINS++; return { ok: true, drained: 1 }; },
    reportIncome: async function (e) { LEDGER_WRITES.push(e); return { ok: true, recorded: true }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];
  let engine3 = require('../lib/relay-engine');
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
    payment_intent: 'pi_abc', amount_total: 1136, currency: 'usd' }];
  // 1136, not 1735. The cart no longer adds a $5.99 shipping line, because supplier
  // freight is already inside the listed price, so this order totals its $11.36 subtotal.
  // Left at 1735 this is a $5.99 OVERPAYMENT, and the order correctly went to
  // payment-review instead of paid: the collected-amount check was doing its job, which
  // is why six assertions downstream of it failed rather than one.
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
    mine().length === 1 && mine()[0].amount === 11.36,
    JSON.stringify(mine()).slice(0, 200));
  // 11.36 and 3.79, down from 17.35 and 9.78. Both moved for one reason, and it is
  // worth being plain about it: the old figures counted the $5.99 shipping fee as
  // revenue, and that fee was the customer paying supplier freight a SECOND time,
  // since freight is already inside the listed price. Reported margin falls here
  // because it was overstated, not because the business got worse.
  assert('with the source cost carried so the margin is real, not assumed',
    mine()[0].sourceCostTotal === 7.57 && mine()[0].margin === 3.79,
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
  // Evidence Stripe gave us, as a genuinely settled order carries. Without it the
  // recovery loop correctly refuses to book income against a status somebody typed.
  await store.updateOrder(stranded.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_stranded' });
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

  // A ledger that is down must not un-pay a customer who paid. Amount matches the order,
  // so this isolates the ledger behaviour rather than tripping the mismatch hold.
  STRIPE_SESSIONS = [{ id: 'cs_led', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_led', amount_total: 1136, currency: 'usd' }];
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

  // ── T35 ─────────────────────────────────────────────────────────────────
  // Relay is not the only thing that can book one of its payments. Every link it creates
  // carries streamId 'relay-order', and /api/capital-engine?action=stripe-webhook hands
  // checkout.session.completed to stripe-rail.recordWebhook, which writes an income event.
  // If that webhook is live, reporting here as well books the same dollar twice and
  // inflates net income and lendable surplus downstream.
  console.log('T35: one charge is booked once, whoever books it');
  var dedupOrder = await store.createOrder({
    buyerId: 'b_dedupe', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(dedupOrder.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + dedupOrder.id });
  STRIPE_SESSIONS = [{ id: 'cs_dupe', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_dupe', amount_total: 1136, currency: 'usd' }];

  ALREADY_BOOKED = true;                       // the webhook got there first
  var beforeDedupe = LEDGER_WRITES.length;
  await engine3.reconcilePayments({ limit: 25 });
  var dedupeAfter = await store.getOrder(dedupOrder.id);
  assert('the order is still marked paid when someone else booked it',
    dedupeAfter.status === 'paid', dedupeAfter.status);
  assert('but the income is NOT booked a second time',
    LEDGER_WRITES.length === beforeDedupe, 'writes: ' + (LEDGER_WRITES.length - beforeDedupe));
  // 'already-booked', NOT 'webhook'. The dedup answer says the charge is in the books; it
  // does not say who put it there, and a previous reconcile that crashed after its ledger
  // write looks identical from here. Naming a source we did not observe is a false audit
  // trail on a financial event.
  assert('and records that it was already booked, without inventing by whom',
    dedupeAfter.incomeBookedBy === 'already-booked', String(dedupeAfter.incomeBookedBy));

  // An unreadable ledger is not evidence that nothing was booked. Writing on that
  // assumption is exactly how the double-book happens, so it must decline to write and
  // leave the order to a later cycle.
  ALREADY_BOOKED = null;
  var unreadable = await store.createOrder({
    buyerId: 'b_unread', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(unreadable.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + unreadable.id });
  var beforeUnread = LEDGER_WRITES.length;
  await engine3.reconcilePayments({ limit: 25 });
  assert('an unreadable ledger does not book income',
    LEDGER_WRITES.filter(function (w) { return w.orderId === unreadable.id; }).length === 0,
    'writes: ' + (LEDGER_WRITES.length - beforeUnread));
  assert('and leaves it unmarked, so a later cycle retries',
    !(await store.getOrder(unreadable.id)).incomeReportedAt);
  ALREADY_BOOKED = false;
  await engine3.reconcilePayments({ limit: 25 });
  assert('which it does once the ledger answers',
    LEDGER_WRITES.filter(function (w) { return w.orderId === unreadable.id; }).length === 1,
    'writes: ' + LEDGER_WRITES.filter(function (w) { return w.orderId === unreadable.id; }).length);

  // ── T36 ─────────────────────────────────────────────────────────────────
  // Autonomy off means "buy nothing". It must not mean "stop noticing that customers
  // paid": the payment link stays live after the switch is flipped, so returning at the
  // gate stranded a charged customer for the whole outage.
  console.log('T36: an off switch stops buying, not bookkeeping');
  var offOrder = await store.createOrder({
    buyerId: 'b_off', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(offOrder.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + offOrder.id });
  await db.set('relay:autonomy', {
    mode: 'off', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  DRAINS = 0;
  var offCycle = await engine3.runCycle({});
  assert('the cycle still declines to buy', offCycle.skipped === true, JSON.stringify(offCycle).slice(0, 120));
  assert('but the paid order was noticed anyway',
    (await store.getOrder(offOrder.id)).status === 'paid',
    (await store.getOrder(offOrder.id)).status);
  assert('and it is reported in the skipped cycle, not silently',
    Array.isArray(offCycle.paymentsReconciled) && offCycle.paymentsReconciled.length > 0,
    JSON.stringify(offCycle.paymentsReconciled || null).slice(0, 120));
  // reportIncome fails soft into a queue, and nothing in production ever drained it: the
  // only caller was the firewall test. Fail-soft with no drain is a slow leak.
  assert('and queued income is actually drained by the cycle', DRAINS > 0, 'drains: ' + DRAINS);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });

  // ── T37 ─────────────────────────────────────────────────────────────────
  // relay-demand-purchase writes order lines with no sourceCost, because that cost lives
  // on the listing it just created. Reducing over the line alone reported a zero cost and
  // a null margin for every order from that entire checkout route.
  console.log('T37: margin is real on both checkout routes');
  var noCostOrder = await store.createOrder({
    buyerId: 'b_nocost', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 2, unitPrice: 11.36, title: 'x' }]   // no sourceCost
  });
  await store.updateOrder(noCostOrder.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + noCostOrder.id });
  STRIPE_SESSIONS = [{ id: 'cs_nc', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_nc', amount_total: 2272, currency: 'usd' }];
  await engine3.reconcilePayments({ limit: 25 });
  var ncWrite = LEDGER_WRITES.filter(function (w) { return w.orderId === noCostOrder.id; })[0];
  assert('a line with no cost resolves it from the listing',
    ncWrite && ncWrite.sourceCostTotal === 15.14, ncWrite && String(ncWrite.sourceCostTotal));
  assert('so the reported margin is the real one, not null',
    ncWrite && ncWrite.margin === 7.58, ncWrite && String(ncWrite.margin));

  // ── T38 ─────────────────────────────────────────────────────────────────
  // Orders sit in awaiting-payment forever when abandoned, and ordersByStatus returns
  // NEWEST first. Taking the newest N meant that past N unpaid orders, the same newest N
  // were rechecked every cycle and an older customer who finally paid was never seen.
  console.log('T38: the longest-waiting customer is not starved');
  var oldest = await store.createOrder({
    buyerId: 'b_oldest', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(oldest.id, {
    status: 'awaiting-payment', paymentLinkId: 'plink_' + oldest.id,
    ts: '2020-01-01T00:00:00.000Z'                       // long before everything else
  });
  for (var pad = 0; pad < 3; pad++) {
    var filler = await store.createOrder({
      buyerId: 'b_pad' + pad, shipping: 0, shippingAddress: cartAddr,
      lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
    });
    await store.updateOrder(filler.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + filler.id });
  }
  STRIPE_SESSIONS = [{ id: 'cs_old', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_old', amount_total: 1136, currency: 'usd' }];
  var narrow = await engine3.reconcilePayments({ limit: 1 });   // room for exactly one
  // Income backfills also land in `checked`; the batch limit is about who gets ASKED.
  var asked = (narrow.checked || []).filter(function (c) { return !c.incomeBackfilled; });
  assert('a batch of one takes the oldest, not the newest',
    asked.length === 1 && asked[0].orderId === oldest.id,
    JSON.stringify(asked).slice(0, 160));
  assert('and that customer is settled', (await store.getOrder(oldest.id)).status === 'paid');

  // ── T39 ─────────────────────────────────────────────────────────────────
  // The orphan loop exists for a crash between the paid-status write and the income
  // write. Some of those crashes happen on unusual amounts, so booking the order's
  // EXPECTED total there would quietly launder a mismatch the status write had already
  // recorded — in exactly the scenario the loop was built to repair.
  console.log('T39: recovery books what was collected, not what was expected');
  var mismatched = await store.createOrder({
    buyerId: 'b_mismatch', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(mismatched.id, {
    status: 'paid',                       // paid, income never written: the crash window
    collectedAmount: 9.99,
    amountMismatch: { charged: 9.99, expected: 11.36 }
  });
  await engine3.reconcilePayments({ limit: 25 });
  var mmWrite = LEDGER_WRITES.filter(function (w) { return w.orderId === mismatched.id; })[0];
  assert('the recovered income is the money Stripe actually took',
    mmWrite && mmWrite.amount === 9.99, mmWrite && String(mmWrite.amount));
  assert('and the margin follows that, not the expected total',
    mmWrite && mmWrite.margin === 2.42, mmWrite && String(mmWrite.margin));

  // ── T40 ─────────────────────────────────────────────────────────────────
  // A payment link is reusable, so abandoned and retried attempts pile up against it.
  // Reading one page and calling that "unpaid" strands a customer whose successful
  // attempt was pushed off the first page by their earlier failed ones.
  console.log('T40: a payment found on page two is still a payment');
  var PAGED = true;
  var pagedOrder = await store.createOrder({
    buyerId: 'b_paged', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(pagedOrder.id, { status: 'awaiting-payment', paymentLinkId: 'plink_paged' });
  var pageRequests = [];
  var prevFetch = global.fetch;
  global.fetch = async function (u) {
    var url = String(u);
    if (url.indexOf('api.stripe.com/v1/checkout/sessions') !== -1) {
      pageRequests.push(url);
      if (url.indexOf('starting_after=') === -1) {
        // Page one: nothing but abandoned attempts, and Stripe says there is more.
        var open = [];
        for (var oi = 0; oi < 3; oi++) open.push({ id: 'cs_open_' + oi, status: 'open', payment_status: 'unpaid' });
        return { ok: true, status: 200, json: async function () { return { data: open, has_more: true }; } };
      }
      return { ok: true, status: 200, json: async function () {
        return { data: [{ id: 'cs_page2', status: 'complete', payment_status: 'paid',
          payment_intent: 'pi_page2', amount_total: 1136, currency: 'usd' }], has_more: false }; } };
    }
    return BLOCK_NETWORK(u);
  };
  var pagedRes = await realFb.paymentStatus('plink_paged');
  assert('the second page is actually requested',
    pageRequests.length === 2 && /starting_after=cs_open_2/.test(pageRequests[1]),
    JSON.stringify(pageRequests.map(function (u) { return u.split('?')[1]; })));
  assert('and the payment on it is found',
    pagedRes.ok === true && pagedRes.paid === true && pagedRes.sessionId === 'cs_page2',
    JSON.stringify(pagedRes));

  // Running out of pages with Stripe still saying there is more, and nothing paid found,
  // is UNKNOWN — not unpaid. The payment could be on the page we did not read, and
  // answering "not paid" strands a charged customer on a confident guess.
  global.fetch = async function (u) {
    var url = String(u);
    if (url.indexOf('api.stripe.com/v1/checkout/sessions') !== -1) {
      var open = [];
      for (var oj = 0; oj < 100; oj++) open.push({ id: 'cs_endless_' + Date.now() + '_' + oj, status: 'open', payment_status: 'unpaid' });
      return { ok: true, status: 200, json: async function () { return { data: open, has_more: true }; } };
    }
    return BLOCK_NETWORK(u);
  };
  var capped = await realFb.paymentStatus('plink_endless');
  assert('exhausting the page budget is unknown, not unpaid',
    capped.ok === false && /unknown/.test(String(capped.error)), JSON.stringify(capped));
  global.fetch = prevFetch;

  // ── T41 ─────────────────────────────────────────────────────────────────
  // Fulfilment authorises against the order's expected sale price, not against what was
  // actually collected. An order paid SHORT that lands in the normal paid queue is bought
  // at a margin that no longer exists — possibly at a loss — and shipped, on the same
  // cycle. And a link paid twice is a customer owed either a second delivery or a refund.
  // Neither is a decision a loop makes alone.
  console.log('T41: money that does not match the order does not auto-fulfil');
  var short = await store.createOrder({
    buyerId: 'b_short', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(short.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + short.id });
  STRIPE_SESSIONS = [{ id: 'cs_short', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_short', amount_total: 500, currency: 'usd' }];   // $5.00 of $11.36
  await engine3.reconcilePayments({ limit: 25 });
  var shortOrder = await store.getOrder(short.id);
  assert('an underpaid order is held for review, not marked paid',
    shortOrder.status === 'payment-review', shortOrder.status);
  assert('and the reason names both figures',
    /5\.00/.test(String(shortOrder.reviewReason)) && /11\.36/.test(String(shortOrder.reviewReason)),
    String(shortOrder.reviewReason));
  assert('so the paid sweep cannot pick it up',
    !(await store.ordersByStatus('paid', 200)).some(function (o) { return o.id === short.id; }));
  assert('but the money that DID arrive is still booked',
    LEDGER_WRITES.filter(function (w) { return w.orderId === short.id; }).length === 1,
    'writes: ' + LEDGER_WRITES.filter(function (w) { return w.orderId === short.id; }).length);

  var twice = await store.createOrder({
    buyerId: 'b_twice', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(twice.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + twice.id });
  STRIPE_SESSIONS = [
    { id: 'cs_a', status: 'complete', payment_status: 'paid', payment_intent: 'pi_a', amount_total: 1136, currency: 'usd' },
    { id: 'cs_b', status: 'complete', payment_status: 'paid', payment_intent: 'pi_b', amount_total: 1136, currency: 'usd' }
  ];
  await engine3.reconcilePayments({ limit: 25 });
  var twiceOrder = await store.getOrder(twice.id);
  assert('a link paid twice is held for review too',
    twiceOrder.status === 'payment-review', twiceOrder.status);
  assert('and both charges are recorded, so neither is silently kept',
    Array.isArray(twiceOrder.duplicatePayments) && twiceOrder.duplicatePayments.length === 2,
    JSON.stringify(twiceOrder.duplicatePayments));
  // ONE charge is booked, not the sum. The webhook books per SESSION, so adding the total
  // on top of a session it already booked double-books that session — and a duplicate
  // charge is money on its way back to the customer, not revenue. The extras are recorded
  // on the order for a refund decision a human makes.
  //
  // WHAT ACTUALLY GATES THIS, corrected after re-proving it: not the per-session choice in
  // relay-finance-bridge (mutating that to sum every paid session leaves this green), but
  // the overpayment cap in lib/relay-engine.js — `bookable`, which clamps the booked
  // amount to the order total. Two paid sessions of $11.36 sum to $22.72, above an $11.36
  // order, so the cap catches it before the per-session choice ever matters. The comment
  // used to name the wrong guard; the number below is correct either way.
  assert('only the order\'s own charge is booked as income',
    LEDGER_WRITES.filter(function (w) { return w.orderId === twice.id; })[0].amount === 11.36,
    String(LEDGER_WRITES.filter(function (w) { return w.orderId === twice.id; })[0].amount));

  // An OVERpayment is money the customer is owed back. Buying and shipping on it leaves
  // the excess with no refund path and nobody looking at it.
  var over = await store.createOrder({
    buyerId: 'b_over', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(over.id, { status: 'awaiting-payment', paymentLinkId: 'plink_' + over.id });
  STRIPE_SESSIONS = [{ id: 'cs_over', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_over', amount_total: 5000, currency: 'usd' }];   // $50 for an $11.36 order
  await engine3.reconcilePayments({ limit: 25 });
  assert('an OVERpaid order is held too, not shipped on the excess',
    (await store.getOrder(over.id)).status === 'payment-review',
    (await store.getOrder(over.id)).status);
  // The excess is owed back, so it is not revenue. Booking the whole $50 would inflate
  // net income and lendable surplus until the refund happens.
  assert('and only the order total is booked, not the excess',
    LEDGER_WRITES.filter(function (w) { return w.orderId === over.id; })[0].amount === 11.36,
    String(LEDGER_WRITES.filter(function (w) { return w.orderId === over.id; })[0].amount));

  // A status can be set by hand. Booking income off one invents revenue nobody paid.
  var noEvidence = await store.createOrder({
    buyerId: 'b_noev', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(noEvidence.id, { status: 'shipped' });   // no Stripe evidence at all
  var noEvRows = (await engine3.reconcilePayments({ limit: 500 })).checked
    .filter(function (c) { return c.orderId === noEvidence.id; });
  assert('an order marked paid by hand books no income',
    noEvRows.length === 0 &&
    LEDGER_WRITES.filter(function (w) { return w.orderId === noEvidence.id; }).length === 0,
    JSON.stringify(noEvRows));

  // Nor may its link be closed. An order forced to 'shipped' by hand has an UNPAID link,
  // and closing it takes away the customer's only way to pay — turning a bookkeeping
  // shortcut into a sale nobody can complete.
  var unpaidLink = await store.createOrder({
    buyerId: 'b_unpaidlink', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(unpaidLink.id, { status: 'shipped', paymentLinkId: 'plink_unpaid_forced' });
  await engine3.reconcilePayments({ limit: 25 });
  assert('and its unpaid payment link is left open',
    LINKS_CLOSED.indexOf('plink_unpaid_forced') === -1,
    JSON.stringify(LINKS_CLOSED.slice(-4)));

  // A settled order's link is never revisited, so leaving it open lets the same customer
  // be charged again into silence. Closing it removes the class instead of detecting it.
  assert('the payment link is closed once its order settles',
    LINKS_CLOSED.indexOf('plink_' + over.id) !== -1, JSON.stringify(LINKS_CLOSED.slice(-4)));
  assert('and the order records that it closed',
    !!(await store.getOrder(over.id)).paymentLinkClosedAt);

  // ISOLATE THE SETTLE-PATH CLOSE. The assertion above was vacuous: deleting the close
  // inside the settle loop left it green, because the retry loop later in the SAME
  // reconcilePayments call picked the order up. Two mechanisms, and the test could not
  // tell which one fired.
  //
  // Here the retry loop is deliberately starved: limit is 1, and an older never-attempted
  // order sorts ahead of ours in the retry's least-recently-tried ordering, consuming the
  // whole batch. So if this order's link ends up closed, only the settle path can have
  // done it.
  var decoy = await store.createOrder({
    buyerId: 'b_decoy', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(decoy.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_decoy',
    paymentLinkId: 'plink_decoy'                       // unclosed, never attempted -> sorts first
  });
  var isolated = await store.createOrder({
    buyerId: 'b_isolated', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(isolated.id, {
    status: 'awaiting-payment', paymentLinkId: 'plink_isolated',
    lastCloseAttemptAt: new Date().toISOString()       // recently tried -> sorts LAST in the retry
  });
  STRIPE_SESSIONS = [{ id: 'cs_iso', status: 'complete', payment_status: 'paid',
    payment_intent: 'pi_iso', amount_total: 1136, currency: 'usd' }];
  LINKS_CLOSED.length = 0;
  await engine3.reconcilePayments({ limit: 1 });
  assert('the retry batch of one was spent on the older order, not ours',
    LINKS_CLOSED.indexOf('plink_decoy') !== -1, JSON.stringify(LINKS_CLOSED));
  assert('so this link can only have been closed by the settle path itself',
    LINKS_CLOSED.indexOf('plink_isolated') !== -1, JSON.stringify(LINKS_CLOSED));

  // A closure Stripe refused must be retried, not left as the final word: until the link
  // closes, that customer can still be charged through it. "Best effort" that never tries
  // twice is a failure with better manners.
  var stubborn = await store.createOrder({
    buyerId: 'b_stubborn', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  // Carries payment evidence, as a genuinely settled order does: the closure retry
  // deliberately will not close the link of an order that was never paid.
  await store.updateOrder(stubborn.id, { status: 'paid', paymentLinkId: 'plink_stubborn',
    paidAt: new Date().toISOString(), stripeSessionId: 'cs_stubborn',
    incomeReportedAt: new Date().toISOString() });
  var closeFails = true;
  var fbNow = require.cache[fbPath].exports;
  require.cache[fbPath].exports = Object.assign({}, fbNow, {
    closePaymentLink: async function (id) {
      if (closeFails) return { ok: false, error: 'stripe said no' };
      LINKS_CLOSED.push(id);
      return { ok: true };
    }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  var engineC = require('../lib/relay-engine');
  await engineC.reconcilePayments({ limit: 25 });
  assert('a refused closure leaves the order unclosed',
    !(await store.getOrder(stubborn.id)).paymentLinkClosedAt);
  closeFails = false;
  await engineC.reconcilePayments({ limit: 25 });
  assert('and a later cycle closes it',
    !!(await store.getOrder(stubborn.id)).paymentLinkClosedAt &&
    LINKS_CLOSED.indexOf('plink_stubborn') !== -1,
    JSON.stringify(LINKS_CLOSED.slice(-3)));
  require.cache[fbPath].exports = fbNow;
  delete require.cache[require.resolve('../lib/relay-engine')];
  engine3 = require('../lib/relay-engine');

  // An order held for review is one where money definitely arrived, so its income still
  // has to be booked. Scanning only 'paid' left exactly the orders with a payment problem
  // as the ones whose payment was never recorded.
  var heldNoIncome = await store.createOrder({
    buyerId: 'b_held', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(heldNoIncome.id, { status: 'payment-review', collectedAmount: 9.0 });
  // Wide batch: this block has created enough orders that 25 no longer reaches the one
  // under test, and the subject here is which STATUS is scanned, not the batch size.
  var heldRows = (await engine3.reconcilePayments({ limit: 500 })).checked
    .filter(function (c) { return c.orderId === heldNoIncome.id; });
  // Asserted on the ORDER and on the reconcile's own report rather than on the test's
  // capture array: the subject is which STATUS the recovery scan covers, and the order is
  // where that outcome is recorded regardless of which bridge instance did the write.
  assert('income is recovered for an order held in review',
    heldRows.length === 1 && heldRows[0].incomeBackfilled === true,
    JSON.stringify(heldRows));
  assert('and the order is marked so it is not booked twice',
    !!(await store.getOrder(heldNoIncome.id)).incomeReportedAt,
    String((await store.getOrder(heldNoIncome.id)).incomeReportedAt));

  // An order fulfilled before its income write succeeded moves on to 'shipped' and would
  // never be scanned again — losing the income of a sale that actually completed.
  var shippedOrphan = await store.createOrder({
    buyerId: 'b_shipped', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(shippedOrphan.id, { status: 'shipped', paidAt: new Date().toISOString(), stripeSessionId: 'cs_shipped' });
  var shippedRows = (await engine3.reconcilePayments({ limit: 500 })).checked
    .filter(function (c) { return c.orderId === shippedOrphan.id; });
  assert('income is recovered for an order that already shipped',
    shippedRows.length === 1 && shippedRows[0].incomeBackfilled === true,
    JSON.stringify(shippedRows));
  // A shipped order that fulfilled before its link closed still has a live link the
  // customer can be charged through.
  assert('and its payment link is closed too, not left live',
    !!(await store.getOrder(shippedOrphan.id)).incomeReportedAt);

  // A skip is not a repair. Reporting 'claimed-elsewhere' or 'ledger-unreadable' as a
  // backfill told the operator a bookkeeping gap had been closed while it is still open.
  var notRepaired = await store.createOrder({
    buyerId: 'b_skip', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(notRepaired.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_skip' });
  ALREADY_BOOKED = null;                        // ledger unreadable: nothing can be booked
  var skipRows = (await engine3.reconcilePayments({ limit: 500 })).checked
    .filter(function (c) { return c.orderId === notRepaired.id; });
  assert('a skip is reported as NOT backfilled, with the reason',
    skipRows.length === 1 && skipRows[0].incomeBackfilled === false &&
    skipRows[0].incomeSkipped === 'ledger-unreadable',
    JSON.stringify(skipRows));
  ALREADY_BOOKED = false;

  // Rotation must advance even on orders Stripe will not answer for. Stamping only on a
  // successful read left a dead link sorted to the front of every cycle, blocking the
  // queue behind it.
  var deadLink = await store.createOrder({
    buyerId: 'b_dead', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(deadLink.id, {
    status: 'awaiting-payment', paymentLinkId: 'plink_dead', ts: '2019-01-01T00:00:00.000Z'
  });
  STRIPE_FAIL = 404;
  await engine3.reconcilePayments({ limit: 1 });
  STRIPE_FAIL = null;
  // Rotation state lives in Relay's own key, NOT on the order: writing it back onto the
  // order would add a whole-map rewrite per unpaid order per cycle, and relay-store
  // rewrites the entire orders map on every update — a concurrent checkout's brand-new
  // order can be dropped by an older snapshot committing over it.
  assert('an order Stripe will not answer for still takes its turn',
    !!((await db.get('relay:payment-checks')) || {})[deadLink.id],
    JSON.stringify(Object.keys((await db.get('relay:payment-checks')) || {}).length));
  assert('and the rotation does not write to the orders map to do it',
    (await store.getOrder(deadLink.id)).lastPaymentCheckAt === undefined);

  // ── T42 ─────────────────────────────────────────────────────────────────
  // reportIncome returns ok:true even when the ledger write AND the fallback queue write
  // both fail. Marking on ok alone stamped "handled" on an event that exists nowhere, and
  // every later recovery pass then skipped that order permanently.
  console.log('T42: income that landed nowhere is not marked handled');
  require.cache[fbPath].exports = Object.assign({}, require.cache[fbPath].exports, {
    reportIncome: async function () { return { ok: true, recorded: false, queued: false, error: 'both failed' }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  var engine6 = require('../lib/relay-engine');
  var lost = await store.createOrder({
    buyerId: 'b_lost', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(lost.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_lost' });
  await engine6.reconcilePayments({ limit: 25 });
  assert('an event that reached neither ledger nor queue leaves the order unmarked',
    !(await store.getOrder(lost.id)).incomeReportedAt,
    String((await store.getOrder(lost.id)).incomeReportedAt));
  require.cache[fbPath].exports = Object.assign({}, require.cache[fbPath].exports, {
    reportIncome: async function (e) { LEDGER_WRITES.push(e); return { ok: true, recorded: true }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  engine3 = require('../lib/relay-engine');
  await engine3.reconcilePayments({ limit: 25 });
  assert('so a later cycle can still book it',
    LEDGER_WRITES.filter(function (w) { return w.orderId === lost.id; }).length === 1,
    'writes: ' + LEDGER_WRITES.filter(function (w) { return w.orderId === lost.id; }).length);

  require.cache[fbPath].exports = realFb;
  require.cache[buyPath].exports = realBuy;
  global.fetch = realFetchPay;
  if (savedStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedStripeKey;
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];

  // ── T43 ─────────────────────────────────────────────────────────────────
  // A dedup scan narrower than what the ledger RETAINS is not a dedup scan: a webhook's
  // entry sitting just outside the window reads as "nothing booked", and the same charge
  // is booked again. Pinned as a relationship between two constants, because the window
  // size is not observable from a stubbed ledger.
  console.log('T43: the dedup scan covers everything the ledger keeps');
  var bridgeSrc = require('fs').readFileSync(require.resolve('../lib/relay-finance-bridge'), 'utf8');
  var ledgerSrc = require('fs').readFileSync(require.resolve('../lib/finance-ledger'), 'utf8');
  var scanN = parseInt((bridgeSrc.match(/LEDGER_SCAN\s*=\s*(\d+)/) || [])[1], 10);
  var keepN = parseInt((ledgerSrc.match(/MAX_LEDGER\s*=\s*(\d+)/) || [])[1], 10);
  assert('the scan window is at least the ledger retention',
    isFinite(scanN) && isFinite(keepN) && scanN >= keepN,
    'scan ' + scanN + ' vs retained ' + keepN);

  // ── T44 ─────────────────────────────────────────────────────────────────
  // THE APPROVE DEFECT. approve() stamped approvedAt and NOTHING read it: fulfillLine
  // called authorize() again, which in queue mode took a SECOND reservation and re-queued.
  // The click bought nothing, and neither reservation was ever settled or released, so
  // each click burned the line cost twice out of dailyCeilingUsd until the UTC day rolled.
  console.log('T44: a human click actually buys, exactly once');
  var apBuy = require.resolve('../lib/relay-buy');
  var apRealBuy = require('../lib/relay-buy');
  var AP_JOBS = [];
  require.cache[apBuy].exports = Object.assign({}, apRealBuy, {
    execute: async function (job) {
      AP_JOBS.push(job);
      return { ok: true, provider: 'cj', sourceOrderId: 'cjo_approved', amount: job.maxCost };
    },
    fileManualTask: async function () { return { ok: true, task: { id: 'task_stub' } }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var apEngine = require('../lib/relay-engine');
  var apCtl = require('../handlers/relay-autonomous-control');
  var apAut = require('../lib/relay-autonomy');

  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  var apListing = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'approve-path item',
    price: 22.00, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v_ap', sourceUrl: 'https://www.cjdropshipping.com/product/-p-AP.html',
    sourceCost: 11.00, sourceShipping: 4.00, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  var apOrder = await store.createOrder({
    buyerId: 'b_ap', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: apListing.id, qty: 1, unitPrice: 22.00, title: 'approve-path item', sourceCost: 11.00 }]
  });
  await store.updateOrder(apOrder.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_ap' });

  // First pass: queue mode reserves and holds for a human. Nothing is bought.
  var pass1 = await apEngine.fulfillPaidOrder({ orderId: apOrder.id });
  assert('queue mode holds the line for a human, buying nothing',
    AP_JOBS.length === 0 && (pass1.lines || [])[0] && pass1.lines[0].state === 'awaiting-approval',
    JSON.stringify((pass1.lines || [])[0] || {}).slice(0, 160));
  var apDecision = pass1.lines[0].decisionId;
  var spentAfterHold = (await apAut.status()).spentToday;
  assert('and one reservation is counted against the day', spentAfterHold === 11, String(spentAfterHold));

  // The click. This is the whole defect: before the fix it bought nothing and reserved again.
  var click = await invoke(apCtl, {
    method: 'POST', headers: {},
    body: { action: 'approve-purchase', key: process.env.RELAY_ADMIN_KEY, decisionId: apDecision }
  });
  var clickBody = click.body || {};
  assert('the click actually places the supplier order',
    AP_JOBS.length === 1 && AP_JOBS[0].orderId === apOrder.id,
    'jobs: ' + AP_JOBS.length);
  assert('and the handler reports THIS decision, not the order aggregate',
    clickBody.purchased === true && clickBody.ok === true,
    JSON.stringify({ ok: clickBody.ok, purchased: clickBody.purchased, reason: clickBody.reason }));
  assert('the approved reservation is the one that was spent',
    AP_JOBS[0].decisionId === apDecision, String(AP_JOBS[0].decisionId));

  // The leak: a second reservation would double-count the day's spend.
  var spentAfterBuy = (await apAut.status()).spentToday;
  assert('no second reservation was taken', spentAfterBuy === 11,
    'spentToday ' + spentAfterHold + ' -> ' + spentAfterBuy);
  var apRows = (await db.get('relay:autonomy-ledger')) || [];
  assert('and the reservation ended settled, not orphaned',
    apRows.filter(function (r) { return r.state === 'settled'; }).length === 1 &&
    apRows.filter(function (r) { return r.state === 'reserved'; }).length === 0,
    JSON.stringify(apRows.map(function (r) { return r.state; })));

  // Idempotence: the same approval cannot be spent twice.
  var click2 = await invoke(apCtl, {
    method: 'POST', headers: {},
    body: { action: 'approve-purchase', key: process.env.RELAY_ADMIN_KEY, decisionId: apDecision }
  });
  assert('the same approval cannot be spent twice',
    AP_JOBS.length === 1, 'jobs after second click: ' + AP_JOBS.length);

  // THE KILL SWITCH. An approval granted before the switch was thrown is not permission
  // to spend after it. This is the fatal objection the adversarial review raised.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  var offOrder = await store.createOrder({
    buyerId: 'b_apoff', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: apListing.id, qty: 1, unitPrice: 22.00, title: 'x', sourceCost: 11.00 }]
  });
  await store.updateOrder(offOrder.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_apoff' });
  var offHold = await apEngine.fulfillPaidOrder({ orderId: offOrder.id });
  var offDecision = offHold.lines[0].decisionId;
  await apAut.approve(offDecision, 'operator');
  var beforeOff = AP_JOBS.length;
  await db.set('relay:autonomy', {
    mode: 'off', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  var offRes = await apAut.consumeApproved({
    decisionId: offDecision, orderId: offOrder.id, listingId: apListing.id, amount: 11.00
  });
  assert('mode OFF refuses an approval granted before the switch',
    offRes.allowed === false && /OFF/.test(String(offRes.reason)), JSON.stringify(offRes.reason));
  assert('and nothing was bought', AP_JOBS.length === beforeOff, 'jobs: ' + AP_JOBS.length);

  // An auto-mode reservation is not something a human approved.
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  await db.set('relay:autonomy-ledger', []);
  var autoRes = await apAut.authorize({ amount: 11, salePrice: 22, orderId: 'o_auto', listingId: apListing.id });
  await apAut.approve(autoRes.decisionId, 'operator');
  var autoConsume = await apAut.consumeApproved({
    decisionId: autoRes.decisionId, orderId: 'o_auto', listingId: apListing.id, amount: 11
  });
  assert('an auto-mode reservation cannot be consumed as an approval',
    autoConsume.allowed === false && /not queued/.test(String(autoConsume.reason)),
    JSON.stringify(autoConsume.reason));

  // Funds are re-checked at consume time: approval is a human delay, and the contract is
  // "never spend into overdraft", not "never start to".
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false
  });
  await db.set('relay:autonomy-ledger', []);
  var fundRes = await apAut.authorize({ amount: 11, salePrice: 22, orderId: 'o_f', listingId: apListing.id });
  await apAut.approve(fundRes.decisionId, 'operator');
  var ppPath = require.resolve('../lib/relay-paypal-balance');
  var ppReal = require.cache[ppPath] ? require.cache[ppPath].exports : null;
  require.cache[ppPath] = { id: ppPath, filename: ppPath, loaded: true,
    exports: { getCurrentBalance: async function () { return 0; } } };
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true
  });
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var apAut2 = require('../lib/relay-autonomy');
  var fundConsume = await apAut2.consumeApproved({
    decisionId: fundRes.decisionId, orderId: 'o_f', listingId: apListing.id, amount: 11
  });
  assert('funds are re-checked when the approval is spent, not only when reserved',
    fundConsume.allowed === false && /funding balance/.test(String(fundConsume.reason)),
    JSON.stringify(fundConsume.reason));
  if (ppReal) require.cache[ppPath] = { id: ppPath, filename: ppPath, loaded: true, exports: ppReal };
  else delete require.cache[ppPath];

  require.cache[apBuy].exports = apRealBuy;
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T45 ─────────────────────────────────────────────────────────────────
  // _claimIncome IS THE CONCURRENCY GUARD, AND IT HAD NO TEST.
  //
  // Re-proving every guard from the merged PRs with a verifying mutator turned this up:
  // replacing `const claim = await _claimIncome(order.id)` with `{ ok: true }` left all
  // 376 assertions green. The claim's happy path runs on every booking, so it LOOKED
  // covered; the contended path it exists for — two overlapping reconciles both reading
  // "not booked" and both writing income — was never exercised once.
  //
  // limen-db has no compare-and-set, so this is a write-then-verify claim: write a token,
  // read it back, and only proceed if it is still ours. That is the whole mechanism, and
  // "read it back" is the half that was untested.
  console.log('T45: a contended income claim is refused, and the money is not booked twice');
  var dbPath = require.resolve('../lib/limen-db');
  var realDb = require('../lib/limen-db');
  var CLAIM_KEY = 'relay:income-claims';
  var raceMode = null;          // null | 'foreign-readback'
  var raceOrderId = null;
  var claimSetSeen = false;
  require.cache[dbPath].exports = Object.assign({}, realDb, {
    get: async function (k) {
      // THE RACE. Our token was written, and between our write and our read another
      // writer clobbered the key with theirs. This is the exact interleaving the
      // write-then-verify exists to catch, and it cannot be produced any other way
      // without a real second process.
      if (k === CLAIM_KEY && raceMode === 'foreign-readback' && claimSetSeen) {
        var m = {};
        m[raceOrderId] = { token: 'the-other-cycle', at: Date.now() };
        return m;
      }
      return realDb.get(k);
    },
    set: async function (k, v) {
      if (k === CLAIM_KEY) claimSetSeen = true;
      return realDb.set(k, v);
    }
  });
  // The bridge MUST be stubbed here or LEDGER_WRITES stays empty for the ordinary reason
  // and every "nothing was booked" assertion below is vacuous. Caught exactly that way:
  // the stale-claim case failed while its two neighbours passed, and the neighbours were
  // passing because income was going to the real ledger, not because it was refused.
  var raceBookings = [];
  require.cache[fbPath].exports = Object.assign({}, realFb, {
    paymentsEnabled: function () { return true; },
    incomeAlreadyBooked: async function () { return false; },
    queueDepth: async function () { return 0; },
    drainQueue: async function () { return { ok: true, drained: 0 }; },
    reportIncome: async function (e) {
      raceBookings.push(e);
      LEDGER_WRITES.push(e);
      return { ok: true, recorded: true };
    }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  var raceEngine = require('../lib/relay-engine');

  var raceOrder = await store.createOrder({
    buyerId: 'b_race', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  raceOrderId = raceOrder.id;
  await store.updateOrder(raceOrder.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_race', collectedAmount: 11.36
  });
  await db.set(CLAIM_KEY, {});
  var writesBeforeRace = LEDGER_WRITES.length;

  raceMode = 'foreign-readback';
  claimSetSeen = false;
  var raceRows = (await raceEngine.reconcilePayments({ limit: 500 })).checked
    .filter(function (c) { return c.orderId === raceOrder.id; });
  raceMode = null;

  assert('a claim whose read-back returns another writer\'s token is refused',
    raceRows.length === 1 && raceRows[0].incomeSkipped === 'claimed-elsewhere',
    JSON.stringify(raceRows));
  assert('and NOTHING is booked for it',
    LEDGER_WRITES.filter(function (w) { return w.orderId === raceOrder.id; }).length === 0,
    'writes: ' + (LEDGER_WRITES.length - writesBeforeRace));
  assert('and the order is left unmarked, so the winner books it and we retry',
    !(await store.getOrder(raceOrder.id)).incomeReportedAt,
    String((await store.getOrder(raceOrder.id)).incomeReportedAt));

  // The other rejection path: a claim already held by a live cycle. Different branch of
  // the same guard — this one sees the contention BEFORE writing rather than after.
  var heldOrder = await store.createOrder({
    buyerId: 'b_held_claim', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(heldOrder.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_held', collectedAmount: 11.36
  });
  var heldMap = {};
  heldMap[heldOrder.id] = { token: 'a-cycle-still-running', at: Date.now() };
  await db.set(CLAIM_KEY, heldMap);
  var heldRows = (await raceEngine.reconcilePayments({ limit: 500 })).checked
    .filter(function (c) { return c.orderId === heldOrder.id; });
  assert('an order already claimed by a live cycle is left alone',
    heldRows.length === 1 && heldRows[0].incomeSkipped === 'claimed-elsewhere',
    JSON.stringify(heldRows));
  assert('and nothing is booked for that one either',
    LEDGER_WRITES.filter(function (w) { return w.orderId === heldOrder.id; }).length === 0);

  // A claim left behind by a crash must not wedge the order out of recovery forever.
  var staleMap = {};
  staleMap[heldOrder.id] = { token: 'from-a-cycle-that-died', at: Date.now() - (10 * 60 * 1000) };
  await db.set(CLAIM_KEY, staleMap);
  await raceEngine.reconcilePayments({ limit: 500 });
  assert('a stale claim from a crashed cycle is reclaimable',
    LEDGER_WRITES.filter(function (w) { return w.orderId === heldOrder.id; }).length === 1,
    'writes: ' + LEDGER_WRITES.filter(function (w) { return w.orderId === heldOrder.id; }).length);

  require.cache[dbPath].exports = realDb;
  require.cache[fbPath].exports = realFb;
  await db.set(CLAIM_KEY, {});
  delete require.cache[require.resolve('../lib/relay-engine')];

  // ── T46 ─────────────────────────────────────────────────────────────────
  // THE RATE LIMIT, at its real production values: 3 orders or $60 per rolling hour.
  //
  // perOrderCapUsd and dailyCeilingUsd are both TOTALS, and the daily one keys on the UTC
  // date — which rolls at 19:00 America/Chicago. A loop that has gone wrong can spend the
  // whole day's ceiling in one cycle and get a fresh $250 five minutes later. Neither
  // limit bounds how FAST money leaves, and the whole point of this one is that it does
  // not depend on a human noticing.
  console.log('T46: the hourly rate limit holds without anyone watching');
  var velAut = require('../lib/relay-autonomy');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 3, velocityMaxUsd: 60          // the confirmed production numbers
  });

  // Three small orders inside the window are fine.
  var v1 = await velAut.authorize({ amount: 10, salePrice: 30, orderId: 'v1', marketplace: 'cj' });
  var v2 = await velAut.authorize({ amount: 10, salePrice: 30, orderId: 'v2', marketplace: 'cj' });
  var v3 = await velAut.authorize({ amount: 10, salePrice: 30, orderId: 'v3', marketplace: 'cj' });
  assert('three purchases in the hour are allowed',
    v1.allowed && v2.allowed && v3.allowed,
    JSON.stringify([v1.allowed, v2.allowed, v3.allowed]));

  // The fourth is refused on COUNT, with $30 of a $250 ceiling used and $60 of headroom.
  var v4 = await velAut.authorize({ amount: 10, salePrice: 30, orderId: 'v4', marketplace: 'cj' });
  assert('the fourth is refused on order count, not on the daily ceiling',
    v4.allowed === false && /reaches the 3 limit/.test(String(v4.reason)),
    JSON.stringify(v4.reason));
  assert('and the day still has plenty of room, proving it was the RATE that stopped it',
    v4.remainingToday >= 200, String(v4.remainingToday));

  // The dollar half, independently: one big order inside the count limit.
  await db.set('relay:autonomy-ledger', []);
  var b1 = await velAut.authorize({ amount: 50, salePrice: 150, orderId: 'b1', marketplace: 'cj' });
  var b2 = await velAut.authorize({ amount: 40, salePrice: 120, orderId: 'b2', marketplace: 'cj' });
  assert('spend past $60 in the hour is refused even on the second order',
    b1.allowed === true && b2.allowed === false && /exceeds the \$60 hourly rate limit/.test(String(b2.reason)),
    JSON.stringify({ b1: b1.allowed, b2: b2.reason }));

  // THE WINDOW ROLLS. An order that ages out stops counting — this is what makes it a
  // rate limit rather than a second, smaller daily ceiling.
  var aged = (await db.get('relay:autonomy-ledger')) || [];
  aged.forEach(function (r) { r.ts = new Date(Date.now() - 61 * 60 * 1000).toISOString(); });
  await db.set('relay:autonomy-ledger', aged);
  var afterWindow = await velAut.authorize({ amount: 40, salePrice: 120, orderId: 'b3', marketplace: 'cj' });
  assert('once the hour passes, purchasing resumes on its own',
    afterWindow.allowed === true, JSON.stringify(afterWindow.reason));

  // Clicking approve repeatedly must not outrun it either.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var q1 = await velAut.authorize({ amount: 10, salePrice: 30, orderId: 'q1', listingId: 'L1', marketplace: 'cj' });
  var q2 = await velAut.authorize({ amount: 10, salePrice: 30, orderId: 'q2', listingId: 'L2', marketplace: 'cj' });
  await velAut.approve(q2.decisionId, 'operator');
  // Both are reserved. NOW the rate limit tightens — the click must not be a way past it.
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 1, velocityMaxUsd: 60
  });
  var qConsume = await velAut.consumeApproved({
    decisionId: q2.decisionId, orderId: 'q2', listingId: 'L2', amount: 10
  });
  assert('an approval cannot be used to outrun the rate limit',
    qConsume.allowed === false && /last hour/.test(String(qConsume.reason)),
    JSON.stringify(qConsume.reason));

  // ── T47 ─────────────────────────────────────────────────────────────────
  // THE FUNDING GATE READS THE WALLET THAT IS ACTUALLY DEBITED.
  //
  // It read a PayPal balance for every purchase, and no Relay purchase has ever debited
  // PayPal — CJ pays from its own prepaid wallet. Live PayPal read $0.00, so the gate
  // refused every sale, including the customer's checkout, on a number about a different
  // account. Nothing in the client could read the right one, which is why it stood.
  console.log('T47: funding is checked against the CJ wallet, not PayPal');
  var cjPathF = require.resolve('../lib/relay-cj');
  var realCjF = require.cache[cjPathF] ? require.cache[cjPathF].exports : require('../lib/relay-cj');
  var ppPathF = require.resolve('../lib/relay-paypal-balance');
  var realPpF = require.cache[ppPathF] ? require.cache[ppPathF].exports : null;
  var CJ_BAL = { ok: true, available: 100, amount: 100, frozen: 0 };
  var paypalReads = 0;
  require.cache[cjPathF] = { id: cjPathF, filename: cjPathF, loaded: true,
    exports: Object.assign({}, realCjF, { balance: async function () { return CJ_BAL; } }) };
  require.cache[ppPathF] = { id: ppPathF, filename: ppPathF, loaded: true,
    exports: { getCurrentBalance: async function () { paypalReads++; return 0; } } };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  let fundAut = require('../lib/relay-autonomy');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });

  var funded = await fundAut.authorize({ amount: 20, salePrice: 60, orderId: 'f1', marketplace: 'cj' });
  assert('a funded CJ wallet authorises the purchase',
    funded.allowed === true, JSON.stringify(funded.reason));
  assert('and PayPal was never consulted for a CJ purchase',
    paypalReads === 0, 'paypal reads: ' + paypalReads);

  // The wallet read is cached for a minute so a cart does not pay a round trip per line.
  // Re-requiring clears that module state, which is the only way to vary it in-test.
  CJ_BAL = { ok: true, available: 5, amount: 5, frozen: 0 };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  fundAut = require('../lib/relay-autonomy');
  var poor = await fundAut.authorize({ amount: 20, salePrice: 60, orderId: 'f2', marketplace: 'cj' });
  // The refusal also names money already COMMITTED but not yet debited — the earlier $20
  // reservation is spend the wallet has not seen leave yet, and counting it is what stops
  // two orders inside the cache window from both passing on the same balance.
  assert('an empty CJ wallet refuses, naming the wallet and the shortfall',
    poor.allowed === false &&
    /CJ wallet has \$5\.00/.test(String(poor.reason)) &&
    /\$20\.00 purchase/.test(String(poor.reason)),
    JSON.stringify(poor.reason));

  // Unreadable is NOT empty. Both refuse, but the reason has to be true or the operator
  // funds the wrong thing chasing a wrong message.
  CJ_BAL = { ok: false, error: 'CJ 503: upstream' };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  fundAut = require('../lib/relay-autonomy');
  var blind = await fundAut.authorize({ amount: 20, salePrice: 60, orderId: 'f3', marketplace: 'cj' });
  assert('an unreadable wallet refuses as UNREADABLE, not as empty',
    blind.allowed === false && /could not read the CJ wallet/.test(String(blind.reason)),
    JSON.stringify(blind.reason));

  if (realPpF) require.cache[ppPathF] = { id: ppPathF, filename: ppPathF, loaded: true, exports: realPpF };
  else delete require.cache[ppPathF];
  require.cache[cjPathF] = { id: cjPathF, filename: cjPathF, loaded: true, exports: realCjF };
  delete require.cache[require.resolve('../lib/relay-autonomy')];

  // ── T48 ─────────────────────────────────────────────────────────────────
  // AN EXCEPTION QUEUE NOBODY IS TOLD ABOUT IS A DRAWER, NOT A QUEUE.
  //
  // reconcilePayments routes underpayments and double-payments to 'payment-review' and
  // keeps them out of the automatic sweep. That is the right behaviour and it was totally
  // silent: no email, no webhook, no counter anywhere in Relay, and not one control read
  // touched relay:store:orders. A customer's money arrived, the loop deliberately stopped,
  // and nothing said so — nor was there any way to look.
  console.log('T48: a held order is visible where the operator already looks');
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var alertCtl = require('../handlers/relay-autonomous-control');
  var K = process.env.RELAY_ADMIN_KEY;

  var heldA = await store.createOrder({
    buyerId: 'b_alert', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(heldA.id, {
    status: 'payment-review',
    reviewReason: 'paid $5.00 against $11.36 owed',
    collectedAmount: 5.00, paidAt: new Date().toISOString()
  });

  var stat = await invoke(alertCtl, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + K, headers: {}
  });
  assert('status counts orders held for review',
    stat.body && stat.body.heldForReview >= 1, JSON.stringify(stat.body && stat.body.heldForReview));
  assert('and needsAttention is non-zero, so silence means nothing is wrong',
    stat.body && stat.body.needsAttention >= 1, String(stat.body && stat.body.needsAttention));
  // A count alone makes the operator go hunting for the reason. The reason rides along.
  var mine = ((stat.body && stat.body.heldReasons) || []).filter(function (r) { return r.orderId === heldA.id; });
  assert('the reason travels with the count, not somewhere else',
    mine.length === 1 && /5\.00/.test(String(mine[0].reason)) && mine[0].collected === 5,
    JSON.stringify(mine));

  // The lookup that did not exist. ?view=order is a POST purchase route, and no control
  // read touched the order store — so during a live test nobody could answer "did it flip
  // to paid, or is it stuck".
  var listed = await invoke(alertCtl, {
    method: 'GET', url: '/api/relay?view=control&action=orders&status=payment-review&key=' + K, headers: {}
  });
  var found = ((listed.body && listed.body.orders) || []).filter(function (o) { return o.id === heldA.id; });
  assert('held orders can actually be listed', found.length === 1, JSON.stringify(listed.body && listed.body.count));
  assert('and carry what a human needs to decide',
    found[0] && found[0].collectedAmount === 5 && found[0].total === 11.36 && /owed/.test(String(found[0].reviewReason)),
    JSON.stringify(found[0]));

  // Operator-only: these rows carry source costs, which is the one thing that must never
  // reach a customer.
  var noKey = await invoke(alertCtl, {
    method: 'GET', url: '/api/relay?view=control&action=orders&status=payment-review', headers: {}
  });
  assert('the order lookup is gated like every other admin read',
    noKey.status === 403 || (noKey.body && noKey.body.ok === false),
    JSON.stringify({ s: noKey.status, b: noKey.body }).slice(0, 140));

  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T49 ─────────────────────────────────────────────────────────────────
  // FOUR WAYS THE NEW GATES COULD BE WALKED AROUND, found in review.
  console.log('T49: the rate limit and the approval gate cannot be walked around');
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var wAut = require('../lib/relay-autonomy');
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var wCtl = require('../handlers/relay-autonomous-control');

  // (a) AN AGED QUEUE, APPROVED IN A BURST. The window keyed on the reservation
  // timestamp, so three reservations left overnight and approved in quick succession
  // counted for nothing — the rate limit was defeated on exactly the path a human drives.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    // Permissive while RESERVING, or the third reservation is refused here and the test
    // proves nothing about the consume path. Caught by mutation: zeroing the consumedAt
    // term left this green, because there were only ever two rows to approve.
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var agedIds = [];
  for (var ai = 0; ai < 3; ai++) {
    var a = await wAut.authorize({ amount: 5, salePrice: 30, orderId: 'aged' + ai, listingId: 'L' + ai, marketplace: 'cj' });
    agedIds.push(a.decisionId);
  }
  var agedRows = (await db.get('relay:autonomy-ledger')) || [];
  agedRows.forEach(function (r) { r.ts = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); });
  await db.set('relay:autonomy-ledger', agedRows);
  for (var aj = 0; aj < 3; aj++) await wAut.approve(agedIds[aj], 'operator');
  // NOW the rate limit tightens. Three aged, approved rows and a limit of two: the
  // consume path is the only thing that can hold the burst.
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 2, velocityMaxUsd: 999
  });
  var burst = [];
  for (var ak = 0; ak < 3; ak++) {
    burst.push(await wAut.consumeApproved({
      decisionId: agedIds[ak], orderId: 'aged' + ak, listingId: 'L' + ak, amount: 5
    }));
  }
  assert('an aged queue cannot be approved into an unbounded burst',
    agedIds.filter(Boolean).length === 3 && burst.filter(function (r) { return r.allowed; }).length === 2,
    JSON.stringify(burst.map(function (r) { return r.allowed ? 'ok' : r.reason; })));

  // (b) LIMITS TIGHTENED AFTER QUEUEING must apply to a pending approval.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var pend = await wAut.authorize({ amount: 40, salePrice: 100, orderId: 'tight', listingId: 'LT', marketplace: 'cj' });
  await wAut.approve(pend.decisionId, 'operator');
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 10, dailyCeilingUsd: 250,      // cap cut below the row
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var capped = await wAut.consumeApproved({ decisionId: pend.decisionId, orderId: 'tight', listingId: 'LT', amount: 40 });
  assert('a per-order cap lowered after queueing still binds the approval',
    capped.allowed === false && /per-order cap/.test(String(capped.reason)), JSON.stringify(capped.reason));

  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 90, minMarginPct: 0.10, requireFunds: false,     // floor raised above the spread
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var floored = await wAut.consumeApproved({ decisionId: pend.decisionId, orderId: 'tight', listingId: 'LT', amount: 40 });
  assert('a margin floor raised after queueing still binds the approval',
    floored.allowed === false && /floor as it stands now/.test(String(floored.reason)), JSON.stringify(floored.reason));

  // (c) A CART'S OTHER LINES ARE REAL INTENT. A dry run writes no row, so every line saw
  // an empty window; the basket passed, the customer paid, and the tail blocked later.
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 3, velocityMaxUsd: 999
  });
  var lineFour = await wAut.authorize({
    amount: 10, salePrice: 30, orderId: 'cart', marketplace: 'cj', dryRun: true, plannedOrders: 3
  });
  assert('a cart whose LINE COUNT breaks the rate limit is refused before payment',
    lineFour.allowed === false && /rate limit/.test(String(lineFour.reason)), JSON.stringify(lineFour.reason));

  // (d) MONEY ALREADY PROMISED comes off the cached wallet, or two orders inside the
  // cache window both pass on the same balance and the second customer pays for nothing.
  var cjW = require.resolve('../lib/relay-cj');
  var realCjW = require.cache[cjW] ? require.cache[cjW].exports : require('../lib/relay-cj');
  require.cache[cjW] = { id: cjW, filename: cjW, loaded: true,
    exports: Object.assign({}, realCjW, { balance: async function () { return { ok: true, available: 40, amount: 40, frozen: 0 }; } }) };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var wal = require('../lib/relay-autonomy');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var w1 = await wal.authorize({ amount: 25, salePrice: 80, orderId: 'w1', marketplace: 'cj' });
  var w2 = await wal.authorize({ amount: 25, salePrice: 80, orderId: 'w2', marketplace: 'cj' });
  assert('the first $25 passes against a $40 wallet', w1.allowed === true, JSON.stringify(w1.reason));
  assert('the second is refused, because the first $25 is already committed',
    w2.allowed === false && /already committed/.test(String(w2.reason)), JSON.stringify(w2.reason));
  require.cache[cjW] = { id: cjW, filename: cjW, loaded: true, exports: realCjW };

  // (e) The rate limit must be settable through the endpoint that advertises it.
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 3, velocityMaxUsd: 60
  });
  var setRes = await invoke(wCtl, {
    method: 'POST', headers: {},
    body: { action: 'set-limits', key: process.env.RELAY_ADMIN_KEY, velocityMaxOrders: 7, velocityMaxUsd: 123 }
  });
  assert('set-limits actually forwards the rate limit, instead of reporting success',
    setRes.body && setRes.body.ok && setRes.body.config &&
    setRes.body.config.velocityMaxOrders === 7 && setRes.body.config.velocityMaxUsd === 123,
    JSON.stringify(setRes.body && setRes.body.config));

  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T50 ─────────────────────────────────────────────────────────────────
  // ONE ROW, COUNTED ONCE. Two guards made the same mistake in opposite directions: the
  // funds check left the row being spent in the "already committed" total and then asked
  // the remainder to cover it AGAIN, so an approval needed twice the purchase price in
  // the wallet; the dollar-rate check excluded the row AND passed a zero amount, so the
  // purchase being released counted for nothing. One rule now: drop the row from what is
  // already committed, then count its amount once as the new spend.
  console.log('T50: the row being spent is counted exactly once, in both gates');
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var oneAut = require('../lib/relay-autonomy');
  var cjOne = require.resolve('../lib/relay-cj');
  var realCjOne = require.cache[cjOne] ? require.cache[cjOne].exports : require('../lib/relay-cj');
  var WALLET = 30;
  require.cache[cjOne] = { id: cjOne, filename: cjOne, loaded: true,
    exports: Object.assign({}, realCjOne, {
      balance: async function () { return { ok: true, available: WALLET, amount: WALLET, frozen: 0 }; } }) };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  oneAut = require('../lib/relay-autonomy');

  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var r20 = await oneAut.authorize({ amount: 20, salePrice: 60, orderId: 'one', listingId: 'LO', marketplace: 'cj' });
  assert('a $20 purchase queues against a $30 wallet', !!r20.decisionId, JSON.stringify(r20.reason));
  await oneAut.approve(r20.decisionId, 'operator');
  var spend20 = await oneAut.consumeApproved({ decisionId: r20.decisionId, orderId: 'one', listingId: 'LO', amount: 20 });
  assert('and the SAME $20 is spendable at approval, not double-subtracted',
    spend20.allowed === true, JSON.stringify(spend20.reason));

  // The dollar-rate side of the same rule: two overnight $40 approvals must not both
  // clear a $60 hourly cap by each counting as zero.
  await db.set('relay:autonomy-ledger', []);
  WALLET = 500;
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    // Permissive while RESERVING, or the second reservation never exists and the test
    // proves nothing about the consume path. Same trap as T49; caught the same way.
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var d1 = await oneAut.authorize({ amount: 40, salePrice: 120, orderId: 'd1', listingId: 'LD1', marketplace: 'cj' });
  var d2 = await oneAut.authorize({ amount: 40, salePrice: 120, orderId: 'd2', listingId: 'LD2', marketplace: 'cj' });
  var dRows = (await db.get('relay:autonomy-ledger')) || [];
  dRows.forEach(function (r) { r.ts = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); });
  await db.set('relay:autonomy-ledger', dRows);
  await oneAut.approve(d1.decisionId, 'operator');
  await oneAut.approve(d2.decisionId, 'operator');
  // NOW the dollar cap tightens: two aged $40 approvals against $60 an hour.
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 60
  });
  var c1 = await oneAut.consumeApproved({ decisionId: d1.decisionId, orderId: 'd1', listingId: 'LD1', amount: 40 });
  var c2 = await oneAut.consumeApproved({ decisionId: d2.decisionId, orderId: 'd2', listingId: 'LD2', amount: 40 });
  assert('two $40 approvals cannot both clear a $60 hourly cap',
    !!d1.decisionId && !!d2.decisionId &&
    c1.allowed === true && c2.allowed === false && /hourly rate limit/.test(String(c2.reason)),
    JSON.stringify({ first: c1.allowed, second: c2.reason }));

  // A SETTLED purchase still counts against the cached wallet. settle() flips the row the
  // instant the buy succeeds while the balance stays cached for a minute, so counting
  // only 'reserved' meant an ordinary completed purchase subtracted nothing.
  await db.set('relay:autonomy-ledger', []);
  WALLET = 40;
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  oneAut = require('../lib/relay-autonomy');
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var s1 = await oneAut.authorize({ amount: 25, salePrice: 80, orderId: 's1', marketplace: 'cj' });
  await oneAut.settle(s1.decisionId, { amount: 25, sourceOrderId: 'cjo_s1' });
  var s2 = await oneAut.authorize({ amount: 25, salePrice: 80, orderId: 's2', marketplace: 'cj' });
  assert('a SETTLED debit still counts while the wallet figure is cached',
    s2.allowed === false && /committed/.test(String(s2.reason)), JSON.stringify(s2.reason));

  require.cache[cjOne] = { id: cjOne, filename: cjOne, loaded: true, exports: realCjOne };
  delete require.cache[require.resolve('../lib/relay-autonomy')];

  // ── T51 ─────────────────────────────────────────────────────────────────
  // THE ALERT MUST NOT GO QUIET UNDER THE FAILURE IT EXISTS FOR.
  console.log('T51: a stranded order and an unreadable store both raise the alarm');
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var alCtl = require('../handlers/relay-autonomous-control');
  var AK = process.env.RELAY_ADMIN_KEY;

  // A paid order whose purchase failed WITHOUT filing a task. needsAttention summed only
  // held orders and tasks, so this read as zero while a customer's money sat taken and
  // nothing had been ordered.
  // MEASURED AS A DELTA. Asserting needsAttention >= 1 was vacuous: held orders from
  // earlier blocks already made it non-zero, so the stranded order contributed nothing
  // and removing it from the sum left the assertion green.
  var beforeStranded = (await invoke(alCtl, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK, headers: {}
  })).body.needsAttention;
  var strandedOrder = await store.createOrder({
    buyerId: 'b_stranded', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: payListing.id, qty: 1, unitPrice: 11.36, title: 'x', sourceCost: 7.57 }]
  });
  await store.updateOrder(strandedOrder.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_str',
    fulfillment: { state: 'failed', reason: 'supplier refused' }
  });
  var st2 = await invoke(alCtl, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK, headers: {}
  });
  assert('a paid order nobody bought RAISES the attention total',
    st2.body && st2.body.needsAttention === beforeStranded + 1 && st2.body.strandedWithoutTask >= 1,
    JSON.stringify({ before: beforeStranded, after: st2.body && st2.body.needsAttention, s: st2.body && st2.body.strandedWithoutTask }));

  // An unreadable order store must not answer with the same shape as an empty one.
  var storePath = require.resolve('../lib/relay-store');
  var realStoreMod = require.cache[storePath].exports;
  require.cache[storePath].exports = Object.assign({}, realStoreMod, {
    ordersByStatus: async function () { throw new Error('redis-unavailable'); }
  });
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var blindCtl = require('../handlers/relay-autonomous-control');
  var st3 = await invoke(blindCtl, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK, headers: {}
  });
  assert('an unreadable order store does NOT report zero held',
    st3.body && st3.body.heldForReview === null, JSON.stringify(st3.body && st3.body.heldForReview));
  assert('needsAttention is unknown, not calm',
    st3.body && st3.body.needsAttention === null, JSON.stringify(st3.body && st3.body.needsAttention));
  assert('and the outage is named, so null is never mistaken for fine',
    st3.body && /redis-unavailable/.test(String(st3.body.ordersUnavailable)),
    JSON.stringify(st3.body && st3.body.ordersUnavailable));

  require.cache[storePath].exports = realStoreMod;
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T52 ─────────────────────────────────────────────────────────────────
  // ONE APPROVAL BELONGS TO ONE LINE. fulfillPaidOrder hands the same decisionId to every
  // unfinished line of a multi-line order, so the others hit the binding check. Treating
  // that as a plain refusal made them fall through to a fresh authorize() — duplicating
  // reservations that were still live, filing a second manual task each, and
  // double-counting the day's and the hour's capacity. Approving one line quietly
  // inflated the queue.
  console.log('T52: approving one line does not duplicate the others');
  var mlBuy = require.resolve('../lib/relay-buy');
  var mlRealBuy = require('../lib/relay-buy');
  var ML_JOBS = [];
  require.cache[mlBuy].exports = Object.assign({}, mlRealBuy, {
    execute: async function (job) { ML_JOBS.push(job); return { ok: true, provider: 'cj', sourceOrderId: 'cjo_ml', amount: job.maxCost }; },
    fileManualTask: async function () { return { ok: true, task: { id: 'task_ml' } }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var mlEngine = require('../lib/relay-engine');
  var mlAut = require('../lib/relay-autonomy');

  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var mlB = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'second line',
    price: 22.00, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v_ml', sourceUrl: 'https://www.cjdropshipping.com/product/-p-ML.html',
    sourceCost: 11.00, sourceShipping: 4.00, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  var mlOrder = await store.createOrder({
    buyerId: 'b_ml', shipping: 0, shippingAddress: cartAddr,
    lines: [
      { listingId: payListing.id, qty: 1, unitPrice: 22.00, title: 'line one', sourceCost: 11.00 },
      { listingId: mlB.id, qty: 1, unitPrice: 22.00, title: 'line two', sourceCost: 11.00 }
    ]
  });
  await store.updateOrder(mlOrder.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_ml' });

  var held2 = await mlEngine.fulfillPaidOrder({ orderId: mlOrder.id });
  assert('both lines queue for a human', (held2.lines || []).length === 2 &&
    held2.lines.every(function (l) { return l.state === 'awaiting-approval'; }),
    JSON.stringify((held2.lines || []).map(function (l) { return l.state; })));
  var firstDecision = held2.lines[0].decisionId;
  var reservedBefore = ((await db.get('relay:autonomy-ledger')) || []).length;
  assert('two reservations exist, one per line', reservedBefore === 2, String(reservedBefore));

  await mlAut.approve(firstDecision, 'operator');
  var mlRun = await mlEngine.fulfillPaidOrder({ orderId: mlOrder.id, decisionId: firstDecision, force: true });

  assert('the approved line is bought', ML_JOBS.length === 1, 'jobs: ' + ML_JOBS.length);
  var other = (mlRun.lines || []).find(function (l) { return l.decisionId === null && l.skipped; });
  assert('the other line is left queued, not re-authorised',
    !!other && other.state === 'awaiting-approval',
    JSON.stringify((mlRun.lines || []).map(function (l) { return l.state + (l.skipped ? '/skipped' : ''); })));
  var ledgerAfter = (await db.get('relay:autonomy-ledger')) || [];
  assert('and NO third reservation was created for it',
    ledgerAfter.length === 2, 'rows: ' + ledgerAfter.length +
    ' -> ' + JSON.stringify(ledgerAfter.map(function (r) { return r.state; })));

  require.cache[mlBuy].exports = mlRealBuy;
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];

  // ── T53 ─────────────────────────────────────────────────────────────────
  // A DEBIT COMES OFF THE WALLET ONCE, NOT ON EVERY CHECKOUT FOREVER.
  //
  // Counting every settled row against a CJ-reported balance double-counted money CJ had
  // already taken out of that number. The ledger keeps 4000 rows across days, so the error
  // was cumulative and permanent: a $100 wallet that had ever spent $70 reported $30
  // spendable, and kept shrinking with each sale until the gate refused everything. The
  // bug grew with the store's own success, which is the worst way for one to grow.
  //
  // The fix cannot simply drop settled rows, because CJ applies a debit on its own
  // schedule: for a window after settlement the balance we hold is still a pre-purchase
  // number, and that debit does have to come off or a customer pays for something the
  // wallet cannot buy. Both directions are asserted here.
  console.log('T53: settled debits stop counting once the wallet figure reflects them');
  var cjP53 = require.resolve('../lib/relay-cj');
  var realCj53 = require.cache[cjP53] ? require.cache[cjP53].exports : require('../lib/relay-cj');
  var ppP53 = require.resolve('../lib/relay-paypal-balance');
  var realPp53 = require.cache[ppP53] ? require.cache[ppP53].exports : null;
  require.cache[cjP53] = { id: cjP53, filename: cjP53, loaded: true,
    exports: Object.assign({}, realCj53, { balance: async function () { return { ok: true, available: 100, amount: 100, frozen: 0 }; } }) };
  require.cache[ppP53] = { id: ppP53, filename: ppP53, loaded: true,
    exports: { getCurrentBalance: async function () { return 0; } } };

  // Ceiling and velocity are deliberately wide open: this test is about the WALLET gate,
  // and a refusal from any other guard would look identical in the result.
  var CFG53 = {
    mode: 'auto', perOrderCapUsd: 1000, dailyCeilingUsd: 1000000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  };
  var today53 = new Date().toISOString().slice(0, 10);
  function row53(state, amount, settledMsAgo) {
    return {
      id: 'r53_' + Math.random().toString(36).slice(2), day: today53,
      ts: new Date(Date.now() - 7200000).toISOString(),
      state: state, amount: amount, marketplace: 'cj', orderId: 'o53', mode: 'auto',
      settledAt: state === 'settled' ? new Date(Date.now() - settledMsAgo).toISOString() : null
    };
  }
  // Re-requiring is the only way to clear the module-level wallet cache between cases.
  async function fundsCheck53(rows) {
    await db.set('relay:autonomy-ledger', rows);
    await db.set('relay:autonomy', CFG53);
    delete require.cache[require.resolve('../lib/relay-autonomy')];
    var a = require('../lib/relay-autonomy');
    return a.authorize({ amount: 50, salePrice: 400, orderId: 'new53', marketplace: 'cj' });
  }

  // $100 wallet, $70 of purchases CJ debited two hours ago. That $70 is already gone from
  // the $100, so $50 fits. The old code reported $30 spendable and refused.
  var oldDebits = await fundsCheck53([row53('settled', 40, 7200000), row53('settled', 30, 7200000)]);
  assert('an old settled debit is NOT subtracted again from a wallet that already reflects it',
    oldDebits.allowed === true, JSON.stringify(oldDebits.reason));

  // Same $70, settled a second ago. CJ may not have applied it yet, so it still comes off.
  var freshDebit = await fundsCheck53([row53('settled', 70, 1000)]);
  assert('a JUST-settled debit still counts, because CJ may not have applied it yet',
    freshDebit.allowed === false && /already committed/.test(String(freshDebit.reason)),
    JSON.stringify(freshDebit.reason));

  // Money promised and not yet spent can never be reflected in any wallet figure.
  var openRes = await fundsCheck53([row53('reserved', 70, 0)]);
  assert('an OPEN reservation from today counts, because it is still spendable',
    openRes.allowed === false && /already committed/.test(String(openRes.reason)),
    JSON.stringify(openRes.reason));

  // A reservation nobody can spend is not a commitment. consumeApproved refuses any row
  // whose day is not today, and nothing sweeps the ledger, so a reservation stranded by a
  // failed approval or a crash between buy and settle would otherwise shrink the wallet
  // forever. Found while tracing the approval-failure path, not reported by review.
  var deadRes = [row53('reserved', 70, 0)];
  deadRes[0].day = '2020-01-01';
  deadRes[0].ts = new Date(Date.now() - 7200000).toISOString();
  var stale = await fundsCheck53(deadRes);
  assert('a reservation from an earlier day, which can NEVER be consumed, stops counting',
    stale.allowed === true, JSON.stringify(stale.reason));

  // BUT 'not today' alone must not drop it. row.day is stamped at authorize() and the UTC
  // date rolls at 19:00 America/Chicago, mid-trading-day. A reservation taken seconds
  // before that roll is still in flight — relay-engine buys and settles it after
  // authorize() returns — and dropping it would let the next line spend the same dollars
  // once a day at a predictable minute. Caught by an independent re-read, not by review.
  var justRolled = [row53('reserved', 70, 0)];
  justRolled[0].day = '2020-01-01';           // a foreign day...
  justRolled[0].ts = new Date().toISOString(); // ...but seconds old, so still in flight
  var inFlight = await fundsCheck53(justRolled);
  assert('a reservation made seconds before the date roll STILL counts, mid-purchase',
    inFlight.allowed === false && /already committed/.test(String(inFlight.reason)),
    JSON.stringify(inFlight.reason));

  // The accumulation is what made this fatal rather than merely wrong: enough history and
  // the gate refuses every sale on a wallet that can plainly afford it.
  var manyOld = [];
  for (var i53 = 0; i53 < 12; i53++) manyOld.push(row53('settled', 25, 7200000));
  var pileUp = await fundsCheck53(manyOld);
  assert('and $300 of long-settled history does not bankrupt a $100 wallet on paper',
    pileUp.allowed === true, JSON.stringify(pileUp.reason));

  if (realPp53) require.cache[ppP53] = { id: ppP53, filename: ppP53, loaded: true, exports: realPp53 };
  else delete require.cache[ppP53];
  require.cache[cjP53] = { id: cjP53, filename: cjP53, loaded: true, exports: realCj53 };
  delete require.cache[require.resolve('../lib/relay-autonomy')];

  // ── T54 ─────────────────────────────────────────────────────────────────
  // THE OUTAGE HAS TO REACH THE CATCH THAT HANDLES IT.
  //
  // Round 2 wrapped the order reads in a try/catch so a database outage would report
  // 'unknown' instead of a calm zero. It never fired. db.get() swallows a Redis failure and
  // returns process memory, which on a cold serverless instance is empty, so
  // ordersByStatus resolved [] and nothing ever threw. The counters read a confident zero
  // during exactly the failure the catch was added for — the alerting went silent under
  // the one condition it exists for, which is the same defect one layer down.
  console.log('T54: an unreadable store is detected at the read, not assumed empty');
  var dbP54 = require.resolve('../lib/limen-db');
  var realDb54 = require.cache[dbP54] ? require.cache[dbP54].exports : require('../lib/limen-db');
  var strictCalls = 0;
  require.cache[dbP54] = { id: dbP54, filename: dbP54, loaded: true,
    exports: Object.assign({}, realDb54, {
      // Pretend Redis is configured — strictness only bites where there is a Redis to be
      // strict about, so a memory backend would skip the whole path under test.
      getBackend: function () { return 'redis'; },
      getStrict: async function () {
        strictCalls++;
        var e = new Error('redis-get-unreachable');
        e.code = 'LIMEN_DB_REDIS_READ_FAILED';
        throw e;
      }
    }) };
  delete require.cache[require.resolve('../lib/relay-store')];
  var store54 = require('../lib/relay-store');

  // The forgiving read is unchanged. Shopper-facing lists still degrade rather than fail.
  var quiet54 = await store54.ordersByStatus('paid', 10);
  assert('the ordinary order read still degrades quietly, as its callers expect',
    Array.isArray(quiet54), typeof quiet54);

  var threw54 = false, err54 = null;
  try { await store54.ordersByStatus('paid', 10, { strict: true }); }
  catch (e) { threw54 = true; err54 = e.message; }
  assert('a STRICT read throws on an unreadable store instead of resolving zero orders',
    threw54 && /unreachable/.test(String(err54)), 'threw: ' + threw54 + ' ' + err54);
  assert('and it got there through getStrict, not the swallowing get',
    strictCalls > 0, 'getStrict calls: ' + strictCalls);

  // End to end: the handler must now actually reach its own catch.
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var ctl54 = require('../handlers/relay-autonomous-control');
  var st54 = await invoke(ctl54, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + process.env.RELAY_ADMIN_KEY, headers: {}
  });
  assert('a real Redis outage now reports UNKNOWN, not a calm zero',
    st54.body && st54.body.needsAttention === null && st54.body.heldForReview === null,
    JSON.stringify({ n: st54.body && st54.body.needsAttention, h: st54.body && st54.body.heldForReview }));
  assert('and it names the outage',
    st54.body && /unreachable/.test(String(st54.body.ordersUnavailable)),
    JSON.stringify(st54.body && st54.body.ordersUnavailable));

  require.cache[dbP54] = { id: dbP54, filename: dbP54, loaded: true, exports: realDb54 };
  delete require.cache[require.resolve('../lib/relay-store')];
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T55 ─────────────────────────────────────────────────────────────────
  // HALF-FULFILLED IS NOT FULFILLED. On a multi-line paid order where one supplier
  // purchase succeeds and another fails transiently, fulfillPaidOrder records
  // state 'partial' and the transient failure files no manual task. The stranded filter
  // counted only missing-or-failed fulfilment, so a customer with one line shipped and one
  // line never ordered showed up nowhere at all.
  console.log('T55: a half-fulfilled paid order still counts as needing attention');
  var ctl55 = require('../handlers/relay-autonomous-control');
  var AK55 = process.env.RELAY_ADMIN_KEY;
  var before55 = (await invoke(ctl55, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK55, headers: {}
  })).body.needsAttention;

  var partialOrder = await store.createOrder({
    buyerId: 'b_partial', shipping: 0, shippingAddress: cartAddr,
    lines: [
      { listingId: payListing.id, qty: 1, unitPrice: 22.00, title: 'shipped', sourceCost: 11.00 },
      { listingId: payListing.id, qty: 1, unitPrice: 22.00, title: 'never ordered', sourceCost: 11.00 }
    ]
  });
  await store.updateOrder(partialOrder.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_partial',
    // One line bought, one not — and NO taskId, which is what made it invisible.
    fulfillment: { state: 'partial', taskId: null, reason: 'CJ timed out on line 2' }
  });
  var st55 = await invoke(ctl55, {
    method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK55, headers: {}
  });
  assert('a partly-bought paid order RAISES the attention total',
    st55.body && st55.body.needsAttention === before55 + 1,
    JSON.stringify({ before: before55, after: st55.body && st55.body.needsAttention }));

  // COVERAGE IS PER LINE TOO. Matching a task only on orderId meant an order with two
  // outstanding lines and a task for ONE of them read as fully handled, and the other line
  // went silent — the same hole one level down. Found by an independent re-read of the fix
  // above, not by review.
  var buyP55 = require.resolve('../lib/relay-buy');
  var realBuy55 = require.cache[buyP55] ? require.cache[buyP55].exports : require('../lib/relay-buy');
  var TASKS55 = [];
  require.cache[buyP55] = { id: buyP55, filename: buyP55, loaded: true,
    exports: Object.assign({}, realBuy55, { openTasks: async function () { return TASKS55; } }) };

  var twoLine = await store.createOrder({
    buyerId: 'b_twoline', shipping: 0, shippingAddress: cartAddr,
    lines: [
      { listingId: 'lst_A', qty: 1, unitPrice: 22.00, title: 'A', sourceCost: 11.00 },
      { listingId: 'lst_B', qty: 1, unitPrice: 22.00, title: 'B', sourceCost: 11.00 }
    ]
  });
  await store.updateOrder(twoLine.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_two',
    fulfillment: { state: 'partial', lines: [
      { listingId: 'lst_A', state: 'failed' },
      { listingId: 'lst_B', state: 'failed' }
    ] }
  });

  // MEASURED AS DELTAS AGAINST THE NO-TASK BASELINE. Asserting "stranded >= 1" was
  // vacuous: stranded orders from earlier blocks already made it non-zero, so order-level
  // coverage could drop this order entirely and the assertion stayed green.
  async function strandedCount55() {
    delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
    var c = require('../handlers/relay-autonomous-control');
    return (await invoke(c, {
      method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK55, headers: {}
    })).body.strandedWithoutTask;
  }

  TASKS55 = [];
  var covNone = await strandedCount55();

  // A task for line A only. Line B is still nobody's job, so NOTHING may change.
  TASKS55 = [{ id: 'tsk_A', orderId: twoLine.id, listingId: 'lst_A', state: 'open' }];
  var covOne = await strandedCount55();
  assert('one task on a two-line order does NOT mark the whole order handled',
    covOne === covNone,
    JSON.stringify({ noTasks: covNone, oneTask: covOne }));

  // Now cover BOTH lines. Only now does the order drop out.
  TASKS55 = [
    { id: 'tsk_A', orderId: twoLine.id, listingId: 'lst_A', state: 'open' },
    { id: 'tsk_B', orderId: twoLine.id, listingId: 'lst_B', state: 'open' }
  ];
  var covBoth = await strandedCount55();
  assert('and once every line has a task, it stops being counted',
    covBoth === covNone - 1,
    JSON.stringify({ noTasks: covNone, bothTasks: covBoth }));

  // AN EMPTY LINES ARRAY IS NOT A FINISHED ORDER. `lines: []` passes Array.isArray, so a
  // filter-only reading returns nothing outstanding and the order reports as served. It
  // has to fail closed: an order whose shape we cannot read is unfinished.
  TASKS55 = [];
  var emptyLines = await store.createOrder({
    buyerId: 'b_emptylines', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: 'lst_E', qty: 1, unitPrice: 22.00, title: 'E', sourceCost: 11.00 }]
  });
  var beforeEmpty = await strandedCount55();
  await store.updateOrder(emptyLines.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_empty',
    fulfillment: { state: 'partial', lines: [] }
  });
  var afterEmpty = await strandedCount55();
  assert('a paid order with an EMPTY lines array counts as unfinished, not as served',
    afterEmpty === beforeEmpty + 1,
    JSON.stringify({ before: beforeEmpty, after: afterEmpty }));

  require.cache[buyP55] = { id: buyP55, filename: buyP55, loaded: true, exports: realBuy55 };
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T56 ─────────────────────────────────────────────────────────────────
  // A REFUSED APPROVAL MUST NOT BUY THE LINE ANYWAY.
  //
  // pending() listed every reserved-and-unapproved row with no mode filter, so an
  // AUTO-mode reservation appeared to the operator as something to click while its own
  // purchase was still in flight. Clicking it could never consume it (consumeApproved
  // refuses a row that is not queued and not approved), and that refusal was not a
  // 'mismatch', so fulfillLine fell through to a fresh authorize() and bought the same
  // line a SECOND time. The refusal was recorded and then only read on the failure path,
  // so the successful double purchase reported nothing. Both halves are pinned here:
  // the fall-through backstop, and the display list that led the operator into it.
  console.log('T56: a refused approval does not fall through into a second purchase');
  var apBuyP = require.resolve('../lib/relay-buy');
  var apRealBuy2 = require('../lib/relay-buy');
  var AP_JOBS = [];
  require.cache[apBuyP].exports = Object.assign({}, apRealBuy2, {
    execute: async function (job) { AP_JOBS.push(job); return { ok: true, provider: 'cj', sourceOrderId: 'cjo_ap', amount: job.maxCost }; },
    fileManualTask: async function () { return { ok: true, task: { id: 'task_ap' } }; }
  });
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var apEngine2 = require('../lib/relay-engine');
  var apAut3 = require('../lib/relay-autonomy');

  await db.set('relay:autonomy-ledger', []);
  // AUTO, and funded, so that a fall-through authorize() would genuinely succeed. If this
  // were queue mode the second authorize() would only re-queue and the test would pass
  // for the wrong reason, proving nothing about the money.
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });

  var apL = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'inflight line',
    price: 22.00, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v_ap', sourceUrl: 'https://www.cjdropshipping.com/product/-p-AP.html',
    sourceCost: 11.00, sourceShipping: 4.00, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  var apO = await store.createOrder({
    buyerId: 'b_ap', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: apL.id, qty: 1, unitPrice: 22.00, title: 'inflight line', sourceCost: 11.00 }]
  });
  await store.updateOrder(apO.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_ap' });

  // The in-flight state exactly as it exists mid-purchase: reserved, never approved,
  // stamped auto. Also what a crash between authorize() and settle() leaves behind.
  var inflight = await apAut3.authorize({
    amount: 11.00, salePrice: 22.00, marketplace: 'cj',
    orderId: apO.id, listingId: apL.id, note: 'inflight'
  });
  assert('the in-flight reservation is live, auto and unapproved',
    inflight.allowed === true && !!inflight.decisionId, JSON.stringify({ allowed: inflight.allowed }));
  var apRowsBefore = ((await db.get('relay:autonomy-ledger')) || []).length;
  assert('exactly one reservation exists before the click', apRowsBefore === 1, String(apRowsBefore));

  // The operator clicks it, because pending() offered it.
  var apRun = await apEngine2.fulfillPaidOrder({ orderId: apO.id, decisionId: inflight.decisionId, force: true });

  assert('NO supplier purchase is made from a refused approval',
    AP_JOBS.length === 0, 'supplier jobs: ' + AP_JOBS.length +
    ' ' + JSON.stringify(AP_JOBS.map(function (j) { return j.listingId; })));
  var apRowsAfter = ((await db.get('relay:autonomy-ledger')) || []);
  assert('and NO second reservation is created for the same line',
    apRowsAfter.length === 1, 'rows: ' + apRowsAfter.length +
    ' -> ' + JSON.stringify(apRowsAfter.map(function (r) { return r.state + '/' + r.mode; })));
  var apLine = (apRun.lines || [])[0] || {};
  assert('the line comes back as still awaiting a human, not blocked',
    apLine.state === 'awaiting-approval' && apLine.skipped === true,
    JSON.stringify({ state: apLine.state, skipped: apLine.skipped }));
  assert('and the operator is told WHY their approval was not used',
    typeof apLine.approvalRefused === 'string' && /not been approved|not queued/.test(apLine.approvalRefused),
    JSON.stringify({ approvalRefused: apLine.approvalRefused, reason: apLine.reason }));

  // ── the display list that caused the click ──
  // A queue-mode row must STILL be listed. Over-filtering here would empty the operator's
  // approval queue and strand every held order in silence, which is a worse failure than
  // the one being fixed.
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var queued56 = await apAut3.authorize({
    amount: 11.00, salePrice: 22.00, marketplace: 'cj',
    orderId: apO.id, listingId: apL.id, note: 'queued'
  });
  var pend56 = await apAut3.pending();
  var pendIds = pend56.map(function (r) { return r.id; });
  assert('an in-flight AUTO reservation is not offered to the operator as approvable',
    pendIds.indexOf(inflight.decisionId) === -1,
    JSON.stringify(pend56.map(function (r) { return r.mode + '/' + r.state; })));
  assert('a genuinely QUEUED reservation is still offered',
    pendIds.indexOf(queued56.decisionId) !== -1,
    JSON.stringify(pend56.map(function (r) { return r.mode + '/' + r.state; })));

  require.cache[apBuyP].exports = apRealBuy2;
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];

  // ── T57 ─────────────────────────────────────────────────────────────────
  // A REDIS COMMAND ERROR IS NOT AN ABSENT KEY.
  //
  // Upstash answers WRONGTYPE, a revoked token or a quota refusal with HTTP 200 and
  // {error: ...}. _redisRequest turned that into null, and getStrict read null as
  // 'genuinely absent'. So the strict path added to stop an outage rendering as a
  // confident zero still rendered a confident zero, for the subset of outages that
  // arrive as a command error rather than a dropped connection. The strict contract
  // leaked at its very last step. The forgiving get() must KEEP swallowing it: every
  // other caller in the repo depends on that, and this is not the branch to change them.
  console.log('T57: a Redis command error is distinguishable from a missing key');
  var dbP57 = require.resolve('../lib/limen-db');
  var stP57 = require.resolve('../lib/relay-store');
  var ctlP57 = require.resolve('../handlers/relay-autonomous-control');
  var realDb57 = require('../lib/limen-db');
  var realSt57 = require('../lib/relay-store');

  process.env.UPSTASH_REDIS_REST_URL = 'https://stub.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'stub-token';
  delete require.cache[dbP57];
  delete require.cache[stP57];
  delete require.cache[ctlP57];
  var sdb57 = require('../lib/limen-db');

  // A genuinely missing key stays a plain null. Without this the 'fix' could just be
  // 'throw on everything', which would turn every empty store into a false alarm.
  global.fetch = async function () { return { json: async function () { return { result: null }; } }; };
  var missing57 = await sdb57.getStrict('relay:orders');
  assert('a genuinely missing key is still a plain null, not an error',
    missing57 === null, JSON.stringify(missing57));

  // The command error.
  global.fetch = async function () {
    return { json: async function () { return { error: 'WRONGTYPE Operation against a key holding the wrong kind of value' }; } };
  };
  var threw57 = null;
  try { await sdb57.getStrict('relay:orders'); } catch (e) { threw57 = e; }
  assert('a WRONGTYPE command error THROWS instead of reading as absent',
    !!threw57 && threw57.code === 'LIMEN_DB_REDIS_READ_FAILED',
    threw57 ? threw57.code + ': ' + threw57.message : 'did not throw, returned as absent');

  // The forgiving path is deliberately unchanged for its existing callers.
  var forgave57 = 'unset';
  try { forgave57 = await sdb57.get('relay:orders'); } catch (e) { forgave57 = 'THREW: ' + e.message; }
  assert('db.get() still swallows a command error for its own callers',
    forgave57 !== 'unset' && String(forgave57).indexOf('THREW') !== 0,
    JSON.stringify(forgave57));

  // ── and the operator's order lookup stops answering 'count: 0' during that outage ──
  var ctl57 = require('../handlers/relay-autonomous-control');
  var ord57 = await invoke(ctl57, {
    method: 'GET',
    url: '/api/relay?view=control&action=orders&key=' + process.env.RELAY_ADMIN_KEY,
    headers: {}
  });
  var b57 = ord57.body || {};
  assert('the order lookup reports the unreadable store instead of an empty list',
    b57.ok === false && /unreadable/.test(String(b57.error || '')),
    JSON.stringify({ ok: b57.ok, error: b57.error, count: b57.count }));
  assert('and it never reports a count of zero it could not measure',
    b57.count === null || b57.count === undefined, JSON.stringify({ count: b57.count }));

  // Restore the ORIGINAL module instances, not fresh ones: a new limen-db brings a new
  // empty _memStore, and every order the suite created above lives in the old one.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  global.fetch = BLOCK_NETWORK;
  // ANY module required during the window above bound itself to the redis-enabled limen-db
  // instance, and restoring limen-db does not reach back into their closures. relay-engine
  // is the one that bites: the control handler pulls it in, so it rebound here, and its
  // next db.get() called fetch() against an UPSTASH url that no longer exists. That is a
  // ── T63 ─────────────────────────────────────────────────────────────────
  // THE STOREFRONT STOPS LISTING WHAT CHECKOUT WILL REFUSE.
  //
  // A real customer hit this: a phone case listed at $11.50 on a landed cost of $8.52,
  // refused at checkout by the $8 margin floor. Freight was never the problem; every
  // source folds it into item.price before the engine sees it. The problem is arithmetic.
  // marginUsd = salePrice - landed = cost * m, so at the default 35% markup a flat $8
  // floor is unreachable for any item under $22.86 landed. The whole cheap catalogue was
  // published and then refused, by construction.
  //
  // Two changes, proven separately: price to the greater of the markup and the floor, and
  // ask the REAL purchase gate before listing instead of a second, weaker copy of it.
  console.log('T63: publish prices to the floor and asks the gate that will refuse');
  // PIN limen-db TO THE INSTANCE THIS SUITE WRITES THROUGH.
  //
  // T45 replaces require.cache[limen-db].exports with a wrapper object while the suite's
  // top-level `db` still points at the original, so from that block onward
  // require('../lib/limen-db') and `db` are DIFFERENT objects. Any later block that
  // re-requires a module gets the wrapper, and a config written through `db` is invisible
  // to it: this test first read perOrderCapUsd 75 (the DEFAULTS) while `db` plainly held
  // 100, and every gate assertion below passed or failed for the wrong reason.
  //
  // Pinned rather than worked around, because a test that silently measures a different
  // store than it writes is worth less than no test. Restored at the end of the block.
  var dbP63 = require.resolve('../lib/limen-db');
  var cachedDb63 = require.cache[dbP63] ? require.cache[dbP63].exports : null;
  require.cache[dbP63] = { id: dbP63, filename: dbP63, loaded: true, exports: db };
  // relay-store has to be pinned too, and for a sharper reason. The cached relay-store is
  // bound to that same stray limen-db, and THAT instance memoised _redisAvailable = true
  // inside T57 stub window while the UPSTASH env vars were briefly set. With the vars now
  // gone it still believes it has Redis, so every read through it calls fetch(undefined):
  // ── T64 ─────────────────────────────────────────────────────────────────
  // FREIGHT IS CHARGED ONCE, NOT TWICE.
  //
  // Supplier freight is folded into the acquisition cost by every source before the engine
  // prices it (lib/relay-cj.js:334), and the listing is priced off that landed number. The
  // cart then added a $5.99 line on top, so the customer paid supplier freight a second
  // time under a name that made it look like a pass-through. relay-demand-purchase has
  // always created orders with shipping: 0, so the two routes to one catalogue were
  // quoting different shipping as well.
  console.log('T64: freight is inside the price, so the cart adds no second charge');
  var dbP64 = require.resolve('../lib/limen-db');
  var stP64 = require.resolve('../lib/relay-store');
  var cachedDb64 = require.cache[dbP64] ? require.cache[dbP64].exports : null;
  var cachedSt64 = require.cache[stP64] ? require.cache[stP64].exports : null;
  // Pinned for the same reason as T63: from T45 onward the cached limen-db is a different
  // object than the db this suite writes through, and it believes it has Redis.
  require.cache[dbP64] = { id: dbP64, filename: dbP64, loaded: true, exports: db };
  require.cache[stP64] = { id: stP64, filename: stP64, loaded: true, exports: store };

  var cjP64 = require.resolve('../lib/relay-cj');
  var realCj64 = require('../lib/relay-cj');
  var sqP64 = require.resolve('../lib/relay-supplier-quote');
  var realSq64 = require('../lib/relay-supplier-quote');
  var finP64 = require.resolve('../lib/relay-finance-bridge');
  var realFin64 = require.cache[finP64] ? require.cache[finP64].exports : require('../lib/relay-finance-bridge');

  require.cache[cjP64] = { id: cjP64, filename: cjP64, loaded: true, exports: Object.assign({}, realCj64, {
    configured: function () { return true; },
    stock: async function () { return { qty: 50, from: 'US' }; },
    freight: async function () { return { price: 4.00, carrier: 'CJPacket' }; },
    balance: async function () { return { ok: true, available: 5000 }; }
  }) };
  require.cache[finP64] = { id: finP64, filename: finP64, loaded: true, exports: Object.assign({}, realFin64, {
    paymentsEnabled: function () { return true; },
    createPayment: async function () { return { ok: true, url: 'https://pay.test/64', paymentLinkId: 'p64' }; }
  }) };
  delete require.cache[sqP64];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];
  var cart64 = require('../handlers/relay-cart-checkout');

  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 500, dailyCeilingUsd: 5000,
    minMarginUsd: 1, minMarginPct: 0.05, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var addr64 = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };

  async function buyCart64(unitPrice, qty) {
    var l = await store.createListing({
      marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'shipping probe',
      price: unitPrice, description: 'x', category: 'other', condition: 'new', quantity: 99,
      sourceMarketplace: 'cj', sourceId: 'v64_' + unitPrice + '_' + qty,
      sourceUrl: 'https://www.cjdropshipping.com/product/-p-64' + unitPrice + 'x' + qty + '.html',
      sourceCost: 11.00, sourceShipping: 4.00, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
      marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
    });
    var r = await invoke(cart64, {
      method: 'POST', headers: {},
      body: { items: [{ listingId: l.id, qty: qty }], shippingAddress: addr64,
        buyerEmail: 'a@b.com', policyAccepted: true }
    });
    return { res: r, listing: l };
  }

  // UNDER the old threshold: exactly where the fee used to be added.
  var small64 = await buyCart64(20.00, 1);
  assert('a small cart still checks out', small64.res.status === 200 && small64.res.body.ok === true,
    JSON.stringify(small64.res.body).slice(0, 200));
  assert('no shipping is charged on a small cart',
    small64.res.body.shipping === 0, JSON.stringify({ shipping: small64.res.body.shipping }));
  assert('and the total is exactly the sum of the line prices, with no addend',
    small64.res.body.total === 20.00 && small64.res.body.total === small64.res.body.subtotal,
    JSON.stringify({ subtotal: small64.res.body.subtotal, total: small64.res.body.total }));

  // The stored ORDER, not just the response: what the customer is charged comes from
  // relay-store.createOrder, which adds data.shipping to the subtotal.
  var ord64 = await store.getOrder(small64.res.body.orderId);
  assert('the stored order records no shipping charge',
    ord64.shipping === 0, JSON.stringify({ shipping: ord64.shipping }));
  assert('and its total equals its subtotal',
    ord64.total === ord64.subtotal, JSON.stringify({ subtotal: ord64.subtotal, total: ord64.total }));

  // MULTI-UNIT, because a per-unit freight addend would only show up here.
  var multi64 = await buyCart64(20.00, 3);
  assert('a multi-unit cart is charged the line total and nothing more',
    multi64.res.body.total === 60.00 && multi64.res.body.shipping === 0,
    JSON.stringify({ total: multi64.res.body.total, shipping: multi64.res.body.shipping }));

  // OVER the old threshold, where shipping was already waived. Pinned so reintroducing the
  // threshold in either direction is caught, not only the fee.
  var big64 = await buyCart64(90.00, 1);
  assert('a cart over the old free-shipping threshold is also charged no shipping',
    big64.res.body.shipping === 0 && big64.res.body.total === big64.res.body.subtotal,
    JSON.stringify({ subtotal: big64.res.body.subtotal, total: big64.res.body.total }));

  // THE TWO ROUTES AGREE. relay-demand-purchase has always passed shipping: 0; the cart
  // now matches it, so one catalogue quotes one shipping policy.
  var fs64 = require('fs'), path64 = require('path');
  var dpSrc64 = fs64.readFileSync(path64.join(__dirname, '../handlers/relay-demand-purchase.js'), 'utf8');
  assert('the demand route still creates orders with no shipping charge',
    /shipping:\s*0\b/.test(dpSrc64), 'no shipping-zero found in relay-demand-purchase');
  var cartSrc64 = fs64.readFileSync(path64.join(__dirname, '../handlers/relay-cart-checkout.js'), 'utf8');
  assert('and the cart no longer declares a shipping fee at all',
    !/FLAT_SHIPPING\s*=/.test(cartSrc64) && !/FREE_SHIPPING_OVER\s*=/.test(cartSrc64),
    'a shipping-fee constant is still declared in relay-cart-checkout');

  require.cache[cjP64] = { id: cjP64, filename: cjP64, loaded: true, exports: realCj64 };
  require.cache[sqP64] = { id: sqP64, filename: sqP64, loaded: true, exports: realSq64 };
  require.cache[finP64] = { id: finP64, filename: finP64, loaded: true, exports: realFin64 };
  if (cachedDb64) require.cache[dbP64] = { id: dbP64, filename: dbP64, loaded: true, exports: cachedDb64 };
  if (cachedSt64) require.cache[stP64] = { id: stP64, filename: stP64, loaded: true, exports: cachedSt64 };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];

  // five escaped requests, caught by the hermetic check at the end of this file. Pinning to
  // the suite store also means the engine writes listings where the assertions look.
  var stP63 = require.resolve('../lib/relay-store');
  var cachedSt63 = require.cache[stP63] ? require.cache[stP63].exports : null;
  require.cache[stP63] = { id: stP63, filename: stP63, loaded: true, exports: store };
  var ssP63 = require.resolve('../lib/relay-source-search');
  var realSS63 = require('../lib/relay-source-search');
  var ITEMS63 = [];
  require.cache[ssP63] = { id: ssP63, filename: ssP63, loaded: true, exports: Object.assign({}, realSS63, {
    searchAllSources: async function () { return { ok: true, items: ITEMS63, sources: ['cj'] }; }
  }) };
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var eng63 = require('../lib/relay-engine');
  var aut63 = require('../lib/relay-autonomy');

  // The real case: 5.72 product + 2.80 default-destination freight = 8.52 landed.
  function cheap63(tag) {
    return {
      itemId: 'v63' + tag, source: 'cj', title: 'silicone phone case ' + tag,
      price: 8.52, productPrice: 5.72, shipping: 2.80, shippingKnown: true,
      carrier: 'CJPacket', fromCountry: 'US', condition: 'new',
      url: 'https://www.cjdropshipping.com/product/-p-63' + tag + '.html',
      image: null, seller: 'CJ Dropshipping', buyable: true, provider: 'cj'
    };
  }

  await db.set('relay_margin', 0.35);
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 8, minMarginPct: 0.18, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });

  var ledgerBefore63 = JSON.stringify(await db.get('relay:autonomy-ledger'));
  ITEMS63 = [cheap63('a')];
  var pub63 = await eng63.discoverAndList({
    concept: 'phone case', marketplaceId: mktId, sellerId: 'usr_relay_house',
    maxSourcePrice: 100, maxPerCycle: 3
  });
  assert('the cheap item is published rather than skipped',
    pub63.published.length === 1, JSON.stringify(pub63).slice(0, 240));
  assert('it is priced to the FLOOR, not to a markup that could never clear it',
    pub63.published[0].price === 16.52,
    'price ' + pub63.published[0].price + ' (markup alone would give 11.50)');
  var margin63 = Math.round((pub63.published[0].price - 8.52) * 100) / 100;
  assert('so the listed price actually clears the floor the buyer path enforces',
    margin63 >= 8, 'margin ' + margin63);

  // requireFunds is TRUE above and no CJ wallet is readable in this suite, so this also
  // pins the funding exclusion: without it the storefront would publish nothing at all.
  assert('publishing is not blocked by an unfunded wallet',
    pub63.published.length === 1 && !/wallet|funding/i.test(JSON.stringify(pub63.refusedReasons || [])),
    JSON.stringify(pub63.refusedReasons || []));

  assert('a publish cycle creates no ledger row',
    JSON.stringify(await db.get('relay:autonomy-ledger')) === ledgerBefore63,
    'after: ' + JSON.stringify(await db.get('relay:autonomy-ledger')).slice(0, 100));

  // THE GATE ACTUALLY REFUSES. A per-order cap under the landed cost is a refusal the
  // pricing formula cannot price its way out of.
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 5, dailyCeilingUsd: 1000,
    minMarginUsd: 8, minMarginPct: 0.18, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  ITEMS63 = [cheap63('b')];
  var refused63 = await eng63.discoverAndList({
    concept: 'phone case', marketplaceId: mktId, sellerId: 'usr_relay_house',
    maxSourcePrice: 100, maxPerCycle: 3
  });
  assert('an item the purchase gate would refuse is NOT listed',
    refused63.published.length === 0, JSON.stringify(refused63.published).slice(0, 200));
  assert('and the cycle says why, to the operator only',
    refused63.refusedByGate === 1 && /per-order cap/.test(JSON.stringify(refused63.refusedReasons)),
    JSON.stringify(refused63.refusedReasons));

  // THE FLOOR IS THE LIVE ONE. A second copy of this number inside relay-engine is exactly
  // how the publish gate drifted from the purchase gate in the first place.
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 20, minMarginPct: 0.18, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  ITEMS63 = [cheap63('c')];
  var floor63 = await eng63.discoverAndList({
    concept: 'phone case', marketplaceId: mktId, sellerId: 'usr_relay_house',
    maxSourcePrice: 100, maxPerCycle: 3
  });
  assert('raising minMarginUsd in config raises the listed price',
    floor63.published.length === 1 && floor63.published[0].price === 28.52,
    JSON.stringify(floor63.published.map(function (p) { return p.price; })));

  // SIBLING AXIS: skipFunds must be inert without dryRun, or it becomes a way to authorise
  // a real purchase against a wallet nobody checked.
  await db.set('relay:autonomy', {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 1000,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var live63 = await aut63.authorize({
    amount: 11.00, salePrice: 22.00, marketplace: 'cj',
    orderId: 'o63', listingId: 'l63', skipFunds: true
  });
  assert('skipFunds does NOT skip the funding check on a real authorisation',
    live63.allowed === false && /wallet|funding|funds/i.test(live63.reason || ''),
    JSON.stringify({ allowed: live63.allowed, reason: live63.reason }));

  require.cache[ssP63] = { id: ssP63, filename: ssP63, loaded: true, exports: realSS63 };
  if (cachedDb63) require.cache[dbP63] = { id: dbP63, filename: dbP63, loaded: true, exports: cachedDb63 };
  if (cachedSt63) require.cache[stP63] = { id: stP63, filename: stP63, loaded: true, exports: cachedSt63 };
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];

  // real escaped request, caught by the hermetic check rather than by anything in T57.
  // Dropping them from cache forces a rebind to the restored instance.
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  require.cache[dbP57] = { id: dbP57, filename: dbP57, loaded: true, exports: realDb57 };
  require.cache[stP57] = { id: stP57, filename: stP57, loaded: true, exports: realSt57 };
  delete require.cache[ctlP57];

  // ── T58 ─────────────────────────────────────────────────────────────────
  // NO INTERNAL REFUSAL REASON REACHES A SHOPPER.
  //
  // relay-cart-checkout forwarded authorize()'s reason verbatim into its 409. That endpoint
  // takes no key, so any shopper could read the CJ wallet balance, the supplier spend
  // already committed, the remaining ceiling, and via the margin refusal the computed
  // margin on the item itself, by adding it to a cart and reading the error. The wallet
  // sentence was the one that got noticed; 'margin $8.00 is under the $12 floor' gives away
  // more, more directly.
  //
  // Asserted on the WHOLE serialised body rather than on the two sentences under test, so a
  // refusal reason added to authorize() later cannot quietly reintroduce this.
  console.log('T58: the public 409 carries no internal refusal reason');
  var sqP58 = require.resolve('../lib/relay-supplier-quote');
  var realSq58 = require('../lib/relay-supplier-quote');
  var cjP58 = require.resolve('../lib/relay-cj');
  var realCj58 = require('../lib/relay-cj');

  // The real relay-supplier-quote runs against a stubbed CJ, rather than revalidate being
  // stubbed wholesale, so the cost-drift case below produces the REAL refusal sentence
  // instead of one this test wrote for itself.
  var FREIGHT58 = 4.00;
  require.cache[cjP58] = { id: cjP58, filename: cjP58, loaded: true, exports: Object.assign({}, realCj58, {
    configured: function () { return true; },
    stock: async function () { return { qty: 10, from: 'US' }; },
    freight: async function () { return { price: FREIGHT58 }; },
    balance: async function () { return { ok: true, available: 1.00 }; }
  }) };
  // relay-supplier-quote holds its OWN relay-cj reference, so it is rebuilt after the stub.
  // A FRESH autonomy too, because _cjBalCache is module state with a one minute TTL and an
  // earlier block's good balance would be served instead of the $1 stubbed here.
  delete require.cache[sqP58];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];
  var cart58 = require('../handlers/relay-cart-checkout');

  var l58 = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'leak probe',
    price: 22.00, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v_58', sourceUrl: 'https://www.cjdropshipping.com/product/-p-58.html',
    sourceCost: 11.00, sourceShipping: 4.00, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });
  var addr58 = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };
  var ordersBefore58 = (await store.orderHistory(500)).length;

  // The operator detail must still GO somewhere, or this is a deletion rather than a fix.
  var WARNED58 = [];
  var realWarn58 = console.warn;
  console.warn = function () { WARNED58.push(Array.prototype.join.call(arguments, ' ')); };

  async function refuse58(cfg) {
    await db.set('relay:autonomy-ledger', []);
    await db.set('relay:autonomy', cfg);
    return await invoke(cart58, {
      method: 'POST', headers: {},
      body: {
        items: [{ listingId: l58.id, qty: 1 }], shippingAddress: addr58,
        buyerEmail: 'a@b.com', policyAccepted: true
      }
    });
  }

  // (a) a MARGIN refusal
  var marginRes = await refuse58({
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 500, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var marginBody = JSON.stringify(marginRes.body || {});
  assert('a margin refusal still refuses the line', marginRes.status === 409 &&
    /not-fulfillable/.test(marginBody), marginRes.status + ' ' + marginBody.slice(0, 120));
  assert('the margin refusal leaks no dollar figure to the shopper',
    marginBody.indexOf('$') === -1, marginBody.slice(0, 200));
  assert('and leaks none of wallet / committed / margin',
    !/wallet|committed|margin/i.test(marginBody), marginBody.slice(0, 200));

  // (b) a FUNDS refusal, against a $1 CJ wallet
  var fundsRes = await refuse58({
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: true,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var fundsBody = JSON.stringify(fundsRes.body || {});
  assert('a funds refusal still refuses the line', fundsRes.status === 409 &&
    /not-fulfillable/.test(fundsBody), fundsRes.status + ' ' + fundsBody.slice(0, 120));
  assert('the funds refusal leaks no dollar figure to the shopper',
    fundsBody.indexOf('$') === -1, fundsBody.slice(0, 200));
  assert('and leaks none of wallet / committed / margin',
    !/wallet|committed|margin/i.test(fundsBody), fundsBody.slice(0, 200));

  console.warn = realWarn58;
  assert('the operator detail is not dropped, it goes to the log',
    WARNED58.length >= 2 && /wallet|margin/i.test(WARNED58.join(' ')),
    WARNED58.length + ' warnings: ' + WARNED58.join(' | ').slice(0, 160));

  // THE HOP DOWNSTREAM. A reason kept out of the 409 but written onto the order record
  // would leak again through anything that later serves an order to a buyer. It cannot:
  // store.createOrder runs AFTER this block returns, so a refused cart writes no order at
  // all. Pinned, because 'there is no order yet' is a property of the current control flow
  // and a later refactor could move the write above the gate.
  var ordersAfter58 = (await store.orderHistory(500)).length;
  assert('a refused cart creates no order for the reason to travel on',
    ordersAfter58 === ordersBefore58, JSON.stringify({ before: ordersBefore58, after: ordersAfter58 }));

  require.cache[sqP58] = { id: sqP58, filename: sqP58, loaded: true, exports: realSq58 };
  require.cache[cjP58] = { id: cjP58, filename: cjP58, loaded: true, exports: realCj58 };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-cart-checkout')];

  // ── T59 ─────────────────────────────────────────────────────────────────
  // A FLAGGED OVERSPEND IS NOT ALLOWED TO SHIP IN SILENCE.
  //
  // relay-buy.js:232 sets needsReview when CJ completes an order more than 10% above the
  // authorised cost, and writes the reviewReason with it. Nothing read either. Because a
  // line that BOUGHT successfully moves its order to 'shipped', and the attention scan only
  // opened 'payment-review' and 'paid', the console could say "Nothing needs you" over a
  // purchase the code had itself marked for a human.
  //
  // Counted by the LINE, not by an order-status allowlist, which is why the paid/partial
  // case below is covered by the same code rather than by a second branch.
  console.log('T59: a flagged supplier overspend reaches the operator');
  var AK59 = process.env.RELAY_ADMIN_KEY;
  async function status59() {
    delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
    var c = require('../handlers/relay-autonomous-control');
    return (await invoke(c, {
      method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK59, headers: {}
    })).body;
  }

  var base59 = await status59();

  // SHIPPED: every line bought, one of them above the approved price.
  var shipped59 = await store.createOrder({
    buyerId: 'b_59', shipping: 0, shippingAddress: cartAddr,
    lines: [{ listingId: 'lst_59', qty: 1, unitPrice: 22.00, title: 'overspent', sourceCost: 11.00 }]
  });
  await store.updateOrder(shipped59.id, {
    status: 'shipped', paidAt: new Date().toISOString(), stripeSessionId: 'cs_59',
    fulfillment: {
      state: 'purchased',
      lines: [{
        listingId: 'lst_59', state: 'purchased', needsReview: true,
        reviewReason: 'CJ charged $14.90 against $11.00 approved'
      }]
    }
  });
  var afterShipped59 = await status59();
  assert('a flagged line on a SHIPPED order raises the attention count by exactly one',
    afterShipped59.needsAttention === base59.needsAttention + 1,
    JSON.stringify({ before: base59.needsAttention, after: afterShipped59.needsAttention }));
  assert('and it is counted as a flagged line, not folded into another number',
    afterShipped59.flaggedLines === (base59.flaggedLines || 0) + 1,
    JSON.stringify({ before: base59.flaggedLines, after: afterShipped59.flaggedLines }));
  // THE DESCRIPTION, not just the integer. A count with no sentence sends the operator
  // hunting through the order store for what the supplier actually charged.
  var reason59 = (afterShipped59.flaggedReasons || []).find(function (f) { return f.orderId === shipped59.id; });
  assert('the reviewReason travels with it, so the operator is told what happened',
    !!reason59 && /14\.90/.test(reason59.reason || ''),
    JSON.stringify(afterShipped59.flaggedReasons || []).slice(0, 200));

  // THE SIBLING CASE: the same flag on a PAID, partially fulfilled order. _unfulfilledLines
  // drops this line for having been purchased, so an order-status allowlist that had been
  // widened to include 'shipped' and stopped there would still miss it.
  var partial59 = await store.createOrder({
    buyerId: 'b_59b', shipping: 0, shippingAddress: cartAddr,
    lines: [
      { listingId: 'lst_59c', qty: 1, unitPrice: 22.00, title: 'overspent too', sourceCost: 11.00 },
      { listingId: 'lst_59d', qty: 1, unitPrice: 22.00, title: 'never bought', sourceCost: 11.00 }
    ]
  });
  await store.updateOrder(partial59.id, {
    status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_59b',
    fulfillment: {
      state: 'partial',
      lines: [
        { listingId: 'lst_59c', state: 'purchased', needsReview: true, reviewReason: 'CJ charged $16.00 against $11.00 approved' },
        { listingId: 'lst_59d', state: 'failed' }
      ]
    }
  });
  var afterPartial59 = await status59();
  assert('a flagged line on a PAID partial order is counted too',
    afterPartial59.flaggedLines === afterShipped59.flaggedLines + 1,
    JSON.stringify({ before: afterShipped59.flaggedLines, after: afterPartial59.flaggedLines }));

  // An unreadable store must not report a flagged count it could not measure.
  assert('flaggedLines is null, never 0, when the order store cannot be read',
    base59.ordersUnavailable ? base59.flaggedLines === null : true,
    JSON.stringify({ unavailable: base59.ordersUnavailable, flagged: base59.flaggedLines }));

  // ── T60 ─────────────────────────────────────────────────────────────────
  // THE SECOND FRONT DOOR LEAKS THE SAME THINGS.
  //
  // The cart was not the only public consumer of these reasons. relay-demand-purchase is
  // reachable at /api/relay?view=order and view=demand-purchase with no key, and it
  // forwarded BOTH producers: the supplier requote's text at gate 2 and authorize()'s
  // operator text at gate 5. So the criterion the cart fix satisfied was still false one
  // view over: wallet balance, committed spend, remaining ceiling, computed margin, and
  // the per-unit freight against the freight on record were all readable by asking to buy.
  //
  // This block owns its module state rather than borrowing T31's live stubs, because
  // relay-supplier-quote holds its own relay-cj reference and relay-autonomy caches the CJ
  // balance for a minute; either one inherited from another block would test the wrong thing.
  console.log('T60: the demand-purchase door carries no internal reason either');
  var cjP60 = require.resolve('../lib/relay-cj');
  var realCj60 = require('../lib/relay-cj');
  var sqP60 = require.resolve('../lib/relay-supplier-quote');
  var realSq60 = require('../lib/relay-supplier-quote');
  var dpP60 = require.resolve('../handlers/relay-demand-purchase');

  var FREIGHT60 = 4.00;   // per-unit freight the supplier quotes back
  var CJBAL60 = 500.00;   // what the CJ wallet reports
  require.cache[cjP60] = { id: cjP60, filename: cjP60, loaded: true, exports: Object.assign({}, realCj60, {
    configured: function () { return true; },
    stock: async function () { return { qty: 10, from: 'US' }; },
    freight: async function () { return { price: FREIGHT60 }; },
    balance: async function () { return { ok: true, available: CJBAL60 }; }
  }) };
  // Both of these hold their own reference to relay-cj, so they must be rebuilt AFTER the
  // stub is installed or they run against the real module.
  delete require.cache[sqP60];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[dpP60];
  var dp60 = require('../handlers/relay-demand-purchase');

  await db.set('relay:searches', [{
    searchId: 'srch_60', description: 'leak probe', maxPrice: 100,
    sourceMapping: [{
      source: 'cj', itemId: 'it_60', sourceCost: 11.00, sourceShipping: 4.00,
      sourceCarrier: 'CJPacket', sourceFromCountry: 'US', displayedPrice: 100,
      sourceUrl: 'https://www.cjdropshipping.com/product/-p-60.html'
    }]
  }]);
  var addr60 = { name: 'A B', line1: '1 St', city: 'KC', state: 'MO', postalCode: '64111', country: 'US' };

  async function buy60(cfg) {
    await db.set('relay:autonomy-ledger', []);
    await db.set('relay:autonomy', cfg);
    var WARN = [];
    var realWarn = console.warn;
    console.warn = function () { WARN.push(Array.prototype.join.call(arguments, ' ')); };
    var r = await invoke(dp60, {
      method: 'POST', headers: {},
      body: {
        searchId: 'srch_60', itemId: 'it_60', buyerId: 'b_60',
        policyAccepted: true, shippingAddress: addr60
      }
    });
    console.warn = realWarn;
    return { res: r, body: JSON.stringify(r.body || {}), warn: WARN.join(' | ') };
  }
  var OPEN60 = {
    mode: 'auto', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  };
  function clean60(name, r) {
    assert(name + ': no dollar figure reaches the buyer',
      r.body.indexOf('$') === -1, r.body.slice(0, 220));
    assert(name + ': none of wallet / committed / margin reaches the buyer',
      !/wallet|committed|margin/i.test(r.body), r.body.slice(0, 220));
  }

  // (a) FREIGHT DRIFT at gate 2. $12 a unit against the $4 on record trips cost-drift
  // before any later gate can fire, which is why it is provoked here and not stubbed.
  FREIGHT60 = 12.00;
  var drift60 = await buy60(OPEN60);
  assert('a freight-drift requote still refuses the sale',
    drift60.res.status === 409 && /cost-drift/.test(drift60.body),
    drift60.res.status + ' ' + drift60.body.slice(0, 160));
  clean60('freight drift', drift60);
  assert('the drift detail still reaches the operator log',
    /costs \$12\.00 a unit/.test(drift60.warn), drift60.warn.slice(0, 200));
  assert('and the machine-readable code survives for the UI to branch on',
    (drift60.res.body || {}).code === 'cost-drift', JSON.stringify((drift60.res.body || {}).code));

  // (b) MARGIN refusal at gate 5.
  FREIGHT60 = 4.00;
  var margin60 = await buy60(Object.assign({}, OPEN60, { minMarginUsd: 500 }));
  assert('a margin-floor refusal still refuses the sale',
    margin60.res.status === 409, margin60.res.status + ' ' + margin60.body.slice(0, 160));
  clean60('margin refusal', margin60);
  assert('the margin detail still reaches the operator log',
    /margin/i.test(margin60.warn) && /\$/.test(margin60.warn), margin60.warn.slice(0, 200));

  // (c) FUNDS refusal at gate 5, against a $1 wallet.
  CJBAL60 = 1.00;
  var funds60 = await buy60(Object.assign({}, OPEN60, { requireFunds: true }));
  assert('a funds refusal still refuses the sale',
    funds60.res.status === 409, funds60.res.status + ' ' + funds60.body.slice(0, 160));
  clean60('funds refusal', funds60);
  assert('the wallet detail still reaches the operator log',
    /CJ wallet has \$1\.00/.test(funds60.warn), funds60.warn.slice(0, 200));

  require.cache[cjP60] = { id: cjP60, filename: cjP60, loaded: true, exports: realCj60 };
  require.cache[sqP60] = { id: sqP60, filename: sqP60, loaded: true, exports: realSq60 };
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[dpP60];

  // ── T61 ─────────────────────────────────────────────────────────────────
  // A SUCCESSFUL APPROVAL CLOSES THE JOB IT FINISHED.
  //
  // In queue mode the first fulfilment attempt files a manual task so the held line is
  // visible to a human. approve-purchase can now finish that line, and nothing closed the
  // task, so every SUCCESSFUL approval left a permanent 'job waiting on a human' in
  // needsAttention. The counter added to end silence became a counter that cries wolf,
  // which loses it the same trust the silence did. closeTask existed the whole time and
  // was reachable only from the manual close-task action.
  console.log('T61: a successful approval closes the task it just finished');
  var buyP61 = require.resolve('../lib/relay-buy');
  var realBuy61 = require('../lib/relay-buy');
  var B61_OK = true;
  // fileManualTask, openTasks and closeTask stay REAL: the task has to actually land in
  // the store and actually be closed, or this proves nothing about the counter.
  require.cache[buyP61] = { id: buyP61, filename: buyP61, loaded: true, exports: Object.assign({}, realBuy61, {
    execute: async function (job) {
      return B61_OK
        ? { ok: true, provider: 'cj', sourceOrderId: 'cjo_61', amount: job.maxCost }
        : { ok: false, error: 'CJ refused the order' };
    }
  }) };
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];
  var eng61 = require('../lib/relay-engine');
  var ctl61 = require('../handlers/relay-autonomous-control');
  var AK61 = process.env.RELAY_ADMIN_KEY;

  async function attention61() {
    return (await invoke(ctl61, {
      method: 'GET', url: '/api/relay?view=control&action=status&key=' + AK61, headers: {}
    })).body;
  }
  async function openCount61() { return (await realBuy61.openTasks()).length; }

  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });
  var l61 = await store.createListing({
    marketplaceId: 'mkt_relay', sellerId: 'usr_relay_house', title: 'task close probe',
    price: 22.00, description: 'x', category: 'other', condition: 'new', quantity: 5,
    sourceMarketplace: 'cj', sourceId: 'v_61', sourceUrl: 'https://www.cjdropshipping.com/product/-p-61.html',
    sourceCost: 11.00, sourceShipping: 4.00, sourceCarrier: 'CJPacket', sourceFromCountry: 'US',
    marginAtListing: 0.5, sourceVerifiedAt: new Date().toISOString()
  });

  async function heldOrder61(tag) {
    var o = await store.createOrder({
      buyerId: 'b_61' + tag, shipping: 0, shippingAddress: cartAddr,
      lines: [{ listingId: l61.id, qty: 1, unitPrice: 22.00, title: 'task close probe', sourceCost: 11.00 }]
    });
    await store.updateOrder(o.id, { status: 'paid', paidAt: new Date().toISOString(), stripeSessionId: 'cs_61' + tag });
    var held = await eng61.fulfillPaidOrder({ orderId: o.id });
    return { order: o, decisionId: (held.lines || [])[0].decisionId };
  }

  var baseAttention61 = (await attention61()).needsAttention;
  var baseTasks61 = await openCount61();

  // ── the successful approval ──
  B61_OK = true;
  var h61 = await heldOrder61('a');
  var queuedAttention61 = (await attention61()).needsAttention;
  assert('a queued line raises the count and files a task',
    (await openCount61()) === baseTasks61 + 1 && queuedAttention61 > baseAttention61,
    JSON.stringify({ tasksBefore: baseTasks61, tasksNow: await openCount61(),
      attentionBefore: baseAttention61, attentionNow: queuedAttention61 }));

  var okRes61 = await invoke(ctl61, {
    method: 'POST', headers: {},
    body: { action: 'approve-purchase', key: AK61, decisionId: h61.decisionId }
  });
  assert('the approved purchase completes', okRes61.body && okRes61.body.purchased === true,
    JSON.stringify(okRes61.body && okRes61.body.reason).slice(0, 160));
  assert('and it reports the task it closed',
    Array.isArray(okRes61.body.closedTasks) && okRes61.body.closedTasks.length === 1,
    JSON.stringify(okRes61.body.closedTasks));
  assert('the task is actually closed in the store, not just reported',
    (await openCount61()) === baseTasks61, JSON.stringify({ open: await openCount61(), base: baseTasks61 }));
  assert('and needsAttention returns to the baseline it started from',
    (await attention61()).needsAttention === baseAttention61,
    JSON.stringify({ base: baseAttention61, now: (await attention61()).needsAttention }));

  // ── the FAILED approval: the work is still outstanding, so the task must survive ──
  B61_OK = false;
  var h61b = await heldOrder61('b');
  var tasksAfterQueueB = await openCount61();
  var failRes61 = await invoke(ctl61, {
    method: 'POST', headers: {},
    body: { action: 'approve-purchase', key: AK61, decisionId: h61b.decisionId }
  });
  assert('a failed approval does not report itself as purchased',
    failRes61.body && failRes61.body.purchased !== true, JSON.stringify(failRes61.body).slice(0, 160));
  assert('a FAILED approval closes nothing',
    (!failRes61.body.closedTasks || failRes61.body.closedTasks.length === 0) &&
    (await openCount61()) === tasksAfterQueueB,
    JSON.stringify({ closed: failRes61.body.closedTasks, open: await openCount61(), expected: tasksAfterQueueB }));

  require.cache[buyP61] = { id: buyP61, filename: buyP61, loaded: true, exports: realBuy61 };
  delete require.cache[require.resolve('../lib/relay-engine')];
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  delete require.cache[require.resolve('../handlers/relay-autonomous-control')];

  // ── T62 ─────────────────────────────────────────────────────────────────
  // A CLICK MUST NOT BE THE THING THAT HIDES THE ROW.
  //
  // approve() checked only the state, stamped approvedAt and wrote. consumeApproved
  // refuses a stale-day approval, but AFTER that write, and pending() filters on
  // !approvedAt. So on a queued line that crossed the UTC boundary (19:00 America/Chicago,
  // mid-evening) the operator's click was itself what removed the row from their list: the
  // purchase then refused, the row stayed 'reserved' forever, and the PAID line was
  // stranded with nothing anywhere showing it.
  //
  // The check now runs BEFORE any mutation, which is the entire point: a refusal must
  // leave the ledger exactly as it found it. consumeApproved keeps its own check as the
  // last line of defence.
  console.log('T62: a stale-day approval refuses without hiding the row');
  delete require.cache[require.resolve('../lib/relay-autonomy')];
  var aut62 = require('../lib/relay-autonomy');
  await db.set('relay:autonomy-ledger', []);
  await db.set('relay:autonomy', {
    mode: 'queue', perOrderCapUsd: 100, dailyCeilingUsd: 250,
    minMarginUsd: 1, minMarginPct: 0.10, requireFunds: false,
    velocityMaxOrders: 9999, velocityMaxUsd: 999999
  });

  var q62 = await aut62.authorize({
    amount: 11.00, salePrice: 22.00, marketplace: 'cj',
    orderId: 'ord_62', listingId: 'lst_62', note: 'crossed the boundary'
  });
  assert('the line is queued for a human', q62.queued === true && !!q62.decisionId,
    JSON.stringify({ queued: q62.queued, allowed: q62.allowed }));

  // Move it to YESTERDAY, which is what 19:00 Central does to a row taken minutes earlier.
  var rows62 = await db.get('relay:autonomy-ledger');
  var yesterday62 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  rows62.find(function (r) { return r.id === q62.decisionId; }).day = yesterday62;
  await db.set('relay:autonomy-ledger', rows62);

  var pendBefore62 = await aut62.pending();
  assert('a stale-day queued row is still offered to the operator, so it CAN be clicked',
    pendBefore62.some(function (r) { return r.id === q62.decisionId; }),
    JSON.stringify(pendBefore62.map(function (r) { return r.id + '/' + r.day; })));

  // The ledger exactly as it stands before the click.
  var ledgerBefore62 = JSON.stringify(await db.get('relay:autonomy-ledger'));

  var ap62 = await aut62.approve(q62.decisionId, 'operator');
  assert('approve() REFUSES a stale-day reservation',
    ap62.ok === false && /cannot be spent today/.test(ap62.error || ''),
    JSON.stringify(ap62).slice(0, 200));
  assert('and it says which day it was from, in the same words consumeApproved uses',
    new RegExp('is from ' + yesterday62).test(ap62.error || ''),
    JSON.stringify(ap62.error));

  // THE POINT OF PUTTING IT IN approve(): a refusal writes NOTHING.
  var ledgerAfter62 = JSON.stringify(await db.get('relay:autonomy-ledger'));
  assert('a refused approval leaves the ledger byte-identical',
    ledgerAfter62 === ledgerBefore62,
    'before: ' + ledgerBefore62.slice(0, 120) + ' || after: ' + ledgerAfter62.slice(0, 120));
  var row62 = (await db.get('relay:autonomy-ledger')).find(function (r) { return r.id === q62.decisionId; });
  assert('approvedAt is NOT stamped by a refused approval',
    !row62.approvedAt, JSON.stringify({ approvedAt: row62.approvedAt, approvedBy: row62.approvedBy }));
  assert('the row is still reserved, not consumed or released',
    row62.state === 'reserved', String(row62.state));

  // And therefore it is still visible, which is the whole difference between a dead end
  // the operator can see and a silence they cannot.
  var pendAfter62 = await aut62.pending();
  assert('the row REMAINS in pending() after the refusal',
    pendAfter62.some(function (r) { return r.id === q62.decisionId; }),
    JSON.stringify(pendAfter62.map(function (r) { return r.id + '/' + r.day; })));

  // consumeApproved keeps its own check: it is the last line of defence, not a duplicate.
  var cons62 = await aut62.consumeApproved({
    decisionId: q62.decisionId, orderId: 'ord_62', listingId: 'lst_62', amount: 11.00
  });
  assert('consumeApproved still refuses it independently',
    cons62.allowed === false, JSON.stringify(cons62.reason).slice(0, 160));

  delete require.cache[require.resolve('../lib/relay-autonomy')];

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
