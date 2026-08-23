#!/usr/bin/env node
'use strict';

var worker = require('../handlers/limen-worker-autofire.js');
var failures = [];
function check(label, value) {
  if (value) console.log('PASS ' + label);
  else { failures.push(label); console.log('FAIL ' + label); }
}

var result = worker.domainOutwardHoldResult(
  { cik: '123', recommendedLane: 'research' },
  {
    id: 'sel_hold',
    reasons: ['brain_b10_did_not_release_command'],
    criticDecision: { outcome: 'released', released: { kind: 'no_action' } }
  }
);

check('critic hold is skipped, not successful', result.skipped === true && result.ok === false);
check('critic hold is never billable', result.billableAttempt === false);
check('critic hold keeps its review reason', result.reason === 'domain-outward-held' && result.detail.indexOf('brain_b10') >= 0);
check('critic hold preserves selection identity', result.selectionId === 'sel_hold');
check('critic hold records the selected no-action kind', result.decisionKind === 'no_action');
check('critic hold remains a motor hold', result.motorStatus === 'HELD');

if (failures.length) { console.error('\n' + failures.length + ' failed: ' + failures.join('; ')); process.exitCode = 1; }
else console.log('\n6/6 passed');

