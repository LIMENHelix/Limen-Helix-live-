'use strict';

var assert = require('assert');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var HANDLER = path.join(ROOT, 'handlers', 'limen-outcome-observer.js');
var DB = path.join(ROOT, 'lib', 'limen-db.js');
var OUTCOME = path.join(ROOT, 'handlers', 'limen-outcome.js');
var passed = 0;

function ok(name, value) { assert.ok(value, name); passed++; }
function response() {
  return { statusCode: 200, headers: {}, body: '', setHeader: function (k, v) { this.headers[String(k).toLowerCase()] = v; }, end: function (v) { this.body = v || ''; } };
}
async function invoke(handler, headers) {
  var res = response();
  await handler({ method: 'GET', url: '/api/limen-outcome-observer', headers: headers || {} }, res);
  return { code: res.statusCode, json: JSON.parse(res.body || '{}') };
}
function mock(file, exports, replacements) {
  var resolved = require.resolve(file);
  replacements.push([resolved, require.cache[resolved]]);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exports };
}

(async function () {
  var oldCron = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'observer-secret';
  var replacements = [];
  var calls = [];
  var strictFailure = false;
  mock(DB, {
    getBackend: function () { return 'redis'; },
    lrangeStrict: async function (key, start, stop) {
      if (strictFailure) throw new Error('forced redis read failure');
      calls.push(['lrange', key, start, stop]);
      return [{ id: 'a1', lane: 'research', ownerDomain: 'research', outputId: 'eo1', actionId: 'act1', title: 'x', body: 'y', publishedAt: '2026-08-24T00:00:00Z' }, { id: 'a2', lane: 'investment' }];
    },
    lrange: async function (key, start, stop) {
      calls.push(['lrange', key, start, stop]);
      return [{ id: 'a1', lane: 'research', ownerDomain: 'research', outputId: 'eo1', actionId: 'act1', title: 'x', body: 'y', publishedAt: '2026-08-24T00:00:00Z' }, { id: 'a2', lane: 'investment' }];
    }
  }, replacements);
  var recorded = [];
  var rejectLearning = false;
  mock(OUTCOME, {
    recordAutonomousOutcome: async function (event) {
      recorded.push(event);
      return rejectLearning ? { ok: true, learningAccepted: false, status: 503, event: event } : { ok: true, event: event };
    }
  }, replacements);
  delete require.cache[require.resolve(HANDLER)];
  var handler = require(HANDLER);
  try {
    var unauth = await invoke(handler, {});
    ok('missing cron bearer is refused', unauth.code === 401 && unauth.json.error === 'cron-unauthorized');
    ok('unauthorized request does not read source', calls.length === 0);

    var good = await invoke(handler, { authorization: 'Bearer observer-secret' });
    ok('authorized observer reads persisted journal', good.code === 200 && good.json.ok === true);
    ok('source read is bounded to 500 articles', calls.length === 1 && calls[0][0] === 'lrange' && calls[0][1] === 'site:articles' && calls[0][3] === 499);
    ok('one research publication is eligible', good.json.eligible === 1 && good.json.examined === 2);
    ok('one publication receipt is recorded', good.json.recorded === 1 && recorded.length === 1);
    ok('publication receipt is not evaluation', good.json.evaluated === 0 && recorded[0].eventType === 'OUTCOME_RESEARCH_PUBLISHED');
    ok('observer preserves command identity', recorded[0].outputId === 'eo1' && recorded[0].actionId === 'act1');
    ok('non-research lane is explicitly abstained', good.json.abstentions.some(function (x) { return x.reason === 'not-research-lane'; }));
    rejectLearning = true;
    var learningFailure = await invoke(handler, { authorization: 'Bearer observer-secret' });
    ok('rejected learning write is surfaced as observer failure', learningFailure.code === 503 && learningFailure.json.ok === false && learningFailure.json.failures.length === 1);
    rejectLearning = false;
    strictFailure = true;
    var sourceFailure = await invoke(handler, { authorization: 'Bearer observer-secret' });
    ok('durable source read failure is not reported as empty success', sourceFailure.code === 503 && sourceFailure.json.ok === false && sourceFailure.json.error === 'observer-failed');
  } finally {
    if (oldCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldCron;
    delete require.cache[require.resolve(HANDLER)];
    for (var i = 0; i < replacements.length; i++) {
      if (replacements[i][1]) require.cache[replacements[i][0]] = replacements[i][1];
      else delete require.cache[replacements[i][0]];
    }
  }
  console.log('autofire outcome observer handler: ' + passed + '/' + passed + ' passed');
})().catch(function (err) { console.error(err.stack || err); process.exit(1); });
