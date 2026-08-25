'use strict';

/* Authenticated one-shot Finance sandbox motor-decision boundary. */

var Decision = require('../lib/finance-trade-decision.js');
var Provider = require('../lib/finance-trade-decision-provider.js');
var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function tokenOf(req) {
  var headers = req.headers || {};
  return headers['x-brain-token'] || String(headers.authorization || '').replace(/^Bearer\s+/i, '');
}

async function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  var chunks = [], bytes = 0;
  for await (var chunk of req) {
    bytes += chunk.length;
    if (bytes > 16 * 1024) throw new Error('request body exceeds 16 KiB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function createHandler(deps) {
  deps = deps || {};
  var decision = deps.decision || Decision;
  var providerModule = deps.providerModule || Provider;
  var store = deps.store || Store;
  var broker = deps.broker || Broker;
  var env = deps.env || process.env;
  var fetchFn = deps.fetch || global.fetch;

  return async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Brain-Token, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    var method = String(req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') return send(res, 200, { ok: true });
    var expected = env.BRAIN_SHADOW_TOKEN || '';
    if (!expected) return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
    if (tokenOf(req) !== expected) return send(res, 401, { ok: false, error: 'unauthorized' });
    if (method !== 'GET' && method !== 'POST') return send(res, 405, { ok: false, error: 'GET or POST only' });

    try {
      store.assertDurable();
      if (method === 'GET') {
        var packetId = req.query && req.query.packetId || null;
        var audit = await decision.audit(store, broker, packetId, env);
        return send(res, 200, {
          ok: true,
          audit: audit,
          gate: {
            authenticated: true,
            durableStore: true,
            decisionSwitchEnabled: providerModule.enabled(env),
            providerConfigured: !!env.ANTHROPIC_API_KEY,
            tradierSandboxConfigured: broker.configured(),
            oneShot: true,
            brokerReadOnlyBeforeDecision: true,
            orderPreview: false,
            order: false,
            liveMoney: false
          }
        });
      }
      if (!providerModule.enabled(env)) {
        return send(res, 503, { ok: false, error: 'LIMEN_FINANCE_TRADE_DECISION_ENABLED is off; no receipt was acquired' });
      }
      if (!env.ANTHROPIC_API_KEY) return send(res, 503, { ok: false, error: 'Finance trade-decision provider is not configured; no receipt was acquired' });
      if (!broker.configured()) return send(res, 503, { ok: false, error: 'Tradier sandbox read-only inputs are not configured; no receipt was acquired' });
      var request = await bodyOf(req);
      var result = await decision.execute(store, broker, request, { env: env, fetch: fetchFn });
      return send(res, result.ok ? 200 : 409, result);
    } catch (error) {
      return send(res, 500, { ok: false, error: error && error.message || String(error) });
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.bodyOf = bodyOf;
module.exports = handler;
