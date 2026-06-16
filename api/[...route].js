/**
 * api/[...route].js — Hono single-entry router (Node runtime, native req/res).
 *
 * WHY: collapse ~57 Vercel functions into ONE, so includeFiles bundles once
 * (≈1.6GB/deploy → one bundle). Vercel forwards every /api/* path that has NO
 * dedicated static function file to this catch-all. Static files take precedence
 * (api/<name>.js while it still exists, and the Python api/limen.py / api/helix.py
 * / api/ping.py), so a route flips to Hono ONLY once its static file is removed —
 * which makes the migration fully incremental and reversible (git mv back).
 *
 * HOW: we use Hono's RegExpRouter purely as the path matcher and invoke each
 * legacy Vercel-style handler with the REAL Node (req, res). No Fetch shim — so
 * raw request bodies (Stripe HMAC, biosensor, lead), res.setHeader/status/json,
 * and req.on('data') all behave exactly as they did as standalone functions.
 *
 * Each handler is required STATICALLY below so Vercel's dependency tracer bundles
 * it into this function. Adding a route = git mv api/<name>.js handlers/<name>.js
 * + one line in HANDLERS.
 */
const { RegExpRouter } = require('hono/router/reg-exp-router');

// Bumped each migration commit so a deploy is probeable: any unknown /api/* path
// returns this in the miss JSON (curl /api/__probe__ | grep the tag).
const BUILD = 'phase-2b';

// name → handler module. Static requires so the tracer bundles them.
const HANDLERS = {
  'api-keys-config': require('../handlers/api-keys-config'),
  'asset-quote': require('../handlers/asset-quote'),
  'defense-signals': require('../handlers/defense-signals'),
  'domain-snapshot': require('../handlers/domain-snapshot'),
  'domain-snapshot-debug': require('../handlers/domain-snapshot-debug'),
  'feed-status': require('../handlers/feed-status'),
  'fetch-portal': require('../handlers/fetch-portal'),
  'kernel-experiment': require('../handlers/kernel-experiment'),
  'limen-artifact-render': require('../handlers/limen-artifact-render'),
  'limen-autofire-log': require('../handlers/limen-autofire-log'),
  'limen-autoqueue': require('../handlers/limen-autoqueue'),
  'limen-health': require('../handlers/limen-health'),
  'limen-ingest': require('../handlers/limen-ingest'),
  'limen-phase-transitions': require('../handlers/limen-phase-transitions'),
  'limen-self-pulse': require('../handlers/limen-self-pulse'),
  'limen-snapshot': require('../handlers/limen-snapshot'),
  'limen-stress-propagation': require('../handlers/limen-stress-propagation'),
  'limen-stress-slim': require('../handlers/limen-stress-slim'),
  'limen-worker-autofire': require('../handlers/limen-worker-autofire'),
  'limen-worker-autoqueue': require('../handlers/limen-worker-autoqueue'),
  'limen-worker-multipass': require('../handlers/limen-worker-multipass'),
  'limen-worker-sleep-cycle': require('../handlers/limen-worker-sleep-cycle'),
  'market-snapshot': require('../handlers/market-snapshot'),
  'paper-orders': require('../handlers/paper-orders'),
  'paper-positions': require('../handlers/paper-positions'),
  'paper-trade': require('../handlers/paper-trade'),
  'patent-snapshot': require('../handlers/patent-snapshot'),
  'redis-diag': require('../handlers/redis-diag'),
};

const router = new RegExpRouter();
for (const name of Object.keys(HANDLERS)) router.add('ALL', '/api/' + name, name);

// CJS handlers export the function directly; an ESM-authored one would land on .default.
function resolve(h) { return (h && typeof h !== 'function' && h.default) ? h.default : h; }

module.exports = async function honoEntry(req, res) {
  let pathname = req.url || '';
  try { pathname = new URL(req.url, 'http://h').pathname; } catch (e) {}
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  let name = null;
  try {
    const m = router.match(req.method || 'GET', pathname);
    if (m && m[0] && m[0][0]) name = m[0][0][0];
  } catch (e) {}

  const handler = name && HANDLERS[name];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'route not handled by Hono entry', path: pathname, build: BUILD }));
  }
  return resolve(handler)(req, res);
};
