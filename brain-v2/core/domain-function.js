/**
 * brain-v2/core/domain-function.js — PROOF OF WHAT ONE DOMAIN DID THIS CYCLE.
 *
 * Installed means the runtime invoked a binder. It does not mean the binder admitted an
 * observation, emitted a state, or closed a prediction against later evidence. This module
 * keeps those claims separate and derives them only from the kernel tick reports that already
 * exist. It changes no threshold, state, pathway, diagnosis, action, or score.
 *
 * The L3 evidence flag is structural, not a quality score: during the observed cycle the
 * domain must (1) run, (2) admit a real observation, (3) emit a non-abstained measured state,
 * and (4) carry at least one resolved prospective prediction in the restored loop. Missing
 * any element is reported by name. Internal action and outward connection are reported
 * separately; neither is smuggled into the L3 claim.
 */

'use strict';

function empty() {
  return {
    ticksObserved: 0,
    observations: { admitted: 0, rejected: 0 },
    states: { emitted: 0, abstained: 0 },
    dysregulationsDetected: 0,
    findingsFired: 0,
    predictions: { open: 0, resolved: 0 },
    internalActionsExecuted: 0,
    outwardConsumersDeclared: 0,
    evidence: {
      loopExecuted: false,
      realObservationAdmitted: false,
      measuredStateEmitted: false,
      predictionGraded: false,
      l3CurrentEvidenceComplete: false,
      outwardConnected: false
    },
    missing: ['no_tick_observed'],
    scope: 'current shadow cycle plus the restored prediction registry; not a pathway count and not an outward effect'
  };
}

function step(report, name) {
  var steps = report && Array.isArray(report.steps) ? report.steps : [];
  for (var i = 0; i < steps.length; i++) if (steps[i] && steps[i].step === name) return steps[i];
  return null;
}

function observe(summary, tickReport) {
  if (!summary || !summary.observations || !summary.states) {
    throw new Error('domain-function needs a summary created by empty()');
  }
  summary.ticksObserved++;

  var barrier = step(tickReport, 'barrier');
  if (barrier) {
    summary.observations.admitted += finiteCount(barrier.admitted);
    summary.observations.rejected += finiteCount(barrier.rejected);
  }

  var domain = step(tickReport, 'domain_cycle');
  if (domain) {
    if (domain.abstained) summary.states.abstained++;
    else summary.states.emitted++;
    if (domain.dysregulated) summary.dysregulationsDetected++;
    summary.findingsFired += finiteCount(domain.findings);
  }
  return summary;
}

function finalize(summary, context) {
  context = context || {};
  var predictions = context.predictions || {};
  var actuation = context.actuation || {};

  summary.predictions.open = finiteCount(predictions.open);
  summary.predictions.resolved = finiteCount(predictions.resolved);
  summary.internalActionsExecuted = finiteCount(actuation.executed);
  summary.outwardConsumersDeclared = finiteCount(context.outwardConsumersDeclared);

  var ev = summary.evidence;
  ev.loopExecuted = summary.ticksObserved > 0;
  ev.realObservationAdmitted = summary.observations.admitted > 0;
  ev.measuredStateEmitted = summary.states.emitted > 0;
  ev.predictionGraded = summary.predictions.resolved > 0;
  ev.outwardConnected = summary.outwardConsumersDeclared > 0;
  ev.l3CurrentEvidenceComplete =
    ev.loopExecuted && ev.realObservationAdmitted && ev.measuredStateEmitted && ev.predictionGraded;

  var missing = [];
  if (!ev.loopExecuted) missing.push('no_tick_observed');
  if (!ev.realObservationAdmitted) missing.push('no_real_observation_admitted');
  if (!ev.measuredStateEmitted) missing.push('no_non_abstained_state_emitted');
  if (!ev.predictionGraded) missing.push('no_resolved_prediction_in_restored_loop');
  summary.missing = missing;
  return summary;
}

function finiteCount(v) {
  return (typeof v === 'number' && isFinite(v) && v > 0) ? Math.floor(v) : 0;
}

module.exports = {
  empty: empty,
  observe: observe,
  finalize: finalize
};
