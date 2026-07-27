/**
 * api/limen-worker-stress-refresh.js — Spider-web stress refresh (PRODUCER)
 *
 * Cron (every 30 min). Recomputes the stress propagation over the live portal corpus
 * + Command Board, slims it to a per-CIK map, and writes it to Redis
 * (limen:stress_slim) with a freshness receipt (limen:stress_meta).
 *
 * This is the FRESH source the salience-routing layer reads:
 *   limen-worker-autoqueue -> limen-policy.recommendLane(transition, networkStress)
 * folds network-induced stress into lane salience, so a company pushed toward
 * distress by its stressed neighbours surfaces faster in the fire queue. That
 * closes the propagator -> executor loop for continuous (browserless) autonomy
 * (the browser Master Brain only runs when helix-brain-grid.html is open).
 *
 * Vercel's runtime FS is read-only, so the durable on-disk snapshot
 * (assets/data/stress-network-state.json) stays the CLI's job
 * (scripts/build-stress-network.mjs). This worker writes Redis (hot) + the
 * in-memory fallback only — never the repo file.
 *
 * Slimmed payload per CIK: { slug, inducedStress, totalStress,
 *   amplificationRank, isHub, networkPushed }. The full inducedSources detail
 *   is intentionally dropped so the value stays well under Upstash's per-value
 *   size limit (~tens of KB vs the ~4.5 MB full snapshot).
 *
 * GET /api/limen-worker-stress-refresh
 *   -> { ok, nodes, withCik, slugMissingCik, bytes, computeMs, backend }
 */

var db = require('../lib/limen-db');
var fs = require('fs');
var path = require('path');
var propagator = require('../lib/limen-stress-propagator.js');
var { loadPortal, listSlugs } = require('../lib/portal-loader');

var SLIM_KEY = 'stress_slim';
var META_KEY = 'stress_meta';
// 45 min TTL > the 30-min cron interval, so one skipped/failed run never
// leaves the hot key expired before the next run repopulates it.
var TTL = 2700;

var PORTAL_DIRS = [
  path.join(__dirname, '..', 'assets', 'data', 'companies'),
  '/var/task/assets/data/companies',
  path.join(process.cwd(), 'assets', 'data', 'companies')
];
var CB_PATHS = [
  path.join(__dirname, '..', 'assets', 'data', 'command-board-data.json'),
  '/var/task/assets/data/command-board-data.json',
  path.join(process.cwd(), 'assets', 'data', 'command-board-data.json')
];

function _firstExisting(paths) {
  for (var i = 0; i < paths.length; i++) {
    try { if (fs.existsSync(paths[i])) return paths[i]; } catch (_) { /* next */ }
  }
  return null;
}

async function _loadPortals() {
  var portals = {}, slugToCik = {};
  // Manifest slugs are pre-sorted, preserving the propagator's determinism contract (W3).
  var slugs = (await listSlugs()).slugs;
  for (var i = 0; i < slugs.length; i++) {
    var p = (await loadPortal(slugs[i])).portal;
    if (!p) continue;
    var slug = p.slug || slugs[i];
    portals[slug] = p;
    if (p.cik) slugToCik[slug] = String(p.cik).replace(/^0+/, '') || '0';
  }
  return { portals: portals, slugToCik: slugToCik };
}

function _loadCB() {
  var fp = _firstExisting(CB_PATHS);
  if (!fp) return [];
  try { var j = JSON.parse(fs.readFileSync(fp, 'utf8')); return j.companies || []; }
  catch (_) { return []; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var t0 = Date.now();
  try {
    var loaded = await _loadPortals();
    var cb = _loadCB();
    var result = propagator.runPropagation(loaded.portals, cb);
    var snapshot = propagator.serializeResult(result);
    var propagated = (snapshot && snapshot.propagated) || [];

    var byCik = {};
    var slugMissingCik = 0;
    for (var i = 0; i < propagated.length; i++) {
      var n = propagated[i];
      var cik = loaded.slugToCik[n.slug];
      if (!cik) { slugMissingCik++; continue; }
      byCik[cik] = {
        slug:              n.slug,
        inducedStress:     n.inducedStress,
        totalStress:       n.totalStress,
        amplificationRank: n.amplificationRank,
        isHub:             !!n.isHub,
        networkPushed:     !!n.networkPushed
      };
    }

    var slim = {
      schemaVersion: 'stress-slim/1.0',
      generatedAt:   (snapshot && snapshot.generatedAt) || new Date().toISOString(),
      generatedAtMs: Date.now(),
      stats:         (snapshot && snapshot.stats) || null,
      byCik:         byCik
    };
    var bytes = Buffer.byteLength(JSON.stringify(slim));

    await db.set(SLIM_KEY, slim, TTL);
    var receipt = {
      generatedAtMs: slim.generatedAtMs,
      schemaVersion: slim.schemaVersion,
      nodes:         propagated.length,
      withCik:       Object.keys(byCik).length,
      slugMissingCik: slugMissingCik,
      bytes:         bytes,
      computeMs:     Date.now() - t0,
      backend:       db.getBackend()
    };
    await db.set(META_KEY, receipt, TTL);

    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify(Object.assign({ ok: true }, receipt)));
  } catch (err) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String((err && err.message) || err) }));
  }
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('limen-worker-stress-refresh', module.exports);
