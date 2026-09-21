'use strict';

/**
 * stripe-reversals.js — refund, dispute and reversal intake.
 *
 * The code NEVER initiates a refund (subscriptions are final sale; operator refunds
 * happen in the Stripe dashboard), but Stripe delivers charge.refunded and
 * charge.dispute.created/closed regardless of policy, and the books must tell the
 * truth after them. This module is the single intake for those events:
 *
 *   charge.refunded        → one reversal per Stripe refund id: negative
 *                            finance-ledger entry linked to the original booking,
 *                            treasury REFUND receipt (accounting only), sales:agg
 *                            decrement flagged as a reversal, subscriber deactivated
 *                            on a FULL refund of their subscription, operator alert.
 *   charge.dispute.created → dispute recorded with amount/reason/evidence due date,
 *                            treasury DISPUTE_HOLD attempted (see below), operator
 *                            alert. No action against the customer record: a dispute
 *                            is an accusation, not a cancellation.
 *   charge.dispute.closed  → dispute record updated with the outcome; on 'won' a
 *                            DISPUTE_RELEASE is attempted. On 'lost' nothing is
 *                            reversed automatically — the operator reconciles a lost
 *                            dispute deliberately, never by a webhook's guess.
 *
 * IDEMPOTENCY reuses lib/stripe-income-book's claim store: one atomic claim per
 * refund id (scope 'reversal', key <chargeId>:<refundId>) and per dispute id
 * (scope 'dispute'). Claim-before-write; on any failure the claim is RELEASED so
 * Stripe's retry can finish, and storage failures throw so the webhook answers 500
 * (fail closed — an unreadable claim store never becomes a double reversal).
 *
 * NEVER FABRICATE. A reversal is only written against an original booking that was
 * actually found (finance-ledger scan, renewal charge-attribution record, or a
 * matched subscriber). A refund for a charge this system never booked lands on the
 * stripe:reversal:unmatched list with an operator alert — recorded, countable, and
 * replay-safe — instead of inventing an entry against nothing.
 *
 * TREASURY SETTLEMENT-ORDER LIMIT. REFUND draws from the domain's `pending` bucket
 * (where captured sales sit) and posts cleanly. DISPUTE_HOLD draws from `available`,
 * which is zero until settlement is wired, so a hold on an unsettled sale fails the
 * ledger's overdraw guard by design; the failure is named, logged to the treasury
 * unbooked log, and the dispute is still recorded and alerted.
 *
 * OPERATOR ALERTS. There is no email integration for money events; alerts are
 * persisted to the capped stripe:reversals:alerts list and surfaced, with counts
 * and the unmatched/dispute rosters, on the existing admin-gated /api/subscribers
 * JSON (read-only).
 */
var db = require('./limen-db');
var ledger = require('./finance-ledger');
var subs = require('./subscriptions');
var incomeBook = require('./stripe-income-book');
var treasuryBridge = require('./treasury-stripe-bridge');

var ALERTS_KEY = 'stripe:reversals:alerts';
var UNMATCHED_KEY = 'stripe:reversal:unmatched';
var DISPUTES_KEY = 'stripe:disputes:v1';
var ATTR_PREFIX = 'stripe:charge-attr:';
var STATS_KEY = 'stripe:reversals:stats';
var ALERTS_CAP = 200;
var UNMATCHED_CAP = 500;
var DISPUTES_CAP = 200;
var ATTR_TTL = 90 * 86400;

function _redisConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function _ledgerRows() {
  var rows;
  if (_redisConfigured()) rows = await db.lrangeStrict('finance:ledger', 0, 4999);
  else rows = await db.lrange('finance:ledger', 0, 4999);
  if (!Array.isArray(rows)) throw new Error('finance:ledger unreadable');
  return rows;
}

/** The income entry a charge was booked under, or null. charge.refunded names the
    charge id; the original booking may be keyed on the payment_intent, the session,
    or (first subscription payment) the subscription id. Reversal entries (negative
    income) are skipped: they name the same charge but are not a booking to reverse. */
async function _findOriginalBooking(chargeId, paymentIntentId, subscriptionId) {
  var wanted = [chargeId, paymentIntentId, subscriptionId].filter(Boolean).map(String);
  if (!wanted.length) return null;
  var rows = await _ledgerRows();
  for (var i = 0; i < rows.length; i++) {
    var e = rows[i];
    if (!e || e.type !== 'income') continue;
    var m = e.meta || {};
    if (m.reversal) continue;
    if (wanted.indexOf(String(m.chargeId)) !== -1 || wanted.indexOf(String(m.id)) !== -1) return e;
  }
  return null;
}

/** Whether this refund id already produced a reversal entry (retry after partial failure). */
async function _findRefundEntry(refundId) {
  var rows = await _ledgerRows();
  for (var i = 0; i < rows.length; i++) {
    var e = rows[i];
    if (e && e.meta && e.meta.reversal === true && String(e.meta.refundId) === String(refundId)) return e;
  }
  return null;
}

// ── Charge attribution: renewal bookings know charge→domain/subscriber; disputes and
//    refunds arrive naming only the charge, so the booking path leaves this record. ──
async function recordChargeAttribution(chargeId, attr) {
  if (!chargeId) return false;
  try {
    await db.set(ATTR_PREFIX + String(chargeId), Object.assign({ chargeId: String(chargeId), at: new Date().toISOString() }, attr || {}), ATTR_TTL);
    return true;
  } catch (e) { return false; }
}
async function chargeAttribution(chargeId) {
  if (!chargeId) return null;
  try {
    var a = await db.get(ATTR_PREFIX + String(chargeId));
    return (a && typeof a === 'object') ? a : null;
  } catch (e) { return null; }
}

// ── Operator-visible records. Capped: an unbounded failure log is a second outage. ──
async function _pushAlert(entry) {
  var row = Object.assign({ at: new Date().toISOString(), reversal: true }, entry);
  try {
    await db.lpush(ALERTS_KEY, row);
    await db.ltrim(ALERTS_KEY, 0, ALERTS_CAP - 1);
  } catch (e) {}
  return row;
}
async function _pushUnmatched(entry) {
  var row = Object.assign({ at: new Date().toISOString() }, entry);
  try {
    await db.lpush(UNMATCHED_KEY, row);
    await db.ltrim(UNMATCHED_KEY, 0, UNMATCHED_CAP - 1);
  } catch (e) {}
  return row;
}
async function _bump(fn) {
  try {
    var s = (await db.get(STATS_KEY)) || {};
    fn(s);
    s.updatedAt = new Date().toISOString();
    await db.set(STATS_KEY, s);
  } catch (e) {}
}

/** Undo subscription cash in the Sales engine: revenue down, reversed amount labeled. */
async function _reverseSubscriptionRevenue(domain, cents) {
  var agg = await db.get('sales:agg');
  if (agg && typeof agg === 'object') {
    var t = agg['shows>enrollments'];
    var u = t && t.subscriptions;
    if (u) {
      u.revenueCents = Math.max(0, (u.revenueCents || 0) - cents);
      u.reversedCents = (u.reversedCents || 0) + cents;
      await db.set('sales:agg', agg);
    }
  }
  if (domain) {
    var bd = await db.get('sales:leads:by-domain');
    if (bd && typeof bd === 'object' && bd[domain]) {
      bd[domain].revenueCents = Math.max(0, (bd[domain].revenueCents || 0) - cents);
      bd[domain].reversedCents = (bd[domain].reversedCents || 0) + cents;
      await db.set('sales:leads:by-domain', bd);
    }
  }
}

/**
 * Intake for charge.refunded. The event object is the Charge; Stripe sends one
 * event per refunding action and the charge carries the full refunds list, so
 * each refund id is claimed individually and a redelivery (or a second, partial
 * refund arriving in the same list shape) reverses exactly its own amount once.
 */
async function recordRefund(evt, deps) {
  deps = deps || {};
  var store = deps.store;
  var obj = (evt && evt.data && evt.data.object) || {};
  var chargeId = obj.id ? String(obj.id) : null;
  var eventId = evt && evt.id ? String(evt.id) : null;

  if (!chargeId) {
    await _pushUnmatched({ kind: 'refund', reason: 'no-charge-id', eventId: eventId });
    await _pushAlert({ kind: 'refund-malformed', reason: 'no-charge-id', eventId: eventId });
    return { ok: true, recorded: false, reason: 'no-charge-id' };
  }

  var refunds = (obj.refunds && Array.isArray(obj.refunds.data)) ? obj.refunds.data : [];
  if (!refunds.length && (obj.amount_refunded || 0) > 0) {
    /* A charge payload without the refunds expansion: key on the refunded total so a
       redelivery of the same state dedups and a further refund gets a new key. */
    refunds = [{ id: 'amount:' + String(obj.amount_refunded), amount: obj.amount_refunded, synthesized: true }];
  }
  if (!refunds.length) return { ok: true, recorded: false, reason: 'no-refunds-on-charge' };

  var attribution = await chargeAttribution(chargeId);
  var customerId = obj.customer ? String(obj.customer) : (attribution && attribution.customerId) || null;
  var subscriber = null;
  if (store && (customerId || (attribution && attribution.subscriptionId))) {
    subscriber = await subs.findStrict({ customerId: customerId, subscriptionId: attribution && attribution.subscriptionId }, store);
  }
  var original = await _findOriginalBooking(chargeId, obj.payment_intent, subscriber && subscriber.subscriptionId);
  var domain = (subscriber && subscriber.domain) || (attribution && attribution.domain) || null;

  var results = [];
  for (var i = 0; i < refunds.length; i++) {
    var refund = refunds[i] || {};
    var refundId = refund.id ? String(refund.id) : null;
    var refundCents = Math.round(Number(refund.amount) || 0);
    if (!refundId || refundCents <= 0) {
      results.push({ refundId: refundId, booked: false, reason: 'malformed-refund' });
      continue;
    }

    var claimKey = chargeId + ':' + refundId;
    var claim = await incomeBook.claimCharge('reversal', claimKey, { chargeId: chargeId, refundId: refundId, eventId: eventId });
    if (!claim.claimed) {
      await _bump(function (s) { s.duplicatesSuppressed = (s.duplicatesSuppressed || 0) + 1; });
      results.push({ refundId: refundId, booked: false, duplicate: true, record: claim.record || null });
      continue;
    }

    try {
      if (!original && !attribution && !subscriber) {
        /* Unknown charge: nothing was ever booked, so there is nothing to reverse.
           Record the exception where the operator will see it; do NOT invent an entry. */
        await _pushUnmatched({ kind: 'refund', chargeId: chargeId, refundId: refundId, amountCents: refundCents, eventId: eventId });
        await _pushAlert({ kind: 'refund-unmatched', chargeId: chargeId, refundId: refundId, amountCents: refundCents, eventId: eventId });
        await incomeBook.completeCharge('reversal', claimKey, { chargeId: chargeId, refundId: refundId, unmatched: true });
        await _bump(function (s) { s.unmatched = (s.unmatched || 0) + 1; });
        results.push({ refundId: refundId, booked: false, unmatched: true });
        continue;
      }

      /* Cap: never reverse more than was booked. */
      if (original) {
        var bookedCents = Math.round((original.amount || 0) * 100);
        if (refundCents > bookedCents) {
          await _pushAlert({ kind: 'refund-exceeds-booked', chargeId: chargeId, refundId: refundId,
            amountCents: refundCents, bookedCents: bookedCents, eventId: eventId });
          await incomeBook.completeCharge('reversal', claimKey, { chargeId: chargeId, refundId: refundId, refused: 'refund-exceeds-booked' });
          results.push({ refundId: refundId, booked: false, refused: 'refund-exceeds-booked', bookedCents: bookedCents });
          continue;
        }
      }

      /* Negative finance-ledger entry, linked to the original booking, so the book
         (and its per-stream summary) nets to zero on a full reversal. Only when the
         charge actually booked to this ledger (renewals never did), and deduped on
         the refund id so a retry after a partial failure cannot write it twice. */
      var ledgerWrote = false;
      if (original) {
        var prior = await _findRefundEntry(refundId);
        if (!prior) {
          await ledger.record({
            type: 'income', streamId: original.streamId || null, amount: -(refundCents / 100),
            currency: obj.currency || 'usd', source: 'stripe:charge.refunded',
            meta: {
              id: refundId, refundId: refundId, chargeId: chargeId, eventId: eventId,
              reversal: true, originalChargeKey: (original.meta && original.meta.chargeId) || null,
              originalEventId: (original.meta && original.meta.eventId) || null
            }
          });
          ledgerWrote = true;
        }
      }

      /* Treasury reversal (accounting only). No domain → named reason, nothing posted. */
      var treasury = { booked: false, reason: 'domain-unattributable' };
      if (domain) {
        treasury = await treasuryBridge.bookRefund({
          store: store, domain: domain, refundCents: refundCents, refundId: refundId, eventId: eventId
        });
      }

      /* Sales aggregate: only subscription cash ever booked there. */
      var subscriptionMoney = !!(subscriber || (attribution && attribution.subscriptionId));
      if (subscriptionMoney) await _reverseSubscriptionRevenue(domain, refundCents);

      /* Entitlement: a FULL refund of the subscriber's charge stops delivery. A partial
         refund is a service gesture, not a cancellation, so it never deactivates. */
      var fullRefund = (obj.amount || 0) > 0 && (obj.amount_refunded || 0) >= obj.amount;
      var deactivation = null;
      if (fullRefund && subscriber && subscriber.active) {
        deactivation = await subs.deactivateStrict(
          { customerId: subscriber.customerId || customerId, subscriptionId: subscriber.subscriptionId },
          'refunded', store);
      }

      await _pushAlert({
        kind: 'refund', chargeId: chargeId, refundId: refundId, amountCents: refundCents,
        currency: obj.currency || 'usd', domain: domain, streamId: original ? original.streamId || null : null,
        fullRefund: fullRefund, ledgerEntry: ledgerWrote, treasuryBooked: treasury.booked === true,
        treasuryReason: treasury.reason || null, deactivated: (deactivation && deactivation.changed) || 0,
        subscriber: subscriber ? subscriber.email : null, eventId: eventId
      });
      await incomeBook.completeCharge('reversal', claimKey, {
        chargeId: chargeId, refundId: refundId, amountCents: refundCents, domain: domain,
        ledgerEntry: ledgerWrote, treasuryBooked: treasury.booked === true,
        deactivated: (deactivation && deactivation.changed) || 0
      });
      await _bump(function (s) {
        s.refundsBooked = (s.refundsBooked || 0) + 1;
        s.refundCents = (s.refundCents || 0) + refundCents;
      });
      results.push({
        refundId: refundId, booked: true, amountCents: refundCents, domain: domain,
        ledgerEntry: ledgerWrote, treasuryBooked: treasury.booked === true,
        treasuryReason: treasury.reason || null, fullRefund: fullRefund,
        deactivated: (deactivation && deactivation.changed) || 0
      });
    } catch (e) {
      /* Hand the claim back so Stripe's retry can finish the reversal; holding it
         would turn a transient failure into a permanently unreversed refund. */
      try { await incomeBook.releaseCharge('reversal', claimKey); } catch (_) {}
      throw e;
    }
  }

  return { ok: true, recorded: true, chargeId: chargeId, domain: domain, refunds: results };
}

/**
 * Intake for charge.dispute.created / charge.dispute.closed. The event object is the
 * Dispute. Recorded with amount/reason/evidence due date, alerted once per dispute
 * per direction, and — created only — a treasury DISPUTE_HOLD is attempted. The
 * customer record is never touched: entitlement follows Stripe's subscription
 * state, not an unresolved accusation.
 */
async function recordDispute(evt, deps) {
  deps = deps || {};
  var store = deps.store;
  var obj = (evt && evt.data && evt.data.object) || {};
  var eventId = evt && evt.id ? String(evt.id) : null;
  var disputeId = obj.id ? String(obj.id) : null;
  var chargeId = obj.charge ? String(obj.charge) : null;

  if (!disputeId) {
    await _pushUnmatched({ kind: 'dispute', reason: 'no-dispute-id', eventId: eventId });
    await _pushAlert({ kind: 'dispute-malformed', reason: 'no-dispute-id', eventId: eventId });
    return { ok: true, recorded: false, reason: 'no-dispute-id' };
  }

  var closed = evt.type === 'charge.dispute.closed';
  var claimKey = disputeId + ':' + (closed ? 'closed' : 'created');
  var claim = await incomeBook.claimCharge('dispute', claimKey, { disputeId: disputeId, chargeId: chargeId, eventId: eventId, phase: closed ? 'closed' : 'created' });
  if (!claim.claimed) {
    await _bump(function (s) { s.duplicatesSuppressed = (s.duplicatesSuppressed || 0) + 1; });
    return { ok: true, recorded: false, duplicate: true, disputeId: disputeId, record: claim.record || null };
  }

  try {
    var attribution = await chargeAttribution(chargeId);
    var subscriber = null;
    if (store && attribution && (attribution.customerId || attribution.subscriptionId)) {
      subscriber = await subs.findStrict({ customerId: attribution.customerId, subscriptionId: attribution.subscriptionId }, store);
    }
    var domain = (subscriber && subscriber.domain) || (attribution && attribution.domain) || null;

    /* Persist the dispute record (created and closed both land here; closed updates
       the outcome on the record created first). */
    var disputes = null;
    try { disputes = await db.get(DISPUTES_KEY); } catch (e) { disputes = null; }
    if (!disputes || typeof disputes !== 'object' || Array.isArray(disputes)) disputes = {};
    var prev = disputes[disputeId] || null;
    var record = {
      disputeId: disputeId, chargeId: chargeId,
      amountCents: Math.round(Number(obj.amount) || 0), currency: obj.currency || 'usd',
      reason: obj.reason || null, status: obj.status || null,
      dueBy: obj.evidence_details && obj.evidence_details.due_by
        ? new Date(obj.evidence_details.due_by * 1000).toISOString() : (prev && prev.dueBy) || null,
      domain: domain || (prev && prev.domain) || null,
      subscriber: (subscriber && subscriber.email) || (prev && prev.subscriber) || null,
      eventId: eventId,
      createdAt: (prev && prev.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    disputes[disputeId] = record;
    var ids = Object.keys(disputes);
    if (ids.length > DISPUTES_CAP) {
      ids.sort(function (a, b) { return String(disputes[a].createdAt).localeCompare(String(disputes[b].createdAt)); });
      while (ids.length > DISPUTES_CAP) { delete disputes[ids.shift()]; }
    }
    await db.set(DISPUTES_KEY, disputes);

    /* Treasury reflection. HOLD on created, RELEASE on closed-won. Both draw on
       `available`, which is zero before settlement exists, so an overdraw refusal is
       expected and recorded rather than worked around. On closed-LOST nothing is
       reversed automatically: the operator reconciles a lost dispute deliberately. */
    var treasury = { booked: false, reason: null };
    if (!closed) {
      treasury = domain
        ? await treasuryBridge.bookDisputeHold({ store: store, domain: domain, amountCents: record.amountCents, disputeId: disputeId, eventId: eventId })
        : { booked: false, reason: 'domain-unattributable' };
    } else if (record.status === 'won') {
      treasury = domain
        ? await treasuryBridge.bookDisputeRelease({ store: store, domain: domain, amountCents: record.amountCents, disputeId: disputeId, eventId: eventId })
        : { booked: false, reason: 'domain-unattributable' };
    } else {
      treasury = { booked: false, reason: 'dispute-' + String(record.status || 'closed') + '-no-automatic-reversal' };
    }

    if (!chargeId && !domain) {
      await _pushUnmatched({ kind: 'dispute', disputeId: disputeId, reason: 'no-charge-reference', eventId: eventId });
    }
    await _pushAlert({
      kind: closed ? 'dispute-closed' : 'dispute', disputeId: disputeId, chargeId: chargeId,
      amountCents: record.amountCents, currency: record.currency, reason: record.reason,
      status: record.status, dueBy: record.dueBy, domain: record.domain,
      subscriber: record.subscriber, treasuryBooked: treasury.booked === true,
      treasuryReason: treasury.reason || null, eventId: eventId
    });
    await incomeBook.completeCharge('dispute', claimKey, {
      disputeId: disputeId, chargeId: chargeId, amountCents: record.amountCents,
      status: record.status, domain: record.domain, treasuryBooked: treasury.booked === true
    });
    await _bump(function (s) {
      if (closed) s.disputesClosed = (s.disputesClosed || 0) + 1;
      else s.disputesCreated = (s.disputesCreated || 0) + 1;
    });
    return {
      ok: true, recorded: true, disputeId: disputeId, chargeId: chargeId, domain: record.domain,
      status: record.status, reason: record.reason, dueBy: record.dueBy,
      treasuryBooked: treasury.booked === true, treasuryReason: treasury.reason || null
    };
  } catch (e) {
    try { await incomeBook.releaseCharge('dispute', claimKey); } catch (_) {}
    throw e;
  }
}

async function stats() {
  try { return (await db.get(STATS_KEY)) || {}; } catch (e) { return { unreadable: true }; }
}

/** Read-only bundle for the admin subscribers JSON: counts, recent alerts, rosters. */
async function operatorSummary() {
  var out = { ok: true, stats: await stats(), recentAlerts: [], unmatched: { count: 0, recent: [] }, disputes: { total: 0, open: 0, recent: [] }, foreignSkips: { count: 0, recent: [] } };
  try {
    out.foreignSkips = await incomeBook.skippedForeign();
  } catch (e) { out.foreignSkips = { count: null, recorded: null, recent: [], unreadable: true }; }
  try {
    out.recentAlerts = await db.lrange(ALERTS_KEY, 0, 9) || [];
  } catch (e) { out.alertsUnreadable = true; }
  try {
    var u = await db.lrange(UNMATCHED_KEY, 0, UNMATCHED_CAP - 1) || [];
    out.unmatched = { count: u.length, recent: u.slice(0, 10) };
  } catch (e) { out.unmatched = { count: null, recent: [], unreadable: true }; }
  try {
    var d = await db.get(DISPUTES_KEY);
    if (d && typeof d === 'object') {
      var list = Object.keys(d).map(function (k) { return d[k]; }).filter(Boolean);
      list.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
      out.disputes = {
        total: list.length,
        open: list.filter(function (x) { return ['won', 'lost'].indexOf(String(x.status)) === -1; }).length,
        recent: list.slice(0, 10)
      };
    }
  } catch (e) { out.disputes = { total: null, open: null, recent: [], unreadable: true }; }
  return out;
}

module.exports = {
  recordRefund: recordRefund,
  recordDispute: recordDispute,
  recordChargeAttribution: recordChargeAttribution,
  chargeAttribution: chargeAttribution,
  operatorSummary: operatorSummary,
  stats: stats,
  ALERTS_KEY: ALERTS_KEY,
  UNMATCHED_KEY: UNMATCHED_KEY,
  DISPUTES_KEY: DISPUTES_KEY,
  STATS_KEY: STATS_KEY
};
