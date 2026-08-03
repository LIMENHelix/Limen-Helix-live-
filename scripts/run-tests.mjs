#!/usr/bin/env node
/**
 * scripts/run-tests.mjs — run every tracked Node test, isolated, and report honestly.
 *
 *   node scripts/run-tests.mjs           run all
 *   node scripts/run-tests.mjs feed      run only tests whose path matches "feed"
 *
 * WHY A RUNNER AT ALL. There are 38 test files here and no way to run them as a
 * set. Individually they get run when someone remembers, which means a test can
 * sit broken for months without anyone noticing — and two of them currently are.
 *
 * THREE PROPERTIES THAT MATTER:
 *
 *   ISOLATED. Each file runs in its own Node process. These tests reach for
 *   module-level state, timers and env; sharing one process lets an early test
 *   poison a later one and the failure lands on the wrong file.
 *
 *   KEEPS GOING. A failure does not stop the run. The point of running the set
 *   is to learn how much is broken, not to stop at the first thing.
 *
 *   FAILS LOUDLY. Exits non-zero if anything failed. A validator that reports a
 *   problem and exits 0 is worse than no validator, because CI goes green on a
 *   red run. That exact bug exists in the sibling repo's _test_v2.js today.
 *
 * NOT INCLUDED: anything under assets/js — those are browser harnesses that
 * expect a DOM and are not runnable under bare Node.
 *
 * DISCOVERY IS TWO RULES, because two conventions are in use here. Most tests are
 * named for what they are (scripts/test-foo.js); brain-v2 instead puts plainly
 * named files in a test/ directory. Matching only the first convention meant the
 * six brain-v2 files — 123 assertions including the whole SPEC checklist — were
 * invisible to `npm test` from the day the runner was written. That is precisely
 * the failure this runner exists to prevent, sitting inside the runner itself.
 */

import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const filter = process.argv[2] || '';

/* 120s was the original cap, set when the slowest test took under a second. The
   brain-v2 loop acceptance replays 362 recorded hours and spawns two child
   processes for the restart proof: it measures 83s on this machine, which left
   1.4x headroom on a CI runner that is generally slower than a dev box. That is a
   flake waiting to happen, and a timeout flake reads as a real failure. The job
   itself carries timeout-minutes: 15, so a genuinely hung test is still caught. */
const TIMEOUT_MS = 300000;
const SLOW_MS = 30000;   // reported, so the margin above stays visible

function tracked(...patterns) {
  const out = execFileSync(
    'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', ...patterns],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  ).split('\0').filter(Boolean);
  return [...new Set(out)];   // a path can be listed by more than one selector
}

/* Named-for-what-they-are: scripts/test-foo.js, _test-foo.cjs, foo-test.js */
const NAMED = /(^|\/)(_?test[-_][^/]*|[^/]*[-_]test)\.(js|cjs|mjs)$/;
/* Living-in-a-test-directory: brain-v2/test/divergence.js */
const IN_TEST_DIR = /(^|\/)tests?\/[^/]+\.(js|cjs|mjs)$/;

/* Files that live with the tests but are NOT tests. Each needs a reason, because
   an unexplained exclusion is how coverage quietly shrinks. */
const NOT_STANDALONE = new Set([
  // Spawned by loop-acceptance.js with four argv parameters, to prove state
  // survives a real process death. Run bare it has no store path and exits 1.
  'brain-v2/test/restart-child.js'
]);

const files = tracked('*.js', '*.cjs', '*.mjs')
  .filter(f => NAMED.test(f) || IN_TEST_DIR.test(f))
  .filter(f => !f.startsWith('assets/'))            // browser harnesses, need a DOM
  .filter(f => !NOT_STANDALONE.has(f))
  .filter(f => !filter || f.includes(filter))
  .sort();

if (!files.length) {
  console.error('no test files matched' + (filter ? ' "' + filter + '"' : ''));
  process.exit(2);
}

console.log('running ' + files.length + ' test file' + (files.length > 1 ? 's' : '') + '\n');

/* Exit 77 is the conventional "test skipped" status. It is deliberately distinct
   from PASS: an unavailable external fixture proves nothing, but it also does not mean
   the code failed. The child must opt into this status explicitly. */
const SKIP_STATUS = 77;
const passed = [], skipped = [], failed = [];
const t0 = Date.now();

for (const f of files) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [f], {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' }
  });
  const ms = Date.now() - started;

  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  const ok = !timedOut && r.status === 0;
  const skip = !timedOut && r.status === SKIP_STATUS;

  if (ok) {
    passed.push(f);
    console.log('  PASS  ' + f + '  (' + ms + 'ms)' +
      (ms > SLOW_MS ? '  SLOW — ' + (ms / 1000).toFixed(0) + 's of the ' + (TIMEOUT_MS / 1000) + 's cap' : ''));
  } else if (skip) {
    const reason = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter(Boolean).slice(-1)[0] ||
      'external prerequisite unavailable';
    skipped.push({ f, reason });
    console.log('  SKIP  ' + f + '  (' + ms + 'ms) — ' + reason);
  } else {
    failed.push({ f, status: r.status, timedOut, out: ((r.stdout || '') + (r.stderr || '')).trim() });
    console.log('  FAIL  ' + f + '  (' + ms + 'ms' + (timedOut ? ', timed out' : ', exit ' + r.status) + ')');
  }
}

// Failure detail goes at the end, after the summary line has been established,
// so the shape of the run is readable before the noise.
if (failed.length) {
  console.log('\n' + '='.repeat(66));
  for (const x of failed) {
    console.log('\nFAILED  ' + x.f + (x.timedOut ? '  (timed out after ' + TIMEOUT_MS + 'ms)' : '  (exit ' + x.status + ')'));
    const lines = x.out.split('\n');
    // The last 18 lines are almost always the assertion and its stack head.
    console.log(lines.slice(-18).map(l => '    ' + l).join('\n'));
  }
}

console.log('\n' + '='.repeat(66));
console.log(passed.length + ' passed, ' + skipped.length + ' skipped, ' + failed.length + ' failed, ' +
            ((Date.now() - t0) / 1000).toFixed(1) + 's');

if (failed.length) {
  console.log('failing: ' + failed.map(x => x.f).join(', '));
  process.exit(1);
}
