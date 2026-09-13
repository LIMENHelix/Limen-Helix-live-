'use strict';

/**
 * HTTP/cron transport shells for one already-bound sovereign subscriber lane.
 * The caller supplies an immutable lane instance; this module never chooses a
 * domain and cannot move a receipt, budget, observation, or recovery between
 * domains.
 */
var CronAuth = require('./cron-auth.js');
var AdminGate = require('./admin-gate.js');
var Store = require('./autofire-efference-store.js');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}

function bodyOf(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function fulfillment(lane, deps) {
  deps = deps || {};
  var store = deps.store || Store, auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { ok: false, error: 'GET only' });
    }
    if (!auth.enforce(req, res)) return;
    try {
      var results = await lane.fulfillment.retryRecent({
        store: store,
        now: Date.now(),
        env: deps.env,
        decisionDeps: deps.decisionDeps,
        authorizationDeps: deps.authorizationDeps,
        motorAuthorization: deps.motorAuthorization,
        adapterGuard: deps.adapterGuard,
        transport: deps.transport
      });
      return json(res, 200, {
        ok: true,
        schemaVersion: lane.config.productDomain + '-revenue-fulfillment-cycle/1.0',
        productDomain: lane.config.productDomain,
        ownerDomain: lane.config.ownerDomain,
        inspected: results.length,
        completed: results.filter(function (row) { return row.status === 'COMPLETED'; }).length,
        held: results.filter(function (row) { return row.status === 'HELD'; }).length,
        providerCalls: results.reduce(function (n, row) { return n + Number(row.providerCalls || 0); }, 0),
        results: results,
        liveMoney: false
      });
    } catch (error) {
      return json(res, 503, { ok: false, error: lane.config.productDomain + '-revenue-fulfillment-unavailable',
        detail: String(error && error.message || error), providerCalls: 0, liveMoney: false });
    }
  };
}

function observer(lane, deps) {
  deps = deps || {};
  var store = deps.store || Store, auth = deps.cronAuth || CronAuth, env = deps.env || process.env;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { ok: false, error: 'GET only' });
    }
    if (!auth.enforce(req, res)) return;
    if (String(env[lane.config.envNames.observerEnabled] || '') !== '1') {
      return json(res, 200, { ok: true, status: 'HELD',
        reason: lane.config.productDomain + '-subscriber-outcome-observer-switch-closed',
        productDomain: lane.config.productDomain, sendEndpointCalled: false, liveMoney: false });
    }
    try {
      store.assertDurable();
      var observerDeps = { fetch: deps.fetch || global.fetch, apiKey: deps.apiKey };
      var observations = [], inspected = 0, seen = {};
      var learned = 0, duplicates = 0, abstentions = [], recoveries = [], recoveryHolds = [];
      /* A read can consume the 15-second observer timeout. Forty immediate
         read->learn->recover iterations stay below the 800-second function cap. */
      for (var i = 0; i < 40; i++) {
        var pending = await lane.observer.observeNext(store, observerDeps, seen);
        if (pending.cycleComplete) break;
        inspected++;
        if (pending.skipped) continue;
        var observation = pending.observation;
        observations.push(observation);
        if (!observation || observation.schemaVersion !== lane.observer.SCHEMA) {
          abstentions.push(observation); continue;
        }
        var result = await lane.learning.recordObservation(store, observation);
        if (result.ok && result.duplicate) duplicates++;
        else if (result.ok) learned++;
        else abstentions.push(result);
        var downstreamComplete = result.ok === true;
        if (lane.recovery.NEGATIVE[observation.lastEvent]) {
          var command = await store.get(lane.executor.commandKey(observation.commandId));
          var recovered = await lane.recovery.recover({ store: store, command: command,
            actionId: observation.actionId, observation: observation, now: Date.now(), env: env });
          if (recovered.status === 'FUTURE_DELIVERY_SUPPRESSED') recoveries.push(recovered);
          else { downstreamComplete = false; recoveryHolds.push(recovered); }
        }
        if (lane.observer.isResolved(observation.lastEvent) && downstreamComplete) {
          await lane.observer.acknowledge(store, pending.pendingRef);
        }
      }
      return json(res, 200, {
        ok: true,
        schemaVersion: lane.config.productDomain + '-subscriber-observer-cycle/1.0',
        productDomain: lane.config.productDomain,
        ownerDomain: lane.config.ownerDomain,
        inspectedPendingOutcomes: inspected,
        observations: observations,
        learned: learned,
        duplicates: duplicates,
        learningAbstentions: abstentions,
        recoveries: recoveries.length,
        recoveryHolds: recoveryHolds,
        sendEndpointCalled: false,
        liveMoney: false
      });
    } catch (error) {
      return json(res, 503, { ok: false, error: lane.config.productDomain + '-subscriber-observer-unavailable',
        detail: String(error && error.message || error), sendEndpointCalled: false, liveMoney: false });
    }
  };
}

function recovery(lane, deps) {
  deps = deps || {};
  var store = deps.store || Store, gate = deps.adminGate || AdminGate;
  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Headers', 'content-type,x-limen-pass');
    if (String(req.method || '').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { ok: false, error: 'POST only' });
    }
    var pass = gate.reqKey(req);
    if (!gate.hasDomain(pass, lane.config.ownerDomain)) return gate.deny(res);
    try {
      var body = bodyOf(req);
      var command = await store.get(lane.executor.commandKey(body.commandId));
      var item = command && (command.items || []).find(function (row) { return row.actionId === body.actionId; });
      var observation = item && item.providerEmailId ? await store.get(lane.observer.key(item.providerEmailId)) : null;
      var result = await lane.recovery.recover({ store: store, command: command, actionId: body.actionId,
        observation: observation, trigger: body.trigger, now: Date.now(), env: deps.env });
      return json(res, result.status === 'REFUSED' ? 400 : 200, result);
    } catch (error) {
      return json(res, 503, { ok: false, error: lane.config.productDomain + '-subscriber-recovery-unavailable',
        detail: String(error && error.message || error), liveMoney: false });
    }
  };
}

module.exports = { fulfillment: fulfillment, observer: observer, recovery: recovery };
