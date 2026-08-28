'use strict';

var SCHEMA = 'communication-social-learning/1.0';
var EXTERNAL = 'product-domain-external-learning/1.0';
var STATE_KEY = 'communication_social_learning_state';
var CAUSE_PREFIX = 'communication_social_learning_cause:';
function causeKey(id) { return CAUSE_PREFIX + id; }
function fresh() { return { schemaVersion: SCHEMA, domain: 'communication', lane: 'social', resolvedCount: 0, signals: [], processedObservationIds: [] }; }
async function load(store) { var value = await store.get(STATE_KEY); if (!value) return fresh(); if (value.schemaVersion !== SCHEMA || !Array.isArray(value.signals) || !Array.isArray(value.processedObservationIds)) throw new Error('communication social learning state malformed'); return value; }
async function save(store, value) { await store.set(STATE_KEY, value); var restored = await store.get(STATE_KEY); if (!restored || restored.resolvedCount !== value.resolvedCount) throw new Error('communication social learning readback invalid'); return restored; }
async function recordCommand(store, command) {
  if (!command || command.ownerDomain !== 'communication' || command.lane !== 'social' || !command.commandId) return { ok: false, reason: 'communication-social-command-required' };
  var cause = { schemaVersion: SCHEMA, domain: 'communication', lane: 'social', actionId: command.commandId, commandId: command.commandId,
    decisionReceiptId: command.decisionReceiptId, subjectDomain: command.subjectDomain, contentHash: command.contentHash,
    predictedOutcome: command.predictedOutcome, commandedAt: command.commandedAt };
  var created = await store.setIfAbsent(causeKey(command.commandId), cause), restored = await store.get(causeKey(command.commandId));
  if (!restored || restored.commandId !== command.commandId) throw new Error('communication social cause readback invalid');
  return { ok: true, duplicate: !created };
}
async function recordObservation(store, command, observation) {
  if (!command || !observation || observation.status !== 'OBSERVED' || !observation.observationId || !observation.sourceIdentity ||
      !observation.postReceipt || !observation.postReceipt.uri) return { ok: false, reason: 'independent-social-observation-required' };
  if (!await store.get(causeKey(command.commandId))) return { ok: false, reason: 'communication-social-action-cause-missing' };
  var value = await load(store); if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
  var delta = Number(observation.engagementDelta || 0), credit = delta > 0 ? 1 : delta < 0 ? 0 : 0.5;
  var signal = { schemaVersion: EXTERNAL, signalId: 'els_' + observation.observationId, eventId: observation.observationId,
    actionId: command.commandId, ownerDomain: 'communication', lane: 'social', eventType: 'OUTCOME_SOCIAL_ENGAGEMENT',
    observedAt: observation.observedAt, outcome: delta > 0 ? 'ENGAGEMENT_INCREASED' : delta < 0 ? 'ENGAGEMENT_DECREASED' : 'NO_CHANGE',
    normalizedCredit: credit, sourceKind: 'independent-action-outcome', sourceIdentity: observation.sourceIdentity,
    engagementDelta: delta, postUri: observation.postReceipt.uri };
  value.signals.push(signal); value.signals = value.signals.slice(-200); value.processedObservationIds.push(observation.observationId);
  value.processedObservationIds = value.processedObservationIds.slice(-2000); value.resolvedCount++; value.lastOutcomeAt = observation.observedAt;
  await save(store, value); return { ok: true, signal: signal, resolvedCount: value.resolvedCount };
}
async function readForBrain(store) { var value = await load(store), signal = value.signals.length ? value.signals[value.signals.length - 1] : null, posts = {};
  value.signals.forEach(function (row) { if (row.postUri) posts[row.postUri] = true; }); var distinct = Object.keys(posts).length;
  return { schemaVersion: EXTERNAL, domain: 'communication', status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-graded-external-action-outcome',
    resolvedCount: value.resolvedCount, learningGate: { ready: value.resolvedCount >= 5 && distinct >= 2, minimumResolved: 5, distinctPosts: distinct, minimumDistinctPosts: 2 }, signal: signal }; }
module.exports = { SCHEMA: SCHEMA, STATE_KEY: STATE_KEY, causeKey: causeKey, recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain };
