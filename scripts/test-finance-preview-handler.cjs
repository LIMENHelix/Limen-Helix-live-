#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const createHandler = require('../handlers/finance-preview.js').createHandler;

function response() {
  return {
    headers: {}, statusCode: null, payload: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(v) { this.payload = JSON.parse(v); }
  };
}
function request(method, token, body) {
  const req = new EventEmitter();
  req.method = method; req.headers = token ? { 'x-brain-token': token } : {}; req.body = body;
  return req;
}

(async function () {
  let produced = 0, executed = 0;
  const packet = { packetId: 'finance:3:handler-test' };
  const execution = {
    async productionInput() { produced++; return { packet, input: {} }; },
    audit() { return { status: 'READY_FOR_MANAGER_REVIEW', packetId: packet.packetId, acceptedCandidates: 1 }; },
    receiptKey(id) { return 'finance_preview:' + id; },
    async execute(store, bundle, body) { executed++; return { ok: true, idempotent: false, receipt: { packetId: body.packetId, status: 'PAPER_CANDIDATE' } }; }
  };
  const store = { assertDurable() { return true; }, async get() { return null; } };
  const env = { BRAIN_SHADOW_TOKEN: 'correct', LIMEN_FINANCE_PREVIEW_ENABLED: '1', ANTHROPIC_API_KEY: 'configured' };
  const handler = createHandler({ execution, store, env, providerModule: { enabled: () => true, configured: () => true } });

  let res = response(); await handler(request('GET'), res);
  assert.equal(res.statusCode, 401); assert.equal(produced, 0);
  res = response(); await handler(request('GET', 'wrong'), res);
  assert.equal(res.statusCode, 401); assert.equal(produced, 0);
  res = response(); await handler(request('GET', 'correct'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.payload.gate.authenticated, true); assert.equal(res.payload.gate.broker, false); assert.equal(produced, 1);
  res = response(); await handler(request('POST', 'correct', { approve: true, packetId: packet.packetId }), res);
  assert.equal(res.statusCode, 200); assert.equal(executed, 1); assert.equal(res.payload.receipt.status, 'PAPER_CANDIDATE');

  const off = createHandler({ execution, store, env: { BRAIN_SHADOW_TOKEN: 'correct', ANTHROPIC_API_KEY: 'configured' }, providerModule: { enabled: () => false, configured: () => true } });
  res = response(); await off(request('POST', 'correct', { approve: true, packetId: packet.packetId }), res);
  assert.equal(res.statusCode, 503); assert.equal(executed, 1); assert.match(res.payload.error, /no receipt/);

  const noToken = createHandler({ execution, store, env: {}, providerModule: { enabled: () => true, configured: () => false } });
  res = response(); await noToken(request('GET', 'correct'), res);
  assert.equal(res.statusCode, 503); assert.equal(produced, 3);

  console.log('finance preview handler: 15/15 passed');
}()).catch(e => { console.error(e); process.exitCode = 1; });
