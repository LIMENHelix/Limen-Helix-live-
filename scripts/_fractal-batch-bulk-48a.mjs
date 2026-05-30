#!/usr/bin/env node
/**
 * 48a-bulk: build portals for the remaining 192 non-ERROR missing CIKs.
 *
 * Reads scripts/_bulk-targets-48a.json (sorted by composite stress
 * desc, so worst-first). Sequentially POSTs each to /api/enrich-
 * portal-claude with minimal instructions (industry from CB +
 * company name + ticker — relies on Haiku's training corpus for
 * the rest). Writes each portal as it lands so a kill/restart is
 * safely resumable.
 *
 *   node scripts/_fractal-batch-bulk-48a.mjs --start 0 --count 96
 *   node scripts/_fractal-batch-bulk-48a.mjs --start 96 --count 96
 *   node scripts/_fractal-batch-bulk-48a.mjs --start 0 --count all
 *
 * Optional:
 *   --spacing-ms N    (default 30000 = 30s between calls)
 *   --skip-existing   (default true — skip if portal already exists)
 *
 * Cost: 192 × ~$0.05 Haiku ≈ $10. Per-call elapsed ~2-6s.
 * Wall: chunk-of-96 × 30s = ~48min.
 */
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}

const START = parseInt(arg('start', '0'), 10);
const COUNT_RAW = arg('count', 'all');
const SPACING_MS = parseInt(arg('spacing-ms', '30000'), 10);
const SKIP_EXISTING = arg('skip-existing', 'true') !== 'false';
const BASE = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';
const TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';
const TARGETS_PATH = path.resolve('scripts/_bulk-targets-48a.json');
const PORTAL_DIR = path.resolve('assets/data/companies');

function headers() {
  const h = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = 'Bearer ' + TOKEN;
  return h;
}

const allTargets = JSON.parse(await fs.readFile(TARGETS_PATH, 'utf8'));
const count = COUNT_RAW === 'all' ? allTargets.length - START : parseInt(COUNT_RAW, 10);
const slice = allTargets.slice(START, START + count);

console.log('═══ 48a-bulk batch ═══');
console.log('  total in manifest:', allTargets.length);
console.log('  this run:         start=' + START + ' count=' + slice.length);
console.log('  base url:         ' + BASE);
console.log('  auth:             ' + (TOKEN ? 'bearer present' : 'no token'));
console.log('  spacing:          ' + (SPACING_MS / 1000) + 's between calls');
console.log('  skip existing:    ' + SKIP_EXISTING);
console.log('');

const results = [];
let succeeded = 0;
let failed = 0;
let skipped = 0;

for (let i = 0; i < slice.length; i++) {
  const t = slice[i];
  const ordinal = '[' + (i + 1) + '/' + slice.length + '] ' + t.slug;

  // Skip if portal already exists (resume support)
  if (SKIP_EXISTING) {
    const portalPath = path.join(PORTAL_DIR, t.slug + '.json');
    if (fssync.existsSync(portalPath)) {
      console.log(ordinal + ' — SKIP (exists)');
      skipped++;
      continue;
    }
  }

  // Build target payload — minimal instructions, CB-derived context
  const target = {
    slug: t.slug,
    cik: t.cik,
    ticker: t.ticker,
    name: t.name,
    domainId: t.domain,
    industry: t.name + ' — ' + (t.domain || 'unspecified domain') +
      ' (kernel phase ' + (t.phase || '?') + ', trajectory ' +
      (t.trajectory || '?') + (t.alert ? ', ALERT' : '') + ')'
  };

  console.log(ordinal + ' (co=' + t.composite.toFixed(2) + ' p=' + t.phase + ')');

  try {
    const r = await fetch(BASE + '/api/enrich-portal-claude', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ target, maxTokens: 14000 })
    });
    const j = await r.json();
    if (j.ok) {
      await fs.writeFile(path.join(PORTAL_DIR, t.slug + '.json'),
        JSON.stringify(j.portal, null, 2) + '\n');
      const dr = j.densityReport || {};
      console.log('   OK ' + dr.functionalNetworkTotal + ' entries anchored=' +
        (typeof dr.anchoredRate === 'number' ? (dr.anchoredRate * 100).toFixed(0) + '%' : dr.anchoredRate));
      results.push({ slug: t.slug, ok: true, entries: dr.functionalNetworkTotal, anchored: dr.anchoredRate });
      succeeded++;
    } else {
      const errStr = j.error || 'unknown';
      const parseErr = j.parseError ? ' (parse: ' + j.parseError.slice(0, 80) + ')' : '';
      console.log('   FAIL: ' + errStr + parseErr);
      results.push({ slug: t.slug, ok: false, error: errStr });
      failed++;
    }
  } catch (e) {
    console.log('   EXCEPTION: ' + (e.message || e));
    results.push({ slug: t.slug, ok: false, error: e.message || String(e) });
    failed++;
  }

  if (i < slice.length - 1) await new Promise(r => setTimeout(r, SPACING_MS));
}

console.log('');
console.log('═══ SUMMARY ═══');
console.log('  succeeded: ' + succeeded);
console.log('  failed:    ' + failed);
console.log('  skipped:   ' + skipped);
console.log('  total:     ' + slice.length);
if (failed > 0) {
  console.log('  failures (up to 10):');
  for (const r of results.filter(r => !r.ok).slice(0, 10)) {
    console.log('    ' + r.slug + ' — ' + r.error);
  }
}
