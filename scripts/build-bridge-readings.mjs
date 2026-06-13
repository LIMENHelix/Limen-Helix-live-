#!/usr/bin/env node
/**
 * build-bridge-readings.mjs — run the bridge engine across the corpus.
 *
 * For each portal, calls bridgeEngine.matchPortal(portal), writes the result
 * to portal.bridgeReadings. Idempotent — re-run anytime to refresh.
 *
 *   node scripts/build-bridge-readings.mjs            # apply
 *   node scripts/build-bridge-readings.mjs --dry-run  # plan only
 *   node scripts/build-bridge-readings.mjs --slug=walmart   # one portal
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const LOG_PATH = path.join(ROOT, 'assets', 'data', '_bridge-build-log.json');

const require = createRequire(import.meta.url);
const { matchPortal, loadPatterns } = require(path.join(ROOT, 'lib', 'bridge-engine.js'));

const arg = (name, dflt) => {
  const i = process.argv.findIndex(a => a === '--' + name || a.startsWith('--' + name + '='));
  if (i === -1) return dflt;
  const a = process.argv[i];
  if (a.includes('=')) return a.split('=')[1];
  return process.argv[i + 1] || dflt;
};
const DRY = process.argv.includes('--dry-run');
const SLUG_FILTER = arg('slug', null);

const lib = loadPatterns();
console.log('=== build-bridge-readings ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');
console.log('pattern library: ' + (lib.patterns || []).length + ' bridges (' + (lib.schemaVersion || 'unknown') + ')');

let files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
if (SLUG_FILTER) files = files.filter(f => f === SLUG_FILTER + '.json');
console.log('portals to process: ' + files.length);
console.log();

let total = 0, withMatches = 0, totalMatches = 0;
const byPattern = {};
const worstNonMatch = []; // sample portals with NO match (signal of either healthy or library-gap)

for (const f of files) {
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  total++;
  const result = matchPortal(p);
  if (result.matched.length === 0) {
    if (worstNonMatch.length < 25) worstNonMatch.push({ slug: f.replace(/\.json$/, ''), name: p.name });
    continue;
  }
  withMatches++;
  totalMatches += result.matched.length;
  for (const m of result.matched) byPattern[m.patternId] = (byPattern[m.patternId] || 0) + 1;
  if (!DRY) {
    p.bridgeReadings = result;
    fs.writeFileSync(path.join(DIR, f), JSON.stringify(p, null, 2));
  }
  if (total % 100 === 0) console.log('  ' + total + ' / ' + files.length + ' processed · ' + withMatches + ' with matches · ' + totalMatches + ' total matches');
}

const byPatternSorted = Object.entries(byPattern).sort((a, b) => b[1] - a[1]);

const summary = {
  schemaVersion: 'bridge-build/1.0',
  generatedAt: new Date().toISOString(),
  portalsProcessed: total,
  portalsWithMatches: withMatches,
  totalMatches,
  averageMatchesPerPortal: total ? +(totalMatches / total).toFixed(2) : 0,
  byPattern: Object.fromEntries(byPatternSorted),
  noMatchSample: worstNonMatch
};
if (!DRY) fs.writeFileSync(LOG_PATH, JSON.stringify(summary, null, 2));

console.log();
console.log('=== summary ===');
console.log('portals processed:    ' + total);
console.log('portals with matches: ' + withMatches + ' (' + Math.round(withMatches / Math.max(1, total) * 100) + '%)');
console.log('total matches:        ' + totalMatches);
console.log('average per portal:   ' + summary.averageMatchesPerPortal);
console.log();
console.log('top patterns:');
for (const [pid, n] of byPatternSorted.slice(0, 12)) console.log('  ' + String(n).padStart(4) + '  ' + pid);
if (!DRY) console.log('\nsummary log: ' + LOG_PATH);
