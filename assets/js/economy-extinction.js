/*
 * economy-extinction.js  — ADDITIVE mechanism (completes EXTINCTION_LEARNING)
 * ----------------------------------------------------------------------------
 * Source (only): neuro ref V.2 — "a COMPLETE fear circuit requires EXTINCTION (vmPFC-mediated);
 * fear acquisition without extinction is an incomplete circuit." XIV incomplete-circuit.
 * Cross-ref: business adds policies post-incident, rarely retires them -> scar-tissue rules,
 * over-inhibition. Extinction = TARGETED removal of an acquired response when its trigger is gone
 * (complements the GLOBAL down-scaling in economy-offline-maintenance.js).
 *
 * CONTRACT: read-only / copy-only. NEVER writes economy.json. Proposes which acquired responses to
 * retire; applies nothing. Default no-op (no active-trigger context supplied => nothing retired).
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /* Extinction over Economy activations: an activation whose diagnosticTriggers are ALL absent
   * from the caller-supplied activeTriggers is a candidate to retire (its trigger is gone).
   * activeTriggers: array of currently-firing trigger strings (runtime state; Economy has none baked in). */
  function proposeExtinction(economy, activeTriggers, opts) {
    var o = Object.assign({ requireNoActiveTrigger: true }, opts || {});
    var active = new Set((activeTriggers || []).map(function (t) { return String(t).toLowerCase(); }));
    // If caller supplies no active-trigger context, we cannot know what to extinguish -> no-op.
    if (!activeTriggers) {
      return { candidates: [], noop: true, reason: 'no active-trigger context supplied; cannot know which acquired responses are obsolete. Not guessing.' };
    }
    var candidates = [];
    (economy.activations || []).forEach(function (a) {
      var trigs = (a.diagnosticTriggers || []).map(function (t) { return String(t).toLowerCase(); });
      if (!trigs.length) return; // no acquired trigger to extinguish against
      var anyActive = trigs.some(function (t) { return active.has(t); });
      if (o.requireNoActiveTrigger && !anyActive) {
        candidates.push({ node: a.brainNodeId, label: a.domainLabel, triggers: a.diagnosticTriggers, action: 'RETIRE (extinguish): trigger no longer active' });
      }
    });
    return {
      candidates: candidates,
      noop: candidates.length === 0,
      rule: 'V.2 extinction: retire an acquired response when its trigger is gone (targeted removal, not global down-scaling).',
      note: 'Read-only PROPOSAL. Applies nothing; retiring a node would edit economy.json. activeTriggers is caller-supplied runtime state.'
    };
  }

  var API = { proposeExtinction: proposeExtinction };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.EconomyExtinction) root.EconomyExtinction = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
