/**
 * api/market-snapshot.js
 * Vercel serverless endpoint — compact market snapshot
 *
 * Returns normalized JSON:
 *   { spxChange, vix, oilChange, yield10yChange, updated, drivers, simulated }
 *
 * Uses Yahoo Finance v8 chart API (public, no key required).
 * Falls back to simulated data on any failure.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=8, stale-while-revalidate=4');

  try {
    var results = await Promise.allSettled([
      fetchChart('%5EGSPC'),  // S&P 500
      fetchChart('%5EVIX'),   // VIX
      fetchChart('CL%3DF'),  // Crude Oil Futures
      fetchChart('%5ETNX')   // 10Y Treasury Yield
    ]);

    var spx = results[0].status === 'fulfilled' ? results[0].value : null;
    var vixData = results[1].status === 'fulfilled' ? results[1].value : null;
    var oil = results[2].status === 'fulfilled' ? results[2].value : null;
    var yld = results[3].status === 'fulfilled' ? results[3].value : null;

    var anyLive = spx || vixData || oil || yld;

    if (!anyLive) {
      return res.status(200).json(simulatedSnapshot());
    }

    var drivers = [];

    // S&P 500
    var spxChange = null;
    if (spx) {
      spxChange = round(spx.changePct);
      if (spxChange < -1) drivers.push('market decline ' + spxChange.toFixed(1) + '%');
      else if (spxChange > 1) drivers.push('market rally +' + spxChange.toFixed(1) + '%');
    }

    // VIX
    var vix = null;
    if (vixData) {
      vix = round(vixData.price);
      if (vix > 22) drivers.push('volatility elevated VIX ' + vix.toFixed(1));
      else if (vix < 14) drivers.push('volatility suppressed VIX ' + vix.toFixed(1));
    }

    // Oil
    var oilChange = null;
    if (oil) {
      oilChange = round(oil.changePct);
      if (Math.abs(oilChange) > 1) {
        var dir = oilChange > 0 ? 'spike' : 'drop';
        drivers.push('oil ' + dir + ' ' + (oilChange > 0 ? '+' : '') + oilChange.toFixed(1) + '%');
      }
    }

    // 10Y Yield
    var yield10yChange = null;
    if (yld) {
      yield10yChange = round3(yld.price - yld.prevClose);
      if (Math.abs(yield10yChange) > 0.03) {
        var yDir = yield10yChange > 0 ? 'rising' : 'falling';
        drivers.push('yield ' + yDir + ' ' + (yield10yChange > 0 ? '+' : '') + yield10yChange.toFixed(3));
      }
    }

    if (drivers.length === 0) drivers.push('signals nominal');

    return res.status(200).json({
      spxChange: spxChange,
      vix: vix,
      oilChange: oilChange,
      yield10yChange: yield10yChange,
      updated: Date.now(),
      drivers: drivers,
      simulated: false
    });

  } catch (e) {
    console.error('[market-snapshot] top-level error:', e.message);
    return res.status(200).json(simulatedSnapshot());
  }
};

// ─── Yahoo Finance chart fetcher ────────────────────────────────────────

async function fetchChart(symbol) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?range=1d&interval=5m';

  var controller = new AbortController();
  var timeout = setTimeout(function () { controller.abort(); }, 4000);

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

// ─── Simulated fallback ─────────────────────────────────────────────────

function simulatedSnapshot() {
  var t = Date.now() * 0.0001;
  return {
    spxChange: round(Math.sin(t) * 1.5 + Math.sin(t * 2.7) * 0.8),
    vix: round(18 + Math.sin(t * 0.8 + 1) * 8 + Math.random() * 2),
    oilChange: round(Math.sin(t * 1.3 + 2) * 3 + Math.random() * 0.5),
    yield10yChange: round3(Math.sin(t * 0.6 + 3) * 0.15 + Math.random() * 0.05),
    updated: Date.now(),
    drivers: ['simulated fallback'],
    simulated: true
  };
}

function round(v) { return Math.round(v * 100) / 100; }
function round3(v) { return Math.round(v * 1000) / 1000; }
