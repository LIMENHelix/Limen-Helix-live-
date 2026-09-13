'use strict';

/**
 * Soft 3 + Civic Watch fulfillment on G0. Religion and Finance keep their
 * own motors. This path never borrows another domain's brain.
 */

var crypto = require('node:crypto');
var Lanes = require('./g0-lane-registry.js');
var Digest = require('./digest.js');
var Comprehension = require('./g0-domain-comprehension.js');
var Orientation = require('./g0-orientation.js');
var Envelope = require('./g0-action-envelope.js');
var Actuator = require('./g0-actuator.js');
var Afferent = require('./g0-desk-afferent.js');
var Store = require('./autofire-efference-store.js');

var SCHEMA = 'g0-desk-fulfillment/1.0';
var PREFIX = 'g0_desk_fulfillment:';
var PENDING_KEY = 'g0_desk_fulfillment_pending';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function owns(domain) {
  var id = String(domain || '').toLowerCase();
  return Lanes.scoped(id) && id !== 'religion';
}
function taskId(eventId, kind) { return 'g0df_' + hash({ eventId: eventId, kind: kind }).slice(0, 24); }
function key(id) { return PREFIX + id; }

async function persistTask(store, task) {
  await store.set(key(task.taskId), task);
  var restored = await store.get(key(task.taskId));
  if (!restored || restored.taskId !== task.taskId || restored.status !== task.status) {
    throw new Error('g0 desk fulfillment readback invalid');
  }
  return restored;
}

async function fulfill(input) {
  input = input || {};
  var store = input.store || Store;
  var subscriber = input.subscriber;
  var message = input.message;
  var domain = String(subscriber && subscriber.domain || '').toLowerCase();
  if (!owns(domain)) return { ok: false, status: 'REFUSED', reason: 'g0-desk-fulfillment-domain-unowned', providerCalls: 0, liveMoney: false };
  if (!subscriber || !subscriber.active || !message || !message.subject || !message.body) {
    return { ok: false, status: 'REFUSED', reason: 'exact-paid-subscriber-fulfillment-required', providerCalls: 0, liveMoney: false };
  }
  var spec = Lanes.get(domain);
  var now = Number(input.now) || Date.now();
  await Afferent.record(store, { domainId: domain, tool: spec.deskTool, query: subscriber.watch || message.subject, now: now, resultOk: true });
  var composed = await Comprehension.compose(domain, {
    store: store, cognition: input.cognition, redisGet: input.redisGet,
    skipDefaultRedis: input.skipDefaultRedis === true, env: input.env, now: now
  });
  if (!composed.ok) return { ok: false, status: 'HELD', reason: composed.reason, providerCalls: 0, liveMoney: false };
  var oriented = await Orientation.boot(domain, {
    store: store, comprehension: composed, cognition: input.cognition,
    redisGet: input.redisGet, skipDefaultRedis: true, env: input.env, now: now
  });
  if (!oriented.ok || !Orientation.mayAct(oriented.boot, 'paper').ok) {
    return {
      ok: true, status: 'HELD', reason: oriented.reason || 'orientation-paper-not-ready',
      comprehensionReceiptId: composed.record && composed.record.comprehensionReceiptId || null,
      orientationReceiptId: oriented.boot && oriented.boot.orientationReceiptId || null,
      providerCalls: 0, liveMoney: false
    };
  }
  var payload = { domain: domain, kind: input.kind || 'welcome', subject: message.subject, email: subscriber.email };
  var sealed = Envelope.seal({
    domainId: domain,
    laneId: spec.lane,
    action: 'desk-watch-fulfillment',
    payloadHash: Envelope.hash(payload),
    idempotencyKey: 'g0-desk/' + domain + '/' + String(input.eventId || message.subject),
    decisionReceiptId: 'g0-desk-decision:' + domain,
    authorizationReceiptId: 'g0-desk-auth:' + domain,
    comprehensionReceiptId: composed.record.comprehensionReceiptId,
    orientationReceiptId: oriented.boot.orientationReceiptId,
    rollbackReference: spec.rollbackClass,
    outcomeObserverIdentity: spec.observerIdentity,
    budgetAuthorization: { budgetId: spec.budgetId, paperOnly: true, liveMoney: false, spendUsd: 0 },
    affectedDomains: [domain],
    now: now
  });
  if (!sealed.ok) return { ok: false, status: 'HELD', reason: sealed.reason, providerCalls: 0, liveMoney: false };
  var executed = await Actuator.execute({
    store: store,
    envelope: sealed.envelope,
    orientation: oriented.boot,
    provider: input.provider || {
      dispatch: async function () {
        return { ok: true, providerCalled: false, providerReceiptId: 'desk-paper-' + domain };
      }
    },
    adapterGuard: input.adapterGuard || { checkpoint: async function () { return { allowed: true, valveId: spec.valveId }; } },
    now: now
  });
  var providerCalls = 0;
  var providerEmailId = null;
  if (oriented.boot.liveReady === true && input.transport && typeof input.transport.send === 'function') {
    var sent = await input.transport.send(subscriber.email, message.subject, message.body, {
      idempotencyKey: 'g0-desk/' + domain + '/' + executed.commandId
    });
    providerCalls = 1;
    providerEmailId = sent && sent.id || null;
  }
  return {
    ok: executed.status === 'EXECUTED',
    status: executed.status === 'EXECUTED' ? (providerCalls ? 'COMPLETED' : 'COMPLETED') : 'HELD',
    accepted: executed.status === 'EXECUTED' ? 1 : 0,
    decisionReceiptId: sealed.envelope.decisionReceiptId,
    actionId: executed.commandId || null,
    envelopeId: sealed.envelope.envelopeId,
    comprehensionReceiptId: composed.record.comprehensionReceiptId,
    orientationReceiptId: oriented.boot.orientationReceiptId,
    providerEmailId: providerEmailId,
    providerCalls: providerCalls,
    liveMoney: false
  };
}

async function enqueueAndAttempt(input) {
  input = input || {};
  var store = input.store || Store;
  var eventId = String(input.eventId || '').trim();
  var kind = String(input.kind || '').trim();
  if (!eventId || ['welcome', 'renewal'].indexOf(kind) < 0 || !input.subscriber || !input.message) {
    return { ok: false, status: 'REFUSED', reason: 'exact-g0-desk-fulfillment-task-required', providerCalls: 0 };
  }
  if (!owns(input.subscriber.domain)) {
    return { ok: false, status: 'REFUSED', reason: 'g0-desk-fulfillment-domain-unowned', providerCalls: 0 };
  }
  store.assertDurable();
  var id = taskId(eventId, kind);
  var task = {
    schemaVersion: SCHEMA, taskId: id, eventId: eventId, kind: kind,
    subscriber: input.subscriber, message: input.message, status: 'PENDING',
    attempts: 0, createdAt: Date.now(), liveMoney: false
  };
  var created = await store.setIfAbsent(key(id), task);
  task = await store.get(key(id));
  if (!task || task.eventId !== eventId || task.kind !== kind) throw new Error('g0 desk task creation readback invalid');
  if (created) {
    await store.lpush(PENDING_KEY, { taskId: id, enqueuedAt: task.createdAt });
    await store.ltrim(PENDING_KEY, 0, 999);
  }
  return attemptTask(Object.assign({}, input, { task: task, store: store }));
}

async function attemptTask(input) {
  input = input || {};
  var store = input.store || Store;
  var task = input.task;
  if (!task && input.taskId) task = await store.get(key(input.taskId));
  if (!task || task.schemaVersion !== SCHEMA) return { ok: false, status: 'REFUSED', reason: 'g0-desk-task-not-found', providerCalls: 0 };
  if (['COMPLETED', 'AMBIGUOUS', 'FAILED'].indexOf(task.status) >= 0) {
    return { ok: task.status === 'COMPLETED', status: task.status, taskId: task.taskId, replayed: true, providerCalls: 0 };
  }
  task.attempts = Number(task.attempts || 0) + 1;
  task.lastAttemptAt = Date.now();
  task = await persistTask(store, task);
  var result = await fulfill(Object.assign({}, input, {
    store: store, subscriber: task.subscriber, message: task.message, eventId: task.eventId, kind: task.kind
  }));
  task.lastDecisionReceiptId = result.decisionReceiptId || null;
  task.lastActionId = result.actionId || null;
  task.lastReason = result.reason || null;
  task.status = result.accepted > 0 ? 'COMPLETED' : result.status === 'FAILED' ? 'FAILED' : 'HELD';
  task.providerEmailId = result.providerEmailId || null;
  task.completedAt = task.status === 'COMPLETED' ? Date.now() : null;
  await persistTask(store, task);
  return {
    ok: task.status === 'COMPLETED', status: task.status, taskId: task.taskId,
    decisionReceiptId: task.lastDecisionReceiptId, actionId: task.lastActionId,
    reason: task.lastReason, providerEmailId: task.providerEmailId,
    providerCalls: result.providerCalls || 0, liveMoney: false
  };
}

async function retryRecent(input) {
  input = input || {};
  var store = input.store || Store;
  var refs = await store.lrange(PENDING_KEY, 0, 99);
  var results = [], seen = {};
  for (var i = 0; i < (refs || []).length; i++) {
    var id = refs[i] && refs[i].taskId;
    if (!id || seen[id]) continue;
    seen[id] = true;
    var task = await store.get(key(id));
    if (!task || ['PENDING', 'HELD'].indexOf(task.status) < 0) continue;
    results.push(await attemptTask(Object.assign({}, input, { store: store, task: task })));
  }
  return results;
}

async function buildMessage(subscriber) {
  var built = await Digest.buildFor(subscriber);
  if (built) return built;
  return {
    subject: 'Your ' + subscriber.domain + ' watch is on',
    body: 'The free desk you used is now watched on each source refresh.\n\nCheck any figure: https://limenhelix.com/' + subscriber.domain,
    key: 'g0-desk-fallback'
  };
}

module.exports = {
  SCHEMA: SCHEMA, PREFIX: PREFIX, PENDING_KEY: PENDING_KEY, owns: owns, key: key, taskId: taskId,
  fulfill: fulfill, enqueueAndAttempt: enqueueAndAttempt, attemptTask: attemptTask,
  retryRecent: retryRecent, buildMessage: buildMessage
};
