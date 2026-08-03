/**
 * brain-v2/test/corpus-quarantine.js — halted corpus prototypes fail closed.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

console.log('\n=== CORPUS PROTOTYPE QUARANTINE ===\n');

['adapter.js', 'opportunity.js'].forEach(function (name) {
  var target = path.join(__dirname, '..', 'corpus', name);
  var r = cp.spawnSync(process.execPath, ['-e', 'require(' + JSON.stringify(target) + ')'], {
    encoding: 'utf8'
  });
  var output = String(r.stderr || '') + String(r.stdout || '');
  assert(name + ' cannot be imported', r.status !== 0, 'exit=' + r.status);
  assert(name + ' fails for the declared quarantine reason', /HALTED_PROTOTYPE/.test(output), output.slice(0, 180));
});

var active = ['artifact-index.js', 'manifest.js', 'raw-claim-store.js', 'verify-source-unchanged.js'];
var bad = [];
active.forEach(function (name) {
  var src = fs.readFileSync(path.join(__dirname, '..', 'corpus', name), 'utf8');
  if (/require\([^)]*(adapter|opportunity)/.test(src)) bad.push(name);
});
assert('active corpus modules have no dependency on halted prototypes', bad.length === 0, bad.join(', '));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
