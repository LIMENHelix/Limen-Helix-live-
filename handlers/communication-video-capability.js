'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Audit = require('../lib/communication-video-capability-audit.js');
function send(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); return res.end(JSON.stringify(body)); }
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, auth = deps.cronAuth || CronAuth, audit = deps.audit || Audit;
  return async function handler(req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    if (!auth.enforce(req, res)) return;
    try { return send(res, 200, Object.assign({ ok: true, commissioningOnly: true, liveMoney: false }, await audit.audit(store, Date.now()))); }
    catch (error) { return send(res, 503, { ok: false, error: 'communication-video-capability-audit-failed', detail: String(error && error.message || error), liveMoney: false }); }
  };
}
var handler = createHandler();
var wrapped = require('../lib/heartbeat').wrap('communication-video-capability', handler);
wrapped.createHandler = createHandler;
module.exports = wrapped;
