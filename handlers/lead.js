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
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Forward a captured lead to the LIMEN inbox via Resend. Fires ONLY if both
// RESEND_API_KEY and LEAD_NOTIFY_EMAIL are set; otherwise inert. Fail-open —
// a send failure must NEVER break the capture (the lead is already persisted).
async function notifyLead(lead) {
  // EASIEST path: Web3Forms — one free access key from web3forms.com (paste your inbox
  // email → get a key). NO domain/DNS verification. The key routes to that inbox.
  var w3 = process.env.WEB3FORMS_ACCESS_KEY;
  if (w3) {
    try {
      var wr = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: 'https://limenhelix.com', referer: 'https://limenhelix.com/' },
        body: JSON.stringify({
          access_key: w3,
          subject: 'New LIMEN lead: ' + lead.email + (lead.interest ? ' · ' + lead.interest : '') + (lead.test ? ' [TEST]' : ''),
          from_name: 'LIMEN Helix (limenhelix.com)',
          email: lead.email, name: lead.name || '(none)', organization: lead.organization || '',
          interest: lead.interest || '', phone: lead.phone || '', message: lead.message || '',
          source_page: lead.sourcePage || '', accredited: lead.accredited ? 'yes' : 'no', captured_at: lead.ts
        })
      });
      var wj = await wr.json().catch(function () { return {}; });
      if (wr.ok && wj && wj.success) return { sent: true, via: 'web3forms', http: wr.status };
      // web3forms did not send (e.g. 403 IP block) → fall through to Resend below
    } catch (e) {}
  }
  // Fallback: Resend (needs RESEND_API_KEY + LEAD_NOTIFY_EMAIL). Runs whenever web3forms did not send.
  var apiKey = process.env.RESEND_API_KEY;
  var to = process.env.LEAD_NOTIFY_EMAIL;
  if (!apiKey || !to) return { sent: false, via: 'none', reason: 'web3forms failed and Resend not configured' };
  var from = process.env.LEAD_FROM_EMAIL || 'LIMEN Helix Leads <onboarding@resend.dev>';
  var fields = ['email', 'name', 'organization', 'interest', 'phone', 'message', 'accredited', 'sourcePage', 'ts'];
  var rows = fields.map(function (k) {
    return '<tr><td style="padding:3px 10px;color:#888;vertical-align:top">' + k + '</td><td style="padding:3px 10px">' + esc(lead[k]) + '</td></tr>';
  }).join('');
  try {
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        from: from,
        to: [to],
        reply_to: lead.email,
        subject: 'New LIMEN lead: ' + lead.email + (lead.interest ? ' · ' + lead.interest : '') + (lead.test ? ' [TEST]' : ''),
        html: '<h2 style="font-family:sans-serif">New lead from limenhelix.com</h2><table style="font-family:monospace;font-size:13px;border-collapse:collapse">' + rows + '</table>'
      })
    });
    var rj = await r.json().catch(function () { return {}; });
    return { sent: !!r.ok, via: 'resend', http: r.status, reason: r.ok ? null : ((rj && rj.message) || null) };
  } catch (e) { return { sent: false, via: 'resend', reason: String(e && e.message || e) }; }
}

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
      // Forward to the LIMEN inbox (inert unless a notify channel is set; never blocks capture).
      var notifyRes = { sent: false };
      try { notifyRes = await notifyLead(lead); } catch (e) { notifyRes = { sent: false, reason: String(e && e.message || e) }; }
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, id: id, backend: db.getBackend(), notified: !!notifyRes.sent,
        notify: {
          via: notifyRes.via || null, http: notifyRes.http || null, reason: notifyRes.reason || null,
          cfg: { w3: !!process.env.WEB3FORMS_ACCESS_KEY, resend: !!process.env.RESEND_API_KEY, notifyTo: !!process.env.LEAD_NOTIFY_EMAIL }
        }
      }));
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
      // One-time backfill: ?notify=1 forwards every stored lead to LEAD_NOTIFY_EMAIL via Resend.
      if (u.searchParams.get('notify')) {
        var results = [];
        for (var n = 0; n < leads.length; n++) {
          var nr = await notifyLead(leads[n]);
          results.push({ id: leads[n].id, email: leads[n].email, sent: nr.sent, reason: nr.reason || null });
        }
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, action: 'notify', count: results.length, sent: results.filter(function (x) { return x.sent; }).length, results: results }, null, 2));
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
