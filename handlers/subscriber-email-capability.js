'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Verifier = require('../lib/subscriber-email-capability-verifier.js');

function tokenOf(req) {
  var headers = req.headers || {};
  return headers['x-brain-token'] || String(headers.authorization || '').replace(/^Bearer\s+/i, '');
}
function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}
function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, verifier = deps.verifier || Verifier, env = deps.env || process.env;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    var headers = req.headers || {};
    var cron = !!(env.CRON_SECRET && headers.authorization === 'Bearer ' + env.CRON_SECRET);
    if (!cron) {
      if (!env.BRAIN_SHADOW_TOKEN) return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
      if (tokenOf(req) !== env.BRAIN_SHADOW_TOKEN) return send(res, 401, { ok: false, error: 'unauthorized' });
    }
    try {
      var result = await verifier.run(store, Date.now(), { persist: cron });
      result.authMode = cron ? 'cron-write' : 'operator-read';
      result.commissioningOnly = true;
      result.externalEffectExecuted = false;
      result.sendEndpointCalled = false;
      result.liveMoney = false;
      return send(res, 200, result);
    } catch (error) {
      return send(res, 503, { ok: false, error: 'subscriber-email-capability-projection-failed',
        stage: 'durable-evidence-projection', detail: String(error && error.message || error),
        externalEffectExecuted: false, sendEndpointCalled: false, liveMoney: false });
    }
  };
}

var handler = createHandler();
var wrapped = require('../lib/heartbeat').wrap('subscriber-email-capability', handler);
wrapped.createHandler = createHandler;
module.exports = wrapped;
