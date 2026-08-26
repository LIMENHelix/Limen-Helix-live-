'use strict';

/** Routes Stripe-triggered Religion mail through the same sovereign B10/B14 effector. */
var Decision = require('./religion-subscriber-decision.js');
var Executor = require('./religion-subscriber-executor.js');
var Store = require('./autofire-efference-store.js');
var Crm = require('./crm-send.js');
var crypto = require('node:crypto');
var SCHEMA = 'religion-revenue-fulfillment/1.0';
var PREFIX = 'religion_revenue_fulfillment:', PENDING_KEY = 'religion_revenue_fulfillment_pending';
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function taskId(eventId, kind) { return 'rrf_' + hash({ eventId: eventId, kind: kind }).slice(0, 24); }
function key(id) { return PREFIX + id; }
function numericEnv(name, fallback) { var n = parseFloat(process.env[name]); return Number.isFinite(n) && n >= 0 ? n : fallback; }
async function fulfill(input) {
  input = input || {}; var store = input.store || Store, subscriber = input.subscriber, message = input.message;
  var eventId = String(input.eventId || '').trim(), kind = String(input.kind || '').trim();
  if (!eventId || ['welcome', 'renewal'].indexOf(kind) < 0 || !message || !message.subject || !message.body) {
    return { ok: false, status: 'REFUSED', reason: 'exact-stripe-fulfillment-candidate-required', providerCalls: 0, liveMoney: false };
  }
  var candidate = Decision.candidate(subscriber, { subject: message.subject, body: message.body, key: 'stripe:' + eventId + ':' + kind });
  if (!candidate) return { ok: false, status: 'REFUSED', reason: 'active-paid-subscriber-required', providerCalls: 0, liveMoney: false };
  var now = Number(input.now) || Date.now();
  var decision = await Decision.decide(store, candidate, now, input.decisionDeps);
  if (decision.status !== 'RELEASED') return { ok: true, status: 'HELD', reason: decision.reason, blockers: decision.blockers || [],
    decisionReceiptId: decision.decisionReceiptId || null, actionId: decision.actionId || null, providerCalls: 0, liveMoney: false };
  var result = await Executor.execute({ store: store, specs: [{ candidate: candidate, decision: decision }], now: now, maxSends: 1,
    emailCostUsd: input.emailCostUsd != null ? input.emailCostUsd : numericEnv('RELIGION_SUBSCRIBER_EMAIL_USD', null),
    dailyBudgetUsd: input.dailyBudgetUsd != null ? input.dailyBudgetUsd : numericEnv('RELIGION_SUBSCRIBER_DAILY_BUDGET_USD', null),
    dailySendCap: input.dailySendCap != null ? input.dailySendCap : numericEnv('RELIGION_SUBSCRIBER_DAILY_SEND_CAP', 5),
    motorAuthorization: input.motorAuthorization,
    transport: input.transport || { send: function (email, subject, body, options) { return Crm.sendToLead(email, subject, body, options); } }
  });
  return Object.assign({ decisionReceiptId: decision.decisionReceiptId, actionId: decision.actionId, kind: kind }, result);
}
async function persistTask(store, task) {
  await store.set(key(task.taskId), task); var restored = await store.get(key(task.taskId));
  if (!restored || restored.taskId !== task.taskId || restored.status !== task.status) throw new Error('religion revenue fulfillment readback invalid');
  return restored;
}
async function enqueueAndAttempt(input) {
  input = input || {}; var store = input.store || Store, eventId = String(input.eventId || '').trim(), kind = String(input.kind || '').trim();
  if (!eventId || ['welcome', 'renewal'].indexOf(kind) < 0 || !input.subscriber || !input.message) return { ok: false, status: 'REFUSED', reason: 'exact-stripe-fulfillment-task-required', providerCalls: 0 };
  store.assertDurable(); var id = taskId(eventId, kind), task = { schemaVersion: SCHEMA, taskId: id, eventId: eventId, kind: kind,
    subscriber: input.subscriber, message: input.message, status: 'PENDING', attempts: 0, createdAt: Date.now(), liveMoney: false };
  var created = await store.setIfAbsent(key(id), task); task = await store.get(key(id));
  if (!task || task.schemaVersion !== SCHEMA || task.eventId !== eventId || task.kind !== kind) throw new Error('religion revenue task creation readback invalid');
  if (created) { await store.lpush(PENDING_KEY, { taskId: id, enqueuedAt: task.createdAt }); await store.ltrim(PENDING_KEY, 0, 999); }
  return attemptTask(Object.assign({}, input, { task: task, store: store }));
}
async function attemptTask(input) {
  input = input || {}; var store = input.store || Store, task = input.task;
  if (!task && input.taskId) task = await store.get(key(input.taskId));
  if (!task || task.schemaVersion !== SCHEMA) return { ok: false, status: 'REFUSED', reason: 'religion-revenue-task-not-found', providerCalls: 0 };
  if (['COMPLETED', 'AMBIGUOUS', 'FAILED'].indexOf(task.status) >= 0) return { ok: task.status === 'COMPLETED', status: task.status, taskId: task.taskId, replayed: true, providerCalls: 0 };
  task.attempts = Number(task.attempts || 0) + 1; task.lastAttemptAt = Date.now(); task = await persistTask(store, task);
  var result = await fulfill({ store: store, subscriber: task.subscriber, message: task.message, eventId: task.eventId, kind: task.kind,
    now: input.now, decisionDeps: input.decisionDeps, motorAuthorization: input.motorAuthorization, transport: input.transport,
    emailCostUsd: input.emailCostUsd, dailyBudgetUsd: input.dailyBudgetUsd, dailySendCap: input.dailySendCap });
  task.lastDecisionReceiptId = result.decisionReceiptId || null; task.lastActionId = result.actionId || null;
  task.lastReason = result.reason || null; task.lastBlockers = result.blockers || [];
  task.status = result.accepted > 0 ? 'COMPLETED' : result.status === 'PARTIAL_AMBIGUOUS' ? 'AMBIGUOUS'
    : result.status === 'FAILED' ? 'FAILED' : 'HELD';
  task.providerEmailId = result.items && result.items[0] && result.items[0].providerEmailId || null;
  task.completedAt = task.status === 'COMPLETED' ? Date.now() : null; await persistTask(store, task);
  return { ok: task.status === 'COMPLETED', status: task.status, taskId: task.taskId, decisionReceiptId: task.lastDecisionReceiptId,
    actionId: task.lastActionId, reason: task.lastReason, blockers: task.lastBlockers, providerEmailId: task.providerEmailId,
    providerCalls: result.providerCalls || 0, liveMoney: false };
}
async function retryRecent(input) {
  input = input || {}; var store = input.store || Store, refs = await store.lrange(PENDING_KEY, 0, 99), results = [], seen = {};
  for (var i = 0; i < refs.length; i++) {
    var id = refs[i] && refs[i].taskId; if (!id || seen[id]) continue; seen[id] = true;
    var task = await store.get(key(id)); if (!task || ['PENDING', 'HELD'].indexOf(task.status) < 0) continue;
    results.push(await attemptTask(Object.assign({}, input, { store: store, task: task })));
  }
  return results;
}
module.exports = { SCHEMA: SCHEMA, PREFIX: PREFIX, PENDING_KEY: PENDING_KEY, key: key, taskId: taskId,
  fulfill: fulfill, enqueueAndAttempt: enqueueAndAttempt, attemptTask: attemptTask, retryRecent: retryRecent };
