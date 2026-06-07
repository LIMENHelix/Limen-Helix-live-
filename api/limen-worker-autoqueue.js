/**
 * api/limen-worker-autoqueue.js — Phase-transition → Engine-lane queue worker
 *
 * GET /api/limen-worker-autoqueue
 *   Cron-driven (every 15 min). Reads the phase_transitions log
 *   produced by the auto-rescoring scorer, applies the policy mapping
 *   in lib/limen-policy.recommendLane(), dedupes per (cik, lane) for
 *   7 days, and writes the resulting recommendations to a fire-ready
 *   queue at Redis key `limen:autoqueue`.
 *
 *   Operator UI consumes the queue + decides what to actually fire.
 *   No /api/expand-artifact-claude calls happen from this worker —
 *   budget-safe by design.
 *
 *   Returns a summary { processed, added, deduped, errors }.
 *
 * Health: idempotent + safe to manual-trigger. If the transitions log
 * is empty (first deploy, or quiet period) returns processed=0.
 */

var db = require('../lib/limen-db');
var policy = require('../lib/limen-policy');

var TRANSITION_LOG_KEY = 'phase_transitions';
var AUTOQUEUE_KEY = 'autoqueue';
var DEDUPE_PREFIX = 'autoqueue_dedupe_';   // dedupe_{cik}_{lane}
var DEDUPE_TTL = 7 * 86400;                // 7 days
var AUTOQUEUE_MAX = 200;                   // hold last N recommendations
var AUTOQUEUE_TTL = 14 * 86400;            // 2 weeks

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var t0 = Date.now();

  try {
    // 1. Read transition log
    var transitions = await db.get(TRANSITION_LOG_KEY);
    if (!Array.isArray(transitions)) transitions = [];

    // 2. Read current queue (we append, then trim)
    var queue = await db.get(AUTOQUEUE_KEY);
    if (!Array.isArray(queue)) queue = [];

    // 2b. Read the fresh network-stress map (limen-worker-stress-refresh).
    //     Folded into lane salience below so network-pushed companies surface
    //     faster. Honest degradation: if the map is missing or stale (>1h),
    //     skip the boost entirely rather than act on stale signal.
    var stressSlim = await db.get('stress_slim');
    var stressByCik = (stressSlim && stressSlim.byCik) || {};
    var stressMeta = await db.get('stress_meta');
    var stressFresh = !!(stressMeta && (Date.now() - (stressMeta.generatedAtMs || 0) < 60 * 60 * 1000));
    var stressApplied = 0;

    var added = 0;
    var deduped = 0;
    var skippedNoRec = 0;
    var processed = 0;
    var sampleAdded = [];

    // 3. Walk transitions newest-first (already newest-first per scorer)
    //    For each, compute recommendation; if not dedupe-blocked, append to queue.
    for (var i = 0; i < transitions.length; i++) {
      var t = transitions[i];
      processed++;

      // Skip transitions older than ~24h (already had a window to be queued)
      if ((Date.now() - (t.at || 0)) > 86400 * 1000) continue;

      var nsCik = String(t.cik).replace(/^0+/, '') || '0';
      var ns = (stressFresh && stressByCik[nsCik]) ? stressByCik[nsCik] : null;
      var rec = policy.recommendLane(t, ns);
      if (!rec) { skippedNoRec++; continue; }
      if (rec.networkStressApplied) stressApplied++;

      var dedupeKey = DEDUPE_PREFIX + t.cik + '_' + rec.lane;
      var alreadyQueued = await db.get(dedupeKey);
      if (alreadyQueued) { deduped++; continue; }

      var entry = {
        queuedAt: Date.now(),
        cik: t.cik,
        ticker: t.ticker,
        entity_name: t.entity_name,
        domain: t.domain,
        from: t.from,
        to: t.to,
        direction: rec.direction,
        magnitude: rec.magnitude,
        recommendedLane: rec.lane,
        salience: rec.salience,
        salienceScore: rec.salienceScore,
        networkStress: rec.networkStressApplied || null,
        source: 'phase-transition',
        sourceTransitionAt: t.at,
        status: 'PENDING'     // PENDING | FIRED | DISMISSED | EXPIRED
      };
      queue.unshift(entry);
      await db.set(dedupeKey, { at: Date.now() }, DEDUPE_TTL);
      added++;
      if (sampleAdded.length < 5) sampleAdded.push({
        ticker: t.ticker, from: t.from, to: t.to, lane: rec.lane, salience: rec.salience
      });
    }

    // 4. Cap queue size + persist
    if (queue.length > AUTOQUEUE_MAX) queue = queue.slice(0, AUTOQUEUE_MAX);
    await db.set(AUTOQUEUE_KEY, queue, AUTOQUEUE_TTL);

    var elapsed = Date.now() - t0;
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: Date.now(),
      processed: processed,
      added: added,
      deduped: deduped,
      networkStressBoosts: stressApplied,
      stressFeedFresh: stressFresh,
      skippedNoRecommendation: skippedNoRec,
      queueSize: queue.length,
      sampleAdded: sampleAdded,
      elapsedMs: elapsed
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
