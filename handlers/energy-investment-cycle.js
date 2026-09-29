'use strict';

var Cron = require('../lib/cron-auth.js'), Admin = require('../lib/admin-gate.js'), Store = require('../lib/autofire-efference-store.js');
var Decision = require('../lib/energy-investment-decision.js');
var WORKLIST = 'energy_investment_worklist', TASK_PREFIX = 'energy_investment_task:';
function json(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)); }
function taskKey(id) { return TASK_PREFIX + id; }
function number(env, name) { var value = env[name]; if (value == null || value === '') return null; value = Number(value); return Number.isFinite(value) ? value : null; }
function body(req) { return new Promise(function (resolve) { if (req.body && typeof req.body === 'object') return resolve(req.body); if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); } } var chunks = []; req.on('data', function (x) { chunks.push(x); }); req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (_) { resolve({}); } }); req.on('error', function () { resolve({}); }); }); }
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, auth = deps.cronAuth || Cron, env = deps.env || process.env;
  return async function handler(req, res) {
    var method = String(req.method || 'GET').toUpperCase();
    if (method === 'POST') {
      if (!Admin.hasDomain(Admin.reqKey(req), 'energy')) return Admin.deny(res);
      var value = Decision.candidate(await body(req));
      if (!value) return json(res, 400, { ok: false, error: 'exact Energy paper-investment request with two-feed evidence required', paperOnly: true, liveMoney: false });
      try {
        store.assertDurable(); var task = { schemaVersion: 'energy-investment-task/1.0', taskId: value.requestId, candidate: value, status: 'QUEUED', enqueuedAt: Date.now() };
        var made = await store.setIfAbsent(taskKey(task.taskId), task), restored = await store.get(taskKey(task.taskId));
        if (!restored || restored.taskId !== task.taskId) throw new Error('energy investment task readback invalid');
        if (made) { await store.lpush(WORKLIST, { taskId: task.taskId, enqueuedAt: task.enqueuedAt }); await store.ltrim(WORKLIST, 0, 999); }
        return json(res, 200, { ok: true, status: restored.status, taskId: task.taskId, duplicate: !made, paperOnly: true, liveMoney: false });
      } catch (error) { return json(res, 503, { ok: false, error: 'energy-investment-enqueue-unavailable', detail: String(error && error.message || error), liveMoney: false }); }
    }
    if (method !== 'GET') return json(res, 405, { ok: false, error: 'GET or POST only' });
    if (!auth.enforce(req, res)) return;
    if ((deps.enabled != null ? deps.enabled : env.ENERGY_INVESTMENT_PAPER_ENABLED === '1') !== true) return json(res, 200, { ok: true, status: 'HELD', reason: 'energy-investment-paper-switch-disabled', inspected: 0, accepted: 0, brokerCalls: 0, paperOnly: true, liveMoney: false });
    try {
      /* Compatibility quarantine: this route preserves old Energy investment
       * requests for later review but cannot make a decision, claim Energy's
       * motor, call Finance as an execution adapter, or touch Tradier. Finance
       * now receives source-domain opportunities through civilization packets
       * and independently owns the investment loop. */
      store.assertDurable(); var refs = await store.lrange(WORKLIST, 0, 24), results = [];
      for (var i = 0; i < refs.length; i++) {
        var task = await store.get(taskKey(refs[i].taskId)); if (!task || task.status === 'COMPLETED') continue;
        results.push({ taskId: task.taskId, status: 'QUARANTINED', reason: 'energy-investment-authority-moved-to-finance-domain',
          sourceDomain: 'energy', destination: 'finance-domain-intake', candidatePreserved: true,
          orderSubmissionCalls: 0, brokerCalls: 0, paperOnly: true, liveMoney: false });
      }
      return json(res, 200, { ok: true, schemaVersion: 'energy-investment-cycle/1.1', inspected: refs.length, accepted: 0, quarantined: results.length,
        results: results, executionMode: 'quarantine-only', brokerCalls: 0, orderSubmissionCalls: 0, paperOnly: true, liveMoney: false });
    } catch (error) { return json(res, 503, { ok: false, error: 'energy-investment-cycle-unavailable', detail: String(error && error.message || error), executionMode: 'paper', liveMoney: false }); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('energy-investment-cycle', handler); module.exports.createHandler = createHandler; module.exports.WORKLIST = WORKLIST; module.exports.taskKey = taskKey;
