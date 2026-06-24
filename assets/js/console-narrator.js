/**
 * console-narrator.js
 * LIMEN HELIX — Console Voice & Narration Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Produces concise, calm, mission-control-style narration from:
 *   - Feed events (domain stress, escalation shifts)
 *   - Global state transitions
 *   - Biosensor regulation state changes
 *   - Feed reliability degradation
 *
 * Voice modes: silent, analyst, command
 * Uses browser speechSynthesis as local baseline.
 * Structured so premium TTS can be swapped in later.
 *
 * Output: window.LIMENConsoleNarrator
 * Events: limen:narrator-speak (on each narration)
 *
 * Load order: after biosensor-bridge.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────

  var MODES = ['silent', 'analyst', 'command'];
  var SPEAK_COOLDOWN_MS = 8000;     // Min gap between spoken messages
  var MAX_QUEUE = 6;                 // Max pending narrations
  var PRIORITY_HIGH = 3;
  var PRIORITY_MEDIUM = 2;
  var PRIORITY_LOW = 1;
  var SPEAK_TIMEOUT_MS = 15000;     // Safety: reset _speaking if stuck this long

  // ─── State ──────────────────────────────────────────────────────────────

  var _mode = 'analyst';             // Current voice mode
  var _muted = false;                // Global mute
  var _queue = [];                   // Narration queue [{text, priority, timestamp}]
  var _lastSpokeAt = 0;             // Timestamp of last spoken message
  var _speakStartedAt = 0;          // When _speaking was set true (for timeout)
  var _interval = null;
  var _controlEl = null;
  var _synth = null;                 // SpeechSynthesis reference
  var _selectedVoice = null;         // Preferred voice
  var _speaking = false;
  var _lastGlobalMode = null;        // Track global state to only narrate shifts

  // Dedup: prevent same message within 30 seconds
  var _recentMessages = {};          // text → timestamp

  // ─── Voice synthesis abstraction ────────────────────────────────────────
  // This layer can be swapped out for premium TTS (ElevenLabs, etc.)

  var _voiceBackend = {
    type: 'browser',

    init: function () {
      if (typeof window.speechSynthesis === 'undefined') return false;
      _synth = window.speechSynthesis;
      // Pick a good voice once voices are loaded
      _pickVoice();
      if (_synth.onvoiceschanged !== undefined) {
        _synth.onvoiceschanged = _pickVoice;
      }
      return true;
    },

    speak: function (text, onEnd) {
      if (!_synth || _muted || _mode === 'silent') {
        if (onEnd) onEnd();
        return;
      }
      var utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;    // Slightly slow — calm, deliberate
      utt.pitch = 0.95;   // Slightly low — authoritative
      utt.volume = 0.7;   // Not loud — ambient
      if (_selectedVoice) utt.voice = _selectedVoice;
      utt.onend = function () {
        _speaking = false;
        _speakStartedAt = 0;
        if (onEnd) onEnd();
      };
      utt.onerror = function () {
        _speaking = false;
        _speakStartedAt = 0;
        if (onEnd) onEnd();
      };
      _speaking = true;
      _speakStartedAt = Date.now();
      _synth.speak(utt);
    },

    cancel: function () {
      if (_synth) _synth.cancel();
      _speaking = false;
    },

    isSpeaking: function () {
      // Safety timeout: if _speaking has been true for too long, reset it
      // (handles Chrome bug where onend/onerror never fires)
      if (_speaking && _speakStartedAt > 0 && (Date.now() - _speakStartedAt > SPEAK_TIMEOUT_MS)) {
        _speaking = false;
        _speakStartedAt = 0;
        if (_synth) _synth.cancel(); // Clear any stuck utterance
      }
      return _speaking || (_synth && _synth.speaking);
    }
  };

  function _pickVoice() {
    if (!_synth) return;
    var voices = _synth.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer English voices with natural/premium quality
    var preferred = ['Google UK English Female', 'Google US English', 'Samantha',
                     'Karen', 'Daniel', 'Microsoft Zira', 'Microsoft David'];
    for (var p = 0; p < preferred.length; p++) {
      for (var v = 0; v < voices.length; v++) {
        if (voices[v].name.indexOf(preferred[p]) !== -1) {
          _selectedVoice = voices[v];
          return;
        }
      }
    }
    // Fallback: first English voice
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.indexOf('en') === 0) {
        _selectedVoice = voices[i];
        return;
      }
    }
    _selectedVoice = voices[0];
  }

  // ─── Narration generation ───────────────────────────────────────────────

  // Templates per mode
  var TEMPLATES = {
    analyst: {
      escalation_rise:     'Escalation rising. Multiple domains accelerating.',
      escalation_drop:     'Escalation easing. Immediate signals clearing.',
      domain_distress:     '{domain} domain pressure increasing.',
      // Infrastructure-specific distress voice — operational/engineering-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) but for
      // civil infrastructure: grid reliability, deferred maintenance, transport, funding, cyber-physical.
      infra_grid_degradation:    'Grid infrastructure under stress. Transmission and distribution reliability degrading.',
      infra_maintenance_deficit: 'Deferred maintenance accumulating. Asset condition deteriorating across the network.',
      infra_cyber_physical:      'Cyber-physical exposure rising. SCADA and control-system integrity at risk.',
      infra_transport_disruption:'Transport network strained. Roads, bridges, and transit capacity degrading.',
      infra_funding_collapse:    'Capital funding gap widening. Infrastructure investment falling behind need.',
      infra_generic:             'Infrastructure under stress. Public works and capital systems pressured.',
      // Culture-specific distress voice — scene/creator/attention-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure port above, but for cultural systems: virality, creator ecosystems,
      // scene health, fanbase cohesion, discourse/backlash. Maps to culture-brain diagnosisIndex
      // (CULTURAL_ERASURE / HERITAGE_DESTRUCTION / CENSORSHIP / IDENTITY_CRISIS / CREATIVE_STAGNATION).
      culture_viral_collapse:    'Viral momentum collapsing. Trending signals decaying faster than the audience can sustain.',
      culture_creator_burnout:   'Creator ecosystem under strain. Output cadence and artist retention deteriorating.',
      culture_scene_saturation:  'Scene saturating. Discovery crowding out and breakout potential thinning.',
      culture_fanbase_fracture:  'Fanbase cohesion fracturing. Audience attention splintering across tribes.',
      culture_backlash_spiral:   'Backlash spiral forming. Discourse turning adversarial around the movement.',
      culture_generic:           'Cultural domain under stress. Scenes, creators, and audiences pressured.',
      // Finance-specific distress voice — capital-markets/credit/liquidity-grounded,
      // mirrors energy's per-diagnosis narration and the infrastructure/culture ports above,
      // but for financial systems: solvency, credit spreads, margin/collateral, leverage,
      // funding liquidity, counterparty/systemic risk. Maps to the finance domain's distress
      // flavors alongside (never replacing) the validated P3 distress kernel.
      finance_solvency_crisis:       'Solvency under pressure. Capital adequacy and balance-sheet cushion eroding.',
      finance_credit_spread_widening:'Credit spreads widening. Risk premia repricing as default expectations climb.',
      finance_margin_call_pressure:  'Margin pressure building. Collateral calls and haircuts tightening across positions.',
      finance_deleveraging_cascade:  'Deleveraging cascade forming. Forced asset sales feeding back into prices.',
      finance_liquidity_crunch:      'Funding liquidity tightening. Short-term financing and market depth thinning.',
      finance_counterparty_risk:     'Counterparty risk rising. Bilateral exposure and settlement chains under strain.',
      finance_generic:               'Financial domain under stress. Capital, credit, and liquidity pressured.',
      // Economy-specific distress voice — MACRO-AGGREGATE/business-cycle-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance ports above, but for the macroeconomy: GDP & growth,
      // inflation (CPI/PCE), employment & labor markets, consumer & business sentiment,
      // monetary & fiscal policy, the recession/expansion cycle. Maps to economy-node-business-
      // engine fields (M1→Industrial-Production, THAL→GDP, STRI→Consumer-Spending,
      // CBLM→Monetary-Policy, OFC→Price-Formation). Bound to MACRO INDICATORS (FRED series
      // GDPC1/CPIAUCSL/PCEPI/UNRATE/PAYEMS/FEDFUNDS/DGS10/UMCSENT/INDPRO + broad-market proxies
      // SPY/DIA/TLT/GLD), NOT single-company tickers — and DISTINCT from finance (capital markets).
      economy_recession:             'GDP growth stalling. Demand weakness and inventory correction accelerating.',
      economy_inflation:             'Price level surging. CPI and PCE running hot as expectations risk unanchoring.',
      economy_stagflation:           'Stagflation signature forming. Prices climbing while output and growth stall.',
      economy_credit_crunch:         'Credit conditions tightening. Spreads widening and lending standards constricting.',
      economy_policy_error:          'Policy miscalibration risk rising. Rate path and fiscal stance straining confidence.',
      economy_employment_deterioration:'Labor market softening. Jobless claims rising and payroll momentum fading.',
      economy_demand_weakness:       'Aggregate demand weakening. Consumer confidence and business investment pulling back.',
      economy_supply_disruption:     'Supply-side pressure building. Producer prices and input shortages straining output.',
      economy_generic:               'Macroeconomy under stress. Growth, prices, and employment pressured.',
      // Technology-specific distress voice — semiconductors/compute/AI/software/cyber-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy ports above, but for the TECHNOLOGY domain identity:
      // semiconductors & compute (fabs, GPUs/TPUs, wafer supply), AI/ML (training, inference,
      // alignment), software & cloud, hardware & devices, cybersecurity, R&D & innovation pipelines,
      // platform networks, data infrastructure. Maps to technology-brain diagnosisIndex (CYBER_ATTACK /
      // AI_ALIGNMENT_FAILURE / INFRASTRUCTURE_COLLAPSE / DATA_BREACH / CHIP_SHORTAGE / PLATFORM_MONOPOLY).
      // Couples to energy via compute demand but keeps tech identity (chips/AI/software/cyber), and is
      // DISTINCT from finance (fintech is a coupling, not the identity). Real tickers: NVDA, AVGO, AMD,
      // INTC, TSM, ASML, MSFT, GOOGL, META, AMZN, ORCL, CRM, AAPL, PLTR, CRWD, PANW.
      tech_chip_shortage:            'Semiconductor supply tightening. Wafer allocation and foundry capacity falling behind demand.',
      tech_compute_bottleneck:       'Compute capacity constraints rising. GPU/TPU allocation pressure accelerating across training and inference.',
      tech_ai_alignment_failure:     'AI alignment risk rising. Model behavior, autonomy, and bias drift exceeding control margins.',
      tech_cyber_breach:             'Cyber exposure rising. Intrusion, ransomware, and data-exfiltration pressure climbing.',
      tech_platform_monopoly:        'Platform concentration deepening. Lock-in and innovation suppression distorting competition.',
      tech_supply_disruption:        'Hardware supply chain strained. Component scarcity and manufacturing bottlenecks propagating.',
      tech_obsolescence_acceleration:'Obsolescence accelerating. Legacy stacks and aging hardware repricing faster than refresh cycles.',
      tech_breakthrough_emergence:   'Breakthrough signal forming. A capability step-change is reshaping the technology frontier.',
      tech_generic:                  'Technology domain under stress. Compute, software, and platforms pressured.',
      // Defense-specific distress voice — military/procurement/readiness/deterrence-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy/technology ports above, but for the DEFENSE domain
      // identity: military spending & procurement, the defense industrial base, geopolitical conflict
      // & deterrence, weapons systems, military readiness & sustainment, alliances & basing,
      // electronic/kinetic warfare, strategic deterrence. Defense COUPLES to energy via fuel /
      // strategic-reserve and to technology via cyber, but keeps its own kinetic/industrial/readiness
      // identity — and is kept DISTINCT from intelligence (collection/analysis/espionage) and from
      // technology (cyber is a coupling, not the identity). Real tickers: LMT, RTX, NOC, GD, BA, LHX,
      // HII, LDOS, BAH, KTOS, AVAV. CLIENT-SIDE narration flavor only — never touches any scoring path.
      defense_readiness_drop:        'Force readiness declining. Munitions depletion and sustainment gaps widening; review procurement and modernization status.',
      defense_conflict_escalation:   'Conflict escalation detected. Deterrence posture under pressure as geopolitical tension intensifies.',
      defense_industrial_strain:     'Defense industrial base showing capacity strain. Supplier consolidation and throughput limits rising.',
      defense_procurement_breakdown: 'Procurement program under strain. Cost overruns and acquisition delays threatening capability delivery.',
      defense_alliance_fracture:     'Alliance cohesion weakening. Basing access and coalition burden-sharing under strain.',
      defense_kinetic_warfare:       'Kinetic engagement intensifying. Weapons-system attrition and platform loss rates climbing.',
      defense_generic:               'Defense domain under stress. Readiness, procurement, and deterrence pressured.',
      // Intelligence-specific distress voice — collection/analysis/espionage-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy/technology/defense ports above, but for the
      // INTELLIGENCE domain identity: intelligence collection (SIGINT/HUMINT/GEOINT/OSINT),
      // all-source analysis & assessment, espionage & counterintelligence, surveillance &
      // reconnaissance, threat warning, covert action, information & influence operations,
      // security clearance & insider risk. Intelligence COUPLES to defense via threat warning
      // and to technology via cyber tooling, but keeps its own collection/analysis/espionage
      // identity — kept DISTINCT from defense (kinetic/industrial/readiness) and technology
      // (cyber tooling is a coupling, not the identity). Anchored to the five portal diagnosis
      // families: collection_gap, analytical_distortion, oversight_failure, surveillance_excess,
      // counterintelligence_failure, adversarial_penetration. Real tickers: PLTR, BAH, LDOS,
      // CACI, SAIC, KBR, VRNT, NICE, VRSK. CLIENT-SIDE narration flavor only — never touches scoring.
      intel_collection_gap:            'Collection coverage degrading. SIGINT, HUMINT, and GEOINT gaps widening against priority targets.',
      intel_analytical_distortion:     'Analytical integrity under strain. Assessment bias, politicization, and confidence drift rising across all-source product.',
      intel_oversight_failure:         'Oversight controls weakening. Authorization, audit, and accountability gaps exposing the collection enterprise.',
      intel_surveillance_excess:       'Surveillance footprint overreaching. Domestic and bulk-collection exposure exceeding warrant and minimization limits.',
      intel_counterintelligence_failure:'Counterintelligence breach forming. Insider risk, mole exposure, and clearance compromise threatening sources and methods.',
      intel_adversarial_penetration:   'Adversary penetration rising. Foreign interference, cyber espionage, and network intrusion compromising the collection perimeter.',
      intel_generic:                   'Intelligence domain under stress. Collection, analysis, and counterintelligence pressured.',
      // Trade-specific distress voice — international-trade/logistics/supply-chain-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) and the
      // infrastructure/culture/finance/economy/technology/defense/intelligence ports above, but for
      // the TRADE domain identity (runtime key 'supplyChain'): international trade & commerce,
      // exports/imports, tariffs & trade policy, shipping & logistics, supply chains, trade balance,
      // customs, trade agreements, sanctions/embargoes, freight & ports/chokepoints. Trade COUPLES to
      // economy via the trade balance and to defense via sanctions/chokepoints, but keeps its own
      // flow/freight/customs identity — kept DISTINCT from economy (macro aggregate) and industry
      // (production). Real trade/logistics tickers: FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY,
      // DSDVY, ODFL. CLIENT-SIDE narration flavor only — never touches any scoring path.
      trade_tariff_shock:          'Tariff shock propagating. Duty escalation and trade-policy reversals repricing import costs across lanes.',
      trade_port_blockade:         'Port throughput collapsing. Berth congestion and chokepoint disruption stranding container volume.',
      trade_supply_collapse:       'Supply chain fracturing. Sourcing breaks and lead-time blowouts cascading through the network.',
      trade_shipping_crisis:       'Freight markets dislocating. Ocean and ground capacity tightening as rates and dwell times spike.',
      trade_trade_war:             'Trade war escalating. Retaliatory barriers and bloc realignment fragmenting cross-border flow.',
      trade_customs_disruption:    'Customs clearance degrading. Inspection backlogs and compliance friction stalling border movement.',
      trade_sanctions_impact:      'Sanctions regime tightening. Embargo exposure and de-risking severing trade corridors.',
      trade_generic:               'Trade domain under stress. Flows, freight, and supply chains pressured.',
      // Industry-specific distress voice — manufacturing/industrial-production-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: OIL_SHOCK /
      // GRID_COLLAPSE) and the infrastructure/culture/finance/economy/technology/defense/
      // intelligence/trade ports above, but for the INDUSTRY domain identity: manufacturing &
      // industrial production, factory output & capacity utilization, automation & robotics,
      // heavy industry & capital goods, industrial supply chains, machinery & equipment,
      // industrial maintenance. Industry uses PRODUCTION-SYSTEM FAILURES as the analogous
      // diagnosis classes (manufacturing capacity collapse / automation failure / labor-market
      // deterioration / supply-chain production halt / industrial recession / input-cost shock /
      // equipment-failure cascade), tied to MANUFACTURING INDICES (PMI, ISM, capacity utilization
      // TCU, equipment downtime). Real industrial tickers: CAT, DE, GE, HON, MMM, EMR, ITW, ETN,
      // PH, ROK, DOV, GEV. Industry COUPLES to technology via automation/robotics but keeps its
      // own production/factory/equipment identity — kept DISTINCT from trade (logistics/commerce),
      // economy (macro aggregate), and technology (automation is a coupling, not the identity).
      industry_manufacturing_capacity_collapse:'Manufacturing capacity collapsing. Plant utilization and factory output falling below sustainable thresholds.',
      industry_automation_failure_escalation:  'Automation systems failing. Robotics and control-line faults cascading across the production floor.',
      industry_labor_market_deterioration:     'Industrial labor base eroding. Skilled-trade shortages and workforce attrition stalling production lines.',
      industry_supply_chain_production_halt:   'Production halting on input starvation. Component and material shortfalls stopping the assembly line.',
      industry_industrial_recession:           'Industrial recession deepening. New orders, PMI, and capital-goods demand contracting across heavy industry.',
      industry_input_cost_shock:               'Input cost shock propagating. Raw-material and energy prices compressing manufacturing margins.',
      industry_equipment_failure_cascade:      'Equipment failure cascade forming. Machinery breakdowns and maintenance backlog driving unplanned downtime.',
      industry_generic:                        'Industrial domain under stress. Manufacturing, capacity, and equipment pressured.',
      // Environment-specific distress voice — climate/pollution/ecosystem-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: OIL_SHOCK /
      // GRID_COLLAPSE) and the infrastructure/culture/finance/economy/technology/defense/
      // intelligence/trade/industry ports above, but for the ENVIRONMENT domain identity:
      // climate & emissions, air/water/soil pollution & quality, ecosystems & biodiversity,
      // natural resources & conservation, environmental regulation & compliance, climate risk &
      // adaptation, waste management & remediation, carbon markets. Environment COUPLES to energy
      // via emissions/carbon and to agriculture via land/water use, but keeps its own climate/
      // pollution/ecosystem identity — kept DISTINCT from energy (oil/gas/grid/power-generation)
      // and agriculture (land/water use = coupling). Real environmental-sector tickers: WM, RSG,
      // WCN, CWST, AWK, WTRG, XYL, ECL, LIN, APD, DAR, AY.
      env_emissions_spike:       'Emissions trajectory accelerating. Carbon and greenhouse-gas output outpacing decarbonization and carbon-market signals.',
      env_biodiversity_collapse: 'Ecosystem integrity failing. Biodiversity loss and habitat destruction crossing irreversible thresholds.',
      env_water_stress:          'Water systems under stress. Scarcity, drought, and contamination degrading supply and quality.',
      env_regulatory_tightening: 'Environmental regulation tightening. Emission limits, permits, and compliance enforcement intensifying.',
      env_remediation_backlog:   'Remediation backlog accumulating. Contaminated sites and waste streams outrunning cleanup capacity.',
      env_pollution_event:       'Pollution load rising. Air, water, and soil quality degrading as contaminant exposure climbs.',
      env_generic:               'Environmental domain under stress. Climate, ecosystems, and pollution pressured.',
      // Governance-specific distress voice — institutions/policy/rule-of-law-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: GRID_STRESS /
      // SUPPLY_SHOCK / CRUDE_SPIKE) and the infrastructure/culture/finance/economy/technology/
      // defense/intelligence/trade/industry/environment ports above, but for the GOVERNANCE domain
      // identity: government & public administration, public policy & rulemaking, regulation &
      // oversight, elections & democratic institutions, public finance & budgets, rule of law &
      // institutional integrity, public services delivery, political stability & legitimacy.
      // Maps to governance-brain diagnosisIndex (CONSTITUTIONAL_CRISIS / REGIME_INSTABILITY /
      // POLICY_FAILURE / CORRUPTION_SCANDAL / DIPLOMATIC_BREAKDOWN / MILITARY_OVERREACH). Governance
      // vocabulary: institutional erosion, policy gridlock, legitimacy crisis, regulatory capture,
      // fiscal-governance stress, electoral instability, corruption surge, separation-of-powers
      // tension, legislative stalemate, executive overreach, institutional credibility shock,
      // policy-enforcement failure, public-trust collapse. Bound to INSTITUTIONS & INDICES — World
      // Bank WGI, V-Dem, OECD, GAO, CBO, Federal Register, Congress.gov — not single companies; where
      // entities are needed, real govtech/public-sector identifiers (TYL Tyler Technologies, MMS
      // Maximus, BAH, LDOS, ACN, GDIT). Kept DISTINCT from economy (macro), finance (capital), law
      // (judicial/legal-system), and intelligence. CLIENT-SIDE narration flavor only — never scoring.
      gov_constitutional_crisis:   'Constitutional stress rising. Separation-of-powers tension detected across legislative and executive coordination.',
      gov_regime_instability:      'Political stability eroding. Electoral instability and legitimacy crisis widening across institutions.',
      gov_policy_failure:          'Policy coherence breaking down. Legislative stalemate and policy-enforcement failure compounding.',
      gov_corruption_scandal:      'Corruption surge detected. Institutional integrity and public-trust collapse accelerating.',
      gov_regulatory_capture:      'Regulatory capture deepening. Oversight independence and rulemaking integrity degrading.',
      gov_diplomatic_breakdown:    'Diplomatic coordination failing. Treaty commitments and international institutional credibility under strain.',
      gov_fiscal_governance_stress:'Fiscal-governance stress rising. Budget gridlock and public-finance credibility deteriorating.',
      gov_institutional_credibility_shock:'Institutional credibility shock forming. Public trust and rule-of-law confidence falling sharply.',
      gov_generic:                 'Governance domain under stress. Institutions, policy, and public trust pressured.',
      // Agriculture-specific distress voice — farming/crops/livestock/food-production-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: OIL_SHOCK /
      // GRID_COLLAPSE) and the infrastructure/culture/finance/economy/technology/defense/
      // intelligence/trade/industry/environment/governance ports above, but for the AGRICULTURE
      // domain identity: farming & crops, livestock & animal protein, agribusiness & food
      // production, food security & supply, fertilizers & crop inputs, irrigation & agricultural
      // water, commodity crops (corn/soy/wheat), agricultural technology & precision ag, farm
      // economics. Agriculture COUPLES to energy via biofuel/fertilizer-energy, to environment
      // via land/water/climate, to trade via export logistics, and to economy via food prices —
      // but keeps its own crop/livestock/farm-margin/input identity, kept DISTINCT from each of
      // those couplings. Bound to AG COMMODITIES & USDA refs — CBOT corn/soy/wheat, USDA WASDE —
      // and real agriculture tickers: ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG, INGR, AGCO, FMC.
      // CLIENT-SIDE narration flavor only — never touches any scoring path.
      agr_crop_failure:            'Crop failure spreading. Yield collapse and harvest loss compressing farm output across key growing regions.',
      agr_drought_stress:          'Crop stress rising. Drought and fertilizer costs compressing yields and farm margins.',
      agr_livestock_disease:       'Livestock herds under threat. Animal-disease outbreak and culling pressure thinning protein supply.',
      agr_fertilizer_cost_spike:   'Crop-input costs surging. Fertilizer and nutrient prices squeezing planting economics and farm margins.',
      agr_food_price_surge:        'Food supply tightening. WASDE balance-sheet drawdowns pushing commodity-crop prices higher.',
      agr_harvest_shortfall:       'Harvest shortfall forming. CBOT corn, soy, and wheat carryout falling below planted-acre expectations.',
      agr_export_ban:              'Grain export access closing. Origin-country bans and trade barriers stranding commodity-crop supply.',
      agr_commodity_crash:         'Crop prices collapsing. Oversupply and demand weakness driving CBOT grain markets below cost of production.',
      agr_input_supply_disruption: 'Crop-input supply breaking. Seed, fertilizer, and chemical shortfalls disrupting the planting cycle.',
      agr_water_stress:            'Irrigation water tightening. Aquifer drawdown and allocation cuts stressing acreage and crop survival.',
      agr_soil_degradation:        'Soil productivity eroding. Nutrient depletion and land degradation thinning long-run yield potential.',
      agr_generic:                 'Agriculture domain under stress. Crops, livestock, and farm economics pressured.',
      // Education-specific distress voice — schools/universities/student-outcomes-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: OIL_SHOCK /
      // GRID_COLLAPSE) and the infrastructure/culture/finance/economy/technology/defense/
      // intelligence/trade/industry/environment/governance/agriculture ports above, but for the
      // EDUCATION domain identity: schools & universities (K-12 + higher ed), edtech & online
      // learning, student outcomes & literacy, teaching & curriculum, education funding &
      // access/equity, workforce training & skills, credentialing & enrollment, student debt.
      // Education distress lexicon: enrollment-decline shock (birth-rate / out-migration loss,
      // higher-ed demand decay), learning-loss crisis (assessment-score regression, cohort-outcome
      // deterioration), teacher-shortage crisis (burnout exodus, wage lag), funding-cut cascade
      // (state budget cuts, federal-aid reduction, tuition dependency), achievement-gap widening
      // (poverty-correlation, equity-access erosion), student-debt crisis (loan-default spike,
      // income-driven-repayment strain), skills-mismatch labor-pipeline misalignment. Real
      // education-sector tickers: CHGG, COUR, DUOL, LRN, ATGE, LOPE, STRA, LAUR, TWOU, UTI.
      // Education COUPLES to science (research), population (demographics), technology (edtech
      // tooling), and economy (workforce) but keeps its own school/student/teacher/curriculum
      // identity — kept DISTINCT from each of those couplings. CLIENT-SIDE narration flavor only —
      // never touches any scoring path.
      education_enrollment_collapse:'Student enrollment contracting. Birth-rate decline and family out-migration shrinking classroom demand.',
      education_learning_loss:      'Learning-loss accumulation. Assessment scores and achievement trajectories deteriorating across grade cohorts.',
      education_teacher_exodus:     'Teacher workforce eroding. Burnout and alternative-career flight thinning instructional capacity.',
      education_funding_crisis:     'Education funding under stress. State budget cuts and federal-aid dependency creating capital squeeze.',
      education_achievement_gap:    'Achievement gap widening. Poverty correlation and equity-access erosion deepening outcome disparities.',
      education_debt_spiral:        'Student-debt crisis deepening. Loan-default rates climbing as income-driven repayment strains borrower capacity.',
      education_skills_mismatch:    'Skills-pipeline misalignment. Employer demand and credential output diverging across the workforce.',
      education_generic:            'Education domain under stress. Schools, students, and teaching pressured.',
      // Population-specific distress voice — demographics/migration/aging/labor-supply/household-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: OIL_SHOCK / GRID_COLLAPSE)
      // and the infrastructure/culture/finance/economy/technology/defense/intelligence/trade/industry/
      // environment/governance/agriculture/education ports above, but for the POPULATION/DEMOGRAPHIC
      // domain identity: demographics & population dynamics, migration & immigration, urbanization &
      // settlement, fertility & mortality, aging & generational shifts, labor force & human-capital
      // supply, household formation & housing demand, social structure & inequality. Bound to REAL
      // DEMOGRAPHIC SOURCES — US Census / ACS, UN World Population Prospects (WPP), Pew Research, BLS
      // labor-force series (CPS), CDC natality/mortality — NOT single companies; where demographic-
      // exposed entities are needed, real proxies (WELL, VTR senior-living REITs; housing/migration-
      // exposed names). Population COUPLES to economy (labor MARKET), medicine (mortality/health),
      // education (enrollment), and governance, but keeps its own demographics/migration/aging/household
      // identity and stays DISTINCT from each of those couplings. CLIENT-SIDE narration flavor only —
      // never touches any scoring path.
      population_demographic_collapse:'Population trajectory inverting. Birth rates and fertility declining below replacement; demographic cliff forming.',
      population_aging_crisis:        'Population aging sharply. Working-age-population declining; old-age dependency spiking and pension/healthcare system strain rising.',
      population_migration_surge:     'Migration inflows accelerating. Displaced-person and climate-migration volume spiking; resettlement and social-integration capacity overwhelmed.',
      population_labor_shortage:      'Prime-age employment eroding. Labor-force participation falling and skill-gap widening; working-age capacity insufficient for demand.',
      population_urbanization_strain: 'Urban systems overloading. Megacity growth outpacing infrastructure; slums expanding and housing unaffordability spiking.',
      population_depopulation:        'Regional population loss accelerating. Rural exodus and out-migration sustained; shrinking-city dynamics threatening regional viability.',
      population_housing_crisis:      'Housing-affordability collapse deepening. Mortgage/rent burden exceeding household capacity; household-formation stalling and homelessness risk rising.',
      population_generic:             'Population domain under stress. Demographics, migration, aging and labor-force pressured.',
      // Science-specific distress voice — scientific-research/discovery/R&D-pipeline/peer-review-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex: OIL_SHOCK / GRID_COLLAPSE)
      // and the infrastructure/culture/finance/economy/technology/defense/intelligence/trade/industry/
      // environment/governance/education/population ports above, but for the SCIENCE domain identity
      // (runtime key 'research' — science<->research dual-naming via domain-identity.js): scientific
      // research & discovery, basic & applied research, R&D pipelines, academic & lab science, peer
      // review & publication, research funding & grants, scientific instruments & methods, the
      // innovation pipeline. Science distress lexicon: replication crisis (reproducibility failure,
      // p-hacking, retraction wave), funding cut (appropriations decline, grant-budget contraction),
      // research fraud (data fabrication, misconduct, paper-mill), brain drain (researcher exodus,
      // postdoc attrition, STEM-PhD flight), discovery stagnation (citation decay, productivity
      // slowdown, idea exhaustion), grant shortfall (NIH/NSF success-rate collapse, proposal rejection),
      // lab-capacity strain (instrument backlog, core-facility overload, equipment shortage). Bound to
      // REAL RESEARCH AUTHORITIES — NSF (science & engineering indicators), NIH (grant success rate,
      // appropriations), arXiv / Nature (publication volume, retraction), OpenAlex (citation trajectory),
      // NASA (STEM-PhD supply) — and real research-sector tickers: TMO (Thermo Fisher), DHR (Danaher),
      // A (Agilent), MTD (Mettler-Toledo), WAT (Waters), ILMN (Illumina), BIO (Bio-Rad), RVTY (Revvity),
      // BRKR (Bruker), IQV (IQVIA). Science COUPLES to technology (applied product dev), medicine
      // (clinical research), and education (academic teaching) but keeps its own discovery/peer-review/
      // grant/lab-instrument identity and stays DISTINCT from each of those couplings. CLIENT-SIDE
      // narration flavor only — never touches any scoring path.
      science_replication_crisis:   'Replication crisis deepening. Reproducibility failures and retraction waves eroding confidence across the published literature.',
      science_funding_cut:          'Research funding contracting. NSF and NIH appropriations decline cutting into basic and applied science capacity.',
      science_research_fraud:       'Research integrity breach detected. Data fabrication, misconduct, and paper-mill activity compromising the evidence base.',
      science_brain_drain:          'Research talent draining. Postdoc attrition and STEM-PhD flight thinning the scientific workforce.',
      science_discovery_stagnation: 'Discovery productivity stalling. Citation trajectories and breakthrough cadence decaying across the research frontier.',
      science_grant_shortfall:      'Grant pipeline tightening. NIH and NSF success rates collapsing as proposal rejection rates climb.',
      science_lab_capacity_strain:  'Lab capacity overloading. Instrument backlog and core-facility demand outpacing scientific throughput.',
      science_generic:              'Science domain under stress. Research, discovery, and funding pressured.',
      global_shift:        'Global state shifted to {state}.',
      event_start:         '{event} detected.',
      event_end:           '{event} resolved.',
      feed_hydrated:       'Feeds online. System active.',
      feed_degradation:    'Feed reliability degraded. Falling back to inferred signals.',
      feed_recovery:       'Feed connectivity restored.',
      regulation_calm:     'User state: calm. System nominal.',
      regulation_focused:  'User state: focused.',
      regulation_pressured:'User state: pressured. Consider pacing.',
      regulation_overloaded:'User state: overloaded. Reducing information density.',
      regulation_recovering:'System stabilizing. Pressure is easing.'
    },
    command: {
      escalation_rise:     'Escalation. Multiple domains active. Review immediately.',
      escalation_drop:     'Escalation cleared. Resume monitoring.',
      domain_distress:     '{domain} elevated. Investigate.',
      infra_grid_degradation:    'Grid reliability degrading. Inspect transmission and distribution.',
      infra_maintenance_deficit: 'Maintenance backlog critical. Prioritize asset repair.',
      infra_cyber_physical:      'Cyber-physical threat. Harden SCADA and control systems.',
      infra_transport_disruption:'Transport disruption. Assess roads, bridges, transit.',
      infra_funding_collapse:    'Funding gap critical. Secure infrastructure capital.',
      infra_generic:             'Infrastructure elevated. Investigate public works.',
      culture_viral_collapse:    'Viral momentum collapsing. Reassess release timing and audience pull.',
      culture_creator_burnout:   'Creator strain critical. Protect output cadence and artist retention.',
      culture_scene_saturation:  'Scene saturated. Find differentiation or a fresh lane.',
      culture_fanbase_fracture:  'Fanbase fracturing. Re-anchor the core audience.',
      culture_backlash_spiral:   'Backlash spiral. Manage discourse before it compounds.',
      culture_generic:           'Cultural domain elevated. Investigate scenes and creators.',
      finance_solvency_crisis:       'Solvency stress. Shore up capital and balance-sheet cushion.',
      finance_credit_spread_widening:'Spreads widening. Reprice credit risk and hedge exposure.',
      finance_margin_call_pressure:  'Margin pressure. Manage collateral and reduce leverage.',
      finance_deleveraging_cascade:  'Deleveraging cascade. Contain forced selling and protect liquidity.',
      finance_liquidity_crunch:      'Liquidity crunch. Secure funding lines and preserve cash.',
      finance_counterparty_risk:     'Counterparty risk. Review exposures and settlement chains.',
      finance_generic:               'Financial domain elevated. Investigate capital and credit.',
      economy_recession:             'Growth stalling. Demand collapse. Cut capex and preserve cash.',
      economy_inflation:             'Inflation surging. Hedge price risk and reprice contracts.',
      economy_stagflation:           'Stagflation. Prices up, output down. Protect margins and liquidity.',
      economy_credit_crunch:         'Credit crunch. Lock funding lines before they close.',
      economy_policy_error:          'Policy risk. Reposition for rate and fiscal shifts.',
      economy_employment_deterioration:'Labor weakening. Plan for slower demand and hiring freezes.',
      economy_demand_weakness:       'Demand weak. Defer expansion and conserve capital.',
      economy_supply_disruption:     'Supply shock. Secure inputs and rebuild inventory buffers.',
      economy_generic:               'Macroeconomy elevated. Investigate growth and prices.',
      tech_chip_shortage:            'Chip shortage. Secure wafer allocation and qualify second-source foundries.',
      tech_compute_bottleneck:       'Compute shortage. Secure cloud quota and optimize inference efficiency.',
      tech_ai_alignment_failure:     'AI alignment failure. Halt autonomy escalation and tighten model guardrails.',
      tech_cyber_breach:             'Cyber breach. Contain intrusion, rotate credentials, and harden the perimeter.',
      tech_platform_monopoly:        'Platform lock-in. Diversify dependencies and reduce single-vendor exposure.',
      tech_supply_disruption:        'Hardware supply shock. Pre-buy components and rebuild inventory buffers.',
      tech_obsolescence_acceleration:'Stack obsolescing. Accelerate migration and retire legacy hardware.',
      tech_breakthrough_emergence:   'Breakthrough emerging. Reprioritize R&D and move on the capability lead.',
      tech_generic:                  'Technology domain elevated. Investigate compute and platforms.',
      defense_readiness_drop:        'Readiness degrading. Replenish munitions and accelerate sustainment and modernization.',
      defense_conflict_escalation:   'Conflict escalating. Reinforce deterrence posture and review force positioning.',
      defense_industrial_strain:     'Industrial base strained. Expand supplier capacity and secure critical components.',
      defense_procurement_breakdown: 'Procurement breaking down. Recover program cost and schedule before capability slips.',
      defense_alliance_fracture:     'Alliance fracturing. Shore up basing access and coalition commitments.',
      defense_kinetic_warfare:       'Kinetic conflict active. Sustain platforms and manage attrition and resupply.',
      defense_generic:               'Defense domain elevated. Investigate readiness and procurement.',
      intel_collection_gap:            'Collection gap. Retask SIGINT/HUMINT/GEOINT and close coverage against priority targets; review PLTR/BAH tasking posture.',
      intel_analytical_distortion:     'Analytic distortion. Re-run alternative analysis, strip bias, and recalibrate confidence before dissemination.',
      intel_oversight_failure:         'Oversight failure. Restore authorization, audit trail, and accountability across the collection enterprise.',
      intel_surveillance_excess:       'Surveillance overreach. Enforce minimization and warrant limits; pull back bulk collection now.',
      intel_counterintelligence_failure:'Counterintelligence breach. Lock down sources and methods, freeze clearances, and hunt the insider.',
      intel_adversarial_penetration:   'Adversary penetration. Contain foreign intrusion and harden countermeasures; check LDOS/CACI/SAIC perimeter posture.',
      intel_generic:                   'Intelligence domain elevated. Investigate collection and counterintelligence.',
      trade_tariff_shock:          'Tariff shock. Reprice landed cost and re-route sourcing around the duty hit.',
      trade_port_blockade:         'Port blockade. Divert to alternate gateways and clear stranded container volume.',
      trade_supply_collapse:       'Supply chain breaking. Qualify second-source suppliers and rebuild buffer stock.',
      trade_shipping_crisis:       'Freight crisis. Lock capacity contracts and hedge rate and dwell-time exposure.',
      trade_trade_war:             'Trade war active. Realign trade lanes and exploit tariff-exempt corridors.',
      trade_customs_disruption:    'Customs disruption. Pre-clear shipments and tighten documentation compliance.',
      trade_sanctions_impact:      'Sanctions impact. Screen counterparties and exit embargoed corridors now.',
      trade_generic:               'Trade domain elevated. Investigate flows and supply chains.',
      industry_manufacturing_capacity_collapse:'Capacity collapsing. Idle plants and consolidate output to the most efficient lines.',
      industry_automation_failure_escalation:  'Automation failing. Fail over to manual lines and isolate faulting robotics cells.',
      industry_labor_market_deterioration:     'Labor base eroding. Cross-train, automate critical stations, and protect skilled trades.',
      industry_supply_chain_production_halt:   'Line halting on inputs. Qualify second-source materials and rebuild buffer stock now.',
      industry_industrial_recession:           'Industrial recession. Orders contracting. Cut capex and protect cash and capacity.',
      industry_input_cost_shock:               'Input cost shock. Hedge raw materials and reprice contracts to defend margin.',
      industry_equipment_failure_cascade:      'Equipment failing. Trigger predictive maintenance and pre-stage critical spares.',
      industry_generic:                        'Industrial domain elevated. Investigate manufacturing and capacity.',
      env_emissions_spike:       'Emissions surging. Cut carbon intensity and secure offsets or carbon-market allowances.',
      env_biodiversity_collapse: 'Ecosystem collapsing. Halt habitat loss and protect remaining biodiversity now.',
      env_water_stress:          'Water stress critical. Secure supply, treat contamination, and ration demand.',
      env_regulatory_tightening: 'Regulation tightening. Close compliance gaps and prepare for stricter emission limits.',
      env_remediation_backlog:   'Remediation backlog critical. Prioritize cleanup and expand waste-processing capacity.',
      env_pollution_event:       'Pollution event. Contain the source and mitigate air, water, and soil exposure.',
      env_generic:               'Environmental domain elevated. Investigate climate and ecosystems.',
      gov_constitutional_crisis:   'Constitutional crisis. Restore separation-of-powers coordination across legislative and executive branches.',
      gov_regime_instability:      'Regime instability. Stabilize legitimacy and contain electoral and institutional disruption.',
      gov_policy_failure:          'Policy failure. Break the legislative stalemate and restore enforcement coherence.',
      gov_corruption_scandal:      'Corruption scandal. Contain integrity breach and rebuild public trust now.',
      gov_regulatory_capture:      'Regulatory capture. Restore oversight independence and rulemaking integrity.',
      gov_diplomatic_breakdown:    'Diplomatic breakdown. Re-anchor treaty commitments and international credibility.',
      gov_fiscal_governance_stress:'Fiscal-governance stress. Resolve budget gridlock and shore up public-finance credibility.',
      gov_institutional_credibility_shock:'Credibility shock. Reinforce rule-of-law confidence and public trust immediately.',
      gov_generic:                 'Governance domain elevated. Investigate institutions and policy.',
      agr_crop_failure:            'Crop failure. Secure emergency input supply and liquidation pricing support.',
      agr_drought_stress:          'Drought stress. Shift to drought-tolerant varieties and lock irrigation allocations.',
      agr_livestock_disease:       'Livestock disease. Quarantine herds, contain spread, and secure protein supply (TSN).',
      agr_fertilizer_cost_spike:   'Fertilizer spike. Pre-buy nutrients (NTR/MOS/CF) and hedge input costs before planting.',
      agr_food_price_surge:        'Food prices surging. Lock forward grain contracts and review WASDE supply outlook.',
      agr_harvest_shortfall:       'Harvest shortfall. Reprice CBOT positions and secure carryout against demand.',
      agr_export_ban:              'Export ban. Re-route grain flows and exploit open origin corridors now.',
      agr_commodity_crash:         'Commodity crash. Hedge CBOT downside and defer marginal-acre planting.',
      agr_input_supply_disruption: 'Input supply break. Qualify second-source seed and fertilizer; rebuild buffer stock.',
      agr_water_stress:            'Water stress critical. Ration irrigation, prioritize high-value acreage, and secure rights.',
      agr_soil_degradation:        'Soil degrading. Rotate crops, restore nutrients, and protect long-run yield base.',
      agr_generic:                 'Agriculture domain elevated. Investigate crops and farm economics.',
      education_enrollment_collapse:'Enrollment contracting. Stabilize K-12 / higher-ed recruitment and retain proven cohorts; adjust capacity and staffing.',
      education_learning_loss:      'Learning loss critical. Deploy intensive-intervention instruction and close achievement gaps before further backslide.',
      education_teacher_exodus:     'Teacher shortage crisis. Expand recruitment, retention raises, and alternative-certification pipelines immediately.',
      education_funding_crisis:     'Funding gap critical. Secure tuition, endowment utilization, and federal-aid maximization before program cuts.',
      education_achievement_gap:    'Achievement gap critical. Target equity funding and intervention resources to the highest-need cohorts now.',
      education_debt_spiral:        'Student debt crisis. Establish income-driven-repayment hardship programs and accelerate public-service-loan-forgiveness.',
      education_skills_mismatch:    'Skills mismatch. Realign curriculum and credentials to employer demand and expand workforce-training pipelines.',
      education_generic:            'Education domain elevated. Investigate schools and student outcomes.',
      population_demographic_collapse:'Demographic cliff forming. Plan for sub-replacement fertility; cushion the shrinking workforce and tax base.',
      population_aging_crisis:        'Aging crisis. Old-age dependency spiking. Shore up pension/healthcare capacity and senior-living supply (WELL/VTR).',
      population_migration_surge:     'Migration surge. Resettlement capacity overwhelmed. Scale integration, housing, and services intake now.',
      population_labor_shortage:      'Labor shortage. Participation falling and skills gap widening. Expand pipelines, automate, and re-skill.',
      population_urbanization_strain: 'Urban strain critical. Growth outpacing infrastructure. Expand housing supply and transit capacity.',
      population_depopulation:        'Depopulation accelerating. Rural exodus sustained. Stabilize regional services and stem out-migration.',
      population_housing_crisis:      'Housing crisis. Affordability collapsing. Unlock supply, ease formation barriers, and contain homelessness risk.',
      population_generic:             'Population domain elevated. Investigate demographics and labor-force.',
      science_replication_crisis:   'Replication crisis. Mandate pre-registration and independent reproduction before citing affected findings.',
      science_funding_cut:          'Funding cut. Diversify grant sources and protect core research lines (TMO/DHR instrument spend) before program loss.',
      science_research_fraud:       'Research fraud. Freeze affected studies, audit data integrity, and refer misconduct now.',
      science_brain_drain:          'Brain drain. Retain postdocs and STEM-PhDs with funding and pipeline incentives before the workforce thins.',
      science_discovery_stagnation: 'Discovery stagnating. Reprioritize high-risk research and track OpenAlex citation trajectory for renewal.',
      science_grant_shortfall:      'Grant shortfall. Lock NIH/NSF submissions to highest-yield calls and secure bridge funding now.',
      science_lab_capacity_strain:  'Lab capacity strain. Expand core-facility throughput and pre-stage critical instruments (A/MTD/WAT/ILMN/BRKR).',
      science_generic:              'Science domain elevated. Investigate research and funding.',
      global_shift:        'State change: {state}.',
      event_start:         'Event: {event}. Tracking.',
      event_end:           'Event cleared: {event}.',
      feed_hydrated:       'Feeds online. Monitoring.',
      feed_degradation:    'Feed degraded. Confidence reduced.',
      feed_recovery:       'Feeds restored.',
      regulation_calm:     'Operator nominal.',
      regulation_focused:  'Operator focused.',
      regulation_pressured:'Operator pressured. Manage load.',
      regulation_overloaded:'Operator overloaded. Reduce exposure.',
      regulation_recovering:'Operator recovering. Stabilizing.'
    }
  };

  function _template(key, vars) {
    var templates = TEMPLATES[_mode] || TEMPLATES.analyst;
    var text = templates[key];
    if (!text) return null;
    if (vars) {
      for (var k in vars) {
        text = text.replace('{' + k + '}', vars[k]);
      }
    }
    return text;
  }

  // ─── Narration queueing ─────────────────────────────────────────────────

  function _narrate(key, vars, priority) {
    if (_mode === 'silent') return;

    var text = _template(key, vars);
    if (!text) return;

    // Dedup check
    var now = Date.now();
    if (_recentMessages[text] && (now - _recentMessages[text]) < 30000) return;
    _recentMessages[text] = now;

    // Prune old dedup entries
    for (var msg in _recentMessages) {
      if (now - _recentMessages[msg] > 60000) delete _recentMessages[msg];
    }

    _queue.push({
      text: text,
      priority: priority || PRIORITY_MEDIUM,
      timestamp: now
    });

    // Sort by priority (high first), then by timestamp (oldest first)
    _queue.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    // Enforce max queue
    while (_queue.length > MAX_QUEUE) _queue.pop();

    // Emit event for UI/logging
    _dispatch('limen:narrator-speak', { text: text, priority: priority, mode: _mode });
  }

  // ─── Queue processor ────────────────────────────────────────────────────

  function _processQueue() {
    if (_mode === 'silent' || _muted) return;
    if (_voiceBackend.isSpeaking()) return;
    if (_queue.length === 0) return;

    var now = Date.now();
    if (now - _lastSpokeAt < SPEAK_COOLDOWN_MS) return;

    var item = _queue.shift();
    if (!item) return;

    // Skip stale messages (older than 30 seconds)
    if (now - item.timestamp > 30000) {
      _processQueue(); // Try next
      return;
    }

    _lastSpokeAt = now;
    var _safeText = item.text;
    if (window.LIMENResponseSafety) _safeText = window.LIMENResponseSafety.sanitize(_safeText, 'narrator');
    _voiceBackend.speak(_safeText, function () {
      // After speaking, try next in queue
      setTimeout(_processQueue, 500);
    });
  }

  // ─── Event listeners ────────────────────────────────────────────────────

  function _onEscalationShift(e) {
    var detail = e.detail;
    if (!detail) return;
    if (detail.direction === 'escalating') {
      _narrate('escalation_rise', {}, PRIORITY_HIGH);
    } else if (detail.direction === 'deescalating') {
      _narrate('escalation_drop', {}, PRIORITY_MEDIUM);
    }
  }

  function _onDomainDistress(e) {
    var detail = e.detail;
    if (!detail || !detail.domain) return;
    var NAMES = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply chain', infrastructure: 'Infrastructure',
      culture: 'Culture', finance: 'Finance', defense: 'Defense',
      intelligence: 'Intelligence', industry: 'Industry', governance: 'Governance',
      education: 'Education', population: 'Population'
    };

    // Infrastructure parity: mirror energy's per-diagnosis voice. Energy distinguishes
    // OIL_SHOCK / GRID_COLLAPSE etc via its diagnosisIndex; here we classify the civil
    // distress flavor from the emitted signal content and narrate an infrastructure-
    // specific line instead of the generic '{domain} domain pressure increasing'.
    if (detail.domain === 'infrastructure') {
      var key = _classifyInfraDistress(detail.signals);
      if (key) {
        _narrate(key, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Culture parity: mirror energy's per-diagnosis voice the same way infrastructure does.
    // Culture distinguishes viral collapse / creator burnout / scene saturation / fanbase
    // fracture / backlash via culture-brain diagnosisIndex; classify the cultural distress
    // flavor from signal content and narrate a culture-specific line instead of the generic.
    if (detail.domain === 'culture') {
      var ckey = _classifyCultureDistress(detail.signals);
      if (ckey) {
        _narrate(ckey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Finance parity: mirror energy's per-diagnosis voice the same way infrastructure and
    // culture do. This is the CLIENT-SIDE narration flavor only — it never touches the
    // validated P3 distress kernel (Thing1) or any scoring path. Classify the financial
    // distress flavor from signal content (solvency / spreads / margin / deleveraging /
    // liquidity / counterparty) and narrate a finance-specific line instead of the generic.
    if (detail.domain === 'finance') {
      var fkey = _classifyFinanceDistress(detail.signals);
      if (fkey) {
        _narrate(fkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Economy parity: mirror energy's per-diagnosis voice the same way infrastructure,
    // culture, and finance do. Economy is the MACRO AGGREGATE — classify the macroeconomic
    // distress flavor from signal content (recession / inflation / stagflation / credit crunch /
    // policy error / employment deterioration / demand weakness / supply disruption) and narrate
    // an economy-specific line instead of the generic. This is CLIENT-SIDE narration flavor only,
    // bound to MACRO INDICATORS (FRED series + broad-market proxies), kept DISTINCT from finance.
    if (detail.domain === 'economy') {
      var ekey = _classifyEconomyDistress(detail.signals);
      if (ekey) {
        _narrate(ekey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Technology parity: mirror energy's per-diagnosis voice the same way infrastructure,
    // culture, finance, and economy do. Technology distinguishes chip shortage / compute
    // bottleneck / AI alignment failure / cyber breach / platform monopoly / supply disruption /
    // obsolescence / breakthrough via technology-brain diagnosisIndex (CYBER_ATTACK /
    // AI_ALIGNMENT_FAILURE / INFRASTRUCTURE_COLLAPSE / DATA_BREACH / CHIP_SHORTAGE /
    // PLATFORM_MONOPOLY). Classify the tech distress flavor from signal content and narrate a
    // technology-specific line instead of the generic. CLIENT-SIDE narration flavor only.
    if (detail.domain === 'technology') {
      var tkey = _classifyTechnologyDistress(detail.signals);
      if (tkey) {
        _narrate(tkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Defense parity: mirror energy's per-diagnosis voice the same way infrastructure, culture,
    // finance, economy, and technology do. Defense is the KINETIC/INDUSTRIAL/READINESS identity —
    // classify the defense distress flavor from signal content (force readiness / conflict
    // escalation / industrial-base strain / procurement breakdown / alliance fracture / kinetic
    // warfare) and narrate a defense-specific line instead of the generic. Kept DISTINCT from
    // intelligence (collection/analysis/espionage) and technology (cyber is a coupling). This is
    // CLIENT-SIDE narration flavor only — it never touches any scoring path.
    if (detail.domain === 'defense') {
      var dkey = _classifyDefenseDistress(detail.signals);
      if (dkey) {
        _narrate(dkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Intelligence parity: mirror energy's per-diagnosis voice the same way infrastructure,
    // culture, finance, economy, technology, and defense do. Intelligence is the COLLECTION/
    // ANALYSIS/ESPIONAGE identity — classify the intelligence distress flavor from signal
    // content (collection gap / analytical distortion / oversight failure / surveillance excess /
    // counterintelligence failure / adversarial penetration) and narrate an intelligence-specific
    // line instead of the generic. Kept DISTINCT from defense (kinetic/industrial/readiness) and
    // technology (cyber tooling is a coupling, not the identity). CLIENT-SIDE narration flavor only.
    if (detail.domain === 'intelligence') {
      var ikey = _classifyIntelligenceDistress(detail.signals);
      if (ikey) {
        _narrate(ikey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Trade parity: mirror energy's per-diagnosis voice the same way infrastructure, culture,
    // finance, economy, technology, defense, and intelligence do. Trade is the FLOW/FREIGHT/
    // CUSTOMS identity and uses the RUNTIME KEY 'supplyChain' (trade<->supplyChain dual-naming via
    // domain-identity.js) — classify the trade distress flavor from signal content (tariff /
    // sanctions / port / freight / chokepoint / export / customs / shipping / container / blockade /
    // embargo) and narrate a trade-specific line instead of the generic. Kept DISTINCT from economy
    // (macro aggregate) and industry (production). CLIENT-SIDE narration flavor only — never touches
    // any scoring path.
    if (detail.domain === 'supplyChain') {
      var tradekey = _classifyTradeDistress(detail.signals);
      if (tradekey) {
        _narrate(tradekey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Industry parity: mirror energy's per-diagnosis voice the same way infrastructure, culture,
    // finance, economy, technology, defense, intelligence, and trade do. Industry is the
    // MANUFACTURING/PRODUCTION/EQUIPMENT identity — classify the industrial distress flavor from
    // signal content (manufacturing capacity collapse / automation failure / labor-market
    // deterioration / supply-chain production halt / industrial recession / input-cost shock /
    // equipment-failure cascade) and narrate an industry-specific line instead of the generic.
    // Kept DISTINCT from trade (logistics/commerce), economy (macro aggregate), and technology
    // (automation is a coupling). CLIENT-SIDE narration flavor only — never touches any scoring path.
    if (detail.domain === 'industry') {
      var indkey = _classifyIndustryDistress(detail.signals);
      if (indkey) {
        _narrate(indkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Environment parity: mirror energy's per-diagnosis voice the same way infrastructure, culture,
    // finance, economy, technology, defense, intelligence, trade, and industry do. Environment is the
    // CLIMATE/POLLUTION/ECOSYSTEMS identity — classify the environmental distress flavor from signal
    // content (emissions/carbon spike / biodiversity & ecosystem collapse / water scarcity & quality /
    // environmental regulatory tightening / waste & remediation backlog) and narrate an environment-
    // specific line instead of the generic. Environment COUPLES to energy via emissions/carbon and to
    // agriculture via land/water use, but keeps its own climate/pollution/ecosystem identity — kept
    // DISTINCT from energy (oil/gas/grid/power-generation) and agriculture (land/water use = coupling).
    // Real environmental-sector tickers: WM, RSG, WCN, CWST, AWK, WTRG, XYL, ECL, LIN, APD, DAR, AY.
    // CLIENT-SIDE narration flavor only — never touches any scoring path.
    if (detail.domain === 'environment') {
      var envkey = _classifyEnvironmentDistress(detail.signals);
      if (envkey) {
        _narrate(envkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Governance parity: mirror energy's per-diagnosis voice the same way infrastructure, culture,
    // finance, economy, technology, defense, intelligence, trade, industry, and environment do.
    // Governance is the INSTITUTIONS/POLICY/RULE-OF-LAW identity — classify the governance distress
    // flavor from signal content (constitutional crisis / regime instability / policy failure /
    // corruption scandal / regulatory capture / diplomatic breakdown / fiscal-governance stress /
    // institutional credibility shock) and narrate a governance-specific line instead of the generic.
    // Governance binds mostly to INSTITUTIONS & INDICES (World Bank WGI, V-Dem, OECD, GAO, CBO,
    // Federal Register, Congress.gov), not single companies; where entities are needed, real govtech
    // identifiers (TYL, MMS, BAH, LDOS, ACN, GDIT). Kept DISTINCT from economy (macro), finance
    // (capital), law (judicial/legal-system), and intelligence. CLIENT-SIDE narration flavor only.
    if (detail.domain === 'governance') {
      var govkey = _classifyGovernanceDistress(detail.signals);
      if (govkey) {
        _narrate(govkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Education parity: mirror energy's per-diagnosis voice for the EDUCATION domain identity
    // (K-12 + higher ed, edtech/online learning, student outcomes/literacy, teaching/curriculum,
    // funding/access/equity, workforce training/skills, credentialing/enrollment, student debt).
    // Classify the education distress flavor from the emitted signal content and narrate an
    // education-specific line instead of the generic '{domain} domain pressure increasing'.
    if (detail.domain === 'education') {
      var edukey = _classifyEducationDistress(detail.signals);
      if (edukey) {
        _narrate(edukey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Population parity: mirror energy's per-diagnosis voice for the POPULATION/DEMOGRAPHIC domain
    // identity (demographics & population dynamics, migration & immigration, urbanization & settlement,
    // fertility & mortality, aging & generational shifts, labor-force & human-capital supply, household
    // formation & housing demand, social structure & inequality). Classify the demographic distress
    // flavor from signal content (demographic collapse / aging crisis / migration surge / labor shortage /
    // urbanization strain / depopulation / housing crisis) and narrate a population-specific line instead
    // of the generic '{domain} domain pressure increasing'. Bound to REAL DEMOGRAPHIC SOURCES (US Census/
    // ACS, UN WPP, Pew, BLS/CPS, CDC) and real proxies (WELL/VTR senior-living REITs; housing/migration-
    // exposed names), kept DISTINCT from economy (labor MARKET = coupling), medicine (mortality/health =
    // coupling), education (enrollment = coupling), and governance. CLIENT-SIDE narration flavor only.
    if (detail.domain === 'population') {
      var popkey = _classifyPopulationDistress(detail.signals);
      if (popkey) {
        _narrate(popkey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    // Science parity: mirror energy's per-diagnosis voice the same way the domains above do, for the
    // SCIENCE domain identity (scientific research & discovery, basic & applied research, R&D pipelines,
    // academic & lab science, peer review & publication, research funding & grants, scientific
    // instruments & methods, innovation pipeline). Science uses the RUNTIME KEY 'research' (science<->
    // research dual-naming via domain-identity.js), so the dispatch checks 'research'. Classify the
    // scientific distress flavor from signal content (replication crisis / funding cut / research fraud /
    // brain drain / discovery stagnation / grant shortfall / lab-capacity strain) and narrate a science-
    // specific line instead of the generic '{domain} domain pressure increasing'. Bound to real research
    // authorities (NSF, NIH, arXiv, Nature, OpenAlex, NASA) and real research-sector tickers (TMO, DHR,
    // A, MTD, WAT, ILMN, BIO, RVTY, BRKR, IQV); kept DISTINCT from technology (applied product dev =
    // coupling), medicine (clinical research = coupling), and education (academic teaching = coupling).
    // CLIENT-SIDE narration flavor only — never touches any scoring path.
    if (detail.domain === 'research') {
      var scikey = _classifyScienceDistress(detail.signals);
      if (scikey) {
        _narrate(scikey, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    _narrate('domain_distress', { domain: NAMES[detail.domain] || detail.domain }, PRIORITY_MEDIUM);
  }

  // Map raw infrastructure signal content → a civil distress voice key.
  // Civil vocabulary mirrors infrastructure-brain diagnosisIndex (GRID_DEGRADATION /
  // MAINTENANCE_DEFICIT / CYBER_PHYSICAL_ATTACK / TRANSPORTATION_DISRUPTION /
  // INFRA_FUNDING_COLLAPSE). Translates energy oil/gas/nuclear content to civil
  // grid/transport/water/funding equivalents. Returns a TEMPLATES key, or null.
  function _classifyInfraDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: cyber-physical and funding are sharpest, then transport,
    // grid, maintenance; fall back to a generic infrastructure line.
    if (/cyber|scada|sabotage|control[\s_-]?system|ics\b/.test(blob)) return 'infra_cyber_physical';
    if (/fund|fiscal|budget|bond|capex|capital|grant/.test(blob))      return 'infra_funding_collapse';
    if (/bridge|road|transit|transport|port|congestion|last[\s_-]?mile|modal/.test(blob)) return 'infra_transport_disruption';
    if (/grid|transmission|distribution|substation|transformer|reserve[\s_-]?margin|utility|reliability/.test(blob)) return 'infra_grid_degradation';
    if (/maintenance|deferred|deterioration|inspection|asset[\s_-]?condition|aging|backlog/.test(blob)) return 'infra_maintenance_deficit';
    return 'infra_generic';
  }

  // Map raw culture signal content → a cultural distress voice key.
  // Cultural vocabulary mirrors culture-brain diagnosisIndex (CULTURAL_ERASURE /
  // HERITAGE_DESTRUCTION / CENSORSHIP / IDENTITY_CRISIS / CREATIVE_STAGNATION) expressed
  // in the music/creator/attention-economy identity: virality, creator ecosystems, scene
  // health, fanbase cohesion, discourse/backlash. Translates energy oil/gas/grid content to
  // cultural equivalents. Returns a TEMPLATES key, or null.
  function _classifyCultureDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: backlash and viral collapse are sharpest, then fanbase fracture,
    // creator burnout, scene saturation; fall back to a generic culture line.
    if (/backlash|cancel|cancellation|outrage|controversy|discourse|pile[\s_-]?on/.test(blob)) return 'culture_backlash_spiral';
    if (/viral|trending|trend|breakout|momentum|hype|algorithm|reach[\s_-]?collapse/.test(blob)) return 'culture_viral_collapse';
    if (/fanbase|fandom|audience[\s_-]?(fracture|split)|tribal|tribe|fragmentation|defection|churn/.test(blob)) return 'culture_fanbase_fracture';
    if (/creator|artist|burnout|cadence|output|retention|exodus|attrition|stagnation/.test(blob)) return 'culture_creator_burnout';
    if (/scene|saturation|saturat|crowd|oversupply|genre[\s_-]?fatigue|discovery|attention/.test(blob)) return 'culture_scene_saturation';
    return 'culture_generic';
  }

  // Map raw finance signal content → a financial distress voice key.
  // Financial vocabulary covers the finance domain identity: capital markets, credit &
  // lending, banking, liquidity & solvency, investment & funding, M&A, payments & fintech,
  // corporate distress & default, and systemic financial risk. This is the narration flavor
  // ONLY — it sits alongside, and never alters, the validated P3 distress kernel (Thing1) or
  // any scoring path consumed by /api/limen/score. Translates energy oil/gas/grid content to
  // financial equivalents. Returns a TEMPLATES key, or null.
  function _classifyFinanceDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: solvency/default and credit spreads are sharpest, then margin/
    // collateral, deleveraging, counterparty, funding liquidity; fall back to a generic
    // finance line. Mirrors the energy/infra/culture classifier structure exactly.
    if (/solvency|insolvent|default|bankrupt|covenant|capital[\s_-]?adequacy|write[\s_-]?down|impairment/.test(blob)) return 'finance_solvency_crisis';
    if (/credit[\s_-]?spread|spread[\s_-]?widen|cds\b|yield|risk[\s_-]?premi|downgrade|rating/.test(blob)) return 'finance_credit_spread_widening';
    if (/margin[\s_-]?call|margin|collateral|haircut|repo|rehypothec/.test(blob)) return 'finance_margin_call_pressure';
    if (/delever|deleverag|forced[\s_-]?sale|fire[\s_-]?sale|unwind|liquidation[\s_-]?cascade|contagion/.test(blob)) return 'finance_deleveraging_cascade';
    if (/counterparty|settlement|bilateral|clearing|systemic|interbank/.test(blob)) return 'finance_counterparty_risk';
    if (/liquidity|funding|cash[\s_-]?crunch|market[\s_-]?depth|illiquid|run\b|withdrawal/.test(blob)) return 'finance_liquidity_crunch';
    return 'finance_generic';
  }

  // Map raw macro signal content → a macroeconomic distress voice key.
  // Macro vocabulary covers the ECONOMY domain identity: GDP & growth, inflation (CPI/PCE),
  // employment & labor markets, consumer & business sentiment, fiscal & monetary policy
  // (central banks, interest rates), the recession/expansion business cycle, trade, productivity,
  // money supply. Bound to REAL MACRO INDICATORS — FRED series ids (GDP, GDPC1, CPIAUCSL, PCEPI,
  // UNRATE, PAYEMS, FEDFUNDS, DGS10, UMCSENT, INDPRO) and broad-market proxies (SPY, DIA, TLT,
  // GLD) — NOT single-company tickers. This is the narration flavor ONLY and is kept DISTINCT
  // from finance (capital markets / credit / banks). Returns a TEMPLATES key, or null.
  function _classifyEconomyDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: stagflation (the joint price+output signature) first so it isn't
    // masked by a lone inflation or recession token; then credit crunch, inflation, recession,
    // employment, supply, policy, demand; fall back to a generic macro line. Mirrors the
    // energy/infra/culture/finance classifier structure exactly. Matches FRED-series shorthand
    // (cpiaucsl/pcepi/unrate/payems/fedfunds/dgs10/umcsent/indpro/gdpc1) alongside plain words.
    if (/stagflation|(stagnant|stalling|contracting).*(inflation|price)|(inflation|price).*(stagnant|stalling|contracting)/.test(blob)) return 'economy_stagflation';
    if (/credit[\s_-]?crunch|lending[\s_-]?(standard|tighten)|refinanc|spread[\s_-]?widen|tight(er|ening)?[\s_-]?credit|dgs10/.test(blob)) return 'economy_credit_crunch';
    if (/inflation|cpi|cpiaucsl|pce(pi)?|wage[\s_-]?price|price[\s_-]?(surge|level)|expectations[\s_-]?unanchor|deflation/.test(blob)) return 'economy_inflation';
    if (/recession|gdp|gdpc1|contraction|downturn|negative[\s_-]?growth|inventory[\s_-]?correction|indpro|industrial[\s_-]?production/.test(blob)) return 'economy_recession';
    if (/unemploy|unrate|jobless|payems|payroll|labor[\s_-]?(force|market)|layoff|hiring[\s_-]?freeze|wage[\s_-]?stagnation/.test(blob)) return 'economy_employment_deterioration';
    if (/supply[\s_-]?(chain|disruption|shock)|producer[\s_-]?price|ppi\b|input[\s_-]?shortage|bottleneck/.test(blob)) return 'economy_supply_disruption';
    if (/policy|fedfunds|fed[\s_-]?funds|rate[\s_-]?(hike|cut|miscalibrat|path)|central[\s_-]?bank|fiscal[\s_-]?cliff|monetary/.test(blob)) return 'economy_policy_error';
    if (/demand[\s_-]?weak|consumer[\s_-]?(confidence|sentiment)|umcsent|capex[\s_-]?(pause|pullback)|investment[\s_-]?pullback|business[\s_-]?sentiment/.test(blob)) return 'economy_demand_weakness';
    return 'economy_generic';
  }

  // Map raw technology signal content → a technology distress voice key.
  // Tech vocabulary covers the TECHNOLOGY domain identity: semiconductors & compute (fabs, GPUs/
  // TPUs, wafer/foundry supply), AI/ML (training, inference, alignment, autonomy), software & cloud,
  // hardware & devices, cybersecurity, R&D & innovation pipelines, platform networks, data
  // infrastructure. Maps to technology-brain diagnosisIndex (CYBER_ATTACK / AI_ALIGNMENT_FAILURE /
  // INFRASTRUCTURE_COLLAPSE / DATA_BREACH / CHIP_SHORTAGE / PLATFORM_MONOPOLY) plus emergence/
  // obsolescence flavors. Recognizes real tech tickers (NVDA, AVGO, AMD, INTC, TSM, ASML, MSFT,
  // GOOGL, META, AMZN, ORCL, CRM, AAPL, PLTR, CRWD, PANW). Technology COUPLES to energy via compute
  // demand but keeps its own identity (chips/AI/software/cyber) and stays DISTINCT from finance.
  // This is the narration flavor ONLY — it never touches any scoring path. Returns a TEMPLATES key.
  function _classifyTechnologyDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: AI alignment and cyber/data breach are sharpest, then chip shortage,
    // compute bottleneck, platform monopoly, supply disruption, breakthrough emergence,
    // obsolescence; fall back to a generic technology line. Mirrors the energy/infra/culture/
    // finance/economy classifier structure exactly. Matches real tech tickers alongside plain words.
    if (/ai[\s_-]?(alignment|safety|misalign)|alignment[\s_-]?(failure|gap|risk)|autonomy[\s_-]?(overreach|escalat)|bias[\s_-]?amplif|model[\s_-]?(drift|behavior)|rogue[\s_-]?(model|agent)/.test(blob)) return 'tech_ai_alignment_failure';
    if (/cyber|breach|ransomware|intrusion|exfiltrat|credential[\s_-]?compromise|data[\s_-]?(breach|leak)|privacy[\s_-]?exposure|crwd|panw|zero[\s_-]?day|malware|phishing/.test(blob)) return 'tech_cyber_breach';
    if (/chip|semiconductor|wafer|foundry|fab\b|node[\s_-]?(shrink|process)|tsm|asml|nvda|avgo|amd|intc|lithography/.test(blob)) return 'tech_chip_shortage';
    if (/compute|gpu|tpu|accelerator|training[\s_-]?(run|cluster)|inference|cloud[\s_-]?(quota|capacity)|datacenter[\s_-]?(constraint|capacity)|fly\b/.test(blob)) return 'tech_compute_bottleneck';
    if (/platform|monopoly|lock[\s_-]?in|antitrust|market[\s_-]?concentration|app[\s_-]?store|gatekeeper|googl|meta\b|amzn|aapl|msft/.test(blob)) return 'tech_platform_monopoly';
    if (/supply[\s_-]?(chain|disruption|shock|constraint)|component[\s_-]?(scarcity|shortage)|manufacturing[\s_-]?bottleneck|hardware[\s_-]?supply|logistics|export[\s_-]?control/.test(blob)) return 'tech_supply_disruption';
    if (/breakthrough|emergence|step[\s_-]?change|frontier[\s_-]?(model|capab)|state[\s_-]?of[\s_-]?the[\s_-]?art|capability[\s_-]?(leap|jump)|innovation[\s_-]?surge|paradigm[\s_-]?shift/.test(blob)) return 'tech_breakthrough_emergence';
    if (/obsolesc|legacy[\s_-]?(stack|system|hardware)|deprecat|end[\s_-]?of[\s_-]?life|aging[\s_-]?(hardware|infra)|technical[\s_-]?debt|refresh[\s_-]?cycle|stagnant[\s_-]?stack/.test(blob)) return 'tech_obsolescence_acceleration';
    return 'tech_generic';
  }

  // Map raw defense signal content → a defense distress voice key.
  // Defense vocabulary covers the DEFENSE domain identity: military spending & procurement,
  // the defense industrial base, geopolitical conflict & deterrence, weapons systems, military
  // readiness & sustainment, alliances & basing, electronic/kinetic warfare, strategic deterrence.
  // Recognizes real defense primes/suppliers as tickers (LMT, RTX, NOC, GD, BA, LHX, HII, LDOS,
  // BAH, KTOS, AVAV). Defense COUPLES to energy via fuel/strategic-reserve and to technology via
  // cyber, but keeps its own kinetic/industrial/readiness identity and stays DISTINCT from
  // intelligence (collection/analysis/espionage) and technology (cyber = coupling). Mirrors the
  // energy/infra/culture/finance/economy/technology classifier structure exactly. Returns a
  // TEMPLATES key, or null. CLIENT-SIDE narration flavor only — never touches any scoring path.
  function _classifyDefenseDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: active kinetic warfare and conflict escalation are sharpest, then
    // readiness, procurement, industrial-base strain, alliance fracture; fall back to a generic
    // defense line. Matches real defense tickers (lmt/rtx/noc/gd/lhx/hii/ldos/bah/ktos/avav) and
    // 'ba' as a word-boundary token to avoid colliding with substrings.
    if (/kinetic|missile[\s_-]?(strike|barrage)|airstrike|attrition|platform[\s_-]?loss|combat[\s_-]?loss|weapons[\s_-]?expenditure|live[\s_-]?fire|engagement[\s_-]?rate/.test(blob)) return 'defense_kinetic_warfare';
    if (/conflict[\s_-]?(escalat|outbreak)|escalation|deterrence|war[\s_-]?(risk|footing)|geopolitical|invasion|mobiliz|theater[\s_-]?tension|flashpoint|nuclear[\s_-]?posture/.test(blob)) return 'defense_conflict_escalation';
    if (/readiness|munition|sustainment|stockpile[\s_-]?(depletion|draw)|maintenance[\s_-]?backlog|operational[\s_-]?tempo|optempo|fleet[\s_-]?availability|spares[\s_-]?shortage|modernization[\s_-]?gap/.test(blob)) return 'defense_readiness_drop';
    if (/procurement|acquisition|cost[\s_-]?overrun|program[\s_-]?(cancel|delay|breach)|nunn[\s_-]?mccurdy|schedule[\s_-]?slip|contract[\s_-]?award|budget[\s_-]?cut|sequester/.test(blob)) return 'defense_procurement_breakdown';
    if (/industrial[\s_-]?base|supplier[\s_-]?(consolidat|capacity)|shipyard|foundry[\s_-]?(closure|strain)|sub[\s_-]?tier|capacity[\s_-]?strain|throughput[\s_-]?limit|lmt|rtx|noc|gd\b|lhx|hii|ldos|bah|ktos|avav/.test(blob)) return 'defense_industrial_strain';
    if (/alliance|nato|coalition|basing|access[\s_-]?(denial|loss)|burden[\s_-]?sharing|treaty|allied[\s_-]?(withdrawal|fracture)|partner[\s_-]?nation/.test(blob)) return 'defense_alliance_fracture';
    return 'defense_generic';
  }

  // Map raw intelligence signal content → an intelligence distress voice key.
  // Intelligence vocabulary covers the INTELLIGENCE domain identity: intelligence collection
  // (SIGINT/HUMINT/GEOINT/OSINT/MASINT), all-source analysis & assessment, espionage &
  // counterintelligence, surveillance & reconnaissance (ISR), threat warning & indications,
  // covert action, information & influence operations, security clearance & insider risk.
  // Anchored to the five portal diagnosis families (collection_gap / analytical_distortion /
  // oversight_failure / surveillance_excess + trust_boundary_breach / network_intrusion +
  // counterintelligence). Recognizes real intel-sector tickers (PLTR, BAH, LDOS, CACI, SAIC,
  // KBR, VRNT, NICE, VRSK). Intelligence COUPLES to defense via threat warning and to technology
  // via cyber tooling, but keeps its own collection/analysis/espionage identity and stays DISTINCT
  // from defense (kinetic/industrial/readiness) and technology (cyber tooling = coupling). Mirrors
  // the energy/infra/culture/finance/economy/technology/defense classifier structure exactly.
  // Returns a TEMPLATES key, or null. CLIENT-SIDE narration flavor only — never touches scoring.
  function _classifyIntelligenceDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: counterintelligence breach and adversarial penetration are sharpest
    // (sources/methods + foreign penetration), then surveillance overreach, oversight failure,
    // analytical distortion, collection gap; fall back to a generic intelligence line. Matches
    // real intel-sector tickers (pltr/bah/ldos/caci/saic/kbr/vrnt/nice/vrsk) alongside plain words,
    // with word boundaries on short tokens to avoid substring collisions.
    if (/counterintelligence|counter[\s_-]?intel|mole|insider[\s_-]?(threat|risk)|sources[\s_-]?and[\s_-]?methods|clearance[\s_-]?(compromise|breach)|defector|double[\s_-]?agent|leak[\s_-]?investigation|whistleblower[\s_-]?exposure/.test(blob)) return 'intel_counterintelligence_failure';
    if (/foreign[\s_-]?(interference|influence)|cyber[\s_-]?espionage|network[\s_-]?intrusion|adversary[\s_-]?penetration|hostile[\s_-]?service|exfiltrat|implant|supply[\s_-]?chain[\s_-]?compromise|nation[\s_-]?state[\s_-]?actor|trust[\s_-]?boundary/.test(blob)) return 'intel_adversarial_penetration';
    if (/surveillance[\s_-]?(excess|overreach|scandal)|bulk[\s_-]?collection|mass[\s_-]?surveillance|domestic[\s_-]?(spying|collection)|warrantless|minimization|fisa|privacy[\s_-]?(violation|overreach)|fourth[\s_-]?amendment/.test(blob)) return 'intel_surveillance_excess';
    if (/oversight[\s_-]?(failure|gap)|authorization[\s_-]?gap|accountability|audit[\s_-]?(gap|failure)|congressional[\s_-]?oversight|inspector[\s_-]?general|unauthorized[\s_-]?(access|collection)|legal[\s_-]?authority/.test(blob)) return 'intel_oversight_failure';
    if (/analyt|assessment[\s_-]?(bias|distortion)|politiciz|confidence[\s_-]?(drift|inflation)|cognitive[\s_-]?bias|groupthink|intelligence[\s_-]?(failure|surprise)|warning[\s_-]?failure|estimate[\s_-]?error|pltr|vrnt|nice|vrsk/.test(blob)) return 'intel_analytical_distortion';
    if (/collection[\s_-]?(gap|shortfall)|sigint|humint|geoint|osint|masint|isr\b|coverage[\s_-]?gap|source[\s_-]?(loss|recruitment)|reconnaissance|tasking|denied[\s_-]?area|bah|ldos|caci|saic|kbr/.test(blob)) return 'intel_collection_gap';
    return 'intel_generic';
  }

  // Map raw trade signal content → a trade distress voice key.
  // Trade vocabulary covers the TRADE domain identity (runtime key 'supplyChain'): international
  // trade & commerce, exports/imports, tariffs & trade policy, shipping & logistics, supply chains,
  // trade balance, customs, trade agreements, sanctions/embargoes, freight & ports/chokepoints.
  // Recognizes real trade/logistics tickers (FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY,
  // DSDVY, ODFL). Trade COUPLES to economy via the trade balance and to defense via sanctions/
  // chokepoints, but keeps its own flow/freight/customs identity and stays DISTINCT from economy
  // (macro aggregate) and industry (production). Mirrors the energy/infra/culture/finance/economy/
  // technology/defense/intelligence classifier structure exactly. Returns a TEMPLATES key, or null.
  // CLIENT-SIDE narration flavor only — never touches any scoring path.
  function _classifyTradeDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: sanctions/embargo and trade war are sharpest (policy/geopolitical),
    // then tariff shock, port blockade, customs disruption, shipping crisis, supply collapse;
    // fall back to a generic trade line. Matches real trade/logistics tickers (fdx/ups/expd/chrw/
    // zim/matx/xpo/gxo/amkby/dsdvy/odfl) alongside plain words, with word boundaries on short tokens.
    if (/sanction|embargo|de[\s_-]?risk|export[\s_-]?control|entity[\s_-]?list|trade[\s_-]?ban|corridor[\s_-]?(sever|cut)|counterparty[\s_-]?screen/.test(blob)) return 'trade_sanctions_impact';
    if (/trade[\s_-]?war|retaliat|trade[\s_-]?barrier|protectionism|bloc[\s_-]?realign|decoupling|trade[\s_-]?dispute|wto\b/.test(blob)) return 'trade_trade_war';
    if (/tariff|duty|duties|customs[\s_-]?duty|import[\s_-]?(cost|levy)|antidump|countervail|landed[\s_-]?cost/.test(blob)) return 'trade_tariff_shock';
    if (/port|berth|chokepoint|canal|strait|blockade|terminal[\s_-]?congestion|dwell[\s_-]?time|harbor|zim|matx|amkby/.test(blob)) return 'trade_port_blockade';
    if (/customs|clearance|border[\s_-]?(delay|inspection)|broker|documentation|compliance[\s_-]?friction|inspection[\s_-]?backlog|origin[\s_-]?rule/.test(blob)) return 'trade_customs_disruption';
    if (/freight|shipping|ocean[\s_-]?(rate|carrier)|container[\s_-]?(rate|rate)|drayage|trucking|logistics|fdx|ups\b|expd|chrw|xpo|gxo|odfl|dsdvy|capacity[\s_-]?crunch/.test(blob)) return 'trade_shipping_crisis';
    if (/supply[\s_-]?(chain|collapse|break|disruption)|sourcing|lead[\s_-]?time|stockout|inventory[\s_-]?(shortfall|gap)|supplier[\s_-]?(loss|failure)|reshoring|nearshoring|bullwhip|container\b/.test(blob)) return 'trade_supply_collapse';
    return 'trade_generic';
  }

  // Map raw industry signal content → an industrial distress voice key.
  // Industry vocabulary covers the INDUSTRY domain identity: manufacturing & industrial
  // production, factory output & capacity utilization, automation & robotics, heavy industry &
  // capital goods, industrial supply chains, machinery & equipment, industrial maintenance.
  // Uses PRODUCTION-SYSTEM FAILURES as the analogous diagnosis classes (mirroring energy's
  // OIL_SHOCK/GRID_COLLAPSE per-diagnosis split) tied to MANUFACTURING INDICES (PMI, ISM,
  // capacity utilization / TCU, equipment downtime). Recognizes real industrial tickers (CAT,
  // DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV). Industry COUPLES to technology via
  // automation/robotics but keeps its own production/factory/equipment identity and stays
  // DISTINCT from trade (logistics/commerce), economy (macro aggregate), and technology
  // (automation = coupling). Mirrors the energy/infra/culture/finance/economy/technology/
  // defense/intelligence/trade classifier structure exactly. Returns a TEMPLATES key, or null.
  // CLIENT-SIDE narration flavor only — never touches any scoring path.
  function _classifyIndustryDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: automation-failure and equipment-failure cascade are sharpest
    // (production-floor faults), then production-halt (input starvation), capacity collapse,
    // input-cost shock, labor-market deterioration, industrial recession; fall back to a generic
    // industry line. Matches real industrial tickers (cat/de/ge/hon/mmm/emr/itw/etn/ph/rok/dov/
    // gev) alongside plain words, with word boundaries on short tokens to avoid substring collisions.
    if (/automation|robot|robotics|plc\b|control[\s_-]?line|control[\s_-]?system|actuator|cobot|programmable[\s_-]?logic|assembly[\s_-]?robot|rok\b|etn\b|emr\b|hon\b/.test(blob)) return 'industry_automation_failure_escalation';
    if (/equipment[\s_-]?(failure|fault|breakdown)|machinery[\s_-]?(failure|breakdown)|downtime|unplanned[\s_-]?stop|mtbf|maintenance[\s_-]?(backlog|deficit)|breakdown[\s_-]?cascade|spares[\s_-]?shortage|dov\b/.test(blob)) return 'industry_equipment_failure_cascade';
    if (/production[\s_-]?halt|line[\s_-]?(stop|down|halt)|input[\s_-]?(starv|shortfall)|material[\s_-]?shortage|component[\s_-]?shortage|stockout|assembly[\s_-]?(stop|halt)|parts[\s_-]?shortage/.test(blob)) return 'industry_supply_chain_production_halt';
    if (/capacity[\s_-]?(collapse|utilization|util)|tcu\b|plant[\s_-]?(idle|closure|shutdown)|factory[\s_-]?(output|closure)|underutiliz|capacity[\s_-]?cut|output[\s_-]?(drop|collapse)|cat\b|de\b|ge\b|gev\b/.test(blob)) return 'industry_manufacturing_capacity_collapse';
    if (/input[\s_-]?cost|raw[\s_-]?material|material[\s_-]?cost|commodity[\s_-]?(price|cost)|margin[\s_-]?(compress|squeeze)|cost[\s_-]?shock|steel[\s_-]?price|energy[\s_-]?cost|ppi\b/.test(blob)) return 'industry_input_cost_shock';
    if (/labor[\s_-]?(shortage|deterioration)|skilled[\s_-]?(trade|labor)|workforce[\s_-]?(attrition|shortage)|hiring[\s_-]?(gap|freeze)|strike|walkout|union[\s_-]?action|worker[\s_-]?shortage|trade[\s_-]?skills/.test(blob)) return 'industry_labor_market_deterioration';
    if (/industrial[\s_-]?recession|pmi\b|ism\b|new[\s_-]?orders|capital[\s_-]?goods|heavy[\s_-]?industry|order[\s_-]?backlog[\s_-]?(decline|drop)|manufacturing[\s_-]?(contraction|slowdown)|durable[\s_-]?goods|itw\b|mmm\b|ph\b/.test(blob)) return 'industry_industrial_recession';
    return 'industry_generic';
  }

  // Map raw environment signal content → an environmental distress voice key.
  // Environment vocabulary covers the ENVIRONMENT domain identity: climate & emissions (carbon,
  // GHG, warming), air/water/soil pollution & quality, ecosystems & biodiversity, natural resources
  // & conservation, environmental regulation & compliance, climate risk & adaptation, waste
  // management & remediation, carbon markets. Recognizes real environmental-sector tickers (WM, RSG,
  // WCN, CWST — waste; AWK, WTRG, XYL — water; ECL — water/hygiene treatment; LIN, APD — industrial/
  // carbon-capture gas; DAR — rendering/renewables; AY — clean infrastructure). Environment COUPLES
  // to energy via emissions/carbon and to agriculture via land/water use, but keeps its own climate/
  // pollution/ecosystem identity and stays DISTINCT from energy (oil/gas/grid/power-generation = the
  // coupling, not the identity) and agriculture (land/water use = coupling). Mirrors the energy/infra/
  // culture/finance/economy/technology/defense/intelligence/trade/industry classifier structure
  // exactly. Returns a TEMPLATES key, or null. CLIENT-SIDE narration flavor only — never touches scoring.
  function _classifyEnvironmentDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: biodiversity/ecosystem collapse and emissions/carbon spike are sharpest
    // (irreversible loss + the climate driver), then water scarcity & quality, regulatory tightening,
    // remediation & waste backlog; fall back to a generic environment line. Matches real environmental-
    // sector tickers (wm/rsg/wcn/cwst/awk/wtrg/xyl/ecl/lin/apd/dar/ay) alongside plain words, with word
    // boundaries on short tokens to avoid substring collisions.
    if (/biodiversity|ecosystem[\s_-]?(collapse|loss|degrad)|species[\s_-]?(loss|extinct)|extinction|habitat[\s_-]?(loss|destruction)|deforestation|wetland[\s_-]?loss|coral[\s_-]?bleach|trophic|rewilding|conservation[\s_-]?failure/.test(blob)) return 'env_biodiversity_collapse';
    if (/emission|carbon|co2|greenhouse|ghg\b|methane|warming|climate[\s_-]?(disaster|change|shock)|decarboniz|net[\s_-]?zero|carbon[\s_-]?(market|credit|price)|cap[\s_-]?and[\s_-]?trade|lin\b|apd\b|dar\b/.test(blob)) return 'env_emissions_spike';
    if (/water[\s_-]?(scarcity|stress|shortage|quality|contaminat)|drought|aquifer|groundwater|potable|wastewater|pfas|effluent|watershed|reservoir[\s_-]?(depletion|low)|awk\b|wtrg\b|xyl\b|ecl\b/.test(blob)) return 'env_water_stress';
    if (/regulat|epa\b|compliance|permit|emission[\s_-]?(standard|limit|cap)|environmental[\s_-]?(rule|law|enforcement)|clean[\s_-]?(air|water)[\s_-]?act|tightening|mandate|carbon[\s_-]?tax|esg[\s_-]?disclosure|fine|penalty/.test(blob)) return 'env_regulatory_tightening';
    if (/remediation|cleanup|superfund|contamination|toxic[\s_-]?(site|waste)|hazardous[\s_-]?waste|landfill|spill|leachate|brownfield|waste[\s_-]?(backlog|management|crisis)|recycl|wm\b|rsg\b|wcn\b|cwst\b|ay\b/.test(blob)) return 'env_remediation_backlog';
    if (/pollut|air[\s_-]?quality|smog|particulate|pm2\.?5|aerosol|soil[\s_-]?(contaminat|degrad)|ocean[\s_-]?(acidif|plastic)|microplastic|runoff/.test(blob)) return 'env_pollution_event';
    return 'env_generic';
  }

  // Map raw governance signal content → a governance distress voice key.
  // Governance vocabulary covers the GOVERNANCE domain identity: government & public administration,
  // public policy & rulemaking, regulation & oversight, elections & democratic institutions, public
  // finance & budgets, rule of law & institutional integrity, public services delivery, political
  // stability & legitimacy. Maps to governance-brain diagnosisIndex (CONSTITUTIONAL_CRISIS /
  // REGIME_INSTABILITY / POLICY_FAILURE / CORRUPTION_SCANDAL / DIPLOMATIC_BREAKDOWN /
  // MILITARY_OVERREACH) plus regulatory-capture / fiscal-governance / institutional-credibility
  // flavors. Bound to REAL INSTITUTIONS & INDICES — World Bank WGI, V-Dem, OECD, GAO, CBO, Federal
  // Register, Congress.gov — NOT single-company tickers; where entities are needed, real govtech/
  // public-sector identifiers (TYL Tyler Technologies, MMS Maximus, BAH, LDOS, ACN, GDIT). Governance
  // COUPLES to economy via fiscal policy and to defense via military-overreach, but keeps its own
  // institutions/policy/rule-of-law identity and stays DISTINCT from economy (macro aggregate),
  // finance (capital markets), law (judicial/legal-system), and intelligence (collection/analysis).
  // Mirrors the energy/infra/culture/finance/economy/technology/defense/intelligence/trade/industry/
  // environment classifier structure exactly. Returns a TEMPLATES key, or null. CLIENT-SIDE narration
  // flavor only — never touches any scoring path.
  function _classifyGovernanceDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: constitutional crisis and corruption scandal are sharpest (separation-of-
    // powers + integrity breach), then regime instability, regulatory capture, diplomatic breakdown,
    // fiscal-governance stress, institutional credibility shock, policy failure; fall back to a generic
    // governance line. Matches institution/index shorthand (wgi/v-dem/vdem/oecd/gao/cbo/federal register/
    // congress.gov) and real govtech identifiers (tyl/mms/bah/ldos/acn/gdit) alongside plain words, with
    // word boundaries on short tokens to avoid substring collisions.
    if (/constitutional[\s_-]?(crisis|breach)|separation[\s_-]?of[\s_-]?powers|executive[\s_-]?overreach|impeach|checks[\s_-]?and[\s_-]?balances|emergency[\s_-]?powers|martial[\s_-]?law|court[\s_-]?packing|defy[\s_-]?(ruling|court)/.test(blob)) return 'gov_constitutional_crisis';
    if (/corrupt|bribery|graft|kickback|embezzl|self[\s_-]?dealing|scandal|misappropriat|nepotism|integrity[\s_-]?(breach|failure)|whistleblower/.test(blob)) return 'gov_corruption_scandal';
    if (/regime[\s_-]?(instability|change|collapse)|coup|electoral[\s_-]?(instability|fraud|dispute)|election[\s_-]?(crisis|integrity)|legitimacy[\s_-]?crisis|political[\s_-]?(instability|unrest)|contested[\s_-]?election|v[\s_-]?dem|vdem/.test(blob)) return 'gov_regime_instability';
    if (/regulatory[\s_-]?capture|revolving[\s_-]?door|oversight[\s_-]?(independence|erosion)|agency[\s_-]?capture|rulemaking[\s_-]?integrity|lobby[\s_-]?influence|enforcement[\s_-]?(laxity|gap)|federal[\s_-]?register/.test(blob)) return 'gov_regulatory_capture';
    if (/diplomat|treaty|alliance[\s_-]?(strain|withdrawal)|international[\s_-]?(institution|credibility)|foreign[\s_-]?relations|withdraw[\s_-]?(from|treaty)|oecd|un[\s_-]?(security|council)|multilateral[\s_-]?(breakdown|strain)/.test(blob)) return 'gov_diplomatic_breakdown';
    if (/fiscal[\s_-]?(crisis|governance|cliff)|budget[\s_-]?(gridlock|impasse|shutdown)|debt[\s_-]?ceiling|appropriation|public[\s_-]?finance|cbo\b|deficit[\s_-]?(governance|credibility)|government[\s_-]?shutdown/.test(blob)) return 'gov_fiscal_governance_stress';
    if (/institutional[\s_-]?(credibility|trust|erosion)|public[\s_-]?trust|rule[\s_-]?of[\s_-]?law|wgi\b|worldwide[\s_-]?governance|gao\b|trust[\s_-]?(collapse|erosion)|confidence[\s_-]?(loss|shock)|democratic[\s_-]?backslid/.test(blob)) return 'gov_institutional_credibility_shock';
    if (/policy[\s_-]?(failure|gridlock|incoherence)|legislative[\s_-]?(stalemate|gridlock)|gridlock|stalemate|enforcement[\s_-]?failure|regulatory[\s_-]?(failure|paralysis)|congress\.?gov|policy[\s_-]?paralysis|administrative[\s_-]?(breakdown|failure)/.test(blob)) return 'gov_policy_failure';
    return 'gov_generic';
  }

  // Map raw education signal content → an education distress voice key.
  // Education vocabulary covers the EDUCATION domain identity: schools & universities (K-12 +
  // higher ed), edtech & online learning, student outcomes & literacy, teaching & curriculum,
  // education funding & access/equity, workforce training & skills, credentialing & enrollment,
  // student debt. Translates energy oil/gas/grid content to education equivalents. Mirrors the
  // energy/infra/culture/finance/economy classifier structure exactly. Matches real education-
  // sector tickers (CHGG, COUR, DUOL, LRN, ATGE, LOPE, STRA, LAUR, TWOU, UTI) and indicator
  // shorthand (NAEP, FAFSA, IDR/PSLF, enrollment/yield) alongside plain words, with word boundaries
  // on short tokens. Kept DISTINCT from science (research), population (demographics), technology
  // (edtech tooling is a coupling), and economy (workforce is a coupling). CLIENT-SIDE narration
  // flavor ONLY — never touches any scoring path. Returns a TEMPLATES key, or null.
  function _classifyEducationDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: enrollment collapse and student-debt crisis are sharpest, then teacher
    // exodus, learning loss, funding crisis, achievement gap, skills mismatch; fall back to a generic
    // education line. Matches edu-ticker and indicator shorthand (chgg/cour/duol/lrn/atge/lope/stra/
    // laur/twou/uti/naep/fafsa/idr/pslf) alongside plain words.
    if (/enrollment[\s_-]?(decline|collapse|drop|contraction)|declining[\s_-]?enrollment|enrollment[\s_-]?cliff|yield[\s_-]?(rate|drop)|out[\s_-]?migration|birth[\s_-]?rate[\s_-]?decline|matriculat|chgg|twou|cour|duol/.test(blob)) return 'education_enrollment_collapse';
    if (/student[\s_-]?debt|loan[\s_-]?default|default[\s_-]?(rate|spike)|income[\s_-]?driven[\s_-]?repayment|\bidr\b|\bpslf\b|loan[\s_-]?forgiveness|borrower[\s_-]?(distress|strain)|tuition[\s_-]?debt/.test(blob)) return 'education_debt_spiral';
    if (/teacher[\s_-]?(shortage|exodus|burnout|attrition|flight)|instructional[\s_-]?(capacity|shortage)|educator[\s_-]?(shortage|burnout)|faculty[\s_-]?(shortage|attrition)|staffing[\s_-]?gap|substitute[\s_-]?shortage/.test(blob)) return 'education_teacher_exodus';
    if (/learning[\s_-]?loss|assessment[\s_-]?(score|decline)|test[\s_-]?score|naep|achievement[\s_-]?(trajectory|decline)|cohort[\s_-]?outcome|literacy[\s_-]?(decline|crisis)|proficiency[\s_-]?(drop|decline)|grade[\s_-]?regression/.test(blob)) return 'education_learning_loss';
    if (/education[\s_-]?funding|budget[\s_-]?cut|federal[\s_-]?aid|state[\s_-]?(budget|funding)[\s_-]?cut|endowment|tuition[\s_-]?(dependency|reliance)|fafsa|per[\s_-]?pupil[\s_-]?(cut|funding)|appropriation[\s_-]?cut|program[\s_-]?cut/.test(blob)) return 'education_funding_crisis';
    if (/achievement[\s_-]?gap|equity[\s_-]?(gap|access|erosion)|poverty[\s_-]?correlation|access[\s_-]?disparit|opportunity[\s_-]?gap|outcome[\s_-]?disparit|underserved/.test(blob)) return 'education_achievement_gap';
    if (/skills[\s_-]?(mismatch|gap)|credential[\s_-]?(output|mismatch)|workforce[\s_-]?(pipeline|training)|labor[\s_-]?pipeline|employer[\s_-]?demand|reskill|upskill|vocational|apprenticeship/.test(blob)) return 'education_skills_mismatch';
    return 'education_generic';
  }

  // Map raw population signal content → a demographic distress voice key.
  // Population vocabulary covers the POPULATION/DEMOGRAPHIC domain identity: demographics &
  // population dynamics, migration & immigration, urbanization & settlement, fertility & mortality,
  // aging & generational shifts, labor-force & human-capital supply, household formation & housing
  // demand, social structure & inequality. Bound to REAL DEMOGRAPHIC SOURCES — US Census / ACS, UN
  // World Population Prospects (WPP), Pew Research, BLS labor-force (CPS) series, CDC natality/
  // mortality — NOT single-company tickers; where demographic-exposed entities are needed, real
  // proxies (WELL, VTR senior-living REITs; housing/migration-exposed names). Mirrors the energy/
  // infra/culture/finance/economy/technology/defense/intelligence/trade/industry/environment/
  // governance/agriculture/education classifier structure exactly. Recognizes indicator shorthand
  // (lfpr/tfr/acs/wpp/cps) and senior-living proxies (well/vtr) alongside plain words. Population
  // COUPLES to economy (labor MARKET), medicine (mortality/health), education (enrollment), and
  // governance, but keeps its own demographics/migration/aging/household identity and stays DISTINCT
  // from each coupling. Returns a TEMPLATES key, or null. CLIENT-SIDE narration flavor only — never
  // touches any scoring path.
  function _classifyPopulationDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: demographic collapse (sub-replacement fertility) and aging crisis are
    // sharpest, then migration surge, depopulation (regional loss), housing crisis, urbanization
    // strain, labor shortage; fall back to a generic population line. Matches demographic-source
    // shorthand (census/acs/wpp/cps/tfr/lfpr) and senior-living proxies (well/vtr) alongside plain
    // words, with word boundaries on short tokens to avoid substring collisions.
    if (/(fertility|birth[\s_-]?rate)[\s_-]?(decline|drop|collapse)|sub[\s_-]?replacement|below[\s_-]?replacement|replacement[\s_-]?rate|demographic[\s_-]?(cliff|collapse|winter|decline)|tfr\b|baby[\s_-]?bust|population[\s_-]?(decline|inversion)/.test(blob)) return 'population_demographic_collapse';
    if (/aging|ageing|old[\s_-]?age[\s_-]?dependency|dependency[\s_-]?ratio|graying|gray[\s_-]?wave|silver[\s_-]?tsunami|pension[\s_-]?(strain|burden)|elderly[\s_-]?(care|surge)|retiree[\s_-]?wave|median[\s_-]?age[\s_-]?(rise|spike)|well\b|vtr\b|senior[\s_-]?living/.test(blob)) return 'population_aging_crisis';
    if (/migration[\s_-]?(surge|inflow|wave|pressure)|immigrat|refugee|displaced[\s_-]?person|asylum|climate[\s_-]?migra|border[\s_-]?(surge|crossing)|resettle|integration[\s_-]?capacity|inflow[\s_-]?accelerat/.test(blob)) return 'population_migration_surge';
    if (/depopulat|rural[\s_-]?exodus|out[\s_-]?migration|shrinking[\s_-]?(city|cities|town)|population[\s_-]?loss|regional[\s_-]?decline|brain[\s_-]?drain|ghost[\s_-]?town|abandonment|emigrat/.test(blob)) return 'population_depopulation';
    if (/housing[\s_-]?(crisis|affordability|shortage)|affordability[\s_-]?(collapse|crisis)|mortgage[\s_-]?burden|rent[\s_-]?burden|homeless|household[\s_-]?formation|cost[\s_-]?burdened|housing[\s_-]?(supply|unaffordab)|shelter[\s_-]?cost/.test(blob)) return 'population_housing_crisis';
    if (/urbaniz|megacity|mega[\s_-]?city|slum|informal[\s_-]?settlement|overcrowd|urban[\s_-]?(sprawl|strain|overload)|sprawl|density[\s_-]?strain|city[\s_-]?growth/.test(blob)) return 'population_urbanization_strain';
    if (/labor[\s_-]?(force|shortage|supply)|workforce[\s_-]?(shortage|shrink|decline)|participation[\s_-]?(rate|fall|drop)|lfpr\b|prime[\s_-]?age|working[\s_-]?age[\s_-]?(decline|shortage)|skill[\s_-]?gap|human[\s_-]?capital[\s_-]?(supply|shortage)|cps\b/.test(blob)) return 'population_labor_shortage';
    return 'population_generic';
  }

  // Map raw science signal content → a scientific-research distress voice key.
  // Science vocabulary covers the SCIENCE domain identity (runtime key 'research'): scientific
  // research & discovery, basic & applied research, R&D pipelines, academic & lab science, peer
  // review & publication, research funding & grants, scientific instruments & methods, the
  // innovation pipeline. Diagnosis classes mirror energy's per-diagnosis split (OIL_SHOCK /
  // GRID_COLLAPSE) but for research-system failures: replication crisis (reproducibility failure,
  // p-hacking, retraction), funding cut (appropriations decline, budget contraction), research
  // fraud (data fabrication, misconduct, paper-mill), brain drain (researcher exodus, postdoc
  // attrition, STEM-PhD flight), discovery stagnation (citation decay, productivity slowdown),
  // grant shortfall (NIH/NSF success-rate collapse, proposal rejection), lab-capacity strain
  // (instrument backlog, core-facility overload). Bound to REAL RESEARCH AUTHORITIES (NSF, NIH,
  // arXiv, Nature, OpenAlex, NASA) and real research-sector tickers (TMO/DHR/A/MTD/WAT/ILMN/BIO/
  // RVTY/BRKR/IQV). Science COUPLES to technology (applied product dev), medicine (clinical
  // research), and education (academic teaching) but keeps its own discovery/peer-review/grant/
  // lab-instrument identity and stays DISTINCT from each coupling. Mirrors the energy/infra/culture/
  // finance/economy/technology/defense/intelligence/trade/industry/environment/governance/education/
  // population classifier structure exactly. Returns a TEMPLATES key, or null. CLIENT-SIDE narration
  // flavor only — never touches any scoring path.
  function _classifyScienceDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: research fraud and replication crisis are sharpest (integrity breach +
    // reproducibility failure), then brain drain, grant shortfall, funding cut, lab-capacity strain,
    // discovery stagnation; fall back to a generic science line. Matches research-authority shorthand
    // (nsf/nih/arxiv/nature/openalex/nasa) and research-sector tickers (tmo/dhr/mtd/wat/ilmn/bio/rvty/
    // brkr/iqv; 'a' and 'bio'/'wat' guarded by word boundaries) alongside plain words.
    if (/fraud|fabricat|falsif|misconduct|paper[\s_-]?mill|image[\s_-]?manipulation|plagiar|data[\s_-]?(integrity|tampering)|research[\s_-]?integrity|p[\s_-]?hack/.test(blob)) return 'science_research_fraud';
    if (/replicat|reproducib|irreproducib|retraction|retracted|reproduction[\s_-]?failure|crisis[\s_-]?of[\s_-]?confidence|pubpeer|null[\s_-]?result/.test(blob)) return 'science_replication_crisis';
    if (/brain[\s_-]?drain|researcher[\s_-]?(exodus|flight|attrition)|postdoc[\s_-]?(attrition|exodus|shortage)|stem[\s_-]?(phd|talent)[\s_-]?(flight|loss)|talent[\s_-]?(drain|exodus)|faculty[\s_-]?flight|scientist[\s_-]?emigrat/.test(blob)) return 'science_brain_drain';
    if (/grant[\s_-]?(shortfall|rejection|reject|denial)|success[\s_-]?rate[\s_-]?(collapse|decline|drop)|proposal[\s_-]?(reject|decline)|nih[\s_-]?(grant|success|paylin)|nsf[\s_-]?(grant|award)|payline|r01\b|award[\s_-]?rate[\s_-]?(decline|drop)/.test(blob)) return 'science_grant_shortfall';
    if (/funding[\s_-]?(cut|decline|contraction|freeze)|appropriation[\s_-]?(cut|decline)|research[\s_-]?budget|science[\s_-]?budget|sequester|defund|budget[\s_-]?(cut|contraction)[\s_-]?(research|science)|r&d[\s_-]?(cut|spend[\s_-]?decline)/.test(blob)) return 'science_funding_cut';
    if (/lab[\s_-]?(capacity|backlog|overload)|core[\s_-]?facility|instrument[\s_-]?(backlog|shortage|downtime)|equipment[\s_-]?(shortage|backlog)|sequencing[\s_-]?backlog|throughput[\s_-]?(strain|limit)|tmo\b|dhr\b|mtd\b|wat\b|ilmn\b|brkr\b|rvty\b|bio\b/.test(blob)) return 'science_lab_capacity_strain';
    if (/discovery[\s_-]?(stagnation|slowdown|decline)|citation[\s_-]?(decay|decline|trajectory)|productivity[\s_-]?(slowdown|decline)|idea[\s_-]?(exhaustion|depletion)|innovation[\s_-]?(slowdown|stagnation)|breakthrough[\s_-]?(decay|drought)|openalex|arxiv|stagnat/.test(blob)) return 'science_discovery_stagnation';
    return 'science_generic';
  }

  function _onGlobalStateUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.mode) return;
    // Only narrate when the mode actually changes, not on every 6s cycle
    if (detail.mode === _lastGlobalMode) return;
    _lastGlobalMode = detail.mode;
    _narrate('global_shift', { state: detail.mode }, PRIORITY_MEDIUM);
  }

  function _onEventAction(e) {
    var detail = e.detail;
    if (!detail || !detail.event) return;
    var evt = detail.event;
    var label = (evt.type || '').replace(/_/g, ' ');
    if (detail.action === 'start') {
      _narrate('event_start', { event: label }, PRIORITY_MEDIUM);
    } else if (detail.action === 'end') {
      _narrate('event_end', { event: label }, PRIORITY_LOW);
    }
  }

  function _onFeedStateChange(e) {
    var detail = e.detail;
    if (!detail) return;
    if (detail.to === 'degraded') {
      _narrate('feed_degradation', {}, PRIORITY_HIGH);
    } else if (detail.to === 'hydrated') {
      // Recovery from degraded OR initial hydration both trigger speech
      _narrate(detail.from === 'degraded' ? 'feed_recovery' : 'feed_hydrated', {}, PRIORITY_MEDIUM);
    }
  }

  function _onFeedHydrated(e) {
    // Primary trigger: feeds come online (fires once per page load)
    _narrate('feed_hydrated', {}, PRIORITY_MEDIUM);
  }

  function _onRegulationUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.state) return;
    var key = 'regulation_' + detail.state;
    // Only narrate meaningful transitions
    if (detail.state === 'unknown') return;
    _narrate(key, {}, PRIORITY_LOW);
  }

  // ─── Voice control UI ───────────────────────────────────────────────────

  function _ensureControl() {
    if (_controlEl) return;
    _controlEl = document.createElement('div');
    _controlEl.id = 'limen-voice-control';
    _controlEl.style.cssText = [
      'position:fixed',
      'bottom:4px',
      'right:12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.38rem',
      'letter-spacing:1.2px',
      'z-index:9998',
      'pointer-events:auto',
      'display:flex',
      'gap:4px',
      'align-items:center'
    ].join(';');

    _renderControl();
    document.body.appendChild(_controlEl);
  }

  function _renderControl() {
    if (!_controlEl) return;

    var dim = 'rgba(201,169,78,0.35)';
    var active = 'rgba(201,169,78,0.7)';
    var btnBase = 'background:rgba(201,169,78,0.06);border:1px solid rgba(201,169,78,0.12);' +
      'color:{color};font-family:"IBM Plex Mono",monospace;font-size:0.36rem;' +
      'letter-spacing:1.2px;padding:2px 6px;cursor:pointer;border-radius:2px;' +
      'transition:background 0.2s,color 0.2s';

    var html = '';

    // Mute toggle
    var muteLabel = _muted ? 'MUTED' : 'VOICE';
    var muteColor = _muted ? 'rgba(232,84,84,0.6)' : dim;
    html += '<button id="limen-voice-mute" style="' + btnBase.replace('{color}', muteColor) + '">' + muteLabel + '</button>';

    // Mode buttons
    for (var i = 0; i < MODES.length; i++) {
      var m = MODES[i];
      var color = (m === _mode) ? active : dim;
      html += '<button class="limen-voice-mode" data-mode="' + m + '" style="' + btnBase.replace('{color}', color) + '">' + m.toUpperCase() + '</button>';
    }

    _controlEl.innerHTML = html;

    // Bind mute
    var muteBtn = document.getElementById('limen-voice-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        _muted = !_muted;
        if (_muted) _voiceBackend.cancel();
        _renderControl();
      });
    }

    // Bind mode buttons
    var modeBtns = _controlEl.querySelectorAll('.limen-voice-mode');
    for (var b = 0; b < modeBtns.length; b++) {
      modeBtns[b].addEventListener('click', function () {
        var newMode = this.getAttribute('data-mode');
        if (MODES.indexOf(newMode) !== -1) {
          _mode = newMode;
          if (_mode === 'silent') _voiceBackend.cancel();
          _renderControl();
        }
      });
    }
  }

  // ─── Public API: mode and mute control ──────────────────────────────────

  function setMode(mode) {
    if (MODES.indexOf(mode) === -1) return;
    _mode = mode;
    if (_mode === 'silent') _voiceBackend.cancel();
    _renderControl();
  }

  function getMode() {
    return _mode;
  }

  function setMuted(muted) {
    _muted = !!muted;
    if (_muted) _voiceBackend.cancel();
    _renderControl();
  }

  function isMuted() {
    return _muted;
  }

  // Allow external modules to inject narration
  function speak(text, priority) {
    if (!text || _mode === 'silent') return;
    var prio = priority || PRIORITY_MEDIUM;
    var now = Date.now();
    if (_recentMessages[text] && (now - _recentMessages[text]) < 30000) return;
    _recentMessages[text] = now;
    _queue.push({ text: text, priority: prio, timestamp: now });
    _queue.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });
    while (_queue.length > MAX_QUEUE) _queue.pop();
    _dispatch('limen:narrator-speak', { text: text, priority: prio, mode: _mode });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;

    // Initialize voice backend
    _voiceBackend.init();

    // Create UI control
    _ensureControl();

    // Listen for system events
    window.addEventListener('limen:escalation-shift', _onEscalationShift);
    window.addEventListener('limen:domain-distress', _onDomainDistress);
    window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.addEventListener('limen:event', _onEventAction);
    window.addEventListener('limen:feed-hydrated', _onFeedHydrated);
    window.addEventListener('limen:feed-state-change', _onFeedStateChange);
    window.addEventListener('limen:regulation-update', _onRegulationUpdate);

    // Catch up: if feeds already hydrated before we started listening,
    // queue the hydration narration now (bootstrap starts us last)
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.isHydrated === 'function' && fs.isHydrated()) {
      _narrate('feed_hydrated', {}, PRIORITY_MEDIUM);
    }

    // Seed _lastGlobalMode from current state so we don't
    // narrate "shifted to stable" on the first routine update
    var gs = window.LIMENGlobalState;
    if (gs && gs.mode) {
      _lastGlobalMode = gs.mode;
    }

    // Process queue periodically
    _interval = setInterval(_processQueue, 1000);
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    _voiceBackend.cancel();
    window.removeEventListener('limen:escalation-shift', _onEscalationShift);
    window.removeEventListener('limen:domain-distress', _onDomainDistress);
    window.removeEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.removeEventListener('limen:event', _onEventAction);
    window.removeEventListener('limen:feed-hydrated', _onFeedHydrated);
    window.removeEventListener('limen:feed-state-change', _onFeedStateChange);
    window.removeEventListener('limen:regulation-update', _onRegulationUpdate);
    if (_controlEl && _controlEl.parentNode) {
      _controlEl.parentNode.removeChild(_controlEl);
      _controlEl = null;
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENConsoleNarrator = {
    start: start,
    stop: stop,
    setMode: setMode,
    getMode: getMode,
    setMuted: setMuted,
    isMuted: isMuted,
    speak: speak,

    // For future TTS swap-in
    setVoiceBackend: function (backend) {
      if (backend && typeof backend.speak === 'function') {
        _voiceBackend.cancel();
        _voiceBackend = backend;
      }
    }
  };

})();
