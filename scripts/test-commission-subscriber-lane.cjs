'use strict';

/**
 * Dry-run test for scripts/commission-subscriber-lane.cjs: the full existing
 * commissioning chain (B10 decision → one-shot developmental authorization →
 * executor → independent observation → capability verify/persist → 19-lane
 * projection) runs against an in-memory store with a stubbed provider. Asserts:
 * exactly one simulated send, no real transport, suppression + capability
 * receipts written by the existing mechanisms, and that every refusal path
 * fires before any send is attempted.
 */
var assert = require('node:assert/strict');
var Script = require('./commission-subscriber-lane.cjs');
var Capability = require('../lib/product-domain-motor-capability.js');
var Executor = require('../lib/intelligence-autopilot-executor.js');

var ADDRESS = 'ops-commissioning@limenhelix.com';
var ENV = {
  INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED: '1',
  INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL: ADDRESS,
  INTELLIGENCE_AUTOPILOT_EMAIL_USD: '0.001',
  INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD: '0.01',
  INTELLIGENCE_AUTOPILOT_DAILY_EMAIL_CAP: '1'
};

function stubTransport(calls) {
  return { send: async function (email, subject, body) {
    calls.push({ email: email, subject: subject, body: body });
    return { ok: true, id: 'stub-provider-acceptance-1', providerCalled: true };
  } };
}

async function expectRefusal(options, code) {
  var threw = null;
  try { await Script.runCommissioning(options); } catch (error) { threw = error; }
  assert.ok(threw, 'expected refusal ' + code);
  assert.equal(threw.code, code);
  assert.equal(threw.report.providerCalled, false);
}

(async function () {
  // Refusals fire before anything is attempted.
  await expectRefusal({ env: ENV }, 'COMMISSIONING_ADDRESS_REQUIRED');
  await expectRefusal({ address: 'not-an-email', env: ENV }, 'COMMISSIONING_ADDRESS_INVALID');
  await expectRefusal({ address: 'other@limenhelix.com', env: ENV }, 'COMMISSIONING_ADDRESS_MISMATCH');
  await expectRefusal({ address: ADDRESS, env: Object.assign({}, ENV, { INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED: '0' }) },
    'COMMISSIONING_ENV_INCOMPLETE');
  await expectRefusal({ address: ADDRESS, env: Object.assign({}, ENV, { INTELLIGENCE_AUTOPILOT_EMAIL_USD: '0.02' }) },
    'COMMISSIONING_SPEND_ABOVE_CAPABILITY_BOUND');
  await expectRefusal({ address: ADDRESS, env: Object.assign({}, ENV, { INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD: '0.0005' }) },
    'COMMISSIONING_BUDGET_BELOW_UNIT_COST');
  // --live without --consent refuses before any provider call.
  await expectRefusal({ address: ADDRESS, live: true, env: ENV }, 'COMMISSIONING_CONTEST_ATTESTATION_REQUIRED');

  // Full dry-run: everything except the real send.
  var store = new Script.MemoryStore();
  var calls = [];
  var fetches = [];
  var report = await Script.runCommissioning({
    address: ADDRESS, env: ENV, now: Date.now(), pollAttempts: 1
  }, {
    store: store,
    transport: stubTransport(calls),
    fetch: async function (url) {
      fetches.push(url);
      return { ok: true, status: 200, json: async function () {
        return { id: 'stub-provider-acceptance-1', last_event: 'delivered', created_at: new Date().toISOString() };
      } };
    }
  });

  assert.equal(report.ok, true);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.status, 'VERIFIED');
  assert.equal(report.providerSendAttempted, true);
  assert.equal(report.realProviderCalls, 0);
  assert.equal(report.simulatedProviderAcceptance, true);
  assert.equal(report.suppressionConfirmed, true);
  assert.equal(report.intelligenceCapability.status, 'VERIFIED');
  assert.equal(report.intelligenceCapability.persisted, true);
  assert.equal(report.projection.status, 'VERIFIED');
  assert.equal(report.projection.verified, 19);
  assert.equal(report.projection.total, 19);
  assert.deepEqual(report.projection.held, []);

  // Exactly one send, to the operator address, with the commissioning copy.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].email, ADDRESS);
  assert.equal(calls[0].subject, Script.COMMISSIONING_MAIL.subject);
  // The read API was exercised exactly once with the stubbed provider id.
  assert.equal(fetches.length, 1);
  assert.ok(fetches[0].indexOf('stub-provider-acceptance-1') >= 0);
  // The observation is independent of the send response and never re-sends.
  assert.equal(report.observation.independentOfSendResponse, true);
  assert.equal(report.observation.sendEndpointCalled, false);
  assert.equal(report.observation.lastEvent, 'delivered');

  // The durable evidence now lives in the (in-memory) store under the existing
  // keys: commissioning command, suppression catalog, capability receipts.
  assert.ok((await store.lrange(Executor.LOG_KEY, 0, 9)).length === 1);
  var suppression = await store.get(Executor.SUPPRESSION_KEY);
  var hashes = Object.keys(suppression || {});
  assert.equal(hashes.length, 1);
  assert.equal(suppression[hashes[0]].reason, 'owned-destination-commissioning-complete');
  var intelExecutor = await store.get(Capability.capabilityKey('intelligence', Capability.EXECUTOR));
  assert.equal(intelExecutor.status, 'VERIFIED');
  assert.equal(intelExecutor.commissioningOnly, true);

  // Replay: the one-shot slot is permanent — a second run sends nothing.
  var replayCalls = [];
  var replay = await Script.runCommissioning({
    address: ADDRESS, env: ENV, now: Date.now() + 1, pollAttempts: 1
  }, {
    store: store,
    transport: stubTransport(replayCalls),
    fetch: async function () {
      return { ok: true, status: 200, json: async function () {
        return { id: 'stub-provider-acceptance-1', last_event: 'delivered', created_at: new Date().toISOString() };
      } };
    }
  });
  assert.equal(replayCalls.length, 0);
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, 'intelligence-autopilot-recipient-suppressed');

  console.log('commission subscriber lane dry-run: full chain with stubbed provider, one simulated send, durable receipts, replay held: PASS');
})().catch(function (error) { console.error(error); process.exit(1); });
