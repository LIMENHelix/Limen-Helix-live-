/**
 * LIMEN Helix — Iteration Endpoint (Phase 0 / W3)
 *
 * POST /api/limen-iteration
 *   Body: { slug, cycleN, iterN, inputs: { portalSig, l2EdgesSig,
 *                                          classifierVersion, propagatorVersion } }
 *   1. Compute inputHash via FNV-1a (stable JSON, key-sorted).
 *   2. Compute iterId = iter_{slug}_{cycleN}_{iterN}_{inputHash[0:8]}.
 *   3. Look up via getIterRecord(iterId):
 *        - HIT  → 200 { ok:true, iterId, record, idempotent:true }
 *        - MISS → 404 { ok:false, error:'no-cached-result', iterId, inputHash }
 *
 *   Per the Phase 0 design doc this endpoint does NOT yet run propagation.
 *   That dispatch is Phase 1 (math foundation). For Phase 0 we only need
 *   the cache shape + endpoint contract in place so Phase 1 can plug in.
 *
 *   POST is auth-gated by LIMEN_OPERATOR_TOKEN (mirrors H6 from
 *   /api/limen-engine-output).
 *
 * GET /api/limen-iteration
 *   ?iterId=<id>                    → single record
 *   ?slug=<slug>&limit=<n>          → records for that slug (LIFO)
 *   ?cycleN=<n>&limit=<n>           → records for that cycle (LIFO)
 *
 *   GET is open (read-only).
 *
 * Response shapes match /api/limen-engine-output conventions:
 *   - single: { ok, iterId, record }
 *   - list:   { ok, count, entries[] }
 */

'use strict';

const {
  computeInputHash,
  computeIterId,
  getIterRecord,
  listIterBySlug,
  listIterByCycle
} = require('../lib/limen-iteration-cache.js');

const OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const AUTH_ON = !!OPERATOR_TOKEN;

function checkAuth(req) {
  if (!AUTH_ON) return { ok: true, mode: 'disabled' };
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, reason: 'missing-bearer' };
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true, mode: 'operator' };
}

async function _readJsonBody(req) {
  let body = req.body;
  if (!body) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    body = raw ? JSON.parse(raw) : {};
  } else if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  return body;
}

function _validatePost(body) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body-not-object' };
  if (!body.slug || typeof body.slug !== 'string') return { ok: false, reason: 'missing-slug' };
  if (body.cycleN === undefined || body.cycleN === null) return { ok: false, reason: 'missing-cycleN' };
  if (body.iterN === undefined || body.iterN === null) return { ok: false, reason: 'missing-iterN' };
  if (!body.inputs || typeof body.inputs !== 'object') return { ok: false, reason: 'missing-inputs' };
  return { ok: true };
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'POST') {
    const auth = checkAuth(req);
    if (!auth.ok) {
      res.statusCode = 401;
      res.setHeader('content-type', 'application/json');
      res.setHeader('WWW-Authenticate', 'Bearer realm="limen-iteration"');
      return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
    }
  }

  try {
    if (req.method === 'POST') {
      const body = await _readJsonBody(req);
      const v = _validatePost(body);
      if (!v.ok) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: v.reason, detail: v }));
      }

      const inputHash = computeInputHash(body.inputs);
      const iterId = computeIterId(body.slug, body.cycleN, body.iterN, inputHash);
      const existing = await getIterRecord(iterId);

      res.setHeader('content-type', 'application/json');

      if (existing) {
        res.statusCode = 200;
        return res.end(JSON.stringify({
          ok: true,
          idempotent: true,
          iterId: iterId,
          inputHash: inputHash,
          record: existing
        }));
      }

      // Phase 0: cache MISS does not dispatch propagation. That is Phase 1.
      res.statusCode = 404;
      return res.end(JSON.stringify({
        ok: false,
        error: 'no-cached-result',
        iterId: iterId,
        inputHash: inputHash,
        phase: 'phase-0',
        note: 'propagation-dispatch-not-yet-wired'
      }));
    }

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const iterId = url.searchParams.get('iterId');
      const slug = url.searchParams.get('slug');
      const cycleN = url.searchParams.get('cycleN');
      const limit = url.searchParams.get('limit') || '50';

      res.setHeader('content-type', 'application/json');

      if (iterId) {
        const r = await getIterRecord(iterId);
        res.statusCode = r ? 200 : 404;
        return res.end(JSON.stringify({ ok: !!r, iterId: iterId, record: r }));
      }
      if (slug) {
        const entries = await listIterBySlug(slug, limit);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, slug: slug, count: entries.length, entries: entries }));
      }
      if (cycleN !== null && cycleN !== undefined && cycleN !== '') {
        const entries = await listIterByCycle(cycleN, limit);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, cycleN: cycleN, count: entries.length, entries: entries }));
      }

      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'specify ?iterId, ?slug, or ?cycleN' }));
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
