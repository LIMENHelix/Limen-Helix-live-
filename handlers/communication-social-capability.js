'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Verifier = require('../lib/communication-social-capability-verifier.js');

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
  var store = deps.store || Store;
  var verifier = deps.verifier || Verifier;
  var env = deps.env || process.env;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    var headers = req.headers || {};
    var cron = !!(env.CRON_SECRET && headers.authorization === 'Bearer ' + env.CRON_SECRET);
    if (!cron) {
      if (!env.BRAIN_SHADOW_TOKEN) return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
      if (tokenOf(req) !== env.BRAIN_SHADOW_TOKEN) return send(res, 401, { ok: false, error: 'unauthorized' });
    }
    try {
      var result = cron
        ? await verifier.commission(store, Date.now(), { env: env })
        : { ok: true, status: 'AUDITED', audit: await verifier.audit(store, Date.now()) };
      result.authMode = cron ? 'cron-one-shot-write' : 'operator-read';
      result.commissioningOnly = true;
      result.liveMoney = false;
      return send(res, 200, result);
    } catch (error) {
      return send(res, 503, {
        ok: false, error: 'communication-social-capability-verification-failed',
        detail: String(error && error.message || error), commissioningOnly: true, liveMoney: false
      });
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat.js').guard('communication-social-capability', handler);
module.exports.createHandler = createHandler;
