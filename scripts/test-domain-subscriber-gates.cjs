'use strict';

var assert = require('node:assert/strict');
var SubscriberDigest = require('../handlers/subscriber-digest.js');
var RouteHandlers = require('../lib/sovereign-subscriber-route-handlers.js');
var Lanes = require('../lib/soft-domain-subscriber-lanes.js');

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader: function (key, value) { this.headers[key] = value; },
    end: function (body) { this.body = body || ''; return this; }
  };
}

function restoreEnv(name, value) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
}

(async function () {
  var cultureMotor = SubscriberDigest.motorFor('culture');
  var oldMax = process.env[cultureMotor.maxEnv];
  var oldCap = process.env[cultureMotor.capEnv];
  delete process.env[cultureMotor.maxEnv];
  delete process.env[cultureMotor.capEnv];
  assert.equal(SubscriberDigest.maxSends(cultureMotor), 0,
    'a newly commissioned domain must not send when its max is unset');
  assert.equal(SubscriberDigest.dailySendCap(cultureMotor), 0,
    'a newly commissioned domain must not inherit an open daily cap');
  process.env[cultureMotor.maxEnv] = '2';
  process.env[cultureMotor.capEnv] = '3';
  assert.equal(SubscriberDigest.maxSends(cultureMotor), 2);
  assert.equal(SubscriberDigest.dailySendCap(cultureMotor), 3);
  restoreEnv(cultureMotor.maxEnv, oldMax);
  restoreEnv(cultureMotor.capEnv, oldCap);

  var science = Lanes.get('science');
  var store = { get: async function () { return null; } };
  var gate = {
    reqKey: function () { return 'science-pass'; },
    hasDomain: function (_pass, domain) { return domain === 'science'; },
    deny: function (res) { res.statusCode = 403; return res.end('{}'); }
  };
  var handler = RouteHandlers.recovery(science, { store: store, adminGate: gate });
  var canonical = response();
  await handler({ method: 'POST', headers: {}, body: {} }, canonical);
  assert.notEqual(canonical.statusCode, 403,
    'canonical product-domain authority must reach its own recovery lane even when owner alias differs');

  var denied = response();
  var closedGate = Object.assign({}, gate, { hasDomain: function () { return false; } });
  await RouteHandlers.recovery(science, { store: store, adminGate: closedGate })
    ({ method: 'POST', headers: {}, body: {} }, denied);
  assert.equal(denied.statusCode, 403);

  console.log('domain subscriber gates: zero-default caps and canonical recovery authority PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
