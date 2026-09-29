'use strict';

/*
 * Domain-integrity classification only. This module does not choose value,
 * priority, or motor action. Candidates remain represented on every route;
 * PASS is the only route that can satisfy an already-existing external-effect
 * authorization boundary.
 */
var ROUTES = Object.freeze({ PASS: 'PASS', HOLD: 'HOLD', QUARANTINE: 'QUARANTINE', REJECT: 'REJECT' });

function list(value) { return Array.isArray(value) ? value.slice(0, 32) : []; }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

function evidenceOf(immune) {
  immune = immune && typeof immune === 'object' && !Array.isArray(immune) ? immune : {};
  return {
    immuneState: text(immune.immuneState),
    severity: immune.severity == null ? null : immune.severity,
    antigens: list(immune.antigens),
    quarantines: list(immune.quarantines),
    blockedFromTraversal: list(immune.blockedFromTraversal),
    allowedWithWarning: immune.allowedWithWarning === true,
    integrityThreat: immune.integrityThreat === true,
    acuteThreat: immune.acuteThreat === true,
    candidateScoped: immune.candidateScoped === true,
    candidateQuarantined: immune.candidateQuarantined === true,
    evidenceStatus: text(immune.evidenceStatus),
    reason: text(immune.reason)
  };
}

function candidateQuarantined(candidate) {
  return !!(candidate && typeof candidate === 'object' && (
    candidate.quarantined === true || candidate.candidateQuarantined === true ||
    candidate.integrityThreat === true || candidate.evidenceStatus === 'QUARANTINE' ||
    candidate.evidenceStatus === 'QUARANTINED'
  ));
}

function candidateInvalid(candidate) {
  return !!(candidate && typeof candidate === 'object' && (
    candidate.invalid === true || candidate.evidenceStatus === 'INVALID' || candidate.evidenceStatus === 'REJECT'
  ));
}

function assess(input) {
  input = input && typeof input === 'object' ? input : {};
  var immune = input.immune;
  var candidate = input.candidate;
  var evidence = evidenceOf(immune);
  var route = ROUTES.HOLD;
  var reason = 'immune-warning-or-uncertainty-requires-more-evidence';
  var integrityScope = 'domain-evidence';
  var hardStop = true;

  if (!immune || typeof immune !== 'object' || Array.isArray(immune) || candidateInvalid(candidate)) {
    route = ROUTES.REJECT;
    reason = 'candidate-or-integrity-record-invalid';
    integrityScope = !immune || typeof immune !== 'object' || Array.isArray(immune) ? 'immune-record' : 'candidate';
  } else if (candidateQuarantined(candidate) || evidence.candidateQuarantined ||
      (evidence.candidateScoped && (evidence.integrityThreat || evidence.acuteThreat))) {
    route = ROUTES.QUARANTINE;
    reason = 'candidate-scoped-integrity-threat';
    integrityScope = 'candidate';
  } else if (evidence.integrityThreat || evidence.acuteThreat || evidence.immuneState === 'alert' ||
      evidence.evidenceStatus === 'REJECT' || evidence.evidenceStatus === 'INVALID') {
    route = ROUTES.QUARANTINE;
    reason = 'candidate-scoped-integrity-threat';
    integrityScope = 'domain-evidence';
  } else if (evidence.immuneState === 'clear' && evidence.evidenceStatus !== 'INVALID' &&
      evidence.antigens.length === 0 && evidence.quarantines.length === 0 && evidence.blockedFromTraversal.length === 0) {
    route = ROUTES.PASS;
    reason = 'immune-clear-and-candidate-integrity-accepted';
    integrityScope = 'none';
    hardStop = false;
  }

  return {
    schemaVersion: 'immune-routing/1.0',
    route: route,
    reason: reason,
    hardStop: hardStop,
    candidatePreserved: true,
    integrityScope: integrityScope,
    evidence: copy(evidence)
  };
}

function permitsExternalEffect(assessment) {
  return !!(assessment && assessment.schemaVersion === 'immune-routing/1.0' &&
    assessment.route === ROUTES.PASS && assessment.hardStop === false);
}

module.exports = Object.freeze({ ROUTES: ROUTES, assess: assess, permitsExternalEffect: permitsExternalEffect });
