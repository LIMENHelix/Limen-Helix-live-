'use strict';

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Db = require('../lib/limen-db.js');
var Redis = require('../lib/redis-kv.js');
var Source = require('../lib/defense-publication-source.js');
var Decision = require('../lib/defense-publication-decision.js');
var Executor = require('../lib/defense-publication-executor.js');

function json(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); }
function envNumber(name) { var value = process.env[name]; if (value == null || value === '') return null; value = Number(value); return Number.isFinite(value) ? value : null; }

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });
    if (!auth.enforce(req, res)) return;
    var enabled = deps.enabled != null ? deps.enabled : process.env.DEFENSE_PUBLICATION_ENABLED === '1';
    if (enabled !== true) return json(res, 200, { ok: true, status: 'HELD', reason: 'defense-publication-switch-disabled', accepted: 0, providerCalls: 0, liveMoney: false });
    try {
      store.assertDurable();
      var now = Date.now();
      var titleSets = await (deps.readTitleSets || Db.lrangeStrict)('feedtitles:defense', 0, 7);
      var cognition = deps.cognition || await (deps.redisGet || Redis.redisGet)('limen:brain:cognition:defense');
      var candidate = (deps.source || Source).build(titleSets, cognition, now);
      if (!candidate) return json(res, 200, { ok: true, status: 'NO_ACTION', reason: 'defense-publication-source-or-brain-selection-insufficient', accepted: 0, providerCalls: 0, liveMoney: false });
      var decision = await (deps.decision || Decision).decide(store, candidate, now, cognition);
      if (decision.status !== 'RELEASED') return json(res, 200, { ok: true, status: decision.status, reason: decision.reason, blockers: decision.blockers || [], accepted: 0, providerCalls: 0, liveMoney: false });
      var result = await (deps.executor || Executor).execute({
        store: store, candidate: candidate, decision: decision, now: Date.now(), motorAuthorization: deps.motorAuthorization,
        operationCostUsd: deps.operationCostUsd != null ? deps.operationCostUsd : envNumber('DEFENSE_PUBLICATION_OPERATION_COST_USD'),
        dailyBudgetUsd: deps.dailyBudgetUsd != null ? deps.dailyBudgetUsd : envNumber('DEFENSE_PUBLICATION_DAILY_BUDGET_USD'),
        dailyPublicationCap: deps.dailyPublicationCap != null ? deps.dailyPublicationCap : envNumber('DEFENSE_PUBLICATION_DAILY_CAP'),
        publisher: deps.publisher
      });
      return json(res, 200, { ok: true, schemaVersion: 'defense-publication-cycle/1.0', status: result.status,
        actionId: result.actionId || decision.actionId, commandId: result.commandId || null, articleId: result.articleId || null,
        publicPath: result.publicPath || null, reason: result.reason || null, accepted: result.accepted || 0,
        providerCalls: 0, liveMoney: false });
    } catch (error) {
      return json(res, 503, { ok: false, error: 'defense-publication-cycle-unavailable', detail: String(error && error.message || error), providerCalls: 0, liveMoney: false });
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('defense-publication-cycle', handler);
module.exports.createHandler = createHandler;
