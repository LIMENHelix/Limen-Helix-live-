/**
 * brain-v2/core/brain.js — A DOMAIN, AS A BRAIN.
 *
 * Not a scorer with neuro names on it. The cycle below is the loop a regulator actually runs:
 *
 *   SENSE      each channel filters its own signal and tracks its own uncertainty
 *   FUSE       precision-weighted — a channel votes in proportion to how sure it is
 *   ABSTAIN    if total precision is below floor, hold the prior and SAY SO
 *   DETECT     dysregulation = the fused state departing its own recent baseline
 *   FIND       only findings the live sensors can actually distinguish (R3)
 *   ACT        declare the efferent path, or declare there is none (R7)
 *   REPORT     including everything it could not see (R5)
 *
 * The old brain had sense and a score. Everything between was either static content or a
 * computation nothing read. What is different here is small and specific:
 *
 *   1. Uncertainty is a state variable, not a label. It grows when sensors go quiet, and it
 *      alone decides whether the brain speaks. Nobody has to remember to abstain.
 *   2. A constant channel is dead, not calm. Enforced in channel.js, honoured here.
 *   3. Findings are capped by what the sensors can distinguish. A library bigger than the
 *      sensor set is decoration; the cap is asserted at runtime, not documented.
 *   4. Every claim carries its basis. There is no field in the output that says how good a
 *      thing is without naming the measurement that made it.
 *
 * Pure and deterministic. `now` and all readings are passed in. Same inputs, same bytes out.
 */

'use strict';

var CH = require('./channel.js');
var DIV = require('./divergence.js');

/**
 * PRECISION FLOOR — the second gate.
 * Inherited deliberately from lib/phase-estimator.js:28, which uses 0.5 and states its own rule:
 * "Abstain on thin/low-reliability coverage rather than emit a false number." Reusing the
 * existing constant rather than inventing a parallel one, because the repo's abstention
 * discipline is the best thing in it. [mark: prior]
 */
var PRECISION_FLOOR = 0.5;

/** Dysregulation = departure from this domain's OWN recent baseline, in its own units. */
var BASELINE_WINDOW = 24;
var DYS_SIGMA = 2.0;          // [mark: prior] departures beyond 2 baseline sd are notable

function createBrain(spec) {
  if (!spec || !spec.domain) throw new Error('brain needs a domain');
  if (!Array.isArray(spec.channels) || !spec.channels.length) throw new Error('brain needs channels — R1: no input, no claim');

  var channels = spec.channels.map(CH.createChannel);

  /**
   * R3 — CARDINALITY CAP, ASSERTED NOT DOCUMENTED.
   *
   * Each sensor resolves to a small number of ordinal levels (measured: 3 at best for this
   * corpus — every condition is a hard threshold on a scalar). The number of findings the
   * brain may distinguish cannot exceed the number of distinct sensor states. 180 findings
   * against 14 sensors is not a library, it is decoration, and it is why the previous
   * diagnosis corpus could never fire.
   */
  var levels = (typeof spec.levelsPerSensor === 'number') ? spec.levelsPerSensor : 3;
  var cap = channels.length * levels;
  var findings = (spec.findings || []).slice();
  if (findings.length > cap) {
    throw new Error(
      'R3 violation: ' + findings.length + ' findings declared against ' + channels.length +
      ' sensors x ' + levels + ' levels = ' + cap + ' distinguishable states. ' +
      'Reduce the library or add sensors. Surplus belongs in candidates[], never findings[].'
    );
  }

  return {
    domain: spec.domain,
    apparatus: {
      version: spec.version || 'brain-v2/0.1.0',
      sensorManifest: channels.map(function (c) {
        return { key: c.key, source: c.source, cadenceMs: c.cadenceMs, units: c.units, q: c.q, r: c.r };
      }),
      levelsPerSensor: levels,
      findingCap: cap,
      precisionFloor: PRECISION_FLOOR
    },
    channels: channels,
    findings: findings,
    /* Declared channel pairs that claim to observe the same latent variable.
       Only these are compared for disagreement — see core/divergence.js on why an
       all-pairs sweep is noise rather than information. */
    relationships: spec.relationships || [],
    efferent: spec.efferent || null,     // R7: declared consumers, or explicitly none
    history: [],                          // fused state, for the baseline
    cycles: 0
  };
}

/**
 * One cycle. `readings` is { channelKey: {value} }; a key that is absent IS the absence —
 * this is the difference the old code could not express (R2).
 */
function cycle(brain, readings, now) {
  readings = readings || {};
  brain.cycles++;

  // ── SENSE ────────────────────────────────────────────────────────────────────────────
  var sensors = brain.channels.map(function (ch) {
    return CH.step(ch, Object.prototype.hasOwnProperty.call(readings, ch.key) ? readings[ch.key] : null, now);
  });

  var blind = sensors.filter(function (s) { return !s.fusable; })
    .map(function (s) { return { what: s.key, state: s.state, liveness: s.liveness, why: s.why }; });

  // ── FUSE ─────────────────────────────────────────────────────────────────────────────
  // Precision-weighted mean. This line is the inverse-variance rule; it is the same algebra
  // the repo's phase-estimator already uses, and the same operation as a Kalman gain.
  var fusable = sensors.filter(function (s) { return s.fusable; });
  var totalPrecision = fusable.reduce(function (a, s) { return a + s.precision; }, 0);

  var state;
  if (!fusable.length) {
    state = { abstained: true, why: 'no fusable channel this cycle — every sensor is absent, dead, or unproven', totalPrecision: 0 };
  } else if (totalPrecision < PRECISION_FLOOR) {
    state = { abstained: true, why: 'total precision ' + totalPrecision.toFixed(3) + ' < floor ' + PRECISION_FLOOR + ' — holding the prior rather than emitting a number', totalPrecision: totalPrecision };
  } else {
    /**
     * FUSE DEPARTURES, NOT LEVELS.
     *
     * Each channel contributes its reading in its OWN standard deviations, not its raw value.
     * Crude is $/bbl, an RSS channel is an article count, KEV is a vulnerability count — a
     * precision-weighted mean of the raw numbers is arithmetic on incommensurable units, and
     * would be dominated by whichever channel happens to carry the biggest integers. Measured
     * on the live energy payload: RSS `value` runs 52-100 while `recent7d` runs 1-34, so raw
     * fusion lets a saturated article count outvote a genuine price move.
     *
     * In departure units every channel says the same thing — "how far am I from my own normal"
     * — which is also the quantity dysregulation is defined on, so the state and the detector
     * finally speak one language.
     */
    var v = fusable.reduce(function (a, s) { return a + s.departure.z * s.precision; }, 0) / totalPrecision;
    state = {
      departure: v,                                        // in pooled standard deviations
      totalPrecision: totalPrecision,
      confidence: totalPrecision / (totalPrecision + 1),   // bounded, monotone in evidence
      basis: 'precision-weighted fusion of ' + fusable.length + ' live channel departure(s)',
      basisOf: fusable.map(function (s) { return s.key; }),
      units: "standard deviations from each channel own baseline"
    };
  }

  /**
   * DETECT. The fused state is ALREADY a departure, so dysregulation is a threshold on it —
   * no second baseline, no re-derivation. Each contributing channel is named with its own
   * departure so the finding can be read back to the sensor that caused it (R4).
   */
  var dys;
  if (state.abstained) {
    dys = { detected: false, why: 'state abstained — dysregulation is unmeasured, NOT absent' };
  } else {
    brain.history.push(state.departure);
    if (brain.history.length > BASELINE_WINDOW * 4) brain.history.shift();
    var drivers = fusable
      .filter(function (s) { return Math.abs(s.departure.z) >= DYS_SIGMA; })
      .sort(function (a, b) { return Math.abs(b.departure.z) - Math.abs(a.departure.z); })
      .map(function (s) { return { key: s.key, z: s.departure.z, n: s.departure.n }; });
    dys = {
      detected: Math.abs(state.departure) >= DYS_SIGMA,
      departure: state.departure,
      drivers: drivers,
      basis: 'fused departure vs ' + DYS_SIGMA + ' sd threshold [mark: prior]; each channel z-scored against its own >=8-observation baseline'
    };
  }

  // ── FIND — a finding may only fire on channels that actually reported ────────────────
  var liveKeys = {};
  fusable.forEach(function (s) { liveKeys[s.key] = s; });
  var fired = [], candidates = [];
  brain.findings.forEach(function (f) {
    var need = f.requires || [];
    var have = need.filter(function (k) { return liveKeys[k]; });
    if (!need.length || have.length < need.length) {
      // R2/R4: cannot evaluate is not the same as did not fire. It goes to candidates, inert.
      candidates.push({ id: f.id, active: false, triggerSource: 'unevaluated',
        why: 'requires [' + need.join(', ') + ']; live this cycle: [' + have.join(', ') + ']' });
      return;
    }
    // A finding sees three things: raw filtered values, the fused state, and each required
    // channel's DEPARTURE. Thresholds belong on departures — a raw threshold on a saturated
    // count is what latched the old conditions permanently on.
    var vals = {}, deps = {};
    have.forEach(function (k) { vals[k] = liveKeys[k].value; deps[k] = liveKeys[k].departure; });
    var ok = true;
    try { ok = f.test(vals, state, deps); }
    catch (e) { ok = false; }
    if (ok) fired.push({ id: f.id, active: true, triggeredBy: need.slice(), basis: f.basis || 'threshold on live channels' });
    else candidates.push({ id: f.id, active: false, triggerSource: 'evaluated', why: 'conditions not met' });
  });

  /**
   * DIVERGENCE — computed on the SENSORS, deliberately not on the fused state.
   *
   * Fusion is where disagreement is destroyed: two live channels pointing opposite
   * ways average to something unremarkable, and the fused scalar cannot express the
   * gap that produced it. So this runs against the per-channel departures, beside the
   * fusion rather than after it, and it is reported as its own field.
   *
   * SPEC row 10. Absent this, a domain can report a calm state while its instruments
   * are in open contradiction.
   */
  var divergence = DIV.detect(sensors, brain.relationships);

  // ── REPORT ───────────────────────────────────────────────────────────────────────────
  return {
    domain: brain.domain,
    cycleAt: now,
    cycle: brain.cycles,
    apparatus: brain.apparatus,
    sensors: sensors,
    state: state,
    dysregulation: dys,
    divergence: divergence,
    findings: fired,
    candidates: candidates,
    efferent: brain.efferent
      ? { consumers: brain.efferent, declaredNone: false }
      : { consumers: [], declaredNone: true, why: 'no consumer declared — this brain changes nothing outside itself, stated rather than implied' },
    blind: blind
  };
}

module.exports = {
  createBrain: createBrain,
  cycle: cycle,
  PRECISION_FLOOR: PRECISION_FLOOR,
  DYS_SIGMA: DYS_SIGMA
};
