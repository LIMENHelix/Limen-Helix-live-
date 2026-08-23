#!/usr/bin/env node
/**
 * build-master-inbox.mjs — Master Brain reads every portal's engineOutputs,
 * applies readiness + salience + phase gates, writes prioritized inbox.
 *
 *   node scripts/build-master-inbox.mjs --apply
 *   node scripts/build-master-inbox.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const INBOX_PATH = path.join(ROOT, 'assets', 'data', '_master-inbox.json');
const DRY = !process.argv.includes('--apply');

const require = createRequire(import.meta.url);
// PORTED from the full repo 2026-07-31. The live repo moved api/lib -> lib, so the require
// path differs here. Neither this script nor the consumer had ever been ported, which is why
// /vitals told the operator to "run scripts/build-master-inbox.mjs --apply" for months while
// that file did not exist in this repo at all.
const { buildInbox } = require(path.join(ROOT, 'lib', 'master-brain-consumer.js'));

console.log('=== build-master-inbox ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');

function* iterPortals() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  for (const f of files) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      if (!p.slug) p.slug = f.replace(/\.json$/, '');
      yield p;
    } catch (e) { /* skip unparseable */ }
  }
}

const inbox = buildInbox(iterPortals(), { generatedAt: process.env.LIMEN_SNAPSHOT_AT });
console.log('portals scanned:        ' + inbox.stats.portalsScanned);
console.log('portals with artifacts: ' + inbox.stats.portalsWithArtifacts);
console.log('total candidates:       ' + inbox.stats.totalCandidates);
console.log('ready to fire:          ' + inbox.stats.readyToFire);
console.log('inhibited:              ' + inbox.stats.inhibited);
console.log('by lane (ready):        ' + JSON.stringify(inbox.stats.byLaneReady));
console.log('autofire-ready pool:    ' + inbox.readyForAutofire.length);
console.log();
console.log('top priority cross-lane:');
for (const t of inbox.topPriority.slice(0, 10)) {
  console.log('  ' + t.fireScore.toFixed(3).padStart(6) + '  ' + t.lane.padEnd(11) + '  ' + t.portalSlug.padEnd(28) + '  ' + (t.patternId || '').slice(0, 50));
}

if (!DRY) {
  fs.writeFileSync(INBOX_PATH, JSON.stringify(inbox, null, 2));
  console.log('\nwritten: ' + INBOX_PATH);
}
