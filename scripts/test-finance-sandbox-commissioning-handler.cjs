'use strict';

var assert = require('node:assert/strict');
var Handler = require('../handlers/finance-sandbox-commissioning.js');

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader: function (key, value) { this.headers[key] = value; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (body) { this.body = body; return this; }
  };
}
async function invoke(handler, method, headers, body) {
  var res = response();
  await handler({ method: method, headers: headers || {}, body: body }, res);
  return res;
}

(async function () {
  var reads = 0, writes = 0, executions = 0, brokerCalls = 0;
  var current = null;
  var store = {
    assertDurable: function () { return true; },
    get: async function () { reads++; return current; },
    set: async function () { writes++; },
    setIfAbsent: async function () { writes++; return true; }
  };
  var broker = {
    configured: function () { brokerCalls++; return true; },
    accountSnapshot: async function () { brokerCalls++; return {}; }
  };
  var commissioning = {
    KEY: 'finance_sandbox_commissioning',
    execute: async function () { executions++; return { ok: true, status: 'VERIFIED_ZERO_EFFECT_ROLLBACK', paperOnly: true, liveMoney: false }; }
  };
  var handler = Handler.createHandler({
    store: store, broker: broker, commissioning: commissioning,
    env: { BRAIN_SHADOW_TOKEN: 'correct' }
  });

  var absent = await invoke(handler, 'GET');
  assert.equal(absent.statusCode, 200);
  assert.deepEqual(absent.body, {
    ok: true,
    schemaVersion: 'finance-sandbox-commissioning-status/1.0',
    status: 'NOT_COMMISSIONED',
    verified: false,
    effectExecuted: null,
    paperOnly: true,
    liveMoney: false,
    measuredAt: absent.body.measuredAt
  });
  assert(Number.isFinite(Date.parse(absent.body.measuredAt)));
  assert.equal(reads, 1);
  assert.equal(writes, 0);
  assert.equal(executions, 0);
  assert.equal(brokerCalls, 0);

  current = {
    schemaVersion: 'finance-sandbox-commissioning/1.0',
    status: 'VERIFIED_ZERO_EFFECT_ROLLBACK',
    symbol: 'SPY', commandId: 'secret-command', orderId: 'secret-order',
    claimedAt: '2026-08-25T10:00:00.000Z',
    updatedAt: '2026-08-25T10:00:05.000Z',
    verifiedAt: '2026-08-25T10:00:05.000Z',
    executedQuantity: 0, effectExecuted: false, paperOnly: true, liveMoney: false
  };
  var verified = await invoke(handler, 'GET');
  assert.equal(verified.statusCode, 200);
  assert.equal(verified.body.status, 'VERIFIED_ZERO_EFFECT_ROLLBACK');
  assert.equal(verified.body.verified, true);
  assert.equal(verified.body.effectExecuted, false);
  assert.equal(verified.body.verifiedAt, current.verifiedAt);
  ['record', 'symbol', 'commandId', 'orderId', 'accountId', 'token'].forEach(function (name) {
    assert.equal(Object.prototype.hasOwnProperty.call(verified.body, name), false);
  });
  assert.equal(writes, 0);
  assert.equal(executions, 0);
  assert.equal(brokerCalls, 0);

  current = { schemaVersion: 'finance-sandbox-commissioning/1.0', status: '<script>unknown</script>', paperOnly: true, liveMoney: false };
  var malformed = await invoke(handler, 'GET');
  assert.equal(malformed.statusCode, 503);
  assert.equal(malformed.body.error, 'finance-sandbox-commissioning-status-unavailable');
  current = null;

  var unauthorized = await invoke(handler, 'POST', {}, { action: 'verify-zero-effect-rollback' });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(executions, 0);
  var executed = await invoke(handler, 'POST', { 'x-brain-token': 'correct' }, { action: 'verify-zero-effect-rollback' });
  assert.equal(executed.statusCode, 200);
  assert.equal(executions, 1);

  var failing = Handler.createHandler({
    store: { assertDurable: function () { throw new Error('redis unavailable'); } },
    broker: broker, commissioning: commissioning, env: { BRAIN_SHADOW_TOKEN: 'correct' }
  });
  var unavailable = await invoke(failing, 'GET');
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.error, 'finance-sandbox-commissioning-status-unavailable');
  assert.equal(brokerCalls, 0);

  console.log('finance sandbox commissioning handler: public sanitized GET is read-only and POST remains authenticated');
})().catch(function (error) { console.error(error); process.exit(1); });
