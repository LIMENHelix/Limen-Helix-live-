#!/usr/bin/env node
/**
 * audit-prose-quality.mjs — flag functionalNetwork notes with prose problems.
 *
 * The depth gate at the enricher checks ANCHORING (named entities, $ amounts,
 * statutes) — it does NOT check sentence completeness. So a note can pass the
 * gate (anchoredRate ≥ 0.85) and still read as incomplete: missing terminal
 * punctuation, mid-sentence truncation, fragment without a verb, run-on with
 * no breaks, suspiciously short for the depth target.
 *
 * Read-only. Reports by portal + by signal class so we can scope a fix.
 *
 *   node scripts/audit-prose-quality.mjs            # summary
 *   node scripts/audit-prose-quality.mjs --list     # entry-level detail
 *   node scripts/audit-prose-quality.mjs --portal stryker   # one portal
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const LIST = process.argv.includes('--list');
const onlyP = (i => i === -1 ? null : process.argv[i + 1])(process.argv.indexOf('--portal'));

function flagsForNote(note) {
  const issues = [];
  const t = String(note || '').trim();
  if (!t) { issues.push('empty'); return issues; }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 18) issues.push('too-short');                              // deep notes target 30-80 words
  if (!/[.!?]$/.test(t)) issues.push('no-terminal-punct');                      // doesn't end in . ! ?
  if (/[a-z]$/.test(t) && words.length < 50) issues.push('lowercase-final');    // truncated mid-sentence (ended on a lowercase letter)
  if (/\b([a-z]{2,})\1{2,}\b/i.test(t)) issues.push('repeat-token');            // some sort of garbled repeat
  // run-on: no period/semicolon/comma in 30+ word note
  if (words.length >= 30 && !/[.;,]/.test(t)) issues.push('run-on');
  // fragment heuristic: short note that doesnt start with a capital letter
  if (words.length < 25 && !/^[A-Z]/.test(t)) issues.push('fragment-start');
  // mid-sentence truncation indicators
  if (/\b(?:and|of|for|with|by|to|in|on|the|a|an)$/i.test(t)) issues.push('trailing-stopword');
  // ellipsis at end is fine usage but in our notes signals truncation
  if (/\.{2,}\s*$/.test(t)) issues.push('trailing-ellipsis');
  return issues;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const portalBad = {};       // slug -> { entries: n, by: {issue: count} }
const issueCounts = {};
let totalEntries = 0, badEntries = 0;
const examples = [];

for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  if (onlyP && slug !== onlyP) continue;
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const fn = p.functionalNetwork || {};
  let portalIssues = 0;
  for (const cat in fn) {
    const arr = Array.isArray(fn[cat]) ? fn[cat] : (fn[cat] && typeof fn[cat] === 'object' ? [fn[cat]] : []);
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      totalEntries++;
      const iss = flagsForNote(e.relationshipNote);
      if (iss.length) {
        badEntries++;
        portalIssues++;
        for (const k of iss) issueCounts[k] = (issueCounts[k] || 0) + 1;
        if (examples.length < 30) examples.push(`${slug} [${cat}] "${e.name}" {${iss.join(',')}}: ${String(e.relationshipNote || '').trim().slice(0, 140)}`);
      }
    }
  }
  if (portalIssues) portalBad[slug] = portalIssues;
}

const ranked = Object.entries(portalBad).sort((a, b) => b[1] - a[1]);
console.log('=== prose-quality audit ===');
console.log('portals scanned:', files.length, '| total fn entries:', totalEntries);
console.log('entries with ≥1 issue:', badEntries, `(${(badEntries / totalEntries * 100).toFixed(1)}%)`);
console.log('portals with ≥1 issue:', ranked.length, `(${(ranked.length / files.length * 100).toFixed(1)}%)`);
console.log('issue mix:', JSON.stringify(issueCounts));
console.log('\nworst portals (most bad entries):');
for (const [s, n] of ranked.slice(0, 20)) console.log('  ' + n + '  ' + s);
if (LIST) { console.log('\n-- examples --'); for (const e of examples) console.log('  ' + e); }
else console.log('\n(run with --list for entry-level examples, --portal <slug> to inspect one)');
