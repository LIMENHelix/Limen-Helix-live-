/**
 * action-suggester.js
 * LIMEN HELIX — Action Suggestion Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Maps domain signals and LIMEN phases into exploration or regulation prompts.
 * Does not make decisions — only suggests possible investigative directions.
 *
 * Action types: discovery, monitoring, regulation, analysis
 *
 * Output: window.LIMENActions (array of current suggestions)
 * Events: limen:user-action (emitted when user selects an action)
 *
 * Load order: after event-narrator.js
 */

(function () {
  'use strict';

  // ─── Action rule definitions ─────────────────────────────────────────────
  // Each rule: domain condition -> array of suggestions

  var DOMAIN_ACTIONS = {
    economy: [
      { label: 'Monitor unemployment trend (UNRATE) and jobless-claims (ICSA) for demand-shock signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Analyze labor-force participation (CIVPART) and wage growth (COMPRNFB) for real-income pressure', type: 'analysis', minStress: 0.4 },
      { label: 'Investigate yield-curve (DGS10 - DGS2) inversion and credit-spread widening for policy-trap exposure', type: 'analysis', minStress: 0.5 },
      { label: 'Analyze GDP-growth (GDPC1) trajectory and demand-component weakness (consumption vs investment)', type: 'analysis', minStress: 0.6 },
      { label: 'Investigate recession-probability indicators and inflation-unanchoring risk (PCE expectations)', type: 'regulation', minStress: 0.7 }
    ],
    agriculture: [
      { label: 'Monitor commodity-price signals and weather-stress indicators (CBOT corn/soy/wheat futures, USDA WASDE crop conditions, drought-severity indices) across ADM, BG, CTVA, DE, NTR farm-output and agribusiness throughput', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore crop-insurance hedging strategies and commodity-price-risk management for grain, livestock and food-production operators (TSN, CAG, INGR, ADM, BG margin-protection adoption)', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze input-cost exposure and fertilizer/seed availability across agricultural supply chains (NTR, MOS, CF, FMC, CTVA crop-nutrient and crop-protection throughput)', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate water-availability and irrigation-investment ROI for drought resilience across farm-equipment and precision-ag operators (DE, AGCO, CTVA irrigation and yield-optimization capex)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate crop-failure and livestock-disease containment with emergency input supply and farm-debt triage across agribusiness and food-security operators (ADM, BG, TSN, CAG, NTR, MOS critical-supply failure points)', type: 'regulation', minStress: 0.7 }
    ],
    energy: [
      { label: 'Monitor energy price signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore renewable energy technologies', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze supply chain disruptions', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate grid resilience strategies', type: 'regulation', minStress: 0.7 }
    ],
    industry: [
      { label: 'Monitor production-output and capacity-utilization signals (ISM PMI sub-indices, INDPRO, TCU capacity index, equipment-downtime) across CAT, DE, GE, HON, MMM, EMR factory throughput', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore reshoring economics and predictive-maintenance/automation-displacement mitigation (ROK, ETN, ITW, PH, DOV robotics and industrial-automation adoption curves)', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze automation-ROI versus equipment-investment payback and supply-chain resilience for capital-goods producers (CAT, DE, EMR, ROK, GEV order-backlog vs capex)', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate workforce-transition exposure and machinery-order softening as automation adoption reshapes industrial labor (HON, MMM, ITW, ETN, PH labor-intensity shift)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate production-halt triage and equipment-failure cascade containment across heavy-industry and machinery supply chains (GE, GEV, DOV, ROK critical-line failure points)', type: 'regulation', minStress: 0.7 }
    ],
    infrastructure: [
      { label: 'Monitor electric grid transmission/distribution reliability', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore resilient infrastructure funding & capital reallocation', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze construction materials & contractor availability', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate SCADA/ICS breach vectors and deferred-maintenance failure points', type: 'regulation', minStress: 0.7 }
    ],
    environment: [
      { label: 'Monitor GHG emissions (Scope 1/2/3) and carbon-budget tracking across waste, water and utility operators (WM, RSG, WCN, CWST, AWK, WTRG)', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore emissions-reduction, water-treatment and carbon-sequestration technologies (XYL, ECL, LIN, APD industrial-gas and clean-water adoption curves)', type: 'discovery', minStress: 0.4 },
      { label: 'Investigate pollution-event triage and air/water/soil remediation throughput across environmental-services operators (DAR, AY, CWST hazardous-waste and renewable-resource processing)', type: 'analysis', minStress: 0.5 },
      { label: 'Analyze regulatory-compliance exposure and emissions-cap breach risk across waste and water utilities (WM, RSG, WCN landfill-methane, AWK, WTRG discharge-permit limits)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate emissions-crisis containment and remediation acceleration as carbon-market and discharge-limit pressure compounds (DAR, AY, ECL spill-response and treatment-capacity surge)', type: 'regulation', minStress: 0.7 }
    ],
    health: [
      { label: 'Monitor disease-outbreak and pandemic-surge signals (CDC NNDSS case counts, WHO outbreak bulletins, wastewater-surveillance positivity, hospital-admission rate) against care-provider and managed-care throughput (UNH, CVS, HCA, CI, ELV)', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore therapeutic-pipeline emergence and platform-modality breakthroughs (mRNA, GLP-1, cell/gene therapy, antibody-drug-conjugate cadence) across pharma and biotech developers (LLY, NVO, PFE, MRK, ABBV, AMGN, GILD, REGN, VRTX)', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze clinical-trial failure and drug-pipeline-impact exposure (ClinicalTrials.gov phase-transition rate, Phase III readout misses, late-stage attrition) across pharmaceutical and medical-device developers (PFE, MRK, BMY, JNJ, MDT, ISRG, ABT, TMO)', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate hospital-capacity crisis and elective-surgery backlog with staffing-shortage and ICU-occupancy triage across acute-care and device operators (HCA, THC, UHS, CVS, MDT, ISRG, BSX procedure-volume recovery)', type: 'analysis', minStress: 0.6 },
      { label: 'Investigate reimbursement-cut and CMS payment-model disruption exposure (Medicare/Medicaid rate revisions, IRA drug-price negotiation, value-based-care shift) across insurers and pharma (UNH, ELV, CI, HUM, CNC, LLY, ABBV, MRK margin transmission)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate FDA-setback and pharmaceutical-recall containment with supply-continuity, drug-shortage triage and patient-safety response across pharma, biotech and device makers (PFE, MRK, ABBV, LLY, AMGN, GILD, JNJ, MDT, ABT, ISRG, TMO critical-supply and recall failure points)', type: 'regulation', minStress: 0.7 }
    ],
    technology: [
      { label: 'Monitor chip-cycle indicators (TSMC/Samsung wafer starts, fab utilization, lead-time contraction) across TSM, ASML, AVGO, AMD, INTC, NVDA', type: 'monitoring', minStress: 0.3 },
      { label: 'Monitor breakthrough emergence in foundational models and chip architecture (NVDA, GOOGL, MSFT, META transformative-model release cadence)', type: 'discovery', minStress: 0.4 },
      { label: 'Investigate AI-capex efficiency and inference-cost optimization across foundational-model ecosystem (MSFT, AMZN, GOOGL, META, ORCL training-per-token inflation)', type: 'analysis', minStress: 0.5 },
      { label: 'Analyze platform-consolidation risk and API deprecation contagion across major vendors (AAPL, MSFT, GOOGL, CRM, ORCL, PLTR)', type: 'analysis', minStress: 0.6 },
      { label: 'Explore cybersecurity resilience and supply-chain attack surface hardening (CRWD, PANW zero-day exploit rate, dependency contagion)', type: 'regulation', minStress: 0.7 }
    ],
    research: [
      { label: 'Monitor publication integrity signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore open science initiatives', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze funding allocation patterns', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate reproducibility concerns', type: 'analysis', minStress: 0.7 }
    ],
    supplyChain: [
      { label: 'Monitor logistics delay indicators', type: 'monitoring', minStress: 0.3 },
      { label: 'Identify affected industries', type: 'analysis', minStress: 0.4 },
      { label: 'Map disruption clusters', type: 'analysis', minStress: 0.5 },
      { label: 'Detect innovation gaps', type: 'discovery', minStress: 0.7 }
    ],
    communication: [
      { label: 'Monitor network outage incidents and connectivity disruption signals (Cloudflare Radar, NetBlocks, CISA advisories) across broadband and telecom operators (VZ, T, TMUS, CMCSA, CHTR)', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore spectrum-efficient and resilient network architectures (5G, fiber, satellite) and censorship-resistant communication protocols across telecom and infrastructure providers (CSCO, ANET, AMT, CCI, SBAC)', type: 'discovery', minStress: 0.4 },
      { label: 'Investigate media-trust collapse and misinformation-propagation vectors across journalism and media platforms (NWSA, NYT, META, GOOGL)', type: 'analysis', minStress: 0.5 },
      { label: 'Analyze platform concentration and broadcast-capacity bottlenecks (META, GOOGL market share, spectrum allocation limits)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate misinformation surge and censorship events with counter-narrative infrastructure and platform-moderation capacity (fact-check systems, content authentication, regulatory coordination)', type: 'regulation', minStress: 0.7 }
    ],
    culture: [
      { label: 'Monitor viral-moment saturation and audience attention patterns', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore creator-sustainability and fanbase-lifecycle modeling', type: 'discovery', minStress: 0.4 },
      { label: 'Investigate backlash-resilience and cultural-recovery patterns', type: 'analysis', minStress: 0.5 },
      { label: 'Analyze scene-consolidation and cultural-movement momentum', type: 'analysis', minStress: 0.6 }
    ],
    finance: [
      { label: 'Monitor credit-spread dynamics and bank funding/liquidity stress signals', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore deleveraging and capital-structure repositioning opportunities', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze solvency-ratio deterioration and covenant-breach exposure', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate liquidity-crunch mitigation and systemic-contagion containment', type: 'regulation', minStress: 0.7 }
    ],
    defense: [
      { label: 'Monitor force-readiness and troop-movement indicators across allied basing', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore weapons-modernization timelines and defense-industrial base capacity (LMT, RTX, GD, BA, NOC, LHX, HII procurement roadmaps)', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze munitions-stockpile depletion and strategic-deterrence credibility exposure (LDOS, KTOS, AVAV, BAH replenishment throughput)', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate alliance-stress and basing-rights vulnerability across forward-deployed theaters', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate conflict-escalation pathways and deterrence-failure containment', type: 'regulation', minStress: 0.7 }
    ],
    intelligence: [
      { label: 'Monitor SIGINT/HUMINT/OSINT collection volume and source quality metrics', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore counterintelligence capabilities and insider-threat detection systems (PLTR, BAH, LDOS, CACI, SAIC procurement roadmaps)', type: 'discovery', minStress: 0.4 },
      { label: 'Investigate trust-boundary breaches and surveillance-oversight gaps (CISA KEV, Fed Register, OFAC designations) across collection programs', type: 'analysis', minStress: 0.5 },
      { label: 'Analyze all-source assessment fusion and analytical-bias exposure (VRNT, NICE, VRSK, KBR signal-to-noise degradation)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate collection expansion and analytical debiasing to restore public trust and oversight compliance', type: 'regulation', minStress: 0.7 }
    ],
    governance: [
      { label: 'Monitor institutional-integrity signals (World Bank WGI government-effectiveness, control-of-corruption and rule-of-law indicators, V-Dem democracy/liberal-component scores) for institutional-erosion drift across public-administration delivery (TYL, MMS govtech throughput)', type: 'monitoring', minStress: 0.3 },
      { label: 'Explore policy-effectiveness emergence in legislative velocity and rulemaking volume (Congress.gov bill-passage cadence, Federal Register regulatory-publication rate, OECD regulatory-quality and institutional-trust indicators) reshaping public-service delivery (ACN, GDIT modernization roadmaps)', type: 'discovery', minStress: 0.4 },
      { label: 'Analyze electoral-system capacity and democratic-institution strain (voter-access restrictions, election-administration funding, Brennan Center voting-rights tracking, V-Dem electoral-component backsliding) for legitimacy exposure', type: 'analysis', minStress: 0.5 },
      { label: 'Investigate regulatory-oversight gaps and agency-capture signals (GAO oversight findings and high-risk-list designations, POGO accountability reports, CBO fiscal-governance assessments, Federal Register enforcement-action trend) across public institutions (BAH, LDOS oversight-modernization programs)', type: 'analysis', minStress: 0.6 },
      { label: 'Regulate public-trust restoration and accountability-mechanism reinforcement as policy-gridlock and legitimacy-crisis pressure compound (World Bank WGI voice-and-accountability decline, V-Dem backsliding, GAO oversight failures, Federal Register regulatory-instability surge)', type: 'regulation', minStress: 0.7 }
    ]
  };

  // ─── Cross-reference opportunity rules ───────────────────────────────────
  // When multiple domains are elevated, generate opportunity prompts

  var CROSS_RULES = [
    {
      domains: ['health', 'technology'],
      minStress: [0.4, 0.4],
      label: 'Explore medical technology innovation opportunity',
      body: 'Rising health research activity combined with technology disruption signals.',
      type: 'discovery'
    },
    {
      domains: ['health', 'research'],
      minStress: [0.5, 0.4],
      label: 'Investigate emerging treatment research convergence',
      body: 'Health stress signals aligning with research activity shifts.',
      type: 'discovery'
    },
    {
      domains: ['energy', 'environment'],
      minStress: [0.4, 0.4],
      label: 'Explore clean energy transition opportunity',
      body: 'Energy volatility intersecting with environmental stress indicators.',
      type: 'discovery'
    },
    {
      domains: ['economy', 'supplyChain'],
      minStress: [0.5, 0.5],
      label: 'Analyze economic resilience through supply chain adaptation',
      body: 'Economic and supply chain stress co-occurring — structural opportunity.',
      type: 'analysis'
    },
    {
      domains: ['technology', 'research'],
      minStress: [0.4, 0.4],
      label: 'Investigate research technology innovation convergence',
      body: 'Technology disruption aligning with research pattern shifts.',
      type: 'discovery'
    },
    {
      domains: ['economy', 'energy'],
      minStress: [0.5, 0.5],
      label: 'Analyze energy-economic coupling vulnerabilities',
      body: 'Co-elevated stress in economy and energy domains suggests structural exposure.',
      type: 'analysis'
    },
    {
      domains: ['infrastructure', 'economy'],
      minStress: [0.5, 0.5],
      label: 'Analyze infrastructure capex as counter-cyclical stimulus',
      body: 'Co-elevated infrastructure and economic stress suggests deferred-maintenance and funding-gap exposure; infrastructure capex (fixed investment, GPDI) can act as counter-cyclical fiscal stimulus against weakening GDP-growth (GDPC1) and rising unemployment (UNRATE).',
      type: 'analysis'
    },
    {
      domains: ['infrastructure', 'technology'],
      minStress: [0.4, 0.4],
      label: 'Investigate cyber-physical infrastructure hardening convergence',
      body: 'Infrastructure stress intersecting with technology disruption signals SCADA/ICS and grid-reliability exposure.',
      type: 'discovery'
    },
    {
      domains: ['culture', 'technology'],
      minStress: [0.4, 0.4],
      label: 'Investigate attention-market and taste-making platform convergence',
      body: 'Cultural stress intersecting with technology disruption signals streaming/virality distribution and creator-platform exposure.',
      type: 'discovery'
    },
    {
      domains: ['culture', 'economy'],
      minStress: [0.5, 0.5],
      label: 'Investigate creator-economy as counter-cyclical employment',
      body: 'Co-elevated cultural and economic stress suggests creator-economy funding-gap and fanbase-lifecycle exposure; creator/gig employment can absorb labor-market slack as payrolls (PAYEMS) soften and labor-force participation (CIVPART) weakens.',
      type: 'analysis'
    },
    {
      domains: ['industry', 'technology'],
      minStress: [0.4, 0.4],
      label: 'Investigate factory-automation and robotics adoption convergence',
      body: 'Industrial production stress intersecting with technology disruption signals automation/robotics displacement and predictive-maintenance retooling exposure across capital-goods producers (CAT, DE, ROK, ETN, EMR).',
      type: 'discovery'
    },
    {
      domains: ['industry', 'economy'],
      minStress: [0.5, 0.5],
      label: 'Analyze capacity-utilization slack as a leading demand-shock signal',
      body: 'Co-elevated industrial and economic stress suggests capacity-utilization (TCU) and production-output (INDPRO) contraction leading the cycle; machinery-order softening (CAT, DE, EMR backlogs) tends to front-run weakening GDP-growth (GDPC1) and rising unemployment (UNRATE).',
      type: 'analysis'
    },
    {
      domains: ['finance', 'economy'],
      minStress: [0.5, 0.5],
      label: 'Analyze credit-cycle transmission to solvency and margin pressure',
      body: 'Co-elevated finance and economic stress suggests credit-tightening, solvency-contagion and liquidity-transmission exposure across lenders and capital markets; trace policy-rate (FEDFUNDS) and credit-spread transmission into corporate solvency and margin pressure as demand (GDPC1) and consumer sentiment (UMCSENT) weaken.',
      type: 'analysis'
    },
    {
      domains: ['environment', 'industry'],
      minStress: [0.5, 0.4],
      label: 'Analyze emissions-cap exposure and regulatory-compliance contagion across heavy industry',
      body: 'Co-elevated environmental and industrial stress suggests Scope 1/2 emissions and discharge-permit breach risk concentrating in capital-goods and heavy-industry production (CAT, DE, EMR throughput) as carbon-cap and remediation pressure rise on waste/water operators (WM, RSG, AWK); regulatory-compliance cost can front-run margin compression.',
      type: 'analysis'
    },
    {
      domains: ['environment', 'health'],
      minStress: [0.5, 0.4],
      label: 'Investigate pollution-event and water/air-quality public-health convergence',
      body: 'Environmental stress intersecting with health signals suggests air/water/soil pollution-event triage and remediation exposure (DAR, AY, CWST hazardous-waste, AWK, WTRG drinking-water quality) coupling into public-health burden and treatment demand.',
      type: 'discovery'
    },
    {
      domains: ['environment', 'energy'],
      minStress: [0.5, 0.4],
      label: 'Investigate carbon-market and decarbonization-transition coupling',
      body: 'Environmental emissions/carbon-budget stress couples to energy via decarbonization demand; trace emissions-reduction and carbon-sequestration adoption (XYL, ECL, LIN, APD) against energy-transition pressure — environment carries the climate/compliance identity, energy carries supply/grid, coupled through carbon markets.',
      type: 'discovery'
    }
  ];

  // ─── Phase-sensitive action modifiers ────────────────────────────────────

  var PHASE_ACTIONS = {
    P1: { label: 'Investigate disruption source', type: 'analysis' },
    P3: { label: 'Monitor threat indicators closely', type: 'monitoring' },
    P5: { label: 'Explore emerging awareness patterns', type: 'discovery' },
    P7: { label: 'Observe dissolution process', type: 'monitoring' },
    P9: { label: 'Prepare for threshold transition', type: 'regulation' },
    P10: { label: 'Consolidate new integration patterns', type: 'regulation' }
  };

  // ─── State ───────────────────────────────────────────────────────────────

  var currentActions = [];
  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  // ─── Action computation ──────────────────────────────────────────────────

  function computeActions() {
    var domains = window.LIMENDomains || {};
    var phase = window.LIMENPhase || {};
    var actions = [];

    // Domain-specific actions
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d || d.stress === undefined) continue;

      var domainRules = DOMAIN_ACTIONS[k] || [];
      for (var r = 0; r < domainRules.length; r++) {
        var rule = domainRules[r];
        if (d.stress >= rule.minStress) {
          actions.push({
            label: rule.label,
            domain: k,
            type: rule.type,
            priority: Math.round(d.stress * 100) / 100
          });
        }
      }
    }

    // Cross-reference opportunities
    for (var c = 0; c < CROSS_RULES.length; c++) {
      var cr = CROSS_RULES[c];
      var allMet = true;
      var avgStress = 0;

      for (var cd = 0; cd < cr.domains.length; cd++) {
        var domData = domains[cr.domains[cd]];
        if (!domData || domData.stress < cr.minStress[cd]) {
          allMet = false;
          break;
        }
        avgStress += domData.stress;
      }

      if (allMet) {
        avgStress = avgStress / cr.domains.length;
        actions.push({
          label: cr.label,
          domain: cr.domains.join('+'),
          type: cr.type,
          priority: Math.round(avgStress * 100) / 100,
          crossReference: true,
          body: cr.body
        });
      }
    }

    // Phase-sensitive action
    if (phase.estimated && PHASE_ACTIONS[phase.estimated]) {
      var pa = PHASE_ACTIONS[phase.estimated];
      actions.push({
        label: pa.label,
        domain: 'phase',
        type: pa.type,
        priority: phase.confidence || 0.5,
        phaseAction: true
      });
    }

    // Sort by priority descending
    actions.sort(function (a, b) { return b.priority - a.priority; });

    // Cap at 10
    if (actions.length > 10) actions = actions.slice(0, 10);

    currentActions = actions;
    window.LIMENActions = currentActions;

    return currentActions;
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    computeActions();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:domain-update', _onDomainUpdate);
    computeActions();
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    currentActions = [];
    window.LIMENActions = [];
  }

  function getActions() {
    return currentActions.slice();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENActions = currentActions;

  window.LIMENActionSuggester = {
    start: start,
    stop: stop,
    getActions: getActions,
    compute: computeActions
  };

})();
