#!/usr/bin/env node
/**
 * test-evidence-integrity.mjs — negative tests for the 2026-10-16 audit repairs.
 *
 * The existing reconciliation test (test-discovery-store-reconciliation.js)
 * proves internal CONSISTENCY: counts, hashes, schemas agree. It passed 19/19
 * while the defects below were live. These tests prove SEMANTIC CORRECTNESS:
 * missing, stale, contradictory, and mismatched evidence gets the right
 * treatment. Every test here failed against the pre-repair code.
 *
 * Item 1: a missing binding-fidelity report — or a portal absent from it —
 *         must NOT produce VERIFIED. No audit coverage, no positive verdict.
 */

import { verifyRuleBased } from './organ-claim-verification.mjs';

let passed = 0;
function ok(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed++;
  console.log(`PASS ${label}`);
}

const bindingClaim = {
  kind: 'binding',
  payload: { portalSlug: 'acme-portal', entityName: 'Amygdala', relationshipType: 'treats', role: 'target', confidence: 0.9 },
};

// --- Item 1 ---------------------------------------------------------------

// Missing report entirely (safeReadJSON failure collapses to {} at the call
// site) — this was the exact path that stamped 150 false VERIFIEDs.
{
  const v = verifyRuleBased(bindingClaim, {});
  ok('missing binding report does not produce VERIFIED', v.verdict !== 'VERIFIED');
  ok('missing binding report produces retryable UNVERIFIABLE', v.verdict === 'UNVERIFIABLE');
}

// Report exists and covers other portals, but not this one — never audited.
{
  const report = { perPortal: { 'other-portal': { issues: [] } } };
  const v = verifyRuleBased(bindingClaim, report);
  ok('portal absent from report does not produce VERIFIED', v.verdict !== 'VERIFIED');
  ok('portal absent from report produces UNVERIFIABLE', v.verdict === 'UNVERIFIABLE');
}

// Audited portal, zero issues — legitimate VERIFIED (control case).
{
  const report = { perPortal: { 'acme-portal': { issues: [] } } };
  const v = verifyRuleBased(bindingClaim, report);
  ok('audited portal with zero issues still verifies (control)', v.verdict === 'VERIFIED');
}

// Audited portal, matching high-severity issue — DISPUTED preserved (control).
{
  const report = {
    perPortal: {
      'acme-portal': {
        issues: [{ entityName: 'Amygdala', relType: 'treats', kind: 'role-mismatch', severity: 'high' }],
      },
    },
  };
  const v = verifyRuleBased(bindingClaim, report);
  ok('flagged binding still disputes (control)', v.verdict === 'DISPUTED');
}

console.log(`\n${passed} evidence-integrity assertions passed`);
