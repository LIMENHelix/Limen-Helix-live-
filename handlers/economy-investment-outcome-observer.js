'use strict';

var Store = require('../lib/autofire-efference-store.js'), Cron = require('../lib/cron-auth.js'), Broker = require('../lib/tradier-sandbox.js');
var B14 = require('../lib/tradier-b14.js'), Executor = require('../lib/economy-investment-executor.js'), Observer = require('../lib/autofire-investment-observer.js');
var Outcome = require('./limen-outcome.js'), Decision = require('../lib/economy-investment-decision.js'), Learning = require('../lib/autofire-learning.js');
var HISTORY_PREFIX = 'economy_investment_observation:', HISTORY_CAP = 3000;
function json(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); }
function brokerIdentity(command, owned) {
  var intent = command && command.intent || {}, receipt = command && command.receipt;
  return !!(command && command.schemaVersion === 1 && command.commandId === owned.brokerCommandId &&
    intent.ownerDomain === 'economy' && intent.actionId === owned.actionId && intent.selectionId === owned.decisionReceiptId &&
    intent.sourceArtifactId === owned.requestId && intent.thesisId === owned.thesisId &&
    ['symbol', 'side', 'quantity', 'limitPrice', 'maxNotionalUsd', 'benchmarkSymbol', 'benchmarkBaselineValue', 'riskLimitPct'].every(function (key) { return intent[key] === owned[key]; }) &&
    intent.decisionContext && intent.decisionContext.evidenceHash === owned.evidenceHash &&
    receipt && receipt.orderId === owned.brokerOrderId && command.accountBefore && command.accountBefore.accountId &&
    Number.isFinite(Date.parse(command.emittedAt)) && Date.parse(command.emittedAt) >= owned.commandedAt && Date.parse(command.emittedAt) <= Date.now());
}
async function joinedCommand(store, logged) {
  var owned = await store.get(Executor.commandKey(logged.commandId));
  if (!owned || owned.schemaVersion !== Executor.SCHEMA || owned.productDomain !== 'economy' || owned.ownerDomain !== 'economy' || owned.lane !== 'investments' ||
      owned.status !== 'COMMAND_RECEIPTED' || owned.paperOnly !== true || owned.liveMoney !== false || owned.durableReceiptReadbackVerified !== true ||
      owned.learningCauseDurable !== true || !owned.learningEpisodeId || !owned.brokerCommandId || !owned.brokerOrderId ||
      !owned.brokerReceipt || owned.brokerReceipt.orderId !== owned.brokerOrderId || !Number.isFinite(owned.commandedAt) || owned.commandedAt > Date.now() ||
      ['commandId','actionId','decisionReceiptId','brokerCommandId','brokerOrderId','symbol','side','requestId','thesisId','evidenceHash','paperOnly','liveMoney','ownerDomain','status'].some(function (key) { return owned[key] !== logged[key]; })) return null;
  var action = await store.get(Executor.actionKey(owned.actionId)), decision = await store.get(Decision.key(owned.decisionReceiptId)), cause = await store.get(Learning.causeKey(owned.actionId));
  if (!action || action.schemaVersion !== Executor.SCHEMA || action.status !== 'COMMAND_RECEIPTED' || action.commandId !== owned.commandId || action.actionId !== owned.actionId || action.brokerCommandId !== owned.brokerCommandId || action.brokerOrderId !== owned.brokerOrderId ||
      !decision || decision.schemaVersion !== Decision.SCHEMA || decision.status !== 'RELEASED' || decision.paperOnly !== true || decision.liveMoney !== false || decision.ownerDomain !== 'economy' || decision.productDomain !== 'economy' || decision.lane !== 'investments' || decision.decisionReceiptId !== owned.decisionReceiptId || decision.actionId !== owned.actionId ||
      ['requestId','symbol','side','thesisId','evidenceHash'].some(function (key) { return decision[key] !== owned[key]; }) ||
      !cause || cause.domain !== 'economy' || cause.lane !== 'investment' || cause.actionId !== owned.actionId || cause.selectionId !== owned.decisionReceiptId || cause.episodeId !== owned.learningEpisodeId || cause.ticker !== owned.symbol || cause.emittedAt !== owned.commandedAt ||
      !cause.decisionTrace || cause.decisionTrace.sourceArtifactRef !== owned.requestId || cause.decisionTrace.sourcePatternSig !== owned.evidenceHash ||
      !brokerIdentity(await store.get('tradier_b14_command:' + owned.brokerCommandId), owned)) return null;
  return owned;
}
function ownSnapshot(row, owned, accountId) {
  var at = Date.parse(row && row.observedAt);
  return !!(row && row.symbol === owned.symbol && row.benchmarkSymbol === owned.benchmarkSymbol && row.accountId === accountId &&
    Number.isFinite(at) && at >= owned.commandedAt && at <= Date.now() && Number.isFinite(row.positionQuantity) && Number.isFinite(row.positionMarketValue) && Number.isFinite(row.benchmarkValue) && row.benchmarkValue > 0);
}
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, auth = deps.cronAuth || Cron, broker = deps.broker || Broker, b14 = deps.b14 || B14, outcomeRecorder = deps.outcome || Outcome;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });
    if (!auth.enforce(req, res)) return;
    try {
      store.assertDurable(); var commands = await store.lrange(Executor.LOG_KEY, 0, 199), inspected = 0, waiting = 0, recorded = 0, abstentions = [], failures = [];
      for (var i = 0; i < commands.length; i++) {
        var logged = commands[i]; if (!logged || logged.status !== 'COMMAND_RECEIPTED' || !logged.brokerCommandId) continue; inspected++;
        var owned = logged;
        try {
          owned = await joinedCommand(store, logged);
          if (!owned) { abstentions.push({ commandId: logged.commandId, reason: 'economy-command-causal-join-invalid' }); continue; }
          var command = await b14.reconcile(store, broker, owned.brokerCommandId, Date.now());
          var savedBroker = await store.get('tradier_b14_command:' + owned.brokerCommandId);
          if (!brokerIdentity(command, owned) || !command.order || String(command.order.id) !== owned.brokerOrderId || command.order.symbol !== owned.symbol || command.order.side !== owned.side || !brokerIdentity(savedBroker, owned) || JSON.stringify(savedBroker) !== JSON.stringify(command)) { abstentions.push({ commandId: owned.commandId, reason: 'economy-reconciled-command-identity-mismatch' }); continue; }
          var account = await broker.accountSnapshot(), benchmark = await broker.quote(command.intent.benchmarkSymbol), position = await broker.quote(command.intent.symbol);
          if (!account || account.accountId !== command.accountBefore.accountId || !benchmark || benchmark.symbol !== owned.benchmarkSymbol || !position || position.symbol !== owned.symbol) { abstentions.push({ commandId: owned.commandId, reason: 'economy-observation-source-identity-mismatch' }); continue; }
          var snap = Observer.observationSnapshot(command, account, benchmark, new Date().toISOString(), position);
          var historyKey = HISTORY_PREFIX + command.commandId, history = await store.lrange(historyKey, 0, HISTORY_CAP - 1);
          if (ownSnapshot(snap, owned, account.accountId)) {
            if (!history.some(function (row) { return row && row.snapshotId === snap.snapshotId; })) { await store.lpush(historyKey, snap); await store.ltrim(historyKey, 0, HISTORY_CAP - 1); }
            history = await store.lrange(historyKey, 0, HISTORY_CAP - 1);
            if (!history.some(function (row) { return JSON.stringify(row) === JSON.stringify(snap); })) throw Error('economy observation snapshot readback invalid');
          }
          history = history.filter(function (row) { return ownSnapshot(row, owned, account.accountId); });
          var result = Observer.inspectCommand(command, account, benchmark, history, Date.now(), position);
          if (result.status === 'WAITING') waiting++;
          if (result.status === 'ABSTAINED') abstentions.push({ commandId: owned.commandId, reason: result.reason, dueHorizons: result.dueHorizons || null });
          for (var e = 0; e < (result.events || []).length; e++) { var outcome = await outcomeRecorder.recordAutonomousOutcome(result.events[e]); if (outcome && outcome.ok && outcome.learningAccepted !== false) { if (!outcome.duplicate) recorded++; } else failures.push({ commandId: owned.commandId, error: outcome && (outcome.error || outcome.detail) || 'outcome-record-failed' }); }
        } catch (error) { failures.push({ commandId: logged.commandId, error: String(error && error.message || error) }); }
      }
      return json(res, failures.length ? 503 : 200, { ok: failures.length === 0, schemaVersion: 'economy-investment-observer-cycle/1.0', productDomain: 'economy', ownerDomain: 'economy',
        inspected: inspected, waiting: waiting, recorded: recorded, abstentions: abstentions, failures: failures,
        independentReadAdapter: 'tradier-paper-account-and-quote-reader/1', orderSubmissionCalls: 0, executionMode: 'paper', liveMoney: false });
    } catch (error) { return json(res, 503, { ok: false, error: 'economy-investment-observer-unavailable', detail: String(error && error.message || error), orderSubmissionCalls: 0, liveMoney: false }); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('economy-investment-outcome-observer', handler); module.exports.createHandler = createHandler;
