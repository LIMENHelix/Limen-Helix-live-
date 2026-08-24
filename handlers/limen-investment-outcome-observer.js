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
var HISTORY_CAP = 500;
var HISTORY_KEY = 'tradier_investment_observation:';

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
    var ids = commandIds(log);
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
    for (var q = 0; q < candidates.length; q++) {
      var symbol = String(candidates[q].intent.benchmarkSymbol).toUpperCase();
      if (!quotes[symbol]) quotes[symbol] = await broker.quote(symbol);
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
      var snap = observer.observationSnapshot(current, account, currentQuote, new Date(now).toISOString());
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
        result = observer.inspectCommand(current, account, currentQuote, history, now);
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
          if (recordedResult && recordedResult.ok) {
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
