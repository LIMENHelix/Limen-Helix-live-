/**
 * api/relay-cart-checkout — a whole cart becomes one order and one payment.
 *
 * POST {
 *   items: [{ listingId, qty }],
 *   buyerId?, buyerEmail,
 *   shippingAddress: { name, line1, line2?, city, state, postalCode, country },
 *   policyAccepted: true
 * }
 *   → { ok, orderId, total, url }
 *
 * WHY A SEPARATE ROUTE FROM relay-marketplace-checkout: that one sells exactly one
 * listing. The storefront has a cart, and a cart of second-hand goods is several
 * distinct items from several different source sellers. Splitting it into one order per
 * item would charge the customer several times for one basket, so the order carries
 * `lines` and fulfilment authorises and buys each line on its own.
 *
 * EVERY PRICE IS RECOMPUTED HERE from the stored listing. The client sends listing ids
 * and quantities, never prices. Shipping matches the original Relay storefront: free
 * over $75, otherwise $5.99.
 *
 * THREE REFUSALS, all before any money is involved:
 *   - no final-sale confirmation
 *   - an incomplete shipping address (we cannot ship to a partial address, and eBay's
 *     order API rejects one outright)
 *   - a listing that is inactive, missing, or has no source we could buy it from
 */

const store = require('../lib/relay-store');
const policy = require('../lib/relay-policy');
// The ONLY money call in this file. Relay never imports stripe-rail or finance-ledger
// directly; see the seam described in lib/relay-finance-bridge.js.
const finance = require('../lib/relay-finance-bridge');


const FREE_SHIPPING_OVER = 75;
const FLAT_SHIPPING = 5.99;

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function missingAddressFields(a) {
  return ['name', 'line1', 'city', 'state', 'postalCode', 'country']
    .filter(function (k) { return !a || !String(a[k] || '').trim(); });
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  const body = await readBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return sendJSON(res, 400, { ok: false, error: 'empty cart' });

  // ── final-sale confirmation ──
  if (body.policyAccepted !== true) {
    const p = policy.getPolicy();
    return sendJSON(res, 400, {
      ok: false,
      error: 'policy not accepted',
      policy: { version: p.version, headline: p.headline, confirmLabel: p.confirmLabel, url: '/api/relay-policy' }
    });
  }

  // ── shipping address ──
  const addr = body.shippingAddress || {};
  const missing = missingAddressFields(addr);
  if (missing.length) {
    return sendJSON(res, 400, { ok: false, error: 'shipping address incomplete', missing: missing });
  }
  if (!body.buyerEmail || String(body.buyerEmail).indexOf('@') === -1) {
    return sendJSON(res, 400, { ok: false, error: 'a valid email is required for order updates' });
  }

  // ── resolve every line against the stored listing ──
  const lines = [];
  const unavailable = [];
  let subtotal = 0;

  for (const it of items) {
    const listingId = it.listingId || it.id;
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const listing = await store.getListing(listingId);

    if (!listing || listing.status !== 'active') {
      unavailable.push({ listingId: listingId, reason: 'no longer available' });
      continue;
    }
    // Every Relay listing is sourced. No source URL means nobody can buy it for the
    // customer, so it must not be sold.
    if (!listing.sourceUrl) {
      unavailable.push({ listingId: listingId, reason: 'cannot be sourced' });
      continue;
    }
    if (qty > (listing.quantity || 1)) {
      unavailable.push({ listingId: listingId, reason: 'only ' + (listing.quantity || 1) + ' available' });
      continue;
    }

    subtotal += listing.price * qty;
    lines.push({ listingId: listing.id, qty: qty, unitPrice: listing.price, title: listing.title });
  }

  if (unavailable.length) {
    return sendJSON(res, 409, {
      ok: false,
      error: 'some items are no longer available',
      message: 'Nothing has been charged. Remove these and try again.',
      unavailable: unavailable
    });
  }
  if (!lines.length || subtotal <= 0) {
    return sendJSON(res, 400, { ok: false, error: 'no valid items in cart' });
  }

  subtotal = round(subtotal);
  const shipping = subtotal > FREE_SHIPPING_OVER ? 0 : FLAT_SHIPPING;
  const total = round(subtotal + shipping);

  if (!finance.paymentsEnabled()) {
    return sendJSON(res, 200, { ok: false, error: 'payments not enabled yet', needsKey: true });
  }

  // The order exists before the payment link, so a customer who pays is always
  // attached to something we can fulfil.
  const order = await store.createOrder({
    buyerId: body.buyerId || ('guest_' + Date.now().toString(36)),
    buyerEmail: body.buyerEmail,
    lines: lines,
    shipping: shipping,
    shippingAddress: addr
  });
  if (order.error) return sendJSON(res, 409, { ok: false, error: order.error });

  const itemCount = lines.reduce(function (s, l) { return s + l.qty; }, 0);
  const payment = await finance.createPayment({
    name: 'Relay order · ' + itemCount + ' item' + (itemCount === 1 ? '' : 's'),
    amount: total,
    orderId: order.id,
    metadata: { lines: String(lines.length), buyer: order.buyerId }
  });
  // A charge that could not be created must fail the sale. Never tell a customer their
  // order is placed when no payment exists.
  if (!payment.ok) {
    await store.updateOrder(order.id, { status: 'payment-failed', failureReason: payment.error });
    return sendJSON(res, payment.needsKey ? 200 : 502, {
      ok: false, error: payment.error, needsKey: payment.needsKey || false
    });
  }

  const acceptance = await policy.recordAcceptance({
    accepted: true,
    buyerId: order.buyerId,
    orderId: order.id,
    ip: policy.clientIp(req),
    userAgent: (req.headers && req.headers['user-agent']) || null
  });
  if (!acceptance.ok) {
    return sendJSON(res, 500, { ok: false, error: 'could not record the policy confirmation: ' + acceptance.error });
  }

  await store.updateOrder(order.id, {
    status: 'awaiting-payment',
    paymentLinkId: payment.paymentLinkId,
    policyAcceptance: acceptance.acceptance
  });

  return sendJSON(res, 200, {
    ok: true,
    orderId: order.id,
    subtotal: subtotal,
    shipping: shipping,
    total: total,
    url: payment.url,
    policyVersion: acceptance.acceptance.policyVersion
  });
};
