'use strict';

/**
 * Project one exact domain's latest commercial artifact into a short public
 * signal teaser. This is a deterministic rendering step: it performs no
 * provider call, grants no external authority, and makes no claim beyond the
 * artifact's attributed title ledger and LIMEN's explicitly labelled internal
 * stress interpretation.
 */

var crypto = require('node:crypto');
var Contracts = require('./domain-commercial-contracts.js');
var Social = require('./social-post.js');

var SCHEMA = 'domain-commercial-social-candidate/1.0';

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function list(value) { return Array.isArray(value) ? value : []; }
function label(value) {
  return String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\breview\b/g, '').replace(/\s+/g, ' ').trim();
}
function domainLabel(domain) { return domain.charAt(0).toUpperCase() + domain.slice(1); }
function domainUrl(domain) {
  return 'https://limenhelix.com/' + domain + '?utm_source=bluesky&utm_medium=social&utm_campaign=domain-reflex';
}
function clip(value, max) {
  var chars = Array.from(String(value || '').replace(/\s+/g, ' ').trim());
  if (chars.length <= max) return chars.join('');
  return chars.slice(0, Math.max(1, max - 1)).join('').replace(/[\s,;:.-]+$/, '') + '…';
}
function valid(contract, state, artifact, now) {
  if (!contract || !state || !artifact) return 'domain-commercial-state-and-artifact-required';
  if (state.schemaVersion !== 'domain-commercial-reflex/1.0' || state.readbackVerified !== true) {
    return 'durable-domain-reflex-required';
  }
  if (artifact.schemaVersion !== 'domain-commercial-artifact/1.0' || artifact.status !== 'ARTIFACT_PREPARED' ||
      artifact.externalEffectAuthorized !== false) return 'prepared-effect-inhibited-artifact-required';
  if (state.productDomain !== contract.productDomain || state.ownerDomain !== contract.ownerDomain ||
      artifact.productDomain !== contract.productDomain || artifact.ownerDomain !== contract.ownerDomain) {
    return 'domain-commercial-identity-mismatch';
  }
  var artifactEvidenceFingerprint = text(artifact.evidenceFingerprint) ||
    hash(list(artifact.sourceLedger).map(function (row) { return row && row.sourceIdentity; }));
  var activePlan = state.status === 'PLANNED' && state.intent &&
    artifact.intentId === state.intent.intentId && artifact.sourcePacketId === state.intent.sourcePacketId &&
    artifact.targetProgram === state.intent.selectedProgram;
  var unchangedPlan = state.status === 'ABSTAINED' && state.reason === 'no-meaningful-afferent-or-stress-change' &&
    text(state.evidenceFingerprint) && state.evidenceFingerprint === artifactEvidenceFingerprint;
  if (!activePlan && !unchangedPlan) return 'artifact-no-longer-matches-latest-domain-plan';
  if (!text(artifact.artifactId) || !text(artifact.contentHash) || !Number.isFinite(Number(artifact.freshnessExpiresAt)) ||
      now >= Number(artifact.freshnessExpiresAt)) return 'domain-commercial-artifact-stale';
  var source = list(artifact.sourceLedger)[0];
  if (!source || !text(source.title) || !text(source.publisher) || !text(source.sourceUrl) ||
      source.authority !== 'publisher-title-observed-by-feed' || source.fullTextVerified !== false) {
    return 'attributed-source-title-required';
  }
  return null;
}

function render(contract, state, artifact, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var reason = valid(contract, state, artifact, now);
  if (reason) return { ok: false, domain: contract && contract.productDomain || null, reason: reason };
  var source = artifact.sourceLedger[0];
  var interoception = state.homology && state.homology.interoception || {};
  var stress = Number(interoception.stress == null ? artifact.sourceStress : interoception.stress);
  var delta = Number(interoception.delta);
  var stressText = Number.isFinite(stress) ? Math.round(stress * 100) + '%' : 'unavailable';
  var deltaText = Number.isFinite(delta) && Math.abs(delta) >= 0.01
    ? ' (' + (delta > 0 ? '+' : '') + Math.round(delta * 100) + ' pts)' : '';
  var prefix = domainLabel(contract.productDomain) + ' watch: internal stress ' + stressText + deltaText + '. ';
  var suffix = '\nResponse: ' + label(artifact.targetProgram) + '. Verify: ' + domainUrl(contract.productDomain);
  var allowance = Social.MAX_GRAPHEMES - Array.from(prefix + suffix).length;
  var lead = 'Feed lead — “' + clip(source.title, Math.max(28, allowance - 20)) + '” — ' + clip(source.publisher, 28) + '.';
  var body = prefix + lead + suffix;
  if (Social.graphemeLength(body) > Social.MAX_GRAPHEMES) {
    lead = 'Feed lead — “' + clip(source.title, Math.max(20, allowance - 8)) + '”.';
    body = prefix + lead + suffix;
  }
  if (Social.graphemeLength(body) > Social.MAX_GRAPHEMES) {
    return { ok: false, domain: contract.productDomain, reason: 'domain-commercial-social-render-over-platform-limit' };
  }
  var candidateHash = hash({ artifactId: artifact.artifactId, contentHash: artifact.contentHash, text: body });
  return {
    ok: true,
    schemaVersion: SCHEMA,
    domain: contract.productDomain,
    subjectDomain: contract.productDomain,
    ownerDomain: contract.ownerDomain,
    text: body,
    length: Social.graphemeLength(body),
    sourceArtifactId: artifact.artifactId,
    sourceIntentId: artifact.intentId,
    sourcePacketId: artifact.sourcePacketId,
    selectedProgram: artifact.targetProgram,
    salience: Number(state.priority == null ? artifact.sourcePriority : state.priority) || 0,
    preparedAt: Number(artifact.preparedAt) || 0,
    freshnessExpiresAt: Number(artifact.freshnessExpiresAt),
    candidateHash: candidateHash,
    sourceIdentity: {
      kind: 'domain-commercial-artifact',
      value: contract.artifactPrefix + artifact.artifactId,
      subjectDomain: contract.productDomain,
      retrievedAt: new Date(now).toISOString(),
      responseHash: artifact.contentHash,
      artifactId: artifact.artifactId,
      intentId: artifact.intentId,
      packetId: artifact.sourcePacketId,
      fullTextVerified: false
    },
    truthBoundary: artifact.truthBoundary,
    externalEffectAuthorized: false,
    providerCalled: false,
    spendUsd: 0
  };
}

async function read(store, domain, now) {
  var contract = Contracts.get(domain);
  if (!contract) return { ok: false, domain: domain, reason: 'known-domain-required' };
  var pair = await Promise.all([store.get(contract.stateKey), store.get(contract.artifactStateKey)]);
  return render(contract, pair[0], pair[1], now);
}

module.exports = { SCHEMA: SCHEMA, valid: valid, render: render, read: read, hash: hash };
