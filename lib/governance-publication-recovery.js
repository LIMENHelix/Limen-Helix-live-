'use strict';

var Source = require('./governance-publication-source.js');
var Motor = require('./product-domain-motor-authorization.js');
var Executor = require('./governance-publication-executor.js');
var Observer = require('./governance-publication-observer.js');
var Publisher = require('./governance-publication-publisher.js');

var SCHEMA = 'governance-publication-recovery/1.0';
var LOG_KEY = 'governance_publication_recovery_log';
var PREFIX = 'governance_publication_recovery:';

function key(id) { return PREFIX + id; }

async function recover(input) {
  input = input || {};
  var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
  var observed = observation && observation.schemaVersion === Observer.SCHEMA && observation.commandId === (command && command.commandId) &&
    (observation.status === 'PUBLIC_PRESENCE_OBSERVED' || observation.status === 'SOURCE_CLICK_OBSERVED');
  var policy = trigger.type === 'governance-publication-policy' && trigger.id;
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'PUBLISHED' || (!observed && !policy)) {
    return { ok: false, status: 'REFUSED', reason: 'published-command-and-independent-observation-or-policy-required', liveMoney: false };
  }
  var now = Number(input.now) || Date.now();
  var authorization = await (input.motorAuthorization || Motor).authorize(store, 'governance', 'publication', now);
  if (!authorization || !authorization.authorized) return { ok: true, status: 'HELD', reason: authorization && authorization.reason || 'governance-publication-recovery-motor-held', liveMoney: false };
  var recoveryId = 'gpr_' + Source.hash({ action: command.actionId, observation: observation && observation.observationId || null,
    trigger: trigger.id, motor: authorization.receiptId }).slice(0, 24);
  var existing = await store.get(key(recoveryId)); if (existing) return existing;
  var recovery = {
    schemaVersion: SCHEMA, recoveryId: recoveryId, commandId: command.commandId, actionId: command.actionId,
    articleId: command.articleId, observationId: observation && observation.observationId || null,
    trigger: { type: trigger.type || 'operator-remediation', id: trigger.id || observation.observationId },
    status: 'UNPUBLISHING', productDomain: 'governance', ownerDomain: 'governance', lane: 'publication',
    productMotorReceiptId: authorization.receiptId, commandedAt: now, liveMoney: false
  };
  if (!await store.setIfAbsent(key(recoveryId), recovery)) return store.get(key(recoveryId));
  if (!await store.setIfAbsent(Executor.motorKey(authorization.receiptId), { schemaVersion: SCHEMA, recoveryId: recoveryId,
    productMotorReceiptId: authorization.receiptId, claimedAt: now })) {
    recovery.status = 'REFUSED'; recovery.reason = 'governance-publication-motor-receipt-already-consumed'; await store.set(key(recoveryId), recovery); return recovery;
  }
  var result = await (input.publisher || Publisher).unpublish(store, command.articleId, recoveryId, now);
  if (!result.ok) { recovery.status = result.definitiveFailure ? 'UNPUBLISH_FAILED' : 'UNPUBLISH_AMBIGUOUS'; recovery.failure = result.error || 'unpublish-unresolved'; await store.set(key(recoveryId), recovery); return recovery; }
  var catalog = await store.get(Executor.SUPPRESSION_KEY); if (!catalog || typeof catalog !== 'object') catalog = {};
  catalog[command.sourceFingerprint] = { suppressed: true, recoveryId: recoveryId, actionId: command.actionId, at: now };
  await store.set(Executor.SUPPRESSION_KEY, catalog);
  var restoredCatalog = await store.get(Executor.SUPPRESSION_KEY);
  if (!restoredCatalog || !restoredCatalog[command.sourceFingerprint] || restoredCatalog[command.sourceFingerprint].recoveryId !== recoveryId) throw new Error('governance publication suppression readback invalid');
  var absent = typeof input.observePublicAbsence === 'function' ? await input.observePublicAbsence(command.articleId) : false;
  recovery.status = absent ? 'UNPUBLISHED_VERIFIED' : 'UNPUBLISHED_PENDING_PUBLIC_VERIFICATION';
  recovery.strictSuppressionReadback = true; recovery.independentPublicAbsenceVerified = absent; recovery.completedAt = Date.now();
  await store.set(key(recoveryId), recovery);
  var restored = await store.get(key(recoveryId));
  if (!restored || restored.status !== recovery.status) throw new Error('governance publication recovery readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999);
  return restored;
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, recover: recover };
