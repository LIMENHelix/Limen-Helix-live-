#!/usr/bin/env node
/**
 * scripts/portal-reciprocity-fix.mjs
 *
 * Reads the reciprocity audit's violation list and writes back the
 * missing reverse edges to the peer portal's matching category. Lifts
 * reciprocity rate via structural cleanup — no new enrichment, no
 * Anthropic calls.
 *
 * Two violation types are handled:
 *   - foundIn === 'none'    → ADD a minimal entry to B's reciprocal
 *                             category. Tagged _autoReciprocityFill:true
 *                             with a stub relationshipNote.
 *   - foundIn === <other>   → MOVE the existing entry from the wrong
 *                             category to the expected one. Preserves
 *                             all of Claude's original prose.
 *
 * Usage:
 *   node scripts/portal-reciprocity-fix.mjs --dry-run   (default)
 *   node scripts/portal-reciprocity-fix.mjs --apply
 *   node scripts/portal-reciprocity-fix.mjs --apply --only walmart,nike
 *   node scripts/portal-reciprocity-fix.mjs --apply --max-per-portal 30
 *
 * Safety:
 *   - Dry-run is the default; --apply is required to write.
 *   - --max-per-portal caps how many new entries any one portal
 *     receives in a single run (default 50). Stops a heavy
 *     counterparty (UPS, AWS-style hyperscaler) from getting bloated
 *     past the WMT-grade target on the first sweep.
 *   - Every auto-filled entry carries _autoReciprocityFill: true so
 *     they can be filtered or stripped later.
 *   - 'move' operations leave Claude's relationshipNote intact.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');

const RECIPROCAL_MAP = {
  suppliers:         ['customers'],
  customers:         ['suppliers'],
  logisticsPartners: ['customers'],
  competitors:       ['competitors']
};
const NO_RECIPROCAL = new Set([
  'regulators', 'auditor', 'capitalProviders', 'executiveTeam', 'marketSignals'
]);

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const onlyArg = (function () {
  const idx = argv.indexOf('--only');
  if (idx === -1) return null;
  return (argv[idx + 1] || '').split(',').map(s => s.trim()).filter(Boolean);
})();
const maxPerPortal = (function () {
  const idx = argv.indexOf('--max-per-portal');
  if (idx === -1) return 50;
  return parseInt(argv[idx + 1], 10) || 50;
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
      if (p && p.schemaVersion === '2.0.1') out[slug] = p;
    } catch (_) { /* skip */ }
  }
  return out;
}

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

function buildAutoFillEntry(sourcePortal, sourceSlug, sourceCategory, expectedCategory) {
  const directionLabel =
    sourceCategory === 'suppliers' ? 'is a customer of'
    : sourceCategory === 'customers' ? 'is a supplier to'
    : sourceCategory === 'logisticsPartners' ? 'serves as a logistics customer of'
    : sourceCategory === 'competitors' ? 'competes with'
    : 'is connected to';
  const note = sourcePortal.name + ' ' + directionLabel + ' this entity, per reciprocity audit. See ' + sourceSlug + ' portal for canonical narrative and quantification. This is a structural reciprocity fill — populate with primary-source detail on next densify pass.';
  return {
    name: sourcePortal.name || sourceSlug,
    slug: sourceSlug,
    ticker: sourcePortal.ticker || null,
    cik: sourcePortal.cik || null,
    brainNodeId: sourcePortal.brainNodeId || null,
    relationshipNote: note,
    _autoReciprocityFill: true,
    _filledFrom: sourceCategory,
    _filledAt: new Date().toISOString().slice(0, 10)
  };
}

async function main() {
  const portals = await loadAllPortals();
  let slugs = Object.keys(portals);
  if (onlyArg) slugs = slugs.filter(s => onlyArg.includes(s));

  const index = buildIndex(portals);

  console.log('=== LIMEN portal reciprocity-fix ===');
  console.log('mode:           ' + (apply ? 'APPLY (will write)' : 'DRY-RUN (no writes)'));
  console.log('portals loaded: ' + Object.keys(portals).length);
  console.log('auditing:       ' + slugs.length);
  console.log('maxPerPortal:   ' + maxPerPortal);
  console.log('');

  // Plan additions + moves
  const plan = {};   // slug → { adds: [...], moves: [...] }
  function planFor(s) {
    if (!plan[s]) plan[s] = { adds: [], moves: [] };
    return plan[s];
  }

  for (const slugA of slugs) {
    const A = portals[slugA];
    const fnA = A.functionalNetwork || {};
    for (const category of Object.keys(fnA)) {
      if (NO_RECIPROCAL.has(category)) continue;
      const expectedReciprocals = RECIPROCAL_MAP[category];
      if (!expectedReciprocals) continue;
      const expCat = expectedReciprocals[0];

      const entries = Array.isArray(fnA[category]) ? fnA[category] : [];
      for (const entry of entries) {
        const targetSlug = resolveTarget(entry, index);
        if (!targetSlug || targetSlug === slugA) continue;
        const B = portals[targetSlug];
        const fnB = B.functionalNetwork || {};

        // Check existing reciprocal status
        let foundIn = null;
        for (const ec of expectedReciprocals) {
          if (entryReferencesA(fnB[ec], slugA, A)) { foundIn = ec; break; }
        }
        if (foundIn) continue; // already reciprocated correctly

        // Loose match
        let looseFound = null;
        for (const otherCat of Object.keys(fnB)) {
          if (NO_RECIPROCAL.has(otherCat)) continue;
          if (expectedReciprocals.includes(otherCat)) continue;
          if (entryReferencesA(Array.isArray(fnB[otherCat]) ? fnB[otherCat] : [], slugA, A)) {
            looseFound = otherCat;
            break;
          }
        }

        if (looseFound) {
          // MOVE the existing entry from looseFound to expCat
          planFor(targetSlug).moves.push({
            sourceSlug: slugA, sourceCategory: category,
            fromCat: looseFound, toCat: expCat
          });
        } else {
          // ADD a new auto-fill entry to expCat on B
          planFor(targetSlug).adds.push({
            sourceSlug: slugA, sourceCategory: category, toCat: expCat
          });
        }
      }
    }
  }

  // Summarize + apply
  const summary = { portalsTouched: 0, totalAdds: 0, totalMoves: 0, capped: 0 };
  const sortedSlugs = Object.keys(plan).sort();
  for (const slug of sortedSlugs) {
    const ops = plan[slug];
    if (ops.adds.length === 0 && ops.moves.length === 0) continue;
    const cappedAdds = ops.adds.slice(0, maxPerPortal);
    if (ops.adds.length > cappedAdds.length) summary.capped++;
    summary.totalAdds += cappedAdds.length;
    summary.totalMoves += ops.moves.length;
    summary.portalsTouched++;

    if (!apply) {
      const limit = ops.adds.length > cappedAdds.length ? ' (CAPPED — ' + (ops.adds.length - cappedAdds.length) + ' deferred)' : '';
      console.log(slug + ': +' + cappedAdds.length + ' adds, ' + ops.moves.length + ' moves' + limit);
      continue;
    }

    // Apply: mutate the portal
    const B = portals[slug];
    const fnB = B.functionalNetwork || (B.functionalNetwork = {});

    for (const m of ops.moves) {
      if (!Array.isArray(fnB[m.fromCat])) continue;
      const idx = fnB[m.fromCat].findIndex(e => e.slug === m.sourceSlug);
      if (idx === -1) continue;
      const [moved] = fnB[m.fromCat].splice(idx, 1);
      if (!Array.isArray(fnB[m.toCat])) fnB[m.toCat] = [];
      // Don't add if already present in target cat (shouldn't be, but be safe)
      if (!fnB[m.toCat].some(e => e.slug === m.sourceSlug)) {
        fnB[m.toCat].push(moved);
      }
    }

    for (const a of cappedAdds) {
      const A = portals[a.sourceSlug];
      if (!A) continue;
      if (!Array.isArray(fnB[a.toCat])) fnB[a.toCat] = [];
      if (fnB[a.toCat].some(e => e.slug === a.sourceSlug)) continue;
      fnB[a.toCat].push(buildAutoFillEntry(A, a.sourceSlug, a.sourceCategory, a.toCat));
    }

    const filePath = path.join(PORTAL_DIR, slug + '.json');
    await fs.writeFile(filePath, JSON.stringify(B, null, 2), 'utf8');
    const limit = ops.adds.length > cappedAdds.length ? ' (' + (ops.adds.length - cappedAdds.length) + ' adds deferred)' : '';
    console.log(slug + ': +' + cappedAdds.length + ' adds, ' + ops.moves.length + ' moves WRITTEN' + limit);
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('  portals touched: ' + summary.portalsTouched);
  console.log('  total adds:      ' + summary.totalAdds);
  console.log('  total moves:     ' + summary.totalMoves);
  console.log('  portals capped:  ' + summary.capped + ' (had more adds than --max-per-portal)');
  console.log('  mode:            ' + (apply ? 'APPLIED' : 'DRY-RUN — re-run with --apply'));
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
