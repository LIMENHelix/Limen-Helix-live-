/**
 * domain-signal-engine.js
 * LIMEN HELIX — Domain Signal Awareness Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Does not replicate kernel logic or compute phi(t).
 *
 * Polls /api/domain-snapshot for real feed data across 7 domains.
 * Each domain has 2 real sources with stress, freshness, and signals.
 * Falls back to heuristic computation if endpoint unavailable.
 *
 * Domains: economy, energy, environment, health, technology, research, supplyChain
 *
 * Output: window.LIMENDomains = { domain: { stress, trend, signals, updated, sources, confidence } }
 * Events: limen:domain-update (every cycle), limen:domain-distress (stress > 0.65)
 *
 * Update frequency: 30 seconds (feed poll) + 5 seconds (UI refresh)
 * Load order: after global-signals.js, before event-narrator.js
 */

(function () {
  'use strict';

  // ─── Domain definitions ──────────────────────────────────────────────────

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  var DISTRESS_THRESHOLD = 0.65;
  var FEED_POLL_MS = 30000;
  var UI_REFRESH_MS = 5000;
  var MATERIAL_CHANGE = 0.05;

  // ─── Stress Normalization ──────────────────────────────────────────────
  // Corrects raw API stress before downstream consumption.
  // Raw stress preserved as rawStress; normalized value becomes stress.

  // Domain-specific dampening for known high-throughput / saturation-prone feeds.
  // Factor < 1.0 dampens volume-driven saturation.
  // Ceiling caps maximum normalized stress from this domain alone.
  var _DOMAIN_DAMPEN = {
    law:           { factor: 0.35, ceiling: 0.70, reason: 'volume-dampened: rule/regulation count' },
    health:        { factor: 0.40, ceiling: 0.75, reason: 'volume-dampened: cumulative event count' },
    communication: { factor: 0.45, ceiling: 0.75, reason: 'volume-dampened: headline count' },
    governance:    { factor: 0.55, ceiling: 0.80, reason: 'tone-dampened: negative tone bias' },
    finance:       { factor: 0.60, ceiling: 0.85, reason: 'volatility-dampened: common market moves' },
    infrastructure:{ factor: 0.50, ceiling: 0.80, reason: 'cyber-dampened: embedded system CVE churn does not indicate compromise; construction-index-dampened: baseline volatility' },
    technology:    { factor: 0.55, ceiling: 0.82, reason: 'adoption-velocity-dampened: patent/arxiv/GitHub churn inflates commodity signal noise' },
    population:    { factor: 0.50, ceiling: 0.80, reason: 'demographic-signal-dampened: Census/ACS/BLS reporting lag and seasonal volatility in birth/fertility/migration counts does not indicate structural demographic shift; real demographic constraints (below-replacement fertility, aging-dependency spike, prime-age employment collapse) bypass dampening' }
  };

  // Structural-signal overrides for infrastructure: certain engineering constraints are
  // NOT noisy commodity/market signals and must bypass dampening (mirrors energy-brain's
  // grid_stress structural conditions). Raw stress is forced to the floor when a structural
  // threshold is crossed, before saturation dampening is applied.
  //   - grid reserve margin below 10%  → grid_stress (structural, not noisy commodity)
  //   - transmission queue depth >2000 MW → transmission_congestion (engineering constraint)
  var _INFRA_STRUCTURAL = {
    gridStressFloor:           0.65, // reserve margin < 10% always reads as grid_stress
    transmissionCongestFloor:  0.60  // queue depth > 2000 MW always reads as congestion
  };

  // Structural-signal overrides for culture: certain attention-economy constraints are
  // NOT noisy headline/volume signals and must bypass saturation dampening (mirrors
  // infrastructure's grid_stress structural conditions, which mirror energy-brain's
  // grid_stress). Cultural saturation, creator-exodus, and scene-collapse are load-bearing
  // emergence/collapse signals — dampening them away would erase the cultural constraint.
  // Raw stress is forced to the floor when a structural threshold is crossed, before
  // saturation dampening is applied.
  //   - viral-moment saturation (trending count > 10000) → cultural_saturation (structural)
  //   - creator-exodus (account-deletion rate spike > 5%)  → creator_exodus (structural)
  //   - scene collapse (participation drop > 60%)          → scene_collapse (structural)
  var _CULTURE_STRUCTURAL = {
    viralSaturationFloor:  0.65, // viralMomentCount > 10000 always reads as cultural_saturation
    creatorExodusFloor:    0.60, // creatorExodusRate > 0.05 always reads as creator_exodus
    sceneCollapseFloor:    0.65  // participationDelta < -0.60 always reads as scene_collapse
  };

  // Structural-signal overrides for finance: certain financial-constraint conditions are
  // NOT noisy market/volatility signals and must bypass saturation dampening (mirrors
  // infrastructure's grid_stress and culture's scene_collapse structural conditions).
  // Liquidity crunch, insolvency, margin-call cascade, and counterparty exposure are
  // load-bearing solvency/systemic-risk signals — dampening them away would erase the
  // financial constraint (and the finance domain carries the validated P3 distress kernel,
  // so a real solvency floor must never be averaged down by common-market-move dampening).
  // Raw stress is forced to the floor when a structural threshold is crossed, before the
  // finance saturation factor (0.60, volatility-dampened) is applied.
  //   - liquidity crunch (funding ratio collapse / repo seizure)        → liquidity_crunch (structural)
  //   - insolvency crash (negative equity / capital ratio breach)       → insolvency_crash (structural)
  //   - margin-call cascade (forced-liquidation spiral)                 → margin_call_cascade (structural)
  //   - counterparty exposure (concentrated default / contagion)        → counterparty_exposure (structural)
  var _FINANCE_STRUCTURAL = {
    liquidityCrunchFloor:      0.70, // funding/liquidity ratio breach always reads as liquidity_crunch
    insolvencyCrashFloor:      0.75, // negative equity / capital breach always reads as insolvency_crash
    marginCallCascadeFloor:    0.68, // forced-liquidation spiral always reads as margin_call_cascade
    counterpartyExposureFloor: 0.65  // concentrated counterparty default always reads as counterparty_exposure
  };

  // Structural-signal overrides for economy: certain MACRO-AGGREGATE constraints are
  // NOT noisy market/volume signals and must bypass saturation dampening (mirrors
  // infrastructure's grid_stress, culture's scene_collapse, and finance's liquidity_crunch
  // structural conditions — all of which mirror energy-brain's grid_stress reserve-margin
  // floor, a load-bearing engineering constraint that is never dampened as commodity noise).
  // The economy domain is the MACRO AGGREGATE (GDP & growth, inflation, employment & labor,
  // sentiment, fiscal/monetary policy, the recession/expansion business cycle) and stays
  // DISTINCT from finance (capital markets / credit / banks). These floors are measured against
  // FRED macro-aggregate identities — UNRATE, PAYEMS / jobless-claims, the DGS10-DGS2 yield-curve
  // spread, the IG-HY credit spread, real-wage growth, and GDPC1 consecutive-quarter contraction —
  // never single-company tickers, and NEVER oil/gas/grid/datacenter metrics.
  // A macro structural breach is a STRUCTURAL_CONSTRAINT (like grid reserve margin), not noise to
  // be averaged down: unemployment above NAIRU forces stress above saturation-dampening thresholds,
  // exactly as a grid reserve margin below 10% reads as grid_stress rather than commodity churn.
  // Raw stress is forced to the floor when a macro threshold is crossed, before any dampening.
  //   - unemployment above NAIRU / jobless-claims threshold → full_employment_breach (structural)
  //   - yield-curve inversion (10Y-2Y spread < 0)           → policy_trap (structural)
  //   - credit-spread (IG-HY gap) > historical +150bp        → credit_crunch (structural)
  //   - real-wage growth < 0% YoY                            → demand_weakness (structural)
  //   - GDP growth < 0 for 2 consecutive quarters            → recession_declaration (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT touch
  // the validated P3 distress kernel (/api/limen/score path), which lives in the finance domain.
  var _ECONOMY_STRUCTURAL = {
    fullEmploymentBreachFloor: 0.65, // UNRATE above NAIRU / claims spike always reads as full_employment_breach
    policyTrapFloor:           0.60, // yield-curve inversion (DGS10-DGS2 < 0) always reads as policy_trap
    creditCrunchFloor:         0.70, // IG-HY credit spread > +150bp always reads as credit_crunch
    demandWeaknessFloor:       0.55, // real-wage growth < 0% YoY always reads as demand_weakness
    recessionDeclarationFloor: 0.75  // GDPC1 < 0 for 2 consecutive quarters always reads as recession_declaration
  };

  // Structural-signal overrides for technology: certain COMPUTE/SUPPLY-CHAIN/SECURITY
  // constraints are NOT noisy patent/arxiv/GitHub/CVE-churn signals and must bypass
  // saturation dampening (mirrors infrastructure's grid_stress, culture's scene_collapse,
  // finance's liquidity_crunch, and economy's recession_declaration structural conditions —
  // all of which mirror energy-brain's grid_stress reserve-margin floor, a load-bearing
  // engineering constraint that is never dampened as commodity noise).
  // The technology domain is SEMICONDUCTORS & COMPUTE, AI/ML, software & cloud, hardware &
  // devices, cybersecurity, R&D & innovation pipelines, platform networks, and data
  // infrastructure (tickers: AAPL, MSFT, NVDA, GOOGL, META, AMZN, AVGO, ORCL, CRM, AMD,
  // INTC, TSM, ASML, PLTR, CRWD, PANW). It stays DISTINCT from finance (fintech is a
  // coupling, not the identity) and from energy (technology couples to energy via compute
  // demand, but its identity is chips/software/AI/cyber — NOT oil/gas/grid/datacenter).
  // These floors are LOAD-BEARING capacity/supply/security/concentration constraints — a real
  // compute-capacity ceiling or a chip-fab shortage must never be averaged down by the
  // adoption-velocity (patent/arxiv/GitHub churn) dampening factor (0.55).
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - compute-capacity exhaustion (GPU utilization > 95%)            → compute_capacity (structural)
  //   - chip-fab shortage (TSMC/Samsung wafer starts drop > 30% YoY)   → chip_shortage (structural)
  //   - AI-training cost blowout (cost-per-token > 10x baseline)        → ai_cost (structural)
  //   - cyber-breach surge (0-day exploit rate > 3 per week)            → cyber_breach (structural)
  //   - platform monopoly (top-3 vendor lock-in > 80%)                  → platform_monopoly (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT
  // touch the validated P3 distress kernel (/api/limen/score path), which lives in finance.
  var _TECHNOLOGY_STRUCTURAL = {
    computeCapacityFloor:   0.65, // GPU utilization > 95% always reads as compute_capacity
    chipShortageFloor:      0.68, // TSMC/Samsung wafer-start drop > 30% YoY always reads as chip_shortage
    aiCostFloor:            0.70, // training cost-per-token > 10x baseline always reads as ai_cost
    cyberBreachFloor:       0.65, // 0-day exploit rate > 3 per week always reads as cyber_breach
    platformMonopolyFloor:  0.60  // top-3 vendor lock-in > 80% always reads as platform_monopoly
  };

  // Structural-signal overrides for defense: certain FORCE-READINESS / PROCUREMENT /
  // INDUSTRIAL-BASE / ALLIANCE constraints are NOT noisy GDELT-tone / headline-volume signals
  // and must bypass saturation dampening (mirrors infrastructure's grid_stress, culture's
  // scene_collapse, finance's liquidity_crunch, economy's recession_declaration, and
  // technology's chip_shortage structural conditions — all of which mirror energy-brain's
  // grid_stress reserve-margin floor, a load-bearing engineering constraint that is never
  // dampened as commodity noise).
  // The defense domain is MILITARY SPENDING & PROCUREMENT, the DEFENSE INDUSTRIAL BASE,
  // geopolitical conflict & deterrence, weapons systems, military readiness, alliances &
  // basing, and electronic/kinetic/strategic warfare (tickers: LMT, RTX, NOC, GD, BA, LHX,
  // HII, LDOS, BAH, KTOS, AVAV). It stays DISTINCT from intelligence (defense = kinetic /
  // industrial / readiness; intelligence = collection / analysis / espionage) and from
  // technology (cyber is a coupling, not the identity). Defense couples to energy via
  // operational fuel / the Strategic Petroleum Reserve, but its identity stays
  // force-readiness / procurement / industrial-base — NEVER oil/gas/grid as its OWN content.
  // These floors are LOAD-BEARING readiness/supply/concentration/treaty constraints — a real
  // force-readiness breach, a munitions-stockpile depletion, a key defense-supplier failure,
  // or a basing-rights/treaty rupture must never be averaged down by the GDELT tone/volume
  // saturation that the generic defense feed is prone to.
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - force-readiness breach (active-threat / conflict escalation)         → force_readiness (structural)
  //   - procurement delay (critical munitions-stockpile / weapons lead-time) → procurement_delay (structural)
  //   - industrial-base strain (defense consolidation / key-supplier failure)→ industrial_base_strain (structural)
  //   - alliance stress (basing-rights loss / treaty-violation breach)       → alliance_stress (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT
  // touch the validated P3 distress kernel (/api/limen/score path), which lives in finance.
  var _DEFENSE_STRUCTURAL = {
    forceReadinessFloor:       0.65, // active-threat / conflict-escalation readiness breach always reads as force_readiness
    procurementDelayFloor:     0.60, // critical munitions-stockpile / weapons-system lead-time breach always reads as procurement_delay
    industrialBaseStrainFloor: 0.70, // defense-industrial consolidation / key-supplier failure always reads as industrial_base_strain
    allianceStressFloor:       0.65  // basing-rights loss / treaty-violation breach always reads as alliance_stress
  };

  // Structural-signal overrides for intelligence: certain OBSERVABILITY / ANALYTIC-INTEGRITY /
  // OVERSIGHT / COUNTERINTELLIGENCE constraints are NOT noisy GDELT-tone / headline-churn signals
  // and must bypass saturation dampening (mirrors infrastructure's grid_stress, culture's
  // scene_collapse, finance's liquidity_crunch, economy's recession_declaration, technology's
  // chip_shortage, and defense's force_readiness structural conditions — all of which mirror
  // energy-brain's grid_stress reserve-margin floor, a load-bearing engineering constraint that is
  // never dampened as commodity noise).
  // The intelligence domain is INTELLIGENCE COLLECTION (SIGINT / HUMINT / GEOINT / OSINT),
  // all-source analysis & assessment, espionage & counterintelligence, surveillance &
  // reconnaissance, threat warning, covert action, information & influence operations, and
  // security-clearance & insider-risk (tickers: PLTR, BAH, LDOS, CACI, SAIC, KBR, VRNT, NICE,
  // VRSK). It stays DISTINCT from defense (defense = kinetic / industrial / readiness;
  // intelligence = collection / analysis / espionage) and from technology (cyber tooling is a
  // coupling, NOT the identity). Intelligence couples to defense via threat warning and to
  // technology via cyber/SIGINT tooling, but its identity stays observability / assessment /
  // tradecraft — NEVER oil/gas/grid as the domain's OWN content.
  // These floors are LOAD-BEARING observability/trust constraints — a persistent collection gap,
  // a systematic analytical distortion, a confirmed legal/constitutional oversight failure, or an
  // active counterintelligence loss must never be averaged down by the GDELT tone/headline-churn
  // saturation that the generic intelligence feed is prone to. Just as kinetic/readiness
  // constraints bypass tone/volume dampening for defense, intelligence observability/trust
  // constraints must bypass headline-churn dampening here.
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - collection gap (persistent observability deficit / blind spot)        → collection_gap (structural)
  //   - analytical distortion (systematic analytic failure / politicization)  → analytical_distortion (structural)
  //   - oversight failure (legal/constitutional violation confirmed)          → oversight_failure (structural)
  //   - counterintelligence failure (active CI loss / penetration confirmed)  → counterintelligence_failure (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT
  // touch the validated P3 distress kernel (/api/limen/score path), which lives in finance.
  var _INTELLIGENCE_STRUCTURAL = {
    collectionGapFloor:               0.65, // persistent observability deficit / blind spot always reads as collection_gap
    analyticalDistortionFloor:        0.70, // systematic analytical failure / politicization always reads as analytical_distortion
    oversightFailureFloor:            0.65, // confirmed legal/constitutional violation always reads as oversight_failure
    counterintelligenceFailureFloor:  0.60  // active counterintelligence loss / penetration always reads as counterintelligence_failure
  };

  // Structural-signal overrides for trade / supply chain: certain TRADE-POLICY / LOGISTICS /
  // CHOKEPOINT / SANCTIONS constraints are NOT noisy commodity-price / shipping-rate-churn signals
  // and must bypass saturation dampening (mirrors infrastructure's grid_stress, culture's
  // scene_collapse, finance's liquidity_crunch, economy's recession_declaration, technology's
  // chip_shortage, defense's force_readiness, and intelligence's collection_gap structural
  // conditions — all of which mirror energy-brain's grid_stress reserve-margin floor, a
  // load-bearing engineering constraint that is never dampened as commodity noise).
  // The trade domain (runtime key 'supplyChain') is INTERNATIONAL TRADE & COMMERCE,
  // exports/imports, tariffs & trade policy, shipping & logistics, supply chains, the trade
  // balance, customs, trade agreements, sanctions/embargoes, and freight & ports (tickers:
  // FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL). It stays DISTINCT from
  // economy (the macro aggregate — GDP/inflation/employment) and from industry (production /
  // manufacturing output). Trade couples to economy via the trade balance and to industry via
  // input sourcing, but its identity stays cross-border flow / tariffs / shipping / ports —
  // NEVER oil/gas/grid as the domain's OWN content (a port can be an energy terminal, but the
  // trade signal is the throughput/closure, not the commodity).
  // These floors are LOAD-BEARING trade-flow constraints — a real tariff shock, a port closure,
  // a sanctions escalation, a shipping crisis, or a customs blockade must never be averaged down
  // by the commodity-price / freight-rate / headline-volume saturation that the generic trade
  // feed is prone to.
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - tariff shock (tariff escalation / new-tariff announcement count)        → tariff_shock (structural)
  //   - port closure (major-port shutdown / strike / chokepoint blockage)        → port_closure (structural)
  //   - sanctions escalation (OFAC/USTR designation surge / embargo)             → sanctions_escalation (structural)
  //   - shipping crisis (freight-rate spike / vessel-rerouting / canal closure)  → shipping_crisis (structural)
  //   - customs blockade (customs-delay surge / border holds / CBP enforcement)  → customs_blockade (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT
  // touch the validated P3 distress kernel (/api/limen/score path), which lives in finance.
  var _TRADE_STRUCTURAL = {
    tariffShockFloor:          0.65, // tariff escalation / new-tariff surge always reads as tariff_shock
    portClosureFloor:          0.70, // major-port shutdown / chokepoint blockage always reads as port_closure
    sanctionsEscalationFloor:  0.70, // OFAC/USTR designation surge / embargo always reads as sanctions_escalation
    shippingCrisisFloor:       0.68, // freight-rate spike / vessel-rerouting / canal closure always reads as shipping_crisis
    customsBlockadeFloor:      0.65  // customs-delay surge / border holds / CBP enforcement always reads as customs_blockade
  };

  // Structural-signal overrides for industry: certain PRODUCTION / CAPACITY / AUTOMATION /
  // INPUT-COST / LABOR / SUPPLY constraints are NOT noisy machinery-order / industrial-index-churn
  // signals and must bypass saturation dampening (mirrors infrastructure's grid_stress, culture's
  // scene_collapse, finance's liquidity_crunch, economy's recession_declaration, technology's
  // chip_shortage, defense's force_readiness, intelligence's collection_gap, and trade's
  // tariff_shock structural conditions — all of which mirror energy-brain's grid_stress
  // reserve-margin floor, a load-bearing engineering constraint that is never dampened as
  // commodity noise).
  // The industry domain is MANUFACTURING & INDUSTRIAL PRODUCTION, factory output & capacity
  // utilization, automation & robotics, heavy industry & capital goods, industrial supply chains,
  // machinery & equipment, and industrial maintenance (tickers: CAT, DE, GE, HON, MMM, EMR, ITW,
  // ETN, PH, ROK, DOV, GEV). It stays DISTINCT from trade (logistics/commerce/shipping/ports),
  // economy (the macro aggregate — GDP/inflation/employment), and technology (automation/robotics
  // is a COUPLING, not the identity). Industry couples to trade via input sourcing, to economy via
  // output contribution, and to technology via factory automation — but its identity stays
  // physical production / capacity ceilings / equipment uptime — NEVER oil/gas/grid as the domain's
  // OWN content (a factory consumes energy, but the industrial signal is output/capacity/uptime,
  // not the commodity).
  // These floors are LOAD-BEARING production constraints — exactly as a grid reserve margin below
  // 10% reads as grid_stress (a real engineering ceiling never averaged down by volume dampening),
  // a capacity utilization above 85% is a real production ceiling that must never be averaged down
  // by machinery-order volume dampening. Real production ceilings, equipment downtime, input-cost
  // spikes, labor shortages, and supply bottlenecks are not commodity churn.
  // Binds to FRED INDPRO (industrial production) / capacity-utilization (TCU), ISM Manufacturing
  // PMI, and CAT/DE/GE machinery-order metrics.
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - capacity-utilization ceiling (utilization > 85%)                       → capacity_constraint (structural)
  //   - automation/equipment failure (equipment downtime > 5%)                 → automation_failure (structural)
  //   - input-cost spike (producer-price inflation > 10% YoY)                  → input_cost_spike (structural)
  //   - labor shortage (unemployment below NAIRU or mfg wage growth > 3%)      → labor_shortage (structural)
  //   - supply bottleneck (component lead-time > 90 days)                      → supply_bottleneck (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT touch
  // the validated P3 distress kernel (/api/limen/score path), which lives in the finance domain.
  var _INDUSTRY_STRUCTURAL = {
    capacityUtilizationFloor:  0.65, // capacity utilization > 85% always reads as capacity_constraint
    automationFailureFloor:    0.60, // equipment downtime > 5% always reads as automation_failure
    inputCostFloor:            0.68, // producer-price inflation > 10% YoY always reads as input_cost_spike
    laborShortageFloor:        0.65, // unemployment below NAIRU / mfg wage growth > 3% always reads as labor_shortage
    supplyBottleneckFloor:     0.70  // component lead-time > 90 days always reads as supply_bottleneck
  };

  // Structural-signal overrides for agriculture: certain CROP / LIVESTOCK / FOOD-SUPPLY /
  // INPUT-COST / FARM-ECONOMICS constraints are NOT noisy commodity-price / WASDE-revision-churn
  // signals and must bypass saturation dampening (mirrors infrastructure's grid_stress, culture's
  // scene_collapse, finance's liquidity_crunch, economy's recession_declaration, technology's
  // chip_shortage, defense's force_readiness, intelligence's collection_gap, trade's tariff_shock,
  // and industry's capacity_constraint structural conditions — all of which mirror energy-brain's
  // grid_stress reserve-margin floor, a load-bearing engineering constraint that is never dampened
  // as commodity noise).
  // The agriculture domain is FARMING & CROPS, livestock & animal protein, agribusiness & food
  // production, food security & supply, fertilizers & crop inputs, irrigation & agricultural water,
  // commodity crops (corn/soy/wheat), agricultural technology & precision ag, and farm economics
  // (tickers: ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG, INGR, AGCO, FMC). It stays DISTINCT from
  // environment (land/water/climate is a COUPLING, not the identity — drought matters to ag as a
  // crop-yield shock, not as an ecosystem signal), from trade (export logistics is a COUPLING — an
  // export ban matters as a market-access loss for ag output, not as a shipping signal), and from
  // economy (food prices are a COUPLING — a commodity-price surge matters as a farm-revenue/food-
  // security signal, not as the macro CPI aggregate). Agriculture couples to energy via biofuel
  // demand and fertilizer feedstock (natural gas → ammonia), but its identity stays crops/livestock/
  // food/inputs/farm-economics — NEVER oil/gas/grid as the domain's OWN content.
  // These floors are LOAD-BEARING food-system constraints — exactly as a grid reserve margin below
  // 10% reads as grid_stress (a real engineering ceiling never averaged down by volume dampening),
  // a regional crop failure, an acute drought-stress reading, a livestock-disease outbreak, a
  // food-commodity price surge, an export-market closure, or a farm-debt distress reading is a real
  // food-system constraint that must never be averaged down by commodity-price / WASDE-revision noise.
  // Binds to CBOT corn/soy/wheat futures, USDA WASDE crop-condition / production / stocks-to-use, USDA
  // NASS drought & livestock data, and ag-sector tickers (ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG,
  // INGR, AGCO, FMC) only.
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - crop failure (regional crop-loss > 30%)                                → crop_failure (structural)
  //   - drought severity (drought-stress index > threshold)                    → drought_severity (structural)
  //   - livestock disease (animal-disease outbreak rate > 5%)                   → livestock_disease (structural)
  //   - food-price surge (food-commodity price spike > 40% YoY)                 → food_price_surge (structural)
  //   - export ban (ag export-market suddenly closed)                          → export_ban (structural)
  //   - farm-debt distress (farm debt-to-income ratio > 1.5)                    → farm_debt_distress (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT touch
  // the validated P3 distress kernel (/api/limen/score path), which lives in the finance domain.
  var _AGRICULTURE_STRUCTURAL = {
    cropFailureFloor:       0.70, // regional crop-loss > 30% always reads as crop_failure
    droughtSeverityFloor:   0.65, // drought-stress index above threshold always reads as drought_severity
    livestockDiseaseFloor:  0.68, // animal-disease outbreak rate > 5% always reads as livestock_disease
    foodPriceSurgeFloor:    0.70, // food-commodity price spike > 40% YoY always reads as food_price_surge
    exportBanFloor:         0.75, // ag export-market suddenly closed always reads as export_ban
    farmDebtFloor:          0.65  // farm debt-to-income ratio > 1.5 always reads as farm_debt_distress
  };

  // Structural-signal overrides for environment: certain CLIMATE / POLLUTION / ECOSYSTEM /
  // WATER / REGULATORY constraints are NOT noisy emissions-index / headline-volume signals and
  // must bypass saturation dampening (mirrors infrastructure's grid_stress, culture's
  // scene_collapse, finance's liquidity_crunch, economy's recession_declaration, technology's
  // chip_shortage, defense's force_readiness, intelligence's collection_gap, trade's tariff_shock,
  // and industry's capacity_constraint structural conditions — all of which mirror energy-brain's
  // grid_stress reserve-margin floor, a load-bearing engineering constraint that is never dampened
  // as commodity noise).
  // The environment domain is CLIMATE & EMISSIONS, air/water/soil pollution & quality, ecosystems
  // & biodiversity, natural resources & conservation, environmental regulation & compliance, climate
  // risk & adaptation, waste management & remediation, and carbon markets (tickers: WM, RSG, WCN,
  // CWST, AWK, WTRG, XYL, ECL, LIN, APD, DAR, AY). It stays DISTINCT from energy (environment couples
  // to energy via emissions/carbon, but its identity is climate/pollution/ecosystems — NEVER oil/gas/
  // grid/power-generation as the domain's OWN content) and from agriculture (land/water use is a
  // coupling, not the identity).
  // These floors are LOAD-BEARING ecosystem/climate constraints — exactly as a grid reserve margin
  // below 10% reads as grid_stress (a real engineering ceiling never averaged down by volume
  // dampening), an emissions spike, an acute pollution event, biodiversity collapse, water stress,
  // or a carbon-cap breach is a real ecosystem/climate constraint that must never be averaged down
  // by emissions-index volume dampening.
  // Binds to real environmental metrics and FRED/EPA proxies (atmospheric CO2 concentration, the
  // EPA AQI, water-stress indices, extinction/habitat-loss rates, carbon-cap compliance).
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - emissions spike (CO2e YoY spike > 50%)                                  → emissions_spike (structural)
  //   - acute pollution event (AQI / spill with health/ecosystem impact)        → pollution_event (structural)
  //   - biodiversity loss (extinction rate / habitat loss > threshold)          → biodiversity_loss (structural)
  //   - water stress (scarcity index / water-quality failure)                   → water_stress (structural)
  //   - regulatory breach (carbon cap exceeded / compliance failure)            → regulatory_breach (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT touch
  // the validated P3 distress kernel (/api/limen/score path), which lives in the finance domain.
  var _ENVIRONMENT_STRUCTURAL = {
    emissionsSpikeFloor:    0.68, // CO2e YoY spike > 50% always reads as emissions_spike
    pollutionEventFloor:    0.70, // acute pollution event w/ health/ecosystem impact always reads as pollution_event
    biodiversityLossFloor:  0.65, // extinction rate / habitat loss > threshold always reads as biodiversity_loss
    waterStressFloor:       0.65, // water scarcity / quality failure always reads as water_stress
    regulatoryBreachFloor:  0.70  // carbon cap exceeded / compliance failure always reads as regulatory_breach
  };

  // Structural-signal overrides for population: certain DEMOGRAPHIC / MIGRATION / AGING /
  // LABOR-SUPPLY / URBANIZATION constraints are NOT noisy Census/ACS/BLS headline-volume or
  // seasonal birth/fertility/migration-count churn and must bypass saturation dampening (mirrors
  // infrastructure's grid_stress, culture's scene_collapse, finance's liquidity_crunch, economy's
  // recession_declaration, technology's chip_shortage, defense's force_readiness, intelligence's
  // collection_gap, trade's tariff_shock, industry's capacity_constraint, agriculture's crop_failure,
  // and environment's emissions_spike structural conditions — all of which mirror energy-brain's
  // grid_stress reserve-margin floor, a load-bearing engineering constraint that is never dampened
  // as commodity noise).
  // The population domain is DEMOGRAPHICS & POPULATION DYNAMICS, migration & immigration,
  // urbanization & settlement, fertility & mortality, aging & generational shifts, labor force &
  // human-capital supply, household formation & housing demand, and social structure & inequality.
  // It binds mostly to INDICATORS, not single companies (US Census 5-year ACS, UN World Population
  // Prospects, Pew Research Center, BLS prime-age employment / labor-force participation, HUD housing
  // affordability, IOM migration), and where demographic-exposed entities are needed it uses real
  // proxies (WELL, VTR senior-living REITs; housing/migration-exposed names). It stays DISTINCT from
  // economy (the labor MARKET is a coupling — population owns the labor-SUPPLY/human-capital pool, not
  // GDP/inflation/unemployment as the macro aggregate), from medicine (mortality/health is a coupling —
  // population owns demographic mortality counts, not clinical health), from education (enrollment is a
  // coupling), and from governance. NEVER oil/gas/grid as the domain's OWN content.
  // These floors are LOAD-BEARING demographic constraints — exactly as a grid reserve margin below
  // 10% reads as grid_stress (a real engineering ceiling never averaged down by volume dampening), a
  // below-replacement fertility reading, a migration surge, an aging-dependency breach, a prime-age
  // labor-force collapse, an urbanization-strain reading, or a regional depopulation reading is a real
  // demographic constraint that must never be averaged down by Census/ACS reporting-lag noise.
  // Raw stress is forced to the floor when a structural threshold is crossed, before dampening.
  //   - demographic collapse (total fertility rate < 1.5 / below-replacement birth rate)   → demographic_collapse (structural)
  //   - migration surge (net migration inflow acceleration > 50% YoY / displaced surge)     → migration_surge (structural)
  //   - aging crisis (median age > 42 / old-age dependency > 30% / working-age decline > 2%)→ aging_crisis (structural)
  //   - labor shortage (prime-age LFPR < 75% / prime-age employment < 80% / U-LF gap > 4%)  → labor_shortage (structural)
  //   - urbanization strain (slum growth > 5%/yr / housing-unaffordability > 40% / megacity) → urbanization_strain (structural)
  //   - depopulation (regional population loss > 2% YoY / sustained rural out-migration)     → depopulation (structural)
  // ADDITIVE ONLY — client-side advisory floor for the domain panel/snapshot; it does NOT touch
  // the validated P3 distress kernel (/api/limen/score path), which lives in the finance domain.
  var _POPULATION_STRUCTURAL = {
    demographicCollapseFloor: 0.65, // total fertility rate < 1.5 / below-replacement birth rate always reads as demographic_collapse
    migrationSurgeFloor:      0.60, // net migration inflow acceleration > 50% YoY / displaced surge always reads as migration_surge
    agingCrisisFloor:         0.70, // median age > 42 / old-age dependency > 30% / working-age decline > 2% YoY always reads as aging_crisis
    laborShortageFloor:       0.65, // prime-age LFPR < 75% / prime-age employment < 80% / U-to-LF gap > 4% always reads as labor_shortage
    urbanizationStrainFloor:  0.60, // slum growth > 5%/yr / housing-unaffordability index > 40% / megacity stress always reads as urbanization_strain
    depopulationFloor:        0.65  // regional population loss > 2% YoY / sustained rural out-migration always reads as depopulation
  };

  // Rolling baseline state (accumulates across feed cycles within session)
  var _baselineState = {}; // domainKey → { samples: [], mean: number }
  var _BASELINE_WINDOW = 12; // ~6 minutes at 30s poll (enough for session deviation)

  // Persistence tracker: how many consecutive cycles above elevated threshold
  var _persistenceCount = {}; // domainKey → number

  // Detect infrastructure structural constraints from a feed object.
  // Returns a forced stress floor (0 if none) — engineering constraints bypass dampening.
  function _infraStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    // Grid reserve margin below 10% ALWAYS triggers grid_stress
    var reserveMargin = (feed.reserveMargin !== undefined) ? feed.reserveMargin
                      : (feed.gridReserveMargin !== undefined) ? feed.gridReserveMargin
                      : null;
    if (reserveMargin !== null && reserveMargin < 0.10) {
      if (_INFRA_STRUCTURAL.gridStressFloor > floor) {
        floor = _INFRA_STRUCTURAL.gridStressFloor;
        reason = 'structural: grid_stress (reserve margin ' + (reserveMargin * 100).toFixed(0) + '% < 10%)';
      }
    }
    // Transmission queue depth > 2000 MW ALWAYS triggers transmission_congestion
    var queueDepth = (feed.transmissionQueueMW !== undefined) ? feed.transmissionQueueMW
                   : (feed.queueDepthMW !== undefined) ? feed.queueDepthMW
                   : null;
    if (queueDepth !== null && queueDepth > 2000) {
      if (_INFRA_STRUCTURAL.transmissionCongestFloor > floor) {
        floor = _INFRA_STRUCTURAL.transmissionCongestFloor;
        reason = 'structural: transmission_congestion (queue ' + Math.round(queueDepth) + ' MW > 2000)';
      } else if (floor > 0) {
        reason += ' + transmission_congestion (' + Math.round(queueDepth) + ' MW)';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect culture structural constraints from a feed object.
  // Returns a forced stress floor (0 if none) — attention-economy constraints bypass dampening.
  // Mirrors _infraStructuralFloor: cultural saturation / creator-exodus / scene-collapse are
  // load-bearing emergence/collapse signals, not volume-driven noise to be dampened away.
  function _cultureStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // Viral-moment saturation: trending count > 10000 ALWAYS triggers cultural_saturation
    var viralCount = (feed.viralMomentCount !== undefined) ? feed.viralMomentCount
                   : (feed.trendingCount !== undefined) ? feed.trendingCount
                   : null;
    if (viralCount !== null && viralCount > 10000 && (_has('viral') || _has('trend'))) {
      if (_CULTURE_STRUCTURAL.viralSaturationFloor > floor) {
        floor = _CULTURE_STRUCTURAL.viralSaturationFloor;
        reason = 'structural: cultural_saturation (trending ' + Math.round(viralCount) + ' > 10000)';
      }
    }
    // Creator-exodus: account-deletion rate spike > 5% ALWAYS triggers creator_exodus
    var exodusRate = (feed.creatorExodusRate !== undefined) ? feed.creatorExodusRate
                   : (feed.accountDeletionRate !== undefined) ? feed.accountDeletionRate
                   : null;
    if (exodusRate !== null && exodusRate > 0.05 && _has('creator')) {
      if (_CULTURE_STRUCTURAL.creatorExodusFloor > floor) {
        floor = _CULTURE_STRUCTURAL.creatorExodusFloor;
        reason = 'structural: creator_exodus (exodus rate ' + (exodusRate * 100).toFixed(0) + '% > 5%)';
      } else if (floor > 0) {
        reason += ' + creator_exodus (' + (exodusRate * 100).toFixed(0) + '%)';
      }
    }
    // Scene collapse: participation drop > 60% ALWAYS triggers scene_collapse
    var participationDelta = (feed.participationDelta !== undefined) ? feed.participationDelta
                           : (feed.sceneParticipationDelta !== undefined) ? feed.sceneParticipationDelta
                           : null;
    if (participationDelta !== null && participationDelta < -0.60 && _has('scene')) {
      if (_CULTURE_STRUCTURAL.sceneCollapseFloor > floor) {
        floor = _CULTURE_STRUCTURAL.sceneCollapseFloor;
        reason = 'structural: scene_collapse (participation ' + (participationDelta * 100).toFixed(0) + '% < -60%)';
      } else if (floor > 0) {
        reason += ' + scene_collapse (' + (participationDelta * 100).toFixed(0) + '%)';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect finance structural constraints from a feed object.
  // Returns a forced stress floor (0 if none) — financial-constraint conditions bypass
  // market/volatility dampening. Mirrors _infraStructuralFloor / _cultureStructuralFloor:
  // liquidity-crunch / insolvency-crash / margin-call-cascade / counterparty-exposure are
  // load-bearing solvency/systemic-risk signals, not common-market-move noise to be dampened.
  // ADDITIVE ONLY — this is a client-side advisory floor for the domain panel/snapshot; it
  // does NOT touch the validated P3 distress kernel (/api/limen/score path).
  function _financeStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // Liquidity crunch: funding/liquidity ratio breach ALWAYS triggers liquidity_crunch.
    // (liquidityRatio < 1.0 = obligations exceed liquid assets; or an explicit repo/funding-seizure signal)
    var liquidityRatio = (feed.liquidityRatio !== undefined) ? feed.liquidityRatio
                       : (feed.fundingRatio !== undefined) ? feed.fundingRatio
                       : null;
    if ((liquidityRatio !== null && liquidityRatio < 1.0 && (_has('liquidity') || _has('funding') || _has('repo'))) ||
        _has('liquidity crunch') || _has('funding freeze')) {
      if (_FINANCE_STRUCTURAL.liquidityCrunchFloor > floor) {
        floor = _FINANCE_STRUCTURAL.liquidityCrunchFloor;
        reason = 'structural: liquidity_crunch' + (liquidityRatio !== null ? ' (liquidity ratio ' + liquidityRatio.toFixed(2) + ' < 1.0)' : '');
      }
    }
    // Insolvency crash: negative equity / regulatory capital breach ALWAYS triggers insolvency_crash.
    // (capitalRatio below the regulatory minimum, here taken as < 0.08 / 8% Tier-1; or negative equity flag)
    var capitalRatio = (feed.capitalRatio !== undefined) ? feed.capitalRatio
                     : (feed.tier1Ratio !== undefined) ? feed.tier1Ratio
                     : null;
    if ((capitalRatio !== null && capitalRatio < 0.08 && (_has('capital') || _has('solven') || _has('equity'))) ||
        _has('insolven') || _has('negative equity')) {
      if (_FINANCE_STRUCTURAL.insolvencyCrashFloor > floor) {
        floor = _FINANCE_STRUCTURAL.insolvencyCrashFloor;
        reason = 'structural: insolvency_crash' + (capitalRatio !== null ? ' (capital ratio ' + (capitalRatio * 100).toFixed(1) + '% < 8%)' : '');
      } else if (floor > 0) {
        reason += ' + insolvency_crash';
      }
    }
    // Margin-call cascade: forced-liquidation spiral ALWAYS triggers margin_call_cascade.
    // (marginCallRate spike > 5% of positions, or an explicit forced-liquidation/deleveraging signal)
    var marginCallRate = (feed.marginCallRate !== undefined) ? feed.marginCallRate
                       : (feed.forcedLiquidationRate !== undefined) ? feed.forcedLiquidationRate
                       : null;
    if ((marginCallRate !== null && marginCallRate > 0.05 && (_has('margin') || _has('liquidation'))) ||
        _has('margin call') || _has('forced liquidation') || _has('deleverag')) {
      if (_FINANCE_STRUCTURAL.marginCallCascadeFloor > floor) {
        floor = _FINANCE_STRUCTURAL.marginCallCascadeFloor;
        reason = 'structural: margin_call_cascade' + (marginCallRate !== null ? ' (margin-call rate ' + (marginCallRate * 100).toFixed(0) + '% > 5%)' : '');
      } else if (floor > 0) {
        reason += ' + margin_call_cascade';
      }
    }
    // Counterparty exposure: concentrated default / contagion ALWAYS triggers counterparty_exposure.
    // (counterpartyExposure concentration > 25% to a single stressed counterparty, or an explicit contagion signal)
    var counterpartyExposure = (feed.counterpartyExposure !== undefined) ? feed.counterpartyExposure
                             : (feed.contagionExposure !== undefined) ? feed.contagionExposure
                             : null;
    if ((counterpartyExposure !== null && counterpartyExposure > 0.25 && (_has('counterparty') || _has('contagion') || _has('default'))) ||
        _has('counterparty') || _has('contagion')) {
      if (_FINANCE_STRUCTURAL.counterpartyExposureFloor > floor) {
        floor = _FINANCE_STRUCTURAL.counterpartyExposureFloor;
        reason = 'structural: counterparty_exposure' + (counterpartyExposure !== null ? ' (exposure ' + (counterpartyExposure * 100).toFixed(0) + '% > 25%)' : '');
      } else if (floor > 0) {
        reason += ' + counterparty_exposure';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect economy MACRO-AGGREGATE structural constraints from a feed object.
  // Returns a forced stress floor (0 if none) — macro-identity breaches bypass market/volume
  // dampening. Mirrors _infraStructuralFloor / _cultureStructuralFloor / _financeStructuralFloor:
  // full-employment-breach / policy-trap / credit-crunch / demand-weakness / recession-declaration
  // are load-bearing business-cycle/macro-regime signals, not common-market-move noise to dampen.
  // Binds ONLY to FRED macro series (UNRATE, PAYEMS, DGS10, DGS2, IG-HY spread, real-wage YoY,
  // GDPC1) and broad-market proxies — NEVER single-company tickers and NEVER oil/grid/datacenter.
  // Stays DISTINCT from finance: this is the macro aggregate identity, not capital-market plumbing.
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _economyStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (1) Full-employment breach: UNRATE above NAIRU (taken as ~4.4%) or a jobless-claims spike
    //     ALWAYS triggers full_employment_breach (structural — like grid reserve margin < 10%).
    var unemployment = (feed.unemploymentRate !== undefined) ? feed.unemploymentRate
                     : (feed.UNRATE !== undefined) ? feed.UNRATE
                     : null;
    // accept either fraction (0.044) or percent (4.4) form, normalize to fraction
    var unrateFrac = (unemployment !== null && unemployment > 1) ? unemployment / 100 : unemployment;
    var nairu = (feed.nairu !== undefined) ? ((feed.nairu > 1) ? feed.nairu / 100 : feed.nairu) : 0.044;
    var joblessClaims = (feed.joblessClaims !== undefined) ? feed.joblessClaims
                      : (feed.initialClaims !== undefined) ? feed.initialClaims
                      : null;
    if ((unrateFrac !== null && unrateFrac > nairu && (_has('unemploy') || _has('employ') || _has('labor') || _has('jobless'))) ||
        (joblessClaims !== null && joblessClaims > 300000) ||
        _has('above nairu') || _has('full-employment breach') || _has('employment contraction')) {
      if (_ECONOMY_STRUCTURAL.fullEmploymentBreachFloor > floor) {
        floor = _ECONOMY_STRUCTURAL.fullEmploymentBreachFloor;
        reason = 'structural: full_employment_breach' + (unrateFrac !== null ? ' (UNRATE ' + (unrateFrac * 100).toFixed(1) + '% > NAIRU ' + (nairu * 100).toFixed(1) + '%)' : '');
      }
    }
    // (5) Recession declaration: GDPC1 (real GDP) growth < 0 for 2 consecutive quarters
    //     ALWAYS triggers recession_declaration (highest macro floor — the business-cycle break).
    var gdpQ1 = (feed.gdpGrowthQ1 !== undefined) ? feed.gdpGrowthQ1
              : (feed.realGdpGrowth !== undefined) ? feed.realGdpGrowth
              : null;
    var gdpQ2 = (feed.gdpGrowthQ2 !== undefined) ? feed.gdpGrowthQ2 : null;
    if ((gdpQ1 !== null && gdpQ2 !== null && gdpQ1 < 0 && gdpQ2 < 0) ||
        feed.recessionConfirmed === true || _has('recession') || _has('two consecutive quarters')) {
      if (_ECONOMY_STRUCTURAL.recessionDeclarationFloor > floor) {
        floor = _ECONOMY_STRUCTURAL.recessionDeclarationFloor;
        reason = 'structural: recession_declaration (real GDP < 0 for 2 consecutive quarters)';
      } else if (floor > 0) {
        reason += ' + recession_declaration';
      }
    }
    // (3) Credit crunch: IG-HY credit spread > historical +150bp (0.0150) ALWAYS triggers credit_crunch.
    var creditSpread = (feed.creditSpread !== undefined) ? feed.creditSpread
                     : (feed.igHySpread !== undefined) ? feed.igHySpread
                     : null;
    // accept basis-point form (e.g. 175) or fraction form (0.0175); threshold = +150bp
    var spreadBp = (creditSpread !== null) ? (creditSpread > 1 ? creditSpread : creditSpread * 10000) : null;
    if ((spreadBp !== null && spreadBp > 150 && (_has('credit') || _has('spread'))) ||
        _has('credit crunch') || _has('credit-crunch')) {
      if (_ECONOMY_STRUCTURAL.creditCrunchFloor > floor) {
        floor = _ECONOMY_STRUCTURAL.creditCrunchFloor;
        reason = 'structural: credit_crunch' + (spreadBp !== null ? ' (IG-HY spread ' + Math.round(spreadBp) + 'bp > +150bp)' : '');
      } else if (floor > 0) {
        reason += ' + credit_crunch';
      }
    }
    // (2) Policy trap: yield-curve inversion (DGS10 - DGS2 spread < 0) ALWAYS triggers policy_trap.
    var curveSpread = (feed.yieldCurveSpread !== undefined) ? feed.yieldCurveSpread
                    : (feed.t10y2y !== undefined) ? feed.t10y2y
                    : null;
    if (curveSpread === null && feed.dgs10 !== undefined && feed.dgs2 !== undefined) {
      curveSpread = feed.dgs10 - feed.dgs2;
    }
    if ((curveSpread !== null && curveSpread < 0) ||
        _has('inversion') || _has('inverted') || _has('policy trap') || _has('policy-trap')) {
      if (_ECONOMY_STRUCTURAL.policyTrapFloor > floor) {
        floor = _ECONOMY_STRUCTURAL.policyTrapFloor;
        reason = 'structural: policy_trap' + (curveSpread !== null ? ' (10Y-2Y ' + curveSpread.toFixed(2) + ' < 0, inverted)' : '');
      } else if (floor > 0) {
        reason += ' + policy_trap';
      }
    }
    // (4) Demand weakness: real-wage growth < 0% YoY ALWAYS triggers demand_weakness.
    var realWageGrowth = (feed.realWageGrowth !== undefined) ? feed.realWageGrowth
                       : (feed.realWageGrowthYoY !== undefined) ? feed.realWageGrowthYoY
                       : null;
    // accept fraction (-0.012) or percent (-1.2) form
    var wageFrac = (realWageGrowth !== null && (realWageGrowth > 1 || realWageGrowth < -1)) ? realWageGrowth / 100 : realWageGrowth;
    if ((wageFrac !== null && wageFrac < 0 && (_has('wage') || _has('demand') || _has('real wage'))) ||
        _has('demand weakness') || _has('demand-weakness') || _has('negative real wage')) {
      if (_ECONOMY_STRUCTURAL.demandWeaknessFloor > floor) {
        floor = _ECONOMY_STRUCTURAL.demandWeaknessFloor;
        reason = 'structural: demand_weakness' + (wageFrac !== null ? ' (real-wage growth ' + (wageFrac * 100).toFixed(1) + '% < 0% YoY)' : '');
      } else if (floor > 0) {
        reason += ' + demand_weakness';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect technology COMPUTE/SUPPLY-CHAIN/SECURITY structural constraints from a feed object.
  // Returns a forced stress floor (0 if none) — capacity/supply/security/concentration breaches
  // bypass adoption-velocity (patent/arxiv/GitHub/CVE-churn) dampening. Mirrors
  // _infraStructuralFloor / _cultureStructuralFloor / _financeStructuralFloor / _economyStructuralFloor:
  // compute-capacity / chip-shortage / ai-cost / cyber-breach / platform-monopoly are load-bearing
  // compute-economy constraints, not commodity-signal noise to be averaged down.
  // Binds to compute/fab/AI-cost/exploit/vendor-concentration metrics and tech tickers
  // (AAPL, MSFT, NVDA, GOOGL, META, AMZN, AVGO, ORCL, CRM, AMD, INTC, TSM, ASML, PLTR, CRWD, PANW) —
  // NEVER oil/gas/grid/datacenter as the domain's OWN content (technology couples to energy via
  // compute demand, but its identity stays chips/software/AI/cyber), and DISTINCT from finance.
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _technologyStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (3) AI-training cost blowout: cost-per-token > 10x baseline ALWAYS triggers ai_cost
    //     (highest tech floor — a compute-economics break in the AI/ML training pipeline).
    //     aiTrainingCostMultiple is taken as a multiple of baseline (e.g. 12 = 12x).
    var aiCostMultiple = (feed.aiTrainingCostMultiple !== undefined) ? feed.aiTrainingCostMultiple
                       : (feed.trainingCostPerTokenMultiple !== undefined) ? feed.trainingCostPerTokenMultiple
                       : null;
    if ((aiCostMultiple !== null && aiCostMultiple > 10 && (_has('train') || _has('token') || _has('compute') || _has('ai'))) ||
        _has('training cost blowout') || _has('ai-cost') || _has('cost-per-token')) {
      if (_TECHNOLOGY_STRUCTURAL.aiCostFloor > floor) {
        floor = _TECHNOLOGY_STRUCTURAL.aiCostFloor;
        reason = 'structural: ai_cost' + (aiCostMultiple !== null ? ' (training cost/token ' + aiCostMultiple.toFixed(1) + 'x > 10x baseline)' : '');
      }
    }
    // (2) Chip-fab shortage: TSMC/Samsung wafer-start drop > 30% YoY ALWAYS triggers chip_shortage
    //     (semiconductor supply-chain constraint — TSM/ASML/AVGO/AMD/INTC/NVDA exposure).
    //     waferStartDropYoY accepts fraction (-0.35) or percent (-35) form.
    var waferDrop = (feed.waferStartDropYoY !== undefined) ? feed.waferStartDropYoY
                  : (feed.foundryUtilizationDrop !== undefined) ? feed.foundryUtilizationDrop
                  : null;
    var waferFrac = (waferDrop !== null && (waferDrop > 1 || waferDrop < -1)) ? waferDrop / 100 : waferDrop;
    // treat as magnitude: a drop > 30% means waferFrac < -0.30 (or a positive 0.30+ "drop" reading)
    var waferMag = (waferFrac !== null) ? Math.abs(waferFrac) : null;
    if ((waferMag !== null && waferMag > 0.30 && (_has('chip') || _has('wafer') || _has('fab') || _has('foundry') || _has('semiconductor'))) ||
        _has('chip shortage') || _has('chip-shortage') || _has('wafer shortage')) {
      if (_TECHNOLOGY_STRUCTURAL.chipShortageFloor > floor) {
        floor = _TECHNOLOGY_STRUCTURAL.chipShortageFloor;
        reason = 'structural: chip_shortage' + (waferMag !== null ? ' (wafer starts ' + (waferMag * 100).toFixed(0) + '% drop YoY > 30%)' : '');
      } else if (floor > 0) {
        reason += ' + chip_shortage';
      }
    }
    // (1) Compute-capacity exhaustion: GPU utilization > 95% ALWAYS triggers compute_capacity
    //     (data-infrastructure / cloud capacity ceiling — NVDA/MSFT/AMZN/GOOGL/AMD exposure).
    //     gpuUtilization accepts fraction (0.97) or percent (97) form.
    var gpuUtil = (feed.gpuUtilization !== undefined) ? feed.gpuUtilization
                : (feed.computeUtilization !== undefined) ? feed.computeUtilization
                : null;
    var gpuFrac = (gpuUtil !== null && gpuUtil > 1) ? gpuUtil / 100 : gpuUtil;
    if ((gpuFrac !== null && gpuFrac > 0.95 && (_has('gpu') || _has('compute') || _has('utiliz') || _has('capacity'))) ||
        _has('compute capacity') || _has('compute-capacity') || _has('gpu exhaustion')) {
      if (_TECHNOLOGY_STRUCTURAL.computeCapacityFloor > floor) {
        floor = _TECHNOLOGY_STRUCTURAL.computeCapacityFloor;
        reason = 'structural: compute_capacity' + (gpuFrac !== null ? ' (GPU utilization ' + (gpuFrac * 100).toFixed(0) + '% > 95%)' : '');
      } else if (floor > 0) {
        reason += ' + compute_capacity';
      }
    }
    // (4) Cyber-breach surge: 0-day exploit rate > 3 per week ALWAYS triggers cyber_breach
    //     (LOAD-BEARING active-exploitation signal, NOT routine CVE churn — CRWD/PANW exposure).
    var zeroDayRate = (feed.zeroDayExploitRate !== undefined) ? feed.zeroDayExploitRate
                    : (feed.activeExploitRate !== undefined) ? feed.activeExploitRate
                    : null;
    if ((zeroDayRate !== null && zeroDayRate > 3 && (_has('0-day') || _has('zero-day') || _has('exploit') || _has('breach') || _has('cyber'))) ||
        _has('cyber breach') || _has('zero-day exploitation') || _has('active exploitation')) {
      if (_TECHNOLOGY_STRUCTURAL.cyberBreachFloor > floor) {
        floor = _TECHNOLOGY_STRUCTURAL.cyberBreachFloor;
        reason = 'structural: cyber_breach' + (zeroDayRate !== null ? ' (0-day exploit rate ' + zeroDayRate.toFixed(0) + '/week > 3)' : '');
      } else if (floor > 0) {
        reason += ' + cyber_breach';
      }
    }
    // (5) Platform monopoly: top-3 vendor lock-in > 80% ALWAYS triggers platform_monopoly
    //     (platform-network concentration constraint — AAPL/MSFT/GOOGL/AMZN/META/ORCL exposure).
    //     topVendorLockIn accepts fraction (0.85) or percent (85) form.
    var vendorLockIn = (feed.topVendorLockIn !== undefined) ? feed.topVendorLockIn
                     : (feed.platformConcentration !== undefined) ? feed.platformConcentration
                     : null;
    var lockInFrac = (vendorLockIn !== null && vendorLockIn > 1) ? vendorLockIn / 100 : vendorLockIn;
    if ((lockInFrac !== null && lockInFrac > 0.80 && (_has('vendor') || _has('lock-in') || _has('monopol') || _has('platform') || _has('concentrat'))) ||
        _has('platform monopoly') || _has('vendor lock-in') || _has('platform-monopoly')) {
      if (_TECHNOLOGY_STRUCTURAL.platformMonopolyFloor > floor) {
        floor = _TECHNOLOGY_STRUCTURAL.platformMonopolyFloor;
        reason = 'structural: platform_monopoly' + (lockInFrac !== null ? ' (top-3 vendor lock-in ' + (lockInFrac * 100).toFixed(0) + '% > 80%)' : '');
      } else if (floor > 0) {
        reason += ' + platform_monopoly';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect defense FORCE-READINESS / PROCUREMENT / INDUSTRIAL-BASE / ALLIANCE structural
  // constraints from a feed object. Returns a forced stress floor (0 if none) — readiness /
  // supply / concentration / treaty breaches bypass the GDELT tone/headline-volume saturation
  // that the generic defense feed is prone to. Mirrors _infraStructuralFloor /
  // _cultureStructuralFloor / _financeStructuralFloor / _economyStructuralFloor /
  // _technologyStructuralFloor: force-readiness / procurement-delay / industrial-base-strain /
  // alliance-stress are load-bearing defense-posture constraints, not headline noise to dampen.
  // Binds to readiness / munitions-stockpile / weapons-lead-time / supplier-concentration /
  // basing-treaty metrics and defense tickers (LMT, RTX, NOC, GD, BA, LHX, HII, LDOS, BAH,
  // KTOS, AVAV) — DISTINCT from intelligence (collection/espionage) and from technology (cyber
  // is a coupling); NEVER oil/gas/grid as the domain's OWN content (defense couples to energy
  // via operational fuel / the Strategic Petroleum Reserve, but its identity stays kinetic /
  // industrial / readiness).
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _defenseStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (3) Industrial-base strain: defense-industrial consolidation / key-supplier failure
    //     ALWAYS triggers industrial_base_strain (highest defense floor — a primes/supplier
    //     concentration break in the defense industrial base; LMT/RTX/NOC/GD/BA/HII exposure).
    //     supplierConcentration accepts fraction (0.85) or percent (85) form; a sole-source
    //     dependency or an explicit key-supplier-failure signal also trips it.
    var supplierConcentration = (feed.supplierConcentration !== undefined) ? feed.supplierConcentration
                              : (feed.industrialBaseConcentration !== undefined) ? feed.industrialBaseConcentration
                              : null;
    var concFrac = (supplierConcentration !== null && supplierConcentration > 1) ? supplierConcentration / 100 : supplierConcentration;
    if ((concFrac !== null && concFrac > 0.80 && (_has('supplier') || _has('industrial base') || _has('consolidat') || _has('sole-source') || _has('sole source'))) ||
        _has('industrial base strain') || _has('industrial-base') || _has('key-supplier failure') || _has('supplier failure') || _has('defense consolidation')) {
      if (_DEFENSE_STRUCTURAL.industrialBaseStrainFloor > floor) {
        floor = _DEFENSE_STRUCTURAL.industrialBaseStrainFloor;
        reason = 'structural: industrial_base_strain' + (concFrac !== null ? ' (supplier concentration ' + (concFrac * 100).toFixed(0) + '% > 80%)' : '');
      }
    }
    // (1) Force-readiness breach: active-threat / conflict-escalation readiness drop ALWAYS
    //     triggers force_readiness (the operational-readiness constraint — readiness rate is a
    //     fraction of force ready-for-deployment; a drop below 0.60 is a structural breach).
    var readinessRate = (feed.forceReadinessRate !== undefined) ? feed.forceReadinessRate
                      : (feed.readinessRate !== undefined) ? feed.readinessRate
                      : null;
    var readinessFrac = (readinessRate !== null && readinessRate > 1) ? readinessRate / 100 : readinessRate;
    if ((readinessFrac !== null && readinessFrac < 0.60 && (_has('readiness') || _has('readY') || _has('deploy') || _has('threat') || _has('escalat'))) ||
        _has('force readiness') || _has('force-readiness') || _has('readiness breach') || _has('active threat') || _has('conflict escalation') || _has('conflict-escalation')) {
      if (_DEFENSE_STRUCTURAL.forceReadinessFloor > floor) {
        floor = _DEFENSE_STRUCTURAL.forceReadinessFloor;
        reason = 'structural: force_readiness' + (readinessFrac !== null ? ' (readiness ' + (readinessFrac * 100).toFixed(0) + '% < 60%)' : '');
      } else if (floor > 0) {
        reason += ' + force_readiness';
      }
    }
    // (4) Alliance stress: basing-rights loss / treaty-violation breach ALWAYS triggers
    //     alliance_stress (the deterrence-network constraint — loss of forward basing or a
    //     treaty rupture; an explicit signal or a basing-access drop below 0.70 trips it).
    var basingAccess = (feed.basingAccessRate !== undefined) ? feed.basingAccessRate
                     : (feed.allianceCohesion !== undefined) ? feed.allianceCohesion
                     : null;
    var basingFrac = (basingAccess !== null && basingAccess > 1) ? basingAccess / 100 : basingAccess;
    if ((basingFrac !== null && basingFrac < 0.70 && (_has('basing') || _has('alliance') || _has('treaty') || _has('access'))) ||
        _has('alliance stress') || _has('alliance-stress') || _has('basing rights') || _has('basing-rights') || _has('treaty violation') || _has('treaty-violation')) {
      if (_DEFENSE_STRUCTURAL.allianceStressFloor > floor) {
        floor = _DEFENSE_STRUCTURAL.allianceStressFloor;
        reason = 'structural: alliance_stress' + (basingFrac !== null ? ' (basing/alliance access ' + (basingFrac * 100).toFixed(0) + '% < 70%)' : '');
      } else if (floor > 0) {
        reason += ' + alliance_stress';
      }
    }
    // (2) Procurement delay: critical munitions-stockpile depletion / weapons-system lead-time
    //     breach ALWAYS triggers procurement_delay (lowest defense floor — a supply-pipeline
    //     constraint). munitionsStockpileMonths below 3 months of supply, or a weapons lead-time
    //     blowout, or an explicit signal trips it.
    var stockpileMonths = (feed.munitionsStockpileMonths !== undefined) ? feed.munitionsStockpileMonths
                        : (feed.stockpileMonths !== undefined) ? feed.stockpileMonths
                        : null;
    var leadTimeMonths = (feed.weaponsLeadTimeMonths !== undefined) ? feed.weaponsLeadTimeMonths
                       : (feed.procurementLeadTimeMonths !== undefined) ? feed.procurementLeadTimeMonths
                       : null;
    if ((stockpileMonths !== null && stockpileMonths < 3 && (_has('munition') || _has('stockpile') || _has('procure') || _has('weapon'))) ||
        (leadTimeMonths !== null && leadTimeMonths > 36 && (_has('lead-time') || _has('lead time') || _has('procure') || _has('weapon'))) ||
        _has('procurement delay') || _has('procurement-delay') || _has('munitions depletion') || _has('stockpile depletion') || _has('weapons-system lead-time')) {
      if (_DEFENSE_STRUCTURAL.procurementDelayFloor > floor) {
        floor = _DEFENSE_STRUCTURAL.procurementDelayFloor;
        reason = 'structural: procurement_delay' +
          (stockpileMonths !== null && stockpileMonths < 3 ? ' (munitions stockpile ' + stockpileMonths.toFixed(1) + ' mo < 3 mo)'
           : (leadTimeMonths !== null && leadTimeMonths > 36 ? ' (weapons lead-time ' + Math.round(leadTimeMonths) + ' mo > 36 mo)' : ''));
      } else if (floor > 0) {
        reason += ' + procurement_delay';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect intelligence OBSERVABILITY / ANALYTIC-INTEGRITY / OVERSIGHT / COUNTERINTELLIGENCE
  // structural constraints from a feed object. Returns a forced stress floor (0 if none) —
  // observability / trust breaches bypass the GDELT tone/headline-churn saturation that the
  // generic intelligence feed is prone to. Mirrors _infraStructuralFloor /
  // _cultureStructuralFloor / _financeStructuralFloor / _economyStructuralFloor /
  // _technologyStructuralFloor / _defenseStructuralFloor: collection-gap / analytical-distortion /
  // oversight-failure / counterintelligence-failure are load-bearing intelligence-posture
  // constraints, not headline noise to dampen.
  // Binds to collection-gap / analytic-confidence / oversight-compliance / CI-readiness metrics
  // and intelligence tickers (PLTR, BAH, LDOS, CACI, SAIC, KBR, VRNT, NICE, VRSK) — DISTINCT
  // from defense (kinetic/industrial/readiness) and from technology (cyber tooling is a coupling);
  // NEVER oil/gas/grid as the domain's OWN content (intelligence couples to defense via threat
  // warning and to technology via cyber/SIGINT tooling, but its identity stays observability /
  // assessment / tradecraft).
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _intelligenceStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (2) Analytical distortion: systematic analytic failure / politicization ALWAYS triggers
    //     analytical_distortion (highest intelligence floor — an all-source assessment-integrity
    //     break; PLTR/BAH/CACI/SAIC all-source-analysis exposure). analyticalConfidence is a
    //     fraction of analytic reliability; a drop below 0.50 is a structural distortion.
    var analyticalConfidence = (feed.analyticalConfidence !== undefined) ? feed.analyticalConfidence
                             : (feed.analyticConfidence !== undefined) ? feed.analyticConfidence
                             : null;
    var analyticFrac = (analyticalConfidence !== null && analyticalConfidence > 1) ? analyticalConfidence / 100 : analyticalConfidence;
    if ((analyticFrac !== null && analyticFrac < 0.50 && (_has('analy') || _has('assess') || _has('confidence') || _has('politiciz') || _has('distort'))) ||
        _has('analytical distortion') || _has('analytic distortion') || _has('analytic failure') || _has('politicization') || _has('assessment failure')) {
      if (_INTELLIGENCE_STRUCTURAL.analyticalDistortionFloor > floor) {
        floor = _INTELLIGENCE_STRUCTURAL.analyticalDistortionFloor;
        reason = 'structural: analytical_distortion' + (analyticFrac !== null ? ' (analytic confidence ' + (analyticFrac * 100).toFixed(0) + '% < 50%)' : '');
      }
    }
    // (1) Collection gap: persistent observability deficit / blind spot ALWAYS triggers
    //     collection_gap (the SIGINT/HUMINT/GEOINT/OSINT coverage constraint — PLTR/VRNT/NICE
    //     collection-tooling exposure). collectionGap is a fraction of the priority requirement
    //     left uncovered; a gap above 0.40 is a structural observability deficit.
    var collectionGap = (feed.collectionGap !== undefined) ? feed.collectionGap
                      : (feed.observabilityGap !== undefined) ? feed.observabilityGap
                      : null;
    var gapFrac = (collectionGap !== null && collectionGap > 1) ? collectionGap / 100 : collectionGap;
    if ((gapFrac !== null && gapFrac > 0.40 && (_has('collection') || _has('coverage') || _has('blind spot') || _has('blind-spot') || _has('sigint') || _has('humint') || _has('geoint') || _has('osint') || _has('observ'))) ||
        _has('collection gap') || _has('collection-gap') || _has('observability deficit') || _has('intelligence gap')) {
      if (_INTELLIGENCE_STRUCTURAL.collectionGapFloor > floor) {
        floor = _INTELLIGENCE_STRUCTURAL.collectionGapFloor;
        reason = 'structural: collection_gap' + (gapFrac !== null ? ' (collection gap ' + (gapFrac * 100).toFixed(0) + '% > 40%)' : '');
      } else if (floor > 0) {
        reason += ' + collection_gap';
      }
    }
    // (3) Oversight failure: confirmed legal/constitutional violation ALWAYS triggers
    //     oversight_failure (the rule-of-law / FISA / civil-liberties constraint — a confirmed
    //     compliance breach, not a routine audit finding). oversightCompliance is a fraction of
    //     legal/oversight compliance; a drop below 0.50 (or an explicit confirmed-violation
    //     signal) is a structural oversight failure.
    var oversightCompliance = (feed.oversightCompliance !== undefined) ? feed.oversightCompliance
                            : (feed.legalCompliance !== undefined) ? feed.legalCompliance
                            : null;
    var oversightFrac = (oversightCompliance !== null && oversightCompliance > 1) ? oversightCompliance / 100 : oversightCompliance;
    if ((oversightFrac !== null && oversightFrac < 0.50 && (_has('oversight') || _has('compliance') || _has('fisa') || _has('constitution') || _has('legal') || _has('civil libert') || _has('violation'))) ||
        _has('oversight failure') || _has('oversight-failure') || _has('constitutional violation') || _has('fisa violation') || _has('unlawful surveillance')) {
      if (_INTELLIGENCE_STRUCTURAL.oversightFailureFloor > floor) {
        floor = _INTELLIGENCE_STRUCTURAL.oversightFailureFloor;
        reason = 'structural: oversight_failure' + (oversightFrac !== null ? ' (oversight compliance ' + (oversightFrac * 100).toFixed(0) + '% < 50%)' : '');
      } else if (floor > 0) {
        reason += ' + oversight_failure';
      }
    }
    // (4) Counterintelligence failure: active CI loss / penetration confirmed ALWAYS triggers
    //     counterintelligence_failure (the espionage/insider-risk constraint — a confirmed
    //     penetration or clearance-trust breach; LDOS/KBR/SAIC insider-risk exposure).
    //     counterintelligenceReadiness is a fraction of CI/insider-risk posture; a drop below
    //     0.55 (or an explicit penetration/mole signal) is a structural CI failure.
    var ciReadiness = (feed.counterintelligenceReadiness !== undefined) ? feed.counterintelligenceReadiness
                    : (feed.ciReadiness !== undefined) ? feed.ciReadiness
                    : null;
    var ciFrac = (ciReadiness !== null && ciReadiness > 1) ? ciReadiness / 100 : ciReadiness;
    if ((ciFrac !== null && ciFrac < 0.55 && (_has('counterintel') || _has('counter-intel') || _has('penetrat') || _has('insider') || _has('mole') || _has('espionage') || _has('clearance'))) ||
        _has('counterintelligence failure') || _has('counterintelligence-failure') || _has('counterintelligence loss') || _has('penetration confirmed') || _has('insider threat')) {
      if (_INTELLIGENCE_STRUCTURAL.counterintelligenceFailureFloor > floor) {
        floor = _INTELLIGENCE_STRUCTURAL.counterintelligenceFailureFloor;
        reason = 'structural: counterintelligence_failure' + (ciFrac !== null ? ' (CI readiness ' + (ciFrac * 100).toFixed(0) + '% < 55%)' : '');
      } else if (floor > 0) {
        reason += ' + counterintelligence_failure';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect trade / supply-chain TRADE-POLICY / LOGISTICS / CHOKEPOINT / SANCTIONS structural
  // constraints from a feed object. Returns a forced stress floor (0 if none) — trade-flow
  // breaches bypass the commodity-price / freight-rate / headline-volume saturation that the
  // generic trade feed is prone to. Mirrors _infraStructuralFloor / _cultureStructuralFloor /
  // _financeStructuralFloor / _economyStructuralFloor / _technologyStructuralFloor /
  // _defenseStructuralFloor / _intelligenceStructuralFloor: tariff-shock / port-closure /
  // sanctions-escalation / shipping-crisis / customs-blockade are load-bearing trade-flow
  // constraints, not commodity noise to dampen.
  // Binds to tariff-escalation / port-closure / OFAC-USTR-designation / freight-rate-spike /
  // customs-delay metrics and trade/logistics tickers (FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO,
  // GXO, AMKBY, DSDVY, ODFL) — DISTINCT from economy (macro aggregate) and from industry
  // (production); NEVER oil/gas/grid as the domain's OWN content (the trade signal is the
  // throughput/closure of cross-border flow, not the commodity carried).
  // The trade-brain normalizeSignals scans these institutional feeds (USTR/CBP/OFAC, port
  // authorities, freight indices) — this floor mirrors that on the client advisory layer.
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _tradeStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (2) Sanctions escalation: OFAC/USTR designation surge / embargo ALWAYS triggers
    //     sanctions_escalation (highest trade floor alongside port closure — a sovereign
    //     trade-policy rupture that severs flows; an explicit embargo/sanctions signal or a
    //     designation-count surge above 5 new notices trips it).
    var sanctionsCount = (feed.sanctionsNoticeCount !== undefined) ? feed.sanctionsNoticeCount
                       : (feed.ofacDesignationCount !== undefined) ? feed.ofacDesignationCount
                       : null;
    if ((sanctionsCount !== null && sanctionsCount > 5 && (_has('sanction') || _has('ofac') || _has('embargo') || _has('designation') || _has('export control'))) ||
        _has('sanctions escalation') || _has('sanctions-escalation') || _has('new sanctions') || _has('embargo') || _has('export ban')) {
      if (_TRADE_STRUCTURAL.sanctionsEscalationFloor > floor) {
        floor = _TRADE_STRUCTURAL.sanctionsEscalationFloor;
        reason = 'structural: sanctions_escalation' + (sanctionsCount !== null ? ' (' + Math.round(sanctionsCount) + ' new sanctions notices > 5)' : '');
      }
    }
    // (3) Port closure: major-port shutdown / strike / chokepoint blockage ALWAYS triggers
    //     port_closure (a logistics-chokepoint constraint — a closed port or blocked canal
    //     halts throughput; ZIM/MATX/FDX/UPS/EXPD exposure). An explicit closure signal or a
    //     port-closure-event count above 0 trips it.
    var portClosures = (feed.portClosureCount !== undefined) ? feed.portClosureCount
                     : (feed.closedPortCount !== undefined) ? feed.closedPortCount
                     : null;
    if ((portClosures !== null && portClosures > 0 && (_has('port') || _has('chokepoint') || _has('canal') || _has('strait') || _has('blockad') || _has('strike'))) ||
        _has('port closure') || _has('port-closure') || _has('port shutdown') || _has('port strike') || _has('canal closure') || _has('chokepoint')) {
      if (_TRADE_STRUCTURAL.portClosureFloor > floor) {
        floor = _TRADE_STRUCTURAL.portClosureFloor;
        reason = 'structural: port_closure' + (portClosures !== null ? ' (' + Math.round(portClosures) + ' major-port closure event(s))' : '');
      } else if (floor > 0) {
        reason += ' + port_closure';
      }
    }
    // (4) Shipping crisis: freight-rate spike / vessel-rerouting / canal closure ALWAYS triggers
    //     shipping_crisis (the freight-network constraint — a sustained rate spike or mass
    //     rerouting; ZIM/MATX/AMKBY/DSDVY exposure). A freight-rate multiple above 2x baseline
    //     or an explicit rerouting/crisis signal trips it.
    var freightRateMultiple = (feed.freightRateMultiple !== undefined) ? feed.freightRateMultiple
                            : (feed.shippingRateMultiple !== undefined) ? feed.shippingRateMultiple
                            : null;
    if ((freightRateMultiple !== null && freightRateMultiple > 2 && (_has('freight') || _has('shipping') || _has('container') || _has('vessel') || _has('rate'))) ||
        _has('shipping crisis') || _has('shipping-crisis') || _has('freight spike') || _has('vessel rerouting') || _has('rerouting') || _has('container shortage')) {
      if (_TRADE_STRUCTURAL.shippingCrisisFloor > floor) {
        floor = _TRADE_STRUCTURAL.shippingCrisisFloor;
        reason = 'structural: shipping_crisis' + (freightRateMultiple !== null ? ' (freight rate ' + freightRateMultiple.toFixed(1) + 'x > 2x baseline)' : '');
      } else if (floor > 0) {
        reason += ' + shipping_crisis';
      }
    }
    // (1) Tariff shock: tariff escalation / new-tariff announcement surge ALWAYS triggers
    //     tariff_shock (the trade-policy constraint — a tariff regime change reprices flows;
    //     USTR/Section-301 exposure). A new-tariff-action count above 3 or an explicit
    //     tariff-shock/escalation signal trips it.
    var tariffActionCount = (feed.tariffActionCount !== undefined) ? feed.tariffActionCount
                          : (feed.tariffEscalationCount !== undefined) ? feed.tariffEscalationCount
                          : null;
    if ((tariffActionCount !== null && tariffActionCount > 3 && (_has('tariff') || _has('duty') || _has('section 301') || _has('section-301') || _has('trade war') || _has('trade-war'))) ||
        _has('tariff shock') || _has('tariff-shock') || _has('tariff escalation') || _has('new tariff') || _has('tariff hike') || _has('trade war')) {
      if (_TRADE_STRUCTURAL.tariffShockFloor > floor) {
        floor = _TRADE_STRUCTURAL.tariffShockFloor;
        reason = 'structural: tariff_shock' + (tariffActionCount !== null ? ' (' + Math.round(tariffActionCount) + ' new tariff actions > 3)' : '');
      } else if (floor > 0) {
        reason += ' + tariff_shock';
      }
    }
    // (5) Customs blockade: customs-delay surge / border holds / CBP enforcement ALWAYS triggers
    //     customs_blockade (the border-throughput constraint — a customs slowdown holds cargo;
    //     EXPD/CHRW/XPO/GXO/ODFL exposure). A customs-delay-days reading above 5 days or an
    //     explicit blockade/hold signal trips it.
    var customsDelayDays = (feed.customsDelayDays !== undefined) ? feed.customsDelayDays
                         : (feed.borderHoldDays !== undefined) ? feed.borderHoldDays
                         : null;
    if ((customsDelayDays !== null && customsDelayDays > 5 && (_has('customs') || _has('border') || _has('cbp') || _has('clearance') || _has('inspection') || _has('hold'))) ||
        _has('customs blockade') || _has('customs-blockade') || _has('customs delay') || _has('border hold') || _has('cbp enforcement') || _has('cargo hold')) {
      if (_TRADE_STRUCTURAL.customsBlockadeFloor > floor) {
        floor = _TRADE_STRUCTURAL.customsBlockadeFloor;
        reason = 'structural: customs_blockade' + (customsDelayDays !== null ? ' (customs delay ' + customsDelayDays.toFixed(1) + ' days > 5)' : '');
      } else if (floor > 0) {
        reason += ' + customs_blockade';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect industry PRODUCTION / CAPACITY / AUTOMATION / INPUT-COST / LABOR / SUPPLY structural
  // constraints from a feed object. Returns a forced stress floor (0 if none) — production-ceiling /
  // equipment / input-cost / labor / bottleneck breaches bypass the machinery-order / industrial-
  // index volume saturation that the generic industry feed is prone to. Mirrors
  // _infraStructuralFloor / _cultureStructuralFloor / _financeStructuralFloor / _economyStructuralFloor /
  // _technologyStructuralFloor / _defenseStructuralFloor / _intelligenceStructuralFloor /
  // _tradeStructuralFloor: capacity-constraint / automation-failure / input-cost-spike /
  // labor-shortage / supply-bottleneck are load-bearing physical-production constraints, not
  // commodity-signal noise to be averaged down.
  // Binds to FRED INDPRO / capacity-utilization (TCU) / producer-price (PPI), ISM Manufacturing PMI,
  // and CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV/GEV machinery-order metrics — DISTINCT from trade
  // (logistics/commerce), economy (macro aggregate), and technology (automation is a coupling, not
  // the identity); NEVER oil/gas/grid as the domain's OWN content (a factory consumes energy, but the
  // industrial signal is output/capacity/uptime, not the commodity). The capacity-utilization > 85%
  // ceiling mirrors energy's grid reserve-margin < 10% floor — a real production ceiling never
  // averaged down by volume dampening.
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _industryStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (5) Supply bottleneck: component lead-time > 90 days ALWAYS triggers supply_bottleneck
    //     (highest industry floor — a sourcing constraint that halts the production line;
    //     CAT/DE/GE/EMR/PH/ETN exposure). leadTimeDays above 90, or an explicit
    //     bottleneck/lead-time signal, trips it.
    var leadTimeDays = (feed.componentLeadTimeDays !== undefined) ? feed.componentLeadTimeDays
                     : (feed.supplierLeadTimeDays !== undefined) ? feed.supplierLeadTimeDays
                     : null;
    if ((leadTimeDays !== null && leadTimeDays > 90 && (_has('lead time') || _has('lead-time') || _has('component') || _has('bottleneck') || _has('backlog') || _has('supplier'))) ||
        _has('supply bottleneck') || _has('supply-bottleneck') || _has('component shortage') || _has('parts shortage') || _has('production halt')) {
      if (_INDUSTRY_STRUCTURAL.supplyBottleneckFloor > floor) {
        floor = _INDUSTRY_STRUCTURAL.supplyBottleneckFloor;
        reason = 'structural: supply_bottleneck' + (leadTimeDays !== null ? ' (component lead-time ' + Math.round(leadTimeDays) + ' days > 90)' : '');
      }
    }
    // (3) Input-cost spike: producer-price inflation > 10% YoY ALWAYS triggers input_cost_spike
    //     (a raw-material/PPI cost shock that compresses industrial margins; ITW/DOV/MMM/HON
    //     exposure). ppiInflationYoY accepts fraction (0.12) or percent (12) form; an explicit
    //     input-cost/PPI signal also trips it.
    var ppiInflation = (feed.ppiInflationYoY !== undefined) ? feed.ppiInflationYoY
                     : (feed.producerPriceInflation !== undefined) ? feed.producerPriceInflation
                     : null;
    var ppiFrac = (ppiInflation !== null && ppiInflation > 1) ? ppiInflation / 100 : ppiInflation;
    if ((ppiFrac !== null && ppiFrac > 0.10 && (_has('input cost') || _has('input-cost') || _has('ppi') || _has('producer price') || _has('material') || _has('inflation') || _has('commodit'))) ||
        _has('input cost spike') || _has('input-cost-spike') || _has('producer price inflation') || _has('material cost surge')) {
      if (_INDUSTRY_STRUCTURAL.inputCostFloor > floor) {
        floor = _INDUSTRY_STRUCTURAL.inputCostFloor;
        reason = 'structural: input_cost_spike' + (ppiFrac !== null ? ' (producer-price inflation ' + (ppiFrac * 100).toFixed(1) + '% YoY > 10%)' : '');
      } else if (floor > 0) {
        reason += ' + input_cost_spike';
      }
    }
    // (1) Capacity-utilization ceiling: capacity utilization > 85% ALWAYS triggers capacity_constraint
    //     (the load-bearing production ceiling — mirrors energy's grid reserve margin < 10%; a real
    //     production limit never averaged down by machinery-order volume dampening; CAT/DE/GE/EMR/ROK
    //     exposure, FRED TCU / capacity-utilization). capacityUtilization accepts fraction (0.88) or
    //     percent (88) form; an explicit capacity-constraint/at-capacity signal also trips it.
    var capacityUtil = (feed.capacityUtilization !== undefined) ? feed.capacityUtilization
                     : (feed.utilizationRate !== undefined) ? feed.utilizationRate
                     : null;
    var capFrac = (capacityUtil !== null && capacityUtil > 1) ? capacityUtil / 100 : capacityUtil;
    if ((capFrac !== null && capFrac > 0.85 && (_has('capacity') || _has('utiliz') || _has('output') || _has('production') || _has('at capacity'))) ||
        _has('capacity constraint') || _has('capacity-constraint') || _has('at capacity') || _has('maxed out') || _has('full capacity')) {
      if (_INDUSTRY_STRUCTURAL.capacityUtilizationFloor > floor) {
        floor = _INDUSTRY_STRUCTURAL.capacityUtilizationFloor;
        reason = 'structural: capacity_constraint' + (capFrac !== null ? ' (capacity utilization ' + (capFrac * 100).toFixed(0) + '% > 85%)' : '');
      } else if (floor > 0) {
        reason += ' + capacity_constraint';
      }
    }
    // (4) Labor shortage: unemployment below NAIRU OR manufacturing wage growth > 3% ALWAYS triggers
    //     labor_shortage (a workforce constraint on production; ITW/PH/EMR/DOV exposure). Either a
    //     sub-NAIRU unemployment reading or a manufacturing-wage-growth spike, or an explicit
    //     labor-shortage/worker-shortage signal, trips it.
    var mfgUnemp = (feed.manufacturingUnemploymentRate !== undefined) ? feed.manufacturingUnemploymentRate
                 : (feed.unemploymentRate !== undefined) ? feed.unemploymentRate
                 : null;
    var mfgUnempFrac = (mfgUnemp !== null && mfgUnemp > 1) ? mfgUnemp / 100 : mfgUnemp;
    var nairuInd = (feed.nairu !== undefined) ? ((feed.nairu > 1) ? feed.nairu / 100 : feed.nairu) : 0.044;
    var mfgWageGrowth = (feed.manufacturingWageGrowth !== undefined) ? feed.manufacturingWageGrowth
                      : (feed.mfgWageGrowthYoY !== undefined) ? feed.mfgWageGrowthYoY
                      : null;
    var wageGrowthFrac = (mfgWageGrowth !== null && (mfgWageGrowth > 1 || mfgWageGrowth < -1)) ? mfgWageGrowth / 100 : mfgWageGrowth;
    if ((mfgUnempFrac !== null && mfgUnempFrac < nairuInd && (_has('labor') || _has('worker') || _has('hiring') || _has('shortage') || _has('unemploy'))) ||
        (wageGrowthFrac !== null && wageGrowthFrac > 0.03 && (_has('wage') || _has('labor') || _has('worker'))) ||
        _has('labor shortage') || _has('labor-shortage') || _has('worker shortage') || _has('skills shortage')) {
      if (_INDUSTRY_STRUCTURAL.laborShortageFloor > floor) {
        floor = _INDUSTRY_STRUCTURAL.laborShortageFloor;
        reason = 'structural: labor_shortage' + (mfgUnempFrac !== null && mfgUnempFrac < nairuInd ? ' (unemployment ' + (mfgUnempFrac * 100).toFixed(1) + '% < NAIRU ' + (nairuInd * 100).toFixed(1) + '%)' : (wageGrowthFrac !== null ? ' (mfg wage growth ' + (wageGrowthFrac * 100).toFixed(1) + '% > 3%)' : ''));
      } else if (floor > 0) {
        reason += ' + labor_shortage';
      }
    }
    // (2) Automation/equipment failure: equipment downtime > 5% ALWAYS triggers automation_failure
    //     (a robotics/equipment-uptime constraint on the factory floor — automation/robotics is a
    //     technology COUPLING, not the identity; ROK/EMR/HON/ETN exposure). equipmentDowntime
    //     accepts fraction (0.06) or percent (6) form; an explicit downtime/automation-failure
    //     signal also trips it.
    var equipmentDowntime = (feed.equipmentDowntime !== undefined) ? feed.equipmentDowntime
                          : (feed.machineDowntimeRate !== undefined) ? feed.machineDowntimeRate
                          : null;
    var downtimeFrac = (equipmentDowntime !== null && equipmentDowntime > 1) ? equipmentDowntime / 100 : equipmentDowntime;
    if ((downtimeFrac !== null && downtimeFrac > 0.05 && (_has('downtime') || _has('equipment') || _has('automation') || _has('robot') || _has('machine') || _has('breakdown') || _has('maintenance'))) ||
        _has('automation failure') || _has('automation-failure') || _has('equipment failure') || _has('machine downtime') || _has('line down')) {
      if (_INDUSTRY_STRUCTURAL.automationFailureFloor > floor) {
        floor = _INDUSTRY_STRUCTURAL.automationFailureFloor;
        reason = 'structural: automation_failure' + (downtimeFrac !== null ? ' (equipment downtime ' + (downtimeFrac * 100).toFixed(1) + '% > 5%)' : '');
      } else if (floor > 0) {
        reason += ' + automation_failure';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect agriculture CROP / LIVESTOCK / FOOD-SUPPLY / INPUT-COST / FARM-ECONOMICS structural
  // constraints from a feed object. Returns a forced stress floor (0 if none) — food-system breaches
  // bypass the commodity-price / WASDE-revision volume saturation that the generic agriculture feed is
  // prone to. Mirrors _infraStructuralFloor / _cultureStructuralFloor / _financeStructuralFloor /
  // _economyStructuralFloor / _technologyStructuralFloor / _defenseStructuralFloor /
  // _intelligenceStructuralFloor / _tradeStructuralFloor / _industryStructuralFloor: crop-failure /
  // drought-severity / livestock-disease / food-price-surge / export-ban / farm-debt-distress are
  // load-bearing food-system constraints, not commodity-signal noise to be averaged down.
  // Binds to CBOT corn/soy/wheat futures, USDA WASDE crop-condition / production / stocks-to-use, USDA
  // NASS drought & livestock data, and ag-sector tickers (ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG,
  // INGR, AGCO, FMC) — DISTINCT from environment (land/water/climate is a coupling), trade (export
  // logistics is a coupling), and economy (food prices are a coupling); NEVER oil/gas/grid as the
  // domain's OWN content (agriculture couples to energy via biofuel demand and fertilizer feedstock,
  // but its identity stays crops/livestock/food/inputs/farm-economics). The crop-loss > 30% ceiling
  // mirrors energy's grid reserve-margin < 10% floor — a real food-system constraint never averaged
  // down by commodity-price volume dampening.
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _agricultureStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (5) Export ban: ag export-market suddenly closed ALWAYS triggers export_ban
    //     (highest agriculture floor — a sovereign closure of a grain/protein export market severs
    //     farm-revenue and food-supply flows; ADM/BG/INGR grain-trading exposure, USDA FAS export
    //     data). An explicit export-ban signal, or an exportMarketClosed flag, trips it.
    var exportMarketClosed = (feed.exportMarketClosed !== undefined) ? feed.exportMarketClosed
                           : (feed.agExportBan !== undefined) ? feed.agExportBan
                           : null;
    if ((exportMarketClosed === true) ||
        _has('export ban') || _has('export-ban') || _has('grain export ban') || _has('export halt') || _has('export market closed') || _has('export embargo')) {
      if (_AGRICULTURE_STRUCTURAL.exportBanFloor > floor) {
        floor = _AGRICULTURE_STRUCTURAL.exportBanFloor;
        reason = 'structural: export_ban (ag export-market closure)';
      }
    }
    // (1) Crop failure: regional crop-loss > 30% ALWAYS triggers crop_failure
    //     (the load-bearing food-system ceiling — mirrors energy's grid reserve margin < 10%; a real
    //     yield collapse never averaged down by WASDE-revision volume dampening; ADM/BG/CTVA/CAG/INGR
    //     exposure, USDA WASDE crop-condition / production). cropLossRate accepts fraction (0.35) or
    //     percent (35) form; an explicit crop-failure/yield-collapse signal also trips it.
    var cropLoss = (feed.cropLossRate !== undefined) ? feed.cropLossRate
                 : (feed.cropFailureRate !== undefined) ? feed.cropFailureRate
                 : null;
    var cropLossFrac = (cropLoss !== null && cropLoss > 1) ? cropLoss / 100 : cropLoss;
    if ((cropLossFrac !== null && cropLossFrac > 0.30 && (_has('crop') || _has('yield') || _has('harvest') || _has('corn') || _has('soy') || _has('wheat') || _has('failure'))) ||
        _has('crop failure') || _has('crop-failure') || _has('crop loss') || _has('yield collapse') || _has('harvest failure') || _has('total loss')) {
      if (_AGRICULTURE_STRUCTURAL.cropFailureFloor > floor) {
        floor = _AGRICULTURE_STRUCTURAL.cropFailureFloor;
        reason = 'structural: crop_failure' + (cropLossFrac !== null ? ' (regional crop-loss ' + (cropLossFrac * 100).toFixed(0) + '% > 30%)' : '');
      } else if (floor > 0) {
        reason += ' + crop_failure';
      }
    }
    // (4) Food-price surge: food-commodity price spike > 40% YoY ALWAYS triggers food_price_surge
    //     (a food-security constraint — a corn/soy/wheat futures spike repricing the food supply;
    //     ADM/BG/INGR/CAG exposure, CBOT corn/soy/wheat futures). foodPriceSurgeYoY accepts fraction
    //     (0.45) or percent (45) form; an explicit food-price-surge/grain-price-spike signal trips it.
    //     (Food prices couple to economy's CPI, but here the signal is the farm-revenue / food-
    //     security shock, NOT the macro inflation aggregate.)
    var foodPriceSurge = (feed.foodPriceSurgeYoY !== undefined) ? feed.foodPriceSurgeYoY
                       : (feed.cropPriceSpikeYoY !== undefined) ? feed.cropPriceSpikeYoY
                       : null;
    var foodPriceFrac = (foodPriceSurge !== null && (foodPriceSurge > 1 || foodPriceSurge < -1)) ? foodPriceSurge / 100 : foodPriceSurge;
    if ((foodPriceFrac !== null && foodPriceFrac > 0.40 && (_has('food price') || _has('food-price') || _has('grain price') || _has('commodity price') || _has('corn') || _has('soy') || _has('wheat') || _has('crop price'))) ||
        _has('food price surge') || _has('food-price-surge') || _has('grain price spike') || _has('food inflation') || _has('commodity surge')) {
      if (_AGRICULTURE_STRUCTURAL.foodPriceSurgeFloor > floor) {
        floor = _AGRICULTURE_STRUCTURAL.foodPriceSurgeFloor;
        reason = 'structural: food_price_surge' + (foodPriceFrac !== null ? ' (food-commodity price ' + (foodPriceFrac * 100).toFixed(0) + '% YoY > 40%)' : '');
      } else if (floor > 0) {
        reason += ' + food_price_surge';
      }
    }
    // (3) Livestock disease: animal-disease outbreak rate > 5% ALWAYS triggers livestock_disease
    //     (an animal-protein supply constraint — an HPAI/ASF/FMD outbreak culling herds/flocks;
    //     TSN/BG/CAG protein exposure, USDA APHIS/NASS livestock data). diseaseOutbreakRate accepts
    //     fraction (0.06) or percent (6) form; an explicit outbreak/avian-flu/swine-fever signal trips it.
    var diseaseRate = (feed.livestockDiseaseRate !== undefined) ? feed.livestockDiseaseRate
                    : (feed.animalDiseaseOutbreakRate !== undefined) ? feed.animalDiseaseOutbreakRate
                    : null;
    var diseaseFrac = (diseaseRate !== null && diseaseRate > 1) ? diseaseRate / 100 : diseaseRate;
    if ((diseaseFrac !== null && diseaseFrac > 0.05 && (_has('livestock') || _has('cattle') || _has('poultry') || _has('hog') || _has('herd') || _has('flock') || _has('disease') || _has('outbreak'))) ||
        _has('livestock disease') || _has('livestock-disease') || _has('avian flu') || _has('avian influenza') || _has('hpai') || _has('swine fever') || _has('african swine fever') || _has('foot-and-mouth') || _has('foot and mouth') || _has('herd cull') || _has('mass cull')) {
      if (_AGRICULTURE_STRUCTURAL.livestockDiseaseFloor > floor) {
        floor = _AGRICULTURE_STRUCTURAL.livestockDiseaseFloor;
        reason = 'structural: livestock_disease' + (diseaseFrac !== null ? ' (animal-disease outbreak rate ' + (diseaseFrac * 100).toFixed(0) + '% > 5%)' : '');
      } else if (floor > 0) {
        reason += ' + livestock_disease';
      }
    }
    // (2) Drought severity: drought-stress index above threshold ALWAYS triggers drought_severity
    //     (a crop-yield constraint — drought is an environment COUPLING, but here the signal is the
    //     yield/irrigation shock to crops, not an ecosystem signal; NTR/MOS/CF/DE/AGCO/FMC input &
    //     equipment exposure, USDA NASS drought / U.S. Drought Monitor). droughtStressIndex accepts
    //     fraction (0.70) or percent (70) form; D3/D4 (extreme/exceptional) drought, or an explicit
    //     drought/dry-conditions signal, trips it.
    var droughtStress = (feed.droughtStressIndex !== undefined) ? feed.droughtStressIndex
                      : (feed.droughtSeverityIndex !== undefined) ? feed.droughtSeverityIndex
                      : null;
    var droughtFrac = (droughtStress !== null && droughtStress > 1) ? droughtStress / 100 : droughtStress;
    if ((droughtFrac !== null && droughtFrac > 0.60 && (_has('drought') || _has('dry') || _has('irrigation') || _has('soil moisture') || _has('crop stress') || _has('parched'))) ||
        _has('drought severity') || _has('drought-severity') || _has('severe drought') || _has('extreme drought') || _has('exceptional drought') || _has('crop drought') || _has('d3') || _has('d4')) {
      if (_AGRICULTURE_STRUCTURAL.droughtSeverityFloor > floor) {
        floor = _AGRICULTURE_STRUCTURAL.droughtSeverityFloor;
        reason = 'structural: drought_severity' + (droughtFrac !== null ? ' (drought-stress index ' + (droughtFrac * 100).toFixed(0) + '% > threshold)' : '');
      } else if (floor > 0) {
        reason += ' + drought_severity';
      }
    }
    // (6) Farm-debt distress: farm debt-to-income ratio > 1.5 ALWAYS triggers farm_debt_distress
    //     (a farm-economics solvency constraint — leverage that threatens the producer balance sheet;
    //     DE/AGCO equipment-finance exposure, USDA ERS farm-sector debt/income). farmDebtToIncome
    //     above 1.5, or an explicit farm-debt/foreclosure/insolvency signal, trips it. (DISTINCT from
    //     finance's solvency floors — this is the farm-sector balance sheet, not capital-market plumbing.)
    var farmDebtRatio = (feed.farmDebtToIncome !== undefined) ? feed.farmDebtToIncome
                      : (feed.farmDebtIncomeRatio !== undefined) ? feed.farmDebtIncomeRatio
                      : null;
    if ((farmDebtRatio !== null && farmDebtRatio > 1.5 && (_has('farm debt') || _has('farm-debt') || _has('debt-to-income') || _has('leverage') || _has('insolven') || _has('farm income') || _has('farm bankrupt'))) ||
        _has('farm debt distress') || _has('farm-debt-distress') || _has('farm bankruptcy') || _has('farm foreclosure') || _has('farm insolvency')) {
      if (_AGRICULTURE_STRUCTURAL.farmDebtFloor > floor) {
        floor = _AGRICULTURE_STRUCTURAL.farmDebtFloor;
        reason = 'structural: farm_debt_distress' + (farmDebtRatio !== null ? ' (farm debt-to-income ' + farmDebtRatio.toFixed(2) + ' > 1.5)' : '');
      } else if (floor > 0) {
        reason += ' + farm_debt_distress';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect environment CLIMATE/POLLUTION/ECOSYSTEM/WATER/REGULATORY structural constraints from a
  // feed object. Returns a forced stress floor (0 if none) — ecosystem/climate breaches bypass
  // emissions-index/headline-volume dampening. Mirrors _infraStructuralFloor / _industryStructuralFloor:
  // emissions-spike / pollution-event / biodiversity-loss / water-stress / regulatory-breach are
  // load-bearing ecosystem/climate constraints, not commodity-signal noise to be averaged down.
  // Binds to CO2/AQI/water-stress/extinction/carbon-cap metrics and environmental tickers
  // (WM, RSG, WCN, CWST, AWK, WTRG, XYL, ECL, LIN, APD, DAR, AY) — NEVER oil/gas/grid/power-generation
  // as the domain's OWN content (environment couples to energy via emissions/carbon, but its identity
  // stays climate/pollution/ecosystems), and DISTINCT from agriculture (land/water use is a coupling).
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _environmentStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (2) Acute pollution event: AQI / spill with health/ecosystem impact ALWAYS triggers pollution_event
    //     (highest environment floor — an acute air/water/soil contamination with downstream health and
    //     ecosystem damage; WM/RSG/WCN/CWST/ECL remediation exposure, EPA AQI). aqi > 200 (very
    //     unhealthy/hazardous), or an explicit spill/contamination/pollution signal, trips it.
    var aqi = (feed.airQualityIndex !== undefined) ? feed.airQualityIndex
            : (feed.aqi !== undefined) ? feed.aqi
            : null;
    if ((aqi !== null && aqi > 200 && (_has('air') || _has('aqi') || _has('pollut') || _has('smog') || _has('hazard'))) ||
        _has('pollution event') || _has('pollution-event') || _has('chemical spill') || _has('oil spill') || _has('contamination') || _has('toxic release') || _has('hazardous')) {
      if (_ENVIRONMENT_STRUCTURAL.pollutionEventFloor > floor) {
        floor = _ENVIRONMENT_STRUCTURAL.pollutionEventFloor;
        reason = 'structural: pollution_event' + (aqi !== null ? ' (AQI ' + Math.round(aqi) + ' > 200, hazardous)' : '');
      }
    }
    // (5) Regulatory breach: carbon cap exceeded / compliance failure ALWAYS triggers regulatory_breach
    //     (an environmental-compliance constraint — carbon-market cap-and-trade overage, permit
    //     violation, or enforcement action; LIN/APD/ECL/WM/RSG compliance exposure, carbon markets).
    //     capComplianceRatio above 1.0 (emissions exceed the allocated cap), or an explicit
    //     cap-breach/compliance-failure/enforcement signal, trips it.
    var capRatio = (feed.carbonCapComplianceRatio !== undefined) ? feed.carbonCapComplianceRatio
                 : (feed.emissionsCapRatio !== undefined) ? feed.emissionsCapRatio
                 : null;
    if ((capRatio !== null && capRatio > 1.0 && (_has('carbon') || _has('cap') || _has('compliance') || _has('permit') || _has('emission'))) ||
        _has('regulatory breach') || _has('regulatory-breach') || _has('cap exceeded') || _has('compliance failure') || _has('permit violation') || _has('enforcement action') || _has('non-compliance')) {
      if (_ENVIRONMENT_STRUCTURAL.regulatoryBreachFloor > floor) {
        floor = _ENVIRONMENT_STRUCTURAL.regulatoryBreachFloor;
        reason = 'structural: regulatory_breach' + (capRatio !== null ? ' (emissions ' + (capRatio * 100).toFixed(0) + '% of carbon cap > 100%)' : '');
      } else if (floor > 0) {
        reason += ' + regulatory_breach';
      }
    }
    // (1) Emissions spike: CO2e YoY spike > 50% ALWAYS triggers emissions_spike
    //     (a structural climate signal, not noise — the load-bearing climate ceiling, mirrors energy's
    //     grid reserve margin < 10%; DAR/LIN/APD carbon-intensity exposure, atmospheric CO2 proxy).
    //     co2eYoY accepts fraction (0.55) or percent (55) form; an explicit emissions-spike signal trips it.
    var co2eYoY = (feed.co2eYoY !== undefined) ? feed.co2eYoY
                : (feed.emissionsYoY !== undefined) ? feed.emissionsYoY
                : null;
    var co2eFrac = (co2eYoY !== null && (co2eYoY > 1 || co2eYoY < -1)) ? co2eYoY / 100 : co2eYoY;
    if ((co2eFrac !== null && co2eFrac > 0.50 && (_has('emission') || _has('co2') || _has('carbon') || _has('greenhouse') || _has('ghg'))) ||
        _has('emissions spike') || _has('emissions-spike') || _has('emissions surge') || _has('carbon spike')) {
      if (_ENVIRONMENT_STRUCTURAL.emissionsSpikeFloor > floor) {
        floor = _ENVIRONMENT_STRUCTURAL.emissionsSpikeFloor;
        reason = 'structural: emissions_spike' + (co2eFrac !== null ? ' (CO2e ' + (co2eFrac * 100).toFixed(0) + '% YoY > 50%)' : '');
      } else if (floor > 0) {
        reason += ' + emissions_spike';
      }
    }
    // (3) Biodiversity loss: extinction rate / habitat loss > threshold ALWAYS triggers biodiversity_loss
    //     (an ecosystem-collapse constraint — accelerated species extinction or habitat conversion;
    //     conservation/natural-resources exposure). habitatLossYoY > 5% (fraction 0.05), or an explicit
    //     extinction/habitat/deforestation/biodiversity signal, trips it.
    var habitatLoss = (feed.habitatLossYoY !== undefined) ? feed.habitatLossYoY
                    : (feed.extinctionRate !== undefined) ? feed.extinctionRate
                    : null;
    var habitatFrac = (habitatLoss !== null && (habitatLoss > 1 || habitatLoss < -1)) ? habitatLoss / 100 : habitatLoss;
    var habitatMag = (habitatFrac !== null) ? Math.abs(habitatFrac) : null;
    if ((habitatMag !== null && habitatMag > 0.05 && (_has('biodivers') || _has('extinct') || _has('habitat') || _has('species') || _has('ecosystem') || _has('deforest'))) ||
        _has('biodiversity loss') || _has('biodiversity-loss') || _has('mass extinction') || _has('habitat loss') || _has('ecosystem collapse') || _has('deforestation')) {
      if (_ENVIRONMENT_STRUCTURAL.biodiversityLossFloor > floor) {
        floor = _ENVIRONMENT_STRUCTURAL.biodiversityLossFloor;
        reason = 'structural: biodiversity_loss' + (habitatMag !== null ? ' (habitat/extinction ' + (habitatMag * 100).toFixed(1) + '% > 5%)' : '');
      } else if (floor > 0) {
        reason += ' + biodiversity_loss';
      }
    }
    // (4) Water stress: scarcity index / water-quality failure ALWAYS triggers water_stress
    //     (a natural-resource constraint — water scarcity or a potable-water-quality failure; AWK/WTRG/
    //     XYL water-utility/treatment exposure, water-stress indices). waterStressIndex > 0.80 (high
    //     baseline water stress, withdrawals near supply), or an explicit scarcity/water-quality/drought
    //     signal, trips it.
    var waterStress = (feed.waterStressIndex !== undefined) ? feed.waterStressIndex
                    : (feed.waterScarcityIndex !== undefined) ? feed.waterScarcityIndex
                    : null;
    var waterFrac = (waterStress !== null && waterStress > 1) ? waterStress / 100 : waterStress;
    if ((waterFrac !== null && waterFrac > 0.80 && (_has('water') || _has('scarcit') || _has('drought') || _has('aquifer') || _has('reservoir'))) ||
        _has('water stress') || _has('water-stress') || _has('water scarcity') || _has('water quality') || _has('drought') || _has('water shortage') || _has('contaminated water')) {
      if (_ENVIRONMENT_STRUCTURAL.waterStressFloor > floor) {
        floor = _ENVIRONMENT_STRUCTURAL.waterStressFloor;
        reason = 'structural: water_stress' + (waterFrac !== null ? ' (water-stress index ' + (waterFrac * 100).toFixed(0) + '% > 80%)' : '');
      } else if (floor > 0) {
        reason += ' + water_stress';
      }
    }
    return { floor: floor, reason: reason };
  }

  // Detect population DEMOGRAPHIC/MIGRATION/AGING/LABOR-SUPPLY/URBANIZATION structural constraints
  // from a feed object. Returns a forced stress floor (0 if none) — real demographic constraints
  // bypass the Census/ACS/BLS reporting-lag + seasonal birth/fertility/migration-count dampening
  // (0.50). Mirrors _economyStructuralFloor / _industryStructuralFloor / _environmentStructuralFloor:
  // demographic-collapse / migration-surge / aging-crisis / labor-shortage / urbanization-strain /
  // depopulation are load-bearing demographic constraints, not commodity-signal noise to be averaged
  // down. Binds to US Census 5-year ACS, UN World Population Prospects, Pew Research, BLS prime-age
  // employment / labor-force participation, HUD housing affordability, and IOM migration — and where
  // demographic-exposed entities are needed, real proxies (WELL, VTR senior-living REITs;
  // housing/migration-exposed names). NEVER oil/gas/grid as the domain's OWN content. DISTINCT from
  // economy (labor MARKET is a coupling — population owns labor SUPPLY), medicine (mortality/health is
  // a coupling), education (enrollment is a coupling), and governance.
  // ADDITIVE ONLY — client-side advisory floor; does NOT touch the validated P3 distress kernel.
  function _populationStructuralFloor(feed) {
    if (!feed) return { floor: 0, reason: '' };
    var floor = 0;
    var reason = '';
    var signals = feed.signals || [];
    function _has(token) {
      for (var i = 0; i < signals.length; i++) {
        if (typeof signals[i] === 'string' && signals[i].toLowerCase().indexOf(token) !== -1) return true;
      }
      return false;
    }
    // (3) Aging crisis: median age > 42 / old-age dependency ratio > 30% / working-age decline > 2% YoY
    //     ALWAYS triggers aging_crisis (highest population floor — a generational-structure break;
    //     UN WPP median age, BLS/Census age structure, WELL/VTR senior-living exposure).
    var medianAge = (feed.medianAge !== undefined) ? feed.medianAge : null;
    var oldAgeDependency = (feed.oldAgeDependencyRatio !== undefined) ? feed.oldAgeDependencyRatio
                         : (feed.dependencyRatio !== undefined) ? feed.dependencyRatio
                         : null;
    // accept fraction (0.32) or percent (32) form for the dependency ratio
    var depFrac = (oldAgeDependency !== null && oldAgeDependency > 1) ? oldAgeDependency / 100 : oldAgeDependency;
    var workingAgeDecline = (feed.workingAgePopGrowthYoY !== undefined) ? feed.workingAgePopGrowthYoY
                          : (feed.workingAgeDeclineYoY !== undefined) ? feed.workingAgeDeclineYoY
                          : null;
    var workFrac = (workingAgeDecline !== null && (workingAgeDecline > 1 || workingAgeDecline < -1)) ? workingAgeDecline / 100 : workingAgeDecline;
    if ((medianAge !== null && medianAge > 42 && (_has('aging') || _has('age') || _has('elderly') || _has('senior') || _has('dependency'))) ||
        (depFrac !== null && depFrac > 0.30 && (_has('dependency') || _has('aging') || _has('elderly') || _has('old-age'))) ||
        (workFrac !== null && workFrac < -0.02 && (_has('working-age') || _has('labor') || _has('workforce'))) ||
        _has('aging crisis') || _has('aging-crisis') || _has('aging society') || _has('greying') || _has('demographic aging')) {
      if (_POPULATION_STRUCTURAL.agingCrisisFloor > floor) {
        floor = _POPULATION_STRUCTURAL.agingCrisisFloor;
        reason = 'structural: aging_crisis' + (medianAge !== null ? ' (median age ' + medianAge.toFixed(1) + ' > 42)' : (depFrac !== null ? ' (old-age dependency ' + (depFrac * 100).toFixed(0) + '% > 30%)' : ''));
      }
    }
    // (1) Demographic collapse: total fertility rate < 1.5 / below-replacement birth rate ALWAYS
    //     triggers demographic_collapse (a generational-shortage signal — TFR below the 2.1 replacement
    //     level and into structural-decline territory; UN WPP / Census fertility, Pew Research).
    var fertilityRate = (feed.totalFertilityRate !== undefined) ? feed.totalFertilityRate
                      : (feed.fertilityRate !== undefined) ? feed.fertilityRate
                      : (feed.tfr !== undefined) ? feed.tfr
                      : null;
    var birthRateGrowth = (feed.birthRateYoY !== undefined) ? feed.birthRateYoY : null;
    var birthFrac = (birthRateGrowth !== null && (birthRateGrowth > 1 || birthRateGrowth < -1)) ? birthRateGrowth / 100 : birthRateGrowth;
    if ((fertilityRate !== null && fertilityRate < 1.5 && (_has('fertility') || _has('birth') || _has('tfr') || _has('replacement') || _has('natal'))) ||
        (birthFrac !== null && birthFrac < -0.05 && (_has('birth') || _has('fertility') || _has('natal'))) ||
        _has('below replacement') || _has('below-replacement') || _has('demographic collapse') || _has('demographic-collapse') || _has('baby bust') || _has('fertility crisis') || _has('birth dearth')) {
      if (_POPULATION_STRUCTURAL.demographicCollapseFloor > floor) {
        floor = _POPULATION_STRUCTURAL.demographicCollapseFloor;
        reason = 'structural: demographic_collapse' + (fertilityRate !== null ? ' (TFR ' + fertilityRate.toFixed(2) + ' < 1.5, below replacement)' : '');
      } else if (floor > 0) {
        reason += ' + demographic_collapse';
      }
    }
    // (4) Labor shortage: prime-age LFPR < 75% / prime-age employment < 80% / unemployment-to-labor-force
    //     gap > 4% ALWAYS triggers labor_shortage (a human-capital SUPPLY constraint — population owns the
    //     labor SUPPLY pool; the labor MARKET stays with economy). BLS prime-age (25-54) LFPR / EPOP.
    var primeLfpr = (feed.primeAgeLFPR !== undefined) ? feed.primeAgeLFPR
                  : (feed.laborForceParticipation !== undefined) ? feed.laborForceParticipation
                  : null;
    var lfprFrac = (primeLfpr !== null && primeLfpr > 1) ? primeLfpr / 100 : primeLfpr;
    var primeEpop = (feed.primeAgeEmploymentRate !== undefined) ? feed.primeAgeEmploymentRate
                  : (feed.primeAgeEPOP !== undefined) ? feed.primeAgeEPOP
                  : null;
    var epopFrac = (primeEpop !== null && primeEpop > 1) ? primeEpop / 100 : primeEpop;
    if ((lfprFrac !== null && lfprFrac < 0.75 && (_has('participation') || _has('labor') || _has('workforce') || _has('lfpr'))) ||
        (epopFrac !== null && epopFrac < 0.80 && (_has('employment') || _has('labor') || _has('workforce') || _has('epop'))) ||
        _has('labor shortage') || _has('labor-shortage') || _has('worker shortage') || _has('labor-force collapse') || _has('workforce shortage')) {
      if (_POPULATION_STRUCTURAL.laborShortageFloor > floor) {
        floor = _POPULATION_STRUCTURAL.laborShortageFloor;
        reason = 'structural: labor_shortage' + (lfprFrac !== null ? ' (prime-age LFPR ' + (lfprFrac * 100).toFixed(0) + '% < 75%)' : (epopFrac !== null ? ' (prime-age EPOP ' + (epopFrac * 100).toFixed(0) + '% < 80%)' : ''));
      } else if (floor > 0) {
        reason += ' + labor_shortage';
      }
    }
    // (6) Depopulation: regional population loss > 2% YoY / sustained rural out-migration ALWAYS triggers
    //     depopulation (a regional-decline constraint — sustained population loss / rural hollowing-out;
    //     Census regional/county estimates, IOM internal migration).
    var popGrowth = (feed.populationGrowthYoY !== undefined) ? feed.populationGrowthYoY
                  : (feed.regionalPopGrowthYoY !== undefined) ? feed.regionalPopGrowthYoY
                  : null;
    var popFrac = (popGrowth !== null && (popGrowth > 1 || popGrowth < -1)) ? popGrowth / 100 : popGrowth;
    if ((popFrac !== null && popFrac < -0.02 && (_has('population') || _has('depopul') || _has('out-migration') || _has('rural') || _has('decline'))) ||
        _has('depopulation') || _has('population loss') || _has('rural out-migration') || _has('rural exodus') || _has('hollowing out') || _has('population decline')) {
      if (_POPULATION_STRUCTURAL.depopulationFloor > floor) {
        floor = _POPULATION_STRUCTURAL.depopulationFloor;
        reason = 'structural: depopulation' + (popFrac !== null ? ' (regional population ' + (popFrac * 100).toFixed(1) + '% YoY < -2%)' : '');
      } else if (floor > 0) {
        reason += ' + depopulation';
      }
    }
    // (2) Migration surge: net migration inflow acceleration > 50% YoY / displaced-person surge ALWAYS
    //     triggers migration_surge (a migration-flow constraint — sudden inflow acceleration or a
    //     displaced/refugee surge; IOM migration, UN WPP net-migration, Census net international migration).
    var migrationAccel = (feed.netMigrationAccelYoY !== undefined) ? feed.netMigrationAccelYoY
                       : (feed.migrationInflowYoY !== undefined) ? feed.migrationInflowYoY
                       : null;
    var migFrac = (migrationAccel !== null && (migrationAccel > 1 || migrationAccel < -1)) ? migrationAccel / 100 : migrationAccel;
    if ((migFrac !== null && migFrac > 0.50 && (_has('migration') || _has('migrant') || _has('immigration') || _has('inflow') || _has('displaced') || _has('refugee'))) ||
        _has('migration surge') || _has('migration-surge') || _has('displaced surge') || _has('refugee surge') || _has('mass migration') || _has('migration wave')) {
      if (_POPULATION_STRUCTURAL.migrationSurgeFloor > floor) {
        floor = _POPULATION_STRUCTURAL.migrationSurgeFloor;
        reason = 'structural: migration_surge' + (migFrac !== null ? ' (net migration inflow ' + (migFrac * 100).toFixed(0) + '% YoY > 50%)' : '');
      } else if (floor > 0) {
        reason += ' + migration_surge';
      }
    }
    // (5) Urbanization strain: slum-population growth > 5% annual / housing-unaffordability index > 40% /
    //     megacity infrastructure-stress ALWAYS triggers urbanization_strain (a settlement-saturation
    //     constraint — population owns settlement/household-formation demand; UN WPP urbanization, HUD
    //     housing affordability, housing/migration-exposed names).
    var slumGrowth = (feed.slumPopGrowthYoY !== undefined) ? feed.slumPopGrowthYoY
                   : (feed.informalSettlementGrowthYoY !== undefined) ? feed.informalSettlementGrowthYoY
                   : null;
    var slumFrac = (slumGrowth !== null && (slumGrowth > 1 || slumGrowth < -1)) ? slumGrowth / 100 : slumGrowth;
    var housingUnaffordability = (feed.housingUnaffordabilityIndex !== undefined) ? feed.housingUnaffordabilityIndex
                               : (feed.housingCostBurdenRate !== undefined) ? feed.housingCostBurdenRate
                               : null;
    var housingFrac = (housingUnaffordability !== null && housingUnaffordability > 1) ? housingUnaffordability / 100 : housingUnaffordability;
    if ((slumFrac !== null && slumFrac > 0.05 && (_has('slum') || _has('informal') || _has('settlement') || _has('urban'))) ||
        (housingFrac !== null && housingFrac > 0.40 && (_has('housing') || _has('afford') || _has('rent') || _has('cost-burden') || _has('urban'))) ||
        _has('urbanization strain') || _has('urbanization-strain') || _has('megacity') || _has('housing crisis') || _has('housing unaffordability') || _has('urban overcrowding') || _has('slum growth')) {
      if (_POPULATION_STRUCTURAL.urbanizationStrainFloor > floor) {
        floor = _POPULATION_STRUCTURAL.urbanizationStrainFloor;
        reason = 'structural: urbanization_strain' + (housingFrac !== null ? ' (housing-unaffordability ' + (housingFrac * 100).toFixed(0) + '% > 40%)' : (slumFrac !== null ? ' (slum growth ' + (slumFrac * 100).toFixed(0) + '% > 5%/yr)' : ''));
      } else if (floor > 0) {
        reason += ' + urbanization_strain';
      }
    }
    return { floor: floor, reason: reason };
  }

  function _normalizeStress(domainKey, rawStress, feed) {
    // Phase 0: domain structural-signal floor (engineering/attention-economy constraints
    // bypass commodity/market/volume dampening — mirrors energy-brain grid_stress conditions)
    var structural = (domainKey === 'infrastructure') ? _infraStructuralFloor(feed)
                   : (domainKey === 'culture') ? _cultureStructuralFloor(feed)
                   : (domainKey === 'finance') ? _financeStructuralFloor(feed)
                   : (domainKey === 'economy') ? _economyStructuralFloor(feed)
                   : (domainKey === 'technology') ? _technologyStructuralFloor(feed)
                   : (domainKey === 'defense') ? _defenseStructuralFloor(feed)
                   : (domainKey === 'intelligence') ? _intelligenceStructuralFloor(feed)
                   : (domainKey === 'supplyChain') ? _tradeStructuralFloor(feed)
                   : (domainKey === 'industry') ? _industryStructuralFloor(feed)
                   : (domainKey === 'agriculture') ? _agricultureStructuralFloor(feed)
                   : (domainKey === 'environment') ? _environmentStructuralFloor(feed)
                   : (domainKey === 'population') ? _populationStructuralFloor(feed)
                   : { floor: 0, reason: '' };
    if (structural.floor > rawStress) {
      rawStress = structural.floor;
    }

    // Phase 1: domain-specific saturation dampening
    var dampen = _DOMAIN_DAMPEN[domainKey];
    var stress = rawStress;
    var reason = structural.floor > 0 ? structural.reason : 'passthrough';

    if (dampen) {
      // Structural floor (if any) bypasses the saturation factor — it is not a
      // volume/CVE-churn signal, so dampening it would erase the engineering constraint.
      if (structural.floor > 0) {
        stress = Math.max(rawStress, structural.floor);
        reason = structural.reason + ' (dampening bypassed)';
      } else {
        stress = rawStress * dampen.factor;
        reason = dampen.reason;
      }
    }

    // Phase 2: deviation from session baseline (when enough samples exist)
    if (!_baselineState[domainKey]) _baselineState[domainKey] = { samples: [], mean: 0 };
    var bs = _baselineState[domainKey];
    bs.samples.push(rawStress);
    if (bs.samples.length > _BASELINE_WINDOW) bs.samples.shift();

    if (bs.samples.length >= 4) {
      // Compute rolling mean
      var sum = 0;
      for (var bi = 0; bi < bs.samples.length; bi++) sum += bs.samples[bi];
      bs.mean = sum / bs.samples.length;

      // Deviation: how far above the session mean?
      var deviation = rawStress - bs.mean;
      if (deviation > 0.05) {
        // Positive deviation boosts stress proportionally
        var deviationBoost = deviation * 0.3;
        stress = stress + deviationBoost;
        reason += ' + deviation-boost(' + deviation.toFixed(2) + ')';
      }
    }

    // Phase 3: persistence — sustained elevation amplifies
    if (!_persistenceCount[domainKey]) _persistenceCount[domainKey] = 0;
    if (rawStress > 0.50) {
      _persistenceCount[domainKey]++;
    } else {
      _persistenceCount[domainKey] = Math.max(0, _persistenceCount[domainKey] - 1);
    }
    var persistence = _persistenceCount[domainKey];
    if (persistence >= 3) {
      // Sustained elevation: small uplift (max +0.10 at 6+ cycles)
      var persistBoost = Math.min((persistence - 2) * 0.025, 0.10);
      stress = stress + persistBoost;
      reason += ' + persistence(' + persistence + ')';
    }

    // Phase 4: apply ceiling (domain-specific or default 0.95)
    var ceiling = dampen ? dampen.ceiling : 0.95;
    if (stress > ceiling) stress = ceiling;

    // Final clamp
    stress = Math.max(0, Math.min(0.95, Math.round(stress * 1000) / 1000));

    return { stress: stress, rawStress: rawStress, normalizationReason: reason };
  }

  // ─── State ───────────────────────────────────────────────────────────────

  var domains = {};
  var prevStress = {};
  var stressHistory = {};
  var HISTORY_MAX = 10;
  var _feedInterval = null;
  var _uiInterval = null;
  var _prevDistressed = {};
  var _expandedDomain = null;
  var _lastFeedData = null;
  var _feedAlive = false;
  var _sourceAudit = {};

  function _initDomains() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      domains[k] = { stress: 0, trend: 0, signals: [], updated: null, sources: [], confidence: 0 };
      prevStress[k] = 0;
      stressHistory[k] = [];
      _prevDistressed[k] = false;
    }
  }
  _initDomains();

  // ─── Feed polling ──────────────────────────────────────────────────────

  function _fetchDomainSnapshot() {
    return fetch('/api/domain-snapshot')
      .then(function (resp) {
        if (!resp.ok) return null;
        return resp.json();
      })
      .catch(function () { return null; });
  }

  // ─── Stale cache for GDELT-backed domains ──────────────────────────────
  // When GDELT rate-limits, server returns FALLBACK. We preserve last-known-good.
  var _GDELT_DOMAINS = {governance:1, communication:1, culture:1, defense:1, religion:1, intelligence:1};
  var _staleCache = {}; // domainKey → { stress, signals, sources, confidence, cachedAt }
  var _STALE_TTL = 600000; // 10 minutes

  function _applyFeedData(data) {
    if (!data || !data.domains) return;
    _lastFeedData = data;
    _feedAlive = true;

    // Bridge into canonical feed store
    if (window.LIMENFeedState && typeof window.LIMENFeedState.ingest === 'function') {
      window.LIMENFeedState.ingest(data);
    }
    var now = Date.now();

    // Expose server-side source health if available
    if (data.sourceHealth) {
      window.LIMENSourceHealth = data.sourceHealth;
    }

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var feed = data.domains[k];
      if (!feed) continue;

      var rawStress = feed.stress || 0;
      var norm = _normalizeStress(k, rawStress, feed);
      var stress = norm.stress;
      var trend = _computeTrend(k, stress);
      var signals = feed.signals || [];
      var sources = feed.sources || [];
      var confidence = feed.confidence || 0;
      var activity = feed.activity || 0;
      var maturity = feed.maturity || '';
      var status = feed.status || null;
      var liveCount = feed.liveCount || 0;

      // Stale cache logic for GDELT-backed domains
      if (_GDELT_DOMAINS[k]) {
        var isFallback = status === 'FALLBACK' || liveCount === 0;
        var cached = _staleCache[k];

        if (!isFallback && liveCount > 0) {
          // Good data — update cache
          _staleCache[k] = { stress: stress, rawStress: rawStress, signals: signals, sources: sources, confidence: confidence, cachedAt: now };
        } else if (isFallback && cached && (now - cached.cachedAt) < _STALE_TTL) {
          // FALLBACK but we have cached real data — use it as STALE
          stress = cached.stress;
          rawStress = cached.rawStress;
          norm = _normalizeStress(k, rawStress, feed);
          stress = norm.stress;
          signals = cached.signals;
          sources = cached.sources;
          confidence = Math.min(cached.confidence * 0.7, 0.5); // reduce confidence
          status = 'STALE';
          liveCount = 0;
        }
      }

      var delta = Math.abs(stress - prevStress[k]);

      domains[k] = {
        stress: stress,
        rawStress: norm.rawStress,
        normalizationReason: norm.normalizationReason,
        trend: trend,
        signals: signals,
        updated: now,
        sources: sources,
        confidence: confidence,
        activity: activity,
        maturity: maturity,
        cadence: feed.cadence || 'unknown',
        status: status,
        liveCount: liveCount
      };

      // Distress event on threshold crossing (rising edge, material change only)
      if (stress > DISTRESS_THRESHOLD && !_prevDistressed[k] && delta >= MATERIAL_CHANGE) {
        _dispatch('limen:domain-distress', {
          domain: k,
          stress: stress,
          rawStress: norm.rawStress,
          trend: trend,
          signals: signals,
          sources: sources
        });
      }
      _prevDistressed[k] = stress > DISTRESS_THRESHOLD;
      prevStress[k] = stress;
    }

    _rebuildAudit();
    window.LIMENDomains = domains;
    _dispatch('limen:domain-update', { domains: domains, timestamp: now, feedAlive: true });
  }

  // ─── Fallback stress computation (no feed) ──────────────────────────────

  var WORLD_DOMAIN_MAP = {
    economy:     ['economy', 'finance'],
    energy:      ['energy'],
    environment: ['climate'],
    health:      ['health'],
    technology:  ['technology'],
    research:    ['technology', 'health'],
    supplyChain: ['economy', 'energy'],
    governance:     ['economy'],
    infrastructure: ['energy', 'economy'],
    agriculture:    ['climate', 'economy'],
    industry:       ['economy', 'energy'],
    education:      ['technology'],
    communication:  ['technology'],
    culture:        ['economy'],
    defense:        ['economy', 'energy'],
    religion:       ['economy'],
    population:     ['health', 'economy'],
    law:            ['economy'],
    finance:        ['economy'],
    intelligence:   ['technology', 'economy']
  };

  function _computeStressFallback(domainKey) {
    var world = window.LIMENWorld || {};
    var worldDomains = world.domains || {};
    var phase = window.LIMENPhase || {};
    var observer = window.LIMENObserver || {};

    var mappedKeys = WORLD_DOMAIN_MAP[domainKey] || [];
    var sum = 0;
    var count = 0;
    for (var i = 0; i < mappedKeys.length; i++) {
      var wd = worldDomains[mappedKeys[i]];
      if (wd && wd.score !== undefined) {
        sum += wd.score;
        count++;
      }
    }
    var baseScore = count > 0 ? sum / count : 0;

    var entropy = observer.entropy || 0;
    var entropyBoost = entropy * 0.15;

    var phaseModifier = 0;
    if (phase.estimated === 'P3' || phase.estimated === 'P7') {
      phaseModifier = 0.10;
    } else if (phase.estimated === 'P4' || phase.estimated === 'P6') {
      phaseModifier = -0.08;
    } else if (phase.estimated === 'P1') {
      phaseModifier = 0.05;
    }

    var noise = (Math.sin(Date.now() * 0.0001 + domainKey.length * 7) + 1) * 0.02;
    var stress = baseScore + entropyBoost + phaseModifier + noise;
    return Math.max(0, Math.min(1, Math.round(stress * 1000) / 1000));
  }

  function _fallbackUpdate() {
    var now = Date.now();
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var rawStress = _computeStressFallback(k);
      var norm = _normalizeStress(k, rawStress);
      var stress = norm.stress;
      var trend = _computeTrend(k, stress);
      var signals = _getSignalsFallback(k, stress);

      domains[k] = {
        stress: stress,
        rawStress: norm.rawStress,
        normalizationReason: norm.normalizationReason,
        trend: trend,
        signals: signals,
        updated: now,
        sources: [
          { name: 'heuristic', value: null, label: 'internal model', updated: now, live: false }
        ],
        confidence: 0.1,
        cadence: 'fallback'
      };

      if (stress > DISTRESS_THRESHOLD && !_prevDistressed[k]) {
        _dispatch('limen:domain-distress', { domain: k, stress: stress, rawStress: norm.rawStress, trend: trend, signals: signals });
      }
      _prevDistressed[k] = stress > DISTRESS_THRESHOLD;
      prevStress[k] = stress;
    }

    _rebuildAudit();
    window.LIMENDomains = domains;
    _dispatch('limen:domain-update', { domains: domains, timestamp: now, feedAlive: false });
  }

  var SIGNAL_TEMPLATES = {
    economy: [
      { threshold: 0.3, text: 'market volatility detected' },
      { threshold: 0.5, text: 'economic indicator divergence' },
      { threshold: 0.7, text: 'financial stress clustering' },
      { threshold: 0.85, text: 'systemic risk signals elevated' }
    ],
    energy: [
      { threshold: 0.3, text: 'energy price fluctuation' },
      { threshold: 0.5, text: 'supply tightening signals' },
      { threshold: 0.7, text: 'oil volatility spike' },
      { threshold: 0.85, text: 'energy infrastructure strain' }
    ],
    environment: [
      { threshold: 0.3, text: 'environmental monitoring active' },
      { threshold: 0.5, text: 'temperature anomaly detected' },
      { threshold: 0.7, text: 'forest loss alerts' },
      { threshold: 0.85, text: 'ecological tipping indicators' }
    ],
    health: [
      { threshold: 0.3, text: 'health research activity' },
      { threshold: 0.5, text: 'treatment efficacy variance' },
      { threshold: 0.7, text: 'clinical outcome anomalies' },
      { threshold: 0.85, text: 'public health stress indicators' }
    ],
    technology: [
      { threshold: 0.3, text: 'innovation cycle monitoring' },
      { threshold: 0.5, text: 'disruption pattern emerging' },
      { threshold: 0.7, text: 'technology adoption stress' },
      { threshold: 0.85, text: 'infrastructure vulnerability signals' }
    ],
    research: [
      { threshold: 0.3, text: 'research output tracking' },
      { threshold: 0.5, text: 'publication rate shift' },
      { threshold: 0.7, text: 'reproducibility concern signals' },
      { threshold: 0.85, text: 'research integrity anomalies' }
    ],
    supplyChain: [
      { threshold: 0.3, text: 'logistics monitoring active' },
      { threshold: 0.5, text: 'supply delay indicators' },
      { threshold: 0.7, text: 'supply chain disruption detected' },
      { threshold: 0.85, text: 'critical shortages emerging' }
    ],
    governance: [
      { threshold: 0.3, text: 'policy activity detected' },
      { threshold: 0.5, text: 'governance stress indicators rising' },
      { threshold: 0.7, text: 'institutional pressure detected' },
      { threshold: 0.85, text: 'governance stability alerts' }
    ],
    infrastructure: [
      { threshold: 0.3, text: 'infrastructure monitoring active' },
      { threshold: 0.5, text: 'infrastructure strain signals' },
      { threshold: 0.7, text: 'infrastructure degradation detected' },
      { threshold: 0.85, text: 'critical infrastructure failure risk' }
    ],
    agriculture: [
      { threshold: 0.3, text: 'agricultural output tracking' },
      { threshold: 0.5, text: 'crop yield variance detected' },
      { threshold: 0.7, text: 'food supply pressure signals' },
      { threshold: 0.85, text: 'agricultural crisis indicators' }
    ],
    industry: [
      { threshold: 0.3, text: 'industrial production monitoring' },
      { threshold: 0.5, text: 'manufacturing output shift' },
      { threshold: 0.7, text: 'industrial contraction signals' },
      { threshold: 0.85, text: 'systemic industrial stress' }
    ],
    education: [
      { threshold: 0.3, text: 'education metrics tracking' },
      { threshold: 0.5, text: 'enrollment pattern shifts' },
      { threshold: 0.7, text: 'education access disruption' },
      { threshold: 0.85, text: 'systemic education failure signals' }
    ],
    communication: [
      { threshold: 0.3, text: 'information flow monitoring' },
      { threshold: 0.5, text: 'media narrative divergence' },
      { threshold: 0.7, text: 'communication infrastructure strain' },
      { threshold: 0.85, text: 'information integrity crisis' }
    ],
    culture: [
      { threshold: 0.3, text: 'cultural sentiment tracking' },
      { threshold: 0.5, text: 'social cohesion variance' },
      { threshold: 0.7, text: 'cultural fragmentation signals' },
      { threshold: 0.85, text: 'identity crisis indicators' }
    ],
    defense: [
      { threshold: 0.3, text: 'security posture monitoring' },
      { threshold: 0.5, text: 'threat assessment elevated' },
      { threshold: 0.7, text: 'defense readiness pressure' },
      { threshold: 0.85, text: 'strategic security alerts active' }
    ],
    religion: [
      { threshold: 0.3, text: 'institutional sentiment tracking' },
      { threshold: 0.5, text: 'moral framework tension' },
      { threshold: 0.7, text: 'interfaith stress indicators' },
      { threshold: 0.85, text: 'symbolic systems destabilization' }
    ],
    population: [
      { threshold: 0.3, text: 'demographic monitoring active' },
      { threshold: 0.5, text: 'migration pattern shift detected' },
      { threshold: 0.7, text: 'population pressure signals' },
      { threshold: 0.85, text: 'demographic transition stress' }
    ],
    law: [
      { threshold: 0.3, text: 'regulatory activity tracking' },
      { threshold: 0.5, text: 'compliance pressure rising' },
      { threshold: 0.7, text: 'legal system strain detected' },
      { threshold: 0.85, text: 'rule of law integrity alerts' }
    ],
    finance: [
      { threshold: 0.3, text: 'financial market monitoring' },
      { threshold: 0.5, text: 'credit stress indicators' },
      { threshold: 0.7, text: 'financial volatility spike' },
      { threshold: 0.85, text: 'systemic financial risk signals' }
    ],
    intelligence: [
      { threshold: 0.3, text: 'data collection monitoring' },
      { threshold: 0.5, text: 'intelligence gap detected' },
      { threshold: 0.7, text: 'information warfare signals' },
      { threshold: 0.85, text: 'strategic awareness degradation' }
    ]
  };

  function _getSignalsFallback(domainKey, stress) {
    var templates = SIGNAL_TEMPLATES[domainKey] || [];
    var signals = [];
    for (var i = 0; i < templates.length; i++) {
      if (stress >= templates[i].threshold) {
        signals.push(templates[i].text);
      }
    }
    return signals;
  }

  // ─── Source audit + status labels ────────────────────────────────────────

  function _rebuildAudit() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      var sources = d.sources || [];
      var liveCount = 0;
      var fallbackCount = 0;
      for (var s = 0; s < sources.length; s++) {
        if (sources[s].live) liveCount++;
        else fallbackCount++;
      }
      _sourceAudit[k] = {
        domain: k,
        sources: sources,
        freshness: _freshness(d.updated),
        liveCount: liveCount,
        fallbackCount: fallbackCount,
        confidence: d.confidence || 0,
        status: _domainStatusLabel(liveCount, fallbackCount, d.status)
      };
    }
    window.LIMENSourceAudit = _sourceAudit;
  }

  function _domainStatusLabel(liveCount, fallbackCount, serverStatus) {
    // Prefer server-reported status if available
    if (serverStatus) return serverStatus;
    if (liveCount >= 2) return 'LIVE';
    if (liveCount === 1) return 'PARTIAL';
    return 'FALLBACK';
  }

  var STRESS_EXPLANATIONS = {
    economy: {
      high: 'unemployment above historical average or employment contraction detected',
      moderate: 'labor market metrics showing mild pressure',
      low: 'economic indicators within expected range'
    },
    energy: {
      high: 'crude prices significantly above baseline, supply cost pressure',
      moderate: 'energy pricing above normal but within volatility band',
      low: 'energy markets stable'
    },
    environment: {
      high: 'severe weather alerts active or temperature anomalies detected',
      moderate: 'environmental monitoring showing mild deviations',
      low: 'environmental conditions nominal'
    },
    health: {
      high: 'unusually large adverse event reporting base or enforcement activity above baseline',
      moderate: 'health surveillance metrics mildly elevated',
      low: 'health indicators within expected range'
    },
    technology: {
      high: 'rapid patent activity or research volume suggesting disruption cycle',
      moderate: 'innovation metrics showing increased activity',
      low: 'technology sector activity nominal'
    },
    research: {
      high: 'publication rate anomaly or research volume spike',
      moderate: 'research output above seasonal average',
      low: 'research activity within expected range'
    },
    supplyChain: {
      high: 'freight cost index elevated or inventory levels below normal',
      moderate: 'logistics indicators showing mild pressure',
      low: 'supply chain metrics stable'
    },
    governance: {
      high: 'institutional or policy stress indicators significantly elevated',
      moderate: 'governance metrics showing mild pressure',
      low: 'governance indicators within expected range'
    },
    infrastructure: {
      high: 'critical infrastructure degradation or failure risk detected',
      moderate: 'infrastructure strain indicators above baseline',
      low: 'infrastructure systems operating normally'
    },
    agriculture: {
      high: 'crop yield anomalies or food supply pressure detected',
      moderate: 'agricultural output showing seasonal variance',
      low: 'agricultural metrics within expected range'
    },
    industry: {
      high: 'manufacturing contraction or industrial output anomaly',
      moderate: 'industrial production metrics mildly elevated',
      low: 'industrial sector operating normally'
    },
    education: {
      high: 'education access disruption or enrollment anomaly',
      moderate: 'education metrics showing mild deviation',
      low: 'education system operating normally'
    },
    communication: {
      high: 'information integrity crisis or media narrative divergence',
      moderate: 'communication metrics showing elevated activity',
      low: 'information flow within expected range'
    },
    culture: {
      high: 'social cohesion fragmentation or identity crisis indicators',
      moderate: 'cultural sentiment showing mild tension',
      low: 'cultural indicators within expected range'
    },
    defense: {
      high: 'strategic security alerts active or threat level elevated',
      moderate: 'defense readiness indicators above baseline',
      low: 'security posture nominal'
    },
    religion: {
      high: 'symbolic systems destabilization or moral framework tension',
      moderate: 'institutional sentiment showing mild stress',
      low: 'religious and symbolic systems stable'
    },
    population: {
      high: 'demographic transition stress or migration pressure detected',
      moderate: 'population metrics showing mild deviation',
      low: 'demographic indicators within expected range'
    },
    law: {
      high: 'rule of law integrity alerts or compliance crisis',
      moderate: 'regulatory pressure above baseline',
      low: 'legal system operating normally'
    },
    finance: {
      high: 'systemic financial risk or credit stress elevated',
      moderate: 'financial markets showing mild volatility',
      low: 'financial indicators within expected range'
    },
    intelligence: {
      high: 'strategic awareness degradation or information warfare signals',
      moderate: 'intelligence metrics showing elevated activity',
      low: 'data collection operating normally'
    }
  };

  function _getStressExplanation(domainKey, stress) {
    var expl = STRESS_EXPLANATIONS[domainKey];
    if (!expl) return '';
    if (stress > 0.65) return expl.high;
    if (stress > 0.30) return expl.moderate;
    return expl.low;
  }

  // ─── Trend computation ──────────────────────────────────────────────────

  function _computeTrend(domainKey, currentStress) {
    var history = stressHistory[domainKey];
    history.push(currentStress);
    if (history.length > HISTORY_MAX) {
      history.shift();
    }

    if (history.length < 3) return 0;

    var mid = Math.floor(history.length / 2);
    var oldSum = 0;
    var newSum = 0;
    for (var i = 0; i < mid; i++) {
      oldSum += history[i];
    }
    for (var j = mid; j < history.length; j++) {
      newSum += history[j];
    }
    var oldAvg = oldSum / mid;
    var newAvg = newSum / (history.length - mid);
    var trend = Math.round((newAvg - oldAvg) * 1000) / 1000;
    return Math.max(-1, Math.min(1, trend));
  }

  // ─── Feed poll cycle ────────────────────────────────────────────────────

  function _pollFeed() {
    _fetchDomainSnapshot().then(function (data) {
      if (data && data.domains) {
        _applyFeedData(data);
      } else {
        _feedAlive = false;
        if (window.LIMENFeedState && typeof window.LIMENFeedState.ingestFail === 'function') {
          window.LIMENFeedState.ingestFail();
        }
        _fallbackUpdate();
      }
      _renderPanel();
    }).catch(function () {
      _feedAlive = false;
      if (window.LIMENFeedState && typeof window.LIMENFeedState.ingestFail === 'function') {
        window.LIMENFeedState.ingestFail();
      }
      _fallbackUpdate();
      _renderPanel();
    });
  }

  // ─── UI panel ────────────────────────────────────────────────────────────

  // Only render domain panel UI on console/analyst pages
  var _isConsolePage = (function() {
    var p = location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    return p === '' || p === 'civilization' || p === 'connectome';
  })();

  var panelEl = null;

  function _ensurePanel() {
    if (!_isConsolePage) return; // no panel on non-console pages
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'limen-domain-panel';
    panelEl.style.cssText = [
      'position:fixed',
      'top:60px',
      'right:12px',
      'background:rgba(8,9,12,0.92)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:10px 14px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.50rem',
      'letter-spacing:1.5px',
      'z-index:9997',
      'border-radius:2px',
      'pointer-events:auto',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.7',
      'min-width:220px',
      'max-height:80vh',
      'overflow-y:auto',
      'display:none',
      'cursor:default'
    ].join(';');
    document.body.appendChild(panelEl);

    panelEl.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== panelEl) {
        if (target.getAttribute && target.getAttribute('data-domain')) {
          var dk = target.getAttribute('data-domain');
          if (_expandedDomain === dk) {
            _expandedDomain = null;
          } else {
            _expandedDomain = dk;
          }
          _renderPanel();
          return;
        }
        target = target.parentNode;
      }
    });
  }

  function _freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function _renderPanel() {
    if (!_isConsolePage) return; // data-only on non-console pages
    _ensurePanel();

    // Phase 2 Patch B — Domain Panel suppressed after Domain Health merge (commit c0d42b6d58a).
    // DOM node preserved via _ensurePanel so panel-state-manager, ui-mode-manager,
    // self-health-monitor, and self-repair-engine references keep resolving. Render
    // output, innerHTML writes, and display:block toggles are short-circuited here.
    if (panelEl) panelEl.style.display = 'none';
    return;

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.4)';
    var red = '#e85454';
    var orange = '#d4a44e';
    var green = 'rgba(90,181,160,0.8)';

    var lines = [];
    var hasVisible = false;

    var feedTag = _feedAlive
      ? '<span style="color:' + green + '"> LIVE</span>'
      : '<span style="color:' + red + '"> SIM</span>';
    lines.push('<div style="color:' + gold + ';font-size:0.55rem;margin-bottom:3px">DOMAIN STATUS' + feedTag + '</div>');

    // Cross-domain pressure alerts (reads window.LIMENCrossDomain from detector)
    var _cdActive = (typeof window !== 'undefined' && window.LIMENCrossDomain && window.LIMENCrossDomain.active) ? window.LIMENCrossDomain.active : [];
    if (_cdActive.length > 0) {
      lines.push('<div style="padding:3px 0 5px;border-bottom:1px solid rgba(201,169,78,0.08);margin-bottom:4px">');
      for (var _cdi = 0; _cdi < Math.min(_cdActive.length, 3); _cdi++) {
        var _cd = _cdActive[_cdi];
        var _cdDoms = (_cd.domains || []).join(' \u00d7 ').toUpperCase();
        var _cdStresses = (_cd.stresses || []).map(function(s) { return s.toFixed(2); }).join(' \u00b7 ');
        var _cdColor = _cd.severity > 0.65 ? red : orange;
        lines.push(
          '<div style="font-size:0.38rem;letter-spacing:0.5px;padding:1px 0;color:' + _cdColor + '">' +
          '\u26A1 ' + _cdDoms + ' \u2014 ' + _cdStresses +
          '<span style="color:rgba(200,195,184,0.35);margin-left:4px">' + (_cd.pattern || '') + '</span>' +
          '</div>'
        );
      }
      lines.push('</div>');
    }

    var displayNames = {
      economy: 'ECONOMY',
      energy: 'ENERGY',
      environment: 'ENVIRON',
      health: 'HEALTH',
      technology: 'TECH',
      research: 'RESEARCH',
      supplyChain: 'SUPPLY',
      governance: 'GOV',
      infrastructure: 'INFRA',
      agriculture: 'AGRI',
      industry: 'INDUST',
      education: 'EDU',
      communication: 'COMM',
      culture: 'CULT',
      defense: 'DEF',
      religion: 'RELIG',
      population: 'POP',
      law: 'LAW',
      finance: 'FIN',
      intelligence: 'INTEL'
    };

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (d.stress < 0.05) continue;
      hasVisible = true;

      var pct = Math.round(d.stress * 100);
      var barLen = Math.round(d.stress * 8);
      var bar = '';
      for (var b = 0; b < barLen; b++) bar += '\u2588';

      var barColor = teal;
      if (d.stress > 0.65) barColor = red;
      else if (d.stress > 0.40) barColor = orange;

      var trendArrow = '';
      if (d.trend > 0.03) trendArrow = ' \u2191';
      else if (d.trend < -0.03) trendArrow = ' \u2193';

      var audit = _sourceAudit[k] || {};
      var statusLabel = audit.status || 'FALLBACK';
      var statusColor = green;
      if (statusLabel === 'PARTIAL') statusColor = orange;
      else if (statusLabel === 'FALLBACK') statusColor = red;

      var name = displayNames[k] || k.toUpperCase();
      while (name.length < 8) name += ' ';

      // Balance state indicator
      var balData = (window.LIMENBalance && window.LIMENBalance[k]) || null;
      var balTag = '';
      if (balData) {
        if (balData.state === 'improving') balTag = '<span style="color:' + green + ';font-size:0.38rem;margin-left:3px">\u2191BAL</span>';
        else if (balData.state === 'destabilizing') balTag = '<span style="color:' + red + ';font-size:0.38rem;margin-left:3px">\u2193BAL</span>';
      }

      var freshText = _freshness(d.updated);
      var confShort = d.confidence >= 0.8 ? 'H' : (d.confidence >= 0.4 ? 'M' : 'L');

      // Map signal-engine domain keys to portal domain IDs
      var _portalDomainMap = {health:'medicine',research:'science',supplyChain:'trade',agriculture:'p2_agri'};
      var portalDomain = _portalDomainMap[k] || k;
      var portalLink = '<a href="/portal?domain=' + encodeURIComponent(portalDomain) + '" ' +
        'onclick="event.stopPropagation()" ' +
        'style="color:rgba(201,169,78,0.5);font-size:0.36rem;letter-spacing:1px;text-decoration:none;margin-left:4px" ' +
        'onmouseover="this.style.color=\'rgba(201,169,78,0.9)\'" onmouseout="this.style.color=\'rgba(201,169,78,0.5)\'"' +
        '>\u25B8</a>';

      lines.push(
        '<div data-domain="' + k + '" style="cursor:pointer;padding:1px 0">' +
        '<span style="color:' + dim + '">' + name + '</span>' +
        '<span style="color:' + barColor + '">' + bar + '</span>' +
        '<span style="color:' + dim + '"> ' + pct + '%' + trendArrow + '</span>' +
        '<span style="color:' + statusColor + ';font-size:0.40rem;margin-left:4px">' + statusLabel + '</span>' +
        '<span style="color:' + dim + ';font-size:0.38rem;margin-left:3px">' + confShort + '</span>' +
        balTag +
        portalLink +
        '<br><span style="color:rgba(200,195,184,0.25);font-size:0.36rem;margin-left:8px">' + freshText + '</span>' +
        '</div>'
      );

      if (_expandedDomain === k) {
        lines.push(_buildDetailHTML(k, d));
      }
    }

    // Refresh promotion data before rendering strip
    _promoteToCivilization();

    // Top Actions strip (reads from promotion contract only)
    var _civActions = (window.LIMENCivilizationActions && window.LIMENCivilizationActions.actions) ? window.LIMENCivilizationActions.actions : [];
    if (_civActions.length > 0) {
      var _classIcon = { escalate: '\u26A0', interpret: '\u25C9', observe: '\u25CB', act: '\u25CF' };
      var _showN = Math.min(_civActions.length, 3);
      lines.push('<div style="border-top:1px solid rgba(201,169,78,0.08);padding-top:4px;margin-top:4px">');
      lines.push('<div style="color:' + gold + ';font-size:0.42rem;letter-spacing:1.5px;margin-bottom:2px">TOP ACTIONS</div>');
      for (var _tai = 0; _tai < _showN; _tai++) {
        var _ta = _civActions[_tai];
        var _icon = _classIcon[_ta.action_class] || '\u25CB';
        var _domTag = (_ta.domain || '').slice(0, 6).toUpperCase();
        var _staleTag = _ta.stale ? '<span style="opacity:0.4"> (stale)</span>' : '';
        var _drillUrl = (_ta.drill_target && _ta.drill_target.url) ? _ta.drill_target.url : '#';
        lines.push(
          '<div style="font-size:0.38rem;padding:1px 0;display:flex;align-items:baseline;gap:4px">' +
          '<span style="color:rgba(200,195,184,0.3)">' + _icon + '</span>' +
          '<span style="color:rgba(201,169,78,0.5)">' + _domTag + '</span>' +
          '<span style="color:rgba(200,195,184,0.5);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (_ta.title || '') + _staleTag + '</span>' +
          '<a href="' + _drillUrl + '" onclick="event.stopPropagation()" ' +
          'style="color:rgba(201,169,78,0.4);text-decoration:none;font-size:0.36rem" ' +
          'onmouseover="this.style.color=\'rgba(201,169,78,0.9)\'" onmouseout="this.style.color=\'rgba(201,169,78,0.4)\'"' +
          '>\u25B8</a>' +
          '</div>'
        );
      }
      lines.push('</div>');
    }

    if (!hasVisible) {
      panelEl.style.display = 'none';
      return;
    }

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-domain-panel')) {
      return;
    }
    panelEl.style.display = 'block';
    panelEl.innerHTML = lines.join('');
  }

  function _buildDetailHTML(domainKey, d) {
    var dimmer = 'rgba(200,195,184,0.3)';
    var teal = '#5ab5a0';
    var goldDim = 'rgba(201,169,78,0.5)';
    var red = '#e85454';
    var orange = '#d4a44e';
    var green = 'rgba(90,181,160,0.8)';
    var sectionLabel = 'rgba(201,169,78,0.35)';
    var html = '<div style="margin:4px 0 6px 12px;border-left:1px solid rgba(201,169,78,0.12);padding-left:8px">';

    // Sources section
    var sources = d.sources || [];
    for (var s = 0; s < sources.length; s++) {
      var src = sources[s];
      var liveColor = src.live ? teal : red;
      var liveTag = src.live ? 'LIVE' : 'OFFLINE';
      var freshText = _freshness(src.updated);
      html += '<div style="color:' + dimmer + ';margin-bottom:2px">';
      html += 'Source ' + String.fromCharCode(65 + s) + ': ';
      html += '<span style="color:' + goldDim + '">' + src.name + '</span>';
      html += ' \u2014 <span style="color:' + liveColor + '">' + liveTag + '</span>';
      html += ' \u2014 updated ' + freshText;
      html += '</div>';
    }

    // Raw indicators section
    var hasRaw = false;
    for (var r = 0; r < sources.length; r++) {
      if (sources[r].label && sources[r].live) { hasRaw = true; break; }
    }
    if (hasRaw) {
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Raw indicators:</div>';
      for (var v = 0; v < sources.length; v++) {
        if (sources[v].label && sources[v].live) {
          html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + sources[v].label + '</div>';
        }
      }
    }

    // Computed section
    var confLabel = 'low';
    if (d.confidence >= 0.8) confLabel = 'high';
    else if (d.confidence >= 0.4) confLabel = 'moderate';
    // Data type label
    var dataType = 'inferred from raw feed data';
    var dtColor = teal;
    if (confLabel === 'low') {
      dataType = 'heuristic fallback';
      dtColor = red;
    } else if (confLabel === 'moderate') {
      dataType = 'mixed live + fallback';
      dtColor = orange;
    }
    html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Computed:</div>';
    html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + domainKey + ' stress: ' + d.stress.toFixed(2) + '</div>';
    html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 confidence: ' + confLabel + '</div>';
    html += '<div style="color:' + dtColor + ';padding-left:6px;font-size:0.42rem">\u2022 type: ' + dataType + '</div>';

    // Balance section (from balance-meter.js)
    var bal = (window.LIMENBalance && window.LIMENBalance[domainKey]) || null;
    if (bal) {
      var balColor = dimmer;
      var balLabel = 'neutral';
      if (bal.state === 'improving') { balColor = green; balLabel = 'improving'; }
      else if (bal.state === 'destabilizing') { balColor = red; balLabel = 'destabilizing'; }
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Balance:</div>';
      html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 destabilizing: ' + bal.destabilizing.toFixed(2) + '</div>';
      html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 stabilizing: ' + bal.stabilizing.toFixed(2) + '</div>';
      html += '<div style="color:' + balColor + ';padding-left:6px;font-size:0.42rem">\u2022 net: ' + (bal.net > 0 ? '+' : '') + bal.net.toFixed(2) + ' (' + balLabel + ')</div>';
    }

    // Why elevated section
    var explanation = _getStressExplanation(domainKey, d.stress);
    if (d.stress > 0.15 && explanation) {
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Why elevated:</div>';
      html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + explanation + '</div>';
    }

    // Signals from API
    var signals = d.signals || [];
    if (signals.length > 0) {
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Signals:</div>';
      for (var g = 0; g < signals.length; g++) {
        html += '<div style="color:' + dimmer + ';padding-left:6px;font-size:0.42rem">\u2022 ' + signals[g] + '</div>';
      }
    }

    // Report polarity section (from report-polarity-engine.js)
    var pol = (window.LIMENPolarity && window.LIMENPolarity[domainKey]) || null;
    if (pol && pol.polarity !== 'uncertain') {
      var toneColor = dimmer;
      if (pol.polarity === 'positive') toneColor = green;
      else if (pol.polarity === 'negative') toneColor = red;
      else if (pol.polarity === 'mixed') toneColor = orange;
      html += '<div style="margin-top:4px;color:' + sectionLabel + ';font-size:0.42rem">Report tone:</div>';
      html += '<div style="color:' + toneColor + ';padding-left:6px;font-size:0.42rem">\u2022 ' + pol.polarity + ' (net ' + (pol.netTone > 0 ? '+' : '') + pol.netTone.toFixed(2) + ')</div>';
      if (pol.recentPositive.length > 0) {
        html += '<div style="color:' + green + ';padding-left:6px;font-size:0.42rem">+ ' + pol.recentPositive[0] + '</div>';
      }
      if (pol.recentNegative.length > 0) {
        html += '<div style="color:' + red + ';padding-left:6px;font-size:0.42rem">- ' + pol.recentNegative[0] + '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  // ─── Civilization Action Promotion ────────────────────────────────────────
  // Transforms portal-level recommendedTreatments into civilization-safe
  // action contracts. Does NOT render UI — produces a normalized array.
  //
  // Tight gates: evidence >= A-, type must be DIAGNOSTIC/MONITORING/analysis,
  // domain must be stressed or under cross-domain pressure,
  // confidence_composite >= 0.25, max 2 per domain, max 10 total.

  var _PORTAL_DOMAIN_MAP = {health:'medicine',research:'science',supplyChain:'trade',agriculture:'p2_agri'};
  var _EV_SCORE = {'Strong':1.0,'A':1.0,'A-':0.9,'B+':0.7,'Moderate':0.5,'B':0.5,'B-':0.3,'C+':0.1,'C':0,'Limited':0,'None':0};

  var _TYPE_MAP = {
    'MONITORING': { action_class: 'observe', action_type: 'monitor' },
    'monitoring': { action_class: 'observe', action_type: 'monitor' },
    'DIAGNOSTIC': { action_class: 'interpret', action_type: 'investigate' },
    'diagnostic': { action_class: 'interpret', action_type: 'investigate' },
    'analysis':   { action_class: 'interpret', action_type: 'investigate' },
    'ANALYSIS':   { action_class: 'interpret', action_type: 'investigate' }
  };

  var _PROMO_MAX_PER_DOMAIN = 2;
  var _PROMO_MAX_TOTAL = 10;
  var _PROMO_CONF_THRESHOLD = 0.25;
  var _PROMO_EV_MIN = 0.7; // requires A- or better (0.9) or B+ (0.7) — excludes Moderate/B

  function _promoteToCivilization() {
    var ar = window.LIMENAnalystReport;
    var cdState = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) ? window.LIMENCrossDomain.active : [];
    var now = Date.now();

    if (!ar || !ar.domains || ar.domains.length === 0) {
      window.LIMENCivilizationActions = { actions: [], generated_at: now };
      return [];
    }

    // Domains under cross-domain pressure
    var cdDomains = {};
    for (var ci = 0; ci < cdState.length; ci++) {
      var cds = cdState[ci].domains || [];
      for (var cj = 0; cj < cds.length; cj++) cdDomains[cds[cj]] = cdState[ci].pattern || 'cross-domain';
    }

    // Phase 1: collect candidates per domain (pre-capped)
    var candidates = []; // {action, sortKey}

    for (var di = 0; di < ar.domains.length; di++) {
      var dom = ar.domains[di];
      var txs = dom.recommendedTreatments;
      if (!txs || !Array.isArray(txs)) continue;

      var stress = dom.stress || 0;
      var confidence = dom.confidence || 0;
      var rk = dom.runtimeKey || dom.domainId || '';
      var portalDomain = _PORTAL_DOMAIN_MAP[rk] || rk;
      var hasCDPressure = !!cdDomains[rk];

      // ── Domain-level gate: must be stressed OR under cross-domain pressure
      if (stress < 0.40 && !hasCDPressure) continue;

      // Freshness
      var liveData = domains[rk];
      var freshnessFactor = 1.0;
      if (liveData && liveData.updated) {
        var age = now - liveData.updated;
        if (age > 180000) freshnessFactor = 0.3;
        else if (age > 60000) freshnessFactor = 0.8;
      } else {
        freshnessFactor = 0.3;
      }
      var isStale = freshnessFactor < 0.5;

      // Collect this domain's promotable treatments, score them
      var domCandidates = [];

      for (var ti = 0; ti < txs.length; ti++) {
        var tx = txs[ti];
        if (!tx.title) continue;

        var evScore = _EV_SCORE[tx.evidence] !== undefined ? _EV_SCORE[tx.evidence] : 0;
        if (evScore < _PROMO_EV_MIN) continue; // B+/A-/A/Strong only

        var mapped = _TYPE_MAP[tx.type || ''];
        if (!mapped) continue;

        var confComposite = evScore * Math.max(confidence, 0.1) * freshnessFactor;
        if (confComposite < _PROMO_CONF_THRESHOLD) continue;

        // Promotion reason
        var reason = 'high_evidence';
        if (stress >= 0.65 && hasCDPressure) reason = 'cross_domain_distressed';
        else if (stress >= 0.65) reason = 'domain_distressed';
        else if (hasCDPressure) reason = 'cross_domain_pressure';
        else if (stress >= 0.40) reason = 'domain_elevated';

        // Action class (escalate upgrade for severe convergence)
        var actionClass = mapped.action_class;
        var actionType = mapped.action_type;
        if (stress >= 0.65 && evScore >= 0.9 && hasCDPressure) {
          actionClass = 'escalate';
          actionType = 'escalate';
        }

        domCandidates.push({
          id: tx.id || (rk + '_tx_' + ti),
          title: tx.title,
          action_class: actionClass,
          action_type: actionType,
          domain: dom.label || rk,
          domainId: rk,
          stress: stress,
          evidence: tx.evidence || '',
          confidence_composite: Math.round(confComposite * 1000) / 1000,
          promotion_reason: reason,
          stale: isStale,
          drill_target: { type: 'portal', domainId: portalDomain, url: '/portal?domain=' + encodeURIComponent(portalDomain) },
          promoted_at: now
        });
      }

      // Phase 2: per-domain dedup — keep only strongest representative per title prefix
      // (treatments like "X assessment" and "Y assessment" cluster on "assessment")
      domCandidates.sort(function(a, b) { return b.confidence_composite - a.confidence_composite; });
      var seen = {};
      var kept = [];
      for (var ki = 0; ki < domCandidates.length && kept.length < _PROMO_MAX_PER_DOMAIN; ki++) {
        // Cluster key: first 3 significant words of title
        var words = domCandidates[ki].title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(function(w) { return w.length > 2; });
        var clusterKey = words.slice(0, 3).sort().join('_');
        if (seen[clusterKey]) continue;
        seen[clusterKey] = true;
        kept.push(domCandidates[ki]);
      }

      for (var kj = 0; kj < kept.length; kj++) candidates.push(kept[kj]);
    }

    // Phase 3: global sort
    // Priority: cross-domain distressed > distressed > cross-domain > elevated > high_evidence
    // Within same priority: confidence_composite descending
    var reasonOrder = { cross_domain_distressed: 0, domain_distressed: 1, cross_domain_pressure: 2, domain_elevated: 3, high_evidence: 4 };
    var classOrder = { escalate: 0, act: 1, interpret: 2, observe: 3 };

    candidates.sort(function(a, b) {
      var ra = reasonOrder[a.promotion_reason] !== undefined ? reasonOrder[a.promotion_reason] : 9;
      var rb = reasonOrder[b.promotion_reason] !== undefined ? reasonOrder[b.promotion_reason] : 9;
      if (ra !== rb) return ra - rb;
      var ca = classOrder[a.action_class] !== undefined ? classOrder[a.action_class] : 9;
      var cb = classOrder[b.action_class] !== undefined ? classOrder[b.action_class] : 9;
      if (ca !== cb) return ca - cb;
      return b.confidence_composite - a.confidence_composite;
    });

    // Phase 4: global cap
    var promoted = candidates.slice(0, _PROMO_MAX_TOTAL);

    window.LIMENCivilizationActions = { actions: promoted, generated_at: now };
    return promoted;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    if (_feedInterval) return;

    _pollFeed();

    _feedInterval = setInterval(function () {
      if (!document.hidden) _pollFeed();
    }, FEED_POLL_MS);

    _uiInterval = setInterval(function () {
      if (!document.hidden) _renderPanel();
    }, UI_REFRESH_MS);
  }

  function stop() {
    if (_feedInterval) {
      clearInterval(_feedInterval);
      _feedInterval = null;
    }
    if (_uiInterval) {
      clearInterval(_uiInterval);
      _uiInterval = null;
    }
  }

  function reset() {
    _initDomains();
    _lastFeedData = null;
    _feedAlive = false;
    _expandedDomain = null;
    window.LIMENDomains = domains;
    if (panelEl) panelEl.style.display = 'none';
  }

  function update() {
    _pollFeed();
  }

  function getDomains() {
    var copy = {};
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      copy[k] = {
        stress: domains[k].stress,
        trend: domains[k].trend,
        signals: domains[k].signals.slice(),
        updated: domains[k].updated,
        sources: domains[k].sources,
        confidence: domains[k].confidence
      };
    }
    return copy;
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENDomains = domains;
  window.LIMENSourceAudit = _sourceAudit;

  window.LIMENDomainEngine = {
    start: start,
    stop: stop,
    reset: reset,
    update: update,
    getDomains: getDomains
  };

})();
