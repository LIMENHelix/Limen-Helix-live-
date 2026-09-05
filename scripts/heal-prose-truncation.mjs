#!/usr/bin/env node
/**
 * Repair only deterministic punctuation defects in functionalNetwork notes.
 *
 * Safe transformations:
 *   - remove a stray leading period before a capitalized sentence
 *   - collapse exactly two terminal periods to one
 *
 * Empty, short, fragmentary, and genuinely truncated notes are reported but
 * never completed here: doing so would invent factual content.
 *
 *   node scripts/heal-prose-truncation.mjs             # dry run
 *   node scripts/heal-prose-truncation.mjs --apply     # write repairs + audit
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proseFlagsForNote, repairSafeProsePunctuation } from './_prose-quality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const REPORT = path.join(ROOT, 'assets', 'data', 'audit', 'prose-quality-heal.json');
const APPLY = process.argv.includes('--apply');

function arrayOf(value) {
  return Array.isArray(value) ? value : (value && typeof value === 'object' ? [value] : []);
}

function entriesOf(portal) {
  const entries = [];
  for (const [category, value] of Object.entries(portal.functionalNetwork || {})) {
    arrayOf(value).forEach((entry, index) => {
      if (entry && typeof entry === 'object') entries.push({ category, index, entry });
    });
  }
  return entries;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyMinimalNoteEdits(raw, expectedPortal, changes, file) {
  let updated = raw;
  const byOriginal = new Map();
  for (const change of changes) {
    const group = byOriginal.get(change.before) || { after: change.after, count: 0 };
    if (group.after !== change.after) throw new Error(`${file}: one source note mapped to multiple outputs`);
    group.count++;
    byOriginal.set(change.before, group);
  }

  for (const [before, group] of byOriginal) {
    const encodedBefore = JSON.stringify(before);
    const encodedAfter = JSON.stringify(group.after);
    const pattern = new RegExp(`("relationshipNote"\\s*:\\s*)${escapeRegExp(encodedBefore)}`, 'g');
    let replacements = 0;
    updated = updated.replace(pattern, (_match, prefix) => {
      replacements++;
      return prefix + encodedAfter;
    });
    if (replacements !== group.count) {
      throw new Error(`${file}: expected ${group.count} exact relationshipNote replacements, found ${replacements}`);
    }
  }

  const reparsed = JSON.parse(updated);
  if (JSON.stringify(reparsed) !== JSON.stringify(expectedPortal)) {
    throw new Error(`${file}: minimal text edit changed data outside the planned note repairs`);
  }
  return updated;
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const files = fs.readdirSync(DIR).filter(file => file.endsWith('.json') && !file.startsWith('_')).sort();
const changedFiles = [];
const changes = [];
const residuals = [];
let entriesScanned = 0;
let badBefore = 0;

for (const file of files) {
  const fullPath = path.join(DIR, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  let portal;
  try {
    portal = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file}: invalid JSON before repair: ${error.message}`);
  }

  const fileChanges = [];
  for (const { category, index, entry } of entriesOf(portal)) {
    entriesScanned++;
    const before = String(entry.relationshipNote == null ? '' : entry.relationshipNote);
    const beforeIssues = proseFlagsForNote(before);
    if (beforeIssues.length) badBefore++;
    const repaired = repairSafeProsePunctuation(before);
    if (repaired.repairs.length) {
      entry.relationshipNote = repaired.value;
      const change = {
        file,
        category,
        index,
        name: entry.name || null,
        repairs: repaired.repairs,
        before,
        after: repaired.value
      };
      fileChanges.push(change);
      changes.push(change);
    }
  }

  if (fileChanges.length) {
    const updated = applyMinimalNoteEdits(raw, portal, fileChanges, file);
    if (APPLY) fs.writeFileSync(fullPath, updated);
    changedFiles.push({ file, entriesChanged: fileChanges.length });
  }
}

let badAfter = 0;
let safeTargetsAfter = 0;
for (const file of files) {
  const fullPath = path.join(DIR, file);
  const portal = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  for (const { category, index, entry } of entriesOf(portal)) {
    const note = String(entry.relationshipNote == null ? '' : entry.relationshipNote);
    const issues = proseFlagsForNote(note);
    const repairs = repairSafeProsePunctuation(note).repairs;
    if (issues.length) {
      badAfter++;
      residuals.push({ file, category, index, name: entry.name || null, issues, note });
    }
    if (repairs.length) safeTargetsAfter++;
  }
}

// A dry run reads the unchanged files, so compute the projected residual from
// the planned in-memory values rather than presenting the current disk count as
// an after-state.
if (!APPLY) {
  badAfter = 0;
  safeTargetsAfter = 0;
  residuals.length = 0;
  for (const file of files) {
    const portal = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    for (const { category, index, entry } of entriesOf(portal)) {
      const repaired = repairSafeProsePunctuation(entry.relationshipNote);
      const issues = proseFlagsForNote(repaired.value);
      if (issues.length) {
        badAfter++;
        residuals.push({ file, category, index, name: entry.name || null, issues, note: repaired.value });
      }
    }
  }
}

const repairCounts = {};
for (const change of changes) {
  for (const repair of change.repairs) repairCounts[repair] = (repairCounts[repair] || 0) + 1;
}

const report = {
  schemaVersion: 'prose-quality-heal/1.0',
  generatedAt: new Date().toISOString(),
  sourceCommit: currentCommit(),
  mode: APPLY ? 'apply' : 'dry-run',
  scope: 'functionalNetwork relationshipNote punctuation only; no facts generated',
  counts: {
    portalsScanned: files.length,
    entriesScanned,
    badEntriesBefore: badBefore,
    entriesChanged: changes.length,
    filesChanged: changedFiles.length,
    repairCounts,
    projectedOrMeasuredBadEntriesAfter: badAfter,
    safeTargetsAfter
  },
  files: changedFiles,
  changes,
  residuals
};

if (APPLY) fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');

console.log(`=== heal-prose-truncation (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`);
console.log('portals scanned:', files.length);
console.log('entries scanned:', entriesScanned);
console.log('bad entries before:', badBefore);
console.log('entries changed:', changes.length);
console.log('files changed:', changedFiles.length);
console.log('repair mix:', JSON.stringify(repairCounts));
console.log(`${APPLY ? 'bad entries after' : 'projected bad entries after'}:`, badAfter);
console.log('safe repair targets after:', safeTargetsAfter);
console.log('ambiguous residuals:', residuals.length);
if (APPLY) console.log('audit report:', path.relative(ROOT, REPORT).replace(/\\/g, '/'));
else console.log('(dry run — nothing written)');

if (safeTargetsAfter !== 0) process.exitCode = 2;
