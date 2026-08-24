'use strict';

var assert = require('assert');
var packet = require('../lib/civilization-server-packet.js');
var consumerMod = require('../lib/civilization-handoff-consumer.js');
var storeMod = require('../lib/civilization-handoff-store.js');

var passed = 0;
function ok(value, label) { assert.ok(value, label); passed++; }
function eq(a, b, label) { assert.deepStrictEqual(a, b, label); passed++; }
function base(opportunities) {
  return packet.buildPacket({
    schemaVersion: packet.PACKET_SCHEMA,
    sourceType: 'server-cognition-refresh', domainId: 'science', domainLabel: 'Science', cycleId: '4', generatedAt: '2026-08-24T00:00:00.000Z',
    sourceIdentity: { snapshotId: 'snap-1', retrievedAt: '2026-08-24T00:00:00.000Z', refreshId: 'refresh-1', producer: 'test' },
    truth: { stressScore: 0.2, confidence: 0.8, activityLevel: null, phase: null, phaseLabel: null, activeDiagnoses: [{ id: 'dx' }], treatments: [{ id: 't' }], opportunities: opportunities || [], directives: [], feedHealth: null }
  });
}
function fakeStore(failOn) {
  var seen = Object.create(null), calls = [];
  return {
    packetIndexKey: 'packets', handoffIndexKey: 'handoffs',
    packetKey: function (id) { return 'p:' + id; }, handoffKey: function (id) { return 'h:' + id; },
    setNx: async function (key, value) { calls.push(['setNx', key]); if (failOn === key) { var e = new Error('injected persistence failure'); e.code = 'INJECTED'; throw e; } if (seen[key]) return false; seen[key] = value; return true; },
    add: async function (key, value) { calls.push(['add', key, value]); return 1; },
    get: async function () { return null; }, members: async function () { return []; }, calls: calls
  };
}

(async function () {
  eq(consumerMod.explicitLanes({ lane: 'investments' }), ['investments'], 'canonical lane is accepted');
  eq(consumerMod.explicitLanes({ path: 'INVESTABLE' }), [], 'path is not silently translated');
  eq(consumerMod.explicitLanes({ lane: 'investments', lanes: ['research-papers'] }), ['investments', 'research-papers'], 'two canonical lanes remain ambiguous');

  var s = fakeStore(), c = consumerMod.createConsumer({ store: s });
  var first = await c.consumePacket(base([{ id: 'i1', title: 'Invest', lane: 'investments' }, { id: 'u1', title: 'Unassigned' }, { id: 'a1', title: 'Ambiguous', lanes: ['investments', 'research-papers'] }]));
  ok(first.ok, 'abstentions do not make a packet fail');
  eq(first.packetCreated, true, 'packet is persisted');
  eq(first.handoffsCreated, 1, 'one explicit handoff is persisted');
  eq(first.abstentions.map(function (x) { return x.code; }), ['lane-unassigned', 'lane-ambiguous'], 'abstention reasons are explicit');
  eq(s.calls.filter(function (x) { return x[0] === 'setNx'; }).length, 2, 'packet and handoff each use SET NX');

  var dup = await c.consumePacket(base([{ id: 'i1', title: 'Invest', lane: 'investments' }]));
  ok(dup.ok, 'duplicate packet remains successful');
  eq(dup.packetCreated, false, 'duplicate packet is not rewritten');
  eq(dup.handoffsCreated, 0, 'duplicate handoff is not counted as new');

  var bad = await c.consumePacket({ schemaVersion: 'wrong' });
  eq(bad.ok, false, 'invalid packet is refused');
  eq(bad.packetId, null, 'invalid packet has no identity');
  eq(s.calls.filter(function (x) { return x[0] === 'setNx'; }).length, 4, 'invalid packet does not persist');

  var failing = fakeStore('p:science:4:snap-1');
  var failed = await consumerMod.createConsumer({ store: failing }).consumePacket(base([{ id: 'i2', lane: 'investments' }]));
  eq(failed.ok, false, 'packet persistence failure is surfaced');
  eq(failed.error.code, 'INJECTED', 'persistence error code is preserved');

  var storeCalls = [];
  var oldUrl = process.env.TEST_CIV_URL, oldToken = process.env.TEST_CIV_TOKEN;
  process.env.TEST_CIV_URL = 'https://redis.test'; process.env.TEST_CIV_TOKEN = 'token';
  var strict = storeMod.createStore({ urlName: 'TEST_CIV_URL', tokenName: 'TEST_CIV_TOKEN', fetch: async function (_url, req) {
    storeCalls.push(JSON.parse(req.body));
    var cmd = JSON.parse(req.body);
    if (cmd[0] === 'SET') return { ok: true, status: 200, json: async function () { return { result: 'OK' }; } };
    if (cmd[0] === 'SADD') return { ok: true, status: 200, json: async function () { return { result: 1 }; } };
    if (cmd[0] === 'SMEMBERS') return { ok: true, status: 200, json: async function () { return { result: [] }; } };
    return { ok: true, status: 200, json: async function () { return { result: null }; } };
  } });
  ok(strict.configured(), 'strict store sees configured Redis');
  eq(await strict.setNx(strict.packetKey('p1'), { x: 1 }), true, 'SET NX accepts OK');
  eq(await strict.add(strict.packetIndexKey, 'p1'), 1, 'SADD count is checked');
  ok(storeCalls[0][0] === 'SET' && storeCalls[0].indexOf('NX') >= 0 && storeCalls[0].indexOf('EX') >= 0, 'durable write includes NX and retention');
  delete process.env.TEST_CIV_URL; delete process.env.TEST_CIV_TOKEN;
  if (oldUrl !== undefined) process.env.TEST_CIV_URL = oldUrl;
  if (oldToken !== undefined) process.env.TEST_CIV_TOKEN = oldToken;

  console.log(passed + '/20 passed');
})().catch(function (e) { console.error(e.stack || e); process.exitCode = 1; });
