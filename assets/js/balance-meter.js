/**
 * balance-meter.js
 * LIMEN HELIX — Domain Balance Meter
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks both destabilizing and stabilizing pressure per domain.
 * Computes net balance so LIMEN reveals recovery, not only danger.
 *
 * Depends on: window.LIMENDomains, window.LIMENSourceAudit
 * Listens: limen:domain-update
 * Emits: limen:balance-update (every cycle), limen:balance-shift (state change)
 * Output: window.LIMENBalance
 *
 * Load order: after domain-signal-engine.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var HISTORY_MAX = 12;

  // ─── Infrastructure-native semantics ──────────────────────────────────────
  // Energy parity: energy-brain.js maps live signal conditions to named
  // domain-native pathways (crude_above_90 / grid_stress / chokepoint …) with
  // weighted contributions, rather than treating stress as a single opaque
  // scalar. Civil infrastructure has its OWN failure/recovery vocabulary —
  // roads/bridges, water & sewer mains, the electric GRID (transmission &
  // distribution reliability), transit/transport, dams & levees, cyber-physical
  // (SCADA / ICS / CISA KEV), construction & public works, deferred maintenance,
  // and capital funding. Crude-price / oil / gas / nuclear / renewable content
  // is NOT used here; those energy primitives are translated to civil ones.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score.
  // This is the same shape as energy's condition→weight mapping, civil content.
  var INFRA_DESTABILIZING = [
    // Cyber-physical threat persistence — SCADA/ICS intrusions that dwell.
    { re: /scada|ics intrusion|cyber-?physical|cisa kev|known exploited|ransomware|control system/i, weight: 0.18, tag: 'cyber_physical_threat' },
    // Transmission / distribution grid reliability — the civil GRID, not fuel.
    { re: /transmission (line )?(fail|outage|congest)|distribution outage|grid reliability|frequency deviation|substation/i, weight: 0.16, tag: 'grid_reliability' },
    // Deferred maintenance acceleration / backlog spike.
    { re: /deferred maintenance|maintenance backlog|repair backlog|state of good repair/i, weight: 0.15, tag: 'deferred_maintenance' },
    // Structural assets in distress — bridges, dams, levees, tunnels.
    { re: /bridge (deficien|closure|fail)|structurally deficient|dam (fail|breach|deficien)|levee (fail|breach)|tunnel (fail|closure)/i, weight: 0.17, tag: 'structural_asset_failure' },
    // Water / sewer mains — breaks, boil-water, treatment failures.
    { re: /water main (break|fail)|sewer (overflow|fail)|boil(-| )water|treatment plant (fail|outage)|lead (service )?line/i, weight: 0.15, tag: 'water_system_failure' },
    // Transit / transport reliability — service collapse, derailment, bridge ban.
    { re: /transit (cut|collapse|breakdown)|derailment|service suspension|weight restriction|load posting/i, weight: 0.13, tag: 'transport_reliability' },
    // Supply-side hardware lead times — transformer / equipment shortage.
    { re: /transformer (shortage|lead time)|equipment (shortage|backorder)|long lead time|procurement delay/i, weight: 0.12, tag: 'equipment_lead_time' }
  ];
  var INFRA_STABILIZING = [
    // Capital funding renewal — appropriations, bonds, IIJA/grant inflow.
    { re: /funding (renew|secured|appropriat)|capital (program|plan) (approv|fund)|bond (issu|approv)|infrastructure (bill|act|grant)|reauthoriz/i, weight: 0.16, tag: 'funding_renewal' },
    // Capacity modernization — upgrades, hardening, resilience build-out.
    { re: /moderniz|capacity (expansion|upgrade)|hardening|resilience (upgrade|invest)|grid (upgrade|hardening)|seismic retrofit/i, weight: 0.14, tag: 'capacity_modernization' },
    // Repair completion rate — backlog being burned down, projects delivered.
    { re: /repair(s)? complet|backlog (reduc|cleared)|project(s)? delivered|restored to service|rehabilitation complet/i, weight: 0.15, tag: 'repair_completion' }
  ];

  // ─── Culture-native semantics ─────────────────────────────────────────────
  // Energy parity (same shape as INFRA above): culture has its OWN failure/
  // recovery vocabulary. Where energy reads crude_above_90 / grid_stress and
  // infrastructure reads grid_reliability / deferred_maintenance, CULTURE reads
  // the attention economy — fanbases & audience attention, artists/creators &
  // burnout, scenes & genres, streaming & virality, taste-making & trend
  // emergence, cultural movements & discourse. No grid/fuel content is used
  // here; every primitive is a cultural-semantic equivalent.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, cultural content.
  var CULTURE_DESTABILIZING = [
    // Backlash accumulation / cancellation risk — social-media fury, harassment.
    { re: /backlash|cancel(l?ed|lation|\s?culture)?|social media (fury|storm|pile-?on)|creator harassment|public shaming|controversy|outrage cycle/i, weight: 0.18, tag: 'backlash_accumulation' },
    // Audience attention collapse — fanbase exodus, engagement/listener drop-off.
    { re: /audience (exodus|collapse|decline|flight)|fan(base)? (exodus|decline|loss)|engagement (collapse|drop)|listener(ship)? (decline|drop)|unfollow(s)? surge|stream(s|ing)? (decline|drop)/i, weight: 0.16, tag: 'audience_attention_collapse' },
    // Scene saturation / trend collapse — oversupply, fatigue, dying trend.
    { re: /saturation|oversaturat|trend (collapse|fatigue|dying|exhaust)|scene (decline|fragment|collapse)|genre fatigue|content glut|algorithm fatigue/i, weight: 0.15, tag: 'scene_saturation' },
    // Creator burnout — overwork, exodus from platform, mental-health strain.
    { re: /creator (burnout|exodus|fatigue)|artist (burnout|exhaust|hiatus)|burnout|overwork|platform exodus|quit(ting)? (youtube|tiktok|twitch|the platform)/i, weight: 0.14, tag: 'creator_burnout' },
    // Cultural movement fragmentation — discourse splintering, infighting.
    { re: /fragment(ation|ing)?|infighting|movement (splinter|fractur|collaps)|tribal(ism|ize)|discourse (collaps|breakdown)|community (split|schism|fracture)/i, weight: 0.13, tag: 'movement_fragmentation' },
    // Gatekeeper / distribution chokepoint — deplatforming, demonetization.
    { re: /deplatform|demonetiz|shadow ?ban|delist|distribution (block|cut)|label (drop|shelv)|playlist removal|gatekeep(ing|er)/i, weight: 0.12, tag: 'distribution_chokepoint' }
  ];
  var CULTURE_STABILIZING = [
    // Fanbase momentum / breakout — viral moment, breakout artist, scene growth.
    { re: /fan(base)? (growth|momentum|surge|expansion)|breakout (artist|moment|hit|act)|viral (moment|hit|breakout)|going viral|chart (debut|climb|surge)|sold ?out (tour|show)/i, weight: 0.16, tag: 'fanbase_momentum' },
    // Taste-making emergence / scene momentum — new wave, tastemaker, movement.
    { re: /taste-?mak(er|ing)( emergence)?|scene (momentum|emergence|rising)|new wave|cultural movement (rising|gaining)|emerging (genre|sound|scene)|critical acclaim|buzz building/i, weight: 0.15, tag: 'tastemaker_emergence' },
    // Mainstream adoption / cultural crossover — breaking through, mass reach.
    { re: /mainstream (adoption|breakthrough|crossover)|cultural (adoption|crossover|breakthrough)|mass(-| )?market reach|breaking through|prime-?time|sync (placement|deal)|festival headlin/i, weight: 0.14, tag: 'mainstream_adoption' }
  ];

  // ─── Finance-native semantics ─────────────────────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE above): finance has its OWN
  // failure/recovery vocabulary. Where energy reads crude_above_90 / grid_stress,
  // infrastructure reads grid_reliability / deferred_maintenance, and culture
  // reads the attention economy, FINANCE reads capital markets & credit:
  // liquidity & solvency, credit & lending, banking, funding & investment, M&A,
  // payments/fintech, corporate distress & default, and systemic financial risk.
  // No grid/fuel/cultural content is used here; every primitive is a
  // financial-semantic equivalent (liquidity crunch, credit-spread widening,
  // solvency pressure, margin call, capital flight, deleveraging cascade,
  // default risk, covenant breach, counterparty exposure, repo/haircut stress).
  //
  // IMPORTANT: this is the CLIENT-SIDE ADVISORY balance meter only. It does NOT
  // touch the validated P3 distress kernel (Thing1) — scoreStress / deriveDiagnoses,
  // /api/limen/score, /api/helix/helix-report/score are entirely separate server
  // paths and are not referenced here. This adds a finance-native pathway readout
  // alongside energy/infra/culture, identical mechanism, financial content.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, financial content.
  var FINANCE_DESTABILIZING = [
    // Liquidity crunch — funding markets seizing, dash for cash, runs.
    { re: /liquidity (crunch|crisis|squeeze|stress|dry(-| )?up)|funding (squeeze|stress|freeze)|cash (crunch|squeeze)|dash for cash|(bank|deposit) run|fire ?sale/i, weight: 0.18, tag: 'liquidity_crunch' },
    // Credit-spread widening — risk repricing, spread blowout, downgrades.
    { re: /credit spread(s)? (widen|blow|gap)|spread(s)? (widen|blow)|risk premium (surge|spike)|cds (spike|widen|blow)|(rating|credit) downgrade|junk (spread|bond) (surge|spike)/i, weight: 0.16, tag: 'credit_spread_widening' },
    // Solvency pressure — capital depletion, insolvency, negative equity.
    { re: /solvency (pressure|risk|concern)|insolven(t|cy)|under(-| )?capitaliz|capital (depletion|shortfall|hole)|negative equity|impair(ment|ed) charge|write(-| )?down/i, weight: 0.17, tag: 'solvency_pressure' },
    // Margin call / forced liquidation — leverage unwind, collateral calls.
    { re: /margin call|collateral call|forced (liquidation|selling|sale)|leverage unwind|margin (pressure|squeeze)|delever(age|aging) (forced|cascade)?|liquidat(e|ion) position/i, weight: 0.15, tag: 'margin_call' },
    // Default risk / covenant breach — distress, bankruptcy, missed payment.
    { re: /default (risk|wave|event)|covenant (breach|violation|waiver)|missed (payment|coupon)|bankrupt(cy)?|chapter 11|debt (restructur|distress)|payment default|technical default/i, weight: 0.16, tag: 'default_risk' },
    // Counterparty / contagion exposure — interbank stress, repo/haircut stress.
    { re: /counterparty (risk|exposure|fail)|contagion|interbank (stress|freeze)|repo (stress|freeze|spike)|haircut(s)? (rise|widen|increase)|systemic (risk|stress)|spillover/i, weight: 0.15, tag: 'counterparty_exposure' },
    // Capital flight — outflows, redemptions, deposit/asset withdrawal surge.
    { re: /capital flight|(fund|deposit|investor) (outflow|redemption|withdrawal)|outflow(s)? surge|flight to (safety|quality)|asset (flight|exodus)|run on (the )?(fund|bank)/i, weight: 0.13, tag: 'capital_flight' }
  ];
  var FINANCE_STABILIZING = [
    // Liquidity restoration — backstops, facilities, funding access reopening.
    { re: /liquidity (restor|inject|support|provision|backstop)|funding (secured|access restored|reopen)|(fed|central bank) (facility|backstop|support)|emergency facility|discount window|recapitaliz/i, weight: 0.16, tag: 'liquidity_restoration' },
    // Credit normalization — spreads tightening, upgrades, risk appetite return.
    { re: /credit spread(s)? (tighten|narrow|compress)|spread(s)? (tighten|narrow)|(rating|credit) upgrade|risk appetite (return|recover)|credit (normaliz|easing|reopen)|issuance (window|reopen)/i, weight: 0.15, tag: 'credit_normalization' },
    // Capital strengthening — raises, buffers rebuilt, deleveraging orderly.
    { re: /capital (raise|injection|infusion|buffer rebuilt|strengthen)|recapitaliz(ed|ation)|equity (raise|infusion)|balance(-| )?sheet (repair|strengthen)|orderly delever|debt (refinanc|repaid|reduced)/i, weight: 0.15, tag: 'capital_strengthening' }
  ];

  // ─── Economy-native semantics (MACRO AGGREGATE) ───────────────────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE above): the economy
  // domain has its OWN failure/recovery vocabulary. CRITICAL: economy is the
  // MACRO AGGREGATE — it binds to whole-economy indicators, NOT to single
  // companies and NOT to capital-markets/credit/banking (that is FINANCE's lane,
  // which stays DISTINCT). Where finance reads liquidity crunch / credit spreads,
  // ECONOMY reads the business cycle: GDP & growth, inflation (CPI / PCE),
  // employment & labor markets, consumer & business sentiment, fiscal & monetary
  // policy (interest rates / central banks), productivity, money supply, the
  // trade balance, and the recession/expansion cycle.
  //
  // Anchors are REAL FRED series ids (UNRATE, PAYEMS, GDP, GDPC1, CPIAUCSL,
  // PCEPI, FEDFUNDS, DGS10, UMCSENT, INDPRO) and broad-market proxies (SPY, DIA,
  // TLT, GLD) — NEVER single-company tickers, NEVER energy/oil/grid content.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, macro content.
  var ECONOMY_DESTABILIZING = [
    // Unemployment above trend — UNRATE / PAYEMS deterioration, jobless claims.
    { re: /unemploy(ment)? (rise|surge|above|spike|elevat)|jobless (claim|rate) (rise|surge|spike)|payroll(s)? (decline|drop|contract)|labor market (weaken|deterior|loosen)|\bunrate\b|\bpayems\b|job (loss(es)?|cuts|shedding)/i, weight: 0.18, tag: 'unemployment_above_trend' },
    // Demand shock — consumer/retail demand collapse, PCE / consumption falling.
    { re: /demand (shock|collapse|destruction|contract|slump)|consumer (spending|demand) (decline|drop|weaken)|retail sales (decline|drop|fall)|consumption (contract|fall)|\bpce\b (decline|fall)|aggregate demand (weak|fall)/i, weight: 0.15, tag: 'demand_shock' },
    // Supply shock — input/supply-side disruption, INDPRO falling, shortages.
    { re: /supply shock|supply-?side (shock|disrupt|constraint)|industrial production (decline|drop|contract)|\bindpro\b (decline|fall)|capacity (constraint|bottleneck)|input (shortage|cost surge)|stagflation/i, weight: 0.15, tag: 'supply_shock' },
    // Credit tightening (macro) — lending standards tighten, monetary tightening.
    { re: /credit (tighten|conditions tighten)|lending standards tighten|monetary tighten|rate (hike(s)?|increase)|\bfedfunds\b (rise|hike)|restrictive (policy|stance)|tightening cycle|financial conditions tighten/i, weight: 0.14, tag: 'credit_tightening' },
    // Yield-curve inversion — DGS10 / 2s10s inversion, recession signal.
    { re: /yield curve (invert|inversion)|inverted (yield )?curve|2s10s invert|curve inver|\bdgs10\b (invert|below)|recession (signal|warning|risk|fear)|hard landing/i, weight: 0.16, tag: 'yield_curve_inversion' },
    // Real-wage stagnation — inflation outpacing wages, CPI / PCEPI surge.
    { re: /real wage(s)? (stagnat|decline|fall|erod)|wage(s)? (stagnat|lag)|inflation (surge|spike|accelerat|sticky|persist)|\bcpiaucsl\b (surge|rise)|\bpcepi\b (surge|rise)|cost of living (crisis|surge)|purchasing power (erod|decline)/i, weight: 0.13, tag: 'real_wage_stagnation' },
    // Capacity-utilization collapse / recession — GDP contraction, output gap.
    { re: /capacity utilization (collapse|drop|decline|fall)|output gap (widen|negative)|gdp (contract|decline|shrink|negative)|\bgdpc1\b (contract|decline)|recession(ary)?|two (consecutive )?quarters? (of )?contraction|economic (downturn|contraction)/i, weight: 0.14, tag: 'capacity_utilization_collapse' },
    // Policy error — central-bank misstep, fiscal drag, policy-induced shock.
    { re: /policy (error|mistake|misstep)|central bank (error|behind the curve|misstep)|fiscal (drag|cliff|austerity shock)|over(-| )?tighten|premature (easing|tightening)|debt ceiling (crisis|standoff)|policy (uncertainty|shock)/i, weight: 0.12, tag: 'policy_error' }
  ];
  var ECONOMY_STABILIZING = [
    // Labor-market recovery — UNRATE falling, PAYEMS gains, hiring strength.
    { re: /labor market (recover|strengthen|tighten healthy|improv)|unemploy(ment)? (decline|fall|drop|improv)|payroll(s)? (gain|growth|surge|beat)|\bpayems\b (gain|rise)|hiring (strength|surge|recover)|jobs? (added|growth|recover)|full employment/i, weight: 0.16, tag: 'labor_market_recovery' },
    // Demand rebound — consumer/retail demand recovery, PCE / spending rising.
    { re: /demand (rebound|recover|resilien|surge)|consumer (spending|demand) (rise|grow|strong|rebound)|retail sales (rise|grow|beat|rebound)|consumption (rise|grow|strong)|\bpce\b (rise|grow)|spending (resilien|strong)/i, weight: 0.15, tag: 'demand_rebound' },
    // Credit normalization (macro) — lending eases, rate cuts, soft landing.
    { re: /credit (normaliz|ease|easing)|lending standards (ease|loosen)|monetary (easing|accommodat)|rate (cut(s)?|reduction)|\bfedfunds\b (cut|lower)|soft landing|financial conditions (ease|loosen)|easing cycle/i, weight: 0.14, tag: 'credit_normalization' },
    // Fiscal stimulus — fiscal support, infrastructure/spending boost, transfers.
    { re: /fiscal (stimulus|support|expansion|boost)|government (spending|stimulus|support)|stimulus (package|payment)|fiscal (impulse|injection)|transfer payment(s)? (boost|increase)|tax (cut|relief) (boost|stimul)/i, weight: 0.14, tag: 'fiscal_stimulus' },
    // Productivity acceleration — INDPRO / output-per-hour rising, efficiency.
    { re: /productivity (acceler|surge|gain|growth|boom)|output per hour (rise|grow)|industrial production (rise|grow|expand|beat)|\bindpro\b (rise|grow)|efficiency (gain|surge)|total factor productivity (rise|grow)/i, weight: 0.15, tag: 'productivity_acceleration' },
    // Investment recovery — capex revival, business confidence, sentiment up.
    { re: /investment (recover|revival|surge|rebound)|capex (recover|surge|grow|rise)|business (confidence|sentiment) (rise|improv|recover)|consumer (confidence|sentiment) (rise|improv)|\bumcsent\b (rise|improv)|expansion(ary)?|economic (recovery|upturn|rebound)/i, weight: 0.14, tag: 'investment_recovery' }
  ];

  // ─── Technology-native semantics ──────────────────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY above):
  // the technology domain has its OWN failure/recovery vocabulary. Where energy
  // reads crude_above_90 / grid_stress / chokepoint, infrastructure reads
  // grid_reliability / deferred_maintenance, culture reads the attention economy,
  // finance reads liquidity/credit, and economy reads the business cycle,
  // TECHNOLOGY reads the compute-and-innovation stack: semiconductors & compute
  // (fab capacity, chip-cycle lead times, silicon node transitions), AI/ML
  // (GPU/TPU scarcity, training capex, inference bottlenecks), software & cloud
  // (cloud quota stress, API deprecation, platform shifts), hardware & devices
  // (end-of-life cycles, obsolescence), cybersecurity (0-day spikes, supply-chain
  // attacks, firmware compromise), and the R&D / breakthrough pipeline
  // (foundational-model releases, transformative chip architectures, quantum
  // milestones).
  //
  // Anchors are REAL technology tickers (AAPL, MSFT, NVDA, GOOGL, META, AMZN,
  // AVGO, ORCL, CRM, AMD, INTC, TSM, ASML, PLTR, CRWD, PANW) — NEVER oil/gas/grid
  // content. Technology COUPLES to energy via datacenter compute/power demand,
  // but its IDENTITY stays chips/software/AI/cyber, and it stays DISTINCT from
  // finance (fintech is a coupling, not the identity). ADVISORY ONLY — wholly
  // separate from the validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, technology content.
  var TECHNOLOGY_DESTABILIZING = [
    // Compute shortage — GPU/TPU scarcity, cloud quota stress, inference bottleneck.
    { re: /gpu (shortage|scarcity|allocation|constrain)|tpu (shortage|scarcity)|compute (shortage|scarcity|crunch|constrain)|cloud (quota|capacity) (stress|constrain|limit)|(ai )?inference (bottleneck|constrain)|accelerator shortage|\bnvda\b (allocation|shortage)/i, weight: 0.18, tag: 'compute_shortage' },
    // Chip-cycle disruption — fab queue depth above baseline, manufacturing lead-time.
    { re: /fab (queue|capacity) (constrain|deep|stress)|chip (cycle|shortage|glut)|wafer (shortage|constrain)|manufacturing lead(-| )?time (rise|stretch|extend)|foundry (constrain|backlog)|node (transition|migration) (delay|stress)|\btsm\b (constrain|delay)/i, weight: 0.16, tag: 'chip_cycle' },
    // AI capex spiral — ballooning training costs, datacenter power/water constraints.
    { re: /(ai|training) capex (spiral|balloon|surge|overrun)|training cost(s)? (balloon|surge|spiral)|datacenter (power|water) (constrain|budget|shortage)|model training (cost|budget) (surge|overrun)|hyperscale capex (surge|strain)|power budget (constrain|cap)/i, weight: 0.15, tag: 'ai_capex_spiral' },
    // Platform shift — API deprecation, vendor lock-in release, proprietary-to-open.
    { re: /api (deprecat|sunset|breaking change)|platform (shift|migration|deprecat)|vendor lock(-| )?in|proprietary(-| )?to(-| )?open|sdk (deprecat|breaking)|breaking (api|change) (adopt|forced)|ecosystem (fragment|migration)/i, weight: 0.13, tag: 'platform_shift' },
    // Obsolescence — hardware EOL acceleration, silicon node transitions, supply risk.
    { re: /(hardware|device|silicon) (end[-\s]?of[-\s]?life|eol|obsolesc)|end[-\s]?of[-\s]?life (cycle|accelerat)|legacy (hardware|node) (sunset|deprecat)|node (transition|shrink) risk|\basml\b (supply|risk)|equipment (obsolesc|sunset)/i, weight: 0.12, tag: 'obsolescence' },
    // Cyber breach — 0-day volumetric spike, supply-chain attack, firmware compromise.
    { re: /0[-\s]?day|zero[-\s]?day (spike|surge|exploit)|supply[-\s]?chain attack|firmware (compromise|implant)|(software|dependency) supply[-\s]?chain (attack|compromise)|exploit (rate|wave) (surge|spike)|breach (volumetric|wave|surge)|\bcrwd\b|\bpanw\b (incident|alert)/i, weight: 0.15, tag: 'cyber_breach' },
    // Supply constraint — TSMC/ASML/Samsung/Intel lead-time stress, equipment backlog.
    { re: /(tsmc|asml|samsung|intel) (lead[-\s]?time|constrain|backlog|delay)|lithography (constrain|shortage)|euv (constrain|backlog)|substrate (shortage|constrain)|advanced packaging (constrain|shortage)|supply (constrain|risk) (chip|semiconductor)/i, weight: 0.13, tag: 'supply_constraint' }
  ];
  var TECHNOLOGY_STABILIZING = [
    // Fab capacity recovery — foundry build-out, wafer supply normalizing.
    { re: /fab (capacity|build[-\s]?out) (recover|expand|online|ramp)|foundry (capacity|expansion) (online|ramp|complet)|wafer (supply|capacity) (recover|normaliz|ample)|chip (supply|capacity) (recover|normaliz|ease)|new fab (online|operational)|capacity (ramp|expansion) (chip|semiconductor)/i, weight: 0.16, tag: 'fab_capacity_recovery' },
    // Efficient-inference breakthrough — cheaper compute, distillation, open weights.
    { re: /efficient(-| )?inference (breakthrough|gain)|inference cost(s)? (drop|fall|decline)|model (distillation|compression|quantiz) (gain|breakthrough)|compute (efficien|cost) (gain|improv)|cheaper (compute|inference|training)|throughput (breakthrough|surge)/i, weight: 0.15, tag: 'efficient_inference' },
    // Open-source AI adoption — open weights/models, ecosystem standardization.
    { re: /open(-| )?source (ai|model|llm) (adopt|surge|momentum)|open weights? (release|adopt)|open(-| )?model (ecosystem|adopt)|community (model|framework) (adopt|momentum)|standardiz(ed|ation) (api|framework|model)|interoperab(le|ility) (gain|standard)/i, weight: 0.14, tag: 'open_source_adoption' },
    // Supply-chain diversification — TSMC/Samsung/Intel parity, reshoring, second-source.
    { re: /supply(-| )?chain (diversif|resilien|reshore)|(tsmc|samsung|intel|gf) (parity|second(-| )?source|capacity online)|reshor(e|ing)|second(-| )?source(d|ing)|geographic (diversif|spread) (fab|chip)|domestic (fab|chip) (capacity|production)|chips act (capacity|fund)/i, weight: 0.15, tag: 'supply_chain_diversification' },
    // Cybersecurity framework maturation — patched, hardened, zero-trust adoption.
    { re: /(patch|remediat) (deploy|complet|rollout)|zero(-| )?trust (adopt|deploy|maturat)|security (framework|posture) (matur|harden|strengthen)|vuln(erabilit(y|ies))? (patched|remediated|closed)|threat (contain|mitigat|patched)|\bcrwd\b (deploy|coverage)|defense(-| )?in(-| )?depth (deploy|maturat)/i, weight: 0.14, tag: 'cyber_framework_maturation' },
    // Breakthrough — foundational model, transformative chip architecture, quantum milestone.
    { re: /foundational (model|ai) (release|launch|breakthrough)|transformative (chip|architecture|silicon)|new (chip|gpu|accelerator) architecture (launch|breakthrough)|quantum (milestone|breakthrough|advantage)|next(-| )?gen (silicon|node|process) (launch|ramp)|breakthrough (model|chip|architecture)/i, weight: 0.13, tag: 'breakthrough' }
  ];

  // ─── Defense-native semantics ─────────────────────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY above): the defense domain has its OWN failure/recovery
  // vocabulary. Where energy reads crude_above_90 / grid_stress / chokepoint,
  // infrastructure reads grid_reliability / deferred_maintenance, culture reads
  // the attention economy, finance reads liquidity/credit, economy reads the
  // business cycle, and technology reads the compute stack, DEFENSE reads
  // military power & national security: military spending & procurement, the
  // defense industrial base, geopolitical conflict & deterrence, weapons
  // systems, military readiness, alliances & basing, and electronic/kinetic
  // warfare. Destabilizing = force-readiness erosion, procurement delays &
  // munitions stockpile depletion, conflict escalation, deterrence failure,
  // industrial-base strain, alliance stress, defense-industrial consolidation.
  // Stabilizing = force-modernization completions, procurement acceleration,
  // weapons-system upgrades, strategic-deterrence credibility, and
  // alliance-strengthening signals.
  //
  // Anchors are REAL defense tickers (LMT, RTX, NOC, GD, BA, LHX, HII, LDOS,
  // BAH, KTOS, AVAV) — NEVER oil/gas/grid content. Defense COUPLES to energy via
  // fuel logistics / strategic reserves, but its IDENTITY stays kinetic /
  // industrial / readiness, kept DISTINCT from intelligence (collection /
  // analysis / espionage) and from technology (cyber is a coupling, not the
  // identity). ADVISORY ONLY — wholly separate from the validated P3 distress
  // kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, defense content.
  var DEFENSE_DESTABILIZING = [
    // Conflict escalation — geopolitical flashpoint, kinetic escalation, mobilization.
    { re: /conflict (escalat|intensif|spread)|escalat(ion|ing) (risk|spiral)|(armed|military) conflict|hostilities (erupt|escalat)|kinetic (action|escalat|strike)|mobiliz(e|ation) (forces|troops)|war (outbreak|footing|imminent)|flashpoint/i, weight: 0.18, tag: 'conflict_escalation' },
    // Deterrence failure — credibility erosion, red-line crossed, posture breakdown.
    { re: /deterrence (fail|erod|gap|breakdown|credibility (loss|erod))|red(-| )?line (cross|breach)|posture (breakdown|gap)|strategic (stability|deterrence) (erod|fail)|nuclear (threat|posture) (escalat|degrad)|miscalculation risk/i, weight: 0.17, tag: 'deterrence_failure' },
    // Readiness erosion — force readiness decline, maintenance/sortie shortfall, manning gap.
    { re: /(force|combat|operational|fleet) readiness (decline|erod|shortfall|gap|drop)|readiness (decline|erod|crisis)|sortie (rate|generation) (shortfall|decline)|mission(-| )?capable rate (drop|decline)|manning (gap|shortfall)|recruit(ing|ment) (shortfall|crisis)|maintenance (backlog|shortfall) (fleet|depot)/i, weight: 0.16, tag: 'readiness_erosion' },
    // Procurement delay — program slip, cost overrun, schedule breach, milestone slip.
    { re: /procurement (delay|slip|stall)|program (delay|slip|breach|overrun|cancel)|(cost|schedule) (overrun|breach|slip)|milestone (slip|miss|delay)|acquisition (delay|stall|nunn(-| )?mcurdy)|(lmt|rtx|noc|gd|ba|lhx|hii) (program )?(delay|slip|overrun)|fielding delay/i, weight: 0.15, tag: 'procurement_delay' },
    // Munitions / stockpile depletion — magazine depth, inventory drawdown, expenditure outpacing.
    { re: /munition(s)? (shortage|depletion|drawdown|stockout)|(magazine|stockpile|inventory) (depth|depletion|drawdown|low)|(missile|interceptor|round|shell) (shortage|stockout|depletion)|expenditure (outpac|exceed) production|war(-| )?reserve (deplet|drawdown)|ammunition shortage/i, weight: 0.16, tag: 'munitions_depletion' },
    // Industrial-base strain — supplier fragility, capacity bottleneck, sub-tier failure.
    { re: /(defense |industrial )?(industrial base|supplier base|supply chain) (strain|fragil|bottleneck|gap|erod)|sub(-| )?tier (supplier )?(failure|fragil|loss)|(production|manufacturing) (capacity|line) (bottleneck|constrain|gap)|sole(-| )?source (risk|loss)|workforce (gap|shortfall) (defense|shipyard)|(hii|shipyard) (capacity|backlog) (strain|constrain)/i, weight: 0.14, tag: 'industrial_base_strain' },
    // Alliance stress — coalition fracture, burden-sharing dispute, basing access loss.
    { re: /alliance (stress|strain|fractur|fray|rift)|coalition (fractur|fray|collaps|strain)|burden(-| )?sharing (dispute|gap|shortfall)|basing (access|rights) (loss|denial|restrict)|nato (rift|strain|fractur)|allied (cohesion|commitment) (erod|doubt)|partner (defect|withdraw)/i, weight: 0.13, tag: 'alliance_stress' }
  ];
  var DEFENSE_STABILIZING = [
    // Force modernization — program completion, capability fielding, recapitalization.
    { re: /(force )?moderniz(e|ation) (complet|deliver|field|milestone)|recapitaliz(e|ation) (complet|fund|fleet)|(capability|system) (fielding|deliver|ioc|full(-| )?rate production)|(initial|full) operational capability|next(-| )?gen (platform|system) (field|deliver)|(lmt|rtx|noc|gd|ba|lhx) (deliver|field|milestone (achiev|pass))/i, weight: 0.17, tag: 'force_modernization' },
    // Procurement acceleration — contract award, production ramp, multi-year buy, funding boost.
    { re: /procurement (acceler|boost|surge|ramp)|production (ramp(-| )?up|surge|accelerat|line (open|restart))|multi(-| )?year (procurement|buy|contract)|(contract|award) (boost|surge|increase)|(budget|appropriation) (boost|increase|plus(-| )?up) (defense|procurement)|(ktos|avav|ldos) (award|ramp|surge)/i, weight: 0.15, tag: 'procurement_acceleration' },
    // Weapons-system upgrade — block upgrade, capability insertion, lethality improvement.
    { re: /(weapons?(-| )?system|platform) (upgrade|enhancement)|block (upgrade|insertion)|capability (insertion|upgrade|spiral)|(lethality|survivability|range) (upgrade|improv|enhance)|modernization (upgrade|retrofit)|(rtx|lmt|noc) (upgrade|enhancement (deliver|complet))/i, weight: 0.14, tag: 'weapons_system_upgrade' },
    // Strategic-deterrence credibility — posture strengthened, triad recapitalized, signaling.
    { re: /deterrence (credibility|posture) (strengthen|restor|reinforc|improv)|strategic (deterrence|stability) (strengthen|restor|reinforc)|(triad|nuclear) (recapitaliz|moderniz) (complet|fund|on track)|extended deterrence (reaffirm|strengthen)|posture (strengthen|reinforc|enhanced)|credible (deterrent|force)/i, weight: 0.15, tag: 'strategic_deterrence_credibility' },
    // Alliance strengthening — coalition cohesion, burden-sharing gains, basing expansion.
    { re: /alliance (strengthen|cohesion|reinforc|expand|deepen)|coalition (cohesion|strengthen|expand|reinforc)|burden(-| )?sharing (gain|increase|commitment)|basing (expand|access (gain|secured)|new agreement)|nato (cohesion|strengthen|expand|enlarg)|(allied|partner) (commitment|interoperab) (strengthen|deepen|gain)|defense (pact|agreement) (sign|secured)/i, weight: 0.13, tag: 'alliance_strengthening' }
  ];

  // ─── Intelligence-native semantics ────────────────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE above): the intelligence domain has its OWN failure/
  // recovery vocabulary. Where energy reads crude_above_90 / grid_stress /
  // chokepoint, infrastructure reads grid_reliability / deferred_maintenance,
  // culture reads the attention economy, finance reads liquidity/credit,
  // economy reads the business cycle, technology reads the compute stack, and
  // defense reads kinetic military power, INTELLIGENCE reads the collection-and-
  // assessment cycle: signals/human/geospatial/open-source collection (SIGINT /
  // HUMINT / GEOINT / OSINT), all-source analysis & assessment, espionage &
  // counterintelligence, surveillance & reconnaissance, threat warning, covert
  // action & influence operations, and security clearance & insider risk.
  // Destabilizing = signal blindness / collection gaps / low observability,
  // weak anomaly detection, analytic distortion / bias, oversight failure,
  // trust-boundary breach, privacy violation, and bulk-collection excess.
  // Stabilizing = improved observability, collection expansion, analytical
  // debiasing, oversight strengthening, trust-boundary repair, and
  // counterintelligence containment.
  //
  // Anchors are REAL intelligence-sector tickers (PLTR, BAH, LDOS, CACI, SAIC,
  // KBR, VRNT, NICE, VRSK) — NEVER oil/gas/grid content. Intelligence COUPLES to
  // technology via cyber tooling and to defense via warning support, but its
  // IDENTITY stays collection / analysis / espionage, kept DISTINCT from defense
  // (kinetic / industrial / readiness) and from technology (cyber tooling is a
  // coupling, not the identity). ADVISORY ONLY — wholly separate from the
  // validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, intelligence content.
  var INTELLIGENCE_DESTABILIZING = [
    // Signal blindness / collection gap — coverage holes, going dark, blind spots.
    { re: /signal blindness|collection gap|coverage (gap|hole|loss)|going dark|(intelligence|collection) blind ?spot|loss of (collection|coverage|access)|denied (area|access) collection|(sigint|humint|geoint|osint) gap/i, weight: 0.18, tag: 'collection_gap' },
    // Low observability — sensor/source degradation, reduced visibility, dark target.
    { re: /low observability|reduced (visibility|observability)|sensor (degrad|loss|gap)|source (dry ?up|loss|degrad)|(target|adversary) goes? dark|observability (decline|drop|gap)|reconnaissance (gap|shortfall)/i, weight: 0.16, tag: 'low_observability' },
    // Weak anomaly detection — missed indicators, warning failure, surprise.
    { re: /weak anomaly detection|missed (indicator|warning|signal)|warning (fail|gap|shortfall)|(strategic|tactical) surprise|indicator(s)? (missed|overlooked)|anomaly (detection )?(fail|gap|miss)|failure to warn/i, weight: 0.16, tag: 'weak_anomaly_detection' },
    // Analytic distortion — bias, politicization, groupthink, mirror-imaging.
    { re: /analytic(al)? distortion|analytic(al)? bias|politici[sz](ed|ation) (intelligence|analysis)|groupthink|mirror(-| )?imaging|confirmation bias|cherry(-| )?pick(ing|ed) (intelligence|evidence)|cognitive bias (analysis|assessment)/i, weight: 0.15, tag: 'analytic_distortion' },
    // Oversight failure — accountability breakdown, unauthorized program, no review.
    { re: /oversight (fail|breakdown|gap|lapse)|accountability (breakdown|gap|fail)|unauthoriz(ed|ation) (program|collection|surveillance)|(congressional|judicial|fisa) oversight (fail|bypass|gap)|no (review|warrant)|unchecked (collection|surveillance)/i, weight: 0.14, tag: 'oversight_failure' },
    // Trust-boundary breach — insider threat, leak, espionage penetration, compromise.
    { re: /trust(-| )?boundary breach|insider (threat|risk) (event|breach)|(classified )?leak|espionage (penetration|breach)|mole|exfiltrat(e|ion) (classified|intelligence)|clearance (compromise|abuse)|(double agent|penetration) (detected|suspected)/i, weight: 0.16, tag: 'trust_boundary_breach' },
    // Privacy violation / bulk-collection excess — overreach, mass surveillance, abuse.
    { re: /privacy violation|civil(-| )?liberties (violation|abuse)|bulk collection (excess|abuse|overreach)|mass surveillance (overreach|abuse)|warrantless (collection|surveillance)|(metadata|data) (overcollection|overreach)|surveillance (overreach|abuse)/i, weight: 0.13, tag: 'privacy_violation' }
  ];
  var INTELLIGENCE_STABILIZING = [
    // Improved observability — restored coverage, new sensors, visibility gains.
    { re: /improved observability|restored (collection|coverage|visibility)|new (sensor|source|access) (online|gain|deploy)|observability (gain|improv|recover)|coverage (restored|expand|regain)|(sigint|geoint) (coverage|access) (restored|gain)|visibility (gain|recover)/i, weight: 0.16, tag: 'improved_observability' },
    // Collection expansion — new sources/platforms, access development, capacity ramp.
    { re: /collection (expansion|ramp|growth|capacity (gain|expand))|new (collection )?(platform|source) (online|recruit|develop)|access (development|gain|expand)|(humint|sigint|geoint|osint) (expansion|capacity (gain|build))|source (recruit|development) (gain|success)/i, weight: 0.15, tag: 'collection_expansion' },
    // Analytical debiasing — red-team, alternative analysis, structured techniques.
    { re: /analytic(al)? debias(ing)?|red(-| )?team(ing)? (analysis|review)|alternative (analysis|competitive|hypothes)|structured analytic technique|devil'?s advocacy|(bias|distortion) (mitigat|correct|reduc)|tradecraft (improv|strengthen)/i, weight: 0.15, tag: 'analytical_debiasing' },
    // Oversight strengthening — accountability restored, review reinstated, transparency.
    { re: /oversight (strengthen|reinforc|restor|reinstat)|accountability (restor|strengthen|reinforc)|(congressional|judicial|fisa) (review|oversight) (restor|strengthen|reinstat)|transparency (gain|increase|reform)|warrant (process )?(restor|reform)|(safeguard|control) (restor|strengthen)/i, weight: 0.14, tag: 'oversight_strengthening' },
    // Trust-boundary repair — insider-risk mitigation, vetting hardened, breach contained.
    { re: /trust(-| )?boundary (repair|restor|harden)|insider(-| )?risk (mitigat|program (strengthen|deploy)|contain)|(clearance|vetting) (harden|reform|strengthen)|(leak|breach) (contain|remediat|plug)|continuous (vetting|evaluation) (deploy|strengthen)|access (control) (harden|strengthen)/i, weight: 0.15, tag: 'trust_boundary_repair' },
    // Counterintelligence containment — penetration neutralized, mole caught, CI win.
    { re: /counter(-| )?intelligence (containment|win|success|operation)|(penetration|mole|spy) (neutraliz|caught|contain|expell)|(espionage|exfiltration) (contain|disrupt|thwart)|ci (operation|win|success)|(double agent|network) (rolled ?up|neutraliz)|hostile (service|collection) (disrupt|contain)/i, weight: 0.13, tag: 'counterintelligence_containment' }
  ];

  // ─── Trade / supply-chain-native semantics ────────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE above): the trade domain (runtime key
  // 'supplyChain') has its OWN failure/recovery vocabulary. Where energy reads
  // crude_above_90 / grid_stress / chokepoint, infrastructure reads
  // grid_reliability / deferred_maintenance, culture reads the attention
  // economy, finance reads liquidity/credit, economy reads the business cycle,
  // technology reads the compute stack, defense reads kinetic military power,
  // and intelligence reads the collection cycle, TRADE reads international
  // trade & commerce: exports/imports, tariffs & trade policy, shipping &
  // logistics, supply chains, the trade balance, customs, trade agreements,
  // sanctions/embargoes, and freight & ports. Destabilizing = tariff shock /
  // trade-war escalation, sanctions / export bans, port congestion & closures,
  // chokepoint / route constraint, freight-rate spikes, customs / clearance
  // disruption, and supply-chain bottlenecks (sourcing disruption, production
  // halt, container shortage). Stabilizing = tariff normalization, sanctions
  // relief, port reopening, container-capacity recovery, customs-clearance
  // acceleration, and freight-rate stabilization.
  //
  // Anchors are REAL trade/logistics tickers (FDX, UPS, EXPD, CHRW, ZIM, MATX,
  // XPO, GXO, AMKBY, DSDVY, ODFL) — NEVER oil/gas/grid content. Trade COUPLES to
  // energy via bunker/fuel cost and to economy via the trade balance, but its
  // IDENTITY stays exports/tariffs/shipping/ports/customs, kept DISTINCT from
  // economy (the MACRO aggregate / business cycle) and from industry (domestic
  // PRODUCTION / manufacturing output). ADVISORY ONLY — wholly separate from the
  // validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, trade content.
  var TRADE_DESTABILIZING = [
    // Tariff shock / trade-war escalation — duties imposed, retaliation, escalation.
    { re: /tariff(s)? (shock|hike|spike|impos|escalat|increase|surge)|trade war (escalat|erupt|intensif)|retaliat(ory|ion) (tariff|duty|measure)|duties (impos|rais|hike)|protectionis(t|m) (surge|escalat)|trade (tension|dispute) (escalat|intensif)/i, weight: 0.18, tag: 'tariff_shock' },
    // Sanctions / export ban / embargo — restrictions cutting off flows.
    { re: /sanction(s)? (impos|tighten|expand|escalat)|export (ban|control|restrict|curb)|embargo|trade (ban|blockade|restrict)|entity list|secondary sanction|export licen(s|c)e (deny|revoke)/i, weight: 0.17, tag: 'sanctions_export_ban' },
    // Port congestion / closure — backlog, gridlock, strike, terminal shutdown.
    { re: /port (congestion|backlog|gridlock|closure|shutdown|strike)|terminal (congestion|closure|shutdown)|berth (delay|congestion)|dwell time (surge|spike)|vessel (queue|backlog|wait)|dockworker(s)? strike|harbor (closure|congestion)/i, weight: 0.16, tag: 'port_congestion' },
    // Chokepoint / route constraint — canal/strait closure, blockade, rerouting.
    { re: /chokepoint (closure|disrupt|block)|(suez|panama) canal (closure|disrupt|block|restrict|drought)|(strait|red sea|bab[-\s]?el[-\s]?mandeb|hormuz|malacca) (closure|disrupt|attack|block)|blockade|route (constraint|closure|divert)|rerout(e|ing) (around|via)|transit (denial|restrict)/i, weight: 0.16, tag: 'route_constraint' },
    // Freight-rate spike — shipping cost surge, container/spot rate blowout.
    { re: /freight (rate|cost) (spike|surge|soar|blow)|shipping (cost|rate) (spike|surge|soar)|container (rate|price) (spike|surge|soar)|spot rate (surge|spike|blow)|ocean freight (surge|spike)|bunker (cost|surcharge) (surge|spike)/i, weight: 0.14, tag: 'freight_rate_spike' },
    // Customs / clearance disruption — border delays, inspection backlog, clearance failure.
    { re: /customs (delay|disrupt|backlog|congestion)|clearance (fail|delay|backlog|stall)|border (delay|closure|gridlock)|inspection (backlog|delay|surge)|(border|customs) (hold|detention)|documentation (delay|reject)/i, weight: 0.13, tag: 'customs_disruption' },
    // Supply-chain bottleneck — sourcing disruption, production halt, container shortage.
    { re: /supply(-| )?chain (bottleneck|disrupt|breakdown|gridlock)|sourcing (disrupt|gap|failure)|production halt|(component|input) (shortage|stockout) (sourc|import)|container (shortage|imbalance|repositioning)|stockout(s)? (import|sourc)|lead(-| )?time (stretch|blow) (import|sourc)/i, weight: 0.14, tag: 'supply_chain_bottleneck' }
  ];
  var TRADE_STABILIZING = [
    // Tariff normalization — rollback, exemption, trade deal, de-escalation.
    { re: /tariff(s)? (rollback|reduc|cut|exempt|normaliz|suspend|removed)|trade (deal|agreement|accord|pact) (sign|reach|ratif)|de(-| )?escalat(e|ion) (trade|tariff)|trade (truce|détente|normaliz)|duty (relief|exemption|waiver)|free(-| )?trade (agreement|deal)/i, weight: 0.16, tag: 'tariff_normalization' },
    // Sanctions relief — restrictions lifted, license granted, embargo eased.
    { re: /sanction(s)? (relief|lift|eas|remov|waiver)|export (control|ban|restrict) (eas|lift|remov)|embargo (lift|eas|end)|licen(s|c)e (grant|approv|reinstat)|trade (restrict|ban) (lift|remov)|delist(ed|ing) (entity|sanction)/i, weight: 0.15, tag: 'sanctions_relief' },
    // Port reopening / throughput recovery — backlog cleared, congestion easing.
    { re: /port (reopen|recovery|clear|throughput (recover|rise))|congestion (eas|clear|resolv)|backlog (clear|reduc|burn)|terminal (reopen|recover|fluid)|dwell time (drop|decline|normaliz)|berth (avail|free)|harbor (reopen|fluid)/i, weight: 0.15, tag: 'port_reopening' },
    // Container-capacity recovery — equipment available, imbalance resolving, fleet capacity.
    { re: /container (capacity|availability) (recover|rise|ample|restor)|equipment (available|surplus|repositioned)|container imbalance (resolv|eas|correct)|(vessel|fleet) capacity (add|expand|ample)|new (capacity|tonnage) (online|deliver)|shipping capacity (recover|expand)/i, weight: 0.14, tag: 'container_capacity_recovery' },
    // Customs-clearance acceleration — faster processing, single-window, facilitation.
    { re: /customs (clearance )?(accelerat|expedit|streamlin|facilitat)|clearance (faster|expedit|accelerat|automat)|(border|trade) facilitation|single(-| )?window (deploy|launch)|(border|customs) (fluid|throughput (rise|gain))|pre(-| )?clearance (deploy|expand)/i, weight: 0.14, tag: 'customs_clearance_acceleration' },
    // Freight-rate stabilization — rates normalizing, cost easing, spot softening.
    { re: /freight (rate|cost) (stabiliz|normaliz|eas|soften|decline|drop)|shipping (cost|rate) (eas|soften|decline|normaliz)|container (rate|price) (eas|soften|decline|normaliz)|spot rate (soften|decline|normaliz)|ocean freight (eas|soften|decline)|rate(s)? (normaliz|stabiliz)/i, weight: 0.14, tag: 'freight_rate_stabilization' }
  ];

  // ─── Industry-native semantics (MANUFACTURING & INDUSTRIAL PRODUCTION) ─────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE above): the industry domain has
  // its OWN failure/recovery vocabulary. Where energy reads crude_above_90 /
  // grid_stress / chokepoint, infrastructure reads grid_reliability /
  // deferred_maintenance, culture reads the attention economy, finance reads
  // liquidity/credit, economy reads the business cycle, technology reads the
  // compute stack, defense reads kinetic military power, intelligence reads the
  // collection cycle, and trade reads exports/tariffs/shipping/ports, INDUSTRY
  // reads manufacturing & industrial production: factory output & capacity
  // utilization, automation & robotics, heavy industry & capital goods,
  // industrial supply chains, machinery & equipment, and industrial maintenance.
  // Destabilizing = capacity-utilization collapse, production halt, automation
  // failure, input-cost squeeze, factory shutdown, industrial recession,
  // supply-chain bottleneck (sourcing/parts to the LINE), and equipment-failure
  // cascade. Stabilizing = capacity modernization, automation investment,
  // output recovery, order-book strength, reshoring/capacity build-out, and
  // industrial maintenance / uptime restoration.
  //
  // STRUCTURAL ANCHORS (energy parity — energy uses crude-price thresholds and
  // grid-reserve-margin floors): industry uses the MANUFACTURING PMI threshold
  // (PMI < 50 = contraction floor, analogous to grid reserve margin < 10%) and
  // the CAPACITY-UTILIZATION-vs-POTENTIAL output gap floor (a widening negative
  // output gap = structural slack). Anchors are REAL FRED-style industrial
  // series (ISM/Manufacturing PMI, TCU capacity utilization, INDPRO industrial
  // production, NEWORDER durable-goods orders) and REAL industrial tickers
  // (CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV) — NEVER oil/gas/
  // grid content as the domain's OWN identity.
  //
  // Industry COUPLES to trade via parts/inputs and to economy via INDPRO, but
  // its IDENTITY stays factory output / capacity utilization / automation /
  // machinery, kept DISTINCT from trade (logistics/commerce/ports), economy
  // (the MACRO aggregate / business cycle), and technology (automation/robotics
  // software is a COUPLING, not the identity). ADVISORY ONLY — wholly separate
  // from the validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, industry content.
  var INDUSTRY_DESTABILIZING = [
    // Capacity-utilization collapse — TCU dropping, output gap widening, PMI<50.
    { re: /capacity utilization (collapse|drop|decline|fall|plunge|slump)|\btcu\b (drop|decline|fall)|utilization rate (drop|decline|fall|low)|output gap (widen|negative)|manufacturing pmi (below|under) 50|\bpmi\b (contract|below 50|sub-?50)|ism (manufacturing )?(contract|below 50)|industrial slack (widen|rise)/i, weight: 0.18, tag: 'capacity_utilization_collapse' },
    // Production halt — line stoppage, plant idling, output suspension, INDPRO drop.
    { re: /production (halt|stoppage|suspend|freeze|stall)|(assembly |production )?line (stop|down|idle|halt)|plant (idl|shutter|stop|offline)|output (suspend|halt|frozen)|industrial production (decline|drop|contract|fall)|\bindpro\b (decline|drop|fall)|manufacturing output (decline|drop|contract)/i, weight: 0.16, tag: 'production_halt' },
    // Automation failure — robotics/PLC/control-system breakdown, line automation fault.
    { re: /automation (fail|breakdown|fault|outage)|robot(ic)?(s)? (fail|fault|down|breakdown)|(plc|control system|cnc|scada) (fail|fault|down) (line|plant|factory)|industrial control (fail|breakdown)|automated line (fault|fail|down)|robotics (downtime|failure)/i, weight: 0.15, tag: 'automation_failure' },
    // Input-cost squeeze — raw-material/steel/component cost surge compressing margins.
    { re: /input (cost|price) (squeeze|surge|spike|soar)|raw material(s)? (cost|price) (surge|spike|soar)|(steel|aluminum|copper|resin|component) (cost|price) (surge|spike|soar)|margin (squeeze|compress|erod) (input|material|cost)|cost(-| )?push (squeeze|pressure)|material cost (squeeze|inflation)/i, weight: 0.14, tag: 'input_cost_squeeze' },
    // Factory shutdown — plant closure, facility shuttering, mass layoff at site.
    { re: /factory (shutdown|closure|close|shutter)|plant (closure|shutdown|shutter|close permanent)|facility (closure|shutter|shutdown)|manufacturing (plant|site) (close|shutter)|(mass )?layoff(s)? (plant|factory|manufacturing)|footprint (rationaliz|reduc) (plant|factory)/i, weight: 0.16, tag: 'factory_shutdown' },
    // Industrial recession — durable-goods orders falling, ISM contraction streak.
    { re: /industrial recession|manufacturing recession|durable(-| )?goods? order(s)? (decline|drop|fall|contract)|\bneworder\b (decline|drop|fall)|new orders (contract|decline|drop)|ism (contraction|below 50) (streak|sustained|months)|factory orders (decline|drop|fall)|order book (shrink|decline|thin)/i, weight: 0.15, tag: 'industrial_recession' },
    // Supply-chain bottleneck (to the LINE) — parts/component shortage halting build.
    { re: /(part|component|input|sub(-| )?assembly) (shortage|stockout|gap) (line|build|assembly|production)|supply(-| )?chain bottleneck (production|plant|line)|just(-| )?in(-| )?time (break|disrupt|fail)|sourcing (disrupt|gap) (line|production|build)|missing part(s)? (halt|stop) (line|build)|inventory (stockout|gap) (line|production)/i, weight: 0.13, tag: 'supply_chain_bottleneck' },
    // Equipment-failure cascade — machinery breakdown propagating, unplanned downtime.
    { re: /equipment (failure|breakdown) cascade|(machine|machinery|equipment) (failure|breakdown) (cascade|propagat|chain)|unplanned (downtime|outage) (cascade|spike|surge)|(motor|drive|turbine|press|conveyor) (failure|breakdown) (cascade|chain)|critical (asset|equipment) (failure|down) (cascade|propagat)|mttr (surge|spike|deteriorat)/i, weight: 0.14, tag: 'equipment_failure_cascade' }
  ];
  var INDUSTRY_STABILIZING = [
    // Capacity modernization — plant upgrade, line retool, Industry-4.0 / smart-factory.
    { re: /capacity moderniz|plant (moderniz|upgrade|retool|refit)|line (retool|upgrade|moderniz)|industry 4\.?0|smart(-| )?factory|digital (factory|manufacturing) (deploy|invest)|(brownfield|greenfield) (moderniz|upgrade)|(ge|cat|honeywell|emr|rok|hon) (moderniz|upgrade) (plant|line|capacity)/i, weight: 0.16, tag: 'capacity_modernization' },
    // Automation investment — robotics/cobot deployment, automation capex, throughput.
    { re: /automation (invest|capex|deploy|rollout|expansion)|robot(ic)?(s)? (deploy|invest|install|adopt)|cobot (deploy|adopt)|(industrial )?automation (build|ramp|spend)|(rok|emr|hon|abb|etn) (automation|robotics) (order|deploy|win)|throughput (gain|surge) (automation|robotics)|machine vision (deploy|adopt)/i, weight: 0.15, tag: 'automation_investment' },
    // Output recovery — production rebound, capacity-utilization rising, INDPRO/PMI>50.
    { re: /output (recover|rebound|rise|grow|ramp)|production (recover|rebound|rise|ramp|restart)|capacity utilization (rise|recover|climb|improv)|\btcu\b (rise|recover|climb)|industrial production (rise|grow|expand|rebound|beat)|\bindpro\b (rise|grow)|manufacturing pmi (above 50|expand|54|55)|\bpmi\b (above 50|expansion|expand)/i, weight: 0.16, tag: 'output_recovery' },
    // Order-book strength — durable-goods orders rising, backlog building, bookings.
    { re: /order(-| )?book (strength|grow|build|expand|robust)|durable(-| )?goods? order(s)? (rise|grow|surge|beat)|\bneworder\b (rise|grow)|new orders (rise|grow|surge|expand)|backlog (build|grow|robust|record)|bookings (rise|grow|surge|strong)|book(-| )?to(-| )?bill (above 1|rise|strong)/i, weight: 0.14, tag: 'order_book_strength' },
    // Reshoring / capacity build-out — new plant, onshoring, domestic capacity add.
    { re: /reshor(e|ing)|onshor(e|ing)|nearshor(e|ing) (plant|production|manufactur)|new (plant|factory|line) (open|online|operational|groundbreak)|domestic (capacity|manufactur|production) (add|expand|build)|capacity (build(-| )?out|expansion|add) (plant|factory|line)|(cat|de|ge|hon|mmm|emr|itw|etn|ph|rok|dov|gev) (new plant|capacity (add|expand)|build(-| )?out)/i, weight: 0.15, tag: 'reshoring_capacity_buildout' },
    // Industrial maintenance / uptime restoration — predictive maint, OEE/uptime gains.
    { re: /(predictive|preventive|condition(-| )?based) maintenance (deploy|adopt|gain)|uptime (restor|gain|improv|surge)|\boee\b (gain|improv|rise)|reliability (program|gain|improv) (plant|line|asset)|unplanned downtime (drop|decline|reduc)|mttr (drop|decline|improv)|maintenance (backlog (clear|reduc)|complet)/i, weight: 0.14, tag: 'industrial_maintenance_uptime' }
  ];

  // ─── Agriculture-native semantics (FARMING / CROPS / FOOD PRODUCTION) ─────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE / INDUSTRY above): the
  // agriculture domain has its OWN failure/recovery vocabulary. Where energy
  // reads crude_above_90 / grid_stress / chokepoint, infrastructure reads
  // grid_reliability / deferred_maintenance, culture reads the attention
  // economy, finance reads liquidity/credit, economy reads the business cycle,
  // technology reads the compute stack, defense reads kinetic military power,
  // intelligence reads the collection cycle, trade reads exports/tariffs/ports,
  // and industry reads factory output, AGRICULTURE reads farming & food
  // production: crops & livestock, harvest yields, agribusiness & food supply,
  // food security, fertilizers & crop inputs, irrigation & agricultural water,
  // commodity crops (corn/soy/wheat), ag-technology / precision ag, and farm
  // economics. Destabilizing = crop failure / harvest shortfall, drought
  // stress, fertilizer / input cost spike, food-price surge, livestock
  // disease, export ban (food/grain), commodity-price crash, input-supply
  // disruption, soil degradation, and agricultural water stress. Stabilizing =
  // good yield / harvest completion, commodity-price recovery, government farm
  // support, input-cost normalization, export-market opening, soil-health gain,
  // irrigation investment, and crop-diversity expansion.
  //
  // Anchors are REAL agriculture tickers (ADM Archer-Daniels-Midland, BG Bunge,
  // CTVA Corteva, DE John Deere, NTR Nutrien, MOS Mosaic, CF CF Industries, TSN
  // Tyson, CAG Conagra, INGR Ingredion, AGCO AGCO, FMC FMC) and CBOT commodity
  // / USDA references (CBOT corn / soybean / wheat futures, USDA WASDE crop
  // reports) — NEVER oil/gas/grid content as the domain's OWN identity (biofuel
  // / fertilizer-energy is a COUPLING). Agriculture COUPLES to environment via
  // land/water/climate, to trade via export logistics, and to economy via food
  // prices, but its IDENTITY stays crops/livestock/food-production/farm-inputs,
  // kept DISTINCT from environment (land/water/climate is a coupling), trade
  // (export logistics is a coupling), and economy (food prices is a coupling).
  // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, agriculture content.
  var AGRICULTURE_DESTABILIZING = [
    // Crop failure / harvest shortfall — yield collapse, failed harvest, WASDE cut.
    { re: /crop (failure|fail|loss|collapse)|harvest (shortfall|failure|loss|short)|yield (collapse|loss|plunge|shortfall)|(corn|soy(bean)?|wheat) (yield )?(loss|fail|short)|wasde (cut|downgrade|lower) (yield|production)|failed (crop|harvest)|production (shortfall|cut) (crop|grain)/i, weight: 0.18, tag: 'crop_failure' },
    // Drought stress — agricultural drought, dry conditions, moisture deficit.
    { re: /(agricultural )?drought (stress|condition|deepen|expand|emergency)|dry (condition|spell) (crop|farm|field)|moisture (deficit|stress) (crop|soil)|(crop|farmland) (parched|withered)|water deficit (crop|irrigation)|flash drought|growing(-| )?season drought/i, weight: 0.16, tag: 'drought_stress' },
    // Fertilizer / input cost spike — fertilizer price surge, input cost squeeze.
    { re: /fertilizer (cost|price) (spike|surge|soar|jump)|(nitrogen|potash|phosphate|urea) (price|cost) (surge|spike|soar)|input (cost|price) (spike|surge|squeeze) (farm|crop|ag)|(ntr|mos|cf) (price )?(surge|spike)|crop input (cost|price) (surge|spike)|seed (cost|price) (surge|spike)/i, weight: 0.15, tag: 'input_cost_spike' },
    // Food-price surge — food inflation, grain price spike, food cost crisis.
    { re: /food (price|cost) (surge|spike|soar|crisis|inflation)|grain (price|cost) (surge|spike|soar)|food inflation (surge|spike|accelerat)|(corn|soy(bean)?|wheat) (futures )?(price )?(spike|surge|soar)|staple (food|crop) (price|cost) (surge|spike)|food (security|supply) (crisis|stress)/i, weight: 0.14, tag: 'food_price_surge' },
    // Livestock disease — animal-protein outbreak, herd cull, avian/swine flu.
    { re: /livestock (disease|outbreak|cull|loss)|(avian|bird) (flu|influenza) (outbreak|spread)|(swine|hog|pig) (flu|fever|disease) (outbreak|spread)|(african swine fever|asf|h5n1|hpai)|herd (cull|loss|depopulat)|(cattle|poultry|hog) (disease|outbreak|cull)|(tsn|tyson) (recall|outbreak)/i, weight: 0.16, tag: 'livestock_disease' },
    // Export ban — grain/food export restriction, trade barrier on crops.
    { re: /(grain|food|crop|wheat|corn|soy(bean)?|rice) export (ban|restrict|curb|halt)|export (ban|restrict|curb) (grain|food|crop|agricultur)|agricultural export (ban|control|restrict)|food export (ban|restrict|curb)|grain (blockade|embargo)|(black sea|ukraine) grain (deal collapse|halt)/i, weight: 0.13, tag: 'export_ban' },
    // Commodity-price crash — crop price collapse, farm-gate price plunge, glut.
    { re: /(corn|soy(bean)?|wheat|grain|crop) (price|futures) (crash|collapse|plunge|plummet)|commodity (crop )?(price )?(crash|collapse|plunge)|farm(-| )?gate price (collapse|plunge|crash)|(cbot|grain) (price )?(crash|collapse|rout)|crop glut (price|crash)|oversupply (price collapse|glut) (grain|crop)/i, weight: 0.13, tag: 'commodity_price_crash' },
    // Input-supply disruption — seed/fertilizer/feed supply gap, sourcing halt.
    { re: /(seed|fertilizer|feed|crop input) (supply )?(disrupt|shortage|gap|stockout)|input(-| )?supply (disruption|gap|shortage) (farm|crop|ag)|(nitrogen|potash|phosphate) (supply )?(disrupt|shortage|gap)|feed (shortage|supply (disrupt|gap))|agricultural (input|supply) (disrupt|shortage)|sourcing (disrupt|gap) (seed|fertilizer|feed)/i, weight: 0.13, tag: 'input_supply_disruption' },
    // Soil degradation — soil erosion, fertility loss, salinization, depletion.
    { re: /soil (degradation|erosion|depletion|exhaust|salin)|(topsoil|farmland) (loss|erosion|degrad)|soil (fertility|health) (loss|decline|degrad)|(salinization|salinity) (soil|farmland)|land degradation (farm|crop|agricultur)|nutrient depletion (soil|farmland)/i, weight: 0.12, tag: 'soil_degradation' },
    // Agricultural water stress — irrigation shortfall, aquifer drawdown, water cut.
    { re: /(agricultural |irrigation )?water (stress|shortage|cut|curtail) (crop|farm|irrigat)|irrigation (shortfall|cut|curtail|fail)|aquifer (drawdown|depletion|decline) (farm|irrigat)|(ogallala|groundwater) (depletion|drawdown) (farm|irrigat)|water allocation (cut|reduc) (farm|agricultur)|reservoir (low|drain) (irrigat|farm)/i, weight: 0.12, tag: 'agricultural_water_stress' }
  ];
  var AGRICULTURE_STABILIZING = [
    // Good yield / harvest completion — strong harvest, record yield, WASDE raise.
    { re: /(good|strong|record|bumper) (yield|harvest|crop)|harvest (complet|finish|done|wrap)|yield (gain|rise|record|beat|strong)|(corn|soy(bean)?|wheat) (yield )?(record|strong|beat)|wasde (raise|upgrade|increase) (yield|production)|(robust|favorable) (crop|harvest|growing condition)|crop (rating|condition) (improv|good|excellent)/i, weight: 0.16, tag: 'good_yield_harvest' },
    // Commodity-price recovery — crop price rebound, farm-gate price firming.
    { re: /(corn|soy(bean)?|wheat|grain|crop) (price|futures) (recover|rebound|rise|firm|rally)|commodity (crop )?(price )?(recover|rebound|firm)|farm(-| )?gate price (recover|rise|firm|improv)|(cbot|grain) (price )?(rally|recover|rebound)|crop (price )?(rally|firm|support)|agricultural (price|commodity) (recover|firm|stabiliz)/i, weight: 0.15, tag: 'commodity_price_recovery' },
    // Government support program — farm subsidy, crop insurance, USDA support.
    { re: /(farm|crop|agricultural) (subsid|support program|aid|relief)|crop insurance (payout|expand|support)|usda (support|payment|program|aid)|(government|federal) (farm|agricultur) (support|aid|relief)|farm bill (support|fund|pass)|(arc|plc|price loss coverage) (payment|support)|agricultural (support|relief) (program|package)/i, weight: 0.14, tag: 'government_support_program' },
    // Input-cost normalization — fertilizer price easing, input cost falling.
    { re: /fertilizer (cost|price) (eas|decline|fall|normaliz|drop|soften)|(nitrogen|potash|phosphate|urea) (price|cost) (eas|decline|fall|drop)|input (cost|price) (eas|decline|fall|normaliz) (farm|crop|ag)|(ntr|mos|cf) (price )?(eas|decline|fall)|crop input (cost|price) (eas|normaliz|decline)|seed (cost|price) (eas|decline|normaliz)/i, weight: 0.14, tag: 'input_cost_normalization' },
    // Export-market opening — new trade access, grain deal, export demand rise.
    { re: /(grain|food|crop|wheat|corn|soy(bean)?) export (open|access|deal|surge|demand)|export (market|demand) (open|expand|rise) (grain|crop|agricultur)|agricultural export (open|expand|growth|access)|(black sea|ukraine) grain (deal|corridor) (reopen|extend|secure)|food export (open|expand|access)|new (export|trade) (access|market) (grain|crop)/i, weight: 0.13, tag: 'export_market_opening' },
    // Soil-health gain — regenerative ag, cover crop, soil restoration, fertility.
    { re: /soil (health|fertility) (gain|improv|restor|rebuild)|regenerative (ag|agricultur|farming) (adopt|gain)|cover crop (adopt|expand|gain)|(no(-| )?till|conservation tillage) (adopt|expand)|soil (carbon|organic matter) (gain|rise|build)|land (restoration|regenerat) (farm|crop)|topsoil (rebuild|restor|gain)/i, weight: 0.14, tag: 'soil_health_gain' },
    // Irrigation investment — irrigation expansion, water infrastructure, drip systems.
    { re: /irrigation (investment|expansion|upgrade|build(-| )?out|moderniz)|(drip|precision|micro) irrigation (deploy|adopt|expand)|water (infrastructure|storage) (invest|build|expand) (farm|irrigat)|(reservoir|canal) (invest|build|expand) (irrigat|farm)|irrigation (efficiency|capacity) (gain|expand)|agricultural water (invest|infrastructure|storage)/i, weight: 0.13, tag: 'irrigation_investment' },
    // Crop-diversity expansion — diversification, rotation, new crop, resilient varieties.
    { re: /crop (diversi|rotation) (expand|adopt|gain|increase)|(crop |field )?diversif(y|ication) (farm|agricultur|crop)|new (crop|variety) (adopt|introduc|plant)|(drought|disease)(-| )?resistant (variety|seed|crop) (adopt|deploy)|resilient (crop|variety) (adopt|expand)|(ctva|corteva) (trait|seed) (launch|adopt|gain)|planting diversif/i, weight: 0.13, tag: 'crop_diversity_expansion' }
  ];

  // ─── Governance-native semantics (INSTITUTIONS & INDICATORS) ──────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE / INDUSTRY above): the
  // governance domain has its OWN failure/recovery vocabulary. Where energy
  // reads crude_above_90 / grid_stress / chokepoint, infrastructure reads
  // grid_reliability / deferred_maintenance, culture reads the attention
  // economy, finance reads liquidity/credit, economy reads the business cycle,
  // technology reads the compute stack, defense reads kinetic military power,
  // intelligence reads the collection cycle, trade reads exports/tariffs/ports,
  // and industry reads factory output, GOVERNANCE reads the machinery of
  // collective rule: government & public administration, public policy &
  // rulemaking, regulation & oversight, elections & democratic institutions,
  // public finance & budgets, rule of law & institutional integrity, public
  // services delivery, and political stability & legitimacy. Destabilizing =
  // institutional erosion, policy gridlock / legislative stalemate, legitimacy
  // crisis / trust erosion, regulatory capture / oversight breakdown,
  // fiscal-governance stress, electoral instability, corruption surge,
  // separation-of-powers tension, institutional fragmentation, and inconsistent
  // execution. Stabilizing = institutional strengthening, policy passage /
  // bipartisan resolution, legitimacy / trust restoration, oversight &
  // accountability restored, fiscal-governance discipline, electoral
  // stabilization / peaceful transfer, anti-corruption gains, and service-
  // delivery recovery.
  //
  // Governance binds mostly to INSTITUTIONS & INDICATORS, not single companies.
  // Where entities are needed, anchors are REAL govtech / public-sector
  // identifiers (TYL Tyler Technologies, MMS Maximus, BAH Booz Allen Hamilton,
  // LDOS Leidos, ACN Accenture Federal Services, GDIT General Dynamics IT) and
  // policy/governance indices (World Bank WGI, V-Dem, OECD, GAO, CBO, Federal
  // Register doc-count) — NEVER oil/gas/grid content, and NEVER fabricated.
  // Governance maps constitutional_stress / legislative_stalemate / policy_conflict
  // to governance-weighted pathways (separation_of_powers_tension /
  // institutional_fragmentation_cost / policy_gridlock_pressure) rather than a
  // single opaque stress scalar — the mirror of energy's crude_parity /
  // grid_reliability_cost / transmission_congestion pathways. Governance COUPLES
  // to economy via public finance and to law via rule-of-law signals, but its
  // IDENTITY stays institutions/policy/elections/legitimacy, kept DISTINCT from
  // economy (the MACRO business cycle), finance (capital markets), law
  // (judicial / legal-system adjudication), and intelligence (collection).
  // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
  //
  // STRUCTURAL-SIGNAL overrides (energy parity — energy uses crude-price
  // thresholds and grid-reserve-margin floors to distinguish a structural
  // policy-outcome signal from noisy news volume): a World Bank WGI decline,
  // a Federal Register doc-count surge, and corruption-detection indicators are
  // treated as STRUCTURAL institutional signals (institutional_erosion /
  // policy_gridlock / accountability_failure), weighted above generic news-tone
  // noise — these patterns carry the heavier weights below. A governance stress
  // normalization factor (factor 0.55, ceiling 0.80, tone-dampened for the
  // negative-tone bias of governance news) is applied via the shared score clamp.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, governance content.
  var GOVERNANCE_DESTABILIZING = [
    // Institutional erosion / separation-of-powers tension — constitutional stress,
    // cross-branch incoherence, WGI decline (STRUCTURAL: rule-of-law / institutional integrity).
    { re: /institutional (erosion|decay|breakdown|backslid)|constitutional (stress|crisis|breach)|separation of powers (tension|breach|erod)|cross(-| )?branch (incoherence|conflict|standoff)|checks and balances (erod|breakdown)|(world bank )?wgi (decline|deteriorat|drop)|v-?dem (decline|backslid)|democratic backslid/i, weight: 0.18, tag: 'institutional_erosion' },
    // Legitimacy crisis / trust erosion / confidence collapse — public trust falling.
    { re: /legitimacy (crisis|deficit|collapse|erod)|trust (erosion|collapse|crisis) (institution|government|public)|public (trust|confidence) (collapse|erod|plunge|decline)|confidence collapse|governance credibility (shock|crisis|loss)|approval (collapse|plunge)|mandate (loss|crisis)/i, weight: 0.17, tag: 'legitimacy_crisis' },
    // Policy gridlock / legislative stalemate — Federal Register stall, contradictory directives
    // (STRUCTURAL: Federal Register doc-count surge / legislative-output collapse).
    { re: /legislative (stalemate|gridlock|deadlock|paralysis)|policy (gridlock|paralysis|stalemate)|(government|budget) (shutdown|impasse|standoff)|contradictory (directive|policy|mandate)|federal register (surge|backlog|doc-?count (surge|spike))|filibuster (block|deadlock)|debt ceiling (standoff|impasse)|legislative (output|productivity) (collapse|stall)/i, weight: 0.16, tag: 'policy_gridlock' },
    // Policy conflict / inconsistent execution / fragmented agency — incoherent implementation.
    { re: /policy conflict|inconsistent (execution|implementation|enforcement)|fragmented (agency|implementation|authority)|agency (fragment|incoherence|turf war)|contradictory (rulemaking|regulation)|regulatory (whipsaw|reversal|incoherence)|implementation (failure|breakdown) (policy|program)/i, weight: 0.14, tag: 'policy_conflict' },
    // Regulatory capture / oversight breakdown / accountability failure
    // (STRUCTURAL: corruption-detection indicators → accountability failure).
    { re: /regulatory capture|oversight (breakdown|failure|gap|lapse)|accountability (failure|breakdown|gap)|corruption (surge|scandal|detected|probe|indict)|(gao|inspector general|ig) (finding|report) (critical|adverse|fail)|watchdog (warn|flag|fail)|graft|bribery (scheme|scandal)|self(-| )?deal/i, weight: 0.17, tag: 'regulatory_capture' },
    // Fiscal-governance stress — budget/CBO deficit blowout, unfunded mandate, fiscal mismanagement.
    { re: /fiscal (governance )?(stress|crisis|mismanagement)|budget (deficit|crisis) (blow|surge|spiral)|cbo (warn|project) (deficit|debt) (surge|unsustainable)|unfunded (mandate|liabilit)|public (debt|finance) (unsustainable|spiral|stress)|deficit (blowout|spiral)|fiscal (cliff|unsustainab)/i, weight: 0.14, tag: 'fiscal_governance_stress' },
    // Electoral instability / political instability — contested results, leadership instability.
    { re: /electoral (instability|crisis|dispute|fraud (alleg|claim))|election (contest|dispute|overturn|irregularit)|leadership (instability|vacuum|crisis|turnover)|political (instability|turmoil|crisis)|contested (result|transfer|election)|coup|no(-| )?confidence (vote|motion)|government collapse/i, weight: 0.15, tag: 'electoral_instability' }
  ];
  var GOVERNANCE_STABILIZING = [
    // Institutional strengthening — separation-of-powers restored, WGI / V-Dem improvement.
    { re: /institutional (strengthen|reinforc|reform|restor|resilien)|(world bank )?wgi (improv|rise|gain)|v-?dem (improv|rise|gain)|checks and balances (restor|reinforc|strengthen)|separation of powers (restor|reaffirm|reinforc)|rule of law (strengthen|restor|improv)|institutional integrity (restor|strengthen)|democratic (consolidat|resilien)/i, weight: 0.17, tag: 'institutional_strengthening' },
    // Legitimacy / trust restoration — public confidence recovering, mandate secured.
    { re: /legitimacy (restor|gain|secured|reinforc)|(public )?(trust|confidence) (restor|recover|rebuild|rise) (institution|government|public)|public confidence (recover|rise|rebound)|approval (recover|rise|rebound)|mandate (secured|renew|strengthen)|credibility (restor|rebuild|gain) (governance|institution)/i, weight: 0.15, tag: 'legitimacy_restoration' },
    // Policy passage / bipartisan resolution — legislative output, Federal Register normalization.
    { re: /(policy|legislation|bill) (passage|enact|sign|ratif)|bipartisan (deal|agreement|resolution|compromise)|gridlock (break|resolv|ease)|(budget|appropriation) (pass|deal|agreement)|legislative (output|productivity) (rise|recover|robust)|federal register (normaliz|stabiliz)|(continuing resolution|deal) (reach|pass)|coherent (rulemaking|policy)/i, weight: 0.15, tag: 'policy_passage' },
    // Oversight & accountability restored — GAO/IG remediation, anti-corruption gains, transparency.
    { re: /oversight (restor|strengthen|reinstat|reinforc)|accountability (restor|strengthen|reinforc)|(gao|inspector general|ig) (recommendation )?(implement|remediat|close|resolv)|anti(-| )?corruption (gain|win|reform|crackdown)|transparency (gain|reform|increase)|watchdog (empower|strengthen)|ethics (reform|strengthen)|(corruption|graft) (prosecut|convict|root out)/i, weight: 0.14, tag: 'accountability_restored' },
    // Fiscal-governance discipline — CBO/budget consolidation, balanced budget, debt path improved.
    { re: /fiscal (discipline|consolidation|reform|sustainab)|budget (balance|surplus|consolidat|reform)|cbo (project|score) (deficit|debt) (decline|improv|sustainab)|deficit (reduc|narrow|decline)|debt (path|trajectory) (improv|stabiliz|sustainab)|fiscal (responsibilit|prudence)|public finance (stabiliz|strengthen)/i, weight: 0.14, tag: 'fiscal_governance_discipline' },
    // Electoral stabilization / peaceful transfer / service-delivery recovery — orderly governance.
    { re: /electoral (stability|integrity|stabiliz)|peaceful (transfer|transition) (of power)?|orderly (transition|transfer|succession)|election(s)? (free and fair|certified|smooth|orderly)|political (stability|stabiliz|continuity)|(public )?service(s)? (deliver|recover|improv|restor)|(tyl|tyler technologies|mms|maximus|gdit|leidos|accenture federal) (deploy|modern|deliver) (service|system)|govtech (deploy|moderniz)/i, weight: 0.13, tag: 'electoral_stabilization' }
  ];

  // ─── Communication-native semantics (TELECOM / NETWORKS / MEDIA CHANNELS) ──
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE / INDUSTRY / AGRICULTURE /
  // GOVERNANCE above): the communication domain has its OWN failure/recovery
  // vocabulary. Where energy reads crude_above_90 / grid_stress / chokepoint,
  // infrastructure reads grid_reliability / deferred_maintenance, culture reads
  // the attention economy, finance reads liquidity/credit, economy reads the
  // business cycle, technology reads the compute stack, defense reads kinetic
  // military power, intelligence reads the collection cycle, trade reads
  // exports/tariffs/ports, industry reads factory output, agriculture reads
  // crops/food, and governance reads institutions, COMMUNICATION reads the
  // telecommunications & information-flow stack: telecom & networks (carriers,
  // mobile, broadband), internet infrastructure (towers / fiber / spectrum),
  // media & broadcasting CHANNELS, journalism & news flow, information
  // dissemination, social-media platforms as DISTRIBUTION, and public-discourse
  // infrastructure. Destabilizing = network outage / internet shutdown,
  // spectrum crunch / bandwidth strain, connectivity gap, censorship event,
  // media-trust collapse, misinformation surge, platform concentration,
  // broadcast failure, signal degradation, and regulatory overreach.
  // Stabilizing = network resilience recovery, spectrum allocation recovery,
  // connectivity restoration, media-trust rebuilding, misinformation
  // counter-narrative infrastructure, platform interoperability, and broadcast
  // capacity recovery.
  //
  // Anchors are REAL telecom/network tickers (VZ Verizon, T AT&T, TMUS T-Mobile,
  // CMCSA Comcast, CHTR Charter, CSCO Cisco, ANET Arista, AMT American Tower,
  // CCI Crown Castle, SBAC SBA Communications) and media/journalism tickers
  // (NWSA News Corp, NYT New York Times, META Meta, GOOGL Alphabet) — NEVER
  // oil/gas/grid content as the domain's OWN identity. Communication COUPLES to
  // technology via chips/software, to intelligence via signals collection, and
  // to culture via content riding the channels, but its IDENTITY stays the
  // CHANNELS / networks / information-flow (network uptime/downtime, spectrum
  // availability/crunch, broadcast capacity/failure, information clarity/
  // degradation, audience reach/loss, message integrity/corruption), kept
  // DISTINCT from culture (content/movements/scenes), technology (chips/software
  // is a coupling), and intelligence (signals collection is a coupling).
  // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, communication content.
  var COMMUNICATION_DESTABILIZING = [
    // Network outage / internet shutdown — carrier outage, 911 down, blackout.
    { re: /network (outage|down|failure|blackout)|internet (shutdown|outage|blackout|kill ?switch)|(carrier|telecom|broadband|cellular|mobile) (outage|down|failure)|911 (outage|down|fail)|fiber cut|(vz|t|tmus|cmcsa|chtr) (outage|down|disruption)|service (blackout|outage) (network|telecom)/i, weight: 0.18, tag: 'network_outage' },
    // Spectrum crunch / bandwidth strain — capacity exhaustion, congestion.
    { re: /spectrum (crunch|shortage|exhaust|scarcity|congest)|bandwidth (strain|crunch|exhaust|saturat)|(network|backhaul) (congestion|saturat|overload)|capacity (exhaust|crunch) (spectrum|network|bandwidth)|airwave (shortage|crunch)|throughput (collapse|degrad) (network|bandwidth)/i, weight: 0.16, tag: 'spectrum_crunch' },
    // Connectivity gap — digital divide, coverage hole, broadband desert.
    { re: /connectivity (gap|loss|desert)|digital divide|coverage (gap|hole|dead ?zone)|broadband (desert|gap|unserved)|unconnected|no(-| )?service (gap|area)|(rural|underserved) (connectivity|broadband) (gap|loss)/i, weight: 0.13, tag: 'connectivity_gap' },
    // Censorship event — content blocking, throttling, platform takedown.
    { re: /censorship|content (block|takedown|removal mandate)|(internet|web|site) (block|ban|filter)|throttl(e|ing) (content|traffic|platform)|deplatform (state|government)|(government|state) (block|shutdown) (platform|media|site)|press (crackdown|restriction)/i, weight: 0.15, tag: 'censorship_event' },
    // Media-trust collapse — credibility erosion, public distrust of news.
    { re: /media (trust|credibility) (collapse|erod|plunge|crisis)|(public )?(trust|confidence) (in (the )?(media|press|news)) (collapse|erod|fall)|news (credibility|trust) (collapse|erod)|distrust (media|press|news) (surge|spike)|(nyt|nwsa) (credibility|trust) (loss|erod)/i, weight: 0.16, tag: 'media_trust_collapse' },
    // Misinformation surge — disinformation flood, fake-news spread, deepfakes.
    { re: /misinformation (surge|flood|spread|wave)|disinformation (surge|flood|campaign|spread)|fake news (surge|spread|wave)|deepfake (surge|flood|spread)|(false|misleading) (narrative|content) (surge|viral|spread)|information (warfare|pollution) (surge|escalat)/i, weight: 0.15, tag: 'misinformation_surge' },
    // Platform concentration — distribution monopoly, gatekeeper choke, lock-in.
    { re: /platform concentration|(distribution|media) (monopoly|consolidat)|(meta|googl|google) (dominance|gatekeep|monopol)|gatekeeper (choke|control) (platform|distribution)|(market|platform) (concentration|consolidation) (media|distribution|telecom)|single(-| )?platform (dependence|lock(-| )?in)/i, weight: 0.13, tag: 'platform_concentration' },
    // Broadcast failure — transmitter down, broadcast outage, signal loss.
    { re: /broadcast (failure|outage|down|loss)|transmitter (down|fail|outage)|(tv|radio|satellite) (broadcast )?(outage|down|fail)|(broadcast|uplink|downlink) signal (loss|down|fail)|station (off ?air|down|outage)|over(-| )?the(-| )?air (outage|loss)/i, weight: 0.14, tag: 'broadcast_failure' },
    // Signal degradation — packet loss, latency surge, jitter, interference.
    { re: /signal (degrad|loss|interference|jam)|packet loss (surge|spike)|latency (surge|spike|blow)|jitter (surge|spike)|(network|connection) (degrad|deteriorat)|interference (surge|spike) (signal|network)|message (integrity )?(corrupt|degrad)/i, weight: 0.12, tag: 'signal_degradation' },
    // Regulatory overreach — net-neutrality rollback, surveillance mandate, data mandate.
    { re: /regulatory overreach (telecom|media|communication)|net(-| )?neutrality (rollback|repeal|threat)|(surveillance|data(-| )?retention) mandate|(communication|telecom|media) (regulatory )?(crackdown|overreach|capture)|forced (data|content) (handover|localization)|spectrum (clawback|reallocation mandate)/i, weight: 0.13, tag: 'regulatory_overreach' }
  ];
  var COMMUNICATION_STABILIZING = [
    // Network resilience recovery — outage restored, redundancy, hardening.
    { re: /network (resilien|recover|restor|hardening|redundancy)|(carrier|telecom|broadband|cellular) (service )?(restor|recover|back online)|outage (restor|resolv|recover)|(redundan|failover) (deploy|build)|network (uptime|reliability) (gain|improv|restor)|(vz|t|tmus|cmcsa|chtr) (service (restor|recover))/i, weight: 0.16, tag: 'network_resilience_recovery' },
    // Spectrum allocation recovery — spectrum freed, auction, capacity added.
    { re: /spectrum (allocation|auction|reallocat|freed|grant)|(spectrum|airwave) (capacity )?(add|expand|release)|new spectrum (auction|allocat|license)|bandwidth (capacity )?(add|expand|restor)|(5g|6g) spectrum (allocat|deploy|expand)|spectrum (crunch )?(eas|resolv)/i, weight: 0.15, tag: 'spectrum_allocation_recovery' },
    // Connectivity restoration — broadband build-out, coverage expansion, access.
    { re: /connectivity (restor|expand|recover)|broadband (build(-| )?out|expansion|deploy|access)|coverage (expand|restor|gain)|(fiber|5g|broadband) (deploy|roll ?out|expand)|digital (inclusion|access) (gain|expand)|(rural|underserved) (broadband|connectivity) (gain|deploy|expand)/i, weight: 0.15, tag: 'connectivity_restoration' },
    // Media-trust rebuilding — credibility restored, fact-checking, transparency.
    { re: /media (trust|credibility) (rebuild|restor|recover|gain)|(public )?(trust|confidence) (in (the )?(media|press|news)) (rebuild|restor|recover|rise)|fact(-| )?check(ing)? (expand|deploy|gain)|(news|press) (transparency|standards) (gain|strengthen)|(nyt|nwsa) (credibility|trust) (gain|rebuild)/i, weight: 0.14, tag: 'media_trust_rebuilding' },
    // Misinformation counter-narrative infrastructure — debunk, literacy, provenance.
    { re: /(misinformation|disinformation) (counter|debunk|mitigat|defense)|counter(-| )?narrative (infrastructure|deploy|build)|(media|information|digital) literacy (gain|deploy|expand)|content (provenance|authenticat) (deploy|adopt)|(deepfake|fake news) (detect|counter|debunk)|prebunk(ing)? (deploy|gain)/i, weight: 0.14, tag: 'misinformation_counter_infrastructure' },
    // Platform interoperability — open standards, federation, anti-lock-in.
    { re: /platform interoperab(le|ility)|(open|federat) (standard|protocol|network) (adopt|deploy|gain)|(media|distribution|messaging) interoperab|anti(-| )?lock(-| )?in (gain|standard)|(decentraliz|federat) (platform|network) (adopt|gain)|cross(-| )?platform (standard|interop) (adopt|deploy)/i, weight: 0.14, tag: 'platform_interoperability' },
    // Broadcast capacity recovery — transmitter restored, broadcast expansion, uplink.
    { re: /broadcast (capacity )?(recover|restor|expand|online)|transmitter (restor|back online|deploy)|(tv|radio|satellite) (broadcast )?(restor|recover|expand|online)|(broadcast|uplink|downlink) (capacity|signal) (restor|gain|expand)|station (back (on ?air)|restor)|over(-| )?the(-| )?air (restor|recover)/i, weight: 0.13, tag: 'broadcast_capacity_recovery' }
  ];

  // ─── Population / demographic-native semantics ────────────────────────────
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE / INDUSTRY / AGRICULTURE /
  // GOVERNANCE / COMMUNICATION above): the population domain has its OWN failure/
  // recovery vocabulary. Where energy reads crude_above_90 / grid_stress /
  // chokepoint, infrastructure reads grid_reliability / deferred_maintenance,
  // culture reads the attention economy, finance reads liquidity/credit, economy
  // reads the business cycle, technology reads the compute stack, defense reads
  // kinetic military power, intelligence reads the collection cycle, trade reads
  // tariffs/ports, and governance reads institutions, POPULATION reads
  // demographics & human-population dynamics: demographics & population
  // structure, migration & immigration, urbanization & settlement, fertility &
  // mortality, aging & generational shifts, labor force & human-capital SUPPLY,
  // and household formation & housing demand. Destabilizing = demographic
  // collapse (birth-rate / fertility decline, family-formation stall), migration
  // surge (refugee inflow, internal displacement, climate migration), aging
  // crisis (median-age rise, old-age-dependency spike, working-age decline),
  // labor-supply shortage (participation drop, prime-age employment loss),
  // urbanization strain (slum growth, housing-unaffordability spike), and
  // depopulation (rural exodus, regional out-migration, population stagnation).
  // Stabilizing = demographic recovery (birth-rate / fertility stabilization,
  // family-formation uptick), migration containment (resettlement, displacement
  // recovery, absorption capacity), aging support (age-friendly housing,
  // long-term-care capacity, intergenerational-transfer strengthening),
  // labor-force growth (prime-age / participation recovery, workforce-age
  // growth), urbanization resilience (affordable-housing development, slum
  // remediation, urban-infrastructure investment), and re-population (return /
  // regional in-migration, population stabilization).
  //
  // Anchors are REAL demographic SOURCES (US Census Bureau / ACS migration
  // tabulations, UN World Population Prospects, Pew Research Center, BLS labor-
  // force data) and demographic-exposed PROXIES (WELL / VTR senior-living &
  // senior-housing REITs for aging; LEN / PHM / DHI housing-starts & mortgage-
  // origination for household formation) — NEVER fabricated, NEVER oil/gas/grid
  // content. Population BINDS MOSTLY TO INDICATORS, not single companies, and
  // COUPLES to economy via the labor market, medicine via mortality/health,
  // education via enrollment, and governance via policy — but its IDENTITY stays
  // demographics & population dynamics, kept DISTINCT from economy (the MACRO
  // aggregate / business cycle), medicine (mortality/health is a coupling),
  // education (enrollment is a coupling), and governance (structure is a
  // coupling). ADVISORY ONLY — wholly separate from the validated P3 distress
  // kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, population content.
  var POPULATION_DESTABILIZING = [
    // Demographic collapse — birth-rate / fertility decline, family-formation stall.
    { re: /demographic (collapse|decline|winter|crisis)|birth(-| )?rate (decline|drop|fall|plunge|collapse)|fertility(-| )?rate (decline|drop|fall|below replacement|sub(-| )?replacement)|family(-| )?formation (stall|decline|delay)|baby bust|total fertility rate (decline|drop)|(un world population prospects|census).{0,30}(decline|drop)/i, weight: 0.18, tag: 'demographic_collapse' },
    // Migration surge — refugee inflow, internal displacement, climate migration spike.
    { re: /(refugee|migrant) (inflow|surge|wave|crisis|influx)|internal(ly)? displace(d|ment)|climate (migration|displace) (spike|surge|wave)|(mass|forced) migration|displacement (surge|spike|crisis)|asylum (surge|backlog)|border (surge|crossing surge)|(acs|census).{0,30}migration (surge|inflow)/i, weight: 0.16, tag: 'migration_surge' },
    // Aging crisis — median-age rise, old-age-dependency spike, working-age decline.
    { re: /(median age|population) (aging|ageing|rise|graying)|old(-| )?age dependency (ratio )?(rise|spike|surge)|dependency ratio (rise|spike|worsen)|working(-| )?age (population )?(decline|drop|shrink|contract)|aging (crisis|society|population)|super(-| )?aged|(well|vtr).{0,30}(occupancy decline|demand surge)|elder(ly)? (boom|wave)/i, weight: 0.16, tag: 'aging_crisis' },
    // Labor-supply shortage — participation drop, prime-age employment loss.
    { re: /labor(-| )?force participation (drop|decline|fall|low)|participation rate (drop|decline|fall)|prime(-| )?age (employment|worker) (loss|decline|drop)|(labor|worker|workforce) (shortage|shrink|supply (gap|shortfall))|human(-| )?capital (supply )?(shortage|gap)|(bls).{0,30}participation (drop|decline)/i, weight: 0.15, tag: 'labor_supply_shortage' },
    // Urbanization strain — megacity slum growth, housing-unaffordability spike.
    { re: /(megacity|urban) slum (growth|expansion)|slum(-| )?population (growth|surge)|housing(-| )?(un)?affordab(le|ility) (spike|crisis|worsen)|housing (cost|price) (unaffordab|crisis|surge)|urbanization (strain|pressure|overload)|(overcrowd|informal settlement) (growth|surge)|housing (shortage|deficit) (urban|spike)/i, weight: 0.13, tag: 'urbanization_strain' },
    // Depopulation — rural exodus, regional out-migration, population stagnation.
    { re: /depopulat(e|ion)|rural (exodus|depopulat|decline|flight)|regional out(-| )?migration|population (stagnat|shrink|decline|loss)|net out(-| )?migration|(town|region|county) (shrink|empty|hollow)|brain drain|(census|acs).{0,30}(out(-| )?migration|population loss)/i, weight: 0.14, tag: 'depopulation' }
  ];
  var POPULATION_STABILIZING = [
    // Demographic recovery — birth-rate / fertility stabilization, family-formation uptick.
    { re: /demographic (recovery|stabiliz|rebound)|birth(-| )?rate (stabiliz|recover|uptick|rise|rebound)|fertility(-| )?rate (recover|stabiliz|rise|rebound|uptick)|family(-| )?formation (uptick|rise|recover|rebound)|baby (boom|bump)|total fertility rate (rise|recover|stabiliz)|(pew|census).{0,30}(birth|fertility) (rise|recover)/i, weight: 0.16, tag: 'demographic_recovery' },
    // Migration containment — resettlement rate, displacement recovery, absorption capacity.
    { re: /(refugee|migrant) resettlement (rate|gain|success)|internal(-| )?displacement (recover|return|resolv)|climate(-| )?migration (absorption|capacity)|(migration|displacement) (absorption|integration|containment)|(asylum|refugee) (integration|absorption) (capacity|gain)|orderly (migration|resettlement)|return (migration|migrant) (rate|gain)/i, weight: 0.15, tag: 'migration_containment' },
    // Aging support — age-friendly housing, long-term-care capacity, intergenerational transfer.
    { re: /age(-| )?friendly housing (build|expand|deploy)|long(-| )?term(-| )?care (capacity )?(expand|build|gain)|senior(-| )?(housing|living) (capacity|build|expand|occupancy gain)|intergenerational(-| )?transfer (strengthen|system|gain)|(well|vtr).{0,30}(occupancy gain|capacity expand|build(-| )?out)|elder(-| )?care (capacity|build) (expand|gain)/i, weight: 0.15, tag: 'aging_support' },
    // Labor-force growth — prime-age / participation recovery, workforce-age growth.
    { re: /labor(-| )?force participation (recover|rise|gain|uptick)|participation rate (rise|recover|gain)|prime(-| )?age (employment|worker) (uptick|rise|gain|recover)|workforce(-| )?age (population )?(growth|rise|expand)|(labor|worker|workforce) (supply )?(growth|expand|recover)|(bls).{0,30}participation (rise|recover)/i, weight: 0.14, tag: 'labor_force_growth' },
    // Urbanization resilience — affordable-housing development, slum remediation, urban investment.
    { re: /affordable(-| )?housing (development|build|deploy) (rate|gain|surge)|slum (remediation|upgrade|clearance)|urban(-| )?infrastructure (investment|build|upgrade)|housing (supply|development|starts) (rise|expand|surge)|(len|phm|dhi).{0,30}(housing(-| )?start|origination) (rise|surge|gain)|informal settlement (upgrade|remediat)/i, weight: 0.14, tag: 'urbanization_resilience' },
    // Re-population — return / regional in-migration, population stabilization.
    { re: /re(-| )?populat(e|ion)|return migration (rate|rise|gain)|regional in(-| )?migration|population (stabiliz|recover|rebound|growth)|net in(-| )?migration|(town|region|county) (revival|repopulat|growth)|reverse (brain drain|migration)|(census|acs).{0,30}(in(-| )?migration|population (gain|growth))/i, weight: 0.14, tag: 'repopulation' }
  ];

  // ─── Research / science-native semantics (KNOWLEDGE PRODUCTION & DISCOVERY) ─
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE / INDUSTRY / AGRICULTURE /
  // GOVERNANCE / COMMUNICATION / POPULATION above): the science domain (runtime/
  // snapshot key 'research' — see domain-identity.js: science ↔ research) has its
  // OWN failure/recovery vocabulary. Where energy reads crude_above_90 /
  // grid_stress / chokepoint, infrastructure reads grid_reliability /
  // deferred_maintenance, culture reads the attention economy, finance reads
  // liquidity/credit, economy reads the business cycle, technology reads the
  // compute stack, defense reads kinetic military power, intelligence reads the
  // collection cycle, trade reads exports/tariffs/ports, industry reads factory
  // output, agriculture reads crops/food, governance reads institutions,
  // communication reads channels, and population reads demographics, RESEARCH
  // reads knowledge production & discovery: scientific research & discovery,
  // basic & applied research, R&D pipelines, academic & lab science, peer review
  // & publication, research funding & grants, scientific instruments & methods,
  // and the innovation pipeline. Destabilizing = replication / reproducibility
  // crisis, funding cut / grant shortfall, research fraud / methodology-rigor
  // erosion, brain drain (researcher / visa / policy flight), discovery
  // stagnation, lab-capacity strain, peer-review breakdown, publication-volume
  // collapse, and citation-trajectory decline. Stabilizing = reproducibility-
  // standard adoption, open-science-platform emergence, AI-accelerated discovery,
  // interdisciplinary-collaboration surge, grant-success-rate recovery, STEM-PhD
  // retention / brain-drain reversal, publication-velocity rebound, citation-
  // impact recovery, and methodology-rigor restoration.
  //
  // Anchors are REAL research-sector tickers — scientific instruments, lab
  // equipment, reagents & contract research: TMO Thermo Fisher, DHR Danaher,
  // A Agilent, MTD Mettler-Toledo, WAT Waters, ILMN Illumina, BIO Bio-Rad,
  // RVTY Revvity, BRKR Bruker, IQV IQVIA, ICLR ICON — and research AUTHORITIES /
  // INDICATOR SOURCES (NSF science-and-engineering indicators, NIH grant-success-
  // rate, arXiv / Nature publication & retraction trends, OpenAlex citation
  // indices, NASA / CDC STEM-pipeline metrics) — NEVER oil/gas/grid content as
  // the domain's OWN identity, NEVER fabricated. Research COUPLES to technology
  // via R&D feeding applied product development, to medicine via clinical/
  // biomedical research, and to education via the academic/PhD pipeline, but its
  // IDENTITY stays knowledge production / discovery / peer review / grants / the
  // R&D pipeline, kept DISTINCT from technology (applied product dev is a
  // coupling), medicine (clinical research is a coupling), and education
  // (academic teaching is a coupling). ADVISORY ONLY — wholly separate from the
  // validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, research content.
  var RESEARCH_DESTABILIZING = [
    // Replication / reproducibility crisis — failed replication, irreproducible results.
    { re: /replication crisis|reproducibility (crisis|fail|problem)|(fail(ed|ure)?|unable) to (replicat|reproduc)|irreproducib(le|ility)|non(-| )?reproducib|(study|result|finding)(s)? (fail(ed)? to )?replicat|crisis of (replication|reproducibility)/i, weight: 0.18, tag: 'replication_crisis' },
    // Funding cut — research-funding cut, NSF/NIH budget slashed, grant freeze.
    { re: /(research|science|r&d) (funding|budget) (cut|slash|freeze|decline|drop)|(nsf|nih|grant) (funding )?(cut|freeze|slash|decline)|funding (cut|freeze|slash) (research|science|lab|grant)|research (budget|grant) (cut|freeze)|appropriation(s)? (cut|slash) (science|research)/i, weight: 0.17, tag: 'funding_cut' },
    // Research fraud — data fabrication, falsification, paper-mill misconduct.
    { re: /research (fraud|misconduct)|(data|result) (fabricat|falsif)|scientific (fraud|misconduct|integrity (breach|crisis))|paper(-| )?mill|fabricated (data|result|finding)|image manipulation (paper|study)|retraction (fraud|misconduct)/i, weight: 0.16, tag: 'research_fraud' },
    // Brain drain — researcher exodus, visa/policy-driven flight, talent loss.
    { re: /(research(er)?|scientist|stem|academic) (brain drain|exodus|flight|talent loss)|brain drain (research|science|stem|academic)|(visa|immigration|policy) (restrict|deny).{0,30}(research(er)?|scientist|stem)|talent (exodus|flight|drain) (research|science|lab)|(postdoc|phd) (exodus|attrition|flight)/i, weight: 0.15, tag: 'brain_drain' },
    // Discovery stagnation — innovation slowdown, low breakthrough rate, R&D plateau.
    { re: /discovery (stagnat|plateau|slowdown|drought)|innovation (stagnat|slowdown|plateau|stall) (research|science|r&d)|breakthrough (rate )?(decline|stagnat|drought|scarce)|(research|scientific) (productivity|progress) (stagnat|stall|plateau)|r&d (plateau|stagnat|diminishing return)/i, weight: 0.15, tag: 'discovery_stagnation' },
    // Grant shortfall — grant-success-rate falling, award scarcity, proposal-reject surge.
    { re: /grant (shortfall|success rate (decline|drop|fall|low)|scarcity|drought)|(nih|nsf) (grant )?(success rate|payline) (decline|drop|fall|low)|award (rate )?(decline|drop|scarce)|proposal (reject(ion)? )?(surge|spike|rate (rise|high))|grant (award|funding rate) (decline|drop)/i, weight: 0.14, tag: 'grant_shortfall' },
    // Lab-capacity strain — instrument/reagent shortage, lab-space/equipment bottleneck.
    { re: /lab(-| )?(capacity|space) (strain|shortage|bottleneck|constrain)|(reagent|instrument|equipment) (shortage|backlog|constrain) (lab|research)|(core facility|lab) (bottleneck|overload|constrain)|research (infrastructure|capacity) (strain|shortfall)|(tmo|dhr|wat|mtd|bruker) (backlog|shortage|lead(-| )?time)/i, weight: 0.14, tag: 'lab_capacity_strain' },
    // Methodology-rigor erosion — p-hacking, underpowered studies, weak methods.
    { re: /methodology (rigor )?(erosion|decline|weak|lapse)|p(-| )?hack(ing)?|underpowered (study|studies|sample)|questionable research practice|hark(ing)?|(weak|poor|sloppy) (methodology|methods|study design)|statistical (rigor|power) (erod|decline|lapse)/i, weight: 0.13, tag: 'methodology_rigor_erosion' },
    // Peer-review breakdown — review-system failure, reviewer shortage, fake review.
    { re: /peer(-| )?review (breakdown|failure|crisis|collapse|overload)|reviewer (shortage|fatigue|crisis|exodus)|(fake|fraudulent|rigged) (peer(-| )?)?review|review (process )?(broke|fail|collaps)|editorial (breakdown|crisis)|peer(-| )?review (backlog|bottleneck)/i, weight: 0.14, tag: 'peer_review_breakdown' },
    // Publication-volume collapse — output decline, journal closure, productivity drop.
    { re: /publication (volume|output) (collapse|decline|drop|fall|plunge)|(paper|article) (output|volume) (decline|drop|fall)|(arxiv|nature|journal) (submission|output) (decline|drop)|journal (closure|fold|shut)|(research|scientific) output (collapse|decline|drop)|publish(ing)? (productivity )?(collapse|decline)/i, weight: 0.13, tag: 'publication_volume_collapse' },
    // Citation-trajectory decline — impact falling, citation-index drop, influence loss.
    { re: /citation (trajectory|impact|count|rate) (decline|drop|fall|collapse)|(openalex|citation) (index|metric) (decline|drop|fall)|(research|scientific) impact (decline|drop|fall)|h(-| )?index (decline|stagnat)|impact factor (decline|drop|collapse)|influence (decline|fall) (citation|research)/i, weight: 0.12, tag: 'citation_trajectory_decline' }
  ];
  var RESEARCH_STABILIZING = [
    // Reproducibility-standard adoption — preregistration, open data, replication norms.
    { re: /reproducibility(-| )?standard (adopt|deploy|gain)|(preregistration|pre(-| )?registration|registered report) (adopt|gain|expand)|open(-| )?data (mandate|adopt|gain)|replication (norm|standard|study) (adopt|expand|gain)|(reproducib|rigor) (standard|practice) (adopt|strengthen)|transparency (standard|mandate) (research|science) (adopt|gain)/i, weight: 0.16, tag: 'reproducibility_standard_adoption' },
    // Open-science-platform emergence — preprint/repository growth, open-access surge.
    { re: /open(-| )?science (platform|movement|infrastructure) (emerg|gain|grow|adopt)|(preprint|repository|arxiv) (growth|surge|adopt|expand)|open(-| )?access (surge|growth|mandate|expand)|(data|code) sharing (platform|adopt|gain)|fair (data )?principle(s)? (adopt|gain)|open(-| )?science (gain|surge|momentum)/i, weight: 0.15, tag: 'open_science_platform_emergence' },
    // AI-accelerated discovery — ML-driven research, foundation-model discovery, automation.
    { re: /ai(-| )?(accelerat|driven|powered|assist) (discovery|research|science)|(ml|machine learning|foundation model) (accelerat|driven) (discovery|research|breakthrough)|ai (lab|research) (breakthrough|accelerat)|(alphafold|automated|self(-| )?driving) (lab|discovery|research)|computational (discovery|research) (accelerat|surge|breakthrough)/i, weight: 0.14, tag: 'ai_accelerated_discovery' },
    // Interdisciplinary-collaboration surge — cross-field collaboration, consortia, team science.
    { re: /interdisciplinary (collaboration|research) (surge|gain|grow|expand)|cross(-| )?(field|discipline|institution) (collaboration|research) (surge|gain)|(research )?consorti(um|a) (form|launch|expand|grow)|team science (gain|surge|adopt)|(multi|trans)(-| )?disciplinary (collaboration|surge|gain)|collaborative (research|network) (surge|expand|grow)/i, weight: 0.15, tag: 'interdisciplinary_collaboration_surge' },
    // Grant-success-rate recovery — funding rebound, payline improvement, award surge.
    { re: /grant (success rate|payline|funding rate) (recover|rise|improv|rebound)|(nih|nsf) (grant )?(success rate|payline) (rise|recover|improv)|(research|science|r&d) (funding|budget) (boost|increase|surge|rebound)|award (rate )?(rise|recover|surge)|(grant|funding) (boost|surge|increase) (research|science)/i, weight: 0.15, tag: 'grant_success_rate_recovery' },
    // STEM-PhD retention / brain-drain reversal — talent retention, return migration, pipeline.
    { re: /(stem|phd|postdoc|researcher|scientist) (retention|retain) (gain|improv|surge)|brain(-| )?drain (reversal|revers|recover)|(talent|researcher|scientist) (return|in(-| )?migration|attract) (gain|surge|rise)|(stem|phd) (pipeline|supply) (recover|strengthen|grow)|reverse brain drain|(visa|policy) (ease|attract).{0,30}(research(er)?|scientist|stem)/i, weight: 0.14, tag: 'stem_phd_retention' },
    // Publication-velocity rebound — output recovery, submission surge, productivity rise.
    { re: /publication (velocity|volume|output) (rebound|recover|rise|surge|grow)|(paper|article) (output|volume|submission) (rise|surge|grow|rebound)|(arxiv|nature|journal) (submission|output) (rise|surge|grow)|(research|scientific) output (rebound|recover|rise|surge)|publish(ing)? (productivity )?(rebound|recover|surge)/i, weight: 0.13, tag: 'publication_velocity_rebound' },
    // Citation-impact recovery — impact rising, citation-index rebound, influence gain.
    { re: /citation (impact|trajectory|count|rate) (recover|rise|rebound|surge|gain)|(openalex|citation) (index|metric) (rise|recover|rebound|gain)|(research|scientific) impact (recover|rise|rebound|gain)|h(-| )?index (rise|gain|grow)|impact factor (rise|recover|rebound|gain)|influence (rise|gain) (citation|research)/i, weight: 0.13, tag: 'citation_impact_recovery' },
    // Methodology-rigor restoration — robust methods, power gains, rigor reform.
    { re: /methodology (rigor )?(restor|strengthen|improv|reform)|(statistical|methodological) (rigor|power) (restor|strengthen|improv|gain)|robust (methodology|method|study design) (adopt|gain)|(adequately|well)(-| )?powered (study|design) (gain|adopt)|rigor (reform|standard) (strengthen|adopt|gain)|(good|sound) research practice (adopt|gain|strengthen)/i, weight: 0.12, tag: 'methodology_rigor_restoration' }
  ];

  // ─── Law-native semantics (JUDICIARY / COURTS / RULE OF LAW / LEGAL SYSTEM) ──
  // Energy parity (same shape as INFRA / CULTURE / FINANCE / ECONOMY /
  // TECHNOLOGY / DEFENSE / INTELLIGENCE / TRADE / INDUSTRY / AGRICULTURE /
  // GOVERNANCE / COMMUNICATION / POPULATION / RESEARCH above): the law domain has
  // its OWN failure/recovery vocabulary. Where energy reads crude_above_90 /
  // grid_stress / chokepoint as named pathways with weighted contributions, LAW
  // reads the JUDICIAL / legal-system stack: courts & the judiciary, rule of law,
  // litigation & dispute resolution, regulation & compliance, contracts &
  // enforcement, intellectual-property law, criminal justice, and legal services /
  // access to justice. Destabilizing = litigation surge, court backlog / docket
  // congestion, rule-of-law erosion, regulatory crackdown, compliance failure,
  // constitutional challenge, enforcement gap, judicial-independence erosion, and
  // access-to-justice collapse. Stabilizing = court-docket recovery,
  // judicial-independence restoration, access-to-justice recovery, rule-of-law
  // strengthening, enforcement coherence, compliance adoption, dispute-resolution
  // efficiency, and legal-services capacity recovery.
  //
  // Anchors are REAL legal-sector identifiers (RELX/LexisNexis, TRI Thomson
  // Reuters/Westlaw, VERX Vertex compliance, CSGP CoStar legal-data) and legal
  // AUTHORITIES / INDICES (US Courts caseload statistics, ABA, DOJ, SCOTUS, World
  // Justice Project Rule-of-Law Index) — NEVER oil/gas/grid content as the
  // domain's OWN identity, and never fabricated. Law COUPLES to governance via
  // policy/administration, to finance via regulatory enforcement, and to
  // intelligence via surveillance authority, but its IDENTITY stays the JUDICIAL /
  // legal-system / courts / enforcement (docket throughput/backlog, rule-of-law
  // strength/erosion, enforcement coherence/gap, compliance adoption/failure,
  // access-to-justice reach/collapse), kept DISTINCT from governance (policy/
  // administration/elections is a coupling, not law's identity), intelligence
  // (surveillance is a coupling), and finance (capital markets is a coupling).
  // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
  //
  // Each entry maps a keyword pattern (matched against the domain's signal
  // strings) to a weighted push on the destabilizing or stabilizing score —
  // identical mechanism to energy's condition→weight mapping, law content.
  var LAW_DESTABILIZING = [
    // Litigation surge — caseload spike, lawsuit wave, mass-tort / class-action flood.
    { re: /litigation (surge|spike|wave|explosion|flood)|lawsuit (surge|wave|flood|spike)|(mass(-| )?tort|class(-| )?action) (surge|wave|flood)|(case ?load|caseload|filing(s)?) (surge|spike|explosion)|(us courts|federal court) (caseload|filing(s)?) (surge|spike|rise)|legal (claim|dispute) (surge|flood)/i, weight: 0.18, tag: 'litigation_surge' },
    // Court backlog — docket congestion, case-clearance collapse, trial delay.
    { re: /court (backlog|congestion|delay)|docket (backlog|congestion|overload|surge)|case(-| )?clearance (collapse|decline|fall|drop)|(trial|hearing|case) (delay|backlog|postpone)|(judicial|court) (capacity|throughput) (strain|collapse|overload)|pending case(s)? (surge|backlog)|(us courts) (backlog|pending)/i, weight: 0.16, tag: 'court_backlog' },
    // Rule-of-law erosion — WJP index decline, judicial-independence loss, legal-norm breakdown.
    { re: /rule of law (erosion|erod|decline|breakdown|backslid|deteriorat)|(world justice project|wjp) (rule of law )?(index )?(decline|drop|fall|deteriorat)|judicial (independence) (erod|loss|undermin|decline|threat)|legal (norm|order) (breakdown|erod|collapse)|(court|judiciary) (capture|politiciz|pack)|due process (erod|breakdown|deni)/i, weight: 0.18, tag: 'rule_of_law_erosion' },
    // Regulatory crackdown — enforcement sweep, sanction wave, regulatory escalation.
    { re: /regulatory (crackdown|sweep|escalat|onslaught)|enforcement (crackdown|sweep|blitz|escalat)|(doj|sec|ftc|regulator) (crackdown|probe|sweep|sue|charge|indict)|sanction(s)? (wave|surge|escalat)|(antitrust|regulatory) (action|suit) (surge|wave|escalat)|consent decree (surge|wave)/i, weight: 0.15, tag: 'regulatory_crackdown' },
    // Compliance failure — control breakdown, regulatory breach, audit failure, fine surge.
    { re: /compliance (failure|breach|breakdown|gap|lapse|violation)|(regulatory|legal) (breach|violation) (surge|wave|spike)|(control|compliance) (breakdown|fail|collapse)|audit (failure|finding) (adverse|critical|material)|(record|regulatory) fine(s)? (surge|spike|record)|(vertex|verx) (compliance) (gap|failure)/i, weight: 0.14, tag: 'compliance_failure' },
    // Constitutional challenge — SCOTUS/constitutional dispute, statute strike-down, legal uncertainty.
    { re: /constitutional (challenge|crisis|dispute|breach)|(scotus|supreme court) (strike|overturn|invalidat|challenge)|(statute|law|regulation) (strike(-| )?down|invalidat|unconstitutional)|(landmark|major) (legal|court) (challenge|dispute|uncertainty)|judicial (review|challenge) (surge|wave)/i, weight: 0.15, tag: 'constitutional_challenge' },
    // Enforcement gap — non-enforcement, impunity, legal vacuum, accountability failure.
    { re: /enforcement (gap|vacuum|breakdown|failure|collapse)|(non(-| )?enforcement|under(-| )?enforcement)|impunity (surge|gap|culture)|(legal|justice) (vacuum|gap)|accountability (gap|failure) (legal|enforcement)|(law|statute) (unenforced|ignored|flouted)|(doj|prosecutor) (decline|fail) (to )?(charge|enforce|prosecut)/i, weight: 0.14, tag: 'enforcement_gap' }
  ];
  var LAW_STABILIZING = [
    // Court-docket recovery — backlog clearance, case-clearance rebound, throughput restored.
    { re: /(court|docket) (backlog) (clear|reduc|ease|cut)|case(-| )?clearance (rate )?(recover|rise|improv|rebound)|(docket|court) (throughput|capacity) (recover|improv|restor|expand)|(trial|hearing) (backlog) (clear|reduc)|(us courts) (clearance|throughput) (improv|recover)|pending case(s)? (decline|reduc|clear)/i, weight: 0.16, tag: 'court_docket_recovery' },
    // Judicial-independence restoration — independence reaffirmed, depoliticization, integrity restored.
    { re: /judicial (independence) (restor|reaffirm|strengthen|reinforc|protect)|(court|judiciary) (independence|integrity) (restor|strengthen|safeguard)|depoliticiz(e|ation) (court|judiciary)|(judicial|court) (integrity|impartiality) (restor|reinforc)|separation of powers (restor|reaffirm) (judiciary|court)/i, weight: 0.16, tag: 'judicial_independence_restoration' },
    // Access-to-justice recovery — legal-aid expansion, representation gains, court access widened.
    { re: /access(-| )?to(-| )?justice (recover|gain|expand|improv|widen)|legal (aid|services) (expand|gain|fund|increase)|(pro bono|representation) (expand|gain|surge|increase)|(court|justice) access (widen|expand|improv)|(unrepresented|justice gap) (reduc|narrow|close)|legal(-| )?aid (funding|capacity) (boost|increase)/i, weight: 0.15, tag: 'access_to_justice_recovery' },
    // Rule-of-law strengthening — WJP index gain, legal-norm reinforcement, due-process restored.
    { re: /rule of law (strengthen|restor|improv|reinforc|consolidat)|(world justice project|wjp) (rule of law )?(index )?(rise|improv|gain|strengthen)|legal (norm|order) (strengthen|restor|reinforc)|due process (restor|strengthen|safeguard|reinforc)|(judicial|legal) (norm|institution) (strengthen|consolidat)/i, weight: 0.16, tag: 'rule_of_law_strengthening' },
    // Enforcement coherence — consistent enforcement, accountability restored, prosecution effective.
    { re: /enforcement (coherence|consistency|effectiveness) (gain|improv|restor)|(consistent|coherent|effective) (enforcement|prosecution)|accountability (restor|strengthen|reinforc) (legal|enforcement)|(doj|prosecutor) (effective|robust) (enforcement|prosecution)|(law|statute) (enforced|upheld) (consistent|effective)|rule(-| )?of(-| )?law enforcement (gain|strengthen)/i, weight: 0.14, tag: 'enforcement_coherence' },
    // Compliance adoption — controls strengthened, regulatory-readiness gain, compliance maturity.
    { re: /compliance (adopt|strengthen|maturity|readiness|improv|uplift)|(control|compliance) (framework|program) (strengthen|adopt|implement|mature)|regulatory (readiness|compliance) (gain|improv|strengthen)|(audit|control) (finding) (remediat|close|resolv)|(vertex|verx|relx|thomson reuters|tri|lexisnexis) (compliance|legal) (deploy|adopt|tool)|legal(-| )?tech (compliance) (adopt|deploy)/i, weight: 0.13, tag: 'compliance_adoption' }
  ];

  // Scan a domain's signal strings against a civil pattern table and return the
  // summed weighted contribution (clamped). Mirrors how energy accumulates its
  // condition-driven pressure, but over civil-native keywords.
  function _infraSignalScore(signals, table) {
    if (!signals || !signals.length) return { score: 0, tags: [] };
    var total = 0;
    var tags = [];
    for (var t = 0; t < table.length; t++) {
      var ent = table[t];
      for (var i = 0; i < signals.length; i++) {
        var s = String(signals[i] || '');
        if (ent.re.test(s)) {
          total += ent.weight;
          tags.push(ent.tag);
          break; // count each pattern at most once
        }
      }
    }
    return { score: _clamp(total, 0, 0.6), tags: tags };
  }

  // ─── State ───────────────────────────────────────────────────────────────

  var _balance = {};
  var _stressHistory = {};
  var _prevState = {};

  function _init() {
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      _balance[k] = { destabilizing: 0, stabilizing: 0, net: 0, state: 'neutral' };
      _stressHistory[k] = [];
      _prevState[k] = 'neutral';
    }
  }
  _init();

  // ─── Balance computation ──────────────────────────────────────────────

  function _compute() {
    var domains = window.LIMENDomains || {};
    var shifts = [];

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d) continue;

      var stress = d.stress || 0;
      var trend = d.trend || 0;
      var confidence = d.confidence || 0;
      var signals = d.signals || [];

      // Track stress history for volatility + trajectory
      _stressHistory[k].push(stress);
      if (_stressHistory[k].length > HISTORY_MAX) _stressHistory[k].shift();

      // ─── Destabilizing score ────────────────────────────────────
      // High stress, rising trend, high volatility = destabilizing
      var destab = 0;

      // Current stress level (primary factor)
      destab += stress * 0.55;

      // Rising trend amplifies
      if (trend > 0.02) {
        destab += trend * 2.0;
      }

      // Volatility (std dev of recent history)
      var vol = _stddev(_stressHistory[k]);
      destab += vol * 1.5;

      // Low confidence means less trust in data, slight destab
      if (confidence < 0.3 && stress > 0.3) {
        destab += 0.05;
      }

      // ── Infrastructure-native destabilizing pathways (energy parity) ──
      // For the infrastructure domain ONLY, add civil-specific pressure from
      // named failure pathways found in the live signal strings (grid reliability,
      // cyber-physical/SCADA threat persistence, deferred-maintenance acceleration,
      // structural-asset failure, water-system failure, transport reliability,
      // equipment lead time). This is the civil analogue of energy's
      // crude_above_*/grid_stress/chokepoint condition weighting.
      var _infraDestabTags = null;
      if (k === 'infrastructure') {
        var _id = _infraSignalScore(signals, INFRA_DESTABILIZING);
        destab += _id.score;
        _infraDestabTags = _id.tags;
      }

      // ── Culture-native destabilizing pathways (energy parity) ──
      // For the culture domain ONLY, add cultural-semantic pressure from named
      // failure pathways found in the live signal strings (backlash accumulation,
      // audience-attention collapse, scene saturation / trend collapse, creator
      // burnout, cultural-movement fragmentation, distribution chokepoints). This
      // is the attention-economy analogue of energy's crude_above_*/grid_stress
      // and infrastructure's grid_reliability/deferred_maintenance weighting.
      var _cultureDestabTags = null;
      if (k === 'culture') {
        var _cd = _infraSignalScore(signals, CULTURE_DESTABILIZING);
        destab += _cd.score;
        _cultureDestabTags = _cd.tags;
      }

      // ── Finance-native destabilizing pathways (energy parity) ──
      // For the finance domain ONLY, add financial-semantic pressure from named
      // failure pathways found in the live signal strings (liquidity crunch,
      // credit-spread widening, solvency pressure, margin call / forced
      // liquidation, default risk / covenant breach, counterparty/contagion
      // exposure, capital flight). This is the capital-markets analogue of
      // energy's crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, and culture's backlash/audience-collapse weighting.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _financeDestabTags = null;
      if (k === 'finance') {
        var _fd = _infraSignalScore(signals, FINANCE_DESTABILIZING);
        destab += _fd.score;
        _financeDestabTags = _fd.tags;
      }

      // ── Economy-native destabilizing pathways (energy parity, MACRO) ──
      // For the economy domain ONLY, add macroeconomic pressure from named
      // failure pathways found in the live signal strings (unemployment above
      // trend, demand shock, supply shock, credit tightening, yield-curve
      // inversion, real-wage stagnation, capacity-utilization collapse /
      // recession, policy error). This is the whole-economy business-cycle
      // analogue of energy's crude_above_*/grid_stress, infrastructure's
      // grid_reliability/deferred_maintenance, culture's backlash/audience
      // collapse, and finance's liquidity/credit weighting — but anchored to
      // MACRO indicators (UNRATE/PAYEMS/GDP/CPI/PCE/FEDFUNDS/DGS10/INDPRO),
      // kept DISTINCT from finance's capital-markets lane. ADVISORY ONLY —
      // wholly separate from the validated P3 distress kernel.
      var _economyDestabTags = null;
      if (k === 'economy') {
        var _ed = _infraSignalScore(signals, ECONOMY_DESTABILIZING);
        destab += _ed.score;
        _economyDestabTags = _ed.tags;
      }

      // ── Technology-native destabilizing pathways (energy parity) ──
      // For the technology domain ONLY, add compute-and-innovation pressure from
      // named failure pathways found in the live signal strings (compute shortage
      // / GPU-TPU scarcity, chip-cycle disruption / fab queue depth, AI capex
      // spiral / datacenter power constraints, platform shift / API deprecation,
      // obsolescence / hardware EOL, cyber breach / 0-day spikes, supply
      // constraint / TSMC-ASML lead times). This is the semiconductor-and-compute
      // analogue of energy's crude_above_*/grid_stress, infrastructure's
      // grid_reliability/deferred_maintenance, culture's backlash/audience
      // collapse, finance's liquidity/credit, and economy's business-cycle
      // weighting — IDENTITY stays chips/software/AI/cyber (couples to energy via
      // compute demand, distinct from finance/fintech). ADVISORY ONLY — wholly
      // separate from the validated P3 distress kernel.
      var _technologyDestabTags = null;
      if (k === 'technology') {
        var _td = _infraSignalScore(signals, TECHNOLOGY_DESTABILIZING);
        destab += _td.score;
        _technologyDestabTags = _td.tags;
      }

      // ── Defense-native destabilizing pathways (energy parity) ──
      // For the defense domain ONLY, add military/national-security pressure
      // from named failure pathways found in the live signal strings (conflict
      // escalation, deterrence failure, force-readiness erosion, procurement
      // delay, munitions/stockpile depletion, defense industrial-base strain,
      // alliance stress). This is the military-power analogue of energy's
      // crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, culture's backlash/audience collapse, finance's
      // liquidity/credit, economy's business-cycle, and technology's
      // compute-stack weighting — IDENTITY stays kinetic/industrial/readiness
      // (couples to energy via fuel/strategic reserves, distinct from
      // intelligence collection and technology cyber). ADVISORY ONLY — wholly
      // separate from the validated P3 distress kernel.
      var _defenseDestabTags = null;
      if (k === 'defense') {
        var _dd = _infraSignalScore(signals, DEFENSE_DESTABILIZING);
        destab += _dd.score;
        _defenseDestabTags = _dd.tags;
      }

      // ── Intelligence-native destabilizing pathways (energy parity) ──
      // For the intelligence domain ONLY, add collection-and-assessment pressure
      // from named failure pathways found in the live signal strings (collection
      // gap / signal blindness, low observability, weak anomaly detection,
      // analytic distortion / bias, oversight failure, trust-boundary breach /
      // insider threat, privacy violation / bulk-collection excess). This is the
      // intelligence-cycle analogue of energy's crude_above_*/grid_stress,
      // infrastructure's grid_reliability/deferred_maintenance, culture's
      // backlash/audience collapse, finance's liquidity/credit, economy's
      // business-cycle, technology's compute-stack, and defense's readiness
      // weighting — IDENTITY stays collection/analysis/espionage (couples to
      // technology via cyber tooling and defense via warning, distinct from
      // defense kinetic/industrial and technology cyber identity). ADVISORY ONLY
      // — wholly separate from the validated P3 distress kernel.
      var _intelligenceDestabTags = null;
      if (k === 'intelligence') {
        var _itd = _infraSignalScore(signals, INTELLIGENCE_DESTABILIZING);
        destab += _itd.score;
        _intelligenceDestabTags = _itd.tags;
      }

      // ── Trade-native destabilizing pathways (energy parity) ──
      // For the trade domain ONLY (runtime key 'supplyChain'), add international-
      // trade/logistics pressure from named failure pathways found in the live
      // signal strings (tariff shock / trade-war escalation, sanctions / export
      // ban, port congestion / closure, chokepoint / route constraint, freight-
      // rate spike, customs / clearance disruption, supply-chain bottleneck).
      // This is the trade-and-commerce analogue of energy's crude_above_*/
      // grid_stress, infrastructure's grid_reliability/deferred_maintenance,
      // culture's backlash/audience collapse, finance's liquidity/credit,
      // economy's business-cycle, technology's compute-stack, defense's
      // readiness, and intelligence's collection weighting — IDENTITY stays
      // exports/tariffs/shipping/ports/customs (couples to energy via fuel cost
      // and to economy via the trade balance, distinct from economy's MACRO lane
      // and industry's domestic production). ADVISORY ONLY — wholly separate from
      // the validated P3 distress kernel.
      var _tradeDestabTags = null;
      if (k === 'supplyChain') {
        var _trd = _infraSignalScore(signals, TRADE_DESTABILIZING);
        destab += _trd.score;
        _tradeDestabTags = _trd.tags;
      }

      // ── Industry-native destabilizing pathways (energy parity) ──
      // For the industry domain ONLY, add manufacturing & industrial-production
      // pressure from named failure pathways found in the live signal strings
      // (capacity-utilization collapse, production halt, automation failure,
      // input-cost squeeze, factory shutdown, industrial recession, supply-chain
      // bottleneck to the line, equipment-failure cascade). This is the
      // factory-output analogue of energy's crude_above_*/grid_stress,
      // infrastructure's grid_reliability/deferred_maintenance, culture's
      // backlash/audience collapse, finance's liquidity/credit, economy's
      // business-cycle, technology's compute-stack, defense's readiness,
      // intelligence's collection, and trade's tariff/port weighting — anchored
      // to manufacturing-PMI and capacity-utilization output-gap floors, IDENTITY
      // stays factory output / capacity utilization / automation / machinery
      // (couples to trade via inputs and economy via INDPRO, distinct from
      // trade's logistics/commerce, economy's MACRO aggregate, and technology's
      // automation software). ADVISORY ONLY — wholly separate from the validated
      // P3 distress kernel.
      var _industryDestabTags = null;
      if (k === 'industry') {
        var _ind = _infraSignalScore(signals, INDUSTRY_DESTABILIZING);
        destab += _ind.score;
        _industryDestabTags = _ind.tags;
      }

      // ── Agriculture-native destabilizing pathways (energy parity) ──
      // For the agriculture domain ONLY, add farming & food-production pressure
      // from named failure pathways found in the live signal strings (crop
      // failure / harvest shortfall, drought stress, fertilizer / input cost
      // spike, food-price surge, livestock disease, food/grain export ban,
      // commodity-price crash, input-supply disruption, soil degradation,
      // agricultural water stress). This is the crops-and-food analogue of
      // energy's crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, culture's backlash/audience collapse, finance's
      // liquidity/credit, economy's business-cycle, technology's compute-stack,
      // defense's readiness, intelligence's collection, trade's tariff/port, and
      // industry's factory-output weighting — anchored to real ag tickers (ADM/
      // BG/CTVA/DE/NTR/MOS/CF/TSN/CAG/INGR/AGCO/FMC) and CBOT corn/soy/wheat /
      // USDA WASDE references, IDENTITY stays crops/livestock/food-production/
      // farm-inputs (couples to environment via land/water/climate, trade via
      // export logistics, and economy via food prices, distinct from each of
      // those). ADVISORY ONLY — wholly separate from the validated P3 distress
      // kernel.
      var _agricultureDestabTags = null;
      if (k === 'agriculture') {
        var _agd = _infraSignalScore(signals, AGRICULTURE_DESTABILIZING);
        destab += _agd.score;
        _agricultureDestabTags = _agd.tags;
      }

      // ── Governance-native destabilizing pathways (energy parity) ──
      // For the governance domain ONLY, add institutions-and-policy pressure
      // from named failure pathways found in the live signal strings
      // (institutional erosion / separation-of-powers tension, legitimacy crisis
      // / trust erosion, policy gridlock / legislative stalemate, policy conflict
      // / inconsistent execution, regulatory capture / oversight breakdown /
      // accountability failure, fiscal-governance stress, electoral instability).
      // This is the machinery-of-collective-rule analogue of energy's
      // crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, culture's backlash/audience collapse, finance's
      // liquidity/credit, economy's business-cycle, technology's compute-stack,
      // defense's readiness, intelligence's collection, trade's tariff/port, and
      // industry's factory-output weighting — anchored to governance indices
      // (World Bank WGI, V-Dem, GAO, CBO, Federal Register) with structural-
      // signal overrides distinguishing policy-outcome signals from noisy
      // news-volume signals, IDENTITY stays institutions/policy/elections/
      // legitimacy (couples to economy via public finance and law via rule of
      // law, distinct from economy's MACRO aggregate, finance's capital markets,
      // and law's judicial adjudication). ADVISORY ONLY — wholly separate from
      // the validated P3 distress kernel.
      var _governanceDestabTags = null;
      if (k === 'governance') {
        var _gd = _infraSignalScore(signals, GOVERNANCE_DESTABILIZING);
        destab += _gd.score;
        _governanceDestabTags = _gd.tags;
      }

      // ── Communication-native destabilizing pathways (energy parity) ──
      // For the communication domain ONLY, add telecom/network/media-channel
      // pressure from named failure pathways found in the live signal strings
      // (network outage / internet shutdown, spectrum crunch / bandwidth strain,
      // connectivity gap, censorship event, media-trust collapse, misinformation
      // surge, platform concentration, broadcast failure, signal degradation,
      // regulatory overreach). This is the information-flow analogue of energy's
      // crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, culture's backlash/audience collapse, finance's
      // liquidity/credit, economy's business-cycle, technology's compute-stack,
      // defense's readiness, intelligence's collection, trade's tariff/port,
      // industry's factory-output, agriculture's crops, and governance's
      // institutions weighting — anchored to real telecom/network tickers (VZ/T/
      // TMUS/CMCSA/CHTR/CSCO/ANET/AMT/CCI/SBAC) and media tickers (NWSA/NYT/META/
      // GOOGL), IDENTITY stays the CHANNELS / networks / information-flow (couples
      // to technology via chips/software, intelligence via signals collection,
      // and culture via content riding the channels, distinct from culture's
      // content/movements, technology's chips/software, and intelligence's
      // collection). ADVISORY ONLY — wholly separate from the validated P3
      // distress kernel.
      var _communicationDestabTags = null;
      if (k === 'communication') {
        var _cmd = _infraSignalScore(signals, COMMUNICATION_DESTABILIZING);
        destab += _cmd.score;
        _communicationDestabTags = _cmd.tags;
      }

      // ── Population / demographic-native destabilizing pathways (energy parity) ──
      // For the population domain ONLY, add demographic pressure from named
      // failure pathways found in the live signal strings (demographic collapse:
      // birth-rate / fertility decline & family-formation stall; migration surge:
      // refugee inflow / internal displacement / climate migration; aging crisis:
      // median-age rise / old-age-dependency spike / working-age decline; labor-
      // supply shortage: participation drop / prime-age employment loss;
      // urbanization strain: slum growth / housing-unaffordability spike;
      // depopulation: rural exodus / regional out-migration / population
      // stagnation). This is the demographic analogue of energy's crude_above_*/
      // grid_stress, infrastructure's grid_reliability/deferred_maintenance,
      // culture's backlash/audience collapse, finance's liquidity/credit,
      // economy's business-cycle, technology's compute-stack, defense's readiness,
      // intelligence's collection, trade's tariff/port, industry's factory-output,
      // agriculture's crops, governance's institutions, and communication's
      // channels weighting — anchored to real demographic SOURCES (US Census/ACS,
      // UN World Population Prospects, Pew Research, BLS labor-force) and
      // demographic-exposed PROXIES (WELL/VTR senior-living REITs; LEN/PHM/DHI
      // housing). IDENTITY stays demographics & population dynamics (couples to
      // economy via the labor market, medicine via mortality/health, education via
      // enrollment, governance via policy — distinct from economy's MACRO
      // aggregate, medicine's mortality/health, education's enrollment, and
      // governance's structure). ADVISORY ONLY — wholly separate from the
      // validated P3 distress kernel.
      var _populationDestabTags = null;
      if (k === 'population') {
        var _pd = _infraSignalScore(signals, POPULATION_DESTABILIZING);
        destab += _pd.score;
        _populationDestabTags = _pd.tags;
      }

      // ── Research / science-native destabilizing pathways (energy parity) ──
      // For the science domain ONLY (runtime/snapshot key 'research' — see
      // domain-identity.js: science ↔ research), add knowledge-production pressure
      // from named failure pathways found in the live signal strings (replication
      // / reproducibility crisis, funding cut, research fraud / methodology-rigor
      // erosion, brain drain, discovery stagnation, grant shortfall, lab-capacity
      // strain, peer-review breakdown, publication-volume collapse, citation-
      // trajectory decline). This is the discovery-and-R&D analogue of energy's
      // crude_above_*/grid_stress, infrastructure's grid_reliability/
      // deferred_maintenance, culture's backlash/audience collapse, finance's
      // liquidity/credit, economy's business-cycle, technology's compute-stack,
      // defense's readiness, intelligence's collection, trade's tariff/port,
      // industry's factory-output, agriculture's crops, governance's institutions,
      // communication's channels, and population's demographics weighting —
      // anchored to real research-sector tickers (TMO/DHR/A/MTD/WAT/ILMN/BIO/RVTY/
      // BRKR/IQV/ICLR) and research authorities (NSF/NIH/arXiv/Nature/OpenAlex/
      // NASA/CDC). IDENTITY stays knowledge production / discovery / peer review /
      // grants / the R&D pipeline (couples to technology via applied product dev,
      // medicine via clinical research, and education via the academic pipeline,
      // distinct from each). ADVISORY ONLY — wholly separate from the validated P3
      // distress kernel.
      var _researchDestabTags = null;
      if (k === 'research') {
        var _rd = _infraSignalScore(signals, RESEARCH_DESTABILIZING);
        destab += _rd.score;
        _researchDestabTags = _rd.tags;
      }

      // ── Law / judicial-native destabilizing pathways (energy parity) ──
      // For the law domain ONLY, add legal-system pressure from named failure
      // pathways found in the live signal strings (litigation surge, court backlog
      // / docket congestion, rule-of-law erosion, regulatory crackdown, compliance
      // failure, constitutional challenge, enforcement gap). This is the JUDICIAL /
      // legal-system analogue of energy's crude_above_*/grid_stress, infrastructure's
      // grid_reliability/deferred_maintenance, culture's backlash/audience collapse,
      // finance's liquidity/credit, economy's business-cycle, technology's
      // compute-stack, defense's readiness, intelligence's collection, trade's
      // tariff/port, industry's factory-output, agriculture's crops, governance's
      // institutions, communication's channels, population's demographics, and
      // research's knowledge-production weighting — anchored to real legal-sector
      // identifiers (RELX/LexisNexis, TRI Thomson Reuters/Westlaw, VERX Vertex,
      // CSGP) and legal authorities/indices (US Courts caseload, ABA, DOJ, SCOTUS,
      // World Justice Project Rule-of-Law Index). IDENTITY stays the JUDICIAL /
      // legal-system / courts / enforcement (couples to governance via policy,
      // finance via regulatory enforcement, and intelligence via surveillance
      // authority — distinct from governance's policy/administration/elections,
      // finance's capital markets, and intelligence's collection). ADVISORY ONLY —
      // wholly separate from the validated P3 distress kernel.
      var _lawDestabTags = null;
      if (k === 'law') {
        var _ld = _infraSignalScore(signals, LAW_DESTABILIZING);
        destab += _ld.score;
        _lawDestabTags = _ld.tags;
      }

      destab = _clamp(destab, 0, 1);

      // ─── Stabilizing score ─────────────────────────────────────
      // Falling trend, reducing volatility, improving trajectory = stabilizing
      var stab = 0;

      // Falling trend is stabilizing
      if (trend < -0.02) {
        stab += Math.abs(trend) * 2.5;
      }

      // Low and stable stress is stabilizing
      if (stress < 0.30) {
        stab += (0.30 - stress) * 0.8;
      }

      // Decreasing volatility over time
      if (_stressHistory[k].length >= 6) {
        var olderVol = _stddev(_stressHistory[k].slice(0, Math.floor(_stressHistory[k].length / 2)));
        var newerVol = _stddev(_stressHistory[k].slice(Math.floor(_stressHistory[k].length / 2)));
        if (olderVol > newerVol + 0.01) {
          stab += (olderVol - newerVol) * 3.0;
        }
      }

      // Trajectory: if stress was higher before and is now lower
      if (_stressHistory[k].length >= 4) {
        var older = _avg(_stressHistory[k].slice(0, 3));
        var newer = _avg(_stressHistory[k].slice(-3));
        if (older > newer + 0.02) {
          stab += (older - newer) * 2.0;
        }
      }

      // High confidence in low-stress data is stabilizing
      if (confidence > 0.7 && stress < 0.40) {
        stab += 0.08;
      }

      // ── Infrastructure-native stabilizing pathways (energy parity) ──
      // Civil recovery vocabulary: capital funding renewal, capacity
      // modernization, and repair completion rate. Mirrors energy's
      // falling-trend / declining-volatility stabilizers but with civil
      // semantics drawn from the live signal strings.
      var _infraStabTags = null;
      if (k === 'infrastructure') {
        var _is = _infraSignalScore(signals, INFRA_STABILIZING);
        stab += _is.score;
        _infraStabTags = _is.tags;
      }

      // ── Culture-native stabilizing pathways (energy parity) ──
      // Cultural recovery vocabulary: fanbase momentum / breakout, taste-making
      // emergence & scene momentum, mainstream adoption / cultural crossover.
      // Mirrors energy's falling-trend / declining-volatility stabilizers and
      // infrastructure's funding-renewal / repair-completion, with cultural
      // semantics drawn from the live signal strings.
      var _cultureStabTags = null;
      if (k === 'culture') {
        var _cs = _infraSignalScore(signals, CULTURE_STABILIZING);
        stab += _cs.score;
        _cultureStabTags = _cs.tags;
      }

      // ── Finance-native stabilizing pathways (energy parity) ──
      // Financial recovery vocabulary: liquidity restoration (backstops/
      // facilities), credit normalization (spreads tightening / upgrades), and
      // capital strengthening (raises / orderly deleveraging). Mirrors energy's
      // falling-trend / declining-volatility stabilizers, infrastructure's
      // funding-renewal / repair-completion, and culture's fanbase-momentum /
      // mainstream-adoption, with financial semantics from the live signals.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _financeStabTags = null;
      if (k === 'finance') {
        var _fs = _infraSignalScore(signals, FINANCE_STABILIZING);
        stab += _fs.score;
        _financeStabTags = _fs.tags;
      }

      // ── Economy-native stabilizing pathways (energy parity, MACRO) ──
      // Macroeconomic recovery vocabulary: labor-market recovery (UNRATE/PAYEMS
      // improving), demand rebound (PCE / consumption rising), credit
      // normalization (rate cuts / soft landing), fiscal stimulus, productivity
      // acceleration (INDPRO / output-per-hour), and investment recovery
      // (capex / sentiment, UMCSENT). Mirrors energy's falling-trend /
      // declining-volatility stabilizers, infrastructure's funding-renewal /
      // repair-completion, culture's fanbase-momentum / mainstream-adoption, and
      // finance's liquidity-restoration / capital-strengthening — but anchored to
      // MACRO indicators and kept DISTINCT from finance's capital-markets lane.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _economyStabTags = null;
      if (k === 'economy') {
        var _es = _infraSignalScore(signals, ECONOMY_STABILIZING);
        stab += _es.score;
        _economyStabTags = _es.tags;
      }

      // ── Technology-native stabilizing pathways (energy parity) ──
      // Technology recovery vocabulary: fab-capacity recovery (foundry build-out /
      // wafer supply normalizing), efficient-inference breakthrough (cheaper
      // compute / distillation), open-source AI adoption (open weights /
      // standardization), supply-chain diversification (TSMC/Samsung/Intel parity
      // / reshoring), cybersecurity framework maturation (patch / zero-trust), and
      // breakthrough (foundational model / transformative chip architecture /
      // quantum milestone). Mirrors energy's falling-trend / declining-volatility
      // stabilizers, infrastructure's funding-renewal / repair-completion,
      // culture's fanbase-momentum / mainstream-adoption, finance's
      // liquidity-restoration / capital-strengthening, and economy's
      // labor-recovery / productivity, with technology semantics from the live
      // signals. ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _technologyStabTags = null;
      if (k === 'technology') {
        var _ts = _infraSignalScore(signals, TECHNOLOGY_STABILIZING);
        stab += _ts.score;
        _technologyStabTags = _ts.tags;
      }

      // ── Defense-native stabilizing pathways (energy parity) ──
      // Defense recovery vocabulary: force modernization completions,
      // procurement acceleration (contract awards / production ramps /
      // multi-year buys), weapons-system upgrades (block upgrades / capability
      // insertion), strategic-deterrence credibility (triad recapitalization /
      // posture strengthening), and alliance strengthening (coalition cohesion /
      // burden-sharing gains / basing expansion). Mirrors energy's
      // falling-trend / declining-volatility stabilizers, infrastructure's
      // funding-renewal / repair-completion, culture's fanbase-momentum /
      // mainstream-adoption, finance's liquidity-restoration /
      // capital-strengthening, economy's labor-recovery / productivity, and
      // technology's fab-capacity / breakthrough, with defense semantics from
      // the live signals. ADVISORY ONLY — wholly separate from the validated
      // P3 distress kernel.
      var _defenseStabTags = null;
      if (k === 'defense') {
        var _ds = _infraSignalScore(signals, DEFENSE_STABILIZING);
        stab += _ds.score;
        _defenseStabTags = _ds.tags;
      }

      // ── Intelligence-native stabilizing pathways (energy parity) ──
      // Intelligence recovery vocabulary: improved observability (restored
      // coverage / new sensors), collection expansion (new sources/platforms /
      // access development), analytical debiasing (red-team / alternative
      // analysis / structured techniques), oversight strengthening
      // (accountability / review restored), trust-boundary repair (insider-risk
      // mitigation / vetting hardened / breach contained), and
      // counterintelligence containment (penetration neutralized / CI win).
      // Mirrors energy's falling-trend / declining-volatility stabilizers,
      // infrastructure's funding-renewal / repair-completion, culture's
      // fanbase-momentum / mainstream-adoption, finance's liquidity-restoration /
      // capital-strengthening, economy's labor-recovery / productivity,
      // technology's fab-capacity / breakthrough, and defense's force-
      // modernization / alliance-strengthening, with intelligence semantics from
      // the live signals. ADVISORY ONLY — wholly separate from the validated P3
      // distress kernel.
      var _intelligenceStabTags = null;
      if (k === 'intelligence') {
        var _its = _infraSignalScore(signals, INTELLIGENCE_STABILIZING);
        stab += _its.score;
        _intelligenceStabTags = _its.tags;
      }

      // ── Trade-native stabilizing pathways (energy parity) ──
      // Trade recovery vocabulary: tariff normalization (rollback / trade deal /
      // de-escalation), sanctions relief (restrictions lifted / license granted),
      // port reopening / throughput recovery (congestion easing / backlog
      // cleared), container-capacity recovery (equipment available / imbalance
      // resolving), customs-clearance acceleration (faster processing / single-
      // window / facilitation), and freight-rate stabilization (rates
      // normalizing / spot softening). Mirrors energy's falling-trend /
      // declining-volatility stabilizers, infrastructure's funding-renewal /
      // repair-completion, culture's fanbase-momentum / mainstream-adoption,
      // finance's liquidity-restoration / capital-strengthening, economy's
      // labor-recovery / productivity, technology's fab-capacity / breakthrough,
      // defense's force-modernization / alliance-strengthening, and
      // intelligence's improved-observability / collection-expansion, with trade
      // semantics from the live signals. ADVISORY ONLY — wholly separate from the
      // validated P3 distress kernel.
      var _tradeStabTags = null;
      if (k === 'supplyChain') {
        var _trs = _infraSignalScore(signals, TRADE_STABILIZING);
        stab += _trs.score;
        _tradeStabTags = _trs.tags;
      }

      // ── Industry-native stabilizing pathways (energy parity) ──
      // Industry recovery vocabulary: capacity modernization (plant upgrade /
      // Industry-4.0 / smart-factory), automation investment (robotics/cobot
      // deployment / automation capex), output recovery (production rebound /
      // capacity-utilization rising / PMI>50), order-book strength (durable-goods
      // orders rising / backlog building), reshoring / capacity build-out (new
      // plant / onshoring / domestic capacity add), and industrial maintenance /
      // uptime restoration (predictive maintenance / OEE / uptime gains). Mirrors
      // energy's falling-trend / declining-volatility stabilizers,
      // infrastructure's funding-renewal / repair-completion, culture's
      // fanbase-momentum / mainstream-adoption, finance's liquidity-restoration /
      // capital-strengthening, economy's labor-recovery / productivity,
      // technology's fab-capacity / breakthrough, defense's force-modernization /
      // alliance-strengthening, intelligence's improved-observability /
      // collection-expansion, and trade's tariff-normalization / port-reopening,
      // with industry semantics from the live signals. ADVISORY ONLY — wholly
      // separate from the validated P3 distress kernel.
      var _industryStabTags = null;
      if (k === 'industry') {
        var _ins = _infraSignalScore(signals, INDUSTRY_STABILIZING);
        stab += _ins.score;
        _industryStabTags = _ins.tags;
      }

      // ── Agriculture-native stabilizing pathways (energy parity) ──
      // Agriculture recovery vocabulary: good yield / harvest completion
      // (record yield / WASDE raise), commodity-price recovery (crop price
      // rebound / farm-gate firming), government support program (farm subsidy /
      // crop insurance / USDA support / farm bill), input-cost normalization
      // (fertilizer price easing), export-market opening (grain deal / new
      // export access), soil-health gain (regenerative ag / cover crop / soil
      // restoration), irrigation investment (drip/precision irrigation / water
      // infrastructure), and crop-diversity expansion (rotation / resilient
      // varieties). Mirrors energy's falling-trend / declining-volatility
      // stabilizers, infrastructure's funding-renewal / repair-completion,
      // culture's fanbase-momentum / mainstream-adoption, finance's
      // liquidity-restoration / capital-strengthening, economy's labor-recovery /
      // productivity, technology's fab-capacity / breakthrough, defense's force-
      // modernization / alliance-strengthening, intelligence's
      // improved-observability / collection-expansion, trade's tariff-
      // normalization / port-reopening, and industry's capacity-modernization /
      // output-recovery, with agriculture semantics from the live signals.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _agricultureStabTags = null;
      if (k === 'agriculture') {
        var _ags = _infraSignalScore(signals, AGRICULTURE_STABILIZING);
        stab += _ags.score;
        _agricultureStabTags = _ags.tags;
      }

      // ── Governance-native stabilizing pathways (energy parity) ──
      // Governance recovery vocabulary: institutional strengthening (separation-
      // of-powers restored / WGI / V-Dem improvement), legitimacy / trust
      // restoration (public confidence recovering / mandate secured), policy
      // passage / bipartisan resolution (legislative output / Federal Register
      // normalization), oversight & accountability restored (GAO/IG remediation /
      // anti-corruption gains / transparency), fiscal-governance discipline
      // (CBO/budget consolidation / debt-path improvement), and electoral
      // stabilization / peaceful transfer / service-delivery recovery (orderly
      // transition / govtech delivery). Mirrors energy's falling-trend /
      // declining-volatility stabilizers, infrastructure's funding-renewal /
      // repair-completion, culture's fanbase-momentum / mainstream-adoption,
      // finance's liquidity-restoration / capital-strengthening, economy's
      // labor-recovery / productivity, technology's fab-capacity / breakthrough,
      // defense's force-modernization / alliance-strengthening, intelligence's
      // improved-observability / collection-expansion, trade's tariff-
      // normalization / port-reopening, and industry's capacity-modernization /
      // output-recovery, with governance semantics from the live signals.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _governanceStabTags = null;
      if (k === 'governance') {
        var _gs = _infraSignalScore(signals, GOVERNANCE_STABILIZING);
        stab += _gs.score;
        _governanceStabTags = _gs.tags;
      }

      // ── Communication-native stabilizing pathways (energy parity) ──
      // Communication recovery vocabulary: network resilience recovery (outage
      // restored / redundancy / hardening), spectrum allocation recovery
      // (spectrum freed / auction / capacity added), connectivity restoration
      // (broadband build-out / coverage expansion), media-trust rebuilding
      // (credibility restored / fact-checking / transparency), misinformation
      // counter-narrative infrastructure (debunk / literacy / provenance),
      // platform interoperability (open standards / federation / anti-lock-in),
      // and broadcast capacity recovery (transmitter restored / broadcast
      // expansion / uplink). Mirrors energy's falling-trend / declining-volatility
      // stabilizers, infrastructure's funding-renewal / repair-completion,
      // culture's fanbase-momentum / mainstream-adoption, finance's
      // liquidity-restoration / capital-strengthening, economy's labor-recovery /
      // productivity, technology's fab-capacity / breakthrough, defense's force-
      // modernization / alliance-strengthening, intelligence's
      // improved-observability / collection-expansion, trade's tariff-
      // normalization / port-reopening, industry's capacity-modernization /
      // output-recovery, and governance's institutional-strengthening /
      // policy-passage, with communication semantics from the live signals.
      // ADVISORY ONLY — wholly separate from the validated P3 distress kernel.
      var _communicationStabTags = null;
      if (k === 'communication') {
        var _cms = _infraSignalScore(signals, COMMUNICATION_STABILIZING);
        stab += _cms.score;
        _communicationStabTags = _cms.tags;
      }

      // ── Population / demographic-native stabilizing pathways (energy parity) ──
      // Demographic recovery vocabulary: demographic recovery (birth-rate /
      // fertility stabilization, family-formation uptick), migration containment
      // (resettlement rate, displacement recovery, absorption capacity), aging
      // support (age-friendly housing, long-term-care capacity, intergenerational-
      // transfer strengthening), labor-force growth (prime-age / participation
      // recovery, workforce-age growth), urbanization resilience (affordable-
      // housing development, slum remediation, urban-infrastructure investment),
      // and re-population (return / regional in-migration, population
      // stabilization). Mirrors energy's falling-trend / declining-volatility
      // stabilizers, infrastructure's funding-renewal / repair-completion,
      // culture's fanbase-momentum / mainstream-adoption, finance's liquidity-
      // restoration / capital-strengthening, economy's labor-recovery /
      // productivity, technology's fab-capacity / breakthrough, defense's force-
      // modernization / alliance-strengthening, intelligence's
      // improved-observability / collection-expansion, trade's tariff-
      // normalization / port-reopening, industry's capacity-modernization /
      // output-recovery, governance's institutional-strengthening / policy-
      // passage, and communication's network-resilience / connectivity-
      // restoration, with demographic semantics from the live signals — anchored
      // to real demographic SOURCES (Census/ACS, UN WPP, Pew, BLS) and proxies
      // (WELL/VTR; LEN/PHM/DHI). ADVISORY ONLY — wholly separate from the
      // validated P3 distress kernel.
      var _populationStabTags = null;
      if (k === 'population') {
        var _ps = _infraSignalScore(signals, POPULATION_STABILIZING);
        stab += _ps.score;
        _populationStabTags = _ps.tags;
      }

      // ── Research / science-native stabilizing pathways (energy parity) ──
      // Research recovery vocabulary: reproducibility-standard adoption
      // (preregistration / open data / replication norms), open-science-platform
      // emergence (preprint / repository growth / open-access surge), AI-
      // accelerated discovery (ML-driven research / foundation-model discovery),
      // interdisciplinary-collaboration surge (cross-field consortia / team
      // science), grant-success-rate recovery (NIH/NSF payline improvement),
      // STEM-PhD retention / brain-drain reversal (talent retention / return
      // migration), publication-velocity rebound (output recovery / submission
      // surge), citation-impact recovery (impact rising / index rebound), and
      // methodology-rigor restoration (robust methods / power gains). Mirrors
      // energy's falling-trend / declining-volatility stabilizers,
      // infrastructure's funding-renewal / repair-completion, culture's
      // fanbase-momentum / mainstream-adoption, finance's liquidity-restoration /
      // capital-strengthening, economy's labor-recovery / productivity,
      // technology's fab-capacity / breakthrough, defense's force-modernization /
      // alliance-strengthening, intelligence's improved-observability /
      // collection-expansion, trade's tariff-normalization / port-reopening,
      // industry's capacity-modernization / output-recovery, governance's
      // institutional-strengthening / policy-passage, communication's
      // network-resilience / connectivity-restoration, and population's
      // demographic-recovery / labor-force-growth, with research semantics from
      // the live signals — anchored to real research tickers (TMO/DHR/A/MTD/WAT/
      // ILMN/BIO/RVTY/BRKR/IQV/ICLR) and authorities (NSF/NIH/arXiv/Nature/
      // OpenAlex/NASA). ADVISORY ONLY — wholly separate from the validated P3
      // distress kernel.
      var _researchStabTags = null;
      if (k === 'research') {
        var _rs = _infraSignalScore(signals, RESEARCH_STABILIZING);
        stab += _rs.score;
        _researchStabTags = _rs.tags;
      }

      // ── Law / judicial-native stabilizing pathways (energy parity) ──
      // Law recovery vocabulary: court-docket recovery (backlog clearance /
      // throughput restored), judicial-independence restoration (independence
      // reaffirmed / depoliticization), access-to-justice recovery (legal-aid
      // expansion / representation gains), rule-of-law strengthening (WJP index
      // gain / due-process restored), enforcement coherence (consistent
      // enforcement / accountability restored), and compliance adoption (controls
      // strengthened / regulatory-readiness gain). Mirrors energy's falling-trend /
      // declining-volatility stabilizers, infrastructure's funding-renewal /
      // repair-completion, culture's fanbase-momentum / mainstream-adoption,
      // finance's liquidity-restoration / capital-strengthening, economy's
      // labor-recovery / productivity, technology's fab-capacity / breakthrough,
      // defense's force-modernization / alliance-strengthening, intelligence's
      // improved-observability / collection-expansion, trade's tariff-normalization
      // / port-reopening, industry's capacity-modernization / output-recovery,
      // governance's institutional-strengthening / policy-passage, communication's
      // network-resilience / connectivity-restoration, population's demographic-
      // recovery / labor-force-growth, and research's reproducibility-adoption /
      // grant-recovery, with law semantics from the live signals — anchored to real
      // legal-sector identifiers (RELX/LexisNexis, TRI Thomson Reuters/Westlaw, VERX
      // Vertex, CSGP) and authorities/indices (US Courts caseload, ABA, DOJ, SCOTUS,
      // World Justice Project Rule-of-Law Index). ADVISORY ONLY — wholly separate
      // from the validated P3 distress kernel.
      var _lawStabTags = null;
      if (k === 'law') {
        var _ls = _infraSignalScore(signals, LAW_STABILIZING);
        stab += _ls.score;
        _lawStabTags = _ls.tags;
      }

      stab = _clamp(stab, 0, 1);

      // ─── Net balance ───────────────────────────────────────────
      var net = _round(stab - destab);
      destab = _round(destab);
      stab = _round(stab);

      // State label
      var state = 'neutral';
      if (net > 0.08) state = 'improving';
      else if (net < -0.08) state = 'destabilizing';

      _balance[k] = {
        destabilizing: destab,
        stabilizing: stab,
        net: net,
        state: state
      };

      // Surface the civil-native pathways that drove the infrastructure score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'infrastructure') {
        _balance[k].destabilizingFactors = _infraDestabTags || [];
        _balance[k].stabilizingFactors = _infraStabTags || [];
      }

      // Surface the culture-native pathways that drove the culture score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'culture') {
        _balance[k].destabilizingFactors = _cultureDestabTags || [];
        _balance[k].stabilizingFactors = _cultureStabTags || [];
      }

      // Surface the finance-native pathways that drove the finance score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'finance') {
        _balance[k].destabilizingFactors = _financeDestabTags || [];
        _balance[k].stabilizingFactors = _financeStabTags || [];
      }

      // Surface the economy-native MACRO pathways that drove the economy score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'economy') {
        _balance[k].destabilizingFactors = _economyDestabTags || [];
        _balance[k].stabilizingFactors = _economyStabTags || [];
      }

      // Surface the technology-native pathways that drove the technology score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'technology') {
        _balance[k].destabilizingFactors = _technologyDestabTags || [];
        _balance[k].stabilizingFactors = _technologyStabTags || [];
      }

      // Surface the defense-native pathways that drove the defense score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'defense') {
        _balance[k].destabilizingFactors = _defenseDestabTags || [];
        _balance[k].stabilizingFactors = _defenseStabTags || [];
      }

      // Surface the intelligence-native pathways that drove the intelligence score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'intelligence') {
        _balance[k].destabilizingFactors = _intelligenceDestabTags || [];
        _balance[k].stabilizingFactors = _intelligenceStabTags || [];
      }

      // Surface the trade-native pathways that drove the trade score (runtime
      // key 'supplyChain') — energy parity: name the conditions, don't hide them
      // behind a scalar.
      if (k === 'supplyChain') {
        _balance[k].destabilizingFactors = _tradeDestabTags || [];
        _balance[k].stabilizingFactors = _tradeStabTags || [];
      }

      // Surface the industry-native pathways that drove the industry score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'industry') {
        _balance[k].destabilizingFactors = _industryDestabTags || [];
        _balance[k].stabilizingFactors = _industryStabTags || [];
      }

      // Surface the agriculture-native pathways that drove the agriculture score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'agriculture') {
        _balance[k].destabilizingFactors = _agricultureDestabTags || [];
        _balance[k].stabilizingFactors = _agricultureStabTags || [];
      }

      // Surface the governance-native pathways that drove the governance score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'governance') {
        _balance[k].destabilizingFactors = _governanceDestabTags || [];
        _balance[k].stabilizingFactors = _governanceStabTags || [];
      }

      // Surface the communication-native pathways that drove the communication
      // score (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'communication') {
        _balance[k].destabilizingFactors = _communicationDestabTags || [];
        _balance[k].stabilizingFactors = _communicationStabTags || [];
      }

      // Surface the population/demographic-native pathways that drove the
      // population score (energy parity: name the conditions, don't hide them
      // behind a scalar).
      if (k === 'population') {
        _balance[k].destabilizingFactors = _populationDestabTags || [];
        _balance[k].stabilizingFactors = _populationStabTags || [];
      }

      // Surface the research/science-native pathways that drove the research score
      // (runtime/snapshot key 'research'; science ↔ research) — energy parity:
      // name the conditions, don't hide them behind a scalar.
      if (k === 'research') {
        _balance[k].destabilizingFactors = _researchDestabTags || [];
        _balance[k].stabilizingFactors = _researchStabTags || [];
      }

      // Surface the law/judicial-native pathways that drove the law score
      // (energy parity: name the conditions, don't hide them behind a scalar).
      if (k === 'law') {
        _balance[k].destabilizingFactors = _lawDestabTags || [];
        _balance[k].stabilizingFactors = _lawStabTags || [];
      }

      // Detect state shift
      if (_prevState[k] !== state) {
        shifts.push({ domain: k, from: _prevState[k], to: state, net: net });
        _prevState[k] = state;
      }
    }

    window.LIMENBalance = _balance;
    _dispatch('limen:balance-update', { balance: _balance, updated: Date.now() });

    // Emit shifts
    for (var s = 0; s < shifts.length; s++) {
      _dispatch('limen:balance-shift', shifts[s]);
    }
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    _compute();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        _compute();
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      _compute();
    }
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

  function _avg(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function _stddev(arr) {
    if (arr.length < 2) return 0;
    var mean = _avg(arr);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      var diff = arr[i] - mean;
      sum += diff * diff;
    }
    return Math.sqrt(sum / arr.length);
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENBalance = _balance;

  window.LIMENBalanceMeter = {
    start: start,
    stop: stop
  };

})();
