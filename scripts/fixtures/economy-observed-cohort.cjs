'use strict';
// All transport and time are LOCAL fixtures. Decisions, commands, observations,
// event normalization, cohort grading, HTTP readout and native cycles are real.
const assert = require('node:assert/strict');
const Decision = require('../../lib/economy-investment-decision.js');
const Executor = require('../../lib/economy-investment-executor.js');
const Learning = require('../../lib/autofire-learning.js');
module.exports = async function observedCohort(memory, invoke) {
  const store = memory(), day = 86400000, NativeDate = Date;
  const start = Date.parse('2026-05-01T12:00:00Z'); let now = start;
  const paths = ['../../lib/autofire-efference-store.js', '../../handlers/limen-outcome.js', '../../handlers/product-domain-learning-state.js'].map(require.resolve);
  const cached = paths.map(p => require.cache[p]), oldFetch = global.fetch;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL, oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = new Map(), commands = [], events = new Map();
  global.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
  process.env.UPSTASH_REDIS_REST_URL = 'https://fixture.invalid/redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'LOCAL-cohort-token';
  require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: store };
  delete require.cache[paths[1]];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://fixture.invalid/redis'); const cmd = JSON.parse(options.body); let result;
    if (cmd[0] === 'GET') result = null;
    else if (cmd[0] === 'LPUSH') { const rows = redis.get(cmd[1]) || []; rows.unshift(cmd[2]); redis.set(cmd[1], rows); result = rows.length; }
    else if (cmd[0] === 'LRANGE') result = (redis.get(cmd[1]) || []).slice(cmd[2], cmd[3] < 0 ? undefined : cmd[3] + 1);
    else if (cmd[0] === 'LTRIM') { redis.set(cmd[1], (redis.get(cmd[1]) || []).slice(cmd[2], cmd[3] + 1)); result = 'OK'; }
    else if (cmd[0] === 'INCRBY' || cmd[0] === 'INCRBYFLOAT') result = 1;
    else throw Error('unexpected LOCAL Redis operation ' + cmd[0]);
    return { ok: true, json: async () => ({ result }) };
  };
  try {
    const actualOutcome = require(paths[1]);
    const broker = {
      accountSnapshot: async () => ({ accountId: 'LOCAL-cohort-account', positions: commands.map(c => ({ symbol: c.symbol, quantity: c.quantity, marketValue: c.quantity * (now < start + 30 * day ? 10 : 9) })) }),
      quote: async symbol => ({ symbol, last: symbol === 'SPY' ? 500 : (now < start + 30 * day ? 10 : 9), bid: 10, ask: 10 })
    };
    const deps = { store, broker, b14: { reconcile: async (_store, _broker, id) => store.get('tradier_b14_command:' + id) },
      outcome: { recordAutonomousOutcome: async event => {
        const owned = commands.find(c => c.actionId === event.actionId); assert(owned);
        assert.equal(event.ownerDomain, 'economy'); assert.equal(event.outcomeData.brokerOrderId, owned.brokerOrderId);
        assert.equal(event.outcomeData.executionMode, 'paper');
        const at = NativeDate.parse(event.observedAt);
        assert(at >= owned.commandedAt + event.outcomeData.horizonDays * day);
        assert(at <= owned.commandedAt + (event.outcomeData.horizonDays + 2) * day);
        const result = await actualOutcome.recordAutonomousOutcome(event);
        assert.equal(result.ok, true); assert.notEqual(result.learningAccepted, false);
        assert.deepEqual(result.event.sourceIdentity, event.sourceIdentity);
        events.set(result.event.eventId, result.event); return result;
      } } };
    // Two accepted commands per day, with the existing $200/day conservative
    // slot budget. Each command has a distinct issuer, thesis, motor and receipt.
    for (let i = 0; i < 10; i++) {
      now = start + Math.floor(i / 2) * day + (i % 2) * 60000;
      const symbol = 'LOCAL' + String.fromCharCode(65 + i), opportunity = 'LOCAL-opportunity-' + i;
      const feedEvidence = [0, 1].map(n => ({ title: 'LOCAL issuer ' + i + ' feed ' + n, url: 'https://fixture.invalid/economy/' + i + '/' + n, feedName: 'LOCAL-feed-' + n, recordedAt: new Date().toISOString() }));
      const candidate = Decision.candidate({ requestId: 'LOCAL-request-' + i, symbol, issuerName: 'LOCAL issuer ' + i, side: 'buy', maxNotionalUsd: 100, riskLimitPct: 8, benchmarkSymbol: 'SPY', thesisId: 'LOCAL-thesis-' + i, brainOpportunityId: opportunity, feedEvidence, paperOnly: true, liveMoney: false });
      const cognition = { ts: now, c: { domain: 'economy', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false }, brainOrgans: { autonomousInternalEmission: { emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } }, serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'economy', packetId: 'LOCAL-packet-' + i, generatedAt: new Date().toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 2 }, opportunities: [{ id: opportunity, path: 'INVESTABLE', held: false }] } } } };
      const titleSets = feedEvidence.map(e => ({ d: 'economy', f: e.feedName, t: now, items: [{ ti: e.title, au: e.url, tr: false }] }));
      const decision = await Decision.decide(store, candidate, now, { cognition, titleSets, maxNotionalUsd: 150 });
      assert.equal(decision.status, 'RELEASED', JSON.stringify(decision)); let intent;
      const b14 = { createPreview: async (_s, _b, value) => { intent = structuredClone(value); return { previewId: 'LOCAL-preview-' + i, confirmationSummary: 'LOCAL-confirm-' + i }; }, submitApproved: async () => {
        const commandId = 'LOCAL-broker-' + i, orderId = 'LOCAL-order-' + i;
        const value = { schemaVersion: 1, commandId, emittedAt: new Date().toISOString(), intent, tag: 'LOCAL-tag-' + i, receipt: { orderId, receivedAt: new Date().toISOString() }, accountBefore: { accountId: 'LOCAL-cohort-account', positions: [] }, status: 'RECONCILED_TERMINAL', order: { id: orderId, symbol, side: 'buy', status: 'filled', executedQuantity: intent.quantity, averageFillPrice: 10, transactionAt: new Date().toISOString() }, reafference: { matchedSelfEffect: { executedQuantity: intent.quantity, averageFillPrice: 10 } }, reconciliation: { interveningTrades: 0, actualFees: 0 } };
        await store.set('tradier_b14_command:' + commandId, value); return value;
      } };
      const owned = await Executor.execute({ store, candidate, decision, now, broker, b14, motorAuthorization: { authorize: async () => ({ authorized: true, receiptId: 'LOCAL-motor-' + i }) }, env: { ECONOMY_INVESTMENT_PAPER_ORDER_ENABLED: '1', ECONOMY_INVESTMENT_RECOVERY_ENABLED: '1' }, maxNotionalUsd: 150, dailyNotionalBudgetUsd: 200, dailyOrderCap: 2 });
      assert.equal(owned.status, 'COMMAND_RECEIPTED', JSON.stringify(owned)); commands.push(owned);
      const baseline = await invoke(deps); assert.equal(baseline.code, 200, JSON.stringify(baseline.body)); assert.equal(baseline.body.recorded, 0);
    }
    const slots = [...store.values.values()].filter(v => v && v.schemaVersion === Executor.SCHEMA && v.slot && v.day);
    assert.equal(slots.length, 10);
    for (const date of new Set(slots.map(v => v.day))) { const rows = slots.filter(v => v.day === date); assert.equal(rows.length, 2); assert(rows.reduce((sum, v) => sum + v.reservedNotionalUsd, 0) <= 200); }
    async function endpoint(proofStore) {
      const readonly = Object.create(proofStore);
      for (const method of ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del']) readonly[method] = async () => { throw Error('learner HTTP read attempted mutation'); };
      require.cache[paths[0]] = { id: paths[0], filename: paths[0], loaded: true, exports: readonly }; delete require.cache[paths[2]];
      let body; const res = { setHeader() {}, end: text => { body = JSON.parse(text); } };
      await require(paths[2])({ method: 'GET', url: '/api/product-domain-learning-state?domain=economy' }, res);
      assert.equal(res.statusCode, 200); return body;
    }
    let notReady;
    for (const horizon of [30, 60, 90]) {
      for (const at of commands.map(c => c.commandedAt + (horizon + 1) * day).sort((a, b) => a - b)) {
        now = at; const result = await invoke(deps); assert.equal(result.code, 200, JSON.stringify(result.body));
        const current = await Learning._load(store, 'economy');
        const qualified = Object.values(current.investmentCohortSeen).reduce((sum, rows) => sum + Math.floor(rows.length / 5), 0);
        assert.equal(current.externalLearning.resolvedCount, qualified, 'only five distinct observed commands qualify a cohort');
      }
      const state = await Learning._load(store, 'economy');
      assert.equal(state.processedOutcomeIds.length, 10 * ([30, 60, 90].indexOf(horizon) + 1));
      assert.equal(state.externalLearning.resolvedCount, 2 * ([30, 60, 90].indexOf(horizon) + 1));
      assert.equal(state.investmentCohortSeen[String(horizon)].length, 10);
      assert.equal(state.investmentCohorts[String(horizon)].length, 0);
      if (horizon === 30) { notReady = await endpoint(store); assert.equal(notReady.learningGate.ready, false); assert.equal(notReady.resolvedCount, 2); }
    }
    assert.equal(events.size, 30);
    const ready = await endpoint(store), empty = await endpoint(memory());
    assert.equal(ready.resolvedCount, 6); assert.equal(ready.learningGate.ready, true); assert(ready.learningGate.distinctSources >= 2);
    assert.equal(ready.signal.normalizedCredit, 0); assert.equal(empty.signal, null); assert.equal(empty.resolvedCount, 0);
    const before = JSON.stringify([...store.values]); const replay = await invoke(deps);
    assert.equal(replay.body.recorded, 0); assert.equal(events.size, 30); assert.equal(JSON.stringify([...store.values]), before);
    const native = require('./publication-native-cycle.cjs'), fixedAt = now + 1000;
    const admitted = await native('economy', ready, fixedAt), neutral = await native('economy', empty, fixedAt), pending = await native('economy', notReady, fixedAt);
    assert.equal(admitted.externalRewardEligible, false, 'preserve existing Economy K4 exclusion');
    for (const result of [admitted, neutral, pending]) assert.equal(result.plasticity.rewardActive, false);
    assert.deepEqual(admitted.evaluated, neutral.evaluated); assert.deepEqual(pending.evaluated, neutral.evaluated);
    console.log('Economy actual observed cohort/native return', JSON.stringify({ commands: commands.length, processedOutcomes: events.size, cohortSignals: ready.resolvedCount, sources: ready.learningGate.distinctSources, ready: ready.learningGate.ready, notReady: notReady.learningGate.ready, rewardActive: admitted.plasticity.rewardActive, sameEvaluation: true, evidence: 'LOCAL/FIXTURE' }));
  } finally {
    global.Date = NativeDate; global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
    paths.forEach((p, i) => { if (cached[i]) require.cache[p] = cached[i]; else delete require.cache[p]; });
  }
};
