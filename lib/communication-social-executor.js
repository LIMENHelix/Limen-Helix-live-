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
var Learning = require('./communication-social-learning.js');
var DomainLearning = require('./domain-commercial-social-learning.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'communication-social-command/1.0';
var LOG_KEY = 'communication_social_command_log';
var PENDING_LOG_KEY = 'communication_social_pending_log';
var KEY_PREFIX = 'communication_social_command:';
var MOTOR_CLAIM_PREFIX = 'communication_social_motor_claim:';
var ARTIFACT_CLAIM_PREFIX = 'domain_commercial:social-artifact-claim:';
var CONTENT_CLAIM_PREFIX = 'domain_commercial:social-content-claim:';
var DEFINITIVE_PREFIX = 'communication_social_recovery:definitive:';
var LOG_CAP = 1000;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function commandKey(commandId) { return KEY_PREFIX + String(commandId); }
function motorClaimKey(receiptId) { return MOTOR_CLAIM_PREFIX + String(receiptId); }
function artifactClaimKey(domain, artifactId) { return ARTIFACT_CLAIM_PREFIX + String(domain) + ':' + String(artifactId); }
function contentClaimKey(domain, body) { return CONTENT_CLAIM_PREFIX + String(domain) + ':' + hash(String(body)); }
function definitiveKey(commandId) { return DEFINITIVE_PREFIX + String(commandId); }

async function releaseClaims(store, claims) {
  if (!store || typeof store.deleteIfValue !== 'function') return false;
  var released = true;
  for (var i = 0; i < claims.length; i++) {
    try { await store.deleteIfValue(claims[i].key, claims[i].value); }
    catch (_) { released = false; }
  }
  return released;
}

async function recoverDefinitiveClaims(store, claims) {
  var rows = (claims || []).filter(Boolean);
  for (var i = 0; i < rows.length; i++) {
    var claim = rows[i];
    var commandIdValue = claim.value && claim.value.commandId;
    var command = commandIdValue ? await store.get(commandKey(commandIdValue)) : null;
    if (command && command.status === 'DISPATCHING') {
      var definitive = await store.get(definitiveKey(commandIdValue));
      if (definitive && definitive.commandId === commandIdValue && definitive.status === 'FAILED' &&
          definitive.definitiveFailure === true) {
        await store.set(commandKey(commandIdValue), definitive);
        command = await store.get(commandKey(commandIdValue));
      }
    }
    var identityMatches = command && claim.value && command.subjectDomain === claim.value.productDomain &&
      (claim.value.claimType === 'DOMAIN_COMMERCIAL_PUBLIC_CONTENT'
        ? command.contentHash === claim.value.contentHash
        : claim.value.claimType === 'DOMAIN_COMMERCIAL_ARTIFACT' &&
          command.sourceArtifactId === claim.value.sourceArtifactId);
    if (!identityMatches || command.status !== 'FAILED' ||
        (command.providerCalled !== false && command.definitiveFailure !== true)) return false;
  }
  for (var j = 0; j < rows.length; j++) {
    await store.deleteIfValue(rows[j].key, rows[j].value);
  }
  var remaining = await Promise.all(rows.map(function (row) { return store.get(row.key); }));
  return remaining.every(function (row) { return row == null; });
}

async function markPreProviderFailure(store, key, command, reason) {
  if (!key || !command) return null;
  var failed = Object.assign({}, command, {
    status: 'FAILED', providerCalled: false, resolvedAt: Date.now(),
    reason: reason || 'communication-social-pre-provider-failure'
  });
  await store.set(key, failed);
  var restored = await store.get(key);
  if (!restored || restored.commandId !== command.commandId || restored.status !== 'FAILED' ||
      restored.providerCalled !== false) {
    throw new Error('communication social executor: pre-provider failure readback invalid');
  }
  await append(store, restored);
  return restored;
}

function commandId(spec, authorization) {
  return 'csc_' + hash({
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    productMotorReceiptId: authorization.receiptId,
    decisionReceiptId: spec.decisionReceipt && spec.decisionReceipt.decisionReceiptId,
    subjectDomain: text(spec.subjectDomain), sourceArtifactId: text(spec.sourceArtifactId), text: text(spec.text)
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
  var receiptCandidate = { subjectDomain: subjectDomain, text: body,
    sourceArtifactId: spec.sourceArtifactId || null, sourceIntentId: spec.sourceIntentId || null,
    sourcePacketId: spec.sourcePacketId || null, candidateHash: spec.candidateHash || null,
    domainDecisionReceipt: spec.domainDecisionReceipt || null };
  if (!Decision.validateReceipt(spec.decisionReceipt, receiptCandidate, now)) {
    return { ok: false, status: 'REFUSED', reason: 'communication-social-b10-decision-required', published: false, liveMoney: false };
  }
  var store = input.store;
  var acquiredClaims = [];
  var providerAttempted = false;
  var command = null;
  var key = null;
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
    key = commandKey(id);
    if (text(spec.sourceArtifactId)) {
      var artifactKey = artifactClaimKey(subjectDomain, spec.sourceArtifactId);
      var publicContentKey = contentClaimKey(subjectDomain, body);
      var priorValues = await Promise.all([store.get(artifactKey), store.get(publicContentKey)]);
      var priorClaims = [
        priorValues[0] && { key: artifactKey, value: priorValues[0] },
        priorValues[1] && { key: publicContentKey, value: priorValues[1] }
      ].filter(Boolean);
      if (priorClaims.length && await recoverDefinitiveClaims(store, priorClaims)) priorClaims = [];
      if (priorClaims.length) {
        var prior = priorClaims.find(function (row) { return row.key === publicContentKey; }) || priorClaims[0];
        return { ok: false, status: 'REFUSED',
          reason: prior.key === publicContentKey ? 'domain-commercial-public-content-already-distributed-or-claimed' :
            'domain-commercial-artifact-already-distributed-or-claimed',
          published: false, commandId: prior.value.commandId || null,
          sourceArtifactId: spec.sourceArtifactId, liveMoney: false };
      }
    }
    var claimKey = motorClaimKey(authorization.receiptId);
    var motorClaim = {
      schemaVersion: SCHEMA,
      claimType: 'POST',
      productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
      productMotorReceiptId: authorization.receiptId,
      commandId: id,
      actionId: id,
      claimedAt: now
    };
    var claimed = await store.setIfAbsent(claimKey, motorClaim);
    var restoredClaim = await store.get(claimKey);
    if (!restoredClaim || restoredClaim.schemaVersion !== SCHEMA ||
        restoredClaim.productMotorReceiptId !== authorization.receiptId || restoredClaim.commandId !== id) {
      return { ok: false, status: 'REFUSED', reason: claimed ? 'communication-social-motor-claim-readback-invalid' : 'communication-social-motor-receipt-already-consumed', published: false, commandId: id, liveMoney: false };
    }
    command = {
      schemaVersion: SCHEMA,
      commandId: id,
      status: 'DISPATCHING',
      productDomain: 'communication',
      ownerDomain: 'communication',
      lane: 'social',
      subjectDomain: subjectDomain,
      sourceArtifactId: spec.sourceArtifactId || null,
      sourceIntentId: spec.sourceIntentId || null,
      sourcePacketId: spec.sourcePacketId || null,
      candidateHash: spec.candidateHash || null,
      selectedProgram: spec.selectedProgram || null,
      domainDecisionReceiptId: spec.domainDecisionReceipt && spec.domainDecisionReceipt.decisionReceiptId || null,
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
    if (text(spec.sourceArtifactId)) {
      var contentClaim = {
        schemaVersion: SCHEMA, claimType: 'DOMAIN_COMMERCIAL_PUBLIC_CONTENT',
        productDomain: subjectDomain, channelOwnerDomain: 'communication', lane: 'social',
        contentHash: hash(body), commandId: id, productMotorReceiptId: authorization.receiptId, claimedAt: now
      };
      var contentKey = contentClaimKey(subjectDomain, body);
      var contentClaimed = await store.setIfAbsent(contentKey, contentClaim);
      var restoredContentClaim = await store.get(contentKey);
      if (!contentClaimed || !restoredContentClaim || restoredContentClaim.commandId !== id ||
          restoredContentClaim.contentHash !== contentClaim.contentHash) {
        await markPreProviderFailure(store, key, command, 'domain-commercial-public-content-claim-collision');
        return { ok: false, status: 'REFUSED', reason: 'domain-commercial-public-content-already-distributed-or-claimed',
          published: false, commandId: restoredContentClaim && restoredContentClaim.commandId || null,
          sourceArtifactId: spec.sourceArtifactId, liveMoney: false };
      }
      acquiredClaims.push({ key: contentKey, value: restoredContentClaim });
      var artifactClaim = {
        schemaVersion: SCHEMA, claimType: 'DOMAIN_COMMERCIAL_ARTIFACT',
        productDomain: subjectDomain,
        sourceOwnerDomain: spec.domainDecisionReceipt && spec.domainDecisionReceipt.ownerDomain || subjectDomain,
        channelOwnerDomain: 'communication',
        lane: 'social', sourceArtifactId: spec.sourceArtifactId, commandId: id,
        productMotorReceiptId: authorization.receiptId, claimedAt: now
      };
      var artifactClaimed = await store.setIfAbsent(artifactClaimKey(subjectDomain, spec.sourceArtifactId), artifactClaim);
      var restoredArtifactClaim = await store.get(artifactClaimKey(subjectDomain, spec.sourceArtifactId));
      if (!artifactClaimed || !restoredArtifactClaim || restoredArtifactClaim.commandId !== id ||
          restoredArtifactClaim.sourceArtifactId !== spec.sourceArtifactId) {
        await markPreProviderFailure(store, key, command, 'domain-commercial-artifact-claim-collision');
        await releaseClaims(store, acquiredClaims);
        return { ok: false, status: 'REFUSED', reason: 'domain-commercial-artifact-already-distributed-or-claimed',
          published: false, commandId: restoredArtifactClaim && restoredArtifactClaim.commandId || null,
          sourceArtifactId: spec.sourceArtifactId, liveMoney: false };
      }
      acquiredClaims.push({ key: artifactClaimKey(subjectDomain, spec.sourceArtifactId), value: restoredArtifactClaim });
    }
    // This strict index is written before authentication. If Bluesky accepts
    // and final receipt persistence fails, AppView can reconcile without a
    // second post.
    await append(store, command, PENDING_LOG_KEY);
    var learnedCause = await Learning.recordCommand(store, command);
    if (!learnedCause || learnedCause.ok !== true) throw new Error('communication social executor: causal memory unavailable');
    if (command.sourceArtifactId) {
      var domainCause = await DomainLearning.recordCommand(store, command);
      if (!domainCause || domainCause.ok !== true) throw new Error('subject domain social causal memory unavailable');
    }

    var platform = input.platform || Social;
    var posted;
    try {
      command.adapterGuard = await (input.adapterGuard || AdapterGuard).checkpoint(store, 'communication:social', 'bluesky-public-post');
      posted = await platform.postToBluesky(body);
    } catch (postError) {
      posted = { ok: false, providerCalled: postError && postError.code === AdapterGuard.INHIBITED ? false : true,
        definitiveFailure: postError && postError.code === AdapterGuard.INHIBITED,
        reason: String(postError && postError.message || postError) };
    }
    providerAttempted = !(posted && posted.providerCalled === false);
    var resolved;
    if (!posted || posted.ok !== true || !text(posted.uri) || !text(posted.cid) || !text(posted.url)) {
      var definitive = posted && (posted.definitiveFailure === true || posted.providerCalled === false);
      resolved = Object.assign({}, command, {
        status: definitive ? 'FAILED' : 'DISPATCHING',
        providerCalled: posted && posted.providerCalled === false ? false : true,
        definitiveFailure: !!definitive,
        resolvedAt: definitive ? Date.now() : null,
        lastAttemptAt: Date.now(), ambiguous: !definitive,
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
    // A confirmed non-publication is itself an external result. Journal it
    // independently before replacing the in-flight command, so a transient
    // command-key write failure is recoverable without risking a duplicate.
    if (resolved.status === 'FAILED' && resolved.definitiveFailure === true) {
      await store.set(definitiveKey(id), resolved);
      var definitiveRestored = await store.get(definitiveKey(id));
      if (!definitiveRestored || definitiveRestored.commandId !== id ||
          definitiveRestored.status !== 'FAILED' || definitiveRestored.definitiveFailure !== true) {
        throw new Error('communication social executor: definitive result journal readback invalid');
      }
    }
    await store.set(key, resolved);
    restored = await store.get(key);
    if (!restored || restored.commandId !== id || restored.status !== resolved.status ||
        (resolved.status === 'POSTED' && (!restored.receipt || restored.receipt.uri !== posted.uri ||
          restored.receipt.cid !== posted.cid || restored.receipt.readbackVerified !== true))) {
      throw new Error('communication social executor: action receipt readback invalid');
    }
    await append(store, restored);
    if (resolved.status === 'FAILED') {
      await releaseClaims(store, acquiredClaims);
    }
    return publicResult(restored, false);
  } catch (error) {
    if (providerAttempted === false) {
      try { await markPreProviderFailure(store, key, command, 'communication-social-pre-provider-exception'); } catch (_) {}
      await releaseClaims(store, acquiredClaims);
    }
    return { ok: false, status: 'FAILED', reason: 'communication-social-executor-failed', detail: String(error && error.message || error), published: false, liveMoney: false };
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  PENDING_LOG_KEY: PENDING_LOG_KEY,
  KEY_PREFIX: KEY_PREFIX,
  MOTOR_CLAIM_PREFIX: MOTOR_CLAIM_PREFIX,
  ARTIFACT_CLAIM_PREFIX: ARTIFACT_CLAIM_PREFIX,
  CONTENT_CLAIM_PREFIX: CONTENT_CLAIM_PREFIX,
  DEFINITIVE_PREFIX: DEFINITIVE_PREFIX,
  commandKey: commandKey,
  motorClaimKey: motorClaimKey,
  artifactClaimKey: artifactClaimKey,
  contentClaimKey: contentClaimKey,
  definitiveKey: definitiveKey,
  recoverDefinitiveClaims: recoverDefinitiveClaims,
  commandId: commandId,
  execute: execute
};
