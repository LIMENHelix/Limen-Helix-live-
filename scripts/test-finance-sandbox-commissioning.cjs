'use strict';

const assert = require('node:assert/strict');
const Commissioning = require('../lib/finance-sandbox-commissioning.js');
const Developmental = require('../lib/finance-paper-developmental-authority.js');
const MotorReceipt = require('../lib/product-domain-motor-receipt.js');

function store() {
  const values = new Map();
  return {
    values,
    assertDurable() {},
    async get(key) { return values.get(key) || null; },
    async set(key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    async setIfAbsent(key, value) { if (values.has(key)) return false; values.set(key, JSON.parse(JSON.stringify(value))); return true; }
  };
}
function broker() {
  return {
    configured() { return true; },
    async accountSnapshot() { return { positions: [], orders: [] }; },
    async quote(symbol) { return { symbol, last: 500, bid: 499 }; }
  };
}
function b14() {
  let command = null;
  return {
    async createPreview(_store, _broker, intent) { assert.equal(intent.limitPrice, 249.5); return { previewId: 'pv1', confirmationSummary: 'confirm' }; },
    async submitApproved(_store, _broker, input) { assert.deepEqual(input.approval, {
      mode: 'commissioning', actor: 'finance-commissioning', ownerDomain: 'finance',
      authorizationReceiptId: Commissioning.KEY, authorizationMode: 'zero-effect-rollback-proof'
    }); command = { commandId: 'cmd1', status: 'RECEIPT_PERSISTED', receipt: { orderId: 'ord1' }, rollback: { confirmationSummary: 'cancel', status: 'AVAILABLE' } }; return command; },
    async read() { return command; },
    async cancelApproved(_store, _broker, input) { assert.deepEqual(input.approval, {
      mode: 'commissioning', actor: 'finance-commissioning', ownerDomain: 'finance',
      authorizationReceiptId: Commissioning.KEY, authorizationMode: 'zero-effect-rollback-proof'
    }); command.status = 'CANCEL_RECEIPT_PERSISTED'; command.rollback = { status: 'CANCEL_RECEIPT_PERSISTED', receipt: { orderId: 'ord1' } }; return command; },
    async reconcile() { command.status = 'RECONCILED_TERMINAL'; command.order = { status: 'canceled', executedQuantity: 0 }; command.reafference = { terminal: true }; return command; }
  };
}

(async function () {
  const env = { LIMEN_FINANCE_PAPER_COMMISSIONING_ENABLED: '1', TRADIER_SANDBOX_AUTONOMY_ENABLED: '1', TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED: '1' };
  let s = store();
  let result = await Commissioning.execute({ store: s, broker: broker(), b14: b14(), env, sleep: async function () {} });
  assert.equal(result.status, 'VERIFIED_ZERO_EFFECT_ROLLBACK');
  assert.equal(result.record.effectExecuted, false);
  result = await Commissioning.execute({ store: s, broker: broker(), b14: b14(), env, sleep: async function () {} });
  assert.equal(result.idempotent, true);

  s.values.set(MotorReceipt.receiptKey('finance'), {
    schemaVersion: MotorReceipt.SCHEMA, productDomain: 'finance', ownerDomain: 'finance',
    contractId: 'finance-motor/1', lane: 'broker/order'
  });
  let auth = await Developmental.authorize(s, 'packet-1', env, 1000);
  assert.equal(auth.authorized, true);
  assert.equal(auth.authorizationMode, 'developmental-paper-commissioning');
  auth = await Developmental.authorize(s, 'packet-2', env, 2000);
  assert.equal(auth.authorized, false);
  assert.equal(auth.reason, 'developmental-paper-order-cap-reached');

  console.log('finance sandbox commissioning: zero-effect rollback, idempotency, and one-slot developmental authority passed');
})().catch(function (error) { console.error(error); process.exit(1); });
