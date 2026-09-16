#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Contracts = require('../lib/domain-commercial-contracts.js');
var Reflex = require('../lib/domain-commercial-reflex.js');
var Video = require('../lib/domain-commercial-video-manifest.js');
var Release = require('../lib/domain-commercial-video-release.js');
var Command = require('../lib/communication-video-command.js');
var Cycle = require('../handlers/communication-video-cycle.js');
var Bridge = require('../lib/communication-video-render-bridge.js');
var Upload = require('../lib/communication-video-upload-bridge.js');
var WorkHandler = require('../handlers/communication-video-work.js');
var UploadHandler = require('../handlers/communication-video-upload-work.js');

function Store() { this.values = Object.create(null); this.lists = Object.create(null); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] == null ? null : JSON.parse(JSON.stringify(this.values[key])); };
Store.prototype.set = async function (key, value) { this.values[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values[key] != null) return false; return this.set(key, value); };
Store.prototype.deleteIfValue = async function (key, expected) {
  if (JSON.stringify(this.values[key]) !== JSON.stringify(expected)) return 0; delete this.values[key]; return 1;
};
Store.prototype.replaceIfValue = async function (key, expected, value) {
  if (JSON.stringify(this.values[key]) !== JSON.stringify(expected)) return false; return this.set(key, value);
};
Store.prototype.lpush = async function (key, value) {
  (this.lists[key] || (this.lists[key] = [])).unshift(JSON.parse(JSON.stringify(value))); return this.lists[key].length;
};
Store.prototype.ltrim = async function (key, start, stop) { this.lists[key] = (this.lists[key] || []).slice(start, stop + 1); return true; };
Store.prototype.lrange = async function (key, start, stop) { var rows = this.lists[key] || []; return JSON.parse(JSON.stringify(rows.slice(start, stop < 0 ? undefined : stop + 1))); };
Store.prototype.lrem = async function (key, count, value) {
  var encoded = JSON.stringify(value), removed = 0;
  this.lists[key] = (this.lists[key] || []).filter(function (row) {
    if ((count === 0 || removed < count) && JSON.stringify(row) === encoded) { removed++; return false; }
    return true;
  });
  return removed;
};
Store.prototype.indexListMemberIfValue = async function (lockKey, lockValue, listKey, value, stop, replacement) {
  if (JSON.stringify(this.values[lockKey]) !== JSON.stringify(lockValue)) return false;
  await this.lrem(listKey, 0, value); await this.lpush(listKey, value); await this.ltrim(listKey, 0, stop);
  await this.set(lockKey, replacement); return true;
};
Store.prototype.setIfSourcesAndCurrent = async function (sourceKeyOne, sourceValueOne, sourceKeyTwo, sourceValueTwo,
  key, expectedValue, value) {
  if (JSON.stringify(this.values[sourceKeyOne]) !== JSON.stringify(sourceValueOne) ||
      JSON.stringify(this.values[sourceKeyTwo]) !== JSON.stringify(sourceValueTwo) ||
      JSON.stringify(this.values[key] == null ? null : this.values[key]) !== JSON.stringify(expectedValue)) return false;
  return this.set(key, value);
};

function feedEvidence(domain, now) {
  return [{ sourceIdentity: { kind: 'url', value: 'https://example.com/' + domain },
    title: 'Publisher reports a current change in the ' + domain + ' domain', publisher: 'Example Wire',
    feedName: 'example-wire', sourceUpdatedAt: new Date(now - 5000).toISOString(),
    canonicalUrl: 'https://example.com/' + domain }];
}
function evidenceFingerprint(domain, now) {
  return Release.hash(Reflex.selectEvidence(feedEvidence(domain, now), now)
    .map(function (row) { return row.sourceIdentity; }));
}
function brain(runtimeDomain, packetDomain, now) {
  return { ts: now - 1000, c: { domain: runtimeDomain,
    immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', packetId: packetDomain + '-current-packet',
      domainId: packetDomain, sourceType: 'server-cognition-refresh', generatedAt: new Date(now - 1000).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { stressScore: 0.72, activeDiagnoses: ['pressure'], feedHealth: { live: 3 },
        semanticEvidence: feedEvidence(packetDomain, now) } } } };
}
function source(domain, now) {
  var contract = Contracts.get(domain), intentId = domain + '-video-intent', packetId = domain + '-source-packet';
  var state = { schemaVersion: 'domain-commercial-reflex/1.0', status: 'PLANNED', readbackVerified: true,
    productDomain: domain, ownerDomain: contract.ownerDomain, priority: 0.78, lastPlannedIntentId: intentId,
    evidenceFingerprint: evidenceFingerprint(domain, now), lastStress: 0.72,
    homology: { interoception: { stress: 0.72, delta: 0.08 } },
    intent: { intentId: intentId, sourcePacketId: packetId, selectedProgram: 'SHORT_VIDEO', plannedAt: now - 2000 } };
  var artifact = { schemaVersion: 'domain-commercial-artifact/1.0', status: 'ARTIFACT_PREPARED',
    artifactId: domain + '-video-artifact', productDomain: domain, ownerDomain: contract.ownerDomain,
    intentId: intentId, sourcePacketId: packetId, evidenceFingerprint: state.evidenceFingerprint,
    targetProgram: 'SHORT_VIDEO', sourceStress: 0.72, sourcePlannedAt: now - 2000, contentHash: 'a'.repeat(64),
    preparedAt: now - 1000, freshnessExpiresAt: now + 3600000, externalEffectAuthorized: false,
    sourceLedger: [{ sourceIdentity: { kind: 'url', value: 'https://example.com/' + domain },
      title: 'Publisher reports a current change in the ' + domain + ' domain', publisher: 'Example Wire',
      sourceUrl: 'https://example.com/' + domain, authority: 'publisher-title-observed-by-feed', fullTextVerified: false }] };
  return { contract: contract, state: state, artifact: artifact };
}
function response() { return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; },
  end: function (value) { this.body = value; } }; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function setupCommand(now) {
  var store = new Store(), row = source('finance', now);
  await store.set(row.contract.stateKey, row.state); await store.set(row.contract.artifactStateKey, row.artifact);
  var manifest = await Video.persist(store, row.contract, Video.build(row.contract, row.state, row.artifact, now));
  var cognition = { finance: brain('finance', 'finance', now), communication: brain('communication', 'communication', now) };
  var subject = await Release.releaseSubject(store, 'finance', now, { cognition: cognition });
  var channel = await Release.releaseChannel(store, subject, now, { cognition: cognition });
  var command = await Command.prepare(store, subject, channel, now);
  return { store: store, row: row, manifest: manifest, cognition: cognition, subject: subject,
    channel: channel, command: command,
    commandRecord: await store.get(Command.key(command.commandId)) };
}
function renderBody(commandId, leaseToken, extra) {
  return Object.assign({
    commandId: commandId, leaseToken: leaseToken,
    rendererId: 'limen-local-abstract-video/1', localPath: 'C:/LIMEN/rendered/' + commandId + '.mp4',
    fileSha256: 'b'.repeat(64), byteLength: 120000, durationSeconds: 23,
    narrationAltered: false, worldFactsAdded: false,
    uploaderCalled: false, providerCalled: false, externalEffectAuthorized: false, spendUsd: 0
  }, extra || {});
}

(async function () {
  var now = Date.now(), store = new Store(), row = source('finance', now);
  await store.set(row.contract.stateKey, row.state); await store.set(row.contract.artifactStateKey, row.artifact);
  var built = Video.build(row.contract, row.state, row.artifact, now);
  await Video.persist(store, row.contract, built);
  var cognition = { finance: brain('finance', 'finance', now), communication: brain('communication', 'communication', now) };

  var subject = await Release.releaseSubject(store, 'finance', now, { cognition: cognition });
  assert.equal(subject.status, 'RELEASED');
  assert.equal(subject.homology.interoceptiveStress, 0.72);
  assert.equal(subject.channel, 'communication:youtube');
  var channel = await Release.releaseChannel(store, subject, now, { cognition: cognition });
  assert.equal(channel.status, 'RELEASED'); assert.equal(channel.subjectDomain, 'finance');
  assert(channel.expiresAt <= subject.expiresAt);

  // Blocker 1: Communication channel authority is an exact Communication-owned
  // selection receipt, never a generic internal emission count.
  var selection = await store.get(Release.selectionKey(channel.selectionReceiptId));
  assert.equal(Release.validSelection(selection, subject, built.manifest, now), true,
    'the channel release is backed by a durable exact Communication-owned selection');
  var noEmission = brain('communication', 'communication', now);
  noEmission.c.brainOrgans.autonomousInternalEmission = { holdReason: null, emittedCount: 0 };
  var reselected = await Release.releaseChannel(store, subject, now,
    { cognition: { finance: cognition.finance, communication: noEmission } });
  assert.equal(reselected.status, 'RELEASED', 'a zero emission count does not block an exact selection');
  var unrelatedEmission = clone(channel); unrelatedEmission.selectionReceiptId = 'cvs_' + 'ab'.repeat(12);
  assert.equal(Release.validChannel(unrelatedEmission, subject, built.manifest, now), false,
    'an unrelated internal emission is not channel authority for this manifest');
  assert.equal(Release.validChannel(channel, subject, built.manifest, now), true);
  var wrongHash = clone(channel); wrongHash.publicContentHash = 'c'.repeat(64);
  assert.equal(Release.validChannel(wrongHash, subject, built.manifest, now), false,
    'a wrong content hash cannot release');
  var wrongSubject = clone(channel); wrongSubject.subjectDomain = 'science';
  assert.equal(Release.validChannel(wrongSubject, subject, built.manifest, now), false,
    'a wrong subject domain cannot release');
  var wrongLane = clone(channel); wrongLane.lane = 'social';
  assert.equal(Release.validChannel(wrongLane, subject, built.manifest, now), false,
    'a wrong lane cannot release');
  var wrongChannelName = clone(channel); wrongChannelName.channel = 'communication:bluesky';
  assert.equal(Release.validChannel(wrongChannelName, subject, built.manifest, now), false,
    'a wrong channel cannot release');
  assert.equal(Release.validChannel(channel, subject, built.manifest, Number(channel.expiresAt) + 1), false,
    'an expired channel selection cannot release');

  var command = await Command.prepare(store, subject, channel, now);
  assert.equal(command.status, 'AWAITING_LOCAL_RENDERER');
  var restored = await store.get(Command.key(command.commandId));
  assert.equal(restored.workOrder.publicContentHash, built.manifest.publicContentHash);
  assert.equal(restored.selectionReceiptId, channel.selectionReceiptId);
  assert.equal(restored.externalEffectAuthorized, false);
  assert.equal(restored.rendererCalled, false); assert.equal(restored.uploaderCalled, false);
  var duplicate = await Command.prepare(store, subject, channel, now + 1);
  assert.equal(duplicate.commandId, command.commandId); assert.equal(duplicate.duplicate, true);
  assert.equal((await store.lrange(Command.PENDING_KEY, 0, -1)).length, 1);

  // Blocker 1: an exact selection for manifest A cannot release manifest B.
  var otherStore = new Store(), other = source('finance', now);
  other.artifact = clone(other.artifact);
  other.artifact.artifactId = 'finance-video-artifact-b';
  other.artifact.sourceLedger[0].title = 'An entirely different finance feed title';
  await otherStore.set(other.contract.stateKey, other.state);
  await otherStore.set(other.contract.artifactStateKey, other.artifact);
  var builtB = await Video.persist(otherStore, other.contract, Video.build(other.contract, other.state, other.artifact, now));
  assert.notEqual(builtB.manifestId, built.manifest.manifestId);
  var crossPrepare = await Command.prepare(otherStore, subject, channel, now);
  assert.equal(crossPrepare.status, 'NO_ACTION',
    'receipts bound to manifest A cannot command manifest B');

  // Blocker 2: the subject release is bound to current cognition content, not
  // merely to cognition freshness.
  var driftedStress = brain('finance', 'finance', now);
  driftedStress.c.serverPacket.truth.stressScore = 0.9;
  assert.equal((await Release.releaseSubject(store, 'finance', now, { cognition: { finance: driftedStress } })).reason,
    'subject-domain-cognition-drifted-from-artifact', 'changed current stress cannot release an older artifact');
  var driftedEvidence = brain('finance', 'finance', now);
  driftedEvidence.c.serverPacket.truth.semanticEvidence = [{ sourceIdentity: { kind: 'url', value: 'https://example.com/finance/other' },
    title: 'Unrelated evidence', publisher: 'Other Wire', feedName: 'other-wire',
    sourceUpdatedAt: new Date(now - 4000).toISOString(), canonicalUrl: 'https://example.com/finance/other' }];
  assert.equal((await Release.releaseSubject(store, 'finance', now, { cognition: { finance: driftedEvidence } })).reason,
    'subject-domain-cognition-drifted-from-artifact', 'changed source evidence cannot release an older artifact');
  var freshEquivalent = brain('finance', 'finance', now);
  freshEquivalent.c.serverPacket.packetId = 'finance-refreshed-equivalent-packet';
  assert.equal((await Release.releaseSubject(store, 'finance', now, { cognition: { finance: freshEquivalent } })).status,
    'RELEASED', 'a fresh packet with identical stress and evidence remains releaseable');
  var staleCognition = brain('finance', 'finance', now);
  staleCognition.ts = now - 60 * 60 * 1000;
  staleCognition.c.serverPacket.generatedAt = new Date(now - 60 * 60 * 1000).toISOString();
  assert.equal((await Release.releaseSubject(store, 'finance', now, { cognition: { finance: staleCognition } })).reason,
    'subject-domain-cognition-missing-or-stale', 'stale cognition cannot release');
  var advancedStore = new Store(), advanced = source('finance', now);
  advanced.state = clone(advanced.state);
  advanced.state.intent.intentId = 'finance-newer-intent';
  advanced.state.lastPlannedIntentId = 'finance-newer-intent';
  await advancedStore.set(advanced.contract.stateKey, advanced.state);
  await advancedStore.set(advanced.contract.artifactStateKey, advanced.artifact);
  assert.equal((await Release.releaseSubject(advancedStore, 'finance', now,
    { cognition: { finance: cognition.finance } })).reason, 'subject-domain-video-work-order-not-current',
    'an advanced source plan cannot release the superseded work order');

  var work = await Bridge.claim(store, 'thinkpad-media', now + 2);
  assert.equal(work.status, 'WORK_AVAILABLE'); assert.equal(work.commandId, command.commandId);
  assert.equal(work.scope.renderLocalFile, true); assert.equal(work.scope.uploadToYouTube, false);
  assert.equal(work.workOrder.publicContentHash, built.manifest.publicContentHash);
  assert.equal((await Bridge.claim(store, 'second-worker', now + 3)).status, 'NO_WORK',
    'an exact work order has one active renderer lease');
  var wrongDuration = await Bridge.complete(store, 'thinkpad-media',
    renderBody(command.commandId, work.leaseToken, { durationSeconds: 28 }), now + 500);
  assert.equal(wrongDuration.status, 'REFUSED', 'render duration must match the exact work order');
  var rendered = await Bridge.complete(store, 'thinkpad-media',
    renderBody(command.commandId, work.leaseToken), now + 1000);
  assert.equal(rendered.status, 'RENDERED_LOCAL'); assert.equal(rendered.uploadAuthorized, false);
  assert.equal((await store.lrange(Command.PENDING_KEY, 0, -1)).length, 0,
    'completed local render leaves no stale pending motor command');
  assert.equal((await store.get(Command.key(command.commandId))).providerCalled, false);
  assert.equal((await Bridge.complete(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: work.leaseToken
  }, now + 1001)).duplicate, true, 'receipt retry is idempotent');
  assert.equal((await store.lrange(Bridge.RECEIPT_LOG, 0, -1)).length, 1,
    'render receipt provenance is indexed exactly once');
  assert.equal((await store.lrange(Bridge.UPLOAD_PENDING_LOG, 0, -1)).length, 1,
    'verified local render enters the separate upload motor queue');

  var uploadHeld = await Upload.claim(store, 'thinkpad-media', now + 1002,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '0' });
  assert.equal(uploadHeld.status, 'HELD');
  assert.equal(uploadHeld.externalEffectAuthorized, false);
  var guard = { checkpoint: async function (_store, valveId, effect) {
    assert.equal(valveId, 'communication:youtube');
    assert.equal(effect, 'youtube-private-video-upload');
    return { allowed: true, valveId: valveId, effect: effect, receiptId: 'valve-open' };
  } };
  var upload = await Upload.claim(store, 'thinkpad-media', now + 1003,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' }, { adapterGuard: guard, cognition: cognition });
  assert.equal(upload.status, 'WORK_AVAILABLE');
  assert.equal(upload.scope.uploadToYouTube, true);
  assert.equal(upload.scope.privacyStatus, 'private');
  assert.equal(upload.scope.publishPublicly, false);
  assert.equal(upload.scope.providerPreflightRequired, true);
  assert.equal(upload.externalEffectAuthorized, false,
    'a queue claim is not provider-call authority');
  assert.equal(upload.fileSha256, 'b'.repeat(64));
  assert.equal((await Upload.claim(store, 'second-worker', now + 1004,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' }, { adapterGuard: guard, cognition: cognition })).status, 'NO_WORK');
  var preflight = await Upload.preflight(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: upload.leaseToken
  }, now + 1005, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: cognition });
  assert.equal(preflight.status, 'PROVIDER_CALL_AUTHORIZED');
  assert.equal(preflight.privacyStatus, 'private');
  var recoveredPreflight = await Upload.preflight(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: upload.leaseToken
  }, now + 1006, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: cognition });
  assert.equal(recoveredPreflight.providerPermitToken, preflight.providerPermitToken,
    'an armed command recovers the exact permit after a lost preflight response');
  assert.equal(recoveredPreflight.authorizationId, preflight.authorizationId);
  var receiptBody = {
    commandId: command.commandId, leaseToken: upload.leaseToken,
    authorizationId: preflight.authorizationId, providerPermitToken: preflight.providerPermitToken,
    fileSha256: upload.fileSha256, videoId: 'ytVideo_123',
    privacyStatus: 'private', title: upload.metadata.title,
    description: upload.metadata.description, tags: [], categoryId: '27', uploadStatus: 'uploaded',
    readbackVerified: true, quotaUnitsCharged: 1601,
    uploadedAt: now + 1500, providerCalled: true, spendUsd: 0
  };
  var wrongUpload = await Upload.complete(store, 'thinkpad-media',
    Object.assign({}, receiptBody, { title: 'Uploader rewrote the title' }), now + 1500);
  assert.equal(wrongUpload.status, 'REFUSED', 'uploader cannot rewrite domain-selected metadata');
  assert.equal(await store.get(Upload.receiptKey(command.commandId)), null);
  var failedProvider = await Upload.complete(store, 'thinkpad-media',
    Object.assign({}, receiptBody, { uploadStatus: 'failed' }), now + 1500);
  assert.equal(failedProvider.status, 'REFUSED',
    'a failed provider status cannot be recorded as an uploaded video');
  var uploaded = await Upload.complete(store, 'thinkpad-media', receiptBody, now + 1501);
  assert.equal(uploaded.status, 'UPLOADED_PRIVATE');
  assert.equal(uploaded.publiclyVisible, false);
  assert.equal(uploaded.independentOutcomeObserved, false);
  assert.equal((await store.lrange(Bridge.UPLOAD_PENDING_LOG, 0, -1)).length, 0,
    'terminal provider receipt removes the exact upload queue item');
  assert.equal((await store.lrange(Upload.RECEIPT_LOG, 0, -1)).length, 1);
  assert.equal((await Upload.complete(store, 'thinkpad-media',
    { commandId: command.commandId }, now + 1502)).duplicate, true,
    'provider receipt retry is idempotent');
  assert.equal((await Bridge.complete(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: work.leaseToken
  }, now + 1503)).duplicate, true, 'late render receipt retry is idempotent after upload');
  assert.equal((await store.get(Command.key(command.commandId))).status, 'UPLOADED_PRIVATE',
    'late render retry cannot downgrade an uploaded command');
  assert.equal((await store.lrange(Bridge.UPLOAD_PENDING_LOG, 0, -1)).length, 0,
    'late render retry cannot recreate the upload queue entry');

  var terminal = await store.get(Command.key(command.commandId));
  var durableReceipt = await store.get(Upload.receiptKey(command.commandId));
  var armedBeforeTerminal = Object.assign({}, terminal, {
    status: 'PROVIDER_CALL_AUTHORIZED', uploadLease: null,
    platformReceiptId: null, platformReceipt: null, completedPrivateUploadAt: null
  });
  await store.set(Command.key(command.commandId), armedBeforeTerminal);
  await store.lpush(Bridge.UPLOAD_PENDING_LOG, Bridge.uploadPendingItem(armedBeforeTerminal, armedBeforeTerminal.renderReceipt));
  var repairedTerminal = await Upload.complete(store, 'thinkpad-media',
    { commandId: command.commandId }, now + 1504);
  assert.equal(repairedTerminal.duplicate, true);
  assert.equal((await store.get(Command.key(command.commandId))).status, 'UPLOADED_PRIVATE',
    'a durable provider receipt repairs a crash before terminal transition');
  assert.equal((await store.lrange(Bridge.UPLOAD_PENDING_LOG, 0, -1)).length, 0,
    'durable provider receipt recovery removes the stale exact queue item');
  assert.equal((await store.get(Upload.receiptKey(command.commandId))).receiptId, durableReceipt.receiptId);

  var justInTime = await setupCommand(now);
  var justRender = await Bridge.claim(justInTime.store, 'thinkpad-media', now + 10);
  await Bridge.complete(justInTime.store, 'thinkpad-media',
    renderBody(justInTime.command.commandId, justRender.leaseToken), now + 20);
  var justClaim = await Upload.claim(justInTime.store, 'thinkpad-media', now + 30,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' }, { cognition: justInTime.cognition });
  var vetoCognition = clone(justInTime.cognition);
  vetoCognition.communication.c.immune.immuneState = 'alert';
  var vetoedPreflight = await Upload.preflight(justInTime.store, 'thinkpad-media', {
    commandId: justInTime.command.commandId, leaseToken: justClaim.leaseToken
  }, now + 40, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: vetoCognition });
  assert.equal(vetoedPreflight.reason, 'upload-preflight-current-authority-held',
    'current dual-brain vetoes are reread after claim and immediately before provider authorization');
  var closedGuard = { checkpoint: async function () { throw new Error('runtime-valve-closed'); } };
  await assert.rejects(Upload.preflight(justInTime.store, 'thinkpad-media', {
    commandId: justInTime.command.commandId, leaseToken: justClaim.leaseToken
  }, now + 41, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: closedGuard, cognition: justInTime.cognition }), /runtime-valve-closed/);
  assert.equal(await justInTime.store.get(Upload.authKey(justInTime.command.commandId)), null,
    'a preflight valve hold persists no provider authorization');
  var reopenedPreflight = await Upload.preflight(justInTime.store, 'thinkpad-media', {
    commandId: justInTime.command.commandId, leaseToken: justClaim.leaseToken
  }, now + 42, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: justInTime.cognition });
  assert.equal(reopenedPreflight.status, 'PROVIDER_CALL_AUTHORIZED',
    'a never-dispatched valve hold does not permanently suppress a later valid preflight');

  var writeFailure = await setupCommand(now);
  var writeRender = await Bridge.claim(writeFailure.store, 'thinkpad-media', now + 10);
  await Bridge.complete(writeFailure.store, 'thinkpad-media',
    renderBody(writeFailure.command.commandId, writeRender.leaseToken), now + 20);
  var writeClaim = await Upload.claim(writeFailure.store, 'thinkpad-media', now + 30,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' }, { cognition: writeFailure.cognition });
  var normalSetIfAbsent = writeFailure.store.setIfAbsent.bind(writeFailure.store);
  writeFailure.store.setIfAbsent = async function (key, value) {
    if (key === Upload.authKey(writeFailure.command.commandId)) throw new Error('authorization-store-down');
    return normalSetIfAbsent(key, value);
  };
  await assert.rejects(Upload.preflight(writeFailure.store, 'thinkpad-media', {
    commandId: writeFailure.command.commandId, leaseToken: writeClaim.leaseToken
  }, now + 40, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: writeFailure.cognition }), /authorization-store-down/);
  assert.equal((await writeFailure.store.get(Command.key(writeFailure.command.commandId))).status,
    'DISPATCHING_PRIVATE_UPLOAD', 'authorization persistence failure must not strand an armed command');
  writeFailure.store.setIfAbsent = normalSetIfAbsent;
  assert.equal((await Upload.preflight(writeFailure.store, 'thinkpad-media', {
    commandId: writeFailure.command.commandId, leaseToken: writeClaim.leaseToken
  }, now + 41, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: writeFailure.cognition })).status, 'PROVIDER_CALL_AUTHORIZED');

  var expiredPermit = await setupCommand(now);
  var expiredRender = await Bridge.claim(expiredPermit.store, 'thinkpad-media', now + 10);
  await Bridge.complete(expiredPermit.store, 'thinkpad-media',
    renderBody(expiredPermit.command.commandId, expiredRender.leaseToken), now + 20);
  var expiredClaim = await Upload.claim(expiredPermit.store, 'thinkpad-media', now + 30,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' }, { cognition: expiredPermit.cognition });
  var expiredPreflight = await Upload.preflight(expiredPermit.store, 'thinkpad-media', {
    commandId: expiredPermit.command.commandId, leaseToken: expiredClaim.leaseToken
  }, now + 40, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
  { adapterGuard: guard, cognition: expiredPermit.cognition });
  var lateReceipt = Object.assign({}, receiptBody, {
    commandId: expiredPermit.command.commandId, leaseToken: expiredClaim.leaseToken,
    authorizationId: expiredPreflight.authorizationId,
    providerPermitToken: expiredPreflight.providerPermitToken,
    uploadedAt: expiredPreflight.expiresAt
  });
  assert.equal((await Upload.complete(expiredPermit.store, 'thinkpad-media', lateReceipt,
    expiredPreflight.expiresAt)).reason, 'youtube-platform-receipt-invalid',
  'a receipt received outside the complete provider permit interval must be rejected');
  assert.equal(await expiredPermit.store.get(Upload.receiptKey(expiredPermit.command.commandId)), null);

  var staleUnarmed = await setupCommand(now);
  var staleRender = await Bridge.claim(staleUnarmed.store, 'thinkpad-media', now + 10);
  await Bridge.complete(staleUnarmed.store, 'thinkpad-media',
    renderBody(staleUnarmed.command.commandId, staleRender.leaseToken), now + 20);
  var staleClaim = await Upload.claim(staleUnarmed.store, 'thinkpad-media', now + 30,
    { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' }, { cognition: staleUnarmed.cognition });
  var reclaimed = await Upload.claim(staleUnarmed.store, 'thinkpad-media',
    Number(staleClaim.leaseExpiresAt) + 1, { COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
    { cognition: staleUnarmed.cognition });
  assert.equal(reclaimed.status, 'WORK_AVAILABLE');
  assert.notEqual(reclaimed.leaseToken, staleClaim.leaseToken,
    'an expired claim with no provider permit is safely recoverable');
  assert.equal((await staleUnarmed.store.get(Command.key(staleUnarmed.command.commandId))).externalEffectAuthorized,
    false, 'unarmed lease recovery cannot grant provider authority');

  var subjectVeto = brain('finance', 'finance', now); subjectVeto.c.immune.immuneState = 'alert';
  assert.equal((await Release.releaseSubject(store, 'finance', now,
    { cognition: { finance: subjectVeto } })).reason, 'subject-domain-immune-veto');
  var commVeto = brain('communication', 'communication', now); commVeto.c.awareness.humanReviewRequired = true;
  assert.equal((await Release.releaseChannel(store, subject, now,
    { cognition: { finance: cognition.finance, communication: commVeto } })).reason, 'communication-video-b10-held');

  var aliasStore = new Store(), alias = source('science', now);
  await aliasStore.set(alias.contract.stateKey, alias.state); await aliasStore.set(alias.contract.artifactStateKey, alias.artifact);
  await Video.persist(aliasStore, alias.contract, Video.build(alias.contract, alias.state, alias.artifact, now));
  var aliasCognition = { science: brain('research', 'science', now), communication: cognition.communication };
  var aliasSubject = await Release.releaseSubject(aliasStore, 'science', now, { cognition: aliasCognition });
  assert.equal(aliasSubject.status, 'RELEASED', 'product/runtime domain aliases remain exact');

  var cycle = await Cycle.run({ store: store, now: now, cognition: cognition });
  assert.equal(cycle.domains, 20); assert.equal(cycle.commanded, 0); assert.equal(cycle.failed, 0);
  assert.equal(cycle.boundaries.rendererCalled, false); assert.equal(cycle.boundaries.providerCalled, false);

  var handler = WorkHandler.createHandler({ store: store, now: now + 2, env: { MEDIA_WORKER_TOKEN: 'secret' } });
  var denied = response(); await handler({ method: 'GET', headers: { 'x-limen-worker-id': 'thinkpad-media' } }, denied);
  assert.equal(denied.statusCode, 401);
  var noWork = response(); await handler({ method: 'GET', headers: {
    'x-limen-media-worker': 'secret', 'x-limen-worker-id': 'thinkpad-media'
  } }, noWork);
  assert.equal(noWork.statusCode, 200); assert.equal(JSON.parse(noWork.body).status, 'NO_WORK');
  var uploadHandler = UploadHandler.createHandler({ store: store, now: now + 1600,
    env: { MEDIA_WORKER_TOKEN: 'secret', COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
    adapterGuard: guard });
  var uploadDenied = response();
  await uploadHandler({ method: 'GET', headers: { 'x-limen-worker-id': 'thinkpad-media' } }, uploadDenied);
  assert.equal(uploadDenied.statusCode, 401);
  var failureHandler = UploadHandler.createHandler({ store: store, now: now + 1600,
    env: { MEDIA_WORKER_TOKEN: 'secret', COMMUNICATION_VIDEO_UPLOAD_ENABLED: '1' },
    bridge: {
      claim: async function () { throw new Error('claim-failure'); },
      complete: async function () { throw new Error('receipt-persistence-failure'); }
    }
  });
  var claimFailure = response();
  await failureHandler({ method: 'GET', headers: {
    'x-limen-media-worker': 'secret', 'x-limen-worker-id': 'thinkpad-media'
  } }, claimFailure);
  assert.equal(JSON.parse(claimFailure.body).providerCalled, false,
    'failed work claim truthfully proves no provider call was issued');
  var receiptFailure = response();
  await failureHandler({ method: 'POST', headers: {
    'x-limen-media-worker': 'secret', 'x-limen-worker-id': 'thinkpad-media'
  }, body: { commandId: command.commandId } }, receiptFailure);
  var unresolved = JSON.parse(receiptFailure.body);
  assert.equal(unresolved.providerCalled, null,
    'a failed receipt return cannot erase an already-issued provider call');
  assert.equal(unresolved.providerCallStatus, 'UNKNOWN_RECEIPT_RECONCILIATION_REQUIRED');

  // Blocker 3: completion revalidates exact authority; a lease cannot outlive it.
  var expiry = await setupCommand(now);
  var expiryClaim = await Bridge.claim(expiry.store, 'thinkpad-media', now + 9 * 60 * 1000);
  assert.equal(expiryClaim.status, 'WORK_AVAILABLE');
  var expiredComplete = await Bridge.complete(expiry.store, 'thinkpad-media',
    renderBody(expiry.command.commandId, expiryClaim.leaseToken), now + 10 * 60 * 1000 + 1);
  assert.equal(expiredComplete.status, 'REFUSED');
  assert.equal(expiredComplete.reason, 'video-command-authority-expired',
    'completion after command authority expiry is refused even inside a valid lease');
  assert.equal(await expiry.store.get(Bridge.receiptKey(expiry.command.commandId)), null,
    'no receipt is persisted after authority expiry');

  var superseded = await setupCommand(now);
  var supClaim = await Bridge.claim(superseded.store, 'thinkpad-media', now + 1);
  assert.equal(supClaim.status, 'WORK_AVAILABLE');
  delete superseded.store.values[Release.subjectKey('finance', superseded.manifest.manifestId,
    superseded.subject.decisionReceiptId)];
  var supComplete = await Bridge.complete(superseded.store, 'thinkpad-media',
    renderBody(superseded.command.commandId, supClaim.leaseToken), now + 2);
  assert.equal(supComplete.status, 'REFUSED');
  assert.equal(supComplete.reason, 'video-command-authority-superseded-or-stale',
    'completion is refused once the exact authority no longer matches');
  assert.equal(await superseded.store.get(Bridge.receiptKey(superseded.command.commandId)), null,
    'no receipt is persisted after authority is superseded');

  // Blocker 3 recovery rule: a durable valid receipt may repair its command
  // even after authority has since expired.
  var crash = await setupCommand(now);
  var crashClaim = await Bridge.claim(crash.store, 'thinkpad-media', now + 1);
  var crashDone = await Bridge.complete(crash.store, 'thinkpad-media',
    renderBody(crash.command.commandId, crashClaim.leaseToken), now + 2);
  assert.equal(crashDone.status, 'RENDERED_LOCAL');
  var crashedRecord = await crash.store.get(Command.key(crash.command.commandId));
  await crash.store.set(Command.key(crash.command.commandId), Object.assign({}, crashedRecord, {
    status: 'RENDERING_LOCAL', renderReceiptId: null, renderReceipt: null,
    renderLease: { token: 'cvr_crash', workerId: 'thinkpad-media', claimedAt: now + 1, expiresAt: now + 21 * 60 * 1000 } }));
  var recovered = await Bridge.complete(crash.store, 'thinkpad-media',
    { commandId: crash.command.commandId }, now + 10 * 60 * 1000 + 1);
  assert.equal(recovered.duplicate, true,
    'a durable valid receipt repairs its command even after authority expiry');
  assert.equal((await crash.store.get(Command.key(crash.command.commandId))).status, 'RENDERED_LOCAL',
    'crash recovery restores the terminal command state');

  // Blockers 4+5: prohibited-effect attestations and numeric fields are
  // validated, never rewritten, and never persisted when invalid.
  var attest = await setupCommand(now);
  var attestClaim = await Bridge.claim(attest.store, 'thinkpad-media', now + 1);
  assert.equal(attestClaim.status, 'WORK_AVAILABLE');
  var receiptKey = Bridge.receiptKey(attest.command.commandId);
  var violations = [
    { uploaderCalled: true }, { providerCalled: true }, { spendUsd: 0.01 },
    { externalEffectAuthorized: true }, { uploaderCalled: undefined },
    { byteLength: 'Infinity' }, { byteLength: Infinity }, { byteLength: 120000.5 },
    { byteLength: 0 }, { byteLength: -12 }
  ];
  for (var i = 0; i < violations.length; i++) {
    var patch = violations[i];
    var body = renderBody(attest.command.commandId, attestClaim.leaseToken, patch);
    if (patch.uploaderCalled === undefined) delete body.uploaderCalled;
    var refused = await Bridge.complete(attest.store, 'thinkpad-media', body, now + 2 + i);
    assert.equal(refused.status, 'REFUSED', 'violation ' + JSON.stringify(patch) + ' is refused');
    assert.equal(refused.reason, 'render-receipt-invalid');
    assert.equal(await attest.store.get(receiptKey), null,
      'no poisoned receipt persists for ' + JSON.stringify(patch));
  }
  var accepted = await Bridge.complete(attest.store, 'thinkpad-media',
    renderBody(attest.command.commandId, attestClaim.leaseToken), now + 100);
  assert.equal(accepted.status, 'RENDERED_LOCAL',
    'a valid explicit attestation still succeeds after invalid attempts');
  assert.equal(accepted.uploadAuthorized, false);

  console.log('communication video cycle: exact Communication selection, cognition-artifact binding, completion authority revalidation, worker attestation, finite byteLength, aliases, vetoes and no provider PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
