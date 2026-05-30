#!/usr/bin/env node
/**
 * scripts/portal-reciprocity-audit.mjs
 *
 * Walks every v2.0.1 company portal in assets/data/companies/ and
 * audits the functionalNetwork for reciprocity: when company A lists
 * company B in a category, does company B list company A in the
 * reciprocal category?
 *
 * Reciprocity rules (asymmetric pairs):
 *   supplier  → customer / logisticsPartner (depending on shape)
 *   customer  → supplier
 *   logisticsPartners → customer (the carrier serves the shipper)
 *   competitors → competitors (symmetric)
 *   capitalProviders → (no reciprocal expected; lenders don't list
 *                       every borrower in a portal)
 *   regulators → (no reciprocal expected; regulators don't track
 *                 individual entities in this schema)
 *   auditor → (no reciprocal expected)
 *   executiveTeam → (people, not entities; skip)
 *   marketSignals → (signals, not entities; skip)
 *
 * Usage:
 *   node scripts/portal-reciprocity-audit.mjs
 *   node scripts/portal-reciprocity-audit.mjs --json    # machine output
 *   node scripts/portal-reciprocity-audit.mjs --only walmart,nike
 *
 * Exits non-zero if violations found (useful for CI).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');

const RECIPROCAL_MAP = {
  // forward         → expected reciprocal category in target portal
  suppliers:         ['customers'],
  customers:         ['suppliers'],
  logisticsPartners: ['customers'],
  competitors:       ['competitors']
};
const NO_RECIPROCAL = new Set([
  'regulators', 'auditor', 'capitalProviders', 'executiveTeam', 'marketSignals'
]);

const argv = process.argv.slice(2);
const wantJson = argv.includes('--json');
const onlyArg = (function () {
  const idx = argv.indexOf('--only');
  if (idx === -1) return null;
  return (argv[idx + 1] || '').split(',').map(s => s.trim()).filter(Boolean);
})();

async function loadAllPortals() {
  const entries = await fs.readdir(PORTAL_DIR);
  const out = {};
  for (const e of entries) {
    if (!e.endsWith('.json')) continue;
    if (e.startsWith('_')) continue;
    const slug = e.replace(/\.json$/, '');
    try {
      const raw = await fs.readFile(path.join(PORTAL_DIR, e), 'utf8');
      const p = JSON.parse(raw);
      if (p && p.schemaVersion === '2.0.1') {
        out[slug] = p;
      }
    } catch (err) {
      // skip unreadable / non-JSON
    }
  }
  return out;
}

// Index portals by (slug, ticker, cik) so we can resolve a functionalNetwork
// entry that uses any of those identifiers back to a known portal.
function buildIndex(portals) {
  const bySlug = new Map();
  const byTicker = new Map();
  const byCik = new Map();
  for (const [slug, p] of Object.entries(portals)) {
    bySlug.set(slug, slug);
    if (p.slug) bySlug.set(p.slug, slug);
    if (p.ticker) byTicker.set(String(p.ticker).toUpperCase(), slug);
    if (p.cik) byCik.set(String(p.cik).replace(/^0+/, ''), slug);
  }
  return { bySlug, byTicker, byCik };
}

function resolveTarget(entry, index) {
  if (entry.slug && index.bySlug.has(entry.slug)) return index.bySlug.get(entry.slug);
  if (entry.ticker && index.byTicker.has(String(entry.ticker).toUpperCase())) {
    return index.byTicker.get(String(entry.ticker).toUpperCase());
  }
  if (entry.cik && index.byCik.has(String(entry.cik).replace(/^0+/, ''))) {
    return index.byCik.get(String(entry.cik).replace(/^0+/, ''));
  }
  return null;
}

function entryReferencesA(targetEntries, sourceSlug, sourcePortal) {
  if (!Array.isArray(targetEntries)) return null;
  for (const e of targetEntries) {
    if (e.slug === sourceSlug) return e;
    if (sourcePortal.ticker && e.ticker && String(e.ticker).toUpperCase() === String(sourcePortal.ticker).toUpperCase()) return e;
    if (sourcePortal.cik && e.cik && String(e.cik).replace(/^0+/, '') === String(sourcePortal.cik).replace(/^0+/, '')) return e;
  }
  return null;
}

async function audit() {
  const portals = await loadAllPortals();
  let slugs = Object.keys(portals);
  if (onlyArg) slugs = slugs.filter(s => onlyArg.includes(s));

  if (!wantJson) {
    console.log('=== LIMEN portal reciprocity audit ===');
    console.log('v2.0.1 portals loaded: ' + Object.keys(portals).length);
    console.log('auditing: ' + slugs.length);
    console.log('');
  }

  const index = buildIndex(portals);
  const violations = [];
  let outboundEdgeCount = 0;
  let resolvableEdgeCount = 0;
  let reciprocalEdgeCount = 0;
  const orphans = []; // entries that reference a company we don't have a portal for

  for (const slugA of slugs) {
    const A = portals[slugA];
    const fnA = A.functionalNetwork || {};
    for (const category of Object.keys(fnA)) {
      if (NO_RECIPROCAL.has(category)) continue;
      const expectedReciprocals = RECIPROCAL_MAP[category];
      if (!expectedReciprocals) continue;

      const entries = Array.isArray(fnA[category]) ? fnA[category] : [];
      for (const entry of entries) {
        outboundEdgeCount++;
        const targetSlug = resolveTarget(entry, index);
        if (!targetSlug) {
          orphans.push({ from: slugA, fromCategory: category, name: entry.name, ticker: entry.ticker || null, cik: entry.cik || null });
          continue;
        }
        if (targetSlug === slugA) continue; // self
        resolvableEdgeCount++;

        const B = portals[targetSlug];
        const fnB = B.functionalNetwork || {};
        // Look for a reciprocal pointer in any expected category
        let foundIn = null;
        for (const expCat of expectedReciprocals) {
          const match = entryReferencesA(fnB[expCat], slugA, A);
          if (match) { foundIn = expCat; break; }
        }
        // Loose-match fallback: pointer in ANY category (even if not the
        // expected reciprocal category) — this is still useful info but
        // gets flagged as 'wrong-category'.
        if (!foundIn) {
          for (const otherCat of Object.keys(fnB)) {
            if (NO_RECIPROCAL.has(otherCat)) continue;
            if (expectedReciprocals.includes(otherCat)) continue;
            const match = entryReferencesA(Array.isArray(fnB[otherCat]) ? fnB[otherCat] : [], slugA, A);
            if (match) { foundIn = otherCat; break; }
          }
        }

        if (foundIn && expectedReciprocals.includes(foundIn)) {
          reciprocalEdgeCount++;
        } else {
          violations.push({
            from: slugA,
            fromCategory: category,
            to: targetSlug,
            expectedCategory: expectedReciprocals,
            foundIn: foundIn || 'none',
            entry: {
              name: entry.name || null,
              ticker: entry.ticker || null,
              cik: entry.cik || null,
              brainNodeId: entry.brainNodeId || null
            }
          });
        }
      }
    }
  }

  const summary = {
    portalsAudited: slugs.length,
    portalsAvailable: Object.keys(portals).length,
    outboundEdgeCount,
    resolvableEdgeCount,
    reciprocalEdgeCount,
    reciprocityPct: resolvableEdgeCount > 0 ? Math.round((reciprocalEdgeCount / resolvableEdgeCount) * 1000) / 10 : 0,
    violationCount: violations.length,
    orphanCount: orphans.length
  };

  if (wantJson) {
    console.log(JSON.stringify({ summary, violations, orphans }, null, 2));
    return violations.length === 0 ? 0 : 1;
  }

  console.log('Summary:');
  console.log('  outbound edges (forward relationships):  ' + summary.outboundEdgeCount);
  console.log('  resolvable to another local portal:      ' + summary.resolvableEdgeCount + ' (' + summary.orphanCount + ' point to companies we don\'t have)');
  console.log('  edges with valid reciprocal:             ' + summary.reciprocalEdgeCount);
  console.log('  reciprocity rate:                        ' + summary.reciprocityPct + '%');
  console.log('  violations:                              ' + summary.violationCount);
  console.log('');

  if (violations.length > 0) {
    console.log('=== violations (first 50) ===');
    for (const v of violations.slice(0, 50)) {
      const label = v.entry.name || v.to;
      const expected = v.expectedCategory.join('|');
      const fix = v.foundIn === 'none'
        ? 'no entry — add ' + label + ' to one of [' + expected + '] in ' + v.to
        : 'wrong category — moved to "' + v.foundIn + '" (expected [' + expected + ']) in ' + v.to;
      console.log('  ' + v.from + '.' + v.fromCategory + ' → ' + v.to + ':  ' + fix);
    }
    if (violations.length > 50) {
      console.log('  ... (' + (violations.length - 50) + ' more — use --json for full list)');
    }
    console.log('');
  }

  if (orphans.length > 0 && orphans.length < 30) {
    console.log('=== orphans (referenced but no portal authored) ===');
    for (const o of orphans.slice(0, 25)) {
      console.log('  ' + o.from + '.' + o.fromCategory + ' → ' + o.name + ' (ticker=' + (o.ticker || '?') + ', cik=' + (o.cik || '?') + ')');
    }
    if (orphans.length > 25) {
      console.log('  ... (' + (orphans.length - 25) + ' more)');
    }
    console.log('');
  }

  return violations.length === 0 ? 0 : 1;
}

audit()
  .then(code => process.exit(code))
  .catch(err => { console.error('FATAL', err); process.exit(2); });
