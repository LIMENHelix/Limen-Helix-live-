/**
 * market-data.js — real market + fundamentals data for the investment lane.
 *
 * The engine-output investment artifacts were emitting unfilled [PRICE],
 * [TARGET], [COMPOSITE]… placeholders because no live data source was wired.
 * This module is that source. Two free, authoritative, no-key feeds:
 *
 *   • Yahoo Finance v8 chart  → live price, prev close, 52-week range, volume.
 *     (public endpoint, same one api/asset-quote.js already uses)
 *   • SEC EDGAR companyfacts  → shares outstanding, revenue, debt, cash.
 *     (by CIK — every portal carries a CIK; the system already pulls EDGAR)
 *
 * Returns a normalized snapshot with EVERYTHING the valuation model needs, or
 * a partial object flagging which slots are missing (so the generator can
 * degrade honestly instead of fabricating). NO synthetic numbers — every
 * field traces to a fetch or is null.
 *
 *   const md = await getMarketData(portal);
 *   // → { ok, price, shares, marketCap, netDebt, ev, revenue, evRevenue,
 *   //     week52High, week52Low, advUsd, asOf, sources, missing: [...] }
 */
const EDGAR_UA = process.env.EDGAR_USER_AGENT || 'LIMEN Helix research chrishubbel72@gmail.com';

function _round(v, d) { const p = Math.pow(10, d == null ? 2 : d); return Math.round(v * p) / p; }
function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

// ── Yahoo v8 chart: price, prevClose, 52w range, volume ──────────────
async function fetchQuote(ticker) {
  if (!ticker) return null;
  const sym = String(ticker).toUpperCase();
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1mo&interval=1d';
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(to);
    if (!r.ok) return null;
    const j = await r.json();
    const res = j && j.chart && j.chart.result && j.chart.result[0];
    const m = res && res.meta;
    if (!m || m.regularMarketPrice == null) return null;
    return {
      price: _num(m.regularMarketPrice),
      prevClose: _num(m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose),
      week52High: _num(m.fiftyTwoWeekHigh),
      week52Low: _num(m.fiftyTwoWeekLow),
      volume: _num(m.regularMarketVolume),
      currency: m.currency || 'USD',
      name: m.longName || m.shortName || null
    };
  } catch (e) { clearTimeout(to); return null; }
}

// ── EDGAR companyfacts: shares, revenue, debt, cash ──────────────────
// Picks the most-recent value for each concept. Revenue prefers the latest
// annual (10-K / FY) figure; falls back to TTM-ish latest if no annual.
function _latest(units) {
  if (!units || !Array.isArray(units) || !units.length) return null;
  // sort by end date, take last
  const sorted = units.slice().filter(x => x && x.end).sort((a, b) => (a.end < b.end ? -1 : 1));
  return sorted.length ? sorted[sorted.length - 1] : null;
}
function _latestAnnual(units) {
  if (!units || !Array.isArray(units)) return null;
  const annual = units.filter(x => x && (x.form === '10-K' || x.fp === 'FY') && x.end).sort((a, b) => (a.end < b.end ? -1 : 1));
  return annual.length ? annual[annual.length - 1] : _latest(units);
}
function _conceptUSD(g, tags) {
  for (const t of tags) { const c = g[t]; if (c && c.units && c.units.USD) return c.units.USD; }
  return null;
}

async function fetchEdgarFundamentals(cik) {
  if (!cik) return null;
  const padded = String(cik).replace(/\D/g, '').padStart(10, '0');
  if (padded === '0000000000') return null;
  const url = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + padded + '.json';
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': EDGAR_UA, 'Accept-Encoding': 'gzip' } });
    clearTimeout(to);
    if (!r.ok) return null;
    const j = await r.json();
    const g = (j.facts && j.facts['us-gaap']) || {};
    const dei = (j.facts && j.facts['dei']) || {};

    const shEntry = _latest(dei.EntityCommonStockSharesOutstanding && dei.EntityCommonStockSharesOutstanding.units && dei.EntityCommonStockSharesOutstanding.units.shares);
    const revUnits = _conceptUSD(g, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet']);
    const revEntry = _latestAnnual(revUnits);
    const debtUnits = _conceptUSD(g, ['LongTermDebt', 'LongTermDebtNoncurrent', 'DebtLongtermAndShorttermCombinedAmount']);
    const debtEntry = _latest(debtUnits);
    const cashUnits = _conceptUSD(g, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']);
    const cashEntry = _latest(cashUnits);

    return {
      shares: shEntry ? _num(shEntry.val) : null,
      sharesAsOf: shEntry ? shEntry.end : null,
      revenue: revEntry ? _num(revEntry.val) : null,
      revenueFY: revEntry ? (revEntry.fy || revEntry.end) : null,
      debt: debtEntry ? _num(debtEntry.val) : null,
      cash: cashEntry ? _num(cashEntry.val) : null,
      asOf: (debtEntry && debtEntry.end) || (revEntry && revEntry.end) || null,
      entityName: j.entityName || null
    };
  } catch (e) { clearTimeout(to); return null; }
}

// ── combine into one normalized snapshot ─────────────────────────────
async function getMarketData(portal) {
  const ticker = portal && (portal.ticker || (Array.isArray(portal.marketDataTickers) && portal.marketDataTickers[0]));
  const cik = portal && portal.cik;
  const [q, f] = await Promise.all([fetchQuote(ticker), fetchEdgarFundamentals(cik)]);

  const missing = [];
  const price = q && q.price;
  if (price == null) missing.push('price');

  // shares: EDGAR first; if absent we cannot bridge EV↔price
  const shares = f && f.shares;
  if (shares == null) missing.push('shares');

  // net debt from EDGAR; fall back to the portal's stored financialState
  let netDebt = null, cash = f && f.cash, debt = f && f.debt;
  const fs = portal && portal.financialHealth && portal.financialHealth.financialState;
  if (debt == null && fs && typeof fs.debtLatest === 'number') debt = fs.debtLatest;
  if (cash == null && fs && typeof fs.cashLatest === 'number') cash = fs.cashLatest;
  if (debt != null || cash != null) netDebt = (debt || 0) - (cash || 0);
  else missing.push('netDebt');

  const revenue = f && f.revenue;
  if (revenue == null) missing.push('revenue');

  const marketCap = (price != null && shares != null) ? price * shares : null;
  const ev = (marketCap != null && netDebt != null) ? marketCap + netDebt : null;
  const evRevenue = (ev != null && revenue) ? ev / revenue : null;
  const advUsd = (q && q.volume != null && price != null) ? q.volume * price : null;

  return {
    ok: missing.length === 0,
    ticker: ticker || null,
    price: price != null ? _round(price, 4) : null,
    prevClose: q ? q.prevClose : null,
    shares,
    sharesAsOf: f ? f.sharesAsOf : null,
    marketCap: marketCap != null ? Math.round(marketCap) : null,
    debt, cash,
    netDebt: netDebt != null ? Math.round(netDebt) : null,
    revenue: revenue != null ? Math.round(revenue) : null,
    revenueFY: f ? f.revenueFY : null,
    ev: ev != null ? Math.round(ev) : null,
    evRevenue: evRevenue != null ? _round(evRevenue, 2) : null,
    week52High: q ? q.week52High : null,
    week52Low: q ? q.week52Low : null,
    advUsd: advUsd != null ? Math.round(advUsd) : null,
    asOf: (f && f.asOf) || null,
    sources: { quote: q ? 'yahoo_v8' : null, fundamentals: f ? 'edgar_companyfacts' : null },
    missing
  };
}

module.exports = { getMarketData, fetchQuote, fetchEdgarFundamentals };
