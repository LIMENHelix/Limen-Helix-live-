'use strict';

/** Prepare durable, source-linked artifacts from each domain's own work order. */
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/domain-commercial-lanes.js');
var Artifact = require('../lib/domain-commercial-artifact.js');

async function nextPlannedState(store, contract, now) {
  var queued = typeof store.lrange === 'function' ? await store.lrange(contract.intentQueue, 0, 49) : [];
  var eligible = queued.filter(function (state) {
    return state && state.schemaVersion === 'domain-commercial-reflex/1.0' && state.status === 'PLANNED' &&
      state.productDomain === contract.productDomain && state.ownerDomain === contract.ownerDomain && state.intent &&
      Artifact.validateReflex(contract, state, now) === null;
  }).sort(function (a, b) { return Number(b.evaluatedAt || 0) - Number(a.evaluatedAt || 0); });
  if (eligible.length) return eligible[0];
  // Migration compatibility only: deployments created before the durable
  // queue may still have one valid planned state at the observation key.
  var current = await store.get(contract.stateKey);
  return current && current.status === 'PLANNED' ? current : null;
}

async function run(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var now = Number.isFinite(Number(deps.now)) ? Number(deps.now) : Date.now();
  store.assertDurable();
  var rows = [];
  for (var i = 0; i < Lanes.DOMAINS.length; i++) {
    var lane = Lanes.get(Lanes.DOMAINS[i]);
    try {
      var state = await nextPlannedState(store, lane.contract, now);
      var result = Artifact.build(lane.contract, state, now);
      var persisted = await Artifact.persist(store, lane.contract, result);
      if (persisted && persisted.status === 'ARTIFACT_PREPARED' && state && state.status === 'PLANNED') {
        if (typeof store.lrem !== 'function') throw new Error('strict durable queue acknowledgement required');
        await store.lrem(lane.contract.intentQueue, 0, state);
      }
      rows.push({
        productDomain: lane.contract.productDomain,
        ownerDomain: lane.contract.ownerDomain,
        status: persisted.status,
        reason: persisted.reason || null,
        artifactId: persisted.artifactId || persisted.artifact && persisted.artifact.artifactId || null,
        intentId: persisted.intentId || persisted.artifact && persisted.artifact.intentId || null,
        externalEffectAuthorized: false
      });
    } catch (error) {
      rows.push({ productDomain: lane.contract.productDomain, ownerDomain: lane.contract.ownerDomain,
        status: 'FAILED', reason: String(error && error.message || error).slice(0, 240),
        artifactId: null, intentId: null, externalEffectAuthorized: false });
    }
  }
  var prepared = rows.filter(function (row) { return row.status === 'ARTIFACT_PREPARED'; }).length;
  var failed = rows.filter(function (row) { return row.status === 'FAILED'; }).length;
  return {
    ok: failed === 0,
    schemaVersion: 'domain-commercial-artifact-prep-cycle/1.0',
    evaluatedAt: now,
    domains: rows.length,
    prepared: prepared,
    abstained: rows.length - prepared - failed,
    failed: failed,
    rows: rows,
    boundaries: { modelCalled: false, externalProviderCalled: false, externalEffectAuthorized: false,
      liveMoney: false, durableArtifactOnly: true }
  };
}

function createHandler(deps) {
  deps = deps || {};
  var auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    if (!auth.enforce(req, res)) return;
    var result = await run(deps);
    res.statusCode = result.ok ? 200 : 503;
    return res.end(JSON.stringify(result));
  };
}

var handler = createHandler();
var wrapped = require('../lib/heartbeat').wrap('domain-commercial-artifact-prep', handler);
wrapped.createHandler = createHandler;
wrapped.run = run;
wrapped.nextPlannedState = nextPlannedState;
module.exports = wrapped;
