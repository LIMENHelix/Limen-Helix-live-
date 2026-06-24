/**
 * api/governance-markets.js — cached batch quotes for the curated governance ticker set.
 * Mirror of energy-markets.js. Educational data only — NOT investment advice.
 *
 * GET /api/governance-markets → { ok, updated, cached, quotes: { SYM: {price, changePct} } }
 * Source: Yahoo Finance v8 (public, no key). Cached in Redis (governance:markets:v1) 15 min, stale-on-failure.
 */
var db = require('../lib/limen-db');

var CACHE_KEY = 'governance:markets:v1';
var TTL_MS = 15 * 60 * 1000;

var TICKERS = [
  'TYL','MMS','ACN','GDIT','BAH','LDOS',  // govtech / public-sector services & administration
  'CACI','SAIC','KBR','ICFI','NSP'               // govt consulting / IT modernization
];

async function fetchQuote(symbol) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1d&interval=5m';
  try {
    var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return null;
    var data = await r.json();
    var result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) return null;
    var meta = result.meta || {};
    var price = meta.regularMarketPrice;
    var prev = meta.chartPreviousClose != null ? meta.chartPreviousClose : meta.previousClose;
    if (price == null || prev == null) return null;
    var pct = prev ? ((price - prev) / prev) * 100 : 0;
    return { price: Math.round(price * 100) / 100, changePct: Math.round(pct * 100) / 100 };
  } catch (e) { return null; }
}

async function refresh() {
  var quotes = {};
  var CONC = 8;
  for (var i = 0; i < TICKERS.length; i += CONC) {
    var chunk = TICKERS.slice(i, i + CONC);
    var results = await Promise.all(chunk.map(function (s) { return fetchQuote(s); }));
    for (var j = 0; j < chunk.length; j++) { if (results[j]) quotes[chunk[j]] = results[j]; }
  }
  return quotes;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  var now = Date.now();
  try {
    var cached = await db.get(CACHE_KEY);
    if (cached && cached.updatedMs && (now - cached.updatedMs) < TTL_MS && cached.quotes) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, cached: true, updated: cached.updated, quotes: cached.quotes }));
    }
  } catch (e) {}
  var quotes = await refresh();
  if (Object.keys(quotes).length < 5) {
    try {
      var stale = await db.get(CACHE_KEY);
      if (stale && stale.quotes) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, cached: true, stale: true, updated: stale.updated, quotes: stale.quotes }));
      }
    } catch (e) {}
  }
  var payload = { updated: new Date().toISOString(), updatedMs: now, quotes: quotes };
  try { await db.set(CACHE_KEY, payload); } catch (e) {}
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, cached: false, updated: payload.updated, quotes: quotes }));
};
