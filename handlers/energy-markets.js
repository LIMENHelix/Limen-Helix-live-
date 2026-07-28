/**
 * api/energy-markets.js — cached batch quotes for the curated energy ticker set.
 *
 * GET /api/energy-markets → { ok, updated, cached, quotes: { SYM: {price, changePct} } }
 *
 * Source: Yahoo Finance v8 chart API (public, no key) — same proven path as
 * handlers/asset-quote.js. Quotes are DELAYED (~15 min), so we cache the whole
 * batch in Redis (energy:markets:v1) for 15 min: each page load is ONE Redis GET
 * regardless of traffic; Yahoo is hit only on a cache miss (~4x/hour). On a failed
 * refresh we serve the last-good (stale) cache. Cost-safe at traffic.
 *
 * Educational data only — NOT investment advice. The page frames tickers as themes
 * to research, with risks, never "buy".
 */
var db = require('../lib/limen-db');

var CACHE_KEY = 'energy:markets:v1';
var TTL_MS = 15 * 60 * 1000;

// Canonical union of every ticker used by the themed baskets on energy-markets.html
// Basket lives in lib/domain-baskets.js: it now drives BOTH these display quotes and a real
// estimator channel (lib/domain-market-feed.js), and those two must never diverge.
var TICKERS = require('../lib/domain-baskets').get('energy');

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

  // fresh cache?
  try {
    var cached = await db.get(CACHE_KEY);
    if (cached && cached.updatedMs && (now - cached.updatedMs) < TTL_MS && cached.quotes) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, cached: true, updated: cached.updated, quotes: cached.quotes }));
    }
  } catch (e) {}

  // refresh from Yahoo
  var quotes = await refresh();

  // too few? serve last-good stale rather than a broken page
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
