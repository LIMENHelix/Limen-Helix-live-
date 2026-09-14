#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Generator = require('../lib/social-generator.js');
var Contracts = require('../lib/domain-commercial-contracts.js');

function Store() { this.values = {}; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] || null; };

function install(store, domain, now, priority) {
  var contract = Contracts.get(domain);
  var intentId = 'intent_' + domain;
  var packetId = 'packet_' + domain;
  store.values[contract.stateKey] = {
    schemaVersion: 'domain-commercial-reflex/1.0', status: 'PLANNED', readbackVerified: true,
    productDomain: domain, ownerDomain: contract.ownerDomain, priority: priority,
    evidenceFingerprint: 'fingerprint_' + domain,
    homology: { interoception: { stress: 0.61, delta: 0.08 } },
    intent: { intentId: intentId, sourcePacketId: packetId, selectedProgram: 'PUBLIC_ARTICLE' }
  };
  store.values[contract.artifactStateKey] = {
    schemaVersion: 'domain-commercial-artifact/1.0', artifactId: 'artifact_' + domain,
    status: 'ARTIFACT_PREPARED', externalEffectAuthorized: false,
    productDomain: domain, ownerDomain: contract.ownerDomain, intentId: intentId,
    sourcePacketId: packetId, targetProgram: 'PUBLIC_ARTICLE', contentHash: 'a'.repeat(64),
    evidenceFingerprint: 'fingerprint_' + domain, sourceStress: 0.61, sourcePriority: priority,
    preparedAt: now - 1000, freshnessExpiresAt: now + 600000,
    sourceLedger: [{ title: 'A current attributed topic lead for ' + domain,
      publisher: 'Example Wire', sourceUrl: 'https://example.com/' + domain,
      authority: 'publisher-title-observed-by-feed', fullTextVerified: false }],
    truthBoundary: { fullTextRead: false, titleClaimsAttributedOnly: true }
  };
}

(async function () {
  var now = Date.now();
  var store = new Store();
  install(store, 'economy', now, 0.75);
  install(store, 'science', now, 0.4);
  var post = await Generator.generate({ store: store, now: now });
  assert.equal(post.domain, 'economy');
  assert.equal(post.sourceIdentity.kind, 'domain-commercial-artifact');
  assert.equal(post.sourceIdentity.subjectDomain, 'economy');
  assert.equal(post.sourceIdentity.artifactId, 'artifact_economy');
  assert.equal(post.sourceIdentity.responseHash, 'a'.repeat(64));
  assert.equal(post.sourceIdentity.fullTextVerified, false);
  assert.equal(post.selectedProgram, 'PUBLIC_ARTICLE');
  assert(post.text.includes('internal stress 61% (+8 pts)'));
  assert(post.text.includes('Feed lead'));
  assert(post.text.includes('https://limenhelix.com/economy'));
  assert(post.length <= 300);
  var all = await Generator.previewAll({ store: store, now: now });
  assert.equal(all.length, 20);
  assert.equal(all.filter(function (row) { return row.ok; }).length, 2);
  assert.equal(all.find(function (row) { return row.domain === 'finance'; }).reason,
    'domain-commercial-state-and-artifact-required');
  var economyContract = Contracts.get('economy');
  store.values[economyContract.stateKey] = Object.assign({}, store.values[economyContract.stateKey], {
    status: 'ABSTAINED', reason: 'no-meaningful-afferent-or-stress-change', intent: null,
    priority: undefined, homology: { interoception: { stress: 0.61, delta: 0 } }
  });
  assert.equal((await Generator.generate({ store: store, now: now, domain: 'economy' })).domain, 'economy');
  store.values[Generator.ARTIFACT_CLAIM_PREFIX + 'economy:artifact_economy'] = { commandId: 'already-posted' };
  var next = await Generator.generate({ store: store, now: now });
  assert.equal(next.domain, 'science');
  console.log('social generator provenance: all 20 domains use exact fresh stress-derived artifacts, salience ranking, attributed titles, and bounded verification links');
})().catch(function (error) { console.error(error); process.exit(1); });
