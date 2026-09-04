#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Handler = require('../handlers/finance-trade-decision.js');

function response() {
  return {
    statusCode: 0, headers: {}, payload: null,
    setHeader(k, v) { this.headers[k] = v; },
    end(body) { this.payload = JSON.parse(body); }
  };
}
async function call(handler, req) {
  const res = response();
  await handler(Object.assign({ method: 'GET', headers: {}, query: {} }, req), res);
  return res;
}

const audit = {
  schemaVersion: 'finance-trade-decision/1.0',
  packetId: 'finance:3:test',
  status: 'READY_FOR_TRADE_DECISION',
  blockers: []
};
let executions = 0;
const decision = {
  async audit() { return audit; },
  async execute(store, broker, request) {
    executions++;
    return { ok: true, receipt: { packetId: request.packetId, status: 'ABSTAINED', providerCalled: true } };
  }
};
const store = { assertDurable() { return true; } };
const broker = { configured() { return true; } };
const providerOn = { enabled() { return true; }, configured() { return true; } };

(async () => {
  const handler = Handler.createHandler({ decision, store, broker, providerModule: providerOn, env: { BRAIN_SHADOW_TOKEN: 'secret', ANTHROPIC_API_KEY: 'provider' } });
  let r = await call(handler, { headers: {} });
  assert.equal(r.statusCode, 401);

  r = await call(handler, { headers: { authorization: 'Bearer secret' }, query: { packetId: 'finance:3:test' } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.audit.status, 'READY_FOR_TRADE_DECISION');
  assert.equal(r.payload.gate.order, false);
  assert.equal(r.payload.gate.liveMoney, false);

  const off = Handler.createHandler({ decision, store, broker, providerModule: { enabled() { return false; }, configured() { return true; } }, env: { BRAIN_SHADOW_TOKEN: 'secret', ANTHROPIC_API_KEY: 'provider' } });
  r = await call(off, { method: 'POST', headers: { 'x-brain-token': 'secret' }, body: { approve: true, packetId: 'finance:3:test' } });
  assert.equal(r.statusCode, 503);
  assert.equal(executions, 0);

  r = await call(handler, { method: 'POST', headers: { 'x-brain-token': 'secret' }, body: { approve: true, packetId: 'finance:3:test' } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.receipt.status, 'ABSTAINED');
  assert.equal(executions, 1);

  console.log('finance trade decision handler: passed');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
