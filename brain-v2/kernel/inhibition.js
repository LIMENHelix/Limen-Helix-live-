/**
 * brain-v2/kernel/inhibition.js — SPEC Part 4. Three arithmetics, not one parameter.
 *
 * SPEC rows 4 and 5, INV-2. Fidelity: F1 (algorithmic). MASTER_PROMPT §5: this is a
 * computational abstraction of a circuit motif (E4), not a claim about GABA receptors (E1).
 *
 * WHY THIS IS A SEPARATE FILE AND NOT A MULTIPLIER SOMEWHERE.
 *
 * The standing diagnosis calls scalar inhibition lesion #2 and the neurologist's correction is
 * that it is a *specification* error, not a missing file: a scalar cannot express what
 * inhibition does, so tuning the number never fixes it. Three populations do three different
 * arithmetic operations and they are not interchangeable:
 *
 *   PV+  divisive (shunting)  — scales the response, does not change which inputs qualify
 *   SOM+ subtractive          — changes WHICH inputs pass, before they are summed
 *   VIP+ permissive           — enables by removing a brake, not by adding drive
 *
 * THE LOAD-BEARING PROPERTY (INV-2). Shunting inhibition is a CONDUCTANCE. The inhibitory
 * current is g_i·(V − E_Cl): it contains the membrane potential, so it grows automatically as
 * the cell is driven harder. The brain does not need a controller to keep excitation and
 * inhibition matched — the physics does it. Any implementation that computes inhibition
 * independently of current drive needs a balancing controller, and that controller is a new
 * failure point that will itself need balancing.
 *
 * So `shunt()` below takes `drive` as an argument. That single signature is the difference
 * between this file and a multiplier, and it is what SPEC row 4 actually tests for.
 */

'use strict';

/**
 * PV+ PERISOMATIC — DIVISIVE / SHUNTING. Gain control.
 *
 *   I_inhib = g · (drive − E_rev)
 *   net     = drive − I_inhib = drive·(1 − g) + g·E_rev
 *
 * With E_rev at rest (0 by convention here) this is pure division of gain: net = drive·(1−g).
 * The key property is visible in the first line, not the second — the current is a function of
 * how driven the unit already is, so a unit at rest is barely inhibited and a unit at full
 * drive is inhibited hard, with no external controller and no per-case tuning.
 *
 * E_rev slightly above 0 makes it shunting-with-a-floor, which is the biologically ordinary
 * case (chloride reversal sits near, not at, rest).
 */
function shunt(drive, g, eRev) {
  if (typeof drive !== 'number' || !isFinite(drive)) return { net: 0, current: 0, why: 'no drive' };
  var gg = clamp01(g);
  var e = (typeof eRev === 'number') ? eRev : 0;
  var current = gg * (drive - e);
  var net = drive - current;
  return {
    net: net,
    current: current,
    conductance: gg,
    reversal: e,
    // The evidence that this is a conductance and not a multiplier: the current CHANGES with
    // drive. Two calls at different drives with the same g return different currents.
    tracksdrive: true,
    form: 'I = g*(drive - E_rev); net = drive - I'
  };
}

/**
 * SOM+ DENDRITE-TARGETING — SUBTRACTIVE. Threshold shift, per input stream, BEFORE summation.
 *
 * This is the arithmetic that changes *which* inputs qualify. Applying it after summation
 * would make it another gain knob; the position in the pipeline is the mechanism, so this
 * function operates on a map of streams and the caller must not sum first.
 */
function subtractPerStream(streams, thetas) {
  var out = {}, suppressed = [], passed = [];
  Object.keys(streams).forEach(function (k) {
    var v = streams[k];
    var theta = (thetas && typeof thetas[k] === 'number') ? thetas[k] : (thetas && typeof thetas._default === 'number' ? thetas._default : 0);
    var net = v - theta;
    if (net <= 0) { out[k] = 0; suppressed.push({ stream: k, value: v, threshold: theta }); }
    else { out[k] = net; passed.push({ stream: k, value: v, threshold: theta, net: net }); }
  });
  return { streams: out, suppressed: suppressed, passed: passed, form: 'net_k = max(0, x_k - theta_k), applied per stream before summation' };
}

/**
 * VIP+ DISINHIBITORY — PERMISSIVE GATING. Enable by removing a brake.
 *
 * Returns the REDUCED inhibitory conductance, not an added drive. That distinction is the
 * whole point: a system that can only enable by adding drive accumulates load instead of
 * reallocating it, because every "yes" raises total activity. Brake-release keeps total drive
 * constant and changes where it lands.
 *
 * This is the same primitive as basal-ganglia disinhibition (BLOCK_B10) and select.js calls
 * THIS function rather than reimplementing it — SPEC Part 4 says it should share a mechanism.
 */
function disinhibit(inhibitoryConductance, vip) {
  var g0 = clamp01(inhibitoryConductance);
  var v = clamp01(vip);
  var g1 = g0 * (1 - v);
  return {
    conductanceBefore: g0,
    conductanceAfter: g1,
    released: g0 - g1,
    addedDrive: 0,          // stated explicitly: nothing was excited to make this happen
    form: 'g_after = g_before * (1 - vip) — a brake is released, no drive is added'
  };
}

/**
 * FOUR MOTIFS (SPEC Part 4). Each present, each named, so a wiring can be checked for which
 * ones it actually uses rather than assumed to have all four.
 */
var MOTIF = {
  FEEDFORWARD: 'feedforward',   // input excites target AND an interneuron -> narrow time window
  FEEDBACK:    'feedback',      // output loops back through an interneuron -> self-limiting
  LATERAL:     'lateral',       // active units suppress neighbours -> competition, opportunity cost
  DISINHIBIT:  'disinhibition'  // permissive gating -> selection
};

/**
 * FEEDFORWARD INHIBITION — the guardrail BEFORE action.
 * The same input that drives the target also drives the brake, so a large input does not get a
 * proportionally large window; it gets a *narrower* one. This is why a surge cannot simply
 * force its way through by being big.
 */
function feedforward(drive, gain, windowMs) {
  var brake = clamp01(gain * Math.abs(drive));
  var res = shunt(drive, brake, 0);
  return {
    motif: MOTIF.FEEDFORWARD,
    net: res.net,
    brakeConductance: brake,
    effectiveWindowMs: windowMs / (1 + brake * 4),
    why: 'the input drives both the target and its brake; larger input yields a narrower window'
  };
}

/** FEEDBACK (RECURRENT) INHIBITION — the rein-in AFTER action. Self-limiting gain. */
function feedback(drive, recentOutput, gain) {
  var brake = clamp01(gain * Math.abs(recentOutput));
  var res = shunt(drive, brake, 0);
  return { motif: MOTIF.FEEDBACK, net: res.net, brakeConductance: brake, why: 'recent output feeds its own brake' };
}

/**
 * LATERAL INHIBITION — competition. Winner-take-more, not winner-take-all.
 *
 * The absence of this motif is the absence of opportunity cost: without neighbours suppressing
 * each other, every option can be "good" simultaneously and nothing is ever traded off. Note
 * the suppression is shunting, so a strong competitor suppresses proportionally to how strong
 * the suppressed unit already is.
 */
function lateral(activations, strength) {
  var keys = Object.keys(activations);
  if (!keys.length) return { motif: MOTIF.LATERAL, out: {}, why: 'nothing to compete' };
  var s = clamp01(strength);
  var total = keys.reduce(function (a, k) { return a + Math.max(0, activations[k]); }, 0);
  var out = {}, detail = [];
  keys.forEach(function (k) {
    var self = Math.max(0, activations[k]);
    var others = total - self;
    var g = clamp01(s * (total > 0 ? others / total : 0));
    var r = shunt(activations[k], g, 0);
    out[k] = r.net;
    detail.push({ unit: k, raw: activations[k], competitorMass: others, conductance: g, net: r.net });
  });
  return { motif: MOTIF.LATERAL, out: out, detail: detail, why: 'each unit is shunted in proportion to its competitors mass' };
}

/** Which motifs a given wiring actually exercised. Used by the self-model, not decoration. */
function motifAudit(used) {
  var all = [MOTIF.FEEDFORWARD, MOTIF.FEEDBACK, MOTIF.LATERAL, MOTIF.DISINHIBIT];
  var missing = all.filter(function (m) { return used.indexOf(m) < 0; });
  var diagnosis = [];
  if (missing.indexOf(MOTIF.LATERAL) >= 0) diagnosis.push('no lateral: no competition, therefore no representation of opportunity cost');
  if (missing.indexOf(MOTIF.DISINHIBIT) >= 0) diagnosis.push('no disinhibition: can only enable by adding drive, so load accumulates instead of reallocating');
  if (missing.indexOf(MOTIF.FEEDFORWARD) >= 0) diagnosis.push('no feedforward: no guardrail before action, only correction after');
  if (missing.indexOf(MOTIF.FEEDBACK) >= 0) diagnosis.push('no feedback: gain is not self-limiting');
  return { used: used.slice(), missing: missing, complete: missing.length === 0, diagnosis: diagnosis };
}

function clamp01(v) { return (typeof v !== 'number' || !isFinite(v)) ? 0 : (v < 0 ? 0 : (v > 1 ? 1 : v)); }

module.exports = {
  shunt: shunt,
  subtractPerStream: subtractPerStream,
  disinhibit: disinhibit,
  feedforward: feedforward,
  feedback: feedback,
  lateral: lateral,
  motifAudit: motifAudit,
  MOTIF: MOTIF
};
