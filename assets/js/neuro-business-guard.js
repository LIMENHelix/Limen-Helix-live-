/*
 * neuro-business-guard.js  — ADDITIVE operational guard
 * ----------------------------------------------------------------------------
 * Makes the Neuro<->Business Cross-Reference enforceable, not just stored.
 * Data: assets/data/neuro-business-crossref.json
 * Source doctrine: LIMEN Helix Neuro<->Business Cross-Reference (Charts B, C, D).
 *
 * CONTRACT: additive; reads data by value; writes nothing. Returns 'unknown' rather
 * than guessing when an input is outside the documented sets.
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DATA_URL = '/assets/data/neuro-business-crossref.json';

  function loadJSON(url) {
    if (typeof window === 'undefined' && typeof require === 'function') {
      try {
        var path = require('path'), fs = require('fs');
        return Promise.resolve(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), url.replace(/^\//, '')), 'utf8')));
      } catch (e) { return Promise.reject(e); }
    }
    return fetch(url).then(function (r) { return r.json(); });
  }

  // Removal partner required for each acquisition mechanism (Chart C / D incomplete-circuit).
  var ACQUISITION_REQUIRES_REMOVAL = {
    'policy': 'retirement/extinction (retire the policy when the trigger is gone)',
    'control': 'retirement/extinction (stand down obsolete controls)',
    'rule': 'retirement/extinction',
    'headcount': 'homeostatic down-scaling (global renormalization after growth)',
    'complexity': 'homeostatic down-scaling',
    'process': 'offline clearance (retire process debt during enforced downtime)',
    'ticket': 'clearance/termination (close/retire the record)',
    'threat-response': 'extinction learning (vmPFC-mediated stand-down)'
  };

  var API = {
    getData: function () { return loadJSON(DATA_URL); },

    /* Chart B: flag a proposed neural->business mapping as COSMETIC if it matches a
     * documented fractal-breaker. Matches on simple keyword signature of the anti-patterns. */
    checkCosmetic: function (proposal) {
      var text = String(proposal || '').toLowerCase();
      return API.getData().then(function (d) {
        var hits = [];
        var sig = {
          IT_IS_NERVOUS_SYSTEM: /\bit\b.*(nervous system|brain|cognition|thinking)/,
          ORG_TREE_IS_BRAIN_HIERARCHY: /(org ?chart|hierarchy|tree).*(brain|cortex|laminar)/,
          TRANSMITTER_TO_DEPARTMENT_1TO1: /(dopamine|serotonin|acetylcholine|norepinephrine).*(=|is|as).*(sales|hr|marketing|finance|department)/,
          GROWTH_IS_HEALTH: /(fast[- ]?growth|maximal|more (firing|throughput)).*(health|healthy|vital)/,
          CEO_IS_THE_BRAIN: /ceo.*(=|is).*(brain|the mind|controller)/,
          MONEY_IS_NEURAL_SIGNAL: /money.*(=|is).*(neural signal|action potential|spike)/
        };
        var items = d.chart_B_cosmetic_guard.items;
        Object.keys(sig).forEach(function (id) {
          if (sig[id].test(text)) {
            var meta = items.filter(function (x) { return x.id === id; })[0] || {};
            hits.push({ id: id, verdict: 'COSMETIC', why: meta.why_cosmetic, correct_reading: meta.correct_reading });
          }
        });
        return hits.length ? hits : [{ verdict: 'unknown', note: 'No documented fractal-breaker matched. Not a clearance - just not one of the six known cosmetic traps.' }];
      });
    },

    /* Chart C/D: for a proposed acquisition mechanism, is its removal-half declared?
     * The brain pairs every acquisition with a removal; a business that only acquires is lesioned. */
    checkRemovalHalf: function (acquisitionKind, removalDeclared) {
      var key = String(acquisitionKind || '').toLowerCase();
      var required = ACQUISITION_REQUIRES_REMOVAL[key];
      if (!required) return Promise.resolve({ verdict: 'unknown', note: 'Acquisition kind not in the documented set; declare its removal partner explicitly.' });
      return Promise.resolve({
        acquisition: key,
        removal_required: required,
        removal_declared: !!removalDeclared,
        verdict: removalDeclared ? 'complete' : 'INCOMPLETE_CIRCUIT',
        lesion_if_absent: 'acquisition without removal = lesioned brain (over-inhibition / unbounded debt).'
      });
    },

    /* Chart C: the named lesion for a missing build-target mechanism. */
    pathologyFor: function (missingMechanismId) {
      return API.getData().then(function (d) {
        var m = (d.chart_C_build_targets.items || []).filter(function (x) { return x.id === missingMechanismId; })[0];
        return m ? { id: m.id, lesion: m.lesion_if_absent, priority: m.priority, impl_status: m.impl_status } : { verdict: 'unknown' };
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.NeuroBusinessGuard) root.NeuroBusinessGuard = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
