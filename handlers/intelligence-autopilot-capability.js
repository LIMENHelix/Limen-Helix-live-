'use strict';
var Store = require('../lib/autofire-efference-store.js');
var Verifier = require('../lib/intelligence-autopilot-capability-verifier.js');
function tokenOf(req) { var h = req.headers || {}; return h['x-brain-token'] || String(h.authorization || '').replace(/^Bearer\s+/i, ''); }
function send(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); return res.end(JSON.stringify(body)); }
function createHandler(deps) { deps = deps || {}; var store = deps.store || Store, verifier = deps.verifier || Verifier, env = deps.env || process.env;
  return async function (req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    var h = req.headers || {}, cron = !!(env.CRON_SECRET && h.authorization === 'Bearer ' + env.CRON_SECRET);
    if (!cron) { if (!env.BRAIN_SHADOW_TOKEN) return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
      if (tokenOf(req) !== env.BRAIN_SHADOW_TOKEN) return send(res, 401, { ok: false, error: 'unauthorized' }); }
    try { var result = cron ? await verifier.verifyAndPersist(store, Date.now()) : { ok: true, status: 'AUDITED', persisted: false, audit: await verifier.audit(store, Date.now()) };
      if (result.audit) { delete result.audit._motor; delete result.audit._command; delete result.audit._observation; }
      result.authMode = cron ? 'cron-write' : 'operator-read'; result.commissioningOnly = true; result.liveMoney = false; return send(res, 200, result); }
    catch (error) { return send(res, 503, { ok: false, error: 'intelligence-autopilot-capability-verification-failed', detail: String(error && error.message || error), liveMoney: false }); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('intelligence-autopilot-capability', handler); module.exports.createHandler = createHandler;
