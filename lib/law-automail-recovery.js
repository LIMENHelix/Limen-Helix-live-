'use strict';
var crypto = require('node:crypto');
var Motor = require('./product-domain-motor-authorization.js');
var Executor = require('./law-automail-executor.js');
var Observer = require('./law-automail-outcome-observer.js');
var SCHEMA = 'law-automail-recovery/1.0', LOG_KEY = 'law_automail_recovery_log', PREFIX = 'law_automail_recovery:';
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); } function key(id) { return PREFIX + id; }
async function recover(input) { input = input || {}; var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'ACCEPTED' || !command.providerLetterId ||
      !observation || observation.schemaVersion !== Observer.SCHEMA || observation.commandId !== command.commandId ||
      trigger.type !== 'law-automail-cancel' || !trigger.id) return { ok: false, status: 'REFUSED', reason: 'accepted-command-independent-observation-and-cancel-trigger-required', liveMoney: false };
  var now = Number(input.now) || Date.now(), authorization = await (input.motorAuthorization || Motor).authorize(store, 'law', 'automail', now);
  if (!authorization || !authorization.authorized) return { ok: true, status: 'HELD', reason: authorization && authorization.reason || 'law-automail-recovery-motor-held', liveMoney: false };
  var recoveryId = 'lar_' + hash({ command: command.commandId, observation: observation.observationId, trigger: trigger.id, motor: authorization.receiptId }).slice(0, 24);
  var existing = await store.get(key(recoveryId)); if (existing) return existing;
  var receipt = { schemaVersion: SCHEMA, recoveryId: recoveryId, commandId: command.commandId, actionId: command.actionId, providerLetterId: command.providerLetterId,
    observationId: observation.observationId, trigger: { type: trigger.type, id: trigger.id }, productDomain: 'law', ownerDomain: 'law', lane: 'automail',
    productMotorReceiptId: authorization.receiptId, status: 'CANCELING', commandedAt: now, liveMoney: command.liveMoney === true };
  if (!(await store.setIfAbsent(key(recoveryId), receipt))) return store.get(key(recoveryId));
  var claim = { schemaVersion: SCHEMA, recoveryId: recoveryId, productMotorReceiptId: authorization.receiptId, claimedAt: now };
  if (!(await store.setIfAbsent(Executor.motorKey(authorization.receiptId), claim))) { receipt.status = 'REFUSED'; receipt.reason = 'law-automail-motor-receipt-already-consumed'; await store.set(key(recoveryId), receipt); return receipt; }
  var restoredClaim = await store.get(Executor.motorKey(authorization.receiptId)); if (!restoredClaim || restoredClaim.recoveryId !== recoveryId) throw new Error('law automail recovery motor claim readback invalid');
  if (!input.provider || typeof input.provider.cancel !== 'function' || typeof input.provider.read !== 'function') throw new Error('law automail recovery provider missing');
  var canceled; try { canceled = await input.provider.cancel(command.providerLetterId); } catch (error) { canceled = { ok: false, ambiguous: true, error: String(error && error.message || error) }; }
  receipt.cancelProviderCalled = true; receipt.cancelAccepted = !!(canceled && canceled.ok && canceled.deleted === true); receipt.cancelFailure = canceled && !canceled.ok ? String(canceled.error || 'lob-cancel-unresolved').slice(0, 240) : null;
  if (!receipt.cancelAccepted) { receipt.status = canceled && canceled.ambiguous ? 'AMBIGUOUS' : 'CANCEL_FAILED'; receipt.residual = 'physical letter may remain in production'; await store.set(key(recoveryId), receipt); return receipt; }
  var read = await input.provider.read(command.providerLetterId); receipt.independentReadAfterCancel = true;
  receipt.status = read && read.ok && read.deleted === true ? 'CANCELED_VERIFIED' : 'CANCEL_ACCEPTED_UNVERIFIED';
  receipt.residual = receipt.status === 'CANCELED_VERIFIED' ? null : 'provider accepted cancel but independent deleted state is unverified'; receipt.completedAt = Date.now();
  await store.set(key(recoveryId), receipt); var restored = await store.get(key(recoveryId)); if (!restored || restored.status !== receipt.status) throw new Error('law automail recovery readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); return restored; }
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, recover: recover };
