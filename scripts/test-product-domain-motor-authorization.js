#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var RECEIPT = require('../lib/product-domain-motor-receipt.js');
var AUTH = require('../lib/product-domain-motor-authorization.js');

function Store(value) { this.value = value; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function () { return this.value; };

function receipt(overrides) {
  return Object.assign({
    schemaVersion: RECEIPT.SCHEMA,
    receiptId: 'pdmr_test',
    productDomain: 'communication',
    ownerDomain: 'communication',
    contractId: 'communication-motor/1',
    lane: 'social',
    status: 'EXECUTOR_PENDING',
    contracts: { decision: 'd', budget: 'b', receipt: 'r', independentOutcome: 'o', rollback: 'x' },
    verification: { executorVerified: true, independentOutcomeObserverVerified: true },
    gates: { mayDispatchExternal: true },
    blockers: [],
    safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 },
    persistedAt: 1000
  }, overrides || {});
}

(async function () {
  var authorized = await AUTH.authorize(new Store(receipt()), 'communication', 'social', 2000);
  assert.equal(authorized.authorized, true);
  assert.equal(authorized.status, 'AUTHORIZED');

  var held = await AUTH.authorize(new Store(receipt({ status: 'HELD' })), 'communication', 'social', 2000);
  assert.equal(held.authorized, false);
  assert.equal(held.reason, 'domain-motor-not-external-ready');

  var lane = await AUTH.authorize(new Store(receipt()), 'communication', 'subscriber-email', 2000);
  assert.equal(lane.authorized, false);
  assert.equal(lane.reason, 'motor-lane-mismatch');

  var stale = await AUTH.authorize(new Store(receipt()), 'communication', 'social', 1000 + AUTH.MAX_AGE_MS + 1);
  assert.equal(stale.authorized, false);
  assert.equal(stale.reason, 'domain-motor-receipt-stale');

  var unverified = await AUTH.authorize(new Store(receipt({ verification: { executorVerified: false, independentOutcomeObserverVerified: true } })), 'communication', 'social', 2000);
  assert.equal(unverified.authorized, false);
  assert.equal(unverified.reason, 'production-executor-unverified');

  var unsafe = await AUTH.authorize(new Store(receipt({ safety: { externalEffectExecuted: true, providerCalled: false, brokerTouched: false, spendUsd: 0 } })), 'communication', 'social', 2000);
  assert.equal(unsafe.authorized, false);
  assert.equal(unsafe.reason, 'pre-action-safety-state-invalid');

  var missing = await AUTH.authorize(new Store(null), 'communication', 'social', 2000);
  assert.equal(missing.authorized, false);
  assert.equal(missing.reason, 'domain-motor-receipt-missing');

  console.log('product domain motor authorization: fresh owner receipt required and all bypasses held');
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
