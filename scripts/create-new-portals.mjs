#!/usr/bin/env node
/**
 * scripts/create-new-portals.mjs
 *
 * Creates *new* v2.0.1 portal files for companies that don't have a
 * portal yet but are heavily referenced as orphan targets in the
 * reciprocity audit. Unlike densify-v2-portals.mjs (which reads an
 * existing portal first), this script supplies full target metadata
 * inline so the enricher has enough to produce from scratch.
 *
 * Targets are defined in TARGETS below — edit / extend per batch.
 *
 * Usage:
 *   node scripts/create-new-portals.mjs              # all defaults
 *   node scripts/create-new-portals.mjs saia cvs     # subset
 *   node scripts/create-new-portals.mjs --dry-run
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');
const BACKUP_DIR = path.join(PORTAL_DIR, '_pre-enrich');
const BASE_URL = process.env.LIMEN_BASE_URL || 'https://limenhelix.com';

// Top-orphan companies referenced 3+ times across existing v2 portals.
// Each needs full target metadata: cik (10-digit padded), ticker,
// domainId (one of 20 canonical), industry, slug.
const TARGETS = [
  {
    slug: 'saia', cik: '0000091142', ticker: 'SAIA', name: 'Saia, Inc.',
    domainId: 'supplyChain', industry: 'Less-Than-Truckload Trucking'
  },
  {
    slug: 'sealed_air', cik: '0000086312', ticker: 'SEE', name: 'Sealed Air Corporation',
    domainId: 'industry', industry: 'Plastics Packaging Materials and Unsupported Plastics Film and Sheet'
  },
  {
    slug: 'schneider_national', cik: '0000089143', ticker: 'SNDR', name: 'Schneider National, Inc.',
    domainId: 'supplyChain', industry: 'Trucking (Except Local)'
  },
  {
    slug: 'cvs_health', cik: '0001116132', ticker: 'CVS', name: 'CVS Health Corporation',
    domainId: 'medicine', industry: 'Retail Drug Stores + Health Services + PBM'
  },
  {
    slug: 'huhtamaki', cik: null, ticker: 'HUH1V.HE', name: 'Huhtamäki Oyj',
    domainId: 'industry', industry: 'Packaging — molded fiber + flexibles + paperboard'
  },
  {
    slug: 'international_paper', cik: '0000051143', ticker: 'IP', name: 'International Paper Company',
    domainId: 'industry', industry: 'Paperboard Mills + Containerboard'
  },
  {
    slug: 'eastman_chemical', cik: '0000277801', ticker: 'EMN', name: 'Eastman Chemical Company',
    domainId: 'industry', industry: 'Industrial Organic Chemicals + Specialty Materials'
  },
  {
    slug: 'mcdonalds', cik: '0000063908', ticker: 'MCD', name: "McDonald's Corporation",
    domainId: 'industry', industry: 'Limited-Service Restaurants + Franchising'
  },
  {
    slug: 'cargill', cik: null, ticker: null, name: 'Cargill, Incorporated',
    domainId: 'agriculture', industry: 'Agricultural Commodity Trading + Food Ingredients (private)'
  },
  {
    slug: 'nestle', cik: '0001000799', ticker: 'NSRGY', name: 'Nestlé S.A.',
    domainId: 'industry', industry: 'Packaged Foods + Beverages (Swiss)'
  },
  // ── Batch 2 (2026-05-18 late session, post-eastman/xpo retry) ──
  {
    slug: 'cummins', cik: '0000026172', ticker: 'CMI', name: 'Cummins Inc.',
    domainId: 'industry', industry: 'Engines + Components + Power Systems'
  },
  {
    slug: 'huntsman', cik: '0001307954', ticker: 'HUN', name: 'Huntsman Corporation',
    domainId: 'industry', industry: 'Specialty Chemicals + Polyurethanes'
  },
  {
    slug: 'salesforce', cik: '0001108524', ticker: 'CRM', name: 'Salesforce, Inc.',
    domainId: 'technology', industry: 'Enterprise SaaS — CRM + Platform'
  },
  {
    slug: 'broadcom', cik: '0001730168', ticker: 'AVGO', name: 'Broadcom Inc.',
    domainId: 'technology', industry: 'Semiconductors + Infrastructure Software'
  },
  {
    slug: 'maersk_line', cik: null, ticker: 'MAERSK-B.CO', name: 'A.P. Møller - Mærsk A/S',
    domainId: 'supplyChain', industry: 'Ocean Container Shipping + Logistics (Danish public)'
  },
  {
    slug: 'packaging_corp_america', cik: '0000075677', ticker: 'PKG', name: 'Packaging Corporation of America',
    domainId: 'industry', industry: 'Containerboard + Corrugated Packaging'
  },
  {
    slug: 'old_dominion_freight', cik: '0000878927', ticker: 'ODFL', name: 'Old Dominion Freight Line, Inc.',
    domainId: 'supplyChain', industry: 'Less-Than-Truckload Trucking'
  },
  {
    slug: 'mckesson', cik: '0000927653', ticker: 'MCK', name: 'McKesson Corporation',
    domainId: 'medicine', industry: 'Pharmaceutical Distribution + Medical Supplies'
  },
  {
    slug: 'eli_lilly', cik: '0000059478', ticker: 'LLY', name: 'Eli Lilly and Company',
    domainId: 'medicine', industry: 'Pharmaceuticals — diabetes, oncology, immunology'
  },
  {
    slug: 'intel', cik: '0000050863', ticker: 'INTC', name: 'Intel Corporation',
    domainId: 'technology', industry: 'Semiconductor Manufacturing + Foundry'
  },
  // ── Batch 3 (logistics + foreign filers + remaining heavy orphans) ──
  {
    slug: 'dhl_supply_chain', cik: null, ticker: 'DHL.DE', name: 'DHL Supply Chain (Deutsche Post DHL Group)',
    domainId: 'supplyChain', industry: 'Contract Logistics + Express (German public)'
  },
  {
    slug: 'kuehne_nagel', cik: null, ticker: 'KNIN.SW', name: 'Kuehne + Nagel International AG',
    domainId: 'supplyChain', industry: 'Sea + Air + Road Freight Forwarding (Swiss public)'
  },
  {
    slug: 'merck_kgaa', cik: null, ticker: 'MRK.DE', name: 'Merck KGaA (Darmstadt)',
    domainId: 'medicine', industry: 'Life Science Tools (MilliporeSigma) + Healthcare + Electronics (German public — distinct from US Merck & Co.)'
  },
  {
    slug: 'geodis', cik: null, ticker: null, name: 'GEODIS SA',
    domainId: 'supplyChain', industry: 'Contract Logistics + Freight Forwarding (French private, SNCF subsidiary)'
  },
  {
    slug: 'yrc_worldwide', cik: '0000716314', ticker: 'YELLQ', name: 'Yellow Corporation (formerly YRC Worldwide)',
    domainId: 'supplyChain', industry: 'LTL Trucking — entered Chapter 11 August 2023'
  },
  {
    slug: 'sappi', cik: null, ticker: 'SAPJY', name: 'Sappi Limited',
    domainId: 'industry', industry: 'Pulp + Paper + Specialty Chemicals (South African public, JSE/NYSE ADR)'
  },
  {
    slug: 'wabash_national', cik: '0000879526', ticker: 'WNC', name: 'Wabash National Corporation',
    domainId: 'industry', industry: 'Truck Trailer Manufacturing + Tank + Engineered Products'
  },
  {
    slug: 'alphabet', cik: '0001652044', ticker: 'GOOGL', name: 'Alphabet Inc.',
    domainId: 'technology', industry: 'Internet Services + Cloud (Google) + Other Bets'
  },
  {
    slug: 'meta_platforms', cik: '0001326801', ticker: 'META', name: 'Meta Platforms, Inc.',
    domainId: 'technology', industry: 'Social Media + Advertising + Reality Labs'
  },
  {
    slug: 'lonza', cik: null, ticker: 'LONN.SW', name: 'Lonza Group AG',
    domainId: 'medicine', industry: 'Contract Development + Manufacturing (CDMO) — biologics, mammalian cell therapy (Swiss public)'
  }
];

const dryRun = process.argv.includes('--dry-run');
const argSlugs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const selectedTargets = argSlugs.length
  ? TARGETS.filter(t => argSlugs.includes(t.slug))
  : TARGETS;

async function main() {
  console.log('=== LIMEN portal create-new ===');
  console.log('base:    ' + BASE_URL);
  console.log('targets: ' + selectedTargets.map(t => t.slug).join(', '));
  console.log('dryRun:  ' + dryRun);
  console.log('');

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const summary = [];

  for (const target of selectedTargets) {
    console.log('── ' + target.slug + ' ──');
    const filePath = path.join(PORTAL_DIR, target.slug + '.json');

    // If a portal already exists, skip — densify-v2-portals.mjs is the
    // tool for re-running on an existing portal.
    let existed = false;
    try {
      const stat = await fs.stat(filePath);
      existed = stat.isFile();
    } catch (_) { /* doesn't exist, good */ }

    if (existed) {
      console.log('  EXISTS, skipping. Use densify-v2-portals.mjs to re-enrich.');
      summary.push({ slug: target.slug, status: 'skipped-exists' });
      continue;
    }

    const t0 = Date.now();
    try {
      const r = await fetch(BASE_URL + '/api/enrich-portal-claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: target })
      });
      const resp = await r.json();
      const elapsed = (Date.now() - t0) / 1000;
      if (!r.ok || !resp.ok) {
        console.log('  FAIL: ' + (resp.error || 'unknown') + ' (' + elapsed.toFixed(1) + 's)');
        summary.push({ slug: target.slug, status: 'fail', detail: resp.error });
        continue;
      }
      const dr = resp.densityReport || {};
      console.log('  OK: ' + elapsed.toFixed(1) + 's, ' + dr.functionalNetworkTotal + ' entries');
      console.log('    ' + Object.entries(dr.functionalNetworkByCategory || {})
        .map(([k, v]) => k + '=' + v).join(', '));
      console.log('    bannedHits=' + (resp.bannedHits || []).length);

      if (dryRun) {
        summary.push({ slug: target.slug, status: 'dry-run-ok',
                       after: dr.functionalNetworkTotal, elapsedS: elapsed });
        continue;
      }
      await fs.writeFile(filePath, JSON.stringify(resp.portal, null, 2), 'utf8');
      console.log('    WROTE: ' + path.relative(REPO_ROOT, filePath));
      summary.push({
        slug: target.slug, status: 'created',
        after: dr.functionalNetworkTotal, elapsedS: elapsed,
        bannedHits: (resp.bannedHits || []).length
      });
    } catch (err) {
      console.log('  EXCEPTION: ' + err.message);
      summary.push({ slug: target.slug, status: 'exception', detail: err.message });
    }
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.table(summary);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
