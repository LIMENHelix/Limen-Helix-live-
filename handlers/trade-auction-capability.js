'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Verifier = require('../lib/trade-auction-capability-verifier.js');
function send(res, code, body) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); return res.end(JSON.stringify(body)); }
function createHandler(deps) { deps = deps || {}; var store = deps.store || Store, auth = deps.cronAuth || CronAuth, verifier = deps.verifier || Verifier;
  return async function handler(req, res) { if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' }); if (!auth.enforce(req, res)) return;
    try { var result = await verifier.commission(store, Date.now(), { env: deps.env || process.env, fetch: deps.fetch || global.fetch, baseUrl: deps.baseUrl || process.env.LIMEN_BASE_URL }); result.authMode = 'cron-write'; result.commissioningOnly = true; result.liveMoney = false; return send(res, 200, result); }
    catch (error) { return send(res, 503, { ok: false, error: 'trade-auction-capability-verification-failed', detail: String(error && error.message || error), commissioningOnly: true, liveMoney: false }); }
  }; }
var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('trade-auction-capability', handler);
module.exports.createHandler = createHandler;
