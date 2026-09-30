'use strict';

/**
 * Read-only capability promotion for the irreversible business lanes.
 *
 * Law automail and the Infrastructure/Population property lanes already have
 * domain-owned executors, provider receipts, independent observers, recovery,
 * and learning.  A normal business action is not commissioning evidence: mail
 * and email cannot be recalled after acceptance.  Promotion therefore requires
 * an explicit, pre-recorded owned-destination commissioning proof on the exact
 * command.  This verifier never calls Lob, Resend, or a recovery provider.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');

var SCHEMA = 'product-domain-business-capability-audit/1.0';
var TTL_SECONDS = 6 * 60 * 60;
var SCAN_CAP = 1000;
var CONFIG = Object.freeze({
  law: Object.freeze({ productDomain: 'law', ownerDomain: 'law', lane: 'automail',
    contractId: 'law-motor/1', decision: 'physical-message-decision/1', budget: 'law-automail-budget/1',
    receipt: 'mail-provider-receipt', independentOutcome: 'delivery-or-response', rollback: 'cancel-before-tender-or-suppress',
    commandLog: 'law_automail_command_log', observationLog: 'law_automail_observation_log', learningKey: 'law_automail_learning_state',
    commandSchema: 'law-automail-command/1.0', observationSchema: 'law-automail-observation/1.0',
    success: 'ACCEPTED', providerId: 'providerLetterId', independentFlag: 'independentOfCreateResponse',
    adapterId: 'lob-physical-mail-create/1', observerAdapterId: 'lob-independent-letter-read/1' }),
  infrastructure: Object.freeze({ productDomain: 'infrastructure', ownerDomain: 'infrastructure', lane: 'real-estate',
    contractId: 'infrastructure-motor/1', decision: 'property-transaction-decision/1', budget: 'infrastructure-real-estate-budget/1',
    receipt: 'counterparty-receipt', independentOutcome: 'accept-decline-or-close', rollback: 'withdraw-or-terminate-under-policy',
    commandLog: 'infrastructure_real_estate_command_log', observationLog: 'infrastructure_real_estate_observation_log', learningKey: 'infrastructure_real_estate_learning_state',
    commandSchema: 'infrastructure-real-estate-command/1.0', observationSchema: 'infrastructure-real-estate-observation/1.0',
    success: 'INQUIRY_ACCEPTED', providerId: 'providerEmailId', independentFlag: 'independentOfSendResponse',
    adapterId: 'resend-property-outreach/1', observerAdapterId: 'resend-signed-inbound-observer/1' }),
  population: Object.freeze({ productDomain: 'population', ownerDomain: 'population', lane: 'real-estate',
    contractId: 'population-motor/1', decision: 'property-transaction-decision/1', budget: 'population-real-estate-budget/1',
    receipt: 'counterparty-receipt', independentOutcome: 'accept-decline-or-close', rollback: 'withdraw-or-terminate-under-policy',
    commandLog: 'population_real_estate_command_log', observationLog: 'population_real_estate_observation_log', learningKey: 'population_real_estate_learning_state',
    commandSchema: 'population-real-estate-command/1.0', observationSchema: 'population-real-estate-observation/1.0',
    success: 'INQUIRY_ACCEPTED', providerId: 'providerEmailId', independentFlag: 'independentOfSendResponse',
    adapterId: 'resend-property-outreach/1', observerAdapterId: 'resend-signed-inbound-observer/1' })
});
var DOMAINS = Object.freeze(Object.keys(CONFIG));

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function config(domain) { if (!CONFIG[domain]) throw new Error('BUSINESS_CAPABILITY_DOMAIN_UNSUPPORTED'); return CONFIG[domain]; }

function validMotor(motor, domain) {
  var c = config(domain), contracts = motor && motor.contracts || {};
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === c.productDomain &&
    motor.ownerDomain === c.ownerDomain && motor.contractId === c.contractId && motor.lane === c.lane &&
    contracts.decision === c.decision && contracts.budget === c.budget && contracts.receipt === c.receipt &&
    contracts.independentOutcome === c.independentOutcome && contracts.rollback === c.rollback);
}

function commissioningProof(command) {
  var proof = command && command.capabilityEvidence;
  return !!(proof && proof.commissioningOnly === true && proof.irreversibleEffectDeclared === true &&
    proof.ownedDestinationVerified === true && proof.recipientConsentVerified === true &&
    proof.permanentOneShotSlotVerified === true && proof.businessStateTransitionSuppressed === true &&
    proof.futureSuppressionRecoveryVerified === true && proof.verificationEffectExecuted === true &&
    proof.liveMoney === false && Number(proof.verificationSpendUsd) >= 0 && Number(proof.verificationSpendUsd) <= 0.01 &&
    text(proof.authorizationReceiptId) && text(proof.suppressionReceiptId));
}

function commandEvidence(command, c) {
  return !!(command && command.schemaVersion === c.commandSchema && command.productDomain === c.productDomain &&
    command.ownerDomain === c.ownerDomain && command.lane === c.lane && command.status === c.success &&
    text(command.commandId) && text(command.actionId) && text(command[c.providerId]) && command.readbackVerified === true &&
    Number(command.providerCalls) > 0);
}

function observerEvidence(observation, command, c) {
  return !!(observation && observation.schemaVersion === c.observationSchema && observation.status &&
    text(observation.observationId) && observation.commandId === command.commandId && observation.actionId === command.actionId &&
    observation[c.independentFlag] === true && observation.sendEndpointCalled !== true && observation.createEndpointCalled !== true);
}

function learningEvidence(learning, observation, c) {
  if (!learning || !Array.isArray(learning.signals) || !observation) return false;
  return learning.signals.some(function (signal) {
    return signal && signal.actionId === observation.actionId && signal.ownerDomain === c.ownerDomain &&
      signal.lane === c.lane && signal.eventType && signal.sourceIdentity;
  });
}

async function rows(store, key) { return store.lrange(key, 0, SCAN_CAP - 1); }

async function audit(store, domain, now) {
  var c = config(domain), at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var motor = await store.get(Motor.receiptKey(domain));
  var report = { schemaVersion: SCHEMA, productDomain: c.productDomain, ownerDomain: c.ownerDomain, lane: c.lane,
    measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor, domain), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null },
    executor: { verified: false, commissioningVerified: false, evidenceReceiptId: null, reason: 'business-executor-evidence-missing' },
    independentOutcomeObserver: { verified: false, evidenceReceiptId: null, reason: 'business-independent-outcome-missing' },
    learning: { returnedOutcomeVerified: false }, mayPersistCapabilities: false };
  if (!report.motorReceipt.identityMatched) return report;
  var commandRows = await rows(store, c.commandLog), observations = await rows(store, c.observationLog), learning = await store.get(c.learningKey);
  var command = commandRows.filter(function (row) { return commandEvidence(row, c); })[0] || null;
  report.commandsExamined = commandRows.length; report.observationsExamined = observations.length;
  if (!command) return report;
  report.executor = { verified: true, commissioningVerified: commissioningProof(command),
    evidenceReceiptId: c.productDomain + '-provider-receipt:' + command[c.providerId], commandId: command.commandId,
    providerId: command[c.providerId], reason: commissioningProof(command) ? null : 'business-effect-observed-but-owned-destination-commissioning-proof-missing' };
  var observation = observations.filter(function (row) { return observerEvidence(row, command, c); })[0] || null;
  if (observation) {
    report.independentOutcomeObserver = { verified: true, evidenceReceiptId: c.productDomain + '-independent-observation:' + observation.observationId,
      observationId: observation.observationId, independentSourceVerified: true, reason: null };
    report.learning.returnedOutcomeVerified = learningEvidence(learning, observation, c);
  }
  report.mayPersistCapabilities = report.executor.commissioningVerified === true &&
    report.independentOutcomeObserver.verified === true && report.learning.returnedOutcomeVerified === true;
  report._motor = motor; report._command = command; report._observation = observation;
  return report;
}

function capabilityReceipts(report, now) {
  if (!report || report.mayPersistCapabilities !== true) throw new Error('BUSINESS_CAPABILITY_EVIDENCE_INCOMPLETE');
  var c = config(report.productDomain), proof = report._command.capabilityEvidence, at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var common = { schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production', productDomain: c.productDomain,
    ownerDomain: c.ownerDomain, lane: c.lane, motorContractId: report._motor.contractId, verifiedAt: at, expiresAt: at + TTL_SECONDS * 1000 };
  return {
    executor: Object.assign({}, common, { capabilityId: 'bce_' + hash({ domain: c.productDomain, evidence: report.executor.evidenceReceiptId, at: at }).slice(0, 24),
      kind: Cap.EXECUTOR, contractId: report._motor.contracts.receipt, adapterId: c.adapterId,
      verifierId: c.productDomain + '-owned-destination-commissioning-verifier/1', evidenceReceiptId: report.executor.evidenceReceiptId,
      verificationEffectExecuted: proof.verificationEffectExecuted, commissioningOnly: true, irreversibleEffectDeclared: true,
      liveMoney: false, verificationSpendUsd: Number(proof.verificationSpendUsd), ownedDestinationVerified: true,
      recipientConsentVerified: true, permanentOneShotSlotVerified: true, businessStateTransitionSuppressed: true,
      futureSuppressionRecoveryVerified: true, authorizationReceiptId: proof.authorizationReceiptId,
      suppressionReceiptId: proof.suppressionReceiptId }),
    observer: Object.assign({}, common, { capabilityId: 'bco_' + hash({ domain: c.productDomain, evidence: report.independentOutcomeObserver.evidenceReceiptId, at: at }).slice(0, 24),
      kind: Cap.OBSERVER, contractId: report._motor.contracts.independentOutcome, adapterId: c.observerAdapterId,
      verifierId: c.productDomain + '-independent-outcome-verifier/1', evidenceReceiptId: report.independentOutcomeObserver.evidenceReceiptId,
      independentSourceVerified: true, independentOfAdapterId: c.adapterId })
  };
}

async function verifyAndPersist(store, domain, now) {
  var report = await audit(store, domain, now);
  if (!report.mayPersistCapabilities) {
    var reason = report.executor && report.executor.reason || report.independentOutcomeObserver && report.independentOutcomeObserver.reason || 'business-capability-evidence-incomplete';
    delete report._motor; delete report._command; delete report._observation;
    return { ok: true, status: 'HELD', persisted: false, reason: reason, audit: report, liveMoney: false };
  }
  var motor = report._motor, receipts = capabilityReceipts(report, now);
  var ex = Cap.validate(receipts.executor, Cap.EXECUTOR, motor, now), ob = Cap.validate(receipts.observer, Cap.OBSERVER, motor, now);
  if (!ex.ok || !ob.ok) throw new Error('BUSINESS_CAPABILITY_RECEIPT_VALIDATION_FAILED:' + (ex.reason || ob.reason));
  await store.set(Cap.capabilityKey(domain, Cap.EXECUTOR), receipts.executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey(domain, Cap.OBSERVER), receipts.observer, TTL_SECONDS);
  var pair = await Cap.verifyPair(store, motor, now);
  if (!pair.ok) throw new Error('BUSINESS_CAPABILITY_READBACK_FAILED:' + pair.reason);
  delete report._motor; delete report._command; delete report._observation;
  return { ok: true, status: 'VERIFIED', persisted: true, capabilities: pair, audit: report, liveMoney: false };
}

module.exports = { SCHEMA: SCHEMA, TTL_SECONDS: TTL_SECONDS, DOMAINS: DOMAINS, CONFIG: CONFIG,
  config: config, validMotor: validMotor, commissioningProof: commissioningProof,
  commandEvidence: commandEvidence, observerEvidence: observerEvidence, audit: audit,
  capabilityReceipts: capabilityReceipts, verifyAndPersist: verifyAndPersist };
