#!/usr/bin/env node
/**
 * build-epistemic-buckets.mjs
 *
 * Tally every claim in the verification ledger into the FOUR epistemic buckets
 * (proven / unproven / unknown / impossible) and write the totals into
 * treatment-discovery/_summary.json so the discovery surface renders a global
 * four-state view.
 *
 * Reads the shared classifier (assets/js/epistemic-state.js) — the collapse
 * rule is defined in exactly one place.
 *
 * DOCTRINE: keep everything. PENDING claims that never reached the ledger are
 * still UNKNOWN (a gap to go look at) — they are counted, not dropped.
 *
 * Usage: node scripts/build-epistemic-buckets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ES from '../assets/js/epistemic-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LEDGER = path.join(ROOT, 'assets/data/audit/verification-ledger.json');
const SUMMARY = path.join(ROOT, 'assets/data/treatment-discovery/_summary.json');
const SNAPSHOT_AT = process.env.LIMEN_SNAPSHOT_AT || new Date().toISOString();

function main() {
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf-8'));
  const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf-8'));

  // Use the current cube snapshot, not the ledger's all-time population. A
  // rebuilt cube may retire claim ids while the append-only ledger correctly
  // preserves their historical verdicts. Mixing those populations made the
  // UI count archived claims as if they were still rendered.
  const reconciliation = summary.verificationReconciliation;
  if (!reconciliation || !reconciliation.effectiveCurrentByVerdict) {
    throw new Error('summary is missing verificationReconciliation; run reconcile-discovery-stores.mjs');
  }
  const verdictCounts = { ...reconciliation.effectiveCurrentByVerdict };
  const processed = reconciliation.matchedLedgerClaims;

  const buckets = { proven: 0, unproven: 0, unknown: 0, impossible: 0 };
  for (const [verdict, n] of Object.entries(verdictCounts)) {
    buckets[ES.classify(verdict)] += n;
  }

  summary.epistemicBuckets = {
    proven: buckets.proven,
    unproven: buckets.unproven,
    unknown: buckets.unknown,
    impossible: buckets.impossible,
    totalClaims: buckets.proven + buckets.unproven + buckets.unknown + buckets.impossible,
    processedVerdicts: processed,
    verdictCounts,
    note:
      'Every claim kept and separated by epistemic state. Verification writes the ' +
      'state; it never deletes the finding. Impossible = study why it fails (kept, not discarded).',
    archivedLedgerClaims: reconciliation.archivedLedgerClaims,
    computedAt: SNAPSHOT_AT,
  };

  // Fix the legacy note that contradicted doctrine.
  if (typeof summary.note === 'string' && /suppress residuals/i.test(summary.note)) {
    summary.note = summary.note.replace(
      /Verification:.*$/,
      'Verification labels each claim by epistemic state (PROVEN / UNPROVEN / UNKNOWN / IMPOSSIBLE) ' +
        'and keeps every residual — none are suppressed.'
    );
  }

  fs.writeFileSync(SUMMARY, JSON.stringify(summary, null, 2));

  console.log('=== EPISTEMIC BUCKETS ===');
  for (const state of ES.STATES) {
    const m = ES.STATE_META[state];
    console.log(`  ${m.label.padEnd(11)} ${String(buckets[state]).padStart(7)}   — ${m.nextMove}`);
  }
  console.log(`  ${'TOTAL'.padEnd(11)} ${String(summary.epistemicBuckets.totalClaims).padStart(7)}`);
  console.log('');
  console.log(`  processed verdicts in ledger: ${processed}`);
  console.log(`  raw verdict counts: ${JSON.stringify(verdictCounts)}`);
  console.log(`  wrote epistemicBuckets → ${path.relative(ROOT, SUMMARY)}`);
}

main();
