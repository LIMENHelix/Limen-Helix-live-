'use strict';

/**
 * Projects one already-completed Resend commissioning proof onto the shared
 * paid-subscriber motor rail.
 *
 * No email is sent here. Intelligence previously exercised the same Resend
 * send adapter against an owned, consented destination; the independent read
 * API observed it; and the address was durably suppressed. That transport
 * proof may be reused because all sovereign subscriber executors call the same
 * adapter and observer. The projection does not share cognition or authority:
 * every receipt is bound to one domain's own motor contract and namespace, and
 * the domain still must pass fresh B10, metabolism, entitlement, budget, local
 * valve and last-moment inhibition before any customer fulfillment.
 */

var crypto = require('node:crypto');
var Capability = require('./product-domain-motor-capability.js');
var MotorReceipt = require('./product-domain-motor-receipt.js');
var IntelligenceProof = require('./intelligence-autopilot-capability-verifier.js');
var Lanes = require('./sovereign-domain-subscriber-lanes.js');

var SCHEMA = 'subscriber-email-capability-projection/1.0';
var TTL_SECONDS = 6 * 60 * 60;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sourceEvidence(report) {
  var command = report && report._command, observation = report && report._observation;
  return !!(report && report.mayPersistCapabilities === true && command && observation &&
    command.commandId && command.providerEmailId && command.commissioningOnly === true &&
    command.ownedDestinationVerified === true && command.recipientConsentVerified === true &&
    command.businessStateTransitionSuppressed === true && command.futureSuppressionRecoveryVerified === true &&
    command.providerCalls === 1 && command.liveMoney === false && command.authorizationReceiptId &&
    command.suppressionReceiptId && observation.observationId &&
    observation.providerEmailId === command.providerEmailId &&
    observation.independentOfSendResponse === true && observation.sendEndpointCalled === false);
}

function pairFor(identity, source, now) {
  if (!sourceEvidence(source)) throw new Error('SUBSCRIBER_EMAIL_SHARED_MOTOR_EVIDENCE_INCOMPLETE');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var command = source._command, observation = source._observation;
  var common = {
    schemaVersion: Capability.SCHEMA,
    status: 'VERIFIED',
    environment: 'production',
    productDomain: identity.productDomain,
    ownerDomain: identity.ownerDomain,
    lane: 'subscriber-email',
    motorContractId: identity.motorContractId,
    verifiedAt: at,
    expiresAt: at + TTL_SECONDS * 1000,
    projection: {
      schemaVersion: SCHEMA,
      scope: 'shared-resend-transport-only',
      sourceProductDomain: 'intelligence',
      sourceLane: 'autopilot',
      sourceCommandId: command.commandId,
      domainCognitionShared: false,
      domainAuthorityShared: false
    }
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'sece_' + hash({ domain: identity.productDomain, command: command.commandId, at: at }).slice(0, 24),
    kind: Capability.EXECUTOR,
    contractId: identity.receiptContract,
    adapterId: 'resend-send-api/1',
    verifierId: 'subscriber-email-shared-resend-executor-verifier/1',
    evidenceReceiptId: source.executor.evidenceReceiptId,
    verificationEffectExecuted: true,
    commissioningOnly: true,
    irreversibleEffectDeclared: true,
    liveMoney: false,
    verificationSpendUsd: Number(command.emailCostUsd || 0),
    ownedDestinationVerified: true,
    recipientConsentVerified: true,
    permanentOneShotSlotVerified: true,
    businessStateTransitionSuppressed: true,
    futureSuppressionRecoveryVerified: true,
    authorizationReceiptId: command.authorizationReceiptId,
    suppressionReceiptId: command.suppressionReceiptId
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'seco_' + hash({ domain: identity.productDomain, observation: observation.observationId, at: at }).slice(0, 24),
    kind: Capability.OBSERVER,
    contractId: identity.outcomeContract,
    adapterId: 'resend-read-api/1',
    verifierId: 'subscriber-email-independent-resend-read-verifier/1',
    evidenceReceiptId: source.independentOutcomeObserver.evidenceReceiptId,
    independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  return { executor: executor, observer: observer };
}

function laneIdentity(lane) {
  return {
    productDomain: lane.config.productDomain,
    ownerDomain: lane.config.ownerDomain,
    motorContractId: lane.authorization.motorReceipt.contractId,
    receiptContract: lane.config.schemas.command,
    outcomeContract: lane.config.schemas.observation
  };
}

async function projectLane(store, lane, source, now, persist) {
  var pair = pairFor(laneIdentity(lane), source, now);
  var ex = Capability.validate(pair.executor, Capability.EXECUTOR, lane.authorization.motorReceipt, now);
  var ob = Capability.validate(pair.observer, Capability.OBSERVER, lane.authorization.motorReceipt, now);
  if (!ex.ok || !ob.ok) throw new Error(lane.config.productDomain + ':subscriber-capability-invalid:' + (ex.reason || ob.reason));
  if (persist) {
    await store.set(lane.config.keys.executorCapability, pair.executor, TTL_SECONDS);
    await store.set(lane.config.keys.observerCapability, pair.observer, TTL_SECONDS);
  }
  var verified = persist ? await lane.authorization.verifyCapabilityPair(store, now) :
    Capability.verifyPairReceipts(pair.executor, pair.observer, lane.authorization.motorReceipt, now);
  return {
    productDomain: lane.config.productDomain,
    ownerDomain: lane.config.ownerDomain,
    status: verified.ok ? 'VERIFIED' : 'HELD',
    persisted: persist && verified.ok,
    reason: verified.ok ? null : verified.reason,
    executorCapabilityId: verified.executorCapabilityId || null,
    observerCapabilityId: verified.observerCapabilityId || null
  };
}

async function projectReligion(store, source, now, persist) {
  var motor = await store.get(MotorReceipt.receiptKey('religion'));
  if (!motor || motor.schemaVersion !== MotorReceipt.SCHEMA || motor.productDomain !== 'religion' ||
      motor.ownerDomain !== 'religion' || motor.lane !== 'subscriber-email') {
    return { productDomain: 'religion', ownerDomain: 'religion', status: 'HELD', persisted: false,
      reason: 'religion-subscriber-motor-receipt-missing-or-mismatched' };
  }
  var pair = pairFor({ productDomain: 'religion', ownerDomain: 'religion', motorContractId: motor.contractId,
    receiptContract: motor.contracts.receipt, outcomeContract: motor.contracts.independentOutcome }, source, now);
  var ex = Capability.validate(pair.executor, Capability.EXECUTOR, motor, now);
  var ob = Capability.validate(pair.observer, Capability.OBSERVER, motor, now);
  if (!ex.ok || !ob.ok) throw new Error('religion:subscriber-capability-invalid:' + (ex.reason || ob.reason));
  if (persist) {
    await store.set(Capability.capabilityKey('religion', Capability.EXECUTOR), pair.executor, TTL_SECONDS);
    await store.set(Capability.capabilityKey('religion', Capability.OBSERVER), pair.observer, TTL_SECONDS);
  }
  var verified = persist ? await Capability.verifyPair(store, motor, now) :
    Capability.verifyPairReceipts(pair.executor, pair.observer, motor, now);
  return { productDomain: 'religion', ownerDomain: 'religion', status: verified.ok ? 'VERIFIED' : 'HELD',
    persisted: persist && verified.ok, reason: verified.ok ? null : verified.reason,
    executorCapabilityId: verified.executorCapabilityId || null,
    observerCapabilityId: verified.observerCapabilityId || null };
}

function publicSource(report) {
  return {
    productDomain: 'intelligence', lane: 'autopilot',
    executorVerified: !!(report && report.executor && report.executor.verified),
    observerVerified: !!(report && report.independentOutcomeObserver && report.independentOutcomeObserver.verified),
    providerCalls: Number(report && report.executor && report.executor.providerCalls || 0),
    businessStateTransitionSuppressed: !!(report && report.executor && report.executor.businessStateTransitionSuppressed),
    sendEndpointCalledByThisProjection: false
  };
}

async function run(store, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var persist = deps.persist === true;
  store.assertDurable();
  var verifier = deps.sourceVerifier || IntelligenceProof;
  var source = deps.sourceReport || await verifier.audit(store, at);
  if (!sourceEvidence(source)) return {
    ok: true, schemaVersion: SCHEMA, status: 'HELD', persisted: false,
    reason: 'shared-resend-commissioning-evidence-incomplete', measuredAt: new Date(at).toISOString(),
    source: publicSource(source), domains: [], providerCalls: 0, liveMoney: false
  };
  var rows = [];
  for (var i = 0; i < Lanes.DOMAINS.length; i++) {
    rows.push(await projectLane(store, Lanes.get(Lanes.DOMAINS[i]), source, at, persist));
  }
  rows.push(await projectReligion(store, source, at, persist));
  var verified = rows.filter(function (row) { return row.status === 'VERIFIED'; }).length;
  return {
    ok: true, schemaVersion: SCHEMA, status: verified === rows.length ? 'VERIFIED' : 'PARTIAL',
    persisted: persist && verified > 0, measuredAt: new Date(at).toISOString(),
    source: publicSource(source), domains: rows, verified: verified, total: rows.length,
    providerCalls: 0, liveMoney: false
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  TTL_SECONDS: TTL_SECONDS,
  sourceEvidence: sourceEvidence,
  pairFor: pairFor,
  projectLane: projectLane,
  projectReligion: projectReligion,
  run: run
};
