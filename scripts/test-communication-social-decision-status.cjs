#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Handler = require('../handlers/communication-social-decision-status.js');
var Decision = require('../lib/communication-social-decision.js');

function response() { return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, end: function (body) { this.json = JSON.parse(body); return this; } }; }

(async function () {
  var providerCalls = 0;
  var store = {
    assertDurable: function () {},
    lrange: async function (key) {
      assert.equal(key, Decision.LOG_KEY);
      return [{ schemaVersion: Decision.SCHEMA, decisionReceiptId: 'csd_1', status: 'NO_ACTION',
        subjectDomain: 'law', communicationPacketId: 'communication:p1', subjectPacketId: 'law:p1',
        reason: 'communication-b10-held', blockers: ['communication-b10-no-action-selected'],
        decidedAt: 1000, expiresAt: 2000, providerCalled: false,
        contentHash: 'secret-content-hash', sourceIdentity: { responseHash: 'secret-source-hash' } }];
    }
  };
  var handler = Handler.createHandler({ store: store, provider: { call: function () { providerCalls++; } } });
  var res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.count, 1);
  assert.equal(res.json.decisions[0].status, 'NO_ACTION');
  assert.equal(res.json.decisions[0].providerCalled, false);
  assert.equal(JSON.stringify(res.json).includes('secret-content-hash'), false);
  assert.equal(JSON.stringify(res.json).includes('secret-source-hash'), false);
  assert.equal(providerCalls, 0);
  console.log('communication social decision status: sanitized strict read, no provider, no write, and no live money passed');
})().catch(function (error) { console.error(error); process.exit(1); });
