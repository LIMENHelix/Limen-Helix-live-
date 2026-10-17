#!/usr/bin/env node
/**
 * organ-claim-verification.mjs
 *
 * Task #33 — Main Brain verification organ.
 *
 * Walks every PENDING claim in treatment-discovery-cube.json and routes
 * it to the appropriate verifier:
 *
 *   NEUROSCIENCE claims (disorders, neuroTreatments, mechanisms, citations)
 *     → PubMed verifier (E-utilities REST API).
 *       Verifies cited articles exist + their abstracts support the claim.
 *
 *   BUSINESS / company-specific claims (warningSignals.evidence,
 *     intelligenceCycle.diagnosis citing filings, action items naming
 *     specific buybacks / dividends)
 *     → EDGAR verifier (filing lookup) + WebSearch verifier (news).
 *
 *   BRAIN-NODE × BUSINESS BINDINGS
 *     → Rule-based verifier (consistency with binding-fidelity-report
 *       + canonical role table). RUNNABLE TODAY (no external API).
 *
 *   TREATMENTS (domain.activations[].treatments)
 *     → WebSearch verifier (does this intervention exist by this name?).
 *
 *   CROSS-DOMAIN AFFINITIES
 *     → Internal consistency verifier (does target cell affirm reciprocal
 *       edge?). RUNNABLE TODAY.
 *
 * Stateful: writes verification-ledger.json with per-claim verdicts.
 * Resumes from the last claim ID on subsequent runs. Cached aggressively
 * — same claim re-verified only if its source data changed.
 *
 * Budget-paced: PubMed has a 3-req/sec rate limit unguarded, 10/sec with
 * API key. Default conservative pacing 2 req/sec. Operator can pass
 * --max-claims=N to limit one-run budget.
 *
 * Verdict propagation: once verdicts are recorded, runs the cube
 * post-processor to:
 *   - propagate verdicts onto cells
 *   - recompute aggregate verificationProfile per cell
 *
 * DOCTRINE — residuals survive. Verification WRITES an epistemic state onto a
 * claim; it never DELETES the residual. Do NOT exclude DISPUTED/FABRICATED
 * claims from residual computation. A contradicted/refuted transfer is the
 * "impossible" state — and impossible is research (study WHY it fails, where
 * the analogy breaks), not garbage. The four operator-facing states (see
 * assets/js/epistemic-state.js) are kept and labeled:
 *   VERIFIED → proven · THEORETICAL → unproven ·
 *   PENDING / UNVERIFIABLE → unknown · DISPUTED / FABRICATED → impossible.
 * compute-cross-domain-readout.mjs keeps every residual regardless of verdict.
 *
 * Usage:
 *   node scripts/organ-claim-verification.mjs              # full run, paced
 *   node scripts/organ-claim-verification.mjs --rule-based # only the runnable-today verifiers
 *   node scripts/organ-claim-verification.mjs --max=50     # cap claims this run
 *   node scripts/organ-claim-verification.mjs --priority=NAcc,BLA,HPA  # specific nodes only
 *   node scripts/organ-claim-verification.mjs --dry-run    # list what would be verified
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CUBE_FILE = path.join(ROOT, 'assets/data/treatment-discovery-cube.json');
const LEDGER_FILE = path.join(ROOT, 'assets/data/audit/verification-ledger.json');
const BINDING_REPORT_FILE = path.join(ROOT, 'assets/data/audit/binding-fidelity-report.json');

const PUBMED_API_KEY = process.env.PUBMED_API_KEY || null;
const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PUBMED_RATE_PER_SEC = PUBMED_API_KEY ? 8 : 2;

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const ARG = {
  ruleBasedOnly: args.includes('--rule-based'),
  dryRun: args.includes('--dry-run'),
  reconcileOnly: args.includes('--reconcile-only'),
  maxClaims: parseInt((args.find((a) => a.startsWith('--max=')) || '--max=200').split('=')[1], 10),
  priorityNodes: ((args.find((a) => a.startsWith('--priority=')) || '--priority=').split('=')[1] || '')
    .split(',')
    .filter(Boolean),
  // Only process claims whose target verifier matches one of these.
  // Useful for forcing a PubMed-only run after rule-based bindings have
  // already been processed.
  verifierFilter: ((args.find((a) => a.startsWith('--verifier=')) || '--verifier=').split('=')[1] || '')
    .split(',')
    .filter(Boolean),
  // Re-verify a specific list of claim IDs. Wipes their existing ledger
  // entries first so they re-run instead of being skipped. Used after a
  // verifier change to recompute the same set of claims under the new
  // predicate (clean delta — one-function diff, same claim set).
  reverifyIds: ((args.find((a) => a.startsWith('--reverify-ids=')) || '--reverify-ids=').split('=')[1] || '')
    .split(',')
    .filter(Boolean),
};

// ============================================================================
// PAYLOAD HASHING — staleness detection
// ============================================================================
// Every extracted claim carries a hash of its verification payload. Ledger
// verdicts store the hash they were computed under (`ph`). A source edit that
// changes a claim's payload while preserving its id (e.g. a treatment's
// mechanism or citations are rewritten) flips the hash, so the extractor no
// longer treats the old verdict as covering the new content and re-enqueues
// the claim. Without this, an obsolete VERIFIED/DISPUTED would ride on edited
// content indefinitely. Records written before this field existed are
// backfilled once (trusted — same assurance as the status quo) by
// backfillPayloadHashes(), never mass-re-verified against the weekly budget.

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function payloadHash(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 16);
}

// Count of claims re-enqueued this run because their payload changed under a
// preserved id (reported after extraction).
let stalePayloadCount = 0;

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('[verification-organ] starting');
  console.log(`  --rule-based: ${ARG.ruleBasedOnly}`);
  console.log(`  --dry-run:    ${ARG.dryRun}`);
  console.log(`  --max:        ${ARG.maxClaims}`);
  if (ARG.priorityNodes.length)
    console.log(`  --priority:   ${ARG.priorityNodes.join(',')}`);
  if (!PUBMED_API_KEY) {
    console.log('  [info] PUBMED_API_KEY not set — PubMed pacing is 2/sec (slow)');
  }
  console.log('');

  const cube = JSON.parse(fs.readFileSync(CUBE_FILE, 'utf-8'));
  const bindingReport = safeReadJSON(BINDING_REPORT_FILE) || {};
  const ledger = safeReadJSON(LEDGER_FILE) || {
    schemaVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    lastUpdatedAt: null,
    verdicts: {}, // claimId → verdict object
    stats: {
      VERIFIED: 0, DISPUTED: 0, THEORETICAL: 0, UNVERIFIABLE: 0,
      FABRICATED: 0, PENDING: 0, byVerifier: {},
    },
  };

  // Stamp payload hashes onto pre-hashing ledger records (one-time per
  // record). Trusts the existing verdict — same assurance as before the hash
  // existed — instead of burning the verification budget on a mass re-run;
  // from this point on, any payload edit under a preserved id flips the hash
  // and forces re-verification.
  {
    const refs = [];
    for (const cell of cube.cells || []) extractCellClaims(cell, refs, ledger, new Set(), true);
    let backfilled = 0;
    for (const r of refs) {
      const lv = ledger.verdicts[r.claimId];
      // Legacy stamps are marked as such: the hash was backfilled onto an
      // existing verdict (trusted migration), not attested by a verification
      // run against that payload. The regeneration step can distinguish
      // attested from stamped evidence via phLegacy.
      if (lv && !lv.ph) { lv.ph = r.payloadHash; lv.phLegacy = true; backfilled++; }
    }
    if (backfilled) console.log(`[verification-organ] payload-hash backfill: stamped ${backfilled}/${refs.length} current claims`);
  }

  if (ARG.reconcileOnly) {
    const snapshotAt = process.env.LIMEN_SNAPSHOT_AT || new Date().toISOString();
    const sourceCommit = process.env.LIMEN_SOURCE_COMMIT || null;
    // Propagate BEFORE reconciling (same order as the full run), so the
    // reconciliation counts the verdicts the cube actually displays.
    const propagated = propagateVerdictsToCube(cube, ledger, bindingReport);
    const reconciliation = reconcilePopulation(cube, ledger, snapshotAt, sourceCommit, bindingReport);
    ledger.reconciliation = reconciliation;

    cube.verificationReconciliation = reconciliation;
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
    fs.writeFileSync(CUBE_FILE, JSON.stringify(cube, null, 2));

    console.log('[verification-organ] reconcile-only');
    console.log(`  current unique claims:       ${reconciliation.uniqueCurrentClaims}`);
    console.log(`  matched ledger claims:       ${reconciliation.matchedLedgerClaims}`);
    console.log(`  current without ledger:      ${reconciliation.currentClaimsWithoutLedger}`);
    console.log(`  archived ledger claims kept: ${reconciliation.archivedLedgerClaims}`);
    console.log(`  propagated occurrences:      ${propagated}`);
    return;
  }

  // If --reverify-ids set, those claims re-run regardless of skip gates —
  // reverifySet already bypasses skipFor/staleOrNew during extraction. The
  // previous ledger entry is NOT wiped (review on #398): recordVerdict()
  // supersedes it with full history when the new verdict lands, and if the
  // re-run produces PENDING (stub verifier) the prior evidence stays intact
  // instead of silently vanishing from the ledger.
  if (ARG.reverifyIds.length) {
    console.log(`[verification-organ] --reverify-ids: ${ARG.reverifyIds.length} claim(s) re-run this pass; existing entries are superseded with history, not wiped`);
  }

  // ============================================================================
  // EXTRACT CLAIMS — every PENDING claim across every cell
  // ============================================================================
  const claims = extractAllClaims(cube, ledger, bindingReport);
  console.log(`[verification-organ] PENDING claims extracted: ${claims.length}` +
    (stalePayloadCount ? ` (${stalePayloadCount} stale payload — source edited under a preserved id)` : ''));

  // Priority filter
  let queue = claims;
  if (ARG.priorityNodes.length) {
    queue = queue.filter((c) => ARG.priorityNodes.includes(c.brainNodeId));
    console.log(`[verification-organ] priority filter → ${queue.length} claims`);
  }
  if (ARG.verifierFilter.length) {
    queue = queue.filter((c) => ARG.verifierFilter.includes(c.verifier));
    console.log(`[verification-organ] verifier filter → ${queue.length} claims`);
  }
  if (ARG.reverifyIds.length) {
    const wanted = new Set(ARG.reverifyIds);
    queue = queue.filter((c) => wanted.has(c.claimId));
    console.log(`[verification-organ] reverify-ids filter → ${queue.length} claims`);
  }

  // Order claims: rule-based first (fastest, no API), then PubMed/WebSearch
  queue.sort((a, b) => verifierPriority(a.verifier) - verifierPriority(b.verifier));

  // Dedupe by claimId — broadcast across comparison domains can cause the
  // same claim ID to appear in ~28 cells, each enqueued separately. Without
  // dedupe a --priority=BLA run processes the same claim ~17× over,
  // converging on one ledger slot. Pure budget bug.
  {
    const seen = new Set();
    queue = queue.filter((c) => (seen.has(c.claimId) ? false : (seen.add(c.claimId), true)));
  }

  // Apply max-claims cap — retryable (UNVERIFIABLE) claims re-enqueue every
  // run by design (item 3); the backlog is tiled by a durable cursor stored
  // in the ledger itself, so weekly runs continue where the last one stopped
  // regardless of turnover. Fresh claims keep priority order.
  queue = capQueueWithRetryRotation(queue, ledger, ARG.maxClaims, ARG.verifierFilter,
    (ARG.priorityNodes.length ? 'pri:' + ARG.priorityNodes.join(',') : '') +
    // Cursor scope carries a stable fingerprint of the SELECTED ids, not
    // their count (cold audit 2026-10-17): two same-size reverify lists
    // must never share a rotation window.
    (ARG.reverifyIds.length ? 'ids:' + payloadHash(ARG.reverifyIds.slice().sort().join(',')).slice(0, 8) : ''));
  console.log(`[verification-organ] working set this run: ${queue.length}`);

  if (ARG.dryRun) {
    console.log('');
    console.log('=== DRY RUN — claim types in working set ===');
    const byType = {};
    for (const c of queue) {
      const k = `${c.kind} via ${c.verifier}`;
      byType[k] = (byType[k] || 0) + 1;
    }
    for (const [k, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(48)} ${n}`);
    }
    return;
  }

  // ============================================================================
  // DISPATCH — verify each claim
  // ============================================================================
  let processed = 0;
  const startMs = Date.now();
  for (const claim of queue) {
    if (ARG.ruleBasedOnly && !['rule-based', 'internal-consistency'].includes(claim.verifier)) {
      continue;
    }

    let verdict;
    try {
      verdict = await dispatch(claim, cube, bindingReport);
    } catch (err) {
      verdict = {
        verdict: 'UNVERIFIABLE',
        verifier: claim.verifier,
        evidence: [],
        confidence: 0,
        checkedAt: new Date().toISOString(),
        note: `error: ${err.message}`,
      };
    }
    // Stub verifiers (e.g. websearch until its API is wired) return PENDING.
    // Never persist a PENDING verdict: the record would make the extractor
    // skip the claim forever, even after the real verifier is enabled.
    if (verdict.verdict !== 'PENDING') {
      recordVerdict(ledger, claim.claimId, verdict, claim.payloadHash);
    }
    ledger.stats[verdict.verdict] = (ledger.stats[verdict.verdict] || 0) + 1;
    ledger.stats.byVerifier[verdict.verifier] = (ledger.stats.byVerifier[verdict.verifier] || 0) + 1;
    processed++;

    if (processed % 25 === 0) {
      console.log(
        `  ...${processed}/${queue.length} processed, ${verdict.verdict} (last) — ${Math.round(
          ((Date.now() - startMs) / 1000)
        )}s elapsed`
      );
    }

    // Pace external calls
    if (claim.verifier === 'pubmed') {
      await sleep(1000 / PUBMED_RATE_PER_SEC);
    } else if (claim.verifier === 'websearch' || claim.verifier === 'edgar') {
      await sleep(500); // 2/sec
    }
  }

  // Stats are a materialized view of verdicts, never an independently
  // incremented authority. Recounting here prevents interrupted/reverification
  // runs from leaving the rollup inconsistent with the record population.
  ledger.stats = recomputeLedgerStats(ledger.verdicts || {});
  ledger.lastUpdatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });

  // ============================================================================
  // PROPAGATE — apply verdicts back to cube cells
  // ============================================================================
  console.log('');
  console.log('[verification-organ] propagating verdicts to cube cells');
  const propagated = propagateVerdictsToCube(cube, ledger, bindingReport);
  const reconciliation = reconcilePopulation(
    cube,
    ledger,
    ledger.lastUpdatedAt,
    process.env.LIMEN_SOURCE_COMMIT || null,
    bindingReport
  );
  ledger.reconciliation = reconciliation;
  cube.verificationReconciliation = reconciliation;
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
  fs.writeFileSync(CUBE_FILE, JSON.stringify(cube, null, 2));

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('');
  console.log('=== VERIFICATION SUMMARY ===');
  console.log(`claims processed this run:  ${processed}`);
  console.log(`total verdicts in ledger:   ${Object.keys(ledger.verdicts).length}`);
  console.log('by verdict:');
  for (const v of ['VERIFIED', 'DISPUTED', 'THEORETICAL', 'UNVERIFIABLE', 'FABRICATED', 'PENDING']) {
    const n = ledger.stats[v] || 0;
    if (n > 0) console.log(`  ${v.padEnd(14)} ${n}`);
  }
  console.log('by verifier:');
  for (const [v, n] of Object.entries(ledger.stats.byVerifier).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.padEnd(20)} ${n}`);
  }
  console.log('');
  console.log(`claims propagated to cube cells: ${propagated}`);
  console.log(`ledger: ${path.relative(ROOT, LEDGER_FILE)}`);
  console.log('');
  if (!ARG.ruleBasedOnly && processed < claims.length) {
    console.log(`NOTE: ${claims.length - processed} claims remain PENDING — re-run to continue.`);
  }
  console.log('After full verification, re-run compute-cross-domain-readout');
  console.log('to recompute residuals — ALL residuals are kept and labeled by');
  console.log('epistemic state (proven/unproven/unknown/impossible); none are dropped.');
}

// ============================================================================
// CLAIM EXTRACTION
// ============================================================================

function extractAllClaims(cube, ledger, bindingReport) {
  const claims = [];
  const reverifySet = new Set(ARG.reverifyIds || []);
  stalePayloadCount = 0;
  for (const cell of cube.cells) {
    extractCellClaims(cell, claims, ledger, reverifySet, false, bindingReport);
  }
  return claims;
}

const VERDICT_KEYS = ['VERIFIED', 'DISPUTED', 'THEORETICAL', 'UNVERIFIABLE', 'FABRICATED', 'PENDING'];

function emptyVerdictCounts() {
  return Object.fromEntries(VERDICT_KEYS.map((key) => [key, 0]));
}

function recomputeLedgerStats(verdicts) {
  const stats = { ...emptyVerdictCounts(), byVerifier: {} };
  for (const verdict of Object.values(verdicts || {})) {
    const state = verdict && verdict.verdict ? verdict.verdict : 'PENDING';
    stats[state] = (stats[state] || 0) + 1;
    const verifier = verdict && verdict.verifier ? verdict.verifier : 'unknown';
    stats.byVerifier[verifier] = (stats.byVerifier[verifier] || 0) + 1;
  }
  return stats;
}

// Write a verdict while preserving history (audit 2026-10-16, item 3).
// A superseded verdict is never erased: it moves into a bounded history
// array (newest-last) with the hash and verifier version it was computed
// under, so every claim keeps its full attempt trail.
function recordVerdict(ledger, claimId, verdict, ph) {
  const prev = ledger.verdicts[claimId];
  const entry = { ...verdict, ph, verifierVersion: VERIFIER_VERSION };
  if (prev) {
    // Retain the COMPLETE prior verdict — evidence and confidence included
    // (review on #398): the PMID/query or audit source that justified the
    // superseded decision is exactly what an audit trail must keep. Only
    // nested history is excluded to bound depth.
    const { history: _nested, ...prevSnapshot } = prev;
    entry.history = [...(prev.history || []), prevSnapshot].slice(-10);
    entry.supersedes = prev.checkedAt || null;
  }
  ledger.verdicts[claimId] = entry;
  return entry;
}

function collectCurrentClaims(cube) {
  const claims = new Map();
  const add = (claimId, item) => {
    const verdict = (item && item.verification && item.verification.verdict) || 'PENDING';
    if (claims.has(claimId) && claims.get(claimId) !== verdict) {
      throw new Error(
        `current cube assigns conflicting verdicts to ${claimId}: ` +
        `${claims.get(claimId)} vs ${verdict}`
      );
    }
    claims.set(claimId, verdict);
  };

  for (const cell of cube.cells || []) {
    // Identity comes from CLAIM_SHAPES — the same definition extraction and
    // propagation use — so a claim id can never mean two different payloads.
    forEachCellClaim(cell, (kind, shape, item, cellId) => add(shape.id(item, cellId), item));
  }
  return claims;
}

function reconcilePopulation(cube, ledger, snapshotAt, sourceCommit, bindingReport = null) {
  const currentClaims = collectCurrentClaims(cube);
  const ledgerIds = Object.keys(ledger.verdicts || {});
  const currentIds = new Set(currentClaims.keys());
  const matchedIds = ledgerIds.filter((id) => currentIds.has(id));
  const archivedIds = ledgerIds.filter((id) => !currentIds.has(id));
  const currentWithoutLedger = [...currentIds].filter((id) => !ledger.verdicts[id]);
  const effectiveCurrentByVerdict = emptyVerdictCounts();

  // APPLICABILITY (audit 2026-10-16, item 2): a ledger verdict counts as the
  // effective current verdict only when it was computed against the claim's
  // CURRENT payload (hash match). A stale or unattested verdict remains
  // preserved in the ledger but counts as PENDING here — the claim is
  // awaiting re-verification and must not be tallied under its old label.
  const currentPh = new Map();
  const currentItem = new Map();
  for (const cell of cube.cells || []) {
    forEachCellClaim(cell, (kind, shape, item, cellId) => {
      const id = shape.id(item, cellId);
      if (!currentPh.has(id)) {
        currentPh.set(id, payloadHash(shape.payload(item)));
        currentItem.set(id, item);
      }
    });
  }

  let staleLedgerVerdicts = 0;
  let olderVerifierRules = 0;
  for (const [claimId, sourceVerdict] of currentClaims) {
    const lv = ledger.verdicts[claimId];
    let effective = sourceVerdict;
    if (lv) {
      const ph = currentPh.get(claimId);
      const auditOk = !claimId.startsWith('bind::') || lv.verdict === 'UNVERIFIABLE' ||
        (bindingReport && currentItem.get(claimId)
          ? !!(lv.auditFp && bindingAuditFingerprint(bindingReport, currentItem.get(claimId).portalSlug) === lv.auditFp)
          : true);
      if (lv.ph && ph && lv.ph === ph && verdictAccepted(lv) && auditOk) {
        effective = lv.verdict;
      } else {
        effective = 'PENDING';
        staleLedgerVerdicts++;
      }
      if ((lv.verifierVersion || null) !== VERIFIER_VERSION) {
        // Per-verifier acceptance (review round 4, #399): only count a
        // verdict as older-rules when its verifier actually rejects that
        // version — ei1 rule-based records are deliberately accepted, not
        // backlog.
        if (!verdictAccepted(lv)) olderVerifierRules++;
      }
    }
    effectiveCurrentByVerdict[effective] = (effectiveCurrentByVerdict[effective] || 0) + 1;
  }

  ledger.stats = recomputeLedgerStats(ledger.verdicts || {});
  return {
    schemaVersion: 'verification-reconciliation/1.1',
    snapshotAt,
    sourceCommit,
    verifierVersion: VERIFIER_VERSION,
    uniqueCurrentClaims: currentClaims.size,
    matchedLedgerClaims: matchedIds.length,
    currentClaimsWithoutLedger: currentWithoutLedger.length,
    archivedLedgerClaims: archivedIds.length,
    staleLedgerVerdicts,
    verdictsFromOlderVerifierRules: olderVerifierRules,
    effectiveCurrentByVerdict,
    ledgerAllTimeByVerdict: Object.fromEntries(
      Object.entries(ledger.stats).filter(([key]) => key !== 'byVerifier')
    ),
    note:
      'Current claims are the unique claim-id population in this cube snapshot. ' +
      'A ledger verdict counts as effective only when its payload hash matches the current claim payload; ' +
      'stale or unattested verdicts count as PENDING (awaiting re-verification) and are tallied in staleLedgerVerdicts. ' +
      'Archived ledger claims are preserved evidence whose ids no longer occur in the current cube; ' +
      'they are not counted as current rendered claims.',
  };
}

// ============================================================================
// CLAIM SHAPES — identity + verification payload, defined exactly once
// ============================================================================
// Extraction (staleness detection), propagation (freshness), and
// reconciliation (applicability) must all hash the SAME payload for a claim,
// or a verdict silently rides on content it was never computed from. Adding
// or changing a claim kind means editing this table — nowhere else.
const CLAIM_SHAPES = {
  issue: {
    collection: 'issues',
    id: (i) => `iss::${i.id}`,
    payload: (i) => ({ id: i.id, symptom: i.symptom, sourceType: i.sourceType, sourceFile: i.sourceFile, severity: i.severity }),
  },
  disorder: {
    collection: 'disorders',
    id: (d) => `dx::${d.id}`,
    payload: (d) => ({ id: d.id, name: d.name, mechanism: d.mechanism, primaryNodesAffected: d.primaryNodesAffected, citations: d.citations }),
  },
  'neuro-treatment': {
    collection: 'neuroTreatments',
    id: (t) => `ntx::${t.id}`,
    payload: (t) => ({ id: t.id, name: t.name, type: t.type, citations: t.citations }),
  },
  'domain-treatment': {
    collection: 'domainTreatments',
    id: (t) => `dtx::${t.id}`,
    payload: (t) => ({ id: t.id, name: t.name, type: t.type, description: t.description, side: t.side }),
  },
  binding: {
    collection: 'portalBindings',
    // Role is part of the identity (review on #398): the cube contains
    // bindings that share cell/portal/relType/entity but differ in role —
    // without it, two payloads share one claim id, per-occurrence freshness
    // applies a verdict to one and stale-marks the other, and
    // collectCurrentClaims then aborts the run on the conflict.
    id: (b, cellId) => `bind::${cellId}::${b.portalSlug}::${b.relationshipType}::${b.entityName}::${b.role}`,
    payload: (b) => ({ portalSlug: b.portalSlug, entityName: b.entityName, relationshipType: b.relationshipType, role: b.role, confidence: b.confidence }),
  },
  affinity: {
    collection: 'crossDomainAffinities',
    id: (a, cellId) => `aff::${cellId}::${a.toDomain}::${a.toRole}`,
    payload: (a) => ({ toDomain: a.toDomain, toRole: a.toRole }),
  },
  residual: {
    collection: 'residuals',
    id: (r) => `res::${r.id}`,
    payload: (r) => ({ id: r.id, direction: r.direction, sourceTreatmentName: r.sourceTreatment?.name, candidatePort: r.candidatePort }),
  },
};

const KIND_VERIFIER = {
  issue: (i) => i.verification?.verifier || 'websearch',
  disorder: () => 'pubmed',
  'neuro-treatment': () => 'pubmed',
  'domain-treatment': () => 'websearch',
  binding: () => 'rule-based',
  affinity: () => 'internal-consistency',
  residual: (r) => (r.direction === 'NEURO_TO_DOMAIN' ? 'websearch' : 'pubmed'),
};

function forEachCellClaim(cell, cb) {
  for (const [kind, shape] of Object.entries(CLAIM_SHAPES)) {
    for (const item of cell[shape.collection] || []) cb(kind, shape, item, cell.cellId);
  }
}

// Verdicts written by this build are stamped with this version. Records
// predating it are reported by reconcilePopulation so the regeneration step
// can see exactly how much of the ledger predates the evidence-integrity
// repair — without auto-invalidating them mid-pipeline. ei2: negation-guard
// coreference/decimal fixes (#399) — ei1 pubmed verdicts re-enqueue. ei3:
// discourse/adjunct/expletive semantics (#401) — ei2 pubmed verdicts
// re-enqueue so cached claims are re-judged under the final rules.
const VERIFIER_VERSION = 'claim-verification/2026-10-17.ei3';

// Verdicts produced before the evidence-integrity repair re-enqueue even
// when the payload hash matches — a hash match proves the content is
// unchanged, not that the old rules were sound (review on #398). Versions
// are accepted PER VERIFIER (review round 3 on #399): the ei2 bump changed
// only PubMed's contradiction semantics, so rule-based ei1 verdicts stay
// accepted and don't churn the general lane; rule-based records predating
// ei1 (the 150 unsupported VERIFIEDs) and all pre-ei2 PubMed verdicts
// re-enqueue. Module-level because skipFor (extraction) and
// reconcilePopulation (reporting) must apply the SAME acceptance policy
// (review round 4 on #399).
const ACCEPTED_VERSIONS = {
  'rule-based': new Set(['claim-verification/2026-10-16.ei1', 'claim-verification/2026-10-16.ei2', 'claim-verification/2026-10-17.ei3']),
  pubmed: new Set(['claim-verification/2026-10-17.ei3']),
};

// skipFor (extraction), propagateVerdictsToCube (display), and
// reconcilePopulation (reporting) all consume this: a verdict written under
// a rejected verifier version is re-enqueued AND nowhere presented as
// current (review round 5 on #399).
function verdictAccepted(lv) {
  const accepted = ACCEPTED_VERSIONS[lv.verifier];
  return !accepted || accepted.has(lv.verifierVersion || null);
}

function extractCellClaims(cell, claims, ledger, reverifySet = new Set(), collectOnly = false, bindingReport = null) {
  // Each claim is a (claimId, kind, verifier, payload, cell context) tuple.
  // Co-occurrence context — disorder names + node region terms — is what the
  // tightened PubMed query AND's against so token matches can't drift to
  // unrelated literatures (e.g. "exposure therapy" matching cystic fibrosis
  // papers).
  const ctx = {
    brainNodeId: cell.brainNodeId,
    stateBucket: cell.stateBucket,
    comparisonDomain: cell.comparisonDomain,
    cellId: cell.cellId,
    cellDisorderNames: (cell.disorders || []).map((d) => d.name).filter(Boolean),
    cellNodeRegion: cell.node?.region || null,
  };

  // Ledger freshness gate. A ledger verdict covers a claim ONLY under the
  // payload hash it was computed against (`ph`). If a source edit changed the
  // payload under a preserved id, the hash no longer matches and the claim is
  // re-enqueued — an obsolete verdict must not ride on new content. Claims
  // with no ledger record keep the legacy behavior: a baked-in non-PENDING
  // cube verdict (written by the cube builders, e.g. disorders from the
  // neuro-disorder lookup) is trusted and skipped.
  //   collectOnly: skip every gate and emit {claimId, payloadHash} only — used
  //   by the one-time hash backfill, so the id/payload definitions live in
  //   exactly one place.
  const ledgerCurrent = (claimId, ph) => {
    const lv = ledger.verdicts[claimId];
    return !!(lv && lv.ph === ph);
  };
  const staleOrNew = (item, claimId, ph) => {
    const lv = ledger.verdicts[claimId];
    if (lv && lv.ph !== ph && !reverifySet.has(claimId)) stalePayloadCount++;
    return !ledgerCurrent(claimId, ph);
  };
  // UNVERIFIABLE means we could not examine the claim — it is retryable
  // forever (audit 2026-10-16, item 3). Previously a matching payload hash
  // permanently suppressed retries, stranding thousands of unexamined
  // claims under a hash that proved nothing.
  const RETRYABLE = new Set(['UNVERIFIABLE']);
  const skipFor = (item, claimId, ph) => {
    const lv = ledger.verdicts[claimId];
    if (lv && !reverifySet.has(claimId)) {
      if (RETRYABLE.has(lv.verdict)) return false;
      if (!verdictAccepted(lv)) return false;
      // Audit-evidence applicability (cold audit 2026-10-17): a binding
      // verdict recorded WHICH audit content it came from. If the
      // regenerated fidelity report now says something different for this
      // portal, the verdict's evidence is out of date even though the
      // claim payload and verifier version are unchanged — re-attest.
      if (claimId.startsWith('bind::') && bindingReport && lv.verdict !== 'UNVERIFIABLE') {
        // A missing fingerprint is a mismatch too (review on #401): if the
        // report vanished or the portal was dropped, the verdict's audit
        // basis is gone — re-attest instead of stranding the claim pending
        // forever without dispatching the verifier. A verdict recorded
        // BEFORE fingerprints existed is likewise re-attested when a report
        // is available to judge it (review round 2 on #401).
        const fp = bindingAuditFingerprint(bindingReport, item.portalSlug);
        if (!lv.auditFp || !fp || fp !== lv.auditFp) return false;
      }
    }
    if (ledgerCurrent(claimId, ph) && !reverifySet.has(claimId)) return true;
    if (!ledger.verdicts[claimId]) {
      // Legacy path: no ledger record — trust baked-in non-PENDING verdicts.
      const embedded = item.verification?.verdict;
      if (embedded && embedded !== 'PENDING' && !reverifySet.has(claimId)) return true;
    }
    return false;
  };

  forEachCellClaim(cell, (kind, shape, item, cellId) => {
    const claimId = shape.id(item, cellId);
    const payload = shape.payload(item);
    const ph = payloadHash(payload);
    if (collectOnly) { claims.push({ claimId, payloadHash: ph }); return; }
    if (skipFor(item, claimId, ph)) return;
    staleOrNew(item, claimId, ph);
    claims.push({
      claimId,
      kind,
      verifier: KIND_VERIFIER[kind](item),
      payload,
      payloadHash: ph,
      ...ctx,
    });
  });
}

function verifierPriority(verifier) {
  // Lower = runs first
  const order = { 'rule-based': 0, 'internal-consistency': 1, websearch: 2, edgar: 3, pubmed: 4 };
  return order[verifier] !== undefined ? order[verifier] : 9;
}

// Cap the working set while keeping the retryable backlog in rotation.
// Fresh/changed claims keep their priority order; retryable (UNVERIFIABLE)
// claims rotate deterministically so a large backlog can't monopolize the
// --max cap with the same first-N every run. Two review fixes (#398):
// a retryable claim whose payload CHANGED is fresh work, not backlog; and
// the cursor advances by the admitted window per week, not by one slot.
// A quarter of the cap is reserved for the retry backlog so a full fresh
// queue can never starve it to zero (review round 3).
function capQueueWithRetryRotation(queue, ledger, max, verifierFilter, scopeSuffix) {
  // A zero budget means zero claims (review round 3, #398) — without this,
  // the reserved-slot math turns slice(0, -1) into "almost everything".
  if (max <= 0) return [];
  // Lane discipline: an explicit filter selects the verifiers this
  // invocation serves; NO filter is the documented FULL run and admits
  // everything (review round 11, #399) — including reverify-only runs, which
  // must never silently process nothing. The scheduled "general" pass in the
  // workflow carries its own explicit non-PubMed filter, so lane separation
  // lives in the caller, not in a hardcoded verifier name.
  const lane = verifierFilter && verifierFilter.length ? new Set(verifierFilter) : null;
  // Cursor scope (review round 11): narrowed invocations (--priority,
  // --reverify-ids) get their own persisted cursor instead of sharing the
  // full-lane one — otherwise a manual run would drag the scheduled window
  // past untried claims, and repeated narrowed runs would serve the same
  // first-N forever.
  const laneKey = (lane ? [...lane].sort().join('+') : 'full') + (scopeSuffix ? '|' + scopeSuffix : '');
  const inLane = (c) => (lane ? lane.has(c.verifier) : true);
  const rest = [];
  const retryable = [];
  for (const c of queue) {
    if (!inLane(c)) continue;
    const lv = ledger.verdicts && ledger.verdicts[c.claimId];
    const isRetry = !!(lv && lv.verdict === 'UNVERIFIABLE' && lv.ph === c.payloadHash);
    (isRetry ? retryable : rest).push(c);
  }
  const reservedForRetry = Math.min(retryable.length, Math.max(1, Math.floor(max / 4)));
  const restAdmitted = rest.slice(0, max - reservedForRetry);
  const retrySlots = Math.min(retryable.length, max - restAdmitted.length);

  // Persistent cursor, stored IN THE LEDGER (review on #399): the workflow
  // commits the ledger every run, so cursors survive between weekly
  // invocations. A recomputed offset modulo a list that shrinks as claims
  // resolve does NOT continue the previous window — it revisits failures
  // while skipping untried claims. A durable cursor tiles the backlog
  // regardless of turnover. Cursors are scoped per invocation
  // (lane + narrowing), so a manual --priority run rotates its own backlog
  // without touching the scheduled lane's window.
  retryable.sort((a, b) => (a.claimId < b.claimId ? -1 : a.claimId > b.claimId ? 1 : 0));
  let rotated = retryable;
  if (retryable.length > 1 && retrySlots > 0) {
    ledger.retryCursors = ledger.retryCursors || {};
    const cursorId = ledger.retryCursors[laneKey] && ledger.retryCursors[laneKey].lastClaimId;
    let startIdx = 0;
    if (cursorId) {
      const next = retryable.findIndex((c) => c.claimId > cursorId);
      startIdx = next === -1 ? 0 : next; // wrapped past the end → restart the cycle
    }
    rotated = retryable.slice(startIdx).concat(retryable.slice(0, startIdx));
    const served = rotated.slice(0, retrySlots);
    if (served.length) {
      ledger.retryCursors[laneKey] = {
        lastClaimId: served[served.length - 1].claimId,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  const retryAdmitted = rotated.slice(0, retrySlots);
  const admitted = restAdmitted.concat(retryAdmitted);
  // Spare capacity backfills from whichever lane has more work — continuing
  // PAST the admitted retry window so backfill never re-serves next week's
  // window early.
  let spare = max - admitted.length;
  if (spare > 0) {
    const seen = new Set(admitted.map((c) => c.claimId));
    for (const c of rest.slice(restAdmitted.length).concat(retryable.filter((c) => !seen.has(c.claimId)))) {
      if (spare <= 0) break;
      if (!seen.has(c.claimId)) { admitted.push(c); seen.add(c.claimId); spare--; }
    }
  }
  return admitted;
}

// ============================================================================
// DISPATCH
// ============================================================================

async function dispatch(claim, cube, bindingReport) {
  switch (claim.verifier) {
    case 'rule-based':
      return verifyRuleBased(claim, bindingReport);
    case 'internal-consistency':
      return verifyAffinity(claim, cube);
    case 'pubmed':
      return verifyPubMed(claim);
    case 'websearch':
      return verifyWebSearch(claim);
    case 'edgar':
      return verifyEdgar(claim);
    default:
      return {
        verdict: 'UNVERIFIABLE',
        verifier: claim.verifier,
        evidence: [],
        confidence: 0,
        checkedAt: new Date().toISOString(),
        note: `unknown verifier: ${claim.verifier}`,
      };
  }
}

// ============================================================================
// VERIFIERS
// ============================================================================

/**
 * Rule-based verifier — runs today without external APIs.
 *
 * For BINDINGS: checks (brainNodeId, role) consistency against
 * binding-fidelity-report.json which already audited this.
 *
 * EVIDENCE-INTEGRITY (audit 2026-10-16, item 1): a verdict of VERIFIED
 * requires audit COVERAGE, not merely the absence of flagged issues. A
 * missing report — or a portal absent from the report — means this binding
 * was never audited at all, so the correct verdict is UNVERIFIABLE
 * (retryable), not VERIFIED. Previously the missing-coverage path fell
 * through to VERIFIED, which is how 150 October 12 records were marked
 * verified with no supporting audit.
 */
function verifyRuleBased(claim, bindingReport) {
  if (claim.kind === 'binding') {
    const perPortal =
      bindingReport && typeof bindingReport.perPortal === 'object' && bindingReport.perPortal !== null
        ? bindingReport.perPortal
        : null;
    if (!perPortal || Object.keys(perPortal).length === 0) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'rule-based',
        evidence: [],
        confidence: 0,
        checkedAt: new Date().toISOString(),
        note: 'binding-fidelity report is missing — no audit coverage exists for any portal; retryable once the audit runs.',
      };
    }
    const pp = perPortal[claim.payload.portalSlug];
    if (!pp) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'rule-based',
        evidence: ['binding-fidelity-report:portal-not-covered'],
        confidence: 0,
        checkedAt: new Date().toISOString(),
        note: `Portal "${claim.payload.portalSlug}" is absent from the binding-fidelity report — this binding was never audited. Retryable once coverage includes it.`,
      };
    }
    // A failed audit is not a clean audit (review on #398): the fidelity
    // builder stores { error } with no issues array when the portal could
    // not be parsed. That entry means "audit did not complete", never "zero
    // issues". Note: ok:false alone means issues were FOUND (the scan
    // completed) — those portals flow through to the issue matching below.
    if (pp.error || !Array.isArray(pp.issues)) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'rule-based',
        evidence: [`binding-fidelity-report:audit-failed${pp.error ? ':' + String(pp.error).slice(0, 80) : ''}`],
        confidence: 0,
        checkedAt: new Date().toISOString(),
        note: `Binding-fidelity audit for portal "${claim.payload.portalSlug}" failed or produced no issue list — the audit did not complete, so no verdict can issue. Retryable once the audit succeeds.`,
      };
    }
    // Malformed members are audit failures too (review round 4, #401).
    if (pp.issues.some((i) => !i || typeof i !== 'object')) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'rule-based',
        evidence: ['binding-fidelity-report:malformed-issues'],
        confidence: 0,
        checkedAt: new Date().toISOString(),
        note: `Binding-fidelity audit for portal "${claim.payload.portalSlug}" contains malformed issue entries — retryable once the audit produces valid records.`,
      };
    }
    // Audit-input fingerprint (cold audit 2026-10-17): the verdict records
    // exactly which audit content it was computed from, so a REGENERATED
    // report with different findings can invalidate it even when the
    // claim's own five-field payload is unchanged.
    const auditFp = portalAuditFingerprint(pp);
    if (pp.issues.length === 0) {
      return {
        verdict: 'VERIFIED',
        verifier: 'rule-based',
        evidence: ['binding-fidelity-report:no-issues'],
        confidence: 0.7,
        checkedAt: new Date().toISOString(),
        auditFp,
        note: 'No issues in binding-fidelity audit for this portal.',
      };
    }
    // Deterministic selection among duplicate matches (review round 4,
    // #401): the fingerprint is order-independent, so selection must be
    // too — duplicates resolve by severity (highest first), then canonical
    // content order.
    const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };
    const matchedIssue = pp.issues
      .filter(
        (i) =>
          i.entityName === claim.payload.entityName &&
          i.relType === claim.payload.relationshipType
      )
      .sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) ||
          (stableStringify(a) < stableStringify(b) ? -1 : stableStringify(a) > stableStringify(b) ? 1 : 0)
      )[0];
    if (!matchedIssue) {
      return {
        verdict: 'VERIFIED',
        verifier: 'rule-based',
        evidence: ['binding-fidelity-report:passed'],
        confidence: 0.75,
        checkedAt: new Date().toISOString(),
        auditFp,
        note: 'Binding passed audit at fidelity-report time.',
      };
    }
    return {
      verdict: matchedIssue.severity === 'high' ? 'DISPUTED' : 'THEORETICAL',
      verifier: 'rule-based',
      evidence: [`binding-fidelity-report:${matchedIssue.kind}`],
      confidence: 0.6,
      checkedAt: new Date().toISOString(),
      auditFp,
      note: `Flagged by binding-fidelity-report: ${matchedIssue.kind}${matchedIssue.note ? ' — ' + matchedIssue.note : ''}`,
    };
  }
  return {
    verdict: 'PENDING',
    verifier: 'rule-based',
    evidence: [],
    confidence: 0,
    checkedAt: new Date().toISOString(),
    note: 'rule-based verifier not implemented for this kind',
  };
}

// Fingerprint of the audit content that can affect a portal's verdicts —
// outcome flag, error, and the issue list (entities, relations, kinds,
// severities). Any change here means the audit evidence changed, even if
// the audited claim payloads did not (cold audit 2026-10-17).
function portalAuditFingerprint(pp) {
  return payloadHash({
    ok: pp.ok ?? null,
    error: pp.error || null,
    // Normalize before mapping (review round 2 on #401): a truthy non-array
    // issues value must not crash the organ — it follows the same retryable
    // audit-failure path as any malformed report. Validity is PART of the
    // fingerprint (fix on #401): malformed evidence must invalidate a
    // cached clean verdict, not silently fingerprint-identical to [].
    // Members are guarded (round 4: [null] must not throw) and the records
    // are sorted before hashing (round 4: regenerating the SAME findings in
    // a different array order must not invalidate every cached binding for
    // the portal).
    issuesValid: Array.isArray(pp.issues),
    issues: (Array.isArray(pp.issues) ? pp.issues : []).map((i) => {
      const m = i && typeof i === 'object' ? i : {};
      return {
        // A null member must fingerprint differently from an empty-object
        // member (review round 4, #401): [null] is malformed audit output,
        // [{}] is a valid record with absent fields.
        memberValid: !!(i && typeof i === 'object'),
        entityName: m.entityName ?? null,
        relType: m.relType ?? null,
        kind: m.kind ?? null,
        severity: m.severity ?? null,
        // The note is embedded in the persisted verdict — it must invalidate
        // the fingerprint too (review round 3, #401).
        note: m.note ?? null,
      };
    }).sort((a, b) => stableStringify(a) < stableStringify(b) ? -1 : stableStringify(a) > stableStringify(b) ? 1 : 0),
  });
}

// Current audit fingerprint for a portal, or null when the portal is not
// covered / the report is absent — so callers can require the fingerprint
// a verdict was computed from (extraction, propagation, reconciliation).
function bindingAuditFingerprint(bindingReport, portalSlug) {
  const perPortal =
    bindingReport && typeof bindingReport.perPortal === 'object' && bindingReport.perPortal !== null
      ? bindingReport.perPortal
      : null;
  const pp = perPortal && perPortal[portalSlug];
  return pp ? portalAuditFingerprint(pp) : null;
}

/**
 * Affinity verifier — checks reciprocal edge exists in target domain.
 */
function verifyAffinity(claim, cube) {
  const { toDomain, toRole } = claim.payload;
  const reciprocalCellId = `${claim.brainNodeId}__${claim.stateBucket}__${toDomain}`;
  const target = cube.cells.find((c) => c.cellId === reciprocalCellId);
  if (!target) {
    return {
      verdict: 'DISPUTED',
      verifier: 'internal-consistency',
      evidence: [`no-target-cell:${reciprocalCellId}`],
      confidence: 0.6,
      checkedAt: new Date().toISOString(),
      note: 'Target cell does not exist in cube — affinity edge has no reciprocal.',
    };
  }
  const reciprocalExists = (target.crossDomainAffinities || []).some(
    (a) => a.toDomain === claim.comparisonDomain
  );
  return {
    verdict: reciprocalExists ? 'VERIFIED' : 'THEORETICAL',
    verifier: 'internal-consistency',
    evidence: [`target-cell:${reciprocalCellId}`],
    confidence: 0.65,
    checkedAt: new Date().toISOString(),
    note: reciprocalExists
      ? 'Reciprocal edge present in target cell.'
      : 'Target cell exists but no reciprocal affinity — one-way mapping.',
  };
}

/**
 * PubMed verifier — TIGHTENED 2026-05-31 after spot-check found
 * loose-query false positives.
 *
 * Three layers, each mandatory:
 *   1. Tightened esearch query — phrase quoting + [Title/Abstract] field
 *      restriction + co-occurrence with disorder name(s) OR node region.
 *      Query-level matching alone is permissive even tightened — the OR
 *      block on broad terms ("fear", "anxiety") still admits noise.
 *   2. efetch of TOP result's abstract — the only verification step that
 *      actually reads the article rather than trusting esearch's token
 *      match. Not optional. Loose-query failure caught here would
 *      otherwise badge a cystic-fibrosis paper as evidence for exposure
 *      therapy.
 *   3. Substring + proximity check on title+abstract for the claim's key
 *      phrase. PASS if the phrase appears literally OR all content tokens
 *      appear within an 80-character window. UNVERIFIABLE otherwise.
 *
 * Verdict semantics under tightening (CORRECTED 2026-10-16, audit item 4):
 *   VERIFIED     — esearch hit ≥ 1 article AND top abstract passes substring
 *                  AND the abstract carries no explicit negative-result
 *                  language (a citation that says "did not improve" is
 *                  contradiction evidence, not support)
 *   DISPUTED     — the top abstract names the claim but reports a negative
 *                  result; contradiction is scoped to that citation — a
 *                  single study disputes support, it does not refute the claim
 *   UNVERIFIABLE — esearch returned 0 articles (absence of evidence is NOT
 *                  evidence of absence; zero hits means we could not examine
 *                  the claim, so it belongs to UNKNOWN, never IMPOSSIBLE),
 *                  or esearch hit but the abstract substring check failed
 */
async function verifyPubMed(claim) {
  const query = buildPubMedQuery(claim);
  if (!query) {
    return {
      verdict: 'UNVERIFIABLE',
      verifier: 'pubmed',
      evidence: [],
      confidence: 0,
      checkedAt: new Date().toISOString(),
      note: 'no PubMed query producible from this claim',
    };
  }
  try {
    const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=3&retmode=json&sort=relevance${
      PUBMED_API_KEY ? `&api_key=${PUBMED_API_KEY}` : ''
    }`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`PubMed esearch ${res.status}`);
    const data = await res.json();
    const ids = data.esearchresult?.idlist || [];
    if (ids.length === 0) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'pubmed',
        evidence: [`query:${query}`],
        confidence: 0.2,
        checkedAt: new Date().toISOString(),
        note: 'PubMed returned 0 articles for the tightened query — the claim could not be examined, so it stays UNKNOWN/retryable. Zero hits is not a contradiction: the citation may be mis-cited, the protocol renamed, or the query too tight.',
      };
    }

    // MANDATORY: fetch top result's title + abstract and substring-check
    // the claim's key phrase against them. This is the only step that
    // reads the article rather than trusting esearch's token AND.
    const topPmid = ids[0];
    let abstractText = '';
    try {
      const efetchUrl = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${topPmid}&rettype=abstract&retmode=text${
        PUBMED_API_KEY ? `&api_key=${PUBMED_API_KEY}` : ''
      }`;
      // Pace efetch separately — counts toward the rate budget
      await sleep(1000 / PUBMED_RATE_PER_SEC);
      const efetchRes = await fetch(efetchUrl);
      abstractText = await efetchRes.text();
    } catch (err) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'pubmed',
        evidence: ids.map((id) => `pubmed:${id}`),
        confidence: 0.2,
        checkedAt: new Date().toISOString(),
        note: `esearch returned articles but efetch failed for abstract substring check: ${err.message}`,
      };
    }

    const keyPhrase = claimKeyPhrase(claim);
    const passes = checkPhraseInText(keyPhrase, abstractText);

    if (!passes) {
      return {
        verdict: 'UNVERIFIABLE',
        verifier: 'pubmed',
        evidence: [`top-pmid:${topPmid}`, `query:${query}`],
        confidence: 0.3,
        checkedAt: new Date().toISOString(),
        note: `esearch returned ${ids.length} article(s) but top PMID ${topPmid}'s title+abstract does not contain claim phrase "${keyPhrase}" (literal or token-proximate). Loose-query match. Article: ${extractTitle(abstractText).substring(0, 140)}`,
      };
    }

    if (abstractContradicts(abstractText, keyPhrase)) {
      return {
        verdict: 'DISPUTED',
        verifier: 'pubmed',
        evidence: [`top-pmid:${topPmid}`, `query:${query}`],
        confidence: 0.5,
        checkedAt: new Date().toISOString(),
        note: `Top PMID ${topPmid} names claim phrase "${keyPhrase}" but reports a negative result — this citation contradicts support for the claim as stated. Single-study contradiction scoped to this citation; the underlying claim is disputed, not refuted. Title: ${extractTitle(abstractText).substring(0, 120)}`,
      };
    }

    return {
      verdict: 'VERIFIED',
      verifier: 'pubmed',
      evidence: ids.map((id) => `pubmed:${id}`),
      confidence: 0.8,
      checkedAt: new Date().toISOString(),
      note: `Top PMID ${topPmid}'s abstract contains claim phrase "${keyPhrase}". Title: ${extractTitle(abstractText).substring(0, 120)}`,
    };
  } catch (err) {
    return {
      verdict: 'UNVERIFIABLE',
      verifier: 'pubmed',
      evidence: [],
      confidence: 0,
      checkedAt: new Date().toISOString(),
      note: `PubMed query failed: ${err.message}`,
    };
  }
}

/**
 * Tightened query builder. Phrase-quotes multi-word treatments, restricts
 * to [Title/Abstract] field, AND's against co-occurrence terms drawn from
 * the cell context (disorder names + node region).
 */
function buildPubMedQuery(claim) {
  const cooccur = cooccurrenceTerms(claim);
  const cooccurClause = cooccur.length
    ? ` AND (${cooccur.map((t) => `${phraseFieldRestrict(t)}`).join(' OR ')})`
    : '';

  if (claim.kind === 'disorder') {
    const dName = phraseFieldRestrict(claim.payload.name);
    return `${dName}${cooccurClause || ` AND (${phraseFieldRestrict(claim.brainNodeId)})`}`;
  }
  if (claim.kind === 'neuro-treatment') {
    const tName = phraseFieldRestrict(stripParenthetical(claim.payload.name));
    return `${tName}${cooccurClause}`;
  }
  if (claim.kind === 'residual' && claim.payload.direction === 'DOMAIN_TO_NEURO') {
    // DOMAIN_TO_NEURO residuals carry a business / non-neuro treatment name —
    // querying PubMed for them directly is structurally wrong (PubMed is
    // biomedical). These should route to WebSearch. Returning null here so
    // the verifier dispatches to UNVERIFIABLE with a note explaining the
    // routing gap until WebSearch verifier is wired.
    return null;
  }
  return null;
}

function phraseFieldRestrict(text) {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 1) return `${cleaned}[Title/Abstract]`;
  return `"${cleaned}"[Title/Abstract]`;
}

function stripParenthetical(s) {
  return String(s || '').replace(/\([^)]*\)/g, '').trim();
}

/**
 * Co-occurrence terms drawn from the cell context:
 *   - disorder names from the same cell (PTSD, anxiety disorders, phobias)
 *   - node region terms (amygdala, basolateral amygdala, BLA abbreviation)
 *
 * This is what makes the query specific to the (node, state) combo
 * rather than fishing for the treatment name anywhere in PubMed.
 */
function cooccurrenceTerms(claim) {
  const terms = new Set();

  // Disorder names from the cell
  for (const dName of claim.cellDisorderNames || []) {
    if (dName) terms.add(dName);
  }

  // Node region terms — the canonical region name plus abbreviation
  if (claim.cellNodeRegion) {
    // Strip parentheticals: "Basolateral Amygdala (BLA)" → "Basolateral Amygdala" + "BLA"
    const region = claim.cellNodeRegion;
    const stripped = stripParenthetical(region);
    if (stripped) terms.add(stripped);
    // Also extract just the substantive noun if the region is multi-word
    const parts = stripped.split(/\s+/);
    if (parts.length > 1 && parts[parts.length - 1].length > 4) {
      terms.add(parts[parts.length - 1]); // e.g. "Amygdala" from "Basolateral Amygdala"
    }
  }
  if (claim.brainNodeId) terms.add(claim.brainNodeId);

  return [...terms];
}

/**
 * The key phrase for the abstract substring check — the specific
 * intervention / disorder name the claim asserts. The abstract MUST
 * contain this phrase (literal or token-proximate) or the article is
 * not actually about the claim.
 */
function claimKeyPhrase(claim) {
  if (claim.kind === 'disorder') return claim.payload.name;
  if (claim.kind === 'neuro-treatment') return stripParenthetical(claim.payload.name);
  if (claim.kind === 'residual') return stripParenthetical(claim.payload.sourceTreatmentName || '');
  return '';
}

/**
 * Substring + proximity check. The phrase passes if:
 *   (a) it appears as a literal substring in the text (case-insensitive,
 *       basic punctuation normalized), OR
 *   (b) all of its content tokens (length ≥ 4) appear within an
 *       80-character window of each other.
 *
 * Single-word phrases reduce to substring-of-token. Multi-word phrases
 * with very common tokens still benefit from (a) — a paper that uses
 * the exact phrase passes; one that just has scattered occurrences of
 * the constituent tokens does not.
 */
function checkPhraseInText(phrase, text) {
  if (!phrase || !text) return false;
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
  const p = phrase.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!p) return false;
  // (a) literal substring
  if (t.includes(p)) return true;
  // (b) proximity check for multi-word
  const tokens = p.split(/\s+/).filter((tok) => tok.length >= 4);
  if (tokens.length === 0) {
    // Phrase content was all short tokens (e.g. "DBT", "TMS") — strict literal only
    return false;
  }
  if (tokens.length === 1) {
    // Single content token — already handled by literal substring
    return false;
  }
  // For each occurrence of the first token, check whether all others appear
  // within 80 chars
  const WINDOW = 80;
  let idx = -1;
  const first = tokens[0];
  while ((idx = t.indexOf(first, idx + 1)) !== -1) {
    const slice = t.substring(idx, idx + first.length + WINDOW);
    if (tokens.slice(1).every((tok) => slice.includes(tok))) return true;
  }
  return false;
}

/**
 * Negation guard (audit 2026-10-16, item 4b). checkPhraseInText proves the
 * abstract is ABOUT the claim; it says nothing about the direction of the
 * result. An abstract reading "X did not improve outcomes" passed the phrase
 * check verbatim and was stamped VERIFIED. This helper detects explicit
 * negative-result language so a contradictory citation is treated as
 * contradiction evidence (DISPUTED, scoped to that citation) instead of
 * support. Deliberately conservative: only unambiguous failure phrases count,
 * and only when the claim phrase itself is present in the text.
 */
const NEGATION_PATTERNS = [
  'did not improve', 'does not improve', 'do not improve',
  'failed to improve', 'failed to show', 'failed to demonstrate',
  'no significant improvement', 'no significant difference', 'no significant effect',
  'no improvement', 'no effect', 'no benefit',
  'not effective', 'not superior', 'did not reduce',
  'not associated with improvement', 'no evidence of benefit',
];

function abstractContradicts(text, keyPhrase) {
  if (!text || !keyPhrase) return false;
  if (!checkPhraseInText(keyPhrase, text)) return false;
  // Scope the negation to the claim (review on #398): a negative phrase only
  // contradicts when it lives in the same sentence as the claim's content
  // tokens — an abstract can report "no effect" for an unrelated arm without
  // contradicting the claim under test.
  const tokens = keyPhrase
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 4);
  // Clause-level scoping (post-merge replay on #398): semicolons and colons
  // separate clauses just like sentence stops — "...improved symptoms; there
  // was no significant difference in dropout rates" must NOT dispute,
  // because the null result belongs to a different outcome in a different
  // clause. BUT a clause can also CONTINUE the claim by coreference
  // (review on #399): "…was tested; it did not improve outcomes" or
  // "…was clear: no significant improvement was observed" — so a negation
  // clause that never names the claim still disputes when it carries a
  // coreferential pronoun or passive result marker and an earlier clause
  // named the claim. Residual limitation, honestly noted: outcome-typed
  // checking ("which outcome was null?") is a model task, not a regex one.
  // A coreferential continuation may open with a discourse marker
  // ("however, it did not improve outcomes") — the pronoun still belongs to
  // the claim (cold audit 2026-10-17). Passive-result markers are NOT
  // enough on their own: "sertraline showed no benefit, which was observed
  // in controls" would misattribute sertraline's result to the claim, so
  // carry-over requires an anchored pronoun OR a directional failure at
  // clause start (optionally behind a contextual adjunct like "in this
  // study"). Demonstrative determiners are not pronouns (review on #401):
  // "however, this study found no benefit of sertraline" — "this" owns a
  // noun, not the claim.
  const DISCOURSE = '(?:however|but|and|yet|still|though|although|overall|interestingly|notably|unfortunately|surprisingly|sadly)';
  // Contextual adjuncts are recognized generically (review round 5, #401):
  // "in this study", "in our study", "in the trial", "in those analyses" —
  // any demonstrative/possessive + noun, not just a fixed list.
  const ADJUNCT = '(?:in (?:this|that|our|the|these|those) [a-z]+(?: [a-z]+)?|' + DISCOURSE + ')';
  const COREF_START = new RegExp('^\\s*(?:' + DISCOURSE + '\\s+)?(it|this|these|they|the treatment|the intervention|the therapy|the approach|the result|the results)\\b');
  // Equivalence phrases ("no significant difference", "not superior") compare
  // arms — they are not a directional failure of the claim itself, so they
  // can only contradict when the claim is named in the SAME clause. They are
  // excluded from carry-over mode (review on #399).
  const CARRYOVER_NEGATIONS = [
    'did not improve', 'does not improve', 'do not improve',
    'failed to improve', 'failed to show', 'failed to demonstrate',
    'no improvement', 'no significant improvement', 'no significant effect', 'no significant benefit',
    'no benefit', 'not effective',
    'did not reduce', 'no evidence of benefit',
  ];
  // Text normalization before clause parsing (review rounds on #399):
  //  - abbreviation chains (U.S., e.g., i.e.) lose internal periods; when a
  //    chain ends a sentence (capitalized next word that is NOT a known
  //    institutional adjunct like Department or National) the trailing
  //    period is kept as the terminator — "U.S. Department" stays one
  //    clause, "in the U.S. Sertraline did not…" still splits;
  //  - common titles (Dr., etc., et al.) strip unconditionally;
  //  - soft line wraps (a newline NOT preceded by sentence punctuation)
  //    join with a space — efetch plain text wraps sentences arbitrarily
  //    and a wrap is not a boundary;
  //  - the clause splitter treats digit-period-digit (0.2) and
  //    digit-colon-digit (1:1) as numbers, not terminators.
  // Coreference carries across ; and : but resets at real sentence ends.
  const NOUN_ADJUNCTS = new Set([
    'department', 'agency', 'institute', 'national', 'university', 'center', 'centre',
    'health', 'service', 'services', 'administration', 'foundation', 'college',
    'hospital', 'clinic', 'group', 'program', 'programme', 'association',
    'society', 'committee', 'board', 'office', 'bureau', 'laboratory',
    'laboratories', 'academy', 'council',
  ]);
  const clean = String(text)
    // An abbreviation chain followed by a capitalized word: continuation if
    // the word is an institutional adjunct whose OWN following word keeps
    // the name going (another capital, or a connector like "and"/"of") —
    // "the U.S. Department and did not improve…" stays one clause; a new
    // subject after the adjunct ("U.S. National surveys found…") or any
    // non-adjunct capital ("U.S. Sertraline…") keeps the boundary.
    .replace(/\b(?:[A-Za-z]\.){2,}(?=\s+([A-Z][A-Za-z]*)\s*([A-Za-z]*))/g, (m, next, after) => {
      const adjunct = NOUN_ADJUNCTS.has(next.toLowerCase());
      const continues = adjunct &&
        (/^[A-Z]/.test(after) ||
          /^(and|but|or|nor|which|that|who|whom|whose|where|when|of|for|to|in|on|at|by|with|from|as)$/i.test(after));
      return continues ? m.replace(/\./g, '') : m.replace(/\./g, '') + '.';
    })
    .replace(/\b(?:[A-Za-z]\.){2,}/g, (m) => m.replace(/\./g, ''))
    .replace(/\b(etc|vs|cf|Dr|Drs|Mr|Mrs|Ms|St|Jr|Sr|al)\./gi, '$1')
    .replace(/([^.!?;:\n])\s*\n+\s*/g, '$1 ');
  let claimSeenInSentence = false;
  const clauses = clean.match(/(?:[^.!?;:\n]|\.(?=\d)|:(?=\d))+(?:[.!?;:](?!\d)|$)/g) || [];
  for (const s of clauses) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const n = ` ${trimmed.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
    const mentionsClaim = tokens.length
      ? tokens.every((tok) => n.includes(tok))
      : n.includes(keyPhrase.toLowerCase());
    const hasNegation = NEGATION_PATTERNS.some((p) => n.includes(` ${p} `));
    if (hasNegation && mentionsClaim) return true;
    // Carry-over: the clause never names the claim, so it continues the
    // claim only when it clearly belongs to it (review rounds on #399,
    // cold audit 2026-10-17): it STARTS with a coreference marker
    // (discourse adverbs allowed), OR it starts with the directional
    // failure itself ("…was assessed: no improvement occurred") — and in
    // every case the failure phrase must be directional, never an arm
    // comparison and never a mid-clause passive attached to another
    // subject.
    const startsDirectional = CARRYOVER_NEGATIONS.some((p) =>
      n.startsWith(` ${p}`) || new RegExp(`^ ${ADJUNCT} ${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `).test(n));
    // A directional failure owned by another named subject is not the
    // claim's result (review rounds on #401): "no benefit of sertraline
    // A directional failure owned by another named subject is not the
    // claim's result (review rounds on #401): "no benefit of sertraline
    // emerged", "no improvement in the sertraline group emerged", and
    // postposed ownership ("no benefit emerged for sertraline") all
    // attribute nothing to the claim under test.
    const GENERIC_OWNER = new Set(['symptoms', 'symptom', 'outcomes', 'outcome', 'measures', 'measure', 'endpoints', 'endpoint', 'patients', 'patient', 'subjects', 'subject', 'participants', 'benefit', 'improvement', 'response', 'this', 'that', 'these', 'those', 'study', 'trial', 'analysis', 'cohort', 'rate', 'rates', 'levels', 'level', 'score', 'scores', 'quality', 'life', 'pain', 'function', 'mood', 'sleep', 'anxiety', 'depression', 'energy', 'cognition', 'memory', 'attention', 'weight', 'appetite', 'libido']);
    const ownerOf = (word) =>
      !!word && !GENERIC_OWNER.has(word) && !tokens.includes(word);
    // Ownership requires a treatment/group construction (review round 5,
    // #401): a bare noun after "in" ("no improvement in quality of life")
    // is an outcome, not an owner — "in" only counts with a group/arm/
    // cohort suffix; of/with/for/from keep bare treatment names.
    const ownerMatch = n.match(/\b(?:no benefit|no improvement|no significant improvement|no significant effect|no significant benefit|no effect|not effective|no evidence of benefit) (?:of|with|for|from) (?:the )?([a-z][a-z-]*)(?: group| arm| cohort)?\b/) ||
      n.match(/\b(?:no benefit|no improvement|no significant improvement|no significant effect|no significant benefit|no effect|not effective|no evidence of benefit) in (?:the )?([a-z][a-z-]*) (?:group|arm|cohort)\b/) ||
      n.match(/\b(?:emerged|occurred|appeared|emerge|occurs|appears|was observed|was found|was seen|was reported) (?:of|for|from|with) (?:the )?([a-z][a-z-]*)(?: group| arm| cohort)?\b/) ||
      n.match(/\b(?:emerged|occurred|appeared|emerge|occurs|appears) in (?:the )?([a-z][a-z-]*) (?:group|arm|cohort)\b/);
    const ownedByOther = !!(ownerMatch && ownerOf(ownerMatch[1]));
    // Coreference gates (review rounds on #401):
    //  - the demonstrative exclusion applies only to the OPENING referent —
    //   "it did not improve outcomes in this study" is still coreference;
    //   "this study found no benefit of sertraline" is not.
    //  - expletive "it" is not coreference: "it was found that sertraline
    //   did not improve outcomes" — a named subject owns the result.
    let coref = false;
    const opening = n.match(COREF_START);
    if (opening) {
      const referent = opening[1];
      const after = n.slice(n.indexOf(referent));
      const demonstrative = /^(this|these) (study|studies|trial|trials|analysis|analyses|cohort|group|groups|arm|arms|investigation|investigations|experiment|experiments|review|reviews|paper|papers|report|reports|meta-analysis)\b/.test(after.trim());
      // Researcher "they" is not coreference (review round 5, #401): "they
      // found/reported/noted that sertraline did not improve" — the
      // pronoun belongs to the investigators.
      const researcherThey = /^they (found|observed|reported|noted|demonstrated|showed|concluded|determined|saw|measured|assessed|evaluated)\b/.test(after.trim());
      // Expletive "it" is not coreference ONLY when another subject owns
      // the result (fix on #401): "it was found that sertraline did not
      // improve" and "it appears that sertraline did not improve" reject —
      // but "it was found that the treatment did not improve" is an
      // explicit reference back to the claim and must dispute.
      const expletiveMatch = after.trim().match(/^(it|this) (?:was|is|were|appears|appeared|seems|seemed|is possible|is likely|is unlikely|may be|might be|could be)(?: (?:found|shown|observed|reported|noted|demonstrated|seen|clear|evident|apparent))? that\s+(.*)$/);
      const refersBackToClaim = expletiveMatch
        ? /^(the treatment|the intervention|the therapy|the approach)\b/.test(expletiveMatch[2])
        : false;
      const expletive = !!expletiveMatch && !refersBackToClaim;
      coref = !demonstrative && !expletive && !researcherThey;
    }
    if (!mentionsClaim && claimSeenInSentence && (coref || (startsDirectional && !ownedByOther))
        && CARRYOVER_NEGATIONS.some((p) => n.includes(` ${p} `))) return true;
    if (mentionsClaim) claimSeenInSentence = true;
    if (/[.!?]$/.test(trimmed)) claimSeenInSentence = false;
  }
  return false;
}

function extractTitle(abstractText) {
  // efetch text format: first non-author non-DOI line is usually the title
  const lines = String(abstractText).split('\n').map((l) => l.trim()).filter(Boolean);
  // The structure is: "N. Journal..."  /  "doi: ..."  /  "TITLE"  /  author block
  // Find the line after the doi line
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].toLowerCase().startsWith('doi:') || lines[i].includes('. doi:')) {
      return lines[i + 1];
    }
  }
  // Fallback: just grab the longest line in the first 6
  let best = '';
  for (const l of lines.slice(0, 6)) {
    if (l.length > best.length && !/author information/i.test(l)) best = l;
  }
  return best;
}

/**
 * WebSearch verifier — STUB.
 *
 * Real implementation should use Bing / Google Custom Search / DuckDuckGo
 * to query "does this intervention exist by this name." For first pass,
 * marks PENDING with a TODO note so claims remain queued for later.
 */
async function verifyWebSearch(claim) {
  return {
    verdict: 'PENDING',
    verifier: 'websearch',
    evidence: [],
    confidence: 0,
    checkedAt: new Date().toISOString(),
    note: 'WebSearch verifier not yet wired. Queue: enable when Bing/Google CSE API key is in env.',
  };
}

/**
 * EDGAR verifier — STUB.
 *
 * Real implementation queries SEC EDGAR REST API to confirm a filing
 * exists and contains the claimed text/figure. For first pass: queues.
 */
async function verifyEdgar(claim) {
  return {
    verdict: 'PENDING',
    verifier: 'edgar',
    evidence: [],
    confidence: 0,
    checkedAt: new Date().toISOString(),
    note: 'EDGAR verifier not yet wired. Existing limen-helix-api/limen_v4_kernel.js already ingests EDGAR; this verifier should reuse that pathway when budget allows.',
  };
}

// ============================================================================
// PROPAGATE TO CUBE
// ============================================================================

function propagateVerdictsToCube(cube, ledger, bindingReport = null) {
  let count = 0;
  let staleCount = 0;
  for (const cell of cube.cells) {
    forEachCellClaim(cell, (kind, shape, item, cellId) => {
      const cid = shape.id(item, cellId);
      const lv = ledger.verdicts[cid];
      if (!lv) return;
      // APPLICABILITY (audit 2026-10-16, item 2): a verdict covers only the
      // exact payload it was computed from. A source edit under a preserved
      // id flips the hash, and the old verdict must NOT display on changed
      // content — a claim awaiting re-verification is shown as such, with
      // the prior verdict referenced but not presented as current truth.
      // The stale reason is recorded honestly (review round 7, #399;
      // audit-input changes added in the 2026-10-17 cold audit):
      // "payload-changed", "verifier-version" and "audit-input-changed" are
      // different causes and the audit trail must not report one as another.
      const phMatch = lv.ph && lv.ph === payloadHash(shape.payload(item));
      // The fingerprint requirement applies to TERMINAL verdicts (review
      // round 3, #401): a fresh UNVERIFIABLE from missing coverage has no
      // auditFp by design and must be preserved as-is, not rewritten stale.
      const auditOk = !cid.startsWith('bind::') || lv.verdict === 'UNVERIFIABLE' ||
        (bindingReport
          ? !!(lv.auditFp && bindingAuditFingerprint(bindingReport, item.portalSlug) === lv.auditFp)
          : true);
      if (phMatch && verdictAccepted(lv) && auditOk) {
        item.verification = lv;
        count++;
      } else {
        const staleReason = !phMatch ? 'payload-changed'
          : (!verdictAccepted(lv) ? 'verifier-version' : 'audit-input-changed');
        item.verification = {
          verdict: 'PENDING',
          verifier: lv.verifier || 'unknown',
          evidence: [],
          confidence: 0,
          checkedAt: null,
          stale: true,
          staleReason,
          previousVerdict: lv.verdict,
          previousCheckedAt: lv.checkedAt || null,
          note: staleReason === 'verifier-version'
            ? 'Ledger verdict predates the current verifier rules — awaiting re-verification under repaired semantics. The prior verdict is preserved in the ledger but not presented as current.'
            : staleReason === 'audit-input-changed'
              ? 'The binding-fidelity audit was regenerated with different findings for this portal — the verdict recorded older audit evidence and is awaiting re-attestation. The prior verdict is preserved in the ledger but not presented as current.'
              : 'Payload changed since the ledger verdict was computed — awaiting re-verification. The prior verdict is preserved in the ledger but not presented as current.',
        };
        staleCount++;
      }
    });
    // Recompute aggregate
    cell.verification = recomputeAggregate(cell);
  }
  if (staleCount) {
    console.log(`[verification-organ] ${staleCount} occurrence(s) held stale verdicts (payload changed) — marked PENDING for re-verification`);
  }
  return count;
}

function recomputeAggregate(cell) {
  const tally = { VERIFIED: 0, DISPUTED: 0, THEORETICAL: 0, UNVERIFIABLE: 0, FABRICATED: 0, PENDING: 0 };
  const verifiers = new Set();
  let lastChecked = null;
  const walk = (item) => {
    const v = item?.verification;
    if (!v) return;
    if (tally[v.verdict] !== undefined) tally[v.verdict]++;
    if (v.verifier) verifiers.add(v.verifier);
    if (v.checkedAt && (!lastChecked || v.checkedAt > lastChecked)) lastChecked = v.checkedAt;
  };
  (cell.issues || []).forEach(walk);
  (cell.disorders || []).forEach(walk);
  (cell.neuroTreatments || []).forEach(walk);
  (cell.domainTreatments || []).forEach(walk);
  (cell.residuals || []).forEach(walk);
  (cell.portalBindings || []).forEach(walk);
  (cell.crossDomainAffinities || []).forEach(walk);

  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  return {
    verifiedClaimCount: tally.VERIFIED,
    disputedClaimCount: tally.DISPUTED,
    theoreticalClaimCount: tally.THEORETICAL,
    unverifiableClaimCount: tally.UNVERIFIABLE,
    fabricatedClaimCount: tally.FABRICATED,
    pendingClaimCount: tally.PENDING,
    percentVerified: total ? tally.VERIFIED / total : 0,
    lastVerifiedAt: lastChecked,
    verifiers: Array.from(verifiers),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function safeReadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const IS_CLI = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_CLI) {
  main().catch((err) => {
    console.error('[verification-organ] FAILED:', err.stack || err);
    process.exit(1);
  });
}

// Exported for the evidence-integrity test suite (scripts/test-evidence-integrity.js).
// The CLI behavior above is unchanged; importing this module does not run main().
export {
  verifyRuleBased,
  verifyPubMed,
  checkPhraseInText,
  abstractContradicts,
  claimKeyPhrase,
  payloadHash,
  stableStringify,
  propagateVerdictsToCube,
  reconcilePopulation,
  extractCellClaims,
  recomputeAggregate,
  recordVerdict,
  capQueueWithRetryRotation,
  forEachCellClaim,
  CLAIM_SHAPES,
  VERIFIER_VERSION,
  portalAuditFingerprint,
  bindingAuditFingerprint,
};
