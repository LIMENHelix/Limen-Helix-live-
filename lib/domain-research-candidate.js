'use strict';

/**
 * Build one bounded Science/Medicine evidence-synthesis candidate from the
 * owning product brain's current server packet.
 *
 * This is an actor, not a critic. It preserves current source observations and
 * describes a research question; it does not claim the observations prove the
 * question, infer publisher independence, or release a motor command.
 */

var crypto = require('node:crypto');

var SCHEMA = 'domain-research-candidate/1.0';
var MAX_PACKET_AGE_MS = 45 * 60 * 1000;
var MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
var MAX_OBSERVATIONS = 8;
var MIN_OBSERVATIONS = 4;
var OWNERS = {
  science: { ownerDomain: 'research', sourceDomain: 'research', label: 'Science' },
  medicine: { ownerDomain: 'health', sourceDomain: 'health', label: 'Medicine' }
};

function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function when(value) { var n = Date.parse(value); return Number.isFinite(n) ? n : null; }
function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function rounded(value) { return Math.round(clamp01(value) * 1000) / 1000; }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 20); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function validObservation(row) {
  return row && row.sourceIdentity && text(row.sourceIdentity.kind) && text(row.sourceIdentity.value) &&
    text(row.title) && text(row.recordedAt) && when(row.recordedAt) !== null &&
    (text(row.feedName) || text(row.publisher)) &&
    (text(row.sourceRecordId) || text(row.aggregatorItemUrl) || text(row.canonicalUrl));
}

function selectDiverse(rows) {
  var selected = [], seenFeeds = Object.create(null), used = Object.create(null);
  list(rows).forEach(function (row) {
    if (selected.length >= MAX_OBSERVATIONS || !validObservation(row)) return;
    var feed = String(row.feedName || row.publisher);
    var id = row.sourceIdentity.kind + ':' + row.sourceIdentity.value;
    if (!seenFeeds[feed] && !used[id]) {
      selected.push(row); seenFeeds[feed] = true; used[id] = true;
    }
  });
  list(rows).forEach(function (row) {
    if (selected.length >= MAX_OBSERVATIONS || !validObservation(row)) return;
    var id = row.sourceIdentity.kind + ':' + row.sourceIdentity.value;
    if (!used[id]) { selected.push(row); used[id] = true; }
  });
  return selected;
}

function evidenceQuality(rows, now) {
  var feeds = Object.create(null), fresh = 0;
  rows.forEach(function (row) {
    feeds[String(row.feedName || row.publisher)] = true;
    var observed = when(row.sourceUpdatedAt) || when(row.recordedAt);
    if (observed && now >= observed && now - observed <= 7 * 24 * 60 * 60 * 1000) fresh++;
  });
  var coverage = Math.min(1, rows.length / MAX_OBSERVATIONS);
  var diversity = Math.min(1, Object.keys(feeds).length / 4);
  var freshness = rows.length ? fresh / rows.length : 0;
  var identity = rows.length ? 1 : 0;
  // Publisher independence is explicitly unassessed, so even a perfect
  // transport window cannot claim more than 0.75 decision-evidence quality.
  return rounded(Math.min(0.75, 0.25 * coverage + 0.25 * diversity + 0.25 * freshness + 0.25 * identity));
}

function newsRow(row) {
  return {
    date: new Date(when(row.sourceUpdatedAt) || when(row.recordedAt)).toISOString(),
    source: row.publisher || row.feedName,
    feedName: row.feedName || null,
    url: row.canonicalUrl || row.aggregatorItemUrl || row.sourceRecordId,
    headline: row.title,
    sourceIdentity: clone(row.sourceIdentity),
    publisherIndependence: 'unassessed'
  };
}

function build(cognitionRecord, productDomain, nowValue) {
  var identity = OWNERS[productDomain];
  if (!identity) return { status: 'ABSTAINED', reason: 'research-product-domain-not-enabled', candidate: null };
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var c = cognitionRecord && cognitionRecord.c;
  var packet = c && c.serverPacket;
  var persisted = c && c.serverPacketPersistence;
  if (!packet || packet.sourceType !== 'server-cognition-refresh' || packet.domainId !== productDomain) {
    return { status: 'ABSTAINED', reason: 'owning-domain-packet-missing-or-invalid', candidate: null };
  }
  var generated = when(packet.generatedAt);
  if (!generated || now - generated > MAX_PACKET_AGE_MS || generated - now > MAX_FUTURE_SKEW_MS) {
    return { status: 'ABSTAINED', reason: 'owning-domain-packet-stale', candidate: null };
  }
  if (!persisted || persisted.ok !== true) {
    return { status: 'ABSTAINED', reason: 'owning-domain-packet-not-durable', candidate: null };
  }
  var truth = packet.truth || {};
  var meta = truth.semanticEvidenceMeta || {};
  if (meta.status !== 'OBSERVED' || meta.ownerDomain !== productDomain || meta.sourceDomain !== identity.sourceDomain) {
    return { status: 'ABSTAINED', reason: 'owning-domain-semantic-identity-invalid', candidate: null };
  }
  var observations = selectDiverse(truth.semanticEvidence);
  var feeds = Object.create(null);
  observations.forEach(function (row) { feeds[String(row.feedName || row.publisher)] = true; });
  if (observations.length < MIN_OBSERVATIONS || Object.keys(feeds).length < 2) {
    return { status: 'ABSTAINED', reason: 'owning-domain-semantic-coverage-insufficient', candidate: null };
  }
  var top = observations[0];
  var quality = evidenceQuality(observations, now);
  var confidence = finite(truth.confidence) ? clamp01(truth.confidence) : 0;
  var stress = finite(truth.stressScore) ? clamp01(truth.stressScore) : 0;
  var completeness = 1;
  var readiness = rounded(0.5 * confidence + 0.4 * completeness + 0.05);
  var salience = rounded(0.4 * confidence + 0.4 * stress + 0.1);
  var subjectId = productDomain + ':evidence-synthesis:' + hash(top.sourceIdentity.kind + ':' + top.sourceIdentity.value);
  var artifactRef = subjectId + ':' + hash(observations.map(function (row) { return row.sourceIdentity.value; }).join('|'));
  var title = identity.label + ' evidence synthesis: ' + top.title;
  var question = 'What does the current source set establish, contradict, leave unresolved, and require for replication or falsification regarding: ' + top.title;
  var contextPacket = {
    subject: {
      subjectId: subjectId,
      productDomain: productDomain,
      ownerDomain: identity.ownerDomain,
      entityName: identity.label + ' evidence stream',
      industry: { label: identity.label, descriptor: identity.label + ' research and evidence review' },
      proposedScope: {
        title: title,
        description: 'A bounded evidence synthesis using only the supplied current source observations.',
        problemStatement: question,
        proposedApproach: 'Separate observations, source identity, convergence, contradiction, replication needs, and unresolved claims. Do not convert repeated titles or unassessed publishers into independent confirmation.'
      }
    },
    evidence: {
      citations: [],
      news: observations.map(newsRow),
      priorArt: [],
      financial: null,
      networkStress: null,
      sourceBoundary: {
        packetId: packet.packetId,
        generatedAt: packet.generatedAt,
        observationsUsed: observations.length,
        distinctFeedLabels: Object.keys(feeds).length,
        publisherIndependence: 'UNASSESSED',
        directionalClaim: false
      }
    }
  };
  return {
    schemaVersion: SCHEMA,
    status: 'READY_FOR_B10',
    reason: null,
    candidate: {
      queuedAt: now,
      cik: null,
      ticker: null,
      entity_name: identity.label + ' evidence synthesis',
      subjectId: subjectId,
      domain: productDomain,
      ownerDomain: identity.ownerDomain,
      from: truth.phase || 'n/a',
      to: truth.phase || 'n/a',
      direction: 'evidence-synthesis',
      magnitude: stress,
      recommendedLane: 'research',
      salience: 'DOMAIN_EVIDENCE_READY',
      salienceScore: salience,
      autofireEligible: true,
      source: 'domain-packet-research',
      sourceArtifactRef: artifactRef,
      sourcePatternSig: top.sourceIdentity.value,
      sourceSnapshotAt: packet.generatedAt,
      sourcePacketId: packet.packetId,
      masterGate: {
        readiness: readiness,
        salience: salience,
        fireScore: rounded(readiness * salience),
        confidence: confidence,
        evidenceQuality: quality,
        uncertainty: rounded(1 - confidence),
        completeness: completeness,
        phase: truth.phase || null,
        phaseInhibited: false
      },
      researchContext: contextPacket,
      topicEvidenceRefs: observations.map(function (row) { return clone(row.sourceIdentity); }),
      status: 'PENDING'
    }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_PACKET_AGE_MS: MAX_PACKET_AGE_MS,
  MAX_OBSERVATIONS: MAX_OBSERVATIONS,
  MIN_OBSERVATIONS: MIN_OBSERVATIONS,
  OWNERS: OWNERS,
  validObservation: validObservation,
  evidenceQuality: evidenceQuality,
  build: build
};
