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
var CB = null;
try { CB = require('../assets/data/command-board-data.json'); } catch (e) {}

function run(domain) {
  var out = { tracked: 0, eligible: 0, degenerate: false, publishable: [], note: '' };
  if (!CB || !CB.companies) { out.note = 'engine data unavailable'; return out; }

  var comps = [];
  for (var k in CB.companies) { var e = CB.companies[k]; if (e && e.d === domain) comps.push(e); }
  out.tracked = comps.length;
  if (!comps.length) { out.note = 'no companies tracked in this domain yet'; return out; }

  var domainStats = { degenerate: F.isDegenerate(comps.map(function (c) { return c.ds; })) };
  out.degenerate = domainStats.degenerate;

  comps.forEach(function (c) {
    var t0 = F.thing0Eligible(c);
    if (!t0.eligible) return;
    out.eligible++;
    var t1 = F.thing1Distress(c, domainStats);   // null = abstain (no fake score)
    if (!t1) return;
    out.publishable.push({ ticker: c.t, name: c.n, ds: t1.ds, band: t1.band, alert: t1.alert, asOf: t1.asOf });
  });

  if (out.degenerate) {
    out.note = 'Per-company distress scores are currently a domain-level default (not individually computed), so they are withheld until per-company scoring is validated.';
  } else if (!out.publishable.length) {
    out.note = 'No companies pass the gate (need eligibility + validated status).';
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
    tracked: r.tracked, eligible: r.eligible, degenerate: r.degenerate,
    publishable: r.publishable, note: r.note
  }));
};
