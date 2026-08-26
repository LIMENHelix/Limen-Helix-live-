'use strict';

const assert = require('node:assert/strict');
const Handler = require('../handlers/civilization-valves.js');

function response() {
  return { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(v) { this.body = JSON.parse(v); } };
}
function request(method, body, key) {
  return { method, body, headers: { 'x-limen-pass': key || '' }, url: '/api/civilization-valves' };
}

(async function () {
  let writes = 0;
  const topology = { schemaVersion: 'civilization-valve-snapshot/1.0', lines: new Array(20).fill({}) };
  const control = {
    async snapshot() { return topology; },
    async set(id, mode) { writes++; return { receiptId: 'valve-1', valveId: id, runtimeMode: mode, observersRemainOpen: true, recoveryRemainsOpen: true }; }
  };
  const gate = {
    reqKey(req) { return req.headers['x-limen-pass']; },
    isMaster(pass) { return pass === 'master'; },
    deny(res) { res.statusCode = 403; res.end(JSON.stringify({ ok: false, error: 'denied' })); }
  };
  const handler = Handler.createHandler({ gate, control, store: {}, env: {} });

  let res = response();
  await handler(request('GET', null, 'wrong'), res);
  assert.equal(res.statusCode, 403);
  assert.equal(writes, 0);

  res = response();
  await handler(request('GET', null, 'master'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.topology.lines.length, 20);
  assert.equal(res.body.readOnly, true);

  res = response();
  await handler(request('POST', { valveId: 'science:research-papers', mode: 'CLOSED' }, 'master'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.receipt.runtimeMode, 'CLOSED');
  assert.equal(res.body.receipt.observersRemainOpen, true);
  assert.equal(writes, 1);
  assert.equal(JSON.stringify(res.body).includes('master'), false, 'master secret is never returned');
  console.log('civilization valve handler: master-only read/write, no secret reflection, and safe receipt response passed');
})().catch(function (error) { console.error(error); process.exit(1); });

