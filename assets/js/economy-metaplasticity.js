/*
 * economy-metaplasticity.js  — ADDITIVE meta-controller  (THE NEW STRATEGY)
 * ----------------------------------------------------------------------------
 * METAPLASTICITY build-target — the capstone that makes Economy's neuro-substrate SELF-TUNING.
 * Source (only): neuro ref XIII.6 — "metaplasticity: plasticity of plasticity; the THRESHOLD
 * FOR CHANGE itself adapts." Homeostatic (BCM-like) direction: more prior activity/volatility
 * -> RAISE the threshold for further change (harder to potentiate) so learning can't run away;
 * quieter state -> relax.
 *
 * Strategy: metaplasticity does not act on the domain directly. It reads a system-state signal
 * and ADAPTS THE KNOBS of the already-built mechanisms:
 *   - offline down-scaling factor      (economy-offline-maintenance.js)
 *   - refractory absolute window       (economy-refractory-limiter.js)
 *   - prediction-error threshold       (economy-prediction-error-compressor.js)
 * turning a set of static mechanisms into a closed self-regulating loop.
 *
 * CONTRACT: pure. Returns ADAPTED PARAMETERS; applies nothing; writes nothing. Default gain 0 =>
 * no adaptation (returns inputs unchanged). Volatility is caller-supplied (Economy has no time
 * series); the numeric gain is operator-set (not in the document).
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    gain: 0,          // how strongly volatility shifts the knobs; 0 => no-op. operator-set (NOT in document).
    volatility: 0     // caller-supplied system-state signal in [0,1] (e.g., normalized recent fire rate / mean prediction error). 0 => calm.
  };

  /* current: the mechanisms' current knobs. Returns adapted knobs + rationale.
   * Direction (grounded, XIII.6 homeostatic): higher volatility -> raise change-thresholds
   * (more down-scaling, longer refractory, higher PE threshold) to damp churn; lower -> relax. */
  function adaptParams(current, params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var v = Math.max(0, Math.min(1, p.volatility));
    var shift = v * p.gain; // 0 when gain=0 (no-op) or v=0 (calm)
    var out = Object.assign({}, current || {});
    var changes = [];
    function bump(key, base, mult, label) {
      if (typeof base !== 'number') return;
      var nv = base * (1 + shift * mult);
      out[key] = nv;
      if (nv !== base) changes.push({ knob: key, from: base, to: nv, effect: label });
    }
    // raise thresholds/rates with volatility. Values are RELATIVE nudges of the caller's own knobs.
    // offline: volatile -> smaller factor -> MORE down-scaling (keep factor in (0,1]).
    if (current && typeof current.offlineDownscaleFactor === 'number') {
      var strongerDown = Math.max(0, Math.min(1, current.offlineDownscaleFactor * (1 - shift)));
      out.offlineDownscaleFactor = strongerDown;
      if (strongerDown !== current.offlineDownscaleFactor) changes.push({ knob: 'offlineDownscaleFactor', from: current.offlineDownscaleFactor, to: strongerDown, effect: 'more down-scaling when volatile' });
    }
    bump('refractoryAbsoluteWindow', current && current.refractoryAbsoluteWindow, 1, 'longer dead-time when volatile (less thrash)');
    bump('predictionErrorThreshold', current && current.predictionErrorThreshold, 1, 'higher exception bar when volatile (less overload)');

    return {
      adapted: out, changes: changes, volatility: v, shift: shift,
      noop: (p.gain === 0 || v === 0),
      rule: 'XIII.6 metaplasticity: the threshold for change adapts to prior activity (homeostatic).',
      note: 'Pure. Applies nothing. gain operator-set; volatility caller-supplied (Economy has no time series).'
    };
  }

  var API = { adaptParams: adaptParams, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.EconomyMetaplasticity) root.EconomyMetaplasticity = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
