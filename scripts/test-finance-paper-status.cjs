'use strict';

var assert = require('node:assert/strict');
var Handler = require('../handlers/finance-paper-status.js');
var Preview = require('../lib/finance-preview-execution.js');
var Admission = require('../lib/finance-paper-admission.js');
var Decision = require('../lib/finance-trade-decision.js');
var Executor = require('../lib/finance-paper-executor.js');
var Commissioning = require('../lib/finance-sandbox-commissioning.js');
var PositionOwner = require('../lib/finance-position-owner.js');
var StrictStore = require('../lib/autofire-efference-store.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.get(key) || null; };
Store.prototype.lrange = async function (key, start, stop) { return (this.lists.get(key) || []).slice(start, stop + 1); };

(async function () {
  assert.equal(StrictStore.assertKey(PositionOwner.LOG_KEY), PositionOwner.LOG_KEY);
  assert.equal(StrictStore.assertKey('finance_position_owner_cursor'), 'finance_position_owner_cursor');
  assert.equal(StrictStore.assertKey(PositionOwner.reviewKey('opening-command-1', Date.parse('2026-08-26T16:00:00.000Z'), {})).indexOf('finance_position_review:') === 0, true);
  var store = new Store();
  var id = 'finance:packet:status-test';
  store.values.set(Commissioning.KEY, { status: 'VERIFIED_ZERO_EFFECT_ROLLBACK', verifiedAt: '2026-08-26T00:00:00.000Z', effectExecuted: false, executedQuantity: 0 });
  store.values.set(Preview.receiptKey(id), { status: 'PAPER_CANDIDATE', completedAt: '2026-08-26T00:01:00.000Z', providerCalled: true, selectedCompany: { ticker: 'MS', name: 'Morgan Stanley', cik: '895421' }, proposal: { rationale: 'must not leak' } });
  store.values.set(Admission.admissionKey(id), { status: 'ADMITTED_TO_PAPER', admittedAt: '2026-08-26T00:02:00.000Z' });
  store.values.set(Decision.key(id), { status: 'TRADE_INTENT_SELECTED', completedAt: '2026-08-26T00:03:00.000Z', providerCalled: true, proposal: { action: 'BUY', rationale: 'must not leak' }, tradeIntent: { symbol: 'MS' }, account: { totalCash: 999999 } });
  store.values.set(Executor.claimKey(id), { status: 'COMMAND_RECEIPTED', completedAt: '2026-08-26T00:04:00.000Z', commandId: 'cmd_1', orderId: 'order_1' });
  store.lists.set(PositionOwner.LOG_KEY, [{ status: 'HELD', completedAt: '2026-08-26T00:05:00.000Z', symbol: 'MS', reason: 'hold' }]);
  store.lists.set('tradier_b14_active_commands', [{ commandId: 'cmd_1' }]);
  var result = await Handler.snapshot({
    store: store,
    redisGet: async function () { return { c: { serverPacket: { packetId: id, generatedAt: '2026-08-26T00:00:00.000Z' } } }; }
  });
  assert.equal(result.ok, true);
  assert.equal(result.packetId, id);
  assert.equal(result.chain.preview.company.ticker, 'MS');
  assert.equal(result.chain.decision.action, 'BUY');
  assert.equal(result.chain.execution.orderPlaced, true);
  assert.equal(result.chain.activeBrokerCommands, 1);
  assert.equal(result.boundaries.brokerContactedByThisRead, false);
  assert.equal(JSON.stringify(result).includes('must not leak'), false);
  assert.equal(JSON.stringify(result).includes('999999'), false);
  console.log('finance paper status: sanitized, read-only end-to-end stage projection passed');
}()).catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
