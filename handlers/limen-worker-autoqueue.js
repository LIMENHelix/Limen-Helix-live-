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
var cronAuth = require('../lib/cron-auth');
var redisGet = require('../lib/redis-kv').redisGet;
var domainResearchCandidate = require('../lib/domain-research-candidate');
var masterInbox = require('../assets/data/_master-inbox.json');
var outwardPolicy = require('../brain-v2/core/outward-action-policy.js');

var TRANSITION_LOG_KEY = 'phase_transitions';
var AUTOQUEUE_KEY = 'autoqueue';
var DEDUPE_PREFIX = 'autoqueue_dedupe_';   // dedupe_{cik}_{lane}
var DEDUPE_TTL = 7 * 86400;                // 7 days
var AUTOQUEUE_MAX = 200;                   // hold last N recommendations
var AUTOQUEUE_TTL = 14 * 86400;            // 2 weeks
var MASTER_SEED_PER_TICK = Math.max(1, Math.min(parseInt(process.env.MASTER_SEED_PER_TICK || '10', 10) || 10, 25));
var ACTIVE_LANES = new Set(['investment', 'research']);
var TERMINAL_QUEUE_STATUSES = new Set(['FIRED', 'FAILED', 'DISMISSED', 'EXPIRED']);

function _queueSeedCapacity(queue) {
  var terminal = 0;
  for (var i = 0; i < queue.length; i++) {
    if (TERMINAL_QUEUE_STATUSES.has(queue[i] && queue[i].status)) terminal++;
  }
  return Math.max(0, AUTOQUEUE_MAX - queue.length) + terminal;
}

// Preserve pending work. When the bounded queue is full, retire only the
// oldest terminal records; those outcomes remain in the artifact/audit stores.
function _trimQueue(queue) {
  if (queue.length <= AUTOQUEUE_MAX) return { queue: queue, evicted: 0 };
  var need = queue.length - AUTOQUEUE_MAX;
  var kept = [];
  var evicted = 0;
  for (var i = queue.length - 1; i >= 0; i--) {
    var item = queue[i];
    if (need > 0 && TERMINAL_QUEUE_STATUSES.has(item && item.status)) {
      need--;
      evicted++;
      continue;
    }
    kept.push(item);
  }
  kept.reverse();
  // A queue containing more pending items than the hard cap is already in an
  // invariant breach. Bound it without calling those items terminal.
  if (kept.length > AUTOQUEUE_MAX) kept = kept.slice(0, AUTOQUEUE_MAX);
  return { queue: kept, evicted: evicted };
}

/* The old company-portal Research pool has no identity join to current
 * Science/Medicine feed observations. When the bounded queue is full, a
 * source-owned domain research candidate may replace one oldest still-pending
 * company Research row. The retired row remains in the immutable master inbox;
 * this changes only scheduled work and reports the retirement explicitly. */
function _retireMismatchedResearch(queue) {
  for (var i = queue.length - 1; i >= 0; i--) {
    var row = queue[i];
    if (row && row.status === 'PENDING' && row.source === 'master-inbox' && row.recommendedLane === 'research') {
      return queue.splice(i, 1)[0];
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
  if (!cronAuth.enforce(req, res)) return;
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
      if (!outwardPolicy.ownerFor(rec.lane, t.domain)) { skippedNoRec++; continue; }
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

    // 3b. Science and Medicine research candidates originate from the owning
    // product brain's current durable packet, not from a company portal whose
    // identity is absent from those feeds. Only the bounded actor candidate is
    // queued here; B10 still competes it against no_action in autofire.
    var domainResearch = { examined: 2, ready: 0, admitted: 0, deduped: 0, abstentions: [], retiredMismatched: [] };
    var researchRecords = await Promise.all(['science', 'medicine'].map(function (domain) {
      return redisGet('limen:brain:cognition:' + domain).then(function (record) {
        return { domain: domain, record: record };
      });
    }));
    for (var dri = 0; dri < researchRecords.length; dri++) {
      var builtResearch = domainResearchCandidate.build(
        researchRecords[dri].record, researchRecords[dri].domain, Date.now());
      if (builtResearch.status !== 'READY_FOR_B10' || !builtResearch.candidate) {
        domainResearch.abstentions.push({ domain: researchRecords[dri].domain, reason: builtResearch.reason });
        continue;
      }
      domainResearch.ready++;
      var researchEntry = builtResearch.candidate;
      var researchAlreadyPending = queue.some(function (q) {
        return q.sourceArtifactRef === researchEntry.sourceArtifactRef && q.status === 'PENDING';
      });
      var researchDedupeKey = DEDUPE_PREFIX + 'domain_research_' +
        researchEntry.sourceArtifactRef.replace(/[^A-Za-z0-9_.-]/g, '_');
      if (researchAlreadyPending || await db.get(researchDedupeKey)) {
        domainResearch.deduped++;
        continue;
      }
      if (_queueSeedCapacity(queue) < 1) {
        var retired = _retireMismatchedResearch(queue);
        if (!retired) {
          domainResearch.abstentions.push({ domain: researchRecords[dri].domain, reason: 'autoqueue-full-no-replaceable-company-research-row' });
          continue;
        }
        domainResearch.retiredMismatched.push({
          sourceArtifactRef: retired.sourceArtifactRef || null,
          cik: retired.cik || null,
          domain: retired.domain || null
        });
      }
      researchEntry.queuedAt = Date.now();
      queue.unshift(researchEntry);
      await db.set(researchDedupeKey, {
        at: Date.now(), sourcePacketId: researchEntry.sourcePacketId,
        sourceArtifactRef: researchEntry.sourceArtifactRef
      }, DEDUPE_TTL);
      domainResearch.admitted++;
      added++;
      if (sampleAdded.length < 5) sampleAdded.push({
        subjectId: researchEntry.subjectId, domain: researchEntry.domain,
        lane: researchEntry.recommendedLane, salience: researchEntry.salience
      });
    }

    // 3c. The reconciled master inbox is the existing research/investment
    // prioritizer. It used to be repo-only, so 759 READY_TO_FIRE candidates had
    // no path into the live queue. Seed only its capped topPriority surface,
    // preserve the exact gate inputs, and rate-limit queue admission. This does
    // not bypass autofire's spend cap, stage refusal, or 24h CIK/lane dedupe.
    var presentationTopCount = Array.isArray(masterInbox.topPriority) ? masterInbox.topPriority.length : 0;
    var masterTop = Array.isArray(masterInbox.readyForAutofire)
      ? masterInbox.readyForAutofire
      : (Array.isArray(masterInbox.topPriority) ? masterInbox.topPriority : []);
    var masterAdded = [];
    var masterDeduped = 0;
    var masterInvalid = 0;
    var masterResearchHeld = 0;
    var seedCapacity = _queueSeedCapacity(queue);
    var seedLimit = Math.min(MASTER_SEED_PER_TICK, seedCapacity);
    for (var mi = 0; mi < masterTop.length && masterAdded.length < seedLimit; mi++) {
      var item = masterTop[mi];
      var lane = item && item.lane;
      var cik = String(item && item.portalCik || '').replace(/^0+/, '') || null;
      if (!item || item.status !== 'READY_TO_FIRE' || !ACTIVE_LANES.has(lane) || !cik || !item.artifactRef) {
        masterInvalid++;
        continue;
      }
      if (lane === 'research') {
        masterResearchHeld++;
        continue;
      }
      if (!outwardPolicy.ownerFor(lane, item.portalDomain)) {
        masterInvalid++;
        continue;
      }

      var alreadyPending = queue.some(function (q) {
        return q.sourceArtifactRef === item.artifactRef && q.status === 'PENDING';
      });
      var masterDedupeKey = DEDUPE_PREFIX + 'master_' + item.artifactRef.replace(/[^A-Za-z0-9_.-]/g, '_');
      if (alreadyPending || await db.get(masterDedupeKey)) {
        masterDeduped++;
        continue;
      }

      masterAdded.push({
        queuedAt: Date.now(),
        cik: cik,
        ticker: item.portalTicker || null,
        entity_name: item.portalName || null,
        domain: item.portalDomain || null,
        portalSlug: item.portalSlug || null,
        from: item.phase || 'n/a',
        to: item.phase || 'n/a',
        direction: 'master-priority',
        magnitude: null,
        recommendedLane: lane,
        salience: 'MASTER_READY',
        salienceScore: item.salience,
        autofireEligible: true,
        source: 'master-inbox',
        sourceArtifactRef: item.artifactRef,
        sourcePatternSig: item.patternId || item.artifactRef,
        sourceSnapshotAt: masterInbox.generatedAt || null,
        masterGate: {
          readiness: item.readiness,
          salience: item.salience,
          fireScore: item.fireScore,
          confidence: item.confidence,
          completeness: item.completeness,
          phase: item.phase,
          phaseInhibited: item.phaseInhibited
        },
        status: 'PENDING'
      });
      await db.set(masterDedupeKey, { at: Date.now(), artifactRef: item.artifactRef }, DEDUPE_TTL);
    }
    var terminalEvicted = 0;
    if (masterAdded.length) {
      var trimmed = _trimQueue(masterAdded.concat(queue));
      queue = trimmed.queue;
      terminalEvicted = trimmed.evicted;
    }
    added += masterAdded.length;

    // 4. Cap queue size + persist
    if (queue.length > AUTOQUEUE_MAX) queue = _trimQueue(queue).queue;
    await db.set(AUTOQUEUE_KEY, queue, AUTOQUEUE_TTL);

    // Keep the scheduled admission decision observable.  The cron response is
    // not exposed to operators, so without this line a zero-admission run is
    // indistinguishable from a stale worker, a full dedupe set, or a policy
    // refusal.  This is diagnostic only: it does not alter admission or state.
    console.log('[AUTOQUEUE] master-seed', JSON.stringify({
      snapshotAt: masterInbox.generatedAt || null,
      readyTotal: masterInbox.stats && masterInbox.stats.readyToFire,
      readyPool: masterTop.length,
      seedCapacity: seedCapacity,
      admitted: masterAdded.length,
      deduped: masterDeduped,
      invalid: masterInvalid,
      ungroundedResearchHeld: masterResearchHeld,
      terminalEvicted: terminalEvicted,
      queueSize: queue.length
    }));
    console.log('[AUTOQUEUE] domain-research-seed', JSON.stringify(domainResearch));

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
      masterInbox: {
        snapshotAt: masterInbox.generatedAt || null,
        readyTotal: masterInbox.stats && masterInbox.stats.readyToFire,
        topPriorityExamined: presentationTopCount,
        admitted: masterAdded.length,
        readyPool: masterTop.length,
        seedCapacity: seedCapacity,
        terminalEvicted: terminalEvicted,
        deduped: masterDeduped,
        invalid: masterInvalid,
        ungroundedResearchHeld: masterResearchHeld,
        perTickCap: MASTER_SEED_PER_TICK
      },
      domainResearch: domainResearch,
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

module.exports._queueSeedCapacity = _queueSeedCapacity;
module.exports._trimQueue = _trimQueue;
module.exports._retireMismatchedResearch = _retireMismatchedResearch;

var autoqueueHandler = module.exports;
module.exports = require('../lib/heartbeat').wrap('limen-worker-autoqueue', autoqueueHandler);
module.exports._queueSeedCapacity = autoqueueHandler._queueSeedCapacity;
module.exports._trimQueue = autoqueueHandler._trimQueue;
module.exports._retireMismatchedResearch = autoqueueHandler._retireMismatchedResearch;
