'use strict';

/*
 * Deterministic shadow evaluator for domain business stress regulation.
 *
 * This module can describe whether an action is eligible to be presented to the
 * existing governance gate. It never opens that gate and never authorizes an
 * external effect. Missing/stale governance facts fail closed.
 */

var POLICY = require('../assets/data/domain-business-regulation.json');
var phaseSpec = require('./phase-spec.js');

var EFFECT_RANK = Object.freeze({
  OBSERVE_ONLY: 0,
  PROPOSE_ONLY: 1,
  BOUNDED_REVERSIBLE: 2,
  STABILIZE_ONLY: 1,
  HALT_NEW_EFFECTS: 0
});

var STATUS_RANK = Object.freeze({
  ELIGIBLE_FOR_GATE: 0,
  PROPOSE_ONLY: 1,
  BLOCKED: 2,
  HALTED: 3
});

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

function normalizePhase(value) {
  var match = String(value == null ? '' : value).toUpperCase().match(/P(?:HASE\s*)?([0-9]{1,2})/);
  if (!match) return null;
  var code = 'P' + Number(match[1]);
  return Number(match[1]) <= 10 && phaseSpec.get(code) ? code : null;
}

function phasePolicy(value) {
  var code = normalizePhase(value);
  if (!code) return null;
  return POLICY.phases.find(function (row) { return row.phase === code; }) || null;
}

function stressPolicy(value) {
  if (!finite(value) || value < 0 || value > 1) {
    return POLICY.stressBands.find(function (row) { return row.id === 'unknown'; });
  }
  return POLICY.stressBands.find(function (row) {
    if (row.minInclusive == null || value < row.minInclusive) return false;
    if (row.maxExclusive != null) return value < row.maxExclusive;
    return value <= row.maxInclusive;
  }) || POLICY.stressBands[0];
}

function timestamp(value) {
  if (finite(value)) return value;
  var parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function allRuntimeLayersPass(health, nowValue) {
  if (!health || health.status !== 'pass') return false;
  var observedAt = timestamp(health.observedAtMs != null ? health.observedAtMs : health.observedAt);
  var now = finite(nowValue) ? nowValue : Date.now();
  if (!finite(observedAt) || observedAt > now || now - observedAt > POLICY._meta.runtimeHealthMaxAgeMs) return false;
  var layers = health.layers || {};
  return ['process', 'scheduler', 'execution', 'governance'].every(function (name) {
    return layers[name] === 'pass';
  });
}

function evaluate(input) {
  input = input || {};
  var phase = phasePolicy(input.phase);
  var stress = stressPolicy(input.stress);
  var reasons = [];
  var status = 'ELIGIBLE_FOR_GATE';

  function restrict(nextStatus, reason) {
    if (STATUS_RANK[nextStatus] > STATUS_RANK[status]) status = nextStatus;
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }

  if (!phase) {
    restrict('BLOCKED', 'domain-cycle-phase-missing-or-invalid');
  }
  if (input.operatorHalt === true) {
    restrict('HALTED', 'operator-halt-active');
  }
  if (!allRuntimeLayersPass(input.runtimeHealth, input.now)) {
    restrict('BLOCKED', 'four-layer-runtime-health-not-fresh-pass');
  }
  if (input.contractRatified !== true) {
    restrict('PROPOSE_ONLY', 'contract-not-ratified');
  }
  if (input.verifierFresh !== true) {
    restrict('PROPOSE_ONLY', 'independent-verifier-missing-or-stale');
  }
  if (stress.restriction === 'HALT_NEW_EFFECTS') {
    restrict('BLOCKED', 'acute-stress-circuit-breaker');
  } else if (stress.restriction === 'PROPOSE_ONLY') {
    restrict('PROPOSE_ONLY', 'stress-unmeasured-or-invalid');
  } else if (stress.restriction === 'STABILIZE_ONLY' && input.actionClass !== 'STABILIZATION') {
    restrict('PROPOSE_ONLY', 'stress-posture-admits-stabilization-only');
  }
  if (phase && phase.effectCeiling === 'HALT_NEW_EFFECTS') {
    restrict('BLOCKED', 'phase-circuit-breaker');
  } else if (!phase || EFFECT_RANK[phase.effectCeiling] < EFFECT_RANK.BOUNDED_REVERSIBLE) {
    restrict('PROPOSE_ONLY', 'phase-posture-does-not-admit-new-effect');
  }
  if (input.reversible !== true || !input.rollbackRefVerified) {
    restrict('PROPOSE_ONLY', 'reversibility-missing-or-unverified');
  }

  if (input.capitalPromotion === true && input.reconciledFunding !== true) {
    restrict('PROPOSE_ONLY', 'capital-promotion-lacks-reconciled-funding');
  }

  return {
    schemaVersion: POLICY.schemaVersion,
    mode: POLICY._meta.mode,
    phase: phase ? phase.phase : null,
    phaseTitle: phase ? phase.title : null,
    businessPosture: phase ? phase.businessPosture : 'UNKNOWN',
    phaseEffectCeiling: phase ? phase.effectCeiling : 'HALT_NEW_EFFECTS',
    stressBand: stress.id,
    stressRestriction: stress.restriction,
    status: status,
    reasons: reasons,
    capitalPromotion: phase ? phase.capitalPromotion : 'HOLD',
    gateAdmissionEligible: status === 'ELIGIBLE_FOR_GATE',
    externalEffectAuthorized: false,
    spendAuthorizedUsd: 0
  };
}

module.exports = {
  SCHEMA: POLICY.schemaVersion,
  POLICY: POLICY,
  normalizePhase: normalizePhase,
  phasePolicy: phasePolicy,
  stressPolicy: stressPolicy,
  evaluate: evaluate
};
