/* AUTO-GENERATED shared taxonomy engine (C6 finance pilot, gen.cjs).
 * Functions are byte-identical to the original finance-directive-ranker.js; data comes from the
 * factory __DATA param. Registers window.LIMENTaxonomy.makeDirectiveRanker. */
/**
 * finance-directive-ranker.js — Score and rank extracted directive candidates
 *
 * Depth-aware ranking that prevents shallow L0 items from dominating when
 * richer L1-L5 directives exist. Specificity and treatment richness are
 * weighted strongly enough that a deep, well-evidenced directive can outrank
 * a shallow diagnosis-circuit item.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENFinanceDirectiveRanker
 */
(function () { window.LIMENTaxonomy = window.LIMENTaxonomy || {}; window.LIMENTaxonomy.makeDirectiveRanker = function (__DATA) {
  'use strict';

var EVIDENCE_SCORE = __DATA["EVIDENCE_SCORE"];

var TYPE_ACTION_MAP = __DATA["TYPE_ACTION_MAP"];

var ROLE_WEIGHT = __DATA["ROLE_WEIGHT"];

  // Softer depth penalty — don't crush L2-L4 items
var DEPTH_FACTOR = __DATA["DEPTH_FACTOR"];

  // ══════════════════════════════════════════════════════════════════════
  // MECHANISM CLASSIFICATION ENGINE
  //
  // Each diagnosis defines structural financial mechanisms.
  // Directives are classified by mechanism, not just keywords.
  // No mechanism match → severe penalty / anchor ineligible.
  // ══════════════════════════════════════════════════════════════════════

  // Mechanism definitions: each has a label, description, and signal patterns
  // Patterns are tested against concatenated directive text (label + description + node + target + steps)
var MECHANISMS = __DATA["MECHANISMS"];

  // Which mechanisms are VALID for each diagnosis
var DX_VALID_MECHANISMS = __DATA["DX_VALID_MECHANISMS"];

  // Patterns that indicate NO valid mechanism (social/policy drift)
var DRIFT_SIGNALS = __DATA["DRIFT_SIGNALS"];

  /**
   * Classify a directive's primary and secondary financial mechanism.
   * Returns { primary: string|null, secondary: string|null, score: 0-1, label: string, isDrift: boolean }
   */
  function classifyMechanism(d) {
    var text = ((d.treatmentLabel || '') + ' ' + (d.treatmentDescription || '') + ' '
      + (d.nodeLabel || '') + ' ' + (d.treatmentTarget || '') + ' '
      + ((d.treatmentSteps || []).join ? (d.treatmentSteps || []).join(' ') : '')).toLowerCase();

    // Check for drift
    var driftHits = 0;
    for (var di = 0; di < DRIFT_SIGNALS.length; di++) {
      if (text.indexOf(DRIFT_SIGNALS[di]) !== -1) driftHits++;
    }
    if (driftHits >= 2) {
      return { primary: null, secondary: null, score: 0, label: 'DRIFT', isDrift: true };
    }

    // Score each mechanism by signal hits
    var scored = [];
    var mechKeys = Object.keys(MECHANISMS);
    for (var mi = 0; mi < mechKeys.length; mi++) {
      var mkey = mechKeys[mi];
      var mech = MECHANISMS[mkey];
      var hits = 0;
      for (var si = 0; si < mech.signals.length; si++) {
        if (text.indexOf(mech.signals[si]) !== -1) hits++;
      }
      if (hits > 0) scored.push({ key: mkey, label: mech.label, hits: hits });
    }

    scored.sort(function (a, b) { return b.hits - a.hits; });

    var primary = scored.length > 0 ? scored[0] : null;
    var secondary = scored.length > 1 ? scored[1] : null;

    // Check if primary mechanism is valid for this diagnosis
    var dxId = (d.diagnosisId || '').toUpperCase();
    var validMechs = DX_VALID_MECHANISMS[dxId] || [];
    var primaryValid = primary && validMechs.indexOf(primary.key) !== -1;
    var secondaryValid = secondary && validMechs.indexOf(secondary.key) !== -1;

    // If primary is invalid but secondary is valid, swap
    if (!primaryValid && secondaryValid) {
      var tmp = primary; primary = secondary; secondary = tmp;
      primaryValid = true;
    }

    // Score: valid primary = high, invalid = low
    var score = 0;
    if (primaryValid) score = 0.5 + Math.min(0.4, primary.hits * 0.08);
    else if (primary) score = 0.2 + Math.min(0.15, primary.hits * 0.03); // mechanism found but not valid for this dx
    // Drift penalty
    if (driftHits > 0) score = Math.max(0, score - driftHits * 0.1);

    return {
      primary: primary ? primary.key : null,
      primaryLabel: primary ? primary.label : null,
      secondary: secondary ? secondary.key : null,
      secondaryLabel: secondary ? secondary.label : null,
      score: Math.max(0, Math.min(1, score)),
      label: primary ? primary.label : (driftHits > 0 ? 'DRIFT' : 'UNCLASSIFIED'),
      isDrift: driftHits >= 2,
      isValid: primaryValid
    };
  }

  /**
   * Score economic relevance using mechanism classification.
   * Replaces pure keyword matching with structural classification.
   */
  function _scoreEconomicRelevance(d) {
    var mech = classifyMechanism(d);
    // Attach classification to directive for downstream use
    d._mechanism = mech;
    return mech.score;
  }

  /**
   * Score and rank an array of extracted directives.
   */
  function rank(directives) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return [];
    if (!directives || directives.length === 0) return [];

    for (var i = 0; i < directives.length; i++) {
      var d = directives[i];

      // 0. Economic relevance — diagnosis-specific alignment
      var econRelevance = _scoreEconomicRelevance(d);

      // 1. Diagnosis proximity — still valuable but reduced for shallow items
      var dxProximity = d.diagnosisId ? 1.0 : 0.3;

      // 2. Evidence strength
      var circuitEvidence = EVIDENCE_SCORE[d.circuitEvidence] || 0.3;
      var treatEvidence = EVIDENCE_SCORE[d.treatmentEvidence] || 0.3;

      // 3. Execution readiness
      var typeInfo = TYPE_ACTION_MAP[d.treatmentType] || TYPE_ACTION_MAP['STRUCTURAL'];
      var executionScore = typeInfo.weight;

      // 4. Node role
      var roleScore = ROLE_WEIGHT[d.functionalRole] || 0.5;

      // 5. Urgency
      var urgencyScore = Math.min(1, (d.stress || 0) * 1.2);

      // 6. Monetization potential
      var monetizationScore = 0.2;
      if (d.companies && d.companies.length > 0) {
        var avgBinding = 0;
        for (var ci = 0; ci < d.companies.length; ci++) avgBinding += (d.companies[ci].bindingStrength || 0);
        avgBinding = avgBinding / d.companies.length;
        monetizationScore = 0.2 + (avgBinding * 0.8);
      }

      // 7. TREATMENT RICHNESS — the key differentiator between shallow and deep
      //    This is now the strongest single factor.
      var richness = 0;
      var hasRealSteps = d.treatmentSteps && d.treatmentSteps.length > 0;
      var hasMonitoring = !!d.treatmentMonitoring;
      var hasEscalation = !!d.treatmentEscalation;
      var hasCitations = !!(d.treatmentCite || (d.treatmentCitation && d.treatmentCitation.length > 0));
      var hasTarget = !!d.treatmentTarget;
      var hasDescription = d.treatmentDescription && d.treatmentDescription.length > 80;

      if (hasRealSteps) richness += 0.25;
      if (hasMonitoring) richness += 0.20;
      if (hasEscalation) richness += 0.15;
      if (hasCitations) richness += 0.20;
      if (hasTarget) richness += 0.10;
      if (hasDescription) richness += 0.10;
      // richness range: 0 (shallow L0) to 1.0 (full depth)

      // 8. Depth factor — softer penalty, compensated by richness
      var depthIdx = Math.min(d.depth || 0, DEPTH_FACTOR.length - 1);
      var depthPenalty = DEPTH_FACTOR[depthIdx];
      // Rich deep items get depth penalty relief
      if (richness >= 0.5) depthPenalty = Math.min(1, depthPenalty + 0.10);
      if (richness >= 0.8) depthPenalty = Math.min(1, depthPenalty + 0.10);

      // SHALLOW PENALTY — if on a diagnosis circuit but has zero richness,
      // reduce effective dxProximity. Being on the right node doesn't help
      // if the treatment is empty.
      var effectiveDxProx = dxProximity;
      if (dxProximity >= 0.8 && richness < 0.15) {
        effectiveDxProx = 0.5; // still relevant, but not dominant
      }

      // Composite score — richness + economic relevance are the heaviest factors
      var raw = (
        effectiveDxProx * 0.10 +
        circuitEvidence * 0.05 +
        treatEvidence * 0.06 +
        executionScore * 0.08 +
        roleScore * 0.03 +
        urgencyScore * 0.10 +
        monetizationScore * 0.08 +
        richness * 0.22 +
        econRelevance * 0.18 +
        (d.branchRelevance || 0) * 0.04 +
        Math.min(0.06, (d.depth || 0) * 0.015 * richness)
      );

      // Apply depth penalty AND economic relevance as multiplier
      // Low econ relevance (<0.3) further reduces score by 40%
      var econMultiplier = econRelevance < 0.3 ? 0.6 : econRelevance < 0.5 ? 0.85 : 1.0;
      var rankScore = raw * depthPenalty * econMultiplier;

      // ── PROOF SCORE — how convincing is this as a demonstration item ──
      var proofScore = (
        richness * 0.40 +
        (hasRealSteps ? 0.15 : 0) +
        (hasCitations ? 0.15 : 0) +
        (hasMonitoring ? 0.10 : 0) +
        (d.depth >= 1 ? 0.10 : 0) +
        (d.depth >= 2 ? 0.10 : 0)
      );

      d.scores = {
        dxProximity: effectiveDxProx,
        circuitEvidence: circuitEvidence,
        treatEvidence: treatEvidence,
        execution: executionScore,
        role: roleScore,
        urgency: urgencyScore,
        monetization: monetizationScore,
        richness: richness,
        econRelevance: econRelevance,
        depthPenalty: depthPenalty,
        econMultiplier: econMultiplier,
        proofScore: Math.round(proofScore * 1000) / 1000,
        raw: Math.round(raw * 1000) / 1000
      };
      d.rankScore = Math.round(rankScore * 1000) / 1000;
      d.proofScore = Math.round(proofScore * 1000) / 1000;
      d.suggestedPaths = typeInfo.paths;

      // Metadata flags for downstream
      d._hasRealSteps = hasRealSteps;
      d._hasMonitoring = hasMonitoring;
      d._hasEscalation = hasEscalation;
      d._hasCitations = hasCitations;
      d._richness = richness;
    }

    directives.sort(function (a, b) { return b.rankScore - a.rankScore; });

    console.log('[FinanceDirectiveRanker] Ranked ' + directives.length + '. Top: ' +
      (directives[0] ? directives[0].rankScore + ' (rich=' + directives[0]._richness + ', proof=' + directives[0].proofScore + ') ' + directives[0].treatmentLabel.substring(0, 50) : 'none'));

    return directives;
  }

  return { rank: rank };
}; })();
