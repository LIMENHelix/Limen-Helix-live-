#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var RECEIPT = require('../lib/product-domain-motor-receipt.js');
var AUTH = require('../lib/product-domain-motor-authorization.js');
var CAP = require('../lib/product-domain-motor-capability.js');

function Store(value, capabilities) { this.value = value; this.capabilities = capabilities || {}; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) {
  if (key.indexOf('product_domain_motor_receipt:') === 0) return this.value;
  return this.capabilities[key] || null;
};

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

function capabilityPair(overrides) {
  var executor = Object.assign({
    schemaVersion: CAP.SCHEMA, capabilityId: 'cap_executor', kind: CAP.EXECUTOR,
    status: 'VERIFIED', environment: 'production', productDomain: 'communication',
    ownerDomain: 'communication', lane: 'social', motorContractId: 'communication-motor/1',
    contractId: 'r', adapterId: 'bluesky-adapter/1', verifierId: 'executor-auditor/1',
    evidenceReceiptId: 'executor-proof-1', rollbackVerified: true,
    verificationEffectExecuted: false, verificationSpendUsd: 0, verifiedAt: 1200, expiresAt: 5000
  }, overrides && overrides.executor || {});
  var observer = Object.assign({
    schemaVersion: CAP.SCHEMA, capabilityId: 'cap_observer', kind: CAP.OBSERVER,
    status: 'VERIFIED', environment: 'production', productDomain: 'communication',
    ownerDomain: 'communication', lane: 'social', motorContractId: 'communication-motor/1',
    contractId: 'o', adapterId: 'bluesky-read-observer/1', verifierId: 'observer-auditor/1',
    evidenceReceiptId: 'observer-proof-1', independentSourceVerified: true,
    independentOfAdapterId: 'bluesky-adapter/1', verifiedAt: 1200, expiresAt: 5000
  }, overrides && overrides.observer || {});
  var map = {};
  map[CAP.capabilityKey('communication', CAP.EXECUTOR)] = executor;
  map[CAP.capabilityKey('communication', CAP.OBSERVER)] = observer;
  return map;
}

(async function () {
  var authorized = await AUTH.authorize(new Store(receipt(), capabilityPair()), 'communication', 'social', 2000);
  assert.equal(authorized.authorized, true);
  assert.equal(authorized.status, 'AUTHORIZED');
  assert.equal(authorized.capabilities.executorCapabilityId, 'cap_executor');
  assert.equal(authorized.capabilities.observerCapabilityId, 'cap_observer');

  var held = await AUTH.authorize(new Store(receipt({ status: 'HELD' }), capabilityPair()), 'communication', 'social', 2000);
  assert.equal(held.authorized, false);
  assert.equal(held.reason, 'domain-motor-not-external-ready');

  var lane = await AUTH.authorize(new Store(receipt(), capabilityPair()), 'communication', 'subscriber-email', 2000);
  assert.equal(lane.authorized, false);
  assert.equal(lane.reason, 'motor-lane-mismatch');

  var stale = await AUTH.authorize(new Store(receipt(), capabilityPair()), 'communication', 'social', 1000 + AUTH.MAX_AGE_MS + 1);
  assert.equal(stale.authorized, false);
  assert.equal(stale.reason, 'domain-motor-receipt-stale');

  var unverified = await AUTH.authorize(new Store(receipt({ verification: { executorVerified: false, independentOutcomeObserverVerified: true } }), capabilityPair()), 'communication', 'social', 2000);
  assert.equal(unverified.authorized, false);
  assert.equal(unverified.reason, 'production-executor-unverified');

  var unsafe = await AUTH.authorize(new Store(receipt({ safety: { externalEffectExecuted: true, providerCalled: false, brokerTouched: false, spendUsd: 0 } }), capabilityPair()), 'communication', 'social', 2000);
  assert.equal(unsafe.authorized, false);
  assert.equal(unsafe.reason, 'pre-action-safety-state-invalid');

  var missing = await AUTH.authorize(new Store(null), 'communication', 'social', 2000);
  assert.equal(missing.authorized, false);
  assert.equal(missing.reason, 'domain-motor-receipt-missing');

  var selfAttested = await AUTH.authorize(new Store(receipt()), 'communication', 'social', 2000);
  assert.equal(selfAttested.authorized, false);
  assert.equal(selfAttested.reason, 'domain-executor-capability-missing');

  var sharedVerifier = await AUTH.authorize(new Store(receipt(), capabilityPair({ observer: { verifierId: 'executor-auditor/1' } })), 'communication', 'social', 2000);
  assert.equal(sharedVerifier.authorized, false);
  assert.equal(sharedVerifier.reason, 'domain-outcome-observer-not-independent');

  var wrongOutcome = await AUTH.authorize(new Store(receipt(), capabilityPair({ observer: { contractId: 'wrong' } })), 'communication', 'social', 2000);
  assert.equal(wrongOutcome.authorized, false);
  assert.equal(wrongOutcome.reason, 'domain-capability-contract-mismatch');

  var staleCapability = await AUTH.authorize(new Store(receipt(), capabilityPair({ executor: { expiresAt: 1500 } })), 'communication', 'social', 2000);
  assert.equal(staleCapability.authorized, false);
  assert.equal(staleCapability.reason, 'domain-capability-stale');

  console.log('product domain motor authorization: fresh owner receipt plus independent executor/observer evidence required');
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
