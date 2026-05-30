/**
 * LIMEN Helix — Stress Propagation endpoint
 *
 * GET /api/limen-stress-propagation
 *   Returns the full cached propagation snapshot
 *   (assets/data/stress-network-state.json).
 *
 * GET /api/limen-stress-propagation?slug=<slug>
 *   Returns the propagation entry for a specific portal slug.
 *
 * GET /api/limen-stress-propagation?networkPushed=1
 *   Returns only nodes where inducedStress > intrinsicStress.
 *
 * GET /api/limen-stress-propagation?top=20
 *   Top-N by totalStress.
 *
 * GET /api/limen-stress-propagation?compute=1
 *   Recompute live from current portal corpus + Command Board state
 *   (does NOT write to disk — that's the CLI's job). Useful for
 *   ad-hoc / cron-driven recomputation. Auth-gated.
 *
 * Snapshot shape (see scripts/build-stress-network.mjs for producer):
 *   { schemaVersion, generatedAt, stats, propagated: [...] }
 *
 * Cache-aside read for the snapshot — falls back to live compute if
 * the file is missing.
 */

const fs = require('node:fs');
const path = require('node:path');

const OPERATOR_TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const AUTH_ON = !!OPERATOR_TOKEN;

const STATE_PATH = path.join(process.cwd(), 'assets/data/stress-network-state.json');
const PORTAL_DIR = path.join(process.cwd(), 'assets/data/companies');
const CB_PATH = path.join(process.cwd(), 'assets/data/command-board-data.json');

let _propagator = null;
function getPropagator() {
  if (_propagator) return _propagator;
  _propagator = require('./lib/limen-stress-propagator.js');
  return _propagator;
}

function checkAuth(req) {
  if (!AUTH_ON) return { ok: true, mode: 'disabled' };
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header) return { ok: false, reason: 'missing-bearer' };
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, reason: 'malformed-bearer' };
  if (m[1] !== OPERATOR_TOKEN) return { ok: false, reason: 'token-mismatch' };
  return { ok: true, mode: 'operator' };
}

function loadCachedSnapshot() {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function liveCompute() {
  const propagator = getPropagator();
  const portals = {};
  if (fs.existsSync(PORTAL_DIR)) {
    // Sort readdirSync output — OS-dependent enumeration order otherwise
    // leaks into the propagator's hashable payload (W3 determinism).
    const files = fs.readdirSync(PORTAL_DIR).sort().filter(f =>
      f.endsWith('.json') && !f.startsWith('_'));
    for (const f of files) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, f), 'utf8'));
        const slug = p.slug || f.replace('.json', '');
        portals[slug] = p;
      } catch (e) { /* skip */ }
    }
  }
  let cb = [];
  if (fs.existsSync(CB_PATH)) {
    try {
      const j = JSON.parse(fs.readFileSync(CB_PATH, 'utf8'));
      cb = j.companies || [];
    } catch (e) { /* skip */ }
  }
  const result = propagator.runPropagation(portals, cb);
  return propagator.serializeResult(result);
}

function filterSnapshot(snapshot, urlSearch) {
  const slug = urlSearch.get('slug');
  const networkPushed = urlSearch.get('networkPushed') === '1';
  const top = parseInt(urlSearch.get('top') || '0', 10);

  let arr = snapshot.propagated || [];
  if (slug) {
    const n = arr.find(x => x.slug === slug);
    return { ...snapshot, propagated: n ? [n] : [] };
  }
  if (networkPushed) arr = arr.filter(x => x.networkPushed);
  if (top > 0) arr = arr.slice(0, top);
  return { ...snapshot, propagated: arr, filter: { slug, networkPushed, top } };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('x-auth-mode', AUTH_ON ? 'enforced' : 'disabled');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }));
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const compute = url.searchParams.get('compute') === '1';

    let snapshot;
    if (compute) {
      const auth = checkAuth(req);
      if (!auth.ok) {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.setHeader('WWW-Authenticate', 'Bearer realm="limen-stress-propagation"');
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized', reason: auth.reason }));
      }
      const t0 = Date.now();
      snapshot = liveCompute();
      snapshot.computeMs = Date.now() - t0;
      snapshot.source = 'live';
    } else {
      snapshot = loadCachedSnapshot();
      if (!snapshot) {
        // Cache miss — compute live without auth (read-only operation)
        const t0 = Date.now();
        snapshot = liveCompute();
        snapshot.computeMs = Date.now() - t0;
        snapshot.source = 'live-fallback';
      } else {
        snapshot.source = 'cache';
      }
    }

    const filtered = filterSnapshot(snapshot, url.searchParams);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.setHeader('x-source', filtered.source || 'unknown');
    return res.end(JSON.stringify({ ok: true, ...filtered }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String((err && err.message) || err) }));
  }
};
