#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, '..', 'assets', 'data', 'deep', 'domain-authoring-admissions.json');
var j = JSON.parse(fs.readFileSync(file, 'utf8'));
var failures = 0, tests = 0;
function ok(name, value) {
  tests++;
  if (value) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name); }
}
ok('schema is versioned', j.schemaVersion === 'domain-authoring-admissions/1.0');
ok('inventory covers all 20 domains', j.domains === 20 && Array.isArray(j.rows) && j.rows.length === 20);
ok('only Energy has an existing authoring queue', j.existingQueueDomains === 1 && j.rows.filter(function (r) { return r.existingQueueTasks > 0; }).length === 1 && j.rows.filter(function (r) { return r.domain === 'energy'; })[0].existingQueueTasks === 156);
ok('the other 19 are explicit reconciliation admissions', j.reconciliationRequiredDomains === 19 && j.rows.filter(function (r) { return r.admissionStatus === 'REQUIRES_QUEUE_RECONCILIATION'; }).length === 19);
ok('generated directives are not silently counted as authoring tasks', j.rows.every(function (r) { return r.admissionStatus !== 'REQUIRES_QUEUE_RECONCILIATION' || r.existingQueueTasks === 0; }));
ok('all deep surfaces carry measured citation, monitoring, and target counts', j.rows.every(function (r) { return r.deepDirectiveCount > 0 && r.directiveCitationCount === r.deepDirectiveCount && r.directiveMonitoringCount === r.deepDirectiveCount && r.directiveTargetCount === r.deepDirectiveCount; }));
console.log(tests + '/' + tests + ' assertions; failures=' + failures);
if (failures) process.exitCode = 1;
