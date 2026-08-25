#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var CAP = require('../lib/product-domain-motor-capability.js');
var strictStore = require('../lib/autofire-efference-store.js');

assert.equal(CAP.capabilityKey('finance', CAP.EXECUTOR), 'product_domain_motor_capability:finance:executor');
assert.equal(CAP.capabilityKey('medicine', CAP.OBSERVER), 'product_domain_motor_capability:medicine:independent-outcome-observer');
assert.equal(strictStore.assertKey(CAP.capabilityKey('science', CAP.EXECUTOR)), 'product_domain_motor_capability:science:executor');
assert.throws(function () { CAP.capabilityKey('../finance', CAP.EXECUTOR); }, /PRODUCT_DOMAIN_INVALID/);
assert.throws(function () { CAP.capabilityKey('finance', 'combined'); }, /CAPABILITY_KIND_INVALID/);

var motor = {
  productDomain: 'finance', ownerDomain: 'finance', lane: 'broker/order',
  contractId: 'finance-motor/1', contracts: { receipt: 'finance-executor-receipt/1', independentOutcome: 'finance-pnl-observer/1' }
};
var executor = {
  schemaVersion: CAP.SCHEMA, capabilityId: 'finance-executor-cap', kind: CAP.EXECUTOR,
  status: 'VERIFIED', environment: 'production', productDomain: 'finance', ownerDomain: 'finance',
  lane: 'broker/order', motorContractId: 'finance-motor/1', contractId: 'finance-executor-receipt/1',
  adapterId: 'tradier-paper-adapter/1', verifierId: 'broker-reconciliation-auditor/1',
  evidenceReceiptId: 'broker-proof-1', rollbackVerified: true, verificationEffectExecuted: false,
  verificationSpendUsd: 0, verifiedAt: 1000, expiresAt: 3000
};
var observer = {
  schemaVersion: CAP.SCHEMA, capabilityId: 'finance-observer-cap', kind: CAP.OBSERVER,
  status: 'VERIFIED', environment: 'production', productDomain: 'finance', ownerDomain: 'finance',
  lane: 'broker/order', motorContractId: 'finance-motor/1', contractId: 'finance-pnl-observer/1',
  adapterId: 'tradier-account-observer/1', verifierId: 'outcome-auditor/1', evidenceReceiptId: 'outcome-proof-1',
  independentSourceVerified: true, independentOfAdapterId: 'tradier-paper-adapter/1', verifiedAt: 1000, expiresAt: 3000
};
assert.equal(CAP.validate(executor, CAP.EXECUTOR, motor, 2000).ok, true);
assert.equal(CAP.validate(observer, CAP.OBSERVER, motor, 2000).ok, true);
assert.equal(CAP.validate(Object.assign({}, executor, { rollbackVerified: false }), CAP.EXECUTOR, motor, 2000).reason, 'domain-executor-capability-unsafe');
assert.equal(CAP.validate(Object.assign({}, observer, { independentSourceVerified: false }), CAP.OBSERVER, motor, 2000).reason, 'domain-outcome-observer-not-independent');
assert.equal(CAP.validate(Object.assign({}, observer, { productDomain: 'economy' }), CAP.OBSERVER, motor, 2000).reason, 'domain-capability-identity-mismatch');

console.log('product domain motor capability: separate strict executor and observer evidence contracts passed');
