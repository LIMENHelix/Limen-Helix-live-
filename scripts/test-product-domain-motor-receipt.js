#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var RECEIPT = require('../lib/product-domain-motor-receipt.js');

function state(owner, dispatch) {
  return {
    resourceMetabolism: {
      schemaVersion: 'product-domain-resource-metabolism/1.0',
      ownerDomain: owner,
      state: 'AVAILABLE'
    },
    motorReadiness: {
      schemaVersion: 'product-domain-motor-readiness/1.0',
      ownerDomain: owner,
      contractId: owner + '-motor/1',
      lane: owner === 'finance' ? 'broker/order' : 'investments',
      contracts: {
        decision: 'decision/1',
        budget: owner + '-budget/1',
        receipt: 'durable-receipt',
        independentOutcome: 'independent-outcome',
        rollback: 'bounded-rollback'
      },
      verification: { executorVerified: false, independentOutcomeObserverVerified: false },
      gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: dispatch === true },
      blockers: dispatch ? [] : ['domain_external_motor_switch_off'],
      measuredAt: 1000
    }
  };
}
function Store() { this.data = {}; this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.set = async function (key, value) { this.data[key] = JSON.parse(JSON.stringify(value)); return true; };
Store.prototype.get = async function (key) { return this.data[key] || null; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

(async function () {
  var store = new Store();
  var result = await RECEIPT.persist(store, 'finance', state('finance', false), 'refresh:1', 2000);
  assert.equal(result.ok, true);
  assert.equal(result.restored, true);
  assert.equal(result.receipt.status, 'HELD');
  assert.equal(result.receipt.productDomain, 'finance');
  assert.equal(result.receipt.ownerDomain, 'finance');
  assert.equal(result.receipt.contracts.budget, 'finance-budget/1');
  assert.equal(result.receipt.safety.externalEffectExecuted, false);
  assert.equal(result.receipt.safety.spendUsd, 0);
  assert.equal(store.log.length, 1);

  var ready = RECEIPT.build('finance', state('finance', true), 'refresh:2', 3000);
  assert.equal(ready.status, 'EXECUTOR_PENDING');
  assert.equal(ready.safety.externalEffectExecuted, false, 'readiness must never masquerade as an executor receipt');

  var wrong = state('finance', false);
  wrong.resourceMetabolism.ownerDomain = 'energy';
  var refused = await RECEIPT.persist(store, 'finance', wrong, 'refresh:3', 4000);
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'MOTOR_RESOURCE_OWNER_MISMATCH');

  var failedStore = new Store();
  failedStore.get = async function () { return null; };
  var notRestored = await RECEIPT.persist(failedStore, 'energy', state('energy', false), 'refresh:4', 5000);
  assert.equal(notRestored.ok, false);
  assert.equal(notRestored.error, 'MOTOR_RECEIPT_READBACK_FAILED');
  assert.equal(failedStore.log.length, 0, 'discovery log must not claim a receipt that failed read-back');

  console.log('product domain motor receipt: owner identity, strict read-back, safety, and anti-execution passed');
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
