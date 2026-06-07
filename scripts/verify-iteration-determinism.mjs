#!/usr/bin/env node
/**
 * W3 verify harness — confirms the stress propagator produces a
 * byte-identical `propagated[]` payload across N consecutive runs on
 * the same input corpus.
 *
 *   node scripts/verify-iteration-determinism.mjs
 *   node scripts/verify-iteration-determinism.mjs --runs 10
 *   node scripts/verify-iteration-determinism.mjs --runs 5 --verbose
 *
 * Exit codes:
 *   0  all runs produced identical hashes (PASS)
 *   1  one or more runs diverged (FAIL — first divergent run printed)
 *   2  input load failure / harness error
 *
 * What gets hashed:
 *   `propagator.propagatedHash(result)` — i.e. the FNV-1a hash of
 *   `serializeResultDeterministic(result).propagated`. Wall-clock
 *   fields (`generatedAt`) are explicitly excluded; see the
 *   "Determinism contract" comment in api/lib/limen-stress-propagator.js.
 *
 * Inputs:
 *   - assets/data/companies/*.json   (portal corpus)
 *   - assets/data/command-board-data.json  (CB short-key entries)
 *   - assets/data/brain-connectome.json    (L2 connectome — read by
 *     propagator's inhibitory-edge loader at module init)
 */
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const propagator = require('../lib/limen-stress-propagator.js');

// ─── CLI parsing ──────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}
function flag(name) {
  return args.includes('--' + name);
}

const RUNS = Math.max(2, parseInt(arg('runs', '5'), 10) || 5);
const VERBOSE = flag('verbose');

const PORTAL_DIR = path.resolve('assets/data/companies');
const CB_PATH = path.resolve('assets/data/command-board-data.json');

// ─── Load corpus once ─────────────────────────────────────────────
async function loadPortals() {
  // Sort upstream too so that even if the propagator's internal sort
  // were removed, this harness would still feed identical inputs.
  const files = fssync.readdirSync(PORTAL_DIR).sort().filter(f =>
    f.endsWith('.json') && !f.startsWith('_'));
  const map = {};
  let loaded = 0, failed = 0;
  for (const f of files) {
    try {
      const p = JSON.parse(await fs.readFile(path.join(PORTAL_DIR, f), 'utf8'));
      const slug = p.slug || f.replace('.json', '');
      map[slug] = p;
      loaded++;
    } catch (e) {
      failed++;
    }
  }
  return { map, loaded, failed };
}

async function loadCommandBoard() {
  const cb = JSON.parse(await fs.readFile(CB_PATH, 'utf8'));
  return cb.companies || [];
}

// ─── Main ─────────────────────────────────────────────────────────
console.log('═══ W3 iteration determinism verify harness ═══');
console.log('  runs:    ' + RUNS);
console.log('  verbose: ' + (VERBOSE ? 'yes' : 'no'));
console.log('');

let portals, cb;
try {
  console.log('  loading portal corpus...');
  portals = await loadPortals();
  console.log('  portals loaded:        ' + portals.loaded + '  (failed: ' + portals.failed + ')');
  cb = await loadCommandBoard();
  console.log('  command-board entries: ' + cb.length);
} catch (err) {
  console.error('');
  console.error('  ! harness error during input load: ' + (err && err.message || err));
  process.exit(2);
}
console.log('');

const hashes = [];
const elapsed = [];
for (let i = 0; i < RUNS; i++) {
  const t0 = Date.now();
  const result = propagator.runPropagation(portals.map, cb);
  const h = propagator.propagatedHash(result);
  const dt = Date.now() - t0;
  hashes.push(h);
  elapsed.push(dt);
  if (VERBOSE) {
    console.log('  run ' + String(i + 1).padStart(2) + ':  hash=' + h + '  elapsed=' + dt + 'ms');
  } else {
    process.stdout.write('.');
  }
}
if (!VERBOSE) console.log('');
console.log('');

// ─── Compare ──────────────────────────────────────────────────────
const reference = hashes[0];
const divergentIndex = hashes.findIndex((h, i) => i > 0 && h !== reference);

if (divergentIndex === -1) {
  console.log('  RESULT: PASS  — all ' + RUNS + ' runs produced identical hash');
  console.log('  hash:   ' + reference);
  console.log('  timing: min=' + Math.min(...elapsed) + 'ms  max=' + Math.max(...elapsed)
    + 'ms  avg=' + Math.round(elapsed.reduce((a, b) => a + b, 0) / elapsed.length) + 'ms');
  process.exit(0);
}

console.log('  RESULT: FAIL  — run ' + (divergentIndex + 1) + ' diverged from run 1');
console.log('');
console.log('  reference (run 1):  ' + reference);
console.log('  divergent (run ' + (divergentIndex + 1) + '):  ' + hashes[divergentIndex]);
if (!VERBOSE) {
  console.log('');
  console.log('  all hashes:');
  for (let i = 0; i < hashes.length; i++) {
    const mark = hashes[i] === reference ? '  ' : '!!';
    console.log('    ' + mark + ' run ' + String(i + 1).padStart(2) + ': ' + hashes[i]);
  }
}
console.log('');
console.log('  Re-run with --verbose for per-run timing.');
process.exit(1);
