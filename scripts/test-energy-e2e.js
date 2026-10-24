#!/usr/bin/env node
'use strict';

/**
 * test-energy-e2e.js — isolated Energy E2E cycle.
 *
 * No network, no Stripe, no email, no production write. The public observation
 * is a fixture; the order, delivery, accounting, outcome and learning are
 * isolated test records.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cycle = require('../lib/energy-e2e-cycle');
const catalog = require('../lib/offer-catalog');

const ROOT = path.join(__dirname, '..');
const NOW = Date.parse('2026-10-23T23:50:00.000Z');
const domain = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/domains/energy.json'), 'utf8'));
const canonicalNodes = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/canonical-nodes.json'), 'utf8'));
const nodeDomains = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/brain-node-domains.json'), 'utf8'));
const offer = Object.assign({ id: 'energy.p2' }, catalog.lookup('energy', 'p2'));

let passed = 0;
function pass(name) { passed++; console.log('  PASS ' + name); }

function fixture(overrides) {
  const energy = Object.assign({
    stress: 0.72,
    maturity: 'STRUCTURAL',
    phase: 'p5',
    phaseLabel: 'ENDURANCE',
    phaseSource: 'stress-heuristic',
    phaseGrounded: false,
    phasePrecision: 0,
    phaseSalience: 'prior-only (ungrounded)',
    phaseEvidence: { scored: 0, coverage: 0, distribution: {} },
    confidence: 0.89,
    topSignal: '5 event clusters (nuclear threat)',
    sources: [
      { name: 'Grid Reliability (FERC/NERC)', live: true, channel: 'stress' },
      { name: 'EIA Petroleum', live: true, channel: 'stress' },
      { name: 'OPEC Reference Basket', live: true, channel: 'stress' },
      { name: 'NOAA', live: false, channel: 'stress' }
    ],
    _confidence: { sourceQuality: 0.73, corroboration: 1, specificity: 0.89, recency: 1 }
  }, overrides && overrides.energy ? overrides.energy : {});
  return {
    generatedAt: overrides && overrides.generatedAt != null ? overrides.generatedAt : NOW - 60000,
    _ageSeconds: overrides && overrides._ageSeconds != null ? overrides._ageSeconds : 60,
    _stale: true,
    _capture: {
      endpoint: 'fixture://energy',
      capturedAt: new Date(NOW - 60000).toISOString(),
      sha256: 'a'.repeat(64)
    },
    domains: { energy: energy }
  };
}

function input(store, snapshot, extra) {
  return Object.assign({
    snapshot: snapshot,
    now: NOW,
    domain: domain,
    canonicalNodes: canonicalNodes,
    nodeDomains: nodeDomains,
    offer: offer,
    customer: cycle.TEST_CUSTOMER,
    outcome: cycle.TEST_OUTCOME,
    service: cycle.SERVICE
  }, extra || {});
}

async function countKeys(store, prefix) {
  const keys = await store.keys();
  return keys.filter(function (k) { return k.indexOf(prefix) === 0; }).length;
}

(async function main() {
  console.log('ENERGY-E2E happy path');
  const store = cycle.createMemoryStore();
  const result = await cycle.runCycle(store, input(store, fixture()));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.trace.status, 'COMPLETE');
  assert.strictEqual(result.trace.mode, 'TEST');
  assert.strictEqual(result.trace.issue.id, 'SYSTEMIC_ENERGY_STRESS');
  assert.strictEqual(result.trace.node.nodeId, 'HIPP');
  assert.strictEqual(result.trace.node.canonical, true);
  assert.strictEqual(result.trace.node.canBindBusiness, true);
  assert.strictEqual(result.trace.treatment.selected.label, 'Battery Management System Optimization');
  assert.strictEqual(result.order.mode, 'test');
  assert.strictEqual(result.order.liveMoney, false);
  assert.strictEqual(result.order.realRevenue, false);
  assert.strictEqual(result.order.amountCents, 400);
  assert.strictEqual(result.trace.fulfillment.receipt.delivered, true);
  assert.strictEqual(result.trace.fulfillment.receipt.realExternalDelivery, false);
  assert.strictEqual(result.trace.accounting.testRevenueCents, 400);
  assert.strictEqual(result.trace.accounting.testCostCents, 50);
  assert.strictEqual(result.trace.accounting.realRevenueCents, 0);
  assert.strictEqual(result.trace.accounting.energyAccount.availableCashCents, 350);
  assert.strictEqual(result.trace.accounting.energyAccount.pendingCashCents, 0);
  assert.strictEqual(result.trace.outcome.acknowledged, true);
  assert.strictEqual(result.trace.outcome.diagnosticRequested, true);
  assert.strictEqual(result.trace.outcome.realCustomer, false);
  assert.strictEqual(result.trace.learning.nextAction, 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC');
  assert.strictEqual(result.decisions.before.action, 'SEND_UTILITY_RATE_WATCH');
  assert.strictEqual(result.decisions.after.action, 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC');
  assert.strictEqual(result.trace.decisions.changed, true);
  assert.strictEqual(result.decisions.after.testAuthorization, 'test-operator');
  assert.strictEqual(result.trace.audit.verify.ok, true);
  assert.ok(result.trace.audit.verify.length > 0);
  assert.strictEqual(result.trace.guarantees.realRevenue, false);
  assert.strictEqual(result.trace.guarantees.productionWrites, false);
  assert.strictEqual(result.trace.guarantees.thingOneAuthorityUsed, false);
  assert.strictEqual(result.deliverable.contentHash, result.trace.fulfillment.deliverableHash);
  assert.ok(result.deliverable.markdown.indexOf('TEST') >= 0);
  assert.ok(result.deliverable.markdown.indexOf('Battery Management System Optimization') >= 0);
  assert.ok(result.deliverable.markdown.indexOf('observe-only') >= 0 || result.deliverable.markdown.indexOf('Observe-only') >= 0);
  assert.ok(result.deliverable.markdown.indexOf('No Stripe charge') >= 0);
  assert.ok(!/FULFILLING/.test(result.deliverable.markdown), 'brief must not expose a transient order status');
  assert.match(result.trace.observation.observationSha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(result.trace.observation.inputSha256, 'a'.repeat(64));
  pass('complete test cycle reaches fulfillment, accounting, outcome and changed next decision');

  const nuclear = result.trace.issue.alternatives.find(function (a) { return a.id === 'NUCLEAR_INCIDENT'; });
  assert.ok(nuclear, 'nuclear alternative must be recorded');
  assert.strictEqual(nuclear.rejected, 'not_relevant_to_service_asset');
  pass('service relevance excludes the nuclear branch without hiding its score');

  console.log('ENERGY-E2E idempotency and interruption');
  const beforeKeys = await store.snapshot();
  const second = await cycle.runCycle(store, input(store, fixture()));
  assert.strictEqual(second.trace.status, 'COMPLETE');
  assert.strictEqual(second.order.orderId, result.order.orderId);
  assert.strictEqual(second.trace.fulfillment.receipt.receiptId, result.trace.fulfillment.receipt.receiptId);
  assert.strictEqual(second.trace.accounting.energyAccount.availableCashCents, 350);
  assert.strictEqual(await countKeys(store, 'e2e:order:'), 1);
  assert.strictEqual(await countKeys(store, 'e2e:receipt:'), 1);
  assert.strictEqual(await countKeys(store, 'e2e:outcome:'), 1);
  assert.strictEqual(await countKeys(store, 'e2e:learning:'), 1);
  assert.strictEqual(second.trace.accounting.projection.receiptCount, 3);
  assert.strictEqual(second.trace.audit.verify.ok, true);
  pass('duplicate cycle does not create a second order, receipt, outcome or accounting post');

  const resumeStore = cycle.createMemoryStore();
  const resumeCustomer = Object.assign({}, cycle.TEST_CUSTOMER, { customerRef: 'test-customer-resume' });
  const created = await cycle.createTestOrder(resumeStore, {
    mode: 'test', authorization: cycle.TEST_ORDER_AUTHORIZATION,
    customerRef: resumeCustomer.customerRef, offer: offer
  }, NOW);
  await resumeStore.set('e2e:order:' + created.order.orderId, Object.assign({}, created.order, { status: 'FULFILLING' }));
  const assessment = cycle.assessObservation(fixture(), NOW, domain, canonicalNodes, nodeDomains, cycle.SERVICE, offer);
  const resumed = await cycle.fulfillOrder(resumeStore, created.order.orderId, assessment, resumeCustomer, NOW);
  const again = await cycle.fulfillOrder(resumeStore, created.order.orderId, assessment, resumeCustomer, NOW);
  assert.strictEqual(resumed.ok, true);
  assert.strictEqual(again.duplicate, true);
  assert.strictEqual(again.receipt.receiptId, resumed.receipt.receiptId);
  assert.strictEqual(await countKeys(resumeStore, 'e2e:receipt:'), 1);
  pass('interrupted fulfillment resumes once without a duplicate receipt');

  console.log('ENERGY-E2E abstention and authorization');
  const emptyStore = cycle.createMemoryStore();
  const missing = await cycle.runCycle(emptyStore, input(emptyStore, null));
  assert.strictEqual(missing.trace.status, 'ABSTAINED');
  assert.ok(missing.trace.abstention.reasons.indexOf('no_energy_observation') >= 0);
  assert.strictEqual(await countKeys(emptyStore, 'e2e:order:'), 0);
  assert.strictEqual(await countKeys(emptyStore, 'e2e:receipt:'), 0);
  pass('missing observation abstains before any order');

  const staleStore = cycle.createMemoryStore();
  const stale = await cycle.runCycle(staleStore, input(staleStore, fixture({
    generatedAt: NOW - 1000 * 1000, _ageSeconds: 1000
  })));
  assert.strictEqual(stale.trace.status, 'ABSTAINED');
  assert.ok(stale.trace.abstention.reasons.indexOf('observation_too_old_for_a_proposal') >= 0);
  assert.strictEqual(await countKeys(staleStore, 'e2e:order:'), 0);
  pass('stale observation abstains before any order');

  const quietStore = cycle.createMemoryStore();
  const quiet = await cycle.runCycle(quietStore, input(quietStore, fixture({
    energy: { stress: 0.10, maturity: 'EARLY', phase: 'p0', topSignal: 'quiet', sources: [{ name: 'Grid Reliability (FERC/NERC)', live: true }] }
  })));
  assert.strictEqual(quiet.trace.status, 'ABSTAINED');
  assert.ok(quiet.trace.abstention.reasons.indexOf('no_supported_issue_for_current_state') >= 0);
  pass('unsupported state abstains without inventing a need');

  const authStore = cycle.createMemoryStore();
  await assert.rejects(cycle.createTestOrder(authStore, {
    mode: 'test', authorization: 'wrong', customerRef: 'test-auth', offer: offer
  }, NOW), function (err) { return err.code === 'TEST_ORDER_NOT_AUTHORIZED'; });
  await assert.rejects(cycle.createTestOrder(authStore, {
    mode: 'live', authorization: cycle.TEST_ORDER_AUTHORIZATION, customerRef: 'test-auth', offer: offer
  }, NOW), function (err) { return err.code === 'TEST_ORDER_MODE_REQUIRED'; });
  await assert.rejects(cycle.createTestOrder(authStore, {
    mode: 'test', authorization: cycle.TEST_ORDER_AUTHORIZATION, customerRef: 'test-auth',
    offer: { id: 'energy.p2', priceCents: 1 }
  }, NOW), function (err) { return err.code === 'SERVICE_OFFER_MISMATCH'; });
  assert.strictEqual(await countKeys(authStore, 'e2e:order:'), 0);
  pass('unauthorized, live-mode and tampered-price orders fail closed');

  console.log('ENERGY-E2E refund and file store');
  const refundStore = cycle.createMemoryStore();
  const refundOrder = await cycle.createTestOrder(refundStore, {
    mode: 'test', authorization: cycle.TEST_ORDER_AUTHORIZATION,
    customerRef: 'test-customer-refund', offer: offer
  }, NOW);
  const refund = await cycle.refundTestOrder(refundStore, refundOrder.order.orderId, NOW);
  const refundAgain = await cycle.refundTestOrder(refundStore, refundOrder.order.orderId, NOW);
  const refundAccount = (refund.projection.accounts || []).find(function (a) { return a.productDomain === 'energy'; });
  assert.strictEqual(refund.ok, true);
  assert.strictEqual(refundAgain.duplicate, true);
  assert.strictEqual(refundAccount.pendingCashCents, 0);
  assert.strictEqual((await refundStore.get('e2e:order:' + refundOrder.order.orderId)).status, 'REFUNDED');
  pass('pre-settlement refund reverses test money and is idempotent');

  const fulfilledRefundStore = cycle.createMemoryStore();
  const fulfilled = await cycle.runCycle(fulfilledRefundStore, input(fulfilledRefundStore, fixture()));
  await assert.rejects(cycle.refundTestOrder(fulfilledRefundStore, fulfilled.order.orderId, NOW),
    function (err) { return err.code === 'REFUND_AFTER_SETTLEMENT_REQUIRES_PARTIAL_POLICY'; });
  pass('post-settlement refund fails safely instead of overdrawing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'energy-e2e-'));
  try {
    const fsStore = cycle.createFileStore(tmp);
    await fsStore.assertDurable();
    await fsStore.set('probe', { ok: true });
    await fsStore.lpush('probe-list', { n: 1 });
    await fsStore.lpush('probe-list', { n: 2 });
    assert.deepStrictEqual(await fsStore.get('probe'), { ok: true });
    assert.deepStrictEqual(await fsStore.lrange('probe-list', 0, -1), [{ n: 2 }, { n: 1 }]);
    assert.ok(fs.existsSync(path.join(tmp, 'store.json')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  pass('isolated file store persists and supports the ledger list contract');

  console.log('ENERGY-E2E PASS: ' + passed + ' checks');
})().catch(function (err) {
  console.error('ENERGY-E2E FAIL:', err && err.stack || err);
  process.exit(1);
});
