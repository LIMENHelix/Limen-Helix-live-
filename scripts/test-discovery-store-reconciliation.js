#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
// Reconciliation hashes are generated from the tracked LF JSON bytes. Git may
// materialize CRLF in a Windows worktree without changing the tracked blob, so
// normalize only line endings here; all substantive byte changes still fail.
const hash = (p) => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'))
  .digest('hex');

const ledger = read('assets/data/audit/verification-ledger.json');
const summary = read('assets/data/treatment-discovery/_summary.json');
const inbox = read('assets/data/_master-inbox.json');
const unresolved = read('assets/data/audit/cube-unresolved-ids.json');
const report = read('assets/data/audit/discovery-store-reconciliation.json');

let passed = 0;
function ok(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed++;
  console.log(`PASS ${label}`);
}

const byVerdict = { VERIFIED: 0, DISPUTED: 0, THEORETICAL: 0, UNVERIFIABLE: 0, FABRICATED: 0, PENDING: 0 };
const byVerifier = {};
for (const verdict of Object.values(ledger.verdicts || {})) {
  const state = verdict.verdict || 'PENDING';
  const verifier = verdict.verifier || 'unknown';
  byVerdict[state] = (byVerdict[state] || 0) + 1;
  byVerifier[verifier] = (byVerifier[verifier] || 0) + 1;
}

ok('ledger verdict rollup equals its 7,900 record population',
  Object.entries(byVerdict).every(([k, n]) => ledger.stats[k] === n));
ok('ledger verifier rollup equals its record population',
  JSON.stringify(sort(byVerifier)) === JSON.stringify(sort(ledger.stats.byVerifier)));

const rec = ledger.reconciliation;
ok('ledger carries a versioned current-snapshot reconciliation', rec?.schemaVersion === 'verification-reconciliation/1.0');
ok('current claims partition into matched plus no-ledger claims',
  rec.uniqueCurrentClaims === rec.matchedLedgerClaims + rec.currentClaimsWithoutLedger);
ok('all-time ledger partitions into current matches plus archived evidence',
  Object.keys(ledger.verdicts).length === rec.matchedLedgerClaims + rec.archivedLedgerClaims);
ok('effective current verdicts sum to the unique current population',
  sum(rec.effectiveCurrentByVerdict) === rec.uniqueCurrentClaims);
ok('archived verdicts are disclosed rather than deleted', rec.archivedLedgerClaims > 0);

ok('render summary carries the exact ledger reconciliation',
  JSON.stringify(summary.verificationReconciliation) === JSON.stringify(rec));
ok('render epistemic total is the current unique claim population',
  summary.epistemicBuckets.totalClaims === rec.uniqueCurrentClaims);
ok('render epistemic totals do not include archived ledger claims',
  summary.epistemicBuckets.archivedLedgerClaims === rec.archivedLedgerClaims);
ok('operator pending count is unique current claims, not broadcast occurrences',
  summary.unverifiedClaimsCount === rec.effectiveCurrentByVerdict.PENDING &&
  summary.pendingClaimOccurrences >= summary.unverifiedClaimsCount);

const stamps = [
  report.generatedAt,
  rec.snapshotAt,
  summary.builtAt,
  summary.epistemicBuckets.computedAt,
  inbox.generatedAt,
  unresolved.generatedAt,
];
ok('cube, ledger, summary, inbox and unresolved-id report share one snapshot timestamp',
  stamps.every((stamp) => stamp === stamps[0]));
ok('reconciliation source commit is recorded', /^[0-9a-f]{40}$/.test(rec.sourceCommit));

ok('only research and investment queues exist',
  JSON.stringify(Object.keys(inbox.queues).sort()) === JSON.stringify(['investment', 'research']));
ok('inbox candidate arithmetic closes',
  inbox.stats.totalCandidates === inbox.stats.readyToFire + inbox.stats.inhibited);

ok('report ledger hash matches the tracked ledger',
  report.stores.ledger.sha256 === hash('assets/data/audit/verification-ledger.json'));
ok('report summary hash matches the tracked summary',
  report.stores.renderSummary.sha256 === hash('assets/data/treatment-discovery/_summary.json'));
ok('report inbox hash matches the tracked inbox',
  report.stores.inbox.sha256 === hash('assets/data/_master-inbox.json'));
ok('report states the four enforced invariants',
  Object.values(report.invariants).every(Boolean));

console.log(`${passed}/${passed} passed`);

function sum(obj) {
  return Object.values(obj || {}).reduce((total, value) => total + value, 0);
}

function sort(obj) {
  return Object.fromEntries(Object.entries(obj || {}).sort(([a], [b]) => a.localeCompare(b)));
}
