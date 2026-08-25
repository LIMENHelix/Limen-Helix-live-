'use strict';

var AdminGate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');
var Executor = require('../lib/finance-paper-executor.js');

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
    if ((req.method || 'GET').toUpperCase() !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    var pass = adminGate.reqKey(req);
    if (!adminGate.isMaster(pass)) return adminGate.deny(res);
    var body = bodyOf(req);
    if (body.action !== 'execute') return res.status(400).json({ ok: false, error: 'action must be execute' });
    try {
      var result = await executor.execute({ store: store, broker: broker, packetId: body.packetId, env: env });
      return res.status(200).json(result);
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
module.exports = handler;
