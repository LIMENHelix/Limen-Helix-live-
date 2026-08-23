#!/usr/bin/env node
'use strict';

var assert = require('assert');
var BR = require('../core/sandbox-motor-bridge.js');

function Store() {
  this.records = [];
  this.failNext = false;
}
Store.prototype.append = function (record) {
  if (this.failNext) { this.failNext = false; throw new Error('injected store failure'); }
  this.records.push(JSON.parse(JSON.stringify(record)));
};
Store.prototype.read = function () { return this.records.slice(); };

function handoff(lane) {
  return {
    schemaVersion: 'civilization-handoff/1.0',
    opportunityId: 'opp-sandbox-1',
    lane: lane,
    sourceDomains: ['finance'],
    sourceDiagnoses: [{ domain: 'finance', id: 'DX_FIN', summary: 'fixture' }],
    sourceTreatments: [{ domain: 'finance', treatment: { id: 'TX_FIN' } }],
    motorClaim: { variable: 'sandbox:receiptDelta', magnitude: 1 }
  };
}

var store = new Store();
var bridge = BR.create({ store: store, trustN: 1 });
var command = BR.submit(bridge, handoff('investments'), 1000);
assert.strictEqual(command.status, 'RECEIPT_PERSISTED');
assert.strictEqual(store.records.length, 1);
assert.strictEqual(store.records[0].type, 'sandbox_command_receipt');
assert.strictEqual(store.records[0].command.commandId, command.commandId);
assert.strictEqual(command.resultProduced, false);

var outcome = BR.complete(bridge, command.commandId, {
  outcomeId: 'sandbox-outcome-1',
  sourceType: 'sandbox-counterfactual',
  independentOf: 'originating-domain-observation',
  observedDelta: 0.8,
  observedAt: 1100
}, 1200);
assert.strictEqual(outcome.command.status, 'OUTCOME_PERSISTED');
assert.strictEqual(store.records[1].type, 'sandbox_outcome');
assert.strictEqual(store.records[2].type, 'sandbox_forward_model_update');
assert.strictEqual(outcome.learned.updated, true);
assert.strictEqual(outcome.latency.updated, true);
assert.strictEqual(outcome.outcome.reafference.trusted, false);
assert.strictEqual(outcome.outcome.reafference.residualDelta, 0.8);
assert.strictEqual(BR.report(bridge).commands, 1);
assert.strictEqual(BR.report(bridge).outcomes, 1);
assert.strictEqual(BR.report(bridge).pending, 0);

// The bridge refuses non-active lanes and unlabelled/non-independent outcomes.
assert.throws(function () { BR.submit(bridge, handoff('systemic-risk'), 2000); }, /not an active/);
var pending = BR.submit(bridge, Object.assign(handoff('research-papers'), { opportunityId: 'opp-sandbox-2' }), 2000);
assert.throws(function () { BR.complete(bridge, pending.commandId, {
  outcomeId: 'bad', sourceType: 'originating-domain', independentOf: 'originating-domain-observation', observedDelta: 1, observedAt: 2100
}, 2200); }, /sourceType/);
assert.strictEqual(BR.report(bridge).pending, 1);

// A failed receipt write prevents command creation and therefore prevents a result.
var failedStore = new Store();
failedStore.failNext = true;
var failedBridge = BR.create({ store: failedStore });
assert.throws(function () { BR.submit(failedBridge, handoff('investments'), 3000); }, /injected store failure/);
assert.strictEqual(BR.report(failedBridge).commands, 0);
assert.throws(function () { BR.complete(failedBridge, 'never-persisted', {
  outcomeId: 'bad', sourceType: 'sandbox-counterfactual', independentOf: 'originating-domain-observation', observedDelta: 1, observedAt: 3100
}, 3200); }, /unknown or unpersisted/);

// Serialize/restore preserves command state and forward-model observations.
var snap = BR.serialize(bridge);
var restored = BR.restore(snap, { store: store });
assert.strictEqual(BR.report(restored).commands, BR.report(bridge).commands);
assert.strictEqual(BR.report(restored).outcomes, BR.report(bridge).outcomes);
assert.strictEqual(BR.report(restored).forwardModel.updates, BR.report(bridge).forwardModel.updates);

console.log('sandbox motor bridge: 18/18 passed');
