/**
 * relay-demand-webhook.js — Stripe webhook: payment succeeded
 *
 * When a verified Stripe checkout.session.completed event arrives:
 * 1. Mark order as paid
 * 2. Record margin in finance ledger
 * 3. Queue auto-buy from source marketplace (MVP: just log as pending)
 *
 * AUTHENTICATED BY STRIPE SIGNATURE, fail closed. The previous version trusted
 * caller-supplied JSON: any unauthenticated POST naming a stripeSessionId marked an
 * order paid, booked margin, and queued a supplier purchase. Now the RAW request body
 * is verified against the STRIPE_WEBHOOK_SECRET family via lib/stripe-rail's verifier,
 * reached through the lib/relay-finance-bridge seam (the only Relay file allowed to
 * touch the rail — scripts/test-relay-firewall.js pins that). No configured secret, no
 * raw body, or an invalid signature all refuse. The session id is taken from the
 * VERIFIED event object (event.data.object.id), never from unverified caller JSON, and
 * only checkout.session.completed is accepted — this flow keys orders by checkout
 * session id, so no other event type is a payment fact here.
 *
 * IDEMPOTENT. Stripe retries until it gets a 2xx, so the same event arrives more than
 * once. Processed event ids are remembered under a Relay-scoped seen key — deliberately
 * NOT stripe:events:seen:v1, which handlers/stripe-webhook.js uses for the domain
 * subscription endpoint: sharing it would let one endpoint's delivery suppress the
 * other's processing of the same event id. An order already marked paid is also left
 * untouched, so a lost seen list cannot double-book margin or double-queue a purchase.
 *
 * ORDER OF WRITES. The order update and the finance-ledger margin entry are saved
 * BEFORE the purchase-queue entry: the ledger line is the reconciliation artifact, and
 * it must be durable before the order becomes purchase-eligible. No supplier purchase
 * is initiated here; the queue entry stays pending_auto_buy as before.
 */

const db = require('../lib/limen-db');
// Signature verification goes through the finance bridge seam — the only Relay file
// allowed to touch stripe-rail (scripts/test-relay-firewall.js pins that).
const bridge = require('../lib/relay-finance-bridge');

var SEEN_KEY = 'relay:demand:events:seen:v1';
var SEEN_CAP = 400;

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// Read the EXACT bytes. Buffer concat, not string concatenation, so a multi-byte
// character split across two chunks cannot corrupt the payload the HMAC is over.
function readRaw(req) {
  return new Promise(function (resolve) {
    if (typeof req.body === 'string') return resolve(req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    var chunks = [];
    var size = 0;
    req.on('data', function (c) {
      var b = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += b.length;
      if (size <= 1048576) chunks.push(b);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', function () { resolve(''); });
  });
}

async function alreadyHandled(id) {
  if (!id) return false;
  try {
    var seen = await db.get(SEEN_KEY);
    return Array.isArray(seen) && seen.indexOf(id) !== -1;
  } catch (e) { return false; }
}

async function markHandled(id) {
  if (!id) return;
  try {
    var seen = await db.get(SEEN_KEY);
    if (!Array.isArray(seen)) seen = [];
    seen.unshift(id);
    await db.set(SEEN_KEY, seen.slice(0, SEEN_CAP));
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { error: 'Method not allowed' });
  }

  var raw = await readRaw(req);
  var sig = req.headers && (req.headers['stripe-signature'] || req.headers['Stripe-Signature']);

  // FAIL CLOSED. A webhook with no configured secret cannot be authenticated, so it is
  // refused — same rule as handlers/relay-stripe-webhook.js.
  if (!bridge.webhookConfigured()) {
    console.error('[relay-demand-webhook] refused: no Stripe webhook secret is set');
    return sendJSON(res, 503, { error: 'webhook not configured' });
  }

  var ver = bridge.verifyWebhookSignature(raw, sig);
  if (!ver.ok) {
    console.warn('[relay-demand-webhook] refused: ' + ver.error);
    return sendJSON(res, 403, { error: 'invalid signature' });
  }

  var evt;
  try { evt = JSON.parse(raw); }
  catch (e) { return sendJSON(res, 400, { error: 'invalid JSON' }); }

  // Only the event this flow books by. Orders are keyed by checkout session id, so no
  // other event type is a payment fact for this handler; anything else is acknowledged
  // and ignored without touching storage.
  if (!evt || evt.type !== 'checkout.session.completed') {
    return sendJSON(res, 200, { received: true, ignored: evt && evt.type });
  }

  if (await alreadyHandled(evt.id)) {
    return sendJSON(res, 200, { received: true, duplicate: true, id: evt.id });
  }

  // Identity comes from the VERIFIED event object, never from caller JSON.
  var session = (evt.data && evt.data.object) || {};
  var stripeSessionId = session.id;

  try {
    // Find order by stripe session ID
    const orders = await db.get('relay:orders') || [];
    const orderIdx = orders.findIndex(o => o.stripeSessionId === stripeSessionId);
    if (orderIdx === -1) {
      console.warn(`[relay-demand-webhook] Order not found for session ${stripeSessionId}`);
      return sendJSON(res, 200, { received: true }); // Idempotent
    }

    const order = orders[orderIdx];

    // Already settled — a lost seen list must not double-book margin or re-queue.
    if (order.status === 'paid') {
      return sendJSON(res, 200, { received: true, alreadyPaid: true, orderId: order.orderId });
    }

    // Mark as paid
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    order.paidVia = 'webhook';
    order.stripeEventId = evt.id;

    // Record margin in finance ledger — the reconciliation artifact. Written and saved
    // BEFORE the order becomes purchase-eligible via the queue below.
    const ledger = await db.get('relay:finance-ledger') || [];
    ledger.push({
      ts: new Date().toISOString(),
      type: 'margin',
      orderId: order.orderId,
      amount: order.margin,
      source: order.sourceMarketplace,
      description: `Margin from order ${order.orderId}`,
      stripeEventId: evt.id
    });

    // Keep last 10000 ledger entries
    if (ledger.length > 10000) {
      ledger.splice(0, ledger.length - 10000);
    }

    orders[orderIdx] = order;
    await db.set('relay:orders', orders);
    await db.set('relay:finance-ledger', ledger);

    // Queue auto-buy (MVP: just log as pending). Saved last: the order is only purchase-
    // eligible once the paid state and the ledger line above are durable.
    const queue = await db.get('relay:purchase-queue') || [];
    queue.push({
      ts: new Date().toISOString(),
      orderId: order.orderId,
      sourceMarketplace: order.sourceMarketplace,
      sourceUrl: order.sourceUrl,
      sourceCost: order.sourceCost,
      shippingAddress: order.shippingAddress,
      status: 'pending_auto_buy',
      stripeEventId: evt.id
    });

    // Keep last 5000 queue items
    if (queue.length > 5000) {
      queue.splice(0, queue.length - 5000);
    }

    await db.set('relay:purchase-queue', queue);

    await markHandled(evt.id);

    console.log(`[relay-demand-webhook] Order ${order.orderId} paid, margin $${order.margin} recorded, auto-buy queued`);

    return sendJSON(res, 200, { received: true, orderId: order.orderId });

  } catch (e) {
    console.error('[relay-demand-webhook]', e.message);
    return sendJSON(res, 500, { error: e.message });
  }
};
