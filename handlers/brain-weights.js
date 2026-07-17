/**
 * handlers/brain-weights.js — durable K-layer weight persistence (Phase 0 of
 * the reward-gated plasticity build).
 *
 *   GET  /api/brain-weights?domain=energy            → { ok, snapshot }   latest stored snapshot (brain boot reload)
 *   GET  /api/brain-weights?domain=energy&history=20 → { ok, rows }       recent snapshot history (tuning / diagnostics)
 *   POST /api/brain-weights  {domain, snapshot}      → store latest + append history. Token-gated, fail-closed.
 *
 * WHY: the domain brains run client-side; every learned weight adjustment
 * previously lived in tab memory and evaporated on close — the exact
 * "nothing learns because nothing persists" failure the hippocampus recorder
 * fixed for feeds, one layer deeper. This is the same fix with the same
 * proven parts: lib/limen-db (Redis), set for the latest snapshot,
 * lpush/ltrim for capped rolling history. No second persistence mechanism.
 *
 * SECURITY (biosensor-state pattern): POST requires BRAIN_WEIGHTS_TOKEN env +
 * matching x-brain-token header (or body.token). No committed fallback: with
 * the env unset, writes fail closed and the brain simply keeps computing from
 * seeds (shadow mode loses nothing but continuity). GET is open — weights are
 * low-sensitivity calibration state, same class as the public feed snapshot.
 *
 * HONESTY: snapshots carry mode:'shadow', creditSource and isReward:false
 * straight from the plasticity module; this handler never edits them.
 * Guardrail: stores + serves calibration state only — nothing here acts,
 * spends, files, or contacts anyone.
 */

var db = require('../lib/limen-db');

var HIST_CAP = 500;                 // snapshots kept per domain (tiny rows; weeks of tuning history)
var MAX_BYTES = 64 * 1024;          // reject oversized snapshots (weight vectors are ~1-2KB)
var DOMAIN_RE = /^[a-z][a-zA-Z]{1,23}$/;
var TOKEN = process.env.BRAIN_WEIGHTS_TOKEN || '';   // no committed fallback: POST fails closed when unset

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var d = '';
    req.on('data', function (c) { d += c; if (d.length > MAX_BYTES * 2) { try { req.destroy(); } catch (e) {} resolve({}); } });
    req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-brain-token');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();

  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  if (m === 'GET') {
    var domain = String(q.domain || '');
    if (!DOMAIN_RE.test(domain)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad domain' })); }
    try {
      if (q.history) {
        var n = Math.max(1, Math.min(100, parseInt(q.history, 10) || 20));
        var rows = await db.lrange('brainwts:hist:' + domain, 0, n - 1);
        return res.end(JSON.stringify({ ok: true, domain: domain, count: (rows || []).length, rows: rows || [], backend: db.getBackend() }));
      }
      var snap = await db.get('brainwts:' + domain);
      return res.end(JSON.stringify({ ok: true, domain: domain, snapshot: snap || null, backend: db.getBackend() }));
    } catch (e) {
      res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  if (m === 'POST') {
    var body = await readBody(req);
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    var tok = req.headers['x-brain-token'] || (body && body.token);
    if (!TOKEN || tok !== TOKEN) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'unauthorized' })); }

    var dom = String((body && body.domain) || '');
    var snapshot = body && body.snapshot;
    if (!DOMAIN_RE.test(dom)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad domain' })); }
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.layers || typeof snapshot.layers !== 'object') {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'snapshot.layers required' }));
    }
    var json;
    try { json = JSON.stringify(snapshot); } catch (e) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'unserializable snapshot' })); }
    if (json.length > MAX_BYTES) { res.statusCode = 413; return res.end(JSON.stringify({ ok: false, error: 'snapshot too large' })); }

    try {
      snapshot.storedAt = Date.now();
      await db.set('brainwts:' + dom, snapshot);                    // latest (boot reload reads this)
      await db.lpush('brainwts:hist:' + dom, snapshot);             // rolling history for tuning/diagnostics
      await db.ltrim('brainwts:hist:' + dom, 0, HIST_CAP - 1);
      return res.end(JSON.stringify({ ok: true, domain: dom, backend: db.getBackend(), bytes: json.length }));
    } catch (e) {
      res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};
