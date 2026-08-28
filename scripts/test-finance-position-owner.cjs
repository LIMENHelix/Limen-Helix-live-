#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Owner = require('../lib/finance-position-owner.js');

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function store() {
  const values = new Map(), lists = new Map();
  return {
    values, lists,
    assertDurable() { return true; },
    async get(k) { return values.has(k) ? clone(values.get(k)) : null; },
    async set(k, v) { values.set(k, clone(v)); return true; },
    async setIfAbsent(k, v) { if (values.has(k)) return false; values.set(k, clone(v)); return true; },
    async lpush(k, v) { const rows = lists.get(k) || []; rows.unshift(clone(v)); lists.set(k, rows); return rows.length; },
    async ltrim(k, a, b) { lists.set(k, (lists.get(k) || []).slice(a, b + 1)); return true; }
  };
}
function context() {
  return {
    company: { cik: '895421', slug: 'morgan_stanley', ticker: 'MS', name: 'Morgan Stanley' },
    position: { symbol: 'MS', quantity: 1, marketValue: 215 },
    currentQuote: { symbol: 'MS', last: 215, bid: 214.9, ask: 215.1 },
    marketPerformance: { target: { returnsPct: { oneSession: 1 } }, benchmark: {}, targetMinusBenchmarkPct: {} },
    entry: { openingCommandId: 'open-1', decision: { candidateId: 'candidate-1' } },
    currentIssuerEvidence: [{
      title: 'Morgan Stanley current issuer update', publisher: 'SEC', feedName: 'SEC EDGAR',
      sourceUpdatedAt: '2026-08-26T16:30:00Z', recordedAt: '2026-08-26T16:31:00Z',
      sourceIdentity: { kind: 'headline-title', value: 'finance:SEC:MS:1' }
    }], currentReportingEvidence: [], companyNetworkStress: { value: 0.4 },
    financeBrain: { packetId: 'finance:1' }, kernelContext: { status: 'UNESTABLISHED', usedAsContext: false },
    helixReport: {
      thing0Eligibility: { qualifiedForValidatedThing1: false },
      thing1: { applicable: false },
      thing2: { observed: true, decisionWeight: 0, maskingAssessment: 'unassessed' }
    },
    companyLearning: null, evidenceFingerprint: 'a'.repeat(64)
  };
}
function proposal(action) {
  const factorAssessment = {};
  ['issuerFeeds', 'quarterlyReporting', 'marketQuote', 'marketPerformance', 'companyNetworkStress', 'financeBrainState', 'entryThesis', 'companyLearning', 'thing0Eligibility', 'thing1ValidatedSignal', 'kernelContext']
    .forEach(name => { factorAssessment[name] = { state: 'MIXED', reason: 'bounded fixture assessment' }; });
  return {
    schemaVersion: Owner.PROPOSAL_SCHEMA, action, symbol: 'MS', confidence: 0.95,
    rationale: 'Combined actionable evidence supports this bounded paper response.',
    invalidation: 'Contradictory issuer or market evidence changes the response.',
    factorAssessment
  };
}

(async function () {
  const ctx = context();
  assert.equal(Owner.parseProposal(JSON.stringify(proposal('SELL')), ctx).ok, true);
  const contaminated = proposal('SELL'); contaminated.thing2DecisionWeight = 0;
  assert.equal(Owner.parseProposal(JSON.stringify(contaminated), ctx).reason, 'position_owner_thing2_decision_field_forbidden');
  assert.equal(Owner.buildExitIntent(ctx, proposal('SELL')).intent.side, 'sell');

  const env = {
    LIMEN_FINANCE_POSITION_OWNER_ENABLED: '1',
    TRADIER_SANDBOX_AUTONOMY_ENABLED: '1',
    TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED: '1'
  };
  let s = store();
  let result = await Owner.execute({
    store: s, broker: {}, account: { orders: [] }, input: { status: 'READY_FOR_POSITION_REVIEW', context: ctx }, env, now: Date.parse('2026-08-26T16:00:00Z'),
    provider: async (input) => {
      const request = JSON.parse(input.prompt);
      assert.equal(Object.prototype.hasOwnProperty.call(request.context.helixReport, 'thing2'), false);
      assert.equal(request.context.interpretationBoundary.postDecisionMaskingReconciliationDeferred, true);
      assert.equal(Object.prototype.hasOwnProperty.call(request.responseSchema, 'thing2Observed'), false);
      return { ok: true, provider: 'fixture', model: 'fixture', text: JSON.stringify(proposal('HOLD')) };
    }
  });
  assert.equal(result.status, 'HELD');
  assert.equal(result.receipt.reason, 'finance_position_owner_held');
  assert.equal(result.orderPlaced, false);

  s = store();
  let previewIntent;
  const b14 = {
    async createPreview(_store, _broker, intent) {
      previewIntent = intent;
      assert.equal(intent.side, 'sell');
      assert.equal(intent.decisionContext.thing2DecisionWeight, 0);
      return { previewId: 'preview-1', confirmationSummary: 'APPROVE EXIT' };
    },
    async submitApproved(_store, _broker, input) {
      assert.deepEqual(input, {
        previewId: 'preview-1', confirmation: 'APPROVE EXIT',
        approval: { mode: 'domain-autonomous', actor: 'finance-brain', ownerDomain: 'finance',
          authorizationReceiptId: 'motor-1', authorizationMode: 'mature-production-capability' }
      });
      return { commandId: 'exit-command-1', receipt: { orderId: 'paper-order-1' }, rollback: { status: 'AVAILABLE' } };
    }
  };
  result = await Owner.execute({
    store: s, broker: {}, b14, account: { orders: [] }, input: { status: 'READY_FOR_POSITION_REVIEW', context: ctx }, env, now: Date.parse('2026-08-26T17:00:00Z'),
    motorAuthorization: { async authorize() { return { authorized: true, receiptId: 'motor-1' }; } },
    provider: async () => ({ ok: true, provider: 'fixture', model: 'fixture', text: JSON.stringify(proposal('SELL')) })
  });
  assert.equal(result.status, 'EXIT_COMMAND_RECEIPTED');
  assert.equal(result.orderPlaced, true);
  assert.equal(result.receipt.orderId, 'paper-order-1');
  assert.equal(result.receipt.selection.authority.thing2DecisionWeight, 0);
  assert.equal(result.receipt.postDecisionReconciliation.sequence, 'current_exact_issuer_news_then_thing1_result_then_thing2_snapshot');
  assert.equal(result.receipt.postDecisionReconciliation.currentNewsFirst.status, 'CURRENT_EXACT_ISSUER_NEWS_PRESENT');
  assert.equal(result.receipt.postDecisionReconciliation.currentNewsFirst.observations[0].title, 'Morgan Stanley current issuer update');
  assert.equal(result.receipt.postDecisionReconciliation.maskingConfirmation, 'NO_POSSIBLE_MASKING_FLAG_TO_CONFIRM');
  assert.equal(result.receipt.postDecisionReconciliation.decisionWeight, 0);
  assert.equal(previewIntent.actionId, result.receipt.selection.id);
  assert.equal(previewIntent.decisionContext.criticCandidateId, result.receipt.selection.criticDecision.released.candidateId);
  assert.equal(s.values.has('autofire_learning_cause:' + result.receipt.selection.id), true);

  const again = await Owner.execute({ store: s, broker: {}, account: { orders: [] }, input: { status: 'READY_FOR_POSITION_REVIEW', context: ctx }, env, now: Date.parse('2026-08-26T17:10:00Z'), provider: async () => { throw new Error('must not repeat'); } });
  assert.equal(again.idempotent, true);

  console.log('finance position owner: zero-weight Thing 2, B10 exit, durable cause, B14 receipt, and cadence inhibition passed');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
