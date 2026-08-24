'use strict';

var assert = require('assert');
var passed = 0;
function eq(a, b, label) { assert.strictEqual(a, b, label); passed++; }

process.env.BRAIN_SHADOW_TOKEN = 'operator-test-token';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
global.fetch = async function (_url, req) {
  var command = JSON.parse(req.body);
  if (command[0] === 'SMEMBERS') return { ok: true, status: 200, json: async function () { return { result: [] }; } };
  return { ok: true, status: 200, json: async function () { return { result: null }; } };
};

// The handler's store uses the production variable names. The empty-index
// response proves the request reaches the strict read path without exposing a
// write or a memory fallback.
var handler = require('../handlers/limen-civilization-handoff.js');
function response() {
  var out = { status: null, headers: {}, body: null, setHeader: function (k, v) { this.headers[k] = v; }, end: function (v) { this.body = v; } };
  Object.defineProperty(out, 'statusCode', { get: function () { return this.status; }, set: function (v) { this.status = v; } });
  return out;
}

(async function () {
  var r = response();
  delete process.env.BRAIN_SHADOW_TOKEN;
  await handler({ method: 'GET', headers: {}, url: '/api/limen-civilization-handoff' }, r);
  eq(r.status, 503, 'missing operator token fails closed');
  process.env.BRAIN_SHADOW_TOKEN = 'operator-test-token';

  r = response();
  await handler({ method: 'GET', headers: { 'x-brain-token': 'wrong' }, url: '/api/limen-civilization-handoff' }, r);
  eq(r.status, 401, 'wrong operator token is rejected');

  r = response();
  await handler({ method: 'POST', headers: { authorization: 'Bearer operator-test-token' }, url: '/api/limen-civilization-handoff' }, r);
  eq(r.status, 405, 'POST is not an ingress path');

  r = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer operator-test-token' }, url: '/api/limen-civilization-handoff?limit=2' }, r);
  eq(r.status, 200, 'authenticated GET reaches read path');
  var body = JSON.parse(r.body);
  eq(body.ok, true, 'read response is explicit');
  eq(body.count.packets, 0, 'empty packet index is reported');
  eq(body.count.handoffs, 0, 'empty handoff index is reported');
  console.log(passed + '/7 passed');
})().catch(function (e) { console.error(e.stack || e); process.exitCode = 1; });
