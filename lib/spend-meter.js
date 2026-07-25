/**
 * lib/spend-meter.js — the single chokepoint for metered spend.
 *
 * WHY THIS EXISTS. CLAUDE.md says an AGENT_BUILD=1 run may spend up to a budget. Before this
 * file that was policy, not enforcement: lib/ai-orchestrator.js counted TOKENS per tick, not
 * dollars, and 8 of the 12 Anthropic call sites bypassed it entirely. A budget nothing checks
 * is decoration.
 *
 * THE CONTRACT
 *   const r = await meter.reserve({ kind:'ai', model, inputTokens, outputTokens, label });
 *   if (!r.ok) return r;                       // refused: over budget. A NORMAL stop.
 *   ...do the paid thing...
 *   await meter.settle(r.id, { inputTokens, outputTokens });   // actual usage
 *
 * RESERVE BEFORE, SETTLE AFTER. Cost is reserved BEFORE the call so an over-budget call is
 * refused rather than discovered afterward. Settling with real usage corrects the estimate.
 *
 * FAILS CLOSED. If the ledger cannot be read or written, spend is REFUSED. An unreachable
 * Redis must not become an unlimited budget.
 *
 * CRASH SAFETY. A reservation that never settles stays counted against the budget until it
 * ages out (RESERVATION_TTL_MS). Erring toward over-counting is the safe direction: the worst
 * case is a refused call, not an unbounded bill.
 *
 * TWO WINDOWS. A per-run envelope (AGENT_BUDGET_USD) and a daily ceiling
 * (LIMEN_DAILY_BUDGET_USD). Per-run alone is not enough: a runaway loop that restarts can
 * drain an unlimited number of per-run budgets in an hour.
 */
var db = require('./limen-db');

// ── unit costs ─────────────────────────────────────────────────────────────
// USD per 1M tokens, from the Anthropic pricing table (verified 2026-07-25).
// Cache reads bill at ~0.1x input; 5-minute cache writes at 1.25x; 1-hour writes at 2x.
var MODEL_PRICES = {
  'claude-fable-5':    { in: 10, out: 50 },
  'claude-mythos-5':   { in: 10, out: 50 },
  'claude-opus-5':     { in: 5,  out: 25 },
  'claude-opus-4-8':   { in: 5,  out: 25 },
  'claude-opus-4-7':   { in: 5,  out: 25 },
  'claude-opus-4-6':   { in: 5,  out: 25 },
  'claude-opus-4-5':   { in: 5,  out: 25 },
  'claude-sonnet-5':   { in: 3,  out: 15 },
  'claude-sonnet-4-6': { in: 3,  out: 15 },
  'claude-sonnet-4-5': { in: 3,  out: 15 },
  'claude-haiku-4-5':  { in: 1,  out: 5 }
};
// An unknown model must not price at zero. Charge the most expensive known rate so a new or
// misspelled model is over-estimated and refused early rather than silently free.
var UNKNOWN_MODEL_PRICE = { in: 10, out: 50 };

var CACHE_READ_MULTIPLIER = 0.1;
var CACHE_WRITE_MULTIPLIER = 1.25;   // 5-minute TTL; 1h writes are 2x, pass kind:'cacheWrite1h'

var LEDGER_KEY = 'spend:ledger:v1';
var RESERVATION_TTL_MS = 10 * 60 * 1000;   // an unsettled reservation ages out after 10 min

function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }
function todayKey() { return new Date().toISOString().slice(0, 10); }

/** Per-run identity. One value for the life of the process unless the harness supplies one. */
var RUN_ID = process.env.AGENT_RUN_ID || ('run-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36));

function caps() {
  return {
    runUsd: num(process.env.AGENT_BUDGET_USD, null),
    dailyUsd: num(process.env.LIMEN_DAILY_BUDGET_USD, null),
    autonomous: process.env.AGENT_BUILD === '1'
  };
}

/**
 * Dollar cost of a model call. Cache reads and writes are priced separately because they are
 * the difference between a cheap repeat call and an expensive one, and treating a cache read
 * as a full input token overstates a cached agent by roughly 10x.
 */
function estimateAiUsd(o) {
  var p = MODEL_PRICES[o.model] || UNKNOWN_MODEL_PRICE;
  var inTok = num(o.inputTokens, 0);
  var outTok = num(o.outputTokens, 0);
  var readTok = num(o.cacheReadTokens, 0);
  var writeTok = num(o.cacheWriteTokens, 0);
  var usd = (inTok * p.in
    + outTok * p.out
    + readTok * p.in * CACHE_READ_MULTIPLIER
    + writeTok * p.in * CACHE_WRITE_MULTIPLIER) / 1e6;
  return Math.max(0, usd);
}

async function loadLedger() {
  var l = await db.get(LEDGER_KEY);     // throws propagate: caller must fail closed
  if (!l || typeof l !== 'object') l = {};
  if (!l.days || typeof l.days !== 'object') l.days = {};
  if (!l.runs || typeof l.runs !== 'object') l.runs = {};
  if (!Array.isArray(l.open)) l.open = [];
  return l;
}

/** Drop reservations that never settled, so a crashed process cannot hold budget forever. */
function pruneOpen(l, now) {
  var kept = [];
  for (var i = 0; i < l.open.length; i++) {
    var r = l.open[i];
    if (r && r.at && (now - r.at) < RESERVATION_TTL_MS) kept.push(r);
  }
  l.open = kept;
  return l;
}

function openTotal(l, filterFn) {
  var t = 0;
  for (var i = 0; i < l.open.length; i++) {
    var r = l.open[i];
    if (!filterFn || filterFn(r)) t += num(r.usd, 0);
  }
  return t;
}

function spentToday(l) { return num(l.days[todayKey()], 0); }
function spentRun(l) { return num(l.runs[RUN_ID], 0); }

/**
 * Reserve budget for a paid action. Returns { ok:true, id, estUsd } or
 * { ok:false, reason, ... } when it would breach a cap.
 *
 * kind: 'ai' prices from model + tokens. Anything else (email, mail, paid API) must supply
 * costUsd explicitly — vendor per-unit prices are not guessed here, because a wrong constant
 * silently mis-meters every send.
 */
async function reserve(o) {
  o = o || {};
  var c = caps();
  var estUsd = o.kind === 'ai' ? estimateAiUsd(o) : num(o.costUsd, null);

  if (estUsd == null) {
    return { ok: false, reason: 'No cost supplied for kind "' + (o.kind || 'unknown') + '". Non-AI spend must pass costUsd.' };
  }

  // No caps configured means unmetered, which is only acceptable with a human present.
  if (c.runUsd == null && c.dailyUsd == null) {
    if (c.autonomous) {
      return { ok: false, reason: 'AGENT_BUILD=1 with no AGENT_BUDGET_USD or LIMEN_DAILY_BUDGET_USD set. An autonomous run must have a budget.' };
    }
    return { ok: true, id: null, estUsd: estUsd, metered: false };
  }

  var l, now = Date.now();
  try {
    l = pruneOpen(await loadLedger(), now);
  } catch (e) {
    // FAIL CLOSED. An unreachable ledger is not an unlimited budget.
    return { ok: false, reason: 'Spend ledger unreachable, refusing to spend: ' + (e.message || 'unknown') };
  }

  var runCommitted = spentRun(l) + openTotal(l, function (r) { return r.run === RUN_ID; });
  var dayCommitted = spentToday(l) + openTotal(l, function (r) { return r.day === todayKey(); });

  if (c.runUsd != null && (runCommitted + estUsd) > c.runUsd) {
    return {
      ok: false, budgetExhausted: true, window: 'run',
      reason: 'Run budget exhausted: $' + runCommitted.toFixed(4) + ' committed of $' + c.runUsd.toFixed(2) + '; this call needs $' + estUsd.toFixed(4) + '.',
      spentUsd: runCommitted, capUsd: c.runUsd, estUsd: estUsd
    };
  }
  if (c.dailyUsd != null && (dayCommitted + estUsd) > c.dailyUsd) {
    return {
      ok: false, budgetExhausted: true, window: 'day',
      reason: 'Daily budget exhausted: $' + dayCommitted.toFixed(4) + ' committed of $' + c.dailyUsd.toFixed(2) + '; this call needs $' + estUsd.toFixed(4) + '.',
      spentUsd: dayCommitted, capUsd: c.dailyUsd, estUsd: estUsd
    };
  }

  var id = 'rsv-' + now.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  l.open.push({ id: id, usd: estUsd, at: now, run: RUN_ID, day: todayKey(), kind: o.kind || 'ai', label: String(o.label || '').slice(0, 80) });
  try {
    await db.set(LEDGER_KEY, l);
  } catch (e) {
    return { ok: false, reason: 'Could not record the reservation, refusing to spend: ' + (e.message || 'unknown') };
  }
  return { ok: true, id: id, estUsd: estUsd, metered: true };
}

/**
 * Close a reservation with what it actually cost. Idempotent: settling an unknown or
 * already-settled id is a no-op, so a retry cannot double-charge.
 */
async function settle(id, actual) {
  if (!id) return { ok: true, metered: false };
  actual = actual || {};
  var l, now = Date.now();
  try { l = pruneOpen(await loadLedger(), now); } catch (e) { return { ok: false, reason: 'ledger unreachable on settle' }; }

  var idx = -1;
  for (var i = 0; i < l.open.length; i++) { if (l.open[i] && l.open[i].id === id) { idx = i; break; } }
  if (idx === -1) return { ok: true, alreadySettled: true };

  var res = l.open[idx];
  var finalUsd = res.kind === 'ai' && (actual.inputTokens != null || actual.outputTokens != null)
    ? estimateAiUsd({ model: actual.model, inputTokens: actual.inputTokens, outputTokens: actual.outputTokens, cacheReadTokens: actual.cacheReadTokens, cacheWriteTokens: actual.cacheWriteTokens })
    : num(actual.costUsd, num(res.usd, 0));

  l.open.splice(idx, 1);
  l.days[res.day] = num(l.days[res.day], 0) + finalUsd;
  l.runs[res.run] = num(l.runs[res.run], 0) + finalUsd;

  // Keep the ledger small: only recent days and runs are useful, and Upstash bills bandwidth.
  var keepDays = Object.keys(l.days).sort().slice(-14);
  var days = {}; keepDays.forEach(function (k) { days[k] = l.days[k]; }); l.days = days;
  var runKeys = Object.keys(l.runs).slice(-200);
  var runs = {}; runKeys.forEach(function (k) { runs[k] = l.runs[k]; }); l.runs = runs;

  try { await db.set(LEDGER_KEY, l); } catch (e) { return { ok: false, reason: 'ledger write failed on settle' }; }
  return { ok: true, chargedUsd: finalUsd };
}

/** Current spend against both windows, for reporting and for the operator console. */
async function status() {
  var c = caps();
  var l;
  try { l = pruneOpen(await loadLedger(), Date.now()); } catch (e) { return { ok: false, reason: 'ledger unreachable' }; }
  var run = spentRun(l) + openTotal(l, function (r) { return r.run === RUN_ID; });
  var day = spentToday(l) + openTotal(l, function (r) { return r.day === todayKey(); });
  return {
    ok: true, runId: RUN_ID, autonomous: c.autonomous,
    run: { spentUsd: +run.toFixed(4), capUsd: c.runUsd, remainingUsd: c.runUsd == null ? null : +(c.runUsd - run).toFixed(4) },
    day: { spentUsd: +day.toFixed(4), capUsd: c.dailyUsd, remainingUsd: c.dailyUsd == null ? null : +(c.dailyUsd - day).toFixed(4) },
    openReservations: l.open.length
  };
}

module.exports = {
  reserve: reserve, settle: settle, status: status,
  estimateAiUsd: estimateAiUsd,
  MODEL_PRICES: MODEL_PRICES, RUN_ID: RUN_ID
};
