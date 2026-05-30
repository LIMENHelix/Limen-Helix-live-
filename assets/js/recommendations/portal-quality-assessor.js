/**
 * portal-quality-assessor.js
 * LIMEN HELIX — Portal Quality & Action-Plan Reliability Engine
 *
 * Phase 2: Action-Plan Quality — ensures treatments resolve to concrete plans
 * Phase 6: Reliability Guardrails — grades portal completeness, prevents
 *          presenting generic fallbacks as reliable recommendations
 *
 * Assesses every treatment in the registry and classifies it as:
 *   - FULLY_SPECIFIED:  has concrete steps, monitoring, escalation, evidence
 *   - PARTIAL:          has title + some steps, missing evidence or monitoring
 *   - GENERIC:          placeholder label only ("support", "optimization", "monitor")
 *
 * Adjusts confidence scores and flags incomplete outputs.
 *
 * Exposes: window.LIMENPortalQualityAssessor
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // Quality tiers
  // ═══════════════════════════════════════════════════════════════

  var TIER = {
    FULLY_SPECIFIED: 'fully_specified',
    PARTIAL:         'partial',
    GENERIC:         'generic'
  };

  // Generic/vague treatment labels that should never appear as final output
  var GENERIC_LABELS = [
    'support', 'optimization', 'monitor', 'capacity building',
    'assess and respond', 'general intervention', 'no treatments',
    'awaiting issue mapping', 'placeholder', 'tbd', 'pending',
    'manage', 'observe', 'follow up', 'continue current',
    'review', 'ongoing support', 'maintenance'
  ];

  // Minimum thresholds for quality tiers
  var FULL_SPEC_MIN_STEPS = 3;
  var FULL_SPEC_REQUIRES_MONITORING = true;
  var FULL_SPEC_REQUIRES_ESCALATION = true;
  var FULL_SPEC_REQUIRES_EVIDENCE = true;
  var FULL_SPEC_MIN_STEP_LENGTH = 15;  // chars — real steps are descriptive

  // Confidence adjustments
  var CONFIDENCE_FULL = 1.0;       // no penalty
  var CONFIDENCE_PARTIAL = 0.65;   // moderate penalty
  var CONFIDENCE_GENERIC = 0.20;   // heavy penalty

  // ═══════════════════════════════════════════════════════════════
  // Treatment quality assessment
  // ═══════════════════════════════════════════════════════════════

  /**
   * Assess a single treatment's quality tier.
   * @param {object} treatment — fractal Treatment or legacy treatment
   * @returns {object} { tier, score, reasons[], adjustedConfidence }
   */
  function assessTreatment(treatment) {
    if (!treatment) return { tier: TIER.GENERIC, score: 0, reasons: ['null treatment'], adjustedConfidence: 0 };

    var reasons = [];
    var score = 0;

    // Check if title is generic
    var title = (treatment.title || treatment.label || '').toLowerCase().trim();
    for (var gi = 0; gi < GENERIC_LABELS.length; gi++) {
      if (title === GENERIC_LABELS[gi] || title.indexOf(GENERIC_LABELS[gi]) === 0) {
        reasons.push('generic_title: "' + title + '"');
        return {
          tier: TIER.GENERIC,
          score: 0.1,
          reasons: reasons,
          adjustedConfidence: Math.min(treatment.confidence || 0.25, CONFIDENCE_GENERIC)
        };
      }
    }
    score += 0.15; // non-generic title

    // Check steps
    var steps = treatment.steps || [];
    if (typeof steps[0] === 'string') {
      // Legacy format (string array)
      var concreteSteps = 0;
      for (var si = 0; si < steps.length; si++) {
        if (steps[si].length >= FULL_SPEC_MIN_STEP_LENGTH) concreteSteps++;
      }
      if (concreteSteps >= FULL_SPEC_MIN_STEPS) {
        score += 0.25;
      } else if (concreteSteps > 0) {
        score += 0.10;
        reasons.push('insufficient_steps: ' + concreteSteps + '/' + FULL_SPEC_MIN_STEPS);
      } else {
        reasons.push('no_concrete_steps');
      }
    } else {
      // Fractal format (Step objects)
      var concreteSteps2 = 0;
      for (var si2 = 0; si2 < steps.length; si2++) {
        var action = steps[si2].action || '';
        if (action.length >= FULL_SPEC_MIN_STEP_LENGTH) concreteSteps2++;
      }
      if (concreteSteps2 >= FULL_SPEC_MIN_STEPS) {
        score += 0.25;
      } else if (concreteSteps2 > 0) {
        score += 0.10;
        reasons.push('insufficient_steps: ' + concreteSteps2 + '/' + FULL_SPEC_MIN_STEPS);
      } else {
        reasons.push('no_concrete_steps');
      }
    }

    // Check monitoring
    var hasMonitoring = !!(treatment.monitoring && treatment.monitoring.length > 20);
    if (hasMonitoring) {
      score += 0.20;
    } else {
      reasons.push('no_monitoring');
    }

    // Check escalation
    var hasEscalation = !!(treatment.escalation && treatment.escalation.length > 20);
    if (hasEscalation) {
      score += 0.15;
    } else {
      reasons.push('no_escalation');
    }

    // Check evidence
    var hasEvidence = false;
    if (treatment.evidence) {
      if (treatment.evidence.grade && treatment.evidence.grade !== 'None' && treatment.evidence.grade !== 'Limited') {
        hasEvidence = true;
      }
      if (treatment.evidence.sources && treatment.evidence.sources.length > 0) {
        hasEvidence = true;
      }
    }
    // Legacy: check cite field
    if (treatment.cite && treatment.cite.length > 10) hasEvidence = true;
    if (treatment.citation && treatment.citation.length > 0) hasEvidence = true;

    if (hasEvidence) {
      score += 0.15;
    } else {
      reasons.push('no_evidence');
    }

    // Check rationale/description
    var hasRationale = !!(treatment.rationale || treatment.description);
    if (hasRationale && (treatment.rationale || treatment.description || '').length > 30) {
      score += 0.10;
    } else {
      reasons.push('weak_rationale');
    }

    // Determine tier
    var tier;
    if (score >= 0.75 && reasons.length <= 1) {
      tier = TIER.FULLY_SPECIFIED;
    } else if (score >= 0.35) {
      tier = TIER.PARTIAL;
    } else {
      tier = TIER.GENERIC;
    }

    // Compute adjusted confidence
    var baseCon = treatment.confidence || 0.5;
    var multiplier = tier === TIER.FULLY_SPECIFIED ? CONFIDENCE_FULL :
                     tier === TIER.PARTIAL ? CONFIDENCE_PARTIAL : CONFIDENCE_GENERIC;
    var adjustedConfidence = baseCon * multiplier;

    return {
      tier: tier,
      score: score,
      reasons: reasons,
      adjustedConfidence: adjustedConfidence
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Portal-level quality assessment
  // ═══════════════════════════════════════════════════════════════

  /**
   * Assess a portal's overall completeness.
   * @param {string} portalId
   * @returns {object} { portalId, completeness, treatmentCount, tiers{}, avgScore, issues[] }
   */
  function assessPortal(portalId) {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return _emptyAssessment(portalId);

    var treatments = mgr.getTreatmentsForPortal(portalId);
    var diagnoses = mgr.getDiagnosesForDomain(portalId);

    if (treatments.length === 0 && diagnoses.length === 0) {
      return _emptyAssessment(portalId);
    }

    var tiers = { fully_specified: 0, partial: 0, generic: 0 };
    var totalScore = 0;
    var issues = [];

    for (var i = 0; i < treatments.length; i++) {
      var result = assessTreatment(treatments[i]);
      tiers[result.tier]++;
      totalScore += result.score;

      if (result.tier === TIER.GENERIC) {
        issues.push('generic treatment: ' + (treatments[i].title || treatments[i].id));
      }
    }

    // Compute completeness (0-1)
    var completeness = 0;
    if (treatments.length > 0) {
      completeness = totalScore / treatments.length;
    }

    // Check diagnosis quality
    for (var di = 0; di < diagnoses.length; di++) {
      var dx = diagnoses[di];
      if (!dx.title || dx.title === 'No issues mapped') {
        issues.push('placeholder diagnosis: ' + (dx.id || 'unknown'));
      }
      var dxTx = dx.treatments || [];
      if (dxTx.length === 0) {
        issues.push('diagnosis without treatments: ' + (dx.title || dx.id));
      }
    }

    return {
      portalId: portalId,
      completeness: completeness,
      treatmentCount: treatments.length,
      diagnosisCount: diagnoses.length,
      tiers: tiers,
      avgScore: treatments.length > 0 ? totalScore / treatments.length : 0,
      issues: issues,
      isReliable: tiers.fully_specified > 0 && tiers.generic === 0
    };
  }

  function _emptyAssessment(portalId) {
    return {
      portalId: portalId,
      completeness: 0,
      treatmentCount: 0,
      diagnosisCount: 0,
      tiers: { fully_specified: 0, partial: 0, generic: 0 },
      avgScore: 0,
      issues: ['empty portal — no treatments or diagnoses registered'],
      isReliable: false
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Domain-level quality assessment
  // ═══════════════════════════════════════════════════════════════

  /**
   * Assess all portals under a domain.
   * @param {string} domainId
   * @returns {object} { domainId, portals[], overallCompleteness, reliableCount, totalCount }
   */
  function assessDomain(domainId) {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return { domainId: domainId, portals: [], overallCompleteness: 0, reliableCount: 0, totalCount: 0 };

    // Get all treatments for this domain
    var treatments = mgr.getTreatmentsForDomain(domainId);
    var diagnoses = mgr.getDiagnosesForDomain(domainId);

    // Assess at domain level (treating it as a single portal)
    var portalResult = assessPortal(domainId);

    return {
      domainId: domainId,
      portals: [portalResult],
      overallCompleteness: portalResult.completeness,
      reliableCount: portalResult.isReliable ? 1 : 0,
      totalCount: 1,
      treatmentCount: treatments.length,
      diagnosisCount: diagnoses.length
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Action-plan resolver (Phase 2)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Resolve a treatment into a complete action-plan object.
   * Enriches sparse treatments with structure, flags missing fields.
   *
   * @param {object} treatment
   * @param {object} context — { domainId, diagnosisId, portalId }
   * @returns {object} ActionPlan
   */
  function resolveActionPlan(treatment, context) {
    if (!treatment) return null;
    context = context || {};

    var quality = assessTreatment(treatment);

    // Build structured action plan
    var steps = treatment.steps || [];
    var implementationSteps = [];
    for (var i = 0; i < steps.length; i++) {
      if (typeof steps[i] === 'string') {
        implementationSteps.push({
          sequence: i + 1,
          action: steps[i],
          type: 'implementation'
        });
      } else {
        implementationSteps.push({
          sequence: steps[i].sequence || (i + 1),
          action: steps[i].action || '',
          type: steps[i].type || 'implementation',
          expectedEffect: steps[i].expectedEffect || '',
          dependencies: steps[i].dependencies || []
        });
      }
    }

    return {
      id: treatment.id || null,
      title: treatment.title || treatment.label || 'Unnamed treatment',
      type: (treatment.type || 'strategy').toLowerCase(),
      objective: treatment.rationale || treatment.description || treatment.target || '',
      triggerConditions: _extractTriggerConditions(treatment, context),
      implementationSteps: implementationSteps,
      requiredInputs: _extractRequiredInputs(treatment),
      expectedEffect: treatment.monitoring ? _extractExpectedEffect(treatment) : 'Effect assessment pending',
      timeline: _extractTimeline(treatment),
      riskTradeoffNotes: treatment.escalation || '',
      confidence: quality.adjustedConfidence,
      qualityTier: quality.tier,
      qualityScore: quality.score,
      qualityIssues: quality.reasons,
      evidenceSource: _extractEvidenceSource(treatment),
      linkedPortal: context.portalId || treatment._portalId || null,
      linkedDiagnosis: context.diagnosisId || treatment._diagnosisId || null,
      linkedDomain: context.domainId || treatment._domainId || null,
      isReliable: quality.tier === TIER.FULLY_SPECIFIED,
      isPartial: quality.tier === TIER.PARTIAL,
      isGeneric: quality.tier === TIER.GENERIC
    };
  }

  function _extractTriggerConditions(treatment, context) {
    var conditions = [];
    if (treatment.target) {
      var parts = treatment.target.split('->');
      if (parts.length > 0) {
        conditions.push(parts[0].trim().replace(/_/g, ' ').toLowerCase());
      }
    }
    if (context.domainId) {
      conditions.push('domain ' + context.domainId + ' stress elevated');
    }
    return conditions;
  }

  function _extractRequiredInputs(treatment) {
    var inputs = [];
    if (treatment.evidence && treatment.evidence.sources) {
      inputs.push('evidence base: ' + treatment.evidence.sources.length + ' sources');
    }
    if (treatment.prerequisites && treatment.prerequisites.length > 0) {
      inputs.push('prerequisites: ' + treatment.prerequisites.join(', '));
    }
    return inputs;
  }

  function _extractExpectedEffect(treatment) {
    var monitoring = treatment.monitoring || '';
    // Extract the first phase target
    var match = monitoring.match(/Target:\s*([^.]+)/);
    if (match) return match[1].trim();
    // Extract from target field
    if (treatment.target) {
      var parts = treatment.target.split('->');
      if (parts.length > 1) return parts[parts.length - 1].trim().replace(/_/g, ' ').toLowerCase();
    }
    return 'Improvement in target domain';
  }

  function _extractTimeline(treatment) {
    var monitoring = treatment.monitoring || '';
    if (monitoring.indexOf('ANNUAL') !== -1) return '12+ months';
    if (monitoring.indexOf('Months 7-12') !== -1) return '7-12 months';
    if (monitoring.indexOf('Months 4-6') !== -1) return '4-6 months';
    if (monitoring.indexOf('Months 2-3') !== -1) return '2-3 months';
    if (monitoring.indexOf('Weeks 1-4') !== -1) return '1-4 weeks';
    // From timeTags
    if (treatment.timeTags) {
      if (treatment.timeTags.indexOf('immediate') !== -1) return 'immediate';
      if (treatment.timeTags.indexOf('near-term') !== -1) return '1-3 months';
      if (treatment.timeTags.indexOf('structural') !== -1) return '6+ months';
    }
    return 'timeline unspecified';
  }

  function _extractEvidenceSource(treatment) {
    if (treatment.cite) return treatment.cite;
    if (treatment.evidence && treatment.evidence.sources && treatment.evidence.sources.length > 0) {
      return treatment.evidence.sources[0];
    }
    if (treatment.citations && treatment.citations.length > 0) {
      var c = treatment.citations[0];
      return (c.author || '') + ' (' + (c.year || '') + '). ' + (c.title || '');
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Batch assessment
  // ═══════════════════════════════════════════════════════════════

  /**
   * Assess all treatments in the registry. Stores results on window.
   */
  function assessAll() {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return;

    var stats = mgr.stats();
    console.log('[LIMEN] quality assessor: scanning ' + stats.treatments + ' treatments');

    var results = {
      timestamp: Date.now(),
      totalTreatments: stats.treatments,
      tiers: { fully_specified: 0, partial: 0, generic: 0 },
      avgScore: 0,
      genericTreatments: [],
      domainScores: {}
    };

    // We can't enumerate all treatments directly, so assess via domains
    var DOMAINS = [
      'economy', 'energy', 'environment', 'health', 'technology', 'research',
      'supplyChain', 'governance', 'infrastructure', 'agriculture',
      'industry', 'education', 'communication', 'culture',
      'defense', 'religion', 'population', 'law', 'finance', 'intelligence'
    ];

    var totalScore = 0;
    var totalCount = 0;

    for (var di = 0; di < DOMAINS.length; di++) {
      var domainResult = assessDomain(DOMAINS[di]);
      results.domainScores[DOMAINS[di]] = domainResult.overallCompleteness;

      for (var pi = 0; pi < domainResult.portals.length; pi++) {
        var p = domainResult.portals[pi];
        results.tiers.fully_specified += p.tiers.fully_specified;
        results.tiers.partial += p.tiers.partial;
        results.tiers.generic += p.tiers.generic;
        totalScore += p.avgScore * p.treatmentCount;
        totalCount += p.treatmentCount;
      }
    }

    results.avgScore = totalCount > 0 ? totalScore / totalCount : 0;
    window.LIMENQualityAssessment = results;

    console.log('[LIMEN] quality assessment complete: ' +
      results.tiers.fully_specified + ' full, ' +
      results.tiers.partial + ' partial, ' +
      results.tiers.generic + ' generic (avg score: ' +
      results.avgScore.toFixed(2) + ')');

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENPortalQualityAssessor = {
    TIER: TIER,
    assessTreatment: assessTreatment,
    assessPortal: assessPortal,
    assessDomain: assessDomain,
    assessAll: assessAll,
    resolveActionPlan: resolveActionPlan
  };

})();
