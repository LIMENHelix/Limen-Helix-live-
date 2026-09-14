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
var Generator = require('../lib/social-generator.js');

function Store() { this.values = new Map(); this.logs = {}; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? this.values.get(key) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values.has(key)) return false; return this.set(key, value); };
Store.prototype.deleteIfValue = async function (key, value) {
  if (!this.values.has(key) || JSON.stringify(this.values.get(key)) !== JSON.stringify(value)) return 0;
  this.values.delete(key); return 1;
};
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

function brain(domain, now, packetDomain) {
  packetDomain = packetDomain || domain;
  return { ts: now - 1000, c: {
    domain: domain, immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', packetId: domain + ':current',
      domainId: packetDomain, sourceType: 'server-cognition-refresh', generatedAt: new Date(now - 1000).toISOString(),
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
  var domainRelease = await DomainDecision.decide(store, candidate, now,
    { cognition: { finance: brain('finance', now) } });
  assert.equal(domainRelease.status, 'RELEASED');
  candidate.domainDecisionReceipt = domainRelease;

  var vetoBrain = brain('finance', now);
  vetoBrain.c.awareness.humanReviewRequired = true;
  assert.equal((await DomainDecision.decide(store, candidate, now,
    { cognition: { finance: vetoBrain } })).reason, 'subject-domain-human-review-veto');
  var immuneBrain = brain('finance', now);
  immuneBrain.c.immune.immuneState = 'alert';
  assert.equal((await DomainDecision.decide(store, candidate, now,
    { cognition: { finance: immuneBrain } })).reason, 'subject-domain-immune-veto');

  var cognition = { communication: brain('communication', now), finance: brain('finance', now) };
  var communicationRelease = await CommunicationDecision.decide(store, candidate, now, { cognition: cognition });
  assert.equal(communicationRelease.status, 'RELEASED');
  assert.equal(communicationRelease.sourceArtifactId, artifact.artifactId);
  assert(communicationRelease.expiresAt <= domainRelease.expiresAt,
    'Communication authority cannot outlive subject-domain authority');
  var expiredNestedCandidate = Object.assign({}, candidate, {
    domainDecisionReceipt: Object.assign({}, domainRelease, { expiresAt: now })
  });
  assert.equal(CommunicationDecision.validateReceipt(communicationRelease, expiredNestedCandidate, now), false,
    'executor validation rechecks the nested subject-domain release');
  var sourceFailureStore = Object.create(store);
  sourceFailureStore.get = async function () { throw new Error('transient durable source read failure'); };
  var unavailableDecision = await CommunicationDecision.decide(sourceFailureStore, candidate, now, { cognition: cognition });
  assert.equal(unavailableDecision.status, 'NO_ACTION');
  assert.equal(unavailableDecision.reason, 'communication-b10-unavailable');

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
  assert.equal(duplicate.reason, 'domain-commercial-public-content-already-distributed-or-claimed');
  assert.equal(platformCalls, 1);

  var equivalentState = JSON.parse(JSON.stringify(state));
  equivalentState.intent.intentId = 'finance-intent-2';
  equivalentState.lastPlannedIntentId = equivalentState.intent.intentId;
  var equivalentArtifact = JSON.parse(JSON.stringify(artifact));
  equivalentArtifact.artifactId = 'finance-artifact-2';
  equivalentArtifact.intentId = equivalentState.intent.intentId;
  await store.set(contract.stateKey, equivalentState);
  await store.set(contract.artifactStateKey, equivalentArtifact);
  var equivalentCandidate = await Candidate.read(store, domain, now + 2);
  assert.equal(equivalentCandidate.ok, true);
  assert.equal(equivalentCandidate.candidateHash, candidate.candidateHash);
  var equivalentAvailable = await Generator.available({ store: store, domain: domain, now: now + 2 });
  assert.equal(equivalentAvailable[0].reason, 'domain-commercial-public-content-already-distributed-or-claimed');

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

  var newerCommand = Object.assign({}, command, {
    commandId: 'finance-command-newer', sourceArtifactId: 'finance-artifact-newer',
    sourceIntentId: 'finance-intent-newer', commandedAt: command.commandedAt + 1000
  });
  assert.equal((await DomainLearning.recordCommand(store, newerCommand)).ok, true);
  var newerObservation = Object.assign({}, observation.receipt, {
    observationId: 'finance-observation-newer', observedAt: now + 3000,
    postReceipt: { uri: 'at://did:plc:test/app.bsky.feed.post/finance2', cid: 'cid-finance-2' }
  });
  assert.equal((await DomainLearning.recordObservation(store, newerCommand, newerObservation)).ok, true);
  var olderRefresh = Object.assign({}, observation.receipt, {
    observationId: 'finance-observation-older-refresh', observedAt: now + 4000
  });
  assert.equal((await DomainLearning.recordObservation(store, command, olderRefresh)).ok, true);
  assert.equal((await DomainLearning.readForBrain(store, domain)).signal.sourceArtifactId, 'finance-artifact-newer',
    'a later observation of an older post cannot replace the newest artifact reafference');

  var rankStore = new Store();
  var rankedFinanceState = JSON.parse(JSON.stringify(state)); rankedFinanceState.priority = 0.99;
  var rankedFinanceArtifact = JSON.parse(JSON.stringify(artifact)); rankedFinanceArtifact.artifactId = 'rank-finance';
  var energyContract = Contracts.get('energy');
  var energyState = JSON.parse(JSON.stringify(state));
  energyState.productDomain = 'energy'; energyState.ownerDomain = 'energy'; energyState.priority = 0.2;
  energyState.intent.intentId = 'energy-intent-rank'; energyState.intent.sourcePacketId = 'energy-packet-rank';
  var energyArtifact = JSON.parse(JSON.stringify(artifact));
  energyArtifact.productDomain = 'energy'; energyArtifact.ownerDomain = 'energy'; energyArtifact.artifactId = 'rank-energy';
  energyArtifact.intentId = energyState.intent.intentId; energyArtifact.sourcePacketId = energyState.intent.sourcePacketId;
  await rankStore.set(contract.stateKey, rankedFinanceState); await rankStore.set(contract.artifactStateKey, rankedFinanceArtifact);
  await rankStore.set(energyContract.stateKey, energyState); await rankStore.set(energyContract.artifactStateKey, energyArtifact);
  assert.equal((await Generator.generate({ store: rankStore, now: now })).domain, 'finance');
  assert.equal((await Generator.generate({ store: rankStore, now: now, after: 'finance' })).domain, 'energy',
    'refractory rotation prevents a high-salience domain monopolizing consecutive posts');

  var strandedStore = new Store();
  await strandedStore.set(contract.stateKey, state); await strandedStore.set(contract.artifactStateKey, artifact);
  var strandedCandidate = await Candidate.read(strandedStore, domain, now);
  var strandedCommand = { schemaVersion: Executor.SCHEMA, commandId: 'stranded-definitive-command',
    status: 'FAILED', providerCalled: false, subjectDomain: domain,
    sourceArtifactId: artifact.artifactId, contentHash: Candidate.hash(strandedCandidate.text) };
  var strandedArtifactClaim = { claimType: 'DOMAIN_COMMERCIAL_ARTIFACT', productDomain: domain,
    sourceArtifactId: artifact.artifactId, commandId: strandedCommand.commandId };
  var strandedContentClaim = { claimType: 'DOMAIN_COMMERCIAL_PUBLIC_CONTENT', productDomain: domain,
    contentHash: strandedCommand.contentHash, commandId: strandedCommand.commandId };
  await strandedStore.set(Executor.commandKey(strandedCommand.commandId), strandedCommand);
  await strandedStore.set(Executor.artifactClaimKey(domain, artifact.artifactId), strandedArtifactClaim);
  await strandedStore.set(Executor.contentClaimKey(domain, strandedCandidate.text), strandedContentClaim);
  var recoveredCandidates = await Generator.available({ store: strandedStore, domain: domain, now: now });
  assert.equal(recoveredCandidates[0].ok, true,
    'upstream candidate selection clears claims tied to a definitive pre-provider failure');
  assert.equal(await strandedStore.get(Executor.artifactClaimKey(domain, artifact.artifactId)), null);
  assert.equal(await strandedStore.get(Executor.contentClaimKey(domain, strandedCandidate.text)), null);

  var inFlight = 0, maxInFlight = 0;
  var parallelStore = new Store();
  parallelStore.get = async function () {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(function (resolve) { setTimeout(resolve, 3); });
    inFlight--; return null;
  };
  assert.equal((await Generator.available({ store: parallelStore, now: now })).length, 20);
  assert(maxInFlight > 2, 'twenty independent domain reads run concurrently');

  var stale = Object.assign({}, artifact, { freshnessExpiresAt: now - 1 });
  await store.set(contract.stateKey, state);
  await store.set(contract.artifactStateKey, stale);
  assert.equal((await Candidate.read(store, domain, now)).reason, 'domain-commercial-artifact-stale');

  var unavailableState = JSON.parse(JSON.stringify(state));
  unavailableState.homology.interoception.stress = null;
  var unavailableArtifact = JSON.parse(JSON.stringify(artifact));
  unavailableArtifact.sourceStress = null;
  assert.match(Candidate.render(contract, unavailableState, unavailableArtifact, now).text, /internal stress unavailable/);

  var wrongLatest = JSON.parse(JSON.stringify(state));
  wrongLatest.status = 'ABSTAINED'; wrongLatest.reason = 'no-meaningful-afferent-or-stress-change';
  wrongLatest.intent = null; wrongLatest.evidenceFingerprint = 'same-evidence';
  wrongLatest.lastPlannedIntentId = 'newer-unprepared-intent';
  var olderArtifact = JSON.parse(JSON.stringify(artifact)); olderArtifact.evidenceFingerprint = 'same-evidence';
  assert.equal(Candidate.render(contract, wrongLatest, olderArtifact, now).reason,
    'artifact-no-longer-matches-latest-domain-plan');

  for (var alias of [
    { product: 'science', owner: 'research' },
    { product: 'medicine', owner: 'health' },
    { product: 'trade', owner: 'supplyChain' }
  ]) {
    var aliasContract = Contracts.get(alias.product);
    var aliasState = JSON.parse(JSON.stringify(state));
    aliasState.productDomain = alias.product; aliasState.ownerDomain = alias.owner;
    aliasState.intent.intentId = alias.product + '-intent';
    aliasState.intent.sourcePacketId = alias.product + '-source';
    var aliasArtifact = JSON.parse(JSON.stringify(artifact));
    aliasArtifact.artifactId = alias.product + '-artifact'; aliasArtifact.productDomain = alias.product;
    aliasArtifact.ownerDomain = alias.owner; aliasArtifact.intentId = aliasState.intent.intentId;
    aliasArtifact.sourcePacketId = aliasState.intent.sourcePacketId;
    await store.set(aliasContract.stateKey, aliasState);
    await store.set(aliasContract.artifactStateKey, aliasArtifact);
    var aliasCandidate = await Candidate.read(store, alias.product, now);
    var aliasRelease = await DomainDecision.decide(store, aliasCandidate, now,
      { cognition: Object.fromEntries([[alias.product, brain(alias.owner, now, alias.product)]]) });
    aliasCandidate.domainDecisionReceipt = aliasRelease;
    var aliasCognition = { communication: brain('communication', now) };
    aliasCognition[alias.product] = brain(alias.owner, now, alias.product);
    var aliasDecision = await CommunicationDecision.decide(store, aliasCandidate, now, { cognition: aliasCognition });
    assert.equal(aliasDecision.status, 'RELEASED', alias.product + ' must validate owner/runtime brain alias');
  }
  console.log('domain commercial social loop: exact stress artifact, subject-domain release, Communication motor, one-shot claim, public outcome, and same-domain reafference passed');
})().catch(function (error) { console.error(error); process.exit(1); });
