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

function writeOutputAtomic(out, outputPath) {
  const target = outputPath || OUTPUT_PATH;
  const tmp = target + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function completeRow(row, thing0Migration) {
  return thing0Migration ? hasThing0Evidence(row) : isResumeComplete(row);
}

function validateFrontier(frontier) {
  if (!frontier || typeof frontier !== 'object' || !Array.isArray(frontier.companies)) {
    throw new Error('frontier is missing or malformed');
  }
  if (!Number.isInteger(frontier._universe_total) || !Number.isInteger(frontier._processed_total)) {
    throw new Error('frontier completeness metadata missing');
  }
  if (frontier._processed_total < frontier._universe_total) {
    throw new Error('frontier is incomplete: processed ' + frontier._processed_total +
      ' of ' + frontier._universe_total);
  }
  var seen = new Set();
  for (var i = 0; i < frontier.companies.length; i++) {
    var row = frontier.companies[i];
    if (!row || typeof row !== 'object') throw new Error('frontier row malformed at ' + i);
    var key = normCik(row.cik);
    if (!key || key === '0') throw new Error('frontier row missing CIK at ' + i);
    if (typeof row.envelope_status !== 'string') {
      throw new Error('frontier row missing envelope_status at ' + i);
    }
    if (seen.has(key)) throw new Error('duplicate frontier CIK ' + key);
    seen.add(key);
  }
}

function planCommandBoard(frontier, priorCompanies, options) {
  options = options || {};
  validateFrontier(frontier);
  var eligible = frontier.companies.filter(function (c) {
    return c.envelope_status === 'ELIGIBLE_NOW';
  });
  var existing = {};
  var existingOrder = [];
  (priorCompanies || []).forEach(function (c) {
    var key = normCik(c.c);
    if (!(key in existing)) {
      existing[key] = c;
      existingOrder.push(key);
    }
  });
  var eligibleByCik = new Map();
  eligible.forEach(function (c) {
    var key = normCik(c.cik);
    if (eligibleByCik.has(key)) throw new Error('duplicate eligible CIK ' + key);
    eligibleByCik.set(key, c);
  });
  var order = [];
  var removed = [];
  existingOrder.forEach(function (key) {
    if (eligibleByCik.has(key)) order.push(key);
    else removed.push(key);
  });
  eligible.forEach(function (c) {
    var key = normCik(c.cik);
    if (!(key in existing) && order.indexOf(key) === -1) order.push(key);
  });
  var incomplete = eligible.filter(function (c) {
    return !completeRow(existing[normCik(c.cik)], options.thing0Migration);
  });
  var queue = incomplete;
  if (options.batch > 0) queue = incomplete.slice(0, options.batch);
  var resumed = existingOrder.filter(function (key) {
    return eligibleByCik.has(key) && completeRow(existing[key], options.thing0Migration);
  }).length;
  return {
    eligible: eligible,
    existing: existing,
    existingOrder: existingOrder,
    order: order,
    removed: removed,
    removedCount: removed.length,
    incompleteCount: incomplete.length,
    queue: queue,
    resumed: resumed
  };
}

async function executePlan(plan, opts) {
  opts = opts || {};
  var outputPath = opts.outputPath || OUTPUT_PATH;
  var scoreFn = opts.scoreFn || postScore;
  var atomic = !!opts.atomic;
  var thing0Migration = !!opts.thing0Migration;
  var dryRun = !!opts.dryRun;
  var delayMs = typeof opts.delayMs === 'number' ? opts.delayMs : DELAY_MS;

  if (dryRun) {
    console.log('DRY_RUN — would score ' + plan.queue.length + ' CIKs; would remove ' +
      plan.removedCount + ' rows');
    plan.queue.slice(0, 10).forEach(function (c, i) {
      console.log('  ' + (i + 1) + '. ' + (c.ticker || '-').padEnd(8) + c.cik + '  ' +
        (c.name || '').slice(0, 38));
    });
    if (plan.queue.length > 10) console.log('  ... and ' + (plan.queue.length - 10) + ' more');
    return { scored: 0, errors: 0, wrote: false, removedCount: plan.removedCount };
  }

  if (plan.queue.length === 0 && plan.removedCount === 0) {
    console.log('Nothing to score — every eligible row already carries the required evidence. Exiting without writing.');
    return { scored: 0, errors: 0, wrote: false, removedCount: 0 };
  }

  var resultsByCik = {};
  plan.order.forEach(function (key) {
    if (plan.existing[key]) resultsByCik[key] = plan.existing[key];
  });
  var scored = 0, errors = 0, rescoredLegacy = 0;
  var start = Date.now();

  for (var i = 0; i < plan.queue.length; i++) {
    var c = plan.queue[i];
    var key = normCik(c.cik);
    var prior = plan.existing[key];
    if (prior && !completeRow(prior, thing0Migration)) rescoredLegacy++;
    var domainId = (prior && prior.d) || SECTOR_TO_DOMAIN[c.primary_sector] || 'trade';
    var slug = (prior && prior.s) || deriveSlug(c.ticker, c.name);
    var ds = (prior && typeof prior.ds === 'number') ? prior.ds : (DOMAIN_STRESS[domainId] || 0.2);

    try {
      var d = await scoreFn(c.cik);
      var t0 = d.thing0_eligibility || d.thing0Eligibility || null;
      if ((atomic || thing0Migration) && !hasThing0Evidence({ t0: t0 })) {
        throw new Error('Thing Zero evidence missing or malformed for CIK ' + c.cik);
      }
      var permitted = !!(t0 && t0.permits_thing1_use === true);
      var validated = d.validation_status === 'validated';
      var row = {
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
        vs: d.validation_status || 'unavailable',
        ds: ds,
        es: !permitted ? 'NOT_QUALIFIED_BY_THING0'
          : (validated ? 'ELIGIBLE_NOW' : 'OUT_OF_ENVELOPE'),
        t0: t0,
        sec: c.primary_sector || (prior && prior.sec) || null,
        sic: c.primary_sic || (prior && prior.sic) || null,
      };
      for (var pk of ['subTag', 'hp', 'source', 'eligibility_status_at_build']) {
        if (prior && prior[pk] !== undefined && row[pk] === undefined) row[pk] = prior[pk];
      }
      resultsByCik[key] = row;
      scored++;
    } catch (e) {
      if (atomic || thing0Migration) {
        throw new Error('Scorer failure for CIK ' + c.cik + ': ' + (e.message || String(e)));
      }
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
      console.log('  ' + (scored + errors) + '/' + plan.queue.length +
        ' (scored=' + scored + ', errors=' + errors + ')');
    }
    if (i < plan.queue.length - 1) await sleep(delayMs);
  }

  var results = plan.order.map(function (key) { return resultsByCik[key]; }).filter(Boolean);
  var out = {
    _generated: new Date().toISOString(),
    _source: 'kernel-eligibility-frontier.json (ELIGIBLE_NOW only)',
    _envelope_version: 'v1.0.1',
    _kernel_sha256: '3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20',
    _total: results.length,
    _expected: plan.eligible.length,
    _scored: scored,
    _resumed: plan.resumed,
    _removed: plan.removedCount,
    _errors: errors,
    _in_progress: false,
    companies: results,
  };
  if (atomic) writeOutputAtomic(out, outputPath);
  else writeOutput(results, plan.eligible.length, scored, errors, plan.resumed, false, outputPath, plan.removedCount);

  var dur = Math.round((Date.now() - start) / 1000);
  console.log('\n──── DONE ────');
  console.log('Run: ' + dur + 's, scored=' + scored + ', resumed=' + plan.resumed +
    ', removed=' + plan.removedCount + ', rescored_legacy=' + rescoredLegacy +
    ', errors=' + errors);
  console.log('Output: ' + outputPath);
  return { scored: scored, errors: errors, wrote: true, removedCount: plan.removedCount };
}

async function main() {
  console.log('build-command-board: reading frontier...');
  if (!fs.existsSync(FRONTIER_PATH)) {
    console.error('FATAL: ' + FRONTIER_PATH + ' missing — run probe-eligibility.js first');
    process.exit(1);
  }

  let frontier;
  try {
    frontier = JSON.parse(fs.readFileSync(FRONTIER_PATH, 'utf8'));
  } catch (e) {
    console.error('FATAL: frontier unreadable: ' + (e.message || String(e)));
    process.exit(1);
  }

  let priorCompanies = [];
  if (RESUME && fs.existsSync(OUTPUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      priorCompanies = Array.isArray(prev.companies) ? prev.companies : [];
      console.log('resume: ' + priorCompanies.length + ' rows loaded');
    } catch (e) {
      console.log('resume: prior file unreadable, starting fresh');
    }
  }

  let plan;
  try {
    plan = planCommandBoard(frontier, RESUME ? priorCompanies : [], {
      batch: BATCH,
      thing0Migration: THING0_MIGRATION
    });
  } catch (e) {
    console.error('FATAL: ' + (e.message || String(e)));
    process.exit(1);
  }

  console.log('frontier: ' + frontier.companies.length + ' total, ' +
    plan.eligible.length + ' ELIGIBLE_NOW');
  console.log('incomplete: ' + plan.incompleteCount + ', batch: ' + plan.queue.length +
    ', removed: ' + plan.removedCount);

  try {
    await executePlan(plan, {
      outputPath: OUTPUT_PATH,
      scoreFn: postScore,
      atomic: ATOMIC,
      thing0Migration: THING0_MIGRATION,
      dryRun: DRY_RUN
    });
  } catch (e) {
    console.error('FATAL: ' + (e.message || String(e)));
    process.exit(1);
  }
}

function writeOutput(rows, total, scored, errors, resumed, inProgress, outputPath, removedCount) {
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
    /* Rows removed because they left the current ELIGIBLE_NOW frontier. */
    _removed: removedCount || 0,
    _errors: errors,
    _in_progress: inProgress,
    companies: rows,
  };
  fs.writeFileSync(outputPath || OUTPUT_PATH, JSON.stringify(out));
}

if (require.main === module) {
  main().catch(e => { console.error('FATAL:', e); process.exit(1); });
}
module.exports = {
  isResumeComplete,
  numOrNull,
  validateFrontier,
  planCommandBoard,
  executePlan
};
