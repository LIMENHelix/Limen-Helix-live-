/**
 * spine.js — /api/spine — the DECISION SPINE (prefrontal wire).
 *
 * Reads the per-domain dysregulation LIMEN already computes (console_snapshot),
 * weights each of the 20 domains, resolves each business cell's state (on/off,
 * recommend vs control, threshold), and ranks the highest-opportunity targets
 * per firing cell — the gate that ensures we contact ONLY the top, never blast.
 *
 * SENSE (console_snapshot.domains[key].stress × confidence)  →  WEIGHT per domain
 *   →  GATE per cell (enabled AND domainWeight ≥ threshold)  →  RANK targets
 *   →  surface top slice in RECOMMEND, or (future) act in CONTROL.
 *
 * SAFETY: two-speed autonomy. Cells default to enabled + RECOMMEND (surface only).
 * CONTROL mode is opt-in per cell and, until actuators are wired to it, still only
 * surfaces — nothing here sends, trades, or moves money. Global kill switch +
 * per-cell switch. Respects lib/ai-kill-switch for any future AI/paid action.
 *
 * Storage:
 *   spine:config   { enabled, defaultMode, defaultThreshold }
 *   spine:cells    { <companyId>: { enabled, mode, threshold, updatedTs } }
 *   reads: console_snapshot (public per-domain signal), sales:companies (cells),
 *          leadgen:index / leadgen:lead:<id> (targets)
 */

var db = require('../lib/limen-db');

var DOMAINS = ['agriculture', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'];
// console_snapshot uses three alias keys for the live-stress layer.
var ALIAS = { medicine: 'health', science: 'research', trade: 'supplyChain' };

var K = {
  config: 'spine:config',
  cells: 'spine:cells',
  snapshot: 'console_snapshot',
  companies: 'sales:companies',
  lgIndex: 'leadgen:index',
  lgLead: 'leadgen:lead:'
};

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    if (!req || typeof req.on !== 'function') return resolve('');
    var data = ''; req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); }); req.on('error', function () { resolve(''); });
  });
}
function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(obj)); }
function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }
function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

async function loadConfig() {
  var c = await db.get(K.config);
  return Object.assign({ enabled: true, defaultMode: 'recommend', defaultThreshold: 0.5 }, c || {});
}
async function loadCellsOverlay() { return (await db.get(K.cells)) || {}; }
async function loadCompanies() { var c = await db.get(K.companies); return Array.isArray(c) ? c : []; }

// Per-domain dysregulation from the live snapshot. weight = stress × confidence.
function domainSignals(snap) {
  var domainsRaw = (snap && snap.domains) || {};
  var out = {};
  DOMAINS.forEach(function (d) {
    var key = ALIAS[d] || d;
    var x = domainsRaw[key];
    if (!x) { out[d] = { domain: d, stress: 0, confidence: 0, activity: 0, weight: 0, phase: null, topSignal: null, missing: true }; return; }
    var stress = num(x.stress, 0), confidence = num(x.confidence, 0);
    out[d] = {
      domain: d, stress: stress, confidence: confidence, activity: num(x.activity, 0),
      weight: +(stress * confidence).toFixed(3),
      maturity: x.maturity || null, phase: x.phase || null, phaseLabel: x.phaseLabel || null,
      status: x.status || null, topSignal: x.topSignal || null
    };
  });
  return out;
}

function resolveCell(company, cfg, overlay, sig) {
  var ov = overlay[company.id] || {};
  var enabled = ov.enabled !== undefined ? !!ov.enabled : true;
  var mode = ov.mode === 'control' ? 'control' : 'recommend';
  var threshold = ov.threshold !== undefined ? num(ov.threshold, cfg.defaultThreshold) : cfg.defaultThreshold;
  var dw = (sig[company.domain] && sig[company.domain].weight) || 0;
  var firing = !!(cfg.enabled && enabled && dw >= threshold);
  return {
    companyId: company.id, name: company.name, domain: company.domain, level: company.level || 'L1',
    enabled: enabled, mode: mode, threshold: threshold,
    domainWeight: dw, domainStress: (sig[company.domain] && sig[company.domain].stress) || 0,
    domainTopSignal: (sig[company.domain] && sig[company.domain].topSignal) || null,
    firing: firing,
    state: !cfg.enabled ? 'kill' : (!enabled ? 'off' : (firing ? (mode === 'control' ? 'firing-control' : 'firing-recommend') : 'armed'))
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();
  var u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var action = (u.searchParams.get('action') || 'status').toLowerCase();

  if (action === 'status') {
    var snap0 = await db.get(K.snapshot);
    var cfg0 = await loadConfig();
    return j(res, 200, {
      ok: true, surface: 'spine', backend: db.getBackend(),
      keyConfigured: !!(process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY),
      snapshot: snap0 ? { present: true, generatedAt: snap0.generatedAt || null, macroShock: !!snap0.macroShock } : { present: false },
      config: { enabled: cfg0.enabled, defaultMode: cfg0.defaultMode, defaultThreshold: cfg0.defaultThreshold }
    });
  }

  var ADMIN = process.env.SALES_ADMIN_KEY || process.env.LEAD_ADMIN_KEY || '';
  var key = u.searchParams.get('key') || (req.headers && req.headers['x-sales-key']) || '';
  if (!ADMIN) return j(res, 503, { ok: false, error: 'Spine admin not configured. No data exposed.' });
  if (key !== ADMIN) return j(res, 403, { ok: false, error: 'Valid admin key required (?key=).' });

  try {
    if (method === 'GET' && action === 'board') {
      var snap = await db.get(K.snapshot);
      var cfg = await loadConfig();
      var overlay = await loadCellsOverlay();
      var companies = await loadCompanies();
      var sig = domainSignals(snap);
      var domains = DOMAINS.map(function (d) { return sig[d]; }).sort(function (a, b) { return b.weight - a.weight; });
      var cells = companies.map(function (c) { return resolveCell(c, cfg, overlay, sig); })
        .sort(function (a, b) { return b.domainWeight - a.domainWeight; });
      return j(res, 200, {
        ok: true,
        config: cfg,
        snapshot: snap ? { generatedAt: snap.generatedAt || null, ageSeconds: snap._ageSeconds || null, stale: !!snap._stale, macroShock: !!snap.macroShock } : { missing: true },
        domains: domains, cells: cells,
        firing: cells.filter(function (c) { return c.firing; }).length
      });
    }

    if (method === 'GET' && action === 'cells') {
      var cfg2 = await loadConfig(); var overlay2 = await loadCellsOverlay();
      var sig2 = domainSignals(await db.get(K.snapshot));
      var cells2 = (await loadCompanies()).map(function (c) { return resolveCell(c, cfg2, overlay2, sig2); });
      return j(res, 200, { ok: true, cells: cells2 });
    }

    // Ranked, GATED opportunities for one cell: domainWeight × per-target signal,
    // sorted, top slice only. This is the "contact only the highest" gate.
    if (method === 'GET' && action === 'opportunities') {
      var company = u.searchParams.get('company') || '';
      if (!company) return j(res, 400, { ok: false, error: 'company required' });
      var top = Math.min(parseInt(u.searchParams.get('top') || '25', 10) || 25, 100);
      var cfg3 = await loadConfig(); var overlay3 = await loadCellsOverlay();
      var comps = await loadCompanies();
      var comp = comps.filter(function (c) { return c.id === company; })[0];
      if (!comp) return j(res, 404, { ok: false, error: 'unknown cell' });
      var sig3 = domainSignals(await db.get(K.snapshot));
      var cell = resolveCell(comp, cfg3, overlay3, sig3);
      var dw = cell.domainWeight;
      var idx = (await db.get(K.lgIndex)) || [];
      var scored = [];
      for (var i = 0; i < idx.length && scored.length < 500; i++) {
        var lead = await db.get(K.lgLead + idx[i]);
        if (!lead || lead.company !== company) continue;
        var targetSig = (num(lead.score, 0)) / 100;         // contactability/quality proxy (0..1)
        var opp = +(dw * targetSig).toFixed(4);             // opportunity = domain dysregulation × target signal
        scored.push({ leadId: lead.id, name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, score: lead.score, oppScore: opp, notes: lead.notes });
      }
      scored.sort(function (a, b) { return b.oppScore - a.oppScore; });
      return j(res, 200, {
        ok: true, cell: cell, domainWeight: dw,
        totalCandidates: scored.length, returned: Math.min(top, scored.length),
        note: 'gate = surface only the top ' + top + ' by opportunity (domain dysregulation × target signal)',
        opportunities: scored.slice(0, top)
      });
    }

    var raw = '', body = {};
    if (method === 'POST') { raw = await readBody(req); body = raw; if (typeof raw === 'string' && raw) { try { body = JSON.parse(raw); } catch (e) { body = {}; } } if (!body || typeof body !== 'object') body = {}; }

    if (method === 'POST' && action === 'config') {
      var cur = await loadConfig();
      if (body.enabled !== undefined) cur.enabled = !!body.enabled;
      if (body.defaultMode) cur.defaultMode = body.defaultMode === 'control' ? 'control' : 'recommend';
      if (body.defaultThreshold !== undefined) cur.defaultThreshold = Math.max(0, Math.min(1, num(body.defaultThreshold, 0.5)));
      await db.set(K.config, cur);
      return j(res, 200, { ok: true, config: cur });
    }

    // Set one cell's switch. mode 'control' is a deliberate escalation.
    if (method === 'POST' && action === 'cell') {
      var cid = clip(body.companyId, 40);
      if (!cid) return j(res, 400, { ok: false, error: 'companyId required' });
      var ov = await loadCellsOverlay();
      var c = ov[cid] || {};
      if (body.enabled !== undefined) c.enabled = !!body.enabled;
      if (body.mode) c.mode = body.mode === 'control' ? 'control' : 'recommend';
      if (body.threshold !== undefined) c.threshold = Math.max(0, Math.min(1, num(body.threshold, 0.5)));
      c.updatedTs = new Date().toISOString();
      ov[cid] = c;
      await db.set(K.cells, ov);
      return j(res, 200, { ok: true, companyId: cid, cell: c });
    }

    // Global kill switch (fast).
    if (method === 'POST' && action === 'kill') {
      var cfgK = await loadConfig(); cfgK.enabled = false; await db.set(K.config, cfgK);
      return j(res, 200, { ok: true, enabled: false, note: 'spine disabled — all cells go dark' });
    }
    if (method === 'POST' && action === 'arm') {
      var cfgA = await loadConfig(); cfgA.enabled = true; await db.set(K.config, cfgA);
      return j(res, 200, { ok: true, enabled: true });
    }

    return j(res, 405, { ok: false, error: 'Unsupported action/method: ' + method + ' ' + action });
  } catch (e) {
    return j(res, 500, { ok: false, error: String(e && e.message || e) });
  }
};
