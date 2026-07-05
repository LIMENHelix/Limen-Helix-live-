/**
 * homestead-validation.js — the OUTCOME LOOP. Proves whether the P3 ranking is real.
 *
 * The whole moat is: does the P3 phase-score predict who transacts (and how deep the
 * discount) BETTER than a dumb probate+absentee baseline filter? This instruments that,
 * PASSIVELY (no outreach needed — pure public-record ground truth):
 *   - snapshot: on first sighting, log each flagged FL parcel with its P3 attributes.
 *   - check:    later, re-query the cadastral; a sale dated after firstSeen = it transacted;
 *               discount = sale price / just value.
 *   - report:   bucket by P3 tier and by baseline → n, transacted %, median discount.
 *
 * Data accrues over weeks-to-months (that's the nature of ground truth); this starts the loop.
 * GET ?key= -> summary. POST {key,action:'snapshot'|'check'} -> run a step. Admin-only.
 */
var db = require('../lib/limen-db');
var enrich = require('../lib/deal-enrich');
var VKEY = 'homestead:validation';
function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }
function bucket(items) {
  var sold = items.filter(function (x) { return x.sold; });
  var discs = sold.map(function (x) { return x.discount; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
  return { n: items.length, sold: sold.length, soldPct: items.length ? +(100 * sold.length / items.length).toFixed(1) : 0, medianDiscount: discs.length ? discs[Math.floor(discs.length / 2)] : null };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();
  var body = method === 'POST' ? await readBody(req) : {};
  if (ADMIN && (q.key || body.key) !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var track = (await db.get(VKEY)) || {};

  // SNAPSHOT — add newly-seen FL flagged parcels to the cohort (idempotent; first sighting only)
  if (method === 'POST' && body.action === 'snapshot') {
    var deals = (await db.get('realauction:deals')) || [];
    var added = 0;
    deals.forEach(function (d) {
      if ((d.state || 'FL').toUpperCase() !== 'FL') return;
      var k = d.parcel || d.caseNumber; if (!k || !d.tier || !d.parcel) return;
      if (track[k]) return; // cohort entry = first time we flagged it
      var s = d.signals || {};
      track[k] = {
        parcel: d.parcel, county: d.county, address: d.street || d.address,
        tier: d.tier, priority: d.priority, workFirst: !!d.workFirst,
        baseline: !!(s.probate || s.foreign || s.outOfState || s.inState), // dumb probate/absentee filter
        assessedValue: d.assessedValue || d.marketValue || null, equity: d.equity || null,
        auctionDate: d.saleDate, firstSeenMs: Date.now(),
        sold: null, saleYr: null, saleMo: null, salePrice: null, discount: null, checkedMs: null
      };
      added++;
    });
    await db.set(VKEY, track);
    return j(res, 200, { ok: true, action: 'snapshot', tracked: Object.keys(track).length, added: added });
  }

  // CHECK — look up outcomes for not-yet-sold parcels (capped per run, oldest-checked first)
  if (method === 'POST' && body.action === 'check') {
    var lim = Math.min(80, body.limit || 60);
    var keys = Object.keys(track).filter(function (k) { return track[k].parcel && !track[k].sold; })
      .sort(function (a, b) { return (track[a].checkedMs || 0) - (track[b].checkedMs || 0); }).slice(0, lim);
    var checked = 0, newlySold = 0;
    for (var i = 0; i < keys.length; i++) {
      var t = track[keys[i]];
      var s = await enrich.saleInfoFL(t.parcel);
      t.checkedMs = Date.now();
      if (s && s.saleYr && s.salePrice > 0) {
        var fs = new Date(t.firstSeenMs);
        var soldAfter = s.saleYr > fs.getFullYear() || (s.saleYr === fs.getFullYear() && (s.saleMo || 0) >= (fs.getMonth() + 1));
        if (soldAfter) {
          t.sold = true; t.saleYr = s.saleYr; t.saleMo = s.saleMo; t.salePrice = s.salePrice;
          var denom = t.assessedValue || s.jv;
          t.discount = denom > 0 ? +(s.salePrice / denom).toFixed(3) : null;
          newlySold++;
        }
      }
      checked++;
    }
    await db.set(VKEY, track);
    return j(res, 200, { ok: true, action: 'check', checked: checked, newlySold: newlySold, tracked: Object.keys(track).length });
  }

  // REPORT — the number: P3 tiers vs the dumb baseline
  var all = Object.keys(track).map(function (k) { return track[k]; });
  var byTier = {}; [1, 2, 3, 4].forEach(function (t) { byTier['T' + t] = bucket(all.filter(function (x) { return x.tier === t; })); });
  return j(res, 200, {
    ok: true,
    tracked: all.length,
    checked: all.filter(function (x) { return x.checkedMs; }).length,
    sold: all.filter(function (x) { return x.sold; }).length,
    comparison: {
      p3_workFirst: bucket(all.filter(function (x) { return x.workFirst; })),
      baseline_probate_or_absentee: bucket(all.filter(function (x) { return x.baseline; })),
      neither: bucket(all.filter(function (x) { return !x.workFirst && !x.baseline; })),
      overall: bucket(all)
    },
    byTier: byTier,
    note: 'Outcomes accrue over weeks-months. If p3_workFirst soldPct/discount beats baseline, the ranking is real.'
  });
};
