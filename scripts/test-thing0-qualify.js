/**
 * test-thing0-qualify.js — CI entry point for THING0-QUALIFY-1.
 *
 * Runs the Python qualification suite and pins the structural ordering:
 * Thing 0 is built before Thing 1, Thing 1 is gated on Thing 0 permits, and
 * the old validated-Thing1 qualification shortcut is gone.
 *
 * RUN: node scripts/test-thing0-qualify.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var { spawnSync } = require('child_process');

var ROOT = path.join(__dirname, '..');
var failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('  pass: ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL: ' + name + ' — ' + (e && e.message));
  }
}

console.log('thing0 qualification wrapper');

var python = process.env.PYTHON || 'python';
var result = spawnSync(python, [path.join(__dirname, 'test_thing0_qualify.py')], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 300000
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
check('python Thing 0 qualification suite passes', function () {
  assert.equal(result.status, 0,
    'python exited ' + result.status + (result.error ? ' (' + result.error.message + ')' : ''));
});

var source = fs.readFileSync(path.join(ROOT, 'python_runtime', 'helix_app', 'index.py'), 'utf8');
var typeSource = fs.readFileSync(path.join(ROOT, 'python_runtime', 'helix_app', 'thing0.py'), 'utf8');

var thing0Call = source.indexOf('thing0_eligibility = _build_thing0_section(');
var thing1Call = source.indexOf('validated_signal = thing1_pkg.score_validated(');
check('Thing 0 is built before Thing 1 in _build_safe_packet', function () {
  assert.ok(thing0Call !== -1, 'Thing 0 construction call not found');
  assert.ok(thing1Call !== -1, 'Thing 1 construction call not found');
  assert.ok(thing0Call < thing1Call, 'Thing 1 is constructed before Thing 0');
});
check('Thing 1 is gated on permits_thing1_use', function () {
  assert.ok(source.includes('if thing0_eligibility["permits_thing1_use"]:'),
    'missing Thing 0 gate around Thing 1');
  assert.ok(source.includes('_thing1_not_permitted(thing0_eligibility)'),
    'missing non-permitted Thing 1 refusal');
});
check('old validated-Thing1 qualification shortcut is gone', function () {
  assert.ok(!source.includes('validated_thing1_success_confirms_full_envelope'),
    'old qualification shortcut remains');
  assert.ok(source.includes('not_permitted_by_thing0'),
    'new non-permitted status missing');
});
check('Thing 0 builder has no Thing 1 parameter', function () {
  var match = source.match(/def _build_thing0_section\(([\s\S]*?)\) -> dict:/);
  assert.ok(match, '_build_thing0_section signature not found');
  assert.ok(!match[1].includes('validated_signal'), 'Thing 0 still takes validated_signal');
});
check('Thing 0 formula module exists and has no Thing 1 input', function () {
  assert.ok(typeSource.includes('def qualify('), 'qualify() missing');
  var match = typeSource.match(/def qualify\(([\s\S]*?)\) -> dict:/);
  assert.ok(match, 'qualify() signature not found');
  assert.ok(!match[1].includes('validated_signal'),
    'Thing 0 formula takes validated_signal');
});
check('JS brain-signals already evaluates Thing 0 before Thing 1', function () {
  var brain = fs.readFileSync(path.join(ROOT, 'handlers', 'brain-signals.js'), 'utf8');
  var t0 = brain.indexOf('F.thing0Eligible(c)');
  var t1 = brain.indexOf('F.thing1Distress(c');
  assert.ok(t0 !== -1, 'thing0Eligible call not found');
  assert.ok(t1 !== -1, 'thing1Distress call not found');
  assert.ok(t0 < t1, 'JS path evaluates Thing 1 before Thing 0');
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('thing0 qualification wrapper: all checks passed');
