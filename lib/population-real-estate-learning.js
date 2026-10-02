'use strict';

var crypto = require('node:crypto');
var SCHEMA = 'population-real-estate-learning/1.0';
var EXTERNAL = 'product-domain-external-learning/1.0';
var STATE_KEY = 'population_real_estate_learning_state';
var CAUSE_PREFIX = 'population_real_estate_learning_cause:';
function causeKey(id) { return CAUSE_PREFIX + id; }
function fresh() { return { schemaVersion: SCHEMA, domain: 'population', lane: 'real-estate', resolvedCount: 0, signals: [], processedObservationIds: [] }; }
async function load(store) { var state = await store.get(STATE_KEY); if (!state) return fresh(); if (state.schemaVersion !== SCHEMA || !Array.isArray(state.signals) || !Array.isArray(state.processedObservationIds)) throw new Error('population real-estate learning state malformed'); return state; }
async function save(store, state) { await store.set(STATE_KEY, state); var restored = await store.get(STATE_KEY); if (!restored || restored.resolvedCount !== state.resolvedCount) throw new Error('population real-estate learning readback invalid'); return restored; }
async function recordCommand(store, command) { var cause = { schemaVersion: SCHEMA, domain: 'population', lane: 'real-estate', actionId: command.actionId, commandId: command.commandId, decisionReceiptId: command.decisionReceiptId, counterpartyEmailHash: command.counterpartyEmailHash, propertyRefHash: command.propertyRefHash, listingUrlHash: command.listingUrlHash, indicationPriceUsd: command.indicationPriceUsd, contentHash: command.contentHash, evidenceHash: command.evidenceHash, predictedOutcome: command.predictedOutcome, commandedAt: command.commandedAt }; var created = await store.setIfAbsent(causeKey(command.actionId), cause); var restored = await store.get(causeKey(command.actionId)); if (!restored || restored.commandId !== command.commandId) throw new Error('population real-estate cause readback invalid'); return { ok: true, duplicate: !created }; }
async function recordObservation(store, observation) { if (!observation || observation.status !== 'COUNTERPARTY_RESPONSE_OBSERVED' || !observation.observationId || !observation.actionId) return { ok: false, reason: 'independent-counterparty-response-required' }; var cause = await store.get(causeKey(observation.actionId));
  if (!cause) return { ok: false, reason: 'population-real-estate-action-cause-missing' };
  var command = await store.get('population_real_estate_command:' + cause.commandId);
  var saved = await store.get('population_real_estate_observation:' + observation.providerInboundEmailId);
  var action = await store.get('population_real_estate_action:' + observation.actionId);
  var fields = ['schemaVersion', 'observationId', 'commandId', 'actionId', 'providerInboundEmailId',
    'counterpartyEmailHash', 'propertyRefHash', 'listingUrlHash', 'indicationPriceUsd', 'status', 'sourceEventType',
    'sourceEventCreatedAt', 'independentOfSendResponse', 'webhookSignatureVerified', 'sendEndpointCalled', 'observedAt', 'liveMoney'];
  var sourceAt = Date.parse(observation.sourceEventCreatedAt);
  if (cause.schemaVersion !== SCHEMA || cause.domain !== 'population' || cause.lane !== 'real-estate' ||
      cause.actionId !== observation.actionId || cause.commandId !== observation.commandId || !command ||
      command.schemaVersion !== 'population-real-estate-command/1.0' || command.productDomain !== 'population' ||
      command.ownerDomain !== 'population' || command.lane !== 'real-estate' || command.status !== 'INQUIRY_ACCEPTED' ||
      command.commandId !== cause.commandId || command.actionId !== cause.actionId || command.decisionReceiptId !== cause.decisionReceiptId ||
      command.commandedAt !== cause.commandedAt || command.contentHash !== cause.contentHash || command.evidenceHash !== cause.evidenceHash ||
      command.counterpartyEmailHash !== cause.counterpartyEmailHash || command.propertyRefHash !== cause.propertyRefHash ||
      command.listingUrlHash !== cause.listingUrlHash || command.indicationPriceUsd !== cause.indicationPriceUsd ||
      !command.decisionReceiptId || !command.providerEmailId || !observation.providerInboundEmailId ||
      observation.observationId !== 'pro_' + crypto.createHash('sha256').update(observation.providerInboundEmailId + ':' + observation.actionId).digest('hex').slice(0, 24) || command.readbackVerified !== true || command.nonBinding !== true ||
      command.contractAuthorized !== false || command.earnestMoneyAuthorized !== false || command.fundsTransferAuthorized !== false ||
      command.liveMoney !== false || !action || action.status !== 'INQUIRY_ACCEPTED' || action.commandId !== command.commandId ||
      action.actionId !== command.actionId || action.providerEmailId !== command.providerEmailId ||
      command.counterpartyEmailHash !== observation.counterpartyEmailHash || command.propertyRefHash !== observation.propertyRefHash ||
      command.listingUrlHash !== observation.listingUrlHash || command.indicationPriceUsd !== observation.indicationPriceUsd ||
      !Number.isFinite(command.commandedAt) || !Number.isFinite(observation.observedAt) ||
      observation.observedAt < command.commandedAt || observation.observedAt > Date.now() || !Number.isFinite(sourceAt) ||
      sourceAt < command.commandedAt || sourceAt > observation.observedAt || !saved ||
      saved.schemaVersion !== 'population-real-estate-observation/1.0' || fields.some(function (field) { return saved[field] !== observation[field]; }) ||
      saved.sourceEventType !== 'email.received' || saved.independentOfSendResponse !== true || saved.webhookSignatureVerified !== true ||
      saved.sendEndpointCalled !== false || saved.liveMoney !== false) return { ok: false, reason: 'population-real-estate-observation-causal-join-invalid' };
  var state = await load(store); if (state.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true }; var signal = { schemaVersion: EXTERNAL, signalId: 'els_' + observation.observationId, eventId: observation.observationId, actionId: observation.actionId, ownerDomain: 'population', lane: 'real-estate', eventType: 'OUTCOME_REAL_ESTATE_COUNTERPARTY_RESPONSE', observedAt: observation.observedAt, outcome: 'counterparty-response-unclassified', normalizedCredit: 0, sourceKind: 'independent-action-outcome', sourceIdentity: { kind: 'resend-signed-inbound-email', value: observation.providerInboundEmailId }, propertyRefHash: observation.propertyRefHash, listingUrlHash: observation.listingUrlHash }; state.signals.push(signal); state.signals = state.signals.slice(-200); state.processedObservationIds.push(observation.observationId); state.processedObservationIds = state.processedObservationIds.slice(-2000); state.resolvedCount++; state.lastOutcomeAt = observation.observedAt; await save(store, state); return { ok: true, signal: signal, resolvedCount: state.resolvedCount }; }
async function readForBrain(store) { var state = await load(store), signal = state.signals.length ? state.signals[state.signals.length - 1] : null, ids = {}; state.signals.forEach(function (item) { if (item.sourceIdentity) ids[item.sourceIdentity.kind + ':' + item.sourceIdentity.value] = true; }); var distinct = Object.keys(ids).length; return { schemaVersion: EXTERNAL, domain: 'population', status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-graded-external-action-outcome', resolvedCount: state.resolvedCount, learningGate: { ready: state.resolvedCount >= 5 && distinct >= 2, minimumResolved: 5, distinctSources: distinct, minimumDistinctSources: 2 }, signal: signal }; }
async function readForDecision(store, actionId) { var state = await load(store), rows = state.signals.slice().reverse(); for (var i = 0; i < rows.length; i++) { var signal = rows[i]; if (!signal || signal.actionId !== actionId) continue; var cause = await store.get(causeKey(signal.actionId)); if (!cause || (cause.ownerDomain || cause.domain) !== 'population' || cause.lane !== 'real-estate') continue; return { schemaVersion: 'population-returned-outcome/1.0', ownerDomain: 'population', status: 'OBSERVED', signalId: signal.signalId, signalOutcome: signal.outcome, signalObservedAt: signal.observedAt, normalizedCredit: signal.normalizedCredit, actionId: signal.actionId, resolvedCount: state.resolvedCount, requiresReassessment: signal.normalizedCredit <= 0, effect: 'CONSUMED_AS_POPULATION_AFFERENT' }; } return { schemaVersion: 'population-returned-outcome/1.0', ownerDomain: 'population', status: 'UNOBSERVED', signalId: null, signalOutcome: null, signalObservedAt: null, normalizedCredit: null, actionId: actionId, resolvedCount: state.resolvedCount, requiresReassessment: false, effect: 'NO_RETURNED_OUTCOME_YET' }; }
module.exports = { SCHEMA: SCHEMA, STATE_KEY: STATE_KEY, causeKey: causeKey, recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain, readForDecision: readForDecision };
