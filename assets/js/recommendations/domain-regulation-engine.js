/**
 * domain-regulation-engine.js
 * LIMEN HELIX — Domain Regulation Engine
 *
 * Orchestrator: for each domain, assembles the full regulation output
 * by calling PortalTreatmentResolver + FractalTraversalResolver + repair mapper.
 *
 * Two-phase timing:
 *   Phase 1 (immediate): runs with synthetic _LIVE_STRESS diagnoses
 *   Phase 2 (post-harvest): re-runs with real portal diagnoses
 *
 * Exposes: window.LIMENDomainRegulationEngine
 */
(function () {
  'use strict';

  var DOMAINS = [
    'economy', 'energy', 'environment', 'health', 'technology', 'research',
    'supplyChain', 'governance', 'infrastructure', 'agriculture',
    'industry', 'education', 'communication', 'culture',
    'defense', 'religion', 'population', 'law', 'finance', 'intelligence'
  ];

  var URGENCY_THRESHOLDS = {
    critical: 0.85,
    high: 0.65,
    moderate: 0.40,
    low: 0.20,
    minimal: 0
  };

  var DOMAIN_LABELS = {
    economy: 'Economy', energy: 'Energy', environment: 'Environment',
    health: 'Health', technology: 'Technology', research: 'Research',
    supplyChain: 'Supply Chain', governance: 'Governance',
    infrastructure: 'Infrastructure', agriculture: 'Agriculture',
    industry: 'Industry', education: 'Education',
    communication: 'Communication', culture: 'Culture',
    defense: 'Defense', religion: 'Religion',
    population: 'Population', law: 'Law',
    finance: 'Finance', intelligence: 'Intelligence'
  };

  // Edge data cache (loaded from civilization.top.json)
  var _edges = null;
  var _edgesLoading = false;

  // ═══════════════════════════════════════════════════════════════
  // Edge loader
  // ═══════════════════════════════════════════════════════════════

  function _loadEdges(callback) {
    if (_edges) { callback(_edges); return; }
    if (_edgesLoading) {
      setTimeout(function () { _loadEdges(callback); }, 100);
      return;
    }
    _edgesLoading = true;

    // Try to fetch civilization.top.json
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'assets/data/civilization.top.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          _edges = data.edges || [];
        } catch (e) {
          _edges = [];
        }
      } else {
        _edges = [];
      }
      _edgesLoading = false;
      callback(_edges);
    };
    xhr.onerror = function () {
      _edges = [];
      _edgesLoading = false;
      callback(_edges);
    };
    xhr.send();
  }

  // ═══════════════════════════════════════════════════════════════
  // Repair mapper
  // ═══════════════════════════════════════════════════════════════

  function _computeLocalRepair(domainId, stress, treatments) {
    // Estimate direct stress reduction from top treatments
    var reduction = 0;
    for (var i = 0; i < treatments.length; i++) {
      var tx = treatments[i];
      var steps = tx.steps || [];
      // Each concrete step contributes ~5% stress reduction
      var stepReduction = Math.min(steps.length * 0.05, 0.25);
      // Confidence scales the effect
      var conf = tx.confidence || 0.5;
      reduction += stepReduction * conf;
    }
    reduction = Math.min(reduction, stress * 0.6); // Can't reduce more than 60%

    return {
      currentStress: stress,
      projectedStress: Math.max(0, stress - reduction),
      reduction: reduction,
      treatmentCount: treatments.length
    };
  }

  function _computeGlobalRepair(domainId, localRepair, edges, allDomains) {
    if (!edges || edges.length === 0) return [];

    var downstream = [];
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      // Domain aliases: some edges use 'science' for 'research', 'medicine' for 'health', 'trade' for 'supplyChain'
      var src = _normalizeDomainId(edge.source);
      var tgt = _normalizeDomainId(edge.target);

      if (src === domainId) {
        var weight = edge.weight || 0.5;
        var propagatedReduction = localRepair.reduction * weight * 0.5;
        var targetStress = allDomains[tgt] ? (allDomains[tgt].stress || 0) : 0;

        downstream.push({
          domainId: tgt,
          name: DOMAIN_LABELS[tgt] || tgt,
          edgeType: edge.type,
          edgeWeight: weight,
          propagatedReduction: propagatedReduction,
          currentStress: targetStress,
          projectedStress: Math.max(0, targetStress - propagatedReduction)
        });
      }
    }

    // Sort by propagated reduction descending
    downstream.sort(function (a, b) { return b.propagatedReduction - a.propagatedReduction; });
    return downstream;
  }

  function _normalizeDomainId(id) {
    var map = {
      science: 'research',
      medicine: 'health',
      trade: 'supplyChain'
    };
    return map[id] || id;
  }

  // ═══════════════════════════════════════════════════════════════
  // Event integration
  // ═══════════════════════════════════════════════════════════════

  function _getEventStressors(domainId) {
    var events = window.LIMENEvents;
    if (!events || !events.active) return [];

    var stressors = [];
    var active = events.active;
    for (var i = 0; i < active.length; i++) {
      var ev = active[i];
      // Check if event affects this domain
      var domains = ev.domains || ev.affectedDomains || [];
      if (typeof domains === 'string') domains = [domains];

      var affects = false;
      for (var d = 0; d < domains.length; d++) {
        if (domains[d] === domainId) { affects = true; break; }
      }
      // Also check event type/category for domain relevance
      if (!affects && ev.domain === domainId) affects = true;

      if (affects) {
        stressors.push({
          id: ev.id || ev.type,
          name: ev.name || ev.title || ev.type || 'Unknown event',
          severity: ev.severity || ev.priority || 'moderate',
          timestamp: ev.timestamp || ev.time
        });
      }
    }
    return stressors;
  }

  // ═══════════════════════════════════════════════════════════════
  // State classification
  // ═══════════════════════════════════════════════════════════════

  function _classifyState(stress, trend) {
    if (stress > 0.85) return 'critical';
    if (stress > 0.65 && trend > 0.03) return 'escalating';
    if (stress > 0.65) return 'fragmented';
    if (stress > 0.40) return 'pressured';
    if (trend < -0.03) return 'recovering';
    return 'stable';
  }

  function _classifyUrgency(stress, trend, stressorCount) {
    var score = stress * 0.6 + Math.max(trend, 0) * 0.2 + Math.min(stressorCount * 0.1, 0.2);
    for (var level in URGENCY_THRESHOLDS) {
      if (URGENCY_THRESHOLDS.hasOwnProperty(level) && score >= URGENCY_THRESHOLDS[level]) {
        return { label: level, score: score };
      }
    }
    return { label: 'minimal', score: score };
  }

  function _classifyPhase(stress, trend) {
    if (trend > 0.05) return 'ascending';
    if (trend < -0.05) return 'descending';
    if (stress > 0.7) return 'peak';
    if (stress < 0.2) return 'trough';
    return 'plateau';
  }

  function _classifyTrajectory(trend) {
    if (trend > 0.05) return 'worsening';
    if (trend < -0.05) return 'improving';
    return 'stable';
  }

  // ═══════════════════════════════════════════════════════════════
  // Regulate single domain
  // ═══════════════════════════════════════════════════════════════

  function regulate(domainId, edges) {
    var domains = window.LIMENDomains || {};
    var d = domains[domainId] || {};
    var stress = d.stress || 0;
    var trend = d.trend || 0;
    var confidence = d.confidence || 0;

    // Get connectome nodes for this domain (from brain-domain map if available)
    var domainNodes = [];
    var brainMap = window.LIMENDomainBrainMap;
    if (brainMap && brainMap[domainId]) {
      var mapped = brainMap[domainId];
      domainNodes = Array.isArray(mapped) ? mapped : (mapped.nodes || []);
    }

    // Step 1: Portal Treatment Resolution
    var ptr = window.LIMENPortalTreatmentResolver;
    var treatmentResult = ptr ? ptr.resolve(domainId, {
      stress: stress,
      trend: trend,
      confidence: confidence,
      nodes: domainNodes,
      domains: domains
    }) : { diagnoses: [], treatments: [], evidenceChains: [], isPortalSourced: false };

    // Step 2: Fractal Traversal
    var ftr = window.LIMENFractalTraversalResolver;
    var fractalResult = ftr ? ftr.descend(domainId, {
      treatments: treatmentResult.treatments,
      diagnoses: treatmentResult.diagnoses
    }) : { depth: 0, path: [domainId], answer: 'No fractal resolver', treatment: null, diagnosis: null, confidence: 0, portalId: domainId };

    // Step 3: Event stressors
    var stressors = _getEventStressors(domainId);

    // Step 4: State classification
    var state = _classifyState(stress, trend);
    var urgencyInfo = _classifyUrgency(stress, trend, stressors.length);
    var dominantPhase = _classifyPhase(stress, trend);
    var trajectory = _classifyTrajectory(trend);

    // Step 5: Repair mapping
    var localRepair = _computeLocalRepair(domainId, stress, treatmentResult.treatments);
    var globalRepair = _computeGlobalRepair(domainId, localRepair, edges || _edges || [], domains);

    // Step 6: Quality assessment + action plans
    var qa = window.LIMENPortalQualityAssessor;
    var actions = [];
    var actionPlans = [];
    var treatments = treatmentResult.treatments;
    var qualityTiers = { fully_specified: 0, partial: 0, generic: 0 };

    for (var ti = 0; ti < treatments.length; ti++) {
      var tx = treatments[ti];

      // Assess quality and build action plan
      if (qa) {
        var quality = qa.assessTreatment(tx);
        tx._qualityTier = quality.tier;
        tx._qualityScore = quality.score;
        tx._adjustedConfidence = quality.adjustedConfidence;
        qualityTiers[quality.tier] = (qualityTiers[quality.tier] || 0) + 1;

        var plan = qa.resolveActionPlan(tx, {
          domainId: domainId,
          diagnosisId: treatmentResult.diagnoses.length > 0 ? treatmentResult.diagnoses[0].id : null,
          portalId: tx._portalId || domainId
        });
        if (plan) actionPlans.push(plan);
      }

      var steps = tx.steps || [];
      for (var si = 0; si < steps.length; si++) {
        actions.push({
          treatmentId: tx.id,
          treatmentTitle: tx.title,
          sequence: steps[si].sequence || (si + 1),
          action: steps[si].action || steps[si].description || '',
          type: steps[si].type || tx.type || 'corrective'
        });
      }
    }

    // Step 7: Expected effect
    var expectedEffect = localRepair.reduction > 0
      ? 'Projected stress reduction: ' + (localRepair.reduction * 100).toFixed(1) + '% (' +
        (localRepair.currentStress * 100).toFixed(0) + '% → ' +
        (localRepair.projectedStress * 100).toFixed(0) + '%)'
      : 'No measurable stress reduction projected';

    // Step 8: Affected portals
    var affectedPortals = [];
    for (var ei = 0; ei < treatmentResult.evidenceChains.length; ei++) {
      var chain = treatmentResult.evidenceChains[ei];
      if (chain.portal && chain.portal.id) {
        affectedPortals.push(chain.portal.id);
      }
    }

    return {
      domainId: domainId,
      name: DOMAIN_LABELS[domainId] || domainId,
      state: state,
      stress: stress,
      confidence: confidence,
      dominantPhase: dominantPhase,
      trajectory: trajectory,
      stressors: stressors,
      affectedPortals: affectedPortals,
      diagnosis: treatmentResult.diagnoses.length > 0 ? {
        primary: treatmentResult.diagnoses[0],
        count: treatmentResult.diagnoses.length,
        portalSourced: treatmentResult.isPortalSourced
      } : null,
      treatments: treatments,
      actions: actions,
      evidenceChain: treatmentResult.evidenceChains.length > 0 ? treatmentResult.evidenceChains[0] : null,
      expectedEffect: expectedEffect,
      urgency: urgencyInfo.label,
      urgencyScore: urgencyInfo.score,
      localRepair: localRepair,
      globalRepair: globalRepair,
      fractalAnswer: fractalResult,
      isPortalSourced: treatmentResult.isPortalSourced,
      actionPlans: actionPlans,
      qualityTiers: qualityTiers,
      portalCompleteness: qualityTiers.fully_specified > 0 ?
        qualityTiers.fully_specified / (qualityTiers.fully_specified + qualityTiers.partial + qualityTiers.generic) : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Regulate all domains
  // ═══════════════════════════════════════════════════════════════

  function regulateAll() {
    _loadEdges(function (edges) {
      var output = {};

      for (var i = 0; i < DOMAINS.length; i++) {
        try {
          output[DOMAINS[i]] = regulate(DOMAINS[i], edges);
        } catch (e) {
          console.warn('[LIMEN] regulation failed for ' + DOMAINS[i] + ':', e.message);
          output[DOMAINS[i]] = { domainId: DOMAINS[i], error: e.message };
        }
      }

      window.LIMENRegulationOutput = output;
      console.log('[LIMEN] regulation ready', Object.keys(output).length + ' domains');

      // Dispatch event
      window.dispatchEvent(new CustomEvent('limen:regulation-ready', {
        detail: { output: output, timestamp: Date.now() }
      }));
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Post-harvest callback (Phase 2)
  // ═══════════════════════════════════════════════════════════════

  function onHarvestComplete() {
    console.log('[LIMEN] regulation: re-running with harvested portal data');
    regulateAll();
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENDomainRegulationEngine = {
    regulate: regulate,
    regulateAll: regulateAll,
    onHarvestComplete: onHarvestComplete
  };

})();
