'use strict';

/**
 * Bundle-closure pin — regression test for the 2026-09-22 incident:
 * handlers/commission-subscriber-lane.js required ../scripts/commission-subscriber-lane.cjs,
 * and vercel.json excludes scripts/** from the api function bundle
 * ("functions" config for the api glob, excludeFiles). Locally the require resolves; in the
 * lambda the file is absent, the catch-all died at boot, and EVERY /api/* route
 * (including the Stripe webhook money path) returned FUNCTION_INVOCATION_FAILED.
 *
 * This test statically proves the bundle entry points are self-contained:
 *   1. vercel.json still excludes scripts/** (the assumption being guarded),
 *   2. every handler registered in api/[...route].js exists on disk,
 *   3. every relative require in api/*.js and handlers/*.js resolves on disk,
 *   4. no such require resolves into scripts/** (or any excluded root file type).
 *
 * Note: lib/domain-authoring-pipeline.js requires ../scripts/_taxonomy-pilot/*.cjs
 * and is LATENT — nothing in the api bundle reaches it (verified by grep,
 * 2026-09-22). If a handler ever imports that lib, pin 4 fails as intended.
 */
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

var ROOT = path.join(__dirname, '..');
var vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

var fnConfig = vercel.functions && vercel.functions['api/**/*.js'];
assert.ok(fnConfig, 'vercel.json functions config for api/**/*.js exists');
assert.ok(String(fnConfig.excludeFiles || '').indexOf('scripts/**') !== -1,
  'guard: scripts/** remains excluded from the api bundle (if this changes, revisit the pin)');

function resolveLocal(fromFile, spec) {
  var base = path.resolve(path.dirname(fromFile), spec);
  var candidates = [base, base + '.js', base + '.cjs', base + '.mjs', base + '.json', path.join(base, 'index.js')];
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i]) && fs.statSync(candidates[i]).isFile()) return candidates[i];
  }
  return null;
}

function scan(file) {
  var src = fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments can mention require() descriptively
    .replace(/(^|\s)\/\/[^\n]*/g, '$1'); // line comments
  var problems = [];
  var re = /require\(\s*['"](\.[^'"]*)['"]\s*\)/g, m;
  while ((m = re.exec(src))) {
    if (m[1].indexOf('..') === 0 && m[1].length > 2 && /\.\.\./.test(m[1])) continue; // ellipsis placeholder
    var resolved = resolveLocal(file, m[1]);
    if (!resolved) {
      problems.push(path.basename(file) + ': unresolvable require ' + m[1]);
      continue;
    }
    var rel = path.relative(ROOT, resolved).split(path.sep).join('/');
    if (rel.indexOf('scripts/') === 0) {
      problems.push(path.basename(file) + ': requires ' + rel + ' — scripts/** is excluded from the api bundle');
    }
  }
  return problems;
}

var problems = [];

// Entry points: every file under api/ plus every handler it can reach.
var entries = fs.readdirSync(path.join(ROOT, 'api'))
  .filter(function (f) { return /\.js$/.test(f); })
  .map(function (f) { return path.join(ROOT, 'api', f); });
entries.push.apply(entries, fs.readdirSync(path.join(ROOT, 'handlers'))
  .filter(function (f) { return /\.js$/.test(f); })
  .map(function (f) { return path.join(ROOT, 'handlers', f); }));

entries.forEach(function (f) { problems = problems.concat(scan(f)); });

// Every handler registered in the catch-all HANDLERS map resolves.
var routeSrc = fs.readFileSync(path.join(ROOT, 'api', '[...route].js'), 'utf8');
var reg = /require\('(\.\.\/handlers\/[^']+)'\)/g, rm;
var registered = 0;
while ((rm = reg.exec(routeSrc))) {
  registered++;
  if (!resolveLocal(path.join(ROOT, 'api', '[...route].js'), rm[1])) {
    problems.push('HANDLERS registers unresolvable ' + rm[1]);
  }
}
assert.ok(registered > 50, 'sanity: the catch-all registers many handlers, got ' + registered);

assert.deepEqual(problems, [], 'bundle-closure violations:\n' + problems.join('\n'));

console.log('api bundle closure: ' + registered + ' registered handlers, ' + entries.length +
  ' entry files scanned, every require resolves, none reaches excluded scripts/**: PASS');
