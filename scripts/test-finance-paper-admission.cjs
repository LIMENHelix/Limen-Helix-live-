#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Producer = require('../lib/finance-opportunity-producer.js');
const Admission = require('../lib/finance-paper-admission.js');

function candidate() {
  return {
    schemaVersion: Producer.CANDIDATE_SCHEMA,
    proposalSchemaVersion: Producer.SCHEMA,
    id: 'paper-candidate-1', status: 'PAPER_CANDIDATE', lane: 'investment', ownerDomain: 'finance',
    simulationOnly: true, liveExecution: false,
    company: { cik: '1108524', slug: 'salesforce', ticker: 'CRM' },
    evidenceRefs: [{ role: 'semantic', sourceIdentity: { kind: 'headline-title', value: 'finance:sec:1' } }],
    blockers: []
  };
}
function previewReceipt(packetId, change) {
  return Object.assign({
    schemaVersion: 'finance-preview-receipt/1.0', packetId,
    completedAt: '2026-08-25T01:00:00Z', status: 'PAPER_CANDIDATE', providerCalled: true,
    selectedCompany: { slug: 'salesforce', ticker: 'CRM' }, candidate: candidate(),
    safety: { candidateReleased: false, brokerTouched: false, orderPlaced: false, liveMoney: false }
  }, change || {});
}
function storeWith(packetId, receipt) {
  const values = new Map([['finance_preview:' + packetId, receipt]]), log = [];
  return {
    values, log, durableChecks: 0,
    assertDurable() { this.durableChecks++; return true; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async setIfAbsent(key, value) { if (values.has(key)) return false; values.set(key, value); return true; },
    async lpush(key, value) { log.unshift({ key, value }); return log.length; },
    async ltrim() { return true; }
  };
}

(async function () {
  const packetId = 'finance:3:paper-admission-test';
  const store = storeWith(packetId, previewReceipt(packetId));
  let audit = await Admission.audit(store, packetId);
  assert.equal(audit.status, 'READY_FOR_PAPER_ADMISSION');
  assert.equal(audit.brokerTouched, false);

  let result = await Admission.execute(store, { approve: false, packetId });
  assert.equal(result.reason, 'explicit_paper_admission_required');
  assert.equal(store.log.length, 0);

  result = await Admission.execute(store, { approve: true, packetId }, { now: '2026-08-25T01:01:00Z' });
  assert.equal(result.ok, true);
  assert.equal(result.idempotent, false);
  assert.equal(result.receipt.status, 'ADMITTED_TO_PAPER');
  assert.equal(result.receipt.candidate.status, 'READY_TO_FIRE');
  assert.equal(result.receipt.replayCandidate.status, 'READY_TO_FIRE');
  assert.equal(result.receipt.replayCandidate.portalTicker, 'CRM');
  assert.equal(result.receipt.replayCandidate.id, 'paper-candidate-1');
  assert.equal(result.receipt.replayCandidate.company.slug, 'salesforce');
  assert.equal(result.receipt.replayCandidate.sourcePacketId, packetId);
  assert.equal(result.receipt.safety.candidateReleased, true);
  assert.equal(result.receipt.safety.releasedTo, 'paper-replay');
  assert.equal(result.receipt.safety.brokerTouched, false);
  assert.equal(result.receipt.safety.orderPlaced, false);
  assert.equal(result.receipt.safety.liveMoney, false);
  assert.equal(store.log.length, 1);

  const duplicate = await Admission.execute(store, { approve: true, packetId });
  assert.equal(duplicate.idempotent, true);
  assert.equal(store.log.length, 1);

  const blockedId = 'finance:3:blocked';
  const blockedStore = storeWith(blockedId, previewReceipt(blockedId, { status: 'ABSTAINED' }));
  const blocked = await Admission.execute(blockedStore, { approve: true, packetId: blockedId });
  assert.equal(blocked.status, 'ABSTAINED');
  assert.equal(blocked.reason, 'finance_preview_paper_candidate_required');
  assert.equal(blockedStore.log.length, 0);

  const unsafeId = 'finance:3:unsafe';
  const unsafeStore = storeWith(unsafeId, previewReceipt(unsafeId, {
    safety: { candidateReleased: true, brokerTouched: false, orderPlaced: false, liveMoney: false }
  }));
  const unsafe = await Admission.audit(unsafeStore, unsafeId);
  assert(unsafe.blockers.includes('finance_preview_safety_boundary_invalid'));

  assert.equal(Admission.receiptBlockers(null)[0], 'finance_preview_receipt_required');
  assert.equal(store.durableChecks >= 3, true);
  console.log('finance paper admission: 24/24 passed');
}()).catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
