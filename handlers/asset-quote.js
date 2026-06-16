/**
 * api/asset-quote.js
 * Vercel serverless — per-symbol market quote
 *
 * GET /api/asset-quote?symbols=XLE,IYT,NEE
 * Returns: { quotes: { XLE: { price, change, changePct, trend }, ... }, updated }
 *
 * Uses Yahoo Finance v8 chart API (public, no key required).
 * Falls back cleanly per-symbol.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=8');

  var symbolsParam = req.query.symbols || '';
  var symbols = symbolsParam.split(',').map(function(s) { return s.trim().toUpperCase(); }).filter(function(s) { return s.length > 0 && s.length < 10; });

  if (symbols.length === 0) {
    return res.status(400).json({ error: 'No symbols provided. Use ?symbols=XLE,IYT' });
  }

  // Cap at 10 symbols per request
  symbols = symbols.slice(0, 10);

  var quotes = {};
  var fetched = 0;
  var failed = 0;

  // Sequential with small delay to avoid Yahoo rate limits
  for (var i = 0; i < symbols.length; i++) {
    var sym = symbols[i];
    try {
      var data = await fetchQuote(sym);
      if (data) {
        var trend = 'FLAT';
        if (data.changePct > 0.5) trend = 'UP';
        else if (data.changePct < -0.5) trend = 'DOWN';

        var momentum = 'MIXED';
        if (data.changePct > 1.0) momentum = 'POSITIVE';
        else if (data.changePct < -1.0) momentum = 'NEGATIVE';

        var volatility = 'LOW';
        if (Math.abs(data.changePct) > 3.0) volatility = 'HIGH';
        else if (Math.abs(data.changePct) > 1.5) volatility = 'MEDIUM';

        quotes[sym] = {
          price: round(data.price),
          prevClose: round(data.prevClose),
          change: round(data.price - data.prevClose),
          changePct: round(data.changePct),
          trend: trend,
          momentum: momentum,
          volatility: volatility,
          live: true
        };
        fetched++;
      } else {
        quotes[sym] = { live: false, reason: 'no data' };
        failed++;
      }
    } catch (e) {
      quotes[sym] = { live: false, reason: e.message };
      failed++;
    }
    // Small delay between fetches
    if (i < symbols.length - 1) await sleep(200);
  }

  return res.status(200).json({
    quotes: quotes,
    fetched: fetched,
    failed: failed,
    updated: Date.now()
  });
};

async function fetchQuote(symbol) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1d&interval=5m';

  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 4000);

  try {
    var resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    var data = await resp.json();
    var result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) return null;

    var meta = result.meta || {};
    var price = meta.regularMarketPrice;
    var prevClose = meta.chartPreviousClose || meta.previousClose;
    if (price == null || prevClose == null) return null;

    return {
      price: price,
      prevClose: prevClose,
      changePct: ((price - prevClose) / prevClose) * 100
    };
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function round(v) { return Math.round(v * 100) / 100; }
