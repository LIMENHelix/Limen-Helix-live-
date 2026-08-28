'use strict';

var SCHEMA = 'culture-hero-learning/1.0';
var EXTERNAL = 'product-domain-external-learning/1.0';
var STATE_KEY = 'culture_hero_learning_state';
var CAUSE_PREFIX = 'culture_hero_learning_cause:';
function causeKey(id) { return CAUSE_PREFIX + id; }
function fresh() { return { schemaVersion: SCHEMA, domain: 'culture', lane: 'hero-image', resolvedCount: 0, signals: [], processedObservationIds: [] }; }
async function load(store) { var value = await store.get(STATE_KEY); if (!value) return fresh(); if (value.schemaVersion !== SCHEMA || !Array.isArray(value.signals) || !Array.isArray(value.processedObservationIds)) throw new Error('culture hero learning state malformed'); return value; }
async function save(store, value) { await store.set(STATE_KEY, value); var restored = await store.get(STATE_KEY); if (!restored || restored.resolvedCount !== value.resolvedCount) throw new Error('culture hero learning readback invalid'); return restored; }
async function recordCommand(store, command) { if (!command || command.ownerDomain !== 'culture' || command.lane !== 'hero-image' || !command.commandId) return { ok: false, reason: 'culture-hero-command-required' };
  var cause = { schemaVersion: SCHEMA, domain: 'culture', lane: 'hero-image', actionId: command.commandId, commandId: command.commandId,
    decisionReceiptId: command.decisionReceiptId, assetDomain: command.assetDomain, promptHash: command.promptHash, predictedOutcome: command.predictedOutcome, commandedAt: command.commandedAt };
  var created = await store.setIfAbsent(causeKey(command.commandId), cause), restored = await store.get(causeKey(command.commandId)); if (!restored || restored.commandId !== command.commandId) throw new Error('culture hero cause readback invalid'); return { ok: true, duplicate: !created }; }
async function recordObservation(store, observation) { if (!observation || ['OBSERVED_PRESENT', 'OBSERVED_ABSENT_OR_INVALID', 'OBSERVED_INVALID'].indexOf(observation.status) < 0 || !observation.observationId || !observation.commandId) return { ok: false, reason: 'independent-public-asset-observation-required' };
  if (!await store.get(causeKey(observation.commandId))) return { ok: false, reason: 'culture-hero-action-cause-missing' }; var value = await load(store); if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
  var present = observation.status === 'OBSERVED_PRESENT'; var signal = { schemaVersion: EXTERNAL, signalId: 'els_' + observation.observationId, eventId: observation.observationId,
    actionId: observation.commandId, ownerDomain: 'culture', lane: 'hero-image', eventType: 'OUTCOME_PUBLIC_ASSET_READBACK', observedAt: observation.observedAt,
    outcome: present ? 'PUBLIC_ASSET_RETRIEVABLE' : 'PUBLIC_ASSET_INVALID_OR_ABSENT', normalizedCredit: present ? 1 : 0,
    sourceKind: 'independent-action-outcome', sourceIdentity: { kind: 'public-image-readback', value: String(observation.publicUrl) + '@' + String(observation.contentSha256 || observation.httpStatus) }, assetDomain: observation.assetDomain };
  value.signals.push(signal); value.signals = value.signals.slice(-200); value.processedObservationIds.push(observation.observationId); value.processedObservationIds = value.processedObservationIds.slice(-2000); value.resolvedCount++; value.lastOutcomeAt = observation.observedAt; await save(store, value); return { ok: true, signal: signal, resolvedCount: value.resolvedCount }; }
async function readForBrain(store) { var value = await load(store), signal = value.signals.length ? value.signals[value.signals.length - 1] : null, assets = {}; value.signals.forEach(function (row) { if (row.assetDomain) assets[row.assetDomain] = true; }); var distinct = Object.keys(assets).length;
  return { schemaVersion: EXTERNAL, domain: 'culture', status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-graded-external-action-outcome', resolvedCount: value.resolvedCount,
    learningGate: { ready: value.resolvedCount >= 5 && distinct >= 2, minimumResolved: 5, distinctAssets: distinct, minimumDistinctAssets: 2 }, signal: signal }; }
module.exports = { SCHEMA: SCHEMA, STATE_KEY: STATE_KEY, causeKey: causeKey, recordCommand: recordCommand, recordObservation: recordObservation, readForBrain: readForBrain };
