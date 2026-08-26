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
  if (!await store.get(causeKey(observation.actionId))) return { ok: false, reason: 'law-automail-action-cause-missing' }; var value = await load(store); if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
  var state = String(observation.providerState || '').toLowerCase(), credit = state === 'delivered' ? 1 : (state === 'failed' || state === 'deleted' || state === 'returned') ? 0 : 0.5;
  var signal = { schemaVersion: EXTERNAL, signalId: 'els_' + observation.observationId, eventId: observation.observationId, actionId: observation.actionId,
    ownerDomain: 'law', lane: 'automail', eventType: 'OUTCOME_PHYSICAL_MAIL_PROVIDER_STATE', observedAt: observation.observedAt,
    outcome: state || 'unknown', normalizedCredit: credit, sourceKind: 'independent-action-outcome',
    sourceIdentity: { kind: 'lob-letter-readback', value: observation.providerLetterId + '@' + String(observation.providerModifiedAt || observation.observedAt) } };
  value.signals.push(signal); value.signals = value.signals.slice(-200); value.processedObservationIds.push(observation.observationId); value.processedObservationIds = value.processedObservationIds.slice(-2000); value.resolvedCount++; value.lastOutcomeAt = observation.observedAt; await save(store, value); return { ok: true, signal: signal, resolvedCount: value.resolvedCount }; }
async function readForBrain(store) { var value = await load(store), signal = value.signals.length ? value.signals[value.signals.length - 1] : null, letters = {}; value.signals.forEach(function (row) { if (row.sourceIdentity) letters[String(row.sourceIdentity.value).split('@')[0]] = true; }); var distinct = Object.keys(letters).length;
  return { schemaVersion: EXTERNAL, domain: 'law', status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-graded-external-action-outcome', resolvedCount: value.resolvedCount,
    learningGate: { ready: value.resolvedCount >= 5 && distinct >= 2, minimumResolved: 5, distinctLetters: distinct, minimumDistinctLetters: 2 }, signal: signal }; }
module.exports = { SCHEMA: SCHEMA, STATE_KEY: STATE_KEY, causeKey: causeKey, recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain };
