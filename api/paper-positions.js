/**
 * api/paper-positions.js
 * Vercel serverless — Alpaca paper account positions
 *
 * GET /api/paper-positions
 * Returns: { positions: [...], count, paper: true }
 *
 * PAPER TRADING ONLY — uses paper endpoint exclusively.
 *
 * Env vars required:
 *   ALPACA_API_KEY_ID — paper trading key
 *   ALPACA_API_SECRET — paper trading secret
 *
 * SAFETY: hardcoded to paper-api.alpaca.markets — never live.
 */

var ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  var key = process.env.ALPACA_API_KEY_ID || process.env.APCA_API_KEY_ID || process.env.ALPACA_KEY_ID || process.env.ALPACA_KEY;
  var secret = process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY || process.env.ALPACA_SECRET || process.env.ALPACA_SECRET_KEY;

  if (!key || !secret) {
    return res.status(503).json({
      error: 'Alpaca paper credentials not configured',
      positions: [],
      count: 0,
      stubbed: true,
      paper: true
    });
  }

  try {
    var resp = await fetch(ALPACA_PAPER_URL + '/v2/positions', {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret
      }
    });

    if (!resp.ok) {
      var errBody = await resp.text();
      return res.status(resp.status).json({
        error: 'Alpaca positions request failed',
        detail: errBody,
        positions: [],
        count: 0,
        paper: true
      });
    }

    var positions = await resp.json();

    // Slim down to essential fields
    var slim = positions.map(function(p) {
      return {
        symbol: p.symbol,
        qty: p.qty,
        side: p.side,
        marketValue: p.market_value,
        costBasis: p.cost_basis,
        unrealizedPl: p.unrealized_pl,
        unrealizedPlpc: p.unrealized_plpc,
        currentPrice: p.current_price,
        avgEntryPrice: p.avg_entry_price,
        changeToday: p.change_today
      };
    });

    return res.status(200).json({
      positions: slim,
      count: slim.length,
      paper: true
    });

  } catch (e) {
    return res.status(500).json({
      error: 'Alpaca request failed',
      detail: e.message,
      positions: [],
      count: 0,
      paper: true
    });
  }
};
