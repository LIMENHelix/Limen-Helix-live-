#!/usr/bin/env node
/**
 * Rebuild the treatment-discovery cube, propagate the append-only verification
 * ledger into that exact cube population, split the render artifacts, and
 * rebuild the research/investment inbox under one timestamp.
 *
 * This is deliberately one command. Running these builders on different days
 * produced three individually plausible stores that described different source
 * populations.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_AT = process.env.LIMEN_SNAPSHOT_AT || new Date().toISOString();
const SOURCE_COMMIT = git('rev-parse', 'HEAD');
const ENV = {
  ...process.env,
  LIMEN_SNAPSHOT_AT: SNAPSHOT_AT,
  LIMEN_SOURCE_COMMIT: SOURCE_COMMIT,
};

const steps = [
  ['scripts/build-treatment-discovery-cube.mjs'],
  ['scripts/compute-cross-domain-readout.mjs'],
  ['scripts/organ-claim-verification.mjs', '--reconcile-only'],
  ['scripts/split-cube-for-render.mjs'],
  ['scripts/build-epistemic-buckets.mjs'],
  ['scripts/build-master-inbox.mjs', '--apply'],
];

for (const args of steps) runNode(args);

const files = {
  cube: 'assets/data/treatment-discovery-cube.json',
  ledger: 'assets/data/audit/verification-ledger.json',
  summary: 'assets/data/treatment-discovery/_summary.json',
  inbox: 'assets/data/_master-inbox.json',
  unresolved: 'assets/data/audit/cube-unresolved-ids.json',
};
const cube = read(files.cube);
const ledger = read(files.ledger);
const summary = read(files.summary);
const inbox = read(files.inbox);
const unresolved = read(files.unresolved);

assertEqual('cube.builtAt', cube.builtAt, SNAPSHOT_AT);
assertEqual('summary.builtAt', summary.builtAt, SNAPSHOT_AT);
assertEqual('summary epistemic computedAt', summary.epistemicBuckets?.computedAt, SNAPSHOT_AT);
assertEqual('inbox.generatedAt', inbox.generatedAt, SNAPSHOT_AT);
assertEqual('unresolved.generatedAt', unresolved.generatedAt, SNAPSHOT_AT);
assertEqual('ledger reconciliation snapshotAt', ledger.reconciliation?.snapshotAt, SNAPSHOT_AT);
assertEqual('ledger reconciliation sourceCommit', ledger.reconciliation?.sourceCommit, SOURCE_COMMIT);

const activeLanes = Object.keys(inbox.queues || {}).sort();
assertEqual('active inbox lanes', JSON.stringify(activeLanes), JSON.stringify(['investment', 'research']));

const actualLedgerStats = tallyVerdicts(ledger.verdicts || {});
for (const [key, count] of Object.entries(actualLedgerStats.byVerdict)) {
  assertEqual(`ledger.stats.${key}`, ledger.stats?.[key] || 0, count);
}
assertEqual(
  'ledger.stats.byVerifier',
  JSON.stringify(sortObject(ledger.stats?.byVerifier || {})),
  JSON.stringify(sortObject(actualLedgerStats.byVerifier))
);

const report = {
  schemaVersion: 'discovery-store-reconciliation/1.0',
  generatedAt: SNAPSHOT_AT,
  sourceCommit: SOURCE_COMMIT,
  method: 'scripts/reconcile-discovery-stores.mjs',
  stores: {
    cube: {
      builtAt: cube.builtAt,
      cells: cube.cells.length,
      sha256: sha256(files.cube),
    },
    ledger: {
      lastEvidenceUpdatedAt: ledger.lastUpdatedAt,
      verdictRecords: Object.keys(ledger.verdicts || {}).length,
      byVerdict: actualLedgerStats.byVerdict,
      byVerifier: actualLedgerStats.byVerifier,
      reconciliation: ledger.reconciliation,
      sha256: sha256(files.ledger),
    },
    renderSummary: {
      totalCells: summary.totalCells,
      epistemicBuckets: summary.epistemicBuckets,
      sha256: sha256(files.summary),
    },
    inbox: {
      generatedAt: inbox.generatedAt,
      activeLanes,
      stats: inbox.stats,
      sha256: sha256(files.inbox),
    },
  },
  invariants: {
    oneSnapshotTimestamp: true,
    ledgerRollupEqualsRecords: true,
    archivedLedgerEvidencePreserved: true,
    onlyResearchAndInvestmentLanes: true,
  },
};

const reportPath = path.join(ROOT, 'assets/data/audit/discovery-store-reconciliation.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('');
console.log('=== DISCOVERY STORE RECONCILIATION ===');
console.log(`snapshot:             ${SNAPSHOT_AT}`);
console.log(`source commit:        ${SOURCE_COMMIT}`);
console.log(`current claims:       ${ledger.reconciliation.uniqueCurrentClaims}`);
console.log(`ledger matched:       ${ledger.reconciliation.matchedLedgerClaims}`);
console.log(`current pending:      ${ledger.reconciliation.currentClaimsWithoutLedger}`);
console.log(`ledger archived kept: ${ledger.reconciliation.archivedLedgerClaims}`);
console.log(`inbox ready:          ${inbox.stats.readyToFire}`);
console.log(`report:               ${path.relative(ROOT, reportPath)}`);

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: ENV,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} exited ${result.status}`);
  }
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sha256(relativePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex');
}

function tallyVerdicts(verdicts) {
  const byVerdict = {
    VERIFIED: 0,
    DISPUTED: 0,
    THEORETICAL: 0,
    UNVERIFIABLE: 0,
    FABRICATED: 0,
    PENDING: 0,
  };
  const byVerifier = {};
  for (const verdict of Object.values(verdicts)) {
    const state = verdict?.verdict || 'PENDING';
    const verifier = verdict?.verifier || 'unknown';
    byVerdict[state] = (byVerdict[state] || 0) + 1;
    byVerifier[verifier] = (byVerifier[verifier] || 0) + 1;
  }
  return { byVerdict, byVerifier };
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
