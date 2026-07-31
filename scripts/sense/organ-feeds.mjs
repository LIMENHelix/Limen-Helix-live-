// scripts/sense/organ-feeds.mjs — afferent / sensory cortex.
//
// Static audit of feed configuration. We can't HTTP-probe sources during a
// build-time audit (that's the live cron's job), but we can verify the source
// registry is structurally honest: every source declares its env-var
// requirement, parse strategy, and domain binding. A misconfigured source =
// silent feed failure at runtime.
import fs from 'node:fs';
import { inputs } from './_inputs.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export const id = 'feeds';
export const role = 'afferent / sensory cortex';
export const order = 10;   // first thing the body senses

export function sense() {
  // feed-status was migrated into the Hono catch-all (handlers/); check there first, fall back to legacy api/
  const FEED_STATUS = [path.join(ROOT, 'handlers', 'feed-status.js'), path.join(ROOT, 'api', 'feed-status.js')].find(p => fs.existsSync(p));
  if (!FEED_STATUS) {
    return { score: 0, status: 'IN_PAIN', summary: 'feed-status.js missing — system has no sensory cortex', metrics: {}, attention: [{ issue: 'feed-status.js not found', severity: 'high', count: 1, action: 'inspect handlers/feed-status.js', organ: id }] };
  }
  const src = fs.readFileSync(FEED_STATUS, 'utf8');

  // count source registrations — each is { domain: '...', source: '...' }
  // pattern conservative: match the canonical { domain: 'x', source: 'y', ... }
  const sources = [...src.matchAll(/\{\s*domain:\s*['"`]([a-zA-Z_]+)['"`][\s\S]*?source:\s*['"`]([^'"`]+)['"`]/g)].map(m => ({ domain: m[1], source: m[2] }));
  const byDomain = sources.reduce((acc, s) => { (acc[s.domain] = acc[s.domain] || []).push(s.source); return acc; }, {});
  if (byDomain.trade && !byDomain.supplyChain) byDomain.supplyChain = byDomain.trade;   // dual-key: trade ↔ supplyChain
  if (byDomain.supplyChain && !byDomain.trade) byDomain.trade = byDomain.supplyChain;
  // env-var-requiring sources — `requires_auth: true` blocks
  const envGated = (src.match(/requires_auth:\s*true/g) || []).length;
  // env vars referenced
  const envVars = [...new Set([...src.matchAll(/process\.env\.([A-Z_]+)/g)].map(m => m[1]))];

  const CANONICAL_DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','supplyChain','technology'];
  // feed-status.js is a diagnostics endpoint; the real feed SOURCE-OF-TRUTH is the snapshot
  // builder (handlers/domain-snapshot.js), which builds feeds for all 20 domains under runtime
  // keys (medicine→health, science→research). Credit a domain if it's fed by EITHER.
  /**
   * THE WORST INSTANCE OF THE ENOENT-INFERENCE BUG IN THIS DIRECTORY.
   *
   * snapshotSrc defaulted to '' on a read failure, and fedBySnapshot() greps it. An empty
   * string matches nothing, so EVERY canonical domain fell into uncoveredDomains and this
   * organ emitted a HIGH "Canonical domains with NO feed source" naming all twenty — from a
   * single unreadable file. handlers/ is in the sparse checkout today, so it has not fired,
   * but it was one checkout edit away from declaring the entire sensory cortex dead.
   */
  const io = inputs();
  const snapshotSrc = io.text(path.join(ROOT, 'handlers', 'domain-snapshot.js'), 'handlers/domain-snapshot.js');
  const snapshotReadable = snapshotSrc !== null;
  const RUNTIME_ALIAS = { medicine: 'health', science: 'research' };   // canonical → snapshot runtime key
  const fedBySnapshot = (d) => { const k = RUNTIME_ALIAS[d] || d; return snapshotReadable ? new RegExp("['\"`]" + k + "['\"`]").test(snapshotSrc) : false; };
  const coveredDomains = CANONICAL_DOMAINS.filter(d => byDomain[d] || fedBySnapshot(d));
  const uncoveredDomains = CANONICAL_DOMAINS.filter(d => !byDomain[d] && !fedBySnapshot(d));

  const attention = [];
  if (sources.length < 30) attention.push({ issue: 'Feed status-registry source count low (<30) — informational; real feeds live in domain-snapshot.js', severity: 'low', count: sources.length, action: 'optionally expand handlers/feed-status.js diagnostics registry', organ: id });
  // Guarded: with domain-snapshot.js unreadable, half the evidence for coverage is absent and
  // this finding would name all 20 domains from one failed read. Suppressed; io.attention reports why.
  if (snapshotReadable && uncoveredDomains.length > 0) attention.push({ issue: 'Canonical domains with NO feed source (in feed-status.js OR domain-snapshot.js)', severity: 'high', count: uncoveredDomains.length, action: 'add at least one feed source per canonical domain: ' + uncoveredDomains.join(', '), organ: id });
  const ioItem = io.attention(id); if (ioItem) attention.push(ioItem);

  const domainCoverageScore = Math.round(coveredDomains.length / CANONICAL_DOMAINS.length * 100);
  const sourceDensityScore = Math.min(100, Math.round(sources.length / 41 * 100));
  const score = Math.round((domainCoverageScore + sourceDensityScore) / 2);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${sources.length} sources across ${Object.keys(byDomain).length} domains (${coveredDomains.length}/20 canonical) · ${envGated} require auth · ${envVars.length} env vars referenced`,
    metrics: { sourceCount: sources.length, byDomain, coveredDomains, uncoveredDomains, envGated, envVars, scoreParts: { domainCoverage: domainCoverageScore, sourceDensity: sourceDensityScore } },
    attention
  };
}
