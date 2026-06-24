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
  law:            ['legal'],
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
  communication:  ['technology'],
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
  agriculture:    ['environment', 'trade']
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
  waste_policy:             { connectomeDomains: ['environment', 'governance'],           indicators: ['WasteVolume'],                                     sources: ['EPA RCRA Subtitle C/D', 'State Landfill Caps', 'EPR / E-Waste Mandates'] }
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
    return MACRO_INDICATOR_BINDING[id] || INTELLIGENCE_INDICATOR_BINDING[id] || TRADE_INDICATOR_BINDING[id];
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
