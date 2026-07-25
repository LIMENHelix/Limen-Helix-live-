/**
 * api/industry-tools.js — Industry Watch tool: OPEN SAFETY RECALLS ON YOUR VEHICLE.
 *
 *   GET /api/industry-tools                                   → model years + a starting make list
 *   GET /api/industry-tools?tool=makes&year=2021
 *   GET /api/industry-tools?tool=models&year=2021&make=honda
 *   GET /api/industry-tools?tool=recalls&year=2021&make=honda&model=accord
 *
 * Why this and not another recall feed: Medicine already carries FDA food/drug/device recalls.
 * The one recall that is specific, personal and genuinely urgent is the one on the car in the
 * driveway, and NHTSA publishes two flags nobody surfaces — parkIt ("do not drive") and
 * parkOutSide ("fire risk, do not park in a garage"). Those change what you do TODAY.
 *
 * Source: NHTSA Recalls API (api.nhtsa.gov), keyless. Recalls are free to fix at any dealer,
 * with no expiry, which is the actionable fact most owners do not know.
 */
var T = require('../lib/tool-fetch');

var BASE = 'https://api.nhtsa.gov';
var TTL_LIST = 24 * 3600 * 1000;
var TTL_RECALL = 6 * 3600 * 1000;

function year(v) {
  var n = parseInt(String(v || '').replace(/\D/g, ''), 10);
  var now = new Date().getFullYear();
  if (!isFinite(n) || n < 1995 || n > now + 2) return null;
  return n;
}
function slug(v) { return T.cleanQuery(v, 40); }

// NHTSA returns ReportReceivedDate as DD/MM/YYYY, which reads as a valid but WRONG date if
// parsed as US order. Convert explicitly rather than handing it to Date().
function ddmmyyyy(v) {
  var m = String(v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
}

async function makes(y) {
  var yr = year(y);
  if (!yr) return { ok: false, reason: 'Pick a model year between 1995 and next year.' };
  return T.cached('industry:tool:makes:' + yr, TTL_LIST, async function () {
    var r = await T.getJSON(BASE + '/products/vehicle/makes?modelYear=' + yr + '&issueType=r', 12000);
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
      return { ok: false, reason: 'NHTSA returned ' + (r.status || 'no response') + ' for the make list.' };
    }
    var seen = {}, out = [];
    r.body.results.forEach(function (x) {
      var m = String(x.make || '').trim();
      if (m && !seen[m.toUpperCase()]) { seen[m.toUpperCase()] = 1; out.push(m); }
    });
    out.sort();
    return { ok: true, year: yr, makes: out, source: 'NHTSA', sourceUrl: 'https://www.nhtsa.gov/recalls' };
  });
}

async function models(y, mk) {
  var yr = year(y), make = slug(mk);
  if (!yr || !make) return { ok: false, reason: 'Pick a model year and a make.' };
  return T.cached('industry:tool:models:' + yr + ':' + T.slugKey(make), TTL_LIST, async function () {
    var r = await T.getJSON(BASE + '/products/vehicle/models?modelYear=' + yr + '&make=' + encodeURIComponent(make) + '&issueType=r', 12000);
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
      return { ok: false, reason: 'NHTSA returned ' + (r.status || 'no response') + ' for the model list.' };
    }
    var seen = {}, out = [];
    r.body.results.forEach(function (x) {
      var m = String(x.model || '').trim();
      if (m && !seen[m.toUpperCase()]) { seen[m.toUpperCase()] = 1; out.push(m); }   // NHTSA repeats models
    });
    out.sort();
    return { ok: true, year: yr, make: make, models: out, source: 'NHTSA', sourceUrl: 'https://www.nhtsa.gov/recalls' };
  });
}

async function recalls(y, mk, md) {
  var yr = year(y), make = slug(mk), model = slug(md);
  if (!yr || !make || !model) return { ok: false, reason: 'Pick a model year, make and model.' };
  var key = 'industry:tool:recalls:' + yr + ':' + T.slugKey(make) + ':' + T.slugKey(model);
  return T.cached(key, TTL_RECALL, async function () {
    var url = BASE + '/recalls/recallsByVehicle?make=' + encodeURIComponent(make)
      + '&model=' + encodeURIComponent(model) + '&modelYear=' + yr;
    var r = await T.getJSON(url, 12000);
    if (r.status !== 200 || !r.body || !Array.isArray(r.body.results)) {
      return { ok: false, reason: 'NHTSA returned ' + (r.status || 'no response') + ' for that vehicle.' };
    }
    var rows = r.body.results.map(function (x) {
      return {
        campaign: x.NHTSACampaignNumber || null,
        manufacturer: x.Manufacturer || null,
        component: x.Component || null,
        summary: (x.Summary || '').slice(0, 700) || null,
        consequence: (x.Consequence || '').slice(0, 500) || null,
        remedy: (x.Remedy || '').slice(0, 500) || null,
        notes: (x.Notes || '').slice(0, 300) || null,
        reported: ddmmyyyy(x.ReportReceivedDate),
        parkIt: x.parkIt === true,                 // do not drive
        parkOutSide: x.parkOutSide === true,       // fire risk: keep away from structures
        overTheAir: x.overTheAirUpdate === true
      };
    });
    rows.sort(function (a, b) { return String(b.reported || '').localeCompare(String(a.reported || '')); });
    return {
      ok: true, year: yr, make: make, model: model, count: rows.length, rows: rows,
      urgent: rows.filter(function (x) { return x.parkIt || x.parkOutSide; }).length,
      source: 'NHTSA vehicle safety recalls',
      sourceUrl: 'https://www.nhtsa.gov/recalls',
      note: 'A safety recall is repaired FREE at any franchised dealer, with no time limit and regardless of who owns the car now or how old it is. This list is by year/make/model; to confirm whether YOUR specific car is still unrepaired, check its VIN on the NHTSA site.'
    };
  });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'makes') return T.send(res, await makes(q.year));
    if (q.tool === 'models') return T.send(res, await models(q.year, q.make));
    if (q.tool === 'recalls') return T.send(res, await recalls(q.year, q.make, q.model));
    var now = new Date().getFullYear();
    var years = [];
    for (var y = now + 1; y >= 1996; y--) years.push(y);
    return T.send(res, { ok: true, years: years, defaultYear: now - 3, source: 'NHTSA', sourceUrl: 'https://www.nhtsa.gov/recalls' });
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
