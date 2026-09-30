'use strict';

/**
 * Read-only capability promotion for the domain-owned paper-investment motors.
 *
 * Economy, Energy and Technology use separate brains, decisions, command
 * namespaces and learning state, but the bounded paper broker adapter is the
 * same Tradier B14 transport. This verifier promotes only evidence already
 * present in that domain's durable command and outcome ledgers. It never
 * creates a preview, submits an order, cancels an order, or invents an outcome.
 */

var crypto = require('node:crypto');
var CAP = require('./product-domain-motor-capability.js');
var MOTOR = require('./product-domain-motor-receipt.js');
var B14 = require('./tradier-b14.js');
var LEARNING = require('./autofire-learning.js');

var SCHEMA = 'product-domain-tradier-capability-audit/1.0';
var TTL_SECONDS = 6 * 60 * 60;
var SCAN_CAP = 1000;
var DOMAINS = Object.freeze(['economy', 'energy', 'technology']);

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function config(domain) {
  if (DOMAINS.indexOf(domain) < 0) throw new Error('TRADIER_CAPABILITY_DOMAIN_UNSUPPORTED');
  return { productDomain: domain, ownerDomain: domain, lane: 'investments', contractId: domain + '-motor/1' };
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

function validMotor(motor, domain) {
  var c = config(domain);
  return !!(motor && motor.schemaVersion === MOTOR.SCHEMA && motor.productDomain === c.productDomain &&
    motor.ownerDomain === c.ownerDomain && motor.contractId === c.contractId && motor.lane === c.lane &&
    motor.contracts && motor.contracts.receipt && motor.contracts.independentOutcome);
}

function executorEvidence(command, ownerDomain) {
  if (!command || command.status !== 'RECONCILED_TERMINAL' || !command.intent ||
      command.intent.ownerDomain !== ownerDomain || !command.receipt || !command.receipt.orderId ||
      !command.order || String(command.order.status || '').toLowerCase() !== 'canceled' ||
      Number(command.order.executedQuantity) !== 0) return false;
  var rollback = command.rollback || {};
  if (rollback.status !== 'CANCEL_RECEIPT_PERSISTED' || !rollback.receipt ||
      String(rollback.receipt.orderId) !== String(command.receipt.orderId)) return false;
  var matched = command.reafference && command.reafference.matchedSelfEffect || {};
  var identity = matched.identity || {};
  return Number(matched.executedQuantity) === 0 && identity.commandId === command.commandId &&
    String(identity.orderId) === String(command.receipt.orderId) && identity.tag === command.tag;
}

function observerEvidence(event, command, learningState, ownerDomain) {
  if (!event || !command || !learningState || event.eventType !== 'OUTCOME_INVESTMENT_PNL' ||
      event.ownerDomain !== ownerDomain || event.lane !== 'investment' ||
      event.commandId !== command.commandId || !event.eventId || !event.observationId ||
      !event.actionId || !command.intent || event.actionId !== command.intent.actionId ||
      !Array.isArray(learningState.processedOutcomeIds) ||
      learningState.processedOutcomeIds.indexOf(event.eventId) < 0) return false;
  var data = event.outcomeData || {};
  var source = data.sourceIdentity || event.sourceIdentity || {};
  var benchmark = data.benchmarkIdentity || event.benchmarkIdentity || {};
  return source.provider === 'tradier' && source.accountId && source.snapshotId &&
    benchmark.provider === 'tradier' && benchmark.symbol && data.executionMode === 'paper' &&
    [1, 3, 7, 14, 30, 60, 90].indexOf(Number(data.horizonDays)) >= 0 &&
    String(data.brokerOrderId || '') === String(command.receipt && command.receipt.orderId || '');
}

async function loadCommands(store) {
  var rows = await Promise.all([
    store.lrange('tradier_b14_active_commands', 0, SCAN_CAP - 1),
    store.lrange('tradier_b14_log', 0, SCAN_CAP - 1)
  ]);
  var ids = uniqueCommandIds(rows[0], rows[1]), commands = [];
  for (var i = 0; i < ids.length; i++) {
    var command = await B14.read(store, ids[i]);
    if (command) commands.push(command);
  }
  return commands;
}

async function audit(store, broker, domain, now) {
  var c = config(domain), at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var report = {
    schemaVersion: SCHEMA, productDomain: c.productDomain, ownerDomain: c.ownerDomain, lane: c.lane,
    measuredAt: new Date(at).toISOString(), readOnly: true, paperOnly: true, liveMoney: false,
    motorReceipt: { present: false, identityMatched: false },
    brokerProbe: { ok: false, environment: 'sandbox', readOnly: true },
    executor: { verified: false, reason: 'zero-effect-sandbox-rollback-proof-missing', evidenceReceiptId: null },
    independentOutcomeObserver: { verified: false, reason: 'learned-independent-outcome-missing', evidenceReceiptId: null },
    mayPersistCapabilities: false
  };
  store.assertDurable();
  var motor = await store.get(MOTOR.receiptKey(domain));
  report.motorReceipt.present = !!motor;
  report.motorReceipt.receiptId = motor && motor.receiptId || null;
  report.motorReceipt.status = motor && motor.status || null;
  report.motorReceipt.identityMatched = validMotor(motor, domain);
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
  var executor = commands.filter(function (row) { return executorEvidence(row, domain); })
    .sort(function (a, b) { return Date.parse(b.updatedAt || b.emittedAt || 0) - Date.parse(a.updatedAt || a.emittedAt || 0); })[0] || null;
  if (executor) {
    report.executor = {
      verified: true, reason: null, commandId: executor.commandId,
      evidenceReceiptId: 'tradier-zero-fill-cancel:' + domain + ':' + executor.commandId,
      rollbackStatus: executor.rollback.status, terminalOrderStatus: executor.order.status,
      executedQuantity: Number(executor.order.executedQuantity), verificationEffectExecuted: false,
      verificationSpendUsd: 0
    };
  }
  var learningState = await LEARNING._load(store, domain);
  var outcomes = await store.lrange(LEARNING.OUTCOME_LOG_KEY, 0, SCAN_CAP - 1);
  report.outcomesExamined = outcomes.length;
  var observer = null, observerCommand = null;
  for (var e = 0; e < outcomes.length && !observer; e++) {
    for (var cIndex = 0; cIndex < commands.length; cIndex++) {
      if (observerEvidence(outcomes[e], commands[cIndex], learningState, domain)) {
        observer = outcomes[e]; observerCommand = commands[cIndex]; break;
      }
    }
  }
  if (observer) {
    report.independentOutcomeObserver = {
      verified: true, reason: null, commandId: observerCommand.commandId, eventId: observer.eventId,
      observationId: observer.observationId, horizonDays: Number(observer.outcomeData && observer.outcomeData.horizonDays),
      evidenceReceiptId: 'tradier-learned-outcome:' + domain + ':' + observer.eventId,
      independentSourceVerified: true
    };
  }
  report.mayPersistCapabilities = report.executor.verified === true &&
    report.independentOutcomeObserver.verified === true &&
    report.executor.evidenceReceiptId !== report.independentOutcomeObserver.evidenceReceiptId;
  return report;
}

function capabilityReceipts(report, motor, now) {
  if (!report || report.mayPersistCapabilities !== true) throw new Error('TRADIER_CAPABILITY_EVIDENCE_INCOMPLETE');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var common = {
    schemaVersion: CAP.SCHEMA, status: 'VERIFIED', environment: 'production',
    productDomain: report.productDomain, ownerDomain: report.ownerDomain, lane: report.lane,
    motorContractId: motor.contractId, verifiedAt: at, expiresAt: at + TTL_SECONDS * 1000
  };
  return {
    executor: Object.assign({}, common, {
      capabilityId: 'tdce_' + hash({ domain: report.productDomain, evidence: report.executor.evidenceReceiptId, at: at }).slice(0, 24),
      kind: CAP.EXECUTOR, contractId: motor.contracts.receipt,
      adapterId: 'tradier-paper-adapter/1', verifierId: report.productDomain + '-investment-executor-evidence-verifier/1',
      evidenceReceiptId: report.executor.evidenceReceiptId, rollbackVerified: true,
      verificationMode: 'tradier-sandbox-zero-fill-cancel', verificationEffectExecuted: false,
      verificationSpendUsd: 0
    }),
    observer: Object.assign({}, common, {
      capabilityId: 'tdco_' + hash({ domain: report.productDomain, evidence: report.independentOutcomeObserver.evidenceReceiptId, at: at }).slice(0, 24),
      kind: CAP.OBSERVER, contractId: motor.contracts.independentOutcome,
      adapterId: 'tradier-investment-outcome-observer/1', verifierId: report.productDomain + '-independent-outcome-verifier/1',
      evidenceReceiptId: report.independentOutcomeObserver.evidenceReceiptId,
      independentSourceVerified: true, independentOfAdapterId: 'tradier-paper-adapter/1'
    })
  };
}

async function verifyAndPersist(store, broker, domain, now) {
  var report = await audit(store, broker, domain, now);
  if (!report.mayPersistCapabilities) return { ok: true, status: 'HELD', persisted: false, audit: report, paperOnly: true, liveMoney: false };
  var motor = await store.get(MOTOR.receiptKey(domain));
  var receipts = capabilityReceipts(report, motor, now);
  var ex = CAP.validate(receipts.executor, CAP.EXECUTOR, motor, now);
  var ob = CAP.validate(receipts.observer, CAP.OBSERVER, motor, now);
  if (!ex.ok || !ob.ok) throw new Error('TRADIER_CAPABILITY_RECEIPT_VALIDATION_FAILED:' + (ex.reason || ob.reason));
  await store.set(CAP.capabilityKey(domain, CAP.EXECUTOR), receipts.executor, TTL_SECONDS);
  await store.set(CAP.capabilityKey(domain, CAP.OBSERVER), receipts.observer, TTL_SECONDS);
  var pair = await CAP.verifyPair(store, motor, now);
  if (!pair.ok) throw new Error('TRADIER_CAPABILITY_READBACK_FAILED:' + pair.reason);
  return { ok: true, status: 'VERIFIED', persisted: true, audit: report, capabilities: pair, paperOnly: true, liveMoney: false };
}

module.exports = {
  SCHEMA: SCHEMA, TTL_SECONDS: TTL_SECONDS, DOMAINS: DOMAINS, config: config,
  validMotor: validMotor, uniqueCommandIds: uniqueCommandIds,
  executorEvidence: executorEvidence, observerEvidence: observerEvidence,
  audit: audit, capabilityReceipts: capabilityReceipts, verifyAndPersist: verifyAndPersist
};
