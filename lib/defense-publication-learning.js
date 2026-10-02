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
  // Admission joins permanent observer/event records to the owner command, never the publication response alone.
  var cause = await store.get(causeKey(observation.actionId));
  if (!cause) return { ok: false, reason: 'defense-publication-action-cause-missing' };
  var command = await store.get('defense_publication_command:' + cause.commandId);
  var saved = await store.get('defense_publication_observation:' + observation.observationId);
  var event = await store.get('defense_publication_engagement:' + observation.eventId);
  var fields = ['schemaVersion', 'observationId', 'commandId', 'actionId', 'articleId', 'eventId',
    'sourceIdentityHash', 'visitorIdentityHash', 'status', 'engagementEligible', 'trafficClassification',
    'independentOfPublishResponse', 'publishEndpointCalled', 'observedAt', 'liveMoney'];
  if (cause.schemaVersion !== SCHEMA || cause.domain !== 'defense' || cause.lane !== 'publication' ||
      cause.actionId !== observation.actionId || cause.commandId !== observation.commandId ||
      !command || command.schemaVersion !== 'defense-publication-command/1.0' ||
      command.productDomain !== 'defense' || command.ownerDomain !== 'defense' || command.lane !== 'publication' ||
      command.commandId !== cause.commandId || command.actionId !== cause.actionId ||
      command.decisionReceiptId !== cause.decisionReceiptId || command.status !== 'PUBLISHED' ||
      command.durableReceiptReadbackVerified !== true || command.liveMoney !== false ||
      command.articleId !== observation.articleId || command.commandedAt !== cause.commandedAt ||
      !Number.isFinite(command.commandedAt) || !Number.isFinite(observation.observedAt) || observation.observedAt < command.commandedAt ||
      !saved || saved.schemaVersion !== 'defense-publication-observation/1.0' ||
      fields.some(function (field) { return saved[field] !== observation[field]; }) ||
      saved.independentOfPublishResponse !== true || saved.publishEndpointCalled !== false || saved.liveMoney !== false ||
      !event || event.schemaVersion !== 'defense-publication-engagement/1.0' || event.eventType !== 'SOURCE_LINK_CLICK' ||
      event.eventId !== observation.eventId || event.actionId !== command.actionId || event.articleId !== command.articleId ||
      event.visitorIdentityHash !== observation.visitorIdentityHash || event.sourceIdentityHash !== observation.sourceIdentityHash ||
      event.observedAt !== observation.observedAt || event.engagementEligible !== true ||
      event.trafficClassification !== observation.trafficClassification || event.independentOfPublishResponse !== true || event.liveMoney !== false) {
    return { ok: false, reason: 'defense-publication-observation-causal-join-invalid' };
  }
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
