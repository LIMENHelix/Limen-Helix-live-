'use strict';

/** Hourly Finance-brain regulation of attributed open sandbox positions. */

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');
var B14 = require('../lib/tradier-b14.js');
var Decision = require('../lib/finance-trade-decision.js');
var Provider = require('../lib/finance-trade-decision-provider.js');
var Input = require('../lib/finance-position-input.js');
var Owner = require('../lib/finance-position-owner.js');

var COMMAND_SCAN = 500;
var CURSOR_KEY = 'finance_position_owner_cursor';

function response(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}

function commandIds(rows) {
  var seen = Object.create(null);
  return (Array.isArray(rows) ? rows : []).map(function (row) { return row && row.commandId ? String(row.commandId) : null; })
    .filter(function (id) { if (!id || seen[id]) return false; seen[id] = true; return true; });
}

function packetIdOf(command) {
  return command && command.intent && command.intent.decisionContext &&
    command.intent.decisionContext.cycleEvidence && command.intent.decisionContext.cycleEvidence.sourcePacketId || null;
}

function openingFor(commands, position) {
  var symbol = String(position && position.symbol || '').toUpperCase();
  var quantity = Number(position && position.quantity);
  var side = quantity > 0 ? 'buy' : 'sell_short';
  return commands.filter(function (command) {
    return command && command.intent && command.intent.side === side &&
      String(command.intent.symbol || '').toUpperCase() === symbol &&
      (!command.intent.decisionContext || command.intent.decisionContext.role !== 'position-exit');
  }).sort(function (a, b) {
    return Date.parse(b.emittedAt || '') - Date.parse(a.emittedAt || '');
  })[0] || null;
}

function createHandler(deps) {
  deps = deps || {};
  var cronAuth = deps.cronAuth || CronAuth;
  var store = deps.store || Store;
  var broker = deps.broker || Broker;
  var b14 = deps.b14 || B14;
  var decision = deps.decision || Decision;
  var input = deps.input || Input;
  var owner = deps.owner || Owner;
  var providerModule = deps.providerModule || Provider;
  var env = deps.env || process.env;
  var fetchFn = deps.fetch || global.fetch;

  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return response(res, 405, { ok: false, error: 'cron GET only' });
    if (!cronAuth.enforce(req, res)) return;
    try {
      store.assertDurable();
      if (!owner.enabled(env)) return response(res, 200, { ok: true, status: 'HELD', reason: 'finance-position-owner-switch-off', paperOnly: true, providerCalls: 0, orderPlaced: false, liveMoney: false });
      if (!providerModule.enabled(env) || !env.ANTHROPIC_API_KEY || !broker.configured()) {
        return response(res, 200, {
          ok: true, status: 'HELD',
          reason: !providerModule.enabled(env) ? 'finance-trade-decision-switch-off' : (!env.ANTHROPIC_API_KEY ? 'finance-provider-unconfigured' : 'tradier-sandbox-unconfigured'),
          paperOnly: true, providerCalls: 0, orderPlaced: false, liveMoney: false
        });
      }
      var account = await broker.accountSnapshot();
      var positions = (account.positions || []).filter(function (row) { return Number(row && row.quantity) !== 0; });
      if (!positions.length) return response(res, 200, { ok: true, status: 'NO_OPEN_POSITIONS', positions: 0, paperOnly: true, providerCalls: 0, orderPlaced: false, liveMoney: false });

      var active = await store.lrange(b14.ACTIVE_COMMAND_INDEX || 'tradier_b14_active_commands', 0, COMMAND_SCAN - 1);
      var ids = commandIds(active);
      var commands = [];
      for (var i = 0; i < ids.length; i++) {
        var command = await b14.read(store, ids[i]);
        if (command) commands.push(command);
      }
      var source = await input.productionInput({
        fetch: fetchFn,
        origin: env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com',
        token: env.BRAIN_SHADOW_TOKEN || ''
      });
      var cursor = Number(await store.get(CURSOR_KEY));
      if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;
      var ordered = positions.slice(cursor % positions.length).concat(positions.slice(0, cursor % positions.length));
      var abstentions = [];

      for (var p = 0; p < ordered.length; p++) {
        var position = ordered[p];
        var opening = openingFor(commands, position);
        if (!opening) {
          abstentions.push({ symbol: position.symbol, reason: 'opening-command-attribution-unavailable' });
          continue;
        }
        try {
          if (opening.receipt && opening.receipt.orderId && opening.status !== 'RECONCILED_TERMINAL') {
            opening = await b14.reconcile(store, broker, opening.commandId, Date.now());
          }
        } catch (reconcileError) {
          abstentions.push({ symbol: position.symbol, openingCommandId: opening.commandId, reason: 'opening-command-reconciliation-unavailable', detail: String(reconcileError && reconcileError.message || reconcileError) });
          continue;
        }
        if (!opening.order || opening.order.status !== 'filled' || !(Number(opening.order.executedQuantity) > 0)) {
          abstentions.push({ symbol: position.symbol, openingCommandId: opening.commandId, reason: 'opening-command-not-filled' });
          continue;
        }
        var packetId = packetIdOf(opening);
        var openingDecision = packetId ? await store.get(decision.key(packetId)) : null;
        var company = input.companyByTicker(position.symbol);
        var marketInputs;
        try {
          marketInputs = await Promise.all([
            broker.quote(position.symbol),
            broker.history(position.symbol, { interval: 'daily' }),
            broker.history('SPY', { interval: 'daily' }),
            input.helixReport({ fetch: fetchFn, origin: env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com', idempotencyKey: opening.commandId }, company)
              .catch(function () { return null; })
          ]);
        } catch (quoteError) {
          abstentions.push({ symbol: position.symbol, reason: 'current-or-historical-position-market-data-unavailable', detail: String(quoteError && quoteError.message || quoteError) });
          continue;
        }
        var assembled = input.build(Object.assign({}, source, {
          position: position,
          quote: marketInputs[0],
          marketHistory: marketInputs[1],
          benchmarkHistory: marketInputs[2],
          helixReport: marketInputs[3],
          openingCommand: opening,
          openingDecision: openingDecision,
          now: new Date().toISOString()
        }));
        if (assembled.status !== 'READY_FOR_POSITION_REVIEW') {
          abstentions.push({ symbol: position.symbol, openingCommandId: opening.commandId, reason: assembled.blockers[0] || 'position-input-not-ready', blockers: assembled.blockers });
          continue;
        }
        var result = await owner.execute({ store: store, broker: broker, account: account, input: assembled, env: env, fetch: fetchFn });
        await store.set(CURSOR_KEY, (positions.indexOf(position) + 1) % positions.length);
        if (result.idempotent) {
          abstentions.push({ symbol: position.symbol, openingCommandId: opening.commandId, reason: 'position-already-reviewed-this-cadence', status: result.status });
          continue;
        }
        return response(res, 200, {
          ok: true,
          status: result.status,
          symbol: position.symbol,
          openingCommandId: opening.commandId,
          reviewId: result.receipt && result.receipt.reviewId || null,
          action: result.receipt && result.receipt.proposal && result.receipt.proposal.action || null,
          evidenceFingerprint: assembled.context.evidenceFingerprint,
          evidenceGaps: assembled.evidenceGaps,
          providerCalls: result.providerCalled ? 1 : 0,
          commandId: result.receipt && result.receipt.commandId || null,
          orderId: result.receipt && result.receipt.orderId || null,
          orderPlaced: result.orderPlaced === true,
          paperOnly: true,
          liveMoney: false,
          abstentions: abstentions
        });
      }
      return response(res, 200, { ok: true, status: 'NO_ELIGIBLE_POSITION_REVIEW', positions: positions.length, providerCalls: 0, orderPlaced: false, paperOnly: true, liveMoney: false, abstentions: abstentions });
    } catch (error) {
      return response(res, 503, { ok: false, status: 'POSITION_OWNER_UNRESOLVED', error: String(error && error.message || error), errorCode: error && error.code || 'FINANCE_POSITION_OWNER_HANDLER_FAILED', providerCalls: null, orderPlaced: false, paperOnly: true, liveMoney: false });
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.commandIds = commandIds;
handler.packetIdOf = packetIdOf;
handler.openingFor = openingFor;
module.exports = require('../lib/heartbeat').guard('finance-position-owner', handler);
module.exports.createHandler = createHandler;
module.exports.commandIds = commandIds;
module.exports.packetIdOf = packetIdOf;
module.exports.openingFor = openingFor;
