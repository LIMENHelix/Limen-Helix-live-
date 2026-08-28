'use strict';

var crypto = require('node:crypto');
var Motor = require('./product-domain-motor-authorization.js');
var Executor = require('./population-real-estate-executor.js');
var Observer = require('./population-real-estate-observer.js');

var SCHEMA = 'population-real-estate-recovery/1.0';
var LOG_KEY = 'population_real_estate_recovery_log';
var PREFIX = 'population_real_estate_recovery:';
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(id) { return PREFIX + id; }
async function recover(input) {
  input = input || {};
  var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
  var response = observation && observation.schemaVersion === Observer.SCHEMA && observation.commandId === (command && command.commandId);
  var policy = trigger.type === 'population-real-estate-policy' && trigger.id;
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'INQUIRY_ACCEPTED' || command.nonBinding !== true ||
      command.contractAuthorized !== false || command.fundsTransferAuthorized !== false || (!response && !policy)) {
    return { ok: false, status: 'REFUSED', reason: 'non-binding-inquiry-and-response-or-policy-required', liveMoney: false };
  }
  var now = Number(input.now) || Date.now();
  var auth = await (input.motorAuthorization || Motor).authorize(store, 'population', 'real-estate', now);
  if (!auth || !auth.authorized) return { ok: true, status: 'HELD', reason: auth && auth.reason || 'population-real-estate-recovery-motor-held', liveMoney: false };
  var id = 'prr_' + hash({ action: command.actionId, observation: observation && observation.observationId || null, trigger: trigger.id, motor: auth.receiptId }).slice(0, 24);
  var existing = await store.get(key(id)); if (existing) return existing;
  var recovery = { schemaVersion: SCHEMA, recoveryId: id, commandId: command.commandId, actionId: command.actionId,
    counterpartyEmailHash: command.counterpartyEmailHash, observationId: observation && observation.observationId || null,
    trigger: { type: trigger.type || 'counterparty-response', id: trigger.id || observation.observationId }, status: 'SUPPRESSING',
    productDomain: 'population', ownerDomain: 'population', lane: 'real-estate', productMotorReceiptId: auth.receiptId,
    irreversiblePriorInquiry: true, commandedAt: now, liveMoney: false };
  if (!(await store.setIfAbsent(key(id), recovery))) return store.get(key(id));
  if (!(await store.setIfAbsent(Executor.motorKey(auth.receiptId), { schemaVersion: SCHEMA, recoveryId: id, productMotorReceiptId: auth.receiptId, claimedAt: now }))) { recovery.status = 'REFUSED'; recovery.reason = 'population-real-estate-motor-receipt-already-consumed'; await store.set(key(id), recovery); return recovery; }
  var motorClaim = await store.get(Executor.motorKey(auth.receiptId)); if (!motorClaim || motorClaim.recoveryId !== id) throw new Error('population real-estate recovery motor claim readback invalid');
  var catalog = await store.get(Executor.SUPPRESSION_KEY); if (!catalog || typeof catalog !== 'object') catalog = {};
  var suppressionIdentity = hash({ counterparty: command.counterpartyEmailHash, property: command.propertyRefHash });
  catalog[suppressionIdentity] = { suppressed: true, recoveryId: id, actionId: command.actionId, at: now, reason: trigger.type || 'counterparty-response' };
  await store.set(Executor.SUPPRESSION_KEY, catalog); var restoredCatalog = await store.get(Executor.SUPPRESSION_KEY);
  if (!restoredCatalog || !restoredCatalog[suppressionIdentity] || restoredCatalog[suppressionIdentity].recoveryId !== id) throw new Error('population real-estate suppression readback invalid');
  recovery.status = 'FUTURE_INQUIRIES_SUPPRESSED'; recovery.strictSuppressionReadback = true;
  recovery.suppressionIdentity = suppressionIdentity;
  recovery.residual = 'previously delivered non-binding inquiry cannot be recalled; it creates no contract or funds-transfer authority'; recovery.completedAt = Date.now();
  await store.set(key(id), recovery); var restored = await store.get(key(id)); if (!restored || restored.status !== recovery.status) throw new Error('population real-estate recovery readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); return restored;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, recover: recover };
