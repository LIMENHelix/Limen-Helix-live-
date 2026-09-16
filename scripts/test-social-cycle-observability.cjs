#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var SocialCron = require('../handlers/social-cron.js');

var lines = [];
var summary = SocialCron.emitOutcome('subject-decision', 'HELD', {
  domain: 'finance',
  reason: 'subject-domain-cognition-missing-or-stale',
  text: 'customer content must never enter telemetry',
  token: 'secret-value-must-never-enter-telemetry'
}, {
  domain: 'finance',
  selectedProgram: 'PUBLIC_ARTICLE',
  text: 'source headline must never enter telemetry'
}, function (line) { lines.push(line); });

assert.equal(summary.cycle, 'communication-social-cycle');
assert.equal(summary.ok, true);
assert.deepEqual(summary.statuses, { HELD: 1 });
assert.deepEqual(summary.reasons, { 'subject-domain-cognition-missing-or-stale': 1 });
assert.equal(summary.rows[0].domain, 'finance');
assert.equal(summary.rows[0].stage, 'subject-decision');
assert.equal(summary.rows[0].selectedProgram, 'PUBLIC_ARTICLE');
assert.equal(summary.secretBearingFieldsIncluded, false);
assert.equal(lines.length, 1);
assert(!lines[0].includes('customer content'));
assert(!lines[0].includes('source headline'));
assert(!lines[0].includes('secret-value'));

var failed = SocialCron.emitOutcome('execution', 'FAILED', {
  reason: 'free form provider failure: https://example.com/?token=secret'
}, null, function () {});
assert.equal(failed.ok, false);
assert.equal(failed.rows[0].reason, 'noncanonical-value-redacted');

console.log('social cycle observability: release, hold, and failure reasons are visible without content or secrets');
