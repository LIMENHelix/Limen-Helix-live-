/**
 * brain-v2/test/deployment-invariants.js — the brain must stay REACHABLE and SCHEDULED.
 *
 *   node brain-v2/test/deployment-invariants.js
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. On 2026-08-07 an unrelated feature branch merged and took the shadow
 * runtime off the air for three and a half hours. Not by changing a line of brain code:
 * every brain file was untouched and correct on main throughout. Two lines went missing
 * in a merge resolution.
 *
 *   api/[...route].js   lost   'brain-shadow': require('../handlers/brain-shadow')
 *   vercel.json         had    /api/brain-shadow?run=1  REPLACED by another cron
 *
 * The result was `/api/brain-shadow` answering 404 and no hourly execution at all. The
 * cycles at 17:27, 18:27 and 19:27 simply never happened, and nothing failed loudly:
 * every test passed, the deploy was green, the site was up. A brain that is installed,
 * correct and unreachable looks exactly like a brain that is working, because the only
 * surface that would say otherwise is the one that stopped answering.
 *
 * The whole test suite ran green through the outage. That is the gap this file closes.
 *
 * THE THIRD ASSERTION IS THE ONE THAT MATTERS. The cron was not deleted, it was
 * SUBSTITUTED: a new cron took its array slot. A test that only asked "does a brain cron
 * exist" would pass on the day someone swaps it again for something else, because the
 * count stays the same. So the schedule is pinned too, and coexistence is asserted rather
 * than assumed.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Deliberately NOT a network test. It asserts what the repository declares, so it fails in
 * CI on the pull request that would cause the outage, not hours afterwards in production.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var ROUTE_FILE = path.join(ROOT, 'api', '[...route].js');
var VERCEL_FILE = path.join(ROOT, 'vercel.json');

/* The contract, in one place. A future batch that installs more domains does not change
   any of this: the route and the cron are per-runtime, not per-domain. */
var ROUTE_KEY = 'brain-shadow';
var HANDLER_PATH = '../handlers/brain-shadow';
var CRON_PATH = '/api/brain-shadow?run=1';
var CRON_SCHEDULE = '27 * * * *';

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

console.log('');
console.log('=== BRAIN DEPLOYMENT INVARIANTS: reachable, and scheduled ===');
console.log('');

// ── D1: the route is registered, and points at the real handler ──────────────
console.log('D1: /api/brain-shadow is registered in the Hono catch-all');
var routeRaw = fs.readFileSync(ROUTE_FILE, 'utf8');

/**
 * COMMENTS ARE STRIPPED BEFORE MATCHING, and this is not a refinement. The first version
 * of this test matched the raw file, so `// 'brain-shadow': require(...)` satisfied it:
 * commenting the route out passed 9 of 9 while the endpoint would answer 404. A guard that
 * accepts the disabled form of the thing it guards is worse than no guard, because it
 * reports safety.
 *
 * Verified by doing it: with the line commented, the raw-text version passed and this one
 * fails.
 *
 * String literals are blanked too, so a route name mentioned inside an error message or a
 * doc string cannot stand in for a registration.
 */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')          // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1')          // line comments, not URLs
    .replace(/`(?:\\.|[^`\\])*`/g, '``');        // template literals
}
var routeSrc = codeOnly(routeRaw);

/* Matched as a HANDLERS map entry, not a bare substring: "brain-shadow" also appears in
   comments and beside neighbouring keys like "brain-cognition", so a loose grep would pass
   on a file that registers nothing. */
function registers(src, key, handlerPath) {
  return new RegExp("['\"]" + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]\\s*:\\s*require\\(\\s*['\"]" +
    handlerPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]\\s*\\)").test(src);
}
assert('the HANDLERS map registers ' + ROUTE_KEY + ' -> ' + HANDLER_PATH,
  registers(routeSrc, ROUTE_KEY, HANDLER_PATH),
  'without this line the endpoint answers 404 "route not handled by Hono entry" and the ' +
  'cron cannot execute a cycle, while every brain file stays correct and every test passes');

assert('and commenting the registration out does NOT satisfy the check',
  !registers(codeOnly("  // '" + ROUTE_KEY + "': require('" + HANDLER_PATH + "'),\n"), ROUTE_KEY, HANDLER_PATH),
  'the raw-text version of this assertion passed on a commented-out route');

assert('and the handler file it names actually exists',
  fs.existsSync(path.join(ROOT, 'handlers', 'brain-shadow.js')),
  'a registered route pointing at a missing file throws on require, and a throw in this ' +
  'module takes down EVERY /api/* route, not just this one');

/* Proves the matcher is not vacuous. If the regex were wrong it would report a missing
   route on a healthy file, or worse, pass on anything. */
assert('the check is not vacuous: the same matcher finds no route for a name that is absent',
  !new RegExp("['\"]brain-shadow-does-not-exist['\"]\\s*:\\s*require").test(routeSrc));

// ── D2: the execution cron exists, with its schedule ─────────────────────────
console.log('');
console.log('D2: the hourly execution cron exists and keeps its schedule');
var vercel = JSON.parse(fs.readFileSync(VERCEL_FILE, 'utf8'));
var crons = Array.isArray(vercel.crons) ? vercel.crons : [];
assert('vercel.json declares a crons array', crons.length > 0, JSON.stringify(crons.length));

var brainCrons = crons.filter(function (c) { return c && c.path === CRON_PATH; });
assert('exactly one cron targets ' + CRON_PATH, brainCrons.length === 1,
  'found ' + brainCrons.length + ' :: ' + JSON.stringify(crons.map(function (c) { return c.path; })));
assert('and it runs on the pinned schedule "' + CRON_SCHEDULE + '"',
  brainCrons.length === 1 && brainCrons[0].schedule === CRON_SCHEDULE,
  brainCrons.length ? brainCrons[0].schedule : 'no cron to check');

// ── D3: substitution, the failure that actually happened ────────────────────
console.log('');
console.log('D3: no cron may take the brain cron\'s place');
/**
 * THE ACTUAL FAILURE MODE. The brain cron was not removed and left a gap; a different
 * cron was written into its position. D2 alone would catch a straight deletion. This
 * catches the swap, by asserting the brain cron coexists with everything else rather than
 * competing for a slot, and that nothing else claims its schedule.
 */
var atBrainSchedule = crons.filter(function (c) { return c && c.schedule === CRON_SCHEDULE; });
assert('nothing else is scheduled at "' + CRON_SCHEDULE + '", which would collide with it',
  atBrainSchedule.length === 1 && atBrainSchedule[0].path === CRON_PATH,
  JSON.stringify(atBrainSchedule));

/**
 * DELIBERATELY NOT ASSERTED: that some OTHER cron exists alongside this one.
 *
 * An earlier version required `crons.length > brainCrons.length`, which reads as "the brain
 * cron coexists" and actually means "at least one non-brain cron must exist". That pins
 * infrastructure this test has no business protecting: removing the orb meeting cron, a
 * legitimate and authorised change, would have failed a BRAIN invariant, and whoever hit it
 * would either be confused or delete this assertion along with the cron.
 *
 * Substitution is already caught without it. Pinning the exact path AND the exact schedule
 * means a cron that takes this one's place either removes the path (D2 fails) or claims the
 * schedule (the assertion above fails). The coexistence check added no coverage and added a
 * dependency on someone else's feature.
 */

/* Every cron path must resolve to a registered route, or it is scheduled to hit a 404
   forever and nothing will say so. This generalises the outage beyond the brain, and it
   uses the SAME comment-stripped source, so a commented-out registration cannot satisfy it
   here either. */
var unregistered = crons.map(function (c) { return String(c.path || ''); })
  .filter(function (p) { return p.indexOf('/api/') === 0; })
  .map(function (p) { return p.replace(/^\/api\//, '').split('?')[0]; })
  .filter(function (name) {
    return !new RegExp("['\"]" + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]\\s*:\\s*require").test(routeSrc)
      && !fs.existsSync(path.join(ROOT, 'api', name + '.js'))
      && !fs.existsSync(path.join(ROOT, 'api', name + '.py'));
  });
assert('every cron target resolves to a registered route or an api/ file',
  unregistered.length === 0,
  'scheduled against nothing: ' + JSON.stringify(unregistered));

console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('NOT PROVEN HERE: that the deployed function answers. This asserts what the');
console.log('repository declares, which is where the regression was introduced and where it');
console.log('is cheap to catch. Production reachability is proved by reading');
console.log('/api/brain-shadow with an operator token after a deploy.');
console.log('');
process.exit(failures ? 1 : 0);
