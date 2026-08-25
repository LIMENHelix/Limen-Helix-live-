'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');
var Commissioning = require('../lib/finance-sandbox-commissioning.js');

function tokenOf(req) {
  var headers = req.headers || {};
  return headers['x-brain-token'] || String(headers.authorization || '').replace(/^Bearer\s+/i, '');
}
function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) { return {}; } }
  return req.body;
}
function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var broker = deps.broker || Broker;
  var commissioning = deps.commissioning || Commissioning;
  var env = deps.env || process.env;
  return async function handler(req, res) {
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    if (!env.BRAIN_SHADOW_TOKEN) return res.status(503).json({ ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
    if (tokenOf(req) !== env.BRAIN_SHADOW_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
    if (bodyOf(req).action !== 'verify-zero-effect-rollback') return res.status(400).json({ ok: false, error: 'action must be verify-zero-effect-rollback' });
    try {
      var result = await commissioning.execute({ store: store, broker: broker, env: env });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(503).json({
        ok: false,
        status: 'COMMISSIONING_UNRESOLVED',
        error: error && error.message || String(error),
        errorCode: error && error.code || 'FINANCE_SANDBOX_COMMISSIONING_FAILED',
        paperOnly: true,
        liveMoney: false
      });
    }
  };
}
var handler = createHandler();
handler.createHandler = createHandler;
module.exports = handler;
