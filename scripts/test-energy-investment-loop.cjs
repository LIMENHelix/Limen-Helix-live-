#!/usr/bin/env node
'use strict';
var assert = require('node:assert/strict');
var Decision = require('../lib/energy-investment-decision.js');
var Executor = require('../lib/energy-investment-executor.js');
var Recovery = require('../lib/energy-investment-recovery.js');
var Cycle = require('../handlers/energy-investment-cycle.js');
var StrictStore = require('../lib/autofire-efference-store.js');

function memory() { var values = new Map(), lists = new Map(); return { assertDurable: function () {},
  get: async function (k) { return values.get(k) || null; }, set: async function (k, v) { values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  setIfAbsent: async function (k, v) { if (values.has(k)) return false; values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  lpush: async function (k, v) { var a = lists.get(k) || []; a.unshift(JSON.parse(JSON.stringify(v))); lists.set(k, a); return a.length; },
  ltrim: async function (k, s, e) { lists.set(k, (lists.get(k) || []).slice(s, e + 1)); },
  lrange: async function (k, s, e) { return JSON.parse(JSON.stringify((lists.get(k) || []).slice(s, e < 0 ? undefined : e + 1))); } }; }
function cognition(now, immune) { return { ts: now, c: { domain: 'energy', immune: immune || { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
  brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'energy', packetId: 'energy-packet-1', generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 4 }, opportunities: [{ id: 'energy-invest-1', path: 'INVESTABLE', held: false }] } } } }; }

(async function () {
  ['energy_investment_worklist', 'energy_investment_decision_log', 'energy_investment_command_log', 'energy_investment_recovery_log'].forEach(function (key) { assert.equal(StrictStore.assertKey(key), key); });
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
  assert.equal(decision.returnedOutcome.status, 'UNOBSERVED');

  await store.set(Cycle.taskKey(candidate.requestId), { schemaVersion: 'energy-investment-task/1.0', taskId: candidate.requestId, candidate: candidate, status: 'QUEUED' });
  await store.lpush(Cycle.WORKLIST, { taskId: candidate.requestId });
  var cycleResponse = await new Promise(function (resolve) {
    var response = { statusCode: 0, setHeader: function () {}, end: function (value) { resolve({ status: this.statusCode, body: JSON.parse(value) }); } };
    Cycle.createHandler({ store: store, enabled: true, cronAuth: { enforce: function () { return true; } }, cognition: cognition(now),
      readTitleSets: async function () { return titleSets; }, decision: { decide: async function () { return decision; } },
      executor: { execute: async function () { return { status: 'COMMAND_RECEIPTED', accepted: 1, commandId: 'energy-command-1' }; } } })
      ({ method: 'GET', headers: {} }, response);
  });
  assert.equal(cycleResponse.status, 200); assert.equal(cycleResponse.body.accepted, 1);
  assert.equal(cycleResponse.body.results[0].status, 'COMMAND_RECEIPTED');
  assert.equal((await store.get(Cycle.taskKey(candidate.requestId))).status, 'COMPLETED');

  var calls = 0;
  var result = await Executor.execute({ store: store, candidate: candidate, decision: decision,
    broker: { quote: async function () { calls++; } }, b14: { createPreview: async function () { calls++; } }, now: now + 1 });
  assert.equal(result.status, 'HELD');
  assert.equal(result.reason, 'energy-investment-paper-order-switch-off');
  assert.equal(result.ownerDomain, 'energy');
  assert.equal(result.brokerCalls, 0);
  assert.equal(result.orderSubmissionCalls, 0);
  assert.equal(calls, 0);

  var recovered = await Recovery.recover({ store: store, command: { schemaVersion: Executor.SCHEMA, status: 'COMMAND_RECEIPTED', brokerCommandId: 'legacy-command' },
    trigger: { type: 'energy-investment-kill', id: 'kill-1' }, env: { ENERGY_INVESTMENT_RECOVERY_ENABLED: '1' }, now: now + 2 });
  assert.equal(recovered.status, 'HELD');
  assert.equal(recovered.reason, 'energy-investment-developmental-switch-off');

  var held = await Decision.decide(store, candidate, now, { cognition: cognition(now), titleSets: titleSets.slice(0, 1), maxNotionalUsd: 150 });
  assert.equal(held.status, 'NO_ACTION');
  assert(held.blockers.includes('energy-exact-current-feed-evidence-not-confirmed'));
  var paper = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 1,
    env: { ENERGY_INVESTMENT_PAPER_ORDER_ENABLED: '1', ENERGY_INVESTMENT_RECOVERY_ENABLED: '1' },
    maxNotionalUsd: 150, dailyNotionalBudgetUsd: 200, dailyOrderCap: 2,
    motorAuthorization: { authorize: async function () { return { authorized: true, receiptId: 'fixture-energy-motor' }; } },
    broker: { quote: async function (symbol) { return { last: symbol === 'SPY' ? 500 : 10 }; }, accountSnapshot: async function () { return { totalCash: 1000 }; } },
    b14: { createPreview: async function () { await require('./assert-business-trace.cjs').beforeProvider(store, 'energy', now + 1000); return { previewId: 'fixture-energy-preview', confirmationSummary: 'fixture only' }; },
      submitApproved: async function (_store, _broker, input) {
        assert.equal(input.approval.ownerDomain, 'energy');
        return { commandId: 'fixture-energy-broker-command', receipt: { orderId: 'fixture-energy-paper-order' } };
      } } });
  assert.equal(paper.status, 'COMMAND_RECEIPTED');
  await require('./assert-business-trace.cjs')(store, 'energy', paper, 'PAPER-ORDER', now + 1000);
  await require('./assert-business-trace.cjs').journalFailure(memory(), 'energy', candidate, decision, now + 1);
  console.log('energy investment loop: source-gated decision, Energy-owned paper motor boundary, recovery and read-only business trace passed');
})().catch(function (error) { console.error(error.stack || error); process.exit(1); });
