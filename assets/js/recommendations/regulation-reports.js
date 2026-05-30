/**
 * LIMEN Regulation Reports — Remedy Plan Generator
 *
 * Converts recommendation reports into structured remedy plans
 * for all scales: user, portal, business, domain, civilization.
 *
 * Consumes output from LIMENReportSynthesizer without modifying it.
 *
 * Depends on:
 *   window.LIMENReportSynthesizer
 *   window.LIMENDomains
 *   window.LIMENGlobalState
 *   assets/data/remedy-library.json (loaded at init)
 *
 * Exposes: window.LIMENRegulationReports
 */
(function () {
  'use strict';

  var _library = null;
  var _libraryLoaded = false;

  // ═══════════════════════════════════════════════════════════════════════════
  // Remedy library loader
  // ═══════════════════════════════════════════════════════════════════════════

  function loadLibrary(url) {
    url = url || 'assets/data/remedy-library.json';
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _library = data;
        _libraryLoaded = true;
        return data;
      })
      .catch(function (err) {
        console.warn('[LIMENRegulationReports] Could not load remedy library:', err.message);
        _library = { entries: [] };
        _libraryLoaded = true;
        return _library;
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Plan generators by scale
  // ═══════════════════════════════════════════════════════════════════════════

  function generateUserPlan(reports) {
    var report = reports.mainUser;
    if (!report) return null;

    var recs = [];
    var portalReport = reports.portalUser;

    // Get pattern + actions from mainUser report
    var actions = report.actions || [];
    var topPattern = report.summary.timeHorizon !== 'stable'
      ? _inferPatternFromHeadline(report.summary.headline)
      : null;

    // Enrich from portalUser if available
    var treatment = null;
    if (portalReport && portalReport.suggestions && portalReport.suggestions.length > 0) {
      var s = portalReport.suggestions[0];
      treatment = {
        label: s.treatment,
        type: s.type,
        evidence: s.evidence || portalReport.summary.confidenceTier,
        relevance: s.relevance
      };
    }

    return {
      scale: 'user',
      generatedAt: Date.now(),
      pattern: topPattern,
      headline: report.summary.headline,
      confidence: report.summary.confidenceLabel,
      urgency: report.summary.urgency,
      timeHorizon: report.summary.timeHorizon,
      trajectory: report.temporal.trajectory,
      actions: actions.map(function (a) {
        return { text: a.text, type: a.type || 'suggestion' };
      }),
      treatment: treatment,
      dataNote: report.dataNote
    };
  }

  function generatePortalPlan(reports) {
    var report = reports.portalUser;
    if (!report) return null;

    return {
      scale: 'portalUser',
      generatedAt: Date.now(),
      pattern: report.summary.patternClass,
      patternLabel: report.summary.patternLabel,
      confidence: report.summary.confidence,
      confidenceTier: report.summary.confidenceTier,
      urgency: report.summary.urgency,
      timeHorizon: report.summary.timeHorizon,
      affectedNodes: report.summary.affectedNodes,
      affectedSystems: report.summary.affectedSystems,
      suggestions: (report.suggestions || []).map(function (s) {
        return {
          rank: s.rank,
          treatment: s.treatment,
          type: s.type,
          target: s.node ? 'node ' + s.node.id + ' (' + s.node.label + ')' : '',
          direction: s.direction,
          relevance: s.relevance,
          evidence: s.evidence
        };
      }),
      evidence: {
        historical: report.evidence.historical.available
          ? report.evidence.historical.analogueCount + ' analogues'
          : 'none',
        current: report.evidence.current.dataQuality
          ? report.evidence.current.dataQuality.grade
          : 'unknown',
        predictive: report.evidence.predictive.available
          ? report.evidence.predictive.dominantTrajectory
          : 'none'
      },
      uncertainty: report.evidence.uncertaintyStatement,
      conflicts: report.conflicts
    };
  }

  function generateBusinessPlan(reports) {
    var report = reports.businessPortal;
    if (!report) return null;

    return {
      scale: 'business',
      generatedAt: Date.now(),
      pattern: report.summary.patternClass,
      patternLabel: report.summary.patternLabel,
      confidence: report.summary.confidence,
      confidenceTier: report.summary.confidenceTier,
      urgency: report.summary.urgency,
      timeHorizon: report.summary.timeHorizon,
      phase: report.summary.dominantPhase,
      kpis: report.kpis,
      evidence: {
        historical: report.evidence.historical.summary,
        elevatedFeeds: report.evidence.current.elevatedFeeds,
        trajectory: report.evidence.predictive.trajectory,
        overallConfidence: report.evidence.overallConfidence
      },
      actions: (report.actions || []).map(function (a) {
        return {
          id: a.id,
          steps: (a.actions || []).map(function (act) {
            return act.text || act.label || act.type;
          }),
          confidence: a.confidence,
          timeHorizon: a.timeHorizon
        };
      }),
      conflicts: report.conflicts
    };
  }

  function generateDomainPlan(reports) {
    var report = reports.domain;
    if (!report) return null;

    // Enrich with remedy library
    var interventions = [];
    if (_library && _library.entries) {
      var domains = report.domainStress || {};
      var dk = Object.keys(domains);
      for (var i = 0; i < dk.length; i++) {
        if (domains[dk[i]].stress > 0.5) {
          var matches = _findLibraryRemedies(dk[i], report.summary.patternClass);
          for (var m = 0; m < matches.length; m++) {
            interventions.push({
              domain: dk[i],
              stress: domains[dk[i]].stress,
              trend: domains[dk[i]].trend,
              remedy: matches[m].remedy,
              evidence: matches[m].evidence,
              examples: matches[m].examples
            });
          }
        }
      }
    }

    return {
      scale: 'domain',
      generatedAt: Date.now(),
      pattern: report.summary.patternClass,
      patternLabel: report.summary.patternLabel,
      confidence: report.summary.confidence,
      confidenceTier: report.summary.confidenceTier,
      propagationSteps: report.propagationSteps,
      convergenceAchieved: report.convergenceAchieved,
      domainStress: report.domainStress,
      signals: report.signals,
      interventions: interventions,
      evidence: {
        overallConfidence: report.evidence.overallConfidence,
        overallTier: report.evidence.overallTier,
        uncertainty: report.evidence.uncertaintyStatement
      },
      conflicts: report.conflicts
    };
  }

  function generateCivilizationPlan(reports) {
    var report = reports.civilization;
    if (!report) return null;

    // Build systemic remedy strategy
    var strategy = [];
    var globalState = window.LIMENGlobalState || { mode: 'stable', topDrivers: [] };
    var drivers = report.summary.topDrivers || globalState.topDrivers || [];

    for (var i = 0; i < drivers.length; i++) {
      var remedies = _findLibraryRemedies(drivers[i], null);
      strategy.push({
        driver: drivers[i],
        remedies: remedies.map(function (r) { return r.remedy; }).reduce(function (acc, arr) { return acc.concat(arr); }, []),
        evidence: remedies.length > 0 ? remedies[0].evidence : 'none'
      });
    }

    return {
      scale: 'civilization',
      generatedAt: Date.now(),
      globalMode: report.summary.globalMode,
      globalScore: report.summary.globalScore,
      globalConfidence: report.summary.globalConfidence,
      topDrivers: drivers,
      pattern: report.summary.patternClass,
      patternLabel: report.summary.patternLabel,
      domainOverview: report.domainOverview,
      polarity: report.polarity,
      remedyStrategy: strategy,
      scaleSummary: report.scaleSummary,
      conflicts: report.conflicts,
      evidence: {
        overallConfidence: report.evidence.overallConfidence,
        overallTier: report.evidence.overallTier,
        uncertainty: report.evidence.uncertaintyStatement
      }
    };
  }

  function generatePatentPlan(reports) {
    var report = reports.patentOpportunity;
    if (!report) return null;

    return {
      scale: 'patent',
      generatedAt: Date.now(),
      opportunityScore: report.summary.opportunityScore,
      signalCount: report.summary.signalCount,
      topDomain: report.summary.topDomain,
      techHubActivation: report.techHubActivation,
      legalReviewRequired: report.legalReviewRequired,
      signals: (report.signals || []).map(function (s) {
        return {
          type: s.type.replace(/_/g, ' '),
          indication: s.indication,
          score: s.opportunityScore
        };
      }),
      suggestedField: _inferResearchField(report),
      contextual: report.contextualRecommendations,
      confidence: report.summary.confidence,
      confidenceTier: report.summary.confidenceTier
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Global remedy report (Part 9)
  // ═══════════════════════════════════════════════════════════════════════════

  function generateGlobalRemedyReport(reports) {
    var user = generateUserPlan(reports);
    var portal = generatePortalPlan(reports);
    var business = generateBusinessPlan(reports);
    var domain = generateDomainPlan(reports);
    var civilization = generateCivilizationPlan(reports);
    var patent = generatePatentPlan(reports);

    // Cross-scale conflicts
    var allConflicts = [];
    var seen = {};
    var plans = [portal, business, domain, civilization];
    for (var i = 0; i < plans.length; i++) {
      if (!plans[i] || !plans[i].conflicts) continue;
      for (var c = 0; c < plans[i].conflicts.length; c++) {
        var cf = plans[i].conflicts[c];
        var key = (cf.type || '') + ':' + (cf.scaleA || '') + ':' + (cf.scaleB || '');
        if (!seen[key]) {
          seen[key] = true;
          allConflicts.push(cf);
        }
      }
    }

    return {
      reportType: 'globalRemedyReport',
      generatedAt: Date.now(),
      globalState: civilization ? {
        mode: civilization.globalMode,
        score: civilization.globalScore,
        confidence: civilization.globalConfidence,
        topDrivers: civilization.topDrivers
      } : null,
      domainStressMap: domain ? domain.domainStress : null,
      systemicRisks: _identifySystemicRisks(reports),
      recommendedInterventions: {
        user: user,
        portal: portal,
        business: business,
        domain: domain,
        civilization: civilization
      },
      crossDomainConflicts: allConflicts,
      innovationOpportunities: patent,
      summary: _buildGlobalSummary(reports, civilization, domain)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _findLibraryRemedies(domain, patternClass) {
    if (!_library || !_library.entries) return [];
    var matches = [];
    for (var i = 0; i < _library.entries.length; i++) {
      var entry = _library.entries[i];
      if (entry.domain === domain) {
        if (!patternClass || !entry.pattern || entry.pattern === patternClass || entry.pattern === patternClass.replace(/_/g, ' ')) {
          matches.push(entry);
        }
      }
    }
    return matches;
  }

  function _inferPatternFromHeadline(headline) {
    var map = {
      'heightened signals': 'threat_cascade',
      'competing for attention': 'executive_overload',
      'engagement patterns': 'reward_dysregulation',
      'balance is strained': 'regulation_failure',
      'physical responses': 'somatic_cascade',
      'feel unclear': 'narrative_collapse',
      'settling back': 'homeostatic_recovery',
      'unexpected': 'prediction_violation',
      'interacting': 'cross_domain_resonance',
      'creative pressure': 'innovation_pressure',
      'past patterns': 'memory_consolidation',
      'window for change': 'plasticity_window',
      'significant shift': 'phase_transition',
      'fluctuating': 'oscillation_instability'
    };
    for (var key in map) {
      if (headline.toLowerCase().indexOf(key) >= 0) return map[key];
    }
    return null;
  }

  function _inferResearchField(report) {
    if (!report || !report.summary.topDomain) return 'interdisciplinary research';
    var FIELDS = {
      health: 'neuroadaptive behavioral therapy tools',
      technology: 'AI-driven regulatory compliance systems',
      energy: 'adaptive grid management frameworks',
      environment: 'predictive ecological monitoring platforms',
      economy: 'real-time economic stress detection systems',
      research: 'cross-domain pattern recognition engines',
      supplyChain: 'supply chain resilience optimization tools'
    };
    return FIELDS[report.summary.topDomain] || 'cross-domain innovation systems';
  }

  function _identifySystemicRisks(reports) {
    var risks = [];
    var civ = reports.civilization;
    if (civ) {
      var doms = civ.domainOverview || [];
      for (var i = 0; i < doms.length; i++) {
        if (doms[i].stress > 0.65) {
          risks.push({
            domain: doms[i].domain,
            stress: doms[i].stress,
            trend: doms[i].trend,
            severity: doms[i].stress > 0.8 ? 'critical' : 'elevated'
          });
        }
      }
    }
    if (civ && civ.summary && civ.summary.globalMode === 'escalating') {
      risks.push({
        domain: 'global',
        stress: civ.summary.globalScore,
        trend: 'escalating',
        severity: 'critical'
      });
    }
    return risks;
  }

  function _buildGlobalSummary(reports, civ, domain) {
    var lines = [];
    if (civ) {
      lines.push('Global mode: ' + (civ.globalMode || 'unknown'));
      lines.push('Stress score: ' + (civ.globalScore || 0).toFixed(2));
      if (civ.topDrivers && civ.topDrivers.length > 0) {
        lines.push('Top drivers: ' + civ.topDrivers.join(', '));
      }
    }
    if (domain && domain.domainStress) {
      var stressed = [];
      var dk = Object.keys(domain.domainStress);
      for (var i = 0; i < dk.length; i++) {
        if (domain.domainStress[dk[i]].stress > 0.5) {
          stressed.push(dk[i] + ' (' + domain.domainStress[dk[i]].stress.toFixed(2) + ')');
        }
      }
      if (stressed.length > 0) lines.push('Stressed domains: ' + stressed.join(', '));
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // All plans
  // ═══════════════════════════════════════════════════════════════════════════

  function generateAll(reports) {
    return {
      user: generateUserPlan(reports),
      portal: generatePortalPlan(reports),
      business: generateBusinessPlan(reports),
      domain: generateDomainPlan(reports),
      civilization: generateCivilizationPlan(reports),
      patent: generatePatentPlan(reports),
      global: generateGlobalRemedyReport(reports)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENRegulationReports = {
    loadLibrary:                loadLibrary,
    generateUserPlan:           generateUserPlan,
    generatePortalPlan:         generatePortalPlan,
    generateBusinessPlan:       generateBusinessPlan,
    generateDomainPlan:         generateDomainPlan,
    generateCivilizationPlan:   generateCivilizationPlan,
    generatePatentPlan:         generatePatentPlan,
    generateGlobalRemedyReport: generateGlobalRemedyReport,
    generateAll:                generateAll,
    getLibrary:                 function () { return _library; },
    isLoaded:                   function () { return _libraryLoaded; }
  };

})();
