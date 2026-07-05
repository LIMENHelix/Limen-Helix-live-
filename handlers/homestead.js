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
    owner: o.name || null, absentee: !!o.absentee, servicer: !!d.servicer, ownerDealCount: d.ownerDealCount || 1,
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
  var allStates = state === 'ALL';
  var residentialOnly = q.all !== '1';
  var maxTier = q.tier ? parseInt(q.tier, 10) : 99;
  var perCounty = q.perCounty ? Math.max(1, parseInt(q.perCounty, 10)) : 12;

  var deals = (await db.get('realauction:deals')) || [];
  var meta = (await db.get('realauction:meta')) || null;

  // servicer/lockbox mailing detection needs the FULL inventory (same address across many
  // distinct owners = an escrow processor, not the seller) — build it once over all deals.
  var servicerSet = enrich.servicerMailSet(deals);

  // read-time corrections (fix deals scored under an older rule without a re-scrape):
  //  1) value floor — underwater/thin equity can't be work-first
  //  2) servicer down-weight — mail can't reach the seller, so it can't be work-first
  deals.forEach(function (d) {
    if (d.tier == null) return;
    var fl = enrich.floorTier(d, d.tier, d.tierLabel, []);
    if (fl) {
      d.tier = fl.tier; d.tierLabel = fl.tierLabel; d.workFirst = fl.tier <= 2;
      if ((d.priorityReasons || []).indexOf(fl.add) < 0) (d.priorityReasons = d.priorityReasons || []).push(fl.add);
    }
    var sv = enrich.servicerTier(d, servicerSet);
    if (sv) {
      d.servicer = true; d.tier = sv.tier; d.tierLabel = sv.tierLabel; d.workFirst = sv.tier <= 2;
      if ((d.priorityReasons || []).indexOf(sv.add) < 0) (d.priorityReasons = d.priorityReasons || []).push(sv.add);
    }
  });

  // filter to the state (or all) + (residential) + tier
  var pool = deals.filter(function (d) {
    if (!allStates && (d.state || 'FL').toUpperCase() !== state) return false;
    if (residentialOnly && d.residential === false) return false;
    if (d.tier && d.tier > maxTier) return false;
    return true;
  });

  // OWNER ROLLUP: one owner with many distressed parcels = a single bulk lead (one letter/call,
  // not N). Group by normalized owner name across the current view; stamp each deal with its
  // owner's portfolio size so the UI can badge it, and surface the multi-property owners.
  // generic/placeholder owner labels appear on MANY unrelated parcels — never roll them up as one owner
  var GENERIC_OWNER = /^(UNKNOWN|UNKNOWN HEIRS?|ALL UNKNOWN|HEIRS?( OF)?|ESTATE OF|THE ESTATE OF|TENANT|OCCUPANT|CURRENT (OWNER|RESIDENT)|NO OWNER|OWNER( UNKNOWN)?|N ?A|NONE|TBD)$/;
  function ownerKey(n) {
    var k = String(n || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return GENERIC_OWNER.test(k) ? '' : k;
  }
  var portMap = {};
  pool.forEach(function (d) {
    var o = d.owner && d.owner.name; if (!o) return;
    var k = ownerKey(o); if (!k) return;
    var p = portMap[k] || (portMap[k] = { name: o, count: 0, equity: 0, deals: [], mailTo: null, servicer: false });
    p.count++; p.equity += (d.equity || 0); p.deals.push(d);
    if (d.servicer) p.servicer = true;
    if (!p.mailTo && d.owner) p.mailTo = [d.owner.mailAddr, d.owner.mailCity, d.owner.mailState, d.owner.mailZip].filter(Boolean).join(', ');
  });
  Object.keys(portMap).forEach(function (k) { portMap[k].deals.forEach(function (d) { d.ownerDealCount = portMap[k].count; }); });
  var portfolios = Object.keys(portMap).map(function (k) { return portMap[k]; })
    .filter(function (p) { return p.count >= 2 && !p.servicer; })
    .map(function (p) {
      p.deals.sort(function (a, b) { return (b.equity || 0) - (a.equity || 0); });
      return {
        owner: p.name, mailTo: p.mailTo || null, properties: p.count, totalEquity: Math.round(p.equity),
        counties: Object.keys(p.deals.reduce(function (m, d) { m[d.county || '?'] = 1; return m; }, {})),
        properties_list: p.deals.slice(0, 25).map(function (d) {
          return { address: d.street || d.address, county: d.county, equity: d.equity, tier: d.tier, saleDate: d.saleDate, url: d.url || null };
        })
      };
    })
    .sort(function (a, b) { return (b.properties - a.properties) || (b.totalEquity - a.totalEquity); });

  // group by state+county (county names repeat across states)
  var byCounty = {};
  pool.forEach(function (d) {
    var st = (d.state || 'FL').toUpperCase(), c = d.county || 'Unknown', k = st + '|' + c;
    if (!byCounty[k]) byCounty[k] = { state: st, county: c, metro: d.metro || null, deals: [] };
    byCounty[k].deals.push(d);
  });

  var counties = Object.keys(byCounty).map(function (k) {
    var g = byCounty[k];
    g.deals.sort(function (a, b) {
      if ((a.tier || 9) !== (b.tier || 9)) return (a.tier || 9) - (b.tier || 9);
      if (!!a.servicer !== !!b.servicer) return a.servicer ? 1 : -1; // reachable before lockbox
      if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
      return (b.equity || -1e15) - (a.equity || -1e15);
    });
    var workFirst = g.deals.filter(function (d) { return d.workFirst; }).length;
    return {
      state: g.state, county: g.county, metro: g.metro,
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
      workFirst: pool.filter(function (d) { return d.workFirst; }).length, portfolios: portfolios.length },
    portfolios: portfolios.slice(0, 25),
    counties: counties
  });
};
