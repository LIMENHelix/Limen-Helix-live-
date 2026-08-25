/**
 * brain-v2/kernel/vitals.js — BLOCK_B4 arousal + BLOCK_B6 set-points + BLOCK_B17 self-model.
 *
 * SPEC B4, B6, B17, INV-13, INV-15, rows 9, 22, 23. MASTER_PROMPT §8.16, §8.17, §K.
 * Fidelity: F0.
 *
 * THREE THINGS LIVE HERE BECAUSE THEY ARE ONE LOOP (SPEC Part 6, L2 and L7):
 * arousal decides whether the system is on and in which state; set-points define what "in
 * range" means and revise themselves on a slower loop; the self-model reports what the system
 * can and cannot currently sense. Splitting them would mean three modules reading each other's
 * state every tick.
 *
 * THE SELF-MODEL IS THE ANOSOGNOSIA FIX AND IT IS NOT A DIAGNOSTIC (INV-13).
 *
 * Losing a sense and losing the knowledge that you had it are dissociable, and the second is
 * far more dangerous: the first produces silence, the second produces confabulation. So the
 * channel inventory is a required output consumed by the confidence layer, not a debug view.
 * `confidence()` below is a function of channel AVAILABILITY, not only internal consistency —
 * a system whose one live channel agrees with itself must report LOW confidence, not high.
 * That inversion is the entire point and it is where most dashboards get it backwards.
 *
 * INV-15 IS CHECKED, NOT ASSUMED. The homeostatic timescale must be strictly slower than the
 * learning timescale or the stabiliser cancels the learner. `timescaleCheck()` compares the
 * declared periods and fails loudly rather than letting a same-tier placement silently null
 * out every weight update.
 *
 * NARRATION IS DOWNSTREAM (§8.17). Nothing in this file generates a description that then
 * becomes state. Every field of the self-model is read from a live structure passed in.
 */

'use strict';

var AROUSAL = {
  WAKE:       'wake',        // encoding. Consolidation forbidden.
  QUIET_WAKE: 'quiet_wake',  // reduced intake, no consolidation yet
  OFFLINE:    'offline',     // consolidation permitted, encoding forbidden
  DOWN:       'down'         // not operating. Distinct from "quiet".
};

var DEFAULTS = {
  // Set-points, each with a DEAD BAND. Error inside the band produces no drive (SPEC B6):
  // continuous correction inside the band is chasing noise.
  setPoints: {
    queueDepth:        { target: 0,    band: 32,   max: 256 },
    amplification:     { target: 1.0,  band: 1.0,  max: 3.0 },
    openPredictions:   { target: 4,    band: 6,    max: 64 },
    overdueProspective:{ target: 0,    band: 2,    max: 16 },
    errorRate:         { target: 0,    band: 0.15, max: 0.5 },
    blindFraction:     { target: 0,    band: 0.4,  max: 0.85 },
    recursionDepth:    { target: 0,    band: 1,    max: 8 },
    eventLoopLagMs:    { target: 0,    band: 100,  max: 1000 },
    memoryBytes:       { target: 0,    band: 4 * 1024 * 1024, max: 16 * 1024 * 1024 },
    computeUnits:      { target: 0,    band: 256,  max: 1024 },
    contradictionLoad:{ target: 0,    band: 2,    max: 16 },
    confidenceDrift:   { target: 0,    band: 0.25, max: 0.60 },
    actionFrequency:   { target: 0,    band: 0.25, max: 0.75 },
    staleStateLoad:    { target: 0,    band: 4,    max: 16 },
    sourceFailureRate: { target: 0,    band: 0.40, max: 0.85 },
    crossDomainPropagationVolume: { target: 0, band: 32, max: 128 },
    learningUpdateVolume: { target: 0, band: 8, max: 64 }
  },
  // INV-4 / INV-15: these must be separated by the stated ratio.
  learningPeriodMs:    3600000,          // T3 tier: weights move at ~1h
  homeostaticPeriodMs: 24 * 3600000,     // T4 tier: set-points revise at ~1d
  minTimescaleRatio:   10,
  degradeAfterConsecutive: 3
};

function create(opts) {
  var o = Object.assign({}, DEFAULTS, opts || {});
  o.setPoints = Object.assign({}, DEFAULTS.setPoints, (opts && opts.setPoints) || {});
  return {
    opts: o,
    ownerDomain: o.ownerDomain || null,
    arousal: AROUSAL.WAKE,
    arousalSince: null,
    consecutiveOutOfRange: 0,
    degraded: false,
    degradedReason: null,
    setPointHistory: [],
    lastSetPointRevision: null,
    lastConfidence: null,
    version: 0
  };
}

/* MASTER_PROMPT §8.16. These names are an acceptance contract, not narration. */
var RESOURCE_REQUIREMENTS = [
  'queueDepth', 'recursionDepth', 'eventLoopLagMs', 'memoryBytes', 'computeUnits',
  'errorRate', 'contradictionLoad', 'amplification', 'confidenceDrift',
  'actionFrequency', 'staleStateLoad', 'sourceFailureRate',
  'crossDomainPropagationVolume', 'learningUpdateVolume'
];

var RESOURCE_UNITS = {
  queueDepth: 'packets', recursionDepth: 'frames', eventLoopLagMs: 'ms',
  memoryBytes: 'bytes', computeUnits: 'bounded-work-units', errorRate: 'fraction',
  contradictionLoad: 'open-claims', amplification: 'ratio', confidenceDrift: 'absolute-delta',
  actionFrequency: 'executions/tick', staleStateLoad: 'items', sourceFailureRate: 'fraction',
  crossDomainPropagationVolume: 'packets/tick', learningUpdateVolume: 'updates/tick'
};

function resourceState(measurements, basis, ownerDomain) {
  measurements = measurements || {};
  basis = basis || {};
  var rows = RESOURCE_REQUIREMENTS.map(function (name) {
    var value = measurements[name];
    var measured = typeof value === 'number' && isFinite(value);
    return {
      name: name,
      status: measured ? 'MEASURED' : 'UNMEASURED',
      value: measured ? value : null,
      unit: RESOURCE_UNITS[name],
      basis: basis[name] || null
    };
  });
  var measured = rows.filter(function (row) { return row.status === 'MEASURED'; }).length;
  return {
    schemaVersion: 'brain-v2-resource-state/1.0',
    ownerDomain: ownerDomain || null,
    policyId: ownerDomain ? 'brain-v2-resource-policy/1:' + ownerDomain : 'brain-v2-resource-policy/1:unowned',
    required: rows.length,
    measured: measured,
    complete: measured === rows.length,
    missing: rows.filter(function (row) { return row.status !== 'MEASURED'; }).map(function (row) { return row.name; }),
    variables: rows
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// BLOCK_B4 — AROUSAL
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The state variable that makes state-exclusivity enforceable.
 *
 * Without it there is no way to distinguish "quiet because nothing is happening" from "quiet
 * because the system is down", and no basis for scheduling offline work. Those are the two
 * failures SPEC B4 names, and both are invisible to a system with no arousal variable.
 */
function setArousal(v, state, now, why) {
  if ([AROUSAL.WAKE, AROUSAL.QUIET_WAKE, AROUSAL.OFFLINE, AROUSAL.DOWN].indexOf(state) < 0) {
    throw new Error('unknown arousal state: ' + state);
  }
  var prior = v.arousal;
  v.arousal = state;
  v.arousalSince = now;
  v.version++;
  return { from: prior, to: state, at: now, why: why || null };
}

/** May encoding run right now. */
function mayEncode(v) {
  return { allowed: v.arousal === AROUSAL.WAKE || v.arousal === AROUSAL.QUIET_WAKE, state: v.arousal };
}
/** May consolidation run right now. Row 12. */
function mayConsolidate(v) {
  return {
    allowed: v.arousal === AROUSAL.OFFLINE,
    state: v.arousal,
    why: v.arousal === AROUSAL.OFFLINE ? null : 'consolidation requires the offline state; current state is ' + v.arousal
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// BLOCK_B6 — SET-POINTS, WITH A DEAD BAND, REVISABLE ON A SLOWER LOOP
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Compare measurements against set-points. Returns DRIVES, not commands (SPEC B6).
 * Inside the band the drive is exactly zero and is reported as "in band" rather than as a
 * small correction, because a system that corrects continuously inside its own tolerance is
 * chasing noise and will never settle.
 */
function evaluate(v, measurements) {
  var drives = [], breaches = [];
  Object.keys(v.opts.setPoints).forEach(function (k) {
    var sp = v.opts.setPoints[k];
    var m = measurements[k];
    if (typeof m !== 'number' || !isFinite(m)) {
      drives.push({ variable: k, status: 'UNMEASURED', drive: 0, why: 'no measurement supplied this cycle' });
      return;
    }
    var err = m - sp.target;
    var inBand = Math.abs(err) <= sp.band;
    var breached = m > sp.max;
    if (breached) breaches.push({ variable: k, value: m, max: sp.max });
    drives.push({
      variable: k, value: m, target: sp.target, band: sp.band, max: sp.max,
      error: err,
      inBand: inBand,
      // Drive is proportional to the excursion BEYOND the band, not to the raw error.
      drive: inBand ? 0 : (err > 0 ? err - sp.band : err + sp.band),
      breached: breached,
      status: 'MEASURED'
    });
  });
  return { drives: drives, breaches: breaches, anyBreach: breaches.length > 0 };
}

/**
 * ALLOSTASIS — set-points revise themselves, on a strictly slower loop.
 *
 * A fixed set-point is a thermostat, not a hypothalamus. But the revision must be slower than
 * the correction or the target chases the measurement and nothing is ever out of range. The
 * period gate below is the whole mechanism.
 */
function reviseSetPoints(v, observedStats, now) {
  if (v.lastSetPointRevision !== null && (now - v.lastSetPointRevision) < v.opts.homeostaticPeriodMs) {
    return {
      revised: false,
      why: 'homeostatic period not elapsed (' + (now - v.lastSetPointRevision) + 'ms of ' + v.opts.homeostaticPeriodMs + 'ms). ' +
           'Revising faster than this would let the target chase the measurement (INV-15).'
    };
  }
  var changes = [];
  Object.keys(observedStats).forEach(function (k) {
    var sp = v.opts.setPoints[k];
    var st = observedStats[k];
    if (!sp || !st || typeof st.median !== 'number' || !st.n || st.n < 8) return;
    // Move the band toward the observed spread, bounded. The TARGET is not moved automatically:
    // a target that tracks the measurement defends nothing.
    var newBand = clamp(st.iqr || sp.band, sp.band * 0.5, sp.band * 2);
    if (Math.abs(newBand - sp.band) > 1e-9) {
      changes.push({ variable: k, bandFrom: sp.band, bandTo: newBand, basis: 'observed IQR over n=' + st.n });
      sp.band = newBand;
    }
  });
  v.lastSetPointRevision = now;
  v.setPointHistory.push({ at: now, changes: changes });
  if (v.setPointHistory.length > 64) v.setPointHistory.shift();
  v.version++;
  return { revised: changes.length > 0, changes: changes, at: now };
}

/**
 * INV-15 / row 23. Checked, not assumed.
 * If homeostasis runs at or near the learning rate, the stabiliser cancels the learner and
 * every weight update is silently undone. This returns a hard pass/fail with the ratio.
 */
function timescaleCheck(v) {
  var ratio = v.opts.homeostaticPeriodMs / v.opts.learningPeriodMs;
  return {
    learningPeriodMs: v.opts.learningPeriodMs,
    homeostaticPeriodMs: v.opts.homeostaticPeriodMs,
    ratio: ratio,
    required: v.opts.minTimescaleRatio,
    passes: ratio >= v.opts.minTimescaleRatio,
    why: ratio >= v.opts.minTimescaleRatio
      ? 'homeostatic tier is ' + ratio.toFixed(1) + 'x slower than the learning tier'
      : 'INV-15 VIOLATION: homeostasis at ' + ratio.toFixed(2) + 'x learning speed will cancel learning rather than stabilise it'
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// BLOCK_B17 — THE SELF-MODEL AND CHANNEL INVENTORY
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * CHANNEL INVENTORY — INV-13, row 9.
 *
 * Four states, and the distinctions are the point:
 *   live       reporting and moving
 *   degraded   reporting but stale relative to its OWN cadence
 *   dead       reporting a constant. Not calm. Refuses fusion.
 *   absent     not reporting at all
 *   unproven   too few observations to judge — NOT a soft "live"
 */
function channelInventory(sensors, now) {
  var inv = { live: [], degraded: [], dead: [], absent: [], unproven: [] };
  (sensors || []).forEach(function (s) {
    var entry = { key: s.key, source: s.source, cadenceMs: s.cadenceMs, updates: s.updates, precision: s.precision };
    if (s.state === 'dead') { inv.dead.push(entry); return; }
    if (s.state === 'absent') { inv.absent.push(entry); return; }
    if (s.liveness === 'unknown') { inv.unproven.push(entry); return; }
    if (s.fusable) inv.live.push(entry); else inv.degraded.push(entry);
  });
  var declared = (sensors || []).length;
  return {
    declared: declared,
    live: inv.live.length,
    degraded: inv.degraded.length,
    dead: inv.dead.length,
    absent: inv.absent.length,
    unproven: inv.unproven.length,
    detail: inv,
    liveFraction: declared ? inv.live.length / declared : 0,
    blindFraction: declared ? (declared - inv.live.length) / declared : 1,
    // The sentence the system must be able to say about itself.
    statement: declared
      ? 'declares ' + declared + ' channels; ' + inv.live.length + ' live, ' + inv.degraded.length +
        ' degraded, ' + inv.dead.length + ' dead (constant), ' + inv.absent.length + ' absent, ' +
        inv.unproven.length + ' unproven'
      : 'no channels declared'
  };
}

/**
 * CONFIDENCE AS A FUNCTION OF CHANNEL AVAILABILITY (SPEC B17, row 9).
 *
 * This is the inversion that matters: internal agreement is NOT evidence when there is only
 * one voice. A single live channel that agrees with itself gets LOW confidence here, where a
 * consistency-only measure would give it high confidence. That is the anosognosia fix expressed
 * as arithmetic rather than as a caveat in a report nobody reads.
 */
function confidence(inventory, internalConsistency) {
  var live = inventory.live;
  if (live === 0) {
    return { value: 0, status: 'ABSTAIN', why: 'no live channel — there is nothing to be confident about' };
  }
  // Coverage saturates: 1 channel is weak evidence however consistent, 4+ is a real sensorium.
  var coverage = 1 - Math.exp(-live / 2.5);
  var consistency = clamp01(numOr(internalConsistency, 0.5));
  var value = coverage * consistency;
  return {
    value: value,
    coverage: coverage,
    consistency: consistency,
    liveChannels: live,
    status: live >= 3 ? 'MEASURED' : 'ESTIMATED',
    why: live === 1
      ? 'ONE live channel. Internal consistency is not evidence when there is only one voice; ' +
        'confidence is capped by coverage (' + coverage.toFixed(3) + ') regardless of how well that channel agrees with itself.'
      : live + ' live channels; confidence = coverage(' + coverage.toFixed(3) + ') x consistency(' + consistency.toFixed(3) + ')'
  };
}

/**
 * THE SELF-MODEL. Every field is read from a live structure passed in — none is narrated.
 * MASTER_PROMPT §K: "Do not generate this report from narrative memory."
 */
function selfModel(v, ctx) {
  var now = ctx.now;
  var inv = channelInventory(ctx.sensors, now);
  var conf = confidence(inv, ctx.internalConsistency);
  var measurements = Object.assign({}, ctx.measurements || {});
  measurements.confidenceDrift = v.lastConfidence === null ? 0 : Math.abs(conf.value - v.lastConfidence);
  v.lastConfidence = conf.value;
  var resources = resourceState(measurements, ctx.measurementBasis || {}, v.ownerDomain);
  var homeo = evaluate(v, measurements);
  var ts = timescaleCheck(v);

  return {
    at: now,
    arousal: { state: v.arousal, since: v.arousalSince, mayEncode: mayEncode(v).allowed, mayConsolidate: mayConsolidate(v).allowed },
    channelInventory: inv,
    confidence: conf,
    resourceState: resources,
    // What the system cannot currently sense. The named list, not a count.
    blindSpots: inv.detail.dead.map(function (c) { return { channel: c.key, why: 'constant across its liveness window — dead, not calm' }; })
      .concat(inv.detail.absent.map(function (c) { return { channel: c.key, why: 'no reading' }; }))
      .concat(inv.detail.unproven.map(function (c) { return { channel: c.key, why: 'only ' + c.updates + ' observations — cannot yet judge whether it moves' }; })),
    modules: {
      available: (ctx.modulesAvailable || []).slice(),
      unavailable: (ctx.modulesUnavailable || []).slice()
    },
    homeostasis: homeo,
    timescaleSeparation: ts,
    degraded: v.degraded,
    degradedReason: v.degradedReason,
    outstanding: ctx.outstanding || null,
    permissions: (ctx.permissions || []).slice(),
    // Stated capabilities the system does NOT have. §8.17 requires this explicitly.
    capabilitiesAbsent: [
      'this kernel loop has no external actuator: no network, repository writes, or deploys',
      'this kernel loop has no authority to change its own permissions, thresholds, or code',
      'no validated cross-domain causal model; each runtime loop binds one owning domain',
      'no calibrated confidence until n>=20 resolved predictions (see predict.calibration)'
    ],
    generatedFrom: 'live runtime structures passed into selfModel(); no field is narrated'
  };
}

/**
 * HOMEOSTATIC RESPONSE. Degraded mode after repeated breaches, recovery after quiet.
 * Bidirectional on purpose: a system that can only degrade never comes back.
 */
function regulate(v, homeo, now) {
  var actions = [];
  if (homeo.anyBreach) {
    v.consecutiveOutOfRange++;
    homeo.breaches.forEach(function (b) {
      if (b.variable === 'queueDepth') actions.push({ action: 'reduce_propagation', why: 'queue depth ' + b.value + ' > ' + b.max });
      if (b.variable === 'amplification') actions.push({ action: 'increase_inhibition', why: 'amplification ' + b.value.toFixed(2) + ' > ' + b.max });
      if (b.variable === 'errorRate') actions.push({ action: 'lower_learning_rate', why: 'error rate ' + b.value.toFixed(3) + ' > ' + b.max });
      if (b.variable === 'blindFraction') actions.push({ action: 'observation_only', why: 'blind fraction ' + b.value.toFixed(3) + ' > ' + b.max + ' — too little sensorium to act on' });
      if (b.variable === 'recursionDepth') actions.push({ action: 'stop_recursive_processing', why: 'recursion depth ' + b.value + ' > ' + b.max });
      if (b.variable === 'eventLoopLagMs') actions.push({ action: 'defer_nonurgent_processing', why: 'event-loop lag ' + b.value.toFixed(1) + 'ms > ' + b.max + 'ms' });
      if (b.variable === 'memoryBytes') actions.push({ action: 'compact_memory', why: 'memory pressure ' + b.value + ' bytes > ' + b.max });
      if (b.variable === 'computeUnits') actions.push({ action: 'reduce_compute', why: 'compute work ' + b.value + ' units > ' + b.max });
      if (b.variable === 'contradictionLoad') actions.push({ action: 'collect_contradiction_evidence', why: 'open contradiction load ' + b.value + ' > ' + b.max });
      if (b.variable === 'confidenceDrift') actions.push({ action: 'observation_only', why: 'confidence drift ' + b.value.toFixed(3) + ' > ' + b.max });
      if (b.variable === 'actionFrequency') actions.push({ action: 'increase_inhibition', why: 'action frequency ' + b.value.toFixed(3) + ' > ' + b.max });
      if (b.variable === 'staleStateLoad') actions.push({ action: 'isolate_stale_state', why: 'stale-state load ' + b.value + ' > ' + b.max });
      if (b.variable === 'sourceFailureRate') actions.push({ action: 'observation_only', why: 'source failure rate ' + b.value.toFixed(3) + ' > ' + b.max });
      if (b.variable === 'crossDomainPropagationVolume') actions.push({ action: 'reduce_propagation', why: 'cross-domain propagation ' + b.value + ' > ' + b.max });
      if (b.variable === 'learningUpdateVolume') actions.push({ action: 'lower_learning_rate', why: 'learning-update volume ' + b.value + ' > ' + b.max });
    });
    if (v.consecutiveOutOfRange >= v.opts.degradeAfterConsecutive && !v.degraded) {
      v.degraded = true;
      v.degradedReason = homeo.breaches.map(function (b) { return b.variable; }).join(', ');
      actions.push({ action: 'enter_degraded_mode', why: v.consecutiveOutOfRange + ' consecutive cycles out of range on: ' + v.degradedReason });
    }
  } else {
    v.consecutiveOutOfRange = 0;
    if (v.degraded) {
      v.degraded = false;
      var was = v.degradedReason;
      v.degradedReason = null;
      actions.push({ action: 'exit_degraded_mode', why: 'all variables back inside their bands (was: ' + was + ')' });
    }
  }
  v.version++;
  return { actions: actions, degraded: v.degraded, consecutiveOutOfRange: v.consecutiveOutOfRange };
}

function clamp01(x) { return clamp(x, 0, 1); }
function clamp(x, lo, hi) { return (typeof x !== 'number' || !isFinite(x)) ? lo : (x < lo ? lo : (x > hi ? hi : x)); }
function numOr(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : d; }

function serialize(v) { return { opts: v.opts, ownerDomain: v.ownerDomain, arousal: v.arousal, arousalSince: v.arousalSince, consecutiveOutOfRange: v.consecutiveOutOfRange, degraded: v.degraded, degradedReason: v.degradedReason, setPointHistory: v.setPointHistory.slice(-32), lastSetPointRevision: v.lastSetPointRevision, lastConfidence: v.lastConfidence, version: v.version }; }
function deserialize(o) {
  var v = create(o && o.opts);
  if (!o) return v;
  v.ownerDomain = o.ownerDomain || (o.opts && o.opts.ownerDomain) || null;
  v.arousal = o.arousal || AROUSAL.WAKE;
  v.arousalSince = o.arousalSince || null;
  v.consecutiveOutOfRange = o.consecutiveOutOfRange || 0;
  v.degraded = !!o.degraded;
  v.degradedReason = o.degradedReason || null;
  v.setPointHistory = o.setPointHistory || [];
  v.lastSetPointRevision = o.lastSetPointRevision || null;
  v.lastConfidence = typeof o.lastConfidence === 'number' && isFinite(o.lastConfidence) ? o.lastConfidence : null;
  v.version = o.version || 0;
  return v;
}

module.exports = {
  AROUSAL: AROUSAL,
  DEFAULTS: DEFAULTS,
  RESOURCE_REQUIREMENTS: RESOURCE_REQUIREMENTS.slice(),
  resourceState: resourceState,
  create: create,
  setArousal: setArousal,
  mayEncode: mayEncode,
  mayConsolidate: mayConsolidate,
  evaluate: evaluate,
  reviseSetPoints: reviseSetPoints,
  timescaleCheck: timescaleCheck,
  channelInventory: channelInventory,
  confidence: confidence,
  selfModel: selfModel,
  regulate: regulate,
  serialize: serialize,
  deserialize: deserialize
};
