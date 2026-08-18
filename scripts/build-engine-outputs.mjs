#!/usr/bin/env node
/**
 * build-engine-outputs.mjs — run the investment and research lanes across the corpus.
 *
 * For each portal with bridgeReadings, calls engineGenerator.generateForPortal()
 * and writes the result to portal.engineOutputs. Idempotent.
 *
 *   node scripts/build-engine-outputs.mjs --apply
 *   node scripts/build-engine-outputs.mjs --dry-run
 *   node scripts/build-engine-outputs.mjs --slug=walmart --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const LOG_PATH = path.join(ROOT, 'assets', 'data', '_engine-build-log.json');

const require = createRequire(import.meta.url);
const { generateForPortal } = require(path.join(ROOT, 'lib', 'engine-output-generator.js'));

const arg = (name, dflt) => { const i = process.argv.findIndex(a => a === '--' + name || a.startsWith('--' + name + '=')); if (i === -1) return dflt; const a = process.argv[i]; if (a.includes('=')) return a.split('=')[1]; return process.argv[i + 1] || dflt; };
const DRY = !process.argv.includes('--apply');
const SLUG_FILTER = arg('slug', null);

console.log('=== build-engine-outputs ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');

let files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
if (SLUG_FILTER) files = files.filter(f => f === SLUG_FILTER + '.json');
console.log('portals to process: ' + files.length);
console.log();

let total = 0, withBridges = 0, withOutputs = 0, totalArtifacts = 0;
const byLane = { investment: 0, research: 0 };

for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  total++;
  if (!p.bridgeReadings || !p.bridgeReadings.matched || !p.bridgeReadings.matched.length) continue;
  withBridges++;
  const outputs = generateForPortal(p);
  if (!outputs || outputs.totalArtifacts === 0) continue;
  withOutputs++;
  totalArtifacts += outputs.totalArtifacts;
  for (const lane in byLane) byLane[lane] += (outputs[lane] || []).length;
  if (!DRY) {
    p.engineOutputs = outputs;
    fs.writeFileSync(path.join(DIR, f), JSON.stringify(p, null, 2));
  }
  if (total % 100 === 0) console.log('  ' + total + ' / ' + files.length + ' · ' + withOutputs + ' with outputs · ' + totalArtifacts + ' total artifacts');
}

const summary = { generatedAt: new Date().toISOString(), schemaVersion: 'engine-build/1.0', portalsProcessed: total, portalsWithBridges: withBridges, portalsWithOutputs: withOutputs, totalArtifacts, byLane };
if (!DRY) fs.writeFileSync(LOG_PATH, JSON.stringify(summary, null, 2));

console.log();
console.log('=== summary ===');
console.log('portals processed:    ' + total);
console.log('portals with bridges: ' + withBridges);
console.log('portals with outputs: ' + withOutputs + ' (' + Math.round(withOutputs / Math.max(1, total) * 100) + '%)');
console.log('total artifacts:      ' + totalArtifacts);
console.log('by lane: ' + JSON.stringify(byLane));
if (!DRY) console.log('summary log: ' + LOG_PATH);
