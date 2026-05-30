#!/usr/bin/env node
/**
 * scripts/build-companies-manifest.mjs
 *
 * Walks assets/data/companies/*.json and writes a manifest that
 * helix-portal-coverage.html (and other pages) can fetch to know
 * which slugs exist. Vercel doesn't serve directory listings, so
 * we generate this manifest as a static asset.
 *
 * Output: assets/data/companies-manifest.json
 *   {
 *     generatedAt: <iso>,
 *     count: <int>,
 *     slugs: [<slug>, ...],
 *     index: { <slug>: { name, ticker, cik, domain, schemaVersion } }
 *   }
 *
 * Run after any v1→v2 migration batch or new portal authoring.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');
const OUT_PATH = path.join(REPO_ROOT, 'assets', 'data', 'companies-manifest.json');

async function main() {
  const entries = await fs.readdir(PORTAL_DIR);
  const slugs = [];
  const index = {};
  for (const e of entries) {
    if (!e.endsWith('.json')) continue;
    if (e.startsWith('_')) continue;
    const slug = e.replace(/\.json$/, '');
    try {
      const raw = await fs.readFile(path.join(PORTAL_DIR, e), 'utf8');
      const p = JSON.parse(raw);
      slugs.push(slug);
      index[slug] = {
        name: p.name || slug,
        ticker: p.ticker || null,
        cik: p.cik || null,
        domain: p.domainId || null,
        schemaVersion: p.schemaVersion || null
      };
    } catch (err) {
      console.error('skip ' + slug + ': ' + err.message);
    }
  }
  slugs.sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    count: slugs.length,
    slugs: slugs,
    index: index
  };
  await fs.writeFile(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Wrote ' + path.relative(REPO_ROOT, OUT_PATH));
  console.log('  count: ' + manifest.count);
  console.log('  v2: ' + slugs.filter(s => index[s].schemaVersion === '2.0.1').length);
  console.log('  v1: ' + slugs.filter(s => index[s].schemaVersion !== '2.0.1').length);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
