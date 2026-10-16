#!/usr/bin/env node
/**
 * substantive-data-change.mjs
 *
 * Gate for the discovery-store-refresh workflow. The reconcile pipeline stamps
 * a fresh snapshot timestamp into every artifact it writes, so a no-op rebuild
 * ALWAYS produces a git diff. Without this gate, the scheduled workflow would
 * commit timestamp churn to main every week and open noise in the history.
 *
 * Compares each changed tracked file in the reconcile output set against its
 * HEAD version with churn keys removed (builtAt / computedAt / generatedAt /
 * snapshotAt / lastBuiltAt / lastVerifiedAt / checkedAt / lastUpdatedAt /
 * sourceCommit). If every diff is timestamp-only, the refresh is a no-op.
 *
 * New or deleted files are substantive by definition. Unparseable JSON fails
 * safe (substantive).
 *
 * Output: human log + final line "VERDICT: timestamp-only|substantive|no-changes".
 * In CI (GITHUB_OUTPUT set) also writes substantive=true|false for step if:.
 * Exit code is always 0 on success; the verdict line is the contract.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCOPES = [
  'assets/data/treatment-discovery',
  'assets/data/audit/verification-ledger.json',
  'assets/data/audit/binding-fidelity-report.json',
  'assets/data/audit/cube-unresolved-ids.json',
  'assets/data/audit/discovery-store-reconciliation.json',
  'assets/data/_master-inbox.json',
];

const CHURN_KEYS = new Set([
  'builtAt',
  'computedAt',
  'generatedAt',
  'snapshotAt',
  'lastBuiltAt',
  'lastVerifiedAt',
  'checkedAt',
  'lastUpdatedAt',
  'sourceCommit',
  // cube build stamps retrieval time into each cell's sourceProvenance
  'retrievedAt',
  // reconciliation report hashes file CONTENT, so the hashes churn whenever
  // any embedded timestamp does — even with zero substantive change. Real
  // changes are still caught by comparing the underlying files directly.
  'sha256',
]);

function stripChurn(value) {
  if (Array.isArray(value)) return value.map(stripChurn);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (CHURN_KEYS.has(key)) continue;
      out[key] = stripChurn(value[key]);
    }
    return out;
  }
  return value;
}

const stable = (value) => JSON.stringify(stripChurn(value));

function headBlob(file) {
  try {
    return execSync(`git show HEAD:"${file}"`, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
  } catch {
    return null; // not in HEAD → new file
  }
}

// NOTE: do NOT trim() this output — the first line's leading status space is
// significant (" M file"); trimming the whole buffer would shift it and
// corrupt the first path.
const status = execSync(`git status --porcelain=v1 -- ${SCOPES.map((s) => `"${s}"`).join(' ')}`, {
  cwd: ROOT,
  encoding: 'utf8',
});

const lines = status.split('\n').filter((l) => l.length > 0);

if (lines.length === 0) {
  console.log('VERDICT: no-changes');
  emit(false);
  process.exit(0);
}

let substantive = [];
let timestampOnly = [];

for (const line of lines) {
  const xy = line.slice(0, 2);
  const file = line.slice(3).trim();
  if (!file.endsWith('.json')) { substantive.push(file + ' (non-json)'); continue; }
  if (xy.includes('D')) { substantive.push(file + ' (deleted)'); continue; }
  if (xy.includes('A') || xy.includes('?')) { substantive.push(file + ' (new)'); continue; }

  const oldRaw = headBlob(file);
  if (oldRaw === null) { substantive.push(file + ' (not in HEAD)'); continue; }
  const newRaw = fs.readFileSync(path.join(ROOT, file), 'utf8');

  let oldNorm, newNorm;
  try {
    oldNorm = stable(JSON.parse(oldRaw));
    newNorm = stable(JSON.parse(newRaw));
  } catch {
    substantive.push(file + ' (unparseable)');
    continue;
  }
  (oldNorm === newNorm ? timestampOnly : substantive).push(file);
}

console.log(`timestamp-only churn: ${timestampOnly.length} file(s)`);
for (const f of timestampOnly) console.log(`  ~ ${f}`);
console.log(`substantive changes:  ${substantive.length} file(s)`);
for (const f of substantive) console.log(`  ± ${f}`);

const isSubstantive = substantive.length > 0;
console.log(`VERDICT: ${isSubstantive ? 'substantive' : 'timestamp-only'}`);
emit(isSubstantive);

function emit(value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `substantive=${value}\n`);
  }
}
