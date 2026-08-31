/**
 * relay-autonomy.js — the one chokepoint every autonomous Relay purchase must pass.
 *
 * Buying from a source marketplace moves money OUT. CLAUDE.md puts that in the
 * FORBIDDEN-autonomously category, not the metered one, so this module exists to make
 * "runs itself 24/7" true without handing the loop an unbounded card.
 *
 * THREE MODES (relay:autonomy.mode, settable from the control panel):
 *   off    nothing is bought. Orders still land and are recorded. Use to stop the world.
 *   queue  DEFAULT. Every purchase is authorised, costed and queued as 'awaiting-approval'.
 *          A human clicks approve and the buy executes. The loop still runs 24/7; only the
 *          money step waits.
 *   auto   The buy executes with no human, subject to EVERY limit below. This is the mode
 *          the operator asked for. It is deliberately not the default.
 *
 * LIMITS, all enforced in auto mode, all fail CLOSED:
 *   perOrderCapUsd    a single source purchase may not exceed this
 *   dailyCeilingUsd   total autonomous spend in a UTC day may not exceed this
 *   minMarginUsd      refuse to buy when the spread does not cover the work
 *   minMarginPct      same, proportionally
 *   requireFunds      the PayPal balance must actually cover it (never spend into overdraft)
 *
 * RESERVE THEN SETTLE: authorize() writes a reservation BEFORE the network call, so two
 * concurrent orders cannot both pass the daily ceiling. settle() converts it to a real
 * spend, release() gives it back if the buy failed. A crash between the two leaves the
 * money reserved, which is the safe direction to fail.
 */

const db = require('./limen-db');

const KEY_CONFIG = 'relay:autonomy';
const KEY_LEDGER = 'relay:autonomy-ledger';

const DEFAULTS = {
  mode: 'queue',
  perOrderCapUsd: 75,
  dailyCeilingUsd: 250,
  minMarginUsd: 8,
  minMarginPct: 0.18,
  requireFunds: true,
  updatedAt: null,
  updatedBy: null
};

const MODES = ['off', 'queue', 'auto'];

function _today() { return new Date().toISOString().slice(0, 10); }
function _id() { return 'auth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
function _round(n) { return Math.round(n * 100) / 100; }

async function getConfig() {
  let stored = null;
  try {
    stored = await db.get(KEY_CONFIG);
  } catch (e) {
    // Ledger unreachable. Fail closed: report 'off' so nothing spends.
    return Object.assign({}, DEFAULTS, { mode: 'off', degraded: true, degradedReason: e.message });
  }
  const cfg = Object.assign({}, DEFAULTS, stored && typeof stored === 'object' ? stored : {});
  if (MODES.indexOf(cfg.mode) === -1) cfg.mode = 'queue';
  return cfg;
}

async function setConfig(patch, who) {
  const cur = await getConfig();
  if (cur.degraded) return { ok: false, error: 'autonomy store unreachable; refusing to write' };

  const next = Object.assign({}, cur, {});
  delete next.degraded;
  delete next.degradedReason;

  if (patch.mode != null) {
    if (MODES.indexOf(patch.mode) === -1) return { ok: false, error: 'mode must be off|queue|auto' };
    next.mode = patch.mode;
  }
  ['perOrderCapUsd', 'dailyCeilingUsd', 'minMarginUsd'].forEach(function (k) {
    if (patch[k] != null) {
      const v = parseFloat(patch[k]);
      if (!isFinite(v) || v < 0) return;
      next[k] = _round(v);
    }
  });
  if (patch.minMarginPct != null) {
    const v = parseFloat(patch.minMarginPct);
    if (isFinite(v) && v >= 0 && v <= 1) next.minMarginPct = v;
  }
  if (patch.requireFunds != null) next.requireFunds = !!patch.requireFunds;

  next.updatedAt = new Date().toISOString();
  next.updatedBy = who || 'unknown';

  try {
    await db.set(KEY_CONFIG, next);
  } catch (e) {
    return { ok: false, error: 'write failed: ' + e.message };
  }
  return { ok: true, config: next };
}

async function _ledger() {
  try {
    const l = await db.get(KEY_LEDGER);
    return Array.isArray(l) ? l : [];
  } catch (e) {
    return null;   // null means unreachable, distinct from empty
  }
}

async function _writeLedger(rows) {
  const trimmed = rows.length > 4000 ? rows.slice(-4000) : rows;
  await db.set(KEY_LEDGER, trimmed);
}

/** Money committed today: reservations still open + settled spends. */
function _spentToday(rows) {
  const d = _today();
  return rows
    .filter(function (r) { return r.day === d && (r.state === 'reserved' || r.state === 'settled'); })
    .reduce(function (s, r) { return s + (r.amount || 0); }, 0);
}

/**
 * authorize({ amount, salePrice, marketplace, orderId, listingId, note })
 *   → { allowed, mode, decisionId, reason, remainingToday, config }
 *
 * allowed:true means AUTO mode cleared every limit and the caller may spend NOW.
 * allowed:false with mode 'queue' is the normal path: the reservation is held and a
 * human approves it. Check `queued` to tell that apart from a hard refusal.
 */
async function authorize(opts) {
  opts = opts || {};
  const amount = _round(parseFloat(opts.amount) || 0);
  const salePrice = parseFloat(opts.salePrice) || 0;
  const cfg = await getConfig();

  const base = { mode: cfg.mode, config: cfg, decisionId: null, queued: false, allowed: false };

  if (!(amount > 0)) {
    return Object.assign(base, { reason: 'amount must be > 0' });
  }
  if (cfg.degraded) {
    return Object.assign(base, { reason: 'autonomy store unreachable; failing closed (' + cfg.degradedReason + ')' });
  }
  if (cfg.mode === 'off') {
    return Object.assign(base, { reason: 'autonomy is OFF; no purchases are being made' });
  }

  const rows = await _ledger();
  if (rows === null) {
    return Object.assign(base, { reason: 'spend ledger unreachable; failing closed' });
  }

  // ── margin check: never buy a spread that does not pay for itself ──
  const marginUsd = _round(salePrice - amount);
  const marginPct = salePrice > 0 ? marginUsd / salePrice : 0;
  const marginChecked = salePrice > 0;
  if (marginChecked && marginUsd < cfg.minMarginUsd) {
    return Object.assign(base, {
      reason: 'margin $' + marginUsd.toFixed(2) + ' is under the $' + cfg.minMarginUsd + ' floor'
    });
  }
  if (marginChecked && marginPct < cfg.minMarginPct) {
    return Object.assign(base, {
      reason: 'margin ' + (marginPct * 100).toFixed(1) + '% is under the ' +
              (cfg.minMarginPct * 100).toFixed(0) + '% floor'
    });
  }

  // ── per-order cap ──
  if (amount > cfg.perOrderCapUsd) {
    return Object.assign(base, {
      reason: '$' + amount.toFixed(2) + ' exceeds the $' + cfg.perOrderCapUsd + ' per-order cap'
    });
  }

  // ── daily ceiling ──
  const spent = _spentToday(rows);
  const remaining = _round(cfg.dailyCeilingUsd - spent);
  if (amount > remaining) {
    return Object.assign(base, {
      remainingToday: remaining,
      reason: '$' + amount.toFixed(2) + ' exceeds today\'s remaining ceiling of $' + remaining.toFixed(2)
    });
  }

  // ── real funds ──
  if (cfg.requireFunds) {
    try {
      const paypal = require('./relay-paypal-balance');
      const bal = await paypal.getCurrentBalance();
      if (!(typeof bal === 'number' && isFinite(bal))) {
        return Object.assign(base, { remainingToday: remaining, reason: 'could not read funding balance; failing closed' });
      }
      if (bal < amount) {
        return Object.assign(base, {
          remainingToday: remaining,
          reason: 'funding balance $' + bal.toFixed(2) + ' does not cover $' + amount.toFixed(2)
        });
      }
    } catch (e) {
      return Object.assign(base, { remainingToday: remaining, reason: 'funding check failed: ' + e.message });
    }
  }

  // ── reserve BEFORE the caller spends ──
  const decisionId = _id();
  const row = {
    id: decisionId,
    day: _today(),
    ts: new Date().toISOString(),
    state: 'reserved',
    amount: amount,
    salePrice: salePrice || null,
    marginUsd: marginChecked ? marginUsd : null,
    marketplace: opts.marketplace || null,
    orderId: opts.orderId || null,
    listingId: opts.listingId || null,
    mode: cfg.mode,
    note: opts.note || null
  };
  rows.push(row);
  try {
    await _writeLedger(rows);
  } catch (e) {
    return Object.assign(base, { reason: 'could not reserve spend: ' + e.message });
  }

  if (cfg.mode === 'queue') {
    return Object.assign(base, {
      allowed: false,
      queued: true,
      decisionId: decisionId,
      remainingToday: _round(remaining - amount),
      reason: 'queued for human approval (mode=queue)'
    });
  }

  return Object.assign(base, {
    allowed: true,
    decisionId: decisionId,
    remainingToday: _round(remaining - amount),
    reason: null
  });
}

/** The buy went through. Convert the reservation into a settled spend. */
async function settle(decisionId, actual) {
  const rows = await _ledger();
  if (rows === null) return { ok: false, error: 'ledger unreachable' };
  const row = rows.find(function (r) { return r.id === decisionId; });
  if (!row) return { ok: false, error: 'no such reservation' };
  if (row.state === 'settled') return { ok: true, row: row, already: true };
  row.state = 'settled';
  row.settledAt = new Date().toISOString();
  if (actual && actual.amount != null) row.amount = _round(parseFloat(actual.amount));
  if (actual && actual.sourceOrderId) row.sourceOrderId = actual.sourceOrderId;
  try { await _writeLedger(rows); } catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, row: row };
}

/** The buy failed or was rejected. Give the headroom back. */
async function release(decisionId, reason) {
  const rows = await _ledger();
  if (rows === null) return { ok: false, error: 'ledger unreachable' };
  const row = rows.find(function (r) { return r.id === decisionId; });
  if (!row) return { ok: false, error: 'no such reservation' };
  if (row.state === 'settled') return { ok: false, error: 'already settled; cannot release' };
  row.state = 'released';
  row.releasedAt = new Date().toISOString();
  row.releaseReason = reason || null;
  try { await _writeLedger(rows); } catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, row: row };
}

/** Approve a queued reservation so the caller may now spend it. */
async function approve(decisionId, who) {
  const rows = await _ledger();
  if (rows === null) return { ok: false, error: 'ledger unreachable' };
  const row = rows.find(function (r) { return r.id === decisionId; });
  if (!row) return { ok: false, error: 'no such reservation' };
  if (row.state !== 'reserved') return { ok: false, error: 'reservation is ' + row.state + ', not reserved' };
  row.approvedAt = new Date().toISOString();
  row.approvedBy = who || 'operator';
  try { await _writeLedger(rows); } catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, row: row };
}

async function pending() {
  const rows = await _ledger();
  if (rows === null) return [];
  return rows.filter(function (r) { return r.state === 'reserved' && !r.approvedAt; });
}

async function status() {
  const cfg = await getConfig();
  const rows = await _ledger();
  if (rows === null) {
    return { ok: false, error: 'ledger unreachable', config: cfg };
  }
  const d = _today();
  const today = rows.filter(function (r) { return r.day === d; });
  const settled = today.filter(function (r) { return r.state === 'settled'; });
  const reserved = today.filter(function (r) { return r.state === 'reserved'; });
  const spent = _spentToday(rows);
  return {
    ok: true,
    date: d,
    config: cfg,
    mode: cfg.mode,
    spentToday: _round(spent),
    remainingToday: _round(cfg.dailyCeilingUsd - spent),
    settledCount: settled.length,
    reservedCount: reserved.length,
    awaitingApproval: reserved.filter(function (r) { return !r.approvedAt; }).length,
    marginToday: _round(settled.reduce(function (s, r) { return s + (r.marginUsd || 0); }, 0))
  };
}

module.exports = {
  MODES,
  DEFAULTS,
  getConfig,
  setConfig,
  authorize,
  settle,
  release,
  approve,
  pending,
  status
};
