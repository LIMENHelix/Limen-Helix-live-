/**
 * handlers/site-request.js — Drew → the Creator: "change the site" requests.
 *
 * Gated to his admin login. Persists the request to Redis (so nothing is lost) AND
 * emails it to the operator via the same path the front-page leads use (Web3Forms
 * primary, Resend fallback). Inert-but-still-saved if no mail key is set.
 *
 * POST /api/site-request { passcode, message }
 */
const db = require('../lib/limen-db');
const fs = require('node:fs');
const path = require('node:path');
const MAP = path.join(__dirname, '..', 'assets', 'data', 'admin-assignments.json');

function readBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let d = ''; req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function people() { try { return (JSON.parse(fs.readFileSync(MAP, 'utf8')).people) || []; } catch (e) { return []; } }
function authorize(passcode) {
  if (!passcode) return null;
  const mk = process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  if (mk && passcode === mk) return { key: 'master', name: 'Operator' };
  for (const p of people()) {
    const v = process.env[p.envVar || ('ADMIN_PASS_' + String(p.key || '').toUpperCase())];
    if (v && passcode === v) return p;
  }
  return null;
}
function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

// Email the request to the operator. Web3Forms primary (no DNS), Resend fallback.
// Fail-open: a send failure never loses the request (it's already persisted).
async function notify(reqObj) {
  const subject = 'LIMEN site request from ' + reqObj.who + ': ' + clip(reqObj.message, 60);
  const w3 = process.env.WEB3FORMS_ACCESS_KEY;
  if (w3) {
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ access_key: w3, subject: subject, from_name: 'LIMEN Helix · site requests',
          who: reqObj.who, request: reqObj.message, source_page: reqObj.sourcePage || '', at: reqObj.ts })
      });
      const j = await r.json().catch(() => ({}));
      return { sent: !!(r.ok && j && j.success), via: 'web3forms' };
    } catch (e) { return { sent: false, via: 'web3forms' }; }
  }
  const apiKey = process.env.RESEND_API_KEY, to = process.env.LEAD_NOTIFY_EMAIL;
  if (!apiKey || !to) return { sent: false, reason: 'not-configured' };
  const from = process.env.LEAD_FROM_EMAIL || 'LIMEN Helix <onboarding@resend.dev>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ from: from, to: [to], subject: subject,
        html: '<h3 style="font-family:sans-serif">Site request from ' + reqObj.who + '</h3><p style="font-family:sans-serif;white-space:pre-wrap">' + clip(reqObj.message, 4000).replace(/</g, '&lt;') + '</p><p style="color:#888;font-family:monospace;font-size:12px">' + (reqObj.sourcePage || '') + ' · ' + reqObj.ts + '</p>' })
    });
    return { sent: !!r.ok, via: 'resend' };
  } catch (e) { return { sent: false, reason: String(e && e.message || e) }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const method = (req.method || 'GET').toUpperCase();

  // ── GET / DELETE: admin read of the request log (key-gated by LEAD_ADMIN_KEY) ──
  if (method === 'GET' || method === 'DELETE') {
    let u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
    const key = u.searchParams.get('key') || '';
    const ADMIN_KEY = process.env.LEAD_ADMIN_KEY || '';
    if (!ADMIN_KEY) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'Admin read not configured (LEAD_ADMIN_KEY unset).' })); }
    if (key !== ADMIN_KEY) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Valid admin key required (?key=).' })); }
    if (method === 'DELETE') {
      const id = u.searchParams.get('id') || '';
      if (id) { try { await db.del('sitereq:' + id); } catch (e) {} }
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, deleted: id }));
    }
    // mark all current requests as seen (resets the unread badge)
    if (u.searchParams.get('seen') === '1') {
      try { await db.set('sitereq_lastseen', Date.now()); } catch (e) {}
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, marked: true, unread: 0 }));
    }
    try {
      const ids = (await db.lrange('sitereq_index', 0, -1)) || [];
      const out = [];
      for (let i = 0; i < ids.length; i++) { const r = await db.get('sitereq:' + ids[i]); if (r) out.push(r); }
      let lastSeen = 0; try { lastSeen = Number(await db.get('sitereq_lastseen')) || 0; } catch (e) {}
      out.forEach(r => { r.isNew = Date.parse(r.ts || 0) > lastSeen; });
      const unread = out.filter(r => r.isNew).length;
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, count: out.length, unread: unread, requests: out }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) })); }
  }

  if (method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }

  const body = await readBody(req);
  const person = authorize(body && body.passcode);
  if (!person) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Sign in first.' })); }

  const message = clip((body && body.message) || '', 4000).trim();
  if (message.length < 3) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Tell me what to change.' })); }

  const id = 'R' + Date.now().toString(36);
  const reqObj = { id: id, who: person.name || person.key || 'someone', personKey: person.key || '', message: message, sourcePage: clip((body && body.sourcePage) || '', 200), ts: new Date().toISOString() };
  try { await db.set('sitereq:' + id, reqObj); await db.lpush('sitereq_index', id); } catch (e) {}

  let sent = false; try { sent = (await notify(reqObj)).sent; } catch (e) {}
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, id: id, emailed: sent }));
};
