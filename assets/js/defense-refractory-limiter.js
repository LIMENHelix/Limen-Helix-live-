/*
 * defense-refractory-limiter.js  — ADDITIVE reference implementation
 * ----------------------------------------------------------------------------
 * Concrete form of the REFRACTORY_RATE_LIMIT build-target (docs/energy-refractory-rate-limit-proposal.md).
 * Source (only): LIMEN Helix Neurology Reference III.3 (absolute + relative refractory),
 * Part XV, and the Neuro<->Business Cross-Reference Chart C.
 *
 * CONTRACT:
 *   - Holds its OWN event log. NEVER reads or writes assets/data/domains/energy.json.
 *   - Two-phase model: absolute hard block + relative raised-threshold (a stronger-than-normal
 *     stimulus can still fire), faithful to III.3.
 *   - Defaults are a NO-OP (absoluteWindow=0 => disabled) so nothing is limited until the
 *     operator sets a window. Business-scale durations are NOT in the document; operator-set.
 *   - Units are caller-defined (same unit for `now` and the windows).
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    absoluteWindow: 0,          // hard dead-time; 0 => disabled (no-op). operator-set.
    relativeWindow: 0,          // raised-bar window (>= absoluteWindow). operator-set.
    overrideThreshold: Infinity // strength needed to fire during the relative phase. operator-set.
  };

  // Derived window spans from the two-timescale invariant (cross-ref). Returned as SPANS,
  // never auto-plugged as numbers — the operator confirms the actual value.
  var TIER_SPANS = {
    operational: { span: 'minutes - hours', basis: 'cross-ref two-timescale invariant', status: 'derived; confirm' },
    management: { span: 'days - weeks', basis: 'cross-ref two-timescale invariant', status: 'derived; confirm' },
    governance: { span: 'weeks - quarters', basis: 'cross-ref two-timescale invariant', status: 'derived; confirm' }
  };

  /* Pure evaluation: given the last fire (or null), decide if a new fire is allowed now.
   * Records nothing. */
  function evaluate(last, now, strength, params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    if (p.absoluteWindow <= 0) return { allowed: true, phase: 'disabled', reason: 'limiter not configured (no-op)' };
    if (!last) return { allowed: true, phase: 'ready', reason: 'never fired' };
    var dt = now - last.t;
    if (dt < p.absoluteWindow) {
      return { allowed: false, phase: 'absolute', reason: 'absolute refractory dead-time', retryAfter: last.t + p.absoluteWindow };
    }
    if (dt < p.relativeWindow) {
      if (typeof strength === 'number' && strength >= p.overrideThreshold) {
        return { allowed: true, phase: 'relative-override', reason: 'stronger-than-normal stimulus fired during relative refractory' };
      }
      return { allowed: false, phase: 'relative', reason: 'below elevated threshold during relative refractory', retryAfter: last.t + p.relativeWindow };
    }
    return { allowed: true, phase: 'ready', reason: 'past refractory window' };
  }

  function RefractoryLimiter(params) {
    this.params = Object.assign({}, DEFAULTS, params || {});
    this.log = Object.create(null); // { key: { t, strength } }  — the limiter's own state
  }
  /* Evaluate without recording. */
  RefractoryLimiter.prototype.check = function (key, now, strength) {
    return evaluate(this.log[key] || null, now, strength, this.params);
  };
  /* Evaluate and, if allowed, record the fire. Returns the verdict. */
  RefractoryLimiter.prototype.fire = function (key, now, strength) {
    var r = evaluate(this.log[key] || null, now, strength, this.params);
    if (r.allowed) this.log[key] = { t: now, strength: strength };
    return r;
  };
  /* Return the DERIVED window span for a tier (span, not a fabricated number). */
  RefractoryLimiter.prototype.suggestWindow = function (tier) {
    return TIER_SPANS[String(tier || '').toLowerCase()] || { span: null, status: 'unknown tier; supply operational|management|governance' };
  };

  var API = { RefractoryLimiter: RefractoryLimiter, evaluate: evaluate, DEFAULTS: DEFAULTS, TIER_SPANS: TIER_SPANS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.DefenseRefractoryLimiter) root.DefenseRefractoryLimiter = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
