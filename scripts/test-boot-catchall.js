#!/usr/bin/env node
/**
 * scripts/test-boot-catchall.js — require EVERY server function module and fail
 * if any of them throws on load.
 *
 * WHY THIS TEST EXISTS. api/[...route].js requires every routed handler at boot,
 * so ONE module with a load-time throw (a bad require path, a top-level call that
 * needs an env var, syntax Node rejects but a parser accepted) 500s the entire
 * /api surface — and it deploys silently, because Vercel builds do not execute the
 * bundle. The parse pass in check-repository.mjs proves a file PARSES; only a real
 * require proves it LOADS. This test is the difference between "red CI" and
 * "production down, discovered by a user".
 *
 * WHAT IT COVERS:
 *   - every handlers/*.js          (the catch-all's routed surface and more)
 *   - every api/*.js               (the remaining standalone functions)
 *   - api/[...route].js            (the router itself, including its static requires)
 *
 * HOW. Modules are loaded IN-PROCESS under a sanitized environment: dummy values
 * are FORCE-SET (overwriting any real credentials in the caller's shell) so a
 * top-level connection attempt fails fast against a non-routable host instead of
 * touching real infrastructure. Measured 2026-09-21 on the full 329-module surface:
 * every module loads under this env, none calls process.exit, and the process
 * exits naturally afterwards (no leaked handles, no top-level network).
 *
 * THE SKIP LIST IS EMPTY AND SHOULD STAY THAT WAY. A module that genuinely cannot
 * be required in a test process (top-level side effect that cannot be sanitized:
 * opens a connection, calls process.exit, throws on a missing env that has no safe
 * dummy) may be added to SKIP_WITH_JUSTIFICATION — but only with a per-file comment
 * explaining WHY, because every skip is a deploy-time blind spot: that module can
 * break and CI stays green. Fix the module (lazy-init the side effect) in
 * preference to skipping it.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* Force-set, not default-set: a developer shell holding REAL credentials must not
   let a module under test reach real infrastructure. The hosts here do not
   resolve to anything usable, so a top-level connection fails fast and loudly
   rather than silently succeeding against production. */
const SANITIZED_ENV = {
  UPSTASH_REDIS_REST_URL: 'https://boot-test.invalid',
  UPSTASH_REDIS_REST_TOKEN: 'boot-test-dummy-token',
  STRIPE_SECRET_KEY: 'sk_test_boot',
  STRIPE_WEBHOOK_SECRET: 'whsec_boot',
  CRON_SECRET: 'boot-test-cron-secret',
  ADMIN_MASTER: 'boot-test-master',
  RELAY_ADMIN_KEY: 'boot-test-relay-key'
};
for (const [k, v] of Object.entries(SANITIZED_ENV)) process.env[k] = v;
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

/* EMPTY on purpose — see the header comment. Each entry must carry its reason. */
const SKIP_WITH_JUSTIFICATION = new Set([
  // 'handlers/example.js',  // why it cannot load in-process even with sanitized env
]);

const targets = [
  ...fs.readdirSync(path.join(ROOT, 'handlers')).filter(f => f.endsWith('.js')).sort()
    .map(f => 'handlers/' + f),
  ...fs.readdirSync(path.join(ROOT, 'api')).filter(f => f.endsWith('.js')).sort()
    .map(f => 'api/' + f)   // includes api/[...route].js — the catch-all itself
];

const failures = [];
let loaded = 0;
let skipped = 0;

for (const rel of targets) {
  if (SKIP_WITH_JUSTIFICATION.has(rel)) { skipped++; continue; }
  try {
    require(path.join(ROOT, rel));
    loaded++;
  } catch (e) {
    failures.push(rel + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 4).join('\n      '));
  }
}

console.log('boot test: ' + loaded + ' modules loaded, ' + skipped + ' skip-listed, ' +
  failures.length + ' failed to load');

if (failures.length) {
  console.error('\n' + failures.length + ' MODULE(S) THROW ON LOAD — this would 500 the entire /api surface in production:');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
