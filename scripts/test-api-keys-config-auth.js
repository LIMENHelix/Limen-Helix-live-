#!/usr/bin/env node
'use strict';

/**
 * test-api-keys-config-auth.js — the env-key inventory is operator-only and
 * carries no secret-derived metadata.
 *
 * Grep evidence for the gating decision: nothing under assets/, pages/ or
 * portals/ references 'api-keys-config' (only api/[...route].js routing and
 * generated docs). Feed readiness for public UI is served by /api/feed-status,
 * so this endpoint is gated rather than reshaped to a public capability model.
 *
 * Properties under test:
 *   1. Anonymous / wrong key / query-string key → 403, no inventory.
 *   2. Valid operator master key (x-limen-pass, mocked ADMIN_MASTER) → 200
 *      with configured/missing lists.
 *   3. No entry exposes secret-derived material: no key VALUES, no lengths,
 *      no prefixes or suffixes. (Env var NAMES remain — auditing which named
 *      integrations are configured is the endpoint's entire purpose, and it
 *      is now master-only.)
 *   4. No Access-Control-Allow-Origin: * on any branch.
 */

const assert = require('assert');

const SAVED = {};
['ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'FRED_API_KEY', 'EIA_API_KEY'
].forEach(function (k) { SAVED[k] = process.env[k]; });

function restoreEnv() {
  Object.keys(SAVED).forEach(function (k) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  });
}

const FRED_VALUE = 'QqQ7fredinventoryprobe99';

const handler = require('../handlers/api-keys-config.js');

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
  return { headers: normalized, url: url || '/api/api-keys-config' };
}

async function main() {
  process.env.ADMIN_MASTER = 'master-pass-xyz';
  delete process.env.ADMIN_MASTER_KEY;
  process.env.FRED_API_KEY = FRED_VALUE;
  delete process.env.EIA_API_KEY;

  // ── anonymous cannot receive the inventory ─────────────────────────────────
  let r = await invoke(request({}));
  check('anonymous refuses (status)', r.status, 403);
  check('anonymous gets no inventory', r.body.configured, undefined);
  check('anonymous gets no summary', r.body.summary, undefined);

  r = await invoke(request({ 'x-limen-pass': 'wrong' }));
  check('wrong pass refuses (status)', r.status, 403);

  r = await invoke(request({}, '/api/api-keys-config?key=master-pass-xyz'));
  check('query-string pass refuses (status)', r.status, 403);

  // ── operator receives the audit ────────────────────────────────────────────
  r = await invoke(request({ 'x-limen-pass': 'master-pass-xyz' }));
  check('operator pass permits (status)', r.status, 200);
  check('summary present', typeof r.body.summary, 'object');
  check('configured list is an array', Array.isArray(r.body.configured), true);
  check('missing list is an array', Array.isArray(r.body.missing), true);

  const fred = (r.body.configured || []).find(function (e) { return e.key === 'FRED_API_KEY'; });
  check('FRED listed as configured', typeof fred, 'object');
  check('FRED status configured', fred && fred.status, 'configured');
  const eia = (r.body.missing || []).find(function (e) { return e.key === 'EIA_API_KEY'; });
  check('EIA listed as missing', typeof eia, 'object');

  // ── no secret-derived metadata in any entry ────────────────────────────────
  const blob = JSON.stringify(r.body);
  check('response never contains a key value', blob.indexOf(FRED_VALUE), -1);
  check('response has no length field anywhere', blob.indexOf('"length"'), -1);
  for (let i = 0; i < r.body.configured.length; i++) {
    check('entry ' + r.body.configured[i].key + ' has no length property',
      'length' in r.body.configured[i], false);
  }

  // ── CORS: operator-only, never * ───────────────────────────────────────────
  check('success branch has no wildcard CORS', r.headers['access-control-allow-origin'], undefined);
  const denied = await invoke(request({}));
  check('deny branch has no wildcard CORS', denied.headers['access-control-allow-origin'], undefined);

  console.log(passed + '/' + passed + ' passed');
}

main().then(function () {
  restoreEnv();
}).catch(function (e) {
  restoreEnv();
  console.error(e && e.stack || e);
  process.exit(1);
});
