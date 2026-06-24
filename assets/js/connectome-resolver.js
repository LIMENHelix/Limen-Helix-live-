/**
 * assets/js/connectome-resolver.js
 * LIMEN Connectome Opportunity Resolver
 *
 * Adapter layer that bridges feed domain signals into connectome node
 * activations and enriches opportunities with node-level context.
 *
 * This module is NOT a kernel. It does NOT score, classify phases,
 * compute trajectories, or act as scoring authority.
 * All scoring authority belongs to limen-helix-api/limen_backtest_kernel.js
 * (the Thing 2 lineage v4 patent kernel, extracted from bk-scorer.js).
 *
 * This module DOES:
 *   - Map feed domain IDs to connectome domain IDs
 *   - Load the 111-node directory (brain-node-domains.json)
 *   - Activate nodes based on which feed domains are stressed
 *   - Extract business mappings from node roles
 *   - Load domain detail (activations, treatments) on demand
 *   - Enrich opportunity objects with connectome context
 *   - Relay to Thing 2 v4 patent kernel via adapter chain (DISABLED)
 *
 * Flow: feed signal → connectome domain mapping → node activation
 *       → business mapping / diagnosis enrichment → enriched opportunity
 *
 * Depends on:
 *   - assets/data/brain-node-domains.json (precomputed node→domain lookup)
 *   - window.LIMENDomains (live feed state from domain-signal-engine)
 */
(function() {
'use strict';

// ═══════════════════════════════════════════════════
// 1. FEED-TO-CONNECTOME DOMAIN BRIDGE
// ═══════════════════════════════════════════════════
// Feed system uses 20 IDs. Connectome uses ~22. This bridge maps between them.

var FEED_TO_CONNECTOME = {
  // Direct matches
  economy:        ['economy'],
  energy:         ['energy'],
  environment:    ['environment'],
  // ADDITIVE (cognition port, technology gap — R&D / science research coupling):
  //   technology feed signal previously relayed through the 'technology' connectome
  //   domain ONLY. Innovation is research-coupled: R&D pipelines, AI/ML model work,
  //   and semiconductor process advances all originate in the science circuit
  //   (basic research → applied engineering). We KEEP the validated 'technology'
  //   relay (never removed) and ADD 'science' so research-origin innovation stress
  //   (R&D backlog, model-training risk, process-node breakthroughs) can propagate
  //   through the science circuit and back into the technology nodes. Keeps tech
  //   identity = chips/software/AI/cyber; science is the research coupling, not the
  //   identity. 'science' is a real connectome domain in brain-node-domains.json.
  technology:     ['technology', 'science'],
  education:      ['education'],
  governance:     ['governance'],
  industry:       ['industry'],
  infrastructure: ['infrastructure'],
  population:     ['population'],
  religion:       ['religion'],
  // Renamed / semantic mappings
  health:         ['medicine', 'metabolic'],
  // ADDITIVE (cognition port, finance gap 2 — fintech/AI-research → finance circuit):
  //   research/science stress (fintech, algo accounting, AI risk management) now
  //   activates the dedicated finance circuit in addition to the science circuit,
  //   so finance can see research-origin stress and propagate a correction.
  research:       ['science', 'finance'],
  // ADDITIVE (cognition port, law gap 1 — IP-protection + contract/credit-enforcement coupling):
  //   the law feed signal previously relayed through ['legal'] ONLY. The 'legal'
  //   connectome domain carries 123 law node-participations (legal system & courts,
  //   judiciary & rule of law, litigation & dispute resolution, regulation &
  //   compliance, contracts & enforcement, intellectual-property law, criminal
  //   justice, legal services & access to justice), but routing through the single
  //   'legal' domain meant law stress ORIGINATING in other circuits never reached the
  //   law circuit — it stayed silenced. We KEEP 'legal' FIRST as the primary domain
  //   (validated path, never removed) and ADD two coupling domains:
  //     - 'technology': captures IP-PROTECTION stress only — patent-backlog pressure,
  //       invention/patent disputes, CVE/disclosure-driven liability risk. This is the
  //       intellectual-property-law coupling (patent & invention safety), NOT compute/
  //       infrastructure; real anchors are RELX/LexisNexis & TRI/Thomson Reuters-Westlaw
  //       legal-research over patent dockets, USPTO patent-pendency indicators, and the
  //       WIPO IP filing series — indicator-based, never fabricated.
  //     - 'finance': captures CONTRACT/CREDIT-CLAIM-ENFORCEMENT stress only — credit-
  //       agreement disputes, collateral/security claims, capital-adequacy regulation
  //       and compliance (VERX/Vertex tax-&-compliance, CSGP/CoStar contract & lease
  //       enforcement context). This is the contracts-&-enforcement coupling, NOT market
  //       liquidity; anchored to US Courts caseload statistics (commercial litigation),
  //       DOJ/SCOTUS docket indices and the World Justice Project Rule-of-Law Index
  //       (regulatory-enforcement & civil-justice factors) — indicator-based, never
  //       fabricated. So law stress originating in contracts (supply-chain credit), IP
  //       (technology), or credit-claims (finance) routes through the dedicated law
  //       circuit nodes (litigation / regulatory / IP / access-to-justice) instead of
  //       being silenced. Law is kept DISTINCT from governance (policy/administration/
  //       elections), intelligence (collection/analysis) and finance (capital markets):
  //       law is the JUDICIAL / legal-system / courts / enforcement circuit. The law
  //       feed signal carries ZERO energy content — neither coupling is an energy edge.
  law:            ['legal', 'technology', 'finance'],
  // ADDITIVE (cognition port, finance gap 2 — trade finance → finance circuit):
  //   trade stress (payment systems, credit for shipments, collateral for goods)
  //   now also activates the dedicated finance circuit. Trade without trade finance
  //   = supply-chain freeze (2008, 2020 COVID); finance must see the trade signal.
  supplyChain:    ['trade', 'finance'],
  // ADDITIVE (cognition port, finance gap 1 — dedicated finance circuit):
  //   finance feed signal previously relayed through 'economy' ONLY, which made
  //   finance stress at the signal origin undershoot — it never propagated through
  //   the dedicated finance circuit. The 'finance' connectome domain exists in
  //   brain-node-domains.json (123 node-participations) but the resolver ignored it.
  //   We keep the 'economy' relay (validated path, never removed) and ADD 'finance'
  //   so the full finance circuit can activate. The sub-domain IDs in the gap spec
  //   (stock/bond/banking/forex/insurance) are intentionally NOT mapped: they are
  //   not real connectome domains in the node directory and would be dead routes
  //   that activate zero nodes. The single 'finance' connectome domain is the
  //   dedicated multi-circuit relay.
  finance:        ['economy', 'finance'],
  // ADDITIVE (cognition port, communication gap 3 — dedicated communication circuit):
  //   the communication feed signal previously relayed through ['technology'] ONLY,
  //   which BYPASSED the dedicated communication node-participations that exist in
  //   brain-node-domains.json (CC=Telecommunications, BROCA=Journalism, A1=Broadcasting,
  //   FEF=Satellite Systems, FPN=Internet Infrastructure, V1=Photography/Visual Media,
  //   dlPFC=Medialaw, NAcc=Social Media). Routing through technology alone meant
  //   communication stress at the signal origin never lit its OWN circuit — the
  //   telecom / broadcast / news-flow / platform-distribution nodes stayed inert. We
  //   KEEP the validated 'technology' relay (never removed — communication platforms
  //   depend on cloud/AI infrastructure, a coupling) and ADD the dedicated
  //   'communication' connectome domain FIRST so the telecom/broadcast/internet/
  //   social nodes activate. Communication identity = telecommunications & networks,
  //   connectivity & broadband, internet infrastructure (towers/fiber/spectrum), media
  //   & broadcasting CHANNELS, journalism & news flow, information dissemination,
  //   social-media platforms as DISTRIBUTION, public-discourse infrastructure — kept
  //   DISTINCT from technology (chips/software is a coupling, not the identity), culture
  //   (content/movements/scenes is a coupling, not the channel) and intelligence (signals
  //   collection is a coupling). Energy carries ZERO communication identity: platform
  //   scaling (META/GOOGL stress) creates downstream compute demand that routes THROUGH
  //   technology nodes for data-center efficiency — a SECONDARY coupling, never an
  //   ag/communication-to-energy origin edge; communication nodes carry zero energy content.
  communication:  ['communication', 'technology'],
  culture:        ['culture', 'religion', 'education'],
  defense:        ['governance'],
  // ADDITIVE (cognition port, intelligence gap 1 — dedicated intelligence circuit):
  //   the intelligence feed signal previously relayed through ['governance','science']
  //   ONLY, which BYPASSED the 123 dedicated intelligence node-participations that
  //   exist in brain-node-domains.json (SIGINT/HUMINT/GEOINT/OSINT collection,
  //   all-source analysis & assessment, counterintelligence, threat warning, covert
  //   action, intelligence oversight). Routing through governance/science alone meant
  //   intelligence stress at the signal origin never lit its OWN circuit. We KEEP the
  //   validated 'governance' (policy/oversight authority) and 'science' (analytic
  //   tradecraft / collection R&D) relays — never removed — and ADD the dedicated
  //   'intelligence' connectome domain so the SIGINT/HUMINT/GEOINT/OSINT nodes
  //   activate. Intelligence identity = source management, collection methods,
  //   analytic tradecraft, threat warning, covert action, counterintelligence — kept
  //   DISTINCT from defense (kinetic/industrial/readiness) and from technology (cyber
  //   tooling is a coupling, not the identity). 'intelligence' is a real connectome
  //   domain in brain-node-domains.json (123 node-participations).
  intelligence:   ['intelligence', 'governance', 'science'],
  // ADDITIVE (cognition port, agriculture gap 4 — dedicated agriculture circuit):
  //   the agriculture feed signal previously relayed through ['environment','trade']
  //   ONLY, which BYPASSED the 123 dedicated agriculture node-participations that
  //   exist in brain-node-domains.json under the 'p2' connectome domain (Crop
  //   Production, Crop Protection, Livestock Production, Fertilizers & Nutrients,
  //   Seeds & Genetics, Irrigation Management, Agricultural Machinery, Precision
  //   Agriculture, Agricultural Finance, Commodity Markets, Food Processing, Land
  //   Use, Climate & Weather). Routing through environment/trade alone meant
  //   agriculture stress at the signal origin never lit its OWN circuit — Crop,
  //   Livestock, Farm-Finance and Machinery node clusters stayed inert. We ADD the
  //   dedicated 'p2' connectome domain FIRST (production-level coupling) so those
  //   nodes activate, KEEP 'trade' (commodity-exchange / livestock-trade / ag-tariff
  //   coupling — never removed) and KEEP 'environment' (soil/water/climate IMPACT on
  //   ag output, a coupling, not ag-origin stress). Agriculture identity = farming &
  //   crops, livestock & animal protein, agribusiness & food production, fertilizers
  //   & crop inputs, irrigation & agricultural water, commodity crops (corn/soy/
  //   wheat), agricultural technology & precision ag, farm economics — kept DISTINCT
  //   from environment (land/water/climate is a coupling), trade (export logistics is
  //   a coupling) and economy (food prices is a coupling). Energy is NEVER a feed
  //   domain for agriculture — only a downstream CONSEQUENCE (mechanization /
  //   fertilizer-synthesis OpEx on industrial/transport DEMAND), never ag-origin.
  //   'p2' is the real agriculture connectome domain in brain-node-domains.json
  //   (123 node-participations).
  agriculture:    ['p2', 'trade', 'environment']
};

// ═══════════════════════════════════════════════════
// 1b. MACRO INDICATOR SERIES BINDING (ADDITIVE — economy gap 1)
// ═══════════════════════════════════════════════════
// The resolver maps feed domains → connectome domains → node activations, but
// previously held NO explicit binding of REAL macro statistics to the specific
// connectome nodes that sense them. Economy is the MACRO AGGREGATE and stays
// DISTINCT from finance (capital markets / credit / banks). This registry binds
// REAL FRED series IDs + broad-market index proxies (never single-company
// tickers, never fabricated) to the economy connectome nodes they sense, so the
// kernel/reporting/diagnosis layers can drill from abstract 'economy stress'
// into the ACTUAL economic statistic that triggered it
// (e.g. labor-markets node activated → UNRATE spiked → unemployment-shock origin).
//
// Each entry: { series, node, role (macro identity label), nodeRole (the real
// role the node plays in brain-node-domains.json), label, threshold, dir,
// kind ('fred' | 'market'), policyPath }.
//   - threshold = the macro level above/below which the node is considered stressed.
//   - dir = 'high' (stress when value ABOVE threshold) | 'low' (stress when BELOW).
//   - policyPath = 'fiscal' | 'monetary' | 'market' | 'real' (see gap 2 split).
// This is annotation/registry metadata ONLY — the resolver does NOT score it.
var MACRO_INDICATOR_BINDING = {
  // ── Growth / output (real economy) ──
  GDPC1:    { series: 'GDPC1',    node: 'LGN',   role: 'GDP Output',            nodeRole: 'Agricultural Finance Assessment & Diagnostics', label: 'Real GDP',               threshold: -2.5,    dir: 'low',  kind: 'fred',   policyPath: 'real' },
  GDP:      { series: 'GDP',      node: 'LGN',   role: 'GDP Output',            nodeRole: 'Agricultural Finance Assessment & Diagnostics', label: 'Nominal GDP',            threshold: 0,       dir: 'low',  kind: 'fred',   policyPath: 'real' },
  INDPRO:   { series: 'INDPRO',   node: 'STN',   role: 'Industrial Production', nodeRole: 'Efficiency Modeling Systems',                  label: 'Industrial Production',  threshold: -2,      dir: 'low',  kind: 'fred',   policyPath: 'real' },
  // ── Inflation (price stability) ──
  CPIAUCSL: { series: 'CPIAUCSL', node: 'HPA',   role: 'Inflation & Deflation', nodeRole: 'Agricultural Trade — Optimization & Innovation', label: 'CPI',                  threshold: 3.2,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  PCEPI:    { series: 'PCEPI',    node: 'HPA',   role: 'Inflation & Deflation', nodeRole: 'Agricultural Trade — Optimization & Innovation', label: 'PCE Deflator',         threshold: 2.5,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  // ── Employment / labor markets ──
  UNRATE:   { series: 'UNRATE',   node: 'RSC',   role: 'Labor Markets',         nodeRole: 'Crop Economics Technology & Innovation',       label: 'Unemployment Rate',      threshold: 5.5,     dir: 'high', kind: 'fred',   policyPath: 'real' },
  PAYEMS:   { series: 'PAYEMS',   node: 'RSC',   role: 'Labor Markets',         nodeRole: 'Crop Economics Technology & Innovation',       label: 'Nonfarm Payrolls',       threshold: -200000, dir: 'low',  kind: 'fred',   policyPath: 'real' },
  // ── Sentiment (consumer / business) ──
  UMCSENT:  { series: 'UMCSENT',  node: 'mPFC',  role: 'Consumer Spending',     nodeRole: 'Benchmarking',                                 label: 'Consumer Sentiment',     threshold: 60,      dir: 'low',  kind: 'fred',   policyPath: 'real' },
  // ── Monetary policy (Fed / central bank / rates) ──
  FEDFUNDS: { series: 'FEDFUNDS', node: 'STS',   role: 'Monetary Policy',       nodeRole: 'Baseline Calibration Operations',              label: 'Fed Funds Rate',         threshold: 5.5,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  DGS10:    { series: 'DGS10',    node: 'STS',   role: 'Monetary Policy',       nodeRole: 'Baseline Calibration Operations',              label: '10Y Treasury Yield',     threshold: 4.5,     dir: 'high', kind: 'fred',   policyPath: 'monetary' },
  // ── Broad-market proxies (index ETFs — NOT single companies) ──
  SPY:      { series: 'SPY',      node: 'ASTRO', role: 'Capital Markets',       nodeRole: 'econ livestock — Signal Acquisition',          label: 'Broad Market (S&P 500)', threshold: -15,     dir: 'low',  kind: 'market', policyPath: 'market' },
  DIA:      { series: 'DIA',      node: 'NTS',   role: 'Capital Markets',       nodeRole: 'Protocol Development Evaluation',               label: 'Equity Risk (Dow 30)',   threshold: -12,     dir: 'low',  kind: 'market', policyPath: 'market' },
  TLT:      { series: 'TLT',      node: 'BDNF',  role: 'Debt Markets',          nodeRole: 'Agricultural Finance Infrastructure & Capacity', label: 'Long Yields (20Y+ Tsy)', threshold: 4.5,    dir: 'high', kind: 'market', policyPath: 'market' },
  GLD:      { series: 'GLD',      node: 'PUT',   role: 'Safe-Haven Hedge',      nodeRole: 'Land Tenure — Optimization & Innovation',      label: 'Gold Hedge',             threshold: 2000,    dir: 'high', kind: 'market', policyPath: 'market' },

  // ── TECHNOLOGY SECTOR macro indicators (technology gap 1 — ADDITIVE) ──
  // Sector ETF proxies measuring TECH IDENTITY (chips, cloud, AI infrastructure,
  // innovation pipeline), NOT energy feedstock. When these deteriorate the stress
  // routes through the TECH connectome nodes (dlPFC software, M1 hardware,
  // AI deployment, vlPFC innovation/training). Energy coupling is a downstream
  // CONSEQUENCE (compute cost/capacity stress → data-center power visibility),
  // so these stay routed to the hardware/compute nodes — never to the energy
  // domain's own content. Annotation/registry metadata ONLY — the resolver does
  // NOT score these.
  XLK:  { series: 'XLK',  node: 'dlPFC', role: 'Enterprise Software Health',     nodeRole: 'Software Engineering',                     label: 'Tech Sector (XLK SPDR)',      threshold: -10, dir: 'low', kind: 'market', policyPath: 'market' },
  IXN:  { series: 'IXN',  node: 'M1',    role: 'Hardware Supply Health',         nodeRole: 'Hardware Design',                          label: 'Global Tech (IXN iShares)',   threshold: -12, dir: 'low', kind: 'market', policyPath: 'market' },
  FTAG: { series: 'FTAG', node: 'AI',    role: 'AI Training Infrastructure',     nodeRole: 'Deployment Optimization Core Operations',  label: 'AI Infrastructure (FTAG)',    threshold: -15, dir: 'low', kind: 'market', policyPath: 'market' },
  VGT:  { series: 'VGT',  node: 'vlPFC', role: 'Innovation Pipeline Capacity',   nodeRole: 'AI Training Infrastructure & Capacity',    label: 'Innovation Pipeline (VGT)',   threshold: -8,  dir: 'low', kind: 'market', policyPath: 'market' }
};

// ── TECHNOLOGY COMPANY ticker bindings (technology gap 2 — ADDITIVE, OPT-IN) ──
// Parallel to MACRO_INDICATOR_BINDING. NOT merged into the default resolve()
// pipeline and NOT included in NODE_TO_MACRO_INDICATOR — consumed ONLY when a
// context explicitly triggers a tech-company-level drill (getTechCompaniesForNode
// / TECH_COMPANY_BINDING export). Each ticker traces COMPUTE SOURCING to a node:
// ticker stress (dir 'low' for all — stress on decline) estimates COMPUTE
// EFFICIENCY DEGRADATION (NVDA decline = GPU scarcity → inference deferred to
// higher-power older chips; ASML/TSM decline = leading-edge fab capacity
// constrained → less power-efficient designs). Energy is the consequence, never
// the identity. REAL tickers only.
var TECH_COMPANY_BINDING = {
  NVDA:  { series: 'NVDA',  node: 'M1',    role: 'Compute/GPU Silicon Supply',        nodeRole: 'Hardware Design',                          label: 'NVIDIA',             threshold: -20, dir: 'low', kind: 'ticker', industry: 'semiconductor' },
  MSFT:  { series: 'MSFT',  node: 'dlPFC', role: 'Enterprise Software Distribution',  nodeRole: 'Software Engineering',                     label: 'Microsoft',          threshold: -15, dir: 'low', kind: 'ticker', industry: 'software' },
  GOOGL: { series: 'GOOGL', node: 'AI',    role: 'Foundation Model Training Scale',   nodeRole: 'Deployment Optimization Core Operations',  label: 'Alphabet',           threshold: -18, dir: 'low', kind: 'ticker', industry: 'ai' },
  META:  { series: 'META',  node: 'AI',    role: 'Compute Infrastructure Edge',       nodeRole: 'Deployment Optimization Core Operations',  label: 'Meta Platforms',     threshold: -22, dir: 'low', kind: 'ticker', industry: 'ai' },
  AMZN:  { series: 'AMZN',  node: 'M1',    role: 'Cloud Infrastructure Backbone',     nodeRole: 'Hardware Design',                          label: 'Amazon',             threshold: -17, dir: 'low', kind: 'ticker', industry: 'cloud' },
  CRWD:  { series: 'CRWD',  node: 'rPFC',  role: 'Cybersecurity Defense Activation',  nodeRole: 'optimization diag — Intervention Planning', label: 'CrowdStrike',       threshold: -25, dir: 'low', kind: 'ticker', industry: 'security' },
  PANW:  { series: 'PANW',  node: 'vlPFC', role: 'Network Security Innovation',       nodeRole: 'AI Training Infrastructure & Capacity',    label: 'Palo Alto Networks', threshold: -23, dir: 'low', kind: 'ticker', industry: 'security' },
  TSM:   { series: 'TSM',   node: 'M1',    role: 'Advanced Chip Foundry Capacity',    nodeRole: 'Hardware Design',                          label: 'TSMC',               threshold: -16, dir: 'low', kind: 'ticker', industry: 'semiconductor' },
  ASML:  { series: 'ASML',  node: 'vlPFC', role: 'EDA/Fab Tooling Scarcity',          nodeRole: 'AI Training Infrastructure & Capacity',    label: 'ASML',               threshold: -19, dir: 'low', kind: 'ticker', industry: 'semiconductor' }
};

// Reverse lookup: connectome node → tech company tickers it sources from
// (opt-in tech-company drill, parallel to NODE_TO_MACRO_INDICATOR).
var NODE_TO_TECH_COMPANY = {};
for (var _tk in TECH_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(TECH_COMPANY_BINDING, _tk)) continue;
  var _tb = TECH_COMPANY_BINDING[_tk];
  if (!NODE_TO_TECH_COMPANY[_tb.node]) NODE_TO_TECH_COMPANY[_tb.node] = [];
  NODE_TO_TECH_COMPANY[_tb.node].push(_tb);
}

// ── INTELLIGENCE-SECTOR COMPANY ticker bindings (intelligence gap 2 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING (and to MACRO_INDICATOR_BINDING). NOT merged into
// the default resolve() pipeline and NOT included in NODE_TO_MACRO_INDICATOR —
// consumed ONLY when a context explicitly triggers an intelligence-company-level
// drill (getIntelCompaniesForNode / INTELLIGENCE_COMPANY_BINDING export). Each ticker
// traces TRADECRAFT CAPACITY to a real intelligence connectome node: ticker stress
// (dir 'low' for all — stress on decline) estimates a DEGRADATION OF INTELLIGENCE
// CAPABILITY (PLTR decline = fusion/all-source platform capacity constrained;
// SAIC decline = source-management / collection-strategy capacity; A1/SIGINT-class
// vendors decline = signal-processing throughput). Energy is PURELY downstream
// (data-center infrastructure for compute), NEVER the sector identity — intelligence
// nodes carry zero energy-domain content. REAL intelligence-sector tickers only.
//   PLTR → all-source fusion/analysis   BAH → counterintelligence services
//   LDOS → threat assessment/SIGINT     CACI → analytical tooling
//   SAIC → collection strategy/sourcing KBR → mission infrastructure/capacity
//   VRNT → signals/cyber intelligence   NICE → signal processing/analytics
//   VRSK → scenario/threat analytics
var INTELLIGENCE_COMPANY_BINDING = {
  PLTR: { series: 'PLTR', node: 'LC',   role: 'All-Source Fusion Platform Capacity',     nodeRole: 'Allsource Core Operations',                  label: 'Palantir',                threshold: -22, dir: 'low', kind: 'ticker', industry: 'allsource-analysis' },
  BAH:  { series: 'BAH',  node: 'BLA',  role: 'Counterintelligence Services Capacity',   nodeRole: 'Counterintelligence',                        label: 'Booz Allen Hamilton',     threshold: -16, dir: 'low', kind: 'ticker', industry: 'counterintelligence' },
  LDOS: { series: 'LDOS', node: 'dACC', role: 'Threat Assessment / SIGINT Systems',      nodeRole: 'Threat Assessment',                          label: 'Leidos',                  threshold: -17, dir: 'low', kind: 'ticker', industry: 'threat-assessment' },
  CACI: { series: 'CACI', node: 'CC',   role: 'Analytical Tooling / Tradecraft Tech',    nodeRole: 'Analytical Tools Technology & Innovation',   label: 'CACI International',       threshold: -18, dir: 'low', kind: 'ticker', industry: 'analytical-tools' },
  SAIC: { series: 'SAIC', node: 'BBB',  role: 'Collection Strategy / Source Management',  nodeRole: 'Collection Strategy — Implementation & Strategy — Workforce Alignment', label: 'SAIC', threshold: -19, dir: 'low', kind: 'ticker', industry: 'collection-strategy' },
  KBR:  { series: 'KBR',  node: 'M1',   role: 'Mission Infrastructure & Capacity',        nodeRole: 'Current Intelligence Infrastructure & Capacity', label: 'KBR',                 threshold: -20, dir: 'low', kind: 'ticker', industry: 'infrastructure' },
  VRNT: { series: 'VRNT', node: 'A1',   role: 'Signals / Cyber Intelligence Capacity',    nodeRole: 'SIGINT / Signals Intelligence',              label: 'Verint Systems',          threshold: -24, dir: 'low', kind: 'ticker', industry: 'sigint' },
  NICE: { series: 'NICE', node: 'OXY',  role: 'Signal Processing / Detection Analytics',  nodeRole: 'Allsource — Signal Detection',               label: 'NICE Ltd',                threshold: -21, dir: 'low', kind: 'ticker', industry: 'signal-processing' },
  VRSK: { series: 'VRSK', node: 'HPA',  role: 'Scenario / Threat Analytics Capacity',     nodeRole: 'Scenario Analysis Infrastructure & Capacity', label: 'Verisk Analytics',       threshold: -15, dir: 'low', kind: 'ticker', industry: 'scenario-analysis' }
};

// Reverse lookup: connectome node → intelligence-sector company tickers it sources
// from (opt-in intel-company drill, parallel to NODE_TO_TECH_COMPANY).
var NODE_TO_INTEL_COMPANY = {};
for (var _ik in INTELLIGENCE_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(INTELLIGENCE_COMPANY_BINDING, _ik)) continue;
  var _ib = INTELLIGENCE_COMPANY_BINDING[_ik];
  if (!NODE_TO_INTEL_COMPANY[_ib.node]) NODE_TO_INTEL_COMPANY[_ib.node] = [];
  NODE_TO_INTEL_COMPANY[_ib.node].push(_ib);
}

// ── TRADE-SECTOR (SUPPLY CHAIN) COMPANY ticker bindings (trade gap — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING and INTELLIGENCE_COMPANY_BINDING (and to
// MACRO_INDICATOR_BINDING). NOT merged into the default resolve() pipeline and NOT
// included in NODE_TO_MACRO_INDICATOR — consumed ONLY when a context explicitly
// triggers a trade-company-level drill (getTradeCompaniesForNode /
// TRADE_COMPANY_BINDING export). Each ticker traces LOGISTICS / SUPPLY CAPACITY to a
// REAL trade connectome node (nodes are the actual trade-domain participations in
// brain-node-domains.json: NTS=container shipping, FEF=air freight, M1=trucking,
// THAL=port ops, OFC=customs/tariffs, dlPFC=supply-chain planning, CC=freight
// forwarding). Ticker stress (dir 'low' for all — stress on decline) estimates
// LOGISTICS/SUPPLY CAPACITY DEGRADATION (shipping delays, fuel-hedging cost pass-
// through, customs backlog, container shortage, port congestion). This is TRADE
// identity = international commerce, freight, ports, customs, supply chains — NOT
// energy. Fuel-cost pass-through is a downstream CONSEQUENCE of freight stress, never
// the signal origin; trade nodes carry zero energy-domain content. Export-control
// shocks (semiconductors, food, dual-use) are TRADE-specific stressors here. REAL
// trade/logistics tickers only.
//   FDX/UPS → air-freight & parcel    EXPD/CHRW → 3PL freight forwarding
//   ZIM/MATX/AMKBY → container-shipping  XPO/ODFL → trucking / LTL
//   GXO → contract logistics/warehousing  DSDVY → global 3PL / customs
var TRADE_COMPANY_BINDING = {
  FDX:   { series: 'FDX',   node: 'FEF',   role: 'Air-Freight / Express Parcel Capacity',   nodeRole: 'Air Freight',               label: 'FedEx',                  threshold: -18, dir: 'low', kind: 'ticker', industry: 'air-freight' },
  UPS:   { series: 'UPS',   node: 'FEF',   role: 'Integrated Air & Ground Parcel Capacity', nodeRole: 'Air Freight',               label: 'United Parcel Service',  threshold: -16, dir: 'low', kind: 'ticker', industry: 'air-freight' },
  EXPD:  { series: 'EXPD',  node: 'CC',    role: 'Freight Forwarding / 3PL Capacity',       nodeRole: 'Freight Forwarding',        label: 'Expeditors International', threshold: -17, dir: 'low', kind: 'ticker', industry: '3pl' },
  CHRW:  { series: 'CHRW',  node: 'CC',    role: 'Brokered Freight / 3PL Capacity',         nodeRole: 'Freight Forwarding',        label: 'C.H. Robinson',          threshold: -19, dir: 'low', kind: 'ticker', industry: '3pl' },
  ZIM:   { series: 'ZIM',   node: 'NTS',   role: 'Container Liner Vessel Capacity',         nodeRole: 'Container Shipping',        label: 'ZIM Integrated Shipping', threshold: -28, dir: 'low', kind: 'ticker', industry: 'container-shipping' },
  MATX:  { series: 'MATX',  node: 'NTS',   role: 'Pacific Container Shipping Capacity',      nodeRole: 'Container Shipping',        label: 'Matson',                 threshold: -20, dir: 'low', kind: 'ticker', industry: 'container-shipping' },
  AMKBY: { series: 'AMKBY', node: 'THAL',  role: 'Global Container Alliance & Port Capacity', nodeRole: 'Port Operations',          label: 'A.P. Moller-Maersk',     threshold: -22, dir: 'low', kind: 'ticker', industry: 'container-shipping' },
  XPO:   { series: 'XPO',   node: 'M1',    role: 'Less-Than-Truckload Freight Capacity',    nodeRole: 'Trucking',                  label: 'XPO',                    threshold: -23, dir: 'low', kind: 'ticker', industry: 'trucking' },
  ODFL:  { series: 'ODFL',  node: 'M1',    role: 'LTL Trucking Network Capacity',           nodeRole: 'Trucking',                  label: 'Old Dominion Freight Line', threshold: -18, dir: 'low', kind: 'ticker', industry: 'trucking' },
  GXO:   { series: 'GXO',   node: 'HIPP',  role: 'Contract Logistics / Warehousing Capacity', nodeRole: 'Warehousing',             label: 'GXO Logistics',          threshold: -21, dir: 'low', kind: 'ticker', industry: '3pl' },
  DSDVY: { series: 'DSDVY', node: 'OFC',   role: 'Global 3PL / Customs-Clearance Capacity', nodeRole: 'Customs & Tariffs',         label: 'DSV A/S',                threshold: -20, dir: 'low', kind: 'ticker', industry: 'customs-compliance' }
};

// Reverse lookup: connectome node → trade-sector company tickers it sources from
// (opt-in trade-company drill, parallel to NODE_TO_TECH_COMPANY / NODE_TO_INTEL_COMPANY).
var NODE_TO_TRADE_COMPANY = {};
for (var _trk in TRADE_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(TRADE_COMPANY_BINDING, _trk)) continue;
  var _trb = TRADE_COMPANY_BINDING[_trk];
  if (!NODE_TO_TRADE_COMPANY[_trb.node]) NODE_TO_TRADE_COMPANY[_trb.node] = [];
  NODE_TO_TRADE_COMPANY[_trb.node].push(_trb);
}

// ── INDUSTRIAL-SECTOR (MANUFACTURING & CAPITAL GOODS) COMPANY ticker bindings (industry gap — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING and
// TRADE_COMPANY_BINDING (and to MACRO_INDICATOR_BINDING). NOT merged into the default
// resolve() pipeline and NOT included in NODE_TO_MACRO_INDICATOR — consumed ONLY when
// a context explicitly triggers an industrial-company-level drill
// (getIndustrialCompaniesForNode / INDUSTRIAL_COMPANY_BINDING export). Each ticker
// traces MANUFACTURING & INDUSTRIAL-PRODUCTION CAPACITY to a REAL industry connectome
// node (nodes are the actual industry-domain participations in brain-node-domains.json:
// SMA=heavy equipment, LC/GBA=systems integration, BNST=assembly automation,
// GABA_GLU/VP=robot programming, M1=assembly lines, BLA=assembly-line R&D,
// FPN=precision machining, PCC=flow optimization). Ticker stress (dir 'low' for all —
// stress on decline) estimates FACTORY OUTPUT / CAPACITY-UTILIZATION DEGRADATION:
// a CAT decline = construction/mining-equipment orders collapse → manufacturing volume
// falls → factory utilization drops; a GE/GEV decline = power-generation & industrial-
// controls demand softens; a ROK/EMR/HON decline = factory-automation capex pulls back.
// This is INDUSTRIAL identity = manufacturing, factory output, automation & robotics,
// heavy industry, machinery & equipment, industrial maintenance — DISTINCT from trade
// (logistics/commerce), economy (macro aggregate) and technology (automation is a
// COUPLING, not the identity). ENERGY is PURELY a downstream COUPLING, never the
// identity: when industrial output falls, the affected factory's base-load power,
// compressed air and process-heating demand fall with it — but industry nodes carry
// ZERO energy-domain content (no oil/gas production, no grid ops). REAL industrial /
// capital-goods tickers only.
//   CAT → construction/mining heavy equipment   DE → ag & construction machinery
//   GE → aero/power systems integration          GEV → power-generation equipment
//   HON → industrial automation & controls       MMM → diversified industrial/materials R&D
//   EMR → process automation & controls          ITW → diversified industrial machinery
//   ETN → electrical/power-management systems     PH → motion & flow control
//   ROK → factory automation & robotics          DOV → precision industrial machining
var INDUSTRIAL_COMPANY_BINDING = {
  CAT: { series: 'CAT', node: 'SMA',      role: 'Heavy-Equipment Manufacturing Capacity',    nodeRole: 'Heavy Equipment',                              label: 'Caterpillar',          threshold: -20, dir: 'low', kind: 'ticker', industry: 'heavy-equipment' },
  DE:  { series: 'DE',  node: 'SMA',      role: 'Ag & Construction Machinery Capacity',      nodeRole: 'Heavy Equipment',                              label: 'Deere & Company',      threshold: -18, dir: 'low', kind: 'ticker', industry: 'heavy-equipment' },
  GE:  { series: 'GE',  node: 'LC',       role: 'Power-Generation & Industrial Systems Integration', nodeRole: 'Systems Integration Quality & Performance', label: 'GE Aerospace',     threshold: -19, dir: 'low', kind: 'ticker', industry: 'systems-integration' },
  GEV: { series: 'GEV', node: 'GBA',      role: 'Power-Generation Equipment Capacity',       nodeRole: 'Systems Integration Core Operations',          label: 'GE Vernova',           threshold: -24, dir: 'low', kind: 'ticker', industry: 'power-equipment' },
  HON: { series: 'HON', node: 'BNST',     role: 'Industrial Automation & Controls Capacity', nodeRole: 'Assembly Automation Technology & Innovation',   label: 'Honeywell',            threshold: -16, dir: 'low', kind: 'ticker', industry: 'industrial-automation' },
  MMM: { series: 'MMM', node: 'BLA',      role: 'Diversified Industrial / Materials R&D Capacity', nodeRole: 'Assembly Lines Research & Development',    label: '3M',                   threshold: -17, dir: 'low', kind: 'ticker', industry: 'diversified-industrial' },
  EMR: { series: 'EMR', node: 'GABA_GLU', role: 'Process Automation & Controls Capacity',    nodeRole: 'Robot Programming Infrastructure & Capacity',   label: 'Emerson Electric',     threshold: -18, dir: 'low', kind: 'ticker', industry: 'process-automation' },
  ITW: { series: 'ITW', node: 'M1',       role: 'Diversified Industrial Machinery Capacity',  nodeRole: 'Assembly Lines',                              label: 'Illinois Tool Works',  threshold: -19, dir: 'low', kind: 'ticker', industry: 'industrial-machinery' },
  ETN: { series: 'ETN', node: 'PCC',      role: 'Electrical / Power-Management Systems Capacity', nodeRole: 'Flow Optimization Technology & Innovation', label: 'Eaton',              threshold: -21, dir: 'low', kind: 'ticker', industry: 'power-management' },
  PH:  { series: 'PH',  node: 'FPN',      role: 'Motion & Flow Control Manufacturing Capacity', nodeRole: 'Precision Machining',                       label: 'Parker Hannifin',      threshold: -20, dir: 'low', kind: 'ticker', industry: 'motion-control' },
  ROK: { series: 'ROK', node: 'VP',       role: 'Factory Automation & Robotics Capacity',    nodeRole: 'Robot Programming Core Operations',            label: 'Rockwell Automation',  threshold: -23, dir: 'low', kind: 'ticker', industry: 'factory-automation' },
  DOV: { series: 'DOV', node: 'BDNF',     role: 'Precision Industrial Machining Capacity',   nodeRole: 'Assembly Robots Risk & Resilience',            label: 'Dover',                threshold: -18, dir: 'low', kind: 'ticker', industry: 'precision-machining' }
};

// Reverse lookup: connectome node → industrial-sector company tickers it sources from
// (opt-in industrial-company drill, parallel to NODE_TO_TECH_COMPANY /
// NODE_TO_INTEL_COMPANY / NODE_TO_TRADE_COMPANY).
var NODE_TO_INDUSTRIAL_COMPANY = {};
for (var _idk in INDUSTRIAL_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(INDUSTRIAL_COMPANY_BINDING, _idk)) continue;
  var _idb = INDUSTRIAL_COMPANY_BINDING[_idk];
  if (!NODE_TO_INDUSTRIAL_COMPANY[_idb.node]) NODE_TO_INDUSTRIAL_COMPANY[_idb.node] = [];
  NODE_TO_INDUSTRIAL_COMPANY[_idb.node].push(_idb);
}

// ── ENVIRONMENT-SECTOR (WASTE / WATER / EMISSIONS / CLIMATE-INFRA) COMPANY ticker bindings (environment gap 1 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_BINDING
// and INDUSTRIAL_COMPANY_BINDING (and to MACRO_INDICATOR_BINDING). NOT merged into the
// default resolve() pipeline and NOT included in NODE_TO_MACRO_INDICATOR — consumed ONLY
// when a context explicitly triggers an environment-company-level drill
// (getEnvironmentCompaniesForNode / ENVIRONMENT_SECTOR_COMPANY_BINDING export). Each
// ticker traces ENVIRONMENTAL-SERVICE / ENVIRONMENTAL-INFRASTRUCTURE CAPACITY to a REAL
// environment connectome node (nodes are the actual environment-domain participations in
// brain-node-domains.json: dACC=pollution control, CeA=soil/remediation, GABA_GLU=envlaw/
// compliance, DV=water cycles, NTS=ocean chemistry, PBN=atmospheric regulation,
// VTA=renewable resources, HYPO=climate systems). Ticker stress (dir 'low' for all —
// stress on decline) estimates an ENVIRONMENTAL-CAPACITY DEGRADATION that is PURE
// environmental identity: a WM/RSG decline = waste-routing / landfill-processing capacity
// constrained → collection & disposal bottleneck; an AWK/WTRG decline = water-supply /
// distribution & treatment-compliance capacity strained → advanced-treatment OpEx; an
// XYL/ECL decline = water-treatment-technology / emissions-chemistry capacity pulls back →
// scrubber & treatment efficiency drag; a LIN/APD decline = industrial-gas / air-quality
// emission-control capacity tightens → capture & abatement throughput; a DAR decline =
// waste/byproduct-to-resource sustainability capacity falls; an AY decline = climate /
// clean infrastructure capacity softens. This is ENVIRONMENT identity = waste management
// & remediation, water quality & treatment, air/emissions control, carbon/climate
// infrastructure — DISTINCT from energy (no oil/gas production, no grid ops, no power
// generation), DISTINCT from agriculture (land/water USE is a coupling), and DISTINCT from
// industry (capital goods). ENERGY is PURELY a downstream SECOND-ORDER consequence, never
// the identity: when waste/water/emissions stress drives higher treatment/control OpEx,
// facility power & cooling demand can spike — but environment nodes carry ZERO
// energy-domain content and energy is NEVER the initiating signal. REAL environmental-
// sector tickers only.
//   WM/RSG/WCN/CWST → waste management infrastructure / ops / capacity / logistics
//   AWK/WTRG        → water supply quality / distribution & compliance
//   XYL/ECL         → water-treatment technology / water-chemistry & emissions treatment
//   LIN/APD         → emissions capture (industrial gases) / air-quality emissions control
//   DAR             → waste & byproduct-to-resource sustainability
//   AY              → climate / clean infrastructure
var ENVIRONMENT_SECTOR_COMPANY_BINDING = {
  WM:   { series: 'WM',   node: 'dACC',     role: 'Waste-Management Infrastructure Capacity',   nodeRole: 'Pollution Control',           label: 'Waste Management Inc.',     threshold: -15, dir: 'low', kind: 'ticker', industry: 'waste-management' },
  RSG:  { series: 'RSG',  node: 'dACC',     role: 'Waste Collection & Disposal Ops Capacity',   nodeRole: 'Pollution Control',           label: 'Republic Services',         threshold: -16, dir: 'low', kind: 'ticker', industry: 'waste-management' },
  WCN:  { series: 'WCN',  node: 'CeA',      role: 'Waste / Landfill Processing Capacity',       nodeRole: 'Soilenv',                     label: 'Waste Connections',         threshold: -17, dir: 'low', kind: 'ticker', industry: 'waste-management' },
  CWST: { series: 'CWST', node: 'GABA_GLU', role: 'Waste Logistics & Compliance Capacity',      nodeRole: 'Envlaw',                      label: 'Casella Waste Systems',     threshold: -22, dir: 'low', kind: 'ticker', industry: 'waste-logistics' },
  AWK:  { series: 'AWK',  node: 'DV',       role: 'Water Supply & Quality Capacity',            nodeRole: 'Water Cycles',                label: 'American Water Works',      threshold: -14, dir: 'low', kind: 'ticker', industry: 'water-utility' },
  WTRG: { series: 'WTRG', node: 'DV',       role: 'Water Distribution & Compliance Capacity',   nodeRole: 'Water Cycles',                label: 'Essential Utilities',       threshold: -16, dir: 'low', kind: 'ticker', industry: 'water-utility' },
  XYL:  { series: 'XYL',  node: 'NTS',      role: 'Water-Treatment Technology Capacity',        nodeRole: 'Ocean Chemistry',             label: 'Xylem',                     threshold: -18, dir: 'low', kind: 'ticker', industry: 'water-technology' },
  ECL:  { series: 'ECL',  node: 'NTS',      role: 'Water-Chemistry & Emissions-Treatment Capacity', nodeRole: 'Ocean Chemistry',         label: 'Ecolab',                    threshold: -15, dir: 'low', kind: 'ticker', industry: 'water-chemistry' },
  LIN:  { series: 'LIN',  node: 'PBN',      role: 'Emissions Capture / Industrial-Gas Capacity', nodeRole: 'Atmospheric Regulation',     label: 'Linde',                     threshold: -16, dir: 'low', kind: 'ticker', industry: 'emissions-control' },
  APD:  { series: 'APD',  node: 'PBN',      role: 'Air-Quality / Emissions-Control Capacity',   nodeRole: 'Atmospheric Regulation',      label: 'Air Products & Chemicals',  threshold: -17, dir: 'low', kind: 'ticker', industry: 'emissions-control' },
  DAR:  { series: 'DAR',  node: 'VTA',      role: 'Waste / Byproduct Sustainability Capacity',  nodeRole: 'Renewable Resources',         label: 'Darling Ingredients',       threshold: -20, dir: 'low', kind: 'ticker', industry: 'circular-economy' },
  AY:   { series: 'AY',   node: 'HYPO',     role: 'Climate / Clean Infrastructure Capacity',    nodeRole: 'Climate Systems',             label: 'Atlantica Sustainable Infrastructure', threshold: -19, dir: 'low', kind: 'ticker', industry: 'climate-infrastructure' }
};

// Reverse lookup: connectome node → environment-sector company tickers it sources from
// (opt-in environment-company drill, parallel to NODE_TO_TECH_COMPANY /
// NODE_TO_INTEL_COMPANY / NODE_TO_TRADE_COMPANY / NODE_TO_INDUSTRIAL_COMPANY).
var NODE_TO_ENVIRONMENT_COMPANY = {};
for (var _envk in ENVIRONMENT_SECTOR_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(ENVIRONMENT_SECTOR_COMPANY_BINDING, _envk)) continue;
  var _envb = ENVIRONMENT_SECTOR_COMPANY_BINDING[_envk];
  if (!NODE_TO_ENVIRONMENT_COMPANY[_envb.node]) NODE_TO_ENVIRONMENT_COMPANY[_envb.node] = [];
  NODE_TO_ENVIRONMENT_COMPANY[_envb.node].push(_envb);
}

// ── GOVERNANCE-SECTOR (GOVTECH / PUBLIC-SECTOR SERVICES) COMPANY ticker bindings (governance gap 1 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_BINDING,
// INDUSTRIAL_COMPANY_BINDING and ENVIRONMENT_SECTOR_COMPANY_BINDING (and to
// MACRO_INDICATOR_BINDING). NOT merged into the default resolve() pipeline and NOT
// included in NODE_TO_MACRO_INDICATOR — consumed ONLY when a context explicitly
// triggers a governance-company-level drill (getGovernanceSectorCompaniesForNode /
// GOVERNANCE_COMPANY_BINDING export). Governance binds mostly to INSTITUTIONS &
// INDICATORS, not single companies; where service-delivery CAPACITY needs a concrete
// vendor we use REAL govtech / public-sector contractors mapped to the actual
// governance connectome node that senses their delivery surface (nodes are the real
// governance-domain participations in brain-node-domains.json: dlPFC=executive
// authority, STRI=treasury/fiscal ops, dACC=regulatory oversight, NAcc=electoral
// systems, ECN=public administration, vmPFC=policy formation, V1=technology
// integration). Ticker stress (dir 'low' for all — stress on decline) estimates a
// DEGRADATION OF GOVERNANCE SERVICE-DELIVERY CAPACITY: a TYL decline = court / permit /
// licensing case-management capacity constrained; an MMS decline = benefits-delivery /
// eligibility-determination capacity strained; a GDIT/MANT decline = federal/civilian
// IT-modernization backlog; a BAH/ACN decline = digital-transformation & consulting
// capacity pulls back; a LDOS decline = civil mission-systems capacity. This is
// GOVERNANCE identity = government & public administration, public services delivery,
// regulation & oversight, public finance, rule of law & institutional integrity —
// DISTINCT from economy (macro aggregate), finance (capital markets), law
// (judicial/legal system), and intelligence (tradecraft). Governance carries ZERO
// energy content: regulatory-overhead compliance tech (ERP auditing, e-discovery) and
// federal data-center / secure-facility cooling may COUPLE to compute load downstream,
// but the signal ORIGIN is governance administration & IT-modernization backlog, NEVER
// energy production or grid capacity; governance nodes carry zero energy-domain content.
// REAL govtech / public-sector tickers only.
//   TYL → court/permit/licensing case management   MMS → benefits delivery / eligibility
//   MANT → federal IT infrastructure (ManTech)      GDIT → civilian/federal IT (General Dynamics IT, via GD)
//   BAH → federal consulting / public-sector advisory ACN → digital transformation
//   LDOS → civil mission systems / agency IT         CACI → govtech analytics / tradecraft tech
var GOVERNANCE_COMPANY_BINDING = {
  TYL:  { series: 'TYL',  node: 'ECN',   role: 'Court / Permit / Licensing Case-Management Capacity', nodeRole: 'Public Administration',          label: 'Tyler Technologies',     threshold: -18, dir: 'low', kind: 'ticker', industry: 'govtech-case-management' },
  MMS:  { series: 'MMS',  node: 'STRI',  role: 'Benefits Delivery / Eligibility-Determination Capacity', nodeRole: 'Treasury and Fiscal Operations', label: 'Maximus',              threshold: -17, dir: 'low', kind: 'ticker', industry: 'benefits-delivery' },
  MANT: { series: 'MANT', node: 'V1',    role: 'Federal IT-Infrastructure / Modernization Capacity',  nodeRole: 'Technology Integration',         label: 'ManTech International',   threshold: -20, dir: 'low', kind: 'ticker', industry: 'federal-it' },
  GDIT: { series: 'GD',   node: 'V1',    role: 'Civilian / Federal IT-Services Capacity (GD IT)',     nodeRole: 'Technology Integration',         label: 'General Dynamics IT',    threshold: -16, dir: 'low', kind: 'ticker', industry: 'civilian-it' },
  BAH:  { series: 'BAH',  node: 'dlPFC', role: 'Federal Consulting / Public-Sector Advisory Capacity', nodeRole: 'Executive Authority',           label: 'Booz Allen Hamilton',    threshold: -16, dir: 'low', kind: 'ticker', industry: 'federal-consulting' },
  ACN:  { series: 'ACN',  node: 'vmPFC', role: 'Digital-Transformation / Modernization Capacity',     nodeRole: 'Policy Formation',               label: 'Accenture',              threshold: -15, dir: 'low', kind: 'ticker', industry: 'digital-transformation' },
  LDOS: { series: 'LDOS', node: 'dACC',  role: 'Civil Mission-Systems / Agency-IT Capacity',          nodeRole: 'Regulatory Oversight',          label: 'Leidos',                 threshold: -17, dir: 'low', kind: 'ticker', industry: 'civil-mission-systems' },
  CACI: { series: 'CACI', node: 'AI',    role: 'Govtech Analytics / Risk-Assessment Tech Capacity',   nodeRole: 'Risk Assessment Risk & Resilience', label: 'CACI International',  threshold: -18, dir: 'low', kind: 'ticker', industry: 'govtech-analytics' }
};

// Reverse lookup: connectome node → governance-sector company tickers it sources from
// (opt-in governance-company drill, parallel to NODE_TO_TECH_COMPANY /
// NODE_TO_INTEL_COMPANY / NODE_TO_TRADE_COMPANY / NODE_TO_ENVIRONMENT_COMPANY).
var NODE_TO_GOVERNANCE_COMPANY = {};
for (var _govk in GOVERNANCE_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(GOVERNANCE_COMPANY_BINDING, _govk)) continue;
  var _govb = GOVERNANCE_COMPANY_BINDING[_govk];
  if (!NODE_TO_GOVERNANCE_COMPANY[_govb.node]) NODE_TO_GOVERNANCE_COMPANY[_govb.node] = [];
  NODE_TO_GOVERNANCE_COMPANY[_govb.node].push(_govb);
}

// ── FISCAL vs MONETARY POLICY TRANSMISSION (ADDITIVE — economy gap 2) ──
// The existing FEED_TO_CONNECTOME['finance'] = ['economy','finance'] mapping does
// NOT distinguish FISCAL (Treasury / OMB / Congress: spending, taxes, debt
// issuance) from MONETARY (Fed / central bank: rates, balance sheet, EFFR)
// policy paths. They transmit through DIFFERENT pathways and should light up
// DIFFERENT nodes: a government-spending shock activates governance + economy
// (fiscal multiplier → employment → consumption), whereas a rate hike activates
// economy + finance (credit channel). We do NOT alter the validated 'finance'
// relay (which stays ['economy','finance']); we ADD a parallel policy-path
// registry that upstream code (domain-signal-engine separating Treasury MTS /
// Cash Balance / Debt Outstanding sources from Fed Monetary Press / Fed Reg /
// NY Fed EFFR sources) can use to route a policy shock to the correct nodes.
// Resolving by policy path is OPT-IN (resolvePolicyPath) — the default resolve()
// pipeline is unchanged.
var MACRO_POLICY_PATH = {
  // Fiscal = Treasury / OMB / Congress. Adds 'governance' so budget, tax, and
  // spending authority can route through the governance circuit independently of
  // the monetary credit channel. Economy = the macro aggregate it ultimately hits.
  fiscal:   { connectomeDomains: ['economy', 'governance', 'finance'], indicators: ['GDP', 'GDPC1', 'UNRATE', 'PAYEMS', 'INDPRO'], sources: ['Treasury MTS', 'Treasury Cash Balance', 'Treasury Debt Outstanding', 'OMB'] },
  // Monetary = Fed / central bank. Keeps the validated economy + finance credit
  // channel (rate hikes → credit conditions → capital markets).
  monetary: { connectomeDomains: ['economy', 'finance'],               indicators: ['FEDFUNDS', 'DGS10', 'CPIAUCSL', 'PCEPI'],     sources: ['Fed Monetary Press', 'Fed Reg', 'NY Fed EFFR'] },
  // Intelligence (intelligence gap 3 — ADDITIVE) = threat-level / collection-capacity
  // / collection-performance shocks. These are PURE intelligence-tradecraft signals
  // (threat warning, SIGINT throughput, HUMINT backlog) with ZERO energy content;
  // a surveillance-op surge may COUPLE to data-center compute load downstream, but
  // the signal ORIGIN is intelligence tradecraft, so it routes through the dedicated
  // 'intelligence' circuit. 'governance' is added for the oversight/authority path
  // (intelligence oversight, covert-action finding authority) — NOT energy. Indicator
  // keys reference INTELLIGENCE_INDICATOR_BINDING below.
  intelligence: { connectomeDomains: ['intelligence', 'governance'], indicators: ['ThreatLevel_CRITICAL', 'SIGINTCapacity_DEGRADED', 'HUMINTBacklog_HIGH'], sources: ['ODNI Threat Assessment', 'SIGINT Collection Tasking', 'HUMINT Source Reporting'] },
  // Trade (trade gap — ADDITIVE, OPT-IN) = commerce-policy shocks: a unilateral
  // tariff, a bilateral trade-agreement ratification, sanctions/embargo, an
  // export-control rule change, or an origin-rule (rules-of-origin) shift. The
  // existing FEED_TO_CONNECTOME['supplyChain'] = ['trade','finance'] routes ALL
  // supply-chain stress through the same path regardless of policy origin; these
  // sub-paths let a policy shock route to the CORRECT trade nodes. Example: a
  // Trump-style unilateral tariff shock = OFC (customs/tariff valuation) +
  // governance (enforcement/authority) + trade (re-routing). These are PURE
  // commerce-policy mechanics (tariffs, sanctions, customs, origin rules) — NOT
  // energy. 'finance' is added where trade finance is implicated (sanctions freeze
  // payment rails, tariffs alter letter-of-credit collateral). Indicator keys
  // reference TRADE_INDICATOR_BINDING below. Resolved via resolveTradePolicyPath.
  trade_unilateral_tariff: { connectomeDomains: ['trade', 'governance'],            indicators: ['TariffLevel', 'CustomsBacklog'],                sources: ['USTR Section 301', 'CBP HTS Duty Schedule'] },
  trade_bilateral_agreement: { connectomeDomains: ['trade', 'governance'],          indicators: ['EXPGS', 'IMPGS', 'BOPGSTB'],                    sources: ['USTR FTA Text', 'Congressional Ratification'] },
  trade_sanctions: { connectomeDomains: ['trade', 'governance', 'finance'],         indicators: ['ExportPermitDelay', 'CustomsBacklog'],          sources: ['OFAC SDN List', 'BIS Entity List'] },
  trade_export_control: { connectomeDomains: ['trade', 'governance'],               indicators: ['ExportPermitDelay', 'TariffLevel'],             sources: ['BIS EAR / CCL', 'State DDTC ITAR'] },
  trade_origin_rule: { connectomeDomains: ['trade', 'finance'],                     indicators: ['CustomsBacklog', 'TariffLevel'],                sources: ['CBP Rules of Origin', 'USMCA Certificate of Origin'] },
  // Environment (environment gap 3 — ADDITIVE, OPT-IN) = climate / environmental-
  // regulation / conservation / waste policy shocks. The existing FEED_TO_CONNECTOME
  // ['environment'] = ['environment'] mapping routes ALL environment stress through the
  // same path regardless of policy origin; these sub-paths let a regulation/compliance/
  // climate-policy shock route to the CORRECT environment nodes + governance (for
  // authority/enforcement). These are PURE environmental-regulation mechanics (carbon
  // tax, cap-and-trade, emissions limits, water-quality standards, habitat/species
  // protection, landfill caps, recycling/e-waste mandates) — NOT energy scarcity. Energy
  // coupling arises ONLY if a policy mandates fuel-switching or efficiency improvements,
  // but the SIGNAL ORIGIN is environmental regulation, kept DISTINCT from energy.
  // Indicator keys reference ENVIRONMENT_INDICATOR_BINDING above. Resolved via
  // resolveEnvironmentPolicyPath.
  //   climate_policy           = carbon tax, cap-and-trade rules, climate-compliance cost
  //   environmental_regulation = Clean Air Act, water-quality standards, emissions limits, ESG mandates
  //   conservation_policy      = habitat protection, species protection, land-use restriction
  //   waste_policy             = landfill caps, recycling mandates, e-waste rules
  climate_policy:           { connectomeDomains: ['environment', 'governance'],           indicators: ['CarbonPrice', 'ETSVolume', 'ForestCarbon'],        sources: ['EPA GHG Reporting Program', 'ICE/CME Carbon Futures', 'RGGI/WCI Auction'] },
  environmental_regulation: { connectomeDomains: ['environment', 'governance'],           indicators: ['AQI', 'PM25', 'NOx', 'SO2', 'WQI', 'DissolvedO2'], sources: ['EPA Clean Air Act NAAQS', 'EPA Clean Water Act', 'SEC ESG Disclosure'] },
  conservation_policy:      { connectomeDomains: ['environment', 'governance'],           indicators: ['ForestCarbon', 'SpeciesIndex'],                    sources: ['ESA Listing (USFWS)', 'BLM Land-Use Plan', 'NOAA Habitat Designation'] },
  waste_policy:             { connectomeDomains: ['environment', 'governance'],           indicators: ['WasteVolume'],                                     sources: ['EPA RCRA Subtitle C/D', 'State Landfill Caps', 'EPR / E-Waste Mandates'] },
  // Governance (governance gap 3 — ADDITIVE, OPT-IN) = policy-domain shocks split by
  // POLICY AUTHORITY / MECHANISM (not energy). These route a governance shock to the
  // correct governance nodes by sub-circuit: executive/fiscal authority, legislative
  // rulemaking, electoral & democratic institutions, institutional integrity / rule of
  // law. These are PURE governance identity (policymaking authority & enforcement,
  // budget execution, elections integrity, anti-corruption) — DISTINCT from economy
  // (macro), finance (capital), law (judicial), intelligence (tradecraft). Energy
  // coupling is ZERO: utility regulation (FERC, state PUCs) is governance AUTHORITY
  // over energy, never energy production itself; kept distinct. 'economy' is added on
  // the fiscal path (spending → employment → consumption multiplier); 'finance' on the
  // institutional-integrity path (rule of law → contract enforcement). Indicator keys
  // reference GOVERNANCE_INDICATOR_BINDING below. Resolved via resolveGovernancePolicyPath.
  //   gov_executive_authority   = Treasury / OMB / appropriations → fiscal multiplier
  //   gov_legislative_rulemaking = statutes / regulations / enforcement velocity
  //   gov_electoral_institutions = elections / representation / democratic legitimacy
  //   gov_institutional_integrity = rule of law / anti-corruption / due process
  gov_executive_authority:    { connectomeDomains: ['governance', 'economy'],           indicators: ['CBOBudgetImpact', 'OMBComplianceRate', 'GSAITModernization'], sources: ['OMB Appropriations', 'Treasury Fiscal Service', 'CBO Budget & Economic Outlook'] },
  gov_legislative_rulemaking: { connectomeDomains: ['governance'],                      indicators: ['FederalRegisterVolume', 'OECDRegQuality', 'CFPBEnforcement'],  sources: ['Federal Register', 'OECD Regulatory Policy Outlook', 'CFPB Enforcement Actions'] },
  gov_electoral_institutions: { connectomeDomains: ['governance'],                      indicators: ['VDemElectoralIndex'],                                          sources: ['V-Dem Institute Dataset', 'EAC Election Administration', 'OPM Federal Workforce'] },
  gov_institutional_integrity:{ connectomeDomains: ['governance', 'finance'],           indicators: ['WGIRuleOfLaw', 'GAOAuditBacklog', 'OPMVacancyRate'],            sources: ['World Bank WGI', 'GAO Performance & Accountability Report', 'OPM FedScope'] },
  // Healthcare (medicine gap 4 — ADDITIVE, OPT-IN) = CMS / HHS / FDA / Medicaid regulatory
  // shocks. The existing FEED_TO_CONNECTOME['health'] = ['medicine','metabolic'] mapping
  // routes ALL medicine stress through the same path regardless of policy origin; these
  // sub-paths let a healthcare-regulation shock route to the CORRECT medicine nodes +
  // governance (for authority/enforcement). These are PURE healthcare-regulation mechanics
  // (Medicare payment rules, FDA enforcement actions, Medicaid expansion/contraction,
  // health-IT certification mandates) — NOT energy. Healthcare policy shocks originate in
  // healthcare-regulation authority (CMS, FDA, HHS, ONC) and impact healthcare operations
  // (reimbursement, drug approval, insurance coverage); energy is never part of the signal
  // chain. 'economy' is added on Medicaid (coverage → consumption/employment), 'finance' on
  // payment rules (reimbursement → hospital margin), 'technology' on health-IT certification
  // (EHR/interoperability mandates). Indicator keys reference HEALTHCARE_INDICATOR_BINDING.
  // Resolved via resolveHealthcarePolicyPath.
  //   cms_payment_rule_change        = Medicare payment-rule change → reimbursement / hospital margin
  //   fda_enforcement_action         = FDA enforcement / recall / approval-authority shock
  //   medicaid_expansion             = Medicaid coverage expansion/contraction → insurance / consumption
  //   health_it_certification_mandate = ONC health-IT certification / interoperability mandate
  cms_payment_rule_change:         { connectomeDomains: ['medicine', 'governance', 'finance'], indicators: ['HospitalOccupancy', 'HospitalBedAvail', 'SurgicalCapacityUtil'], sources: ['CMS.gov Payment Rule (OPPS/PFS)', 'OMB Regulatory Review', 'CMS Hospital Quality Reporting'] },
  fda_enforcement_action:          { connectomeDomains: ['medicine', 'governance'],            indicators: ['FDAAdverseEvents', 'FDAPharmacyRecall', 'FDAApprovalRate'],     sources: ['FDA.gov Enforcement Report', 'openFDA Adverse Events', 'FDA Drug Approvals'] },
  medicaid_expansion:              { connectomeDomains: ['medicine', 'governance', 'economy'], indicators: ['InsuranceMLR', 'ClaimsApprovalRate'],                          sources: ['State Medicaid Agency', 'CMS Medicaid & CHIP', 'HHS Coverage Data'] },
  health_it_certification_mandate: { connectomeDomains: ['medicine', 'technology', 'governance'], indicators: ['DiagnosticVolume', 'DiagnosticTAT'],                        sources: ['ONC.gov Health-IT Certification', 'CMS Interoperability Rule', 'HHS HITECH'] },
  // Education (education gap 4 — ADDITIVE, OPT-IN) = U.S. Dept of Education / state-education-
  // agency / accreditor / Federal Student Aid regulatory shocks. The existing FEED_TO_CONNECTOME
  // ['education'] = ['education'] mapping routes ALL education stress through the same path
  // regardless of policy origin; these sub-paths let an education-regulation shock route to the
  // CORRECT education nodes + governance (for funding/accreditation authority). These are PURE
  // education-policy mechanics (Title I funding, PELL/special-ed appropriation, K-12 curriculum
  // mandates, accreditation rules, student-debt forgiveness) — NOT energy. Education policy
  // shocks originate in education-regulation AUTHORITY (state K-12 boards, accreditors, Federal
  // Student Aid) — distinct from energy regulation (FERC, PUCs); energy is never part of the
  // signal chain (campus power is an infrastructure consequence of facility occupancy). 'economy'
  // is added on K-12 funding (spending → employment / consumption multiplier); 'finance' on
  // higher-ed regulation (affordability → tuition cashflow); 'population' on student debt
  // (debt burden → demographic/household formation). Indicator keys reference
  // EDUCATION_INDICATOR_BINDING. Resolved via resolveEducationPolicyPath.
  //   education_k12_funding          = Title I / special-ed / free-lunch funding → K-12 capacity
  //   education_higher_ed_regulation = accreditation / affordability / grad-outcome rules
  //   education_student_debt         = student-loan delinquency / balances / forgiveness volumes
  education_k12_funding:          { connectomeDomains: ['education', 'governance', 'economy'],   indicators: ['NAEPMath', 'NAEPReading', 'NCESLiteracy', 'TeacherVacancy'], sources: ['U.S. Dept of Education', 'State Education Agency', 'OMB Education Appropriations'] },
  education_higher_ed_regulation: { connectomeDomains: ['education', 'governance', 'finance'],   indicators: ['NCESGradRate', 'NCESEnrollment', 'AdmissionsYield', 'EdtechEnrollment'], sources: ['ACCJC', 'SACSCOC', 'Federal Student Aid'] },
  education_student_debt:         { connectomeDomains: ['education', 'finance', 'population'],    indicators: ['StudentLoanDelinquency', 'StudentLoanBalance'],              sources: ['Federal Student Aid', 'CFPB Student Loans Report'] },
  // Science / Research (science gap 4 — ADDITIVE, OPT-IN) = research-policy shocks split by POLICY
  // MECHANISM. The existing FEED_TO_CONNECTOME relays research-origin innovation through the
  // 'science' connectome domain (via technology: ['technology','science']); these sub-paths let a
  // research-POLICY shock route to the CORRECT science nodes (+ the coupled authority domain). These
  // are PURE research-policy mechanics (fundamental-research funding authority, R&D tax-credit policy,
  // peer-review / research-integrity regulatory authority, science-education STEM mandates) — NOT
  // energy. Research-policy shocks originate in research-funding & research-regulation AUTHORITY
  // (NSF, NIH, university accreditors, journal editorial boards) — DISTINCT from energy regulation
  // (FERC, PUCs, grid policy), which is governance authority over ENERGY and kept separate; science
  // nodes carry zero energy-policy content. DUAL-KEY NOTE: 'science' here is the connectome-domain
  // key (matches brain-node-domains.json); the runtime/snapshot key is 'research'
  // (domain-identity.js). 'governance' is added on every path for the funding/regulation authority
  // surface; 'finance' on the funding path (appropriation → research-budget cashflow); 'education'
  // on the science-education mandate (STEM-pipeline / lab-access). Indicator keys reference
  // SCIENCE_INDICATOR_BINDING above. Resolved via resolveSciencePolicyPath.
  //   research_funding           = NSF/NIH appropriation / grant-award volume / R&D budget shock
  //   research_regulation        = peer-review / research-integrity / scientific-conduct rule shock
  //   science_education_mandate  = STEM-pipeline funding / lab-access-for-schools mandate
  research_funding:          { connectomeDomains: ['science', 'governance', 'finance'],   indicators: ['NSFGrantVolume', 'NIHApprovalRate', 'RnDBudgetAlloc', 'ResearchStaffing', 'LabEquipUtil'], sources: ['NSF Budget & Award Data', 'NIH RePORTER', 'AAAS R&D Budget Analysis', 'OMB Science Appropriations'] },
  research_regulation:       { connectomeDomains: ['science', 'governance'],              indicators: ['PeerReviewTAT', 'RetractionRate', 'ArxivSubmissions', 'NaturePubVelocity', 'OpenAlexCitation', 'ResearchPatents'], sources: ['NSF Research Integrity (OIG)', 'NIH Office of Research Integrity', 'COPE Editorial Standards', 'USPTO'] },
  science_education_mandate: { connectomeDomains: ['science', 'education', 'governance'],  indicators: ['ResearchStaffing', 'SpinoutFormation', 'LabEquipUtil'], sources: ['NSF EHR / STEM Education', 'U.S. Dept of Education STEM', 'NASA STEM Engagement'] },
  // Population / Demographics (population gap 2 — ADDITIVE, OPT-IN) = demographic-policy shocks
  // split by POLICY MECHANISM. The existing FEED_TO_CONNECTOME['population'] = ['population']
  // mapping routes ALL population stress through the same path regardless of policy origin;
  // these sub-paths let a demographic-policy shock route to the CORRECT population nodes (+ the
  // coupled domain where the policy mechanism crosses one). These are PURE demographic-policy
  // mechanics (immigration/settlement rules, fertility/household incentives, gerontology/aging-
  // care mandates) — NOT energy. Population is kept DISTINCT from labor-market (employment is a
  // COUPLING — 'economy' is added only where the policy mechanism touches household formation /
  // consumption, never as population content), medicine (mortality/aging-care is a COUPLING —
  // 'medicine' is added only on the aging-care mandate path), education (enrollment is a
  // COUPLING) and governance (policy AUTHORITY — 'governance' is added on every path for the
  // settlement/authority surface, never as population content). Energy coupling is ZERO at the
  // signal origin: settlement surge → infrastructure capex and aging-care mandates → always-on
  // facility load are downstream CONSEQUENCES, never the initiating signal. Indicator keys
  // reference POPULATION_INDICATOR_BINDING above. Resolved via resolvePopulationPolicyPath.
  //   pop_immigration_reform     = immigration / settlement-rule shock → migration + settlement nodes
  //   pop_fertility_incentive    = child-tax-credit / fertility-incentive shock → birth/youth + household nodes
  //   pop_aging_care             = Medicare-expansion / gerontology-care mandate → aging + caregiving nodes
  pop_immigration_reform:  { connectomeDomains: ['population', 'governance'],            indicators: ['NetMigration', 'RefugeeInflow', 'UrbanizationRate', 'PopulationDensity', 'EthnicDiversity'], sources: ['Census Bureau Components of Change', 'DHS Immigration Statistics', 'UNHCR Refugee Data'] },
  pop_fertility_incentive: { connectomeDomains: ['population', 'economy'],               indicators: ['FertilityRate', 'BirthRate', 'YouthShare', 'HouseholdFormation'],       sources: ['CDC/NCHS Natality', 'Census ACS Households', 'IRS Child Tax Credit'] },
  pop_aging_care:          { connectomeDomains: ['population', 'governance', 'medicine'], indicators: ['LifeExpectancy', 'MortalityByAge', 'MedianAge', 'OldAgeDependency', 'LFPR', 'UnemploymentByAge', 'EducationAttainment'], sources: ['CMS Medicare', 'SSA Mortality Tables', 'BLS CPS', 'UN World Population Prospects'] }
};

// ── INTELLIGENCE-SECTOR INDICATOR bindings (intelligence gap 3 — ADDITIVE) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), but for PURE
// intelligence-tradecraft signals rather than economic statistics. Binds named
// intelligence performance/threat indicators to the dedicated intelligence
// connectome node that senses them, so the kernel/reporting/diagnosis layers can
// drill from abstract 'intelligence stress' into the ACTUAL tradecraft signal that
// triggered it (e.g. threat-assessment node lit → ThreatLevel hit CRITICAL → threat
// warning origin). Threat-level / collection-performance stress carries ZERO energy
// content — surveillance-op surge may couple to data-center compute load downstream,
// but the signal ORIGIN is intelligence tradecraft, routed through intelligence nodes
// (NOT energy nodes). These are not FRED series and are not single-company tickers —
// they are tradecraft indicators routed to threshold nodes. Annotation/registry
// metadata ONLY — the resolver does NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
var INTELLIGENCE_INDICATOR_BINDING = {
  ThreatLevel_CRITICAL:    { series: 'ThreatLevel',    node: 'rACC', role: 'Threat Assessment',          nodeRole: 'Intelligence Oversight',                      label: 'National Threat Level',          threshold: 7,  dir: 'high', kind: 'intel', policyPath: 'intelligence' },
  ThreatWarning_SURGE:     { series: 'ThreatWarning',  node: 'dACC', role: 'Threat Warning',             nodeRole: 'Threat Assessment',                           label: 'Indications & Warning Surge',    threshold: 6,  dir: 'high', kind: 'intel', policyPath: 'intelligence' },
  SIGINTCapacity_DEGRADED: { series: 'SIGINTCapacity', node: 'A1',   role: 'SIGINT Collection Capacity', nodeRole: 'SIGINT / Signals Intelligence',               label: 'SIGINT Collection Capacity',     threshold: 40, dir: 'low',  kind: 'intel', policyPath: 'intelligence' },
  HUMINTBacklog_HIGH:      { series: 'HUMINTBacklog',  node: 'EMP',  role: 'HUMINT Source Throughput',   nodeRole: 'HUMINT / Human Intelligence',                 label: 'HUMINT Reporting Backlog',       threshold: 8,  dir: 'high', kind: 'intel', policyPath: 'intelligence' },
  CollectionGap_OPEN:      { series: 'CollectionGap',  node: 'BBB',  role: 'Collection Strategy Gap',    nodeRole: 'Collection Strategy — Implementation & Strategy — Workforce Alignment', label: 'Open Collection Requirements', threshold: 5, dir: 'high', kind: 'intel', policyPath: 'intelligence' },
  CIThreat_ELEVATED:       { series: 'CIThreat',       node: 'BLA',  role: 'Counterintelligence Threat', nodeRole: 'Counterintelligence',                         label: 'Counterintelligence Threat',    threshold: 6,  dir: 'high', kind: 'intel', policyPath: 'intelligence' }
};

// Reverse lookup: connectome node → intelligence indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR; for diagnosis drill-down).
var NODE_TO_INTEL_INDICATOR = {};
for (var _iik in INTELLIGENCE_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(INTELLIGENCE_INDICATOR_BINDING, _iik)) continue;
  var _iib = INTELLIGENCE_INDICATOR_BINDING[_iik];
  if (!NODE_TO_INTEL_INDICATOR[_iib.node]) NODE_TO_INTEL_INDICATOR[_iib.node] = [];
  NODE_TO_INTEL_INDICATOR[_iib.node].push(_iib);
}

// ── TRADE-SECTOR (SUPPLY CHAIN) INDICATOR bindings (trade gap — ADDITIVE) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1) and
// INTELLIGENCE_INDICATOR_BINDING (intelligence gap 3), but for PURE trade/commerce
// signals: commodity prices, the trade balance, shipping/freight indices, tariff &
// customs levels, and port congestion. Binds each real metric to the trade
// connectome node that senses it, so the kernel/reporting/diagnosis layers can drill
// from abstract 'trade stress' into the ACTUAL commerce signal that triggered it
// (e.g. customs node lit → tariff escalation → trade-policy shock origin; container
// node lit → freight index spiked → shipping-capacity shortage). FRED series are used
// where they exist (trade balance BOPGSTB, imports IMPGS, exports EXPGS, commodity
// constituents like soybeans/wheat/crude as TRADED goods — measured here as trade
// FLOW, not energy production); tariff / port-congestion / container-utilization are
// hand-curated policy/operational signals (not FRED, not single-company tickers).
// These are PURE commerce metrics: tariff escalation, export-permit delay, container
// shortage, customs-clearance backlog, vessel-queue congestion. Energy (fuel hedging,
// shipping fuel cost) is a downstream CONSEQUENCE of trade stress (higher freight =>
// fuel-cost pass-through), never the signal origin; trade nodes carry zero
// energy-domain content. Annotation/registry metadata ONLY — the resolver does NOT
// score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'fred' (FRED series) | 'index' (shipping/freight index) | 'policy'
//          (tariff/customs/export-control signal) | 'ops' (operational congestion).
var TRADE_INDICATOR_BINDING = {
  // ── Trade balance / flows (FRED) ──
  BOPGSTB: { series: 'BOPGSTB', node: 'TPJ',  role: 'Trade Balance',           nodeRole: 'Cross-Border Commerce', label: 'U.S. Trade Balance (Goods & Services)', threshold: -75000, dir: 'low',  kind: 'fred',   policyPath: 'trade' },
  IMPGS:   { series: 'IMPGS',   node: 'TPJ',  role: 'Import Volume',           nodeRole: 'Cross-Border Commerce', label: 'Imports of Goods & Services',          threshold: 5,      dir: 'high', kind: 'fred',   policyPath: 'trade' },
  EXPGS:   { series: 'EXPGS',   node: 'CARD', role: 'Export Volume',           nodeRole: 'Services Trade',        label: 'Exports of Goods & Services',          threshold: -3,     dir: 'low',  kind: 'fred',   policyPath: 'trade' },
  // ── Commodity indices (FRED, measured as TRADED GOODS flow, not energy production) ──
  PSOYBUSDM: { series: 'PSOYBUSDM', node: 'NAcc', role: 'Agri-Commodity Trade Price', nodeRole: 'Commodity Exchanges', label: 'Soybeans (Global Price)', threshold: 18, dir: 'high', kind: 'fred', policyPath: 'trade' },
  PWHEAMTUSDM: { series: 'PWHEAMTUSDM', node: 'NAcc', role: 'Grain Trade Price',     nodeRole: 'Commodity Exchanges', label: 'Wheat (Global Price)',    threshold: 20, dir: 'high', kind: 'fred', policyPath: 'trade' },
  // ── Shipping / freight indices (operational throughput, NOT fuel cost) ──
  BalticDry:      { series: 'BalticDry',      node: 'NTS',  role: 'Dry-Bulk Freight Rate',      nodeRole: 'Container Shipping',  label: 'Baltic Dry Index',           threshold: 2500, dir: 'high', kind: 'index', policyPath: 'trade' },
  ContainerUtil:  { series: 'ContainerUtil',  node: 'NTS',  role: 'Container Fleet Utilization', nodeRole: 'Container Shipping',  label: 'Container Utilization',      threshold: 90,   dir: 'high', kind: 'index', policyPath: 'trade' },
  FreightForward: { series: 'FreightForward', node: 'CC',   role: 'Freight-Forwarding Rate',    nodeRole: 'Freight Forwarding',  label: 'Forwarding Spot Rate Index', threshold: 8,    dir: 'high', kind: 'index', policyPath: 'trade' },
  // ── Tariff / customs / export-control (hand-curated policy signals) ──
  TariffLevel:   { series: 'TariffLevel',   node: 'OFC',  role: 'Average Applied Tariff',      nodeRole: 'Customs & Tariffs',  label: 'Average Applied Tariff Rate', threshold: 6,  dir: 'high', kind: 'policy', policyPath: 'trade' },
  CustomsBacklog: { series: 'CustomsBacklog', node: 'OFC', role: 'Customs Clearance Backlog',   nodeRole: 'Customs & Tariffs',  label: 'Customs Clearance Backlog',   threshold: 5,  dir: 'high', kind: 'policy', policyPath: 'trade' },
  ExportPermitDelay: { series: 'ExportPermitDelay', node: 'vmPFC', role: 'Export-Control Permit Delay', nodeRole: 'Trade Agreements', label: 'Export License Delay',     threshold: 7,  dir: 'high', kind: 'policy', policyPath: 'trade' },
  // ── Port congestion (operational) ──
  PortCongestion: { series: 'PortCongestion', node: 'THAL', role: 'Port Vessel-Queue Congestion', nodeRole: 'Port Operations', label: 'Port Congestion (Vessel Queue)', threshold: 6, dir: 'high', kind: 'ops', policyPath: 'trade' }
};

// Reverse lookup: connectome node → trade indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_INTEL_INDICATOR; for diagnosis drill-down).
var NODE_TO_TRADE_INDICATOR = {};
for (var _trik in TRADE_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(TRADE_INDICATOR_BINDING, _trik)) continue;
  var _trib = TRADE_INDICATOR_BINDING[_trik];
  if (!NODE_TO_TRADE_INDICATOR[_trib.node]) NODE_TO_TRADE_INDICATOR[_trib.node] = [];
  NODE_TO_TRADE_INDICATOR[_trib.node].push(_trib);
}

// ── ENVIRONMENT-SECTOR INDICATOR bindings (environment gap 2 — ADDITIVE) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), INTELLIGENCE_INDICATOR_
// BINDING (intelligence gap 3) and TRADE_INDICATOR_BINDING (trade gap), but for PURE
// environmental-domain signals: air-quality / particulate concentrations, water-quality
// indices, carbon-price futures, waste-volume indices, forest-carbon inventory, and
// emissions-trading volume. Binds each real metric to the environment connectome node
// that senses it, so the kernel/reporting/diagnosis layers can drill from abstract
// 'environment stress' into the ACTUAL environmental signal that triggered it (e.g.
// atmospheric node lit → PM2.5 spiked → air-pollution shock origin; climate node lit →
// carbon price surged → carbon-market repricing). FRED series are used where they exist
// (forest-carbon / land-use as inventory proxies); air-quality (AQI/PM2.5/NOx/SO2/ozone),
// water-quality (pH/DO/contamination), carbon-price futures (ICE/CME), waste-volume, and
// emissions-trading (ETS/RGGI) are hand-curated environmental signals (EPA/NOAA/USGS/
// carbon-market sources — not single-company tickers). These strictly measure ENVIR-
// domain identity: air pollutant concentration, water quality, emissions volume (Scope
// 1/2/3 GHG + criteria pollutants), waste streams, biodiversity proxies, carbon-
// sequestration rate. NEVER energy production or grid metrics — coupling to energy is
// downstream & SECOND-ORDER (emissions control needs more power to run scrubbers, water
// treatment needs more pumping), never the signal origin; environment nodes carry zero
// energy-domain content. Annotation/registry metadata ONLY — the resolver does NOT score
// these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'air' (air-quality index) | 'water' (water-quality index) | 'carbon'
//          (carbon-price / emissions-trading) | 'waste' (waste-volume) | 'fred' (inventory).
var ENVIRONMENT_INDICATOR_BINDING = {
  // ── Air quality (particulate / criteria pollutants) ──
  AQI:       { series: 'AQI',       node: 'PBN',  role: 'Air Quality Index',            nodeRole: 'Atmospheric Regulation', label: 'Air Quality Index (AQI)',          threshold: 100,  dir: 'high', kind: 'air',    policyPath: 'environmental_regulation' },
  PM25:      { series: 'PM25',      node: 'PBN',  role: 'Fine Particulate (PM2.5)',     nodeRole: 'Atmospheric Regulation', label: 'PM2.5 Concentration (µg/m³)',      threshold: 35,   dir: 'high', kind: 'air',    policyPath: 'environmental_regulation' },
  NOx:       { series: 'NOx',       node: 'dACC', role: 'Nitrogen-Oxide Pollution',     nodeRole: 'Pollution Control',      label: 'NOx Concentration (ppb)',          threshold: 100,  dir: 'high', kind: 'air',    policyPath: 'environmental_regulation' },
  SO2:       { series: 'SO2',       node: 'dACC', role: 'Sulfur-Dioxide Pollution',     nodeRole: 'Pollution Control',      label: 'SO2 Concentration (ppb)',          threshold: 75,   dir: 'high', kind: 'air',    policyPath: 'environmental_regulation' },
  // ── Water quality (USGS / EPA) ──
  WQI:       { series: 'WQI',       node: 'DV',   role: 'Water Quality Index',          nodeRole: 'Water Cycles',           label: 'Water Quality Index',              threshold: 50,   dir: 'low',  kind: 'water',  policyPath: 'environmental_regulation' },
  DissolvedO2: { series: 'DissolvedO2', node: 'NTS', role: 'Aquatic Dissolved Oxygen', nodeRole: 'Ocean Chemistry',        label: 'Dissolved Oxygen (mg/L)',          threshold: 5,    dir: 'low',  kind: 'water',  policyPath: 'environmental_regulation' },
  // ── Carbon markets (ICE/CME futures + emissions-trading volume) ──
  CarbonPrice: { series: 'CarbonPrice', node: 'HYPO', role: 'Carbon Price (Allowance)', nodeRole: 'Climate Systems',       label: 'Carbon Allowance Price (EUA/CCA)', threshold: 80,   dir: 'high', kind: 'carbon', policyPath: 'climate_policy' },
  ETSVolume:   { series: 'ETSVolume',   node: 'vmPFC', role: 'Emissions-Trading Volume', nodeRole: 'Conservation Policy',   label: 'Emissions-Trading Volume (ETS/RGGI)', threshold: 30, dir: 'low',  kind: 'carbon', policyPath: 'climate_policy' },
  // ── Waste streams (volume index) ──
  WasteVolume: { series: 'WasteVolume', node: 'CeA', role: 'Solid/Hazardous Waste Volume', nodeRole: 'Soilenv',           label: 'Waste-Volume Index',               threshold: 6,    dir: 'high', kind: 'waste',  policyPath: 'waste_policy' },
  // ── Forest carbon / sequestration inventory (FRED-style inventory proxy) ──
  ForestCarbon: { series: 'ForestCarbon', node: 'ENS', role: 'Forest-Carbon Inventory', nodeRole: 'Forests & Carbon Sinks', label: 'Forest-Carbon Inventory Signal',  threshold: -2,   dir: 'low',  kind: 'fred',   policyPath: 'conservation_policy' },
  // ── Biodiversity proxy (species / habitat) ──
  SpeciesIndex: { series: 'SpeciesIndex', node: 'MICRO', role: 'Biodiversity / Species Index', nodeRole: 'Biodiversity', label: 'Living Planet / Species Index',    threshold: -5,   dir: 'low',  kind: 'fred',   policyPath: 'conservation_policy' }
};

// Reverse lookup: connectome node → environment indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_INTEL_INDICATOR / NODE_TO_TRADE_INDICATOR;
// for diagnosis drill-down).
var NODE_TO_ENVIRONMENT_INDICATOR = {};
for (var _envik in ENVIRONMENT_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(ENVIRONMENT_INDICATOR_BINDING, _envik)) continue;
  var _envib = ENVIRONMENT_INDICATOR_BINDING[_envik];
  if (!NODE_TO_ENVIRONMENT_INDICATOR[_envib.node]) NODE_TO_ENVIRONMENT_INDICATOR[_envib.node] = [];
  NODE_TO_ENVIRONMENT_INDICATOR[_envib.node].push(_envib);
}

// ── GOVERNANCE-SECTOR INDICATOR bindings (governance gap 2 — ADDITIVE) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), INTELLIGENCE_INDICATOR_
// BINDING (intelligence gap 3), TRADE_INDICATOR_BINDING (trade gap) and ENVIRONMENT_
// INDICATOR_BINDING (environment gap 2), but for PURE policy & governance-PERFORMANCE
// signals: rule-of-law / governance-quality indices, electoral-democracy indices,
// regulatory-quality, audit backlogs, budget-impact scores, rulemaking velocity,
// enforcement velocity, compliance & vacancy rates, IT-modernization spend. Binds each
// REAL policy/governance metric to the governance connectome node that senses it
// (nodes are the real governance-domain participations in brain-node-domains.json), so
// the kernel/reporting/diagnosis layers can drill from abstract 'governance stress' into
// the ACTUAL institutional signal that triggered it (e.g. rule-of-law node lit → WGI
// Rule-of-Law fell → institutional-integrity shock; electoral node lit → V-Dem dropped →
// democratic-legitimacy shock). These are NOT FRED series and NOT single-company tickers
// — they are policy-performance indices from World Bank, V-Dem, OECD, GAO, CBO, the
// Federal Register, CFPB, OMB, OPM and GSA, routed to threshold nodes. Governance is
// measured by POLICY PERFORMANCE, never energy: FERC / state-PUC utility regulation is
// governance AUTHORITY (policy domain), not energy production or consumption; federal-
// utility (TVA, Bonneville) management is a governance-coupled infrastructure service,
// kept DISTINCT from energy-commodity identity. Governance nodes carry zero energy-domain
// content. Annotation/registry metadata ONLY — the resolver does NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'index' (governance/democracy/regulatory index) | 'audit' (audit/backlog) |
//          'budget' (fiscal/budget) | 'rulemaking' (Federal Register / enforcement) |
//          'admin' (compliance / vacancy / modernization spend).
var GOVERNANCE_INDICATOR_BINDING = {
  // ── Rule of law / institutional integrity ──
  WGIRuleOfLaw:        { series: 'WGIRuleOfLaw',        node: 'VTA',   role: 'Rule-of-Law / Anti-Corruption Index', nodeRole: 'Anticorruption Policy & Governance', label: 'World Bank WGI — Rule of Law',        threshold: 50, dir: 'low',  kind: 'index',      policyPath: 'gov_institutional_integrity' },
  GAOAuditBacklog:     { series: 'GAOAuditBacklog',     node: 'OFC',   role: 'Federal Audit Backlog',               nodeRole: 'Judicial Review',                    label: 'GAO Federal Audit Backlog',          threshold: 6,  dir: 'high', kind: 'audit',      policyPath: 'gov_institutional_integrity' },
  // ── Electoral & democratic institutions ──
  VDemElectoralIndex:  { series: 'VDemElectoralIndex',  node: 'NAcc',  role: 'Electoral Democracy Index',           nodeRole: 'Electoral Systems',                  label: 'V-Dem Electoral Democracy Index',    threshold: 60, dir: 'low',  kind: 'index',      policyPath: 'gov_electoral_institutions' },
  // ── Regulation & oversight ──
  OECDRegQuality:      { series: 'OECDRegQuality',      node: 'dACC',  role: 'Regulatory Quality',                  nodeRole: 'Regulatory Oversight',               label: 'OECD Regulatory Quality',            threshold: 50, dir: 'low',  kind: 'index',      policyPath: 'gov_legislative_rulemaking' },
  FederalRegisterVolume: { series: 'FederalRegisterVolume', node: 'BROCA', role: 'Rulemaking Velocity',             nodeRole: 'Legislative Process',                label: 'Federal Register Rulemaking Volume', threshold: 8,  dir: 'high', kind: 'rulemaking', policyPath: 'gov_legislative_rulemaking' },
  CFPBEnforcement:     { series: 'CFPBEnforcement',     node: 'dACC',  role: 'Enforcement Velocity',                nodeRole: 'Regulatory Oversight',               label: 'CFPB Enforcement Velocity',          threshold: 4,  dir: 'low',  kind: 'rulemaking', policyPath: 'gov_legislative_rulemaking' },
  // ── Public finance & budgets ──
  CBOBudgetImpact:     { series: 'CBOBudgetImpact',     node: 'STRI',  role: 'Budget-Impact Score',                 nodeRole: 'Treasury and Fiscal Operations',     label: 'CBO Budget Impact Score',            threshold: 6,  dir: 'high', kind: 'budget',     policyPath: 'gov_executive_authority' },
  OMBComplianceRate:   { series: 'OMBComplianceRate',   node: 'vmPFC', role: 'OMB Circular A-136 Compliance',        nodeRole: 'Policy Formation',                   label: 'OMB A-136 Compliance Rate',          threshold: 90, dir: 'low',  kind: 'admin',      policyPath: 'gov_executive_authority' },
  // ── Public administration / services delivery capacity ──
  OPMVacancyRate:      { series: 'OPMVacancyRate',      node: 'ECN',   role: 'Federal Workforce Vacancy',           nodeRole: 'Public Administration',              label: 'OPM Federal Vacancy Rate',           threshold: 10, dir: 'high', kind: 'admin',      policyPath: 'gov_institutional_integrity' },
  GSAITModernization:  { series: 'GSAITModernization',  node: 'V1',    role: 'IT-Modernization Spend Ratio',        nodeRole: 'Technology Integration',             label: 'GSA IT Modernization Spend Ratio',   threshold: 20, dir: 'low',  kind: 'admin',      policyPath: 'gov_executive_authority' }
};

// Reverse lookup: connectome node → governance indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_INTEL_INDICATOR / NODE_TO_TRADE_INDICATOR
// / NODE_TO_ENVIRONMENT_INDICATOR; for diagnosis drill-down).
var NODE_TO_GOVERNANCE_INDICATOR = {};
for (var _govik in GOVERNANCE_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(GOVERNANCE_INDICATOR_BINDING, _govik)) continue;
  var _govib = GOVERNANCE_INDICATOR_BINDING[_govik];
  if (!NODE_TO_GOVERNANCE_INDICATOR[_govib.node]) NODE_TO_GOVERNANCE_INDICATOR[_govib.node] = [];
  NODE_TO_GOVERNANCE_INDICATOR[_govib.node].push(_govib);
}

// ── AGRICULTURE-SECTOR (FARMING / CROPS / LIVESTOCK / AGRIBUSINESS) COMPANY ticker bindings (agriculture gap 1 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_BINDING,
// INDUSTRIAL_COMPANY_BINDING, ENVIRONMENT_SECTOR_COMPANY_BINDING and GOVERNANCE_COMPANY_
// BINDING (and to MACRO_INDICATOR_BINDING). NOT merged into the default resolve()
// pipeline and NOT included in NODE_TO_MACRO_INDICATOR — consumed ONLY when a context
// explicitly triggers an agriculture-company-level drill (getAgricultureCompaniesForNode
// / AGRICULTURE_COMPANY_BINDING export). Each ticker traces FARM / AGRIBUSINESS
// PRODUCTION CAPACITY to a REAL agriculture connectome node (nodes are the actual
// agriculture-domain participations in brain-node-domains.json under the 'p2' domain:
// GBA/SMA/GP/A1/TrkB/TPOLE=crop production, BLA/ADR/ARC=crop protection, FEF/STN/SCN/
// SMN=livestock production, mPFC/HAB/SNS/CeA=fertilizers & nutrients, BDNF/DAN=seeds &
// genetics, M1/OXY/VP/SN/LGN/V1=equipment & machinery, WERN/ENS/SNIG/IPL=agricultural
// finance, HYPO/vlPFC=irrigation, NAcc/OFC/CARD=commodity markets, AI=food processing).
// Ticker stress (dir 'low' for all — stress on decline) estimates an AGRICULTURAL-
// CAPACITY DEGRADATION that is PURE agriculture identity: an ADM/BG/INGR decline =
// grain-trading / oilseed-processing throughput constrained → commodity-handling
// bottleneck; a DE/AGCO decline = farm-machinery production / replacement capex pulls
// back → mechanization capacity falls; a CTVA/FMC decline = seed / crop-protection
// supply tightens; an NTR/MOS/CF decline = fertilizer (nitrogen/potash/phosphate)
// supply constrained → crop-input cost pressure; a TSN/CAG decline = animal-protein /
// packaged-food production capacity softens. This is AGRICULTURE identity = farming &
// crops, livestock & animal protein, agribusiness & food production, fertilizers &
// crop inputs, irrigation & agricultural water, commodity crops (corn/soy/wheat),
// agricultural technology & precision ag, farm economics — DISTINCT from environment
// (land/water/climate is a coupling), trade (export logistics is a coupling), economy
// (food prices is a coupling) and industry (machinery is a coupling routed via
// INDUSTRIAL_COMPANY_BINDING; DE appears in BOTH because Deere is both a heavy-equipment
// industrial maker AND a farm-mechanization ag supplier — node differs per identity).
// ENERGY is PURELY a downstream SECOND-ORDER consequence, never the identity: Haber-
// Bosch ammonia synthesis (NTR/MOS/CF) is energy-intensive and diesel/electric tractors
// (DE/AGCO) burn fuel, but those route ONLY as company-ticker stress to crop-input /
// machinery nodes — they NEVER originate an ag-to-energy edge and ag nodes carry ZERO
// energy-domain content (no oil/gas production, no grid ops). REAL agriculture / agri-
// business tickers only.
//   ADM/BG/INGR → grain trading / oilseed & corn processing   CTVA/FMC → seeds & crop protection
//   DE/AGCO     → farm machinery & mechanization               NTR/MOS/CF → fertilizers (N/K/P)
//   TSN         → animal protein / livestock                   CAG → packaged food / processing
var AGRICULTURE_COMPANY_BINDING = {
  ADM:  { series: 'ADM',  node: 'NAcc', role: 'Grain Trading / Oilseed Logistics Capacity', nodeRole: 'Premium Markets',                 label: 'Archer-Daniels-Midland', threshold: -16, dir: 'low', kind: 'ticker', industry: 'grain-trading' },
  BG:   { series: 'BG',   node: 'OFC',  role: 'Oilseed Crushing / Commodity Merchandising Capacity', nodeRole: 'Commodity Markets',      label: 'Bunge Global',           threshold: -18, dir: 'low', kind: 'ticker', industry: 'oilseed-processing' },
  INGR: { series: 'INGR', node: 'AI',   role: 'Corn / Starch Wet-Milling Processing Capacity', nodeRole: 'Food Processing',             label: 'Ingredion',              threshold: -19, dir: 'low', kind: 'ticker', industry: 'crop-processing' },
  CTVA: { series: 'CTVA', node: 'BDNF', role: 'Seed Genetics / Crop-Protection Supply',     nodeRole: 'Seeds & Genetics — Signal Detection', label: 'Corteva Agriscience', threshold: -17, dir: 'low', kind: 'ticker', industry: 'seeds-crop-protection' },
  FMC:  { series: 'FMC',  node: 'BLA',  role: 'Crop-Protection / Agrochemical Supply',      nodeRole: 'Crop Protection',                 label: 'FMC Corporation',        threshold: -21, dir: 'low', kind: 'ticker', industry: 'crop-protection' },
  DE:   { series: 'DE',   node: 'M1',   role: 'Farm-Machinery / Mechanization Capacity',    nodeRole: 'Tractors',                        label: 'Deere & Company',        threshold: -18, dir: 'low', kind: 'ticker', industry: 'farm-machinery' },
  AGCO: { series: 'AGCO', node: 'OXY',  role: 'Agricultural-Equipment Production Capacity',  nodeRole: 'Equipment & Machinery',          label: 'AGCO Corporation',       threshold: -22, dir: 'low', kind: 'ticker', industry: 'farm-machinery' },
  NTR:  { series: 'NTR',  node: 'mPFC', role: 'Nitrogen / Potash Crop-Nutrient Supply',     nodeRole: 'Fertilizers & Nutrients — Diagnostic Analysis', label: 'Nutrien',     threshold: -19, dir: 'low', kind: 'ticker', industry: 'fertilizer' },
  MOS:  { series: 'MOS',  node: 'HAB',  role: 'Phosphate / Potash Fertilizer Supply',       nodeRole: 'Fertilizers & Nutrients — Action Coordination', label: 'The Mosaic Company', threshold: -20, dir: 'low', kind: 'ticker', industry: 'fertilizer' },
  CF:   { series: 'CF',   node: 'SNS',  role: 'Ammonia / Nitrogen Fertilizer Synthesis Capacity', nodeRole: 'Fertilizers & Nutrients — Signal Detection', label: 'CF Industries', threshold: -21, dir: 'low', kind: 'ticker', industry: 'nitrogen-fertilizer' },
  TSN:  { series: 'TSN',  node: 'FEF',  role: 'Animal-Protein / Livestock Processing Capacity', nodeRole: 'Livestock Production — Signal Detection', label: 'Tyson Foods',     threshold: -18, dir: 'low', kind: 'ticker', industry: 'animal-protein' },
  CAG:  { series: 'CAG',  node: 'AI',   role: 'Packaged-Food / Processing Capacity',         nodeRole: 'Food Processing',                 label: 'Conagra Brands',         threshold: -16, dir: 'low', kind: 'ticker', industry: 'packaged-food' }
};

// Reverse lookup: connectome node → agriculture-sector company tickers it sources from
// (opt-in agriculture-company drill, parallel to NODE_TO_TECH_COMPANY /
// NODE_TO_INTEL_COMPANY / NODE_TO_TRADE_COMPANY / NODE_TO_INDUSTRIAL_COMPANY /
// NODE_TO_ENVIRONMENT_COMPANY / NODE_TO_GOVERNANCE_COMPANY).
var NODE_TO_AGRICULTURE_COMPANY = {};
for (var _agk in AGRICULTURE_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(AGRICULTURE_COMPANY_BINDING, _agk)) continue;
  var _agb = AGRICULTURE_COMPANY_BINDING[_agk];
  if (!NODE_TO_AGRICULTURE_COMPANY[_agb.node]) NODE_TO_AGRICULTURE_COMPANY[_agb.node] = [];
  NODE_TO_AGRICULTURE_COMPANY[_agb.node].push(_agb);
}

// ── AGRICULTURE-SECTOR INDICATOR bindings (agriculture gap 2 — ADDITIVE, OPT-IN) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), INTELLIGENCE_INDICATOR_
// BINDING (intelligence gap 3), TRADE_INDICATOR_BINDING (trade gap), ENVIRONMENT_
// INDICATOR_BINDING (environment gap 2) and GOVERNANCE_INDICATOR_BINDING (governance gap 2),
// but for PURE agriculture-domain signals: USDA WASDE crop production/demand forecasts
// (corn/soy/wheat), CBOT/CME agricultural futures (corn/soybean/wheat), USDA Producer
// Price Index for farm products, fertilizer cost indices (ammonia/urea), livestock price
// indices (cattle/hogs), and farm-credit / farm-real-estate debt signals. Binds each REAL
// agricultural metric to the agriculture connectome node ('p2' domain) that senses it, so
// the kernel/reporting/diagnosis layers can drill from abstract 'agriculture stress' into
// the ACTUAL agricultural signal that triggered it (e.g. crop-production node lit → WASDE
// corn forecast cut → production-shortfall shock origin; commodity node lit → CBOT
// soybeans spiked → ag-commodity repricing). USDA series (WASDE, NASS, PPI) and CME/CBOT
// futures are used where they exist; fertilizer-cost (Green Markets / CRU) and livestock
// price (CME feeder/live cattle, lean hogs) are hand-curated ag signals. These strictly
// measure AGRICULTURE identity: crop output, commodity-crop price, input cost (seed/
// fertilizer/fuel as a farm-cost line), livestock price, farm credit & land collateral.
// NEVER energy production or grid metrics — fertilizer & fuel appear ONLY as a farm INPUT-
// COST line (Haber-Bosch energy intensity is the upstream reason an ammonia/urea index
// moves, but the signal is the AG INPUT cost, not energy output); ag nodes carry zero
// energy-domain content and energy is NEVER the initiating signal — only a downstream
// CONSEQUENCE (input-cost pass-through to livestock-feed / protein markets). Annotation/
// registry metadata ONLY — the resolver does NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'wasde' (USDA supply/demand forecast) | 'futures' (CBOT/CME) | 'ppi'
//          (USDA producer price) | 'input' (fertilizer/fuel cost) | 'livestock'
//          (cattle/hog price) | 'credit' (farm debt / land collateral).
var AGRICULTURE_INDICATOR_BINDING = {
  // ── USDA WASDE crop production / demand forecasts (production-shortfall on decline) ──
  WASDECornProd: { series: 'WASDECornProd', node: 'GBA', role: 'Corn Production Forecast',    nodeRole: 'Crop Production — Adaptation & Learning', label: 'USDA WASDE Corn Production',    threshold: -3, dir: 'low', kind: 'wasde', policyPath: 'ag_crop_production' },
  WASDESoyProd:  { series: 'WASDESoyProd',  node: 'SMA', role: 'Soybean Production Forecast', nodeRole: 'Crop Production — State Assessment',     label: 'USDA WASDE Soybean Production', threshold: -3, dir: 'low', kind: 'wasde', policyPath: 'ag_crop_production' },
  WASDEWheatProd:{ series: 'WASDEWheatProd',node: 'GP',  role: 'Wheat Production Forecast',   nodeRole: 'Crop Production — Signal Detection',     label: 'USDA WASDE Wheat Production',   threshold: -3, dir: 'low', kind: 'wasde', policyPath: 'ag_crop_production' },
  // ── CBOT / CME agricultural futures (price spike = commodity stress) ──
  CBOTCorn:     { series: 'CBOTCorn',     node: 'NAcc', role: 'Corn Futures Price',     nodeRole: 'Premium Markets',                 label: 'CBOT Corn Futures',     threshold: 6,  dir: 'high', kind: 'futures', policyPath: 'ag_commodity_market' },
  CBOTSoybean:  { series: 'CBOTSoybean',  node: 'OFC',  role: 'Soybean Futures Price',  nodeRole: 'Commodity Markets',               label: 'CBOT Soybean Futures',  threshold: 13, dir: 'high', kind: 'futures', policyPath: 'ag_commodity_market' },
  CBOTWheat:    { series: 'CBOTWheat',    node: 'CARD', role: 'Wheat Futures Price',    nodeRole: 'Commodity Markets — State Assessment', label: 'CBOT Wheat Futures', threshold: 7,  dir: 'high', kind: 'futures', policyPath: 'ag_commodity_market' },
  // ── USDA Producer Price Index — farm products (price collapse stresses farm economics) ──
  USDAPPIFarm:  { series: 'WPU01',  node: 'WERN', role: 'Farm-Products Producer Price',  nodeRole: 'Agricultural Finance — Diagnostic Analysis', label: 'PPI — Farm Products (BLS WPU01)', threshold: -4, dir: 'low', kind: 'ppi', policyPath: 'ag_farm_economics' },
  // ── Fertilizer input-cost indices (cost spike = crop-input pressure) ──
  AmmoniaCost:  { series: 'AmmoniaCost',  node: 'mPFC', role: 'Ammonia Fertilizer Cost',  nodeRole: 'Fertilizers & Nutrients — Diagnostic Analysis', label: 'Ammonia Price Index (Green Markets)', threshold: 8, dir: 'high', kind: 'input', policyPath: 'ag_input_cost' },
  UreaCost:     { series: 'UreaCost',     node: 'HAB',  role: 'Urea / Nitrogen Cost',     nodeRole: 'Fertilizers & Nutrients — Action Coordination',  label: 'Urea Price Index (CRU)',          threshold: 9, dir: 'high', kind: 'input', policyPath: 'ag_input_cost' },
  // ── Livestock price indices (price collapse stresses livestock production) ──
  CMECattle:    { series: 'CMECattle',    node: 'STN',  role: 'Live-Cattle Futures Price', nodeRole: 'Livestock Production — Diagnostic Analysis', label: 'CME Live Cattle Futures',  threshold: -5, dir: 'low', kind: 'livestock', policyPath: 'ag_livestock_market' },
  CMEHogs:      { series: 'CMEHogs',      node: 'SCN',  role: 'Lean-Hog Futures Price',    nodeRole: 'Livestock Production — Action Coordination', label: 'CME Lean Hog Futures',     threshold: -6, dir: 'low', kind: 'livestock', policyPath: 'ag_livestock_market' },
  // ── Farm credit / land collateral (debt-service stress on farm finance) ──
  FarmDebtRatio: { series: 'FarmDebtRatio', node: 'SNIG', role: 'Farm Debt-to-Asset Ratio', nodeRole: 'Agricultural Finance — Action Coordination', label: 'USDA Farm Debt-to-Asset Ratio', threshold: 16, dir: 'high', kind: 'credit', policyPath: 'ag_farm_credit' },
  FarmlandValue: { series: 'FarmlandValue', node: 'LGN', role: 'Farmland Value (Collateral)', nodeRole: 'Agricultural Machinery — Signal Detection', label: 'USDA Farm Real-Estate Value', threshold: -4, dir: 'low', kind: 'credit', policyPath: 'ag_farm_credit' }
};

// Reverse lookup: connectome node → agriculture indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_TRADE_INDICATOR / NODE_TO_ENVIRONMENT_
// INDICATOR / NODE_TO_GOVERNANCE_INDICATOR; for diagnosis drill-down).
var NODE_TO_AGRICULTURE_INDICATOR = {};
for (var _agik in AGRICULTURE_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(AGRICULTURE_INDICATOR_BINDING, _agik)) continue;
  var _agib = AGRICULTURE_INDICATOR_BINDING[_agik];
  if (!NODE_TO_AGRICULTURE_INDICATOR[_agib.node]) NODE_TO_AGRICULTURE_INDICATOR[_agib.node] = [];
  NODE_TO_AGRICULTURE_INDICATOR[_agib.node].push(_agib);
}

// ── EDUCATION-SECTOR (SCHOOLS / UNIVERSITIES / EDTECH / SKILLS / COURSEWARE) COMPANY ticker bindings (education gap 1 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_BINDING,
// INDUSTRIAL_COMPANY_BINDING, ENVIRONMENT_SECTOR_COMPANY_BINDING, GOVERNANCE_COMPANY_BINDING
// and AGRICULTURE_COMPANY_BINDING (and to MACRO_INDICATOR_BINDING). NOT merged into the
// default resolve() pipeline and NOT included in NODE_TO_MACRO_INDICATOR — consumed ONLY
// when a context explicitly triggers an education-company-level drill
// (getEducationCompaniesForNode / EDUCATION_COMPANY_BINDING export). Each ticker traces
// TEACHING / LEARNING / CREDENTIALING CAPACITY to a REAL education connectome node (nodes
// are the actual education-domain participations in brain-node-domains.json under the
// 'education' domain: dlPFC=curriculum design/pedagogy, vlPFC=student-outcome trend
// analysis/research, mPFC=enrollment/admissions demographic analysis, AI=assessment &
// diagnostics, V1=student access / admissions-equity / digital inclusion, VP=credentialing
// & recruitment infrastructure, STRI=education-system operations / application process,
// NAcc=student motivation / scenario planning, THAL=education distribution channels /
// admissions-equity capacity, BLA=human-capital / admissions adaptation, AG=higher
// education, BROCA=K-12 teaching). Ticker stress (dir 'low' for all — stress on decline)
// estimates a TEACHING/LEARNING-CAPACITY DEGRADATION that is PURE education identity: a
// CHGG/COUR/DUOL/TWOU decline = online-learning / edtech enrollment & engagement contracts
// → digital-access reach falls; an LRN decline = K-12 virtual-school / curriculum delivery
// pulls back; an ATGE/LOPE/STRA/LAUR decline = higher-ed / university enrollment & degree
// throughput softens; a PSO decline = courseware / assessment-content supply tightens; a
// UTI decline = vocational / skills-training capacity contracts. This is EDUCATION identity
// = schools & universities (K-12 + higher ed), edtech & online learning, student outcomes &
// literacy, teaching & curriculum, education funding & access/equity, workforce training &
// skills, credentialing & enrollment, student debt — DISTINCT from science (research is the
// science domain), population (demographics is a coupling), technology (edtech tooling is a
// coupling routed via TECH_COMPANY_BINDING) and economy (workforce/tuition is a coupling).
// ENERGY is ZERO education identity: edtech platform scaling → data-center load is facility-
// operations coupling (infrastructure domain), training-volume spikes are education-signal
// CONSEQUENCES of enrollment demand, never energy-supply constraints; education nodes carry
// zero energy-domain content and never originate an education-to-energy edge. REAL
// education-sector tickers only.
//   CHGG → online learning / homework help        COUR → MOOC / online-course platform
//   DUOL → language-learning / engagement app      TWOU → online-program management (OPM)
//   LRN  → K-12 virtual schools (Stride)           PSO → courseware / assessment content (Pearson)
//   ATGE → for-profit higher ed (Adtalem)          LOPE → university (Grand Canyon Education)
//   STRA → university (Strategic Education)         LAUR → global higher ed (Laureate)
//   UTI  → vocational / skills training (Universal Technical Institute)
var EDUCATION_COMPANY_BINDING = {
  CHGG: { series: 'CHGG', node: 'AI',    role: 'Online-Learning / Assessment & Diagnostics Capacity', nodeRole: 'Assessment — Diagnostic Analysis',     label: 'Chegg',                       threshold: -19, dir: 'low', kind: 'ticker', industry: 'edtech' },
  COUR: { series: 'COUR', node: 'V1',    role: 'MOOC Platform / Student-Access Reach',                nodeRole: 'Student Access — Digital Inclusion',   label: 'Coursera',                    threshold: -18, dir: 'low', kind: 'ticker', industry: 'edtech' },
  DUOL: { series: 'DUOL', node: 'NAcc',  role: 'Learning-App Engagement / Student Motivation',        nodeRole: 'Student Motivation & Engagement',      label: 'Duolingo',                    threshold: -20, dir: 'low', kind: 'ticker', industry: 'edtech' },
  TWOU: { series: 'TWOU', node: 'THAL',  role: 'Online-Program-Management Distribution Capacity',     nodeRole: 'Education Distribution Channels',       label: '2U',                          threshold: -22, dir: 'low', kind: 'ticker', industry: 'edtech' },
  LRN:  { series: 'LRN',  node: 'mPFC',  role: 'K-12 Virtual-School Enrollment / Admissions Reach',   nodeRole: 'Enrollment & Admissions',              label: 'Stride (K12)',                threshold: -17, dir: 'low', kind: 'ticker', industry: 'edtech' },
  PSO:  { series: 'PSO',  node: 'dlPFC', role: 'Courseware / Curriculum & Pedagogy Supply',           nodeRole: 'Curriculum Design / Pedagogy',         label: 'Pearson',                     threshold: -16, dir: 'low', kind: 'ticker', industry: 'courseware' },
  ATGE: { series: 'ATGE', node: 'STRI',  role: 'For-Profit Higher-Ed System Operations',              nodeRole: 'Education-System Operations',          label: 'Adtalem Global Education',    threshold: -18, dir: 'low', kind: 'ticker', industry: 'higher-ed' },
  LOPE: { series: 'LOPE', node: 'VP',    role: 'University Credentialing / Degree Output',             nodeRole: 'Credentialing & Recruitment',          label: 'Grand Canyon Education',      threshold: -19, dir: 'low', kind: 'ticker', industry: 'higher-ed' },
  STRA: { series: 'STRA', node: 'vlPFC', role: 'University Student-Outcome / Completion Research',     nodeRole: 'Student-Outcome Trend Analysis',       label: 'Strategic Education',         threshold: -18, dir: 'low', kind: 'ticker', industry: 'higher-ed' },
  LAUR: { series: 'LAUR', node: 'BLA',   role: 'Global Higher-Ed Human-Capital Capacity',             nodeRole: 'Admissions — Adaptation & Learning',   label: 'Laureate Education',          threshold: -20, dir: 'low', kind: 'ticker', industry: 'higher-ed' },
  UTI:  { series: 'UTI',  node: 'VP',    role: 'Vocational / Skills-Training Credentialing Capacity', nodeRole: 'Credentialing & Recruitment',          label: 'Universal Technical Institute', threshold: -21, dir: 'low', kind: 'ticker', industry: 'skills' }
};

// Reverse lookup: connectome node → education-sector company tickers it sources from
// (opt-in education-company drill, parallel to NODE_TO_AGRICULTURE_COMPANY).
var NODE_TO_EDUCATION_COMPANY = {};
for (var _edk in EDUCATION_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(EDUCATION_COMPANY_BINDING, _edk)) continue;
  var _edb = EDUCATION_COMPANY_BINDING[_edk];
  if (!NODE_TO_EDUCATION_COMPANY[_edb.node]) NODE_TO_EDUCATION_COMPANY[_edb.node] = [];
  NODE_TO_EDUCATION_COMPANY[_edb.node].push(_edb);
}

// ── EDUCATION-SECTOR INDICATOR bindings (education gap 2 — ADDITIVE, OPT-IN) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1) and AGRICULTURE_INDICATOR_
// BINDING (agriculture gap 2), but for PURE education-domain signals: U.S. Department of
// Education NCES (National Center for Education Statistics) enrollment / graduation /
// literacy data, NAEP (National Assessment of Educational Progress) test scores, student-
// loan delinquency (FFELP / Direct loan data), edtech-company subscriber metrics, college-
// admissions yield, degree-completion rates and teacher-vacancy indices. Binds each REAL
// education metric to the education connectome node that senses it, so the kernel/reporting/
// diagnosis layers can drill from abstract 'education stress' into the ACTUAL education
// signal that triggered it (e.g. curriculum node lit → NAEP math score drop → pedagogy-
// effectiveness shock origin; credentialing node lit → NCES graduation-rate decline →
// degree-output shortfall). These strictly measure EDUCATION identity: learning outcomes,
// student access/reach, credentialing output, human-capital supply, education-system
// solvency (student debt). Student-loan stress is education-FINANCE coupling (to economy /
// finance domains); teacher-shortage is education-WORKFORCE coupling (to population domain) —
// they appear here ONLY as the education-sector SIGNAL, never as the coupled domain's signal.
// NEVER energy production or grid metrics — campus power/cooling load is an INFRASTRUCTURE
// consequence of facility occupancy, never an education-sector stress signal; education nodes
// carry zero energy-domain content. Annotation/registry metadata ONLY — the resolver does NOT
// score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'nces' (NCES enrollment/graduation/literacy) | 'naep' (NAEP test scores) |
//          'debt' (student-loan delinquency / balances) | 'edtech' (edtech subscriber/
//          enrollment metrics) | 'access' (admissions yield / equity / teacher vacancy).
var EDUCATION_INDICATOR_BINDING = {
  // ── NAEP test scores (learning-outcome decline = curriculum-effectiveness stress) ──
  NAEPMath:    { series: 'NAEPMath',    node: 'dlPFC', role: 'NAEP Mathematics Score',    nodeRole: 'Curriculum Design / Pedagogy',         label: 'NAEP Mathematics Assessment', threshold: -3, dir: 'low', kind: 'naep', policyPath: 'education_k12_funding' },
  NAEPReading: { series: 'NAEPReading', node: 'vlPFC', role: 'NAEP Reading / Literacy Score', nodeRole: 'Student-Outcome Trend Analysis',     label: 'NAEP Reading Assessment',     threshold: -3, dir: 'low', kind: 'naep', policyPath: 'education_k12_funding' },
  // ── NCES enrollment / graduation / completion (output decline = credentialing stress) ──
  NCESGradRate:    { series: 'NCESGradRate',    node: 'VP',   role: 'High-School / Degree Graduation Rate', nodeRole: 'Credentialing & Recruitment', label: 'NCES Graduation Rate',         threshold: -2, dir: 'low', kind: 'nces', policyPath: 'education_higher_ed_regulation' },
  NCESEnrollment:  { series: 'NCESEnrollment',  node: 'mPFC', role: 'Postsecondary Enrollment',             nodeRole: 'Enrollment & Admissions',     label: 'NCES Total Enrollment',        threshold: -3, dir: 'low', kind: 'nces', policyPath: 'education_higher_ed_regulation' },
  NCESLiteracy:    { series: 'NCESLiteracy',    node: 'AI',   role: 'Adult Literacy / Numeracy Rate',       nodeRole: 'Assessment & Diagnostics',    label: 'NCES Adult Literacy (PIAAC)',  threshold: -2, dir: 'low', kind: 'nces', policyPath: 'education_k12_funding' },
  // ── Student-loan stress (delinquency/balance spike = education-system solvency stress) ──
  StudentLoanDelinquency: { series: 'StudentLoanDelinquency', node: 'STRI', role: 'Student-Loan Delinquency Rate', nodeRole: 'Education-System Operations', label: 'Federal Student Aid Delinquency', threshold: 9, dir: 'high', kind: 'debt', policyPath: 'education_student_debt' },
  StudentLoanBalance:     { series: 'StudentLoanBalance',     node: 'NAcc', role: 'Outstanding Student-Loan Balance', nodeRole: 'Scenario Planning / Motivation', label: 'FFELP/Direct Loan Balance',     threshold: 8, dir: 'high', kind: 'debt', policyPath: 'education_student_debt' },
  // ── Edtech subscriber / enrollment metrics (engagement drop = access/reach stress) ──
  EdtechEnrollment: { series: 'EdtechEnrollment', node: 'mPFC', role: 'Edtech Active-Learner Enrollment', nodeRole: 'Enrollment & Admissions / Reach', label: 'Edtech Active-Learner Index',  threshold: -5, dir: 'low', kind: 'edtech', policyPath: 'education_higher_ed_regulation' },
  EdtechEngagement: { series: 'EdtechEngagement', node: 'NAcc', role: 'Edtech Engagement / Retention',    nodeRole: 'Student Motivation & Engagement', label: 'Edtech Engagement Index',      threshold: -6, dir: 'low', kind: 'edtech', policyPath: 'education_higher_ed_regulation' },
  // ── Admissions yield / access equity (yield collapse = higher-ed admissions stress) ──
  AdmissionsYield: { series: 'AdmissionsYield', node: 'V1', role: 'College-Admissions Yield / Access',     nodeRole: 'Student Access — Digital Inclusion', label: 'College Admissions Yield',  threshold: -4, dir: 'low', kind: 'access', policyPath: 'education_higher_ed_regulation' },
  // ── Teacher-vacancy index (human-capital shortfall = teaching-capacity stress) ──
  TeacherVacancy: { series: 'TeacherVacancy', node: 'BLA', role: 'Teacher-Vacancy / Human-Capital Index', nodeRole: 'Admissions — Adaptation & Learning', label: 'Teacher Vacancy Index (NCES)', threshold: 7, dir: 'high', kind: 'access', policyPath: 'education_k12_funding' }
};

// Reverse lookup: connectome node → education indicators it senses
// (parallel to NODE_TO_AGRICULTURE_INDICATOR; for diagnosis drill-down).
var NODE_TO_EDUCATION_INDICATOR = {};
for (var _edik in EDUCATION_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(EDUCATION_INDICATOR_BINDING, _edik)) continue;
  var _edib = EDUCATION_INDICATOR_BINDING[_edik];
  if (!NODE_TO_EDUCATION_INDICATOR[_edib.node]) NODE_TO_EDUCATION_INDICATOR[_edib.node] = [];
  NODE_TO_EDUCATION_INDICATOR[_edib.node].push(_edib);
}

// ── SCIENCE-SECTOR (RESEARCH / R&D / LAB-SCIENCE / INSTRUMENTATION) COMPANY ticker bindings (science gap 1 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_BINDING,
// INDUSTRIAL_COMPANY_BINDING, ENVIRONMENT_SECTOR_COMPANY_BINDING, GOVERNANCE_COMPANY_BINDING,
// AGRICULTURE_COMPANY_BINDING and EDUCATION_COMPANY_BINDING (and to MACRO_INDICATOR_BINDING).
// NOT merged into the default resolve() pipeline and NOT included in NODE_TO_MACRO_INDICATOR —
// consumed ONLY when a context explicitly triggers a science-company-level drill
// (getScienceCompaniesForNode / SCIENCE_COMPANY_BINDING export). DUAL-KEY NOTE: 'science' is the
// URL/portal key; the runtime/snapshot key is 'research' (see assets/js/domain-identity.js —
// snapshotKey('science') = 'research'). In brain-node-domains.json the node-participation domain
// is literally 'science', so the connectome-domain key used here and in activateNodes() is
// 'science'; downstream snapshot code that reads the runtime key uses 'research'. Each ticker
// traces RESEARCH-CAPACITY to a REAL science connectome node (the actual 'science'-domain
// participations in brain-node-domains.json: DMN=hypothesis generation, dlPFC=experimental
// design, M1=laboratory methods, FPN=data analysis, ECN=statistical inference, HYPO=biology &
// life sciences, OFC=chemistry, vmPFC=funding & grants, MGN=research workforce, MFC=shared
// facilities, VP=research infrastructure & capacity, dACC=peer review). Ticker stress
// (dir 'low' for all — stress on decline) estimates RESEARCH-CAPACITY DEGRADATION: a TMO decline =
// life-sciences R&D / instrument supply constrained → reagent & instrument throughput falls; a
// DHR decline = analytical-lab / diagnostic-research capacity strained; an A/MTD/WAT decline =
// analytical-instrument / mass-spec / chromatography measurement capacity pulls back; an ILMN
// decline = genomic-sequencing throughput contracts; a BIO/RVTY/BRKR decline = biotech &
// life-science R&D-tooling / detection-instrumentation pipeline tightens; an IQV/ICLR decline =
// research-services / clinical-research operations capacity softens. This is SCIENCE identity =
// fundamental & applied research, R&D pipelines, academic & lab science, peer review &
// publication, research funding & grants, scientific instruments & methods, innovation pipeline —
// DISTINCT from technology (applied product dev is a COUPLING routed via TECH_COMPANY_BINDING;
// NVDA/MSFT/GOOGL route through tech nodes, never science), medicine (clinical research is a
// COUPLING — TMO/DHR clinical-diagnostic surfaces live in the health connectome separately) and
// education (academic TEACHING is the education coupling; research universities appear here for
// research-OUTPUT identity, not teaching capacity). ENERGY is ZERO science identity: R&D facility
// power / lab electricity / HPC data-center compute for simulations couple DOWNSTREAM only (route
// via infrastructure/technology nodes when the origin is compute stress) and NEVER originate a
// science signal; science nodes carry zero energy-domain content. REAL research-sector tickers only.
//   TMO → life-sciences R&D instruments & reagents   DHR → analytical-lab / diagnostic research
//   A   → analytical instruments (Agilent)           MTD → precision lab balances & analytics (Mettler-Toledo)
//   WAT → chromatography / mass-spec (Waters)         ILMN → genomic sequencing throughput (Illumina)
//   BIO → biotech / life-science R&D tooling (Bio-Rad)  RVTY → life-science detection (Revvity)
//   BRKR → scientific instrumentation (Bruker)        IQV → research services / data (IQVIA)
//   ICLR → clinical-research operations (ICON plc)
var SCIENCE_COMPANY_BINDING = {
  TMO:  { series: 'TMO',  node: 'M1',    role: 'Life-Sciences R&D Instrument & Reagent Supply',   nodeRole: 'Laboratory Methods',                  label: 'Thermo Fisher Scientific', threshold: -16, dir: 'low', kind: 'ticker', industry: 'lab-science' },
  DHR:  { series: 'DHR',  node: 'FPN',   role: 'Analytical-Lab / Diagnostic-Research Capacity',   nodeRole: 'Data Analysis',                       label: 'Danaher',                  threshold: -17, dir: 'low', kind: 'ticker', industry: 'analytical-lab' },
  A:    { series: 'A',    node: 'OFC',   role: 'Analytical-Instrument / Chemistry Measurement Capacity', nodeRole: 'Chemistry',                    label: 'Agilent Technologies',     threshold: -18, dir: 'low', kind: 'ticker', industry: 'instrumentation' },
  MTD:  { series: 'MTD',  node: 'ECN',   role: 'Precision Measurement / Statistical-Instrument Capacity', nodeRole: 'Statistical Inference',       label: 'Mettler-Toledo',           threshold: -19, dir: 'low', kind: 'ticker', industry: 'instrumentation' },
  WAT:  { series: 'WAT',  node: 'OFC',   role: 'Chromatography / Mass-Spec Method Capacity',      nodeRole: 'Chemistry',                           label: 'Waters Corporation',       threshold: -20, dir: 'low', kind: 'ticker', industry: 'instrumentation' },
  ILMN: { series: 'ILMN', node: 'HYPO',  role: 'Genomic-Sequencing Throughput Capacity',          nodeRole: 'Biology and Life Sciences',           label: 'Illumina',                 threshold: -22, dir: 'low', kind: 'ticker', industry: 'genomics' },
  BIO:  { series: 'BIO',  node: 'HAB',   role: 'Biotech / Life-Science R&D-Tooling Pipeline',     nodeRole: 'Citation Networks Research & Development', label: 'Bio-Rad Laboratories',  threshold: -21, dir: 'low', kind: 'ticker', industry: 'biotech-rnd' },
  RVTY: { series: 'RVTY', node: 'AI',    role: 'Life-Science Detection / Diagnostics Capacity',   nodeRole: 'Alternative Metrics Assessment & Diagnostics', label: 'Revvity',         threshold: -20, dir: 'low', kind: 'ticker', industry: 'life-science-detection' },
  BRKR: { series: 'BRKR', node: 'MFC',   role: 'Scientific-Instrumentation / Shared-Facility Capacity', nodeRole: 'Shared Facilities — Optimization & Innovation', label: 'Bruker', threshold: -23, dir: 'low', kind: 'ticker', industry: 'instrumentation' },
  IQV:  { series: 'IQV',  node: 'VP',    role: 'Research-Services / Infrastructure Capacity',     nodeRole: 'Citation Networks Infrastructure & Capacity', label: 'IQVIA Holdings',    threshold: -18, dir: 'low', kind: 'ticker', industry: 'research-services' },
  ICLR: { series: 'ICLR', node: 'dlPFC', role: 'Clinical-Research / Experimental-Operations Capacity', nodeRole: 'Experimental Design',           label: 'ICON plc',                 threshold: -19, dir: 'low', kind: 'ticker', industry: 'research-services' }
};

// Reverse lookup: connectome node → science-sector company tickers it sources from
// (opt-in science-company drill, parallel to NODE_TO_AGRICULTURE_COMPANY /
// NODE_TO_EDUCATION_COMPANY). science gap 3 (company half).
var NODE_TO_SCIENCE_COMPANY = {};
for (var _sck in SCIENCE_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(SCIENCE_COMPANY_BINDING, _sck)) continue;
  var _scb = SCIENCE_COMPANY_BINDING[_sck];
  if (!NODE_TO_SCIENCE_COMPANY[_scb.node]) NODE_TO_SCIENCE_COMPANY[_scb.node] = [];
  NODE_TO_SCIENCE_COMPANY[_scb.node].push(_scb);
}

// ── SCIENCE-SECTOR INDICATOR bindings (science gap 2 — ADDITIVE, OPT-IN) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), AGRICULTURE_INDICATOR_BINDING
// (agriculture gap 2) and EDUCATION_INDICATOR_BINDING (education gap 2), but for PURE science /
// research-performance signals: NSF/NIH grant-funding volume & approval rate, arXiv/Nature/
// OpenAlex publication velocity & citation impact, peer-review turnaround time, research-article
// retraction rate, lab-equipment downtime / utilization, research-staff / PhD-student enrollment
// trends, research-commercialization pipeline (startup formation / USPTO patent-filing rate from
// research output), and R&D budget allocation (company / government). Binds each REAL research
// metric to the science connectome node (domain 'science' in brain-node-domains.json; runtime/
// snapshot key 'research') that senses it, so the kernel/reporting/diagnosis layers can drill
// from abstract 'science stress' into the ACTUAL research signal that triggered it (e.g.
// funding node lit → NSF grant volume collapse → research-funding shock origin; peer-review node
// lit → Nature turnaround blowout → editorial-throughput bottleneck). These strictly measure
// SCIENCE identity: research OUTPUTS (publications, peer-review, grant awards, research patents),
// research CAPACITY (lab equipment utilization, research staff, academic infrastructure),
// research DISCOVERY (hypothesis testing, experimental design, data collection). Publication lag
// may COUPLE to compute availability downstream, but the signal ORIGIN is editorial / peer-review
// throughput, never energy — lab power consumption is a facility-operations CONSEQUENCE of research
// activity, never a research-signal origin; science nodes carry zero energy-domain content.
// DISTINCT from education (enrollment / course-enrollment is the education coupling) and technology
// (patent filing in TECH is an innovation-debt channel routed via the tech circuit, not pure
// research). Real authority sources only (NSF, NIH, arXiv, Nature, OpenAlex, USPTO, NASA).
// Annotation/registry metadata ONLY — the resolver does NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'grants' (NSF/NIH funding) | 'publications' (arXiv/Nature/OpenAlex velocity & impact) |
//          'peer-review' (turnaround) | 'retractions' | 'utilization' (lab-equipment/staff) |
//          'commercialization' (startup/patent) | 'staffing' (research workforce / PhD enrollment).
var SCIENCE_INDICATOR_BINDING = {
  // ── NSF / NIH grant funding (funding-volume / approval collapse = research-funding stress) ──
  NSFGrantVolume:   { series: 'NSFGrantVolume',   node: 'vmPFC', role: 'NSF Grant-Funding Volume',         nodeRole: 'Funding and Grants',                      label: 'NSF Award Volume',              threshold: -4, dir: 'low',  kind: 'grants',        policyPath: 'research_funding' },
  NIHApprovalRate:  { series: 'NIHApprovalRate',  node: 'vmPFC', role: 'NIH Grant Approval / Success Rate', nodeRole: 'Funding and Grants',                      label: 'NIH R01 Success Rate',          threshold: -3, dir: 'low',  kind: 'grants',        policyPath: 'research_funding' },
  RnDBudgetAlloc:   { series: 'RnDBudgetAlloc',   node: 'PRC',   role: 'Federal R&D Budget Allocation',     nodeRole: 'Policy Sci',                              label: 'Federal R&D Budget (AAAS)',     threshold: -5, dir: 'low',  kind: 'grants',        policyPath: 'research_funding' },
  // ── Publication velocity & citation impact (output decline = research-productivity stress) ──
  ArxivSubmissions: { series: 'ArxivSubmissions', node: 'BROCA', role: 'arXiv Preprint Submission Velocity', nodeRole: 'Publication and Dissemination',          label: 'arXiv Submission Rate',         threshold: -4, dir: 'low',  kind: 'publications',  policyPath: 'research_regulation' },
  NaturePubVelocity:{ series: 'NaturePubVelocity',node: 'DMN',   role: 'Peer-Reviewed Publication Velocity', nodeRole: 'Hypothesis Generation',                  label: 'Nature/Science Publication Rate', threshold: -3, dir: 'low', kind: 'publications',  policyPath: 'research_regulation' },
  OpenAlexCitation: { series: 'OpenAlexCitation', node: 'VTA',   role: 'Citation-Impact Index',             nodeRole: 'Citation Analysis Technology & Innovation', label: 'OpenAlex Citation Impact',    threshold: -4, dir: 'low',  kind: 'publications',  policyPath: 'research_regulation' },
  // ── Peer-review turnaround (turnaround blowout = editorial-throughput bottleneck) ──
  PeerReviewTAT:    { series: 'PeerReviewTAT',    node: 'dACC',  role: 'Peer-Review Turnaround Time',       nodeRole: 'Peer Review',                             label: 'Peer-Review Turnaround (days)', threshold: 120, dir: 'high', kind: 'peer-review',   policyPath: 'research_regulation' },
  // ── Retraction rate (retraction spike = research-integrity stress) ──
  RetractionRate:   { series: 'RetractionRate',   node: 'BBB',   role: 'Research-Article Retraction Rate',  nodeRole: 'manipulation retraction — Signal Acquisition', label: 'Retraction Watch Rate',    threshold: 6,   dir: 'high', kind: 'retractions',   policyPath: 'research_regulation' },
  // ── Lab-equipment / staff utilization (utilization drop = research-capacity stress) ──
  LabEquipUtil:     { series: 'LabEquipUtil',     node: 'MFC',   role: 'Lab-Equipment / Shared-Facility Utilization', nodeRole: 'Shared Facilities — Optimization & Innovation', label: 'Core-Facility Utilization', threshold: -5, dir: 'low', kind: 'utilization', policyPath: 'research_funding' },
  ResearchStaffing: { series: 'ResearchStaffing', node: 'MGN',   role: 'Research-Staff / PhD-Enrollment Trend', nodeRole: 'Workforce',                           label: 'Research Workforce Index (NSF SED)', threshold: -3, dir: 'low', kind: 'staffing',    policyPath: 'research_funding' },
  // ── Commercialization pipeline (startup/patent decline = research-translation stress) ──
  ResearchPatents:  { series: 'ResearchPatents',  node: 'VIA',   role: 'Research-Origin Patent-Filing Rate', nodeRole: 'Economic Impact — State Assessment',     label: 'USPTO Research Patent Filings',  threshold: -4, dir: 'low',  kind: 'commercialization', policyPath: 'research_regulation' },
  SpinoutFormation: { series: 'SpinoutFormation', node: 'PPA',   role: 'Research-Spinout / Startup Formation', nodeRole: 'Societal Impact — State Assessment',    label: 'University Spinout Formation',   threshold: -5, dir: 'low',  kind: 'commercialization', policyPath: 'research_regulation' }
};

// Reverse lookup: connectome node → science indicators it senses
// (parallel to NODE_TO_AGRICULTURE_INDICATOR / NODE_TO_EDUCATION_INDICATOR; for diagnosis
// drill-down). science gap 3 (indicator half).
var NODE_TO_SCIENCE_INDICATOR = {};
for (var _scik in SCIENCE_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(SCIENCE_INDICATOR_BINDING, _scik)) continue;
  var _scib = SCIENCE_INDICATOR_BINDING[_scik];
  if (!NODE_TO_SCIENCE_INDICATOR[_scib.node]) NODE_TO_SCIENCE_INDICATOR[_scib.node] = [];
  NODE_TO_SCIENCE_INDICATOR[_scib.node].push(_scib);
}

// ── COMMUNICATION-SECTOR (TELECOM / MEDIA / BROADCASTING / PLATFORMS) COMPANY ticker bindings (communication gap 1 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_BINDING,
// INDUSTRIAL_COMPANY_BINDING, ENVIRONMENT_SECTOR_COMPANY_BINDING, GOVERNANCE_COMPANY_BINDING
// and AGRICULTURE_COMPANY_BINDING (and to MACRO_INDICATOR_BINDING). NOT merged into the
// default resolve() pipeline and NOT included in NODE_TO_MACRO_INDICATOR — consumed ONLY
// when a context explicitly triggers a communication-company-level drill
// (getCommCompaniesForNode / COMMUNICATION_COMPANY_BINDING export). Each ticker traces
// TELECOMMUNICATIONS / MEDIA / BROADCASTING CAPACITY to a REAL communication connectome
// node (the actual communication-domain participations in brain-node-domains.json:
// CC=Telecommunications, BROCA=Journalism, A1=Broadcasting, FEF=Satellite Systems,
// FPN=Internet Infrastructure, V1=Photography/Visual Media, dlPFC=Medialaw, NAcc=Social Media).
// Ticker stress (dir 'low' for all — stress on decline) estimates a COMMUNICATION-CAPACITY
// DEGRADATION that is PURE communication identity: a VZ/T/TMUS decline = wireless coverage /
// bandwidth capacity strained; a CMCSA/CHTR decline = cable broadband distribution capacity
// constrained; a CSCO/ANET decline = network-routing / switching capacity falls; an
// AMT/CCI/SBAC decline = tower / fiber / data-center infrastructure capacity tightens; an
// NWSA/NYT decline = editorial / news-gathering capacity softens; a META/GOOGL decline =
// platform distribution / content-routing capacity constrained. This is COMMUNICATION
// identity = telecommunications networks, broadcast channels, news-flow infrastructure,
// platform distribution — DISTINCT from technology (chips/software is a coupling routed via
// TECH_COMPANY_BINDING), culture (content/movements/scenes is a coupling, not the channel)
// and intelligence (signals collection is a coupling). ENERGY is PURELY a downstream
// SECOND-ORDER consequence, never the identity: data-center cooling rises when platforms
// (META/GOOGL) and infrastructure (AMT/CCI/SBAC, CSCO/ANET) scale, but those route ONLY as
// company-ticker stress to communication nodes — they NEVER originate a communication-to-
// energy edge and communication nodes carry ZERO energy-domain content (no oil/gas
// production, no grid ops). REAL telecom / media / platform tickers only.
//   VZ/T/TMUS  → wireless coverage & bandwidth         CMCSA/CHTR → cable broadband distribution
//   CSCO/ANET  → network routing & switching           AMT/CCI/SBAC → tower / fiber / DC infrastructure
//   NWSA/NYT   → editorial / news-gathering            META/GOOGL → platform distribution / content routing
var COMMUNICATION_COMPANY_BINDING = {
  VZ:    { series: 'VZ',    node: 'CC',    role: 'Wireless Coverage / Bandwidth Capacity',          nodeRole: 'Telecommunications',          label: 'Verizon Communications',  threshold: -15, dir: 'low', kind: 'ticker', industry: 'wireless-telecom' },
  T:     { series: 'T',     node: 'CC',    role: 'Wireless / Broadband Network Capacity',           nodeRole: 'Telecommunications',          label: 'AT&T',                    threshold: -16, dir: 'low', kind: 'ticker', industry: 'wireless-telecom' },
  TMUS:  { series: 'TMUS',  node: 'CC',    role: 'Wireless Coverage / Spectrum Capacity',           nodeRole: 'Telecommunications',          label: 'T-Mobile US',             threshold: -17, dir: 'low', kind: 'ticker', industry: 'wireless-telecom' },
  CMCSA: { series: 'CMCSA', node: 'FPN',   role: 'Cable Broadband Distribution Capacity',           nodeRole: 'Internet Infrastructure',     label: 'Comcast',                 threshold: -16, dir: 'low', kind: 'ticker', industry: 'cable-broadband' },
  CHTR:  { series: 'CHTR',  node: 'FPN',   role: 'Cable Broadband Distribution Capacity',           nodeRole: 'Internet Infrastructure',     label: 'Charter Communications',  threshold: -18, dir: 'low', kind: 'ticker', industry: 'cable-broadband' },
  CSCO:  { series: 'CSCO',  node: 'FPN',   role: 'Network Routing / Switching Capacity',            nodeRole: 'Internet Infrastructure',     label: 'Cisco Systems',           threshold: -15, dir: 'low', kind: 'ticker', industry: 'network-equipment' },
  ANET:  { series: 'ANET',  node: 'FEF',   role: 'High-Speed Network Switching Capacity',           nodeRole: 'Satellite Systems',           label: 'Arista Networks',         threshold: -20, dir: 'low', kind: 'ticker', industry: 'network-switching' },
  AMT:   { series: 'AMT',   node: 'FEF',   role: 'Tower / Wireless-Site Infrastructure Capacity',   nodeRole: 'Satellite Systems',           label: 'American Tower',          threshold: -17, dir: 'low', kind: 'ticker', industry: 'tower-infrastructure' },
  CCI:   { series: 'CCI',   node: 'FEF',   role: 'Tower / Fiber Infrastructure Capacity',           nodeRole: 'Satellite Systems',           label: 'Crown Castle',            threshold: -18, dir: 'low', kind: 'ticker', industry: 'tower-infrastructure' },
  SBAC:  { series: 'SBAC',  node: 'FEF',   role: 'Tower / Site Infrastructure Capacity',            nodeRole: 'Satellite Systems',           label: 'SBA Communications',      threshold: -19, dir: 'low', kind: 'ticker', industry: 'tower-infrastructure' },
  NWSA:  { series: 'NWSA',  node: 'BROCA', role: 'Editorial / News-Gathering Capacity',             nodeRole: 'Journalism',                  label: 'News Corp',               threshold: -16, dir: 'low', kind: 'ticker', industry: 'news-media' },
  NYT:   { series: 'NYT',   node: 'BROCA', role: 'Editorial / News-Gathering Capacity',             nodeRole: 'Journalism',                  label: 'The New York Times Co.',  threshold: -17, dir: 'low', kind: 'ticker', industry: 'news-media' },
  META:  { series: 'META',  node: 'NAcc',  role: 'Platform Distribution / Content-Routing Capacity', nodeRole: 'Social Media',               label: 'Meta Platforms',          threshold: -18, dir: 'low', kind: 'ticker', industry: 'social-platform' },
  GOOGL: { series: 'GOOGL', node: 'NAcc',  role: 'Platform Distribution / Search-Routing Capacity',  nodeRole: 'Social Media',               label: 'Alphabet',                threshold: -17, dir: 'low', kind: 'ticker', industry: 'platform-distribution' }
};

// Reverse lookup: connectome node → communication-sector company tickers it sources from
// (opt-in communication-company drill, parallel to NODE_TO_TECH_COMPANY /
// NODE_TO_INTEL_COMPANY / NODE_TO_TRADE_COMPANY / NODE_TO_INDUSTRIAL_COMPANY /
// NODE_TO_ENVIRONMENT_COMPANY / NODE_TO_GOVERNANCE_COMPANY / NODE_TO_AGRICULTURE_COMPANY).
var NODE_TO_COMMUNICATION_COMPANY = {};
for (var _cmk in COMMUNICATION_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(COMMUNICATION_COMPANY_BINDING, _cmk)) continue;
  var _cmb = COMMUNICATION_COMPANY_BINDING[_cmk];
  if (!NODE_TO_COMMUNICATION_COMPANY[_cmb.node]) NODE_TO_COMMUNICATION_COMPANY[_cmb.node] = [];
  NODE_TO_COMMUNICATION_COMPANY[_cmb.node].push(_cmb);
}

// ── COMMUNICATION-SECTOR INDICATOR bindings (communication gap 2 — ADDITIVE, OPT-IN) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), INTELLIGENCE_INDICATOR_
// BINDING, TRADE_INDICATOR_BINDING, ENVIRONMENT_INDICATOR_BINDING, GOVERNANCE_INDICATOR_
// BINDING and AGRICULTURE_INDICATOR_BINDING, but for PURE communication-infrastructure
// signals: FCC broadband speed (Mbps) & rural-coverage %, spectrum-auction revenue &
// available MHz, Nielsen/Arbitron broadcast viewership & reach, BLS employment in
// journalism / media production, and platform Daily-Active-Users / engagement metrics.
// Binds each REAL communication metric to the communication connectome node that senses
// it, so the kernel/reporting/diagnosis layers can drill from abstract 'communication
// stress' into the ACTUAL signal that triggered it (e.g. FPN Internet-Infrastructure node
// lit → broadband-coverage index fell → connectivity-gap shock origin; A1 Broadcasting
// node lit → Nielsen reach collapsed → audience-reach shock). These strictly measure
// COMMUNICATION identity: network capacity, coverage, audience reach, editorial workforce,
// platform engagement. NEVER measure energy — data-center SLA/uptime is a governance/
// infrastructure coupling, not a communication signal; a platform power-consumption spike
// when scaling is a DOWNSTREAM consequence, not the origin signal; communication nodes
// carry zero energy-domain content. Annotation/registry metadata ONLY — the resolver does
// NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'broadband' (FCC speed/coverage) | 'spectrum' (auction revenue / available MHz)
//          | 'viewership' (Nielsen/Arbitron reach) | 'workforce' (BLS media employment)
//          | 'engagement' (platform DAU / engagement).
var COMMUNICATION_INDICATOR_BINDING = {
  // ── FCC broadband speed / rural coverage (connectivity-gap on decline) ──
  FCCBroadbandSpeed: { series: 'FCCBroadbandSpeed', node: 'FPN', role: 'Broadband Speed (Mbps)',       nodeRole: 'Internet Infrastructure', label: 'FCC Median Broadband Speed (Mbps)', threshold: -6, dir: 'low', kind: 'broadband', policyPath: 'comm_connectivity' },
  FCCRuralCoverage:  { series: 'FCCRuralCoverage',  node: 'CC',  role: 'Rural Broadband Coverage (%)', nodeRole: 'Telecommunications',      label: 'FCC Rural Broadband Coverage %',    threshold: -3, dir: 'low', kind: 'broadband', policyPath: 'comm_connectivity' },
  // ── Spectrum-auction signals (capacity scarcity: revenue spike / available-MHz collapse) ──
  SpectrumAuctionRev: { series: 'SpectrumAuctionRev', node: 'CC',  role: 'Spectrum-Auction Revenue',    nodeRole: 'Telecommunications', label: 'FCC Spectrum-Auction Revenue',  threshold: 10, dir: 'high', kind: 'spectrum', policyPath: 'comm_spectrum' },
  SpectrumAvailMHz:   { series: 'SpectrumAvailMHz',   node: 'FEF', role: 'Available Spectrum (MHz)',     nodeRole: 'Satellite Systems',  label: 'FCC Available Spectrum (MHz)',   threshold: -5, dir: 'low',  kind: 'spectrum', policyPath: 'comm_spectrum' },
  // ── Nielsen / Arbitron broadcast viewership & reach (audience-reach collapse) ──
  NielsenViewership: { series: 'NielsenViewership', node: 'A1',    role: 'Broadcast Viewership',  nodeRole: 'Broadcasting', label: 'Nielsen Broadcast Viewership', threshold: -7, dir: 'low', kind: 'viewership', policyPath: 'comm_audience_reach' },
  ArbitronReach:     { series: 'ArbitronReach',     node: 'BROCA', role: 'News / Audio Reach',    nodeRole: 'Journalism',   label: 'Arbitron / Nielsen Audio Reach', threshold: -6, dir: 'low', kind: 'viewership', policyPath: 'comm_audience_reach' },
  // ── BLS employment in journalism / media production (editorial-workforce contraction) ──
  BLSJournalismJobs: { series: 'BLSJournalismJobs', node: 'BROCA', role: 'Journalist Employment',        nodeRole: 'Journalism',                label: 'BLS Employment — News Analysts/Reporters/Journalists', threshold: -4, dir: 'low', kind: 'workforce', policyPath: 'comm_editorial_workforce' },
  BLSMediaProdJobs:  { series: 'BLSMediaProdJobs',  node: 'V1',    role: 'Media-Production Employment',   nodeRole: 'Photography & Visual Media', label: 'BLS Employment — Media & Communication Production',     threshold: -4, dir: 'low', kind: 'workforce', policyPath: 'comm_editorial_workforce' },
  // ── Platform Daily-Active-Users / engagement (distribution-engagement collapse) ──
  PlatformDAU:        { series: 'PlatformDAU',        node: 'NAcc',  role: 'Platform Daily Active Users',  nodeRole: 'Social Media', label: 'Aggregate Platform Daily Active Users', threshold: -5, dir: 'low', kind: 'engagement', policyPath: 'comm_platform_engagement' },
  PlatformEngagement: { series: 'PlatformEngagement', node: 'dlPFC', role: 'Platform Engagement Index',    nodeRole: 'Medialaw',     label: 'Platform Engagement / Time-on-Platform Index', threshold: -6, dir: 'low', kind: 'engagement', policyPath: 'comm_platform_engagement' }
};

// Reverse lookup: connectome node → communication indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_TRADE_INDICATOR / NODE_TO_ENVIRONMENT_
// INDICATOR / NODE_TO_GOVERNANCE_INDICATOR / NODE_TO_AGRICULTURE_INDICATOR; for diagnosis drill-down).
var NODE_TO_COMMUNICATION_INDICATOR = {};
for (var _cmik in COMMUNICATION_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(COMMUNICATION_INDICATOR_BINDING, _cmik)) continue;
  var _cmib = COMMUNICATION_INDICATOR_BINDING[_cmik];
  if (!NODE_TO_COMMUNICATION_INDICATOR[_cmib.node]) NODE_TO_COMMUNICATION_INDICATOR[_cmib.node] = [];
  NODE_TO_COMMUNICATION_INDICATOR[_cmib.node].push(_cmib);
}

// ── HEALTHCARE-SECTOR (MEDICINE / HEALTH) COMPANY bindings (medicine gap 1 — ADDITIVE, OPT-IN) ──
// Parallel structure to TECH_COMPANY_BINDING, INTELLIGENCE_COMPANY_BINDING, TRADE_COMPANY_
// BINDING, INDUSTRIAL_COMPANY_BINDING, ENVIRONMENT_SECTOR_COMPANY_BINDING, GOVERNANCE_
// COMPANY_BINDING, AGRICULTURE_COMPANY_BINDING and COMMUNICATION_COMPANY_BINDING — but for
// PURE healthcare identity. Medicine was the only major domain WITHOUT company-level ticker
// bindings despite 123 medicine connectome nodes and 11 opportunity playbooks that reference
// healthcare tickers. Runtime key for this domain is 'health' (URL/portal key = 'medicine';
// see domain-identity.js medicine↔health dual-naming). Real healthcare companies routed to
// the medicine node that senses their clinical/operational stress:
//   Pharma     JNJ/PFE/MRK/ABBV/LLY/AMGN/GILD → HYPO/STRI (Pharmacy / drug-development pipeline)
//   Devices    ABT/MDT/SYK/ISRG               → CARD/M1   (Cardiology / Surgery / Surgical Robotics)
//   Diagnostics GH/EXAS/DXCM                  → LGN/V1/PULV (Diagnostics / Patient Monitoring)
//   Hospitals  HCA/UHS/THC                    → mPFC/THAL  (Primary Care / Hospital Operations)
//   Insurance  UNH/HUM/CNC/CVS                → STRI/VP    (Claims / Underwriting circuits)
//   Telehealth TDOC/AMWL/HIMS/VEEV           → PCC        (Telehealth / virtual-care delivery)
// Energy is ZERO healthcare identity: facility power SLA / OR-HVAC sterility is a second-order
// facility-operations coupling that applies to ALL facility-based enterprises, NOT a medicine
// signal; these tickers are healthcare-identity companies (not energy producers/distributors),
// the stress origin is ALWAYS medicine (drug-approval delay, surgical-capacity shortage,
// insurance underwriting risk) — energy is never the initiating signal. Energy-coupling
// stocks (EXC, NextEra, utilities) are excluded. Annotation/registry metadata ONLY — the
// resolver does NOT score these.
var HEALTHCARE_COMPANY_BINDING = {
  // ── Pharmaceuticals / biotech (drug-development pipeline & pharmacy supply) ──
  JNJ:  { series: 'JNJ',  node: 'HYPO', role: 'Pharmaceutical Pipeline / Drug Supply',   nodeRole: 'Pharmacy',                  label: 'Johnson & Johnson',     threshold: -14, dir: 'low', kind: 'ticker', industry: 'pharmaceuticals' },
  PFE:  { series: 'PFE',  node: 'HYPO', role: 'Pharmaceutical Pipeline / Drug Supply',   nodeRole: 'Pharmacy',                  label: 'Pfizer',                threshold: -16, dir: 'low', kind: 'ticker', industry: 'pharmaceuticals' },
  MRK:  { series: 'MRK',  node: 'HYPO', role: 'Pharmaceutical Pipeline / Drug Supply',   nodeRole: 'Pharmacy',                  label: 'Merck & Co.',           threshold: -15, dir: 'low', kind: 'ticker', industry: 'pharmaceuticals' },
  ABBV: { series: 'ABBV', node: 'STRI', role: 'Biopharma Pipeline / Revenue Risk',       nodeRole: 'Pharmacy',                  label: 'AbbVie',                threshold: -16, dir: 'low', kind: 'ticker', industry: 'pharmaceuticals' },
  LLY:  { series: 'LLY',  node: 'STRI', role: 'Biopharma Pipeline / Revenue Risk',       nodeRole: 'Pharmacy',                  label: 'Eli Lilly',             threshold: -15, dir: 'low', kind: 'ticker', industry: 'pharmaceuticals' },
  AMGN: { series: 'AMGN', node: 'HYPO', role: 'Biotech Pipeline / Drug Supply',          nodeRole: 'Pharmacy',                  label: 'Amgen',                 threshold: -17, dir: 'low', kind: 'ticker', industry: 'biotech' },
  GILD: { series: 'GILD', node: 'HYPO', role: 'Biotech Pipeline / Drug Supply',          nodeRole: 'Pharmacy',                  label: 'Gilead Sciences',       threshold: -17, dir: 'low', kind: 'ticker', industry: 'biotech' },
  // ── Medical devices (cardiology / surgery / surgical robotics) ──
  ABT:  { series: 'ABT',  node: 'CARD', role: 'Medical-Device Market / Cardiology',      nodeRole: 'Cardiology',                label: 'Abbott Laboratories',   threshold: -15, dir: 'low', kind: 'ticker', industry: 'medical-devices' },
  MDT:  { series: 'MDT',  node: 'CARD', role: 'Medical-Device Market / Cardiology',      nodeRole: 'Cardiology',                label: 'Medtronic',             threshold: -16, dir: 'low', kind: 'ticker', industry: 'medical-devices' },
  SYK:  { series: 'SYK',  node: 'M1',   role: 'Surgical-Device Market / Orthopedics',    nodeRole: 'Surgery',                   label: 'Stryker',               threshold: -17, dir: 'low', kind: 'ticker', industry: 'medical-devices' },
  ISRG: { series: 'ISRG', node: 'M1',   role: 'Surgical-Robotics Capacity',              nodeRole: 'Surgical Robotics',         label: 'Intuitive Surgical',    threshold: -19, dir: 'low', kind: 'ticker', industry: 'surgical-robotics' },
  // ── Diagnostics (molecular dx / monitoring) ──
  GH:   { series: 'GH',   node: 'LGN',  role: 'Diagnostics Throughput / Liquid Biopsy',  nodeRole: 'Diagnostics',               label: 'Guardant Health',       threshold: -20, dir: 'low', kind: 'ticker', industry: 'diagnostics' },
  EXAS: { series: 'EXAS', node: 'V1',   role: 'Diagnostics Throughput / Screening',      nodeRole: 'Diagnostics',               label: 'Exact Sciences',        threshold: -20, dir: 'low', kind: 'ticker', industry: 'diagnostics' },
  DXCM: { series: 'DXCM', node: 'PULV', role: 'Patient Monitoring / Glucose Sensing',    nodeRole: 'Patient Monitoring',        label: 'DexCom',                threshold: -19, dir: 'low', kind: 'ticker', industry: 'patient-monitoring' },
  // ── Hospitals / care providers (capacity utilization) ──
  HCA:  { series: 'HCA',  node: 'mPFC', role: 'Hospital Capacity / Care Delivery',       nodeRole: 'Primary Care',              label: 'HCA Healthcare',        threshold: -15, dir: 'low', kind: 'ticker', industry: 'hospitals' },
  UHS:  { series: 'UHS',  node: 'THAL', role: 'Hospital Operations / Bed Capacity',      nodeRole: 'Hospital Operations',       label: 'Universal Health Services', threshold: -17, dir: 'low', kind: 'ticker', industry: 'hospitals' },
  THC:  { series: 'THC',  node: 'THAL', role: 'Hospital Operations / Bed Capacity',      nodeRole: 'Hospital Operations',       label: 'Tenet Healthcare',      threshold: -18, dir: 'low', kind: 'ticker', industry: 'hospitals' },
  // ── Insurance / health systems (claims & underwriting) ──
  UNH:  { series: 'UNH',  node: 'STRI', role: 'Insurance Claims / Underwriting Risk',    nodeRole: 'Health Insurance',          label: 'UnitedHealth Group',    threshold: -14, dir: 'low', kind: 'ticker', industry: 'health-insurance' },
  HUM:  { series: 'HUM',  node: 'STRI', role: 'Insurance Claims / Underwriting Risk',    nodeRole: 'Health Insurance',          label: 'Humana',                threshold: -16, dir: 'low', kind: 'ticker', industry: 'health-insurance' },
  CNC:  { series: 'CNC',  node: 'VP',   role: 'Managed-Care Claims / Medicaid Risk',     nodeRole: 'Health Insurance',          label: 'Centene',               threshold: -18, dir: 'low', kind: 'ticker', industry: 'health-insurance' },
  CVS:  { series: 'CVS',  node: 'VP',   role: 'Pharmacy-Benefit / Insurance Claims',     nodeRole: 'Health Insurance',          label: 'CVS Health',            threshold: -15, dir: 'low', kind: 'ticker', industry: 'health-insurance' },
  // ── Telehealth / virtual care & health-IT ──
  TDOC: { series: 'TDOC', node: 'PCC',  role: 'Telehealth Visit Volume / Virtual Care',  nodeRole: 'Telehealth',                label: 'Teladoc Health',        threshold: -22, dir: 'low', kind: 'ticker', industry: 'telehealth' },
  AMWL: { series: 'AMWL', node: 'PCC',  role: 'Telehealth Visit Volume / Virtual Care',  nodeRole: 'Telehealth',                label: 'Amwell',                threshold: -25, dir: 'low', kind: 'ticker', industry: 'telehealth' },
  HIMS: { series: 'HIMS', node: 'PCC',  role: 'Direct-to-Consumer Telehealth',           nodeRole: 'Telehealth',                label: 'Hims & Hers Health',    threshold: -23, dir: 'low', kind: 'ticker', industry: 'telehealth' },
  VEEV: { series: 'VEEV', node: 'PCC',  role: 'Health-IT / Clinical Cloud Platform',     nodeRole: 'Health Information Technology', label: 'Veeva Systems',     threshold: -19, dir: 'low', kind: 'ticker', industry: 'health-it' }
};

// Reverse lookup: connectome node → healthcare-sector company tickers it sources from
// (opt-in healthcare-company drill, parallel to NODE_TO_TECH_COMPANY / NODE_TO_INTEL_COMPANY /
// NODE_TO_TRADE_COMPANY / NODE_TO_INDUSTRIAL_COMPANY / NODE_TO_ENVIRONMENT_COMPANY /
// NODE_TO_GOVERNANCE_COMPANY / NODE_TO_AGRICULTURE_COMPANY / NODE_TO_COMMUNICATION_COMPANY).
// Enables drill-down from high medicine stress to the SPECIFIC pharma / device / diagnostics /
// hospital / insurer / telehealth companies sensing the stress origin (e.g. which pharma
// companies are stressed during a drug-safety shortage). Pure medicine signal-tracing.
var NODE_TO_HEALTHCARE_COMPANY = {};
for (var _hck in HEALTHCARE_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(HEALTHCARE_COMPANY_BINDING, _hck)) continue;
  var _hcb = HEALTHCARE_COMPANY_BINDING[_hck];
  if (!NODE_TO_HEALTHCARE_COMPANY[_hcb.node]) NODE_TO_HEALTHCARE_COMPANY[_hcb.node] = [];
  NODE_TO_HEALTHCARE_COMPANY[_hcb.node].push(_hcb);
}

// ── HEALTHCARE-SECTOR INDICATOR bindings (medicine gap 2 — ADDITIVE, OPT-IN) ──
// Parallel structure to MACRO_INDICATOR_BINDING, INTELLIGENCE_INDICATOR_BINDING, TRADE_
// INDICATOR_BINDING, ENVIRONMENT_INDICATOR_BINDING, GOVERNANCE_INDICATOR_BINDING, AGRICULTURE_
// INDICATOR_BINDING and COMMUNICATION_INDICATOR_BINDING — but for PURE healthcare-operations
// signals: FDA adverse-event volume (openFDA), pharmaceutical-approval rate, hospital
// occupancy / bed availability (CMS), insurance medical-loss ratio / claims-approval (NAIC),
// diagnostic test volume & turnaround, clinical-trial enrollment velocity, surgical-capacity
// utilization. Binds each REAL healthcare metric to the medicine connectome node that senses
// it, so kernel/reporting/diagnosis layers can drill from abstract 'medicine stress' into the
// ACTUAL clinical signal that triggered it (e.g. HYPO Pharmacy node lit → FDA adverse events
// spiked → drug-safety shock origin; mPFC Primary-Care node lit → hospital occupancy
// collapsed → capacity shock). These strictly measure MEDICINE identity: clinical operations,
// treatment capacity, drug-safety, claims processing, diagnostic throughput. Energy is ZERO
// content — facility power SLA/uptime is a facility-operations coupling, not a medicine signal.
// Annotation/registry metadata ONLY — the resolver does NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'fda' (openFDA adverse events / approvals) | 'cms' (hospital occupancy / quality)
//          | 'naic' (insurance MLR / claims) | 'pharma-pipeline' (trial / approval velocity)
//          | 'dx' (diagnostic throughput) | 'surg' (surgical-capacity utilization).
var HEALTHCARE_INDICATOR_BINDING = {
  // ── FDA adverse-event / drug-safety (openFDA; drug-safety shock on spike) ──
  FDAAdverseEvents: { series: 'FDAAdverseEvents', node: 'CeA',  role: 'Adverse-Event Volume',        nodeRole: 'Emergency Medicine', label: 'FDA Adverse-Event Reports (openFDA)', threshold: 8,  dir: 'high', kind: 'fda', policyPath: 'fda_enforcement_action' },
  FDAPharmacyRecall:{ series: 'FDAPharmacyRecall', node: 'HYPO', role: 'Drug Recall / Shortage',      nodeRole: 'Pharmacy',          label: 'FDA Drug Recall / Shortage Count',    threshold: 6,  dir: 'high', kind: 'fda', policyPath: 'fda_enforcement_action' },
  // ── Pharmaceutical approval rate (pipeline slowdown on decline) ──
  FDAApprovalRate:  { series: 'FDAApprovalRate',  node: 'HYPO', role: 'Drug-Approval Rate',          nodeRole: 'Pharmacy',          label: 'FDA New-Drug Approval Rate',          threshold: -4, dir: 'low',  kind: 'pharma-pipeline', policyPath: 'fda_enforcement_action' },
  ClinicalTrialEnroll: { series: 'ClinicalTrialEnroll', node: 'STRI', role: 'Trial Enrollment Velocity', nodeRole: 'Clinical Research', label: 'Clinical-Trial Enrollment Velocity', threshold: -5, dir: 'low', kind: 'pharma-pipeline', policyPath: 'fda_enforcement_action' },
  // ── Hospital occupancy / bed availability (CMS; capacity shock on extreme occupancy) ──
  HospitalOccupancy: { series: 'HospitalOccupancy', node: 'mPFC', role: 'Hospital Occupancy %',        nodeRole: 'Primary Care',      label: 'CMS Hospital Occupancy Rate (%)',     threshold: 90, dir: 'high', kind: 'cms', policyPath: 'cms_payment_rule_change' },
  HospitalBedAvail:  { series: 'HospitalBedAvail',  node: 'THAL', role: 'Available Bed Capacity',      nodeRole: 'Hospital Operations', label: 'CMS Available Bed Capacity',        threshold: -6, dir: 'low',  kind: 'cms', policyPath: 'cms_payment_rule_change' },
  // ── Insurance medical-loss ratio / claims (NAIC; underwriting stress on MLR spike) ──
  InsuranceMLR:      { series: 'InsuranceMLR',      node: 'STRI', role: 'Medical-Loss Ratio',          nodeRole: 'Health Insurance',  label: 'NAIC Medical-Loss Ratio (%)',         threshold: 88, dir: 'high', kind: 'naic', policyPath: 'medicaid_expansion' },
  ClaimsApprovalRate:{ series: 'ClaimsApprovalRate', node: 'VP',  role: 'Claims-Approval Rate',        nodeRole: 'Health Insurance',  label: 'NAIC Insurance Claims-Approval Rate', threshold: -5, dir: 'low', kind: 'naic', policyPath: 'medicaid_expansion' },
  // ── Diagnostic throughput / turnaround (lab-capacity shock on decline / delay) ──
  DiagnosticVolume:  { series: 'DiagnosticVolume',  node: 'LGN',  role: 'Diagnostic Test Volume',      nodeRole: 'Diagnostics',       label: 'Diagnostic Test Volume Index',        threshold: -5, dir: 'low',  kind: 'dx', policyPath: 'health_it_certification_mandate' },
  DiagnosticTAT:     { series: 'DiagnosticTAT',     node: 'V1',   role: 'Diagnostic Turnaround Time',  nodeRole: 'Diagnostics',       label: 'Diagnostic Turnaround Time (hrs)',    threshold: 7,  dir: 'high', kind: 'dx', policyPath: 'health_it_certification_mandate' },
  // ── Surgical capacity utilization (OR scheduling; capacity shortage on saturation) ──
  SurgicalCapacityUtil: { series: 'SurgicalCapacityUtil', node: 'M1', role: 'Surgical-Capacity Utilization', nodeRole: 'Surgery', label: 'OR / Surgical Capacity Utilization (%)', threshold: 88, dir: 'high', kind: 'surg', policyPath: 'cms_payment_rule_change' }
};

// Reverse lookup: connectome node → healthcare indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_TRADE_INDICATOR / NODE_TO_COMMUNICATION_
// INDICATOR; for diagnosis drill-down — distinguishes medicine stress from facility coupling).
var NODE_TO_HEALTHCARE_INDICATOR = {};
for (var _hcik in HEALTHCARE_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(HEALTHCARE_INDICATOR_BINDING, _hcik)) continue;
  var _hcib = HEALTHCARE_INDICATOR_BINDING[_hcik];
  if (!NODE_TO_HEALTHCARE_INDICATOR[_hcib.node]) NODE_TO_HEALTHCARE_INDICATOR[_hcib.node] = [];
  NODE_TO_HEALTHCARE_INDICATOR[_hcib.node].push(_hcib);
}

// ── POPULATION-SECTOR (DEMOGRAPHICS / MIGRATION / AGING / LABOR-SUPPLY) INDICATOR bindings (population gap 1 — ADDITIVE) ──
// Parallel structure to MACRO_INDICATOR_BINDING (economy gap 1), AGRICULTURE_INDICATOR_
// BINDING, EDUCATION_INDICATOR_BINDING and HEALTHCARE_INDICATOR_BINDING, but for PURE
// population/demographic signals: U.S. Census Bureau ACS (age/sex/race, population density,
// median age), UN World Population Prospects (life expectancy, fertility, net migration),
// CDC/NCHS vital statistics (life expectancy, fertility/birth rate, mortality by age),
// Census Components-of-Change (net migration flow, urbanization), and BLS CPS (labor-force-
// participation rate, unemployment by age). Binds each REAL demographic metric to the
// population connectome node that senses it (nodes are the actual population-domain
// participations in brain-node-domains.json: CARD=Mortality & Life Expectancy, OXY=Birth
// Rates, VTA=Youth Demographics, STN=Youthpop, vlPFC/HPA/HIPP/mPFC=Aging Population /
// Elderly Healthcare, VEST=Migration Patterns, CeA=Refugee Populations, dlPFC=Urbanization,
// AI=Population Density, M1=Labor Force, S2=workforce retention, OFC=Income Distribution,
// TPJ=Ethnic Diversity, ECN=Census Systems, SEPT=Family Structure, BNST=Retirement Reform,
// HYPO=Gender Demographics), so the kernel/reporting/diagnosis layers can drill from
// abstract 'population stress' into the ACTUAL demographic signal that triggered it (e.g.
// aging node lit → life-expectancy decline → mortality-shift origin; labor node lit → LFPR
// drop → human-capital-supply shortfall). These strictly measure POPULATION identity:
// demographics & population dynamics, migration & immigration, urbanization & settlement,
// fertility & mortality, aging & generational shifts, labor-force / human-capital SUPPLY,
// household formation, social structure & inequality. KEPT DISTINCT from economy (the LABOR
// MARKET — wages, employment demand — is a coupling, not population content; LFPR is the
// SUPPLY side of human capital, a demographic stock), from medicine (mortality/health is a
// coupling — measured here as the demographic life-expectancy STOCK, not clinical care),
// from education (enrollment is a coupling — measured here only as the human-capital
// attainment stock), and from governance (policy is a coupling). NEVER energy production or
// grid metrics — population shifts COUPLE downstream to energy demand (aging-care facility
// baseline load, settlement-driven infrastructure capex), but that coupling is a CONSEQUENCE,
// never a population-sector signal; population nodes carry zero energy-domain content.
// Annotation/registry metadata ONLY — the resolver does NOT score these.
//   threshold = the level above/below which the node is considered stressed.
//   dir = 'high' (stress when ABOVE threshold) | 'low' (stress when BELOW).
//   kind = 'census' (Census ACS / Components-of-Change) | 'unwpp' (UN World Population
//          Prospects) | 'cdc' (CDC/NCHS vital statistics) | 'bls' (BLS CPS labor supply).
var POPULATION_INDICATOR_BINDING = {
  // ── Mortality / life expectancy (aging-population & demographic-transition stress) ──
  LifeExpectancy:   { series: 'LifeExpectancy',   node: 'CARD',  role: 'Life Expectancy at Birth',       nodeRole: 'Mortality & Life Expectancy',           label: 'Life Expectancy (CDC WONDER / UN WPP)',   threshold: -0.5, dir: 'low',  kind: 'cdc',    policyPath: 'pop_aging_care' },
  MortalityByAge:   { series: 'MortalityByAge',   node: 'mPFC',  role: 'Age-Specific Mortality Rate',     nodeRole: 'Elderly Healthcare Assessment & Diagnostics', label: 'Mortality by Age (CDC WONDER)',     threshold: 5,    dir: 'high', kind: 'cdc',    policyPath: 'pop_aging_care' },
  MedianAge:        { series: 'MedianAge',        node: 'vlPFC', role: 'Median Population Age',           nodeRole: 'Aging Population Assessment & Diagnostics', label: 'Median Age (Census ACS)',           threshold: 40,   dir: 'high', kind: 'census', policyPath: 'pop_aging_care' },
  OldAgeDependency: { series: 'OldAgeDependency', node: 'HPA',   role: 'Old-Age Dependency Ratio',        nodeRole: 'Aging Population — Action Coordination',  label: 'Old-Age Dependency Ratio (UN WPP)',  threshold: 28,   dir: 'high', kind: 'unwpp',  policyPath: 'pop_aging_care' },
  // ── Fertility / birth / youth (birth-cohort & generational-renewal stress) ──
  FertilityRate:    { series: 'FertilityRate',    node: 'OXY',   role: 'Total Fertility Rate',            nodeRole: 'Birth Rates',                           label: 'Total Fertility Rate (CDC/NCHS, UN WPP)', threshold: 2.1, dir: 'low', kind: 'cdc',    policyPath: 'pop_fertility_incentive' },
  BirthRate:        { series: 'BirthRate',        node: 'VTA',   role: 'Crude Birth Rate / Youth Cohort', nodeRole: 'Youth Demographics',                    label: 'Birth Rate (CDC/NCHS)',                  threshold: 11,   dir: 'low',  kind: 'cdc',    policyPath: 'pop_fertility_incentive' },
  YouthShare:       { series: 'YouthShare',       node: 'STN',   role: 'Youth Population Share (<15)',     nodeRole: 'Youthpop',                              label: 'Youth Share of Population (Census ACS)', threshold: 18,   dir: 'low',  kind: 'census', policyPath: 'pop_fertility_incentive' },
  // ── Migration / settlement / urbanization (mobility & settlement-pressure stress) ──
  NetMigration:     { series: 'NetMigration',     node: 'VEST',  role: 'Net Migration Flow',              nodeRole: 'Migration Patterns',                    label: 'Net Migration (Census Components of Change)', threshold: 4, dir: 'high', kind: 'census', policyPath: 'pop_immigration_reform' },
  RefugeeInflow:    { series: 'RefugeeInflow',    node: 'CeA',   role: 'Refugee / Displaced Inflow',      nodeRole: 'Refugee Populations',                   label: 'Refugee Inflow (UNHCR / Census)',        threshold: 6,    dir: 'high', kind: 'unwpp',  policyPath: 'pop_immigration_reform' },
  UrbanizationRate: { series: 'UrbanizationRate', node: 'dlPFC', role: 'Urbanization Rate',               nodeRole: 'Urbanization',                          label: 'Urban Population Share (Census Metro)',  threshold: 5,    dir: 'high', kind: 'census', policyPath: 'pop_immigration_reform' },
  PopulationDensity:{ series: 'PopulationDensity',node: 'AI',    role: 'Population Density',               nodeRole: 'Population Density',                     label: 'Population Density (Census ACS)',        threshold: 8,    dir: 'high', kind: 'census', policyPath: 'pop_immigration_reform' },
  // ── Labor-force / human-capital SUPPLY (demographic supply side, NOT labor-market demand) ──
  LFPR:             { series: 'LFPR',             node: 'M1',    role: 'Labor-Force Participation Rate',  nodeRole: 'Labor Force',                           label: 'Labor-Force Participation (BLS CPS LFPR)', threshold: 62, dir: 'low',  kind: 'bls',    policyPath: 'pop_aging_care' },
  UnemploymentByAge:{ series: 'UnemploymentByAge',node: 'S2',    role: 'Age-Cohort Unemployment',         nodeRole: 'workforce retention — Signal Acquisition', label: 'Unemployment by Age (BLS CPS)',       threshold: 8,    dir: 'high', kind: 'bls',    policyPath: 'pop_aging_care' },
  // ── Social structure / inequality / household / family (settlement & cohesion stress) ──
  IncomeInequality: { series: 'IncomeInequality', node: 'OFC',   role: 'Income Distribution (Gini)',      nodeRole: 'Income Distribution',                   label: 'Income Inequality (Census ACS Gini)',    threshold: 0.48, dir: 'high', kind: 'census', policyPath: 'pop_immigration_reform' },
  HouseholdFormation:{ series: 'HouseholdFormation', node: 'SEPT', role: 'Household / Family Formation',   nodeRole: 'Family Structure',                      label: 'Household Formation (Census ACS)',       threshold: -1,   dir: 'low',  kind: 'census', policyPath: 'pop_fertility_incentive' },
  EthnicDiversity:  { series: 'EthnicDiversity',  node: 'TPJ',   role: 'Ethnic / Racial Composition',     nodeRole: 'Ethnic Diversity',                      label: 'Ethnic Diversity (Census ACS Race)',     threshold: 10,   dir: 'high', kind: 'census', policyPath: 'pop_immigration_reform' },
  EducationAttainment:{ series: 'EducationAttainment', node: 'AG', role: 'Educational Attainment Stock',  nodeRole: 'Education Levels',                      label: 'Educational Attainment (Census ACS)',    threshold: -2,   dir: 'low',  kind: 'census', policyPath: 'pop_aging_care' },
  CensusCoverage:   { series: 'CensusCoverage',   node: 'ECN',   role: 'Census Enumeration Coverage',     nodeRole: 'Census Systems',                        label: 'Census Coverage / Undercount (ACS)',     threshold: -3,   dir: 'low',  kind: 'census', policyPath: 'pop_immigration_reform' }
};

// Reverse lookup: connectome node → population indicators it senses
// (parallel to NODE_TO_MACRO_INDICATOR / NODE_TO_EDUCATION_INDICATOR; for diagnosis drill-down).
var NODE_TO_POPULATION_INDICATOR = {};
for (var _popik in POPULATION_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(POPULATION_INDICATOR_BINDING, _popik)) continue;
  var _popib = POPULATION_INDICATOR_BINDING[_popik];
  if (!NODE_TO_POPULATION_INDICATOR[_popib.node]) NODE_TO_POPULATION_INDICATOR[_popib.node] = [];
  NODE_TO_POPULATION_INDICATOR[_popib.node].push(_popib);
}

// ── POPULATION-SECTOR (DEMOGRAPHIC-EXPOSED) COMPANY ticker bindings (population gap 3 — ADDITIVE, OPT-IN) ──
// Parallel to TECH_COMPANY_BINDING and the other sector company registries (and to
// MACRO_INDICATOR_BINDING). NOT merged into the default resolve() pipeline and NOT included
// in NODE_TO_MACRO_INDICATOR — consumed ONLY when a context explicitly triggers a
// population-company-level drill (getPopulationCompaniesForNode / POPULATION_COMPANY_BINDING
// export). Population binds MOSTLY to INDICATORS, not single companies (demographics is a
// public-statistics domain); where a demographic-exposure SURFACE needs a concrete proxy we
// use REAL demographic-exposed entities mapped to the actual population connectome node that
// senses their exposure: senior-living REITs for the AGING surface (WELL/VTR/LTC/NHI/BSR),
// housing/migration proxies for the SETTLEMENT surface (ZG/RDFN), and demographic-data
// providers for the DATA-QUALITY surface (EFX/CSGP). Ticker stress (dir 'low' for all —
// stress on decline) estimates a DEMOGRAPHIC-EXPOSURE DEGRADATION: a WELL/VTR/LTC/NHI/BSR
// decline = senior-living occupancy pressure / care-labor cost spike → aging-care capacity
// strain; a ZG/RDFN decline = migration-driven housing-demand freeze → settlement-mobility
// stall; an EFX/CSGP decline = demographic / property-data quality risk → household-formation
// forecast error. This is POPULATION identity = demographic exposure (aging cohorts, migration
// flows, settlement, household formation) — DISTINCT from economy (housing-PRICE aggregate is a
// coupling, not migration dynamics), medicine (clinical care is a coupling, senior-living here
// is the demographic occupancy SURFACE), and construction (capital goods is a coupling, not
// settlement). ENERGY is PURELY a downstream COUPLING, never the identity: senior-living
// always-on aging-care infrastructure carries a flat/rising per-bed HVAC baseline, and a
// settlement freeze idles construction-equipment fleets — but population nodes carry ZERO
// energy-domain content (no oil/gas, no grid ops) and never originate a population-to-energy
// edge. REAL demographic-exposed tickers only.
//   WELL → Welltower (senior housing REIT)        VTR → Ventas (senior housing REIT)
//   LTC  → LTC Properties (senior/SNF REIT)        NHI → National Health Investors (senior REIT)
//   BSR  → BSR REIT (multifamily / household formation)  ZG → Zillow Group (housing/migration)
//   RDFN → Redfin (housing/migration)              EFX → Equifax (demographic/credit data)
//   CSGP → CoStar Group (property/settlement data)
var POPULATION_COMPANY_BINDING = {
  WELL: { series: 'WELL', node: 'vlPFC', role: 'Senior-Living Occupancy / Aging-Care Capacity',     nodeRole: 'Aging Population Assessment & Diagnostics',  label: 'Welltower',                threshold: -16, dir: 'low', kind: 'ticker', industry: 'senior-living-reit' },
  VTR:  { series: 'VTR',  node: 'HPA',   role: 'Senior-Housing Capacity / Aging-Care Coordination', nodeRole: 'Aging Population — Action Coordination',     label: 'Ventas',                   threshold: -17, dir: 'low', kind: 'ticker', industry: 'senior-living-reit' },
  LTC:  { series: 'LTC',  node: 'mPFC',  role: 'Skilled-Nursing / Elderly-Care Facility Capacity',  nodeRole: 'Elderly Healthcare Assessment & Diagnostics', label: 'LTC Properties',          threshold: -19, dir: 'low', kind: 'ticker', industry: 'senior-living-reit' },
  NHI:  { series: 'NHI',  node: 'HIPP',  role: 'Senior-Living Portfolio / Aging-Care Resilience',   nodeRole: 'Aging Population — Regulation Strategy',     label: 'National Health Investors', threshold: -18, dir: 'low', kind: 'ticker', industry: 'senior-living-reit' },
  BSR:  { series: 'BSR',  node: 'SEPT',  role: 'Multifamily / Household-Formation Exposure',        nodeRole: 'Family Structure',                          label: 'BSR REIT',                 threshold: -20, dir: 'low', kind: 'ticker', industry: 'multifamily-reit' },
  ZG:   { series: 'ZG',   node: 'VEST',  role: 'Housing-Demand / Migration-Flow Proxy',             nodeRole: 'Migration Patterns',                        label: 'Zillow Group',             threshold: -22, dir: 'low', kind: 'ticker', industry: 'housing-migration-data' },
  RDFN: { series: 'RDFN', node: 'dlPFC', role: 'Migration-Driven Housing-Demand Proxy',             nodeRole: 'Urbanization',                              label: 'Redfin',                   threshold: -24, dir: 'low', kind: 'ticker', industry: 'housing-migration-data' },
  EFX:  { series: 'EFX',  node: 'ECN',   role: 'Demographic / Credit-Data Quality Surface',         nodeRole: 'Census Systems',                            label: 'Equifax',                  threshold: -16, dir: 'low', kind: 'ticker', industry: 'demographic-data' },
  CSGP: { series: 'CSGP', node: 'AI',    role: 'Property / Settlement-Data Quality Surface',        nodeRole: 'Population Density',                         label: 'CoStar Group',             threshold: -18, dir: 'low', kind: 'ticker', industry: 'demographic-data' }
};

// Reverse lookup: connectome node → population-sector company tickers it sources from
// (opt-in population-company drill, parallel to NODE_TO_EDUCATION_COMPANY).
var NODE_TO_POPULATION_COMPANY = {};
for (var _popck in POPULATION_COMPANY_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(POPULATION_COMPANY_BINDING, _popck)) continue;
  var _popcb = POPULATION_COMPANY_BINDING[_popck];
  if (!NODE_TO_POPULATION_COMPANY[_popcb.node]) NODE_TO_POPULATION_COMPANY[_popcb.node] = [];
  NODE_TO_POPULATION_COMPANY[_popcb.node].push(_popcb);
}

// Reverse lookup: connectome node → macro indicators it senses (for diagnosis drill-down).
var NODE_TO_MACRO_INDICATOR = {};
for (var _mk in MACRO_INDICATOR_BINDING) {
  if (!Object.prototype.hasOwnProperty.call(MACRO_INDICATOR_BINDING, _mk)) continue;
  var _mb = MACRO_INDICATOR_BINDING[_mk];
  if (!NODE_TO_MACRO_INDICATOR[_mb.node]) NODE_TO_MACRO_INDICATOR[_mb.node] = [];
  NODE_TO_MACRO_INDICATOR[_mb.node].push(_mb);
}

// Reverse: connectome domain → feed domains (for display)
var CONNECTOME_TO_FEED = {};
for (var fk in FEED_TO_CONNECTOME) {
  var targets = FEED_TO_CONNECTOME[fk];
  for (var ti = 0; ti < targets.length; ti++) {
    if (!CONNECTOME_TO_FEED[targets[ti]]) CONNECTOME_TO_FEED[targets[ti]] = [];
    if (CONNECTOME_TO_FEED[targets[ti]].indexOf(fk) === -1) CONNECTOME_TO_FEED[targets[ti]].push(fk);
  }
}

// Stress threshold for node activation (preprocessing filter, not a score)
var STRESS_ACTIVATION_THRESHOLD = 0.35;

// ═══════════════════════════════════════════════════
// 2. NODE DIRECTORY (loaded from brain-node-domains.json)
// ═══════════════════════════════════════════════════

var _nodeDirectory = null;
var _directoryLoaded = false;
var _directoryLoading = false;
var _directoryCallbacks = [];

function loadNodeDirectory(callback) {
  if (_directoryLoaded) { callback(_nodeDirectory); return; }
  _directoryCallbacks.push(callback);
  if (_directoryLoading) return;
  _directoryLoading = true;

  fetch('/assets/data/brain-node-domains.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      _nodeDirectory = data || {};
      _directoryLoaded = true;
      _directoryLoading = false;
      for (var i = 0; i < _directoryCallbacks.length; i++) _directoryCallbacks[i](_nodeDirectory);
      _directoryCallbacks = [];
    })
    .catch(function() {
      _nodeDirectory = {};
      _directoryLoaded = true;
      _directoryLoading = false;
      for (var i = 0; i < _directoryCallbacks.length; i++) _directoryCallbacks[i](_nodeDirectory);
      _directoryCallbacks = [];
    });
}

// ═══════════════════════════════════════════════════
// 3. DOMAIN DETAIL CACHE (loaded from domain JSONs on demand)
// ═══════════════════════════════════════════════════

var _domainDetailCache = {};

function loadDomainDetail(connectomeDomainId, callback) {
  if (_domainDetailCache[connectomeDomainId]) {
    callback(_domainDetailCache[connectomeDomainId]);
    return;
  }
  fetch('/assets/data/domains/' + connectomeDomainId + '.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) {
        _domainDetailCache[connectomeDomainId] = {
          activations: data.activations || [],
          issues: data.issues || [],
          title: data.title || connectomeDomainId,
          phase: data.phase || 'P3'
        };
      } else {
        _domainDetailCache[connectomeDomainId] = { activations: [], issues: [], title: connectomeDomainId, phase: 'P3' };
      }
      callback(_domainDetailCache[connectomeDomainId]);
    })
    .catch(function() {
      _domainDetailCache[connectomeDomainId] = { activations: [], issues: [], title: connectomeDomainId, phase: 'P3' };
      callback(_domainDetailCache[connectomeDomainId]);
    });
}

// ═══════════════════════════════════════════════════
// 4. NODE ACTIVATION ENGINE
// ═══════════════════════════════════════════════════
// Maps stressed feed domains → connectome domains → activated nodes.
// activationStrength is the raw feed stress value passed through,
// NOT a computed score. It is annotation metadata for display only.

/**
 * Given stressed feed domains, find which connectome nodes are activated.
 * @param {Array} stressedFeedDomains - [{id, stress, status}]
 * @returns {Array} sorted node activations
 */
function activateNodes(stressedFeedDomains) {
  if (!_nodeDirectory) return [];

  // Map feed domains → connectome domains
  var activeConnectomeDomains = {};
  for (var i = 0; i < stressedFeedDomains.length; i++) {
    var fd = stressedFeedDomains[i];
    var mapped = FEED_TO_CONNECTOME[fd.id] || [];
    for (var j = 0; j < mapped.length; j++) {
      if (!activeConnectomeDomains[mapped[j]]) activeConnectomeDomains[mapped[j]] = [];
      activeConnectomeDomains[mapped[j]].push({ feedDomain: fd.id, stress: fd.stress });
    }
  }

  // Find nodes that participate in active connectome domains
  var nodeActivations = {};
  for (var nodeId in _nodeDirectory) {
    var nodeDomains = _nodeDirectory[nodeId];
    var matchedDomains = [];
    var totalStrength = 0;

    for (var nd = 0; nd < nodeDomains.length; nd++) {
      var domEntry = nodeDomains[nd];
      if (activeConnectomeDomains[domEntry.domain]) {
        var feedSources = activeConnectomeDomains[domEntry.domain];
        for (var fs = 0; fs < feedSources.length; fs++) {
          matchedDomains.push({
            connectomeDomain: domEntry.domain,
            role: domEntry.role,
            label: domEntry.label,
            feedDomain: feedSources[fs].feedDomain,
            stress: feedSources[fs].stress
          });
          totalStrength += feedSources[fs].stress;
        }
      }
    }

    if (matchedDomains.length > 0) {
      nodeActivations[nodeId] = {
        nodeId: nodeId,
        domains: matchedDomains,
        // activationStrength is avg raw feed stress — annotation only, not a score
        activationStrength: Math.min(1.0, totalStrength / matchedDomains.length),
        domainCount: matchedDomains.length,
        crossDomainNode: _countUnique(matchedDomains.map(function(d){ return d.feedDomain; })) > 1
      };
    }
  }

  // Sort by cross-domain first, then by activation strength
  var sorted = Object.keys(nodeActivations).map(function(k){ return nodeActivations[k]; });
  sorted.sort(function(a, b) {
    if (a.crossDomainNode !== b.crossDomainNode) return b.crossDomainNode ? 1 : -1;
    return b.activationStrength - a.activationStrength;
  });

  return sorted;
}

function _countUnique(arr) {
  var seen = {};
  for (var i = 0; i < arr.length; i++) seen[arr[i]] = true;
  return Object.keys(seen).length;
}

// ═══════════════════════════════════════════════════
// 4b. DIAGNOSIS-AWARE ACTIVATION (additive)
// ═══════════════════════════════════════════════════
// Walks window.LIMENDomains[dk].brainDiagnoses[] where dx.active === true
// and extracts per-circuit node activations carrying the diagnosis binding.
// Merged with the stress-based activateNodes() output in resolve().
// Produces entries with the same shape as activateNodes() plus a new
// optional diagnosisBindings[] array. Returns a Map<nodeId, entry>.
// Zero behavior change if no brain emits brainDiagnoses.

function _collectDiagnosisActivations(doms) {
  var out = new Map();
  if (!doms || typeof doms !== 'object') return out;
  var seenSources = {}; // nodeId -> { sourceDomain: true } for crossDomainNode detection

  for (var dk in doms) {
    if (!Object.prototype.hasOwnProperty.call(doms, dk)) continue;
    var d = doms[dk];
    var dxList = (d && Array.isArray(d.brainDiagnoses)) ? d.brainDiagnoses : [];
    for (var di = 0; di < dxList.length; di++) {
      var dx = dxList[di];
      if (!dx || dx.active !== true) continue;
      var circuits = Array.isArray(dx.circuits) ? dx.circuits : [];
      for (var ci = 0; ci < circuits.length; ci++) {
        var c = circuits[ci];
        if (!c || !c.nodeId) continue;
        var nid = c.nodeId;

        var binding = {
          diagnosisId:      dx.id || null,
          diagnosisLabel:   dx.label || null,
          circuitRole:      c.detail || null,
          circuitDirection: c.dir || null,
          circuitEvidence:  c.evidence || null,
          sourceDomain:     dk
        };

        var connDomArr = FEED_TO_CONNECTOME[dk];
        var connDom = (connDomArr && connDomArr.length) ? connDomArr[0] : dk;
        var strength = (typeof dx.relevance === 'number') ? dx.relevance : 0;
        var synthDomainEntry = {
          connectomeDomain: connDom,
          role:             c.detail || dx.label || '',
          label:            dx.label || '',
          feedDomain:       dk,
          stress:           strength
        };

        if (!out.has(nid)) {
          seenSources[nid] = {};
          seenSources[nid][dk] = true;
          out.set(nid, {
            nodeId: nid,
            domains: [synthDomainEntry],
            activationStrength: Math.min(1.0, strength),
            domainCount: 1,
            crossDomainNode: false,
            diagnosisBindings: [binding]
          });
        } else {
          var existing = out.get(nid);
          existing.domains.push(synthDomainEntry);
          existing.diagnosisBindings.push(binding);
          existing.activationStrength = Math.min(1.0, Math.max(existing.activationStrength, strength));
          seenSources[nid][dk] = true;
          existing.crossDomainNode = Object.keys(seenSources[nid]).length > 1;
          existing.domainCount = existing.domains.length;
        }
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════
// 5. OPPORTUNITY ENRICHMENT
// ═══════════════════════════════════════════════════
// Enriches existing playbook opportunities with connectome node context.
// No scoring. Node/business/diagnosis data only.

/**
 * Enrich an existing playbook opportunity with connectome data.
 * @param {Object} opp - existing opportunity from _activateOpportunities()
 * @param {Array} nodeActivations - from activateNodes()
 * @param {Object} feedSnapshot - raw feed domain data { domainId: { stress, status } }
 * @returns {Object} enriched opportunity with connectome fields
 */
function enrichOpportunity(opp, nodeActivations, feedSnapshot) {
  var pb = opp.pb;
  var oppDomains = pb.domains || [];

  // Find nodes relevant to this opportunity's domains
  var relevantNodes = [];
  for (var i = 0; i < nodeActivations.length; i++) {
    var node = nodeActivations[i];
    var isRelevant = false;
    for (var j = 0; j < node.domains.length; j++) {
      if (oppDomains.indexOf(node.domains[j].feedDomain) !== -1) {
        isRelevant = true;
        break;
      }
    }
    if (isRelevant) relevantNodes.push(node);
  }

  // Top 8 most activated nodes for this opportunity
  var topNodes = relevantNodes.slice(0, 8);

  // Build business mappings from node roles
  var businessMappings = [];
  var seenRoles = {};
  for (var ni = 0; ni < topNodes.length; ni++) {
    var nd = topNodes[ni].domains;
    for (var ndi = 0; ndi < nd.length; ndi++) {
      var roleKey = nd[ndi].role;
      if (!seenRoles[roleKey] && oppDomains.indexOf(nd[ndi].feedDomain) !== -1) {
        seenRoles[roleKey] = true;
        businessMappings.push({
          nodeId: topNodes[ni].nodeId,
          role: nd[ndi].role,
          domain: nd[ndi].connectomeDomain,
          label: nd[ndi].label,
          strength: topNodes[ni].activationStrength
        });
      }
    }
  }
  businessMappings.sort(function(a, b) { return b.strength - a.strength; });

  // Connectome-derived stressor summary (descriptive, not a score)
  var stressorSummary = '';
  if (topNodes.length > 0) {
    var topRoles = topNodes.slice(0, 3).map(function(n) {
      var primaryRole = n.domains[0] ? n.domains[0].role : n.nodeId;
      return primaryRole + ' (' + n.nodeId + ')';
    });
    stressorSummary = 'Node activation: ' + topRoles.join(', ');
  }

  // Feed domain snapshot for display (pass-through, not scored)
  var feedContext = {};
  for (var di = 0; di < oppDomains.length; di++) {
    var dk = oppDomains[di];
    var fd = feedSnapshot[dk];
    if (fd) {
      feedContext[dk] = {
        stress: fd.stress || 0,
        status: fd.status || 'UNKNOWN'
      };
    }
  }

  return {
    // Preserve all original fields
    pb: opp.pb,
    confidence: opp.confidence,
    urgency: opp.urgency,
    whyNow: opp.whyNow,
    status: opp.status,
    quality: opp.quality,
    // Connectome enrichment (annotation only — no scores)
    connectome: {
      nodes: topNodes.map(function(n) {
        // ADDITIVE (economy gap 1): attach the REAL macro indicators this node
        // senses (FRED series / market proxy) so 'this node lit up' becomes
        // traceable to which ACTUAL economic statistic triggered it.
        var macroInd = (NODE_TO_MACRO_INDICATOR[n.nodeId] || []).map(function(m) {
          return { series: m.series, label: m.label, role: m.role, threshold: m.threshold, dir: m.dir, kind: m.kind, policyPath: m.policyPath };
        });
        // ADDITIVE (economy gap 3): distinguish contagion source. A node sourced
        // ONLY from the economy macro-aggregate (transitively, with no direct feed
        // stress in the opportunity's own domains) is flagged as upstream-economy
        // contagion vs. direct feed stress, so enrichment surfaces WHY it lit up.
        var srcDomains = n.domains.map(function(d) { return d.feedDomain; });
        var hasDirect = false;
        for (var _si = 0; _si < srcDomains.length; _si++) {
          if (oppDomains.indexOf(srcDomains[_si]) !== -1 && srcDomains[_si] !== 'economy') { hasDirect = true; break; }
        }
        var econOnly = srcDomains.indexOf('economy') !== -1 && !hasDirect;
        return {
          id: n.nodeId,
          strength: Math.round(n.activationStrength * 100) / 100,
          crossDomain: n.crossDomainNode,
          roles: n.domains.slice(0, 3).map(function(d) { return d.role; }),
          feedDomains: srcDomains.filter(function(v, i, a) { return a.indexOf(v) === i; }),
          diagnosisBindings: Array.isArray(n.diagnosisBindings) ? n.diagnosisBindings.slice() : [],
          macroIndicators: macroInd,
          activationOrigin: econOnly ? 'ECONOMY_CONTAGION' : (hasDirect ? 'DIRECT_FEED' : 'TRANSITIVE')
        };
      }),
      nodeCount: topNodes.length,
      totalActivated: relevantNodes.length,
      crossDomainNodes: topNodes.filter(function(n) { return n.crossDomainNode; }).length,
      stressorSummary: stressorSummary,
      businessMappings: businessMappings.slice(0, 6),
      feedContext: feedContext,
      source: relevantNodes.length > 0 ? 'CONNECTOME' : 'DOMAIN_ONLY'
    }
  };
}

// ═══════════════════════════════════════════════════
// 6. FULL RESOLVE PIPELINE
// ═══════════════════════════════════════════════════

/**
 * Run the resolver pipeline. No scoring — mapping and enrichment only.
 * @param {Array} opportunities - raw opportunities from _activateOpportunities()
 * @returns {Array} enriched opportunities
 */
function resolve(opportunities) {
  if (!_directoryLoaded || !_nodeDirectory) return opportunities;

  var doms = window.LIMENDomains || {};

  // Identify stressed domains (simple threshold filter, not scoring)
  var stressedDomains = [];
  for (var dk in doms) {
    var d = doms[dk];
    var stress = d.stress || 0;
    if (stress >= STRESS_ACTIVATION_THRESHOLD) {
      stressedDomains.push({ id: dk, stress: stress, status: d.status });
    }
  }

  // Activate connectome nodes from stressed domains (existing path — fallback).
  var stressActivations = activateNodes(stressedDomains);

  // NEW: diagnosis-aware activation from window.LIMENDomains[*].brainDiagnoses.
  // Additive — zero behavior change when no brain emits brainDiagnoses.
  var dxActivationMap = _collectDiagnosisActivations(doms);

  // Merge: stress activations receive any matching diagnosisBindings from
  // dxActivationMap. Diagnosis-only activations (nodes named by an active
  // circuit but not in any stressed domain's static map) are appended with
  // their synthesized domain entry so the enrichOpportunity relevance
  // filter — which matches on domains[].feedDomain — can see them.
  var merged = [];
  var coveredNodeIds = {};
  for (var si = 0; si < stressActivations.length; si++) {
    var a = stressActivations[si];
    var dxEntry = dxActivationMap.get(a.nodeId);
    var bindings = dxEntry ? dxEntry.diagnosisBindings.slice() : [];
    // Shallow clone to avoid mutating the original stress activation object.
    merged.push({
      nodeId: a.nodeId,
      domains: a.domains,
      activationStrength: a.activationStrength,
      domainCount: a.domainCount,
      crossDomainNode: a.crossDomainNode,
      diagnosisBindings: bindings
    });
    coveredNodeIds[a.nodeId] = true;
  }
  dxActivationMap.forEach(function(v, nid) {
    if (!coveredNodeIds[nid]) merged.push(v);
  });

  // Re-sort using the existing rule: cross-domain first, then by strength.
  merged.sort(function(a, b) {
    if (a.crossDomainNode !== b.crossDomainNode) return b.crossDomainNode ? 1 : -1;
    return b.activationStrength - a.activationStrength;
  });

  // Build feed snapshot for pass-through (unchanged)
  var feedSnapshot = {};
  for (var fk in doms) {
    feedSnapshot[fk] = { stress: doms[fk].stress || 0, status: doms[fk].status || 'UNKNOWN' };
  }

  // Enrich each opportunity with connectome context
  var enriched = [];
  for (var i = 0; i < opportunities.length; i++) {
    enriched.push(enrichOpportunity(opportunities[i], merged, feedSnapshot));
  }

  // Store for external access (kernel adapter consumer reads nodeActivations).
  // The added diagnosisBindings field is ignored by the existing kernel chain.
  _lastResolve = {
    nodeActivations: merged,
    stressedDomains: stressedDomains,
    resolvedAt: Date.now()
  };

  return enriched;
}

var _lastResolve = null;

// ═══════════════════════════════════════════════════
// 6b. POLICY-PATH RESOLUTION (ADDITIVE — economy gap 2, OPT-IN)
// ═══════════════════════════════════════════════════
// Activates connectome nodes for a FISCAL or MONETARY policy shock, routing
// through the distinct connectome-domain set in MACRO_POLICY_PATH so fiscal and
// monetary transmission light up different circuits. This is a separate opt-in
// entry point; the default resolve() pipeline (above) is unchanged. No scoring —
// activation is the pass-through stress annotation, same as activateNodes().

/**
 * Resolve node activations for a single policy path ('fiscal' | 'monetary').
 * @param {String} path - 'fiscal' or 'monetary'
 * @param {Number} stress - raw stress value [0..1] for this policy shock
 * @returns {Object} { path, connectomeDomains, indicators, nodes }
 */
function resolvePolicyPath(path, stress) {
  var cfg = MACRO_POLICY_PATH[path];
  if (!cfg) return { path: path, connectomeDomains: [], indicators: [], nodes: [] };
  var s = (typeof stress === 'number') ? stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed
  // domain per connectome domain in the policy path's domain set.
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'POLICY' }; });
  // Map the synthetic feed ids straight through (they already ARE connectome
  // domain ids; activateNodes resolves via FEED_TO_CONNECTOME, so direct-match
  // entries — economy/finance/governance — route 1:1).
  var nodes = activateNodes(synth);
  // Annotate each node with the indicators on this policy path. Fiscal/monetary
  // reference MACRO_INDICATOR_BINDING; the intelligence path (intelligence gap 3)
  // references INTELLIGENCE_INDICATOR_BINDING — check both so each policy path
  // resolves its own registry. (Additive: pre-existing fiscal/monetary unchanged.)
  var indSet = cfg.indicators.map(function(id) {
    return MACRO_INDICATOR_BINDING[id] || INTELLIGENCE_INDICATOR_BINDING[id] || TRADE_INDICATOR_BINDING[id] || EDUCATION_INDICATOR_BINDING[id] || POPULATION_INDICATOR_BINDING[id];
  }).filter(Boolean);
  return {
    path: path,
    connectomeDomains: cfg.connectomeDomains.slice(),
    indicators: indSet,
    sources: (cfg.sources || []).slice(),
    nodes: nodes
  };
}

// ═══════════════════════════════════════════════════
// 6c. TECHNOLOGY SUB-CIRCUIT RESOLUTION (ADDITIVE — technology gap, OPT-IN)
// ═══════════════════════════════════════════════════
// Technology domain stress, by default, activates the generic 'technology' node
// set with NO differentiation of AI vs cybersecurity vs chip-supply — and those
// three have very different ENERGY/compute signatures. This routes a technology
// stress trigger to the correct sub-circuit (mirrors resolvePolicyPath: a separate
// opt-in entry point; the default resolve() pipeline is unchanged; no scoring).
// Each sub-circuit carries its energy-demand SCALING MODEL so grid/energy-demand
// modeling can pick the right curve when this technology stress emits a demand
// signal. Mirrors the connectome-side TECH_SUBCIRCUITS (kept in sync here so the
// resolver is self-contained — it does not import the connectome module).
//   • AI training   = LINEAR in GPU-days. Pathway dlPFC → AI → mPFC.
//   • Cybersecurity = constant baseline + breach BURST. Pathway vlPFC → rPFC → dACC.
//   • Chip supply   = fab power-per-wafer × utilization. Pathway M1 → THAL → BDNF.
// Real tech tickers only (chips / AI / cyber) — energy is the compute-demand
// coupling, never the domain's own identity.
var TECH_SUBCIRCUIT_ROUTING = {
  ai: {
    label: 'AI training circuit (compute/memory demand)',
    pathway: ['dlPFC', 'AI', 'mPFC'],
    role: 'training-resource-allocation → model-inference-load → budget-efficiency',
    energySignature: 'variable (scales with model size, training epochs, inference volume)',
    scalingModel: 'linear',                        // grid demand ∝ GPU-days
    // Connectome domains the sub-circuit lights up (technology is the home domain;
    // energy is the compute-demand coupling target, NOT tech identity).
    connectomeDomains: ['technology', 'energy'],
    triggers: ['ai_training_cost_spike', 'gpu_shortage', 'inference_demand_surge', 'model_scale_jump'],
    anchors: ['NVDA', 'AMD', 'MSFT', 'GOOGL', 'META', 'AMZN', 'PLTR']
  },
  security: {
    label: 'Cybersecurity circuit (defensive compute)',
    pathway: ['vlPFC', 'rPFC', 'dACC'],
    role: 'vulnerability-scanning → breach-response → incident-cost',
    energySignature: 'constant baseline + burst on breach (intrusion detection, forensics always-on)',
    scalingModel: 'baseline_plus_burst',           // grid demand = baseline + breach burst
    connectomeDomains: ['technology', 'energy'],
    triggers: ['ransomware_outbreak', 'breach_disclosure', 'zero_day_exploit', 'ddos_surge'],
    anchors: ['CRWD', 'PANW', 'MSFT', 'CSCO', 'FTNT', 'ZS']
  },
  supply: {
    label: 'Chip supply circuit (foundry capacity)',
    pathway: ['M1', 'THAL', 'BDNF'],
    role: 'node-advance-planning → fab-allocation → inventory-management',
    energySignature: 'depends on fab node (TSMC 3nm vs 28nm old-node has different power per wafer)',
    scalingModel: 'fab_power_per_wafer_x_utilization',
    connectomeDomains: ['technology', 'energy'],
    triggers: ['chip_shortage', 'fab_capacity_constraint', 'foundry_node_transition', 'export_control_shock'],
    anchors: ['TSM', 'ASML', 'INTC', 'NVDA', 'AVGO', 'AMD']
  }
};

// Reverse lookup: trigger source string → sub-circuit key (built once).
var TECH_TRIGGER_TO_SUBCIRCUIT = {};
for (var _tk in TECH_SUBCIRCUIT_ROUTING) {
  if (!Object.prototype.hasOwnProperty.call(TECH_SUBCIRCUIT_ROUTING, _tk)) continue;
  var _trg = TECH_SUBCIRCUIT_ROUTING[_tk].triggers || [];
  for (var _ti = 0; _ti < _trg.length; _ti++) TECH_TRIGGER_TO_SUBCIRCUIT[_trg[_ti]] = _tk;
}

/**
 * Route a technology stress trigger to its sub-circuit (AI / cybersecurity / chip
 * supply) and emit the energy-demand scaling model so grid/energy modeling can pick
 * the right curve. OPT-IN; default resolve() is unchanged. No scoring.
 * @param {String} stressTrigger - trigger source, e.g. 'ai_training_cost_spike',
 *        'ransomware_outbreak', 'chip_shortage'; OR a sub-circuit key 'ai'|'security'|'supply'.
 * @param {String} [domain] - originating domain (expected 'technology'); other
 *        domains return an inactive result (this gap is technology-specific).
 * @param {Object} [context] - optional { stress:Number } raw stress [0..1] for activation.
 * @returns {Object} { subCircuit, matched, label, pathway, role, energySignature,
 *          scalingModel, connectomeDomains, anchors, nodes }
 */
function resolveTechSubCircuit(stressTrigger, domain, context) {
  var dom = domain || 'technology';
  var inactive = {
    subCircuit: null, matched: false, trigger: stressTrigger || null, domain: dom,
    label: '', pathway: [], role: '', energySignature: '', scalingModel: '',
    connectomeDomains: [], anchors: [], nodes: []
  };
  // This gap is technology-specific; never hijack another domain's stress.
  if (dom !== 'technology') return inactive;

  // Resolve which sub-circuit: accept a direct key or a named trigger source.
  var key = null;
  if (stressTrigger && TECH_SUBCIRCUIT_ROUTING[stressTrigger]) {
    key = stressTrigger;
  } else if (stressTrigger && TECH_TRIGGER_TO_SUBCIRCUIT[stressTrigger]) {
    key = TECH_TRIGGER_TO_SUBCIRCUIT[stressTrigger];
  }
  if (!key) return inactive;

  var cfg = TECH_SUBCIRCUIT_ROUTING[key];
  var s = (context && typeof context.stress === 'number') ? context.stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed domain
  // per connectome domain on the sub-circuit (technology = home, energy = the
  // compute-demand coupling target so the emitted energy signal lights the grid).
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'TECH_SUBCIRCUIT' }; });
  var nodes = activateNodes(synth);

  return {
    subCircuit: key,
    matched: true,
    trigger: stressTrigger,
    domain: dom,
    label: cfg.label,
    pathway: cfg.pathway.slice(),
    role: cfg.role,
    // Energy demand signal: the scaling model downstream grid/energy modeling must use.
    energySignature: cfg.energySignature,
    scalingModel: cfg.scalingModel,
    connectomeDomains: cfg.connectomeDomains.slice(),
    anchors: cfg.anchors.slice(),
    nodes: nodes
  };
}

// ═══════════════════════════════════════════════════
// 6c-ag. AGRICULTURE SUB-CIRCUIT RESOLUTION (ADDITIVE — agriculture gap 3, OPT-IN)
// ═══════════════════════════════════════════════════
// Agriculture domain stress, by default, activates the generic 'p2' agriculture node
// set as a MONOLITHIC aggregate with NO differentiation of crop-production vs
// livestock-production vs commodity-trading vs farm-finance vs input-supply — and those
// have very different production lifecycles, stress pathways and (downstream) energy
// footprints. This routes an agriculture stress trigger to the correct sub-circuit
// (mirrors resolveTechSubCircuit / resolveTradeSubCircuit: a separate opt-in entry
// point; the default resolve() pipeline is unchanged; no scoring). Each circuit is a
// SEPARATE stress pathway through different REAL 'p2' agriculture nodes, plus its real
// ticker anchors. Mirrors the connectome-side FINANCE_CIRCUITS / TECHNOLOGY_CIRCUITS
// pattern (liquidity-vs-solvency / innovation-vs-supply) — here crop / livestock /
// trading / finance / input-supply are kept separate but interconnected, so an advisory
// layer can route a Crop-Price spike → Commodity stress [NAcc/OFC] → Input-cost pressure
// [mPFC/HAB] → Farm-Credit nodes [SNIG/LGN]. Each circuit carries its energy FOOTPRINT
// note so downstream demand modeling knows which circuits even COUPLE to energy:
//   • Crop production = mechanical power for tillage/spray (DE/AGCO mechanization).
//     Pathway GP[signal] → SMA[state] → TrkB[diagnostic] → TPOLE[action].
//   • Livestock      = feed-energy cost + processing (TSN supply-chain). Pathway
//     FEF[signal] → STN[diagnostic] → SCN[action].
//   • Commodity trade = logistics only, NO primary energy. Pathway NAcc → OFC → CARD.
//   • Farm finance   = credit overhead, NO energy. Pathway WERN → SNIG → IPL.
//   • Input supply   = fertilizer synthesis (Haber-Bosch energy-intensive) + seed/fuel;
//     couples to energy ONLY through NTR/MOS/CF company-ticker stress, never a direct
//     ag-to-energy edge. Pathway SNS → mPFC → HAB.
// Real agriculture tickers only — energy is the mechanization / fertilizer-synthesis
// CONSEQUENCE coupling (routed via industrial/transport DEMAND), never ag's own identity.
var AGRICULTURE_CIRCUITS = {
  crop_production: {
    label: 'Crop production circuit (seeding → growth → harvest)',
    pathway: ['GP', 'SMA', 'TrkB', 'TPOLE'],
    role: 'production-lifecycle: seeding-signal → crop-state → growth-diagnostic → harvest-action',
    energyFootprint: 'mechanical power for tillage/planting/spray (diesel/electric tractors & combines)',
    scalingModel: 'mechanization_hours_x_acreage',   // energy CONSEQUENCE ∝ field-machine hours, routed via industrial demand
    // Connectome domains the circuit lights up. Agriculture ('p2') is the home domain;
    // 'environment' = the soil/water/climate IMPACT coupling, NOT ag identity. Energy is
    // a downstream CONSEQUENCE (mechanization), never a home/feed domain here.
    connectomeDomains: ['p2', 'environment'],
    triggers: ['crop_production_shortfall', 'wasde_forecast_cut', 'drought_yield_loss', 'planting_delay'],
    anchors: ['DE', 'AGCO', 'CTVA', 'ADM']
  },
  livestock_production: {
    label: 'Livestock production circuit (breeding → feeding → slaughter)',
    pathway: ['FEF', 'STN', 'SCN'],
    role: 'production-lifecycle: livestock-signal → herd-diagnostic → processing-action',
    energyFootprint: 'feed-energy cost (feed-grain pass-through) + protein-processing & cold-chain',
    scalingModel: 'feed_cost_plus_processing_load',  // energy CONSEQUENCE via feed logistics & processing, routed downstream
    connectomeDomains: ['p2', 'trade'],
    triggers: ['livestock_price_collapse', 'feed_cost_spike', 'herd_liquidation', 'protein_demand_shock'],
    anchors: ['TSN', 'CAG', 'ADM']
  },
  commodity_trading: {
    label: 'Commodity trading circuit (futures / hedging)',
    pathway: ['NAcc', 'OFC', 'CARD'],
    role: 'price-discovery: premium-market-signal → commodity-market-state → futures-hedging',
    energyFootprint: 'logistics only — NO primary energy (grain handling / export elevators)',
    scalingModel: 'none',                            // commodity trading does not couple to energy
    connectomeDomains: ['p2', 'trade'],
    triggers: ['cbot_corn_spike', 'cbot_soybean_spike', 'cbot_wheat_spike', 'commodity_basis_blowout'],
    anchors: ['ADM', 'BG', 'INGR']
  },
  farm_finance: {
    label: 'Farm finance circuit (credit / land collateral)',
    pathway: ['WERN', 'SNIG', 'IPL'],
    role: 'capital-structure: farm-credit-diagnostic → land-collateral-action → finance-regulation',
    energyFootprint: 'credit overhead — NO energy footprint',
    scalingModel: 'none',                            // farm finance does not couple to energy
    connectomeDomains: ['p2', 'trade'],
    triggers: ['farm_debt_ratio_spike', 'farmland_value_drop', 'farm_credit_tightening', 'interest_burden'],
    anchors: ['DE', 'ADM']
  },
  input_supply: {
    label: 'Input supply circuit (fertilizer / seed / fuel)',
    pathway: ['SNS', 'mPFC', 'HAB'],
    role: 'input-cost: nutrient-signal → fertilizer-diagnostic → input-action',
    energyFootprint: 'fertilizer SYNTHESIS (Haber-Bosch ammonia is energy-intensive) + seed/fuel; couples ONLY via NTR/MOS/CF ticker stress',
    scalingModel: 'ammonia_synthesis_energy_x_volume', // energy CONSEQUENCE ONLY through company-ticker stress, never a direct ag-to-energy edge
    connectomeDomains: ['p2', 'environment'],
    triggers: ['ammonia_cost_spike', 'urea_cost_spike', 'seed_supply_constraint', 'fertilizer_shortage'],
    anchors: ['NTR', 'MOS', 'CF', 'CTVA', 'FMC']
  }
};

// Reverse lookup: trigger source string → agriculture circuit key (built once).
var AGRICULTURE_TRIGGER_TO_CIRCUIT = {};
for (var _agck in AGRICULTURE_CIRCUITS) {
  if (!Object.prototype.hasOwnProperty.call(AGRICULTURE_CIRCUITS, _agck)) continue;
  var _agtrg = AGRICULTURE_CIRCUITS[_agck].triggers || [];
  for (var _agti = 0; _agti < _agtrg.length; _agti++) AGRICULTURE_TRIGGER_TO_CIRCUIT[_agtrg[_agti]] = _agck;
}

/**
 * Route an agriculture stress trigger to its circuit (crop production / livestock
 * production / commodity trading / farm finance / input supply) and emit the energy-
 * footprint note + scaling model so downstream demand modeling knows which circuits even
 * COUPLE to energy. OPT-IN; default resolve() is unchanged. No scoring. Mirrors
 * resolveTechSubCircuit / resolveTradeSubCircuit.
 * @param {String} stressTrigger - trigger source, e.g. 'crop_production_shortfall',
 *        'livestock_price_collapse', 'cbot_corn_spike', 'ammonia_cost_spike'; OR a
 *        circuit key 'crop_production'|'livestock_production'|'commodity_trading'|
 *        'farm_finance'|'input_supply'.
 * @param {String} [domain] - originating domain (expected 'agriculture'); other domains
 *        return an inactive result (this gap is agriculture-specific).
 * @param {Object} [context] - optional { stress:Number } raw stress [0..1] for activation.
 * @returns {Object} { circuit, matched, label, pathway, role, energyFootprint,
 *          scalingModel, connectomeDomains, anchors, nodes }
 */
function resolveAgricultureCircuit(stressTrigger, domain, context) {
  var dom = domain || 'agriculture';
  var inactive = {
    circuit: null, matched: false, trigger: stressTrigger || null, domain: dom,
    label: '', pathway: [], role: '', energyFootprint: '', scalingModel: '',
    connectomeDomains: [], anchors: [], nodes: []
  };
  // This gap is agriculture-specific; never hijack another domain's stress.
  if (dom !== 'agriculture') return inactive;

  // Resolve which circuit: accept a direct key or a named trigger source.
  var key = null;
  if (stressTrigger && AGRICULTURE_CIRCUITS[stressTrigger]) {
    key = stressTrigger;
  } else if (stressTrigger && AGRICULTURE_TRIGGER_TO_CIRCUIT[stressTrigger]) {
    key = AGRICULTURE_TRIGGER_TO_CIRCUIT[stressTrigger];
  }
  if (!key) return inactive;

  var cfg = AGRICULTURE_CIRCUITS[key];
  var s = (context && typeof context.stress === 'number') ? context.stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed domain per
  // connectome domain on the circuit (agriculture = home via 'p2'; environment/trade =
  // the coupling targets). Energy is NEVER synthesized here — it is only a downstream
  // CONSEQUENCE note (energyFootprint/scalingModel), never an activated feed domain.
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'AGRICULTURE_CIRCUIT' }; });
  var nodes = activateNodes(synth);

  return {
    circuit: key,
    matched: true,
    trigger: stressTrigger,
    domain: dom,
    label: cfg.label,
    pathway: cfg.pathway.slice(),
    role: cfg.role,
    // Energy CONSEQUENCE signal (note + scaling model) — never an ag-to-energy edge.
    energyFootprint: cfg.energyFootprint,
    scalingModel: cfg.scalingModel,
    connectomeDomains: cfg.connectomeDomains.slice(),
    anchors: cfg.anchors.slice(),
    nodes: nodes
  };
}

// ═══════════════════════════════════════════════════
// 6c-edu. EDUCATION CIRCUIT SEGREGATION (ADDITIVE — education gap 3, OPT-IN)
// ═══════════════════════════════════════════════════
// Education domain stress, by default, activates the generic 'education' node set with NO
// differentiation of K-12 schools vs higher-ed vs edtech platforms vs workforce/skills
// training vs student-debt pathways — and those have very different funding sources,
// stress pathways and outcomes (a NAEP score drop ≠ a college-admissions collapse ≠ an
// edtech churn spike ≠ a student-loan default surge). This routes an education stress
// trigger to the correct sub-circuit (mirrors resolveAgricultureCircuit / resolveTradeSub
// Circuit: a separate opt-in entry point; the default resolve() pipeline is unchanged; no
// scoring). Culture routes THROUGH education (civilization-connectome culture→
// ['culture','religion','education']) but there is no reciprocal education→culture/economy
// edge in the base map; these circuits make the education-side pathways explicit. Each
// circuit is a SEPARATE stress pathway through different REAL 'education' nodes plus its
// real ticker anchors + policy source. Real education tickers only. Each circuit carries an
// energySignature note = ZERO: student-support infrastructure (libraries, labs, servers) is
// a FACILITY coupling routed via the infrastructure domain; K-12 facility power is an
// infrastructure concern, not an education signal. Education NEVER activates energy nodes —
// only infrastructure + population (demographics) + economy (tuition/funding) couple, and
// only as downstream CONSEQUENCES, never an education-to-energy edge.
//   • K-12 schools     = teaching, curriculum, public funding. BLA → BROCA → S1 → dlPFC.
//   • higher ed        = university research, admissions, degree output. AG → ANT → CC → vlPFC.
//   • edtech platforms = online learning, engagement, access equity. AI → mPFC → NAcc → V1.
//   • workforce/skills = vocational training, credentialing, labor alignment. dlPFC → STRI → VP → CC.
var EDUCATION_CIRCUITS = {
  k12_schools: {
    label: 'K-12 schools circuit (teaching → curriculum → public funding)',
    pathway: ['BLA', 'BROCA', 'S1', 'dlPFC'],
    role: 'learning-delivery: human-capital-signal → K-12-teaching → secondary-assessment → curriculum-design',
    energySignature: 'ZERO — school facility power/HVAC is an infrastructure consequence of building occupancy, never a K-12 education signal',
    scalingModel: 'none',                            // K-12 education does not couple to energy
    // Connectome domains the circuit lights up. Education is the home domain; 'governance' =
    // the public-funding / school-board authority coupling, NOT education identity. Energy is
    // never a home/feed domain here.
    connectomeDomains: ['education', 'governance'],
    triggers: ['teacher_shortage', 'naep_score_drop', 'k12_funding_cut', 'literacy_decline'],
    anchors: ['LRN', 'PSO']
  },
  higher_ed: {
    label: 'Higher-ed circuit (research → admissions → degree output)',
    pathway: ['AG', 'ANT', 'CC', 'vlPFC'],
    role: 'degree-throughput: higher-ed-signal → college-admissions → completion-quality → student-outcome-research',
    energySignature: 'ZERO — campus power/cooling is an infrastructure consequence of facility occupancy, never a higher-ed education signal',
    scalingModel: 'none',                            // higher ed does not couple to energy
    connectomeDomains: ['education', 'finance'],
    triggers: ['admissions_decline', 'enrollment_collapse', 'grad_rate_decline', 'tuition_affordability_shock'],
    anchors: ['ATGE', 'LOPE', 'STRA', 'LAUR']
  },
  edtech_platforms: {
    label: 'Edtech platforms circuit (online learning → engagement → access equity)',
    pathway: ['AI', 'mPFC', 'NAcc', 'V1'],
    role: 'digital-learning: assessment-signal → enrollment-reach → engagement-motivation → access-equity',
    energySignature: 'ZERO — edtech platform scaling → data-center load is a facility-operations coupling (infrastructure domain), never an education-signal origin',
    scalingModel: 'none',                            // edtech compute load is an infrastructure consequence, not an education-to-energy edge
    connectomeDomains: ['education', 'technology'],
    triggers: ['edtech_churn', 'engagement_drop', 'access_inequity', 'subscriber_decline'],
    anchors: ['CHGG', 'COUR', 'DUOL', 'TWOU']
  },
  workforce_skills: {
    label: 'Workforce / skills circuit (vocational training → credentialing → labor alignment)',
    pathway: ['dlPFC', 'STRI', 'VP', 'CC'],
    role: 'skills-supply: pedagogy-signal → training-operations → credentialing → labor-market-quality',
    energySignature: 'ZERO — training-lab/server power is an infrastructure consequence of facility use, never a workforce-education signal',
    scalingModel: 'none',                            // workforce/skills training does not couple to energy
    connectomeDomains: ['education', 'economy'],
    triggers: ['workforce_skills_gap', 'credential_devaluation', 'vocational_enrollment_drop', 'labor_misalignment'],
    anchors: ['UTI', 'ATGE', 'LOPE']
  }
};

// Reverse lookup: trigger source string → education circuit key (built once).
var EDUCATION_TRIGGER_TO_CIRCUIT = {};
for (var _edck in EDUCATION_CIRCUITS) {
  if (!Object.prototype.hasOwnProperty.call(EDUCATION_CIRCUITS, _edck)) continue;
  var _edtrg = EDUCATION_CIRCUITS[_edck].triggers || [];
  for (var _edti = 0; _edti < _edtrg.length; _edti++) EDUCATION_TRIGGER_TO_CIRCUIT[_edtrg[_edti]] = _edck;
}

/**
 * Route an education stress trigger to its circuit (K-12 schools / higher ed / edtech
 * platforms / workforce skills) and emit the energy-signature note (ZERO) so downstream
 * modeling knows education never couples to energy as a signal origin. OPT-IN; default
 * resolve() is unchanged. No scoring. Mirrors resolveAgricultureCircuit.
 * @param {String} stressTrigger - trigger source, e.g. 'teacher_shortage',
 *        'admissions_decline', 'loan_default_spike', 'edtech_churn',
 *        'workforce_skills_gap'; OR a circuit key 'k12_schools'|'higher_ed'|
 *        'edtech_platforms'|'workforce_skills'; OR the convenience aliases
 *        'admissions_decline'/'loan_default_spike'/'edtech_churn'/'workforce_training'.
 * @param {String} [domain] - originating domain (expected 'education'); other domains
 *        return an inactive result (this gap is education-specific).
 * @param {Object} [context] - optional { stress:Number } raw stress [0..1] for activation.
 * @returns {Object} { circuit, matched, label, pathway, role, energySignature,
 *          scalingModel, connectomeDomains, anchors, nodes }
 */
function resolveEducationCircuit(stressTrigger, domain, context) {
  var dom = domain || 'education';
  var inactive = {
    circuit: null, matched: false, trigger: stressTrigger || null, domain: dom,
    label: '', pathway: [], role: '', energySignature: '', scalingModel: '',
    connectomeDomains: [], anchors: [], nodes: []
  };
  // This gap is education-specific; never hijack another domain's stress.
  if (dom !== 'education') return inactive;

  // Convenience aliases so an advisory layer can pass a finance-style trigger name and
  // still route to the right education circuit (per the EDUCATION_TRIGGER_TO_CIRCUIT spec).
  var aliases = {
    loan_default_spike: 'higher_ed',   // student-debt stress routes via the higher-ed solvency pathway
    education_finance: 'higher_ed',
    workforce_training: 'workforce_skills'
  };

  // Resolve which circuit: accept a direct key, a named trigger source, or an alias.
  var key = null;
  if (stressTrigger && EDUCATION_CIRCUITS[stressTrigger]) {
    key = stressTrigger;
  } else if (stressTrigger && EDUCATION_TRIGGER_TO_CIRCUIT[stressTrigger]) {
    key = EDUCATION_TRIGGER_TO_CIRCUIT[stressTrigger];
  } else if (stressTrigger && aliases[stressTrigger]) {
    key = aliases[stressTrigger];
  }
  if (!key) return inactive;

  var cfg = EDUCATION_CIRCUITS[key];
  var s = (context && typeof context.stress === 'number') ? context.stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed domain per
  // connectome domain on the circuit (education = home; governance/finance/technology/
  // economy = the coupling targets). Energy is NEVER synthesized here — it is only a
  // downstream CONSEQUENCE note (energySignature = ZERO), never an activated feed domain.
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'EDUCATION_CIRCUIT' }; });
  var nodes = activateNodes(synth);

  return {
    circuit: key,
    matched: true,
    trigger: stressTrigger,
    domain: dom,
    label: cfg.label,
    pathway: cfg.pathway.slice(),
    role: cfg.role,
    // Energy CONSEQUENCE signal (note + scaling model) — education carries ZERO energy
    // identity; the only couplings are infrastructure/population/economy, never energy.
    energySignature: cfg.energySignature,
    scalingModel: cfg.scalingModel,
    connectomeDomains: cfg.connectomeDomains.slice(),
    anchors: cfg.anchors.slice(),
    nodes: nodes
  };
}

/**
 * Resolve node activations for an education policy shock (K-12 funding / higher-ed
 * regulation / student debt). Thin convenience wrapper over resolvePolicyPath that accepts
 * a BARE policy name (e.g. 'k12_funding' or 'student_debt') and maps it to the namespaced
 * MACRO_POLICY_PATH key ('education_k12_funding'). OPT-IN; default resolve() pipeline
 * unchanged. No scoring. Education-specific — the signal ORIGIN is education-regulation
 * authority (state K-12 boards, accreditors, Federal Student Aid), never energy.
 * @param {String} policy - 'education_k12_funding' | 'education_higher_ed_regulation' |
 *        'education_student_debt' (also accepts short aliases 'k12'/'k12_funding',
 *        'higher_ed'/'higher_ed_regulation', 'student_debt'/'debt').
 * @param {Number} stress - raw stress value [0..1] for this policy shock.
 * @returns {Object} same shape as resolvePolicyPath.
 */
function resolveEducationPolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var aliases = {
    k12: 'education_k12_funding',
    k12_funding: 'education_k12_funding',
    higher_ed: 'education_higher_ed_regulation',
    higher_ed_regulation: 'education_higher_ed_regulation',
    student_debt: 'education_student_debt',
    debt: 'education_student_debt'
  };
  var key = MACRO_POLICY_PATH[policy] ? policy
          : (aliases[policy] || ('education_' + String(policy).replace(/-/g, '_')));
  return resolvePolicyPath(key, stress);
}

// ═══════════════════════════════════════════════════
// 6c-sci. SCIENCE / RESEARCH CIRCUIT SEGREGATION (ADDITIVE — science gap 5, OPT-IN)
// ═══════════════════════════════════════════════════
// Science (research) domain stress, by default, activates the generic 'science' node set with NO
// differentiation of basic-research vs applied-R&D vs research-infrastructure vs research-funding
// pathways — and those have very different signal sources, stress pathways and outcomes (a
// peer-review backlog ≠ a drug-discovery pipeline stall ≠ a core-facility instrument outage ≠ an
// NSF appropriation cut). This routes a science stress trigger to the correct sub-circuit
// (mirrors resolveAgricultureCircuit / resolveEducationCircuit: a separate opt-in entry point; the
// default resolve() pipeline is unchanged; no scoring). DUAL-KEY NOTE: the connectome-domain key
// is 'science' (matches brain-node-domains.json); the runtime/snapshot key is 'research'
// (domain-identity.js). Each sub-circuit is a SEPARATE stress pathway through different REAL
// 'science' nodes plus its real ticker anchors + a research-identity anchor. Each circuit carries
// an energySignature note = ZERO: research never originates an energy signal — R&D facility power /
// lab electricity / HPC data-center compute couple DOWNSTREAM only (route via infrastructure /
// technology nodes if the origin is compute stress), never an originating science-to-energy edge,
// and science nodes carry zero energy-domain content. DISTINCT from technology circuits (which DO
// carry energy signatures: AI training = linear GPU-days, chip supply = fab power-per-wafer) and
// agriculture circuits (seasonal/logistics energy signatures). Science circuits carry zero energy
// content for every non-science node.
//   • basic-research          = hypothesis testing → experimental design → peer review → publication. DMN → dlPFC → dACC → BROCA.
//   • applied-research / R&D   = drug discovery, materials, process innovation. HYPO → OFC → HAB → FPN.
//   • research-infrastructure  = lab equipment, scientific instruments, academic facilities. M1 → MFC → VP → NBM.
//   • research-funding / grant = NSF/NIH awards, R&D budget, funding bottlenecks. vmPFC → PRC → MGN → STRI.
var SCIENCE_CIRCUITS = {
  basic_research: {
    label: 'Basic-research circuit (hypothesis → experiment → peer review → publication)',
    pathway: ['DMN', 'dlPFC', 'dACC', 'BROCA'],
    role: 'discovery-lifecycle: hypothesis-generation → experimental-design → peer-review → publication-and-dissemination',
    energySignature: 'ZERO — a peer-review backlog may couple to journal editorial compute downstream, but the signal origin is editorial / peer-review throughput, never energy',
    scalingModel: 'none',                            // basic research does not couple to energy
    // Connectome domains the circuit lights up. Science (runtime key 'research') is the home
    // domain; 'governance' = the research-integrity / peer-review oversight authority coupling,
    // NOT science identity. Energy is never a home/feed domain here.
    connectomeDomains: ['science', 'governance'],
    triggers: ['peer_review_backlog', 'publication_slowdown', 'hypothesis_pipeline_stall', 'replication_crisis'],
    anchors: ['IQV', 'ICLR']
  },
  applied_research: {
    label: 'Applied-research / R&D circuit (drug discovery → materials → process innovation)',
    pathway: ['HYPO', 'OFC', 'HAB', 'FPN'],
    role: 'rnd-pipeline: life-science-signal → chemistry-methods → rnd-development → data-analysis',
    energySignature: 'ZERO — wet-lab / synthesis bench power is a facility-operations consequence of R&D activity, never an applied-research signal origin',
    scalingModel: 'none',                            // applied R&D does not couple to energy as a signal
    connectomeDomains: ['science', 'technology'],
    triggers: ['rnd_pipeline_stall', 'drug_discovery_slowdown', 'materials_research_delay', 'process_innovation_gap'],
    anchors: ['TMO', 'DHR', 'ILMN', 'BIO', 'RVTY']
  },
  research_infrastructure: {
    label: 'Research-infrastructure circuit (lab equipment → instruments → academic facilities)',
    pathway: ['M1', 'MFC', 'VP', 'NBM'],
    role: 'capacity: laboratory-methods → shared-facilities → research-infrastructure → methods-infrastructure',
    energySignature: 'ZERO — instrument / core-facility electricity is a facility-operations consequence, never a research-infrastructure signal origin; route compute-origin stress via infrastructure/technology',
    scalingModel: 'none',                            // research infrastructure does not originate an energy edge
    connectomeDomains: ['science', 'infrastructure'],
    triggers: ['instrument_outage', 'lab_equipment_downtime', 'core_facility_constraint', 'hpc_capacity_shortfall'],
    anchors: ['A', 'MTD', 'WAT', 'BRKR']
  },
  research_funding: {
    label: 'Research-funding / grant-management circuit (NSF/NIH awards → budget → bottlenecks)',
    pathway: ['vmPFC', 'PRC', 'MGN', 'STRI'],
    role: 'capital-structure: funding-and-grants → research-policy → research-workforce → research-governance',
    energySignature: 'ZERO — grant administration carries no energy footprint; appropriation shocks are policy events, never energy events',
    scalingModel: 'none',                            // research funding does not couple to energy
    connectomeDomains: ['science', 'governance', 'finance'],
    triggers: ['nsf_budget_cut', 'nih_approval_slowdown', 'grant_award_reduction', 'rnd_budget_shortfall'],
    anchors: ['IQV']
  }
};

// Reverse lookup: trigger source string → science circuit key (built once).
var SCIENCE_TRIGGER_TO_CIRCUIT = {};
for (var _scck in SCIENCE_CIRCUITS) {
  if (!Object.prototype.hasOwnProperty.call(SCIENCE_CIRCUITS, _scck)) continue;
  var _sctrg = SCIENCE_CIRCUITS[_scck].triggers || [];
  for (var _scti = 0; _scti < _sctrg.length; _scti++) SCIENCE_TRIGGER_TO_CIRCUIT[_sctrg[_scti]] = _scck;
}

/**
 * Route a science (research) stress trigger to its circuit (basic research / applied research /
 * research infrastructure / research funding) and emit the energy-signature note (ZERO) so
 * downstream modeling knows science never couples to energy as a signal origin. OPT-IN; default
 * resolve() is unchanged. No scoring. Mirrors resolveAgricultureCircuit / resolveEducationCircuit.
 * DUAL-KEY: connectome-domain key is 'science' (matches brain-node-domains.json); accepts either
 * the canonical 'science' or the runtime/snapshot alias 'research' as the originating domain.
 * @param {String} stressTrigger - trigger source, e.g. 'peer_review_backlog', 'rnd_pipeline_stall',
 *        'instrument_outage', 'nsf_budget_cut'; OR a circuit key 'basic_research'|'applied_research'|
 *        'research_infrastructure'|'research_funding'; OR a convenience alias.
 * @param {String} [domain] - originating domain (expected 'science' or 'research'); other domains
 *        return an inactive result (this gap is science-specific).
 * @param {Object} [context] - optional { stress:Number } raw stress [0..1] for activation.
 * @returns {Object} { circuit, matched, label, pathway, role, energySignature,
 *          scalingModel, connectomeDomains, anchors, nodes }
 */
function resolveScienceCircuit(stressTrigger, domain, context) {
  var dom = domain || 'science';
  var inactive = {
    circuit: null, matched: false, trigger: stressTrigger || null, domain: dom,
    label: '', pathway: [], role: '', energySignature: '', scalingModel: '',
    connectomeDomains: [], anchors: [], nodes: []
  };
  // This gap is science-specific; accept the science<->research dual key, never hijack others.
  if (dom !== 'science' && dom !== 'research') return inactive;

  // Convenience aliases so an advisory layer can pass a research-style trigger name and still
  // route to the right science circuit (per the SCIENCE_TRIGGER_TO_CIRCUIT spec).
  var aliases = {
    rnd_pipeline: 'applied_research',
    drug_discovery: 'applied_research',
    grant_management: 'research_funding',
    research_grants: 'research_funding',
    lab_infrastructure: 'research_infrastructure',
    peer_review: 'basic_research'
  };

  // Resolve which circuit: accept a direct key, a named trigger source, or an alias.
  var key = null;
  if (stressTrigger && SCIENCE_CIRCUITS[stressTrigger]) {
    key = stressTrigger;
  } else if (stressTrigger && SCIENCE_TRIGGER_TO_CIRCUIT[stressTrigger]) {
    key = SCIENCE_TRIGGER_TO_CIRCUIT[stressTrigger];
  } else if (stressTrigger && aliases[stressTrigger]) {
    key = aliases[stressTrigger];
  }
  if (!key) return inactive;

  var cfg = SCIENCE_CIRCUITS[key];
  var s = (context && typeof context.stress === 'number') ? context.stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed domain per connectome
  // domain on the circuit (science = home; governance/technology/infrastructure/finance = the
  // coupling targets). Energy is NEVER synthesized here — it is only a downstream CONSEQUENCE
  // note (energySignature = ZERO), never an activated feed domain.
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'SCIENCE_CIRCUIT' }; });
  var nodes = activateNodes(synth);

  return {
    circuit: key,
    matched: true,
    trigger: stressTrigger,
    domain: dom,
    label: cfg.label,
    pathway: cfg.pathway.slice(),
    role: cfg.role,
    // Energy CONSEQUENCE signal (note + scaling model) — science carries ZERO energy identity;
    // the only couplings are governance/technology/infrastructure/finance, never energy.
    energySignature: cfg.energySignature,
    scalingModel: cfg.scalingModel,
    connectomeDomains: cfg.connectomeDomains.slice(),
    anchors: cfg.anchors.slice(),
    nodes: nodes
  };
}

/**
 * Resolve a SCIENCE / RESEARCH policy shock to its connectome nodes (science gap 6, OPT-IN).
 * Mirrors resolveEducationPolicyPath: accepts a canonical MACRO_POLICY_PATH key
 * ('research_funding' / 'research_regulation' / 'science_education_mandate') OR a short alias, and
 * routes through the shared resolvePolicyPath engine. Research-policy identity only — fundamental-
 * research funding authority (NSF/NIH appropriation), research regulation (peer-review / research-
 * integrity / scientific-conduct rules), science-education STEM mandates; energy is never part of
 * the signal chain (energy regulation = FERC/PUC governance authority, kept DISTINCT). DUAL-KEY:
 * 'science' is the portal key, 'research' the runtime/snapshot key. Default resolve() pipeline is
 * unchanged; no scoring.
 * @param {String} policy - canonical key or alias ('funding'/'regulation'/'stem'/'mandate').
 * @param {Number} [stress] - raw stress [0..1] for activation.
 * @returns {Object} resolvePolicyPath() result for the research policy path.
 */
function resolveSciencePolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var aliases = {
    funding: 'research_funding',
    research_funding: 'research_funding',
    grants: 'research_funding',
    grant: 'research_funding',
    nsf: 'research_funding',
    nih: 'research_funding',
    regulation: 'research_regulation',
    research_regulation: 'research_regulation',
    integrity: 'research_regulation',
    peer_review: 'research_regulation',
    conduct: 'research_regulation',
    stem: 'science_education_mandate',
    mandate: 'science_education_mandate',
    science_education: 'science_education_mandate',
    education_mandate: 'science_education_mandate'
  };
  var key = MACRO_POLICY_PATH[policy] ? policy
          : (aliases[policy] || ('research_' + String(policy).replace(/-/g, '_')));
  return resolvePolicyPath(key, stress);
}

/**
 * Resolve a POPULATION / demographic policy shock to its connectome nodes (population gap 2,
 * OPT-IN). Mirrors resolveEducationPolicyPath: accepts a canonical MACRO_POLICY_PATH key
 * ('pop_immigration_reform' / 'pop_fertility_incentive' / 'pop_aging_care') OR a short alias,
 * and routes through the shared resolvePolicyPath engine. Demographic-policy identity only —
 * immigration/settlement, fertility/household incentives, aging-care mandates; energy is never
 * part of the signal chain (settlement capex / aging-care facility load are downstream
 * consequences). Default resolve() pipeline is unchanged; no scoring.
 * @param {String} policy - canonical key or alias ('immigration'/'fertility'/'aging').
 * @param {Number} [stress] - raw stress [0..1] for activation.
 * @returns {Object} resolvePolicyPath() result for the population policy path.
 */
function resolvePopulationPolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var aliases = {
    immigration: 'pop_immigration_reform',
    immigration_reform: 'pop_immigration_reform',
    migration: 'pop_immigration_reform',
    settlement: 'pop_immigration_reform',
    fertility: 'pop_fertility_incentive',
    fertility_incentive: 'pop_fertility_incentive',
    birth: 'pop_fertility_incentive',
    household: 'pop_fertility_incentive',
    aging: 'pop_aging_care',
    aging_care: 'pop_aging_care',
    gerontology: 'pop_aging_care',
    medicare: 'pop_aging_care'
  };
  var key = MACRO_POLICY_PATH[policy] ? policy
          : (aliases[policy] || ('pop_' + String(policy).replace(/-/g, '_')));
  return resolvePolicyPath(key, stress);
}

// ═══════════════════════════════════════════════════
// 6d. TRADE SUB-CIRCUIT RESOLUTION (ADDITIVE — trade gap, OPT-IN)
// ═══════════════════════════════════════════════════
// Trade (supply-chain) stress, by default, activates the generic ['trade','finance']
// node set with NO differentiation of container-maritime vs trucking vs air-cargo vs
// customs — and those four have very different capacity/cost curves and geopolitical
// exposure (export control on chips → container shortage; driver scarcity → trucking
// cost surge; sanctions → port closure). This routes a trade stress trigger to the
// correct sub-circuit (mirrors resolveTechSubCircuit: a separate opt-in entry point;
// the default resolve() pipeline is unchanged; no scoring). Each sub-circuit carries
// its capacity/cost SIGNATURE so downstream modeling can pick the right curve. Real
// trade/logistics tickers only. The SIGNAL ORIGIN is trade operational cost (vessel
// utilization, driver scarcity, tolling, customs backlog), NOT energy production —
// fuel-cost coupling (e.g. trucking fuel hedging → oil/gas demand visibility) is a
// downstream CONSEQUENCE, never the domain identity.
//   • container-maritime = vessel utilization × alliance capacity. NTS → THAL → vmPFC.
//   • trucking-drayage    = driver supply + fuel hedge + tolling. M1 → S1 → CARD.
//   • air-cargo           = fuel surcharge + aircraft utilization. FEF → CC → OFC.
//   • customs-compliance  = tariff change + origin cert backlog + OFAC. OFC → vmPFC → TPJ.
var TRADE_SUBCIRCUIT_ROUTING = {
  'container-maritime': {
    label: 'Container maritime circuit (vessel utilization & port capacity)',
    pathway: ['NTS', 'THAL', 'vmPFC'],
    role: 'vessel-utilization → port-queue-clearance → alliance-capacity-allocation',
    costSignature: 'high fixed cost (vessel + slot), nonlinear surge on port congestion & blank sailings',
    scalingModel: 'utilization_x_alliance_capacity',
    // Connectome domains the sub-circuit lights up (trade is the home domain;
    // finance is the trade-finance coupling — letters of credit, freight collateral).
    connectomeDomains: ['trade', 'finance'],
    triggers: ['port_congestion', 'blank_sailing_surge', 'container_shortage', 'alliance_capacity_cut', 'canal_disruption'],
    anchors: ['ZIM', 'MATX', 'AMKBY']
  },
  'trucking-drayage': {
    label: 'Trucking & drayage circuit (road freight capacity)',
    pathway: ['M1', 'S1', 'CARD'],
    role: 'driver-supply → last-mile-throughput → fuel-hedge-and-tolling-cost',
    costSignature: 'driver-scarcity wage pressure + tolling + fuel pass-through (fuel is a downstream cost, not the origin)',
    scalingModel: 'driver_supply_x_tolling_pressure',
    connectomeDomains: ['trade', 'finance'],
    triggers: ['driver_shortage', 'fuel_surcharge_spike', 'tolling_increase', 'ltl_capacity_crunch', 'drayage_backlog'],
    anchors: ['XPO', 'ODFL', 'GXO']
  },
  'air-cargo': {
    label: 'Air-cargo circuit (express freight capacity)',
    pathway: ['FEF', 'CC', 'OFC'],
    role: 'aircraft-utilization → forwarding-capacity → fuel-surcharge-and-clearance',
    costSignature: 'fuel surcharge + aircraft utilization; bursts on belly-capacity loss & peak-season parcel surge',
    scalingModel: 'aircraft_utilization_x_fuel_surcharge',
    connectomeDomains: ['trade', 'finance'],
    triggers: ['fuel_surcharge_spike', 'belly_capacity_loss', 'parcel_peak_surge', 'aircraft_grounding'],
    anchors: ['FDX', 'UPS']
  },
  'customs-compliance': {
    label: 'Customs & compliance circuit (tariff / sanctions / origin)',
    pathway: ['OFC', 'vmPFC', 'TPJ'],
    role: 'tariff-valuation → origin-certificate-clearance → cross-border-sanctions-screening',
    costSignature: 'step changes on tariff/sanctions rule shifts; backlog accrues on origin-cert & OFAC screening load',
    scalingModel: 'tariff_change_plus_clearance_backlog',
    connectomeDomains: ['trade', 'governance'],
    triggers: ['tariff_change', 'origin_certificate_backlog', 'ofac_sanctions_action', 'export_control_shock', 'customs_clearance_backlog'],
    anchors: ['EXPD', 'CHRW', 'DSDVY']
  }
};

// Reverse lookup: trigger source string → trade sub-circuit key (built once).
var TRADE_TRIGGER_TO_SUBCIRCUIT = {};
for (var _trsk in TRADE_SUBCIRCUIT_ROUTING) {
  if (!Object.prototype.hasOwnProperty.call(TRADE_SUBCIRCUIT_ROUTING, _trsk)) continue;
  var _trtrg = TRADE_SUBCIRCUIT_ROUTING[_trsk].triggers || [];
  for (var _trti = 0; _trti < _trtrg.length; _trti++) TRADE_TRIGGER_TO_SUBCIRCUIT[_trtrg[_trti]] = _trsk;
}

/**
 * Route a trade stress trigger to its sub-circuit (container-maritime / trucking-
 * drayage / air-cargo / customs-compliance) and emit the capacity/cost signature so
 * downstream supply-chain modeling can pick the right curve. OPT-IN; default resolve()
 * is unchanged. No scoring. Trade-specific; never hijacks another domain's stress.
 * The trade domain's runtime/snapshot key is 'supplyChain' (see domain-identity.js),
 * so the domain guard accepts BOTH the canonical 'trade' and snapshot 'supplyChain'.
 * @param {String} stressTrigger - trigger source, e.g. 'port_congestion',
 *        'driver_shortage', 'tariff_change'; OR a sub-circuit key.
 * @param {String} [domain] - originating domain (expected 'trade' or 'supplyChain');
 *        other domains return an inactive result (this gap is trade-specific).
 * @param {Object} [context] - optional { stress:Number } raw stress [0..1] for activation.
 * @returns {Object} { subCircuit, matched, label, pathway, role, costSignature,
 *          scalingModel, connectomeDomains, anchors, nodes }
 */
function resolveTradeSubCircuit(stressTrigger, domain, context) {
  var dom = domain || 'trade';
  var inactive = {
    subCircuit: null, matched: false, trigger: stressTrigger || null, domain: dom,
    label: '', pathway: [], role: '', costSignature: '', scalingModel: '',
    connectomeDomains: [], anchors: [], nodes: []
  };
  // This gap is trade-specific; never hijack another domain's stress. Accept both
  // the canonical URL key 'trade' and the runtime/snapshot key 'supplyChain'.
  if (dom !== 'trade' && dom !== 'supplyChain') return inactive;

  // Resolve which sub-circuit: accept a direct key or a named trigger source.
  var key = null;
  if (stressTrigger && TRADE_SUBCIRCUIT_ROUTING[stressTrigger]) {
    key = stressTrigger;
  } else if (stressTrigger && TRADE_TRIGGER_TO_SUBCIRCUIT[stressTrigger]) {
    key = TRADE_TRIGGER_TO_SUBCIRCUIT[stressTrigger];
  }
  if (!key) return inactive;

  var cfg = TRADE_SUBCIRCUIT_ROUTING[key];
  var s = (context && typeof context.stress === 'number') ? context.stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed domain
  // per connectome domain on the sub-circuit (trade = home; finance/governance =
  // the trade-finance / policy coupling targets).
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'TRADE_SUBCIRCUIT' }; });
  var nodes = activateNodes(synth);

  return {
    subCircuit: key,
    matched: true,
    trigger: stressTrigger,
    domain: dom,
    label: cfg.label,
    pathway: cfg.pathway.slice(),
    role: cfg.role,
    // Capacity/cost signal: the scaling model downstream supply-chain modeling uses.
    costSignature: cfg.costSignature,
    scalingModel: cfg.scalingModel,
    connectomeDomains: cfg.connectomeDomains.slice(),
    anchors: cfg.anchors.slice(),
    nodes: nodes
  };
}

/**
 * Resolve node activations for a trade policy shock (unilateral-tariff /
 * bilateral-agreement / sanctions / export-control / origin-rule). Thin convenience
 * wrapper over resolvePolicyPath that accepts the BARE policy name (e.g.
 * 'unilateral-tariff') and maps it to the namespaced MACRO_POLICY_PATH key
 * ('trade_unilateral_tariff'). OPT-IN; default resolve() pipeline unchanged.
 * @param {String} policy - 'unilateral-tariff' | 'bilateral-agreement' | 'sanctions'
 *        | 'export-control' | 'origin-rule' (also accepts the full 'trade_*' key).
 * @param {Number} stress - raw stress value [0..1] for this policy shock.
 * @returns {Object} same shape as resolvePolicyPath.
 */
function resolveTradePolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var key = MACRO_POLICY_PATH[policy] ? policy
          : 'trade_' + String(policy).replace(/-/g, '_');
  return resolvePolicyPath(key, stress);
}

/**
 * Resolve node activations for an environmental policy shock (climate-policy /
 * environmental-regulation / conservation-policy / waste-policy). Thin convenience
 * wrapper over resolvePolicyPath that accepts a BARE policy name (e.g. 'climate' or
 * 'regulation') and maps it to the ENVIRONMENT_POLICY_PATH key in MACRO_POLICY_PATH.
 * OPT-IN; default resolve() pipeline unchanged. No scoring. Environment-specific —
 * the signal ORIGIN is environmental regulation (carbon tax, emissions cap, water-
 * quality tightening, habitat/waste mandate), never energy scarcity.
 * @param {String} policy - 'climate_policy' | 'environmental_regulation' |
 *        'conservation_policy' | 'waste_policy' (also accepts short aliases
 *        'climate' | 'regulation' | 'conservation' | 'waste').
 * @param {Number} stress - raw stress value [0..1] for this policy shock.
 * @returns {Object} same shape as resolvePolicyPath.
 */
function resolveEnvironmentPolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var aliases = {
    climate: 'climate_policy',
    regulation: 'environmental_regulation',
    environmental: 'environmental_regulation',
    conservation: 'conservation_policy',
    waste: 'waste_policy'
  };
  var key = MACRO_POLICY_PATH[policy] ? policy
          : (aliases[policy] || policy);
  return resolvePolicyPath(key, stress);
}

// ── GOVERNANCE SUB-CIRCUIT ROUTING (governance gap 3 — ADDITIVE, OPT-IN) ──
// Mirrors TRADE_SUBCIRCUIT_ROUTING and TECH_SUBCIRCUIT_ROUTING. Splits abstract
// 'governance' stress into four PURE policy-domain sub-circuits by policy authority /
// mechanism (NOT energy), so downstream policy-intervention modeling can pick the right
// curve: (1) executive authority (fiscal / budget / appropriation → spending →
// employment), (2) legislative rulemaking (statutes / regulations / enforcement →
// compliance cost), (3) electoral & democratic institutions (elections / representation
// → public trust / legitimacy), (4) institutional integrity (rule of law / anti-
// corruption / due process → contract enforcement). Each sub-circuit carries its own
// REAL governance nodes (from brain-node-domains.json) + policy indices. These are PURE
// governance identity splits — energy coupling is ZERO: utility regulation (state-PUC
// rate-setting, FERC wholesale rules) is governance COUPLING to the energy domain
// (authority/oversight), NEVER energy production; governance identity = policymaking
// authority and enforcement, not energy supply.
var GOVERNANCE_SUBCIRCUIT_ROUTING = {
  'executive-authority': {
    label: 'Executive authority circuit (fiscal / budget / appropriation)',
    pathway: ['dlPFC', 'STRI', 'vmPFC'],
    role: 'appropriation-authority → treasury-execution → policy-formation-and-disbursement',
    costSignature: 'step changes on appropriation / continuing-resolution shifts; multiplier propagates through spending → employment → consumption',
    scalingModel: 'fiscal_multiplier_x_budget_execution',
    // Governance is home; economy is the fiscal-multiplier coupling (spending → jobs).
    connectomeDomains: ['governance', 'economy'],
    triggers: ['appropriation_lapse', 'continuing_resolution', 'budget_sequestration', 'government_shutdown', 'debt_ceiling_impasse'],
    anchors: ['MMS', 'BAH', 'GDIT']
  },
  'legislative-rulemaking': {
    label: 'Legislative rulemaking circuit (statutes / regulations / enforcement)',
    pathway: ['BROCA', 'dACC', 'OFC'],
    role: 'statute-enactment → regulatory-promulgation → enforcement-and-judicial-review',
    costSignature: 'compliance-cost step changes on rulemaking velocity; enforcement backlog accrues on agency-capacity load',
    scalingModel: 'rulemaking_velocity_x_compliance_cost',
    connectomeDomains: ['governance'],
    triggers: ['rulemaking_surge', 'enforcement_action', 'regulatory_rollback', 'agency_guidance_shift', 'judicial_stay'],
    anchors: ['ACN', 'LDOS', 'CACI']
  },
  'electoral-institutions': {
    label: 'Electoral & democratic institutions circuit (elections / representation / legitimacy)',
    pathway: ['NAcc', 'ECN', 'TPJ'],
    role: 'electoral-administration → public-administration-continuity → representation-and-legitimacy',
    costSignature: 'legitimacy / public-trust step changes on contested elections, turnout shocks, or administration transitions',
    scalingModel: 'electoral_integrity_x_public_trust',
    connectomeDomains: ['governance'],
    triggers: ['contested_election', 'turnout_collapse', 'administration_transition', 'redistricting_shock', 'voter_access_change'],
    anchors: ['TYL', 'MMS']
  },
  'institutional-integrity': {
    label: 'Institutional integrity circuit (rule of law / anti-corruption / due process)',
    pathway: ['VTA', 'OFC', 'ECN'],
    role: 'anti-corruption-enforcement → judicial-review → administrative-due-process',
    costSignature: 'contract-enforcement / rule-of-law erosion accrues on corruption, vacancy, and audit-backlog load',
    scalingModel: 'rule_of_law_x_contract_enforcement',
    // Governance is home; finance is the contract-enforcement coupling (rule of law → capital).
    connectomeDomains: ['governance', 'finance'],
    triggers: ['corruption_finding', 'audit_backlog_surge', 'vacancy_crisis', 'due_process_erosion', 'oversight_failure'],
    anchors: ['BAH', 'CACI']
  }
};

// Reverse lookup: trigger source string → governance sub-circuit key (built once).
var GOVERNANCE_TRIGGER_TO_SUBCIRCUIT = {};
for (var _govsk in GOVERNANCE_SUBCIRCUIT_ROUTING) {
  if (!Object.prototype.hasOwnProperty.call(GOVERNANCE_SUBCIRCUIT_ROUTING, _govsk)) continue;
  var _govtrg = GOVERNANCE_SUBCIRCUIT_ROUTING[_govsk].triggers || [];
  for (var _govti = 0; _govti < _govtrg.length; _govti++) GOVERNANCE_TRIGGER_TO_SUBCIRCUIT[_govtrg[_govti]] = _govsk;
}

/**
 * Route a governance stress trigger to its sub-circuit (executive-authority /
 * legislative-rulemaking / electoral-institutions / institutional-integrity) and emit
 * the policy-performance / cost signature so downstream policy-intervention modeling can
 * pick the right curve. OPT-IN; default resolve() is unchanged. No scoring. Governance-
 * specific; never hijacks another domain's stress. Energy coupling is ZERO (utility
 * regulation is governance AUTHORITY, not energy production).
 * @param {String} stressTrigger - trigger source, e.g. 'appropriation_lapse',
 *        'rulemaking_surge', 'contested_election', 'corruption_finding'; OR a sub-circuit key.
 * @param {String} [domain] - originating domain (expected 'governance'); other domains
 *        return an inactive result (this gap is governance-specific).
 * @param {Object} [context] - optional { stress:Number } raw stress [0..1] for activation.
 * @returns {Object} { subCircuit, matched, label, pathway, role, costSignature,
 *          scalingModel, connectomeDomains, anchors, nodes }
 */
function resolveGovernanceSubCircuit(stressTrigger, domain, context) {
  var dom = domain || 'governance';
  var inactive = {
    subCircuit: null, matched: false, trigger: stressTrigger || null, domain: dom,
    label: '', pathway: [], role: '', costSignature: '', scalingModel: '',
    connectomeDomains: [], anchors: [], nodes: []
  };
  // This gap is governance-specific; never hijack another domain's stress.
  if (dom !== 'governance') return inactive;

  // Resolve which sub-circuit: accept a direct key or a named trigger source.
  var key = null;
  if (stressTrigger && GOVERNANCE_SUBCIRCUIT_ROUTING[stressTrigger]) {
    key = stressTrigger;
  } else if (stressTrigger && GOVERNANCE_TRIGGER_TO_SUBCIRCUIT[stressTrigger]) {
    key = GOVERNANCE_TRIGGER_TO_SUBCIRCUIT[stressTrigger];
  }
  if (!key) return inactive;

  var cfg = GOVERNANCE_SUBCIRCUIT_ROUTING[key];
  var s = (context && typeof context.stress === 'number') ? context.stress : 0;
  // Reuse the existing activation engine by synthesizing one stressed feed domain per
  // connectome domain on the sub-circuit (governance = home; economy/finance = the
  // fiscal-multiplier / contract-enforcement coupling targets).
  var synth = cfg.connectomeDomains.map(function(cd) { return { id: cd, stress: s, status: 'GOVERNANCE_SUBCIRCUIT' }; });
  var nodes = activateNodes(synth);

  return {
    subCircuit: key,
    matched: true,
    trigger: stressTrigger,
    domain: dom,
    label: cfg.label,
    pathway: cfg.pathway.slice(),
    role: cfg.role,
    costSignature: cfg.costSignature,
    scalingModel: cfg.scalingModel,
    connectomeDomains: cfg.connectomeDomains.slice(),
    anchors: cfg.anchors.slice(),
    nodes: nodes
  };
}

/**
 * Resolve node activations for a governance policy shock (executive-authority /
 * legislative-rulemaking / electoral-institutions / institutional-integrity). Thin
 * convenience wrapper over resolvePolicyPath that accepts a BARE policy name (e.g.
 * 'executive' or 'rulemaking') and maps it to the 'gov_*' MACRO_POLICY_PATH key.
 * OPT-IN; default resolve() pipeline unchanged. No scoring. Governance-specific — the
 * signal ORIGIN is policymaking authority & enforcement (budget, rulemaking, elections,
 * rule of law), never energy.
 * @param {String} policy - 'gov_executive_authority' | 'gov_legislative_rulemaking' |
 *        'gov_electoral_institutions' | 'gov_institutional_integrity' (also accepts short
 *        aliases 'executive' | 'rulemaking' | 'electoral' | 'integrity').
 * @param {Number} stress - raw stress value [0..1] for this policy shock.
 * @returns {Object} same shape as resolvePolicyPath.
 */
function resolveGovernancePolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var aliases = {
    executive: 'gov_executive_authority',
    fiscal: 'gov_executive_authority',
    rulemaking: 'gov_legislative_rulemaking',
    legislative: 'gov_legislative_rulemaking',
    regulatory: 'gov_legislative_rulemaking',
    electoral: 'gov_electoral_institutions',
    elections: 'gov_electoral_institutions',
    integrity: 'gov_institutional_integrity',
    institutional: 'gov_institutional_integrity'
  };
  var key = MACRO_POLICY_PATH[policy] ? policy
          : (aliases[policy] || policy);
  return resolvePolicyPath(key, stress);
}

// Healthcare policy-path resolution (medicine gap 4) — opt-in. Routes a healthcare-
// regulation shock (CMS payment rule / FDA enforcement / Medicaid expansion / health-IT
// certification mandate) to the correct medicine nodes via MACRO_POLICY_PATH entries.
// Signal origin = healthcare-regulation authority (CMS, FDA, HHS, ONC), never energy.
// Parallel to resolveGovernancePolicyPath / resolveTradePolicyPath / resolveEnvironmentPolicyPath.
var HEALTHCARE_POLICY_TRIGGER_TO_SUBCIRCUIT = {
  payment:          'cms_payment_rule_change',
  cms:              'cms_payment_rule_change',
  reimbursement:    'cms_payment_rule_change',
  medicare:         'cms_payment_rule_change',
  fda:              'fda_enforcement_action',
  enforcement:      'fda_enforcement_action',
  recall:           'fda_enforcement_action',
  approval:         'fda_enforcement_action',
  medicaid:         'medicaid_expansion',
  coverage:         'medicaid_expansion',
  expansion:        'medicaid_expansion',
  health_it:        'health_it_certification_mandate',
  interoperability: 'health_it_certification_mandate',
  certification:    'health_it_certification_mandate',
  onc:              'health_it_certification_mandate'
};
function resolveHealthcarePolicyPath(policy, stress) {
  if (!policy) return resolvePolicyPath(policy, stress);
  var key = MACRO_POLICY_PATH[policy] ? policy
          : (HEALTHCARE_POLICY_TRIGGER_TO_SUBCIRCUIT[policy] || policy);
  return resolvePolicyPath(key, stress);
}

// ═══════════════════════════════════════════════════
// 7. KERNEL ADAPTER RELAY (DISABLED)
// ═══════════════════════════════════════════════════
// Formerly routed opportunity stress through:
//   connectome-kernel-adapter.js → /api/kernel-experiment → kernel-output-interpreter.js
// That public arbitrary-input scoring endpoint has been removed (410 Gone).
// connectome-kernel-adapter.callKernel() now returns an error pointing
// callers to POST /api/helix-report/score (CIK + safe context only).
// This module never contained kernel math.

/**
 * (DISABLED) Run kernel for an opportunity via the adapter chain.
 * The adapter no longer reaches a kernel. Callers receive an error.
 * Requires LIMENKernelAdapter and LIMENKernelInterpreter to be loaded.
 * @param {Object} feedSnapshot - { domainId: { stress, status } }
 * @param {Array} nodeActivations - from activateNodes()
 * @param {Array} oppDomains - opportunity domain IDs
 * @param {Function} callback - (kernelAnnotation)
 */
function runKernelForOpportunity(feedSnapshot, nodeActivations, oppDomains, callback) {
  if (!window.LIMENKernelAdapter || !window.LIMENKernelInterpreter) {
    callback({ available: false, reason: 'Adapter/interpreter not loaded', experiment: true });
    return;
  }

  var stressData = {
    domains: feedSnapshot,
    nodeActivations: nodeActivations,
    oppDomains: oppDomains
  };

  window.LIMENKernelAdapter.run(stressData, function(err, result) {
    if (err || !result.kernelOutput) {
      callback({
        available: false,
        reason: err || 'Kernel returned no output',
        proxyMapping: result ? result.proxyMapping : null,
        experiment: true
      });
      return;
    }
    var interpreted = window.LIMENKernelInterpreter.interpret(result.kernelOutput, result.proxyMapping);
    callback(interpreted);
  });
}

// ═══════════════════════════════════════════════════
// 8. DOMAIN DETAIL LOADER
// ═══════════════════════════════════════════════════

/**
 * Load full domain detail (activations, issues, treatments) for specific nodes.
 * @param {Array} nodeIds - array of brain node IDs
 * @param {Array} connectomeDomains - connectome domain IDs to check
 * @param {Function} callback - receives { nodeId: { activations, treatments, diagnosticTriggers } }
 */
function loadNodeDetails(nodeIds, connectomeDomains, callback) {
  if (!connectomeDomains || connectomeDomains.length === 0) { callback({}); return; }

  var pending = connectomeDomains.length;
  var domainData = {};

  function handleLoaded(cd, data) {
    domainData[cd] = data;
    if (--pending > 0) return;

    var result = {};
    for (var ni = 0; ni < nodeIds.length; ni++) {
      var nid = nodeIds[ni];
      result[nid] = { activations: [], treatments: [], diagnosticTriggers: [], groups: [] };
      for (var cdKey in domainData) {
        var acts = domainData[cdKey].activations || [];
        for (var ai = 0; ai < acts.length; ai++) {
          if (acts[ai].brainNodeId === nid) {
            result[nid].activations.push({
              domain: cdKey,
              domainTitle: domainData[cdKey].title,
              label: acts[ai].domainLabel,
              description: acts[ai].domainDescription || '',
              function: acts[ai].domainFunction || '',
              group: acts[ai].group,
              phase: acts[ai].phase,
              weight: acts[ai].weight
            });
            if (acts[ai].diagnosticTriggers) {
              for (var dti = 0; dti < acts[ai].diagnosticTriggers.length; dti++) {
                if (result[nid].diagnosticTriggers.indexOf(acts[ai].diagnosticTriggers[dti]) === -1) {
                  result[nid].diagnosticTriggers.push(acts[ai].diagnosticTriggers[dti]);
                }
              }
            }
            if (acts[ai].treatments) {
              for (var tri = 0; tri < acts[ai].treatments.length; tri++) {
                result[nid].treatments.push({
                  domain: cdKey,
                  label: acts[ai].treatments[tri].label,
                  type: acts[ai].treatments[tri].type,
                  evidence: acts[ai].treatments[tri].evidence,
                  description: (acts[ai].treatments[tri].description || '').substring(0, 80)
                });
              }
            }
            if (acts[ai].group && result[nid].groups.indexOf(acts[ai].group) === -1) {
              result[nid].groups.push(acts[ai].group);
            }
          }
        }
      }
    }
    callback(result);
  }

  for (var i = 0; i < connectomeDomains.length; i++) {
    (function(cd) {
      loadDomainDetail(cd, function(data) { handleLoaded(cd, data); });
    })(connectomeDomains[i]);
  }
}

// ═══════════════════════════════════════════════════
// 9. PUBLIC API
// ═══════════════════════════════════════════════════

window.LIMENConnectomeResolver = {
  // Core pipeline
  loadDirectory: loadNodeDirectory,
  resolve: resolve,
  isReady: function() { return _directoryLoaded; },

  // Individual components (mapping/enrichment only)
  activateNodes: activateNodes,
  enrichOpportunity: enrichOpportunity,

  // Detail loading
  loadNodeDetails: loadNodeDetails,

  // Kernel adapter relay — EXPERIMENTAL ANNOTATION ONLY
  // (DISABLED) Formerly called Thing 2 v4 patent kernel via adapter chain; adapter is now neutralized
  runKernelForOpportunity: runKernelForOpportunity,

  // Mappings
  FEED_TO_CONNECTOME: FEED_TO_CONNECTOME,
  CONNECTOME_TO_FEED: CONNECTOME_TO_FEED,
  STRESS_ACTIVATION_THRESHOLD: STRESS_ACTIVATION_THRESHOLD,

  // Macro indicator bindings (economy gap 1) — REAL FRED series + market proxies
  MACRO_INDICATOR_BINDING: MACRO_INDICATOR_BINDING,
  NODE_TO_MACRO_INDICATOR: NODE_TO_MACRO_INDICATOR,
  getMacroIndicatorsForNode: function(nodeId) { return NODE_TO_MACRO_INDICATOR[nodeId] || []; },

  // Technology company ticker bindings (technology gap 2) — OPT-IN, parallel to
  // the macro registry; consumed only for explicit tech-company-level drill.
  TECH_COMPANY_BINDING: TECH_COMPANY_BINDING,
  NODE_TO_TECH_COMPANY: NODE_TO_TECH_COMPANY,
  getTechCompaniesForNode: function(nodeId) { return NODE_TO_TECH_COMPANY[nodeId] || []; },

  // Intelligence-sector company ticker bindings (intelligence gap 2) — OPT-IN,
  // parallel to the tech registry; consumed only for explicit intel-company drill.
  // REAL intelligence-sector tickers (PLTR/BAH/LDOS/CACI/SAIC/KBR/VRNT/NICE/VRSK).
  INTELLIGENCE_COMPANY_BINDING: INTELLIGENCE_COMPANY_BINDING,
  NODE_TO_INTEL_COMPANY: NODE_TO_INTEL_COMPANY,
  getIntelCompaniesForNode: function(nodeId) { return NODE_TO_INTEL_COMPANY[nodeId] || []; },

  // Intelligence-sector indicator bindings (intelligence gap 3) — OPT-IN, parallel
  // to the macro registry; threat-level / collection-capacity / collection-perf
  // tradecraft signals (zero energy content) routed to dedicated intelligence nodes.
  INTELLIGENCE_INDICATOR_BINDING: INTELLIGENCE_INDICATOR_BINDING,
  NODE_TO_INTEL_INDICATOR: NODE_TO_INTEL_INDICATOR,
  getIntelIndicatorsForNode: function(nodeId) { return NODE_TO_INTEL_INDICATOR[nodeId] || []; },

  // Trade-sector (supply chain) company ticker bindings (trade gap) — OPT-IN, parallel
  // to the tech/intel registries; consumed only for explicit trade-company drill.
  // REAL trade/logistics tickers (FDX/UPS/EXPD/CHRW/ZIM/MATX/AMKBY/XPO/ODFL/GXO/DSDVY).
  TRADE_COMPANY_BINDING: TRADE_COMPANY_BINDING,
  NODE_TO_TRADE_COMPANY: NODE_TO_TRADE_COMPANY,
  getTradeCompaniesForNode: function(nodeId) { return NODE_TO_TRADE_COMPANY[nodeId] || []; },

  // Industrial-sector (manufacturing & capital goods) company ticker bindings (industry
  // gap) — OPT-IN, parallel to the tech/intel/trade registries; consumed only for an
  // explicit industrial-company drill. Energy is a downstream COUPLING (factory base-
  // load / process-heat falls with industrial output), never the sector identity.
  // REAL industrial / capital-goods tickers (CAT/DE/GE/GEV/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV).
  INDUSTRIAL_COMPANY_BINDING: INDUSTRIAL_COMPANY_BINDING,
  NODE_TO_INDUSTRIAL_COMPANY: NODE_TO_INDUSTRIAL_COMPANY,
  getIndustrialCompaniesForNode: function(nodeId) { return NODE_TO_INDUSTRIAL_COMPANY[nodeId] || []; },

  // Environment-sector (waste / water / emissions / climate-infra) company ticker bindings
  // (environment gap 1) — OPT-IN, parallel to the tech/intel/trade/industrial registries;
  // consumed only for an explicit environment-company drill. Energy is a downstream
  // SECOND-ORDER coupling (treatment/control OpEx → facility power/cooling), never the
  // sector identity. REAL environmental-sector tickers (WM/RSG/WCN/CWST/AWK/WTRG/XYL/ECL/
  // LIN/APD/DAR/AY).
  ENVIRONMENT_SECTOR_COMPANY_BINDING: ENVIRONMENT_SECTOR_COMPANY_BINDING,
  NODE_TO_ENVIRONMENT_COMPANY: NODE_TO_ENVIRONMENT_COMPANY,
  getEnvironmentCompaniesForNode: function(nodeId) { return NODE_TO_ENVIRONMENT_COMPANY[nodeId] || []; },

  // Environment-sector indicator bindings (environment gap 2) — OPT-IN, parallel to the
  // macro registry; air-quality / water-quality / carbon-price / waste-volume / forest-
  // carbon / biodiversity environmental signals (zero energy content) routed to dedicated
  // environment nodes.
  ENVIRONMENT_INDICATOR_BINDING: ENVIRONMENT_INDICATOR_BINDING,
  NODE_TO_ENVIRONMENT_INDICATOR: NODE_TO_ENVIRONMENT_INDICATOR,
  getEnvironmentIndicatorsForNode: function(nodeId) { return NODE_TO_ENVIRONMENT_INDICATOR[nodeId] || []; },

  // Trade-sector indicator bindings (trade gap) — OPT-IN, parallel to the macro
  // registry; trade-balance / commodity-flow / shipping-index / tariff-customs /
  // port-congestion commerce signals (zero energy content) routed to trade nodes.
  TRADE_INDICATOR_BINDING: TRADE_INDICATOR_BINDING,
  NODE_TO_TRADE_INDICATOR: NODE_TO_TRADE_INDICATOR,
  getTradeIndicatorsForNode: function(nodeId) { return NODE_TO_TRADE_INDICATOR[nodeId] || []; },

  // Governance-sector (govtech / public-sector services) company ticker bindings
  // (governance gap 1) — OPT-IN, parallel to the tech/intel/trade/industrial/environment
  // registries; consumed only for an explicit governance-company drill. Governance binds
  // mostly to INSTITUTIONS & INDICATORS; where service-delivery capacity needs a vendor we
  // use REAL govtech / public-sector contractors (TYL/MMS/MANT/GDIT/BAH/ACN/LDOS/CACI).
  // Energy is ZERO: govtech IT-modernization backlog (data-center / secure-facility cooling)
  // may couple to compute load downstream, but the signal ORIGIN is governance administration.
  GOVERNANCE_COMPANY_BINDING: GOVERNANCE_COMPANY_BINDING,
  NODE_TO_GOVERNANCE_COMPANY: NODE_TO_GOVERNANCE_COMPANY,
  getGovernanceSectorCompaniesForNode: function(nodeId) { return NODE_TO_GOVERNANCE_COMPANY[nodeId] || []; },

  // Governance-sector indicator bindings (governance gap 2) — OPT-IN, parallel to the
  // macro registry; REAL policy-performance indices (World Bank WGI, V-Dem, OECD, GAO, CBO,
  // Federal Register, CFPB, OMB, OPM, GSA) routed to dedicated governance nodes. Governance
  // is measured by POLICY PERFORMANCE, never energy: FERC / state-PUC utility regulation is
  // governance AUTHORITY (policy domain), kept DISTINCT from energy production/consumption.
  GOVERNANCE_INDICATOR_BINDING: GOVERNANCE_INDICATOR_BINDING,
  NODE_TO_GOVERNANCE_INDICATOR: NODE_TO_GOVERNANCE_INDICATOR,
  getGovernanceIndicatorsForNode: function(nodeId) { return NODE_TO_GOVERNANCE_INDICATOR[nodeId] || []; },

  // Agriculture-sector company bindings (agriculture gap 1) — OPT-IN, parallel to the
  // tech/intel/trade/industrial/environment/governance company registries; REAL ag /
  // agribusiness tickers (ADM/BG/INGR grain+processing, CTVA/FMC seeds+crop-protection,
  // DE/AGCO machinery, NTR/MOS/CF fertilizers, TSN/CAG protein+food) routed to dedicated
  // 'p2' agriculture nodes. Energy is ZERO ag identity: Haber-Bosch (NTR/MOS/CF) &
  // tractor fuel (DE/AGCO) couple to energy ONLY as company-ticker CONSEQUENCE, never an
  // ag-to-energy edge; ag nodes carry zero energy-domain content.
  AGRICULTURE_COMPANY_BINDING: AGRICULTURE_COMPANY_BINDING,
  NODE_TO_AGRICULTURE_COMPANY: NODE_TO_AGRICULTURE_COMPANY,
  getAgricultureCompaniesForNode: function(nodeId) { return NODE_TO_AGRICULTURE_COMPANY[nodeId] || []; },

  // Agriculture-sector indicator bindings (agriculture gap 2) — OPT-IN, parallel to the
  // macro registry; REAL ag signals (USDA WASDE corn/soy/wheat, CBOT/CME corn/soybean/
  // wheat & cattle/hog futures, USDA PPI farm products, ammonia/urea input-cost indices,
  // USDA farm debt-to-asset & farmland value) routed to dedicated 'p2' agriculture nodes.
  // Fertilizer/fuel appear ONLY as a farm INPUT-COST line, never energy output; energy is
  // a downstream CONSEQUENCE (input-cost pass-through to livestock-feed / protein markets).
  AGRICULTURE_INDICATOR_BINDING: AGRICULTURE_INDICATOR_BINDING,
  NODE_TO_AGRICULTURE_INDICATOR: NODE_TO_AGRICULTURE_INDICATOR,
  getAgricultureIndicatorsForNode: function(nodeId) { return NODE_TO_AGRICULTURE_INDICATOR[nodeId] || []; },

  // Communication-sector (telecom / media / broadcasting / platforms) company ticker
  // bindings (communication gap 1) — OPT-IN, parallel to the tech/intel/trade/industrial/
  // environment/governance/agriculture company registries; REAL telecom/media/platform
  // tickers (VZ/T/TMUS wireless, CMCSA/CHTR cable-broadband, CSCO/ANET network,
  // AMT/CCI/SBAC tower-infrastructure, NWSA/NYT editorial/news, META/GOOGL platform
  // distribution) routed to dedicated communication nodes (CC/BROCA/A1/FEF/FPN/V1/dlPFC/
  // NAcc). Energy is ZERO communication identity: data-center cooling (platform scaling)
  // may couple downstream, but signal origin is communication-network capacity & distribution.
  COMMUNICATION_COMPANY_BINDING: COMMUNICATION_COMPANY_BINDING,
  NODE_TO_COMMUNICATION_COMPANY: NODE_TO_COMMUNICATION_COMPANY,
  getCommCompaniesForNode: function(nodeId) { return NODE_TO_COMMUNICATION_COMPANY[nodeId] || []; },

  // Communication-sector indicator bindings (communication gap 2) — OPT-IN, parallel to the
  // macro registry; REAL communication-infrastructure signals (FCC broadband speed & rural
  // coverage, spectrum-auction revenue & available MHz, Nielsen/Arbitron broadcast
  // viewership & reach, BLS journalism/media-production employment, platform DAU &
  // engagement) routed to dedicated communication nodes. These measure COMMUNICATION
  // identity (network capacity, coverage, audience reach, editorial workforce, platform
  // engagement), never energy: data-center SLA/uptime is a governance/infrastructure
  // coupling, and a platform power-consumption spike is a downstream consequence, not origin.
  COMMUNICATION_INDICATOR_BINDING: COMMUNICATION_INDICATOR_BINDING,
  NODE_TO_COMMUNICATION_INDICATOR: NODE_TO_COMMUNICATION_INDICATOR,
  getCommIndicatorsForNode: function(nodeId) { return NODE_TO_COMMUNICATION_INDICATOR[nodeId] || []; },

  // Healthcare-sector (medicine / health) company ticker bindings (medicine gap 1) — OPT-IN,
  // parallel to the tech/intel/trade/industrial/environment/governance/agriculture/
  // communication company registries; REAL healthcare tickers (JNJ/PFE/MRK/ABBV/LLY/AMGN/GILD
  // pharma, ABT/MDT/SYK/ISRG devices, GH/EXAS/DXCM diagnostics, HCA/UHS/THC hospitals,
  // UNH/HUM/CNC/CVS insurance, TDOC/AMWL/HIMS/VEEV telehealth/health-IT) routed to medicine
  // nodes (HYPO/STRI/CARD/M1/LGN/V1/PULV/mPFC/THAL/VP/PCC). Runtime domain key = 'health'.
  // Energy is ZERO healthcare identity: facility power SLA / OR-HVAC is a second-order
  // facility-operations coupling, not a medicine signal; energy-coupling utilities excluded.
  HEALTHCARE_COMPANY_BINDING: HEALTHCARE_COMPANY_BINDING,
  NODE_TO_HEALTHCARE_COMPANY: NODE_TO_HEALTHCARE_COMPANY,
  getHealthcareCompaniesForNode: function(nodeId) { return NODE_TO_HEALTHCARE_COMPANY[nodeId] || []; },

  // Healthcare-sector indicator bindings (medicine gap 2) — OPT-IN, parallel to the macro
  // registry; REAL healthcare-operations signals (FDA adverse events / recalls / approval
  // rate, CMS hospital occupancy / bed availability, NAIC medical-loss ratio / claims-approval,
  // diagnostic volume / turnaround, clinical-trial enrollment, surgical-capacity utilization)
  // routed to medicine nodes. These measure MEDICINE identity (clinical operations, treatment
  // capacity, drug-safety, claims, diagnostic throughput), never energy — facility power
  // SLA/uptime is a facility-operations coupling, not a medicine signal.
  HEALTHCARE_INDICATOR_BINDING: HEALTHCARE_INDICATOR_BINDING,
  NODE_TO_HEALTHCARE_INDICATOR: NODE_TO_HEALTHCARE_INDICATOR,
  getHealthcareIndicatorsForNode: function(nodeId) { return NODE_TO_HEALTHCARE_INDICATOR[nodeId] || []; },

  // Agriculture circuit segregation (agriculture gap 3) — opt-in. Routes an agriculture
  // stress trigger to crop-production / livestock-production / commodity-trading /
  // farm-finance / input-supply, each a SEPARATE 'p2' node pathway with its real ticker
  // anchors + energy-footprint note. Only mechanization (DE/AGCO) and fertilizer synthesis
  // (NTR/MOS/CF) couple to energy, as a downstream CONSEQUENCE, never an ag-to-energy edge.
  AGRICULTURE_CIRCUITS: AGRICULTURE_CIRCUITS,
  AGRICULTURE_TRIGGER_TO_CIRCUIT: AGRICULTURE_TRIGGER_TO_CIRCUIT,
  resolveAgricultureCircuit: resolveAgricultureCircuit,
  getAgricultureCircuitForTrigger: function(trigger) { return AGRICULTURE_TRIGGER_TO_CIRCUIT[trigger] || null; },

  // Education-sector (schools / universities / edtech / skills / courseware) company ticker
  // bindings (education gap 1) — OPT-IN, parallel to the tech/intel/trade/industrial/
  // environment/governance/agriculture company registries; REAL education tickers (CHGG/COUR/
  // DUOL/TWOU edtech, LRN K-12 virtual schools, PSO courseware, ATGE/LOPE/STRA/LAUR higher ed,
  // UTI vocational/skills) routed to dedicated 'education' nodes (AI/V1/NAcc/THAL/mPFC/dlPFC/
  // STRI/VP/vlPFC/BLA). Energy is ZERO education identity: edtech platform scaling → data-center
  // load is a facility-operations coupling (infrastructure domain), never an education signal.
  EDUCATION_COMPANY_BINDING: EDUCATION_COMPANY_BINDING,
  NODE_TO_EDUCATION_COMPANY: NODE_TO_EDUCATION_COMPANY,
  getEducationCompaniesForNode: function(nodeId) { return NODE_TO_EDUCATION_COMPANY[nodeId] || []; },

  // Education-sector indicator bindings (education gap 2) — OPT-IN, parallel to the macro
  // registry; REAL education signals (NAEP math/reading scores, NCES graduation/enrollment/
  // literacy, student-loan delinquency/balance, edtech enrollment/engagement, admissions yield,
  // teacher-vacancy index) routed to dedicated 'education' nodes. These measure EDUCATION
  // identity (learning outcomes, access/reach, credentialing output, human-capital supply,
  // education-system solvency), never energy — campus power/cooling is an infrastructure
  // consequence of facility occupancy, not an education-sector signal.
  EDUCATION_INDICATOR_BINDING: EDUCATION_INDICATOR_BINDING,
  NODE_TO_EDUCATION_INDICATOR: NODE_TO_EDUCATION_INDICATOR,
  getEducationIndicatorsForNode: function(nodeId) { return NODE_TO_EDUCATION_INDICATOR[nodeId] || []; },

  // Education circuit segregation (education gap 3) — opt-in. Routes an education stress
  // trigger to K-12-schools / higher-ed / edtech-platforms / workforce-skills, each a SEPARATE
  // 'education' node pathway with its real ticker anchors + energySignature (ZERO). Education
  // never couples to energy as a signal origin — only infrastructure/population/economy couple,
  // and only as downstream consequences, never an education-to-energy edge.
  EDUCATION_CIRCUITS: EDUCATION_CIRCUITS,
  EDUCATION_TRIGGER_TO_CIRCUIT: EDUCATION_TRIGGER_TO_CIRCUIT,
  resolveEducationCircuit: resolveEducationCircuit,
  getEducationCircuitForTrigger: function(trigger) { return EDUCATION_TRIGGER_TO_CIRCUIT[trigger] || null; },

  // Education policy-path resolution (education gap 4) — opt-in. Routes an education-regulation
  // policy shock (K-12 funding / higher-ed regulation / student debt) to the correct education
  // nodes via MACRO_POLICY_PATH 'education_*' entries. Signal origin = education-regulation
  // authority (state K-12 boards, accreditors, Federal Student Aid), never energy.
  resolveEducationPolicyPath: resolveEducationPolicyPath,

  // Science-sector (research / R&D / lab-science / instrumentation) company ticker bindings
  // (science gap 1) — OPT-IN, parallel to the tech/intel/trade/industrial/environment/governance/
  // agriculture/education company registries; REAL research-sector tickers (TMO/DHR/A/MTD/WAT
  // instruments & analytical labs, ILMN genomics, BIO/RVTY/BRKR life-science R&D & detection,
  // IQV/ICLR research services) routed to dedicated 'science' nodes (M1/FPN/OFC/ECN/HYPO/HAB/AI/
  // MFC/VP/dlPFC). DUAL-KEY: 'science' is the portal/connectome-domain key (matches brain-node-
  // domains.json); runtime/snapshot key is 'research'. Energy is ZERO science identity: R&D
  // facility power / lab electricity / HPC compute couple DOWNSTREAM only (route via infrastructure/
  // technology), never a science signal origin; science nodes carry zero energy-domain content.
  // DISTINCT from technology (applied product dev coupling), medicine (clinical research coupling)
  // and education (academic teaching coupling).
  SCIENCE_COMPANY_BINDING: SCIENCE_COMPANY_BINDING,
  NODE_TO_SCIENCE_COMPANY: NODE_TO_SCIENCE_COMPANY,
  getScienceCompaniesForNode: function(nodeId) { return NODE_TO_SCIENCE_COMPANY[nodeId] || []; },

  // Science-sector indicator bindings (science gap 2) — OPT-IN, parallel to the macro registry;
  // REAL research-performance signals (NSF/NIH grant volume & approval, R&D budget, arXiv/Nature
  // publication velocity, OpenAlex citation impact, peer-review turnaround, retraction rate,
  // lab-equipment utilization, research-staff/PhD enrollment, research patents / spinout formation)
  // routed to dedicated 'science' nodes. These measure SCIENCE identity (research outputs, capacity,
  // discovery, funding), never energy — lab power is a facility-operations consequence of research
  // activity, never a research-signal origin. Real authorities only (NSF, NIH, arXiv, Nature,
  // OpenAlex, USPTO, NASA).
  SCIENCE_INDICATOR_BINDING: SCIENCE_INDICATOR_BINDING,
  NODE_TO_SCIENCE_INDICATOR: NODE_TO_SCIENCE_INDICATOR,
  getScienceIndicatorsForNode: function(nodeId) { return NODE_TO_SCIENCE_INDICATOR[nodeId] || []; },

  // Science circuit segregation (science gap 5) — opt-in. Routes a science (research) stress
  // trigger to basic-research / applied-research / research-infrastructure / research-funding, each
  // a SEPARATE 'science' node pathway with its real ticker anchors + energySignature (ZERO). Science
  // never couples to energy as a signal origin — only governance/technology/infrastructure/finance
  // couple, and only as downstream consequences, never a science-to-energy edge.
  SCIENCE_CIRCUITS: SCIENCE_CIRCUITS,
  SCIENCE_TRIGGER_TO_CIRCUIT: SCIENCE_TRIGGER_TO_CIRCUIT,
  resolveScienceCircuit: resolveScienceCircuit,
  getScienceCircuitForTrigger: function(trigger) { return SCIENCE_TRIGGER_TO_CIRCUIT[trigger] || null; },

  // Science policy-path resolution (science gap 4/6) — opt-in. Routes a research-policy shock
  // (research funding / research regulation / science-education mandate) to the correct science
  // nodes via MACRO_POLICY_PATH 'research_*' / 'science_education_mandate' entries. Signal origin =
  // research-funding & research-regulation authority (NSF, NIH, accreditors, journal editorial
  // boards), never energy (energy regulation = FERC/PUC governance, kept DISTINCT).
  resolveSciencePolicyPath: resolveSciencePolicyPath,

  // Population-sector indicator bindings (population gap 1) — OPT-IN, parallel to the macro
  // registry; REAL demographic signals (Census ACS age/sex/race + density + median age + Gini,
  // UN World Population Prospects life-expectancy/fertility/migration/old-age-dependency,
  // CDC/NCHS life-expectancy/fertility/mortality-by-age, BLS CPS labor-force-participation &
  // unemployment-by-age, Census Components-of-Change net migration) routed to dedicated
  // 'population' nodes (CARD/OXY/VTA/STN/vlPFC/HPA/HIPP/mPFC/VEST/CeA/dlPFC/AI/M1/S2/OFC/TPJ/
  // ECN/SEPT/AG). These measure POPULATION identity (demographics, migration, urbanization,
  // fertility/mortality, aging, labor-SUPPLY, household formation, social structure), never
  // energy — settlement capex & aging-care facility load are downstream couplings, not signals.
  // Population is DISTINCT from economy (labor MARKET is a coupling), medicine (mortality/health
  // is a coupling), education (enrollment is a coupling) and governance (policy is a coupling).
  POPULATION_INDICATOR_BINDING: POPULATION_INDICATOR_BINDING,
  NODE_TO_POPULATION_INDICATOR: NODE_TO_POPULATION_INDICATOR,
  getPopulationIndicatorsForNode: function(nodeId) { return NODE_TO_POPULATION_INDICATOR[nodeId] || []; },

  // Population-sector (demographic-exposed) company ticker bindings (population gap 3) — OPT-IN,
  // parallel to the other sector company registries; population binds mostly to INDICATORS, but
  // where a demographic-exposure surface needs a proxy we use REAL demographic-exposed entities:
  // senior-living REITs for the AGING surface (WELL/VTR/LTC/NHI/BSR), housing/migration proxies
  // for the SETTLEMENT surface (ZG/RDFN), demographic-data providers for the DATA-QUALITY surface
  // (EFX/CSGP), routed to dedicated population nodes (vlPFC/HPA/mPFC/HIPP/SEPT/VEST/dlPFC/ECN/AI).
  // Energy is a downstream COUPLING (senior-living always-on per-bed HVAC baseline, idled
  // construction fleets on a settlement freeze), never the identity; population nodes carry zero
  // energy content. DISTINCT from economy (housing-PRICE aggregate is a coupling), medicine
  // (clinical care is a coupling) and construction (capital goods is a coupling).
  POPULATION_COMPANY_BINDING: POPULATION_COMPANY_BINDING,
  NODE_TO_POPULATION_COMPANY: NODE_TO_POPULATION_COMPANY,
  getPopulationCompaniesForNode: function(nodeId) { return NODE_TO_POPULATION_COMPANY[nodeId] || []; },

  // Population policy-path resolution (population gap 2) — opt-in. Routes a demographic-policy
  // shock (immigration-reform / fertility-incentive / aging-care mandate) to the correct
  // population nodes via MACRO_POLICY_PATH 'pop_*' entries. Signal origin = demographic-policy
  // authority (DHS/Census settlement rules, IRS/Census fertility incentives, CMS/SSA aging-care
  // mandates), never energy. Population kept DISTINCT from labor-market/medicine/education/
  // governance (those are couplings the policy mechanism may cross, never population content).
  resolvePopulationPolicyPath: resolvePopulationPolicyPath,

  // Fiscal vs monetary policy transmission (economy gap 2) — opt-in
  MACRO_POLICY_PATH: MACRO_POLICY_PATH,
  resolvePolicyPath: resolvePolicyPath,

  // Technology sub-circuit segregation (technology gap) — opt-in. Routes a tech
  // stress trigger to AI / cybersecurity / chip-supply, each with its own energy
  // signature + scaling model so grid/energy-demand modeling picks the right curve.
  TECH_SUBCIRCUIT_ROUTING: TECH_SUBCIRCUIT_ROUTING,
  TECH_TRIGGER_TO_SUBCIRCUIT: TECH_TRIGGER_TO_SUBCIRCUIT,
  resolveTechSubCircuit: resolveTechSubCircuit,
  getTechSubCircuitForTrigger: function(trigger) { return TECH_TRIGGER_TO_SUBCIRCUIT[trigger] || null; },

  // Trade sub-circuit segregation (trade gap) — opt-in. Routes a trade stress
  // trigger to container-maritime / trucking-drayage / air-cargo / customs-compliance,
  // each with its own capacity/cost signature + scaling model. Trade identity is
  // commerce/logistics; fuel coupling is downstream, never the origin.
  TRADE_SUBCIRCUIT_ROUTING: TRADE_SUBCIRCUIT_ROUTING,
  TRADE_TRIGGER_TO_SUBCIRCUIT: TRADE_TRIGGER_TO_SUBCIRCUIT,
  resolveTradeSubCircuit: resolveTradeSubCircuit,
  getTradeSubCircuitForTrigger: function(trigger) { return TRADE_TRIGGER_TO_SUBCIRCUIT[trigger] || null; },

  // Trade policy-path resolution (trade gap) — opt-in. Routes a commerce-policy
  // shock (unilateral-tariff / bilateral-agreement / sanctions / export-control /
  // origin-rule) to the correct trade nodes via MACRO_POLICY_PATH 'trade_*' entries.
  resolveTradePolicyPath: resolveTradePolicyPath,

  // Environment policy-path resolution (environment gap 3) — opt-in. Routes an
  // environmental-regulation shock (climate-policy / environmental-regulation /
  // conservation-policy / waste-policy) to the correct environment nodes + governance
  // via MACRO_POLICY_PATH entries. Signal origin = environmental regulation, never energy.
  resolveEnvironmentPolicyPath: resolveEnvironmentPolicyPath,

  // Governance sub-circuit segregation (governance gap 3) — opt-in. Routes a governance
  // stress trigger to executive-authority / legislative-rulemaking / electoral-institutions
  // / institutional-integrity, each with its own policy-performance / cost signature +
  // scaling model. Governance identity is policymaking authority & enforcement; utility
  // regulation is a governance COUPLING to energy (authority), never energy production.
  GOVERNANCE_SUBCIRCUIT_ROUTING: GOVERNANCE_SUBCIRCUIT_ROUTING,
  GOVERNANCE_TRIGGER_TO_SUBCIRCUIT: GOVERNANCE_TRIGGER_TO_SUBCIRCUIT,
  resolveGovernanceSubCircuit: resolveGovernanceSubCircuit,
  getGovernanceSubCircuitForTrigger: function(trigger) { return GOVERNANCE_TRIGGER_TO_SUBCIRCUIT[trigger] || null; },

  // Governance policy-path resolution (governance gap 3) — opt-in. Routes a governance
  // policy shock (executive-authority / legislative-rulemaking / electoral-institutions /
  // institutional-integrity) to the correct governance nodes via MACRO_POLICY_PATH 'gov_*'
  // entries. Signal origin = policymaking authority & enforcement, never energy.
  resolveGovernancePolicyPath: resolveGovernancePolicyPath,

  // Healthcare policy-path resolution (medicine gap 4) — opt-in. Routes a healthcare-
  // regulation policy shock (CMS payment rule / FDA enforcement / Medicaid expansion /
  // health-IT certification mandate) to the correct medicine nodes via MACRO_POLICY_PATH
  // entries. Signal origin = healthcare-regulation authority (CMS, FDA, HHS, ONC), never energy.
  HEALTHCARE_POLICY_TRIGGER_TO_SUBCIRCUIT: HEALTHCARE_POLICY_TRIGGER_TO_SUBCIRCUIT,
  resolveHealthcarePolicyPath: resolveHealthcarePolicyPath,
  getHealthcarePolicySubCircuitForTrigger: function(trigger) { return HEALTHCARE_POLICY_TRIGGER_TO_SUBCIRCUIT[trigger] || null; },

  // Last resolve state
  getLastResolve: function() { return _lastResolve; },

  // Utility: get connectome domains for a feed domain
  getConnectomeDomains: function(feedDomainId) {
    return FEED_TO_CONNECTOME[feedDomainId] || [];
  },

  // Utility: format node activation summary for display
  formatNodeSummary: function(enrichedOpp) {
    var c = enrichedOpp.connectome;
    if (!c || c.nodeCount === 0) return 'No connectome nodes activated';
    var parts = [];
    parts.push(c.totalActivated + ' node' + (c.totalActivated > 1 ? 's' : '') + ' activated');
    if (c.crossDomainNodes > 0) parts.push(c.crossDomainNodes + ' cross-domain');
    return parts.join(' · ');
  }
};

})();
