'use strict';

var crypto = require('node:crypto');
var CronAuth = require('../lib/cron-auth.js');
var Admin = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Decision = require('../lib/population-real-estate-decision.js');
var Executor = require('../lib/population-real-estate-executor.js');

var WORKLIST = 'population_real_estate_worklist';
var TASK_PREFIX = 'population_real_estate_task:';
function json(res, code, value) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(value)); }
function taskKey(id) { return TASK_PREFIX + id; }
function readBody(req) { return new Promise(function (resolve) { if (req.body && typeof req.body === 'object') return resolve(req.body); if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); } } var chunks = [], size = 0; req.on('data', function (chunk) { size += chunk.length; if (size <= 1048576) chunks.push(chunk); }); req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (_) { resolve({}); } }); req.on('error', function () { resolve({}); }); }); }
function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function numberEnv(name) { var raw = process.env[name]; if (raw == null || raw === '') return null; var value = Number(raw); return Number.isFinite(value) ? value : null; }
function receivingAddress(actionId) { var domain = String(process.env.POPULATION_REAL_ESTATE_RECEIVING_DOMAIN || '').trim().toLowerCase(); return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? 'population-realestate+' + actionId + '@' + domain : null; }
async function send(candidate, actionId, idempotencyKey, deps) {
  deps = deps || {};
  var apiKey = deps.apiKey || process.env.RESEND_API_KEY || '', from = deps.from || process.env.RESEND_FROM_EMAIL || '', replyTo = receivingAddress(actionId);
  if (!apiKey || !from || !replyTo) return { ok: false, providerCalled: false, definitiveFailure: true, error: 'population real-estate Resend/from/receiving-domain configuration incomplete' };
  var body = candidate.body + '\n\nProperty reference: ' + candidate.propertyRef + '\nListing: ' + candidate.listingUrl +
    '\nNon-binding indication: $' + candidate.indicationPriceUsd.toFixed(2) +
    '\n\nThis is a non-binding expression of interest only. It is not an offer capable of acceptance, a purchase agreement, proof of funds, earnest-money authorization, or authority to transfer funds. Any transaction requires separate human-approved contracts and financing. Reply to this email so LIMEN can independently observe the counterparty response.';
  var payload = { from: from, to: [candidate.counterpartyEmail], reply_to: replyTo, subject: '[LIMEN ' + actionId + '] ' + candidate.subject,
    text: body, html: '<div style="font-family:sans-serif;white-space:pre-wrap">' + esc(body) + '</div>' };
  try {
    var response = await (deps.fetch || fetch)('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json', 'idempotency-key': idempotencyKey, 'user-agent': 'limen-helix/1.0' }, body: JSON.stringify(payload) });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) return { ok: false, providerCalled: true, definitiveFailure: response.status !== 409, ambiguous: response.status === 409, error: result.message || ('resend ' + response.status) };
    return { ok: !!result.id, id: result.id || null, providerCalled: true, definitiveFailure: !result.id, replyAddressHash: crypto.createHash('sha256').update(replyTo).digest('hex') };
  } catch (error) { return { ok: false, providerCalled: true, ambiguous: true, error: String(error && error.message || error) }; }
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, cronAuth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    var method = String(req.method || 'GET').toUpperCase();
    if (method === 'POST') {
      var pass = Admin.reqKey(req); if (!Admin.hasDomain(pass, 'population')) return Admin.deny(res);
      var body = await readBody(req), candidate = Decision.candidate(body);
      if (!candidate) return json(res, 400, { ok: false, error: 'exact non-binding property-interest record required: inquiryId, counterpartyEmail, propertyRef, listingUrl, indicationPriceUsd, brainOpportunityId, subject, body, evidenceId, and all no-contract/no-funds flags', providerCalled: false, liveMoney: false });
      try { store.assertDurable(); var task = { schemaVersion: 'population-real-estate-task/1.0', taskId: candidate.inquiryId, candidate: candidate, enqueuedAt: Date.now(), status: 'QUEUED' }; var created = await store.setIfAbsent(taskKey(task.taskId), task); var restored = await store.get(taskKey(task.taskId)); if (!restored || restored.taskId !== task.taskId) throw new Error('task readback invalid'); if (created) { await store.lpush(WORKLIST, { taskId: task.taskId, enqueuedAt: task.enqueuedAt }); await store.ltrim(WORKLIST, 0, 999); } return json(res, 200, { ok: true, status: restored.status, taskId: task.taskId, duplicate: !created, providerCalled: false, liveMoney: false }); }
      catch (error) { return json(res, 503, { ok: false, error: 'population-real-estate-enqueue-unavailable', detail: String(error && error.message || error), providerCalled: false, liveMoney: false }); }
    }
    if (method !== 'GET') return json(res, 405, { ok: false, error: 'GET or POST only' });
    if (!cronAuth.enforce(req, res)) return;
    if ((deps.enabled != null ? deps.enabled : process.env.POPULATION_REAL_ESTATE_ENABLED === '1') !== true) return json(res, 200, { ok: true, status: 'HELD', reason: 'population-real-estate-switch-disabled', inspected: 0, accepted: 0, providerCalls: 0, liveMoney: false });
    try {
      store.assertDurable(); var refs = await store.lrange(WORKLIST, 0, 24), results = [], accepted = 0, providerCalls = 0;
      for (var i = 0; i < refs.length; i++) {
        var task = await store.get(taskKey(refs[i].taskId)); if (!task || task.status === 'COMPLETED') continue;
        var decisionDeps = Object.assign({}, deps.decisionDeps || {}, { maxIndicationUsd: deps.maxIndicationUsd != null ? deps.maxIndicationUsd : numberEnv('POPULATION_REAL_ESTATE_MAX_INDICATION_USD') });
        var decision = await (deps.decision || Decision).decide(store, task.candidate, Date.now(), decisionDeps);
        if (decision.status !== 'RELEASED') { results.push({ taskId: task.taskId, status: decision.status, reason: decision.reason, blockers: decision.blockers || [] }); continue; }
        var result = await (deps.executor || Executor).execute({ store: store, candidate: task.candidate, decision: decision, now: Date.now(), motorAuthorization: deps.motorAuthorization,
          emailCostUsd: deps.emailCostUsd != null ? deps.emailCostUsd : numberEnv('POPULATION_REAL_ESTATE_EMAIL_COST_USD'),
          dailyBudgetUsd: deps.dailyBudgetUsd != null ? deps.dailyBudgetUsd : numberEnv('POPULATION_REAL_ESTATE_DAILY_BUDGET_USD'),
          dailyRequestCap: deps.dailyRequestCap != null ? deps.dailyRequestCap : numberEnv('POPULATION_REAL_ESTATE_DAILY_REQUEST_CAP'),
          transport: deps.transport || { send: function (candidate, actionId, key) { return send(candidate, actionId, key, deps.transportDeps); } } });
        accepted += result.accepted || 0; providerCalls += result.providerCalls || 0; results.push({ taskId: task.taskId, actionId: result.actionId || decision.actionId, commandId: result.commandId || null, status: result.status, reason: result.reason || null });
        if (result.status === 'INQUIRY_ACCEPTED') { task.status = 'COMPLETED'; task.commandId = result.commandId; task.completedAt = Date.now(); await store.set(taskKey(task.taskId), task); var taskReadback = await store.get(taskKey(task.taskId)); if (!taskReadback || taskReadback.status !== 'COMPLETED') throw new Error('task completion readback invalid'); }
      }
      return json(res, 200, { ok: true, schemaVersion: 'population-real-estate-cycle/1.0', inspected: refs.length, accepted: accepted, providerCalls: providerCalls, results: results, liveMoney: false });
    } catch (error) { return json(res, 503, { ok: false, error: 'population-real-estate-cycle-unavailable', detail: String(error && error.message || error), providerCalls: 0, liveMoney: false }); }
  };
}
var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('population-real-estate-cycle', handler);
module.exports.createHandler = createHandler; module.exports.send = send; module.exports.WORKLIST = WORKLIST; module.exports.taskKey = taskKey;
