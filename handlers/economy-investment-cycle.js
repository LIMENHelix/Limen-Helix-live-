'use strict';

var Cron = require('../lib/cron-auth.js'), Admin = require('../lib/admin-gate.js'), Store = require('../lib/autofire-efference-store.js');
var Db = require('../lib/limen-db.js'), Redis = require('../lib/redis-kv.js'), Decision = require('../lib/economy-investment-decision.js');
var Executor = require('../lib/economy-investment-executor.js'), Broker = require('../lib/tradier-sandbox.js');
var WORKLIST = 'economy_investment_worklist', TASK_PREFIX = 'economy_investment_task:';
function json(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); }
function taskKey(id) { return TASK_PREFIX + id; }
function number(env, name) { var value = env[name]; if (value == null || value === '') return null; value = Number(value); return Number.isFinite(value) ? value : null; }
function body(req) { return new Promise(function (resolve) { if (req.body && typeof req.body === 'object') return resolve(req.body); if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); } } var chunks = []; req.on('data', function (x) { chunks.push(x); }); req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (_) { resolve({}); } }); req.on('error', function () { resolve({}); }); }); }
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, auth = deps.cronAuth || Cron, env = deps.env || process.env;
  return async function handler(req, res) {
    var method = String(req.method || 'GET').toUpperCase();
    if (method === 'POST') {
      if (!Admin.hasDomain(Admin.reqKey(req), 'economy')) return Admin.deny(res);
      var value = Decision.candidate(await body(req));
      if (!value) return json(res, 400, { ok: false, error: 'exact Economy paper-investment request with two-feed evidence required', paperOnly: true, liveMoney: false });
      try {
        store.assertDurable(); var task = { schemaVersion: 'economy-investment-task/1.0', taskId: value.requestId, candidate: value, status: 'QUEUED', enqueuedAt: Date.now() };
        var made = await store.setIfAbsent(taskKey(task.taskId), task), restored = await store.get(taskKey(task.taskId));
        if (!restored || restored.taskId !== task.taskId) throw new Error('economy investment task readback invalid');
        if (made) { await store.lpush(WORKLIST, { taskId: task.taskId, enqueuedAt: task.enqueuedAt }); await store.ltrim(WORKLIST, 0, 999); }
        return json(res, 200, { ok: true, status: restored.status, taskId: task.taskId, duplicate: !made, paperOnly: true, liveMoney: false });
      } catch (error) { return json(res, 503, { ok: false, error: 'economy-investment-enqueue-unavailable', detail: String(error && error.message || error), liveMoney: false }); }
    }
    if (method !== 'GET') return json(res, 405, { ok: false, error: 'GET or POST only' });
    if (!auth.enforce(req, res)) return;
    if ((deps.enabled != null ? deps.enabled : env.ECONOMY_INVESTMENT_PAPER_ENABLED === '1') !== true) return json(res, 200, { ok: true, status: 'HELD', reason: 'economy-investment-paper-switch-disabled', inspected: 0, accepted: 0, brokerCalls: 0, paperOnly: true, liveMoney: false });
    try {
      store.assertDurable(); var now = Date.now(), refs = await store.lrange(WORKLIST, 0, 24), results = [], accepted = 0;
      var titleSets = await (deps.readTitleSets || Db.lrangeStrict)('feedtitles:economy', 0, 12);
      var cognition = deps.cognition || await (deps.redisGet || Redis.redisGet)('limen:brain:cognition:economy');
      for (var i = 0; i < refs.length; i++) {
        var task = await store.get(taskKey(refs[i].taskId)); if (!task || task.status === 'COMPLETED') continue;
        var decision = await (deps.decision || Decision).decide(store, task.candidate, now, { cognition: cognition, titleSets: titleSets,
          maxNotionalUsd: deps.maxNotionalUsd != null ? deps.maxNotionalUsd : number(env, 'ECONOMY_INVESTMENT_MAX_NOTIONAL_USD') });
        if (decision.status !== 'RELEASED') { results.push({ taskId: task.taskId, status: decision.status, reason: decision.reason, blockers: decision.blockers || [] }); continue; }
        var result = await (deps.executor || Executor).execute({ store: store, candidate: task.candidate, decision: decision, broker: deps.broker || Broker,
          env: env, now: Date.now(), motorAuthorization: deps.motorAuthorization, developmentalAuthorization: deps.developmentalAuthorization, b14: deps.b14,
          maxNotionalUsd: deps.maxNotionalUsd != null ? deps.maxNotionalUsd : number(env, 'ECONOMY_INVESTMENT_MAX_NOTIONAL_USD'),
          dailyNotionalBudgetUsd: deps.dailyNotionalBudgetUsd != null ? deps.dailyNotionalBudgetUsd : number(env, 'ECONOMY_INVESTMENT_DAILY_NOTIONAL_USD'),
          dailyOrderCap: deps.dailyOrderCap != null ? deps.dailyOrderCap : number(env, 'ECONOMY_INVESTMENT_DAILY_ORDER_CAP') });
        accepted += result.accepted || 0; results.push({ taskId: task.taskId, actionId: result.actionId || decision.actionId, commandId: result.commandId || null,
          brokerCommandId: result.brokerCommandId || null, brokerOrderId: result.brokerOrderId || null, status: result.status, reason: result.reason || null });
        if (result.status === 'COMMAND_RECEIPTED') { task.status = 'COMPLETED'; task.commandId = result.commandId; task.completedAt = Date.now(); await store.set(taskKey(task.taskId), task); var rb = await store.get(taskKey(task.taskId)); if (!rb || rb.status !== 'COMPLETED') throw new Error('economy investment task completion readback invalid'); }
      }
      return json(res, 200, { ok: true, schemaVersion: 'economy-investment-cycle/1.0', inspected: refs.length, accepted: accepted, results: results, executionMode: 'paper', liveMoney: false });
    } catch (error) { return json(res, 503, { ok: false, error: 'economy-investment-cycle-unavailable', detail: String(error && error.message || error), executionMode: 'paper', liveMoney: false }); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('economy-investment-cycle', handler); module.exports.createHandler = createHandler; module.exports.WORKLIST = WORKLIST; module.exports.taskKey = taskKey;
