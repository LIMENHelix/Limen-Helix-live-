/**
 * lib/consolidator.js — the CONSOLIDATOR's core math (hippocampus component 3).
 *
 * Closes the last hop of the learning loop. The RECORDER (feed-record) captures realized feed
 * truth and the RESOLVER (feed-resolve) grades stored forecasts against it — but nothing turned
 * that accrued outcome truth into a durable, reviewable calibration/drift read. This does.
 *
 * PROPOSE-ONLY (non-negotiable):
 *   - It NEVER applies a weight, arms a layer, changes a live forecast, or touches the kill-switch
 *     or brakes. It reads recorder + resolver + persisted weight history and emits a REVIEWABLE
 *     proposal object with applied:false, requiresHumanReview:true. A human applies, or nothing does.
 *   - No fabrication: metrics that the data cannot support are reported null with an honest note
 *     (e.g. Brier needs a per-forecast confidence; server-derived forecasts carry none, so brier=null).
 *
 * Pure: no Redis, no network, no Date. The handler supplies rows + `now`. Deterministic.
 */

function r4(x) { return Math.round(x * 10000) / 10000; }

// ── Calibration ────────────────────────────────────────────────────────────
// forecasts:     the stored forecast rows (may carry an optional numeric `confidence`)
// resolveResult: the output of lib/feed-resolver.resolve() — has resolved[], externalHitRate, pendingCount
function calibration(forecasts, resolveResult) {
  var res = resolveResult || {};
  var resolved = res.resolved || [];
  var resolvedCount = resolved.length;
  var pendingCount = res.pendingCount || 0;
  var resolutionRate = (resolvedCount + pendingCount) ? r4(resolvedCount / (resolvedCount + pendingCount)) : null;
  var hitRate = (typeof res.externalHitRate === 'number') ? res.externalHitRate : null;

  // per-direction reliability — does the domain systematically over-call one direction?
  var byDirection = {};
  resolved.forEach(function (rrow) {
    var d = rrow.direction; if (!d) return;
    byDirection[d] = byDirection[d] || { n: 0, hits: 0 };
    byDirection[d].n++; byDirection[d].hits += (rrow.hit ? 1 : 0);
  });
  Object.keys(byDirection).forEach(function (d) { byDirection[d].hitRate = r4(byDirection[d].hits / byDirection[d].n); });

  // Brier — ONLY when forecasts carry a numeric confidence (probability the direction call is right).
  // Server-derived forecasts (deriveForecast) carry none, so this abstains honestly rather than inventing one.
  var confMap = {};
  (forecasts || []).forEach(function (f) { if (f && typeof f.madeAt === 'number' && typeof f.confidence === 'number') confMap[f.madeAt] = f.confidence; });
  var brierN = 0, brierSum = 0, confSum = 0;
  resolved.forEach(function (rrow) {
    var c = confMap[rrow.madeAt];
    if (typeof c === 'number') { brierN++; brierSum += (c - rrow.hit) * (c - rrow.hit); confSum += c; }
  });
  var brier = brierN ? r4(brierSum / brierN) : null;
  var meanConfidence = brierN ? r4(confSum / brierN) : null;
  var overconfidence = (meanConfidence !== null && hitRate !== null) ? r4(meanConfidence - hitRate) : null; // >0 ⇒ overconfident

  // Skill = hit rate minus what always saying "stable" would have scored on the same
  // rows. This is the only one of these numbers that can tell a forecast from an
  // abstention, and it is what the promotion gate below runs on. Null when the
  // resolver did not supply a baseline (older stored results), which the gate treats
  // as "cannot promote" rather than as zero.
  var baseRate = (typeof res.alwaysStableRate === 'number') ? res.alwaysStableRate : null;
  var skill = (typeof res.skill === 'number') ? res.skill
    : ((hitRate !== null && baseRate !== null) ? r4(hitRate - baseRate) : null);

  return {
    resolvedCount: resolvedCount, pendingCount: pendingCount, resolutionRate: resolutionRate,
    directionHitRate: hitRate, alwaysStableRate: baseRate, skill: skill,
    directional: res.directional || null, byDirection: byDirection,
    brier: brier, meanConfidence: meanConfidence, overconfidence: overconfidence,
    brierNote: brierN ? null : 'forecasts carry no confidence field (server-derived) — Brier not computable; direction hit-rate is the honest calibration signal',
    skillNote: skill === null ? 'no baseline available — skill not computable, so this domain cannot be a promotion candidate'
      : (skill > 0 ? null : 'hit rate ' + hitRate + ' does not beat the always-stable baseline of ' + baseRate +
                            ' — the calls are abstention, not competence')
  };
}

// ── Weight drift ─────────────────────────────────────────────────────────────
// snapshots: the brainwts:hist:<domain> list (LPUSH ⇒ index 0 = newest). Each entry is a
// P.serialize() snapshot: { layers: { key: { diag:{driftFromSeed,oscillating,runaway,stable}, ... } } }.
function weightDrift(snapshots) {
  var snaps = (snapshots || []).filter(function (s) { return s && s.layers; });
  if (!snaps.length) return { available: false, note: 'no persisted weight history for this domain (only energy/finance persist today)' };
  var newest = snaps[0], oldest = snaps[snaps.length - 1];   // LPUSH: 0 newest, last oldest
  var layers = {}, anyOsc = false, anyRun = false;
  Object.keys(newest.layers || {}).forEach(function (k) {
    var lo = (oldest.layers || {})[k], ln = (newest.layers || {})[k];
    var d0 = (lo && lo.diag && typeof lo.diag.driftFromSeed === 'number') ? lo.diag.driftFromSeed : null;
    var d1 = (ln && ln.diag && typeof ln.diag.driftFromSeed === 'number') ? ln.diag.driftFromSeed : null;
    var osc = !!(ln && ln.diag && ln.diag.oscillating), run = !!(ln && ln.diag && ln.diag.runaway);
    if (osc) anyOsc = true; if (run) anyRun = true;
    layers[k] = { driftStart: d0, driftEnd: d1, driftDelta: (d0 !== null && d1 !== null) ? r4(d1 - d0) : null,
      oscillating: osc, runaway: run, stable: !!(ln && ln.diag && ln.diag.stable) };
  });
  return { available: true, snapshots: snaps.length, layers: layers,
    stability: anyRun ? 'runaway' : anyOsc ? 'oscillating' : 'stable' };
}

// ── Proposal (REVIEWABLE ONLY) ───────────────────────────────────────────────
// Produces recommendations a human reviews. Every recommendation carries applied:false.
function buildProposal(domain, calib, drift, opts) {
  opts = opts || {};
  var MIN = opts.minResolved || 8;
  var recs = [], status;

  if (!calib || calib.resolvedCount < MIN) {
    status = 'insufficient-data';
    recs.push({ kind: 'none', reason: 'only ' + ((calib && calib.resolvedCount) || 0) + ' resolved forecast(s) (< ' + MIN + ') — no calibration change proposed', applied: false });
  } else {
    status = 'proposed';
    if (calib.directionHitRate !== null && calib.directionHitRate < 0.4) {
      recs.push({ kind: 'recalibrate-forecast', reason: 'direction hit-rate ' + calib.directionHitRate + ' < 0.4',
        proposedChange: 'review forecast slope/eps; consider widening the stable dead-band', applied: false });
    }
    if (calib.overconfidence !== null && calib.overconfidence > 0.15) {
      recs.push({ kind: 'downscale-confidence', reason: 'overconfident by ' + calib.overconfidence + ' (mean conf ' + calib.meanConfidence + ' vs hit-rate ' + calib.directionHitRate + ')',
        proposedFactor: (calib.meanConfidence ? r4(calib.directionHitRate / calib.meanConfidence) : null), applied: false });
    }
    Object.keys(calib.byDirection || {}).forEach(function (d) {
      var b = calib.byDirection[d];
      if (b.n >= 4 && b.hitRate < 0.35) recs.push({ kind: 'direction-bias', reason: '"' + d + '" calls hit only ' + b.hitRate + ' over ' + b.n + ' — possible systematic bias', applied: false });
    });
  }

  if (drift && drift.available) {
    if (drift.stability === 'runaway') {
      recs.push({ kind: 'freeze-or-rollback', reason: 'weight drift RUNAWAY', proposedChange: 'freeze plasticity / rollback to last stable snapshot', applied: false });
    } else if (drift.stability === 'oscillating') {
      recs.push({ kind: 'reduce-eta', reason: 'weight drift OSCILLATING', proposedChange: 'verify metaplasticity etaScale floor is damping this layer', applied: false });
    } else if (status === 'proposed' && calib.skill !== null && calib.skill > 0 &&
               calib.directionHitRate !== null && calib.directionHitRate >= 0.6) {
      // Gated on SKILL, not the hit rate alone. Without this a domain whose stress
      // scalar never moves scores a hit rate of exactly 1.0 by calling "stable"
      // forever, and would have been proposed for arming on the strength of a
      // constant. Eight of the twenty domains have zero variance across the whole
      // recorded history, and eleven produce no directional call at all.
      recs.push({ kind: 'promotion-candidate',
        reason: 'stable weights + hit-rate ' + calib.directionHitRate + ' >= 0.6 AND skill +' + calib.skill + ' over the always-stable baseline',
        proposedChange: 'candidate for arming — HUMAN REVIEW REQUIRED, not auto-armed', applied: false });
    } else if (status === 'proposed' && calib.directionHitRate !== null && calib.directionHitRate >= 0.6 &&
               (calib.skill === null || calib.skill <= 0)) {
      recs.push({ kind: 'no-skill',
        reason: 'hit-rate ' + calib.directionHitRate + ' looks high but skill is ' +
                (calib.skill === null ? 'not computable' : calib.skill) +
                ' against an always-stable baseline of ' + calib.alwaysStableRate,
        proposedChange: 'NOT a promotion candidate: this is abstention scoring well, not forecasting. Fix the signal before arming anything.',
        applied: false });
    }
  }

  return {
    version: 1, domain: domain, generatedAt: (typeof opts.now === 'number') ? opts.now : null,
    status: status, applied: false, requiresHumanReview: true,
    calibration: calib, weightDrift: drift || null, recommendations: recs,
    note: 'PROPOSE-ONLY. The consolidator never applies a weight, arms a layer, changes a live forecast, or bypasses the kill-switch/brakes. A human reviews and applies.'
  };
}

module.exports = { calibration: calibration, weightDrift: weightDrift, buildProposal: buildProposal };
