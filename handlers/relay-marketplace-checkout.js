/**
 * relay-marketplace-checkout.js — C2C marketplace checkout.
 *
 * One C2C seller listing becomes one Stripe payment link. A multi-seller cart is not
 * silently split into multiple charges: the caller must check out one listing at a time.
 * This preserves the existing order schema (one seller/listing per order) and makes the
 * public page's contract match the backend.
 *
 * MONEY SAFETY:
 *   - requires an Idempotency-Key before any order/payment side effect
 *   - requires an operator-chosen RELAY_C2C_ORDER_CAP_USD; missing cap fails closed
 *   - writes an audit row before order/payment creation
 *   - writes reconciliation rows before and after Stripe link creation
 *   - seller payout is NOT created here; it is created only after verified payment
 */
const crypto = require('node:crypto');
const marketplace = require('../lib/relay-marketplace');
const stripe = require('../lib/stripe-rail');
const idempotency = require('../lib/relay-c2c-idempotency');
const journal = require('../lib/relay-c2c-audit');

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

function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
function hashKey(v) { return crypto.createHash('sha256').update(String(v || '')).digest('hex').slice(0, 32); }
function requiredAddress(a) {
  return ['name', 'line1', 'city', 'state', 'postalCode', 'country']
    .filter(function (k) { return !a || !String(a[k] || '').trim(); });
}
function orderCap() {
  const raw = process.env.RELAY_C2C_ORDER_CAP_USD;
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0.5 ? round(n) : null;
}

function normalizeLine(body) {
  if (body.listingId) {
    return { ok: true, listingId: String(body.listingId), quantity: Math.max(1, parseInt(body.quantity, 10) || 1) };
  }
  const items = Array.isArray(body.items) ? body.items.filter(Boolean) : [];
  if (!items.length) return { ok: false, error: 'listingId or one cart item required' };
  if (items.length !== 1) {
    return { ok: false, multi: true, error: 'C2C checkout is one seller item at a time. Check out each listing separately.' };
  }
  const row = items[0] || {};
  const id = row.listingId || row.id;
  if (!id) return { ok: false, error: 'cart item is missing listingId' };
  return { ok: true, listingId: String(id), quantity: Math.max(1, parseInt(row.qty || row.quantity, 10) || 1) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  const body = await readBody(req);
  const marketplaceId = String(body.marketplaceId || '').trim();
  const buyerId = String(body.buyerId || '').trim();
  const buyerEmail = String(body.buyerEmail || '').trim();
  const address = body.shippingAddress || {};
  const line = normalizeLine(body);
  const idemKey = String((req.headers && req.headers['idempotency-key']) || body.idempotencyKey || '').trim();

  if (!line.ok) return sendJSON(res, line.multi ? 409 : 400, { ok: false, error: line.error });
  if (!marketplaceId || !buyerId) return sendJSON(res, 400, { ok: false, error: 'marketplaceId and buyerId required' });
  if (!buyerEmail || buyerEmail.indexOf('@') < 1) return sendJSON(res, 400, { ok: false, error: 'valid buyerEmail required' });
  if (body.policyAccepted !== true) return sendJSON(res, 400, { ok: false, error: 'final-sale terms must be accepted' });
  const missing = requiredAddress(address);
  if (missing.length) return sendJSON(res, 400, { ok: false, error: 'shipping address incomplete', missing: missing });
  if (!idemKey || idemKey.length < 12) return sendJSON(res, 400, { ok: false, error: 'Idempotency-Key required' });

  const cap = orderCap();
  if (cap == null) {
    return sendJSON(res, 503, { ok: false, error: 'C2C checkout is closed until RELAY_C2C_ORDER_CAP_USD is configured by the operator' });
  }
  if (!stripe.hasKey()) return sendJSON(res, 503, { ok: false, error: 'payments not configured' });

  let claim;
  try {
    claim = await idempotency.claim('checkout', idemKey, 900);
  } catch (e) {
    console.error('[relay-c2c-checkout] idempotency unavailable:', e.message);
    return sendJSON(res, 503, { ok: false, error: 'checkout safety store unavailable; nothing was charged' });
  }
  if (!claim.claimed) {
    const rec = claim.record || {};
    if (rec.state === 'complete' && rec.result) return sendJSON(res, rec.result.ok ? 200 : 409, rec.result);
    return sendJSON(res, 409, { ok: false, error: 'this checkout request is already processing; do not submit it again' });
  }

  const keyHash = hashKey(idemKey);
  let order = null;
  try {
    const mkt = await marketplace.getMarketplace(marketplaceId);
    if (!mkt || mkt.status === 'inactive') throw Object.assign(new Error('marketplace not found or inactive'), { status: 404 });

    const listing = await marketplace.getListing(line.listingId);
    if (!listing || listing.status !== 'active') throw Object.assign(new Error('listing not found or inactive'), { status: 404 });
    if (listing.marketplaceId !== marketplaceId) throw Object.assign(new Error('listing not in this marketplace'), { status: 400 });
    if (line.quantity > Math.max(0, parseInt(listing.quantity, 10) || 0)) {
      throw Object.assign(new Error('requested quantity is no longer available'), { status: 409 });
    }

    const subtotal = round(listing.price * line.quantity);
    if (!(subtotal >= 0.5)) throw Object.assign(new Error('invalid listing price'), { status: 409 });
    if (subtotal > cap) throw Object.assign(new Error('order exceeds the operator-configured C2C checkout cap'), { status: 409 });

    await journal.audit({
      action: 'checkout-requested', marketplaceId: marketplaceId, listingId: listing.id,
      buyerId: buyerId, sellerId: listing.sellerId, amount: subtotal,
      idempotencyKeyHash: keyHash, status: 'approved-by-cap',
      detail: { quantity: line.quantity, capUsd: cap }
    });

    order = await marketplace.createOrder({
      marketplaceId: marketplaceId,
      buyerId: buyerId,
      sellerId: listing.sellerId,
      listingId: listing.id,
      subtotal: subtotal
    });
    await marketplace.updateOrder(order.id, {
      buyerEmail: buyerEmail,
      shippingAddress: {
        name: String(address.name).trim(), line1: String(address.line1).trim(),
        line2: String(address.line2 || '').trim(), city: String(address.city).trim(),
        state: String(address.state).trim(), postalCode: String(address.postalCode).trim(),
        country: String(address.country).trim().toUpperCase()
      },
      quantity: line.quantity,
      policyAccepted: true,
      checkoutIdempotencyKeyHash: keyHash,
      status: 'payment-link-pending'
    });

    await journal.reconcile({
      action: 'payment-link-requested', orderId: order.id, marketplaceId: marketplaceId,
      listingId: listing.id, buyerId: buyerId, sellerId: listing.sellerId,
      amount: subtotal, idempotencyKeyHash: keyHash, status: 'pending'
    });

    const link = await stripe.createPaymentLink({
      name: 'Relay Marketplace · ' + String(listing.title || 'item').slice(0, 60) + ' × ' + line.quantity,
      amount: subtotal,
      streamId: 'relay-c2c-order',
      currency: 'usd',
      metadata: {
        relayC2C: '1', orderId: order.id, marketplace: marketplaceId,
        seller: listing.sellerId, buyer: buyerId, listingId: listing.id,
        quantity: String(line.quantity), idempotencyKeyHash: keyHash
      }
    });
    if (!link.ok) throw Object.assign(new Error(link.error || 'payment link creation failed'), { status: 502 });

    await marketplace.updateOrder(order.id, { paymentLinkId: link.paymentLinkId, status: 'awaiting-payment' });
    await journal.reconcile({
      action: 'payment-link-created', orderId: order.id, marketplaceId: marketplaceId,
      listingId: listing.id, buyerId: buyerId, sellerId: listing.sellerId,
      amount: subtotal, idempotencyKeyHash: keyHash, externalId: link.paymentLinkId,
      status: 'awaiting-payment'
    });

    const result = {
      ok: true, url: link.url, orderId: order.id, amount: subtotal,
      listingId: listing.id, quantity: line.quantity,
      message: 'Continue to Stripe to pay.'
    };
    await idempotency.complete('checkout', idemKey, result, 86400);
    return sendJSON(res, 200, result);
  } catch (e) {
    const status = e.status || 500;
    const publicError = status >= 500 ? 'checkout failed; nothing was charged' : e.message;
    console.error('[relay-c2c-checkout]', e.message);
    if (order && order.id) {
      try { await marketplace.updateOrder(order.id, { status: 'payment-failed', failureReason: publicError }); } catch (_) {}
      try { await journal.reconcile({ action: 'checkout-failed', orderId: order.id, amount: order.subtotal, status: 'failed', detail: { error: publicError } }); } catch (_) {}
    }
    const result = { ok: false, error: publicError };
    try { await idempotency.complete('checkout', idemKey, result, 3600); } catch (_) {}
    return sendJSON(res, status, result);
  }
};
