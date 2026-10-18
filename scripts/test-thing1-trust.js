/**
 * test-thing1-trust.js — CI entry point for the Thing 1 trust regression suite.
 *
 * The substantive checks live in scripts/test_thing1_trust.py so they can use
 * Python fixtures without the Node harness importing the scientific stack. This
 * wrapper makes the suite visible to scripts/run-tests.mjs and CI.
 *
 * RUN: node scripts/test-thing1-trust.js
 */
'use strict';

var assert = require('assert');
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

console.log('thing1 trust wrapper');

var python = process.env.PYTHON || 'python';
var result = spawnSync(python, [path.join(__dirname, 'test_thing1_trust.py')], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 300000
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

check('python Thing1 trust suite passes', function () {
  assert.equal(result.status, 0,
    'python exited ' + result.status + (result.error ? ' (' + result.error.message + ')' : ''));
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('thing1 trust wrapper: all checks passed');
