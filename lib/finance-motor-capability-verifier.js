'use strict';

/**
 * Evidence verifier for the Finance product brain's paper broker motor.
 *
 * This module never creates a preview, submits/cancels an order, or invents an
 * outcome. It can only promote evidence that already exists in the durable B14
 * and learning ledgers. Executor and observer proof deliberately come from
 * different receipts and verifier identities.
 */

var crypto = require('node:crypto');
var CAP = require('./product-domain-motor-capability.js');
var MOTOR = require('./product-domain-motor-receipt.js');
var B14 = require('./tradier-b14.js');
var LEARNING = require('./autofire-learning.js');

var SCHEMA = 'finance-motor-capability-audit/1.0';
var PRODUCT_DOMAIN = 'finance';
var OWNER_DOMAIN = 'finance';
var LANE = 'broker/order';
var TTL_SECONDS = 6 * 60 * 60;
var SCAN_CAP = 1000;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function uniqueCommandIds(active, log) {
  var seen = Object.create(null);
  return (Array.isArray(active) ? active : []).concat(Array.isArray(log) ? log : [])
    .map(function (row) { return row && row.commandId ? String(row.commandId) : null; })
    .filter(function (id) {
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    });
}

function executorEvidence(command) {
  if (!command || command.status !== 'RECONCILED_TERMINAL') return false;
  if (!command.intent || command.intent.ownerDomain !== OWNER_DOMAIN) return false;
  if (!command.receipt || !command.receipt.orderId || !command.order || !command.reafference) return false;
  if (String(command.order.id) !== String(command.receipt.orderId) || command.order.status !== 'canceled') return false;
  if (Number(command.order.executedQuantity) !== 0) return false;
  var rollback = command.rollback || {};
  if (rollback.status !== 'CANCEL_RECEIPT_PERSISTED' || !rollback.receipt ||
      String(rollback.receipt.orderId) !== String(command.receipt.orderId)) return false;
  var matched = command.reafference.matchedSelfEffect || {};
  var identity = matched.identity || {};
  return Number(matched.executedQuantity) === 0 &&
    identity.commandId === command.commandId &&
    String(identity.orderId) === String(command.receipt.orderId) &&
    identity.tag === command.tag;
}

function observerEvidence(event, command, learningState) {
  if (!event || !command || !learningState) return false;
  if (event.eventType !== 'OUTCOME_INVESTMENT_PNL' || event.ownerDomain !== OWNER_DOMAIN ||
      event.lane !== 'investment' || event.commandId !== command.commandId) return false;
  if (!event.eventId || !event.observationId || !event.actionId || event.actionId !== command.intent.actionId) return false;
  if (!Array.isArray(learningState.processedOutcomeIds) ||
      learningState.processedOutcomeIds.indexOf(event.eventId) < 0) return false;
  var data = event.outcomeData || {};
  // The durable outcome recorder keeps the normalized identities inside the
  // outcomeData envelope; accept top-level copies only for older fixtures.
  var source = data.sourceIdentity || event.sourceIdentity || {};
  var benchmark = data.benchmarkIdentity || event.benchmarkIdentity || {};
  if (source.provider !== 'tradier' || !source.accountId || !source.snapshotId ||
      benchmark.provider !== 'tradier' || !benchmark.symbol) return false;
  if (data.executionMode !== 'paper' || [30, 60, 90].indexOf(Number(data.horizonDays)) < 0 ||
      String(data.brokerOrderId || '') !== String(command.receipt && command.receipt.orderId || '')) return false;
  return command.status === 'RECONCILED_TERMINAL' && !!command.reafference;
}

async function loadCommands(store) {
  var rows = await Promise.all([
    store.lrange('tradier_b14_active_commands', 0, SCAN_CAP - 1),
    store.lrange('tradier_b14_log', 0, SCAN_CAP - 1)
  ]);
  var ids = uniqueCommandIds(rows[0], rows[1]);
  var commands = [];
  for (var i = 0; i < ids.length; i++) {
    var command = await B14.read(store, ids[i]);
    if (command) commands.push(command);
  }
  return commands;
}

async function audit(store, broker, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var report = {
    schemaVersion: SCHEMA,
    productDomain: PRODUCT_DOMAIN,
    ownerDomain: OWNER_DOMAIN,
    lane: LANE,
    measuredAt: new Date(at).toISOString(),
    readOnly: true,
    liveMoney: false,
    motorReceipt: { present: false, identityMatched: false },
    brokerProbe: { ok: false, environment: 'sandbox', readOnly: true },
    executor: { verified: false, reason: 'zero-effect-sandbox-rollback-proof-missing', evidenceReceiptId: null },
    independentOutcomeObserver: { verified: false, reason: 'learned-independent-30-60-90-day-outcome-missing', evidenceReceiptId: null },
    mayPersistCapabilities: false
  };
  store.assertDurable();

  var motor = await store.get(MOTOR.receiptKey(PRODUCT_DOMAIN));
  report.motorReceipt.present = !!motor;
  report.motorReceipt.receiptId = motor && motor.receiptId || null;
  report.motorReceipt.status = motor && motor.status || null;
  report.motorReceipt.identityMatched = !!(motor && motor.schemaVersion === MOTOR.SCHEMA &&
    motor.productDomain === PRODUCT_DOMAIN && motor.ownerDomain === OWNER_DOMAIN && motor.lane === LANE &&
    motor.contractId === 'finance-motor/1');
  if (!report.motorReceipt.identityMatched) return report;

  try {
    var probe = await broker.probe();
    report.brokerProbe.ok = !!(probe && probe.ok && probe.broker === 'tradier' &&
      probe.environment === 'sandbox' && probe.readOnly === true && probe.profileMatched === true);
    report.brokerProbe.profileMatched = probe && probe.profileMatched === true;
    report.brokerProbe.checkedAt = probe && probe.checkedAt || null;
  } catch (error) {
    report.brokerProbe.errorCode = error && error.code || 'TRADIER_SANDBOX_PROBE_FAILED';
    return report;
  }
  if (!report.brokerProbe.ok) return report;

  var commands = await loadCommands(store);
  report.commandsExamined = commands.length;
  var executor = commands.filter(executorEvidence).sort(function (a, b) {
    return Date.parse(b.updatedAt || b.emittedAt || 0) - Date.parse(a.updatedAt || a.emittedAt || 0);
  })[0] || null;
  if (executor) {
    report.executor = {
      verified: true,
      reason: null,
      commandId: executor.commandId,
      evidenceReceiptId: 'tradier-zero-fill-cancel:' + executor.commandId,
      rollbackStatus: executor.rollback.status,
      terminalOrderStatus: executor.order.status,
      executedQuantity: Number(executor.order.executedQuantity),
      verificationEffectExecuted: false,
      verificationSpendUsd: 0
    };
  }

  var learningState = await store.get(LEARNING.stateKey(OWNER_DOMAIN));
  var outcomes = await store.lrange(LEARNING.OUTCOME_LOG_KEY, 0, SCAN_CAP - 1);
  report.outcomesExamined = outcomes.length;
  var observer = null;
  var observerCommand = null;
  for (var e = 0; e < outcomes.length && !observer; e++) {
    for (var c = 0; c < commands.length; c++) {
      if (observerEvidence(outcomes[e], commands[c], learningState)) {
        observer = outcomes[e];
        observerCommand = commands[c];
        break;
      }
    }
  }
  if (observer) {
    report.independentOutcomeObserver = {
      verified: true,
      reason: null,
      commandId: observerCommand.commandId,
      eventId: observer.eventId,
      observationId: observer.observationId,
      horizonDays: Number(observer.outcomeData.horizonDays),
      evidenceReceiptId: 'tradier-learned-outcome:' + observer.eventId,
      independentSourceVerified: true
    };
  }

  report.mayPersistCapabilities = report.executor.verified === true &&
    report.independentOutcomeObserver.verified === true &&
    report.executor.evidenceReceiptId !== report.independentOutcomeObserver.evidenceReceiptId;
  return report;
}

function capabilityReceipts(report, motor, now) {
  if (!report || report.mayPersistCapabilities !== true) throw new Error('FINANCE_CAPABILITY_EVIDENCE_INCOMPLETE');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var expiresAt = at + TTL_SECONDS * 1000;
  var common = {
    schemaVersion: CAP.SCHEMA,
    status: 'VERIFIED',
    environment: 'production',
    productDomain: PRODUCT_DOMAIN,
    ownerDomain: OWNER_DOMAIN,
    lane: LANE,
    motorContractId: motor.contractId,
    verifiedAt: at,
    expiresAt: expiresAt
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'fmce_' + hash({ kind: CAP.EXECUTOR, evidence: report.executor.evidenceReceiptId, at: at }).slice(0, 24),
    kind: CAP.EXECUTOR,
    contractId: motor.contracts.receipt,
    adapterId: 'tradier-paper-adapter/1',
    verifierId: 'finance-executor-evidence-verifier/1',
    evidenceReceiptId: report.executor.evidenceReceiptId,
    rollbackVerified: true,
    verificationMode: 'tradier-sandbox-zero-fill-cancel',
    verificationEffectExecuted: false,
    verificationSpendUsd: 0
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'fmco_' + hash({ kind: CAP.OBSERVER, evidence: report.independentOutcomeObserver.evidenceReceiptId, at: at }).slice(0, 24),
    kind: CAP.OBSERVER,
    contractId: motor.contracts.independentOutcome,
    adapterId: 'tradier-investment-outcome-observer/1',
    verifierId: 'finance-independent-outcome-verifier/1',
    evidenceReceiptId: report.independentOutcomeObserver.evidenceReceiptId,
    independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  return { executor: executor, observer: observer };
}

async function verifyAndPersist(store, broker, now) {
  var report = await audit(store, broker, now);
  if (!report.mayPersistCapabilities) return { ok: true, status: 'HELD', persisted: false, audit: report };
  var motor = await store.get(MOTOR.receiptKey(PRODUCT_DOMAIN));
  var receipts = capabilityReceipts(report, motor, now);
  if (!CAP.validate(receipts.executor, CAP.EXECUTOR, motor, now).ok ||
      !CAP.validate(receipts.observer, CAP.OBSERVER, motor, now).ok) {
    throw new Error('FINANCE_CAPABILITY_RECEIPT_VALIDATION_FAILED');
  }
  await store.set(CAP.capabilityKey(PRODUCT_DOMAIN, CAP.EXECUTOR), receipts.executor, TTL_SECONDS);
  await store.set(CAP.capabilityKey(PRODUCT_DOMAIN, CAP.OBSERVER), receipts.observer, TTL_SECONDS);
  var pair = await CAP.verifyPair(store, motor, now);
  if (!pair.ok) throw new Error('FINANCE_CAPABILITY_READBACK_FAILED:' + pair.reason);
  return { ok: true, status: 'VERIFIED', persisted: true, audit: report, capabilities: pair };
}

module.exports = {
  SCHEMA: SCHEMA,
  TTL_SECONDS: TTL_SECONDS,
  uniqueCommandIds: uniqueCommandIds,
  executorEvidence: executorEvidence,
  observerEvidence: observerEvidence,
  audit: audit,
  capabilityReceipts: capabilityReceipts,
  verifyAndPersist: verifyAndPersist
};
