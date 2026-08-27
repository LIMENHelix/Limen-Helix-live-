#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Decision = require('../lib/finance-trade-decision.js');
const Admission = require('../lib/finance-paper-admission.js');
const FeedConfirmation = require('../lib/finance-feed-confirmation.js');

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function store() {
  const values = new Map(), lists = new Map();
  return {
    values, lists,
    assertDurable() { return true; },
    async get(k) { return values.has(k) ? clone(values.get(k)) : null; },
    async set(k, v) { values.set(k, clone(v)); return true; },
    async setIfAbsent(k, v) { if (values.has(k)) return false; values.set(k, clone(v)); return true; },
    async lpush(k, v) { const a = lists.get(k) || []; a.unshift(clone(v)); lists.set(k, a); return a.length; },
    async ltrim(k, start, stop) { lists.set(k, (lists.get(k) || []).slice(start, stop + 1)); return true; },
    async lrange(k, start, stop) { return clone((lists.get(k) || []).slice(start, stop + 1)); }
  };
}

const packetId = 'finance:3:test-packet';
const evidenceRefs = [
  { role: 'semantic', sourceIdentity: { kind: 'headline-title', value: 'finance:SEC:RKLB:1' } },
  { role: 'market', sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' } },
  { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }
];
function admission() {
  return {
    schemaVersion: Admission.SCHEMA,
    packetId,
    status: 'ADMITTED_TO_PAPER',
    candidate: {
      schemaVersion: 'finance-paper-candidate/1.0',
      id: 'proposal-rklb-1',
      status: 'READY_TO_FIRE',
      company: { cik: '1819994', slug: 'rklb', ticker: 'RKLB', name: 'Rocket Lab USA Inc.' },
      evidenceRefs,
      thesis: 'bounded test thesis',
      invalidation: 'bounded invalidation',
      independenceAssessment: { status: 'UNASSESSED', reason: 'not supplied' }
    }
  };
}
function proposal(action, confidence) {
  const factorAssessment = {};
  Decision.FACTOR_NAMES.forEach(function (name) {
    factorAssessment[name] = { state: 'MIXED', reason: 'The bounded fixture contains mixed evidence for this factor.' };
  });
  return {
    schemaVersion: Decision.PROPOSAL_SCHEMA,
    action,
    symbol: 'RKLB',
    confidence,
    rationale: 'The supplied candidate and current quote support a bounded sandbox decision.',
    invalidation: 'New contradictory evidence or the stated candidate invalidation.',
    factorAssessment,
    evidenceRefs
  };
}
function confirmation(at) {
  return {
    schemaVersion: FeedConfirmation.SCHEMA,
    status: 'CONFIRMED_FOR_TRADE_DECISION',
    packetId,
    company: clone(admission().candidate.company),
    confirmedAt: at || '2026-08-25T02:00:00Z',
    context: {
      semanticEvidence: [{ sourceIdentity: evidenceRefs[0].sourceIdentity, recordedAt: '2026-08-25T01:59:00Z', title: 'Issuer update' }],
      marketData: { quotes: [] },
      networkEvidence: [],
      interpretationBoundary: { directionalClaim: false, sentimentClassified: false, thing2Used: false }
    }
  };
}
function buildIntent(candidate, actorProposal, quote, account, risk) {
  return Decision.buildIntent(candidate, actorProposal, quote, account, risk, { symbol: 'SPY', last: 500 });
}
function broker(position) {
  const calls = [];
  return {
    calls,
    async quote(symbol) { calls.push('quote'); return { provider: 'tradier', symbol, last: 68.28, bid: 68.2, ask: 68.3, observedAt: '2026-08-25T02:00:00Z' }; },
    async accountSnapshot() { calls.push('account'); return { accountId: 'VA1', accountType: 'margin', totalCash: 1000, totalEquity: 1000, positions: position ? [{ symbol: 'RKLB', quantity: position }] : [], orders: [], observedAt: '2026-08-25T02:00:00Z' }; },
    async history(symbol) { calls.push('history:' + symbol); return { symbol, provider: 'tradier', interval: 'daily', rows: [{ date: '2026-08-24', close: 65 }, { date: '2026-08-25', close: 68.28 }] }; },
    async previewOrder() { calls.push('preview'); throw new Error('decision boundary must not preview'); },
    async placeOrder() { calls.push('place'); throw new Error('decision boundary must not place'); }
  };
}

async function seeded() {
  const s = store();
  await s.set(Admission.admissionKey(packetId), admission());
  await s.lpush(Admission.LOG_KEY, { packetId });
  return s;
}

(async () => {
  assert.equal(Decision.policy({}).maxGrossNotionalUsd, 500);
  assert.equal(Decision.policy({ LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD: '750' }).maxGrossNotionalUsd, 500, 'configured cap cannot raise the hard cap');
  assert.equal(Decision.policy({ LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD: '250' }).maxGrossNotionalUsd, 250);
  assert.equal(Decision.policy({ LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD: '50' }).maxGrossNotionalUsd, 50);

  assert.equal(Decision.parseProposal(JSON.stringify(proposal('BUY', 0.8)), admission().candidate).ok, true);
  assert.equal(Decision.parseProposal('```json\n' + JSON.stringify(proposal('BUY', 0.8)) + '\n```', admission().candidate).ok, true,
    'one fenced object is an unambiguous transport wrapper');
  assert.equal(Decision.parseProposal('Decision follows: ' + JSON.stringify(proposal('BUY', 0.8)) + ' End.', admission().candidate).ok, true,
    'one prose-wrapped object is an unambiguous transport wrapper');
  const bracedReason = proposal('BUY', 0.8);
  bracedReason.rationale = 'The supplied {issuer} evidence remains mixed but bounded.';
  assert.equal(Decision.parseProposal(JSON.stringify(bracedReason), admission().candidate).ok, true,
    'braces inside JSON strings do not create false objects');
  assert.equal(Decision.parseProposal(JSON.stringify(proposal('BUY', 0.8)) + JSON.stringify(proposal('ABSTAIN', 0.8)), admission().candidate).reason,
    'trade_decision_json_ambiguous');
  assert.equal(Decision.parseProposal('{"schemaVersion":', admission().candidate).reason, 'trade_decision_json_invalid');
  assert.equal(Decision.parseProposal('not json', admission().candidate).reason, 'trade_decision_json_required');
  assert.equal(Decision.parseProposal('x'.repeat(Decision.MAX_PROVIDER_RESPONSE_CHARS + 1), admission().candidate).reason,
    'trade_decision_json_too_large');
  const wrongThing2Observation = proposal('BUY', 0.8);
  wrongThing2Observation.thing2Observed = true;
  assert(Decision.parseProposal(JSON.stringify(wrongThing2Observation), admission().candidate).blockers.includes('trade_decision_forbidden_field_thing2Observed'));
  const forbidden = proposal('BUY', 0.8); forbidden.quantity = 1;
  assert(Decision.parseProposal(JSON.stringify(forbidden), admission().candidate).blockers.includes('trade_decision_forbidden_field_quantity'));
  const nestedForbidden = proposal('BUY', 0.8); nestedForbidden.metadata = { order: { side: 'buy' } };
  assert(Decision.parseProposal(JSON.stringify(nestedForbidden), admission().candidate).blockers.includes('trade_decision_forbidden_field_metadata.order'));
  const mismatched = proposal('BUY', 0.8); mismatched.evidenceRefs = mismatched.evidenceRefs.slice(0, 2);
  assert(Decision.parseProposal(JSON.stringify(mismatched), admission().candidate).blockers.includes('trade_decision_evidence_refs_must_match_candidate'));

  const buy = buildIntent(admission().candidate, proposal('BUY', 0.8), { last: 68.28, ask: 68.3 }, { totalCash: 1000, positions: [] }, Decision.policy({}));
  assert.equal(buy.status, 'INTENT_READY');
  assert.equal(buy.tradeIntent.quantity, 1);
  assert.equal(buy.tradeIntent.side, 'buy');
  assert(buy.tradeIntent.limitPrice <= 500);
  const expensive = buildIntent(admission().candidate, proposal('BUY', 0.8), { last: 215.45, ask: 215.58 }, { totalCash: 1000, positions: [] }, Decision.policy({}));
  assert.equal(expensive.status, 'INTENT_READY', 'one whole MS-priced share fits the raised paper cap');
  assert.equal(buildIntent(admission().candidate, proposal('BUY', 0.7), { last: 68.28 }, { totalCash: 1000, positions: [] }, Decision.policy({})).reason, 'trade_decision_confidence_below_policy_floor');
  assert.equal(buildIntent(admission().candidate, proposal('BUY', 0.8), { last: 68.28 }, { totalCash: 1000, positions: [{ symbol: 'RKLB', quantity: 1 }] }, Decision.policy({})).reason, 'policy_forbids_automatic_averaging');
  assert.equal(buildIntent(admission().candidate, proposal('SELL', 0.8), { last: 68.28 }, { totalCash: 1000, positions: [] }, Decision.policy({})).reason, 'long_position_required_for_sell');
  const shortCandidate = admission().candidate;
  shortCandidate.projectedMarginRanking = { entries: [{ company: { slug: 'rklb', ticker: 'RKLB' }, side: 'SHORT' }] };
  const short = buildIntent(shortCandidate, proposal('SHORT', 0.8), { last: 68.28, bid: 68.2 }, { accountType: 'margin', totalCash: 1000, positions: [] }, Decision.policy({}));
  assert.equal(short.status, 'INTENT_READY');
  assert.equal(short.tradeIntent.side, 'sell_short');
  assert.equal(buildIntent(shortCandidate, proposal('BUY', 0.8), { last: 68.28, ask: 68.3 }, { accountType: 'margin', totalCash: 1000, positions: [] }, Decision.policy({})).reason, 'action_conflicts_with_projected_margin_side');
  const cover = buildIntent(shortCandidate, proposal('COVER', 0.8), { last: 68.28, ask: 68.3 }, { accountType: 'margin', totalCash: 1000, positions: [{ symbol: 'RKLB', quantity: -1 }] }, Decision.policy({}));
  assert.equal(cover.tradeIntent.side, 'buy_to_cover');

  const s = await seeded();
  const b = broker(0);
  let providerCalls = 0;
  const result = await Decision.execute(s, b, { approve: true, packetId }, {
    env: {}, now: '2026-08-25T02:00:00Z', completedAt: '2026-08-25T02:00:01Z',
    feedConfirmation: confirmation(),
    helixReport: null,
    provider: async (input) => {
      providerCalls++;
      const request = JSON.parse(input.prompt);
      assert.equal(Object.prototype.hasOwnProperty.call(request.decisionEvidence.helixReport, 'thing2'), false);
      assert.equal(request.decisionEvidence.interpretationBoundary.postDecisionMaskingReconciliationDeferred, true);
      assert.equal(Object.prototype.hasOwnProperty.call(request.responseSchema, 'thing2Observed'), false);
      return { ok: true, provider: 'test', model: 'fixture', text: JSON.stringify(proposal('BUY', 0.9)), tokensIn: 1, tokensOut: 1 };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.status, 'TRADE_INTENT_SELECTED');
  assert.equal(result.receipt.selection.status, 'RELEASED');
  assert.equal(result.receipt.selection.command, 'prepare_tradier_sandbox_order');
  assert.equal(result.receipt.tradeIntent.symbol, 'RKLB');
  assert.equal(result.receipt.resourceMetabolism.beforeProvider.ownerDomain, 'finance');
  assert.equal(result.receipt.resourceMetabolism.beforeProvider.state, 'AVAILABLE');
  assert.equal(result.receipt.resourceMetabolism.afterProvider.state, 'INHIBITED');
  assert(result.receipt.resourceMetabolism.afterProvider.blockers.includes('finance_resource_provider_refractory'));
  assert.equal(result.receipt.safety.orderPreviewed, false);
  assert.equal(result.receipt.safety.orderPlaced, false);
  assert.equal(result.receipt.feedConfirmation.context.interpretationBoundary.thing2Used, false);
  assert.equal(result.receipt.decisionEvidence.interpretationBoundary.thing2DecisionWeight, 0);
  assert.equal(result.receipt.postDecisionReconciliation.sequence, 'thing1_result_then_thing2_snapshot');
  assert.equal(result.receipt.postDecisionReconciliation.decisionWeight, 0);
  assert.equal(result.receipt.postDecisionReconciliation.appliedAfterProposal, true);
  assert.equal(result.receipt.decisionEvidence.marketPerformance.target.observations, 2);
  assert(result.receipt.decisionEvidence.gaps.includes('protected_helix_report_unavailable'));
  const learningState = s.values.get('autofire_learning_state:finance');
  assert.equal(learningState.domain, 'finance');
  assert.equal(learningState.outwardGate.version, 1, 'the Finance entry B10 must persist its owning learned gate');
  assert.equal(providerCalls, 1);
  assert.deepEqual(b.calls, ['quote', 'quote', 'account', 'history:RKLB', 'history:SPY']);

  const again = await Decision.execute(s, b, { approve: true, packetId }, { provider: async () => { throw new Error('must not repeat'); } });
  assert.equal(again.idempotent, true);
  assert.equal(providerCalls, 1);
  assert.deepEqual(b.calls, ['quote', 'quote', 'account', 'history:RKLB', 'history:SPY']);

  const abstainStore = await seeded();
  const abstained = await Decision.execute(abstainStore, broker(0), { approve: true, packetId }, {
    env: {}, feedConfirmation: confirmation(new Date().toISOString()), helixReport: null,
    provider: async () => ({ ok: true, provider: 'test', model: 'fixture', text: JSON.stringify(proposal('ABSTAIN', 0.9)) })
  });
  assert.equal(abstained.receipt.status, 'ABSTAINED');
  assert.equal(abstained.receipt.tradeIntent, null);
  assert.equal(abstained.receipt.selection, null);

  const truncatedStore = await seeded();
  const truncated = await Decision.execute(truncatedStore, broker(0), { approve: true, packetId }, {
    env: {}, feedConfirmation: confirmation(new Date().toISOString()), helixReport: null,
    provider: async () => ({
      ok: false,
      provider: 'test',
      model: 'fixture',
      structuredOutput: true,
      stopReason: 'max_tokens',
      errorType: 'structured_output_truncated',
      tokensIn: 120,
      tokensOut: 3000
    })
  });
  assert.equal(truncated.receipt.status, 'ABSTAINED');
  assert.equal(truncated.receipt.reason, 'trade_decision_output_truncated');
  assert.equal(truncated.receipt.provider.structuredOutput, true);
  assert.equal(truncated.receipt.provider.stopReason, 'max_tokens');
  assert.equal(truncated.receipt.provider.errorType, 'structured_output_truncated');
  assert.deepEqual(truncated.receipt.proposalParse, { objectCount: 0, responseChars: 0 });
  assert.equal(truncated.receipt.proposal, null);
  assert.equal(truncated.receipt.tradeIntent, null);

  const inhibitedStore = await seeded();
  const inhibitedBroker = broker(0);
  let inhibitedProviderCalls = 0;
  const inhibited = await Decision.execute(inhibitedStore, inhibitedBroker, { approve: true, packetId }, {
    env: { LIMEN_FINANCE_SANDBOX_RESERVE_USD: '2000' },
    feedConfirmation: confirmation(new Date().toISOString()), helixReport: null,
    provider: async () => { inhibitedProviderCalls++; throw new Error('metabolic inhibition must precede provider use'); }
  });
  assert.equal(inhibited.ok, true);
  assert.equal(inhibited.receipt.status, 'ABSTAINED');
  assert.equal(inhibited.receipt.reason, 'finance_resource_no_uncommitted_cash');
  assert.equal(inhibited.receipt.providerCalled, false);
  assert.equal(inhibited.receipt.resourceMetabolism.beforeProvider.state, 'INHIBITED');
  assert.equal(inhibited.receipt.tradeIntent, null);
  assert.equal(inhibited.receipt.selection, null);
  assert.equal(inhibitedProviderCalls, 0);
  assert.deepEqual(inhibitedBroker.calls, ['quote', 'quote', 'account', 'history:RKLB', 'history:SPY']);

  const unconfirmedStore = await seeded();
  const unconfirmedBroker = broker(0);
  const unconfirmed = await Decision.execute(unconfirmedStore, unconfirmedBroker, { approve: true, packetId }, {
    env: {}, provider: async () => { throw new Error('feed confirmation must precede provider use'); }
  });
  assert.equal(unconfirmed.receipt.status, 'ABSTAINED');
  assert.equal(unconfirmed.receipt.reason, 'finance_feed_confirmation_required');
  assert.equal(unconfirmed.receipt.providerCalled, false);
  assert.deepEqual(unconfirmedBroker.calls, []);

  console.log('finance trade decision: passed');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
