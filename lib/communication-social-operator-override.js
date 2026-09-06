'use strict';

/**
 * Receipted Communication-lane operator override for ONE Economy social release.
 *
 * This is not a B10 disable. Chat, governors, Morse, and CRON_SECRET cannot
 * grant it. Only the same admin-key class already used by social-cron may mint.
 * The receipt applies only to subjectDomain=economy, expires in 30 minutes,
 * and is consumed once. SOCIAL_MAX_POSTS_PER_DAY still caps the publish path.
 */

var crypto = require('node:crypto');

var SCHEMA = 'communication-social-operator-override/1.0';
var LOG_KEY = 'communication_social_operator_override_log';
var KEY_PREFIX = 'communication_social_operator_override:';
var CLAIM_PREFIX = 'communication_social_operator_override_claim:';
var SUBJECT_DOMAIN = 'economy';
var TTL_MS = 30 * 60 * 1000;
var REASON = 'operator-go-economy-publish';
var ALLOWED_KEY_CLASSES = [
  'SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'
];

function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function receiptKey(subjectDomain) { return KEY_PREFIX + String(subjectDomain); }
function claimKey(overrideReceiptId) { return CLAIM_PREFIX + String(overrideReceiptId); }
function isAllowedKeyClass(value) { return ALLOWED_KEY_CLASSES.indexOf(text(value)) >= 0; }
function isB10OverridableBlocker(blocker) {
  var value = String(blocker || '');
  return value.indexOf('communication-b10-brake-held:') === 0 || value === 'communication-b10-no-action-selected';
}
function blockersAreB10Overridable(blockers) {
  return Array.isArray(blockers) && blockers.length > 0 && blockers.every(isB10OverridableBlocker);
}
function rateAllows(rateStatus) {
  if (!rateStatus) return { ok: true };
  if (rateStatus.ok === false) return { ok: false, reason: 'social-rate-status-unavailable' };
  var cap = Number(rateStatus.cap);
  var remaining = Number(rateStatus.remaining);
  if (Number.isFinite(cap) && cap === 0) return { ok: false, reason: 'social-daily-rate-disabled' };
  if (Number.isFinite(remaining) && remaining <= 0) return { ok: false, reason: 'social-daily-rate-exhausted' };
  return { ok: true };
}
function active(receipt, now) {
  return !!(receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'ACTIVE' &&
    receipt.subjectDomain === SUBJECT_DOMAIN && text(receipt.overrideReceiptId) &&
    isAllowedKeyClass(receipt.operatorKeyClass) &&
    Number.isFinite(Number(receipt.mintedAt)) && Number.isFinite(Number(receipt.expiresAt)) &&
    now >= Number(receipt.mintedAt) && now < Number(receipt.expiresAt));
}

async function appendLog(store, receipt) {
  await store.lpush(LOG_KEY, receipt);
  await store.ltrim(LOG_KEY, 0, 199);
}

async function mint(store, input) {
  input = input || {};
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var subjectDomain = text(input.subjectDomain);
  var operatorKeyClass = text(input.operatorKeyClass);
  if (subjectDomain !== SUBJECT_DOMAIN) {
    return { ok: false, reason: 'economy-only' };
  }
  if (!isAllowedKeyClass(operatorKeyClass)) {
    return { ok: false, reason: 'admin-key-required' };
  }
  var rate = rateAllows(input.rateStatus);
  if (!rate.ok) return rate;
  try {
    store.assertDurable();
    var key = receiptKey(SUBJECT_DOMAIN);
    var existing = await store.get(key);
    if (active(existing, now)) {
      return Object.assign({ ok: true, reused: true }, existing);
    }
    var overrideReceiptId = 'cso_' + crypto.createHash('sha256').update(JSON.stringify({
      subjectDomain: SUBJECT_DOMAIN, operatorKeyClass: operatorKeyClass, mintedAt: now
    })).digest('hex').slice(0, 24);
    var receipt = {
      schemaVersion: SCHEMA,
      overrideReceiptId: overrideReceiptId,
      status: 'ACTIVE',
      subjectDomain: SUBJECT_DOMAIN,
      productDomain: 'communication',
      ownerDomain: 'communication',
      lane: 'social',
      operatorKeyClass: operatorKeyClass,
      reason: REASON,
      mintedAt: now,
      expiresAt: now + TTL_MS,
      consumedAt: null,
      decisionReceiptId: null,
      liveMoney: false
    };
    await store.set(key, receipt, Math.ceil(TTL_MS / 1000));
    var restored = await store.get(key);
    if (!restored || restored.overrideReceiptId !== overrideReceiptId || restored.status !== 'ACTIVE') {
      throw new Error('communication social operator override: mint readback invalid');
    }
    await appendLog(store, restored);
    return Object.assign({ ok: true, reused: false }, restored);
  } catch (error) {
    return { ok: false, reason: 'override-mint-unavailable', detail: String(error && error.message || error) };
  }
}

async function consume(store, input) {
  input = input || {};
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var subjectDomain = text(input.subjectDomain);
  var decisionReceiptId = text(input.decisionReceiptId);
  if (subjectDomain !== SUBJECT_DOMAIN) {
    return { ok: false, reason: 'economy-only' };
  }
  var rate = rateAllows(input.rateStatus);
  if (!rate.ok) return rate;
  try {
    store.assertDurable();
    var key = receiptKey(SUBJECT_DOMAIN);
    var existing = await store.get(key);
    if (existing && existing.schemaVersion === SCHEMA && existing.status === 'CONSUMED' &&
        existing.overrideReceiptId) {
      return { ok: false, reason: 'override-already-consumed' };
    }
    if (!active(existing, now)) {
      return { ok: false, reason: 'override-absent-or-expired' };
    }
    var claimed = await store.setIfAbsent(claimKey(existing.overrideReceiptId), {
      schemaVersion: SCHEMA,
      overrideReceiptId: existing.overrideReceiptId,
      subjectDomain: SUBJECT_DOMAIN,
      claimedAt: now,
      decisionReceiptId: decisionReceiptId
    }, Math.ceil(TTL_MS / 1000));
    if (!claimed) {
      return { ok: false, reason: 'override-already-consumed' };
    }
    var consumed = Object.assign({}, existing, {
      status: 'CONSUMED',
      consumedAt: now,
      decisionReceiptId: decisionReceiptId
    });
    await store.set(key, consumed, Math.ceil(TTL_MS / 1000));
    var restored = await store.get(key);
    if (!restored || restored.status !== 'CONSUMED' || restored.overrideReceiptId !== existing.overrideReceiptId) {
      throw new Error('communication social operator override: consume readback invalid');
    }
    await appendLog(store, restored);
    return { ok: true, receipt: restored };
  } catch (error) {
    return { ok: false, reason: 'override-consume-unavailable', detail: String(error && error.message || error) };
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  KEY_PREFIX: KEY_PREFIX,
  CLAIM_PREFIX: CLAIM_PREFIX,
  SUBJECT_DOMAIN: SUBJECT_DOMAIN,
  TTL_MS: TTL_MS,
  REASON: REASON,
  ALLOWED_KEY_CLASSES: ALLOWED_KEY_CLASSES,
  receiptKey: receiptKey,
  claimKey: claimKey,
  isAllowedKeyClass: isAllowedKeyClass,
  isB10OverridableBlocker: isB10OverridableBlocker,
  blockersAreB10Overridable: blockersAreB10Overridable,
  mint: mint,
  consume: consume
};
