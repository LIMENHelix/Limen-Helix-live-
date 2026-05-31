#!/usr/bin/env node
/**
 * split-cube-for-render.mjs
 *
 * Splits the 81MB treatment-discovery-cube.json into render-sized
 * artifacts so the operator surface can load without pulling the whole
 * cube:
 *
 *   assets/data/treatment-discovery/_index.json        — ~50KB navigation index
 *   assets/data/treatment-discovery/by-node/{nodeId}.json  — ~100-500KB each
 *   assets/data/treatment-discovery/_summary.json      — small dashboard stats
 *
 * HTML page (treatment-discovery.html) loads _index.json first, then
 * pulls a node's full cells on click.
 *
 * Usage: node scripts/split-cube-for-render.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CUBE_FILE = path.join(ROOT, 'assets/data/treatment-discovery-cube.json');
const OUT_DIR = path.join(ROOT, 'assets/data/treatment-discovery');
const BY_NODE_DIR = path.join(OUT_DIR, 'by-node');
const INDEX_FILE = path.join(OUT_DIR, '_index.json');
const SUMMARY_FILE = path.join(OUT_DIR, '_summary.json');

function main() {
  console.log('[split-cube] reading cube');
  const cube = JSON.parse(fs.readFileSync(CUBE_FILE, 'utf-8'));
  console.log(`[split-cube] cells: ${cube.cells.length}`);

  fs.mkdirSync(BY_NODE_DIR, { recursive: true });

  // Group cells by brainNodeId
  const byNode = new Map();
  for (const cell of cube.cells) {
    if (!byNode.has(cell.brainNodeId)) byNode.set(cell.brainNodeId, []);
    byNode.get(cell.brainNodeId).push(cell);
  }

  // Write per-node files + build index
  const index = {
    schemaVersion: '1.0.0',
    builtAt: cube.builtAt,
    loadedComparisonDomains: cube.loadedComparisonDomains,
    stats: cube.stats,
    nodes: [], // per-node summary, no cell bodies
  };

  // Windows reserves these filenames; prefix with underscore so git can
  // index them on Windows hosts (deploy stays case-insensitive across OSes)
  const WINDOWS_RESERVED = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
  ]);
  function safeFilename(nodeId) {
    return WINDOWS_RESERVED.has(nodeId.toUpperCase()) ? `_${nodeId}` : nodeId;
  }

  for (const [nodeId, cells] of byNode.entries()) {
    // Per-node file
    const nodeFile = path.join(BY_NODE_DIR, `${safeFilename(nodeId)}.json`);
    const nodeProfile = cells[0]?.node || null;
    const perNode = {
      brainNodeId: nodeId,
      node: nodeProfile,
      cells, // full cell bodies
    };
    fs.writeFileSync(nodeFile, JSON.stringify(perNode, null, 0));

    // Aggregate index entry — counts + top residuals + states present
    const statesPresent = new Set();
    const domainsPresent = new Set();
    let issueCount = 0;
    let disorderCount = 0;
    let neuroTxCount = 0;
    let domainTxCount = 0;
    let bindingCount = 0;
    let residualCount = 0;
    let n2dCount = 0;
    let d2nCount = 0;
    let pendingClaims = 0;
    let topDisorders = new Set();
    let topNeuroTreatments = new Set();

    for (const cell of cells) {
      statesPresent.add(cell.stateBucket);
      domainsPresent.add(cell.comparisonDomain);
      issueCount += cell.issues.length;
      disorderCount += cell.disorders.length;
      neuroTxCount += cell.neuroTreatments.length;
      domainTxCount += cell.domainTreatments.length;
      bindingCount += cell.portalBindings.length;
      residualCount += cell.residuals.length;
      n2dCount += cell.residuals.filter((r) => r.direction === 'NEURO_TO_DOMAIN').length;
      d2nCount += cell.residuals.filter((r) => r.direction === 'DOMAIN_TO_NEURO').length;
      pendingClaims += cell.verification?.pendingClaimCount || 0;
      for (const d of cell.disorders.slice(0, 5)) topDisorders.add(d.name);
      for (const t of cell.neuroTreatments.slice(0, 5))
        topNeuroTreatments.add(t.name);
    }

    index.nodes.push({
      brainNodeId: nodeId,
      region: nodeProfile?.region || null,
      network: nodeProfile?.network || null,
      cellCount: cells.length,
      stats: {
        issues: issueCount,
        disorders: disorderCount,
        neuroTreatments: neuroTxCount,
        domainTreatments: domainTxCount,
        bindings: bindingCount,
        residuals: residualCount,
        neuroToDomainResiduals: n2dCount,
        domainToNeuroResiduals: d2nCount,
        pendingClaims,
      },
      states: [...statesPresent],
      domains: [...domainsPresent],
      topDisorders: [...topDisorders].slice(0, 6),
      topNeuroTreatments: [...topNeuroTreatments].slice(0, 6),
      perNodeFile: `assets/data/treatment-discovery/by-node/${safeFilename(nodeId)}.json`,
    });
  }

  // Sort nodes by residual count descending so the operator sees the
  // densest discoveries first
  index.nodes.sort((a, b) => b.stats.residuals - a.stats.residuals);

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

  // Summary file — dashboard stats only
  const summary = {
    schemaVersion: '1.0.0',
    builtAt: cube.builtAt,
    totalCells: cube.cells.length,
    populatedCells: cube.stats.populatedCells,
    cellsWithResiduals: cube.stats.cellsWithResiduals,
    perStateBreakdown: cube.stats.perStateBreakdown,
    perDomainBreakdown: cube.stats.perDomainBreakdown,
    residualSummary: cube.stats.residualSummary,
    unverifiedClaimsCount: cube.unverifiedClaimsCount,
    loadedComparisonDomains: cube.loadedComparisonDomains,
    note:
      'Treatment-discovery report uses (brainNodeId × comparisonDomain × stateBucket) cells. Six-step chain per cell: ISSUE → NODE → DISORDER → NEURO_TX → DOMAIN_TX → RESIDUAL. Verification: PENDING (most claims), VERIFIED (post-#33), DISPUTED / FABRICATED suppress residuals.',
  };
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));

  // CLI summary
  const indexSize = (fs.statSync(INDEX_FILE).size / 1024).toFixed(0);
  const summarySize = (fs.statSync(SUMMARY_FILE).size / 1024).toFixed(0);
  console.log('');
  console.log('=== SPLIT SUMMARY ===');
  console.log(`per-node files: ${byNode.size} (in ${path.relative(ROOT, BY_NODE_DIR)})`);
  console.log(`index file:     ${path.relative(ROOT, INDEX_FILE)} (${indexSize} KB)`);
  console.log(`summary file:   ${path.relative(ROOT, SUMMARY_FILE)} (${summarySize} KB)`);
  console.log('');
  console.log('top 10 nodes by residual count:');
  for (const n of index.nodes.slice(0, 10)) {
    console.log(
      `  ${n.brainNodeId.padEnd(10)} ${n.stats.residuals.toString().padStart(4)} residuals, ${n.cellCount} cells, ${n.stats.bindings} bindings`
    );
  }
}

main();
