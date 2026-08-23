#!/usr/bin/env node
'use strict';

var assert = require('assert');
var BR = require('../core/sandbox-motor-bridge.js');
var SRC = require('../core/sandbox-outcome-source.js');

function Store() { this.records = []; this.failNext = false; }
Store.prototype.append = function (record) {
  if (this.failNext) { this.failNext = false; throw new Error('injected source failure'); }
  this.records.push(JSON.parse(JSON.stringify(record)));
};
Store.prototype.read = function () { return this.records.slice(); };

function handoff() {
  return {
    schemaVersion: 'civilization-handoff/1.0', opportunityId: 'opp-source-1',
    lane: 'research-papers', sourceDomains: ['science'],
    motorClaim: { variable: 'sandbox:research:delta', magnitude: 1 }
  };
}

var store = new Store();
var source = SRC.create({ store: store, rows: [{
  observationId: 'obs-1', sourceStream: 'sandbox-world-fixture/v1',
  sourceType: 'sandbox-world-fixture', variable: 'sandbox:world:delta',
  observedDelta: 0.25, observedAt: 2000
}] });
var bridge = BR.create({ store: store, trustN: 1 });
var command = BR.submit(bridge, handoff(), 1000);
var result = SRC.observe(source, command, 2100);
assert.strictEqual(store.records[1].type, 'sandbox_external_observation');
assert.strictEqual(store.records[1].observation.observationId, 'obs-1');
assert.strictEqual(Object.prototype.hasOwnProperty.call(store.records[1].observation, 'commandId'), false);
var completed = BR.complete(bridge, command.commandId, result, 2200);
assert.strictEqual(completed.outcome.sourceObservationId, 'obs-1');
assert.strictEqual(completed.outcome.sourceStream, 'sandbox-world-fixture/v1');
assert.strictEqual(completed.outcome.observedDelta, 0.25);
assert.strictEqual(SRC.report(source).consumed, 1);
assert.strictEqual(SRC.report(source).pending, 0);

var failedStore = new Store();
var failedSource = SRC.create({ store: failedStore, rows: [{
  observationId: 'obs-fail', sourceStream: 'sandbox-world-fixture/v1',
  sourceType: 'sandbox-world-fixture', variable: 'x', observedDelta: 1, observedAt: 1
}] });
failedStore.failNext = true;
assert.throws(function () { SRC.observe(failedSource, { commandId: 'cmd', status: 'RECEIPT_PERSISTED' }, 2); }, /injected source failure/);
assert.strictEqual(SRC.report(failedSource).consumed, 0);
assert.throws(function () { SRC.observe(source, { commandId: 'cmd', status: 'RECEIPT_PERSISTED' }, 3); }, /exhausted/);
assert.throws(function () { SRC.create({ store: new Store(), rows: [{ observationId: 'bad', sourceStream: 'x', sourceType: 'originating-domain', variable: 'x', observedDelta: 1, observedAt: 1 }] }); }, /sourceType/);
console.log('sandbox outcome source: 11/11 passed');
