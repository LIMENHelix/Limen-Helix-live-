'use strict';

/** Operator requests evaluation; only Communication's fresh motor receipt can authorize deletion. */

var AdminGate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Recovery = require('../lib/communication-social-recovery.js');

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

function createHandler(deps) {
  deps = deps || {};
  var gate = deps.adminGate || AdminGate;
  var store = deps.store || Store;
  var recovery = deps.recovery || Recovery;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('Access-Control-Allow-Headers', 'content-type,x-limen-pass');
    if (String(req.method || '').toUpperCase() !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      return res.end(JSON.stringify({ ok: false, error: 'POST only' }));
    }
    var pass = gate.reqKey(req);
    if (!gate.hasDomain(pass, 'communication')) return gate.deny(res);
    try {
      var body = bodyOf(req);
      var result = await recovery.recover({
        store: store,
        commandId: body.commandId,
        reason: body.reason,
        trigger: body.trigger,
        now: Date.now()
      });
      res.statusCode = result.status === 'REFUSED' ? 400 : result.status === 'FAILED' ? 503 : 200;
      return res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'communication-social-recovery-unavailable',
        detail: String(error && error.message || error), liveMoney: false }));
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('communication-social-recovery', handler);
module.exports.createHandler = createHandler;
