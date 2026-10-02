'use strict';

var SCHEMA = 'law-automail-learning/1.0';
var EXTERNAL = 'product-domain-external-learning/1.0';
var STATE_KEY = 'law_automail_learning_state';
var CAUSE_PREFIX = 'law_automail_learning_cause:';
function causeKey(id) { return CAUSE_PREFIX + id; }
function fresh() { return { schemaVersion: SCHEMA, domain: 'law', lane: 'automail', resolvedCount: 0, signals: [], processedObservationIds: [] }; }
async function load(store) { var value = await store.get(STATE_KEY); if (!value) return fresh(); if (value.schemaVersion !== SCHEMA || !Array.isArray(value.signals) || !Array.isArray(value.processedObservationIds)) throw new Error('law automail learning state malformed'); return value; }
async function save(store, value) { await store.set(STATE_KEY, value); var restored = await store.get(STATE_KEY); if (!restored || restored.resolvedCount !== value.resolvedCount) throw new Error('law automail learning readback invalid'); return restored; }
async function recordCommand(store, command) { if (!command || command.ownerDomain !== 'law' || command.lane !== 'automail' || !command.actionId) return { ok: false, reason: 'law-automail-command-required' };
  var cause = { schemaVersion: SCHEMA, domain: 'law', lane: 'automail', actionId: command.actionId, commandId: command.commandId, decisionReceiptId: command.decisionReceiptId,
    parcelHash: command.parcelHash, contentHash: command.contentHash, predictedOutcome: command.predictedOutcome, commandedAt: command.commandedAt };
  var created = await store.setIfAbsent(causeKey(command.actionId), cause), restored = await store.get(causeKey(command.actionId)); if (!restored || restored.commandId !== command.commandId) throw new Error('law automail cause readback invalid'); return { ok: true, duplicate: !created }; }
async function recordObservation(store, observation) { if (!observation || ['PROVIDER_STATE_OBSERVED', 'TERMINAL_OBSERVED'].indexOf(observation.status) < 0 || !observation.observationId || !observation.actionId || !observation.providerLetterId) return { ok: false, reason: 'independent-provider-state-observation-required' };
  var cause = await store.get(causeKey(observation.actionId));
  if (!cause) return { ok: false, reason: 'law-automail-action-cause-missing' };
  var command = await store.get('law_automail_command:' + cause.commandId), saved = await store.get('law_automail_observation:' + observation.observationId);
  var fields = ['schemaVersion', 'observationId', 'commandId', 'actionId', 'providerLetterId', 'status', 'providerState',
    'expectedDeliveryDate', 'sendDate', 'providerCreatedAt', 'providerModifiedAt', 'independentOfCreateResponse', 'readMethod', 'createEndpointCalled', 'observedAt', 'liveMoney'];
  if (cause.schemaVersion !== SCHEMA || cause.domain !== 'law' || cause.lane !== 'automail' || cause.actionId !== observation.actionId ||
      cause.commandId !== observation.commandId || !command || command.schemaVersion !== 'law-automail-command/1.0' ||
      command.productDomain !== 'law' || command.ownerDomain !== 'law' || command.lane !== 'automail' ||
      command.commandId !== cause.commandId || command.actionId !== cause.actionId || command.decisionReceiptId !== cause.decisionReceiptId ||
      command.parcelHash !== cause.parcelHash || command.contentHash !== cause.contentHash || command.commandedAt !== cause.commandedAt ||
      command.status !== 'ACCEPTED' || command.readbackVerified !== true || command.providerLetterId !== observation.providerLetterId ||
      typeof command.liveMoney !== 'boolean' || command.liveMoney !== observation.liveMoney || !Number.isFinite(command.commandedAt) ||
      !Number.isFinite(observation.observedAt) || observation.observedAt < command.commandedAt || observation.observedAt > Date.now() ||
      !saved || saved.schemaVersion !== 'law-automail-observation/1.0' || fields.some(function (field) { return saved[field] !== observation[field]; }) ||
      saved.independentOfCreateResponse !== true || saved.readMethod !== 'GET' || saved.createEndpointCalled !== false) {
    return { ok: false, reason: 'law-automail-observation-causal-join-invalid' };
  }
  var value = await load(store); if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
  var state = String(observation.providerState || '').toLowerCase(), credit = state === 'delivered' ? 1 : (state === 'failed' || state === 'deleted' || state === 'returned') ? 0 : 0.5;
  var signal = { schemaVersion: EXTERNAL, signalId: 'els_' + observation.observationId, eventId: observation.observationId, actionId: observation.actionId,
    ownerDomain: 'law', lane: 'automail', eventType: 'OUTCOME_PHYSICAL_MAIL_PROVIDER_STATE', observedAt: observation.observedAt,
    outcome: state || 'unknown', normalizedCredit: credit, sourceKind: 'independent-action-outcome',
    sourceIdentity: { kind: 'lob-letter-readback', value: observation.providerLetterId + '@' + String(observation.providerModifiedAt || observation.observedAt) } };
  value.signals.push(signal); value.signals = value.signals.slice(-200); value.processedObservationIds.push(observation.observationId); value.processedObservationIds = value.processedObservationIds.slice(-2000); value.resolvedCount++; value.lastOutcomeAt = observation.observedAt; await save(store, value); return { ok: true, signal: signal, resolvedCount: value.resolvedCount }; }
async function readForBrain(store) { var value = await load(store), signal = value.signals.length ? value.signals[value.signals.length - 1] : null, letters = {}; value.signals.forEach(function (row) { if (row.sourceIdentity) letters[String(row.sourceIdentity.value).split('@')[0]] = true; }); var distinct = Object.keys(letters).length;
  return { schemaVersion: EXTERNAL, domain: 'law', status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-graded-external-action-outcome', resolvedCount: value.resolvedCount,
    learningGate: { ready: value.resolvedCount >= 5 && distinct >= 2, minimumResolved: 5, distinctLetters: distinct, minimumDistinctLetters: 2 }, signal: signal }; }
async function readForDecision(store, actionId) { var value = await load(store), rows = value.signals.slice().reverse(); for (var i = 0; i < rows.length; i++) { var signal = rows[i]; if (!signal || signal.actionId !== actionId) continue; var cause = await store.get(causeKey(signal.actionId)); if (!cause || (cause.ownerDomain || cause.domain) !== 'law' || cause.lane !== 'automail') continue; return { schemaVersion: 'law-returned-outcome/1.0', ownerDomain: 'law', status: 'OBSERVED', signalId: signal.signalId, signalOutcome: signal.outcome, signalObservedAt: signal.observedAt, normalizedCredit: signal.normalizedCredit, actionId: signal.actionId, resolvedCount: value.resolvedCount, requiresReassessment: ['failed', 'deleted', 'returned'].indexOf(signal.outcome) >= 0, effect: 'CONSUMED_AS_LAW_AFFERENT' }; } return { schemaVersion: 'law-returned-outcome/1.0', ownerDomain: 'law', status: 'UNOBSERVED', signalId: null, signalOutcome: null, signalObservedAt: null, normalizedCredit: null, actionId: actionId, resolvedCount: value.resolvedCount, requiresReassessment: false, effect: 'NO_RETURNED_OUTCOME_YET' }; }
module.exports = { SCHEMA: SCHEMA, STATE_KEY: STATE_KEY, causeKey: causeKey, recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain, readForDecision: readForDecision };
