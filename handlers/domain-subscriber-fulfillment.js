'use strict';

/** Shared clock, separate domain fulfillment state machines. */
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/sovereign-domain-subscriber-lanes.js');

var DOMAINS = Object.freeze(['agriculture', 'defense', 'economy', 'energy', 'environment', 'governance',
  'industry', 'infrastructure', 'intelligence', 'law', 'population', 'science', 'technology', 'trade']);
var WIDTH = 7;

function selected(now) {
  var groups = Math.ceil(DOMAINS.length / WIDTH);
  var slot = Math.floor(Number(now) / (10 * 60 * 1000)) % groups;
  return DOMAINS.slice(slot * WIDTH, slot * WIDTH + WIDTH);
}

async function run(deps) {
  deps = deps || {};
  var store = deps.store || Store, now = Number(deps.now) || Date.now();
  store.assertDurable();
  var domains = deps.domains || selected(now), rows = [];
  for (var i = 0; i < domains.length; i++) {
    var lane = Lanes.get(domains[i]);
    if (!lane) { rows.push({ productDomain: domains[i], status: 'FAILED', reason: 'domain-lane-missing' }); continue; }
    try {
      var results = await lane.fulfillment.retryRecent({ store: store, now: now, env: deps.env,
        decisionDeps: deps.decisionDeps, authorizationDeps: deps.authorizationDeps,
        motorAuthorization: deps.motorAuthorization, adapterGuard: deps.adapterGuard, transport: deps.transport });
      rows.push({ productDomain: lane.config.productDomain, ownerDomain: lane.config.ownerDomain,
        status: 'OBSERVED', inspected: results.length,
        completed: results.filter(function (row) { return row.status === 'COMPLETED'; }).length,
        held: results.filter(function (row) { return row.status === 'HELD'; }).length,
        providerCalls: results.reduce(function (sum, row) { return sum + Number(row.providerCalls || 0); }, 0) });
    } catch (error) {
      rows.push({ productDomain: lane.config.productDomain, ownerDomain: lane.config.ownerDomain,
        status: 'FAILED', reason: String(error && error.message || error), providerCalls: 0 });
    }
  }
  return { ok: rows.every(function (row) { return row.status !== 'FAILED'; }),
    schemaVersion: 'domain-subscriber-fulfillment-cycle/1.0', evaluatedAt: now,
    rotationWidth: WIDTH, domains: rows, providerCalls: rows.reduce(function (sum, row) { return sum + Number(row.providerCalls || 0); }, 0) };
}

function createHandler(deps) {
  deps = deps || {}; var auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    if (!auth.enforce(req, res)) return;
    var result = await run(deps); res.statusCode = result.ok ? 200 : 503; return res.end(JSON.stringify(result));
  };
}
var handler = createHandler();
var wrapped = require('../lib/heartbeat').wrap('domain-subscriber-fulfillment', handler);
wrapped.createHandler = createHandler; wrapped.run = run; wrapped.selected = selected; wrapped.DOMAINS = DOMAINS;
module.exports = wrapped;
