#!/usr/bin/env node
'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var Decision = require('../lib/economy-investment-decision.js');
var Executor = require('../lib/economy-investment-executor.js');
var Recovery = require('../lib/economy-investment-recovery.js');
var Learning = require('../lib/autofire-learning.js');
var StrictStore = require('../lib/autofire-efference-store.js');

function memory() { var values = new Map(), lists = new Map(); return { values: values, lists: lists, assertDurable: function () {},
  get: async function (k) { return values.get(k) || null; }, set: async function (k, v) { values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  setIfAbsent: async function (k, v) { if (values.has(k)) return false; values.set(k, JSON.parse(JSON.stringify(v))); return true; },
  lpush: async function (k, v) { var a = lists.get(k) || []; a.unshift(JSON.parse(JSON.stringify(v))); lists.set(k, a); return a.length; },
  ltrim: async function (k, s, e) { var a = lists.get(k) || []; lists.set(k, a.slice(s, e + 1)); },
  lrange: async function (k, s, e) { var a = lists.get(k) || []; return JSON.parse(JSON.stringify(a.slice(s, e < 0 ? undefined : e + 1))); } }; }
function cognition(now) { return { ts: now, c: { domain: 'economy', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
  brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'economy', packetId: 'economy-packet-1', generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 4 }, opportunities: [{ id: 'econ-invest-1', path: 'INVESTABLE', held: false }] } } } }; }

(async function () {
  ['economy_investment_worklist', 'economy_investment_decision_log', 'economy_investment_command_log', 'economy_investment_recovery_log',
    'economy_investment_task:test', 'economy_investment_decision:test', 'economy_investment_command:test', 'economy_investment_action:test',
    'economy_investment_motor_claim:test', 'economy_investment_budget_slot:test', 'economy_investment_observation:test',
    'economy_investment_recovery:test', 'economy_investment_developmental_slot:test'].forEach(function (key) { assert.equal(StrictStore.assertKey(key), key); });
  var store = memory(), now = Date.now(), evidence = [
    { title: 'Acme demand improves', url: 'https://one.example/acme', feedName: 'economy-one', recordedAt: new Date(now).toISOString() },
    { title: 'Acme margins stabilize', url: 'https://two.example/acme', feedName: 'economy-two', recordedAt: new Date(now).toISOString() }
  ];
  var candidate = Decision.candidate({ requestId: 'econ-request-1', symbol: 'ACME', issuerName: 'Acme Inc', side: 'buy', maxNotionalUsd: 100,
    riskLimitPct: 8, benchmarkSymbol: 'SPY', thesisId: 'econ-thesis-1', brainOpportunityId: 'econ-invest-1', feedEvidence: evidence, paperOnly: true, liveMoney: false });
  assert(candidate);
  var titleSets = evidence.map(function (row, i) { return { d: 'economy', f: row.feedName, t: now, items: [{ i: i, ti: row.title, au: row.url, tr: false }] }; });
  // LOCAL proof: the existing source-valid candidate stays represented on every immune route.
  var routeStore = memory(), candidateBefore = JSON.stringify(candidate);
  for (var routeCase of [
    ['PASS', { immuneState: 'clear' }],
    ['HOLD', { immuneState: 'clear', quarantines: ['unresolved-domain-evidence'] }],
    ['QUARANTINE', { immuneState: 'alert', candidateScoped: true, integrityThreat: true }],
    ['REJECT', null]
  ]) {
    var routeCognition = JSON.parse(JSON.stringify(cognition(now))); routeCognition.c.immune = routeCase[1];
    var routed = await Decision.decide(routeStore, candidate, now, { cognition: routeCognition, titleSets: titleSets, maxNotionalUsd: 150 });
    assert.equal(routed.immuneRouting.route, routeCase[0]);
    assert.equal(routed.immuneRouting.candidatePreserved, true);
    var readonlyRouteStore = Object.create(routeStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) {
      readonlyRouteStore[method] = async function () { throw Error('route read attempted write'); };
    });
    readonlyRouteStore.lrange = async function (key, start, end) {
      return key === Decision.LOG_KEY ? [routed] : routeStore.lrange(key, start, end);
    };
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'economy', now);
    assert.equal(routeTrace.status, 'RECORDED');
    assert.equal(routeTrace.decision.id, routed.decisionReceiptId);
    assert.equal(routeTrace.decision.immuneRoute, routeCase[0]);
    assert.equal(routeTrace.command, null);
    assert.equal(routeTrace.externalActionAuthorized, false);
    var routeElement = { innerHTML: '' }, routeWindow = { addEventListener: function () {} };
    require('node:vm').runInNewContext(fs.readFileSync('assets/js/civilization/execution-observatory.js', 'utf8'), {
      window: routeWindow, Date: Date, setTimeout: setTimeout, clearTimeout: clearTimeout, AbortController: AbortController, setInterval: function () {},
      document: { readyState: 'loading', addEventListener: function () {}, getElementById: function () { return routeElement; } },
      fetch: async function (url) { return { ok: true, json: async function () {
        return url.includes('brain-cognition') ? { cognition: { 'economy': { ts: now, c: { businessTrace: routeTrace } } } } : {};
      } }; }
    });
    await routeWindow.LIMENExecutionObservatory.refresh();
    assert(routeElement.innerHTML.includes(routed.decisionReceiptId));
    assert(routeElement.innerHTML.includes(routeCase[0]));
    assert.equal(routed.status, routeCase[0] === 'PASS' ? 'RELEASED' : 'NO_ACTION');
    assert.equal(Decision.validateReceipt(routed, candidate, now), routeCase[0] === 'PASS');
    assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed);
    assert.deepEqual(await Decision.decide(routeStore, candidate, now, { cognition: routeCognition, titleSets: titleSets, maxNotionalUsd: 150 }), routed, 'immutable route replay');
    if (routeCase[0] !== 'PASS') {
      var reconsidered = await Decision.decide(routeStore, candidate, now + 1, { cognition: cognition(now), titleSets: titleSets, maxNotionalUsd: 150 });
      assert.equal(reconsidered.immuneRouting.route, 'PASS');
      assert.notEqual(reconsidered.decisionReceiptId, routed.decisionReceiptId);
      assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed, 'reconsideration preserves prior route');
      var refused = await Executor.execute({ store: routeStore, candidate: candidate, decision: routed, now: now + 1,
        motorAuthorization: { authorize: async function () { throw Error('non-PASS reached motor'); } },
        b14: { createPreview: async function () { throw Error('non-PASS reached transport'); }, submitApproved: async function () { throw Error('non-PASS reached transport'); } } });
      assert.equal(refused.reason, 'economy-investment-exact-b10-decision-required');
      assert.equal(refused.accepted, 0);
    }
  }
  assert.equal((await routeStore.lrange(Decision.LOG_KEY, 0, 99)).length, 4);
  assert.equal(JSON.stringify(candidate), candidateBefore);
  var legacy = await Decision.decide(memory(), candidate, now, { cognition: cognition(now), titleSets: titleSets, maxNotionalUsd: 150 });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize a paper order');



  var decision = await Decision.decide(store, candidate, now, { cognition: cognition(now), titleSets: titleSets, maxNotionalUsd: 150 });
  assert.equal(decision.status, 'RELEASED');
  assert.equal(decision.returnedOutcome.status, 'UNOBSERVED');
  var b14 = { createPreview: async function (_s, _b, intent) { assert.equal(intent.ownerDomain, 'economy'); await require('./assert-business-trace.cjs').beforeProvider(store, 'economy', now + 1000); return { previewId: 'epv1', confirmationSummary: 'confirm' }; },
    submitApproved: async function (_s, _b, input) { assert.deepEqual(input.approval, { mode: 'domain-autonomous', actor: 'economy-brain', ownerDomain: 'economy', authorizationReceiptId: 'economy-motor-receipt-1', authorizationMode: 'mature-production-capability' }); assert(await store.get(Learning.causeKey(decision.actionId))); return { commandId: 'broker-command-1', receipt: { orderId: 'paper-order-1' }, rollback: { confirmationSummary: 'cancel' } }; } };
  var broker = { quote: async function (s) { return { symbol: s, last: s === 'SPY' ? 500 : 10, bid: s === 'SPY' ? 499 : 9.99, ask: s === 'SPY' ? 501 : 10.01 }; }, accountSnapshot: async function () { return { totalCash: 1000 }; } };
  var authorization = { authorize: async function () { return { authorized: true, receiptId: 'economy-motor-receipt-1' }; } };
  var result = await Executor.execute({ store: store, candidate: candidate, decision: decision, broker: broker, b14: b14, motorAuthorization: authorization,
    env: { ECONOMY_INVESTMENT_PAPER_ORDER_ENABLED: '1', ECONOMY_INVESTMENT_RECOVERY_ENABLED: '1' }, maxNotionalUsd: 150, dailyNotionalBudgetUsd: 200, dailyOrderCap: 2, now: now + 1 });
  assert.equal(result.status, 'COMMAND_RECEIPTED'); assert.equal(result.ownerDomain, 'economy'); assert.equal(result.liveMoney, false);
  assert.equal(result.learningCauseDurable, true); assert(result.learningEpisodeId);
  assert.equal((await Learning._load(store, 'economy')).commands[0].ticker, 'ACME');
  var recoveryB14 = { reconcile: async function () { return { commandId: 'broker-command-1', order: { status: 'open', executedQuantity: 0 }, rollback: { confirmationSummary: 'cancel' } }; },
    cancelApproved: async function (_s, _b, input) { assert.deepEqual(input.approval, { mode: 'recovery', actor: 'economy-brain-recovery', ownerDomain: 'economy', authorizationReceiptId: 'economy-motor-receipt-1', authorizationMode: 'mature-production-capability' }); return { commandId: 'broker-command-1', rollback: { receipt: { orderId: 'paper-order-1', status: 'canceled' } } }; } };
  var recovered = await Recovery.recover({ store: store, command: result, trigger: { type: 'economy-investment-kill', id: 'kill-1' }, broker: broker, b14: recoveryB14,
    motorAuthorization: authorization, env: { ECONOMY_INVESTMENT_RECOVERY_ENABLED: '1' }, now: now + 2 });
  assert.equal(recovered.status, 'CANCEL_RECEIPT_PERSISTED'); assert.equal(recovered.rollbackReadbackVerified, true);
  var learnedActionIds = [result.actionId];
  for (var i = 2; i <= 5; i++) {
    var extraCandidate = Decision.candidate({ requestId: 'econ-request-' + i, symbol: 'ACME', issuerName: 'Acme Inc', side: 'buy', maxNotionalUsd: 100,
      riskLimitPct: 8, benchmarkSymbol: 'SPY', thesisId: 'econ-thesis-' + i, brainOpportunityId: 'econ-invest-1', feedEvidence: evidence, paperOnly: true, liveMoney: false });
    var extraDecision = await Decision.decide(store, extraCandidate, now + i, { cognition: cognition(now + i), titleSets: titleSets, maxNotionalUsd: 150 });
    assert.equal(extraDecision.status, 'RELEASED');
    var extraCommand = { ownerDomain: 'economy', actionId: extraDecision.actionId, decisionReceiptId: extraDecision.decisionReceiptId, commandedAt: now + i };
    var extraLearning = await Learning.recordProductInvestmentCommand(store, { domain: 'economy', candidate: extraCandidate, decision: extraDecision, command: extraCommand, emittedAt: now + i });
    assert.equal(extraLearning.ok, true); learnedActionIds.push(extraDecision.actionId);
  }
  for (var j = 0; j < learnedActionIds.length; j++) {
    var observed = await Learning.recordOutcome(store, {
      eventId: 'economy-observed-' + j, eventType: 'OUTCOME_INVESTMENT_PNL', lane: 'investment', ownerDomain: 'economy',
      actionId: learnedActionIds[j], ts: now + 100 + j,
      sourceIdentity: { kind: 'tradier-paper-account-read', value: 'economy-order-' + j },
      outcomeData: { horizonDays: 30, investedAmount: 100, netPnl: -1, returnPct: -1, benchmarkReturnPct: 0,
        maxDrawdownPct: 1, riskBreach: false, executionMode: 'paper', brokerOrderId: 'economy-order-' + j }
    });
    assert.equal(observed.ok, true); assert.equal(observed.assessment.outcome, 'FAILURE');
  }
  var nextCandidate = Decision.candidate({ requestId: 'econ-request-6', symbol: 'ACME', issuerName: 'Acme Inc', side: 'buy', maxNotionalUsd: 100,
    riskLimitPct: 8, benchmarkSymbol: 'SPY', thesisId: 'econ-thesis-6', brainOpportunityId: 'econ-invest-1', feedEvidence: evidence, paperOnly: true, liveMoney: false });
  var nextDecision = await Decision.decide(store, nextCandidate, now + 200, { cognition: cognition(now + 200), titleSets: titleSets, maxNotionalUsd: 150 });
  assert.equal(nextDecision.status, 'NO_ACTION');
  assert(nextDecision.blockers.includes('economy-returned-outcome-requires-reassessment'));
  assert.equal(nextDecision.returnedOutcome.status, 'OBSERVED');
  assert.equal(nextDecision.returnedOutcome.effect, 'HOLD_FOR_NEW_ECONOMY_EVIDENCE');
  var held = await Decision.decide(store, candidate, now, { cognition: cognition(now), titleSets: titleSets.slice(0, 1), maxNotionalUsd: 150 });
  assert.equal(held.status, 'NO_ACTION'); assert(held.blockers.includes('economy-exact-current-feed-evidence-not-confirmed'));
  await require('./assert-business-trace.cjs')(store, 'economy', result, 'PAPER-ORDER', now + 1000);
  await require('./assert-business-trace.cjs').journalFailure(memory(), 'economy', candidate, decision, now + 1);
  console.log('economy investment loop: source-gated decision, durable paper receipt, cancel recovery and read-only business trace passed');
})().catch(function (error) { console.error(error); process.exit(1); });
