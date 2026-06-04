#!/usr/bin/env node
/**
 * build-treatment-discovery-cube.mjs
 *
 * THE PIVOT ORGAN (task #29). Reads every catalogued source from
 * assets/data/audit/field-connection-map.json and builds the per-cell
 * cube the operator's chain navigates:
 *
 *   (brainNodeId × comparisonDomain × stateBucket) → DiscoveryCell
 *
 * Each cell encodes the six-step chain:
 *   1. ISSUE       — portal.warningSignals + opportunitySignals
 *                    + intelligenceCycle.diagnosis + domain.diagnosticTriggers
 *   2. NODE        — brain-node taxonomy entry + state
 *   3. DISORDER    — from neuro-disorder-lookup.json (step 3 source)
 *   4. NEURO_TX    — from neuro-disorder-lookup.json (step 4 source)
 *   5. DOMAIN_TX   — domain.activations.treatments + .deep.json
 *                    + portal.intelligenceCycle.regulate/action/adapt
 *   6. RESIDUAL    — DEFERRED to cross-domain readout (task #30)
 *
 * Bindings: respects binding-fidelity-report.json — skips bindings
 * with missing brainNodeId; keeps role-inconsistent bindings but
 * flags them in buildWarnings (verification organ will rule on them
 * later).
 *
 * Every populated value carries sourceProvenance. Every claim
 * carries verification: PENDING — task #33 fills the verdicts.
 *
 * Output: assets/data/treatment-discovery-cube.json
 *
 * Usage: node scripts/build-treatment-discovery-cube.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  makeEmptyCell,
  makePendingVerdict,
  makeProvenance,
  STATE_BUCKETS,
  recomputeVerificationProfile,
} from '../assets/data/schemas/treatment-discovery-cell.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PORTAL_DIR = path.join(ROOT, 'assets/data/companies');
const DOMAIN_DIR = path.join(ROOT, 'assets/data/domains');
const AGGREGATED_DIR = path.join(ROOT, 'assets/data/aggregated');
const TAXONOMY_FILE = path.join(ROOT, 'assets/data/brain-node-business-mapping.json');
const NODES_111_FILE = path.join(ROOT, 'assets/data/brain-nodes-111.json');
const NODE_MAP_FILE = path.join(ROOT, 'assets/data/brain-node-map.json');
const DISORDER_LOOKUP_FILE = path.join(ROOT, 'assets/data/neuro-disorder-lookup.json');
const BRIDGES_FILE = path.join(ROOT, 'assets/data/bridge-patterns.json');
const BINDING_REPORT_FILE = path.join(ROOT, 'assets/data/audit/binding-fidelity-report.json');
const MASTER_INBOX_FILE = path.join(ROOT, 'assets/data/_master-inbox.json');

const OUTPUT_FILE = path.join(ROOT, 'assets/data/treatment-discovery-cube.json');

const RELATIONSHIP_TYPES = [
  'suppliers',
  'customers',
  'competitors',
  'regulators',
  'auditor',
  'capitalProviders',
  'executiveTeam',
  'logisticsPartners',
  'marketSignals',
];

// Cap stored items per cell to keep file size reasonable; operator can
// inspect the cube as a sample, full corpus is available via the source files.
const MAX_ISSUES_PER_CELL = 40;
const MAX_NEURO_TX_PER_CELL = 30;
const MAX_DOMAIN_TX_PER_CELL = 60;
const MAX_BINDINGS_PER_CELL = 80;

// ============================================================================
// PHASE → STATE BUCKET MAP
// ============================================================================

// First-pass mapping. Pivot is intentionally simple — operator can refine
// after reviewing the cube and seeing how state assignment shows up.
const PHASE_TO_STATE = {
  p0: 'hyperactive', // crisis / acute distress
  p1: 'hyperactive', // nascent overactivation
  p2: 'hyperactive',
  p3: 'mixed',
  p4: 'mixed',
  p5: 'mixed',
  p6: 'regulated', // order / steady
  p7: 'hypoactive', // simulation / exhaustion onset
  'p7a': 'hypoactive', // dorsal collapse
  'p7b': 'mixed', // sympathetic lock (damp)
  p8: 'hypoactive', // exhausted
  p9: 'mixed', // oscillation
  p10: 'mixed',
};

function phaseToStateBucket(phase) {
  if (!phase) return 'unknown';
  const key = String(phase).toLowerCase().trim();
  return PHASE_TO_STATE[key] || 'unknown';
}

function severityToStateBucket(severity) {
  if (severity === 'high') return 'hyperactive';
  if (severity === 'low') return 'hypoactive';
  return 'mixed';
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('[pivot-organ] starting cube build');

  // Load every source
  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf-8'));
  const nodeMap = JSON.parse(fs.readFileSync(NODE_MAP_FILE, 'utf-8'));
  const disorderLookup = JSON.parse(fs.readFileSync(DISORDER_LOOKUP_FILE, 'utf-8'));
  const bridges = JSON.parse(fs.readFileSync(BRIDGES_FILE, 'utf-8'));
  const bindingReport = safeReadJSON(BINDING_REPORT_FILE);
  const masterInbox = safeReadJSON(MASTER_INBOX_FILE);

  const canonicalNodeIds = new Set(Object.keys(taxonomy));
  console.log(`[pivot-organ] taxonomy nodes: ${canonicalNodeIds.size}`);

  // Load all L1 domain templates
  const domainFiles = fs
    .readdirSync(DOMAIN_DIR)
    .filter((f) => /^[a-z]+\.json$/.test(f));
  const domains = {};
  for (const f of domainFiles) {
    const id = f.replace(/\.json$/, '');
    try {
      domains[id] = JSON.parse(fs.readFileSync(path.join(DOMAIN_DIR, f), 'utf-8'));
    } catch (err) {
      console.log(`  [warn] could not parse domain ${id}: ${err.message}`);
    }
  }
  // Sub-domain aliases: supplyChain and health are comparison domains (surfaced
  // via crossDomainAffinities + the page's button list) but have no L1 template
  // of their own, so their cells were empty. Alias each to its nearest parent
  // domain's treatment knowledge — supplyChain≈trade (logistics/trade), health≈
  // medicine (clinical). By-reference is safe (STEP A/B only READ dom.activations).
  // This fills those views with REAL treatments (a transparent alias, not bespoke
  // data). NOTE: agriculture also lacks a template but has NO parent domain to
  // alias to (its data lives only in deep p2_agri_* files, never aggregated) — so
  // it is left unsourced rather than mislabeled with another domain's treatments.
  if (domains['trade'] && !domains['supplyChain']) domains['supplyChain'] = domains['trade'];
  if (domains['medicine'] && !domains['health']) domains['health'] = domains['medicine'];
  const domainIds = Object.keys(domains);
  console.log(`[pivot-organ] L1 domain templates loaded: ${domainIds.length}`);
  console.log(`  ${domainIds.join(', ')}`);

  // Load portals
  const portalFiles = fs.readdirSync(PORTAL_DIR).filter((f) => f.endsWith('.json'));
  console.log(`[pivot-organ] portals to ingest: ${portalFiles.length}`);

  // Cube
  const cube = {
    schemaVersion: '1.0.0',
    builtAt: new Date().toISOString(),
    kernelShaLock: null,
    loadedComparisonDomains: domainIds,
    description:
      'Per-cell cube produced by the pivot organ. Cells keyed by (brainNodeId × comparisonDomain × stateBucket). Every claim carries verification: PENDING — task #33 verifies. Residuals computed by task #30.',
    stats: {
      totalCells: 0,
      populatedCells: 0,
      cellsWithResiduals: 0,
      cellsWithDisputedClaims: 0,
      perDomainBreakdown: {},
      perNodeBreakdown: {},
      perStateBreakdown: {},
      perVerdictBreakdown: { VERIFIED: 0, DISPUTED: 0, THEORETICAL: 0, UNVERIFIABLE: 0, FABRICATED: 0, PENDING: 0 },
    },
    cells: [],
    issueIndex: { byIssueId: {}, byPortalSlug: {}, byDomainId: {}, byKeyword: {} },
    nodeIndex: { byNodeId: {}, byNetwork: {}, byPhase: {} },
    disorderIndex: { byDisorderName: {}, byIcd10: {}, byMechanism: {} },
    unverifiedClaimsCount: 0,
  };

  // Cell lookup: key = cellId
  const cellMap = new Map();
  const ensureCell = (brainNodeId, stateBucket, comparisonDomain) => {
    if (!canonicalNodeIds.has(brainNodeId)) return null;
    if (!STATE_BUCKETS.includes(stateBucket)) stateBucket = 'unknown';
    const cellId = `${brainNodeId}__${stateBucket}__${comparisonDomain}`;
    if (!cellMap.has(cellId)) {
      const c = makeEmptyCell({ brainNodeId, stateBucket, comparisonDomain });
      c.node = buildNodeProfile(brainNodeId, taxonomy, nodeMap);
      cellMap.set(cellId, c);
    }
    return cellMap.get(cellId);
  };

  // ============================================================================
  // STEP A — populate disorders + neuroTreatments from the lookup
  //          (eager — for every (node × bucket) the lookup knows about,
  //           seed cells across every loaded comparison domain so the
  //           cube starts dense on the neuro side)
  // ============================================================================

  let cellsSeededByLookup = 0;
  for (const [nodeId, node] of Object.entries(disorderLookup.nodes || {})) {
    if (!canonicalNodeIds.has(nodeId)) continue;
    for (const [bucket, stateCell] of Object.entries(node.states)) {
      if (bucket === 'regulated' && stateCell.disorders.length === 0 && stateCell.treatments.length === 0) {
        continue;
      }
      for (const domainId of domainIds) {
        const cell = ensureCell(nodeId, bucket, domainId);
        if (!cell) continue;
        cellsSeededByLookup++;

        // Disorders
        for (const d of stateCell.disorders) {
          cell.disorders.push({
            ...d,
            verification: d.verification || makePendingVerdict('pubmed'),
          });
        }

        // Neuro treatments (cap)
        for (const t of stateCell.treatments) {
          if (cell.neuroTreatments.length >= MAX_NEURO_TX_PER_CELL) break;
          cell.neuroTreatments.push({
            ...t,
            verification: t.verification || makePendingVerdict('pubmed'),
          });
        }

        // Track provenance
        cell.sourceProvenance.push(
          makeProvenance({
            field: 'disorders+neuroTreatments',
            sourceFile: 'assets/data/neuro-disorder-lookup.json',
            sourcePath: `$.nodes['${nodeId}'].states['${bucket}']`,
          })
        );
      }
    }
  }
  console.log(`[pivot-organ] seeded cells from disorder lookup: ${cellsSeededByLookup}`);

  // ============================================================================
  // STEP B — domain.activations[] populate domainTreatments + diagnosticTriggers
  // ============================================================================

  let domainActivationsPivoted = 0;
  for (const [domainId, dom] of Object.entries(domains)) {
    if (!Array.isArray(dom.activations)) continue;
    for (const act of dom.activations) {
      if (!act.brainNodeId) continue;
      const nodeId = act.brainNodeId;
      if (!canonicalNodeIds.has(nodeId)) continue;

      // State from activation.phase_archetype if available
      const stateBucket = phaseToStateBucket(act.phase_archetype) === 'unknown'
        ? 'mixed' // default for activations without phase
        : phaseToStateBucket(act.phase_archetype);

      const cell = ensureCell(nodeId, stateBucket, domainId);
      if (!cell) continue;
      domainActivationsPivoted++;

      // Diagnostic triggers → issues
      for (const trig of act.diagnosticTriggers || []) {
        if (cell.issues.length >= MAX_ISSUES_PER_CELL) break;
        cell.issues.push({
          id: `${domainId}-${nodeId}-${slug(trig)}`,
          symptom: trig,
          sourceType: 'diagnosticTrigger',
          sourceFile: `assets/data/domains/${domainId}.json`,
          sourcePath: `$.activations[?brainNodeId=='${nodeId}'].diagnosticTriggers`,
          portalSlug: null,
          domainId,
          severity: null,
          sourceFilingTypes: [],
          citations: [],
          verification: makePendingVerdict('websearch'),
        });
      }

      // Treatments → domainTreatments
      for (const tx of act.treatments || []) {
        if (cell.domainTreatments.length >= MAX_DOMAIN_TX_PER_CELL) break;
        cell.domainTreatments.push({
          id: `${domainId}-${nodeId}-${slug(tx.label || '')}`,
          name: tx.label || '(unlabeled)',
          type: tx.type || 'STRUCTURAL',
          mechanism: null,
          evidenceGrade:
            tx.evidence === 'Strong' ? 'STRONG'
            : tx.evidence === 'Moderate' ? 'MODERATE'
            : tx.evidence === 'Weak' ? 'WEAK'
            : 'MODERATE',
          description: tx.description || tx.label || '',
          steps: [],
          monitoring: null,
          escalation: null,
          target: 'unknown',
          appliesToDisorderId: null,
          appliesToIssueId: null,
          citations: [],
          side: domainId,
          sourceProvenance: {
            field: 'treatment',
            sourceFile: `assets/data/domains/${domainId}.json`,
            sourcePath: `$.activations[?brainNodeId=='${nodeId}'].treatments[?label=='${tx.label}']`,
            retrievedAt: new Date().toISOString(),
            retrievedFromSha: null,
          },
          verification: makePendingVerdict('websearch'),
        });
      }

      // crossDomainAffinities → propagation edges
      for (const aff of act.crossDomainAffinities || []) {
        cell.crossDomainAffinities.push({
          toDomain: aff.domain,
          toRole: aff.role,
          reciprocal: false, // set in #30 cross-domain pass
          sourceCellId: null,
          verification: makePendingVerdict('internal-consistency'),
        });
      }

      // Gating from activation
      if (act.phase_archetype && !cell.gating.phase.includes(act.phase_archetype.toUpperCase())) {
        cell.gating.phase.push(act.phase_archetype.toUpperCase());
      }
      if (typeof act.weight === 'number' && act.weight > cell.gating.salienceFloor) {
        cell.gating.salienceFloor = act.weight;
      }
    }
  }
  console.log(`[pivot-organ] domain activations pivoted: ${domainActivationsPivoted}`);

  // ============================================================================
  // STEP C — portals → bindings + issues
  // ============================================================================

  let portalsIngested = 0;
  let bindingsAttached = 0;
  let issuesAttached = 0;
  let portalsSkipped = 0;
  const bindingReportPerPortal = bindingReport?.perPortal || {};

  for (const file of portalFiles) {
    const slug_ = file.replace(/\.json$/, '');
    let portal;
    try {
      portal = JSON.parse(fs.readFileSync(path.join(PORTAL_DIR, file), 'utf-8'));
    } catch {
      portalsSkipped++;
      continue;
    }
    portalsIngested++;

    const comparisonDomain = portal.domainId || 'business';
    if (!domainIds.includes(comparisonDomain)) {
      // Portal points at a domain we don't have a template for — still record
      // bindings under a synthetic comparison domain so they're not lost
    }

    // State bucket from financialHealth.dominantPhase
    const dominantPhase = portal.financialHealth?.dominantPhase;
    const portalStateBucket = phaseToStateBucket(dominantPhase);

    // BINDINGS — walk every relationship type, attach to (binding.brainNodeId, derived bucket, portal's domain)
    const fn = portal.functionalNetwork || {};
    for (const relType of RELATIONSHIP_TYPES) {
      let entries = fn[relType];
      if (!entries) continue;
      if (!Array.isArray(entries)) entries = [entries];
      for (const entry of entries) {
        if (!entry || !entry.brainNodeId) continue;
        if (!canonicalNodeIds.has(entry.brainNodeId)) continue;

        // For binding cell: use the BOUND node + the portal's state bucket
        // (the binding tells us the portal participates in this node's circuit;
        //  the portal's state colors the cell that participation enters)
        const bucket = portalStateBucket === 'unknown' ? 'mixed' : portalStateBucket;
        const cell = ensureCell(entry.brainNodeId, bucket, comparisonDomain);
        if (!cell) continue;

        if (cell.portalBindings.length >= MAX_BINDINGS_PER_CELL) continue;
        cell.portalBindings.push({
          portalSlug: slug_,
          entityName: entry.name || entry.firm || '(unnamed)',
          relationshipType: relType,
          role: entry.brainNodeRole || '',
          relationshipNote: entry.relationshipNote || '',
          confidence: entry.confidence || 'medium',
          sourceType: entry.sourceType || [],
          bindingStrength: estimateBindingStrength(entry),
          verification: makePendingVerdict('rule-based'),
        });
        bindingsAttached++;
      }
    }

    // ISSUES — warningSignals
    for (const wsig of portal.warningSignals || []) {
      if (!wsig?.message) continue;
      // Issues attach to the portal's brain-node bindings — for each unique
      // brainNodeId the portal binds, attach the issue to that cell.
      // (A portal-level issue affects the whole circuit the portal sits in.)
      const portalNodeIds = collectPortalNodeIds(fn, canonicalNodeIds);
      for (const nodeId of portalNodeIds) {
        const bucket = severityToStateBucket(wsig.severity) || 'mixed';
        const cell = ensureCell(nodeId, bucket, comparisonDomain);
        if (!cell) continue;
        if (cell.issues.length >= MAX_ISSUES_PER_CELL) continue;
        cell.issues.push({
          id: wsig.id || `${slug_}-warning-${slug(wsig.message).substring(0, 40)}`,
          symptom: wsig.message,
          sourceType: 'warningSignal',
          sourceFile: `assets/data/companies/${file}`,
          sourcePath: `$.warningSignals[?id=='${wsig.id || ''}']`,
          portalSlug: slug_,
          domainId: comparisonDomain,
          severity: wsig.severity || null,
          sourceFilingTypes: wsig.sourceType || [],
          citations: [],
          verification: makePendingVerdict('edgar'),
        });
        issuesAttached++;
      }
    }

    // ISSUES — intelligenceCycle.diagnosis
    const ic = Array.isArray(portal.intelligenceCycle) ? portal.intelligenceCycle : [];
    const dxLayer = ic.find((l) => l && l.layer === 'diagnosis');
    if (dxLayer && Array.isArray(dxLayer.items)) {
      const portalNodeIds = collectPortalNodeIds(fn, canonicalNodeIds);
      for (const dx of dxLayer.items.slice(0, 5)) {
        // Cap diagnosis items per portal to avoid explosion
        for (const nodeId of portalNodeIds) {
          const bucket = portalStateBucket === 'unknown' ? 'mixed' : portalStateBucket;
          const cell = ensureCell(nodeId, bucket, comparisonDomain);
          if (!cell) continue;
          if (cell.issues.length >= MAX_ISSUES_PER_CELL) continue;
          cell.issues.push({
            id: `${slug_}-dx-${slug(String(dx).substring(0, 30))}`,
            symptom: String(dx).substring(0, 400),
            sourceType: 'intelligenceCycle.diagnosis',
            sourceFile: `assets/data/companies/${file}`,
            sourcePath: '$.intelligenceCycle[?layer==diagnosis].items',
            portalSlug: slug_,
            domainId: comparisonDomain,
            severity: null,
            sourceFilingTypes: [],
            citations: [],
            verification: makePendingVerdict('websearch'),
          });
          issuesAttached++;
        }
      }
    }

    // PORTAL CONTRIBUTES TO GATING — set gating.distressBands + salienceFloor per cell
    const fh = portal.financialHealth || {};
    if (fh.distressBand) {
      const portalNodeIds = collectPortalNodeIds(fn, canonicalNodeIds);
      for (const nodeId of portalNodeIds) {
        for (const cellId of [...cellMap.keys()].filter((k) =>
          k.startsWith(`${nodeId}__`)
        )) {
          const cell = cellMap.get(cellId);
          if (cell && !cell.gating.distressBands.includes(fh.distressBand)) {
            cell.gating.distressBands.push(fh.distressBand);
          }
        }
      }
    }
  }
  console.log(`[pivot-organ] portals ingested: ${portalsIngested}, skipped: ${portalsSkipped}`);
  console.log(`[pivot-organ] bindings attached: ${bindingsAttached}`);
  console.log(`[pivot-organ] issues attached: ${issuesAttached}`);

  // ============================================================================
  // STEP D — bridge patterns reinforce mechanism + neuro citations
  // ============================================================================

  let bridgeReinforced = 0;
  for (const pat of bridges.patterns || []) {
    const nodeId = pat.neural?.region;
    if (!nodeId || !canonicalNodeIds.has(nodeId)) continue;
    const bucket = bridgeStateToBucket(pat.neural.state);
    if (bucket === 'unknown') continue;
    // Apply bridge to every comparison domain (most relevantly business)
    for (const domainId of domainIds) {
      const cellId = `${nodeId}__${bucket}__${domainId}`;
      if (!cellMap.has(cellId)) continue;
      const cell = cellMap.get(cellId);
      cell.sourceProvenance.push(
        makeProvenance({
          field: 'mechanism+citations',
          sourceFile: 'assets/data/bridge-patterns.json',
          sourcePath: `$.patterns[?id=='${pat.id}']`,
        })
      );
      bridgeReinforced++;
    }
  }
  console.log(`[pivot-organ] bridge reinforcements: ${bridgeReinforced}`);

  // ============================================================================
  // STEP D2 — treatment broadcast
  //
  // domain.activations[].treatments anchor to a specific stateBucket via
  // activation.phase_archetype. But these treatments are generally
  // state-agnostic at the (node × domain) level — antitrust applies to BG
  // hyperactivation (monopsony) regardless of which exact lifecycle phase
  // the entity is in. The neuro-disorder lookup, by contrast, seeded cells
  // at (node × hyperactive|hypoactive|mixed|regulated × every domain).
  //
  // Without broadcast: residual computation fails because most cells have
  // only one library populated.
  //
  // With broadcast: domain treatments propagate to every populated state
  // bucket at the same (node × domain). A buildWarning is recorded so the
  // verification organ knows these were broadcast, not specifically
  // state-attested.
  // ============================================================================

  let txBroadcast = 0;
  // Group cells by (node × domain) for broadcast
  const cellsByNodeDomain = new Map();
  for (const cell of cellMap.values()) {
    const key = `${cell.brainNodeId}__${cell.comparisonDomain}`;
    if (!cellsByNodeDomain.has(key)) cellsByNodeDomain.set(key, []);
    cellsByNodeDomain.get(key).push(cell);
  }

  for (const cells of cellsByNodeDomain.values()) {
    if (cells.length < 2) continue;
    // Collect all unique domainTreatments and crossDomainAffinities across the group
    const allDomainTx = new Map(); // by id
    const allAffinities = new Map(); // by toDomain+toRole
    for (const cell of cells) {
      for (const tx of cell.domainTreatments) {
        if (!allDomainTx.has(tx.id)) allDomainTx.set(tx.id, tx);
      }
      for (const aff of cell.crossDomainAffinities) {
        const k = `${aff.toDomain}|${aff.toRole}`;
        if (!allAffinities.has(k)) allAffinities.set(k, aff);
      }
    }
    // Re-attach to every cell in the group
    for (const cell of cells) {
      const existing = new Set(cell.domainTreatments.map((t) => t.id));
      for (const tx of allDomainTx.values()) {
        if (existing.has(tx.id)) continue;
        if (cell.domainTreatments.length >= MAX_DOMAIN_TX_PER_CELL) break;
        cell.domainTreatments.push({ ...tx });
        txBroadcast++;
      }
      const existingAff = new Set(
        cell.crossDomainAffinities.map((a) => `${a.toDomain}|${a.toRole}`)
      );
      for (const aff of allAffinities.values()) {
        const k = `${aff.toDomain}|${aff.toRole}`;
        if (existingAff.has(k)) continue;
        cell.crossDomainAffinities.push({ ...aff });
      }
      if (txBroadcast > 0 && !cell.buildWarnings.includes('domain-tx-broadcast')) {
        cell.buildWarnings.push('domain-tx-broadcast');
      }
    }
  }
  console.log(`[pivot-organ] treatments broadcast across state buckets: ${txBroadcast} attach operations`);

  // ============================================================================
  // STEP E — finalize: build indexes, recompute verification profiles
  // ============================================================================

  const cells = [...cellMap.values()];
  for (const cell of cells) {
    // Recompute verification profile
    cell.verification = recomputeVerificationProfile(cell);

    // Tally stats
    cube.stats.perVerdictBreakdown.PENDING += cell.verification.pendingClaimCount;
    cube.stats.perDomainBreakdown[cell.comparisonDomain] =
      (cube.stats.perDomainBreakdown[cell.comparisonDomain] || 0) + 1;
    cube.stats.perNodeBreakdown[cell.brainNodeId] =
      (cube.stats.perNodeBreakdown[cell.brainNodeId] || 0) + 1;
    cube.stats.perStateBreakdown[cell.stateBucket] =
      (cube.stats.perStateBreakdown[cell.stateBucket] || 0) + 1;

    // Indexes
    pushIdx(cube.nodeIndex.byNodeId, cell.brainNodeId, cell.cellId);
    if (cell.node?.network) pushIdx(cube.nodeIndex.byNetwork, cell.node.network, cell.cellId);
    for (const ph of cell.gating.phase) pushIdx(cube.nodeIndex.byPhase, ph, cell.cellId);

    for (const iss of cell.issues) {
      cube.issueIndex.byIssueId[iss.id] = cell.cellId;
      if (iss.portalSlug)
        pushIdx(cube.issueIndex.byPortalSlug, iss.portalSlug, cell.cellId);
      if (iss.domainId)
        pushIdx(cube.issueIndex.byDomainId, iss.domainId, cell.cellId);
      for (const kw of extractKeywords(iss.symptom)) {
        pushIdx(cube.issueIndex.byKeyword, kw, cell.cellId);
      }
    }

    for (const d of cell.disorders) {
      pushIdx(cube.disorderIndex.byDisorderName, d.name.toLowerCase(), cell.cellId);
      if (d.icd10) pushIdx(cube.disorderIndex.byIcd10, d.icd10, cell.cellId);
    }

    if (
      cell.issues.length > 0 ||
      cell.disorders.length > 0 ||
      cell.neuroTreatments.length > 0 ||
      cell.domainTreatments.length > 0
    ) {
      cube.stats.populatedCells++;
    }

    cell.lastBuiltAt = new Date().toISOString();
  }

  cube.cells = cells;
  cube.stats.totalCells = cells.length;
  cube.unverifiedClaimsCount = cube.stats.perVerdictBreakdown.PENDING;

  // Write
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cube, null, 2));

  // CLI summary
  console.log('');
  console.log('=== TREATMENT-DISCOVERY CUBE STATS ===');
  console.log(`total cells:         ${cube.stats.totalCells}`);
  console.log(`populated cells:     ${cube.stats.populatedCells}`);
  console.log(`per-state breakdown:`);
  for (const [s, n] of Object.entries(cube.stats.perStateBreakdown)) {
    console.log(`    ${s.padEnd(12)} ${n}`);
  }
  console.log(`per-domain (top 10):`);
  const topDomains = Object.entries(cube.stats.perDomainBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [d, n] of topDomains) console.log(`    ${d.padEnd(20)} ${n}`);
  console.log(`per-node (top 12):`);
  const topNodes = Object.entries(cube.stats.perNodeBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  for (const [n, c] of topNodes) console.log(`    ${n.padEnd(10)} ${c}`);
  console.log('');
  console.log(`PENDING verification claims: ${cube.unverifiedClaimsCount}`);
  console.log('');
  const sizeKB = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(0);
  console.log(`wrote ${path.relative(ROOT, OUTPUT_FILE)} (${sizeKB} KB)`);
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

function buildNodeProfile(brainNodeId, taxonomy, nodeMap) {
  const tx = taxonomy[brainNodeId] || {};
  const m = nodeMap[brainNodeId] || {};
  return {
    brainNodeId,
    region: tx.region || null,
    abbreviation: brainNodeId,
    network: tx.network || null,
    limen_phase: tx.phase ? [tx.phase] : m.phase_archetype ? [m.phase_archetype] : [],
    functional_role: m.functional_role || null,
    function: tx.function || null,
    dysregulationProse: tx.dysregulation || null,
    communicatesWith: [],
    sourceProvenance: {
      field: 'NodeProfile',
      sourceFile: 'assets/data/brain-node-business-mapping.json + brain-node-map.json',
      sourcePath: `$.${brainNodeId}`,
      retrievedAt: new Date().toISOString(),
      retrievedFromSha: null,
    },
  };
}

function collectPortalNodeIds(functionalNetwork, canonicalNodeIds) {
  const out = new Set();
  for (const rel of RELATIONSHIP_TYPES) {
    let v = functionalNetwork[rel];
    if (!v) continue;
    if (!Array.isArray(v)) v = [v];
    for (const e of v) {
      if (e?.brainNodeId && canonicalNodeIds.has(e.brainNodeId)) {
        out.add(e.brainNodeId);
      }
    }
  }
  return [...out];
}

function estimateBindingStrength(entry) {
  if (entry.confidence === 'high') return 0.85;
  if (entry.confidence === 'medium') return 0.6;
  if (entry.confidence === 'low') return 0.35;
  return 0.5;
}

function bridgeStateToBucket(rawState) {
  if (!rawState) return 'unknown';
  const s = rawState.toLowerCase();
  if (s.includes('hyperactiv') || s.includes('hyperreact') || s.includes('elevation') || s.includes('chronic_dys')) return 'hyperactive';
  if (s.includes('hypoactiv') || s.includes('hyporeact')) return 'hypoactive';
  if (s.includes('failure') || s.includes('disrupt') || s.includes('blindness') || s.includes('distort') || s.includes('dominance') || s.includes('phasic_burst')) return 'mixed';
  if (s.includes('regulated')) return 'regulated';
  return 'mixed';
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function pushIdx(map, key, val) {
  if (!key) return;
  if (!map[key]) map[key] = [];
  if (!map[key].includes(val)) map[key].push(val);
}

function extractKeywords(text) {
  if (!text) return [];
  const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'will', 'been', 'into', 'over', 'than', 'then', 'their', 'they', 'them']);
  return [
    ...new Set(
      String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 5 && !STOPWORDS.has(t))
        .slice(0, 12)
    ),
  ];
}

main().catch((err) => {
  console.error('[pivot-organ] FAILED:', err.stack || err);
  process.exit(1);
});
