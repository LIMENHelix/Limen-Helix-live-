#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Publisher = require('../lib/governance-publication-publisher.js');
var Verifier = require('../lib/governance-publication-capability-verifier.js');

function memory() {
  var data = new Map(), lists = new Map();
  function copy(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  return {
    assertDurable: function () {}, get: async function (key) { return copy(data.get(key)); },
    set: async function (key, value) { data.set(key, copy(value)); return true; },
    setIfAbsent: async function (key, value) { if (data.has(key)) return false; data.set(key, copy(value)); return true; },
    replaceIfValue: async function (key, expected, value) { if (JSON.stringify(data.get(key)) !== JSON.stringify(expected)) return false; data.set(key, copy(value)); return true; },
    del: async function (key) { return data.delete(key) ? 1 : 0; },
    lpush: async function (key, value) { var list = lists.get(key) || []; list.unshift(copy(value)); lists.set(key, list); return list.length; },
    ltrim: async function (key, start, stop) { lists.set(key, (lists.get(key) || []).slice(start, stop + 1)); return true; }
  };
}
function motor(now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'governance-motor-receipt-1', productDomain: 'governance', ownerDomain: 'governance',
    contractId: 'governance-motor/1', lane: 'publication', contracts: { receipt: 'publication-receipt', independentOutcome: 'reach-engagement-or-conversion' }, measuredAt: now, status: 'HELD' };
}

(async function () {
  var store = memory();
  var held = await Verifier.commission(store, Date.now(), { env: {}, sleep: async function () {} });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'governance-publication-commissioning-disabled');
  await store.set(Motor.receiptKey('governance'), Object.assign(motor(Date.now()), { contracts: null }));
  held = await Verifier.commission(store, Date.now(), { env: { GOVERNANCE_PUBLICATION_COMMISSIONING_ENABLED: '1' }, sleep: async function () {} });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'governance-motor-receipt-missing-or-invalid');
  await store.set(Motor.receiptKey('governance'), motor(Date.now()));
  var result = await Verifier.commission(store, Date.now(), {
    env: { GOVERNANCE_PUBLICATION_COMMISSIONING_ENABLED: '1' }, pollAttempts: 8, pollDelayMs: 0, sleep: async function () {},
    adapterGuard: { checkpoint: async function () { return { allowed: true, valveId: 'governance:publication' }; } }, publisher: Publisher,
    observePresence: async function () { return { status: 'PUBLIC_PRESENCE_OBSERVED', observationId: 'governance-presence-proof-1' }; },
    observePublicAbsence: async function () { return true; }
  });
  assert.equal(result.status, 'VERIFIED');
  assert(result.commissioning.articleId);
  assert.equal((await Publisher.getPublic(store, result.commissioning.articleId)), null);
  assert.equal((await Cap.verifyPair(store, await store.get(Motor.receiptKey('governance')), Date.now() + 1000)).ok, true);
  var duplicate = await Verifier.commission(store, Date.now() + 1000, { env: { GOVERNANCE_PUBLICATION_COMMISSIONING_ENABLED: '1' }, sleep: async function () {} });
  assert.equal(duplicate.status, 'VERIFIED');
  assert.equal(duplicate.duplicate, true);
  await store.del(Cap.capabilityKey('governance', Cap.EXECUTOR));
  var audit = await Verifier.audit(store, Date.now() + 1000);
  assert.equal(audit.capabilities.reason, 'domain-executor-capability-missing');
  assert.equal(audit.commissioning.status, 'VERIFIED');
  console.log('governance publication capability: bounded owned create, independent presence read, unpublish, absence proof, pair persistence, renewal, and fail-closed audit passed');
})().catch(function (error) { console.error(error); process.exit(1); });
