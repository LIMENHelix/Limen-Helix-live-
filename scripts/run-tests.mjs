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
 */

import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';

const filter = process.argv[2] || '';
const TIMEOUT_MS = 120000;

function tracked(...patterns) {
  return execFileSync('git', ['ls-files', '-z', ...patterns], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  }).split('\0').filter(Boolean);
}

const files = tracked('*.js', '*.cjs', '*.mjs')
  .filter(f => /(^|\/)(_?test[-_][^/]*|[^/]*[-_]test)\.(js|cjs|mjs)$/.test(f))
  .filter(f => !f.startsWith('assets/'))            // browser harnesses, need a DOM
  .filter(f => !filter || f.includes(filter))
  .sort();

if (!files.length) {
  console.error('no test files matched' + (filter ? ' "' + filter + '"' : ''));
  process.exit(2);
}

console.log('running ' + files.length + ' test file' + (files.length > 1 ? 's' : '') + '\n');

const passed = [], failed = [];
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

  if (ok) {
    passed.push(f);
    console.log('  PASS  ' + f + '  (' + ms + 'ms)');
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
console.log(passed.length + ' passed, ' + failed.length + ' failed, ' +
            ((Date.now() - t0) / 1000).toFixed(1) + 's');

if (failed.length) {
  console.log('failing: ' + failed.map(x => x.f).join(', '));
  process.exit(1);
}
