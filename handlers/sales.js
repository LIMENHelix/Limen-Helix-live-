/**
 * sales.js — /api/sales — the revenue-machine API.
 *
 * The SALES surface: a liquid 5-bucket funnel (LEADS → APPOINTMENTS → SHOWS →
 * ENROLLMENTS → REFERRALS, referrals feeding back into leads) whose every
 * "play" is a composable FITT/SET/FBA unit run through the LASER engine. This
 * endpoint stores plays + outcomes, computes conversion %/cost per channel,
 * scores plays with a Wilson-lower bandit, and reallocates toward winners —
 * segmented by deal size and emotional trigger.
 *
 * ACTIONS (all take ?action=; mutations + data reads require ?key=):
 *   GET  ?action=status                      (public) providers + backend + counts
 *   GET  ?action=config      &key=           the taxonomy config
 *   POST ?action=config      &key=  {config} save an edited config
 *   GET  ?action=funnel      &key=           computed %/cost dashboard
 *   GET  ?action=plays       &key= [&stage=] plays + Wilson scores + allocation
 *   GET  ?action=events      &key= [&limit=] recent raw events (feed)
 *   POST ?action=seed        &key= [{force}] ensure full-coverage template plays
 *   POST ?action=event       &key=  {event}  log ONE real outcome
 *   POST ?action=simulate    &key=  {n,seed} run the LABELED simulator
 *   POST ?action=generate    &key=  {transitionId,dealSize,trigger,count} AI plays
 *   POST ?action=reset       &key=           wipe sales:* (clean demo)
 *
 * GUARDRAILS
 *  - Nothing here contacts anyone, sends anything, or files anything. It stores
 *    and computes. Simulated data is flagged `simulated:true` end to end and the
 *    machine's `meta.dataMode` reports whether ANY real events exist.
 *  - AI generation routes through lib/ai-orchestrator, which sits behind the
 *    global AI kill-switch + budget gate. If AI is off it falls back to
 *    deterministic template plays (source:'template'). No silent spend.
 *  - Admin key = MINIMAL protection, not real auth. SALES_ADMIN_KEY (falls back
 *    to LEAD_ADMIN_KEY). If neither is set, data actions are disabled.
 */

var db = require('../lib/limen-db');
var E = require('../lib/sales-engine');
var orchestrator;
try { orchestrator = require('../lib/ai-orchestrator'); } catch (e) { orchestrator = null; }

var K = {
  config: 'sales:config',
  agg: 'sales:agg',
  plays: 'sales:plays',
  events: 'sales:events',
  meta: 'sales:meta'
};
var EVENTS_CAP = 500;
var PLAYS_CAP = 1200;

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); });
    req.on('error', function () { resolve(''); });
  });
}
function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(obj)); }

async function loadConfig() { return (await db.get(K.config)) || E.defaultConfig(); }
async function loadPlays() { var p = await db.get(K.plays); return Array.isArray(p) ? p : []; }
async function loadAgg() { return (await db.get(K.agg)) || E.emptyAgg(); }
async function loadMeta() { return (await db.get(K.meta)) || { dataMode: 'empty', simEvents: 0, realEvents: 0, lastSim: null, lastGenerate: null }; }
async function loadEvents() { var e = await db.get(K.events); return Array.isArray(e) ? e : []; }

function playsToMap(arr) { var m = {}; arr.forEach(function (p) { m[p.id] = p; }); return m; }

async function savePlays(arr) { if (arr.length > PLAYS_CAP) arr = arr.slice(arr.length - PLAYS_CAP); return db.set(K.plays, arr); }
async function appendEvents(recent, newOnes) {
  var merged = newOnes.concat(recent);            // newest first
  if (merged.length > EVENTS_CAP) merged = merged.slice(0, EVENTS_CAP);
  return db.set(K.events, merged);
}

// Ensure a template play exists at EVERY transition for EVERY (dealSize,trigger)
// so a simulated lead of any segment has a play at each stage of its journey.
function ensureCoverage(config, existing, perSegment) {
  perSegment = perSegment || 2;
  var have = {};
  existing.forEach(function (p) { have[p.transitionId + '|' + p.dealSize + '|' + p.trigger] = (have[p.transitionId + '|' + p.dealSize + '|' + p.trigger] || 0) + 1; });
  var added = [];
  var seed = 101;
  config.transitions.forEach(function (def) {
    config.dealSizes.forEach(function (ds) {
      config.triggers.forEach(function (tr) {
        var key = def.id + '|' + ds + '|' + tr;
        var need = perSegment - (have[key] || 0);
        if (need > 0) {
          E.generateTemplatePlays(def.id, ds, tr, need, seed++, 'P').forEach(function (p) { added.push(p); });
        }
      });
    });
  });
  return added;
}

// ── AI play generation (behind the kill-switch) ──────────────────────────
async function aiGeneratePlays(config, transitionId, dealSize, trigger, count) {
  var def = E.TRANSITIONS.filter(function (t) { return t.id === transitionId; })[0];
  if (!def) return { plays: [], via: 'none', error: 'unknown transition' };
  if (!orchestrator || !orchestrator.call) {
    return { plays: templateBatch(transitionId, dealSize, trigger, count), via: 'template', reason: 'orchestrator unavailable' };
  }
  var units = Object.keys(def.options).join(', ');
  var sys = 'You are a sales-play generator. Output ONLY valid minified JSON, no prose. '
    + 'A "play" sets FITT: frequency (how often), intensity (how much/quantity), time (timing, time of day, duration), type (which channel). '
    + 'Each FITT dimension is a SUBJECT you sell ON. On any dimension you run a SET sequence (state a fact, expose a need, tie-down) and/or an FBA sequence (feature, benefit, advantage), in any order. '
    + 'layerMap says which sequences hang off which dimension. "copy" is keyed BY that dimension, and each block has the SET fields (fact,need,tie) and/or FBA fields (feature,benefit,advantage) whose lines speak to THAT dimension as the subject. '
    + 'Return {"plays":[{ "unit":<one of the options>, "fitt":{"frequency":"","intensity":"","time":"","type":""}, '
    + '"layerMap":{"frequency":["SET","FBA"],"time":["SET"]}, '
    + '"copy":{"frequency":{"layers":["SET","FBA"],"fact":"","need":"","tie":"","feature":"","benefit":"","advantage":""},"time":{"layers":["SET"],"fact":"","need":"","tie":""}} }]}';
  var prompt = 'Generate ' + count + ' distinct, high-quality sales plays for the funnel step "' + def.label + '" ('
    + def.unit + ' options: ' + units + '). Target deal size: ' + dealSize + '. Target emotional trigger: ' + trigger
    + '. Vary the FITT settings and which SET/FBA sequences layer onto which FITT dimension. For every dimension in layerMap, write copy keyed to that dimension whose fact/need/tie/feature/benefit/advantage speak to that dimension as the subject, to the ' + trigger
    + ' trigger, and a ' + dealSize + ' deal. Only include copy keys that appear in layerMap. JSON only.';
  var r;
  try { r = await orchestrator.call('REFRESH_ARTIFACT', { system: sys, prompt: prompt, maxTokens: 2600 }); }
  catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
  if (!r || !r.ok) {
    return { plays: templateBatch(transitionId, dealSize, trigger, count), via: 'template', reason: (r && (r.error || (r.disabled ? 'AI disabled' : 'AI failed'))) || 'AI failed' };
  }
  var parsed = safeParsePlays(r.text);
  if (!parsed || !parsed.length) {
    return { plays: templateBatch(transitionId, dealSize, trigger, count), via: 'template', reason: 'AI returned unparseable output', provider: r.provider };
  }
  var seed = 5000 + (dealSize.length + trigger.length + count);
  var rng = E.mulberry32(seed >>> 0);
  var out = parsed.slice(0, count).map(function (raw, i) {
    var unit = (raw && raw.unit && def.options[raw.unit] != null) ? raw.unit : Object.keys(def.options)[0];
    var layerMap = (raw && raw.layerMap) || {};
    var id = 'A-' + transitionId.replace(/[^a-z]/gi, '') + '-' + dealSize[0] + trigger.slice(0, 3) + '-' + i + '-' + Math.floor(rng() * 1e6).toString(36);
    return E.newPlay({
      id: id, transitionId: transitionId, unitLabel: def.unit, unit: unit,
      dealSize: dealSize, trigger: trigger,
      fitt: (raw && raw.fitt) || {}, layerMap: layerMap,
      copy: (raw && raw.copy) || {},
      source: 'ai',
      latentRate: E.latentFor(transitionId, unit, dealSize, trigger, layerMap, rng)
    });
  });
  return { plays: out, via: 'ai', provider: r.provider, tokensOut: r.tokensOut };
}
function templateBatch(transitionId, dealSize, trigger, count) {
  return E.generateTemplatePlays(transitionId, dealSize, trigger, count, 7000 + count, 'A');
}
function safeParsePlays(text) {
  if (!text) return null;
  var s = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { var o = JSON.parse(s); return Array.isArray(o) ? o : (o && o.plays) || null; }
  catch (e) {
    var m = s.match(/\{[\s\S]*\}/);
    if (m) { try { var o2 = JSON.parse(m[0]); return (o2 && o2.plays) || null; } catch (e2) { return null; } }
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();
  var u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var action = (u.searchParams.get('action') || 'status').toLowerCase();

  // ── public status (no key) ───────────────────────────────────────────
  if (action === 'status') {
    var meta0 = await loadMeta();
    var plays0 = await loadPlays();
    var providers = null;
    try { providers = orchestrator && orchestrator.status ? orchestrator.status().providers : null; } catch (e) {}
    return j(res, 200, {
      ok: true, surface: 'sales', backend: db.getBackend(),
      dataMode: meta0.dataMode, simEvents: meta0.simEvents, realEvents: meta0.realEvents,
      playCount: plays0.length, aiProviders: providers,
      keyConfigured: !!(process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY)
    });
  }

  // ── admin gate for everything else ───────────────────────────────────
  var ADMIN = process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY || '';
  var key = u.searchParams.get('key') || (req.headers && req.headers['x-sales-key']) || '';
  if (!ADMIN) return j(res, 503, { ok: false, error: 'Sales admin access not configured (set SALES_ADMIN_KEY). No data exposed.' });
  if (key !== ADMIN) return j(res, 403, { ok: false, error: 'Valid admin key required (?key=). Minimal protection, not real auth.' });

  try {
    // ── GET reads ──────────────────────────────────────────────────────
    if (method === 'GET' && action === 'config') return j(res, 200, { ok: true, config: await loadConfig() });

    if (method === 'GET' && action === 'funnel') {
      var cfgF = await loadConfig();
      var funnel = E.computeFunnel(await loadAgg(), cfgF);
      var metaF = await loadMeta();
      funnel.dataMode = metaF.dataMode; funnel.simEvents = metaF.simEvents; funnel.realEvents = metaF.realEvents;
      // headline revenue from enrollments by deal size is not tracked in agg;
      // report spend + the enrollment count so the UI can show ROI once known.
      return j(res, 200, { ok: true, funnel: funnel });
    }

    if (method === 'GET' && action === 'plays') {
      var stage = u.searchParams.get('stage') || '';        // transition id filter, e.g. shows>enrollments
      var arr = await loadPlays();
      if (stage) arr = arr.filter(function (p) { return p.transitionId === stage; });
      var weights = E.allocate(arr);
      var scored = arr.map(function (p) {
        var s = E.scorePlay(p);
        return {
          id: p.id, transitionId: p.transitionId, unit: p.unit, unitLabel: p.unitLabel,
          dealSize: p.dealSize, trigger: p.trigger, segment: p.segment,
          fitt: p.fitt, layerMap: p.layerMap, notation: p.notation, copy: p.copy, source: p.source,
          trials: s.trials, wins: s.wins, rate: s.rate, lower: s.lower, costPerWinCents: s.costPerWin,
          allocation: weights[p.id] || 0
        };
      }).sort(function (a, b) { return b.lower - a.lower || b.trials - a.trials; });
      return j(res, 200, { ok: true, count: scored.length, plays: scored });
    }

    if (method === 'GET' && action === 'events') {
      var limit = Math.min(parseInt(u.searchParams.get('limit') || '100', 10) || 100, EVENTS_CAP);
      var evs = await loadEvents();
      return j(res, 200, { ok: true, count: evs.length, events: evs.slice(0, limit) });
    }

    // ── POST mutations ─────────────────────────────────────────────────
    var raw = '', body = {};
    if (method === 'POST') {
      raw = await readBody(req);
      body = raw;
      if (typeof raw === 'string' && raw) { try { body = JSON.parse(raw); } catch (e) { body = {}; } }
      if (!body || typeof body !== 'object') body = {};
    }

    if (method === 'POST' && action === 'config') {
      if (!body.config || typeof body.config !== 'object') return j(res, 400, { ok: false, error: 'config object required' });
      body.config.updatedTs = new Date().toISOString();
      await db.set(K.config, body.config);
      return j(res, 200, { ok: true, saved: true });
    }

    if (method === 'POST' && action === 'seed') {
      var cfgS = await loadConfig();
      var existing = await loadPlays();
      if (body.force === true) existing = [];
      var per = Math.max(1, Math.min(parseInt(body.perSegment, 10) || 2, 4));
      var added = ensureCoverage(cfgS, existing, per);
      added.forEach(function (p) { p.createdTs = new Date().toISOString(); });
      var all = existing.concat(added);
      await savePlays(all);
      return j(res, 200, { ok: true, added: added.length, total: all.length, note: 'template plays; simulate to populate outcomes' });
    }

    if (method === 'POST' && action === 'generate') {
      var cfgG = await loadConfig();
      var transitionId = body.transitionId || body.stage;
      var dealSize = body.dealSize || 'medium';
      var trigger = body.trigger || 'trust';
      var count = Math.max(1, Math.min(parseInt(body.count, 10) || 4, 8));
      if (!transitionId) return j(res, 400, { ok: false, error: 'transitionId (e.g. "shows>enrollments") required' });
      var gen = await aiGeneratePlays(cfgG, transitionId, dealSize, trigger, count);
      var arrG = await loadPlays();
      gen.plays.forEach(function (p) { p.createdTs = new Date().toISOString(); arrG.push(p); });
      await savePlays(arrG);
      var metaG = await loadMeta();
      metaG.lastGenerate = new Date().toISOString();
      await db.set(K.meta, metaG);
      return j(res, 200, { ok: true, generated: gen.plays.length, via: gen.via, provider: gen.provider || null, reason: gen.reason || null, total: arrG.length });
    }

    if (method === 'POST' && action === 'simulate') {
      var cfgSim = await loadConfig();
      var playsArr = await loadPlays();
      // auto-seed coverage if the board is empty
      if (!playsArr.length) {
        var seeded = ensureCoverage(cfgSim, [], 2);
        seeded.forEach(function (p) { p.createdTs = new Date().toISOString(); });
        playsArr = seeded;
      }
      var n = Math.max(10, Math.min(parseInt(body.n, 10) || 300, 5000));
      var seed = parseInt(body.seed, 10) || (Date.now() & 0x7fffffff);
      var map = playsToMap(playsArr);
      var sim = E.simulate(map, cfgSim, { n: n, seed: seed });
      // persist mutated plays
      await savePlays(Object.keys(map).map(function (k2) { return map[k2]; }));
      // fold events into agg + recent feed
      var agg = await loadAgg();
      sim.events.forEach(function (ev) { E.applyEvent(agg, ev); });
      await db.set(K.agg, agg);
      var recent = await loadEvents();
      // stamp ts on a copy for the feed
      var stamped = sim.events.slice(0, 200).map(function (ev) { return Object.assign({ ts: new Date().toISOString() }, ev); });
      await appendEvents(recent, stamped);
      var meta = await loadMeta();
      meta.simEvents = (meta.simEvents || 0) + sim.events.length;
      meta.lastSim = new Date().toISOString();
      meta.dataMode = meta.realEvents > 0 ? 'mixed' : 'simulated';
      await db.set(K.meta, meta);
      return j(res, 200, { ok: true, simulated: true, events: sim.events.length, summary: sim.summary, dataMode: meta.dataMode });
    }

    if (method === 'POST' && action === 'event') {
      var ev = body.event || body;
      if (!ev || !ev.transitionId) return j(res, 400, { ok: false, error: 'event.transitionId required' });
      var def = E.TRANSITIONS.filter(function (t) { return t.id === ev.transitionId; })[0];
      if (!def) return j(res, 400, { ok: false, error: 'unknown transitionId' });
      var clean = {
        ts: new Date().toISOString(),
        transitionId: ev.transitionId, from: def.from, to: def.to,
        unit: ev.unit || Object.keys(def.options)[0],
        playId: ev.playId || null,
        dealSize: ev.dealSize || 'medium', trigger: ev.trigger || 'trust',
        won: ev.won === true, costCents: parseInt(ev.costCents, 10) || (def.options[ev.unit] || 0),
        simulated: false
      };
      // update referenced play stats if present
      if (clean.playId) {
        var arrE = await loadPlays();
        var hit = arrE.filter(function (p) { return p.id === clean.playId; })[0];
        if (hit) { hit.trials += 1; hit.costCents += clean.costCents; if (clean.won) hit.wins += 1; await savePlays(arrE); }
      }
      var aggE = await loadAgg(); E.applyEvent(aggE, clean); await db.set(K.agg, aggE);
      var recentE = await loadEvents(); await appendEvents(recentE, [clean]);
      var metaE = await loadMeta();
      metaE.realEvents = (metaE.realEvents || 0) + 1;
      metaE.dataMode = metaE.simEvents > 0 ? 'mixed' : 'real';
      await db.set(K.meta, metaE);
      return j(res, 200, { ok: true, recorded: true, dataMode: metaE.dataMode });
    }

    if (method === 'POST' && action === 'reset') {
      await db.del(K.agg); await db.del(K.plays); await db.del(K.events); await db.del(K.meta);
      return j(res, 200, { ok: true, reset: true });
    }

    return j(res, 405, { ok: false, error: 'Unsupported action/method: ' + method + ' ' + action });
  } catch (e) {
    return j(res, 500, { ok: false, error: String(e && e.message || e) });
  }
};
