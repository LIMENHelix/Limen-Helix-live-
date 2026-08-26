'use strict';

/** Admin may request review; a fresh Culture motor receipt remains the action authority. */
var AdminGate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/culture-hero-executor.js');
var Observer = require('../lib/culture-hero-outcome-observer.js');
var Recovery = require('../lib/culture-hero-recovery.js');
function bodyOf(req) { if (!req.body) return {}; return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
function createHandler(deps) {
  deps = deps || {};
  var gate = deps.adminGate || AdminGate, store = deps.store || Store, recovery = deps.recovery || Recovery;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    res.setHeader('Access-Control-Allow-Headers', 'content-type,x-limen-pass');
    if (String(req.method || '').toUpperCase() !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }
    var pass = gate.reqKey(req); if (!gate.hasDomain(pass, 'culture')) return gate.deny(res);
    try {
      var body = bodyOf(req), command = await store.get(Executor.commandKey(body.commandId));
      var observation = await store.get(Observer.key(body.commandId));
      var result = await recovery.recover({ store: store, command: command, observation: observation,
        trigger: body.trigger, now: Date.now(),
        observePublicCatalog: deps.observePublicCatalog || async function () {
          var r = await (deps.fetch || global.fetch)('https://limenhelix.com/api/hero-image?list=1', { headers: { accept: 'application/json' } });
          return r.json();
        } });
      res.statusCode = result.status === 'REFUSED' ? 400 : 200; return res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'culture-hero-recovery-unavailable', detail: String(error && error.message || error), liveMoney: false }));
    }
  };
}
var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('culture-hero-recovery', handler);
module.exports.createHandler = createHandler;
