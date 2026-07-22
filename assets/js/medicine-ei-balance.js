/**
 * medicine-ei-balance.js — Excitation/Inhibition balance controller for the Medicine brain.
 *
 * Grounded in LIMEN_Helix_Neurology_Reference.html Part XIII.1 (the doc's MOST-repeated,
 * fractal-critical invariant): inhibition must scale with excitation, millisecond by
 * millisecond. Lose it and the circuit seizes (runaway); over-apply it and the circuit goes
 * silent. Every other Energy neuro module builds the maintenance/self-tuning half; this adds
 * the missing active-control invariant: a brake whose REQUIRED strength grows with total drive.
 *
 * Contract (identical to the other energy-* neuro modules): PURE + deterministic + no-op-safe +
 * OBSERVE-ONLY. It computes an assessment; it does not mutate the brain, stress, or energy.json.
 * The brain consumes it as an advisory (state.regulationAdvisories.eiBalance). Actuating it into
 * the live brake is a separate, operator-scoped step (same discipline as the refractory limiter).
 *
 * Dual export: window.MedicineEIBalance (browser) + module.exports (server/cron/tests).
 */
(function (root) {
  'use strict';

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function num(x, d) { var n = Number(x); return isFinite(n) ? n : (d || 0); }

  // Default tuning. Kept conservative and OFF-by-default in the sense that it only advises.
  var DEFAULTS = {
    floor: 0.15,        // minimum inhibition a healthy system holds even at rest (resting GABA tone)
    underRatio: 0.6,    // inhibition/drive below this = under-braked (runaway/seizure risk)
    overRatio: 1.8      // inhibition/drive above this = over-inhibited (silence)
  };

  /**
   * assess({ drive, inhibition, floor?, underRatio?, overRatio? })
   *   drive       total excitatory drive 0..1+ (stress + summed active-signal severity)
   *   inhibition  current braking strength 0..1 (active brakes / dampeners)
   * returns { drive, inhibition, required, recommendedInhibition, ratio, state, deficit, note }
   *   state: 'balanced' | 'runaway-risk' | 'over-inhibited'
   */
  function assess(opts) {
    opts = opts || {};
    var cfg = {
      floor: num(opts.floor, DEFAULTS.floor),
      underRatio: num(opts.underRatio, DEFAULTS.underRatio),
      overRatio: num(opts.overRatio, DEFAULTS.overRatio)
    };
    var drive = clamp(num(opts.drive, 0), 0, 4);          // allow >1 (multi-signal storms) but bound
    var inhibition = clamp(num(opts.inhibition, 0), 0, 1);
    // E/I balance target: inhibition tracks drive ~1:1, never below the resting floor.
    var required = clamp(Math.max(cfg.floor, drive), 0, 1);
    var ratio = inhibition / Math.max(drive, 1e-6);
    var state = 'balanced';
    if (drive > cfg.floor && ratio < cfg.underRatio) state = 'runaway-risk';
    else if (ratio > cfg.overRatio && inhibition > cfg.floor) state = 'over-inhibited';
    var deficit = Math.round((required - inhibition) * 1000) / 1000; // >0 => under-braked
    return {
      drive: Math.round(drive * 1000) / 1000,
      inhibition: Math.round(inhibition * 1000) / 1000,
      required: Math.round(required * 1000) / 1000,
      recommendedInhibition: required,
      ratio: Math.round(ratio * 1000) / 1000,
      state: state,
      deficit: deficit,
      note: state === 'runaway-risk'
        ? 'inhibition is not tracking drive; raise braking to ~' + required + ' (Neuro Ref XIII.1)'
        : state === 'over-inhibited'
          ? 'braking exceeds drive; risk of silencing real signal'
          : 'excitation and inhibition are balanced'
    };
  }

  /**
   * Derive drive + inhibition from a live Medicine brain state, defensively. Never throws.
   *   drive      = finalStress/stress + normalized count of active conditions/signals
   *   inhibition = normalized count of active brake reasons + gating dampeners (0..1)
   * This is a best-effort reading so the brain can call assessFromState(state) directly.
   */
  function assessFromState(state, opts) {
    state = state || {};
    var stress = num(state.finalStress != null ? state.finalStress : state.stress, 0);
    var conds = Array.isArray(state._activeConditions) ? state._activeConditions.length
      : (Array.isArray(state.signals) ? state.signals.length : 0);
    var diagnoses = Array.isArray(state.diagnoses) ? state.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    // drive: base stress plus a bounded contribution from how many things are firing at once
    var drive = clamp(stress + Math.min(conds, 12) / 24 + Math.min(diagnoses, 6) / 24, 0, 4);
    // inhibition proxy: brake reasons + gating activity, bounded to 0..1
    var brake = state.energyBrake || state.brake || {};
    var reasons = Array.isArray(brake.reasons) ? brake.reasons.length : (brake.halted ? 2 : 0);
    var gated = num(brake.dampen, 0);
    var inhibition = clamp(reasons / 5 + gated, 0, 1);
    return assess({ drive: drive, inhibition: inhibition, floor: opts && opts.floor, underRatio: opts && opts.underRatio, overRatio: opts && opts.overRatio });
  }

  var API = { assess: assess, assessFromState: assessFromState, DEFAULTS: DEFAULTS, version: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MedicineEIBalance = API;
})(typeof window !== 'undefined' ? window : this);
