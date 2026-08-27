'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const Control = require('../lib/civilization-valve-control.js');

const routeFile = require.resolve('../api/[...route].js');
const source = fs.readFileSync(routeFile, 'utf8');

function loadRouter(calls) {
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    const match = /^\.\.\/handlers\/(.+)$/.exec(String(request));
    if (match) return function handlerStub(req, res) { calls.handlers.push(match[1]); res.end(JSON.stringify({ handler: match[1] })); };
    return original.apply(this, arguments);
  };
  try {
    const mod = new Module(routeFile, null);
    mod.filename = routeFile;
    mod.paths = Module._nodeModulePaths(path.dirname(routeFile));
    mod._compile(source, routeFile);
    return mod.exports;
  } finally {
    Module._load = original;
  }
}

function response() {
  return { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = String(v || ''); } };
}

(async function () {
  const calls = { handlers: [], valves: [] };
  const originalAuthorize = Control.authorize;
  const originalAuthorizeActivity = Control.authorizeActivity;
  let nuked = false;
  Control.authorizeActivity = async function () {
    return nuked
      ? { ok: true, allowed: false, nukeStage: 'NUKED', reason: 'nuke-stage-activity-suppressed', receipt: { receiptId: 'nuke-test' } }
      : { ok: true, allowed: true, nukeStage: 'OPEN' };
  };
  Control.authorize = async function (id) {
    calls.valves.push(id);
    return { ok: true, allowed: false, valveId: id, reason: 'domain-runtime-valve-closed', receipt: { receiptId: 'test-receipt' } };
  };
  try {
    const router = loadRouter(calls);
    async function hit(url, method) {
      calls.handlers.length = 0; calls.valves.length = 0;
      const res = response();
      await router({ url, method, headers: {} }, res);
      return { res, handlers: calls.handlers.slice(), valves: calls.valves.slice() };
    }

    let out = await hit('/api/autopilot', 'POST');
    assert.deepEqual(out.valves, ['intelligence:autopilot'], 'POST email execution crosses its valve');
    assert.deepEqual(out.handlers, []);
    assert.equal(JSON.parse(out.res.body).status, 'HELD');

    out = await hit('/api/homestead-automail', 'POST');
    assert.deepEqual(out.valves, ['law:automail'], 'POST physical mail execution crosses its valve');
    assert.deepEqual(out.handlers, []);

    out = await hit('/api/agriculture-homestead-cycle', 'POST');
    assert.deepEqual(out.valves, [], 'exact queue-only POST remains available');
    assert.deepEqual(out.handlers, ['agriculture-homestead-cycle']);

    out = await hit('/api/agriculture-homestead-cycle', 'GET');
    assert.deepEqual(out.valves, ['agriculture:homestead'], 'the matching outward GET is inhibited');
    assert.deepEqual(out.handlers, []);

    out = await hit('/api/agriculture-homestead-inbound', 'GET');
    assert.deepEqual(out.valves, [], 'outcome observation stays open');
    assert.deepEqual(out.handlers, ['agriculture-homestead-inbound']);

    out = await hit('/api/agriculture-homestead-recovery', 'GET');
    assert.deepEqual(out.valves, [], 'recovery stays open');
    assert.deepEqual(out.handlers, ['agriculture-homestead-recovery']);

    out = await hit('/api/brain-shadow', 'GET');
    assert.deepEqual(out.valves, [], 'the brain runtime is outside the motor valve');
    assert.deepEqual(out.handlers, ['brain-shadow']);

    nuked = true;
    out = await hit('/api/brain-shadow', 'GET');
    assert.deepEqual(out.valves, [], 'NUKE suppresses before local motor-valve evaluation');
    assert.deepEqual(out.handlers, []);
    assert.equal(out.res.statusCode, 423);
    assert.equal(JSON.parse(out.res.body).nukeStage, 'NUKED');
  } finally {
    Control.authorize = originalAuthorize;
    Control.authorizeActivity = originalAuthorizeActivity;
  }
  console.log('civilization valve router: NUKE precedes local valves; normal local effect, preparation, observer, and recovery routing passed');
})().catch(function (error) { console.error(error); process.exit(1); });
