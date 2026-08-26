'use strict';
var AdminGate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/religion-subscriber-executor.js');
var Observer = require('../lib/religion-subscriber-outcome-observer.js');
var Recovery = require('../lib/religion-subscriber-recovery.js');
function bodyOf(req) { if (!req.body) return {}; return typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
function createHandler(deps) {
  deps = deps || {}; var gate = deps.adminGate || AdminGate, store = deps.store || Store, recovery = deps.recovery || Recovery;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.setHeader('Access-Control-Allow-Headers', 'content-type,x-limen-pass');
    if (String(req.method || '').toUpperCase() !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }
    var pass = gate.reqKey(req); if (!gate.hasDomain(pass, 'religion')) return gate.deny(res);
    try {
      var body = bodyOf(req), command = await store.get(Executor.commandKey(body.commandId));
      var item = command && (command.items || []).find(function (x) { return x.actionId === body.actionId; });
      var observation = item && item.providerEmailId ? await store.get(Observer.key(item.providerEmailId)) : null;
      var result = await recovery.recover({ store: store, command: command, actionId: body.actionId, observation: observation, trigger: body.trigger, now: Date.now() });
      res.statusCode = result.status === 'REFUSED' ? 400 : 200; return res.end(JSON.stringify(result));
    } catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'religion-subscriber-recovery-unavailable', detail: String(error && error.message || error), liveMoney: false })); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('religion-subscriber-recovery', handler); module.exports.createHandler = createHandler;
