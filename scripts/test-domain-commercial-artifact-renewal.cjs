#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Artifact = require('../lib/domain-commercial-artifact.js');
var Lanes = require('../lib/domain-commercial-lanes.js');
var Handler = require('../handlers/domain-commercial-artifact-prep.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? this.values.get(key) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) {
  if (this.values.has(key)) return false;
  await this.set(key, value); return true;
};
Store.prototype.replaceIfValue = async function (key, prior, value) {
  if (this.values.get(key) !== prior) return false;
  await this.set(key, value); return true;
};
Store.prototype.lrange = async function (key, start, stop) {
  return (this.lists.get(key) || []).slice(start, stop + 1);
};
Store.prototype.lpush = async function (key, value) {
  var rows = this.lists.get(key) || [];
  rows.unshift(JSON.parse(JSON.stringify(value))); this.lists.set(key, rows); return rows.length;
};
Store.prototype.ltrim = async function (key, start, stop) {
  this.lists.set(key, (this.lists.get(key) || []).slice(start, stop + 1)); return true;
};
Store.prototype.lrem = async function () { return 0; };

(async function () {
  var now = Date.parse('2026-09-16T19:30:00Z');
  var contract = Lanes.get('finance').contract;
  var oldArtifact = {
    schemaVersion: Artifact.SCHEMA,
    artifactId: 'dca_old', status: 'ARTIFACT_PREPARED',
    productDomain: 'finance', ownerDomain: 'finance', intentId: 'intent-old',
    sourcePacketId: 'packet-old', sourcePlannedAt: now - 8 * 60 * 60 * 1000,
    evidenceFingerprint: 'evidence-old', sourceStress: 0.55, sourcePriority: 0.61,
    targetProgram: 'PUBLIC_ARTICLE', subject: 'unchanged subject', body: 'unchanged body',
    sourceLedger: [{ sourceIdentity: { kind: 'feed', value: 'one' }, title: 'Observed title',
      publisher: 'Publisher', sourceUrl: 'https://example.test/source',
      authority: 'publisher-title-observed-by-feed', fullTextVerified: false }],
    contentHash: 'content-unchanged', freshnessGeneration: 1,
    preparedAt: now - 7 * 60 * 60 * 1000,
    freshnessExpiresAt: now - 60 * 60 * 1000,
    truthBoundary: { fullTextRead: false, titleClaimsAttributedOnly: true },
    homology: { motorState: 'ARTIFACT_PREPARED_EFFECT_INHIBITED' },
    externalEffectAuthorized: false, providerCalled: false, spendUsd: 0
  };
  var heldState = {
    schemaVersion: 'domain-commercial-reflex/1.0', productDomain: 'finance', ownerDomain: 'finance',
    status: 'ABSTAINED', reason: 'commercial-daily-artifact-cap-reached',
    evidenceFingerprint: 'evidence-old', lastPlannedIntentId: 'intent-old',
    readbackVerified: true, intent: null
  };

  var renewed = Artifact.renew(contract, heldState, oldArtifact, now);
  assert.equal(renewed.status, 'ARTIFACT_PREPARED');
  assert.equal(renewed.renewed, true);
  assert.notEqual(renewed.artifact.artifactId, oldArtifact.artifactId);
  assert.equal(renewed.artifact.contentHash, oldArtifact.contentHash);
  assert.equal(renewed.artifact.body, oldArtifact.body);
  assert.equal(renewed.artifact.renewedFromArtifactId, oldArtifact.artifactId);
  assert(renewed.artifact.freshnessExpiresAt > now);

  var safetyState = Object.assign({}, heldState, { reason: 'owning-domain-human-review-veto' });
  assert.equal(Artifact.renew(contract, safetyState, oldArtifact, now).reason,
    'commercial-artifact-renewal-not-continuity-eligible');
  var wrongPlan = Object.assign({}, heldState, { lastPlannedIntentId: 'other-intent' });
  assert.equal(Artifact.renew(contract, wrongPlan, oldArtifact, now).reason,
    'commercial-artifact-renewal-plan-mismatch');
  var tooOld = Object.assign({}, oldArtifact, { sourcePlannedAt: now - Artifact.MAX_INTENT_AGE_MS - 1 });
  assert.equal(Artifact.renew(contract, heldState, tooOld, now).reason,
    'commercial-artifact-renewal-evidence-stale-or-invalid');

  var store = new Store();
  await store.set(contract.stateKey, heldState);
  await store.set(contract.artifactStateKey, oldArtifact);
  var cycle = await Handler.run({ store: store, now: now, cycleLogger: function () {} });
  assert.equal(cycle.ok, true);
  assert.equal(cycle.prepared, 1);
  assert.equal(cycle.rows.find(function (row) { return row.productDomain === 'finance'; }).status,
    'ARTIFACT_PREPARED');
  var latest = await store.get(contract.artifactStateKey);
  assert.equal(latest.contentHash, oldArtifact.contentHash);
  assert.equal(latest.body, oldArtifact.body);
  assert.equal(latest.renewalReason, 'commercial-daily-artifact-cap-reached');
  assert.equal(latest.providerCalled, false);
  assert.equal(latest.externalEffectAuthorized, false);

  var second = await Handler.run({ store: store, now: now + 1000, cycleLogger: function () {} });
  assert.equal(second.prepared, 0, 'a still-fresh renewed envelope is not regenerated every cycle');

  console.log('domain commercial artifact renewal: stale unchanged inventory is refreshed without new content, cap bypass, provider call, or safety-veto inheritance');
})().catch(function (error) { console.error(error); process.exit(1); });
