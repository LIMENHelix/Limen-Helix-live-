#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Contracts = require('../lib/domain-commercial-contracts.js');
var Video = require('../lib/domain-commercial-video-manifest.js');
var Release = require('../lib/domain-commercial-video-release.js');
var Command = require('../lib/communication-video-command.js');
var Cycle = require('../handlers/communication-video-cycle.js');
var Bridge = require('../lib/communication-video-render-bridge.js');
var WorkHandler = require('../handlers/communication-video-work.js');

function Store() { this.values = Object.create(null); this.lists = Object.create(null); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] == null ? null : JSON.parse(JSON.stringify(this.values[key])); };
Store.prototype.set = async function (key, value) { this.values[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values[key] != null) return false; return this.set(key, value); };
Store.prototype.deleteIfValue = async function (key, expected) {
  if (JSON.stringify(this.values[key]) !== JSON.stringify(expected)) return 0; delete this.values[key]; return 1;
};
Store.prototype.replaceIfValue = async function (key, expected, value) {
  if (JSON.stringify(this.values[key]) !== JSON.stringify(expected)) return false; return this.set(key, value);
};
Store.prototype.lpush = async function (key, value) {
  (this.lists[key] || (this.lists[key] = [])).unshift(JSON.parse(JSON.stringify(value))); return this.lists[key].length;
};
Store.prototype.ltrim = async function (key, start, stop) { this.lists[key] = (this.lists[key] || []).slice(start, stop + 1); return true; };
Store.prototype.lrange = async function (key, start, stop) { var rows = this.lists[key] || []; return JSON.parse(JSON.stringify(rows.slice(start, stop < 0 ? undefined : stop + 1))); };
Store.prototype.lrem = async function (key, count, value) {
  var encoded = JSON.stringify(value), removed = 0;
  this.lists[key] = (this.lists[key] || []).filter(function (row) {
    if ((count === 0 || removed < count) && JSON.stringify(row) === encoded) { removed++; return false; }
    return true;
  });
  return removed;
};
Store.prototype.indexListMemberIfValue = async function (lockKey, lockValue, listKey, value, stop, replacement) {
  if (JSON.stringify(this.values[lockKey]) !== JSON.stringify(lockValue)) return false;
  await this.lrem(listKey, 0, value); await this.lpush(listKey, value); await this.ltrim(listKey, 0, stop);
  await this.set(lockKey, replacement); return true;
};
Store.prototype.setIfSourcesAndCurrent = async function (sourceKeyOne, sourceValueOne, sourceKeyTwo, sourceValueTwo,
  key, expectedValue, value) {
  if (JSON.stringify(this.values[sourceKeyOne]) !== JSON.stringify(sourceValueOne) ||
      JSON.stringify(this.values[sourceKeyTwo]) !== JSON.stringify(sourceValueTwo) ||
      JSON.stringify(this.values[key] == null ? null : this.values[key]) !== JSON.stringify(expectedValue)) return false;
  return this.set(key, value);
};

function brain(runtimeDomain, packetDomain, now) {
  return { ts: now - 1000, c: { domain: runtimeDomain,
    immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', packetId: packetDomain + '-current-packet',
      domainId: packetDomain, sourceType: 'server-cognition-refresh', generatedAt: new Date(now - 1000).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { stressScore: 0.72, activeDiagnoses: ['pressure'], feedHealth: { live: 3 } } } } };
}
function source(domain, now) {
  var contract = Contracts.get(domain), intentId = domain + '-video-intent', packetId = domain + '-source-packet';
  var state = { schemaVersion: 'domain-commercial-reflex/1.0', status: 'PLANNED', readbackVerified: true,
    productDomain: domain, ownerDomain: contract.ownerDomain, priority: 0.78, lastPlannedIntentId: intentId,
    evidenceFingerprint: domain + '-fingerprint', lastStress: 0.72,
    homology: { interoception: { stress: 0.72, delta: 0.08 } },
    intent: { intentId: intentId, sourcePacketId: packetId, selectedProgram: 'SHORT_VIDEO', plannedAt: now - 2000 } };
  var artifact = { schemaVersion: 'domain-commercial-artifact/1.0', status: 'ARTIFACT_PREPARED',
    artifactId: domain + '-video-artifact', productDomain: domain, ownerDomain: contract.ownerDomain,
    intentId: intentId, sourcePacketId: packetId, evidenceFingerprint: state.evidenceFingerprint,
    targetProgram: 'SHORT_VIDEO', sourceStress: 0.72, sourcePlannedAt: now - 2000, contentHash: 'a'.repeat(64),
    preparedAt: now - 1000, freshnessExpiresAt: now + 3600000, externalEffectAuthorized: false,
    sourceLedger: [{ sourceIdentity: { kind: 'url', value: 'https://example.com/' + domain },
      title: 'Publisher reports a current change in the ' + domain + ' domain', publisher: 'Example Wire',
      sourceUrl: 'https://example.com/' + domain, authority: 'publisher-title-observed-by-feed', fullTextVerified: false }] };
  return { contract: contract, state: state, artifact: artifact };
}
function response() { return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; },
  end: function (value) { this.body = value; } }; }

(async function () {
  var now = Date.now(), store = new Store(), row = source('finance', now);
  await store.set(row.contract.stateKey, row.state); await store.set(row.contract.artifactStateKey, row.artifact);
  var built = Video.build(row.contract, row.state, row.artifact, now);
  await Video.persist(store, row.contract, built);
  var cognition = { finance: brain('finance', 'finance', now), communication: brain('communication', 'communication', now) };

  var subject = await Release.releaseSubject(store, 'finance', now, { cognition: cognition });
  assert.equal(subject.status, 'RELEASED');
  assert.equal(subject.homology.interoceptiveStress, 0.72);
  assert.equal(subject.channel, 'communication:youtube');
  var channel = await Release.releaseChannel(store, subject, now, { cognition: cognition });
  assert.equal(channel.status, 'RELEASED'); assert.equal(channel.subjectDomain, 'finance');
  assert(channel.expiresAt <= subject.expiresAt);

  var command = await Command.prepare(store, subject, channel, now);
  assert.equal(command.status, 'AWAITING_LOCAL_RENDERER');
  var restored = await store.get(Command.key(command.commandId));
  assert.equal(restored.workOrder.publicContentHash, built.manifest.publicContentHash);
  assert.equal(restored.externalEffectAuthorized, false);
  assert.equal(restored.rendererCalled, false); assert.equal(restored.uploaderCalled, false);
  var duplicate = await Command.prepare(store, subject, channel, now + 1);
  assert.equal(duplicate.commandId, command.commandId); assert.equal(duplicate.duplicate, true);
  assert.equal((await store.lrange(Command.PENDING_KEY, 0, -1)).length, 1);

  var work = await Bridge.claim(store, 'thinkpad-media', now + 2);
  assert.equal(work.status, 'WORK_AVAILABLE'); assert.equal(work.commandId, command.commandId);
  assert.equal(work.scope.renderLocalFile, true); assert.equal(work.scope.uploadToYouTube, false);
  assert.equal(work.workOrder.publicContentHash, built.manifest.publicContentHash);
  assert.equal((await Bridge.claim(store, 'second-worker', now + 3)).status, 'NO_WORK',
    'an exact work order has one active renderer lease');
  var wrongDuration = await Bridge.complete(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: work.leaseToken,
    rendererId: 'limen-local-abstract-video/1', localPath: 'C:/LIMEN/rendered/' + command.commandId + '.mp4',
    fileSha256: 'b'.repeat(64), byteLength: 120000, durationSeconds: 28,
    narrationAltered: false, worldFactsAdded: false
  }, now + 500);
  assert.equal(wrongDuration.status, 'REFUSED', 'render duration must match the exact work order');
  var rendered = await Bridge.complete(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: work.leaseToken,
    rendererId: 'limen-local-abstract-video/1', localPath: 'C:/LIMEN/rendered/' + command.commandId + '.mp4',
    fileSha256: 'b'.repeat(64), byteLength: 120000, durationSeconds: 23,
    narrationAltered: false, worldFactsAdded: false
  }, now + 1000);
  assert.equal(rendered.status, 'RENDERED_LOCAL'); assert.equal(rendered.uploadAuthorized, false);
  assert.equal((await store.lrange(Command.PENDING_KEY, 0, -1)).length, 0,
    'completed local render leaves no stale pending motor command');
  assert.equal((await store.get(Command.key(command.commandId))).providerCalled, false);
  assert.equal((await Bridge.complete(store, 'thinkpad-media', {
    commandId: command.commandId, leaseToken: work.leaseToken
  }, now + 1001)).duplicate, true, 'receipt retry is idempotent');
  assert.equal((await store.lrange(Bridge.RECEIPT_LOG, 0, -1)).length, 1,
    'render receipt provenance is indexed exactly once');

  var subjectVeto = brain('finance', 'finance', now); subjectVeto.c.immune.immuneState = 'alert';
  assert.equal((await Release.releaseSubject(store, 'finance', now,
    { cognition: { finance: subjectVeto } })).reason, 'subject-domain-immune-veto');
  var commVeto = brain('communication', 'communication', now); commVeto.c.awareness.humanReviewRequired = true;
  assert.equal((await Release.releaseChannel(store, subject, now,
    { cognition: { finance: cognition.finance, communication: commVeto } })).reason, 'communication-video-b10-held');

  var aliasStore = new Store(), alias = source('science', now);
  await aliasStore.set(alias.contract.stateKey, alias.state); await aliasStore.set(alias.contract.artifactStateKey, alias.artifact);
  await Video.persist(aliasStore, alias.contract, Video.build(alias.contract, alias.state, alias.artifact, now));
  var aliasCognition = { science: brain('research', 'science', now), communication: cognition.communication };
  var aliasSubject = await Release.releaseSubject(aliasStore, 'science', now, { cognition: aliasCognition });
  assert.equal(aliasSubject.status, 'RELEASED', 'product/runtime domain aliases remain exact');

  var cycle = await Cycle.run({ store: store, now: now, cognition: cognition });
  assert.equal(cycle.domains, 20); assert.equal(cycle.commanded, 0); assert.equal(cycle.failed, 0);
  assert.equal(cycle.boundaries.rendererCalled, false); assert.equal(cycle.boundaries.providerCalled, false);

  var handler = WorkHandler.createHandler({ store: store, now: now + 2, env: { MEDIA_WORKER_TOKEN: 'secret' } });
  var denied = response(); await handler({ method: 'GET', headers: { 'x-limen-worker-id': 'thinkpad-media' } }, denied);
  assert.equal(denied.statusCode, 401);
  var noWork = response(); await handler({ method: 'GET', headers: {
    'x-limen-media-worker': 'secret', 'x-limen-worker-id': 'thinkpad-media'
  } }, noWork);
  assert.equal(noWork.statusCode, 200); assert.equal(JSON.parse(noWork.body).status, 'NO_WORK');
  console.log('communication video cycle: domain-local stress selection, dual B10 release, durable B14 command, aliases, vetoes and no provider PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
