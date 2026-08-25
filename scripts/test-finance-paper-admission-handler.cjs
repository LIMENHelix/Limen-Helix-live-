#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const createHandler = require('../handlers/finance-paper-admission.js').createHandler;

function response() {
  return { headers: {}, statusCode: null, payload: null,
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
  const packet = { packetId: 'finance:3:handler-paper' };
  let audits = 0, executions = 0;
  const preview = { async productionInput() { return { packet, input: {} }; } };
  const admission = {
    async audit() { audits++; return { status: 'READY_FOR_PAPER_ADMISSION', packetId: packet.packetId }; },
    async execute(_store, body) { executions++; return { ok: true, receipt: { packetId: body.packetId, status: 'ADMITTED_TO_PAPER' } }; }
  };
  const store = {};
  const env = { BRAIN_SHADOW_TOKEN: 'correct', LIMEN_FINANCE_PAPER_ADMISSION_ENABLED: '1' };
  const handler = createHandler({ preview, admission, store, env });

  let res = response(); await handler(request('GET'), res);
  assert.equal(res.statusCode, 401); assert.equal(audits, 0);
  res = response(); await handler(request('GET', 'correct'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.payload.gate.paperOnly, true); assert.equal(res.payload.gate.broker, false); assert.equal(audits, 1);
  res = response(); await handler(request('POST', 'correct', { approve: true, packetId: packet.packetId }), res);
  assert.equal(res.statusCode, 200); assert.equal(executions, 1); assert.equal(res.payload.receipt.status, 'ADMITTED_TO_PAPER');
  res = response(); await handler(request('POST', 'correct', { approve: true, packetId: 'wrong' }), res);
  assert.equal(res.statusCode, 409); assert.equal(executions, 1);

  const off = createHandler({ preview, admission, store, env: { BRAIN_SHADOW_TOKEN: 'correct' } });
  res = response(); await off(request('POST', 'correct', { approve: true, packetId: packet.packetId }), res);
  assert.equal(res.statusCode, 503); assert.match(res.payload.error, /no admission receipt/);
  assert.equal(executions, 1);

  console.log('finance paper admission handler: 13/13 passed');
}()).catch(e => { console.error(e && e.stack || e); process.exitCode = 1; });
