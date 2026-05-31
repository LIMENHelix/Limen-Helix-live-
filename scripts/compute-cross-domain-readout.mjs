#!/usr/bin/env node
/**
 * compute-cross-domain-readout.mjs
 *
 * Task #30 — cross-domain similar + residual readout.
 *
 * For each (brainNodeId × stateBucket), traverses every comparisonDomain
 * cell at that (node, state) and computes:
 *
 *   SIMILAR — treatments that appear in ≥2 sides (neuro + ≥1 domain, or
 *             ≥2 domains) — validates that the cross-domain mapping is
 *             principled rather than coincidental.
 *
 *   RESIDUAL_NEURO_TO_DOMAIN — neuro treatments at this (node, state)
 *             with no keyword overlap to any domain treatment at this
 *             (node, state). These are the CANDIDATE PORTS: things
 *             neurology does that the domain hasn't tried.
 *
 *   RESIDUAL_DOMAIN_TO_NEURO — domain treatments at this (node, state)
 *             present in only one comparison domain (or more), with no
 *             keyword overlap to any neuro treatment at this (node,
 *             state). The PORT DIRECTION: things the domain does that
 *             neuroscience hasn't analoged.
 *
 *   RECOVERY_PATHWAY_GAPS — placeholder for now; recovery sequences
 *             need explicit ordering data not yet in the cube.
 *
 * Approach: keyword Jaccard similarity. Threshold 0.30 marks treatments
 * as "similar" (already analoged across sides). Below that they're
 * candidate residuals — the discovery surface.
 *
 * Verification awareness: residuals carry source verification verdicts
 * (PENDING / VERIFIED / DISPUTED / etc) from the source treatments.
 * The report (#31) renders verification badges per residual; a residual
 * built on DISPUTED claims gets a warning, not a recommendation.
 *
 * Output: updates assets/data/treatment-discovery-cube.json — populates
 * cell.residuals[] for every cell at every (node × state), keyed on the
 * direction (NEURO_TO_DOMAIN | DOMAIN_TO_NEURO). Also writes a
 * top-level summary cube.stats.residualSummary.
 *
 * Usage: node scripts/compute-cross-domain-readout.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makePendingVerdict } from '../assets/data/schemas/treatment-discovery-cell.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CUBE_FILE = path.join(ROOT, 'assets/data/treatment-discovery-cube.json');

// Treatments must share at least this much token overlap to count as
// "similar / already analoged." Below → residual / candidate port.
const SIMILARITY_THRESHOLD = 0.3;

// Min token count to compute Jaccard. Below this, fall back to exact-substring.
const MIN_TOKENS_FOR_JACCARD = 2;

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('[cross-domain-readout] loading cube');
  const cube = JSON.parse(fs.readFileSync(CUBE_FILE, 'utf-8'));
  console.log(`[cross-domain-readout] cells: ${cube.cells.length}`);

  // Group cells by (node, state) — that's the locus where comparisons happen
  const byNodeState = new Map();
  for (const cell of cube.cells) {
    const key = `${cell.brainNodeId}__${cell.stateBucket}`;
    if (!byNodeState.has(key)) byNodeState.set(key, []);
    byNodeState.get(key).push(cell);
  }
  console.log(`[cross-domain-readout] (node × state) groups: ${byNodeState.size}`);

  const summary = {
    groupsProcessed: 0,
    groupsWithBothSides: 0,
    totalSimilar: 0,
    totalNeuroResiduals: 0,
    totalDomainResiduals: 0,
    cellsWithResiduals: 0,
    cellsWithSimilar: 0,
  };

  for (const [key, cells] of byNodeState.entries()) {
    summary.groupsProcessed++;

    // Pool neuro treatments (same across all cells in the group — disorder
    // lookup seeded them uniformly)
    const neuroPool = pickUniqueByName(
      cells.flatMap((c) => c.neuroTreatments).filter(Boolean)
    );

    // Pool domain treatments per comparisonDomain
    const domainPools = new Map();
    for (const cell of cells) {
      if (!domainPools.has(cell.comparisonDomain)) {
        domainPools.set(cell.comparisonDomain, []);
      }
      domainPools.get(cell.comparisonDomain).push(...cell.domainTreatments);
    }
    // Dedupe each domain pool
    for (const [d, txs] of domainPools.entries()) {
      domainPools.set(d, pickUniqueByName(txs));
    }

    if (neuroPool.length === 0 && [...domainPools.values()].every((v) => v.length === 0)) {
      continue;
    }
    if (neuroPool.length > 0 && [...domainPools.values()].some((v) => v.length > 0)) {
      summary.groupsWithBothSides++;
    }

    // ---- SIMILAR — treatments that appear with overlap across ≥2 sides ----
    // For each neuro treatment, find domain treatments with overlap.
    const similarPairs = []; // [{ neuro, domain: { domain, treatment } }]
    for (const ntx of neuroPool) {
      for (const [dDomain, dTxs] of domainPools.entries()) {
        for (const dtx of dTxs) {
          if (treatmentSimilarity(ntx, dtx) >= SIMILARITY_THRESHOLD) {
            similarPairs.push({ neuro: ntx, side: dDomain, domainTx: dtx });
            summary.totalSimilar++;
          }
        }
      }
    }

    // Also detect cross-domain similar (same treatment appearing in 2+ domains)
    const crossDomainSimilar = [];
    const allDomainNames = [...domainPools.keys()];
    for (let i = 0; i < allDomainNames.length; i++) {
      for (let j = i + 1; j < allDomainNames.length; j++) {
        const dA = allDomainNames[i];
        const dB = allDomainNames[j];
        for (const txA of domainPools.get(dA)) {
          for (const txB of domainPools.get(dB)) {
            if (treatmentSimilarity(txA, txB) >= SIMILARITY_THRESHOLD) {
              crossDomainSimilar.push({ domainA: dA, txA, domainB: dB, txB });
            }
          }
        }
      }
    }

    // ---- RESIDUALS — direction NEURO_TO_DOMAIN per domain ----
    const neuroResidualsPerDomain = new Map(); // domain → residuals[]
    for (const dDomain of domainPools.keys()) {
      const dTxs = domainPools.get(dDomain);
      const residuals = [];
      for (const ntx of neuroPool) {
        const matched = dTxs.some(
          (dtx) => treatmentSimilarity(ntx, dtx) >= SIMILARITY_THRESHOLD
        );
        if (!matched) {
          residuals.push({
            id: `residual-${cells[0].brainNodeId}-${cells[0].stateBucket}-${dDomain}-N2D-${ntx.id}`,
            direction: 'NEURO_TO_DOMAIN',
            sourceTreatment: ntx,
            candidatePort: candidatePortProposal(ntx, dDomain),
            rationale: `Neurology has '${ntx.name}' for ${cells[0].brainNodeId} ${cells[0].stateBucket}; no analog found in ${dDomain} treatment library at this (node, state). Mechanism: ${ntx.mechanism || 'see source pattern'}.`,
            priorArtChecked: [],
            noveltyScore: 0.7,
            feasibilityScore: 0.5,
            hypothesizedSteps: [],
            monitoringSignals: [],
            contraindications: [],
            verification: makePendingVerdict('websearch'),
            sourceProvenance: {
              field: 'residual',
              sourceFile: 'assets/data/treatment-discovery-cube.json',
              sourcePath: `$.cells[?cellId == ${cells[0].cellId}].neuroTreatments[?id=='${ntx.id}']`,
              retrievedAt: new Date().toISOString(),
              retrievedFromSha: null,
            },
          });
          summary.totalNeuroResiduals++;
        }
      }
      neuroResidualsPerDomain.set(dDomain, residuals);
    }

    // ---- RESIDUALS — direction DOMAIN_TO_NEURO per domain ----
    const domainResidualsPerDomain = new Map();
    for (const dDomain of domainPools.keys()) {
      const dTxs = domainPools.get(dDomain);
      const residuals = [];
      for (const dtx of dTxs) {
        const matched = neuroPool.some(
          (ntx) => treatmentSimilarity(dtx, ntx) >= SIMILARITY_THRESHOLD
        );
        if (!matched) {
          residuals.push({
            id: `residual-${cells[0].brainNodeId}-${cells[0].stateBucket}-${dDomain}-D2N-${dtx.id}`,
            direction: 'DOMAIN_TO_NEURO',
            sourceTreatment: dtx,
            candidatePort: domainToNeuroPortProposal(dtx, cells[0].brainNodeId),
            rationale: `${dDomain} has '${dtx.name}' for ${cells[0].brainNodeId} ${cells[0].stateBucket}; no analog found in neurology treatment library at this (node, state). Mechanism: ${dtx.mechanism || dtx.description || 'see source domain'}.`,
            priorArtChecked: [],
            noveltyScore: 0.7,
            feasibilityScore: 0.5,
            hypothesizedSteps: [],
            monitoringSignals: [],
            contraindications: [],
            verification: makePendingVerdict('pubmed'),
            sourceProvenance: {
              field: 'residual',
              sourceFile: 'assets/data/treatment-discovery-cube.json',
              sourcePath: `$.cells[?cellId == ${cells[0].cellId}].domainTreatments[?id=='${dtx.id}']`,
              retrievedAt: new Date().toISOString(),
              retrievedFromSha: null,
            },
          });
          summary.totalDomainResiduals++;
        }
      }
      domainResidualsPerDomain.set(dDomain, residuals);
    }

    // ---- WRITE BACK to every cell in the group ----
    for (const cell of cells) {
      const dDomain = cell.comparisonDomain;
      cell.residuals = [
        ...(neuroResidualsPerDomain.get(dDomain) || []),
        ...(domainResidualsPerDomain.get(dDomain) || []),
      ];

      // Mark similar treatments on the cell
      const cellSimilar = similarPairs
        .filter((sp) => sp.side === dDomain)
        .map((sp) => ({
          neuroTreatmentId: sp.neuro.id,
          neuroTreatmentName: sp.neuro.name,
          domainTreatmentId: sp.domainTx.id,
          domainTreatmentName: sp.domainTx.name,
          similarityScore: treatmentSimilarity(sp.neuro, sp.domainTx),
        }));
      const cellCrossDomain = crossDomainSimilar
        .filter(
          (cd) => cd.domainA === dDomain || cd.domainB === dDomain
        )
        .slice(0, 20);

      cell.similarAcrossDomains = cellSimilar;
      cell.crossDomainSimilarPairs = cellCrossDomain;

      if (cell.residuals.length > 0) summary.cellsWithResiduals++;
      if (cell.similarAcrossDomains.length > 0) summary.cellsWithSimilar++;
    }
  }

  // Update cube stats
  cube.stats.cellsWithResiduals = summary.cellsWithResiduals;
  cube.stats.residualSummary = {
    groupsProcessed: summary.groupsProcessed,
    groupsWithBothSides: summary.groupsWithBothSides,
    totalSimilarPairs: summary.totalSimilar,
    totalNeuroResiduals: summary.totalNeuroResiduals,
    totalDomainResiduals: summary.totalDomainResiduals,
    cellsWithResiduals: summary.cellsWithResiduals,
    cellsWithSimilar: summary.cellsWithSimilar,
    similarityThreshold: SIMILARITY_THRESHOLD,
    computedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CUBE_FILE, JSON.stringify(cube, null, 2));

  console.log('');
  console.log('=== CROSS-DOMAIN READOUT SUMMARY ===');
  console.log(`(node × state) groups processed:   ${summary.groupsProcessed}`);
  console.log(`groups with both sides populated:  ${summary.groupsWithBothSides}`);
  console.log(`total similar pairs found:         ${summary.totalSimilar}`);
  console.log(`total NEURO_TO_DOMAIN residuals:   ${summary.totalNeuroResiduals}`);
  console.log(`total DOMAIN_TO_NEURO residuals:   ${summary.totalDomainResiduals}`);
  console.log(`cells with ≥1 residual:            ${summary.cellsWithResiduals}`);
  console.log(`cells with ≥1 similar pair:        ${summary.cellsWithSimilar}`);
  console.log('');
  const sizeMB = (fs.statSync(CUBE_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`cube updated: ${path.relative(ROOT, CUBE_FILE)} (${sizeMB} MB)`);
}

// ============================================================================
// SIMILARITY
// ============================================================================

function treatmentSimilarity(txA, txB) {
  if (!txA || !txB) return 0;
  // Exact name match short-circuits
  if (txA.name && txB.name && txA.name.toLowerCase() === txB.name.toLowerCase()) {
    return 1.0;
  }

  const aTokens = tokenize(txA.name) || new Set();
  const bTokens = tokenize(txB.name) || new Set();

  // Augment with mechanism / description tokens
  for (const f of ['mechanism', 'description']) {
    if (txA[f]) for (const t of tokenize(txA[f])) aTokens.add(t);
    if (txB[f]) for (const t of tokenize(txB[f])) bTokens.add(t);
  }

  if (aTokens.size < MIN_TOKENS_FOR_JACCARD || bTokens.size < MIN_TOKENS_FOR_JACCARD) {
    // Substring fallback
    const aName = (txA.name || '').toLowerCase();
    const bName = (txB.name || '').toLowerCase();
    if (aName && bName && (aName.includes(bName) || bName.includes(aName))) return 0.6;
    return 0;
  }

  // Jaccard
  let intersect = 0;
  for (const t of aTokens) if (bTokens.has(t)) intersect++;
  const union = aTokens.size + bTokens.size - intersect;
  return union ? intersect / union : 0;
}

function tokenize(text) {
  if (!text) return new Set();
  const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were',
    'has', 'have', 'will', 'been', 'into', 'over', 'than', 'then', 'their',
    'they', 'them', 'when', 'where', 'which', 'while', 'each', 'every',
    'such', 'these', 'those', 'about', 'between', 'against', 'before', 'after',
    'also', 'because', 'before', 'between', 'during', 'further', 'should',
    'through', 'until', 'while', 'against', 'across',
  ]);
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  );
}

function pickUniqueByName(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = (item.name || '').toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

// ============================================================================
// PORT PROPOSAL PROSE
// ============================================================================

function candidatePortProposal(neuroTx, comparisonDomain) {
  const name = neuroTx.name || 'intervention';
  const type = neuroTx.type || 'unknown';
  return `Port '${name}' (${type}) to ${comparisonDomain}: identify the mechanism the neuro intervention exploits, locate the analogous lever in ${comparisonDomain}, define a measurable outcome that mirrors clinical effect. First-pass candidate; refine via PubMed mechanism search + ${comparisonDomain}-domain literature scan.`;
}

function domainToNeuroPortProposal(domainTx, brainNodeId) {
  const name = domainTx.name || 'intervention';
  const type = domainTx.type || 'unknown';
  return `Hypothesize neural analog of '${name}' (${type}) acting on ${brainNodeId}: what neural mechanism would replicate this intervention's effect on the analogous brain circuit? Generates a testable neuroscience hypothesis the domain side surfaced.`;
}

main();
