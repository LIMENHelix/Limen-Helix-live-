#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var SocialCron = require('../handlers/social-cron.js');
var heartbeat = require('../lib/heartbeat.js');

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

var ambiguous = SocialCron.emitOutcome('execution', 'DISPATCHING', {
  reason: 'provider-outcome-ambiguous'
}, { domain: 'law', selectedProgram: 'PUBLIC_ARTICLE' }, function () {});
assert.deepEqual(ambiguous.statuses, { DISPATCHING: 1 });
assert.equal(ambiguous.rows[0].domain, 'law');
assert.equal(ambiguous.rows[0].selectedProgram, 'PUBLIC_ARTICLE');

var vetoed = SocialCron.emitOutcome('valve', 'HELD', {
  reason: 'maintenance'
}, null, function () {});
assert.deepEqual(vetoed.statuses, { HELD: 1 });
assert.equal(vetoed.rows[0].stage, 'valve');
assert.equal(vetoed.rows[0].reason, 'maintenance');
assert.equal(vetoed.secretBearingFieldsIncluded, false);

(async function () {
  var observed = null;
  var called = await heartbeat.observeVeto({
    onVeto: function (gate, req) { observed = { gate: gate, req: req }; }
  }, { open: false, reason: 'maintenance' }, { query: { key: 'must-not-be-logged' } });
  assert.equal(called, true);
  assert.equal(observed.gate.reason, 'maintenance');

  var swallowed = await heartbeat.observeVeto({
    onVeto: function () { throw new Error('observer failed'); }
  }, { open: false }, {});
  assert.equal(swallowed, false);

  console.log('social cycle observability: release, hold, veto, and failure reasons are visible without content or secrets');
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
