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
var STATUSES = ['new', 'working', 'appointment', 'showed', 'no-show', 'cancelled', 'enrolled', 'lost', 'referred', 'unresponsive', 'dead'];
var SHOW_OUTCOMES = ['showed', 'no-show', 'cancelled'];
var CLOSE_LEVERS = ['closing', 'urgency', 'rapport', 'presentation', 'price-point', 'volume'];
var DEAL_SIZES = ['small', 'medium', 'large'];

// per-touch cost (cents) — from the funnel's leads>appointments transition
var TX = E.TRANSITIONS.filter(function (t) { return t.id === 'leads>appointments'; })[0];
var CHANNEL_COST = (TX && TX.options) || { call: 45, text: 4, email: 2, mailer: 60, social: 12, other: 20 };
// confirmation channels + cost — from the appointments>shows transition
var TX2 = E.TRANSITIONS.filter(function (t) { return t.id === 'appointments>shows'; })[0];
var CONFIRM_CHANNELS = TX2 ? Object.keys(TX2.options) : ['confirm-email', 'confirm-text', 'confirm-call', 'mailer', 'other'];
var CONFIRM_COST = (TX2 && TX2.options) || { 'confirm-email': 2, 'confirm-text': 4, 'confirm-call': 45, mailer: 60, other: 15 };

// The LASER outreach cadence: "4 calls in ~10 days" + multi-channel touches.
// MAILER FIRST: longest lead time (1-2 wks to land + be opened), so it goes out
// day 0 to start the clock; phone/text work the lead WHILE the mailer travels.
var DEFAULT_CADENCE = [
  { step: 1, day: 0, channel: 'mailer', label: 'Mailer — send now (1-2 wks to land; starts the clock)' },
  { step: 2, day: 1, channel: 'call', label: 'Call 1 — while the mailer is in transit' },
  { step: 3, day: 2, channel: 'text', label: 'Text 1' },
  { step: 4, day: 4, channel: 'call', label: 'Call 2' },
  { step: 5, day: 7, channel: 'text', label: 'Text 2' },
  { step: 6, day: 10, channel: 'call', label: 'Call 3 — mailer has landed' },
  { step: 7, day: 12, channel: 'email', label: 'Email 1 — reference the letter' },
  { step: 8, day: 14, channel: 'call', label: 'Call 4 — final attempt' }
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
  if (state.status !== 'new' && state.status !== 'working') return null;
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

// Mirror one appointment's show outcome into the funnel's appointments>shows
// transition (one event per appointment; unit = confirmation method used).
async function mirrorShow(channel, won, cost, dealSize, trigger) {
  var agg = (await db.get(K.salesAgg)) || E.emptyAgg();
  E.applyEvent(agg, {
    transitionId: 'appointments>shows', from: 'appointments', to: 'shows',
    unit: channel, won: !!won, costCents: cost || 0,
    dealSize: dealSize || 'medium', trigger: trigger || 'trust'
  });
  await db.set(K.salesAgg, agg);
  try { var meta = (await db.get(K.salesMeta)) || {}; meta.realEvents = (meta.realEvents || 0) + 1; meta.dataMode = (meta.simEvents > 0) ? 'mixed' : 'real'; await db.set(K.salesMeta, meta); } catch (e) {}
}

// Generic funnel mirror for the later transitions (shows>enrollments,
// enrollments>referrals). shows>enrollments with won books deal revenue in the
// engine (applyEvent tracks __enroll by dealSize).
async function mirrorTx(transitionId, from, to, unit, won, cost, dealSize, trigger) {
  var agg = (await db.get(K.salesAgg)) || E.emptyAgg();
  E.applyEvent(agg, { transitionId: transitionId, from: from, to: to, unit: unit, won: !!won, costCents: cost || 0, dealSize: dealSize || 'medium', trigger: trigger || 'trust' });
  await db.set(K.salesAgg, agg);
  try { var meta = (await db.get(K.salesMeta)) || {}; meta.realEvents = (meta.realEvents || 0) + 1; meta.dataMode = (meta.simEvents > 0) ? 'mixed' : 'real'; await db.set(K.salesMeta, meta); } catch (e) {}
}

// Referrals feed back into the LEADS bucket: each given referral becomes a new
// leadgen lead (source 'referral'), tagged to the same venture. Written to the
// leadgen keys directly so it surfaces on the Leads page and can be re-worked.
function refScore(r) { var s = 16; if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || '')) s += 30; if (String(r.phone || '').replace(/\D/g, '').length >= 10) s += 25; if (r.name) s += 15; return Math.min(100, s); }
async function captureReferralLeads(refs, company, domain) {
  var idx = await db.get('leadgen:index'); if (!Array.isArray(idx)) idx = [];
  var stats = (await db.get('leadgen:sourcestats')) || {};
  var added = 0, ts = new Date().toISOString();
  for (var i = 0; i < refs.length; i++) {
    var r = refs[i]; if (!r || (!r.email && !r.phone && !r.name)) continue;
    var id = 'LGR' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    var lead = { id: id, ts: ts, name: clip(r.name, 120), email: clip(r.email, 200), phone: clip(r.phone, 60), org: '', company: company || '', domain: domain || '', source: 'referral', score: refScore(r), status: 'new', notes: 'referral' };
    await db.set('leadgen:lead:' + id, lead); idx.unshift(id); added++;
    var st = stats.referral || (stats.referral = { count: 0, costCents: 0, scoreSum: 0 });
    st.count += 1; st.scoreSum += lead.score;
  }
  if (idx.length > 5000) idx = idx.slice(0, 5000);
  await db.set('leadgen:index', idx); await db.set('leadgen:sourcestats', stats);
  return added;
}

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }

// Email send/suppression via the SHARED compliant path (lib/crm-send) so the
// CRM and the autopilot never drift on unsubscribe/footer/reply-to rules.
var send = require('../lib/crm-send');
function emailConfig() { return send.emailConfig(); }
async function loadSuppress() { return send.loadSuppress(); }
async function sendEmailResend(cfg, toEmail, subject, bodyText) { return send.sendEmailResend(cfg, toEmail, subject, bodyText); }

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
      confirmChannels: CONFIRM_CHANNELS, showOutcomes: SHOW_OUTCOMES, closeLevers: CLOSE_LEVERS, dealSizes: DEAL_SIZES,
      email: { ready: ec.ready, hasKey: ec.hasKey, from: ec.from || null, sandbox: ec.sandbox, reason: ec.reason || null, replyToSet: !!ec.replyTo, addrSet: !!ec.addr }
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
      var rows = [], counts = {};
      STATUSES.forEach(function (status) { counts[status] = 0; });
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

    // Appointments for the Shows page: everything that reached the appointment
    // stage (booked, showed, no-show, cancelled), sorted by appointment time.
    if (method === 'GET' && action === 'appointments') {
      var afc = u.searchParams.get('company') || '';
      var afw = u.searchParams.get('when') || '';   // upcoming | past | unresolved | ''
      var nowMs = Date.parse(u.searchParams.get('now') || '') || 0;
      var ids4 = await loadWorklist();
      var appts = [], sc = { appointment: 0, showed: 0, 'no-show': 0, cancelled: 0 };
      for (var a = 0; a < ids4.length; a++) {
        var stA = await loadState(ids4[a]);
        if (!stA) continue;
        var isAppt = stA.status === 'appointment' || SHOW_OUTCOMES.indexOf(stA.status) !== -1 || stA.showOutcome;
        if (!isAppt) continue;
        if (stA.status in sc) sc[stA.status]++;
        if (afc && stA.company !== afc) continue;
        var apptMs = stA.apptAt ? Date.parse(stA.apptAt) : 0;
        if (afw === 'unresolved' && stA.status !== 'appointment') continue;
        if (afw === 'upcoming' && nowMs && apptMs && apptMs < nowMs) continue;
        if (afw === 'past' && nowMs && apptMs && apptMs >= nowMs) continue;
        appts.push({
          leadId: stA.leadId, name: stA.name, phone: stA.phone, email: stA.email,
          company: stA.company, domain: stA.domain, status: stA.status,
          apptAt: stA.apptAt || null, apptNote: stA.apptNote || '',
          confirmations: (stA.confirmations || []).length, lastConfirm: (stA.confirmations || []).slice(-1)[0] || null,
          showOutcome: stA.showOutcome || null
        });
      }
      appts.sort(function (x, y) { return (Date.parse(x.apptAt || 0) || 0) - (Date.parse(y.apptAt || 0) || 0); });
      return j(res, 200, { ok: true, count: appts.length, counts: sc, appointments: appts, confirmChannels: CONFIRM_CHANNELS });
    }

    if (method === 'GET' && action === 'show-metrics') {
      var funnelS = E.computeFunnel((await db.get(K.salesAgg)) || E.emptyAgg());
      var a2s = (funnelS.transitions || []).filter(function (t) { return t.id === 'appointments>shows'; })[0] || null;
      var idsS = await loadWorklist();
      var scS = { appointment: 0, showed: 0, 'no-show': 0, cancelled: 0 };
      for (var b = 0; b < idsS.length; b++) { var sB = await loadState(idsS[b]); if (!sB) continue; if (sB.status in scS) scS[sB.status]++; }
      var resolved = scS.showed + scS['no-show'];
      return j(res, 200, { ok: true, pipeline: scS, showRate: resolved ? +(scS.showed / resolved).toFixed(3) : null, apptsToShows: a2s });
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
      var pc = {};
      STATUSES.forEach(function (status) { pc[status] = 0; });
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
      if (cfg.sandbox) return j(res, 503, { ok: false, error: 'Email not sendable: ' + (cfg.reason || 'from-address not on a verified domain') + '.' });
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

    // Log a confirmation touch on an appointment (does NOT mirror; the show
    // outcome carries the appointments>shows win/loss).
    if (method === 'POST' && action === 'confirm') {
      var cfid = clip(body.leadId, 80);
      var stC = await loadState(cfid);
      if (!stC) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      var cch = CONFIRM_CHANNELS.indexOf(body.channel) !== -1 ? body.channel : CONFIRM_CHANNELS[0];
      var ccost = CONFIRM_COST[cch] || 0;
      stC.confirmations = stC.confirmations || [];
      stC.confirmations.push({ ts: new Date().toISOString(), channel: cch, note: clip(body.note, 300), costCents: ccost });
      stC.confirmCostCents = (stC.confirmCostCents || 0) + ccost;
      stC.updatedTs = new Date().toISOString();
      await db.set(K.state + cfid, stC);
      return j(res, 200, { ok: true, confirmations: stC.confirmations.length });
    }

    // Resolve an appointment's show outcome. Mirrors ONE appointments>shows
    // event (unit = confirmation channel used), won = showed.
    if (method === 'POST' && action === 'show-outcome') {
      var soid = clip(body.leadId, 80);
      var stO = await loadState(soid);
      if (!stO) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      var outcome = SHOW_OUTCOMES.indexOf(body.outcome) !== -1 ? body.outcome : 'showed';
      var lastC = (stO.confirmations || []).slice(-1)[0];
      var unit = CONFIRM_CHANNELS.indexOf(body.channel) !== -1 ? body.channel : ((lastC && lastC.channel) || 'other');
      stO.showOutcome = outcome; stO.status = outcome; stO.showTs = new Date().toISOString(); stO.updatedTs = stO.showTs;
      // mirror once (cancelled = neither show nor no-show → don't count against show rate)
      if (!stO.showMirrored && outcome !== 'cancelled') {
        await mirrorShow(unit, outcome === 'showed', stO.confirmCostCents || 0, body.dealSize, body.trigger);
        stO.showMirrored = true;
      }
      await db.set(K.state + soid, stO);
      return j(res, 200, { ok: true, status: stO.status, showOutcome: outcome });
    }

    // Reschedule: new time, back to appointment, allow a fresh show outcome.
    if (method === 'POST' && action === 'reschedule') {
      var rsid = clip(body.leadId, 80);
      var stR = await loadState(rsid);
      if (!stR) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      stR.apptAt = clip(body.apptAt, 40); stR.status = 'appointment'; stR.showOutcome = null; stR.showMirrored = false;
      stR.updatedTs = new Date().toISOString();
      await db.set(K.state + rsid, stR);
      return j(res, 200, { ok: true, status: 'appointment', apptAt: stR.apptAt });
    }

    // CLOSE: show → enrollment (the money stage). won books the deal + revenue.
    if (method === 'POST' && action === 'close') {
      var clid = clip(body.leadId, 80);
      var stCl = await loadState(clid);
      if (!stCl) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      var won = body.won !== false;
      var dealSize = DEAL_SIZES.indexOf(body.dealSize) !== -1 ? body.dealSize : 'medium';
      var lever = CLOSE_LEVERS.indexOf(body.lever) !== -1 ? body.lever : 'closing';
      if (won) { stCl.status = 'enrolled'; stCl.enrolledAt = new Date().toISOString(); stCl.dealSize = dealSize; stCl.revenueCents = parseInt(body.revenueCents, 10) || 0; stCl.closeLever = lever; }
      else { stCl.status = 'lost'; }
      stCl.updatedTs = new Date().toISOString();
      if (!stCl.closeMirrored) { await mirrorTx('shows>enrollments', 'shows', 'enrollments', lever, won, 0, dealSize, body.trigger); stCl.closeMirrored = true; }
      await db.set(K.state + clid, stCl);
      return j(res, 200, { ok: true, status: stCl.status, dealSize: won ? dealSize : null, revenueCents: won ? stCl.revenueCents : 0 });
    }

    // REFER: enrollment → referral. Given referrals feed back into the Leads bucket.
    if (method === 'POST' && action === 'refer') {
      var rfid = clip(body.leadId, 80);
      var stRf = await loadState(rfid);
      if (!stRf) return j(res, 404, { ok: false, error: 'lead not in CRM' });
      var rchannel = CHANNELS.indexOf(body.channel) !== -1 ? body.channel : 'text';
      var refs = Array.isArray(body.referrals) ? body.referrals.slice(0, 20) : [];
      var wonR = refs.length > 0 || body.won === true;
      stRf.referrals = (stRf.referrals || []).concat(refs.map(function (r) { return { name: clip(r.name, 120), email: clip(r.email, 200), phone: clip(r.phone, 60), ts: new Date().toISOString() }; }));
      stRf.referAsked = true;
      if (wonR) stRf.status = 'referred';
      stRf.updatedTs = new Date().toISOString();
      if (!stRf.referMirrored || wonR) { await mirrorTx('enrollments>referrals', 'enrollments', 'referrals', rchannel, wonR, CHANNEL_COST[rchannel] || 0, stRf.dealSize, body.trigger); stRf.referMirrored = true; }
      var addedRefs = refs.length ? await captureReferralLeads(refs, stRf.company, stRf.domain) : 0;
      await db.set(K.state + rfid, stRf);
      return j(res, 200, { ok: true, status: stRf.status, referralsGiven: stRf.referrals.length, referralsAddedToLeads: addedRefs });
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
