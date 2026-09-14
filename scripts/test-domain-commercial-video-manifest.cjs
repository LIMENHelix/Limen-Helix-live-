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
Store.prototype.lpush = async function (key, value) {
  (this.lists[key] || (this.lists[key] = [])).unshift(JSON.parse(JSON.stringify(value))); return this.lists[key].length;
};
Store.prototype.ltrim = async function (key, start, stop) { this.lists[key] = (this.lists[key] || []).slice(start, stop + 1); return true; };

function records(domain, now, program) {
  var contract = Contracts.get(domain);
  var intentId = domain + '-video-intent';
  var packetId = domain + '-video-packet';
  var state = {
    schemaVersion: 'domain-commercial-reflex/1.0', status: 'PLANNED', readbackVerified: true,
    productDomain: domain, ownerDomain: contract.ownerDomain, priority: 0.78,
    lastPlannedIntentId: intentId, evidenceFingerprint: domain + '-evidence', lastStress: 0.68,
    homology: { interoception: { stress: 0.68, delta: 0.07 } },
    intent: { intentId: intentId, sourcePacketId: packetId, selectedProgram: program || 'SHORT_VIDEO' }
  };
  var artifact = {
    schemaVersion: 'domain-commercial-artifact/1.0', artifactId: domain + '-video-artifact',
    status: 'ARTIFACT_PREPARED', externalEffectAuthorized: false,
    productDomain: domain, ownerDomain: contract.ownerDomain, intentId: intentId,
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
  assert.match(built.manifest.beats[1].narration, /published this feed title/);
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
  assert.equal(cycle.boundaries.modelCalled, false); assert.equal(cycle.boundaries.uploaderCalled, false);

  var handler = Handler.createHandler({ store: allStore, now: now,
    cronAuth: { enforce: function (req, res) { if (req.headers.authorization === 'Bearer cron') return true;
      res.statusCode = 401; res.end('{}'); return false; } } });
  var denied = response(); await handler({ method: 'GET', headers: {} }, denied); assert.equal(denied.statusCode, 401);
  var allowed = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer cron' } }, allowed);
  assert.equal(allowed.statusCode, 200); assert.equal(JSON.parse(allowed.body).prepared, 1);

  console.log('domain commercial video manifest: exact domain selection, attributed narration, abstract visuals, durable premotor work order, and no renderer/uploader PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
