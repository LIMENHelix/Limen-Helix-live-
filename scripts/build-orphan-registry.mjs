#!/usr/bin/env node
/**
 * build-orphan-registry.mjs — Fractal stakeholder registry.
 *
 * Walks every v2 portal's functionalNetwork and records every referenced
 * counterparty that does NOT have its own portal file ("orphan"). The output
 * (assets/data/orphan-stakeholders.json) lets company-portal.html render a
 * real structural node-view for any orphan instead of "Company not found" —
 * so the fractal vendor recursion never dead-ends while deep portals are
 * authored over time.
 *
 * Archetype is inferred from the functionalNetwork category the orphan is
 * referenced in (a regulator is NOT a kernel-scored company; it's a salience
 * leaf-node). When an orphan appears in multiple categories the company-side
 * categories win (suppliers/customers/competitors/logistics) since those are
 * densification candidates; otherwise the dominant leaf category is used.
 *
 * Re-run after each densification batch (orphans that gain a portal drop out).
 *   node scripts/build-orphan-registry.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const OUT = path.join(__dirname, '..', 'assets', 'data', 'orphan-stakeholders.json');
const ALIAS_PATH = path.join(__dirname, '..', 'assets', 'data', 'company-aliases.json');

// alias map (aliasSlug -> canonical portal slug). Referenced slugs are resolved
// through it BEFORE orphan classification, so the 360 known duplicate slugs
// (akamai->akamai_technologies, etc.) collapse onto their canonical and never
// appear as separate Tier-2 densification candidates.
let ALIAS = {};
try { ALIAS = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8')).aliases || {}; } catch (e) {}

const CAT_ARCHETYPE = {
  suppliers: 'company', customers: 'company', competitors: 'company', logisticsPartners: 'company',
  capitalProviders: 'capital', regulators: 'regulator', auditor: 'auditor',
  executiveTeam: 'executive', marketSignals: 'market-signal', model: 'company'
};
const COMPANY_CATS = new Set(['suppliers', 'customers', 'competitors', 'logisticsPartners']);

// Government-entity detector. Agencies (DoD, VA, USPS, GSA, NIH...) are often
// referenced as CUSTOMERS, so the dominant-category rule mis-buckets them as
// "company" and they'd get a full kernel-scored portal. They are counterparty
// HUBS, not companies — classify them 'government' (a leaf archetype, NOT a
// densify candidate) so they render as structural hub nodes instead. Patterns
// are precise to avoid flagging companies (FedEx="Federal Express", General
// Dynamics, National Grid, Intercontinental Exchange="ICE" all stay companies).
const GOV_STRONG = [
  /\bdepartment\s+of\b/i, /\bdept\.?\s+of\b/i, /\bministry\s+of\b/i,
  /\b(u\.?s\.?|united\s+states|royal|federal)\s+(army|navy|air\s+force|space\s+force|marine\s+corps|coast\s+guard|national\s+guard|postal\s+service|mint|forest\s+service|geological\s+survey|department)\b/i,
  /\bveterans\s+affairs\b/i, /\b(city|state|county|commonwealth)\s+of\s+[A-Z]/,
  /\bpentagon\b/i, /\bwhite\s+house\b/i, /\b(european\s+commission|european\s+union)\b/i,
  /\bgovernment\b/i, /\bgovt\.?\b/i, /\bpostal\s+service\b/i,
  /\bnational\s+(security\s+agency|institutes?\s+of\s+health|aeronautics|guard|park\s+service|oceanic|nuclear)\b/i,
  /\b(internal\s+revenue|social\s+security\s+administration)\b/i
];
const GOV_ACR = new Set(['dod', 'usps', 'gsa', 'faa', 'epa', 'nasa', 'nsa', 'fbi', 'dea', 'atf', 'irs', 'ferc', 'nrc', 'cms', 'cdc', 'nih', 'darpa', 'hhs', 'dhs', 'doj', 'tsa', 'fema', 'noaa', 'usgs', 'usaid', 'dla', 'jwcc', 'cbp', 'uscis', 'cisa', 'sba', 'gao', 'omb', 'cbo', 'nist', 'dia', 'nga', 'nro', 'socom', 'centcom', 'pentagon', 'usaf', 'uscg', 'navsea']);
const _tok = s => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
function isGovernment(name, slug) {
  if (GOV_STRONG.some(re => re.test(name || ''))) return true;
  const nt = _tok(name), st = _tok(slug);
  for (const a of GOV_ACR) if (nt.has(a) || st.has(a)) return true;
  return false;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const slugSet = new Set(files.map(f => f.replace(/\.json$/, '')));

const orphans = {};
for (const f of files) {
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const fn = p.functionalNetwork || {};
  const ownerSlug = p.slug || f.replace(/\.json$/, '');
  for (const cat in fn) {
    const arr = Array.isArray(fn[cat]) ? fn[cat] : (fn[cat] && typeof fn[cat] === 'object' ? [fn[cat]] : []);
    for (const e of arr) {
      if (!e || typeof e !== 'object' || !e.slug) continue;
      const eff = ALIAS[e.slug] || e.slug;        // resolve alias -> canonical
      if (slugSet.has(eff)) continue;             // resolves to a real portal → not an orphan
      const o = orphans[eff] || (orphans[eff] = {
        slug: eff, name: e.name || eff, refCount: 0, cats: {},
        neuralRole: e.neuralRole || null, brainNodeId: e.brainNodeId || null,
        sampleRole: e.relationshipNote || e.brainNodeRole || e.role || null,
        domains: {}, referencedBy: []
      });
      o.refCount++;
      o.cats[cat] = (o.cats[cat] || 0) + 1;
      if (p.domainId) o.domains[p.domainId] = (o.domains[p.domainId] || 0) + 1;
      if (o.referencedBy.length < 8 && o.referencedBy.indexOf(ownerSlug) === -1) o.referencedBy.push(ownerSlug);
      if (!o.name && e.name) o.name = e.name;
      if (!o.sampleRole && e.relationshipNote) o.sampleRole = e.relationshipNote;
    }
  }
}

const byArchetype = {};
const registry = {};
for (const slug in orphans) {
  const o = orphans[slug];
  const cats = Object.keys(o.cats);
  // Classify by the DOMINANT (most-frequent) category, NOT "appears in any
  // company category" — regulators (SEC), index funds (Vanguard) and auditors
  // (Deloitte) get mis-filed into a supplier/competitor slot in a few portals,
  // but their dominant category reveals what they actually are (a leaf-node,
  // not a kernel-scored company / densification candidate).
  const dominant = cats.sort((a, b) => o.cats[b] - o.cats[a])[0];
  let archetype = COMPANY_CATS.has(dominant) ? 'company' : (CAT_ARCHETYPE[dominant] || 'other');
  // government override applies ONLY to would-be companies — leaves true
  // regulators/auditors/etc. classified as they were.
  if (archetype === 'company' && isGovernment(o.name, slug)) archetype = 'government';
  byArchetype[archetype] = (byArchetype[archetype] || 0) + 1;
  registry[slug] = {
    name: o.name, archetype, refCount: o.refCount,
    categories: o.cats, neuralRole: o.neuralRole, brainNodeId: o.brainNodeId,
    role: o.sampleRole, domains: Object.keys(o.domains), referencedBy: o.referencedBy,
    densifyCandidate: archetype === 'company'
  };
}

const out = {
  schemaVersion: 'orphan-stakeholders/1.0',
  generatedAt: new Date().toISOString(),
  total: Object.keys(registry).length,
  byArchetype,
  note: 'Orphan = referenced in a portal functionalNetwork but no portal file of its own. company-portal.html renders a structural node-view from this when ?company=<slug> has no .json. Leaf archetypes (regulator/auditor/capital/executive/market-signal) are NOT densification candidates.',
  orphans: registry
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('orphan registry written:', OUT);
console.log('total orphans:', out.total);
console.log('byArchetype:', JSON.stringify(byArchetype));
console.log('densify candidates (company):', byArchetype.company || 0);
console.log('bytes:', Buffer.byteLength(JSON.stringify(out)));
