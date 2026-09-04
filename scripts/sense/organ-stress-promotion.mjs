// scripts/sense/organ-stress-promotion.mjs — LIVE audit of the grounded-stress PROMOTION, for every
// domain it is active on (was scripts/sense/organ-energy-estimator.mjs, energy-only; generalized
// 2026-07-20 as part of the energy-parity port — see handlers/limen-worker-snapshot.js's
// STRESS_PROMOTION_DOMAINS allowlist, currently energy-only by default).
//
// Every organ except organ-dataflow.mjs reads LOCAL FILES only — structure existing is not the same
// as real data flowing (organ-dataflow's own header explains why that blind spot is dangerous). This
// organ is a SECOND live-data exception, scoped to the promotion built 2026-07-19/20: the phase-
// estimator fusion, and (for whichever domains have them wired) the market channel
// (lib/energy-market-feed.js), the feed fractal (lib/feed-fractal.js real ingest wiring), the live
// outcome tracker (lib/energy-outcome-tracker.js). None of those are covered by organ-dataflow's
// three probes (console-companies, live-scoring, snapshot-fresh) — it checks domainCompanyJoin, a
// different key entirely from domains.<domain>.*.
//
// SCOPE DISCOVERY: rather than hardcoding a domain list here (which would drift from the worker's own
// allowlist), a domain is treated as "promotion-active" empirically — it has a numeric
// `_legacyFeedStress` field, which the worker only ever sets inside the promotion block. This means
// widening STRESS_PROMOTION_DOMAINS in the worker requires NO change here; this organ picks up newly
// promoted domains automatically.
//
// Market-channel / outcome-tracker-forecast probes are ENERGY-ONLY still (Phase B: no other domain has
// a live public market series wired yet — see ENERGY_REFERENCE.md Part II). For every other promoted
// domain those two probes are skipped rather than flagged as broken, since a missing market channel on
// e.g. `finance` is expected-by-design, not a regression.
//
// DETECTION ONLY, NOT HEALING. A live external-API failure (FRED down, ingest broken) or a stalled
// daily recorder is not something a 24h cron can safely auto-fix — the correct response is surfacing
// it as an operator attention item, same as every other organ, not autonomous repair of live production
// data flow. See CLAUDE.md human-gated actions.
export const id = 'stress-promotion';
export const role = 'grounded-stress PROMOTION probe (live market + feed + outcome-loop + phase fusion), for every promoted domain';
export const order = 36;   // right after organ-dataflow (35), same afferent-live-probe family

const BASE = 'https://limenhelix.com';
const MARKET_CHANNEL_DOMAINS = ['energy'];   // Phase B: domains with their own live public market/index series wired

async function _getJSON(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms || 15000) });
  const t = await r.text();
  try { return JSON.parse(t); }
  catch (e) { throw new Error('non-JSON response (' + r.status + '): ' + t.slice(0, 60)); }
}

function probeDomain(domainKey, d, probes, metrics, attention) {
  const hasMarket = MARKET_CHANNEL_DOMAINS.indexOf(domainKey) !== -1;

  // ── PROBE A — market channel (only for domains with one wired; Phase B territory otherwise) ──
  if (hasMarket) {
    const mc = d.marketChannel || null;
    const mcOk = !!(mc && typeof mc.score === 'number' && typeof mc.price === 'number');
    probes.push({ name: domainKey + ':market-channel', score: mcOk ? 100 : 0 });
    metrics[domainKey + '.marketChannel'] = mc;
    if (!mcOk) {
      attention.push({ issue: domainKey + ' market channel not reporting a score (live fetch likely failing)', severity: 'high', count: 1, action: 'check the ' + domainKey + ' market-feed lib live fetch — reason: ' + (mc && mc.reason ? mc.reason : 'field missing entirely'), organ: id });
    } else if (mc.asOf) {
      const ageDays = Math.round((Date.now() - Date.parse(mc.asOf + 'T00:00:00Z')) / 86400000);
      metrics[domainKey + '.marketPriceAgeDays'] = ageDays;
      if (ageDays > 5) {
        attention.push({ issue: domainKey + ' market price date is ' + ageDays + ' days old (expected <=5 incl. weekends) — may be OUR fetch stuck, or the upstream source\'s own publication lagging; verify against the raw series before assuming either', severity: 'medium', count: 1, action: 'check the raw upstream series directly to disambiguate our fetch vs upstream lag', organ: id });
      }
    }
  }

  // ── PROBE B — feed fractal: real ingest headlines are being classified (not silently erroring) ──
  const ff = d.feedFractal || null;
  const ffOk = !!(ff && typeof ff.itemCount === 'number' && !ff.reason);
  probes.push({ name: domainKey + ':feed-fractal', score: ffOk ? 100 : (ff ? 40 : 0) });
  metrics[domainKey + '.feedFractal'] = ff;
  if (!ffOk) {
    attention.push({ issue: domainKey + ' feed fractal erroring or missing', severity: 'high', count: 1, action: 'check latest_ingest Redis key + handlers/limen-worker-ingest.js cron — reason: ' + (ff && ff.reason ? ff.reason : 'field missing entirely'), organ: id });
  }

  // ── PROBE C — phase estimator: grounded, and not silently degraded to zero informative channels ──
  const pb = d.phaseBelief || null;
  const pbOk = !!(pb && pb.grounded === true && Array.isArray(pb.belief));
  probes.push({ name: domainKey + ':phase-belief', score: pbOk ? 100 : 0 });
  metrics[domainKey + '.phaseBelief'] = pb ? {
    grounded: pb.grounded,
    phaseMAP: pb.phaseMAP,
    confidence: pb.confidence,
    stuck: pb.stuck,
    reason: pb.reason || null,
    degraded: pb.degraded || null,
    channels: Array.isArray(pb.channels) ? pb.channels : null
  } : null;
  if (!pbOk) {
    const abstentionReason = pb && (pb.reason || (pb.degraded && pb.degraded.reason));
    attention.push({ issue: domainKey + ' phaseBelief not grounded (estimator abstaining or erroring)', severity: 'high', count: 1, action: 'check lib/phase-estimator.js + worker try/catch — reason: ' + (abstentionReason || 'field missing entirely'), organ: id });
  }

  // ── PROBE D — outcome tracker: the clock has actually started (>=1 tracked forecast). ──
  // Only meaningful where a live price reading exists (hasMarket) — everywhere else priceReading is
  // null by design (Phase B), so trackedForecasts:0 is expected, not a regression; skip the flag.
  const ot = d.outcomeTrack || null;
  if (hasMarket) {
    const otOk = !!(ot && typeof ot.trackedForecasts === 'number' && ot.trackedForecasts >= 1 && !ot.reason);
    probes.push({ name: domainKey + ':outcome-tracker', score: otOk ? 100 : 0 });
    metrics[domainKey + '.outcomeTrack'] = ot ? { trackedForecasts: ot.trackedForecasts, resolvedCount: ot.resolvedCount, pendingCount: ot.pendingCount, estimatorHitRate: ot.estimatorHitRate } : null;
    if (!otOk) {
      attention.push({ issue: domainKey + ' outcome tracker has recorded ZERO forecasts — the validation clock has not started', severity: 'high', count: 1, action: 'check the outcome-tracker wiring + gsSlot.outcomeTrack persistence for ' + domainKey + ' — reason: ' + (ot && ot.reason ? ot.reason : 'field missing entirely'), organ: id });
    }
  } else {
    metrics[domainKey + '.outcomeTrack'] = ot ? { trackedForecasts: ot.trackedForecasts } : null;   // informational only, not scored
  }

  // ── PROBE E — the promoted dsum.stress is NOT still the legacy feed-volume value ──
  const hasLegacy = typeof d._legacyFeedStress === 'number';
  const promoted = hasLegacy && d.stress !== d._legacyFeedStress;
  probes.push({ name: domainKey + ':stress-promoted', score: promoted ? 100 : (hasLegacy ? 0 : 50) });
  metrics[domainKey + '.stressPromotion'] = { stress: d.stress, legacyFeedStress: d._legacyFeedStress, source: d.stressSource };
  if (hasLegacy && !promoted) {
    attention.push({ issue: domainKey + ' dsum.stress equals the legacy feed-volume value — the grounded promotion is not active this tick', severity: 'high', count: 1, action: 'check the STRESS_PROMOTION_DOMAINS eligibility block in handlers/limen-worker-snapshot.js for ' + domainKey, organ: id });
  }
}

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
      attention: [{ issue: 'Stress-promotion estimator: console snapshot unreadable (' + e.message + ')', severity: 'high', count: 1, action: 'check /api/limen-snapshot?type=console + limen-worker-snapshot cron', organ: id }]
    };
  }

  const domains = (snap && snap.domains) || {};
  // Promotion-active = has been through the worker's promotion block at least once (numeric
  // _legacyFeedStress). Discovered empirically so this organ tracks the worker's own allowlist
  // without needing a duplicate hardcoded list here.
  const promotedKeys = Object.keys(domains).filter(k => typeof domains[k]._legacyFeedStress === 'number');
  const abstainingKeys = Object.keys(domains).filter(k => domains[k].phaseBelief && domains[k].phaseBelief.grounded === false);

  // An abstaining domain never receives _legacyFeedStress, so the promotion-only loop below cannot
  // observe it. Keep these out of the promotion score, but retain their estimator telemetry and
  // raise an explicit attention item. This is observation only; it does not change promotion.
  for (const k of abstainingKeys) {
    const pb = domains[k].phaseBelief;
    const reason = pb.reason || (pb.degraded && pb.degraded.reason) || 'estimator abstained without a reason';
    metrics[k + '.phaseBeliefAbstention'] = {
      reason,
      degraded: pb.degraded || null,
      channels: Array.isArray(pb.channels) ? pb.channels : null
    };
    attention.push({
      issue: k + ' phaseBelief estimator abstained',
      severity: 'high',
      count: 1,
      action: 'inspect the surfaced estimator telemetry; do not relax the precision floor — reason: ' + reason,
      organ: id
    });
  }

  if (!promotedKeys.length) {
    metrics.domainCount = Object.keys(domains).length;
    metrics.abstainingDomains = abstainingKeys;
    return {
      score: 50, status: 'DEGRADED',
      summary: 'no domain shows an active stress promotion yet (no _legacyFeedStress field on any domain)',
      metrics,
      attention: [{ issue: 'No domain in the console snapshot has an active stress promotion (_legacyFeedStress absent everywhere)', severity: 'medium', count: 1, action: 'check STRESS_PROMOTION_DOMAINS in handlers/limen-worker-snapshot.js and wait for the next worker tick', organ: id }]
        .concat(attention)
    };
  }

  for (const k of promotedKeys) probeDomain(k, domains[k], probes, metrics, attention);

  const score = Math.round(probes.reduce((a, p) => a + p.score, 0) / probes.length);
  const status = score >= 90 ? 'HEALTHY' : score >= 60 ? 'DEGRADED' : 'IN_PAIN';
  metrics.probes = Object.fromEntries(probes.map(p => [p.name, p.score]));
  metrics.snapshotAgeSec = snap && snap.generatedAt ? Math.round((Date.now() - snap.generatedAt) / 1000) : null;
  metrics.promotedDomains = promotedKeys;
  metrics.abstainingDomains = abstainingKeys;

  return {
    score, status,
    summary: promotedKeys.length + ' domain(s) promoted (' + promotedKeys.join(', ') + ') · '
      + probes.filter(p => p.score === 100).length + '/' + probes.length + ' probes green',
    metrics, attention
  };
}
