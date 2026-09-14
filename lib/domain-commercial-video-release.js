'use strict';

/**
 * Dual-brain release for one exact domain-selected video work order.
 *
 * The subject domain owns the information and selected SHORT_VIDEO program.
 * Communication owns the public channel. Neither receipt is sufficient alone,
 * and this module never renders, uploads, spends, or calls a provider.
 */

var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var Contracts = require('./domain-commercial-contracts.js');
var Distribution = require('./domain-commercial-distribution-decision.js');
var Video = require('./domain-commercial-video-manifest.js');

var SUBJECT_SCHEMA = 'domain-commercial-video-release/1.0';
var CHANNEL_SCHEMA = 'communication-video-decision/1.0';
var SUBJECT_PREFIX = 'domain_commercial:video-release:';
var SUBJECT_LOG_PREFIX = 'domain_commercial:video-release-log:';
var CHANNEL_PREFIX = 'communication_video_decision:';
var CHANNEL_LOG = 'communication_video_decision_log';
var MAX_SUBJECT_AGE_MS = 30 * 60 * 1000;
var MAX_CHANNEL_AGE_MS = 10 * 60 * 1000;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function subjectKey(domain, manifestId, decisionId) {
  return SUBJECT_PREFIX + domain + ':' + manifestId + ':' + decisionId;
}
function subjectLog(domain) { return SUBJECT_LOG_PREFIX + domain; }
function channelKey(id) { return CHANNEL_PREFIX + id; }
function held(reason, blockers, extra) {
  return Object.assign({ ok: true, status: 'NO_ACTION', released: false, reason: reason,
    blockers: Array.isArray(blockers) ? blockers : [], providerCalled: false, liveMoney: false }, extra || {});
}
async function cognition(domain, deps) {
  if (deps && deps.cognition && deps.cognition[domain]) return deps.cognition[domain];
  return (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:' + domain);
}
function currentPair(contract, state, artifact, manifest, now) {
  return !!(state && artifact && manifest && state.schemaVersion === 'domain-commercial-reflex/1.0' &&
    state.productDomain === contract.productDomain && state.ownerDomain === contract.ownerDomain &&
    state.status === 'PLANNED' && state.readbackVerified === true && state.intent &&
    state.intent.intentId === artifact.intentId && state.lastPlannedIntentId === artifact.intentId &&
    artifact.schemaVersion === 'domain-commercial-artifact/1.0' &&
    artifact.productDomain === contract.productDomain && artifact.ownerDomain === contract.ownerDomain &&
    artifact.targetProgram === 'SHORT_VIDEO' && artifact.externalEffectAuthorized === false &&
    Video.validManifest(contract, manifest, state, artifact, now));
}
async function latest(store, contract) {
  var rows = await Promise.all([store.get(contract.stateKey), store.get(contract.artifactStateKey),
    store.get(contract.videoManifestStateKey)]);
  return { state: rows[0], artifact: rows[1], manifest: rows[2] };
}
function validSubject(receipt, contract, manifest, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  return !!(receipt && contract && manifest && receipt.schemaVersion === SUBJECT_SCHEMA &&
    receipt.status === 'RELEASED' && receipt.released === true &&
    receipt.productDomain === contract.productDomain && receipt.ownerDomain === contract.ownerDomain &&
    receipt.channelOwnerDomain === 'communication' && receipt.channel === 'communication:youtube' &&
    receipt.manifestId === manifest.manifestId && receipt.sourceArtifactId === manifest.sourceArtifactId &&
    receipt.sourceIntentId === manifest.sourceIntentId && receipt.sourcePacketId === manifest.sourcePacketId &&
    receipt.publicContentHash === manifest.publicContentHash &&
    Number.isFinite(Number(receipt.decidedAt)) && Number.isFinite(Number(receipt.expiresAt)) &&
    now >= Number(receipt.decidedAt) && now < Number(receipt.expiresAt) &&
    Number(receipt.expiresAt) <= Number(manifest.expiresAt));
}
async function releaseSubject(store, domain, nowValue, deps) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var contract = Contracts.get(domain);
  if (!contract) return held('subject-domain-unknown', ['exact-domain-contract-required']);
  try {
    store.assertDurable();
    var pair = await latest(store, contract);
    if (!currentPair(contract, pair.state, pair.artifact, pair.manifest, now)) {
      return held('subject-domain-video-work-order-not-current', ['fresh-exact-short-video-manifest-required'],
        { productDomain: contract.productDomain, ownerDomain: contract.ownerDomain });
    }
    var record = await cognition(contract.productDomain, deps);
    if (!Distribution.validCognition(record, contract, now)) {
      return held('subject-domain-cognition-missing-or-stale', ['fresh-owning-domain-cognition-required']);
    }
    var c = record.c;
    if (c.awareness && c.awareness.humanReviewRequired === true) {
      return held('subject-domain-human-review-veto', ['human-review-veto']);
    }
    if (!c.immune || c.immune.immuneState !== 'clear') {
      return held('subject-domain-immune-veto', ['immune-veto']);
    }
    var packet = c.serverPacket;
    if (!packet.truth || !packet.truth.feedHealth || !(Number(packet.truth.feedHealth.live) > 0)) {
      return held('subject-domain-live-feeds-unavailable', ['live-domain-feed-required']);
    }
    var decisionId = 'dcvr_' + hash({ domain: contract.productDomain, manifest: pair.manifest.manifestId,
      packet: packet.packetId, channel: 'communication:youtube' }).slice(0, 24);
    var receipt = {
      schemaVersion: SUBJECT_SCHEMA, decisionReceiptId: decisionId, status: 'RELEASED', released: true,
      productDomain: contract.productDomain, ownerDomain: contract.ownerDomain,
      channelOwnerDomain: 'communication', channel: 'communication:youtube',
      manifestId: pair.manifest.manifestId, sourceArtifactId: pair.manifest.sourceArtifactId,
      sourceIntentId: pair.manifest.sourceIntentId, sourcePacketId: pair.manifest.sourcePacketId,
      currentCognitionPacketId: packet.packetId, publicContentHash: pair.manifest.publicContentHash,
      selectedProgram: 'SHORT_VIDEO', selectionReasons: [
        'owning-domain-commercial-reflex-selected-short-video',
        'owning-domain-fresh-feed-and-stress-state-rechecked',
        'owning-domain-immune-and-review-vetoes-clear'
      ],
      authorityScope: { oneManifest: true, oneChannel: true, rendererMayAlterContent: false,
        uploaderMayAlterContent: false, liveMoney: false, spendUsd: 0 },
      homology: { afferentPacket: pair.manifest.sourcePacketId, interoceptiveStress: pair.artifact.sourceStress,
        basalGangliaSelection: 'DISINHIBIT_ONE_VIDEO_WORK_ORDER', motorRoute: 'communication:youtube',
        efferenceCopy: pair.manifest.publicContentHash, reafference: 'AWAITING_YOUTUBE_OUTCOME' },
      decidedAt: now, expiresAt: Math.min(now + MAX_SUBJECT_AGE_MS, Number(pair.manifest.expiresAt)),
      externalEffectAuthorized: false, providerCalled: false, liveMoney: false
    };
    var k = subjectKey(contract.productDomain, pair.manifest.manifestId, decisionId);
    var created = await store.setIfAbsent(k, receipt);
    var restored = await store.get(k);
    if (!validSubject(restored, contract, pair.manifest, now)) throw new Error('subject video release readback invalid');
    if (created) { await store.lpush(subjectLog(contract.productDomain), restored); await store.ltrim(subjectLog(contract.productDomain), 0, 199); }
    return restored;
  } catch (error) {
    return held('subject-domain-video-release-unavailable', ['decision-persistence-or-input-unavailable'],
      { detail: String(error && error.message || error) });
  }
}
function validChannel(receipt, subjectReceipt, manifest, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  return !!(receipt && subjectReceipt && manifest && receipt.schemaVersion === CHANNEL_SCHEMA &&
    receipt.status === 'RELEASED' && receipt.released === true &&
    receipt.productDomain === 'communication' && receipt.ownerDomain === 'communication' &&
    receipt.lane === 'video-publication' && receipt.subjectDomain === subjectReceipt.productDomain &&
    receipt.subjectDecisionReceiptId === subjectReceipt.decisionReceiptId &&
    receipt.manifestId === manifest.manifestId && receipt.publicContentHash === manifest.publicContentHash &&
    validSubject(subjectReceipt, Contracts.get(subjectReceipt.productDomain), manifest, now) &&
    Number.isFinite(Number(receipt.decidedAt)) && Number.isFinite(Number(receipt.expiresAt)) &&
    now >= Number(receipt.decidedAt) && now < Number(receipt.expiresAt) &&
    Number(receipt.expiresAt) <= Number(subjectReceipt.expiresAt));
}
async function releaseChannel(store, subjectReceipt, nowValue, deps) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var domain = text(subjectReceipt && subjectReceipt.productDomain);
  var contract = Contracts.get(domain);
  if (!contract) return held('communication-video-subject-invalid', ['known-subject-domain-required']);
  try {
    store.assertDurable();
    var pair = await latest(store, contract);
    if (!currentPair(contract, pair.state, pair.artifact, pair.manifest, now) ||
        !validSubject(subjectReceipt, contract, pair.manifest, now)) {
      return held('communication-video-subject-release-invalid-or-stale', ['current-subject-release-required']);
    }
    var rows = await Promise.all([cognition('communication', deps), cognition(domain, deps)]);
    var communicationContract = Contracts.get('communication');
    if (!Distribution.validCognition(rows[0], communicationContract, now) ||
        !Distribution.validCognition(rows[1], contract, now)) {
      return held('communication-or-subject-cognition-missing-or-stale', ['fresh-dual-brain-cognition-required']);
    }
    var comm = rows[0].c;
    var subject = rows[1].c;
    var blockers = [];
    if (!comm.immune || comm.immune.immuneState !== 'clear') blockers.push('communication-immune-veto');
    if (comm.awareness && comm.awareness.humanReviewRequired === true) blockers.push('communication-human-review-veto');
    if (!subject.immune || subject.immune.immuneState !== 'clear') blockers.push('subject-immune-veto');
    if (subject.awareness && subject.awareness.humanReviewRequired === true) blockers.push('subject-human-review-veto');
    var auto = comm.brainOrgans && comm.brainOrgans.autonomousInternalEmission || {};
    if (text(auto.holdReason)) blockers.push('communication-b10-brake-held:' + auto.holdReason);
    if (!(Number(auto.emittedCount) > 0)) blockers.push('communication-b10-no-action-selected');
    if (!comm.serverPacket.truth || !comm.serverPacket.truth.feedHealth || !(Number(comm.serverPacket.truth.feedHealth.live) > 0)) {
      blockers.push('communication-live-feeds-unavailable');
    }
    if (blockers.length) return held('communication-video-b10-held', blockers, { subjectDomain: domain });
    var id = 'cvd_' + hash({ manifest: pair.manifest.manifestId, subjectDecision: subjectReceipt.decisionReceiptId,
      communicationPacket: comm.serverPacket.packetId, subjectPacket: subject.serverPacket.packetId }).slice(0, 24);
    var receipt = {
      schemaVersion: CHANNEL_SCHEMA, decisionReceiptId: id, status: 'RELEASED', released: true,
      productDomain: 'communication', ownerDomain: 'communication', lane: 'video-publication',
      subjectDomain: domain, subjectOwnerDomain: contract.ownerDomain,
      subjectDecisionReceiptId: subjectReceipt.decisionReceiptId,
      manifestId: pair.manifest.manifestId, sourceArtifactId: pair.manifest.sourceArtifactId,
      publicContentHash: pair.manifest.publicContentHash,
      communicationPacketId: comm.serverPacket.packetId, subjectPacketId: subject.serverPacket.packetId,
      selectionReasons: ['communication-brain-selected-video-channel', 'subject-domain-release-present',
        'dual-brain-vetoes-and-live-feeds-rechecked'],
      predictedOutcome: { renderedFile: 'PRESENT', youtubeRecord: 'PRESENT', measurable: 'view-or-conversion' },
      homology: { subjectDecision: subjectReceipt.decisionReceiptId,
        channelBasalGangliaSelection: 'DISINHIBIT_ONE_YOUTUBE_COMMAND', motorRoute: 'local-media-worker',
        efferenceCopy: pair.manifest.publicContentHash, reafference: 'AWAITING_INDEPENDENT_YOUTUBE_READ' },
      decidedAt: now, expiresAt: Math.min(now + MAX_CHANNEL_AGE_MS, Number(subjectReceipt.expiresAt)),
      externalEffectAuthorized: false, providerCalled: false, liveMoney: false
    };
    var created = await store.setIfAbsent(channelKey(id), receipt);
    var restored = await store.get(channelKey(id));
    if (!validChannel(restored, subjectReceipt, pair.manifest, now)) throw new Error('communication video decision readback invalid');
    if (created) { await store.lpush(CHANNEL_LOG, restored); await store.ltrim(CHANNEL_LOG, 0, 999); }
    return restored;
  } catch (error) {
    return held('communication-video-b10-unavailable', ['decision-persistence-or-input-unavailable'],
      { subjectDomain: domain || null, detail: String(error && error.message || error) });
  }
}

module.exports = {
  SUBJECT_SCHEMA: SUBJECT_SCHEMA, CHANNEL_SCHEMA: CHANNEL_SCHEMA,
  SUBJECT_PREFIX: SUBJECT_PREFIX, SUBJECT_LOG_PREFIX: SUBJECT_LOG_PREFIX,
  CHANNEL_PREFIX: CHANNEL_PREFIX, CHANNEL_LOG: CHANNEL_LOG,
  subjectKey: subjectKey, subjectLog: subjectLog, channelKey: channelKey,
  currentPair: currentPair, validSubject: validSubject, validChannel: validChannel,
  releaseSubject: releaseSubject, releaseChannel: releaseChannel, hash: hash
};
