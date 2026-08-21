#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const audit = read('assets/data/audit/unsupported-kernel-claims.json');
let passed = 0;
function ok(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed++;
  console.log(`PASS ${label}`);
}

ok('archive has the versioned schema', audit.schemaVersion === 'unsupported-kernel-claims/1.0');
ok('archive identifies the source commit', /^[0-9a-f]{40}$/.test(audit.sourceCommit));
ok('all 111 unsupported verdicts are preserved', audit.totals.portals === 111 && audit.records.length === 111);
ok('all six formerly active alerts are disclosed', audit.totals.activeAlerts === 6);
ok('dependent bridge and lane totals are disclosed',
  audit.totals.bridgeMatches === 141 &&
  audit.totals.investmentOutputs === 106 &&
  audit.totals.researchOutputs === 106);

let activeTargets = 0;
let quarantinedAlerts = 0;
let quarantinedInvestment = 0;
let quarantinedResearch = 0;
for (const record of audit.records) {
  const portal = read(record.path);
  const fh = portal.financialHealth || {};
  if (!portal.cik && /^validated$/i.test(String(fh.validationStatus || '')) &&
      typeof fh.compositeScore === 'number') activeTargets++;
  if (fh.alert === true) quarantinedAlerts++;
  quarantinedInvestment += Array.isArray(portal.engineOutputs?.investment) ? portal.engineOutputs.investment.length : 0;
  quarantinedResearch += Array.isArray(portal.engineOutputs?.research) ? portal.engineOutputs.research.length : 0;

  ok(`${record.slug}: original verdict preserved`,
    record.originalClaim.financialHealth.validationStatus === 'validated' &&
    typeof record.originalClaim.financialHealth.compositeScore === 'number');
  ok(`${record.slug}: active verdict refused`,
    portal.kernelStatus === 'PROVENANCE_UNVERIFIED' &&
    portal.helixReportMode === 'unavailable' &&
    portal.helixReportUrl === null &&
    fh.validationStatus === 'unavailable' &&
    fh.envelopeStatus === 'PROVENANCE_UNVERIFIED' &&
    fh.compositeScore === null && fh.alert === false &&
    fh.dominantPhase === null && fh.distressBand === 'unknown');
  ok(`${record.slug}: dependent bridge and outputs refused`,
    Array.isArray(portal.bridgeReadings?.matched) &&
    portal.bridgeReadings.matched.length === 0 &&
    Array.isArray(portal.engineOutputs?.investment) && portal.engineOutputs.investment.length === 0 &&
    Array.isArray(portal.engineOutputs?.research) && portal.engineOutputs.research.length === 0 &&
    portal.engineOutputs.totalArtifacts === 0 &&
    portal.engineOutputs.artifactsByLane?.investment === 0 &&
    portal.engineOutputs.artifactsByLane?.research === 0);
  ok(`${record.slug}: quarantine points to the evidence archive`,
    fh.quarantine?.reasonCode === 'KERNEL_PROVENANCE_UNVERIFIED' &&
    fh.quarantine?.auditPath === 'assets/data/audit/unsupported-kernel-claims.json');
}

ok('no unsupported validated verdict remains active', activeTargets === 0);
ok('no quarantined alert remains active', quarantinedAlerts === 0);
ok('no quarantined investment or research artifact remains active',
  quarantinedInvestment === 0 && quarantinedResearch === 0);

// Prove that the sourceCommit pointer really contains the full original files,
// rather than treating a hash string as evidence. Three distinct shapes cover
// a normal US filer, an active-alert record, and a foreign/no-report record.
for (const slug of ['amd', 'catalent', 'airbus']) {
  const record = audit.records.find((r) => r.slug === slug);
  const original = JSON.parse(execFileSync('git', ['show', `${audit.sourceCommit}:${record.path}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  }));
  ok(`${slug}: full original file resolves at source commit`,
    JSON.stringify(original.financialHealth) === JSON.stringify(record.originalClaim.financialHealth) &&
    original.kernelStatus === record.originalClaim.kernelStatus &&
    original.helixReportMode === record.originalClaim.helixReportMode &&
    original.helixReportUrl === record.originalClaim.helixReportUrl);
}

const auditSource = fs.readFileSync(path.join(ROOT, 'scripts/audit-corpus-vitals.mjs'), 'utf8');
ok('vitals audit no longer equates a missing first-class CIK with impossible scoring',
  !auditSource.includes('the kernel cannot have scored them') &&
  auditSource.includes('provenance cannot be verified'));

const uiSource = fs.readFileSync(path.join(ROOT, 'assets/js/company-portal-ui.js'), 'utf8');
ok('company portal refuses the invalid report fallback for quarantined records',
  uiSource.includes("co.helixReportMode !== 'unavailable'") &&
  uiSource.includes('Validated phase analysis unavailable'));

console.log(`${passed}/${passed} passed`);
