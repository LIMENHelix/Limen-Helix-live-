/**
 * discovery-engine.js
 * LIMEN HELIX — Discovery Engine
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Generates exploration suggestions from domain signals and
 * cross-domain patterns. All suggestions are advisory only.
 *
 * Categories: scientific-discovery, technological-innovation,
 *             economic-opportunity, system-risk
 *
 * Output: window.LIMENDiscoveries — max 10 active suggestions
 * Event: limen:discoveries-updated
 *
 * Load order: after domain-connectome-map.js
 */

(function () {
  'use strict';

  // ─── Seed suggestions ────────────────────────────────────────────────────
  // Minimum 20 seed suggestions across all domains (24 with infrastructure).
  // Relevance is dynamically computed from current domain stress.

  var SEEDS = [
    // Economy (mirrors Energy/Infrastructure/Culture/Finance, translated to MACRO-AGGREGATE concepts —
    //   the macro business cycle, NOT capital markets (finance owns banks/credit/counterparties):
    //   storage→fiscal/monetary buffer & multiplier resilience, distributed-grid→supply-chain working-capital contagion,
    //   transition→recession/expansion business-cycle resilience, attack-surface→macro-data-pipeline & yield-curve early-warning;
    //   universe: GDP/GDPC1, inflation CPIAUCSL/PCEPI, labor UNRATE/PAYEMS/NROU, policy FEDFUNDS/DGS10/DGS2, sentiment UMCSENT,
    //   output INDPRO, real-wage COMPRNOUT, fiscal GEXPND — real FRED series + broad-market proxies SPY/DIA/TLT/GLD, NO single-company tickers)
    { label: 'Investigate counter-cyclical innovation patterns', domain: 'economy', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore alternative economic indicator models', domain: 'economy', type: 'economic-opportunity', baseRelevance: 0.35 },
    { label: 'Analyze emerging market resilience strategies', domain: 'economy', type: 'economic-opportunity', baseRelevance: 0.30 },
    // Macro-data-pipeline resilience: data lags ARE macro stress (FRED availability, BLS processing-lag acceleration, CPI revisions)
    { label: 'Investigate real-time macro-data infrastructure resilience (FRED availability, BLS processing-lag acceleration)', domain: 'economy', type: 'system-risk', baseRelevance: 0.50 },
    { label: 'Analyze FRED data-quality & CPIAUCSL/PCEPI revisions as a leading recession indicator', domain: 'economy', type: 'scientific-discovery', baseRelevance: 0.45 },
    // Macro-semantic discovery mirroring energy/infra/culture/finance structure (real FRED series + broad-market proxies only)
    { label: 'Investigate FRED UNRATE vs natural-rate-of-unemployment (NROU) divergence for full-employment overshoot risk', domain: 'economy', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore counter-cyclical fiscal-multiplier (FRED GEXPND x consumption elasticity) for recession-resilience design', domain: 'economy', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze FRED DGS10-DGS2 yield-curve inversion as a monetary-policy-trap early-warning signal', domain: 'economy', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate working-capital cycles & credit-crunch contagion across the supply chain (INDPRO vs PAYEMS lead-lag)', domain: 'economy', type: 'system-risk', baseRelevance: 0.40 },
    { label: 'Explore demand-destruction decomposition (FRED GDPC1 consumption vs investment vs net-export collapse)', domain: 'economy', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Analyze real-wage growth (COMPRNOUT deflated by PCEPI) & UMCSENT as a macro-income-pressure indicator', domain: 'economy', type: 'economic-opportunity', baseRelevance: 0.35 },

    // Energy
    { label: 'Explore next-generation energy storage research', domain: 'energy', type: 'technological-innovation', baseRelevance: 0.45 },
    { label: 'Investigate distributed energy grid architectures', domain: 'energy', type: 'technological-innovation', baseRelevance: 0.35 },
    { label: 'Analyze renewable energy transition pathways', domain: 'energy', type: 'economic-opportunity', baseRelevance: 0.40 },

    // Infrastructure (mirrors Energy: storage→deferred-maintenance valuation, distributed-grid→smart-grid design, transition→resilience design)
    { label: 'Investigate deferred-maintenance valuation models for roads, bridges & water mains', domain: 'infrastructure', type: 'economic-opportunity', baseRelevance: 0.35 },
    { label: 'Investigate smart-grid & IoT standardization pathways for transmission/distribution', domain: 'infrastructure', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore climate-resilience infrastructure design patterns for dams, levees & transit', domain: 'infrastructure', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Analyze critical-infrastructure cyber-physical attack surface mapping (SCADA/ICS/CISA KEV)', domain: 'infrastructure', type: 'system-risk', baseRelevance: 0.45 },

    // Culture (mirrors Energy/Infrastructure, translated to culture-native concepts:
    //   storage→viral-moment capture/monetization, distributed-grid→fanbase-lifecycle/taste-network stability,
    //   transition→creator-economy resilience, attack-surface→backlash/cancellation-recovery early-warning)
    { label: 'Explore audience-attention economy metrics and virality prediction for emerging music scenes', domain: 'culture', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Investigate fanbase-lifecycle modeling and creator-revenue sustainability systems', domain: 'culture', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze scene-saturation detection and cultural-breakout early-warning patterns', domain: 'culture', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate viral-moment monetization and creator-burnout mitigation in the attention economy', domain: 'culture', type: 'technological-innovation', baseRelevance: 0.35 },
    { label: 'Explore backlash-resilience and cancellation-recovery systems for artists and creators', domain: 'culture', type: 'economic-opportunity', baseRelevance: 0.35 },

    // Finance (mirrors Energy/Infrastructure/Culture, translated to finance-native concepts:
    //   storage→working-capital/liquidity buffering, distributed-grid→multi-counterparty exposure topology,
    //   transition→capital-structure deleveraging & credit-cycle resilience, attack-surface→default-contagion/systemic-risk early-warning;
    //   universe: capital markets, credit & lending, banking, liquidity & solvency, payments/fintech, corporate distress — JPM/BAC/GS/MS/BLK/V/MA/SCHW/C/WFC/KKR/BX)
    { label: 'Investigate counter-cyclical credit-allocation & solvency-premium / credit-spread arbitrage patterns', domain: 'finance', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore working-capital-less supply-chain financing and capital-structure deleveraging models', domain: 'finance', type: 'technological-innovation', baseRelevance: 0.35 },
    { label: 'Analyze counterparty-default contagion & concentration early-warning for multi-counterparty exposure', domain: 'finance', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate liquidity-management, repo-resilience & cross-border settlement-risk modeling', domain: 'finance', type: 'technological-innovation', baseRelevance: 0.40 },

    // Environment
    { label: 'Explore carbon capture technology innovations', domain: 'environment', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Investigate biodiversity monitoring systems', domain: 'environment', type: 'scientific-discovery', baseRelevance: 0.35 },
    { label: 'Analyze ecosystem tipping point research', domain: 'environment', type: 'system-risk', baseRelevance: 0.45 },

    // Health
    { label: 'Review novel therapeutic modality research', domain: 'health', type: 'scientific-discovery', baseRelevance: 0.45 },
    { label: 'Investigate precision medicine advances', domain: 'health', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Explore digital health monitoring innovations', domain: 'health', type: 'technological-innovation', baseRelevance: 0.35 },

    // Technology (mirrors Energy/Infrastructure/Culture/Finance/Economy, translated to technology-native concepts:
    //   storage→AI/ML hardware iteration & custom-chip competition, distributed-grid→cloud-infrastructure fault tolerance,
    //   transition→advanced-node migration & chiplet yields, attack-surface→cybersecurity incident response & zero-day discovery lag;
    //   identity = semiconductors & compute, AI/ML, software & cloud, hardware & devices, cybersecurity, R&D pipelines, platform networks, data infrastructure;
    //   universe: AAPL/MSFT/NVDA/GOOGL/META/AMZN/AVGO/ORCL/CRM/AMD/INTC/TSM/ASML/PLTR/CRWD/PANW — couples to energy via compute demand, kept distinct from finance (fintech is a coupling))
    { label: 'Investigate semiconductor supply-chain bottlenecks (TSM/ASML foundry utilization, chiplet yields, advanced-node migration)', domain: 'technology', type: 'system-risk', baseRelevance: 0.50 },
    { label: 'Explore AI/ML hardware iteration cycles and custom-chip competition (NVDA/AMD/GOOGL TPU)', domain: 'technology', type: 'technological-innovation', baseRelevance: 0.45 },
    { label: 'Analyze cybersecurity incident response capability and zero-day discovery lag (CRWD/PANW/PLTR)', domain: 'technology', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate cloud-infrastructure fault tolerance and multi-region failover resilience', domain: 'technology', type: 'system-risk', baseRelevance: 0.40 },
    // AI-capex mitigation: efficient-inference & token-per-FLOP optimization as a leading indicator on training-cost inflation (NVDA/AMD/GOOGL/MSFT compute spend)
    { label: 'Explore efficient-inference architectures and token-per-FLOP optimization for AI-capex mitigation (NVDA/AMD GPU allocation, training-cost inflation)', domain: 'technology', type: 'technological-innovation', baseRelevance: 0.40 },
    // Platform-consolidation & open-source adoption as risk-mitigation for vendor lock-in / API-deprecation exposure (MSFT/ORCL/CRM/AMZN/GOOGL platform networks)
    { label: 'Analyze platform-consolidation and open-source-adoption as risk-mitigation for vendor lock-in and API-deprecation (MSFT/ORCL/CRM/AMZN platform networks)', domain: 'technology', type: 'economic-opportunity', baseRelevance: 0.40 },
    // Supply-chain cyber-resilience: hardening the chip-fab dependency graph against state-level attacks (TSM/ASML/Samsung), distinct from incident-response capability above
    { label: 'Investigate supply-chain cyber-resilience and fab-dependency hardening against state-level attacks (TSM/ASML/Samsung, CISA KEV exposure)', domain: 'technology', type: 'system-risk', baseRelevance: 0.45 },
    // Quantum-computing milestone tracking & obsolescence-acceleration on classical-chip roadmaps (breakthrough-rate signal, transformative-model & post-quantum-crypto timing)
    { label: 'Explore quantum-computing milestone tracking and obsolescence-acceleration for classical-chip and post-quantum-crypto roadmaps', domain: 'technology', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Investigate neuromorphic computing architectures', domain: 'technology', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore human-computer interface research', domain: 'technology', type: 'scientific-discovery', baseRelevance: 0.35 },
    { label: 'Analyze cybersecurity threat evolution patterns', domain: 'technology', type: 'system-risk', baseRelevance: 0.30 },

    // Research
    { label: 'Review open science infrastructure development', domain: 'research', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Investigate reproducibility crisis solutions', domain: 'research', type: 'scientific-discovery', baseRelevance: 0.45 },
    { label: 'Explore interdisciplinary research convergence', domain: 'research', type: 'scientific-discovery', baseRelevance: 0.35 },

    // Supply Chain
    { label: 'Investigate supply chain resilience modeling', domain: 'supplyChain', type: 'system-risk', baseRelevance: 0.40 },
    { label: 'Explore autonomous logistics innovations', domain: 'supplyChain', type: 'technological-innovation', baseRelevance: 0.35 },
    { label: 'Analyze critical resource dependency mapping', domain: 'supplyChain', type: 'system-risk', baseRelevance: 0.45 },

    // Defense (mirrors Energy/Infrastructure structure, translated to kinetic/industrial/readiness concepts —
    //   threat-posture assessment (mirror of risk analysis), industrial-base capacity modeling (mirror of
    //   infrastructure resilience), procurement-cycle acceleration (mirror of capital-structure deleveraging),
    //   supply-chain hardening (mirror of logistics optimization). Relevance = defense stress x trend boost.
    //   identity = military spending & procurement, defense industrial base, geopolitical conflict & deterrence,
    //   weapons systems, military readiness, alliances & basing, electronic/kinetic warfare, strategic deterrence;
    //   universe: LMT/RTX/NOC/GD/BA/LHX/HII/LDOS/BAH/KTOS/AVAV — couples to energy via fuel/strategic-reserve,
    //   kept DISTINCT from intelligence (collection/analysis/espionage) and from technology (cyber is a coupling))
    { label: 'Analyze geopolitical threat-posture and deterrence-credibility assessment for conflict early-warning (LMT/RTX/NOC missile & deterrence systems)', domain: 'defense', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate defense industrial-base capacity modeling and munitions-surge production resilience (GD/HII shipyards, LMT/RTX magazine depth)', domain: 'defense', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore procurement-cycle acceleration and program-of-record cost-overrun mitigation (BA/LHX/GD major-platform acquisition reform)', domain: 'defense', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze defense supply-chain hardening and critical-component (rare-earth, microelectronics, solid-rocket-motor) dependency mapping (RTX/NOC/LHX, KTOS)', domain: 'defense', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate military readiness degradation and sustainment-backlog modeling across fleets and basing (HII/GD depot throughput, LDOS/BAH sustainment)', domain: 'defense', type: 'system-risk', baseRelevance: 0.40 },
    { label: 'Explore next-generation weapons-system and autonomous/attritable-platform programs as a force-structure shift (AVAV/KTOS uncrewed systems, hypersonics LMT/RTX)', domain: 'defense', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Analyze electronic & kinetic warfare capability gaps and counter-UAS/directed-energy readiness (RTX/NOC/LHX EW suites, KTOS targets)', domain: 'defense', type: 'technological-innovation', baseRelevance: 0.35 },
    { label: 'Investigate alliance-burden-sharing and forward-basing posture shifts as a procurement-demand signal (allied FMS pipeline, LMT/RTX/GD export programs)', domain: 'defense', type: 'economic-opportunity', baseRelevance: 0.35 },

    // Intelligence (mirrors Energy/Infrastructure/Defense structure, translated to collection/analysis/espionage concepts —
    //   collection-gap mitigation (mirror of capacity/resilience), analytical-debiasing research (mirror of scientific discovery),
    //   insider-threat/trust-boundary hardening (mirror of attack-surface mapping), attribution/counterintelligence (mirror of
    //   threat-warning), oversight-reform & trust-restoration (mirror of institutional resilience). Relevance = intelligence stress x trend boost.
    //   identity = intelligence collection (SIGINT/HUMINT/GEOINT/OSINT), all-source analysis & assessment, espionage &
    //   counterintelligence, surveillance & reconnaissance, threat warning, covert action, information & influence operations,
    //   security clearance & insider risk;
    //   universe: PLTR/BAH/LDOS/CACI/SAIC/KBR/VRNT/NICE/VRSK — couples to defense via shared contractors but kept DISTINCT
    //   (defense = kinetic/industrial/readiness; intelligence = collection/analysis/espionage) and from technology (cyber tooling is a coupling, not the identity))
    { label: 'Investigate collection-gap structural mitigation across SIGINT/HUMINT/GEOINT expansion and all-source fusion (PLTR Gotham deployment, BAH/LDOS collection platforms)', domain: 'intelligence', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore trusted-AI and debiasing-algorithm research for analytical-distortion reduction in all-source assessment (CACI/SAIC analytic tradecraft, model-assurance pipelines)', domain: 'intelligence', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Analyze insider-threat and trust-boundary security infrastructure across cleared-workforce and compartmented-access systems (PLTR/CACI continuous-evaluation, KBR/SAIC SCIF hardening)', domain: 'intelligence', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate counterintelligence and foreign-interference attribution platforms for influence-operation and espionage detection (VRNT/NICE analytics, VRSK risk-intelligence)', domain: 'intelligence', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore oversight-reform and transparency-accountability mechanisms for collection-authority and surveillance-program governance (FISA/EO-12333 compliance tooling, BAH/LDOS audit infrastructure)', domain: 'intelligence', type: 'economic-opportunity', baseRelevance: 0.35 },
    { label: 'Analyze public-trust restoration and surveillance-ethics institutional reform as a counterintelligence-resilience signal (declassification cadence, oversight-board posture, SAIC/CACI governance modernization)', domain: 'intelligence', type: 'system-risk', baseRelevance: 0.40 },

    // Industry (mirrors Energy/Infrastructure structure, translated to manufacturing & industrial-production concepts —
    //   Energy seeds focus on storage & grid architectures; industry seeds focus on PRODUCTION-THROUGHPUT resilience and
    //   AUTOMATION-DISPLACEMENT: storage→capacity-utilization buffering, distributed-grid→industrial-base capacity topology,
    //   transition→automation/reshoring economics & industrial-recession resilience, attack-surface→predictive-maintenance &
    //   throughput early-warning. Relevance = industry stress x trend boost.
    //   identity = manufacturing & industrial production, factory output & capacity utilization, automation & robotics,
    //   heavy industry & capital goods, industrial supply chains, machinery & equipment, industrial maintenance;
    //   bind to ISM PMI, FRED capacity-utilization (TCU), PAYEMS manufacturing employment (MANEMP), wage growth (CES3000000008);
    //   universe: CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV/GEV — couples to technology via automation (a coupling, not the identity),
    //   kept DISTINCT from trade (logistics/commerce), economy (macro aggregate) and technology (chips/AI/cloud))
    { label: 'Investigate capacity-utilization forecasting platforms for factory-output throughput resilience (FRED TCU capacity-utilization vs ISM PMI lead-lag, CAT/DE/EMR order-backlog signals)', domain: 'industry', type: 'economic-opportunity', baseRelevance: 0.45 },
    { label: 'Explore automation & robotics ROI modeling and payback-cycle analysis for capital-equipment adoption (ROK/EMR/HON factory-automation, ETN/PH motion & control)', domain: 'industry', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Analyze reshoring & nearshoring economics and domestic-capacity buildout for industrial-base resilience (MMM/ITW/DOV plant footprint, CAT/DE heavy-equipment demand)', domain: 'industry', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate predictive-maintenance adoption (IoT sensors, AI diagnostics) for unplanned-downtime mitigation across heavy industry (GE/HON/EMR industrial IoT, ROK/ETN condition monitoring)', domain: 'industry', type: 'technological-innovation', baseRelevance: 0.45 },
    { label: 'Explore industrial workforce reskilling and automation-displacement mitigation as a throughput-continuity signal (MANEMP manufacturing employment vs CES3000000008 wage growth, skills-gap modeling)', domain: 'industry', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze machinery & capital-goods merger / consolidation trends and pricing-power concentration (CAT/DE equipment, EMR/HON/MMM diversified-industrial portfolio reshaping)', domain: 'industry', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate industrial-recession resilience and order-book contraction early-warning across capital-goods cycles (ISM PMI contraction, CAT/DE/DOV/ITW backlog & inventory destocking)', domain: 'industry', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore production-throughput resilience and automation-displacement mitigation under capacity-utilization stress (FRED TCU drawdown, GEV/ROK/PH automation buildout vs MANEMP labor-displacement)', domain: 'industry', type: 'system-risk', baseRelevance: 0.45 }
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _discoveries = [];
  var _idCounter = 0;
  var MAX_ACTIVE = 10;

  // ─── Relevance computation ───────────────────────────────────────────────

  function _computeRelevance(seed) {
    var domains = window.LIMENDomains || {};
    var d = domains[seed.domain];
    // Truth-preferred: civilization packet truth (brain-derived) > brainStress
    // > flat civ-side stress. Keeps discovery aligned with domain-truth row.
    var packets = (window.LIMENCivilizationAdapter && window.LIMENCivilizationAdapter.getAll())
                || window.LIMENCivilizationPackets || {};
    var pkt = packets[seed.domain];
    var stress = (pkt && pkt.truth && typeof pkt.truth.stressScore === 'number') ? pkt.truth.stressScore
               : (pkt && typeof pkt.stressScore === 'number')                    ? pkt.stressScore
               : (d && typeof d.brainStress === 'number')                        ? d.brainStress
               : (d && d.stress !== undefined)                                   ? d.stress
               : 0;

    // Relevance = baseRelevance boosted by domain stress
    var relevance = seed.baseRelevance + stress * 0.40;

    // Boost further if domain is trending up
    if (d && d.trend > 0.05) {
      relevance += 0.08;
    }

    // Boost risk suggestions more when stress is high
    if (seed.type === 'system-risk' && stress > 0.60) {
      relevance += 0.10;
    }

    return Math.round(Math.min(1, relevance) * 100) / 100;
  }

  // ─── Cross-domain opportunity boost ──────────────────────────────────────

  function _getOpportunityBoosts() {
    var crossDomain = window.LIMENCrossDomain || {};
    var active = crossDomain.active || [];
    var boosts = {};

    for (var i = 0; i < active.length; i++) {
      var pattern = active[i];
      for (var d = 0; d < pattern.domains.length; d++) {
        var domain = pattern.domains[d];
        if (!boosts[domain]) boosts[domain] = 0;
        boosts[domain] += 0.12;
      }
    }

    return boosts;
  }

  // ─── Discovery generation ────────────────────────────────────────────────

  function compute() {
    var boosts = _getOpportunityBoosts();
    var scored = [];

    for (var i = 0; i < SEEDS.length; i++) {
      var seed = SEEDS[i];
      var relevance = _computeRelevance(seed);

      // Apply cross-domain boost
      if (boosts[seed.domain]) {
        relevance = Math.min(1, relevance + boosts[seed.domain]);
      }

      // Only include if above threshold
      if (relevance > 0.50) {
        _idCounter++;
        scored.push({
          id: 'disc_' + _idCounter,
          label: seed.label,
          domain: seed.domain,
          type: seed.type,
          relevance: relevance,
          generatedAt: Date.now()
        });
      }
    }

    // Sort by relevance descending
    scored.sort(function (a, b) { return b.relevance - a.relevance; });

    // Cap at MAX_ACTIVE
    _discoveries = scored.slice(0, MAX_ACTIVE);
    window.LIMENDiscoveries = _discoveries;

    // Emit event
    _dispatch('limen:discoveries-updated', {
      discoveries: _discoveries,
      timestamp: Date.now()
    });

    return _discoveries;
  }

  // ─── Event listeners ─────────────────────────────────────────────────────

  function _onOpportunity() {
    compute();
  }

  function _onWorldUpdate() {
    compute();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:opportunity-detected', _onOpportunity);
    window.addEventListener('limen:world-signals-updated', _onWorldUpdate);
    window.addEventListener('limen:domain-update', _onWorldUpdate);
    compute();
  }

  function stop() {
    window.removeEventListener('limen:opportunity-detected', _onOpportunity);
    window.removeEventListener('limen:world-signals-updated', _onWorldUpdate);
    window.removeEventListener('limen:domain-update', _onWorldUpdate);
    _discoveries = [];
    window.LIMENDiscoveries = [];
  }

  function getDiscoveries() {
    return _discoveries.slice();
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENDiscoveries = [];

  window.LIMENDiscoveryEngine = {
    start: start,
    stop: stop,
    compute: compute,
    getDiscoveries: getDiscoveries
  };

})();
