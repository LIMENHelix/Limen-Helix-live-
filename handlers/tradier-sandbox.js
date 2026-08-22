'use strict';

/**
 * GET /api/tradier-sandbox
 *
 * Operator-only, read-only connectivity probe for the Tradier paper account.
 * No order or preview operation is exposed here.
 */

var adminGate = require('../lib/admin-gate');
var tradier = require('../lib/tradier-sandbox');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Limen-Pass');
  res.setHeader('Cache-Control', 'no-store');

  if ((req.method || 'GET').toUpperCase() === 'OPTIONS') return res.status(200).end();
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only', readOnly: true });
  }
  if (!adminGate.hasDomain(adminGate.reqKey(req), 'finance')) return adminGate.deny(res);

  try {
    return res.status(200).json(await tradier.probe());
  } catch (err) {
    var status = err && err.status >= 400 && err.status < 500 ? err.status : 503;
    return res.status(status).json({
      ok: false,
      broker: 'tradier',
      environment: 'sandbox',
      readOnly: true,
      error: err && err.message ? err.message : 'Tradier sandbox probe failed',
      errorCode: err && err.code ? err.code : 'TRADIER_SANDBOX_PROBE_FAILED'
    });
  }
};
