#!/usr/bin/env node
/**
 * scripts/densify-v2-portals.mjs
 *
 * Calls /api/enrich-portal-claude for each company portal in the
 * target list and writes the densified JSON back to
 * assets/data/companies/{slug}.json. Designed to lift low-density
 * v2 portals up to Walmart-grade (30+ functionalNetwork entries,
 * 80+ word relationshipNote average, full intelligenceCycle).
 *
 * Usage:
 *   node scripts/densify-v2-portals.mjs              # uses default list
 *   node scripts/densify-v2-portals.mjs amazon target nike
 *   node scripts/densify-v2-portals.mjs --dry-run    # call but don't write
 *
 * Env:
 *   LIMEN_BASE_URL  defaults to https://limenhelix.com
 *
 * Conservative: writes a backup of the existing portal to
 * assets/data/companies/_pre-enrich/{slug}.json before overwriting.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');
const BACKUP_DIR = path.join(PORTAL_DIR, '_pre-enrich');
const BASE_URL = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';

// Default v2 portals to densify — the ones currently below WMT density.
// WMT is excluded (it's the exemplar).
const DEFAULT_TARGETS = [
  'amazon', 'costco', 'target', 'nike',
  'jbht', 'ups', 'wern'
];

const dryRun = process.argv.includes('--dry-run');
const argSlugs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const targets = argSlugs.length ? argSlugs : DEFAULT_TARGETS;

async function main() {
  console.log('=== LIMEN portal densification ===');
  console.log('base:    ' + BASE_URL);
  console.log('targets: ' + targets.join(', '));
  console.log('dryRun:  ' + dryRun);
  console.log('');

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const summary = [];

  for (const slug of targets) {
    console.log('── ' + slug + ' ──');
    const filePath = path.join(PORTAL_DIR, slug + '.json');

    let existing = null;
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      existing = JSON.parse(raw);
    } catch (e) {
      console.log('  no existing portal (will produce from scratch)');
    }

    const target = existing ? {
      cik: existing.cik || null,
      slug: existing.slug || slug,
      name: existing.name || null,
      ticker: existing.ticker || null,
      domainId: existing.domainId || null,
      industry: existing.industry || null
    } : { slug: slug, name: slug };

    if (!target.name && !target.ticker && !target.cik) {
      console.log('  SKIP: no identifying info (need name/ticker/cik)');
      summary.push({ slug, status: 'skip-no-target' });
      continue;
    }

    const beforeCount = existing ? countFunctionalNetwork(existing) : 0;
    console.log('  before: ' + beforeCount + ' functionalNetwork entries');

    const t0 = Date.now();
    let resp;
    try {
      const r = await fetch(BASE_URL + '/api/enrich-portal-claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target: target,
          currentPortal: existing
        })
      });
      resp = await r.json();
      if (!r.ok || !resp.ok) {
        console.log('  ENRICH FAIL: ' + JSON.stringify(resp).slice(0, 300));
        summary.push({ slug, status: 'enrich-fail', detail: resp.error });
        continue;
      }
    } catch (err) {
      console.log('  fetch err: ' + err.message);
      summary.push({ slug, status: 'fetch-err', detail: err.message });
      continue;
    }

    const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
    const dr = resp.densityReport || {};
    console.log('  enrichment took ' + elapsedS + 's, model=' + resp.model);
    console.log('  AFTER: ' + dr.functionalNetworkTotal + ' total entries: ' +
      Object.entries(dr.functionalNetworkByCategory || {})
        .map(([k, v]) => k + '=' + v).join(', '));
    console.log('  fredSeries=' + dr.fredSeriesCount + ' commodityExposure=' + dr.commodityExposureCount);
    console.log('  bannedHits=' + (resp.bannedHits || []).length);
    console.log('  usage tokens: in=' + (resp.usage && resp.usage.input_tokens) +
      ' out=' + (resp.usage && resp.usage.output_tokens) +
      ' cacheRead=' + (resp.usage && resp.usage.cache_read_input_tokens));

    if (!resp.portal) {
      console.log('  no portal returned, skipping write');
      summary.push({ slug, status: 'no-portal-returned' });
      continue;
    }

    if (dryRun) {
      console.log('  DRY RUN: would write to ' + filePath);
      summary.push({ slug, status: 'dry-run-ok', before: beforeCount,
                     after: dr.functionalNetworkTotal, elapsedS });
      continue;
    }

    // Backup existing
    if (existing) {
      const backupPath = path.join(BACKUP_DIR, slug + '.json');
      await fs.writeFile(backupPath, JSON.stringify(existing, null, 2), 'utf8');
      console.log('  backed up to: ' + path.relative(REPO_ROOT, backupPath));
    }

    // Write new
    await fs.writeFile(filePath, JSON.stringify(resp.portal, null, 2), 'utf8');
    console.log('  WROTE: ' + path.relative(REPO_ROOT, filePath));

    summary.push({
      slug,
      status: 'written',
      before: beforeCount,
      after: dr.functionalNetworkTotal,
      elapsedS,
      bannedHits: (resp.bannedHits || []).length
    });
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.table(summary);
}

function countFunctionalNetwork(portal) {
  const fn = portal && portal.functionalNetwork;
  if (!fn) return 0;
  let n = 0;
  for (const cat of ['suppliers', 'logisticsPartners', 'customers', 'competitors',
                     'regulators', 'capitalProviders', 'executiveTeam',
                     'marketSignals', 'partners', 'peers']) {
    const v = fn[cat];
    if (Array.isArray(v)) n += v.length;
  }
  if (fn.auditor && typeof fn.auditor === 'object' && !Array.isArray(fn.auditor)) n += 1;
  if (Array.isArray(fn.auditors)) n += fn.auditors.length;
  return n;
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
