// scripts/sense/organ-feeds.mjs — afferent / sensory cortex.
//
// Static audit of feed configuration. We can't HTTP-probe sources during a
// build-time audit (that's the live cron's job), but we can verify the source
// registry is structurally honest: every source declares its env-var
// requirement, parse strategy, and domain binding. A misconfigured source =
// silent feed failure at runtime.
import fs from 'node:fs';
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
  const coveredDomains = Object.keys(byDomain).filter(d => CANONICAL_DOMAINS.includes(d));
  const uncoveredDomains = CANONICAL_DOMAINS.filter(d => !byDomain[d]);

  const attention = [];
  if (sources.length < 30) attention.push({ issue: 'Feed source count low (<30)', severity: 'med', count: sources.length, action: 'expand feed-status.js source registry', organ: id });
  if (uncoveredDomains.length > 0) attention.push({ issue: 'Canonical domains with NO feed source', severity: 'high', count: uncoveredDomains.length, action: 'add at least one feed source per canonical domain: ' + uncoveredDomains.join(', '), organ: id });

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
