/**
 * industry.js — the INDUSTRY P3 desk. Reads ranked WARN deals (warn:deals, from the cron worker),
 * groups by state, and returns each closing plant with the paying counterparties it matches
 * (lib/liquidators.js). ADMIN-ONLY (?key=LEAD_ADMIN_KEY).
 *
 * GET /api/industry?key=...&state=ALL[&tier=2][&perState=40]
 */
var db = require('../lib/limen-db');
var liq = require('../lib/liquidators');

function j(res, code, o) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }

function project(d) {
  return {
    tier: d.tier, tierLabel: d.tierLabel, priority: d.priority, workFirst: !!d.workFirst,
    signals: (d.signals || []).filter(function (r) { return r === r.toUpperCase(); }),
    company: d.company, state: d.state, city: d.city, county: d.county, address: d.address || null,
    affected: d.affected, isClosure: d.isClosure, closureType: d.closureType, industry: d.industry || null,
    noticeDate: d.noticeDate, effectiveDate: d.effectiveDate, key: d.key,
    // disposition: who pays for this closing-plant lead (equipment/inventory + the building)
    buyers: liq.matchLiquidatorsFor(d.state, d.affected, d.industry)
  };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var state = (q.state || 'ALL').toUpperCase(), allStates = state === 'ALL';
  var maxTier = q.tier ? parseInt(q.tier, 10) : 99;
  var perState = q.perState ? Math.max(1, parseInt(q.perState, 10)) : 40;

  var deals = (await db.get('warn:deals')) || [];
  var meta = (await db.get('warn:meta')) || null;
  var pool = deals.filter(function (d) {
    if (!allStates && (d.state || '').toUpperCase() !== state) return false;
    if (d.tier && d.tier > maxTier) return false;
    return true;
  });

  var byState = {};
  pool.forEach(function (d) { var s = (d.state || '?').toUpperCase(); (byState[s] = byState[s] || []).push(d); });
  var states = Object.keys(byState).map(function (s) {
    var g = byState[s];
    g.sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)); });
    return {
      state: s, total: g.length, workFirst: g.filter(function (d) { return d.workFirst; }).length,
      topAffected: g.length ? Math.max.apply(null, g.map(function (d) { return d.affected || 0; })) : 0,
      deals: g.slice(0, perState).map(project)
    };
  }).sort(function (a, b) { return (b.workFirst - a.workFirst) || (b.total - a.total); });

  return j(res, 200, {
    ok: true, state: state, updatedMs: meta && meta.updatedMs || null,
    totals: { deals: pool.length, states: states.length, workFirst: pool.filter(function (d) { return d.workFirst; }).length },
    states: states
  });
};
