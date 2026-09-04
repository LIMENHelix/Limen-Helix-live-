#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasK3Reading, inspectK3RelationalTopology } from './lib/k3-relational-kernel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/audit/k3-relational-persistence.json'), 'utf8'));
let proved = 0;
let abstained = 0;
let outsideKernelChanges = 0;
let priorKernelChanges = 0;
let invalidReadings = 0;

const withoutKernel = portal => Object.fromEntries(Object.entries(portal).filter(([key]) => key !== 'kernelReadings'));
const priorKernel = portal => {
  const readings = { ...(portal.kernelReadings || {}) };
  delete readings.k3;
  delete readings.primary;
  return Object.keys(readings).length ? readings : null;
};

for (const record of audit.records) {
  const current = JSON.parse(fs.readFileSync(path.join(ROOT, record.path), 'utf8'));
  const original = JSON.parse(execFileSync('git', ['show', `${audit.sourceCommit}:${record.path}`], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024
  }));
  if (record.outcome === 'PERSISTED') {
    proved++;
    if (JSON.stringify(withoutKernel(current)) !== JSON.stringify(withoutKernel(original))) outsideKernelChanges++;
    if (JSON.stringify(priorKernel(current)) !== JSON.stringify(priorKernel(original))) priorKernelChanges++;
    const inspection = inspectK3RelationalTopology(current);
    const k3 = current.kernelReadings?.k3;
    if (!hasK3Reading(current) || current.kernelReadings.primary !== 'k3' ||
        k3.phase !== null || k3.composite !== null || k3.alert !== false ||
        k3.sourceFingerprint !== inspection.sourceFingerprint) invalidReadings++;
  } else if (record.outcome === 'ABSTAINED') {
    abstained++;
    if (JSON.stringify(current) !== JSON.stringify(original)) outsideKernelChanges++;
  }
}

console.log('K3 relational exact-diff proof');
console.log(`source commit: ${audit.sourceCommit}`);
console.log(`persisted readings proved: ${proved}`);
console.log(`abstentions proved unchanged: ${abstained}`);
console.log(`outside-kernel changes: ${outsideKernelChanges}`);
console.log(`pre-existing kernel changes: ${priorKernelChanges}`);
console.log(`invalid K3 readings: ${invalidReadings}`);
console.log('K3 phase/composite/alert claims introduced: 0');
if (proved !== audit.totals.persisted || abstained !== audit.totals.abstained ||
    outsideKernelChanges || priorKernelChanges || invalidReadings) process.exit(1);
