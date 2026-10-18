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
  assert.ok(source.includes('_thing1_not_permitted('),
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
check('Thing 2 failure preserves raw company inputs for Thing 0', function () {
  assert.ok(!source.includes('company_data, result, rows = {}, {}, []'),
    'Thing 2 failure still clears company_data');
  assert.ok(source.includes('result, rows = {}, []'),
    'Thing 2 failure should clear only result and rows');
});
check('Thing 0 uses common raw coverage, not Thing 2 feature rows', function () {
  assert.ok(source.includes('def _thing0_history_quarters('),
    'raw history helper missing');
  assert.ok(source.includes('thing0_history_quarters = _thing0_history_quarters(company_data)'),
    'raw history not derived from company_data');
  assert.ok(source.includes('history_quarters=thing0_history_quarters'),
    'Thing 0 gate not using raw history');
  assert.ok(source.includes('return min(lengths)'),
    'history gate must use common coverage across required series');
});
check('SEC extraction failure is preserved in the refusal', function () {
  assert.ok(source.includes('extraction_error: SEC EDGAR fetch failed.'),
    'extraction-error reason missing');
  assert.ok(source.includes('Unable to retrieve SEC filings for this CIK.'),
    'extraction-error narrative missing');
});
check('Thing 0 refusal is registered in the audit template map', function () {
  var audit = fs.readFileSync(
    path.join(ROOT, 'python_runtime', 'helix_app', 'audit', 'reconciliation_log.py'),
    'utf8'
  );
  assert.ok(audit.includes('Thing 0 did not qualify this company for Thing 1. No validated distress assessment is available.'),
    'refusal summary missing from template map');
  assert.ok(audit.includes('t1_thing0_not_permitted'),
    'stable template id missing');
});
check('Thing 1 execution status reflects the actual result', function () {
  assert.ok(source.includes('thing0_eligibility["thing1_execution_status"] = "executed"'),
    'executed status missing');
  assert.ok(source.includes('thing0_eligibility["thing1_execution_status"] = "unavailable"'),
    'unavailable status missing');
  assert.ok(source.includes('thing0_eligibility["thing1_execution_status"] = "blocked_by_thing1_runtime"'),
    'blocked status missing');
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
