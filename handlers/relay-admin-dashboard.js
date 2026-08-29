/**
 * relay-admin-dashboard.js — Admin view of all orders with source tracking
 *
 * GET /api/relay-admin-dashboard?key=ADMIN_KEY
 * Shows: orders, margins, sources, customer details (hidden from public)
 */

const db = require('../lib/limen-db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const adminKey = req.query.key;
    const expectedKey = process.env.RELAY_ADMIN_KEY;

    if (!expectedKey || adminKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch all orders with source details
    const orders = await db.get('relay:orders') || [];
    const ledger = await db.get('relay:finance-ledger') || [];
    const searches = await db.get('relay:searches') || [];

    // Build admin view with all source information
    const adminOrders = orders.map(order => {
      // Find the source mapping for this order
      const search = searches.find(s => s.searchId === order.searchId);
      const sourceInfo = search && search.sourceMapping
        ? search.sourceMapping.find(m => m.itemId === order.itemId)
        : null;

      return {
        orderId: order.orderId,
        ts: order.ts,
        status: order.status,
        paidAt: order.paidAt,
        // Visible to admin only:
        sourceMarketplace: order.sourceMarketplace,
        sourceCost: order.sourceCost,
        sourceUrl: order.sourceUrl,
        customerPrice: order.customerPrice,
        margin: order.margin,
        marginPercent: order.marginPercent,
        marginUsd: parseFloat(order.margin.toFixed(2)),
        // Buyer info (redacted in public)
        buyerId: order.buyerId,
        shippingAddress: order.shippingAddress,
        // Search context
        searchId: order.searchId,
        itemId: order.itemId
      };
    });

    // Calculate summary stats
    const paidOrders = adminOrders.filter(o => o.status === 'paid');
    const totalMargin = paidOrders.reduce((sum, o) => sum + (o.margin || 0), 0);
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = paidOrders.filter(o => o.paidAt && o.paidAt.startsWith(today));
    const todayMargin = todayOrders.reduce((sum, o) => sum + (o.margin || 0), 0);

    // Group by source
    const bySource = {};
    paidOrders.forEach(order => {
      if (!bySource[order.sourceMarketplace]) {
        bySource[order.sourceMarketplace] = {
          count: 0,
          totalMargin: 0,
          totalRevenue: 0,
          avgMargin: 0
        };
      }
      bySource[order.sourceMarketplace].count++;
      bySource[order.sourceMarketplace].totalMargin += order.margin || 0;
      bySource[order.sourceMarketplace].totalRevenue += order.customerPrice || 0;
    });

    Object.keys(bySource).forEach(source => {
      bySource[source].avgMargin = bySource[source].count > 0
        ? bySource[source].totalMargin / bySource[source].count
        : 0;
    });

    return res.status(200).json({
      meta: {
        totalOrders: adminOrders.length,
        paidOrders: paidOrders.length,
        totalMargin: parseFloat(totalMargin.toFixed(2)),
        todayOrders: todayOrders.length,
        todayMargin: parseFloat(todayMargin.toFixed(2)),
        averageMargin: paidOrders.length > 0
          ? parseFloat((totalMargin / paidOrders.length).toFixed(2))
          : 0
      },
      sourceBreakdown: bySource,
      orders: adminOrders,
      note: 'All data shown is private. Source marketplace, costs, and buyer details are hidden from customers.'
    });

  } catch (e) {
    console.error('[relay-admin-dashboard]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
