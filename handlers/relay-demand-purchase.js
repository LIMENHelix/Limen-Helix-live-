/**
 * relay-demand-purchase.js — Customer buys item, creates Stripe payment
 *
 * POST /api/relay-demand-purchase
 * Body: { searchId, itemId, buyerId, shippingAddress }
 *
 * Returns: Stripe payment link at marked-up price
 * Records order with source info hidden from customer receipt
 */

const db = require('../lib/limen-db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { searchId, itemId, buyerId, shippingAddress } = req.body;

    if (!searchId || !itemId || !buyerId || !shippingAddress) {
      return res.status(400).json({ error: 'searchId, itemId, buyerId, shippingAddress required' });
    }

    // Look up search to find source item
    const searches = await db.get('relay:searches') || [];
    const search = searches.find(s => s.searchId === searchId);
    if (!search) {
      return res.status(404).json({ error: 'Search not found' });
    }

    const sourceItem = search.sourceMapping.find(m => m.itemId === itemId);
    if (!sourceItem) {
      return res.status(404).json({ error: 'Item not found in search results' });
    }

    // Calculate customer price (source cost + 25%)
    const sourceCost = sourceItem.sourceCost;
    const margin = sourceCost * 0.25;
    const customerPrice = Math.round((sourceCost + margin) * 100) / 100;

    // Create Stripe checkout session (mock for now)
    const stripeSessionId = `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const vercelUrl = process.env.VERCEL_URL || 'http://localhost:3000';
    const checkoutUrl = `${vercelUrl}/relay-checkout?session_id=${stripeSessionId}&amount=${customerPrice}`;

    // Record order (source info hidden from this receipt)
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orders = await db.get('relay:orders') || [];
    orders.push({
      orderId,
      ts: new Date().toISOString(),
      searchId,
      itemId,
      buyerId,
      shippingAddress,
      status: 'pending_payment',
      stripeSessionId,
      customerPrice,
      // Hidden from customer:
      sourceMarketplace: sourceItem.source,
      sourceCost,
      sourceUrl: sourceItem.sourceUrl,
      margin,
      marginPercent: 25
    });

    // Keep last 10000 orders
    if (orders.length > 10000) {
      orders.splice(0, orders.length - 10000);
    }

    await db.set('relay:orders', orders);

    return res.status(200).json({
      orderId,
      checkoutUrl,
      customerPrice,
      itemId,
      shippingAddress
    });

  } catch (e) {
    console.error('[relay-demand-purchase]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
