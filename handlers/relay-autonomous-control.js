/**
 * relay-autonomous-control.js — Admin dashboard for autonomous operations
 *
 * GET /api/relay-autonomous-control?action=...
 *   - status — see overall autonomous system status
 *   - pending-payouts — USDC transfers waiting for confirmation
 *   - pending-purchases — items bought but not yet shipped
 *   - spend-status — budget usage
 *   - today-margin — today's total profit
 *
 * POST /api/relay-autonomous-control { action, ... }
 *   - approve-payout { payoutId } — confirm USDC transfer
 *   - update-budget { marketplace, dailyLimit }
 */

const db = require('../lib/limen-db');
const cryptoPayout = require('../lib/relay-crypto-payout');
const spendTracker = require('../lib/relay-spend-tracker');
const marketplace = require('../lib/relay-marketplace');

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
  });
}

async function handleGET(q) {
  if (q.action === 'status') {
    const spend = await spendTracker.getSpendStatus();
    const payouts = await cryptoPayout.getPendingPayouts();
    const purchases = await db.get('relay:autonomous-purchases') || [];
    const orders = await db.get('relay:autonomous-orders') || [];
    const paypalBalance = require('../lib/relay-paypal-balance');

    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.ts && o.ts.startsWith(today));
    const todayMargin = todayOrders.reduce((sum, o) => sum + o.relayMargin, 0);
    const ppBalance = await paypalBalance.getCurrentBalance();

    return {
      ok: true,
      status: {
        date: today,
        availableFunds: {
          paypal: Math.round(ppBalance * 100) / 100,
          note: 'Use PayPal balance for fulfillment; Stripe proceeds accumulate as profit'
        },
        listings: {
          pending: purchases.filter(p => p.status === 'pending').length,
          total: purchases.length
        },
        orders: {
          today: todayOrders.length,
          todayMargin: Math.round(todayMargin * 100) / 100,
          total: orders.length
        },
        payouts: payouts.length
      }
    };
  }

  if (q.action === 'pending-payouts') {
    const payouts = await cryptoPayout.getPendingPayouts();
    return { ok: true, payouts: payouts };
  }

  if (q.action === 'pending-purchases') {
    const purchases = await db.get('relay:autonomous-purchases') || [];
    const pending = purchases.filter(p => p.status === 'pending');
    return { ok: true, purchases: pending };
  }

  if (q.action === 'spend-status') {
    const spend = await spendTracker.getSpendStatus();
    return { ok: true, spend: spend };
  }

  if (q.action === 'today-margin') {
    const orders = await db.get('relay:autonomous-orders') || [];
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.ts && o.ts.startsWith(today));
    const totalMargin = todayOrders.reduce((sum, o) => sum + o.relayMargin, 0);
    const totalRevenue = todayOrders.reduce((sum, o) => sum + o.buyerPaid, 0);

    return {
      ok: true,
      today: today,
      orders: todayOrders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      marginPercent: (totalRevenue > 0 ? (totalMargin / totalRevenue * 100).toFixed(1) : 0) + '%'
    };
  }

  return { ok: false, error: 'unknown action' };
}

async function handlePOST(body) {
  if (body.action === 'approve-payout') {
    const payoutId = body.payoutId || '';
    if (!payoutId) return { ok: false, error: 'payoutId required' };

    const payout = await cryptoPayout.confirmPayout(payoutId);
    return { ok: true, payout: payout };
  }

  if (body.action === 'update-budget') {
    const marketplace = body.marketplace || '';
    const limit = parseFloat(body.dailyLimit) || 0;

    if (!marketplace || limit <= 0) {
      return { ok: false, error: 'marketplace and dailyLimit (>0) required' };
    }

    const budgets = await spendTracker.updateBudget(marketplace, limit);
    return { ok: true, budgets: budgets };
  }

  return { ok: false, error: 'unknown action' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const q = {};
    try {
      Object.assign(q, Object.fromEntries(new URL(req.url, 'http://h').searchParams));
    } catch (e) {}

    if (req.method === 'GET') {
      const result = await handleGET(q);
      return sendJSON(res, result.ok ? 200 : 400, result);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const result = await handlePOST(body);
      return sendJSON(res, result.ok ? 200 : 400, result);
    }

    return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('[relay-autonomous-control]', e.message);
    return sendJSON(res, 500, { ok: false, error: 'server error' });
  }
};
