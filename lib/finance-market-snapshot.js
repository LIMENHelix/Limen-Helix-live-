'use strict';

/** Convert the read-only /api/asset-quote response into ledger market data. */

function list(value) { return Array.isArray(value) ? value : []; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

function assemble(payload, symbols) {
  var updated = payload && payload.updated;
  var asOf = updated == null ? null : new Date(Number(updated)).toISOString();
  var source = { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' };
  var requested = list(symbols).map(function (s) { return String(s || '').toUpperCase(); });
  var quotes = [];
  var missing = [];
  requested.forEach(function (symbol) {
    var row = payload && payload.quotes && payload.quotes[symbol];
    if (!row || row.live !== true || !finite(row.price)) {
      missing.push(symbol);
      return;
    }
    quotes.push({
      symbol: symbol,
      price: row.price,
      prevClose: finite(row.prevClose) ? row.prevClose : null,
      observedAt: asOf,
      sourceIdentity: source
    });
  });
  return {
    asOf: asOf,
    sources: quotes.length ? [source.value] : [],
    quotes: quotes,
    missing: missing,
    provider: source
  };
}

module.exports = { assemble: assemble };
