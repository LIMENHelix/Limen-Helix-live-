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
const ATOMIC = !!flag('atomic', false);
const THING0_MIGRATION = !!flag('thing0-migration', false);

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
  /* Refused and unvalidated results are not stability. Preserve the scorer's
     explicit state instead of deriving STABLE from the absence of an alert. */
  if (d.trajectory === 'NOT_RUN' || d.trajectory === 'UNVALIDATED') return d.trajectory;
  if (d.alert) {
    const path = d.pathway || '?';
    if (path.indexOf('C') !== -1) return 'RUPTURE';
    if (path.indexOf('A') !== -1) return 'UNRECOVERED_P3';
    if (path.indexOf('B') !== -1) return 'CASH_DECLINE';
    return 'ALERT';
  }
  return 'STABLE';
}

async function postScore(cik, retries = 1) {
  const padded = ('0000000000' + String(cik).replace(/^0+/, '')).slice(-10);
  const body = JSON.stringify({ cik: padded });
  const base = new URL(API_URL);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let url = API_URL;
    let cookie = '';
    try {
      for (let redirects = 0; redirects < 3; redirects++) {
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'limen-command-board-builder',
        };
        if (bypass) {
          headers['x-vercel-protection-bypass'] = bypass;
          headers['x-vercel-set-bypass-cookie'] = 'true';
        }
        if (cookie) headers['Cookie'] = cookie;

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (res.status === 307 || res.status === 308) {
          const loc = res.headers.get('location');
          if (!loc) throw new Error('HTTP ' + res.status + ' redirect without Location');
          const next = new URL(loc, url);
          if (next.origin !== base.origin) {
            throw new Error('redirect to unapproved origin: ' + next.origin);
          }
          const setCookies = typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
          for (const sc of setCookies) {
            const pair = sc.split(';')[0];
            if (pair) cookie = cookie ? cookie + '; ' + pair : pair;
          }
          url = next.href;
          continue;
        }

        if (res.status < 200 || res.status >= 300) {
          const text = await res.text().catch(() => '');
          const loc = res.headers.get('location') ? ' location=' + res.headers.get('location') : '';
          throw new Error('HTTP ' + res.status + loc + ': ' + text.slice(0, 160));
        }
        const ctype = res.headers.get('content-type') || '';
        if (!/application\/json/i.test(ctype)) {
          const text = await res.text().catch(() => '');
          throw new Error('Non-JSON content-type "' + ctype + '" (HTTP ' + res.status + '): ' + text.slice(0, 120));
        }
        const text = await res.text();
        try { return JSON.parse(text); } catch (e) { throw new Error('parse error: ' + e.message); }
      }
      throw new Error('too many redirects');
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

function numOrNull(v) {
  /* A null path score means the path was not computed. It is not zero. */
  return (typeof v === 'number' && isFinite(v)) ? v : null;
}

function isResumeComplete(row) {
  /* A row is complete only when Thing 0 qualified it AND Thing 1 actually
     validated. A qualified-but-unvalidated row must be retried, as must a
     transient partially_qualified result (for example sector_lookup_unavailable). */
  const t0 = row && (row.t0 || row.thing0 || row.thing0Eligibility);
  return !!(t0
    && t0.qualification_status === 'qualified'
    && t0.permits_thing1_use === true
    && row.vs === 'validated'
    && row.kid === 'limen_backtest.py');
}

function normCik(c) {
  return String(c == null ? '' : c).replace(/^0+/, '') || '0';
}

function hasThing0Evidence(row) {
  /* Migration completion means the scorer returned a well-formed Thing Zero
     object. It does not require Thing One validation; a refusal is still
     evidence and must remain visible to the board as an abstention. */
  const t0 = row && (row.t0 || row.thing0 || row.thing0Eligibility);
  return !!(t0
    && typeof t0 === 'object'
    && !Array.isArray(t0)
    && typeof t0.qualification_status === 'string'
    && typeof t0.permits_thing1_use === 'boolean');
}

function writeOutputAtomic(out) {
  const tmp = OUTPUT_PATH + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, OUTPUT_PATH);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
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

  // Resume: load every existing row so a batch never drops unprocessed rows.
  let existing = {};
  let existingOrder = [];
  if (RESUME && fs.existsSync(OUTPUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      (prev.companies || []).forEach(c => {
        const key = normCik(c.c);
        if (!(key in existing)) {
          existing[key] = c;
          existingOrder.push(key);
        }
      });
      console.log('resume: ' + existingOrder.length + ' rows loaded');
    } catch (e) { console.log('resume: prior file unreadable, starting fresh'); }
  }

  const complete = (row) => THING0_MIGRATION ? hasThing0Evidence(row) : isResumeComplete(row);
  const frontierKeys = eligible.map(c => normCik(c.cik));
  const order = existingOrder.slice();
  for (const key of frontierKeys) {
    if (!order.includes(key)) order.push(key);
  }

  const incomplete = eligible.filter(c => !complete(existing[normCik(c.cik)]));
  let queue = incomplete;
  if (BATCH > 0) queue = queue.slice(0, BATCH);
  console.log('incomplete: ' + incomplete.length + ', batch: ' + queue.length);

  if (!queue.length) {
    console.log('Nothing to score — every eligible row already carries the required evidence. Exiting without writing.');
    return;
  }

  if (DRY_RUN) {
    console.log('DRY_RUN — would score ' + queue.length + ' CIKs:');
    queue.slice(0, 10).forEach((c, i) => console.log('  ' + (i + 1) + '. ' + (c.ticker || '-').padEnd(8) + c.cik + '  ' + (c.name || '').slice(0, 38)));
    if (queue.length > 10) console.log('  ... and ' + (queue.length - 10) + ' more');
    return;
  }

  const resultsByCik = {};
  for (const key of existingOrder) resultsByCik[key] = existing[key];
  let scored = 0, errors = 0, rescoredLegacy = 0;
  const start = Date.now();

  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const key = normCik(c.cik);
    const prior = existing[key];
    /* Normal resume keeps the terminal-success predicate. Thing Zero migration
       uses scorer-returned evidence as its completion criterion. */
    if (!THING0_MIGRATION && isResumeComplete(prior)) {
      resultsByCik[key] = prior;
      continue;
    }
    if (prior && !complete(prior)) rescoredLegacy++;

    const domainId = (prior && prior.d) || SECTOR_TO_DOMAIN[c.primary_sector] || 'trade';
    const slug = (prior && prior.s) || deriveSlug(c.ticker, c.name);
    const ds = (prior && typeof prior.ds === 'number') ? prior.ds : (DOMAIN_STRESS[domainId] || 0.2);

    try {
      const d = await postScore(c.cik);
      const t0 = d.thing0_eligibility || d.thing0Eligibility || null;
      if ((ATOMIC || THING0_MIGRATION) && !hasThing0Evidence({ t0 })) {
        throw new Error('Thing Zero evidence missing or malformed for CIK ' + c.cik);
      }
      const permitted = !!(t0 && t0.permits_thing1_use === true);
      const validated = d.validation_status === 'validated';
      const row = {
        n: (prior && prior.n) || c.name,
        t: (prior && prior.t) || c.ticker || '',
        c: (prior && prior.c) || c.cik,
        s: slug,
        d: domainId,
        p: d.dominant_phase || '?',
        tr: deriveTrajectory(d),
        co: numOrNull(d.composite_score),
        a: d.alert === true,
        path: d.pathway || null,
        pa: numOrNull(d.path_a_score),
        pb: numOrNull(d.path_b_score),
        pc: numOrNull(d.path_c_score),
        fq: d.first_alert_quarter || null,
        q: d.latest_quarter || null,
        hist: d.history_quarters || 0,
        kid: d.kernel_id || 'limen_backtest.py',
        // Record what the scorer actually returned; never stamp validated.
        vs: d.validation_status || 'unavailable',
        ds: ds,
        es: !permitted ? 'NOT_QUALIFIED_BY_THING0'
          : (validated ? 'ELIGIBLE_NOW' : 'OUT_OF_ENVELOPE'),
        t0: t0,
        sec: c.primary_sector || (prior && prior.sec) || null,
        sic: c.primary_sic || (prior && prior.sic) || null,
      };
      /* Preserve fields the existing feed owns that this producer does not
         recompute. Identity, domain and slug are preserved above. */
      for (const k of ['subTag', 'hp', 'source', 'eligibility_status_at_build']) {
        if (prior && prior[k] !== undefined && row[k] === undefined) row[k] = prior[k];
      }
      resultsByCik[key] = row;
      scored++;
    } catch (e) {
      if (ATOMIC || THING0_MIGRATION) {
        throw new Error('Scorer failure for CIK ' + c.cik + ': ' + (e.message || String(e)));
      }
      // Legacy non-atomic mode only. Migration mode never writes error rows.
      resultsByCik[key] = {
        n: c.name, t: c.ticker || '', c: c.cik, s: slug, d: domainId,
        p: '?', tr: 'ERROR_AT_REBUILD', co: 0, a: false,
        path: null, pa: 0, pb: 0, pc: 0,
        fq: null, q: c.latest_quarter || null, hist: c.history_quarters || 0,
        kid: 'limen_backtest.py', vs: 'rebuild_error', ds: ds,
        es: 'REBUILD_ERROR', sec: c.primary_sector || null, sic: c.primary_sic || null,
        rebuild_error: (e.message || String(e)).slice(0, 200),
      };
      errors++;
    }

    if ((scored + errors) % 25 === 0 && (scored + errors) > 0) {
      console.log('  ' + (scored + errors) + '/' + queue.length + ' (scored=' + scored + ', errors=' + errors + ')');
    }

    if (i < queue.length - 1) await sleep(DELAY_MS);
  }

  const results = order.map(k => resultsByCik[k]).filter(Boolean);
  const resumed = existingOrder.filter(k => complete(existing[k])).length;
  const out = {
    _generated: new Date().toISOString(),
    _source: 'kernel-eligibility-frontier.json (ELIGIBLE_NOW only)',
    _envelope_version: 'v1.0.1',
    _kernel_sha256: '3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20',
    _total: results.length,
    _expected: eligible.length,
    /* Last-invocation counts, not corpus coverage. */
    _scored: scored,
    _resumed: resumed,
    _errors: errors,
    _in_progress: false,
    companies: results,
  };
  if (ATOMIC) writeOutputAtomic(out);
  else writeOutput(results, eligible.length, scored, errors, resumed, false);

  const dur = Math.round((Date.now() - start) / 1000);
  console.log('\n──── DONE ────');
  console.log('Run: ' + dur + 's, scored=' + scored + ', resumed=' + resumed +
    ', rescored_legacy=' + rescoredLegacy + ', errors=' + errors);
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
    /* Last-invocation counts, not corpus coverage. */
    _scored: scored,
    _resumed: resumed,
    _errors: errors,
    _in_progress: inProgress,
    companies: rows,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out));
}

if (require.main === module) {
  main().catch(e => { console.error('FATAL:', e); process.exit(1); });
}
module.exports = { isResumeComplete, numOrNull };
