/**
 * LIMEN HELIX — Analyst Report Builder
 *
 * Builds per-domain analyst reports from the 20-domain registry.
 * Reports start from the registry, NOT from UI cards.
 *
 * Pipeline:
 *   LIMENDomainRegistry (20 domains)
 *     → LIMENDomains (live stress/trend/signals)
 *     → LIMENRemedyRegistryManager (diagnoses/treatments)
 *     → LIMENRecommendationEngine (pattern detection)
 *     → structured analyst report per domain
 *
 * Output:
 *   window.LIMENAnalystReport = {
 *     generatedAt, domainCount, globalSummary,
 *     domains: [ { domainId, label, stress, trajectory, ... } ]
 *   }
 *
 * Events:
 *   limen:analyst-report-ready (detail: report)
 *
 * Depends on:
 *   window.LIMENDomainRegistry
 *   window.LIMENDomains
 *   window.LIMENRemedyRegistryManager (optional)
 *   window.LIMENGlobalState (optional)
 *
 * Exposes: window.LIMENAnalystReportBuilder
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // Phase label map
  // ═══════════════════════════════════════════════════════════════════════

  var PHASE_LABELS = {
    0: 'P0 — Default Mode',
    1: 'P1 — Salience',
    2: 'P2 — Memory',
    3: 'P3 — Threat',
    4: 'P4 — Executive',
    5: 'P5 — Motor',
    6: 'P6 — Thalamic',
    7: 'P7 — Neuroendocrine',
    8: 'P8 — Interoceptive',
    9: 'P9 — Integration',
    10: 'P10 — Cerebellar'
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Build a single domain report
  // ═══════════════════════════════════════════════════════════════════════

  function _buildDomainReport(domainDef) {
    var rk = domainDef.runtimeKey;
    var domains = window.LIMENDomains || {};
    var domainState = domains[rk] || {};

    // Live stress data
    var stress = domainState.stress || 0;
    var trend = domainState.trend || 0;
    var confidence = domainState.confidence || 0;
    var signals = domainState.signals || [];
    var sources = domainState.sources || [];

    // Trajectory from trend
    var trajectory = 'stable';
    if (trend > 0.05) trajectory = 'rising';
    else if (trend > 0.03) trajectory = 'drifting_up';
    else if (trend < -0.05) trajectory = 'declining';
    else if (trend < -0.03) trajectory = 'drifting_down';

    // Dominant phase from connectome node mapping
    var dominantPhase = _inferPhase(domainDef.connectomeNodes);

    // Feed status
    var feedStatus = _assessFeeds(domainDef.feeds, sources);

    // Diagnoses from registry
    var activeDiagnostics = [];
    var recommendedTreatments = [];
    var mgr = window.LIMENRemedyRegistryManager;
    if (mgr) {
      var dxList = mgr.getDiagnosesForDomain(rk);
      for (var di = 0; di < Math.min(dxList.length, 5); di++) {
        var dx = dxList[di];
        activeDiagnostics.push({
          id: dx.id,
          title: dx.title,
          severity: dx.severity,
          confidence: dx.confidence || 0,
          indicatorCount: (dx.indicators || []).length,
          treatmentCount: (dx.treatments || []).length
        });

        // Collect treatments from each diagnosis
        var txs = dx.treatments || [];
        for (var ti = 0; ti < Math.min(txs.length, 3); ti++) {
          recommendedTreatments.push({
            id: txs[ti].id,
            title: txs[ti].title,
            type: txs[ti].type || 'strategy',
            evidence: (txs[ti].evidence && txs[ti].evidence.grade) || 'None',
            diagnosisId: dx.id,
            stepCount: (txs[ti].steps || []).length
          });
        }
      }
    }

    // Narrative summary
    var narrative = _buildNarrative(domainDef, stress, trajectory, activeDiagnostics.length, feedStatus);

    // Evidence score: composite of confidence, feed health, diagnosis coverage
    var evidenceScore = _computeEvidenceScore(confidence, feedStatus, activeDiagnostics.length);

    return {
      domainId: domainDef.id,
      runtimeKey: rk,
      label: domainDef.label,
      group: domainDef.group,
      description: domainDef.description,

      // Live state
      stress: Math.round(stress * 1000) / 1000,
      trend: Math.round(trend * 1000) / 1000,
      trajectory: trajectory,
      confidence: Math.round(confidence * 1000) / 1000,
      dominantPhase: dominantPhase,
      phaseLabel: PHASE_LABELS[dominantPhase] || 'Unknown',

      // Signals and sources
      signals: signals.slice(0, 5),
      sourceFeeds: feedStatus,

      // Portals
      portalCount: domainDef.portals.length,
      distressedPortals: [],

      // Diagnoses and treatments
      activeDiagnostics: activeDiagnostics,
      diagnosticCount: activeDiagnostics.length,
      recommendedTreatments: recommendedTreatments,
      treatmentCount: recommendedTreatments.length,

      // Confidence and evidence
      evidenceScore: evidenceScore,
      narrative: narrative
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Build the full analyst report
  // ═══════════════════════════════════════════════════════════════════════

  function build() {
    var registry = window.LIMENDomainRegistry;
    if (!registry) {
      console.warn('[LIMENAnalystReportBuilder] Registry not loaded');
      return null;
    }

    var enabled = registry.getEnabled();
    var domainReports = [];

    for (var i = 0; i < enabled.length; i++) {
      domainReports.push(_buildDomainReport(enabled[i]));
    }

    // Sort by stress descending
    domainReports.sort(function (a, b) { return b.stress - a.stress; });

    // Global summary
    var globalState = window.LIMENGlobalState || { mode: 'stable', score: 0, confidence: 0 };
    var totalStress = 0;
    var liveCount = 0;
    var pendingCount = 0;
    var totalDiagnostics = 0;
    var totalTreatments = 0;

    for (var d = 0; d < domainReports.length; d++) {
      totalStress += domainReports[d].stress;
      totalDiagnostics += domainReports[d].diagnosticCount;
      totalTreatments += domainReports[d].treatmentCount;
      var feeds = domainReports[d].sourceFeeds;
      for (var f = 0; f < feeds.length; f++) {
        if (feeds[f].status === 'live' || feeds[f].status === 'public') liveCount++;
        else pendingCount++;
      }
    }

    var report = {
      generatedAt: Date.now(),
      version: '1.0.0',
      domainCount: domainReports.length,

      globalSummary: {
        mode: globalState.mode || 'stable',
        score: globalState.score || 0,
        confidence: globalState.confidence || 0,
        averageStress: domainReports.length > 0 ? Math.round((totalStress / domainReports.length) * 1000) / 1000 : 0,
        elevatedDomains: domainReports.filter(function (d) { return d.stress > 0.5; }).length,
        criticalDomains: domainReports.filter(function (d) { return d.stress > 0.75; }).length,
        totalDiagnostics: totalDiagnostics,
        totalTreatments: totalTreatments,
        feedHealth: {
          live: liveCount,
          pending: pendingCount,
          total: liveCount + pendingCount
        }
      },

      domains: domainReports,

      // Top-level alerts
      alerts: _buildAlerts(domainReports),

      // API key status
      apiKeyStatus: registry.getRequiredApiKeys(),
      feedStatusSummary: registry.getFeedStatusSummary()
    };

    // Store globally
    window.LIMENAnalystReport = report;

    // Dispatch event
    try {
      window.dispatchEvent(new CustomEvent('limen:analyst-report-ready', {
        detail: report
      }));
    } catch (e) { /* silent */ }

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════

  function _inferPhase(nodeIds) {
    if (!nodeIds || nodeIds.length === 0) return 0;
    var PHASE_NODES = {
      0: [1, 2, 3, 7],
      1: [8, 9, 10],
      2: [20, 21, 22, 23, 73],
      3: [6, 17, 18, 19],
      4: [12, 13, 15],
      5: [16, 69, 70],
      6: [40, 41, 42, 43],
      7: [31, 32, 33],
      8: [92, 93],
      9: [1, 2, 5],
      10: [3, 84]
    };

    var bestPhase = 0;
    var bestCount = 0;
    for (var phase in PHASE_NODES) {
      if (!PHASE_NODES.hasOwnProperty(phase)) continue;
      var nodes = PHASE_NODES[phase];
      var count = 0;
      for (var i = 0; i < nodeIds.length; i++) {
        if (nodes.indexOf(nodeIds[i]) >= 0) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestPhase = Number(phase);
      }
    }
    return bestPhase;
  }

  function _assessFeeds(registryFeeds, liveSources) {
    var result = [];
    for (var i = 0; i < registryFeeds.length; i++) {
      var feed = registryFeeds[i];
      var isLive = false;

      // Check if any live source matches this feed name
      for (var s = 0; s < liveSources.length; s++) {
        if (liveSources[s].name === feed.name && liveSources[s].live) {
          isLive = true;
          break;
        }
      }

      result.push({
        name: feed.name,
        apiKey: feed.apiKey || null,
        status: isLive ? 'live' : feed.status,
        endpoint: feed.endpoint
      });
    }
    return result;
  }

  function _computeEvidenceScore(confidence, feeds, diagnosticCount) {
    // Feed health: proportion of live/public feeds
    var feedHealth = 0;
    var liveFeeds = 0;
    for (var i = 0; i < feeds.length; i++) {
      if (feeds[i].status === 'live' || feeds[i].status === 'public') liveFeeds++;
    }
    feedHealth = feeds.length > 0 ? liveFeeds / feeds.length : 0;

    // Diagnosis coverage: caps at 1.0 after 3+ diagnoses
    var dxCoverage = Math.min(diagnosticCount / 3, 1.0);

    var score = confidence * 0.40 + feedHealth * 0.35 + dxCoverage * 0.25;
    return Math.round(score * 1000) / 1000;
  }

  function _buildNarrative(domainDef, stress, trajectory, dxCount, feeds) {
    var name = domainDef.label;
    var parts = [];

    if (stress > 0.75) {
      parts.push(name + ' shows critical stress at ' + Math.round(stress * 100) + '%.');
    } else if (stress > 0.5) {
      parts.push(name + ' is elevated at ' + Math.round(stress * 100) + '% stress.');
    } else if (stress > 0.25) {
      parts.push(name + ' shows moderate activity at ' + Math.round(stress * 100) + '%.');
    } else {
      parts.push(name + ' is within normal range.');
    }

    if (trajectory === 'rising') parts.push('Trajectory is rising.');
    else if (trajectory === 'declining') parts.push('Trajectory is declining.');

    var liveFeeds = 0;
    for (var i = 0; i < feeds.length; i++) {
      if (feeds[i].status === 'live' || feeds[i].status === 'public') liveFeeds++;
    }
    if (liveFeeds === 0) {
      parts.push('No live feeds — using heuristic model.');
    } else if (liveFeeds < feeds.length) {
      parts.push(liveFeeds + '/' + feeds.length + ' feeds active.');
    }

    if (dxCount > 0) {
      parts.push(dxCount + ' active diagnos' + (dxCount === 1 ? 'is' : 'es') + '.');
    }

    return parts.join(' ');
  }

  function _buildAlerts(domainReports) {
    var alerts = [];
    for (var i = 0; i < domainReports.length; i++) {
      var d = domainReports[i];
      if (d.stress > 0.75) {
        alerts.push({
          level: 'critical',
          domain: d.domainId,
          label: d.label,
          message: d.label + ' at ' + Math.round(d.stress * 100) + '% stress — ' + d.trajectory,
          stress: d.stress
        });
      } else if (d.stress > 0.5 && d.trajectory === 'rising') {
        alerts.push({
          level: 'warning',
          domain: d.domainId,
          label: d.label,
          message: d.label + ' rising toward critical (' + Math.round(d.stress * 100) + '%)',
          stress: d.stress
        });
      }
    }
    return alerts;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════

  window.LIMENAnalystReportBuilder = {
    build: build
  };

})();
