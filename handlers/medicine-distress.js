/**
 * medicine-distress.js — the MEDICINE P3 desk (the drug/device recall data feed). Reads ranked openFDA
 * recall events (medicine:distress), groups by recall class, returns each with the mass-tort firms it
 * matches (lib/plaintiff-firms.js) + a lookup link. ADMIN-ONLY (?key=LEAD_ADMIN_KEY).
 * GET /api/medicine-distress?key=...&type=ALL[&tier=2][&per=60]
 */
var db = require('../lib/limen-db');
var firms = require('../lib/plaintiff-firms');
function j(res, code, o) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }

function project(d) {
  return {
    tier: d.tier, tierLabel: d.tierLabel, priority: d.priority, workFirst: !!d.workFirst,
    signals: (d.signals || []).filter(function (r) { return r === r.toUpperCase(); }),
    firm: d.firm, brand: d.brand || null, generic: d.generic || null, product: d.product,
    reason: d.reason, productType: d.productType, classification: d.classification, status: d.status,
    distribution: d.distribution, state: d.state, country: d.country,
    date: d.date, initiated: d.initiated, recallNumber: d.recallNumber,
    signalType: d.signalType, signalLabel: d.signalLabel,
    key: d.key, url: d.url, source: d.source || 'openFDA',
    buyers: firms.matchFirmsFor(d.signalType, d.productType)
  };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var type = (q.type || 'ALL'), allTypes = type === 'ALL';
  var maxTier = q.tier ? parseInt(q.tier, 10) : 99;
  var per = q.per ? Math.max(1, parseInt(q.per, 10)) : 60;

  var deals = (await db.get('medicine:distress')) || [];
  var meta = (await db.get('medicine:distress:meta')) || null;
  var pool = deals.filter(function (d) {
    if (!allTypes && d.signalType !== type) return false;
    if (d.tier && d.tier > maxTier) return false;
    return true;
  });

  var byType = {};
  pool.forEach(function (d) { (byType[d.signalType] = byType[d.signalType] || []).push(d); });
  var ORDER = ['classI', 'classII', 'classIII'];
  var groups = Object.keys(byType).sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).map(function (t) {
    var g = byType[t];
    g.sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)) || String(b.date).localeCompare(String(a.date)); });
    return {
      type: t, label: (g[0] && g[0].signalLabel) || t, total: g.length,
      workFirst: g.filter(function (d) { return d.workFirst; }).length,
      deals: g.slice(0, per).map(project)
    };
  });

  return j(res, 200, {
    ok: true, type: type, updatedMs: meta && meta.updatedMs || null,
    totals: { deals: pool.length, types: groups.length, workFirst: pool.filter(function (d) { return d.workFirst; }).length },
    groups: groups
  });
};
