/**
 * scripts/build-historical-distress-cohort.js
 *
 * Build a companion data file alongside command-board-data.json that
 * captures the HISTORICAL DISTRESS cohort — CIKs the kernel scored with
 * full phase resolution (including P7a/P7b/P9) at some point, but which
 * the eligibility frontier now filters out (typically because they're
 * STALE post-bankruptcy or delisted, i.e., weeks_since_latest > 26).
 *
 * Source: diagnostic/artifacts/live_*.json fixtures. Each fixture is a
 * full kernel run output from when the company was actively scored.
 *
 * Output: assets/data/historical-distress-cohort.json
 *
 * Why this exists:
 *   command-board-data.json captures the ELIGIBLE_NOW cohort — companies
 *   currently filing on time, suitable for live monitoring. It SYSTEM-
 *   ATICALLY EXCLUDES the most clinically-interesting population: CIKs
 *   that have already played out a distress trajectory (BBBY, SIVB, BYND,
 *   ATHX, RAD, WeWork, NU RIDE, etc.). For calibration and falsification
 *   testing the architectural claim (universal phase kernel), we NEED
 *   the distressed cohort. This companion file preserves them.
 *
 * Discovery context: docs/phase-coupling-template.md Section 6 Test #2
 *   surfaced the absence of P7a/P7b in command-board (0 of 493). Diag-
 *   nosis (commit 9976a6af188) traced it to eligibility-filter STALE
 *   exclusion. This file is the fix.
 *
 * Run: node scripts/build-historical-distress-cohort.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'diagnostic', 'artifacts');
const OUTPUT_PATH = path.join(ROOT, 'assets', 'data', 'historical-distress-cohort.json');
const FRONTIER_PATH = path.join(ROOT, 'assets', 'data', 'kernel-eligibility-frontier.json');
const UNIVERSE_PATH = path.join(ROOT, 'assets', 'data', 'eligible-universe.json');

// Sector → LIMEN domain map (mirrors scripts/build-command-board.js)
const SECTOR_TO_DOMAIN = {
  'Energy': 'energy',
  'Banking': 'finance',
  'Healthcare': 'medicine',
  'Consumer': 'trade',
  'Utilities': 'infrastructure',
  'Retail': 'trade',
  'REIT': 'finance',
  'Real Estate': 'finance',
  'Real Estate or REIT (v1.0.1 pending)': 'finance',
  'Telecom': 'communication',
  'Industrials': 'industry',
  'Rental': 'trade',
  'Financial': 'finance',
};

function loadOptional(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function findCikRecord(cik, frontier, universe) {
  const norm = String(cik || '').replace(/^0+/, '');
  // Prefer frontier (has staleness info), fall back to universe
  if (frontier && Array.isArray(frontier.companies)) {
    const hit = frontier.companies.find(c => String(c.cik || '').replace(/^0+/, '') === norm);
    if (hit) return { src: 'frontier', rec: hit };
  }
  if (universe && Array.isArray(universe.companies)) {
    const hit = universe.companies.find(c => String(c.cik || '').replace(/^0+/, '') === norm);
    if (hit) return { src: 'universe', rec: hit };
  }
  return null;
}

function inferDomainFromName(name) {
  // Last-resort heuristics for companies missing from frontier+universe
  const n = (name || '').toLowerCase();
  if (/bank|financial|capital/.test(n)) return 'finance';
  if (/energy|oil|petro|gas/.test(n)) return 'energy';
  if (/pharma|biotec|therapeut|medi/.test(n)) return 'medicine';
  if (/retail|store|brand|consumer/.test(n)) return 'trade';
  return null;
}

function buildEntry(fixture, frontier, universe) {
  const cik = fixture.cik;
  if (!cik) return null;
  const rec = findCikRecord(cik, frontier, universe);
  let sector = null, sic = null, ticker = null, name = fixture.entity_name || null;

  if (rec) {
    sector = rec.rec.primary_sector || rec.rec.sector || null;
    sic = rec.rec.primary_sic || rec.rec.sic || null;
    ticker = rec.rec.ticker || ticker;
  }

  // Tickers from fixture file name pattern: live_TICKER_CIK.json
  // not present in fixture body, but the filename has it.

  const domain = (sector && SECTOR_TO_DOMAIN[sector]) || inferDomainFromName(name) || 'trade';

  return {
    n: name,
    t: ticker || '',
    c: String(cik || '').replace(/^0+/, ''),
    d: domain,
    p: fixture.dominant_phase || '?',
    tr: fixture.trajectory || null,
    co: fixture.composite || 0,
    a: !!fixture.alert,
    pathway: fixture.pathway || null,
    q: (fixture.rows && fixture.rows.length) ? fixture.rows[fixture.rows.length - 1].quarter : null,
    hist: (fixture.rows && fixture.rows.length) || 0,
    sec: sector,
    sic: sic,
    // Phase scores at latest quarter (preserves the full distribution)
    phase_scores_latest: (function () {
      if (!fixture.rows || !fixture.rows.length) return null;
      const last = fixture.rows[fixture.rows.length - 1];
      const out = {};
      for (const ph of ['p0','p1','p2','p3','p4','p5','p6','p7','p7a','p7b','p8','p9','p10']) {
        if (typeof last[ph] === 'number') out[ph] = Math.round(last[ph] * 10000) / 10000;
      }
      return out;
    })(),
    source: 'historical_fixture',
    fixture_origin: fixture._fixture_filename || null,
    // Why excluded from current command-board
    eligibility_status_at_build: rec && rec.rec.envelope_status ? rec.rec.envelope_status : 'NOT_IN_FRONTIER',
    weeks_since_latest: rec && (rec.rec.weeks_since_latest != null) ? rec.rec.weeks_since_latest : null,
  };
}

function main() {
  const frontier = loadOptional(FRONTIER_PATH);
  const universe = loadOptional(UNIVERSE_PATH);
  if (!frontier) console.log('warn: kernel-eligibility-frontier.json not loaded');
  if (!universe) console.log('warn: eligible-universe.json not loaded');

  const files = fs.readdirSync(FIXTURE_DIR).filter(f => /^live_.*\.json$/.test(f));
  console.log('Loading', files.length, 'live_*.json fixtures from', FIXTURE_DIR);

  const entries = [];
  const skipped = [];

  for (const fname of files) {
    const fpath = path.join(FIXTURE_DIR, fname);
    let fx;
    try { fx = JSON.parse(fs.readFileSync(fpath, 'utf8')); } catch (e) { skipped.push({ file: fname, reason: 'parse error' }); continue; }
    fx._fixture_filename = fname;

    // Pull ticker from filename: live_TICKER_CIK.json
    const m = /^live_([A-Z0-9\.]+)_(\d+)\.json$/.exec(fname);
    if (m) {
      // Use filename ticker (more reliable than fixture body)
      const e = buildEntry(fx, frontier, universe);
      if (e) {
        if (!e.t || e.t === '') e.t = m[1];
        entries.push(e);
      } else {
        skipped.push({ file: fname, reason: 'no cik' });
      }
    } else {
      const e = buildEntry(fx, frontier, universe);
      if (e) entries.push(e);
      else skipped.push({ file: fname, reason: 'no cik' });
    }
  }

  // Sort: P7a/P7b first (most informative), then by composite desc
  const TERMINAL_PRIO = { p7a: 0, p7b: 1, p9: 2, p7: 3 };
  entries.sort((a, b) => {
    const pa = TERMINAL_PRIO[a.p];
    const pb = TERMINAL_PRIO[b.p];
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    if (pa != null && pb != null) return pa - pb;
    return (b.co || 0) - (a.co || 0);
  });

  const phase_counts = {};
  for (const e of entries) phase_counts[e.p] = (phase_counts[e.p] || 0) + 1;

  const out = {
    _generated: new Date().toISOString(),
    _purpose: 'Historical-distress companion to command-board-data.json. Companies the kernel scored with full phase resolution (including P7a/P7b/P9) but the eligibility frontier excludes due to staleness, ingestion error, or insufficient history. Required for calibration / falsification testing the universal-phase-kernel claim.',
    _source: 'diagnostic/artifacts/live_*.json fixtures',
    _frontier_filtered_count: entries.filter(e => e.eligibility_status_at_build === 'STALE' || e.eligibility_status_at_build === 'NOT_IN_FRONTIER').length,
    _phase_distribution: phase_counts,
    _total: entries.length,
    _skipped: skipped,
    companies: entries,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2));
  console.log('Wrote', entries.length, 'historical-distress entries to', OUTPUT_PATH);
  console.log('Phase distribution:', phase_counts);
  if (skipped.length) console.log('Skipped:', skipped);
}

main();
