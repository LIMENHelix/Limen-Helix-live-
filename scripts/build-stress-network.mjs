#!/usr/bin/env node
/**
 * CLI runner for the spider-web stress propagator.
 *
 * Loads every portal under assets/data/companies/, loads the Command
 * Board score export, runs propagation, and writes the result to
 * assets/data/stress-network-state.json. Also prints a top-20
 * summary of the most network-pushed nodes (where induced > intrinsic).
 *
 *   node scripts/build-stress-network.mjs
 *   node scripts/build-stress-network.mjs --top 30
 *   node scripts/build-stress-network.mjs --slug abbott_laboratories
 *
 * Output cache is committable — downstream consumers (Master Brain,
 * Command Board UI, autofire worker) can read it without recomputing.
 */
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const propagator = require('../api/lib/limen-stress-propagator.js');

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}

const TOP_N = parseInt(arg('top', '20'), 10);
const FILTER_SLUG = arg('slug', '');
const PORTAL_DIR = path.resolve('assets/data/companies');
const CB_PATH = path.resolve('assets/data/command-board-data.json');
const OUT_PATH = path.resolve('assets/data/stress-network-state.json');

// ─── Load corpus ──────────────────────────────────────────────────
async function loadPortals() {
  // Sort readdirSync output — OS-dependent enumeration order otherwise
  // leaks into the propagator's hashable payload (W3 determinism).
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

// ─── Run ──────────────────────────────────────────────────────────
console.log('═══ spider-web stress propagation ═══');
const portals = await loadPortals();
console.log('  portals loaded:        ' + portals.loaded + '  (failed: ' + portals.failed + ')');
const cb = await loadCommandBoard();
console.log('  command-board entries: ' + cb.length);

const t0 = Date.now();
const result = propagator.runPropagation(portals.map, cb);
const elapsedMs = Date.now() - t0;
console.log('  propagation elapsed:   ' + elapsedMs + 'ms');

console.log('');
console.log('  graph stats:');
console.log('    total nodes:       ' + result.stats.totalNodes);
console.log('    total edges:       ' + result.stats.totalEdges);
console.log('    avg edges/node:    ' + (result.stats.totalEdges / result.stats.totalNodes).toFixed(1));
console.log('    nodes w/ intrinsic stress: ' + result.stats.stressedNodes);
console.log('    network-pushed nodes:      ' + result.stats.networkPushed);
console.log('    induced-only (no intrinsic): ' + result.stats.inducedOnly);

console.log('');
console.log('  tuning:');
console.log('    max hops:          ' + result.stats.maxHops);
console.log('    hop attenuation:   ' + result.stats.hopAttenuation);
console.log('    alert multiplier:  ' + result.stats.alertMult);

// ─── Top results ──────────────────────────────────────────────────
const serialized = propagator.serializeResult(result);

if (FILTER_SLUG) {
  const node = serialized.propagated.find(n => n.slug === FILTER_SLUG);
  if (!node) {
    console.log('');
    console.log('  ! slug not found: ' + FILTER_SLUG);
    process.exit(1);
  }
  console.log('');
  console.log('  --- ' + FILTER_SLUG + ' ---');
  console.log('    intrinsicStress: ' + node.intrinsicStress);
  console.log('    inducedStress:   ' + node.inducedStress);
  console.log('    totalStress:     ' + node.totalStress);
  console.log('    stressRatio:     ' + node.stressRatio);
  console.log('    networkPushed:   ' + node.networkPushed);
  console.log('    induced sources (top 10):');
  for (const s of node.inducedSources.slice(0, 10)) {
    console.log('      ' + s.sourceSlug + '  contribution=' + s.contribution
      + '  hops=' + s.firstHops + '  via=' + s.edgeCategory);
  }
}

console.log('');
console.log('  TOP ' + TOP_N + ' by totalStress:');
console.log('  ' + 'slug'.padEnd(34) + 'intrins  induced  total   ratio  pushed');
for (const n of serialized.propagated.slice(0, TOP_N)) {
  const slug = (n.slug || '').padEnd(34).slice(0, 34);
  const intr = String(n.intrinsicStress).padStart(7);
  const ind = String(n.inducedStress).padStart(7);
  const tot = String(n.totalStress).padStart(7);
  const rat = String(n.stressRatio == null ? '—' : n.stressRatio).padStart(6);
  const pushed = n.networkPushed ? 'YES' : '';
  console.log('  ' + slug + ' ' + intr + ' ' + ind + ' ' + tot + ' ' + rat + '  ' + pushed);
}

console.log('');
console.log('  AMPLIFICATION RANK DISTRIBUTION:');
const rankCounts = {};
for (const n of serialized.propagated) rankCounts[n.amplificationRank || 'UNKNOWN'] = (rankCounts[n.amplificationRank || 'UNKNOWN'] || 0) + 1;
for (const r of ['SEVERE', 'MODERATE', 'MILD', 'HUB_EFFECT', 'NONE']) {
  if (rankCounts[r]) console.log('    ' + r.padEnd(12) + ': ' + rankCounts[r]);
}

console.log('');
console.log('  TOP SEVERE-AMPLIFIED (network-pushed anomalies, NOT hubs):');
const severe = serialized.propagated.filter(n => n.amplificationRank === 'SEVERE').slice(0, 10);
if (severe.length === 0) {
  console.log('    (none)');
} else {
  for (const n of severe) {
    console.log('    ' + n.slug.padEnd(34)
      + '  intr=' + n.intrinsicStress + '  ind=' + n.inducedStress
      + '  inDeg=' + n.inDegree
      + '  top source=' + (n.inducedSources[0] ? n.inducedSources[0].sourceSlug : '?')
      + ' (' + (n.inducedSources[0] ? n.inducedSources[0].contribution : '?') + ' via '
      + (n.inducedSources[0] ? n.inducedSources[0].edgeCategory : '?') + ')');
  }
}

console.log('');
console.log('  TOP MODERATE-AMPLIFIED:');
const moderate = serialized.propagated.filter(n => n.amplificationRank === 'MODERATE').slice(0, 10);
if (moderate.length === 0) {
  console.log('    (none)');
} else {
  for (const n of moderate) {
    console.log('    ' + n.slug.padEnd(34)
      + '  intr=' + n.intrinsicStress + '  ind=' + n.inducedStress
      + '  inDeg=' + n.inDegree
      + '  top source=' + (n.inducedSources[0] ? n.inducedSources[0].sourceSlug : '?'));
  }
}

// ─── Cache to disk ────────────────────────────────────────────────
await fs.writeFile(OUT_PATH, JSON.stringify(serialized, null, 2) + '\n');
console.log('');
console.log('  WROTE: ' + OUT_PATH + '  (' + (JSON.stringify(serialized).length / 1024).toFixed(1) + 'KB)');
