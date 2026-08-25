'use strict';

/** Authenticated, paper-only admission of a validated Finance Preview receipt. */

var Admission = require('../lib/finance-paper-admission.js');
var Preview = require('../lib/finance-preview-execution.js');
var Store = require('../lib/autofire-efference-store.js');

function enabled(value) { return value === '1' || value === 'true' || value === 'TRUE'; }
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
  var admission = deps.admission || Admission;
  var preview = deps.preview || Preview;
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
      var bundle = await preview.productionInput({
        fetch: fetchFn,
        origin: env.LIMEN_PREVIEW_ORIGIN || 'https://limenhelix.com',
        token: expected
      });
      var packetId = bundle.packet && bundle.packet.packetId || null;
      if (method === 'GET') {
        return send(res, 200, {
          ok: true,
          audit: await admission.audit(store, packetId),
          gate: {
            authenticated: true,
            enabled: enabled(env.LIMEN_FINANCE_PAPER_ADMISSION_ENABLED),
            paperOnly: true,
            broker: false,
            liveMoney: false
          }
        });
      }
      if (!enabled(env.LIMEN_FINANCE_PAPER_ADMISSION_ENABLED)) {
        return send(res, 503, { ok: false, error: 'LIMEN_FINANCE_PAPER_ADMISSION_ENABLED is off; no admission receipt was acquired' });
      }
      var request = await bodyOf(req);
      if (request.packetId !== packetId) {
        return send(res, 409, { ok: false, status: 'ABSTAINED', reason: 'approved_packet_must_match_current_packet' });
      }
      var result = await admission.execute(store, request);
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
