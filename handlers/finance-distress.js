/**
 * finance-distress.js — the FINANCE P3 desk (the distress-signal data feed). Reads ranked EDGAR
 * distress deals (finance:distress), groups by signal type, and returns each distressed company with
 * the paying subscribers it matches (lib/distress-funds.js) + a link to the SEC filing.
 * ADMIN-ONLY (?key=LEAD_ADMIN_KEY). GET /api/finance-distress?key=...&type=ALL[&tier=2][&per=60]
 */
var db = require('../lib/limen-db');
var funds = require('../lib/distress-funds');
function j(res, code, o) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }

function project(d) {
  var edgarUrl = d.cik ? ('https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + d.cik + '&type=8-K&dateb=&owner=include&count=20') : null;
  return {
    tier: d.tier, tierLabel: d.tierLabel, priority: d.priority, workFirst: !!d.workFirst,
    signals: (d.signals || []).filter(function (r) { return r === r.toUpperCase(); }),
    company: d.company, ticker: d.ticker || null, cik: d.cik, signalType: d.signalType, signalLabel: d.signalLabel,
    form: d.form, items: d.items || [], filingDate: d.filingDate, key: d.key, url: edgarUrl,
    buyers: funds.matchFundsFor(d.signalType)
  };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var type = (q.type || 'ALL'), allTypes = type === 'ALL';
  var maxTier = q.tier ? parseInt(q.tier, 10) : 99;
  var per = q.per ? Math.max(1, parseInt(q.per, 10)) : 60;

  var deals = (await db.get('finance:distress')) || [];
  var meta = (await db.get('finance:distress:meta')) || null;
  var pool = deals.filter(function (d) {
    if (!allTypes && d.signalType !== type) return false;
    if (d.tier && d.tier > maxTier) return false;
    return true;
  });

  var byType = {};
  pool.forEach(function (d) { (byType[d.signalType] = byType[d.signalType] || []).push(d); });
  // stable order: most-severe signal type first
  var ORDER = ['bankruptcy', 'default', 'delisting', 'nonreliance', 'goingconcern', 'latefiling'];
  var groups = Object.keys(byType).sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); }).map(function (t) {
    var g = byType[t];
    g.sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)) || String(b.filingDate).localeCompare(String(a.filingDate)); });
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
