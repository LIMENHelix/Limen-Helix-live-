/**
 * LIMEN Recommendation Runtime — Recommendation Engine
 *
 * Main orchestrator: accepts propagation results, detects patterns,
 * resolves remedies, translates across scales, builds evidence envelopes,
 * and returns structured recommendation objects.
 *
 * Pipeline:
 *   propagation result → pattern detection → remedy resolution (per scale)
 *     → scale translation → evidence envelope → recommendation assembly
 *
 * Implements:
 *   docs/57     — Recommendation object model + lifecycle
 *   docs/58     — Remedy knowledge base lookup
 *   docs/59     — Pattern-to-remedy translation pipeline
 *   docs/60     — Evidence envelope wrapping
 *
 * Depends on:
 *   window.LIMENRemedyResolver    (recommendations/remedy-resolver.js)
 *   window.LIMENScaleTranslator   (recommendations/scale-translator.js)
 *   window.LIMENEvidenceBuilder   (recommendations/evidence-builder.js)
 *   window.LIMENPropagation       (propagation-engine.js)   — optional, for forward sim
 *   window.LIMENDomains           (domain-signal-engine.js) — domain stress data
 *   window.LIMENGlobalState       (global-state-engine.js)  — global mode
 *
 * Exposes:  window.LIMENRecommendationEngine
 *
 * Schema contracts (locked):
 *   recommendation-schema.json — recommendation, recommendationSet, confidenceModel, conflict, lifecycleState
 *   evidence-schema.json       — evidenceEnvelope
 *   All enums verbatim from prior schemas.
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants — exact from locked schemas
  // ═══════════════════════════════════════════════════════════════════════════

  var SCALES = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];

  var PATTERN_CLASSES = [
    'threat_cascade', 'executive_overload', 'reward_dysregulation',
    'memory_consolidation', 'regulation_failure', 'cross_domain_resonance',
    'innovation_pressure', 'somatic_cascade', 'narrative_collapse',
    'homeostatic_recovery', 'plasticity_window', 'phase_transition',
    'prediction_violation', 'oscillation_instability'
  ];

  var CONFIDENCE_THRESHOLDS = {
    mainUser: 0.40, portalUser: 0.55, business: 0.60, domain: 0.50, civilization: 0.65
  };

  var MAX_ACTIVE = {
    mainUser: 3, portalUser: 8, business: 5, domain: 5, civilization: 3
  };

  var URGENCY_DECAY = {
    immediate: 0.50, short: 0.20, medium: 0.08, long: 0.03, structural: 0.01
  };

  // Systems associated with node groups (from connectome-weights / brain-connectome)
  var NODE_SYSTEMS = {};  // Populated from brain data if available

  // ═══════════════════════════════════════════════════════════════════════════
  // Pattern Detection (from innervation-schema pattern definitions)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detect patterns from propagation output + node states.
   * Returns an array of detected pattern objects.
   *
   * This is a lightweight detector for the scaffold. The full innervation-spec
   * pattern detection (hotCluster, coldGap, predictionViolation, oscillation)
   * will be implemented in the propagation engine upgrade.
   *
   * @param {Object} propagationResult — { activations: {nodeId: float}, hyper: int[] }
   * @param {Object} nodeStates — { nodeId: { activation, direction, predictionError, system, label, ... } }
   * @returns {Object[]} detected patterns
   */
  function detectPatterns(propagationResult, nodeStates) {
    var activations = propagationResult.activations || {};
    var hyperNodes = propagationResult.hyper || [];
    var patterns = [];

    // ── Hot Cluster Detection ────────────────────────────────────────────
    var hotClusters = _findHotClusters(activations, nodeStates);

    // ── Cold Gap Detection ───────────────────────────────────────────────
    var coldGaps = _findColdGaps(activations, nodeStates);

    // ── Prediction Violations ────────────────────────────────────────────
    var predViolations = _findPredictionViolations(nodeStates);

    // ── Oscillation Detection ────────────────────────────────────────────
    var oscillatingNodes = _findOscillations(nodeStates);

    // ── Pattern Classification ───────────────────────────────────────────
    // Use heuristic rules to map topology to pattern classes
    var classified = _classifyPattern(hotClusters, coldGaps, predViolations, oscillatingNodes, hyperNodes, activations, nodeStates);

    if (classified) {
      classified.hotClusters = hotClusters;
      classified.coldGaps = coldGaps;
      classified.predictionViolations = predViolations;
      classified.oscillatingNodes = oscillatingNodes;
      patterns.push(classified);
    }

    return patterns;
  }

  function _findHotClusters(activations, nodeStates) {
    // Group active nodes (>0.5) by system
    var bySys = {};
    for (var nid in activations) {
      if (!activations.hasOwnProperty(nid)) continue;
      if (activations[nid] < 0.5) continue;
      var ns = nodeStates[nid] || {};
      var sys = ns.system || 'unknown';
      if (!bySys[sys]) bySys[sys] = [];
      bySys[sys].push({ nodeId: Number(nid), activation: activations[nid] });
    }

    var clusters = [];
    for (var sys in bySys) {
      if (!bySys.hasOwnProperty(sys)) continue;
      var nodes = bySys[sys];
      if (nodes.length < 2) continue; // Need at least 2 nodes for a cluster
      var sum = 0;
      var peak = 0;
      var peakNode = 0;
      var nodeIds = [];
      for (var i = 0; i < nodes.length; i++) {
        sum += nodes[i].activation;
        nodeIds.push(nodes[i].nodeId);
        if (nodes[i].activation > peak) {
          peak = nodes[i].activation;
          peakNode = nodes[i].nodeId;
        }
      }
      clusters.push({
        nodes: nodeIds,
        system: sys,
        meanAct: Math.round((sum / nodes.length) * 1000) / 1000,
        peakNode: peakNode
      });
    }
    return clusters;
  }

  function _findColdGaps(activations, nodeStates) {
    // Nodes with activation significantly below their running mean
    var gaps = [];
    for (var nid in nodeStates) {
      if (!nodeStates.hasOwnProperty(nid)) continue;
      var ns = nodeStates[nid];
      var act = activations[nid] || 0;
      var mean = ns.activationMean || 0;
      if (mean > 0.3 && act < mean * 0.5) {
        gaps.push({
          nodes: [Number(nid)],
          system: ns.system || 'unknown',
          meanAct: Math.round(act * 1000) / 1000,
          expectedAct: Math.round(mean * 1000) / 1000
        });
      }
    }
    return gaps;
  }

  function _findPredictionViolations(nodeStates) {
    var violations = [];
    for (var nid in nodeStates) {
      if (!nodeStates.hasOwnProperty(nid)) continue;
      var ns = nodeStates[nid];
      var err = ns.predictionError || 0;
      if (Math.abs(err) > 0.4) {
        violations.push({
          nodeId: Number(nid),
          predicted: Math.round(((ns.activation || 0) - err) * 1000) / 1000,
          actual: Math.round((ns.activation || 0) * 1000) / 1000,
          error: Math.round(err * 1000) / 1000
        });
      }
    }
    return violations;
  }

  function _findOscillations(nodeStates) {
    var oscillating = [];
    for (var nid in nodeStates) {
      if (!nodeStates.hasOwnProperty(nid)) continue;
      var ns = nodeStates[nid];
      // Oscillation: high variance relative to mean
      if (ns.activationVar && ns.activationMean && ns.activationMean > 0.2) {
        var cv = ns.activationVar / ns.activationMean;
        if (cv > 0.5) oscillating.push(Number(nid));
      }
    }
    return oscillating;
  }

  /**
   * Classify detected topology into one of 14 pattern classes.
   * Heuristic rules — the full classifier is a future enhancement.
   */
  function _classifyPattern(hotClusters, coldGaps, predViolations, oscillatingNodes, hyperNodes, activations, nodeStates) {
    // Limbic nodes: BLA=17, CeA=18, BNST=19, ACC=9
    // Executive nodes: DLPFC=12, vlPFC=13, OFC=6, FPCN=15
    // HPA nodes: HYPO=31, PIT=32, ADR=33
    // DMN nodes: mPFC=1, PCC=2, Precuneus=3
    // Reward: NAc=24, VTA=25, OFC=6

    var limbicActive = _countActive([17, 18, 19, 9], activations, 0.5);
    var execActive   = _countActive([12, 13, 6, 15], activations, 0.5);
    var hpaActive    = _countActive([31, 32, 33], activations, 0.5);
    var rewardActive = _countActive([24, 25, 6], activations, 0.5);
    var dmnActive    = _countActive([1, 2, 3], activations, 0.5);

    var patternClass, dominantDirection, timeHorizon;
    var allAffectedNodes = hyperNodes.slice(); // Start with hyper nodes
    var allAffectedSystems = [];

    // Collect all affected nodes (activation > 0.3)
    for (var nid in activations) {
      if (activations.hasOwnProperty(nid) && activations[nid] > 0.3) {
        var n = Number(nid);
        if (allAffectedNodes.indexOf(n) < 0) allAffectedNodes.push(n);
      }
    }

    // Determine dominant direction from hyper/cold distribution
    var hypoNodes = coldGaps.reduce(function (acc, g) { return acc.concat(g.nodes); }, []);

    if (hyperNodes.length > hypoNodes.length * 2) dominantDirection = 'hyper';
    else if (hypoNodes.length > hyperNodes.length * 2) dominantDirection = 'hypo';
    else if (oscillatingNodes.length > 3) dominantDirection = 'altered';
    else dominantDirection = 'hyper';

    // Classification heuristics
    if (limbicActive >= 2 && hyperNodes.indexOf(17) >= 0) {
      patternClass = 'threat_cascade';
      timeHorizon = 'immediate';
      allAffectedSystems = ['limbic'];
      if (hpaActive >= 2) allAffectedSystems.push('hpa');
    } else if (execActive >= 3 && dominantDirection === 'hyper') {
      patternClass = 'executive_overload';
      timeHorizon = 'short';
      allAffectedSystems = ['executive'];
    } else if (rewardActive >= 2) {
      patternClass = 'reward_dysregulation';
      timeHorizon = 'short';
      allAffectedSystems = ['reward'];
    } else if (hpaActive >= 2 && dominantDirection === 'hyper') {
      if (hotClusters.length > 2) {
        patternClass = 'cross_domain_resonance';
        timeHorizon = 'medium';
        allAffectedSystems = ['hpa', 'autonomic'];
      } else {
        patternClass = 'regulation_failure';
        timeHorizon = 'short';
        allAffectedSystems = ['hpa'];
      }
    } else if (predViolations.length >= 3) {
      patternClass = 'prediction_violation';
      timeHorizon = 'immediate';
      allAffectedSystems = ['salience'];
    } else if (oscillatingNodes.length >= 3) {
      patternClass = 'oscillation_instability';
      timeHorizon = 'short';
      allAffectedSystems = ['multiple'];
    } else if (dmnActive >= 2 && dominantDirection === 'hypo') {
      patternClass = 'narrative_collapse';
      timeHorizon = 'medium';
      allAffectedSystems = ['dmn'];
    } else if (hotClusters.length === 0 && coldGaps.length === 0) {
      // Quiescent — no pattern
      return null;
    } else if (dominantDirection === 'hypo' && coldGaps.length > hotClusters.length) {
      patternClass = 'homeostatic_recovery';
      timeHorizon = 'medium';
      allAffectedSystems = ['regulatory'];
    } else {
      // Default: regulation failure (most general pattern)
      patternClass = 'regulation_failure';
      timeHorizon = 'short';
      allAffectedSystems = ['mixed'];
    }

    // Determine dominant channel (simplified — from hottest cluster system)
    var dominantChannel = '';
    if (hotClusters.length > 0) {
      var topSys = hotClusters[0].system;
      var CHANNEL_MAP = {
        limbic: 'cortico-limbic', executive: 'salience-executive',
        hpa: 'hpa-axis', dmn: 'dmn-loop', reward: 'reward-valuation',
        autonomic: 'gut-brain', memory: 'memory-consolidation'
      };
      dominantChannel = CHANNEL_MAP[topSys] || 'thalamo-cortical';
    }

    return {
      patternClass:     patternClass,
      affectedNodes:    allAffectedNodes,
      affectedSystems:  allAffectedSystems,
      dominantDirection: dominantDirection,
      dominantChannel:  dominantChannel,
      timeHorizon:      timeHorizon
    };
  }

  function _countActive(nodeIds, activations, threshold) {
    var count = 0;
    for (var i = 0; i < nodeIds.length; i++) {
      if ((activations[nodeIds[i]] || 0) >= threshold) count++;
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Confidence Model (docs/57 — recommendation confidenceModel)
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildConfidenceModel(sourceHealth, propagationResult, hotClusters, scaleRelevance) {
    var sourceQuality = sourceHealth;
    var propStability = 0.3;
    if (propagationResult && propagationResult.converged) {
      propStability = 1.0 - ((propagationResult.convergenceStep || 12) / 12);
      propStability = Math.max(0.1, propStability);
    }
    var patternClarity = 0;
    if (hotClusters.length > 0) {
      patternClarity = hotClusters[0].meanAct || 0;
    }

    var score = sourceQuality * 0.30 + propStability * 0.25 + patternClarity * 0.25 + scaleRelevance * 0.20;
    score = Math.round(score * 1000) / 1000;

    var tier;
    if (score >= 0.75) tier = 'high';
    else if (score >= 0.55) tier = 'moderate';
    else if (score >= 0.40) tier = 'low';
    else tier = 'insufficient';

    return {
      confidenceScore: score,
      confidenceFactors: {
        sourceQuality:        Math.round(sourceQuality * 1000) / 1000,
        propagationStability: Math.round(propStability * 1000) / 1000,
        patternClarity:       Math.round(patternClarity * 1000) / 1000,
        scaleRelevance:       Math.round(scaleRelevance * 1000) / 1000
      },
      confidenceTier: tier
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Urgency computation (docs/57)
  // ═══════════════════════════════════════════════════════════════════════════

  function _computeUrgency(patternIntensity, timeHorizon, ageTimeUnits) {
    var lambda = URGENCY_DECAY[timeHorizon] || URGENCY_DECAY.short;
    return Math.round(patternIntensity * Math.exp(-lambda * (ageTimeUnits || 0)) * 1000) / 1000;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main generate pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate recommendations from propagation output.
   *
   * @param {Object} opts
   * @param {Object} opts.propagationResult  — { activations: {nodeId: float}, hyper: int[], steps?, convergenceStep?, converged? }
   * @param {Object} opts.nodeStates         — { nodeId: { activation, direction, predictionError, system, label, salience, activationMean, activationVar, seedSource } }
   * @param {Array}  [opts.feedSources]      — feed evidence items (or null for auto-build)
   * @param {number} [opts.sourceHealth]     — liveSourceCount / totalSourceCount (0-1, default 1.0)
   * @returns {Object} recommendationSet per recommendation-schema.json
   */
  function generate(opts) {
    var propagationResult = opts.propagationResult;
    var nodeStates        = opts.nodeStates || {};
    var feedSources       = opts.feedSources || null;
    var sourceHealth      = opts.sourceHealth != null ? opts.sourceHealth : 1.0;

    // Augment propagation result with additional fields if missing
    if (propagationResult && !propagationResult.hasOwnProperty('converged')) {
      propagationResult.converged = propagationResult.convergenceStep != null;
    }
    if (propagationResult && !propagationResult.hasOwnProperty('steps')) {
      propagationResult.steps = 12;
    }

    // ── Step 1: Pattern Detection ─────────────────────────────────────────
    var patterns = detectPatterns(propagationResult, nodeStates);

    if (patterns.length === 0) {
      // No patterns detected — return empty recommendation set
      return _emptySet();
    }

    // ── Process each detected pattern ─────────────────────────────────────
    var allRecommendations = {
      mainUser: [], portalUser: [], business: [], domain: [], civilization: []
    };
    var allConflicts = [];

    for (var p = 0; p < patterns.length; p++) {
      var pattern = patterns[p];

      // ── Step 2: Remedy Resolution (per scale) ───────────────────────────
      var resolvedByScale = {};
      for (var si = 0; si < SCALES.length; si++) {
        var scale = SCALES[si];
        if (window.LIMENRemedyResolver) {
          resolvedByScale[scale] = window.LIMENRemedyResolver.resolve({
            patternClass:     pattern.patternClass,
            scale:            scale,
            affectedNodes:    pattern.affectedNodes,
            dominantDirection: pattern.dominantDirection,
            nodeStates:       nodeStates,
            sourceHealth:     sourceHealth
          });
        }
      }

      // ── Step 3: Scale Translation ──────────────────────────────────────
      var translationOutput;
      if (window.LIMENScaleTranslator) {
        translationOutput = window.LIMENScaleTranslator.translateAll({
          pattern:        pattern,
          resolvedByScale: resolvedByScale,
          nodeStates:     nodeStates,
          sourceHealth:   sourceHealth
        });
      } else {
        translationOutput = { results: [], conflicts: [] };
      }

      // ── Step 4: Build recommendations for each translated scale ─────────
      for (var tr = 0; tr < translationOutput.results.length; tr++) {
        var tResult = translationOutput.results[tr];
        var scaleKey = tResult.scale;

        // Check confidence threshold
        var threshold = CONFIDENCE_THRESHOLDS[scaleKey] || 0.50;
        // For fallbacks, allow at lower threshold
        var effectiveConf = tResult.isFallback
          ? (tResult.fallback ? tResult.fallback.confidence : 0)
          : tResult.translationConfidence;

        // Build confidence model for this recommendation
        var confModel = _buildConfidenceModel(
          sourceHealth,
          propagationResult,
          pattern.hotClusters || [],
          tResult.translationConfidence
        );

        // ── Step 5: Evidence Envelope ────────────────────────────────────
        var recId = 'rec-' + _hash(pattern.patternClass + scaleKey + Date.now());
        var envelope = null;
        if (window.LIMENEvidenceBuilder) {
          envelope = window.LIMENEvidenceBuilder.build({
            recommendationId: recId,
            pattern: pattern,
            nodeStates: nodeStates,
            feedSources: feedSources,
            propagationResult: propagationResult
          });
        }

        // Compute pattern intensity (mean activation of affected nodes)
        var intensity = 0;
        for (var ni = 0; ni < pattern.affectedNodes.length; ni++) {
          intensity += (propagationResult.activations[pattern.affectedNodes[ni]] || 0);
        }
        intensity = pattern.affectedNodes.length > 0 ? intensity / pattern.affectedNodes.length : 0;

        // ── Step 6: Assemble recommendation object ──────────────────────
        var recommendation = {
          id:                recId,
          scale:             scaleKey,
          generatedAt:       Date.now(),
          state:             'GENERATED',

          patternClass:      pattern.patternClass,
          affectedNodes:     pattern.affectedNodes,
          affectedSystems:   pattern.affectedSystems,
          dominantPhase:     _inferDominantPhase(pattern.affectedNodes),
          dominantChannel:   pattern.dominantChannel || '',

          sourceSignals:     _buildSourceSignals(feedSources),
          propagationSteps:  propagationResult.steps || 0,
          convergenceStep:   propagationResult.convergenceStep || null,

          confidence:        confModel.confidenceScore,
          confidenceDetail:  confModel,
          timeHorizon:       pattern.timeHorizon || 'short',
          urgency:           _computeUrgency(intensity, pattern.timeHorizon, 0),

          conflicts:         tResult.conflicts || [],

          recommendedActions: tResult._actions || [],
          contraindications:  _buildContraindications(resolvedByScale[scaleKey]),

          evidenceChain:     envelope ? _envelopeToChain(envelope) : null,
          evidenceEnvelope:  envelope
        };

        // Only include if meets threshold (or is mainUser which has low bar)
        if (confModel.confidenceScore >= threshold || scaleKey === 'mainUser') {
          allRecommendations[scaleKey].push(recommendation);
        }
      }

      allConflicts = allConflicts.concat(translationOutput.conflicts);

      // Store analogue for future retrieval
      if (window.LIMENEvidenceBuilder) {
        window.LIMENEvidenceBuilder.storeAnalogue(pattern, nodeStates, feedSources, propagationResult);
      }
    }

    // ── Cap per-scale maximums ────────────────────────────────────────────
    for (var sc = 0; sc < SCALES.length; sc++) {
      var s = SCALES[sc];
      allRecommendations[s].sort(function (a, b) { return b.urgency - a.urgency; });
      allRecommendations[s] = allRecommendations[s].slice(0, MAX_ACTIVE[s]);
    }

    // ── Assemble recommendation set ──────────────────────────────────────
    return {
      generatedAt:  Date.now(),
      feedSnapshot: _hash(JSON.stringify(feedSources || '')),
      mainUser:     allRecommendations.mainUser,
      portalUser:   allRecommendations.portalUser,
      business:     allRecommendations.business,
      domain:       allRecommendations.domain,
      civilization: allRecommendations.civilization,
      conflicts:    allConflicts
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Recommendation Lifecycle (docs/57)
  // ═══════════════════════════════════════════════════════════════════════════

  var _activeRecommendations = {};  // id → recommendation

  function activate(recommendation) {
    recommendation.state = 'ACTIVE';
    _activeRecommendations[recommendation.id] = recommendation;
    return recommendation;
  }

  function confirm(recommendationId) {
    var rec = _activeRecommendations[recommendationId];
    if (rec) rec.state = 'CONFIRMED';
    return rec || null;
  }

  function act(recommendationId) {
    var rec = _activeRecommendations[recommendationId];
    if (rec) rec.state = 'ACTED';
    return rec || null;
  }

  function expire(recommendationId) {
    var rec = _activeRecommendations[recommendationId];
    if (rec) {
      rec.state = 'EXPIRED';
      delete _activeRecommendations[recommendationId];
    }
    return rec || null;
  }

  function supersede(recommendationId, newRecommendation) {
    var old = _activeRecommendations[recommendationId];
    if (old) {
      old.state = 'SUPERSEDED';
      delete _activeRecommendations[recommendationId];
    }
    return activate(newRecommendation);
  }

  function getActive() {
    return Object.assign({}, _activeRecommendations);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _emptySet() {
    return {
      generatedAt:  Date.now(),
      feedSnapshot: '',
      mainUser:     [],
      portalUser:   [],
      business:     [],
      domain:       [],
      civilization: [],
      conflicts:    []
    };
  }

  function _buildSourceSignals(feedSources) {
    if (!feedSources) {
      var domains = window.LIMENDomains || {};
      var signals = [];
      var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
      for (var i = 0; i < DOMAIN_KEYS.length; i++) {
        var dk = DOMAIN_KEYS[i];
        var d = domains[dk];
        if (d && d.stress > 0.3) {
          signals.push({
            feedName: dk.charAt(0).toUpperCase() + dk.slice(1),
            domain: dk,
            stress: d.stress,
            live: d.confidence > 0.5,
            fetchedAt: d.updated || Date.now()
          });
        }
      }
      return signals;
    }
    return feedSources.map(function (f) {
      return {
        feedName:  f.feedName || f.feedId || 'unknown',
        domain:    f.domain || '',
        stress:    f.stress || 0,
        live:      f.live != null ? f.live : true,
        fetchedAt: f.fetchedAt || Date.now()
      };
    });
  }

  function _buildContraindications(resolverResult) {
    if (!resolverResult) return [];
    var contras = [];
    var remedies = resolverResult.selectedRemedies || [];
    for (var i = 0; i < remedies.length; i++) {
      var warnings = remedies[i].softWarnings || [];
      for (var w = 0; w < warnings.length; w++) {
        if (contras.indexOf(warnings[w]) < 0) contras.push(warnings[w]);
      }
    }
    return contras;
  }

  function _inferDominantPhase(affectedNodes) {
    // Reverse-map nodes to phases (from signal-router PHASE_NODES)
    var PHASE_NODES = {
      0:  [1, 2, 3, 7, 106],
      1:  [8, 9, 10, 52],
      2:  [20, 21, 22, 23, 73],
      3:  [6, 17, 18, 19, 59],
      4:  [12, 13, 15, 55],
      5:  [16, 69, 70],
      6:  [40, 41, 42, 43, 57],
      7:  [31, 32, 33, 96],
      8:  [92, 93, 75],
      9:  [1, 2, 5, 105],
      10: [3, 84, 97]
    };

    var phaseCounts = {};
    for (var phase in PHASE_NODES) {
      if (!PHASE_NODES.hasOwnProperty(phase)) continue;
      var nodes = PHASE_NODES[phase];
      var count = 0;
      for (var i = 0; i < affectedNodes.length; i++) {
        if (nodes.indexOf(affectedNodes[i]) >= 0) count++;
      }
      if (count > 0) phaseCounts[phase] = count;
    }

    var bestPhase = 0;
    var bestCount = 0;
    for (var p in phaseCounts) {
      if (phaseCounts[p] > bestCount) {
        bestCount = phaseCounts[p];
        bestPhase = Number(p);
      }
    }
    return bestPhase;
  }

  /**
   * Map an evidence envelope to a backward-compatible evidenceChain.
   * The evidenceChain is preserved per docs/60 §3.5.
   */
  function _envelopeToChain(envelope) {
    var cs = envelope.currentState;
    if (!cs) return null;

    var feeds = (cs.feedSnapshot || []).map(function (f) {
      return { name: f.feedName, value: f.value, stress: f.stress, fetchedAt: f.fetchedAt, live: f.live };
    });

    var seeds = {};
    var nodeSnap = cs.nodeSnapshot || [];
    for (var i = 0; i < nodeSnap.length; i++) {
      if (nodeSnap[i].seedSource) {
        seeds[nodeSnap[i].nodeId] = nodeSnap[i].activation;
      }
    }

    return {
      feeds: feeds,
      seeds: seeds,
      propagation: cs.propagationSnapshot || {},
      patterns: cs.patternSnapshot || {},
      scaleTranslation: { fromPattern: '', toScale: '', actionCount: 0 }
    };
  }

  function _hash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 8);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENRecommendationEngine = {
    // Core pipeline
    generate:        generate,
    detectPatterns:  detectPatterns,

    // Lifecycle
    activate:  activate,
    confirm:   confirm,
    act:       act,
    expire:    expire,
    supersede: supersede,
    getActive: getActive,

    // Expose for testing
    _CONFIDENCE_THRESHOLDS: CONFIDENCE_THRESHOLDS,
    _MAX_ACTIVE:            MAX_ACTIVE,
    _URGENCY_DECAY:         URGENCY_DECAY,
    _PATTERN_CLASSES:       PATTERN_CLASSES
  };

})();
