'use strict';

/**
 * Communication-local rollback for a receipted Bluesky post.
 *
 * A request is not authority. A fresh Communication/social motor receipt must
 * release the deletion. The original strict command and an independent public
 * presence observation must agree on URI/CID before a one-shot delete command
 * is claimed. Public absence is then read through AppView and persisted.
 */

var crypto = require('node:crypto');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var Executor = require('./communication-social-executor.js');
var Observer = require('./communication-social-outcome-observer.js');
var Social = require('./social-post.js');

var SCHEMA = 'communication-social-recovery/1.0';
var LOG_KEY = 'communication_social_recovery_log';
var KEY_PREFIX = 'communication_social_recovery:';
var LOG_CAP = 1000;
var REASONS = {
  'commissioning-complete': true,
  'policy-invalidation': true,
  'content-correction': true,
  'operator-retraction': true
};

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function recoveryKey(commandId) { return KEY_PREFIX + String(commandId); }
function result(status, reason, extra) {
  return Object.assign({ ok: status !== 'FAILED' && status !== 'REFUSED', status: status, deleted: status === 'DELETED', reason: reason || null, liveMoney: false }, extra || {});
}

async function append(store, value) {
  await store.lpush(LOG_KEY, value);
  await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
}

async function publicAbsent(uri, deps) {
  deps = deps || {};
  if (typeof deps.publicAbsent === 'function') return deps.publicAbsent(uri);
  var read = await Observer.appviewRead(uri, deps.fetch || global.fetch);
  return read.found === false;
}

async function finalizeAbsence(store, key, command, at, deps) {
  var absent = await publicAbsent(command.postReceipt.uri, deps);
  if (!absent) {
    return result('DELETE_ACCEPTED_AWAITING_ABSENCE', 'public-absence-not-yet-observed', {
      recoveryId: command.recoveryId, commandId: command.originalCommandId,
      uri: command.postReceipt.uri, publicAbsenceVerified: false
    });
  }
  var resolved = Object.assign({}, command, {
    status: 'DELETED', resolvedAt: at,
    receipt: {
      providerDeleteAccepted: true,
      uri: command.postReceipt.uri,
      cid: command.postReceipt.cid,
      publicAbsenceVerified: true,
      observer: 'bluesky-public-appview',
      readbackVerified: true
    }
  });
  await store.set(key, resolved);
  var restored = await store.get(key);
  if (!restored || restored.schemaVersion !== SCHEMA || restored.status !== 'DELETED' ||
      !restored.receipt || restored.receipt.publicAbsenceVerified !== true ||
      restored.postReceipt.uri !== command.postReceipt.uri || restored.postReceipt.cid !== command.postReceipt.cid) {
    throw new Error('communication social recovery: receipt readback invalid');
  }
  await append(store, restored);
  return result('DELETED', null, {
    recoveryId: restored.recoveryId, commandId: restored.originalCommandId,
    uri: restored.postReceipt.uri, cid: restored.postReceipt.cid,
    publicAbsenceVerified: true, readbackVerified: true
  });
}

async function recover(input) {
  input = input || {};
  var store = input.store;
  var at = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var commandId = text(input.commandId);
  var reason = text(input.reason);
  var trigger = input.trigger || {};
  if (!commandId || !REASONS[reason] || !text(trigger.type) || !text(trigger.id)) {
    return result('REFUSED', 'communication-social-recovery-identity-and-trigger-required');
  }
  try {
    store.assertDurable();
    var key = recoveryKey(commandId);
    var known = await store.get(key);
    if (known) {
      if (known.schemaVersion !== SCHEMA || known.originalCommandId !== commandId) {
        return result('REFUSED', 'communication-social-recovery-command-conflict', { commandId: commandId });
      }
      if (known.status === 'DELETED' && known.receipt && known.receipt.publicAbsenceVerified === true) {
        return result('DELETED', null, { duplicate: true, recoveryId: known.recoveryId, commandId: commandId,
          uri: known.postReceipt.uri, cid: known.postReceipt.cid, publicAbsenceVerified: true, readbackVerified: true });
      }
      if (known.status === 'DELETE_ACCEPTED_AWAITING_ABSENCE') {
        return finalizeAbsence(store, key, known, at, input);
      }
      return result('REFUSED', 'communication-social-recovery-already-claimed-no-retry', { commandId: commandId, recoveryId: known.recoveryId });
    }

    var original = await store.get(Executor.commandKey(commandId));
    if (!original || original.schemaVersion !== Executor.SCHEMA || original.status !== 'POSTED' ||
        original.productDomain !== 'communication' || original.ownerDomain !== 'communication' || original.lane !== 'social' ||
        !original.receipt || !text(original.receipt.uri) || !text(original.receipt.cid)) {
      return result('REFUSED', 'communication-social-original-command-invalid', { commandId: commandId });
    }
    var observation = await store.get(Observer.observationKey(original.receipt.uri));
    if (!observation || observation.schemaVersion !== Observer.SCHEMA || observation.status !== 'OBSERVED' ||
        !observation.postReceipt || observation.postReceipt.uri !== original.receipt.uri ||
        observation.postReceipt.cid !== original.receipt.cid) {
      return result('HELD', 'independent-public-presence-observation-required', { commandId: commandId });
    }

    var authorize = input.motorAuthorization || MotorAuthorization;
    var authorization = await authorize.authorize(store, 'communication', 'social', at);
    if (!authorization || authorization.authorized !== true) {
      return result('HELD', authorization && authorization.reason || 'communication-social-recovery-motor-held', {
        commandId: commandId, motorReceiptId: authorization && authorization.receiptId || null
      });
    }
    if (authorization.productDomain !== 'communication' || authorization.ownerDomain !== 'communication' ||
        authorization.lane !== 'social' || !text(authorization.receiptId)) {
      return result('REFUSED', 'communication-social-recovery-authorization-identity-mismatch', { commandId: commandId });
    }

    var recoveryId = 'csr_' + hash({ commandId: commandId, uri: original.receipt.uri, cid: original.receipt.cid,
      reason: reason, triggerType: trigger.type, triggerId: trigger.id }).slice(0, 24);
    var motorClaimKey = Executor.motorClaimKey(authorization.receiptId);
    var motorClaim = {
      schemaVersion: SCHEMA,
      claimType: 'DELETE',
      productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
      productMotorReceiptId: authorization.receiptId,
      recoveryId: recoveryId,
      originalCommandId: commandId,
      claimedAt: at
    };
    var motorClaimed = await store.setIfAbsent(motorClaimKey, motorClaim);
    var restoredMotorClaim = await store.get(motorClaimKey);
    if (!motorClaimed || !restoredMotorClaim || restoredMotorClaim.schemaVersion !== SCHEMA ||
        restoredMotorClaim.productMotorReceiptId !== authorization.receiptId || restoredMotorClaim.recoveryId !== recoveryId) {
      return result('REFUSED', 'communication-social-motor-receipt-already-consumed', { commandId: commandId, recoveryId: recoveryId });
    }
    var command = {
      schemaVersion: SCHEMA,
      recoveryId: recoveryId,
      status: 'DELETING',
      productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
      originalCommandId: commandId,
      originalProductMotorReceiptId: original.productMotorReceiptId,
      productMotorReceiptId: authorization.receiptId,
      postReceipt: { uri: original.receipt.uri, cid: original.receipt.cid },
      presenceObservationId: observation.observationId,
      reason: reason,
      trigger: { type: trigger.type, id: trigger.id },
      predictedOutcome: { externalRecord: 'ABSENT', residualExposure: false },
      commandedAt: at,
      providerCalled: false,
      liveMoney: false,
      receipt: null
    };
    var inserted = await store.setIfAbsent(key, command);
    var restored = await store.get(key);
    if (!inserted || !restored || restored.schemaVersion !== SCHEMA || restored.recoveryId !== recoveryId ||
        restored.postReceipt.uri !== original.receipt.uri || restored.postReceipt.cid !== original.receipt.cid) {
      throw new Error('communication social recovery: command claim readback invalid');
    }

    var platform = input.platform || Social;
    var deletion = await platform.deleteBlueskyPost(original.receipt.uri);
    if (!deletion || deletion.ok !== true) {
      var failed = Object.assign({}, command, { status: 'FAILED', providerCalled: true, resolvedAt: at,
        reason: deletion && deletion.reason || 'bluesky-delete-unresolved' });
      await store.set(key, failed);
      await append(store, failed);
      return result('FAILED', failed.reason, { recoveryId: recoveryId, commandId: commandId });
    }
    var accepted = Object.assign({}, command, { status: 'DELETE_ACCEPTED_AWAITING_ABSENCE', providerCalled: true,
      providerAcceptedAt: at });
    await store.set(key, accepted);
    restored = await store.get(key);
    if (!restored || restored.status !== 'DELETE_ACCEPTED_AWAITING_ABSENCE' || restored.recoveryId !== recoveryId) {
      throw new Error('communication social recovery: provider receipt readback invalid');
    }
    return finalizeAbsence(store, key, restored, at, input);
  } catch (error) {
    return result('FAILED', 'communication-social-recovery-failed', { commandId: commandId,
      detail: String(error && error.message || error) });
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  KEY_PREFIX: KEY_PREFIX,
  recoveryKey: recoveryKey,
  publicAbsent: publicAbsent,
  recover: recover
};
