/**
 * api/population-tools.js — Population Watch tool: HOW MANY YEARS OF INCOME IS A HOUSE?
 *
 *   GET /api/population-tools              → the national picture
 *   GET /api/population-tools?tool=state&st=MO
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
 *  - Income is per HOUSEHOLD and pre-tax, and the series lags by a year or more, so the
 *    ratio shown is slightly optimistic: today's price is divided by an older income.
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
    T.fredSeries(priceId, 365),
    T.fredSeries(incomeId, 365 * 5),
    T.fredSeries(hpiId, 365 * 5),
    T.fredSeries(listId, 365)
  ]);
  var price = got[0], income = got[1], hpi = got[2], listings = got[3];

  if (!price || !income) {
    return { ok: false, reason: 'FRED did not return both a median price and a median income for ' + suffix + '.' };
  }

  var now = ratio(price.value, income.value);
  // The same ratio at the START of the price series, so the shift is shown rather than claimed.
  var thenRatio = (price.first != null && income.first) ? ratio(price.first, income.first) : null;

  return {
    ok: true,
    scope: st || 'US',
    price: price.value, priceAsOf: price.date, priceChangeYear: price.changePct,
    priceFirst: price.first, priceFirstDate: price.firstDate,
    income: income.value, incomeAsOf: income.date,
    incomeFirst: income.first, incomeFirstDate: income.firstDate,
    yearsOfIncome: now,
    yearsOfIncomeThen: thenRatio,
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
    caveat: 'Listing price is what sellers ASK, not what buyers paid. Income is per household, pre-tax, and lags by a year or more, so this ratio is if anything flattering. It also ignores mortgage rates, and a statewide median hides big differences between a city and a rural county.'
  };
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (q.tool === 'state' && q.st) {
      var st = String(q.st).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      if (STATES.indexOf(st) === -1) return T.send(res, { ok: false, reason: 'Pick a valid two-letter US state code.' });
      return T.send(res, await T.cached('population:tool:priced:' + st, TTL, function () { return build(st); }));
    }
    var out = await T.cached('population:tool:priced:US', TTL, function () { return build(null); });
    out.states = STATES;
    return T.send(res, out);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
