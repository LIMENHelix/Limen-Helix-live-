#!/usr/bin/env node
'use strict';

/**
 * FIX-0103 route-level authorization order.
 *
 * Invokes the real catch-all dispatch with narrow stubbed civilization-valve
 * dependencies. Proves that relay-csv-import authentication happens before
 * authorizeActivity and runtimeValveHold for POST, while authorized requests
 * still cross both controls. No production request is made and no live
 * credential is used.
 */

const assert = require('node:assert');

const TEST_KEY = 'fix0103-route-test-only-key';
process.env.RELAY_ADMIN_KEY = TEST_KEY;

const entry = require('../api/[...route].js');
const handler = require('../handlers/relay-csv-import');

let passed = 0;
function pass(name) {
  passed++;
  console.log('  PASS ' + name);
}

function makeReq(opts) {
  opts = opts || {};
  const req = {
    method: opts.method || 'POST',
    url: opts.url || '/api/relay-csv-import',
    headers: opts.headers || {},
    body: opts.body === undefined ? {} : opts.body,
    resumed: false
  };
  req.resume = function () { req.resumed = true; };
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    raw: '',
    ended: false,
    body: null,
    setHeader: function (name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    end: function (body) {
      this.raw = body == null ? '' : String(body);
      this.ended = true;
      try { this.body = JSON.parse(this.raw); } catch (e) { this.body = null; }
    }
  };
  return res;
}

function makeValveStubs(opts) {
  opts = opts || {};
  const calls = {
    activity: 0, forRoute: 0, authorize: 0,
    lastActivity: null, lastForRoute: null, lastValveId: null
  };
  const valve = {
    GLOBAL_ID: 'global',
    authorizeActivity: function (name, method) {
      calls.activity++;
      calls.lastActivity = { name: name, method: method };
      return opts.activity || { allowed: true };
    },
    authorize: function (valveId) {
      calls.authorize++;
      calls.lastValveId = valveId;
      return Promise.resolve(opts.hold || { allowed: true });
    }
  };
  const registry = {
    forRoute: function (name) {
      calls.forRoute++;
      calls.lastForRoute = name;
      return opts.valveId === undefined ? null : opts.valveId;
    }
  };
  return { valve: valve, registry: registry, calls: calls };
}

async function callRoute(req, stubs) {
  const res = makeRes();
  await entry(req, res, {
    civilizationValve: stubs.valve,
    civilizationValveRegistry: stubs.registry
  });
  return res;
}

function assertNeutralDenial(res, status, label) {
  assert.strictEqual(res.statusCode, status, label + ' status');
  assert.ok(!/NUKED|HELD|nukeStage|nukeReceiptId|valveReceiptId|valveId/.test(res.raw),
    label + ' disclosed control state');
  assert.ok(!/RELAY_ADMIN_KEY/.test(res.raw), label + ' disclosed configuration');
}

(async function main() {
  console.log('FIX-0103 route authorization order');

  // Missing client credential, with a denial stub that would expose NUKE if reached.
  {
    const stubs = makeValveStubs({ activity: { allowed: false, reason: 'test' } });
    const res = await callRoute(makeReq({ headers: {} }), stubs);
    assertNeutralDenial(res, 401, 'missing key');
    assert.strictEqual(stubs.calls.activity, 0);
    assert.strictEqual(stubs.calls.forRoute, 0);
    assert.strictEqual(stubs.calls.authorize, 0);
    pass('missing key returns 401 before authorizeActivity and runtime valve');
  }

  // Wrong client credential.
  {
    const stubs = makeValveStubs({ activity: { allowed: false, reason: 'test' } });
    const res = await callRoute(makeReq({ headers: { 'x-relay-admin-key': 'wrong' } }), stubs);
    assertNeutralDenial(res, 403, 'wrong key');
    assert.strictEqual(stubs.calls.activity, 0);
    assert.strictEqual(stubs.calls.forRoute, 0);
    assert.strictEqual(stubs.calls.authorize, 0);
    pass('wrong key returns 403 before authorizeActivity and runtime valve');
  }

  // Unset server credential.
  {
    delete process.env.RELAY_ADMIN_KEY;
    const stubs = makeValveStubs({ activity: { allowed: false, reason: 'test' } });
    const res = await callRoute(makeReq({ headers: { 'x-relay-admin-key': TEST_KEY } }), stubs);
    assertNeutralDenial(res, 503, 'unset server key');
    assert.strictEqual(stubs.calls.activity, 0);
    assert.strictEqual(stubs.calls.forRoute, 0);
    assert.strictEqual(stubs.calls.authorize, 0);
    pass('unset server key returns a neutral 503 before all control logic');
  }
  process.env.RELAY_ADMIN_KEY = TEST_KEY;

  // Query-string credential is ignored at the router too.
  {
    const stubs = makeValveStubs({ activity: { allowed: false, reason: 'test' } });
    const res = await callRoute(makeReq({
      url: '/api/relay-csv-import?key=' + TEST_KEY,
      headers: {}
    }), stubs);
    assertNeutralDenial(res, 401, 'query credential');
    assert.strictEqual(stubs.calls.activity, 0);
    pass('query-string credential is ignored at the route boundary');
  }

  // Correct key reaches the civilization activity check, then the handler.
  {
    const stubs = makeValveStubs({ activity: { allowed: true }, valveId: null });
    const res = await callRoute(makeReq({ headers: { 'x-relay-admin-key': TEST_KEY } }), stubs);
    assert.strictEqual(stubs.calls.activity, 1, 'authorizeActivity must run once');
    assert.deepStrictEqual(stubs.calls.lastActivity, { name: 'relay-csv-import', method: 'POST' });
    assert.strictEqual(stubs.calls.forRoute, 1, 'runtime valve lookup must run once');
    assert.strictEqual(stubs.calls.lastForRoute, 'relay-csv-import');
    assert.strictEqual(res.statusCode, 400, 'empty body should reach the handler');
    assert.strictEqual(res.body && res.body.error, 'csv required (min 10 chars)');
    pass('correct key reaches authorizeActivity and the handler');
  }

  // Authorized request can still be NUKED.
  {
    const stubs = makeValveStubs({
      activity: {
        allowed: false,
        reason: 'test-nuke',
        nukeStage: 'test-stage',
        receipt: { receiptId: 'test-nuke-receipt' }
      }
    });
    const res = await callRoute(makeReq({ headers: { 'x-relay-admin-key': TEST_KEY } }), stubs);
    assert.strictEqual(res.statusCode, 423);
    assert.strictEqual(res.body.status, 'NUKED');
    assert.strictEqual(stubs.calls.activity, 1);
    assert.deepStrictEqual(stubs.calls.lastActivity, { name: 'relay-csv-import', method: 'POST' });
    assert.strictEqual(stubs.calls.forRoute, 0);
    pass('authorized request still crosses authorizeActivity and can be NUKED');
  }

  // Authorized request can still be HELD by the runtime valve.
  {
    const stubs = makeValveStubs({
      activity: { allowed: true },
      valveId: 'relay-csv-import',
      hold: {
        allowed: false,
        reason: 'test-hold',
        valveId: 'relay-csv-import',
        receipt: { receiptId: 'test-hold-receipt', valveId: 'relay-csv-import' }
      }
    });
    const res = await callRoute(makeReq({ headers: { 'x-relay-admin-key': TEST_KEY } }), stubs);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'HELD');
    assert.strictEqual(stubs.calls.activity, 1);
    assert.deepStrictEqual(stubs.calls.lastActivity, { name: 'relay-csv-import', method: 'POST' });
    assert.strictEqual(stubs.calls.forRoute, 1);
    assert.strictEqual(stubs.calls.lastForRoute, 'relay-csv-import');
    assert.strictEqual(stubs.calls.authorize, 1);
    assert.strictEqual(stubs.calls.lastValveId, 'relay-csv-import');
    pass('authorized request still crosses the runtime valve and can be HELD');
  }

  // Direct handler invocation remains protected.
  {
    const res = makeRes();
    const req = makeReq({ headers: {} });
    await handler(req, res, {});
    assertNeutralDenial(res, 401, 'direct handler');
    pass('direct handler invocation without a credential is still 401');
  }

  // OPTIONS does not cross the valves and grants no origin.
  {
    const stubs = makeValveStubs({ activity: { allowed: false, reason: 'test' } });
    const res = await callRoute(makeReq({ method: 'OPTIONS', headers: {} }), stubs);
    assert.strictEqual(res.statusCode, 204);
    assert.strictEqual(stubs.calls.activity, 0);
    assert.strictEqual(stubs.calls.forRoute, 0);
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    pass('OPTIONS returns 204 before the valves and grants no origin');
  }

  // Non-POST is rejected before the valves.
  {
    const stubs = makeValveStubs({ activity: { allowed: false, reason: 'test' } });
    const res = await callRoute(makeReq({ method: 'GET', headers: {} }), stubs);
    assert.strictEqual(res.statusCode, 405);
    assert.strictEqual(stubs.calls.activity, 0);
    assert.strictEqual(stubs.calls.forRoute, 0);
    assert.strictEqual(res.headers.allow, 'POST, OPTIONS');
    pass('non-POST is rejected before the valves');
  }

  delete process.env.RELAY_ADMIN_KEY;
  console.log('FIX-0103 ROUTE PASS: ' + passed + ' checks');
})().catch(function (err) {
  console.error('FIX-0103 ROUTE FAIL:', err && err.stack || err);
  process.exit(1);
});
