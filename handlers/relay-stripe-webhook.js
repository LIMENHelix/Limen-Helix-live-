/**
 * relay-stripe-webhook.js — verified Stripe settlement for Relay Marketplace (C2C).
 *
 * C2C sellers ship their own goods. This webhook therefore records payment, commission,
 * franchise fee and the seller payout queue; it must never call Relay Supply's autonomous
 * supplier-purchase path. The old handler crossed those two businesses.
 *
 * Every successful event is signature-verified, event-idempotent, amount-reconciled and
 * journaled. Ledger and payout steps are independently deduplicated so Stripe delivering
 * payment_intent + checkout.session events cannot double-book the same sale.
 */
const crypto = require('node:crypto');
const marketplace = require('../lib/relay-marketplace');
const ledger = require('../lib/finance-ledger');
const idempotency = require('../lib/relay-c2c-idempotency');
const journal = require('../lib/relay-c2c-audit');

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
function centsToUsd(n) { return round(Number(n || 0) / 100); }

function verifySignature(raw, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  const parts = {};
  String(sigHeader).split(',').forEach(function (p) {
    const i = p.indexOf('=');
    if (i > 0) parts[p.slice(0, i)] = p.slice(i + 1);
  });
  const ts = parseInt(parts.t, 10);
  if (!ts || !parts.v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(String(ts) + '.' + raw).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(parts.v1, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { return false; }
}

function paymentShape(event) {
  const o = event && event.data && event.data.object || {};
  if (event.type === 'payment_intent.succeeded') {
    return { meta: o.metadata || {}, externalId: o.id || null, amount: centsToUsd(o.amount_received || o.amount) };
  }
  if (event.type === 'checkout.session.completed') {
    return { meta: o.metadata || {}, externalId: o.payment_intent || o.id || null, amount: centsToUsd(o.amount_total) };
  }
  if (event.type === 'charge.succeeded') {
    return { meta: o.metadata || {}, externalId: o.payment_intent || o.id || null, amount: centsToUsd(o.amount_captured || o.amount) };
  }
  return null;
}

async function ledgerHas(settlementKey) {
  const rows = await ledger.events(5000);
  return rows.some(function (e) { return e && e.meta && e.meta.settlementKey === settlementKey; });
}

async function payoutForOrder(orderId) {
  const rows = await marketplace.payoutHistory(null, 5000);
  return rows.find(function (p) { return p && p.orderId === orderId && p.type === 'seller'; }) || null;
}

async function settlePayment(event, shape) {
  const meta = shape.meta || {};
  const orderId = String(meta.orderId || '').trim();
  const marketplaceId = String(meta.marketplace || '').trim();
  if (!orderId || !marketplaceId) return { ok: true, ignored: true, reason: 'not a Relay Marketplace payment' };

  const order = await marketplace.getOrder(orderId);
  if (!order) return { ok: false, status: 404, error: 'order not found' };
  if (order.marketplaceId !== marketplaceId) return { ok: false, status: 409, error: 'payment marketplace does not match order' };

  const expected = round(order.subtotal);
  const collected = round(shape.amount);
  if (!(collected > 0) || Math.abs(collected - expected) > 0.005) {
    await marketplace.updateOrder(orderId, {
      status: 'payment-review',
      collectedAmount: collected,
      reviewReason: 'Stripe collected amount does not match C2C order total',
      stripePaymentId: shape.externalId || null
    });
    await journal.reconcile({
      action: 'payment-mismatch', orderId: orderId, marketplaceId: marketplaceId,
      listingId: order.listingId, buyerId: order.buyerId, sellerId: order.sellerId,
      amount: collected, externalId: shape.externalId, status: 'payment-review',
      detail: { expected: expected, collected: collected }
    });
    return { ok: true, review: true, orderId: orderId };
  }

  await journal.audit({
    action: 'verified-payment-settlement', orderId: orderId, marketplaceId: marketplaceId,
    listingId: order.listingId, buyerId: order.buyerId, sellerId: order.sellerId,
    amount: collected, externalId: shape.externalId, status: 'verified'
  });

  const commissionKey = 'relay-c2c:' + orderId + ':commission';
  if (!(await ledgerHas(commissionKey))) {
    await ledger.record({
      type: 'income', streamId: 'relay-c2c-commission', amount: round(order.commission),
      source: 'stripe-verified',
      meta: { settlementKey: commissionKey, orderId: orderId, marketplace: marketplaceId, stripePaymentId: shape.externalId }
    });
  }
  const franchiseKey = 'relay-c2c:' + orderId + ':franchise';
  if (round(order.franchiseFee) > 0 && !(await ledgerHas(franchiseKey))) {
    await ledger.record({
      type: 'income', streamId: 'relay-c2c-franchise-fee', amount: round(order.franchiseFee),
      source: 'stripe-verified',
      meta: { settlementKey: franchiseKey, orderId: orderId, marketplace: marketplaceId, stripePaymentId: shape.externalId }
    });
  }

  let payout = await payoutForOrder(orderId);
  if (!payout) {
    payout = await marketplace.createPayout({
      userId: order.sellerId,
      marketplaceId: marketplaceId,
      type: 'seller',
      amount: round(order.sellerPayout),
      orderId: orderId,
      reason: 'Paid C2C sale: ' + orderId
    });
  } else if (payout.status === 'awaiting-payment' || payout.status === 'proposed') {
    payout = await marketplace.updatePayout(payout.id, { status: 'pending' });
  }

  await marketplace.updateOrder(orderId, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    collectedAmount: collected,
    stripePaymentId: shape.externalId || null,
    paidVia: event.type,
    sellerPayoutId: payout && payout.id || null
  });
  await journal.reconcile({
    action: 'payment-confirmed', orderId: orderId, marketplaceId: marketplaceId,
    listingId: order.listingId, buyerId: order.buyerId, sellerId: order.sellerId,
    amount: collected, externalId: shape.externalId, status: 'paid',
    detail: { payoutId: payout && payout.id || null }
  });
  return { ok: true, orderId: orderId, paid: true };
}

module.exports = async function handler(req, res) {
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'POST only' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) return sendJSON(res, 503, { error: 'webhook not configured' });

  let raw = '';
  await new Promise(function (resolve) {
    req.on('data', function (c) { raw += c.toString(); });
    req.on('end', resolve);
    req.on('error', resolve);
  });
  if (!verifySignature(raw, req.headers && req.headers['stripe-signature'], secret)) {
    return sendJSON(res, 403, { error: 'invalid signature' });
  }

  let event;
  try { event = JSON.parse(raw); } catch (_) { return sendJSON(res, 400, { error: 'invalid JSON' }); }
  const shape = paymentShape(event);
  if (!shape) return sendJSON(res, 200, { ok: true, ignored: true, eventId: event.id || null });

  let claim;
  try { claim = await idempotency.claim('stripe-event', event.id || shape.externalId, 86400); }
  catch (e) {
    console.error('[relay-c2c-webhook] idempotency unavailable:', e.message);
    return sendJSON(res, 503, { error: 'settlement safety store unavailable' });
  }
  if (!claim.claimed) {
    const rec = claim.record || {};
    return sendJSON(res, 200, { ok: true, duplicate: true, result: rec.result || null });
  }

  try {
    const result = await settlePayment(event, shape);
    await idempotency.complete('stripe-event', event.id || shape.externalId, result, 604800);
    return sendJSON(res, result.ok === false ? (result.status || 500) : 200, result);
  } catch (e) {
    console.error('[relay-c2c-webhook] settlement failed:', e.message);
    try { await idempotency.release('stripe-event', event.id || shape.externalId); } catch (_) {}
    return sendJSON(res, 500, { error: 'payment settlement failed' });
  }
};
