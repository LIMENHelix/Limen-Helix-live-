'use strict';

var assert = require('node:assert/strict');
var BR = require('../core/sandbox-motor-bridge.js');
var L = require('../core/sandbox-learning-bridge.js');

function Store(failType) { this.records = []; this.failType = failType || null; }
Store.prototype.append = function (r) { if (r.type === this.failType) throw new Error('forced ' + r.type + ' failure'); this.records.push(JSON.parse(JSON.stringify(r))); };
Store.prototype.read = function () { return this.records.slice(); };

function handoff(i) {
  return {
    schemaVersion: 'civilization-handoff/1.0',
    domainId: i % 2 ? 'research' : 'finance',
    sourceDomains: [i % 2 ? 'research' : 'finance'],
    opportunityId: 'sandbox-learning-' + i,
    lane: i % 2 ? 'research-papers' : 'investments',
    motorClaim: { variable: 'sandbox:lane:delta', magnitude: 1 }
  };
}

function runOne(learning, i) {
  var at = 1800000000000 + i * 3600000;
  var cmd = BR.submit(learning.motorBridge, handoff(i), at);
  var result = BR.complete(learning.motorBridge, cmd.commandId, {
    outcomeId: 'sandbox-learning-outcome-' + i,
    sourceType: 'sandbox-counterfactual',
    independentOf: 'originating-domain-observation',
    observedDelta: (i % 3) * 0.1,
    observedAt: at + 600000
  }, at + 600000);
  return L.consume(learning, result, {
    hit: i < 7,
    predictionError: i < 7 ? 0.02 + i * 0.001 : -0.08 - i * 0.002
  }, at + 600000);
}

var store = new Store();
var learning = L.create({ motorBridge: BR.create({ store: store, trustN: 8 }) });
assert.equal(learning.schemaVersion, 'sandbox-learning-bridge/1.0');
assert.throws(function () { L.consume(learning, {}, null, 1); }, /completed motor result/);

var consumed = [];
for (var i = 0; i < 18; i++) consumed.push(runOne(learning, i));
assert.equal(learning.outcomesConsumed, 18);
assert.equal(learning.memory.episodic.length, 18);
assert.equal(store.records.filter(function (r) { return r.type === 'sandbox_learning_observation'; }).length, 18);
assert.equal(consumed[0].rate.state, 'abstained');
assert.equal(consumed[16].rate.state, 'measured');
assert(consumed.every(function (r) { return r.linked.linked && r.rate.n <= 17; }));
assert(learning.metaLedger.hist['investments:sandbox:lane:delta'].length === 9);
assert(learning.metaLedger.hist['research-papers:sandbox:lane:delta'].length === 9);

var online = L.consolidate(learning, 1800000000000 + 11 * 3600000, 'awake');
assert.equal(online.ran, false);
assert.equal(online.refused, 'state_exclusivity');
var offline = L.consolidate(learning, 1800000000000 + 12 * 3600000, 'offline');
assert.equal(offline.ran, true);
assert.equal(offline.writeAuthority, true);
assert.equal(store.records.filter(function (r) { return r.type === 'sandbox_consolidation'; }).length, 1);
assert(offline.candidates.length >= 1);
assert(offline.promotions.every(function (p) { return p.promoted === true || p.why; }));

var snap = L.serialize(learning);
var restored = L.restore(snap, { store: new Store() });
assert.equal(L.report(restored, 1800000000000).outcomesConsumed, 18);
assert.equal(L.report(restored, 1800000000000).memory.episodic.count, 18);
assert.equal(L.report(restored, 1800000000000).consolidator.passes, 1);
assert.equal(L.report(restored, 1800000000000).metaplasticity.length, 2);

var failedStore = new Store('sandbox_learning_observation');
var failed = L.create({ motorBridge: BR.create({ store: failedStore }) });
assert.throws(function () { runOne(failed, 0); }, /forced sandbox_learning_observation failure/);
assert.equal(failed.memory.episodic.length, 0);
assert.equal(Object.keys(failed.metaLedger.hist).length, 0);
assert.equal(failed.outcomesConsumed, 0);

console.log('24/24 passed');
