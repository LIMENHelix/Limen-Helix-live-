'use strict';

/**
 * Subject-domain release for one exact prepared artifact and one exact public
 * channel. Communication still owns the channel motor; this receipt proves the
 * originating domain selected the content. It is not reusable across artifacts,
 * channels, domains, or time windows.
 */

var crypto = require('node:crypto');
var Contracts = require('./domain-commercial-contracts.js');
var Candidate = require('./domain-commercial-social-candidate.js');

var SCHEMA = 'domain-commercial-distribution-decision/1.0';
var KEY_PREFIX = 'domain_commercial:distribution-decision:';
var LOG_PREFIX = 'domain_commercial:distribution-decision-log:';
var MAX_AGE_MS = 30 * 60 * 1000;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(domain, artifactId, decisionId) { return KEY_PREFIX + domain + ':' + artifactId + ':' + decisionId; }
function logKey(domain) { return LOG_PREFIX + domain; }

async function decide(store, candidate, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var domain = String(candidate && candidate.subjectDomain || '').toLowerCase();
  var contract = Contracts.get(domain);
  if (!contract || !candidate || candidate.schemaVersion !== Candidate.SCHEMA || candidate.domain !== domain) {
    return { ok: true, status: 'NO_ACTION', released: false, reason: 'subject-domain-social-candidate-invalid' };
  }
  store.assertDurable();
  var pair = await Promise.all([store.get(contract.stateKey), store.get(contract.artifactStateKey)]);
  var rebuilt = Candidate.render(contract, pair[0], pair[1], now);
  if (!rebuilt.ok || rebuilt.candidateHash !== candidate.candidateHash || rebuilt.text !== candidate.text ||
      rebuilt.sourceArtifactId !== candidate.sourceArtifactId) {
    return { ok: true, status: 'NO_ACTION', released: false,
      reason: rebuilt.reason || 'candidate-does-not-match-latest-domain-artifact' };
  }
  var decisionWindow = Math.floor(now / MAX_AGE_MS);
  var decisionId = 'dcd_' + hash({ domain: domain, artifactId: candidate.sourceArtifactId,
    candidateHash: candidate.candidateHash, channel: 'communication:bluesky', window: decisionWindow }).slice(0, 24);
  var receipt = {
    schemaVersion: SCHEMA,
    decisionReceiptId: decisionId,
    status: 'RELEASED',
    released: true,
    productDomain: domain,
    ownerDomain: contract.ownerDomain,
    channelOwnerDomain: 'communication',
    channel: 'communication:bluesky',
    sourceArtifactId: candidate.sourceArtifactId,
    sourceIntentId: candidate.sourceIntentId,
    sourcePacketId: candidate.sourcePacketId,
    candidateHash: candidate.candidateHash,
    contentHash: hash(candidate.text),
    selectedProgram: candidate.selectedProgram,
    decidedAt: now,
    expiresAt: Math.min(now + MAX_AGE_MS, candidate.freshnessExpiresAt),
    authorityScope: { oneArtifact: true, oneChannel: true, liveMoney: false, spendUsd: 0 },
    homology: {
      prefrontalPolicy: candidate.selectedProgram,
      basalGangliaSelection: 'DISINHIBIT_ONE_PUBLIC_DISTRIBUTION',
      motorRoute: 'communication:bluesky',
      efferenceCopy: candidate.candidateHash,
      reafference: 'AWAITING_PUBLIC_APPVIEW_OUTCOME'
    },
    providerCalled: false,
    liveMoney: false
  };
  var created = await store.setIfAbsent(key(domain, candidate.sourceArtifactId, decisionId), receipt);
  var restored = await store.get(key(domain, candidate.sourceArtifactId, decisionId));
  if (!restored || restored.schemaVersion !== SCHEMA || restored.decisionReceiptId !== decisionId ||
      restored.candidateHash !== candidate.candidateHash || restored.productDomain !== domain) {
    throw new Error('domain commercial distribution decision readback invalid');
  }
  if (created) {
    await store.lpush(logKey(domain), restored);
    await store.ltrim(logKey(domain), 0, 199);
  }
  return restored;
}

function validate(receipt, candidate, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var domain = String(candidate && candidate.subjectDomain || '').toLowerCase();
  return !!(receipt && candidate && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' &&
    receipt.released === true && receipt.productDomain === domain && receipt.channelOwnerDomain === 'communication' &&
    receipt.channel === 'communication:bluesky' && receipt.sourceArtifactId === candidate.sourceArtifactId &&
    receipt.sourceIntentId === candidate.sourceIntentId && receipt.sourcePacketId === candidate.sourcePacketId &&
    receipt.candidateHash === candidate.candidateHash && receipt.contentHash === hash(candidate.text) &&
    Number.isFinite(Number(receipt.decidedAt)) && Number.isFinite(Number(receipt.expiresAt)) &&
    now >= Number(receipt.decidedAt) && now < Number(receipt.expiresAt));
}

module.exports = { SCHEMA: SCHEMA, KEY_PREFIX: KEY_PREFIX, LOG_PREFIX: LOG_PREFIX,
  MAX_AGE_MS: MAX_AGE_MS, key: key, logKey: logKey, decide: decide, validate: validate, hash: hash };
