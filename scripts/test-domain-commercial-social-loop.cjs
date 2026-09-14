#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Contracts = require('../lib/domain-commercial-contracts.js');
var Candidate = require('../lib/domain-commercial-social-candidate.js');
var DomainDecision = require('../lib/domain-commercial-distribution-decision.js');
var CommunicationDecision = require('../lib/communication-social-decision.js');
var Executor = require('../lib/communication-social-executor.js');
var Observer = require('../lib/communication-social-outcome-observer.js');
var DomainLearning = require('../lib/domain-commercial-social-learning.js');

function Store() { this.values = new Map(); this.logs = {}; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? this.values.get(key) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values.has(key)) return false; return this.set(key, value); };
Store.prototype.replaceIfValue = async function (key, current, value) {
  if (this.values.get(key) !== current) return false;
  return this.set(key, value);
};
Store.prototype.lpush = async function (key, value) {
  this.logs[key] = this.logs[key] || [];
  this.logs[key].unshift(JSON.parse(JSON.stringify(value)));
  return this.logs[key].length;
};
Store.prototype.ltrim = async function (key, start, stop) {
  this.logs[key] = (this.logs[key] || []).slice(start, stop + 1); return true;
};

function brain(domain, now) {
  return { ts: now - 1000, c: {
    domain: domain, immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', packetId: domain + ':current',
      domainId: domain, sourceType: 'server-cognition-refresh', generatedAt: new Date(now - 1000).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { stressScore: 0.7, activeDiagnoses: ['pressure'], opportunities: [], feedHealth: { live: 2 } } }
  } };
}

(async function () {
  var now = Date.now();
  var domain = 'finance';
  var contract = Contracts.get(domain);
  var state = {
    schemaVersion: 'domain-commercial-reflex/1.0', status: 'PLANNED', readbackVerified: true,
    productDomain: domain, ownerDomain: domain, priority: 0.8,
    homology: { interoception: { stress: 0.7, delta: 0.09 } },
    intent: { intentId: 'finance-intent-1', sourcePacketId: 'finance-source-packet', selectedProgram: 'INVESTMENT_REVIEW' }
  };
  var artifact = {
    schemaVersion: 'domain-commercial-artifact/1.0', artifactId: 'finance-artifact-1',
    status: 'ARTIFACT_PREPARED', externalEffectAuthorized: false,
    productDomain: domain, ownerDomain: domain, intentId: state.intent.intentId,
    sourcePacketId: state.intent.sourcePacketId, targetProgram: state.intent.selectedProgram,
    contentHash: 'f'.repeat(64), preparedAt: now - 1000, freshnessExpiresAt: now + 3600000,
    sourceLedger: [{ title: 'Issuer updates quarterly outlook after a material filing', publisher: 'Example Wire',
      sourceUrl: 'https://example.com/finance', authority: 'publisher-title-observed-by-feed', fullTextVerified: false }],
    truthBoundary: { fullTextRead: false, titleClaimsAttributedOnly: true }
  };
  var store = new Store();
  await store.set(contract.stateKey, state);
  await store.set(contract.artifactStateKey, artifact);

  var candidate = await Candidate.read(store, domain, now);
  assert.equal(candidate.ok, true);
  assert.equal(candidate.selectedProgram, 'INVESTMENT_REVIEW');
  assert(candidate.text.includes('internal stress 70% (+9 pts)'));
  var domainRelease = await DomainDecision.decide(store, candidate, now);
  assert.equal(domainRelease.status, 'RELEASED');
  candidate.domainDecisionReceipt = domainRelease;

  var cognition = { communication: brain('communication', now), finance: brain('finance', now) };
  var communicationRelease = await CommunicationDecision.decide(store, candidate, now, { cognition: cognition });
  assert.equal(communicationRelease.status, 'RELEASED');
  assert.equal(communicationRelease.sourceArtifactId, artifact.artifactId);

  var motorNumber = 0;
  var motor = { authorize: async function () { motorNumber++; return { authorized: true,
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'motor-' + motorNumber }; } };
  var platformCalls = 0;
  var spec = { subjectDomain: domain, text: candidate.text, decisionReceipt: communicationRelease,
    sourceArtifactId: candidate.sourceArtifactId, sourceIntentId: candidate.sourceIntentId,
    sourcePacketId: candidate.sourcePacketId, candidateHash: candidate.candidateHash,
    selectedProgram: candidate.selectedProgram, domainDecisionReceipt: domainRelease };
  var posted = await Executor.execute({ store: store, spec: spec, now: now, motorAuthorization: motor,
    adapterGuard: { checkpoint: async function () { return { ok: true }; } },
    platform: { postToBluesky: async function () { platformCalls++; return { ok: true,
      uri: 'at://did:plc:test/app.bsky.feed.post/finance1', cid: 'cid-finance-1',
      url: 'https://bsky.app/profile/test/post/finance1', used: 1, cap: 8 }; } } });
  assert.equal(posted.status, 'POSTED');
  assert.equal(platformCalls, 1);
  var command = await store.get(Executor.commandKey(posted.commandId));
  assert.equal(command.sourceArtifactId, artifact.artifactId);
  assert(await store.get(DomainLearning.causeKey(domain, command.commandId)));

  var duplicate = await Executor.execute({ store: store, spec: spec, now: now + 1, motorAuthorization: motor,
    adapterGuard: { checkpoint: async function () { throw new Error('must not run'); } },
    platform: { postToBluesky: async function () { platformCalls++; } } });
  assert.equal(duplicate.reason, 'domain-commercial-artifact-already-distributed-or-claimed');
  assert.equal(platformCalls, 1);

  var observation = await Observer.observeOne(store, { uri: posted.uri, cid: posted.cid }, now + 2000, {
    fetch: async function () { return { status: 200, json: async function () { return { posts: [{
      uri: posted.uri, cid: posted.cid, replyCount: 0, repostCount: 1, likeCount: 2, quoteCount: 0,
      indexedAt: new Date(now + 1000).toISOString()
    }] }; } }; }
  });
  assert.equal(observation.status, 'OBSERVED');
  var learned = await DomainLearning.recordObservation(store, command, observation.receipt);
  assert.equal(learned.ok, true);
  var reafference = await DomainLearning.readForBrain(store, domain);
  assert.equal(reafference.status, 'ELIGIBLE');
  assert.equal(reafference.signal.sourceArtifactId, artifact.artifactId);
  assert.equal(reafference.signal.engagementDelta, 3);
  assert.equal(reafference.signal.productDomain, domain);

  var stale = Object.assign({}, artifact, { freshnessExpiresAt: now - 1 });
  await store.set(contract.artifactStateKey, stale);
  assert.equal((await Candidate.read(store, domain, now)).reason, 'domain-commercial-artifact-stale');
  console.log('domain commercial social loop: exact stress artifact, subject-domain release, Communication motor, one-shot claim, public outcome, and same-domain reafference passed');
})().catch(function (error) { console.error(error); process.exit(1); });
