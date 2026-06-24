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
  intelligence: { connectomeDomains: ['intelligence', 'governance'], indicators: ['ThreatLevel_CRITICAL', 'SIGINTCapacity_DEGRADED', 'HUMINTBacklog_HIGH'], sources: ['ODNI Threat Assessment', 'SIGINT Collection Tasking', 'HUMINT Source Reporting'] }
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
    return MACRO_INDICATOR_BINDING[id] || INTELLIGENCE_INDICATOR_BINDING[id];
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
