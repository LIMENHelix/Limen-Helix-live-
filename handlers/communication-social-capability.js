'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Verifier = require('../lib/communication-social-capability-verifier.js');
var CycleObservability = require('../lib/autonomy-cycle-observability.js');

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
var SAFE_PROVIDER_STATUSES = new Set([400, 401, 403, 408, 409, 425, 429, 500, 502, 503, 504]);
function telemetryReason(result) {
  var reason = result && result.reason || null;
  var commissioning = result && result.commissioning || {};
  var status = Number(commissioning.providerStatus);
  var authFailure = reason === 'commissioning-provider-authentication-failed' ||
    (reason === 'commissioning-no-effect-retry-cooldown' &&
      commissioning.reason === 'commissioning-provider-authentication-failed');
  if (authFailure && SAFE_PROVIDER_STATUSES.has(status)) {
    return 'commissioning-provider-authentication-http-' + status +
      (reason === 'commissioning-no-effect-retry-cooldown' ? '-retry-cooldown' : '');
  }
  return reason;
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
      if (cron) CycleObservability.emit('communication-social-capability', {
        ok: result.ok === true,
        evaluatedAt: Date.now(),
        rows: [{ productDomain: 'communication', stage: 'capability-commissioning',
          status: result.status, reason: telemetryReason(result) }]
      }, deps.cycleLogger);
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
module.exports.telemetryReason = telemetryReason;
