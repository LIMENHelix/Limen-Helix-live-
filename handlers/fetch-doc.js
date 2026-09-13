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
 *   Operator-only. The caller must present the operator master key in the
 *   x-limen-pass header (verified server-side via lib/admin-gate). The
 *   header is read from the request, never from the URL (URLs are logged).
 *   A missing or incorrect key is rejected with 403 before any allowlist
 *   lookup or filesystem touch. There is no shared client-side literal:
 *   a person enters the operator key and the client forwards it verbatim.
 *
 *   Responses:
 *     403 { ok: false, error: 'Admin-only endpoint. Sign in.' }
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
 *     x-limen-pass: <operator master key>   (required)
 *     Content-Type:  application/json
 *   Body:
 *     { "docKey": "<allowlist-key>" }
 *
 * Responses:
 *   200 { ok: true,  docKey, content, charCount }
 *   400 { ok: false, error: 'INVALID_BODY' | 'MISSING_DOC_KEY' }
 *   403 { ok: false, error: 'forbidden' }
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

var adminGate = require('../lib/admin-gate');

// ─── Allowlist (key → repo-relative path) ────────────────────────────
//
// The allowlist lives here and only here; no client copy exists.
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
//   (c) confirm the includeFiles glob in vercel.json still covers it
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

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED',
      message: 'POST only. Direct GETs to /docs/*.md are routed here by Vercel and rejected.' });
    return;
  }

  // Auth check — reject before any allowlist lookup or fs touch. The
  // operator key travels in the x-limen-pass header only; query-string
  // credentials are ignored because URLs are logged.
  var headers = req.headers || {};
  var pass = headers['x-limen-pass'] || headers['X-Limen-Pass'] || '';
  if (!adminGate.isMaster(pass)) return adminGate.deny(res);

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
