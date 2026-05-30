#!/usr/bin/env node
/**
 * Multipass retry for bulk batch failures.
 *
 * Reads scripts/_bulk-failures-48a.json (extracted from chunk 1 + 2
 * stdout). For each entry, picks the right approach:
 *
 *   parse-truncation → multipass (4 calls, splits dense conglomerates)
 *   fetch-fail       → single-call retry (just transient)
 *   other            → single-call retry first; if still fails, multipass
 *
 * Multipass cost ~$0.10/portal × ~18 = ~$1.80
 * Wall: serial multipass takes ~7min each × 18 = ~2 hrs (background)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

// --manifest <path> to override the default failures manifest
const argsList = process.argv.slice(2);
function argFlag(name, fallback) {
  const i = argsList.indexOf('--' + name);
  return i === -1 ? fallback : argsList[i + 1];
}
const FAILURES_PATH = path.resolve(argFlag('manifest', 'scripts/_bulk-failures-48a.json'));
const PORTAL_DIR = path.resolve('assets/data/companies');
const BASE = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';
const TOKEN = process.env.LIMEN_OPERATOR_TOKEN || '';

const failures = JSON.parse(await fs.readFile(FAILURES_PATH, 'utf8'));
console.log('═══ bulk-failures multipass retry ═══');
console.log('  total failures:', failures.length);
console.log('  base url:      ', BASE);
console.log('');

function headers() {
  const h = { 'content-type': 'application/json' };
  if (TOKEN) h.authorization = 'Bearer ' + TOKEN;
  return h;
}

async function singleCallRetry(target) {
  const r = await fetch(BASE + '/api/enrich-portal-claude', {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ target, maxTokens: 14000 })
  });
  return r.json();
}

const results = [];
let succeeded = 0;
let failed = 0;

for (let i = 0; i < failures.length; i++) {
  const f = failures[i];
  const portalPath = path.join(PORTAL_DIR, f.slug + '.json');

  // Skip if portal already exists (from a previous successful run)
  if (fssync.existsSync(portalPath)) {
    console.log('[' + (i + 1) + '/' + failures.length + '] ' + f.slug + ' — SKIP (exists)');
    continue;
  }

  console.log('═══ [' + (i + 1) + '/' + failures.length + '] ' + f.slug + '  reason=' + f.reason + ' ═══');

  // For fetch-fails, try single-call first
  if (f.reason === 'fetch-fail') {
    const target = {
      slug: f.slug, cik: f.cik, ticker: f.ticker, name: f.name,
      domainId: f.domain,
      industry: f.name + ' — ' + (f.domain || 'unspecified')
    };
    console.log('  attempting single-call retry...');
    const t0 = Date.now();
    try {
      const j = await singleCallRetry(target);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      if (j.ok) {
        await fs.writeFile(portalPath, JSON.stringify(j.portal, null, 2) + '\n');
        const dr = j.densityReport || {};
        console.log('  single-call OK ' + dr.functionalNetworkTotal + ' entries (' + elapsed + 's)');
        results.push({ slug: f.slug, ok: true, mode: 'single-call', entries: dr.functionalNetworkTotal });
        succeeded++;
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }
      console.log('  single-call retry FAIL: ' + JSON.stringify(j).slice(0, 150));
      // Fall through to multipass
    } catch (e) {
      console.log('  single-call retry EXCEPTION: ' + (e.message || e).slice(0, 150));
    }
  }

  // Multipass path
  const cmd = [
    'node', 'scripts/portal-create-multipass.mjs',
    '--slug', f.slug,
    '--cik', f.cik,
    '--ticker', f.ticker || '',
    '--name', '"' + f.name + '"',
    '--domain', f.domain || ''
  ].join(' ');
  console.log('  multipass...');
  const t0 = Date.now();
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    const m = out.match(/passes succeeded:\s+(\d+)\s+\/\s+(\d+)/);
    const tot = out.match(/total fn entries:\s+(\d+)/);
    const passOk = m ? parseInt(m[1], 10) : 0;
    const passTotal = m ? parseInt(m[2], 10) : 0;
    const entries = tot ? parseInt(tot[1], 10) : 0;
    console.log('  multipass: ' + passOk + '/' + passTotal + ' passes, ' + entries + ' entries (' + elapsed + 's)');
    if (passOk === passTotal && entries >= 30) {
      results.push({ slug: f.slug, ok: true, mode: 'multipass', entries });
      succeeded++;
    } else {
      results.push({ slug: f.slug, ok: false, mode: 'multipass', error: 'low quality' });
      failed++;
    }
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    console.log('  multipass FAIL (' + elapsed + 's): ' + (e.message || e).slice(0, 200));
    results.push({ slug: f.slug, ok: false, mode: 'multipass', error: e.message || String(e) });
    failed++;
  }
  console.log('');
}

console.log('═══ SUMMARY ═══');
for (const r of results) {
  if (r.ok) console.log('  ' + r.slug.padEnd(30) + ' OK  ' + r.mode + '  ' + r.entries + ' entries');
  else console.log('  ' + r.slug.padEnd(30) + ' FAIL  ' + r.mode + '  ' + (r.error || ''));
}
console.log('  ' + succeeded + '/' + failures.length + ' succeeded, ' + failed + ' failed');
