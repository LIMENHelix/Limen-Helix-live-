/**
 * relay-demand-dashboard.js — Dashboard stats and order tracking
 *
 * GET /api/relay-demand-dashboard?action=<status|orders|today|pending>
 * - status: summary stats (total orders, today's margin, avg order value)
 * - orders: all orders with hidden source details
 * - today: today's summary + breakdown by source
 * - pending: orders awaiting fulfillment
 */

const db = require('../lib/limen-db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const action = req.query.action || 'status';
    const orders = await db.get('relay:orders') || [];
    const ledger = await db.get('relay:finance-ledger') || [];
    const queue = await db.get('relay:purchase-queue') || [];

    const today = new Date().toISOString().split('T')[0];

    if (action === 'status') {
      // Summary stats
      const paidOrders = orders.filter(o => o.status === 'paid');
      const todayOrders = paidOrders.filter(o => o.paidAt && o.paidAt.startsWith(today));
      const todayMargin = todayOrders.reduce((sum, o) => sum + o.margin, 0);
      const avgOrderValue = paidOrders.length > 0
        ? (paidOrders.reduce((sum, o) => sum + o.customerPrice, 0) / paidOrders.length).toFixed(2)
        : 0;

      return res.status(200).json({
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        todayOrders: todayOrders.length,
        todayMargin: parseFloat(todayMargin.toFixed(2)),
        averageOrderValue: parseFloat(avgOrderValue),
        pendingQueue: queue.length
      });
    }

    if (action === 'orders') {
      // All orders (source info hidden)
      const sanitized = orders.map(o => ({
        orderId: o.orderId,
        ts: o.ts,
        status: o.status,
        customerPrice: o.customerPrice,
        shippingAddress: o.shippingAddress,
        paidAt: o.paidAt || null
      }));

      return res.status(200).json({
        orderCount: sanitized.length,
        orders: sanitized
      });
    }

    if (action === 'today') {
      // Today's summary
      const todayOrders = orders.filter(o => o.ts && o.ts.startsWith(today));
      const todayPaidOrders = todayOrders.filter(o => o.status === 'paid');
      const todayMargin = todayPaidOrders.reduce((sum, o) => sum + o.margin, 0);

      // Breakdown by source
      const bySource = {};
      todayPaidOrders.forEach(o => {
        if (!bySource[o.sourceMarketplace]) {
          bySource[o.sourceMarketplace] = { count: 0, margin: 0, revenue: 0 };
        }
        bySource[o.sourceMarketplace].count++;
        bySource[o.sourceMarketplace].margin += o.margin;
        bySource[o.sourceMarketplace].revenue += o.customerPrice;
      });

      return res.status(200).json({
        date: today,
        totalOrders: todayOrders.length,
        paidOrders: todayPaidOrders.length,
        totalMargin: parseFloat(todayMargin.toFixed(2)),
        totalRevenue: parseFloat(todayPaidOrders.reduce((sum, o) => sum + o.customerPrice, 0).toFixed(2)),
        bySource: Object.keys(bySource).map(source => ({
          source,
          count: bySource[source].count,
          margin: parseFloat(bySource[source].margin.toFixed(2)),
          revenue: parseFloat(bySource[source].revenue.toFixed(2))
        }))
      });
    }

    if (action === 'pending') {
      // Orders awaiting fulfillment
      return res.status(200).json({
        pendingCount: queue.length,
        pending: queue
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (e) {
    console.error('[relay-demand-dashboard]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
