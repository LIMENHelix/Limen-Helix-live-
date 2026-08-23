'use strict';

/**
 * POST /api/finance-b14 { action: "preview", selection, tradeIntent }
 *
 * Finance domain bridge. It is admin-only, sandbox-only, and preview-only.
 * Order submission remains on /api/tradier-b14 with its separate exact
 * confirmation boundary.
 */

var adminGate = require('../lib/admin-gate');
var store = require('../lib/autofire-efference-store');
var broker = require('../lib/tradier-sandbox');
var bridge = require('../lib/finance-b14-bridge');

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limen-Pass');
  res.setHeader('Cache-Control', 'no-store');
  var method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return res.status(200).end();
  var pass = adminGate.reqKey(req);
  if (!adminGate.hasDomain(pass, 'finance')) return adminGate.deny(res);
  try {
    if (method === 'GET') return res.status(200).json({ ok: true, bridge: 'finance-b14', state: bridge.state() });
    if (method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });
    var body = bodyOf(req);
    if (body.action !== 'preview') return res.status(400).json({ ok: false, error: 'action must be preview' });
    return res.status(200).json(await bridge.preview(store, broker, body.selection, body.tradeIntent));
  } catch (err) {
    return res.status(400).json({ ok: false, error: err && err.message || 'Finance B14 bridge refused', errorCode: err && err.code || 'FINANCE_B14_REFUSED' });
  }
};
