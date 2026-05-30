#!/usr/bin/env node
/**
 * scripts/portal-genericity-audit.mjs
 *
 * Walks every v2.0.1 portal and reports the anchored-rate of its
 * functionalNetwork relationshipNotes per feedback_in_depth_not_generic.
 * Same anchor regex set as the server-side enricher post-gen check.
 *
 * Usage:
 *   node scripts/portal-genericity-audit.mjs                # all v2 portals
 *   node scripts/portal-genericity-audit.mjs --weak         # only anchoredRate < 0.7
 *   node scripts/portal-genericity-audit.mjs --slugs 3m,adobe,accenture
 *   node scripts/portal-genericity-audit.mjs --json         # machine output
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PORTAL_DIR = path.join(REPO_ROOT, 'assets', 'data', 'companies');

const argv = process.argv.slice(2);
const wantJson = argv.includes('--json');
const weakOnly = argv.includes('--weak');
const slugsArg = (function () {
  const i = argv.indexOf('--slugs');
  return i === -1 ? null : (argv[i + 1] || '').split(',').map(s => s.trim()).filter(Boolean);
})();

const ANCHOR_PATTERNS = [
  /\b(19|20)\d{2}\b/,
  /\$\s*\d+(?:[.,]\d+)?\s*(?:[BMK]|billion|million|trillion|bn|mn)?/i,
  /\b\d+(?:\.\d+)?\s*%/,
  /\b(?:CFR|U\.S\.C|USC|FDA|EPA|FTC|SEC|USPTO|NHTSA|OFAC|CFTC|FERC|FAA|FCC|NMPA|MHRA|EMA|PMDA|GDPR|HIPAA|SOX|DORA|MiCA|REACH)\b/,
  /\bSection\s+\d/i,
  /\bPart\s+\d{2,}/i,
  /\b\d+\s*(?:basis points|bps)\b/i,
  /\bQ[1-4]\s*20\d{2}\b/i,
  /\b(?:Form|10-K|10-Q|8-K|13F|S-1|14A|20-F)\b/i
];

function hasAnchor(text) {
  if (!text || typeof text !== 'string') return false;
  for (const re of ANCHOR_PATTERNS) if (re.test(text)) return true;
  return false;
}

const CATEGORIES = [
  'suppliers', 'logisticsPartners', 'customers', 'competitors',
  'regulators', 'capitalProviders', 'executiveTeam', 'marketSignals',
  'peers', 'partners', 'auditors'
];

function auditPortal(slug, p) {
  const fn = p.functionalNetwork || {};
  let anchored = 0, generic = 0;
  const examples = [];
  function check(arr) {
    if (!Array.isArray(arr)) return;
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      if (e._autoReciprocityFill) continue; // skip fill stubs
      const note = e.relationshipNote || e.note || '';
      if (hasAnchor(note)) anchored++;
      else {
        generic++;
        if (examples.length < 3) examples.push({ name: e.name || '?', noteHead: String(note).slice(0, 90) });
      }
    }
  }
  for (const cat of CATEGORIES) check(fn[cat]);
  if (fn.auditor && typeof fn.auditor === 'object' && !Array.isArray(fn.auditor)) {
    if (hasAnchor(fn.auditor.relationshipNote || fn.auditor.note || '')) anchored++;
    else generic++;
  }
  const total = anchored + generic;
  return {
    slug,
    name: p.name || slug,
    domain: p.domainId || '?',
    total, anchored, generic,
    rate: total > 0 ? (anchored / total) : 0,
    examples
  };
}

async function main() {
  const entries = await fs.readdir(PORTAL_DIR);
  const out = [];
  for (const f of entries) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    const slug = f.replace(/\.json$/, '');
    if (slugsArg && !slugsArg.includes(slug)) continue;
    try {
      const raw = await fs.readFile(path.join(PORTAL_DIR, f), 'utf8');
      const p = JSON.parse(raw);
      if (p.schemaVersion !== '2.0.1') continue;
      out.push(auditPortal(slug, p));
    } catch (_) { /* skip */ }
  }
  out.sort((a, b) => a.rate - b.rate);
  const filtered = weakOnly ? out.filter(o => o.rate < 0.7) : out;

  if (wantJson) {
    console.log(JSON.stringify({ count: filtered.length, portals: filtered }, null, 2));
    return;
  }

  console.log('=== Portal genericity audit ===');
  console.log('v2 portals scanned: ' + out.length);
  console.log('weak (rate < 0.7): ' + out.filter(o => o.rate < 0.7).length);
  console.log('');
  const display = filtered.slice(0, 50);
  for (const r of display) {
    const pct = (r.rate * 100).toFixed(0).padStart(3);
    const flag = r.rate < 0.7 ? '⚠️ ' : '  ';
    console.log('  ' + flag + pct + '%  ' + r.slug.padEnd(28) + ' ' + r.total + ' entries  ' + r.domain);
    if (r.rate < 0.7 && r.examples.length) {
      for (const ex of r.examples.slice(0, 2)) {
        console.log('         · "' + ex.name + '" → "' + ex.noteHead + '..."');
      }
    }
  }
  if (filtered.length > display.length) {
    console.log('  ... (' + (filtered.length - display.length) + ' more — use --json for full list)');
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
