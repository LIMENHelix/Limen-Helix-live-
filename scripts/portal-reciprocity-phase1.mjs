#!/usr/bin/env node
/**
 * Phase 1: Reciprocity stub structural inheritance.
 *
 * Walks every portal under assets/data/companies/. For each entry
 * marked `_autoReciprocityFill: true`, finds the partner's reciprocal
 * entry and INHERITS (never invents) structural fields:
 *
 *   sourceType  ← partner.sourceType + ',reciprocity_inferred'
 *   confidence  ← partner.confidence × 0.9 (floor 0.30, ceil 0.85)
 *   brainNodeId ← partner.brainNodeId
 *   brainNodeRole ← category-default in THIS portal's voice
 *   neuralRole   ← category-default in THIS portal's voice
 *
 * Adds `_reciprocityResolvedAt` timestamp + `_resolvedFromPartnerEntry`
 * with the partner-side fingerprint so the inheritance chain stays
 * auditable.
 *
 * Phase 1 does NOT touch `relationshipNote` — that's phase 2 (Claude
 * prose rewrite). Phase 1 is pure-local, deterministic, reversible.
 *
 * Asymmetric refs (partner has no reciprocal entry) get
 * `_orphanedStub: true` and are listed in the run summary.
 *
 *   node scripts/portal-reciprocity-phase1.mjs --dry-run
 *   node scripts/portal-reciprocity-phase1.mjs --dry-run --sample 5
 *   node scripts/portal-reciprocity-phase1.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf('--' + name);
  return i === -1 ? fallback : args[i + 1];
}
function flag(name) { return args.indexOf('--' + name) !== -1; }

const DRY = flag('dry-run') || !flag('apply');
const APPLY = flag('apply') && !flag('dry-run');
const SAMPLE = parseInt(arg('sample', '0'), 10) || 0;
const ONLY = arg('only', '');
const DIR = path.resolve('assets/data/companies');

// ─── Category mirroring rules ──────────────────────────────────────
// If THIS portal has the stub in `customers`, the partner's matching
// entry should be in `suppliers` (or `logisticsPartners` for transport).
const RECIPROCAL_CATEGORIES = {
  customers:         ['suppliers', 'logisticsPartners'],
  suppliers:         ['customers'],
  competitors:       ['competitors'],
  logisticsPartners: ['customers'],
  capitalProviders:  ['capitalProviders'], // rare reciprocal
  regulators:        []                    // typically unidirectional
};

// Categories where the partner's brainNodeRole / neuralRole describe a
// SYMMETRIC relationship (e.g., "Direct Competitor" / "Peer" work for
// either end). Safe to inherit partner's specific role text.
const SYMMETRIC_CATEGORIES = new Set(['competitors']);

// Category-derived defaults for brainNodeRole + neuralRole, in THIS
// portal's voice. These are STRUCTURAL defaults, not invented facts.
// Used for ASYMMETRIC categories (customers/suppliers/etc.) where the
// partner's role describes the opposite-direction relationship and
// cannot be safely mirrored back.
const CATEGORY_DEFAULTS = {
  customers: {
    brainNodeRole: 'downstream_demand_anchor',
    neuralRole:    'feedforward_demand_signal'
  },
  suppliers: {
    brainNodeRole: 'upstream_supply_anchor',
    neuralRole:    'feedforward_supply_signal'
  },
  competitors: {
    brainNodeRole: 'competitive_pressure_node',
    neuralRole:    'lateral_inhibition'
  },
  logisticsPartners: {
    brainNodeRole: 'transport_logistics_node',
    neuralRole:    'transmission_throughput'
  },
  capitalProviders: {
    brainNodeRole: 'capital_supply_node',
    neuralRole:    'energy_supply'
  }
};

// ─── Helpers ───────────────────────────────────────────────────────
function readPortal(slug) {
  const p = path.join(DIR, slug + '.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function writePortal(slug, data) {
  const p = path.join(DIR, slug + '.json');
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function fingerprint(slug, cik, name) {
  return [slug || '', cik || '', (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)].join('|');
}

function matchesEntry(entry, targetSlug, targetCik, targetName) {
  if (!entry || typeof entry !== 'object') return false;
  if (targetSlug && entry.slug === targetSlug) return true;
  if (targetCik && entry.cik && String(entry.cik).replace(/^0+/, '') === String(targetCik).replace(/^0+/, '')) return true;
  if (targetName && entry.name) {
    const a = String(entry.name).toLowerCase().replace(/[^a-z0-9]/g, '');
    const b = String(targetName).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (a && b && (a === b || a.includes(b.slice(0, 12)) || b.includes(a.slice(0, 12)))) return true;
  }
  return false;
}

function findReciprocalEntry(partnerPortal, thisSlug, thisCik, thisName, thisCategory, hintCategory) {
  if (!partnerPortal || !partnerPortal.functionalNetwork) return { found: null, category: null };
  // Try the hint first (the category on the partner the reciprocity walker
  // says the reciprocal entry was found in), then the standard reciprocal
  // candidates derived from this side's category.
  const cands = [];
  if (hintCategory && typeof hintCategory === 'string') cands.push(hintCategory);
  for (const c of (RECIPROCAL_CATEGORIES[thisCategory] || [])) {
    if (cands.indexOf(c) === -1) cands.push(c);
  }
  for (const cat of cands) {
    const arr = partnerPortal.functionalNetwork[cat];
    if (!Array.isArray(arr)) continue;
    for (const e of arr) {
      if (matchesEntry(e, thisSlug, thisCik, thisName)) {
        return { found: e, category: cat };
      }
    }
  }
  return { found: null, category: null };
}

// Confidence in this corpus is normally a string ("high"/"medium"/"low")
// but a few portals use numeric 0..1. Inherit in the SAME shape with a
// one-step downshift to signal reciprocity dampening (high→medium etc.).
const STRING_DOWNSHIFT = { high: 'medium', medium: 'low', low: 'low' };
function inheritedConfidence(partnerConf) {
  if (typeof partnerConf === 'string') {
    const k = partnerConf.toLowerCase().trim();
    if (STRING_DOWNSHIFT[k]) return STRING_DOWNSHIFT[k];
    return 'low';
  }
  if (typeof partnerConf === 'number' && !isNaN(partnerConf)) {
    const scaled = partnerConf * 0.9;
    return Math.max(0.30, Math.min(0.85, Number(scaled.toFixed(2))));
  }
  return 'low'; // unknown partner confidence → conservative default
}

// sourceType is always an array in this corpus (11,289 array forms,
// 0 strings). Inherit partner's array and append 'reciprocity_inferred'
// so the audit chain is preserved.
function mergedSourceType(partnerSourceType) {
  let base = [];
  if (Array.isArray(partnerSourceType)) {
    base = partnerSourceType.slice();
  } else if (typeof partnerSourceType === 'string' && partnerSourceType.length > 0) {
    // Defensive — corpus doesn't currently use string form, but if a
    // stray entry exists, split on commas to honor the apparent intent.
    base = partnerSourceType.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (base.indexOf('reciprocity_inferred') === -1) base.push('reciprocity_inferred');
  return base;
}

// ─── Main resolver ─────────────────────────────────────────────────
function resolvePortal(portal, partnerCache) {
  const changes = [];
  const orphans = [];
  const fn = portal.functionalNetwork || {};
  const thisSlug = portal.slug;
  const thisCik = portal.cik;
  const thisName = portal.name;

  for (const category of Object.keys(fn)) {
    const arr = fn[category];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (!e || !e._autoReciprocityFill) continue;

      // Partner identity = the entity this stub REPRESENTS (entry.slug).
      // _filledFrom is the CATEGORY on the partner where the reciprocity
      // walker found the matching entry — use it as a search hint.
      const partnerSlug = e.slug;
      const hintCategory = e._filledFrom;
      if (!partnerSlug) {
        orphans.push({ category, index: i, name: e.name, reason: 'no .slug on stub entry' });
        e._orphanedStub = true;
        changes.push({ type: 'orphan_no_partner', category, name: e.name });
        continue;
      }

      let partner = partnerCache.get(partnerSlug);
      if (partner === undefined) {
        partner = readPortal(partnerSlug);
        partnerCache.set(partnerSlug, partner);
      }
      if (!partner) {
        orphans.push({ category, index: i, name: e.name, reason: 'partner portal file missing: ' + partnerSlug + '.json' });
        e._orphanedStub = true;
        changes.push({ type: 'orphan_partner_missing', category, name: e.name, partner: partnerSlug });
        continue;
      }

      const { found: partnerEntry, category: foundCat } = findReciprocalEntry(
        partner, thisSlug, thisCik, thisName, category, hintCategory
      );

      if (!partnerEntry) {
        orphans.push({
          category, index: i, name: e.name,
          reason: 'no reciprocal entry on partner ' + partnerSlug + ' (looked in: ' + (RECIPROCAL_CATEGORIES[category] || []).join('/') + ')'
        });
        e._orphanedStub = true;
        changes.push({ type: 'orphan_no_match', category, name: e.name, partner: partnerSlug });
        continue;
      }

      // ─── Inherit structural fields ───────────────────────────────
      const before = {
        sourceType: e.sourceType, confidence: e.confidence,
        brainNodeId: e.brainNodeId, brainNodeRole: e.brainNodeRole,
        neuralRole: e.neuralRole
      };

      const defaults = CATEGORY_DEFAULTS[category] || {};
      const partnerSrc = partnerEntry.sourceType;
      const partnerConf = partnerEntry.confidence;
      const partnerBrain = partnerEntry.brainNodeId;
      const partnerRole = partnerEntry.brainNodeRole;
      const partnerNeural = partnerEntry.neuralRole;

      // sourceType — inherit + tag
      if (!e.sourceType) e.sourceType = mergedSourceType(partnerSrc);

      // confidence — inherit with one-step dampening (string-preserving)
      if (e.confidence == null || e.confidence === '') e.confidence = inheritedConfidence(partnerConf);

      // brainNodeId — partner's. Brain node binding is symmetric on the edge.
      if (!e.brainNodeId && partnerBrain) e.brainNodeId = partnerBrain;

      // brainNodeRole — for SYMMETRIC categories (competitors), partner
      // role describes the same kind of relationship from either end, so
      // inherit the specific text. For ASYMMETRIC categories
      // (customers/suppliers/etc.), partner's role describes the
      // opposite direction and cannot be safely mirrored; use category-
      // default in THIS portal's voice instead.
      if (!e.brainNodeRole) {
        if (SYMMETRIC_CATEGORIES.has(category) && partnerRole) {
          e.brainNodeRole = partnerRole;
        } else {
          e.brainNodeRole = defaults.brainNodeRole || 'unmapped_role';
        }
      }

      // neuralRole — same symmetry rule
      if (!e.neuralRole) {
        if (SYMMETRIC_CATEGORIES.has(category) && partnerNeural) {
          e.neuralRole = partnerNeural;
        } else {
          e.neuralRole = defaults.neuralRole || 'unmapped_neural_role';
        }
      }

      // Audit trail
      e._reciprocityResolvedAt = new Date().toISOString();
      e._resolvedFromPartnerEntry = {
        partnerSlug,
        partnerCategory: foundCat,
        partnerFingerprint: fingerprint(partnerEntry.slug, partnerEntry.cik, partnerEntry.name)
      };
      // _autoReciprocityFill stays — preserves history. _orphanedStub cleared
      // (in case it was previously flagged and is now resolvable).
      delete e._orphanedStub;

      changes.push({
        type: 'resolved',
        category,
        name: e.name,
        partner: partnerSlug,
        before,
        after: {
          sourceType: e.sourceType, confidence: e.confidence,
          brainNodeId: e.brainNodeId, brainNodeRole: e.brainNodeRole,
          neuralRole: e.neuralRole
        }
      });
    }
  }

  return { portal, changes, orphans };
}

// ─── Run ───────────────────────────────────────────────────────────
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const allChanges = [];
const allOrphans = [];
let portalsTouched = 0;
let portalsWrote = 0;
const partnerCache = new Map();

// Filter — only specific portals if --only set, else sample if --sample set
let targets = files;
if (ONLY) {
  const wanted = new Set(ONLY.split(',').map(s => s.trim() + '.json'));
  targets = files.filter(f => wanted.has(f));
}

console.log('═══ phase 1: reciprocity stub structural inheritance ═══');
console.log('  mode:    ' + (APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'));
console.log('  sample:  ' + (SAMPLE > 0 ? SAMPLE + ' first-changed portals' : 'all'));
console.log('  scope:   ' + targets.length + ' portal file(s)');
console.log('');

let sampledShown = 0;

for (const f of targets) {
  const portalPath = path.join(DIR, f);
  let portal;
  try { portal = JSON.parse(fs.readFileSync(portalPath, 'utf8')); }
  catch (e) { continue; }

  const { changes, orphans } = resolvePortal(portal, partnerCache);
  if (!changes.length) continue;

  portalsTouched++;
  allChanges.push(...changes.map(c => Object.assign({}, c, { portal: portal.slug })));
  allOrphans.push(...orphans.map(o => Object.assign({}, o, { portal: portal.slug })));

  if (APPLY) {
    writePortal(portal.slug, portal);
    portalsWrote++;
  }

  if (SAMPLE > 0 && sampledShown < SAMPLE) {
    sampledShown++;
    console.log('── ' + portal.slug + ' ──');
    console.log('  total changes: ' + changes.length);
    console.log('  orphans:       ' + orphans.length);
    // Show first 2 resolved + first 2 orphans
    const resolved = changes.filter(c => c.type === 'resolved').slice(0, 2);
    for (const r of resolved) {
      console.log('  RESOLVED [' + r.category + '] ' + r.name + ' (from ' + r.partner + ')');
      console.log('    before:', JSON.stringify(r.before));
      console.log('    after: ', JSON.stringify(r.after));
    }
    const orphSamples = orphans.slice(0, 2);
    for (const o of orphSamples) {
      console.log('  ORPHAN  [' + o.category + '] ' + o.name + ' — ' + o.reason);
    }
    console.log('');
  }
}

// ─── Summary ───────────────────────────────────────────────────────
const resolvedCount = allChanges.filter(c => c.type === 'resolved').length;
const orphanNoPartner = allChanges.filter(c => c.type === 'orphan_no_partner').length;
const orphanMissing = allChanges.filter(c => c.type === 'orphan_partner_missing').length;
const orphanNoMatch = allChanges.filter(c => c.type === 'orphan_no_match').length;

console.log('═══ SUMMARY ═══');
console.log('  portals touched:    ' + portalsTouched);
console.log('  portals written:    ' + portalsWrote + (DRY ? ' (dry run — nothing written)' : ''));
console.log('  total stubs:        ' + allChanges.length);
console.log('    resolved:                ' + resolvedCount);
console.log('    orphaned (no partner):   ' + orphanNoPartner);
console.log('    orphaned (partner gone): ' + orphanMissing);
console.log('    orphaned (no match):     ' + orphanNoMatch);

if (orphanNoMatch > 0 && SAMPLE === 0) {
  console.log('');
  console.log('  sample orphans (top 10 partner→category misses):');
  const sample = allChanges.filter(c => c.type === 'orphan_no_match').slice(0, 10);
  for (const o of sample) {
    console.log('    ' + o.portal + ' / ' + o.category + ' / ' + o.name + ' (looked in partner ' + o.partner + ')');
  }
}

// Exit
process.exit(0);
