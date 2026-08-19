/**
 * @file treatment-discovery-cell.schema.js
 *
 * Canonical schema for the LIMEN Helix treatment-discovery report.
 *
 * The unit of the report is a CELL keyed by
 *   (brainNodeId × comparisonDomain × stateBucket).
 *
 * Each cell encodes the operator's six-step chain:
 *
 *   1. ISSUE        — domain symptom that enters the cell
 *                     (portal.warningSignals, intelligenceCycle.diagnosis,
 *                      domain.activations[].diagnosticTriggers, .deep.json events)
 *   2. NODE         — which brain node + dysregulation state
 *                     (124-node taxonomy × {hyperactive|hypoactive|regulated|mixed|unknown})
 *   3. DISORDER     — clinical condition(s) showing this node in this state
 *                     (PubMed-verified; from neuro-disorder-lookup.json)
 *   4. NEURO_TX     — treatments for the disorder
 *                     (verified against PubMed + clinical guidelines)
 *   5. DOMAIN_TX    — what the comparison domain currently does for the analogous issue
 *                     (from domain.activations[].treatments + aggregated/*.deep.json
 *                      + portal.intelligenceCycle.regulate|action|adapt)
 *   6. RESIDUAL     — set-difference between (4) and (5) — the discovery
 *                     • NEURO_TO_DOMAIN: treatments neurology has that the domain hasn't tried
 *                     • DOMAIN_TO_NEURO: interventions the domain has that neuroscience hasn't analoged
 *
 * Every claim carries a verification verdict from the Main Brain
 * verification organ. Unverified or fabricated claims do NOT propagate
 * to residuals. Theoretical claims (analogies that can't be empirically
 * verified) are surfaced explicitly as analogies, never dressed up as facts.
 *
 * The comparison domain is PARAMETRIC. Today populated:
 *   business, economy, industry, agriculture, trade, defense, communication,
 *   education, culture, medicine (and 18 more L1 templates per audit).
 * Tomorrow (operator stated direction): environment, population, weather.
 * Each new comparison domain plugs into the same cube with the same shape.
 *
 * Six gating dimensions decide WHEN a cell surfaces in the operator's view
 * or in engine consumption:
 *   - phase           (P0–P10 lifecycle from financialHealth.dominantPhase
 *                      and brain-node-map.phase_archetype)
 *   - salience        (compositeScore 0–1)
 *   - state           (_activeConditions match in the domain)
 *   - readiness       (engine fireScore from _master-inbox)
 *   - distressBand    (green/yellow/red)
 *   - bindingStrength (0–1 portal × node binding confidence)
 *
 * NO field invents data. Every populated value carries SourceProvenance
 * pointing back to its origin file + JSON path + upstream SHA at retrieval.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const SCHEMA_VERSION = '1.0.0';

export const STATE_BUCKETS = Object.freeze([
  'hyperactive',
  'hypoactive',
  'regulated',
  'mixed',
  'unknown',
]);

/**
 * Treatment ontology. Wide enough to cover both neurology and every comparison
 * domain (regulatory, structural, environmental, etc.) without forcing one
 * domain's vocabulary onto another.
 */
export const TREATMENT_TYPES = Object.freeze([
  'PHARMACOLOGICAL', //  drugs, biologics
  'BEHAVIORAL', //       therapy, training, drills, habit change
  'ENERGETIC', //        DBS, TMS, ECT, light therapy, ultrasound
  'SOCIAL', //           support groups, family-systems, community
  'REGULATORY', //       antitrust, oversight, consent decrees
  'STRUCTURAL', //       organizational, infrastructural, supply-chain
  'DIAGNOSTIC', //       detection / monitoring (not curative but enabling)
  'ENVIRONMENTAL', //    setting / context / habitat change
  'CAPITAL', //          financial restructuring, covenant rewrite
  'INFORMATIONAL', //    disclosure, transparency, signal-design
]);

export const VERDICT_TYPES = Object.freeze([
  'VERIFIED', //         claim checked against authoritative source, passes
  'DISPUTED', //         claim checked, contradicted by source
  'THEORETICAL', //      claim is an analogy / mapping; not empirically testable
  'UNVERIFIABLE', //     claim is empirical in principle but source unavailable
  'FABRICATED', //       claim was invented (e.g. citation doesn't exist)
  'PENDING', //          not yet checked
]);

export const COMPARISON_DOMAINS = Object.freeze([
  // Densely populated today (per audit Part 2)
  'business',
  'economy',
  'industry',
  'agriculture',
  'trade',
  'defense',
  'communication',
  'education',
  'culture',
  'medicine',
  // 18 more L1 templates in assets/data/domains/ — enumerated at load time
  // Operator-stated future direction:
  'environment',
  'population',
  'weather',
]);

export const RELATIONSHIP_TYPES = Object.freeze([
  'suppliers',
  'customers',
  'competitors',
  'regulators',
  'auditor',
  'capitalProviders',
  'executives',
  'logisticsPartners',
]);

export const RESIDUAL_DIRECTIONS = Object.freeze([
  'NEURO_TO_DOMAIN', //  treatment in neuroscience absent in the comparison domain
  'DOMAIN_TO_NEURO', //  intervention in the domain absent in neuroscience
]);

// ============================================================================
// TOP-LEVEL CUBE
// ============================================================================

/**
 * @typedef {Object} DiscoveryCube
 * @property {string} schemaVersion
 * @property {string} builtAt              ISO timestamp of cube build
 * @property {string} kernelShaLock        upstream commit SHA at retrieval
 * @property {CubeStats} stats
 * @property {DiscoveryCell[]} cells
 * @property {IssueIndex} issueIndex       entry-by-issue navigation
 * @property {NodeIndex} nodeIndex         entry-by-node navigation
 * @property {DisorderIndex} disorderIndex entry-by-disorder navigation
 * @property {string[]} loadedComparisonDomains
 * @property {Object} unverifiedClaimsCount per claim type
 */

/**
 * @typedef {Object} CubeStats
 * @property {number} totalCells
 * @property {number} populatedCells       cells with at least one issue + one treatment
 * @property {number} cellsWithResiduals
 * @property {number} cellsWithDisputedClaims
 * @property {Object<string, number>} perDomainBreakdown
 * @property {Object<string, number>} perNodeBreakdown
 * @property {Object<string, number>} perStateBreakdown
 * @property {Object<string, number>} perVerdictBreakdown
 */

// ============================================================================
// CELL
// ============================================================================

/**
 * @typedef {Object} DiscoveryCell
 * @property {string} cellId               `${brainNodeId}__${stateBucket}__${comparisonDomain}`
 * @property {string} brainNodeId          from 124-node taxonomy
 * @property {string} stateBucket          STATE_BUCKETS member
 * @property {string} comparisonDomain     COMPARISON_DOMAINS member
 *
 * Step 2 — Node identity:
 * @property {NodeProfile|null} node
 *
 * Step 1 — Issues entering this cell:
 * @property {Issue[]} issues
 *
 * Step 3 — Clinical disorders for (node × state):
 * @property {Disorder[]} disorders
 *
 * Step 4 — Neurology treatments for those disorders:
 * @property {Treatment[]} neuroTreatments
 *
 * Step 5 — Comparison-domain playbook for the analogous issue:
 * @property {Treatment[]} domainTreatments
 *
 * Step 6 — The discovery (set-difference both directions):
 * @property {Residual[]} residuals
 *
 * Bindings + propagation:
 * @property {Binding[]} portalBindings
 * @property {Affinity[]} crossDomainAffinities
 *
 * Audit + gating:
 * @property {SourceProvenance[]} sourceProvenance
 * @property {VerificationProfile} verification
 * @property {GatingProfile} gating
 *
 * Metadata:
 * @property {string} lastBuiltAt
 * @property {string[]} buildWarnings      non-fatal issues during pivot
 */

/**
 * @typedef {Object} NodeProfile
 * @property {string} brainNodeId
 * @property {string} region               e.g. "Basal Ganglia (indirect pathway)"
 * @property {string} abbreviation         e.g. "BG"
 * @property {string} network              e.g. "Motor / Action-Selection"
 * @property {string[]} limen_phase        e.g. ["P3", "P7"]
 * @property {string} functional_role      gatekeeper|signal_detector|amplifier|router|...
 * @property {string} function             prose normal-function description
 * @property {string} dysregulationProse   raw text from brain-node-business-mapping.json
 *                                        (historically brain-nodes-111.json, now DEPRECATED
 *                                        as a taxonomy source — see PROTECTED_FILES.md)
 * @property {string[]} communicatesWith   other node abbreviations
 * @property {Object} sourceProvenance     where this profile came from
 */

// ============================================================================
// STEP 1 — ISSUE
// ============================================================================

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} symptom              one-line symptom description
 * @property {'warningSignal'|'opportunitySignal'|'diagnosticTrigger'|'intelligenceCycle.diagnosis'|'deep.json'|'commercializationStatus'} sourceType
 * @property {string} sourceFile           relative path
 * @property {string} sourcePath           JSON path within file
 * @property {string|null} portalSlug      set when portal-sourced
 * @property {string|null} domainId        set when domain-sourced
 * @property {'low'|'medium'|'high'|null} severity
 * @property {string[]} sourceFilingTypes  ["10-K", "8-K", "earnings_call", ...]
 * @property {string[]} citations
 * @property {VerificationVerdict} verification
 */

// ============================================================================
// STEP 3 — DISORDER
// ============================================================================

/**
 * @typedef {Object} Disorder
 * @property {string} id
 * @property {string} name                 "Parkinson's disease"
 * @property {string} icd10                "G20"
 * @property {string} mechanism            "BG indirect pathway hyperactivation"
 * @property {string[]} primaryNodesAffected   additional brain-node IDs
 * @property {string[]} pubmedPmids
 * @property {string[]} citations          full citation strings
 * @property {VerificationVerdict} verification
 * @property {Object} sourceProvenance
 */

// ============================================================================
// STEPS 4 + 5 — TREATMENT
// ============================================================================

/**
 * @typedef {Object} Treatment
 * @property {string} id
 * @property {string} name                 "Levodopa" | "Antitrust consent decree"
 * @property {string} type                 TREATMENT_TYPES member
 * @property {string} mechanism            how it acts on the node or system
 * @property {'STRONG'|'MODERATE'|'WEAK'|'THEORETICAL'} evidenceGrade
 * @property {string} description
 * @property {string[]} steps              ordered intervention steps
 * @property {string} monitoring           how outcome is tracked
 * @property {string} escalation           if it fails
 * @property {'node-direct'|'upstream'|'downstream'|'system-wide'|'unknown'} target
 * @property {string|null} appliesToDisorderId  set for neuroTreatments
 * @property {string|null} appliesToIssueId     set for domainTreatments
 * @property {string[]} citations
 * @property {'neurology'|string} side     side === comparisonDomain for domainTreatments
 * @property {Object} sourceProvenance
 * @property {VerificationVerdict} verification
 */

// ============================================================================
// STEP 6 — RESIDUAL (the discovery)
// ============================================================================

/**
 * @typedef {Object} Residual
 * @property {string} id
 * @property {'NEURO_TO_DOMAIN'|'DOMAIN_TO_NEURO'} direction
 * @property {Treatment} sourceTreatment   the treatment that the source side HAS
 * @property {string} candidatePort        prose proposal for the analog on the other side
 * @property {string} rationale            why this transfer is principled (mechanism-grounded)
 * @property {string[]} priorArtChecked    URLs / queries searched to test novelty
 * @property {number} noveltyScore         0–1, higher = less prior art
 * @property {number} feasibilityScore     0–1, can existing infrastructure support it
 * @property {string[]} hypothesizedSteps  operational steps to test the port
 * @property {string[]} monitoringSignals  what would tell you it's working
 * @property {string[]} contraindications  when NOT to try this transfer
 * @property {VerificationVerdict} verification
 * @property {Object} sourceProvenance
 */

// ============================================================================
// BINDING + AFFINITY
// ============================================================================

/**
 * @typedef {Object} Binding
 * @property {string} portalSlug
 * @property {string} entityName
 * @property {string} relationshipType     RELATIONSHIP_TYPES member
 * @property {string} role                 e.g. "Brand & Identity"
 * @property {string} relationshipNote
 * @property {'high'|'medium'|'low'} confidence
 * @property {string[]} sourceType         filing types
 * @property {number} bindingStrength      0–1
 * @property {VerificationVerdict} verification
 */

/**
 * @typedef {Object} Affinity
 * @property {string} toDomain             other comparison domain
 * @property {string} toRole               role text at the other end
 * @property {boolean} reciprocal          does the destination affirm this back?
 * @property {string|null} sourceCellId    cell that owns the other end (set if found)
 * @property {VerificationVerdict} verification
 */

// ============================================================================
// PROVENANCE + VERIFICATION
// ============================================================================

/**
 * Every populated value MUST carry a SourceProvenance entry. Cells that
 * fail this attestation are flagged in buildWarnings.
 *
 * @typedef {Object} SourceProvenance
 * @property {string} field                cell field this provenance attests
 * @property {string} sourceFile           relative path from repo root
 * @property {string} sourcePath           JSON path within file (or "html:#selector")
 * @property {string} retrievedAt          ISO
 * @property {string|null} retrievedFromSha
 */

/**
 * @typedef {Object} VerificationProfile
 * @property {number} verifiedClaimCount
 * @property {number} disputedClaimCount
 * @property {number} theoreticalClaimCount
 * @property {number} unverifiableClaimCount
 * @property {number} fabricatedClaimCount
 * @property {number} pendingClaimCount
 * @property {number} percentVerified      0–1
 * @property {string|null} lastVerifiedAt
 * @property {string[]} verifiers          ["pubmed","edgar","websearch","rule-based","manual"]
 */

/**
 * @typedef {Object} VerificationVerdict
 * @property {'VERIFIED'|'DISPUTED'|'THEORETICAL'|'UNVERIFIABLE'|'FABRICATED'|'PENDING'} verdict
 * @property {string} verifier
 * @property {string[]} evidence           URLs, PMIDs, accession numbers
 * @property {number} confidence           0–1
 * @property {string|null} checkedAt
 * @property {string} note                 human-readable explanation
 */

// ============================================================================
// GATING — when this cell surfaces
// ============================================================================

/**
 * @typedef {Object} GatingProfile
 * @property {string[]} phase              P0–P10 phases where cell is salient
 * @property {number} salienceFloor        min compositeScore (0–1)
 * @property {string[]} activeConditions   _activeConditions required
 * @property {number} readinessFloor       min fireScore for engine consumption
 * @property {string[]} distressBands      ["green","yellow","red"]
 * @property {number} bindingStrengthFloor 0–1
 * @property {string[]} suppressIfPhases   phases that suppress (e.g. P0 too early)
 */

// ============================================================================
// INDEXES
// ============================================================================

/**
 * @typedef {Object} IssueIndex
 * @property {Object<string,string>} byIssueId         { [issueId]: cellId }
 * @property {Object<string,string[]>} byPortalSlug    { [slug]: cellId[] }
 * @property {Object<string,string[]>} byDomainId      { [domainId]: cellId[] }
 * @property {Object<string,string[]>} byKeyword       { [kw]: cellId[] }
 */

/**
 * @typedef {Object} NodeIndex
 * @property {Object<string,string[]>} byNodeId
 * @property {Object<string,string[]>} byNetwork
 * @property {Object<string,string[]>} byPhase
 */

/**
 * @typedef {Object} DisorderIndex
 * @property {Object<string,string[]>} byDisorderName
 * @property {Object<string,string[]>} byIcd10
 * @property {Object<string,string[]>} byMechanism
 */

// ============================================================================
// FACTORIES
// ============================================================================

/**
 * Create an empty cell stub with all required fields populated to defaults.
 * Used by the pivot organ when initializing the cube.
 *
 * @param {Object} args
 * @param {string} args.brainNodeId
 * @param {string} args.stateBucket    STATE_BUCKETS member
 * @param {string} args.comparisonDomain
 * @returns {DiscoveryCell}
 */
export function makeEmptyCell({ brainNodeId, stateBucket, comparisonDomain }) {
  if (!STATE_BUCKETS.includes(stateBucket)) {
    throw new Error(`stateBucket must be one of ${STATE_BUCKETS.join(',')}, got ${stateBucket}`);
  }
  return {
    cellId: `${brainNodeId}__${stateBucket}__${comparisonDomain}`,
    brainNodeId,
    stateBucket,
    comparisonDomain,
    node: null,
    issues: [],
    disorders: [],
    neuroTreatments: [],
    domainTreatments: [],
    residuals: [],
    portalBindings: [],
    crossDomainAffinities: [],
    sourceProvenance: [],
    verification: {
      verifiedClaimCount: 0,
      disputedClaimCount: 0,
      theoreticalClaimCount: 0,
      unverifiableClaimCount: 0,
      fabricatedClaimCount: 0,
      pendingClaimCount: 0,
      percentVerified: 0,
      lastVerifiedAt: null,
      verifiers: [],
    },
    gating: {
      phase: [],
      salienceFloor: 0,
      activeConditions: [],
      readinessFloor: 0,
      distressBands: [],
      bindingStrengthFloor: 0,
      suppressIfPhases: [],
    },
    lastBuiltAt: null,
    buildWarnings: [],
  };
}

/**
 * Make a PENDING verdict — every newly attached claim starts here. The
 * verification organ later promotes to VERIFIED / DISPUTED / etc.
 *
 * @param {string} verifier
 * @returns {VerificationVerdict}
 */
export function makePendingVerdict(verifier = 'pending') {
  return {
    verdict: 'PENDING',
    verifier,
    evidence: [],
    confidence: 0,
    checkedAt: null,
    note: '',
  };
}

/**
 * Make a SourceProvenance entry. Every populated value MUST attach one.
 *
 * @param {Object} args
 * @param {string} args.field
 * @param {string} args.sourceFile
 * @param {string} args.sourcePath
 * @param {string|null} [args.retrievedFromSha]
 * @returns {SourceProvenance}
 */
export function makeProvenance({ field, sourceFile, sourcePath, retrievedFromSha = null }) {
  return {
    field,
    sourceFile,
    sourcePath,
    retrievedAt: new Date().toISOString(),
    retrievedFromSha,
  };
}

/**
 * Validate a cell against the schema. Returns array of errors (empty = valid).
 *
 * @param {DiscoveryCell} cell
 * @returns {string[]}
 */
export function validateCell(cell) {
  const errors = [];
  if (!cell.cellId) errors.push('missing cellId');
  if (!cell.brainNodeId) errors.push('missing brainNodeId');
  if (!STATE_BUCKETS.includes(cell.stateBucket)) {
    errors.push(`invalid stateBucket: ${cell.stateBucket}`);
  }
  if (!cell.comparisonDomain) errors.push('missing comparisonDomain');
  if (!Array.isArray(cell.issues)) errors.push('issues must be array');
  if (!Array.isArray(cell.disorders)) errors.push('disorders must be array');
  if (!Array.isArray(cell.neuroTreatments)) errors.push('neuroTreatments must be array');
  if (!Array.isArray(cell.domainTreatments)) errors.push('domainTreatments must be array');
  if (!Array.isArray(cell.residuals)) errors.push('residuals must be array');

  // Every treatment must have appliesToDisorderId (neuro) or appliesToIssueId (domain)
  cell.neuroTreatments?.forEach((tx, i) => {
    if (!tx.appliesToDisorderId) {
      errors.push(`neuroTreatments[${i}] missing appliesToDisorderId`);
    }
    if (tx.side !== 'neurology') {
      errors.push(`neuroTreatments[${i}].side must be "neurology"`);
    }
  });
  cell.domainTreatments?.forEach((tx, i) => {
    if (tx.side === 'neurology') {
      errors.push(`domainTreatments[${i}].side cannot be "neurology"`);
    }
  });

  // Every residual must reference both sides
  cell.residuals?.forEach((r, i) => {
    if (!RESIDUAL_DIRECTIONS.includes(r.direction)) {
      errors.push(`residuals[${i}] invalid direction: ${r.direction}`);
    }
    if (!r.sourceTreatment) {
      errors.push(`residuals[${i}] missing sourceTreatment`);
    }
  });

  return errors;
}

/**
 * Compute aggregate verification profile from a cell's individual verdicts.
 *
 * @param {DiscoveryCell} cell
 * @returns {VerificationProfile}
 */
export function recomputeVerificationProfile(cell) {
  const tally = {
    VERIFIED: 0,
    DISPUTED: 0,
    THEORETICAL: 0,
    UNVERIFIABLE: 0,
    FABRICATED: 0,
    PENDING: 0,
  };
  const verifiers = new Set();
  let lastChecked = null;

  const walk = (item) => {
    const v = item?.verification;
    if (!v) return;
    if (tally[v.verdict] !== undefined) tally[v.verdict]++;
    if (v.verifier) verifiers.add(v.verifier);
    if (v.checkedAt && (!lastChecked || v.checkedAt > lastChecked)) {
      lastChecked = v.checkedAt;
    }
  };

  cell.issues.forEach(walk);
  cell.disorders.forEach(walk);
  cell.neuroTreatments.forEach(walk);
  cell.domainTreatments.forEach(walk);
  cell.residuals.forEach(walk);
  cell.portalBindings.forEach(walk);
  cell.crossDomainAffinities.forEach(walk);

  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  const percentVerified = total ? tally.VERIFIED / total : 0;

  return {
    verifiedClaimCount: tally.VERIFIED,
    disputedClaimCount: tally.DISPUTED,
    theoreticalClaimCount: tally.THEORETICAL,
    unverifiableClaimCount: tally.UNVERIFIABLE,
    fabricatedClaimCount: tally.FABRICATED,
    pendingClaimCount: tally.PENDING,
    percentVerified,
    lastVerifiedAt: lastChecked,
    verifiers: Array.from(verifiers),
  };
}
