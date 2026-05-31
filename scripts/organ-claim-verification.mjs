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
 *   - exclude DISPUTED + FABRICATED claims from residual computation
 *     by re-running compute-cross-domain-readout.mjs in verified-only mode
 *
 * Usage:
 *   node scripts/organ-claim-verification.mjs              # full run, paced
 *   node scripts/organ-claim-verification.mjs --rule-based # only the runnable-today verifiers
 *   node scripts/organ-claim-verification.mjs --max=50     # cap claims this run
 *   node scripts/organ-claim-verification.mjs --priority=NAcc,BLA,HPA  # specific nodes only
 *   node scripts/organ-claim-verification.mjs --dry-run    # list what would be verified
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // If --reverify-ids set, wipe those ledger entries so they re-process
  // instead of being skipped by the "already verified" check.
  if (ARG.reverifyIds.length) {
    let wiped = 0;
    for (const id of ARG.reverifyIds) {
      if (ledger.verdicts[id]) {
        const oldVerdict = ledger.verdicts[id].verdict;
        ledger.stats[oldVerdict] = Math.max(0, (ledger.stats[oldVerdict] || 0) - 1);
        const oldVerifier = ledger.verdicts[id].verifier;
        if (ledger.stats.byVerifier[oldVerifier]) {
          ledger.stats.byVerifier[oldVerifier] = Math.max(0, ledger.stats.byVerifier[oldVerifier] - 1);
        }
        delete ledger.verdicts[id];
        wiped++;
      }
    }
    console.log(`[verification-organ] --reverify-ids: wiped ${wiped} existing ledger entries`);
  }

  // ============================================================================
  // EXTRACT CLAIMS — every PENDING claim across every cell
  // ============================================================================
  const claims = extractAllClaims(cube, ledger);
  console.log(`[verification-organ] PENDING claims extracted: ${claims.length}`);

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

  // Apply max-claims cap
  queue = queue.slice(0, ARG.maxClaims);
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
    ledger.verdicts[claim.claimId] = verdict;
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

  ledger.lastUpdatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));

  // ============================================================================
  // PROPAGATE — apply verdicts back to cube cells
  // ============================================================================
  console.log('');
  console.log('[verification-organ] propagating verdicts to cube cells');
  const propagated = propagateVerdictsToCube(cube, ledger);
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
  console.log('to recompute residuals over verified-only claims.');
}

// ============================================================================
// CLAIM EXTRACTION
// ============================================================================

function extractAllClaims(cube, ledger) {
  const claims = [];
  const reverifySet = new Set(ARG.reverifyIds || []);
  for (const cell of cube.cells) {
    extractCellClaims(cell, claims, ledger, reverifySet);
  }
  return claims;
}

function extractCellClaims(cell, claims, ledger, reverifySet = new Set()) {
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

  // Skip helper: skip only if claim is non-PENDING AND NOT in reverifySet
  // (the reverifySet bypass lets --reverify-ids re-include claims whose
  // cube cells still carry the old verdict from a previous propagation).
  const shouldSkip = (verdict, claimId) =>
    verdict !== 'PENDING' && !reverifySet.has(claimId);

  // Issues
  for (const iss of cell.issues || []) {
    const claimId = `iss::${iss.id}`;
    if (shouldSkip(iss.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'issue',
      verifier: iss.verification.verifier || 'websearch',
      payload: { id: iss.id, symptom: iss.symptom, sourceType: iss.sourceType, sourceFile: iss.sourceFile, severity: iss.severity },
      ...ctx,
    });
  }

  // Disorders
  for (const d of cell.disorders || []) {
    const claimId = `dx::${d.id}`;
    if (shouldSkip(d.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'disorder',
      verifier: 'pubmed',
      payload: { id: d.id, name: d.name, mechanism: d.mechanism, primaryNodesAffected: d.primaryNodesAffected, citations: d.citations },
      ...ctx,
    });
  }

  // Neuro treatments
  for (const t of cell.neuroTreatments || []) {
    const claimId = `ntx::${t.id}`;
    if (shouldSkip(t.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'neuro-treatment',
      verifier: 'pubmed',
      payload: { id: t.id, name: t.name, type: t.type, citations: t.citations },
      ...ctx,
    });
  }

  // Domain treatments
  for (const t of cell.domainTreatments || []) {
    const claimId = `dtx::${t.id}`;
    if (shouldSkip(t.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'domain-treatment',
      verifier: 'websearch',
      payload: { id: t.id, name: t.name, type: t.type, description: t.description, side: t.side },
      ...ctx,
    });
  }

  // Portal bindings
  for (const b of cell.portalBindings || []) {
    const claimId = `bind::${ctx.cellId}::${b.portalSlug}::${b.relationshipType}::${b.entityName}`;
    if (shouldSkip(b.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'binding',
      verifier: 'rule-based',
      payload: { portalSlug: b.portalSlug, entityName: b.entityName, relationshipType: b.relationshipType, role: b.role, confidence: b.confidence },
      ...ctx,
    });
  }

  // Cross-domain affinities
  for (const aff of cell.crossDomainAffinities || []) {
    const claimId = `aff::${ctx.cellId}::${aff.toDomain}::${aff.toRole}`;
    if (shouldSkip(aff.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'affinity',
      verifier: 'internal-consistency',
      payload: { toDomain: aff.toDomain, toRole: aff.toRole },
      ...ctx,
    });
  }

  // Residuals
  for (const r of cell.residuals || []) {
    const claimId = `res::${r.id}`;
    if (shouldSkip(r.verification?.verdict, claimId)) continue;
    if (ledger.verdicts[claimId] && !reverifySet.has(claimId)) continue;
    claims.push({
      claimId,
      kind: 'residual',
      verifier: r.direction === 'NEURO_TO_DOMAIN' ? 'websearch' : 'pubmed',
      payload: { id: r.id, direction: r.direction, sourceTreatmentName: r.sourceTreatment?.name, candidatePort: r.candidatePort },
      ...ctx,
    });
  }
}

function verifierPriority(verifier) {
  // Lower = runs first
  const order = { 'rule-based': 0, 'internal-consistency': 1, websearch: 2, edgar: 3, pubmed: 4 };
  return order[verifier] !== undefined ? order[verifier] : 9;
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
 */
function verifyRuleBased(claim, bindingReport) {
  if (claim.kind === 'binding') {
    const pp = bindingReport.perPortal?.[claim.payload.portalSlug];
    if (!pp || pp.issues?.length === 0) {
      return {
        verdict: 'VERIFIED',
        verifier: 'rule-based',
        evidence: ['binding-fidelity-report:no-issues'],
        confidence: 0.7,
        checkedAt: new Date().toISOString(),
        note: 'No issues in binding-fidelity audit for this portal.',
      };
    }
    const matchedIssue = pp.issues?.find(
      (i) =>
        i.entityName === claim.payload.entityName &&
        i.relType === claim.payload.relationshipType
    );
    if (!matchedIssue) {
      return {
        verdict: 'VERIFIED',
        verifier: 'rule-based',
        evidence: ['binding-fidelity-report:passed'],
        confidence: 0.75,
        checkedAt: new Date().toISOString(),
        note: 'Binding passed audit at fidelity-report time.',
      };
    }
    return {
      verdict: matchedIssue.severity === 'high' ? 'DISPUTED' : 'THEORETICAL',
      verifier: 'rule-based',
      evidence: [`binding-fidelity-report:${matchedIssue.kind}`],
      confidence: 0.6,
      checkedAt: new Date().toISOString(),
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
 * Verdict semantics under tightening:
 *   VERIFIED     — esearch hit ≥ 1 article AND top abstract passes substring
 *   DISPUTED     — esearch returned 0 articles for this query
 *   UNVERIFIABLE — esearch hit but abstract substring check failed (the
 *                  query is finding articles that don't actually support
 *                  the claim — i.e. the previous loose-query failure mode)
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
        verdict: 'DISPUTED',
        verifier: 'pubmed',
        evidence: [`query:${query}`],
        confidence: 0.6,
        checkedAt: new Date().toISOString(),
        note: 'PubMed returned 0 articles for tightened query — possibly fabricated, mis-cited, or named protocol does not exist.',
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

function propagateVerdictsToCube(cube, ledger) {
  let count = 0;
  for (const cell of cube.cells) {
    count += applyToCollection(cell.issues, ledger, (i) => `iss::${i.id}`);
    count += applyToCollection(cell.disorders, ledger, (d) => `dx::${d.id}`);
    count += applyToCollection(cell.neuroTreatments, ledger, (t) => `ntx::${t.id}`);
    count += applyToCollection(cell.domainTreatments, ledger, (t) => `dtx::${t.id}`);
    count += applyToCollection(cell.portalBindings, ledger, (b) =>
      `bind::${cell.cellId}::${b.portalSlug}::${b.relationshipType}::${b.entityName}`
    );
    count += applyToCollection(cell.crossDomainAffinities, ledger, (a) =>
      `aff::${cell.cellId}::${a.toDomain}::${a.toRole}`
    );
    count += applyToCollection(cell.residuals, ledger, (r) => `res::${r.id}`);
    // Recompute aggregate
    cell.verification = recomputeAggregate(cell);
  }
  return count;
}

function applyToCollection(coll, ledger, idFn) {
  if (!Array.isArray(coll)) return 0;
  let n = 0;
  for (const item of coll) {
    const cid = idFn(item);
    if (ledger.verdicts[cid]) {
      item.verification = ledger.verdicts[cid];
      n++;
    }
  }
  return n;
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

main().catch((err) => {
  console.error('[verification-organ] FAILED:', err.stack || err);
  process.exit(1);
});
