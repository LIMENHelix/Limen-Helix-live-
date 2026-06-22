/**
 * api/admin-auth.js — per-person admin login (passcode → assigned domains).
 *
 * POST /api/admin-auth  { passcode }  → { ok, person: { key, name, domains, properties, master? } }
 *
 * Passcodes live in Vercel env vars (NEVER in code or the assignment file):
 *   - ADMIN_MASTER          → operator/full access (all domains)
 *   - ADMIN_PASS_<KEY>      → one per person, matched to assets/data/admin-assignments.json
 *
 * If a person's env var is unset, that login is simply disabled (no fallback). The
 * assignment file maps a person to display name + domains only — no secrets. This
 * endpoint NEVER reveals which env vars exist; a bad passcode is a flat 403.
 */
const fs = require('node:fs');
const path = require('node:path');

const MAP = path.join(__dirname, '..', 'assets', 'data', 'admin-assignments.json');

function _readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); } }
    var d = '';
    req.on('data', function (c) { d += c; });
    req.on('end', function () { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function _people() {
  try { return (JSON.parse(fs.readFileSync(MAP, 'utf8')).people) || []; }
  catch (e) { return []; }
}

// Universe of assignable domains (master sees all). Extend as public fronts are added.
const ALL_DOMAINS = ['energy', 'culture', 'infrastructure', 'finance'];

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET').toUpperCase() !== 'POST') {
    res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST required' }));
  }
  const body = await _readBody(req);
  const pass = String((body && body.passcode) || '').trim();
  if (!pass) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Passcode required.' })); }

  // Master / operator passcode → all domains. (Accept either env name.)
  const master = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  if (master && pass === master) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, person: { key: 'operator', name: 'Operator', domains: ALL_DOMAINS, properties: [], master: true } }));
  }

  // Per-person passcodes (env var named in the assignment map).
  const people = _people();
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const expected = (p.envVar && process.env[p.envVar]) || '';
    if (expected && pass === expected) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, person: { key: p.key, name: p.name, domains: p.domains || [], properties: p.properties || [] } }));
    }
  }

  res.statusCode = 403;
  return res.end(JSON.stringify({ ok: false, error: 'Invalid passcode.' }));
};
