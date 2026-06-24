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
    { label: 'Analyze critical resource dependency mapping', domain: 'supplyChain', type: 'system-risk', baseRelevance: 0.45 }
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
