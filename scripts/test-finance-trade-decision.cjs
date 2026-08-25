#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Decision = require('../lib/finance-trade-decision.js');
const Admission = require('../lib/finance-paper-admission.js');

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
  return {
    schemaVersion: Decision.PROPOSAL_SCHEMA,
    action,
    symbol: 'RKLB',
    confidence,
    rationale: 'The supplied candidate and current quote support a bounded sandbox decision.',
    invalidation: 'New contradictory evidence or the stated candidate invalidation.',
    evidenceRefs
  };
}
function broker(position) {
  const calls = [];
  return {
    calls,
    async quote(symbol) { calls.push('quote'); return { provider: 'tradier', symbol, last: 68.28, bid: 68.2, ask: 68.3, observedAt: '2026-08-25T02:00:00Z' }; },
    async accountSnapshot() { calls.push('account'); return { accountId: 'VA1', accountType: 'margin', totalCash: 1000, totalEquity: 1000, positions: position ? [{ symbol: 'RKLB', quantity: position }] : [], orders: [], observedAt: '2026-08-25T02:00:00Z' }; },
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
  assert.equal(Decision.policy({}).maxGrossNotionalUsd, 100);
  assert.equal(Decision.policy({ LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD: '250' }).maxGrossNotionalUsd, 100, 'configured cap cannot raise the hard cap');
  assert.equal(Decision.policy({ LIMEN_FINANCE_SANDBOX_MAX_NOTIONAL_USD: '50' }).maxGrossNotionalUsd, 50);

  assert.equal(Decision.parseProposal(JSON.stringify(proposal('BUY', 0.8)), admission().candidate).ok, true);
  const forbidden = proposal('BUY', 0.8); forbidden.quantity = 1;
  assert(Decision.parseProposal(JSON.stringify(forbidden), admission().candidate).blockers.includes('trade_decision_forbidden_field_quantity'));
  const nestedForbidden = proposal('BUY', 0.8); nestedForbidden.metadata = { order: { side: 'buy' } };
  assert(Decision.parseProposal(JSON.stringify(nestedForbidden), admission().candidate).blockers.includes('trade_decision_forbidden_field_metadata.order'));
  const mismatched = proposal('BUY', 0.8); mismatched.evidenceRefs = mismatched.evidenceRefs.slice(0, 2);
  assert(Decision.parseProposal(JSON.stringify(mismatched), admission().candidate).blockers.includes('trade_decision_evidence_refs_must_match_candidate'));

  const buy = Decision.buildIntent(admission().candidate, proposal('BUY', 0.8), { last: 68.28, ask: 68.3 }, { totalCash: 1000, positions: [] }, Decision.policy({}));
  assert.equal(buy.status, 'INTENT_READY');
  assert.equal(buy.tradeIntent.quantity, 1);
  assert.equal(buy.tradeIntent.side, 'buy');
  assert(buy.tradeIntent.limitPrice <= 100);
  assert.equal(Decision.buildIntent(admission().candidate, proposal('BUY', 0.7), { last: 68.28 }, { totalCash: 1000, positions: [] }, Decision.policy({})).reason, 'trade_decision_confidence_below_policy_floor');
  assert.equal(Decision.buildIntent(admission().candidate, proposal('BUY', 0.8), { last: 68.28 }, { totalCash: 1000, positions: [{ symbol: 'RKLB', quantity: 1 }] }, Decision.policy({})).reason, 'policy_forbids_automatic_averaging');
  assert.equal(Decision.buildIntent(admission().candidate, proposal('SELL', 0.8), { last: 68.28 }, { totalCash: 1000, positions: [] }, Decision.policy({})).reason, 'long_position_required_for_sell');

  const s = await seeded();
  const b = broker(0);
  let providerCalls = 0;
  const result = await Decision.execute(s, b, { approve: true, packetId }, {
    env: {}, now: '2026-08-25T02:00:00Z', completedAt: '2026-08-25T02:00:01Z',
    provider: async () => { providerCalls++; return { ok: true, provider: 'test', model: 'fixture', text: JSON.stringify(proposal('BUY', 0.9)), tokensIn: 1, tokensOut: 1 }; }
  });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.status, 'TRADE_INTENT_SELECTED');
  assert.equal(result.receipt.selection.status, 'RELEASED');
  assert.equal(result.receipt.selection.command, 'prepare_tradier_sandbox_order');
  assert.equal(result.receipt.tradeIntent.symbol, 'RKLB');
  assert.equal(result.receipt.safety.orderPreviewed, false);
  assert.equal(result.receipt.safety.orderPlaced, false);
  assert.equal(providerCalls, 1);
  assert.deepEqual(b.calls, ['quote', 'account']);

  const again = await Decision.execute(s, b, { approve: true, packetId }, { provider: async () => { throw new Error('must not repeat'); } });
  assert.equal(again.idempotent, true);
  assert.equal(providerCalls, 1);
  assert.deepEqual(b.calls, ['quote', 'account']);

  const abstainStore = await seeded();
  const abstained = await Decision.execute(abstainStore, broker(0), { approve: true, packetId }, {
    env: {}, provider: async () => ({ ok: true, provider: 'test', model: 'fixture', text: JSON.stringify(proposal('ABSTAIN', 0.9)) })
  });
  assert.equal(abstained.receipt.status, 'ABSTAINED');
  assert.equal(abstained.receipt.tradeIntent, null);
  assert.equal(abstained.receipt.selection, null);

  console.log('finance trade decision: passed');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
