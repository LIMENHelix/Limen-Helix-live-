#!/usr/bin/env node
/**
 * probe-eligibility.js — Kernel eligibility probe for the §3.3 universe.
 *
 * Per LIMEN Operating Envelope Statement v1.0.1, derives per-CIK envelope
 * status from facts the validated kernel returns. Does NOT pre-classify;
 * runs the CIK through the kernel and reads the answers back.
 *
 *   §4.1 history_quarters >= 8        → else INSUFFICIENT_HISTORY
 *   §4.2 latest_quarter <= 2 quarters → else STALE
 *   §4.3 implicit (kernel filters >= 2015)
 *   §4.4 min(DC,DL)/max(DC,DL) >= 0.5 → else INGESTION_SUSPECT
 *   §4.5 sector membership            → DEFERRED (render-layer policy)
 *
 * Inputs:  assets/data/eligible-universe.json
 * Outputs: assets/data/kernel-eligibility-frontier.json
 *
 * Cadence: BATCH_PER_RUN=350 default. 10,526 / 350 ≈ 30 days for first sweep.
 * After sweep, picks CIKs whose next_check_date <= today.
 *
 * Hard rules per Operating Envelope §6.3 / §9:
 *   - No threshold constants or weights in output.
 *   - No PR-AUC / FPR citation (suspended per §7.1).
 *   - No VALIDATED branding side-effect — probe writes gate facts only.
 *
 * Usage:
 *   node scripts/probe-eligibility.js                  # daily batch (350)
 *   node scripts/probe-eligibility.js --batch 100      # custom batch size
 *   node scripts/probe-eligibility.js --batch 100 --smoke  # mark as smoke run
 *   node scripts/probe-eligibility.js --reset          # wipe frontier (DANGER)
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'assets', 'data');
const UNIVERSE_PATH = path.join(DATA_DIR, 'eligible-universe.json');
const FRONTIER_PATH = path.join(DATA_DIR, 'kernel-eligibility-frontier.json');

const BASE_URL = process.env.LIMEN_BASE_URL || 'https://www.limenhelix.com';
const API_URL  = BASE_URL + '/api/limen/score';
const DELAY_MS = 300;
const TIMEOUT_MS = 60000;
const CHECKPOINT_EVERY = 25;

const ENVELOPE_VERSION = 'v1.0.1';
const KERNEL_SHA256 = '3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20';

// ── CLI ──
const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return def;
  if (argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return true;
}
const BATCH_PER_RUN = parseInt(flag('batch', 350), 10);
const SMOKE = !!flag('smoke', false);
const DRY_RUN = !!flag('dry-run', false);
const RESET = !!flag('reset', false);

// ── Quarter math ──
function parseQuarter(qstr) {
  // "2024Q3" → { year: 2024, q: 3 }
  if (!qstr || typeof qstr !== 'string') return null;
  const m = qstr.match(/^(\d{4})Q([1-4])$/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), q: parseInt(m[2], 10) };
}
function quarterEndDate(yearQ) {
  // Last day of fiscal quarter q (calendar-quarter approximation; sufficient
  // for §4.2 staleness — kernel uses fy+fp from XBRL, which is fiscal-aligned.
  // Most filers are calendar-aligned; off-cycle fiscals will read slightly
  // staler/fresher but stay within the 2-quarter envelope tolerance).
  const monthEnd = [null, 3, 6, 9, 12][yearQ.q]; // Q1→Mar, Q2→Jun, Q3→Sep, Q4→Dec
  // Last day of that month
  return new Date(Date.UTC(yearQ.year, monthEnd, 0));
}
function weeksBetween(d1, d2) {
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 7));
}
function isoDateOnly(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

// ── Status derivation ──
function deriveStatus(apiResponse) {
  const hist = apiResponse.history_quarters || 0;
  const latestStr = apiResponse.latest_quarter || null;
  const ip = apiResponse.input_presence || {};
  const dc = ip.dc_coverage_quarters || 0;
  const dl = ip.dl_coverage_quarters || 0;

  const facts = {
    history_quarters: hist,
    latest_quarter: latestStr,
    weeks_since_latest: null,
    dc_coverage_quarters: dc,
    dl_coverage_quarters: dl,
    dc_dl_ratio: null,
  };

  // §4.1 priority
  if (hist < 8) {
    return { status: 'INSUFFICIENT_HISTORY', facts, reasons: [`history=${hist} < 8`] };
  }

  // §4.2
  const yq = parseQuarter(latestStr);
  if (!yq) {
    return { status: 'ERROR', facts, reasons: ['unparseable latest_quarter: ' + latestStr] };
  }
  const qend = quarterEndDate(yq);
  const weeks = weeksBetween(qend, new Date());
  facts.weeks_since_latest = weeks;
  // 2 quarters ≈ 26 weeks (per spec §4.2)
  if (weeks > 26) {
    return { status: 'STALE', facts, reasons: [`weeks_since_latest=${weeks} > 26`] };
  }

  // §4.4 — coverage symmetry ratio
  const lo = Math.min(dc, dl);
  const hi = Math.max(dc, dl);
  const ratio = hi > 0 ? lo / hi : 0;
  facts.dc_dl_ratio = Number(ratio.toFixed(3));
  if (hi === 0) {
    return { status: 'INGESTION_SUSPECT', facts, reasons: ['both DC and DL coverage are 0'] };
  }
  if (ratio < 0.5) {
    return { status: 'INGESTION_SUSPECT', facts, reasons: [`dc_dl_ratio=${ratio.toFixed(3)} < 0.5 (dc=${dc}, dl=${dl})`] };
  }

  // §4.3 implicit. §4.5 deferred.
  return { status: 'ELIGIBLE_NOW', facts, reasons: [] };
}

function nextCheckDate(status, facts) {
  // Heuristic re-check cadence per status. 10-Qs file ~quarterly so most
  // status changes happen ~90 days after the latest filing.
  const today = new Date();
  switch (status) {
    case 'ELIGIBLE_NOW':
      return isoDateOnly(addDays(today, 90));
    case 'INSUFFICIENT_HISTORY': {
      const need = Math.max(1, 8 - (facts.history_quarters || 0));
      return isoDateOnly(addDays(today, Math.min(365, 90 * need)));
    }
    case 'STALE':
      return isoDateOnly(addDays(today, 30));
    case 'INGESTION_SUSPECT':
      return isoDateOnly(addDays(today, 90));
    case 'ERROR':
      return isoDateOnly(addDays(today, 30));
    default:
      return isoDateOnly(addDays(today, 30));
  }
}

// ── HTTP ──
function postScore(cik, retries = 1) {
  const padded = ('0000000000' + String(cik).replace(/^0+/, '')).slice(-10);
  const body = JSON.stringify({ cik: padded });
  const u = new URL(API_URL);
  const opts = {
    method: 'POST',
    hostname: u.hostname,
    path: u.pathname + u.search,
    port: u.port || 443,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'limen-eligibility-probe',
    },
    timeout: TIMEOUT_MS,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error('HTTP ' + res.statusCode + ': ' + data.slice(0, 160)));
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('parse error: ' + e.message)); }
      });
    });
    req.on('error', (e) => {
      if (retries > 0) {
        return setTimeout(() => postScore(cik, retries - 1).then(resolve).catch(reject), 1500);
      }
      reject(e);
    });
    req.on('timeout', () => {
      req.destroy();
      if (retries > 0) {
        return setTimeout(() => postScore(cik, retries - 1).then(resolve).catch(reject), 1500);
      }
      reject(new Error('timeout'));
    });
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Frontier I/O ──
function loadFrontier() {
  if (!fs.existsSync(FRONTIER_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(FRONTIER_PATH, 'utf8')); }
  catch (e) { return null; }
}
function writeFrontier(state) {
  state._generated = new Date().toISOString();
  state._envelope_version = ENVELOPE_VERSION;
  state._kernel_sha256 = KERNEL_SHA256;
  // Recompute status counts on every write — cheap and keeps file self-describing
  const counts = {};
  for (const row of state.companies) {
    counts[row.envelope_status] = (counts[row.envelope_status] || 0) + 1;
  }
  state._status_counts = counts;
  state._processed_total = state.companies.length;
  fs.writeFileSync(FRONTIER_PATH, JSON.stringify(state, null, 0));
}

function pickBatch(universe, frontier, batchSize) {
  // Index frontier by CIK
  const seen = new Map();
  if (frontier) {
    for (const row of frontier.companies || []) {
      seen.set(row.cik, row);
    }
  }
  const today = isoDateOnly(new Date());
  const unprocessed = [];
  const due = [];
  for (const co of universe.companies) {
    const prev = seen.get(co.cik);
    if (!prev) { unprocessed.push(co); continue; }
    if (prev.next_check_date && prev.next_check_date <= today) due.push(co);
  }
  // Unprocessed first, then due-for-recheck. Cap at batchSize.
  return [...unprocessed, ...due].slice(0, batchSize);
}

// ── Main ──
async function main() {
  console.log(`probe-eligibility @ envelope ${ENVELOPE_VERSION}, kernel sha256 ${KERNEL_SHA256.slice(0, 12)}...`);
  console.log(`API: ${API_URL}`);
  console.log(`batch=${BATCH_PER_RUN}, smoke=${SMOKE}, dry_run=${DRY_RUN}, reset=${RESET}`);

  if (!fs.existsSync(UNIVERSE_PATH)) {
    console.error('FATAL: eligible-universe.json missing at ' + UNIVERSE_PATH);
    process.exit(1);
  }
  const universe = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
  console.log(`universe: ${universe.companies.length} CIKs (§3.3 SIC-eligible)`);

  let frontier = RESET ? null : loadFrontier();
  if (!frontier) {
    frontier = {
      _generated: null,
      _envelope_version: ENVELOPE_VERSION,
      _kernel_sha256: KERNEL_SHA256,
      _universe_total: universe.companies.length,
      _processed_total: 0,
      _status_counts: {},
      _last_run: null,
      companies: [],
    };
  }
  const frontierIndex = new Map();
  for (const row of frontier.companies) frontierIndex.set(row.cik, row);

  const batch = pickBatch(universe, frontier, BATCH_PER_RUN);
  console.log(`batch picked: ${batch.length} CIKs (universe=${universe.companies.length}, frontier=${frontier.companies.length})`);

  if (batch.length === 0) {
    console.log('Nothing to do — universe fully processed and nothing due. Exiting.');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY_RUN — would probe these CIKs:');
    batch.slice(0, 10).forEach((co, i) => console.log(`  ${i + 1}. ${co.cik} ${co.ticker} ${co.name}`));
    if (batch.length > 10) console.log(`  ... and ${batch.length - 10} more`);
    return;
  }

  const runStart = new Date();
  let scored = 0, errors = 0, statusCounts = {};

  for (let i = 0; i < batch.length; i++) {
    const co = batch[i];
    let row;
    try {
      const resp = await postScore(co.cik);
      const { status, facts, reasons } = deriveStatus(resp);
      row = {
        cik: co.cik,
        ticker: co.ticker || '',
        name: co.name || '',
        primary_sic: co.primary_sic || '',
        primary_sector: co.primary_sector || '',
        ...facts,
        envelope_status: status,
        ineligible_reasons: reasons,
        sector_resolution_status: 'deferred', // §4.5 not probed
        checked_at: new Date().toISOString(),
        next_check_date: nextCheckDate(status, facts),
      };
      scored++;
    } catch (e) {
      const msg = (e.message || String(e)).slice(0, 200);
      row = {
        cik: co.cik,
        ticker: co.ticker || '',
        name: co.name || '',
        primary_sic: co.primary_sic || '',
        primary_sector: co.primary_sector || '',
        history_quarters: 0,
        latest_quarter: null,
        weeks_since_latest: null,
        dc_coverage_quarters: 0,
        dl_coverage_quarters: 0,
        dc_dl_ratio: null,
        envelope_status: 'ERROR',
        ineligible_reasons: [msg],
        sector_resolution_status: 'deferred',
        checked_at: new Date().toISOString(),
        next_check_date: nextCheckDate('ERROR', {}),
      };
      errors++;
    }

    // Upsert into frontier
    const existingIdx = frontier.companies.findIndex((r) => r.cik === co.cik);
    if (existingIdx >= 0) frontier.companies[existingIdx] = row;
    else frontier.companies.push(row);
    statusCounts[row.envelope_status] = (statusCounts[row.envelope_status] || 0) + 1;

    if ((i + 1) % CHECKPOINT_EVERY === 0 || i === batch.length - 1) {
      frontier._last_run = {
        started: runStart.toISOString(),
        in_progress: i < batch.length - 1,
        batch_size: batch.length,
        completed_in_run: i + 1,
        scored, errors,
        smoke: SMOKE,
      };
      writeFrontier(frontier);
      const summary = Object.entries(statusCounts).map(([k, v]) => `${k}=${v}`).join(' ');
      console.log(`  ${i + 1}/${batch.length} [${summary}]`);
    }

    if (i < batch.length - 1) await sleep(DELAY_MS);
  }

  const runEnd = new Date();
  frontier._last_run = {
    started: runStart.toISOString(),
    ended: runEnd.toISOString(),
    duration_seconds: Math.round((runEnd - runStart) / 1000),
    in_progress: false,
    batch_size: batch.length,
    completed_in_run: batch.length,
    scored, errors,
    smoke: SMOKE,
  };
  writeFrontier(frontier);

  console.log('\n──── DONE ────');
  console.log(`Run: ${frontier._last_run.duration_seconds}s, scored=${scored}, errors=${errors}`);
  console.log(`Frontier: ${frontier.companies.length}/${universe.companies.length} CIKs processed`);
  console.log(`Status counts (this batch): ` + JSON.stringify(statusCounts));
  console.log(`Status counts (frontier total): ` + JSON.stringify(frontier._status_counts));
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
