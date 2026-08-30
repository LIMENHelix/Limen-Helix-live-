/**
 * relay-autonomous-control.js — the operator's controls for the autonomous loop.
 *
 * GET  /api/relay-autonomous-control?action=...&key=RELAY_ADMIN_KEY
 *   status              mode, today's spend and margin, open work
 *   autonomy            the gate config on its own
 *   pending-approvals   purchases waiting for a human click (mode=queue)
 *   tasks               fulfilment steps a machine could not take
 *   cycles              the last engine cycles, so you can see it is actually running
 *   spend-status        PayPal-derived budget
 *   pending-payouts     USDC transfers awaiting confirmation
 *   today-margin        revenue and margin booked today
 *
 * POST /api/relay-autonomous-control  { action, key, ... }
 *   set-mode            { mode: 'off' | 'queue' | 'auto' }
 *   set-limits          { perOrderCapUsd, dailyCeilingUsd, minMarginUsd, minMarginPct, requireFunds }
 *   approve-purchase    { decisionId }   release one queued purchase
 *   fulfill-order       { orderId }      run the source purchase for a paid order now
 *   close-task          { taskId, sourceOrderId?, amount? }
 *   approve-payout      { payoutId }
 *   set-allocation      { marketplace, percent }
 *
 * GATED 2026-08-30. This route was completely open: an anonymous POST could approve a
 * payout and move money. Every action now requires RELAY_ADMIN_KEY, reads included,
 * because the reads expose source costs and margins, which is exactly what must not leak
 * to a customer. Fails closed when the key is unset.
 */

const db = require('../lib/limen-db');
const cryptoPayout = require('../lib/relay-crypto-payout');
const spendTracker = require('../lib/relay-spend-tracker');
const autonomy = require('../lib/relay-autonomy');
const engine = require('../lib/relay-engine');
const buy = require('../lib/relay-buy');

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
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

async function handleGET(q) {
  const action = q.action || 'status';

  if (action === 'status') {
    const st = await autonomy.status();
    const tasks = await buy.openTasks();
    const payouts = await cryptoPayout.getPendingPayouts();
    let spend = null;
    try { spend = await spendTracker.getSpendStatus(); } catch (e) { spend = { error: e.message }; }
    const cycles = await engine.recentCycles(3);

    return {
      ok: true,
      autonomy: st,
      openTasks: tasks.length,
      pendingPayouts: payouts.length,
      spend: spend,
      lastCycleAt: cycles[0] ? cycles[0].ts : null,
      lastCyclePublished: cycles[0] ? cycles[0].publishedCount : null
    };
  }

  if (action === 'autonomy') {
    return { ok: true, config: await autonomy.getConfig(), status: await autonomy.status() };
  }

  if (action === 'pending-approvals') {
    return { ok: true, approvals: await autonomy.pending() };
  }

  if (action === 'tasks') {
    return { ok: true, tasks: await buy.openTasks() };
  }

  if (action === 'cycles') {
    return { ok: true, cycles: await engine.recentCycles(parseInt(q.limit, 10) || 20) };
  }

  if (action === 'spend-status') {
    return { ok: true, spend: await spendTracker.getSpendStatus() };
  }

  if (action === 'pending-payouts') {
    return { ok: true, payouts: await cryptoPayout.getPendingPayouts() };
  }

  if (action === 'today-margin') {
    const orders = await db.get('relay:autonomous-orders') || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter(function (o) { return o.ts && o.ts.startsWith(today); });
    const totalMargin = todayOrders.reduce(function (s, o) { return s + (o.relayMargin || 0); }, 0);
    const totalRevenue = todayOrders.reduce(function (s, o) { return s + (o.buyerPaid || 0); }, 0);
    return {
      ok: true,
      today: today,
      orders: todayOrders.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      marginPercent: (totalRevenue > 0 ? (totalMargin / totalRevenue * 100).toFixed(1) : '0') + '%'
    };
  }

  return { ok: false, error: 'unknown action: ' + action };
}

async function handlePOST(body) {
  const action = body.action || '';

  if (action === 'set-mode') {
    return await autonomy.setConfig({ mode: body.mode }, body.by || 'operator');
  }

  if (action === 'set-limits') {
    return await autonomy.setConfig({
      perOrderCapUsd: body.perOrderCapUsd,
      dailyCeilingUsd: body.dailyCeilingUsd,
      minMarginUsd: body.minMarginUsd,
      minMarginPct: body.minMarginPct,
      requireFunds: body.requireFunds
    }, body.by || 'operator');
  }

  if (action === 'approve-purchase') {
    if (!body.decisionId) return { ok: false, error: 'decisionId required' };
    const approved = await autonomy.approve(body.decisionId, body.by || 'operator');
    if (!approved.ok) return approved;
    // Approval alone does not buy anything; run the order so the money actually moves.
    if (approved.row && approved.row.orderId) {
      const r = await engine.fulfillPaidOrder({ orderId: approved.row.orderId, force: true });
      return { ok: true, approved: approved.row, fulfillment: r };
    }
    return { ok: true, approved: approved.row };
  }

  if (action === 'fulfill-order') {
    if (!body.orderId) return { ok: false, error: 'orderId required' };
    const r = await engine.fulfillPaidOrder({ orderId: body.orderId, force: body.force === true });
    return { ok: r.ok, fulfillment: r };
  }

  if (action === 'close-task') {
    if (!body.taskId) return { ok: false, error: 'taskId required' };
    return await buy.closeTask(body.taskId, { sourceOrderId: body.sourceOrderId, amount: body.amount });
  }

  if (action === 'approve-payout') {
    if (!body.payoutId) return { ok: false, error: 'payoutId required' };
    const payout = await cryptoPayout.confirmPayout(body.payoutId);
    return { ok: true, payout: payout };
  }

  if (action === 'set-allocation') {
    const mkt = body.marketplace || '';
    const pct = parseFloat(body.percent);
    if (!mkt || !isFinite(pct)) return { ok: false, error: 'marketplace and percent (0-1) required' };
    try {
      return { ok: true, allocation: await spendTracker.updateAllocation(mkt, pct) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { ok: false, error: 'unknown action: ' + action };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const q = {};
  try { Object.assign(q, Object.fromEntries(new URL(req.url, 'http://h').searchParams)); } catch (e) {}

  const body = req.method === 'POST' ? await readBody(req) : {};

  // Fails closed: no key configured means no access, not open access.
  const ADMIN = process.env.RELAY_ADMIN_KEY || '';
  const supplied = q.key || body.key || (req.headers && req.headers['x-relay-key']) || '';
  if (!ADMIN || supplied !== ADMIN) {
    return sendJSON(res, 403, {
      ok: false,
      error: ADMIN ? 'forbidden' : 'RELAY_ADMIN_KEY is not set; this console is closed'
    });
  }

  try {
    if (req.method === 'GET') {
      const result = await handleGET(q);
      return sendJSON(res, result.ok ? 200 : 400, result);
    }
    if (req.method === 'POST') {
      const result = await handlePOST(body);
      return sendJSON(res, result.ok ? 200 : 400, result);
    }
    return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
  } catch (e) {
    console.error('[relay-autonomous-control]', e.message);
    return sendJSON(res, 500, { ok: false, error: e.message });
  }
};
