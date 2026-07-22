/*
 * industry-neuro-substrate.js  — ADDITIVE WIRING OVERLAY
 * ----------------------------------------------------------------------------
 * Source (only): LIMEN Helix Comprehensive Neurology Reference.
 * Data:          assets/data/deep/industry-neuro-substrate.json
 * Prompts:       assets/prompts/industry-neuro-substrate-authoring.md
 *
 * CONTRACT: purely additive. This file does NOT modify assets/data/domains/industry.json
 * or any existing industry-*.js. It reads existing Industry data by value and exposes the
 * neuro-substrate layer + the document's Part XIV "incomplete-circuit" diagnostic in code.
 *
 * It changes nothing on load. To actually wire it into the running Industry brain, add the
 * ONE line marked [INTEGRATION HOOK] below to your existing loader when ready. It is left
 * un-applied here on purpose, because applying it would edit an existing Industry file.
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var SUBSTRATE_URL = '/assets/data/deep/industry-neuro-substrate.json';
  var INDUSTRY_URL = '/assets/data/domains/industry.json';

  // Regulatory / brake / feedback node set, per the source document's named partners:
  //   vmPFC = extinction (V.2), dlPFC/OFC = top-down control & valuation, STN/GP = basal-ganglia
  //   stop/inhibition, HIPP/HYPO = homeostatic negative feedback (HPA), dACC = conflict monitor,
  //   CBLM = forward-model error-correction. Used only to READ existing circuits, never to write.
  var REGULATORY_NODES = ['vmPFC', 'dlPFC', 'OFC', 'STN', 'GP', 'HIPP', 'HYPO', 'dACC', 'CBLM'];

  function loadJSON(url) {
    // Node (dev/test): read from disk. Checked first because Node 18+/24 expose a global
    // fetch that cannot resolve a browser root-relative path like '/assets/...'.
    if (typeof window === 'undefined' && typeof require === 'function') {
      try {
        var path = require('path');
        var fs = require('fs');
        var rel = url.replace(/^\//, '');
        return Promise.resolve(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')));
      } catch (e) { return Promise.reject(e); }
    }
    // Browser: fetch relative to origin.
    return fetch(url).then(function (r) { return r.json(); });
  }

  var API = {
    /* Load the additive substrate overlay. */
    getSubstrate: function () { return loadJSON(SUBSTRATE_URL); },

    /* GROUNDED lookup: the Part XIV failure-mode class for an Industry issue id. */
    failureClassForIssue: function (issueId) {
      return API.getSubstrate().then(function (s) {
        var m = s.issue_failure_class_map || {};
        return m[issueId] || null;
      });
    },

    /* The document's Part XIV incomplete-circuit diagnostic, in code.
     * Reads an Industry issue's authored circuit and reports whether a regulatory/feedback
     * partner is present. Pure read; returns a verdict object, writes nothing. */
    validateIncompleteCircuit: function (issue) {
      var authored = (issue && issue._authored) || (issue && issue.circuits) || [];
      var nodes = authored.map(function (c) { return c.nodeId; });
      var present = nodes.filter(function (n) { return REGULATORY_NODES.indexOf(n) !== -1; });
      return {
        issue: issue && issue.id,
        circuit: nodes,
        regulatoryPartnersPresent: present,
        verdict: present.length > 0 ? 'complete' : 'INCOMPLETE_CIRCUIT',
        rule: 'Part XIV: a circuit without its regulatory/inhibitory/feedback partner is intrinsically dysfunctional.'
      };
    },

    /* Run the diagnostic across every Industry issue. */
    auditAllIssues: function () {
      return loadJSON(INDUSTRY_URL).then(function (industry) {
        return (industry.issues || []).map(API.validateIncompleteCircuit);
      });
    },

    /* Convenience: the fast-action / slow-governance ratio invariant (Part XV). */
    ratioPreservationRule: function () {
      return API.getSubstrate().then(function (s) {
        return s.parameter_table && s.parameter_table.ratio_preservation_rule;
      });
    }
  };

  // Expose without disturbing anything already global.
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.IndustryNeuroSubstrate) root.IndustryNeuroSubstrate = API;

  /* -------------------------------------------------------------------------
   * [INTEGRATION HOOK]  (NOT applied — add this one line to the existing
   *  Industry brain/loader when you choose to wire the overlay in; leaving it
   *  here means no existing file is modified now):
   *
   *      import IndustryNeuroSubstrate from '/assets/js/industry-neuro-substrate.js';
   *      // then, after issues render:
   *      IndustryNeuroSubstrate.auditAllIssues().then(console.table);
   * ------------------------------------------------------------------------- */
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
