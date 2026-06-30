/**
 * api/relay-checkout — turn a Relay cart into a real Stripe payment.
 *
 * POST { items: [{ id, qty }] }
 *   → recompute the authoritative total from the LIVE feed (never trust the
 *     client's price), create a Stripe payment link via LIMEN's stripe-rail
 *     (tagged streamId 'relay'), and return { ok, url, total }.
 *   → the customer pays at that link; Stripe's webhook
 *     (/api/capital-engine?action=stripe-webhook) books the income to the
 *     finance ledger as a 'relay' income stream.
 *
 * Needs STRIPE_SECRET_KEY in the project env. Until it's set, returns a clean
 * "payments not enabled yet" so the storefront can message it.
 */

var stripe = require('../lib/stripe-rail');

var FEED_URL = process.env.RELAY_FEED_URL || 'https://broker-one-tau.vercel.app/api/feed';

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

  // Gated diagnostic: which Stripe account + mode does the env key belong to?
  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if ((req.method || 'GET') === 'GET' && q.account != null) {
    if (q.account !== (process.env.RELAY_MARGIN_KEY || 'limen-relay')) return sendJSON(res, 403, { error: 'forbidden' });
    var k = process.env.STRIPE_SECRET_KEY || '';
    var mode = k.indexOf('sk_live') === 0 ? 'LIVE' : k.indexOf('sk_test') === 0 ? 'TEST' : 'unknown';
    if (!k) return sendJSON(res, 200, { hasKey: false });
    try {
      var ar = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: 'Bearer ' + k } });
      var a = await ar.json();
      return sendJSON(res, 200, {
        hasKey: true, mode: mode, account_id: a.id || null,
        name: (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) ||
              (a.business_profile && a.business_profile.name) || a.email || null
      });
    } catch (e) { return sendJSON(res, 200, { hasKey: true, mode: mode, error: String(e && e.message) }); }
  }

  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  if (!stripe.hasKey()) return sendJSON(res, 200, { ok: false, error: 'payments not enabled yet', needsKey: true });

  var body = await readBody(req);
  var items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return sendJSON(res, 400, { ok: false, error: 'empty cart' });

  // Authoritative prices from the live feed (with the LIMEN-set margin already applied).
  var priceMap = {};
  try {
    var r = await fetch(FEED_URL);
    var j = await r.json();
    (j.items || []).forEach(function (i) { priceMap[i.id] = i.price; });
  } catch (e) { return sendJSON(res, 502, { ok: false, error: 'could not load catalog' }); }

  var subtotal = 0, count = 0;
  items.forEach(function (it) {
    var p = priceMap[it.id];
    var q = Math.max(1, parseInt(it.qty || 1, 10));
    if (typeof p === 'number') { subtotal += p * q; count += q; }
  });
  if (subtotal <= 0) return sendJSON(res, 400, { ok: false, error: 'no valid items in cart' });

  var ship = subtotal > 75 ? 0 : 5.99;
  var total = Math.round((subtotal + ship) * 100) / 100;

  var link = await stripe.createPaymentLink({
    name: 'Relay order · ' + count + ' item' + (count === 1 ? '' : 's'),
    amount: total,
    streamId: 'relay',
    currency: 'usd'
  });
  if (!link.ok) return sendJSON(res, 200, { ok: false, error: link.error });
  return sendJSON(res, 200, { ok: true, url: link.url, total: total });
};
