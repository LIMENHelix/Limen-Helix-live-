/**
 * api/brain-signals.js — domain-generic Thing pipeline + PUBLISH GATE (no-bleed).
 *
 * GET /api/brain-signals?domain=energy
 *   → { ok, domain, pipelineVersion, tracked, eligible, degenerate, publishable:[...], note }
 *
 * Runs every company in the domain through the swappable formula layer
 * (lib/thing-formulas.js): Thing 0 (eligibility) → Thing 1 (validated distress,
 * abstains on degenerate/unvalidated) → Thing 2 (interpretive phase, never public).
 * Only Thing-0-eligible + Thing-1-validated rows are ever `publishable`. With the
 * current data that's 0 for every domain (ds is a per-domain default) — so no public
 * page can leak a fake score. When the formula is swapped for real per-company
 * scoring, the gate opens automatically. THIS is the single chokepoint every domain's
 * public front reads through, and the formula is one file to swap (lib/thing-formulas.js).
 */
var F = require('../lib/thing-formulas');
var DOMAIN_NAMES = require('../lib/domain-names');
var CB = null;
try { CB = require('../assets/data/command-board-data.json'); } catch (e) {}

// Real per-company kernel scores (api/limen/score snapshots), keyed by domain → ticker.
// Presence of a domain here = that domain has been rescored; absence = falls back to
// honest abstain. Add more files here as other domains get scored.
var REAL = {};
try {
  var _eng = require('../assets/data/energy-distress-scores.json');
  REAL.energy = {};
  (_eng.scores || []).forEach(function (s) {
    if (s.ticker) REAL.energy[s.ticker] = s;
  });
} catch (e) {}

// ELIG — kernel verdicts derived from the validated eligible frontier (assets/data/command-board-eligible.json),
// the SAME per-company kernel data the Command Board (/kernel-comparison) renders. Keyed domain -> ticker.
// This lets EVERY kernel-covered domain (not just energy) surface its verdicts through the identical honest
// gate. Each entry may carry the scorer-produced Thing 0 object (t0/thing0/thing0Eligibility). Legacy fields
// (co, a, es, vs) remain available for Display/Thing 1, but they do NOT qualify a company by themselves.
var ELIG = {};
try {
  var _elig = require('../assets/data/command-board-eligible.json');
  (_elig.companies || []).forEach(function (c) {
    if (!c || !c.t || !c.d) return;
    var _dk = String(c.d).toLowerCase();
    (ELIG[_dk] = ELIG[_dk] || {})[c.t] = {
      composite: (typeof c.co === 'number') ? c.co : null,
      alert: !!c.a,
      inEnvelope: /ELIGIBLE/.test(String(c.es || '')),
      validated: String(c.vs || '') === 'validated',
      sic: c.sic,
      firstAlertQuarter: c.fq || null,
      // Thing 0 evidence only when the snapshot writer recorded it.
      thing0: c.t0 || c.thing0 || c.thing0Eligibility || null
    };
  });
} catch (e) {}

function _thing0Of(row) {
  return (row && (row.thing0 || row.thing0Eligibility || row.t0)) || null;
}

/**
 * Merge Thing 0 evidence per ticker. The preferred score row wins for Thing 1
 * fields, but command-board rows can carry Thing 0 evidence the energy snapshot
 * lacks. The merge is a copy; neither source snapshot is mutated.
 */
function _mergeThing0Evidence(preferred, fallback) {
  if (!preferred) return fallback || null;
  if (_thing0Of(preferred)) return preferred;
  var evidence = _thing0Of(fallback);
  if (!evidence) return preferred;
  var merged = {};
  for (var k in preferred) {
    if (Object.prototype.hasOwnProperty.call(preferred, k)) merged[k] = preferred[k];
  }
  merged.thing0 = evidence;
  return merged;
}

function run(domain) {
  var out = { tracked: 0, scanned: 0, eligible: 0, flagged: 0, degenerate: false, thing0Evidence: 0, publishable: [], note: '' };
  if (!CB || !CB.companies) { out.note = 'engine data unavailable'; return out; }

  // Alias the console's domainId to the command-board domain key (the medicine console calls
  // 'health', trade calls 'supplyChain', science calls 'research'). Case-insensitive throughout.

  var dq = DOMAIN_NAMES.toCanonical(domain).toLowerCase();
  var comps = [];
  for (var k in CB.companies) { var e = CB.companies[k]; if (e && String(e.d).toLowerCase() === dq) comps.push(e); }
  out.tracked = comps.length;
  if (!comps.length) { out.note = 'no companies tracked in this domain yet'; return out; }

  var preferredMap = REAL[dq] || null;
  var fallbackMap = ELIG[dq] || null;
  var hasReal = false;
  comps.forEach(function (c) {
    var r = preferredMap
      ? _mergeThing0Evidence(preferredMap[c.t], fallbackMap && fallbackMap[c.t])
      : (fallbackMap && fallbackMap[c.t]);
    if (!r) return;
    c.real = r;
    // Only a scorer-produced Thing 0 object is qualification evidence.
    c.thing0 = _thing0Of(r);
    if (c.thing0) out.thing0Evidence++;
    if (!r.error) { hasReal = true; out.scanned++; }
  });

  var domainStats = { degenerate: F.isDegenerate(comps.map(function (c) { return c.ds; })) };
  out.degenerate = domainStats.degenerate && !hasReal;   // real scores override the degenerate fallback

  var pubSeen = {};
  comps.forEach(function (c) {
    if (pubSeen[c.t]) return;                     // dedup tickers (command-board can have 2 CIK rows)
    var t0 = F.thing0Eligible(c);
    if (!t0.eligible) return;
    out.eligible++;
    var t1 = F.thing1Distress(c, domainStats);   // null = abstain (no fake score)
    if (!t1) return;
    pubSeen[c.t] = 1;
    if (t1.band === 'elevated') out.flagged++;
    out.publishable.push({ ticker: c.t, name: c.n, score: t1.score, band: t1.band, alert: t1.alert, asOf: t1.asOf });
  });

  if (out.thing0Evidence === 0) {
    out.note = 'Thing 0 qualification evidence is unavailable in the current snapshot. Legacy scores remain visible for diagnostics only; no company is qualified for Thing 1 or action authority.';
  } else if (!out.eligible) {
    out.note = 'Thing 0 qualification evidence is present, but no company in this domain qualifies for Thing 1.';
  } else if (hasReal) {
    out.note = 'Scored live via the validated kernel (api/limen/score). ' + out.flagged + ' flagged for review; the rest scanned and not flagged. Early-warning screen — not a prediction, not advice.';
  } else if (out.degenerate) {
    out.note = 'Per-company distress scores are a domain-level default (not individually computed); withheld until this domain is rescored.';
  } else if (!out.publishable.length) {
    out.note = 'No companies pass the gate (need Thing 0 qualification + validated Thing 1 status).';
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  var u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var domain = (u.searchParams.get('domain') || 'energy').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  var r = run(domain);
  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true, domain: domain, pipelineVersion: F.FORMULA_VERSION,
    tracked: r.tracked, scanned: r.scanned, eligible: r.eligible, flagged: r.flagged,
    degenerate: r.degenerate, thing0Evidence: r.thing0Evidence,
    publishable: r.publishable, note: r.note
  }));
};

/* Exported for the focused THING0-CONNECT-1 merge regression. */
module.exports._mergeThing0Evidence = _mergeThing0Evidence;
module.exports._thing0Of = _thing0Of;
