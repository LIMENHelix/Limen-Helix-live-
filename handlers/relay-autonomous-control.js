/**
 * relay-autonomous-control.js — the operator's controls for the autonomous loop.
 *
 * Reached through Relay's one door: /api/relay?view=control
 * GET  /api/relay?view=control&action=...&key=RELAY_ADMIN_KEY
 *   status              mode, today's spend and margin, open work
 *   autonomy            the gate config on its own
 *   pending-approvals   purchases waiting for a human click (mode=queue)
 *   tasks               fulfilment steps a machine could not take
 *   cycles              the last engine cycles, so you can see it is actually running
 *   spend-status        PayPal-derived budget
 *   pending-payouts     USDC transfers awaiting confirmation
 *   today-margin        revenue and margin booked today
 *
 * POST /api/relay?view=control  { action, key, ... }
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

const fs = require('fs');
const path = require('path');
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

  // What is configured, as booleans. NEVER a value: this answers "why is nothing
  // happening" on screen instead of the operator having to read logs or ask.
  if (action === 'readiness') {
    const has = function (n) { return !!(process.env[n] && String(process.env[n]).trim()); };
    const finance = require('../lib/relay-finance-bridge');
    return {
      ok: true,
      credentials: [
        { key: 'XAI_API_KEY', set: has('XAI_API_KEY') || has('GROK_API_KEY'),
          unlocks: 'Grok reference images', required: false },
        { key: 'GOOGLE_API_KEY', set: has('GOOGLE_API_KEY') || has('GOOGLE_VISION_KEY'),
          unlocks: 'Google image labelling + web search', required: false },
        { key: 'GOOGLE_CSE_ID', set: has('GOOGLE_CSE_ID') || has('GOOGLE_SEARCH_ENGINE_ID'),
          unlocks: 'Google web search for listings', required: false },
        { key: 'SERPAPI_KEY', set: has('SERPAPI_KEY') || has('SERP_API_KEY'),
          unlocks: 'true reverse-image search (Google Lens)', required: false },
        { key: 'EBAY_CLIENT_ID + EBAY_CLIENT_SECRET', set: has('EBAY_CLIENT_ID') && has('EBAY_CLIENT_SECRET'),
          unlocks: 'real eBay supply', required: false },
        { key: 'CJ_API_KEY', set: has('CJ_API_KEY'),
          unlocks: 'the ONLY unattended purchasing path: CJ orders pay from a prepaid wallet',
          required: false },
        { key: 'EBAY_BUY_TOKEN', set: has('EBAY_BUY_TOKEN'),
          unlocks: 'eBay auto-purchase (application denied; a human buys instead)', required: false },
        { key: 'STRIPE_SECRET_KEY', set: finance.paymentsEnabled(),
          unlocks: 'taking payment', required: true },
        { key: 'RELAY_MARGIN_KEY', set: has('RELAY_MARGIN_KEY'),
          unlocks: 'saving the margin from the cockpit', required: false }
      ],
      // Sourcing needs at least ONE way to find a listing.
      // Can we complete a purchase with no human at all?
      canBuyUnattended: has('CJ_API_KEY') || has('EBAY_BUY_TOKEN'),
      canSource: has('CJ_API_KEY') ||
                 (has('EBAY_CLIENT_ID') && has('EBAY_CLIENT_SECRET')) ||
                 has('SERPAPI_KEY') || has('SERP_API_KEY') ||
                 ((has('GOOGLE_API_KEY') || has('GOOGLE_VISION_KEY')) &&
                  (has('GOOGLE_CSE_ID') || has('GOOGLE_SEARCH_ENGINE_ID'))),
      canCharge: finance.paymentsEnabled()
    };
  }

  // WHERE EVERY PRODUCT CAME FROM. Operator-only, and it must stay that way: this is the
  // one view that carries sourceUrl, sourceCost and the spread together. The public
  // catalogue at /api/relay?view=catalog goes through store.publicListings, an allow-list
  // that cannot emit any of these fields. Showing a customer where we bought their item
  // and for how much ends the business.
  if (action === 'inventory') {
    const store = require('../lib/relay-store');
    const raw = await store.activeListings(Math.min(parseInt(q.limit, 10) || 100, 300));
    const rows = raw.map(function (l) {
      const cost = l.sourceCost != null ? l.sourceCost : null;
      const spread = cost != null ? Math.round((l.price - cost) * 100) / 100 : null;
      return {
        id: l.id,
        title: l.title,
        sell: l.price,
        cost: cost,
        shipping: l.sourceShipping != null ? l.sourceShipping : null,
        spread: spread,
        marginPct: (cost != null && l.price > 0) ? Math.round((spread / l.price) * 1000) / 10 : null,
        supplier: l.sourceMarketplace || null,
        provider: l.sourceProvider || null,
        sourceUrl: l.sourceUrl || null,
        sourceId: l.sourceId || null,
        warehouse: l.sourceFromCountry || null,
        carrier: l.sourceCarrier || null,
        marginAtListing: l.marginAtListing,
        buyable: !!l.sourceUrl,
        qty: l.quantity,
        listed: l.ts
      };
    });
    const bySupplier = {};
    rows.forEach(function (r) {
      const k = r.supplier || 'unknown';
      bySupplier[k] = (bySupplier[k] || 0) + 1;
    });
    return {
      ok: true,
      count: rows.length,
      bySupplier: bySupplier,
      totalCost: Math.round(rows.reduce(function (s, r) { return s + (r.cost || 0); }, 0) * 100) / 100,
      totalSell: Math.round(rows.reduce(function (s, r) { return s + (r.sell || 0); }, 0) * 100) / 100,
      listings: rows
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

  // A plain GET with no action serves the console PAGE. The page is inert HTML: it
  // holds no key and shows no data until the operator enters one, and every data call
  // it makes is gated below exactly as before.
  if (req.method === 'GET' && !q.action) {
    try {
      const html = fs.readFileSync(path.join(__dirname, '../pages/relay-control.html'), 'utf8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(html);
    } catch (e) {
      console.error('[relay-autonomous-control] page load failed:', e.message);
      return sendJSON(res, 500, { ok: false, error: 'console page unavailable' });
    }
  }

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
