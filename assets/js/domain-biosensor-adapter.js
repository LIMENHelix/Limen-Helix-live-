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
      cognitiveLoad: 'Simultaneous disruption management — high load with cascading failures reflects system overextension',
      // Trade-flow execution-readiness map: regulation state → trade & supply-chain intake/triage
      // posture. Runtime key is 'supplyChain' (trade<->supplyChain dual-naming via domain-identity.js;
      // trade is the URL/portal key, supplyChain the snapshot/runtime key). Consumed by (future)
      // trade-clarity-operator outcome tracking (trade-flow initiative velocity, sourcing-route
      // throughput, customs-clearance time, port/carrier-partnership momentum, logistics velocity,
      // sanctions/tariff-exposure triage). TRADE identity only — international trade & commerce,
      // exports/imports, tariffs & trade policy, shipping & logistics, supply chains, trade balance,
      // customs, trade agreements, sanctions/embargoes, freight & ports. Distinct from economy (macro
      // aggregate / trade balance as a series) and industry (production). Trade couples to economy via
      // trade balance and to industry via sourced goods but never adopts macro indicators or factory
      // production as its own content. Reference trade/logistics-identity names: FDX, UPS, EXPD, CHRW,
      // ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL. Operator arousal/coherence during supply disruptions
      // gate trade-flow & sourcing intake (high arousal = crisis bottleneck-triage mode; low arousal =
      // deliberate route/partnership-expansion mode). STRICTLY ADDITIVE — does not touch any validated
      // scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to greenlight new trade-flow initiatives: open new port/carrier and freight-forwarder partnerships (FDX/UPS/EXPD/CHRW/ZIM/MATX), expand into new ocean/rail/LTL lanes (XPO/ODFL/DSDVY/AMKBY), and stand up new tariff/sanctions-monitoring and trade-agreement programs; open speculative new sourcing-route scouting.',
        focused: 'Productive engagement — sustain active supply-chain flows and in-flight shipments (GXO warehousing, EXPD/CHRW brokerage, ODFL/XPO domestic freight); admit only proven-vendor sourcing and well-scoped lane additions; hold speculative new routes and open-ended carrier onboarding.',
        pressured: 'Elevated load — defer discretionary sourcing and new lane/partnership intake; focus on critical-route triage: protect highest-volume trade flows, expedite at-risk shipments, and keep customs-clearance and on-time-delivery monitoring active on live routes.',
        overloaded: 'Saturated — pause all new supply-chain programs and sourcing intake; triage customs/port bottlenecks and sanctions exposure: port congestion and carrier capacity shortfalls (ZIM/MATX/AMKBY/DSDVY), customs holds and clearance failures, tariff/embargo and sanctions-list exposure on active shipments.',
        recovering: 'Stabilizing — resume vendor-relationship building first (re-establish proven suppliers, freight-forwarders and carriers), then reopen supply-flow and lane expansion gradually as logistics velocity, port throughput and customs-clearance time normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active route-disruption signals and trade-flow / customs-bottleneck criticality ranking).'
      }
    },
    economy: {
      label: 'Macroeconomic assessment pressure',
      arousal: 'Policy response urgency — high arousal during macro shocks suggests reactive rather than deliberate assessment',
      coherence: 'Forecast consistency — low coherence during contradictory signals suggests unreliable economic outlook',
      cognitiveLoad: 'Indicator complexity — high load with multiple concurrent stress signals suggests analytical saturation',
      // Macro intake/triage readiness map: regulation state → macro monitoring/research intake cadence.
      // Consumed by economy-clarity-operator outcome tracking (forecasting horizon, research-program
      // throughput, indicator-monitoring focus, recession/inflation tail-risk triage). MACRO AGGREGATE
      // identity only — distinct from finance (capital markets/credit/banks): GDP & growth, inflation
      // (CPI/PCE), employment & labor markets, consumer & business sentiment, fiscal & monetary policy
      // (central banks, interest rates), the recession/expansion business cycle, trade balance,
      // productivity, money supply. Reference macro identifiers are FRED series ids and broad-market
      // proxies, never single-company tickers: GDP, GDPC1, CPIAUCSL, PCEPI, UNRATE, PAYEMS, FEDFUNDS,
      // DGS10, UMCSENT, INDPRO; SPY, DIA, TLT, GLD. Operator arousal/coherence during macro shocks gate
      // research-intake cadence (high arousal = reactive crisis-mode triage; low arousal = deliberate
      // analysis-mode). STRICTLY ADDITIVE — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand forecasting horizon: initiate long-run structural analysis (GDPC1 potential-output and productivity/INDPRO trends, demographic labor-supply paths), open new research initiatives across business-cycle, inflation (CPIAUCSL/PCEPI) and policy (FEDFUNDS/DGS10) regimes.',
        focused: 'Productive engagement — sustain economic monitoring and in-flight analysis (UNRATE/PAYEMS labor tracking, UMCSENT sentiment, broad-market regime via SPY/DIA/TLT); admit only incremental, well-scoped research additions and hold open-ended new programs.',
        pressured: 'Elevated load — defer non-urgent analysis and long-run structural research; focus on real-time indicator monitoring and short-run forecasting of the active regime (inflation prints, labor releases, rate path, near-term growth nowcast).',
        overloaded: 'Saturated — pause all non-critical research; respond only to immediate economic shocks and triage recession/inflation tail risks (yield-curve/DGS10 inversion, FEDFUNDS policy stress, UNRATE deterioration, flight-to-safety in TLT/GLD).',
        recovering: 'Stabilizing — resume longer-run structural analysis first (productivity, potential output, trade balance), then reopen research programs gradually as indicator volatility settles and the regime outlook normalizes.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active-regime indicator stress and business-cycle-phase ranking).'
      }
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
      cognitiveLoad: 'Multi-factor assessment — high load with weather, market, and supply chain signals reflects decision overload',
      // Ag-intake/triage readiness map: regulation state → agriculture R&D, crop-cycle and
      // farm-economics intake/triage posture. Mirrors energy's biosensor intake map (energy gates
      // capex/dispatch by operator regulation state; agriculture gates ag-investment, input-sourcing,
      // crop-cycle and farm-viability intake) — advisory-layer only and independent of the kernel
      // scoring spine. Consumed by (future) agriculture-clarity-operator outcome tracking (precision-ag
      // R&D velocity, crop-cycle/livestock operation throughput, input-sourcing momentum, commodity-
      // hedging cadence, farm-viability/debt triage). AGRICULTURE identity only — farming & crops,
      // livestock & animal protein, agribusiness & food production, food security & supply, fertilizers
      // & crop inputs, irrigation & agricultural water, commodity crops (corn/soy/wheat), agricultural
      // technology & precision ag, farm economics. Reference agriculture-identity names: ADM, BG, CTVA,
      // DE, NTR, MOS, CF, TSN, CAG, INGR, AGCO, FMC; commodity refs via CBOT corn/soy/wheat and USDA
      // WASDE. Distinct from environment (land/water/climate is a coupling, not the identity), trade
      // (export logistics is a coupling) and economy (food prices is a coupling); biofuel/fertilizer-
      // energy is an energy coupling, never agriculture's own content. Operator arousal/coherence during
      // crop stress or price spikes gate ag-investment & crop-cycle intake (high arousal = crisis farm-
      // viability triage mode; low arousal = deliberate ag-innovation/expansion mode). STRICTLY ADDITIVE
      // — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand ag investment and innovation: open new precision-ag R&D programs (CTVA/AGCO smart-farming roadmaps), initiate commodity-hedging and price-risk programs, invest in irrigation and soil-health improvement (DE/AGCO/FMC solutions), launch new crop-genetics and drought-resilience breeding programs.',
        focused: 'Productive engagement — sustain active crop cycles and livestock operations; admit only proven-vendor input sourcing and well-scoped land/water-infrastructure additions; hold speculative new markets and crop-diversification.',
        pressured: 'Elevated load — defer discretionary ag-innovation intake and new market expansion; focus on near-term crop health and market triage: protect high-value commodity positions, prioritize input supply and water-availability monitoring, keep harvest-readiness and price-hedging active.',
        overloaded: 'Saturated — pause all new ag-investment and innovation programs; respond only to critical farm-viability crisis: crop-failure and livestock-disease containment (veterinary emergency response, replanting decisions), farm-debt and land-value stress (refinancing triage, forced-sale exposure), food-security and export-market shock (government-program access, commodity-price hedging).',
        recovering: 'Stabilizing — resume input sourcing and supply-chain stabilization first, then reopen ag-innovation and expansion programs gradually as crop yields, commodity prices, farm-debt ratios and water availability normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (crop-stress and commodity-price signals with farm-viability criticality ranking).'
      }
    },
    governance: {
      label: 'Policy formation and institutional pressure',
      arousal: 'Political urgency — high arousal during governance crises reflects accelerated decision timelines',
      coherence: 'Policy consistency — low coherence during multi-stakeholder conflict suggests fragmented institutional response',
      cognitiveLoad: 'Regulatory complexity — high load with competing policy demands reflects institutional overextension',
      // Policy-formation intake/triage readiness map: regulation state → policy-research,
      // institutional-monitoring and regulatory-oversight intake/triage posture. Mirrors energy's
      // biosensor intake map (energy gates capex/dispatch by operator regulation state — calm:
      // greenlight capex programs / overloaded: triage grid/supply crises; governance gates policy-
      // formation intake — calm: expand institutional analysis & open new regulatory-reform programs /
      // overloaded: crisis institutional triage on constitutional/legitimacy threats only). Advisory-
      // layer only and independent of the kernel scoring spine. Consumed by (future) governance-clarity-
      // operator outcome tracking (policy-research throughput, institutional-monitoring coverage,
      // regulatory-oversight cadence, electoral-system assessment timeliness, fiscal-governance analysis
      // velocity, anti-corruption investigation momentum). GOVERNANCE identity only — government & public
      // administration, public policy & rulemaking, regulation & oversight, elections & democratic
      // institutions, public finance & budgets, rule of law & institutional integrity, public-services
      // delivery, political stability & legitimacy. Governance binds mostly to INSTITUTIONS & INDICATORS
      // not single companies: governance/policy indices — World Bank WGI (Worldwide Governance
      // Indicators), V-Dem (Varieties of Democracy), OECD (government & regulatory indicators), GAO
      // (Government Accountability Office), CBO (Congressional Budget Office), Federal Register
      // (rulemaking). Where govtech/public-sector entities are needed use REAL identifiers: TYL (Tyler
      // Technologies), MMS (Maximus), BAH (Booz Allen Hamilton), LDOS (Leidos), ACN (Accenture), GDIT
      // (General Dynamics IT). Distinct from economy (macro aggregate — fiscal/monetary series are a
      // coupling, not governance's content), finance (capital markets), law (judicial/legal-system is the
      // law domain) and intelligence (collection/analysis). Operator arousal/coherence during governance
      // crises gate policy-formation intake (high arousal = crisis institutional-triage mode; low arousal
      // = deliberate institutional-analysis / reform mode). STRICTLY ADDITIVE — does not touch any
      // validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand institutional analysis: open new regulatory-reform programs, stand up new policy-research initiatives and long-horizon institutional studies (WGI/V-Dem governance-quality trends, OECD regulatory-policy benchmarking), launch new electoral-system assessments and fiscal-governance reviews (CBO long-run budget outlooks), and initiate anti-corruption and rule-of-law strengthening programs; open speculative policy-design and public-services-delivery modernization (TYL/MMS/ACN/GDIT govtech) scouting.',
        focused: 'Productive engagement — sustain in-flight policy and active institutional monitoring (Federal Register rulemaking pipelines, GAO oversight engagements, ongoing program evaluations); admit only well-scoped new intake (single-rule comment cycles, proven oversight reviews, scoped fiscal analyses — CBO scoring of defined bills); hold open-ended new reform programs and speculative institutional studies (BAH/LDOS/ACN delivery steady, TYL/MMS systems disciplined).',
        pressured: 'Elevated load — defer discretionary analysis and new policy-research intake; focus on real-time institutional monitoring and short-horizon priorities of the active situation: protect in-flight rulemaking and statutory deadlines, prioritize high-stakes oversight, and keep electoral-integrity and fiscal-governance monitoring active on live matters; pause non-urgent reform programs.',
        overloaded: 'Saturated — pause all new institutional analysis and policy-research intake; crisis institutional triage on constitutional and legitimacy threats only: rule-of-law and institutional-integrity breakdowns, electoral-legitimacy and democratic-backsliding events (WGI/V-Dem deterioration), fiscal-governance and budget-stability crises (CBO debt/shutdown stress), and acute public-services-delivery failures (GDIT/MMS/TYL critical-system outages, GAO high-risk findings).',
        recovering: 'Stabilizing — resume institutional monitoring and posture stabilization first (re-establish oversight cadence, rulemaking pipelines and fiscal reporting on restored functions), then reopen policy-research and regulatory-reform programs gradually as governance-quality indicators (WGI/V-Dem), institutional-integrity and fiscal-stability metrics normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active institutional-stress and legitimacy/governance-quality signals with policy-criticality ranking).'
      }
    },
    research: {
      label: 'Research intensity and discovery state',
      arousal: 'Investigation drive — moderate arousal during active research reflects productive engagement',
      coherence: 'Methodological rigor — high coherence during analysis suggests systematic investigation',
      cognitiveLoad: 'Analytical depth — high load during complex data interpretation reflects deep processing',
      // Research-program intake/triage readiness map: regulation state → research-intake,
      // discovery-program, funding-pipeline and talent-pipeline intake/triage posture. Runtime key is
      // 'research' (science<->research dual-naming via domain-identity.js — science is the URL/portal
      // key, research the snapshot/runtime key consumed by the domain brain). Mirrors energy's biosensor
      // intake map (energy gates capex/dispatch by operator regulation state — calm: greenlight capex
      // programs / overloaded: triage grid/supply crises; research gates research-program & discovery
      // intake — calm: greenlight discovery, foundation-platform and reproducibility investment /
      // overloaded: crisis triage on funding-cut, reproducibility-crisis and lab-closure only). Advisory-
      // layer only and independent of the kernel scoring spine. Consumed by (future) science-clarity-
      // operator outcome tracking (research-intake velocity, publication-velocity, grant-success-rate,
      // reproducibility-standard adherence, talent-retention cadence, discovery-stagnation triage).
      // SCIENCE identity only — scientific research & discovery, basic & applied research, R&D pipelines,
      // academic & lab science, peer review & publication, research funding & grants, scientific
      // instruments & methods, the innovation pipeline. Research binds to AUTHORITIES & INDICATORS as well
      // as instrument companies: NSF (Science & Engineering Indicators, research funding), NIH
      // (appropriations & grant-success-rate / R01 paylines), arXiv & Nature (publication volume & venue),
      // OpenAlex (citation trend & scholarly-graph), NASA (STEM-PhD attrition / workforce metrics). Where
      // research-sector entities are needed use REAL research-instrument & life-science-tools identifiers:
      // TMO, DHR, A, MTD, WAT, ILMN, BIO, RVTY, BRKR, IQV, ICLR. Distinct from technology (applied product
      // dev / chips & software is a coupling, not the identity), medicine (clinical research & trials is a
      // coupling, not the identity) and education (academic teaching is a coupling, not the identity);
      // never adopts energy oil/gas/grid content. Operator arousal/coherence during manuscript-rejection
      // or grant-review triage gate research-program intake (high arousal = crisis reproducibility/funding-
      // cut mode; low arousal = deliberate breakthrough/expansion mode). STRICTLY ADDITIVE — does not touch
      // any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to greenlight discovery and expand research investment: open new basic- and applied-research programs and exploratory lines of inquiry, stand up new reproducibility platforms and shared-instrumentation cores (TMO/DHR/A/MTD/WAT/BRKR/RVTY instruments, ILMN/BIO sequencing & genomics), invest in foundation-platform and high-risk/high-reward discovery (NSF frontier programs, NIH new-investigator initiatives), and launch new talent-pipeline and STEM-PhD recruitment programs; open speculative cross-disciplinary and long-horizon research scouting.',
        focused: 'Productive engagement — sustain in-flight research programs and active discovery (ongoing studies, IQV/ICLR research-services delivery, in-progress manuscripts and grant-funded work); admit only well-scoped new intake (single-aim studies, proven-method extensions, scoped instrument acquisitions, defined publication targets at arXiv/Nature); hold open-ended new programs and speculative cross-disciplinary expansion (TMO/DHR/A/MTD instrument fleets steady, ILMN/BIO platforms disciplined).',
        pressured: 'Elevated load — defer discretionary new research intake and speculative discovery lines; focus on publication-velocity and grant-pipeline triage: protect in-flight manuscripts and statutory grant/renewal deadlines, prioritize high-impact submissions and revisions (arXiv/Nature pipelines, OpenAlex citation-impact tracking), and keep reproducibility-standard and research-integrity monitoring active on live studies; pause non-urgent program expansion.',
        overloaded: 'Saturated — pause all new research programs and discovery intake; respond only to funding-cut, reproducibility-crisis and lab-closure emergencies: research-funding shocks and grant-success-rate collapse (NSF/NIH appropriations cuts, R01 payline failures), reproducibility-crisis and retraction/integrity containment (failed replications, data-integrity investigations), critical instrument or core-facility failure (TMO/DHR/A/MTD/WAT/BRKR equipment downtime, ILMN/BIO platform outages), and acute talent attrition / lab-closure (NASA STEM-PhD attrition spikes, principal-investigator departures).',
        recovering: 'Stabilizing — resume talent-pipeline rebuilding and instrument/platform restoration first (re-establish proven research staff and PI networks, restore core-facility uptime — TMO/DHR/MTD/WAT/BRKR/ILMN/BIO), then reopen research-program and discovery intake gradually as grant-success-rate (NSF/NIH), publication-velocity (arXiv/Nature/OpenAlex), reproducibility-standard adherence and talent-retention (NASA STEM workforce) metrics normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active research-program / funding-pipeline stress signals and discovery-stagnation / reproducibility criticality ranking).'
      }
    },
    health: {
      label: 'Clinical attention and system regulation capacity',
      arousal: 'Clinical urgency — high arousal during active diagnoses reflects care delivery pressure',
      coherence: 'Coordination quality — low coherence during multi-provider scenarios suggests care fragmentation risk',
      cognitiveLoad: 'Clinical complexity — high load with chronic disease burden reflects sustained care management demand',
      // Healthcare execution-readiness map: regulation state → clinical-program, pharma R&D and
      // care-system intake/triage posture. Runtime key is 'health' (medicine<->health dual-naming via
      // domain-identity.js — medicine is the URL/portal key, health the snapshot/runtime key consumed by
      // the domain brain). Mirrors energy's biosensor intake map (energy gates capex/dispatch by operator
      // regulation state — calm: greenlight capex programs / overloaded: triage grid/supply crises; health
      // gates clinical-program & pharma-R&D intake — calm: greenlight new trials and capacity / overloaded:
      // crisis triage on pandemic/drug-shortage only). Advisory-layer only and independent of the kernel
      // scoring spine. Consumed by (future) medicine-clarity-operator outcome tracking (clinical-trial
      // velocity, drug-approval throughput, hospital-capacity utilization, precision-medicine R&D momentum,
      // reimbursement/outbreak-triage cadence, drug-shortage/pandemic response). MEDICINE identity only —
      // healthcare & medicine, pharmaceuticals & biotech, hospitals & care providers, medical devices &
      // diagnostics, public health & disease control, clinical research & trials, health systems &
      // insurance, drug development. Reference healthcare-identity names: UNH, JNJ, PFE, MRK, ABBV, LLY,
      // TMO, ABT, MDT, ISRG, HCA, CVS, AMGN, GILD. Distinct from science (basic biomedical research is a
      // coupling, not the identity), population (demographics/disease burden is a coupling) and economy
      // (health spending is a coupling); never adopts energy oil/gas/grid content. Operator arousal/
      // coherence during active diagnoses or outbreaks gate clinical & R&D intake (high arousal = crisis
      // outbreak/shortage-triage mode; low arousal = deliberate trial-expansion / R&D mode). STRICTLY
      // ADDITIVE — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand clinical and pharma investment: greenlight new clinical trials and study enrollment (PFE/MRK/LLY/ABBV/AMGN/GILD pipelines), expand hospital capacity and new care lines (HCA/UNH service-line build-out, CVS/UNH care-delivery growth), invest in precision-medicine and diagnostics R&D (TMO/ABT/MDT/ISRG device & assay roadmaps); open speculative new therapeutic-area and platform scouting (JNJ/LLY discovery programs).',
        focused: 'Productive engagement — sustain in-flight drug approvals and active trials (PFE/MRK/LLY/ABBV regulatory submissions, AMGN/GILD ongoing studies); admit only well-scoped new intake (single-indication trials, proven device iterations, scoped capacity additions — HCA/UNH defined service lines); hold open-ended new programs and speculative therapeutic-area expansion (TMO/ABT/MDT product lines steady, ISRG platform disciplined).',
        pressured: 'Elevated load — defer discretionary research and new trial intake; focus on reimbursement and outbreak triage: protect in-flight approvals and statutory/FDA deadlines, prioritize payer/reimbursement disputes and coverage decisions (UNH/CVS), and keep capacity-utilization and disease-surveillance monitoring active on live caseloads (HCA throughput, MRK/PFE supply continuity); pause non-urgent precision-medicine programs.',
        overloaded: 'Saturated — pause all new clinical programs and pharma R&D intake; respond only to pandemic/epidemic, drug-shortage and acute care-system crises: outbreak and disease-control response (PFE/MRK/JNJ vaccine & antiviral surge, public-health containment), critical drug and device shortages (AMGN/GILD/ABBV supply continuity, MDT/ABT device availability), and hospital-capacity overload (HCA/UNH surge triage, ICU/staffing crisis).',
        recovering: 'Stabilizing — resume trial expansion and supply stabilization first (re-establish enrollment, restore drug/device inventory, reopen elective capacity — HCA/ISRG procedure backlog), then reopen pharma R&D and precision-medicine programs gradually as hospital utilization, drug-supply, trial-enrollment and reimbursement metrics normalize (PFE/MRK/LLY/ABBV pipelines, TMO/ABT/MDT R&D).',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active care-delivery / outbreak-stress signals and clinical-criticality / drug-shortage ranking).'
      }
    },
    education: {
      label: 'Learning engagement and cognitive capacity',
      arousal: 'Engagement level — moderate arousal reflects productive learning state',
      coherence: 'Comprehension quality — high coherence during instruction suggests effective knowledge transfer',
      cognitiveLoad: 'Curriculum complexity — high load reflects deep processing or overextension'
    },
    technology: {
      label: 'AI/ML development intensity and execution pressure',
      arousal: 'Model-training urgency — high arousal during training-run failures or benchmarking deadlines reflects development acceleration',
      coherence: 'Code-quality consistency — low coherence during rapid feature shipping suggests technical-debt accumulation',
      cognitiveLoad: 'Architecture complexity — high load during multi-model ensemble training reflects engineering overextension',
      // R&D throughput-readiness map: regulation state → AI/ML & compute development intake posture.
      // Consumed by technology-clarity-operator outcome tracking (chip-design velocity, foundational-model
      // training schedule, inference-optimization iteration, cybersecurity-patch cadence, software/cloud
      // release momentum). Technology identity only — distinct from finance (fintech is a coupling, not
      // the identity) and from energy (compute demand is a coupling, not the identity): semiconductors &
      // compute, AI/ML, software & cloud, hardware & devices, cybersecurity, R&D & innovation pipelines,
      // platform networks, data infrastructure. Reference technology-identity names: AAPL, MSFT, NVDA,
      // GOOGL, META, AMZN, AVGO, ORCL, CRM, AMD, INTC, TSM, ASML, PLTR, CRWD, PANW. Operator AI/ML team
      // arousal/coherence during training runs gate R&D throughput (high arousal = acceleration/crisis
      // mode; low arousal = deliberate research mode). STRICTLY ADDITIVE — does not touch any validated
      // scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to initiate long-run research: foundation-model tuning and architecture exploration (NVDA/AMD compute, GOOGL/META/MSFT model programs), chip-design exploration (TSM/ASML/AVGO/INTC process and silicon roadmaps), and cybersecurity hardening (CRWD/PANW posture); open speculative platform and data-infrastructure initiatives.',
        focused: 'Productive engagement — sustain in-flight training pipelines and software/cloud release momentum (MSFT/AMZN/ORCL/CRM); admit only scoped inference optimization and well-defined model fine-tuning; hold open-ended new model research and speculative chip variants.',
        pressured: 'Elevated load — defer speculative model variants and new architecture exploration; focus on inference cost optimization and security audit (CRWD/PANW patch cadence); keep in-flight training and release pipelines disciplined.',
        overloaded: 'Saturated — pause new model research and chip-design exploration; triage compute bottleneck (GPU/accelerator capacity, NVDA/AMD allocation, TSM/ASML supply) and supply-chain risk; contain active security incidents and critical inference-cost overruns.',
        recovering: 'Stabilizing — resume optimization first (inference cost, pipeline efficiency, patch backlog), then reopen foundation-model research and chip-design exploration gradually as compute capacity, build-quality and security posture normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active compute-bottleneck and security-exposure ranking).'
      }
    },
    communication: {
      label: 'Information processing and signal clarity',
      arousal: 'Information urgency — high arousal during disinformation events reflects narrative processing pressure',
      coherence: 'Signal quality — low coherence during high-volume information reflects difficulty filtering noise',
      cognitiveLoad: 'Narrative complexity — high load with competing narratives reflects interpretive overload',
      // Information-ecosystem intake/triage readiness map: regulation state → media-literacy /
      // misinformation-detection R&D and telecom-resilience / spectrum-efficiency program intake posture.
      // Mirrors energy's biosensor intake map (energy gates capex/dispatch by operator regulation state —
      // calm: greenlight capex programs / overloaded: triage grid/supply crises; communication gates
      // media-literacy & telecom-redundancy intake — calm: open new fact-check / content-authentication
      // and network-hardening programs / overloaded: crisis triage on information-ecosystem and mass-outage
      // events only). Advisory-layer only and independent of the kernel scoring spine. Consumed by (future)
      // communication-clarity-operator outcome tracking (misinformation-monitoring throughput, content-
      // authentication R&D velocity, telecom-incident response cadence, network-resilience program momentum,
      // spectrum-efficiency research velocity, media-trust-signal recovery). COMMUNICATION identity only —
      // telecommunications & networks, connectivity & broadband, internet infrastructure (towers/fiber/
      // spectrum), media & broadcasting CHANNELS, journalism & news flow, information dissemination,
      // social-media platforms as distribution, public-discourse infrastructure. Reference communication-
      // identity names: VZ, T, TMUS, CMCSA, CHTR (telecom/broadband), CSCO, ANET (network hardware),
      // AMT, CCI, SBAC (towers/infrastructure), NWSA, NYT (journalism/news), META, GOOGL (platforms as
      // distribution). Distinct from culture (content/movements/scenes — communication is the CHANNELS/
      // networks/information-flow, not the content), technology (chips/software is a coupling, not the
      // identity) and intelligence (signals collection is a coupling). Operator arousal/coherence during
      // disinformation events or network disruptions gate media-literacy & telecom intake (high arousal =
      // crisis information-triage mode; low arousal = deliberate media-resilience / platform-research mode).
      // STRICTLY ADDITIVE — does not touch the validated P3 distress kernel (Thing1) scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand media-literacy and misinformation-detection R&D: fact-check platform development, content-authentication systems, counter-narrative infrastructure; open new telecom-resilience programs (VZ/T/TMUS network redundancy, CSCO/ANET hardening, satellite-backup planning); initiate spectrum-efficiency research (5G/6G architecture, unlicensed-band optimization); speculative platform-interoperability and decentralization scouting (META/GOOGL distribution research, AMT/CCI/SBAC tower-network expansion).',
        focused: 'Productive engagement — sustain active misinformation monitoring and telecom-incident response; admit only proven-vendor content-moderation and well-scoped network-resilience projects (CMCSA/CHTR broadband-uptime, CSCO/ANET scoped hardening); hold speculative new platform and spectrum initiatives.',
        pressured: 'Elevated load — defer discretionary media-literacy intake and new broadcast R&D; focus on real-time misinformation triage and critical connectivity monitoring on live service disruptions (VZ/T/TMUS network events, NWSA/NYT live news-flow integrity); keep fact-check and network-uptime surveillance active.',
        overloaded: 'Saturated — pause all new media/platform research and spectrum initiatives; respond only to critical information-ecosystem crises: large-scale censorship events and content-suppression waves, mass network outages affecting critical services (utility control, emergency comms — VZ/T/TMUS/CMCSA/CHTR backbone failures), coordinated disinformation campaigns with measurable public-harm impact (META/GOOGL distribution-amplified).',
        recovering: 'Stabilizing — resume misinformation counter-narrative and fact-check infrastructure first, then reopen telecom R&D and spectrum-efficiency programs gradually as network uptime (VZ/T/TMUS/CMCSA/CHTR), media-trust-signal recovery and information-integrity metrics normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active information-ecosystem stress and network-disruption / misinformation criticality ranking).'
      }
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
      cognitiveLoad: 'Situational awareness — high load with multiple threat vectors reflects cognitive bandwidth stress',
      // Force-readiness / threat-posture intake map: regulation state → defense procurement & readiness
      // intake/triage posture. Consumed by (future) defense-clarity-operator outcome tracking
      // (weapons-program milestone velocity, force-readiness metrics, munitions-stockpile replenishment,
      // alliance/basing throughput, deterrence-posture strength). Defense identity only — kinetic,
      // industrial & readiness, distinct from intelligence (collection/analysis/espionage is a coupling,
      // not the identity) and from technology (cyber/electronic warfare is a coupling, not the identity):
      // military spending & procurement, the defense industrial base, geopolitical conflict & deterrence,
      // weapons systems, military readiness, alliances & basing, electronic/kinetic warfare, strategic
      // deterrence. Defense couples to energy via fuel logistics and strategic petroleum reserves but
      // never adopts energy grid/oil/gas as its own content. Reference defense-identity names: LMT, RTX,
      // NOC, GD, BA, LHX, HII, LDOS, BAH, KTOS, AVAV. Operator arousal/coherence during active threats
      // gate procurement & readiness intake (high arousal = crisis force-readiness mode; low arousal =
      // deliberate modernization mode). STRICTLY ADDITIVE — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to greenlight new defense modernization: long-lead weapons systems (LMT/RTX/GD/BA/NOC), strategic deterrence posture strengthening, alliance expansion, advanced procurement.',
        focused: 'Productive engagement — sustain in-flight weapons programs and modernization (LMT/RTX/GD/LHX/HII production lines); admit only proven procurement and well-scoped alliance work; hold open-ended new long-cycle weapons intake.',
        pressured: 'Elevated load — defer speculative modernization and new long-cycle weapons intake; focus on force readiness and critical operational deployment (sustainment, munitions logistics, basing support — LDOS/BAH services, KTOS/AVAV attritable systems).',
        overloaded: 'Saturated — pause new weapons procurement; triage critical force-readiness and munitions-stockpile replenishment, alliance stress containment (active-theater sustainment, interceptor/missile inventory, deterrence posture under strain).',
        recovering: 'Stabilizing — resume maintenance and readiness assessment first, then reopen procurement gradually as force-readiness metrics normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (force-readiness backlog and threat-vector criticality ranking).'
      }
    },
    environment: {
      label: 'Ecological monitoring and response urgency',
      arousal: 'Environmental urgency — high arousal during ecological crises reflects time-critical intervention pressure',
      coherence: 'Assessment quality — low coherence during compound environmental stress suggests overwhelmed monitoring',
      cognitiveLoad: 'System complexity — high load with interacting environmental factors reflects analytical difficulty',
      // Environmental-program intake/triage readiness map: regulation state → monitoring,
      // research and remediation program intake velocity and compliance/remediation urgency.
      // Mirrors energy's biosensor intake map (energy gates capex/dispatch; environment gates
      // monitoring/research/remediation program intake by operator regulation state) — both are
      // advisory-layer only and independent of the kernel scoring spine. Consumed by (future)
      // environment-clarity-operator outcome tracking (monitoring-program coverage, remediation-project
      // velocity, conservation-initiative throughput, compliance-deadline timeliness, climate-risk
      // adaptation cadence). ENVIRONMENT identity only — climate & emissions, air/water/soil pollution
      // & quality, ecosystems & biodiversity, natural resources & conservation, environmental regulation
      // & compliance, climate risk & adaptation, waste management & remediation, carbon markets. Distinct
      // from energy (couples via emissions/carbon but environment never adopts grid/oil/gas/power-
      // generation as its own content) and from agriculture (land/water use is a coupling, not the
      // identity). Reference environmental-sector names: WM, RSG, WCN, CWST (waste & remediation), AWK,
      // WTRG, XYL (water utilities & infrastructure), ECL (water/hygiene treatment), LIN, APD (industrial
      // gases & carbon-capture/clean-energy enablement), DAR (rendering & recycling), AY (clean
      // infrastructure). Operator arousal/coherence during environmental crises gate monitoring/research/
      // remediation intake (high arousal = crisis pollution/biodiversity/climate-triage mode; low arousal
      // = deliberate monitoring/research-expansion mode). STRICTLY ADDITIVE — does not touch any validated
      // scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand environmental research and monitoring programs: stand up new air/water/soil quality monitoring networks, invest in remediation and waste-treatment technology (WM/RSG/WCN/CWST recycling & landfill-gas, DAR rendering & circular processing, ECL water treatment), and launch new conservation and biodiversity initiatives; open speculative climate-risk adaptation and carbon-market (LIN/APD carbon-capture, AY clean-infrastructure) programs.',
        focused: 'Productive engagement — sustain active monitoring and in-flight conservation projects (WTRG/AWK/XYL water-infrastructure operations, WM/RSG live remediation sites); admit only well-scoped new intake (single-site cleanup, proven monitoring expansions, scoped compliance reporting); hold open-ended speculative research and new conservation programs.',
        pressured: 'Elevated load — defer speculative environmental programs and new research intake; focus on active pollution, biodiversity and climate triage: protect ongoing remediation, prioritize at-risk ecosystems and exceedance events, and keep compliance-deadline and discharge/emissions monitoring active on live sites.',
        overloaded: 'Saturated — pause all new initiatives; triage critical emissions, water and ecosystem failures: acute air/water/soil contamination events (WM/RSG/CWST spill and hazardous-waste response, ECL/WTRG/AWK water-quality breaches), regulatory compliance violations and remediation-deadline failures, and irreversible biodiversity/ecosystem-collapse risk.',
        recovering: 'Stabilizing — resume monitoring first (re-establish air/water/soil sensing and compliance reporting on restored sites), then gradually reopen research and conservation programs as environmental-quality indicators, remediation-completion rates and compliance posture normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active environmental-exceedance signals and ecosystem/compliance-criticality ranking).'
      }
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
      cognitiveLoad: 'Modeling complexity — high load with migration and aging data reflects analytical burden',
      // Demographic intake/triage readiness map: regulation state → demographic-research,
      // population-monitoring and demographic-policy intake/triage cadence. Mirrors economy's
      // indicator-based biosensor intake map (economy gates macro research-intake by operator
      // regulation state; population gates demographic-research, settlement/migration-monitoring and
      // demographic-policy intake) — advisory-layer only and independent of the kernel scoring spine.
      // Consumed by (future) population-clarity-operator outcome tracking (demographic-forecasting
      // horizon, population-research throughput, settlement/migration-monitoring focus, fertility/
      // mortality & aging tail-risk triage, household-formation & housing-demand cadence). POPULATION
      // identity only — demographics & population dynamics, migration & immigration, urbanization &
      // settlement, fertility & mortality, aging & generational shifts, labor-force & human-capital
      // supply, household formation & housing demand, social structure & inequality. Population binds
      // mostly to INDICATORS & DATA SOURCES not single companies: US Census Bureau (decennial census,
      // ACS American Community Survey, Population Estimates Program), UN World Population Prospects (WPP),
      // Pew Research Center (migration/generational/social trends), BLS (CPS labor-force & participation),
      // CDC/NCHS (NVSS births/deaths, fertility & mortality rates), Census migration/ACS-flows. Where
      // demographic-exposed entities are needed use REAL proxies: WELL, VTR (senior-living / aging-
      // exposed REITs), PEAK/DOC (healthcare/senior real estate), AVB, EQR, INVH (housing & household-
      // formation-exposed residential REITs), LEN, DHI (homebuilders — housing demand). Distinct from
      // economy (labor MARKET is a coupling via labor-force supply, not population's content), medicine
      // (mortality/health burden is a coupling, not the identity), education (enrollment is a coupling)
      // and governance (immigration POLICY is a coupling). Never adopts energy oil/gas/grid content.
      // Operator arousal/coherence during population shocks gate demographic-research intake (high
      // arousal = reactive crisis-mode demographic triage; low arousal = deliberate demographic-analysis
      // mode). STRICTLY ADDITIVE — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand demographic-forecasting horizon: initiate long-run structural analysis (UN WPP century-scale population projections, Census long-term Population Estimates, cohort fertility/mortality and aging trajectories), open new research initiatives across migration & settlement, urbanization, household-formation & housing-demand (LEN/DHI homebuilding pipeline, AVB/EQR/INVH residential demand) and social-structure/inequality regimes; stand up new senior-living and aging-society studies (WELL/VTR/PEAK/DOC demand modeling).',
        focused: 'Productive engagement — sustain demographic monitoring and in-flight analysis (Census ACS / Population Estimates tracking, BLS CPS labor-force participation, CDC/NCHS NVSS births & deaths, Pew migration/generational releases); admit only incremental, well-scoped research additions (single-cohort studies, defined metro/migration-flow analyses, scoped housing-demand models) and hold open-ended new programs and speculative projection rebuilds.',
        pressured: 'Elevated load — defer non-urgent analysis and long-run structural projections; focus on real-time demographic monitoring and short-run assessment of the active situation: near-term migration-flow and settlement shifts, current fertility/mortality prints (CDC/NCHS), labor-force participation changes (BLS CPS) and immediate household-formation / housing-demand pressure on live markets.',
        overloaded: 'Saturated — pause all non-critical demographic research; respond only to immediate population shocks and triage demographic tail risks: acute migration/displacement surges and settlement crises, mortality spikes and fertility collapse (CDC/NCHS NVSS deterioration), rapid-aging dependency-ratio stress (WELL/VTR/PEAK senior-care capacity strain), and acute housing-demand / household-formation dislocations (AVB/EQR/INVH/LEN/DHI market shock).',
        recovering: 'Stabilizing — resume longer-run structural analysis first (cohort projections, urbanization and aging trajectories, household-formation outlooks), then reopen research programs gradually as migration flows, fertility/mortality rates, labor-force participation and housing-demand indicators settle and the demographic outlook normalizes.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active demographic-shock signals and population-dynamics-phase ranking — migration/settlement, fertility/mortality, aging and household-formation criticality).'
      }
    },
    law: {
      label: 'Legal-system capacity and regulatory-compliance pressure',
      arousal: 'Enforcement urgency — high arousal during legal crises reflects accelerated compliance and litigation timelines',
      coherence: 'Interpretive consistency — low coherence during regulatory change or shifting precedent suggests uncertain compliance posture',
      cognitiveLoad: 'Legal complexity — high load with competing regulations and concurrent dockets reflects compliance overload',
      // Legal-process intake/triage readiness map: regulation state → legal-process modernization,
      // regulatory-compliance cadence and litigation-management intake/triage posture. Mirrors energy's
      // biosensor intake map (energy gates capex/dispatch by operator regulation state — calm: greenlight
      // capex programs / overloaded: triage grid/supply crises; law gates legal-process intake — calm:
      // expand legal-process modernization & access-to-justice R&D / overloaded: triage rule-of-law and
      // enforcement crises only). Advisory-layer only and independent of the kernel scoring spine.
      // Consumed by (future) law-clarity-operator outcome tracking (legal-process modernization velocity,
      // regulatory-compliance throughput, litigation/docket-management cadence, appeal/in-flight-matter
      // momentum, enforcement-action timeliness, access-to-justice program coverage). LAW identity only —
      // the JUDICIAL / legal system & courts, judiciary & rule of law, litigation & dispute resolution,
      // regulation & compliance, contracts & enforcement, intellectual-property law, criminal justice,
      // legal services & access to justice. Law binds mostly to AUTHORITIES & INDICATORS not single
      // companies: judicial/rule-of-law indices and bodies — US Courts (federal judiciary caseload /
      // docket statistics), SCOTUS (Supreme Court docket & decisions), DOJ (enforcement & prosecution),
      // ABA (American Bar Association — bar/access-to-justice metrics), World Justice Project Rule-of-Law
      // Index. Where legal-sector entities are needed use REAL identifiers: RELX (LexisNexis legal
      // research & analytics), TRI (Thomson Reuters — Westlaw), VERX (Vertex — tax/regulatory compliance),
      // CSGP (CoStar — legal/property data). Distinct from governance (policy/administration/elections is
      // the governance domain — law is the JUDICIAL/courts/enforcement side), finance (capital markets)
      // and intelligence (collection/analysis). Never adopts energy oil/gas/grid content. Operator
      // arousal/coherence during legal crises gate legal-process intake (high arousal = crisis rule-of-law
      // / enforcement-triage mode; low arousal = deliberate legal-modernization / access-to-justice mode).
      // STRICTLY ADDITIVE — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand legal-process modernization and access-to-justice R&D: open new e-filing / court-technology and case-management modernization programs (RELX/TRI legal-research & docketing platforms, VERX compliance automation), stand up new access-to-justice and self-represented-litigant initiatives (ABA pro-bono and legal-aid programs), launch long-horizon rule-of-law and regulatory-framework studies (World Justice Project Rule-of-Law Index benchmarking, US Courts caseload-trend analysis); open speculative IP-law, alternative-dispute-resolution and contract-automation scouting.',
        focused: 'Productive engagement — sustain active litigation and in-flight appeals (ongoing dockets, SCOTUS/appellate matters, regulatory-comment cycles); admit only well-scoped new intake (single-matter filings, proven compliance reviews, scoped IP prosecutions — RELX/TRI research-supported, VERX-scoped compliance updates); hold open-ended new modernization programs and speculative access-to-justice expansion (DOJ enforcement engagements steady, court-technology rollouts disciplined).',
        pressured: 'Elevated load — defer discretionary legal programs and new legal-process-modernization intake; focus on real-time docket and compliance triage of the active situation: protect in-flight litigation and statutory/filing deadlines, prioritize high-stakes appeals and regulatory-compliance obligations, and keep enforcement-action and contract-deadline monitoring active on live matters; pause non-urgent access-to-justice and modernization programs.',
        overloaded: 'Saturated — pause all non-critical litigation and new legal intake; triage rule-of-law and enforcement crises only: constitutional and rule-of-law breakdowns (World Justice Project / institutional-integrity deterioration), criminal-justice and enforcement emergencies (DOJ urgent prosecutions, due-process and detention crises), critical regulatory-compliance failures and emergency injunctions, and SCOTUS/appellate emergency dockets with systemic legal-system impact.',
        recovering: 'Stabilizing — resume legal-process modernization first (re-establish court-technology and case-management rollouts, restore docket throughput and compliance reporting on cleared backlogs — RELX/TRI platforms, VERX compliance cadence), then reopen access-to-justice and regulatory-reform programs gradually as caseload backlog (US Courts), rule-of-law indicators (World Justice Project), enforcement timeliness (DOJ) and compliance posture normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active legal-process / compliance stress signals and litigation / rule-of-law criticality ranking).'
      }
    },
    intelligence: {
      label: 'Collection & analysis execution state',
      arousal: 'Alert level during active threats — high arousal during active threats or warning conditions reflects heightened surveillance/detection posture and time-critical tasking pressure',
      coherence: 'Analytical consistency under pressure — low coherence during information overload or contested reporting suggests degraded all-source assessment and fragmented analytic judgment',
      cognitiveLoad: 'Fusion complexity burden — high load while fusing multi-INT (SIGINT/HUMINT/GEOINT/OSINT) streams with weak/ambiguous signals reflects intensive correlation and pattern-detection effort',
      // Collection & analysis execution-readiness map: regulation state → intelligence collection,
      // analysis & counterintelligence intake/triage posture. Consumed by (future)
      // intelligence-clarity-operator outcome tracking (collection-program throughput, all-source
      // fusion cadence, liaison/source recruitment velocity, threat-warning timeliness,
      // insider-threat / counterintelligence containment). Intelligence identity only — collection &
      // analysis, distinct from defense (kinetic/industrial/readiness is a coupling, not the identity)
      // and from technology (cyber tooling is a coupling, not the identity): intelligence collection
      // (SIGINT/HUMINT/GEOINT/OSINT), all-source analysis & assessment, espionage &
      // counterintelligence, surveillance & reconnaissance, threat warning, covert action, information
      // & influence operations, security clearance & insider risk. Intelligence couples to defense via
      // threat warning and to technology via cyber/analytic tooling but never adopts their content as
      // its own. Reference intelligence-sector names: PLTR, BAH, LDOS, CACI, SAIC, KBR, VRNT, NICE,
      // VRSK. Operator arousal/coherence during active threats gate collection & analysis intake
      // (high arousal = crisis tactical-triage mode; low arousal = deliberate long-horizon collection
      // mode). STRICTLY ADDITIVE — does not touch any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to expand collection programs: open new long-term collection and all-source analysis initiatives, initiate liaison/source recruitment, stand up persistent surveillance & reconnaissance lines, and invest in fusion-platform and analytic tooling (PLTR fusion/analytics, BAH/SAIC/CACI all-source mission support, LDOS sensor & SIGINT processing, VRNT/NICE/VRSK analytics & monitoring).',
        focused: 'Productive engagement — sustain active collection and in-flight all-source analysis; admit only proven sources and well-scoped new tasking (validated HUMINT assets, established SIGINT/GEOINT targets, single-question OSINT pulls); hold open-ended speculative collection and unvetted recruitment (BAH/SAIC/CACI mission ops steady, PLTR fusion disciplined).',
        pressured: 'Elevated load — defer speculative collection and long-horizon analysis; focus on tactical triage of the active threat: prioritize indications-&-warning, time-sensitive collection on the live target, and short-fuse all-source products; pause non-urgent recruitment and program expansion (LDOS/VRNT processing focused on the active stream).',
        overloaded: 'Saturated — pause all new collection and analysis intake; triage insider-threat and counterintelligence containment: active espionage/leak exposure, compromised-source and clearance/insider-risk incidents, contested/denied-area collection failures, and critical threat-warning gaps (NICE/VRNT/VRSK monitoring on containment only).',
        recovering: 'Stabilizing — resume liaison & source-building first (re-establish trusted networks and proven feeds), then reopen long-term collection programs and speculative analysis gradually as fusion cadence, source reliability and threat-warning timeliness normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (active threat-warning signals and collection-gap / counterintelligence-criticality ranking).'
      }
    },
    industry: {
      label: 'Production coordination and maintenance pressure',
      arousal: 'Operational urgency — high arousal during equipment failures reflects immediate intervention pressure',
      coherence: 'Process quality — low coherence during multi-line disruptions suggests fragmented coordination',
      cognitiveLoad: 'Production complexity — high load with simultaneous maintenance demands reflects capacity stress',
      // Production-intake / maintenance-scheduling readiness map: regulation state → industrial
      // capex, production-line and equipment-maintenance intake/triage posture. Mirrors finance's
      // capital-deployment readiness (operator arousal/coherence → deployment velocity), but ties
      // production-intake and maintenance-scheduling to the same biosensor signals. Consumed by
      // industry-clarity-operator outcome tracking (capex-deployment velocity, capacity-utilization
      // trend, equipment-downtime / MTBF, automation-rollout momentum, supplier-partnership cadence).
      // Grounded in PMI (ISM Manufacturing), capacity utilization (TCU/Fed G.17) and equipment-downtime
      // / OEE signals. INDUSTRY identity only — manufacturing & industrial production, factory output &
      // capacity utilization, automation & robotics, heavy industry & capital goods, industrial supply
      // chains, machinery & equipment, industrial maintenance. Distinct from trade (logistics/commerce
      // is a coupling via sourced inputs, not the identity), economy (macro aggregate / INDPRO as a
      // series, not the operator's own content) and technology (automation/robotics couples in but
      // industry never adopts AI/ML/compute as its own content). Reference industrial-identity names:
      // CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV. Operator arousal/coherence during
      // equipment failures gate production & maintenance intake (high arousal = failure-triage mode;
      // low arousal = deliberate capex/automation-expansion mode). STRICTLY ADDITIVE — does not touch
      // any validated scoring spine.
      readiness: {
        calm: 'Steady operator state — safe to greenlight new capex: expand facility and production-line build-outs (CAT/DE heavy-equipment capacity, GE/GEV power & industrial systems, HON/EMR process plants), invest in automation and robotics (ROK/ETN/EMR controls, ITW/DOV machinery), and open new supplier/distribution partnerships; admit speculative new-line and greenfield programs.',
        focused: 'Productive engagement — sustain current production runs and throughput (MMM/ITW/DOV diversified lines, PH/ETN motion & power systems); admit only well-scoped equipment upgrades and proven-vendor capacity additions; hold open-ended new-line build-outs and speculative automation programs.',
        pressured: 'Elevated load — defer discretionary capex and new automation intake; focus on production-line triage: protect highest-output lines, sequence scheduled maintenance windows, and keep capacity-utilization and on-time-output monitoring active on live lines (HON/EMR/ROK plant uptime priority).',
        overloaded: 'Saturated — pause all new project and capex intake; triage equipment-failure and line-down events: critical machine breakdowns and unplanned downtime (CAT/DE/PH/ETN equipment), supply shortfalls of key components and materials, and safety-critical maintenance backlog on operational lines.',
        recovering: 'Stabilizing — resume deferred maintenance and reliability work first (restore MTBF, clear backlog, recalibrate automation — ROK/EMR controls), then reopen capex and production-line expansion gradually as capacity utilization, equipment uptime and PMI/order-book momentum normalize.',
        unknown: 'Regulation state unavailable — default to snapshot-driven prioritization (capacity-utilization and equipment-downtime signals with production-line criticality ranking).'
      }
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
