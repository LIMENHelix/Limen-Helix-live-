/**
 * crm.js — /api/crm — the outreach CRM (LEADS → APPOINTMENTS).
 *
 * LASER is the flow; this is where a lead is actually WORKED into an appointment
 * via mail / email / text / call. It tracks every touch, its outcome and cost,
 * suggests the next cadence step, books the appointment, and measures which
 * channel converts leads → appointments for what cost. Every logged touch is
 * mirrored into the sales funnel (leads>appointments) so the hub + optimizer
 * learn from real activity.
 *
 * GUARDRAIL: this LOGS outreach you performed and TRACKS outcomes. It does NOT
 * itself send mail/email/text/calls — sending stays a deliberate action (rep, or
 * a future Twilio/Resend/mail integration). Nothing here contacts anyone.
 *
 * Storage (Redis via limen-db):
 *   crm:worklist          array of leadIds currently in the CRM
 *   crm:state:<leadId>    { leadId, contact snapshot, status, touches[], apptAt, nextAt }
 *   crm:cadence           the LASER cadence steps
 *   sales:agg / sales:meta  shared with the funnel (mirror target)
 *
 * Actions (?action=; all data actions need ?key=):
 *   GET  status                          (public) backend + cadence length
 *   GET  worklist [&status&company&domain]  worklist joined states + status counts
 *   POST load     {company?,domain?,source?,limit}  pull leadgen leads into CRM
 *   GET  lead     &leadId                 one full state
 *   POST touch    {leadId,channel,outcome,note?,apptAt?,dealSize?,trigger?}
 *   POST appointment {leadId,apptAt,note?,channel?}
 *   POST status   {leadId,status}         set pipeline status
 *   POST remove   {leadId}                drop from worklist (keeps the lead)
 *   GET  cadence  |  POST cadence {steps} the LASER cadence
 *   GET  metrics                          conversion by channel + cost/appt + pipeline
 */

var db = require('../lib/limen-db');
var E = require('../lib/sales-engine');

var K = {
  worklist: 'crm:worklist',
  state: 'crm:state:',
  cadence: 'crm:cadence',
  suppress: 'crm:suppress',
  lgIndex: 'leadgen:index',
  lgLead: 'leadgen:lead:',
  salesAgg: 'sales:agg',
  salesMeta: 'sales:meta'
};

var CHANNELS = ['call', 'text', 'email', 'mailer', 'social', 'other'];
var OUTCOMES = ['sent', 'no-answer', 'left-voicemail', 'bad-contact', 'replied', 'callback', 'not-interested', 'booked', 'dead'];
var STATUSES = ['new', 'working', 'appointment', 'unresponsive', 'dead'];

// per-touch cost (cents) — from the funnel's leads>appointments transition
var TX = E.TRANSITIONS.filter(function (t) { return t.id === 'leads>appointments'; })[0];
var CHANNEL_COST = (TX && TX.options) || { call: 45, text: 4, email: 2, mailer: 60, social: 12, other: 20 };

// The LASER outreach cadence: "4 calls in ~10 days" + multi-channel touches.
var DEFAULT_CADENCE = [
  { step: 1, day: 0, channel: 'call', label: 'Call 1 — first attempt' },
  { step: 2, day: 0, channel: 'text', label: 'Text 1 — right after the call' },
  { step: 3, day: 1, channel: 'email', label: 'Email 1 — value + booking link' },
  { step: 4, day: 3, channel: 'call', label: 'Call 2' },
  { step: 5, day: 5, channel: 'text', label: 'Text 2' },
  { step: 6, day: 7, channel: 'call', label: 'Call 3' },
  { step: 7, day: 10, channel: 'mailer', label: 'Mailer — tangible touch' },
  { step: 8, day: 12, channel: 'call', label: 'Call 4 — final attempt' }
];

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var data = ''; req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); }); req.on('error', function () { resolve(''); });
  });
}
function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(obj)); }
function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }

async function loadWorklist() { var w = await db.get(K.worklist); return Array.isArray(w) ? w : []; }
async function loadCadence() { var c = await db.get(K.cadence); return Array.isArray(c) && c.length ? c : DEFAULT_CADENCE; }
async function loadState(id) { return await db.get(K.state + id); }

// Next cadence step for a state: first step whose index is past the count of
// completed touches (simple sequential progression).
function nextStep(state, cadence) {
  var done = (state.touches || []).length;
  if (done >= cadence.length) return null;
  return cadence[done];
}

// Mirror one touch into the funnel's leads>appointments transition.
async function mirrorTouch(channel, won, cost, dealSize, trigger) {
  var agg = (await db.get(K.salesAgg)) || E.emptyAgg();
  E.applyEvent(agg, {
    transitionId: 'leads>appointments', from: 'leads', to: 'appointments',
    unit: channel, won: !!won, costCents: cost || 0,
    dealSize: dealSize || 'medium', trigger: trigger || 'trust'
  });
  await db.set(K.salesAgg, agg);
  try {
    var meta = (await db.get(K.salesMeta)) || {};
    meta.realEvents = (meta.realEvents || 0) + 1;
    meta.dataMode = (meta.simEvents > 0) ? 'mixed' : 'real';
    await db.set(K.salesMeta, meta);
  } catch (e) {}
}

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }

// Email sending config — reported by status, enforced by send-email.
function emailConfig() {
  var apiKey = process.env.RESEND_API_KEY || '';
  var from = process.env.RESEND_FROM_EMAIL || process.env.CRM_FROM_EMAIL || process.env.LEAD_FROM_EMAIL || '';
  var replyTo = process.env.CRM_REPLY_TO || process.env.LEAD_NOTIFY_EMAIL || '';
  var addr = process.env.CRM_SENDER_ADDRESS || '';
  var sandbox = /resend\.dev/i.test(from) || !from;
  return { hasKey: !!apiKey, from: from, replyTo: replyTo, addr: addr, sandbox: sandbox, apiKey: apiKey };
}

async function loadSuppress() { return (await db.get(K.suppress)) || {}; }

// Compliant HTML: the body + sender identity + physical address + unsubscribe.
function emailHtml(bodyText, toEmail, cfg) {
  var base = 'https://limenhelix.com/api/crm?action=unsubscribe&e=' + encodeURIComponent(toEmail);
  var body = esc(bodyText).replace(/\n/g, '<br>');
  var footerAddr = cfg.addr ? esc(cfg.addr) : '[sender postal address not configured — set CRM_SENDER_ADDRESS]';
  return '<div style="font-family:sans-serif;font-size:14px;line-height:1.55;color:#111">' + body +
    '<hr style="border:none;border-top:1px solid #ddd;margin:22px 0 10px">' +
    '<div style="font-size:11px;color:#888">' + footerAddr +
    '<br>You received this because we believe it is relevant to you. ' +
    '<a href="' + base + '" style="color:#888">Unsubscribe</a> or reply STOP to opt out.</div></div>';
}

async function sendEmailResend(cfg, toEmail, subject, bodyText) {
  var payload = {
    from: cfg.from,
    to: [toEmail],
    subject: subject,
    html: emailHtml(bodyText, toEmail, cfg),
    text: bodyText + '\n\n---\n' + (cfg.addr || '') + '\nUnsubscribe: https://limenhelix.com/api/crm?action=unsubscribe&e=' + encodeURIComponent(toEmail) + '  (or reply STOP)'
  };
  if (cfg.replyTo) payload.reply_to = cfg.replyTo;
  try {
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(payload)
    });
    var jd = await r.json().catch(function () { return {}; });
    if (!r.ok) return { ok: false, error: (jd && (jd.message || jd.name)) || ('resend ' + r.status), status: r.status };
    return { ok: true, id: jd && jd.id };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();
  var u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var action = (u.searchParams.get('action') || 'status').toLowerCase();

  // Public unsubscribe — adds an address to the suppression list. Safe to be
  // public: it only PREVENTS sending. Returns a tiny confirmation page.
  if (action === 'unsubscribe') {
    var e = '';
    try { e = (u.searchParams.get('e') || '').toLowerCase().trim(); } catch (x) {}
    if (validEmail(e)) {
      try { var sup = await loadSuppress(); sup[e] = { ts: new Date().toISOString(), reason: 'unsubscribe' }; await db.set(K.suppress, sup); } catch (x) {}
    }
    res.statusCode = 200; res.setHeader('content-type', 'text/html');
    return res.end('<!doctype html><meta charset="utf-8"><title>Unsubscribed</title><body style="font-family:sans-serif;max-width:520px;margin:60px auto;color:#222"><h2>You are unsubscribed</h2><p>' + (validEmail(e) ? esc(e) : 'That address') + ' will not receive further email from us. You can close this page.</p></body>');
  }

  if (action === 'status') {
    var wl = await loadWorklist();
    var ec = emailConfig();
    return j(res, 200, {
      ok: true, surface: 'crm', backend: db.getBackend(),
      keyConfigured: !!(process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY),
      inWorklist: wl.length, channels: CHANNELS, outcomes: OUTCOMES, statuses: STATUSES,
      email: { ready: ec.hasKey && !ec.sandbox, hasKey: ec.hasKey, from: ec.from || null, sandbox: ec.sandbox, replyToSet: !!ec.replyTo, addrSet: !!ec.addr }
    });
  }

  var ADMIN = process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY || '';
  var key = u.searchParams.get('key') || (req.headers && req.headers['x-sales-key']) || '';
  if (!ADMIN) return j(res, 503, { ok: false, error: 'CRM admin not configured. No data exposed.' });
  if (key !== ADMIN) return j(res, 403, { ok: false, error: 'Valid admin key required (?key=).' });

  try {
    if (method === 'GET' && action === 'cadence') return j(res, 200, { ok: true, cadence: await loadCadence(), channelCost: CHANNEL_COST });

    if (method === 'GET' && action === 'worklist') {
      var fstatus = u.searchParams.get('status') || '';
      var fcompany = u.searchParams.get('company') || '';
      var fdomain = u.searchParams.get('domain') || '';
      var limit = Math.min(parseInt(u.searchParams.get('limit') || '100', 10) || 100, 300);
      var ids = await loadWorklist();
      var cadence = await loadCadence();
      var rows = [], counts = { new: 0, working: 0, appointment: 0, unresponsive: 0, dead: 0 };
      for (var i = 0; i < ids.length; i++) {
        var st = await loadState(ids[i]);
        if (!st) continue;
        if (st.status in counts) counts[st.status]++;
        if (fstatus && st.status !== fstatus) continue;
        if (fcompany && st.company !== fcompany) continue;
        if (fdomain && st.domain !== fdomain) continue;
        if (rows.length < limit) {
          var ns = nextStep(st, cadence);
          rows.push({
            leadId: st.leadId, name: st.name, email: st.email, phone: st.phone,
            company: st.company, domain: st.domain, source: st.source, score: st.score,
            status: st.status, touchCount: (st.touches || []).length, lastTouch: (st.touches || []).slice(-1)[0] || null,
            apptAt: st.apptAt || null, nextStep: ns, notes: st.notes || ''
          });
        }
      }
      return j(res, 200, { ok: true, count: rows.length, total: ids.length, counts: counts, worklist: rows });
    }

    if (method === 'GET' && action === 'lead') {
      var lid = u.searchParams.get('leadId') || '';
      var s = await loadState(lid);
      if (!s) return j(res, 404, { ok: false, error: 'not in CRM' });
      s.nextStep = nextStep(s, await loadCadence());
      return j(res, 200, { ok: true, state: s });
    }

    if (method === 'GET' && action === 'metrics') {
      var funnel = E.computeFunnel((await db.get(K.salesAgg)) || E.emptyAgg());
      var l2a = (funnel.transitions || []).filter(function (t) { return t.id === 'leads>appointments'; })[0] || null;
      var ids2 = await loadWorklist();
      var pc = { new: 0, working: 0, appointment: 0, unresponsive: 0, dead: 0 };
      var touchTotal = 0;
      for (var m = 0; m < ids2.length; m++) { var s2 = await loadState(ids2[m]); if (!s2) continue; if (s2.status in pc) pc[s2.status]++; touchTotal += (s2.touches || []).length; }
      var appts = pc.appointment;
      return j(res, 200, {
        ok: true,
        pipeline: pc, inWorklist: ids2.length, touchTotal: touchTotal,
        touchesPerAppt: appts ? +(touchTotal / appts).toFixed(1) : null,
        leadsToAppt: l2a
      });
    }

    var raw = '', body = {};
    if (method === 'POST') { raw = await readBody(req); body = raw; if (typeof raw === 'string' && raw) { try { body = JSON.parse(raw); } catch (e) { body = {}; } } if (!body || typeof body !== 'object') body = {}; }

    if (method === 'POST' && action === 'cadence') {
      if (!Array.isArray(body.steps) || !body.steps.length) return j(res, 400, { ok: false, error: 'steps[] required' });
      await db.set(K.cadence, body.steps.slice(0, 20));
      return j(res, 200, { ok: true, saved: body.steps.length });
    }

    // Pull leadgen leads into the CRM worklist (snapshot contact fields).
    if (method === 'POST' && action === 'load') {
      var company = clip(body.company, 80), domain = clip(body.domain, 40), source = clip(body.source, 40);
      var want = Math.min(parseInt(body.limit, 10) || 50, 200);
      var idx = (await db.get(K.lgIndex)) || [];
      var wl2 = await loadWorklist();
      var inList = {}; wl2.forEach(function (id) { inList[id] = 1; });
      var added = 0, scanned = 0;
      for (var q = 0; q < idx.length && added < want; q++) {
        scanned++;
        var lgId = idx[q];
        if (inList[lgId]) continue;
        var lead = await db.get(K.lgLead + lgId);
        if (!lead) continue;
        if (company && lead.company !== company) continue;
        if (domain && (lead.domain || '') !== domain) continue;
        if (source && lead.source !== source) continue;
        var state = {
          leadId: lgId, name: lead.name || '', email: lead.email || '', phone: lead.phone || '',
          company: lead.company || '', domain: lead.domain || '', source: lead.source || '', score: lead.score || 0,
          notes: lead.notes || '', status: 'new', touches: [], apptAt: null, nextAt: null,
          createdTs: new Date().toISOString(), updatedTs: new Date().toISOString()
        };
        await db.set(K.state + lgId, state);
        wl2.unshift(lgId); inList[lgId] = 1; added++;
      }
      await db.set(K.worklist, wl2);
      return j(res, 200, { ok: true, added: added, scanned: scanned, inWorklist: wl2.length });
    }

    if (method === 'POST' && action === 'touch') {
      var tid = clip(body.leadId, 80);
      var st3 = await loadState(tid);
      if (!st3) return j(res, 404, { ok: false, error: 'lead not in CRM (load it first)' });
      var channel = CHANNELS.indexOf(body.channel) !== -1 ? body.channel : 'call';
      var outcome = OUTCOMES.indexOf(body.outcome) !== -1 ? body.outcome : 'no-answer';
      var cost = CHANNEL_COST[channel] || 0;
      var touch = { ts: new Date().toISOString(), channel: channel, outcome: outcome, note: clip(body.note, 500), costCents: cost };
      st3.touches = st3.touches || []; st3.touches.push(touch);
      var booked = outcome === 'booked';
      if (booked) { st3.status = 'appointment'; if (body.apptAt) st3.apptAt = clip(body.apptAt, 40); }
      else if (outcome === 'dead' || outcome === 'not-interested') st3.status = 'dead';
      else st3.status = 'working';
      st3.updatedTs = new Date().toISOString();
      await db.set(K.state + tid, st3);
      // mirror into the funnel (every touch = an attempt; booked = a win)
      await mirrorTouch(channel, booked, cost, body.dealSize, body.trigger);
      return j(res, 200, { ok: true, status: st3.status, touchCount: st3.touches.length, booked: booked });
    }

    // Send a real email via Resend, then auto-log the touch. Outward-facing:
    // operator-triggered per lead, checked against the suppression list.
    if (method === 'POST' && action === 'send-email') {
      var eid = clip(body.leadId, 80);
      var este = await loadState(eid);
      if (!este) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      if (!validEmail(este.email)) return j(res, 400, { ok: false, error: 'lead has no valid email' });
      var subject = clip(body.subject, 200), text = clip(body.body, 8000);
      if (!subject || !text) return j(res, 400, { ok: false, error: 'subject and body required' });
      var cfg = emailConfig();
      if (!cfg.hasKey) return j(res, 503, { ok: false, error: 'Email not configured. Set RESEND_API_KEY in Vercel.' });
      if (cfg.sandbox) return j(res, 503, { ok: false, error: 'RESEND_FROM_EMAIL is unset or a resend.dev sandbox address, which can only email your own account. Verify a domain in Resend and set RESEND_FROM_EMAIL to an address on it.' });
      var sup = await loadSuppress();
      if (sup[este.email.toLowerCase()]) return j(res, 409, { ok: false, error: 'This address has unsubscribed — not sending.', suppressed: true });
      var sr = await sendEmailResend(cfg, este.email, subject, text);
      if (!sr.ok) return j(res, 502, { ok: false, error: 'Resend: ' + sr.error, hint: sr.status === 403 || /domain|verif/i.test(sr.error || '') ? 'Likely the sending domain is not verified in Resend.' : null });
      // auto-log the touch + mirror as an attempt (no reply yet)
      var costE = CHANNEL_COST.email || 0;
      este.touches = este.touches || [];
      este.touches.push({ ts: new Date().toISOString(), channel: 'email', outcome: 'sent', note: '✉ ' + subject, costCents: costE, providerId: sr.id || null });
      if (este.status === 'new') este.status = 'working';
      este.updatedTs = new Date().toISOString();
      await db.set(K.state + eid, este);
      await mirrorTouch('email', false, costE, body.dealSize, body.trigger);
      return j(res, 200, { ok: true, sent: true, id: sr.id || null, warning: cfg.addr ? null : 'No CRM_SENDER_ADDRESS set — CAN-SPAM requires a physical postal address in the footer.' });
    }

    if (method === 'POST' && action === 'appointment') {
      var aid = clip(body.leadId, 80);
      var st4 = await loadState(aid);
      if (!st4) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      st4.status = 'appointment';
      st4.apptAt = clip(body.apptAt, 40);
      st4.apptNote = clip(body.note, 500);
      st4.updatedTs = new Date().toISOString();
      // if the booking channel is given and the last touch wasn't already a booking, mirror a win
      var last = (st4.touches || []).slice(-1)[0];
      if (!last || last.outcome !== 'booked') {
        var ch = CHANNELS.indexOf(body.channel) !== -1 ? body.channel : ((last && last.channel) || 'call');
        st4.touches = st4.touches || [];
        st4.touches.push({ ts: new Date().toISOString(), channel: ch, outcome: 'booked', note: 'appointment set', costCents: 0 });
        await mirrorTouch(ch, true, 0, body.dealSize, body.trigger);
      }
      await db.set(K.state + aid, st4);
      return j(res, 200, { ok: true, status: 'appointment', apptAt: st4.apptAt });
    }

    if (method === 'POST' && action === 'status') {
      var sid = clip(body.leadId, 80);
      var st5 = await loadState(sid);
      if (!st5) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      if (STATUSES.indexOf(body.status) === -1) return j(res, 400, { ok: false, error: 'bad status' });
      st5.status = body.status; st5.updatedTs = new Date().toISOString();
      await db.set(K.state + sid, st5);
      return j(res, 200, { ok: true, status: st5.status });
    }

    if (method === 'POST' && action === 'remove') {
      var rid = clip(body.leadId, 80);
      var wl3 = (await loadWorklist()).filter(function (id) { return id !== rid; });
      await db.set(K.worklist, wl3);
      await db.del(K.state + rid);
      return j(res, 200, { ok: true, removed: rid, inWorklist: wl3.length });
    }

    return j(res, 405, { ok: false, error: 'Unsupported action/method: ' + method + ' ' + action });
  } catch (e) {
    return j(res, 500, { ok: false, error: String(e && e.message || e) });
  }
};
