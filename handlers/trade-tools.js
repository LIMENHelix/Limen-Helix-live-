/**
 * api/trade-tools.js — Trade Watch tool: WHO AMERICA BUYS FROM, AND WHAT IT SELLS BACK.
 *
 *   GET /api/trade-tools     → per-partner goods imports, exports and the gap, plus what
 *                              imported goods now cost against a year ago
 *
 * Why this rather than another trade-balance chart: the Trade front already carries the World
 * Bank's annual global view. This is the monthly, partner-by-partner ledger, plus the number
 * that actually reaches a household, the import price index. "Imported goods cost X% more than
 * a year ago" is a fact about a shopper, not about a macro aggregate.
 *
 * Sources (FRED, needs FRED_API_KEY which is already set in production):
 *   IMP<cc> / EXP<cc>   goods imports (customs basis) and exports (FAS basis), monthly
 *   IR / IQ             import and export price indexes, all commodities
 *   IREXFUELS           import prices excluding fuels, which is the better read on
 *                       consumer goods because energy swings dominate the headline
 *   BOPGSTB             total goods and services balance
 *
 * HONESTY: every partner line here is GOODS ONLY. The United States runs a large services
 * surplus that these numbers exclude, so a bilateral goods gap overstates the true imbalance.
 * Imports are customs basis and exports are FAS basis, which are not perfectly comparable.
 * Only partners whose FRED series were verified to exist are included; this is not the
 * complete partner list.
 */
var T = require('../lib/tool-fetch');

var TTL = 12 * 3600 * 1000;

// Verified to exist on FRED. Kept deliberately short rather than guessed wide: a 404 series
// would silently drop a partner and quietly understate the picture.
var PARTNERS = [
  { code: 'CH', name: 'China' },
  { code: 'MX', name: 'Mexico' },
  { code: 'CA', name: 'Canada' },
  { code: 'JP', name: 'Japan' },
  { code: 'GE', name: 'Germany' },
  { code: 'KR', name: 'South Korea' }
];

var PRICE_SERIES = [
  { id: 'IR', label: 'All imported goods', what: 'Every imported commodity, including fuel.' },
  { id: 'IREXFUELS', label: 'Imports excluding fuel', what: 'The better read on what reaches a shop shelf, because energy swings dominate the headline number.' },
  { id: 'IQ', label: 'All exported goods', what: 'What the rest of the world pays for American goods.' }
];

async function build() {
  if (!process.env.FRED_API_KEY) {
    return { ok: false, reason: 'FRED_API_KEY is not set on this deployment, so the trade series cannot be read.' };
  }

  var partnerResults = await Promise.all(PARTNERS.map(async function (p) {
    var pair = await Promise.all([T.fredSeries('IMP' + p.code, 365), T.fredSeries('EXP' + p.code, 365)]);
    var imp = pair[0], exp = pair[1];
    if (!imp || !exp) return { name: p.name, ok: false, reason: 'series unavailable on this read' };
    // FRED reports these in MILLIONS of dollars. Convert once here so the page never has to.
    var impUsd = imp.value * 1e6, expUsd = exp.value * 1e6;
    return {
      name: p.name, ok: true,
      imports: impUsd, exports: expUsd,
      gap: expUsd - impUsd,                    // negative = America buys more than it sells
      importsChangeYear: imp.changePct,
      exportsChangeYear: exp.changePct,
      asOf: imp.date,
      // for every dollar sold to this partner, this many dollars bought back
      boughtPerDollarSold: exp.value ? +(imp.value / exp.value).toFixed(2) : null,
      url: 'https://fred.stlouisfed.org/series/IMP' + p.code
    };
  }));

  var priceResults = await Promise.all(PRICE_SERIES.map(async function (s) {
    var r = await T.fredSeries(s.id, 365);
    return r
      ? { id: s.id, label: s.label, what: s.what, value: r.value, asOf: r.date, changeYear: r.changePct, url: 'https://fred.stlouisfed.org/series/' + s.id }
      : { id: s.id, label: s.label, what: s.what, ok: false, reason: 'series unavailable on this read' };
  }));

  var good = partnerResults.filter(function (p) { return p.ok; });
  if (!good.length) return { ok: false, reason: 'FRED returned no usable partner trade series.' };
  good.sort(function (a, b) { return b.imports - a.imports; });

  var balance = await T.fredSeries('BOPGSTB', 365);

  return {
    ok: true,
    partners: good,
    unavailablePartners: partnerResults.filter(function (p) { return !p.ok; }).map(function (p) { return p.name; }),
    prices: priceResults,
    totalBalance: balance ? balance.value * 1e6 : null,
    totalBalanceAsOf: balance ? balance.date : null,
    source: 'FRED (St. Louis Fed), from Census Bureau trade data and BLS price indexes',
    sourceUrl: 'https://fred.stlouisfed.org/categories/13',
    note: 'Monthly goods trade by partner, newest month available. Trade data lags by about two months.',
    caveat: 'GOODS ONLY. The United States runs a large services surplus that is not counted here, so a bilateral goods gap overstates the real imbalance. Imports are customs basis and exports are FAS basis, which are not perfectly comparable, and this is not the complete list of trading partners.'
  };
}

module.exports = async function handler(req, res) {
  try {
    return T.send(res, await T.cached('trade:tool:partners:v1', TTL, build));
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
