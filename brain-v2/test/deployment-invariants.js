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
 * SUBSTITUTION IS THE FAILURE MODE, NOT DELETION. The cron was not removed and left a gap;
 * a different cron took its array slot, so the cron COUNT never changed. Two assertions
 * catch that independently: the exact path `/api/brain-shadow?run=1` must be present, and
 * the exact schedule `27 * * * *` must belong to it and to nothing else. Either one alone
 * detects the swap.
 *
 * An earlier version also required a non-brain cron to exist, described as asserting
 * "coexistence". That assertion is GONE. It pinned somebody else's infrastructure: removing
 * the orb meeting cron, an authorised change, would have failed a BRAIN invariant, and
 * whoever hit it would have deleted this test rather than debugged it. It added no coverage
 * the two checks above do not already give.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Deliberately NOT a network test. It asserts what the repository declares, so it fails in
 * CI on the pull request that would cause the outage, not hours afterwards in production.
 */

'use strict';

var fs = require('fs');
var path = require('path');
/* Already a dependency: scripts/check-repository.mjs parses every tracked JS with it. */
var acorn = require('acorn');

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
 * THIS CHECK TOOK THREE ATTEMPTS, and the first two each looked sufficient while accepting
 * a form of the thing they guard:
 *
 *   v1  matched the raw file text      -> WITHDRAWN. A COMMENTED-OUT registration satisfied
 *                                         it, and v1 reported all 9 of its then-assertions
 *                                         passing while the endpoint would answer 404
 *   v2  stripped comments and template literals but searched the WHOLE FILE and left
 *       ordinary quoted strings intact -> the exact snippet inside a single- or
 *                                         double-quoted string, or in an unrelated
 *                                         object, would satisfy it
 *   v3  parses the file and reads the actual HANDLERS ObjectExpression
 *
 * The failures share one shape: each version asserted something ADJACENT to the property
 * instead of the property. Every one of those evasions is now a named negative control, so
 * the next weakening has to break a test rather than slip through.
 *
 * PARSED, NOT PATTERN-MATCHED. `acorn` is already a dependency (scripts/check-repository.mjs
 * parses every tracked JS with it), so the registration is read out of the actual
 * `HANDLERS` ObjectExpression instead of being inferred from text. A comment is not a
 * Property node, a quoted string is a Literal value rather than a `require` call, and an
 * object that is not HANDLERS is a different node entirely, so all four evasions below stop
 * being special cases and become structurally impossible.
 *
 * Returns null when HANDLERS cannot be found, which fails closed.
 */
function handlerEntries(src) {
  var ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' }); }
  catch (e) { return null; }
  var found = null;
  (function walk(n) {
    if (!n || typeof n !== 'object' || found) return;
    if (n.type === 'VariableDeclarator' && n.id && n.id.name === 'HANDLERS' &&
        n.init && n.init.type === 'ObjectExpression') {
      found = n.init.properties.filter(function (p) { return p.type === 'Property'; })
        .map(function (p) {
          var key = p.key.type === 'Literal' ? p.key.value : p.key.name;
          var v = p.value;
          var isRequire = v && v.type === 'CallExpression' && v.callee &&
            v.callee.name === 'require' && v.arguments.length === 1 &&
            v.arguments[0].type === 'Literal';
          return { key: key, module: isRequire ? v.arguments[0].value : null };
        });
      return;
    }
    for (var k in n) {
      var v = n[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  })(ast);
  return found;
}
function registers(entries, key, handlerPath) {
  if (!entries) return false;
  return entries.some(function (e) { return e.key === key && e.module === handlerPath; });
}

var ENTRIES = handlerEntries(routeRaw);
assert('the HANDLERS object parses and yields registrations',
  !!ENTRIES && ENTRIES.length > 0,
  'if this fails the extractor is broken and every assertion below is meaningless');

assert('the HANDLERS map registers ' + ROUTE_KEY + ' -> ' + HANDLER_PATH,
  registers(ENTRIES, ROUTE_KEY, HANDLER_PATH),
  'without this line the endpoint answers 404 "route not handled by Hono entry" and the ' +
  'cron cannot execute a cycle, while every brain file stays correct and every test passes');

/* ── the four ways a text-matching check WOULD have passed ───────────────────
   Each builds a source that LACKS the registration but CONTAINS the exact snippet, and
   asserts the parser still says no. Without these, "structural" is a word rather than a
   property; v1 and v2 of this test each passed one of them. */
var SNIPPET = "'" + ROUTE_KEY + "': require('" + HANDLER_PATH + "')";
var REAL_LINE = "  '" + ROUTE_KEY + "': require('" + HANDLER_PATH + "'),\n";
function withoutRealEntry(extra) {
  var stripped = routeRaw.replace(REAL_LINE, '');
  return extra ? stripped.replace('const HANDLERS = {', 'const HANDLERS = {\n' + extra) : stripped;
}
assert('control: removing the entry outright is detected',
  !registers(handlerEntries(withoutRealEntry('')), ROUTE_KEY, HANDLER_PATH));
assert('control: a COMMENTED-OUT registration does not satisfy it',
  !registers(handlerEntries(withoutRealEntry('  // ' + SNIPPET + ',\n')), ROUTE_KEY, HANDLER_PATH));
assert('control: the snippet in a SINGLE-quoted string does not satisfy it',
  !registers(handlerEntries(withoutRealEntry(
    "  'note': 'missing " + SNIPPET.replace(/'/g, "\\'") + "',\n")), ROUTE_KEY, HANDLER_PATH));
assert('control: the snippet in a DOUBLE-quoted string does not satisfy it',
  !registers(handlerEntries(withoutRealEntry(
    '  "note": "missing ' + SNIPPET.replace(/"/g, '\\"') + '",\n')), ROUTE_KEY, HANDLER_PATH));
assert('control: the snippet in an UNRELATED object does not satisfy it',
  !registers(handlerEntries(withoutRealEntry('') + '\nconst DOCS = { ' + SNIPPET + ' };\n'),
    ROUTE_KEY, HANDLER_PATH),
  'scoping to the HANDLERS node is what makes this fail; a whole-file search would pass');
assert('control: the controls are not vacuous, the unmodified file still registers it',
  registers(handlerEntries(routeRaw), ROUTE_KEY, HANDLER_PATH),
  'if this fails, withoutRealEntry() is mangling the file and every control above is empty');

assert('and the handler file it names actually exists',
  fs.existsSync(path.join(ROOT, 'handlers', 'brain-shadow.js')),
  'a registered route pointing at a missing file throws on require, and a throw in this ' +
  'module takes down EVERY /api/* route, not just this one');

/* Proves the matcher is not vacuous. If the regex were wrong it would report a missing
   route on a healthy file, or worse, pass on anything. */

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
   reads the SAME parsed HANDLERS entries, so a cron target that appears only inside a
   comment or a string cannot satisfy it here either. */
function isRegistered(entries, key) {
  return !!entries && entries.some(function (e) { return e.key === key; });
}
var unregistered = crons.map(function (c) { return String(c.path || ''); })
  .filter(function (p) { return p.indexOf('/api/') === 0; })
  .map(function (p) { return p.replace(/^\/api\//, '').split('?')[0]; })
  .filter(function (name) {
    return !isRegistered(ENTRIES, name)
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
