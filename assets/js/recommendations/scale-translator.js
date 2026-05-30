/**
 * LIMEN Recommendation Runtime — Scale Translator
 *
 * Translates a detected pattern + resolved remedies into scale-appropriate
 * recommendation actions across the five fractal scales.
 *
 * Implements:
 *   docs/57 §3     — Scale-specific action vocabularies
 *   docs/59 §2     — Per-scale translator functions
 *   docs/59 §3     — Scoring functions (compositeRanking)
 *   docs/59 §4     — Cross-scale conflict detection
 *
 * Depends on:
 *   window.LIMENRemedyResolver   — resolved remedies
 *   window.LIMENDomains          — domain stress data
 *
 * Exposes:  window.LIMENScaleTranslator
 *
 * Schema contracts (locked):
 *   recommendation-schema.json   — actionMain, actionPortal, actionBusiness, actionDomain, actionCivilization, scaleApplicability
 *   translation-schema.json      — translationResult, translationConflict, selectedRemedy
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Scale applicability matrix — exact from recommendation-schema (locked)
  // ═══════════════════════════════════════════════════════════════════════════

  var SCALE_APPLICABILITY = {
    threat_cascade:          { mainUser: true,  portalUser: true,  business: true,  domain: true,  civilization: true },
    executive_overload:      { mainUser: true,  portalUser: true,  business: true,  domain: false, civilization: false },
    reward_dysregulation:    { mainUser: true,  portalUser: true,  business: true,  domain: false, civilization: false },
    memory_consolidation:    { mainUser: false, portalUser: true,  business: false, domain: true,  civilization: false },
    regulation_failure:      { mainUser: true,  portalUser: true,  business: true,  domain: true,  civilization: true },
    cross_domain_resonance:  { mainUser: false, portalUser: false, business: false, domain: true,  civilization: true },
    innovation_pressure:     { mainUser: false, portalUser: true,  business: true,  domain: true,  civilization: false },
    somatic_cascade:         { mainUser: true,  portalUser: true,  business: false, domain: false, civilization: false },
    narrative_collapse:      { mainUser: true,  portalUser: true,  business: false, domain: false, civilization: false },
    homeostatic_recovery:    { mainUser: true,  portalUser: true,  business: true,  domain: true,  civilization: true },
    plasticity_window:       { mainUser: false, portalUser: true,  business: true,  domain: false, civilization: false },
    phase_transition:        { mainUser: false, portalUser: false, business: true,  domain: true,  civilization: true },
    prediction_violation:    { mainUser: true,  portalUser: true,  business: true,  domain: true,  civilization: true },
    oscillation_instability: { mainUser: false, portalUser: true,  business: true,  domain: true,  civilization: true }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Conflict types — exact from recommendation-schema (locked)
  // ═══════════════════════════════════════════════════════════════════════════

  var CONFLICT_TYPES = ['scale_tension', 'temporal_mismatch', 'resource_competition', 'direction_conflict', 'confidence_disparity'];
  var RESOLUTION_STRATEGIES = ['confidence', 'scale_hierarchy', 'temporal', 'human_review'];

  // Scale hierarchy: higher index = broader scale = lower priority for individual conflicts
  var SCALE_HIERARCHY = { mainUser: 0, portalUser: 1, business: 2, domain: 3, civilization: 4 };

  // ═══════════════════════════════════════════════════════════════════════════
  // Per-scale action generation (docs/57 §3)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate mainUser actions from remedies.
   * Plain language, no jargon, no clinical terms exposed.
   */
  function _translateMainUser(pattern, remedies) {
    var actions = [];
    // If we have remedies with mainUser payloads, use them
    for (var i = 0; i < remedies.length; i++) {
      var r = remedies[i];
      var sp = r.scalePayload;
      if (sp && sp.userFacingText) {
        actions.push({
          type: sp.actionVerb ? _mainActionType(sp.actionVerb) : 'awareness_prompt',
          text: sp.userFacingText,
          mechanism: r.translatedText || '',
          duration: sp.maxFrequency || ''
        });
      }
    }
    // Fallback: generate from pattern
    if (actions.length === 0) {
      actions.push(_defaultMainAction(pattern));
    }
    return actions;
  }

  function _mainActionType(verb) {
    var map = {
      slow_down: 'pace_adjustment',
      breathe: 'behavior_suggestion',
      focus: 'focus_redirect',
      explore: 'behavior_suggestion',
      pause: 'pace_adjustment',
      shift: 'focus_redirect',
      engage: 'behavior_suggestion'
    };
    return map[verb] || 'awareness_prompt';
  }

  function _defaultMainAction(pattern) {
    var PATTERN_ACTIONS = {
      threat_cascade:          { type: 'pace_adjustment', text: 'Take a moment to slow down — your system is responding to heightened signals' },
      executive_overload:      { type: 'focus_redirect', text: 'Consider focusing on one thing at a time' },
      reward_dysregulation:    { type: 'awareness_prompt', text: 'Notice what is driving your current engagement' },
      regulation_failure:      { type: 'pace_adjustment', text: 'A brief pause may help your natural balance restore' },
      somatic_cascade:         { type: 'behavior_suggestion', text: 'Pay attention to physical sensations — they are informing your response' },
      narrative_collapse:      { type: 'awareness_prompt', text: 'The current picture may feel unclear — that is temporary' },
      homeostatic_recovery:    { type: 'awareness_prompt', text: 'Your system is returning to balance — maintain current approach' },
      prediction_violation:    { type: 'focus_redirect', text: 'Something unexpected has shifted — take time to reassess' }
    };
    return PATTERN_ACTIONS[pattern.patternClass] || { type: 'awareness_prompt', text: 'Observation mode active' };
  }

  /**
   * Generate portalUser actions from remedies.
   * Clinical vocabulary with evidence citations.
   */
  function _translatePortalUser(pattern, remedies) {
    var actions = [];
    for (var i = 0; i < remedies.length; i++) {
      var r = remedies[i];
      var sp = r.scalePayload;
      if (sp && sp.treatmentLabel) {
        actions.push({
          type:          sp.treatmentType === 'DIAGNOSTIC' ? 'diagnostic' : 'treatment',
          label:         sp.treatmentLabel,
          treatmentType: sp.treatmentType || 'STRATEGY',
          evidence:      r.translationConfidence ? r.translationConfidence.confidenceTier : '',
          target:        sp.target || '',
          steps:         sp.steps || [],
          monitoring:    sp.monitoring || '',
          escalation:    sp.escalation || '',
          portalId:      sp.sourcePortalId || '',
          cite:          ''
        });
      }
    }
    // Fallback: generic portal action
    if (actions.length === 0) {
      actions.push({
        type: 'monitoring',
        label: 'Monitor ' + pattern.patternClass.replace(/_/g, ' ') + ' pattern',
        treatmentType: 'DIAGNOSTIC'
      });
    }
    return actions;
  }

  /**
   * Generate business actions from remedies.
   */
  function _translateBusiness(pattern, remedies) {
    var actions = [];
    for (var i = 0; i < remedies.length; i++) {
      var r = remedies[i];
      var sp = r.scalePayload;
      if (sp && sp.businessAction) {
        actions.push({
          type:      _businessActionType(pattern),
          text:      sp.businessAction,
          metric:    sp.affectedMetric || '',
          phase:     sp.businessPhase || 1,
          timeframe: sp.timeframe || '',
          risk:      sp.riskOfInaction || '',
          kpi:       sp.kpi || ''
        });
      }
    }
    if (actions.length === 0) {
      actions.push({
        type: _businessActionType(pattern),
        text: 'Review ' + pattern.patternClass.replace(/_/g, ' ') + ' implications for business operations'
      });
    }
    return actions;
  }

  function _businessActionType(pattern) {
    var map = {
      threat_cascade: 'operational', executive_overload: 'operational',
      reward_dysregulation: 'financial', regulation_failure: 'strategic',
      innovation_pressure: 'strategic', homeostatic_recovery: 'operational',
      plasticity_window: 'strategic', phase_transition: 'structural',
      prediction_violation: 'strategic', oscillation_instability: 'operational'
    };
    return map[pattern.patternClass] || 'strategic';
  }

  /**
   * Generate domain actions from remedies.
   */
  function _translateDomain(pattern, remedies) {
    var actions = [];
    for (var i = 0; i < remedies.length; i++) {
      var r = remedies[i];
      var sp = r.scalePayload;
      if (sp && sp.policyAction) {
        actions.push({
          type:            _domainActionType(pattern),
          text:            sp.policyAction,
          domain:          sp.civilizationDomain || _inferDomain(pattern),
          feedSource:      sp.feedSource || '',
          stressLevel:     0,
          trend:           'stable',
          crossDomainDeps: sp.crossDomainDeps || []
        });
      }
    }
    if (actions.length === 0) {
      var dom = _inferDomain(pattern);
      actions.push({
        type: _domainActionType(pattern),
        text: 'Monitor ' + dom + ' sector for ' + pattern.patternClass.replace(/_/g, ' ') + ' pattern effects',
        domain: dom
      });
    }

    // Enrich with live domain data
    var domains = window.LIMENDomains || {};
    for (var a = 0; a < actions.length; a++) {
      var d = domains[actions[a].domain];
      if (d) {
        actions[a].stressLevel = d.stress || 0;
        actions[a].trend = d.trend > 0.03 ? 'rising' : (d.trend < -0.03 ? 'declining' : 'stable');
      }
    }

    return actions;
  }

  function _domainActionType(pattern) {
    var map = {
      cross_domain_resonance: 'coordination', phase_transition: 'policy',
      regulation_failure: 'monitoring', threat_cascade: 'monitoring',
      innovation_pressure: 'resource_allocation', memory_consolidation: 'infrastructure',
      homeostatic_recovery: 'monitoring', prediction_violation: 'monitoring',
      oscillation_instability: 'monitoring'
    };
    return map[pattern.patternClass] || 'monitoring';
  }

  /**
   * Generate civilization actions from remedies.
   */
  function _translateCivilization(pattern, remedies) {
    var actions = [];
    for (var i = 0; i < remedies.length; i++) {
      var r = remedies[i];
      var sp = r.scalePayload;
      if (sp && sp.systemicAction) {
        actions.push({
          type:            _civActionType(pattern),
          text:            sp.systemicAction,
          domains:         sp.affectedDomains || [],
          resonanceScore:  sp.resonanceThreshold || 0,
          phaseTransition: sp.phaseTransition || false,
          stabilityIndex:  sp.stabilityTarget || 0
        });
      }
    }
    if (actions.length === 0) {
      actions.push({
        type: _civActionType(pattern),
        text: 'Systemic ' + pattern.patternClass.replace(/_/g, ' ') + ' detected — multi-domain observation active',
        domains: _inferAffectedDomains(pattern)
      });
    }
    return actions;
  }

  function _civActionType(pattern) {
    var map = {
      threat_cascade: 'preventive', regulation_failure: 'regulatory',
      cross_domain_resonance: 'systemic', phase_transition: 'structural',
      homeostatic_recovery: 'adaptive', prediction_violation: 'adaptive',
      oscillation_instability: 'regulatory'
    };
    return map[pattern.patternClass] || 'systemic';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-scale conflict detection (docs/59 §4)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detect conflicts between recommendations at different scales.
   *
   * @param {Object[]} recommendations — array of { scale, affectedNodes, dominantDirection, confidence, remedies[] }
   * @returns {Object[]} array of conflict objects per translation-schema
   */
  function detectConflicts(recommendations) {
    var conflicts = [];
    for (var i = 0; i < recommendations.length; i++) {
      for (var j = i + 1; j < recommendations.length; j++) {
        var a = recommendations[i];
        var b = recommendations[j];
        if (a.scale === b.scale) continue;

        // Check for shared affected nodes
        var sharedNodes = _intersect(a.affectedNodes || [], b.affectedNodes || []);
        if (sharedNodes.length === 0) continue;

        // Direction conflict: same node, different desired direction
        if (a.dominantDirection && b.dominantDirection && a.dominantDirection !== b.dominantDirection) {
          var confGap = Math.abs((a.confidence || 0) - (b.confidence || 0));
          conflicts.push({
            type: 'direction_conflict',
            nodeId: sharedNodes[0],
            nodeLabel: '',
            scaleA: a.scale,
            scaleB: b.scale,
            confidenceA: a.confidence || 0,
            confidenceB: b.confidence || 0,
            confidenceGap: Math.round(confGap * 1000) / 1000,
            resolution: _resolveConflict(a, b, confGap)
          });
        }

        // Confidence disparity: same nodes but large confidence gap
        var cGap = Math.abs((a.confidence || 0) - (b.confidence || 0));
        if (cGap > 0.25 && a.dominantDirection === b.dominantDirection) {
          conflicts.push({
            type: 'confidence_disparity',
            nodeId: sharedNodes[0],
            nodeLabel: '',
            scaleA: a.scale,
            scaleB: b.scale,
            confidenceA: a.confidence || 0,
            confidenceB: b.confidence || 0,
            confidenceGap: Math.round(cGap * 1000) / 1000,
            resolution: {
              strategy: 'confidence',
              winner: (a.confidence || 0) > (b.confidence || 0) ? a.scale : b.scale,
              scope: 'shared_nodes_only'
            }
          });
        }
      }
    }
    return conflicts;
  }

  function _resolveConflict(a, b, confGap) {
    // Strategy 1: Confidence (>0.15 gap)
    if (confGap > 0.15) {
      var winner = (a.confidence || 0) > (b.confidence || 0) ? a.scale : b.scale;
      return { strategy: 'confidence', winner: winner, scope: 'shared_nodes_only' };
    }

    // Strategy 2: Scale hierarchy (individual > organizational)
    var hierA = SCALE_HIERARCHY[a.scale] || 0;
    var hierB = SCALE_HIERARCHY[b.scale] || 0;
    if (hierA !== hierB) {
      return { strategy: 'scale_hierarchy', winner: hierA < hierB ? a.scale : b.scale, scope: 'shared_nodes_only' };
    }

    // Strategy 3: Temporal (different time horizons)
    if (a.timeHorizon !== b.timeHorizon) {
      var shorter = _isMoreImmediate(a.timeHorizon, b.timeHorizon) ? a.scale : b.scale;
      var longer = shorter === a.scale ? b.scale : a.scale;
      return { strategy: 'temporal', shortTerm: shorter, longTerm: longer };
    }

    // Strategy 4: Human review
    return { strategy: 'human_review', reason: 'Cannot auto-resolve: same scale priority, same time horizon, similar confidence' };
  }

  function _isMoreImmediate(a, b) {
    var order = { immediate: 0, short: 1, medium: 2, long: 3, structural: 4 };
    return (order[a] || 0) < (order[b] || 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main translate entry point
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Translate a pattern + remedies into a scale-specific recommendation.
   *
   * @param {Object} opts
   * @param {Object} opts.pattern           — { patternClass, affectedNodes, affectedSystems, dominantDirection, dominantChannel }
   * @param {string} opts.scale             — target scale
   * @param {Object[]} opts.remedies        — selectedRemedy[] from remedy-resolver
   * @param {Object|null} opts.fallback     — fallback object from remedy-resolver (if any)
   * @param {number} opts.confidence        — translation confidence 0–1
   * @returns {Object} translationResult per translation-schema.json
   */
  function translate(opts) {
    var pattern   = opts.pattern;
    var scale     = opts.scale;
    var remedies  = opts.remedies || [];
    var fallback  = opts.fallback || null;
    var confidence = opts.confidence || 0;

    // Check scale applicability
    var applicable = SCALE_APPLICABILITY[pattern.patternClass];
    if (!applicable || !applicable[scale]) {
      return null; // Pattern does not produce recommendations at this scale
    }

    // Generate scale-specific actions
    var actions;
    switch (scale) {
      case 'mainUser':     actions = _translateMainUser(pattern, remedies); break;
      case 'portalUser':   actions = _translatePortalUser(pattern, remedies); break;
      case 'business':     actions = _translateBusiness(pattern, remedies); break;
      case 'domain':       actions = _translateDomain(pattern, remedies); break;
      case 'civilization': actions = _translateCivilization(pattern, remedies); break;
      default:             actions = [];
    }

    // Build translation result (per translation-schema)
    var now = Date.now();
    var result = {
      id: 'tr-' + pattern.patternClass + '-' + scale + '-' + _hash('' + now),
      patternClass:          pattern.patternClass,
      scale:                 scale,
      generatedAt:           now,
      affectedNodes:         pattern.affectedNodes || [],
      affectedSystems:       pattern.affectedSystems || [],
      dominantDirection:     pattern.dominantDirection || 'hyper',
      dominantChannel:       pattern.dominantChannel || '',
      selectedRemedies:      remedies,
      remedyCount:           remedies.length,
      translationConfidence: confidence,
      confidenceTier:        _tierFromScore(confidence),
      conflicts:             [],
      fallback:              fallback,
      isFallback:            fallback != null,
      gapSignal:             (fallback && fallback.gapSignal) || null,
      // Extension: carry generated actions for recommendation assembly
      _actions: actions
    };

    return result;
  }

  /**
   * Translate a pattern across ALL applicable scales.
   *
   * @param {Object} opts
   * @param {Object} opts.pattern        — pattern detection output
   * @param {Object} opts.resolvedByScale — { scale: resolverResult } from remedy-resolver
   * @returns {{ results: Object[], conflicts: Object[] }}
   */
  function translateAll(opts) {
    var pattern        = opts.pattern;
    var resolvedByScale = opts.resolvedByScale || {};
    var SCALES = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];

    var results = [];
    var allForConflict = [];

    for (var i = 0; i < SCALES.length; i++) {
      var scale = SCALES[i];
      var resolved = resolvedByScale[scale];
      if (!resolved) {
        // Attempt resolve now
        if (window.LIMENRemedyResolver) {
          resolved = window.LIMENRemedyResolver.resolve({
            patternClass:     pattern.patternClass,
            scale:            scale,
            affectedNodes:    pattern.affectedNodes,
            dominantDirection: pattern.dominantDirection,
            nodeStates:       opts.nodeStates || {},
            sourceHealth:     opts.sourceHealth || 1.0
          });
        } else {
          resolved = { selectedRemedies: [], fallback: null, isFallback: false, gapSignal: null };
        }
      }

      // Compute confidence
      var conf = 0;
      if (resolved.selectedRemedies.length > 0) {
        for (var c = 0; c < resolved.selectedRemedies.length; c++) {
          var tc = resolved.selectedRemedies[c].translationConfidence;
          if (tc && tc.confidenceScore > conf) conf = tc.confidenceScore;
        }
      } else if (resolved.fallback) {
        conf = resolved.fallback.confidence || 0;
      }

      var result = translate({
        pattern:    pattern,
        scale:      scale,
        remedies:   resolved.selectedRemedies,
        fallback:   resolved.fallback,
        confidence: conf
      });

      if (result) {
        results.push(result);
        allForConflict.push({
          scale:             scale,
          affectedNodes:     pattern.affectedNodes || [],
          dominantDirection: pattern.dominantDirection,
          confidence:        conf,
          timeHorizon:       pattern.timeHorizon || 'short'
        });
      }

      // Accumulate gap signals
      if (resolved.gapSignal && window.LIMENRemedyResolver) {
        window.LIMENRemedyResolver.accumulateGap(resolved.gapSignal);
      }
    }

    // Cross-scale conflict detection
    var conflicts = detectConflicts(allForConflict);

    // Attach conflicts to relevant results
    for (var k = 0; k < conflicts.length; k++) {
      var conflict = conflicts[k];
      for (var r = 0; r < results.length; r++) {
        if (results[r].scale === conflict.scaleA || results[r].scale === conflict.scaleB) {
          results[r].conflicts.push(conflict);
        }
      }
    }

    return {
      results: results,
      conflicts: conflicts
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _inferDomain(pattern) {
    var MAP = {
      cross_domain_resonance: 'economy',
      phase_transition:       'economy',
      regulation_failure:     'health',
      threat_cascade:         'environment',
      homeostatic_recovery:   'health',
      innovation_pressure:    'technology',
      memory_consolidation:   'research'
    };
    return MAP[pattern.patternClass] || 'economy';
  }

  function _inferAffectedDomains(pattern) {
    if (pattern.patternClass === 'cross_domain_resonance') {
      return ['economy', 'energy', 'environment'];
    }
    return [_inferDomain(pattern)];
  }

  function _intersect(a, b) {
    var setB = {};
    for (var i = 0; i < b.length; i++) setB[b[i]] = true;
    var result = [];
    for (var j = 0; j < a.length; j++) {
      if (setB[a[j]]) result.push(a[j]);
    }
    return result;
  }

  function _tierFromScore(score) {
    if (score >= 0.75) return 'high';
    if (score >= 0.55) return 'moderate';
    if (score >= 0.40) return 'low';
    return 'insufficient';
  }

  function _hash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 6);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENScaleTranslator = {
    translate:        translate,
    translateAll:     translateAll,
    detectConflicts:  detectConflicts,
    // Expose for testing
    _SCALE_APPLICABILITY: SCALE_APPLICABILITY
  };

})();
