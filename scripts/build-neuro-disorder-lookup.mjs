#!/usr/bin/env node
/**
 * build-neuro-disorder-lookup.mjs
 *
 * Builds the structured (brainNodeId × stateBucket → disorder + treatment)
 * lookup table that feeds STEP 3 of the operator's treatment-discovery chain:
 *
 *   ISSUE → NODE → DISORDER ← us → NEURO_TX → DOMAIN_TX → RESIDUAL
 *
 * Three input sources, decreasing structure:
 *   1. bridge-patterns.json (FULLY STRUCTURED, 15 nodes)
 *      - neural.region, neural.state, neural.mechanism,
 *        neural.knownTreatments[], neural.clinicalReferences[]
 *   2. brain-node-business-mapping.json (PROSE, 124 nodes)
 *      - dysregulation: "Hyperactive → X, Y, Z. Hypoactive → A, B, C."
 *      - function, network, phase, business
 *   3. brain-nodes-111.json (PROSE, 129 entries, partial overlap with #2)
 *      - dysregulation prose with similar structure
 *
 * Every claim emitted carries verification: PENDING. Task #33 (Main Brain
 * verification organ) later promotes claims to VERIFIED / DISPUTED /
 * THEORETICAL / FABRICATED via PubMed lookup.
 *
 * Output: assets/data/neuro-disorder-lookup.json
 *   {
 *     schemaVersion, generatedAt, sources, stats,
 *     nodes: {
 *       [brainNodeId]: {
 *         metadata: {region, network, phase, function},
 *         states: {
 *           hyperactive: { disorders: [...], treatments: [...], mechanism, citations[] },
 *           hypoactive:  { ... },
 *           lesion:      { ... },
 *           atrophy:     { ... },
 *           regulated:   { ... }
 *         }
 *       }
 *     }
 *   }
 *
 * Usage: node scripts/build-neuro-disorder-lookup.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makePendingVerdict } from '../assets/data/schemas/treatment-discovery-cell.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TAXONOMY_FILE = path.join(ROOT, 'assets/data/brain-node-business-mapping.json');
const NODES_111_FILE = path.join(ROOT, 'assets/data/brain-nodes-111.json');
const BRIDGES_FILE = path.join(ROOT, 'assets/data/bridge-patterns.json');
const OUTPUT_FILE = path.join(ROOT, 'assets/data/neuro-disorder-lookup.json');

// ============================================================================
// STATE LABEL PARSING — dysregulation prose follows a small set of patterns
// ============================================================================

/**
 * Maps free-form dysregulation prefixes to STATE_BUCKETS-aligned labels.
 * We use a wider taxonomy here than STATE_BUCKETS (which is the cube's bucket
 * set) because raw neurology has lesion / atrophy / degeneration as
 * distinct conditions; the pivot organ folds these into stateBuckets.
 */
const STATE_PREFIX_MAP = {
  hyperactive: 'hyperactive',
  hyperactivity: 'hyperactive',
  hyperreactive: 'hyperactive',
  hyperreactivity: 'hyperactive',
  hyperresponsive: 'hyperactive',
  hyperarousal: 'hyperactive',
  hypoactive: 'hypoactive',
  hypoactivity: 'hypoactive',
  hyporeactive: 'hypoactive',
  hyporesponsive: 'hypoactive',
  lesion: 'lesion',
  damage: 'lesion',
  injury: 'lesion',
  atrophy: 'atrophy',
  degeneration: 'atrophy',
  degenerated: 'atrophy',
  tumor: 'tumor',
  inflammation: 'inflammation',
  imbalance: 'mixed',
  dysregulation: 'mixed',
  'low hrv': 'hypoactive',
  'high hrv': 'hyperactive',
  blockade: 'blocked',
  depletion: 'hypoactive',
  excess: 'hyperactive',
  reduced: 'hypoactive',
  elevated: 'hyperactive',
  chronic: 'mixed',
};

/**
 * Cube state-bucket folding. The lookup table emits the wider raw-state
 * labels; pivot organ collapses to the cube's 5-bucket set.
 */
const STATE_BUCKET_FOLD = {
  hyperactive: 'hyperactive',
  hypoactive: 'hypoactive',
  lesion: 'mixed', // lesion can disinhibit some pathways and silence others
  atrophy: 'hypoactive',
  tumor: 'mixed',
  inflammation: 'mixed',
  mixed: 'mixed',
  blocked: 'hypoactive',
  regulated: 'regulated',
};

/**
 * Parse a dysregulation prose string into structured state → consequences.
 *
 * Examples accepted:
 *   "Hyperactive → compulsive seeking, addiction. Hypoactive → anhedonia, depression."
 *   "Atrophy → Alzheimer's. Hyperactive → intrusive recall, PTSD flashback."
 *   "Low HRV → cardiovascular risk. Imbalance → arrhythmia."
 *
 * Returns array of { rawState, stateBucket, consequencesProse, items[] }.
 */
function parseDysregulationProse(prose) {
  if (!prose || typeof prose !== 'string') return [];

  // Normalize separators — "→", "->", ":", "→" variants
  let normalized = prose
    .replace(/[—→]+/g, '→')
    .replace(/\s*->\s*/g, '→')
    .trim();

  // Insert a period before any state keyword that follows non-period content.
  // Handles two-source concatenation like "...psychosis Hyperactive → ..." where
  // the second clause has no preceding ".".
  const stateKeywords =
    'Hyperactive|Hypoactive|Hyperreactive|Hyporeactive|Hyperarousal|Atrophy|Lesion|Tumor|Imbalance|Inflammation|Dysregulation|Damage|Injury|Degeneration|Depletion|Excess|Blockade|Reduced|Elevated|Chronic|Low\\s+HRV|High\\s+HRV';
  normalized = normalized.replace(
    new RegExp(`([^.!?\\s])\\s+(${stateKeywords})\\b`, 'g'),
    '$1. $2'
  );

  // Split into clauses on ". " (sentence ends)
  const clauses = normalized
    .split(/\.\s+|;\s+/)
    .map((s) => s.replace(/\.\s*$/, '').trim())
    .filter(Boolean);

  const out = [];
  for (const clause of clauses) {
    const arrowIdx = clause.indexOf('→');
    if (arrowIdx === -1) continue;

    const head = clause.substring(0, arrowIdx).trim().toLowerCase();
    const tail = clause.substring(arrowIdx + 1).trim();

    // Resolve state prefix
    let bucket = null;
    let rawState = head;
    for (const [prefix, mapped] of Object.entries(STATE_PREFIX_MAP)) {
      if (head.startsWith(prefix) || head === prefix) {
        bucket = STATE_BUCKET_FOLD[mapped] || mapped;
        rawState = prefix;
        break;
      }
    }
    if (!bucket) continue;

    // Split consequences on comma. Keep punctuation/citation noise intact;
    // verification organ cleans further.
    const items = tail
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    out.push({
      rawState,
      stateBucket: bucket,
      consequencesProse: tail,
      items,
    });
  }

  return out;
}

// ============================================================================
// BRIDGE PATTERN INTAKE — fully structured cells for 15 nodes
// ============================================================================

/**
 * Bridge-pattern neural blocks already carry:
 *   - region (brainNodeId)
 *   - state (raw label like "tonic_hyperactivation")
 *   - mechanism (verified-prone prose)
 *   - knownTreatments[]
 *   - clinicalReferences[]
 *
 * This intake routes the bridge pattern into the lookup table as the
 * highest-quality cell. State name is folded to STATE_BUCKETS.
 */
function bridgeStateToBucket(rawState) {
  if (!rawState) return 'unknown';
  const s = rawState.toLowerCase();
  if (s.includes('hyperactivation') || s.includes('hyperreactivity') || s.includes('hyperactive') || s.includes('elevation') || s.includes('hyperactivity')) return 'hyperactive';
  if (s.includes('hypoactivation') || s.includes('hypoactive') || s.includes('loss')) return 'hypoactive';
  if (s.includes('dominance') || s.includes('disruption')) return 'mixed';
  if (s.includes('failure') || s.includes('blindness') || s.includes('distort')) return 'mixed';
  if (s.includes('regulated')) return 'regulated';
  if (s.includes('dysregulation')) return 'mixed';
  return 'unknown';
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log('[neuro-disorder-lookup] starting build');

  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf-8'));
  const nodes111Raw = JSON.parse(fs.readFileSync(NODES_111_FILE, 'utf-8'));
  const bridges = JSON.parse(fs.readFileSync(BRIDGES_FILE, 'utf-8'));

  // Normalize nodes-111: file is an array; index by abbreviation
  const nodes111 = {};
  if (Array.isArray(nodes111Raw)) {
    for (const n of nodes111Raw) {
      const id = n.abbreviation || n.id || n.region;
      if (id) nodes111[id] = n;
    }
  } else {
    Object.assign(nodes111, nodes111Raw);
  }

  const allNodeIds = new Set([...Object.keys(taxonomy), ...Object.keys(nodes111)]);
  console.log(`[neuro-disorder-lookup] node ids: ${allNodeIds.size}`);
  console.log(`[neuro-disorder-lookup] bridge patterns: ${bridges.patterns?.length || 0}`);

  const lookup = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    sources: {
      taxonomy: 'assets/data/brain-node-business-mapping.json',
      nodes111: 'assets/data/brain-nodes-111.json',
      bridges: 'assets/data/bridge-patterns.json',
    },
    note:
      "STEP 3 of the treatment-discovery chain. Disorders + neuro-treatments per (brainNodeId × stateBucket). Bridge-pattern cells are fully structured with citations. Other cells parsed from dysregulation prose; verification: PENDING — task #33 PubMed-verifies each disorder + treatment.",
    stats: {
      totalNodes: 0,
      bridgeStructuredCells: 0,
      proseParsedCells: 0,
      emptyCells: 0,
      totalDisorders: 0,
      totalTreatments: 0,
    },
    nodes: {},
  };

  // Pass 1 — pull bridge-pattern cells (highest quality)
  const bridgeCells = new Map(); // `${nodeId}|${bucket}` → {...}
  for (const pat of bridges.patterns || []) {
    const nodeId = pat.neural?.region;
    if (!nodeId) continue;
    const bucket = bridgeStateToBucket(pat.neural.state);
    if (bucket === 'unknown') continue;
    const key = `${nodeId}|${bucket}`;
    if (!bridgeCells.has(key)) {
      bridgeCells.set(key, {
        nodeId,
        bucket,
        rawState: pat.neural.state,
        mechanism: pat.neural.mechanism,
        knownTreatments: pat.neural.knownTreatments || [],
        clinicalReferences: pat.neural.clinicalReferences || [],
        bridgePatternId: pat.id,
      });
    }
  }

  // Pass 2 — walk every node and emit cells per state bucket
  for (const nodeId of [...allNodeIds].sort()) {
    const tx = taxonomy[nodeId];
    const n111 = nodes111[nodeId];

    const meta = {
      region: tx?.region || n111?.region || null,
      network: tx?.network || n111?.network || null,
      phase: tx?.phase || n111?.limen_phase || null,
      function: tx?.function || n111?.function || null,
      business: tx?.business || null,
    };

    const node = {
      brainNodeId: nodeId,
      metadata: meta,
      states: {},
    };

    // Combine dysregulation prose from both sources
    const dysProse =
      [tx?.dysregulation, n111?.dysregulation]
        .filter(Boolean)
        .join(' ') || '';

    const parsed = parseDysregulationProse(dysProse);

    // Group parsed entries by stateBucket
    const proseByBucket = {};
    for (const p of parsed) {
      if (!proseByBucket[p.stateBucket]) proseByBucket[p.stateBucket] = [];
      proseByBucket[p.stateBucket].push(p);
    }

    // Emit cells for each bucket present (either bridge-structured or prose-parsed)
    const allBuckets = new Set([
      ...Object.keys(proseByBucket),
      ...[...bridgeCells.keys()]
        .filter((k) => k.startsWith(nodeId + '|'))
        .map((k) => k.split('|')[1]),
    ]);

    for (const bucket of allBuckets) {
      const bridgeCell = bridgeCells.get(`${nodeId}|${bucket}`);
      const proseEntries = proseByBucket[bucket] || [];

      const cell = {
        stateBucket: bucket,
        rawStateLabels: [
          ...(bridgeCell ? [bridgeCell.rawState] : []),
          ...proseEntries.map((e) => e.rawState),
        ],
        mechanism: bridgeCell?.mechanism || null,
        bridgePatternId: bridgeCell?.bridgePatternId || null,
        disorders: [],
        treatments: [],
        clinicalReferences: bridgeCell?.clinicalReferences || [],
        provenance: {
          fromBridgePattern: !!bridgeCell,
          fromDysregulationProse: proseEntries.length > 0,
          dysregulationSourceText: proseEntries
            .map((e) => `${e.rawState} → ${e.consequencesProse}`)
            .join(' || '),
        },
      };

      // Emit disorders from prose
      const seen = new Set();
      for (const p of proseEntries) {
        for (const item of p.items) {
          const trimmed = item.replace(/[.,;]+$/, '').trim();
          if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
          seen.add(trimmed.toLowerCase());
          cell.disorders.push({
            id: `${nodeId}-${bucket}-${slug(trimmed)}`,
            name: trimmed,
            icd10: null, // verifier fills
            mechanism: cell.mechanism || `Associated with ${bucket} ${meta.region || nodeId}`,
            primaryNodesAffected: [nodeId],
            pubmedPmids: [],
            citations: [],
            verification: makePendingVerdict('pubmed'),
            sourceProvenance: {
              field: 'disorder.name',
              sourceFile: tx?.dysregulation
                ? 'assets/data/brain-node-business-mapping.json'
                : 'assets/data/brain-nodes-111.json',
              sourcePath: `$.${nodeId}.dysregulation`,
              retrievedAt: new Date().toISOString(),
              retrievedFromSha: null,
            },
          });
        }
      }

      // Emit treatments from bridge pattern (only structured source here)
      if (bridgeCell) {
        for (const tx_name of bridgeCell.knownTreatments) {
          cell.treatments.push({
            id: `${nodeId}-${bucket}-${slug(tx_name)}`,
            name: tx_name,
            type: classifyTreatmentType(tx_name),
            mechanism: null,
            evidenceGrade: 'MODERATE',
            description: tx_name,
            steps: [],
            monitoring: null,
            escalation: null,
            target: 'node-direct',
            appliesToDisorderId: null,
            citations: bridgeCell.clinicalReferences,
            side: 'neurology',
            verification: makePendingVerdict('pubmed'),
            sourceProvenance: {
              field: 'treatment.name',
              sourceFile: 'assets/data/bridge-patterns.json',
              sourcePath: `$.patterns[?id=='${bridgeCell.bridgePatternId}'].neural.knownTreatments[*]`,
              retrievedAt: new Date().toISOString(),
              retrievedFromSha: null,
            },
          });
        }
      }

      node.states[bucket] = cell;

      if (bridgeCell) lookup.stats.bridgeStructuredCells++;
      else lookup.stats.proseParsedCells++;
      lookup.stats.totalDisorders += cell.disorders.length;
      lookup.stats.totalTreatments += cell.treatments.length;
    }

    // Always emit a 'regulated' bucket as a placeholder — that's the healthy
    // state with no disorders. Cube will use this for residual orientation
    // ("here's what the node looks like when working right").
    if (!node.states['regulated']) {
      node.states['regulated'] = {
        stateBucket: 'regulated',
        rawStateLabels: ['regulated'],
        mechanism: null,
        bridgePatternId: null,
        disorders: [],
        treatments: [],
        clinicalReferences: [],
        provenance: {
          fromBridgePattern: false,
          fromDysregulationProse: false,
          dysregulationSourceText: '',
        },
      };
    }

    if (Object.keys(node.states).length === 1 && node.states['regulated']) {
      lookup.stats.emptyCells++;
    }

    lookup.nodes[nodeId] = node;
    lookup.stats.totalNodes++;
  }

  // Write output
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(lookup, null, 2));

  // CLI summary
  console.log('');
  console.log('=== NEURO-DISORDER LOOKUP STATS ===');
  console.log(`nodes:                   ${lookup.stats.totalNodes}`);
  console.log(`bridge-structured cells: ${lookup.stats.bridgeStructuredCells}`);
  console.log(`prose-parsed cells:      ${lookup.stats.proseParsedCells}`);
  console.log(`empty (regulated-only):  ${lookup.stats.emptyCells}`);
  console.log(`total disorders extracted: ${lookup.stats.totalDisorders}`);
  console.log(`total treatments extracted: ${lookup.stats.totalTreatments}`);
  console.log('');
  console.log(`wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log('');
  console.log(
    'NOTE: every disorder + treatment has verification: PENDING. Task #33 (Main Brain verification organ) PubMed-verifies each claim + assigns ICD-10 codes.'
  );
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function classifyTreatmentType(name) {
  const n = name.toLowerCase();
  if (n.match(/levodopa|naltrexone|maoi|mao-b|ssri|antagon|agonist|inhibitor|opioid|gaba|nmda|methadone|buprenorphine/))
    return 'PHARMACOLOGICAL';
  if (n.match(/cbt|dbt|emdr|behavior|exposure|therapy|psychotherap|contingency|management|relapse prevention/))
    return 'BEHAVIORAL';
  if (n.match(/tms|dbs|ect|tdcs|ultrasound|stimulation|deep brain|light therapy/))
    return 'ENERGETIC';
  if (n.match(/group|support|family|community|social/)) return 'SOCIAL';
  if (n.match(/exercise|diet|nutrition|sleep|fasting|meditation/)) return 'BEHAVIORAL';
  return 'BEHAVIORAL'; // default for unclassified clinical treatments
}

main();
