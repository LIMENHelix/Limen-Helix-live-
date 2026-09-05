#!/usr/bin/env node
/**
 * Persist the portal K3 relational-topology fallback.
 *
 * K3 is deliberately not a second financial-health model. It reports whether
 * the authored functional network is sufficiently complete to be observed as
 * a relational map. It emits no P0-P10 phase, composite, alert, or validation
 * claim, and only targets portals with neither K1 nor K2.
 *
 *   node scripts/persist-k3-readings.mjs --dry-run
 *   node scripts/persist-k3-readings.mjs --apply
 *   node scripts/persist-k3-readings.mjs --apply --at=2026-09-04T12:00:00.000Z
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  K3_SCHEMA_VERSION,
  K3_THRESHOLDS,
  buildK3RelationalReading,
  hasK1Reading,
  hasK2Reading,
  hasK3Reading
} from './lib/k3-relational-kernel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTAL_DIR = path.join(ROOT, 'assets', 'data', 'companies');
const AUDIT_PATH = path.join(ROOT, 'assets', 'data', 'audit', 'k3-relational-persistence.json');
const APPLY = process.argv.includes('--apply');
const arg = name => {
  const prefix = `--${name}=`;
  const found = process.argv.find(value => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
};
const evaluatedAt = arg('at') || new Date().toISOString();
if (Number.isNaN(Date.parse(evaluatedAt))) throw new Error('--at must be an ISO-8601 timestamp');

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const files = fs.readdirSync(PORTAL_DIR).filter(file => file.endsWith('.json') && !file.startsWith('_')).sort();
const records = [];
let existingK1 = 0;
let existingK2 = 0;
let alreadyK3 = 0;
let persisted = 0;
let abstained = 0;
let nonK3Mutations = 0;

for (const file of files) {
  const portalPath = path.join(PORTAL_DIR, file);
  const portal = JSON.parse(fs.readFileSync(portalPath, 'utf8'));
  const slug = file.replace(/\.json$/, '');
  if (hasK1Reading(portal)) { existingK1++; continue; }
  if (hasK2Reading(portal)) { existingK2++; continue; }

  const { inspection, reading } = buildK3RelationalReading(portal, evaluatedAt);
  if (!reading) {
    abstained++;
    records.push({ slug, path: `assets/data/companies/${file}`, outcome: 'ABSTAINED', failedGates: inspection.failedGates, metrics: inspection.metrics });
    continue;
  }

  if (hasK3Reading(portal) && portal.kernelReadings.k3.sourceFingerprint === inspection.sourceFingerprint) {
    alreadyK3++;
    records.push({ slug, path: `assets/data/companies/${file}`, outcome: 'UNCHANGED', metrics: inspection.metrics, sourceFingerprint: inspection.sourceFingerprint });
    continue;
  }

  const beforeOutsideKernel = JSON.stringify(Object.fromEntries(Object.entries(portal).filter(([key]) => key !== 'kernelReadings')));
  portal.kernelReadings = { ...(portal.kernelReadings || {}), k3: reading, primary: 'k3' };
  const afterOutsideKernel = JSON.stringify(Object.fromEntries(Object.entries(portal).filter(([key]) => key !== 'kernelReadings')));
  if (beforeOutsideKernel !== afterOutsideKernel) nonK3Mutations++;
  persisted++;
  records.push({ slug, path: `assets/data/companies/${file}`, outcome: 'PERSISTED', metrics: inspection.metrics, sourceFingerprint: inspection.sourceFingerprint });
  if (APPLY) fs.writeFileSync(portalPath, JSON.stringify(portal, null, 2));
}

const audit = {
  schemaVersion: 'k3-relational-persistence/1.0',
  generatedAt: evaluatedAt,
  sourceCommit,
  mode: APPLY ? 'apply' : 'dry-run',
  contract: {
    slot: 'portal.kernelReadings.k3',
    state: 'RELATIONAL_MAP_OBSERVED',
    schemaVersion: K3_SCHEMA_VERSION,
    thresholds: K3_THRESHOLDS,
    exclusions: ['P0-P10 phase', 'financial composite', 'distress alert', 'outcome-validation claim']
  },
  totals: {
    portals: files.length,
    existingK1,
    existingK2,
    alreadyK3,
    frontier: persisted + alreadyK3 + abstained,
    persisted,
    abstained,
    nonK3Mutations
  },
  records
};

if (APPLY) fs.writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2));
console.log(`K3 relational persistence (${APPLY ? 'APPLY' : 'DRY RUN'})`);
console.log(`source commit: ${sourceCommit}`);
console.log(`portals: ${files.length}`);
console.log(`existing K1: ${existingK1}`);
console.log(`existing K2: ${existingK2}`);
console.log(`K3 frontier: ${audit.totals.frontier}`);
console.log(`before -> after no-kernel: ${audit.totals.frontier} -> ${abstained}`);
console.log(`persisted: ${persisted}`);
console.log(`already K3: ${alreadyK3}`);
console.log(`abstained: ${abstained}`);
for (const record of records.filter(record => record.outcome === 'ABSTAINED')) {
  console.log(`  ABSTAIN ${record.slug}: ${record.failedGates.join(', ')}`);
}
console.log(`non-K3 mutations: ${nonK3Mutations}`);
console.log(APPLY ? `audit: ${path.relative(ROOT, AUDIT_PATH)}` : 'nothing written');

if (nonK3Mutations > 0) process.exitCode = 1;
