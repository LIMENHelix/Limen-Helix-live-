'use strict';

/**
 * Operator reads are read-only. Only Vercel cron authentication may persist a
 * capability pair, and the verifier remains unable to create its own evidence.
 */

var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');
var Verifier = require('../lib/finance-motor-capability-verifier.js');

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
  var broker = deps.broker || Broker;
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
        ? await verifier.verifyAndPersist(store, broker, Date.now())
        : { ok: true, status: 'AUDITED', persisted: false, audit: await verifier.audit(store, broker, Date.now()) };
      result.authMode = cron ? 'cron-write' : 'operator-read';
      result.paperOnly = true;
      result.liveMoney = false;
      return send(res, 200, result);
    } catch (error) {
      return send(res, 503, {
        ok: false,
        error: 'finance-motor-capability-verification-failed',
        errorCode: error && error.code || 'FINANCE_MOTOR_CAPABILITY_FAILED',
        detail: String(error && error.message || error),
        paperOnly: true,
        liveMoney: false
      });
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
module.exports = handler;
