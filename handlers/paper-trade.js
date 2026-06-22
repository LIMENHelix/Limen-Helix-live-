/**
 * api/paper-trade.js
 * Vercel serverless — Alpaca paper trade execution
 *
 * PAPER TRADING ONLY — uses paper endpoint exclusively.
 * Accepts POST with trade intent, submits to Alpaca paper API.
 *
 * Env vars required:
 *   ALPACA_API_KEY_ID — paper trading key
 *   ALPACA_API_SECRET — paper trading secret
 *
 * SAFETY: hardcoded to paper-api.alpaca.markets — never live.
 */

var ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';

const adminGate = require('../lib/admin-gate');
module.exports = async function handler(req, res) {
  if ((req.method || 'GET').toUpperCase() !== 'OPTIONS' && !adminGate.hasDomain(adminGate.reqKey(req), 'finance')) return adminGate.deny(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Check multiple possible env var names
  var key = process.env.ALPACA_API_KEY_ID || process.env.APCA_API_KEY_ID || process.env.ALPACA_KEY_ID || process.env.ALPACA_KEY;
  var secret = process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY || process.env.ALPACA_SECRET || process.env.ALPACA_SECRET_KEY;

  if (!key || !secret) {
    // List which env vars we checked (not values)
    var checked = ['ALPACA_API_KEY_ID','APCA_API_KEY_ID','ALPACA_KEY_ID','ALPACA_KEY','ALPACA_API_SECRET','APCA_API_SECRET_KEY','ALPACA_SECRET','ALPACA_SECRET_KEY'];
    var found = checked.filter(function(k) { return !!process.env[k]; });
    return res.status(503).json({
      error: 'Alpaca paper credentials not configured',
      hint: 'Set ALPACA_API_KEY_ID and ALPACA_API_SECRET in Vercel env vars',
      checked: checked,
      found: found,
      stubbed: true
    });
  }

  var body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!body || !body.symbol || !body.side || !body.qty) {
    return res.status(400).json({ error: 'Missing required fields: symbol, side, qty' });
  }

  // Validate side
  if (body.side !== 'buy' && body.side !== 'sell') {
    return res.status(400).json({ error: 'side must be "buy" or "sell"' });
  }

  // Build Alpaca order
  var order = {
    symbol: body.symbol.toUpperCase().replace(/[^A-Z]/g, ''),
    side: body.side,
    qty: String(Math.max(1, Math.floor(Number(body.qty) || 1))),
    type: 'market',
    time_in_force: 'day'
  };

  try {
    var resp = await fetch(ALPACA_PAPER_URL + '/v2/orders', {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });

    var result = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: 'Alpaca rejected order',
        detail: result.message || result.code || JSON.stringify(result),
        order: order,
        paper: true
      });
    }

    return res.status(200).json({
      success: true,
      orderId: result.id,
      symbol: result.symbol,
      side: result.side,
      qty: result.qty,
      status: result.status,
      submittedAt: result.submitted_at,
      paper: true,
      meta: {
        oppId: body.oppId || null,
        oppTitle: body.oppTitle || null,
        verdict: body.verdict || null,
        score: body.score || null
      }
    });

  } catch (e) {
    return res.status(500).json({
      error: 'Alpaca request failed',
      detail: e.message,
      paper: true
    });
  }
};
