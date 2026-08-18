#!/usr/bin/env node
/**
 * extract-operator-ciks.js
 *
 * Scans domain operator/opportunity files for embedded company references
 * (ticker / name / cik triples) and writes a deduplicated registry that
 * score-companies.js can use as a fourth source. Domain is inferred from
 * file path: e.g. industry-clarity-operator.js → 'industry'.
 *
 * Output: assets/data/operator-references.json
 *   { _generated: <iso>, _total: <n>, companies: [
 *       { name, ticker, cik, domain, sources: [paths...] }, ...
 *   ] }
 *
 * Usage: node scripts/extract-operator-ciks.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'assets', 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'operator-references.json');

// A company's citation domain is not always its primary operating domain.
// These pharmaceutical registrants are cited by the population operator for
// demographic exposure, but their Command Board/portal routing belongs to the
// medicine domain. Key by normalized SEC CIK so regeneration cannot silently
// restore the citation domain as the primary domain.
const PRIMARY_DOMAIN_BY_CIK = {
  '901832': 'medicine',  // AstraZeneca plc
  '10456': 'medicine',   // Baxter International Inc.
  '1776985': 'medicine', // BioNTech SE
  '882095': 'medicine',  // Gilead Sciences, Inc.
  '730272': 'medicine',  // Repligen Corporation
};

// Files to scan — domain operator + opportunity files where companies are
// cited with {ticker, name, cik} triples. Anything outside these patterns
// won't be scanned (avoids matching test fixtures, diagnostics, etc.).
const SCAN_DIRS = [
  path.join(__dirname, '..'),
  path.join(__dirname, '..', 'assets', 'js'),
  path.join(__dirname, '..', 'assets', 'js', 'domain-brains'),
  path.join(__dirname, '..', 'assets', 'js', 'domain-brains', 'data'),
];

const FILE_PATTERN = /(clarity-operator|opportunities|node-business-engine|targeting-engine|opportunity-playbooks|opportunities\.html)/;

// Domain inference from file path
function inferDomain(filePath) {
  const base = path.basename(filePath).toLowerCase();
  // strip suffixes
  const m = base.match(/^([a-z][a-z0-9_]*?)(?:-clarity-operator|-opportunities|-node-business-engine|-targeting-engine|-opportunity-playbooks)?\.(?:js|html)$/);
  if (!m) return null;
  // Map a few known aliases to canonical domain ids
  const ALIASES = { medicine: 'medicine', science: 'science', supplychain: 'trade', supplyChain: 'trade' };
  const stem = m[1];
  return ALIASES[stem] || stem;
}

const candidates = [];
let filesScanned = 0;

function scanDir(dir) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch (e) { return; }
  for (const f of entries) {
    const p = path.join(dir, f);
    let stat;
    try { stat = fs.statSync(p); } catch (e) { continue; }
    if (stat.isFile()) {
      const ext = path.extname(p);
      if (ext !== '.js' && ext !== '.html') continue;
      if (!FILE_PATTERN.test(p)) continue;
      filesScanned++;
      const txt = fs.readFileSync(p, 'utf8');
      // Pattern: {ticker:'XXX', name:'…', cik:'\d+', …}  (any field order)
      // Match ticker→cik OR cik→ticker, capture name in between if present.
      const reTC = /ticker\s*:\s*['"]([A-Z][A-Z0-9.-]{0,8})['"]\s*,?\s*name\s*:\s*['"]([^'"]+)['"][\s\S]{0,200}?cik\s*:\s*['"]?(\d{1,10})['"]?/g;
      const reCT = /cik\s*:\s*['"]?(\d{1,10})['"]?\s*,?\s*[\s\S]{0,80}?name\s*:\s*['"]([^'"]+)['"][\s\S]{0,80}?ticker\s*:\s*['"]([A-Z][A-Z0-9.-]{0,8})['"]/g;
      const reTOnlyCik = /ticker\s*:\s*['"]([A-Z][A-Z0-9.-]{0,8})['"][\s\S]{0,200}?cik\s*:\s*['"]?(\d{1,10})['"]?/g;
      let m;
      while ((m = reTC.exec(txt)) !== null) {
        if (m[3] === '0' || m[3] === 'ETF') continue;
        candidates.push({ file: p, ticker: m[1], name: m[2], cik: m[3].replace(/^0+/, '') });
      }
      while ((m = reCT.exec(txt)) !== null) {
        if (m[1] === '0' || m[1] === 'ETF') continue;
        candidates.push({ file: p, ticker: m[3], name: m[2], cik: m[1].replace(/^0+/, '') });
      }
      // Fallback: ticker→cik without name in between (catches cases where name is missing)
      while ((m = reTOnlyCik.exec(txt)) !== null) {
        if (m[2] === '0') continue;
        candidates.push({ file: p, ticker: m[1], name: '', cik: m[2].replace(/^0+/, '') });
      }
    }
  }
}

SCAN_DIRS.forEach(scanDir);

// Dedupe by CIK — first non-empty name wins; collect source files; pick
// the most-frequent domain across the source files.
const byCik = {};
candidates.forEach(c => {
  const e = byCik[c.cik] || { ticker: c.ticker, name: '', sources: new Set(), domains: {} };
  if (!e.name && c.name) e.name = c.name;
  e.sources.add(c.file);
  const d = inferDomain(c.file);
  if (d) e.domains[d] = (e.domains[d] || 0) + 1;
  byCik[c.cik] = e;
});

const out = [];
for (const cik of Object.keys(byCik)) {
  const e = byCik[cik];
  // Pick highest-count domain as primary
  let primaryDomain = null, max = 0;
  for (const d of Object.keys(e.domains)) {
    if (e.domains[d] > max) { max = e.domains[d]; primaryDomain = d; }
  }
  out.push({
    cik: cik,
    ticker: e.ticker,
    name: e.name || e.ticker,
    domain: PRIMARY_DOMAIN_BY_CIK[cik] || primaryDomain || 'unknown',
    sources: Array.from(e.sources).map(p => path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/'))
  });
}

out.sort((a, b) => a.ticker.localeCompare(b.ticker));

const payload = {
  _generated: new Date().toISOString(),
  _total: out.length,
  _files_scanned: filesScanned,
  companies: out
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

console.log('files scanned:           ' + filesScanned);
console.log('unique CIKs extracted:   ' + out.length);
console.log('output:                  ' + path.relative(path.join(__dirname, '..'), OUTPUT_PATH).replace(/\\/g, '/'));
console.log('');

// Cross-reference with command-board-data.json
try {
  const cb = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'command-board-data.json'), 'utf8'));
  const cbCiks = new Set(cb.companies.map(c => String(c.c).replace(/^0+/, '')));
  const inCb = out.filter(c => cbCiks.has(c.cik));
  const missing = out.filter(c => !cbCiks.has(c.cik));
  console.log('coverage:');
  console.log('  already scored:        ' + inCb.length);
  console.log('  MISSING (need regen):  ' + missing.length);
  console.log('');

  // Domain breakdown of what's missing
  const byDom = {};
  missing.forEach(c => { byDom[c.domain] = (byDom[c.domain] || 0) + 1; });
  console.log('missing companies by primary domain:');
  Object.entries(byDom).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => {
    console.log('  ' + d.padEnd(20) + ' ' + n);
  });
} catch (e) {
  console.log('(could not cross-reference command-board-data.json: ' + e.message + ')');
}
