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

import {
  verifyRuleBased,
  verifyPubMed,
  abstractContradicts,
  checkPhraseInText,
  propagateVerdictsToCube,
  reconcilePopulation,
  extractCellClaims,
  payloadHash,
  recordVerdict,
  capQueueWithRetryRotation,
  VERIFIER_VERSION,
} from './organ-claim-verification.mjs';

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

// Shared fixtures — used from the Item 2 blocks onward.
const mkCell = (over = {}) => ({
  cellId: 'BLA__active__trade',
  brainNodeId: 'BLA',
  stateBucket: 'active',
  comparisonDomain: 'trade',
  node: { region: 'temporal' },
  issues: [],
  disorders: [],
  neuroTreatments: [],
  domainTreatments: [],
  portalBindings: [],
  crossDomainAffinities: [],
  residuals: [],
  ...over,
});
const disorderItem = { id: 'd1', name: 'Exposure Therapy', mechanism: 'extinction learning', primaryNodesAffected: ['BLA'], citations: [] };
const disorderPh = payloadHash({ id: 'd1', name: 'Exposure Therapy', mechanism: 'extinction learning', primaryNodesAffected: ['BLA'], citations: [] });

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

// --- Item 4 ---------------------------------------------------------------
// (a) Zero PubMed results must stay UNKNOWN-retryable, never DISPUTED
//     (which displays as IMPOSSIBLE). (b) An abstract that names the claim
//     but reports a negative result must not verify.

const disorderClaim = {
  kind: 'disorder',
  brainNodeId: 'BLA',
  payload: { id: 'dx-test', name: 'Exposure Therapy', mechanism: 'm', primaryNodesAffected: ['BLA'], citations: [] },
};

// Stub the network: verifyPubMed talks to global fetch.
const realFetch = globalThis.fetch;
function stubFetch(ids, abstractText) {
  globalThis.fetch = async (url) => {
    if (url.includes('esearch')) {
      return { ok: true, json: async () => ({ esearchresult: { idlist: ids } }) };
    }
    return { ok: true, text: async () => abstractText };
  };
}

{
  stubFetch([], '');
  const v = await verifyPubMed(disorderClaim);
  ok('zero PubMed hits is NOT DISPUTED (no false impossible)', v.verdict !== 'DISPUTED');
  ok('zero PubMed hits is retryable UNVERIFIABLE', v.verdict === 'UNVERIFIABLE');
}

{
  stubFetch(['0001'], 'Exposure therapy did not improve outcomes in this randomized trial of 214 adults.');
  const v = await verifyPubMed(disorderClaim);
  ok('negative-result abstract does not produce VERIFIED', v.verdict !== 'VERIFIED');
  ok('negative-result abstract produces scoped DISPUTED', v.verdict === 'DISPUTED');
  ok('dispute note preserves citation scope', /disputed, not refuted/.test(v.note));
}

{
  stubFetch(['0002'], 'Exposure therapy significantly improved outcomes in this randomized trial of 214 adults.');
  const v = await verifyPubMed(disorderClaim);
  ok('supporting abstract still verifies (control)', v.verdict === 'VERIFIED');
}
globalThis.fetch = realFetch;

// Negation guard unit behavior
ok('negation guard fires on explicit failure language', abstractContradicts('Exposure therapy did not improve outcomes.', 'Exposure Therapy'));
ok('negation guard silent on positive result', !abstractContradicts('Exposure therapy improved outcomes markedly.', 'Exposure Therapy'));
ok('negation guard requires the claim to be present', !abstractContradicts('Sertraline did not improve outcomes.', 'Exposure Therapy'));
ok('phrase checker still passes plain mentions (control)', checkPhraseInText('Exposure Therapy', 'we studied exposure therapy in adults'));

// Scoped contradiction (review on #398): negation in a sentence about an
// unrelated arm must NOT dispute the claim under test.
ok('negation about a different arm does not dispute the claim',
  !abstractContradicts('Exposure therapy improved primary outcomes significantly. Sertraline did not improve secondary measures in the same cohort.', 'Exposure Therapy'));
ok('negation sharing a sentence with the claim still disputes',
  abstractContradicts('In this cohort, exposure therapy did not improve outcomes.', 'Exposure Therapy'));

// --- Review fixes (round 2, #398) ------------------------------------------

// Failed portal audit entries must not read as "audited, zero issues".
{
  const report = { perPortal: { 'acme-portal': { ok: false, error: 'portal JSON unparseable' } } };
  const v = verifyRuleBased(bindingClaim, report);
  ok('failed portal audit does not produce VERIFIED', v.verdict === 'UNVERIFIABLE');
}
{
  const report = { perPortal: { 'acme-portal': { ok: true } } }; // no issues array
  const v = verifyRuleBased(bindingClaim, report);
  ok('audit entry with no issue list does not produce VERIFIED', v.verdict === 'UNVERIFIABLE');
}

// Superseded history keeps the full evidence trail.
{
  const ledger = { verdicts: {} };
  recordVerdict(ledger, 'dx::d1', { verdict: 'DISPUTED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', evidence: ['pubmed:123'], confidence: 0.6, note: 'old rule' }, disorderPh);
  recordVerdict(ledger, 'dx::d1', { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-02-01T00:00:00Z', evidence: ['pubmed:456'], confidence: 0.8 }, disorderPh);
  const h = ledger.verdicts['dx::d1'].history[0];
  ok('history retains superseded evidence and confidence',
    h.evidence[0] === 'pubmed:123' && h.confidence === 0.6 && h.verdict === 'DISPUTED');
}

// Verdicts from pre-repair verifier rules re-enqueue even when hashes match.
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh } } }; // no verifierVersion
  const claims = [];
  extractCellClaims(cell, claims, ledger);
  ok('pre-repair pubmed verdict re-enqueues under repaired rules', claims.length === 1);
}
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: VERIFIER_VERSION } } };
  const claims = [];
  extractCellClaims(cell, claims, ledger);
  ok('current-version verdict still skips (control)', claims.length === 0);
}

// Retry rotation: fresh claims first, changed payloads are fresh, the cursor
// advances by the admitted window, and the backlog converges.
{
  const ledger = { verdicts: {} };
  const fresh = [{ claimId: 'fresh-1' }, { claimId: 'fresh-2' }];
  const retries = Array.from({ length: 10 }, (_, i) => ({ claimId: `retry-${i}`, payloadHash: 'x' }));
  for (const r of retries) ledger.verdicts[r.claimId] = { verdict: 'UNVERIFIABLE', ph: 'x' };
  const queue = [...retries, ...fresh];

  const w1 = capQueueWithRetryRotation(queue, ledger, 5, 100);
  ok('cap respects max', w1.length === 5);
  ok('fresh claims are not crowded out by the retry backlog', w1[0].claimId === 'fresh-1' && w1[1].claimId === 'fresh-2');

  const firstRetryA = capQueueWithRetryRotation(queue, ledger, 5, 100).find((c) => c.claimId.startsWith('retry-')).claimId;
  const firstRetryB = capQueueWithRetryRotation(queue, ledger, 5, 101).find((c) => c.claimId.startsWith('retry-')).claimId;
  ok('different weeks start at different windows of the backlog', firstRetryA !== firstRetryB);

  const allIds = new Set();
  for (let w = 100; w < 110; w++) {
    for (const c of capQueueWithRetryRotation(queue, ledger, 5, w)) {
      if (c.claimId.startsWith('retry-')) allIds.add(c.claimId);
    }
  }
  ok('rotation reaches every retryable claim over ten weeks', allIds.size === 10);

  // A changed payload under an UNVERIFIABLE verdict is fresh work.
  const changed = { claimId: 'retry-0', payloadHash: 'changed-hash' };
  const w2 = capQueueWithRetryRotation([changed], ledger, 5, 100);
  ok('changed payload under UNVERIFIABLE verdict takes the fresh lane', w2[0].claimId === 'retry-0');
  ok('unchanged retryable stays in the rotating backlog (control)',
    capQueueWithRetryRotation(retries, ledger, 3, 100).length === 3);

  // Reserved capacity: even when fresh work could fill the whole cap, the
  // retry backlog keeps its quarter (review round 3, #398).
  {
    const bigRest = Array.from({ length: 300 }, (_, i) => ({ claimId: `fresh-${i}` }));
    const w = capQueueWithRetryRotation(bigRest.concat(retries), ledger, 200, 100);
    ok('retry backlog keeps reserved capacity under a full fresh queue',
      w.some((c) => c.claimId.startsWith('retry-')));
    ok('cap still respected under reservation', w.length === 200);
    ok('fresh lane dominates but does not starve retries',
      w.filter((c) => c.claimId.startsWith('fresh-')).length === 190 &&
      w.filter((c) => c.claimId.startsWith('retry-')).length === 10);
  }
}


// --- Item 2 ---------------------------------------------------------------
// A ledger verdict applies only to the exact payload it was computed from.
// Propagation and reconciliation must both enforce that — a stale VERIFIED
// must never display or count as current.

// Propagation: fresh verdict applies (control).
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh } } };
  const n = propagateVerdictsToCube(cube, ledger);
  ok('fresh verdict propagates to the cube (control)', n === 1 && cube.cells[0].disorders[0].verification.verdict === 'VERIFIED');
}

// Propagation: stale verdict must NOT display.
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: 'deadbeefdeadbeef' } } };
  propagateVerdictsToCube(cube, ledger);
  const v = cube.cells[0].disorders[0].verification;
  ok('stale verdict is not displayed as VERIFIED', v.verdict !== 'VERIFIED');
  ok('stale verdict surfaces as PENDING with stale flag', v.verdict === 'PENDING' && v.stale === true);
  ok('stale marker references but does not present prior verdict', v.previousVerdict === 'VERIFIED');
  ok('cell aggregate counts the stale claim as pending, not verified',
    cube.cells[0].verification.pendingClaimCount === 1 && cube.cells[0].verification.verifiedClaimCount === 0);
}

// Reconciliation: stale verdict counted PENDING and tallied.
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: 'deadbeefdeadbeef' } } };
  const r = reconcilePopulation(cube, ledger, '2026-10-16T00:00:00Z', 'abc123');
  ok('reconciliation does not count a stale verdict as VERIFIED', r.effectiveCurrentByVerdict.VERIFIED === 0);
  ok('reconciliation counts a stale verdict as PENDING', r.effectiveCurrentByVerdict.PENDING === 1);
  ok('reconciliation tallies staleLedgerVerdicts', r.staleLedgerVerdicts === 1);
}

// Reconciliation: fresh verdict counts (control).
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh } } };
  const r = reconcilePopulation(cube, ledger, '2026-10-16T00:00:00Z', 'abc123');
  ok('fresh ledger verdict counts as VERIFIED (control)', r.effectiveCurrentByVerdict.VERIFIED === 1 && r.staleLedgerVerdicts === 0);
}

// Hash discipline: extraction/propagation/reconciliation must all hash the
// same payload — key order invariance is what makes that safe.
{
  const a = payloadHash({ x: 1, y: [2, 3], z: { b: 1, a: 2 } });
  const b = payloadHash({ z: { a: 2, b: 1 }, y: [2, 3], x: 1 });
  ok('payload hash is key-order independent', a === b);
  ok('payload hash changes when content changes', payloadHash({ x: 1 }) !== payloadHash({ x: 2 }));
}

// Extraction shape stability: the refactor must emit byte-identical claims.
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const claims = [];
  extractCellClaims(cell, claims, { verdicts: {} });
  ok('extraction emits the same claim identity, kind, verifier and hash',
    claims.length === 1 &&
    claims[0].claimId === 'dx::d1' &&
    claims[0].kind === 'disorder' &&
    claims[0].verifier === 'pubmed' &&
    claims[0].payloadHash === disorderPh);
}

// --- Item 3 ---------------------------------------------------------------
// Unavailable verification is retryable forever; superseded verdicts are
// preserved, never erased.

// UNVERIFIABLE with a matching hash must still re-enqueue.
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const ledger = { verdicts: { 'dx::d1': { verdict: 'UNVERIFIABLE', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh } } };
  const claims = [];
  extractCellClaims(cell, claims, ledger);
  ok('UNVERIFIABLE with matching hash is retried (not suppressed)', claims.length === 1);
}

// Current-version VERIFIED with a matching hash is still skipped (control —
// no churn). Pre-repair entries without a verifierVersion re-enqueue by
// design; that's tested above.
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: VERIFIER_VERSION } } };
  const claims = [];
  extractCellClaims(cell, claims, ledger);
  ok('VERIFIED with matching hash is still skipped (control)', claims.length === 0);
}

// recordVerdict: history preserved on supersession, capped, newest-last.
{
  const ledger = { verdicts: {} };
  const claim = { claimId: 'dx::d1', payloadHash: disorderPh };
  recordVerdict(ledger, 'dx::d1', { verdict: 'UNVERIFIABLE', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', note: 'first attempt' }, disorderPh);
  ok('first verdict has no history', !ledger.verdicts['dx::d1'].history);
  recordVerdict(ledger, 'dx::d1', { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-02-01T00:00:00Z' }, disorderPh);
  const rec = ledger.verdicts['dx::d1'];
  ok('superseded verdict preserved in history', Array.isArray(rec.history) && rec.history.length === 1 && rec.history[0].verdict === 'UNVERIFIABLE');
  ok('history keeps the prior note and timestamp', rec.history[0].note === 'first attempt' && rec.history[0].checkedAt === '2026-01-01T00:00:00Z');
  ok('current verdict is the new one', rec.verdict === 'VERIFIED' && rec.supersedes === '2026-01-01T00:00:00Z');
  ok('new verdict carries verifier version', typeof rec.verifierVersion === 'string' && rec.verifierVersion.length > 0);
}

// --- Review fixes (round 3, #398) ------------------------------------------

// ok:false with a populated issues array means the scan COMPLETED and found
// issues — not a failed audit. It must flow to issue matching, not UNVERIFIABLE.
{
  const report = { perPortal: { 'acme-portal': { ok: false, issues: [{ entityName: 'Someone Else', relType: 'treats', kind: 'role-mismatch', severity: 'low' }] } } };
  const v = verifyRuleBased(bindingClaim, report);
  ok('completed audit with unrelated issues still verifies (control)', v.verdict === 'VERIFIED');
}

// Binding identity includes role: the known cube collisions (same cell,
// portal, relation, entity; different roles) get distinct claim ids, and
// the pipeline no longer aborts on them.
{
  const b1 = { portalSlug: 'crh_plc', relationshipType: 'competitors', entityName: 'Holcim Ltd.', role: 'peer', confidence: 0.8 };
  const b2 = { ...b1, role: 'supplier' };
  const cell = mkCell({ portalBindings: [b1, b2] });
  const claims = [];
  extractCellClaims(cell, claims, { verdicts: {} }, new Set(), true);
  ok('same-entity bindings with different roles get distinct claim ids',
    claims.length === 2 && claims[0].claimId !== claims[1].claimId);
  const cube = { cells: [cell] };
  const ledger = { verdicts: {} };
  propagateVerdictsToCube(cube, ledger);
  const r = reconcilePopulation(cube, ledger, 't', 'c');
  ok('reconcile completes on formerly-colliding bindings', r.uniqueCurrentClaims === 2);
}

console.log(`\n${passed} evidence-integrity assertions passed`);
