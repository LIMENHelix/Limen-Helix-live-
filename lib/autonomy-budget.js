'use strict';
/**
 * autonomy-budget.js — the single SPEND gate for autonomous actions.
 *
 * "Run it autonomously, but stop at a budget number." This is that number. Every
 * autonomous action that costs money (paid enrichment, an automated pull that
 * hits a paid API, an outreach send with a per-message cost) calls check(costUsd)
 * BEFORE spending and record(costUsd) AFTER. When the day's spend would exceed
 * the cap, check() returns allow:false and the caller skips the action.
 *
 * DOUBLE-GATED, CLOSED BY DEFAULT (same posture as lib/ai-kill-switch):
 *   armed() === true requires BOTH
 *     - LIMEN_AUTONOMY_ENABLED === '1'    (master arm; a human sets it in Vercel)
 *     - LIMEN_AUTONOMY_DAILY_USD > 0      (a real daily cap; unset/0 = closed)
 *   A fresh deploy with neither set spends nothing. Setting the cap alone does
 *   NOT arm; flipping the master alone with no cap does NOT arm. Both, on purpose.
 *
 * Spend is tracked per UTC day in Redis (autonomy:spend:YYYY-MM-DD, ~36h TTL) —
 * the same daily-budget pattern handlers/limen-worker-autofire.js already uses.
 * record() also books a finance-ledger spend event so autonomous cost lands in P&L.
 *
 * SCOPE HONESTY: this bounds SPEND only. It does NOT bound legal or deliverability
 * risk. Autonomous outreach SENDING is gated by its own explicit arm + human
 * acceptance, never by this budget alone.
 */

var db = require('./limen-db');
var ledger = require('./finance-ledger');

function today() { return new Date().toISOString().slice(0, 10); }
function dayKey() { return 'autonomy:spend:' + today(); }

function capUsd() {
  var n = Number(process.env.LIMEN_AUTONOMY_DAILY_USD || 0);
  return (isFinite(n) && n > 0) ? n : 0;
}
function enabled() { return process.env.LIMEN_AUTONOMY_ENABLED === '1'; }
function armed() { return enabled() && capUsd() > 0; }

async function spentTodayUsd() {
  var v = await db.get(dayKey());
  var n = Number(v && v.usd != null ? v.usd : v);
  return (isFinite(n) && n > 0) ? n : 0;
}
async function remainingUsd() {
  if (!armed()) return 0;
  return Math.max(0, capUsd() - (await spentTodayUsd()));
}

// Call BEFORE an autonomous spend. costUsd = estimated cost of this action.
// Returns { allow, reason, remainingUsd }.
async function check(costUsd) {
  var cost = Number(costUsd) || 0;
  if (!enabled()) return { allow: false, reason: 'autonomy-disabled', remainingUsd: 0 };
  var cap = capUsd();
  if (cap <= 0) return { allow: false, reason: 'no-budget-set', remainingUsd: 0 };
  var spent = await spentTodayUsd();
  var remaining = Math.max(0, cap - spent);
  if (spent + cost > cap) return { allow: false, reason: 'budget-exhausted', remainingUsd: remaining };
  return { allow: true, reason: 'ok', remainingUsd: remaining };
}

// Call AFTER a successful autonomous spend: debit the day's budget + book it.
async function record(costUsd, meta) {
  var cost = Number(costUsd) || 0;
  if (cost <= 0) return { spentUsd: await spentTodayUsd() };
  var next = (await spentTodayUsd()) + cost;
  await db.set(dayKey(), { usd: next, ts: new Date().toISOString() }, 60 * 60 * 36);
  try {
    await ledger.record({ type: 'spend', amount: cost, streamId: (meta && meta.streamId) || 'autonomy', note: (meta && meta.note) || 'autonomous action' });
  } catch (e) { /* ledger is best-effort; the budget debit above is the source of truth */ }
  return { spentUsd: next };
}

async function status() {
  return {
    armed: armed(), enabled: enabled(),
    dailyCapUsd: capUsd(),
    spentTodayUsd: await spentTodayUsd(),
    remainingUsd: await remainingUsd(),
    date: today()
  };
}

module.exports = {
  armed: armed, enabled: enabled, capUsd: capUsd,
  check: check, record: record, status: status,
  spentTodayUsd: spentTodayUsd, remainingUsd: remainingUsd
};
