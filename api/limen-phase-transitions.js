/**
 * LIMEN Helix — Phase Transitions Read Endpoint
 *
 * GET /api/limen-phase-transitions
 *   Returns the append-only log of CIK phase transitions written by
 *   the snapshot worker's company-phase-scorer when a rescored CIK's
 *   dominant phase differs from its prior cached value.
 *
 *   Each entry: { at, cik, ticker, domain, from, to, trajectory, entity_name }
 *
 *   Query params:
 *     limit       max entries to return (default 50, cap 500)
 *     domain      filter to one domain
 *     to_phase    filter to transitions ENDING in this phase (e.g. p7 to surface
 *                 terminal-bound CIKs); accepts comma-separated list
 *     since_ms    only entries newer than this epoch-ms
 *
 *   No auth (read-only audit surface for operators + ops dashboards).
 */

var db = require('../lib/limen-db');

var TRANSITION_LOG_KEY = 'phase_transitions';

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
    var limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 500);
    var domain = url.searchParams.get('domain');
    var toPhase = url.searchParams.get('to_phase');
    var sinceMs = parseInt(url.searchParams.get('since_ms') || '0', 10) || 0;

    var entries = await db.get(TRANSITION_LOG_KEY);
    if (!Array.isArray(entries)) entries = [];

    var filtered = entries;
    if (sinceMs > 0) filtered = filtered.filter(function (e) { return (e.at || 0) >= sinceMs; });
    if (domain) filtered = filtered.filter(function (e) { return e.domain === domain; });
    if (toPhase) {
      var allowed = toPhase.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      filtered = filtered.filter(function (e) { return e.to && allowed.indexOf(String(e.to).toLowerCase()) !== -1; });
    }
    var sliced = filtered.slice(0, limit);

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'public, max-age=30');
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: Date.now(),
      total: entries.length,
      returned: sliced.length,
      filters: { limit: limit, domain: domain, to_phase: toPhase, since_ms: sinceMs },
      transitions: sliced
    }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String(err && err.message || err) }));
  }
};
