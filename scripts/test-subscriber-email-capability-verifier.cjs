'use strict';

var assert = require('node:assert/strict');
var Verifier = require('../lib/subscriber-email-capability-verifier.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Capability = require('../lib/product-domain-motor-capability.js');
var Lanes = require('../lib/sovereign-domain-subscriber-lanes.js');
var Handler = require('../handlers/subscriber-email-capability.js');

function Store() { this.values = new Map(); this.writes = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? structuredClone(this.values.get(key)) : null; };
Store.prototype.set = async function (key, value) { this.writes.push(key); this.values.set(key, structuredClone(value)); return true; };

function source(now) {
  var command = {
    commandId: 'intelligence-owned-commissioning-command', providerEmailId: 'resend-proof-1',
    commissioningOnly: true, ownedDestinationVerified: true, recipientConsentVerified: true,
    businessStateTransitionSuppressed: true, futureSuppressionRecoveryVerified: true,
    providerCalls: 1, liveMoney: false, emailCostUsd: 0.001,
    authorizationReceiptId: 'intelligence-owned-slot', suppressionReceiptId: 'intelligence-suppression'
  };
  var observation = { observationId: 'intelligence-independent-read', providerEmailId: command.providerEmailId,
    independentOfSendResponse: true, sendEndpointCalled: false };
  return { mayPersistCapabilities: true,
    executor: { verified: true, evidenceReceiptId: 'resend-owned-commissioning:' + command.commandId,
      providerCalls: 1, businessStateTransitionSuppressed: true },
    independentOutcomeObserver: { verified: true, evidenceReceiptId: 'resend-independent-read:' + observation.observationId },
    _command: command, _observation: observation, measuredAt: new Date(now).toISOString() };
}

function religionMotor(now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'religion-motor', productDomain: 'religion', ownerDomain: 'religion',
    contractId: 'religion-motor/1', lane: 'subscriber-email', status: 'EXECUTOR_PENDING', persistedAt: now,
    contracts: { decision: 'religion-decision/1', budget: 'religion-budget/1', receipt: 'religion-subscriber-command/1.0',
      independentOutcome: 'religion-subscriber-observation/1.0', rollback: 'religion-subscriber-recovery/1.0' },
    verification: { executorVerified: true, independentOutcomeObserverVerified: true },
    gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: true }, blockers: [],
    safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 } };
}

(async function () {
  var now = Date.now(), store = new Store();
  await store.set(Motor.receiptKey('religion'), religionMotor(now));
  store.writes = [];
  var dry = await Verifier.run(store, now, { sourceReport: source(now), persist: false });
  assert.equal(dry.status, 'VERIFIED');
  assert.equal(dry.total, 19);
  assert.equal(dry.verified, 19);
  assert.equal(dry.persisted, false);
  assert.equal(dry.providerCalls, 0);
  assert.equal(store.writes.length, 0);

  var live = await Verifier.run(store, now + 1, { sourceReport: source(now), persist: true });
  assert.equal(live.status, 'VERIFIED');
  assert.equal(live.persisted, true);
  assert.equal(live.providerCalls, 0);
  assert.equal(live.domains.length, 19);
  for (var i = 0; i < Lanes.DOMAINS.length; i++) {
    var lane = Lanes.get(Lanes.DOMAINS[i]);
    assert.equal((await lane.authorization.verifyCapabilityPair(store, now + 2)).ok, true, lane.config.productDomain);
  }
  assert.equal((await Capability.verifyPair(store, religionMotor(now), now + 2)).ok, true);

  var empty = new Store();
  var held = await Verifier.run(empty, now, { sourceReport: { mayPersistCapabilities: false }, persist: true });
  assert.equal(held.status, 'HELD');
  assert.equal(held.persisted, false);
  assert.equal(empty.writes.length, 0);

  var calls = [];
  var route = Handler.createHandler({ store: store, env: { CRON_SECRET: 'cron', BRAIN_SHADOW_TOKEN: 'brain' },
    verifier: { run: async function (_store, _now, options) { calls.push(options.persist); return { ok: true, status: 'VERIFIED' }; } } });
  function response() { return { statusCode: 0, headers: {}, setHeader: function (key, value) { this.headers[key] = value; },
    end: function (body) { this.body = JSON.parse(body); } }; }
  var denied = response(); await route({ method: 'GET', headers: {} }, denied);
  assert.equal(denied.statusCode, 401);
  var audited = response(); await route({ method: 'GET', headers: { 'x-brain-token': 'brain' } }, audited);
  assert.equal(audited.body.authMode, 'operator-read');
  var cron = response(); await route({ method: 'GET', headers: { authorization: 'Bearer cron' } }, cron);
  assert.equal(cron.body.authMode, 'cron-write');
  assert.deepEqual(calls, [false, true]);
  console.log('subscriber email capability: existing Resend proof projects to 19 separate domain authorities without a new send');
})().catch(function (error) { console.error(error); process.exit(1); });
