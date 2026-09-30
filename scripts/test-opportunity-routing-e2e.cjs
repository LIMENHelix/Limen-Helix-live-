#!/usr/bin/env node
'use strict';

/*
 * Cross-domain opportunity proof. This begins at each product-domain origin,
 * applies the same normalization used by the worker, and sends the result
 * through the durable B11 selection bridge. It never calls a provider.
 */

var assert = require('node:assert/strict');
var Bridge = require('../lib/autofire-domain-bridge.js');
var Autofire = require('../handlers/limen-worker-autofire.js');

var DOMAINS = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy',
  'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'
];

function Store() { this.values = Object.create(null); this.lists = Object.create(null); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] === undefined ? null : JSON.parse(JSON.stringify(this.values[key])); };
Store.prototype.set = async function (key, value) { this.values[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.lpush = async function (key, value) { (this.lists[key] || (this.lists[key] = [])).unshift(JSON.parse(JSON.stringify(value))); return this.lists[key].length; };
Store.prototype.ltrim = async function (key, start, stop) { this.lists[key] = (this.lists[key] || []).slice(start, stop + 1); return true; };

function candidate(domain, lane) {
  return {
    domain: domain,
    recommendedLane: lane,
    source: 'master-inbox',
    sourceArtifactRef: domain + ':opportunity:001',
    masterGate: { confidence: 0.95, readiness: 0.95, salience: 0.95, completeness: 1 }
  };
}

function cycle(domain) {
  return {
    domain: domain, ok: true, startedAt: 100, finishedAt: 110, cursorAfter: 99,
    domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } }
  };
}

(async function () {
  for (var i = 0; i < DOMAINS.length; i++) {
    var origin = DOMAINS[i];
    var store = new Store();

    var investmentEntry = Autofire.selectionCandidate(candidate(origin, 'investment'));
    var investment = await Bridge.select(store, {
      lane: 'investment', candidate: investmentEntry, domainCycle: cycle('finance'), at: 1000
    });
    assert.equal(investment.ok, true, origin + ' investment selection must be durable');
    assert.equal(investment.receipt.status, 'RELEASED', origin + ' investment must release');
    assert.equal(investment.receipt.ownerDomain, 'finance', origin + ' investment owner');

    var researchEntry = Autofire.selectionCandidate(candidate(origin, 'research'));
    var research = await Bridge.select(store, {
      lane: 'research', candidate: researchEntry, domainCycle: cycle('research'), at: 1001
    });
    assert.equal(research.ok, true, origin + ' research selection must be durable');
    assert.equal(research.receipt.status, 'RELEASED', origin + ' research must release');
    assert.equal(research.receipt.ownerDomain, 'research', origin + ' research owner');
    assert.equal(research.receipt.subjectDomain, 'research', origin + ' research destination');
    assert.equal(research.receipt.candidate.sourceArtifactRef, origin + ':opportunity:001');
  }

  var homestead = Autofire.selectionCandidate(candidate('homestead', 'research'));
  var held = await Bridge.select(new Store(), {
    lane: 'research', candidate: homestead, domainCycle: cycle('research'), at: 1002
  });
  assert.equal(held.receipt.status, 'HELD');
  assert(held.receipt.reasons.indexOf('research_subject_has_no_registered_research_owner') >= 0);
  assert.equal(Autofire.schedulerGroup({ domain: 'homestead', recommendedLane: 'investment' }), 'unowned');
  console.log('opportunity routing e2e: all 20 product-domain origins release investment through Finance and research through Science/research; Homestead remains held');
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exit(1);
});
