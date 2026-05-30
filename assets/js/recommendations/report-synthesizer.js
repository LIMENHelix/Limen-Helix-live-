/**
 * LIMEN Recommendation Runtime — Report Synthesizer
 *
 * Produces structured reports for 6 audiences from the recommendation pipeline:
 *   1. mainUser        — simple, no jargon, color confidence
 *   2. portalUser      — clinical detail, evidence, treatment steps
 *   3. businessPortal  — metrics, KPIs, phase, risk
 *   4. domain          — policy, cross-domain deps, feed data
 *   5. civilization    — systemic view, all domains, resonance
 *   6. patentOpportunity — patent gaps + recommendation overlay
 *
 * Pipeline position:
 *   feeds → node state → propagation → pattern detection →
 *   remedy lookup → scale translation → recommendation engine →
 *   ┌────────────────┐
 *   │ REPORT SYNTH   │  ← this module
 *   └────────────────┘
 *
 * Each report includes:
 *   - summary narrative
 *   - confidence + tier
 *   - time horizon
 *   - historical section (pattern analogues)
 *   - current section   (live feeds + node states)
 *   - predictive section (projections + trajectory)
 *   - recommended actions
 *   - conflicts
 *   - full evidence chain (sourceChain per innervation-schema)
 *
 * Schema contracts (locked — read-only):
 *   innervation-schema.json       — sourceChain, domainRepairReport, patentOpportunityReport, portalRemedyReport
 *   recommendation-schema.json    — recommendation, recommendationSet, confidenceModel
 *   evidence-schema.json          — evidenceEnvelope, temporalBalance, confidenceDisplay
 *   patent-opportunity-schema.json — patent signals, salienceModel
 *   remedy-schema.json            — remedy, remedyType, evidenceType
 *
 * Depends on:
 *   window.LIMENRecommendationEngine  (recommendations/recommendation-engine.js)
 *   window.LIMENEvidenceBuilder       (recommendations/evidence-builder.js)
 *   window.LIMENDomains               (domain-signal-engine.js)
 *   window.LIMENGlobalState           (global-state-engine.js)
 *   window.LIMENPolarity              (report-polarity-engine.js) — optional
 *
 * Exposes: window.LIMENReportSynthesizer
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════════════════════════

  var REPORT_VERSION = '0.1.0';

  var REPORT_TYPES = [
    'mainUser', 'portalUser', 'businessPortal',
    'domain', 'civilization', 'patentOpportunity'
  ];

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  var CONFIDENCE_LABELS = {
    high:         'High confidence',
    moderate:     'Moderate confidence',
    low:          'Low confidence',
    insufficient: 'Insufficient data'
  };

  var CONFIDENCE_COLORS = {
    high: '#4CAF50', moderate: '#FF9800', low: '#F44336', insufficient: '#9E9E9E'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Source Chain builder (innervation-schema sourceChain contract)
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildSourceChain(recSet, envelope) {
    var feeds = [];
    var seedNodes = {};
    var patternsDetected = { hotClusters: 0, coldGaps: 0, predictionViolations: 0, oscillations: 0 };
    var propagationSteps = 0;
    var convergenceStep = null;
    var remedyLookups = 0;

    // Try envelope first
    if (envelope && envelope.currentState) {
      var cs = envelope.currentState;
      feeds = (cs.feedSnapshot || []).map(function (f) { return f.feedName; });
      var ns = cs.nodeSnapshot || [];
      for (var i = 0; i < ns.length; i++) {
        if (ns[i].seedSource) seedNodes[ns[i].nodeId] = ns[i].activation;
      }
      if (cs.propagationSnapshot) {
        propagationSteps = cs.propagationSnapshot.steps || 0;
        convergenceStep = cs.propagationSnapshot.convergenceStep || null;
      }
      if (cs.patternSnapshot) {
        patternsDetected.hotClusters = cs.patternSnapshot.hotClusters || 0;
        patternsDetected.coldGaps = cs.patternSnapshot.coldGaps || 0;
        patternsDetected.predictionViolations = cs.patternSnapshot.predictionViolations || 0;
        patternsDetected.oscillations = cs.patternSnapshot.oscillatingNodes || 0;
      }
    }

    // Fallback: if feeds are empty, pull directly from live domain state
    if (feeds.length === 0) {
      var liveDomains = window.LIMENDomains || {};
      var DK = ['economy','energy','environment','health','technology','research','supplyChain','governance','infrastructure','agriculture','industry','education','communication','culture','defense','religion','population','law','finance','intelligence'];
      for (var di = 0; di < DK.length; di++) {
        var dk = DK[di];
        var dd = liveDomains[dk];
        if (dd && (dd.stress > 0 || dd.confidence > 0)) {
          feeds.push(dk.charAt(0).toUpperCase() + dk.slice(1));
          if (dd.stress > 0.3) {
            seedNodes[dk] = dd.stress;
            propagationSteps++;
          }
          if (dd.stress > 0.6) patternsDetected.hotClusters++;
          if (dd.stress < 0.05 && dd.confidence > 0) patternsDetected.coldGaps++;
        }
      }
    }

    // Count remedy lookups from all scales
    var scales = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];
    for (var s = 0; s < scales.length; s++) {
      var recs = recSet[scales[s]] || [];
      for (var r = 0; r < recs.length; r++) {
        remedyLookups += (recs[r].recommendedActions || []).length;
      }
    }

    return {
      feeds: feeds,
      seedNodes: seedNodes,
      propagationSteps: propagationSteps,
      convergenceStep: convergenceStep,
      patternsDetected: patternsDetected,
      remedyLookups: remedyLookups,
      timestamp: Date.now()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Temporal sections — shared across all report types
  // ═══════════════════════════════════════════════════════════════════════════

  function _buildHistoricalSection(envelope) {
    if (!envelope || !envelope.historical) {
      return {
        available: false,
        analogueCount: 0,
        coverageGrade: 'none',
        summary: 'No historical data available.',
        analogues: []
      };
    }
    var h = envelope.historical;
    return {
      available: h.analogueCount > 0,
      analogueCount: h.analogueCount,
      coverageGrade: h.coverageGrade,
      summary: h.summaryNarrative,
      analogues: (h.analogues || []).slice(0, 5).map(function (a) {
        return {
          id: a.id,
          pattern: a.patternClass,
          age: a.age,
          similarity: a.similarity,
          directionMatch: a.directionMatch,
          outcome: a.outcome ? {
            converged: a.outcome.convergenceAchieved,
            remedyApplied: a.outcome.remedyApplied,
            effectiveness: a.outcome.remedyEffectiveness,
            narrative: a.outcome.narrative
          } : null,
          relevance: a.relevanceScore
        };
      })
    };
  }

  function _buildCurrentSection(envelope) {
    if (!envelope || !envelope.currentState) {
      return {
        available: false,
        dataQuality: { grade: 'poor', statement: 'No current data available.' },
        feeds: [],
        nodeHighlights: [],
        propagation: null
      };
    }
    var cs = envelope.currentState;
    return {
      available: true,
      dataQuality: cs.dataQuality ? {
        grade: cs.dataQuality.qualityGrade,
        liveRatio: cs.dataQuality.liveRatio,
        statement: cs.dataQuality.qualityStatement
      } : { grade: 'poor', statement: 'Unknown' },
      feeds: (cs.feedSnapshot || []).map(function (f) {
        return {
          name: f.feedName,
          domain: f.domain,
          stress: f.stress,
          live: f.live,
          staleness: f.staleness,
          trend: f.trend
        };
      }),
      nodeHighlights: (cs.nodeSnapshot || [])
        .filter(function (n) { return n.activation > 0.5 || n.isAnomaly; })
        .map(function (n) {
          return {
            id: n.nodeId,
            label: n.nodeLabel,
            system: n.system,
            activation: n.activation,
            direction: n.direction,
            isAnomaly: n.isAnomaly
          };
        }),
      propagation: cs.propagationSnapshot ? {
        steps: cs.propagationSnapshot.steps,
        converged: cs.propagationSnapshot.converged,
        convergenceStep: cs.propagationSnapshot.convergenceStep
      } : null,
      pattern: cs.patternSnapshot || null,
      observedAt: cs.observedAt,
      freshnessMs: cs.freshnessMs
    };
  }

  function _buildPredictiveSection(envelope) {
    if (!envelope || !envelope.projected) {
      return {
        available: false,
        projectionCount: 0,
        dominantTrajectory: 'uncertain',
        methodStatement: 'No projections available.',
        projections: []
      };
    }
    var p = envelope.projected;
    return {
      available: p.projectionCount > 0,
      projectionCount: p.projectionCount,
      dominantTrajectory: p.dominantTrajectory,
      horizon: p.projectionHorizon,
      methodStatement: p.methodStatement,
      projections: (p.projections || []).map(function (proj) {
        return {
          id: proj.id,
          hypothesis: proj.hypothesis,
          trajectory: proj.trajectory,
          timeHorizon: proj.timeHorizon,
          confidence: proj.confidence,
          tier: proj.confidenceTier,
          uncertainty: proj.uncertainty ? {
            magnitude: proj.uncertainty.magnitude,
            sources: proj.uncertainty.sources,
            optimistic: proj.uncertainty.bounds ? proj.uncertainty.bounds.optimistic : '',
            pessimistic: proj.uncertainty.bounds ? proj.uncertainty.bounds.pessimistic : ''
          } : null,
          method: proj.method
        };
      })
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Report type 1: mainUser
  // Simple, no jargon, color confidence, minimal detail.
  // ═══════════════════════════════════════════════════════════════════════════

  function _synthesizeMainUser(recSet, envelope, sourceChain) {
    var recs = recSet.mainUser || [];
    var rec = recs[0] || null;

    var summary = 'Everything looks balanced.';
    var color = CONFIDENCE_COLORS.high;
    var actions = [];

    if (rec) {
      summary = _mainUserSummary(rec);
      var tier = rec.confidenceDetail ? rec.confidenceDetail.confidenceTier : 'moderate';
      color = CONFIDENCE_COLORS[tier] || CONFIDENCE_COLORS.moderate;
      actions = (rec.recommendedActions || []).map(function (a) {
        return { text: a.text || a.label || '', type: a.type };
      });
    } else {
      // No recommendations generated — synthesize from live domain state
      var gs = window.LIMENGlobalState || {};
      var liveDomains = window.LIMENDomains || {};
      if (gs.mode && gs.mode !== 'stable') {
        summary = 'System is in ' + gs.mode + ' state. ' + (gs.topDrivers && gs.topDrivers.length > 0 ? 'Top drivers: ' + gs.topDrivers.slice(0, 3).map(function(d) { return d.domain || d; }).join(', ') + '.' : '');
        color = gs.score > 0.6 ? CONFIDENCE_COLORS.low : CONFIDENCE_COLORS.moderate;
        // Build actions from top stressed domains
        var stressedDomains = [];
        var DK = Object.keys(liveDomains);
        for (var di = 0; di < DK.length; di++) {
          var dd = liveDomains[DK[di]];
          if (dd && dd.stress > 0.3) stressedDomains.push({ domain: DK[di], stress: dd.stress });
        }
        stressedDomains.sort(function(a,b) { return b.stress - a.stress; });
        actions = stressedDomains.slice(0, 5).map(function(sd) {
          return { text: 'Monitor ' + sd.domain + ' domain (stress: ' + Math.round(sd.stress * 100) + '%)', type: 'observe' };
        });
      }
    }

    return {
      reportType: 'mainUser',
      version: REPORT_VERSION,
      generatedAt: Date.now(),

      summary: {
        headline: summary,
        confidenceColor: color,
        confidenceLabel: rec ? CONFIDENCE_LABELS[rec.confidenceDetail ? rec.confidenceDetail.confidenceTier : 'moderate'] : CONFIDENCE_LABELS.high,
        urgency: rec ? rec.urgency : 0,
        timeHorizon: rec ? rec.timeHorizon : 'stable'
      },

      actions: actions,

      // Simplified temporal view — no numbers, just presence indicators
      temporal: {
        hasHistory: envelope ? envelope.historical.analogueCount > 0 : false,
        hasProjection: envelope ? envelope.projected.projectionCount > 0 : false,
        isSpeculative: envelope ? (envelope.temporalBalance.projectedWeight > 0.5) : false,
        trajectory: envelope ? envelope.projected.dominantTrajectory : 'stable'
      },

      // Confidence hidden unless poor quality
      dataNote: envelope && envelope.currentState && envelope.currentState.dataQuality.qualityGrade === 'poor'
        ? envelope.currentState.dataQuality.qualityStatement
        : null,

      sourceChain: sourceChain
    };
  }

  function _mainUserSummary(rec) {
    var SUMMARIES = {
      threat_cascade:          'Your system is responding to heightened signals. Consider a brief pause.',
      executive_overload:      'Multiple demands are competing for attention. Focusing on one may help.',
      reward_dysregulation:    'Your engagement patterns are shifting. Notice what is driving them.',
      regulation_failure:      'Natural balance is strained. A moment of stillness may help restore it.',
      somatic_cascade:         'Physical responses are informing your state. Pay attention to the body.',
      narrative_collapse:      'The picture may feel unclear right now. Clarity will return with time.',
      homeostatic_recovery:    'Things are settling back to balance. Stay with your current approach.',
      prediction_violation:    'Something unexpected has shifted. Take a moment to reassess.',
      cross_domain_resonance:  'Multiple areas of life are interacting. Observe the connections.',
      innovation_pressure:     'Creative pressure is building. Channel it when ready.',
      memory_consolidation:    'Past patterns are influencing the present. Reflect on what is familiar.',
      plasticity_window:       'A window for change is open. Small shifts may have large effects.',
      phase_transition:        'A significant shift is underway. Ground yourself in what you know.',
      oscillation_instability: 'Signals are fluctuating. Patience may be more useful than action.'
    };
    return SUMMARIES[rec.patternClass] || 'Observation mode active.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Report type 2: portalUser
  // Clinical detail, evidence citations, treatment protocol.
  // Compatible with innervation-schema portalRemedyReport.
  // ═══════════════════════════════════════════════════════════════════════════

  function _synthesizePortalUser(recSet, envelope, sourceChain) {
    var recs = recSet.portalUser || [];
    var historical = _buildHistoricalSection(envelope);
    var current = _buildCurrentSection(envelope);
    var predictive = _buildPredictiveSection(envelope);

    // Build suggestions array (portalRemedyReport contract)
    var suggestions = [];
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i];
      var acts = rec.recommendedActions || [];
      for (var a = 0; a < acts.length; a++) {
        var act = acts[a];
        suggestions.push({
          rank: suggestions.length + 1,
          node: {
            id: (rec.affectedNodes && rec.affectedNodes[0]) || 0,
            label: act.target || ''
          },
          direction: rec.confidenceDetail ? _inferDirection(rec) : 'altered',
          portal: act.portalId || '',
          treatment: act.label || act.text || '',
          type: act.treatmentType || 'STRATEGY',
          evidence: act.evidence || '',
          relevance: rec.confidence || 0,
          reason: act.monitoring || act.mechanism || ''
        });
      }
    }

    // Confidence aggregation
    var topRec = recs[0] || null;
    var confDetail = topRec ? topRec.confidenceDetail : null;

    return {
      reportType: 'portalUser',
      version: REPORT_VERSION,
      generatedAt: Date.now(),

      // portalRemedyReport compatibility
      clusterCount: current.pattern ? current.pattern.hotClusters : 0,
      suggestions: suggestions,

      summary: {
        patternClass: topRec ? topRec.patternClass : null,
        patternLabel: topRec ? topRec.patternClass.replace(/_/g, ' ') : 'none detected',
        affectedNodes: topRec ? topRec.affectedNodes : [],
        affectedSystems: topRec ? topRec.affectedSystems : [],
        confidence: confDetail ? confDetail.confidenceScore : 0,
        confidenceTier: confDetail ? confDetail.confidenceTier : 'insufficient',
        confidenceFactors: confDetail ? confDetail.confidenceFactors : null,
        timeHorizon: topRec ? topRec.timeHorizon : 'short',
        urgency: topRec ? topRec.urgency : 0
      },

      evidence: {
        historical: historical,
        current: current,
        predictive: predictive,
        uncertaintyStatement: envelope ? envelope.uncertaintyStatement : 'No evidence available.',
        temporalBalance: envelope ? envelope.temporalBalance : null
      },

      conflicts: _aggregateConflicts(recs),

      actions: recs.map(function (r) {
        return {
          id: r.id,
          actions: r.recommendedActions || [],
          contraindications: r.contraindications || [],
          confidence: r.confidence,
          timeHorizon: r.timeHorizon
        };
      }),

      sourceChain: sourceChain
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Report type 3: businessPortal
  // Business metrics, KPIs, phase context, risk of inaction.
  // ═══════════════════════════════════════════════════════════════════════════

  function _synthesizeBusinessPortal(recSet, envelope, sourceChain) {
    var recs = recSet.business || [];
    var historical = _buildHistoricalSection(envelope);
    var current = _buildCurrentSection(envelope);
    var predictive = _buildPredictiveSection(envelope);
    var topRec = recs[0] || null;

    return {
      reportType: 'businessPortal',
      version: REPORT_VERSION,
      generatedAt: Date.now(),

      summary: {
        patternClass: topRec ? topRec.patternClass : null,
        patternLabel: topRec ? _businessPatternLabel(topRec.patternClass) : 'No material pattern detected',
        confidence: topRec ? topRec.confidence : 0,
        confidenceTier: topRec && topRec.confidenceDetail ? topRec.confidenceDetail.confidenceTier : 'insufficient',
        timeHorizon: topRec ? topRec.timeHorizon : 'stable',
        urgency: topRec ? topRec.urgency : 0,
        dominantPhase: topRec ? topRec.dominantPhase : null
      },

      kpis: recs.map(function (r) {
        var act = (r.recommendedActions && r.recommendedActions[0]) || {};
        return {
          metric: act.metric || act.kpi || 'general',
          impact: act.text || 'No specific impact identified',
          timeframe: act.timeframe || r.timeHorizon,
          risk: act.risk || 'Not assessed',
          phase: act.phase || null
        };
      }),

      evidence: {
        historical: {
          available: historical.available,
          summary: historical.summary,
          precedentCount: historical.analogueCount
        },
        current: {
          dataQuality: current.dataQuality,
          feedCount: current.feeds.length,
          elevatedFeeds: current.feeds.filter(function (f) { return f.stress > 0.5; }).map(function (f) { return f.name; }),
          converged: current.propagation ? current.propagation.converged : false
        },
        predictive: {
          trajectory: predictive.dominantTrajectory,
          horizon: predictive.horizon,
          topProjection: predictive.projections[0] || null
        },
        uncertaintyStatement: envelope ? envelope.uncertaintyStatement : 'No data.',
        overallConfidence: envelope ? envelope.overallConfidence : 0
      },

      conflicts: _aggregateConflicts(recs),

      actions: recs.map(function (r) {
        return {
          id: r.id,
          actions: r.recommendedActions || [],
          confidence: r.confidence,
          timeHorizon: r.timeHorizon
        };
      }),

      sourceChain: sourceChain
    };
  }

  function _businessPatternLabel(patternClass) {
    var LABELS = {
      threat_cascade: 'Risk cascade detected',
      executive_overload: 'Decision capacity pressure',
      reward_dysregulation: 'Incentive misalignment signal',
      regulation_failure: 'Governance stress indicator',
      innovation_pressure: 'Innovation pipeline pressure',
      homeostatic_recovery: 'Stabilization in progress',
      plasticity_window: 'Adaptation opportunity window',
      phase_transition: 'Market regime shift signal',
      prediction_violation: 'Forecast deviation detected',
      oscillation_instability: 'Metric volatility alert'
    };
    return LABELS[patternClass] || patternClass.replace(/_/g, ' ');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Report type 4: domain
  // Domain-level policy, cross-domain dependencies, feed data.
  // Compatible with innervation-schema domainRepairReport.
  // ═══════════════════════════════════════════════════════════════════════════

  function _synthesizeDomain(recSet, envelope, sourceChain) {
    var recs = recSet.domain || [];
    var historical = _buildHistoricalSection(envelope);
    var current = _buildCurrentSection(envelope);
    var predictive = _buildPredictiveSection(envelope);
    var topRec = recs[0] || null;

    // Build domain stress map from live data
    var domainStress = {};
    var domains = window.LIMENDomains || {};
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var dk = DOMAIN_KEYS[i];
      var d = domains[dk];
      domainStress[dk] = {
        stress: d ? (d.stress || 0) : 0,
        trend: d ? (d.trend > 0.03 ? 'rising' : (d.trend < -0.03 ? 'declining' : 'stable')) : 'unknown',
        confidence: d ? (d.confidence || 0) : 0
      };
    }

    // Build domainRepairReport-compatible signals
    var signals = [];
    for (var r = 0; r < recs.length; r++) {
      var rec = recs[r];
      var act = (rec.recommendedActions && rec.recommendedActions[0]) || {};
      signals.push({
        type: _domainSignalType(rec),
        domains: act.crossDomainDeps || [act.domain || ''],
        nodes: rec.affectedNodes || [],
        severity: rec.urgency || 0,
        channel: rec.dominantChannel || '',
        recommendation: act.text || '',
        narrative: _domainNarrative(rec, act)
      });
    }

    return {
      reportType: 'domain',
      version: REPORT_VERSION,
      generatedAt: Date.now(),

      // domainRepairReport compatibility
      propagationSteps: current.propagation ? current.propagation.steps : 0,
      convergenceAchieved: current.propagation ? current.propagation.converged : false,
      signals: signals,

      summary: {
        patternClass: topRec ? topRec.patternClass : null,
        patternLabel: topRec ? topRec.patternClass.replace(/_/g, ' ') : 'none',
        confidence: topRec ? topRec.confidence : 0,
        confidenceTier: topRec && topRec.confidenceDetail ? topRec.confidenceDetail.confidenceTier : 'insufficient',
        timeHorizon: topRec ? topRec.timeHorizon : 'stable',
        urgency: topRec ? topRec.urgency : 0
      },

      domainStress: domainStress,

      evidence: {
        historical: historical,
        current: current,
        predictive: predictive,
        uncertaintyStatement: envelope ? envelope.uncertaintyStatement : 'No data.',
        temporalBalance: envelope ? envelope.temporalBalance : null,
        overallConfidence: envelope ? envelope.overallConfidence : 0,
        overallTier: envelope ? envelope.overallTier : 'insufficient'
      },

      conflicts: _aggregateConflicts(recs),

      actions: recs.map(function (r) {
        return {
          id: r.id,
          actions: r.recommendedActions || [],
          confidence: r.confidence,
          timeHorizon: r.timeHorizon
        };
      }),

      sourceChain: sourceChain
    };
  }

  function _domainSignalType(rec) {
    if (rec.patternClass === 'cross_domain_resonance' || rec.patternClass === 'phase_transition') return 'convergence';
    if (rec.patternClass === 'prediction_violation') return 'prediction_violation';
    return 'regulation_gap';
  }

  function _domainNarrative(rec, act) {
    var pattern = rec.patternClass.replace(/_/g, ' ');
    var domain = act.domain || 'sector';
    return pattern.charAt(0).toUpperCase() + pattern.slice(1)
         + ' pattern detected in ' + domain + ' sector'
         + (rec.urgency > 0.7 ? ' — high urgency' : '')
         + '. Confidence: ' + (rec.confidence * 100).toFixed(0) + '%.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Report type 5: civilization
  // All domains, resonance, systemic view.
  // ═══════════════════════════════════════════════════════════════════════════

  function _synthesizeCivilization(recSet, envelope, sourceChain) {
    var recs = recSet.civilization || [];
    var historical = _buildHistoricalSection(envelope);
    var current = _buildCurrentSection(envelope);
    var predictive = _buildPredictiveSection(envelope);
    var topRec = recs[0] || null;

    // Global state
    var globalState = window.LIMENGlobalState || { mode: 'stable', score: 0, confidence: 0, topDrivers: [] };

    // Domain stress overview
    var domainOverview = [];
    var domains = window.LIMENDomains || {};
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var dk = DOMAIN_KEYS[i];
      var d = domains[dk];
      domainOverview.push({
        domain: dk,
        stress: d ? (d.stress || 0) : 0,
        trend: d ? (d.trend > 0.03 ? 'rising' : (d.trend < -0.03 ? 'declining' : 'stable')) : 'unknown',
        confidence: d ? (d.confidence || 0) : 0
      });
    }

    // Polarity if available
    var polarity = window.LIMENPolarity || null;

    return {
      reportType: 'civilization',
      version: REPORT_VERSION,
      generatedAt: Date.now(),

      summary: {
        globalMode: globalState.mode,
        globalScore: globalState.score,
        globalConfidence: globalState.confidence,
        topDrivers: globalState.topDrivers,
        patternClass: topRec ? topRec.patternClass : null,
        patternLabel: topRec ? topRec.patternClass.replace(/_/g, ' ') : 'none',
        confidence: topRec ? topRec.confidence : 0,
        confidenceTier: topRec && topRec.confidenceDetail ? topRec.confidenceDetail.confidenceTier : 'insufficient',
        timeHorizon: topRec ? topRec.timeHorizon : 'structural',
        urgency: topRec ? topRec.urgency : 0
      },

      domainOverview: domainOverview,
      polarity: polarity,

      evidence: {
        historical: historical,
        current: current,
        predictive: predictive,
        uncertaintyStatement: envelope ? envelope.uncertaintyStatement : 'No data.',
        temporalBalance: envelope ? envelope.temporalBalance : null,
        overallConfidence: envelope ? envelope.overallConfidence : 0,
        overallTier: envelope ? envelope.overallTier : 'insufficient',
        display: envelope ? envelope.display : null
      },

      // All cross-scale conflicts
      conflicts: (recSet.conflicts || []).concat(_aggregateConflicts(recs)),

      actions: recs.map(function (r) {
        return {
          id: r.id,
          actions: r.recommendedActions || [],
          confidence: r.confidence,
          timeHorizon: r.timeHorizon
        };
      }),

      // Full recommendation counts across all scales
      scaleSummary: {
        mainUser:     (recSet.mainUser || []).length,
        portalUser:   (recSet.portalUser || []).length,
        business:     (recSet.business || []).length,
        domain:       (recSet.domain || []).length,
        civilization: (recSet.civilization || []).length,
        total: (recSet.mainUser || []).length + (recSet.portalUser || []).length
             + (recSet.business || []).length + (recSet.domain || []).length
             + (recSet.civilization || []).length
      },

      sourceChain: sourceChain
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Report type 6: patentOpportunity
  // Patent gaps + recommendation pipeline overlay.
  // Compatible with innervation-schema patentOpportunityReport.
  // ═══════════════════════════════════════════════════════════════════════════

  function _synthesizePatentOpportunity(recSet, envelope, sourceChain, patentData) {
    var historical = _buildHistoricalSection(envelope);
    var current = _buildCurrentSection(envelope);
    var predictive = _buildPredictiveSection(envelope);

    // Patent data from window or explicit argument
    patentData = patentData || (window.LIMENPatentOpportunity || null);

    // Build patentOpportunityReport-compatible signals
    var signals = [];

    // Pull research opportunities from Research Observatory if available
    var researchMapping = window._limenNodeEntityMapping || null;
    if (researchMapping && researchMapping.mappings) {
      var mappings = researchMapping.mappings;
      // Find nodes with medium confidence (institutional gaps)
      var gaps = mappings.filter(function(m) { return m.confidence === 'medium'; });
      for (var gi = 0; gi < Math.min(gaps.length, 10); gi++) {
        signals.push({
          type: 'institutional_gap',
          techNode: gaps[gi].node_id,
          bridgeDomain: (gaps[gi].domains || [])[0] || '',
          opportunityScore: 0.7,
          indication: 'Institutional gap: ' + (gaps[gi].brain_region || gaps[gi].node_id) + ' lacks strong organizational analog — opportunity for novel institutional design'
        });
      }
      // Find cross-domain nodes (appear in 2+ domains)
      var crossDomain = mappings.filter(function(m) { return m.domains && m.domains.length >= 2; });
      for (var ci = 0; ci < Math.min(crossDomain.length, 5); ci++) {
        signals.push({
          type: 'cross_domain_opportunity',
          techNode: crossDomain[ci].node_id,
          bridgeDomain: crossDomain[ci].domains.join(', '),
          opportunityScore: 0.6,
          indication: 'Cross-domain node ' + crossDomain[ci].node_id + ' bridges ' + crossDomain[ci].domains.join(' + ') + ' — integration patent opportunity'
        });
      }
    }

    if (patentData) {
      // Filing density gaps
      var gaps = (patentData.filingDensity && patentData.filingDensity.gaps) || [];
      for (var g = 0; g < gaps.length; g++) {
        signals.push({
          type: 'cross_domain_opportunity',
          techNode: 'DLPFC',
          bridgeNode: '',
          bridgeDomain: gaps[g].domain || '',
          resonance: 0,
          opportunityScore: gaps[g].score || 0,
          indication: 'Filing density gap in ' + (gaps[g].cpcGroup || 'unknown') + ' (' + (gaps[g].domain || '') + ')'
        });
      }

      // Temporal gaps
      var tGaps = patentData.temporalGaps || [];
      for (var t = 0; t < tGaps.length; t++) {
        signals.push({
          type: 'temporal_gap',
          techNode: 'DLPFC',
          bridgeDomain: tGaps[t].domain || '',
          opportunityScore: tGaps[t].score || 0,
          indication: 'Temporal gap: ' + (tGaps[t].daysSinceSpike || 0) + ' days since last spike in ' + (tGaps[t].cpcGroup || '')
        });
      }

      // Novelty encoding
      if (patentData.noveltySignal && patentData.noveltySignal.spikeDetected) {
        signals.push({
          type: 'novelty_encoding',
          techNode: 'DLPFC',
          hippocampalActivation: 0,
          predictionError: patentData.noveltySignal.predictionError || 0,
          indication: 'Novelty spike detected — prediction error ' + ((patentData.noveltySignal.predictionError || 0) * 100).toFixed(0) + '%'
        });
      }
    }

    // Tech hub activation from propagation
    var techHubAct = 0;
    if (envelope && envelope.currentState && envelope.currentState.propagationSnapshot) {
      techHubAct = envelope.currentState.propagationSnapshot.finalActivations['12'] || 0;  // DLPFC = node 12
    }

    // Overlay domain/civilization recommendations for context
    var domainRecs = recSet.domain || [];
    var civRecs = recSet.civilization || [];

    return {
      reportType: 'patentOpportunity',
      version: REPORT_VERSION,
      generatedAt: Date.now(),

      // patentOpportunityReport compatibility
      techHubActivation: techHubAct,
      signals: signals,
      legalReviewRequired: true,

      summary: {
        opportunityScore: patentData ? (patentData.opportunityScore || 0) : 0,
        signalCount: signals.length,
        topDomain: _topPatentDomain(signals),
        confidence: envelope ? envelope.overallConfidence : 0,
        confidenceTier: envelope ? envelope.overallTier : 'insufficient'
      },

      patentData: patentData ? {
        filingDensity: patentData.filingDensity || null,
        noveltySignal: patentData.noveltySignal || null,
        convergenceSignal: patentData.convergenceSignal || null,
        temporalGaps: patentData.temporalGaps || [],
        remedyGaps: patentData.remedyGaps || []
      } : null,

      evidence: {
        historical: historical,
        current: current,
        predictive: predictive,
        uncertaintyStatement: envelope ? envelope.uncertaintyStatement : 'No evidence available.'
      },

      // Overlay: domain-level and civilization-level insights
      contextualRecommendations: {
        domain: domainRecs.map(function (r) {
          return {
            pattern: r.patternClass,
            action: (r.recommendedActions && r.recommendedActions[0]) ? r.recommendedActions[0].text : '',
            confidence: r.confidence
          };
        }),
        civilization: civRecs.map(function (r) {
          return {
            pattern: r.patternClass,
            action: (r.recommendedActions && r.recommendedActions[0]) ? r.recommendedActions[0].text : '',
            confidence: r.confidence
          };
        })
      },

      conflicts: _aggregateConflicts(domainRecs.concat(civRecs)),

      sourceChain: sourceChain
    };
  }

  function _topPatentDomain(signals) {
    if (!signals || signals.length === 0) return null;
    var counts = {};
    for (var i = 0; i < signals.length; i++) {
      var d = signals[i].bridgeDomain;
      if (d) counts[d] = (counts[d] || 0) + 1;
    }
    var best = null;
    var bestCount = 0;
    for (var k in counts) {
      if (counts[k] > bestCount) { bestCount = counts[k]; best = k; }
    }
    return best;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Shared helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _aggregateConflicts(recs) {
    var all = [];
    var seen = {};
    for (var i = 0; i < recs.length; i++) {
      var conflicts = recs[i].conflicts || [];
      for (var c = 0; c < conflicts.length; c++) {
        var key = conflicts[c].type + ':' + conflicts[c].scaleA + ':' + conflicts[c].scaleB;
        if (!seen[key]) {
          seen[key] = true;
          all.push(conflicts[c]);
        }
      }
    }
    return all;
  }

  function _inferDirection(rec) {
    // Infer from recommendation's evidence or pattern
    if (rec.confidenceDetail && rec.confidenceDetail.confidenceFactors) {
      var clarity = rec.confidenceDetail.confidenceFactors.patternClarity || 0;
      if (clarity > 0.6) return 'hyper';
      if (clarity < 0.3) return 'hypo';
    }
    return 'altered';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main entry point
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Synthesize a specific report from a recommendation set.
   *
   * @param {string} reportType — one of: mainUser, portalUser, businessPortal, domain, civilization, patentOpportunity
   * @param {Object} recSet     — output of LIMENRecommendationEngine.generate()
   * @param {Object} [opts]
   * @param {Object} [opts.envelope]     — evidence envelope (auto-extracted from first rec if absent)
   * @param {Object} [opts.patentData]   — patent opportunity data for patent report
   * @returns {Object} structured report payload
   */
  function synthesize(reportType, recSet, opts) {
    opts = opts || {};

    // Extract envelope from first available recommendation if not provided
    var envelope = opts.envelope || _findEnvelope(recSet);

    // Build source chain
    var sourceChain = _buildSourceChain(recSet, envelope);

    switch (reportType) {
      case 'mainUser':          return _synthesizeMainUser(recSet, envelope, sourceChain);
      case 'portalUser':        return _synthesizePortalUser(recSet, envelope, sourceChain);
      case 'businessPortal':    return _synthesizeBusinessPortal(recSet, envelope, sourceChain);
      case 'domain':            return _synthesizeDomain(recSet, envelope, sourceChain);
      case 'civilization':      return _synthesizeCivilization(recSet, envelope, sourceChain);
      case 'patentOpportunity': return _synthesizePatentOpportunity(recSet, envelope, sourceChain, opts.patentData);
      default:
        throw new Error('Unknown report type: ' + reportType);
    }
  }

  /**
   * Synthesize ALL report types from a recommendation set.
   *
   * @param {Object} recSet   — output of LIMENRecommendationEngine.generate()
   * @param {Object} [opts]   — { patentData }
   * @returns {Object} { mainUser, portalUser, businessPortal, domain, civilization, patentOpportunity }
   */
  function synthesizeAll(recSet, opts) {
    opts = opts || {};
    var result = {};
    for (var i = 0; i < REPORT_TYPES.length; i++) {
      result[REPORT_TYPES[i]] = synthesize(REPORT_TYPES[i], recSet, opts);
    }
    return result;
  }

  /**
   * Generate recommendations AND synthesize all reports in one call.
   *
   * @param {Object} engineOpts — options for LIMENRecommendationEngine.generate()
   * @param {Object} [reportOpts] — { patentData }
   * @returns {{ recommendations: Object, reports: Object }}
   */
  function generateAndReport(engineOpts, reportOpts) {
    var engine = window.LIMENRecommendationEngine;
    if (!engine) throw new Error('LIMENRecommendationEngine not loaded');

    var recSet = engine.generate(engineOpts);
    var reports = synthesizeAll(recSet, reportOpts);

    return {
      recommendations: recSet,
      reports: reports
    };
  }

  function _findEnvelope(recSet) {
    var scales = ['portalUser', 'mainUser', 'business', 'domain', 'civilization'];
    for (var i = 0; i < scales.length; i++) {
      var recs = recSet[scales[i]] || [];
      if (recs.length > 0 && recs[0].evidenceEnvelope) {
        return recs[0].evidenceEnvelope;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENReportSynthesizer = {
    synthesize:        synthesize,
    synthesizeAll:     synthesizeAll,
    generateAndReport: generateAndReport,
    REPORT_TYPES:      REPORT_TYPES,
    REPORT_VERSION:    REPORT_VERSION
  };

})();
