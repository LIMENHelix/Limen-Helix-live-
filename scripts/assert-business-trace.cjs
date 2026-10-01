'use strict';
// Shared assertions against records created by the real domain loop fixtures.
var assert = require('node:assert/strict');
var Trace = require('../lib/product-domain-business-trace-readout.js');
module.exports = async function (store, domain, command, expectedKind, now, packetId) {
  var family = { 'PAPER-ORDER': 'investment', 'OWNED-PUBLICATION': 'publication', 'CRM-ACCEPTED': 'crm',
    'EMAIL-ACCEPTED': 'autopilot', 'LETTER-ACCEPTED': 'automail', 'INQUIRY-ACCEPTED': 'real-estate' }[expectedKind];
  var Decision = require('../lib/' + domain + '-' + family + '-decision.js');
  var Executor = require('../lib/' + domain + '-' + family + '-executor.js');
  var readonly = Object.create(store);
  ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) {
    readonly[method] = async function () { throw Error('observation attempted write: ' + method); };
  });
  var result = await Trace.read(readonly, domain, now);
  assert.equal(result.status, 'RECORDED', result.reason);
  assert.equal(result.ownerDomain, domain); assert.equal(result.externalActionAuthorized, false);
  assert.equal(result.command.id, command.commandId);
  assert.equal(result.command.decisionId, command.decisionReceiptId);
  assert.equal(result.command.receipt.kind, expectedKind);
  assert.equal(result.command.paperOnly, expectedKind === 'PAPER-ORDER');
  assert.equal(result.decision.packetId, packetId || domain + '-packet-1');
  if (expectedKind === 'PAPER-ORDER') {
    assert.equal(require('../lib/autofire-efference-store.js').assertKey(Executor.PENDING_LOG_KEY), Executor.PENDING_LOG_KEY);
    assert((await store.lrange(Executor.PENDING_LOG_KEY, 0, 19)).some(function (row) { return row.commandId === command.commandId; }));
  }
  assert(!JSON.stringify(result).includes('accountId'));
  assert(!JSON.stringify(result).includes('@'), 'recipient addresses must not be projected');
  var key = Executor.commandKey(command.commandId), original = structuredClone(await store.get(key));
  await store.set(key, Object.assign({}, original, { ownerDomain: 'finance' }));
  var wrong = await Trace.read(readonly, domain, now);
  assert.equal(wrong.status, 'UNAVAILABLE'); assert.equal(wrong.command, null); assert.equal(wrong.decision, null);
  await store.set(key, Object.assign({}, original, { decisionReceiptId: 'missing' }));
  assert.equal((await Trace.read(readonly, domain, now)).reason, 'command-decision-link-invalid');
  await store.set(key, Object.assign({}, original, { commandedAt: now + 1 }));
  assert.equal((await Trace.read(readonly, domain, now)).reason, 'command-readback-invalid');
  await store.set(key, original);
  if (family === 'real-estate') {
    await store.set(key, Object.assign({}, original, { contractAuthorized: true }));
    assert.equal((await Trace.read(readonly, domain, now)).reason, 'command-readback-invalid');
    await store.set(key, original);
  }
  if (family !== 'investment' && family !== 'publication') {
    await store.set(key, Object.assign({}, original, { readbackVerified: false }));
    var noReceipt = await Trace.read(readonly, domain, now);
    assert.equal(noReceipt.status, 'RECORDED'); assert.equal(noReceipt.command.receipt, null);
    await store.set(key, original);
    await store.set(key, Object.assign({}, original, { status: 'AMBIGUOUS' }));
    assert.equal((await Trace.read(readonly, domain, now)).command.receipt, null);
    await store.set(key, original);
    var pendingRead = Object.create(readonly);
    pendingRead.lrange = async function (log, start, stop) { return log === Executor.LOG_KEY ? [] : store.lrange(log, start, stop); };
    await store.set(key, Object.assign({}, original, { status: 'DISPATCHING' }));
    var pendingCommand = await Trace.read(pendingRead, domain, now);
    assert.equal(pendingCommand.command.status, 'DISPATCHING'); assert.equal(pendingCommand.command.receipt, null);
    await store.set(key, original);
  }
  if (expectedKind === 'PAPER-ORDER') {
    await store.set(key, Object.assign({}, original, { brokerReceipt: { orderId: 'unrelated-order' } }));
    var invalidReceipt = await Trace.read(readonly, domain, now);
    assert.equal(invalidReceipt.status, 'RECORDED'); assert.equal(invalidReceipt.command.receipt, null);
    await store.set(key, original);
  }
  if (expectedKind === 'PAPER-ORDER') {
    var pendingOnly = Object.assign(Object.create(readonly), { lrange: async function (log, start, stop) {
      return log === Executor.LOG_KEY ? [] : store.lrange(log, start, stop);
    } });
    await store.set(key, Object.assign({}, original, { status: 'DISPATCHING', brokerOrderId: null, brokerReceipt: null }));
    var pending = await Trace.read(pendingOnly, domain, now);
    assert.equal(pending.command.status, 'DISPATCHING'); assert.equal(pending.command.receipt, null);
    await store.set(key, original);
  }
  var causeKey = Decision.key(command.decisionReceiptId), cause = structuredClone(await store.get(causeKey));
  await store.set(causeKey, Object.assign({}, cause, { expiresAt: original.commandedAt }));
  assert.equal((await Trace.read(readonly, domain, now)).reason, 'command-decision-link-invalid');
  await store.set(causeKey, cause);
  var restored = await Trace.read(readonly, domain, now);
  assert.equal(restored.status, 'RECORDED'); assert.deepEqual(restored, result);
  var unavailable = await Trace.read({ assertDurable: function () { throw Error('Redis unavailable'); } }, domain, now);
  assert.equal(unavailable.status, 'UNAVAILABLE'); assert.equal(unavailable.command, null);
  var empty = await Trace.read({ assertDurable: function () {}, lrange: async function () { return []; } }, domain, now);
  assert.equal(empty.status, 'UNOBSERVED'); assert.equal(empty.command, null);
};
module.exports.beforeProvider = async function (store, domain, now) {
  var trace = await Trace.read(store, domain, now);
  assert.equal(trace.status, 'RECORDED', trace.reason);
  assert.equal(trace.command.status, 'DISPATCHING');
  assert.equal(trace.command.receipt, null, 'durable pending command must precede any provider receipt');
};
module.exports.journalFailure = async function (store, domain, candidate, decision, now) {
  var Decision = require('../lib/' + domain + '-investment-decision.js');
  var Executor = require('../lib/' + domain + '-investment-executor.js');
  await store.set(Decision.key(decision.decisionReceiptId), decision);
  var attempts = 0, b14Calls = 0, originalPush = store.lpush;
  store.lpush = async function (key, value) {
    if (key === Executor.PENDING_LOG_KEY) { attempts++; throw Error('fixture journal write failed'); }
    return originalPush(key, value);
  };
  var env = {};
  env[domain.toUpperCase() + '_INVESTMENT_PAPER_ORDER_ENABLED'] = '1';
  env[domain.toUpperCase() + '_INVESTMENT_RECOVERY_ENABLED'] = '1';
  var result = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now,
    env: env, maxNotionalUsd: 150, dailyNotionalBudgetUsd: 200, dailyOrderCap: 2,
    motorAuthorization: { authorize: async function () { return { authorized: true, receiptId: 'fixture-journal-failure-motor' }; } },
    broker: { quote: async function (symbol) { return { last: symbol === 'SPY' ? 500 : 10 }; }, accountSnapshot: async function () { return { totalCash: 1000 }; } },
    b14: { createPreview: async function () { b14Calls++; }, submitApproved: async function () { b14Calls++; } } });
  assert.equal(attempts, 1); assert.equal(b14Calls, 0);
  assert.equal(result.status, 'UNRESOLVED'); assert.equal(result.ok, false);
};
