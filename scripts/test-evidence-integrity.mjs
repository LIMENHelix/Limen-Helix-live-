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
  CLAIM_SHAPES,
  portalAuditFingerprint,
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
// persists in the ledger, and the backlog converges regardless of turnover.
{
  const ledger = { verdicts: {} };
  const fresh = [{ claimId: 'fresh-1' }, { claimId: 'fresh-2' }];
  const retries = Array.from({ length: 10 }, (_, i) => ({ claimId: `retry-${i}`, payloadHash: 'x' }));
  for (const r of retries) ledger.verdicts[r.claimId] = { verdict: 'UNVERIFIABLE', ph: 'x' };
  const queue = [...retries, ...fresh];

  const w1 = capQueueWithRetryRotation(queue, ledger, 5);
  ok('cap respects max', w1.length === 5);
  ok('fresh claims are not crowded out by the retry backlog', w1[0].claimId === 'fresh-1' && w1[1].claimId === 'fresh-2');

  // The durable cursor: successive runs continue where the last stopped.
  const firstRun = capQueueWithRetryRotation(queue, ledger, 5);
  const firstRetryA = firstRun.find((c) => c.claimId.startsWith('retry-')).claimId;
  ok('cursor state is persisted in the ledger', !!(ledger.retryCursors && ledger.retryCursors.full));
  const secondRun = capQueueWithRetryRotation(queue, ledger, 5);
  const firstRetryB = secondRun.find((c) => c.claimId.startsWith('retry-')).claimId;
  ok('successive runs start at different windows of the backlog', firstRetryA !== firstRetryB);

  const allIds = new Set();
  for (let run = 0; run < 4; run++) {
    for (const c of capQueueWithRetryRotation(queue, ledger, 5)) {
      if (c.claimId.startsWith('retry-')) allIds.add(c.claimId);
    }
  }
  ok('the cursor reaches every retryable claim in four runs', allIds.size === 10);

  // A changed payload under an UNVERIFIABLE verdict is fresh work.
  const changed = { claimId: 'retry-0', payloadHash: 'changed-hash' };
  const w2 = capQueueWithRetryRotation([changed], ledger, 5);
  ok('changed payload under UNVERIFIABLE verdict takes the fresh lane', w2[0].claimId === 'retry-0');
  ok('unchanged retryable fills the window (control)',
    capQueueWithRetryRotation(retries, ledger, 3).length === 3);

  // Reserved capacity: even when fresh work could fill the whole cap, the
  // retry backlog keeps its quarter (review round 3, #398).
  {
    const ledger2 = { verdicts: {} };
    for (const r of retries) ledger2.verdicts[r.claimId] = { verdict: 'UNVERIFIABLE', ph: 'x' };
    const bigRest = Array.from({ length: 300 }, (_, i) => ({ claimId: `fresh-${i}` }));
    const w = capQueueWithRetryRotation(bigRest.concat(retries), ledger2, 200);
    ok('retry backlog keeps reserved capacity under a full fresh queue',
      w.some((c) => c.claimId.startsWith('retry-')));
    ok('cap still respected under reservation', w.length === 200);
    ok('fresh lane dominates but does not starve retries',
      w.filter((c) => c.claimId.startsWith('fresh-')).length === 190 &&
      w.filter((c) => c.claimId.startsWith('retry-')).length === 10);
  }

  // Zero budget admits nothing (review round 3, #398).
  {
    const ledger3 = { verdicts: { 'retry-0': { verdict: 'UNVERIFIABLE', ph: 'x' } } };
    const q = [{ claimId: 'fresh-1' }, { claimId: 'retry-0', payloadHash: 'x' }];
    ok('a zero claim cap admits zero claims', capQueueWithRetryRotation(q, ledger3, 0).length === 0);
  }

  // Lane discipline (review round 11, #399): an explicit filter selects the
  // invocation's lane; NO filter is the documented full run.
  {
    const ledger4 = { verdicts: { 'pm-retry': { verdict: 'UNVERIFIABLE', ph: 'x' } } };
    const q = [
      { claimId: 'rb-1', verifier: 'rule-based' },
      { claimId: 'rb-2', verifier: 'rule-based' },
      { claimId: 'pm-retry', payloadHash: 'x', verifier: 'pubmed' },
    ];
    const generalPass = capQueueWithRetryRotation(q, ledger4, 2, ['rule-based']);
    ok('the filtered general pass excludes pubmed retries entirely (no double-spend)',
      generalPass.length === 2 && generalPass[0].claimId === 'rb-1' && generalPass[1].claimId === 'rb-2');
    const pubmedLane = capQueueWithRetryRotation(q, ledger4, 2, ['pubmed']);
    ok('pubmed lane admits its own retries', pubmedLane.some((c) => c.claimId === 'pm-retry'));
    const fullRun = capQueueWithRetryRotation(q, ledger4, 3);
    ok('an unfiltered invocation is the full run — pubmed included',
      fullRun.some((c) => c.claimId === 'pm-retry'));
  }

  // Scoped cursors (review round 11, #399): each narrowing rotates its own
  // backlog and never touches another scope's window.
  {
    const ledger5 = { verdicts: {} };
    const retries5 = Array.from({ length: 10 }, (_, i) => ({ claimId: `retry-${i}`, payloadHash: 'x' }));
    for (const r of retries5) ledger5.verdicts[r.claimId] = { verdict: 'UNVERIFIABLE', ph: 'x' };
    capQueueWithRetryRotation(retries5, ledger5, 5);
    ok('the unscoped run persists its cursor', ledger5.retryCursors.full.lastClaimId === 'retry-4');
    capQueueWithRetryRotation(retries5, ledger5, 3, undefined, 'pri:BLA');
    ok('a narrowed run keeps its own cursor', ledger5.retryCursors['full|pri:BLA'].lastClaimId === 'retry-2');
    ok('the narrowed run does not advance the full-lane cursor', ledger5.retryCursors.full.lastClaimId === 'retry-4');
    const resumed = capQueueWithRetryRotation(retries5, ledger5, 5);
    ok('the full lane resumes from its own cursor', resumed[0].claimId === 'retry-5');
    const narrowedAgain = capQueueWithRetryRotation(retries5, ledger5, 3, undefined, 'pri:BLA');
    ok('the narrowed scope resumes from ITS cursor', narrowedAgain[0].claimId === 'retry-3');
  }

  // Same-size reverify lists get distinct cursor scopes (cold audit
  // 2026-10-17): a count-based scope ('ids:4') made alternating lists share
  // a rotation window; a fingerprint of the sorted selection keeps them
  // independent.
  {
    const { portalAuditFingerprint } = await import('./organ-claim-verification.mjs');
    const fp = (ids) => 'ids:' + payloadHash(ids.slice().sort().join(',')).slice(0, 8);
    const scopeA = fp(['a', 'b', 'e', 'f']);
    const scopeB = fp(['c', 'd', 'e', 'f']);
    ok('different id lists get different cursor scopes', scopeA !== scopeB);
    ok('same id list gets a stable scope', scopeA === fp(['f', 'e', 'b', 'a']));

    const ledger6 = { verdicts: {} };
    const mk = (id) => ({ claimId: id, payloadHash: 'x' });
    const selA = ['a', 'b', 'e', 'f'].map(mk);
    const selB = ['c', 'd', 'e', 'f'].map(mk);
    for (const c of selA.concat(selB)) ledger6.verdicts[c.claimId] = { verdict: 'UNVERIFIABLE', ph: 'x' };
    capQueueWithRetryRotation(selA, ledger6, 2, undefined, scopeA); // a,b
    capQueueWithRetryRotation(selA, ledger6, 2, undefined, scopeA); // e,f
    const b1 = capQueueWithRetryRotation(selB, ledger6, 2, undefined, scopeB).map((c) => c.claimId);
    ok('the second list starts its own window instead of inheriting the first', b1.join(',') === 'c,d');
    const b2 = capQueueWithRetryRotation(selB, ledger6, 2, undefined, scopeB).map((c) => c.claimId);
    ok('the second list reaches its tail on its own schedule', b2.join(',') === 'e,f');
  }
}


// --- Item 2 ---------------------------------------------------------------
// A ledger verdict applies only to the exact payload it was computed from.
// Propagation and reconciliation must both enforce that — a stale VERIFIED
// must never display or count as current.

// Propagation: fresh verdict applies (control).
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: VERIFIER_VERSION } } };
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
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: 'deadbeefdeadbeef', verifierVersion: VERIFIER_VERSION } } };
  propagateVerdictsToCube(cube, ledger);
  ok('payload-drift stale reason is recorded as such',
    cube.cells[0].disorders[0].verification.staleReason === 'payload-changed');
  const r = reconcilePopulation(cube, ledger, '2026-10-16T00:00:00Z', 'abc123');
  ok('reconciliation does not count a stale verdict as VERIFIED', r.effectiveCurrentByVerdict.VERIFIED === 0);
  ok('reconciliation counts a stale verdict as PENDING', r.effectiveCurrentByVerdict.PENDING === 1);
  ok('reconciliation tallies staleLedgerVerdicts', r.staleLedgerVerdicts === 1);
}

// Reconciliation: fresh verdict counts (control).
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: VERIFIER_VERSION } } };
  const r = reconcilePopulation(cube, ledger, '2026-10-16T00:00:00Z', 'abc123');
  ok('fresh ledger verdict counts as VERIFIED (control)', r.effectiveCurrentByVerdict.VERIFIED === 1 && r.staleLedgerVerdicts === 0);
}

// Rejected verifier versions are not presented as current anywhere (review
// round 5, #399): an ei1 pubmed verdict is pending at display AND count,
// while an accepted ei1 rule-based verdict still displays. The stale reason
// distinguishes rule rejection from payload drift (round 7).
{
  const cube = { cells: [mkCell({ disorders: [{ ...disorderItem }] })] };
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: 'claim-verification/2026-10-16.ei1' } } };
  propagateVerdictsToCube(cube, ledger);
  const v = cube.cells[0].disorders[0].verification;
  ok('ei1 pubmed verdict does not display (rejected version)', v.stale === true);
  ok('stale reason is verifier-version, not payload-changed', v.staleReason === 'verifier-version');
  const r = reconcilePopulation(cube, ledger, 't', 'c');
  ok('ei1 pubmed verdict counts as pending, not verified', r.effectiveCurrentByVerdict.VERIFIED === 0 && r.staleLedgerVerdicts === 1);
}
{
  const bindingItem = { portalSlug: 'acme', relationshipType: 'treats', entityName: 'X', role: 'target', confidence: 0.9 };
  const bPh = payloadHash(CLAIM_SHAPES.binding.payload(bindingItem));
  const cell = mkCell({ portalBindings: [bindingItem] });
  const bId = 'bind::BLA__active__trade::acme::treats::X::target';
  const cube = { cells: [cell] };
  const ledger = { verdicts: { [bId]: { verdict: 'VERIFIED', verifier: 'rule-based', checkedAt: '2026-01-01T00:00:00Z', ph: bPh, verifierVersion: 'claim-verification/2026-10-16.ei1' } } };
  propagateVerdictsToCube(cube, ledger);
  ok('accepted ei1 rule-based verdict still displays (control)', cube.cells[0].portalBindings[0].verification.verdict === 'VERIFIED');
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

// --- Post-merge replays (#398 follow-up) -----------------------------------

// Codex's reproduced false contradiction: a semicolon-separated null
// secondary outcome in the same sentence-line must NOT dispute.
ok('null secondary outcome after a semicolon does not dispute',
  !abstractContradicts('Exposure therapy improved symptoms; there was no significant difference in dropout rates', 'Exposure Therapy'));
ok('genuine contradiction still fires (control)',
  abstractContradicts('In this cohort, exposure therapy did not improve outcomes.', 'Exposure Therapy'));

// Cold audit 2026-10-17: discourse markers before a coreferential pronoun,
// and passive markers attached to another subject.
ok('discourse adverb before the pronoun still disputes',
  abstractContradicts('Exposure therapy was tested; however, it did not improve outcomes.', 'Exposure Therapy'));
ok('passive marker attached to another subject does not misattribute',
  !abstractContradicts('Exposure therapy was tested; sertraline showed no benefit, which was observed in controls.', 'Exposure Therapy'));
ok('plain pronoun continuation still disputes (control)',
  abstractContradicts('Exposure therapy was tested; it did not improve outcomes.', 'Exposure Therapy'));

// Review on #401: adjunct-prefixed passive continuations carry over, but
// demonstrative determiners are not pronouns.
ok('adjunct before a passive result still disputes',
  abstractContradicts('Exposure therapy was assessed; in this study, no significant improvement was observed', 'Exposure Therapy'));
ok('demonstrative determiner is not coreference',
  !abstractContradicts('Exposure therapy improved symptoms; however, this study found no benefit of sertraline', 'Exposure Therapy'));

// Review round 2, #401: opening-referent gating and expletives.
ok('pronoun still corefers when the demonstrative is not the opening referent',
  abstractContradicts('Exposure therapy was tested; it did not improve outcomes in this study', 'Exposure Therapy'));
ok('expletive it before another treatment result does not dispute',
  !abstractContradicts('Exposure therapy improved symptoms; however, it was found that sertraline did not improve outcomes', 'Exposure Therapy'));

// Fix on #401: an explicit reference back to the claim survives the
// expletive exclusion.
ok('expletive referring back to the claim still disputes',
  abstractContradicts('Exposure therapy was tested; it was found that the treatment did not improve symptoms.', 'Exposure Therapy'));

// Coreference (review on #399): the claim named in one clause and its
// negative result continued by pronoun or passive result marker in the next
// MUST dispute — clause delimiters do not break coreference.
ok('pronoun continuation across a semicolon still disputes',
  abstractContradicts('Exposure therapy was tested; it did not improve outcomes', 'Exposure Therapy'));
ok('passive result continuation across a colon still disputes',
  abstractContradicts('The result for exposure therapy was clear: no significant improvement was observed', 'Exposure Therapy'));
ok('unrelated negation without coreference does not dispute (control)',
  !abstractContradicts('Exposure therapy improved primary outcomes. Sertraline did not improve secondary measures in the same cohort.', 'Exposure Therapy'));

// Carry-over resets at true sentence boundaries (review round 2, #399).
ok('pronoun after a sentence break belongs to the new subject',
  !abstractContradicts('Exposure therapy improved symptoms. Sertraline was also tested. It did not improve outcomes.', 'Exposure Therapy'));
ok('passive marker in a fresh sentence about another outcome does not dispute',
  !abstractContradicts('Exposure therapy improved symptoms. No significant difference was observed in dropout rates.', 'Exposure Therapy'));

// Carry-over limits within a sentence (review round 3, #399): a mid-clause
// pronoun belongs to the clause's own subject, and arm-equivalence phrases
// are not directional failures.
ok('mid-clause pronoun for another subject does not carry over',
  !abstractContradicts('Exposure therapy improved symptoms; sertraline was tested but it did not improve outcomes', 'Exposure Therapy'));
ok('arm-equivalence phrase in a continuation does not dispute',
  !abstractContradicts('Exposure therapy improved symptoms; no significant difference was observed in dropout rates', 'Exposure Therapy'));
ok('decimal points do not split a clause',
  abstractContradicts('Exposure therapy produced an effect size of 0.2 and did not improve outcomes', 'Exposure Therapy'));
ok('a clause opening with the negative result itself still carries over',
  abstractContradicts('Exposure therapy was assessed: no improvement occurred', 'Exposure Therapy'));
ok('an adjunct starting a new sentence keeps the boundary',
  !abstractContradicts('Exposure therapy improved outcomes in the U.S. National surveys found no benefit.', 'Exposure Therapy'));
ok('abbreviation periods do not split a clause',
  abstractContradicts('Exposure therapy was tested in the U.S. and did not improve outcomes', 'Exposure Therapy'));

// Audit-input fingerprint (cold audit 2026-10-17): a regenerated fidelity
// report with different findings must invalidate an accepted cached
// binding verdict even though the claim payload and verifier version are
// unchanged.
{
  const bindingItem = { portalSlug: 'acme', relationshipType: 'treats', entityName: 'X', role: 'target', confidence: 0.9 };
  const bPh = payloadHash(CLAIM_SHAPES.binding.payload(bindingItem));
  const bId = 'bind::BLA__active__trade::acme::treats::X::target';
  const cleanReport = { perPortal: { acme: { ok: true, issues: [] } } };
  const v0 = verifyRuleBased({ kind: 'binding', payload: CLAIM_SHAPES.binding.payload(bindingItem) }, cleanReport);
  ok('verified bindings record their audit fingerprint', v0.verdict === 'VERIFIED' && typeof v0.auditFp === 'string');

  const flaggedReport = {
    perPortal: {
      acme: { ok: false, issues: [{ entityName: 'X', relType: 'treats', kind: 'role-mismatch', severity: 'high' }] },
    },
  };
  const lv = { ...v0, ph: bPh, verifierVersion: VERIFIER_VERSION };

  // Extraction: fingerprint mismatch forces re-attestation.
  const claims = [];
  extractCellClaims(mkCell({ portalBindings: [bindingItem] }), claims, { verdicts: { [bId]: lv } }, new Set(), false, flaggedReport);
  ok('regenerated audit with new findings re-enqueues the binding', claims.length === 1);

  // Extraction control: unchanged audit evidence still skips.
  const claims2 = [];
  extractCellClaims(mkCell({ portalBindings: [bindingItem] }), claims2, { verdicts: { [bId]: lv } }, new Set(), false, cleanReport);
  ok('unchanged audit evidence still skips (control)', claims2.length === 0);

  // Propagation: the old verdict displays as pending with an honest reason.
  const cube = { cells: [mkCell({ portalBindings: [bindingItem] })] };
  propagateVerdictsToCube(cube, { verdicts: { [bId]: lv } }, flaggedReport);
  const pv = cube.cells[0].portalBindings[0].verification;
  ok('stale binding is not displayed as VERIFIED', pv.stale === true && pv.verdict !== 'VERIFIED');
  ok('stale reason is audit-input-changed', pv.staleReason === 'audit-input-changed');

  // Reconciliation: counts as pending, not verified.
  const r = reconcilePopulation(cube, { verdicts: { [bId]: lv } }, 't', 'c', flaggedReport);
  ok('reconciliation does not count the invalidated binding as VERIFIED', r.effectiveCurrentByVerdict.VERIFIED === 0 && r.staleLedgerVerdicts === 1);

  // Control: unchanged report keeps it verified everywhere.
  const cube2 = { cells: [mkCell({ portalBindings: [bindingItem] })] };
  propagateVerdictsToCube(cube2, { verdicts: { [bId]: lv } }, cleanReport);
  ok('unchanged audit evidence still displays VERIFIED (control)', cube2.cells[0].portalBindings[0].verification.verdict === 'VERIFIED');

  // A vanished report or removed portal is a mismatch too (review on #401):
  // the claim must re-attest, not strand pending forever.
  const claims3 = [];
  extractCellClaims(mkCell({ portalBindings: [bindingItem] }), claims3, { verdicts: { [bId]: lv } }, new Set(), false, {});
  ok('missing report re-enqueues the binding', claims3.length === 1);
  const claims4 = [];
  extractCellClaims(mkCell({ portalBindings: [bindingItem] }), claims4, { verdicts: { [bId]: lv } }, new Set(), false, { perPortal: { 'other-portal': { ok: true, issues: [] } } });
  ok('portal removed from the report re-enqueues the binding', claims4.length === 1);

  // Pre-fingerprint accepted verdicts re-attest when a report can judge
  // them (review round 2, #401); malformed issue lists never crash the
  // fingerprint (review round 2, #401).
  const legacyLv = { verdict: 'VERIFIED', verifier: 'rule-based', ph: bPh, verifierVersion: VERIFIER_VERSION };
  const claims5 = [];
  extractCellClaims(mkCell({ portalBindings: [bindingItem] }), claims5, { verdicts: { [bId]: legacyLv } }, new Set(), false, cleanReport);
  ok('pre-fingerprint accepted verdict re-attests when a report exists', claims5.length === 1);
  const cube3 = { cells: [mkCell({ portalBindings: [bindingItem] })] };
  propagateVerdictsToCube(cube3, { verdicts: { [bId]: legacyLv } }, cleanReport);
  ok('pre-fingerprint verdict displays pending with audit-input reason',
    cube3.cells[0].portalBindings[0].verification.staleReason === 'audit-input-changed');
  ok('malformed issue list never crashes the fingerprint',
    portalAuditFingerprint({ ok: false, issues: 'oops' }).length > 0);

  // Malformed audit evidence invalidates a cached clean verdict (fix on
  // #401): validity is part of the fingerprint, so 'oops' no longer hashes
  // identically to [].
  const claims6 = [];
  extractCellClaims(mkCell({ portalBindings: [bindingItem] }), claims6, { verdicts: { [bId]: lv } }, new Set(), false,
    { perPortal: { acme: { ok: true, issues: 'oops' } } });
  ok('malformed issue list re-enqueues the binding', claims6.length === 1);
  const cube4 = { cells: [mkCell({ portalBindings: [bindingItem] })] };
  propagateVerdictsToCube(cube4, { verdicts: { [bId]: lv } }, { perPortal: { acme: { ok: true, issues: 'oops' } } });
  ok('malformed evidence displays pending with audit-input reason',
    cube4.cells[0].portalBindings[0].verification.staleReason === 'audit-input-changed');
}
ok('abbreviation ending a sentence still splits the sentence',
  !abstractContradicts('Exposure therapy improved symptoms in the U.S. Sertraline did not improve outcomes.', 'Exposure Therapy'));
ok('randomization ratios do not split a clause',
  abstractContradicts('Exposure therapy was compared 1:1 with control and did not improve outcomes', 'Exposure Therapy'));
ok('abbreviation before a capitalized proper noun stays one clause',
  abstractContradicts('Exposure therapy was tested by the U.S. Department and did not improve outcomes', 'Exposure Therapy'));
ok('abbreviation before an institutional adjunct stays one clause',
  abstractContradicts('Exposure therapy was tested by the U.K. National Health Service and did not improve outcomes', 'Exposure Therapy'));
ok('soft line wrap does not break claim context',
  abstractContradicts('Exposure therapy was tested in adults\nand did not improve outcomes', 'Exposure Therapy'));
ok('hard newline after a sentence still resets context',
  !abstractContradicts('Exposure therapy improved symptoms.\nSertraline did not improve outcomes.', 'Exposure Therapy'));

// Reconciliation uses the same per-verifier acceptance policy (review #399).
{
  const bindingItem = { portalSlug: 'acme', relationshipType: 'treats', entityName: 'X', role: 'target', confidence: 0.9 };
  const bPh = payloadHash(CLAIM_SHAPES.binding.payload(bindingItem));
  const cell = mkCell({ portalBindings: [bindingItem] });
  const bId = 'bind::BLA__active__trade::acme::treats::X::target';
  const ledger = { verdicts: { [bId]: { verdict: 'VERIFIED', verifier: 'rule-based', checkedAt: '2026-01-01T00:00:00Z', ph: bPh, verifierVersion: 'claim-verification/2026-10-16.ei1' } } };
  const r = reconcilePopulation({ cells: [cell] }, ledger, 't', 'c');
  ok('accepted ei1 rule-based verdict is not counted as older-rules', r.verdictsFromOlderVerifierRules === 0);
}
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: 'claim-verification/2026-10-16.ei1' } } };
  const r = reconcilePopulation({ cells: [cell] }, ledger, 't', 'c');
  ok('ei1 pubmed verdict is counted as older-rules', r.verdictsFromOlderVerifierRules === 1);
}

// ei1 rule-based verdicts stay accepted (their semantics were repaired in
// ei1); ei1 pubmed verdicts re-enqueue (negation rules changed in ei2).
{
  const { CLAIM_SHAPES } = await import('./organ-claim-verification.mjs');
  const bindingItem = { portalSlug: 'acme', relationshipType: 'treats', entityName: 'X', role: 'target', confidence: 0.9 };
  const bPh = payloadHash(CLAIM_SHAPES.binding.payload(bindingItem));
  const cell = mkCell({ portalBindings: [bindingItem] });
  const claims = [];
  extractCellClaims(cell, claims, { verdicts: { [`bind::BLA__active__trade::acme::treats::X::target`]: { verdict: 'VERIFIED', verifier: 'rule-based', ph: bPh, verifierVersion: 'claim-verification/2026-10-16.ei1' } } });
  ok('rule-based ei1 verdict stays accepted (no churn)', claims.length === 0);
}
{
  const cell = mkCell({ disorders: [{ ...disorderItem }] });
  const ledger = { verdicts: { 'dx::d1': { verdict: 'VERIFIED', verifier: 'pubmed', checkedAt: '2026-01-01T00:00:00Z', ph: disorderPh, verifierVersion: 'claim-verification/2026-10-16.ei1' } } };
  const claims = [];
  extractCellClaims(cell, claims, ledger);
  ok('pubmed ei1 verdict re-enqueues under ei2 rules', claims.length === 1);
}

// Codex's reproduced coverage defect, now with turnover: 52 successive
// budget-50 PubMed runs must reach every claim even while half of each
// admitted batch resolves terminally and the backlog compacts (the fixed-
// list version of this test masked the production failure).
{
  const ledger = { verdicts: {} };
  const all = Array.from({ length: 2582 }, (_, i) => ({ claimId: `r${String(i).padStart(4, '0')}`, payloadHash: 'x', verifier: 'pubmed' }));
  for (const r of all) ledger.verdicts[r.claimId] = { verdict: 'UNVERIFIABLE', ph: 'x' };
  const admitted = new Set();
  let population = all.slice();
  for (let w = 0; w < 52 && population.length; w++) {
    const batch = capQueueWithRetryRotation(population, ledger, 50, ['pubmed']);
    for (const c of batch) admitted.add(c.claimId);
    // Half of each admitted batch resolves terminally; the rest stays.
    batch.forEach((c, i) => { if (i % 2 === 0) delete ledger.verdicts[c.claimId]; });
    population = all.filter((c) => ledger.verdicts[c.claimId]);
  }
  ok('52 budget-50 runs reach every claim despite turnover', admitted.size === 2582);
}

console.log(`\n${passed} evidence-integrity assertions passed`);
