'use strict';

/**
 * Hourly, read-only Tradier sandbox outcome observer.
 *
 * The worker reads only durable B14 command records, account snapshots, and
 * explicit benchmark quotes. It never previews, submits, or alters a broker
 * order. Redis is required because command and observation history must span
 * serverless invocations.
 */

var store = require('../lib/autofire-efference-store');
var broker = require('../lib/tradier-sandbox');
var b14 = require('../lib/tradier-b14');
var cronAuth = require('../lib/cron-auth');
var observer = require('../lib/autofire-investment-observer');
var outcome = require('./limen-outcome');

var COMMAND_SCAN = 500;
// One sample per hourly run.  Keep >90 days so a 90-day horizon cannot lose
// its earliest drawdown before the outcome is due.
var HISTORY_CAP = 3000;
var HISTORY_KEY = 'tradier_investment_observation:';
var ACTIVE_COMMAND_INDEX = 'tradier_b14_active_commands';

function response(res, code, body) {
  res.statusCode = code;
  return res.end(JSON.stringify(body));
}

function commandIds(log) {
  var seen = Object.create(null);
  return (Array.isArray(log) ? log : []).map(function (row) {
    return row && row.commandId ? String(row.commandId) : null;
  }).filter(function (id) {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') return response(res, 405, { ok: false, error: 'GET only' });
  if (!cronAuth.enforce(req, res)) return;

  try {
    store.assertDurable();
    var log = await store.lrange('tradier_b14_log', 0, COMMAND_SCAN - 1);
    var active = await store.lrange(ACTIVE_COMMAND_INDEX, 0, -1);
    var ids = commandIds((Array.isArray(active) ? active : []).concat(log));
    var commands = [];
    var abstentions = [];
    for (var i = 0; i < ids.length; i++) {
      var command = await b14.read(store, ids[i]);
      if (!command) {
        abstentions.push({ commandId: ids[i], reason: 'command-not-found' });
        continue;
      }
      commands.push(command);
    }

    var candidates = commands.filter(function (command) {
      return command && command.intent && command.intent.benchmarkSymbol;
    });
    var account = candidates.length ? await broker.accountSnapshot() : null;
    var quotes = Object.create(null);
    var positionQuotes = Object.create(null);
    var quoteErrors = Object.create(null);
    for (var q = 0; q < candidates.length; q++) {
      var benchmark = String(candidates[q].intent.benchmarkSymbol).toUpperCase();
      if (!quotes[benchmark] && !quoteErrors[benchmark]) {
        try { quotes[benchmark] = await broker.quote(benchmark); }
        catch (quoteErr) { quoteErrors[benchmark] = String(quoteErr && quoteErr.code || quoteErr && quoteErr.message || quoteErr); }
      }
      var traded = String(candidates[q].intent.symbol || '').toUpperCase();
      if (traded && !positionQuotes[traded] && !quoteErrors['position:' + traded]) {
        try { positionQuotes[traded] = await broker.quote(traded); }
        catch (quoteErr2) { quoteErrors['position:' + traded] = String(quoteErr2 && quoteErr2.code || quoteErr2 && quoteErr2.message || quoteErr2); }
      }
    }

    var inspected = 0;
    var eligible = 0;
    var waiting = 0;
    var recorded = 0;
    var duplicates = 0;
    var failures = [];
    var now = Date.now();
    for (var j = 0; j < commands.length; j++) {
      var current = commands[j];
      inspected++;
      var currentQuote = current.intent && current.intent.benchmarkSymbol
        ? quotes[String(current.intent.benchmarkSymbol).toUpperCase()] : null;
      var benchmarkKey = current.intent && current.intent.benchmarkSymbol
        ? String(current.intent.benchmarkSymbol).toUpperCase() : null;
      if (benchmarkKey && quoteErrors[benchmarkKey]) {
        abstentions.push({ commandId: current.commandId, reason: 'benchmark-quote-unavailable', detail: quoteErrors[benchmarkKey] });
        continue;
      }
      var positionQuote = current.intent && current.intent.symbol
        ? positionQuotes[String(current.intent.symbol).toUpperCase()] : null;
      var snap = observer.observationSnapshot(current, account, currentQuote, new Date(now).toISOString(), positionQuote);
      var key = HISTORY_KEY + String(current.commandId);
      var history = await store.lrange(key, 0, HISTORY_CAP - 1);
      var priorSnapshot = history.some(function (row) { return row && row.snapshotId === snap.snapshotId; });
      if (!priorSnapshot) {
        await store.lpush(key, snap);
        await store.ltrim(key, 0, HISTORY_CAP - 1);
        history.unshift(snap);
      }
      var result;
      try {
        result = observer.inspectCommand(current, account, currentQuote, history, now, positionQuote);
      } catch (err) {
        failures.push({ commandId: current.commandId, error: String(err && err.message || err) });
        continue;
      }
      if (result.status === 'WAITING') waiting++;
      if (result.status === 'ABSTAINED') abstentions.push({ commandId: current.commandId, reason: result.reason, dueHorizons: result.dueHorizons || null });
      if (result.events && result.events.length) {
        eligible += result.events.length;
        for (var e = 0; e < result.events.length; e++) {
          var recordedResult = await outcome.recordAutonomousOutcome(result.events[e]);
          if (recordedResult && recordedResult.ok && recordedResult.learningAccepted !== false) {
            if (recordedResult.duplicate) duplicates++;
            else recorded++;
          } else {
            failures.push({ commandId: current.commandId, observationId: result.events[e].observationId, error: recordedResult && (recordedResult.error || recordedResult.detail) || 'outcome-record-failed' });
          }
        }
      }
    }
    return response(res, failures.length ? 503 : 200, {
      ok: failures.length === 0,
      source: 'tradier-sandbox',
      commandsExamined: inspected,
      eligible: eligible,
      recorded: recorded,
      duplicates: duplicates,
      waiting: waiting,
      abstentions: abstentions,
      failures: failures,
      executionMode: 'paper',
      liveOrders: 0,
      note: 'read-only sandbox reconciliation; no order submission and no live investment outcome'
    });
  } catch (err) {
    return response(res, 503, {
      ok: false,
      error: 'investment-observer-failed',
      errorCode: err && err.code || 'INVESTMENT_OBSERVER_FAILED',
      detail: String(err && err.message || err),
      executionMode: 'paper',
      liveOrders: 0
    });
  }
};

module.exports._commandIds = commandIds;
