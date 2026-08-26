'use strict';

/**
 * Communication-local durable executor for the social lane.
 *
 * The owning motor receipt is checked before a strict one-shot command is
 * claimed. The command is read back before Bluesky authentication. A crash or
 * ambiguous failure after dispatch is never retried automatically, preventing
 * duplicate public posts. Provider identity is then persisted and read back as
 * the action receipt.
 */

var crypto = require('node:crypto');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var Social = require('./social-post.js');
var Decision = require('./communication-social-decision.js');

var SCHEMA = 'communication-social-command/1.0';
var LOG_KEY = 'communication_social_command_log';
var PENDING_LOG_KEY = 'communication_social_pending_log';
var KEY_PREFIX = 'communication_social_command:';
var MOTOR_CLAIM_PREFIX = 'communication_social_motor_claim:';
var LOG_CAP = 1000;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function commandKey(commandId) { return KEY_PREFIX + String(commandId); }
function motorClaimKey(receiptId) { return MOTOR_CLAIM_PREFIX + String(receiptId); }

function commandId(spec, authorization) {
  return 'csc_' + hash({
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    productMotorReceiptId: authorization.receiptId,
    decisionReceiptId: spec.decisionReceipt && spec.decisionReceipt.decisionReceiptId,
    subjectDomain: text(spec.subjectDomain), text: text(spec.text)
  }).slice(0, 24);
}

function publicResult(command, duplicate) {
  return {
    ok: command.status === 'POSTED',
    status: command.status,
    reason: command.reason || null,
    duplicate: !!duplicate,
    commandId: command.commandId,
    motorReceiptId: command.productMotorReceiptId,
    published: command.status === 'POSTED',
    uri: command.receipt && command.receipt.uri || null,
    cid: command.receipt && command.receipt.cid || null,
    url: command.receipt && command.receipt.url || null,
    used: command.receipt && command.receipt.used,
    cap: command.receipt && command.receipt.cap,
    liveMoney: false
  };
}

async function append(store, value, key) {
  var target = key || LOG_KEY;
  await store.lpush(target, value);
  await store.ltrim(target, 0, LOG_CAP - 1);
}

async function execute(input) {
  input = input || {};
  var spec = input.spec || {};
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var body = text(spec.text);
  var subjectDomain = text(spec.subjectDomain);
  if (!body || !subjectDomain) return { ok: false, status: 'REFUSED', reason: 'communication-social-content-identity-required', published: false, liveMoney: false };
  if (!Decision.validateReceipt(spec.decisionReceipt, { subjectDomain: subjectDomain, text: body }, now)) {
    return { ok: false, status: 'REFUSED', reason: 'communication-social-b10-decision-required', published: false, liveMoney: false };
  }
  var store = input.store;
  try {
    store.assertDurable();
    var authorize = input.motorAuthorization || MotorAuthorization;
    var authorization = await authorize.authorize(store, 'communication', 'social', now);
    if (!authorization || authorization.authorized !== true) {
      return {
        ok: true, status: 'HELD', reason: authorization && authorization.reason || 'communication-social-motor-held',
        published: false, motorReceiptId: authorization && authorization.receiptId || null,
        motorBlockers: authorization && authorization.blockers || [], liveMoney: false
      };
    }
    if (authorization.productDomain !== 'communication' || authorization.ownerDomain !== 'communication' ||
        authorization.lane !== 'social' || !text(authorization.receiptId)) {
      return { ok: false, status: 'REFUSED', reason: 'communication-social-authorization-identity-mismatch', published: false, liveMoney: false };
    }
    var id = commandId(spec, authorization);
    var key = commandKey(id);
    var claimKey = motorClaimKey(authorization.receiptId);
    var motorClaim = {
      schemaVersion: SCHEMA,
      claimType: 'POST',
      productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
      productMotorReceiptId: authorization.receiptId,
      commandId: id,
      claimedAt: now
    };
    var claimed = await store.setIfAbsent(claimKey, motorClaim);
    var restoredClaim = await store.get(claimKey);
    if (!restoredClaim || restoredClaim.schemaVersion !== SCHEMA ||
        restoredClaim.productMotorReceiptId !== authorization.receiptId || restoredClaim.commandId !== id) {
      return { ok: false, status: 'REFUSED', reason: claimed ? 'communication-social-motor-claim-readback-invalid' : 'communication-social-motor-receipt-already-consumed', published: false, commandId: id, liveMoney: false };
    }
    var command = {
      schemaVersion: SCHEMA,
      commandId: id,
      status: 'DISPATCHING',
      productDomain: 'communication',
      ownerDomain: 'communication',
      lane: 'social',
      subjectDomain: subjectDomain,
      decisionReceiptId: spec.decisionReceipt.decisionReceiptId,
      contentHash: hash(body),
      productMotorReceiptId: authorization.receiptId,
      predictedOutcome: { externalRecord: 'PRESENT', receiptClass: 'platform-post-receipt' },
      commandedAt: now,
      providerCalled: false,
      liveMoney: false,
      receipt: null,
      reason: null
    };
    var inserted = await store.setIfAbsent(key, command);
    var restored = await store.get(key);
    if (!restored || restored.schemaVersion !== SCHEMA || restored.commandId !== id ||
        restored.contentHash !== command.contentHash || restored.productMotorReceiptId !== authorization.receiptId) {
      throw new Error('communication social executor: command readback invalid');
    }
    if (!inserted) {
      if (restored.status === 'POSTED' && restored.receipt) return publicResult(restored, true);
      return { ok: false, status: restored.status, reason: 'communication-social-command-already-claimed-no-retry', published: false, commandId: id, liveMoney: false };
    }
    // This strict index is written before authentication. If Bluesky accepts
    // and final receipt persistence fails, AppView can reconcile without a
    // second post.
    await append(store, command, PENDING_LOG_KEY);

    var platform = input.platform || Social;
    var posted = await platform.postToBluesky(body);
    var resolved;
    if (!posted || posted.ok !== true || !text(posted.uri) || !text(posted.cid) || !text(posted.url)) {
      resolved = Object.assign({}, command, {
        status: 'FAILED', providerCalled: true, resolvedAt: Date.now(),
        reason: posted && posted.reason || 'bluesky-post-unresolved'
      });
    } else {
      resolved = Object.assign({}, command, {
        status: 'POSTED', providerCalled: true, resolvedAt: Date.now(),
        receipt: {
          uri: posted.uri, cid: posted.cid, url: posted.url,
          used: Number.isFinite(Number(posted.used)) ? Number(posted.used) : null,
          cap: Number.isFinite(Number(posted.cap)) ? Number(posted.cap) : null,
          readbackVerified: true
        }
      });
    }
    await store.set(key, resolved);
    restored = await store.get(key);
    if (!restored || restored.commandId !== id || restored.status !== resolved.status ||
        (resolved.status === 'POSTED' && (!restored.receipt || restored.receipt.uri !== posted.uri ||
          restored.receipt.cid !== posted.cid || restored.receipt.readbackVerified !== true))) {
      throw new Error('communication social executor: action receipt readback invalid');
    }
    await append(store, restored);
    return publicResult(restored, false);
  } catch (error) {
    return { ok: false, status: 'FAILED', reason: 'communication-social-executor-failed', detail: String(error && error.message || error), published: false, liveMoney: false };
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  PENDING_LOG_KEY: PENDING_LOG_KEY,
  KEY_PREFIX: KEY_PREFIX,
  MOTOR_CLAIM_PREFIX: MOTOR_CLAIM_PREFIX,
  commandKey: commandKey,
  motorClaimKey: motorClaimKey,
  commandId: commandId,
  execute: execute
};
