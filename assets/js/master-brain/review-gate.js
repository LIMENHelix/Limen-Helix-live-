/**
 * LIMEN Master Brain — Review Gate (scaffolding) — Phase 3
 *
 * In-memory, session-scoped queue for MasterBrainDecision items that
 * imply human review. Pure synchronous scaffolding. No UI. No events.
 * No persistence. No network. No auto-enqueue. No artifact generation.
 *
 * Exposes: window.LIMENMasterBrain.review = {
 *   isReviewEligible(decision)    -> boolean
 *   enqueue(decision, opts?)      -> ReviewItem | null
 *   resolve(decisionId, input)    -> ReviewItem | null
 *   dismiss(decisionId, reason?)  -> ReviewItem | null
 *   clear()                       -> void
 *   pending()                     -> ReviewItem[]
 *   all()                         -> ReviewItem[]
 *   get(decisionId)               -> ReviewItem | null
 *   stats()                       -> { pending, reviewed, dismissed, total }
 * }
 *
 * Eligibility (content-based):
 *   review-eligible iff ANY of:
 *     - decision.humanReviewRequired === true
 *     - decision.proposal.proposedNext === 'schedule_review'
 *     - decision.class === 'contradiction'
 *     - decision.class === 'insufficient_evidence'
 *
 * ReviewItem = {
 *   decisionId, enqueuedAt, cycleId, class, subject, proposal,
 *   status: 'pending'|'reviewed'|'dismissed',
 *   reviewedAt, reviewer,
 *   reviewDisposition: 'approved'|'rejected'|'deferred'|null,
 *   notes, decisionSnapshot
 * }
 *
 * Invariants / guarantees:
 *   - Pure synchronous. No Promise / setTimeout / queueMicrotask.
 *   - No addEventListener, dispatchEvent, CustomEvent.
 *   - No localStorage / sessionStorage / IndexedDB / cookies.
 *   - No fetch, XHR, sendBeacon, WebSocket, EventSource.
 *   - No DOM query or mutation.
 *   - decide() is NEVER called from this module. No auto-enqueue.
 *   - Deep-clone on enqueue AND on every returned snapshot — caller
 *     mutation can neither corrupt module state nor be corrupted by it.
 *   - Idempotent enqueue: same decision.id returns existing item, no
 *     overwrite, no status change.
 *   - reviewed / dismissed items are terminal. Re-resolution or
 *     re-dismissal returns null. clear() is the only reset.
 *
 * Spec alignment: Master Brain §5 (review routing stub), §6 (auto-emit
 * classes remain unrouted here — this module never acts, only records).
 *
 * Not in this phase: UI, persistence, telemetry, auto-enqueue from
 * decide(), event dispatch, network submission, artifact drafting.
 */
(function () {
  'use strict';

  // ── Private state (closure-scoped; unreachable from outside) ────────
  var _items = [];
  var _byId  = Object.create(null);

  var VALID_DISPOSITIONS = { approved: 1, rejected: 1, deferred: 1 };

  // ── Helpers ────────────────────────────────────────────────────────
  function _now() { return Date.now(); }

  function _isNonEmptyString(s) {
    return typeof s === 'string' && s.length > 0;
  }

  // Mirror of oib-assembler._safeClone: structuredClone → JSON fallback.
  function _deepClone(v) {
    if (v === null || typeof v === 'undefined') return null;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function _validateDecision(d) {
    if (!d || typeof d !== 'object') return false;
    if (!_isNonEmptyString(d.id))      return false;
    if (!_isNonEmptyString(d.cycleId)) return false;
    if (!_isNonEmptyString(d.class))   return false;
    return true;
  }

  // ReviewItem is always JSON-safe by construction; _deepClone won't
  // return null for a valid stored item.
  function _snapshot(item) { return _deepClone(item); }

  // ── Eligibility predicate (pure) ───────────────────────────────────
  function isReviewEligible(decision) {
    if (!decision || typeof decision !== 'object') return false;
    if (decision.humanReviewRequired === true) return true;
    var prop = decision.proposal;
    if (prop && prop.proposedNext === 'schedule_review') return true;
    if (decision.class === 'contradiction')         return true;
    if (decision.class === 'insufficient_evidence') return true;
    return false;
  }

  // ── Mutators ───────────────────────────────────────────────────────
  function enqueue(decision, opts) {
    if (!_validateDecision(decision)) return null;

    var existing = _byId[decision.id];
    if (existing) return _snapshot(existing);        // idempotent; no overwrite

    var force = !!(opts && opts.force === true);
    if (!force && !isReviewEligible(decision)) return null;

    var item = {
      decisionId:        decision.id,
      enqueuedAt:        _now(),
      cycleId:           decision.cycleId,
      class:             decision.class,
      subject:           _deepClone(decision.subject  || {}),
      proposal:          _deepClone(decision.proposal || {}),
      status:            'pending',
      reviewedAt:        null,
      reviewer:          null,
      reviewDisposition: null,
      notes:             null,
      decisionSnapshot:  _deepClone(decision)
    };

    _items.push(item);
    _byId[item.decisionId] = item;
    return _snapshot(item);
  }

  function resolve(decisionId, input) {
    if (!_isNonEmptyString(decisionId)) return null;
    if (!input || typeof input !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(VALID_DISPOSITIONS, input.disposition)) return null;

    var item = _byId[decisionId];
    if (!item) return null;
    if (item.status !== 'pending') return null;

    var reviewer = (typeof input.reviewer === 'string') ? input.reviewer : null;
    var notes    = (typeof input.notes    === 'string') ? input.notes    : null;

    item.status            = 'reviewed';
    item.reviewedAt        = _now();
    item.reviewer          = reviewer;
    item.reviewDisposition = input.disposition;
    item.notes             = notes;
    return _snapshot(item);
  }

  function dismiss(decisionId, reason) {
    if (!_isNonEmptyString(decisionId)) return null;
    if (typeof reason !== 'undefined' && typeof reason !== 'string') return null;

    var item = _byId[decisionId];
    if (!item) return null;
    if (item.status !== 'pending') return null;

    item.status            = 'dismissed';
    item.reviewedAt        = _now();
    item.reviewer          = null;
    item.reviewDisposition = null;
    if (_isNonEmptyString(reason)) {
      var prefix = item.notes ? item.notes + ' | ' : '';
      item.notes = prefix + 'dismissed: ' + reason;
    }
    return _snapshot(item);
  }

  function clear() {
    _items = [];
    _byId  = Object.create(null);
  }

  // ── Queries (all return deep clones) ───────────────────────────────
  function pending() {
    var out = [];
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].status === 'pending') out.push(_snapshot(_items[i]));
    }
    return out;
  }

  function all() {
    var out = [];
    for (var i = 0; i < _items.length; i++) out.push(_snapshot(_items[i]));
    return out;
  }

  function get(decisionId) {
    if (!_isNonEmptyString(decisionId)) return null;
    var item = _byId[decisionId];
    return item ? _snapshot(item) : null;
  }

  function stats() {
    var s = { pending: 0, reviewed: 0, dismissed: 0, total: _items.length };
    for (var i = 0; i < _items.length; i++) {
      var st = _items[i].status;
      if (st === 'pending')   s.pending++;
      else if (st === 'reviewed')  s.reviewed++;
      else if (st === 'dismissed') s.dismissed++;
    }
    return s;
  }

  // ── Public namespace attachment (extension, not replacement) ───────
  var review = {
    isReviewEligible: isReviewEligible,
    enqueue:          enqueue,
    resolve:          resolve,
    dismiss:          dismiss,
    clear:            clear,
    pending:          pending,
    all:              all,
    get:              get,
    stats:            stats
  };

  if (typeof window !== 'undefined') {
    window.LIMENMasterBrain = window.LIMENMasterBrain || {};
    window.LIMENMasterBrain.review = review;
  }
})();
