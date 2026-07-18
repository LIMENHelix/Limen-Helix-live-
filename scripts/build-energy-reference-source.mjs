/**
 * scripts/build-energy-reference-source.mjs — regenerates the FULL SOURCE appendix of
 * ENERGY_REFERENCE.md by embedding every energy/core file verbatim from disk.
 *
 * Idempotent: it truncates the doc at the generated marker and re-appends, so the source
 * is always the EXACT current code. Run: node scripts/build-energy-reference-source.mjs
 * The doc is firewalled (.vercelignore) so its size never affects a deploy.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DOC = path.join(ROOT, 'ENERGY_REFERENCE.md');
const MARKER = '<!-- ENERGY-FULL-SOURCE:GENERATED (do not edit below; run scripts/build-energy-reference-source.mjs) -->';

// Ordered, grouped file list. Tag = how it ports (see the DUPLICATION BLUEPRINT section).
const GROUPS = [
  ['CORE BRAIN + BASE', [
    ['assets/js/domain-brains/domain-brain-base.js', 'GENERIC — inherited by all 20 domains'],
    ['assets/js/domain-brains/energy-brain.js', 'SPECIFIC — the template; port = generalize its learning-substrate methods to base + reset its config'],
  ]],
  ['LEARNING SUBSTRATE (SHARED modules — load, do not copy per domain)', [
    ['assets/js/limen-plasticity.js', 'SHARED'],
    ['assets/js/limen-active-inference.js', 'SHARED'],
    ['assets/js/limen-phase-percept.js', 'SHARED'],
    ['assets/js/limen-k4-selfconsistency.js', 'SHARED — EXTERNAL_REWARD_DOMAINS is the per-domain truth-eligibility list'],
    ['lib/phase-percept.js', 'SHARED (server mirror)'],
    ['lib/feed-resolver.js', 'SHARED (resolver math)'],
  ]],
  ['NEURO-SUBSTRATE OVERLAY MODULES (energy-named; generalize to <domain>- or lift to base)', [
    ['assets/js/energy-metaplasticity.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-extinction.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-retrograde-throttle.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-prediction-error-compressor.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-refractory-limiter.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-connectivity-audit.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-ei-balance.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-offline-maintenance.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-neuro-substrate.js', 'SPECIFIC-name/GENERIC-logic'],
    ['assets/js/energy-telemetry-adapter.js', 'SPECIFIC — reads energy pulse + energy.json'],
    ['assets/js/domain-brains/energy-cortex-retrieval.js', 'SPECIFIC (unreferenced)'],
    ['assets/js/domain-brains/energy-refresh-controller.js', 'SPECIFIC (UI refresh)'],
  ]],
  ['APP LAYER — business / opportunity / directive / operator (SPECIFIC)', [
    ['assets/js/energy-node-business-engine.js', 'SPECIFIC'],
    ['assets/js/energy-business-build.js', 'SPECIFIC (orphan)'],
    ['assets/js/energy-business-review.js', 'SPECIFIC'],
    ['assets/js/energy-opportunity-economics.js', 'SPECIFIC'],
    ['assets/js/energy-compensation.js', 'SPECIFIC'],
    ['assets/js/energy-promotion-bridge.js', 'SPECIFIC (live emission pipeline)'],
    ['assets/js/energy-targeting-engine.js', 'SPECIFIC (segments/tickers)'],
    ['assets/js/energy-clarity-operator.js', 'SPECIFIC (operator surface)'],
    ['assets/js/energy-pulse-engine.js', 'SPECIFIC (evidence contracts)'],
    ['assets/js/energy-directive-extractor.js', 'SPECIFIC'],
    ['assets/js/energy-directive-ranker.js', 'SPECIFIC (mechanism map)'],
    ['assets/js/energy-directive-translator.js', 'SPECIFIC (title templates)'],
    ['assets/js/energy-operator-panel.js', 'SPECIFIC (legacy orphan)'],
    ['assets/js/energy-execution-panels.js', 'SPECIFIC (dormant)'],
    ['assets/js/energy-claim-flow.js', 'SPECIFIC (legacy orphan)'],
    ['assets/js/energy-claim-ledger.js', 'SPECIFIC (legacy orphan)'],
    ['assets/js/energy-agent-box.js', 'SPECIFIC (orphan; generic domain-agent-box is used)'],
  ]],
  ['SERVER / HANDLERS / SHARED LIB', [
    ['lib/company-phase-scorer.js', 'SHARED — scores all domains'],
    ['lib/limen-db.js', 'SHARED'],
    ['lib/node-guard.js', 'SHARED'],
    ['handlers/feed-record.js', 'SHARED (recorder, all domains)'],
    ['handlers/feed-resolve.js', 'SHARED (resolver, all domains via ?emit=1)'],
    ['handlers/brain-weights.js', 'SHARED (weight persistence)'],
    ['handlers/limen-worker-snapshot.js', 'SHARED — the server node-grounding loops all domains'],
    ['handlers/master-agent.js', 'SHARED (cross-domain AI)'],
    ['handlers/domain-agent.js', 'SHARED (per-domain AI box backend)'],
    ['handlers/energy-agent.js', 'SPECIFIC (bespoke; optional — generic domain-agent covers it)'],
    ['handlers/energy-entry.js', 'SPECIFIC (public Bill X-Ray backend)'],
    ['handlers/energy-news.js', 'SPECIFIC'],
    ['handlers/energy-markets.js', 'SPECIFIC (ticker quotes)'],
    ['handlers/energy-distress.js', 'SPECIFIC (P3 broker desk)'],
    ['handlers/energy-distress-ingest.js', 'SPECIFIC (P3 desk ingest)'],
    ['handlers/energy-distress-status.js', 'SPECIFIC (P3 desk CRM)'],
    ['assets/js/limen-thing2-adapter.js', 'SHARED (phase kernel)'],
    ['assets/js/limen-fast-boot.js', 'SHARED (snapshot hydration)'],
    ['assets/js/master-consciousness-box.js', 'SHARED (AI payload builder)'],
    ['assets/js/domain-brains/portal-content-resolver.js', 'SHARED (portal fetch/negative-cache)'],
    ['assets/js/domain-brains/domain-console-brain.js', 'SHARED (console renderer)'],
  ]],
  ['RUNTIME DATA TEMPLATE (SPECIFIC-DATA — recreate per domain)', [
    ['assets/data/domains/energy.json', 'SPECIFIC-DATA — activations/issues/edges/runtime.params template'],
  ]],
];

function lang(p) { return p.endsWith('.json') ? 'json' : 'js'; }

let out = MARKER + '\n\n# APPENDIX — FULL SOURCE (verbatim, generated)\n\n' +
  'Every energy/core file embedded from disk so this doc is self-contained. Tags map to the ' +
  'DUPLICATION BLUEPRINT above (GENERIC / SHARED / SPECIFIC / SPECIFIC-DATA). The 5,373-line shared ' +
  'multi-domain fetcher `handlers/domain-snapshot.js` is referenced, not embedded (it serves all 20 ' +
  'domains; the energy fetchers live at its lines cited in §H). Regenerate with ' +
  '`node scripts/build-energy-reference-source.mjs`.\n\n';

let totalLines = 0, fileCount = 0, missing = [];
for (const [group, files] of GROUPS) {
  out += `\n## ${group}\n\n`;
  for (const [rel, tag] of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { missing.push(rel); out += `#### \`${rel}\` — MISSING\n\n`; continue; }
    const src = fs.readFileSync(abs, 'utf8');
    const n = src.split('\n').length;
    totalLines += n; fileCount++;
    out += `#### \`${rel}\`  ·  ${tag}  ·  ${n} lines\n\n\`\`\`${lang(rel)}\n${src.replace(/\s+$/, '')}\n\`\`\`\n\n`;
  }
}

let doc = fs.readFileSync(DOC, 'utf8');
const cut = doc.indexOf(MARKER);
if (cut !== -1) doc = doc.slice(0, cut).replace(/\s+$/, '') + '\n\n';
fs.writeFileSync(DOC, doc + out);
console.log(`embedded ${fileCount} files, ${totalLines} source lines; missing: ${missing.length ? missing.join(', ') : 'none'}`);
