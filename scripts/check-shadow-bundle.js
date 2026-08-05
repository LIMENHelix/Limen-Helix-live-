#!/usr/bin/env node
/**
 * scripts/check-shadow-bundle.js — does the deployed function still have its code?
 *
 * `.vercelignore` was narrowed so `brain-v2/bind`, `core` and `kernel` ship while the
 * fixtures, tests, corpus tooling and design documents do not. That is exactly the kind of
 * change that looks right and fails in production: the function boots, hits a `require`
 * for a file that was never uploaded, and every route in the Hono catch-all dies with it.
 *
 * So the require closure of the shadow handler is computed for real and checked against
 * the ignore rules, rather than eyeballed.
 */
'use strict';
var path = require('path');
var fs = require('fs');
var ROOT = path.resolve(__dirname, '..');

require(path.join(ROOT, 'handlers', 'brain-shadow.js'));

/**
 * THE BINDERS LOAD LAZILY, inside runDomain, so requiring the handler alone does not pull
 * them in. That is the more dangerous gap of the two: a blocked handler fails at boot and
 * is obvious, while a blocked binder fails mid-cycle, on a cron, in production, days
 * later. Every one of the twenty is loaded here so the closure is the real one.
 */
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
REG.PRODUCT_KEYS.forEach(function (p) {
  require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js'));
});

var files = Object.keys(require.cache)
  .filter(function (f) { return f.indexOf(ROOT) === 0 && f.indexOf(path.join(ROOT, 'node_modules')) !== 0; })
  .map(function (f) { return path.relative(ROOT, f).split(path.sep).join('/'); })
  .sort();

var pats = fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8')
  .split(/\r?\n/)
  .map(function (l) { return l.trim(); })
  .filter(function (l) { return l && l[0] !== '#'; });

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function ignored(f) {
  return pats.some(function (p) {
    if (p.slice(-1) === '/') return f === p.slice(0, -1) || f.indexOf(p) === 0;
    if (p.indexOf('*') >= 0) {
      var re = new RegExp('^' + escapeRe(p).replace(/\\\*/g, '[^/]*') + '$');
      return re.test(f);
    }
    return f === p || f.indexOf(p + '/') === 0;
  });
}

var blocked = files.filter(ignored);

console.log('');
console.log('SHADOW BUNDLE CHECK');
console.log('  repo modules required by handlers/brain-shadow.js : ' + files.length);
files.forEach(function (f) { console.log('    ' + (ignored(f) ? 'BLOCKED  ' : 'ships    ') + f); });
console.log('');

/* And the converse: the heavy things must still be excluded. */
var mustExclude = ['brain-v2/fixtures/energy-recorder.json', 'brain-v2/test/domains.js',
  'brain-v2/SPEC.md', 'brain-v2/run.js'];
var leaking = mustExclude.filter(function (f) { return fs.existsSync(path.join(ROOT, f)) && !ignored(f); });

console.log('  required-but-blocked (must be 0) : ' + blocked.length);
blocked.forEach(function (f) { console.log('    ' + f); });
console.log('  heavy-but-shipping  (must be 0) : ' + leaking.length);
leaking.forEach(function (f) { console.log('    ' + f); });
console.log('');

if (blocked.length || leaking.length) {
  console.error('FAIL: the deploy boundary does not match what the function needs.');
  process.exit(1);
}
console.log('PASS: every module the handler requires ships, and the corpora/tests/docs do not.');
