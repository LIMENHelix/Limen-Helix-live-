'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Fulfillment = require('../lib/g0-desk-fulfillment.js');
var CronAuth = require('../lib/cron-auth.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var retry = deps.retry || Fulfillment.retryRecent;
  return async function (req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    if (!CronAuth.enforce(req, res)) return;
    try {
      var results = await retry({ store: store, now: Date.now() });
      return send(res, 200, {
        ok: true, schemaVersion: 'g0-desk-fulfillment-retry/1.0',
        attempted: results.length,
        completed: results.filter(function (r) { return r.status === 'COMPLETED'; }).length,
        results: results, liveMoney: false, humanApprovalRequired: false
      });
    } catch (error) {
      return send(res, 503, {
        ok: false, error: 'g0-desk-fulfillment-retry-failed',
        detail: String(error && error.message || error), liveMoney: false
      });
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('g0-desk-fulfillment', handler);
module.exports.createHandler = createHandler;
