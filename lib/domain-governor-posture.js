'use strict';

/**
 * Deterministic, read-only projection of a domain brain's local control state.
 *
 * This is the governor's state-dependent demeanor, not a character profile and
 * not a second cognitive controller. It may shape language and deliberative
 * emphasis only. It cannot alter evidence, confidence, thresholds, authority,
 * budgets, motor selection, or provider gates.
 */

var SCHEMA = 'domain-governor-posture/1.0';

function number(value) {
  return typeof value === 'number' && isFinite(value) ? value : null;
}

function clamp(value) {
  var n = number(value);
  if (n === null) return null;
  return Math.max(0, Math.min(1, n));
}

function round(value) {
  var n = clamp(value);
  return n === null ? null : Math.round(n * 1000) / 1000;
}

function maximum(values) {
  var available = values.map(clamp).filter(function (value) { return value !== null; });
  return available.length ? Math.max.apply(null, available) : null;
}

function unavailable(reason) {
  return {
    schemaVersion: SCHEMA,
    state: 'unavailable',
    source: 'same-domain-brain-control-state',
    reason: reason,
    localBrainState: null,
    appraisal: {
      threat: null, opportunity: null, novelty: null, uncertainty: null, controllability: null,
      urgency: null, loss: null, resourceDepletion: null, rewardExpectation: null, socialImpact: null
    },
    modulation: {
      tone: 'plain-abstaining', attentionWidth: 'none', deliberationTempo: 'halted',
      exploration: 'none', persistence: 'await-current-cognition'
    },
    authority: {
      role: 'presentation-and-deliberation-modulation-only',
      mayShape: ['tone', 'attention-emphasis', 'deliberation-tempo', 'exploration-breadth', 'response-persistence'],
      mayNotChange: ['facts', 'provenance', 'confidence', 'prediction', 'decision-thresholds', 'budget', 'authority', 'motor-selection', 'provider-gates']
    }
  };
}

function derive(cognition, serverStress, cognitionFresh) {
  cognition = cognition && typeof cognition === 'object' ? cognition : {};
  if (cognition.present === false) return unavailable('domain-cognition-absent');
  if (cognitionFresh === false) return unavailable('domain-cognition-stale');
  if (cognition.stale === true) return unavailable('domain-cognition-stale');
  var control = cognition.regulationControl && typeof cognition.regulationControl === 'object'
    ? cognition.regulationControl
    : {};
  var interoception = cognition.interoception && typeof cognition.interoception === 'object'
    ? cognition.interoception
    : {};
  var awareness = cognition.awareness && typeof cognition.awareness === 'object'
    ? cognition.awareness
    : {};
  var stress = clamp(serverStress === undefined ? cognition.stress : serverStress);
  var predictedStress = clamp(cognition.predictedStress);
  var predictionError = clamp(cognition.predictionError);
  var immuneSeverity = clamp(cognition.immuneSeverity);
  var divergence = clamp(interoception.divergence);
  var interoceptiveUncertainty = clamp(interoception.uncertainty);
  var inhibition = clamp(control.inhibition);
  var outputScale = clamp(control.outputScale);
  var regulationState = String(cognition.regulation || '').toLowerCase();
  var immuneAlert = cognition.immune === 'alert';
  var immunePressure = cognition.immune === 'alert'
    ? (immuneSeverity === null ? 0.75 : immuneSeverity)
    : cognition.immune === 'active'
      ? (immuneSeverity === null ? 0.5 : immuneSeverity)
      : cognition.immune === 'watch'
        ? (immuneSeverity === null ? 0.25 : immuneSeverity)
        : null;
  var humanReview = awareness.humanReviewRequired === true;
  var staleOrStarving = control.stale === true || control.starving === true;

  var threat = maximum([stress, predictedStress, immunePressure]);
  var novelty = predictionError;
  var uncertainty = maximum([predictionError, divergence, interoceptiveUncertainty, humanReview ? 0.75 : null]);
  var controllability = outputScale !== null
    ? outputScale
    : (inhibition !== null ? 1 - inhibition : null);
  if (controllability !== null && staleOrStarving) controllability *= 0.5;
  var urgency = maximum([threat, immuneAlert ? 0.9 : null, control.flooding === true ? 0.8 : null]);

  var state = 'steady';
  if (immuneAlert || humanReview) state = 'guarded';
  else if (control.flooding === true || control.looping === true || (stress !== null && stress >= 0.82)) state = 'overloaded';
  else if (control.surprised === true || regulationState === 'surprised' ||
      (predictionError !== null && predictionError >= 0.55)) state = 'surprised';
  else if (urgency !== null && urgency >= 0.7) state = 'mobilized';
  else if (uncertainty !== null && uncertainty >= 0.45 && (threat === null || threat < 0.65)) state = 'exploratory';

  var modulation = {
    tone: 'calm-direct',
    attentionWidth: 'balanced',
    deliberationTempo: 'measured',
    exploration: 'normal',
    persistence: 'normal'
  };
  if (state === 'guarded') {
    modulation = { tone: 'cautious-explicit', attentionWidth: 'narrow', deliberationTempo: 'deliberate', exploration: 'suppressed', persistence: 'verify-before-continuing' };
  } else if (state === 'overloaded') {
    modulation = { tone: 'terse-prioritized', attentionWidth: 'narrow', deliberationTempo: 'slow', exploration: 'suppressed', persistence: 'reduce-and-stabilize' };
  } else if (state === 'surprised') {
    modulation = { tone: 'curious-qualified', attentionWidth: 'broadened', deliberationTempo: 'deliberate', exploration: 'elevated', persistence: 'test-and-update' };
  } else if (state === 'mobilized') {
    modulation = { tone: 'urgent-direct', attentionWidth: 'focused', deliberationTempo: uncertainty !== null && uncertainty >= 0.45 ? 'deliberate' : 'rapid', exploration: 'bounded', persistence: controllability !== null && controllability >= 0.5 ? 'high' : 'cautious' };
  } else if (state === 'exploratory') {
    modulation = { tone: 'curious-qualified', attentionWidth: 'broad', deliberationTempo: 'measured', exploration: 'elevated', persistence: 'hypothesis-seeking' };
  }
  if (control.starving === true) modulation.persistence = 'resource-conserving';

  return {
    schemaVersion: SCHEMA,
    state: state,
    source: 'same-domain-brain-control-state',
    localBrainState: {
      selfState: awareness.selfState || null,
      selfNarrative: awareness.selfNarrative || null,
      regulation: cognition.regulation || null,
      immune: cognition.immune || null,
      interoceptiveSalience: interoception.salience || null
    },
    appraisal: {
      threat: round(threat),
      opportunity: null,
      novelty: round(novelty),
      uncertainty: round(uncertainty),
      controllability: round(controllability),
      urgency: round(urgency),
      loss: null,
      resourceDepletion: control.starving === true ? 1 : 0,
      rewardExpectation: null,
      socialImpact: null
    },
    modulation: modulation,
    authority: {
      role: 'presentation-and-deliberation-modulation-only',
      mayShape: ['tone', 'attention-emphasis', 'deliberation-tempo', 'exploration-breadth', 'response-persistence'],
      mayNotChange: ['facts', 'provenance', 'confidence', 'prediction', 'decision-thresholds', 'budget', 'authority', 'motor-selection', 'provider-gates']
    }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  derive: derive,
  unavailable: unavailable,
  clamp: clamp,
  maximum: maximum
};
