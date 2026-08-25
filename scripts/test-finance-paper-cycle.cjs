'use strict';

const assert = require('node:assert/strict');
const Handler = require('../handlers/finance-paper-cycle.js');

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

function base(overrides) {
  const calls = [];
  const packetId = 'finance:3:test';
  const deps = {
    cronAuth: { enforce(req, res) { if (req.auth) return true; res.statusCode = 401; res.end(JSON.stringify({ ok: false })); return false; } },
    store: {
      assertDurable() { calls.push('durable'); },
      async get() { calls.push('preview-read'); return null; }
    },
    previewProvider: { enabled() { return true; } },
    decisionProvider: { enabled() { return true; } },
    broker: { configured() { return true; } },
    preview: {
      receiptKey(id) { return 'preview:' + id; },
      async productionInput() { calls.push('input'); return { packet: { packetId } }; },
      audit() { calls.push('audit'); return { status: 'READY_FOR_MANAGER_REVIEW', packetId, blockers: {} }; },
      async execute() { calls.push('preview'); return { receipt: { status: 'PAPER_CANDIDATE', providerCalled: true } }; }
    },
    admission: { async execute() { calls.push('admission'); return { receipt: { status: 'ADMITTED_TO_PAPER' } }; } },
    decision: { async execute() { calls.push('decision'); return { receipt: { status: 'TRADE_INTENT_SELECTED', proposal: { action: 'BUY' } } }; } },
    executor: { async execute() { calls.push('executor'); return { status: 'COMMAND_RECEIPTED', orderPlaced: true, claim: { commandId: 'cmd-1', orderId: 'ord-1' } }; } },
    env: { ANTHROPIC_API_KEY: 'configured', BRAIN_SHADOW_TOKEN: 'brain' },
    fetch: async function () {}
  };
  return { deps: Object.assign(deps, overrides || {}), calls, packetId };
}

(async function () {
  let setup = base();
  let handler = Handler.createHandler(setup.deps);
  let res = response();
  await handler({ method: 'GET', auth: false }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(setup.calls, []);

  setup = base();
  setup.deps.preview.execute = async function () { setup.calls.push('preview'); return { receipt: { status: 'ABSTAINED', reason: 'projected_margin_not_positive', providerCalled: true } }; };
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stage, 'manager-preview');
  assert.equal(res.body.status, 'ABSTAINED');
  assert.equal(res.body.orderPlaced, false);
  assert.deepEqual(setup.calls, ['durable', 'input', 'audit', 'preview-read', 'preview']);

  setup = base();
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stage, 'paper-execution');
  assert.equal(res.body.status, 'COMMAND_RECEIPTED');
  assert.equal(res.body.orderPlaced, true);
  assert.equal(res.body.liveMoney, false);
  assert.equal(res.body.commandId, 'cmd-1');
  assert.equal(res.body.orderId, 'ord-1');
  assert.deepEqual(setup.calls, ['durable', 'input', 'audit', 'preview-read', 'preview', 'admission', 'decision', 'executor']);

  setup = base({ store: { assertDurable() { setup.calls.push('durable'); }, async get() { setup.calls.push('preview-read'); return { status: 'ABSTAINED', reason: 'prior', providerCalled: true }; } } });
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.body.stage, 'manager-preview');
  assert.equal(res.body.reason, 'prior');
  assert.equal(setup.calls.includes('preview'), false);

  console.log('finance paper cycle: cron auth, readiness, one-shot inhibition, stage stops, and sandbox execution passed');
})().catch(function (error) { console.error(error); process.exit(1); });
