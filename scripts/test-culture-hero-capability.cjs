#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Verifier = require('../lib/culture-hero-capability-verifier.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () {};
Store.prototype.get = async function (key) { return this.values.has(key) ? structuredClone(this.values.get(key)) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, structuredClone(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values.has(key)) return false; this.values.set(key, structuredClone(value)); return true; };
Store.prototype.replaceIfValue = async function (key, expected, value) {
  if (JSON.stringify(this.values.get(key)) !== JSON.stringify(expected)) return false;
  this.values.set(key, structuredClone(value)); return true;
};
Store.prototype.lpush = async function (key, value) { var list = this.lists.get(key) || []; list.unshift(structuredClone(value)); this.lists.set(key, list); return list.length; };
Store.prototype.ltrim = async function (key, start, stop) { this.lists.set(key, (this.lists.get(key) || []).slice(start, stop + 1)); return true; };

function motor(now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'culture-motor-receipt-1', productDomain: 'culture', ownerDomain: 'culture',
    contractId: 'culture-motor/1', lane: 'hero-image', contracts: {
      decision: 'media-artifact-decision/1', budget: 'culture-media-budget/1', receipt: 'asset-receipt',
      independentOutcome: 'usage-engagement-or-conversion', rollback: 'replace-or-remove'
    }, measuredAt: now, status: 'EXECUTOR_PENDING' };
}
function cognition(now) {
  return { ts: now, c: { domain: 'culture', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'culture', packetId: 'culture-capability-packet', generatedAt: new Date(now).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 16, live: 15 } } } } };
}

(async function () {
  var now = Date.now(), store = new Store();
  var disabled = await Verifier.commission(store, now, { env: {}, sleep: async function () {} });
  assert.equal(disabled.status, 'HELD');
  assert.equal(disabled.reason, 'culture-hero-capability-commissioning-disabled');

  await store.set(Motor.receiptKey('culture'), Object.assign(motor(now), { contracts: null }));
  var invalid = await Verifier.commission(store, now, { env: { CULTURE_HERO_CAPABILITY_COMMISSIONING_ENABLED: '1' }, sleep: async function () {} });
  assert.equal(invalid.status, 'HELD');
  assert.equal(invalid.reason, 'culture-motor-receipt-missing-or-invalid');

  await store.set(Motor.receiptKey('culture'), motor(now));
  var providerCalls = 0, observerReads = 0;
  var deps = {
    env: { CULTURE_HERO_CAPABILITY_COMMISSIONING_ENABLED: '1' }, pollAttempts: 8, pollDelayMs: 0, stepNow: now,
    sleep: async function () {}, cognition: cognition(now), allowAnyHttpsForTest: true,
    adapterGuard: { checkpoint: async function () { return { allowed: true, valveId: 'culture:hero-image' }; } },
    provider: { generate: async function () { providerCalls++; return { ok: true, url: 'https://assets.example/culture-capability.jpg', requestId: 'culture-capability-1', spentUsd: 0 }; } },
    fetch: async function () { observerReads++; return { status: 200, headers: { get: function () { return 'image/jpeg'; } }, arrayBuffer: async function () { return Buffer.from('culture-capability-image'); } }; },
    observePublicCatalog: async function () { return { ok: true, images: {} }; },
    motorAuthorization: { authorize: async function (_store, _domain, _lane, _at) {
      return { authorized: true, receiptId: 'culture-commissioning-receipt-' + (providerCalls ? 'recovery' : 'executor'), productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image' };
    } }
  };
  var result = await Verifier.commission(store, now, deps);
  assert.equal(result.status, 'VERIFIED');
  assert.equal(providerCalls, 1);
  assert.equal(observerReads, 1);
  assert(result.commissioning.commandId);
  assert(result.commissioning.recoveryId);
  assert.equal(result.capabilities.ok, true);
  assert.equal((await Cap.verifyPair(store, await store.get(Motor.receiptKey('culture')), now + 1000)).ok, true);

  var duplicate = await Verifier.commission(store, now + 1000, deps);
  assert.equal(duplicate.status, 'VERIFIED');
  assert.equal(duplicate.duplicate, true);
  assert.equal(providerCalls, 1);

  await store.set(Cap.capabilityKey('culture', Cap.EXECUTOR), null);
  var audit = await Verifier.audit(store, now + 1000);
  assert.equal(audit.capabilities.reason, 'domain-executor-capability-missing');
  assert.equal(audit.commissioning.status, 'VERIFIED');
  console.log('culture hero capability: disabled-by-default commissioning, decision, provider action, independent public read, suppression, absence proof, pair persistence, duplicate safety, and fail-closed audit passed');
})().catch(function (error) { console.error(error); process.exit(1); });
