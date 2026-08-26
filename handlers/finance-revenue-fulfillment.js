'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Fulfillment = require('../lib/finance-revenue-fulfillment.js');
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, fulfillment = deps.fulfillment || Fulfillment, auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    if (!auth.enforce(req, res)) return;
    try {
      var results = await fulfillment.retryRecent({ store: store, now: Date.now() });
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, schemaVersion: 'finance-revenue-fulfillment-cycle/1.0',
        inspected: results.length, completed: results.filter(function (x) { return x.status === 'COMPLETED'; }).length,
        held: results.filter(function (x) { return x.status === 'HELD'; }).length,
        providerCalls: results.reduce(function (n, x) { return n + Number(x.providerCalls || 0); }, 0), results: results, liveMoney: false }));
    } catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'finance-revenue-fulfillment-unavailable', detail: String(error && error.message || error), liveMoney: false })); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('finance-revenue-fulfillment', handler); module.exports.createHandler = createHandler;
