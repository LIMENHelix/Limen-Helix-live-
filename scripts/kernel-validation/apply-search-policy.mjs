// One-shot SEO policy applier: indexable = homepage + domain front pages only.
// Rewrites every other HTML file's robots meta to noindex,nofollow and
// regenerates sitemap.xml with the indexable set.
// Usage: node apply-search-policy.mjs <repoRoot>
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.argv[2] || process.cwd();

const ALLOW = new Set([
  'index.html',
  'addiction.html', 'agriculture.html', 'business.html', 'communication.html',
  'contemplative.html', 'culture.html', 'defense.html', 'economy.html',
  'education.html', 'energy.html', 'environment.html', 'finance.html',
  'governance.html', 'industry.html', 'infrastructure.html', 'intelligence.html',
  'law.html', 'medicine.html', 'metabolic.html', 'neurology.html', 'pediatric.html',
  'population.html', 'provider-portal.html', 'psychedelic.html', 'religion.html',
  'science.html', 'technology.html', 'trade.html',
]);

const files = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);

let indexed = 0, noindexed = 0, anomalies = [];
for (const rel of files) {
  const p = path.join(ROOT, rel);
  let text = fs.readFileSync(p, 'utf8');
  const headMatch = text.match(/<head[^>]*>/i);
  if (!headMatch) { anomalies.push(rel + ' (no <head>)'); continue; }

  const want = ALLOW.has(rel)
    ? '<meta name="robots" content="index,follow">'
    : '<meta name="robots" content="noindex,nofollow">';

  // drop every existing robots meta, wherever it sits
  const cleaned = text.replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>\s*/gi, '');

  // re-insert inside <head>: prefer right after charset, else right after <head ...>
  const headTag = cleaned.match(/<head[^>]*>/i)[0];
  const afterHead = cleaned.slice(cleaned.indexOf(headTag) + headTag.length);
  let inserted;
  if (/<meta\s+charset[^>]*>/i.test(afterHead)) {
    inserted = afterHead.replace(/(<meta\s+charset[^>]*>)/i, `$1\n${want}`);
  } else {
    inserted = `\n${want}` + afterHead;
  }
  const out = cleaned.slice(0, cleaned.indexOf(headTag) + headTag.length) + inserted;

  if (out !== text) fs.writeFileSync(p, out);
  (ALLOW.has(rel) ? indexed++ : noindexed++);
}

// regenerate sitemap: homepage first, then domain fronts (stable, alpha)
const urls = ['/', ...[...ALLOW].filter(f => f !== 'index.html').map(f => '/' + f.replace(/\.html$/, ''))];
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemaps/0.9">
${urls.map((u, i) => `  <url><loc>https://limenhelix.com${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${i === 0 ? '1.0' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

console.log(JSON.stringify({
  total: files.length, indexed, noindexed,
  anomalies: anomalies.length, anomalySample: anomalies.slice(0, 5),
  sitemapUrls: urls.length,
}, null, 1));
