/**
 * culture-cortex-retrieval.js — PHASE K4 safe retrieval layer (read-only, inert library).
 * Cultural mirror of energy-cortex-retrieval.js / infrastructure-cortex-retrieval.js.
 *
 * Retrieves deep-portal CONTEXT safely, gated by the K3 certified cortex index. NEVER returns
 * synthetic/dangerous portal content as evidence: evidenceEligible (curated bundles only),
 * contextOnly (entity-bearing portals, relevance-unverified warning), blocked (L2-L6 status only),
 * authoringNeeded (rehydration queue). NOT wired into the brain cycle — an available library.
 *
 * Node + browser: window.LIMENCultureCortexRetrieval and module.exports both expose { retrieve, classifyQuery }.
 */
(function () {
  'use strict';

  var DX_KEYWORDS = {
    SCENE_SATURATION: ['scene', 'saturat', 'crowded', 'oversaturat', 'glut', 'fatigue'],
    VIRALITY_SPIKE: ['viral', 'trend', 'tiktok', 'breakout', 'momentum', 'blow up', 'meme'],
    BACKLASH_CASCADE: ['backlash', 'cancel', 'controvers', 'boycott', 'outrage', 'discourse'],
    FANBASE_EROSION: ['churn', 'fade', 'declin', 'fanbase', 'disengag', 'irrelevan'],
    BREAKOUT_EMERGENCE: ['emerging', 'rising', 'breakthrough', 'debut', 'undiscovered', 'next'],
    CANON_SHIFT: ['canon', 'revival', 'nostalgia', 'era', 'comeback', 'reissue', 'legacy'],
    ATTENTION_COLLAPSE: ['attention', 'fragment', 'discovery', 'algorithm', 'feed', 'reach']
  };

  function classifyQuery(q) {
    q = String(q || '').toLowerCase();
    for (var dx in DX_KEYWORDS) {
      if (Object.prototype.hasOwnProperty.call(DX_KEYWORDS, dx) && DX_KEYWORDS[dx].some(function (k) { return q.indexOf(k) >= 0; })) return dx;
    }
    return null;
  }

  function retrieve(query, options, index) {
    options = options || {};
    var dx = options.diagnosisId || classifyQuery(query);
    var idx = index || (typeof window !== 'undefined' && window.LIMENCultureCertifiedCortex) || null;
    var warnings = [];

    if (!idx || !idx.evidenceEligible) {
      return { query: query, diagnosisId: dx, retrieved: false, evidenceEligible: [], contextOnly: [], blocked: null, authoringNeeded: [], warnings: ['certified-cortex-index not loaded — nothing retrieved'] };
    }

    if (!dx) warnings.push('no diagnosis matched the query — narrow it (scene / viral / backlash / fanbase / breakout / canon / attention)');

    var ev = (idx.evidenceEligible.externalBundles || [])
      .filter(function (b) { return dx && b.diagnosis === dx; })
      .map(function (b) {
        if (b.humanVerification === 'required') warnings.push('evidence ' + b.canonicalId + ': external-source-authored — human-verification-required');
        return { canonicalId: b.canonicalId, ref: b.ref, evidenceAnchors: b.evidenceAnchors, buildMethod: b.buildMethod, humanVerification: b.humanVerification, classification: 'EXTERNAL_BUNDLE', admissibleAsEvidence: true, admissibleAsContext: true };
      });

    var ctx = [];
    if (options.includeContext !== false) {
      ctx = (idx.contextOnly || []).map(function (c) {
        return { portalId: c.portalId, classification: c.classification, admissibleAsEvidence: false, admissibleAsContext: true, note: c.note || 'context only' };
      });
      if (ctx.length) warnings.push('context: entities relevance-unverified; treatments templated — context only, NOT evidence');
    }

    var bd = idx.blockedDangerous || {};
    var blocked = { policy: bd.policy || 'L2-L6 blocked', deepTreeTotal: bd.deepTreeTotal_L3toL6 || 0, sampledDangerous: (bd.sampled && bd.sampled.DANGEROUS) || 0, note: 'blocked from evidence / promptView / traversal — no content returned' };

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
  if (typeof window !== 'undefined') window.LIMENCultureCortexRetrieval = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
