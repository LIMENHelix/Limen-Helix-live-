/**
 * domain-biosensor-adapter.js — Domain-Safe Biosensor Consumption Layer
 *
 * Sits between biosensorEngine/bridge and domain brains.
 * Provides a stable, guarded API that domains can safely consume.
 *
 * Guardrails:
 *   - Staleness: rejects data older than 5 seconds
 *   - Confidence floor: requires >= 0.3 before returning data
 *   - Soft weighting: returns influence weight (0-0.3) based on confidence
 *   - Graceful fallback: returns null if unavailable (domain uses snapshot-only)
 *   - No emission pollution: biosensor state never propagates through inter-brain bus
 *
 * Domain-specific interpretation maps:
 *   Each domain can register its own meaning for biosensor signals.
 *   Default interpretation provided for all 20 domains.
 *
 * Exposes: window.LIMENDomainBiosensorAdapter
 */
(function () {
  'use strict';

  var STALE_THRESHOLD_MS = 5000;  // 5 seconds
  var CONFIDENCE_FLOOR = 0.3;
  var MAX_WEIGHT = 0.3;           // Biosensor never exceeds 30% influence

  // ══════════════════════════════════════════════════════════════════════
  // CORE READ — guarded access to biosensor state
  // ══════════════════════════════════════════════════════════════════════

  function _getBridge() {
    return window.LIMENBiosensorBridge || null;
  }

  function _getBiosensor() {
    return window.LIMENBiosensor || null;
  }

  /**
   * Get raw biosensor state with staleness and confidence guards.
   * Returns null if unavailable, stale, or below confidence floor.
   */
  function getRawState() {
    var bio = _getBiosensor();
    if (!bio || !bio.active) return null;

    var bridge = _getBridge();
    var state = bridge && typeof bridge.getState === 'function' ? bridge.getState() : null;

    // Read available metrics
    var arousal = typeof bio.arousal === 'number' ? bio.arousal : 0;
    var coherence = typeof bio.coherence === 'number' ? bio.coherence : 0;
    var cognitiveLoad = typeof bio.cognitiveLoad === 'number' ? bio.cognitiveLoad : 0;
    var heartRate = typeof bio.heartRate === 'number' ? bio.heartRate : 0;
    var hrv = typeof bio.hrv === 'number' ? bio.hrv : 0;

    // Compute confidence from available channels
    var confidence = 0;
    confidence += 0.30; // behavior channel always active if bio.active
    if (heartRate > 0) confidence += 0.35;
    if (cognitiveLoad > 0.05) confidence += 0.15; // motion-derived load
    confidence = Math.min(1, confidence);

    // Confidence floor
    if (confidence < CONFIDENCE_FLOOR) return null;

    // Staleness check — use bridge state timestamp if available
    var timestamp = (state && state.timestamp) ? state.timestamp : Date.now();
    if (Date.now() - timestamp > STALE_THRESHOLD_MS) return null;

    // Regulation state from bridge
    var regulation = 'unknown';
    if (state && state.state) regulation = state.state;

    return {
      arousal: arousal,
      coherence: coherence,
      cognitiveLoad: cognitiveLoad,
      heartRate: heartRate,
      hrv: hrv,
      regulation: regulation,
      confidence: confidence,
      weight: Math.min(MAX_WEIGHT, confidence * MAX_WEIGHT),
      timestamp: timestamp,
      fresh: true
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // DOMAIN INTERPRETATION — what biosensor signals mean per domain
  // ══════════════════════════════════════════════════════════════════════

  var DOMAIN_INTERPRETATIONS = {
    energy: {
      label: 'Operator load and system vigilance',
      arousal: 'Operator activation level — high arousal during grid events suggests urgency-driven decision pressure',
      coherence: 'Decision quality indicator — low coherence during high-stress operations suggests error-prone state',
      cognitiveLoad: 'Information processing burden — high load with multiple active diagnoses suggests operator overload'
    },
    finance: {
      label: 'Decision cadence and risk perception',
      arousal: 'Trading urgency — high arousal during market volatility may amplify impulsive positioning',
      coherence: 'Analytical consistency — low coherence during drawdowns suggests emotional rather than systematic decisions',
      cognitiveLoad: 'Portfolio complexity burden — high load with many open positions suggests attention fragmentation',
      // Capital-deployment readiness map: regulation state → capital-deployment / risk-appetite
      // intake posture. Consumed by finance-clarity-operator outcome tracking (deployment velocity,
      // underwriting throughput, liquidity & solvency triage, deal/M&A pipeline momentum). Financial
      // identity only: capital markets, credit & lending, banking, liquidity & solvency, investment &
      // funding, M&A, payments & fintech, corporate distress & default, systemic financial risk.
      // Reference financial-identity names: JPM, BAC, GS, MS, BLK, V, MA, SCHW, C, WFC, KKR, BX.
      // STRICTLY ADDITIVE — does not touch the validated P3 distress kernel (Thing1) scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to deploy aggressively: open new capital-deployment programs, expand underwriting and credit-lending intake, initiate speculative M&A diligence, increase risk appetite and position sizing (GS/MS underwriting, KKR/BX deal origination, BLK allocation, JPM/BAC lending growth).',
        focused: 'Productive engagement — sustain in-flight deals and underwriting pipelines; admit only well-scoped new intake (proven counterparties, single-name credit lines, completed-diligence M&A); hold open-ended speculative origination (SCHW/V/MA flow steady, WFC/C lending disciplined).',
        pressured: 'Elevated load — defer discretionary deployment and new speculative positions; pause new M&A diligence and fresh credit-lending intake; keep liquidity monitoring and existing-portfolio risk management active; tighten risk appetite.',
        overloaded: 'Saturated — pause all new capital deployment and deal intake; focus solely on solvency triage: covenant/default-risk exposures, liquidity coverage shortfalls, counterparty-default and systemic-financial-risk containment, margin-call and funding-runway protection.',
        recovering: 'Stabilizing — resume selective redeployment first into proven low-risk credit and liquid positions, then reopen underwriting, lending and M&A intake gradually as liquidity coverage, capital ratios and deployment velocity normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (validated distress/solvency screen and deal-pipeline momentum ranking).'
      }
    },
    supplyChain: {
      label: 'Logistics coordination stress',
      arousal: 'Operational urgency — high arousal during supply disruptions reflects real-time coordination pressure',
      coherence: 'Routing decision quality — low coherence during multi-node failures suggests overwhelmed coordination',
      cognitiveLoad: 'Simultaneous disruption management — high load with cascading failures reflects system overextension'
    },
    economy: {
      label: 'Macroeconomic assessment pressure',
      arousal: 'Policy response urgency — high arousal during macro shocks suggests reactive rather than deliberate assessment',
      coherence: 'Forecast consistency — low coherence during contradictory signals suggests unreliable economic outlook',
      cognitiveLoad: 'Indicator complexity — high load with multiple concurrent stress signals suggests analytical saturation'
    },
    infrastructure: {
      label: 'Maintenance and response readiness',
      arousal: 'Emergency response activation — high arousal during infrastructure failures reflects crisis-mode operations',
      coherence: 'Prioritization quality — low coherence during multi-asset stress suggests fragmented maintenance decisions',
      cognitiveLoad: 'Asset management complexity — high load with deferred maintenance backlog reflects capacity constraints',
      // Civil execution-readiness map: regulation state → infrastructure intake/triage posture.
      // Consumed by infrastructure-clarity-operator outcome tracking (permit approvals,
      // construction velocity, maintenance completion rate). Civil identity only:
      // roads/bridges, water & sewer mains, the electric grid (transmission/distribution
      // reliability), transit, dams & levees, cyber-physical SCADA/ICS, public works.
      readiness: {
        calm: 'Steady operator state — safe to accept new long-cycle work: environmental permits, NEPA/feasibility studies, grid-interconnection reviews, bridge/dam inspection planning, multi-year capital programming.',
        focused: 'Productive engagement — sustain in-flight capital projects and scheduled maintenance; admit only well-scoped new intake (single-asset rehab, routine SCADA patch windows).',
        pressured: 'Elevated load — defer discretionary maintenance inspections and non-urgent permit reviews; hold new long-cycle intake; keep construction velocity and reliability monitoring active.',
        overloaded: 'Saturated — pause all new capital project intake; focus solely on critical-asset triage: structurally deficient bridges, dam/levee integrity, water-main breaks, CISA KEV / ICS exposures on operational SCADA.',
        recovering: 'Stabilizing — resume deferred maintenance inspections first, then reopen permit and capital intake gradually as construction velocity and maintenance completion rate normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (deferred-maintenance backlog and asset-criticality ranking).'
      }
    },
    agriculture: {
      label: 'Seasonal and supply chain pressure',
      arousal: 'Harvest and market urgency — high arousal during crop stress or price spikes reflects time-critical decisions',
      coherence: 'Planning consistency — low coherence during weather uncertainty suggests reactive rather than strategic response',
      cognitiveLoad: 'Multi-factor assessment — high load with weather, market, and supply chain signals reflects decision overload'
    },
    governance: {
      label: 'Policy formation and institutional pressure',
      arousal: 'Political urgency — high arousal during governance crises reflects accelerated decision timelines',
      coherence: 'Policy consistency — low coherence during multi-stakeholder conflict suggests fragmented institutional response',
      cognitiveLoad: 'Regulatory complexity — high load with competing policy demands reflects institutional overextension'
    },
    research: {
      label: 'Research intensity and discovery state',
      arousal: 'Investigation drive — moderate arousal during active research reflects productive engagement',
      coherence: 'Methodological rigor — high coherence during analysis suggests systematic investigation',
      cognitiveLoad: 'Analytical depth — high load during complex data interpretation reflects deep processing'
    },
    health: {
      label: 'Clinical attention and system regulation capacity',
      arousal: 'Clinical urgency — high arousal during active diagnoses reflects care delivery pressure',
      coherence: 'Coordination quality — low coherence during multi-provider scenarios suggests care fragmentation risk',
      cognitiveLoad: 'Clinical complexity — high load with chronic disease burden reflects sustained care management demand'
    },
    education: {
      label: 'Learning engagement and cognitive capacity',
      arousal: 'Engagement level — moderate arousal reflects productive learning state',
      coherence: 'Comprehension quality — high coherence during instruction suggests effective knowledge transfer',
      cognitiveLoad: 'Curriculum complexity — high load reflects deep processing or overextension'
    },
    technology: {
      label: 'Threat awareness and system monitoring intensity',
      arousal: 'Cyber vigilance — high arousal during active threats reflects heightened monitoring state',
      coherence: 'Incident response quality — low coherence during cascading failures suggests overwhelmed triage',
      cognitiveLoad: 'System complexity — high load with multiple active vulnerabilities reflects monitoring overload'
    },
    communication: {
      label: 'Information processing and signal clarity',
      arousal: 'Information urgency — high arousal during disinformation events reflects narrative processing pressure',
      coherence: 'Signal quality — low coherence during high-volume information reflects difficulty filtering noise',
      cognitiveLoad: 'Narrative complexity — high load with competing narratives reflects interpretive overload'
    },
    culture: {
      label: 'Identity engagement and creative state',
      arousal: 'Cultural activation — moderate arousal reflects engaged participation in cultural discourse',
      coherence: 'Symbolic consistency — high coherence reflects stable identity and cultural grounding',
      cognitiveLoad: 'Interpretive depth — high load during complex cultural analysis reflects meaning-making effort',
      // Cultural production-readiness map: regulation state → cultural-production pace/intake posture.
      // Consumed by culture-clarity-operator outcome tracking (new-artist discovery, creator-partnership
      // momentum, fanbase engagement, streaming/virality velocity). Cultural identity only:
      // music scenes, artists & creators, genres, streaming & virality, fanbases & audience attention,
      // cultural movements & discourse, festivals/venues, taste-making & trend emergence, the attention economy.
      readiness: {
        calm: 'Steady operator state — safe to greenlight new cultural movements: festival programming, art-funding initiatives, emerging-artist platforms and aggressive new-creator discovery; open speculative genre/scene scouting.',
        focused: 'Productive engagement — sustain current music-scene momentum and creator partnerships; admit only proven-artist new projects and well-scoped scene investments; hold open-ended discovery.',
        pressured: 'Elevated load — defer speculative cultural initiatives and new music-scene investment intake; focus on existing fanbase engagement and streaming/virality velocity; keep proven-creator momentum active.',
        overloaded: 'Saturated — pause all new cultural-discovery programs; respond only to top-tier viral moments; triage critical-creator burnout and mental-health, audience-trust and reputational risk.',
        recovering: 'Stabilizing — resume emerging-artist scouting first, then reopen cultural-movement and festival intake gradually as creator-sustainability and audience-health metrics normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (fanbase-engagement signals and proven-creator momentum ranking).'
      }
    },
    defense: {
      label: 'Threat vigilance and operational readiness',
      arousal: 'Combat readiness — high arousal during active threats reflects heightened operational posture',
      coherence: 'Command quality — low coherence during multi-front engagement suggests fragmented coordination',
      cognitiveLoad: 'Situational awareness — high load with multiple threat vectors reflects cognitive bandwidth stress'
    },
    environment: {
      label: 'Ecological monitoring and response urgency',
      arousal: 'Environmental urgency — high arousal during ecological crises reflects time-critical intervention pressure',
      coherence: 'Assessment quality — low coherence during compound environmental stress suggests overwhelmed monitoring',
      cognitiveLoad: 'System complexity — high load with interacting environmental factors reflects analytical difficulty'
    },
    religion: {
      label: 'Contemplative state and community engagement',
      arousal: 'Community activation — high arousal during institutional stress reflects engaged concern',
      coherence: 'Spiritual consistency — high coherence reflects grounded contemplative state',
      cognitiveLoad: 'Theological complexity — high load during doctrinal conflict reflects deep interpretive effort'
    },
    population: {
      label: 'Demographic assessment and migration pressure',
      arousal: 'Demographic urgency — high arousal during population shocks reflects time-critical policy pressure',
      coherence: 'Assessment quality — low coherence during contradictory demographic signals suggests unreliable forecasting',
      cognitiveLoad: 'Modeling complexity — high load with migration and aging data reflects analytical burden'
    },
    law: {
      label: 'Regulatory attention and compliance pressure',
      arousal: 'Enforcement urgency — high arousal during legal crises reflects accelerated compliance timelines',
      coherence: 'Interpretive consistency — low coherence during regulatory change suggests uncertain compliance posture',
      cognitiveLoad: 'Legal complexity — high load with competing regulations reflects compliance overload'
    },
    intelligence: {
      label: 'Analytical intensity and threat detection state',
      arousal: 'Threat awareness — high arousal reflects heightened surveillance and detection mode',
      coherence: 'Analytical quality — low coherence during information overload suggests degraded threat assessment',
      cognitiveLoad: 'Signal processing depth — high load with weak signals reflects intensive pattern detection effort'
    },
    industry: {
      label: 'Production coordination and maintenance pressure',
      arousal: 'Operational urgency — high arousal during equipment failures reflects immediate intervention pressure',
      coherence: 'Process quality — low coherence during multi-line disruptions suggests fragmented coordination',
      cognitiveLoad: 'Production complexity — high load with simultaneous maintenance demands reflects capacity stress'
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // DOMAIN-SAFE API — what domain brains call
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Get biosensor input for a specific domain.
   * Returns null if biosensor unavailable, stale, or low-confidence.
   *
   * Usage in domain brain normalizeSignals():
   *   var bio = window.LIMENDomainBiosensorAdapter.getForDomain('energy');
   *   if (bio) {
   *     // bio.arousal, bio.coherence, bio.weight, bio.interpretation
   *   }
   */
  function getForDomain(domainId) {
    var raw = getRawState();
    if (!raw) return null;

    var interp = DOMAIN_INTERPRETATIONS[domainId] || {
      label: 'General operator state',
      arousal: 'Activation level',
      coherence: 'Decision quality indicator',
      cognitiveLoad: 'Processing burden'
    };

    // Resolve regulation state → domain execution-readiness guidance, when the domain
    // defines a readiness map (e.g. infrastructure: calm/focused/pressured/overloaded/
    // recovering → intake/triage posture). Domains without a readiness map resolve to null
    // (unchanged behavior — they continue using snapshot-driven prioritization).
    var readinessMap = interp.readiness || null;
    var readinessGuidance = null;
    if (readinessMap) {
      var regKey = raw.regulation;
      readinessGuidance = (regKey && readinessMap[regKey]) || readinessMap.unknown || null;
    }

    return {
      // Normalized metrics (0-1)
      arousal: raw.arousal,
      coherence: raw.coherence,
      cognitiveLoad: raw.cognitiveLoad,
      heartRate: raw.heartRate,
      hrv: raw.hrv,

      // Regulation state (calm/focused/pressured/overloaded/recovering/unknown)
      regulation: raw.regulation,

      // Confidence and weight
      confidence: raw.confidence,
      weight: raw.weight,               // 0-0.3 — max influence on domain stress

      // Domain-specific interpretation
      interpretation: interp,

      // Execution-readiness guidance resolved from current regulation state
      // (null for domains without a readiness map — energy and others unchanged).
      readiness: readinessGuidance,

      // Metadata
      timestamp: raw.timestamp,
      fresh: raw.fresh,
      domainId: domainId
    };
  }

  /**
   * Check if biosensor is available and above confidence floor.
   */
  function isAvailable() {
    return getRawState() !== null;
  }

  /**
   * Get audit summary for all domains.
   */
  function getAuditReport() {
    var raw = getRawState();
    var available = raw !== null;
    var report = {
      biosensorAvailable: available,
      confidence: raw ? raw.confidence : 0,
      weight: raw ? raw.weight : 0,
      regulation: raw ? raw.regulation : 'unavailable',
      staleThresholdMs: STALE_THRESHOLD_MS,
      confidenceFloor: CONFIDENCE_FLOOR,
      maxWeight: MAX_WEIGHT,
      domains: {}
    };

    for (var domainId in DOMAIN_INTERPRETATIONS) {
      report.domains[domainId] = {
        supported: true,
        active: available,
        interpretationLabel: DOMAIN_INTERPRETATIONS[domainId].label,
        influencePath: available ? 'biosensor → adapter → normalizeSignals() short-arc input' : 'none (fallback to domain-snapshot)',
        fallback: 'domain-snapshot stress (unchanged)'
      };
    }

    return report;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENDomainBiosensorAdapter = {
    getForDomain: getForDomain,
    getRawState: getRawState,
    isAvailable: isAvailable,
    getAuditReport: getAuditReport,
    INTERPRETATIONS: DOMAIN_INTERPRETATIONS,
    STALE_THRESHOLD_MS: STALE_THRESHOLD_MS,
    CONFIDENCE_FLOOR: CONFIDENCE_FLOOR,
    MAX_WEIGHT: MAX_WEIGHT
  };

  console.log('[DomainBiosensorAdapter] Loaded — 20-domain biosensor consumption layer ready');

})();
