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

var science = worker.researchMotorIdentity('research');
var medicine = worker.researchMotorIdentity('health');
var education = worker.researchMotorIdentity('education');
check('research runtime owner maps only to the Science product motor', science.productDomain === 'science' && science.lane === 'research-papers');
check('health runtime owner maps only to the Medicine product motor', medicine.productDomain === 'medicine' && medicine.lane === 'research-papers');
check('another owner cannot borrow the research product motor', worker.researchMotorIdentity('finance') === null);
check('Education has its own exact research product motor identity', education.productDomain === 'education' && education.ownerDomain === 'education' && education.lane === 'research-papers');

var motorHold = worker.researchMotorHoldResult(
  { cik: '456', recommendedLane: 'research' },
  { id: 'sel_research', ownerDomain: 'research' },
  { authorized: false, reason: 'domain-motor-not-external-ready', receiptId: 'pdmr_science' },
  science
);
check('product motor hold is non-billable and non-dispatching', motorHold.skipped === true && motorHold.billableAttempt === false && motorHold.motorStatus === 'HELD');
check('product motor hold preserves exact owner and receipt identities', motorHold.productDomain === 'science' && motorHold.ownerDomain === 'research' && motorHold.productMotorReceiptId === 'pdmr_science');

if (failures.length) { console.error('\n' + failures.length + ' failed: ' + failures.join('; ')); process.exitCode = 1; }
else console.log('\n11/11 passed');

