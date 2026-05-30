/**
 * MB-A — Master Brain Artifact Council Intake (scaffold, honest empty-state).
 *
 * STATUS: SCAFFOLD. This module accepts manually pasted intake objects only.
 * It does NOT auto-enqueue from Civilization, does NOT poll any endpoint,
 * does NOT submit, file, trade, or send anything externally, and does NOT
 * grant execution authority. It only stores intake-shaped JSON in a
 * session-scoped queue (sessionStorage + in-memory mirror) so the operator
 * can inspect the shape Master Brain will eventually consume.
 *
 * Intake contract (MB-A v1, minimal):
 *   {
 *     artifactPacket:        object   // ArtifactPacket as emitted by builder
 *     lane:                  string   // one of ALLOWED_LANES
 *     artifactCouncilStatus: string   // one of ALLOWED_AC_STATUS
 *     humanReviewStatus:     string   // one of ALLOWED_HR_STATUS
 *     source:                string   // must be 'ArtifactCouncil'
 *     createdAt:             string|number  // ISO or epoch ms
 *     notes:                 string?  // optional free-form operator note
 *   }
 *
 * Status tiers (ALLOWED_AC_STATUS — drives card classification):
 *   draft_only            — endpoint produced a draft, no critique yet
 *   critique_only         — Grok critique returned, no human review
 *   reviewed_local        — operator hit "Mark locally reviewed"; not validated
 *   verifier_pending      — D3-D verifier not yet wired; status placeholder
 *   human_review_required — needs operator review before any further step
 *   blocked               — intake refused by validators or marked blocked
 *
 * Human review tiers (ALLOWED_HR_STATUS):
 *   not_reviewed | reviewed_local | reviewed_external | rejected
 *
 * Anti-overclaim invariants:
 *   - executionAllowed is ALWAYS false on every stored item.
 *   - No item ever transitions to a state that asserts submission readiness,
 *     filing readiness, funding, eligibility, approval, reviewer consensus,
 *     intellectual merit established, broader impacts achieved, prior award
 *     success, or Master Brain handoff.
 *   - 'reviewed_local' means an operator clicked a button. It is NOT
 *     validation, NOT external review, NOT approval.
 *
 * Persistence:
 *   - sessionStorage key 'limen.mb.artifactIntakeQueue.v1' (session scope only).
 *   - Cleared by close-of-session, page navigation between origins, or
 *     manual clear() call. Survives a single-tab page refresh.
 *   - In-memory mirror for fast reads; sessionStorage is source of truth.
 *
 * No DOM. No network. No auto-enqueue. No timers. No external writes.
 * Pure data module, manually invoked by the Inbox page.
 *
 * Exposes: window.LIMENMasterBrain.artifactIntake
 */
(function () {
  'use strict';

  var SCHEMA_VERSION = 'MB-A.v1';
  var STORAGE_KEY    = 'limen.mb.artifactIntakeQueue.v1';

  var ALLOWED_LANES = {
    'patents': 1,
    'nsf-project-pitch': 1,
    'business-grants': 1,
    'research-grants': 1,
    'sba-loans': 1,
    'franchise': 1,
    'investments': 1,
    'research-papers': 1,
    'copyrights': 1
  };

  var ALLOWED_AC_STATUS = {
    'draft_only': 1,
    'critique_only': 1,
    'reviewed_local': 1,
    'verifier_pending': 1,
    'human_review_required': 1,
    'blocked': 1
  };

  var ALLOWED_HR_STATUS = {
    'not_reviewed': 1,
    'reviewed_local': 1,
    'reviewed_external': 1,
    'rejected': 1
  };

  var REQUIRED_SOURCE = 'ArtifactCouncil';

  // ── In-memory mirror; sessionStorage is the source of truth ─────────
  var _items = [];

  function _has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function _isStr(v) { return typeof v === 'string' && v.length > 0; }
  function _isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function _safeClone(v) {
    if (v === null || typeof v === 'undefined') return null;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function _readStore() {
    try {
      if (typeof sessionStorage === 'undefined') return [];
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function _writeStore() {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_items));
      return true;
    } catch (e) { return false; }
  }

  // Init from sessionStorage on module load (no auto-enqueue, just rehydrate).
  _items = _readStore();

  // ── Validator ─────────────────────────────────────────────────────
  function validate(intake) {
    var errors = [];
    if (!_isObj(intake)) {
      return { ok: false, errors: ['intake is not a plain object'] };
    }

    if (!_isObj(intake.artifactPacket)) {
      errors.push('artifactPacket: must be a plain object');
    }
    if (!_isStr(intake.lane) || !_has(ALLOWED_LANES, intake.lane)) {
      errors.push('lane: must be one of [' + Object.keys(ALLOWED_LANES).join(', ') + ']');
    }
    if (!_isStr(intake.artifactCouncilStatus) ||
        !_has(ALLOWED_AC_STATUS, intake.artifactCouncilStatus)) {
      errors.push('artifactCouncilStatus: must be one of [' +
                  Object.keys(ALLOWED_AC_STATUS).join(', ') + ']');
    }
    if (!_isStr(intake.humanReviewStatus) ||
        !_has(ALLOWED_HR_STATUS, intake.humanReviewStatus)) {
      errors.push('humanReviewStatus: must be one of [' +
                  Object.keys(ALLOWED_HR_STATUS).join(', ') + ']');
    }
    if (intake.source !== REQUIRED_SOURCE) {
      errors.push('source: must be exactly "' + REQUIRED_SOURCE + '"');
    }
    if (!_isStr(intake.createdAt) && typeof intake.createdAt !== 'number') {
      errors.push('createdAt: must be ISO string or epoch ms');
    }
    // notes is optional; if present must be a string.
    if (_has(intake, 'notes') && intake.notes !== null &&
        typeof intake.notes !== 'undefined' && typeof intake.notes !== 'string') {
      errors.push('notes: must be a string when present');
    }

    return errors.length === 0 ? { ok: true } : { ok: false, errors: errors };
  }

  // ── Mutators ──────────────────────────────────────────────────────
  function enqueue(intake) {
    var v = validate(intake);
    if (!v.ok) return { ok: false, errors: v.errors };

    var clone = _safeClone(intake);
    if (!clone) return { ok: false, errors: ['intake failed deep-clone'] };

    var pkt = clone.artifactPacket || {};
    var idy = (pkt && pkt.identity) || {};
    var stableId = 'mb-a-' + Date.now() + '-' +
      (typeof crypto !== 'undefined' && crypto.getRandomValues
        ? Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('')
        : Math.random().toString(16).slice(2, 10));

    var item = {
      id:                    stableId,
      schemaVersion:         SCHEMA_VERSION,
      enqueuedAt:            Date.now(),
      lane:                  clone.lane,
      artifactCouncilStatus: clone.artifactCouncilStatus,
      humanReviewStatus:     clone.humanReviewStatus,
      source:                clone.source,
      createdAt:             clone.createdAt,
      notes:                 typeof clone.notes === 'string' ? clone.notes : null,
      artifactPacketSummary: {
        identityId:          idy.id || null,
        sourceOpportunityId: idy.sourceOpportunityId || null,
        domain:              idy.domain || null,
        node:                idy.node || null,
        title:               idy.title || null,
        diagnoses:           Array.isArray(idy.diagnoses) ? idy.diagnoses.slice(0, 8) : []
      },
      artifactPacket:        clone.artifactPacket,
      executionAllowed:      false   // INVARIANT: never set true.
    };

    _items.push(item);
    _writeStore();
    return { ok: true, item: _safeClone(item) };
  }

  function clear() {
    _items = [];
    _writeStore();
  }

  function remove(id) {
    if (!_isStr(id)) return false;
    var before = _items.length;
    _items = _items.filter(function (it) { return it.id !== id; });
    if (_items.length === before) return false;
    _writeStore();
    return true;
  }

  // ── Queries (deep-clone defensively) ──────────────────────────────
  function list() {
    var out = [];
    for (var i = 0; i < _items.length; i++) out.push(_safeClone(_items[i]));
    return out;
  }

  function get(id) {
    if (!_isStr(id)) return null;
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].id === id) return _safeClone(_items[i]);
    }
    return null;
  }

  function stats() {
    var s = { total: _items.length };
    var ac = Object.keys(ALLOWED_AC_STATUS);
    for (var i = 0; i < ac.length; i++) s[ac[i]] = 0;
    for (var j = 0; j < _items.length; j++) {
      var k = _items[j].artifactCouncilStatus;
      if (_has(s, k)) s[k] = s[k] + 1;
    }
    return s;
  }

  function describeStatusTiers() {
    return {
      draft_only:            'Endpoint produced a draft. No critique. Not reviewed. Not authorized for any action.',
      critique_only:         'Grok critique returned. No human review. Not validated. Not authorized for any action.',
      reviewed_local:        'Operator clicked "Mark locally reviewed" in Civilization. NOT validation, NOT external review, NOT approval.',
      verifier_pending:      'D3-D deterministic verifier not yet wired. Placeholder only. Not authorized.',
      human_review_required: 'Item explicitly flagged as needing human review before any further step.',
      blocked:               'Intake refused by validators or marked blocked. Not actionable.'
    };
  }

  function constants() {
    return {
      SCHEMA_VERSION:    SCHEMA_VERSION,
      STORAGE_KEY:       STORAGE_KEY,
      ALLOWED_LANES:     Object.keys(ALLOWED_LANES),
      ALLOWED_AC_STATUS: Object.keys(ALLOWED_AC_STATUS),
      ALLOWED_HR_STATUS: Object.keys(ALLOWED_HR_STATUS),
      REQUIRED_SOURCE:   REQUIRED_SOURCE
    };
  }

  // ── refresh — re-read sessionStorage into in-memory mirror ────────
  // Called manually from the inbox UI when the operator wants to pick
  // up items written by another same-origin page (e.g. Civilization
  // bridge writing under the same STORAGE_KEY). NOT a polling loop.
  function refresh() {
    _items = _readStore();
    return _items.length;
  }

  // ── Public attachment (extension, not replacement) ────────────────
  if (typeof window !== 'undefined') {
    window.LIMENMasterBrain = window.LIMENMasterBrain || {};
    window.LIMENMasterBrain.artifactIntake = {
      schemaVersion:       SCHEMA_VERSION,
      validate:            validate,
      enqueue:             enqueue,
      clear:               clear,
      remove:              remove,
      list:                list,
      get:                 get,
      stats:               stats,
      refresh:             refresh,
      describeStatusTiers: describeStatusTiers,
      constants:           constants
    };
  }
})();
