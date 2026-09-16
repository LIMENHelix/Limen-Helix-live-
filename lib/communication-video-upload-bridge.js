'use strict';

/**
 * Communication-owned YouTube motor port.
 *
 * The subject domain already selected the topic from its own current feeds and
 * stress state. Communication already selected the channel. This bridge can
 * only disinhibit one exact rendered file for one private YouTube upload. It
 * never selects a topic, rewrites metadata, makes a video public, or retries an
 * ambiguous provider attempt.
 */

var crypto = require('node:crypto');
var AdapterGuard = require('./civilization-adapter-guard.js');
var Command = require('./communication-video-command.js');
var Render = require('./communication-video-render-bridge.js');
var Release = require('./domain-commercial-video-release.js');
var Distribution = require('./domain-commercial-distribution-decision.js');
var Redis = require('./redis-kv.js');

var AUTH_SCHEMA = 'communication-video-upload-authorization/1.0';
var RECEIPT_SCHEMA = 'communication-video-platform-receipt/1.0';
var AUTH_PREFIX = 'communication_video_upload_authorization:';
var RECEIPT_PREFIX = 'communication_video_platform_receipt:';
var RECEIPT_LOG = 'communication_video_platform_receipt_log';
var RECEIPT_INDEX_PREFIX = 'communication_video_platform_receipt_index:';
var DISPATCH_LEASE_MS = 2 * 60 * 1000;
var PROVIDER_PERMIT_MS = 20 * 1000;
var MAX_QUEUE_SCAN = 500;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function token() { return 'cvul_' + crypto.randomBytes(18).toString('hex'); }
function authKey(commandId) { return AUTH_PREFIX + String(commandId); }
function receiptKey(commandId) { return RECEIPT_PREFIX + String(commandId); }
function receiptIndexKey(commandId) { return RECEIPT_INDEX_PREFIX + String(commandId); }
function enabled(env) { return String((env || process.env).COMMUNICATION_VIDEO_UPLOAD_ENABLED || '') === '1'; }

async function currentDualCognition(authority, command, now, deps) {
  deps = deps || {};
  var read = deps.redisGet || Redis.redisGet;
  var rows = deps.cognition
    ? [deps.cognition.communication, deps.cognition[command.subjectDomain]]
    : await Promise.all([
      read('limen:brain:cognition:communication'),
      read('limen:brain:cognition:' + command.subjectDomain)
    ]);
  var communicationContract = require('./domain-commercial-contracts.js').get('communication');
  if (!Distribution.validCognition(rows[0], communicationContract, now) ||
      !Distribution.validCognition(rows[1], authority.contract, now)) return null;
  var comm = rows[0].c, subject = rows[1].c;
  var commPacket = comm.serverPacket, subjectPacket = subject.serverPacket;
  if (!commPacket || !subjectPacket ||
      commPacket.packetId !== authority.channelReceipt.communicationPacketId ||
      subjectPacket.packetId !== authority.channelReceipt.subjectPacketId ||
      subjectPacket.packetId !== authority.subjectReceipt.currentCognitionPacketId ||
      commPacket.packetId !== authority.selectionReceipt.communicationPacketId ||
      subjectPacket.packetId !== authority.selectionReceipt.subjectPacketId) return null;
  if (!comm.immune || comm.immune.immuneState !== 'clear' ||
      !subject.immune || subject.immune.immuneState !== 'clear' ||
      comm.awareness && comm.awareness.humanReviewRequired === true ||
      subject.awareness && subject.awareness.humanReviewRequired === true) return null;
  var auto = comm.brainOrgans && comm.brainOrgans.autonomousInternalEmission || {};
  if (typeof auto.holdReason === 'string' && auto.holdReason.trim()) return null;
  if (!commPacket.truth || !commPacket.truth.feedHealth || !(Number(commPacket.truth.feedHealth.live) > 0) ||
      !Release.cognitionMatchesArtifact(rows[1], authority.contract,
        authority.state, authority.artifact, now)) return null;
  return { communicationPacketId: commPacket.packetId, subjectPacketId: subjectPacket.packetId };
}

function authorizationValid(value, command, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  return !!(value && command && value.schemaVersion === AUTH_SCHEMA && value.status === 'AUTHORIZED' &&
    value.commandId === command.commandId && value.manifestId === command.manifestId &&
    value.subjectDomain === command.subjectDomain && value.publicContentHash === command.publicContentHash &&
    value.renderReceiptId === command.renderReceiptId && value.fileSha256 === command.renderReceipt.fileSha256 &&
    value.localPath === command.renderReceipt.localPath && value.privacyStatus === 'private' &&
    typeof value.providerPermitToken === 'string' && /^cvup_[a-f0-9]{36}$/.test(value.providerPermitToken) &&
    value.publicPublicationAuthorized === false && value.metadataAlterationAuthorized === false &&
    value.providerCallAuthorized === true && value.externalEffectAuthorized === true &&
    Number.isFinite(Number(value.authorizedAt)) && Number.isFinite(Number(value.expiresAt)) &&
    now >= Number(value.authorizedAt) && now < Number(value.expiresAt) &&
    Number(value.expiresAt) <= Number(command.expiresAt));
}

function armWithAuthorization(command, authorization, guard) {
  return Object.assign({}, command, {
    status: 'PROVIDER_CALL_AUTHORIZED', uploadAuthorizationId: authorization.authorizationId,
    providerPermit: { token: authorization.providerPermitToken,
      authorizedAt: authorization.authorizedAt, expiresAt: authorization.expiresAt },
    uploadAdapterGuard: guard, externalEffectAuthorized: true,
    providerCalled: false, uploaderCalled: false
  });
}

function authorizationResult(command, authorization) {
  return { ok: true, status: 'PROVIDER_CALL_AUTHORIZED', commandId: command.commandId,
    authorizationId: authorization.authorizationId,
    providerPermitToken: authorization.providerPermitToken,
    expiresAt: authorization.expiresAt, privacyStatus: 'private', providerCalled: false,
    externalEffectAuthorized: true, liveMoney: false };
}

function platformReceiptValid(receipt, command) {
  return !!(receipt && command && command.renderReceipt && command.providerPermit &&
    receipt.schemaVersion === RECEIPT_SCHEMA &&
    receipt.status === 'UPLOADED_PRIVATE' && receipt.commandId === command.commandId &&
    receipt.manifestId === command.manifestId && receipt.subjectDomain === command.subjectDomain &&
    receipt.publicContentHash === command.publicContentHash && receipt.fileSha256 === command.renderReceipt.fileSha256 &&
    receipt.authorizationId === command.uploadAuthorizationId &&
    receipt.providerPermitToken === command.providerPermit.token &&
    /^[A-Za-z0-9_-]{6,32}$/.test(String(receipt.videoId || '')) &&
    receipt.privacyStatus === 'private' && receipt.publiclyVisible === false &&
    receipt.title === command.workOrder.title && receipt.description === command.workOrder.description &&
    Array.isArray(receipt.tags) && receipt.tags.length === 0 && receipt.categoryId === '27' &&
    (receipt.uploadStatus === 'uploaded' || receipt.uploadStatus === 'processed') &&
    receipt.readbackVerified === true && receipt.providerCalled === true &&
    receipt.externalEffectAuthorized === true && Number(receipt.spendUsd) === 0 &&
    Number.isFinite(Number(receipt.quotaUnitsCharged)) && Number(receipt.quotaUnitsCharged) >= 1601 &&
    Number(receipt.quotaUnitsCharged) <= 1651 &&
    Number.isFinite(Number(receipt.uploadedAt)) &&
    Number.isFinite(Number(receipt.receivedAt)) &&
    Number(receipt.receivedAt) >= Number(command.providerPermit.authorizedAt) &&
    Number(receipt.receivedAt) < Number(command.providerPermit.expiresAt));
}

async function indexReceipt(store, receipt) {
  var markerKey = receiptIndexKey(receipt.commandId);
  var claim = { schemaVersion: RECEIPT_SCHEMA, status: 'INDEXING', commandId: receipt.commandId,
    receiptId: receipt.receiptId };
  var done = Object.assign({}, claim, { status: 'INDEXED', indexedAt: Date.now() });
  await store.setIfAbsent(markerKey, claim);
  var marker = await store.get(markerKey);
  if (marker && marker.status === 'INDEXING' && marker.receiptId === receipt.receiptId) {
    await store.indexListMemberIfValue(markerKey, marker, RECEIPT_LOG, receipt, 999, done);
    marker = await store.get(markerKey);
  }
  if (!marker || marker.status !== 'INDEXED' || marker.receiptId !== receipt.receiptId) {
    throw new Error('communication video platform receipt index readback invalid');
  }
}

async function recoverUnarmedLease(store, command, now) {
  if (!command || command.status !== 'DISPATCHING_PRIVATE_UPLOAD' || !command.uploadLease ||
      Number(command.uploadLease.expiresAt) > now || command.uploadAuthorizationId || command.providerPermit) {
    return command;
  }
  var recovered = Object.assign({}, command, {
    status: 'RENDERED_LOCAL', uploadLease: null, claimCognition: null,
    uploadAdapterGuard: null, externalEffectAuthorized: false,
    recovery: { reason: 'stale-unarmed-upload-lease', recoveredAt: now }
  });
  return await store.replaceIfValue(Command.key(command.commandId), command, recovered)
    ? recovered : await store.get(Command.key(command.commandId));
}

async function transitionUploaded(store, command, receipt, now) {
  if (command.status === 'UPLOADED_PRIVATE' && command.platformReceiptId === receipt.receiptId) {
    await store.lrem(Render.UPLOAD_PENDING_LOG, 0, Render.uploadPendingItem(command, command.renderReceipt));
    return command;
  }
  if ((command.status !== 'PROVIDER_CALL_AUTHORIZED' && command.status !== 'DISPATCHING_PRIVATE_UPLOAD') ||
      command.uploadAuthorizationId !== receipt.authorizationId) {
    throw new Error('communication video upload recovery state invalid');
  }
  var completed = Object.assign({}, command, { status: 'UPLOADED_PRIVATE', uploadLease: null,
    platformReceiptId: receipt.receiptId, platformReceipt: receipt,
    externalEffectAuthorized: true, uploaderCalled: true, providerCalled: true,
    completedPrivateUploadAt: now });
  if (!await store.replaceIfValue(Command.key(command.commandId), command, completed)) {
    completed = await store.get(Command.key(command.commandId));
    if (!completed || completed.status !== 'UPLOADED_PRIVATE' ||
        completed.platformReceiptId !== receipt.receiptId) {
      throw new Error('communication video upload terminal transition failed');
    }
  }
  await store.lrem(Render.UPLOAD_PENDING_LOG, 0, Render.uploadPendingItem(command, command.renderReceipt));
  return completed;
}

async function claim(store, workerId, nowValue, env, deps) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  deps = deps || {};
  store.assertDurable();
  if (!enabled(env)) return { ok: true, status: 'HELD', reason: 'communication-video-upload-disabled',
    phase: 'upload', providerCalled: false, externalEffectAuthorized: false, liveMoney: false };
  var queued = await store.lrange(Render.UPLOAD_PENDING_LOG, 0, MAX_QUEUE_SCAN - 1);
  for (var i = queued.length - 1; i >= 0; i--) {
    var item = queued[i];
    if (!item || !item.commandId) continue;
    var command = await store.get(Command.key(item.commandId));
    command = await recoverUnarmedLease(store, command, now);
    if (!command || command.status !== 'RENDERED_LOCAL' || !Render.renderReceiptValid(command.renderReceipt, command)) continue;
    var authority = await Render.exactAuthority(store, command, now, ['RENDERED_LOCAL']);
    if (!authority) continue;
    var cognition = await currentDualCognition(authority, command, now, deps);
    if (!cognition) continue;
    var leaseToken = token();
    var dispatching = Object.assign({}, command, {
      status: 'DISPATCHING_PRIVATE_UPLOAD', uploadAuthorizationId: null, providerPermit: null,
      uploadLease: { token: leaseToken, workerId: workerId, claimedAt: now,
        expiresAt: Math.min(now + DISPATCH_LEASE_MS, Number(command.expiresAt)) },
      claimCognition: cognition, uploadAdapterGuard: null,
      externalEffectAuthorized: false, uploaderCalled: false, providerCalled: false
    });
    if (!await store.replaceIfValue(Command.key(command.commandId), command, dispatching)) continue;
    var restored = await store.get(Command.key(command.commandId));
    if (!restored || restored.status !== 'DISPATCHING_PRIVATE_UPLOAD' || !restored.uploadLease ||
        restored.uploadLease.token !== leaseToken || restored.uploadAuthorizationId !== null ||
        restored.externalEffectAuthorized !== false) {
      throw new Error('communication video upload lease readback invalid');
    }
    return { ok: true, status: 'WORK_AVAILABLE', phase: 'upload-private',
      commandId: command.commandId, leaseToken: leaseToken, leaseExpiresAt: dispatching.uploadLease.expiresAt,
      subjectDomain: command.subjectDomain, manifestId: command.manifestId,
      publicContentHash: command.publicContentHash, fileSha256: command.renderReceipt.fileSha256,
      byteLength: command.renderReceipt.byteLength, localPath: command.renderReceipt.localPath,
      metadata: { title: command.workOrder.title, description: command.workOrder.description,
        tags: [], categoryId: '27' },
      scope: { uploadToYouTube: true, privacyStatus: 'private', publishPublicly: false,
        alterMetadata: false, retryAmbiguousProviderAttempt: false, maxQuotaUnits: 1651,
        callOtherProviders: false, providerPreflightRequired: true,
        providerCallAuthorized: false, spendUsd: 0 },
      externalEffectAuthorized: false, providerCalled: false, liveMoney: false };
  }
  return { ok: true, status: 'NO_WORK', phase: 'upload', providerCalled: false,
    externalEffectAuthorized: false, liveMoney: false };
}

async function preflight(store, workerId, body, nowValue, env, deps) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  deps = deps || {};
  store.assertDurable();
  if (!enabled(env)) return { ok: false, status: 'REFUSED', reason: 'communication-video-upload-disabled',
    providerCalled: false, externalEffectAuthorized: false, liveMoney: false };
  var command = await store.get(Command.key(body && body.commandId));
  if (!command) return { ok: false, status: 'REFUSED', reason: 'video-command-not-found' };

  // Idempotent recovery for a response/readback loss after the command was
  // durably armed but before the worker received its permit. The same worker,
  // lease, exact authorization record, current dual cognition, and current
  // valve must all still agree; no new token or provider attempt is created.
  if (command.status === 'PROVIDER_CALL_AUTHORIZED') {
    var existingAuthorization = await store.get(authKey(command.commandId));
    if (!command.uploadLease || command.uploadLease.workerId !== workerId ||
        command.uploadLease.token !== body.leaseToken ||
        !authorizationValid(existingAuthorization, command, now)) {
      return { ok: false, status: 'REFUSED', reason: 'upload-preflight-armed-state-invalid-or-expired',
        providerCalled: null, externalEffectAuthorized: false, liveMoney: false };
    }
    var armedAuthority = await Render.exactAuthority(store, command, now, ['PROVIDER_CALL_AUTHORIZED']);
    if (!armedAuthority || !await currentDualCognition(armedAuthority, command, now, deps)) {
      return { ok: false, status: 'REFUSED', reason: 'upload-preflight-current-authority-held',
        providerCalled: false, externalEffectAuthorized: false, liveMoney: false };
    }
    await (deps.adapterGuard || AdapterGuard).checkpoint(store,
      'communication:youtube', 'youtube-private-video-upload', now);
    return authorizationResult(command, existingAuthorization);
  }
  if (command.status !== 'DISPATCHING_PRIVATE_UPLOAD' || !command.uploadLease ||
      command.uploadLease.workerId !== workerId || command.uploadLease.token !== body.leaseToken ||
      now >= Number(command.uploadLease.expiresAt)) {
    return { ok: false, status: 'REFUSED', reason: 'upload-preflight-lease-invalid-or-ambiguous',
      providerCalled: null, externalEffectAuthorized: false, liveMoney: false };
  }
  var authority = await Render.exactAuthority(store, command, now, ['DISPATCHING_PRIVATE_UPLOAD']);
  if (!authority || !await currentDualCognition(authority, command, now, deps)) {
    return { ok: false, status: 'REFUSED', reason: 'upload-preflight-current-authority-held',
      providerCalled: false, externalEffectAuthorized: false, liveMoney: false };
  }
  var guard = await (deps.adapterGuard || AdapterGuard).checkpoint(store,
    'communication:youtube', 'youtube-private-video-upload', now);
  var authorizationId = 'cvua_' + hash({ commandId: command.commandId,
    renderReceiptId: command.renderReceiptId, fileSha256: command.renderReceipt.fileSha256,
    publicContentHash: command.publicContentHash, privacyStatus: 'private', authorizedAt: now }).slice(0, 24);
  var permitToken = 'cvup_' + crypto.randomBytes(18).toString('hex');
  var authorization = {
    schemaVersion: AUTH_SCHEMA, authorizationId: authorizationId, status: 'AUTHORIZED',
    productDomain: 'communication', ownerDomain: 'communication', lane: 'video-publication',
    channel: 'communication:youtube', commandId: command.commandId, manifestId: command.manifestId,
    subjectDomain: command.subjectDomain, publicContentHash: command.publicContentHash,
    renderReceiptId: command.renderReceiptId, fileSha256: command.renderReceipt.fileSha256,
    localPath: command.renderReceipt.localPath, privacyStatus: 'private', publiclyVisible: false,
    publicPublicationAuthorized: false, metadataAlterationAuthorized: false,
    providerPermitToken: permitToken, providerCallAuthorized: true, externalEffectAuthorized: true,
    homology: { afferentCause: command.sourcePacketId, subjectSelection: command.subjectDecisionReceiptId,
      communicationSelection: command.channelDecisionReceiptId, motorCommand: command.commandId,
      efferenceCopy: command.publicContentHash, predictedOutcome: 'YOUTUBE_PRIVATE_RECORD_PRESENT',
      reafference: 'AWAITING_PLATFORM_RECEIPT_AND_SEPARATE_PUBLIC_OBSERVER' },
    authorizedAt: now, expiresAt: Math.min(now + PROVIDER_PERMIT_MS, Number(command.expiresAt)),
    liveMoney: false, spendUsd: 0
  };
  // Persist and verify the authorization before arming the command. If this
  // write fails, the command is still safely DISPATCHING and recoverable. An
  // orphaned authorization is harmless because authority requires the exact
  // command+authorization pair; a later preflight may reuse or replace it.
  var authorizationKey = authKey(command.commandId);
  var storedAuthorization = await store.get(authorizationKey);
  var candidate = armWithAuthorization(command, authorization, guard);
  if (storedAuthorization && !authorizationValid(storedAuthorization,
    armWithAuthorization(command, storedAuthorization, guard), now)) {
    if (!await store.replaceIfValue(authorizationKey, storedAuthorization, authorization)) {
      storedAuthorization = await store.get(authorizationKey);
    } else storedAuthorization = authorization;
  } else if (!storedAuthorization) {
    await store.setIfAbsent(authorizationKey, authorization);
    storedAuthorization = await store.get(authorizationKey);
  }
  if (!storedAuthorization) storedAuthorization = await store.get(authorizationKey);
  candidate = armWithAuthorization(command, storedAuthorization, guard);
  if (!authorizationValid(storedAuthorization, candidate, now)) {
    throw new Error('communication video provider authorization readback invalid');
  }
  if (!await store.replaceIfValue(Command.key(command.commandId), command, candidate)) {
    var racedCommand = await store.get(Command.key(command.commandId));
    if (racedCommand && racedCommand.status === 'PROVIDER_CALL_AUTHORIZED' &&
        authorizationValid(storedAuthorization, racedCommand, now) && racedCommand.uploadLease &&
        racedCommand.uploadLease.workerId === workerId && racedCommand.uploadLease.token === body.leaseToken) {
      return authorizationResult(racedCommand, storedAuthorization);
    }
    return { ok: false, status: 'REFUSED', reason: 'upload-preflight-raced-or-ambiguous',
      providerCalled: null, externalEffectAuthorized: false, liveMoney: false };
  }
  var restoredCommand = await store.get(Command.key(command.commandId));
  if (!authorizationValid(storedAuthorization, restoredCommand, now) ||
      !restoredCommand.providerPermit ||
      restoredCommand.providerPermit.token !== storedAuthorization.providerPermitToken) {
    throw new Error('communication video provider preflight readback invalid');
  }
  return authorizationResult(restoredCommand, storedAuthorization);
}

async function complete(store, workerId, body, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  store.assertDurable();
  var command = await store.get(Command.key(body && body.commandId));
  if (!command) return { ok: false, status: 'REFUSED', reason: 'video-command-not-found' };
  var existing = await store.get(receiptKey(command.commandId));
  if (existing) {
    if (!platformReceiptValid(existing, command)) return { ok: false, status: 'REFUSED', reason: 'stored-platform-receipt-invalid' };
    await indexReceipt(store, existing);
    await transitionUploaded(store, command, existing, now);
    return { ok: true, status: existing.status, receiptId: existing.receiptId,
      commandId: command.commandId, videoId: existing.videoId, duplicate: true };
  }
  if (command.status !== 'PROVIDER_CALL_AUTHORIZED' || !command.uploadLease || !command.providerPermit ||
      command.uploadLease.workerId !== workerId || command.uploadLease.token !== body.leaseToken ||
      command.providerPermit.token !== body.providerPermitToken ||
      command.uploadAuthorizationId !== body.authorizationId) {
    return { ok: false, status: 'REFUSED', reason: 'upload-lease-invalid' };
  }
  // Once a dispatch lease has been handed to the local worker, timeout is not
  // evidence that YouTube did not accept the bytes. A late exact receipt may
  // close the ambiguity; the command is never handed to another worker.
  var receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    receiptId: 'cvpr_' + hash({ commandId: command.commandId, videoId: body.videoId,
      fileSha256: body.fileSha256 }).slice(0, 24),
    status: 'UPLOADED_PRIVATE', productDomain: 'communication', ownerDomain: 'communication',
    lane: 'video-publication', commandId: command.commandId, manifestId: command.manifestId,
    subjectDomain: command.subjectDomain, publicContentHash: command.publicContentHash,
    authorizationId: command.uploadAuthorizationId, fileSha256: String(body.fileSha256 || '').toLowerCase(),
    providerPermitToken: String(body.providerPermitToken || ''),
    videoId: String(body.videoId || ''), videoUrl: 'https://studio.youtube.com/video/' + String(body.videoId || '') + '/edit',
    privacyStatus: body.privacyStatus, publiclyVisible: false,
    title: body.title, description: body.description, uploadStatus: body.uploadStatus,
    tags: body.tags, categoryId: body.categoryId,
    readbackVerified: body.readbackVerified, quotaUnitsCharged: Number(body.quotaUnitsCharged),
    uploadedAt: Number(body.uploadedAt || now), receivedAt: now, providerCalled: body.providerCalled,
    externalEffectAuthorized: true, spendUsd: Number(body.spendUsd), liveMoney: false,
    truthBoundary: { providerReceiptIsNotIndependentOutcome: true,
      privateUploadIsNotPublicPublication: true, publicOutcomeStillRequired: true }
  };
  if (!platformReceiptValid(receipt, command)) {
    return { ok: false, status: 'REFUSED', reason: 'youtube-platform-receipt-invalid' };
  }
  await store.setIfAbsent(receiptKey(command.commandId), receipt);
  var restoredReceipt = await store.get(receiptKey(command.commandId));
  if (!platformReceiptValid(restoredReceipt, command) || restoredReceipt.receiptId !== receipt.receiptId) {
    throw new Error('communication video platform receipt readback invalid');
  }
  await transitionUploaded(store, command, restoredReceipt, now);
  await indexReceipt(store, restoredReceipt);
  return { ok: true, status: 'UPLOADED_PRIVATE', receiptId: receipt.receiptId,
    commandId: command.commandId, subjectDomain: command.subjectDomain, videoId: receipt.videoId,
    videoUrl: receipt.videoUrl, publiclyVisible: false, independentOutcomeObserved: false,
    providerCalled: true, externalEffectAuthorized: true, liveMoney: false };
}

module.exports = {
  AUTH_SCHEMA: AUTH_SCHEMA, RECEIPT_SCHEMA: RECEIPT_SCHEMA,
  AUTH_PREFIX: AUTH_PREFIX, RECEIPT_PREFIX: RECEIPT_PREFIX, RECEIPT_LOG: RECEIPT_LOG,
  RECEIPT_INDEX_PREFIX: RECEIPT_INDEX_PREFIX, DISPATCH_LEASE_MS: DISPATCH_LEASE_MS,
  PROVIDER_PERMIT_MS: PROVIDER_PERMIT_MS,
  authKey: authKey, receiptKey: receiptKey, receiptIndexKey: receiptIndexKey,
  enabled: enabled, currentDualCognition: currentDualCognition,
  authorizationValid: authorizationValid, platformReceiptValid: platformReceiptValid,
  indexReceipt: indexReceipt, recoverUnarmedLease: recoverUnarmedLease,
  transitionUploaded: transitionUploaded,
  claim: claim, preflight: preflight, complete: complete
};
