'use strict';

var SCHEMA = 'defense-publication-learning/1.0';
var EXTERNAL_SCHEMA = 'product-domain-external-learning/1.0';
var STATE_KEY = 'defense_publication_learning_state';
var CAUSE_PREFIX = 'defense_publication_learning_cause:';

function causeKey(actionId) { return CAUSE_PREFIX + actionId; }
function fresh() { return { schemaVersion: SCHEMA, domain: 'defense', lane: 'publication', resolvedCount: 0, signals: [], processedObservationIds: [] }; }
async function load(store) {
  var value = await store.get(STATE_KEY);
  if (!value) return fresh();
  if (value.schemaVersion !== SCHEMA || !Array.isArray(value.signals) || !Array.isArray(value.processedObservationIds)) throw new Error('defense publication learning state malformed');
  return value;
}
async function save(store, value) {
  await store.set(STATE_KEY, value);
  var restored = await store.get(STATE_KEY);
  if (!restored || restored.resolvedCount !== value.resolvedCount) throw new Error('defense publication learning readback invalid');
  return restored;
}
async function recordCommand(store, command) {
  var cause = { schemaVersion: SCHEMA, domain: 'defense', lane: 'publication', actionId: command.actionId,
    commandId: command.commandId, decisionReceiptId: command.decisionReceiptId, predictedOutcome: command.predictedOutcome, commandedAt: command.commandedAt };
  var created = await store.setIfAbsent(causeKey(command.actionId), cause);
  var restored = await store.get(causeKey(command.actionId));
  if (!restored || restored.commandId !== command.commandId) throw new Error('defense publication cause readback invalid');
  return { ok: true, duplicate: !created };
}
async function recordObservation(store, observation) {
  if (!observation || observation.status !== 'SOURCE_CLICK_OBSERVED' || observation.engagementEligible !== true ||
      observation.trafficClassification !== 'user-activated-browser-request-unverified-human' ||
      !observation.observationId || !observation.actionId || !observation.visitorIdentityHash || !observation.articleId) {
    return { ok: false, reason: 'eligible-independent-publication-engagement-required' };
  }
  if (!await store.get(causeKey(observation.actionId))) return { ok: false, reason: 'defense-publication-action-cause-missing' };
  var value = await load(store);
  if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
  var signal = {
    schemaVersion: EXTERNAL_SCHEMA,
    signalId: 'els_' + observation.observationId,
    eventId: observation.observationId,
    actionId: observation.actionId,
    ownerDomain: 'defense', lane: 'publication',
    eventType: 'OUTCOME_PUBLICATION_SOURCE_CLICK',
    observedAt: observation.observedAt,
    outcome: 'source-link-click',
    normalizedCredit: 0.5,
    sourceKind: 'independent-action-outcome',
    sourceIdentity: { kind: 'anonymous-publication-visitor', value: observation.visitorIdentityHash },
    articleId: observation.articleId
  };
  value.signals.push(signal); value.signals = value.signals.slice(-200);
  value.processedObservationIds.push(observation.observationId); value.processedObservationIds = value.processedObservationIds.slice(-2000);
  value.resolvedCount++; value.lastOutcomeAt = observation.observedAt;
  await save(store, value);
  return { ok: true, signal: signal, resolvedCount: value.resolvedCount };
}
async function readForBrain(store) {
  var value = await load(store);
  var signal = value.signals.length ? value.signals[value.signals.length - 1] : null;
  var visitors = Object.create(null), articles = Object.create(null);
  value.signals.forEach(function (row) {
    if (row.sourceIdentity) visitors[row.sourceIdentity.value] = true;
    if (row.articleId) articles[row.articleId] = true;
  });
  var visitorCount = Object.keys(visitors).length, articleCount = Object.keys(articles).length;
  return {
    schemaVersion: EXTERNAL_SCHEMA,
    domain: 'defense',
    status: signal ? 'ELIGIBLE' : 'ABSTAINED',
    reason: signal ? null : 'domain-has-no-graded-external-action-outcome',
    resolvedCount: value.resolvedCount,
    learningGate: { ready: value.resolvedCount >= 5 && visitorCount >= 2 && articleCount >= 2, minimumResolved: 5,
      distinctVisitors: visitorCount, minimumDistinctVisitors: 2, distinctArticles: articleCount, minimumDistinctArticles: 2 },
    signal: signal
  };
}

module.exports = { SCHEMA: SCHEMA, STATE_KEY: STATE_KEY, causeKey: causeKey, recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain };
