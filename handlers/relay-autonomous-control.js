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

    // ORDERS THAT NEED A HUMAN, counted where the operator already looks.
    //
    // reconcilePayments routes underpayments and double-payments to 'payment-review' and
    // deliberately keeps them out of the automatic sweep — which is right, and was also
    // completely silent. Nothing in Relay notifies anyone: no email, no webhook, no
    // counter. An order landed there and sat until somebody thought to go looking, and
    // there was no read-only way to look either. An exception queue nobody is told about
    // is a drawer, not a queue.
    const relayStore = require('../lib/relay-store');
    let held = [];
    // NULL, not zero. A failed read used to leave these at their zero initializer and the
    // endpoint still answered ok:true — so a database outage produced the same reassuring
    // "nothing needs attention" as an empty queue. An alerting signal that goes quiet
    // under the failure it exists to report is worse than no signal, because it is
    // actively trusted. Unknown must look different from fine.
    let awaitingPayment = null;
    let paidUnfulfilled = null;
    let strandedIds = [];
    let stranded = [];
    let ordersError = null;
    try {
      // STRICT, or the catch above is decoration. db.get() swallows a Redis failure and
      // returns process memory, which is empty on a cold instance, so ordersByStatus
      // resolved [] and these awaits never threw during the exact outage the try/catch
      // was added for. The counters read a confident zero while the store was unreadable.
      const S = { strict: true };
      held = await relayStore.ordersByStatus('payment-review', 200, S);
      awaitingPayment = (await relayStore.ordersByStatus('awaiting-payment', 500, S)).length;
      stranded = (await relayStore.ordersByStatus('paid', 200, S)).filter(function (o) {
        // Judged PER LINE, not by the order's headline state. A half-fulfilled order
        // records 'partial', and counting only missing-or-failed let one shipped line hide
        // a line that was never ordered at all.
        return _unfulfilledLines(o).length > 0;
      });
      strandedIds = stranded.map(function (o) { return o.id; });
      paidUnfulfilled = stranded.length;
    } catch (e) {
      ordersError = e.message || 'order store unreadable';
      held = null;
      stranded = [];
    }

    // A PAID ORDER THAT NEVER GOT BOUGHT IS THE WHOLE POINT OF THIS NUMBER.
    // needsAttention summed only held orders and open tasks, so a purchase that failed
    // without filing a task left a customer's money taken, nothing ordered, and the
    // aggregate reading zero.
    //
    // COVERAGE IS PER LINE TOO. Matching only on orderId meant an order with two
    // outstanding lines and a task for ONE of them counted as fully handled, and the
    // other line went silent again - the same hole one level down. Tasks carry a
    // listingId (lib/relay-buy.js), so the match uses it, and a task with no listingId
    // can never stand in for a specific line.
    const covered = function (orderId, listingId) {
      return tasks.some(function (t) {
        return t.orderId === orderId && !!t.listingId && t.listingId === listingId;
      });
    };
    const strandedWithoutTask = stranded.filter(function (o) {
      return _unfulfilledLines(o).some(function (l) {
        // A line we cannot identify cannot be shown to be covered. Count it.
        return !l.listingId || !covered(o.id, l.listingId);
      });
    }).map(function (o) { return o.id; });
    const attention = ordersError
      ? null
      : held.length + tasks.length + strandedWithoutTask.length;

    return {
      ok: true,
      autonomy: st,
      openTasks: tasks.length,
      pendingPayouts: payouts.length,
      // The number that must not be zero-by-silence. Non-zero means a customer's money
      // arrived and the loop deliberately stopped.
      heldForReview: held ? held.length : null,
      needsAttention: attention,
      // Present ONLY when the counters could not be read. Its presence is the signal;
      // a consumer that sees needsAttention:null must not read that as calm.
      ordersUnavailable: ordersError || undefined,
      strandedWithoutTask: ordersError ? null : strandedWithoutTask.length,
      awaitingPayment: awaitingPayment,
      paidUnfulfilled: paidUnfulfilled,
      // The reasons inline, so "1 held" is never a number the operator has to go and
      // decode somewhere else.
      heldReasons: (held || []).slice(0, 10).map(function (o) {
        return {
          orderId: o.id,
          reason: o.reviewReason || 'held',
          collected: o.collectedAmount != null ? o.collectedAmount : null,
          expected: o.total != null ? o.total : null,
          at: o.paidAt || o.ts || null
        };
      }),
      spend: spend,
      lastCycleAt: cycles[0] ? cycles[0].ts : null,
      lastCyclePublished: cycles[0] ? cycles[0].publishedCount : null
    };
  }

  // THE ORDER LOOKUP THAT DID NOT EXIST.
  //
  // Not one of the control reads touched relay:store:orders, and ?view=order is a POST
  // purchase route. So after a customer paid, nobody could answer "did that order flip to
  // paid, or is it stuck" from any permitted probe — including during a supervised live
  // test, which is exactly when the question gets asked. Operator-gated like every other
  // action here, because these rows carry source costs.
  if (action === 'orders') {
    const relayStore = require('../lib/relay-store');
    const want = (q.status || '').trim();
    const limit = Math.min(parseInt(q.limit, 10) || 25, 200);
    const rows = want
      ? await relayStore.ordersByStatus(want, limit)
      : (await relayStore.orderHistory(limit));
    return {
      ok: true,
      status: want || 'any',
      count: rows.length,
      orders: rows.map(function (o) {
        return {
          id: o.id,
          status: o.status,
          total: o.total,
          collectedAmount: o.collectedAmount != null ? o.collectedAmount : null,
          reviewReason: o.reviewReason || null,
          amountMismatch: o.amountMismatch || null,
          duplicatePayments: o.duplicatePayments || null,
          paidAt: o.paidAt || null,
          paidVia: o.paidVia || null,
          stripeSessionId: o.stripeSessionId || null,
          incomeReportedAt: o.incomeReportedAt || null,
          incomeBookedBy: o.incomeBookedBy || null,
          paymentLinkClosedAt: o.paymentLinkClosedAt || null,
          fulfillment: o.fulfillment || null,
          lines: (o.lines || []).length,
          ts: o.ts
        };
      })
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

  // CJ DIAGNOSTIC. Operator-only, read-only, never calls placeOrder.
  //
  // Exists because searchCJ catches errors and returns [], so from outside a CJ failure
  // and "nothing matched" are indistinguishable — which is why production returning zero
  // while identical code returns three items locally could not be diagnosed by probing
  // endpoints. This reports which of the four gates rejects each product, plus the raw
  // CJ error and the actual response shape.
  if (action === 'cj-probe') {
    const cj = require('../lib/relay-cj');
    return {
      ok: true,
      probe: await cj.probe({
        keyword: q.keyword || 'phone case',
        maxPrice: q.maxPrice != null ? parseFloat(q.maxPrice) : 500,
        countryCode: q.country || 'US',
        limit: parseInt(q.limit, 10) || 5
      })
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
      requireFunds: body.requireFunds,
      // The rate limit is settable like every other limit. Adding it to setConfig without
      // forwarding it here meant a POST returned success and silently kept the old value.
      velocityMaxOrders: body.velocityMaxOrders,
      velocityMaxUsd: body.velocityMaxUsd
    }, body.by || 'operator');
  }

  if (action === 'approve-purchase') {
    if (!body.decisionId) return { ok: false, error: 'decisionId required' };
    const approved = await autonomy.approve(body.decisionId, body.by || 'operator');
    if (!approved.ok) return approved;
    // Approval alone does not buy anything; run the order so the money actually moves —
    // and pass the decisionId, so fulfilment SPENDS this reservation instead of taking a
    // fresh one. Without it the click re-queued and bought nothing.
    if (approved.row && approved.row.orderId) {
      const r = await engine.fulfillPaidOrder({
        orderId: approved.row.orderId,
        decisionId: body.decisionId,
        force: true
      });
      // Report on THIS decision, not on the order as a whole. Returning ok:true for an
      // order-level result is how a click that bought nothing looked like a success for
      // as long as it did — the console throws the body away and just refreshes.
      const lines = (r && r.lines) || [];
      const mine = lines.find(function (l) { return l.decisionId === body.decisionId; });
      const bought = !!(mine && mine.state === 'purchased');
      return {
        ok: bought,
        purchased: bought,
        approved: approved.row,
        line: mine || null,
        // Why it did not buy, in the words of the gate that refused.
        reason: bought ? null : ((mine && (mine.reason || mine.error)) || (r && r.error) || 'the approved line did not complete'),
        fulfillment: r
      };
    }
    return { ok: true, approved: approved.row };
  }

  if (action === 'fulfill-order') {
    if (!body.orderId) return { ok: false, error: 'orderId required' };
    const r = await engine.fulfillPaidOrder({ orderId: body.orderId, force: body.force === true });
    return { ok: r.ok, fulfillment: r };
  }

  // Ask Stripe, now, which unpaid orders were actually paid. The cron already does this
  // every cycle; this is for the operator who does not want to wait for the next one, and
  // for answering "did that customer's money arrive?" without opening the dashboard.
  if (action === 'reconcile-payments') {
    // CAPPED. Each order in the batch is at least one Stripe round trip, so an operator
    // typing a large number turns one click into a request that outlives the function.
    const asked = parseInt(body.limit, 10) || 25;
    // 25, not 100: each order is at least one Stripe round trip of a second or two, and
    // a hundred of those outlives the function's deadline. The cron does the volume; this
    // is for an operator who wants an answer now.
    const r = await engine.reconcilePayments({ limit: Math.min(Math.max(asked, 1), 25) });
    const rows = r.checked || [];
    return {
      ok: r.ok !== false,
      error: r.error || null,
      // Newly settled means a CUSTOMER paid, not that bookkeeping was repaired. Counting
      // a backfill here reported a payment that did not happen this cycle.
      // A settled payment is a CUSTOMER paying. A backfill is bookkeeping catching up, and
      // a failed retry is neither — counting either as settled reports revenue that did
      // not arrive this cycle.
      // A settled payment is a CUSTOMER paying, discovered this cycle. Whether its income
      // was booked here or deduplicated because the webhook got there first is a separate
      // question — excluding incomeSkipped rows (added last round, over-broad) hid real
      // settlements behind a bookkeeping detail. Backfills are still excluded: those are
      // bookkeeping catching up on a payment from some earlier cycle.
      settled: rows.filter(function (c) { return c.paid && !c.alreadySettled && !c.incomeBackfilled; }).length,
      incomeBackfilled: rows.filter(function (c) { return c.incomeBackfilled; }).length,
      heldForReview: rows.filter(function (c) { return c.review; }).length,
      stillUnpaid: rows.filter(function (c) { return !c.paid && c.asked; }).length,
      // Orders it could not get an answer about. These are NOT unpaid; they are unknown,
      // and the difference is the whole point of the ok/paid split in paymentStatus.
      couldNotAsk: rows.filter(function (c) { return !c.paid && c.asked === false; }),
      checked: rows
    };
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

/**
 * The lines of a paid order that were never actually bought.
 *
 * The order-level fulfilment state is a headline, not an inventory: 'partial' means
 * SOMETHING shipped, which is exactly when a line that was never ordered is easiest to
 * miss. Every branch here fails CLOSED - an order we cannot read the shape of counts as
 * unfinished, because the alternative is telling the operator a customer is served when
 * nobody checked.
 */
function _unfulfilledLines(order) {
  const f = order && order.fulfillment;
  if (!f) return [{ listingId: (order && order.listingId) || null, state: 'not-attempted' }];
  // Legacy and single-line orders carry no lines array. Trust the headline only when it
  // says everything was bought.
  if (!Array.isArray(f.lines) || f.lines.length === 0) {
    return f.state === 'purchased'
      ? []
      : [{ listingId: order.listingId || null, state: f.state || 'unknown' }];
  }
  return f.lines.filter(function (l) { return l && l.state !== 'purchased'; });
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
