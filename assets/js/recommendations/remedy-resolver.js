/**
 * LIMEN Recommendation Runtime — Remedy Resolver
 *
 * Looks up candidate remedies from the remedy knowledge base for a given
 * (patternClass, scale, nodeStates) triple.  Implements the 7-step selection
 * pipeline from docs/58 §5 and the 4-level fallback hierarchy from docs/59 §6.
 *
 * Input:  pattern detection output + scale + live node states
 * Output: { selectedRemedies[], fallback?, gapSignal? }
 *
 * Depends on:  window.LIMENRemedyRegistry  (populated externally or empty)
 * Exposes:     window.LIMENRemedyResolver
 *
 * Schema contracts (locked):
 *   remedy-schema.json          — remedy, selectionWeights, maxRemediesPerRecommendation
 *   translation-schema.json     — selectedRemedy, fallback, gapSignal, adjacentPatternMap
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants — exact reuse from locked schemas
  // ═══════════════════════════════════════════════════════════════════════════

  var SELECTION_WEIGHTS = {
    applicability: 0.30,
    nodeMatch:     0.25,
    confidence:    0.25,
    evidence:      0.20
  };

  var EVIDENCE_WEIGHTS = {
    'A': 1.00, 'Strong': 0.85, 'B': 0.70, 'Moderate': 0.60,
    'C': 0.45, 'Weak': 0.30, 'Emerging': 0.15
  };

  var MAX_REMEDIES = {
    mainUser: 2, portalUser: 5, business: 3, domain: 3, civilization: 2
  };

  var CONFIDENCE_THRESHOLDS = {
    mainUser: 0.40, portalUser: 0.55, business: 0.60, domain: 0.50, civilization: 0.65
  };

  // From translation-schema adjacentPatternMap (locked)
  var ADJACENT_PATTERNS = {
    threat_cascade:          ['regulation_failure', 'somatic_cascade'],
    executive_overload:      ['regulation_failure', 'narrative_collapse'],
    reward_dysregulation:    ['executive_overload', 'regulation_failure'],
    memory_consolidation:    ['plasticity_window', 'innovation_pressure'],
    regulation_failure:      ['threat_cascade', 'executive_overload'],
    cross_domain_resonance:  ['phase_transition', 'regulation_failure'],
    innovation_pressure:     ['plasticity_window', 'memory_consolidation'],
    somatic_cascade:         ['threat_cascade', 'regulation_failure'],
    narrative_collapse:      ['executive_overload', 'regulation_failure'],
    homeostatic_recovery:    ['regulation_failure', 'plasticity_window'],
    plasticity_window:       ['memory_consolidation', 'innovation_pressure'],
    phase_transition:        ['cross_domain_resonance', 'regulation_failure'],
    prediction_violation:    ['oscillation_instability', 'regulation_failure'],
    oscillation_instability: ['prediction_violation', 'regulation_failure']
  };

  var SCALE_NEIGHBORS = {
    mainUser:     ['portalUser'],
    portalUser:   ['mainUser', 'business'],
    business:     ['portalUser', 'domain'],
    domain:       ['business', 'civilization'],
    civilization: ['domain']
  };

  var GENERIC_DIRECTION_REMEDIES = {
    mainUser:     { hyper: 'Consider slowing your pace', hypo: 'Try engaging more deeply', altered: 'Your attention pattern is shifting', silent: 'Take a moment to pause' },
    portalUser:   { hyper: 'Downregulation indicated for affected circuits', hypo: 'Activation support indicated', altered: 'Mixed presentation — diagnostic assessment recommended', silent: 'System quiescence detected — monitoring recommended' },
    business:     { hyper: 'Risk management posture recommended', hypo: 'Engagement and investment opportunity detected', altered: 'Ambiguous signal — defer decision pending clarity', silent: 'Dormant sector — baseline monitoring sufficient' },
    domain:       { hyper: 'Sector stress elevated — activate monitoring', hypo: 'Sector underperforming — investigate capacity gaps', altered: 'Mixed signals across sector — cross-domain review', silent: 'Sector inactive — no intervention required' },
    civilization: { hyper: 'Systemic stress detected — activate coordination', hypo: 'Systemic underperformance — structural review', altered: 'Systemic instability — observation mode', silent: 'System quiescent — maintain baselines' }
  };

  var FALLBACK_PENALTIES = {
    adjacentPattern:      0.70,
    crossScaleAdaptation: 0.60,
    genericDirection:     0.25,
    observationOnly:      0.00
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Registry access
  // ═══════════════════════════════════════════════════════════════════════════

  function _getRegistry() {
    return window.LIMENRemedyRegistry || { remedies: [], index: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Candidate retrieval — filter by scale + pattern
  // ═══════════════════════════════════════════════════════════════════════════

  function _getCandidates(patternClass, scale) {
    var reg = _getRegistry();
    var remedies = reg.remedies || [];
    var candidates = [];
    for (var i = 0; i < remedies.length; i++) {
      var r = remedies[i];
      if (r.state !== 'ACTIVE') continue;
      if (r.scale !== scale) continue;
      // Check if this remedy addresses the target pattern
      var patterns = r.addressesPatterns || [];
      for (var p = 0; p < patterns.length; p++) {
        if (patterns[p].patternClass === patternClass) {
          candidates.push({ remedy: r, patternLink: patterns[p] });
          break;
        }
      }
    }
    return candidates;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2: Node match scoring
  // ═══════════════════════════════════════════════════════════════════════════

  function _nodeMatchScore(remedy, affectedNodes) {
    var linked = remedy.linkedNodes || [];
    if (linked.length === 0 || affectedNodes.length === 0) return 0;
    var matchWeightSum = 0;
    var totalWeight = 0;
    for (var i = 0; i < linked.length; i++) {
      totalWeight += linked[i].weight;
      for (var j = 0; j < affectedNodes.length; j++) {
        if (linked[i].nodeId === affectedNodes[j]) {
          matchWeightSum += linked[i].weight;
          break;
        }
      }
    }
    return totalWeight > 0 ? matchWeightSum / totalWeight : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3: Direction filter
  // ═══════════════════════════════════════════════════════════════════════════

  function _directionMatch(remedy, dominantDirection) {
    if (!dominantDirection) return true; // no direction info → pass
    return remedy.targetDirection === dominantDirection;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4: Contraindication check
  // ═══════════════════════════════════════════════════════════════════════════

  function _checkContraindications(remedy, nodeStates) {
    var contras = remedy.contraindications || [];
    var hardBlock = false;
    var warnings = [];
    for (var i = 0; i < contras.length; i++) {
      var c = contras[i];
      if (c.severity === 'hard') {
        // Hard contraindications only block when their condition is evaluable
        // and met. Without a parseable condition, they become soft warnings.
        // Full condition parsing is deferred to later implementation phase.
        if (c.condition && _evaluateCondition(c.condition, nodeStates)) {
          hardBlock = true;
          break;
        } else {
          // Condition not evaluable at runtime — treat as strong warning
          warnings.push('[HARD] ' + c.description);
        }
      }
      if (c.severity === 'soft') {
        warnings.push(c.description);
      }
    }
    return { blocked: hardBlock, warnings: warnings };
  }

  /**
   * Simple condition evaluator for contraindication conditions.
   * Supports: "node[ID].activation > THRESHOLD" patterns.
   * Returns false (not blocked) for unparseable conditions.
   */
  function _evaluateCondition(condition, nodeStates) {
    if (!condition || !nodeStates) return false;
    // Match patterns like "node[17].activation > 0.95"
    var match = condition.match(/node\[(\d+)\]\.activation\s*(>|<|>=|<=)\s*([\d.]+)/g);
    if (!match) return false;
    for (var i = 0; i < match.length; i++) {
      var parts = match[i].match(/node\[(\d+)\]\.activation\s*(>|<|>=|<=)\s*([\d.]+)/);
      if (!parts) continue;
      var nodeId = parts[1];
      var op = parts[2];
      var threshold = parseFloat(parts[3]);
      var ns = nodeStates[nodeId];
      if (!ns) continue;
      var act = ns.activation || 0;
      var met = false;
      if (op === '>')  met = act > threshold;
      if (op === '<')  met = act < threshold;
      if (op === '>=') met = act >= threshold;
      if (op === '<=') met = act <= threshold;
      if (!met) return false; // AND semantics: all conditions must hold
    }
    return match.length > 0; // Only return true if at least one condition was parsed and all met
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5: Confidence gate
  // ═══════════════════════════════════════════════════════════════════════════

  function _confidenceTier(score) {
    if (score >= 0.75) return 'high';
    if (score >= 0.55) return 'moderate';
    if (score >= 0.40) return 'low';
    return 'insufficient';
  }

  function _translationConfidence(remedy, patternLink, nodeMatchVal, sourceHealth, scaleRelevance) {
    var factors = {
      remedyConfidence: remedy.confidence || 0.5,
      applicability:    patternLink.applicability || 0,
      nodeMatch:        nodeMatchVal,
      sourceHealth:     sourceHealth,
      scaleRelevance:   scaleRelevance
    };
    var score = factors.remedyConfidence * 0.30
             + factors.applicability * 0.25
             + factors.nodeMatch * 0.20
             + factors.sourceHealth * 0.15
             + factors.scaleRelevance * 0.10;
    return {
      confidenceScore: Math.round(score * 1000) / 1000,
      confidenceFactors: factors,
      confidenceTier: _confidenceTier(score)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 6: Composite ranking
  // ═══════════════════════════════════════════════════════════════════════════

  function _compositeScore(patternLink, nodeMatchVal, remedyConfidence, evidenceType) {
    var evWeight = EVIDENCE_WEIGHTS[evidenceType] || 0.30;
    return SELECTION_WEIGHTS.applicability * (patternLink.applicability || 0)
         + SELECTION_WEIGHTS.nodeMatch * nodeMatchVal
         + SELECTION_WEIGHTS.confidence * (remedyConfidence || 0.5)
         + SELECTION_WEIGHTS.evidence * evWeight;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 7: Cap and return
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildSelectedRemedy(candidate, nodeMatchVal, translConf, composite, warnings) {
    var r = candidate.remedy;
    return {
      remedyId:              r.id,
      remedyVersion:         r.version || 1,
      compositeScore:        Math.round(composite * 1000) / 1000,
      translationConfidence: translConf,
      nodeMatchScore:        Math.round(nodeMatchVal * 1000) / 1000,
      applicability:         candidate.patternLink.applicability || 0,
      softWarnings:          warnings,
      translatedText:        _buildTranslatedText(r),
      scalePayload:          r.scalePayload || null
    };
  }

  function _buildTranslatedText(remedy) {
    var label = '';
    var sp = remedy.scalePayload;
    if (sp) {
      label = sp.treatmentLabel || sp.userFacingText || sp.businessAction
           || sp.policyAction || sp.systemicAction || '';
    }
    if (!label) label = remedy.mechanism || remedy.id;
    var ev = remedy.evidenceType ? ' (Evidence: ' + remedy.evidenceType + ')' : '';
    return label + ev;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Primary resolve pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve remedies for a detected pattern at a specific scale.
   *
   * @param {Object} opts
   * @param {string} opts.patternClass      — one of 14 pattern classes
   * @param {string} opts.scale             — one of 5 scales
   * @param {number[]} opts.affectedNodes   — numeric node IDs in pattern
   * @param {string} opts.dominantDirection — hyper | hypo | altered | silent
   * @param {Object} opts.nodeStates        — { nodeId: { activation, direction, ... } }
   * @param {number} opts.sourceHealth      — liveSourceCount / totalSourceCount (0–1)
   * @returns {{ selectedRemedies: Object[], fallback: Object|null, isFallback: boolean, gapSignal: Object|null }}
   */
  function resolve(opts) {
    var patternClass     = opts.patternClass;
    var scale            = opts.scale;
    var affectedNodes    = opts.affectedNodes || [];
    var dominantDirection = opts.dominantDirection || 'hyper';
    var nodeStates       = opts.nodeStates || {};
    var sourceHealth     = opts.sourceHealth != null ? opts.sourceHealth : 1.0;

    // Scale relevance: 1.0 for exact scale match (always, since we filter by scale)
    var scaleRelevance = 1.0;

    // Step 1: Get candidates
    var candidates = _getCandidates(patternClass, scale);

    // Step 3: Direction filter
    candidates = candidates.filter(function (c) {
      return _directionMatch(c.remedy, dominantDirection);
    });

    // Step 4: Contraindication check
    var surviving = [];
    for (var i = 0; i < candidates.length; i++) {
      var check = _checkContraindications(candidates[i].remedy, nodeStates);
      if (!check.blocked) {
        surviving.push({ candidate: candidates[i], warnings: check.warnings });
      }
    }

    // Steps 2, 5, 6: Score and rank
    var scored = [];
    for (var s = 0; s < surviving.length; s++) {
      var cand = surviving[s].candidate;
      var nmScore = _nodeMatchScore(cand.remedy, affectedNodes);
      var tConf = _translationConfidence(cand.remedy, cand.patternLink, nmScore, sourceHealth, scaleRelevance);

      // Step 5: Confidence gate
      var threshold = CONFIDENCE_THRESHOLDS[scale] || 0.50;
      if (tConf.confidenceScore < threshold * 0.5) continue; // hard gate at half threshold

      var composite = _compositeScore(cand.patternLink, nmScore, cand.remedy.confidence, cand.remedy.evidenceType);
      scored.push({
        candidate: cand,
        warnings:  surviving[s].warnings,
        nmScore:   nmScore,
        tConf:     tConf,
        composite: composite
      });
    }

    // Sort by composite DESC
    scored.sort(function (a, b) { return b.composite - a.composite; });

    // Step 7: Cap
    var maxCount = MAX_REMEDIES[scale] || 3;
    scored = scored.slice(0, maxCount);

    // Build output
    var selected = scored.map(function (s) {
      return _buildSelectedRemedy(s.candidate, s.nmScore, s.tConf, s.composite, s.warnings);
    });

    // If we have results, return them
    if (selected.length > 0) {
      return {
        selectedRemedies: selected,
        fallback: null,
        isFallback: false,
        gapSignal: null
      };
    }

    // ═════════════════════════════════════════════════════════════════════
    // Fallback hierarchy (docs/59 §6)
    // ═════════════════════════════════════════════════════════════════════

    // Level 1: Adjacent pattern
    var adjPatterns = ADJACENT_PATTERNS[patternClass] || [];
    for (var a = 0; a < adjPatterns.length; a++) {
      var adjCandidates = _getCandidates(adjPatterns[a], scale);
      if (adjCandidates.length > 0) {
        // Take best adjacent remedy
        var bestAdj = adjCandidates[0];
        var adjNm = _nodeMatchScore(bestAdj.remedy, affectedNodes);
        var adjConf = _translationConfidence(bestAdj.remedy, bestAdj.patternLink, adjNm, sourceHealth, scaleRelevance * 0.7);
        var adjComposite = _compositeScore(bestAdj.patternLink, adjNm, bestAdj.remedy.confidence, bestAdj.remedy.evidenceType);
        adjComposite *= FALLBACK_PENALTIES.adjacentPattern;

        var adjSelected = _buildSelectedRemedy(bestAdj, adjNm, adjConf, adjComposite, ['Fallback: using adjacent pattern ' + adjPatterns[a]]);

        return {
          selectedRemedies: [],
          fallback: {
            type: 'adjacent_pattern',
            originalPattern: patternClass,
            fallbackPattern: adjPatterns[a],
            remedies: [adjSelected],
            confidence: adjComposite,
            warning: 'No exact remedy for ' + patternClass + ' at ' + scale + '; using adjacent pattern ' + adjPatterns[a]
          },
          isFallback: true,
          gapSignal: null
        };
      }
    }

    // Level 2: Cross-scale adaptation
    var neighbors = SCALE_NEIGHBORS[scale] || [];
    for (var n = 0; n < neighbors.length; n++) {
      var crossCandidates = _getCandidates(patternClass, neighbors[n]);
      if (crossCandidates.length > 0) {
        var bestCross = crossCandidates[0];
        var crossNm = _nodeMatchScore(bestCross.remedy, affectedNodes);
        var crossConf = _translationConfidence(bestCross.remedy, bestCross.patternLink, crossNm, sourceHealth, 0.6);
        var crossComposite = _compositeScore(bestCross.patternLink, crossNm, bestCross.remedy.confidence, bestCross.remedy.evidenceType);
        crossComposite *= FALLBACK_PENALTIES.crossScaleAdaptation;

        var crossSelected = _buildSelectedRemedy(bestCross, crossNm, crossConf, crossComposite, ['Fallback: adapted from ' + neighbors[n] + ' scale']);

        return {
          selectedRemedies: [],
          fallback: {
            type: 'cross_scale_adaptation',
            originalPattern: patternClass,
            originalScale: neighbors[n],
            targetScale: scale,
            remedies: [crossSelected],
            confidence: crossComposite,
            warning: 'No remedy at ' + scale + ' scale; adapted from ' + neighbors[n]
          },
          isFallback: true,
          gapSignal: null
        };
      }
    }

    // Level 3: Generic direction
    var genericText = (GENERIC_DIRECTION_REMEDIES[scale] || {})[dominantDirection] || 'Observation recommended';
    var gapSignal = {
      patternClass: patternClass,
      scale: scale,
      affectedNodes: affectedNodes,
      fallbackLevel: 3,
      timestamp: Date.now(),
      frequency: 1
    };

    return {
      selectedRemedies: [],
      fallback: {
        type: 'generic_direction',
        direction: dominantDirection,
        remedies: [{
          remedyId: 'fallback-generic-' + scale + '-' + dominantDirection,
          remedyVersion: 1,
          compositeScore: FALLBACK_PENALTIES.genericDirection,
          translationConfidence: {
            confidenceScore: FALLBACK_PENALTIES.genericDirection,
            confidenceFactors: {
              remedyConfidence: FALLBACK_PENALTIES.genericDirection,
              applicability: 0,
              nodeMatch: 0,
              sourceHealth: sourceHealth,
              scaleRelevance: 0.5
            },
            confidenceTier: 'insufficient'
          },
          nodeMatchScore: 0,
          translatedText: genericText
        }],
        confidence: FALLBACK_PENALTIES.genericDirection,
        warning: 'No pattern-specific or adapted remedy available; using generic direction-based fallback',
        gapSignal: gapSignal
      },
      isFallback: true,
      gapSignal: gapSignal
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Gap signal accumulation
  // ═══════════════════════════════════════════════════════════════════════════

  var _gapStore = {};  // key: patternClass + ':' + scale → gapSignal
  var GAP_PROMOTION_THRESHOLD = 10;

  function accumulateGap(gapSignal) {
    if (!gapSignal) return null;
    var key = gapSignal.patternClass + ':' + gapSignal.scale;
    if (_gapStore[key]) {
      _gapStore[key].frequency++;
      _gapStore[key].timestamp = gapSignal.timestamp;
    } else {
      _gapStore[key] = Object.assign({}, gapSignal);
    }

    // Check promotion threshold
    if (_gapStore[key].frequency >= GAP_PROMOTION_THRESHOLD) {
      try {
        window.dispatchEvent(new CustomEvent('limen:remedy-authoring-request', {
          detail: _gapStore[key]
        }));
      } catch (e) { /* silent */ }
    }

    return _gapStore[key];
  }

  function getGapStore() {
    return Object.assign({}, _gapStore);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENRemedyResolver = {
    resolve:        resolve,
    accumulateGap:  accumulateGap,
    getGapStore:    getGapStore,
    // Expose constants for testing
    _SELECTION_WEIGHTS:    SELECTION_WEIGHTS,
    _EVIDENCE_WEIGHTS:     EVIDENCE_WEIGHTS,
    _MAX_REMEDIES:         MAX_REMEDIES,
    _ADJACENT_PATTERNS:    ADJACENT_PATTERNS,
    _FALLBACK_PENALTIES:   FALLBACK_PENALTIES
  };

})();
