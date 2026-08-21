/**
 * api/limen-autofire-log.js — Auto-fire audit log read endpoint
 *
 * GET /api/limen-autofire-log
 *   Returns the audit log of every auto-fire decision (fired, skipped,
 *   error) recorded by limen-worker-autofire. Operator-facing audit
 *   trail so every autonomous engine fire is reviewable.
 *
 *   Query params:
 *     limit       max entries (default 30, cap 200)
 *     since_ms    only entries newer than this epoch-ms
 *
 *   Also returns today's budget state.
 */

var db = require('../lib/limen-db');
var autonomyBudget = require('../lib/autonomy-budget');

var AUTOFIRE_AUDIT_LOG = 'autofire_audit_log';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  }

  try {
    var url = new URL(req.url, 'http://localhost');
    var limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 200);
    var sinceMs = parseInt(url.searchParams.get('since_ms') || '0', 10) || 0;

    var entries = await db.get(AUTOFIRE_AUDIT_LOG);
    if (!Array.isArray(entries)) entries = [];

    var filtered = sinceMs > 0
      ? entries.filter(function (e) { return (e.at || 0) >= sinceMs; })
      : entries;

    // The worker and the operator read must report the same shared gate. Old
    // autofire_budget_* keys are retained as history but no longer authorize or
    // describe autonomous spend.
    var budget = await autonomyBudget.status();

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: Date.now(),
      total: entries.length,
      returned: Math.min(filtered.length, limit),
      budget: budget,
      budgetAccounting: 'conservative-estimate-per-provider-attempt',
      cycles: filtered.slice(0, limit)
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
