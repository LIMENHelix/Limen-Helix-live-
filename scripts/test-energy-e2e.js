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
const crypto = require('node:crypto');
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
    _stale: overrides && overrides._stale != null ? overrides._stale : false,
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

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).filter(function (k) { return value[k] !== undefined; }).sort()
    .map(function (k) { return JSON.stringify(k) + ':' + stable(value[k]); }).join(',') + '}';
}

function signOutcome(order, outcome, verifier) {
  const payload = stable({
    orderId: order.orderId,
    customerRef: order.customerRef,
    receiptId: outcome.receiptId,
    eventAt: outcome.eventAt,
    contentHash: outcome.contentHash,
    acknowledged: outcome.acknowledged === true,
    diagnosticRequested: outcome.diagnosticRequested === true
  });
  return crypto.createHmac('sha256', verifier.key).update(payload).digest('hex');
}

function makeSignedOutcome(order, receipt, verifier, opts) {
  opts = opts || {};
  const outcome = {
    mode: 'test',
    provenance: 'verified_customer_receipt',
    acknowledged: true,
    diagnosticRequested: true,
    receiptId: opts.receiptId || 'rcpt_test_verified_001',
    eventAt: opts.eventAt || new Date(NOW + 1).toISOString(),
    contentHash: opts.contentHash || receipt.contentHash,
    actor: 'verified-test-customer',
    sourceAuthenticity: { issuer: opts.issuer || verifier.issuer }
  };
  outcome.sourceAuthenticity.signature = opts.signature || signOutcome(order, outcome, verifier);
  return outcome;
}

async function prepareFulfilledOrder(store, customerRef, now) {
  const customer = Object.assign({}, cycle.TEST_CUSTOMER, { customerRef: customerRef });
  const created = await cycle.createTestOrder(store, {
    mode: 'test', authorization: cycle.TEST_ORDER_AUTHORIZATION,
    customerRef: customerRef, offer: offer
  }, now);
  const assessment = cycle.assessObservation(fixture(), now, domain, canonicalNodes, nodeDomains, cycle.SERVICE, offer);
  const fulfillment = await cycle.fulfillOrder(store, created.order.orderId, assessment, customer, now);
  await cycle.recordAccounting(store, created.order.orderId, now);
  const receipt = await store.get('e2e:receipt:' + created.order.orderId);
  return { customer: customer, order: created.order, receipt: receipt, fulfillment: fulfillment };
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
  assert.strictEqual(result.trace.outcome.independent, false);
  assert.strictEqual(result.trace.outcome.measured, false);
  assert.strictEqual(result.trace.outcome.actor, 'test-harness');
  assert.strictEqual(result.trace.outcome.authority, 'SIMULATED_TEST_ONLY');
  assert.strictEqual(result.trace.learning.nextAction, 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC');
  assert.strictEqual(result.trace.learning.authority, 'SIMULATED_TEST_ONLY');
  assert.strictEqual(result.trace.learning.measuredOutcome, false);
  assert.strictEqual(result.trace.learning.simulated, true);
  assert.strictEqual(result.decisions.before.action, 'SEND_UTILITY_RATE_WATCH');
  assert.strictEqual(result.decisions.after.action, 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC');
  assert.strictEqual(result.decisions.after.simulated, true);
  assert.strictEqual(result.decisions.after.measuredOutcome, false);
  assert.strictEqual(result.trace.decisions.changed, true);
  assert.strictEqual(result.decisions.after.testAuthorization, 'test-operator');
  assert.strictEqual(result.trace.actionStates.measuredOutcome, false);
  assert.strictEqual(result.trace.actionStates.learningApplied, 'SIMULATED_ONLY');
  assert.strictEqual(result.trace.guarantees.measuredOutcome, false);
  assert.strictEqual(result.trace.guarantees.simulatedOutcome, true);
  assert.strictEqual(result.trace.audit.verify.ok, true);
  assert.ok(result.trace.audit.verify.length > 0);
  assert.strictEqual(result.trace.guarantees.realRevenue, false);
  assert.strictEqual(result.trace.guarantees.productionWrites, false);
  assert.strictEqual(result.trace.guarantees.thingOneAuthorityUsed, false);
  assert.strictEqual(result.deliverable.contentHash, result.trace.fulfillment.deliverableHash);
  assert.strictEqual(result.trace.service.name, 'Your Utility Rate Watch');
  assert.strictEqual(result.trace.service.deliverable, 'Utility rate and bill-pressure watch brief (test artifact)');
  assert.strictEqual(result.trace.fulfillment.deliverableTitle, 'Energy Watch: Utility Rate Watch Brief (TEST)');
  assert.ok(result.deliverable.markdown.indexOf('Your utility rate watch') >= 0);
  assert.ok(result.deliverable.markdown.indexOf('Purchased offer: Your Utility Rate Watch') >= 0);
  assert.ok(result.deliverable.markdown.indexOf('Related portal context (not the purchased deliverable)') >= 0);
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

  const staleFlagStore = cycle.createMemoryStore();
  const staleFlag = await cycle.runCycle(staleFlagStore, input(staleFlagStore, fixture({
    _stale: true, generatedAt: NOW - 60000, _ageSeconds: 60
  })));
  assert.strictEqual(staleFlag.trace.status, 'ABSTAINED');
  assert.ok(staleFlag.trace.abstention.reasons.indexOf('snapshot_marked_stale') >= 0);
  assert.strictEqual(await countKeys(staleFlagStore, 'e2e:order:'), 0);
  assert.strictEqual(await countKeys(staleFlagStore, 'e2e:receipt:'), 0);
  assert.strictEqual(await countKeys(staleFlagStore, 'e2e:outcome:'), 0);
  assert.strictEqual(await countKeys(staleFlagStore, 'e2e:learning:'), 0);
  pass('snapshot _stale:true abstains before any order, delivery, accounting or learning');

  const staleAgeStore = cycle.createMemoryStore();
  const staleAge = await cycle.runCycle(staleAgeStore, input(staleAgeStore, fixture({
    _stale: false, generatedAt: NOW - 400000, _ageSeconds: 400
  })));
  assert.strictEqual(staleAge.trace.status, 'ABSTAINED');
  assert.ok(staleAge.trace.abstention.reasons.indexOf('observation_too_old_for_an_order') >= 0);
  assert.strictEqual(await countKeys(staleAgeStore, 'e2e:order:'), 0);
  pass('observation older than 300 seconds abstains before any order');

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

  console.log('ENERGY-E2E outcome provenance');
  const noOutcomeStore = cycle.createMemoryStore();
  await assert.rejects(cycle.runCycle(noOutcomeStore, input(noOutcomeStore, fixture(), { outcome: null })),
    function (err) { return err.code === 'OUTCOME_REQUIRED'; });
  assert.strictEqual(await countKeys(noOutcomeStore, 'e2e:order:'), 0);
  pass('runCycle no longer invents a default outcome');

  const syntheticStore = cycle.createMemoryStore();
  const syntheticPrepared = await prepareFulfilledOrder(syntheticStore, 'test-customer-spoof', NOW);
  const spoofed = Object.assign({}, cycle.TEST_OUTCOME, {
    independent: true, measured: true, actor: 'test-customer'
  });
  const spoofedResult = await cycle.recordOutcome(syntheticStore, syntheticPrepared.order.orderId, spoofed, NOW + 1000);
  assert.strictEqual(spoofedResult.outcome.independent, false);
  assert.strictEqual(spoofedResult.outcome.measured, false);
  assert.strictEqual(spoofedResult.outcome.actor, 'test-harness');
  assert.strictEqual(spoofedResult.outcome.authority, 'SIMULATED_TEST_ONLY');
  pass('synthetic outcome cannot assert independent or measured status');

  const verifier = { key: 'test-only-verification-key', issuer: 'test-customer-verifier' };
  const verifiedStore = cycle.createMemoryStore();
  const verifiedPrepared = await prepareFulfilledOrder(verifiedStore, 'test-customer-verified', NOW);
  const verifiedOutcome = makeSignedOutcome(verifiedPrepared.order, verifiedPrepared.receipt, verifier);
  const verifiedResult = await cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, verifiedOutcome, NOW + 1000, verifier);
  assert.strictEqual(verifiedResult.outcome.independent, true);
  assert.strictEqual(verifiedResult.outcome.measured, true);
  assert.strictEqual(verifiedResult.outcome.authority, 'VERIFIED_CUSTOMER_EVIDENCE');
  assert.strictEqual(verifiedResult.outcome.verification.signatureVerified, true);
  assert.strictEqual(verifiedResult.outcome.simulated, false);
  assert.strictEqual(verifiedResult.outcome.realCustomer, false);
  const verifiedLearning = await cycle.learn(verifiedStore, verifiedPrepared.order, verifiedResult.outcome, NOW + 1000);
  assert.strictEqual(verifiedLearning.learning.authority, 'MEASURED_INDEPENDENT_OUTCOME');
  assert.strictEqual(verifiedLearning.learning.measuredOutcome, true);
  const verifiedDecision = await cycle.decideNext(verifiedStore, verifiedPrepared.customer, null, NOW + 1000);
  assert.strictEqual(verifiedDecision.action, 'OFFER_STATE_OF_HEALTH_DIAGNOSTIC');
  assert.strictEqual(verifiedDecision.measuredOutcome, true);
  assert.strictEqual(verifiedDecision.simulated, false);
  pass('separately signed receipt qualifies as measured independent evidence');

  const badSignature = makeSignedOutcome(verifiedPrepared.order, verifiedPrepared.receipt, verifier, {
    signature: '0'.repeat(64)
  });
  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, badSignature, NOW + 1000, verifier),
    function (err) { return err.code === 'OUTCOME_SIGNATURE_INVALID'; });
  pass('spoofed signature is rejected');

  const wrongIssuer = makeSignedOutcome(verifiedPrepared.order, verifiedPrepared.receipt, verifier, {
    issuer: 'wrong-verifier'
  });
  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, wrongIssuer, NOW + 1000, verifier),
    function (err) { return err.code === 'OUTCOME_SOURCE_UNVERIFIED'; });
  pass('untrusted receipt issuer is rejected');

  const wrongHash = makeSignedOutcome(verifiedPrepared.order, verifiedPrepared.receipt, verifier, {
    contentHash: 'f'.repeat(64)
  });
  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, wrongHash, NOW + 1000, verifier),
    function (err) { return err.code === 'OUTCOME_CONTENT_HASH_MISMATCH'; });
  pass('outcome content hash must match the delivered artifact');

  const early = makeSignedOutcome(verifiedPrepared.order, verifiedPrepared.receipt, verifier, {
    eventAt: new Date(NOW - 1000).toISOString()
  });
  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, early, NOW + 1000, verifier),
    function (err) { return err.code === 'OUTCOME_EVENT_PRECEDES_DELIVERY'; });
  pass('outcome event before delivery is rejected');

  const future = makeSignedOutcome(verifiedPrepared.order, verifiedPrepared.receipt, verifier, {
    eventAt: new Date(NOW + 5000).toISOString()
  });
  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, future, NOW + 1000, verifier),
    function (err) { return err.code === 'OUTCOME_EVENT_IN_FUTURE'; });
  pass('future outcome event is rejected');

  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, verifiedOutcome, NOW + 1000),
    function (err) { return err.code === 'OUTCOME_VERIFIER_REQUIRED'; });
  await assert.rejects(cycle.recordOutcome(verifiedStore, verifiedPrepared.order.orderId, {
    mode: 'test', acknowledged: true, diagnosticRequested: true, evidenceRef: 'no-provenance'
  }, NOW + 1000, verifier), function (err) { return err.code === 'OUTCOME_PROVENANCE_REQUIRED'; });
  pass('missing verifier or provenance cannot become a measured outcome');

  const replayPrepared = await prepareFulfilledOrder(verifiedStore, 'test-customer-replay', NOW + 1);
  const replayed = makeSignedOutcome(replayPrepared.order, replayPrepared.receipt, verifier, {
    receiptId: verifiedOutcome.receiptId,
    eventAt: new Date(NOW + 2).toISOString()
  });
  await assert.rejects(cycle.recordOutcome(verifiedStore, replayPrepared.order.orderId, replayed, NOW + 2000, verifier),
    function (err) { return err.code === 'OUTCOME_RECEIPT_REPLAYED'; });
  pass('a receipt identity cannot be replayed on another order');

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
