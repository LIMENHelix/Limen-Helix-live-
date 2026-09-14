'use strict';

/** Prepare exact-domain short-video work orders without rendering or upload. */
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/domain-commercial-lanes.js');
var VideoManifest = require('../lib/domain-commercial-video-manifest.js');

async function one(store, domain, now) {
  var lane = Lanes.get(domain);
  try {
    var pair = await Promise.all([store.get(lane.contract.stateKey), store.get(lane.contract.artifactStateKey)]);
    var result = VideoManifest.build(lane.contract, pair[0], pair[1], now);
    var persisted = await VideoManifest.persist(store, lane.contract, result);
    return { productDomain: domain, ownerDomain: lane.contract.ownerDomain,
      status: persisted.status, reason: persisted.reason || null,
      manifestId: persisted.manifestId || persisted.manifest && persisted.manifest.manifestId || null,
      sourceArtifactId: persisted.sourceArtifactId || persisted.manifest && persisted.manifest.sourceArtifactId || null,
      rendererCalled: false, uploaderCalled: false, externalEffectAuthorized: false };
  } catch (error) {
    return { productDomain: domain, ownerDomain: lane.contract.ownerDomain, status: 'FAILED',
      reason: String(error && error.message || error).slice(0, 240), manifestId: null,
      sourceArtifactId: null, rendererCalled: false, uploaderCalled: false, externalEffectAuthorized: false };
  }
}

async function run(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var now = Number.isFinite(Number(deps.now)) ? Number(deps.now) : Date.now();
  store.assertDurable();
  var rows = await Promise.all(Lanes.DOMAINS.map(function (domain) { return one(store, domain, now); }));
  var prepared = rows.filter(function (row) { return row.status === 'VIDEO_MANIFEST_PREPARED'; }).length;
  var failed = rows.filter(function (row) { return row.status === 'FAILED'; }).length;
  return { ok: failed === 0, schemaVersion: 'domain-video-manifest-prep-cycle/1.0', evaluatedAt: now,
    domains: rows.length, prepared: prepared, abstained: rows.length - prepared - failed, failed: failed, rows: rows,
    boundaries: { modelCalled: false, rendererCalled: false, uploaderCalled: false,
      providerCalled: false, externalEffectAuthorized: false, liveMoney: false } };
}

function createHandler(deps) {
  deps = deps || {};
  var auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
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
var wrapped = require('../lib/heartbeat').wrap('domain-video-manifest-prep', handler);
wrapped.createHandler = createHandler;
wrapped.run = run;
wrapped.one = one;
module.exports = wrapped;
