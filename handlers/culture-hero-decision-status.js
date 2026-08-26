'use strict';

/** Public sanitized ledger of Culture B10 hero decisions. */
var Store = require('../lib/autofire-efference-store.js');
var Decision = require('../lib/culture-hero-decision.js');
function clean(row) {
  if (!row || row.schemaVersion !== Decision.SCHEMA) return null;
  return { decisionReceiptId: row.decisionReceiptId, status: row.status, released: row.status === 'RELEASED',
    productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image', assetDomain: row.assetDomain || null,
    culturePacketId: row.culturePacketId || null, reason: row.reason || null,
    blockers: Array.isArray(row.blockers) ? row.blockers.slice(0, 12) : [], decidedAt: row.decidedAt || null,
    expiresAt: row.expiresAt || null, providerCalled: false, spentUsd: 0, liveMoney: false };
}
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    try {
      var rows = await store.lrange(Decision.LOG_KEY, 0, 19), decisions = rows.map(clean).filter(Boolean);
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, schemaVersion: 'culture-hero-decision-status/1.0',
        decisions: decisions, count: decisions.length, readOnly: true, providerCalledByRead: false, spentUsd: 0, liveMoney: false, measuredAt: new Date().toISOString() }));
    } catch (_) {
      res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'culture-hero-decision-status-unavailable', readOnly: true, providerCalledByRead: false, liveMoney: false }));
    }
  };
}
var handler = createHandler(); module.exports = handler; module.exports.createHandler = createHandler; module.exports.clean = clean;
