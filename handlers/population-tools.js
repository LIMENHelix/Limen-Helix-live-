/**
 * api/population-tools.js — Population Watch tools.
 *
 *   GET /api/population-tools              → housing price-to-income (kept for the old shell)
 *   GET /api/population-tools?tool=state&st=MO
 *   GET /api/population-tools?tool=meter   → US total fertility (World Bank)
 *   GET /api/population-tools?tool=mig&zip=64111
 *   GET /api/population-tools?tool=mig&fips=29095
 *   GET /api/population-tools?tool=mig&q=Jackson
 *
 * The civic /population desk uses tool=mig (Census PEP + IRS SOI + optional ACS)
 * dualed to the TFR meter. County aggregates only. Never re-identifies people.
 *
 * Why this: everyone knows housing "got expensive". Almost nobody can say by how much
 * relative to what people where they live actually earn. That ratio, median asking price
 * divided by median household income, is the single number that captures being priced out,
 * and it is computable from two published federal series.
 *
 * A rule of thumb long used by lenders is that about 3x household income was affordable.
 * The tool shows the real figure against that reference and against the earliest year in
 * the series, so the change is visible rather than asserted.
 *
 * Sources (FRED, needs FRED_API_KEY which is already set in production):
 *   MEDLISPRI<ST>        median LISTING price, monthly (Realtor.com via FRED)
 *   MEHOINUS<ST>A646N    median household income, annual, NOMINAL dollars
 *   <ST>STHPI            all-transactions house price index, quarterly
 *   ACTLISCOU<ST>        active listing count, monthly
 *
 * HONESTY, and these matter:
 *  - Listing price is what sellers ASK, not what buyers paid.
 *  - Income is per HOUSEHOLD and pre-tax, and the series lags the price series by roughly
 *    two years (measured: 936 days vs 54). A current price divided by an older, LOWER income
 *    inflates the multiple, so the figure reads slightly worse than reality, not better.
 *  - Price-to-income ignores mortgage rates, which change affordability a great deal.
 *  - Statewide medians hide enormous variation between a city and a rural county.
 */
var T = require('../lib/tool-fetch');

var TTL = 24 * 3600 * 1000;
var STATES = ('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND '
  + 'OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC').split(' ');

var AFFORDABLE_MULTIPLE = 3;   // the long-standing lender rule of thumb, shown as a reference only

function ratio(price, income) {
  if (price == null || !income) return null;
  return +(price / income).toFixed(2);
}

async function build(st) {
  if (!process.env.FRED_API_KEY) {
    return { ok: false, reason: 'FRED_API_KEY is not set on this deployment, so the housing series cannot be read.' };
  }
  var suffix = st || 'US';
  var priceId = st ? 'MEDLISPRI' + st : 'MEDLISPRIUS';
  var incomeId = st ? 'MEHOINUS' + st + 'A646N' : 'MEHOINUSA646N';
  var hpiId = st ? st + 'STHPI' : 'USSTHPI';
  var listId = st ? 'ACTLISCOU' + st : 'ACTLISCOUUS';

  var got = await Promise.all([
    T.fredSeries(priceId, 365, true),
    T.fredSeries(incomeId, 365 * 5, true),
    T.fredSeries(hpiId, 365 * 5),
    T.fredSeries(listId, 365)
  ]);
  var price = got[0], income = got[1], hpi = got[2], listings = got[3];

  if (!price || !income) {
    return { ok: false, reason: 'FRED did not return both a median price and a median income for ' + suffix + '.' };
  }

  var now = ratio(price.value, income.value);

  // The same ratio at the START of the price series. The two series do NOT start in the same
  // year (listing prices begin around 2016, the income series in the 1980s), so pairing each
  // series' own earliest point compares a 2016 price against a 1984 income and produces a
  // ratio that is not only wrong but backwards. Align on the YEAR instead.
  var thenRatio = null, thenYear = null, thenPrice = null, thenIncome = null;
  if (price.firstDate && income.obs && income.obs.length) {
    var py = String(price.firstDate).slice(0, 4);
    var match = null;
    for (var i = 0; i < income.obs.length; i++) {
      if (String(income.obs[i].date).slice(0, 4) === py) { match = income.obs[i]; break; }
    }
    // no exact year: take the earliest income point at or after the price series began
    if (!match) {
      for (var k = income.obs.length - 1; k >= 0; k--) {
        if (income.obs[k].date >= price.firstDate) { match = income.obs[k]; break; }
      }
    }
    if (match && match.value) {
      thenYear = String(match.date).slice(0, 4);
      thenPrice = price.first;
      thenIncome = match.value;
      thenRatio = ratio(price.first, match.value);
    }
  }

  return {
    ok: true,
    scope: st || 'US',
    price: price.value, priceAsOf: price.date, priceChangeYear: price.changePct,
    priceFirst: price.first, priceFirstDate: price.firstDate,
    income: income.value, incomeAsOf: income.date,
    incomeFirst: income.first, incomeFirstDate: income.firstDate,
    yearsOfIncome: now,
    yearsOfIncomeThen: thenRatio,
    thenYear: thenYear,
    thenPrice: thenPrice,
    thenIncome: thenIncome,
    affordableReference: AFFORDABLE_MULTIPLE,
    // what income WOULD be needed for the old rule of thumb to hold at today's price
    incomeNeededForRule: price.value != null ? Math.round(price.value / AFFORDABLE_MULTIPLE) : null,
    hpiChange5yr: hpi ? hpi.changePct : null,
    listings: listings ? listings.value : null,
    listingsChangeYear: listings ? listings.changePct : null,
    series: { price: priceId, income: incomeId, hpi: hpiId, listings: listId },
    sourceUrl: 'https://fred.stlouisfed.org/series/' + priceId,
    source: 'FRED (St. Louis Fed): Realtor.com listing prices and Census median household income',
    note: 'Years of income is the median asking price divided by median household income. A multiple near ' + AFFORDABLE_MULTIPLE + 'x was the long-standing lender rule of thumb for affordable.',
    // The direction of the income lag was stated backwards in the first version. Dividing a
    // CURRENT price by an OLDER, lower income inflates the multiple, so the bias runs against
    // affordability, not for it. Measured 2026-07-25: price was 54 days old, income 936 days.
    incomeLagDays: (function () {
      var pd = Date.parse(price.date), idt = Date.parse(income.date);
      return (pd && idt) ? Math.round((pd - idt) / 86400000) : null;
    })(),
    caveat: 'Listing price is what sellers ASK, not what buyers paid. Income is per household and pre-tax, and the income series lags the price series by roughly two years, so a current price is being divided by an older and lower income. That pushes the multiple UP, meaning this reads slightly worse than reality rather than better. It also ignores mortgage rates, and a statewide median hides big differences between a city and a rural county.'
  };
}

// ── county migration desk (Census PEP + IRS SOI + optional ACS + TFR) ──
// Aggregate county figures only. Nothing here re-identifies a person.

var COUNTY_CSV = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv';
var SOI_IN = 'https://www.irs.gov/pub/irs-soi/countyinflow2223.csv';
var SOI_OUT = 'https://www.irs.gov/pub/irs-soi/countyoutflow2223.csv';
var SOI_YEAR = '2022-23';
var MIG_TTL = 24 * 3600 * 1000;

function pad2(s) { return String(s || '').replace(/\D/g, '').padStart(2, '0').slice(-2); }
function pad3(s) { return String(s || '').replace(/\D/g, '').padStart(3, '0').slice(-3); }
function normFips(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.length === 4) d = '0' + d;
  return d.length === 5 ? d : '';
}

function parseCsv(text) {
  var lines = String(text || '').split(/\r?\n/).filter(function (l) { return l.length; });
  if (!lines.length) return { idx: {}, data: [] };
  var head = lines[0].split(','), idx = {};
  head.forEach(function (h, i) { idx[h] = i; });
  return { idx: idx, data: lines.slice(1).map(function (l) { return l.split(','); }) };
}

async function loadPepCounties() {
  return T.cached('population:tool:pep-counties:v1', MIG_TTL, async function () {
    var r = await T.getText(COUNTY_CSV, 25000);
    if (r.status !== 200 || !r.raw || r.raw.length < 1000) {
      return { ok: false, reason: 'Census county estimates were not reachable.' };
    }
    var p = parseCsv(r.raw), x = p.idx, map = {}, list = [];
    p.data.forEach(function (c) {
      if (c[x.SUMLEV] !== '050') return;
      var fips = pad2(c[x.STATE]) + pad3(c[x.COUNTY]);
      var o = {
        fips: fips,
        county: c[x.CTYNAME] || null,
        state: c[x.STNAME] || null,
        pop: parseInt(c[x.POPESTIMATE2023], 10) || 0,
        netDomestic: parseInt(c[x.DOMESTICMIG2023], 10) || 0,
        rate: parseFloat(c[x.RDOMESTICMIG2023]),
        year: '2023'
      };
      if (!isFinite(o.rate)) o.rate = null;
      map[fips] = o;
      list.push({ fips: fips, county: o.county, state: o.state, pop: o.pop });
    });
    if (!list.length) return { ok: false, reason: 'Census county estimates parsed to zero rows.' };
    return { ok: true, map: map, list: list, source: 'U.S. Census Bureau, Population Estimates (Vintage 2023)' };
  });
}

function soiKey(stateFips, countyFips) {
  return pad2(stateFips) + pad3(countyFips);
}

function parseSoiTotals(raw) {
  var lines = String(raw || '').split(/\r?\n/);
  var map = {};
  for (var i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    var c = lines[i].split(',');
    if (c.length < 9) continue;
    var a = pad2(c[0]), b = pad3(c[1]), oState = pad2(c[2]), oCty = pad3(c[3]);
    // Totals use origin/dest 96/000 (US+foreign) or 97/000 (US).
    var summary = (oState === '96' || oState === '97') && oCty === '000';
    if (!summary) continue;
    var fips = soiKey(a, b);
    if (!map[fips]) map[fips] = { usForeign: null, us: null };
    var rec = {
      returns: parseInt(c[6], 10) || 0,
      people: parseInt(c[7], 10) || 0,
      agiThousands: parseInt(c[8], 10) || 0
    };
    if (oState === '96') map[fips].usForeign = rec;
    else map[fips].us = rec;
  }
  return map;
}

async function loadSoi() {
  return T.cached('population:tool:soi-2223:v1', 7 * 24 * 3600 * 1000, async function () {
    var both = await Promise.all([
      T.getText(SOI_IN, 30000),
      T.getText(SOI_OUT, 30000)
    ]);
    if (both[0].status !== 200 || !both[0].raw || both[0].raw.length < 1000) {
      return { ok: false, reason: 'IRS SOI county inflow file was not reachable.' };
    }
    if (both[1].status !== 200 || !both[1].raw || both[1].raw.length < 1000) {
      return { ok: false, reason: 'IRS SOI county outflow file was not reachable.' };
    }
    var inflow = parseSoiTotals(both[0].raw);
    var outflow = parseSoiTotals(both[1].raw);
    return {
      ok: true, inflow: inflow, outflow: outflow, year: SOI_YEAR,
      source: 'IRS SOI county-to-county migration, tax years 2022-23',
      sourceUrl: 'https://www.irs.gov/statistics/soi-tax-stats-migration-data'
    };
  });
}

async function tfrMeter() {
  return T.cached('population:tool:tfr:v1', MIG_TTL, async function () {
    var r = await T.getJSON('https://api.worldbank.org/v2/country/USA/indicator/SP.DYN.TFRT.IN?format=json&mrnev=1', 10000);
    if (r.status !== 200 || !Array.isArray(r.body) || !Array.isArray(r.body[1]) || !r.body[1][0]) {
      return { ok: false, reason: 'World Bank TFR did not respond.' };
    }
    var row = r.body[1][0];
    var v = Number(row.value);
    if (!isFinite(v)) return { ok: false, reason: 'World Bank TFR had no usable value.' };
    return {
      ok: true,
      value: v,
      date: row.date || null,
      lastUpdated: r.body[0] && r.body[0].lastupdated || null,
      replacement: 2.1,
      source: 'World Bank SP.DYN.TFRT.IN (United States total fertility rate)',
      sourceUrl: 'https://data.worldbank.org/indicator/SP.DYN.TFRT.IN?locations=US',
      note: 'Births per woman, annual. Replacement is about 2.1. Dualed next to the county scan as the national fertility backdrop, not a local forecast.'
    };
  });
}

async function acsForFips(fips) {
  var st = fips.slice(0, 2), cty = fips.slice(2);
  var url = 'https://api.census.gov/data/2023/acs/acs5?get=NAME,B07001_001E,B07001_017E,B07001_033E,B07001_049E,B07001_065E,B07001_081E'
    + '&for=county:' + cty + '&in=state:' + st;
  if (process.env.CENSUS_API_KEY) url += '&key=' + process.env.CENSUS_API_KEY;
  var r = await T.getJSON(url, 12000);
  if (r.status !== 200 || !Array.isArray(r.body) || !r.body[1]) {
    return { available: false, reason: r.status === 204 || r.status === 403
      ? 'ACS needs a Census key on this deployment, or the county had no 2023 ACS 5-year row.'
      : 'ACS returned ' + (r.status || 'no response') + '.' };
  }
  var row = r.body[1];
  function n(i) { var v = parseInt(row[i], 10); return isFinite(v) ? v : null; }
  var total = n(1);
  return {
    available: true,
    name: row[0] || null,
    total: total,
    sameHouse: n(2),
    sameCounty: n(3),
    sameState: n(4),
    differentState: n(5),
    abroad: n(6),
    year: '2019-2023',
    source: 'Census ACS 5-year 2023, table B07001 (geographical mobility in the past year)',
    note: 'County aggregates only. ACS never identifies a person.'
  };
}

async function zipToFips(zip) {
  var z = String(zip || '').replace(/\D/g, '').slice(0, 5);
  if (z.length !== 5) return { ok: false, reason: 'Enter a 5-digit ZIP.' };
  var geo = await T.getJSON('https://api.zippopotam.us/us/' + z, 8000);
  if (geo.status !== 200 || !geo.body || !geo.body.places || !geo.body.places[0]) {
    return { ok: false, reason: 'That ZIP did not resolve.' };
  }
  var place = geo.body.places[0];
  var lat = parseFloat(place.latitude), lon = parseFloat(place.longitude);
  var g = await T.getJSON(
    'https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=' + lon
      + '&y=' + lat + '&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json',
    10000
  );
  var counties = g.body && g.body.result && g.body.result.geographies && g.body.result.geographies.Counties;
  if (g.status !== 200 || !counties || !counties[0]) {
    return { ok: false, reason: 'Could not resolve that ZIP to a county.' };
  }
  var cc = counties[0];
  return {
    ok: true,
    zip: z,
    place: place['place name'] || '',
    stateAbbr: place.state || '',
    fips: pad2(cc.STATE) + pad3(cc.COUNTY),
    countyName: cc.NAME || null
  };
}

function soiFor(soi, fips) {
  if (!soi || !soi.ok) return { available: false, reason: (soi && soi.reason) || 'IRS SOI not loaded.' };
  var inn = soi.inflow[fips] || {};
  var out = soi.outflow[fips] || {};
  var inUS = inn.us || inn.usForeign;
  var outUS = out.us || out.usForeign;
  if (!inUS && !outUS) return { available: false, reason: 'No IRS SOI totals for that county in 2022-23.' };
  var inRet = inUS ? inUS.returns : null;
  var outRet = outUS ? outUS.returns : null;
  return {
    available: true,
    year: soi.year,
    inflowReturns: inRet,
    outflowReturns: outRet,
    netReturns: (inRet != null && outRet != null) ? (inRet - outRet) : null,
    inflowPeople: inUS ? inUS.people : null,
    outflowPeople: outUS ? outUS.people : null,
    source: soi.source,
    sourceUrl: soi.sourceUrl,
    note: 'Counts tax returns (and exemptions) that changed county. Not every resident, and not a person-level file. Aggregate only.'
  };
}

async function countyScan(fips, extra) {
  var pepPack = await loadPepCounties();
  if (!pepPack.ok) return { ok: false, reason: pepPack.reason };
  var pep = pepPack.map[fips];
  if (!pep) return { ok: false, reason: 'No Census county estimate for FIPS ' + fips + '.' };
  var soi = await Promise.race([
    loadSoi().catch(function () { return { ok: false, reason: 'IRS SOI lookup failed.' }; }),
    new Promise(function (resolve) {
      setTimeout(function () { resolve({ ok: false, reason: 'IRS SOI timed out on this pass; Census PEP is still shown.' }); }, 8000);
    })
  ]);
  var acs = await acsForFips(fips).catch(function () { return { available: false, reason: 'ACS lookup failed.' }; });
  var tfr = await tfrMeter().catch(function () { return { ok: false }; });
  return {
    ok: true,
    fips: fips,
    county: pep.county,
    state: pep.state,
    zip: extra && extra.zip || null,
    place: extra && extra.place || null,
    pep: {
      pop: pep.pop,
      netDomestic: pep.netDomestic,
      rate: pep.rate,
      year: pep.year,
      source: pepPack.source,
      sourceUrl: 'https://www.census.gov/programs-surveys/popest.html'
    },
    soi: soiFor(soi, fips),
    acs: acs,
    tfr: tfr && tfr.ok ? tfr : null,
    asOf: new Date().toISOString().slice(0, 10),
    caveat: 'County aggregates only. Nothing here re-identifies a household or a person. Census PEP is calendar-year 2023 residence change; IRS SOI is tax-return 2022-23; ACS is a 5-year sample. They do not count the same people.',
    note: 'A one-time county cut. The Watch re-cuts the markets you name each month.'
  };
}

async function searchCounty(qRaw) {
  var q = T.cleanQuery(qRaw, 60);
  if (q.length < 3) return { ok: false, reason: 'Enter at least three letters of a county name.' };
  var pepPack = await loadPepCounties();
  if (!pepPack.ok) return { ok: false, reason: pepPack.reason };
  var ql = q.toLowerCase();
  var rows = pepPack.list.filter(function (r) {
    return (r.county && r.county.toLowerCase().indexOf(ql) !== -1)
      || (r.state && r.state.toLowerCase().indexOf(ql) !== -1 && ql.length >= 4);
  }).sort(function (a, b) { return b.pop - a.pop; }).slice(0, 20);
  return {
    ok: true, query: q, found: rows.length, rows: rows,
    source: pepPack.source,
    note: 'Pick a county to see Census, IRS SOI, and ACS aggregates. County level only.'
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'meter') return T.send(res, await tfrMeter());
    if (q.tool === 'mig') {
      if (q.fips) {
        var fips = normFips(q.fips);
        if (!fips) return T.send(res, { ok: false, reason: 'Enter a 5-digit county FIPS.' });
        return T.send(res, await T.cachedQuery('population:tool:mig:fips:' + fips, MIG_TTL, function () { return countyScan(fips); }));
      }
      if (q.zip) {
        var z = String(q.zip).replace(/\D/g, '').slice(0, 5);
        if (z.length !== 5) return T.send(res, { ok: false, reason: 'Enter a 5-digit ZIP.' });
        return T.send(res, await T.cachedQuery('population:tool:mig:zip:' + z, MIG_TTL, async function () {
          var loc = await zipToFips(z);
          if (!loc.ok) return loc;
          return countyScan(loc.fips, loc);
        }));
      }
      if (q.q) return T.send(res, await searchCounty(q.q));
      return T.send(res, { ok: false, reason: 'Enter a ZIP, a 5-digit county FIPS, or a county name.' });
    }
    if (q.tool === 'state' && q.st) {
      var st = String(q.st).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      if (STATES.indexOf(st) === -1) return T.send(res, { ok: false, reason: 'Pick a valid two-letter US state code.' });
      return T.send(res, await T.cached('population:tool:priced:v3:' + st, TTL, function () { return build(st); }));
    }
    var out = await T.cached('population:tool:priced:v3:US', TTL, function () { return build(null); });
    out.states = STATES;
    return T.send(res, out);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
