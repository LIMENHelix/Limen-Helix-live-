import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Local evidence reconciliation only. No network requests or route mutations.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('Pass the readable inventory Markdown path');
const raw = fs.readFileSync(source, 'utf8');
const routes = [];
const brokenLinks = [];
let brokenSection = false;
for (const line of raw.split(/\r?\n/)) {
  if (line.startsWith('## ')) brokenSection = line.includes('Broken internal links');
  const cells = line.split(/(?<!\\)\|/).map(x => x.trim());
  const link = line.match(/\]\((https:\/\/limenhelix\.com[^)]*)\)/);
  if (!link) continue;
  const route = new URL(link[1]).pathname;
  if (brokenSection && cells[2] === '404') { brokenLinks.push({ route, sourceStatus: 404 }); continue; }
  if (!/^\d+$/.test(cells[1] || '')) continue;
  const localHtml = path.join(root, route.slice(1) + '.html');
  const localJson = path.join(root, 'assets/data', route.slice(1) + '.json');
  routes.push({ index: Number(cells[1]), route, title: cells[3], audience: cells[4],
    sourceStatus: Number(cells[5]), sourceKind: cells[6],
    localHtmlPresent: fs.existsSync(localHtml), localDataPresent: fs.existsSync(localJson),
    legacyStatus: 'unresolved: no retirement authority inferred from name or HTTP status' });
}
if (routes.length !== 3468 || brokenLinks.length !== 27) throw new Error('Source counts changed; inspect before adopting');
const seen = new Set();
const duplicates = [];
for (const row of routes) { if (seen.has(row.route)) duplicates.push(row.route); seen.add(row.route); }
const htmlFiles = execFileSync('git', ['ls-files', '-z', '*.html'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  .split('\0').filter(file => file && !file.startsWith('work/'));
const references = new Map(brokenLinks.map(row => [row.route, []]));
for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      let target;
      try { target = new URL(match[1], 'https://limenhelix.com/' + file); } catch { continue; }
      if (target.origin !== 'https://limenhelix.com') continue;
      const clean = target.pathname.replace(/\.html$/, '');
      if (references.has(clean)) references.get(clean).push({ file, line: index + 1, href: match[1] });
    }
  });
}
const report = {
  schemaVersion: 'continuity-route-reconciliation/1.0',
  source: path.resolve(source), sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
  evidenceLevel: 'LOCAL source inventory; source-reported HTTP, no fresh live crawl',
  categories: {
    inventoried: routes.length, sourceReportedLive: routes.filter(r => r.sourceStatus === 200).length,
    sourceReportedNon200: routes.filter(r => r.sourceStatus !== 200).length,
    operator: routes.filter(r => r.audience === 'Operator').length,
    customer: routes.filter(r => r.audience === 'Customer').length,
    unknownAudience: routes.filter(r => !['Operator', 'Customer'].includes(r.audience)).length,
    duplicateRoutes: duplicates.length, brokenLinks: brokenLinks.length,
    legacy: 'unresolved: requires explicit provenance/retirement evidence',
    dataOnly: 'unresolved: HTML inventory does not enumerate data endpoints'
  }, duplicates, brokenLinks: brokenLinks.map(row => ({ ...row,
    inFullInventory: seen.has(row.route), localHtmlPresent: fs.existsSync(path.join(root, row.route.slice(1) + '.html')),
    localReferences: references.get(row.route),
    disposition: 'confirmed source-reported broken link; destination ownership/provenance must be inspected before replacement'
  })), routes
};
const output = path.join(root, 'docs/audits/continuity-route-reconciliation.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, categories: report.categories }, null, 2));
