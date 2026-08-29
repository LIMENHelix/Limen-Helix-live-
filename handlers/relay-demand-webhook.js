/**
 * relay-demand-webhook.js — Stripe webhook: payment succeeded
 *
 * When customer payment succeeds:
 * 1. Mark order as paid
 * 2. Record margin in finance ledger
 * 3. Queue auto-buy from source marketplace (MVP: just log as pending)
 */

const db = require('../lib/limen-db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const stripeSessionId = body.stripeSessionId;

    // Find order by stripe session ID
    const orders = await db.get('relay:orders') || [];
    const orderIdx = orders.findIndex(o => o.stripeSessionId === stripeSessionId);
    if (orderIdx === -1) {
      console.warn(`[relay-demand-webhook] Order not found for session ${stripeSessionId}`);
      return res.status(200).json({ received: true }); // Idempotent
    }

    const order = orders[orderIdx];

    // Mark as paid
    order.status = 'paid';
    order.paidAt = new Date().toISOString();

    // Record margin in finance ledger
    const ledger = await db.get('relay:finance-ledger') || [];
    ledger.push({
      ts: new Date().toISOString(),
      type: 'margin',
      orderId: order.orderId,
      amount: order.margin,
      source: order.sourceMarketplace,
      description: `Margin from order ${order.orderId}`
    });

    // Keep last 10000 ledger entries
    if (ledger.length > 10000) {
      ledger.splice(0, ledger.length - 10000);
    }

    // Queue auto-buy (MVP: just log as pending)
    const queue = await db.get('relay:purchase-queue') || [];
    queue.push({
      ts: new Date().toISOString(),
      orderId: order.orderId,
      sourceMarketplace: order.sourceMarketplace,
      sourceUrl: order.sourceUrl,
      sourceCost: order.sourceCost,
      shippingAddress: order.shippingAddress,
      status: 'pending_auto_buy'
    });

    // Keep last 5000 queue items
    if (queue.length > 5000) {
      queue.splice(0, queue.length - 5000);
    }

    // Save all
    orders[orderIdx] = order;
    await db.set('relay:orders', orders);
    await db.set('relay:finance-ledger', ledger);
    await db.set('relay:purchase-queue', queue);

    console.log(`[relay-demand-webhook] Order ${order.orderId} paid, margin $${order.margin} recorded, auto-buy queued`);

    return res.status(200).json({ received: true });

  } catch (e) {
    console.error('[relay-demand-webhook]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
