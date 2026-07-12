/**
 * autopilot.js — /api/autopilot — the AUTONOMOUS SALES ENGINE.
 *
 * For every lead in the CRM it computes the NEXT BEST ACTION from its stage, the
 * LASER cadence, and the FITT/SET/FBA optimizer, then on each tick it
 * AUTO-EXECUTES what it safely can (email, once Resend is verified) and QUEUES
 * everything a human or a missing integration must do (calls, texts, mailers,
 * and the close itself). It advances leads on outcomes, so the funnel runs
 * itself from lead-gen to referral.
 *
 * DOMAIN-READY, NOT DOMAIN-WIRED: `domainGate(state)` is a pass-through hook.
 * When you wire domain signals (elsewhere), gate the machine there — this engine
 * does not touch any domain.
 *
 * TWO-SPEED AUTONOMY: config.mode 'recommend' = queue only (nothing fires).
 * 'control' = auto-send email (guarded: verified domain + suppression + kill).
 * armed=false = fully idle. The cron only acts when armed. Nothing else auto-
 * executes — calls/texts/mailers/closes are always queued for a human.
 *
 * Storage:
 *   autopilot:config  { armed, mode, maxPerTick, autoEmail }
 *   autopilot:queue   [ due actions for the rep ]
 *   autopilot:lastrun { ts, scanned, executed, queued, errors }
 *   reads crm:* (states/cadence), sales:plays (optimizer), sales:agg (mirror)
 */

var db = require('../lib/limen-db');
var E = require('../lib/sales-engine');
var send = require('../lib/crm-send');
var kill;
try { kill = require('../lib/ai-kill-switch'); } catch (e) { kill = null; }

var K = {
  config: 'autopilot:config', queue: 'autopilot:queue', lastrun: 'autopilot:lastrun',
  worklist: 'crm:worklist', state: 'crm:state:', cadence: 'crm:cadence',
  plays: 'sales:plays', salesAgg: 'sales:agg', salesMeta: 'sales:meta'
};
var DAY = 86400000;
var CH_COST = { call: 45, text: 4, email: 2, mailer: 60, social: 12, other: 20, 'confirm-email': 2, 'confirm-text': 4, 'confirm-call': 45 };
var TERMINAL = { referred: 1, dead: 1, lost: 1, cancelled: 1, unresponsive: 1, 'no-show': 1 };

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    if (!req || typeof req.on !== 'function') return resolve('');
    var data = ''; req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); }); req.on('error', function () { resolve(''); });
  });
}
function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(obj)); }
function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
function nowMs() { return new Date().getTime(); }

async function loadConfig() { return Object.assign({ armed: false, mode: 'recommend', maxPerTick: 25, autoEmail: true }, (await db.get(K.config)) || {}); }
async function loadCadence() { var c = await db.get(K.cadence); return Array.isArray(c) && c.length ? c : DEFAULT_CADENCE; }
// MAILER FIRST: it has the longest lead time (1-2 wks to land + be opened), so
// it goes out day 0 to start the clock, and you work phone/text WHILE it travels.
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

// Pass-through domain gate — where per-domain/cell signal plugs in later.
function domainGate(state) { return { allow: true }; }

// Pick the top optimizer play for a transition+segment (FITT/SET/FBA content).
function bestPlay(plays, transitionId, dealSize, trigger) {
  var cands = plays.filter(function (p) { return p.transitionId === transitionId && (!dealSize || p.dealSize === dealSize) && (!trigger || p.trigger === trigger); });
  if (!cands.length) cands = plays.filter(function (p) { return p.transitionId === transitionId; });
  if (!cands.length) return null;
  cands.sort(function (a, b) { return E.wilsonLower(b.wins, b.trials) - E.wilsonLower(a.wins, a.trials) || (b.trials - a.trials); });
  var p = cands[0];
  return { unit: p.unit, notation: p.notation, copy: p.copy || {}, source: p.source };
}

// The decision: next best action for one lead. Returns null if nothing due.
function nextAction(state, cadence, plays, now) {
  var st = state.status || 'new';
  if (TERMINAL[st]) return null;
  var seg = { dealSize: state.dealSize || 'medium', trigger: state.trigger || 'trust' };
  var start = Date.parse(state.createdTs || state.ts || 0) || now;

  // NEW / WORKING → leads>appointments cadence
  if (st === 'new' || st === 'working') {
    var done = (state.touches || []).length;
    if (done >= cadence.length) return { kind: 'stalled', stage: 'appointments', label: 'Cadence exhausted — decide keep or drop', due: true, autoExecutable: false };
    var step = cadence[done];
    var dueAt = start + (step.day || 0) * DAY;
    if (now < dueAt) return { kind: 'wait', due: false, dueAt: dueAt };
    return {
      kind: 'outreach', stage: 'appointments', transition: 'leads>appointments',
      channel: step.channel, label: step.label, due: true,
      autoExecutable: step.channel === 'email',
      play: bestPlay(plays, 'leads>appointments', seg.dealSize, seg.trigger)
    };
  }
  // APPOINTMENT → appointments>shows confirmations
  if (st === 'appointment') {
    var confs = (state.confirmations || []);
    if (confs.length >= 3) return { kind: 'wait', due: false };
    var lastC = confs.slice(-1)[0];
    var lastCts = lastC ? (Date.parse(lastC.ts) || 0) : 0;
    if (lastCts && (now - lastCts) < 0.5 * DAY) return { kind: 'wait', due: false, dueAt: lastCts + 0.5 * DAY };
    var cch = ['confirm-text', 'confirm-email', 'confirm-call'][confs.length] || 'confirm-call';
    return {
      kind: 'confirm', stage: 'shows', transition: 'appointments>shows',
      channel: cch, label: 'Confirm appointment (' + cch.replace('confirm-', '') + ')', due: true,
      autoExecutable: cch === 'confirm-email',
      play: bestPlay(plays, 'appointments>shows', seg.dealSize, seg.trigger)
    };
  }
  // SHOWED → shows>enrollments close (human)
  if (st === 'showed') {
    return {
      kind: 'close', stage: 'enrollments', transition: 'shows>enrollments',
      channel: 'presentation', label: 'CLOSE — run the offer (human)', due: true, autoExecutable: false,
      play: bestPlay(plays, 'shows>enrollments', seg.dealSize, seg.trigger)
    };
  }
  // ENROLLED → enrollments>referrals ask
  if (st === 'enrolled') {
    if (state.referAsked) return { kind: 'wait', due: false };
    return {
      kind: 'refer', stage: 'referrals', transition: 'enrollments>referrals',
      channel: 'email', label: 'Ask for referrals', due: true, autoExecutable: true,
      play: bestPlay(plays, 'enrollments>referrals', seg.dealSize, seg.trigger)
    };
  }
  return null;
}

// email content for an auto-executable action (template from the play copy).
function emailFor(action, state) {
  var first = String(state.name || '').trim().split(/\s+/)[0] || 'there';
  var c = (action.play && action.play.copy) || {};
  if (action.kind === 'confirm') {
    return { subject: 'Confirming our appointment', body: 'Hi ' + first + ',\n\nJust confirming our upcoming appointment. Reply here if you need to adjust the time.\n\nTalk soon.' };
  }
  if (action.kind === 'refer') {
    return { subject: 'A quick favor', body: 'Hi ' + first + ',\n\nGlad to have you on board. If anyone you know could use what we do, I would be grateful for an introduction. Just reply with a name and the best way to reach them.\n\nThank you.' };
  }
  var line = c.fact ? (c.fact + '\n\n' + (c.need || '') + '\n\n' + (c.tie || '')) : 'I wanted to reach out and see if we could find a time to talk.';
  return { subject: 'Quick note', body: 'Hi ' + first + ',\n\n' + line + '\n\nBest.' };
}

// Apply an executed email to the lead state + mirror the funnel.
async function applyExecutedEmail(state, action) {
  var cost = CH_COST[action.channel] || 2;
  if (action.kind === 'outreach') {
    state.touches = state.touches || [];
    state.touches.push({ ts: new Date().toISOString(), channel: 'email', outcome: 'sent', note: '✉ autopilot', costCents: cost, auto: true });
    if (state.status === 'new') state.status = 'working';
    await mirror('leads>appointments', 'leads', 'appointments', 'email', false, cost, state.dealSize, state.trigger);
  } else if (action.kind === 'confirm') {
    state.confirmations = state.confirmations || [];
    state.confirmations.push({ ts: new Date().toISOString(), channel: 'confirm-email', note: 'autopilot', costCents: cost, auto: true });
    state.confirmCostCents = (state.confirmCostCents || 0) + cost;
  } else if (action.kind === 'refer') {
    state.referAsked = true;
  }
  state.updatedTs = new Date().toISOString();
}
async function mirror(transitionId, from, to, unit, won, cost, dealSize, trigger) {
  var agg = (await db.get(K.salesAgg)) || E.emptyAgg();
  E.applyEvent(agg, { transitionId: transitionId, from: from, to: to, unit: unit, won: !!won, costCents: cost || 0, dealSize: dealSize || 'medium', trigger: trigger || 'trust' });
  await db.set(K.salesAgg, agg);
  try { var meta = (await db.get(K.salesMeta)) || {}; meta.realEvents = (meta.realEvents || 0) + 1; meta.dataMode = (meta.simEvents > 0) ? 'mixed' : 'real'; await db.set(K.salesMeta, meta); } catch (e) {}
}

async function runTick(cfg) {
  var ids = (await db.get(K.worklist)) || [];
  var cadence = await loadCadence();
  var plays = (await db.get(K.plays)) || [];
  var now = nowMs();
  var emailReady = send.emailConfig().ready;
  // NOTE: no AI kill-switch gate here — the autopilot sends TEMPLATE emails, not
  // AI output. The autopilot's own armed/mode/disarm switches are its stop. (If
  // AI-drafted copy is added later, gate that AI call, not the send.)
  var scanned = 0, executed = 0, queued = 0, errors = 0;
  var queue = [];
  var cap = Math.max(1, Math.min(cfg.maxPerTick || 25, 200));
  for (var i = 0; i < ids.length && scanned < cap; i++) {
    var state = await db.get(K.state + ids[i]);
    if (!state) continue;
    if (TERMINAL[state.status]) continue;
    scanned++;
    if (!domainGate(state).allow) continue;
    var action = nextAction(state, cadence, plays, now);
    if (!action || !action.due) continue;
    var canAuto = cfg.mode === 'control' && cfg.autoEmail && action.autoExecutable && action.channel && /email/.test(action.channel) && emailReady && state.email;
    if (canAuto) {
      var mail = emailFor(action, state);
      var sent = await send.sendToLead(state.email, mail.subject, mail.body);
      if (sent.ok) {
        await applyExecutedEmail(state, action);
        await db.set(K.state + ids[i], state);
        executed++;
        continue;
      }
      // could not send (suppressed / not ready / error) → fall through to queue with reason
      action.blocked = sent.error || 'send failed';
      if (sent.suppressed) { errors++; continue; }
    }
    queue.push({
      leadId: state.leadId, name: state.name, email: state.email, phone: state.phone,
      company: state.company, domain: state.domain, status: state.status,
      stage: action.stage, kind: action.kind, channel: action.channel, label: action.label,
      autoExecutable: !!action.autoExecutable, blocked: action.blocked || null,
      play: action.play ? { unit: action.play.unit, notation: action.play.notation } : null
    });
    queued++;
  }
  var lastrun = { ts: new Date().toISOString(), scanned: scanned, executed: executed, queued: queued, errors: errors, emailReady: emailReady, mode: cfg.mode };
  await db.set(K.queue, queue.slice(0, 300));
  await db.set(K.lastrun, lastrun);
  return lastrun;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();
  var u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var action = (u.searchParams.get('action') || 'status').toLowerCase();
  var isCron = !!(req.headers && (req.headers['x-vercel-cron'] || req.headers['x-vercel-signature']));
  // A cron hit with no explicit action means "tick" (robust to query-string stripping).
  if (isCron && action === 'status') action = 'tick';

  if (action === 'status') {
    var cfg0 = await loadConfig();
    return j(res, 200, {
      ok: true, surface: 'autopilot', backend: db.getBackend(),
      keyConfigured: !!(process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY),
      config: cfg0, lastrun: (await db.get(K.lastrun)) || null, emailReady: send.emailConfig().ready
    });
  }

  var ADMIN = process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY || '';
  var key = u.searchParams.get('key') || (req.headers && req.headers['x-sales-key']) || '';

  // tick may be invoked by the Vercel cron header OR an admin key.
  if (action === 'tick') {
    if (!isCron && (!ADMIN || key !== ADMIN)) return j(res, 403, { ok: false, error: 'cron or admin key required' });
    var cfgT = await loadConfig();
    if (!cfgT.armed) { await db.set(K.lastrun, { ts: new Date().toISOString(), scanned: 0, executed: 0, queued: 0, disarmed: true }); return j(res, 200, { ok: true, ran: false, reason: 'disarmed' }); }
    var lr = await runTick(cfgT);
    return j(res, 200, { ok: true, ran: true, result: lr });
  }

  if (!ADMIN) return j(res, 503, { ok: false, error: 'Autopilot admin not configured.' });
  if (key !== ADMIN) return j(res, 403, { ok: false, error: 'Valid admin key required (?key=).' });

  try {
    if (method === 'GET' && action === 'queue') return j(res, 200, { ok: true, queue: (await db.get(K.queue)) || [], lastrun: (await db.get(K.lastrun)) || null });

    // Dry-run preview: what WOULD the next tick do, without executing.
    if (method === 'GET' && action === 'plan') {
      var ids = (await db.get(K.worklist)) || [];
      var cadence = await loadCadence(); var plays = (await db.get(K.plays)) || []; var now = nowMs();
      var plan = [], stages = {}, autoCount = 0, scannedP = 0, totalDue = 0;
      for (var i = 0; i < ids.length; i++) {
        var s = await db.get(K.state + ids[i]); if (!s || TERMINAL[s.status]) continue;
        scannedP++;
        var a = nextAction(s, cadence, plays, now); if (!a || !a.due) continue;
        totalDue++;
        stages[a.stage] = (stages[a.stage] || 0) + 1;
        if (a.autoExecutable) autoCount++;
        if (plan.length < 300) plan.push({
          leadId: s.leadId, name: s.name, email: s.email, phone: s.phone, company: s.company, domain: s.domain,
          status: s.status, stage: a.stage, kind: a.kind, channel: a.channel, label: a.label,
          autoExecutable: !!a.autoExecutable, play: a.play ? { unit: a.play.unit, notation: a.play.notation } : null
        });
      }
      stages._auto = autoCount;
      return j(res, 200, { ok: true, dueCount: totalDue, scanned: scannedP, byStage: stages, plan: plan, emailReady: send.emailConfig().ready });
    }

    var raw = '', body = {};
    if (method === 'POST') { raw = await readBody(req); body = raw; if (typeof raw === 'string' && raw) { try { body = JSON.parse(raw); } catch (e) { body = {}; } } if (!body || typeof body !== 'object') body = {}; }

    if (method === 'POST' && action === 'config') {
      var cur = await loadConfig();
      if (body.armed !== undefined) cur.armed = !!body.armed;
      if (body.mode) cur.mode = body.mode === 'control' ? 'control' : 'recommend';
      if (body.autoEmail !== undefined) cur.autoEmail = !!body.autoEmail;
      if (body.maxPerTick !== undefined) cur.maxPerTick = Math.max(1, Math.min(200, num(body.maxPerTick, 25)));
      await db.set(K.config, cur);
      return j(res, 200, { ok: true, config: cur });
    }

    // Manual run-now (admin), same engine as the cron.
    if (method === 'POST' && action === 'run') {
      var cfgR = await loadConfig();
      if (!cfgR.armed) return j(res, 200, { ok: true, ran: false, reason: 'disarmed — arm first' });
      var lrR = await runTick(cfgR);
      return j(res, 200, { ok: true, ran: true, result: lrR });
    }

    return j(res, 405, { ok: false, error: 'Unsupported action/method: ' + method + ' ' + action });
  } catch (e) {
    return j(res, 500, { ok: false, error: String(e && e.message || e) });
  }
};
