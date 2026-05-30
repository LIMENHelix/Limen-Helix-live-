/**
 * LIMEN Recommendation Runtime — Evidence Builder
 *
 * Constructs EvidenceEnvelope objects that wrap every recommendation in
 * three temporal classes of support: historical, current, projected.
 *
 * Implements:
 *   docs/60 §1  — EvidenceEnvelope + TemporalBalance
 *   docs/60 §2  — Historical evidence (pattern analogue store + retrieval)
 *   docs/60 §3  — Current-state evidence (feed + node + propagation snapshots)
 *   docs/60 §4  — Projected evidence (4 projection methods)
 *   docs/60 §5  — Confidence aggregation + uncertainty statement generation
 *
 * Depends on:
 *   window.LIMENDomains          — domain stress data
 *   window.LIMENGlobalState      — global state mode
 *   window.LIMENAnalogueStore    — runtime analogue archive (created here if absent)
 *
 * Exposes:  window.LIMENEvidenceBuilder
 *
 * Schema contracts (locked):
 *   evidence-schema.json   — evidenceEnvelope, all sub-types
 *   recommendation-schema  — urgencyDecay λ values (reused for projection decay)
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants — exact from locked schemas
  // ═══════════════════════════════════════════════════════════════════════════

  var CONFIDENCE_TIERS = { high: 0.75, moderate: 0.55, low: 0.40 };

  var RELEVANCE_WEIGHTS = { similarity: 0.40, recency: 0.30, outcomeClarity: 0.30 };

  var RECENCY_HALFLIFE_HOURS = 2160; // 90 days

  var PROJECTION_DECAY = {
    immediate: 0.50, short: 0.20, medium: 0.08, long: 0.03, structural: 0.01
  };

  var PROJECTION_EXPIRATION = 0.10;

  var ANOMALY_THRESHOLD = 0.40;

  var SPECULATIVE_THRESHOLD = 0.50;

  var MAX_ANALOGUES = 10;

  var MIN_RELEVANCE = 0.15;

  var ADJACENCY_PENALTY = 0.70;

  var CONFIDENCE_COLORS = {
    high: '#4CAF50', moderate: '#FF9800', low: '#F44336', insufficient: '#9E9E9E'
  };

  var CONFIDENCE_ICONS = {
    high: 'shield-check', moderate: 'shield-half', low: 'shield-alert', insufficient: 'shield-off'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Analogue Store — in-memory + localStorage persistence (docs/60 §2.4, §6.3)
  // ═══════════════════════════════════════════════════════════════════════════

  var STORAGE_KEY = 'LIMENAnalogues';

  function _loadStore() {
    if (window.LIMENAnalogueStore && Array.isArray(window.LIMENAnalogueStore)) {
      return window.LIMENAnalogueStore;
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          window.LIMENAnalogueStore = parsed;
          return parsed;
        }
      }
    } catch (e) { /* silent */ }
    window.LIMENAnalogueStore = [];
    return window.LIMENAnalogueStore;
  }

  function _saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.LIMENAnalogueStore || []));
    } catch (e) { /* quota exceeded — silent */ }
  }

  /**
   * Store a pattern analogue after a propagation cycle (docs/60 §2.4).
   */
  function storeAnalogue(pattern, nodeStates, feedSnapshot, propagationResult) {
    var store = _loadStore();
    var now = Date.now();
    var id = 'pa-' + _hash(pattern.patternClass + now);

    var matchedNodes = pattern.affectedNodes || [];
    var peakAct = 0;
    for (var i = 0; i < matchedNodes.length; i++) {
      var ns = nodeStates[matchedNodes[i]];
      if (ns && ns.activation > peakAct) peakAct = ns.activation;
    }

    var feedCtx = [];
    if (feedSnapshot && feedSnapshot.length) {
      for (var f = 0; f < feedSnapshot.length; f++) {
        var fs = feedSnapshot[f];
        feedCtx.push({
          feedName:    fs.feedName || fs.feedId || 'unknown',
          stressAtTime: fs.stress || 0,
          domain:      fs.domain || ''
        });
      }
    }

    var analogue = {
      id: id,
      patternClass: pattern.patternClass,
      timestamp: now,
      age: 'just now',
      similarity: 1.0,  // self-similarity
      matchedNodes: matchedNodes,
      matchedSystems: pattern.affectedSystems || [],
      directionMatch: true,
      dominantDirection: pattern.dominantDirection || 'hyper',
      feedContext: feedCtx,
      outcome: {
        convergenceAchieved: propagationResult ? (propagationResult.converged || false) : false,
        peakActivation: peakAct,
        recoverySteps: propagationResult ? (propagationResult.convergenceStep || null) : null,
        remedyApplied: null,
        remedyEffectiveness: null,
        narrative: ''
      },
      relevanceScore: 1.0,
      // Store activation vector for similarity computation
      _activationVector: _extractVector(nodeStates, matchedNodes)
    };

    store.push(analogue);
    window.LIMENAnalogueStore = store;
    _saveStore();
    return analogue;
  }

  /**
   * Back-fill remedy outcome on a stored analogue (docs/60 §2.4).
   */
  function backfillRemedyOutcome(analogueId, remedyId, effectiveness) {
    var store = _loadStore();
    for (var i = 0; i < store.length; i++) {
      if (store[i].id === analogueId) {
        store[i].outcome.remedyApplied = remedyId;
        store[i].outcome.remedyEffectiveness = effectiveness;
        _saveStore();
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analogue retrieval (docs/60 §2.3)
  // ═══════════════════════════════════════════════════════════════════════════

  function _extractVector(nodeStates, nodeIds) {
    var vec = {};
    for (var i = 0; i < nodeIds.length; i++) {
      var ns = nodeStates[nodeIds[i]];
      vec[nodeIds[i]] = ns ? (ns.activation || 0) : 0;
    }
    return vec;
  }

  function _cosineSimilarity(vecA, vecB) {
    var dot = 0, magA = 0, magB = 0;
    var allKeys = {};
    var k;
    for (k in vecA) if (vecA.hasOwnProperty(k)) allKeys[k] = true;
    for (k in vecB) if (vecB.hasOwnProperty(k)) allKeys[k] = true;
    for (k in allKeys) {
      var a = vecA[k] || 0;
      var b = vecB[k] || 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function retrieveAnalogues(currentPattern, nodeStates, adjacentPatterns) {
    var store = _loadStore();
    var now = Date.now();
    var currentVector = _extractVector(nodeStates, currentPattern.affectedNodes || []);
    adjacentPatterns = adjacentPatterns || [];

    var candidates = [];

    for (var i = 0; i < store.length; i++) {
      var a = store[i];
      var isExact = a.patternClass === currentPattern.patternClass;
      var isAdjacent = adjacentPatterns.indexOf(a.patternClass) >= 0;
      if (!isExact && !isAdjacent) continue;

      // Compute similarity
      var sim = a._activationVector
        ? _cosineSimilarity(currentVector, a._activationVector)
        : 0.3; // default if no stored vector

      // Compute recency decay
      var ageHours = (now - a.timestamp) / 3600000;
      var recency = Math.exp(-ageHours / RECENCY_HALFLIFE_HOURS);

      // Outcome clarity
      var outcomeClarity = a.outcome && a.outcome.narrative ? 1.0 : 0.3;

      // Adjacency penalty
      var penalty = isAdjacent && !isExact ? ADJACENCY_PENALTY : 1.0;

      var relevance = (sim * RELEVANCE_WEIGHTS.similarity
                     + recency * RELEVANCE_WEIGHTS.recency
                     + outcomeClarity * RELEVANCE_WEIGHTS.outcomeClarity)
                     * penalty;

      // Update age string
      var ageDays = Math.floor(ageHours / 24);
      var ageStr;
      if (ageDays === 0) ageStr = 'today';
      else if (ageDays === 1) ageStr = 'yesterday';
      else if (ageDays < 30) ageStr = ageDays + ' days ago';
      else if (ageDays < 365) ageStr = Math.floor(ageDays / 30) + ' months ago';
      else ageStr = Math.floor(ageDays / 365) + ' years ago';

      candidates.push({
        id: a.id,
        patternClass: a.patternClass,
        timestamp: a.timestamp,
        age: ageStr,
        similarity: Math.round(sim * 1000) / 1000,
        matchedNodes: a.matchedNodes,
        matchedSystems: a.matchedSystems,
        directionMatch: a.dominantDirection === currentPattern.dominantDirection,
        feedContext: a.feedContext || [],
        outcome: a.outcome,
        relevanceScore: Math.round(relevance * 1000) / 1000
      });
    }

    // Filter and sort
    candidates = candidates.filter(function (c) { return c.relevanceScore > MIN_RELEVANCE; });
    candidates.sort(function (a, b) { return b.relevanceScore - a.relevanceScore; });
    return candidates.slice(0, MAX_ANALOGUES);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Coverage grade (docs/60 §2.1)
  // ═══════════════════════════════════════════════════════════════════════════

  function _coverageGrade(count) {
    if (count >= 5) return 'rich';
    if (count >= 2) return 'moderate';
    if (count >= 1) return 'sparse';
    return 'none';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Historical evidence assembly
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildHistorical(pattern, nodeStates) {
    var adjacentPatterns = [];
    // Import adjacent patterns from remedy-resolver if available
    if (window.LIMENRemedyResolver && window.LIMENRemedyResolver._ADJACENT_PATTERNS) {
      adjacentPatterns = window.LIMENRemedyResolver._ADJACENT_PATTERNS[pattern.patternClass] || [];
    }

    var analogues = retrieveAnalogues(pattern, nodeStates, adjacentPatterns);
    var count = analogues.length;
    var grade = _coverageGrade(count);

    // Generate summary narrative
    var narrative = '';
    if (count === 0) {
      narrative = 'No historical precedent for this pattern.';
    } else if (count === 1) {
      narrative = 'One prior occurrence of similar ' + pattern.patternClass.replace(/_/g, ' ')
                + ' pattern (' + analogues[0].age + ').';
    } else {
      var topAge = analogues[0].age;
      var converged = analogues.filter(function (a) { return a.outcome && a.outcome.convergenceAchieved; }).length;
      narrative = count + ' prior occurrences of similar ' + pattern.patternClass.replace(/_/g, ' ')
                + ' pattern. Most recent: ' + topAge + '. '
                + converged + '/' + count + ' converged.';
    }

    return {
      analogueCount: count,
      analogues: analogues,
      coverageGrade: grade,
      summaryNarrative: narrative
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Current-state evidence assembly (docs/60 §3)
  // ═══════════════════════════════════════════════════════════════════════════

  function _staleness(fetchedAt) {
    if (!fetchedAt) return 'expired';
    var age = Date.now() - fetchedAt;
    if (age < 30000) return 'fresh';
    if (age < 300000) return 'recent';
    if (age < 1800000) return 'stale';
    return 'expired';
  }

  function _buildFeedSnapshot(feedSources) {
    if (!feedSources || !feedSources.length) {
      // Try to build from window.LIMENDomains
      var domains = window.LIMENDomains || {};
      var snapshot = [];
      var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
      for (var i = 0; i < DOMAIN_KEYS.length; i++) {
        var dk = DOMAIN_KEYS[i];
        var d = domains[dk];
        if (!d) continue;
        snapshot.push({
          feedId:        dk,
          feedName:      dk.charAt(0).toUpperCase() + dk.slice(1),
          domain:        dk,
          value:         d.stress || 0,
          stress:        d.stress || 0,
          live:          d.confidence > 0.5,
          fetchedAt:     d.updated || Date.now(),
          staleness:     _staleness(d.updated),
          trend:         d.trend > 0.03 ? 'rising' : (d.trend < -0.03 ? 'declining' : 'stable'),
          trendWindow:   'last cycle',
          contributesTo: []  // Would need signal-router mapping
        });
      }
      return snapshot;
    }
    return feedSources.map(function (fs) {
      return {
        feedId:        fs.feedId || fs.feedName || 'unknown',
        feedName:      fs.feedName || fs.feedId || 'unknown',
        domain:        fs.domain || '',
        value:         fs.value != null ? fs.value : fs.stress,
        stress:        fs.stress || 0,
        live:          fs.live != null ? fs.live : true,
        fetchedAt:     fs.fetchedAt || Date.now(),
        staleness:     _staleness(fs.fetchedAt),
        trend:         fs.trend || null,
        trendWindow:   fs.trendWindow || null,
        contributesTo: fs.contributesTo || []
      };
    });
  }

  function _buildNodeSnapshot(affectedNodes, nodeStates) {
    var snapshot = [];
    for (var i = 0; i < affectedNodes.length; i++) {
      var nid = affectedNodes[i];
      var ns = nodeStates[nid] || {};
      var predErr = ns.predictionError || 0;
      snapshot.push({
        nodeId:          nid,
        nodeLabel:       ns.label || ('N' + nid),
        system:          ns.system || 'unknown',
        activation:      ns.activation || 0,
        direction:       ns.direction || 'silent',
        predictionError: predErr,
        salience:        ns.salience || 0,
        activationMean:  ns.activationMean || 0,
        activationVar:   ns.activationVar || 0,
        isAnomaly:       Math.abs(predErr) > ANOMALY_THRESHOLD,
        seedSource:      ns.seedSource || null
      });
    }
    return snapshot;
  }

  function _buildDataQuality(feedSnapshot) {
    var live = 0;
    var total = feedSnapshot.length;
    var staleFeeds = [];
    var fallbackFeeds = [];
    for (var i = 0; i < feedSnapshot.length; i++) {
      var f = feedSnapshot[i];
      if (f.live) live++;
      else fallbackFeeds.push(f.feedId);
      if (f.staleness === 'stale' || f.staleness === 'expired') {
        staleFeeds.push(f.feedId);
      }
    }
    var ratio = total > 0 ? live / total : 0;
    var grade;
    if (ratio >= 1.0) grade = 'full';
    else if (ratio >= 0.80) grade = 'high';
    else if (ratio >= 0.50) grade = 'degraded';
    else grade = 'poor';

    var statement = live + '/' + total + ' feeds live';
    if (staleFeeds.length > 0) {
      statement += '. ' + staleFeeds.length + ' stale: ' + staleFeeds.join(', ');
    }
    if (fallbackFeeds.length > 0) {
      statement += '. ' + fallbackFeeds.length + ' on fallback: ' + fallbackFeeds.join(', ');
    }

    return {
      liveSourceCount:  live,
      totalSourceCount: total,
      liveRatio:        Math.round(ratio * 1000) / 1000,
      qualityGrade:     grade,
      staleFeeds:       staleFeeds,
      fallbackFeeds:    fallbackFeeds,
      qualityStatement: statement
    };
  }

  function _buildCurrentState(pattern, nodeStates, feedSources, propagationResult) {
    var feedSnapshot = _buildFeedSnapshot(feedSources);

    // If no affected nodes from pattern, synthesize from live domain stress
    var affectedNodes = (pattern && pattern.affectedNodes) || [];
    if (affectedNodes.length === 0 && (!nodeStates || Object.keys(nodeStates).length === 0)) {
      nodeStates = {};
      var liveDoms = window.LIMENDomains || {};
      var DK = Object.keys(liveDoms);
      for (var di = 0; di < DK.length; di++) {
        var dd = liveDoms[DK[di]];
        if (dd && dd.stress > 0.2) {
          var nid = DK[di];
          affectedNodes.push(nid);
          nodeStates[nid] = {
            label: nid.charAt(0).toUpperCase() + nid.slice(1),
            system: 'domain',
            activation: dd.stress,
            direction: dd.trend > 0.03 ? 'hyper' : (dd.trend < -0.03 ? 'hypo' : 'active'),
            salience: dd.stress,
            seedSource: 'domain-signal-engine'
          };
        }
      }
    }

    var nodeSnapshot = _buildNodeSnapshot(affectedNodes, nodeStates);
    var dataQuality = _buildDataQuality(feedSnapshot);

    var propSnap = {
      steps:            (propagationResult && propagationResult.steps) || 0,
      convergenceStep:  (propagationResult && propagationResult.convergenceStep) || null,
      converged:        (propagationResult && propagationResult.converged) || false,
      finalActivations: (propagationResult && propagationResult.activations) || {},
      hyperNodes:       (propagationResult && propagationResult.hyper) || [],
      hypoNodes:        (propagationResult && propagationResult.hypo) || []
    };

    var patSnap = {
      patternClass:         pattern.patternClass,
      hotClusters:          (pattern.hotClusters && pattern.hotClusters.length) || 0,
      coldGaps:             (pattern.coldGaps && pattern.coldGaps.length) || 0,
      predictionViolations: (pattern.predictionViolations && pattern.predictionViolations.length) || 0,
      oscillatingNodes:     (pattern.oscillatingNodes && pattern.oscillatingNodes.length) || 0
    };

    var now = Date.now();
    var newestFetch = 0;
    for (var i = 0; i < feedSnapshot.length; i++) {
      if (feedSnapshot[i].fetchedAt > newestFetch) newestFetch = feedSnapshot[i].fetchedAt;
    }

    return {
      feedSnapshot:        feedSnapshot,
      nodeSnapshot:        nodeSnapshot,
      propagationSnapshot: propSnap,
      patternSnapshot:     patSnap,
      dataQuality:         dataQuality,
      observedAt:          now,
      freshnessMs:         newestFetch > 0 ? (now - newestFetch) : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Projected evidence (docs/60 §4)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Method 1: Trend extrapolation (docs/60 §4.3)
   */
  function _trendProjection(feedSnapshot) {
    if (!feedSnapshot || feedSnapshot.length === 0) return null;

    var domainTrajectories = {};
    var allTrajectories = [];
    for (var i = 0; i < feedSnapshot.length; i++) {
      var f = feedSnapshot[i];
      if (!f.domain || !f.trend) continue;
      var traj;
      if (f.trend === 'rising' && f.stress > 0.5) {
        traj = 'escalating';
      } else if (f.trend === 'declining' && f.stress > 0.3) {
        traj = 'recovering';
      } else if (f.trend === 'stable') {
        traj = 'stabilizing';
      } else {
        traj = 'uncertain';
      }
      domainTrajectories[f.domain] = traj;
      allTrajectories.push(traj);
    }

    if (allTrajectories.length === 0) return null;

    // Simple confidence from trend consistency
    var trajCounts = {};
    for (var t = 0; t < allTrajectories.length; t++) {
      trajCounts[allTrajectories[t]] = (trajCounts[allTrajectories[t]] || 0) + 1;
    }
    var maxCount = 0;
    var dominantTraj = 'uncertain';
    for (var key in trajCounts) {
      if (trajCounts[key] > maxCount) {
        maxCount = trajCounts[key];
        dominantTraj = key;
      }
    }
    var consistency = maxCount / allTrajectories.length;
    var confidence;
    if (dominantTraj === 'stabilizing') confidence = 0.7 * consistency;
    else if (dominantTraj === 'escalating') confidence = 0.6 * consistency;
    else if (dominantTraj === 'recovering') confidence = 0.5 * consistency;
    else confidence = 0.3;

    return {
      trajectory: dominantTraj,
      confidence: Math.round(confidence * 1000) / 1000,
      method: 'trend_extrapolation',
      stressTrajectory: domainTrajectories,
      trendWindow: 'last cycle'
    };
  }

  /**
   * Method 2: Pattern analogue projection (docs/60 §4.3)
   */
  function _analogueProjection(analogues) {
    if (!analogues || analogues.length === 0) return null;

    var top = analogues[0];
    var trajectory, hypothesis, confidence;

    if (top.outcome && top.outcome.convergenceAchieved) {
      var steps = top.outcome.recoverySteps || 'unknown';
      hypothesis = 'Pattern likely stabilizes within ' + steps + ' steps based on prior analogue';
      trajectory = 'stabilizing';
      confidence = top.relevanceScore * 0.8;
    } else {
      hypothesis = 'Pattern may escalate — did not converge in past analogue';
      trajectory = 'escalating';
      confidence = top.relevanceScore * 0.6;
    }

    if (top.outcome && top.outcome.remedyApplied && top.outcome.remedyEffectiveness > 0.5) {
      hypothesis += '. Previous remedy was effective (score: ' + top.outcome.remedyEffectiveness + ')';
    }

    return {
      trajectory: trajectory,
      confidence: Math.round(confidence * 1000) / 1000,
      method: 'pattern_analogue',
      hypothesis: hypothesis,
      analogueIds: [top.id]
    };
  }

  /**
   * Method 3: Propagation forward simulation (docs/60 §4.3)
   * Simplified: uses current activation trends rather than re-running propagation.
   */
  function _forwardProjection(pattern, nodeStates, propagationResult) {
    if (!propagationResult || !propagationResult.activations) return null;

    var affectedNodes = pattern.affectedNodes || [];
    if (affectedNodes.length === 0) return null;

    var currentTotal = 0;
    var shifts = {};
    for (var i = 0; i < affectedNodes.length; i++) {
      var nid = affectedNodes[i];
      var act = propagationResult.activations[nid] || 0;
      currentTotal += act;
      // Estimate future delta from prediction error
      var ns = nodeStates[nid];
      var predErr = ns ? (ns.predictionError || 0) : 0;
      shifts[nid] = Math.round(predErr * 0.5 * 1000) / 1000; // Half the error as projected shift
    }

    var futureTotal = currentTotal;
    for (var k in shifts) {
      if (shifts.hasOwnProperty(k)) {
        futureTotal += shifts[k];
      }
    }

    var trajectory;
    if (futureTotal < currentTotal * 0.8) trajectory = 'stabilizing';
    else if (futureTotal > currentTotal * 1.2) trajectory = 'escalating';
    else trajectory = 'oscillating';

    var stability = propagationResult.converged ? 0.7 : 0.3;
    var confidence = stability * 0.7;

    return {
      trajectory: trajectory,
      confidence: Math.round(confidence * 1000) / 1000,
      method: 'propagation_forward',
      activationShift: shifts,
      propagationSteps: 6
    };
  }

  /**
   * Method 4: Composite (docs/60 §4.3)
   */
  function _compositeProjection(methods) {
    var available = methods.filter(function (m) { return m != null; });
    if (available.length === 0) {
      return {
        trajectory: 'uncertain',
        confidence: 0.1,
        method: 'composite'
      };
    }

    var trajectories = available.map(function (m) { return m.trajectory; });
    var confidences = available.map(function (m) { return m.confidence; });
    var meanConf = 0;
    for (var i = 0; i < confidences.length; i++) meanConf += confidences[i];
    meanConf /= confidences.length;

    // Check consensus
    var allSame = trajectories.every(function (t) { return t === trajectories[0]; });
    var counts = {};
    for (var j = 0; j < trajectories.length; j++) {
      counts[trajectories[j]] = (counts[trajectories[j]] || 0) + 1;
    }
    var majorityTraj = null;
    for (var key in counts) {
      if (counts[key] > trajectories.length / 2) majorityTraj = key;
    }

    var consensus, confidence;
    if (allSame) {
      consensus = trajectories[0];
      confidence = Math.min(1.0, meanConf * 1.15);
    } else if (majorityTraj) {
      consensus = majorityTraj;
      confidence = meanConf;
    } else {
      consensus = 'uncertain';
      confidence = Math.min.apply(null, confidences) * 0.7;
    }

    return {
      trajectory: consensus,
      confidence: Math.round(confidence * 1000) / 1000,
      method: 'composite',
      derivedMethods: available.map(function (m) { return m.method; })
    };
  }

  function _buildProjected(pattern, nodeStates, feedSnapshot, propagationResult, historical) {
    // Generate projections from all 4 methods
    var trendProj = _trendProjection(feedSnapshot);
    var analogueProj = _analogueProjection(historical.analogues);
    var forwardProj = _forwardProjection(pattern, nodeStates, propagationResult);
    var compositeProj = _compositeProjection([trendProj, analogueProj, forwardProj]);

    // Build projection objects
    var projections = [];
    var now = Date.now();

    if (compositeProj && compositeProj.confidence > 0.05) {
      var affectedDomains = [];
      if (feedSnapshot) {
        var seen = {};
        for (var f = 0; f < feedSnapshot.length; f++) {
          var dom = feedSnapshot[f].domain;
          if (dom && !seen[dom]) {
            seen[dom] = true;
            affectedDomains.push(dom);
          }
        }
      }

      var uncertaintySources = [];
      if (historical.coverageGrade === 'none') uncertaintySources.push('No historical precedent');
      if (historical.coverageGrade === 'sparse') uncertaintySources.push('Limited historical data');
      if (propagationResult && !propagationResult.converged) uncertaintySources.push('Propagation did not converge');

      // Check feed quality
      var staleCount = 0;
      if (feedSnapshot) {
        for (var s = 0; s < feedSnapshot.length; s++) {
          if (feedSnapshot[s].staleness === 'stale' || feedSnapshot[s].staleness === 'expired') staleCount++;
        }
      }
      if (staleCount > 0) uncertaintySources.push(staleCount + ' feeds stale or expired');

      var hypothesis = '';
      if (analogueProj && analogueProj.hypothesis) {
        hypothesis = analogueProj.hypothesis;
      } else {
        hypothesis = 'Pattern trajectory appears ' + compositeProj.trajectory + ' based on available evidence';
      }

      projections.push({
        id: 'proj-' + _hash(pattern.patternClass + now),
        hypothesis: hypothesis,
        trajectory: compositeProj.trajectory,
        timeHorizon: pattern.timeHorizon || 'short',
        affectedNodes: pattern.affectedNodes || [],
        affectedDomains: affectedDomains,
        projectedState: {
          activationShift:  (forwardProj && forwardProj.activationShift) || {},
          directionShift:   {},
          stressTrajectory: (trendProj && trendProj.stressTrajectory) || {}
        },
        confidence: compositeProj.confidence,
        confidenceTier: _tierFromScore(compositeProj.confidence),
        confidenceBasis: _buildConfidenceBasis(trendProj, analogueProj, forwardProj),
        uncertainty: {
          magnitude: Math.round((1 - compositeProj.confidence) * 1000) / 1000,
          sources: uncertaintySources.length > 0 ? uncertaintySources : ['Standard projection uncertainty'],
          bounds: {
            optimistic: 'Pattern resolves faster than projected',
            pessimistic: 'Pattern intensifies beyond current trajectory'
          }
        },
        method: compositeProj.method,
        derivedFrom: {
          analogueIds: (analogueProj && analogueProj.analogueIds) || [],
          trendWindow: (trendProj && trendProj.trendWindow) || null,
          propagationSteps: (forwardProj && forwardProj.propagationSteps) || null
        }
      });
    }

    // Build method statement
    var methods = [];
    if (trendProj) methods.push('trend extrapolation');
    if (analogueProj) methods.push('pattern analogue (' + (historical.analogues.length) + ' analogues)');
    if (forwardProj) methods.push('forward propagation simulation');
    var methodStatement = methods.length > 0
      ? 'Composite from: ' + methods.join(' + ')
      : 'No projection methods available';

    return {
      projections: projections,
      projectionCount: projections.length,
      dominantTrajectory: compositeProj ? compositeProj.trajectory : 'uncertain',
      projectionHorizon: pattern.timeHorizon || 'short',
      methodStatement: methodStatement
    };
  }

  function _buildConfidenceBasis(trend, analogue, forward) {
    var parts = [];
    if (trend) parts.push('trend (' + trend.confidence.toFixed(2) + ')');
    if (analogue) parts.push('analogue (' + analogue.confidence.toFixed(2) + ')');
    if (forward) parts.push('forward sim (' + forward.confidence.toFixed(2) + ')');
    return parts.length > 0 ? parts.join(', ') : 'no methods available';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Confidence aggregation (docs/60 §5.2)
  // ═══════════════════════════════════════════════════════════════════════════

  function _tierFromScore(score) {
    if (score >= CONFIDENCE_TIERS.high) return 'high';
    if (score >= CONFIDENCE_TIERS.moderate) return 'moderate';
    if (score >= CONFIDENCE_TIERS.low) return 'low';
    return 'insufficient';
  }

  function _computeOverallConfidence(historical, currentState, projected) {
    // Historical confidence
    var histConf = 0;
    if (historical.analogueCount >= 5) {
      var top5 = historical.analogues.slice(0, 5);
      for (var i = 0; i < top5.length; i++) histConf += top5[i].relevanceScore;
      histConf /= top5.length;
    } else if (historical.analogueCount > 0) {
      for (var j = 0; j < historical.analogues.length; j++) histConf += historical.analogues[j].relevanceScore;
      histConf = (histConf / historical.analogues.length) * 0.7;
    }

    // Current confidence
    var dq = currentState.dataQuality;
    var converged = currentState.propagationSnapshot.converged;
    var hotClusters = currentState.patternSnapshot.hotClusters;
    var currConf = (dq.liveRatio * 0.5)
                 + (converged ? 0.3 : 0.1)
                 + (hotClusters > 0 ? 0.2 : 0.05);

    // Projected confidence
    var projConf = 0;
    if (projected.projectionCount > 0) {
      for (var k = 0; k < projected.projections.length; k++) {
        if (projected.projections[k].confidence > projConf) {
          projConf = projected.projections[k].confidence;
        }
      }
    }

    // Weighted combination
    var hasHist = histConf > 0;
    var hasProj = projConf > 0;
    var overall, balance;

    if (hasHist && hasProj) {
      overall = histConf * 0.30 + currConf * 0.45 + projConf * 0.25;
      balance = { historicalWeight: 0.30, currentWeight: 0.45, projectedWeight: 0.25 };
    } else if (hasHist) {
      overall = histConf * 0.35 + currConf * 0.65;
      balance = { historicalWeight: 0.35, currentWeight: 0.65, projectedWeight: 0 };
    } else if (hasProj) {
      overall = currConf * 0.60 + projConf * 0.40;
      balance = { historicalWeight: 0, currentWeight: 0.60, projectedWeight: 0.40 };
    } else {
      overall = currConf;
      balance = { historicalWeight: 0, currentWeight: 1.0, projectedWeight: 0 };
    }

    // Determine dominant class
    var maxW = balance.currentWeight;
    var dominant = 'current';
    if (balance.historicalWeight > maxW) { maxW = balance.historicalWeight; dominant = 'historical'; }
    if (balance.projectedWeight > maxW) { dominant = 'projected'; }
    balance.dominantClass = dominant;

    return {
      overall: Math.round(overall * 1000) / 1000,
      balance: balance
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Uncertainty statement generation (docs/60 §5.4)
  // ═══════════════════════════════════════════════════════════════════════════

  function _generateUncertaintyStatement(historical, currentState, projected, balance) {
    var parts = [];

    // Data quality
    if (currentState.dataQuality.qualityGrade !== 'full') {
      parts.push(currentState.dataQuality.qualityStatement);
    }

    // Historical coverage
    if (historical.coverageGrade === 'none') {
      parts.push('No historical precedent for this pattern');
    } else if (historical.coverageGrade === 'sparse') {
      parts.push('Limited historical data (1 prior occurrence)');
    } else if (historical.coverageGrade === 'moderate') {
      parts.push('Some historical precedent (' + historical.analogueCount + ' prior occurrences)');
    }

    // Projection disagreement
    if (projected.projectionCount > 1) {
      var trajectories = {};
      for (var i = 0; i < projected.projections.length; i++) {
        trajectories[projected.projections[i].trajectory] = true;
      }
      var unique = Object.keys(trajectories);
      if (unique.length > 1) {
        parts.push('Projection methods disagree: ' + unique.join(' vs '));
      }
    }

    // Temporal balance warning
    if (balance.projectedWeight > SPECULATIVE_THRESHOLD) {
      parts.push('This recommendation relies heavily on forward projection rather than observed data');
    }

    // Staleness
    if (currentState.freshnessMs > 300000) {
      var mins = Math.floor(currentState.freshnessMs / 60000);
      parts.push('Current data is ' + mins + ' minutes old');
    }

    if (parts.length === 0) {
      return 'Strong evidence across all temporal classes';
    }
    return parts.join('. ') + '.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Confidence display (docs/60 §5.6)
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildDisplay(overallConf, tier, historical, projected, balance) {
    return {
      tier:  tier,
      color: CONFIDENCE_COLORS[tier] || CONFIDENCE_COLORS.insufficient,
      icon:  CONFIDENCE_ICONS[tier] || CONFIDENCE_ICONS.insufficient,
      barWidth: overallConf,
      temporalDots: {
        historical: historical.analogueCount > 0,
        current:    true,
        projected:  projected.projectionCount > 0
      },
      speculative: balance.projectedWeight > SPECULATIVE_THRESHOLD
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main build entry point
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build an EvidenceEnvelope for a recommendation.
   *
   * @param {Object} opts
   * @param {string} opts.recommendationId      — ID of the recommendation
   * @param {Object} opts.pattern               — { patternClass, affectedNodes, affectedSystems, dominantDirection, timeHorizon, hotClusters, coldGaps, predictionViolations, oscillatingNodes }
   * @param {Object} opts.nodeStates            — { nodeId: { activation, direction, predictionError, ... } }
   * @param {Array}  [opts.feedSources]         — feed evidence items (or null to auto-build from LIMENDomains)
   * @param {Object} [opts.propagationResult]   — { activations, hyper, hypo, steps, convergenceStep, converged }
   * @returns {Object} EvidenceEnvelope per evidence-schema.json
   */
  function build(opts) {
    var recommendationId = opts.recommendationId || 'rec-' + _hash('' + Date.now());
    var pattern          = opts.pattern;
    var nodeStates       = opts.nodeStates || {};
    var feedSources      = opts.feedSources || null;
    var propagationResult = opts.propagationResult || null;

    // Build three temporal classes
    var historical  = _buildHistorical(pattern, nodeStates);
    var currentState = _buildCurrentState(pattern, nodeStates, feedSources, propagationResult);
    var projected   = _buildProjected(pattern, nodeStates, currentState.feedSnapshot, propagationResult, historical);

    // Aggregate confidence
    var confResult = _computeOverallConfidence(historical, currentState, projected);
    var overallConf = confResult.overall;
    var balance = confResult.balance;
    var tier = _tierFromScore(overallConf);

    // Uncertainty statement
    var uncertainty = _generateUncertaintyStatement(historical, currentState, projected, balance);

    // Display indicators
    var display = _buildDisplay(overallConf, tier, historical, projected, balance);

    return {
      recommendationId:    recommendationId,
      generatedAt:         Date.now(),
      historical:          historical,
      currentState:        currentState,
      projected:           projected,
      overallConfidence:   overallConf,
      overallTier:         tier,
      uncertaintyStatement: uncertainty,
      temporalBalance:     balance,
      display:             display
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Archive retention (docs/60 §2.5)
  // ═══════════════════════════════════════════════════════════════════════════

  function pruneAnalogueStore() {
    var store = _loadStore();
    if (store.length === 0) return;

    var now = Date.now();
    var DAY_MS = 86400000;
    var byPattern = {};

    // Group by pattern class
    for (var i = 0; i < store.length; i++) {
      var pc = store[i].patternClass;
      if (!byPattern[pc]) byPattern[pc] = [];
      byPattern[pc].push(store[i]);
    }

    var retained = [];

    for (var pattern in byPattern) {
      if (!byPattern.hasOwnProperty(pattern)) continue;
      var group = byPattern[pattern];
      // Sort by relevance DESC
      group.sort(function (a, b) { return b.relevanceScore - a.relevanceScore; });

      for (var j = 0; j < group.length; j++) {
        var a = group[j];
        var ageDays = (now - a.timestamp) / DAY_MS;

        if (ageDays < 30) {
          retained.push(a); // Keep all < 30d
        } else if (ageDays < 180) {
          if (a.relevanceScore > 0.3 || (a.outcome && a.outcome.remedyEffectiveness != null)) {
            retained.push(a);
          }
        } else if (ageDays < 365) {
          // Keep top 50 per pattern
          var count180 = retained.filter(function (r) { return r.patternClass === pattern && (now - r.timestamp) / DAY_MS >= 180; }).length;
          if (count180 < 50) retained.push(a);
        } else {
          // Keep top 10 per pattern
          var count365 = retained.filter(function (r) { return r.patternClass === pattern && (now - r.timestamp) / DAY_MS >= 365; }).length;
          if (count365 < 10) retained.push(a);
        }
      }
    }

    window.LIMENAnalogueStore = retained;
    _saveStore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utilities
  // ═══════════════════════════════════════════════════════════════════════════

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

  window.LIMENEvidenceBuilder = {
    build:                  build,
    storeAnalogue:          storeAnalogue,
    backfillRemedyOutcome:  backfillRemedyOutcome,
    retrieveAnalogues:      retrieveAnalogues,
    pruneAnalogueStore:     pruneAnalogueStore,
    // Expose for testing
    _tierFromScore:         _tierFromScore,
    _cosineSimilarity:      _cosineSimilarity,
    _staleness:             _staleness
  };

})();
