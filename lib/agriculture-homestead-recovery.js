'use strict';

var crypto = require('node:crypto');
var Motor = require('./product-domain-motor-authorization.js');
var Executor = require('./agriculture-homestead-executor.js');
var Observer = require('./agriculture-homestead-observer.js');

var SCHEMA = 'agriculture-homestead-recovery/1.0';
var LOG_KEY = 'agriculture_homestead_recovery_log';
var PREFIX = 'agriculture_homestead_recovery:';
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(id) { return PREFIX + id; }
async function recover(input) {
  input = input || {};
  var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
  var response = observation && observation.schemaVersion === Observer.SCHEMA && observation.commandId === (command && command.commandId);
  var policy = trigger.type === 'agriculture-provider-policy' && trigger.id;
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'ACCEPTED' || (!response && !policy)) return { ok: false, status: 'REFUSED', reason: 'accepted-command-and-response-or-provider-policy-required', liveMoney: false };
  var now = Number(input.now) || Date.now();
  var auth = await (input.motorAuthorization || Motor).authorize(store, 'agriculture', 'homestead', now);
  if (!auth || !auth.authorized) return { ok: true, status: 'HELD', reason: auth && auth.reason || 'agriculture-homestead-recovery-motor-held', liveMoney: false };
  var id = 'ahr_' + hash({ action: command.actionId, observation: observation && observation.observationId || null, trigger: trigger.id, motor: auth.receiptId }).slice(0, 24);
  var existing = await store.get(key(id)); if (existing) return existing;
  var recovery = { schemaVersion: SCHEMA, recoveryId: id, commandId: command.commandId, actionId: command.actionId,
    providerEmailHash: command.providerEmailHash, observationId: observation && observation.observationId || null,
    trigger: { type: trigger.type || 'counterparty-response', id: trigger.id || observation.observationId }, status: 'SUPPRESSING',
    productDomain: 'agriculture', ownerDomain: 'agriculture', lane: 'homestead', productMotorReceiptId: auth.receiptId,
    irreversiblePriorRequest: true, commandedAt: now, liveMoney: false };
  if (!(await store.setIfAbsent(key(id), recovery))) return store.get(key(id));
  if (!(await store.setIfAbsent(Executor.motorKey(auth.receiptId), { schemaVersion: SCHEMA, recoveryId: id, productMotorReceiptId: auth.receiptId, claimedAt: now }))) { recovery.status = 'REFUSED'; recovery.reason = 'agriculture-homestead-motor-receipt-already-consumed'; await store.set(key(id), recovery); return recovery; }
  var motorClaim = await store.get(Executor.motorKey(auth.receiptId)); if (!motorClaim || motorClaim.recoveryId !== id) throw new Error('agriculture homestead recovery motor claim readback invalid');
  var catalog = await store.get(Executor.SUPPRESSION_KEY); if (!catalog || typeof catalog !== 'object') catalog = {};
  catalog[command.providerEmailHash] = { suppressed: true, recoveryId: id, actionId: command.actionId, at: now, reason: trigger.type || 'counterparty-response' };
  await store.set(Executor.SUPPRESSION_KEY, catalog); var restoredCatalog = await store.get(Executor.SUPPRESSION_KEY);
  if (!restoredCatalog || !restoredCatalog[command.providerEmailHash] || restoredCatalog[command.providerEmailHash].recoveryId !== id) throw new Error('agriculture homestead suppression readback invalid');
  recovery.status = 'FUTURE_REQUESTS_SUPPRESSED'; recovery.strictSuppressionReadback = true;
  recovery.residual = 'previously delivered service request cannot be recalled'; recovery.completedAt = Date.now();
  await store.set(key(id), recovery); var restored = await store.get(key(id)); if (!restored || restored.status !== recovery.status) throw new Error('agriculture homestead recovery readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); return restored;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, recover: recover };
