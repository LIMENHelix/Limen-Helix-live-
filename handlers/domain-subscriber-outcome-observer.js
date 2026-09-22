'use strict';

/** Shared observer clock over separately namespaced domain observer organs. */
var CronAuth = require('../lib/cron-auth.js');
var Factory = require('../lib/sovereign-subscriber-route-handlers.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/sovereign-domain-subscriber-lanes.js');
var Fulfillment = require('./domain-subscriber-fulfillment.js');
var Silence = require('../lib/subscriber-delivery-health.js');

function responseCapture() {
  return { statusCode: 200, headers: {}, setHeader: function (key, value) { this.headers[key] = value; },
    end: function (body) { this.body = body || '{}'; this.json = JSON.parse(this.body); } };
}
async function run(deps) {
  deps = deps || {};
  var store = deps.store || Store, now = Number(deps.now) || Date.now();
  store.assertDurable();
  var domains = deps.domains || Fulfillment.selected(now), rows = [];
  for (var i = 0; i < domains.length; i++) {
    var lane = Lanes.get(domains[i]);
    if (!lane) { rows.push({ productDomain: domains[i], status: 'FAILED', reason: 'domain-lane-missing' }); continue; }
    var subDeps = Object.assign({}, deps, { store: store, cronAuth: { enforce: function () { return true; } }, maxProviderReads: 6 });
    var res = responseCapture();
    try {
      await Factory.observer(lane, subDeps)({ method: 'GET', headers: {} }, res);
      rows.push({ productDomain: lane.config.productDomain, ownerDomain: lane.config.ownerDomain,
        status: res.json && (res.json.status || (res.json.ok ? 'OBSERVED' : 'FAILED')) || 'FAILED',
        providerReadAttempts: Number(res.json && res.json.providerReadAttempts || 0),
        learned: Number(res.json && res.json.learned || 0), reason: res.json && res.json.reason || null });
    } catch (error) {
      rows.push({ productDomain: lane.config.productDomain, ownerDomain: lane.config.ownerDomain,
        status: 'FAILED', providerReadAttempts: 0, learned: 0, reason: String(error && error.message || error) });
    }
  }
  // Silence watchdog (PR-007): same cron, one extra pass over EVERY domain with an
  // active subscriber — not only today's rotation — comparing the digest-recorded
  // delivery health against SUBSCRIBER_SILENCE_DAYS. A store outage records an
  // explicit UNKNOWN state here and in the health store rather than reading as
  // silence; it never raises an exception it cannot ground. The pass is reported
  // on the payload but does not change `ok`: an open silence exception is a
  // finding, not an observer malfunction.
  var silence = null;
  try {
    silence = await Silence.check({ store: store, now: now, env: deps.env });
  } catch (error) {
    silence = { ok: false, status: 'UNKNOWN', reason: String(error && error.message || error), raised: [], cleared: [] };
  }
  return { ok: rows.every(function (row) { return row.status !== 'FAILED'; }),
    schemaVersion: 'domain-subscriber-outcome-observer-cycle/1.0', evaluatedAt: now,
    rotationWidth: 7, domains: rows,
    silence: silence,
    providerReadAttempts: rows.reduce(function (sum, row) { return sum + Number(row.providerReadAttempts || 0); }, 0),
    learned: rows.reduce(function (sum, row) { return sum + Number(row.learned || 0); }, 0) };
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
var wrapped = require('../lib/heartbeat').wrap('domain-subscriber-outcome-observer', handler);
wrapped.createHandler = createHandler; wrapped.run = run;
module.exports = wrapped;
