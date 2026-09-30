#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Verifier = require('../lib/product-domain-tradier-capability-verifier.js');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Learning = require('../lib/autofire-learning.js');
var HandlerFactory = require('../handlers/product-domain-tradier-capability.js');

function Store() { this.map = new Map(); this.lists = new Map(); this.writes = []; }
Store.prototype.assertDurable = function () {};
Store.prototype.get = async function (key) { return this.map.has(key) ? structuredClone(this.map.get(key)) : null; };
Store.prototype.set = async function (key, value) { this.writes.push(key); this.map.set(key, structuredClone(value)); return true; };
Store.prototype.lrange = async function (key, start, stop) {
  return structuredClone((this.lists.get(key) || []).slice(start, stop < 0 ? undefined : stop + 1));
};
Store.prototype.lpush = async function (key, value) {
  var rows = this.lists.get(key) || []; rows.unshift(structuredClone(value)); this.lists.set(key, rows); return rows.length;
};
Store.prototype.ltrim = async function (key, start, stop) {
  this.lists.set(key, (this.lists.get(key) || []).slice(start, stop + 1));
};

function motor(domain, now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: domain + '-motor-receipt', productDomain: domain,
    ownerDomain: domain, contractId: domain + '-motor/1', lane: 'investments', status: 'HELD',
    contracts: { decision: 'capital-decision/1', budget: domain + '-investment-budget/1',
      receipt: domain + '-position-command-receipt/1', independentOutcome: domain + '-independent-market-resolution/1',
      rollback: 'cancel-or-close' }, persistedAt: now };
}

function command(domain, id, orderId, canceled) {
  var tag = 'limen-b14-' + domain + '-proof';
  return { commandId: id, tag: tag, status: 'RECONCILED_TERMINAL', updatedAt: '2026-09-30T00:10:00Z',
    intent: { ownerDomain: domain, actionId: 'action-' + id }, receipt: { orderId: orderId },
    order: { id: orderId, status: canceled ? 'canceled' : 'filled', executedQuantity: canceled ? 0 : 1 },
    rollback: { status: 'CANCEL_RECEIPT_PERSISTED', receipt: { orderId: orderId } },
    reafference: { matchedSelfEffect: { executedQuantity: canceled ? 0 : 1,
      identity: { commandId: id, orderId: orderId, tag: tag } } } };
}

function outcome(domain, id, orderId) {
  return { eventId: 'event-' + id, observationId: 'tradier-pnl:' + id + ':30', eventType: 'OUTCOME_INVESTMENT_PNL',
    commandId: id, actionId: 'action-' + id, ownerDomain: domain, lane: 'investment', outcomeData: {
      executionMode: 'paper', horizonDays: 30, brokerOrderId: orderId,
      sourceIdentity: { provider: 'tradier', accountId: 'paper-' + domain, snapshotId: 'snapshot-' + id },
      benchmarkIdentity: { provider: 'tradier', symbol: 'SPY' }
    } };
}

function broker() { return { probe: async function () { return { ok: true, broker: 'tradier', environment: 'sandbox', readOnly: true, profileMatched: true }; } }; }

function response() { return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, end: function (body) { this.json = JSON.parse(body); } }; }

(async function () {
  var now = Date.now();
  for (var i = 0; i < Verifier.DOMAINS.length; i++) {
    var domain = Verifier.DOMAINS[i], store = new Store();
    store.map.set(Motor.receiptKey(domain), motor(domain, now));
    var held = await Verifier.verifyAndPersist(store, broker(), domain, now);
    assert.equal(held.status, 'HELD');
    assert.equal(held.persisted, false);
    assert.deepEqual(store.writes, []);

    var executorCommand = command(domain, domain + '-cancel', domain + '-order-cancel', true);
    var observerCommand = command(domain, domain + '-outcome', domain + '-order-outcome', false);
    store.map.set('tradier_b14_command:' + executorCommand.commandId, executorCommand);
    store.map.set('tradier_b14_command:' + observerCommand.commandId, observerCommand);
    store.lists.set('tradier_b14_active_commands', [{ commandId: executorCommand.commandId }, { commandId: observerCommand.commandId }]);
    store.map.set(Learning.stateKey(domain), Object.assign(Learning._fresh(domain, 'investment'), { processedOutcomeIds: ['event-' + observerCommand.commandId] }));
    store.lists.set(Learning.OUTCOME_LOG_KEY, [outcome(domain, observerCommand.commandId, domain + '-order-outcome')]);
    store.writes = [];
    var verified = await Verifier.verifyAndPersist(store, broker(), domain, now + 1000);
    assert.equal(verified.status, 'VERIFIED', domain);
    assert.equal(verified.persisted, true, domain);
    assert.equal((await Cap.verifyPair(store, motor(domain, now), now + 2000)).ok, true, domain);
    assert.deepEqual(store.writes, [Cap.capabilityKey(domain, Cap.EXECUTOR), Cap.capabilityKey(domain, Cap.OBSERVER)]);
  }

  var calls = [], handler = HandlerFactory.createHandler('energy', {
    store: new Store(), broker: broker(), cronAuth: { enforce: function () { calls.push('auth'); return true; }, },
    verifier: { verifyAndPersist: async function (_store, _broker, domain) { calls.push(domain); return { ok: true, status: 'HELD', persisted: false }; } }
  });
  var res = response(); await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.json.authMode, 'cron-write'); assert.deepEqual(calls, ['auth', 'energy']);
  console.log('Tradier capability promotion: Economy, Energy and Technology remain held without evidence and verify only existing zero-fill/cancel plus independent paper outcomes');
})().catch(function (error) { console.error(error); process.exit(1); });
