#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Contracts = require('../lib/domain-commercial-contracts.js');
var Video = require('../lib/domain-commercial-video-manifest.js');
var Handler = require('../handlers/domain-video-manifest-prep.js');

function Store() { this.values = Object.create(null); this.lists = Object.create(null); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] == null ? null : JSON.parse(JSON.stringify(this.values[key])); };
Store.prototype.set = async function (key, value) { this.values[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values[key] != null) return false; return this.set(key, value); };
Store.prototype.replaceIfValue = async function (key, expected, value) {
  if (JSON.stringify(this.values[key]) !== JSON.stringify(expected)) return false;
  return this.set(key, value);
};
Store.prototype.deleteIfValue = async function (key, expected) {
  if (JSON.stringify(this.values[key]) !== JSON.stringify(expected)) return 0;
  delete this.values[key]; return 1;
};
Store.prototype.lpush = async function (key, value) {
  (this.lists[key] || (this.lists[key] = [])).unshift(JSON.parse(JSON.stringify(value))); return this.lists[key].length;
};
Store.prototype.ltrim = async function (key, start, stop) { this.lists[key] = (this.lists[key] || []).slice(start, stop + 1); return true; };
Store.prototype.lrange = async function (key, start, stop) {
  return JSON.parse(JSON.stringify((this.lists[key] || []).slice(start, stop + 1)));
};
Store.prototype.indexListMemberIfValue = async function (lockKey, lockValue, listKey, value, stop, replacement) {
  if (JSON.stringify(this.values[lockKey]) !== JSON.stringify(lockValue)) return false;
  var encoded = JSON.stringify(value), rows = this.lists[listKey] || [];
  this.lists[listKey] = [JSON.parse(encoded)].concat(rows.filter(function (row) { return JSON.stringify(row) !== encoded; })).slice(0, stop + 1);
  this.values[lockKey] = JSON.parse(JSON.stringify(replacement)); return true;
};
Store.prototype.setIfSourcesAndCurrent = async function (oneKey, oneValue, twoKey, twoValue, key, current, value) {
  if (JSON.stringify(this.values[oneKey]) !== JSON.stringify(oneValue) ||
      JSON.stringify(this.values[twoKey]) !== JSON.stringify(twoValue) ||
      JSON.stringify(this.values[key] == null ? null : this.values[key]) !== JSON.stringify(current == null ? null : current)) return false;
  return this.set(key, value);
};

function records(domain, now, program) {
  var contract = Contracts.get(domain);
  var intentId = domain + '-video-intent';
  var packetId = domain + '-video-packet';
  var state = {
    schemaVersion: 'domain-commercial-reflex/1.0', status: 'PLANNED', readbackVerified: true,
    productDomain: domain, ownerDomain: contract.ownerDomain, priority: 0.78,
    lastPlannedIntentId: intentId, evidenceFingerprint: domain + '-evidence', lastStress: 0.68,
    homology: { interoception: { stress: 0.68, delta: 0.07 } },
    intent: { intentId: intentId, sourcePacketId: packetId, selectedProgram: program || 'SHORT_VIDEO', plannedAt: now - 2000 }
  };
  var artifact = {
    schemaVersion: 'domain-commercial-artifact/1.0', artifactId: domain + '-video-artifact',
    status: 'ARTIFACT_PREPARED', externalEffectAuthorized: false,
    productDomain: domain, ownerDomain: contract.ownerDomain, intentId: intentId,
    sourcePlannedAt: now - 2000,
    sourcePacketId: packetId, evidenceFingerprint: state.evidenceFingerprint,
    targetProgram: state.intent.selectedProgram, contentHash: 'a'.repeat(64), sourceStress: 0.68,
    preparedAt: now - 1000, freshnessExpiresAt: now + 3600000,
    sourceLedger: [{ sourceIdentity: { kind: 'url', value: 'https://example.com/' + domain },
      title: 'Publisher reports a material change in the ' + domain + ' landscape', publisher: 'Example Wire',
      sourceUrl: 'https://example.com/' + domain, authority: 'publisher-title-observed-by-feed', fullTextVerified: false }]
  };
  return { state: state, artifact: artifact };
}

function response() { return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; },
  end: function (value) { this.body = value; } }; }

(async function () {
  var now = Date.now(), finance = Contracts.get('finance'), pair = records('finance', now);
  var built = Video.build(finance, pair.state, pair.artifact, now);
  assert.equal(built.status, 'VIDEO_MANIFEST_PREPARED');
  assert.equal(built.manifest.productDomain, 'finance');
  assert.equal(built.manifest.ownerDomain, 'finance');
  assert.equal(built.manifest.sourceArtifactId, pair.artifact.artifactId);
  assert.equal(built.manifest.beats.length, 4);
  assert.match(built.manifest.beats[1].narration, /feed title:/);
  assert(Video.wordCount(built.manifest.beats[1].narration) <= 21);
  assert.equal(built.manifest.truthBoundary.fullTextRead, false);
  assert.equal(built.manifest.truthBoundary.rendererMayNotAddWorldFacts, true);
  assert.equal(built.manifest.visualContract.prohibited.includes('literal depiction of the reported event'), true);
  assert.equal(built.manifest.homology.motorState, 'RENDER_AND_UPLOAD_INHIBITED');
  assert.equal(built.manifest.externalEffectAuthorized, false);
  assert.equal(built.manifest.modelCalled, false);
  assert.equal(built.manifest.rendererCalled, false);
  assert.equal(built.manifest.uploaderCalled, false);

  var store = new Store();
  await store.set(finance.stateKey, pair.state); await store.set(finance.artifactStateKey, pair.artifact);
  var restored = await Video.persist(store, finance, built);
  assert.equal(restored.manifestId, built.manifest.manifestId);
  assert.equal((await Video.persist(store, finance, built)).manifestId, restored.manifestId);
  assert.equal(Video.validManifest(finance, restored, pair.state, pair.artifact, now), true);
  var tampered = JSON.parse(JSON.stringify(restored)); tampered.beats[0].narration = 'invented replacement';
  assert.equal(Video.validManifest(finance, tampered, pair.state, pair.artifact, now), false,
    'public narration must remain bound to the durable content hash');
  assert.match(finance.videoManifestStateKey, /:finance$/);
  assert.match(finance.videoManifestLog, /:finance$/);

  var immutableStressState = JSON.parse(JSON.stringify(pair.state));
  immutableStressState.homology.interoception.stress = 0.99;
  assert.equal(Video.build(finance, immutableStressState, pair.artifact, now).manifest.publicContentHash,
    built.manifest.publicContentHash, 'later mutable stress cannot rewrite an immutable artifact motor plan');

  var unattributed = JSON.parse(JSON.stringify(pair.artifact));
  unattributed.sourceLedger[0].publisher = 'Publisher not supplied';
  assert.equal(Video.build(finance, pair.state, unattributed, now).reason, 'source-publisher-attribution-required');
  var legacyUnattributed = JSON.parse(JSON.stringify(restored));
  legacyUnattributed.sourceLedger[0].publisher = 'Publisher not supplied';
  legacyUnattributed.beats[1].narration = 'Publisher not supplied published this feed title: Short title.';
  legacyUnattributed.publicContentHash = Video.hash(Video.publicPayload(legacyUnattributed));
  assert.equal(Video.validManifest(finance, legacyUnattributed, pair.state, pair.artifact, now), false,
    'self-consistent legacy narration without attribution is invalid');
  var legacyStress = JSON.parse(JSON.stringify(restored));
  legacyStress.beats[0].narration = 'Finance watch. LIMEN internal domain stress is 99%.';
  legacyStress.beats[0].onScreenText = 'Finance · internal stress 99%';
  legacyStress.publicContentHash = Video.hash(Video.publicPayload(legacyStress));
  assert.equal(Video.validManifest(finance, legacyStress, pair.state, pair.artifact, now), false,
    'self-consistent legacy narration cannot drift from artifact stress');
  var rewrittenSource = JSON.parse(JSON.stringify(restored));
  rewrittenSource.sourceLedger[0].publisher = 'Different Real Publisher';
  rewrittenSource.sourceLedger[0].title = 'Different title that was never in the artifact';
  rewrittenSource.beats = Video.expectedBeats(finance, pair.artifact, rewrittenSource.sourceLedger[0]);
  rewrittenSource.publicContentHash = Video.hash(Video.publicPayload(rewrittenSource));
  assert.equal(Video.validManifest(finance, rewrittenSource, pair.state, pair.artifact, now), false,
    'self-consistent attribution cannot detach from the immutable artifact source');
  var malformedBeat = JSON.parse(JSON.stringify(restored)); malformedBeat.beats[2] = null;
  assert.equal(Video.validManifest(finance, malformedBeat, pair.state, pair.artifact, now), false,
    'malformed stored beats fail closed without throwing');
  var overlongBeat = JSON.parse(JSON.stringify(restored)); overlongBeat.beats[2].narration = Array(100).fill('word').join(' ');
  overlongBeat.publicContentHash = Video.hash(Video.publicPayload(overlongBeat));
  assert.equal(Video.validManifest(finance, overlongBeat, pair.state, pair.artifact, now), false,
    'every narrated beat is bound to its immutable speech budget');

  var longSpeech = JSON.parse(JSON.stringify(pair.artifact));
  longSpeech.sourceLedger[0].publisher = 'The Extremely Long International Publisher Organization News Service';
  longSpeech.sourceLedger[0].title = Array(50).fill('substantive').join(' ');
  assert(Video.wordCount(Video.build(finance, pair.state, longSpeech, now).manifest.beats[1].narration) <= 21,
    'the fixed eight-second beat has a bounded spoken-word budget');
  var noWhitespaceSpeech = JSON.parse(JSON.stringify(pair.artifact));
  noWhitespaceSpeech.sourceLedger[0].title = '界'.repeat(160);
  assert(Array.from(Video.build(finance, pair.state, noWhitespaceSpeech, now).manifest.beats[1].narration).length <= 90,
    'scripts without whitespace receive a language-independent character budget');

  var partialStore = new Store(), logFailures = 1;
  await partialStore.set(finance.stateKey, pair.state); await partialStore.set(finance.artifactStateKey, pair.artifact);
  var durableIndex = partialStore.indexListMemberIfValue;
  partialStore.indexListMemberIfValue = async function () {
    if (logFailures-- > 0) throw new Error('simulated log append failure');
    return durableIndex.apply(this, arguments);
  };
  await assert.rejects(Video.persist(partialStore, finance, built), /simulated log append failure/);
  assert(await partialStore.get(finance.videoManifestPrefix + built.manifest.manifestId),
    'immutable manifest survives a partial log failure');
  assert.equal(await partialStore.get(finance.videoManifestStateKey), null,
    'latest state is not promoted before immutable provenance is indexed');
  await Video.persist(partialStore, finance, built);
  assert.equal((await partialStore.get(finance.videoManifestStateKey)).manifestId, built.manifest.manifestId);
  assert.equal((await partialStore.lrange(finance.videoManifestLog, 0, 199))[0].manifestId,
    built.manifest.manifestId, 'retry repairs the missing provenance log entry');

  var concurrentStore = new Store();
  await concurrentStore.set(finance.stateKey, pair.state); await concurrentStore.set(finance.artifactStateKey, pair.artifact);
  var concurrent = await Promise.allSettled([
    Video.persist(concurrentStore, finance, built), Video.persist(concurrentStore, finance, built)
  ]);
  assert(concurrent.some(function (row) { return row.status === 'fulfilled'; }));
  assert.equal((await concurrentStore.lrange(finance.videoManifestLog, 0, 199)).filter(function (row) {
    return row.manifestId === built.manifest.manifestId;
  }).length, 1, 'overlapping manifest workers share one exclusive provenance append');

  var sourceRaceStore = new Store();
  await sourceRaceStore.set(finance.stateKey, pair.state); await sourceRaceStore.set(finance.artifactStateKey, pair.artifact);
  var sourceBoundSet = sourceRaceStore.setIfSourcesAndCurrent;
  sourceRaceStore.setIfSourcesAndCurrent = async function (oneKey, oneValue, twoKey, twoValue, key, current, value) {
    var advanced = JSON.parse(JSON.stringify(pair.state)); advanced.intent.intentId = 'newer-intent';
    advanced.lastPlannedIntentId = 'newer-intent'; this.values[finance.stateKey] = advanced;
    return sourceBoundSet.call(this, oneKey, oneValue, twoKey, twoValue, key, current, value);
  };
  var raced = await Video.persist(sourceRaceStore, finance, built);
  assert.equal(raced.reason, 'source-plan-advanced-before-video-promotion');
  assert.equal(await sourceRaceStore.get(finance.videoManifestStateKey), null,
    'a source plan that advances during persistence cannot promote the stale manifest');

  var tieNewer = JSON.parse(JSON.stringify(restored)), tieOlder = JSON.parse(JSON.stringify(restored));
  tieNewer.sourceIntentId = 'z-newer'; tieOlder.sourceIntentId = 'a-older';
  tieNewer.preparedAt = tieOlder.preparedAt = now;
  assert(Video.comparePlans(tieNewer, tieOlder) > 0, 'intent identity totally orders equal preparation times');

  var article = records('finance', now, 'PUBLIC_ARTICLE');
  assert.equal(Video.build(finance, article.state, article.artifact, now).reason,
    'domain-current-program-is-not-short-video');
  var stale = JSON.parse(JSON.stringify(pair.artifact)); stale.freshnessExpiresAt = now;
  assert.equal(Video.build(finance, pair.state, stale, now).reason, 'domain-commercial-artifact-stale');

  var allStore = new Store();
  Contracts.DOMAINS.forEach(function (domain, index) {
    var contract = Contracts.get(domain), current = records(domain, now, index === 0 ? 'SHORT_VIDEO' : 'PUBLIC_ARTICLE');
    allStore.values[contract.stateKey] = current.state;
    allStore.values[contract.artifactStateKey] = current.artifact;
  });
  var cycle = await Handler.run({ store: allStore, now: now });
  assert.equal(cycle.ok, true); assert.equal(cycle.domains, 20); assert.equal(cycle.prepared, 1);
  assert.equal(cycle.abstained, 19); assert.equal(cycle.failed, 0);
  assert.equal(cycle.rows[0].selectedProgram, 'SHORT_VIDEO');
  assert.equal(cycle.rows[1].selectedProgram, 'PUBLIC_ARTICLE',
    'an inhibited manifest still reports the source artifact program without exposing content');
  assert.equal(cycle.boundaries.modelCalled, false); assert.equal(cycle.boundaries.uploaderCalled, false);

  var handler = Handler.createHandler({ store: allStore, now: now,
    cronAuth: { enforce: function (req, res) { if (req.headers.authorization === 'Bearer cron') return true;
      res.statusCode = 401; res.end('{}'); return false; } } });
  var denied = response(); await handler({ method: 'GET', headers: {} }, denied); assert.equal(denied.statusCode, 401);
  var allowed = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer cron' } }, allowed);
  assert.equal(allowed.statusCode, 200); assert.equal(JSON.parse(allowed.body).prepared, 1);

  console.log('domain commercial video manifest: exact domain selection, attributed narration, abstract visuals, durable premotor work order, and no renderer/uploader PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
