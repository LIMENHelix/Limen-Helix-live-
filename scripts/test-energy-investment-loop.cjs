#!/usr/bin/env node
'use strict';
var assert = require('node:assert/strict');
var Decision = require('../lib/energy-investment-decision.js');
var Executor = require('../lib/energy-investment-executor.js');
var Recovery = require('../lib/energy-investment-recovery.js');
var StrictStore = require('../lib/autofire-efference-store.js');

function memory() { var values = new Map(), lists = new Map(); return { assertDurable: function () {},
  get: async function (k) { return values.get(k) || null; }, set: async function (k, v) { values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  setIfAbsent: async function (k, v) { if (values.has(k)) return false; values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  lpush: async function (k, v) { var a = lists.get(k) || []; a.unshift(JSON.parse(JSON.stringify(v))); lists.set(k, a); return a.length; },
  ltrim: async function () {}, lrange: async function () { return []; } }; }
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

  var calls = 0;
  var result = await Executor.execute({ store: store, candidate: candidate, decision: decision,
    broker: { quote: async function () { calls++; } }, b14: { createPreview: async function () { calls++; } }, now: now + 1 });
  assert.equal(result.status, 'HELD');
  assert.equal(result.reason, 'energy-investment-authority-moved-to-finance-domain');
  assert.equal(result.ownerDomain, 'finance');
  assert.equal(result.brokerCalls, 0);
  assert.equal(result.orderSubmissionCalls, 0);
  assert.equal(calls, 0);

  var recovered = await Recovery.recover({ store: store, command: { schemaVersion: Executor.SCHEMA, status: 'COMMAND_RECEIPTED', brokerCommandId: 'legacy-command' },
    trigger: { type: 'energy-investment-kill', id: 'kill-1' }, env: { ENERGY_INVESTMENT_RECOVERY_ENABLED: '1' }, now: now + 2 });
  assert.equal(recovered.status, 'HELD');
  assert.equal(recovered.reason, 'energy-investment-recovery-owned-by-finance-only');

  var held = await Decision.decide(store, candidate, now, { cognition: cognition(now), titleSets: titleSets.slice(0, 1), maxNotionalUsd: 150 });
  assert.equal(held.status, 'NO_ACTION');
  assert(held.blockers.includes('energy-exact-current-feed-evidence-not-confirmed'));
  console.log('energy investment loop: source-gated decision, Energy motor quarantine, and Finance ownership boundary passed');
})().catch(function (error) { console.error(error.stack || error); process.exit(1); });
