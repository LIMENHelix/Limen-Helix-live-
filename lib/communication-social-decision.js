'use strict';

/**
 * Communication-local B10 decision for one exact public message candidate.
 *
 * Source-grounded content is necessary but not sufficient. Release also
 * requires a fresh Communication brain state, a fresh subject-domain packet,
 * no Communication veto/brake, and an actual source-backed salience signal in
 * the subject brain. This module writes a decision receipt and performs no
 * platform, AI, broker, spending, or live-money action.
 */

var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var OperatorOverride = require('./communication-social-operator-override.js');

var SCHEMA = 'communication-social-decision/1.0';
var LOG_KEY = 'communication_social_decision_log';
var KEY_PREFIX = 'communication_social_decision:';
var MAX_COGNITION_AGE_MS = 45 * 60 * 1000;
var MAX_SOURCE_AGE_MS = 10 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;
var MAX_TEXT_GRAPHEMES = 300;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function decisionKey(id) { return KEY_PREFIX + String(id); }
function countGraphemes(value) {
  try {
    var segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(String(value || ''))).length;
  } catch (_) { return Array.from(String(value || '')).length; }
}
function held(reason, blockers, extra) {
  return Object.assign({ ok: true, status: 'NO_ACTION', released: false, reason: reason,
    blockers: Array.isArray(blockers) ? blockers : [], productDomain: 'communication',
    ownerDomain: 'communication', lane: 'social', liveMoney: false }, extra || {});
}
async function entry(domain, deps) {
  if (deps && deps.cognition && deps.cognition[domain]) return deps.cognition[domain];
  var read = deps && deps.redisGet || Redis.redisGet;
  return read('limen:brain:cognition:' + domain);
}
function validEntry(value, domain, now) {
  var c = value && value.c;
  var ts = Number(value && value.ts);
  var packet = c && c.serverPacket;
  var generatedAt = Date.parse(packet && packet.generatedAt);
  return !!(c && c.domain === domain && Number.isFinite(ts) && now >= ts && now - ts <= MAX_COGNITION_AGE_MS &&
    packet && packet.schemaVersion === 'civilization-domain-packet/1.0' && packet.domainId === domain &&
    packet.sourceType === 'server-cognition-refresh' && packet.sourceIdentity &&
    packet.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(generatedAt) &&
    now >= generatedAt && now - generatedAt <= MAX_COGNITION_AGE_MS);
}
function validSource(candidate, now) {
  var source = candidate && candidate.sourceIdentity;
  var retrievedAt = Date.parse(source && source.retrievedAt);
  return !!(source && source.kind === 'limen-live-tool-response' &&
    source.subjectDomain === candidate.subjectDomain && text(source.value) &&
    /^https:\/\/limenhelix\.com\/api\/[a-z0-9-]+(?:\?|$)/i.test(source.value) &&
    /^[a-f0-9]{64}$/.test(String(source.responseHash || '')) &&
    Number.isFinite(retrievedAt) && now >= retrievedAt && now - retrievedAt <= MAX_SOURCE_AGE_MS);
}
function subjectSalient(packet) {
  var truth = packet && packet.truth || {};
  var stress = Number(truth.stressScore);
  return (Array.isArray(truth.activeDiagnoses) && truth.activeDiagnoses.length > 0) ||
    (Array.isArray(truth.opportunities) && truth.opportunities.length > 0) ||
    (Number.isFinite(stress) && stress >= 0.25);
}
async function persist(store, receipt) {
  var key = decisionKey(receipt.decisionReceiptId);
  var created = await store.setIfAbsent(key, receipt);
  var restored = await store.get(key);
  if (!restored || restored.schemaVersion !== SCHEMA ||
      restored.decisionReceiptId !== receipt.decisionReceiptId || restored.status !== receipt.status ||
      restored.contentHash !== receipt.contentHash || restored.subjectDomain !== receipt.subjectDomain) {
    throw new Error('communication social decision: receipt readback invalid');
  }
  if (created) {
    await store.lpush(LOG_KEY, restored);
    await store.ltrim(LOG_KEY, 0, 999);
  }
  return restored;
}

async function decide(store, candidate, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var subjectDomain = text(candidate && candidate.subjectDomain || candidate && candidate.domain);
  var body = text(candidate && candidate.text);
  var normalized = Object.assign({}, candidate || {}, { subjectDomain: subjectDomain, text: body });
  var blockers = [];
  if (!subjectDomain || !body) blockers.push('candidate-identity-missing');
  if (body && countGraphemes(body) > MAX_TEXT_GRAPHEMES) blockers.push('candidate-text-over-platform-limit');
  if (body && body.indexOf('https://limenhelix.com/') < 0) blockers.push('candidate-verification-link-missing');
  if (!validSource(normalized, at)) blockers.push('candidate-live-source-identity-invalid-or-stale');
  if (blockers.length) return held('communication-b10-candidate-refused', blockers);
  try {
    store.assertDurable();
    var communication = await entry('communication', deps);
    var subject = await entry(subjectDomain, deps);
    if (!validEntry(communication, 'communication', at)) blockers.push('communication-brain-state-missing-or-stale');
    if (!validEntry(subject, subjectDomain, at)) blockers.push('subject-brain-state-missing-or-stale');
    if (!blockers.length) {
      var c = communication.c;
      var immune = c.immune || {};
      var awareness = c.awareness || {};
      var auto = c.brainOrgans && c.brainOrgans.autonomousInternalEmission || {};
      var commTruth = c.serverPacket.truth || {};
      var subjectTruth = subject.c.serverPacket.truth || {};
      if (immune.immuneState !== 'clear') blockers.push('communication-immune-veto');
      if (awareness.humanReviewRequired === true) blockers.push('communication-human-review-veto');
      if (text(auto.holdReason)) blockers.push('communication-b10-brake-held:' + auto.holdReason);
      if (!(Number(auto.emittedCount) > 0)) blockers.push('communication-b10-no-action-selected');
      if (!commTruth.feedHealth || !(Number(commTruth.feedHealth.live) > 0)) blockers.push('communication-live-feeds-unavailable');
      if (!subjectTruth.feedHealth || !(Number(subjectTruth.feedHealth.live) > 0)) blockers.push('subject-live-feeds-unavailable');
      if (!subjectSalient(subject.c.serverPacket)) blockers.push('subject-brain-no-salient-condition');
    }
    var contentHash = hash(body);
    var commPacket = communication && communication.c && communication.c.serverPacket;
    var subjectPacket = subject && subject.c && subject.c.serverPacket;
    var overrideUsed = null;
    var Override = deps.operatorOverride || OperatorOverride;
    if (blockers.length && deps.allowOperatorOverride === true &&
        Override.blockersAreB10Overridable(blockers) && subjectDomain === Override.SUBJECT_DOMAIN) {
      var releaseId = 'csd_' + hash({ contentHash: contentHash, communicationPacketId: commPacket && commPacket.packetId,
        subjectPacketId: subjectPacket && subjectPacket.packetId, sourceResponseHash: normalized.sourceIdentity.responseHash }).slice(0, 24);
      var consumed = await Override.consume(store, {
        subjectDomain: subjectDomain, now: at, decisionReceiptId: releaseId, rateStatus: deps.rateStatus
      });
      if (consumed && consumed.ok && consumed.receipt) {
        overrideUsed = consumed.receipt;
        blockers = [];
      }
    }
    if (blockers.length) {
      var heldId = 'csd_' + hash({ status: 'NO_ACTION', contentHash: contentHash,
        communicationPacketId: commPacket && commPacket.packetId || null,
        subjectPacketId: subjectPacket && subjectPacket.packetId || null,
        sourceResponseHash: normalized.sourceIdentity.responseHash, blockers: blockers }).slice(0, 24);
      return persist(store, {
        schemaVersion: SCHEMA, decisionReceiptId: heldId,
        status: 'NO_ACTION', released: false, reason: 'communication-b10-held', blockers: blockers,
        productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
        decisionContract: 'public-message-decision/1', subjectDomain: subjectDomain,
        contentHash: contentHash, sourceIdentity: normalized.sourceIdentity,
        communicationPacketId: commPacket && commPacket.packetId || null,
        subjectPacketId: subjectPacket && subjectPacket.packetId || null,
        selectionReasons: [], predictedOutcome: null,
        decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS,
        providerCalled: false, liveMoney: false
      });
    }

    var id = 'csd_' + hash({ contentHash: contentHash, communicationPacketId: commPacket.packetId,
      subjectPacketId: subjectPacket.packetId, sourceResponseHash: normalized.sourceIdentity.responseHash }).slice(0, 24);
    var receipt = {
      schemaVersion: SCHEMA,
      decisionReceiptId: id,
      status: 'RELEASED', released: true,
      productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
      decisionContract: 'public-message-decision/1',
      subjectDomain: subjectDomain,
      contentHash: contentHash,
      sourceIdentity: normalized.sourceIdentity,
      communicationPacketId: commPacket.packetId,
      subjectPacketId: subjectPacket.packetId,
      selectionReasons: overrideUsed
        ? ['operator-override-economy-b10-release', 'subject-brain-salience-observed', 'live-source-grounded']
        : ['communication-brain-selected-action', 'subject-brain-salience-observed', 'live-source-grounded'],
      predictedOutcome: { publicRecord: 'PRESENT', measurable: 'engagement-or-conversion' },
      decidedAt: at,
      expiresAt: at + MAX_DECISION_AGE_MS,
      providerCalled: false,
      liveMoney: false
    };
    if (overrideUsed) {
      receipt.operatorOverride = {
        overrideReceiptId: overrideUsed.overrideReceiptId,
        operatorKeyClass: overrideUsed.operatorKeyClass,
        reason: overrideUsed.reason,
        mintedAt: overrideUsed.mintedAt,
        consumedAt: overrideUsed.consumedAt,
        decisionReceiptId: id
      };
    }
    return persist(store, receipt);
  } catch (error) {
    return held('communication-b10-unavailable', ['decision-persistence-or-input-unavailable'], {
      detail: String(error && error.message || error)
    });
  }
}

function validateReceipt(receipt, candidate, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var body = text(candidate && candidate.text);
  var subjectDomain = text(candidate && candidate.subjectDomain);
  return !!(receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' && receipt.released === true &&
    receipt.productDomain === 'communication' && receipt.ownerDomain === 'communication' && receipt.lane === 'social' &&
    receipt.decisionContract === 'public-message-decision/1' && receipt.subjectDomain === subjectDomain &&
    receipt.contentHash === hash(body) && text(receipt.decisionReceiptId) &&
    Number.isFinite(Number(receipt.decidedAt)) && Number.isFinite(Number(receipt.expiresAt)) &&
    at >= Number(receipt.decidedAt) && at < Number(receipt.expiresAt));
}

module.exports = {
  SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, KEY_PREFIX: KEY_PREFIX,
  MAX_COGNITION_AGE_MS: MAX_COGNITION_AGE_MS, MAX_SOURCE_AGE_MS: MAX_SOURCE_AGE_MS,
  decisionKey: decisionKey, decide: decide, validateReceipt: validateReceipt,
  subjectSalient: subjectSalient
};
