/**
 * api/paper-orders.js
 * Vercel serverless — Alpaca paper account orders
 *
 * GET /api/paper-orders?status=open  (default: open)
 * GET /api/paper-orders?status=closed&limit=20
 * GET /api/paper-orders?status=all&limit=50
 * Returns: { orders: [...], count, paper: true }
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
      orders: [],
      count: 0,
      stubbed: true,
      paper: true
    });
  }

  var status = req.query.status || 'open';
  var limit = Math.min(parseInt(req.query.limit) || 50, 100);

  // Validate status
  if (status !== 'open' && status !== 'closed' && status !== 'all') {
    return res.status(400).json({ error: 'status must be open, closed, or all' });
  }

  try {
    var url = ALPACA_PAPER_URL + '/v2/orders?status=' + status + '&limit=' + limit + '&direction=desc';

    var resp = await fetch(url, {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret
      }
    });

    if (!resp.ok) {
      var errBody = await resp.text();
      return res.status(resp.status).json({
        error: 'Alpaca orders request failed',
        detail: errBody,
        orders: [],
        count: 0,
        paper: true
      });
    }

    var orders = await resp.json();

    // Slim down to essential fields
    var slim = orders.map(function(o) {
      return {
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        qty: o.qty,
        filledQty: o.filled_qty,
        type: o.type,
        status: o.status,
        submittedAt: o.submitted_at,
        filledAt: o.filled_at,
        filledAvgPrice: o.filled_avg_price
      };
    });

    return res.status(200).json({
      orders: slim,
      count: slim.length,
      status: status,
      paper: true
    });

  } catch (e) {
    return res.status(500).json({
      error: 'Alpaca request failed',
      detail: e.message,
      orders: [],
      count: 0,
      paper: true
    });
  }
};
