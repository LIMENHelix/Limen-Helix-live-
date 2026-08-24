#!/usr/bin/env node
'use strict';

/*
 * Read-only structural inventory of the company/domain/HELIX topology.
 * This deliberately reports wiring and identity facts separately from
 * runtime quality. A file existing is not evidence that its content works.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const listJson = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.json'));
const normCik = (v) => v == null || v === '' ? null : String(v).replace(/^0+(?=\d)/, '');
const sorted = (v) => [...v].sort();
const uniq = (v) => [...new Set(v)];
const has = (file, text) => fs.readFileSync(path.join(ROOT, file), 'utf8').includes(text);

const companyRegistry = readJson('assets/data/company-registry.json');
const companyIndex = readJson('assets/data/company-index.json');
const entityRegistry = readJson('assets/data/entity-registry.json');
const companyFiles = new Set(listJson('assets/data/companies').map((f) => f.replace(/\.json$/, '')));
const connectomeText = fs.readFileSync(path.join(ROOT, 'assets/js/civilization-connectome.js'), 'utf8');
const connectomeSlugs = [...connectomeText.matchAll(/company-portal\?company=([^'"&]+)/g)].map((m) => decodeURIComponent(m[1]));
const connectomeSlugCounts = new Map();
for (const slug of connectomeSlugs) connectomeSlugCounts.set(slug, (connectomeSlugCounts.get(slug) || 0) + 1);
const connectomeDuplicates = sorted([...connectomeSlugCounts.entries()].filter(([, n]) => n > 1).map(([slug]) => slug));
const connectomeMissingIdentityFiles = sorted(uniq(connectomeSlugs).filter((slug) => !companyFiles.has(slug)));

const registrySlugs = Object.keys(companyRegistry.bySlug || {});
const registryDomainEntries = Object.entries(companyRegistry.byDomain || {}).flatMap(([domain, slugs]) =>
  (Array.isArray(slugs) ? slugs : Object.keys(slugs)).map((slug) => ({ domain, slug })));
const slugDomains = new Map();
for (const { domain, slug } of registryDomainEntries) {
  if (!slugDomains.has(slug)) slugDomains.set(slug, []);
  slugDomains.get(slug).push(domain);
}
const duplicateDomainMembership = [...slugDomains.entries()]
  .filter(([, domains]) => uniq(domains).length > 1)
  .map(([slug, domains]) => ({ slug, domains: sorted(uniq(domains)) }));

const missingIdentityFiles = registrySlugs.filter((slug) => !companyFiles.has(slug));
const orphanIdentityFiles = sorted([...companyFiles].filter((slug) => !registrySlugs.includes(slug)));
const invalidIdentityFiles = [];
const identityDomainMismatches = [];
const identityCikMismatches = [];
for (const slug of registrySlugs) {
  if (!companyFiles.has(slug)) continue;
  const rec = readJson(`assets/data/companies/${slug}.json`);
  if (rec.slug !== slug || rec.type !== 'company') invalidIdentityFiles.push({ slug, reason: 'type-or-slug' });
  const listed = companyRegistry.bySlug[slug] || {};
  if (listed.domain && rec.domainId && listed.domain !== rec.domainId) {
    identityDomainMismatches.push({ slug, registry: listed.domain, identity: rec.domainId });
  }
  if (listed.cik != null && normCik(listed.cik) !== normCik(rec.cik)) {
    identityCikMismatches.push({ slug, registry: listed.cik, identity: rec.cik });
  }
}

const indexSlugs = Object.keys(companyIndex.companies || {});
const indexOnlySlugs = sorted(indexSlugs.filter((slug) => !registrySlugs.includes(slug)));
const registryOnlySlugs = sorted(registrySlugs.filter((slug) => !indexSlugs.includes(slug)));
const indexDomainMismatches = [];
for (const slug of registrySlugs) {
  const a = companyRegistry.bySlug[slug];
  const b = companyIndex.companies[slug];
  if (a && b && a.domain && b.domainId && a.domain !== b.domainId) {
    indexDomainMismatches.push({ slug, registry: a.domain, index: b.domainId });
  }
}

const entityCompanies = [];
for (const [domain, domainData] of Object.entries(entityRegistry.domains || {})) {
  for (const [portalId, portal] of Object.entries(domainData.portals || {})) {
    for (const entity of portal.entities || []) {
      if (entity.entityType === 'company') entityCompanies.push({ domain, portalId, name: entity.name, ticker: entity.ticker || null, cik: entity.cik || null });
    }
  }
}
const entityMissingCik = entityCompanies.filter((e) => !e.cik);
const entityCikNotInRegistry = entityCompanies.filter((e) => e.cik && !companyRegistry.byCik?.[normCik(e.cik)]);

const brainFiles = fs.readdirSync(path.join(ROOT, 'assets/js/domain-brains')).filter((f) => /^.+-brain\.js$/.test(f));
const refreshFiles = fs.readdirSync(path.join(ROOT, 'assets/js/domain-brains')).filter((f) => /^.+-refresh-controller\.js$/.test(f));
const brainDomains = sorted(brainFiles.map((f) => f.replace(/-brain\.js$/, '')).filter((d) => d !== 'domain-console'));
const refreshDomains = sorted(refreshFiles.map((f) => f.replace(/-refresh-controller\.js$/, '')));
const companyRegistryDomains = sorted(Object.keys(companyRegistry.byDomain || {}));
const companyOnlyDomains = companyRegistryDomains.filter((d) => !brainDomains.includes(d));
const brainOnlyDomains = brainDomains.filter((d) => !companyRegistryDomains.includes(d));
const walk = (dir) => {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.name === 'portal.html' || /(?:-|_)portal\.html$/.test(ent.name)) out.push(full);
  }
  return out;
};
const allPortalHtmlFiles = walk(ROOT);
const rootSharedPortalNames = new Set(['company-portal.html', 'helix-report.html', 'authority-portal.html', 'provider-portal.html', 'portal.html']);
const topicPortalHtmlFiles = allPortalHtmlFiles.filter((f) => !rootSharedPortalNames.has(path.basename(f)));

const companyPortal = fs.readFileSync(path.join(ROOT, 'company-portal.html'), 'utf8');
const helixReport = fs.readFileSync(path.join(ROOT, 'helix-report.html'), 'utf8');
const artifactUi = fs.readFileSync(path.join(ROOT, 'assets/js/limen/artifact-list-ui.js'), 'utf8');
const staticHandoff = {
  companyToHelixCikLink: companyPortal.includes("helix-report.html?cik=") ,
  companyPostsCikToHelix: companyPortal.includes("/api/helix/helix-report/score") && /cik\s*:\s*String\(co\.cik\)/.test(companyPortal),
  companyMapsThing1: companyPortal.includes('validated_signal'),
  companyMapsThing2: companyPortal.includes('phase_tracker_signal'),
  helixReadsCikParam: helixReport.includes("get('cik')") || helixReport.includes('get("cik")'),
  helixRunsAnalysis: helixReport.includes('runAnalysis()'),
  helixLabelsThing2Interpretive: helixReport.includes('INTERPRETIVE'),
  helixLabelsThing2Unvalidated: helixReport.includes('UNVALIDATED'),
};
const staleLaneVocabulary = artifactUi.includes('LANES = [\'investment\', \'research\']') && /six engine lanes|patent.*grant.*sba.*franchise/i.test(artifactUi);

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'repository structural inventory; no provider, broker, Redis write, or runtime trigger',
  counts: {
    companyRegistryEntries: companyRegistry.counts?.portals ?? registryDomainEntries.length,
    companyRegistryUniqueSlugs: registrySlugs.length,
    companyRegistryGeneratedAt: companyRegistry.generatedAt || null,
    companyIdentityFiles: companyFiles.size,
    companyIndexEntries: indexSlugs.length,
    connectomeCompanyEntries: connectomeSlugs.length,
    connectomeUniqueCompanySlugs: uniq(connectomeSlugs).length,
    entityRegistryDomains: Object.keys(entityRegistry.domains || {}).length,
    entityRegistryCompanyEntities: entityCompanies.length,
    domainBrainFiles: brainDomains.length,
    refreshControllerFiles: refreshDomains.length,
    rootPortalHtmlFiles: fs.readdirSync(ROOT).filter((f) => f.endsWith('-portal.html')).length,
    allPortalHtmlFiles: allPortalHtmlFiles.length,
    topicPortalHtmlFiles: topicPortalHtmlFiles.length,
  },
  identity: {
    registryBackedMissingIdentityFiles: missingIdentityFiles,
    expandedIdentityFilesOutsideCompanyRegistry: orphanIdentityFiles,
    invalidIdentityFiles,
    duplicateDomainMembership,
    identityDomainMismatches,
    identityCikMismatches,
    indexOnlySlugs,
    registryOnlySlugs,
    indexDomainMismatches,
    connectomeDuplicateSlugs: connectomeDuplicates,
    connectomeMissingIdentityFiles,
    entityCompaniesMissingCik: entityMissingCik,
    entityCompaniesWithCikNotInCompanyRegistry: entityCikNotInRegistry,
  },
  runtimeTopology: {
    brainDomains,
    refreshDomains,
    companyRegistryDomains,
    companyOnlyDomains,
    brainOnlyDomains,
    companyPortalAndHelixReportAreSharedSurfaces: true,
    staticHandoff,
  },
  vocabulary: {
    artifactUiInvestmentResearchLanes: artifactUi.includes("LANES = ['investment', 'research']"),
    staleSixLaneCopyPresent: staleLaneVocabulary,
    note: 'This reports vocabulary mismatch in source text; it does not infer whether a lane is operational.',
  },
  interpretation: {
    registryBackedIdentityFilesMissing: missingIdentityFiles.length > 0,
    connectomeIdentityFilesMissing: connectomeMissingIdentityFiles.length > 0,
    duplicateIdentityMembership: duplicateDomainMembership.length > 0,
    crossRegistryDivergence: identityDomainMismatches.length + identityCikMismatches.length + indexDomainMismatches.length > 0,
    entityRegistryHasUnlinkedCompanies: entityMissingCik.length > 0 || entityCikNotInRegistry.length > 0,
    sharedHandoffInvariantFailure: Object.values(staticHandoff).some((v) => v === false),
    domainBrainCoverageDiffersFromCompanyRegistry: brainDomains.length !== Object.keys(companyRegistry.byDomain || {}).length,
    staleLaneVocabulary,
  },
};
console.log(JSON.stringify(out, null, 2));
