/**
 * api/lead.js — public lead capture + minimal admin read/delete.
 *
 * POST /api/lead            (public)  → persist a lead to Upstash via limen-db.
 *                                       Returns ok:true ONLY after a read-back
 *                                       confirms the write. Otherwise 4xx/5xx.
 * GET  /api/lead?key=KEY    (admin)   → list leads (newest first).
 * DELETE /api/lead?key=KEY&id=ID      → delete one lead (for test cleanup).
 *
 * Storage: api/lib/limen-db.js (UPSTASH_REDIS_REST_* — proven live via
 * /api/redis-diag). Each lead stored at key `lead:<id>`; an id index is kept
 * at `leads_index` (LPUSH, newest first). Read skips ids whose record is gone
 * so DELETE needs no list rewrite.
 *
 * SECURITY NOTE: the admin key is MINIMAL protection, NOT real auth. There is
 * NO fallback key. GET/DELETE require process.env.LEAD_ADMIN_KEY to be set in
 * Vercel; if it is unset, admin read/delete is disabled and zero leads are
 * exposed. Leads contain PII — never expose GET without the key.
 *
 * Guardrail: nothing here emails, files, submits, or contacts anyone. It only
 * persists the form payload for the operator to read.
 */
var db = require('../lib/limen-db');

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); });
    req.on('error', function () { resolve(''); });
  });
}

function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();

  // ── POST: create (public) ─────────────────────────────────────────────
  if (method === 'POST') {
    var raw = await readBody(req);
    var body = raw;
    if (typeof raw === 'string') { try { body = JSON.parse(raw); } catch (e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};

    var email = clip(body.email, 200).trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'A valid email is required.' }));
    }
    if (!body.consent) {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Consent to contact is required.' }));
    }

    var id = 'L' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
    var isTest = /(^|[^a-z])test([^a-z]|$)|example\.com|limen-frontdoor/i.test(email) || body.test === true;
    var lead = {
      id: id,
      ts: new Date().toISOString(),
      name: clip(body.name, 200),
      email: email,
      phone: clip(body.phone, 60),
      organization: clip(body.organization, 200),
      interest: clip(body.interest, 80),
      message: clip(body.message, 4000),
      consent: true,
      accredited: body.accredited === true,
      sourcePage: clip(body.sourcePage, 300),
      userAgent: clip(req.headers && req.headers['user-agent'], 400),
      test: isTest
    };

    try {
      await db.set('lead:' + id, lead);
      await db.lpush('leads_index', id);
      // Honest success: only confirm after a read-back proves the write landed.
      var check = await db.get('lead:' + id);
      if (!check || check.id !== id) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ ok: false, error: 'Write could not be confirmed.' }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, id: id, backend: db.getBackend() }));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
    }
  }

  // ── GET / DELETE: admin (key-gated) ───────────────────────────────────
  var u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var key = u.searchParams.get('key') || '';
  var ADMIN_KEY = process.env.LEAD_ADMIN_KEY || '';
  // No fallback key. If LEAD_ADMIN_KEY is unset, admin read/delete is disabled
  // entirely and zero leads are exposed.
  if (!ADMIN_KEY) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'Lead admin access is not configured (LEAD_ADMIN_KEY not set). No leads exposed.' }));
  }
  if (!key || key !== ADMIN_KEY) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'Valid admin key required (?key=). Minimal protection, not real auth.' }));
  }

  if (method === 'DELETE') {
    var delId = u.searchParams.get('id') || '';
    if (!delId) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'id required' })); }
    try { await db.del('lead:' + delId); } catch (e) {}
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, deleted: delId }));
  }

  if (method === 'GET') {
    try {
      var ids = (await db.lrange('leads_index', 0, -1)) || [];
      var leads = [];
      for (var i = 0; i < ids.length; i++) {
        var l = await db.get('lead:' + ids[i]);
        if (l) leads.push(l);
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, count: leads.length, backend: db.getBackend(), leads: leads }, null, 2));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
    }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
};
