'use strict';

/**
 * POST /api/finance-b14 { action: "preview", packetId }
 *
 * Finance domain bridge. It is admin-only, sandbox-only, and preview-only.
 * Order submission remains on /api/tradier-b14 with its separate exact
 * confirmation boundary.
 */

var AdminGate = require('../lib/admin-gate');
var Store = require('../lib/autofire-efference-store');
var Broker = require('../lib/tradier-sandbox');
var Bridge = require('../lib/finance-b14-bridge');

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

function createHandler(deps) {
  deps = deps || {};
  var adminGate = deps.adminGate || AdminGate;
  var store = deps.store || Store;
  var broker = deps.broker || Broker;
  var bridge = deps.bridge || Bridge;
  var env = deps.env || process.env;

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limen-Pass');
    res.setHeader('Cache-Control', 'no-store');
    var method = (req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') return res.status(200).end();
    var pass = adminGate.reqKey(req);
    if (!adminGate.hasDomain(pass, 'finance')) return adminGate.deny(res);
    try {
      if (method === 'GET') {
        var packetId = req.query && req.query.packetId || null;
        var audit = packetId ? await bridge.auditDecision(store, packetId, env) : null;
        return res.status(200).json({ ok: true, bridge: 'finance-b14', state: bridge.state(env), audit: audit });
      }
      if (method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });
      var body = bodyOf(req);
      if (body.action !== 'preview') return res.status(400).json({ ok: false, error: 'action must be preview' });
      if (body.selection || body.tradeIntent) {
        return res.status(400).json({ ok: false, error: 'client-supplied selection and tradeIntent are forbidden; provide packetId only' });
      }
      if (!body.packetId) return res.status(400).json({ ok: false, error: 'packetId is required' });
      return res.status(200).json(await bridge.previewDecision(store, broker, body.packetId, env));
    } catch (err) {
      return res.status(400).json({ ok: false, error: err && err.message || 'Finance B14 bridge refused', errorCode: err && err.code || 'FINANCE_B14_REFUSED' });
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.bodyOf = bodyOf;
module.exports = handler;
