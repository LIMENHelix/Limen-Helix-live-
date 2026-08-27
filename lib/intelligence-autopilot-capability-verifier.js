'use strict';

/** Promote only already-observed Intelligence commissioning evidence. */
var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Developmental = require('./intelligence-autopilot-developmental-authority.js');
var Executor = require('./intelligence-autopilot-executor.js');
var Observer = require('./intelligence-autopilot-outcome-observer.js');

var SCHEMA = 'intelligence-autopilot-capability-audit/1.0';
var TTL_SECONDS = 6 * 60 * 60;
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }

function validMotor(motor) {
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === 'intelligence' &&
    motor.ownerDomain === 'intelligence' && motor.contractId === 'intelligence-motor/1' &&
    motor.lane === 'autopilot');
}
function executorEvidence(command, slot, suppression) {
  return !!(command && command.schemaVersion === Executor.SCHEMA && command.status === 'ACCEPTED' &&
    command.authorizationMode === 'developmental-autopilot-commissioning' && command.commissioningOnly === true &&
    command.ownedDestinationVerified === true && command.recipientConsentVerified === true &&
    command.businessStateTransitionSuppressed === true && command.futureSuppressionRecoveryVerified === true &&
    command.providerCalls === 1 && command.providerEmailId && command.liveMoney === false &&
    slot && slot.schemaVersion === Developmental.SCHEMA && slot.actionId === command.actionId &&
    slot.receiptId === command.authorizationReceiptId && slot.emailHash === command.emailHash &&
    suppression && suppression.suppressed === true && suppression.actionId === command.actionId &&
    suppression.authorizationReceiptId === command.authorizationReceiptId);
}
function observerEvidence(observation, command) {
  return !!(observation && command && observation.schemaVersion === Observer.SCHEMA &&
    observation.commandId === command.commandId && observation.actionId === command.actionId &&
    observation.providerEmailId === command.providerEmailId && observation.emailHash === command.emailHash &&
    observation.independentOfSendResponse === true && observation.sendEndpointCalled === false &&
    (observation.status === 'TERMINAL_OBSERVED' || observation.status === 'PENDING_OBSERVED'));
}

async function audit(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var rows = await Promise.all([
    store.get(Motor.receiptKey('intelligence')),
    store.get(Developmental.SLOT_KEY),
    store.get(Executor.SUPPRESSION_KEY),
    store.lrange(Executor.LOG_KEY, 0, 99),
    store.lrange(Observer.LOG_KEY, 0, 199)
  ]);
  var motor = rows[0], slot = rows[1], catalog = rows[2] || {}, commands = rows[3] || [], observations = rows[4] || [];
  var command = commands.find(function (row) { return executorEvidence(row, slot, catalog[row && row.emailHash]); }) || null;
  var observation = command && observations.find(function (row) { return observerEvidence(row, command); }) || null;
  return {
    schemaVersion: SCHEMA,
    productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot',
    measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null },
    executor: { verified: !!command, evidenceReceiptId: command ? 'resend-owned-commissioning:' + command.commandId : null,
      commandId: command && command.commandId || null, providerCalls: command && command.providerCalls || 0,
      businessStateTransitionSuppressed: !!(command && command.businessStateTransitionSuppressed) },
    independentOutcomeObserver: { verified: !!observation, evidenceReceiptId: observation ? 'resend-independent-read:' + observation.observationId : null,
      observationId: observation && observation.observationId || null, lastEvent: observation && observation.lastEvent || null,
      sendEndpointCalled: false },
    mayPersistCapabilities: validMotor(motor) && !!command && !!observation,
    _motor: motor, _command: command, _observation: observation
  };
}

function receipts(report, now) {
  if (!report || !report.mayPersistCapabilities) throw new Error('INTELLIGENCE_AUTOPILOT_CAPABILITY_EVIDENCE_INCOMPLETE');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now(), expiresAt = at + TTL_SECONDS * 1000;
  var motor = report._motor, command = report._command, observation = report._observation;
  var common = { schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production', productDomain: 'intelligence',
    ownerDomain: 'intelligence', lane: 'autopilot', motorContractId: motor.contractId, verifiedAt: at, expiresAt: expiresAt };
  var executor = Object.assign({}, common, {
    capabilityId: 'iace_' + hash({ command: command.commandId, at: at }).slice(0, 24), kind: Cap.EXECUTOR,
    contractId: motor.contracts.receipt, adapterId: 'resend-send-api/1', verifierId: 'intelligence-autopilot-executor-evidence-verifier/1',
    evidenceReceiptId: report.executor.evidenceReceiptId, verificationEffectExecuted: true, commissioningOnly: true,
    irreversibleEffectDeclared: true, liveMoney: false, verificationSpendUsd: Number(command.emailCostUsd), ownedDestinationVerified: true,
    recipientConsentVerified: true, permanentOneShotSlotVerified: true, businessStateTransitionSuppressed: true,
    futureSuppressionRecoveryVerified: true, authorizationReceiptId: command.authorizationReceiptId,
    suppressionReceiptId: command.suppressionReceiptId
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'iaco_' + hash({ observation: observation.observationId, at: at }).slice(0, 24), kind: Cap.OBSERVER,
    contractId: motor.contracts.independentOutcome, adapterId: 'resend-read-api/1', verifierId: 'intelligence-autopilot-independent-read-verifier/1',
    evidenceReceiptId: report.independentOutcomeObserver.evidenceReceiptId, independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  return { executor: executor, observer: observer };
}

function publicReport(report) {
  var out = Object.assign({}, report); delete out._motor; delete out._command; delete out._observation; return out;
}
async function verifyAndPersist(store, now) {
  var report = await audit(store, now);
  if (!report.mayPersistCapabilities) return { ok: true, status: 'HELD', persisted: false, audit: publicReport(report) };
  var pair = receipts(report, now);
  if (!Cap.validate(pair.executor, Cap.EXECUTOR, report._motor, now).ok ||
      !Cap.validate(pair.observer, Cap.OBSERVER, report._motor, now).ok) throw new Error('INTELLIGENCE_AUTOPILOT_CAPABILITY_VALIDATION_FAILED');
  await store.set(Cap.capabilityKey('intelligence', Cap.EXECUTOR), pair.executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey('intelligence', Cap.OBSERVER), pair.observer, TTL_SECONDS);
  var restored = await Cap.verifyPair(store, report._motor, now);
  if (!restored.ok) throw new Error('INTELLIGENCE_AUTOPILOT_CAPABILITY_READBACK_FAILED:' + restored.reason);
  return { ok: true, status: 'VERIFIED', persisted: true, audit: publicReport(report), capabilities: restored };
}

module.exports = { SCHEMA: SCHEMA, TTL_SECONDS: TTL_SECONDS, validMotor: validMotor, executorEvidence: executorEvidence,
  observerEvidence: observerEvidence, audit: audit, receipts: receipts, verifyAndPersist: verifyAndPersist };
