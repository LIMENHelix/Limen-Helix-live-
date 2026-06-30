/**
 * portal-treatment-resolver.js
 * LIMEN HELIX — Portal Treatment Resolver
 *
 * For a given domain, queries the registry using diagnosis-based,
 * circuit-based, and indicator-based methods (not just domain-name lookups).
 * Separates portal-sourced diagnoses from synthetic _LIVE_STRESS entries.
 *
 * Exposes: window.LIMENPortalTreatmentResolver
 */
(function () {
  'use strict';

  // Scoring weights
  var W_URGENCY    = 0.25;
  var W_CONFIDENCE = 0.20;
  var W_BENEFIT    = 0.25;
  var W_CROSSDOM   = 0.15;
  var W_EVIDENCE   = 0.15;
  // Diagnosis-relevance: a treatment matched to an ACTIVE diagnosis is far more
  // relevant than one pulled from any of the domain's connectome circuits (which
  // is how, e.g., refinery/finance treatments leaked into Energy's Grid Collapse
  // card). Weighted strongly so diagnosis-matched treatments rank first; circuit
  // and domain-fallback treatments only fill in below them. Reorders the pool —
  // removes nothing.
  var W_RELEVANCE  = 0.40;
  var RELEVANCE_BY_SOURCE = { diagnosis: 1.0, circuit: 0.3, domain: 0.15 };

  var EVIDENCE_SCORES = {
    A: 1.0, Strong: 1.0,
    B: 0.7, Moderate: 0.7,
    C: 0.4, Weak: 0.4,
    Emerging: 0.2
  };

  var SEVERITY_MAP = {
    critical: 1.0, high: 0.8, severe: 0.8,
    moderate: 0.5, medium: 0.5,
    low: 0.3, mild: 0.2, monitor: 0.1
  };

  var MAX_TREATMENTS = 5;

  // ═══════════════════════════════════════════════════════════════
  // Main resolve function
  // ═══════════════════════════════════════════════════════════════

  /**
   * @param {string} domainId
   * @param {object} opts - { stress, trend, confidence, nodes, domains }
   * @returns {object} { diagnoses[], treatments[], evidenceChains[], isPortalSourced }
   */
  function resolve(domainId, opts) {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return _empty(domainId);

    opts = opts || {};
    var stress = opts.stress || 0;
    var allDomains = opts.domains || {};

    // Step 1: Get diagnoses, partition into portal-sourced vs synthetic
    var rawDx = mgr.getDiagnosesForDomain(domainId);
    var portalDx = [];
    var syntheticDx = [];

    for (var i = 0; i < rawDx.length; i++) {
      var dx = rawDx[i];
      if (dx.id && dx.id.indexOf('_LIVE_STRESS') !== -1) {
        syntheticDx.push(dx);
      } else {
        portalDx.push(dx);
      }
    }

    var isPortalSourced = portalDx.length > 0;
    var activeDx = isPortalSourced ? portalDx : rawDx;

    // Step 2: Collect treatments from multiple query paths
    var allTreatments = [];
    var seen = {};

    // 2a: Diagnosis-based treatments
    for (var di = 0; di < activeDx.length; di++) {
      var dxTreatments = mgr.getTreatmentsForDiagnosis(activeDx[di].id);
      for (var t = 0; t < dxTreatments.length; t++) {
        if (!seen[dxTreatments[t].id]) {
          dxTreatments[t]._sourceMethod = 'diagnosis';
          dxTreatments[t]._sourceDiagnosis = activeDx[di];
          allTreatments.push(dxTreatments[t]);
          seen[dxTreatments[t].id] = true;
        }
      }
    }

    // NOTE: two attempts at a tighter diagnosis→treatment link were reverted:
    //   (1) diagnosis circuit nodeIds (THAL/dlPFC/…) — SHARED neural nodes, the
    //       circuit index returned cross-domain MEDICAL treatments.
    //   (2) diagnosis _portalId via getTreatmentsForPortal — the portalId is
    //       broad/shared enough to pull cross-domain (intel treatments into
    //       Technology/Defense) without helping the target case (Energy).
    // The clean, verified state = domain-scoped circuit lookup (2b below) +
    // diagnosis-relevance weight. Sub-domain specificity (Energy grid vs oil/gas)
    // needs a genuine per-diagnosis treatment link in the registry harvest, not a
    // shared-index lookup — a separate, careful piece of work.

    // 2b: Circuit-based treatments (from domain's connectome nodes), scoped to
    // this domain so shared neural nodes can't pull in other domains' treatments.
    var nodes = opts.nodes || [];
    for (var ni = 0; ni < nodes.length; ni++) {
      var circuitTx = mgr.getTreatmentsOnCircuitActivation(nodes[ni], domainId);
      for (var ct = 0; ct < circuitTx.length; ct++) {
        if (!seen[circuitTx[ct].id]) {
          circuitTx[ct]._sourceMethod = 'circuit';
          allTreatments.push(circuitTx[ct]);
          seen[circuitTx[ct].id] = true;
        }
      }
    }

    // 2c: Domain-level fallback (if no treatments from above)
    if (allTreatments.length === 0) {
      var domainTx = mgr.getTreatmentsOnDomainStress(domainId, stress);
      for (var dt = 0; dt < domainTx.length; dt++) {
        if (!seen[domainTx[dt].id]) {
          domainTx[dt]._sourceMethod = 'domain';
          allTreatments.push(domainTx[dt]);
          seen[domainTx[dt].id] = true;
        }
      }
    }

    // Step 3: Score each treatment
    var scored = [];
    for (var si = 0; si < allTreatments.length; si++) {
      var tx = allTreatments[si];
      scored.push({
        treatment: tx,
        score: _scoreTreatment(tx, stress, allDomains, domainId)
      });
    }

    // Step 4: Filter out "monitor only" if concrete treatments exist
    var concrete = scored.filter(function (s) {
      return s.treatment.type !== 'monitoring' && s.treatment.type !== 'monitor';
    });
    if (concrete.length > 0) scored = concrete;

    // Step 5: Sort by score descending, take top N
    scored.sort(function (a, b) { return b.score - a.score; });
    var top = scored.slice(0, MAX_TREATMENTS);

    // Step 6: Build evidence chains for top treatments
    var treatments = [];
    var evidenceChains = [];
    for (var ei = 0; ei < top.length; ei++) {
      treatments.push(top[ei].treatment);
      var prov = mgr.getProvenance(top[ei].treatment.id);
      if (prov) {
        evidenceChains.push(prov);
      }
    }

    return {
      domainId: domainId,
      diagnoses: activeDx,
      portalDiagnoses: portalDx,
      syntheticDiagnoses: syntheticDx,
      treatments: treatments,
      evidenceChains: evidenceChains,
      isPortalSourced: isPortalSourced,
      treatmentCount: allTreatments.length,
      topScore: top.length > 0 ? top[0].score : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Scoring
  // ═══════════════════════════════════════════════════════════════

  function _scoreTreatment(tx, stress, allDomains, domainId) {
    // Urgency: higher stress → more urgent treatments score higher
    var urgency = stress;
    if (tx._sourceDiagnosis) {
      var sev = SEVERITY_MAP[tx._sourceDiagnosis.severity] || 0.5;
      urgency = Math.max(urgency, sev);
    }

    // Confidence: treatment's own confidence or evidence grade
    var confidence = tx.confidence || 0.5;

    // Regulatory benefit: does it have concrete steps?
    var steps = tx.steps || [];
    var benefit = steps.length > 0 ? Math.min(steps.length * 0.2, 1.0) : 0.3;
    if (tx.type === 'corrective' || tx.type === 'intervention') benefit += 0.2;
    benefit = Math.min(benefit, 1.0);

    // Cross-domain stabilization: how many other domains benefit?
    var crossDom = 0;
    if (tx._circuits && tx._circuits.length > 0) {
      crossDom = Math.min(tx._circuits.length * 0.15, 1.0);
    }
    if (tx.domains && tx.domains.length > 1) {
      crossDom = Math.max(crossDom, Math.min((tx.domains.length - 1) * 0.2, 1.0));
    }

    // Evidence
    var evGrade = tx.evidenceGrade || tx.evidence || 'Emerging';
    var evidence = EVIDENCE_SCORES[evGrade] || 0.2;

    // Diagnosis-relevance by collection path (set on tx in resolve()).
    var relevance = RELEVANCE_BY_SOURCE[tx._sourceMethod] || RELEVANCE_BY_SOURCE.domain;

    return (urgency * W_URGENCY) +
           (confidence * W_CONFIDENCE) +
           (benefit * W_BENEFIT) +
           (crossDom * W_CROSSDOM) +
           (evidence * W_EVIDENCE) +
           (relevance * W_RELEVANCE);
  }

  function _empty(domainId) {
    return {
      domainId: domainId,
      diagnoses: [],
      portalDiagnoses: [],
      syntheticDiagnoses: [],
      treatments: [],
      evidenceChains: [],
      isPortalSourced: false,
      treatmentCount: 0,
      topScore: 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENPortalTreatmentResolver = {
    resolve: resolve
  };

})();
