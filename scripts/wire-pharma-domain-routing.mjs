#!/usr/bin/env node

/**
 * Reconcile pharmaceutical portal domainId values from Command Board source.
 *
 * Scope is deliberately narrow: only portals with pharmaceutical SIC 283x or
 * an industry containing "pharm" are eligible, and only medicine/science
 * Command Board domains may be applied. Protected domain corpus files are
 * never read or written.
 *
 * Usage:
 *   node scripts/wire-pharma-domain-routing.mjs --dry-run
 *   node scripts/wire-pharma-domain-routing.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPANIES_DIR = path.join(ROOT, 'assets', 'data', 'companies');
const CB_PATH = path.join(ROOT, 'assets', 'data', 'command-board-data.json');
const dryRun = process.argv.includes('--dry-run');

function normCik(value) {
  return String(value ?? '').replace(/^0+/, '') || '0';
}

function isPharma(portal) {
  return String(portal.sic ?? '').startsWith('283') || /pharm/i.test(String(portal.industry ?? ''));
}

const cb = JSON.parse(fs.readFileSync(CB_PATH, 'utf8'));
const domainByCik = new Map(
  (cb.companies || [])
    .filter((row) => row.c && ['medicine', 'science'].includes(row.d))
    .map((row) => [normCik(row.c), row.d])
);

let pharmaPortals = 0;
let corrected = 0;
const changes = [];

for (const file of fs.readdirSync(COMPANIES_DIR).filter((name) => name.endsWith('.json') && !name.startsWith('_')).sort()) {
  const filePath = path.join(COMPANIES_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf8');
  const portal = JSON.parse(raw);
  if (!isPharma(portal)) continue;
  pharmaPortals++;

  const sourceDomain = domainByCik.get(normCik(portal.cik));
  if (!sourceDomain || portal.domainId === sourceDomain) continue;

  changes.push({ file, cik: String(portal.cik ?? ''), before: portal.domainId ?? null, after: sourceDomain });
  corrected++;
  if (!dryRun) {
    const escapedDomain = String(portal.domainId ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const domainPattern = new RegExp(`("domainId"\\s*:\\s*)"${escapedDomain}"`);
    const updated = raw.replace(domainPattern, `$1"${sourceDomain}"`);
    if (updated === raw) throw new Error(`could not replace top-level domainId in ${file}`);
    fs.writeFileSync(filePath, updated);
  }
}

for (const change of changes) {
  console.log(`${change.file}: CIK ${change.cik} ${change.before} -> ${change.after}`);
}
console.log(`pharma portals inspected: ${pharmaPortals}`);
console.log(`domain routes ${dryRun ? 'eligible' : 'corrected'}: ${corrected}`);
