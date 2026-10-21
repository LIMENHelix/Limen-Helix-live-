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

/* Issuer identity is the CIK, never the ticker. Tickers collide across CIKs in
   the live snapshots (ALKS is 850261 on the board and 1520262 in the eligible
   feed), so a ticker is display metadata only after a CIK has established who
   the issuer is. */
function _normCik(value) {
  if (value === null || value === undefined) return null;
  var raw = String(value).trim();
  if (!/^[0-9]+$/.test(raw)) return null;
  var stripped = raw.replace(/^0+/, '');
  return (stripped === '' || stripped === '0') ? null : stripped;
}

function _cikOf(row) {
  if (!row) return null;
  if (row.cik !== undefined && row.cik !== null) return _normCik(row.cik);
  if (row.c !== undefined && row.c !== null) return _normCik(row.c);
  return null;
}

/* Rows without a usable CIK cannot be joined to an issuer, so they are never
   indexed and can never authorize a fallback. */
function _indexByCik(records) {
  var index = Object.create(null);
  (records || []).forEach(function (rec) {
    var key = _cikOf(rec);
    if (!key) return;
    (index[key] = index[key] || []).push(rec);
  });
  return index;
}

// Real per-company kernel scores (api/limen/score snapshots), keyed by domain and
// then by normalized CIK. Presence of a domain here = that domain has been
// rescored; absence = falls back to honest abstain. Add more files here as other
// domains get scored.
var REAL = {};
try {
  var _eng = require('../assets/data/energy-distress-scores.json');
  REAL.energy = _indexByCik(_eng.scores || []);
} catch (e) {}

// ELIG — kernel verdicts derived from the validated eligible frontier (assets/data/command-board-eligible.json),
// the SAME per-company kernel data the Command Board (/kernel-comparison) renders. Keyed domain -> normalized
// CIK. This lets EVERY kernel-covered domain (not just energy) surface its verdicts through the identical honest
// gate. Each entry may carry the scorer-produced Thing 0 object (t0/thing0/thing0Eligibility). Legacy fields
// (co, a, es, vs) remain available for Display/Thing 1, but they do NOT qualify a company by themselves.
var ELIG = {};
try {
  var _elig = require('../assets/data/command-board-eligible.json');
  (_elig.companies || []).forEach(function (c) {
    if (!c || !c.t || !c.d) return;
    var _cik = _normCik(c.c);
    if (!_cik) return;
    var _dk = String(c.d).toLowerCase();
    if (!ELIG[_dk]) ELIG[_dk] = Object.create(null);
    (ELIG[_dk][_cik] = ELIG[_dk][_cik] || []).push({
      ticker: c.t,
      cik: _cik,
      composite: (typeof c.co === 'number') ? c.co : null,
      alert: !!c.a,
      inEnvelope: /ELIGIBLE/.test(String(c.es || '')),
      validated: String(c.vs || '') === 'validated',
      sic: c.sic,
      kid: c.kid || null,
      firstAlertQuarter: c.fq || null,
      // Thing 0 evidence only when the snapshot writer recorded it.
      thing0: c.t0 || c.thing0 || c.thing0Eligibility || null
    });
  });
} catch (e) {}

function _thing0Of(row) {
  return (row && (row.thing0 || row.thing0Eligibility || row.t0)) || null;
}

function _thing1ValidatedRow(row) {
  /* "Scanned" means Thing 1 actually produced a validated result. A transport
     error, an out-of-envelope row, or an unvalidated fingerprint does not count
     as a live validated scan. */
  return !!(row && !row.error && row.inEnvelope === true
    && (row.validated === true || row.validation_status === 'validated'));
}

function _tickerOf(row) {
  return row && (row.ticker || row.t);
}

function _tickerKey(row) {
  var t = _tickerOf(row);
  if (t === null || t === undefined) return null;
  var s = String(t).trim().toUpperCase();
  return s || null;
}

function _provenanceKey(row) {
  var t0 = _thing0Of(row);
  return JSON.stringify([
    row && row.validated === true,
    (row && (row.validation_status || row.vs)) || null,
    (row && typeof row.composite === 'number') ? row.composite
      : ((row && typeof row.co === 'number') ? row.co : null),
    row && row.inEnvelope === true,
    /* Everything below can change the published verdict or its authority. */
    row && row.alert === true,
    (row && row.kid) || null,
    row && row.isFinancial === true,
    (row && row.sic) || null,
    t0 ? (t0.qualification_status || null) : null,
    t0 ? (t0.permits_thing1_use === true) : null,
    row && row.error ? String(row.error) : null
  ]);
}

/**
 * Several snapshot rows can claim the same CIK. If they disagree on ticker or
 * on provenance, there is no way to tell which one is authoritative, so the
 * company fails closed instead of inheriting one arbitrarily.
 */
function _selectSameIssuer(candidates) {
  if (!candidates || !candidates.length) return { record: null, conflict: false };
  if (candidates.length === 1) return { record: candidates[0], conflict: false };
  var ticker = null;
  var provenance = null;
  for (var i = 0; i < candidates.length; i++) {
    var t = _tickerKey(candidates[i]);
    if (!t) return { record: null, conflict: true };
    var p = _provenanceKey(candidates[i]);
    if (ticker === null) {
      ticker = t;
      provenance = p;
    } else if (t !== ticker || p !== provenance) {
      return { record: null, conflict: true };
    }
  }
  return { record: candidates[0], conflict: false };
}

/**
 * Compatibility name. Select one coherent response wholesale; never attach
 * Thing 0 evidence from one snapshot to Thing 1 fields from another.
 *
 * The join is authorized by normalized CIK only. `expectedCik` is the issuer
 * the caller is resolving; when it is omitted the preferred row must carry its
 * own CIK. A fallback is used only when its CIK is present and identical.
 * Missing, malformed or mismatched identity abstains from the fallback; a
 * ticker match alone never authorizes anything.
 */
function _mergeThing0Evidence(preferred, fallback, expectedCik) {
  var anchor = (expectedCik === undefined || expectedCik === null)
    ? _cikOf(preferred)
    : _normCik(expectedCik);
  if (!anchor) return preferred || null;

  var pc = _cikOf(preferred);
  var fc = _cikOf(fallback);
  if (preferred && !pc) return preferred;
  if (preferred && pc !== anchor) return null;
  if (!fallback) return preferred || null;
  if (fc !== anchor) return preferred || null;

  /* An errored preferred row is not a score. Use a coherent fallback wholesale,
     or leave the error row unqualified when no fallback exists. */
  if (preferred && preferred.error) return fallback;
  if (preferred && _thing0Of(preferred)) return preferred;
  if (fallback && _thing0Of(fallback)) return fallback;
  return preferred || fallback || null;
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
  var enriched = [];
  comps.forEach(function (c) {
    /* Resolve the issuer by CIK before looking at any score. A board row with
       no usable CIK cannot be joined to anything, and duplicate CIK rows that
       disagree fail closed for the whole company. */
    var cik = _normCik(c.c);
    var r = null;
    if (cik) {
      var pref = _selectSameIssuer(preferredMap && preferredMap[cik]);
      var fb = _selectSameIssuer(fallbackMap && fallbackMap[cik]);
      r = (pref.conflict || fb.conflict)
        ? null
        : _mergeThing0Evidence(pref.record, fb.record, cik);
    }
    /* Copy the source row before attaching derived fields. The loaded
       command-board snapshot is shared by every request and must not be mutated. */
    var row = {};
    for (var k in c) {
      if (Object.prototype.hasOwnProperty.call(c, k)) row[k] = c[k];
    }
    row.real = r || null;
    // Only a scorer-produced Thing 0 object is qualification evidence.
    row.thing0 = _thing0Of(r);
    enriched.push(row);
    if (row.thing0) out.thing0Evidence++;
    if (_thing1ValidatedRow(r)) {
      out.scanned++;
      /* Only a coherent Thing 0-qualified row can support the "scored live"
         note. A validated diagnostic row without Thing 0 evidence is not a
         publishable live result. */
      if (row.thing0 && F.thing0Eligible(row).eligible) hasReal = true;
    }
  });

  var domainStats = { degenerate: F.isDegenerate(enriched.map(function (row) { return row.ds; })) };
  out.degenerate = domainStats.degenerate && !hasReal;   // real scores override the degenerate fallback

  var pubSeen = {};
  enriched.forEach(function (c) {                  // c is the copied, coherent row
    if (pubSeen[c.t]) return;                     // dedup tickers (command-board can have 2 CIK rows)
    var t0 = F.thing0Eligible(c);
    if (!t0.eligible) return;
    out.eligible++;
    var t1 = F.thing1Distress(c, domainStats);    // null = abstain (no fake score)
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
module.exports._thing1ValidatedRow = _thing1ValidatedRow;
module.exports._normCik = _normCik;
module.exports._selectSameIssuer = _selectSameIssuer;
