#!/usr/bin/env node
'use strict';

/* Regression checks for the diagnosis-surface audit's non-inflation rule. */
var cp = require('child_process');
var report = JSON.parse(cp.execFileSync(process.execPath,
  [require('path').join(__dirname, 'audit-diagnosis-surface.js')], { encoding: 'utf8' }));
var failures = [];
function check(label, value) {
  if (value) console.log('PASS ' + label);
  else { failures.push(label); console.log('FAIL ' + label); }
}
var agri = report.rows.find(function (r) { return r.domain === 'p2_agri'; });
var capped = report.rows.filter(function (r) { return r.digestStatus === 'CAP_REACHED'; });
check('twenty domain rows are reported', report.rows.length === 20);
check('agriculture has 106 issue entries', agri && agri.sourceIssueEntries === 106);
check('agriculture has 98 unique diagnosis ids', agri && agri.uniqueDiagnosisIds === 98);
check('agriculture duplicate groups are explicit', agri && agri.duplicateIdGroups === 7 && agri.duplicateEntries === 8);
check('agriculture remains below the 180 digest cap', agri && agri.digestStatus === 'SOURCE_SURFACE_BELOW_CAP');
check('agriculture directives are not treated as diagnoses', agri && agri.deepDirectiveCount === 500 && agri.deepDirectivesAreDiagnoses === false);
check('nineteen domains reach the working-set cap', capped.length === 19);
if (failures.length) { console.error('\n' + failures.length + ' failed: ' + failures.join('; ')); process.exitCode = 1; }
else console.log('\n7/7 passed');

