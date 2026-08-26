'use strict';
var Store = require('../lib/autofire-efference-store.js'); var Decision = require('../lib/law-automail-decision.js');
function clean(row) { if (!row || row.schemaVersion !== Decision.SCHEMA) return null; return { decisionReceiptId: row.decisionReceiptId, actionId: row.actionId,
  status: row.status, released: row.status === 'RELEASED', productDomain: 'law', ownerDomain: 'law', lane: 'automail', lawPacketId: row.lawPacketId || null,
  reason: row.reason || null, blockers: Array.isArray(row.blockers) ? row.blockers.slice(0, 12) : [], daysOut: row.daysOut, decidedAt: row.decidedAt,
  expiresAt: row.expiresAt, providerCalled: false, liveMoney: false }; }
module.exports = async function handler(req, res) { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
  try { var rows = await Store.lrange(Decision.LOG_KEY, 0, 19), decisions = rows.map(clean).filter(Boolean); res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, schemaVersion: 'law-automail-decision-status/1.0', decisions: decisions, count: decisions.length, readOnly: true, providerCalledByRead: false, liveMoney: false })); }
  catch (_) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'law-automail-decision-status-unavailable', readOnly: true, providerCalledByRead: false, liveMoney: false })); } };
