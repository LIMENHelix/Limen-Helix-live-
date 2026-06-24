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
 * Cross-domain examples — COMMUNICATION → OTHER (communication as a source).
 * Communication is the TELECOMMUNICATIONS / NETWORKS / INFORMATION-FLOW domain
 * (telecom carriers & networks, connectivity & broadband, internet infrastructure
 * — cell towers / fiber / spectrum, media & broadcasting CHANNELS, journalism &
 * news flow, information dissemination, social-media platforms as DISTRIBUTION,
 * public-discourse infrastructure). It is DISTINCT from culture (culture = content
 * / movements / scenes; communication = the CHANNELS / networks / information-flow
 * that carry them), from technology (chips / software / cyber is a COUPLING that
 * feeds the network, NOT communication's identity), and from intelligence (signals
 * COLLECTION is a coupling; communication owns the carriage & dissemination of
 * information, not its clandestine interception). And communication NEVER takes
 * energy oil/gas/grid as its own content. The bus previously documented
 * communication as a TARGET only — it RECEIVES from intelligence
 * (information_contamination_risk → communication, lines 180–182) and EMITS to
 * intelligence (information_contamination_signal → intelligence, lines 159–161) —
 * but its broader OUTBOUND emissions were silent in the bus, creating the false
 * impression that communication is a target-only domain rather than a full
 * bidirectional SOURCE. These are communication's native OUTBOUND paths, mirroring
 * the energy / defense / intelligence / environment SOURCE examples (the rules live
 * in communication-brain.js emissionRules); communication emits these native
 * signals when ≥1 active diagnosis is present (per brain cycle):
 *   communication → culture       (narrative_platform_reach → distribution-channel
 *                           reach, broadband penetration and broadcast/streaming
 *                           carriage shape how far cultural narratives and scenes
 *                           propagate — communication carries the CHANNEL, culture
 *                           owns the CONTENT; a platform-reach signal, NOT a content
 *                           judgment, the channel-side mirror of culture's content
 *                           movement)
 *   communication → population    (behavioral_informational_influence → information
 *                           dissemination, news flow and social-platform distribution
 *                           shape public attention, awareness and behavioral response
 *                           across a population — the information-environment input to
 *                           collective behavior, WITHOUT communication taking on
 *                           demographic / public-health content as its identity)
 *   communication → law           (speech_regulation_pressure → platform-carriage,
 *                           content-moderation, net-neutrality, spectrum-licensing
 *                           and broadcast-standards questions raise speech / common-
 *                           carrier / telecom-regulation pressure on the legal system
 *                           — the channel-regulation input to law, DISTINCT from law's
 *                           own judicial-process content)
 *   communication → intelligence  (osint_signal_availability → the volume, reach and
 *                           integrity of open information flows and social-platform
 *                           distribution set the open-source collection surface and
 *                           confidence available to all-source analysis — the
 *                           carriage-side OSINT-availability mirror of intelligence's
 *                           inbound information_contamination_signal, the channel feeds
 *                           collection feasibility WITHOUT communication taking on
 *                           clandestine interception as its identity)
 *   Additional communication-native SIGNAL examples surfacing on these paths:
 *   narrative_platform_reach, behavioral_informational_influence, speech_regulation_
 *   pressure, osint_signal_availability, network_capacity_strain.
 *   Real communication-sector issuers behind these signals (telecom carriers /
 *   internet & tower infrastructure / network equipment / media & broadcasting
 *   channels / social-platform distribution — NOT energy oil/gas/grid, NOT culture
 *   content studios, NOT intelligence collection operators): VZ, T, TMUS, CMCSA, CHTR
 *   (telecom carriers & broadband / cable); AMT, CCI, SBAC (cell-tower / wireless
 *   infrastructure REITs — towers / spectrum siting); CSCO, ANET (network equipment &
 *   routing / switching infrastructure); NWSA, NYT (journalism & news-flow / news
 *   media); META, GOOGL (social-media platforms & search as information DISTRIBUTION,
 *   the channel layer — not the cultural content itself). (narrative_platform_reach =
 *   distribution-channel & broadband-penetration reach for narratives; behavioral_
 *   informational_influence = information-environment input to collective behavior;
 *   speech_regulation_pressure = platform-carriage / common-carrier / telecom-
 *   regulation pressure; osint_signal_availability = open-source collection-surface
 *   reach & integrity; network_capacity_strain = backhaul / spectrum / bandwidth
 *   congestion.) SIGNAL examples only — the validated Thing1 P3 distress kernel
 *   remains the sole scoring authority; the bus merely transports already-scored
 *   emissions.
 *
 * Cross-domain examples — MEDICINE -> OTHER and OTHER -> MEDICINE (medicine as
 * both source and target). Medicine is the HEALTHCARE / CLINICAL domain
 * (healthcare & medicine, pharmaceuticals & biotech, hospitals & care providers,
 * medical devices & diagnostics, public health & disease control, clinical
 * research & trials, health systems & insurance, drug development). DUAL-KEY
 * NOTE: medicine is the URL / portal key but the bus routes on the RUNTIME
 * snapshot key 'health' (see domain-identity.js — medicine <-> health), so the
 * emissions below carry sourceDomain/targetDomain 'health' at the bus layer even
 * though the domain identity is "medicine". Medicine is DISTINCT from science
 * (basic / pre-clinical research is a COUPLING — clinical translation feeds from
 * it but medicine owns the bedside / care-delivery / regulated-product side, NOT
 * the bench), from population (demographics / disease burden is a COUPLING that
 * drives care demand, NOT medicine's own content), and from economy (healthcare
 * spending is a macro COUPLING, not the clinic). The bus previously had NO
 * medicine/health wiring at all — it was absent as both source and target,
 * leaving the clinical / payer / public-health channel entirely silent in the
 * cross-domain nervous system. These are medicine's native OUTBOUND paths,
 * mirroring the energy / defense / intelligence SOURCE examples (the rules live
 * in medicine/health-brain.js emissionRules); medicine emits these native signals
 * when >=1 active diagnosis is present (per brain cycle):
 *   medicine -> population   (clinical_outcomes_pressure / epidemic_signal ->
 *                           disease burden, morbidity / mortality risk and
 *                           outbreak escalation shape public-health priority and
 *                           care demand across a population — the care-delivery
 *                           input to collective health, the inbound mirror of
 *                           population's demographic_aging_pressure return below,
 *                           WITHOUT medicine taking on demographics as its identity)
 *   medicine -> finance      (payer_solvency_stress / cost-containment_mandate ->
 *                           medical-cost trend, utilization surge and reimbursement
 *                           pressure squeeze healthcare-payer capital and liquidity
 *                           -> funding-cost pressure on payer / provider issuers,
 *                           the clinical-cost side, DISTINCT from finance's own
 *                           capital-markets content)
 *   medicine -> governance   (regulatory_compliance_surge / coverage_mandate ->
 *                           drug-safety, approval and coverage questions raise
 *                           FDA / CMS rulemaking, coverage-mandate and compliance
 *                           pressure — the health-regulation input to governance,
 *                           DISTINCT from governance's own public-administration
 *                           content)
 *   medicine -> law          (liability_risk_escalation / malpractice_trending ->
 *                           adverse-event, product-liability and malpractice trends
 *                           raise litigation-docket and tort-exposure pressure — the
 *                           clinical-liability input to law, DISTINCT from law's own
 *                           judicial-process content)
 * These are medicine's INBOUND RETURN paths (other brains already emit toward
 * medicine — see each source brain's emissionRules / the SOURCE examples above),
 * so the healthcare-system capacity / reimbursement / care-quality channel is not
 * silent in the bus:
 *   population   -> medicine (demographic_aging_pressure / disease_burden -> an aging
 *                           cohort and rising chronic-disease burden raise
 *                           healthcare-system capacity stress, utilization and
 *                           care-demand load -> capacity_stress at providers; the
 *                           inbound mirror of medicine's clinical_outcomes_pressure
 *                           outbound — demographics remain a COUPLING)
 *   finance      -> medicine (funding_constraint / capex_squeeze -> tighter capital
 *                           access and a cost-of-capital rise defer clinical-facility
 *                           maintenance, equipment refresh and hospital capex ->
 *                           facility_maintenance_lag / capex_deferral at care
 *                           providers, the inbound mirror of medicine's payer_solvency
 *                           _stress outbound)
 *   governance   -> medicine (regulatory_tightening / coverage_cuts -> reimbursement-
 *                           rate cuts, coverage rule changes and tighter health
 *                           regulation pressure provider reimbursement and margins ->
 *                           reimbursement_pressure, the inbound mirror of medicine's
 *                           regulatory_compliance_surge outbound)
 *   technology   -> medicine (diagnostic_platform_availability / EHR_capability ->
 *                           diagnostic-platform readiness, EHR / decision-support
 *                           capability and health-IT availability enable clinical-
 *                           data quality and decision support -> clinical_data_quality
 *                           / decision_support_enablement; the health-IT coupling
 *                           that feeds care quality, WITHOUT medicine taking on
 *                           chips / software as its identity)
 *   These modify medicine's PRIOR care-capacity / outcomes / reimbursement
 *   expectation and stress calculation AFTER the validated P3 kernel runs —
 *   external stress modifiers ingested via the base receiveExternalSignal handler,
 *   NOT a second scorer.
 *   Real healthcare issuers behind these signals (health systems & insurance /
 *   pharmaceuticals & biotech / medical devices & diagnostics / hospitals & care
 *   providers / pharmacy & care delivery — NOT energy oil/gas/grid, NOT science
 *   bench-research labs, NOT macro proxies): UNH, CVS (health systems & insurance /
 *   pharmacy & care delivery); HCA (hospitals & care providers); JNJ, PFE, MRK,
 *   ABBV, LLY, AMGN, GILD (pharmaceuticals & biotech / drug development); TMO, ABT,
 *   MDT, ISRG (medical devices & diagnostics). Real health-authority indicators
 *   (REAL, never fabricated): CDC mortality / surveillance data, CMS payment rates,
 *   FDA approval timelines, NIH R01 funding, AAFP clinical guidance. (clinical_
 *   outcomes_pressure = morbidity / mortality / outcome-quality burden; payer_
 *   solvency_stress = medical-cost-trend / utilization payer pressure; regulatory_
 *   compliance_surge = FDA / CMS rulemaking & coverage-mandate burden; liability_
 *   risk_escalation = adverse-event / malpractice / product-liability exposure;
 *   capacity_stress = demographic-driven care-demand / utilization load.) SIGNAL
 *   examples only — the validated Thing1 P3 distress kernel remains the sole scoring
 *   authority; the bus merely transports already-scored emissions.
 *
 * Cross-domain examples — OTHER → EDUCATION (education as a target). Education is
 * the HUMAN-CAPITAL / KNOWLEDGE-TRANSMISSION / CREDENTIAL domain (schools &
 * universities — K-12 + higher ed, edtech & online learning, student outcomes &
 * literacy, teaching & curriculum, education funding & access / equity, workforce
 * training & skills, credentialing & enrollment, student debt). It is DISTINCT
 * from science (basic / academic RESEARCH is the science domain — a COUPLING that
 * feeds education but is not its content), from population (demographics is a
 * COUPLING — enrollment cohorts, not education's own content), from technology
 * (edtech TOOLING is a COUPLING that feeds the classroom, NOT education's
 * identity), and from economy (workforce / labor-market MACRO is a COUPLING — the
 * employment pass-through, not the school). And education NEVER takes energy
 * oil/gas/grid as its own content. The bus previously documented education as a
 * SOURCE only — it EMITS to economy / governance / population / technology /
 * culture (education-brain.js emissionRules) — but its INBOUND RETURN paths were
 * silent in the bus, creating the false impression that education is a source-only
 * domain rather than a full bidirectional node. These are the paths other brains
 * already emit toward education (see each source brain's emissionRules / the SOURCE
 * examples above), so the human-capital-health / credential / funding-access /
 * enrollment channel is not silent in the bus:
 *   governance   → education (credentialing_standards_tightening / curriculum_mandate
 *                           / accreditation_pressure → tightening credentialing
 *                           standards, curriculum mandates and accreditation review
 *                           raise compliance burden and program-viability risk →
 *                           accreditation_pressure at institutions; the regulatory-
 *                           authority input to education, the inbound mirror of
 *                           education's native credential / standards outbound —
 *                           credentialing authority remains a COUPLING owned by
 *                           governance, DISTINCT from governance's own public-
 *                           administration content)
 *   finance      → education (funding_squeeze / capex_squeeze / liquidity_constraint
 *                           → tighter capital access, the student-loan debt spiral
 *                           and a cost-of-capital rise pressure institutional
 *                           solvency, endowment draw and tuition-revenue dependence
 *                           → institutional_solvency_stress / funding_squeeze at
 *                           schools; the inbound mirror of finance's native
 *                           credit_spread / liquidity_constraint outbound — student
 *                           debt remains a COUPLING owned by finance)
 *   technology   → education (edtech_disruption / platform_transition_demand →
 *                           edtech & online-learning platform disruption and a
 *                           platform-transition push reshape delivery models and
 *                           force pedagogical-innovation demand → platform_transition
 *                           _demand at institutions; the edtech-tooling coupling that
 *                           feeds the classroom, WITHOUT education taking on chips /
 *                           software as its identity)
 *   population   → education (enrollment_demographic_shift / cohort_composition_change
 *                           → demographic shifts in the school-age and college-age
 *                           cohort and changes in cohort composition shift enrollment
 *                           demand and program mix → enrollment_demographic_shift at
 *                           institutions; the demographic-cohort coupling that drives
 *                           student population, the inbound mirror of education's
 *                           native human-capital outbound — demographics remain a
 *                           COUPLING owned by population)
 *   These modify education's PRIOR human-capital-health / enrollment / funding-access
 *   / credential-viability expectation and stress calculation AFTER the validated
 *   Thing kernel runs — external stress modifiers ingested via the base
 *   receiveExternalSignal handler, NOT a second scorer.
 *   Real education-sector issuers behind these signals (edtech & online learning /
 *   higher-ed & for-profit institutions / workforce training & skills / credentialing
 *   & enrollment — NOT energy oil/gas/grid, NOT science research labs, NOT macro
 *   labor proxies): CHGG (Chegg, edtech / study services); COUR (Coursera, online
 *   learning platform); DUOL (Duolingo, online language learning); LRN (Stride / K12,
 *   online K-12); ATGE (Adtalem, healthcare / professional education); LOPE (Grand
 *   Canyon Education, higher-ed services); STRA (Strategic Education / Strayer, higher
 *   ed); LAUR (Laureate Education, higher ed); TWOU (2U, online-program management);
 *   UTI (Universal Technical Institute, workforce / vocational training).
 *   (accreditation_pressure = credentialing-standards / curriculum-mandate compliance
 *   burden; institutional_solvency_stress = funding-squeeze / endowment-draw / student-
 *   debt-dependence pressure; platform_transition_demand = edtech-disruption / delivery-
 *   model-shift pull; enrollment_demographic_shift = cohort-composition / enrollment-
 *   demand change.) SIGNAL examples only — the validated Thing1 P3 distress kernel
 *   remains the sole scoring authority; the bus merely transports already-scored
 *   emissions.
 *
 * Cross-domain examples — SCIENCE -> OTHER and OTHER -> SCIENCE (science as both
 * source and target). Science is the SCIENTIFIC-RESEARCH / DISCOVERY domain
 * (basic & applied research, R&D pipelines, academic & lab science, peer review
 * & publication, research funding & grants, scientific instruments & methods, the
 * innovation / IP-generation pipeline). DUAL-KEY NOTE: science is the URL / portal
 * key but the bus routes on the RUNTIME snapshot key 'research' (see
 * domain-identity.js — science <-> research), so the emissions below carry
 * sourceDomain/targetDomain 'research' at the bus layer even though the domain
 * identity is "science" (the same dual-key pattern as medicine<->health and
 * trade<->supplyChain). Science is DISTINCT from technology (applied product
 * engineering & commercialization is a COUPLING — foundational discovery feeds it
 * but science owns the bench / basic-discovery side, NOT product dev), from
 * medicine (clinical / pre-clinical translation is a COUPLING — bench research
 * feeds the clinic but science owns the basic-science side, NOT the bedside or the
 * regulated product), and from education (academic TEACHING & curriculum delivery
 * is a COUPLING — research expertise feeds faculty pipelines but science owns
 * discovery, NOT instruction). And science NEVER takes energy oil/gas/grid as its
 * own content. The bus previously had NO science-native OUTBOUND wiring — science
 * appeared only in passing as a TARGET (intelligence -> research declassified
 * findings, lines 189–191; the medicine / education COUPLING notes), leaving the
 * discovery / R&D-pipeline / publication channel largely silent in the bus. These
 * are science's native OUTBOUND paths, mirroring the energy / defense /
 * intelligence SOURCE examples (the rules live in science/research-brain.js
 * emissionRules); science emits these native signals when >=1 active diagnosis is
 * present (per brain cycle):
 *   science -> technology    (innovation_pipeline / IP_generation -> foundational
 *                           discoveries and basic-research output feed applied
 *                           product R&D and patent / IP-filing momentum -> the
 *                           discovery-to-applied-engineering pull, WITHOUT science
 *                           taking on product-engineering identity; the bench-side
 *                           mirror of technology's inbound R&D-funding return below)
 *   science -> medicine      (drug_discovery_acceleration / therapeutic_pipeline ->
 *                           basic-research output (targets, assays, modalities)
 *                           feeds the preclinical and clinical-translation pipeline
 *                           for drug candidates -> the bench-to-bedside pull, the
 *                           basic-science input to the clinic, DISTINCT from
 *                           medicine's own care-delivery / regulated-product content)
 *   science -> education     (pedagogical_evidence_base / human_capital_formation ->
 *                           foundational research and learning-science evidence
 *                           inform STEM curriculum, the evidence base for pedagogy
 *                           and credentialing standards -> the discovery input to
 *                           human-capital formation, DISTINCT from education's own
 *                           teaching-delivery content)
 * These are science's INBOUND RETURN paths (other brains already emit toward
 * science — see each source brain's emissionRules / the SOURCE examples above), so
 * the research-prioritization / funding-momentum / publication-demand channel is
 * not silent in the bus:
 *   technology  -> science   (innovation_funding / R&D_collaboration -> tech-sector
 *                           R&D budgets and corporate-research partnerships flow
 *                           into university research collaborations and basic-
 *                           research grant funding -> research_funding_momentum at
 *                           labs; the inbound mirror of science's innovation_pipeline
 *                           outbound — funding remains a COUPLING owned by technology)
 *   medicine    -> science   (clinical_translation_demand / trial_methodology ->
 *                           therapeutic needs, unmet-disease burden and clinical-
 *                           trial methodology requirements pull research
 *                           prioritization and advance clinical-methodology research
 *                           -> research_prioritization_shift at labs; the inbound
 *                           mirror of science's drug_discovery_acceleration outbound
 *                           — clinical demand remains a COUPLING owned by medicine)
 *   education   -> science   (credentialing_standards_setting / academic_authority ->
 *                           accreditation, university-rank pressure and credentialing
 *                           / tenure standards shape research priorities, publication
 *                           demand and grant-chasing behavior -> publication_demand_
 *                           pressure at institutions; the inbound mirror of science's
 *                           pedagogical_evidence_base outbound — academic authority
 *                           remains a COUPLING owned by education)
 *   These modify science's PRIOR discovery-productivity / R&D-productivity /
 *   funding-momentum expectation and stress calculation AFTER the validated Thing
 *   kernel runs — external stress modifiers ingested via the base
 *   receiveExternalSignal handler, NOT a second scorer.
 *   Real research-sector issuers behind these signals (scientific instruments &
 *   lab equipment / life-science tools & diagnostics / analytical instrumentation /
 *   contract research organizations — NOT energy oil/gas/grid, NOT medicine clinical
 *   care providers, NOT technology product chipmakers): TMO, DHR, A, MTD, WAT
 *   (scientific instruments & analytical / measurement instrumentation); ILMN, BIO,
 *   RVTY, BRKR (life-science tools / sequencing / lab instruments); IQV, ICLR
 *   (clinical / contract research organizations & research analytics). Real research-
 *   authority anchors (REAL, never fabricated): NSF (National Science Foundation
 *   grants), NIH (R01 / basic-research funding), arXiv (preprint / publication
 *   volume), Nature (peer-review / publication authority), OpenAlex (open scholarly
 *   metadata / citation graph), NASA (space & physical-science research). (discovery_
 *   productivity = basic-research output / discovery rate; R&D_productivity = pipeline
 *   conversion of research input to output; publication_volume = peer-reviewed /
 *   preprint throughput; grant_funding_momentum = NSF / NIH funding inflow trajectory;
 *   research_prioritization_shift = clinical / authority-driven agenda reweighting.)
 *   SIGNAL examples only — the validated Thing1 P3 distress kernel remains the sole
 *   scoring authority; the bus merely transports already-scored emissions.
 *
 * Cross-domain examples — LAW → OTHER (law as a source). Law is the JUDICIAL /
 * LEGAL-SYSTEM domain (legal system & courts, judiciary & rule of law, litigation
 * & dispute resolution, regulation & compliance, contracts & enforcement,
 * intellectual-property law, criminal justice, legal services & access to justice).
 * It is DISTINCT from governance (governance = public policy / administration /
 * elections / rulemaking — the EXECUTIVE & LEGISLATIVE side; law is the JUDICIAL
 * system / courts / enforcement / legal-process side, see line 379), from
 * intelligence (FISA / classification authority is a COUPLING that law adjudicates,
 * NOT intelligence collection itself), and from finance (litigation-finance &
 * compliance cost is a COUPLING — the legal-process pass-through, not capital
 * markets). And law NEVER takes energy oil/gas/grid as its own content. The bus
 * previously documented law as a TARGET only — it RECEIVES from governance
 * (policy_conflict_enforcement → law, lines 390–394), communication
 * (speech_regulation_pressure → law, lines 465–470) and medicine
 * (liability_risk_escalation → law, lines 539–543) — but its OUTBOUND emissions were
 * silent in the bus, creating the false impression that law is a target-only domain
 * rather than a full bidirectional SOURCE. These are law's native OUTBOUND paths,
 * mirroring the energy / defense / intelligence / governance SOURCE examples (the
 * rules live in law-brain.js emissionRules); law emits these native signals when >=1
 * active diagnosis is present (law-brain.js diagnoses: JUDICIAL_CRISIS,
 * CONSTITUTIONAL_VIOLATION, REGULATORY_CAPTURE, MASS_INCARCERATION,
 * INTERNATIONAL_LAW_BREAKDOWN; per brain cycle):
 *   law → infrastructure (permitting_delay → litigation, injunctions and judicial
 *                           review of capital projects defer permitting and stall
 *                           construction → capital-project litigation drag on
 *                           infrastructure programs, the legal-process input to the
 *                           build pipeline, DISTINCT from governance's own
 *                           administrative-friction permitting content — here the
 *                           DELAY is a court / injunction / docket-backlog matter, not
 *                           an agency rulemaking one)
 *   law → research        (IP_prosecution_backlog → patent-prosecution congestion,
 *                           IP-litigation pendency and uncertain claim scope slow the
 *                           IP-generation pipeline and chill research commercialization
 *                           → patent-filing / prosecution backlog at labs, the
 *                           legal-process input to the discovery pipeline, DISTINCT
 *                           from science's own discovery content — the patent OFFICE /
 *                           court side, not the bench)
 *   law → technology      (antitrust_enforcement → antitrust action, IP-litigation
 *                           pressure and merger-review / consent-decree exposure
 *                           constrain platform strategy and product / acquisition
 *                           latitude → antitrust & IP-litigation pressure on tech
 *                           issuers, the legal-process input to technology, DISTINCT
 *                           from technology's own product / cyber content)
 *   law → defense         (ITAR_enforcement → export-control adjudication, ITAR /
 *                           arms-control enforcement and export-license dispute
 *                           resolution constrain defense-industrial transfers and
 *                           foreign-military-sales latitude → export-control compliance
 *                           pressure on the defense industrial base, the legal-process
 *                           input to defense, DISTINCT from defense's own kinetic /
 *                           readiness content — the COURT / enforcement side of export
 *                           control, not the weapons system)
 *   law → intelligence    (FISA_constraint → FISA-court adjudication, classification-
 *                           authority disputes and clearance-vetting / surveillance-
 *                           authorization backlog constrain collection latitude →
 *                           legal-authority / FISA-constraint pressure on collection,
 *                           the legal-process input to intelligence, DISTINCT from
 *                           intelligence's own collection content — the COURT /
 *                           authorization side, WITHOUT law taking on collection as its
 *                           identity)
 *   Additional law-native SIGNAL examples surfacing on these paths:
 *   permitting_delay, IP_prosecution_backlog, antitrust_enforcement, ITAR_enforcement,
 *   FISA_constraint, docket_backlog_pressure.
 *   Law binds mostly to INSTITUTIONS & INDICATORS, not single companies — the legal /
 *   rule-of-law indices behind these signals (REAL, never fabricated): US Courts
 *   caseload / docket statistics, ABA (American Bar Association) litigation trends,
 *   DOJ enforcement statistics, SCOTUS docket, World Justice Project Rule-of-Law
 *   Index, judicial-vacancy rates. Where real legal-sector operators are needed
 *   (legal information / litigation analytics / compliance / IP services — NOT energy
 *   oil/gas/grid, NOT governance govtech, NOT intelligence collection operators): RELX
 *   (LexisNexis, legal research & analytics), TRI (Thomson Reuters / Westlaw, legal
 *   information), VERX (Vertex, tax & regulatory compliance), CSGP (CoStar, real-estate
 *   / litigation-adjacent analytics), VRSK (Verisk, risk & litigation analytics).
 *   (permitting_delay = capital-project litigation / injunction / judicial-review
 *   stall; IP_prosecution_backlog = patent-prosecution / IP-litigation pendency
 *   congestion; antitrust_enforcement = antitrust / merger-review / consent-decree
 *   pressure; ITAR_enforcement = export-control / arms-control adjudication burden;
 *   FISA_constraint = FISA-court / classification-authority / clearance-vetting
 *   constraint.) SIGNAL examples only — the validated Thing1 P3 distress kernel remains
 *   the sole scoring authority; the bus merely transports already-scored emissions.
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
