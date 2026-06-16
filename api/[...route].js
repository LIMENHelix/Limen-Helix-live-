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

// name → handler module. Static requires so the tracer bundles them.
const HANDLERS = {
  'limen-health': require('../handlers/limen-health'),
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
    return res.end(JSON.stringify({ error: 'route not handled by Hono entry', path: pathname }));
  }
  return resolve(handler)(req, res);
};
