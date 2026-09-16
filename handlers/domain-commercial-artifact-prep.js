'use strict';

/** Prepare durable, source-linked artifacts from each domain's own work order. */
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/domain-commercial-lanes.js');
var Artifact = require('../lib/domain-commercial-artifact.js');
var CycleObservability = require('../lib/autonomy-cycle-observability.js');

async function nextPlannedState(store, contract, now) {
  var queued = typeof store.lrange === 'function' ? await store.lrange(contract.intentQueue, 0, 49) : [];
  var eligible = queued.filter(function (state) {
    return state && state.schemaVersion === 'domain-commercial-reflex/1.0' && state.status === 'PLANNED' &&
      state.productDomain === contract.productDomain && state.ownerDomain === contract.ownerDomain && state.intent &&
      Artifact.validateReflex(contract, state, now) === null;
  }).sort(comparePlans);
  if (eligible.length) return eligible[0];
  // Migration compatibility only: deployments created before the durable
  // queue may still have one valid planned state at the observation key.
  var current = await store.get(contract.stateKey);
  if (!current || current.status !== 'PLANNED' || !current.intent) return null;
  // A successful preparation consumes the plan even though the mutable
  // observation remains PLANNED for provenance.  Never let that compatibility
  // observation manufacture a new freshness generation for consumed work.
  var latest = await store.get(contract.artifactStateKey);
  if (samePreparedIntent(latest, current, contract)) return null;
  var history = typeof store.lrange === 'function' ? await store.lrange(contract.artifactLog, 0, 199) : [];
  if (history.some(function (row) { return samePreparedIntent(row, current, contract); })) return null;
  return current;
}

function samePreparedIntent(artifact, state, contract) {
  return !!(artifact && state && state.intent &&
    artifact.productDomain === contract.productDomain && artifact.ownerDomain === contract.ownerDomain &&
    artifact.intentId === state.intent.intentId &&
    (!artifact.status || artifact.status === 'ARTIFACT_PREPARED'));
}

function comparePlans(a, b) {
  var evaluated = Number(b && b.evaluatedAt || 0) - Number(a && a.evaluatedAt || 0);
  if (evaluated) return evaluated;
  var planned = Number(b && b.intent && b.intent.plannedAt || 0) - Number(a && a.intent && a.intent.plannedAt || 0);
  if (planned) return planned;
  return String(b && b.intent && b.intent.intentId || '').localeCompare(
    String(a && a.intent && a.intent.intentId || ''));
}

async function acknowledgePreparedPlan(store, contract, preparedState) {
  if (typeof store.lrange !== 'function' || typeof store.lrem !== 'function') {
    throw new Error('strict durable queue acknowledgement required');
  }
  var queued = await store.lrange(contract.intentQueue, 0, 199);
  var removable = queued.filter(function (state) {
    return state && state.schemaVersion === 'domain-commercial-reflex/1.0' &&
      state.productDomain === contract.productDomain && state.ownerDomain === contract.ownerDomain &&
      comparePlans(state, preparedState) >= 0;
  });
  var removed = 0;
  for (var i = 0; i < removable.length; i++) removed += Number(await store.lrem(contract.intentQueue, 0, removable[i]) || 0);
  return removed;
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
      if (persisted && persisted.status === 'ARTIFACT_PREPARED' && state && state.status === 'PLANNED' &&
          persisted.productDomain === lane.contract.productDomain && persisted.ownerDomain === lane.contract.ownerDomain &&
          (persisted.intentId === state.intent.intentId ||
            Number(persisted.sourcePlannedAt) > Number(state.intent.plannedAt)) &&
          Number.isFinite(Number(persisted.freshnessExpiresAt)) &&
          Number(persisted.freshnessExpiresAt) > now) {
        // The newest successfully prepared plan supersedes older queued plans.
        // Preserve only work that arrived later while this preparation ran.
        // Otherwise an old backlog item can replace current customer inventory
        // on the next cycle and suppress fulfillment until the queue drains.
        await acknowledgePreparedPlan(store, lane.contract, state);
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
  var result = {
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
  CycleObservability.emit('domain-commercial-artifact-prep', result, deps.cycleLogger);
  return result;
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
wrapped.acknowledgePreparedPlan = acknowledgePreparedPlan;
wrapped.comparePlans = comparePlans;
wrapped.samePreparedIntent = samePreparedIntent;
module.exports = wrapped;
