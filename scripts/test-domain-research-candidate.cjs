'use strict';

const assert = require('node:assert/strict');
const Producer = require('../lib/domain-research-candidate');

const now = Date.parse('2026-08-26T18:10:00Z');
function observation(i, feed) {
  return {
    sourceIdentity: { kind: 'headline-title', value: 'research:' + feed + ':' + i },
    sourceRecordId: 'https://news.example.test/item/' + i,
    aggregatorItemUrl: 'https://news.example.test/item/' + i,
    canonicalUrl: null,
    recordedAt: new Date(now - i * 1000).toISOString(),
    sourceUpdatedAt: new Date(now - i * 2000).toISOString(),
    title: 'Observed research event ' + i,
    publisher: 'Publisher ' + feed,
    feedName: feed,
    publisherIndependence: 'unassessed'
  };
}
function cognition(domain, sourceDomain, rows) {
  return {
    ts: now,
    c: {
      serverPacket: {
        sourceType: 'server-cognition-refresh', domainId: domain,
        packetId: domain + ':3:packet', generatedAt: new Date(now).toISOString(),
        truth: {
          stressScore: 0.3, confidence: 0.54, phase: 'p0',
          semanticEvidence: rows,
          semanticEvidenceMeta: { status: 'OBSERVED', ownerDomain: domain, sourceDomain: sourceDomain }
        }
      },
      serverPacketPersistence: { ok: true }
    }
  };
}

const rows = Array.from({ length: 12 }, (_, i) => observation(i, 'Feed ' + (i % 4)));
const science = Producer.build(cognition('science', 'research', rows), 'science', now);
assert.equal(science.status, 'READY_FOR_B10');
assert.equal(science.candidate.domain, 'science');
assert.equal(science.candidate.ownerDomain, 'research');
assert.equal(science.candidate.cik, null);
assert.equal(science.candidate.recommendedLane, 'research');
assert.equal(science.candidate.source, 'domain-packet-research');
assert.equal(science.candidate.researchContext.evidence.news.length, Producer.MAX_OBSERVATIONS);
assert.equal(science.candidate.researchContext.evidence.citations.length, 0);
assert.equal(science.candidate.researchContext.evidence.sourceBoundary.publisherIndependence, 'UNASSESSED');
assert.equal(science.candidate.masterGate.evidenceQuality, 0.75);
assert.equal(science.candidate.masterGate.uncertainty, 0.46);
assert.ok(science.candidate.masterGate.readiness > 0.7);
assert.ok(science.candidate.topicEvidenceRefs.every((x) => x.kind === 'headline-title'));

const medicine = Producer.build(cognition('medicine', 'health', rows), 'medicine', now);
assert.equal(medicine.status, 'READY_FOR_B10');
assert.equal(medicine.candidate.ownerDomain, 'health');
assert.notEqual(medicine.candidate.subjectId, science.candidate.subjectId);

const wrongStore = Producer.build(cognition('science', 'health', rows), 'science', now);
assert.equal(wrongStore.reason, 'owning-domain-semantic-identity-invalid');
const thin = Producer.build(cognition('science', 'research', rows.slice(0, 3)), 'science', now);
assert.equal(thin.reason, 'owning-domain-semantic-coverage-insufficient');
const staleRecord = cognition('science', 'research', rows);
staleRecord.c.serverPacket.generatedAt = new Date(now - Producer.MAX_PACKET_AGE_MS - 1).toISOString();
assert.equal(Producer.build(staleRecord, 'science', now).reason, 'owning-domain-packet-stale');
const notDurable = cognition('science', 'research', rows);
notDurable.c.serverPacketPersistence.ok = false;
assert.equal(Producer.build(notDurable, 'science', now).reason, 'owning-domain-packet-not-durable');
assert.equal(Producer.build(cognition('finance', 'finance', rows), 'finance', now).reason, 'research-product-domain-not-enabled');

console.log('domain research candidate: source-owned Science/Medicine evidence synthesis passed');
