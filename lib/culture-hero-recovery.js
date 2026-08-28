'use strict';

/** Culture-authorized public suppression for a receipted visual artifact. */
var crypto = require('node:crypto');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var Executor = require('./culture-hero-executor.js');
var Observer = require('./culture-hero-outcome-observer.js');
var SCHEMA = 'culture-hero-recovery/1.0';
var LOG_KEY = 'culture_hero_recovery_log';
var PREFIX = 'culture_hero_recovery:';
var CATALOG_KEY = 'culture_hero_suppression_catalog';
function id(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(recoveryId) { return PREFIX + recoveryId; }
async function recover(input) {
  input = input || {};
  var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'GENERATED' ||
      !observation || observation.schemaVersion !== Observer.SCHEMA || observation.commandId !== command.commandId ||
      observation.status !== 'OBSERVED_PRESENT' || !trigger.type || !trigger.id) {
    return { ok: false, status: 'REFUSED', reason: 'identity-bound-command-observation-and-trigger-required', liveMoney: false };
  }
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var authorization = await (input.motorAuthorization || MotorAuthorization).authorize(store, 'culture', 'hero-image', now);
  if (!authorization || !authorization.authorized) return { ok: true, status: 'HELD', reason: authorization && authorization.reason || 'culture-recovery-motor-held', liveMoney: false };
  var recoveryId = 'chr_' + id({ commandId: command.commandId, observationId: observation.observationId,
    trigger: { type: trigger.type, id: trigger.id }, motor: authorization.receiptId }).slice(0, 24);
  var existing = await store.get(key(recoveryId)); if (existing) return existing;
  var recovery = { schemaVersion: SCHEMA, recoveryId: recoveryId, commandId: command.commandId,
    observationId: observation.observationId, assetDomain: command.assetDomain, productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
    productMotorReceiptId: authorization.receiptId, trigger: { type: String(trigger.type), id: String(trigger.id) },
    status: 'SUPPRESSING', commandedAt: now, liveMoney: false };
  if (!(await store.setIfAbsent(key(recoveryId), recovery))) return store.get(key(recoveryId));
  var motorClaim = { schemaVersion: SCHEMA, recoveryId: recoveryId, commandId: command.commandId,
    productMotorReceiptId: authorization.receiptId, claimedAt: now };
  if (!(await store.setIfAbsent(Executor.motorClaimKey(authorization.receiptId), motorClaim))) {
    recovery = Object.assign({}, recovery, { status: 'REFUSED', reason: 'culture-hero-motor-receipt-already-consumed', completedAt: Date.now() });
    await store.set(key(recoveryId), recovery);
    return recovery;
  }
  var restoredClaim = await store.get(Executor.motorClaimKey(authorization.receiptId));
  if (!restoredClaim || restoredClaim.recoveryId !== recoveryId) throw new Error('culture hero recovery: motor claim readback invalid');
  var catalog = await store.get(CATALOG_KEY); if (!catalog || typeof catalog !== 'object') catalog = {};
  catalog[command.assetDomain] = { suppressed: true, commandId: command.commandId, recoveryId: recoveryId, at: now };
  await store.set(CATALOG_KEY, catalog);
  var restoredCatalog = await store.get(CATALOG_KEY);
  if (!restoredCatalog || !restoredCatalog[command.assetDomain] || restoredCatalog[command.assetDomain].recoveryId !== recoveryId) {
    throw new Error('culture hero recovery: suppression readback invalid');
  }
  var absent = false;
  if (typeof input.observePublicCatalog === 'function') {
    var publicCatalog = await input.observePublicCatalog();
    absent = !!(publicCatalog && publicCatalog.ok && publicCatalog.images && !publicCatalog.images[command.assetDomain]);
  }
  recovery = Object.assign({}, recovery, { status: absent ? 'SUPPRESSED' : 'SUPPRESSION_PENDING_PUBLIC_VERIFICATION',
    strictSuppressionReadback: true, independentPublicAbsenceVerified: absent, completedAt: Date.now() });
  await store.set(key(recoveryId), recovery);
  var restored = await store.get(key(recoveryId));
  if (!restored || restored.status !== recovery.status || restored.recoveryId !== recoveryId) throw new Error('culture hero recovery: receipt readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999);
  return restored;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, CATALOG_KEY: CATALOG_KEY, key: key, recover: recover };
