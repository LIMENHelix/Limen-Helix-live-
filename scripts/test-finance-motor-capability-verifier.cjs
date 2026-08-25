#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Verifier = require('../lib/finance-motor-capability-verifier.js');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Handler = require('../handlers/finance-motor-capability.js');

function motor() {
  return {
    schemaVersion: Motor.SCHEMA, receiptId: 'pdmr_finance', productDomain: 'finance', ownerDomain: 'finance',
    contractId: 'finance-motor/1', lane: 'broker/order', status: 'HELD',
    contracts: { decision: 'broker-order-decision/1', budget: 'finance-broker-budget/1', receipt: 'broker-order-receipt', independentOutcome: 'fill-and-independent-pnl', rollback: 'cancel-or-exit-under-risk-policy' },
    persistedAt: Date.parse('2026-08-25T00:00:00Z')
  };
}

function command() {
  return {
    commandId: 'tcmd_proof', status: 'RECONCILED_TERMINAL', tag: 'limen-b14-proof', updatedAt: '2026-08-25T00:10:00Z',
    intent: { ownerDomain: 'finance', actionId: 'act_proof' }, receipt: { orderId: '77' },
    order: { id: '77', status: 'canceled', executedQuantity: 0 },
    rollback: { status: 'CANCEL_RECEIPT_PERSISTED', receipt: { orderId: '77' } },
    reafference: { matchedSelfEffect: { executedQuantity: 0, identity: { commandId: 'tcmd_proof', orderId: '77', tag: 'limen-b14-proof' } } }
  };
}

function event() {
  return {
    eventId: 'evt_proof', observationId: 'tradier-pnl:tcmd_proof:30', eventType: 'OUTCOME_INVESTMENT_PNL',
    commandId: 'tcmd_proof', actionId: 'act_proof', ownerDomain: 'finance', lane: 'investment',
    outcomeData: {
      executionMode: 'paper', horizonDays: 30, brokerOrderId: '77',
      sourceIdentity: { provider: 'tradier', accountId: 'VA1', snapshotId: 'snap1' },
      benchmarkIdentity: { provider: 'tradier', symbol: 'SPY' }
    }
  };
}

function Store(includeProof) {
  this.map = new Map(); this.writes = [];
  this.map.set(Motor.receiptKey('finance'), motor());
  this.map.set('autofire_learning_state:finance', { processedOutcomeIds: includeProof ? ['evt_proof'] : [] });
  if (includeProof) this.map.set('tradier_b14_command:tcmd_proof', command());
  this.active = includeProof ? [{ commandId: 'tcmd_proof' }] : [];
  this.outcomes = includeProof ? [event()] : [];
}
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.writes.push(key); this.map.set(key, value); return true; };
Store.prototype.lrange = async function (key) {
  if (key === 'tradier_b14_active_commands') return this.active;
  if (key === 'tradier_b14_log') return [];
  if (key === 'autofire_learning_outcome_log') return this.outcomes;
  return [];
};

var broker = { probe: async function () { return { ok: true, broker: 'tradier', environment: 'sandbox', readOnly: true, profileMatched: true, checkedAt: '2026-08-25T00:20:00Z' }; } };

function response() {
  return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, end: function (body) { this.json = JSON.parse(body); return this; } };
}

(async function () {
  assert.equal(Verifier.executorEvidence(command()), true);
  assert.equal(Verifier.executorEvidence(Object.assign({}, command(), { order: { id: '77', status: 'canceled', executedQuantity: 1 } })), false);
  assert.equal(Verifier.observerEvidence(event(), command(), { processedOutcomeIds: ['evt_proof'] }), true);
  assert.equal(Verifier.observerEvidence(event(), command(), { processedOutcomeIds: [] }), false);

  var emptyStore = new Store(false);
  var held = await Verifier.verifyAndPersist(emptyStore, broker, Date.parse('2026-08-25T00:30:00Z'));
  assert.equal(held.status, 'HELD');
  assert.equal(held.persisted, false);
  assert.deepEqual(emptyStore.writes, []);

  var store = new Store(true);
  var verified = await Verifier.verifyAndPersist(store, broker, Date.parse('2026-08-25T00:30:00Z'));
  assert.equal(verified.status, 'VERIFIED');
  assert.equal(verified.persisted, true);
  assert.deepEqual(store.writes, [Cap.capabilityKey('finance', Cap.EXECUTOR), Cap.capabilityKey('finance', Cap.OBSERVER)]);
  assert.equal((await Cap.verifyPair(store, motor(), Date.parse('2026-08-25T00:31:00Z'))).ok, true);

  var handlerStore = new Store(false);
  var handler = Handler.createHandler({
    store: handlerStore, broker: broker,
    env: { BRAIN_SHADOW_TOKEN: 'brain', CRON_SECRET: 'cron' },
    verifier: Verifier
  });
  var denied = response();
  await handler({ method: 'GET', headers: {} }, denied);
  assert.equal(denied.statusCode, 401);
  var read = response();
  await handler({ method: 'GET', headers: { 'x-brain-token': 'brain' } }, read);
  assert.equal(read.statusCode, 200);
  assert.equal(read.json.authMode, 'operator-read');
  assert.equal(read.json.persisted, false);
  assert.deepEqual(handlerStore.writes, []);

  console.log('finance motor capability verifier: separate real executor/outcome evidence, fail-closed persistence, and read-only operator auth passed');
})().catch(function (error) { console.error(error); process.exit(1); });
