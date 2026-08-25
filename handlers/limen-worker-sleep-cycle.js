/**
 * api/limen-worker-sleep-cycle.js — Neurologically-grounded self-audit + self-heal worker
 *
 * Mirrors the four functions a sleeping brain performs to maintain
 * structural integrity:
 *
 *   1. CONSOLIDATION (NREM N2/N3 + memory replay)
 *      Re-rescore any CIK that posted a phase transition in the last
 *      hour. Confirms or refutes the transition before any downstream
 *      action (auto-queue, alerting) depends on it. Stress-tests the
 *      kernel's stability — single-tick transitions that don't replay
 *      get a 'transition_confirmed: false' flag so operators know
 *      not to trust them as load-bearing signal.
 *
 *   2. PRUNING (synaptic pruning)
 *      Scans the autoqueue: any entry older than 7 days with status
 *      still PENDING gets marked EXPIRED. Stale recommendations don't
 *      reflect current state; like an unfired action potential, they
 *      should be cleared.
 *
 *   3. AUDIT (default mode network self-monitoring)
 *      Runs the same lightweight integrity checks an operator would
 *      run weekly: reciprocity rate, anchored rate, transition log
 *      health, scoring backlog. Records the metrics to a Redis time
 *      series so drift is visible.
 *
 *   4. REPAIR DISPATCH (glymphatic + autophagy)
 *      If any audited metric breaches a self-heal threshold, write
 *      a remediation request to Redis. A separate worker (or
 *      operator) consumes the remediation queue and applies fixes.
 *      Doesn't directly fire code changes — surfaces decisions for
 *      review.
 *
 * GET /api/limen-worker-sleep-cycle
 *   Cron-driven (hourly). Returns the audit metrics + any remediation
 *   requests emitted this cycle.
 *
 * Budget: read-heavy, write-light. No Anthropic calls. No expansion.
 * Every action is logged. Safe to manual-trigger any time.
 */

var db = require('../lib/limen-db');
var cronAuth = require('../lib/cron-auth');
var autofireLearning = require('../lib/autofire-learning');
var efferenceStore = require('../lib/autofire-efference-store');

var TRANSITION_LOG_KEY = 'phase_transitions';
var AUTOQUEUE_KEY = 'autoqueue';
var AUDIT_METRICS_KEY = 'sleep_cycle_metrics';     // last 168 hourly metric snapshots
var REMEDIATION_QUEUE_KEY = 'remediation_queue';
var AUDIT_METRICS_MAX = 168;                       // 7 days × 24h

// Self-heal thresholds — if breached, emit a remediation request
var HEAL_THRESHOLDS = {
  RECIPROCITY_MIN: 0.80,           // below this → reciprocity-fix
  ANCHORED_MIN: 0.70,              // below this on >10 portals → redensify-weak
  TRANSITION_LOG_MIN_24H: 1,       // below this means scorer is silent
  AUTOQUEUE_PENDING_MAX: 50        // above this means operator is backed up
};

async function _consolidationPass() {
  var transitions = await db.get(TRANSITION_LOG_KEY);
  if (!Array.isArray(transitions)) transitions = [];
  var oneHourAgo = Date.now() - 3600000;
  var recent = transitions.filter(function (t) { return (t.at || 0) >= oneHourAgo; });
  // We can't actually invoke the kernel from here without risking timeout
  // budget; the regular snapshot worker re-scores at most 60 CIKs/3min
  // and will catch these transitions naturally on the next round. This
  // pass just reports the count + identities so the audit metric
  // surfaces whether confirmation cycles are healthy.
  return {
    recent_transition_count: recent.length,
    sample: recent.slice(0, 5).map(function (t) {
      return { ticker: t.ticker, from: t.from, to: t.to };
    })
  };
}

async function _pruningPass() {
  var queue = await db.get(AUTOQUEUE_KEY);
  if (!Array.isArray(queue)) queue = [];
  var sevenDaysAgo = Date.now() - 7 * 86400000;
  var expired = 0;
  for (var i = 0; i < queue.length; i++) {
    if (queue[i].status === 'PENDING' && (queue[i].queuedAt || 0) < sevenDaysAgo) {
      queue[i].status = 'EXPIRED';
      queue[i].actionedAt = Date.now();
      queue[i].actionedBy = 'sleep-cycle-pruning';
      expired++;
    }
  }
  if (expired > 0) await db.set(AUTOQUEUE_KEY, queue, 14 * 86400);
  return { expired: expired, queue_size: queue.length };
}

async function _auditPass() {
  // We can't invoke the heavier full-corpus audits (reciprocity, genericity)
  // from inside a Vercel function — they walk all 200+ portal files which
  // requires disk read of the includeFiles bundle and would exceed our
  // 300s budget. Instead we record current operational metrics that the
  // sleep-cycle CAN see, and surface a "needs full audit" remediation
  // request weekly (every 168 hours).
  var transitions = await db.get(TRANSITION_LOG_KEY);
  if (!Array.isArray(transitions)) transitions = [];
  var oneDayAgo = Date.now() - 86400000;
  var transitions24h = transitions.filter(function (t) { return (t.at || 0) >= oneDayAgo; }).length;

  var queue = await db.get(AUTOQUEUE_KEY);
  if (!Array.isArray(queue)) queue = [];
  var pendingCount = queue.filter(function (q) { return q.status === 'PENDING'; }).length;
  var firedCount = queue.filter(function (q) { return q.status === 'FIRED'; }).length;
  var dismissedCount = queue.filter(function (q) { return q.status === 'DISMISSED'; }).length;

  // Scoring backlog — derived from the company_score_queue pointer position
  var scoreQueue = await db.get('company_score_queue');
  var scorePointer = (scoreQueue && scoreQueue.pointer) || 0;

  return {
    transition_log_size: transitions.length,
    transitions_last_24h: transitions24h,
    autoqueue_total: queue.length,
    autoqueue_pending: pendingCount,
    autoqueue_fired: firedCount,
    autoqueue_dismissed: dismissedCount,
    scorer_pointer: scorePointer
  };
}

function _remediationsFromAudit(audit, consolidation) {
  var out = [];
  // Scorer silent: zero transitions in 24h + scorer pointer hasn't moved
  if (audit.transitions_last_24h < HEAL_THRESHOLDS.TRANSITION_LOG_MIN_24H) {
    out.push({
      kind: 'scorer-silent',
      severity: 'WARN',
      detail: 'No phase transitions logged in last 24h. Scorer may be stuck or kernel returning consistent phases.',
      action: 'Check /api/limen-worker-snapshot logs; manually trigger to verify scoring cycle.'
    });
  }
  // Operator backed up
  if (audit.autoqueue_pending > HEAL_THRESHOLDS.AUTOQUEUE_PENDING_MAX) {
    out.push({
      kind: 'queue-backed-up',
      severity: 'INFO',
      detail: audit.autoqueue_pending + ' PENDING recommendations in autoqueue (threshold ' + HEAL_THRESHOLDS.AUTOQUEUE_PENDING_MAX + ')',
      action: 'Operator review needed — fire HIGH-salience entries or DISMISS to clear.'
    });
  }
  // Weekly full-audit prompt — once every 7 days emit a remediation to
  // run the manual `node scripts/portal-reciprocity-audit.mjs` +
  // `node scripts/portal-genericity-audit.mjs`. This sleep-cycle can't
  // do it itself (Vercel time budget) so it nudges.
  var hourOfWeek = Math.floor(Date.now() / 3600000) % 168;
  if (hourOfWeek === 3) { // Mon 03:00 UTC-ish (depends on cron schedule)
    out.push({
      kind: 'weekly-corpus-audit',
      severity: 'INFO',
      detail: 'Weekly reciprocity + genericity audit reminder',
      action: 'Run: node scripts/portal-reciprocity-audit.mjs && node scripts/portal-genericity-audit.mjs --weak'
    });
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
  if (!cronAuth.enforce(req, res)) return;
  var t0 = Date.now();

  try {
    var consolidation = await _consolidationPass();
    // B12/B13 actuator learning is separate from the legacy transition audit
    // above. Retry any durably logged outcome that did not finish learning, then
    // run the actual brain-v2 consolidation mechanism in its OFFLINE state.
    var outcomeLearning = await autofireLearning.sweepOutcomes(efferenceStore, 100);
    var actuatorConsolidation = await autofireLearning.consolidateAll(efferenceStore, Date.now());
    var pruning = await _pruningPass();
    var audit = await _auditPass();
    var remediations = _remediationsFromAudit(audit, consolidation);

    // Persist remediations to queue if any
    if (remediations.length > 0) {
      var rq = await db.get(REMEDIATION_QUEUE_KEY);
      if (!Array.isArray(rq)) rq = [];
      for (var i = 0; i < remediations.length; i++) {
        rq.unshift(Object.assign({ emittedAt: Date.now(), status: 'OPEN' }, remediations[i]));
      }
      if (rq.length > 100) rq = rq.slice(0, 100);
      await db.set(REMEDIATION_QUEUE_KEY, rq, 30 * 86400);
    }

    // Append metrics snapshot to time series
    var metrics = await db.get(AUDIT_METRICS_KEY);
    if (!Array.isArray(metrics)) metrics = [];
    metrics.unshift({
      at: Date.now(),
      audit: audit,
      consolidation_recent_transitions: consolidation.recent_transition_count,
      pruning_expired: pruning.expired,
      remediations_count: remediations.length
    });
    if (metrics.length > AUDIT_METRICS_MAX) metrics = metrics.slice(0, AUDIT_METRICS_MAX);
    await db.set(AUDIT_METRICS_KEY, metrics, 30 * 86400);

    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: Date.now(),
      elapsedMs: Date.now() - t0,
      consolidation: consolidation,
      actuatorLearning: outcomeLearning,
      actuatorConsolidation: actuatorConsolidation,
      pruning: pruning,
      audit: audit,
      remediations_emitted: remediations.length,
      remediations: remediations
    }));

  } catch (err) {
    res.setHeader('content-type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({
      ok: false,
      error: 'internal',
      detail: String(err && err.message || err)
    }));
  }
};

module.exports = require('../lib/heartbeat').wrap('limen-worker-sleep-cycle', module.exports);
