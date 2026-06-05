#!/usr/bin/env node
/**
 * autonomous-portal-regen.mjs — body creates portals when it needs them.
 *
 * Reads vitals attention items + bridge-blind portals + CB rows pointing at
 * missing portal files. Identifies portals the system SHOULD have but doesn't,
 * and emits a queue file the build-fractal-portals.mjs runner consumes.
 *
 * Does NOT call Anthropic itself — emits a queue. The portal-build runner
 * (already API-budgeted + paced) drains it.
 *
 * Trigger conditions:
 *   1. CB row references a slug with no portal file (188 known)
 *   2. Portal exists but has no bridge match AND kernel signal present
 *      (blind to bridge → may need richer functional-network)
 *   3. Spider-web propagator shows induced stress on a portal with no
 *      functional-network entry (counterparty missing)
 *
 *   node scripts/autonomous-portal-regen.mjs --apply
 *   node scripts/autonomous-portal-regen.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const CB_CURATED = path.join(ROOT, 'assets', 'data', 'command-board-data.json');
const CB_ELIG = path.join(ROOT, 'assets', 'data', 'command-board-eligible.json');
const VITALS_PATH = path.join(ROOT, 'assets', 'data', '_vitals.json');
const REGEN_QUEUE = path.join(ROOT, 'assets', 'data', '_autonomous-regen-queue.json');
const ALIAS_PATH = path.join(ROOT, 'assets', 'data', 'company-aliases.json');

const DRY = !process.argv.includes('--apply');
console.log('=== autonomous-portal-regen ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');

let cbCurated = {}, cbElig = {}, vitals = {}, ALIAS = {};
try { cbCurated = JSON.parse(fs.readFileSync(CB_CURATED, 'utf8')); } catch (e) {}
try { cbElig = JSON.parse(fs.readFileSync(CB_ELIG, 'utf8')); } catch (e) {}
try { vitals = JSON.parse(fs.readFileSync(VITALS_PATH, 'utf8')); } catch (e) {}
try { ALIAS = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8')).aliases || {}; } catch (e) {}

// A CB row is satisfied if a portal file exists for its own slug OR for its
// alias target. WITHOUT this, the regen over-counts: every CB row whose slug
// resolves to an existing portal under a different canonical slug (via the
// alias map) was being reported as "missing", inflating the backlog. The
// build runner already applies aliases — so the two disagreed (regen said 188,
// builder tier-1 said 0). Resolve aliases here so the backlog is honest.
const _fileExists = slug => fs.existsSync(path.join(DIR, slug + '.json'));
const has = slug => _fileExists(slug) || (ALIAS[slug] && _fileExists(ALIAS[slug]));
const queue = [];

// Trigger 1: CB rows pointing at missing portals
for (const cb of [cbCurated, cbElig]) {
  const rows = cb.companies || [];
  for (const row of rows) {
    if (!row.s) continue;
    if (has(row.s)) continue;
    queue.push({
      slug: row.s,
      name: row.n || row.s,
      cik: row.c || null,
      ticker: row.t || null,
      domain: row.d || null,
      sector: row.sec || null,
      sic: row.sic || null,
      trigger: 'cb_row_missing_portal',
      source: cb === cbCurated ? 'curated' : 'eligible'
    });
  }
}

// Trigger 2: portals with no bridge AND has kernel composite (signal exists, but body can't reason about it)
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const br = p.bridgeReadings;
  const hasMatch = br && br.matched && br.matched.length > 0;
  const hasKernelSignal = (p.financialHealth && (p.financialHealth.composite != null || p.financialHealth.alert === true)) || (p.kernelReadings && (p.kernelReadings.k1 || p.kernelReadings.k2));
  if (!hasMatch && hasKernelSignal && (!p.functionalNetwork || Object.keys(p.functionalNetwork).length < 4)) {
    queue.push({
      slug: f.replace(/\.json$/, ''),
      name: p.name,
      cik: p.cik || null,
      ticker: p.ticker || null,
      domain: p.domainId || null,
      sector: p.sector || null,
      sic: p.sic || null,
      trigger: 'kernel_signal_no_bridge',
      reason: 'portal has kernel signal but no bridge match — functional-network may need enrichment to match a bridge pattern'
    });
  }
}

// dedup
const seen = new Set();
const dedup = [];
for (const q of queue) {
  if (seen.has(q.slug)) continue;
  seen.add(q.slug);
  dedup.push(q);
}

const summary = {
  schemaVersion: 'autonomous-regen-queue/1.0',
  generatedAt: new Date().toISOString(),
  total: dedup.length,
  byTrigger: dedup.reduce((acc, q) => { acc[q.trigger] = (acc[q.trigger] || 0) + 1; return acc; }, {}),
  bySource: dedup.reduce((acc, q) => { if (q.source) acc[q.source] = (acc[q.source] || 0) + 1; return acc; }, {}),
  queue: dedup
};

console.log('total queued for regeneration:', dedup.length);
console.log('by trigger:', JSON.stringify(summary.byTrigger));
console.log('by source:', JSON.stringify(summary.bySource));
console.log();
console.log('sample (top 10):');
for (const q of dedup.slice(0, 10)) console.log('  ' + q.slug.padEnd(35) + ' · ' + q.trigger + (q.cik ? ' · cik=' + q.cik : ''));

if (!DRY) {
  fs.writeFileSync(REGEN_QUEUE, JSON.stringify(summary, null, 2));
  console.log('\nwritten: ' + REGEN_QUEUE);
  console.log('\nDrain with: node scripts/build-fractal-portals.mjs --queue ' + REGEN_QUEUE);

  // Surface the backlog on the VITALS page. The queue file above is gitignored +
  // ephemeral (it dies with the CI runner, so the operator never sees it).
  // _vitals.json IS committed by the immune cron, so write a compact summary +
  // an operatorAttention line here — "what the body needs to build" becomes
  // visible at /vitals instead of vanishing every tick.
  try {
    const vp = JSON.parse(fs.readFileSync(VITALS_PATH, 'utf8'));
    vp.portalRegen = {
      total: dedup.length,
      byTrigger: summary.byTrigger,
      topPriority: dedup.slice(0, 15).map(q => ({ slug: q.slug, name: q.name || null, trigger: q.trigger })),
      generatedAt: summary.generatedAt
    };
    vp.operatorAttention = (vp.operatorAttention || []).filter(a => a.organ !== 'portalRegen');
    if (dedup.length > 0) {
      vp.operatorAttention.push({
        issue: 'Portal regen backlog — entities the body needs but has no portal for',
        severity: dedup.length > 500 ? 'high' : 'med',
        count: dedup.length,
        action: 'drain: build-fractal-portals.mjs (autonomous drain not yet wired)',
        organ: 'portalRegen'
      });
    }
    fs.writeFileSync(VITALS_PATH, JSON.stringify(vp, null, 2));
    console.log('surfaced portalRegen backlog (' + dedup.length + ') -> _vitals.json + operatorAttention');
  } catch (e) { console.warn('could not surface to vitals:', e.message); }
}
