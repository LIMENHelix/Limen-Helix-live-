'use strict';

var AdminGate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');
var Executor = require('../lib/finance-paper-executor.js');

function tokenOf(req) {
  var headers = req.headers || {};
  return headers['x-brain-token'] || String(headers.authorization || '').replace(/^Bearer\s+/i, '');
}

function brainAuthorized(req, env) {
  var expected = env.BRAIN_SHADOW_TOKEN || '';
  return !!expected && tokenOf(req) === expected;
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) { return {}; } }
  return req.body;
}

function createHandler(deps) {
  deps = deps || {};
  var adminGate = deps.adminGate || AdminGate;
  var store = deps.store || Store;
  var broker = deps.broker || Broker;
  var executor = deps.executor || Executor;
  var env = deps.env || process.env;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brain-Token, Authorization, X-Limen-Pass');
    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') return res.status(200).json({ ok: true });
    if ((req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    var pass = adminGate.reqKey(req);
    var authMode = adminGate.isMaster(pass) ? 'master' : (brainAuthorized(req, env) ? 'finance-brain-token' : null);
    if (!authMode) return adminGate.deny(res);
    var body = bodyOf(req);
    if (body.action !== 'execute') return res.status(400).json({ ok: false, error: 'action must be execute' });
    try {
      var result = await executor.execute({ store: store, broker: broker, packetId: body.packetId, env: env });
      return res.status(200).json(Object.assign({ authMode: authMode }, result));
    } catch (error) {
      return res.status(503).json({
        ok: false,
        status: 'EXECUTION_UNRESOLVED',
        error: error && error.message || 'Finance paper execution failed',
        errorCode: error && error.code || 'FINANCE_PAPER_EXECUTOR_FAILED',
        packetId: error && error.packetId || body.packetId || null,
        paperOnly: true,
        liveMoney: false
      });
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.brainAuthorized = brainAuthorized;
module.exports = handler;
