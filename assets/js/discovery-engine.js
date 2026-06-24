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

    // Environment (mirrors Energy/Infrastructure/Finance structure, translated to environment-native concepts —
    //   Energy seeds focus on storage/grid/renewable ARCHITECTURES; environment seeds focus on EMISSIONS/POLLUTION/
    //   ECOSYSTEM/WATER as domain-native content: storage→carbon-budget exhaustion & emissions-intensity buffering,
    //   distributed-grid→ecosystem-resilience & biodiversity-tipping-point topology, transition→just-transition &
    //   climate-adaptation resilience, attack-surface→climate-risk & supply-chain Scope-3 early-warning. Couples to
    //   energy ONLY via carbon footprint — NEVER borrows oil/gas/grid/power-generation as its OWN identity; couples to
    //   agriculture/water domains via land/water-use but keeps environmental identity = climate/pollution/ecosystems.
    //   identity = climate & emissions, air/water/soil pollution & quality, ecosystems & biodiversity, natural
    //   resources & conservation, environmental regulation & compliance, climate risk & adaptation, waste management &
    //   remediation, carbon markets;
    //   universe: WM/RSG/WCN/CWST (waste & remediation), AWK/WTRG/XYL (water utilities & infrastructure),
    //   ECL/LIN/APD (water/air treatment & industrial-gas / carbon-capture feedstock), DAR (renewable-feedstock &
    //   waste-valorization), AY (clean-infrastructure / sustainable assets) — real environmental-sector tickers only)
    { label: 'Investigate emissions-intensity forecasting and carbon-budget exhaustion early-warning across high-Scope-1 sectors (WM/RSG/WCN landfill-methane capture, ECL/LIN/APD process-emissions intensity)', domain: 'environment', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore water-stress modeling and freshwater-scarcity adaptation for utility-resilience and drought-exposure pricing (AWK/WTRG supply security, XYL water-efficiency & leakage reduction)', domain: 'environment', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze biodiversity-resilience and ecosystem-tipping-point research for nature-based-solution and conservation-ROI design (wetlands/forests/oceans as carbon sinks, ecosystem-service valuation)', domain: 'environment', type: 'scientific-discovery', baseRelevance: 0.45 },
    { label: 'Investigate pollution-remediation ROI and soil/water/air-quality recovery-cycle modeling for contaminated-site cleanup economics (WM/CWST hazardous-waste remediation, ECL water-treatment recovery)', domain: 'environment', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore climate-adaptation infrastructure design patterns for flood/heat/drought resilience and sustainable-asset buildout (AY clean-infrastructure portfolio, WTRG/AWK climate-hardened water systems)', domain: 'environment', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Analyze regulatory-compliance pathway innovation across carbon markets, ESG disclosure and net-zero roadmaps (carbon-pricing exposure, SEC/EU CSRD reporting, ECL/LIN net-zero pathway design)', domain: 'environment', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate nature-based solutions (wetlands, forests, oceans) as climate-carbon sinks and biodiversity-credit infrastructure for offset-quality and permanence assurance', domain: 'environment', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Explore just-transition workforce retraining for green-economy sectors and circular-economy job creation (WM/RSG/ECL/DAR/AY recycling, remediation & renewable-feedstock employment)', domain: 'environment', type: 'economic-opportunity', baseRelevance: 0.35 },
    { label: 'Investigate supply-chain emissions transparency and Scope-3 tracing for value-chain decarbonization and embedded-carbon accounting (LIN/APD industrial-gas footprint, DAR feedstock lifecycle)', domain: 'environment', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze environmental-risk insurance and climate-liability pricing for physical-risk and transition-risk exposure (stranded-asset valuation, remediation-liability provisioning, WM/CWST closure-cost modeling)', domain: 'environment', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore carbon capture technology innovations', domain: 'environment', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Investigate biodiversity monitoring systems', domain: 'environment', type: 'scientific-discovery', baseRelevance: 0.35 },
    { label: 'Analyze ecosystem tipping point research', domain: 'environment', type: 'system-risk', baseRelevance: 0.45 },

    // Health / Medicine (mirrors Energy/Agriculture/Technology/Environment structure, translated to healthcare &
    //   medicine-native concepts — Energy seeds focus on storage/grid/renewable ARCHITECTURES; medicine seeds focus on
    //   DRUG-PIPELINE, HOSPITAL-CAPACITY, PHARMA-PRICING, DISEASE-OUTBREAK and REIMBURSEMENT economics:
    //   storage→drug-inventory & supply buffering / shortage early-warning, distributed-grid→hospital-capacity & ICU-surge
    //   topology, transition→clinical-pipeline migration & care-model shift resilience, attack-surface→outbreak / shortage /
    //   pricing-shock early-warning. Runtime key = 'health' (medicine↔health dual-naming; medicine is the URL/portal key,
    //   health is the snapshot/runtime key — see domain-identity.js). Relevance = health stress x trend boost.
    //   identity = healthcare & medicine, pharmaceuticals & biotech, hospitals & care providers, medical devices &
    //   diagnostics, public health & disease control, clinical research & trials, health systems & insurance, drug development;
    //   universe: UNH/CVS/HCA (payers, pharmacy & hospital systems), JNJ/PFE/MRK/ABBV/LLY/AMGN/GILD (pharma & biotech
    //   pipelines), TMO/ABT/MDT/ISRG (devices, diagnostics & biomanufacturing tools) — real healthcare-sector tickers only;
    //   couples to science via basic research (a coupling, not the identity), to population via disease-burden /
    //   demographics (a coupling), and to economy via health-spending (a coupling); keeps medicine identity = care delivery /
    //   drugs / devices / public health, NEVER energy oil/gas/grid content)
    { label: 'Investigate drug-pipeline delay and clinical-trial-failure early-warning across late-stage development (Phase-III readout risk, FDA CRL & approval-lag signals, JNJ/PFE/MRK/ABBV pipeline attrition vs patent-cliff exposure)', domain: 'health', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore hospital-capacity and ICU-surge modeling for care-delivery resilience under seasonal and outbreak load (bed-occupancy & staffing-ratio stress, HCA/UNH/CVS provider-network throughput, elective-procedure deferral economics)', domain: 'health', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze pharmaceutical-pricing and CMS drug-price-negotiation exposure for revenue-resilience design (IRA Medicare negotiation list, pricing-pressure modeling, LLY/ABBV/MRK net-price vs list-price compression)', domain: 'health', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate disease-outbreak surveillance and vaccine / biomanufacturing supply-chain resilience (CDC/WHO outbreak signals, cold-chain & fill-finish bottlenecks, PFE/MRK/AMGN vaccine capacity, TMO bioprocessing tooling)', domain: 'health', type: 'system-risk', baseRelevance: 0.50 },
    { label: 'Explore reimbursement-cut and payer-contract-negotiation early-warning for provider-margin compression (CMS fee-schedule revisions, prior-authorization friction, UNH/CVS payer leverage vs HCA hospital-margin exposure)', domain: 'health', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze precision-medicine and targeted-therapy adoption for clinical-outcome and pipeline-value improvement (biomarker-stratified trials, companion-diagnostic codevelopment, GILD/AMGN/ABBV oncology & immunology programs)', domain: 'health', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Investigate medical-device and diagnostics innovation cycles for procedure-mix and care-model shifts (robotic surgery & minimally-invasive adoption, ISRG/MDT/ABT device pipelines, point-of-care & at-home diagnostics buildout)', domain: 'health', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore drug-shortage and generic-supply fragility modeling for medication-access resilience (FDA shortage list, sterile-injectable & API single-source dependency, TMO/PFE manufacturing redundancy vs concentration risk)', domain: 'health', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze health-system consolidation and integrated-care economics for cost-of-care and access trade-offs (payer-provider vertical integration, UNH/CVS care-delivery expansion, value-based-care vs fee-for-service margin dynamics)', domain: 'health', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate digital-health and remote-monitoring innovations for chronic-disease management and care-access expansion (wearable & RPM adoption, telehealth reimbursement durability, ABT/MDT connected-device platforms)', domain: 'health', type: 'technological-innovation', baseRelevance: 0.35 },

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

    // Research / Science (mirrors Energy/Health/Education structure, translated to scientific-research &
    //   knowledge-production-native concepts — Energy seeds focus on storage/grid/renewable ARCHITECTURES; research
    //   seeds focus on FUNDING-PIPELINE, PEER-REVIEW & PUBLISHING, RESEARCH-WORKFORCE, IP/PATENT-QUALITY, COMPLIANCE,
    //   INSTRUMENTATION and OPEN-SCIENCE infrastructure: storage→grant-funding & talent-pipeline buffering,
    //   distributed-grid→lab/institution-network & data-sharing topology, transition→open-science & preprint adoption
    //   shift resilience, attack-surface→funding-cliff / reproducibility / misconduct early-warning. Runtime key =
    //   'research' (science↔research dual-naming; science is the URL/portal key, research is the snapshot/runtime key —
    //   see domain-identity.js). Relevance = research stress x trend boost.
    //   identity = scientific research & discovery, basic & applied research, R&D pipelines, academic & lab science,
    //   peer review & publication, research funding & grants, scientific instruments & methods, innovation pipeline;
    //   bind to NSF/NIH grant & funding-rate data, NSF Science & Engineering Indicators, OpenAlex/arXiv/bioRxiv publication
    //   & preprint velocity, Nature/journal disruption signals, USPTO patent-quality & backlog data, NASA/NSF research programs;
    //   universe: TMO/DHR/A/MTD/WAT/ILMN/BIO/RVTY/BRKR/IQV/ICLR (scientific instruments, life-science tools, lab & CRO
    //   infrastructure) — real research-sector tickers only; couples to technology via applied product dev (a coupling, not
    //   the identity), to medicine via clinical research (a coupling), and to education via academic teaching (a coupling);
    //   keeps research identity = knowledge production / funding / publishing / workforce / IP / instrumentation,
    //   NEVER energy oil/gas/grid content)
    { label: 'Investigate research-funding bottleneck and grant-rate compression early-warning for science-pipeline resilience (NSF/NIH success-rate decline, appropriations-cliff & continuing-resolution volatility, indirect-cost-cap exposure, IQV/ICLR CRO funded-research backlog)', domain: 'research', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore peer-review system stress and publication-delay modeling for knowledge-dissemination throughput (reviewer-availability collapse, review-cycle lag acceleration, desk-reject & resubmission churn, Nature/journal editorial-capacity early-warning)', domain: 'research', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze FAIR data-sharing infrastructure adoption and open-science ecosystem health for reproducibility resilience (OpenAlex/data-repository coverage, FAIR-principle compliance, data-availability-statement enforcement, reproducibility-crisis quantification)', domain: 'research', type: 'scientific-discovery', baseRelevance: 0.45 },
    { label: 'Investigate research-workforce pipeline fragility and PhD/postdoc-crisis early-warning for talent-continuity resilience (NSF doctorate enrollment, postdoc-employment & attrition, faculty-track scarcity, A/MTD/WAT instrument-skilled-labor demand)', domain: 'research', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore STEM talent-supply vs demand and underrepresented-group participation for human-capital-supply resilience (NSF Science & Engineering Indicators workforce data, visa-dependent researcher exposure, broadening-participation ROI)', domain: 'research', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze patent-office backlog and patent-quality erosion indicators for innovation-pipeline integrity (USPTO pendency & backlog, low-quality / overbroad patent signals, citation-quality decline, examiner-capacity vs filing-volume mismatch)', domain: 'research', type: 'system-risk', baseRelevance: 0.40 },
    { label: 'Investigate research-compliance burden and IRB-approval-delay modeling for protocol-throughput resilience (IRB queue time, misconduct-investigation capacity, regulatory-paperwork overhead vs bench-time, compliance-cost-per-grant erosion)', domain: 'research', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore scientific-instrument supply-chain and obsolescence modeling for lab-capacity resilience (instrument lead-time & single-source dependency, replacement-cycle economics, TMO/DHR/BRKR/RVTY/ILMN platform refresh vs legacy-instrument obsolescence)', domain: 'research', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Investigate preprint velocity and journal-disruption signals for publishing-model transition resilience (arXiv/bioRxiv adoption acceleration, preprint-to-publication lead-time, open-access vs subscription economics, peer-review decoupling)', domain: 'research', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze research-ethics infrastructure and misconduct-investigation capacity for scientific-integrity resilience (retraction-rate trends, image/data-integrity detection at scale, research-integrity-office throughput, reproducibility-failure early-warning)', domain: 'research', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore international research-collaboration resilience and export-control / visa coupling for cross-border-science continuity (collaboration-network fragmentation, export-control & dual-use research friction, scholar-mobility restriction exposure, NASA/NSF international-program dependency)', domain: 'research', type: 'system-risk', baseRelevance: 0.40 },
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
    { label: 'Explore production-throughput resilience and automation-displacement mitigation under capacity-utilization stress (FRED TCU drawdown, GEV/ROK/PH automation buildout vs MANEMP labor-displacement)', domain: 'industry', type: 'system-risk', baseRelevance: 0.45 },

    // Agriculture (mirrors Energy/Infrastructure/Industry structure, translated to farming & food-production concepts —
    //   Energy seeds focus on storage/grid/renewable ARCHITECTURES; agriculture seeds focus on FARM-MARGIN, YIELD-RESILIENCE,
    //   CROP-INPUTS, FOOD-SECURITY and LAND/LIVESTOCK economics: storage→commodity-price & farm-margin buffering,
    //   distributed-grid→supply-chain / crop-input dependency topology, transition→precision-ag adoption & drought-resilient
    //   irrigation, attack-surface→livestock-disease / yield-shock early-warning. Relevance = agriculture stress x trend boost.
    //   identity = farming & crops, livestock & animal protein, agribusiness & food production, food security & supply,
    //   fertilizers & crop inputs, irrigation & agricultural water, commodity crops (corn/soy/wheat), precision agriculture,
    //   farm economics (debt/land-value/margin);
    //   bind to CBOT corn/soy/wheat futures and USDA WASDE supply-demand estimates;
    //   universe: ADM/BG/CTVA/DE/NTR/MOS/CF/TSN/CAG/INGR/AGCO/FMC — couples to environment via land/water (a coupling, not the
    //   identity), to energy via biofuel/fertilizer-feedstock (a coupling), to trade via export logistics (a coupling), and to
    //   economy via food prices (a coupling); keeps agriculture identity = farms/crops/livestock/agribusiness/food-security)
    { label: 'Investigate commodity-price volatility and farm-margin compression across crop and livestock supply chains (CBOT corn/soy/wheat futures vs USDA WASDE supply-demand, ADM/BG processing margins, TSN/CAG protein spreads)', domain: 'agriculture', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore crop-insurance design and weather-risk hedging mechanisms for smallholder farm resilience (USDA RMA crop-insurance programs, basis-risk modeling, yield-vs-revenue protection structures)', domain: 'agriculture', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze water-scarcity adaptation and irrigation-infrastructure investment for drought-resilient agriculture (USDA drought monitoring, deficit-irrigation efficiency, FMC crop-protection vs water-stressed acreage)', domain: 'agriculture', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate precision-agriculture technology adoption (CTVA/AGCO smart-farming seed & equipment, DE/AGCO IoT field sensing & autonomous machinery) for yield and farm-margin improvement', domain: 'agriculture', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore soil-health and biodiversity management for long-run farm-productivity resilience (NTR/MOS/CF nutrient-stewardship vs soil-carbon, cover-crop & rotation agronomics, regenerative-yield modeling)', domain: 'agriculture', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Analyze livestock-disease containment and veterinary-resource capacity for food-security (avian-influenza / ASF outbreak modeling, TSN herd & flock biosecurity, USDA APHIS surveillance capacity)', domain: 'agriculture', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate farm-debt and land-value dynamics for regional farm-viability assessment (USDA farm-sector balance-sheet, cropland-value vs farm-income leverage, AGCO/DE equipment-financing exposure)', domain: 'agriculture', type: 'economic-opportunity', baseRelevance: 0.40 },

    // Governance (mirrors Infrastructure/Defense/Intelligence structure, translated to government & public-administration concepts —
    //   Energy seeds focus on storage/grid/renewable ARCHITECTURES; governance seeds focus on INSTITUTIONAL-RESILIENCE,
    //   POLICY-EFFECTIVENESS, REGULATORY-INTEGRITY, ELECTORAL-SYSTEM, PUBLIC-FINANCE and ANTI-CORRUPTION pathways:
    //   storage→fiscal-resilience / rainy-day-fund buffering, distributed-grid→cross-agency interoperability & coordination topology,
    //   transition→policy-modernization & institutional-capacity resilience, attack-surface→institutional-erosion / policy-gridlock
    //   early-warning. Governance binds mostly to INSTITUTIONS & INDICATORS, NOT single companies — there are no single-firm
    //   'governance tickets'; opportunities route to systemic-risk / capital-access / research lanes mapped to institutional
    //   innovation. Relevance = governance stress x policy-fragmentation trend x institutional-modernization-lag signal.
    //   identity = government & public administration, public policy & rulemaking, regulation & oversight, elections &
    //   democratic institutions, public finance & budgets, rule of law & institutional integrity, public-services delivery,
    //   political stability & legitimacy;
    //   bind to World Bank WGI, V-Dem, OECD, GAO, CBO and Federal Register / Congress.gov indices — NEVER energy oil/gas/grid;
    //   kept DISTINCT from economy (macro aggregate), finance (capital), law (judicial/legal-system) and intelligence (collection);
    //   where real entities are needed use govtech / public-sector identifiers only: TYL (Tyler Technologies), MMS (Maximus),
    //   BAH (Booz Allen), LDOS (Leidos), ACN (Accenture), GDIT — never fabricate)
    { label: 'Investigate institutional-erosion early-warning via World Bank WGI and V-Dem backsliding signals', domain: 'governance', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze electoral-system capacity and voter-access integrity metrics (election-administration capacity, Brennan Center voting data, voter-access restriction tracking)', domain: 'governance', type: 'system-risk', baseRelevance: 0.40 },
    { label: 'Explore anti-corruption infrastructure and GAO oversight effectiveness (GAO oversight findings, POGO government-oversight reports, conflict-of-interest disclosure systems)', domain: 'governance', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate policy-gridlock detection via Congress.gov legislative-velocity and Federal Register regulatory-volume spikes', domain: 'governance', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore governance-modernization platforms for administrative-workflow, permitting-system digitization and policy-coordination (TYL govtech, MMS digital-government services, ACN/GDIT public-sector modernization)', domain: 'governance', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze public-trust infrastructure (transparency systems, conflict-of-interest disclosure, participatory-governance) via V-Dem legitimacy scores and Pew institutional-confidence trends', domain: 'governance', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate regulatory-clarity systems and unified-regulatory-state design (Federal Register searchability, regulatory-volume normalization, agency-rulemaking coherence)', domain: 'governance', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore fiscal-resilience policy and countercyclical-revenue / rainy-day-fund mechanisms for public-finance stability (CBO budget projections, cross-sector revenue rebalancing)', domain: 'governance', type: 'economic-opportunity', baseRelevance: 0.45 },
    { label: 'Analyze regulatory-capture exposure via agency-rulemaking reversals and captured-industry signals (regulatory-integrity & oversight effectiveness, OECD regulatory-policy indicators)', domain: 'governance', type: 'system-risk', baseRelevance: 0.40 },
    { label: 'Investigate cross-agency coordination infrastructure (interoperability standards, data-sharing protocols, unified-command structures) for institutional-capacity resilience (BAH/LDOS policy-modernization, GDIT data-sharing platforms)', domain: 'governance', type: 'technological-innovation', baseRelevance: 0.40 },

    // Communication (mirrors Energy/Infrastructure/Culture/Technology structure, translated to telecom/networks/media
    //   & information-flow concepts — Energy seeds focus on storage/grid/renewable ARCHITECTURES; communication seeds
    //   focus on the CHANNELS, NETWORKS and INFORMATION FLOW themselves: broadcast-capacity→spectrum-allocation &
    //   interference-mitigation valuation, distributed-grid→network-resilience-through-interoperability &
    //   single-platform-dominance topology, transition→rural-broadband & next-gen-network (5G/6G/fiber) buildout
    //   resilience, attack-surface→information-integrity / misinformation & platform-concentration early-warning,
    //   information-integrity→counter-narrative & fact-check infrastructure. Relevance = communication stress x trend boost.
    //   identity = telecommunications & networks, connectivity & broadband, internet infrastructure (towers/fiber/spectrum/
    //   satellites), media & broadcasting CHANNELS, journalism & news flow, information dissemination, social-media
    //   platforms AS DISTRIBUTION, public-discourse infrastructure;
    //   universe: VZ/T/TMUS/CMCSA/CHTR/CSCO/ANET (telecom & networking), AMT/CCI/SBAC (towers & fiber/spectrum infra),
    //   NWSA/NYT/META/GOOGL (media, news & platform distribution) — real telecom/media tickers only;
    //   couples to technology via chips/software (a coupling, not the identity), kept DISTINCT from culture
    //   (culture = content/movements/scenes; communication = the CHANNELS/networks/information-flow) and from
    //   intelligence (signals collection is a coupling, not the identity))
    { label: 'Investigate spectrum allocation efficiency and interference mitigation for broadband coverage expansion (FCC licensing & auction design, ITU coordination, incumbent-protection relief, VZ/TMUS mid-band deployment)', domain: 'communication', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore censorship-resistant communication architectures and decentralized protocols (mesh networks, satellite internet, VPN resilience, CSCO/ANET routing-layer redundancy)', domain: 'communication', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Analyze telecom-competition dynamics and rural broadband investment ROI (VZ/T/TMUS rural buildout, USDA ReConnect funding, FCC subsidy design, CHTR/CMCSA last-mile economics)', domain: 'communication', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate misinformation early-warning systems and fact-check infrastructure (detection at scale, counter-narrative velocity, audience reach of corrections across NYT/NWSA newsrooms)', domain: 'communication', type: 'scientific-discovery', baseRelevance: 0.45 },
    { label: 'Analyze platform-concentration risk and media-monopoly structural signals (META/GOOGL distribution market share, content-moderation bottleneck, algorithmic amplification of single-platform dominance)', domain: 'communication', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore next-generation network (5G/6G, fiber, low-earth-orbit satellite) buildout resilience and capital-funding valuation for connectivity expansion (CSCO/ANET core gear, AMT/CCI/SBAC tower & fiber backbone)', domain: 'communication', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Investigate network-resilience-through-interoperability and single-carrier-outage contagion topology across interconnected telecom backbones (VZ/T/TMUS peering, CMCSA/CHTR transit dependency mapping)', domain: 'communication', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze tower & passive-infrastructure (REIT) capacity economics and spectrum-densification ROI for sustained connectivity demand (AMT/CCI/SBAC tower leasing, small-cell & DAS densification)', domain: 'communication', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore journalism-sustainability and local-news-desert mitigation as information-dissemination resilience (NYT/NWSA digital-subscription models, newsroom-capacity collapse early-warning)', domain: 'communication', type: 'economic-opportunity', baseRelevance: 0.35 },
    { label: 'Investigate broadcast & streaming distribution-channel disruption and bundle-disintermediation economics (CMCSA/CHTR pay-TV erosion, streaming-platform distribution shift, carriage & retransmission dynamics)', domain: 'communication', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze network cyber-physical attack surface across telecom backbones, undersea cables and routing infrastructure (BGP-hijack & DNS resilience, CSCO/ANET firmware hardening, CISA KEV telecom exposure)', domain: 'communication', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate public-discourse infrastructure and information-integrity counter-narrative systems for civic-information resilience (cross-platform provenance, authenticated-content standards, META/GOOGL distribution transparency)', domain: 'communication', type: 'scientific-discovery', baseRelevance: 0.40 },

    // Education (mirrors Energy/Infrastructure/Health/Finance structure, translated to schooling & learning-system concepts —
    //   Energy seeds focus on storage/grid/renewable ARCHITECTURES; education seeds focus on ENROLLMENT-DEMAND,
    //   STUDENT-OUTCOMES, TEACHER-WORKFORCE, EDUCATION-FUNDING, STUDENT-DEBT and CREDENTIAL-VALUE economics:
    //   storage→enrollment-pipeline & funding-buffer resilience, distributed-grid→school/district-network & teacher-workforce
    //   topology, transition→edtech-adoption & care-model (online/hybrid) shift resilience, attack-surface→funding-cut /
    //   learning-loss / debt-default early-warning. Relevance = education stress x trend boost.
    //   Education RECEIVES 11 cross-domain stress signals (infrastructure/economy/culture/research/intelligence/supplyChain/
    //   environment/industry/agriculture/communication/health) but historically EMITTED ZERO discoveries — these seeds restore
    //   the symmetry so education feeds the discovery engine back.
    //   identity = K-12 schools & higher-ed colleges/universities, edtech & online learning, student outcomes & literacy,
    //   teaching & curriculum design, education funding & access/equity, workforce training & skills, credentialing &
    //   enrollment, student debt & financing;
    //   bind to NCES enrollment & assessment data, NSF science-education indicators, BLS OES workforce series, graduation &
    //   credential-award rates, student-loan delinquency data;
    //   universe: CHGG/COUR/DUOL/LRN/ATGE/LOPE/STRA/LAUR/TWOU/UTI — real education-sector tickers only;
    //   couples to research/science via knowledge-production (a coupling, not the identity), to technology via edtech tooling
    //   (a coupling), to population via demographic/enrollment trends (a coupling), and to economy via workforce output
    //   (a coupling); keeps education identity = schools/learning/teaching/credentials, NEVER energy oil/gas/grid content)
    { label: 'Investigate student-outcome recovery and learning-loss quantification post-disruption for achievement-trajectory resilience (NCES learning-assessments & NAEP score-recovery modeling, achievement-trajectory forecasting, intervention-ROI tracking)', domain: 'education', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore teacher-workforce pipeline and alternative-certification ROI for staffing-continuity resilience (BLS OES educator labor data, career-switcher & residency programs, CHGG/COUR teacher-preparation & credentialing pathways)', domain: 'education', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze K-12 funding fragility and state-budget-cut contagion early-warning (property-tax dependency, federal-aid volatility & ESSER cliff, per-pupil-funding compression across districts)', domain: 'education', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate higher-ed enrollment-demand and credential-value arbitrage for demographic-cohort demand modeling (NCES enrollment trends, online-degree cost advantage & employer-recognition shift, LOPE/STRA/ATGE/LAUR degree-awarding volatility)', domain: 'education', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore edtech adoption ROI and learning-outcome efficacy for adaptive-instruction innovation (DUOL/COUR personalized-learning & learning-analytics prediction, digital-divide early-warning, efficacy-vs-engagement measurement)', domain: 'education', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Analyze student-debt and income-driven-repayment sustainability for default-contagion early-warning (student-loan delinquency data, public-service-loan-forgiveness stress, repayment-resumption shock modeling)', domain: 'education', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate achievement-gap drivers and equity-access interventions for outcome-equity research (poverty-correlation, language-access & EL resourcing, special-ed funding adequacy, NCES disaggregated-outcome analysis)', domain: 'education', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Explore skills-mismatch labor-pipeline and vocational-training modernization for workforce-supply resilience (BLS OES skill-demand vs credential-supply, apprenticeship-expansion & credential-stackability, UTI/STRA career-and-technical training ROI)', domain: 'education', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze curriculum-modernization pace and STEM-literacy gap closure for instructional-relevance risk (NSF science-education indicators, computer-science adoption K-12, quantitative-literacy assessment, LRN/COUR STEM-curriculum delivery)', domain: 'education', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate school-facility deferred-maintenance and infrastructure-modernization ROI for learning-environment resilience (lead-pipe remediation, broadband-access & digital-divide buildout, climate-resilience retrofits, capital-backlog valuation)', domain: 'education', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore credentialing & enrollment volatility and graduation-rate stability for pipeline-throughput early-warning (K-12 graduation rates, higher-ed completion & stop-out modeling, professional-cert demand, TWOU/COUR/LAUR program-completion economics)', domain: 'education', type: 'economic-opportunity', baseRelevance: 0.40 },

    // Population (mirrors Energy/Infrastructure/Culture/Finance/Economy structure, translated to DEMOGRAPHY-native concepts —
    //   Energy seeds focus on storage/grid/renewable ARCHITECTURES; population seeds focus on DEMOGRAPHIC-LIFECYCLE,
    //   FAMILY-FORMATION, WORKFORCE-AGE STABILITY, MIGRATION-INTEGRATION, URBANIZATION-STRAIN and REGIONAL-DEPOPULATION:
    //   storage→demographic buffer / intergenerational-resilience capacity, distributed-grid→household-formation & family-structure
    //   diversity topology, transition→demographic-lifecycle management (youth-absorption / prime-age stability / aging-system capacity),
    //   attack-surface→demographic-cliff / depopulation-drift early-warning. Population binds mostly to INDICATORS not single companies —
    //   use REAL demographic sources (US Census ACS, UN World Population Prospects, Pew Research, BLS prime-age series); where
    //   demographic-exposed entities are needed use real proxies (WELL/VTR senior-living REITs; housing/migration-exposed names) — never fabricate.
    //   identity = demographics & population dynamics, migration & immigration, urbanization & settlement, fertility & mortality,
    //   aging & generational shifts, labor-force & human-capital SUPPLY, household formation & housing demand, social structure & inequality;
    //   couples to economy via labor-market (a coupling, not the identity), to medicine/health via mortality (a coupling), to education via
    //   enrollment (a coupling) and to governance via policy (a coupling); keeps population identity = WHO/WHERE/HOW-MANY people, NEVER energy oil/gas/grid content)
    { label: 'Investigate demographic-lifecycle resilience systems for aging societies (intergenerational transfer design, pension-system sustainability, age-friendly housing and long-term-care infrastructure capacity, WELL/VTR senior-living REIT demand vs old-age dependency ratio)', domain: 'population', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore family-formation policy innovation and demographic-recovery pathways (childcare subsidy ROI, housing-affordability design, parental-leave policy trade-offs, fertility-incentive effectiveness vs UN World Population Prospects fertility trajectories)', domain: 'population', type: 'scientific-discovery', baseRelevance: 0.45 },
    { label: 'Analyze prime-age labor-force-participation recovery and workforce-age-population stabilization (BLS prime-age employment-population ratio, Census Bureau generational-cohort analysis, skill-gap and wage-gap pathways as a human-capital-supply signal)', domain: 'population', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate migration-resettlement infrastructure and displaced-person integration capacity (IOM migration data, refugee-resettlement program throughput, climate-migration absorption systems, Census ACS foreign-born integration outcomes)', domain: 'population', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Explore urbanization-resilience design for megacity infrastructure strain (slum-remediation, affordable-housing development, mass-transit capacity, water/sanitation infrastructure under settlement-density growth, UN urbanization projections)', domain: 'population', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Analyze regional-depopulation dynamics and shrinking-city economic-viability recovery (rural-exodus drivers, out-migration rate, regional-viability index, population-stabilization programs, Census county-level population-loss early-warning)', domain: 'population', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate demographic-cliff and old-age dependency-ratio early-warning for fiscal and care-system load (UN World Population Prospects aging curves, Census median-age drift, household-formation slowdown vs housing-demand mismatch)', domain: 'population', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore household-formation and housing-demand modeling for settlement-pattern resilience (Census household-composition shifts, single-person & multigenerational household growth, Pew Research family-structure diversity as housing-demand drivers)', domain: 'population', type: 'economic-opportunity', baseRelevance: 0.40 },

    // Law (mirrors Governance/Intelligence structure, translated to LEGAL-SYSTEM-native concepts — binds to INSTITUTIONS &
    //   INDICATORS, not single companies (no single-firm 'law tickets'): storage→judicial-capacity / case-backlog buffering,
    //   distributed-grid→court-system & access-to-justice topology, transition→legal-process modernization & rule-of-law
    //   resilience, attack-surface→rule-of-law erosion / judicial-independence early-warning.
    //   identity = legal system & jurisprudence, courts & litigation, rule of law & judicial independence, legislation &
    //   statutory interpretation, access to justice, regulatory & compliance law, dispute resolution, legal-process modernization;
    //   bind to World Justice Project Rule-of-Law Index, US Courts caseload statistics, ABA access-to-justice data, V-Dem judicial
    //   constraints — NEVER energy oil/gas/grid; kept DISTINCT from governance (administration/policy), finance (capital) and
    //   intelligence (collection); where govtech/legaltech entities are needed use real identifiers (TYL court-management software,
    //   RELX/Thomson Reuters legal-data) — never fabricate)
    { label: 'Investigate judicial-capacity and case-backlog early-warning for access-to-justice resilience (US Courts caseload statistics, civil/criminal docket-clearance rates, ABA justice-gap data, TYL court-management modernization)', domain: 'law', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Analyze rule-of-law erosion and judicial-independence backsliding signals (World Justice Project Rule-of-Law Index, V-Dem judicial-constraints scores, court-packing & enforcement-selectivity early-warning)', domain: 'law', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore access-to-justice infrastructure and legal-aid capacity for representation-gap mitigation (ABA legal-aid funding, pro-bono & self-represented-litigant support, online dispute-resolution platforms)', domain: 'law', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Investigate legal-process modernization and legaltech adoption ROI for litigation-efficiency and compliance-cost reduction (e-filing & e-discovery automation, RELX/Thomson Reuters legal-data analytics, contract-lifecycle automation)', domain: 'law', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Analyze regulatory-compliance complexity and statutory-coherence design for legal-clarity resilience (statutory-volume growth, conflicting-rule exposure, compliance-burden modeling across regulated sectors)', domain: 'law', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore dispute-resolution innovation and litigation-alternative pathways for court-load reduction (arbitration & mediation adoption, small-claims modernization, online dispute-resolution scalability)', domain: 'law', type: 'economic-opportunity', baseRelevance: 0.35 },
    // Parity expansion (mirrors governance breadth): adds criminal-justice / decarceration, judicial-nomination throughput,
    //   legaltech-firm adoption depth, restorative-justice scaling, regulatory-enforcement intensity, plain-language
    //   codification, IP-law throughput and constitutional-challenge risk — keeps law = judicial/legal-system, real
    //   indicators (US Courts, ABA, DOJ, SCOTUS, WJP) + real legaltech tickers (RELX/TRI/VERX/CSGP) only, never fabricate.
    { label: 'Explore alternative-dispute-resolution adoption and restorative-justice scaling for decarceration and court-load reduction (DOJ Bureau of Justice Statistics incarceration trends, diversion-program ROI, recidivism-reduction modeling, prosecutorial-discretion patterns)', domain: 'law', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze judicial-nomination deadlock and appellate-court vacancy impact on case throughput (US Courts judgeship-vacancy data, SCOTUS confirmation bottlenecks, district/circuit judicial-emergency designations, judge-productivity vs caseload-per-judgeship)', domain: 'law', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate legal-tech adoption for court and law-firm efficiency and evidence-management (RELX LexisNexis / TRI Thomson Reuters Westlaw research & analytics, VERX compliance automation, CSGP litigation-data infrastructure, e-discovery & matter-management throughput)', domain: 'law', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Explore regulatory-modernization and plain-language codification for compliance clarity (statutory-readability scoring, conflicting-rule reconciliation, unified-codification design, regulated-sector compliance-burden reduction)', domain: 'law', type: 'technological-innovation', baseRelevance: 0.40 },
    { label: 'Investigate prosecutorial-capacity and conviction / case-clearance timing for criminal-justice throughput resilience (DOJ caseload & declination trends, sentencing-guideline coherence, public-defender funding adequacy, charge-to-disposition lag)', domain: 'law', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore legal-service delivery innovation and legal-clinic network design for access expansion (online dispute resolution at scale, court self-help & e-filing portals, ABA access-to-justice initiative ROI, underserved-population representation gaps)', domain: 'law', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze constitutional-challenge and separation-of-powers tension risk for rule-of-law-stability early-warning (SCOTUS docket composition, due-process backsliding signals, contract-enforceability & V-Dem judicial-constraints indicators)', domain: 'law', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate intellectual-property law throughput and patent / trademark dispute-resolution capacity for innovation-protection resilience (USPTO PTAB pendency, IP-litigation backlog, RELX/TRI IP-analytics adoption, infringement-enforcement coherence)', domain: 'law', type: 'economic-opportunity', baseRelevance: 0.35 },
    { label: 'Explore legal-theory and jurisprudence innovation for adjudication-quality and doctrinal-coherence research (empirical legal studies, sentencing-disparity quantification, precedent-stability modeling, World Justice Project Rule-of-Law Index factor analysis)', domain: 'law', type: 'scientific-discovery', baseRelevance: 0.40 },

    // Religion (mirrors Culture/Governance structure, translated to FAITH-COMMUNITY & belief-institution concepts — binds to
    //   INDICATORS & INSTITUTIONS, not single companies: storage→congregation & affiliation buffering, distributed-grid→
    //   faith-community-network & interfaith topology, transition→secularization & generational-affiliation shift resilience,
    //   attack-surface→religious-polarization / persecution / community-decline early-warning.
    //   identity = religious institutions & faith communities, belief & affiliation trends, congregations & worship, interfaith
    //   relations & pluralism, religious freedom & persecution, faith-based social services, secularization & spirituality shifts;
    //   bind to Pew Research Religious Landscape, ARDA (Association of Religion Data Archives), Gallup affiliation surveys, Pew
    //   Global Restrictions on Religion — NEVER energy oil/gas/grid; kept DISTINCT from culture (movements/scenes), governance
    //   (policy) and population (demographics is a coupling, not the identity); never fabricate)
    { label: 'Investigate congregation-decline and affiliation-erosion early-warning for faith-community resilience (Pew Religious Landscape disaffiliation trends, Gallup membership decline, generational secularization vs congregation-viability modeling)', domain: 'religion', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Explore interfaith-cooperation and pluralism infrastructure for religious-polarization mitigation (interfaith-dialogue programs, cross-community trust-building, Pew religious-tolerance indicators)', domain: 'religion', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Analyze religious-freedom and persecution early-warning across global restrictions (Pew Global Restrictions on Religion index, government & social-hostility scores, minority-faith protection signals)', domain: 'religion', type: 'system-risk', baseRelevance: 0.45 },
    { label: 'Investigate faith-based social-service capacity and community-support infrastructure for vulnerable-population resilience (congregation-led charity, food & housing assistance networks, faith-community social-capital measurement)', domain: 'religion', type: 'economic-opportunity', baseRelevance: 0.40 },
    { label: 'Explore secularization and spirituality-shift dynamics for belief-landscape transition modeling (ARDA affiliation data, "nones" growth, unaffiliated-spirituality patterns, generational belief-transmission analysis)', domain: 'religion', type: 'scientific-discovery', baseRelevance: 0.40 },
    { label: 'Analyze religious-institution adaptation and digital-worship transition for engagement resilience (online-congregation adoption, hybrid-worship models, faith-community engagement vs physical-attendance decline)', domain: 'religion', type: 'technological-innovation', baseRelevance: 0.35 }
  ];

  // ─── Religion connectome bindings (energy-parity port) ───────────────────
  // Closes the discovery→resolver loop for religion. The connectome-resolver
  // exposes MACRO_INDICATOR_BINDING / *_COMPANY_BINDING that map a REAL data
  // source to a connectome node so a stressed node can drill to live data.
  // Religion is almost entirely INDICATOR / INSTITUTION based (NOT company
  // tickers), so we mirror the *_INDICATOR_BINDING shape here and expose it
  // for the resolver / UI to consume. Each entry maps a real religion data
  // source (Pew Religious Landscape, ARDA, Gallup, PRRI, World Values Survey,
  // USCIRF / Pew Global Restrictions on Religion) to a real religion connectome
  // node (from brain-node-domains.json) so a discovery proposal can ACTIVATE
  // the source at the node level:
  //   'congregation-decline' → ARDA congregational census (IPS Sacred Architecture)
  //   'religious-freedom'    → USCIRF / Pew Global Restrictions (IC Relpolitics)
  //   'secularization'       → Pew affiliation series (DMN Theological Doctrine)
  // Same shape as MACRO_INDICATOR_BINDING: { series, node, role, nodeRole,
  // label, threshold, dir, kind }. kind:'indicator' (survey/index series) or
  // kind:'institution' (institutional census) — NEVER 'ticker' (no fabricated
  // companies). Couples to population via affiliation demographics and to
  // governance via religious-freedom policy, but identity stays = faith /
  // belief / worship / congregations. NEVER energy oil/gas/grid content.
  var RELIGION_INDICATOR_BINDING = {
    // Affiliation & secularization — Pew Research Religious Landscape Study
    PEW_AFFILIATION: { series: 'PEW_RLS_AFFILIATION', node: 'DMN', role: 'Affiliation & Belief Landscape', nodeRole: 'Theological Doctrine', label: 'Pew Religious Landscape — Affiliation', threshold: -3, dir: 'low', kind: 'indicator', provider: 'Pew Research Center', topic: 'secularization' },
    PEW_NONES: { series: 'PEW_RLS_UNAFFILIATED', node: 'vlPFC', role: 'Unaffiliated ("Nones") Growth', nodeRole: 'buddhism theravada — Signal Acquisition', label: 'Pew — Religiously Unaffiliated Share', threshold: 28, dir: 'high', kind: 'indicator', provider: 'Pew Research Center', topic: 'secularization' },
    // Congregational census & membership — ARDA + Gallup
    ARDA_CONGREGATIONS: { series: 'ARDA_US_RELIGION_CENSUS', node: 'IPS', role: 'Congregational Census & Adherence', nodeRole: 'Sacred Architecture', label: 'ARDA — U.S. Religion Census (congregations & adherents)', threshold: -2, dir: 'low', kind: 'institution', provider: 'Association of Religion Data Archives (ARDA)', topic: 'congregation-decline' },
    GALLUP_MEMBERSHIP: { series: 'GALLUP_CHURCH_MEMBERSHIP', node: 'SC', role: 'Institutional Membership Trend', nodeRole: 'Relorg', label: 'Gallup — Church/Synagogue/Mosque Membership', threshold: 50, dir: 'low', kind: 'indicator', provider: 'Gallup', topic: 'congregation-decline' },
    ARDA_EDUCATION: { series: 'ARDA_RELIGIOUS_EDUCATION', node: 'AG', role: 'Faith-Formation & Religious Education', nodeRole: 'Religious Education', label: 'ARDA — Religious Education & Congregational Programs', threshold: -2, dir: 'low', kind: 'institution', provider: 'Association of Religion Data Archives (ARDA)', topic: 'congregation-decline' },
    // Religious freedom & persecution — USCIRF + Pew Global Restrictions
    USCIRF_FREEDOM: { series: 'USCIRF_CPC_SWL', node: 'IC', role: 'Religious-Freedom & Persecution Watch', nodeRole: 'Relpolitics', label: 'USCIRF — Countries of Particular Concern / Special Watch List', threshold: 1, dir: 'high', kind: 'indicator', provider: 'U.S. Commission on International Religious Freedom (USCIRF)', topic: 'religious-freedom' },
    PEW_GOV_RESTRICTIONS: { series: 'PEW_GRI', node: 'SNS', role: 'Government Restrictions on Religion', nodeRole: 'Religionlaw', label: 'Pew — Government Restrictions Index (GRI)', threshold: 4.5, dir: 'high', kind: 'indicator', provider: 'Pew Research Center', topic: 'religious-freedom' },
    PEW_SOCIAL_HOSTILITY: { series: 'PEW_SHI', node: 'SNS', role: 'Social Hostilities Involving Religion', nodeRole: 'Religionlaw', label: 'Pew — Social Hostilities Index (SHI)', threshold: 3.5, dir: 'high', kind: 'indicator', provider: 'Pew Research Center', topic: 'religious-freedom' },
    // Interfaith & pluralism / values — PRRI + World Values Survey
    PRRI_PLURALISM: { series: 'PRRI_AMERICAN_VALUES', node: 'TPJ', role: 'Interfaith Trust & Pluralism', nodeRole: 'Interfaith Dialogue', label: 'PRRI — American Values Atlas (religious diversity & tolerance)', threshold: -2, dir: 'low', kind: 'indicator', provider: 'Public Religion Research Institute (PRRI)', topic: 'interfaith' },
    WVS_RELIGIOSITY: { series: 'WVS_RELIGIOSITY', node: 'PCC', role: 'Cross-National Religiosity & Belief', nodeRole: 'Meditation & Contemplation', label: 'World Values Survey — Importance of Religion', threshold: -3, dir: 'low', kind: 'indicator', provider: 'World Values Survey Association', topic: 'secularization' }
  };

  // topic → binding-keys index, so a discovery proposal (which carries a
  // resolver-topic) can drill straight to the real sources that quantify it.
  var RELIGION_TOPIC_TO_BINDINGS = (function () {
    var idx = {};
    for (var k in RELIGION_INDICATOR_BINDING) {
      if (!Object.prototype.hasOwnProperty.call(RELIGION_INDICATOR_BINDING, k)) continue;
      var t = RELIGION_INDICATOR_BINDING[k].topic;
      if (!idx[t]) idx[t] = [];
      idx[t].push(k);
    }
    return idx;
  })();

  // Resolve a religion discovery to its live data sources. Returns the bound
  // indicator entries (real Pew/ARDA/Gallup/PRRI/WVS/USCIRF sources + their
  // connectome nodes) so the UI can render trend charts and the resolver can
  // activate the nodes. ADDITIVE: pure read, no mutation of other domains.
  function resolveReligionBindings(topic) {
    var keys = topic ? (RELIGION_TOPIC_TO_BINDINGS[topic] || []) : Object.keys(RELIGION_INDICATOR_BINDING);
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var b = RELIGION_INDICATOR_BINDING[keys[i]];
      if (b) out.push({ key: keys[i], series: b.series, node: b.node, role: b.role, nodeRole: b.nodeRole, label: b.label, provider: b.provider, kind: b.kind, threshold: b.threshold, dir: b.dir, topic: b.topic });
    }
    return out;
  }

  // Infer the resolver-topic for a religion seed from its label, so the
  // discovery→resolver loop is automatic (no per-seed manual wiring).
  function _religionTopicForLabel(label) {
    var s = (label || '').toLowerCase();
    if (s.indexOf('congregation') >= 0 || s.indexOf('membership') >= 0 || s.indexOf('attendance') >= 0 || s.indexOf('social-service') >= 0 || s.indexOf('digital-worship') >= 0 || s.indexOf('engagement') >= 0) return 'congregation-decline';
    if (s.indexOf('persecution') >= 0 || s.indexOf('freedom') >= 0 || s.indexOf('restriction') >= 0 || s.indexOf('hostilit') >= 0) return 'religious-freedom';
    if (s.indexOf('interfaith') >= 0 || s.indexOf('pluralism') >= 0 || s.indexOf('polarization') >= 0 || s.indexOf('tolerance') >= 0) return 'interfaith';
    if (s.indexOf('secular') >= 0 || s.indexOf('affiliation') >= 0 || s.indexOf('spiritual') >= 0 || s.indexOf('belief') >= 0 || s.indexOf('nones') >= 0 || s.indexOf('disaffiliation') >= 0) return 'secularization';
    return 'secularization';
  }

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
        var entry = {
          id: 'disc_' + _idCounter,
          label: seed.label,
          domain: seed.domain,
          type: seed.type,
          relevance: relevance,
          generatedAt: Date.now()
        };
        // Religion closed loop (energy-parity port): attach the resolver-topic
        // and the LIVE data-source bindings (Pew/ARDA/Gallup/PRRI/WVS/USCIRF +
        // their connectome nodes) so the proposal can drill to real sources.
        if (seed.domain === 'religion') {
          var rTopic = _religionTopicForLabel(seed.label);
          entry.resolverTopic = rTopic;
          entry.bindings = resolveReligionBindings(rTopic);
        }
        scored.push(entry);
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

  // Expose religion bindings so the connectome-resolver / UI can consume the
  // discovery→resolver closed loop without reaching into discovery internals.
  window.LIMENReligionBindings = RELIGION_INDICATOR_BINDING;

  window.LIMENDiscoveryEngine = {
    start: start,
    stop: stop,
    compute: compute,
    getDiscoveries: getDiscoveries,
    religionBindings: RELIGION_INDICATOR_BINDING,
    resolveReligionBindings: resolveReligionBindings
  };

})();
