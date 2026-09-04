'use strict';

/*
 * Authenticated operator boundary for one Finance manager Preview call.
 *
 * GET  /api/finance-preview  audits the current production packet and readiness.
 * POST /api/finance-preview  requires { approve: true, packetId } and obtains a
 * durable packet-keyed Redis command receipt before the paid provider is called.
 *
 * This endpoint cannot release a candidate and does not import a broker module.
 */

var Execution = require('../lib/finance-preview-execution.js');
var Provider = require('../lib/finance-preview-provider.js');
var Store = require('../lib/autofire-efference-store.js');

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
  var execution = deps.execution || Execution;
  var providerModule = deps.providerModule || Provider;
  var store = deps.store || Store;
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
      var bundle = await execution.productionInput({
        fetch: fetchFn,
        origin: env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com',
        token: expected
      });
      var audit = execution.audit(bundle);
      store.assertDurable();

      if (method === 'GET') {
        var receipt = audit.packetId ? await store.get(execution.receiptKey(audit.packetId)) : null;
        return send(res, 200, {
          ok: true,
          audit: audit,
          receipt: receipt,
          gate: {
            authenticated: true,
            durableStore: true,
            previewSwitchEnabled: providerModule.enabled(env),
            providerConfigured: providerModule.configured(env),
            oneShot: true,
            candidateRelease: false,
            broker: false,
            liveMoney: false
          }
        });
      }

      if (!providerModule.enabled(env)) {
        return send(res, 503, { ok: false, error: 'LIMEN_FINANCE_PREVIEW_ENABLED is off; no receipt was acquired' });
      }
      if (!providerModule.configured(env)) {
        return send(res, 503, { ok: false, error: 'Finance Preview provider is not configured; no receipt was acquired' });
      }
      var request = await bodyOf(req);
      var result = await execution.execute(store, bundle, request, {
        providerOptions: { env: env, fetch: fetchFn }
      });
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
