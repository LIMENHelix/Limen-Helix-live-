#!/usr/bin/env node
/**
 * build-command-board.js — Build the rebuilt Command Board feed from the
 * kernel eligibility frontier.
 *
 * Reads:  assets/data/kernel-eligibility-frontier.json (probe output)
 * Writes: assets/data/command-board-eligible.json (Command Board source)
 *
 * For each frontier row with envelope_status === 'ELIGIBLE_NOW', POSTs
 * /api/limen/score and emits a row in the shape kernel-comparison.html
 * expects (n,t,c,s,d,p,tr,co,a,path,pa,pb,pc,fq,q,hist,kid,vs,ds), plus
 * the new envelope-aware fields (es, dc_dl_ratio, weeks_since_latest).
 *
 * Why this exists: the probe stored gate facts only (history_quarters,
 * latest_quarter, DC/DL coverage). Command Board needs the kernel
 * verdict (alert, composite, phase, pathway). This script does the
 * second pass for just the 302 ELIGIBLE_NOW CIKs (~6 min @ 1.2s/call,
 * concurrency 1, 300ms delay).
 *
 * Hard rules per Operating Envelope §6.3 / §9 enforced in output:
 *   - No threshold constants stored or rendered
 *   - No PR-AUC / FPR fields populated
 *   - validation_status = 'validated' only when envelope passed
 *
 * Usage:
 *   node scripts/build-command-board.js                  # full rebuild
 *   node scripts/build-command-board.js --batch 50       # cap to 50
 *   node scripts/build-command-board.js --resume         # skip already-scored
 *   node scripts/build-command-board.js --dry-run        # preview, no API calls
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'assets', 'data');
const FRONTIER_PATH = path.join(DATA_DIR, 'kernel-eligibility-frontier.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'command-board-eligible.json');

const BASE_URL = process.env.LIMEN_BASE_URL || 'https://www.limenhelix.com';
const API_URL  = BASE_URL + '/api/limen/score';
const DELAY_MS = 300;
const TIMEOUT_MS = 60000;

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return def;
  if (argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return true;
}
const BATCH = parseInt(flag('batch', 0), 10) || 0;
const RESUME = !!flag('resume', false);
const DRY_RUN = !!flag('dry-run', false);

// Sector → domainId mapping (imperfect — some sectors map to multiple LIMEN
// domains; pick the most representative). domainStress overlay reads the
// LIMEN domain side, not the §3.3 sector side.
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

const DOMAIN_STRESS = {
  energy: 0.77, infrastructure: 0.30, supplyChain: 1.00, finance: 0.44,
  law: 0.50, industry: 0.58, economy: 0.13, environment: 0.80,
  technology: 0.51, defense: 0.52, intelligence: 0.51, health: 0.65,
  communication: 0.07, culture: 0.30, religion: 0.28, population: 0.25,
  education: 0.20, p2_agri: 0.00, governance: 0.32, trade: 0.30,
  science: 0.28, medicine: 0.65,
};

function deriveSlug(ticker, name) {
  // Default slug derivation. Most won't match an existing portal JSON;
  // those rows' portal-link will land on Company Portal "not found"
  // gracefully. Helix Report fallback (cik) always works.
  const base = (ticker || name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || null;
}

function deriveTrajectory(d) {
  if (!d) return 'NO_DATA';
  if (d.alert) {
    const path = d.pathway || '?';
    if (path.indexOf('C') !== -1) return 'RUPTURE';
    if (path.indexOf('A') !== -1) return 'UNRECOVERED_P3';
    if (path.indexOf('B') !== -1) return 'CASH_DECLINE';
    return 'ALERT';
  }
  return 'STABLE';
}

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
      'User-Agent': 'limen-command-board-builder',
    },
    timeout: TIMEOUT_MS,
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ': ' + data.slice(0, 160)));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', (e) => {
      if (retries > 0) return setTimeout(() => postScore(cik, retries - 1).then(resolve).catch(reject), 1500);
      reject(e);
    });
    req.on('timeout', () => {
      req.destroy();
      if (retries > 0) return setTimeout(() => postScore(cik, retries - 1).then(resolve).catch(reject), 1500);
      reject(new Error('timeout'));
    });
    req.write(body);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('build-command-board: reading frontier...');
  if (!fs.existsSync(FRONTIER_PATH)) {
    console.error('FATAL: ' + FRONTIER_PATH + ' missing — run probe-eligibility.js first');
    process.exit(1);
  }
  const frontier = JSON.parse(fs.readFileSync(FRONTIER_PATH, 'utf8'));
  const eligible = frontier.companies.filter(c => c.envelope_status === 'ELIGIBLE_NOW');
  console.log('frontier: ' + frontier.companies.length + ' total, ' + eligible.length + ' ELIGIBLE_NOW');

  // Resume: skip CIKs already in output
  let existing = {};
  if (RESUME && fs.existsSync(OUTPUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      (prev.companies || []).forEach(c => { existing[c.c] = c; });
      console.log('resume: ' + Object.keys(existing).length + ' rows already scored');
    } catch (e) { console.log('resume: prior file unreadable, starting fresh'); }
  }

  let queue = eligible.slice();
  if (BATCH > 0) queue = queue.slice(0, BATCH);

  if (DRY_RUN) {
    console.log('DRY_RUN — would score ' + queue.length + ' CIKs:');
    queue.slice(0, 10).forEach((c, i) => console.log('  ' + (i + 1) + '. ' + (c.ticker || '-').padEnd(8) + c.cik + '  ' + (c.name || '').slice(0, 38)));
    if (queue.length > 10) console.log('  ... and ' + (queue.length - 10) + ' more');
    return;
  }

  const results = [];
  let scored = 0, errors = 0, resumed = 0;
  const start = Date.now();

  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (existing[c.cik]) { results.push(existing[c.cik]); resumed++; continue; }

    const domainId = SECTOR_TO_DOMAIN[c.primary_sector] || 'trade';
    const slug = deriveSlug(c.ticker, c.name);
    const ds = DOMAIN_STRESS[domainId] || 0.2;

    try {
      const d = await postScore(c.cik);
      results.push({
        n: c.name, t: c.ticker || '', c: c.cik, s: slug, d: domainId,
        p: d.dominant_phase || '?',
        tr: deriveTrajectory(d),
        co: d.composite_score || 0,
        a: !!d.alert,
        path: d.pathway || null,
        pa: d.path_a_score || 0,
        pb: d.path_b_score || 0,
        pc: d.path_c_score || 0,
        fq: d.first_alert_quarter || null,
        q:  d.latest_quarter || null,
        hist: d.history_quarters || 0,
        kid: 'limen_backtest.py',
        vs: 'validated',
        ds: ds,
        // Envelope-aware fields (new — page can render badge if it wants)
        es: 'ELIGIBLE_NOW',
        sec: c.primary_sector || null,
        sic: c.primary_sic || null,
      });
      scored++;
    } catch (e) {
      // Surprising — frontier said ELIGIBLE_NOW but API failed. Record it
      // so the page can show the rare anomaly without crashing.
      results.push({
        n: c.name, t: c.ticker || '', c: c.cik, s: slug, d: domainId,
        p: '?', tr: 'ERROR_AT_REBUILD', co: 0, a: false,
        path: null, pa: 0, pb: 0, pc: 0,
        fq: null, q: c.latest_quarter || null, hist: c.history_quarters || 0,
        kid: 'limen_backtest.py', vs: 'rebuild_error', ds: ds,
        es: 'ELIGIBLE_NOW', sec: c.primary_sector || null, sic: c.primary_sic || null,
        rebuild_error: (e.message || String(e)).slice(0, 200),
      });
      errors++;
    }

    if ((scored + errors) % 25 === 0 && (scored + errors) > 0) {
      console.log('  ' + (scored + errors + resumed) + '/' + queue.length + ' (scored=' + scored + ' resumed=' + resumed + ' errors=' + errors + ')');
      // Checkpoint
      writeOutput(results, queue.length, scored, errors, resumed, true);
    }

    if (i < queue.length - 1) await sleep(DELAY_MS);
  }

  writeOutput(results, queue.length, scored, errors, resumed, false);
  const dur = Math.round((Date.now() - start) / 1000);
  console.log('\n──── DONE ────');
  console.log('Run: ' + dur + 's, scored=' + scored + ', resumed=' + resumed + ', errors=' + errors);
  console.log('Output: ' + OUTPUT_PATH);
}

function writeOutput(rows, total, scored, errors, resumed, inProgress) {
  const out = {
    _generated: new Date().toISOString(),
    _source: 'kernel-eligibility-frontier.json (ELIGIBLE_NOW only)',
    _envelope_version: 'v1.0.1',
    _kernel_sha256: '3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20',
    _total: rows.length,
    _expected: total,
    _scored: scored,
    _resumed: resumed,
    _errors: errors,
    _in_progress: inProgress,
    companies: rows,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
