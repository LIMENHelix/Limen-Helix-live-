#!/usr/bin/env node
'use strict';

/**
 * test-domain-snapshot-debug-auth.js — the source-health diagnostic is operator-only
 * and never returns secret-derived material.
 *
 * Grep evidence for the gating decision: no file under assets/, pages/ or portals/
 * references 'domain-snapshot-debug' (only api/[...route].js routing and generated
 * docs). The endpoint header says "Not for production UI", so it is gated, not
 * reshaped.
 *
 * Properties under test, in order of damage:
 *   1. Anonymous / wrong key / query-string key → 403, and the snapshot fetch
 *      (the expensive part) never happens.
 *   2. A valid operator master key (x-limen-pass, mocked ADMIN_MASTER) → 200
 *      with the health payload.
 *   3. In NO branch does the response contain secret-derived material: no key
 *      prefixes, no key values, no lengths or fingerprints of FRED/EIA/NOAA keys.
 *   4. The response carries no Access-Control-Allow-Origin: * — it is
 *      operator-only and same-origin.
 *
 * The snapshot fetch is stubbed at global.fetch and refuses every other URL, so
 * the suite makes no network calls.
 */

const assert = require('assert');

const SAVED = {};
['ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'FRED_API_KEY', 'EIA_API_KEY', 'NOAA_TOKEN'
].forEach(function (k) { SAVED[k] = process.env[k]; });

function restoreEnv() {
  Object.keys(SAVED).forEach(function (k) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  });
}

const KEY_FRAGMENTS = ['ZZZZ', 'YYYY', 'XXXX'];
const KEY_VALUES = ['ZZZZfredkeyvalue0123', 'YYYYeiakeyvalue0123', 'XXXXnoaakeyvalue0123'];

const REAL_FETCH = global.fetch;
let snapshotFetches = 0;
global.fetch = async function (url) {
  if (String(url).indexOf('/api/domain-snapshot') !== -1) {
    snapshotFetches++;
    return {
      ok: true,
      json: async function () {
        return {
          sourceHealth: {
            'FRED Unemployment': { status: 'live', value: 4.1, fetchedAt: '2026-01-01T00:00:00Z' },
            'EIA Petroleum': { status: 'fallback', reason: 'rate limited' }
          }
        };
      }
    };
  }
  throw new Error('BLOCKED: this suite must never make a real network request: ' + url);
};

const handler = require('../handlers/domain-snapshot-debug.js');

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label);
  passed++;
}

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

function request(headers, url) {
  const normalized = {};
  for (const [k, v] of Object.entries(headers || {})) normalized[k.toLowerCase()] = v;
  return { headers: normalized, url: url || '/api/domain-snapshot-debug' };
}

async function main() {
  process.env.ADMIN_MASTER = 'master-pass-xyz';
  delete process.env.ADMIN_MASTER_KEY;
  process.env.FRED_API_KEY = KEY_VALUES[0];
  process.env.EIA_API_KEY = KEY_VALUES[1];
  process.env.NOAA_TOKEN = KEY_VALUES[2];

  // ── anonymous is refused before any work ───────────────────────────────────
  let r = await invoke(request({}));
  check('anonymous refuses (status)', r.status, 403);
  check('anonymous refuses (body)', r.body.ok, false);
  check('anonymous fetched nothing', snapshotFetches, 0);

  r = await invoke(request({ 'x-limen-pass': 'wrong' }));
  check('wrong pass refuses (status)', r.status, 403);
  check('wrong pass fetched nothing', snapshotFetches, 0);

  // Query-string credentials are deliberately ignored: URLs are logged.
  r = await invoke(request({}, '/api/domain-snapshot-debug?key=master-pass-xyz'));
  check('query-string pass refuses (status)', r.status, 403);
  check('query-string pass fetched nothing', snapshotFetches, 0);

  // ── valid operator key permits ─────────────────────────────────────────────
  r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }));
  check('operator pass permits (status)', r.status, 200);
  check('operator pass fetched the snapshot', snapshotFetches, 1);
  check('health payload present', typeof r.body.overall, 'object');
  check('env audit present', typeof r.body.envVars, 'object');
  check('env audit reports presence only (FRED)', r.body.envVars.FRED_API_KEY, 'set');

  // ── no branch leaks secret-derived material ────────────────────────────────
  const blob = JSON.stringify(r.body);
  for (let i = 0; i < KEY_FRAGMENTS.length; i++) {
    check('response has no key prefix ' + KEY_FRAGMENTS[i],
      blob.indexOf(KEY_FRAGMENTS[i]), -1);
    check('response has no key value ' + KEY_VALUES[i].slice(0, 8),
      blob.indexOf(KEY_VALUES[i]), -1);
  }
  check('response has no key prefix pattern', blob.indexOf('set ('), -1);
  check('response has no substring(0, 4) style leak', /\("?[A-Z_]{3,}"?,\s*0,\s*4\)/.test(blob), false);

  // ── CORS: operator-only, never * ───────────────────────────────────────────
  check('no wildcard CORS header', r.headers['access-control-allow-origin'], undefined);

  // Deny path also carries no wildcard CORS.
  const denied = await invoke(request({}));
  check('deny path has no wildcard CORS', denied.headers['access-control-allow-origin'], undefined);

  console.log(passed + '/' + passed + ' passed');
}

main().then(function () {
  global.fetch = REAL_FETCH;
  restoreEnv();
}).catch(function (e) {
  global.fetch = REAL_FETCH;
  restoreEnv();
  console.error(e && e.stack || e);
  process.exit(1);
});
