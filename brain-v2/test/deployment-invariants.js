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
var os = require('os');
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
 * PARSED, NOT PATTERN-MATCHED. Read out of the actual `HANDLERS` ObjectExpression via acorn:
 * a comment is not a Property node, a quoted snippet is a Literal value rather than a
 * `require` call, and a different object is a different node. Two earlier text-matching
 * versions each accepted one of those; every such evasion is a named control below.
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
/**
 * EXACTLY ONE effective registration, not "at least one". JavaScript keeps the LAST
 * duplicate property, so `.some()` would pass a file whose final `brain-shadow` entry points
 * somewhere else entirely. Duplicate authority is itself invalid, so the count is asserted.
 */
function registrationsFor(entries, key) {
  return (entries || []).filter(function (e) { return e.key === key; });
}
function registers(entries, key, handlerPath) {
  var hits = registrationsFor(entries, key);
  return hits.length === 1 && hits[0].module === handlerPath;
}
/* Structural removal: splice the parsed Property's own [start,end) range and put a benign
   entry in its place. No dependence on quote style, whitespace, commas or line endings. */
function withoutEntry(src, key) {
  var ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
  var range = null;
  (function walk(n) {
    if (!n || typeof n !== 'object' || range) return;
    if (n.type === 'VariableDeclarator' && n.id && n.id.name === 'HANDLERS' &&
        n.init && n.init.type === 'ObjectExpression') {
      n.init.properties.forEach(function (p) {
        var k = p.key && (p.key.type === 'Literal' ? p.key.value : p.key.name);
        if (k === key) range = [p.start, p.end];
      });
      return;
    }
    for (var i in n) {
      var v = n[i];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
    }
  })(ast);
  if (!range) return src;
  return src.slice(0, range[0]) + "'__control_removed__': require('../handlers/brain-cognition')" +
    src.slice(range[1]);
}
/* Synthetic HANDLERS sources, so the exotic controls do not depend on the real file's
   formatting at all. */
function synth(body) { return 'const HANDLERS = {\n' + body + '\n};\nmodule.exports = HANDLERS;\n'; }
var ENTRY = "'" + ROUTE_KEY + "': require('" + HANDLER_PATH + "')";

var ENTRIES = handlerEntries(routeRaw);
assert('the HANDLERS object parses and yields registrations',
  !!ENTRIES && ENTRIES.length > 0,
  'if this fails the extractor is broken and every assertion below is meaningless');

assert('HANDLERS registers ' + ROUTE_KEY + ' -> ' + HANDLER_PATH + ', exactly once',
  registers(ENTRIES, ROUTE_KEY, HANDLER_PATH),
  'found ' + registrationsFor(ENTRIES, ROUTE_KEY).length + ' entries :: ' +
  JSON.stringify(registrationsFor(ENTRIES, ROUTE_KEY)));

assert('the handler file it names exists',
  fs.existsSync(path.join(ROOT, 'handlers', 'brain-shadow.js')),
  'a registered route pointing at a missing file throws on require, and a throw in this ' +
  'module takes down EVERY /api/* route, not just this one');

console.log('');
console.log('D1b: the detector is independent of source formatting');
assert('double quotes and irregular whitespace still register',
  registers(handlerEntries(synth('  "' + ROUTE_KEY + '"  :   require( "' + HANDLER_PATH + '" ) ,')),
    ROUTE_KEY, HANDLER_PATH));
assert('and structural removal from the REAL file is detected',
  !registers(handlerEntries(withoutEntry(routeRaw, ROUTE_KEY)), ROUTE_KEY, HANDLER_PATH),
  'removal is by parsed [start,end) range, so it does not depend on matching a source string');
assert('the removal helper leaves the file parseable and otherwise intact',
  (handlerEntries(withoutEntry(routeRaw, ROUTE_KEY)) || []).length === ENTRIES.length,
  'if the splice broke the object every control below would be vacuously true');

console.log('');
console.log('D1c: neither a comment, a string, nor a foreign object counts');
assert('a COMMENTED-OUT registration does not register',
  !registers(handlerEntries(synth('  // ' + ENTRY + ',')), ROUTE_KEY, HANDLER_PATH));
assert('the snippet in a SINGLE-quoted string does not register',
  !registers(handlerEntries(synth("  'note': 'missing " + ENTRY.replace(/'/g, "\\'") + "',")),
    ROUTE_KEY, HANDLER_PATH));
assert('the snippet in a DOUBLE-quoted string does not register',
  !registers(handlerEntries(synth('  "note": "missing ' + ENTRY.replace(/"/g, '\\"') + '",')),
    ROUTE_KEY, HANDLER_PATH));
assert('the snippet in an UNRELATED object does not register',
  !registers(handlerEntries('const DOCS = { ' + ENTRY + ' };\n' + synth('')),
    ROUTE_KEY, HANDLER_PATH));

console.log('');
console.log('D1d: duplicate authority is invalid in either order');
/* JS keeps the LAST duplicate, so "correct then wrong" actually resolves to the wrong
   handler. "Wrong then correct" resolves correctly today and is still refused: two entries
   mean the effective route depends on ordering nobody is checking. */
assert('a correct entry followed by a WRONG duplicate fails',
  !registers(handlerEntries(synth('  ' + ENTRY + ',\n  \'' + ROUTE_KEY + "': require('../handlers/brain-cognition'),")),
    ROUTE_KEY, HANDLER_PATH));
assert('a wrong entry followed by a CORRECT duplicate also fails',
  !registers(handlerEntries(synth('  \'' + ROUTE_KEY + "': require('../handlers/brain-cognition'),\n  " + ENTRY + ',')),
    ROUTE_KEY, HANDLER_PATH));

console.log('');
console.log('D1e: no dedicated api/ function shadows the catch-all');
/**
 * Vercel resolves a concrete `api/<name>.<ext>` before the `[...route]` catch-all, so adding
 * `api/brain-shadow.js` would silently take the route over without touching HANDLERS. The
 * extensions checked cover the runtimes this repository actually uses (`.js`, `.py`) plus the
 * other Node/TS forms the platform accepts.
 */
var SHADOW_EXTS = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'go', 'rb'];
function shadowFiles(dir, key) {
  return SHADOW_EXTS.map(function (e) { return path.join(dir, key + '.' + e); })
    .filter(function (p) { return fs.existsSync(p); });
}
var shadows = shadowFiles(path.join(ROOT, 'api'), ROUTE_KEY);
assert('no api/' + ROUTE_KEY + '.<ext> file shadows the catch-all registration',
  shadows.length === 0,
  'these would take precedence over HANDLERS: ' +
  JSON.stringify(shadows.map(function (p) { return path.relative(ROOT, p); })));

/* Control: introduce a real dedicated function in a scratch api/ directory and prove the
   same lookup catches it. Written outside the repository so the control can never leave a
   file behind that would itself cause the outage it tests for. */
(function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-shadow-invariant-'));
  var api = path.join(tmp, 'api');
  try {
    fs.mkdirSync(api);
    assert('control: an empty api/ directory reports no shadow',
      shadowFiles(api, ROUTE_KEY).length === 0);
    fs.writeFileSync(path.join(api, ROUTE_KEY + '.js'), 'module.exports = function () {};\n');
    assert('control: a dedicated api/' + ROUTE_KEY + '.js IS detected as shadowing',
      shadowFiles(api, ROUTE_KEY).length === 1);
    fs.writeFileSync(path.join(api, ROUTE_KEY + '.py'), 'def handler():\n    pass\n');
    assert('control: a dedicated api/' + ROUTE_KEY + '.py is detected too',
      shadowFiles(api, ROUTE_KEY).length === 2);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch dir */ }
  }
})();


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
