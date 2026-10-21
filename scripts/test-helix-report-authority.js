#!/usr/bin/env node
'use strict';

/**
 * test-helix-report-authority.js — the report may only state ALERT or NO ALERT
 * when the full authorization chain is coherent:
 *   usable Thing 0 evidence, exactly qualified, explicit permit, validated Thing 1.
 * Anything else abstains.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'helix-report.html'), 'utf8');

const start = html.indexOf('function _packServerResult(t1) {');
const end = html.indexOf('\nfunction ', start + 10);
assert.ok(start !== -1 && end > start, '_packServerResult not found');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(html.slice(start, end) +
  '\nthis._packServerResult = _packServerResult;', sandbox);

function response(overrides) {
  return Object.assign({
    cik: '42',
    entity_name: 'Fixture Corp',
    history_quarters: 40,
    latest_quarter: null,
    input_presence: { dc_coverage_quarters: 40, dl_coverage_quarters: 40 },
    fingerprint_status: { state: 'match', kernel_sha256: 'abc', lock_sha256: 'abc' },
    validation_status: 'validated',
    composite_score: 0.9,
    alert: false,
    raw_alert: false,
    thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: true }
  }, overrides);
}

function signal(overrides) {
  return sandbox._packServerResult(response(overrides)).validated_signal;
}

function narrative(overrides) {
  return signal(overrides).narrative_safe.join(' ');
}

// Coherent control: a validated no-alert verdict is permitted.
const control = signal({});
assert.strictEqual(control.abstained, false, 'coherent control abstained');
assert.strictEqual(control.available, true, 'coherent control was unavailable');
assert.strictEqual(control.alert, false, 'coherent control gained an alert');
assert.ok(/No alert/.test(narrative({})), 'coherent control did not state NO ALERT');

// Coherent alert control.
const alerting = signal({ alert: true });
assert.strictEqual(alerting.abstained, false);
assert.strictEqual(alerting.alert, true, 'coherent alert was suppressed');

// Missing Thing 0 evidence.
assert.strictEqual(signal({ thing0_eligibility: null }).abstained, true,
  'missing Thing 0 did not abstain');
assert.strictEqual(signal({ thing0_eligibility: null }).available, false);
assert.ok(/abstains/.test(narrative({ thing0_eligibility: null })),
  'missing Thing 0 did not state an abstention');

// Explicit false permission.
assert.strictEqual(signal({
  thing0_eligibility: { qualification_status: 'qualified', permits_thing1_use: false }
}).abstained, true, 'non-permitting Thing 0 did not abstain');

// Partial qualification with a stray permit.
assert.strictEqual(signal({
  thing0_eligibility: { qualification_status: 'partially_qualified', permits_thing1_use: true }
}).abstained, true, 'partial qualification did not abstain');

// Malformed evidence.
for (const t0 of ['qualified', {}, { qualification_status: 'qualified' },
  { qualification_status: 'qualified', permits_thing1_use: 'true' }]) {
  const s = signal({ thing0_eligibility: t0 });
  assert.strictEqual(s.abstained, true, 'malformed Thing 0 did not abstain: ' + JSON.stringify(t0));
  assert.strictEqual(s.available, false);
}

// Unvalidated Thing 1 with coherent Thing 0.
assert.strictEqual(signal({ validation_status: 'unvalidated_after_modification' }).abstained, true,
  'unvalidated Thing 1 did not abstain');

// Fingerprint mismatch downgrades an otherwise validated response.
assert.strictEqual(signal({
  fingerprint_status: { state: 'mismatch', kernel_sha256: 'new', lock_sha256: 'old' }
}).abstained, true, 'fingerprint mismatch did not abstain');

// Alert flags cannot leak through an abstention.
const missingWithAlert = signal({ thing0_eligibility: null, alert: true, raw_alert: true });
assert.strictEqual(missingWithAlert.abstained, true);
assert.strictEqual(missingWithAlert.alert, false, 'abstained row still reported an alert');

console.log('helix report authority: missing/false/partial/malformed Thing 0 and unvalidated Thing 1 abstain; coherent control publishes');
