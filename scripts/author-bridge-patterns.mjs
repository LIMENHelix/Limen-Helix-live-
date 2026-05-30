#!/usr/bin/env node
/**
 * author-bridge-patterns.mjs — drain the no-bridge frontier via Claude.
 *
 * Finds portals with kernel signal but no bridge match (the K3 frontier), asks
 * Claude to author candidate new bridge patterns, writes proposals to
 * _pattern-proposals.json for operator review (and merge via the API).
 *
 * Budget-gated via api/lib/ai-orchestrator.js. Caps per-tick calls so the
 * autonomic loop can't burn through credits. Operator decides which
 * proposals merge into the live library.
 *
 *   node scripts/author-bridge-patterns.mjs --apply --max=5
 *   node scripts/author-bridge-patterns.mjs --dry-run
 *
 * Flags:
 *   --max=N        max proposals to generate this tick (default 3)
 *   --domain=X     target domain hint (business|environment|population|...)
 *   --portal=slug  force a specific portal
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const require = createRequire(import.meta.url);

const { proposePattern } = require(path.join(ROOT, 'api', 'lib', 'pattern-author.js'));
const orchestrator = require(path.join(ROOT, 'api', 'lib', 'ai-orchestrator.js'));

const arg = (n, d) => { const i = process.argv.findIndex(a => a === '--' + n || a.startsWith('--' + n + '=')); if (i === -1) return d; const a = process.argv[i]; return a.includes('=') ? a.split('=')[1] : (process.argv[i + 1] || d); };
const DRY = !process.argv.includes('--apply');
const MAX = parseInt(arg('max', '3'), 10);
const DOMAIN = arg('domain', 'business');
const ONLY_SLUG = arg('portal', null);

console.log('=== author-bridge-patterns ' + (DRY ? '(DRY RUN)' : '(APPLY)') + ' ===');
const status = orchestrator.status();
console.log('providers:', JSON.stringify(status.providers));
console.log('budget:   ', JSON.stringify(status.budget));
console.log('limits:   ', JSON.stringify(status.limits));
console.log('target domain: ' + DOMAIN + ' · max proposals: ' + MAX);

if (!status.providers.anthropic) {
  console.error('ANTHROPIC_API_KEY not set — pattern authoring requires it.');
  process.exit(1);
}

// Find candidate portals — those with kernel signal but no bridge match,
// AND that haven't already been the source of a pending proposal.
let proposalLog = {};
try { proposalLog = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', '_pattern-proposals.json'), 'utf8')); } catch (e) { proposalLog = { proposals: [] }; }
const recentlyProposedSlugs = new Set((proposalLog.proposals || []).slice(0, 200).map(p => p.sourcePortal));

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const candidates = [];
for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const slug = f.replace(/\.json$/, '');
  if (ONLY_SLUG && slug !== ONLY_SLUG) continue;
  if (!ONLY_SLUG && recentlyProposedSlugs.has(slug)) continue;
  const hasBridge = p.bridgeReadings && p.bridgeReadings.matched && p.bridgeReadings.matched.length > 0;
  if (hasBridge && !ONLY_SLUG) continue;
  const hasFn = p.functionalNetwork && Object.keys(p.functionalNetwork).length >= 4;
  const hasSignal = (p.kernelReadings && (p.kernelReadings.k1 || p.kernelReadings.k2)) || (p.financialHealth && p.financialHealth.composite != null);
  if (!hasFn) continue;
  if (!hasSignal && !ONLY_SLUG) continue;
  p.slug = slug;
  candidates.push(p);
}

console.log('candidates: ' + candidates.length + ' (capped to ' + MAX + ' for this tick)');
if (candidates.length === 0) { console.log('(nothing to author)'); process.exit(0); }

// Author up to MAX patterns
let success = 0, refused = 0, failed = 0;
for (let i = 0; i < Math.min(MAX, candidates.length); i++) {
  const c = candidates[i];
  console.log();
  console.log('[' + (i + 1) + '/' + Math.min(MAX, candidates.length) + '] proposing pattern for ' + c.slug + ' (' + (c.sector || c.industry || c.domainId) + ')');
  if (DRY) { console.log('  (dry run — would call Claude)'); continue; }
  try {
    const r = await proposePattern(c, { targetDomain: DOMAIN, reason: 'autonomic loop k3-frontier authoring' });
    if (!r.ok) { failed++; console.log('  ✗ ' + r.error); continue; }
    if (r.refused) { refused++; console.log('  · refused by author: ' + r.reason); continue; }
    success++;
    console.log('  ✓ proposed ' + r.proposal.id + ' · ' + r.tokensUsed + ' tokens');
    console.log('    neural: ' + r.proposal.neural.region + ' (' + r.proposal.neural.state + ')');
    console.log('    target: ' + r.proposal.business.signature);
    console.log('    confidence: ' + r.proposal.bridge.confidence);
  } catch (e) {
    failed++;
    console.log('  ✗ exception: ' + e.message);
  }
}

console.log();
console.log('=== done ===');
console.log('proposed: ' + success + ' · refused: ' + refused + ' · failed: ' + failed);
const final = orchestrator.status();
console.log('budget after: ' + final.budget.tokensUsed + ' tokens / ' + final.budget.callsMade + ' calls this tick');
