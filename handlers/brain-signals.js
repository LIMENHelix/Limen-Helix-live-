/**
 * api/brain-signals.js — domain-generic PUBLISH GATE for per-company brain signals.
 *
 * GET /api/brain-signals?domain=energy
 *   → { ok, domain, tracked, degenerate, publishable:[{ticker,name,ds,band,alert,asOf}], note }
 *
 * THE NO-BLEED CHOKEPOINT. command-board-data.json currently stores `ds` (distress)
 * as a PER-DOMAIN DEFAULT (verified 2026-06-19: 18/20 domains have a single uniform
 * ds; the other 2 have only 2 distinct values). That is NOT a per-company signal, so
 * publishing it would make false distress/phase claims about named public companies.
 *
 * This gate refuses to surface any signal that isn't genuinely per-company AND
 * validated AND in-envelope. With the current data it returns ZERO publishable
 * signals for EVERY domain — so no public page can leak a fake score, energy or the
 * next domain. When the real per-company kernel is run (spread appears), the gate
 * opens automatically. Every domain's public front MUST read signals through here.
 *
 * Aggregate counts ("tracking N companies") are safe/honest and always returned.
 */
var CB = null;
try { CB = require('../assets/data/command-board-data.json'); } catch (e) {}

function gate(domain) {
  var out = { tracked: 0, degenerate: false, publishable: [], note: '' };
  if (!CB || !CB.companies) { out.note = 'engine data unavailable'; return out; }

  var comps = [];
  for (var k in CB.companies) { var e = CB.companies[k]; if (e && e.d === domain) comps.push(e); }
  out.tracked = comps.length;
  if (!comps.length) { out.note = 'no companies tracked in this domain yet'; return out; }

  // Degeneracy: too few distinct ds values to be a real per-company score.
  var ds = comps.map(function (c) { return c.ds; }).filter(function (x) { return typeof x === 'number'; });
  var uniq = {}; ds.forEach(function (x) { uniq[x.toFixed(3)] = 1; });
  var nUniq = Object.keys(uniq).length;
  out.degenerate = ds.length > 2 && (nUniq <= 2 || (nUniq / ds.length) < 0.15);

  if (out.degenerate) {
    out.note = 'Per-company distress scores are currently a domain-level default (not individually computed), so they are withheld from public view until per-company scoring is validated.';
    return out;
  }

  // Per-company gate: validated + in-envelope (>=8 quarters) + a real number.
  comps.forEach(function (e) {
    if (typeof e.ds !== 'number') return;
    if (e.vs !== 'validated') return;
    if (!(e.hist >= 8)) return;
    if (!e.t) return;
    var band = e.ds >= 0.66 ? 'elevated' : e.ds >= 0.40 ? 'moderate' : 'low';
    out.publishable.push({ ticker: e.t, name: e.n, ds: Math.round(e.ds * 100) / 100, band: band, alert: !!e.a, asOf: e.q });
  });
  if (!out.publishable.length) out.note = 'No companies currently pass the publish gate (need validated status + ≥8 quarters of history).';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  var u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var domain = (u.searchParams.get('domain') || 'energy').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  var r = gate(domain);
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, domain: domain, tracked: r.tracked, degenerate: r.degenerate, publishable: r.publishable, note: r.note }));
};
