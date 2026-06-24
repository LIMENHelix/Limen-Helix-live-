/**
 * decision-memory.js
 * LIMEN HELIX — Decision Memory
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks recent user choices (domain focus, action type) and emits
 * concentration signals when repeated attention patterns emerge.
 *
 * Depends on: window.LIMENGlobalState, window.LIMENCrossDomain
 * Listens: limen:user-action
 * Emits: limen:decision-memory-update, limen:phase-change (concentration)
 * Output: window.LIMENDecisionMemory
 *
 * Load order: after event-narrator.js
 */

(function () {
  'use strict';

  var MAX_ENTRIES = 20;
  var CONCENTRATION_THRESHOLD = 3; // same domain N times triggers narrator
  var CONCENTRATION_COOLDOWN = 120000; // 2 min between concentration narrations
  var CHECK_MS = 10000;
  var INFRA_STACK_THRESHOLD = 2; // a vulnerability stack seen N times signals concentration
  var INFRA_STACK_COOLDOWN = 180000; // 3 min between infra-stack narrations
  var CULTURE_STACK_THRESHOLD = 2; // a cultural-concern stack seen N times signals concentration
  var CULTURE_STACK_COOLDOWN = 180000; // 3 min between culture-stack narrations
  var FINANCE_STACK_THRESHOLD = 2; // a financial-vulnerability stack seen N times signals concentration
  var FINANCE_STACK_COOLDOWN = 180000; // 3 min between finance-stack narrations
  var ECONOMY_STACK_THRESHOLD = 2; // a macroeconomic-vulnerability stack seen N times signals concentration
  var ECONOMY_STACK_COOLDOWN = 180000; // 3 min between economy-stack narrations
  var TECHNOLOGY_STACK_THRESHOLD = 2; // a technology-vulnerability stack seen N times signals concentration
  var TECHNOLOGY_STACK_COOLDOWN = 180000; // 3 min between technology-stack narrations
  var INTELLIGENCE_STACK_THRESHOLD = 2; // an intelligence-vulnerability stack seen N times signals concentration
  var INTELLIGENCE_STACK_COOLDOWN = 180000; // 3 min between intelligence-stack narrations
  var TRADE_STACK_THRESHOLD = 2; // a trade/supply-chain-vulnerability stack seen N times signals concentration
  var TRADE_STACK_COOLDOWN = 180000; // 3 min between trade-stack narrations
  var INDUSTRY_STACK_THRESHOLD = 2; // an industrial-production-vulnerability stack seen N times signals concentration
  var INDUSTRY_STACK_COOLDOWN = 180000; // 3 min between industry-stack narrations
  var ENVIRONMENT_STACK_THRESHOLD = 2; // an environmental-vulnerability stack seen N times signals concentration
  var ENVIRONMENT_STACK_COOLDOWN = 180000; // 3 min between environment-stack narrations

  // ─── Infrastructure vulnerability-stack semantics ─────────────────────────
  // CIVIL domain-semantic concentration. Generic (domain, action) frequency only
  // says WHERE the operator is looking; for infrastructure we also detect WHAT
  // vulnerability STACK the attention concentrates on. Each stack is a co-occurring
  // pair of civil signal families (roads/bridges/water mains/the electric grid/
  // transit/dams-levees/cyber-physical SCADA/deferred maintenance/capital funding).
  // Mirrors the infrastructure-brain cross-domain conditions:
  //   SUPPLY_CHAIN_BOTTLENECK + MAINTENANCE_DEFICIT  → supply-side vulnerability
  //   MAINTENANCE_DEFICIT + CYBER_PHYSICAL_ATTACK    → cyber-resilient capital squeeze
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  var INFRA_SIGNAL_TOKENS = {
    MAINTENANCE_DEFICIT:      /(maintenance|deferred|backlog|asset[_\s-]?deterioration|asset[_\s-]?condition|inspection[_\s-]?fail|structural[_\s-]?stress|aging[_\s-]?infrastructure)/i,
    FUNDING_COLLAPSE:         /(funding|fiscal|budget[_\s-]?cut|capital[_\s-]?ration|capex|municipal[_\s-]?bond|bond[_\s-]?market|federal[_\s-]?grant|fiscal[_\s-]?crisis)/i,
    CYBER_PHYSICAL_ATTACK:    /(cyber|scada|ics|cisa|kev|cve|nvd|ransomware|exploit|advisor|physical[_\s-]?sabotage)/i,
    SUPPLY_CHAIN_BOTTLENECK:  /(supply[_\s-]?chain|materials[_\s-]?shortage|logistics|construction[_\s-]?delay|interconnection[_\s-]?delay|transformer[_\s-]?backlog)/i,
    GRID_DEGRADATION:         /(grid|transmission|distribution|substation|transformer|reserve[_\s-]?margin|utility[_\s-]?fail)/i,
    TRANSPORT_DISRUPTION:     /(road|bridge|highway|transit|port|rail|modal[_\s-]?shift|last[_\s-]?mile|congestion)/i,
    DAM_LEVEE_RISK:           /(dam|levee|floodwall|spillway|reservoir|breach)/i
  };

  // Vulnerability STACKS — ordered token pairs with a civil interpretation. Each
  // describes an operator-concentration meaning specific to an infrastructure
  // vulnerability stack (NOT energy oil/gas/nuclear/datacenter content).
  var INFRA_VULN_STACKS = [
    { id: 'CAPITAL_RATIONING',     signals: ['MAINTENANCE_DEFICIT', 'FUNDING_COLLAPSE'],
      body: 'Operator attention concentrates on the deferred-maintenance + funding-collapse stack — a capital-rationing posture across the civil asset base.' },
    { id: 'CYBER_RESILIENT_SQUEEZE', signals: ['CYBER_PHYSICAL_ATTACK', 'MAINTENANCE_DEFICIT'],
      body: 'Operator attention concentrates on the cyber-physical + deferred-maintenance stack — a capital squeeze on cyber-resilient (SCADA/ICS) upgrade spending.' },
    { id: 'SUPPLY_SIDE_VULNERABILITY', signals: ['CYBER_PHYSICAL_ATTACK', 'SUPPLY_CHAIN_BOTTLENECK'],
      body: 'Operator attention concentrates on the cyber-physical + supply-chain stack — focus on supply-side vulnerability of the build/repair pipeline.' },
    { id: 'GRID_FUNDING_STRESS',   signals: ['GRID_DEGRADATION', 'FUNDING_COLLAPSE'],
      body: 'Operator attention concentrates on the grid-degradation + funding-collapse stack — transmission/distribution reliability under capital constraint.' },
    { id: 'TRANSPORT_MAINTENANCE_GAP', signals: ['TRANSPORT_DISRUPTION', 'MAINTENANCE_DEFICIT'],
      body: 'Operator attention concentrates on the transport-disruption + deferred-maintenance stack — roads/bridges/transit assets past condition thresholds.' }
  ];

  // ─── Culture vulnerability-stack semantics ────────────────────────────────
  // CULTURAL domain-semantic concentration. As with infrastructure, generic
  // (domain, action) frequency only says WHERE the operator is looking; for the
  // culture domain we also detect WHAT cultural-concern STACK the attention
  // concentrates on. Each stack is a co-occurring pair of cultural signal families
  // (audience attention/virality/creators-and-artists/scenes-and-movements/
  // backlash-and-cancellation/saturation-and-fatigue/heritage-and-expression).
  // Mirrors the culture-brain cross-domain conditions:
  //   BACKLASH_ACCUMULATION + AUDIENCE_LOSS    → backlash-driven audience exodus
  //   CREATOR_BURNOUT + SCENE_DECLINE          → creator burnout hollowing a scene
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  var CULTURE_SIGNAL_TOKENS = {
    AUDIENCE_LOSS:           /(fanbase|audience|listener|viewer|follower|reach|engagement[_\s-]?drop|unfollow|churn|attention[_\s-]?loss)/i,
    VIRALITY_SHIFT:          /(virality|viral|breakout|trend|trending|momentum|emergence|tastemaker|algorithm|for[_\s-]?you)/i,
    CREATOR_BURNOUT:         /(creator|artist|musician|burnout|exhaustion|hiatus|output[_\s-]?decline|prolific|grind|content[_\s-]?treadmill)/i,
    SCENE_DECLINE:           /(scene|local[_\s-]?scene|genre|movement|subculture|venue[_\s-]?closure|underground|circuit|community[_\s-]?fade)/i,
    BACKLASH_ACCUMULATION:   /(backlash|cancel|cancellation|harassment|pile[_\s-]?on|controversy|outrage|discourse[_\s-]?storm|ratio)/i,
    SATURATION_FATIGUE:      /(saturation|oversaturation|fatigue|overexposure|formulaic|derivative|burnout[_\s-]?of[_\s-]?genre|trend[_\s-]?fatigue)/i,
    HERITAGE_EXPRESSION:     /(heritage|catalog|legacy|preservation|censorship|suppression|expression|de[_\s-]?platform|gatekeep|silencing)/i
  };

  // Cultural-concern STACKS — ordered token pairs with a cultural interpretation.
  // Each describes an operator-concentration meaning specific to a cultural
  // vulnerability stack (NOT energy oil/gas/nuclear/grid/datacenter content).
  var CULTURE_VULN_STACKS = [
    { id: 'BACKLASH_EXODUS',       signals: ['BACKLASH_ACCUMULATION', 'AUDIENCE_LOSS'],
      body: 'Operator attention concentrates on the backlash + audience-loss stack — controversy and discourse storms driving a fanbase exodus.' },
    { id: 'SCENE_HOLLOWING',       signals: ['CREATOR_BURNOUT', 'SCENE_DECLINE'],
      body: 'Operator attention concentrates on the creator-burnout + scene-decline stack — artists exhausting as the local scene/genre circuit thins out.' },
    { id: 'HERITAGE_CANCELLATION', signals: ['BACKLASH_ACCUMULATION', 'HERITAGE_EXPRESSION'],
      body: 'Operator attention concentrates on the cancellation + heritage-loss stack — backlash threatening catalog, legacy, and freedom of cultural expression.' },
    { id: 'FANBASE_FATIGUE',       signals: ['SATURATION_FATIGUE', 'AUDIENCE_LOSS'],
      body: 'Operator attention concentrates on the saturation + audience-loss stack — oversaturation and trend fatigue eroding a once-loyal fanbase.' },
    { id: 'EXPRESSION_COLLAPSE',   signals: ['HERITAGE_EXPRESSION', 'SCENE_DECLINE'],
      body: 'Operator attention concentrates on the expression-suppression + scene-decline stack — censorship/gatekeeping collapsing the space a movement lives in.' }
  ];

  // ─── Finance vulnerability-stack semantics ────────────────────────────────
  // FINANCIAL domain-semantic concentration. As with infrastructure and culture,
  // generic (domain, action) frequency only says WHERE the operator is looking; for
  // the finance domain we also detect WHAT financial-vulnerability STACK the attention
  // concentrates on. Each stack is a co-occurring pair of financial signal families
  // (liquidity & funding/credit spreads & lending/solvency & leverage/margin & collateral/
  // capital flows/default & covenant/counterparty & systemic exposure).
  // Mirrors the finance-brain cross-domain conditions:
  //   LIQUIDITY_CRUNCH + DEFAULT_RISK        → liquidity-driven default spiral
  //   MARGIN_CALL + CAPITAL_FLIGHT           → forced-deleveraging capital exodus
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: independent of the validated P3 distress kernel (Thing1) —
  // this advisory layer never participates in /api/limen/score scoring.
  var FINANCE_SIGNAL_TOKENS = {
    LIQUIDITY_CRUNCH:        /(liquidity|funding[_\s-]?gap|cash[_\s-]?crunch|runnable|deposit[_\s-]?flight|bank[_\s-]?run|frozen[_\s-]?market|illiquid|repo[_\s-]?freeze|funding[_\s-]?stress)/i,
    CREDIT_SPREAD:           /(credit[_\s-]?spread|spread[_\s-]?widen|cds|yield[_\s-]?spread|high[_\s-]?yield|junk[_\s-]?bond|distressed[_\s-]?debt|downgrade|rating[_\s-]?cut|credit[_\s-]?tighten)/i,
    SOLVENCY_PRESSURE:       /(solvency|insolvent|negative[_\s-]?equity|impairment|writedown|write[_\s-]?off|capital[_\s-]?shortfall|tier[_\s-]?1|undercapitalized|book[_\s-]?value[_\s-]?erosion)/i,
    MARGIN_CALL:             /(margin[_\s-]?call|collateral[_\s-]?call|haircut|forced[_\s-]?sale|liquidation|maintenance[_\s-]?margin|variation[_\s-]?margin|deleveraging|fire[_\s-]?sale)/i,
    CAPITAL_FLIGHT:          /(capital[_\s-]?flight|outflow|redemption|withdrawal|fund[_\s-]?run|deposit[_\s-]?outflow|risk[_\s-]?off|flight[_\s-]?to[_\s-]?quality|asset[_\s-]?reallocation)/i,
    DEFAULT_RISK:            /(default|bankruptcy|chapter[_\s-]?11|restructuring|missed[_\s-]?payment|delinquen|nonaccrual|non[_\s-]?performing|charge[_\s-]?off|distress)/i,
    COVENANT_BREACH:         /(covenant|breach|technical[_\s-]?default|leverage[_\s-]?ratio|coverage[_\s-]?ratio|waiver|forbearance|amendment|debt[_\s-]?service)/i,
    COUNTERPARTY_EXPOSURE:   /(counterparty|systemic|contagion|interconnected|exposure|derivative|clearing|too[_\s-]?big[_\s-]?to[_\s-]?fail|cascade|domino)/i
  };

  // Financial-vulnerability STACKS — ordered token pairs with a financial interpretation.
  // Each describes an operator-concentration meaning specific to a financial vulnerability
  // stack (capital markets, credit & lending, banking, liquidity & solvency, M&A, fintech,
  // corporate distress, systemic risk) — NOT energy oil/gas/grid/datacenter content.
  var FINANCE_VULN_STACKS = [
    { id: 'LIQUIDITY_DEFAULT',       signals: ['LIQUIDITY_CRUNCH', 'DEFAULT_RISK'],
      body: 'Operator attention concentrates on the liquidity-crunch + default-risk stack — a funding freeze tipping borrowers into a liquidity-driven default spiral.' },
    { id: 'MARGIN_CAPITAL_FLIGHT',   signals: ['MARGIN_CALL', 'CAPITAL_FLIGHT'],
      body: 'Operator attention concentrates on the margin-call + capital-flight stack — forced deleveraging and collateral calls driving a risk-off capital exodus.' },
    { id: 'CREDIT_SOLVENCY',         signals: ['CREDIT_SPREAD', 'SOLVENCY_PRESSURE'],
      body: 'Operator attention concentrates on the credit-spread + solvency-pressure stack — widening spreads and impairments eroding capital adequacy.' },
    { id: 'LEVERAGE_DELEVERAGING',   signals: ['COVENANT_BREACH', 'MARGIN_CALL'],
      body: 'Operator attention concentrates on the covenant-breach + margin-call stack — leverage limits breached, triggering forced deleveraging and fire sales.' },
    { id: 'REPO_HAIRCUT',            signals: ['COUNTERPARTY_EXPOSURE', 'LIQUIDITY_CRUNCH'],
      body: 'Operator attention concentrates on the counterparty-exposure + liquidity-crunch stack — repo haircuts and funding stress propagating systemic contagion.' }
  ];

  // ─── Economy vulnerability-stack semantics ────────────────────────────────
  // MACROECONOMIC domain-semantic concentration. As with infrastructure, culture and
  // finance, generic (domain, action) frequency only says WHERE the operator is
  // looking; for the economy domain we also detect WHAT macroeconomic-vulnerability
  // STACK the attention concentrates on. Each stack is a co-occurring pair of macro
  // signal families (GDP & growth/inflation CPI-PCE/employment & labor/demand & supply
  // shocks/credit cycle/monetary & fiscal policy/wages & productivity/capacity & output).
  // The economy is the MACRO AGGREGATE — distinct from finance (capital markets, credit,
  // banks). It binds to MACRO INDICATORS (real FRED series ids + broad-market proxies),
  // never single-company tickers. Mirrors the economy-node-business-engine neuro pairs:
  //   CBLM monetary-policy dysregulation + OFC price-formation dysregulation
  //                                          → policy/inflation regime stack
  //   DEMAND_SHOCK + UNEMPLOYMENT_SHOCK      → demand-destruction recessionary spiral
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: advisory only; never participates in /api/limen/score scoring
  // and never conflated with the finance capital-markets layer above.
  var ECONOMY_SIGNAL_TOKENS = {
    UNEMPLOYMENT_SHOCK:      /(unemployment|jobless|layoff|payroll|nonfarm|UNRATE|PAYMS|PAYEMS|initial[_\s-]?claims|labor[_\s-]?market|job[_\s-]?losses|hiring[_\s-]?freeze|labor[_\s-]?slack)/i,
    DEMAND_SHOCK:           /(demand[_\s-]?shock|consumer[_\s-]?spending|consumption|retail[_\s-]?sales|PCE|demand[_\s-]?collapse|aggregate[_\s-]?demand|spending[_\s-]?pullback|household[_\s-]?demand)/i,
    SUPPLY_SHOCK:           /(supply[_\s-]?shock|supply[_\s-]?constraint|production[_\s-]?cut|INDPRO|industrial[_\s-]?production|capacity[_\s-]?utilization|input[_\s-]?cost|commodity[_\s-]?shock|shortage[_\s-]?driven)/i,
    CREDIT_CRUNCH:          /(credit[_\s-]?crunch|credit[_\s-]?tightening|lending[_\s-]?standards|loan[_\s-]?contraction|bank[_\s-]?lending|credit[_\s-]?availability|money[_\s-]?supply|M2|disintermediation)/i,
    INFLATION_SURGE:        /(inflation|CPI|CPIAUCSL|PCEPI|price[_\s-]?level|price[_\s-]?surge|cost[_\s-]?of[_\s-]?living|overheating|inflation[_\s-]?expectations|sticky[_\s-]?inflation|price[_\s-]?pressure)/i,
    POLICY_ERROR:           /(policy[_\s-]?error|rate[_\s-]?miscalibration|fed[_\s-]?funds|FEDFUNDS|FOMC|tightening[_\s-]?cycle|easing[_\s-]?cycle|hawkish|dovish|monetary[_\s-]?misstep|fiscal[_\s-]?misstep|DGS10|yield[_\s-]?curve[_\s-]?inversion)/i,
    WAGE_STAGNATION:        /(wage[_\s-]?stagnation|real[_\s-]?wage|wage[_\s-]?growth|earnings[_\s-]?growth|purchasing[_\s-]?power|stagnant[_\s-]?wages|compensation[_\s-]?gap|wage[_\s-]?price[_\s-]?spiral|productivity[_\s-]?gap)/i,
    CAPACITY_COLLAPSE:      /(capacity[_\s-]?collapse|output[_\s-]?gap|recession|contraction|GDP|GDPC1|negative[_\s-]?growth|business[_\s-]?cycle|downturn|slack[_\s-]?economy|potential[_\s-]?output|stall[_\s-]?speed)/i
  };

  // Macroeconomic-vulnerability STACKS — ordered token pairs with a macro interpretation.
  // Each describes an operator-concentration meaning specific to a macroeconomic regime
  // (GDP & growth, inflation, employment, sentiment, fiscal & monetary policy, the
  // recession/expansion business cycle, trade, productivity, money supply) — the MACRO
  // AGGREGATE, NOT finance capital-markets and NOT energy oil/gas/grid/datacenter content.
  var ECONOMY_VULN_STACKS = [
    { id: 'STAGFLATION',            signals: ['INFLATION_SURGE', 'DEMAND_SHOCK'],
      body: 'Operator attention concentrates on the inflation-surge + demand-shock stack — a stagflationary regime where rising prices coincide with weakening aggregate demand.' },
    { id: 'CREDIT_CYCLE',           signals: ['CREDIT_CRUNCH', 'CAPACITY_COLLAPSE'],
      body: 'Operator attention concentrates on the credit-crunch + capacity-collapse stack — tightening lending and a closing output gap turning the credit cycle down into contraction.' },
    { id: 'POLICY_TRAP',            signals: ['POLICY_ERROR', 'INFLATION_SURGE'],
      body: 'Operator attention concentrates on the policy-error + inflation-surge stack — a monetary/fiscal policy trap where rate miscalibration lets inflation overshoot.' },
    { id: 'DEMAND_DESTRUCTION',     signals: ['DEMAND_SHOCK', 'UNEMPLOYMENT_SHOCK'],
      body: 'Operator attention concentrates on the demand-shock + unemployment-shock stack — collapsing consumption and rising joblessness driving a recessionary demand-destruction spiral.' },
    { id: 'REAL_WAGE_COLLAPSE',     signals: ['INFLATION_SURGE', 'WAGE_STAGNATION'],
      body: 'Operator attention concentrates on the inflation-surge + wage-stagnation stack — rising prices outpacing stagnant wages, eroding real purchasing power.' },
    { id: 'SUPPLY_SHOCK_SPILLOVER', signals: ['SUPPLY_SHOCK', 'CREDIT_CRUNCH'],
      body: 'Operator attention concentrates on the supply-shock + credit-crunch stack — a supply-side disruption spilling over into tighter credit and constrained financing.' }
  ];

  // ─── Technology vulnerability-stack semantics ─────────────────────────────
  // TECHNOLOGY domain-semantic concentration. As with infrastructure, culture,
  // finance and economy, generic (domain, action) frequency only says WHERE the
  // operator is looking; for the technology domain we also detect WHAT
  // technology-vulnerability STACK the attention concentrates on. Each stack is a
  // co-occurring pair of technology signal families (compute & GPU/TPU capacity/
  // semiconductor fab cycle & wafer starts & node migration/AI training & inference
  // capex/platform & API stability & vendor consolidation/cybersecurity 0-day &
  // supply-chain attack/hardware obsolescence & EOL/breakthrough emergence —
  // foundational models & quantum milestones/upstream supply allocation —
  // TSMC/ASML/rare-earth). The technology identity is CHIPS, SOFTWARE, AI, CLOUD,
  // HARDWARE, CYBERSECURITY and R&D pipelines — bound to real tech equities
  // (AAPL, MSFT, NVDA, GOOGL, META, AMZN, AVGO, ORCL, CRM, AMD, INTC, TSM, ASML,
  // PLTR, CRWD, PANW). Technology COUPLES to energy via compute/datacenter power
  // demand, but its OWN content is never energy oil/gas/grid; it is also kept
  // DISTINCT from finance (fintech is a coupling, not the identity).
  // Mirrors the technology-brain cross-domain conditions:
  //   COMPUTE_SHORTAGE + CHIP_CYCLE          → compute-crunch on foundational scaling
  //   AI_CAPEX + PLATFORM_SHIFT              → AI-cost lock-in
  //   CYBERSECURITY_FAILURE + SUPPLY_CONSTRAINT → supply-chain cyber exposure
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: advisory only; never participates in /api/limen/score scoring.
  var TECHNOLOGY_SIGNAL_TOKENS = {
    COMPUTE_SHORTAGE:          /(compute[_\s-]?shortage|gpu|tpu|accelerator|h100|h200|b200|datacenter[_\s-]?capacity|cluster|allocation[_\s-]?cap|compute[_\s-]?constrain|capacity[_\s-]?queue|interconnect[_\s-]?bottleneck)/i,
    CHIP_CYCLE:                /(fab|foundry|wafer[_\s-]?start|node[_\s-]?migration|process[_\s-]?node|3nm|2nm|tape[_\s-]?out|lead[_\s-]?time|chip[_\s-]?cycle|semiconductor[_\s-]?cycle|inventory[_\s-]?correction|yield[_\s-]?ramp)/i,
    AI_CAPEX:                  /(ai[_\s-]?capex|training[_\s-]?cost|inference[_\s-]?cost|per[_\s-]?token|cost[_\s-]?per[_\s-]?token|model[_\s-]?spend|flops|training[_\s-]?run|compute[_\s-]?budget|capex[_\s-]?spike|hyperscaler[_\s-]?spend)/i,
    PLATFORM_SHIFT:            /(api[_\s-]?deprecat|platform[_\s-]?shift|vendor[_\s-]?consolidation|vendor[_\s-]?lock|migration[_\s-]?forced|sunset|breaking[_\s-]?change|sdk[_\s-]?break|ecosystem[_\s-]?shift|stack[_\s-]?migration|pricing[_\s-]?change)/i,
    CYBERSECURITY_FAILURE:     /(0[_\s-]?day|zero[_\s-]?day|cve|breach|ransomware|supply[_\s-]?chain[_\s-]?attack|exploit|vulnerability|patch[_\s-]?lag|security[_\s-]?incident|data[_\s-]?breach|intrusion|backdoor)/i,
    OBSOLESCENCE_ACCELERATION: /(obsolescence|end[_\s-]?of[_\s-]?life|eol|hardware[_\s-]?refresh|deprecat|legacy[_\s-]?stack|tech[_\s-]?debt|sunset[_\s-]?roadmap|refresh[_\s-]?cycle|aging[_\s-]?hardware|forced[_\s-]?upgrade)/i,
    BREAKTHROUGH_EMERGENCE:    /(foundational[_\s-]?model|frontier[_\s-]?model|breakthrough|quantum[_\s-]?milestone|quantum[_\s-]?supremacy|capability[_\s-]?jump|emergent[_\s-]?capability|paradigm[_\s-]?shift|state[_\s-]?of[_\s-]?the[_\s-]?art|architecture[_\s-]?leap|model[_\s-]?release)/i,
    SUPPLY_CONSTRAINT:         /(tsmc|asml|euv|rare[_\s-]?earth|substrate[_\s-]?shortage|hbm|cowos|advanced[_\s-]?packaging|allocation[_\s-]?priority|supply[_\s-]?lead[_\s-]?time|export[_\s-]?control|foundry[_\s-]?allocation|component[_\s-]?shortage)/i
  };

  // Technology-vulnerability STACKS — ordered token pairs with a technology interpretation.
  // Each describes an operator-concentration meaning specific to a technology vulnerability
  // stack (semiconductors & compute, AI/ML, software & cloud, hardware & devices,
  // cybersecurity, R&D & innovation pipelines, platform networks, data infrastructure) —
  // NOT energy oil/gas/grid content and NOT finance capital-markets content.
  var TECHNOLOGY_VULN_STACKS = [
    { id: 'COMPUTE_SCALING_CRUNCH', signals: ['COMPUTE_SHORTAGE', 'CHIP_CYCLE'],
      body: 'Operator attention concentrates on the compute-shortage + chip-cycle stack — a compute crunch on foundational scaling as GPU/TPU capacity collides with fab lead-times and node migration.' },
    { id: 'AI_COST_LOCK_IN',        signals: ['AI_CAPEX', 'PLATFORM_SHIFT'],
      body: 'Operator attention concentrates on the AI-capex + platform-shift stack — training/inference cost inflation compounding with API deprecation and vendor consolidation into AI cost lock-in.' },
    { id: 'SUPPLY_CHAIN_CYBER_EXPOSURE', signals: ['CYBERSECURITY_FAILURE', 'SUPPLY_CONSTRAINT'],
      body: 'Operator attention concentrates on the cybersecurity-failure + supply-constraint stack — supply-chain attacks and 0-days landing on top of TSMC/ASML/rare-earth allocation pressure.' },
    { id: 'OBSOLESCENCE_PLATFORM_DEBT', signals: ['OBSOLESCENCE_ACCELERATION', 'PLATFORM_SHIFT'],
      body: 'Operator attention concentrates on the obsolescence + platform-shift stack — accelerating hardware EOL forcing migrations as vendors deprecate APIs and consolidate stacks.' },
    { id: 'BREAKTHROUGH_COMPUTE_RACE', signals: ['BREAKTHROUGH_EMERGENCE', 'COMPUTE_SHORTAGE'],
      body: 'Operator attention concentrates on the breakthrough-emergence + compute-shortage stack — frontier model and quantum milestones intensifying scarcity in accelerator capacity.' }
  ];

  // ─── Intelligence vulnerability-stack semantics ───────────────────────────
  // INTELLIGENCE domain-semantic concentration. As with infrastructure, culture,
  // finance, economy and technology, generic (domain, action) frequency only says
  // WHERE the operator is looking; for the intelligence domain we also detect WHAT
  // intelligence-vulnerability STACK the attention concentrates on. Each stack is a
  // co-occurring pair of intelligence signal families (collection coverage —
  // SIGINT/HUMINT/GEOINT/OSINT/MASINT/IMINT/the collection gap & blind spot/
  // all-source analysis fusion, assessment bias & analytic distortion/oversight,
  // compartmentalization & accountability failure/trust boundary, clearance &
  // need-to-know breach/counterintelligence — espionage, foreign agents, insider
  // threat/adversarial penetration — network intrusion, compromise, exfiltration/
  // deception — disinformation, denial, information contamination, fabrication).
  // The intelligence identity is COLLECTION, ALL-SOURCE ANALYSIS & ASSESSMENT,
  // ESPIONAGE & COUNTERINTELLIGENCE, SURVEILLANCE & RECONNAISSANCE, THREAT WARNING,
  // COVERT ACTION, INFORMATION & INFLUENCE OPERATIONS, and SECURITY CLEARANCE &
  // INSIDER RISK — bound to real intelligence-sector equities (PLTR, BAH, LDOS,
  // CACI, SAIC, KBR, VRNT, NICE, VRSK). Intelligence is kept DISTINCT from defense
  // (defense = kinetic/industrial/readiness; intelligence = collection/analysis/
  // espionage) and from technology (cyber tooling is a coupling, not the identity).
  // Mirrors the intelligence-brain cross-domain conditions:
  //   COLLECTION_GAP + ANALYTICAL_DISTORTION       → observability fusion deficit
  //   ADVERSARIAL_PENETRATION + COUNTERINTELLIGENCE_FAILURE → active espionage exposure
  //   OVERSIGHT_FAILURE + TRUST_BOUNDARY_BREACH     → accountability/compartmentation gap
  //   DECEPTION_EXPOSURE + ADVERSARIAL_PENETRATION  → contaminated-feed compromise
  //   COUNTERINTELLIGENCE_FAILURE + TRUST_BOUNDARY_BREACH → insider-threat exposure
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: advisory only; never participates in /api/limen/score scoring.
  var INTELLIGENCE_SIGNAL_TOKENS = {
    COLLECTION_GAP:            /(collection[_\s-]?gap|coverage[_\s-]?gap|blind[_\s-]?spot|sigint|humint|geoint|osint|masint|imint|elint|comint|sensor[_\s-]?gap|tasking[_\s-]?gap|denied[_\s-]?area|hard[_\s-]?target|gap[_\s-]?in[_\s-]?collection)/i,
    ANALYTICAL_DISTORTION:     /(analytic[_\s-]?bias|analytical[_\s-]?distortion|assessment[_\s-]?bias|mirror[_\s-]?imaging|groupthink|cognitive[_\s-]?bias|confirmation[_\s-]?bias|politici[sz]ation|estimate[_\s-]?error|all[_\s-]?source[_\s-]?fusion|fusion[_\s-]?failure|key[_\s-]?judgment|warning[_\s-]?failure)/i,
    OVERSIGHT_FAILURE:         /(oversight[_\s-]?failure|accountability|compartmentalization|compartmentation|need[_\s-]?to[_\s-]?know|over[_\s-]?classification|audit[_\s-]?failure|fisa|congressional[_\s-]?oversight|inspector[_\s-]?general|authoriz|abuse[_\s-]?of[_\s-]?authority|unauthorized[_\s-]?surveillance)/i,
    TRUST_BOUNDARY_BREACH:     /(trust[_\s-]?boundary|clearance|security[_\s-]?clearance|sci|tssci|polygraph|access[_\s-]?control|need[_\s-]?to[_\s-]?know[_\s-]?breach|classification[_\s-]?breach|spillage|cross[_\s-]?domain|enclave[_\s-]?breach|privilege[_\s-]?escalation)/i,
    COUNTERINTELLIGENCE_FAILURE: /(counterintelligence|counter[_\s-]?intel|ci[_\s-]?failure|espionage|spy|foreign[_\s-]?agent|mole|double[_\s-]?agent|insider[_\s-]?threat|insider[_\s-]?risk|recruitment|defector|tradecraft[_\s-]?compromise|asset[_\s-]?compromise)/i,
    ADVERSARIAL_PENETRATION:   /(penetration|network[_\s-]?intrusion|intrusion|exfiltration|exfil|compromise|breach|implant|backdoor|lateral[_\s-]?movement|apt|nation[_\s-]?state[_\s-]?actor|supply[_\s-]?chain[_\s-]?compromise|watering[_\s-]?hole)/i,
    DECEPTION_EXPOSURE:        /(deception|disinformation|misinformation|denial[_\s-]?and[_\s-]?deception|maskirovka|fabrication|forgery|information[_\s-]?contamination|poisoned[_\s-]?feed|false[_\s-]?flag|influence[_\s-]?operation|active[_\s-]?measures|provenance[_\s-]?failure)/i,
    SURVEILLANCE_RECON:        /(surveillance|reconnaissance|recon|isr|overhead|satellite[_\s-]?imagery|signals[_\s-]?intercept|tracking|pattern[_\s-]?of[_\s-]?life|persistent[_\s-]?surveillance|target[_\s-]?package|watch[_\s-]?list|threat[_\s-]?warning|indications[_\s-]?and[_\s-]?warning)/i
  };

  // Intelligence-vulnerability STACKS — ordered token pairs with an intelligence
  // interpretation. Each describes an operator-concentration meaning specific to an
  // intelligence vulnerability stack (collection & ISR, all-source analysis,
  // espionage & counterintelligence, oversight & clearance, deception & influence
  // operations) — NOT energy oil/gas/grid content, NOT finance capital-markets
  // content, NOT defense kinetic/readiness content, and NOT technology cyber-tooling
  // as identity (cyber is a coupling here, not the domain identity).
  var INTELLIGENCE_VULN_STACKS = [
    { id: 'OBSERVABILITY_FUSION_DEFICIT', signals: ['COLLECTION_GAP', 'ANALYTICAL_DISTORTION'],
      body: 'Operator attention concentrates on the collection-gap + analytical-distortion stack — an observability fusion deficit where blind spots in SIGINT/HUMINT/GEOINT collection compound with biased all-source assessment.' },
    { id: 'ACTIVE_ESPIONAGE_EXPOSURE', signals: ['ADVERSARIAL_PENETRATION', 'COUNTERINTELLIGENCE_FAILURE'],
      body: 'Operator attention concentrates on the adversarial-penetration + counterintelligence-failure stack — active espionage exposure as network intrusion and exfiltration combine with foreign-agent and insider-threat compromise.' },
    { id: 'ACCOUNTABILITY_COMPARTMENT_GAP', signals: ['OVERSIGHT_FAILURE', 'TRUST_BOUNDARY_BREACH'],
      body: 'Operator attention concentrates on the oversight-failure + trust-boundary-breach stack — an accountability and compartmentation gap where weak oversight collides with clearance and need-to-know breaches.' },
    { id: 'CONTAMINATED_FEED_COMPROMISE', signals: ['DECEPTION_EXPOSURE', 'ADVERSARIAL_PENETRATION'],
      body: 'Operator attention concentrates on the deception-exposure + adversarial-penetration stack — contaminated-feed compromise as disinformation and fabrication ride on top of penetrated, exfiltrated channels.' },
    { id: 'INSIDER_THREAT_EXPOSURE', signals: ['COUNTERINTELLIGENCE_FAILURE', 'TRUST_BOUNDARY_BREACH'],
      body: 'Operator attention concentrates on the counterintelligence-failure + trust-boundary-breach stack — insider-threat exposure as recruited or compromised insiders exploit clearance and access-control weaknesses.' }
  ];

  // ─── Trade / supply-chain vulnerability-stack semantics ───────────────────
  // TRADE domain-semantic concentration. As with infrastructure, culture, finance,
  // economy, technology and intelligence, generic (domain, action) frequency only
  // says WHERE the operator is looking; for the trade domain we also detect WHAT
  // trade-vulnerability STACK the attention concentrates on. Each stack is a
  // co-occurring pair of trade signal families (tariffs & trade policy/sanctions &
  // embargoes/ports & maritime chokepoints/freight & shipping cost/customs &
  // border friction/supply-chain disruption/export & import collapse/strategic
  // chokepoint closure). The trade identity is INTERNATIONAL TRADE & COMMERCE,
  // EXPORTS/IMPORTS, TARIFFS & TRADE POLICY, SHIPPING & LOGISTICS, SUPPLY CHAINS,
  // TRADE BALANCE, CUSTOMS, TRADE AGREEMENTS, SANCTIONS/EMBARGOES, and FREIGHT &
  // PORTS — bound to real trade/logistics equities (FDX, UPS, EXPD, CHRW, ZIM,
  // MATX, XPO, GXO, AMKBY, DSDVY, ODFL). Trade is kept DISTINCT from economy
  // (the macro aggregate) and from industry (production) — it is the FLOW of goods
  // across borders and the logistics that carry them, never energy oil/gas/grid as
  // its own content. NOTE: the trade domain uses runtime/snapshot key 'supplyChain'
  // (trade↔supplyChain dual-naming via domain-identity.js); this advisory layer
  // narrates under the canonical/portal key 'trade' to match the other emitters.
  // Mirrors the trade-brain cross-domain conditions:
  //   TARIFF_ESCALATION + PORT_DISRUPTION       → trade-war escalation
  //   SHIPPING_CRISIS + CUSTOMS_FRICTION         → logistics paralysis
  //   SUPPLY_DISRUPTION + FREIGHT_COST           → cost-transmission cascade
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: advisory only; never participates in /api/limen/score scoring.
  var TRADE_SIGNAL_TOKENS = {
    TARIFF_ESCALATION:   /(tariff|trade[_\s-]?war|duty|duties|protectionism|trade[_\s-]?barrier|retaliatory[_\s-]?tariff|section[_\s-]?301|section[_\s-]?232|import[_\s-]?levy|trade[_\s-]?policy|antidumping|countervailing)/i,
    SANCTIONS_IMPACT:    /(sanction|embargo|export[_\s-]?control|entity[_\s-]?list|ofac|trade[_\s-]?restriction|blacklist|denied[_\s-]?party|secondary[_\s-]?sanction|decoupling|trade[_\s-]?ban)/i,
    PORT_DISRUPTION:     /(port|harbor|terminal|berth|port[_\s-]?congestion|port[_\s-]?strike|dockworker|longshore|port[_\s-]?closure|maritime[_\s-]?chokepoint|suez|panama[_\s-]?canal|strait[_\s-]?of[_\s-]?hormuz|blockade)/i,
    FREIGHT_COST:        /(freight|shipping[_\s-]?rate|container[_\s-]?rate|drewry|baltic[_\s-]?dry|bdi|spot[_\s-]?rate|trucking[_\s-]?rate|freight[_\s-]?spike|ocean[_\s-]?freight|air[_\s-]?freight|demurrage|detention[_\s-]?fee)/i,
    SHIPPING_CRISIS:     /(shipping[_\s-]?crisis|vessel|container[_\s-]?shortage|liner|carrier[_\s-]?capacity|blank[_\s-]?sailing|rerouting|cape[_\s-]?of[_\s-]?good[_\s-]?hope|red[_\s-]?sea|transit[_\s-]?delay|schedule[_\s-]?reliability|backlog[_\s-]?at[_\s-]?sea)/i,
    CUSTOMS_FRICTION:    /(customs|border[_\s-]?delay|clearance|inspection[_\s-]?hold|cbp|rules[_\s-]?of[_\s-]?origin|documentation[_\s-]?error|trade[_\s-]?compliance|broker[_\s-]?delay|border[_\s-]?friction|red[_\s-]?tape|de[_\s-]?minimis)/i,
    SUPPLY_DISRUPTION:   /(supply[_\s-]?chain[_\s-]?disruption|supply[_\s-]?disruption|bottleneck|component[_\s-]?shortage|stockout|inventory[_\s-]?shortfall|sole[_\s-]?source|reshoring|nearshoring|supplier[_\s-]?failure|input[_\s-]?shortage)/i,
    EXPORT_COLLAPSE:     /(export[_\s-]?collapse|import[_\s-]?collapse|trade[_\s-]?deficit|trade[_\s-]?balance|trade[_\s-]?volume[_\s-]?drop|order[_\s-]?cancellation|demand[_\s-]?collapse[_\s-]?abroad|export[_\s-]?slump|trade[_\s-]?contraction|shipment[_\s-]?decline)/i,
    CHOKEPOINT_CLOSURE:  /(chokepoint|canal[_\s-]?closure|strait[_\s-]?closure|waterway[_\s-]?block|transit[_\s-]?route[_\s-]?closure|land[_\s-]?border[_\s-]?closure|airspace[_\s-]?closure|corridor[_\s-]?disruption|route[_\s-]?denial|passage[_\s-]?restriction)/i
  };

  // Trade-vulnerability STACKS — ordered token pairs with a trade interpretation.
  // Each describes an operator-concentration meaning specific to a trade vulnerability
  // stack (tariffs & trade policy, sanctions & embargoes, ports & maritime, freight &
  // shipping, customs & border, supply-chain disruption, export/import flows,
  // strategic chokepoints) — NOT energy oil/gas/grid content, NOT economy macro-aggregate
  // content, and NOT industry production content. Trade is the cross-border FLOW.
  var TRADE_VULN_STACKS = [
    { id: 'TRADE_WAR_ESCALATION',     signals: ['TARIFF_ESCALATION', 'PORT_DISRUPTION'],
      body: 'Operator attention concentrates on the tariff-escalation + port-disruption stack — a trade-war escalation where retaliatory duties collide with port congestion and maritime chokepoint risk.' },
    { id: 'LOGISTICS_PARALYSIS',      signals: ['SHIPPING_CRISIS', 'CUSTOMS_FRICTION'],
      body: 'Operator attention concentrates on the shipping-crisis + customs-friction stack — logistics paralysis as vessel/carrier capacity strains compound with customs and border-clearance delays.' },
    { id: 'COST_TRANSMISSION_CASCADE', signals: ['SUPPLY_DISRUPTION', 'FREIGHT_COST'],
      body: 'Operator attention concentrates on the supply-disruption + freight-cost stack — a cost-transmission cascade where supply-chain bottlenecks ride on top of spiking freight and container rates.' },
    { id: 'SANCTIONS_DECOUPLING',     signals: ['SANCTIONS_IMPACT', 'EXPORT_COLLAPSE'],
      body: 'Operator attention concentrates on the sanctions-impact + export-collapse stack — sanctions and export controls driving trade decoupling and collapsing export/import volumes.' },
    { id: 'CHOKEPOINT_BLOCKADE',      signals: ['CHOKEPOINT_CLOSURE', 'SHIPPING_CRISIS'],
      body: 'Operator attention concentrates on the chokepoint-closure + shipping-crisis stack — a strategic waterway or corridor closure forcing reroutes and a shipping crisis across trade lanes.' }
  ];

  // ─── Industry / industrial-production vulnerability-stack semantics ────────
  // INDUSTRY domain-semantic concentration. As with infrastructure, culture, finance,
  // economy, technology, intelligence and trade, generic (domain, action) frequency
  // only says WHERE the operator is looking; for the industry domain we also detect
  // WHAT industrial-production-vulnerability STACK the attention concentrates on. Each
  // stack is a co-occurring pair of industrial signal families (capacity utilization &
  // factory output collapse/automation & robotics line failure/input & raw-material
  // cost spikes/labor shortage & skilled-trade gaps/wage pressure & labor-cost
  // transmission/margin compression on heavy industry & capital goods/industrial
  // supply-chain & component-input constraint/machinery & equipment degradation &
  // maintenance backlog). The industry identity is MANUFACTURING & INDUSTRIAL
  // PRODUCTION, FACTORY OUTPUT & CAPACITY UTILIZATION, AUTOMATION & ROBOTICS, HEAVY
  // INDUSTRY & CAPITAL GOODS, INDUSTRIAL SUPPLY CHAINS, MACHINERY & EQUIPMENT, and
  // INDUSTRIAL MAINTENANCE — bound to real industrial equities (CAT, DE, GE, HON, MMM,
  // EMR, ITW, ETN, PH, ROK, DOV, GEV). Industry is kept DISTINCT from trade
  // (logistics/commerce/cross-border flow), from economy (the macro aggregate), and
  // from technology (automation/robotics is a COUPLING, not the industry identity);
  // its OWN content is never energy oil/gas/grid. Mirrors the energy anchor where
  // crude_above_90 + grid_stress pair into a feedback loop — industry pairs
  // capacity-utilization collapse + automation-failure as the analogous feedback loop,
  // with tickers CAT/DE/GE showing early signals.
  // Mirrors the industry-brain cross-domain conditions:
  //   CAPACITY_COLLAPSE + AUTOMATION_FAILURE   → capacity-margin squeeze feedback loop
  //   LABOR_SHORTAGE + WAGE_PRESSURE           → labor-supply crisis
  //   INPUT_COST_SPIKE + MARGIN_COMPRESSION    → input-cost transmission to margins
  //   SUPPLY_CHAIN_CONSTRAINT + EQUIPMENT_DEGRADATION → production halt
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: advisory only; never participates in /api/limen/score scoring.
  var INDUSTRY_SIGNAL_TOKENS = {
    AUTOMATION_FAILURE:      /(automation[_\s-]?failure|robotics|robot[_\s-]?line|line[_\s-]?down|plc|cobot|production[_\s-]?line[_\s-]?halt|automation[_\s-]?fault|controls[_\s-]?failure|cnc[_\s-]?fault|assembly[_\s-]?line[_\s-]?stop|machine[_\s-]?downtime|process[_\s-]?automation[_\s-]?break)/i,
    CAPACITY_COLLAPSE:       /(capacity[_\s-]?utilization|capacity[_\s-]?collapse|factory[_\s-]?output|industrial[_\s-]?production|plant[_\s-]?utilization|output[_\s-]?decline|production[_\s-]?cut|underutilization|idle[_\s-]?capacity|throughput[_\s-]?drop|TCU|MCUMFN|utilization[_\s-]?rate)/i,
    INPUT_COST_SPIKE:        /(input[_\s-]?cost|raw[_\s-]?material|material[_\s-]?cost|steel[_\s-]?price|copper[_\s-]?price|aluminum[_\s-]?price|feedstock|commodity[_\s-]?input|cost[_\s-]?spike|PPI|producer[_\s-]?price|resin[_\s-]?cost|component[_\s-]?cost[_\s-]?surge)/i,
    LABOR_SHORTAGE:          /(labor[_\s-]?shortage|skilled[_\s-]?trade|workforce[_\s-]?gap|machinist[_\s-]?shortage|welder[_\s-]?shortage|technician[_\s-]?gap|hiring[_\s-]?gap|labor[_\s-]?gap|staffing[_\s-]?shortfall|apprenticeship[_\s-]?gap|tradespeople[_\s-]?shortage|talent[_\s-]?shortage)/i,
    WAGE_PRESSURE:           /(wage[_\s-]?pressure|wage[_\s-]?inflation|labor[_\s-]?cost[_\s-]?rise|overtime[_\s-]?cost|union[_\s-]?wage|wage[_\s-]?demand|compensation[_\s-]?pressure|shop[_\s-]?floor[_\s-]?wage|hourly[_\s-]?rate[_\s-]?rise|labor[_\s-]?cost[_\s-]?transmission|wage[_\s-]?escalation)/i,
    MARGIN_COMPRESSION:      /(margin[_\s-]?compression|margin[_\s-]?squeeze|operating[_\s-]?margin|gross[_\s-]?margin[_\s-]?erosion|pricing[_\s-]?power[_\s-]?loss|cost[_\s-]?pass[_\s-]?through|unabsorbed[_\s-]?overhead|contribution[_\s-]?margin[_\s-]?drop|profitability[_\s-]?erosion|margin[_\s-]?erosion)/i,
    SUPPLY_CHAIN_CONSTRAINT: /(supply[_\s-]?chain[_\s-]?constraint|component[_\s-]?shortage|parts[_\s-]?shortage|supplier[_\s-]?failure|sole[_\s-]?source|input[_\s-]?shortage|bottleneck|just[_\s-]?in[_\s-]?time[_\s-]?break|inventory[_\s-]?shortfall|sub[_\s-]?supplier[_\s-]?gap|bill[_\s-]?of[_\s-]?materials[_\s-]?gap)/i,
    EQUIPMENT_DEGRADATION:   /(equipment[_\s-]?degradation|machinery[_\s-]?wear|asset[_\s-]?deterioration|maintenance[_\s-]?backlog|breakdown|unplanned[_\s-]?downtime|tooling[_\s-]?wear|reliability[_\s-]?decline|mean[_\s-]?time[_\s-]?between[_\s-]?failure|MTBF|aging[_\s-]?machinery|deferred[_\s-]?overhaul|spare[_\s-]?parts[_\s-]?gap)/i
  };

  // Industrial-production-vulnerability STACKS — ordered token pairs with an industrial
  // interpretation. Each describes an operator-concentration meaning specific to an
  // industrial vulnerability stack (capacity & output, automation & robotics, input &
  // raw-material costs, labor & skilled trades, wage & margin transmission, industrial
  // supply chains, machinery & maintenance) — NOT energy oil/gas/grid content, NOT trade
  // logistics/cross-border-flow content, NOT economy macro-aggregate content, and NOT
  // technology automation as identity (automation is a coupling here). Industry is the
  // PRODUCTION of physical goods on the factory floor.
  var INDUSTRY_VULN_STACKS = [
    { id: 'CAPACITY_MARGIN_SQUEEZE', signals: ['CAPACITY_COLLAPSE', 'AUTOMATION_FAILURE'],
      body: 'Operator attention concentrates on the capacity-collapse + automation-failure stack — a capacity-margin squeeze feedback loop where falling factory utilization compounds with robotics/line failures (CAT/DE/GE showing early signals).' },
    { id: 'LABOR_SUPPLY_CRISIS',     signals: ['LABOR_SHORTAGE', 'WAGE_PRESSURE'],
      body: 'Operator attention concentrates on the labor-shortage + wage-pressure stack — a labor-supply crisis where skilled-trade gaps on the shop floor collide with escalating wage and labor-cost pressure.' },
    { id: 'INPUT_COST_TRANSMISSION', signals: ['INPUT_COST_SPIKE', 'MARGIN_COMPRESSION'],
      body: 'Operator attention concentrates on the input-cost-spike + margin-compression stack — raw-material and component cost surges transmitting into eroding operating margins as pricing power lags.' },
    { id: 'SUPPLY_PRODUCTION_HALT',  signals: ['SUPPLY_CHAIN_CONSTRAINT', 'EQUIPMENT_DEGRADATION'],
      body: 'Operator attention concentrates on the supply-chain-constraint + equipment-degradation stack — component shortages and machinery breakdown/maintenance backlog combining into a production halt.' },
    { id: 'AUTOMATION_LABOR_GAP',    signals: ['AUTOMATION_FAILURE', 'LABOR_SHORTAGE'],
      body: 'Operator attention concentrates on the automation-failure + labor-shortage stack — robotics/line faults exposing a thin skilled-trade workforce with too few technicians to recover throughput.' }
  ];

  // ─── Environment vulnerability-stack semantics ─────────────────────────────
  // ENVIRONMENTAL domain-semantic concentration. As with infrastructure, culture,
  // finance, economy, technology, intelligence, trade and industry, generic
  // (domain, action) frequency only says WHERE the operator is looking; for the
  // environment domain we also detect WHAT environmental-vulnerability STACK the
  // attention concentrates on. Each stack is a co-occurring pair of environmental
  // signal families (climate & GHG emissions/air-water-soil pollution events/
  // ecosystems & biodiversity loss/natural resources & water scarcity/environmental
  // regulation & compliance tightening/climate disasters & physical climate risk/
  // waste management & remediation backlog). The environment identity is CLIMATE &
  // EMISSIONS, POLLUTION & ENVIRONMENTAL QUALITY, ECOSYSTEMS & BIODIVERSITY, NATURAL
  // RESOURCES & CONSERVATION, ENVIRONMENTAL REGULATION & COMPLIANCE, CLIMATE RISK &
  // ADAPTATION, WASTE MANAGEMENT & REMEDIATION, and CARBON MARKETS — bound to real
  // environmental-sector equities (WM, RSG, WCN, CWST waste & remediation; AWK, WTRG,
  // XYL water utilities & infrastructure; ECL, LIN, APD environmental services &
  // industrial gases; DAR rendering/recycling; AY renewable infrastructure). The
  // environment COUPLES to energy via carbon footprint and emissions, but its OWN
  // content is never energy oil/gas/grid/power-generation; it is also kept DISTINCT
  // from agriculture (land/water use is a coupling, not the identity). Mirrors the
  // energy anchor where crude_above_90 + grid_stress pair into a feedback loop —
  // environment pairs emissions + regulatory constraint into a STRUCTURAL squeeze
  // (carbon-compliance), not noise dampened away.
  // Mirrors the environment-brain cross-domain conditions:
  //   EMISSIONS_SPIKE + REGULATORY_TIGHTENING   → carbon-compliance squeeze
  //   BIODIVERSITY_LOSS + WATER_SCARCITY        → ecosystem-water-stress feedback
  //   POLLUTION_EVENT + REMEDIATION_BACKLOG     → contamination-liability overhang
  //   CLIMATE_DISASTER + WATER_SCARCITY         → climate-adaptation stress
  //   POLLUTION_EVENT + REGULATORY_TIGHTENING   → enforcement-driven compliance shock
  // Signal tokens are matched against recorded action/type/pattern text — never
  // invented; absence of tokens simply yields no stack (silent, no false signal).
  // STRICTLY ADDITIVE: advisory only; never participates in /api/limen/score scoring.
  var ENVIRONMENT_SIGNAL_TOKENS = {
    EMISSIONS_SPIKE:        /(emission|ghg|greenhouse[_\s-]?gas|carbon[_\s-]?footprint|co2|methane|scope[_\s-]?[123]|carbon[_\s-]?intensity|flaring|carbon[_\s-]?emission|emissions[_\s-]?surge|carbon[_\s-]?budget[_\s-]?overshoot)/i,
    POLLUTION_EVENT:        /(pollution|contamination|spill|toxic[_\s-]?release|air[_\s-]?quality|water[_\s-]?quality|soil[_\s-]?contamination|effluent|discharge|smog|particulate|pm2\.?5|hazardous[_\s-]?material|brownfield|superfund)/i,
    BIODIVERSITY_LOSS:      /(biodiversity|species[_\s-]?loss|habitat[_\s-]?loss|deforestation|ecosystem[_\s-]?collapse|extinction|wetland[_\s-]?loss|pollinator[_\s-]?decline|coral[_\s-]?bleaching|land[_\s-]?degradation|ecosystem[_\s-]?service[_\s-]?loss)/i,
    CLIMATE_DISASTER:       /(climate[_\s-]?disaster|extreme[_\s-]?weather|wildfire|flood|hurricane|drought|heatwave|sea[_\s-]?level[_\s-]?rise|storm[_\s-]?surge|climate[_\s-]?shock|physical[_\s-]?climate[_\s-]?risk|catastrophe[_\s-]?loss)/i,
    WATER_SCARCITY:         /(water[_\s-]?scarcity|water[_\s-]?stress|drought|aquifer[_\s-]?depletion|reservoir[_\s-]?drawdown|freshwater[_\s-]?shortage|water[_\s-]?table|groundwater[_\s-]?decline|watershed[_\s-]?stress|water[_\s-]?rationing|water[_\s-]?supply[_\s-]?risk)/i,
    REGULATORY_TIGHTENING:  /(environmental[_\s-]?regulation|epa|emissions[_\s-]?standard|carbon[_\s-]?tax|carbon[_\s-]?price|cap[_\s-]?and[_\s-]?trade|clean[_\s-]?air|clean[_\s-]?water|esg[_\s-]?mandate|compliance[_\s-]?tightening|permit[_\s-]?denial|environmental[_\s-]?enforcement|disclosure[_\s-]?rule)/i,
    REMEDIATION_BACKLOG:    /(remediation|cleanup|waste[_\s-]?management|landfill|hazardous[_\s-]?waste|environmental[_\s-]?liability|decommission|site[_\s-]?cleanup|recycling[_\s-]?backlog|waste[_\s-]?backlog|reclamation|remediation[_\s-]?cost|cleanup[_\s-]?obligation)/i
  };

  // Environmental-vulnerability STACKS — ordered token pairs with an environmental
  // interpretation. Each describes an operator-concentration meaning specific to an
  // environmental vulnerability stack (climate & emissions, pollution & quality,
  // ecosystems & biodiversity, natural resources & water, environmental regulation,
  // climate risk & adaptation, waste & remediation, carbon markets) — NOT energy
  // oil/gas/grid/power-generation content (emissions/carbon is a coupling to energy,
  // not the identity) and NOT agriculture land/water-use content (a coupling). The
  // environment is CLIMATE, POLLUTION, ECOSYSTEMS, and natural-resource quality.
  var ENVIRONMENT_VULN_STACKS = [
    { id: 'CARBON_COMPLIANCE_SQUEEZE', signals: ['EMISSIONS_SPIKE', 'REGULATORY_TIGHTENING'],
      body: 'Operator attention concentrates on the emissions-spike + regulatory-tightening stack — a carbon-compliance squeeze where rising GHG/carbon intensity collides with tightening emissions standards, carbon pricing, and disclosure mandates (WM/RSG/ECL exposure).' },
    { id: 'ECOSYSTEM_WATER_STRESS',   signals: ['BIODIVERSITY_LOSS', 'WATER_SCARCITY'],
      body: 'Operator attention concentrates on the biodiversity-loss + water-scarcity stack — an ecosystem-water-stress feedback loop where habitat and species loss compound with aquifer depletion and watershed stress (AWK/WTRG/XYL exposure).' },
    { id: 'CONTAMINATION_LIABILITY',  signals: ['POLLUTION_EVENT', 'REMEDIATION_BACKLOG'],
      body: 'Operator attention concentrates on the pollution-event + remediation-backlog stack — a contamination-liability overhang where toxic releases and air/water/soil events feed an unfunded cleanup and waste-management backlog (WCN/CWST/DAR exposure).' },
    { id: 'CLIMATE_ADAPTATION_STRESS', signals: ['CLIMATE_DISASTER', 'WATER_SCARCITY'],
      body: 'Operator attention concentrates on the climate-disaster + water-scarcity stack — climate-adaptation stress where extreme weather, wildfire, and flooding collide with drought and freshwater shortage (AWK/WTRG/AY exposure).' },
    { id: 'ENFORCEMENT_COMPLIANCE_SHOCK', signals: ['POLLUTION_EVENT', 'REGULATORY_TIGHTENING'],
      body: 'Operator attention concentrates on the pollution-event + regulatory-tightening stack — an enforcement-driven compliance shock where contamination incidents trigger EPA/clean-air/clean-water enforcement and permit risk (ECL/LIN/APD exposure).' }
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _entries = [];
  var _lastConcentrationTime = 0;
  var _lastConcentrationDomain = null;
  var _lastInfraStackTime = 0;
  var _lastInfraStackId = null;
  var _lastCultureStackTime = 0;
  var _lastCultureStackId = null;
  var _lastFinanceStackTime = 0;
  var _lastFinanceStackId = null;
  var _lastEconomyStackTime = 0;
  var _lastEconomyStackId = null;
  var _lastTechnologyStackTime = 0;
  var _lastTechnologyStackId = null;
  var _lastIntelligenceStackTime = 0;
  var _lastIntelligenceStackId = null;
  var _lastTradeStackTime = 0;
  var _lastTradeStackId = null;
  var _lastIndustryStackTime = 0;
  var _lastIndustryStackId = null;
  var _lastEnvironmentStackTime = 0;
  var _lastEnvironmentStackId = null;
  var _interval = null;

  // Detect which civil signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical infrastructure signal ids. Never fabricates — empty if nothing matches.
  function _detectInfraSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in INFRA_SIGNAL_TOKENS) {
      if (INFRA_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which cultural signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical culture signal ids. Never fabricates — empty if nothing matches.
  function _detectCultureSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in CULTURE_SIGNAL_TOKENS) {
      if (CULTURE_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which financial signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical finance signal ids. Never fabricates — empty if nothing matches.
  function _detectFinanceSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in FINANCE_SIGNAL_TOKENS) {
      if (FINANCE_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which macroeconomic signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical economy signal ids. Never fabricates — empty if nothing matches.
  function _detectEconomySignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in ECONOMY_SIGNAL_TOKENS) {
      if (ECONOMY_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which technology signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical technology signal ids. Never fabricates — empty if nothing matches.
  function _detectTechnologySignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in TECHNOLOGY_SIGNAL_TOKENS) {
      if (TECHNOLOGY_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which intelligence signal families a user-action references, by scanning its
  // free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical intelligence signal ids. Never fabricates — empty if nothing matches.
  function _detectIntelligenceSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in INTELLIGENCE_SIGNAL_TOKENS) {
      if (INTELLIGENCE_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which trade/supply-chain signal families a user-action references, by scanning
  // its free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical trade signal ids. Never fabricates — empty if nothing matches.
  function _detectTradeSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in TRADE_SIGNAL_TOKENS) {
      if (TRADE_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which industrial-production signal families a user-action references, by
  // scanning its free-text fields (action / type / cross-domain pattern). Returns a list
  // of canonical industry signal ids. Never fabricates — empty if nothing matches.
  function _detectIndustrySignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in INDUSTRY_SIGNAL_TOKENS) {
      if (INDUSTRY_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // Detect which environmental signal families a user-action references, by scanning
  // its free-text fields (action / type / cross-domain pattern). Returns a list of
  // canonical environment signal ids. Never fabricates — empty if nothing matches.
  function _detectEnvironmentSignals(text) {
    if (!text) return [];
    var hits = [];
    for (var sig in ENVIRONMENT_SIGNAL_TOKENS) {
      if (ENVIRONMENT_SIGNAL_TOKENS[sig].test(text)) hits.push(sig);
    }
    return hits;
  }

  // ─── Record decision ─────────────────────────────────────────────────────

  function _onUserAction(e) {
    var detail = e.detail;
    if (!detail) return;

    var globalState = window.LIMENGlobalState || {};
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];

    // Find matching cross-domain pattern for this domain
    var matchedPattern = null;
    var domain = detail.domain || null;
    if (domain) {
      for (var i = 0; i < crossDomain.length; i++) {
        var pat = crossDomain[i];
        if (pat.domains && pat.domains.indexOf(domain) !== -1) {
          matchedPattern = pat.pattern || pat.patternId || null;
          break;
        }
      }
    }

    var entry = {
      domain: domain,
      action: detail.action || detail.type || 'unknown',
      type: detail.type || 'unknown',
      timestamp: Date.now(),
      globalState: globalState.mode || 'unknown',
      crossDomainPattern: matchedPattern,
      // CIVIL: which infrastructure signal families this action touches (may be []).
      infraSignals: _detectInfraSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // CULTURE: which cultural signal families this action touches (may be []).
      cultureSignals: _detectCultureSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // FINANCE: which financial signal families this action touches (may be []).
      financeSignals: _detectFinanceSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // ECONOMY: which macroeconomic signal families this action touches (may be []).
      economySignals: _detectEconomySignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // TECHNOLOGY: which technology signal families this action touches (may be []).
      technologySignals: _detectTechnologySignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // INTELLIGENCE: which intelligence signal families this action touches (may be []).
      intelligenceSignals: _detectIntelligenceSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // TRADE: which trade/supply-chain signal families this action touches (may be []).
      tradeSignals: _detectTradeSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // INDUSTRY: which industrial-production signal families this action touches (may be []).
      industrySignals: _detectIndustrySignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      ),
      // ENVIRONMENT: which environmental signal families this action touches (may be []).
      environmentSignals: _detectEnvironmentSignals(
        [detail.action, detail.type, matchedPattern, detail.signal, detail.diagnosis].join(' ')
      )
    };

    _entries.push(entry);
    if (_entries.length > MAX_ENTRIES) {
      _entries.shift();
    }

    _publish();
    _checkConcentration();
    _checkInfraStackConcentration();
    _checkCultureStackConcentration();
    _checkFinanceStackConcentration();
    _checkEconomyStackConcentration();
    _checkTechnologyStackConcentration();
    _checkIntelligenceStackConcentration();
    _checkTradeStackConcentration();
    _checkIndustryStackConcentration();
    _checkEnvironmentStackConcentration();
  }

  // ─── Concentration detection ──────────────────────────────────────────────

  function _checkConcentration() {
    var now = Date.now();
    if (now - _lastConcentrationTime < CONCENTRATION_COOLDOWN) return;
    if (_entries.length < CONCENTRATION_THRESHOLD) return;

    // Count domain frequency in recent entries (last 10)
    var recent = _entries.slice(-10);
    var counts = {};
    for (var i = 0; i < recent.length; i++) {
      var d = recent[i].domain;
      if (!d) continue;
      // Normalize compound domains (e.g. "energy+environment")
      var parts = d.split('+');
      for (var p = 0; p < parts.length; p++) {
        var pk = parts[p];
        if (pk) {
          counts[pk] = (counts[pk] || 0) + 1;
        }
      }
    }

    // Find domains meeting threshold
    var concentrated = [];
    for (var dk in counts) {
      if (counts[dk] >= CONCENTRATION_THRESHOLD) {
        concentrated.push(dk);
      }
    }

    if (concentrated.length === 0) return;

    // Don't re-narrate the same single-domain concentration
    if (concentrated.length === 1 && concentrated[0] === _lastConcentrationDomain) return;

    _lastConcentrationTime = now;
    _lastConcentrationDomain = concentrated.length === 1 ? concentrated[0] : null;

    // Build narrator message
    var drivers = [];
    var body;

    if (concentrated.length === 1) {
      body = 'Repeated observation posture detected in ' + concentrated[0] + '.';
      drivers.push(counts[concentrated[0]] + ' recent actions in ' + concentrated[0]);
    } else {
      body = 'User attention remains concentrated in ' + concentrated.join(' and ') + '.';
      for (var c = 0; c < concentrated.length; c++) {
        drivers.push(counts[concentrated[c]] + ' recent actions in ' + concentrated[c]);
      }
    }

    // Suggest broadening or deepening
    var options = [];
    for (var o = 0; o < Math.min(concentrated.length, 2); o++) {
      options.push({ label: 'deepen ' + concentrated[o] + ' analysis', type: 'analysis' });
    }
    options.push({ label: 'broaden scope', type: 'monitoring' });
    options.push({ label: 'hold', type: 'monitoring' });

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      topDrivers: drivers,
      options: options,
      body: body
    });
  }

  // ─── Infrastructure vulnerability-stack concentration ─────────────────────
  // Domain-semantic concentration for CIVIL infrastructure: beyond "which domain"
  // (above), surface WHICH vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring civil signal families across recent entries and fires
  // when a known stack (capital rationing, cyber-resilient squeeze, supply-side
  // vulnerability, grid-funding stress, transport-maintenance gap) crosses the
  // threshold. Schema-faithful to _checkConcentration (same phase-change shape).

  function _checkInfraStackConcentration() {
    var now = Date.now();
    if (now - _lastInfraStackTime < INFRA_STACK_COOLDOWN) return;
    if (_entries.length < INFRA_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].infraSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < INFRA_VULN_STACKS.length; k++) {
      var stack = INFRA_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < INFRA_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastInfraStackId) return; // don't re-narrate the same stack

    _lastInfraStackTime = now;
    _lastInfraStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'infrastructure',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Culture vulnerability-stack concentration ────────────────────────────
  // Domain-semantic concentration for CULTURE: beyond "which domain" (above),
  // surface WHICH cultural-concern STACK the operator keeps returning to. Tallies
  // co-occurring cultural signal families across recent entries and fires when a
  // known stack (backlash exodus, scene hollowing, heritage cancellation, fanbase
  // fatigue, expression collapse) crosses the threshold. Schema-faithful to
  // _checkInfraStackConcentration (same phase-change shape).

  function _checkCultureStackConcentration() {
    var now = Date.now();
    if (now - _lastCultureStackTime < CULTURE_STACK_COOLDOWN) return;
    if (_entries.length < CULTURE_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].cultureSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < CULTURE_VULN_STACKS.length; k++) {
      var stack = CULTURE_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < CULTURE_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastCultureStackId) return; // don't re-narrate the same stack

    _lastCultureStackTime = now;
    _lastCultureStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'culture',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Finance vulnerability-stack concentration ────────────────────────────
  // Domain-semantic concentration for FINANCE: beyond "which domain" (above),
  // surface WHICH financial-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring financial signal families across recent entries and fires
  // when a known stack (liquidity-default, margin-capital-flight, credit-solvency,
  // leverage-deleveraging, repo-haircut) crosses the threshold. Schema-faithful to
  // _checkInfraStackConcentration (same phase-change shape). STRICTLY ADDITIVE and
  // independent of the validated P3 distress kernel — advisory only.

  function _checkFinanceStackConcentration() {
    var now = Date.now();
    if (now - _lastFinanceStackTime < FINANCE_STACK_COOLDOWN) return;
    if (_entries.length < FINANCE_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].financeSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < FINANCE_VULN_STACKS.length; k++) {
      var stack = FINANCE_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < FINANCE_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastFinanceStackId) return; // don't re-narrate the same stack

    _lastFinanceStackTime = now;
    _lastFinanceStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'finance',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Economy vulnerability-stack concentration ────────────────────────────
  // Domain-semantic concentration for ECONOMY: beyond "which domain" (above),
  // surface WHICH macroeconomic-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring macro signal families across recent entries and fires when a
  // known stack (stagflation, credit-cycle, policy-trap, demand-destruction,
  // real-wage-collapse, supply-shock-spillover) crosses the threshold. Schema-faithful
  // to _checkFinanceStackConcentration (same phase-change shape). STRICTLY ADDITIVE,
  // advisory only, and kept DISTINCT from the finance capital-markets layer above.

  function _checkEconomyStackConcentration() {
    var now = Date.now();
    if (now - _lastEconomyStackTime < ECONOMY_STACK_COOLDOWN) return;
    if (_entries.length < ECONOMY_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].economySignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < ECONOMY_VULN_STACKS.length; k++) {
      var stack = ECONOMY_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < ECONOMY_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastEconomyStackId) return; // don't re-narrate the same stack

    _lastEconomyStackTime = now;
    _lastEconomyStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'economy',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Technology vulnerability-stack concentration ─────────────────────────
  // Domain-semantic concentration for TECHNOLOGY: beyond "which domain" (above),
  // surface WHICH technology-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring technology signal families across recent entries and fires
  // when a known stack (compute-scaling-crunch, AI-cost-lock-in, supply-chain-cyber-
  // exposure, obsolescence-platform-debt, breakthrough-compute-race) crosses the
  // threshold. Schema-faithful to _checkEconomyStackConcentration (same phase-change
  // shape). STRICTLY ADDITIVE, advisory only, and kept DISTINCT from the finance
  // capital-markets layer above (fintech is a coupling, not the identity).

  function _checkTechnologyStackConcentration() {
    var now = Date.now();
    if (now - _lastTechnologyStackTime < TECHNOLOGY_STACK_COOLDOWN) return;
    if (_entries.length < TECHNOLOGY_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].technologySignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < TECHNOLOGY_VULN_STACKS.length; k++) {
      var stack = TECHNOLOGY_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < TECHNOLOGY_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastTechnologyStackId) return; // don't re-narrate the same stack

    _lastTechnologyStackTime = now;
    _lastTechnologyStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'technology',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Intelligence vulnerability-stack concentration ───────────────────────
  // Domain-semantic concentration for INTELLIGENCE: beyond "which domain" (above),
  // surface WHICH intelligence-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring intelligence signal families across recent entries and fires
  // when a known stack (observability-fusion-deficit, active-espionage-exposure,
  // accountability-compartment-gap, contaminated-feed-compromise, insider-threat-
  // exposure) crosses the threshold. Schema-faithful to
  // _checkTechnologyStackConcentration (same phase-change shape). STRICTLY ADDITIVE,
  // advisory only, kept DISTINCT from defense (kinetic/readiness) and technology
  // (cyber tooling is a coupling, not the identity).

  function _checkIntelligenceStackConcentration() {
    var now = Date.now();
    if (now - _lastIntelligenceStackTime < INTELLIGENCE_STACK_COOLDOWN) return;
    if (_entries.length < INTELLIGENCE_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].intelligenceSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < INTELLIGENCE_VULN_STACKS.length; k++) {
      var stack = INTELLIGENCE_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < INTELLIGENCE_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastIntelligenceStackId) return; // don't re-narrate the same stack

    _lastIntelligenceStackTime = now;
    _lastIntelligenceStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'intelligence',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Trade / supply-chain vulnerability-stack concentration ───────────────
  // Domain-semantic concentration for TRADE: beyond "which domain" (above), surface
  // WHICH trade-vulnerability STACK the operator keeps returning to. Tallies
  // co-occurring trade signal families across recent entries and fires when a known
  // stack (trade-war-escalation, logistics-paralysis, cost-transmission-cascade,
  // sanctions-decoupling, chokepoint-blockade) crosses the threshold. Schema-faithful
  // to _checkIntelligenceStackConcentration (same phase-change shape). STRICTLY
  // ADDITIVE, advisory only, kept DISTINCT from economy (macro aggregate) and industry
  // (production). Narrates under the canonical/portal key 'trade' (runtime/snapshot
  // key is 'supplyChain' via domain-identity.js dual-naming).

  function _checkTradeStackConcentration() {
    var now = Date.now();
    if (now - _lastTradeStackTime < TRADE_STACK_COOLDOWN) return;
    if (_entries.length < TRADE_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].tradeSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < TRADE_VULN_STACKS.length; k++) {
      var stack = TRADE_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < TRADE_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastTradeStackId) return; // don't re-narrate the same stack

    _lastTradeStackTime = now;
    _lastTradeStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'trade',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Industry / industrial-production vulnerability-stack concentration ────
  // Domain-semantic concentration for INDUSTRY: beyond "which domain" (above), surface
  // WHICH industrial-production-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring industrial signal families across recent entries and fires when
  // a known stack (capacity-margin-squeeze, labor-supply-crisis, input-cost-transmission,
  // supply-production-halt, automation-labor-gap) crosses the threshold. Schema-faithful
  // to _checkTradeStackConcentration (same phase-change shape). STRICTLY ADDITIVE,
  // advisory only, kept DISTINCT from trade (logistics/commerce), economy (macro
  // aggregate) and technology (automation is a coupling). Mirrors the energy anchor
  // (crude_above_90 + grid_stress) with the capacity-collapse + automation-failure
  // feedback loop — CAT/DE/GE showing early signals.

  function _checkIndustryStackConcentration() {
    var now = Date.now();
    if (now - _lastIndustryStackTime < INDUSTRY_STACK_COOLDOWN) return;
    if (_entries.length < INDUSTRY_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].industrySignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < INDUSTRY_VULN_STACKS.length; k++) {
      var stack = INDUSTRY_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < INDUSTRY_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastIndustryStackId) return; // don't re-narrate the same stack

    _lastIndustryStackTime = now;
    _lastIndustryStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'industry',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Environment vulnerability-stack concentration ────────────────────────
  // Domain-semantic concentration for ENVIRONMENT: beyond "which domain" (above),
  // surface WHICH environmental-vulnerability STACK the operator keeps returning to.
  // Tallies co-occurring environmental signal families across recent entries and fires
  // when a known stack (carbon-compliance-squeeze, ecosystem-water-stress, contamination-
  // liability, climate-adaptation-stress, enforcement-compliance-shock) crosses the
  // threshold. Schema-faithful to _checkIndustryStackConcentration (same phase-change
  // shape). STRICTLY ADDITIVE, advisory only, kept DISTINCT from energy (emissions/carbon
  // is a coupling, not the identity) and agriculture (land/water use is a coupling).
  // Mirrors the energy anchor (crude_above_90 + grid_stress) with the emissions-spike +
  // regulatory-tightening structural carbon-compliance squeeze — WM/RSG/ECL exposure.

  function _checkEnvironmentStackConcentration() {
    var now = Date.now();
    if (now - _lastEnvironmentStackTime < ENVIRONMENT_STACK_COOLDOWN) return;
    if (_entries.length < ENVIRONMENT_STACK_THRESHOLD) return;

    // Count per-signal-family hits across recent entries (last 10).
    var recent = _entries.slice(-10);
    var sigCounts = {};
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].environmentSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        sigCounts[sigs[s]] = (sigCounts[sigs[s]] || 0) + 1;
      }
    }

    // A stack fires only when BOTH of its signal families are present and at least
    // one of them has been focused on repeatedly (>= threshold). Score = sum of the
    // pair's counts; pick the strongest stack.
    var best = null;
    for (var k = 0; k < ENVIRONMENT_VULN_STACKS.length; k++) {
      var stack = ENVIRONMENT_VULN_STACKS[k];
      var a = sigCounts[stack.signals[0]] || 0;
      var b = sigCounts[stack.signals[1]] || 0;
      if (a === 0 || b === 0) continue;
      if (Math.max(a, b) < ENVIRONMENT_STACK_THRESHOLD) continue;
      var score = a + b;
      if (!best || score > best.score) best = { stack: stack, a: a, b: b, score: score };
    }

    if (!best) return;
    if (best.stack.id === _lastEnvironmentStackId) return; // don't re-narrate the same stack

    _lastEnvironmentStackTime = now;
    _lastEnvironmentStackId = best.stack.id;

    var drivers = [
      best.a + ' recent actions touching ' + best.stack.signals[0],
      best.b + ' recent actions touching ' + best.stack.signals[1]
    ];

    var options = [
      { label: 'deepen ' + best.stack.id.toLowerCase().replace(/_/g, ' ') + ' analysis', type: 'analysis' },
      { label: 'broaden scope', type: 'monitoring' },
      { label: 'hold', type: 'monitoring' }
    ];

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      domain: 'environment',
      stackId: best.stack.id,
      topDrivers: drivers,
      options: options,
      body: best.stack.body
    });
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  function _publish() {
    var summary = {
      entries: _entries,
      count: _entries.length,
      recentDomains: _recentDomains(5),
      infraSignalConcentration: _infraSignalConcentration(),
      cultureSignalConcentration: _cultureSignalConcentration(),
      financeSignalConcentration: _financeSignalConcentration(),
      economySignalConcentration: _economySignalConcentration(),
      technologySignalConcentration: _technologySignalConcentration(),
      intelligenceSignalConcentration: _intelligenceSignalConcentration(),
      tradeSignalConcentration: _tradeSignalConcentration(),
      industrySignalConcentration: _industrySignalConcentration(),
      environmentSignalConcentration: _environmentSignalConcentration(),
      updated: Date.now()
    };

    window.LIMENDecisionMemory = summary;
    _dispatch('limen:decision-memory-update', summary);
  }

  // CIVIL: roll up which infrastructure signal families recent attention concentrates
  // on (descending by count). Empty when no civil signals were detected.
  function _infraSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].infraSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // CULTURE: roll up which cultural signal families recent attention concentrates
  // on (descending by count). Empty when no cultural signals were detected.
  function _cultureSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].cultureSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // FINANCE: roll up which financial signal families recent attention concentrates
  // on (descending by count). Empty when no financial signals were detected.
  function _financeSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].financeSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // ECONOMY: roll up which macroeconomic signal families recent attention concentrates
  // on (descending by count). Empty when no macroeconomic signals were detected.
  function _economySignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].economySignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // TECHNOLOGY: roll up which technology signal families recent attention concentrates
  // on (descending by count). Empty when no technology signals were detected.
  function _technologySignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].technologySignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // INTELLIGENCE: roll up which intelligence signal families recent attention concentrates
  // on (descending by count). Empty when no intelligence signals were detected.
  function _intelligenceSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].intelligenceSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // TRADE: roll up which trade/supply-chain signal families recent attention concentrates
  // on (descending by count). Empty when no trade signals were detected.
  function _tradeSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].tradeSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // INDUSTRY: roll up which industrial-production signal families recent attention
  // concentrates on (descending by count). Empty when no industrial signals were detected.
  function _industrySignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].industrySignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  // ENVIRONMENT: roll up which environmental signal families recent attention
  // concentrates on (descending by count). Empty when no environmental signals were detected.
  function _environmentSignalConcentration() {
    var counts = {};
    var recent = _entries.slice(-10);
    for (var i = 0; i < recent.length; i++) {
      var sigs = recent[i].environmentSignals || [];
      for (var s = 0; s < sigs.length; s++) {
        counts[sigs[s]] = (counts[sigs[s]] || 0) + 1;
      }
    }
    var out = [];
    for (var sig in counts) { out.push({ signal: sig, count: counts[sig] }); }
    out.sort(function (x, y) { return y.count - x.count; });
    return out;
  }

  function _recentDomains(n) {
    var seen = {};
    var result = [];
    for (var i = _entries.length - 1; i >= 0 && result.length < n; i--) {
      var d = _entries[i].domain;
      if (d && !seen[d]) {
        seen[d] = true;
        result.push(d);
      }
    }
    return result;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:user-action', _onUserAction);
    _publish();
  }

  function stop() {
    window.removeEventListener('limen:user-action', _onUserAction);
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.LIMENDecisionMemory = {
    entries: [],
    count: 0,
    recentDomains: [],
    updated: null
  };

  window.LIMENDecisionMemoryEngine = {
    start: start,
    stop: stop
  };

})();
