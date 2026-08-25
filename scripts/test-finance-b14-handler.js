'use strict';

var assert = require('node:assert/strict');
var Handler = require('../handlers/finance-b14');

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader: function (key, value) { this.headers[key] = value; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (value) { this.payload = value; return this; },
    end: function () { return this; }
  };
}

async function main() {
  var previewCalls = [];
  var bridge = {
    state: function () { return { previewAutonomyEnabled: false }; },
    auditDecision: async function (_, packetId) { return { status: 'HELD', packetId: packetId }; },
    previewDecision: async function (_, __, packetId) {
      previewCalls.push(packetId);
      return { ok: true, status: 'HELD', reason: 'sandbox-autonomy-switch-off', packetId: packetId, orderPlaced: false };
    }
  };
  var adminGate = {
    reqKey: function () { return 'finance-pass'; },
    hasDomain: function () { return true; },
    deny: function (res) { return res.status(403).json({ ok: false }); }
  };
  var handler = Handler.createHandler({ adminGate: adminGate, bridge: bridge, store: {}, broker: {}, env: {} });

  var forged = response();
  await handler({ method: 'POST', body: { action: 'preview', packetId: 'p1', selection: { status: 'RELEASED' }, tradeIntent: { symbol: 'SPY' } } }, forged);
  assert.equal(forged.statusCode, 400);
  assert.match(forged.payload.error, /client-supplied/);
  assert.equal(previewCalls.length, 0);

  var missing = response();
  await handler({ method: 'POST', body: { action: 'preview' } }, missing);
  assert.equal(missing.statusCode, 400);
  assert.match(missing.payload.error, /packetId/);

  var accepted = response();
  await handler({ method: 'POST', body: { action: 'preview', packetId: 'finance:packet:1' } }, accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.payload.status, 'HELD');
  assert.deepEqual(previewCalls, ['finance:packet:1']);

  var audit = response();
  await handler({ method: 'GET', query: { packetId: 'finance:packet:1' } }, audit);
  assert.equal(audit.statusCode, 200);
  assert.equal(audit.payload.audit.packetId, 'finance:packet:1');

  console.log('finance B14 handler: durable receipt boundary passed');
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
