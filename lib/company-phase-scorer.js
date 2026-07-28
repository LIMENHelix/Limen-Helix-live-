/**
 * api/lib/company-phase-scorer.js — Phase 25 + Priority Scheduler
 *
 * Priority-aware parallel company phase scoring via validated financial kernel.
 *
 * Scheduling policy:
 *   1. Unscored companies in domains where stress >= ELEVATED
 *   2. Stale scores in elevated domains (age > ELEVATED_DOMAIN_TTL)
 *   3. Normal round-robin backlog
 *
 * Each cycle scores up to PRIORITY_BATCH + ROUND_ROBIN_BATCH companies in parallel.
 * Selection reason logged per company for convergence audit trail.
 *
 * Called by limen-worker-snapshot.js on each cron cycle.
 * Caller must pass current domainHealth for priority decisions.
 *
 * Uses: limen-helix-api.vercel.app/api/score/{cik} (validated kernel)
 * Stores: limen:company_phase:{cik} -> { phase, trajectory, timestamp, ... }
 *         limen:company_score_queue -> { pointer, lastRun }
 *         limen:domain_company_join -> { domain -> { mapped, p7a_count, ... } }
 *         limen:score_run_log -> [{ timestamp, scored, reasons }] (last 100)
 */

var db = require('./limen-db');
var DOMAIN_NAMES = require('./domain-names');

// ══════════════════════════════════════════════════════════════════════
// SECTION 4 — THRESHOLD CONSTANTS (CONFIG)
// ══════════════════════════════════════════════════════════════════════

var CONFIG = {
  // Signal class thresholds
  DOMAIN_STRESS_ELEVATED: 0.65,
  DOMAIN_STRESS_HIGH: 0.70,
  P7A_COUNT_MIN: 2,
  P3_COUNT_MIN: 3,

  // Scoring infrastructure — the validated kernel at /api/limen/score.
  // ⚠ MUST use the PUBLIC production domain. process.env.VERCEL_URL is the
  // deployment-specific URL which sits behind Deployment Protection and returns
  // a 401 HTML auth page (not JSON) — that silently broke ALL scoring
  // ("Unexpected token '<'", totalScored:0) for every company. Public domain only.
  SCORE_API_BASE: 'https://limenhelix.com/api/limen/score',
  SCORE_TIMEOUT_MS: 18000,            // 18s: worker has an 800s budget; let slow CIKs finish instead of timing out (was 12s → ~40% timed out)
  COMPANY_PHASE_TTL: 86400,           // 24h — company phases are quarterly
  DOMAIN_JOIN_TTL: 600,               // 10 min — recomputed frequently

  // Priority scheduler — bumped for 506-CIK Command Board coverage.
  // 30/30 + ~1.5s/score with 10-wide parallelism = ~90s per cron tick,
  // full cycle in ~30 min (506/(30+30) ≈ 8.4 ticks × 3 min = 25 min).
  PRIORITY_BATCH_SIZE: 30,
  ROUND_ROBIN_BATCH_SIZE: 30,
  ELEVATED_DOMAIN_TTL_MINUTES: 15,    // rescore elevated domain companies if older than this
  GLOBAL_SCORE_STALE_MINUTES: 180,    // global round-robin staleness threshold

  // Storage keys
  QUEUE_KEY: 'company_score_queue',
  DOMAIN_JOIN_KEY: 'domain_company_join',
  SCORE_LOG_KEY: 'score_run_log',
  TRANSITION_LOG_KEY: 'phase_transitions',  // append-only log of phase changes
  TRANSITION_LOG_MAX: 500                   // keep last N transitions
};

// ══════════════════════════════════════════════════════════════════════
// COMPANY REGISTRY — dynamic from command-board-data.json (loaded once
// per cold start). The bundled hardcoded list below is kept as a
// fallback only; in production the loader replaces it with all 506
// Command Board CIKs.
// ══════════════════════════════════════════════════════════════════════

var fs = require('fs');
var path = require('path');

function _normCik(c) {
  if (c === null || c === undefined) return '';
  var s = String(c).trim();
  return s.replace(/^0+/, '') || '0';
}

var _CB_PATHS = [
  path.join(__dirname, '..', 'assets', 'data', 'command-board-data.json'),
  '/var/task/assets/data/command-board-data.json',
  path.join(process.cwd(), 'assets', 'data', 'command-board-data.json')
];

function _loadRegistryFromCommandBoard() {
  for (var i = 0; i < _CB_PATHS.length; i++) {
    try {
      if (!fs.existsSync(_CB_PATHS[i])) continue;
      var raw = fs.readFileSync(_CB_PATHS[i], 'utf8');
      var cb = JSON.parse(raw);
      var companies = (cb && cb.companies) || [];
      if (!Array.isArray(companies) || companies.length === 0) continue;
      var out = [];
      var seen = {};
      for (var j = 0; j < companies.length; j++) {
        var c = companies[j];
        if (!c || !c.c) continue;
        var cik = _normCik(c.c);
        if (seen[cik]) continue; // dedupe — CB can have multi-domain entries per CIK
        seen[cik] = true;
        out.push({ cik: cik, ticker: c.t || null, name: c.n || null, phase: c.p || null, trajectory: c.tr || null, domain: c.d || 'unknown' });
      }
      return out;
    } catch (_) { /* try next path */ }
  }
  return null;
}

var COMPANY_REGISTRY = _loadRegistryFromCommandBoard() || [
  // economy
  { cik: '19617', ticker: 'JPM', domain: 'economy' },
  { cik: '104169', ticker: 'WMT', domain: 'economy' },
  { cik: '18230', ticker: 'CAT', domain: 'economy' },
  { cik: '1048911', ticker: 'FDX', domain: 'economy' },
  // energy — integrated majors
  { cik: '34088', ticker: 'XOM', domain: 'energy', group: 'integrated' },
  { cik: '93410', ticker: 'CVX', domain: 'energy', group: 'integrated' },
  { cik: '1163165', ticker: 'COP', domain: 'energy', group: 'ep' },
  { cik: '858470', ticker: 'EOG', domain: 'energy', group: 'ep' },
  { cik: '4447', ticker: 'HES', domain: 'energy', group: 'ep' },
  { cik: '1674101', ticker: 'DVN', domain: 'energy', group: 'ep' },
  { cik: '1764925', ticker: 'FANG', domain: 'energy', group: 'ep' },
  { cik: '1130310', ticker: 'MPC', domain: 'energy', group: 'refiner' },
  { cik: '1534701', ticker: 'PSX', domain: 'energy', group: 'refiner' },
  { cik: '764065', ticker: 'VLO', domain: 'energy', group: 'refiner' },
  // energy — oilfield services
  { cik: '87347', ticker: 'SLB', domain: 'energy', group: 'services' },
  { cik: '808362', ticker: 'HAL', domain: 'energy', group: 'services' },
  { cik: '36104', ticker: 'BKR', domain: 'energy', group: 'services' },
  // energy — midstream / pipeline
  { cik: '1545654', ticker: 'KMI', domain: 'energy', group: 'midstream' },
  { cik: '1126956', ticker: 'WMB', domain: 'energy', group: 'midstream' },
  { cik: '1061219', ticker: 'OKE', domain: 'energy', group: 'midstream' },
  { cik: '316206', ticker: 'ET', domain: 'energy', group: 'midstream' },
  // energy — utilities / grid
  { cik: '753308', ticker: 'NEE', domain: 'energy', group: 'utility' },
  { cik: '1004980', ticker: 'DUK', domain: 'energy', group: 'utility' },
  { cik: '72741', ticker: 'SO', domain: 'energy', group: 'utility' },
  { cik: '1109357', ticker: 'D', domain: 'energy', group: 'utility' },
  { cik: '49196', ticker: 'AEP', domain: 'energy', group: 'utility' },
  { cik: '24545', ticker: 'EXC', domain: 'energy', group: 'utility' },
  { cik: '788784', ticker: 'SRE', domain: 'energy', group: 'utility' },
  // energy — renewables / solar / wind
  { cik: '1318605', ticker: 'TSLA', domain: 'energy', group: 'renewable' },
  { cik: '1657312', ticker: 'ENPH', domain: 'energy', group: 'solar' },
  { cik: '1469367', ticker: 'FSLR', domain: 'energy', group: 'solar' },
  { cik: '1603145', ticker: 'RUN', domain: 'energy', group: 'solar' },
  { cik: '1419612', ticker: 'SEDG', domain: 'energy', group: 'solar' },
  // energy — nuclear
  { cik: '1211348', ticker: 'CCJ', domain: 'energy', group: 'nuclear' },
  { cik: '105634', ticker: 'VST', domain: 'energy', group: 'nuclear' },
  // energy — battery / storage
  { cik: '1585521', ticker: 'QS', domain: 'energy', group: 'battery' },
  // energy — LNG / gas
  { cik: '3570', ticker: 'CHK', domain: 'energy', group: 'gas' },
  { cik: '1392380', ticker: 'AR', domain: 'energy', group: 'gas' },
  { cik: '1374690', ticker: 'EQT', domain: 'energy', group: 'gas' },
  // technology
  { cik: '1045810', ticker: 'NVDA', domain: 'technology' },
  { cik: '789019', ticker: 'MSFT', domain: 'technology' },
  { cik: '1652044', ticker: 'GOOGL', domain: 'technology' },
  { cik: '1046179', ticker: 'TSM', domain: 'technology' },
  { cik: '1321655', ticker: 'PLTR', domain: 'technology' },
  // finance
  { cik: '886982', ticker: 'GS', domain: 'finance' },
  { cik: '70858', ticker: 'BAC', domain: 'finance' },
  { cik: '1403161', ticker: 'V', domain: 'finance' },
  { cik: '1364742', ticker: 'BLK', domain: 'finance' },
  // health
  { cik: '1022079', ticker: 'DGX', domain: 'health' },
  { cik: '920148', ticker: 'LH', domain: 'health' },
  { cik: '1110803', ticker: 'ILMN', domain: 'health' },
  { cik: '1083301', ticker: 'EXAS', domain: 'health' },
  // defense
  { cik: '936468', ticker: 'LMT', domain: 'defense' },
  { cik: '101829', ticker: 'RTX', domain: 'defense' },
  { cik: '40159', ticker: 'NOC', domain: 'defense' },
  { cik: '40533', ticker: 'GD', domain: 'defense' },
  // supplyChain
  { cik: '1090727', ticker: 'UPS', domain: 'supplyChain' },
  { cik: '1166003', ticker: 'XPO', domain: 'supplyChain' },
  // agriculture
  { cik: '315189', ticker: 'DE', domain: 'agriculture' },
  { cik: '1755672', ticker: 'CTVA', domain: 'agriculture' },
  { cik: '7084', ticker: 'ADM', domain: 'agriculture' },
  { cik: '1628280', ticker: 'NTR', domain: 'agriculture' },
  // industry
  { cik: '66740', ticker: 'MMM', domain: 'industry' },
  { cik: '773840', ticker: 'HON', domain: 'industry' },
  { cik: '49826', ticker: 'ITW', domain: 'industry' },
  { cik: '32604', ticker: 'EMR', domain: 'industry' },
  // infrastructure
  { cik: '1396009', ticker: 'VMC', domain: 'infrastructure' },
  { cik: '868857', ticker: 'ACM', domain: 'infrastructure' },
  { cik: '833444', ticker: 'J', domain: 'infrastructure' },
  { cik: '1047166', ticker: 'URI', domain: 'infrastructure' },
  // communication
  { cik: '1326801', ticker: 'META', domain: 'communication' },
  { cik: '902739', ticker: 'CMCSA', domain: 'communication' },
  { cik: '1744489', ticker: 'DIS', domain: 'communication' },
  { cik: '732717', ticker: 'T', domain: 'communication' },
  // governance
  { cik: '1443646', ticker: 'BAH', domain: 'governance' },
  { cik: '1336920', ticker: 'LDOS', domain: 'governance' },
  { cik: '1571123', ticker: 'SAIC', domain: 'governance' },
  // education
  { cik: '1651562', ticker: 'COUR', domain: 'education' },
  { cik: '1364954', ticker: 'CHGG', domain: 'education' },
  // culture
  { cik: '1601712', ticker: 'LYV', domain: 'culture' },
  { cik: '1639920', ticker: 'SPOT', domain: 'culture' },
  { cik: '1065280', ticker: 'NFLX', domain: 'culture' },
  // environment
  { cik: '753308', ticker: 'NEE', domain: 'environment' },
  { cik: '1318605', ticker: 'TSLA', domain: 'environment' },
  // law
  { cik: '1075124', ticker: 'TRI', domain: 'law' },
  // intelligence
  { cik: '1321655', ticker: 'PLTR', domain: 'intelligence' },
  // population
  { cik: '860730', ticker: 'HCA', domain: 'population' },
  { cik: '731766', ticker: 'UNH', domain: 'population' },
  // research
  { cik: '97745', ticker: 'TMO', domain: 'research' },
  { cik: '313616', ticker: 'DHR', domain: 'research' }
];

// ══════════════════════════════════════════════════════════════════════
// SINGLE COMPANY SCORER
// ══════════════════════════════════════════════════════════════════════

async function _scoreOne(company) {
  try {
    // Load PRIOR phase BEFORE rescoring so we can detect transitions.
    var prior = await db.get('company_phase_' + company.cik);
    var paddedCik = ('0000000000' + company.cik).slice(-10);

    var resp = await fetch(CONFIG.SCORE_API_BASE, {
      method: 'POST',
      signal: AbortSignal.timeout(CONFIG.SCORE_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LIMEN-Helix-Worker/1.0'
      },
      body: JSON.stringify({ cik: paddedCik })
    });
    var data = await resp.json();

    // /api/limen/score returns Thing 1 packet; Thing 2 fields nested under
    // _thing2 in current schema. Try both for robustness.
    var phase = data && (data.dominant_phase
      || (data._thing2 && data._thing2.dominant_phase)
      || (data.t2 && data.t2.dominant_phase));
    var trajectory = data && (data.trajectory
      || (data._thing2 && data._thing2.trajectory)
      || (data.t2 && data.t2.trajectory))
      || 'UNKNOWN';

    if (phase) {
      var entry = {
        cik: company.cik,
        ticker: company.ticker,
        domain: company.domain,
        phase: phase,
        trajectory: trajectory,
        composite: data.composite_score || data.composite || 0,
        alert: data.alert || false,
        timestamp: Date.now(),
        entity_name: data.entity_name || company.ticker
      };
      await db.set('company_phase_' + company.cik, entry, CONFIG.COMPANY_PHASE_TTL);

      // Append to transitions log if phase changed
      var priorPhase = prior && prior.phase;
      if (priorPhase && priorPhase !== phase) {
        try {
          var transitions = (await db.get(CONFIG.TRANSITION_LOG_KEY)) || [];
          if (!Array.isArray(transitions)) transitions = [];
          transitions.unshift({
            at: Date.now(),
            cik: company.cik,
            ticker: company.ticker,
            domain: company.domain,
            from: priorPhase,
            to: phase,
            trajectory: trajectory,
            entity_name: data.entity_name || company.ticker
          });
          if (transitions.length > CONFIG.TRANSITION_LOG_MAX) {
            transitions = transitions.slice(0, CONFIG.TRANSITION_LOG_MAX);
          }
          await db.set(CONFIG.TRANSITION_LOG_KEY, transitions, CONFIG.COMPANY_PHASE_TTL * 7);
        } catch (_) { /* transition log failure must not break scoring */ }
      }

      return {
        scored: true, ticker: company.ticker, cik: company.cik,
        domain: company.domain, phase: phase, trajectory: trajectory,
        transition: priorPhase && priorPhase !== phase ? { from: priorPhase, to: phase } : null
      };
    }
    return { scored: false, ticker: company.ticker, cik: company.cik, error: 'no dominant_phase in response' };
  } catch (e) {
    return { scored: false, ticker: company.ticker, cik: company.cik, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════
// PRIORITY SCHEDULER
//
// Priority order:
//   1. Unscored companies in elevated domains
//   2. Stale scores in elevated domains (age > ELEVATED_DOMAIN_TTL)
//   3. Normal round-robin backlog
//
// Anti-thrash: elevated domain companies recently scored are skipped.
// Selection reason logged for every company.
// ══════════════════════════════════════════════════════════════════════

async function scoreBatch(domainHealth) {
  domainHealth = domainHealth || {};
  var now = Date.now();
  var elevatedTTL = CONFIG.ELEVATED_DOMAIN_TTL_MINUTES * 60000;
  var globalStale = CONFIG.GLOBAL_SCORE_STALE_MINUTES * 60000;

  // Identify elevated domains
  var elevatedDomains = {};
  for (var dk in domainHealth) {
    var stress = (domainHealth[dk] && domainHealth[dk].stress) || 0;
    if (stress >= CONFIG.DOMAIN_STRESS_ELEVATED) elevatedDomains[dk] = stress;
  }

  // Build scoring queue with reasons
  var priorityQueue = [];  // { company, reason }
  var roundRobinQueue = [];

  // Pass 1: Unscored + stale in elevated domains
  for (var i = 0; i < COMPANY_REGISTRY.length; i++) {
    var co = COMPANY_REGISTRY[i];
    if (!elevatedDomains[co.domain]) continue;

    var cached = await db.get('company_phase_' + co.cik);
    if (!cached) {
      priorityQueue.push({ company: co, reason: 'priority_unscored_elevated_domain' });
    } else if (now - cached.timestamp > elevatedTTL) {
      priorityQueue.push({ company: co, reason: 'priority_stale_elevated_domain' });
    }
    // else: recently scored in elevated domain — skip (anti-thrash)
  }

  // Sort priority queue: higher domain stress first
  priorityQueue.sort(function (a, b) {
    return (elevatedDomains[b.company.domain] || 0) - (elevatedDomains[a.company.domain] || 0);
  });

  // Cap priority batch
  priorityQueue = priorityQueue.slice(0, CONFIG.PRIORITY_BATCH_SIZE);

  // Track which CIKs are already in priority batch
  var priorityCiks = {};
  for (var pi = 0; pi < priorityQueue.length; pi++) priorityCiks[priorityQueue[pi].company.cik] = true;

  // Pass 2: Round-robin for remaining budget
  var rrBudget = CONFIG.ROUND_ROBIN_BATCH_SIZE;
  if (rrBudget > 0) {
    var queue = await db.get(CONFIG.QUEUE_KEY);
    var pointer = (queue && queue.pointer) || 0;

    for (var ri = 0; ri < COMPANY_REGISTRY.length && roundRobinQueue.length < rrBudget; ri++) {
      var idx = (pointer + ri) % COMPANY_REGISTRY.length;
      var rrCo = COMPANY_REGISTRY[idx];
      if (priorityCiks[rrCo.cik]) continue; // already in priority batch

      var rrCached = await db.get('company_phase_' + rrCo.cik);
      if (!rrCached || (now - rrCached.timestamp > globalStale)) {
        roundRobinQueue.push({ company: rrCo, reason: 'round_robin' });
      }
    }

    // Advance pointer past all considered companies
    var newPointer = (pointer + COMPANY_REGISTRY.length) % COMPANY_REGISTRY.length;
    if (roundRobinQueue.length > 0) {
      // Advance by number we actually looked at
      newPointer = (pointer + Math.max(roundRobinQueue.length, CONFIG.ROUND_ROBIN_BATCH_SIZE)) % COMPANY_REGISTRY.length;
    }
    await db.set(CONFIG.QUEUE_KEY, { pointer: newPointer, lastRun: now }, CONFIG.COMPANY_PHASE_TTL);
  }

  // Merge queues: priority first, then round-robin
  var toScore = priorityQueue.concat(roundRobinQueue);

  if (toScore.length === 0) {
    return { scored: [], priorityCount: 0, roundRobinCount: 0, elevatedDomains: Object.keys(elevatedDomains) };
  }

  // Score in parallel
  var promises = toScore.map(function (item) {
    return _scoreOne(item.company).then(function (result) {
      result.reason = item.reason;
      return result;
    });
  });

  var results = await Promise.allSettled(promises);
  var scored = results.map(function (r) {
    return r.status === 'fulfilled' ? r.value : { scored: false, error: 'promise rejected' };
  });

  // Log the run
  var logEntry = {
    timestamp: now,
    elevatedDomains: Object.keys(elevatedDomains),
    priorityCount: priorityQueue.length,
    roundRobinCount: roundRobinQueue.length,
    scored: scored.map(function (s) {
      return { ticker: s.ticker, phase: s.phase || null, reason: s.reason, scored: s.scored };
    })
  };
  await db.lpush(CONFIG.SCORE_LOG_KEY, logEntry);
  await db.ltrim(CONFIG.SCORE_LOG_KEY, 0, 99); // keep last 100 runs

  return {
    scored: scored,
    priorityCount: priorityQueue.length,
    roundRobinCount: roundRobinQueue.length,
    elevatedDomains: Object.keys(elevatedDomains),
    totalScored: scored.filter(function (s) { return s.scored; }).length
  };
}

// ══════════════════════════════════════════════════════════════════════
// DOMAIN JOIN — aggregate company phases per domain
// ══════════════════════════════════════════════════════════════════════

async function buildDomainJoin() {
  var join = {};

  // Portal key (command-board x.d) → runtime/snapshot key the brains read by.
  // Domain naming is reconciled in ONE place: lib/domain-names.js. This map used to be
  // written out here by hand, one of eight such copies. See that file for how a missing
  // alias disguises itself as absent data.

  var domainSet = {};
  for (var i = 0; i < COMPANY_REGISTRY.length; i++) {
    domainSet[DOMAIN_NAMES.toRuntime(COMPANY_REGISTRY[i].domain)] = true;
  }
  for (var dk in domainSet) {
    join[dk] = {
      mapped_company_count: 0, scored_count: 0,
      p7a_count: 0, p7b_count: 0, p3_count: 0, p9_count: 0,
      latest_score_ts: 0, oldest_score_ts: Infinity,
      companies: []
    };
  }

  for (var ci = 0; ci < COMPANY_REGISTRY.length; ci++) {
    var co = COMPANY_REGISTRY[ci];
    var domain = KEYMAP[co.domain] || co.domain;
    join[domain].mapped_company_count++;

    var cached = await db.get('company_phase_' + co.cik);
    var fresh = cached && (Date.now() - cached.timestamp <= CONFIG.COMPANY_PHASE_TTL * 1000);

    if (fresh) {
      join[domain].scored_count++;
      var phase = cached.phase;
      if (phase === 'p7a') join[domain].p7a_count++;
      if (phase === 'p7b') join[domain].p7b_count++;
      if (phase === 'p3') join[domain].p3_count++;
      if (phase === 'p9') join[domain].p9_count++;

      if (cached.timestamp > join[domain].latest_score_ts) join[domain].latest_score_ts = cached.timestamp;
      if (cached.timestamp < join[domain].oldest_score_ts) join[domain].oldest_score_ts = cached.timestamp;

      join[domain].companies.push({
        name: co.name, ticker: cached.ticker || co.ticker, cik: co.cik,
        phase: cached.phase, trajectory: cached.trajectory,
        alert: cached.alert, timestamp: cached.timestamp, scored: true
      });
    } else {
      // Unscored: surface the static command-board baseline so consoles are never
      // starved. The gated scorer enriches these in place (scored:true) when it runs.
      join[domain].companies.push({
        name: co.name, ticker: co.ticker, cik: co.cik,
        phase: co.phase, trajectory: co.trajectory, scored: false
      });
    }
  }

  for (var jk in join) {
    var j = join[jk];
    j.p7a_ratio = j.mapped_company_count > 0 ? Math.round(j.p7a_count / j.mapped_company_count * 100) / 100 : 0;
    j.p3_ratio = j.mapped_company_count > 0 ? Math.round(j.p3_count / j.mapped_company_count * 100) / 100 : 0;
    j.coverage = j.mapped_company_count > 0 ? Math.round(j.scored_count / j.mapped_company_count * 100) / 100 : 0;
    if (j.oldest_score_ts === Infinity) j.oldest_score_ts = 0;
  }

  await db.set(CONFIG.DOMAIN_JOIN_KEY, { join: join, timestamp: Date.now() }, CONFIG.DOMAIN_JOIN_TTL);
  return join;
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 5+6 — SIGNAL CLASS EVALUATION + PRIORITY RESOLUTION
// ══════════════════════════════════════════════════════════════════════

function evaluateConvergenceSignals(domainJoin, domainHealth) {
  var signals = {};

  for (var dk in domainJoin) {
    var j = domainJoin[dk];
    var dh = domainHealth[dk] || {};
    var stress = dh.stress || 0;

    var satisfied = [];

    // Evaluate ALL classes independently (Section 5)
    if (stress >= CONFIG.DOMAIN_STRESS_HIGH && j.p7a_count >= CONFIG.P7A_COUNT_MIN) {
      satisfied.push('CONVERGENCE_TERMINAL');
    }
    if (stress >= CONFIG.DOMAIN_STRESS_ELEVATED && j.p3_count >= CONFIG.P3_COUNT_MIN) {
      satisfied.push('CONVERGENCE_INSTABILITY');
    }
    if (stress >= CONFIG.DOMAIN_STRESS_HIGH) {
      satisfied.push('DOMAIN_STRUCTURAL');
    }
    if (j.p7a_count >= CONFIG.P7A_COUNT_MIN) {
      satisfied.push('COMPANY_FAILURE_CLUSTER');
    }

    if (satisfied.length === 0) continue;

    // Priority resolution (Section 6)
    var PRIORITY_ORDER = ['CONVERGENCE_TERMINAL', 'CONVERGENCE_INSTABILITY', 'DOMAIN_STRUCTURAL', 'COMPANY_FAILURE_CLUSTER'];
    satisfied.sort(function (a, b) { return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b); });

    signals[dk] = {
      domain_id: dk,
      primary_signal: satisfied[0],
      secondary_signals: satisfied.slice(1),
      domain_stress: stress,
      p7a_count: j.p7a_count,
      p3_count: j.p3_count,
      p9_count: j.p9_count,
      mapped_company_count: j.mapped_company_count,
      scored_count: j.scored_count,
      coverage: j.coverage,
      p7a_ratio: j.p7a_ratio,
      p3_ratio: j.p3_ratio,
      provenance: {
        financial_kernel: j.scored_count > 0,
        domain_model: stress > 0
      },
      companies: j.companies
    };
  }

  return signals;
}

// ══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════

module.exports = {
  scoreBatch: scoreBatch,
  buildDomainJoin: buildDomainJoin,
  evaluateConvergenceSignals: evaluateConvergenceSignals,
  getRegistry: function () { return COMPANY_REGISTRY; },
  getConfig: function () { return CONFIG; }
};
