/**
 * scripts/dev-server.js — a local, credential-free way to RUN the site.
 *
 *   node scripts/dev-server.js            # serves on http://127.0.0.1:3000
 *   PORT=8080 node scripts/dev-server.js  # pick the port
 *
 * WHY THIS EXISTS. The production run command is `vercel dev`, but that requires a
 * Vercel login and a linked project, so it cannot run in a fresh CI/agent VM without
 * credentials. This harness serves the SAME artifacts Vercel serves — the static
 * pages at the repo root, everything under assets/, and the real Hono API catch-all
 * (api/[...route].js) — using nothing but Node's http module. It is a DEVELOPMENT
 * harness, not a byte-for-byte replica of Vercel's edge: it honors cleanUrls, the
 * exact-match rewrites/redirects in vercel.json, and directory index resolution,
 * which is enough to load and click through the product locally.
 *
 * The API surface fails closed exactly as it does in production when its Upstash
 * Redis store is not configured (outward-effect routes return 423 NUKED). That is
 * the real safety behavior, not a harness limitation.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const apiHandler = require(path.join(ROOT, 'api', '[...route].js'));

// Read the parts of vercel.json a local harness can honor: cleanUrls, and the
// EXACT-match entries in rewrites/redirects. Parameterized/regex sources are
// skipped rather than half-applied, so behavior is predictable.
let vercel = {};
try { vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')); }
catch (e) { console.warn('dev-server: could not read vercel.json (' + e.message + '); serving without rewrites'); }

const CLEAN_URLS = vercel.cleanUrls === true;
const isExact = (s) => typeof s === 'string' && !/[:*()?]|\\/.test(s);
const REDIRECTS = new Map();
for (const r of vercel.redirects || []) {
  if (isExact(r.source)) REDIRECTS.set(r.source, { to: r.destination, code: r.statusCode || 307 });
}
const REWRITES = new Map();
for (const r of vercel.rewrites || []) {
  if (isExact(r.source)) REWRITES.set(r.source, r.destination);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

// Resolve a URL path to a file on disk, honoring cleanUrls and directory indexes.
// Returns an absolute path inside ROOT, or null. Never escapes ROOT.
function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const candidates = [rel];
  if (!path.extname(rel)) {
    if (CLEAN_URLS) candidates.push(rel + '.html');
    candidates.push(path.posix.join(rel, 'index.html'));
  }
  for (const c of candidates) {
    const abs = path.join(ROOT, path.normalize(c));
    if (!abs.startsWith(ROOT)) continue;
    try { if (fs.statSync(abs).isFile()) return abs; } catch (e) { /* keep trying */ }
  }
  return null;
}

const server = http.createServer((req, res) => {
  let pathname = '/';
  try { pathname = new URL(req.url, 'http://h').pathname; } catch (e) {}
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return apiHandler(req, res);
  }

  const redirect = REDIRECTS.get(pathname);
  if (redirect) {
    res.statusCode = redirect.code;
    res.setHeader('Location', redirect.to);
    return res.end();
  }

  const rewritten = REWRITES.get(pathname);
  if (rewritten) pathname = rewritten;

  const file = resolveFile(pathname);
  if (!file) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<h1>404</h1><p>No static file or /api route for ' + pathname + '</p>');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(file).on('error', () => { res.statusCode = 500; res.end('read error'); }).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log('dev-server: LIMEN Helix on http://' + HOST + ':' + PORT + '  (static site + /api Hono catch-all)');
  console.log('dev-server: this is a local dev harness, not `vercel dev`; outward /api routes fail closed without Upstash Redis');
});
