'use strict';

const assert = require('node:assert/strict');
const Executor = require('../lib/finance-paper-executor.js');
const Decision = require('../lib/finance-trade-decision.js');
const Handler = require('../handlers/finance-paper-executor.js');
const StrictStore = require('../lib/autofire-efference-store.js');

function storeWith(decision) {
  const values = new Map([[Decision.key('packet-1'), decision]]);
  const logs = [];
  return {
    values, logs,
    assertDurable() { return true; },
    async get(key) { return values.has(key) ? values.get(key) : null; },
    async set(key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    async setIfAbsent(key, value) { if (values.has(key)) return false; values.set(key, JSON.parse(JSON.stringify(value))); return true; },
    async lpush(_key, value) { logs.unshift(JSON.parse(JSON.stringify(value))); return logs.length; },
    async ltrim() { return true; }
  };
}
function selectedDecision() {
  const actionId = 'cand_finance_open_sandbox_long';
  return {
    schemaVersion: Decision.RECEIPT_SCHEMA,
    packetId: 'packet-1',
    status: 'TRADE_INTENT_SELECTED',
    selection: {
      id: 'selection-1', status: 'RELEASED', lane: 'investment', ownerDomain: 'finance', command: 'prepare_tradier_sandbox_order',
      candidate: { cik: '320193', ticker: 'AAPL', sourceIdentity: { value: 'artifact-1' } },
      criticDecision: { outcome: 'released', released: { candidateId: actionId } },
      authority: { tradierSandboxOrderAutomation: true }
    },
    tradeIntent: { symbol: 'AAPL', side: 'buy', quantity: 1, limitPrice: 500, maxNotionalUsd: 510, sourceArtifactId: 'artifact-1', horizonDays: [30, 60, 90] },
    safety: { brokerReadOnly: true, orderPreviewed: false, orderPlaced: false, paperOnly: true, liveMoney: false }
  };
}
function bridge(options) {
  options = options || {};
  return {
    async auditDecision() { return options.audit || { status: 'READY_FOR_B14_PREVIEW', reason: null, switches: { previewAutonomyEnabled: true, orderAutonomyEnabled: true } }; },
    executionReadiness() { return options.execution || { ready: true, reasons: [] }; },
    async previewDecision(store) {
      assert.equal(store.values.has(Executor.claimKey('packet-1')), true, 'packet must be claimed before broker preview');
      if (options.previewError) throw options.previewError;
      return {
        status: 'PREVIEWED',
        preview: {
          previewId: 'preview-1',
          confirmationSummary: 'APPROVE EXACT',
          intent: { actionId: options.previewActionId || 'selection-1' }
        }
      };
    }
  };
}
function motor(authorized, reason) {
  return { async authorize() { return { authorized: authorized, reason: reason || null, receiptId: authorized ? 'motor-1' : null }; } };
}
function developmental(authorized) {
  return { async authorize() { return authorized
    ? { authorized: true, receiptId: 'developmental-1', authorizationMode: 'developmental-paper-commissioning' }
    : { authorized: false, reason: 'zero-effect-sandbox-rollback-proof-missing' }; } };
}
function b14() {
  return { async submitApproved(_store, _broker, input) {
    assert.equal(input.previewId, 'preview-1'); assert.equal(input.confirmation, 'APPROVE EXACT');
    assert.equal(input.approval.mode, 'domain-autonomous'); assert.equal(input.approval.actor, 'finance-brain');
    assert.equal(input.approval.ownerDomain, 'finance');
    const expectedMode = input.approval.authorizationReceiptId === 'developmental-1'
      ? 'developmental-paper-commissioning' : 'mature-production-capability';
    assert.ok(input.approval.authorizationReceiptId === 'developmental-1' || input.approval.authorizationReceiptId === 'motor-1');
    assert.equal(input.approval.authorizationMode, expectedMode);
    return { commandId: 'command-1', receipt: { orderId: 'order-1' }, rollback: { status: 'AVAILABLE' } };
  } };
}

(async function () {
  const env = { TRADIER_SANDBOX_AUTONOMY_ENABLED: '1', TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED: '1' };
  assert.equal(StrictStore.assertKey(Executor.claimKey('packet-1')), 'finance_paper_execution_claim:packet-1');

  let store = storeWith(selectedDecision());
  let calls = 0;
  const previewOffBridge = bridge({ audit: { status: 'READY_FOR_B14_PREVIEW', switches: { previewAutonomyEnabled: false, orderAutonomyEnabled: true } } });
  previewOffBridge.previewDecision = async function () { calls++; };
  let result = await Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: previewOffBridge, b14: b14(), motorAuthorization: motor(true), now: 1000 });
  assert.equal(result.status, 'HELD');
  assert.equal(result.reason, 'preview-autonomy-switch-off');
  assert.equal(calls, 0);
  assert.equal(store.values.has(Executor.claimKey('packet-1')), false);

  store = storeWith(selectedDecision());
  const heldBridge = bridge({ execution: { ready: false, reasons: ['order-autonomy-switch-off'] } });
  heldBridge.previewDecision = async function () { calls++; };
  result = await Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: heldBridge, b14: b14(), motorAuthorization: motor(true), now: 1000 });
  assert.equal(result.status, 'HELD');
  assert.equal(result.reason, 'order-autonomy-switch-off');
  assert.equal(calls, 0);
  assert.equal(store.values.has(Executor.claimKey('packet-1')), false);

  store = storeWith(selectedDecision());
  const motorHeldBridge = bridge();
  motorHeldBridge.previewDecision = async function () { calls++; };
  result = await Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: motorHeldBridge, b14: b14(), motorAuthorization: motor(false, 'domain-executor-capability-missing'), developmentalAuthorization: developmental(false), now: 1000 });
  assert.equal(result.status, 'HELD');
  assert.equal(result.reason, 'domain-executor-capability-missing');
  assert.equal(store.values.has(Executor.claimKey('packet-1')), false);

  store = storeWith(selectedDecision());
  result = await Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: bridge(), b14: b14(), motorAuthorization: motor(false, 'domain-executor-capability-missing'), developmentalAuthorization: developmental(true), now: 1000 });
  assert.equal(result.status, 'COMMAND_RECEIPTED');
  assert.equal(result.claim.authorizationMode, 'developmental-paper-commissioning');

  store = storeWith(selectedDecision());
  result = await Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: bridge(), b14: b14(), motorAuthorization: motor(true), now: 1000 });
  assert.equal(result.status, 'COMMAND_RECEIPTED');
  assert.equal(result.orderPlaced, true);
  assert.equal(result.liveMoney, false);
  assert.equal(result.claim.orderId, 'order-1');
  assert.equal(store.values.has('autofire_learning_cause:selection-1'), true, 'Finance action cause must persist before paper dispatch');
  assert.equal(store.logs[0].type, 'COMMAND_RECEIPTED');

  const priorLogs = store.logs.length;
  result = await Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: bridge(), b14: b14(), motorAuthorization: motor(true), now: 2000 });
  assert.equal(result.idempotent, true);
  assert.equal(store.logs.length, priorLogs);

  store = storeWith(selectedDecision());
  await assert.rejects(function () {
    return Executor.execute({
      store, broker: {}, packetId: 'packet-1', env,
      bridge: bridge({ previewActionId: 'wrong-action' }), b14: b14(),
      motorAuthorization: motor(true), now: 1000
    });
  }, function (error) { return error && error.code === 'FINANCE_PAPER_PREVIEW_ACTION_ID_MISMATCH'; });
  assert.equal(store.values.get(Executor.claimKey('packet-1')).status, 'EXECUTION_UNRESOLVED');

  store = storeWith(selectedDecision());
  const previewError = new Error('preview failed'); previewError.code = 'PREVIEW_FAILED';
  await assert.rejects(function () { return Executor.execute({ store, broker: {}, packetId: 'packet-1', env, bridge: bridge({ previewError }), b14: b14(), motorAuthorization: motor(true), now: 1000 }); }, /preview failed/);
  assert.equal(store.values.get(Executor.claimKey('packet-1')).status, 'EXECUTION_UNRESOLVED');

  let executed = 0;
  const handler = Handler.createHandler({
    adminGate: { reqKey(req) { return req.key; }, isMaster(pass) { return pass === 'master'; }, deny(res) { return res.status(403).json({ ok: false }); } },
    executor: { async execute() { executed++; return { ok: true, status: 'HELD' }; } }, store: {}, broker: {},
    env: Object.assign({ BRAIN_SHADOW_TOKEN: 'brain-secret' }, env)
  });
  function res() { return { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
  let response = res(); await handler({ method: 'POST', key: 'wrong', body: { action: 'execute', packetId: 'packet-1' } }, response);
  assert.equal(response.code, 403); assert.equal(executed, 0);
  response = res(); await handler({ method: 'POST', key: 'master', body: { action: 'execute', packetId: 'packet-1' } }, response);
  assert.equal(response.code, 200); assert.equal(response.body.authMode, 'master'); assert.equal(executed, 1);
  response = res(); await handler({ method: 'POST', key: 'wrong', headers: { 'x-brain-token': 'brain-secret' }, body: { action: 'execute', packetId: 'packet-1' } }, response);
  assert.equal(response.code, 200); assert.equal(response.body.authMode, 'finance-brain-token'); assert.equal(executed, 2);
  response = res(); await handler({ method: 'POST', key: 'wrong', headers: { 'x-brain-token': 'wrong' }, body: { action: 'execute', packetId: 'packet-1' } }, response);
  assert.equal(response.code, 403); assert.equal(executed, 2);

  console.log('finance paper executor: decision, switches, independent motor proof, one-shot claim, sandbox receipt, and handler auth passed');
})().catch(function (error) { console.error(error); process.exit(1); });
