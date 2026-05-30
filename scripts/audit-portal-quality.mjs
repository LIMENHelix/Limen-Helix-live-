#!/usr/bin/env node
/**
 * audit-portal-quality.mjs — full-portal quality scan.
 *
 * Scans every portal for the failure modes seen on GROOVE BOTANICALS:
 *   - DATA_NEEDED density (count occurrences in ALL string fields, deep walk)
 *   - NaN / null in financialHealth composite / kernel block
 *   - Mid-sentence truncation in long-form prose (intelligenceCycle, notes)
 *   - Domain vs SIC mismatch hints (rough — flags obvious wrong-domain routing)
 *   - Short / empty notes
 *
 * Each portal gets a "quality score" — high = bad. Above a threshold = delete
 * (the model couldn't write a real portal; better no portal than placeholder soup).
 *
 *   node scripts/audit-portal-quality.mjs              # ranked summary
 *   node scripts/audit-portal-quality.mjs --list 30    # detail for worst 30
 *   node scripts/audit-portal-quality.mjs --portal X   # one portal
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const LIST = (i => i === -1 ? 0 : parseInt(process.argv[i + 1], 10) || 30)(process.argv.indexOf('--list'));
const onlyP = (i => i === -1 ? null : process.argv[i + 1])(process.argv.indexOf('--portal'));

function countDataNeeded(node) {
  let n = 0;
  if (node == null) return 0;
  if (typeof node === 'string') return (node.match(/DATA_NEEDED/g) || []).length;
  if (Array.isArray(node)) { for (const v of node) n += countDataNeeded(v); return n; }
  if (typeof node === 'object') { for (const k in node) n += countDataNeeded(node[k]); return n; }
  return 0;
}

function flagsForPortal(p) {
  const flags = [];
  const dn = countDataNeeded(p);
  if (dn > 0) flags.push(['DATA_NEEDED:' + dn, dn * 2]);
  // kernel/financial block
  const fh = p.financialHealth || {};
  const comp = fh.composite;
  if (typeof comp === 'number' && Number.isNaN(comp)) flags.push(['NaN-composite', 30]);
  if (comp == null && /ELIGIBLE/.test(String(p.kernelStatus || ''))) flags.push(['null-composite-eligible', 10]);
  // Walk all strings, look for truncation indicators
  let truncated = 0;
  function walkStrings(node) {
    if (node == null) return;
    if (typeof node === 'string') {
      const t = node.trim();
      if (t.length > 40) {
        if (/\b(?:and|of|for|with|by|to|in|on|from|the|a|an)\s*$/i.test(t)) truncated++;
        if (/[a-z],?\s*$/.test(t) && !/[.!?]\s*$/.test(t) && t.length > 80) truncated++;
      }
      return;
    }
    if (Array.isArray(node)) { for (const v of node) walkStrings(v); return; }
    if (typeof node === 'object') { for (const k in node) walkStrings(node[k]); }
  }
  walkStrings(p);
  if (truncated > 0) flags.push(['truncated:' + truncated, truncated * 3]);
  // Domain vs SIC mismatch heuristic
  const sic = String(p.sic || ''), industry = String(p.industry || '').toLowerCase(), domain = String(p.domainId || '').toLowerCase();
  // Pharmaceutical SIC (283x) on non-medicine domain
  if (/^283/.test(sic) && domain && domain !== 'medicine' && domain !== 'science') flags.push(['domain-mismatch:283x-not-medicine:' + domain, 8]);
  if (/pharm/i.test(industry) && domain && domain !== 'medicine' && domain !== 'science') flags.push(['domain-mismatch:pharma-not-medicine:' + domain, 8]);
  // empty functionalNetwork
  const fn = p.functionalNetwork || {};
  const fnTotal = Object.values(fn).reduce((s, v) => s + (Array.isArray(v) ? v.length : (v ? 1 : 0)), 0);
  if (fnTotal < 10) flags.push(['fn-too-thin:' + fnTotal, 5]);
  return { flags, score: flags.reduce((s, f) => s + f[1], 0), dn, truncated, fnTotal };
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
const results = [];
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  if (onlyP && slug !== onlyP) continue;
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const r = flagsForPortal(p);
  if (r.score > 0) results.push({ slug, name: p.name, ...r });
}
results.sort((a, b) => b.score - a.score);

if (onlyP) {
  const r = results[0];
  if (!r) { console.log(onlyP + ': no issues flagged'); process.exit(0); }
  console.log(r.slug + ' ("' + r.name + '") score=' + r.score);
  console.log('  flags:', r.flags.map(f => f[0]).join(', '));
  process.exit(0);
}

const bands = { '50+': 0, '20-49': 0, '10-19': 0, '5-9': 0, '1-4': 0 };
for (const r of results) { const s = r.score; if (s >= 50) bands['50+']++; else if (s >= 20) bands['20-49']++; else if (s >= 10) bands['10-19']++; else if (s >= 5) bands['5-9']++; else bands['1-4']++; }
console.log('=== portal-quality audit ===');
console.log('portals scanned:', files.length);
console.log('portals with issues:', results.length, `(${(results.length / files.length * 100).toFixed(1)}%)`);
console.log('score bands:', JSON.stringify(bands));
console.log('total DATA_NEEDED across corpus:', results.reduce((s, r) => s + r.dn, 0));
console.log('\nworst portals:');
for (const r of results.slice(0, LIST || 25)) {
  console.log('  ' + String(r.score).padStart(4) + '  ' + r.slug.padEnd(40) + '  ' + r.flags.map(f => f[0]).join(' '));
}
if (!LIST) console.log('\n(run with --list 50 for more)');
