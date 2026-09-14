'use strict';

/**
 * Reafference for the subject domain whose stress-derived artifact was carried
 * through Communication's social motor. Communication learns channel behavior;
 * this ledger separately teaches the originating domain how its own selected
 * program performed.
 */

var Contracts = require('./domain-commercial-contracts.js');

var SCHEMA = 'domain-commercial-social-learning/1.0';
var SIGNAL_SCHEMA = 'product-domain-external-learning/1.0';
var STATE_PREFIX = 'domain_commercial:social-learning:';
var CAUSE_PREFIX = 'domain_commercial:social-cause:';

function stateKey(domain) { return STATE_PREFIX + domain; }
function causeKey(domain, commandId) { return CAUSE_PREFIX + domain + ':' + commandId; }
function fresh(domain, ownerDomain) {
  return { schemaVersion: SCHEMA, productDomain: domain, ownerDomain: ownerDomain,
    lane: 'public-social-distribution', resolvedCount: 0, distinctArtifacts: 0,
    signals: [], processedObservationIds: [], artifactIds: [] };
}
function validCommand(command) {
  return !!(command && Contracts.get(command.subjectDomain) && command.ownerDomain === 'communication' &&
    command.lane === 'social' && command.commandId && command.sourceArtifactId &&
    command.sourceIntentId && command.sourcePacketId && command.domainDecisionReceiptId);
}
async function recordCommand(store, command) {
  if (!validCommand(command)) return { ok: false, reason: 'stress-derived-domain-social-command-required' };
  var contract = Contracts.get(command.subjectDomain);
  var cause = {
    schemaVersion: SCHEMA,
    productDomain: command.subjectDomain,
    ownerDomain: contract.ownerDomain,
    channelOwnerDomain: 'communication',
    lane: 'public-social-distribution',
    actionId: command.commandId,
    commandId: command.commandId,
    decisionReceiptId: command.decisionReceiptId,
    domainDecisionReceiptId: command.domainDecisionReceiptId,
    sourceArtifactId: command.sourceArtifactId,
    sourceIntentId: command.sourceIntentId,
    sourcePacketId: command.sourcePacketId,
    selectedProgram: command.selectedProgram,
    contentHash: command.contentHash,
    predictedOutcome: command.predictedOutcome,
    commandedAt: command.commandedAt
  };
  var created = await store.setIfAbsent(causeKey(command.subjectDomain, command.commandId), cause);
  var restored = await store.get(causeKey(command.subjectDomain, command.commandId));
  if (!restored || restored.commandId !== command.commandId || restored.sourceArtifactId !== command.sourceArtifactId ||
      restored.productDomain !== command.subjectDomain) throw new Error('domain commercial social cause readback invalid');
  return { ok: true, duplicate: !created, cause: restored };
}

function outcome(observation) {
  var delta = Number(observation && observation.engagementDelta || 0);
  if (delta > 0) return { label: 'ENGAGEMENT_INCREASED', credit: 1, delta: delta };
  if (delta < 0) return { label: 'ENGAGEMENT_DECREASED', credit: 0, delta: delta };
  return { label: 'NO_CHANGE', credit: 0.5, delta: 0 };
}

async function recordObservation(store, command, observation) {
  if (!validCommand(command) || !observation || observation.status !== 'OBSERVED' ||
      !observation.observationId || !observation.sourceIdentity || !observation.postReceipt ||
      !observation.postReceipt.uri) return { ok: false, reason: 'independent-domain-social-observation-required' };
  var cause = await store.get(causeKey(command.subjectDomain, command.commandId));
  if (!cause || cause.sourceArtifactId !== command.sourceArtifactId) {
    return { ok: false, reason: 'domain-social-action-cause-missing' };
  }
  var contract = Contracts.get(command.subjectDomain);
  var resolved = outcome(observation);
  var signal = {
    schemaVersion: SIGNAL_SCHEMA,
    signalId: 'dcs_' + observation.observationId,
    eventId: observation.observationId,
    actionId: command.commandId,
    productDomain: command.subjectDomain,
    ownerDomain: contract.ownerDomain,
    channelOwnerDomain: 'communication',
    lane: 'public-social-distribution',
    eventType: 'OUTCOME_DOMAIN_SOCIAL_ENGAGEMENT',
    sourceArtifactId: command.sourceArtifactId,
    sourceIntentId: command.sourceIntentId,
    sourcePacketId: command.sourcePacketId,
    selectedProgram: command.selectedProgram,
    observedAt: observation.observedAt,
    outcome: resolved.label,
    normalizedCredit: resolved.credit,
    sourceKind: 'independent-action-outcome',
    sourceIdentity: observation.sourceIdentity,
    engagementDelta: resolved.delta,
    postUri: observation.postReceipt.uri
  };
  for (var attempt = 0; attempt < 5; attempt++) {
    var current = await store.get(stateKey(command.subjectDomain));
    var value = current || fresh(command.subjectDomain, contract.ownerDomain);
    if (value.schemaVersion !== SCHEMA || value.productDomain !== command.subjectDomain ||
        !Array.isArray(value.signals) || !Array.isArray(value.processedObservationIds) ||
        !Array.isArray(value.artifactIds)) throw new Error('domain commercial social learning state malformed');
    if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
    var next = JSON.parse(JSON.stringify(value));
    next.signals.push(signal); next.signals = next.signals.slice(-200);
    next.processedObservationIds.push(observation.observationId);
    next.processedObservationIds = next.processedObservationIds.slice(-2000);
    if (next.artifactIds.indexOf(command.sourceArtifactId) < 0) next.artifactIds.push(command.sourceArtifactId);
    next.artifactIds = next.artifactIds.slice(-500);
    next.distinctArtifacts = next.artifactIds.length;
    next.resolvedCount = Number(next.resolvedCount || 0) + 1;
    next.lastOutcomeAt = observation.observedAt;
    next.latestSignal = signal;
    var written = current
      ? await store.replaceIfValue(stateKey(command.subjectDomain), current, next)
      : await store.setIfAbsent(stateKey(command.subjectDomain), next);
    if (!written) continue;
    var restored = await store.get(stateKey(command.subjectDomain));
    if (!restored || restored.resolvedCount !== next.resolvedCount ||
        !restored.latestSignal || restored.latestSignal.signalId !== signal.signalId) {
      throw new Error('domain commercial social learning readback invalid');
    }
    return { ok: true, duplicate: false, signal: signal, resolvedCount: restored.resolvedCount };
  }
  throw new Error('domain commercial social learning concurrent update exhausted');
}

async function readForBrain(store, domain) {
  var contract = Contracts.get(domain);
  if (!contract) return null;
  var value = await store.get(stateKey(domain));
  if (!value) return { schemaVersion: SCHEMA, productDomain: domain, ownerDomain: contract.ownerDomain,
    status: 'ABSTAINED', reason: 'domain-has-no-independent-public-social-outcome', resolvedCount: 0,
    learningGate: { ready: false, minimumResolved: 5, distinctArtifacts: 0, minimumDistinctArtifacts: 2 }, signal: null };
  var signal = value.latestSignal || value.signals[value.signals.length - 1] || null;
  return { schemaVersion: SCHEMA, productDomain: domain, ownerDomain: contract.ownerDomain,
    status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-independent-public-social-outcome',
    resolvedCount: Number(value.resolvedCount || 0),
    learningGate: { ready: Number(value.resolvedCount || 0) >= 5 && Number(value.distinctArtifacts || 0) >= 2,
      minimumResolved: 5, distinctArtifacts: Number(value.distinctArtifacts || 0), minimumDistinctArtifacts: 2 },
    signal: signal };
}

module.exports = { SCHEMA: SCHEMA, SIGNAL_SCHEMA: SIGNAL_SCHEMA, STATE_PREFIX: STATE_PREFIX,
  CAUSE_PREFIX: CAUSE_PREFIX, stateKey: stateKey, causeKey: causeKey, recordCommand: recordCommand,
  recordObservation: recordObservation, readForBrain: readForBrain };
