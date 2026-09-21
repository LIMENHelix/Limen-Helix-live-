#!/usr/bin/env node
/**
 * scripts/post-deploy-smoke.mjs — prove a fresh production deploy is actually serving.
 *
 *   node scripts/post-deploy-smoke.mjs                       against https://limenhelix.com
 *   SMOKE_BASE_URL=https://preview.example.com node ...      against a preview deploy
 *
 * WHY THIS EXISTS. A deploy can be "Ready" in Vercel while the API is dead: the
 * Hono catch-all requires every routed handler at boot, so one load-time throw
 * 500s the entire /api surface and nothing notices until a user does. This script
 * is the tripwire — it runs from the post-deploy-smoke GitHub workflow on every
 * successful production deployment_status and goes red on any unexpected status.
 *
 * SAFETY CONTRACT — READ BEFORE ADDING A ROUTE:
 *   - GET requests ONLY. No POST/PUT/DELETE, nothing state-changing.
 *   - NO SECRETS. Every route below is asserted WITHOUT credentials: the gated
 *     ones are EXPECTED to refuse (401/403). A refusal in production is the
 *     proof that the PR-003 fail-closed gates are live, and it costs nothing to
 *     check. Never add a credential to this file — a route that needs one does
 *     not belong in this script.
 *
 * RETRIES. A deployment can report success before every edge node serves the new
 * bundle, so each failing route is retried (3 attempts, 15s/30s backoff) before
 * the run is declared red. A route that is green on any attempt is done.
 */

const BASE = (process.env.SMOKE_BASE_URL || 'https://limenhelix.com').replace(/\/+$/, '');

/* THE ROUTE TABLE — the one obvious place. Expected statuses are exact on
   purpose: a gated route returning 200 means the gate DIED, which is as much a
   failure as a public route returning 500. */
const ROUTES = [
  // Public surface must serve.
  { path: '/',         expect: 200, why: 'public home page serves' },
  { path: '/api/ping', expect: 200, why: 'standalone function boots (static api/ping.js, not the catch-all)' },

  // Fail-closed gates must refuse without credentials (PR-003).
  // redis-diag: lib/admin-gate.deny → 403 without the master key. It reports live
  //   infrastructure detail and writes to the store; public 200 = leak.
  { path: '/api/redis-diag', expect: 403, why: 'master-key gate live (PR-003)' },
  // relay-demand-dashboard: 403 without RELAY_ADMIN_KEY (header or ?key=).
  //   Carries customer PII and margins; public 200 = leak.
  { path: '/api/relay-demand-dashboard', expect: 403, why: 'relay admin gate live (PR-003)' },
  // limen-worker-ingest: lib/cron-auth.enforce → 401 without the CRON_SECRET
  //   bearer (401, not 503: CRON_SECRET is configured in production — a 503 here
  //   means the secret vanished and every cron is down, which is also red).
  { path: '/api/limen-worker-ingest', expect: 401, why: 'cron fail-closed auth live (PR-003)' },
];

const ATTEMPTS = 3;
const BACKOFF_MS = [15000, 30000];   // wait before attempts 2 and 3
const FETCH_TIMEOUT_MS = 20000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getStatus(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method: 'GET',
      redirect: 'manual',          // a redirect is a status worth seeing, not following
      signal: ctrl.signal,
      headers: { 'user-agent': 'limen-post-deploy-smoke/1.0 (read-only status check)' }
    });
    return res.status;
  } catch (e) {
    return 'ERROR: ' + ((e && e.name) === 'AbortError' ? 'timeout' : String(e && e.message || e));
  } finally {
    clearTimeout(timer);
  }
}

let pending = ROUTES.slice();
const failures = [];

for (let attempt = 1; attempt <= ATTEMPTS && pending.length; attempt++) {
  if (attempt > 1) {
    const wait = BACKOFF_MS[attempt - 2];
    console.log('retrying ' + pending.length + ' route(s) in ' + wait / 1000 + 's (deploy propagation)...');
    await sleep(wait);
  }
  const stillPending = [];
  for (const route of pending) {
    const status = await getStatus(route.path);
    if (status === route.expect) {
      console.log('  OK    GET ' + route.path + ' → ' + status + '  (' + route.why + ')');
    } else if (attempt < ATTEMPTS) {
      console.log('  ...   GET ' + route.path + ' → ' + status + ', expected ' + route.expect + ' — will retry');
      stillPending.push(route);
    } else {
      console.log('  FAIL  GET ' + route.path + ' → ' + status + ', expected ' + route.expect + '  (' + route.why + ')');
      failures.push({ route, status });
    }
  }
  pending = stillPending;
}

console.log('\nsmoke: ' + BASE + ' — ' + (ROUTES.length - failures.length) + '/' + ROUTES.length + ' routes as expected');

if (failures.length) {
  console.error('\nPOST-DEPLOY SMOKE FAILED. The deploy is live but the surface is wrong:');
  for (const f of failures) {
    console.error('  GET ' + f.route.path + ' → ' + f.status + ' (expected ' + f.route.expect + ') — ' + f.route.why);
  }
  process.exit(1);
}
