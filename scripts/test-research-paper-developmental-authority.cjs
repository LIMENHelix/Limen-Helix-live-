#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Developmental = require('../lib/research-paper-developmental-authority.js');
var MotorReceipt = require('../lib/product-domain-motor-receipt.js');

function storeDouble() {
  var values = new Map(), logs = [];
  return {
    values: values,
    logs: logs,
    assertDurable: function () { return true; },
    get: async function (key) { return values.has(key) ? JSON.parse(JSON.stringify(values.get(key))) : null; },
    set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    setIfAbsent: async function (key, value) {
      if (values.has(key)) return false;
      values.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    },
    lpush: async function (key, value) { logs.push({ key: key, value: JSON.parse(JSON.stringify(value)) }); return logs.length; },
    ltrim: async function () { return true; }
  };
}

function motor(productDomain, now) {
  var identity = Developmental.OWNERS[productDomain];
  return {
    schemaVersion: MotorReceipt.SCHEMA,
    receiptId: 'pdmr_' + productDomain,
    productDomain: identity.productDomain,
    ownerDomain: identity.ownerDomain,
    contractId: identity.contractId,
    lane: identity.lane,
    contracts: {
      decision: 'research-artifact-decision/1', budget: identity.budgetId,
      receipt: 'artifact-receipt', independentOutcome: 'citation-use-or-falsification',
      rollback: 'withdraw-or-correct'
    },
    status: 'HELD',
    persistedAt: now,
    gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: false },
    safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 }
  };
}

function selection(productDomain, id) {
  var identity = Developmental.OWNERS[productDomain];
  return {
    id: id,
    status: 'RELEASED',
    lane: 'research',
    command: 'generate_research_artifact',
    ownerDomain: identity.ownerDomain,
    candidate: { sourceIdentity: { kind: 'master-inbox-artifact', value: productDomain + ':source:1' } },
    authority: { artifactGenerationOnly: true, liveTradingAuthorized: false }
  };
}

(async function () {
  var now = 100000;
  var store = storeDouble();
  store.values.set(MotorReceipt.receiptKey('science'), motor('science', now));
  store.values.set(MotorReceipt.receiptKey('medicine'), motor('medicine', now));
  store.values.set(MotorReceipt.receiptKey('education'), motor('education', now));

  var off = await Developmental.authorize(store, 'science', selection('science', 'sel-off'), {}, now);
  assert.equal(off.authorized, false);
  assert.equal(off.reason, 'research-developmental-switch-off');
  assert.equal(store.values.has(Developmental.slotKey('science')), false);

  var scienceEnv = { LIMEN_SCIENCE_RESEARCH_DEVELOPMENTAL_ENABLED: '1' };
  var wrongOwner = selection('science', 'sel-wrong');
  wrongOwner.ownerDomain = 'health';
  var wrong = await Developmental.authorize(store, 'science', wrongOwner, scienceEnv, now);
  assert.equal(wrong.reason, 'research-developmental-selection-invalid');
  assert.equal(store.values.has(Developmental.slotKey('science')), false);

  store.values.get(MotorReceipt.receiptKey('science')).persistedAt =
    now - require('../lib/product-domain-motor-authorization.js').MAX_AGE_MS - 1;
  var stale = await Developmental.authorize(store, 'science', selection('science', 'sel-stale'), scienceEnv, now);
  assert.equal(stale.reason, 'research-developmental-motor-receipt-invalid');
  store.values.set(MotorReceipt.receiptKey('science'), motor('science', now));

  store.values.get(MotorReceipt.receiptKey('science')).contracts.budget = 'medicine-research-budget/1';
  var borrowedBudget = await Developmental.authorize(store, 'science', selection('science', 'sel-borrowed-budget'), scienceEnv, now);
  assert.equal(borrowedBudget.reason, 'research-developmental-motor-receipt-invalid');
  assert.equal(store.values.has(Developmental.slotKey('science')), false);
  store.values.set(MotorReceipt.receiptKey('science'), motor('science', now));

  var scienceSelection = selection('science', 'sel-science-1');
  var science = await Developmental.authorize(store, 'science', scienceSelection, scienceEnv, now);
  assert.equal(science.authorized, true);
  assert.equal(science.authorizationMode, 'developmental-research-paper');
  assert.equal(science.productDomain, 'science');
  assert.equal(science.ownerDomain, 'research');
  assert.equal(science.slot.maxProviderCalls, 1);
  assert.equal(science.slot.maxArtifacts, 1);
  assert.equal(science.slot.publicationAuthorized, false);
  assert.equal(science.slot.saleAuthorized, false);
  assert.equal(science.slot.liveMoney, false);

  var secondScience = await Developmental.authorize(store, 'science', selection('science', 'sel-science-2'), scienceEnv, now + 1);
  assert.equal(secondScience.authorized, false);
  assert.equal(secondScience.reason, 'research-developmental-attempt-cap-reached');

  var resolved = await Developmental.resolve(store, science, {
    ok: true,
    billableAttempt: true,
    outputId: 'eo_science_1',
    actionId: 'act_science_1',
    efferenceCopyId: 'efx_science_1'
  }, { status: 'EXECUTED' });
  assert.equal(resolved.status, 'ARTIFACT_PERSISTED');
  assert.equal(resolved.outputId, 'eo_science_1');
  assert.equal(resolved.providerCalled, true);
  assert.equal(resolved.budgetDebitEstimateUsd, Developmental.ESTIMATED_CALL_BUDGET_USD);
  assert.equal(resolved.externalPublication, false);
  await assert.rejects(
    Developmental.resolve(store, science, { ok: true, outputId: 'eo_duplicate' }, { status: 'EXECUTED' }),
    /resolution-claim-invalid/
  );

  var medicineEnv = { LIMEN_MEDICINE_RESEARCH_DEVELOPMENTAL_ENABLED: '1' };
  var medicine = await Developmental.authorize(store, 'medicine', selection('medicine', 'sel-medicine-1'), medicineEnv, now);
  assert.equal(medicine.authorized, true);
  assert.notEqual(medicine.receiptId, science.receiptId);
  assert.notEqual(Developmental.slotKey('medicine'), Developmental.slotKey('science'));
  var medicineResolved = await Developmental.resolve(store, medicine, {
    ok: false, billableAttempt: false, reason: 'efference-command-refused'
  }, null);
  assert.equal(medicineResolved.status, 'ATTEMPT_RESOLVED_NO_ARTIFACT');
  assert.equal(medicineResolved.providerCalled, false);
  assert.equal(medicineResolved.budgetDebitEstimateUsd, 0);

  var educationEnv = { LIMEN_EDUCATION_RESEARCH_DEVELOPMENTAL_ENABLED: '1' };
  var education = await Developmental.authorize(store, 'education', selection('education', 'sel-education-1'), educationEnv, now);
  assert.equal(education.authorized, true);
  assert.equal(education.productDomain, 'education');
  assert.equal(education.ownerDomain, 'education');
  assert.notEqual(education.receiptId, science.receiptId);
  assert.notEqual(Developmental.slotKey('education'), Developmental.slotKey('science'));
  assert.equal(education.slot.publicationAuthorized, false);
  assert.equal(education.slot.saleAuthorized, false);
  assert.equal(education.slot.liveMoney, false);

  var unreadable = storeDouble();
  unreadable.values.set(MotorReceipt.receiptKey('science'), motor('science', now));
  unreadable.setIfAbsent = async function () { return true; };
  var failedReadback = await Developmental.authorize(unreadable, 'science', selection('science', 'sel-readback'), scienceEnv, now);
  assert.equal(failedReadback.authorized, false);
  assert.equal(failedReadback.reason, 'research-developmental-claim-readback-failed');

  assert.equal(store.logs.filter(function (row) { return row.key === Developmental.LOG_KEY; }).length, 5);
  console.log('research developmental authority: separate one-attempt Science/Medicine/Education claims, strict readback, resolution, and no publication passed');
})().catch(function (error) {
  console.error(error && error.stack || error);
  process.exit(1);
});
