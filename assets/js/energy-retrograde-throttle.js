/*
 * energy-retrograde-throttle.js  — ADDITIVE mechanism
 * ----------------------------------------------------------------------------
 * RETROGRADE_NEGATIVE_FEEDBACK build-target.
 * Source (only): neuro ref IV.5 — endocannabinoids are RETROGRADE messengers: made
 * postsynaptically, act on presynaptic CB1 to DIAL BACK input. The RECEIVER throttles the
 * SENDER. Cross-ref: business feedback is usually top-down, not receiver-controlled; absence
 * -> senders overload receivers -> flooding.
 *
 * CONTRACT: read-only / copy-only. NEVER writes energy.json. Computes, for an OVERLOADED
 * receiver, how much each incoming edge's drive should be dialed back, and returns proposed
 * throttled weights on a COPY. Default no-op (no receiver reported overloaded).
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    // Overload is caller-supplied (Energy has no runtime load field). { nodeId: loadFraction }
    // where loadFraction > 1 means over capacity. Empty => no-op.
    overload: {},
    // How hard the receiver dials back per unit of overload. operator-set; 0 => no-op.
    throttleGain: 0,
    // Floor so throttle never zeroes an edge (a receiver dials back, doesn't sever).
    minWeightFraction: 0.1
  };

  /* energy: the domain object (read only). Returns { proposedEdges, actions } on a copy. */
  function computeThrottle(energy, params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var edges = (energy.edges || []).map(function (e) { return Object.assign({}, e); }); // copy
    var actions = [];
    edges.forEach(function (e) {
      var load = p.overload[e.target];
      if (typeof load !== 'number' || load <= 1 || p.throttleGain <= 0) return; // not overloaded / disabled
      if (typeof e.weight !== 'number') return;
      var over = load - 1;                                  // how far past capacity
      var factor = Math.max(p.minWeightFraction, 1 - over * p.throttleGain); // receiver dials sender back
      var nw = e.weight * factor;
      if (nw !== e.weight) {
        actions.push({ edge: e.source + '->' + e.target, receiver: e.target, load: load, from: e.weight, to: nw, direction: 'RETROGRADE (receiver throttles sender)' });
        e.weight = nw;
      }
    });
    return {
      proposedEdges: edges,   // a COPY; caller decides whether to apply. energy.json untouched.
      actions: actions,
      noop: (p.throttleGain <= 0 || Object.keys(p.overload).length === 0),
      rule: 'IV.5 retrograde negative feedback: the receiver dials back the sender when overloaded.',
      note: 'Overload is caller-supplied (Energy has no runtime load field). throttleGain operator-set. Never writes energy.json.'
    };
  }

  var API = { computeThrottle: computeThrottle, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.EnergyRetrogradeThrottle) root.EnergyRetrogradeThrottle = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
