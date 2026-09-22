'use strict';

/**
 * handlers/env-capability-registry.js — GET /api/env-capability-registry
 *
 * Master-gated, read-only answer to "what is blocking paid-subscriber sends":
 * per-domain switch state, cap values, named missing env vars, transport
 * readiness, and (via a read-only store probe) the presence/lifecycle of the
 * projected capability receipts. No secret values are ever returned — the
 * registry reduces credentials to presence booleans (see the lib module).
 */

var Gate = require('../lib/admin-gate');
var Registry = require('../lib/env-capability-registry.js');
var Store = require('../lib/autofire-efference-store.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body, null, 2));
}

module.exports = async function handler(req, res) {
  if (String(req.method || 'GET').toUpperCase() !== 'GET') {
    return send(res, 405, { ok: false, error: 'GET only' });
  }
  if (!Gate.isMaster(Gate.reqKey(req))) return Gate.deny(res);

  var report = Registry.report(process.env);

  // Capability receipts live in the durable store (6h TTL, refreshed by the
  // subscriber-email-capability cron). Probe them read-only; if the store is
  // unreachable the env report still stands and the probe says so.
  var url = String(req.url || '');
  if (url.indexOf('probe=0') === -1) {
    try {
      report.capabilities = await Registry.probeCapabilities(Store);
    } catch (error) {
      report.capabilities = {
        status: 'unknown',
        reason: 'capability-store-unreadable',
        detail: String(error && error.message || error)
      };
    }
  }

  return send(res, 200, report);
};
