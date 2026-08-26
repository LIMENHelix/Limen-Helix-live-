'use strict';
var CronAuth = require('../lib/cron-auth.js'); var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/law-automail-executor.js'); var Observer = require('../lib/law-automail-outcome-observer.js');
function createHandler(deps) { deps = deps || {}; var store = deps.store || Store, observer = deps.observer || Observer, auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    if (!auth.enforce(req, res)) return;
    try { var commands = await store.lrange(Executor.LOG_KEY, 0, 99), observations = await observer.observeRecent(store, commands, { fetch: deps.fetch || global.fetch, apiKey: deps.apiKey });
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, schemaVersion: 'law-automail-observer-cycle/1.0', inspectedCommands: commands.length,
        observations: observations, createEndpointCalled: false, liveMoney: false })); }
    catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'law-automail-observer-unavailable', detail: String(error && error.message || error), createEndpointCalled: false, liveMoney: false })); } };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('law-automail-outcome-observer', handler); module.exports.createHandler = createHandler;
