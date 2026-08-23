'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var HANDLER_PATH = path.join(ROOT, 'handlers', 'limen-outcome.js');
var STORE_PATH = path.join(ROOT, 'lib', 'autofire-efference-store.js');
var B14_PATH = path.join(ROOT, 'lib', 'tradier-b14.js');
var LEARN_PATH = path.join(ROOT, 'lib', 'autofire-learning.js');
var passed = 0;

function assert(name, ok, detail) {
  if (!ok) throw new Error('FAIL ' + name + (detail ? ': ' + detail : ''));
  passed++;
  console.log('PASS ' + name);
}

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader: function (k, v) { this.headers[String(k).toLowerCase()] = v; },
    end: function (v) { this.body = v || ''; }
  };
}

async function invoke(handler, body) {
  var res = response();
  await handler({
    method: 'POST',
    url: '/api/limen-outcome',
    headers: { authorization: 'Bearer b12-test-secret' },
    body: body
  }, res);
  return { code: res.statusCode, json: JSON.parse(res.body || '{}') };
}

function mock(file, exports, previous) {
  var resolved = require.resolve(file);
  previous.push([resolved, require.cache[resolved]]);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exports };
}

async function main() {
  var oldCron = process.env.CRON_SECRET;
  var oldOperator = process.env.LIMEN_OPERATOR_TOKEN;
  process.env.CRON_SECRET = 'b12-test-secret';
  delete process.env.LIMEN_OPERATOR_TOKEN;

  var command = {
    commandId: 'tcmd_b12_1',
    status: 'RECONCILED_TERMINAL',
    receipt: { orderId: 'paper-order-77' },
    reafference: { terminal: true },
    intent: {
      ownerDomain: 'finance',
      actionId: 'act_finance_b12_1',
      selectionId: 'sel_finance_b12_1',
      sourceArtifactId: 'investment:spy:artifact-1'
    }
  };
  var learned = [];
  var readError = null;
  var replacements = [];
  mock(STORE_PATH, { assertDurable: function () { return true; } }, replacements);
  mock(B14_PATH, { read: async function (_store, id) {
    if (readError) throw new Error(readError);
    return id === command.commandId ? command : null;
  } }, replacements);
  mock(LEARN_PATH, {
    recordOutcome: async function (_store, event) {
      learned.push(event);
      return { ok: true, b12Updated: true, rewardPredictionError: 1 };
    }
  }, replacements);
  delete require.cache[require.resolve(HANDLER_PATH)];
  var handler = require(HANDLER_PATH);

  try {
    var valid = await invoke(handler, {
      commandId: command.commandId,
      eventType: 'OUTCOME_INVESTMENT_PNL',
      outcomeData: {
        horizonDays: 30, investedAmount: 100, netPnl: 5, returnPct: 5,
        benchmarkReturnPct: 2, maxDrawdownPct: -2, riskBreach: false,
        executionMode: 'paper', brokerOrderId: 'paper-order-77'
      }
    });
    assert('reconciled B14 command can address an investment outcome', valid.code === 200 && valid.json.learningAccepted === true);
    assert('command identity reaches the B12 event', learned.length === 1 &&
      learned[0].commandId === command.commandId && learned[0].actionId === command.intent.actionId &&
      learned[0].ownerDomain === 'finance');
    assert('synthetic command output identity is explicit', learned[0].outputId === 'tradier-command:' + command.commandId);
    assert('source artifact and broker order identity are preserved',
      learned[0].sourceArtifactId === command.intent.sourceArtifactId &&
      learned[0].outcomeData.brokerOrderId === command.receipt.orderId);

    var mismatch = await invoke(handler, {
      commandId: command.commandId,
      eventType: 'OUTCOME_INVESTMENT_PNL',
      outcomeData: { executionMode: 'paper', brokerOrderId: 'paper-order-other' }
    });
    assert('a mismatched broker order cannot teach B12', mismatch.code === 400 && learned.length === 1);

    var research = await invoke(handler, {
      commandId: command.commandId,
      eventType: 'OUTCOME_RESEARCH_EVALUATED',
      outcomeData: {}
    });
    assert('a Tradier command cannot masquerade as research evidence', research.code === 400 && learned.length === 1);

    command.status = 'RECEIPT_PERSISTED';
    var unreconciled = await invoke(handler, {
      commandId: command.commandId,
      eventType: 'OUTCOME_INVESTMENT_PNL',
      outcomeData: { executionMode: 'paper', brokerOrderId: 'paper-order-77' }
    });
    assert('unreconciled commands cannot teach B12', unreconciled.code === 409 && learned.length === 1);

    command.status = 'RECONCILED_TERMINAL';
    readError = 'redis unavailable';
    var unavailable = await invoke(handler, {
      commandId: command.commandId,
      eventType: 'OUTCOME_INVESTMENT_PNL',
      outcomeData: { executionMode: 'paper', brokerOrderId: 'paper-order-77' }
    });
    assert('a command-store outage is not reported as a missing command',
      unavailable.code === 503 && unavailable.json.error === 'tradier-command-lookup-failed' && learned.length === 1);
  } finally {
    if (oldCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldCron;
    if (oldOperator === undefined) delete process.env.LIMEN_OPERATOR_TOKEN; else process.env.LIMEN_OPERATOR_TOKEN = oldOperator;
    delete require.cache[require.resolve(HANDLER_PATH)];
    for (var i = 0; i < replacements.length; i++) {
      if (replacements[i][1]) require.cache[replacements[i][0]] = replacements[i][1];
      else delete require.cache[replacements[i][0]];
    }
  }
  console.log('\n' + passed + '/' + passed + ' passed');
}

main().catch(function (err) { console.error(err.stack || err); process.exit(1); });
