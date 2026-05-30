/**
 * api/fetch-doc.js
 *
 * DOCS-0.2 — Authenticated docs fetch endpoint for the operator docs viewer.
 *
 * DOCS-0.2 fixes two bugs found in DOCS-0.1 live test:
 *   1. The .md sources lived at /docs/D3-E-*.md, where Vercel's static layer
 *      resolved them BEFORE rewrites could fire. The rewrites were dead.
 *      Fix: relocate sources into /protected-docs/ so direct GET /docs/X.md
 *      naturally 404s.
 *   2. process.cwd() in Vercel's Node runtime is /var/task and the .md files
 *      were not bundled into the function (they were only in the static
 *      deploy). Fix: vercel.json adds includeFiles for this function so the
 *      .md files are bundled, and this file uses a multi-anchor path
 *      resolution that exposes which anchor resolved on success/failure.
 *
 * Purpose:
 *   The DOCS-0 viewer (docs.html + assets/js/docs-viewer.js) renders
 *   research/planning markdown to authenticated operators. This endpoint
 *   is the only authorized read path for the gated source files.
 *
 * Auth contract:
 *   The site's only existing access mechanism is `assets/js/auth-gate.js`,
 *   which checks `sessionStorage.limen_access === 'granted'` and otherwise
 *   redirects the browser to the landing page. sessionStorage is purely
 *   client-side; it does NOT propagate to HTTP requests automatically. To
 *   honor that contract over HTTP, the viewer reads sessionStorage and
 *   forwards the value in an `X-LIMEN-Access` header on each fetch. This
 *   endpoint mirrors the same client-side check on the server side:
 *     - 401 if the header is missing
 *     - 403 if the header is present but not 'granted'
 *
 *   This is a soft pseudo-auth identical in trust posture to the rest of
 *   the site (the literal value 'granted' is in client-side JS, so anyone
 *   who reads /assets/js/auth-gate.js can set the header). It keeps casual
 *   browsers and search engines out; it is not a hardened secret. If the
 *   operator wants a true secret-bearer auth model later, this is the
 *   single chokepoint to upgrade.
 *
 * Allowlist:
 *   Hardcoded below. MUST be kept in sync with the parallel allowlist in
 *   assets/js/docs-viewer.js. Adding a new doc requires updates in both
 *   files and a new per-document rewrite entry in vercel.json (so direct
 *   /docs/<file>.md fetches are intercepted).
 *
 * Inputs:
 *   POST /api/fetch-doc
 *   Headers:
 *     X-LIMEN-Access: granted        (required)
 *     Content-Type:  application/json
 *   Body:
 *     { "docKey": "<allowlist-key>" }
 *
 * Responses:
 *   200 { ok: true,  docKey, content, charCount }
 *   400 { ok: false, error: 'INVALID_BODY' | 'MISSING_DOC_KEY' }
 *   401 { ok: false, error: 'AUTH_REQUIRED' }
 *   403 { ok: false, error: 'AUTH_INVALID' }
 *   404 { ok: false, error: 'DOC_NOT_FOUND' | 'DOC_FILE_MISSING' }
 *   405 { ok: false, error: 'METHOD_NOT_ALLOWED' }
 *
 * Out-of-scope:
 *   - No directory listing
 *   - No write/save/upload paths
 *   - No external network calls
 *   - No AI calls
 *   - No new env vars
 */

'use strict';

var fs   = require('fs');
var path = require('path');

// ─── Auth ────────────────────────────────────────────────────────────

var AUTH_HEADER_NAME = 'x-limen-access';   // Node lowercases header names
var AUTH_VALUE       = 'granted';           // mirrors assets/js/auth-gate.js

// ─── Allowlist (key → repo-relative path) ────────────────────────────
//
// MUST stay in sync with DOC_ALLOWLIST in assets/js/docs-viewer.js.
//
// DOCS-0.2-RESCUE: sources moved from /protected-docs/ to
// /api/protected-docs/. Vercel's static layer does not serve the
// /api/ tree as static assets, so direct GET to
// /api/protected-docs/<file>.md returns 404 (or 405 if Vercel routes
// the request to the api function tree). The corresponding
// includeFiles entry in vercel.json bundles api/protected-docs/**
// into the api/fetch-doc.js function so fs.readFileSync can locate
// the file at runtime via __dirname-relative resolution.
//
// Adding a new entry requires:
//   (a) place the .md file under api/protected-docs/
//   (b) add the key here
//   (c) add the same key to assets/js/docs-viewer.js
//   (d) confirm the includeFiles glob in vercel.json still covers it
var DOC_ALLOWLIST = {
  'D3-E-NSF-RESEARCH': 'api/protected-docs/D3-E-NSF-RESEARCH.md',
  'D3-E-PLAN':         'api/protected-docs/D3-E-PLAN.md'
};

// ─── Path resolution (multi-anchor) ──────────────────────────────────
//
// DOCS-0.2-RESCUE: source files now live at api/protected-docs/<file>.md
// (beside this function). The PRIMARY resolution anchor is
// __dirname-relative — `path.join(__dirname, 'protected-docs', basename)`
// — because in Vercel's Node runtime __dirname is /var/task/api and
// the includeFiles glob `api/protected-docs/**` places the bundled
// files at /var/task/api/protected-docs/<file>.md.
//
// Multi-anchor fallback chain is retained as defense-in-depth in case
// Vercel relocates the function file or the working directory shifts.
// Each anchor is tried in order and the first existing path wins.
// On 404 we surface the full attempts[] for debugging.

function _resolveDocPath(relPath) {
  var attempts  = [];
  var basename  = path.basename(relPath);
  var anchors = [
    // PRIMARY: file is co-located beside the function.
    { name: 'dirname-relative', candidate: path.join(__dirname, 'protected-docs', basename) },
    // Fallbacks treat relPath as repo-root-relative.
    { name: 'cwd',              candidate: path.join(process.cwd(), relPath) },
    { name: 'dirname-up',       candidate: path.join(__dirname, '..', relPath) }
  ];
  if (typeof process.env.LAMBDA_TASK_ROOT === 'string' && process.env.LAMBDA_TASK_ROOT.length > 0) {
    anchors.push({ name: 'lambda-task-root', candidate: path.join(process.env.LAMBDA_TASK_ROOT, relPath) });
  }
  for (var i = 0; i < anchors.length; i++) {
    var attempt = { anchor: anchors[i].name, candidate: anchors[i].candidate };
    var exists = false;
    try { exists = fs.existsSync(anchors[i].candidate); }
    catch (e) { attempt.error = (e && e.code) ? e.code : 'unknown'; }
    attempt.exists = exists;
    attempts.push(attempt);
    if (exists) return { ok: true, path: anchors[i].candidate, anchor: anchors[i].name, attempts: attempts };
  }
  return { ok: false, attempts: attempts };
}

// ─── Handler ─────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-LIMEN-Access');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED',
      message: 'POST only. Direct GETs to /docs/*.md are routed here by Vercel and rejected.' });
    return;
  }

  // Auth check — reject before any allowlist lookup or fs touch.
  var headers = req.headers || {};
  var auth = headers[AUTH_HEADER_NAME];
  if (typeof auth !== 'string' || auth.length === 0) {
    res.status(401).json({ ok: false, error: 'AUTH_REQUIRED',
      message: 'X-LIMEN-Access header is required.' });
    return;
  }
  if (auth !== AUTH_VALUE) {
    res.status(403).json({ ok: false, error: 'AUTH_INVALID',
      message: 'X-LIMEN-Access header value is not accepted.' });
    return;
  }

  // Body parse — Vercel auto-parses JSON when Content-Type is application/json.
  var body = req.body;
  if (typeof body !== 'object' || body === null) {
    res.status(400).json({ ok: false, error: 'INVALID_BODY',
      message: 'Request body must be a JSON object.' });
    return;
  }

  var docKey = body.docKey;
  if (typeof docKey !== 'string' || docKey.length === 0) {
    res.status(400).json({ ok: false, error: 'MISSING_DOC_KEY',
      message: 'Request body must include a non-empty docKey string.' });
    return;
  }

  // Strict allowlist match. hasOwnProperty defends against prototype-pollution-
  // style keys like '__proto__' or 'constructor'. Even if a key passed this
  // check, the resolved path comes from the allowlist VALUE (not from the key
  // string), so no path-traversal is possible: the worst an attacker could
  // achieve is reading a file we already chose to serve.
  if (!Object.prototype.hasOwnProperty.call(DOC_ALLOWLIST, docKey)) {
    res.status(404).json({ ok: false, error: 'DOC_NOT_FOUND',
      message: 'Requested docKey is not in the allowlist.' });
    return;
  }

  var relPath = DOC_ALLOWLIST[docKey];
  var resolution = _resolveDocPath(relPath);
  if (!resolution.ok) {
    res.status(404).json({
      ok:    false,
      error: 'DOC_FILE_MISSING',
      message: 'Allowlisted doc could not be located in any known anchor on the server.',
      attempts: resolution.attempts
    });
    return;
  }

  var content;
  try {
    content = fs.readFileSync(resolution.path, 'utf8');
  } catch (e) {
    res.status(404).json({
      ok:    false,
      error: 'DOC_FILE_MISSING',
      message: 'Located the allowlisted doc but could not read it.',
      diagnostic: (e && e.code) ? e.code : 'unknown',
      anchor: resolution.anchor,
      path:   resolution.path
    });
    return;
  }

  res.status(200).json({
    ok:        true,
    docKey:    docKey,
    content:   content,
    charCount: content.length,
    resolvedFromAnchor: resolution.anchor
  });
};
