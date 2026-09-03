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

/**
 * Does the funding account cover this spend? → { ok } or { ok:false, reason }
 *
 * Factored out so authorize() and consumeApproved() ask the SAME question. Approval is a
 * human action with human-length delay: a balance that covered the purchase when the
 * reservation was made may not cover it an hour later, and the contract is "never spend
 * into overdraft", not "never start to".
 *
 * Fails CLOSED on an unreadable balance. Note the known limitation, stated rather than
 * hidden: getCurrentBalance() returns `cachedBalance || 0` on every error path, so an
 * outage currently arrives here as a confident $0 rather than as "cannot tell". That
 * refuses, which is the safe direction, but it refuses with the wrong REASON — and it
 * reads the PayPal balance, which is not the account a CJ purchase debits at all. Both
 * are the subject of the funding-source work; this function is where that fix lands.
 */
async function _fundsCover(cfg, amount) {
  if (!cfg.requireFunds) return { ok: true };
  const need = _round(parseFloat(amount) || 0);
  if (!(need > 0)) return { ok: true };
  try {
    const paypal = require('./relay-paypal-balance');
    const bal = await paypal.getCurrentBalance();
    if (!(typeof bal === 'number' && isFinite(bal))) {
      return { ok: false, reason: 'could not read funding balance; failing closed' };
    }
    if (bal < need) {
      return { ok: false, reason: 'funding balance $' + bal.toFixed(2) + ' does not cover $' + need.toFixed(2) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'funding check failed: ' + e.message };
  }
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
  // `plannedToday` is spend a caller is about to commit to in the same breath but has not
  // reserved yet: the other lines of a cart. Without it every line of a cart dry-runs
  // against the same untouched ledger, so two $60 lines both pass against $100 remaining,
  // the customer is charged for both, and the SECOND real authorisation during fulfilment
  // is the one that discovers it — on a paid order.
  const planned = Math.max(0, parseFloat(opts.plannedToday) || 0);
  const spent = _spentToday(rows);
  const remaining = _round(cfg.dailyCeilingUsd - spent);
  if (_round(amount + planned) > remaining) {
    return Object.assign(base, {
      remainingToday: remaining,
      reason: planned > 0
        ? '$' + amount.toFixed(2) + ' plus $' + planned.toFixed(2) + ' already in this cart ' +
          'exceeds today\'s remaining ceiling of $' + remaining.toFixed(2)
        : '$' + amount.toFixed(2) + ' exceeds today\'s remaining ceiling of $' + remaining.toFixed(2)
    });
  }

  // ── real funds ──
  const funds = await _fundsCover(cfg, _round(amount + planned));
  if (!funds.ok) return Object.assign(base, { remainingToday: remaining, reason: funds.reason });

  // ── a dry run answers, without taking a reservation ──
  // Checkout asks this before charging anybody, so a sale the fulfilment loop would
  // refuse is refused while refusing is still free. It deliberately runs the SAME code:
  // a second copy of these rules living in the checkout handlers would drift from this
  // one inside a release, and the copy that matters is this one.
  if (opts.dryRun) {
    return Object.assign(base, {
      allowed: true,
      queued: cfg.mode === 'queue',
      remainingToday: remaining,
      dryRun: true,
      reason: null
    });
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

/**
 * consumeApproved({ decisionId, orderId, listingId, amount })
 *   → { allowed:true, decisionId, ... }   the human's approval is spent, buy now
 *   → { allowed:false, reason }           not consumable; caller falls back to authorize()
 *
 * THE DEFECT THIS CLOSES
 * approve() stamped approvedAt and nothing ever read it. fulfillLine called authorize()
 * again, which in queue mode created a SECOND reservation and re-queued, so the click
 * bought nothing — and neither reservation was ever settled or released, so every click
 * burned the line cost twice out of dailyCeilingUsd until the UTC day rolled.
 *
 * This is a GATE, not a bypass. Everything authorize() would refuse, this refuses:
 *
 *   mode 'off'      the kill switch means nothing is bought. An approval granted before
 *                   the switch was thrown is not permission to spend after it.
 *   degraded        an unreadable config fails closed, exactly as authorize() does.
 *   queue only      the row must have been reserved in queue mode. An in-flight 'auto'
 *                   reservation, or one orphaned by a crash, is not something a human
 *                   approved — approve() will stamp any reserved row, so this is the
 *                   check that makes the stamp mean what it says.
 *   funds           re-checked HERE. Approval is a human action with human-length delay;
 *                   a balance that covered the purchase at reserve time may not cover it
 *                   an hour later, and requireFunds says "never spend into overdraft",
 *                   not "never start to".
 *   binding         the row must be for this order, this listing, and the same amount.
 *   same day        a reservation counts against the day it was made; consuming it on a
 *                   later day would spend against a ceiling it was never counted in.
 *
 * The row is NOT settled here. It stays 'reserved' so it still counts against today's
 * ceiling while the purchase is in flight, and the caller settles or releases it exactly
 * as it does for a fresh authorize() — one reservation, one outcome.
 */
async function consumeApproved(opts) {
  opts = opts || {};
  const cfg = await getConfig();
  const base = { mode: cfg.mode, config: cfg, decisionId: null, queued: false, allowed: false };

  if (cfg.degraded) {
    return Object.assign(base, { reason: 'autonomy store unreachable; failing closed (' + cfg.degradedReason + ')' });
  }
  if (cfg.mode === 'off') {
    return Object.assign(base, { reason: 'autonomy is OFF; an earlier approval does not authorise a purchase now' });
  }
  if (!opts.decisionId) return Object.assign(base, { reason: 'no decisionId' });

  const rows = await _ledger();
  if (rows === null) return Object.assign(base, { reason: 'spend ledger unreachable; failing closed' });

  const row = rows.find(function (r) { return r.id === opts.decisionId; });
  if (!row) return Object.assign(base, { reason: 'no such reservation' });
  if (row.state !== 'reserved') return Object.assign(base, { reason: 'reservation is ' + row.state + ', not reserved' });
  if (!row.approvedAt) return Object.assign(base, { reason: 'that reservation has not been approved' });
  if (row.mode !== 'queue') return Object.assign(base, { reason: 'that reservation was not queued for approval' });
  if (row.consumedAt) return Object.assign(base, { reason: 'that approval has already been used' });
  if (row.day !== _today()) return Object.assign(base, { reason: 'that approval is from ' + row.day + ' and cannot be spent today' });
  if (opts.orderId && row.orderId && row.orderId !== opts.orderId) {
    return Object.assign(base, { reason: 'that reservation belongs to a different order' });
  }
  if (opts.listingId && row.listingId && row.listingId !== opts.listingId) {
    return Object.assign(base, { reason: 'that reservation belongs to a different line' });
  }
  // The amount must not have grown since the human looked at it. A freight requote can
  // move it, and an approval is of a number, not of an intention.
  const want = _round(parseFloat(opts.amount) || 0);
  if (want > 0 && row.amount != null && want > _round(row.amount) + 0.005) {
    return Object.assign(base, {
      reason: 'this line now costs $' + want.toFixed(2) + ', more than the $' +
              Number(row.amount).toFixed(2) + ' that was approved'
    });
  }

  const funds = await _fundsCover(cfg, row.amount);
  if (!funds.ok) return Object.assign(base, { reason: funds.reason });

  row.consumedAt = new Date().toISOString();
  try { await _writeLedger(rows); } catch (e) {
    return Object.assign(base, { reason: 'could not mark the approval used: ' + e.message });
  }

  return Object.assign(base, {
    allowed: true,
    decisionId: row.id,
    approvedBy: row.approvedBy || null,
    reason: null
  });
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
  consumeApproved,
  settle,
  release,
  approve,
  pending,
  status
};
