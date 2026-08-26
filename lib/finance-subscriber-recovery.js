'use strict';

/** Finance-authorized compensating recovery for irreversible email delivery. */
var crypto = require('node:crypto');
var MotorAuthorization = require('./finance-subscriber-motor-authorization.js');
var Executor = require('./finance-subscriber-executor.js');
var Observer = require('./finance-subscriber-outcome-observer.js');
var SCHEMA = 'finance-subscriber-recovery/1.0';
var LOG_KEY = 'finance_subscriber_recovery_log', PREFIX = 'finance_subscriber_recovery:';
var NEGATIVE = { bounced: true, complained: true, failed: true, suppressed: true };
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function key(id) { return PREFIX + id; }
function findItem(command, actionId) { return command && (command.items || []).find(function (x) { return x.actionId === actionId; }); }
async function recover(input) {
  input = input || {}; var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
  var item = findItem(command, input.actionId || observation && observation.actionId);
  var sourceSeparated = observation && observation.schemaVersion === Observer.SCHEMA && observation.actionId === item?.actionId && NEGATIVE[observation.lastEvent];
  var policyTrigger = trigger.type === 'subscriber-policy' && trigger.id;
  if (!command || command.schemaVersion !== Executor.SCHEMA || !item || item.status !== 'ACCEPTED' || (!sourceSeparated && !policyTrigger)) return { ok: false, status: 'REFUSED', reason: 'accepted-action-and-negative-outcome-or-policy-trigger-required', liveMoney: false };
  var now = Number(input.now) || Date.now(), authorization = await (input.motorAuthorization || MotorAuthorization).authorize(store, 'finance', 'subscriber-email', now);
  if (!authorization || !authorization.authorized) return { ok: true, status: 'HELD', reason: authorization && authorization.reason || 'finance-subscriber-recovery-motor-held', liveMoney: false };
  var recoveryId = 'fsr_' + hash({ actionId: item.actionId, observation: observation && observation.observationId || null,
    trigger: { type: trigger.type, id: trigger.id }, motor: authorization.receiptId }).slice(0, 24);
  var existing = await store.get(key(recoveryId)); if (existing) return existing;
  var recovery = { schemaVersion: SCHEMA, recoveryId: recoveryId, status: 'SUPPRESSING', commandId: command.commandId,
    actionId: item.actionId, emailHash: item.emailHash, observationId: observation && observation.observationId || null,
    trigger: { type: trigger.type || 'negative-delivery-outcome', id: trigger.id || observation.observationId },
    productDomain: 'finance', ownerDomain: 'finance', lane: 'subscriber-email', productMotorReceiptId: authorization.receiptId,
    commandedAt: now, irreversiblePriorEmail: true, correctiveEmailSent: false, liveMoney: false };
  if (!(await store.setIfAbsent(key(recoveryId), recovery))) return store.get(key(recoveryId));
  var claim = { schemaVersion: SCHEMA, recoveryId: recoveryId, actionId: item.actionId, productMotorReceiptId: authorization.receiptId, claimedAt: now };
  if (!(await store.setIfAbsent(Executor.motorClaimKey(authorization.receiptId), claim))) { recovery.status = 'REFUSED'; recovery.reason = 'finance-subscriber-motor-receipt-already-consumed'; await store.set(key(recoveryId), recovery); return recovery; }
  var restoredClaim = await store.get(Executor.motorClaimKey(authorization.receiptId));
  if (!restoredClaim || restoredClaim.recoveryId !== recoveryId) throw new Error('finance subscriber recovery motor claim readback invalid');
  var catalog = await store.get(Executor.SUPPRESSION_KEY); if (!catalog || typeof catalog !== 'object') catalog = {};
  catalog[item.emailHash] = { suppressed: true, recoveryId: recoveryId, actionId: item.actionId, reason: observation && observation.lastEvent || trigger.type, at: now };
  await store.set(Executor.SUPPRESSION_KEY, catalog); var restoredCatalog = await store.get(Executor.SUPPRESSION_KEY);
  if (!restoredCatalog || !restoredCatalog[item.emailHash] || restoredCatalog[item.emailHash].recoveryId !== recoveryId) throw new Error('finance subscriber suppression readback invalid');
  recovery.status = 'FUTURE_DELIVERY_SUPPRESSED'; recovery.strictSuppressionReadback = true; recovery.residual = 'previously delivered email cannot be recalled'; recovery.completedAt = Date.now();
  await store.set(key(recoveryId), recovery); var restored = await store.get(key(recoveryId));
  if (!restored || restored.status !== recovery.status || restored.recoveryId !== recoveryId) throw new Error('finance subscriber recovery readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); return restored;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, NEGATIVE: NEGATIVE, key: key, recover: recover };
