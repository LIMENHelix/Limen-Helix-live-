'use strict';

var Store = require('../lib/autofire-efference-store.js'), Cron = require('../lib/cron-auth.js'), Broker = require('../lib/tradier-sandbox.js');
var B14 = require('../lib/tradier-b14.js'), Executor = require('../lib/technology-investment-executor.js'), Observer = require('../lib/autofire-investment-observer.js');
var Outcome = require('./limen-outcome.js');
var HISTORY_PREFIX = 'technology_investment_observation:', HISTORY_CAP = 3000;
function json(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); }
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, auth = deps.cronAuth || Cron, broker = deps.broker || Broker, b14 = deps.b14 || B14;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });
    if (!auth.enforce(req, res)) return;
    try {
      store.assertDurable(); var commands = await store.lrange(Executor.LOG_KEY, 0, 199), inspected = 0, waiting = 0, recorded = 0, abstentions = [], failures = [];
      for (var i = 0; i < commands.length; i++) {
        var owned = commands[i]; if (!owned || owned.status !== 'COMMAND_RECEIPTED' || !owned.brokerCommandId) continue; inspected++;
        try {
          var command = await b14.reconcile(store, broker, owned.brokerCommandId, Date.now());
          if (!command.intent || command.intent.ownerDomain !== 'technology') { abstentions.push({ commandId: owned.commandId, reason: 'technology-command-owner-mismatch' }); continue; }
          var account = await broker.accountSnapshot(), benchmark = await broker.quote(command.intent.benchmarkSymbol), position = await broker.quote(command.intent.symbol);
          var snap = Observer.observationSnapshot(command, account, benchmark, new Date().toISOString(), position);
          var historyKey = HISTORY_PREFIX + command.commandId, history = await store.lrange(historyKey, 0, HISTORY_CAP - 1);
          if (!history.some(function (row) { return row && row.snapshotId === snap.snapshotId; })) { await store.lpush(historyKey, snap); await store.ltrim(historyKey, 0, HISTORY_CAP - 1); history.unshift(snap); }
          var result = Observer.inspectCommand(command, account, benchmark, history, Date.now(), position);
          if (result.status === 'WAITING') waiting++;
          if (result.status === 'ABSTAINED') abstentions.push({ commandId: owned.commandId, reason: result.reason, dueHorizons: result.dueHorizons || null });
          for (var e = 0; e < (result.events || []).length; e++) { var outcome = await Outcome.recordAutonomousOutcome(result.events[e]); if (outcome && outcome.ok && outcome.learningAccepted !== false) { if (!outcome.duplicate) recorded++; } else failures.push({ commandId: owned.commandId, error: outcome && (outcome.error || outcome.detail) || 'outcome-record-failed' }); }
        } catch (error) { failures.push({ commandId: owned.commandId, error: String(error && error.message || error) }); }
      }
      return json(res, failures.length ? 503 : 200, { ok: failures.length === 0, schemaVersion: 'technology-investment-observer-cycle/1.0', productDomain: 'technology', ownerDomain: 'technology',
        inspected: inspected, waiting: waiting, recorded: recorded, abstentions: abstentions, failures: failures,
        independentReadAdapter: 'tradier-paper-account-and-quote-reader/1', orderSubmissionCalls: 0, executionMode: 'paper', liveMoney: false });
    } catch (error) { return json(res, 503, { ok: false, error: 'technology-investment-observer-unavailable', detail: String(error && error.message || error), orderSubmissionCalls: 0, liveMoney: false }); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('technology-investment-outcome-observer', handler); module.exports.createHandler = createHandler;
