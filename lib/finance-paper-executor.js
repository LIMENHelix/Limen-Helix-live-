'use strict';

/**
 * One-shot autonomous Finance paper executor.
 *
 * This is orchestration, not selection. It accepts only a durable packet id,
 * reuses the stored Finance trade-decision receipt, requires both sandbox
 * autonomy switches and the independently verified Finance product-motor gate,
 * claims the packet durably, then converts the broker preview into one sandbox
 * command. Live brokerage is unreachable through the injected Tradier sandbox
 * transport.
 */

var Decision = require('./finance-trade-decision.js');
var Bridge = require('./finance-b14-bridge.js');
var B14 = require('./tradier-b14.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var DevelopmentalAuthorization = require('./finance-paper-developmental-authority.js');
var Learning = require('./autofire-learning.js');

var SCHEMA = 'finance-paper-execution/1.0';
var LOG_KEY = 'finance_paper_execution_log';

function packet(value) {
  var id = String(value || '').trim();
  if (!id || id.length > 180 || !/^[A-Za-z0-9:._-]+$/.test(id)) {
    var error = new Error('Finance packet id is invalid');
    error.code = 'FINANCE_PAPER_EXECUTOR_PACKET_INVALID';
    throw error;
  }
  return id;
}
function claimKey(packetId) { return 'finance_paper_execution_claim:' + packet(packetId); }
function held(reason, detail) {
  return { ok: true, status: 'HELD', reason: reason, detail: detail || null, orderPlaced: false, liveMoney: false };
}
async function log(store, row) {
  await store.lpush(LOG_KEY, row);
  await store.ltrim(LOG_KEY, 0, 499);
}

async function execute(options) {
  options = options || {};
  var store = options.store;
  var broker = options.broker;
  var bridge = options.bridge || Bridge;
  var b14 = options.b14 || B14;
  var motorAuthorization = options.motorAuthorization || MotorAuthorization;
  var developmentalAuthorization = options.developmentalAuthorization || DevelopmentalAuthorization;
  var learning = options.learning || Learning;
  var env = options.env || process.env;
  var now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  if (!store || typeof store.assertDurable !== 'function') return held('strict-store-required');
  store.assertDurable();
  var packetId = packet(options.packetId);

  var decisionAudit = await bridge.auditDecision(store, packetId, env);
  if (!decisionAudit || decisionAudit.status !== 'READY_FOR_B14_PREVIEW') {
    return Object.assign(held(decisionAudit && decisionAudit.reason || 'finance-decision-not-ready', decisionAudit), { packetId: packetId });
  }
  var switches = decisionAudit.switches || (typeof bridge.state === 'function' ? bridge.state(env) : null);
  if (!switches || switches.previewAutonomyEnabled !== true) {
    return Object.assign(held('preview-autonomy-switch-off', switches), { packetId: packetId });
  }
  var decision = await store.get(Decision.key(packetId));
  var execution = bridge.executionReadiness(decision && decision.selection, env);
  if (!execution.ready) {
    return Object.assign(held(execution.reasons[0] || 'finance-order-execution-not-ready', execution), { packetId: packetId });
  }
  var motor = await motorAuthorization.authorize(store, 'finance', 'broker/order', now);
  if (!motor.authorized) {
    var developmental = await developmentalAuthorization.authorize(store, packetId, env, now);
    if (!developmental.authorized) {
      return Object.assign(held(motor.reason || 'finance-product-motor-held', {
        matureAuthorization: motor,
        developmentalAuthorization: developmental
      }), { packetId: packetId });
    }
    motor = developmental;
  }

  var claimedAt = new Date(now).toISOString();
  var claim = {
    schemaVersion: SCHEMA,
    packetId: packetId,
    selectionId: decision.selection.id,
    motorReceiptId: motor.receiptId,
    authorizationMode: motor.authorizationMode || 'mature-production-capability',
    status: 'CLAIMED',
    oneShot: true,
    claimedAt: claimedAt,
    safety: { environment: 'sandbox', previewAutonomyEnabled: true, orderAutonomyEnabled: true, paperOnly: true, liveMoney: false }
  };
  var created = await store.setIfAbsent(claimKey(packetId), claim);
  if (!created) {
    var existing = await store.get(claimKey(packetId));
    return { ok: true, status: existing && existing.status || 'ALREADY_CLAIMED', idempotent: true, packetId: packetId, claim: existing, orderPlaced: !!(existing && existing.orderId), liveMoney: false };
  }
  await log(store, { type: 'CLAIMED', packetId: packetId, selectionId: claim.selectionId, motorReceiptId: claim.motorReceiptId, at: claimedAt });

  try {
    var previewResult = await bridge.previewDecision(store, broker, packetId, env, now);
    if (!previewResult || previewResult.status !== 'PREVIEWED' || !previewResult.preview) {
      var previewError = new Error(previewResult && previewResult.reason || 'Finance paper preview was not created');
      previewError.code = 'FINANCE_PAPER_EXECUTOR_PREVIEW_HELD';
      throw previewError;
    }
    // Encode the owning Finance brain's released decision before any broker
    // dispatch. The later read-only Tradier observer keys its multiscale
    // outcome to this actionId; without this durable cause, B12 must abstain.
    var actionId = decision.tradeIntent && decision.tradeIntent.actionId;
    if (!actionId) {
      var actionError = new Error('Finance paper decision has no causal action identity');
      actionError.code = 'FINANCE_PAPER_ACTION_ID_MISSING';
      throw actionError;
    }
    var learningCommand = await learning.recordCommand(store, {
      selection: decision.selection,
      efferenceCopy: {
        id: 'finance-paper:' + previewResult.preview.previewId,
        actionId: actionId,
        traceId: packetId,
        emittedAt: now
      }
    });
    if (!learningCommand || learningCommand.ok !== true) {
      var learningError = new Error(learningCommand && learningCommand.detail || learningCommand && learningCommand.error || 'Finance command learning was not durable');
      learningError.code = 'FINANCE_PAPER_COMMAND_LEARNING_NOT_DURABLE';
      throw learningError;
    }
    var command = await b14.submitApproved(store, broker, {
      previewId: previewResult.preview.previewId,
      confirmation: previewResult.preview.confirmationSummary
    }, now);
    claim.status = 'COMMAND_RECEIPTED';
    claim.previewId = previewResult.preview.previewId;
    claim.commandId = command.commandId;
    claim.orderId = command.receipt && command.receipt.orderId || null;
    claim.completedAt = new Date().toISOString();
    claim.rollback = command.rollback || null;
    await store.set(claimKey(packetId), claim);
    await log(store, { type: claim.status, packetId: packetId, previewId: claim.previewId, commandId: claim.commandId, orderId: claim.orderId, at: claim.completedAt });
    return { ok: true, status: claim.status, idempotent: false, packetId: packetId, claim: claim, command: command, orderPlaced: true, paperOnly: true, liveMoney: false };
  } catch (error) {
    claim.status = 'EXECUTION_UNRESOLVED';
    claim.failedAt = new Date().toISOString();
    claim.error = { code: error && error.code || 'FINANCE_PAPER_EXECUTOR_FAILED', message: String(error && error.message || error) };
    await store.set(claimKey(packetId), claim);
    await log(store, { type: claim.status, packetId: packetId, at: claim.failedAt, error: claim.error });
    error.packetId = packetId;
    throw error;
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, claimKey: claimKey, execute: execute };
