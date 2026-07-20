// scripts/sense/organ-energy-estimator.mjs — LIVE audit of energy's grounded-stress build.
//
// Every organ except organ-dataflow.mjs reads LOCAL FILES only — structure existing is not the same
// as real data flowing (organ-dataflow's own header explains why that blind spot is dangerous). This
// organ is a SECOND live-data exception, scoped to the specific pieces built 2026-07-19/20 for energy:
// the market channel (lib/energy-market-feed.js), the feed fractal (lib/feed-fractal.js real ingest
// wiring), the live outcome tracker (lib/energy-outcome-tracker.js), and the phase-estimator fusion
// itself. None of those are covered by organ-dataflow's three probes (console-companies, live-scoring,
// snapshot-fresh) — it checks domainCompanyJoin, a different key entirely from domains.energy.*.
//
// DETECTION ONLY, NOT HEALING. A live external-API failure (FRED down, ingest broken) or a stalled
// daily recorder is not something a 24h cron can safely auto-fix — the correct response is surfacing
// it as an operator attention item, same as every other organ, not autonomous repair of live production
// data flow. See CLAUDE.md human-gated actions.
export const id = 'energy-estimator';
export const role = 'energy grounded-stress build (live market + feed + outcome-loop probe)';
export const order = 36;   // right after organ-dataflow (35), same afferent-live-probe family

const BASE = 'https://limenhelix.com';

async function _getJSON(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms || 15000) });
  const t = await r.text();
  try { return JSON.parse(t); }
  catch (e) { throw new Error('non-JSON response (' + r.status + '): ' + t.slice(0, 60)); }
}

// Persisted day-over-day via _vitals.json's own lastHeals/prior-snapshot mechanism is NOT available to
// a stateless organ (each run is a fresh process) — so "did trackedForecasts actually grow since
// yesterday" can't be checked by this organ alone across runs. What CAN be checked in one shot: is the
// recorder tracking at least one forecast (the clock started), and is nothing reporting an error state.
export async function sense() {
  const attention = [];
  const metrics = {};
  const probes = [];

  let snap = null;
  try {
    snap = await _getJSON(BASE + '/api/limen-snapshot?type=console');
  } catch (e) {
    return {
      score: 0, status: 'IN_PAIN',
      summary: 'cannot read console snapshot: ' + e.message,
      metrics: { error: e.message },
      attention: [{ issue: 'Energy estimator: console snapshot unreadable (' + e.message + ')', severity: 'high', count: 1, action: 'check /api/limen-snapshot?type=console + limen-worker-snapshot cron', organ: id }]
    };
  }

  const energy = (snap && snap.domains && snap.domains.energy) || null;
  if (!energy) {
    return {
      score: 0, status: 'IN_PAIN',
      summary: 'domains.energy missing from snapshot entirely',
      metrics: {},
      attention: [{ issue: 'domains.energy missing from console snapshot', severity: 'high', count: 1, action: 'check limen-worker-snapshot.js domain loop', organ: id }]
    };
  }

  // ── PROBE A — market channel: live WTI fetch is succeeding (not silently erroring) ──
  const mc = energy.marketChannel || null;
  const mcOk = !!(mc && typeof mc.score === 'number' && typeof mc.price === 'number');
  probes.push({ name: 'market-channel', score: mcOk ? 100 : 0 });
  metrics.marketChannel = mc;
  if (!mcOk) {
    attention.push({ issue: 'Energy market channel not reporting a score (FRED fetch likely failing)', severity: 'high', count: 1, action: 'check lib/energy-market-feed.js live fetch — reason: ' + (mc && mc.reason ? mc.reason : 'field missing entirely'), organ: id });
  } else if (mc.asOf) {
    // stale-price check: WTI trades most weekdays; if the reported date is >5 calendar days old, the
    // live fetch itself may be succeeding but returning a frozen/cached upstream value.
    const ageDays = Math.round((Date.now() - Date.parse(mc.asOf + 'T00:00:00Z')) / 86400000);
    metrics.marketPriceAgeDays = ageDays;
    if (ageDays > 5) {
      // Could be OUR fetch stuck on a cached/frozen value, or FRED's own publication genuinely lagging
      // (confirmed to happen: DCOILWTICO went 7+ days without a new print during the 2026-07 window).
      // Flagged either way — the estimator is trusting week-plus-old price data regardless of whose
      // lag it is — but do not assert it is a code bug without checking the raw series directly.
      attention.push({ issue: 'Energy market price date is ' + ageDays + ' days old (expected <=5 incl. weekends) — may be OUR fetch stuck, or FRED\'s own publication lagging; verify against the raw series before assuming either', severity: 'medium', count: 1, action: 'curl https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO&cosd=<recent-date> directly to disambiguate our fetch vs upstream lag', organ: id });
    }
  }

  // ── PROBE B — feed fractal: real ingest headlines are being classified (not silently erroring) ──
  const ff = energy.feedFractal || null;
  const ffOk = !!(ff && typeof ff.itemCount === 'number' && !ff.reason);
  probes.push({ name: 'feed-fractal', score: ffOk ? 100 : (ff ? 40 : 0) });   // present-but-zero-items is degraded, not dead
  metrics.feedFractal = ff;
  if (!ffOk) {
    attention.push({ issue: 'Energy feed fractal erroring or missing', severity: 'high', count: 1, action: 'check latest_ingest Redis key + handlers/limen-worker-ingest.js cron — reason: ' + (ff && ff.reason ? ff.reason : 'field missing entirely'), organ: id });
  }

  // ── PROBE C — phase estimator: grounded, and not silently degraded to zero informative channels ──
  const pb = energy.phaseBelief || null;
  const pbOk = !!(pb && pb.grounded === true && Array.isArray(pb.belief));
  probes.push({ name: 'phase-belief', score: pbOk ? 100 : 0 });
  metrics.phaseBelief = pb ? { grounded: pb.grounded, phaseMAP: pb.phaseMAP, confidence: pb.confidence, stuck: pb.stuck } : null;
  if (!pbOk) {
    attention.push({ issue: 'Energy phaseBelief not grounded (estimator abstaining or erroring)', severity: 'high', count: 1, action: 'check lib/phase-estimator.js + worker try/catch — reason: ' + (pb && pb.reason ? pb.reason : 'field missing entirely'), organ: id });
  }

  // ── PROBE D — outcome tracker: the clock has actually started (>=1 tracked forecast) ──
  const ot = energy.outcomeTrack || null;
  const otOk = !!(ot && typeof ot.trackedForecasts === 'number' && ot.trackedForecasts >= 1 && !ot.reason);
  probes.push({ name: 'outcome-tracker', score: otOk ? 100 : 0 });
  metrics.outcomeTrack = ot ? { trackedForecasts: ot.trackedForecasts, resolvedCount: ot.resolvedCount, pendingCount: ot.pendingCount, estimatorHitRate: ot.estimatorHitRate } : null;
  if (!otOk) {
    attention.push({ issue: 'Energy outcome tracker has recorded ZERO forecasts — the validation clock has not started', severity: 'high', count: 1, action: 'check lib/energy-outcome-tracker.js wiring + gsSlot.outcomeTrack persistence — reason: ' + (ot && ot.reason ? ot.reason : 'field missing entirely'), organ: id });
  }

  // ── PROBE E — the promoted dsum.stress is NOT still the legacy feed-volume value ──
  // The whole point of the 2026-07-20 promotion: dsum.stress should now be distressMass(belief), with
  // the old value preserved at _legacyFeedStress for comparison — if the two are ever identical again,
  // the promotion silently reverted (e.g. est.grounded went false and the override was skipped).
  const hasLegacy = typeof energy._legacyFeedStress === 'number';
  const promoted = hasLegacy && energy.stress !== energy._legacyFeedStress;
  probes.push({ name: 'stress-promoted', score: promoted ? 100 : (hasLegacy ? 0 : 50) });
  metrics.stressPromotion = { stress: energy.stress, legacyFeedStress: energy._legacyFeedStress, source: energy.stressSource };
  if (hasLegacy && !promoted) {
    attention.push({ issue: 'Energy dsum.stress equals the legacy feed-volume value — the grounded promotion is not active this tick', severity: 'high', count: 1, action: 'check the est.grounded promotion block in handlers/limen-worker-snapshot.js (added 2026-07-20)', organ: id });
  } else if (!hasLegacy) {
    attention.push({ issue: 'Energy _legacyFeedStress absent — cannot confirm the stress promotion is active vs a stale pre-promotion snapshot', severity: 'medium', count: 1, action: 'wait for the next worker tick and re-check', organ: id });
  }

  const score = Math.round(probes.reduce((a, p) => a + p.score, 0) / probes.length);
  const status = score >= 90 ? 'HEALTHY' : score >= 60 ? 'DEGRADED' : 'IN_PAIN';
  metrics.probes = Object.fromEntries(probes.map(p => [p.name, p.score]));
  metrics.snapshotAgeSec = snap && snap.generatedAt ? Math.round((Date.now() - snap.generatedAt) / 1000) : null;

  return {
    score, status,
    summary: probes.filter(p => p.score === 100).length + '/' + probes.length + ' energy-estimator probes green'
      + ' · stress=' + (energy.stress != null ? energy.stress : '?') + ' (was ' + (energy._legacyFeedStress != null ? energy._legacyFeedStress : '?') + ')'
      + ' · phaseMAP=' + (pb ? 'P' + pb.phaseMAP : '?'),
    metrics, attention
  };
}
