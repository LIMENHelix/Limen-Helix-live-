#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Handler = require('../handlers/finance-position-owner.js');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function response() {
  return {
    statusCode: 0, headers: {}, payload: null,
    setHeader(key, value) { this.headers[key] = value; },
    end(body) { this.payload = JSON.parse(body); }
  };
}
async function call(handler, request) {
  const res = response();
  await handler(Object.assign({ method: 'GET', headers: {} }, request || {}), res);
  return res;
}
function store(rows) {
  const values = new Map(), lists = new Map(Object.entries(rows || {}));
  return {
    values,
    assertDurable() { return true; },
    async get(key) { return values.has(key) ? clone(values.get(key)) : null; },
    async set(key, value) { values.set(key, clone(value)); return true; },
    async lrange(key, start, end) { return clone((lists.get(key) || []).slice(start, end + 1)); }
  };
}
const cronAuth = { enforce() { return true; } };
const env = {
  LIMEN_FINANCE_POSITION_OWNER_ENABLED: '1',
  LIMEN_FINANCE_TRADE_DECISION_ENABLED: '1',
  ANTHROPIC_API_KEY: 'fixture',
  BRAIN_SHADOW_TOKEN: 'fixture'
};

(async function () {
  let providerCalls = 0;
  let broker = {
    configured() { return true; },
    async accountSnapshot() { return { positions: [], orders: [] }; }
  };
  let handler = Handler.createHandler({
    cronAuth, store: store(), broker, env,
    owner: { enabled() { return true; } },
    providerModule: { enabled() { return true; } },
    input: { async productionInput() { throw new Error('no positions must not fetch evidence'); } }
  });
  let result = await call(handler);
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.status, 'NO_OPEN_POSITIONS');
  assert.equal(result.payload.providerCalls, 0);

  const opening = {
    commandId: 'opening-command-1', status: 'RECONCILED_TERMINAL', emittedAt: '2026-08-26T14:00:00.000Z',
    intent: {
      symbol: 'MS', side: 'buy',
      decisionContext: { cycleEvidence: { sourcePacketId: 'finance:packet:1' } }
    },
    receipt: { orderId: 'opening-order-1' },
    order: { status: 'filled', executedQuantity: 1 }
  };
  const s = store({ tradier_b14_active_commands: [{ commandId: opening.commandId }] });
  s.values.set('finance_trade_decision:finance:packet:1', { status: 'TRADE_INTENT_SELECTED' });
  broker = {
    configured() { return true; },
    async accountSnapshot() { return { positions: [{ symbol: 'MS', quantity: 1 }], orders: [] }; },
    async quote(symbol) { return { symbol, last: 215, bid: 214.9, ask: 215.1 }; },
    async history(symbol) { return { symbol, provider: 'tradier-sandbox', interval: 'daily', rows: [{ date: '2026-08-25', close: 210 }, { date: '2026-08-26', close: 215 }] }; }
  };
  let ownerInput = null;
  handler = Handler.createHandler({
    cronAuth, store: s, broker, env,
    b14: {
      ACTIVE_COMMAND_INDEX: 'tradier_b14_active_commands',
      async read(_store, commandId) { return commandId === opening.commandId ? opening : null; }
    },
    decision: { key(packetId) { return 'finance_trade_decision:' + packetId; } },
    owner: {
      enabled() { return true; },
      async execute(request) {
        providerCalls++;
        ownerInput = request.input;
        return {
          status: 'HELD', providerCalled: true, orderPlaced: false,
          receipt: { reviewId: 'review-1', proposal: { action: 'HOLD' } }
        };
      }
    },
    providerModule: { enabled() { return true; } },
    input: {
      async productionInput() { return { financeCycle: { domain: 'finance', ok: true } }; },
      companyByTicker() { return { cik: '895421', ticker: 'MS', slug: 'morgan_stanley' }; },
      async helixReport() { return { request_id: 'helix-1' }; },
      build(input) {
        assert.equal(input.quote.symbol, 'MS');
        assert.equal(input.marketHistory.symbol, 'MS');
        assert.equal(input.benchmarkHistory.symbol, 'SPY');
        assert.equal(input.helixReport.request_id, 'helix-1');
        assert.equal(input.openingCommand.commandId, opening.commandId);
        return {
          status: 'READY_FOR_POSITION_REVIEW', blockers: [], evidenceGaps: [],
          context: { evidenceFingerprint: 'b'.repeat(64) }
        };
      }
    }
  });
  result = await call(handler);
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.status, 'HELD');
  assert.equal(result.payload.action, 'HOLD');
  assert.equal(result.payload.openingCommandId, opening.commandId);
  assert.equal(result.payload.providerCalls, 1);
  assert.equal(result.payload.orderPlaced, false);
  assert.equal(result.payload.paperOnly, true);
  assert.equal(result.payload.liveMoney, false);
  assert.equal(ownerInput.status, 'READY_FOR_POSITION_REVIEW');
  assert.equal(providerCalls, 1);

  console.log('finance position owner handler: no-position inhibition and attributed evidence review passed');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
