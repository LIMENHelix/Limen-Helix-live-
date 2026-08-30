/**
 * api/relay-checkout — turn a Relay cart into a real Stripe payment.
 *
 * POST { items: [{ id, qty }], policyAccepted: true }
 *   → recompute the authoritative total from the LIVE feed (never trust the client's
 *     price), create a Stripe payment link via LIMEN's stripe-rail (tagged streamId
 *     'relay'), and return { ok, url, total }.
 *   → Stripe's webhook books the income to the finance ledger as a 'relay' stream.
 *
 * This is the checkout used by the ORIGINAL Relay storefront, which is a separate Vercel
 * project (broker-one-tau.vercel.app) posting here cross-origin.
 *
 * ── FULFILMENT GUARD, added 2026-08-30 ──────────────────────────────────────────────
 * This route would mint a real Stripe payment link for anything in that feed, and the
 * feed currently serves DummyJSON demo products: a test catalogue of cosmetics that no
 * one stocks, that has no source URL on any item, and that therefore cannot be bought or
 * shipped by a machine OR by a human. Stripe is configured on this project, so the only
 * thing standing between a customer and paying for a mascara that does not exist was
 * nobody having tried.
 *
 * The feed already distinguishes the two cases for us: it reports source 'ebay' for real
 * marketplace supply and 'sample' for the demo catalogue. So checkout is refused unless
 * the supply is real. Set RELAY_ALLOW_DEMO_CHECKOUT=1 to override, which is for testing
 * the payment path deliberately, not for running a store.
 *
 * This closes the hole for BOTH storefronts at once, because both of them get their
 * money through this one route.
 *
 * STILL MISSING, and why this route does not create an order: the storefront collects no
 * shipping address, and createPaymentLink does not ask Stripe for one. A payment through
 * here lands in the ledger with no address and no order record, so there is nothing to
 * ship to even when the supply is real. Wire address collection before turning real
 * supply on. /api/relay-demand-purchase is the route that already does this properly.
 */

// Money goes through the one seam, never straight to the rail. See lib/relay-finance-bridge.
var finance = require('../lib/relay-finance-bridge');
var policy = require('../lib/relay-policy');

var FEED_URL = process.env.RELAY_FEED_URL || 'https://broker-one-tau.vercel.app/api/feed';
var ALLOW_DEMO = process.env.RELAY_ALLOW_DEMO_CHECKOUT === '1';

// Supply we can actually obtain. 'sample' is DummyJSON test data; 'error' is a broken
// feed. Neither can be fulfilled, so neither may be sold.
var FULFILLABLE_SOURCES = ['ebay'];

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  if (!finance.paymentsEnabled()) return sendJSON(res, 200, { ok: false, error: 'payments not enabled yet', needsKey: true });

  var body = await readBody(req);
  var items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return sendJSON(res, 400, { ok: false, error: 'empty cart' });

  // ── final-sale confirmation, same rule as every other Relay checkout ──
  if (body.policyAccepted !== true) {
    var p = policy.getPolicy();
    return sendJSON(res, 400, {
      ok: false,
      error: 'policy not accepted',
      policy: { version: p.version, headline: p.headline, confirmLabel: p.confirmLabel, url: '/api/relay-policy' }
    });
  }

  // Authoritative prices from the live feed (with the LIMEN-set margin already applied).
  var feed;
  try {
    var r = await fetch(FEED_URL);
    feed = await r.json();
  } catch (e) { return sendJSON(res, 502, { ok: false, error: 'could not load catalog' }); }

  // ── fulfilment guard ──
  var source = (feed && feed.source) || 'unknown';
  if (FULFILLABLE_SOURCES.indexOf(source) === -1 && !ALLOW_DEMO) {
    return sendJSON(res, 409, {
      ok: false,
      error: 'not available for purchase',
      message: 'This catalogue is running on demonstration data, so these items cannot be ' +
               'sourced or shipped. Nothing has been charged.',
      supplySource: source,
      fulfillable: false
    });
  }

  var priceMap = {}, urlMap = {};
  (feed.items || []).forEach(function (i) { priceMap[i.id] = i.price; urlMap[i.id] = i.url; });

  var subtotal = 0, count = 0, unsourceable = [];
  items.forEach(function (it) {
    var p2 = priceMap[it.id];
    var q = Math.max(1, parseInt(it.qty || 1, 10));
    if (typeof p2 !== 'number') return;
    // An item with no source URL cannot be bought from anyone, at any price.
    if (!urlMap[it.id] && !ALLOW_DEMO) { unsourceable.push(it.id); return; }
    subtotal += p2 * q;
    count += q;
  });

  if (unsourceable.length) {
    return sendJSON(res, 409, {
      ok: false,
      error: 'not available for purchase',
      message: 'Some items in the cart have no source listing and cannot be fulfilled. ' +
               'Nothing has been charged.',
      unsourceable: unsourceable
    });
  }
  if (subtotal <= 0) return sendJSON(res, 400, { ok: false, error: 'no valid items in cart' });

  var ship = subtotal > 75 ? 0 : 5.99;
  var total = Math.round((subtotal + ship) * 100) / 100;

  var orderRef = 'legacy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  var payment = await finance.createPayment({
    name: 'Relay order · ' + count + ' item' + (count === 1 ? '' : 's'),
    amount: total,
    orderId: orderRef,
    metadata: { surface: 'legacy-storefront', items: String(count) }
  });
  if (!payment.ok) return sendJSON(res, 200, { ok: false, error: payment.error, needsKey: payment.needsKey || false });

  var acceptance = await policy.recordAcceptance({
    accepted: true,
    buyerId: body.buyerId || null,
    orderId: orderRef,
    ip: policy.clientIp(req),
    userAgent: (req.headers && req.headers['user-agent']) || null
  });
  if (!acceptance.ok) {
    return sendJSON(res, 500, { ok: false, error: 'could not record the policy confirmation: ' + acceptance.error });
  }

  return sendJSON(res, 200, {
    ok: true,
    url: payment.url,
    total: total,
    orderRef: orderRef,
    policyVersion: acceptance.acceptance.policyVersion
  });
};
