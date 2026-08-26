'use strict';

/** Religion-local outcome learning ledger consumed only by the Religion brain. */
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
async function save(store, state) { await store.set(STATE_KEY, state, 365 * 86400); var r = await store.get(STATE_KEY);
  if (!r || r.schemaVersion !== SCHEMA || r.resolvedCount !== state.resolvedCount) throw new Error('religion subscriber learning state readback invalid'); return r; }
async function recordCommand(store, command, item) {
  var cause = { schemaVersion: SCHEMA, domain: 'religion', lane: 'subscriber-email', actionId: item.actionId,
    commandId: command.commandId, decisionReceiptId: item.decisionReceiptId, contentHash: item.contentHash,
    predictedOutcome: { mailServerEvent: 'delivered-or-terminal-failure' }, commandedAt: Date.now() };
  var created = await store.setIfAbsent(causeKey(item.actionId), cause), restored = await store.get(causeKey(item.actionId));
  if (!restored || restored.actionId !== item.actionId || restored.commandId !== command.commandId) throw new Error('religion subscriber learning cause readback invalid');
  return { ok: true, duplicate: !created, cause: restored };
}
function credit(event) { if (event === 'clicked') return 1; if (event === 'delivered' || event === 'opened') return 0.5; return 0; }
function resolved(event) { return ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed'].indexOf(event) >= 0; }
async function recordObservation(store, observation) {
  if (!observation || !observation.observationId || !observation.actionId || !resolved(observation.lastEvent)) return { ok: false, reason: 'resolved-religion-observation-required' };
  var cause = await store.get(causeKey(observation.actionId)); if (!cause) return { ok: false, reason: 'religion-action-cause-missing' };
  var state = await load(store); if (state.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true, observationId: observation.observationId };
  var signal = { schemaVersion: ExternalSchema, signalId: 'els_' + observation.observationId, eventId: observation.observationId,
    actionId: observation.actionId, ownerDomain: 'religion', lane: 'subscriber-email', eventType: 'OUTCOME_SUBSCRIBER_' + observation.lastEvent.toUpperCase(),
    observedAt: observation.observedAt, outcome: observation.lastEvent, normalizedCredit: credit(observation.lastEvent),
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
module.exports = { SCHEMA: SCHEMA, EXTERNAL_SCHEMA: ExternalSchema, STATE_KEY: STATE_KEY, causeKey: causeKey,
  recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain, _load: load };
