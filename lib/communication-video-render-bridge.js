'use strict';

/** Local-renderer port. It can release local compute, never an upload. */

var crypto = require('node:crypto');
var Contracts = require('./domain-commercial-contracts.js');
var Release = require('./domain-commercial-video-release.js');
var Command = require('./communication-video-command.js');

var RECEIPT_SCHEMA = 'communication-video-render-receipt/1.0';
var RECEIPT_PREFIX = 'communication_video_render_receipt:';
var RECEIPT_LOG = 'communication_video_render_receipt_log';
var RECEIPT_INDEX_PREFIX = 'communication_video_render_receipt_index:';
var LEASE_MS = 20 * 60 * 1000;
var MAX_QUEUE_SCAN = 500;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function token() { return 'cvr_' + crypto.randomBytes(18).toString('hex'); }
function receiptKey(commandId) { return RECEIPT_PREFIX + commandId; }
function receiptIndexKey(commandId) { return RECEIPT_INDEX_PREFIX + commandId; }
function renderReceiptValid(receipt, command) {
  return !!(receipt && command && receipt.schemaVersion === RECEIPT_SCHEMA &&
    receipt.status === 'RENDERED_LOCAL' && receipt.commandId === command.commandId &&
    receipt.manifestId === command.manifestId && receipt.subjectDomain === command.subjectDomain &&
    receipt.publicContentHash === command.publicContentHash &&
    /^[a-f0-9]{64}$/.test(String(receipt.fileSha256 || '')) && Number(receipt.byteLength) > 0 &&
    Number(receipt.durationSeconds) > 0 && Number(receipt.durationSeconds) <= 120 &&
    typeof receipt.localPath === 'string' && receipt.localPath.length > 0 &&
    typeof receipt.rendererId === 'string' && receipt.rendererId.length > 0 &&
    receipt.narrationAltered === false && receipt.worldFactsAdded === false &&
    receipt.uploaderCalled === false && receipt.providerCalled === false && Number(receipt.spendUsd) === 0);
}
async function exactAuthority(store, command, now) {
  var contract = Contracts.get(command && command.subjectDomain);
  if (!contract || !command || command.schemaVersion !== Command.SCHEMA ||
      command.status !== 'AWAITING_LOCAL_RENDERER' || Number(command.expiresAt) <= now) return null;
  var rows = await Promise.all([
    store.get(contract.stateKey), store.get(contract.artifactStateKey), store.get(contract.videoManifestStateKey),
    store.get(Release.subjectKey(contract.productDomain, command.manifestId, command.subjectDecisionReceiptId)),
    store.get(Release.channelKey(command.channelDecisionReceiptId))
  ]);
  if (!Release.currentPair(contract, rows[0], rows[1], rows[2], now) ||
      rows[2].publicContentHash !== command.publicContentHash ||
      !Release.validSubject(rows[3], contract, rows[2], now) ||
      !Release.validChannel(rows[4], rows[3], rows[2], now)) return null;
  return { contract: contract, state: rows[0], artifact: rows[1], manifest: rows[2],
    subjectReceipt: rows[3], channelReceipt: rows[4] };
}
async function recoverLease(store, command, now) {
  if (!command || command.status !== 'RENDERING_LOCAL' || !command.renderLease ||
      Number(command.renderLease.expiresAt) > now) return command;
  var recovered = Object.assign({}, command, { status: 'AWAITING_LOCAL_RENDERER', renderLease: null,
    recovery: { reason: 'stale-local-render-lease', recoveredAt: now },
    externalEffectAuthorized: false, rendererCalled: false, uploaderCalled: false, providerCalled: false });
  return await store.replaceIfValue(Command.key(command.commandId), command, recovered) ? recovered
    : await store.get(Command.key(command.commandId));
}
async function claim(store, workerId, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  store.assertDurable();
  var queued = await store.lrange(Command.PENDING_KEY, 0, MAX_QUEUE_SCAN - 1);
  for (var i = queued.length - 1; i >= 0; i--) {
    var item = queued[i];
    if (!item || !item.commandId) continue;
    var command = await store.get(Command.key(item.commandId));
    command = await recoverLease(store, command, now);
    if (!command || command.status !== 'AWAITING_LOCAL_RENDERER') continue;
    var authority = await exactAuthority(store, command, now);
    if (!authority) continue;
    var leaseToken = token();
    var claimed = Object.assign({}, command, { status: 'RENDERING_LOCAL',
      renderLease: { token: leaseToken, workerId: workerId, claimedAt: now, expiresAt: now + LEASE_MS },
      renderAttemptedAt: now, externalEffectAuthorized: false, rendererCalled: false,
      uploaderCalled: false, providerCalled: false });
    if (!await store.replaceIfValue(Command.key(command.commandId), command, claimed)) continue;
    var restored = await store.get(Command.key(command.commandId));
    if (!restored || restored.status !== 'RENDERING_LOCAL' || !restored.renderLease ||
        restored.renderLease.token !== leaseToken || restored.renderLease.workerId !== workerId) {
      throw new Error('communication video render lease readback invalid');
    }
    return { ok: true, status: 'WORK_AVAILABLE', phase: 'render', commandId: restored.commandId,
      leaseToken: leaseToken, leaseExpiresAt: restored.renderLease.expiresAt,
      workOrder: clone(restored.workOrder), publicContentHash: restored.publicContentHash,
      subjectDomain: restored.subjectDomain,
      scope: { renderLocalFile: true, uploadToYouTube: false, callExternalProvider: false,
        alterNarration: false, addWorldFacts: false, spendUsd: 0 } };
  }
  return { ok: true, status: 'NO_WORK', phase: 'render', providerCalled: false,
    externalEffectAuthorized: false, liveMoney: false };
}
async function indexReceipt(store, receipt) {
  var marker = { schemaVersion: RECEIPT_SCHEMA, status: 'INDEXED', commandId: receipt.commandId,
    receiptId: receipt.receiptId, indexedAt: Date.now() };
  var created = await store.setIfAbsent(receiptIndexKey(receipt.commandId), marker);
  if (created) {
    try { await store.lpush(RECEIPT_LOG, receipt); await store.ltrim(RECEIPT_LOG, 0, 999); }
    catch (error) { await store.deleteIfValue(receiptIndexKey(receipt.commandId), marker).catch(function () {}); throw error; }
  }
  var restored = await store.get(receiptIndexKey(receipt.commandId));
  if (!restored || restored.receiptId !== receipt.receiptId) throw new Error('render receipt index readback invalid');
}
async function complete(store, workerId, body, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  store.assertDurable();
  var command = await store.get(Command.key(body && body.commandId));
  if (!command) return { ok: false, status: 'REFUSED', reason: 'video-command-not-found' };
  var existing = await store.get(receiptKey(command.commandId));
  if (existing) {
    if (!renderReceiptValid(existing, command)) return { ok: false, status: 'REFUSED', reason: 'stored-render-receipt-invalid' };
    await indexReceipt(store, existing);
    return { ok: true, status: existing.status, receiptId: existing.receiptId, commandId: command.commandId, duplicate: true };
  }
  if (command.status !== 'RENDERING_LOCAL' || !command.renderLease ||
      command.renderLease.workerId !== workerId || command.renderLease.token !== body.leaseToken ||
      now > Number(command.renderLease.expiresAt)) {
    return { ok: false, status: 'REFUSED', reason: 'render-lease-invalid-or-expired' };
  }
  var receipt = {
    schemaVersion: RECEIPT_SCHEMA,
    receiptId: 'cvrr_' + crypto.createHash('sha256').update(JSON.stringify({ commandId: command.commandId,
      fileSha256: body.fileSha256, workerId: workerId })).digest('hex').slice(0, 24),
    status: 'RENDERED_LOCAL', commandId: command.commandId, manifestId: command.manifestId,
    subjectDomain: command.subjectDomain, publicContentHash: command.publicContentHash,
    workerId: workerId, rendererId: String(body.rendererId || ''),
    localPath: String(body.localPath || ''), fileSha256: String(body.fileSha256 || '').toLowerCase(),
    byteLength: Number(body.byteLength), durationSeconds: Number(body.durationSeconds),
    narrationAltered: body.narrationAltered, worldFactsAdded: body.worldFactsAdded,
    renderedAt: now, uploaderCalled: false, providerCalled: false,
    externalEffectAuthorized: false, spendUsd: 0, liveMoney: false
  };
  if (!renderReceiptValid(receipt, command)) return { ok: false, status: 'REFUSED', reason: 'render-receipt-invalid' };
  await store.setIfAbsent(receiptKey(command.commandId), receipt);
  var restoredReceipt = await store.get(receiptKey(command.commandId));
  if (!renderReceiptValid(restoredReceipt, command) || restoredReceipt.receiptId !== receipt.receiptId) {
    throw new Error('communication video render receipt readback invalid');
  }
  var completed = Object.assign({}, command, { status: 'RENDERED_LOCAL', renderLease: null,
    renderReceiptId: receipt.receiptId, renderReceipt: restoredReceipt,
    rendererCalled: true, uploaderCalled: false, providerCalled: false,
    externalEffectAuthorized: false, completedLocalRenderAt: now });
  if (!await store.replaceIfValue(Command.key(command.commandId), command, completed)) {
    var raced = await store.get(Command.key(command.commandId));
    if (!raced || raced.status !== 'RENDERED_LOCAL' || raced.renderReceiptId !== receipt.receiptId) {
      throw new Error('communication video command render transition failed');
    }
  }
  await indexReceipt(store, restoredReceipt);
  return { ok: true, status: 'RENDERED_LOCAL', receiptId: receipt.receiptId,
    commandId: command.commandId, subjectDomain: command.subjectDomain, fileSha256: receipt.fileSha256,
    uploadAuthorized: false, providerCalled: false, externalEffectAuthorized: false, liveMoney: false };
}

module.exports = { RECEIPT_SCHEMA: RECEIPT_SCHEMA, RECEIPT_PREFIX: RECEIPT_PREFIX,
  RECEIPT_LOG: RECEIPT_LOG, RECEIPT_INDEX_PREFIX: RECEIPT_INDEX_PREFIX,
  LEASE_MS: LEASE_MS, receiptKey: receiptKey, receiptIndexKey: receiptIndexKey,
  exactAuthority: exactAuthority, recoverLease: recoverLease, renderReceiptValid: renderReceiptValid,
  claim: claim, complete: complete, indexReceipt: indexReceipt };
