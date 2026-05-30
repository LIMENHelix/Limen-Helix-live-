#!/usr/bin/env node
// validate-brain-node-mapping.mjs
//
// Validates a portal's `brainNodeMapping` field (or a standalone
// brainNodeMapping JSON file) against the L1-frozen 123-node canonical
// taxonomy in assets/data/connectome-node-registry.json.
//
// Usage:
//   node scripts/validate-brain-node-mapping.mjs --portal <path-to-portal.json>
//   node scripts/validate-brain-node-mapping.mjs --file   <path-to-brainNodeMapping.json>
//
// Exit codes:
//   0  PASS (no violations; every canonical id addressed)
//   1  FAIL (missing canonical ids, unknown ids, or schema violations)
//   2  usage / IO error

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = resolve(__dirname, '..');
const REGISTRY_PATH = join(REPO_ROOT, 'assets', 'data', 'connectome-node-registry.json');

// ---------- CLI parsing ----------
function parseArgs(argv) {
  const out = { portal: null, file: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--portal' && argv[i + 1]) { out.portal = argv[++i]; continue; }
    if (a === '--file'   && argv[i + 1]) { out.file   = argv[++i]; continue; }
    if (a === '-h' || a === '--help')    { out.help = true; continue; }
  }
  return out;
}

function printUsage() {
  console.log(`
validate-brain-node-mapping.mjs
  Validates a brainNodeMapping against the 123-node L1-frozen taxonomy.

Usage:
  node scripts/validate-brain-node-mapping.mjs --portal <path-to-portal.json>
  node scripts/validate-brain-node-mapping.mjs --file   <path-to-brainNodeMapping.json>

Flags:
  --portal <path>   A full portal JSON. Validator reads .brainNodeMapping.
  --file   <path>   A standalone brainNodeMapping JSON (top-level .nodes).
  -h, --help        Show this message.

Exit codes:
  0  PASS
  1  FAIL (missing / unknown ids, or schema violations)
  2  usage / IO error
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

function loadCanonicalIds() {
  const reg = readJson(REGISTRY_PATH);
  if (!Array.isArray(reg.canonical_ids)) {
    console.error(`ERROR: registry at ${REGISTRY_PATH} is missing canonical_ids[]`);
    process.exit(2);
  }
  return reg.canonical_ids;
}

function extractMapping(args) {
  if (args.portal) {
    const portal = readJson(resolve(args.portal));
    const m = portal.brainNodeMapping;
    if (!m || typeof m !== 'object') {
      console.error(`ERROR: portal at ${args.portal} has no .brainNodeMapping object`);
      process.exit(2);
    }
    return { mapping: m, source: args.portal, mode: 'portal' };
  }
  if (args.file) {
    return { mapping: readJson(resolve(args.file)), source: args.file, mode: 'file' };
  }
  printUsage();
  process.exit(2);
}

// ---------- Validation ----------
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Per-node entry schema:
//   { internal: { role: string } | null,
//     external: [{ name: string, ... }, ...] | null }
// An entry may itself be `null` if the entire node is explicitly unaddressed
// (in that case the node is "addressed" but counted as null-with-reason via
// a sibling _nullReasons map — optional, we don't strictly enforce).
function validateEntry(id, entry) {
  const errs = [];
  if (entry === null) {
    // explicit null: addressed but empty — OK at top level
    return errs;
  }
  if (!isPlainObject(entry)) {
    errs.push(`${id}: entry must be an object or null (got ${Array.isArray(entry) ? 'array' : typeof entry})`);
    return errs;
  }
  if (!('internal' in entry)) errs.push(`${id}: missing required key 'internal' (use null if intentionally empty)`);
  if (!('external' in entry)) errs.push(`${id}: missing required key 'external' (use null if intentionally empty)`);

  // internal
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

  // external
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
  // The mapping may be either:
  //   (a) the rough/expected shape: { _meta?: {...}, nodes: { ID: entry, ... } }
  //   (b) a flat shape: { ID: entry, ID: entry, ... }
  // Prefer (a) if `nodes` is present and is a plain object.
  let nodes;
  let shape;
  if (isPlainObject(mapping.nodes)) {
    nodes = mapping.nodes;
    shape = 'wrapped (has _meta/nodes)';
  } else {
    // treat the whole object as the node map, skipping any underscore-prefixed meta keys
    nodes = {};
    for (const [k, v] of Object.entries(mapping)) {
      if (k.startsWith('_')) continue;
      nodes[k] = v;
    }
    shape = 'flat (no .nodes wrapper)';
  }

  const canonicalSet = new Set(canonicalIds);
  const presentIds   = new Set(Object.keys(nodes));

  const missing = canonicalIds.filter(id => !presentIds.has(id));
  const unknown = [...presentIds].filter(id => !canonicalSet.has(id));

  const entryErrors = [];
  for (const id of presentIds) {
    if (!canonicalSet.has(id)) continue; // unknown id reported separately
    const errs = validateEntry(id, nodes[id]);
    entryErrors.push(...errs);
  }

  return {
    shape,
    addressedCount: canonicalIds.filter(id => presentIds.has(id)).length,
    totalCanonical: canonicalIds.length,
    missing,
    unknown,
    entryErrors,
  };
}

// ---------- Reporting ----------
function report(result, source, mode) {
  const { shape, addressedCount, totalCanonical, missing, unknown, entryErrors } = result;
  const lines = [];
  lines.push(`brain-node-mapping validator`);
  lines.push(`  source : ${source}  (${mode})`);
  lines.push(`  shape  : ${shape}`);
  lines.push(`  addressed: ${addressedCount} / ${totalCanonical}`);
  lines.push('');

  if (missing.length) {
    lines.push(`MISSING canonical ids (${missing.length}):`);
    lines.push('  ' + missing.join(', '));
    lines.push('');
  } else {
    lines.push(`MISSING canonical ids: 0`);
  }

  if (unknown.length) {
    lines.push(`UNKNOWN / non-canonical ids in mapping (${unknown.length}):`);
    lines.push('  ' + unknown.join(', '));
    lines.push('');
  } else {
    lines.push(`UNKNOWN ids: 0`);
  }

  if (entryErrors.length) {
    lines.push(`PER-NODE schema violations (${entryErrors.length}):`);
    for (const e of entryErrors) lines.push('  - ' + e);
    lines.push('');
  } else {
    lines.push(`PER-NODE schema violations: 0`);
  }

  const pass = missing.length === 0 && unknown.length === 0 && entryErrors.length === 0;
  lines.push('');
  lines.push(pass ? 'RESULT: PASS' : 'RESULT: FAIL');

  console.log(lines.join('\n'));
  return pass;
}

// ---------- Main ----------
function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.portal && !args.file)) {
    printUsage();
    process.exit(args.help ? 0 : 2);
  }
  const canonical = loadCanonicalIds();
  const { mapping, source, mode } = extractMapping(args);
  const result = validate(mapping, canonical);
  const ok = report(result, source, mode);
  process.exit(ok ? 0 : 1);
}

main();
