#!/usr/bin/env node
// resolve-portal-brain-node-mapping.mjs
//
// Read-time merge that materializes the full brainNodeMapping for a portal
// by combining the domain archetype template with the portal's
// `brainNodeMapping.overrides` block (override-by-key per docs/brain-node-mapping-schema.md §3).
//
// Inputs (mutually exclusive):
//   --slug <slug>     Resolve assets/data/companies/<slug>.json
//   --file <path>     Resolve the portal at <path>
//
// Outputs:
//   (default)         Materialized brainNodeMapping JSON to stdout
//   --out <path>      Write to <path> instead of stdout
//   --summary         Print summary stats only (template, overrides, validation)
//
// Exit codes:
//   0  resolved successfully, validator PASS
//   1  resolved but validator FAILed (violations printed to stderr)
//   2  usage / IO / missing-template error

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = resolve(__dirname, '..');
const REGISTRY_PATH  = join(REPO_ROOT, 'assets', 'data', 'connectome-node-registry.json');
const TEMPLATES_DIR  = join(REPO_ROOT, 'assets', 'data', '_brain-mapping-archetypes');
const COMPANIES_DIR  = join(REPO_ROOT, 'assets', 'data', 'companies');

// Subcategory -> parent canonical-domain map. MUST stay in sync with
// scripts/score-companies.js (SUBCATEGORY_TO_PARENT) and
// assets/data/command-board-data.json._canonical_subcategory_map.
// A portal may carry a sub-domain id (legal/contemplative/health/...) that has
// no archetype template of its own; the template lives under the parent
// (law/religion/medicine). subTag preserves the original for rendering.
const SUBCATEGORY_TO_PARENT = {
  neurology: 'medicine', addiction: 'medicine', psychedelic: 'medicine',
  metabolic: 'medicine', pediatric: 'medicine', health: 'medicine',
  contemplative: 'religion', p2_agri: 'agriculture', legal: 'law',
  research: 'science', supplyChain: 'trade',
};

function canonicalizeDomain(rawDomain) {
  if (!rawDomain) return { domain: '', subTag: null };
  const parent = SUBCATEGORY_TO_PARENT[rawDomain];
  if (parent) return { domain: parent, subTag: rawDomain };
  return { domain: rawDomain, subTag: null };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const out = { slug: null, file: null, outPath: null, summary: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug'    && argv[i + 1]) { out.slug    = argv[++i]; continue; }
    if (a === '--file'    && argv[i + 1]) { out.file    = argv[++i]; continue; }
    if (a === '--out'     && argv[i + 1]) { out.outPath = argv[++i]; continue; }
    if (a === '--summary')                { out.summary = true;       continue; }
    if (a === '-h' || a === '--help')     { out.help    = true;       continue; }
  }
  return out;
}

function printUsage() {
  console.log(`
resolve-portal-brain-node-mapping.mjs
  Materialize the full 123-node brainNodeMapping for a portal by merging
  the domain archetype template with the portal's overrides block.

Usage:
  node scripts/resolve-portal-brain-node-mapping.mjs --slug <slug> [--out <path>] [--summary]
  node scripts/resolve-portal-brain-node-mapping.mjs --file <portal.json> [--out <path>] [--summary]

Flags:
  --slug <slug>     Portal slug under assets/data/companies/<slug>.json
  --file <path>     Path to a portal JSON file
  --out <path>      Write resolved JSON to <path> (default: stdout)
  --summary         Print summary stats only (no full JSON)
  -h, --help        Show this message

Exit codes:
  0  resolved + validator PASS
  1  resolved but validator FAIL
  2  usage / IO / missing-template
`.trim());
}

// ---------- IO ----------
function readJson(path) {
  if (!existsSync(path)) {
    console.error(`ERROR: file not found: ${path}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`ERROR: failed to parse JSON at ${path}: ${e.message}`);
    process.exit(2);
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// ---------- Merge ----------
//
// Per docs/brain-node-mapping-schema.md §3 (override-by-key, per-node, per-slot,
// atomic at the slot level). The on-disk override shape (until the classifier
// produces its own) is:
//
//   portal.brainNodeMapping.overrides = {
//     <nodeId>: {
//       internal_override?:  <internal object>      // wholly replaces template internal
//       external_add?:       [ ...external entry ]  // appended to template external
//       external_replace?:   [ ...external entry ]  // wholly replaces template external
//       note?:               string|null            // overrides template note
//       nullReason?:         string                 // when override sets a slot to null
//     }
//   }
//
// `source` is stamped per cell after merge: overridden cells get "classifier_v1"
// (or "hand_authored" if the override block carries `source: "hand_authored"`);
// unchanged cells inherited from the template get "inherited_unchanged".
//
function mergeMapping(template, overrides, sourceMode) {
  const merged = {
    _meta: {
      ...deepClone(template._meta || {}),
      resolved_at: new Date().toISOString(),
      resolver: 'resolve-portal-brain-node-mapping.mjs',
      template_domain: template?._meta?.domain ?? null,
      template_archetype: template?._meta?.archetype ?? null,
      template_named_example: template?._meta?.named_example ?? null,
      resolution_mode: sourceMode,
      override_count_input: Object.keys(overrides || {}).length,
    },
    schemaVersion: template.schemaVersion || '1.0.0',
    nodes: {},
  };

  const templateNodes = template.nodes || {};
  const overrideNodes = overrides || {};
  const overriddenCells = { internal: 0, external: 0, notes: 0 };

  for (const [nodeId, baseEntry] of Object.entries(templateNodes)) {
    const ov = overrideNodes[nodeId];
    const out = {
      internal: deepClone(baseEntry?.internal ?? null),
      external: deepClone(baseEntry?.external ?? null),
      note:     baseEntry?.note ?? null,
    };

    if (ov && isPlainObject(ov)) {
      const cellSource = (ov.source === 'hand_authored') ? 'hand_authored' : 'classifier_v1';

      // internal: atomic replacement
      if ('internal_override' in ov) {
        out.internal = deepClone(ov.internal_override);
        if (isPlainObject(out.internal)) {
          out.internal.source = cellSource;
        }
        overriddenCells.internal++;
      } else if (isPlainObject(out.internal)) {
        out.internal.source = 'inherited_unchanged';
      }

      // external: replace wholly OR append
      if ('external_replace' in ov) {
        const arr = Array.isArray(ov.external_replace) ? deepClone(ov.external_replace) : null;
        if (Array.isArray(arr)) {
          for (const el of arr) {
            if (isPlainObject(el)) el.source = cellSource;
          }
        }
        out.external = arr;
        overriddenCells.external++;
      } else if (Array.isArray(ov.external_add) && ov.external_add.length) {
        const base = Array.isArray(out.external) ? out.external : [];
        // tag inherited entries
        for (const el of base) {
          if (isPlainObject(el) && !('source' in el)) el.source = 'inherited_unchanged';
        }
        const added = deepClone(ov.external_add);
        for (const el of added) {
          if (isPlainObject(el)) el.source = cellSource;
        }
        out.external = base.concat(added);
        overriddenCells.external++;
      } else if (Array.isArray(out.external)) {
        for (const el of out.external) {
          if (isPlainObject(el) && !('source' in el)) el.source = 'inherited_unchanged';
        }
      }

      if ('note' in ov) {
        out.note = ov.note;
        overriddenCells.notes++;
      }
      if ('nullReason' in ov) {
        out.nullReason = ov.nullReason;
      }
    } else {
      // pure inherited node — tag inherited source on populated cells
      if (isPlainObject(out.internal)) out.internal.source = 'inherited_unchanged';
      if (Array.isArray(out.external)) {
        for (const el of out.external) {
          if (isPlainObject(el) && !('source' in el)) el.source = 'inherited_unchanged';
        }
      }
    }

    merged.nodes[nodeId] = out;
  }

  // Surface any override that targets a node the template doesn't contain.
  const stray = [];
  for (const k of Object.keys(overrideNodes)) {
    if (!(k in templateNodes)) stray.push(k);
  }

  merged._meta.cells_overridden = overriddenCells;
  merged._meta.stray_override_keys = stray;

  return merged;
}

// ---------- Validation (in-process port of validate-brain-node-mapping.mjs §validate) ----------
function loadCanonicalIds() {
  const reg = readJson(REGISTRY_PATH);
  if (!Array.isArray(reg.canonical_ids)) {
    console.error(`ERROR: registry at ${REGISTRY_PATH} is missing canonical_ids[]`);
    process.exit(2);
  }
  return reg.canonical_ids;
}

function validateEntry(id, entry) {
  const errs = [];
  if (entry === null) return errs;
  if (!isPlainObject(entry)) {
    errs.push(`${id}: entry must be an object or null (got ${Array.isArray(entry) ? 'array' : typeof entry})`);
    return errs;
  }
  if (!('internal' in entry)) errs.push(`${id}: missing required key 'internal' (use null if intentionally empty)`);
  if (!('external' in entry)) errs.push(`${id}: missing required key 'external' (use null if intentionally empty)`);
  if ('internal' in entry) {
    const internal = entry.internal;
    if (internal !== null) {
      if (!isPlainObject(internal)) {
        errs.push(`${id}.internal: must be an object or null`);
      } else if (!('role' in internal) || (internal.role !== null && typeof internal.role !== 'string')) {
        errs.push(`${id}.internal.role: required (string or null)`);
      } else if (typeof internal.role === 'string' && internal.role.trim() === '') {
        errs.push(`${id}.internal.role: must be non-empty string (or null)`);
      }
    }
  }
  if ('external' in entry) {
    const external = entry.external;
    if (external !== null) {
      if (!Array.isArray(external)) {
        errs.push(`${id}.external: must be an array or null`);
      } else {
        external.forEach((el, idx) => {
          if (!isPlainObject(el)) {
            errs.push(`${id}.external[${idx}]: must be an object`);
            return;
          }
          if (!('name' in el) || typeof el.name !== 'string' || el.name.trim() === '') {
            errs.push(`${id}.external[${idx}]: required 'name' (non-empty string)`);
          }
        });
      }
    }
  }
  return errs;
}

function validate(mapping, canonicalIds) {
  const nodes = isPlainObject(mapping.nodes) ? mapping.nodes : {};
  const canonicalSet = new Set(canonicalIds);
  const presentIds   = new Set(Object.keys(nodes));
  const missing = canonicalIds.filter(id => !presentIds.has(id));
  const unknown = [...presentIds].filter(id => !canonicalSet.has(id));
  const entryErrors = [];
  for (const id of presentIds) {
    if (!canonicalSet.has(id)) continue;
    const errs = validateEntry(id, nodes[id]);
    entryErrors.push(...errs);
  }
  return {
    addressedCount: canonicalIds.filter(id => presentIds.has(id)).length,
    totalCanonical: canonicalIds.length,
    missing, unknown, entryErrors,
    pass: missing.length === 0 && unknown.length === 0 && entryErrors.length === 0,
  };
}

// ---------- Main ----------
function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.slug && !args.file)) {
    printUsage();
    process.exit(args.help ? 0 : 2);
  }

  // Resolve portal file path
  const portalPath = args.slug
    ? join(COMPANIES_DIR, `${args.slug}.json`)
    : resolve(args.file);
  const portal = readJson(portalPath);

  // Determine domain
  const domainId = portal.domainId || portal.domain || portal._meta?.domainId || null;
  if (!domainId) {
    console.error(`ERROR: portal at ${portalPath} has no domainId/domain field`);
    process.exit(2);
  }

  // Canonicalize sub-domain -> parent before template lookup; retain subTag.
  // MUST stay in sync with scripts/score-companies.js (SUBCATEGORY_TO_PARENT)
  // and assets/data/command-board-data.json._canonical_subcategory_map.
  const { domain: templateDomain, subTag } = canonicalizeDomain(domainId);

  // Load template (keyed on the canonical parent domain)
  const templatePath = join(TEMPLATES_DIR, `${templateDomain}.json`);
  if (!existsSync(templatePath)) {
    console.error(`ERROR: no archetype template found for domain '${templateDomain}' (portal domainId='${domainId}') at ${templatePath}`);
    process.exit(2);
  }
  const template = readJson(templatePath);

  // Extract overrides (may be absent)
  const bnm = portal.brainNodeMapping;
  const hasMapping = isPlainObject(bnm);
  const overrides = (hasMapping && isPlainObject(bnm.overrides)) ? bnm.overrides : {};
  const sourceMode = !hasMapping
    ? 'template_pure_no_portal_mapping_yet'
    : (Object.keys(overrides).length === 0 ? 'template_pure_overrides_empty' : 'template_inherited_with_overrides');

  // Merge
  const merged = mergeMapping(template, overrides, sourceMode);

  // Validate
  const canonicalIds = loadCanonicalIds();
  const v = validate(merged, canonicalIds);

  // Summary
  if (args.summary) {
    const lines = [];
    lines.push(`resolve-portal-brain-node-mapping summary`);
    lines.push(`  portal               : ${portalPath}`);
    lines.push(`  slug                 : ${portal.slug || '(none)'}`);
    lines.push(`  domainId             : ${domainId}`);
    lines.push(`  template             : ${templatePath}`);
    lines.push(`  template archetype   : ${template?._meta?.archetype ?? '(none)'}`);
    lines.push(`  template named ex.   : ${template?._meta?.named_example ?? '(none)'}`);
    lines.push(`  template nodes       : ${Object.keys(template.nodes || {}).length}`);
    lines.push(`  brainNodeMapping?    : ${hasMapping ? 'yes' : 'NO (classifier not yet run)'}`);
    lines.push(`  overrides            : ${Object.keys(overrides).length}`);
    lines.push(`  resolution_mode      : ${sourceMode}`);
    lines.push(`  cells overridden     : internal=${merged._meta.cells_overridden.internal}, external=${merged._meta.cells_overridden.external}, notes=${merged._meta.cells_overridden.notes}`);
    lines.push(`  stray override keys  : ${merged._meta.stray_override_keys.length ? merged._meta.stray_override_keys.join(', ') : '(none)'}`);
    lines.push(`  addressed            : ${v.addressedCount} / ${v.totalCanonical}`);
    lines.push(`  missing canonical    : ${v.missing.length}${v.missing.length ? ' [' + v.missing.slice(0,10).join(',') + (v.missing.length>10?',…':'') + ']' : ''}`);
    lines.push(`  unknown ids          : ${v.unknown.length}${v.unknown.length ? ' [' + v.unknown.slice(0,10).join(',') + (v.unknown.length>10?',…':'') + ']' : ''}`);
    lines.push(`  per-node violations  : ${v.entryErrors.length}`);
    lines.push(`  validator            : ${v.pass ? 'PASS' : 'FAIL'}`);
    console.log(lines.join('\n'));
  }

  if (!v.pass) {
    if (!args.summary) {
      console.error('VALIDATION FAILED for resolved mapping:');
      if (v.missing.length) console.error(`  missing canonical ids (${v.missing.length}): ${v.missing.join(', ')}`);
      if (v.unknown.length) console.error(`  unknown ids (${v.unknown.length}): ${v.unknown.join(', ')}`);
      for (const e of v.entryErrors) console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  // Output (skip when summary-only)
  if (!args.summary) {
    const json = JSON.stringify(merged, null, 2);
    if (args.outPath) {
      const outAbs = resolve(args.outPath);
      mkdirSync(dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, json + '\n', 'utf8');
      console.error(`wrote ${outAbs}`);
    } else {
      process.stdout.write(json + '\n');
    }
  }

  process.exit(0);
}

main();
