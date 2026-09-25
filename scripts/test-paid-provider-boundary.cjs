#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const storePath = require.resolve(path.join(ROOT, 'lib/autofire-efference-store.js'));
const meterPath = require.resolve(path.join(ROOT, 'lib/spend-meter.js'));
const killPath = require.resolve(path.join(ROOT, 'lib/ai-kill-switch.js'));
const boundaryPath = require.resolve(path.join(ROOT, 'lib/paid-provider-boundary.js'));
const financePath = require.resolve(path.join(ROOT, 'lib/finance-structured-provider.js'));
const orbPath = require.resolve(path.join(ROOT, 'handlers/orb-voice.js'));

function clear(modulePath) { delete require.cache[modulePath]; }

(async function () {
  const previousFetch = global.fetch;
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const previousAgentBuild = process.env.AGENT_BUILD;
  const previousRunCap = process.env.AGENT_BUDGET_USD;
  const previousDayCap = process.env.LIMEN_DAILY_BUDGET_USD;

  try {
    // The strict store exposes only the reviewed reserve/settle Lua shapes, not arbitrary EVAL.
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture';
    const commands = [];
    global.fetch = async function (_url, options) {
      const command = JSON.parse(options.body);
      commands.push(command);
      const result = command[1].includes('idempotency_in_flight')
        ? { ok: true, id: 'rsv-fixture', estUsd: 0.25, metered: true }
        : { ok: true, chargedUsd: 0.2 };
      return { status: 200, text: async () => JSON.stringify({ result: JSON.stringify(result) }) };
    };
    clear(storePath);
    const strictStore = require(storePath);
    const reserved = await strictStore.reserveSpendAtomic('spend:ledger:v1', {
      id: 'rsv-fixture', estUsd: 0.25, now: 1, runId: 'run', day: '2026-09-25',
      kind: 'ai', label: 'proof', scope: 'finance:proof', idempotencyKey: 'proof:1',
      runCapUsd: 1, dailyCapUsd: 2, scopeDailyCapUsd: 0.5,
      reservationTtlMs: 600000, idempotencyTtlMs: 3600000
    });
    assert.equal(reserved.ok, true);
    assert.equal(commands[0][0], 'EVAL');
    assert.equal(commands[0][3], 'limen:spend:ledger:v1');
    assert.match(commands[0][1], /idempotency_in_flight/);
    assert.match(commands[0][1], /scopeDailyCapUsd/);
    assert.match(commands[0][1], /redis\.call\("SET", KEYS\[1\]/);
    assert.equal(Object.prototype.hasOwnProperty.call(strictStore, 'eval'), false);

    const settled = await strictStore.settleSpendAtomic('spend:ledger:v1', 'rsv-fixture', 0.2, 2, 3600000);
    assert.equal(settled.ok, true);
    assert.match(commands[1][1], /idempotencyKey/);
    assert.match(commands[1][1], /alreadySettled/);

    // The meter must pass every cap and idempotency field into that one atomic operation.
    const meterCalls = [];
    require.cache[storePath].exports = {
      reserveSpendAtomic: async function (key, request) {
        meterCalls.push({ type: 'reserve', key, request });
        return { ok: true, id: request.id, estUsd: request.estUsd, metered: true };
      },
      settleSpendAtomic: async function (key, id, actualUsd) {
        meterCalls.push({ type: 'settle', key, id, actualUsd });
        return { ok: true, chargedUsd: actualUsd };
      },
      get: async function () { return null; }
    };
    delete process.env.AGENT_BUILD;
    delete process.env.AGENT_BUDGET_USD;
    delete process.env.LIMEN_DAILY_BUDGET_USD;
    clear(meterPath);
    const meter = require(meterPath);
    const metered = await meter.reserve({
      kind: 'external', costUsd: 0.25, requireBudget: true,
      scope: 'finance:proof', scopeDailyCapUsd: 0.5, idempotencyKey: 'proof:1'
    });
    assert.equal(metered.ok, true);
    assert.equal(meterCalls[0].request.scope, 'finance:proof');
    assert.equal(meterCalls[0].request.scopeDailyCapUsd, 0.5);
    assert.equal(meterCalls[0].request.idempotencyKey, 'proof:1');
    assert.equal(meterCalls[0].request.runCapUsd, -1);
    assert.equal(meterCalls[0].request.dailyCapUsd, -1);
    await meter.settle(metered.id, { costUsd: 0.2 });
    assert.equal(meterCalls[1].actualUsd, 0.2);

    const noCap = await meter.reserve({
      kind: 'external', costUsd: 0.1, requireBudget: true,
      scope: 'finance:proof', idempotencyKey: 'proof:2'
    });
    assert.equal(noCap.ok, false);
    assert.match(noCap.reason, /budget is required/i);

    // The common boundary checks the global switch before it ever asks for budget.
    let disabled = true;
    let reserveCalls = 0;
    require.cache[killPath] = { id: killPath, filename: killPath, loaded: true,
      exports: { spendDisabled: async () => disabled } };
    require.cache[meterPath].exports = {
      reserve: async function (options) {
        reserveCalls++;
        return { ok: true, id: 'boundary-rsv', estUsd: options.costUsd || 0.1 };
      },
      settle: async function () { return { ok: true, chargedUsd: 0.1 }; }
    };
    clear(boundaryPath);
    const boundary = require(boundaryPath);
    const killed = await boundary.reserve({
      kind: 'external', costUsd: 0.1, scope: 'proof', scopeDailyCapUsd: 1, idempotencyKey: 'proof'
    });
    assert.equal(killed.disabled, true);
    assert.equal(reserveCalls, 0);
    disabled = false;
    const missingIdentity = await boundary.reserve({
      kind: 'external', costUsd: 0.1, scope: 'proof', scopeDailyCapUsd: 1
    });
    assert.equal(missingIdentity.ok, false);
    assert.equal(reserveCalls, 0);
    const allowed = await boundary.reserve({
      kind: 'external', costUsd: 0.1, scope: 'proof', scopeDailyCapUsd: 1, idempotencyKey: 'proof'
    });
    assert.equal(allowed.ok, true);
    assert.equal(reserveCalls, 1);

    // Finance dispatch order is reserve -> provider -> settle, and denial means no network.
    const financeEvents = [];
    const financeBoundary = {
      reserve: async options => {
        financeEvents.push(['reserve', options]);
        return { ok: true, id: 'finance-rsv', estUsd: 0.2 };
      },
      settle: async (_reservation, actual) => {
        financeEvents.push(['settle', actual]);
        return { ok: true, chargedUsd: 0.01 };
      }
    };
    clear(financePath);
    const Finance = require(financePath);
    const finance = Finance.route({
      env: { ANTHROPIC_API_KEY: 'fixture' },
      fetch: async function () {
        financeEvents.push(['network']);
        return { ok: true, status: 200, json: async () => ({
          model: Finance.ANTHROPIC_MODEL,
          stop_reason: 'end_turn', content: [{ text: '{}' }],
          usage: { input_tokens: 20, output_tokens: 10 }
        }) };
      },
      schema: { type: 'object' }, schemaName: 'proof', maxOutputTokens: 100,
      label: 'Finance proof', scope: 'finance:proof', paidBoundary: financeBoundary
    });
    const financeResult = await finance({ system: 'system', prompt: 'prompt', maxTokens: 100 });
    assert.equal(financeResult.ok, true);
    assert.deepEqual(financeEvents.map(event => event[0]), ['reserve', 'network', 'settle']);
    assert.equal(financeEvents[0][1].scopeDailyCapUsd, 2);
    assert.match(financeEvents[0][1].idempotencyKey, /^finance:proof:anthropic:/);
    assert.equal(financeEvents[2][1].inputTokens, 20);

    let deniedNetwork = 0;
    const deniedFinance = Finance.route({
      env: { ANTHROPIC_API_KEY: 'fixture' },
      fetch: async () => { deniedNetwork++; },
      schema: { type: 'object' }, schemaName: 'proof-denied', maxOutputTokens: 100,
      scope: 'finance:proof',
      paidBoundary: {
        reserve: async () => ({ ok: false, disabled: true, reason: 'killed' }),
        settle: async () => { throw new Error('settle must not run'); }
      }
    });
    const deniedFinanceResult = await deniedFinance({ system: 'system', prompt: 'prompt' });
    assert.equal(deniedFinanceResult.disabled, true);
    assert.equal(deniedNetwork, 0);

    // Orb voice shares the same boundary. A denied reservation cannot reach xAI.
    let orbAllowed = false;
    let orbNetwork = 0;
    let orbSettles = 0;
    require.cache[boundaryPath].exports = {
      reserve: async options => orbAllowed
        ? { ok: true, id: 'orb-rsv', estUsd: options.costUsd }
        : { ok: false, disabled: true, reason: 'killed' },
      settle: async () => { orbSettles++; return { ok: true, chargedUsd: 0.001 }; }
    };
    clear(orbPath);
    const orb = require(orbPath);
    const oldXaiKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'fixture';
    global.fetch = async function () {
      orbNetwork++;
      return { ok: true, arrayBuffer: async () => Buffer.alloc(3000) };
    };
    function response() {
      return {
        statusCode: 200, headers: {}, body: null,
        setHeader: function (name, value) { this.headers[name] = value; },
        status: function (code) { this.statusCode = code; return this; },
        json: function (body) { this.body = body; return this; },
        send: function (body) { this.body = body; return this; },
        end: function () { return this; }
      };
    }
    const orbRequest = { method: 'GET', query: { voice: 'atlas', text: 'This is a bounded voice proof.' } };
    const deniedOrbResponse = response();
    await orb(orbRequest, deniedOrbResponse);
    assert.equal(deniedOrbResponse.statusCode, 503);
    assert.equal(orbNetwork, 0);
    orbAllowed = true;
    const allowedOrbResponse = response();
    await orb(orbRequest, allowedOrbResponse);
    assert.equal(allowedOrbResponse.statusCode, 200);
    assert.equal(orbNetwork, 1);
    assert.equal(orbSettles, 1);
    assert.equal(allowedOrbResponse.headers['X-Orb-Cache'], 'miss');
    if (oldXaiKey === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = oldXaiKey;

    console.log('paid provider boundary: strict Lua, atomic delegation, Finance/Orb ordering, caps, idempotency, and global kill passed');
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    if (previousAgentBuild === undefined) delete process.env.AGENT_BUILD; else process.env.AGENT_BUILD = previousAgentBuild;
    if (previousRunCap === undefined) delete process.env.AGENT_BUDGET_USD; else process.env.AGENT_BUDGET_USD = previousRunCap;
    if (previousDayCap === undefined) delete process.env.LIMEN_DAILY_BUDGET_USD; else process.env.LIMEN_DAILY_BUDGET_USD = previousDayCap;
  }
}()).catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
