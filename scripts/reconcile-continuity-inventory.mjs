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
// Distinct URLs may ship identical documents. Keep URL duplication and byte
// duplication separate; neither is retirement or alias authority.
const contentHashes = new Map();
for (const row of routes) {
  if (!row.localHtmlPresent) continue;
  const file = row.route.slice(1) + '.html';
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const group = contentHashes.get(digest) || [];
  group.push({ route: row.route, file });
  contentHashes.set(digest, group);
}
const duplicateContentGroups = Array.from(contentHashes, ([sha256, entries]) => ({ sha256, entries }))
  .filter(group => group.entries.length > 1);
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
const dataAssets = execFileSync('git', ['ls-files', '-z', 'assets/data/*.json'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  .split('\0').filter(Boolean);
// This is a local asset category, not an assertion that each file is an HTTP
// page or that a dynamically rendered page cannot consume it.
const retiredApi = fs.readFileSync(path.join(root, 'handlers/relay-checkout.js'), 'utf8');
const explicitLegacyRoutes = retiredApi.includes('api/relay-checkout — RETIRED.') && retiredApi.includes('410')
  ? [{ route: '/api/relay-checkout', disposition: 'registered retired endpoint; returns 410',
    source: 'handlers/relay-checkout.js', inSourcePageInventory: seen.has('/api/relay-checkout') }] : [];
const repairPath = path.join(root, 'docs/audits/continuity-navigation-repair.json');
const navigationRepairs = fs.existsSync(repairPath) ? JSON.parse(fs.readFileSync(repairPath, 'utf8')) : null;
// Dispositions overlay the historical inventory; they do not rewrite its
// audience or HTTP observations. Reject provenance drift before adopting it.
const exclusionSource = 'docs/audits/continuity-route-exclusion-provenance-20261001.json';
const exclusionRaw = fs.readFileSync(path.join(root, exclusionSource), 'utf8');
const exclusions = JSON.parse(exclusionRaw);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (sha256(fs.readFileSync(path.join(root, exclusions.ignoreFile))) !== exclusions.ignoreSha256)
  throw new Error('Exclusion configuration drift; refresh provenance before reconciliation');
const currentRouteDispositions = exclusions.routes.map(entry => {
  if (!seen.has(entry.route) || sha256(fs.readFileSync(path.join(root, entry.file))) !== entry.fileSha256)
    throw new Error(`Exclusion source drift: ${entry.route}`);
  const dynamic = entry.kind === 'DEEP_STATIC_PORTAL_EXCLUDED';
  const replacement = dynamic ? '/portal?domain=energy&l2=datacenter&l3=powerdemand&l4=rackdensity' +
    (entry.route.includes('_hvpower_') ? '&l5=hvpower' : '') : null;
  return { route: entry.route, kind: entry.kind, replacement,
    disposition: dynamic ? 'excluded static file; dynamic replacement independently observed' : 'repository reference explicitly excluded from deployment',
    provenance: exclusionSource, provenanceSha256: sha256(exclusionRaw),
    liveObservationSource: entry.liveObservationSource,
    replacementEvidence: dynamic ? ['docs/audits/continuity-dynamic-portal-probe-20261001.json',
      'docs/audits/continuity-dynamic-portal-render-20261001.json'] : [],
    scope: 'saved observations at their recorded timestamps; no new crawl or publication authority' };
});
const checkoutSource = 'pages/relay-checkout.html';
const checkout = fs.readFileSync(path.join(root, checkoutSource), 'utf8');
if (!checkout.includes('/relay') || !/retir/i.test(checkout)) throw new Error('Checkout retirement source changed');
currentRouteDispositions.push({ route: exclusions.unresolved.route, kind: 'LOCAL_RETIRED_PAGE_PUBLIC_MAPPING_UNRESOLVED',
  disposition: 'local page explicitly retires simulated checkout toward /relay; inventoried root URL mapping unresolved',
  source: checkoutSource, sourceSha256: sha256(checkout), liveObservationSource: 'docs/audits/continuity-live-route-probe-20261001.json',
  scope: 'separate API registrations do not establish root page mapping; no new retirement or publication action' });
const unknownRoutes = routes.filter(row => !['Operator', 'Customer'].includes(row.audience));
if (unknownRoutes.length !== currentRouteDispositions.length ||
    unknownRoutes.some(row => !currentRouteDispositions.some(entry => entry.route === row.route)))
  throw new Error('Unknown route coverage changed; inspect before adopting dispositions');
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
    unknownRouteDispositionCoverage: {
      excludedReferences: currentRouteDispositions.filter(row => ['INTERNAL_REFERENCE_EXCLUDED', 'EXTERNAL_SCRAPE_REFERENCE_EXCLUDED'].includes(row.kind)).length,
      excludedStaticWithObservedDynamicReplacement: currentRouteDispositions.filter(row => row.kind === 'DEEP_STATIC_PORTAL_EXCLUDED').length,
      localRetirementWithUnresolvedPublicMapping: currentRouteDispositions.filter(row => row.kind === 'LOCAL_RETIRED_PAGE_PUBLIC_MAPPING_UNRESOLVED').length,
      historicalAudienceLabelsUnchanged: true },
    duplicateRoutes: duplicates.length, duplicateLocalContentGroups: duplicateContentGroups.length, brokenLinks: brokenLinks.length,
    localRemainingReferencedBrokenTargets: brokenLinks.filter(row => references.get(row.route).length > 0).length,
    localNavigationRepairedTargets: navigationRepairs ? navigationRepairs.repairedTargets : 0,
    legacy: { explicitlyRetiredLocalRoutes: explicitLegacyRoutes.length, sourcePageLegacyStatus: 'unresolved without explicit retirement provenance' },
    dataOnly: { localJsonAssets: dataAssets.length, scope: 'JSON asset files, not equivalent to rendered page routes; live data endpoint inventory unverified' }
  }, currentRouteDispositions, explicitLegacyRoutes, dataAssets, duplicates, duplicateContentGroups, brokenLinks: brokenLinks.map(row => ({ ...row,
    inFullInventory: seen.has(row.route), localHtmlPresent: fs.existsSync(path.join(root, row.route.slice(1) + '.html')),
    localReferences: references.get(row.route),
    disposition: navigationRepairs && navigationRepairs.repairs.some(repair => repair.missingTarget === row.route)
      ? 'locally repaired navigation; historical source HTTP status retained; not deployed'
      : 'source-reported broken link; unresolved destination/function; local references retained'
  })), routes
};
const output = path.join(root, 'docs/audits/continuity-route-reconciliation.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, categories: report.categories }, null, 2));
