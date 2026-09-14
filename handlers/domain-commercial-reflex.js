'use strict';

/**
 * Scheduled shared clock for twenty separate domain commercial reflexes.
 *
 * The loop has no cross-domain chooser and performs no external effect.  It
 * reconstructs each lane from that domain's current cognition and persists a
 * separate write-ahead intent under that domain's own namespace.
 */

var CronAuth = require('../lib/cron-auth.js');
var Redis = require('../lib/redis-kv.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/domain-commercial-lanes.js');

async function run(deps) {
  deps = deps || {};
  var redisGet = deps.redisGet || Redis.redisGet;
  var store = deps.store || Store;
  var now = Number.isFinite(Number(deps.now)) ? Number(deps.now) : Date.now();
  store.assertDurable();
  var rows = [];
  for (var i = 0; i < Lanes.DOMAINS.length; i++) {
    var domain = Lanes.DOMAINS[i];
    var lane = Lanes.get(domain);
    try {
      var pair = await Promise.all([
        redisGet('limen:brain:cognition:' + domain),
        store.get(lane.contract.stateKey)
      ]);
      var evaluated = lane.evaluate(pair[0], pair[1], now);
      var persisted = await lane.persist(store, evaluated);
      rows.push({
        productDomain: domain,
        ownerDomain: lane.contract.ownerDomain,
        status: persisted.status,
        reason: persisted.reason || null,
        priority: persisted.priority == null ? null : persisted.priority,
        selectedProgram: persisted.intent && persisted.intent.selectedProgram || null,
        intentId: persisted.intent && persisted.intent.intentId || null,
        packetId: persisted.packetId || null,
        externalEffectAuthorized: false
      });
    } catch (error) {
      rows.push({
        productDomain: domain,
        ownerDomain: lane.contract.ownerDomain,
        status: 'FAILED',
        reason: String(error && error.message || error).slice(0, 240),
        priority: null,
        selectedProgram: null,
        intentId: null,
        packetId: null,
        externalEffectAuthorized: false
      });
    }
  }
  var planned = rows.filter(function (row) { return row.status === 'PLANNED'; }).length;
  var abstained = rows.filter(function (row) { return row.status === 'ABSTAINED'; }).length;
  var failed = rows.filter(function (row) { return row.status === 'FAILED'; }).length;
  return {
    ok: failed === 0,
    schemaVersion: 'domain-commercial-reflex-cycle/1.0',
    evaluatedAt: now,
    domains: rows.length,
    planned: planned,
    abstained: abstained,
    failed: failed,
    rows: rows,
    boundaries: {
      modelCalled: false,
      providerCalled: false,
      externalEffectAuthorized: false,
      liveMoney: false,
      writeAheadIntentOnly: true
    }
  };
}

function createHandler(deps) {
  deps = deps || {};
  var cronAuth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    if (!cronAuth.enforce(req, res)) return;
    var result = await run(deps);
    res.statusCode = result.ok ? 200 : 503;
    return res.end(JSON.stringify(result));
  };
}

var handler = createHandler();
var wrapped = require('../lib/heartbeat').wrap('domain-commercial-reflex', handler);
wrapped.createHandler = createHandler;
wrapped.run = run;
module.exports = wrapped;
