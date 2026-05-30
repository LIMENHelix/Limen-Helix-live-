/**
 * human-context-gate.js
 * LIMEN HELIX — OFC/vmPFC Context Fit Gate
 *
 * The contextual-valuation layer. Reads the latest humanStatePacket and
 * the canonical identity declaration, and evaluates whether a proposed
 * action fits the operator's current cognitive state.
 *
 * This is NOT pathology-mapping. The biosensor does not say "Chris is
 * stressed." It says: "Given current operator-state, this action is or
 * is not contextually appropriate."
 *
 * Two refusal classes:
 *
 *   1. HARD REFUSAL (identity-level)
 *      Action type is on canonical-identity.disallowedActions. Biosensor
 *      cannot authorize regardless of phase. Requires explicit operator
 *      signature on a per-instance basis.
 *
 *   2. SOFT REFUSAL (phase-level)
 *      Action type is on HUMAN_PHASE_POLICY[phase].block. Refused for
 *      this phase, with a recommendedAlternative drawn from the same
 *      phase's allow list. Can be overridden by explicit force=true.
 *
 * Refusals are logged in a session-scoped audit log and (if a master-
 * brain subject is bound) enqueued as decisions in the existing
 * LIMENMasterBrain.review queue for visible operator review.
 *
 * Load order: AFTER operator-canonical-identity.js + human-state-packet.js.
 *
 * Exposes:
 *   window.LIMENHumanContextGate = {
 *     evaluateHumanContextFit({humanStatePacket, proposedAction}) -> verdict
 *     masterBrainBeforeAction(proposedAction) -> verdict (auto-pulls packet)
 *     wrapAction(action, callback) -> runs callback only if allowed
 *     getPolicy() -> HUMAN_PHASE_POLICY (deep clone)
 *     getAuditLog(n) -> last n verdicts
 *     getStats() -> { evaluated, allowed, refused, hardRefused, softRefused, overridden }
 *     onRefusal(fn) -> subscribe to refusal events
 *     forceAllow(actionInstanceId, reason) -> mark a future evaluation overridden
 *   }
 */
(function () {
  'use strict';

  var AUDIT_MAX = 500;     // session-scoped, per CLAUDE.md prime directive

  // ── State ──
  var _auditLog = [];
  var _stats = {
    evaluated: 0,
    allowed: 0,
    refused: 0,
    hardRefused: 0,
    softRefused: 0,
    overridden: 0
  };
  var _refusalSubscribers = [];
  var _forcedOverrides = new Map(); // actionInstanceId -> { reason, ts }
  var _OVERRIDE_TTL_MS = 60000;

  // ── Phase → allow/block matrix ──
  // Block lists are action TYPES (strings the caller passes as
  // proposedAction.type). Allow lists are descriptive of the *kind* of
  // work the phase is best suited for — used for recommendedAlternative.
  //
  // Default rule: if a phase isn't enumerated here, no soft refusals are
  // applied — only hard refusals based on canonical identity.
  var HUMAN_PHASE_POLICY = {
    HUMAN_P0_BASELINE: {
      allow: ['normal_chat', 'planning', 'review', 'coding', 'reading', 'documentation'],
      block: []
    },
    HUMAN_P1_AROUSAL_RISE: {
      allow: ['execution', 'coding', 'normal_chat', 'review'],
      block: ['major_external_submission_without_review']
    },
    HUMAN_P2_FOCUSED_FLOW: {
      allow: ['architecture', 'coding', 'deep_mapping', 'strategy', 'synthesis'],
      block: [
        'major_external_submission_without_review',
        'context_switch',
        'meeting_schedule',
        'low_value_notification'
      ]
    },
    HUMAN_P3_FRAGMENTATION: {
      allow: ['summarize', 'organize', 'reduce_scope', 'documentation', 'cleanup'],
      block: [
        'new_architecture_expansion',
        'large_refactor',
        'multi_branch_strategy',
        'new_engine_lane',
        'major_external_submission_without_review'
      ]
    },
    HUMAN_P4_OVERLOAD: {
      allow: ['one_next_step', 'stabilization', 'stop_conditions', 'pause_and_save', 'summarize'],
      block: [
        'multi_branch_strategy',
        'legal_send',
        'financial_execution',
        'large_refactor',
        'new_architecture_expansion',
        'major_external_submission_without_review',
        'autofire_high_salience'
      ]
    },
    HUMAN_P5_DEPLETION: {
      allow: ['recap', 'handoff', 'pause_recommendation', 'save_state', 'preserve_context'],
      block: [
        'decision_making',
        'code_changes',
        'investor_outreach',
        'commit',
        'deploy',
        'major_external_submission_without_review',
        'autofire_high_salience',
        'multi_branch_strategy'
      ]
    },
    HUMAN_P6_RECOVERY: {
      allow: ['review', 'cleanup', 'documentation', 'reflection', 'audit'],
      block: [
        'major_external_submission_without_review',
        'large_refactor'
      ]
    },
    HUMAN_P7_REDLINE: {
      allow: ['safety_summary', 'do_nothing', 'save_state', 'pause'],
      block: [
        'send', 'submit', 'trade', 'delete', 'commit', 'deploy', 'escalate',
        'execute_order', 'sign_artifact', 'autofire_high_salience',
        'major_external_submission_without_review',
        'investor_outreach', 'legal_send', 'financial_execution',
        'irreversible_action'
      ]
    }
  };

  // ── Helpers ──
  function _now() { return Date.now(); }

  function _deepClone(v) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function _identity() {
    return (typeof window !== 'undefined') ? window.LIMENOperatorCanonicalIdentity : null;
  }

  function _packetSource() {
    return (typeof window !== 'undefined') ? window.LIMENHumanStatePacket : null;
  }

  function _logVerdict(verdict) {
    _auditLog.push(verdict);
    if (_auditLog.length > AUDIT_MAX) _auditLog.shift();
    if (!verdict.allowed) {
      for (var i = 0; i < _refusalSubscribers.length; i++) {
        try { _refusalSubscribers[i](verdict); } catch (e) { /* silent */ }
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('limen:human-context-verdict', { detail: verdict }));
      } catch (e) { /* silent */ }
    }
  }

  function _checkOverride(actionInstanceId) {
    if (!actionInstanceId) return null;
    var entry = _forcedOverrides.get(actionInstanceId);
    if (!entry) return null;
    if (_now() - entry.ts > _OVERRIDE_TTL_MS) {
      _forcedOverrides.delete(actionInstanceId);
      return null;
    }
    _forcedOverrides.delete(actionInstanceId); // one-shot
    return entry;
  }

  // ── Core evaluator ──
  function evaluateHumanContextFit(input) {
    input = input || {};
    var packet = input.humanStatePacket;
    var action = input.proposedAction;

    _stats.evaluated++;

    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      var bad = {
        allowed: false,
        reason: 'INVALID_ACTION',
        message: 'proposedAction must have a string .type',
        proposedAction: action || null,
        phase: packet && packet.phase ? packet.phase : null,
        ts: _now()
      };
      _stats.refused++;
      _logVerdict(bad);
      return bad;
    }

    // Auto-pull packet if not provided
    if (!packet) {
      var src = _packetSource();
      packet = src && typeof src.getLatestHumanStatePacket === 'function'
        ? src.getLatestHumanStatePacket() : null;
    }

    // Hard refusal — biosensor-driven gate cannot authorize this action
    // type alone, regardless of phase. Operator signature required.
    var identity = _identity();
    if (identity && identity.isActionDisallowed(action.type)) {
      var hard = {
        allowed: false,
        reason: 'ACTION_DISALLOWED_BY_CANONICAL_IDENTITY',
        message: action.type + ' requires explicit operator signature; biosensor gate cannot authorize alone.',
        recommendedAlternative: 'request_explicit_operator_signature',
        refusalClass: 'hard',
        proposedAction: action,
        phase: packet ? packet.phase : null,
        identityVersion: identity.getVersion(),
        ts: _now()
      };
      _stats.refused++;
      _stats.hardRefused++;
      _logVerdict(hard);
      _maybeEnqueueReview(hard);
      return hard;
    }

    // Check forced-override window (operator explicitly authorized override)
    if (action.instanceId) {
      var override = _checkOverride(action.instanceId);
      if (override) {
        var overridden = {
          allowed: true,
          reason: 'OPERATOR_OVERRIDE',
          message: 'Operator override consumed: ' + override.reason,
          refusalClass: null,
          proposedAction: action,
          phase: packet ? packet.phase : null,
          override: override,
          ts: _now()
        };
        _stats.allowed++;
        _stats.overridden++;
        _logVerdict(overridden);
        return overridden;
      }
    }

    // If no packet at all (biosensor down), default to ALLOWED with low confidence.
    // The gate should not block actions when its own signal is unavailable —
    // that violates the "biosensor is advisory, not authoritative" invariant.
    if (!packet || !packet.available) {
      var noSignal = {
        allowed: true,
        reason: 'NO_BIOSENSOR_SIGNAL',
        message: 'Biosensor unavailable or low-confidence. Gate yields to operator default.',
        refusalClass: null,
        proposedAction: action,
        phase: packet ? packet.phase : null,
        confidence: 0,
        ts: _now()
      };
      _stats.allowed++;
      _logVerdict(noSignal);
      return noSignal;
    }

    // Soft refusal — action type is on this phase's block list.
    var policy = HUMAN_PHASE_POLICY[packet.phase];
    if (policy && policy.block.indexOf(action.type) !== -1) {
      var alternative = policy.allow && policy.allow.length ? policy.allow[0] : null;
      var soft = {
        allowed: false,
        reason: 'ACTION_CONTEXT_MISMATCH',
        message: 'Blocked because ' + action.type + ' does not fit ' + packet.phase + '.',
        recommendedAlternative: alternative,
        refusalClass: 'soft',
        proposedAction: action,
        phase: packet.phase,
        phaseDescription: packet.phaseDescription,
        recommendedSystemBehavior: packet.recommendedSystemBehavior,
        confidence: packet.confidence,
        identityVersion: packet.identityVersion,
        ts: _now()
      };
      _stats.refused++;
      _stats.softRefused++;
      _logVerdict(soft);
      _maybeEnqueueReview(soft);
      return soft;
    }

    // Allowed.
    var ok = {
      allowed: true,
      reason: 'ACTION_CONTEXT_FIT',
      message: action.type + ' fits ' + packet.phase + '.',
      refusalClass: null,
      proposedAction: action,
      phase: packet.phase,
      phaseDescription: packet.phaseDescription,
      recommendedSystemBehavior: packet.recommendedSystemBehavior,
      confidence: packet.confidence,
      ts: _now()
    };
    _stats.allowed++;
    _logVerdict(ok);
    return ok;
  }

  // Convenience wrapper: pulls latest packet and runs gate. Used by
  // master-brain-executor / autofire UI before action.
  function masterBrainBeforeAction(proposedAction) {
    var src = _packetSource();
    var packet = src && typeof src.getLatestHumanStatePacket === 'function'
      ? src.getLatestHumanStatePacket() : null;
    var verdict = evaluateHumanContextFit({
      humanStatePacket: packet,
      proposedAction: proposedAction
    });
    return verdict.allowed
      ? { status: 'APPROVED_FOR_EXECUTION', contextFit: verdict }
      : {
          status: 'REFUSED_BY_HUMAN_STATE_GATE',
          contextFit: verdict,
          nextBestAction: verdict.recommendedAlternative || null
        };
  }

  // wrapAction: only runs callback if gate allows. Logs result.
  function wrapAction(action, callback) {
    var result = masterBrainBeforeAction(action);
    if (result.status === 'APPROVED_FOR_EXECUTION') {
      try { callback(null, result); } catch (e) { callback(e, result); }
    } else {
      callback(new Error('REFUSED_BY_HUMAN_STATE_GATE: ' + result.contextFit.reason), result);
    }
    return result;
  }

  function forceAllow(actionInstanceId, reason) {
    if (!actionInstanceId) return false;
    _forcedOverrides.set(actionInstanceId, {
      reason: String(reason || 'operator_explicit_override'),
      ts: _now()
    });
    return true;
  }

  // Integrate with existing master-brain review queue if available.
  function _maybeEnqueueReview(verdict) {
    if (typeof window === 'undefined') return;
    var review = window.LIMENMasterBrain && window.LIMENMasterBrain.review;
    if (!review || typeof review.enqueue !== 'function') return;

    // Synthesize a MasterBrainDecision-shaped object so review queue
    // accepts it. cycleId borrows from packet.timestamp.
    var decisionId = 'human-gate-' + verdict.refusalClass + '-' + (verdict.ts || _now());
    var decision = {
      id: decisionId,
      cycleId: 'human-gate-' + (verdict.phase || 'unknown'),
      class: 'contradiction', // closest fit in review eligibility
      subject: {
        scale: 'human_operator',
        patternClass: verdict.reason,
        actionType: verdict.proposedAction && verdict.proposedAction.type
      },
      proposal: {
        text: verdict.message,
        proposedNext: 'schedule_review',
        payload: {
          recommendedAlternative: verdict.recommendedAlternative,
          phase: verdict.phase,
          confidence: verdict.confidence,
          refusalClass: verdict.refusalClass,
          identityVersion: verdict.identityVersion
        }
      },
      humanReviewRequired: true,
      executionAllowed: false
    };

    try {
      review.enqueue(decision, { force: true });
    } catch (e) { /* silent — gate must never break on review-queue errors */ }
  }

  function onRefusal(fn) {
    if (typeof fn === 'function') _refusalSubscribers.push(fn);
  }

  function getAuditLog(n) {
    var count = typeof n === 'number' ? Math.min(n, _auditLog.length) : _auditLog.length;
    var out = [];
    for (var i = _auditLog.length - count; i < _auditLog.length; i++) {
      out.push(_deepClone(_auditLog[i]));
    }
    return out;
  }

  function getPolicy() { return _deepClone(HUMAN_PHASE_POLICY); }

  function getStats() { return _deepClone(_stats); }

  if (typeof window !== 'undefined') {
    window.LIMENHumanContextGate = {
      evaluateHumanContextFit: evaluateHumanContextFit,
      masterBrainBeforeAction: masterBrainBeforeAction,
      wrapAction: wrapAction,
      forceAllow: forceAllow,
      getPolicy: getPolicy,
      getAuditLog: getAuditLog,
      getStats: getStats,
      onRefusal: onRefusal,
      HUMAN_PHASE_POLICY: _deepClone(HUMAN_PHASE_POLICY)
    };

    // Extend LIMENMasterBrain with gate accessor (non-destructive).
    window.LIMENMasterBrain = window.LIMENMasterBrain || {};
    if (!window.LIMENMasterBrain.humanContextGate) {
      window.LIMENMasterBrain.humanContextGate = window.LIMENHumanContextGate;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      HUMAN_PHASE_POLICY: HUMAN_PHASE_POLICY,
      evaluateHumanContextFit: evaluateHumanContextFit,
      masterBrainBeforeAction: masterBrainBeforeAction
    };
  }
})();
