/**
 * homestead.js — the P3 "top opportunities" portal, grouped STATE -> COUNTY.
 *
 * Reads the enriched distress deals (realauction:deals, enriched by the daily cron via
 * lib/deal-enrich.js) and returns them organized the way the Homestead portal shows them:
 * one state, its counties, and each county's top motivated-seller opportunities
 * (probate/heirs > foreign/out-of-state absentee > trust/LLC > in-state absentee), ranked.
 *
 * ADMIN-ONLY (?key=LEAD_ADMIN_KEY) — this exposes owner + mailing data (the real deal desk),
 * never public. The public Homestead marketing page will show teasers only, not this.
 *
 * GET /api/homestead?key=...&state=FL[&all=1][&tier=2][&perCounty=10]
 *   all=1     -> include non-residential (churches/vacant/commercial); default residential-only
 *   tier=N    -> only opportunities at tier <= N (1=work-first, 2=+strong ...)
 *   perCounty -> max opportunities per county (default 12)
 */
var db = require('../lib/limen-db');
var enrich = require('../lib/deal-enrich');
var buyers = require('../lib/buyers');

function j(res, code, o) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(o));
}

function project(d) {
  var o = d.owner || {};
  return {
    tier: d.tier, tierLabel: d.tierLabel, priority: d.priority, workFirst: !!d.workFirst,
    signals: (d.priorityReasons || []).filter(function (r) { return r === r.toUpperCase(); }),
    propType: d.propType, equity: d.equity,
    assessedValue: d.assessedValue || d.marketValue, judgment: d.judgment,
    livingArea: d.livingArea, yearBuilt: d.yearBuilt,
    address: d.street || d.address, city: d.city, zip: d.zip, county: d.county,
    saleDate: d.saleDate, product: d.product, caseNumber: d.caseNumber, parcel: d.parcel,
    url: d.url || null, enrichStatus: d.enrichStatus,
    owner: o.name || null, absentee: !!o.absentee,
    mailAddr: o.mailAddr || null, mailCity: o.mailCity || null, mailState: o.mailState || null, mailZip: o.mailZip || null,
    mailTo: o.name ? [o.mailAddr, o.mailCity, o.mailState, o.mailZip].filter(Boolean).join(', ') : null,
    // disposition: who to assign/sell to (matched on the value a buyer underwrites to)
    buyers: buyers.matchBuyersFor(d.state || 'FL', d.assessedValue || d.marketValue || d.equity || 0, null)
  };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var state = (q.state || 'FL').toUpperCase();
  var residentialOnly = q.all !== '1';
  var maxTier = q.tier ? parseInt(q.tier, 10) : 99;
  var perCounty = q.perCounty ? Math.max(1, parseInt(q.perCounty, 10)) : 12;

  var deals = (await db.get('realauction:deals')) || [];
  var meta = (await db.get('realauction:meta')) || null;

  // re-apply the value floor at read time (corrects deals scored under an older rule
  // without a re-scrape): underwater/thin equity can't be work-first.
  deals.forEach(function (d) {
    if (d.tier == null) return;
    var fl = enrich.floorTier(d, d.tier, d.tierLabel, []);
    if (fl) {
      d.tier = fl.tier; d.tierLabel = fl.tierLabel; d.workFirst = fl.tier <= 2;
      if ((d.priorityReasons || []).indexOf(fl.add) < 0) (d.priorityReasons = d.priorityReasons || []).push(fl.add);
    }
  });

  // filter to the state + (residential) + tier
  var pool = deals.filter(function (d) {
    if ((d.state || 'FL').toUpperCase() !== state) return false;
    if (residentialOnly && d.residential === false) return false;
    if (d.tier && d.tier > maxTier) return false;
    return true;
  });

  // group by county
  var byCounty = {};
  pool.forEach(function (d) {
    var c = d.county || 'Unknown';
    if (!byCounty[c]) byCounty[c] = { county: c, metro: d.metro || null, deals: [] };
    byCounty[c].deals.push(d);
  });

  var counties = Object.keys(byCounty).map(function (c) {
    var g = byCounty[c];
    g.deals.sort(function (a, b) {
      if ((a.tier || 9) !== (b.tier || 9)) return (a.tier || 9) - (b.tier || 9);
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      return (b.equity || -1e15) - (a.equity || -1e15);
    });
    var workFirst = g.deals.filter(function (d) { return d.workFirst; }).length;
    return {
      county: g.county, metro: g.metro,
      total: g.deals.length, workFirst: workFirst,
      topEquity: g.deals.length ? Math.max.apply(null, g.deals.map(function (d) { return d.equity || 0; })) : 0,
      opportunities: g.deals.slice(0, perCounty).map(project)
    };
  });

  // counties ranked by how many work-first opportunities they hold, then total
  counties.sort(function (a, b) { return (b.workFirst - a.workFirst) || (b.total - a.total); });

  var enrichedCount = pool.filter(function (d) { return d.enrichStatus === 'ok'; }).length;
  return j(res, 200, {
    ok: true, state: state,
    updatedMs: meta && meta.updatedMs || null,
    residentialOnly: residentialOnly,
    totals: { deals: pool.length, counties: counties.length, enriched: enrichedCount,
      workFirst: pool.filter(function (d) { return d.workFirst; }).length },
    counties: counties
  });
};
