/**
 * api/opportunities — the full opportunity inventory, surfaced.
 *
 * GET /api/opportunities                 -> top 200 ranked opportunities + per-domain counts
 * GET /api/opportunities?domain=finance  -> that domain's opportunities
 * GET /api/opportunities?limit=1000       -> more (cap 5000)
 * GET /api/opportunities?all=1            -> everything (counts + all rows)
 *
 * Source: assets/data/opportunities-index.json (built by scripts/build-opportunity-index.mjs
 * from every domain's diagnoses: each opportunity = a dysregulation + its nodes + feed theme +
 * treatments/businesses). Ranked by evidence strength, then treatment breadth, and STRESSED
 * domains (live console_snapshot) float to the top. This is a WORK QUEUE, not a set of claims:
 * no validation gate on listing. The honesty bar is at the outward gate (publish / contact /
 * spend), not here.
 *
 * Guarded: the index read is lazy + try/caught INSIDE the handler so a missing file can never
 * crash the shared Hono catch-all (the 2026-07-14 lesson).
 */
'use strict';

var path = require('path');
var fs = require('fs');

var _cache = null;
function loadIndex() {
  if (_cache) return _cache;
  var candidates = [
    path.join(process.cwd(), 'assets/data/opportunities-index.json'),
    path.join(__dirname, '../assets/data/opportunities-index.json')
  ];
  for (var i = 0; i < candidates.length; i++) {
    try { _cache = JSON.parse(fs.readFileSync(candidates[i], 'utf8')); return _cache; } catch (e) {}
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  try {
    var idx = loadIndex();
    if (!idx) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: 'opportunity index not built yet (run scripts/build-opportunity-index.mjs)' })); }

    var url = req.url || '';
    var qDomain = (url.match(/[?&]domain=([a-zA-Z]+)/) || [])[1] || null;
    var all = /[?&]all=1\b/.test(url);
    var limit = Math.min(parseInt((url.match(/[?&]limit=(\d+)/) || [])[1] || (all ? '999999' : '200'), 10) || 200, all ? 999999 : 5000);

    // live stress per domain -> boost stressed domains' opportunities to the top
    var stress = {};
    try {
      var db = require('../lib/limen-db');
      var snap = await db.get('console_snapshot');
      var dom = (snap && snap.domains) || {};
      // console_snapshot keys by runtimeKey; index keys by id. Bridge the 3 that differ.
      var alias = { research: 'science', health: 'medicine', supplyChain: 'trade' };
      for (var k in dom) { if (dom.hasOwnProperty(k)) { var id = alias[k] || k; stress[id] = (dom[k] && dom[k].stress) || 0; } }
    } catch (e) {}

    var ops = idx.opportunities || [];
    if (qDomain) ops = ops.filter(function (o) { return o.d === qDomain; });

    // rank: live domain stress first, then the index's own evidence/breadth order (already sorted)
    ops = ops.slice().sort(function (a, b) { return (stress[b.d] || 0) - (stress[a.d] || 0); });

    var out = ops.slice(0, limit);
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: idx.generatedAt,
      totalDiagnoses: idx.totalDiagnoses,
      totalTreatmentOpps: idx.totalTreatmentOpps,
      perDomain: idx.perDomain,
      returned: out.length,
      domainFilter: qDomain,
      opportunities: out
    }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
