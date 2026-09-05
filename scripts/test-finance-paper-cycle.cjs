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
    previewProvider: { enabled() { return true; }, configured() { return true; } },
    decisionProvider: { enabled() { return true; }, configured() { return true; } },
    broker: { configured() { return true; } },
    commissioning: {
      enabled() { return true; },
      async execute() { calls.push('commissioning'); return { ok: true, status: 'VERIFIED_ZERO_EFFECT_ROLLBACK', idempotent: true, paperOnly: true, liveMoney: false }; }
    },
    preview: {
      receiptKey(id) { return 'preview:' + id; },
      async productionInput() { calls.push('input'); return { packet: { packetId } }; },
      audit() { calls.push('audit'); return { status: 'READY_FOR_MANAGER_REVIEW', packetId, blockers: {} }; },
      async execute() { calls.push('preview'); return { receipt: { status: 'PAPER_CANDIDATE', providerCalled: true, candidate: { company: { slug: 'example', ticker: 'EX' } } } }; }
    },
    feedConfirmation: { build() { calls.push('feed-confirmation'); return { status: 'CONFIRMED_FOR_TRADE_DECISION', context: { semanticEvidence: [{}] } }; } },
    admission: { async execute() { calls.push('admission'); return { receipt: { status: 'ADMITTED_TO_PAPER' } }; } },
    decision: { async execute() { calls.push('decision'); return { receipt: { status: 'TRADE_INTENT_SELECTED', proposal: { action: 'BUY' } } }; } },
    executor: { async execute() { calls.push('executor'); return { status: 'COMMAND_RECEIPTED', orderPlaced: true, claim: { commandId: 'cmd-1', orderId: 'ord-1' } }; } },
    env: { ANTHROPIC_API_KEY: 'configured', BRAIN_SHADOW_TOKEN: 'brain', LIMEN_FINANCE_PAPER_COMMISSIONING_ENABLED: '1' },
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
  assert.deepEqual(setup.calls, ['durable', 'commissioning', 'input', 'audit', 'preview-read', 'preview']);

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
  assert.deepEqual(setup.calls, ['durable', 'commissioning', 'input', 'audit', 'preview-read', 'preview', 'feed-confirmation', 'admission', 'decision', 'executor']);

  setup = base({
    env: { GROK_API_KEY: 'configured', BRAIN_SHADOW_TOKEN: 'brain', LIMEN_FINANCE_PAPER_COMMISSIONING_ENABLED: '1' }
  });
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.body.stage, 'paper-execution');
  assert.equal(res.body.orderPlaced, true);
  assert.equal(setup.calls.includes('executor'), true);

  setup = base({
    feedConfirmation: { build() { setup.calls.push('feed-confirmation'); return { status: 'ABSTAINED', blockers: ['finance_feed_confirmation_fresh_issuer_observation_required'] }; } }
  });
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.body.stage, 'feed-confirmation');
  assert.equal(res.body.status, 'HELD');
  assert.equal(res.body.reason, 'finance_feed_confirmation_fresh_issuer_observation_required');
  assert.equal(res.body.orderPlaced, false);
  assert.equal(setup.calls.includes('admission'), false);

  setup = base({ store: { assertDurable() { setup.calls.push('durable'); }, async get() { setup.calls.push('preview-read'); return { status: 'ABSTAINED', reason: 'prior', providerCalled: true }; } } });
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.body.stage, 'manager-preview');
  assert.equal(res.body.reason, 'prior');
  assert.equal(setup.calls.includes('preview'), false);

  setup = base({
    commissioning: {
      enabled() { return true; },
      async execute() { setup.calls.push('commissioning'); return { ok: true, status: 'HELD', reason: 'cancel-reconciliation-pending', orderPlaced: true, paperOnly: true, liveMoney: false }; }
    }
  });
  handler = Handler.createHandler(setup.deps); res = response();
  await handler({ method: 'GET', auth: true }, res);
  assert.equal(res.body.stage, 'sandbox-commissioning');
  assert.equal(res.body.status, 'HELD');
  assert.equal(res.body.reason, 'cancel-reconciliation-pending');
  assert.equal(res.body.orderPlaced, true);
  assert.equal(res.body.effectExecuted, false);
  assert.deepEqual(setup.calls, ['durable', 'commissioning']);

  console.log('finance paper cycle: cron auth, provider-independent configuration, autonomous zero-effect commissioning, stage stops, and sandbox execution passed');
})().catch(function (error) { console.error(error); process.exit(1); });
