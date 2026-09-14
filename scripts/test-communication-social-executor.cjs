#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var ExecutorModule = require('../lib/communication-social-executor.js');
var Executor = Object.assign({}, ExecutorModule, { execute: function (input) {
  var fixed = input.now;
  return ExecutorModule.execute(Object.assign({ nowFn: function () { return fixed; } }, input));
} });
var Decision = require('../lib/communication-social-decision.js');
var Strict = require('../lib/autofire-efference-store.js');
var Learning = require('../lib/communication-social-learning.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.deleteIfValue = async function (key, value) {
  if (!this.map.has(key) || JSON.stringify(this.map.get(key)) !== JSON.stringify(value)) return 0;
  this.map.delete(key); return 1;
};
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

var motor = { authorize: async function () { return { authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'pdmr_comm_1' }; } };
var platformCalls = 0;
var platform = { postToBluesky: async function () { platformCalls++; return { ok: true, uri: 'at://did/app.bsky.feed.post/r1', cid: 'cid1', url: 'https://bsky.app/post/r1', used: 1, cap: 8 }; } };
function decisionReceipt(subjectDomain, body, now) {
  return {
    schemaVersion: Decision.SCHEMA, decisionReceiptId: 'csd_' + now + '_' + subjectDomain,
    status: 'RELEASED', released: true, productDomain: 'communication', ownerDomain: 'communication',
    lane: 'social', decisionContract: 'public-message-decision/1', subjectDomain: subjectDomain,
    contentHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    decidedAt: now, expiresAt: now + 600000
  };
}
function spec(subjectDomain, body, now) { return { subjectDomain: subjectDomain, text: body, decisionReceipt: decisionReceipt(subjectDomain, body, now) }; }

function artifactSpec(subjectDomain, body, artifactId, motorTime) {
  var value = {
    subjectDomain: subjectDomain, text: body, sourceArtifactId: artifactId,
    sourceIntentId: 'intent-' + artifactId, sourcePacketId: 'packet-' + artifactId,
    candidateHash: 'candidate-' + artifactId
  };
  var domainDecision = {
    schemaVersion: 'domain-commercial-distribution-decision/1.0',
    decisionReceiptId: 'domain-' + artifactId, status: 'RELEASED', released: true,
    productDomain: subjectDomain, ownerDomain: subjectDomain, channelOwnerDomain: 'communication',
    channel: 'communication:bluesky', sourceArtifactId: value.sourceArtifactId,
    sourceIntentId: value.sourceIntentId, sourcePacketId: value.sourcePacketId,
    candidateHash: value.candidateHash,
    contentHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    decidedAt: motorTime, expiresAt: motorTime + 600000
  };
  value.domainDecisionReceipt = domainDecision;
  value.decisionReceipt = Object.assign(decisionReceipt(subjectDomain, body, motorTime), {
    sourceArtifactId: value.sourceArtifactId, sourceIntentId: value.sourceIntentId,
    sourcePacketId: value.sourcePacketId, candidateHash: value.candidateHash,
    domainDecisionReceiptId: domainDecision.decisionReceiptId
  });
  return value;
}

(async function () {
  assert.equal(Strict.assertKey(Executor.LOG_KEY), Executor.LOG_KEY);
  assert.equal(Strict.assertKey(Executor.PENDING_LOG_KEY), Executor.PENDING_LOG_KEY);
  assert.equal(Strict.assertKey(Executor.commandKey('x')), Executor.commandKey('x'));
  assert.equal(Strict.assertKey(Executor.motorClaimKey('x')), Executor.motorClaimKey('x'));
  var store = new Store();
  var first = await Executor.execute({ store: store, spec: spec('defense', 'bounded post', 1000), motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(first.status, 'POSTED');
  assert.equal(first.published, true);
  assert.equal(first.uri, 'at://did/app.bsky.feed.post/r1');
  assert.equal(platformCalls, 1);

  var differentContent = await Executor.execute({ store: store, spec: spec('defense', 'different post', 1000), motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(differentContent.status, 'REFUSED');
  assert.equal(differentContent.reason, 'communication-social-motor-receipt-already-consumed');
  assert.equal(platformCalls, 1);
  var command = await store.get(Executor.commandKey(first.commandId));
  assert(await store.get(Learning.causeKey(first.commandId)));
  assert.equal(command.receipt.readbackVerified, true);
  assert.equal(command.contentHash.length, 64);
  assert.equal(command.liveMoney, false);
  assert(store.log.some(function (row) { return row.key === Executor.PENDING_LOG_KEY && row.value.status === 'DISPATCHING'; }));

  var duplicate = await Executor.execute({ store: store, spec: spec('defense', 'bounded post', 1000), motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(duplicate.duplicate, true);
  assert.equal(platformCalls, 1);

  var heldCalls = 0;
  var held = await Executor.execute({
    store: new Store(), spec: spec('defense', 'held post', 2000),
    motorAuthorization: { authorize: async function () { return { authorized: false, reason: 'b10-held', receiptId: 'held' }; } },
    platform: { postToBluesky: async function () { heldCalls++; } }, now: 2000
  });
  assert.equal(held.status, 'HELD');
  assert.equal(heldCalls, 0);

  var failedStore = new Store();
  var failedCalls = 0;
  var failure = await Executor.execute({
    store: failedStore, spec: spec('law', 'one shot', 3000), motorAuthorization: motor,
    platform: { postToBluesky: async function () { failedCalls++; return { ok: false, reason: 'provider-failed' }; } }, now: 3000
  });
  assert.equal(failure.status, 'DISPATCHING');
  assert.equal((await failedStore.get(Executor.commandKey(failure.commandId))).ambiguous, true);
  var noRetry = await Executor.execute({
    store: failedStore, spec: spec('law', 'one shot', 3000), motorAuthorization: motor,
    platform: { postToBluesky: async function () { failedCalls++; } }, now: 3000
  });
  assert.equal(noRetry.reason, 'communication-social-command-already-claimed-no-retry');
  assert.equal(failedCalls, 1);

  var noDecisionCalls = 0;
  var noDecision = await Executor.execute({ store: new Store(), spec: { subjectDomain: 'law', text: 'no B10' }, motorAuthorization: motor,
    platform: { postToBluesky: async function () { noDecisionCalls++; } }, now: 4000 });
  assert.equal(noDecision.reason, 'communication-social-b10-decision-required');
  assert.equal(noDecisionCalls, 0);

  var claimStore = new Store(), motorCounter = 0;
  var freshMotor = { authorize: async function () { motorCounter++; return { authorized: true,
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'claim-motor-' + motorCounter }; } };
  var claimSpec = artifactSpec('law', 'retryable domain artifact', 'law-artifact-1', 5000);
  var inhibitedError = new Error('valve closed'); inhibitedError.code = 'CIVILIZATION_ADAPTER_INHIBITED';
  var inhibited = await Executor.execute({ store: claimStore, spec: claimSpec, now: 5000,
    motorAuthorization: freshMotor,
    adapterGuard: { checkpoint: async function () { throw inhibitedError; } },
    platform: { postToBluesky: async function () { throw new Error('must not call'); } } });
  assert.equal(inhibited.status, 'FAILED');
  assert.equal(await claimStore.get(Executor.artifactClaimKey('law', 'law-artifact-1')), null);
  assert.equal(await claimStore.get(Executor.contentClaimKey('law', 'retryable domain artifact')), null);
  var retried = await Executor.execute({ store: claimStore, spec: claimSpec, now: 5001,
    motorAuthorization: freshMotor,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return { ok: true, providerCalled: true,
      uri: 'at://did/app.bsky.feed.post/retry', cid: 'retry-cid', url: 'https://bsky.app/post/retry' }; } } });
  assert.equal(retried.status, 'POSTED');
  var equivalentSpec = artifactSpec('law', 'retryable domain artifact', 'law-artifact-2', 5002);
  var contentDuplicate = await Executor.execute({ store: claimStore, spec: equivalentSpec, now: 5002,
    motorAuthorization: freshMotor, platform: platform });
  assert.equal(contentDuplicate.reason, 'domain-commercial-public-content-already-distributed-or-claimed');

  var cleanupStore = new Store(), deleteFailures = 1, cleanupMotor = 0;
  cleanupStore.deleteIfValue = async function (key, value) {
    if (deleteFailures-- > 0) throw new Error('transient redis delete failure');
    return Store.prototype.deleteIfValue.call(this, key, value);
  };
  var cleanupAuthorization = { authorize: async function () { cleanupMotor++; return { authorized: true,
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'cleanup-' + cleanupMotor }; } };
  var cleanupSpec = artifactSpec('finance', 'recover cleanup claim', 'finance-cleanup-artifact', 6000);
  var cleanupHeld = await Executor.execute({ store: cleanupStore, spec: cleanupSpec, now: 6000,
    motorAuthorization: cleanupAuthorization,
    adapterGuard: { checkpoint: async function () { throw inhibitedError; } }, platform: platform });
  assert.equal(cleanupHeld.status, 'FAILED');
  assert(await cleanupStore.get(Executor.contentClaimKey('finance', 'recover cleanup claim')),
    'a simulated transient delete leaves one claim for recovery');
  var cleanupRecovered = await Executor.execute({ store: cleanupStore, spec: cleanupSpec, now: 6001,
    motorAuthorization: cleanupAuthorization,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return { ok: true, providerCalled: true,
      uri: 'at://did/app.bsky.feed.post/cleanup', cid: 'cleanup-cid', url: 'https://bsky.app/post/cleanup' }; } } });
  assert.equal(cleanupRecovered.status, 'POSTED', 'next command reconciles a claim owned by a definitive pre-provider failure');

  var rejectedStore = new Store(), rejectedMotor = 0;
  var rejectedAuthorization = { authorize: async function () { rejectedMotor++; return { authorized: true,
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'rejected-' + rejectedMotor }; } };
  var rejectedSpec = artifactSpec('technology', 'confirmed provider rejection', 'technology-rejected-artifact', 7000);
  var rejected = await Executor.execute({ store: rejectedStore, spec: rejectedSpec, now: 7000,
    motorAuthorization: rejectedAuthorization,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return { ok: false, providerCalled: true,
      definitiveFailure: true, reason: 'provider returned 400' }; } } });
  assert.equal(rejected.status, 'FAILED');
  assert.equal(await rejectedStore.get(Executor.artifactClaimKey('technology', 'technology-rejected-artifact')), null);
  assert.equal(await rejectedStore.get(Executor.contentClaimKey('technology', 'confirmed provider rejection')), null);
  var rejectedRetry = await Executor.execute({ store: rejectedStore, spec: rejectedSpec, now: 7001,
    motorAuthorization: rejectedAuthorization,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return { ok: true, providerCalled: true,
      uri: 'at://did/app.bsky.feed.post/rejected-retry', cid: 'rejected-retry-cid',
      url: 'https://bsky.app/post/rejected-retry' }; } } });
  assert.equal(rejectedRetry.status, 'POSTED', 'confirmed non-publication releases claims for a corrected retry');

  var journalStore = new Store(), commandWriteFailures = 1;
  var journalSet = journalStore.set;
  journalStore.set = async function (key, value) {
    if (key.indexOf(Executor.KEY_PREFIX) === 0 && value && value.status === 'FAILED' && commandWriteFailures-- > 0) {
      throw new Error('transient command resolution write failure');
    }
    return journalSet.call(this, key, value);
  };
  var journalSpec = artifactSpec('culture', 'durable definitive result', 'culture-definitive-artifact', 8000);
  var journalFailure = await Executor.execute({ store: journalStore, spec: journalSpec, now: 8000,
    motorAuthorization: freshMotor,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return { ok: false, providerCalled: true,
      definitiveFailure: true, reason: 'provider returned 400' }; } } });
  assert.equal(journalFailure.status, 'FAILED');
  var journalCommandId = (await journalStore.get(Executor.definitiveKey(
    Array.from(journalStore.map.values()).find(function (row) { return row && row.definitiveFailure; }).commandId))).commandId;
  assert.equal((await journalStore.get(Executor.commandKey(journalCommandId))).status, 'FAILED',
    'fallback completes the command transition after the first resolution write fails');
  assert.equal(await journalStore.get(Executor.artifactClaimKey('culture', 'culture-definitive-artifact')), null);
  assert.equal(await journalStore.get(Executor.contentClaimKey('culture', 'durable definitive result')), null);

  var journalWriteStore = new Store(), journalFailures = 1;
  var journalWriteSet = journalWriteStore.set;
  journalWriteStore.set = async function (key, value) {
    if (key.indexOf(Executor.DEFINITIVE_PREFIX) === 0 && journalFailures-- > 0) {
      throw new Error('transient definitive journal failure');
    }
    return journalWriteSet.call(this, key, value);
  };
  var journalWriteSpec = artifactSpec('education', 'journal fallback result', 'education-journal-artifact', 8500);
  var journalWriteFailure = await Executor.execute({ store: journalWriteStore, spec: journalWriteSpec, now: 8500,
    motorAuthorization: freshMotor,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return { ok: false, providerCalled: true,
      definitiveFailure: true, reason: 'provider returned 400' }; } } });
  assert.equal(journalWriteFailure.status, 'FAILED');
  assert.equal(await journalWriteStore.get(Executor.artifactClaimKey('education', 'education-journal-artifact')), null,
    'in-memory definitive classification releases the artifact when the journal itself is transiently unavailable');
  assert.equal(await journalWriteStore.get(Executor.contentClaimKey('education', 'journal fallback result')), null);

  var expiryStore = new Store(), expiryCalls = 0;
  var expirySpec = artifactSpec('law', 'expires during durable setup', 'law-expiring-artifact', 9000);
  expirySpec.decisionReceipt.expiresAt = 9001;
  expirySpec.domainDecisionReceipt.expiresAt = 9001;
  var expiryResult = await ExecutorModule.execute({ store: expiryStore, spec: expirySpec, now: 9000,
    nowFn: function () { return 9002; }, motorAuthorization: freshMotor,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { expiryCalls++; } } });
  assert.equal(expiryResult.reason, 'communication-social-authority-expired-before-dispatch');
  assert.equal(expiryCalls, 0, 'expired subject/Communication authority is rechecked at the provider boundary');

  console.log('communication social executor: B10 authorization, pre-dispatch durable command, strict receipt readback, idempotency, and ambiguous-failure no-retry passed');
})().catch(function (error) { console.error(error); process.exit(1); });
