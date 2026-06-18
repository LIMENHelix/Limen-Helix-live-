/**
 * energy-cortex-retrieval.js — PHASE K4 safe retrieval layer (read-only, inert library).
 *
 * Lets Energy retrieve deep-portal CONTEXT safely, gated entirely by the K3 certified cortex index.
 * It NEVER returns synthetic/dangerous portal content as evidence or into a prompt:
 *   - evidenceEligible  -> curated external-source bundles ONLY (the sole evidence layer)
 *   - contextOnly       -> L0/L1 company-bearing portals, returned WITH a relevance-unverified warning
 *   - blocked           -> L2-L6 DANGEROUS/synthetic: returns STATUS only, never content
 *   - authoringNeeded   -> the rehydration/authoring queue for the diagnosis
 * Every returned item carries its classification + admissibility. This module is NOT wired into the
 * brain cycle or the finalizer — it is an available library, so it changes no runtime behavior.
 *
 * Node + browser: window.LIMENEnergyCortexRetrieval and module.exports both expose { retrieve, classifyQuery }.
 */
(function () {
  'use strict';

  var DX_KEYWORDS = {
    NUCLEAR_INCIDENT: ['nuclear', 'reactor', 'radiolog', 'fission', 'iaea', 'nrc'],
    OIL_SHOCK: ['oil', 'crude', 'fossil', 'refinery', 'opec', 'petroleum', 'gasoline'],
    PIPELINE_DISRUPTION: ['pipeline', 'rupture', 'gas line', 'phmsa'],
    GRID_COLLAPSE: ['grid', 'transmission', 'blackout', 'frequency', 'substation'],
    RENEWABLE_INTERMITTENCY: ['solar', 'wind', 'renewable', 'intermitten', 'storage', 'pv', 'hydro'],
    SYSTEMIC_ENERGY_STRESS: ['systemic', 'reserve margin', 'reliability', 'nerc', 'ferc']
  };

  function classifyQuery(q) {
    q = String(q || '').toLowerCase();
    for (var dx in DX_KEYWORDS) {
      if (Object.prototype.hasOwnProperty.call(DX_KEYWORDS, dx) && DX_KEYWORDS[dx].some(function (k) { return q.indexOf(k) >= 0; })) return dx;
    }
    return null;
  }

  /**
   * retrieve(query, options, index)
   *  options.diagnosisId  — skip query classification and target a diagnosis directly
   *  options.includeContext (default true) — include contextOnly portals (always with warning)
   *  index — the parsed certified-cortex index; falls back to window.LIMENEnergyCertifiedCortex
   */
  function retrieve(query, options, index) {
    options = options || {};
    var dx = options.diagnosisId || classifyQuery(query);
    var idx = index || (typeof window !== 'undefined' && window.LIMENEnergyCertifiedCortex) || null;
    var warnings = [];

    if (!idx || !idx.evidenceEligible) {
      return { query: query, diagnosisId: dx, retrieved: false, evidenceEligible: [], contextOnly: [], blocked: null, authoringNeeded: [], warnings: ['certified-cortex-index not loaded — nothing retrieved'] };
    }

    if (!dx) warnings.push('no diagnosis matched the query — narrow it (nuclear / oil / grid / pipeline / renewable / systemic)');

    // evidenceEligible: curated external bundles ONLY. Portals are NEVER evidence. Require a matched
    // diagnosis — an unclassifiable query returns NOTHING rather than dumping all evidence.
    var ev = (idx.evidenceEligible.externalBundles || [])
      .filter(function (b) { return dx && b.diagnosis === dx; })
      .map(function (b) {
        if (b.humanVerification === 'required') warnings.push('evidence ' + b.canonicalId + ': external-source-authored — human-verification-required');
        return { canonicalId: b.canonicalId, ref: b.ref, evidenceAnchors: b.evidenceAnchors, buildMethod: b.buildMethod, humanVerification: b.humanVerification, classification: 'EXTERNAL_BUNDLE', admissibleAsEvidence: true, admissibleAsContext: true };
      });

    // contextOnly: company-bearing L0/L1 portals — always WITH a relevance-unverified warning, never evidence.
    var ctx = [];
    if (options.includeContext !== false) {
      ctx = (idx.contextOnly || []).map(function (c) {
        return { portalId: c.portalId, classification: c.classification, admissibleAsEvidence: false, admissibleAsContext: true, note: c.note || 'context only' };
      });
      if (ctx.length) warnings.push('context: company tickers relevance-unverified; treatments templated — context only, NOT evidence');
    }

    // blocked: DANGEROUS/synthetic deep portals — STATUS only, no content ever returned.
    var bd = idx.blockedDangerous || {};
    var blocked = { policy: bd.policy || 'L2-L6 blocked', deepTreeTotal: bd.deepTreeTotal_L3toL6 || 0, sampledDangerous: (bd.sampled && bd.sampled.DANGEROUS) || 0, note: 'blocked from evidence / promptView / traversal — no content returned' };

    // authoringNeeded: rehydration/authoring queue for this diagnosis (capped — this is a query API).
    var authoringAll = (idx.needsRehydration || []).filter(function (r) { return dx && r.diagnosis === dx; });
    var cap = options.authoringLimit || 12;
    var authoring = authoringAll.slice(0, cap);

    return {
      query: query, diagnosisId: dx, retrieved: true,
      evidenceEligible: ev,
      contextOnly: ctx,
      blocked: blocked,
      authoringNeeded: authoring,
      authoringOmitted: Math.max(0, authoringAll.length - authoring.length),
      warnings: warnings
    };
  }

  var api = { retrieve: retrieve, classifyQuery: classifyQuery };
  if (typeof window !== 'undefined') window.LIMENEnergyCortexRetrieval = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
