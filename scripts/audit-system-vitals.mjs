#!/usr/bin/env node
/**
 * audit-system-vitals.mjs — body-wide interoception organ.
 *
 * Runs every organ sense module in scripts/sense/ and rolls the results into
 * a single _vitals.json snapshot. Each organ contributes:
 *   - its own 0-100 score (organ-level health)
 *   - its own metrics block (organ-specific findings)
 *   - its own attention items (operator queue, organ-tagged)
 *
 * Aggregate corpus health = mean of organ scores.
 * The existing portal-corpus organ is run as a child process (preserves the
 * canonical audit script), every other organ is a static-file sense module.
 *
 *   node scripts/audit-system-vitals.mjs            # writes assets/data/_vitals.json
 *   node scripts/audit-system-vitals.mjs --dry-run  # print only
 *   node scripts/audit-system-vitals.mjs --json     # full JSON to stdout
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORGANS } from './sense/_index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VITALS_PATH = path.join(ROOT, 'assets', 'data', '_vitals.json');
const DRY = process.argv.includes('--dry-run');
const JSON_OUT = process.argv.includes('--json');

// Read prior snapshot for lastHeals preservation
let priorHeals = [];
if (fs.existsSync(VITALS_PATH)) {
  try {
    const prev = JSON.parse(fs.readFileSync(VITALS_PATH, 'utf8'));
    if (Array.isArray(prev.lastHeals)) priorHeals = prev.lastHeals.slice(-20);
  } catch (e) {}
}

// Run every organ
const organs = {};
const allAttention = [];
const organScores = [];
for (const organ of ORGANS) {
  let r;
  try { r = await organ.sense(); } catch (e) { r = { score: 0, status: 'IN_PAIN', summary: 'sense() threw: ' + e.message, metrics: {}, attention: [{ issue: 'Organ sense() error: ' + e.message, severity: 'high', count: 1, action: 'inspect scripts/sense/organ-' + organ.id + '.mjs', organ: organ.id }] }; }
  organs[organ.id] = { id: organ.id, role: organ.role, order: organ.order, ...r };
  for (const a of (r.attention || [])) allAttention.push({ ...a, organ: organ.id });
  if (typeof r.score === 'number') organScores.push(r.score);
}

// Aggregate
const overallScore = organScores.length ? Math.round(organScores.reduce((s, v) => s + v, 0) / organScores.length) : 0;
const status = overallScore >= 90 ? 'HEALTHY' : overallScore >= 75 ? 'DEGRADED' : 'IN_PAIN';

/**
 * Sort attention: high severity first, then by count.
 *
 * `??` NOT `||`. high ranks 0, and 0 is falsy, so `sevRank[a.severity] || 9` handed every HIGH
 * item the unknown-severity fallback of 9 and sorted it BELOW every med (1) and low (2). The
 * operator queue rendered in the order med, low, high for as long as this line has existed:
 * on the 2026-07-30 pulse the three HIGH items sat at positions 12, 13 and 14 of 14, under
 * seven MED and four LOW. vitals.html iterates this array as stored and does not re-sort, so
 * the page showed the inversion exactly. The comment above the old line already claimed the
 * correct behaviour, which is why nobody re-read the expression.
 */
const sevRank = { high: 0, med: 1, low: 2 };
allAttention.sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) || (b.count || 0) - (a.count || 0));

// Build summary banner — one organ per line per the user's "all levels" requirement
const banner = ORGANS.map(o => o.id + ' ' + organs[o.id].score).join(' · ');

const out = {
  schemaVersion: 'vitals/2.0',
  generatedAt: new Date().toISOString(),
  overall: { score: overallScore, status, summary: `${ORGANS.length} organs · ${allAttention.length} attention items · ${banner}` },
  scores: Object.fromEntries(Object.values(organs).map(o => [o.id, o.score])),
  organs,
  operatorAttention: allAttention,
  lastHeals: priorHeals
};

if (JSON_OUT) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('=== system vitals ===');
  console.log('overall:', overallScore, status);
  console.log();
  console.log('PER-ORGAN:');
  for (const oid in organs) {
    const o = organs[oid];
    console.log('  ' + String(o.score).padStart(4) + '  [' + o.status.padEnd(8) + ']  ' + o.id.padEnd(16) + '  ' + o.summary);
  }
  console.log();
  console.log('OPERATOR-ATTENTION (' + allAttention.length + ' items):');
  for (const a of allAttention.slice(0, 25)) {
    console.log('  [' + a.severity.toUpperCase().padEnd(4) + '] (' + a.organ + ') ' + a.issue + ' (' + a.count + ')');
  }
  if (allAttention.length > 25) console.log('  ... ' + (allAttention.length - 25) + ' more');
  if (!DRY) {
    fs.writeFileSync(VITALS_PATH, JSON.stringify(out, null, 2));
    console.log('\nwritten:', VITALS_PATH);
  }
}
