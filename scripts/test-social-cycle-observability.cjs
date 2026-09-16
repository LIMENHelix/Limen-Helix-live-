#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var SocialCron = require('../handlers/social-cron.js');
var SocialCapability = require('../handlers/communication-social-capability.js');
var SocialPost = require('../lib/social-post.js');
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

var decisionHeld = SocialCron.emitOutcome('channel-decision', 'HELD', {
  reason: 'communication-b10-held',
  decisionBlockers: ['communication-b10-no-action-selected']
}, { domain: 'finance', selectedProgram: 'INVESTMENT_REVIEW' }, function () {});
assert.deepEqual(decisionHeld.reasons, { 'communication-b10-no-action-selected': 1 });
assert.equal(decisionHeld.rows[0].selectedProgram, 'INVESTMENT_REVIEW');
assert.equal(SocialCron.safeDecisionBlocker('communication-b10-brake-held:secret-shaped-value'),
  'communication-b10-brake-held');
assert.equal(SocialCron.safeDecisionBlocker('unknown-secret-shaped-value'), null);

assert.equal(SocialCapability.telemetryReason({
  reason: 'commissioning-no-effect-retry-cooldown',
  commissioning: { reason: 'commissioning-provider-authentication-failed', providerStatus: 401 }
}), 'commissioning-provider-authentication-http-401-retry-cooldown');
assert.equal(SocialCapability.telemetryReason({
  reason: 'commissioning-no-effect-retry-cooldown',
  commissioning: { reason: 'commissioning-provider-authentication-failed', providerStatus: 418 }
}), 'commissioning-no-effect-retry-cooldown');

var priorHandle = process.env.BLUESKY_HANDLE;
var priorPassword = process.env.BLUESKY_APP_PASSWORD;
process.env.BLUESKY_HANDLE = '  @LimenHelix.Bsky.Social  ';
process.env.BLUESKY_APP_PASSWORD = '  example-app-password\r\n';
assert.deepEqual(SocialPost.creds(), {
  handle: 'limenhelix.bsky.social', password: 'example-app-password'
});
if (priorHandle === undefined) delete process.env.BLUESKY_HANDLE;
else process.env.BLUESKY_HANDLE = priorHandle;
if (priorPassword === undefined) delete process.env.BLUESKY_APP_PASSWORD;
else process.env.BLUESKY_APP_PASSWORD = priorPassword;

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
  var selections = [];
  var selected = await SocialCron.selectSubjectCandidate([
    { domain: 'energy' }, { domain: 'finance' }, { domain: 'science' }
  ], {}, 1000, async function (_store, candidate) {
    selections.push(candidate.domain);
    return candidate.domain === 'finance'
      ? { status: 'RELEASED', decisionReceiptId: 'finance-release' }
      : { status: 'NO_ACTION', reason: 'subject-domain-immune-veto' };
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.post.domain, 'finance');
  assert.equal(selected.release.decisionReceiptId, 'finance-release');
  assert.deepEqual(selected.held, [{ domain: 'energy', reason: 'subject-domain-immune-veto' }]);
  assert.deepEqual(selections, ['energy', 'finance']);

  var allHeld = await SocialCron.selectSubjectCandidate([
    { domain: 'energy' }, { domain: 'science' }
  ], {}, 1000, async function (_store, candidate) {
    return { status: 'NO_ACTION', reason: candidate.domain + '-veto' };
  });
  assert.equal(allHeld.ok, false);
  assert.deepEqual(allHeld.held, [
    { domain: 'energy', reason: 'energy-veto' },
    { domain: 'science', reason: 'science-veto' }
  ]);

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
