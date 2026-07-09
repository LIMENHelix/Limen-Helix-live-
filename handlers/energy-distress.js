/**
 * energy-distress.js — the ENERGY L1 P3 desk (retiring-generator broker feed). Reads ranked EIA
 * retiring generators (energy:distress), groups by fuel, returns each with the repowering developers /
 * funds / decommissioners it matches (lib/energy-buyers.js). ADMIN-ONLY (?key=LEAD_ADMIN_KEY).
 * GET /api/energy-distress?key=...&type=ALL[&tier=2][&per=60]
 */
var db = require('../lib/limen-db');
var buyers = require('../lib/energy-buyers');
function j(res, code, o) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }

function project(d) {
  var q = encodeURIComponent((d.plant || '') + ' ' + (d.state || '') + ' power plant retirement');
  return {
    tier: d.tier, tierLabel: d.tierLabel, priority: d.priority, workFirst: !!d.workFirst,
    signals: (d.signals || []).filter(function (r) { return r === r.toUpperCase(); }),
    plant: d.plant, plantId: d.plantId, generatorId: d.generatorId, state: d.state, sector: d.sector,
    capacityMw: d.capacityMw, technology: d.technology, interconnect: d.interconnect, status: d.status,
    retireDate: d.retireDate, signalType: d.signalType, signalLabel: d.signalLabel,
    key: d.key, source: d.source || 'EIA-860M', url: 'https://www.google.com/search?q=' + q,
    buyers: buyers.matchBuyersFor(d.signalType)
  };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var type = (q.type || 'ALL'), allTypes = type === 'ALL';
  var maxTier = q.tier ? parseInt(q.tier, 10) : 99;
  var per = q.per ? Math.max(1, parseInt(q.per, 10)) : 60;

  var deals = (await db.get('energy:distress')) || [];
  var meta = (await db.get('energy:distress:meta')) || null;
  var pool = deals.filter(function (d) {
    if (!allTypes && d.signalType !== type) return false;
    if (d.tier && d.tier > maxTier) return false;
    return true;
  });

  var byType = {};
  pool.forEach(function (d) { (byType[d.signalType] = byType[d.signalType] || []).push(d); });
  var ORDER = ['coal', 'gas', 'petroleum', 'nuclear', 'other'];
  var groups = Object.keys(byType).sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).map(function (t) {
    var g = byType[t];
    g.sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)) || ((b.capacityMw || 0) - (a.capacityMw || 0)); });
    return {
      type: t, label: (g[0] && g[0].signalLabel) || t, total: g.length,
      workFirst: g.filter(function (d) { return d.workFirst; }).length,
      deals: g.slice(0, per).map(project)
    };
  });

  return j(res, 200, {
    ok: true, type: type, updatedMs: meta && meta.updatedMs || null,
    totals: { deals: pool.length, types: groups.length, workFirst: pool.filter(function (d) { return d.workFirst; }).length, mw: pool.reduce(function (a, d) { return a + (d.capacityMw || 0); }, 0) },
    groups: groups
  });
};
