#!/usr/bin/env node
'use strict';
var assert = require('node:assert/strict');
var Decision = require('../lib/energy-investment-decision.js');
var Executor = require('../lib/energy-investment-executor.js');
var Recovery = require('../lib/energy-investment-recovery.js');
var StrictStore = require('../lib/autofire-efference-store.js');

function memory() { var values = new Map(), lists = new Map(); return { values: values, lists: lists, assertDurable: function () {},
  get: async function (k) { return values.get(k) || null; }, set: async function (k, v) { values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  setIfAbsent: async function (k, v) { if (values.has(k)) return false; values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  lpush: async function (k, v) { var a = lists.get(k) || []; a.unshift(JSON.parse(JSON.stringify(v))); lists.set(k, a); return a.length; },
  ltrim: async function (k, s, e) { var a = lists.get(k) || []; lists.set(k, a.slice(s, e + 1)); },
  lrange: async function (k, s, e) { var a = lists.get(k) || []; return JSON.parse(JSON.stringify(a.slice(s, e < 0 ? undefined : e + 1))); } }; }
function cognition(now) { return { ts: now, c: { domain: 'energy', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
  brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'energy', packetId: 'energy-packet-1', generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 4 }, opportunities: [{ id: 'energy-invest-1', path: 'INVESTABLE', held: false }] } } } }; }

(async function () {
  ['energy_investment_worklist', 'energy_investment_decision_log', 'energy_investment_command_log', 'energy_investment_recovery_log',
    'energy_investment_task:test', 'energy_investment_decision:test', 'energy_investment_command:test', 'energy_investment_action:test',
    'energy_investment_motor_claim:test', 'energy_investment_budget_slot:test', 'energy_investment_observation:test',
    'energy_investment_recovery:test', 'energy_investment_developmental_slot:test'].forEach(function (key) { assert.equal(StrictStore.assertKey(key), key); });
  var store = memory(), now = Date.now(), evidence = [
    { title: 'Acme demand improves', url: 'https://one.example/acme', feedName: 'energy-one', recordedAt: new Date(now).toISOString() },
    { title: 'Acme margins stabilize', url: 'https://two.example/acme', feedName: 'energy-two', recordedAt: new Date(now).toISOString() }
  ];
  var candidate = Decision.candidate({ requestId: 'energy-request-1', symbol: 'ACME', issuerName: 'Acme Inc', side: 'buy', maxNotionalUsd: 100,
    riskLimitPct: 8, benchmarkSymbol: 'SPY', thesisId: 'energy-thesis-1', brainOpportunityId: 'energy-invest-1', feedEvidence: evidence, paperOnly: true, liveMoney: false });
  assert(candidate);
  var titleSets = evidence.map(function (row, i) { return { d: 'energy', f: row.feedName, t: now, items: [{ i: i, ti: row.title, au: row.url, tr: false }] }; });
  var decision = await Decision.decide(store, candidate, now, { cognition: cognition(now), titleSets: titleSets, maxNotionalUsd: 150 });
  assert.equal(decision.status, 'RELEASED');
  var b14 = { createPreview: async function (_s, _b, intent) { assert.equal(intent.ownerDomain, 'energy'); return { previewId: 'epv1', confirmationSummary: 'confirm' }; },
    submitApproved: async function () { return { commandId: 'broker-command-1', receipt: { orderId: 'paper-order-1' }, rollback: { confirmationSummary: 'cancel' } }; } };
  var broker = { quote: async function (s) { return { symbol: s, last: s === 'SPY' ? 500 : 10, bid: s === 'SPY' ? 499 : 9.99, ask: s === 'SPY' ? 501 : 10.01 }; }, accountSnapshot: async function () { return { totalCash: 1000 }; } };
  var authorization = { authorize: async function () { return { authorized: true, receiptId: 'energy-motor-receipt-1' }; } };
  var result = await Executor.execute({ store: store, candidate: candidate, decision: decision, broker: broker, b14: b14, motorAuthorization: authorization,
    env: { ENERGY_INVESTMENT_PAPER_ORDER_ENABLED: '1', ENERGY_INVESTMENT_RECOVERY_ENABLED: '1' }, maxNotionalUsd: 150, dailyNotionalBudgetUsd: 200, dailyOrderCap: 2, now: now + 1 });
  assert.equal(result.status, 'COMMAND_RECEIPTED'); assert.equal(result.ownerDomain, 'energy'); assert.equal(result.liveMoney, false);
  var recoveryB14 = { reconcile: async function () { return { commandId: 'broker-command-1', order: { status: 'open', executedQuantity: 0 }, rollback: { confirmationSummary: 'cancel' } }; },
    cancelApproved: async function () { return { commandId: 'broker-command-1', rollback: { receipt: { orderId: 'paper-order-1', status: 'canceled' } } }; } };
  var recovered = await Recovery.recover({ store: store, command: result, trigger: { type: 'energy-investment-kill', id: 'kill-1' }, broker: broker, b14: recoveryB14,
    motorAuthorization: authorization, env: { ENERGY_INVESTMENT_RECOVERY_ENABLED: '1' }, now: now + 2 });
  assert.equal(recovered.status, 'CANCEL_RECEIPT_PERSISTED'); assert.equal(recovered.rollbackReadbackVerified, true);
  var held = await Decision.decide(store, candidate, now, { cognition: cognition(now), titleSets: titleSets.slice(0, 1), maxNotionalUsd: 150 });
  assert.equal(held.status, 'NO_ACTION'); assert(held.blockers.includes('energy-exact-current-feed-evidence-not-confirmed'));
  console.log('energy investment loop: source-gated decision, durable paper receipt, and cancel recovery passed');
})().catch(function (error) { console.error(error); process.exit(1); });
