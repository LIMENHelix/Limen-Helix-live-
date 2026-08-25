#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Overlay = require('../lib/product-domain-motor-capability-overlay.js');
var Capability = require('../lib/product-domain-motor-capability.js');

function brain() {
  return {
    motorAuthority: {
      ownerDomain: 'finance', contractId: 'finance-motor/1', lane: 'broker/order',
      executorVerified: false, outcomeObserverVerified: false
    },
    state: {
      resourceMetabolism: { schemaVersion: 'product-domain-resource-metabolism/1.0', ownerDomain: 'finance' },
      motorReadiness: {
        schemaVersion: 'product-domain-motor-readiness/1.0', ownerDomain: 'finance',
        contractId: 'finance-motor/1', lane: 'broker/order',
        contracts: { decision: 'd', budget: 'b', receipt: 'r', independentOutcome: 'o', rollback: 'x' },
        gates: { mayDispatchExternal: false }, blockers: []
      }
    },
    _computeMotorReadiness: function () {
      this.state.motorReadiness.verification = {
        executorVerified: this.motorAuthority.executorVerified,
        independentOutcomeObserverVerified: this.motorAuthority.outcomeObserverVerified
      };
      this.state.motorReadiness.gates.mayDispatchExternal = false;
      return this.state.motorReadiness;
    }
  };
}

function capabilities(now) {
  var common = {
    schemaVersion: Capability.SCHEMA, status: 'VERIFIED', environment: 'production',
    productDomain: 'finance', ownerDomain: 'finance', lane: 'broker/order',
    motorContractId: 'finance-motor/1', verifiedAt: now - 1000, expiresAt: now + 10000
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'executor-cap', kind: Capability.EXECUTOR, contractId: 'r',
    adapterId: 'tradier-paper-adapter/1', verifierId: 'executor-verifier/1',
    evidenceReceiptId: 'executor-evidence/1', rollbackVerified: true,
    verificationEffectExecuted: false, verificationSpendUsd: 0
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'observer-cap', kind: Capability.OBSERVER, contractId: 'o',
    adapterId: 'tradier-observer/1', verifierId: 'observer-verifier/1',
    evidenceReceiptId: 'observer-evidence/1', independentSourceVerified: true,
    independentOfAdapterId: 'tradier-paper-adapter/1'
  });
  var map = {};
  map[Capability.capabilityKey('finance', Capability.EXECUTOR)] = executor;
  map[Capability.capabilityKey('finance', Capability.OBSERVER)] = observer;
  return map;
}

function Store(values) { this.values = values || {}; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values[key] || null; };

(async function () {
  var now = Date.parse('2026-08-25T15:00:00Z');
  var verifiedBrain = brain();
  var verified = await Overlay.apply(new Store(capabilities(now)), 'finance', verifiedBrain, 'refresh-1', now);
  assert.equal(verified.verified, true);
  assert.equal(verifiedBrain.motorAuthority.executorVerified, true);
  assert.equal(verifiedBrain.motorAuthority.outcomeObserverVerified, true);
  assert.equal(verifiedBrain.state.motorReadiness.verification.executorVerified, true);
  assert.equal(verifiedBrain.state.motorReadiness.gates.mayDispatchExternal, false);

  var heldBrain = brain();
  heldBrain.motorAuthority.executorVerified = true;
  heldBrain.motorAuthority.outcomeObserverVerified = true;
  var held = await Overlay.apply(new Store(), 'finance', heldBrain, 'refresh-2', now);
  assert.equal(held.verified, false);
  assert.equal(held.reason, 'domain-executor-capability-missing');
  assert.equal(heldBrain.motorAuthority.executorVerified, false);
  assert.equal(heldBrain.motorAuthority.outcomeObserverVerified, false);

  var wrongOwner = brain();
  wrongOwner.state.resourceMetabolism.ownerDomain = 'economy';
  var mismatch = await Overlay.apply(new Store(capabilities(now)), 'finance', wrongOwner, 'refresh-3', now);
  assert.equal(mismatch.verified, false);
  assert.match(mismatch.reason, /MOTOR_RESOURCE_OWNER_MISMATCH|unavailable/);

  console.log('product domain motor capability overlay: domain-local evidence import, stale-positive clearing, and external-switch isolation passed');
})().catch(function (error) { console.error(error); process.exit(1); });
