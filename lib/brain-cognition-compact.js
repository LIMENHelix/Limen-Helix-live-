'use strict';

function num(value) {
  return typeof value === 'number' ? value : null;
}

function scalar(value) {
  if (typeof value === 'number') return value;
  return value && typeof value === 'object' && typeof value.total === 'number'
    ? value.total
    : null;
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function val(value) {
  return value != null ? value : null;
}

// Domain brains may represent the review gate as either a boolean or a list of
// review items. An empty list means that no review is required; Boolean([])
// would incorrectly inhibit every such domain at the transport boundary.
function reviewRequired(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value === true;
}

// Preserve outcome provenance for observation without copying learner memory
// or treating another domain's returned afferent as this domain's authority.
function learningReadout(readout) {
  if (!readout) return null;
  var signal = readout.signal || {};
  var afferent = readout.financialAfferent || null;
  var routed = readout.routedOutcomeReturn || null;
  return {
    status: val(readout.status), reason: val(readout.reason),
    domain: val(readout.domain), resolvedCount: num(readout.resolvedCount),
    learningGate: val(readout.learningGate),
    latestSignalId: val(signal.signalId), eventId: val(signal.eventId),
    actionId: val(signal.actionId), lane: val(signal.lane),
    observedAt: num(signal.observedAt), sourceIdentity: val(signal.sourceIdentity),
    companyPatternCount: arr(readout.companyPatterns).length,
    routedOutcomeReturn: routed ? {
      status: val(routed.status), reason: val(routed.reason), returnedCount: num(routed.returnedCount),
      observationOnly: routed.observationOnly === true,
      failures: arr(routed.failures),
      latest: routed.latest ? {
        returnId: val(routed.latest.returnId), ownerDomain: val(routed.latest.ownerDomain),
        actionId: val(routed.latest.actionId), eventId: val(routed.latest.eventId),
        sourceDomains: arr(routed.latest.sourceDomains), observedAt: num(routed.latest.observedAt),
        outcome: val(routed.latest.outcome), ownerLearningApplied: routed.latest.ownerLearningApplied === true,
        authority: val(routed.latest.authority)
      } : null
    } : null,
    financialAfferent: afferent ? {
      status: val(afferent.status), reason: val(afferent.reason),
      domain: val(afferent.domain), resolvedCount: num(afferent.resolvedCount),
      signalId: val(afferent.signal && afferent.signal.signalId),
      actionId: val(afferent.signal && afferent.signal.actionId),
      eventId: val(afferent.signal && afferent.signal.eventId),
      sourceDomain: val(afferent.signal && afferent.signal.sourceDomain),
      observedAt: num(afferent.signal && afferent.signal.observedAt),
      sourceDomains: arr(afferent.signal && afferent.signal.sourceDomains),
      authority: val(afferent.signal && afferent.signal.authority)
    } : null
  };
}

function compact(cognition) {
  if (!cognition || typeof cognition !== 'object') return null;
  var model = cognition.model || {};
  var immune = cognition.immune || {};
  var awareness = cognition.awareness || {};
  var conscience = cognition.conscience || {};
  var intuition = cognition.intuition || {};
  var regulation = model.regulation && typeof model.regulation === 'object'
    ? model.regulation
    : {};

  return {
    domain: cognition.domain || null,
    model: {
      cycle: num(model.cycle),
      predictionError: scalar(model.predictionError),
      predictedStress: num(model.predictedStress),
      regulation: val(model.regulation && typeof model.regulation === 'object'
        ? model.regulation.state
        : model.regulation),
      regulationControl: {
        gain: num(regulation.gain),
        inhibition: num(regulation.inhibition),
        outputScale: num(regulation.outputScale),
        starving: regulation.starving === true,
        flooding: regulation.flooding === true,
        looping: regulation.looping === true,
        stale: regulation.stale === true,
        overconfident: regulation.overconfident === true,
        surprised: regulation.surprised === true
      }
    },
    immune: {
      immuneState: val(immune.immuneState),
      severity: num(immune.severity),
      antigenCount: arr(immune.antigens).length,
      quarantines: val(immune.quarantines),
      blockedFromTraversal: val(immune.blockedFromTraversal)
    },
    awareness: {
      selfState: val(awareness.selfState),
      selfNarrative: val(awareness.selfNarrative),
      humanReviewRequired: reviewRequired(awareness.humanReviewRequired),
      knownCount: arr(awareness.knowns).length,
      uncertaintyCount: arr(awareness.uncertainties || awareness.unknowns).length
    },
    conscience: {
      conscienceState: val(conscience.conscienceState),
      artifactReadinessDecision: val(conscience.artifactReadinessDecision),
      blockedClaims: arr(conscience.blockedClaims).slice(0, 4)
    },
    intuition: {
      hunches: arr(intuition.hunches).slice(0, 3)
    }
  };
}

module.exports = {
  compact: compact,
  reviewRequired: reviewRequired,
  scalar: scalar,
  num: num,
  arr: arr,
  val: val,
  learningReadout: learningReadout
};
