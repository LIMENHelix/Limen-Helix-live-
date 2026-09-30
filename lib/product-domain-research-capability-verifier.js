'use strict';

/**
 * Read-only capability promotion for the four sovereign research motors.
 *
 * This verifier never calls a model, publisher, evaluator, or recovery
 * provider. It can promote a lease only when the durable store already
 * contains the complete chain:
 *
 *   executed artifact -> admitted independent evaluation -> domain-owned
 *   withdrawal -> withdrawal readback -> learner return
 *
 * The chain is deliberately historical and bounded. A command, artifact,
 * publication, or evaluation by itself never becomes executor capability.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Intake = require('./research-evaluation-intake.js');
var EvaluationObserver = require('./research-evaluation-observer.js');
var Learning = require('./autofire-learning.js');

var SCHEMA = 'product-domain-research-capability-audit/1.0';
var TTL_SECONDS = 6 * 60 * 60;
var EFFERENCE_LOG_KEY = 'autofire_efference_log';
var RECOVERY_LOG_KEY = 'research_artifact_recovery_log';
var ENGINE_PREFIX = 'engine_output:';
var RECOVERY_PREFIX = 'research_artifact_recovery:';
var DOMAINS = Object.freeze({
  science: { productDomain: 'science', ownerDomain: 'research', contractId: 'science-motor/1' },
  medicine: { productDomain: 'medicine', ownerDomain: 'health', contractId: 'medicine-motor/1' },
  education: { productDomain: 'education', ownerDomain: 'education', contractId: 'education-motor/1' },
  environment: { productDomain: 'environment', ownerDomain: 'environment', contractId: 'environment-motor/1' }
});

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function config(domain) {
  var value = DOMAINS[domain];
  if (!value) throw new Error('RESEARCH_CAPABILITY_DOMAIN_UNSUPPORTED');
  return value;
}
function validMotor(motor, domain) {
  var c = config(domain);
  return !!(motor && motor.schemaVersion === Motor.SCHEMA &&
    motor.productDomain === c.productDomain && motor.ownerDomain === c.ownerDomain &&
    motor.contractId === c.contractId && motor.lane === 'research-papers' &&
    motor.contracts && motor.contracts.decision === 'research-artifact-decision/1' &&
    motor.contracts.receipt === 'artifact-receipt' &&
    motor.contracts.independentOutcome === 'citation-use-or-falsification' &&
    motor.contracts.rollback === 'withdraw-or-correct');
}
function efferenceId(actionId) {
  return text(actionId) && actionId.indexOf('act_') === 0 ? 'efx_' + actionId.slice(4) : null;
}
function recoveryKey(observationId) { return RECOVERY_PREFIX + String(observationId); }
function engineKey(outputId) { return ENGINE_PREFIX + String(outputId); }

async function executedCommands(store) {
  var rows = await store.lrange(EFFERENCE_LOG_KEY, 0, 499);
  var ids = [], seen = Object.create(null);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {}, id = row.efferenceCopyId;
    if (row.type !== 'REAFFERENCE' || !id || seen[id]) continue;
    seen[id] = true;
    var record = await store.get('autofire_efference:' + id);
    if (record && record.schemaVersion === 1 && record.actionKind === 'generate_research_artifact' &&
        record.lane === 'research' && record.status === 'EXECUTED' && record.receipt &&
        record.receipt.applied === true && text(record.receipt.outputId)) ids.push(record);
  }
  return ids;
}

async function admittedEvaluations(store) {
  var rows = await store.lrange(Intake.LOG_KEY, 0, 499);
  var inspected = await EvaluationObserver.inspect(store, rows);
  return inspected.filter(function (row) {
    return row && row.status === 'ELIGIBLE' && row.event && row.event.eventType === 'OUTCOME_RESEARCH_EVALUATED';
  });
}

async function recoveryRows(store) {
  return store.lrange(RECOVERY_LOG_KEY, 0, 499);
}

function recoveryMatches(row, event, command, artifact) {
  return !!(row && row.status === 'WITHDRAWN' &&
    row.productDomain === artifact.payload.autofire.productDomain &&
    row.ownerDomain === artifact.payload.autofire.ownerDomain && row.lane === 'research-papers' &&
    row.outputId === event.outputId && row.actionId === event.actionId &&
    row.observationId === event.observationId && text(row.recoveryId));
}

async function findEvidence(store, domain, motor) {
  var c = config(domain), commands = await executedCommands(store), evaluations = await admittedEvaluations(store),
    recoveries = await recoveryRows(store), learning = await Learning._load(store, c.ownerDomain);
  for (var i = 0; i < evaluations.length; i++) {
    var evaluation = evaluations[i], event = evaluation.event;
    if (event.ownerDomain !== c.productDomain) continue;
    if (!Array.isArray(learning.processedOutcomeIds) || learning.processedOutcomeIds.indexOf(event.eventId) < 0) continue;
    for (var j = 0; j < commands.length; j++) {
      var command = commands[j];
      if (command.actionId !== event.actionId || command.receipt.outputId !== event.outputId) continue;
      var artifact = await store.get(engineKey(event.outputId)), autofire = artifact && artifact.payload && artifact.payload.autofire;
      if (!artifact || artifact.status !== 'WITHDRAWN' || !autofire ||
          autofire.productDomain !== c.productDomain || autofire.ownerDomain !== c.ownerDomain ||
          autofire.actionId !== event.actionId || autofire.efferenceCopyId !== command.id ||
          autofire.productMotorReceiptId !== motor.receiptId || !text(artifact.contentHash)) continue;
      var recovery = recoveries.filter(function (row) { return recoveryMatches(row, event, command, artifact); })[0];
      if (!recovery) continue;
      var recoveryReceipt = await store.get(recoveryKey(event.observationId));
      if (!recoveryReceipt || recoveryReceipt.status !== 'WITHDRAWN' ||
          recoveryReceipt.recoveryId !== recovery.recoveryId || !recoveryReceipt.receipt ||
          recoveryReceipt.receipt.readbackVerified !== true ||
          recoveryReceipt.receipt.contentHashUnchanged !== true) continue;
      var emittedAt = Number(command.emittedAt), recoveredAt = Number(recoveryReceipt.resolvedAt || recoveryReceipt.commandedAt);
      var exposure = recoveredAt - emittedAt;
      if (!Number.isFinite(emittedAt) || !Number.isFinite(recoveredAt) || exposure < 0 ||
          exposure > Cap.MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS) continue;
      return { command: command, artifact: artifact, event: event, evaluation: evaluation,
        recovery: recoveryReceipt, exposureDurationMs: exposure };
    }
  }
  return null;
}

async function audit(store, domain, now) {
  var c = config(domain), at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var motor = await store.get(Motor.receiptKey(c.productDomain));
  var evidence = validMotor(motor, domain) ? await findEvidence(store, domain, motor) : null;
  return {
    schemaVersion: SCHEMA, productDomain: c.productDomain, ownerDomain: c.ownerDomain,
    lane: 'research-papers', measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor, domain), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null },
    executor: { verified: !!evidence, evidenceReceiptId: evidence ? 'research-artifact-executed:' + evidence.command.id : null,
      commandId: evidence && evidence.command.id || null, outputId: evidence && evidence.artifact.outputId || null },
    independentOutcomeObserver: { verified: !!evidence, evidenceReceiptId: evidence ? 'research-evaluation:' + evidence.event.observationId : null,
      observationId: evidence && evidence.event.observationId || null, eventId: evidence && evidence.event.eventId || null },
    evidence: evidence ? { recoveryId: evidence.recovery.recoveryId, exposureDurationMs: evidence.exposureDurationMs } : null,
    _motor: motor, _evidence: evidence
  };
}

function capabilityReceipts(report, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now(), c = config(report.productDomain), e = report._evidence, motor = report._motor;
  if (!e) return null;
  var common = { schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production',
    productDomain: c.productDomain, ownerDomain: c.ownerDomain, lane: 'research-papers', motorContractId: motor.contractId,
    verifiedAt: at, expiresAt: at + TTL_SECONDS * 1000 };
  var executor = Object.assign({}, common, {
    capabilityId: 'rce_' + hash({ domain: c.productDomain, command: e.command.id, at: at }).slice(0, 24),
    kind: Cap.EXECUTOR, contractId: motor.contracts.receipt,
    adapterId: 'research-artifact-generation/1', verifierId: c.productDomain + '-historical-recovery-verifier/1',
    evidenceReceiptId: 'research-artifact-executed:' + e.command.id,
    verificationEffectExecuted: true, historicalEvidenceOnly: true, commissioningOnly: false,
    liveMoney: false, verificationSpendUsd: 0, rollbackVerified: true, zeroResidualEffectVerified: true,
    rollbackReceiptId: 'research-artifact-recovery:' + e.recovery.recoveryId,
    residualObserverReceiptId: 'research-artifact-withdrawal-read:' + e.event.observationId,
    exposureDurationMs: e.exposureDurationMs
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'rco_' + hash({ domain: c.productDomain, observation: e.event.observationId, at: at }).slice(0, 24),
    kind: Cap.OBSERVER, contractId: motor.contracts.independentOutcome,
    adapterId: 'research-independent-evaluation-read/1', verifierId: c.productDomain + '-independent-evaluation-verifier/1',
    evidenceReceiptId: 'research-evaluation:' + e.event.observationId, independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  return { executor: executor, observer: observer };
}

async function verifyAndPersist(store, domain, now) {
  var report = await audit(store, domain, now), at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!report._motor || !report._evidence) {
    delete report._motor; delete report._evidence;
    return Object.assign({ ok: true, status: 'HELD', reason: 'research-execute-evaluate-withdraw-readback-chain-missing', liveMoney: false }, report);
  }
  var receipts = capabilityReceipts(report, at), ex = Cap.validate(receipts.executor, Cap.EXECUTOR, report._motor, at), ob = Cap.validate(receipts.observer, Cap.OBSERVER, report._motor, at);
  if (!ex.ok || !ob.ok) throw new Error('RESEARCH_CAPABILITY_VALIDATION_FAILED:' + (ex.reason || ob.reason));
  await store.set(Cap.capabilityKey(report.productDomain, Cap.EXECUTOR), receipts.executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey(report.productDomain, Cap.OBSERVER), receipts.observer, TTL_SECONDS);
  var pair = await Cap.verifyPair(store, report._motor, at);
  if (!pair.ok) throw new Error('RESEARCH_CAPABILITY_READBACK_FAILED:' + pair.reason);
  delete report._motor; delete report._evidence;
  return { ok: true, status: 'VERIFIED', capabilities: pair, liveMoney: false, report: report };
}

module.exports = { SCHEMA: SCHEMA, TTL_SECONDS: TTL_SECONDS, DOMAINS: DOMAINS, config: config,
  validMotor: validMotor, audit: audit, capabilityReceipts: capabilityReceipts,
  verifyAndPersist: verifyAndPersist };
