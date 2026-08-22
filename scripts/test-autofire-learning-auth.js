'use strict';

var path = require('path');
var HANDLER_PATH = path.join(__dirname, '..', 'handlers', 'limen-outcome.js');
var passed = 0;
function assert(name, ok, detail) {
  if (!ok) throw new Error('FAIL ' + name + (detail ? ': ' + detail : ''));
  passed++;
}

function response() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader: function (k, v) { this.headers[String(k).toLowerCase()] = v; },
    end: function (v) { this.body = v || ''; return this; }
  };
}

async function invoke(handler, token) {
  var req = {
    method: 'POST', url: '/api/limen-outcome',
    headers: token ? { authorization: 'Bearer ' + token } : {},
    body: {
      outputId: 'eo_research_test_auth', eventType: 'OUTCOME_RESEARCH_PUBLISHED',
      lane: 'research', ownerDomain: 'research', actionId: 'act_auth_test'
    }
  };
  var res = response();
  await handler(req, res);
  return { code: res.statusCode, json: JSON.parse(res.body || '{}') };
}

async function main() {
  var oldCron = process.env.CRON_SECRET;
  var oldOperator = process.env.LIMEN_OPERATOR_TOKEN;
  delete process.env.CRON_SECRET;
  delete process.env.LIMEN_OPERATOR_TOKEN;
  delete require.cache[require.resolve(HANDLER_PATH)];
  var handler = require(HANDLER_PATH);
  var r = await invoke(handler, null);
  assert('learning outcomes fail closed when no trusted token is configured',
    r.code === 503 && r.json.error === 'learning-outcome-auth-not-configured', JSON.stringify(r));

  process.env.CRON_SECRET = 'learning-test-secret';
  delete require.cache[require.resolve(HANDLER_PATH)];
  handler = require(HANDLER_PATH);
  r = await invoke(handler, null);
  assert('public callers cannot write reward',
    r.code === 401 && r.json.error === 'unauthorized-learning-outcome', JSON.stringify(r));
  r = await invoke(handler, 'learning-test-secret');
  assert('the configured trusted caller passes auth and then fails closed on absent durable learning storage',
    r.code === 503 && r.json.learningAccepted === false && r.json.learning &&
    r.json.learning.error === 'outcome_learning_failed', JSON.stringify(r));

  if (oldCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldCron;
  if (oldOperator === undefined) delete process.env.LIMEN_OPERATOR_TOKEN; else process.env.LIMEN_OPERATOR_TOKEN = oldOperator;
  console.log(passed + '/' + passed + ' passed');
}

main().catch(function (err) { console.error(err.stack || err); process.exit(1); });
