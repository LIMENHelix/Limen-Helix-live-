/**
 * lib/admin-gate.js — server-side admin gate for protected API handlers.
 *
 * reqKey(req)            → the passcode from ?key= or the x-limen-pass header
 * isMaster(pass)         → matches ADMIN_MASTER / ADMIN_MASTER_KEY
 * hasDomain(pass,domain) → master, or a person assigned that domain (admin-assignments.json)
 * deny(res)              → 403 JSON
 */
const fs = require('node:fs');
const path = require('node:path');
const MAP = path.join(__dirname, '..', 'assets', 'data', 'admin-assignments.json');

function people() { try { return (JSON.parse(fs.readFileSync(MAP, 'utf8')).people) || []; } catch (e) { return []; } }

function reqKey(req) {
  try { if (req.query && req.query.key) return String(req.query.key); } catch (e) {}
  try { const h = req.headers && (req.headers['x-limen-pass'] || req.headers['X-Limen-Pass']); if (h) return String(h); } catch (e) {}
  try { return new URL(req.url, 'http://x').searchParams.get('key') || ''; } catch (e) { return ''; }
}
function isMaster(pass) {
  const mk = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  return !!(mk && pass === mk);
}
function hasDomain(pass, domain) {
  if (isMaster(pass)) return true;
  if (!pass) return false;
  const ppl = people();
  for (let i = 0; i < ppl.length; i++) {
    const p = ppl[i];
    if ((p.domains || []).indexOf(domain) > -1) {
      const v = process.env[p.envVar || ('ADMIN_PASS_' + String(p.key || '').toUpperCase())];
      if (v && pass === v) return true;
    }
  }
  return false;
}
function deny(res) {
  res.statusCode = 403;
  try { res.setHeader('content-type', 'application/json'); } catch (e) {}
  return res.end(JSON.stringify({ ok: false, error: 'Admin-only endpoint. Sign in.' }));
}

module.exports = { reqKey, isMaster, hasDomain, deny };
