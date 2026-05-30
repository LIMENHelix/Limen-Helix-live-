#!/usr/bin/env node
// classify-portal-brain-node-mapping.mjs
//
// Deterministic classifier that produces `brainNodeMapping` for a portal
// by inheriting from its domain archetype + extracting portal-specific
// overrides from existing `functionalNetwork` + `executiveTeam` fields.
//
// Storage model: OVERRIDE-ONLY (per docs/brain-node-mapping-schema.md).
// The portal stores deltas vs the named domain archetype + template
// pointer; the resolver materializes the full 123-node mapping at read
// time. This classifier writes only the delta block.
//
// Usage:
//   node scripts/classify-portal-brain-node-mapping.mjs --slug walmart
//   node scripts/classify-portal-brain-node-mapping.mjs --slug walmart --dry-run
//   node scripts/classify-portal-brain-node-mapping.mjs --all
//   node scripts/classify-portal-brain-node-mapping.mjs --all --dry-run
//
// Exit codes:
//   0  success (all classified; or dry-run printed without errors)
//   1  one or more portals errored
//   2  CLI / IO usage error

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = resolve(__dirname, '..');

const COMPANIES_DIR     = join(REPO_ROOT, 'assets', 'data', 'companies');
const ARCHETYPES_DIR    = join(REPO_ROOT, 'assets', 'data', '_brain-mapping-archetypes');
const COMMAND_BOARD     = join(REPO_ROOT, 'assets', 'data', 'command-board-data.json');

const CLASSIFIER_VERSION = '2.0.0';
const SCHEMA_VERSION     = '1.0.0';
const TEMPLATE_VERSION   = '1.0.0';

// ---------- CLI ----------
function parseArgs(argv) {
  const out = { slug: null, all: false, dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug' && argv[i + 1])  { out.slug = argv[++i]; continue; }
    if (a === '--all')                  { out.all = true; continue; }
    if (a === '--dry-run')              { out.dryRun = true; continue; }
    if (a === '-h' || a === '--help')   { out.help = true; continue; }
  }
  return out;
}

function printUsage() {
  console.log(`
classify-portal-brain-node-mapping.mjs
  Inherit from domain archetype + extract portal-specific brain-node overrides.

Usage:
  node scripts/classify-portal-brain-node-mapping.mjs --slug <slug>
  node scripts/classify-portal-brain-node-mapping.mjs --slug <slug> --dry-run
  node scripts/classify-portal-brain-node-mapping.mjs --all
  node scripts/classify-portal-brain-node-mapping.mjs --all --dry-run

Flags:
  --slug <slug>   Classify a single portal at assets/data/companies/{slug}.json
  --all           Classify every portal under assets/data/companies/
  --dry-run       Print result to stdout; do not write back to the portal file.
  -h, --help      Show this message.
`.trim());
}

// ---------- IO ----------
function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`file not found: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`failed to parse JSON at ${path}: ${e.message}`);
  }
}

function writeJson(path, obj) {
  // 2-space indent + trailing newline matches the rest of the repo.
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ---------- Mapping tables (deterministic) ----------

// Map portal functionalNetwork category -> external `type` per archetype
// vocabulary (see _brain-mapping-archetypes/*.json _meta.external_type_vocabulary).
// executiveTeam is handled separately (internal_override).
const CATEGORY_TO_EXTERNAL_TYPE = {
  suppliers:          'supplier',
  customers:          'customer',
  competitors:        'peer',
  regulators:         'regulator',
  capitalProviders:   'investor',
  auditor:            'auditor',     // singular: object, not array
  auditors:           'auditor',     // tolerate plural alias if seen
  marketSignals:      'market',
  logisticsPartners:  'counterparty',
  // executiveTeam -> internal_override (separate path)
};

// Map portal confidence (high/medium/low) -> override weight scale.
const CONFIDENCE_TO_WEIGHT = {
  high:   'high',
  medium: 'medium',
  low:    'low',
};

// Map common executive titles (substring match, case-insensitive) to
// brain-node + function. v1 rules apply as `internal_override` with
// FIRST-write-wins per node. v2 rules add secondary routes either as
// `internal_override` on a different node (compound roles) or as
// `external_add` (collective oversight signals like board members).
//
// Routing semantics:
//   - PRIMARY rules (v1 + v2 primary slots) emit `internal_override`.
//     The primary table is scanned in order; first match wins and the
//     remaining PRIMARY rules are skipped for that exec. This preserves
//     v1 semantics (e.g. a CEO whose role string also says "president"
//     still resolves to mPFC, not FPN).
//   - SECONDARY rules (v2) emit additional routes per match — they are
//     scanned independently of the primary rule. A role can hit multiple
//     secondary rules (e.g. "General Counsel & Chief Compliance Officer"
//     hits both the GC v1 primary AND the compliance v2 secondary).
//
// `route` field on a rule:
//   'internal_override'  → setInternalOverride (first-write-wins per node)
//   'external_add'       → pushExternalAdd (each match contributes one entry)
const EXECUTIVE_ROLE_TABLE_PRIMARY = [
  // CEO -> mPFC (medial PFC — identity / brand / strategic self)
  { match: /\bchief executive officer\b|\bceo\b|\bpresident & ceo\b|\bpresident and ceo\b/i,
    brainNodeId: 'mPFC',
    functionDesc: 'identity / strategic-self / brand voice' },

  // CFO -> ACC (anterior cingulate — conflict / KPI arbitration / capital allocation)
  { match: /\bchief financial officer\b|\bcfo\b/i,
    brainNodeId: 'ACC',
    functionDesc: 'financial KPI conflict resolution / capital allocation' },

  // COO -> dlPFC (executive control / operations sequencing)
  { match: /\bchief operating officer\b|\bcoo\b/i,
    brainNodeId: 'dlPFC',
    functionDesc: 'operations sequencing / executive control' },

  // CTO -> dlPFC (technical executive control)
  { match: /\bchief technology officer\b|\bcto\b/i,
    brainNodeId: 'dlPFC',
    functionDesc: 'technology executive control' },

  // CIO -> dlPFC (information executive control)
  { match: /\bchief information officer\b|\bcio\b/i,
    brainNodeId: 'dlPFC',
    functionDesc: 'information-systems executive control' },

  // CRO / Chief Risk Officer / General Counsel -> vmPFC
  // (ventromedial PFC — risk + ethics + reputation)
  { match: /\bchief risk officer\b|\bcro\b|\bgeneral counsel\b|\bchief legal officer\b|\bclo\b/i,
    brainNodeId: 'vmPFC',
    functionDesc: 'risk / reputation / legal threat assessment' },

  // CMO -> OFC (orbitofrontal — value/reward signal interpretation)
  { match: /\bchief marketing officer\b|\bcmo\b/i,
    brainNodeId: 'OFC',
    functionDesc: 'brand value / customer-reward signal interpretation' },

  // Chief Compliance Officer -> BLA (basolateral amygdala — threat tagging)
  { match: /\bchief compliance officer\b|\bcco\b/i,
    brainNodeId: 'BLA',
    functionDesc: 'regulatory / compliance threat tagging' },

  // Chief HR / People Officer -> Insula (interoception — workforce signal)
  { match: /\bchief (human resources|people) officer\b|\bchro\b|\bcpo\b/i,
    brainNodeId: 'Insula',
    functionDesc: 'workforce interoception / culture sensing' },

  // Chief Audit Executive / Internal Audit -> AI (anterior insula)
  { match: /\bchief audit\b|\binternal audit\b/i,
    brainNodeId: 'AI',
    functionDesc: 'internal audit / risk sensing' },

  // Board Chair -> FPN (frontoparietal network — executive coordination)
  { match: /\bboard chair\b|\bchairman of the board\b|\bchairwoman\b|\bchairperson\b|\bchairman\b/i,
    brainNodeId: 'FPN',
    functionDesc: 'board governance / executive coordination' },

  // Chief Strategy Officer -> FPN (executive coordination + horizon planning)
  { match: /\bchief strategy officer\b|\bcso\b/i,
    brainNodeId: 'FPN',
    functionDesc: 'strategic coordination / horizon planning' },

  // Generic President (segment / business-unit head) -> FPN
  { match: /\bpresident\b/i,
    brainNodeId: 'FPN',
    functionDesc: 'segment executive coordination' },
];

// v2 SECONDARY rules. Each exec is scanned against every entry; all
// matches contribute. These add basal-ganglia + habenula coverage so
// the L2 inhibitory edges (HAB→VTA, HAB→RAPHE, CAUD→GP, PUT→GP)
// become functional once both endpoints are populated.
const EXECUTIVE_ROLE_TABLE_SECONDARY = [
  // Chief Compliance Officer + variants → CAUD (caudate — goal-directed
  // gating). Distinct from the v1 CCO→BLA route (threat tagging); the
  // CAUD route models compliance as basal-ganglia procedural gating.
  { match: /\bchief compliance officer\b|\bchief compliance\b|\bhead of compliance\b/i,
    brainNodeId: 'CAUD',
    functionDesc: 'compliance procedural gating (basal-ganglia goal-directed)',
    route: 'internal_override' },

  // Compound role: "General Counsel & Chief Compliance Officer" — the
  // v1 GC→vmPFC route already fires via PRIMARY; this also populates
  // CAUD so the compliance side of the compound seat is anchored.
  { match: /\bgeneral counsel\b.*\bcompliance\b|\bgc\b.*\bcompliance\b|\bcompliance\b.*\bgeneral counsel\b/i,
    brainNodeId: 'CAUD',
    functionDesc: 'general-counsel-and-compliance: procedural gating side',
    route: 'internal_override' },

  // Board Chair / Executive Chairman → CMZ (cingulate motor zone —
  // willed action under board oversight). v1 already routes Chair to
  // FPN; v2 adds CMZ to model the willed-action side.
  { match: /\bchairperson\b|\bchairman\b|\bexecutive chairman\b|\bchair of the board\b|\bboard chair\b/i,
    brainNodeId: 'CMZ',
    functionDesc: 'willed action under board oversight (cingulate motor)',
    route: 'internal_override' },

  // Same chair match → HAB external_add. Board oversight is an
  // anti-reward / aversion signal anatomically (lateral habenula gates
  // VTA dopamine + RAPHE serotonin); we model board chair presence as
  // contributing one HAB external entry.
  { match: /\bchairperson\b|\bchairman\b|\bexecutive chairman\b|\bchair of the board\b|\bboard chair\b/i,
    brainNodeId: 'HAB',
    functionDesc: 'board-oversight as anti-reward / aversion signal',
    route: 'external_add' },

  // Board members / directors / trustees → HAB external_add. Each
  // directorship contributes one entry; collective board oversight
  // accumulates. We deliberately exclude director-of-X executive titles
  // (e.g. "Director of Engineering") via the negative lookbehind on
  // "directors" + lookahead on "director".
  { match: /\bboard member\b|\bdirector(?!s)\b(?! of )(?! ,)(?!-)|\btrustee\b/i,
    brainNodeId: 'HAB',
    functionDesc: 'individual board director — anti-reward / aversion signal',
    route: 'external_add' },

  // CHRO / Chief People Officer → RAPHE (serotonergic raphe nucleus
  // — mood/morale regulation). v1 routes the same titles to Insula;
  // v2 adds RAPHE so the HR seat anchors both interoception (Insula)
  // and mood regulation (RAPHE).
  { match: /\bchief hr officer\b|\bchro\b|\bchief people officer\b|\bchief human resources\b/i,
    brainNodeId: 'RAPHE',
    functionDesc: 'workforce mood / morale regulation (serotonergic)',
    route: 'internal_override' },

  // Investor Relations → VTA (ventral tegmental area — reward-signal
  // interface to markets). IR is the dopaminergic projection from the
  // firm to the capital-market reward surface.
  { match: /\bhead of investor relations\b|\bchief investor relations\b|\bsvp investor relations\b|\bir officer\b/i,
    brainNodeId: 'VTA',
    functionDesc: 'investor-relations: reward-signal interface to markets',
    route: 'internal_override' },

  // Procurement / Supply Chain → PUT (putamen — procedural gating of
  // supply-chain motor sequences).
  { match: /\bhead of procurement\b|\bchief procurement\b|\bchief supply chain officer\b|\bcso\b/i,
    brainNodeId: 'PUT',
    functionDesc: 'procurement procedural gating (basal-ganglia motor)',
    route: 'internal_override' },

  // Internal Audit / Chief Audit Executive → GP (globus pallidus —
  // basal-ganglia inhibitory output). v1 already routes to AI; v2
  // adds GP so internal audit anchors both the salience/insula side
  // (AI) and the inhibitory-output side (GP).
  { match: /\bchief audit executive\b|\bhead of internal audit\b|\bchief audit officer\b/i,
    brainNodeId: 'GP',
    functionDesc: 'internal-audit inhibitory output (basal-ganglia GP)',
    route: 'internal_override' },
];

// Resolve a single executive entry into one or more route plans.
// Returns an array (possibly empty). Each entry: {brainNodeId, functionDesc, route}.
// `route` is one of 'internal_override' | 'external_add'.
function classifyExecutive(exec) {
  const role = String(exec.role || '').trim();
  if (!role) return [];
  const routes = [];

  // Primary: first-match-wins (preserves v1 single-route semantics).
  for (const rule of EXECUTIVE_ROLE_TABLE_PRIMARY) {
    if (rule.match.test(role)) {
      routes.push({
        brainNodeId: rule.brainNodeId,
        functionDesc: rule.functionDesc,
        route: 'internal_override',
      });
      break;
    }
  }

  // Secondary: all-matches contribute. May add multiple routes to the
  // same exec without displacing the primary.
  for (const rule of EXECUTIVE_ROLE_TABLE_SECONDARY) {
    if (rule.match.test(role)) {
      routes.push({
        brainNodeId: rule.brainNodeId,
        functionDesc: rule.functionDesc,
        route: rule.route,
      });
    }
  }

  return routes;
}

// ---------- Override extraction ----------

// Push an external_add entry onto overrides[nodeId].
function pushExternalAdd(overrides, nodeId, entry) {
  if (!overrides[nodeId]) overrides[nodeId] = {};
  if (!Array.isArray(overrides[nodeId].external_add)) {
    overrides[nodeId].external_add = [];
  }
  overrides[nodeId].external_add.push(entry);
}

// Set internal_override on overrides[nodeId]. FIRST-write-wins on collision
// (CEO seat is a single chair, and executiveTeam[] is authored top-down by
// rank — the top entry should win). This keeps Doug McMillon at mPFC, not
// the segment president that also matches the CEO regex later in the list.
function setInternalOverride(overrides, nodeId, obj) {
  if (!overrides[nodeId]) overrides[nodeId] = {};
  if (overrides[nodeId].internal_override) return; // first-write-wins
  overrides[nodeId].internal_override = obj;
}

// Process a functionalNetwork array category (suppliers / customers / etc).
// `entries` is the array; `category` is the source category name.
function processArrayCategory(overrides, category, entries) {
  if (!Array.isArray(entries)) return;
  const externalType = CATEGORY_TO_EXTERNAL_TYPE[category];
  if (!externalType) return; // unknown category — skip

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const brainNodeId = e.brainNodeId;
    if (!brainNodeId || typeof brainNodeId !== 'string') continue;

    const name = (e.name || '').trim();
    if (!name) continue;

    const weight = CONFIDENCE_TO_WEIGHT[String(e.confidence || '').toLowerCase()] || 'medium';

    pushExternalAdd(overrides, brainNodeId, {
      name,
      type: externalType,
      weight,
      source: `portal_extracted_functionalNetwork.${category}`,
    });
  }
}

// Process a functionalNetwork object category (auditor is the only known one
// authored as an object rather than an array).
function processObjectCategory(overrides, category, obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  const externalType = CATEGORY_TO_EXTERNAL_TYPE[category];
  if (!externalType) return;
  const brainNodeId = obj.brainNodeId;
  if (!brainNodeId || typeof brainNodeId !== 'string') return;
  const name = (obj.name || '').trim();
  if (!name) return;

  const weight = CONFIDENCE_TO_WEIGHT[String(obj.confidence || '').toLowerCase()] || 'medium';

  pushExternalAdd(overrides, brainNodeId, {
    name,
    type: externalType,
    weight,
    source: `portal_extracted_functionalNetwork.${category}`,
  });
}

// Process the executiveTeam[] -> {internal_override | external_add}
// path. v2 may emit multiple routes per exec; primary route uses
// first-write-wins on internal_override, secondary routes are added
// per their `route` field (internal_override or external_add).
function processExecutiveTeam(overrides, execs) {
  if (!Array.isArray(execs)) return;
  for (const exec of execs) {
    if (!exec || typeof exec !== 'object') continue;
    const routes = classifyExecutive(exec);
    if (!routes || routes.length === 0) continue;
    const incumbent = (exec.name || '').trim();
    const role      = (exec.role || '').trim();
    if (!role) continue;

    for (const r of routes) {
      if (r.route === 'external_add') {
        // Each director / chair entry contributes one external_add
        // record. Weight defaults to 'medium' (exec roles don't carry
        // a `confidence` field in the portal schema).
        pushExternalAdd(overrides, r.brainNodeId, {
          name: incumbent || role,
          type: 'governance',
          weight: 'medium',
          source: 'portal_extracted_functionalNetwork.executiveTeam_board_oversight',
        });
      } else {
        // internal_override — first-write-wins per node.
        setInternalOverride(overrides, r.brainNodeId, {
          role,
          function: r.functionDesc,
          incumbent: incumbent || null,
          source: 'portal_extracted_functionalNetwork.executiveTeam',
        });
      }
    }
  }
}

// v2: route external auditor singleton to GP as an inhibitory gate on
// management discretion. The v1 path already routes the auditor entry
// to its authored brainNodeId (typically BLA) via processObjectCategory;
// this is an ADDITIONAL route, not a replacement.
function processAuditorInhibitoryGate(overrides, auditorObj) {
  if (!auditorObj || typeof auditorObj !== 'object' || Array.isArray(auditorObj)) return;
  const name = (auditorObj.name || '').trim();
  if (!name) return;
  const weight = CONFIDENCE_TO_WEIGHT[String(auditorObj.confidence || '').toLowerCase()] || 'medium';
  pushExternalAdd(overrides, 'GP', {
    name,
    type: 'auditor',
    weight,
    source: 'portal_extracted_functionalNetwork.auditor_inhibitory_gate',
  });
}

// v2: keyword-route regulators[] entries to a SECOND brain node beyond
// the one authored on the entry. v1 already routes to entry.brainNodeId
// via processArrayCategory; this adds CAUD (compliance regulators) or
// HAB (antitrust / competition authorities) overlays.
const REGULATOR_KEYWORD_ROUTES = [
  {
    match: /compliance|enforcement|inspector|audit/i,
    brainNodeId: 'CAUD',
    sourceTag: 'portal_extracted_functionalNetwork.regulators_compliance_overlay',
  },
  {
    match: /comp(?:lit)?(?:ition|etition)\s+authority|antitrust|monopoly/i,
    brainNodeId: 'HAB',
    sourceTag: 'portal_extracted_functionalNetwork.regulators_antitrust_overlay',
  },
];

function processRegulatorOverlays(overrides, regulators) {
  if (!Array.isArray(regulators)) return;
  for (const e of regulators) {
    if (!e || typeof e !== 'object') continue;
    const name = (e.name || '').trim();
    if (!name) continue;
    const weight = CONFIDENCE_TO_WEIGHT[String(e.confidence || '').toLowerCase()] || 'medium';
    for (const rule of REGULATOR_KEYWORD_ROUTES) {
      if (rule.match.test(name)) {
        pushExternalAdd(overrides, rule.brainNodeId, {
          name,
          type: 'regulator',
          weight,
          source: rule.sourceTag,
        });
      }
    }
  }
}

// Build the full overrides block for a portal.
function buildOverrides(portal) {
  const overrides = {};
  const fn = portal.functionalNetwork;
  if (!fn || typeof fn !== 'object') return overrides;

  // Array categories
  for (const cat of [
    'suppliers',
    'customers',
    'competitors',
    'regulators',
    'capitalProviders',
    'marketSignals',
    'logisticsPartners',
    'auditors',          // tolerated plural
  ]) {
    if (Array.isArray(fn[cat])) processArrayCategory(overrides, cat, fn[cat]);
  }

  // Object category (auditor — singular). v1: routes to authored
  // brainNodeId (typically BLA). v2: also routes to GP as an
  // inhibitory gate on management discretion.
  if (fn.auditor && !Array.isArray(fn.auditor)) {
    processObjectCategory(overrides, 'auditor', fn.auditor);
    processAuditorInhibitoryGate(overrides, fn.auditor);
  }

  // v2: regulator keyword overlays (compliance → CAUD, antitrust → HAB).
  // Runs in addition to the v1 array-category route above.
  if (Array.isArray(fn.regulators)) {
    processRegulatorOverlays(overrides, fn.regulators);
  }

  // Executive team -> {internal_override | external_add} path.
  if (Array.isArray(fn.executiveTeam)) {
    processExecutiveTeam(overrides, fn.executiveTeam);
  }

  return overrides;
}

// Count overrides for the source block. An override "counts" if the node
// has either an internal_override or at least one external_add entry.
function countOverrides(overrides) {
  let n = 0;
  for (const [, delta] of Object.entries(overrides)) {
    if (!delta || typeof delta !== 'object') continue;
    if (delta.internal_override) n++;
    if (Array.isArray(delta.external_add) && delta.external_add.length > 0) n++;
    if (Array.isArray(delta.external_replace) && delta.external_replace.length > 0) n++;
  }
  return n;
}

// Assemble the final brainNodeMapping block.
function buildMapping({ template, overrides, generatedAt }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    source: {
      mode: 'classifier_v2',
      template,
      templateVersion: TEMPLATE_VERSION,
      classifierVersion: CLASSIFIER_VERSION,
      generatedAt,
      overrideCount: countOverrides(overrides),
    },
    overrides,
  };
}

// ---------- Per-portal driver ----------

function archetypeExists(domainId) {
  if (!domainId || typeof domainId !== 'string') return false;
  return existsSync(join(ARCHETYPES_DIR, `${domainId}.json`));
}

function classifyPortal(portalPath, { dryRun }) {
  const portal = readJson(portalPath);
  const slug = portal.slug || basename(portalPath, '.json');

  const domainId = portal.domainId;
  if (!domainId) {
    return { slug, status: 'skipped', reason: 'no domainId on portal' };
  }
  if (!archetypeExists(domainId)) {
    return { slug, status: 'skipped', reason: `no archetype template for domain "${domainId}"` };
  }

  const overrides   = buildOverrides(portal);
  const generatedAt = new Date().toISOString();
  const mapping     = buildMapping({
    template: domainId,
    overrides,
    generatedAt,
  });

  if (dryRun) {
    return {
      slug,
      status: 'dry-run',
      domainId,
      overrideCount: mapping.source.overrideCount,
      mapping,
    };
  }

  // Overwrite the brainNodeMapping field (classifier output is not
  // hand-authored; overwrite is the documented re-run behavior).
  portal.brainNodeMapping = mapping;
  writeJson(portalPath, portal);

  return {
    slug,
    status: 'written',
    domainId,
    overrideCount: mapping.source.overrideCount,
    path: portalPath,
  };
}

// ---------- Main ----------
function listAllPortals() {
  if (!existsSync(COMPANIES_DIR)) {
    throw new Error(`companies dir not found: ${COMPANIES_DIR}`);
  }
  return readdirSync(COMPANIES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => join(COMPANIES_DIR, f));
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.slug && !args.all)) {
    printUsage();
    process.exit(args.help ? 0 : 2);
  }

  let paths;
  if (args.slug) {
    paths = [join(COMPANIES_DIR, `${args.slug}.json`)];
  } else {
    paths = listAllPortals();
  }

  let okCount     = 0;
  let skipCount   = 0;
  let errCount    = 0;
  const summaries = [];

  for (const p of paths) {
    try {
      const result = classifyPortal(p, { dryRun: args.dryRun });
      summaries.push(result);
      if (result.status === 'written' || result.status === 'dry-run') okCount++;
      else if (result.status === 'skipped') skipCount++;
    } catch (e) {
      errCount++;
      summaries.push({ slug: basename(p, '.json'), status: 'error', reason: e.message });
    }
  }

  // Single-slug detailed report.
  if (args.slug) {
    const r = summaries[0];
    if (r.status === 'dry-run') {
      console.log(JSON.stringify({
        slug: r.slug,
        domainId: r.domainId,
        overrideCount: r.overrideCount,
        mapping: r.mapping,
      }, null, 2));
    } else if (r.status === 'written') {
      console.log(`[written] ${r.slug}  domain=${r.domainId}  overrides=${r.overrideCount}  -> ${r.path}`);
    } else if (r.status === 'skipped') {
      console.log(`[skipped] ${r.slug}  reason=${r.reason}`);
    } else if (r.status === 'error') {
      console.error(`[error]   ${r.slug}  reason=${r.reason}`);
    }
  } else {
    // Bulk run: short per-portal line + totals.
    for (const r of summaries) {
      if (r.status === 'written') {
        console.log(`[written] ${r.slug}  domain=${r.domainId}  overrides=${r.overrideCount}`);
      } else if (r.status === 'dry-run') {
        console.log(`[dry-run] ${r.slug}  domain=${r.domainId}  overrides=${r.overrideCount}`);
      } else if (r.status === 'skipped') {
        console.log(`[skipped] ${r.slug}  reason=${r.reason}`);
      } else if (r.status === 'error') {
        console.error(`[error]   ${r.slug}  reason=${r.reason}`);
      }
    }
    console.log('');
    console.log(`totals: ok=${okCount}  skipped=${skipCount}  errors=${errCount}  (of ${paths.length} portals)`);
  }

  process.exit(errCount > 0 ? 1 : 0);
}

main();
