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
/**
 * TOP-LEVEL ONLY, and exactly one. `ast.body` is scanned directly rather than walked
 * recursively: a depth-first walk stops at the FIRST `HANDLERS` anywhere, so a scoped or
 * dead `const HANDLERS` inside a helper would satisfy this while the router's real
 * top-level binding had been emptied or redirected. That is the outage again, wearing the
 * shape of a passing test. The router uses the program-level binding, so that is the only
 * one that counts, and two of them is an error rather than a choice.
 */
/**
 * THE ONE PLACE THAT DECIDES WHICH `HANDLERS` IS AUTHORITATIVE. Both the reader and the
 * removal helper call this, because having two answers to that question is what the last
 * defect was: the reader was fixed to bind top-level and the remover was left walking
 * recursively, so on a file with a legitimate nested `HANDLERS` the remover stripped the
 * wrong one and the control failed on healthy code.
 *
 * Returns the single program-level ObjectExpression, or null for zero, several, or a
 * non-object initializer. Fails closed: which binding the router uses is not a guess.
 */
function topLevelHandlers(ast) {
  var decls = [];
  ast.body.forEach(function (node) {
    if (node.type !== 'VariableDeclaration') return;
    node.declarations.forEach(function (d) {
      if (d.id && d.id.type === 'Identifier' && d.id.name === 'HANDLERS') decls.push(d);
    });
  });
  if (decls.length !== 1) return null;
  var init = decls[0].init;
  return (init && init.type === 'ObjectExpression') ? init : null;
}

function handlerEntries(src) {
  var ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' }); }
  catch (e) { return null; }
  var init = topLevelHandlers(ast);
  if (!init) return null;
  return init.properties.filter(function (p) { return p.type === 'Property'; })
    .map(function (p) {
      var key = p.key.type === 'Literal' ? p.key.value : p.key.name;
      var v = p.value;
      var isRequire = v && v.type === 'CallExpression' && v.callee &&
        v.callee.name === 'require' && v.arguments.length === 1 &&
        v.arguments[0].type === 'Literal' && typeof v.arguments[0].value === 'string';
      return { key: key, module: isRequire ? v.arguments[0].value : null };
    });
}
/**
 * Does the module a registration names actually resolve? `require.resolve` finds the file
 * without executing it, so a route pointing at a deleted module is caught here rather than
 * by the catch-all throwing at request time and taking every /api/* route with it.
 */
function moduleResolves(modulePath) {
  if (typeof modulePath !== 'string' || !modulePath) return false;
  try { require.resolve(path.join(ROOT, 'api', modulePath)); return true; }
  catch (e) { return false; }
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
/**
 * Structural removal from the SAME authoritative object the reader uses. Splices the
 * Property's own [start,end) range and leaves a benign entry, so it depends on no quote
 * style, whitespace, comma or line ending. A nested `HANDLERS` elsewhere in the file is
 * invisible here, which is the point: removing the wrong one made this control fail on
 * valid source.
 */
function withoutEntry(src, key) {
  var ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script' });
  var init = topLevelHandlers(ast);
  if (!init) return src;
  var range = null;
  init.properties.forEach(function (p) {
    if (p.type !== 'Property') return;
    var k = p.key && (p.key.type === 'Literal' ? p.key.value : p.key.name);
    if (k === key) range = [p.start, p.end];
  });
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
/* The dangerous variant: correctly named, correctly populated, and not the binding the
   router uses. A recursive walk would have accepted it while the real map was empty. */
assert('a correct HANDLERS NESTED inside a function does not register',
  !registers(handlerEntries(
    'function docs() { const HANDLERS = { ' + ENTRY + ' }; return HANDLERS; }\n' + synth('')),
    ROUTE_KEY, HANDLER_PATH),
  'only the top-level declaration the router binds may satisfy this');
assert('two top-level HANDLERS declarations are ambiguous and fail closed',
  handlerEntries(synth('  ' + ENTRY + ',') + '\n' + synth('')) === null,
  'which one the router binds is not something this test may guess');

/* A LEGITIMATE file that happens to contain a nested HANDLERS BEFORE the real one. The
   reader and the remover must both ignore it. When only the reader was fixed, the remover
   stripped the nested entry instead, and this control failed on healthy source. */
(function () {
  var legit = 'function docs() { const HANDLERS = { ' + ENTRY + ' }; return HANDLERS; }\n' +
    synth('  ' + ENTRY + ',\n  \'other\': require(\'../handlers/brain-cognition\'),');
  assert('a nested HANDLERS before the real one does not stop the real one registering',
    registers(handlerEntries(legit), ROUTE_KEY, HANDLER_PATH),
    'valid source must keep passing');
  var cut = withoutEntry(legit, ROUTE_KEY);
  assert('and structural removal takes the TOP-LEVEL entry, not the nested one',
    !registers(handlerEntries(cut), ROUTE_KEY, HANDLER_PATH),
    'removing the nested copy would leave the real registration intact and fail this control');
  assert('the spliced source still parses and keeps its other top-level entries',
    (handlerEntries(cut) || []).length === (handlerEntries(legit) || []).length,
    'a splice that broke the object would make every removal control vacuous');
})();

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
 * Vercel resolves a concrete function before the `[...route]` catch-all, so a dedicated
 * `brain-shadow` function would silently take the route over without touching HANDLERS.
 *
 * BOTH LAYOUTS COUNT. Flat `api/brain-shadow.<ext>` and directory-index
 * `api/brain-shadow/index.<ext>` map to the same `/api/brain-shadow` path, and this
 * repository already uses the directory-index form (`api/helix_app/index.py`). Checking
 * only the flat layout would leave the directory form as an unguarded way in.
 */
var SHADOW_EXTS = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'go', 'rb'];
function shadowFiles(dir, key) {
  var candidates = [];
  SHADOW_EXTS.forEach(function (e) {
    candidates.push(path.join(dir, key + '.' + e));            // api/<key>.<ext>
    candidates.push(path.join(dir, key, 'index.' + e));        // api/<key>/index.<ext>
  });
  return candidates.filter(function (p) { return fs.existsSync(p); });
}
var shadows = shadowFiles(path.join(ROOT, 'api'), ROUTE_KEY);
assert('no api/' + ROUTE_KEY + '.<ext> or api/' + ROUTE_KEY + '/index.<ext> shadows the registration',
  shadows.length === 0,
  'these would take precedence over HANDLERS: ' +
  JSON.stringify(shadows.map(function (p) { return path.relative(ROOT, p); })));

/* Controls: introduce real dedicated functions in a scratch api/ directory, in BOTH
   layouts, and prove the same lookup catches each. Written outside the repository so a
   control can never leave behind the file it tests for. */
(function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-shadow-invariant-'));
  var api = path.join(tmp, 'api');
  try {
    fs.mkdirSync(api);
    assert('control: an empty api/ directory reports no shadow',
      shadowFiles(api, ROUTE_KEY).length === 0);

    fs.writeFileSync(path.join(api, ROUTE_KEY + '.js'), 'module.exports = function () {};\n');
    fs.mkdirSync(path.join(api, ROUTE_KEY));
    fs.writeFileSync(path.join(api, ROUTE_KEY, 'index.js'), 'module.exports = function () {};\n');
    assert('control: flat .js AND directory index.js are BOTH detected',
      shadowFiles(api, ROUTE_KEY).length === 2,
      JSON.stringify(shadowFiles(api, ROUTE_KEY).map(function (p) { return path.relative(tmp, p); })));

    fs.writeFileSync(path.join(api, ROUTE_KEY + '.py'), 'def handler():\n    pass\n');
    fs.writeFileSync(path.join(api, ROUTE_KEY, 'index.py'), 'def handler():\n    pass\n');
    assert('control: the .py forms of both layouts are detected too, four in total',
      shadowFiles(api, ROUTE_KEY).length === 4,
      JSON.stringify(shadowFiles(api, ROUTE_KEY).map(function (p) { return path.relative(tmp, p); })));
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
 * AT MOST ONE EXECUTION-CAPABLE BRAIN CRON, ON ANY SCHEDULE.
 *
 * Comparing schedule strings only catches an identical expression. A second entry such as
 * `/api/brain-shadow?run=1&domain=energy` at `27 * * * 1` overlaps the pinned job every
 * Monday and passed. That matters beyond the guard: `handlers/brain-shadow.js` executes any
 * cron-authenticated request carrying `run=1`, and the runtime has NO LOCK (DELIVERY_STATE
 * correction 3: idempotency is sequential only), so two invocations read the same cursor and
 * race their state writes.
 *
 * Overlap analysis is deliberately not attempted. Without serialization, any second
 * execution-capable scheduled invocation is invalid regardless of when it fires.
 */
function isBrainExecutionCron(cronPath) {
  var u;
  try { u = new URL(String(cronPath || ''), 'https://cron.invalid'); }
  catch (e) { return false; }
  if (u.pathname !== '/api/' + ROUTE_KEY) return false;
  /* getAll: any `run=1` counts, whatever its position or what else is present. */
  return u.searchParams.getAll('run').indexOf('1') >= 0;
}
var execCrons = crons.filter(function (c) { return c && isBrainExecutionCron(c.path); });
assert('exactly one execution-capable ' + ROUTE_KEY + ' cron exists, on any schedule',
  execCrons.length === 1,
  'concurrent cycles would race the cursor: ' + JSON.stringify(execCrons));
assert('and that sole execution cron is the canonical path on the pinned schedule',
  execCrons.length === 1 && execCrons[0].path === CRON_PATH && execCrons[0].schedule === CRON_SCHEDULE,
  JSON.stringify(execCrons));

/* Controls: each adds a SECOND execution-capable entry that string comparison misses. */
[
  ['extra query parameter, different schedule',
   { path: '/api/' + ROUTE_KEY + '?run=1&domain=energy', schedule: '27 * * * 1' }],
  ['reordered query parameters, different schedule',
   { path: '/api/' + ROUTE_KEY + '?domain=energy&run=1', schedule: '5 * * * *' }]
].forEach(function (pair) {
  var withSecond = crons.concat([pair[1]]);
  assert('control: a second execution cron is rejected (' + pair[0] + ')',
    withSecond.filter(function (c) { return isBrainExecutionCron(c.path); }).length !== 1,
    JSON.stringify(pair[1]));
});
assert('control: a NON-execution brain cron (no run=1) is not counted',
  [{ path: '/api/' + ROUTE_KEY, schedule: '5 * * * *' }]
    .filter(function (c) { return isBrainExecutionCron(c.path); }).length === 0,
  'a read-only path cannot execute a cycle, so it is not a concurrency risk');

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
/**
 * EFFECTIVE HANDLER AUTHORITY, not a matching key. A key whose value is `null`, an
 * arbitrary expression, or a `require` of a deleted module satisfies "the key exists" and
 * still does not serve: the catch-all returns 404 for a falsy handler, or throws while
 * loading the missing module and takes every /api/* route with it. So the value is checked,
 * uniquely, and its module target must resolve.
 */
function cronTargetResolves(entries, key) {
  var hits = (entries || []).filter(function (e) { return e.key === key; });
  if (hits.length === 1 && moduleResolves(hits[0].module)) return true;
  /* A dedicated api/ function is an equally valid way to serve the path, in either the flat
     or the directory-index layout. Reuses the same lookup as the shadow check. */
  return shadowFiles(path.join(ROOT, 'api'), key).length > 0;
}
var unresolvable = crons.map(function (c) { return String(c.path || ''); })
  .filter(function (p) { return p.indexOf('/api/') === 0; })
  .map(function (p) { return p.replace(/^\/api\//, '').split('?')[0]; })
  .filter(function (name) { return !cronTargetResolves(ENTRIES, name); });
assert('every cron target resolves to a unique loadable handler or a dedicated api/ file',
  unresolvable.length === 0,
  'scheduled against nothing that serves: ' + JSON.stringify(unresolvable));

/* Controls: each of these has the KEY the cron names and still does not serve. */
assert('a null handler value does not satisfy a cron target',
  !cronTargetResolves(handlerEntries(synth("  'ghost-route': null,")), 'ghost-route'),
  'the catch-all returns 404 for a falsy handler');
assert('a non-require handler value does not satisfy a cron target',
  !cronTargetResolves(handlerEntries(synth("  'ghost-route': function () {},")), 'ghost-route'));
assert('a require of a MISSING module does not satisfy a cron target',
  !cronTargetResolves(handlerEntries(synth("  'ghost-route': require('../handlers/does-not-exist'),")),
    'ghost-route'),
  'this one throws at load and takes every /api/* route with it');
assert('a duplicated key does not satisfy a cron target',
  !cronTargetResolves(handlerEntries(synth(
    "  'ghost-route': require('../handlers/brain-shadow'),\n  'ghost-route': require('../handlers/brain-cognition'),")),
    'ghost-route'));
assert('control: a single valid require DOES satisfy it, so the checks above are not vacuous',
  cronTargetResolves(handlerEntries(synth('  ' + ENTRY + ',')), ROUTE_KEY));

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
