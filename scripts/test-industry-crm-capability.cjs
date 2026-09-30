#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Verifier = require('../lib/industry-crm-capability-verifier.js');

function memory() {
  var data = new Map(), lists = new Map();
  function cp(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  return {
    assertDurable: function () {}, get: async function (k) { return cp(data.get(k)); },
    set: async function (k, v) { data.set(k, cp(v)); return true; },
    setIfAbsent: async function (k, v) { if (data.has(k)) return false; data.set(k, cp(v)); return true; },
    replaceIfValue: async function (k, e, v) { if (JSON.stringify(data.get(k)) !== JSON.stringify(e)) return false; data.set(k, cp(v)); return true; },
    del: async function (k) { return data.delete(k) ? 1 : 0; },
    lpush: async function (k, v) { var a = lists.get(k) || []; a.unshift(cp(v)); lists.set(k, a); return a.length; },
    ltrim: async function (k, start, stop) { lists.set(k, (lists.get(k) || []).slice(start, stop + 1)); return true; }
  };
}

function motor(now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'industry-motor-receipt-1', productDomain: 'industry', ownerDomain: 'industry',
    contractId: 'industry-motor/1', lane: 'crm', contracts: { decision: 'relationship-operation-decision/1', budget: 'industry-crm-budget/1', receipt: 'crm-receipt', independentOutcome: 'stage-transition-or-revenue', rollback: 'revert-close-or-suppress' }, measuredAt: now, status: 'HELD' };
}

(async function () {
  var store = memory();
  var held = await Verifier.commission(store, 1000, { env: {}, sleep: async function () {} });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'industry-crm-commissioning-disabled');
  await store.set(Motor.receiptKey('industry'), Object.assign(motor(1000), { contracts: null }));
  held = await Verifier.commission(store, 1000, { env: { INDUSTRY_CRM_COMMISSIONING_ENABLED: '1' }, sleep: async function () {} });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'industry-motor-receipt-missing-or-invalid');

  var records = new Map(), next = 1;
  var provider = {
    create: async function (c) {
      var id = 'commissioning-company-' + next++;
      var record = { id: id, archived: false, properties: { name: c.company, lifecyclestage: 'lead' }, createdAt: new Date().toISOString() };
      records.set(id, record); return { ok: true, id: id, providerCalled: true };
    },
    get: async function (id, archived) {
      var record = records.get(id);
      if (!record || (archived ? record.archived !== true : record.archived === true)) return { ok: false, record: null };
      return { ok: true, record: JSON.parse(JSON.stringify(record)), providerCalled: true };
    },
    archive: async function (id) { var record = records.get(id); if (!record) return { ok: false }; record.archived = true; return { ok: true, status: 204, providerCalled: true }; }
  };
  await store.set(Motor.receiptKey('industry'), motor(Date.now()));
  var result = await Verifier.commission(store, Date.now(), {
    env: { INDUSTRY_CRM_COMMISSIONING_ENABLED: '1' }, pollAttempts: 8, pollDelayMs: 0, sleep: async function () {}, provider: provider,
    adapterGuard: { checkpoint: async function () { return { allowed: true, valveId: 'industry:crm' }; } }
  });
  assert.equal(result.status, 'VERIFIED');
  assert(result.commissioning.hubspotCompanyId);
  assert.equal(result.commissioning.providerCalled, true);
  assert.equal(records.get(result.commissioning.hubspotCompanyId).archived, true);
  assert.equal((await Cap.verifyPair(store, await store.get(Motor.receiptKey('industry')), Date.now() + 1000)).ok, true);
  var duplicate = await Verifier.commission(store, Date.now() + 1000, { env: { INDUSTRY_CRM_COMMISSIONING_ENABLED: '1' }, sleep: async function () {} });
  assert.equal(duplicate.status, 'VERIFIED');
  assert.equal(duplicate.duplicate, true);
  await store.del(Cap.capabilityKey('industry', Cap.EXECUTOR));
  var audit = await Verifier.audit(store, Date.now() + 1000);
  assert.equal(audit.capabilities.reason, 'domain-executor-capability-missing');
  assert.equal(audit.commissioning.status, 'VERIFIED');
  console.log('industry CRM capability: bounded create, independent read, archive, archived readback, pair persistence, renewal, and fail-closed audit passed');
})().catch(function (e) { console.error(e); process.exit(1); });
