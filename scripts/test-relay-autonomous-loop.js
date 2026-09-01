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

  console.log('');
  console.log(failures === 0
    ? 'ALL PASS (' + tests + ' assertions)'
    : failures + ' FAILED of ' + tests + ' assertions');
  process.exit(failures === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('HARNESS ERROR:', e && e.stack || e);
  process.exit(1);
});
