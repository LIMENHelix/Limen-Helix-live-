/**
 * api/opportunities — the node->business opportunity engine, surfaced.
 *
 * Source of truth: assets/data/brain-node-business-mapping.json (123 brain nodes, each
 * with a two-sided dysregulation [hyperactive market vs hypoactive market], the real
 * businesses/industries that map to it, and domainBindings). This is the authored
 * node->business engine that was the whole point of LIMEN. We do NOT template it: we
 * expand every node x each domain binding x each dysregulation direction into a concrete
 * opportunity, and float STRESSED domains (live console_snapshot) to the top.
 *
 * GET /api/opportunities                 -> ranked opportunities (default 300) + totals
 * GET /api/opportunities?domain=finance  -> that domain's node-business opportunities
 * GET /api/opportunities?limit=2000 | ?all=1
 *
 * A lead list is a WORK QUEUE, not a claim. No validation gate on listing; the honesty
 * bar is at the outward gate (publish/contact/spend). Lazy + guarded read so a missing
 * file can never crash the shared catch-all.
 */
'use strict';

var path = require('path');
var fs = require('fs');

var _nodes = null;
function loadNodes() {
  if (_nodes) return _nodes;
  var candidates = [
    path.join(process.cwd(), 'assets/data/brain-node-business-mapping.json'),
    path.join(__dirname, '../assets/data/brain-node-business-mapping.json')
  ];
  for (var i = 0; i < candidates.length; i++) {
    try {
      var j = JSON.parse(fs.readFileSync(candidates[i], 'utf8'));
      _nodes = Array.isArray(j) ? j : (j.nodes || Object.values(j));
      return _nodes;
    } catch (e) {}
  }
  return null;
}

// "Hyperactive -> compulsive seeking. Hypoactive -> anhedonia." -> [{market, effect}]
function splitDysregulation(dys) {
  if (!dys) return [{ market: 'dysregulated', effect: null }];
  var s = String(dys);
  var out = [];
  var hyper = s.match(/hyper[a-z]*\s*[:>→-]+\s*([^.]*)/i);
  var hypo = s.match(/hypo[a-z]*\s*[:>→-]+\s*([^.]*)/i);
  if (hyper) out.push({ market: 'hyperactive', effect: hyper[1].trim() });
  if (hypo) out.push({ market: 'hypoactive', effect: hypo[1].trim() });
  if (!out.length) out.push({ market: 'dysregulated', effect: s.slice(0, 120) });
  return out;
}

function businessList(b) {
  if (!b) return [];
  return String(b).split(/[,;]|\band\b/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 2; });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  try {
    var nodes = loadNodes();
    if (!nodes) { res.statusCode = 200; return res.end(JSON.stringify({ ok: false, error: 'node-business map not found' })); }

    var url = req.url || '';
    var qDomain = (url.match(/[?&]domain=([a-zA-Z]+)/) || [])[1] || null;
    var all = /[?&]all=1\b/.test(url);
    var limit = Math.min(parseInt((url.match(/[?&]limit=(\d+)/) || [])[1] || (all ? '999999' : '300'), 10) || 300, all ? 999999 : 20000);

    // live stress per domain
    var stress = {};
    try {
      var db = require('../lib/limen-db');
      var snap = await db.get('console_snapshot');
      var dom = (snap && snap.domains) || {};
      var alias = { research: 'science', health: 'medicine', supplyChain: 'trade' };
      for (var k in dom) { if (dom.hasOwnProperty(k)) stress[alias[k] || k] = (dom[k] && dom[k].stress) || 0; }
    } catch (e) {}

    // expand node x binding x dysregulation-direction -> opportunity
    var opps = [];
    var perDomain = {};
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var biz = businessList(n.business);
      if (!biz.length) continue;                         // no business = not an opportunity source
      var markets = splitDysregulation(n.dysregulation);
      var binds = Array.isArray(n.domainBindings) && n.domainBindings.length ? n.domainBindings : [{ domain: null, role: null }];
      for (var b = 0; b < binds.length; b++) {
        var bd = binds[b];
        var dm = bd.domain || 'unbound';
        for (var m = 0; m < markets.length; m++) {
          perDomain[dm] = (perDomain[dm] || 0) + 1;
          opps.push({
            domain: dm,
            role: bd.role || null,
            sector: bd.sector || null,
            node: n.region || null,
            network: n.network || null,
            phase: n.phase || null,
            market: markets[m].market,             // hyperactive | hypoactive
            dysregulation: markets[m].effect,       // the failure this market serves
            businesses: biz,                        // the real industries
            fn: n.function ? String(n.function).slice(0, 160) : null,
            source: n.source || null
          });
        }
      }
    }

    if (qDomain) opps = opps.filter(function (o) { return o.domain === qDomain; });
    opps.sort(function (a, b) { return (stress[b.domain] || 0) - (stress[a.domain] || 0); });

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      engine: 'brain-node-business-mapping (123 nodes x businesses x domain bindings x hyper/hypo markets)',
      totalOpportunities: opps.length,
      nodesUsed: nodes.filter(function (n) { return businessList(n.business).length; }).length,
      perDomain: perDomain,
      returned: Math.min(limit, opps.length),
      domainFilter: qDomain,
      opportunities: opps.slice(0, limit)
    }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
