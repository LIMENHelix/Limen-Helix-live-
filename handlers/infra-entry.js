/**
 * handlers/infra-entry.js — public project-data capture for the infrastructure front.
 *
 * The value→data→leads wedge: the public "Plan Your Project" tool POSTs an (optionally
 * contactable) project here. We store it anonymized + keep a running aggregate (what's
 * being built where). Projects WITH consented contact = inbound LEADS the operator/Liz
 * read on the gated radar. Mirrors energy-entry.
 *
 *   POST /api/infra-entry              → capture a project { ok, id }
 *   GET  /api/infra-entry?public=1     → aggregate only (community view, no PII)
 *   GET  /api/infra-entry?key=KEY      → admin: list leads (master / infrastructure / LEAD_ADMIN_KEY)
 */
const db = require('../lib/limen-db');
const gate = require('../lib/admin-gate');

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var d = ''; req.on('data', function (c) { d += c; });
    req.on('end', function () { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}
function clip(v, n) { return String(v == null ? '' : v).slice(0, n).trim(); }

async function bumpAgg(rec) {
  var agg = null; try { agg = await db.get('infra:agg:v1'); } catch (e) {}
  if (!agg || typeof agg !== 'object') agg = { byType: {}, byState: {}, total: 0, leads: 0, updated: null };
  agg.byType[rec.projectType] = (agg.byType[rec.projectType] || 0) + 1;
  if (rec.state) agg.byState[rec.state] = (agg.byState[rec.state] || 0) + 1;
  agg.total = (agg.total || 0) + 1;
  if (rec.isLead) agg.leads = (agg.leads || 0) + 1;
  agg.updated = Date.now();
  try { await db.set('infra:agg:v1', agg); } catch (e) {}
  return agg;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();
  var u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }

  // ── POST: public capture ──
  if (method === 'POST') {
    var b = await readBody(req);
    var projectType = clip(b.projectType, 40);
    if (!projectType) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'projectType required' })); }
    var wantsContact = b.consent === true && (clip(b.email, 200) || clip(b.phone, 40));
    var id = 'IP' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    var rec = {
      id: id, ts: new Date().toISOString(),
      projectType: projectType,
      ownerType: clip(b.ownerType, 30),
      state: clip(b.state, 4).toUpperCase(),
      city: clip(b.city, 60),
      scope: clip(b.scope, 60),
      needs: Array.isArray(b.needs) ? b.needs.slice(0, 8).map(function (x) { return clip(x, 40); }) : [],
      estLow: Number(b.estLow) || 0, estHigh: Number(b.estHigh) || 0,
      note: clip(b.note, 600),
      isLead: !!wantsContact,
      contact: wantsContact ? { name: clip(b.name, 120), email: clip(b.email, 200), phone: clip(b.phone, 40) } : null
    };
    try {
      await db.set('infra:' + id, rec);
      await db.lpush('infra_index', id);
      await bumpAgg(rec);
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: 'store failed' })); }
    res.statusCode = 200; res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: true, id: id, isLead: rec.isLead }));
  }

  // ── GET ?public=1: aggregate only (no PII) ──
  if (u.searchParams.get('public') === '1') {
    var agg = null; try { agg = await db.get('infra:agg:v1'); } catch (e) {}
    res.statusCode = 200; res.setHeader('Cache-Control', 's-maxage=120');
    return res.end(JSON.stringify({ ok: true, aggregate: agg || { byType: {}, byState: {}, total: 0, leads: 0 } }));
  }

  // ── GET ?key=: admin read of leads (master / infrastructure / LEAD_ADMIN_KEY) ──
  var key = u.searchParams.get('key') || gate.reqKey(req);
  var okAdmin = gate.isMaster(key) || gate.hasDomain(key, 'infrastructure') || (process.env.LEAD_ADMIN_KEY && key === process.env.LEAD_ADMIN_KEY);
  if (!okAdmin) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Admin only.' })); }
  try {
    var ids = (await db.lrange('infra_index', 0, 200)) || [];
    var rows = [];
    for (var i = 0; i < ids.length; i++) { var r = await db.get('infra:' + ids[i]); if (r) rows.push(r); }
    res.statusCode = 200; res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: true, count: rows.length, leads: rows.filter(function (r) { return r.isLead; }), all: rows }));
  } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) })); }
};
