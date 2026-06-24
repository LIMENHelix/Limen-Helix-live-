/**
 * inter-brain-bus.js — Cross-Domain Nervous System
 *
 * Routes emissions between domain brains. When energy emits
 * "fuel_cost_transmission" to supplyChain, this bus:
 *   1. Collects the emission
 *   2. Delivers it to the target brain (if registered)
 *   3. The target brain incorporates it as an external stress modifier
 *   4. Civilization layer sees the full propagation map
 *
 * Routing is domain-AGNOSTIC: any brain that publishes
 * state.crossDomainEmissions participates. The examples below document the
 * FINANCE wiring so the credit/liquidity/solvency channel is not silent in
 * the cross-domain nervous system. (No finance-specific routing code is
 * required — finance plugs in exactly like energy/infrastructure/culture.)
 *
 * Cross-domain examples — OTHER → FINANCE (finance as a target):
 *   energy         → finance  (commodity_dislocation / fuel_cost_transmission
 *                              → fuel & input costs erode coverage ratios →
 *                              credit stress at fuel-heavy borrowers)
 *   infrastructure → finance  (FUNDING_COLLAPSE / maintenance_deficit
 *                              → maintenance backlog & deferred capex →
 *                              project-finance funding squeeze, downgrade risk)
 *   governance     → finance  (regulatory tightening / policy_shock
 *                              → capital-access squeeze, higher compliance &
 *                              funding cost, primary-market access narrows)
 *   supplyChain    → finance  (logistics_constraint → working-capital strain,
 *                              receivables stretch → liquidity_constraint)
 *
 * Cross-domain examples — FINANCE → OTHER (finance as a source). Finance
 * emits three native signals when ≥1 validated/active diagnosis is present:
 *   finance → energy        (credit_spread       → widening spreads raise the
 *                            cost of capital for capex-heavy energy issuers)
 *   finance → infrastructure(solvency_stress     → bank/lender solvency stress
 *                            → project funding withdrawn, refinancing risk)
 *   finance → economy       (liquidity_constraint→ funding-market liquidity
 *                            squeeze → broad credit contraction)
 *   finance → industry      (credit_spread       → higher financing cost →
 *                            production/expansion drag)
 *   Real finance issuers behind these signals: JPM, BAC, C, WFC, GS, MS,
 *   SCHW, BLK, KKR, BX, V, MA. (credit_spread = market-priced default risk;
 *   solvency_stress = capital/coverage erosion; liquidity_constraint =
 *   funding-access squeeze.) These are SIGNAL examples only — the validated
 *   Thing1 P3 distress kernel remains the sole scoring authority; the bus
 *   merely transports already-scored emissions.
 *
 * Cross-domain examples — OTHER → ECONOMY (economy as a target). Economy is
 * the MACRO AGGREGATE (GDP/inflation/employment/sentiment/policy/business
 * cycle) and is DISTINCT from finance (capital markets / credit / banks). It
 * is bound to BROAD MACRO INDICATORS — real FRED series and broad-market
 * proxies, never single-company tickers. Economy was previously a SOURCE only
 * (it emits to finance/supplyChain/energy/governance); these are its missing
 * RETURN paths so the macro feedback loop is not silent in the bus:
 *   finance     → economy  (liquidity_constraint → funding-market liquidity
 *                           squeeze raises the cost of capital → capex &
 *                           working-capital pullback → slower GDP growth,
 *                           softer employment. Macro reads: GDPC1 (real GDP),
 *                           FEDFUNDS / DGS10 (policy & term rates), PAYEMS /
 *                           UNRATE (labor), broad-market proxies SPY / DIA /
 *                           TLT. Finance also natively emits credit_transmission
 *                           to economy — same return channel.)
 *   supplyChain → economy  (logistics_constraint → supply disruption raises
 *                           input costs and compresses throughput → demand
 *                           shock + cost-push inflation. Macro reads: CPIAUCSL
 *                           / PCEPI (price level), INDPRO (industrial
 *                           production), UMCSENT (consumer sentiment).)
 *   energy      → economy  (commodity_shock → fuel_cost_transmission /
 *                           commodity_dislocation → fuel & power cost spike →
 *                           headline inflation pass-through, real-income drag
 *                           on consumption. Macro reads: CPIAUCSL / PCEPI,
 *                           GLD as a broad inflation/commodity proxy.)
 *   These modify economy's PRIOR growth expectation and stress calculation
 *   AFTER the validated P3 kernel runs — they are external stress modifiers
 *   ingested via the base receiveExternalSignal handler, NOT a second scorer.
 *
 * Cross-domain examples — OTHER → DEFENSE (defense as a target). Defense is the
 * KINETIC / INDUSTRIAL / READINESS domain (military spending & procurement, the
 * defense industrial base, geopolitical conflict & deterrence, weapons systems,
 * military readiness, alliances & basing, electronic/kinetic warfare, strategic
 * deterrence). It is DISTINCT from intelligence (collection / analysis /
 * espionage) and from technology (cyber is a COUPLING, not defense's identity).
 * Defense was previously documented as a SOURCE only (it emits to governance/
 * economy/technology/intelligence — see defense-brain.js emissionRules); these
 * are its missing RETURN paths so the readiness/deterrence channel is not silent
 * in the bus:
 *   infrastructure → defense (SCADA_vulnerability / grid_resilience_pressure →
 *                             base & depot power/water reliability erodes →
 *                             military operation reliability risk, degraded CBRN
 *                             defense posture, continuity-of-operations gap)
 *   technology     → defense (zero_day_disclosure / cyber_threat_vector →
 *                             weapons-system & C2 exploitation risk → a kinetic
 *                             vulnerability in fielded platforms, not a data
 *                             breach — the cyber→kinetic coupling)
 *   energy         → defense (fuel_security_strain / strategic_reserve_pressure
 *                             / commodity_dislocation → JP-8 & bunker fuel cost
 *                             and supply strain → military logistics constraint,
 *                             sortie-rate & sustainment readiness gap)
 *   These modify defense's PRIOR readiness/threat-posture expectation and stress
 *   calculation AFTER the validated P3 kernel runs — external stress modifiers
 *   ingested via the base receiveExternalSignal handler, NOT a second scorer.
 *
 * Cross-domain examples — DEFENSE → OTHER (defense as a source). Defense emits
 * native signals when ≥1 active diagnosis is present (defense-brain.js):
 *   defense → governance   (security_policy_pressure    → threat escalation
 *                           forces security/posture policy response)
 *   defense → economy      (defense_spending_drag       → procurement surge /
 *                           crowd-out shifts the macro spending mix)
 *   defense → technology   (defense_tech_demand         → R&D pull on sensors,
 *                           autonomy, hypersonics, electronic warfare)
 *   defense → intelligence (threat_assessment_pressure  → kinetic posture
 *                           raises collection & analysis tasking demand)
 *   And the missing OUTBOUND coupling paths to energy/infrastructure (the return
 *   side of the energy→defense / infrastructure→defense inbound mirrors above —
 *   defense couples to energy via fuel logistics & strategic-reserve management
 *   and to infrastructure via grid resilience for military operations, WITHOUT
 *   taking on oil/gas/grid as its own identity):
 *   defense → energy        (strategic_reserve_mobilization / fuel_security_posture
 *                           → wartime / high-readiness fuel mobilization and
 *                           strategic-petroleum-reserve drawdown reshape fuel
 *                           demand & security posture for capex-heavy energy
 *                           issuers — the outbound mirror of energy's native
 *                           fuel_cost_transmission path)
 *   defense → infrastructure(energy_infrastructure_hardening_mandate → readiness
 *                           drives grid-resilience, communications-infrastructure
 *                           and base-infrastructure hardening requirements for
 *                           military continuity-of-operations)
 *   Real defense issuers behind these signals (defense industrial base
 *   procurement & readiness signaling): LMT, RTX, NOC, GD, BA, LHX, HII, LDOS,
 *   BAH, KTOS, AVAV. (readiness_gap = sustainment/sortie-rate shortfall;
 *   force_projection = deployable-capacity pressure; deterrence_failure =
 *   strategic-stability erosion.) SIGNAL examples only — the validated Thing1 P3
 *   distress kernel remains the sole scoring authority; the bus merely transports
 *   already-scored emissions.
 *
 * Cross-domain examples — OTHER → INTELLIGENCE (intelligence as a target).
 * Intelligence is the COLLECTION / ANALYSIS / ESPIONAGE domain (SIGINT/HUMINT/
 * GEOINT/OSINT collection, all-source analysis & assessment, espionage &
 * counterintelligence, surveillance & reconnaissance, threat warning, covert
 * action, information & influence operations, security clearance & insider
 * risk). It is DISTINCT from defense (defense = kinetic / industrial / readiness)
 * and from technology (cyber tooling is a COUPLING that feeds collection, NOT
 * intelligence's identity). These are the inbound paths other brains already
 * emit toward intelligence (see each source brain's emissionRules), so the
 * collection/threat-warning channel is not silent in the bus:
 *   defense        → intelligence (threat_assessment_pressure → kinetic posture
 *                             & deterrence signaling raise collection tasking and
 *                             all-source analysis demand → collection_tasking
 *                             surge, ISR re-prioritization)
 *   technology     → intelligence (zero_day_threat_intelligence /
 *                             cyber_collection_capability → cyber-collection
 *                             feasibility & SIGINT-platform performance inform
 *                             collection-system effectiveness — the cyber→
 *                             collection coupling, not a defense breach)
 *   infrastructure → intelligence (infrastructure_threat_intelligence /
 *                             ISR_platform_availability → ICS/SCADA exploited-CVE
 *                             feeds + collection-platform (satellite/drone)
 *                             readiness → collection-system availability for
 *                             persistent surveillance & reconnaissance)
 *   communication  → intelligence (information_contamination_signal → OSINT
 *                             source-pollution / influence-op noise degrades
 *                             open-source collection confidence)
 *   These modify intelligence's PRIOR collection-confidence / threat-warning
 *   expectation and stress calculation AFTER the validated P3 kernel runs —
 *   external stress modifiers ingested via the base receiveExternalSignal
 *   handler, NOT a second scorer.
 *
 * Cross-domain examples — INTELLIGENCE → OTHER (intelligence as a source).
 * Intelligence emits native signals when ≥1 active diagnosis is present
 * (intelligence-brain.js emissionRules):
 *   intelligence → defense       (threat_visibility_pressure → threat-assessment
 *                             & collection-tasking findings raise kinetic posture
 *                             / deterrence signaling and procurement urgency)
 *   intelligence → governance    (coordination_blind_spot → collection-gap /
 *                             policy-recommendation & collection-constraint
 *                             findings shape national-security policy & oversight
 *                             response)
 *   intelligence → technology    (observability_trust_pressure → cyber-collection
 *                             feasibility & SIGINT-platform load inform
 *                             cyber-defense / sensor / autonomy R&D priorities)
 *   intelligence → communication (information_contamination_risk → influence-op
 *                             & disinformation warning tightens information
 *                             integrity posture)
 *   intelligence → finance       (strategic_risk_visibility → declassified threat
 *                             findings & strategic-risk assessment reprice
 *                             geopolitical / sanctions / counterparty exposure)
 *   And the research coupling (the academic-security-studies return side —
 *   intelligence shapes scholarship WITHOUT taking on defense procurement as its
 *   identity):
 *   intelligence → research      (declassified_threat_findings / analysis_method
 *                             -ology → declassified findings & tradecraft shape
 *                             academic security-studies & methodology research)
 *   Real IC-sector issuers behind these signals (collection / all-source analysis
 *   / mission-systems operators — NOT energy oil/gas/grid, NOT defense kinetic
 *   primes): PLTR, BAH, LDOS, CACI, SAIC, KBR, VRNT, NICE, VRSK.
 *   (collection_gap = SIGINT/HUMINT/GEOINT/OSINT coverage shortfall;
 *   warning_failure = threat-warning latency / surprise risk;
 *   insider_risk = clearance / counterintelligence exposure.) SIGNAL examples
 *   only — the validated Thing1 P3 distress kernel remains the sole scoring
 *   authority; the bus merely transports already-scored emissions.
 *
 * Cross-domain examples — ECONOMY → OTHER (economy as a source). Economy emits
 * native macro signals when ≥1 active diagnosis is present (economy-brain.js):
 *   economy → finance      (credit_conditions_shift   → macro deterioration
 *                           tightens credit conditions / repricing)
 *   economy → supplyChain  (demand_throughput_pressure → softer final demand
 *                           cascades to order books & throughput)
 *   economy → energy       (demand_consumption_shift   → cycle turn shifts
 *                           power/fuel consumption)
 *   economy → governance   (policy_response_pressure   → fiscal/monetary
 *                           response pressure: FEDFUNDS path, fiscal stance)
 *   Macro anchors behind economy emissions (REAL FRED series + broad-market
 *   proxies, never fabricated tickers): GDP, GDPC1, CPIAUCSL, PCEPI, UNRATE,
 *   PAYEMS, FEDFUNDS, DGS10, UMCSENT, INDPRO; SPY, DIA, TLT, GLD. The
 *   recession/expansion business cycle is the macro regime these traverse —
 *   e.g. finance liquidity crisis → higher cost of capital → slower GDP →
 *   weaker employment → dampened consumer spending → amplified cycle (the
 *   return loop economy must close). SIGNAL examples only — Thing1 P3 remains
 *   the sole scoring authority; the bus merely transports scored emissions.
 *
 * Cross-domain examples — INDUSTRY → OTHER (industry as a source). Industry is
 * the MANUFACTURING / INDUSTRIAL-PRODUCTION domain (factory output & capacity
 * utilization, automation & robotics, heavy industry & capital goods, industrial
 * supply chains, machinery & equipment, industrial maintenance & uptime). It is
 * DISTINCT from trade (logistics / commerce), from economy (the macro aggregate),
 * and from technology (automation is a COUPLING that feeds the factory floor, NOT
 * industry's identity — and industry NEVER takes energy oil/gas/grid as its own
 * content). The bus previously treated industry as a TARGET only (finance →
 * industry, line 38; energy → industry via production_cost_impact in
 * energy-brain.js emissionRules); these are its missing OUTBOUND paths so the
 * production / capacity-utilization channel is not silent in the bus. Industry
 * emits native signals when ≥1 active diagnosis is present (per brain cycle):
 *   industry → economy      (production_constraint  → factory output gap &
 *                           capacity-utilization drop feed the industrial-
 *                           production component of the macro aggregate →
 *                           INDPRO/manufacturing-PMI softening, output-gap
 *                           widening)
 *   industry → finance      (working_capital_strain → inventory build, lengthening
 *                           cash-conversion cycle and capex financing on heavy
 *                           capital goods → liquidity pressure / cost-of-capital
 *                           on industrial issuers)
 *   industry → supplyChain  (production_surge_demand → a ramp in factory
 *                           throughput pulls components, raw inputs and machinery
 *                           parts → upstream supply pull / order-book tightening)
 *   industry → defense      (wartime_mobilization   → surge-production conversion
 *                           of industrial / capital-goods capacity to defense
 *                           output → defense industrial-base throughput, the
 *                           outbound mirror of defense's readiness coupling,
 *                           WITHOUT industry taking on kinetic readiness as its
 *                           identity)
 *   Real industrial issuers behind these signals (manufacturing / capital goods /
 *   machinery / automation & robotics / industrial heavy industry — NOT energy
 *   oil/gas/grid, NOT trade logistics carriers, NOT macro proxies): CAT, DE, GE,
 *   HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV. (production_constraint =
 *   capacity-utilization / output-gap pressure; working_capital_strain =
 *   inventory & cash-conversion-cycle strain; production_surge_demand = throughput
 *   ramp pulling inputs; wartime_mobilization = surge-production conversion.)
 *   SIGNAL examples only — the validated Thing1 P3 distress kernel remains the
 *   sole scoring authority; the bus merely transports already-scored emissions.
 *
 * Cross-domain examples — ENVIRONMENT → OTHER (environment as a source).
 * Environment is the CLIMATE / POLLUTION / ECOSYSTEMS domain (climate & emissions,
 * air/water/soil pollution & quality, ecosystems & biodiversity, natural resources
 * & conservation, environmental regulation & compliance, climate risk & adaptation,
 * waste management & remediation, carbon markets). It is DISTINCT from energy
 * (oil/gas/grid/power-generation — environment COUPLES to energy via emissions /
 * carbon pricing but NEVER takes fuel/grid as its own identity) and from
 * agriculture (land & water USE is a coupling, not environment's content). The bus
 * previously documented environment as a TARGET only — it RECEIVES from energy /
 * agriculture / industry (inbound, line 18 family) but its OUTBOUND emissions were
 * silent in the bus. These are environment's native OUTBOUND paths, mirroring the
 * energy / defense / intelligence SOURCE examples (the rules live in
 * environment-brain.js emissionRules, lines 60–91); environment emits these native
 * signals when ≥1 active diagnosis is present (per brain cycle):
 *   environment → energy        (carbon_regulatory_tightening / climate_asset_
 *                           stranding → carbon_regulatory_pressure escalates
 *                           renewable-transition urgency and fossil-fuel capex /
 *                           stranded-asset risk for capex-heavy energy issuers —
 *                           the outbound mirror of energy's inbound climate_resource
 *                           _constraint, WITHOUT environment taking on oil/gas as
 *                           its identity)
 *   environment → agriculture   (water_scarcity / soil_degradation →
 *                           water_security_investment & input stress raise yield
 *                           risk and irrigation / soil-remediation demand — the
 *                           ecosystem_soil_stress return path, environment-brain.js
 *                           line 62)
 *   environment → infrastructure(ecosystem_degradation / flooding_risk →
 *                           climate_adaptation_spending pressures asset resilience
 *                           and drives adaptation capex / hardening of exposed
 *                           infrastructure — environment-brain.js line 74,
 *                           environmental_degradation_impact)
 *   environment → governance    (regulatory_pressure_escalation / climate_tipping_
 *                           risk → carbon_regulatory_pressure raises policy &
 *                           compliance urgency, emissions-disclosure and remediation
 *                           mandates — environment-brain.js line 86,
 *                           environmental_regulatory_pressure)
 *   environment → economy       (environmental_cost_burden / carbon_pricing →
 *                           emission_control_cost imposes capex burden and margin
 *                           pressure on high-emission firms → environmental_cost_
 *                           pressure, environment-brain.js line 80)
 *   Additional environment-native SIGNAL examples surfacing on these paths:
 *   carbon_regulatory_pressure, emission_control_cost, biodiversity_restoration_
 *   demand, climate_adaptation_spending, water_security_investment.
 *   Real environmental-sector issuers behind these signals (waste management &
 *   remediation / water utilities & treatment / pollution-control & industrial
 *   gases / environmental services — NOT energy oil/gas/grid, NOT agriculture
 *   land/water operators): WM, RSG, WCN, CWST (waste & remediation); AWK, WTRG, XYL
 *   (water utilities & treatment); ECL (water/hygiene & pollution control); LIN, APD
 *   (industrial gases & carbon-capture/abatement); DAR (rendering & waste-to-value);
 *   AY (clean-infrastructure / environmental assets). (carbon_regulatory_pressure =
 *   emissions / carbon-price compliance burden; emission_control_cost = abatement &
 *   pollution-control capex; biodiversity_restoration_demand = ecosystem / habitat
 *   remediation pull; climate_adaptation_spending = resilience / hardening capex;
 *   water_security_investment = water-scarcity / treatment investment.) SIGNAL
 *   examples only — the validated Thing1 P3 distress kernel remains the sole scoring
 *   authority; the bus merely transports already-scored emissions.
 *
 * Cross-domain examples — OTHER → AGRICULTURE (agriculture as a target).
 * Agriculture is the FARMING / FOOD-PRODUCTION domain (farming & crops, livestock
 * & animal protein, agribusiness & food production, food security & supply,
 * fertilizers & crop inputs, irrigation & agricultural water, commodity crops
 * (corn/soy/wheat), agricultural technology & precision ag, farm economics). It is
 * DISTINCT from environment (land / water / climate is a COUPLING, not agriculture's
 * content), from trade (export logistics is a COUPLING, not its identity), and from
 * economy (food prices are a COUPLING — the macro pass-through, not the farm). And
 * agriculture NEVER takes energy oil/gas/grid as its own content — the energy link is
 * a COUPLING (diesel & farm-equipment fuel, fertilizer feedstock / biofuel demand).
 * The bus previously documented agriculture as a SOURCE only — it EMITS to supplyChain
 * (food_supply_disruption), economy (food_price_pressure), energy (biofuel_input_stress)
 * and environment (land_use_pressure) (agriculture-brain.js emissionRules, lines 71–96).
 * Its INBOUND RETURN paths were silent in the bus, creating the false impression that
 * agriculture is a source-only domain rather than a full bidirectional node. These are
 * the paths other brains already emit toward agriculture (see each source brain's
 * emissionRules / the SOURCE examples above), so the farm cash-flow / input-stress /
 * yield-risk channel is not silent in the bus:
 *   energy       → agriculture (fuel_cost_transmission / input_cost_spike → on-farm
 *                           diesel & farm-equipment fuel cost and the fertilizer
 *                           feedstock / nitrogen-energy link spike production cost →
 *                           input_cost_spike at growers → farm-margin compression and
 *                           input-payment stress; the inbound mirror of agriculture's
 *                           native biofuel_input_stress outbound, the diesel-for-equipment
 *                           equivalent of energy's JP-8 fuel-logistics coupling, WITHOUT
 *                           agriculture taking on oil/gas as its identity)
 *   economy      → agriculture (macro_demand_shift / demand_consumption_shift /
 *                           inflation_transmission → a cycle turn and commodity-price
 *                           repricing shift food demand and compress farm margins →
 *                           commodity_price_drop / margin_compression cascade → farm
 *                           cash-flow pressure and input-payment stress; the inbound
 *                           mirror of agriculture's native food_price_pressure outbound)
 *   environment  → agriculture (water_scarcity / soil_degradation / climate_stress →
 *                           irrigation constraint, soil-moisture deficit and yield-loss
 *                           risk raise water-stress and shift input demand →
 *                           irrigation_constraint / water_stress / yield_loss cascade →
 *                           DROUGHT-class on-farm stress; this is the documented
 *                           environment → agriculture return path, environment-brain.js
 *                           line 62 / lines 281–285 (water_security_investment & input
 *                           stress), the inbound mirror of agriculture's native
 *                           land_use_pressure outbound — land/water remains a COUPLING)
 *   These modify agriculture's PRIOR yield / farm-margin / food-security expectation and
 *   stress calculation AFTER the validated P3 kernel runs — external stress modifiers
 *   ingested via the base receiveExternalSignal handler, NOT a second scorer.
 *   Real agriculture issuers / anchors behind these signals (farming inputs / grain
 *   merchandising / seed & crop protection / farm machinery / food production — NOT
 *   energy oil/gas/grid, NOT environment water/waste operators, NOT trade logistics
 *   carriers): ADM, BG, INGR (grain merchandising & processing); CTVA, FMC (seed & crop
 *   protection); NTR, MOS, CF (fertilizers & crop nutrients); DE, AGCO (farm machinery &
 *   precision ag); TSN, CAG (livestock / animal protein & food production). Commodity
 *   anchors (REAL, never fabricated): CBOT corn / soybean / wheat futures, USDA WASDE
 *   (World Agricultural Supply & Demand Estimates). (input_cost_spike = diesel /
 *   fertilizer-feedstock cost pass-through; commodity_price_drop = CBOT grain repricing
 *   / margin compression; irrigation_constraint = water-scarcity / soil-moisture deficit
 *   yield risk.) SIGNAL examples only — the validated Thing1 P3 distress kernel remains
 *   the sole scoring authority; the bus merely transports already-scored emissions.
 *
 * Cross-domain examples — GOVERNANCE → OTHER (governance as a source). Governance
 * is the GOVERNMENT / PUBLIC-ADMINISTRATION / RULEMAKING domain (public policy &
 * rulemaking, regulation & oversight, elections & democratic institutions, public
 * finance & budgets, rule of law & institutional integrity, public-services
 * delivery, political stability & legitimacy). It is DISTINCT from economy (the
 * macro aggregate), from finance (capital markets / credit / banks), from law (the
 * JUDICIAL system / courts / legal-process — that is the law domain), and from
 * intelligence (collection / analysis). The bus previously documented governance as
 * a TARGET only — it RECEIVES from infrastructure (FUNDING_COLLAPSE → governance,
 * line 21 family) and from environment (regulatory_pressure_escalation → governance,
 * lines 291–295) — but its OUTBOUND emissions were silent in the bus, creating the
 * false impression that governance is a target-only domain rather than a full
 * bidirectional SOURCE. These are governance's native OUTBOUND paths, mirroring the
 * energy / defense / intelligence / economy / industry / environment SOURCE examples
 * (the rules live in governance-brain.js emissionRules, lines 31–36); governance
 * emits these native signals when ≥1 active diagnosis is present (per brain cycle):
 *   governance → law            (policy_conflict_enforcement → contradictory
 *                           directives, fragmented agency authority and cross-branch
 *                           incoherence strain compliance and create legal-authority
 *                           gaps — governance-brain.js emissionRules line 32,
 *                           DISTINCT from law's own judicial-process content)
 *   governance → finance        (policy_uncertainty_premium → a regulatory-regime
 *                           shift raises funding-cost pressure, compliance burden and
 *                           narrows primary-market access for affected issuers —
 *                           governance-brain.js line 35, the outbound mirror of the
 *                           inbound governance→finance regulatory-tightening path
 *                           documented at lines 24–26)
 *   governance → economy        (institutional_confidence_drag → a collapse in
 *                           institutional trust / legitimacy transmits as a demand
 *                           and confidence shock into the macro aggregate —
 *                           governance-brain.js line 33, DISTINCT from economy's own
 *                           macro content)
 *   governance → supplyChain    (administrative_friction → permit delays, capital-
 *                           allocation constraints and regulatory bottlenecks defer
 *                           throughput and squeeze deferred-maintenance / capital
 *                           access — governance-brain.js line 34; the same
 *                           institutional friction also pressures infrastructure
 *                           capital programs and tech-sector capex when IP / antitrust
 *                           / data-privacy regulation tightens, WITHOUT governance
 *                           taking on any of those domains' content as its identity)
 *   Additional governance-native SIGNAL examples surfacing on these paths:
 *   policy_uncertainty_premium, institutional_confidence_drag, policy_conflict_
 *   enforcement, administrative_friction, regulatory_regime_shift.
 *   Governance binds mostly to INSTITUTIONS & INDICATORS, not single companies — the
 *   governance/policy indices behind these signals (REAL, never fabricated): World
 *   Bank WGI (Worldwide Governance Indicators), V-Dem, OECD, GAO, CBO, the Federal
 *   Register. Where real govtech / public-sector operators are needed: TYL (Tyler
 *   Technologies, civil / court case management), MMS (Maximus, public-administration
 *   outsourcing), BAH (Booz Allen, governance analytics), LDOS (Leidos, compliance /
 *   oversight), ACN, GDIT. (policy_uncertainty_premium = regulatory-regime-shift
 *   funding-cost pressure; institutional_confidence_drag = legitimacy / trust-collapse
 *   demand shock; policy_conflict_enforcement = contradictory-directive & legal-
 *   authority-gap compliance strain; administrative_friction = permit / capital-
 *   allocation / regulatory-bottleneck delay.) SIGNAL examples only — the validated
 *   Thing1 P3 distress kernel remains the sole scoring authority; the bus merely
 *   transports already-scored emissions.
 *
 * Also detects:
 *   - Propagation chains (A→B→C)
 *   - Co-activation (multiple domains emitting simultaneously)
 *   - Causal loops (A→B→A, e.g. energy→finance→energy via cost-of-capital;
 *     finance→economy→finance via cost-of-capital→GDP→credit conditions;
 *     intelligence→defense→intelligence via threat_visibility_pressure→kinetic
 *     posture→threat_assessment_pressure→collection tasking)
 *   - Regime-level cascade (>3 domains in emission chain)
 *
 * Exposes: window.LIMENInterBrainBus
 */
(function () {
  'use strict';

  var MAX_HISTORY = 200;
  var CASCADE_THRESHOLD = 3; // domains in chain = cascade

  // ══════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════

  var _emissions = [];          // current cycle emissions
  var _history = [];            // rolling history of all emissions
  var _propagationMap = {};     // source → [{ target, signal, magnitude }]
  var _receivedSignals = {};    // target → [{ source, signal, magnitude, timestamp }]
  var _cascadeDetected = false;
  var _causalLoops = [];

  // ══════════════════════════════════════════════════════════════════════
  // COLLECTION — gather emissions from all active brains
  // ══════════════════════════════════════════════════════════════════════

  function collectEmissions() {
    var brains = window.LIMENDomainBrains ? window.LIMENDomainBrains.getAll() : {};
    _emissions = [];
    _propagationMap = {};

    for (var dk in brains) {
      var brain = brains[dk];
      var state = brain.getState();
      var emissions = state.crossDomainEmissions || [];

      for (var i = 0; i < emissions.length; i++) {
        var em = emissions[i];
        _emissions.push(em);

        // Build propagation map
        if (!_propagationMap[em.sourceDomain]) _propagationMap[em.sourceDomain] = [];
        _propagationMap[em.sourceDomain].push({
          target: em.targetDomain,
          signal: em.signal,
          magnitude: em.magnitude,
          timestamp: em.timestamp
        });

        // Record in history
        _history.push({
          source: em.sourceDomain,
          target: em.targetDomain,
          signal: em.signal,
          magnitude: em.magnitude,
          timestamp: em.timestamp || Date.now()
        });
      }
    }

    // Prune history
    if (_history.length > MAX_HISTORY) _history = _history.slice(-MAX_HISTORY);
  }

  // ══════════════════════════════════════════════════════════════════════
  // DELIVERY — route emissions to target brains
  // ══════════════════════════════════════════════════════════════════════

  function deliverEmissions() {
    var brains = window.LIMENDomainBrains ? window.LIMENDomainBrains.getAll() : {};
    _receivedSignals = {};

    for (var i = 0; i < _emissions.length; i++) {
      var em = _emissions[i];
      var target = em.targetDomain;

      // Accumulate received signals per target
      if (!_receivedSignals[target]) _receivedSignals[target] = [];
      _receivedSignals[target].push({
        source: em.sourceDomain,
        signal: em.signal,
        magnitude: em.magnitude,
        timestamp: em.timestamp
      });

      // If target brain exists, inject the signal
      var targetBrain = brains[target];
      if (targetBrain && targetBrain.receiveExternalSignal) {
        targetBrain.receiveExternalSignal(em);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // CASCADE / LOOP DETECTION
  // ══════════════════════════════════════════════════════════════════════

  function detectCascades() {
    _cascadeDetected = false;
    _causalLoops = [];

    // Find chains: A→B, B→C, C→D...
    var chains = [];
    for (var source in _propagationMap) {
      var targets = _propagationMap[source];
      for (var i = 0; i < targets.length; i++) {
        var chain = [source, targets[i].target];
        _extendChain(chain, 0);
        if (chain.length >= CASCADE_THRESHOLD) {
          chains.push(chain.slice());
        }
      }
    }

    if (chains.length > 0) {
      _cascadeDetected = true;
    }

    // Find loops: A→B→A
    for (var src in _propagationMap) {
      var tgts = _propagationMap[src];
      for (var j = 0; j < tgts.length; j++) {
        var tgt = tgts[j].target;
        // Does tgt emit back to src?
        if (_propagationMap[tgt]) {
          for (var k = 0; k < _propagationMap[tgt].length; k++) {
            if (_propagationMap[tgt][k].target === src) {
              _causalLoops.push({ a: src, b: tgt, magnitudeAB: tgts[j].magnitude, magnitudeBA: _propagationMap[tgt][k].magnitude });
            }
          }
        }
      }
    }
  }

  function _extendChain(chain, depth) {
    if (depth > 5) return; // prevent infinite recursion
    var last = chain[chain.length - 1];
    var targets = _propagationMap[last];
    if (!targets) return;

    for (var i = 0; i < targets.length; i++) {
      var next = targets[i].target;
      // Avoid revisiting (except for loop detection)
      if (chain.indexOf(next) === -1) {
        chain.push(next);
        _extendChain(chain, depth + 1);
        return; // follow first chain only
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // FULL CYCLE — called periodically or on brain-update events
  // ══════════════════════════════════════════════════════════════════════

  function cycle() {
    collectEmissions();
    deliverEmissions();
    detectCascades();

    // Emit event for civilization layer
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('limen:inter-brain-cycle', {
        detail: {
          emissionCount: _emissions.length,
          propagationMap: _propagationMap,
          receivedSignals: _receivedSignals,
          cascadeDetected: _cascadeDetected,
          causalLoops: _causalLoops,
          timestamp: Date.now()
        }
      }));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // START — listen for brain updates, run cycle after each
  // ══════════════════════════════════════════════════════════════════════

  var _started = false;
  var _cycleTimer = null;

  function start() {
    if (_started) return;
    _started = true;

    // Run cycle after any brain updates
    window.addEventListener('limen:domain-brain-update', function () {
      cycle();
    });

    // Also run on a fixed interval as backup
    _cycleTimer = setInterval(cycle, 30000);

    // Initial cycle
    setTimeout(cycle, 5000);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENInterBrainBus = {
    start: start,
    cycle: cycle,
    getEmissions: function () { return _emissions; },
    getHistory: function () { return _history; },
    getPropagationMap: function () { return _propagationMap; },
    getReceivedSignals: function (domainId) { return domainId ? (_receivedSignals[domainId] || []) : _receivedSignals; },
    isCascade: function () { return _cascadeDetected; },
    getCausalLoops: function () { return _causalLoops; },
    getState: function () {
      return {
        emissionCount: _emissions.length,
        activeChains: Object.keys(_propagationMap).length,
        cascadeDetected: _cascadeDetected,
        loopCount: _causalLoops.length,
        historyDepth: _history.length
      };
    }
  };

})();
