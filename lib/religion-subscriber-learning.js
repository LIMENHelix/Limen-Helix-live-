'use strict';

/** Religion-local outcome learning ledger consumed only by the Religion brain. */
var crypto = require('node:crypto');
var ExternalSchema = 'product-domain-external-learning/1.0';
var SCHEMA = 'religion-subscriber-learning/1.0';
var STATE_KEY = 'religion_subscriber_learning_state';
var CAUSE_PREFIX = 'religion_subscriber_learning_cause:';
var CAP = 200;
function causeKey(actionId) { return CAUSE_PREFIX + actionId; }
function fresh() { return { schemaVersion: SCHEMA, domain: 'religion', lane: 'subscriber-email', resolvedCount: 0, signals: [], processedObservationIds: [], lastOutcomeAt: null }; }
async function load(store) {
  var state = await store.get(STATE_KEY); if (!state) return fresh();
  if (state.schemaVersion !== SCHEMA || state.domain !== 'religion' || state.lane !== 'subscriber-email' || !Array.isArray(state.signals) || !Array.isArray(state.processedObservationIds)) throw new Error('religion subscriber learning state malformed');
  return state;
}
async function save(store, state) { await store.set(STATE_KEY, state); var r = await store.get(STATE_KEY);
  if (!r || r.schemaVersion !== SCHEMA || r.resolvedCount !== state.resolvedCount) throw new Error('religion subscriber learning state readback invalid'); return r; }
async function recordCommand(store, command, item) {
  var cause = { schemaVersion: SCHEMA, domain: 'religion', lane: 'subscriber-email', actionId: item.actionId,
    commandId: command.commandId, decisionReceiptId: item.decisionReceiptId, contentHash: item.contentHash,
    revenueDecisionId: item.revenueDecisionId || null, emailHash: item.emailHash, subscriberDomain: item.subscriberDomain, digestKey: item.digestKey, subjectHash: item.subjectHash,
    predictedOutcome: { mailServerEvent: 'delivered-or-terminal-failure' }, commandedAt: command.commandedAt };
  var created = await store.setIfAbsent(causeKey(item.actionId), cause), restored = await store.get(causeKey(item.actionId));
  if (!restored || restored.actionId !== item.actionId || restored.commandId !== command.commandId) throw new Error('religion subscriber learning cause readback invalid');
  return { ok: true, duplicate: !created, cause: restored };
}
function credit(event) { if (event === 'clicked') return 1; if (event === 'delivered' || event === 'opened') return 0.5; return 0; }
function resolved(event) { return ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed'].indexOf(event) >= 0; }
async function recordObservation(store, observation) {
  if (!observation || !observation.observationId || !observation.actionId || !resolved(observation.lastEvent)) return { ok: false, reason: 'resolved-religion-observation-required' };
  var cause = await store.get(causeKey(observation.actionId)); if (!cause) return { ok: false, reason: 'religion-action-cause-missing' };
  var command = await store.get('religion_subscriber_command:' + cause.commandId);
  var action = await store.get('religion_subscriber_action:' + observation.actionId);
  var saved = await store.get('religion_subscriber_observation:' + observation.observationId);
  var items = command && Array.isArray(command.items) ? command.items.filter(function (row) { return row.actionId === observation.actionId; }) : [];
  var item = items[0];
  var fields = ['schemaVersion', 'observationId', 'commandId', 'actionId', 'providerEmailId', 'emailHash', 'status', 'lastEvent',
    'providerRecordCreatedAt', 'independentOfSendResponse', 'mailServerFeedback', 'sendEndpointCalled', 'readMethod', 'observedAt', 'liveMoney'];
  var providerCreatedAt = Date.parse(observation.providerRecordCreatedAt);
  if (cause.schemaVersion !== SCHEMA || cause.domain !== 'religion' || cause.lane !== 'subscriber-email' ||
      cause.actionId !== observation.actionId || cause.commandId !== observation.commandId || !command ||
      command.schemaVersion !== 'religion-subscriber-command/1.0' || command.productDomain !== 'religion' || command.ownerDomain !== 'religion' ||
      command.lane !== 'subscriber-email' || ['RECEIPTS_PERSISTED', 'PARTIAL_AMBIGUOUS'].indexOf(command.status) < 0 ||
      command.commandId !== cause.commandId || command.commandedAt !== cause.commandedAt || command.readbackVerified !== true ||
      command.liveMoney !== false || items.length !== 1 || item.status !== 'ACCEPTED' ||
      ['decisionReceiptId', 'contentHash', 'revenueDecisionId', 'emailHash', 'subscriberDomain', 'digestKey', 'subjectHash'].some(function (field) { return !item[field] || item[field] !== cause[field]; }) ||
      item.providerEmailId !== observation.providerEmailId || item.emailHash !== observation.emailHash || !action ||
      action.schemaVersion !== 'religion-subscriber-command/1.0' || action.status !== 'ACCEPTED' || action.commandId !== command.commandId || action.actionId !== item.actionId ||
      action.providerEmailId !== item.providerEmailId || !Number.isFinite(command.commandedAt) ||
      !Number.isFinite(observation.observedAt) || observation.observedAt < command.commandedAt || observation.observedAt > Date.now() ||
      !Number.isFinite(providerCreatedAt) || providerCreatedAt < command.commandedAt || providerCreatedAt > observation.observedAt ||
      !saved || saved.schemaVersion !== 'religion-subscriber-observation/1.0' || fields.some(function (field) { return saved[field] !== observation[field]; }) ||
      ['TERMINAL_OBSERVED', 'PENDING_OBSERVED'].indexOf(saved.status) < 0 || saved.independentOfSendResponse !== true ||
      saved.sendEndpointCalled !== false || saved.readMethod !== 'GET' || saved.liveMoney !== false ||
      saved.observationId !== 'rso_' + crypto.createHash('sha256').update(command.commandId + ':' + item.actionId + ':' + item.providerEmailId + ':' + saved.lastEvent + ':' + String(saved.providerRecordCreatedAt || '')).digest('hex').slice(0, 24))
    return { ok: false, reason: 'religion-observation-causal-join-invalid' };
  var state = await load(store); if (state.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true, observationId: observation.observationId };
  var signal = { schemaVersion: ExternalSchema, signalId: 'els_' + observation.observationId, eventId: observation.observationId,
    actionId: observation.actionId, ownerDomain: 'religion', lane: 'subscriber-email', eventType: 'OUTCOME_SUBSCRIBER_' + observation.lastEvent.toUpperCase(),
    observedAt: observation.observedAt, outcome: observation.lastEvent, normalizedCredit: credit(observation.lastEvent),
    revenueDecisionId: cause.revenueDecisionId || null,
    sourceKind: 'independent-action-outcome', sourceIdentity: { kind: 'resend-read-api-mail-server-event', value: observation.providerEmailId } };
  state.signals.push(signal); if (state.signals.length > CAP) state.signals = state.signals.slice(-CAP);
  state.processedObservationIds.push(observation.observationId); if (state.processedObservationIds.length > 2000) state.processedObservationIds = state.processedObservationIds.slice(-2000);
  state.resolvedCount++; state.latestSignalId = signal.signalId; state.lastOutcomeAt = observation.observedAt; await save(store, state);
  return { ok: true, duplicate: false, signal: signal, resolvedCount: state.resolvedCount };
}
async function readForBrain(store) {
  var state = await load(store), signal = state.signals.length ? state.signals[state.signals.length - 1] : null, identities = {};
  state.signals.forEach(function (s) { if (s && s.sourceIdentity) identities[s.sourceIdentity.kind + ':' + s.sourceIdentity.value] = true; });
  var distinct = Object.keys(identities).length, ready = state.resolvedCount >= 5 && distinct >= 2;
  return { schemaVersion: ExternalSchema, domain: 'religion', status: signal ? 'ELIGIBLE' : 'ABSTAINED',
    reason: signal ? null : 'domain-has-no-graded-external-action-outcome', resolvedCount: state.resolvedCount,
    learningGate: { ready: ready, minimumResolved: 5, distinctSources: distinct, minimumDistinctSources: 2 }, signal: signal };
}
async function readForDecision(store, actionId) {
  var state = await load(store), rows = state.signals.slice().reverse();
  for (var i = 0; i < rows.length; i++) {
    var signal = rows[i]; if (!signal || signal.actionId !== actionId) continue;
    var cause = await store.get(causeKey(signal.actionId));
    if (!cause || (cause.ownerDomain || cause.domain) !== 'religion' || cause.lane !== 'subscriber-email') continue;
    return { schemaVersion: 'religion-returned-outcome/1.0', ownerDomain: 'religion', status: 'OBSERVED', signalId: signal.signalId,
      signalOutcome: signal.outcome, signalObservedAt: signal.observedAt, normalizedCredit: signal.normalizedCredit, actionId: signal.actionId,
      resolvedCount: state.resolvedCount, requiresReassessment: ['bounced', 'complained', 'failed', 'suppressed'].indexOf(signal.outcome) >= 0,
      effect: 'CONSUMED_AS_RELIGION_AFFERENT' };
  }
  return { schemaVersion: 'religion-returned-outcome/1.0', ownerDomain: 'religion', status: 'UNOBSERVED', signalId: null,
    signalOutcome: null, signalObservedAt: null, normalizedCredit: null, actionId: actionId, resolvedCount: state.resolvedCount,
    requiresReassessment: false, effect: 'NO_RETURNED_OUTCOME_YET' };
}
module.exports = { SCHEMA: SCHEMA, EXTERNAL_SCHEMA: ExternalSchema, STATE_KEY: STATE_KEY, causeKey: causeKey,
  recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain, readForDecision: readForDecision, _load: load };
