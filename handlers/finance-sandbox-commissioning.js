'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Broker = require('../lib/tradier-sandbox.js');
var Commissioning = require('../lib/finance-sandbox-commissioning.js');
var COMMISSIONING_STATUSES = {
  CLAIMED: true,
  PREVIEWED: true,
  COMMAND_RECEIPTED: true,
  CANCEL_RECONCILIATION_PENDING: true,
  COMMISSIONING_EFFECT_OR_TERMINAL_MISMATCH: true,
  VERIFIED_ZERO_EFFECT_ROLLBACK: true
};

function tokenOf(req) {
  var headers = req.headers || {};
  return headers['x-brain-token'] || String(headers.authorization || '').replace(/^Bearer\s+/i, '');
}
function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) { return {}; } }
  return req.body;
}
function boundedTime(value) {
  var at = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}
function commissioningStatus(record, now) {
  var measuredAt = new Date(Number.isFinite(Number(now)) ? Number(now) : Date.now()).toISOString();
  if (!record) return {
    ok: true,
    schemaVersion: 'finance-sandbox-commissioning-status/1.0',
    status: 'NOT_COMMISSIONED',
    verified: false,
    effectExecuted: null,
    paperOnly: true,
    liveMoney: false,
    measuredAt: measuredAt
  };
  if (record.schemaVersion !== Commissioning.SCHEMA || !COMMISSIONING_STATUSES[record.status] ||
      record.paperOnly !== true || record.liveMoney !== false) {
    throw new Error('commissioning-state-invalid');
  }
  var verified = record.status === 'VERIFIED_ZERO_EFFECT_ROLLBACK' &&
    record.effectExecuted === false && Number(record.executedQuantity) === 0;
  return {
    ok: true,
    schemaVersion: 'finance-sandbox-commissioning-status/1.0',
    status: record.status,
    verified: verified,
    effectExecuted: typeof record.effectExecuted === 'boolean' ? record.effectExecuted : null,
    claimedAt: boundedTime(record.claimedAt),
    updatedAt: boundedTime(record.updatedAt),
    verifiedAt: verified ? boundedTime(record.verifiedAt) : null,
    paperOnly: true,
    liveMoney: false,
    measuredAt: measuredAt
  };
}
function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var broker = deps.broker || Broker;
  var commissioning = deps.commissioning || Commissioning;
  var env = deps.env || process.env;
  return async function handler(req, res) {
    res.setHeader('cache-control', 'no-store');
    var method = String(req.method || 'GET').toUpperCase();
    if (method === 'GET') {
      try {
        store.assertDurable();
        return res.status(200).json(commissioningStatus(await store.get(commissioning.KEY), Date.now()));
      } catch (error) {
        return res.status(503).json({
          ok: false,
          error: 'finance-sandbox-commissioning-status-unavailable',
          paperOnly: true,
          liveMoney: false
        });
      }
    }
    if (method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });
    if (!env.BRAIN_SHADOW_TOKEN) return res.status(503).json({ ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
    if (tokenOf(req) !== env.BRAIN_SHADOW_TOKEN) return res.status(401).json({ ok: false, error: 'unauthorized' });
    if (bodyOf(req).action !== 'verify-zero-effect-rollback') return res.status(400).json({ ok: false, error: 'action must be verify-zero-effect-rollback' });
    try {
      var result = await commissioning.execute({ store: store, broker: broker, env: env });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(503).json({
        ok: false,
        status: 'COMMISSIONING_UNRESOLVED',
        error: error && error.message || String(error),
        errorCode: error && error.code || 'FINANCE_SANDBOX_COMMISSIONING_FAILED',
        paperOnly: true,
        liveMoney: false
      });
    }
  };
}
var handler = createHandler();
handler.createHandler = createHandler;
handler.commissioningStatus = commissioningStatus;
module.exports = handler;
