/**
 * scripts/test-cron-auth-fail-closed.js — no cron handler may authorise on a header a
 * caller can set.
 * Run: node scripts/test-cron-auth-fail-closed.js
 *
 * Vercel's documentation is explicit: `x-vercel-cron` is informational, naming which
 * schedule fired. The only trusted mechanism is CRON_SECRET compared against the
 * `Authorization: Bearer` header Vercel provisions. Anyone can send x-vercel-cron.
 *
 * Five handlers fell back to trusting those headers when CRON_SECRET was unset, which
 * made a scheduled job reachable by an unauthenticated POST. Seventeen cron handlers can
 * reach lib/tradier-b14.js placeOrder, five reach lib/crm-send (outbound email), and
 * relay-autonomous-scraper reaches lib/relay-cj placeOrder, so this is a money path, not
 * a hygiene issue.
 *
 * This test reads source rather than invoking handlers: the property being pinned is
 * "no cron handler contains a header-based authorisation fallback", which is structural.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const crons = [...new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
    .crons.map(function (c) { return c.path.replace('/api/', '').split('?')[0]; })
)].sort();

/** Source with comments stripped: a comment explaining the old bug must not fail this. */
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

console.log('C1: no cron handler authorises on a spoofable header');
const offenders = [];
crons.forEach(function (c) {
  const f = path.join(ROOT, 'handlers', c + '.js');
  if (!fs.existsSync(f)) return;
  const src = code(f);
  // The shape that was wrong: a header appearing on the RIGHT of a return/assignment
  // that decides cron identity.
  if (/(return\s*!!\(|isCron\s*=|:\s*\()[^;]*x-vercel-(cron|signature)/.test(src)) {
    offenders.push(c);
  }
});
assert('no handler grants cron identity from x-vercel-* headers',
  offenders.length === 0, offenders.join(', '));

console.log('C2: every handler that names CRON_SECRET requires it to be non-empty');
const weak = [];
crons.forEach(function (c) {
  const f = path.join(ROOT, 'handlers', c + '.js');
  if (!fs.existsSync(f)) return;
  const src = code(f);
  if (src.indexOf('CRON_SECRET') === -1) return;
  // Accept either the shared lib, or a guard that requires the secret to be truthy
  // before comparing. Reject `if (CRON_SECRET) ... else <something permissive>`.
  // Accepted fail-closed forms, all verified by reading the handlers:
  //   lib/cron-auth                       (34 handlers)
  //   process.env.CRON_SECRET && ...      autopilot, hero-image, social-cron,
  //                                       subscriber-digest, relay-autonomous-scraper
  //   env.CRON_SECRET && ...              finance-motor-capability:33,
  //                                       intelligence-autopilot-capability:9
  //   sameSecret(a, b) rejecting empty    brain-weights-cron:83 (`if (!candidate ||
  //                                       !expected) return false`)
  //   an explicit `if (!secret) return`   brain-shadow
  const usesLib = /require\(['"]\.\.\/lib\/cron-auth/.test(src);
  //   a local alias required truthy       brain-shadow:60 (`!!(cronSecret && ...)`)
  const guarded = /(?:process\.)?env\.CRON_SECRET\s*&&/.test(src) ||
                  /\b(?:cronSecret|secret)\s*&&/.test(src) ||
                  /!\s*(?:cronS|s)ecret\b/.test(src) ||
                  /if\s*\(\s*!candidate\s*\|\|\s*!expected\s*\)/.test(src);
  if (!usesLib && !guarded) weak.push(c);
});
assert('CRON_SECRET is always required non-empty before it authorises',
  weak.length === 0, weak.join(', '));

// C3 ─────────────────────────────────────────────────────────────────────────
// Every cron handler must require a credential. This is a PINNED SET rather than a
// heuristic: the handlers below were each read and confirmed to do no state-changing,
// spend-capable work without one. The test fails if the set GROWS, which is what
// catches a new cron handler shipped with no gate.
//
// finance-subscriber-cycle is deliberately not here: it is a 9-line wrapper delegating
// to subscriber-digest, which enforces at :75-78. Verified by invocation — a spoofed
// x-vercel-cron, a spoofed x-vercel-signature, no headers and a wrong bearer all return
// 401, while the correct bearer gets past auth.
console.log('C3: no NEW cron handler ships without a credential check');
const KNOWN_UNGATED = [
  'feed-record',                    // writes a feed snapshot, no spend path
  'limen-worker-ingest',            // ingest only
  'limen-worker-score',             // scoring only
  'limen-worker-snapshot',          // snapshot only
  'limen-worker-stress-refresh'     // recompute only
];
const ungated = [];
crons.forEach(function (c) {
  const f = path.join(ROOT, 'handlers', c + '.js');
  if (!fs.existsSync(f)) return;
  const s = code(f);
  const guarded =
    /require\(['"]\.\.\/lib\/cron-auth/.test(s) ||
    /(?:process\.)?env\.CRON_SECRET\s*&&/.test(s) ||
    /\b(?:cronSecret|secret)\s*&&/.test(s) ||
    /!\s*secret\b/.test(s) ||
    /if\s*\(\s*!candidate\s*\|\|\s*!expected\s*\)/.test(s) ||
    /require\(['"]\.\.\/lib\/admin-gate/.test(s) ||
    /Admin\.(reqKey|hasDomain)/.test(s) ||
    /ADMIN_KEY|BRAIN_WEIGHTS_TOKEN|SHADOW_TOKEN/.test(s) ||
    /require\(['"]\.\/subscriber-digest/.test(s);   // wrapper; delegate enforces
  if (!guarded) ungated.push(c);
});
const unexpected = ungated.filter(function (c) { return KNOWN_UNGATED.indexOf(c) === -1; });
assert('no cron handler outside the reviewed set lacks a credential check',
  unexpected.length === 0, unexpected.join(', '));

console.log('C4: the shared lib itself fails closed');
const auth = require('../lib/cron-auth.js');
const savedSecret = process.env.CRON_SECRET;

delete process.env.CRON_SECRET;
const unconfigured = auth.authorize({ headers: { authorization: 'Bearer anything' } });
assert('no secret configured is refused, not skipped',
  unconfigured.ok === false && unconfigured.status === 503, JSON.stringify(unconfigured));

process.env.CRON_SECRET = 'the-real-secret';
assert('a spoofed x-vercel-cron header alone is refused',
  auth.authorize({ headers: { 'x-vercel-cron': '1' } }).ok === false);
assert('a spoofed x-vercel-signature header alone is refused',
  auth.authorize({ headers: { 'x-vercel-signature': 'abc' } }).ok === false);
assert('a wrong bearer is refused',
  auth.authorize({ headers: { authorization: 'Bearer wrong' } }).ok === false);
assert('no header at all is refused',
  auth.authorize({ headers: {} }).ok === false);
assert('the correct bearer is accepted',
  auth.authorize({ headers: { authorization: 'Bearer the-real-secret' } }).ok === true);

if (savedSecret === undefined) delete process.env.CRON_SECRET;
else process.env.CRON_SECRET = savedSecret;

console.log('');
console.log(failures === 0
  ? 'CRON AUTH FAILS CLOSED (' + tests + ' assertions across ' + crons.length + ' cron targets)'
  : failures + ' FAILED of ' + tests + ' assertions');
process.exit(failures === 0 ? 0 : 1);
