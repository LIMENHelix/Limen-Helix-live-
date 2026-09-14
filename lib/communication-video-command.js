'use strict';

/** Durable B14/efference command for an exact dual-brain video release. */

var crypto = require('node:crypto');
var Contracts = require('./domain-commercial-contracts.js');
var Video = require('./domain-commercial-video-manifest.js');
var Release = require('./domain-commercial-video-release.js');

var SCHEMA = 'communication-video-command/1.0';
var LOG_KEY = 'communication_video_command_log';
var PENDING_KEY = 'communication_video_pending_log';
var KEY_PREFIX = 'communication_video_command:';
var CONTENT_PREFIX = 'communication_video_content_claim:';
var QUEUE_PREFIX = 'communication_video_queue_index:';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(id) { return KEY_PREFIX + String(id); }
function contentKey(domain, publicContentHash) { return CONTENT_PREFIX + domain + ':' + publicContentHash; }
function queueKey(id) { return QUEUE_PREFIX + String(id); }
function pendingItem(command) {
  return { schemaVersion: SCHEMA, commandId: command.commandId,
    subjectDomain: command.subjectDomain, manifestId: command.manifestId,
    commandedAt: command.commandedAt, expiresAt: command.expiresAt };
}
function publicResult(command, duplicate) {
  return { ok: true, status: command.status, commandId: command.commandId,
    subjectDomain: command.subjectDomain, manifestId: command.manifestId,
    duplicate: duplicate === true, rendererCalled: false, uploaderCalled: false,
    providerCalled: false, externalEffectAuthorized: false, liveMoney: false };
}
async function appendOnce(store, command) {
  var indexes = [
    { suffix: ':pending', list: PENDING_KEY, row: pendingItem(command), stop: 9999 },
    { suffix: ':log', list: LOG_KEY, row: command, stop: 999 }
  ];
  for (var i = 0; i < indexes.length; i++) {
    var item = indexes[i];
    var markerKey = queueKey(command.commandId) + item.suffix;
    var claim = { schemaVersion: SCHEMA, commandId: command.commandId,
      index: item.suffix.slice(1), status: 'INDEXING' };
    var done = Object.assign({}, claim, { status: 'INDEXED', indexedAt: Date.now() });
    await store.setIfAbsent(markerKey, claim);
    var marker = await store.get(markerKey);
    if (marker && marker.status === 'INDEXING' && marker.commandId === command.commandId) {
      await store.indexListMemberIfValue(markerKey, marker, item.list, item.row, item.stop, done);
      marker = await store.get(markerKey);
    }
    if (!marker || marker.commandId !== command.commandId || marker.status !== 'INDEXED') {
      throw new Error('communication video ' + item.suffix.slice(1) + ' index readback invalid');
    }
  }
}
async function prepare(store, subjectReceipt, channelReceipt, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var domain = subjectReceipt && subjectReceipt.productDomain;
  var contract = Contracts.get(domain);
  if (!contract) return { ok: true, status: 'NO_ACTION', reason: 'communication-video-subject-domain-invalid',
    rendererCalled: false, uploaderCalled: false, providerCalled: false, liveMoney: false };
  try {
    store.assertDurable();
    var rows = await Promise.all([store.get(contract.stateKey), store.get(contract.artifactStateKey),
      store.get(contract.videoManifestStateKey)]);
    var state = rows[0], artifact = rows[1], manifest = rows[2];
    if (!Release.currentPair(contract, state, artifact, manifest, now) ||
        !Release.validSubject(subjectReceipt, contract, manifest, now) ||
        !Release.validChannel(channelReceipt, subjectReceipt, manifest, now)) {
      return { ok: true, status: 'NO_ACTION', reason: 'communication-video-dual-release-invalid-or-stale',
        rendererCalled: false, uploaderCalled: false, providerCalled: false, liveMoney: false };
    }
    var commandId = 'cvc_' + hash({ manifest: manifest.manifestId,
      subjectDecision: subjectReceipt.decisionReceiptId,
      channelDecision: channelReceipt.decisionReceiptId,
      publicContentHash: manifest.publicContentHash }).slice(0, 24);
    var command = {
      schemaVersion: SCHEMA, commandId: commandId, status: 'AWAITING_LOCAL_RENDERER',
      productDomain: 'communication', ownerDomain: 'communication', lane: 'video-publication',
      subjectDomain: domain, subjectOwnerDomain: contract.ownerDomain,
      manifestId: manifest.manifestId, sourceArtifactId: manifest.sourceArtifactId,
      sourceIntentId: manifest.sourceIntentId, sourcePacketId: manifest.sourcePacketId,
      publicContentHash: manifest.publicContentHash,
      subjectDecisionReceiptId: subjectReceipt.decisionReceiptId,
      channelDecisionReceiptId: channelReceipt.decisionReceiptId,
      workOrder: manifest,
      predictedOutcome: { localRender: 'BYTE_IDENTICAL_TO_MANIFEST', youtubeRecord: 'PRESENT',
        independentReadback: 'MATCHES_EXACT_TITLE_AND_CONTENT_HASH' },
      homology: { afferentPacket: manifest.sourcePacketId, domainSelection: subjectReceipt.decisionReceiptId,
        channelSelection: channelReceipt.decisionReceiptId, motorCommand: commandId,
        efferenceCopy: manifest.publicContentHash, reafference: 'AWAITING_LOCAL_RENDER_AND_PLATFORM_OBSERVATION' },
      commandedAt: now, expiresAt: Math.min(Number(subjectReceipt.expiresAt), Number(channelReceipt.expiresAt),
        Number(manifest.expiresAt)),
      externalEffectAuthorized: false, rendererCalled: false, uploaderCalled: false,
      providerCalled: false, liveMoney: false, spendUsd: 0
    };
    var claim = { schemaVersion: SCHEMA, claimType: 'PUBLIC_CONTENT', commandId: commandId,
      subjectDomain: domain, publicContentHash: manifest.publicContentHash, claimedAt: now };
    var cKey = contentKey(domain, manifest.publicContentHash);
    var claimed = await store.setIfAbsent(cKey, claim);
    var restoredClaim = await store.get(cKey);
    if (!restoredClaim || restoredClaim.publicContentHash !== manifest.publicContentHash) {
      throw new Error('communication video content claim readback invalid');
    }
    if (!claimed && restoredClaim.commandId !== commandId) {
      return { ok: true, status: 'NO_ACTION', reason: 'domain-video-public-content-already-commanded',
        priorCommandId: restoredClaim.commandId || null, subjectDomain: domain, manifestId: manifest.manifestId,
        rendererCalled: false, uploaderCalled: false, providerCalled: false, liveMoney: false };
    }
    var created = await store.setIfAbsent(key(commandId), command);
    var restored = await store.get(key(commandId));
    if (!restored || restored.schemaVersion !== SCHEMA || restored.commandId !== commandId ||
        restored.manifestId !== manifest.manifestId || restored.publicContentHash !== manifest.publicContentHash ||
        restored.subjectDecisionReceiptId !== subjectReceipt.decisionReceiptId ||
        restored.channelDecisionReceiptId !== channelReceipt.decisionReceiptId) {
      if (claimed) await store.deleteIfValue(cKey, claim).catch(function () {});
      throw new Error('communication video command readback invalid');
    }
    await appendOnce(store, restored);
    return publicResult(restored, !created);
  } catch (error) {
    return { ok: false, status: 'FAILED', reason: 'communication-video-command-persistence-failed',
      detail: String(error && error.message || error), subjectDomain: domain || null,
      rendererCalled: false, uploaderCalled: false, providerCalled: false,
      externalEffectAuthorized: false, liveMoney: false };
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_KEY: PENDING_KEY,
  KEY_PREFIX: KEY_PREFIX, CONTENT_PREFIX: CONTENT_PREFIX, QUEUE_PREFIX: QUEUE_PREFIX,
  key: key, contentKey: contentKey, queueKey: queueKey, prepare: prepare,
  pendingItem: pendingItem, appendOnce: appendOnce, hash: hash };
