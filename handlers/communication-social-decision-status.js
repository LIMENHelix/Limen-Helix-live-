'use strict';

/** Public, sanitized, read-only view of Communication's recent B10 decisions. */

var Store = require('../lib/autofire-efference-store.js');
var Decision = require('../lib/communication-social-decision.js');

function clean(row) {
  if (!row || row.schemaVersion !== Decision.SCHEMA ||
      (row.status !== 'RELEASED' && row.status !== 'NO_ACTION')) return null;
  return {
    decisionReceiptId: row.decisionReceiptId,
    status: row.status,
    released: row.status === 'RELEASED',
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    subjectDomain: row.subjectDomain || null,
    communicationPacketId: row.communicationPacketId || null,
    subjectPacketId: row.subjectPacketId || null,
    reason: row.reason || null,
    blockers: Array.isArray(row.blockers) ? row.blockers.slice(0, 12) : [],
    decidedAt: Number.isFinite(Number(row.decidedAt)) ? Number(row.decidedAt) : null,
    expiresAt: Number.isFinite(Number(row.expiresAt)) ? Number(row.expiresAt) : null,
    providerCalled: row.providerCalled === true,
    liveMoney: false
  };
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    try {
      store.assertDurable();
      var log = await store.lrange(Decision.LOG_KEY, 0, 19);
      var decisions = log.map(clean).filter(Boolean);
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true, schemaVersion: 'communication-social-decision-status/1.0',
        decisions: decisions, count: decisions.length,
        readOnly: true, providerCalledByRead: false, liveMoney: false,
        measuredAt: new Date().toISOString()
      }));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'communication-social-decision-status-unavailable',
        readOnly: true, providerCalledByRead: false, liveMoney: false }));
    }
  };
}

var handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.clean = clean;
