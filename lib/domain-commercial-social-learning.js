'use strict';

/**
 * Reafference for the subject domain whose stress-derived artifact was carried
 * through Communication's social motor. Communication learns channel behavior;
 * this ledger separately teaches the originating domain how its own selected
 * program performed.
 */

var Contracts = require('./domain-commercial-contracts.js');
var ImmuneRouting = require('./immune-routing-contract.js');

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

function newerCause(candidate, current) {
  if (!current) return true;
  var candidateCommanded = Number(candidate.commandedAt || 0);
  var currentCommanded = Number(current.commandedAt || 0);
  if (candidateCommanded !== currentCommanded) return candidateCommanded > currentCommanded;
  var candidateObserved = Number(candidate.observedAt || 0);
  var currentObserved = Number(current.observedAt || 0);
  if (candidateObserved !== currentObserved) return candidateObserved > currentObserved;
  return String(candidate.signalId || '') > String(current.signalId || '');
}

async function admittedSubject(store, command, observation, cause, contract) {
  if (!await require('./communication-social-outcome-observer.js').admittedObservation(store, command, observation)) return false;
  return admittedCause(store, command, cause, contract);
}

async function admittedCause(store, command, cause, contract) {
  if (!cause || command.subjectDomain !== contract.productDomain) return false;
  if (cause.schemaVersion !== SCHEMA || cause.productDomain !== contract.productDomain || cause.ownerDomain !== contract.ownerDomain ||
      cause.channelOwnerDomain !== 'communication' || cause.lane !== 'public-social-distribution' || cause.actionId !== command.commandId ||
      ['commandId','decisionReceiptId','domainDecisionReceiptId','sourceArtifactId','sourceIntentId','sourcePacketId','selectedProgram','contentHash','commandedAt'].some(function (field) { return cause[field] !== command[field]; })) return false;
  var Decision = require('./domain-commercial-distribution-decision.js');
  var release = await store.get(Decision.key(contract.productDomain, command.sourceArtifactId, command.domainDecisionReceiptId));
  var artifact = await store.get(contract.artifactPrefix + command.sourceArtifactId), intent = await store.get(contract.intentPrefix + command.sourceIntentId);
  var ChannelDecision = require('./communication-social-decision.js'), channel = await store.get(ChannelDecision.decisionKey(command.decisionReceiptId));
  var source = channel && channel.sourceIdentity;
  return !!(release && release.schemaVersion === Decision.SCHEMA && release.decisionReceiptId === command.domainDecisionReceiptId &&
    release.status === 'RELEASED' && release.released === true && ImmuneRouting.permitsExternalEffect(release.immuneRouting) && release.productDomain === contract.productDomain && release.ownerDomain === contract.ownerDomain &&
    release.channelOwnerDomain === 'communication' && release.channel === 'communication:bluesky' && release.liveMoney === false &&
    ['sourceArtifactId','sourceIntentId','sourcePacketId','candidateHash','contentHash','selectedProgram'].every(function (field) { return release[field] === command[field]; }) &&
    Number.isFinite(release.decidedAt) && release.decidedAt <= command.commandedAt && Number.isFinite(release.expiresAt) && command.commandedAt < release.expiresAt &&
    artifact && artifact.schemaVersion === 'domain-commercial-artifact/1.0' && artifact.status === 'ARTIFACT_PREPARED' && artifact.externalEffectAuthorized === false &&
    artifact.productDomain === contract.productDomain && artifact.ownerDomain === contract.ownerDomain && artifact.artifactId === command.sourceArtifactId &&
    artifact.intentId === command.sourceIntentId && artifact.sourcePacketId === command.sourcePacketId && artifact.targetProgram === command.selectedProgram &&
    Number.isFinite(artifact.preparedAt) && artifact.preparedAt <= command.commandedAt && Number.isFinite(artifact.freshnessExpiresAt) && command.commandedAt < artifact.freshnessExpiresAt &&
    ImmuneRouting.permitsExternalEffect(channel.immuneRouting) && source && source.kind === 'domain-commercial-artifact' && source.value === contract.artifactPrefix + artifact.artifactId &&
    source.subjectDomain === contract.productDomain && source.artifactId === artifact.artifactId && source.intentId === artifact.intentId &&
    source.packetId === artifact.sourcePacketId && source.responseHash === artifact.contentHash &&
    intent && intent.schemaVersion === 'domain-commercial-intent/1.0' && intent.status === 'PLANNED' && intent.productDomain === contract.productDomain &&
    intent.ownerDomain === contract.ownerDomain && intent.intentId === artifact.intentId && intent.sourcePacketId === artifact.sourcePacketId &&
    intent.selectedProgram === artifact.targetProgram && Number.isFinite(intent.plannedAt) && intent.plannedAt <= artifact.preparedAt &&
    // Source-packet skew/freshness was admitted by the originating reflex; do not reinterpret that policy here.
    Number.isFinite(Date.parse(intent.sourcePacketGeneratedAt)));
}

function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function validSignal(signal, contract) {
  var source = signal && signal.sourceIdentity, grade = outcome(signal), now = Date.now();
  return !!(signal && signal.schemaVersion === SIGNAL_SCHEMA && signal.productDomain === contract.productDomain &&
    signal.ownerDomain === contract.ownerDomain && signal.channelOwnerDomain === 'communication' && signal.lane === 'public-social-distribution' &&
    signal.eventType === 'OUTCOME_DOMAIN_SOCIAL_ENGAGEMENT' && signal.sourceKind === 'independent-action-outcome' &&
    ['signalId','eventId','actionId','sourceArtifactId','sourceIntentId','sourcePacketId','selectedProgram','postUri'].every(function (field) { return nonempty(signal[field]); }) &&
    signal.signalId === 'dcs_' + signal.eventId && Number.isFinite(signal.commandedAt) && signal.commandedAt <= signal.observedAt &&
    Number.isFinite(signal.observedAt) && signal.observedAt <= now && Number.isSafeInteger(signal.engagementDelta) &&
    signal.outcome === grade.label && signal.normalizedCredit === grade.credit &&
    source && source.kind === 'bluesky-appview-snapshot' && nonempty(source.value) && source.value.indexOf(signal.postUri + '@') === 0 &&
    source.provider === 'bluesky-public-appview' && source.endpointHost === 'public.api.bsky.app' && source.independentOfAdapterId === 'bluesky-pds-write-adapter/1');
}
function uniqueIds(value) { return Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length; }
function validState(value, contract) {
  return !!(value && value.schemaVersion === SCHEMA && value.productDomain === contract.productDomain && value.ownerDomain === contract.ownerDomain &&
    value.lane === 'public-social-distribution' && Number.isSafeInteger(value.resolvedCount) && value.resolvedCount >= 0 &&
    Number.isSafeInteger(value.distinctArtifacts) && value.distinctArtifacts >= 0 && uniqueIds(value.artifactIds) &&
    value.distinctArtifacts === value.artifactIds.length && value.distinctArtifacts <= Math.min(value.resolvedCount, 500) && uniqueIds(value.processedObservationIds) &&
    value.processedObservationIds.length === Math.min(value.resolvedCount, 2000) && Array.isArray(value.signals) &&
    value.signals.length === Math.min(value.resolvedCount, 200) && value.signals.every(function (signal) { return validSignal(signal, contract) && value.processedObservationIds.indexOf(signal.eventId) >= 0; }) &&
    uniqueIds(value.signals.map(function (signal) { return signal.eventId; })) &&
    (value.resolvedCount > 200 || value.distinctArtifacts === new Set(value.signals.map(function (signal) { return signal.sourceArtifactId; })).size) &&
    (value.latestSignal == null || validSignal(value.latestSignal, contract)) &&
    (value.resolvedCount > 0 || value.latestSignal == null && value.distinctArtifacts === 0));
}
async function admittedReturnedSignal(store, signal, contract) {
  var Executor = require('./communication-social-executor.js'), Observer = require('./communication-social-outcome-observer.js');
  var command = await store.get(Executor.commandKey(signal.actionId));
  if (!command || !command.receipt || command.receipt.uri !== signal.postUri ||
      ['sourceArtifactId','sourceIntentId','sourcePacketId','selectedProgram','commandedAt'].some(function (field) { return command[field] !== signal[field]; }) ||
      !await Observer.joinedCommand(store, signal.actionId, command.receipt, Date.now())) return false;
  // Graded history outlives the observation work queue; validate its owning command/cause, not queue membership.
  return admittedCause(store, command, await store.get(causeKey(contract.productDomain, signal.actionId)), contract);
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
  if (!await admittedSubject(store, command, observation, cause, contract)) return { ok: false, reason: 'domain-social-observation-causal-join-invalid' };
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
    commandedAt: command.commandedAt,
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
    if (!validState(value, contract)) throw new Error('domain commercial social learning state malformed');
    if (value.processedObservationIds.indexOf(observation.observationId) >= 0) return { ok: true, duplicate: true };
    var next = JSON.parse(JSON.stringify(value));
    next.signals.push(signal); next.signals = next.signals.slice(-200);
    next.processedObservationIds.push(observation.observationId);
    next.processedObservationIds = next.processedObservationIds.slice(-2000);
    if (next.artifactIds.indexOf(command.sourceArtifactId) < 0) next.artifactIds.push(command.sourceArtifactId);
    next.artifactIds = next.artifactIds.slice(-500);
    next.distinctArtifacts = next.artifactIds.length;
    next.resolvedCount = Number(next.resolvedCount || 0) + 1;
    next.lastOutcomeAt = Math.max(Number(next.lastOutcomeAt || 0), Number(observation.observedAt || 0));
    if (newerCause(signal, next.latestSignal)) next.latestSignal = signal;
    var expectedLatestSignalId = next.latestSignal && next.latestSignal.signalId;
    var written = current
      ? await store.replaceIfValue(stateKey(command.subjectDomain), current, next)
      : await store.setIfAbsent(stateKey(command.subjectDomain), next);
    if (!written) continue;
    var restored = await store.get(stateKey(command.subjectDomain));
    if (!validState(restored, contract) || restored.resolvedCount !== next.resolvedCount ||
        !restored.latestSignal || restored.latestSignal.signalId !== expectedLatestSignalId) {
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
  if (!validState(value, contract)) throw new Error('domain commercial social learning state malformed');
  var signal = value.latestSignal || value.signals[value.signals.length - 1] || null;
  if (signal && !await admittedReturnedSignal(store, signal, contract)) throw new Error('domain commercial social learning returned cause invalid');
  return { schemaVersion: SCHEMA, productDomain: domain, ownerDomain: contract.ownerDomain,
    status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-independent-public-social-outcome',
    resolvedCount: Number(value.resolvedCount || 0),
    learningGate: { ready: Number(value.resolvedCount || 0) >= 5 && Number(value.distinctArtifacts || 0) >= 2,
      minimumResolved: 5, distinctArtifacts: Number(value.distinctArtifacts || 0), minimumDistinctArtifacts: 2 },
    signal: signal };
}

module.exports = { SCHEMA: SCHEMA, SIGNAL_SCHEMA: SIGNAL_SCHEMA, STATE_PREFIX: STATE_PREFIX,
  CAUSE_PREFIX: CAUSE_PREFIX, stateKey: stateKey, causeKey: causeKey, recordCommand: recordCommand,
  recordObservation: recordObservation, readForBrain: readForBrain, newerCause: newerCause };
