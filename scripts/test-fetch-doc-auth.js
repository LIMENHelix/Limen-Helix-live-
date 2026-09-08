#!/usr/bin/env node
'use strict';

/**
 * test-fetch-doc-auth.js — protected docs require a real operator key.
 *
 * The old contract accepted the shared literal 'granted' in an X-LIMEN-Access
 * header; that literal lived in client JS, so anyone could read
 * api/protected-docs/*.md. The contract now is the operator master key in
 * x-limen-pass, verified server-side via lib/admin-gate (mocked ADMIN_MASTER).
 *
 * Properties under test:
 *   1. Anonymous → 403 with ZERO filesystem reads. Wrong key → 403. The retired
 *      pseudo-auth value 'granted' → 403. Query-string key → 403.
 *   2. Valid operator key + allowlisted docKey → 200 with the file content.
 *   3. Path traversal / out-of-allowlist keys ('../etc/passwd', '__proto__')
 *      → 404 and still zero file READS.
 *   4. Method discipline: GET → 405.
 *   5. Regression: no client file carries the shared literal or the retired
 *      header — a person enters the operator key and the client (when one
 *      exists) forwards it as x-limen-pass; nothing hardcoded.
 *
 * fs is instrumented around each invoke to count readFileSync calls; the real
 * fs module object is shared with the handler, so the count is exact.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SAVED = {};
['ADMIN_MASTER', 'ADMIN_MASTER_KEY'].forEach(function (k) { SAVED[k] = process.env[k]; });

function restoreEnv() {
  Object.keys(SAVED).forEach(function (k) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  });
}

const handler = require('../handlers/fetch-doc.js');

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label);
  passed++;
}

let reads = 0;
let realReadFileSync = fs.readFileSync;

function invoke(req) {
  return new Promise(function (resolve) {
    const out = { status: 200, body: null, headers: {} };
    const res = {
      statusCode: 200,
      setHeader: function (k, v) { out.headers[k.toLowerCase()] = v; },
      status: function (c) { out.status = c; this.statusCode = c; return this; },
      json: function (o) { out.body = o; resolve(out); return this; },
      end: function (s) {
        out.status = res.statusCode || out.status;
        try { out.body = s ? JSON.parse(s) : null; } catch (e) { out.body = s; }
        resolve(out);
      }
    };
    Promise.resolve(handler(req, res)).catch(function (e) {
      out.status = 500; out.body = { error: e.message }; resolve(out);
    });
  });
}

function request(headers, url, method, body) {
  const normalized = {};
  for (const [k, v] of Object.entries(headers || {})) normalized[k.toLowerCase()] = v;
  return { headers: normalized, url: url || '/api/fetch-doc', method: method || 'POST', body: body };
}

async function main() {
  process.env.ADMIN_MASTER = 'master-pass-xyz';
  delete process.env.ADMIN_MASTER_KEY;

  // ── anonymous is refused before any filesystem touch ───────────────────────
  let r = await invoke(request({}));
  check('anonymous refuses (status)', r.status, 403);
  check('anonymous performed zero file reads', reads, 0);

  r = await invoke(request({ 'x-limen-pass': 'wrong' }));
  check('wrong pass refuses (status)', r.status, 403);
  check('wrong pass performed zero file reads', reads, 0);

  r = invoke(request({ 'x-limen-access': 'granted' }));
  const rg = await r;
  check('retired pseudo-auth literal refuses (status)', rg.status, 403);
  check('retired pseudo-auth performed zero file reads', reads, 0);

  r = await invoke(request({}, '/api/fetch-doc?key=master-pass-xyz'));
  check('query-string pass refuses (status)', r.status, 403);
  check('query-string pass performed zero file reads', reads, 0);

  // ── method discipline ──────────────────────────────────────────────────────
  r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }, '/api/fetch-doc', 'GET'));
  check('GET refuses (status)', r.status, 405);

  // ── valid operator key reads an allowlisted doc ────────────────────────────
  r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }, '/api/fetch-doc', 'POST',
    { docKey: 'D3-E-PLAN' }));
  check('operator pass reads allowlisted doc (status)', r.status, 200);
  check('doc body is a string', typeof r.body.content, 'string');
  check('doc body is non-empty', r.body.content.length > 0, true);
  check('doc read actually happened', reads >= 1, true);

  // ── traversal / out-of-allowlist keys never reach the fs ───────────────────
  const readsBefore = reads;
  for (const bad of ['../api/protected-docs/D3-E-PLAN.md', '../../.env', '__proto__', 'constructor']) {
    r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }, '/api/fetch-doc', 'POST',
      { docKey: bad }));
    check('docKey ' + bad + ' refuses (status)', r.status, 404);
  }
  check('out-of-allowlist keys performed zero extra file reads', reads, readsBefore);

  // ── client regression: no shared literal, no retired header contract ───────
  const gateSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'auth-gate.js'), 'utf8');
  check('client gate has no shared literal', gateSrc.indexOf('granted'), -1);
  check('client gate has no retired pseudo-auth header',
    gateSrc.toLowerCase().indexOf('x-limen-access'), -1);

  console.log(passed + '/' + passed + ' passed');
}

async function withInstrumentation() {
  realReadFileSync = fs.readFileSync;
  fs.readFileSync = function () { reads++; return realReadFileSync.apply(fs, arguments); };
  try {
    await main();
  } finally {
    fs.readFileSync = realReadFileSync;
  }
}

withInstrumentation().then(function () {
  restoreEnv();
}).catch(function (e) {
  restoreEnv();
  console.error(e && e.stack || e);
  process.exit(1);
});
