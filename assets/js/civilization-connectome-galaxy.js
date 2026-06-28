// =============================================
// LIMEN HELIX — CIVILIZATION CONNECTOME MODULE
// Extracted from civilization.html inline script
// Wrapped as IIFE with init(canvasId, opts) API
// =============================================
(function() {
"use strict";

var NODE_COLORS = {
  governance:'#14B8A6', economy:'#F59E0B', infrastructure:'#3B82F6', energy:'#F97316',
  agriculture:'#10B981', industry:'#EF4444', science:'#06B6D4', medicine:'#84CC16',
  education:'#8B5CF6', technology:'#0EA5E9', communication:'#6366F1', culture:'#A78BFA',
  defense:'#64748B', environment:'#22C55E', religion:'#F43F5E', population:'#FB923C',
  trade:'#EAB308', law:'#94A3B8', finance:'#EC4899', intelligence:'#38BDF8'
};
var EDGE_COLORS = {
  SUPPLIES:{r:16,g:185,b:129}, DEPENDS_ON:{r:59,g:130,b:246},
  TRANSFORMS:{r:234,g:179,b:8}, CONTROLS:{r:249,g:115,b:22}
};
var NODE_TAGLINES = {
  governance:'Control', economy:'Exchange', infrastructure:'Structure', energy:'Power',
  agriculture:'Nourishment', industry:'Formation', science:'Discovery', medicine:'Repair',
  education:'Transmission', technology:'Coordination', communication:'Signal', culture:'Identity',
  defense:'Protection', environment:'Substrate', religion:'Meaning', population:'Organism',
  trade:'Movement', law:'Order', finance:'Capital', intelligence:'Awareness'
};
var SHORT_NAMES = {
  governance:'GOVERNANCE', economy:'ECONOMY', infrastructure:'INFRA', energy:'ENERGY',
  agriculture:'AGRICULTURE', industry:'INDUSTRY', science:'SCIENCE', medicine:'MEDICINE',
  education:'EDUCATION', technology:'TECHNOLOGY', communication:'COMMS', culture:'CULTURE',
  defense:'DEFENSE', environment:'ENVIRONMENT', religion:'RELIGION', population:'POPULATION',
  trade:'TRADE', law:'LAW', finance:'FINANCE', intelligence:'INTEL'
};
var HUB_WEIGHTS = {
  governance:1.0, economy:1.0, infrastructure:0.8, energy:0.9,
  agriculture:0.8, industry:0.8, science:0.9, medicine:0.7,
  education:0.7, technology:1.0, communication:0.6, culture:0.6,
  defense:0.7, environment:0.8, religion:0.5, population:0.8,
  trade:0.6, law:0.7, finance:0.9, intelligence:0.7
};
var GOLDEN_ANGLE = 2.399963229728653;
var NODE_COUNT = 20;

// Phase mapping for each civilization domain
var NODE_PHASES = {
  governance:'P7', economy:'P1', infrastructure:'P4', energy:'P3',
  agriculture:'P2', industry:'P3', science:'P6', medicine:'P8',
  education:'P1', technology:'P6', communication:'P6', culture:'P9',
  defense:'P7', environment:'P0', religion:'P10', population:'P5',
  trade:'P5', law:'P4', finance:'P1', intelligence:'P9'
};

// Phase-based impulse colors
// P0-P2: cool blue/teal | P3: red-orange | P4-P6: green | P7-P9: purple/violet | P10: gold
var PHASE_PULSE_COLORS = {
  P0:  {r:14,  g:165, b:233},
  P1:  {r:6,   g:182, b:212},
  P2:  {r:14,  g:165, b:233},
  P3:  {r:239, g:115, b:70},
  P4:  {r:16,  g:185, b:129},
  P5:  {r:34,  g:197, b:94},
  P6:  {r:16,  g:185, b:129},
  P7:  {r:139, g:92,  b:246},
  P8:  {r:167, g:139, b:250},
  P9:  {r:139, g:92,  b:246},
  P10: {r:234, g:179, b:8}
};

// Map domain edge types to neural conduction classes
var EDGE_NEURAL_MAP = {
  SUPPLIES:   {myelinated:true,  speedRange:[0.10,0.18], brightness:0.85},
  DEPENDS_ON: {myelinated:false, speedRange:[0.04,0.08], brightness:0.35},
  TRANSFORMS: {myelinated:true,  speedRange:[0.14,0.22], brightness:0.95},
  CONTROLS:   {myelinated:true,  speedRange:[0.08,0.14], brightness:0.7}
};

// 3-LAYER NODE SCHEMA — STRESS CONSTANTS
// ADDITIVE (cognition port, technology gap): 'innovation_debt' is a technology-
// specific stress channel for R&D backlog, technical debt, tool/framework
// fragmentation, and unresolved security CVEs. It is appended (never reorders or
// removes the validated 7), so all length-driven loops (computeTotalStress,
// drawStressRing) widen automatically. Energy anchor: innovation debt → deferred
// infrastructure refactoring → poorly-optimized code paths / redundant compute /
// undersized cache → MORE power per operation; CVE backlog → defensive compute
// overhead (IDS, scanning) → energy overhead. It is a technology channel, NOT an
// energy-domain channel — it stays inert (0) for every non-technology node.
var STRESS_CHANNELS = ['legal','liquidity','funding','solvency','demand','ops','people','innovation_debt'];
var STRESS_COLORS = {
  legal:{r:148,g:163,b:184}, liquidity:{r:56,g:189,b:248}, funding:{r:234,g:179,b:8},
  solvency:{r:139,g:92,b:246}, demand:{r:34,g:197,b:94}, ops:{r:249,g:115,b:22},
  people:{r:236,g:72,b:153},
  innovation_debt:{r:6,g:182,b:212} // cyan — R&D / technical-debt / compute-efficiency channel
};
var TAU = Math.PI * 2;

// ═══ FINANCE: EXPLICIT LIQUIDITY vs SOLVENCY CIRCUITRY ═══
// Liquidity ≠ solvency. Lehman 2008 collapsed on BOTH, but they are distinct
// failure modes and require non-overlapping pathways:
//   • Liquidity  = a FLOW / ROUTING problem — payment rails, funding markets,
//                  the ability to roll short-term obligations. Even a solvent
//                  bank fails if liquidity dries up. Neural anchor: CC (payment
//                  connective / inter-bank wiring) → THAL (banking relay /
//                  central-bank window) → dACC (regulation-conflict detection,
//                  i.e. when funding markets and obligations collide).
//   • Solvency   = a BALANCE-SHEET problem — capital adequacy, asset quality,
//                  credit losses eroding equity. Neural anchor: dlPFC (capital
//                  adequacy planning) → vmPFC (credit-risk assessment) → STRI
//                  (credit allocation / loan-book extension).
// These are kept as SEPARATE, ADDITIVE bindings on the finance node so the two
// channels are no longer conflated in a single "banking" group.
var FINANCE_CIRCUITS = {
  liquidity: {
    label: 'Liquidity circuit (flow / routing)',
    pathway: ['CC', 'THAL', 'dACC'],
    role: 'payment-connective → banking-relay → regulation-conflict',
    // Real financial anchors: payment/clearing rails + custody/clearing banks.
    anchors: ['JPM', 'BAC', 'C', 'WFC', 'V', 'MA', 'SCHW']
  },
  solvency: {
    label: 'Solvency circuit (balance-sheet)',
    pathway: ['dlPFC', 'vmPFC', 'STRI'],
    role: 'capital-adequacy-planning → credit-risk-assessment → credit-allocation',
    // Real financial anchors: capital-markets / asset-management / credit-deploying balance sheets.
    anchors: ['GS', 'MS', 'BLK', 'KKR', 'BX', 'JPM', 'BAC']
  }
};

// ═══ TECHNOLOGY: EXPLICIT INNOVATION-DEBT CIRCUITRY ═══ (ADDITIVE — technology gap)
// Mirrors FINANCE_CIRCUITS. Innovation debt is the technology-specific stress that
// accrues when R&D backlog, technical debt, tool/framework fragmentation, and
// unresolved security CVEs are deferred. It is bound to FOUR technology nodes, each
// sensing a distinct facet of the debt. Technology identity = semiconductors &
// compute, AI/ML, software & cloud, hardware & devices, cybersecurity, R&D
// pipelines — NOT energy. Energy is a COMPUTE-DEMAND coupling: deferred refactoring
// → poorly-optimized code paths / redundant compute loops / undersized cache →
// rising per-CPU power; CVE backlog → defensive compute overhead. Distinct from
// finance: fintech is a coupling, not the identity. Real tickers only.
var TECHNOLOGY_CIRCUITS = {
  software_engineering: {
    label: 'Software-engineering debt (code-path / refactor)',
    node: 'dlPFC',
    role: 'planning/architecture → technical-debt & refactor backlog → compute-efficiency drag',
    // Real software & cloud anchors carrying large codebases / refactor surface.
    anchors: ['MSFT', 'GOOGL', 'CRM', 'ORCL', 'META']
  },
  rd_pipeline: {
    label: 'R&D-pipeline debt (research backlog)',
    node: 'vlPFC',
    role: 'R&D / innovation-pipeline → deferred research → next-gen product risk',
    // Real R&D-intensive platform & innovation anchors.
    anchors: ['AAPL', 'GOOGL', 'AMZN', 'META', 'AMD']
  },
  hardware_supply: {
    label: 'Hardware / semiconductor supply debt (process & supply-chain)',
    node: 'M1',
    role: 'hardware & device fabrication → process-node / fab supply-chain risk → output throttle',
    // Real semiconductor & fab supply anchors (chips, lithography, foundry).
    anchors: ['NVDA', 'AVGO', 'INTC', 'TSM', 'ASML']
  },
  model_training: {
    label: 'AI / model-training debt (training & data-infra risk)',
    node: 'AI',
    role: 'AI/ML model training → data-infra & training-cost backlog → model-staleness risk',
    // Real AI/ML, data-infra, and cybersecurity-AI anchors.
    anchors: ['NVDA', 'MSFT', 'PLTR', 'CRWD', 'PANW']
  }
};

// ═══ TECHNOLOGY: SUB-CIRCUIT SEGREGATION + ENERGY SIGNATURE ═══ (ADDITIVE — technology gap)
// Companion to TECHNOLOGY_CIRCUITS above (which models innovation/refactor DEBT).
// This block segregates technology STRESS into three sub-circuits whose key
// difference is their ENERGY SIGNATURE — the compute/energy-demand scaling model
// the sub-circuit emits so grid / energy-demand modeling picks the right curve.
// Without this, AI RISK, CYBERSECURITY RISK and CHIP SUPPLY RISK all activate the
// generic 'technology' node set with no differentiation of energy/compute signatures.
// Mirrors FINANCE_CIRCUITS shape (label / pathway / role) + adds energySignature.
//   • AI training   = compute/memory demand, LINEAR in GPU-days (model size x
//                     training epochs x inference volume). dlPFC -> AI -> mPFC.
//   • Cybersecurity = defensive compute — CONSTANT always-on baseline (intrusion
//                     detection, forensics) + BURST on breach. vlPFC -> rPFC -> dACC.
//   • Chip supply   = foundry capacity — power = fab power-per-wafer x utilization
//                     (TSMC 3nm vs 28nm old-node differ sharply). M1 -> THAL -> BDNF.
// Technology identity stays = chips / AI / software / cyber. Energy is ONLY the
// compute-demand coupling, never the domain's own content. Real tickers only.
var TECH_SUBCIRCUITS = {
  ai: {
    label: 'AI training circuit (compute/memory demand)',
    pathway: ['dlPFC', 'AI', 'mPFC'],
    role: 'training-resource-allocation → model-inference-load → budget-efficiency',
    energySignature: 'variable (scales with model size, training epochs, inference volume)',
    // Distinct energy profile: proportional to GPU-days — LINEAR scaling.
    scalingModel: 'linear',                       // demand proportional to GPU-days
    // Trigger sources that route 'technology' stress into the AI sub-circuit.
    triggers: ['ai_training_cost_spike', 'gpu_shortage', 'inference_demand_surge', 'model_scale_jump'],
    // Real AI/compute anchors (accelerators, hyperscale training, model platforms).
    anchors: ['NVDA', 'AMD', 'MSFT', 'GOOGL', 'META', 'AMZN', 'PLTR']
  },
  security: {
    label: 'Cybersecurity circuit (defensive compute)',
    pathway: ['vlPFC', 'rPFC', 'dACC'],
    role: 'vulnerability-scanning → breach-response → incident-cost',
    energySignature: 'constant baseline + burst on breach (intrusion detection, forensics always-on)',
    // Distinct energy profile: constant baseline + event-driven spike.
    scalingModel: 'baseline_plus_burst',          // demand = baseline + breach burst
    triggers: ['ransomware_outbreak', 'breach_disclosure', 'zero_day_exploit', 'ddos_surge'],
    // Real cybersecurity anchors.
    anchors: ['CRWD', 'PANW', 'MSFT', 'CSCO', 'FTNT', 'ZS']
  },
  supply: {
    label: 'Chip supply circuit (foundry capacity)',
    pathway: ['M1', 'THAL', 'BDNF'],
    role: 'node-advance-planning → fab-allocation → inventory-management',
    energySignature: 'depends on fab node (TSMC 3nm vs 28nm old-node has different power per wafer)',
    // Distinct energy profile: indirect — product of fab power-per-wafer x utilization.
    scalingModel: 'fab_power_per_wafer_x_utilization',
    triggers: ['chip_shortage', 'fab_capacity_constraint', 'foundry_node_transition', 'export_control_shock'],
    // Real chip-supply anchors (foundry, lithography, IDM, fabless).
    anchors: ['TSM', 'ASML', 'INTC', 'NVDA', 'AVGO', 'AMD']
  }
};

// ═══ AGRICULTURE: EXPLICIT FOUR-PATHWAY CIRCUITRY ═══ (ADDITIVE — agriculture gap)
// Mirrors FINANCE_CIRCUITS / TECHNOLOGY_CIRCUITS shape (label / pathway / role /
// anchors). Without this, agriculture stress renders as a single blurry
// 'nourishment' aggregate, losing the fine structure of crop vs livestock vs trade
// vs credit channels. Agriculture identity = farming & crops, livestock & animal
// protein, agribusiness & food production, food security & supply, fertilizers &
// crop inputs, irrigation & ag water, commodity crops (corn/soy/wheat), precision
// ag, farm economics. Energy is ONLY a coupling (crop machinery / feed logistics
// = power DEMAND; commodity futures have zero energy content) — never the domain's
// own content. Distinct from environment (land/water/climate = coupling), trade
// (export logistics = coupling), economy (food prices = coupling). Real ag tickers
// (DE, CTVA, TSN, ADM, BG, NTR, MOS) + CBOT/USDA-WASDE refs only.
var AGRICULTURE_CIRCUITS = {
  crop_production: {
    label: 'Crop-production circuit (seeding → harvest)',
    pathway: ['GPA', 'SMA', 'TrkB', 'TPOLE'],
    role: 'genomic-seed-priming → mechanized-planting → growth-signaling → harvest-throughput',
    // Real crop-input & machinery anchors (genetics/traits + farm equipment).
    anchors: ['DE', 'CTVA', 'AGCO', 'FMC']
  },
  livestock_production: {
    label: 'Livestock-production circuit (breeding → market)',
    pathway: ['FEF', 'SCN', 'STN', 'SNS'],
    role: 'herd-planning → breeding-cycle-timing → feed-conversion-regulation → market-weight-readiness',
    // Real animal-protein / packaged-food anchors.
    anchors: ['TSN', 'CAG']
  },
  commodity_trading: {
    label: 'Commodity-trading circuit (futures / hedging)',
    pathway: ['NAcc', 'STRI', 'NEOCER'],
    role: 'price-signal-valuation → hedge-allocation → basis-risk-coordination',
    // Real grain-merchant / processing anchors + CBOT corn/soy/wheat futures, USDA WASDE.
    anchors: ['CBOT', 'ADM', 'BG', 'INGR']
  },
  farm_finance: {
    label: 'Farm-finance circuit (credit / collateral)',
    pathway: ['LGN', 'SNIG', 'IPL'],
    role: 'input-cost-financing → collateral-valuation → operating-credit-extension',
    // Real crop-input suppliers (input-cost / financed-on-credit) + farm-credit lenders.
    anchors: ['NTR', 'MOS', 'CF']
  }
};

// ═══ AGRICULTURE: SUB-CIRCUIT SEGREGATION + ENERGY SIGNATURE ═══ (ADDITIVE — agriculture gap)
// Companion to AGRICULTURE_CIRCUITS above. Segregates agriculture STRESS into four
// sub-circuits whose key difference is their ENERGY SIGNATURE — the energy/logistics
// coupling each sub-circuit emits so grid / energy-demand modeling picks the right
// curve WITHOUT triggering the energy domain unless machinery/logistics nodes
// themselves activate energy DEMAND as a consequence.
//   • Crop production   = farm machinery (tractors/combines) couples to INDUSTRIAL
//                         power; diesel/irrigation pumping. Seasonal, planting/harvest peaks.
//   • Livestock         = feed logistics + cold-chain couples to TRADE-LOGISTICS power;
//                         continuous (barns/refrigeration always-on) + slaughter burst.
//   • Commodity trading = CBOT futures / hedging — ZERO energy content (pure price routing).
//   • Farm finance      = credit / collateral — ZERO direct energy; couples to input
//                         costs (fertilizer is itself energy-intensive upstream, a coupling).
// Real ag tickers + CBOT/USDA refs only. Triggers route the generic 'agriculture'
// stress into the correct sub-circuit (e.g. drought → crop circuit, not energy).
var AGRICULTURE_SUB_CIRCUITS = {
  crop: {
    label: 'Crop-production circuit (machinery / field power)',
    pathway: ['GPA', 'SMA', 'TrkB', 'TPOLE'],
    role: 'seed-priming → mechanized-planting → growth → harvest-throughput',
    energySignature: 'seasonal industrial power (tractor/combine diesel, irrigation pumping) — peaks at planting & harvest',
    scalingModel: 'seasonal_machinery_load',          // demand peaks at field operations
    triggers: ['drought', 'planting_window_shift', 'harvest_yield_miss', 'usda_wasde_acreage_cut'],
    anchors: ['DE', 'CTVA', 'AGCO', 'FMC']
  },
  livestock: {
    label: 'Livestock-production circuit (feed logistics / cold-chain)',
    pathway: ['FEF', 'SCN', 'STN', 'SNS'],
    role: 'herd-planning → breeding → feed-conversion → market-readiness',
    energySignature: 'trade-logistics power — continuous barn/refrigeration baseline + slaughter/processing burst',
    scalingModel: 'baseline_plus_processing_burst',   // always-on + slaughter spike
    triggers: ['feed_cost_spike', 'herd_liquidation', 'avian_swine_disease_outbreak', 'cold_chain_disruption'],
    anchors: ['TSN', 'CAG']
  },
  trading: {
    label: 'Commodity-trading circuit (futures / hedging)',
    pathway: ['NAcc', 'STRI', 'NEOCER'],
    role: 'price-valuation → hedge-allocation → basis-risk-coordination',
    energySignature: 'zero energy content (pure price routing — CBOT corn/soy/wheat futures, USDA WASDE)',
    scalingModel: 'none',                             // no energy coupling
    triggers: ['cbot_price_spike', 'basis_blowout', 'export_demand_shock', 'wasde_balance_sheet_revision'],
    anchors: ['CBOT', 'ADM', 'BG', 'INGR']
  },
  finance: {
    label: 'Farm-finance circuit (credit / collateral)',
    pathway: ['LGN', 'SNIG', 'IPL'],
    role: 'input-cost-financing → collateral-valuation → operating-credit-extension',
    energySignature: 'zero direct energy; couples only via input costs (fertilizer is energy-intensive upstream — a coupling)',
    scalingModel: 'input_cost_indexed',               // tracks fertilizer/input cost, not direct load
    triggers: ['input_cost_surge', 'farmland_value_drop', 'operating_credit_tightening', 'crop_insurance_payout_spike'],
    anchors: ['NTR', 'MOS', 'CF']
  }
};

// ═══ LAW: EXPLICIT FIVE-PATHWAY LEGAL-SYSTEM CIRCUITRY ═══ (ADDITIVE — law gap)
// Mirrors FINANCE_CIRCUITS / TECHNOLOGY_CIRCUITS / AGRICULTURE_CIRCUITS shape
// (label / pathway / role / anchors). Without this, law stress renders as a single
// blurry 'order' aggregate, losing the fine structure of civil-litigation vs
// criminal-prosecution vs regulatory-compliance vs intellectual-property vs
// access-to-justice channels. Law identity = the JUDICIAL / legal system: courts &
// litigation, dispute resolution, judiciary & rule of law, regulation & compliance,
// contracts & enforcement, intellectual-property law, criminal justice, legal
// services & access to justice. DISTINCT from governance (policy/administration/
// elections), intelligence (analysis/surveillance), and finance (capital).
// ZERO ENERGY SIGNATURE: law stress carries NO energy content — legal infrastructure
// (courts, agencies, law offices) couples to communication / real-estate / technology
// nodes only (case management, legal research databases, document systems), never to
// the energy domain. Court HVAC is building infrastructure, not law-origin energy
// demand. Real legal-sector identifiers (RELX LexisNexis, TRI Thomson Reuters/Westlaw,
// AXON, TYL Tyler court systems, VERI, CLBT, EVBG, DOCU) + legal authorities/indices
// (ABA, DOJ, SCOTUS, World Justice Project Rule-of-Law Index, US Courts caseload) only.
var LAW_CIRCUITS = {
  civil_litigation: {
    label: 'Civil-litigation circuit (perspective-taking / dispute resolution)',
    pathway: ['TPJ', 'rACC', 'EMP'],
    role: 'perspective-taking → conflict-monitoring → empathy-weighted adjudication',
    // Real legal-research / dispute-data anchors + caseload authority.
    anchors: ['RELX', 'TRI', 'US Courts Caseload', 'WJP Rule-of-Law Index']
  },
  criminal_prosecution: {
    label: 'Criminal-prosecution circuit (threat-detection / enforcement)',
    pathway: ['BLA', 'dlPFC', 'CeA'],
    role: 'threat-detection → prosecutorial-planning → enforcement-response',
    // Real criminal-justice / public-safety tech anchors + authority.
    anchors: ['AXON', 'TYL', 'DOJ', 'SCOTUS Docket']
  },
  regulatory_compliance: {
    label: 'Regulatory-compliance circuit (rule-enforcement / administrative law)',
    pathway: ['dACC', 'vlPFC', 'FORN'],
    role: 'rule-conflict-detection → compliance-inhibition → administrative-record',
    // Real regulatory-compliance / tax-compliance anchors + authority.
    anchors: ['VERX', 'EVBG', 'ABA', 'WJP Regulatory Enforcement']
  },
  intellectual_property: {
    label: 'Intellectual-property circuit (innovation-protection)',
    pathway: ['FG', 'HIPP', 'STRI'],
    role: 'pattern-recognition → prior-art-memory → IP-rights-allocation',
    // Real IP / docketing / e-discovery anchors + authority.
    anchors: ['RELX', 'CLBT', 'VERI', 'USPTO/PTAB']
  },
  access_to_justice: {
    label: 'Access-to-justice circuit (resource-distribution / legal services)',
    pathway: ['EMP', 'vlPFC', 'VP'],
    role: 'need-empathy → service-allocation → legal-aid-distribution',
    // Real legal-services / e-signature / self-help anchors + authority.
    anchors: ['LZ', 'DOCU', 'TYL', 'ABA Legal Access']
  }
};

// ═══ LAW: SUB-CIRCUIT SEGREGATION + ZERO ENERGY SIGNATURE ═══ (ADDITIVE — law gap)
// Companion to LAW_CIRCUITS above. Segregates law STRESS into five sub-circuits so
// generic 'law stress' differentiates between a litigation bottleneck (court docket/
// delays), regulatory capture (agency-discretion stress), contract-enforcement
// failure (remedies/damages unavailability), IP-protection gaps (patent backlog), and
// legal-services scarcity (access-to-justice crisis) — instead of collapsing to a
// single 'law' node with no diagnostic fine structure. Mirrors AGRICULTURE_SUB_CIRCUITS
// shape (label / pathway / role / energySignature / scalingModel / triggers / anchors).
// EVERY sub-circuit carries energySignature:'zero' and scalingModel:'none' — law
// infrastructure couples to communication / real-estate / technology nodes only, NEVER
// energy. Do NOT route law stress to the energy domain. Real legal-sector tickers +
// legal authorities/indices only; never fabricate (indicator-based).
var LAW_SUB_CIRCUITS = {
  litigation: {
    label: 'Litigation circuit (case throughput / court capacity)',
    pathway: ['TPJ', 'rACC', 'VMPfc', 'EMP'],
    role: 'civil/criminal case throughput → court-admin capacity → judge availability',
    energySignature: 'zero (court time / docket capacity / judicial labor — never energy demand)',
    scalingModel: 'none',
    triggers: ['litigation_backlog', 'court_docket_delay', 'judge_vacancy', 'caseload_surge'],
    anchors: ['RELX', 'TRI', 'AXON', 'TYL', 'US Courts Caseload']
  },
  regulatory: {
    label: 'Regulatory circuit (rulemaking / enforcement / administrative adjudication)',
    pathway: ['dACC', 'vlPFC', 'FORN'],
    role: 'agency rulemaking/enforcement → administrative adjudication → compliance monitoring',
    energySignature: 'zero (administrative process / compliance labor — never energy demand)',
    scalingModel: 'none',
    triggers: ['regulatory_capture', 'rulemaking_backlog', 'enforcement_action_spike', 'compliance_monitoring_gap'],
    anchors: ['VERX', 'EVBG', 'RELX', 'ABA', 'DOJ']
  },
  contract_enforcement: {
    label: 'Contract-enforcement circuit (dispute resolution / remedies)',
    pathway: ['TPJ', 'dlPFC', 'STRI'],
    role: 'dispute resolution → remedies/damages availability → contract-interpretation clarity',
    energySignature: 'zero (adjudication / settlement labor — never energy demand)',
    scalingModel: 'none',
    triggers: ['contract_interpretation_dispute', 'remedies_unavailability', 'arbitration_backlog', 'damages_uncertainty'],
    anchors: ['DOCU', 'CLBT', 'TRI', 'WJP Rule-of-Law Index']
  },
  intellectual_property: {
    label: 'Intellectual-property circuit (patent / trademark prosecution)',
    pathway: ['FG', 'HIPP', 'STRI'],
    role: 'patent/trademark prosecution → infringement litigation → licensing clarity',
    energySignature: 'zero (examination / prosecution labor — never energy demand)',
    scalingModel: 'none',
    triggers: ['patent_backlog', 'infringement_litigation_surge', 'licensing_dispute', 'trademark_prosecution_delay'],
    anchors: ['RELX', 'VERI', 'CLBT', 'USPTO/PTAB']
  },
  legal_services: {
    label: 'Legal-services circuit (lawyer availability / legal aid / access)',
    pathway: ['EMP', 'vlPFC', 'VP'],
    role: 'lawyer availability → legal-tech adoption → legal-aid funding → bar admission',
    energySignature: 'zero (human legal labor / legal-tech infrastructure — never energy demand)',
    scalingModel: 'none',
    triggers: ['access_to_justice_crisis', 'legal_aid_funding_cut', 'attorney_shortage', 'bar_admission_constraint'],
    anchors: ['LZ', 'DOCU', 'EVBG', 'ABA Legal Access', 'WJP Civil Justice']
  }
};

// === DOMAIN → SUB-PORTAL REGISTRY ===
var DOMAIN_PORTALS = {
  medicine:[
    {name:'Clinical Circuit Map',url:'/clinical'},
    {name:'Neurology Circuit Map',url:'/neurology'},
    {name:'Metabolic Circuit Map',url:'/metabolic'},
    {name:'Pediatric Circuit Map',url:'/pediatric'},
    {name:'Gut-Brain Axis',url:'/portals/gutbrain-circuit'},
    {name:'Addiction Circuit Map',url:'/addiction'},
    {name:'Psychedelic Circuit Map',url:'/psychedelic'},
    {name:'Provider Portal',url:'/provider-portal'},
    {name:'Men\'s Health Optimization',url:'/portals/medicine/trt_clinic.html'},
    {name:'Johnson & Johnson (JNJ)',url:'/company-portal?company=johnson_and_johnson'},
    {name:'Pfizer (PFE)',url:'/company-portal?company=pfizer'},
    {name:'Abbott (ABT)',url:'/company-portal?company=abbott_laboratories'},
    {name:'Medtronic (MDT)',url:'/company-portal?company=medtronic'},
    {name:'Eli Lilly (LLY)',url:'/company-portal?company=eli_lilly'}
  ],
  religion:[
    // ── ADDITIVE (religion gap → energy parity): PRIMARY identity = faith-institution &
    //    religious-landscape DATA, not media. Religion is indicator/institution-based, NOT
    //    company tickers — anchored to REAL sources (Pew, ARDA, Gallup, PRRI, USCIRF, WVS).
    //    DISTINCT from culture (secular scenes/content), population (affiliation demographics
    //    is a coupling), governance (religious-freedom policy is a coupling). ZERO energy
    //    content — never conflate with oil/gas/grid/commodities.
    // (1) Religious-Freedom Portal — USCIRF reports + Pew global restrictions index.
    {name:'USCIRF Religious Freedom Reports',url:'/authority-portal?authority=uscirf_annual_report'},
    {name:'Pew Global Restrictions on Religion',url:'/authority-portal?authority=pew_global_restrictions'},
    // (2) Faith-Community Resilience Portal — ARDA congregational trends, Gallup attendance,
    //     seminary/clergy-pipeline enrollment.
    {name:'ARDA Congregational Trends',url:'/authority-portal?authority=arda_congregational_trends'},
    {name:'Gallup Religious Attendance',url:'/authority-portal?authority=gallup_religious_attendance'},
    {name:'ATS Seminary Enrollment (Clergy Pipeline)',url:'/authority-portal?authority=ats_seminary_enrollment'},
    // (3) Interfaith Pluralism Portal — Interfaith America (IFYC) networks, dialogue
    //     engagement, cross-community trust.
    {name:'Interfaith America Pluralism Network',url:'/authority-portal?authority=interfaith_america_pluralism'},
    {name:'World Values Survey Religiosity',url:'/authority-portal?authority=wvs_religiosity'},
    // (4) Religious-Scholarship & Theology Portal — Templeton Foundation grants, theological
    //     research, World Council of Churches doctrinal resources.
    {name:'John Templeton Foundation Research',url:'/authority-portal?authority=templeton_foundation'},
    {name:'World Council of Churches Resources',url:'/authority-portal?authority=wcc_doctrinal_resources'},
    // (5) Institutional-Trust & Secularization Portal — Pew affiliation trends, 'nones'
    //     growth, PRRI generational belief transmission.
    {name:'Pew Religious Landscape Study',url:'/authority-portal?authority=pew_religious_landscape'},
    {name:'PRRI American Values / "Nones" Trends',url:'/authority-portal?authority=prri_disaffiliation_trends'},
    // ── SECONDARY: contemplative circuit + faith-media companies (real tickers only).
    {name:'Contemplative Circuit Map',url:'/contemplative'},
    {name:'Salem Comm (SALM)',url:'/company-portal?company=salem_communications'},
    {name:'Gannett (GCI)',url:'/company-portal?company=gannett'},
    {name:'Scholastic (SCHL)',url:'/company-portal?company=scholastic'},
    {name:'HMH (HMHC)',url:'/company-portal?company=houghton_mifflin_harcourt'},
    {name:'Tyndale House',url:'/company-portal?company=tyndale_house'}
  ],
  economy:[
    {name:'Business',url:'/business'},
    {name:'ADP (ADP)',url:'/company-portal?company=adp'},
    {name:'Paychex (PAYX)',url:'/company-portal?company=paychex'},
    {name:'Intuit (INTU)',url:'/company-portal?company=intuit'},
    {name:'Block (SQ)',url:'/company-portal?company=block'},
    {name:'Robert Half (RHI)',url:'/company-portal?company=robert_half'}
  ],
  finance:[
    {name:'Helix Portal',url:'/helix-report'},
    {name:'JPMorgan (JPM)',url:'/company-portal?company=jpmorgan_chase'},
    {name:'Bank of America (BAC)',url:'/company-portal?company=bank_of_america'},
    {name:'Goldman Sachs (GS)',url:'/company-portal?company=goldman_sachs'},
    {name:'Schwab (SCHW)',url:'/company-portal?company=charles_schwab'},
    {name:'BlackRock (BLK)',url:'/company-portal?company=blackrock'}
  ],
  energy:[
    {name:'Exxon Mobil (XOM)',url:'/company-portal?company=exxon_mobil'},
    {name:'Chevron (CVX)',url:'/company-portal?company=chevron'},
    {name:'ConocoPhillips (COP)',url:'/company-portal?company=conocophillips'},
    {name:'Occidental (OXY)',url:'/company-portal?company=occidental_petroleum'},
    {name:'NextEra (NEE)',url:'/company-portal?company=nextera_energy'}
  ],
  technology:[
    {name:'Microsoft (MSFT)',url:'/company-portal?company=microsoft'},
    {name:'Apple (AAPL)',url:'/company-portal?company=apple'},
    {name:'NVIDIA (NVDA)',url:'/company-portal?company=nvidia'},
    {name:'Applied Materials (AMAT)',url:'/company-portal?company=applied_materials'},
    {name:'CrowdStrike (CRWD)',url:'/company-portal?company=crowdstrike'}
  ],
  infrastructure:[
    {name:'Quanta Services (PWR)',url:'/company-portal?company=quanta_services'},
    {name:'Fluor (FLR)',url:'/company-portal?company=fluor'},
    {name:'AECOM (ACM)',url:'/company-portal?company=aecom'},
    {name:'Vulcan Materials (VMC)',url:'/company-portal?company=vulcan_materials'},
    {name:'Martin Marietta (MLM)',url:'/company-portal?company=martin_marietta_materials'}
  ],
  industry:[
    {name:'Caterpillar (CAT)',url:'/company-portal?company=caterpillar'},
    {name:'Honeywell (HON)',url:'/company-portal?company=honeywell'},
    {name:'Emerson (EMR)',url:'/company-portal?company=emerson_electric'},
    {name:'Rockwell (ROK)',url:'/company-portal?company=rockwell_automation'},
    {name:'Illinois Tool Works (ITW)',url:'/company-portal?company=illinois_tool_works'},
    {name:'General Electric (GE)',url:'/company-portal?company=general_electric'},
    {name:'3M (MMM)',url:'/company-portal?company=3m'},
    {name:'Eaton (ETN)',url:'/company-portal?company=eaton'},
    {name:'Parker Hannifin (PH)',url:'/company-portal?company=parker_hannifin'},
    {name:'Dover (DOV)',url:'/company-portal?company=dover'},
    {name:'Deere (DE)',url:'/company-portal?company=deere'}
  ],
  communication:[
    {name:'Comcast (CMCSA)',url:'/company-portal?company=comcast'},
    {name:'Charter (CHTR)',url:'/company-portal?company=charter_communications'},
    {name:'T-Mobile (TMUS)',url:'/company-portal?company=t_mobile_us'},
    {name:'Verizon (VZ)',url:'/company-portal?company=verizon'},
    {name:'AT&T (T)',url:'/company-portal?company=atandt'}
  ],
  defense:[
    {name:'Lockheed Martin (LMT)',url:'/company-portal?company=lockheed_martin'},
    {name:'Northrop Grumman (NOC)',url:'/company-portal?company=northrop_grumman'},
    {name:'L3Harris (LHX)',url:'/company-portal?company=l3harris'},
    {name:'Leidos (LDOS)',url:'/company-portal?company=leidos'},
    {name:'Booz Allen (BAH)',url:'/company-portal?company=booz_allen_hamilton'}
  ],
  science:[
    {name:'Danaher (DHR)',url:'/company-portal?company=danaher'},
    {name:'Agilent (A)',url:'/company-portal?company=agilent_technologies'},
    {name:'Bruker (BRKR)',url:'/company-portal?company=bruker'},
    {name:'Illumina (ILMN)',url:'/company-portal?company=illumina'},
    {name:'Charles River (CRL)',url:'/company-portal?company=charles_river_laboratories'}
  ],
  education:[
    {name:'Coursera (COUR)',url:'/company-portal?company=coursera'},
    {name:'Stride (LRN)',url:'/company-portal?company=stride_inc'},
    {name:'Chegg (CHGG)',url:'/company-portal?company=chegg'},
    {name:'Pearson (PSO)',url:'/company-portal?company=pearson'},
    {name:'2U (TWOU)',url:'/company-portal?company=2u'}
  ],
  culture:[
    {name:'Disney (DIS)',url:'/company-portal?company=walt_disney'},
    {name:'Live Nation (LYV)',url:'/company-portal?company=live_nation'},
    {name:'Spotify (SPOT)',url:'/company-portal?company=spotify'},
    {name:'Warner Bros (WBD)',url:'/company-portal?company=warner_bros_discovery'},
    {name:'Electronic Arts (EA)',url:'/company-portal?company=electronic_arts'}
  ],
  environment:[
    {name:'Waste Mgmt (WM)',url:'/company-portal?company=waste_management'},
    {name:'Republic Svcs (RSG)',url:'/company-portal?company=republic_services'},
    {name:'Clean Harbors (CLH)',url:'/company-portal?company=clean_harbors'},
    {name:'Montrose (MEG)',url:'/company-portal?company=montrose_environmental'},
    {name:'Casella (CWST)',url:'/company-portal?company=casella_waste_systems'}
  ],
  population:[
    {name:'Zillow (ZG)',url:'/company-portal?company=zillow'},
    {name:'Redfin (RDFN)',url:'/company-portal?company=redfin'},
    {name:'Equifax (EFX)',url:'/company-portal?company=equifax'},
    {name:'CoStar (CSGP)',url:'/company-portal?company=costar_group'},
    {name:'Rocket (RKT)',url:'/company-portal?company=rocket_companies'}
  ],
  trade:[
    {name:'FedEx (FDX)',url:'/company-portal?company=fedex'},
    {name:'UPS (UPS)',url:'/company-portal?company=ups'},
    {name:'Expeditors (EXPD)',url:'/company-portal?company=expeditors_international'},
    {name:'C.H. Robinson (CHRW)',url:'/company-portal?company=c_h_robinson'},
    {name:'XPO (XPO)',url:'/company-portal?company=xpo'},
    {name:'ZIM Integrated Shipping (ZIM)',url:'/company-portal?company=zim'},
    {name:'Matson (MATX)',url:'/company-portal?company=matx'},
    {name:'Maersk (AMKBY)',url:'/company-portal?company=maersk'},
    {name:'Old Dominion (ODFL)',url:'/company-portal?company=old_dominion_freight'}
  ],
  law:[
    {name:'Thomson Reuters (TRI)',url:'/company-portal?company=thomson_reuters'},
    {name:'RELX (RELX)',url:'/company-portal?company=relx'},
    {name:'Moody\'s (MCO)',url:'/company-portal?company=moodys'},
    {name:'S&P Global (SPGI)',url:'/company-portal?company=sandp_global'},
    {name:'MSCI (MSCI)',url:'/company-portal?company=msci'},
    // ── ADDITIVE (law gap): real legal-sector anchors — compliance, court/case-management,
    //    legal-services/property-law data — distinct from energy. VERX/CSGP serve law
    //    domain infrastructure, NOT the energy sector; do not conflate with grid/commodities.
    {name:'Vertex (VERX)',url:'/company-portal?company=vertex_compliance'},
    {name:'CoStar (CSGP)',url:'/company-portal?company=costar_group'},
    {name:'Tyler Technologies (TYL)',url:'/company-portal?company=tyler_technologies'},
    {name:'Everbridge (EVBG)',url:'/company-portal?company=everbridge'},
    // ── ADDITIVE (law gap): legal authorities / rule-of-law indices (indicator-based,
    //    never fabricated): judicial independence, docket backlog, Supreme Court tracking.
    {name:'World Justice Project Rule of Law Index',url:'/authority-portal?authority=wjp_rol_index'},
    {name:'US Courts Caseload Statistics',url:'/authority-portal?authority=us_courts_caseload'},
    {name:'SCOTUS Docket',url:'/authority-portal?authority=scotus_docket'}
  ],
  intelligence:[
    {name:'Palantir (PLTR)',url:'/company-portal?company=palantir'},
    {name:'Parsons (PSN)',url:'/company-portal?company=parsons'},
    {name:'SAIC (SAIC)',url:'/company-portal?company=saic'},
    {name:'Cognizant (CTSH)',url:'/company-portal?company=cognizant'},
    {name:'Splunk (SPLK)',url:'/company-portal?company=splunk'}
  ],
  governance:[
    {name:'ICF International (ICFI)',url:'/company-portal?company=icf_international'},
    {name:'CACI (CACI)',url:'/company-portal?company=caci_international'},
    {name:'Maximus (MMS)',url:'/company-portal?company=maximus'},
    {name:'ManTech (MANT)',url:'/company-portal?company=mantech_international'},
    {name:'Accenture (ACN)',url:'/company-portal?company=accenture'}
  ],
  agriculture:[
    {name:'Agriculture Portal',url:'/p2_agri_portal'},
    {name:'Deere (DE)',url:'/company-portal?company=deere'},
    {name:'ADM (ADM)',url:'/company-portal?company=archer_daniels_midland'},
    {name:'Bunge (BG)',url:'/company-portal?company=bunge'},
    {name:'Corteva (CTVA)',url:'/company-portal?company=corteva'},
    {name:'Mosaic (MOS)',url:'/company-portal?company=mosaic'}
  ],
  addiction:[
    {name:'Amgen (AMGN)',url:'/company-portal?company=amgen'},
    {name:'Indivior (INDV)',url:'/company-portal?company=indivior'},
    {name:'Alkermes (ALKS)',url:'/company-portal?company=alkermes'},
    {name:'Teva (TEVA)',url:'/company-portal?company=teva_pharmaceutical'},
    {name:'Emergent Bio (EBS)',url:'/company-portal?company=emergent_biosolutions'}
  ],
  contemplative:[
    {name:'Calm.com',url:'/company-portal?company=calm_com'},
    {name:'Insight Timer',url:'/company-portal?company=insight_timer'},
    {name:'Lululemon (LULU)',url:'/company-portal?company=lululemon'},
    {name:'Mindbody',url:'/company-portal?company=mindbody'},
    {name:'Sounds True',url:'/company-portal?company=sounds_true'}
  ],
  legal:[
    {name:'LegalZoom (LZ)',url:'/company-portal?company=legalzoom'},
    {name:'Everbridge (EVBG)',url:'/company-portal?company=everbridge'},
    {name:'DLocal (DLO)',url:'/company-portal?company=dlocal'},
    {name:'DocuSign (DOCU)',url:'/company-portal?company=docusign'},
    {name:'CSG Systems (CSGS)',url:'/company-portal?company=csg_systems'}
  ],
  metabolic:[
    {name:'Novo Nordisk (NVO)',url:'/company-portal?company=novo_nordisk'},
    {name:'Dexcom (DXCM)',url:'/company-portal?company=dexcom'},
    {name:'Insulet (PODD)',url:'/company-portal?company=insulet'},
    {name:'Tandem (TNDM)',url:'/company-portal?company=tandem_diabetes'},
    {name:'Abbott (ABT)',url:'/company-portal?company=abbott_metabolic'}
  ],
  neurology:[
    {name:'Biogen (BIIB)',url:'/company-portal?company=biogen'},
    {name:'Jazz Pharma (JAZZ)',url:'/company-portal?company=jazz_pharmaceuticals'},
    {name:'Acadia (ACAD)',url:'/company-portal?company=acadia_pharmaceuticals'},
    {name:'Axsome (AXSM)',url:'/company-portal?company=axsome_therapeutics'},
    {name:'Neurocrine (NBIX)',url:'/company-portal?company=neurocrine_biosciences'}
  ],
  pediatric:[
    {name:'Organon (OGN)',url:'/company-portal?company=organon'},
    {name:'Masimo (MASI)',url:'/company-portal?company=masimo'},
    {name:'Reckitt/Mead Johnson (RBGLY)',url:'/company-portal?company=mead_johnson'},
    {name:'Hologic (HOLX)',url:'/company-portal?company=hologic'},
    {name:'Pediatrix (MD)',url:'/company-portal?company=pediatric_medical_group'}
  ],
  psychedelic:[
    {name:'COMPASS Pathways (CMPS)',url:'/company-portal?company=compass_pathways'},
    {name:'ATAI Life Sciences (ATAI)',url:'/company-portal?company=atai_life_sciences'},
    {name:'MindMed (MNMD)',url:'/company-portal?company=mind_medicine'},
    {name:'Cybin (CYBN)',url:'/company-portal?company=cybin'},
    {name:'GH Research (GHRS)',url:'/company-portal?company=gh_research'}
  ]
};

// === NAVIGATION ===
var PORTAL_ROUTES = {
  'governance': '/domain-console?domain=governance',
  'economy': '/domain-console?domain=economy',
  'infrastructure': '/domain-console?domain=infrastructure',
  'energy': '/domain-console?domain=energy',
  'agriculture': '/domain-console?domain=agriculture',
  'industry': '/domain-console?domain=industry',
  'science': '/domain-console?domain=science',
  'medicine': '/domain-console?domain=medicine',
  'education': '/domain-console?domain=education',
  'technology': '/domain-console?domain=technology',
  'communication': '/domain-console?domain=communication',
  'culture': '/domain-console?domain=culture',
  'defense': '/domain-console?domain=defense',
  'environment': '/domain-console?domain=environment',
  'religion': '/domain-console?domain=religion',
  'population': '/domain-console?domain=population',
  'trade': '/domain-console?domain=trade',
  'law': '/domain-console?domain=law',
  'finance': '/domain-console?domain=finance',
  'intelligence': '/domain-console?domain=intelligence'
};

// ═══ 3-LAYER HELPER FUNCTIONS ═══

function initPhaseVector(phaseStr) {
  var vec = {};
  for (var i = 0; i <= 10; i++) vec['P' + i] = 0;
  if (phaseStr && vec.hasOwnProperty(phaseStr)) {
    vec[phaseStr] = 0.75;
    var idx = parseInt(phaseStr.slice(1));
    if (idx > 0) vec['P' + (idx - 1)] = 0.08;
    if (idx < 10) vec['P' + (idx + 1)] = 0.08;
    var assigned = 0.75 + (idx > 0 ? 0.08 : 0) + (idx < 10 ? 0.08 : 0);
    var remaining = 1 - assigned;
    var crumbCount = 11 - (1 + (idx > 0 ? 1 : 0) + (idx < 10 ? 1 : 0));
    var crumb = crumbCount > 0 ? remaining / crumbCount : 0;
    for (var i = 0; i <= 10; i++) {
      var k = 'P' + i;
      if (k !== phaseStr && !(idx > 0 && i === idx - 1) && !(idx < 10 && i === idx + 1)) {
        vec[k] = crumb;
      }
    }
  } else {
    for (var i = 0; i <= 10; i++) vec['P' + i] = 1 / 11;
  }
  return vec;
}

function computeInstability(vec) {
  var vals = [];
  for (var k in vec) vals.push(vec[k]);
  vals.sort(function(a, b) { return b - a; });
  return 1 - ((vals[0] || 0) - (vals[1] || 0));
}

function getDominantPhase(vec) {
  var best = 'P0', bestV = -1;
  for (var k in vec) {
    if (vec[k] > bestV) { bestV = vec[k]; best = k; }
  }
  return best;
}

function computeTotalStress(sv) {
  // ADDITIVE (technology gap): the average is taken over the canonical 7 base
  // channels so that appending the technology-specific 'innovation_debt' channel
  // does NOT silently dilute every existing node's total_stress (a node with
  // innovation_debt:0 keeps its exact prior total). innovation_debt is then ADDED
  // on top (capped at 1.0) only where it is actually present (technology nodes),
  // so it raises tech stress without altering any other domain's validated total.
  var sum = 0, base = 0;
  for (var i = 0; i < STRESS_CHANNELS.length; i++) {
    var ch = STRESS_CHANNELS[i];
    if (ch === 'innovation_debt') continue;
    sum += (sv[ch] || 0);
    base++;
  }
  var avg = base ? (sum / base) : 0;
  var innov = sv.innovation_debt || 0;
  if (innov > 0) avg = Math.min(1, avg + innov / STRESS_CHANNELS.length);
  return avg;
}

function hexToRgb(hex) {
  return {r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16)};
}

// ═══ MODULE-SCOPED STATE ═══
var NODES, EDGES, DATA, neighborMap;
var satellites, actionPotentials, bgParticles, wanderers;
var canvas, ctx, W, H, CX, CY;
var DPR;
var t, hoveredNode, spiralAngle, spiralSpeed;
var topKSet;
var spiralMaxR;
var camX, camY, camZ;
var targetX, targetY, targetZ;
var dragStart, isDragging;
var noiseCanvas;
var transitioning, transitionStart, transitionTarget;
var clickFadeNode;
var entryFadeStart;
var mouseDownPos;
var lastTouchDist, touchStartPos;

// Module options
var _miniMode = false;
var _focusDomain = null;
var _onNodeClick = null;
var _tooltip = null;
var _ttPhase = null;
var _ttName = null;
var _ttTagline = null;
var _ttCounts = null;
var _DOMAIN_COUNTS = {
  governance:{p:28129,dx:59071,tx:516899}, economy:{p:24534,dx:45928,tx:405596}, infrastructure:{p:27275,dx:48440,tx:440218},
  energy:{p:27165,dx:54113,tx:475496}, agriculture:{p:18814,dx:54410,tx:445440}, industry:{p:27265,dx:51040,tx:457616},
  science:{p:18183,dx:32511,tx:296165}, medicine:{p:19493,dx:30019,tx:274539}, education:{p:17060,dx:31936,tx:484913},
  technology:{p:19976,dx:34039,tx:313943}, communication:{p:18502,dx:32638,tx:296846}, culture:{p:25409,dx:44212,tx:398515},
  defense:{p:27478,dx:52758,tx:468005}, environment:{p:27709,dx:54199,tx:608600}, religion:{p:28124,dx:53323,tx:476308},
  population:{p:28359,dx:57512,tx:526570}, trade:{p:18508,dx:31982,tx:330331}, law:{p:19511,dx:36993,tx:339101},
  finance:{p:20764,dx:37375,tx:349583}, intelligence:{p:21781,dx:37638,tx:341003}
};
var _subMenu = null;
var _animFrameId = null;

function resetState() {
  NODES = []; EDGES = []; DATA = null; neighborMap = {};
  satellites = []; actionPotentials = []; bgParticles = []; wanderers = [];
  t = 0; hoveredNode = -1; spiralAngle = 0; spiralSpeed = 0.0003;
  topKSet = {};
  spiralMaxR = 0;
  camX = 0; camY = 0; camZ = 1;
  targetX = 0; targetY = 0; targetZ = 1;
  dragStart = null; isDragging = false;
  noiseCanvas = null;
  transitioning = false; transitionStart = 0; transitionTarget = null;
  clickFadeNode = -1;
  entryFadeStart = -1;
  mouseDownPos = null;
  lastTouchDist = 0; touchStartPos = null;
}

function getPhaseColor(n) {
  var phase = n.dominant_phase || 'P0';
  var c = PHASE_PULSE_COLORS[phase] || PHASE_PULSE_COLORS.P0;
  var inst = n.instability || 0;
  var sat = Math.max(0.2, 1 - inst * 0.8);
  return {
    r: Math.round(120 + (c.r - 120) * sat),
    g: Math.round(120 + (c.g - 120) * sat),
    b: Math.round(120 + (c.b - 120) * sat)
  };
}

function drawStressRing(x, y, radius, node, alpha) {
  if (!node || node.total_stress < 0.05) return;
  var sv = node.stress_vector;
  if (!sv) return;
  var segAngle = TAU / STRESS_CHANNELS.length; // dynamic — widens when channels are added (e.g. innovation_debt)
  var ringWidth = 2;
  for (var i = 0; i < STRESS_CHANNELS.length; i++) {
    var ch = STRESS_CHANNELS[i];
    var val = sv[ch] || 0;
    if (val < 0.05) continue;
    var c = STRESS_COLORS[ch];
    var a = val * node.total_stress * alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius + ringWidth, i * segAngle, (i + 1) * segAngle);
    ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    ctx.lineWidth = ringWidth;
    ctx.stroke();
  }
}

function seedStressCivilization(n, idx) {
  var sv = {legal:0, liquidity:0, funding:0, solvency:0, demand:0, ops:0, people:0, innovation_debt:0};
  sv.demand = Math.min((n.degree || 0) / 4, 1);
  sv.funding = Math.min(1 - (n.dataWeight || 0), 1);
  sv.people = Math.min((n.degree || 0) / 6, 1);
  var controlsCount = 0, suppliesCount = 0, dependsCount = 0, transformsCount = 0;
  var lawNeighbor = false, financeNeighbor = false;
  for (var i = 0; i < EDGES.length; i++) {
    var e = EDGES[i];
    if (e.ai === idx || e.bi === idx) {
      if (e.type === 'CONTROLS') controlsCount++;
      if (e.type === 'SUPPLIES') suppliesCount++;
      if (e.type === 'DEPENDS_ON') dependsCount++;
      if (e.type === 'TRANSFORMS') transformsCount++;
      var otherIdx = (e.ai === idx) ? e.bi : e.ai;
      if (NODES[otherIdx] && NODES[otherIdx].id === 'law') lawNeighbor = true;
      if (NODES[otherIdx] && NODES[otherIdx].id === 'finance') financeNeighbor = true;
    }
  }
  sv.legal = Math.min(controlsCount / 3, 1);
  if (lawNeighbor) sv.legal = Math.min(sv.legal + 0.2, 1);
  sv.liquidity = Math.min(suppliesCount / 4, 1);
  if (financeNeighbor) sv.liquidity = Math.min(sv.liquidity + 0.2, 1);
  sv.solvency = Math.min(dependsCount / 3, 1);
  sv.ops = Math.min(transformsCount / 3, 1);
  if (n.id === 'population' || n.id === 'education' || n.id === 'medicine') {
    sv.people = Math.min(sv.people + 0.3, 1);
  }
  // ── ADDITIVE: finance gets explicit, non-overlapping liquidity vs solvency circuits ──
  // For the finance node only, re-derive liquidity and solvency from SEPARATE pathways
  // so the two are no longer conflated under a single "banking" group.
  //   Liquidity (flow/routing): outbound SUPPLIES edges = the system's payment/funding
  //     fan-out that finance must keep flowing (CC→THAL→dACC). A high SUPPLIES degree =
  //     more rails finance is on the hook to keep liquid.
  //   Solvency (balance-sheet): inbound DEPENDS_ON edges = obligations resting on finance's
  //     capital base (dlPFC→vmPFC→STRI). A high DEPENDS_ON degree = more claims on equity.
  if (n.id === 'finance') {
    var liqOut = 0, solvIn = 0;
    for (var fe = 0; fe < EDGES.length; fe++) {
      var ef = EDGES[fe];
      if (ef.ai !== idx && ef.bi !== idx) continue;
      var financeIsSource = (ef.ai === idx);
      if (ef.type === 'SUPPLIES' && financeIsSource) liqOut++;        // routing fan-out
      if (ef.type === 'DEPENDS_ON' && !financeIsSource) solvIn++;      // balance-sheet claims
      if (ef.type === 'CONTROLS') liqOut += 0.5;                       // regulated rails add liquidity strain
      if (ef.type === 'TRANSFORMS') solvIn += 0.5;                     // re-intermediation strains capital
    }
    // Non-overlapping: liquidity from the routing pathway, solvency from the balance-sheet pathway.
    sv.liquidity = Math.min(liqOut / 3, 1);
    sv.solvency = Math.min(solvIn / 3, 1);
    // Expose the explicit circuit binding on the node for downstream advisory layers.
    n.finance_circuits = {
      liquidity: { stress: sv.liquidity, pathway: FINANCE_CIRCUITS.liquidity.pathway, anchors: FINANCE_CIRCUITS.liquidity.anchors },
      solvency:  { stress: sv.solvency,  pathway: FINANCE_CIRCUITS.solvency.pathway,  anchors: FINANCE_CIRCUITS.solvency.anchors }
    };
  }
  // ── ADDITIVE: technology gets an explicit innovation_debt channel (R&D backlog,
  //    technical debt, tool/framework churn, unresolved CVEs). For the technology
  //    node only, derive innovation_debt = (supply-chain risk + tool/framework churn
  //    + unresolved security CVEs) / 3, each estimated from edge topology (no fabricated
  //    numbers): the same structural signals already present in the connectome.
  //      • supply-chain risk  ← inbound DEPENDS_ON edges (upstream chip/fab/cloud reliance)
  //      • tool/framework churn ← outbound TRANSFORMS edges (re-platforming / refactor surface)
  //      • unresolved CVEs    ← CONTROLS edges (regulated / security-governed surface = attack surface)
  //    Bind innovation_debt to the four technology cognition nodes (dlPFC software
  //    engineering, vlPFC R&D, M1 hardware supply, AI model training) and expose the
  //    circuit on the node for downstream advisory layers. Energy coupling is a
  //    consequence (compute-efficiency / defensive-compute overhead), NOT the channel
  //    itself — innovation_debt stays inert (0) for every non-technology node.
  if (n.id === 'technology') {
    var supplyRisk = 0, toolChurn = 0, cveSurface = 0;
    for (var te = 0; te < EDGES.length; te++) {
      var et = EDGES[te];
      if (et.ai !== idx && et.bi !== idx) continue;
      var techIsSource = (et.ai === idx);
      if (et.type === 'DEPENDS_ON' && !techIsSource) supplyRisk++;   // upstream chip/fab/cloud reliance
      if (et.type === 'DEPENDS_ON' && techIsSource)  supplyRisk += 0.5; // own dependencies (data infra)
      if (et.type === 'TRANSFORMS') toolChurn++;                     // re-platforming / refactor surface
      if (et.type === 'CONTROLS')   cveSurface++;                    // security/regulated surface = attack surface
      if (et.type === 'SUPPLIES' && techIsSource) cveSurface += 0.5; // downstream exposure widens CVE blast radius
    }
    var srN = Math.min(supplyRisk / 3, 1);
    var tcN = Math.min(toolChurn / 3, 1);
    var cveN = Math.min(cveSurface / 3, 1);
    sv.innovation_debt = Math.min((srN + tcN + cveN) / 3, 1);
    // Expose the explicit circuit binding (four tech nodes + real tickers) for advisory layers.
    n.technology_circuits = {
      innovation_debt:      { stress: sv.innovation_debt },
      software_engineering: { node: TECHNOLOGY_CIRCUITS.software_engineering.node, signal: tcN,  anchors: TECHNOLOGY_CIRCUITS.software_engineering.anchors },
      rd_pipeline:          { node: TECHNOLOGY_CIRCUITS.rd_pipeline.node,          signal: srN,  anchors: TECHNOLOGY_CIRCUITS.rd_pipeline.anchors },
      hardware_supply:      { node: TECHNOLOGY_CIRCUITS.hardware_supply.node,      signal: srN,  anchors: TECHNOLOGY_CIRCUITS.hardware_supply.anchors },
      model_training:       { node: TECHNOLOGY_CIRCUITS.model_training.node,       signal: cveN, anchors: TECHNOLOGY_CIRCUITS.model_training.anchors }
    };
    // ── ADDITIVE: segregated sub-circuits with DISTINCT energy signatures ──
    // Maps the three structural signals above onto the AI / cybersecurity / chip-supply
    // sub-circuits (TECH_SUBCIRCUITS) so each stress channel carries its own energy-demand
    // scaling model. This is what lets grid/energy-demand modeling differentiate AI RISK
    // (linear in GPU-days) vs CYBERSECURITY RISK (baseline + breach burst) vs CHIP SUPPLY
    // RISK (fab power-per-wafer x utilization) instead of one generic 'technology' load.
    //   • AI sub-circuit      ← tool/framework + R&D churn (model-build / refactor compute)
    //   • Security sub-circuit ← CVE / attack-surface signal (defensive compute)
    //   • Supply sub-circuit   ← upstream supply-chain risk (foundry / fab capacity)
    n.technology_circuits.sub_circuits = {
      ai: {
        label: TECH_SUBCIRCUITS.ai.label,
        stress: Math.min((tcN + srN) / 2, 1),
        pathway: TECH_SUBCIRCUITS.ai.pathway,
        energySignature: TECH_SUBCIRCUITS.ai.energySignature,
        scalingModel: TECH_SUBCIRCUITS.ai.scalingModel,
        anchors: TECH_SUBCIRCUITS.ai.anchors
      },
      security: {
        label: TECH_SUBCIRCUITS.security.label,
        stress: cveN,
        pathway: TECH_SUBCIRCUITS.security.pathway,
        energySignature: TECH_SUBCIRCUITS.security.energySignature,
        scalingModel: TECH_SUBCIRCUITS.security.scalingModel,
        anchors: TECH_SUBCIRCUITS.security.anchors
      },
      supply: {
        label: TECH_SUBCIRCUITS.supply.label,
        stress: srN,
        pathway: TECH_SUBCIRCUITS.supply.pathway,
        energySignature: TECH_SUBCIRCUITS.supply.energySignature,
        scalingModel: TECH_SUBCIRCUITS.supply.scalingModel,
        anchors: TECH_SUBCIRCUITS.supply.anchors
      }
    };
  }
  // ── ADDITIVE: law gets an explicit legal stress channel (the 'legal' channel is
  //    already canonical; here the law node alone re-derives it from FIVE segregated
  //    legal-system sub-circuits so it no longer collapses to one blurry 'order' value).
  //    For the law node only, derive each sub-circuit's stress from edge topology (no
  //    fabricated numbers): the same structural signals already present in the connectome.
  //      • litigation backlog        ← inbound DEPENDS_ON edges (court system reliance on external demand)
  //      • regulatory capture        ← CONTROLS edges (discretionary agency-authority surface)
  //      • contract-enforcement gaps ← TRANSFORMS edges (dispute-resolution / remediation throughput)
  //      • IP-protection weakness    ← inbound DEPENDS_ON + (FG-node) innovation reliance on patent protection
  //      • access-to-justice scarcity← outbound SUPPLIES edges (legal-services distribution fan-out)
  //    Bind these to LAW_SUB_CIRCUITS pathways and expose n.law_circuits (with a
  //    sub_circuits array) for downstream advisory layers. ZERO ENERGY: legal stress
  //    carries no energy content — it scales on human legal labor (attorney/paralegal FTE),
  //    legal-tech infrastructure (case-management / research databases), and court
  //    infrastructure (judge time, courtroom availability), NOT energy. Do NOT add
  //    energy-demand scaling. law_circuits stays inert for every non-law node.
  if (n.id === 'law') {
    var litigationDep = 0, regCapture = 0, contractSurface = 0, ipReliance = 0, accessFan = 0;
    for (var le = 0; le < EDGES.length; le++) {
      var el = EDGES[le];
      if (el.ai !== idx && el.bi !== idx) continue;
      var lawIsSource = (el.ai === idx);
      if (el.type === 'DEPENDS_ON' && !lawIsSource) { litigationDep++; ipReliance += 0.5; } // court reliance + innovation-on-IP reliance
      if (el.type === 'DEPENDS_ON' && lawIsSource)  litigationDep += 0.5;                    // own systemic dependencies
      if (el.type === 'CONTROLS')                   regCapture++;                            // discretionary agency-authority surface
      if (el.type === 'TRANSFORMS')                 contractSurface++;                       // dispute-resolution / remediation throughput
      if (el.type === 'SUPPLIES' && lawIsSource)    accessFan++;                             // legal-services distribution fan-out
      // IP reliance also rises with the innovation surface law must protect (FG pattern-node neighbor).
      var otherL = lawIsSource ? el.bi : el.ai;
      if (NODES[otherL] && (NODES[otherL].id === 'technology' || NODES[otherL].id === 'science')) ipReliance += 0.5;
    }
    var litN = Math.min(litigationDep / 3, 1);
    var regN = Math.min(regCapture / 3, 1);
    var conN = Math.min(contractSurface / 3, 1);
    var ipN  = Math.min(ipReliance / 3, 1);
    var accN = Math.min(accessFan / 3, 1);
    // Map sub-circuit signals onto canonical stress channels (no new channel added —
    // mirroring finance/agriculture so every length-driven loop & total_stress stays
    // validated): legal = the aggregate legal-system load (max over sub-circuits),
    // ops = throughput (litigation/contract), people = legal-services labor scarcity.
    sv.legal  = Math.min(Math.max(sv.legal, litN, regN, conN, ipN, accN), 1);
    sv.ops    = Math.min(Math.max(sv.ops, litN, conN), 1);
    sv.people = Math.min(Math.max(sv.people, accN), 1);
    // Expose the explicit circuit binding (five legal sub-circuits + real legal anchors).
    // energySignature is 'zero' throughout — legal stress NEVER couples to energy.
    n.law_circuits = {
      civil_litigation:      { stress: litN, pathway: LAW_CIRCUITS.civil_litigation.pathway,      anchors: LAW_CIRCUITS.civil_litigation.anchors },
      criminal_prosecution:  { stress: litN, pathway: LAW_CIRCUITS.criminal_prosecution.pathway,  anchors: LAW_CIRCUITS.criminal_prosecution.anchors },
      regulatory_compliance: { stress: regN, pathway: LAW_CIRCUITS.regulatory_compliance.pathway, anchors: LAW_CIRCUITS.regulatory_compliance.anchors },
      intellectual_property: { stress: ipN,  pathway: LAW_CIRCUITS.intellectual_property.pathway, anchors: LAW_CIRCUITS.intellectual_property.anchors },
      access_to_justice:     { stress: accN, pathway: LAW_CIRCUITS.access_to_justice.pathway,     anchors: LAW_CIRCUITS.access_to_justice.anchors },
      energySignature: 'zero (legal labor + legal-tech + court infrastructure — never energy demand)',
      sub_circuits: [
        {
          key: 'litigation',
          label: LAW_SUB_CIRCUITS.litigation.label,
          stress: litN,
          pathway: LAW_SUB_CIRCUITS.litigation.pathway,
          energySignature: LAW_SUB_CIRCUITS.litigation.energySignature,
          scalingModel: LAW_SUB_CIRCUITS.litigation.scalingModel,
          anchors: LAW_SUB_CIRCUITS.litigation.anchors
        },
        {
          key: 'regulatory',
          label: LAW_SUB_CIRCUITS.regulatory.label,
          stress: regN,
          pathway: LAW_SUB_CIRCUITS.regulatory.pathway,
          energySignature: LAW_SUB_CIRCUITS.regulatory.energySignature,
          scalingModel: LAW_SUB_CIRCUITS.regulatory.scalingModel,
          anchors: LAW_SUB_CIRCUITS.regulatory.anchors
        },
        {
          key: 'contract_enforcement',
          label: LAW_SUB_CIRCUITS.contract_enforcement.label,
          stress: conN,
          pathway: LAW_SUB_CIRCUITS.contract_enforcement.pathway,
          energySignature: LAW_SUB_CIRCUITS.contract_enforcement.energySignature,
          scalingModel: LAW_SUB_CIRCUITS.contract_enforcement.scalingModel,
          anchors: LAW_SUB_CIRCUITS.contract_enforcement.anchors
        },
        {
          key: 'intellectual_property',
          label: LAW_SUB_CIRCUITS.intellectual_property.label,
          stress: ipN,
          pathway: LAW_SUB_CIRCUITS.intellectual_property.pathway,
          energySignature: LAW_SUB_CIRCUITS.intellectual_property.energySignature,
          scalingModel: LAW_SUB_CIRCUITS.intellectual_property.scalingModel,
          anchors: LAW_SUB_CIRCUITS.intellectual_property.anchors
        },
        {
          key: 'legal_services',
          label: LAW_SUB_CIRCUITS.legal_services.label,
          stress: accN,
          pathway: LAW_SUB_CIRCUITS.legal_services.pathway,
          energySignature: LAW_SUB_CIRCUITS.legal_services.energySignature,
          scalingModel: LAW_SUB_CIRCUITS.legal_services.scalingModel,
          anchors: LAW_SUB_CIRCUITS.legal_services.anchors
        }
      ]
    };
  }
  // ── ADDITIVE: agriculture gets four explicit, non-overlapping sub-circuits
  //    (crop / livestock / commodity-trading / farm-finance) so stress is no longer
  //    rendered as a single blurry 'nourishment' aggregate. For the agriculture node
  //    only, derive each sub-circuit's stress from edge topology (no fabricated
  //    numbers): the same structural signals already present in the connectome.
  //      • crop production  ← outbound SUPPLIES edges (food/feed fan-out to the system)
  //      • livestock        ← inbound DEPENDS_ON edges (feed/water/logistics reliance)
  //      • commodity trading← TRANSFORMS edges (price/processing/re-intermediation surface)
  //      • farm finance     ← CONTROLS edges (regulated / collateralized / credit-governed surface)
  //    Expose the explicit circuit binding (four ag circuits + real tickers) on the
  //    node for downstream advisory layers and visualization, so drought → crop circuit
  //    failure → commodity-trading (prices spike) → farm-finance (credit tightens) can
  //    pulse through the correct sub-circuit pathway, not the whole domain at once.
  //    Energy is ONLY a coupling (machinery/logistics power DEMAND), never agriculture's
  //    own content — agriculture_circuits stays inert for every non-agriculture node.
  if (n.id === 'agriculture') {
    var cropFan = 0, livestockDep = 0, tradeSurface = 0, creditSurface = 0;
    for (var ae = 0; ae < EDGES.length; ae++) {
      var ea = EDGES[ae];
      if (ea.ai !== idx && ea.bi !== idx) continue;
      var agIsSource = (ea.ai === idx);
      if (ea.type === 'SUPPLIES' && agIsSource)    cropFan++;          // food/feed fan-out (seeding → harvest)
      if (ea.type === 'DEPENDS_ON' && !agIsSource) livestockDep++;     // feed/water/logistics reliance
      if (ea.type === 'DEPENDS_ON' && agIsSource)  livestockDep += 0.5; // own input dependencies
      if (ea.type === 'TRANSFORMS')                tradeSurface++;      // price/processing/hedging surface
      if (ea.type === 'CONTROLS')                  creditSurface++;     // regulated/collateralized credit surface
      if (ea.type === 'SUPPLIES' && agIsSource)    tradeSurface += 0.5; // downstream exposure widens basis risk
    }
    var cropN  = Math.min(cropFan / 3, 1);
    var liveN  = Math.min(livestockDep / 3, 1);
    var tradeN = Math.min(tradeSurface / 4, 1);
    var credN  = Math.min(creditSurface / 3, 1);
    // Map sub-circuit signals onto canonical stress channels (no new channel added,
    // mirroring finance — keeps every length-driven loop & total_stress validated):
    //   crop → demand (throughput) | livestock → ops | trading → liquidity (price flow)
    //   farm-finance → solvency (collateral/credit)
    sv.demand    = Math.min(Math.max(sv.demand, cropN), 1);
    sv.ops       = Math.min(Math.max(sv.ops, liveN), 1);
    sv.liquidity = Math.min(Math.max(sv.liquidity, tradeN), 1);
    sv.solvency  = Math.min(Math.max(sv.solvency, credN), 1);
    // Expose the explicit circuit binding (four ag circuits + sub-circuits + real tickers).
    n.agriculture_circuits = {
      crop_production:      { stress: cropN,  pathway: AGRICULTURE_CIRCUITS.crop_production.pathway,      anchors: AGRICULTURE_CIRCUITS.crop_production.anchors },
      livestock_production: { stress: liveN,  pathway: AGRICULTURE_CIRCUITS.livestock_production.pathway, anchors: AGRICULTURE_CIRCUITS.livestock_production.anchors },
      commodity_trading:    { stress: tradeN, pathway: AGRICULTURE_CIRCUITS.commodity_trading.pathway,    anchors: AGRICULTURE_CIRCUITS.commodity_trading.anchors },
      farm_finance:         { stress: credN,  pathway: AGRICULTURE_CIRCUITS.farm_finance.pathway,         anchors: AGRICULTURE_CIRCUITS.farm_finance.anchors }
    };
    // Segregated sub-circuits with DISTINCT energy signatures (machinery/logistics
    // coupling) so energy-demand modeling differentiates crop (seasonal industrial
    // power) vs livestock (trade-logistics baseline + processing burst) vs trading
    // (zero energy) vs finance (input-cost-indexed) instead of one generic load.
    n.agriculture_circuits.sub_circuits = {
      crop: {
        label: AGRICULTURE_SUB_CIRCUITS.crop.label,
        stress: cropN,
        pathway: AGRICULTURE_SUB_CIRCUITS.crop.pathway,
        energySignature: AGRICULTURE_SUB_CIRCUITS.crop.energySignature,
        scalingModel: AGRICULTURE_SUB_CIRCUITS.crop.scalingModel,
        anchors: AGRICULTURE_SUB_CIRCUITS.crop.anchors
      },
      livestock: {
        label: AGRICULTURE_SUB_CIRCUITS.livestock.label,
        stress: liveN,
        pathway: AGRICULTURE_SUB_CIRCUITS.livestock.pathway,
        energySignature: AGRICULTURE_SUB_CIRCUITS.livestock.energySignature,
        scalingModel: AGRICULTURE_SUB_CIRCUITS.livestock.scalingModel,
        anchors: AGRICULTURE_SUB_CIRCUITS.livestock.anchors
      },
      trading: {
        label: AGRICULTURE_SUB_CIRCUITS.trading.label,
        stress: tradeN,
        pathway: AGRICULTURE_SUB_CIRCUITS.trading.pathway,
        energySignature: AGRICULTURE_SUB_CIRCUITS.trading.energySignature,
        scalingModel: AGRICULTURE_SUB_CIRCUITS.trading.scalingModel,
        anchors: AGRICULTURE_SUB_CIRCUITS.trading.anchors
      },
      finance: {
        label: AGRICULTURE_SUB_CIRCUITS.finance.label,
        stress: credN,
        pathway: AGRICULTURE_SUB_CIRCUITS.finance.pathway,
        energySignature: AGRICULTURE_SUB_CIRCUITS.finance.energySignature,
        scalingModel: AGRICULTURE_SUB_CIRCUITS.finance.scalingModel,
        anchors: AGRICULTURE_SUB_CIRCUITS.finance.anchors
      }
    };
  }
  n.stress_vector = sv;
  n.total_stress = computeTotalStress(sv);
}

function computeUpwardImpact() {
  for (var i = 0; i < NODES.length; i++) NODES[i].upward_impact = 0;
  for (var i = 0; i < EDGES.length; i++) {
    var e = EDGES[i];
    var na = NODES[e.ai], nb = NODES[e.bi];
    if (na) na.upward_impact += (e.weight || 0.5) * (na.total_stress || 0);
    if (nb) nb.upward_impact += (e.weight || 0.5) * (nb.total_stress || 0);
  }
}

function resize() {
  if (_miniMode) {
    W = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.clientWidth;
    H = canvas.parentElement ? canvas.parentElement.clientHeight : canvas.clientHeight;
  } else {
    W = window.innerWidth;
    H = window.innerHeight;
  }
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX = W / 2; CY = H / 2;
  generateNoise(); generateBgParticles(); generateWanderers();
}

function generateNoise() {
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = W; noiseCanvas.height = H;
  var nc = noiseCanvas.getContext('2d');
  var id = nc.createImageData(W, H);
  var d = id.data;
  for (var i = 0; i < d.length; i += 4) {
    d[i] = d[i+1] = d[i+2] = Math.random() * 255;
    d[i+3] = Math.random() < 0.4 ? 6 : 0;
  }
  nc.putImageData(id, 0, 0);
}

function generateBgParticles() {
  bgParticles = [];
  var count = _miniMode ? 40 : 120;
  for (var i = 0; i < count; i++) bgParticles.push({
    x: Math.random()*W, y: Math.random()*H,
    r: 0.4 + Math.random()*0.4, a: 0.05 + Math.random()*0.05
  });
}

function generateWanderers() {
  wanderers = [];
  var count = _miniMode ? 5 : 15;
  for (var i = 0; i < count; i++) {
    var crossFrames = (20 + Math.random()*20) * 60;
    var spd = Math.max(W,H) / crossFrames;
    var ang = Math.random() * Math.PI * 2;
    wanderers.push({ x:Math.random()*W, y:Math.random()*H, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd });
  }
}

// === LOCKED FIBONACCI SPIRAL LAYOUT ===
function spiralLayout(nodes) {
  spiralMaxR = Math.min(W, H) * 0.44;
  var last = Math.max(nodes.length - 1, 1);
  for (var i = 0; i < nodes.length; i++) {
    var r = spiralMaxR * (0.38 + 0.62 * (i / last));
    var theta = i * GOLDEN_ANGLE;
    nodes[i].x = r * Math.cos(theta);
    nodes[i].y = r * Math.sin(theta);
  }
}

// === SPIRAL GUIDE ARC ===
function drawSpiralGuide(fa) {
  if (spiralMaxR <= 0 || NODES.length < 2) return;
  var last = NODES.length - 1;
  ctx.beginPath();
  for (var i = 0; i <= 600; i++) {
    var st = (i / 600) * (last + 0.5);
    var r = (st / last) * spiralMaxR;
    var theta = st * GOLDEN_ANGLE + spiralAngle;
    var sp = w2s(r * Math.cos(theta), r * Math.sin(theta));
    if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
  }
  ctx.strokeStyle = 'rgba(140,170,200,' + (0.06 * fa) + ')';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// === MASTER BRAIN CENTRAL SUN (visual only) ===
// Renders the executive / metacognitive center of gravity at world origin.
// Layer order (outer -> inner): halo glow, Civilization observatory ring, sun core.
// No hit-test, no click target, no navigation side-effect.
function drawMasterBrainSun(fa) {
  var c = w2s(0, 0);
  var sunR  = 30 * camZ;
  var ringR = sunR * 2.1;
  var haloR = sunR * 3.4;

  var halo = ctx.createRadialGradient(c.x, c.y, sunR * 0.6, c.x, c.y, haloR);
  halo.addColorStop(0,    'rgba(234,216,166,' + (0.22 * fa) + ')');
  halo.addColorStop(0.55, 'rgba(201,169,78,'  + (0.08 * fa) + ')');
  halo.addColorStop(1,    'rgba(201,169,78,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c.x, c.y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c.x, c.y, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(140,170,200,' + (0.28 * fa) + ')';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  var core = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, sunR);
  core.addColorStop(0,    'rgba(255,245,220,' + (0.95 * fa) + ')');
  core.addColorStop(0.45, 'rgba(234,216,166,' + (0.75 * fa) + ')');
  core.addColorStop(1,    'rgba(201,169,78,'  + (0.18 * fa) + ')');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(c.x, c.y, sunR, 0, Math.PI * 2);
  ctx.fill();
}

// Sun hit-test: screen-space disc within the Civilization observatory ring.
function hitSun(mx, my) {
  var c = w2s(0, 0);
  var hitR = 30 * camZ * 2.1;
  var dx = mx - c.x, dy = my - c.y;
  return dx * dx + dy * dy < hitR * hitR;
}

// === SEQUENTIAL SPINE PULSE ===
function drawSpinePulse(fa) {
  if (NODES.length < 2 || spiralMaxR <= 0) return;
  var last = NODES.length - 1;
  var hopMs = 1200;
  var totalMs = NODES.length * hopMs;
  var now = performance.now();
  var segProg = ((now % totalMs) / hopMs);
  var segIdx = Math.floor(segProg) % NODES.length;
  var frac = segProg - Math.floor(segProg);
  var px, py;
  if (segIdx < NODES.length - 1) {
    var _a = NODES[segIdx], _b = NODES[segIdx + 1];
    px = _a.x + (_b.x - _a.x) * frac;
    py = _a.y + (_b.y - _a.y) * frac;
  } else {
    var fromN = NODES[NODES.length - 1];
    var toN = NODES[0];
    px = fromN.x + (toN.x - fromN.x) * frac;
    py = fromN.y + (toN.y - fromN.y) * frac;
  }
  var sp = w2s(px, py);
  var fadeA = 1;
  if (frac < 0.1) fadeA = frac / 0.1;
  else if (frac > 0.9) fadeA = (1 - frac) / 0.1;
  // Color the spine pulse by the current node's phase
  var spineNode = NODES[segIdx % NODES.length];
  var spC = spineNode ? (PHASE_PULSE_COLORS[spineNode.phase] || {r:200,g:230,b:255}) : {r:200,g:230,b:255};
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, 2 * camZ, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba('+spC.r+','+spC.g+','+spC.b+',' + (0.9 * fadeA * fa) + ')';
  ctx.fill();
  // Bright core
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, 0.8 * camZ, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * fadeA * fa) + ')';
  ctx.fill();
}

function buildLifecycleEdges() {
  EDGES = [];
  // Spine: 19 sequential edges following node order
  var spine = [
    [0,1,'CONTROLS'],[1,2,'SUPPLIES'],[2,3,'DEPENDS_ON'],[3,4,'SUPPLIES'],
    [4,5,'SUPPLIES'],[5,6,'TRANSFORMS'],[6,7,'TRANSFORMS'],[7,8,'SUPPLIES'],
    [8,9,'SUPPLIES'],[9,10,'SUPPLIES'],[10,11,'TRANSFORMS'],[11,12,'DEPENDS_ON'],
    [12,13,'DEPENDS_ON'],[13,14,'TRANSFORMS'],[14,15,'CONTROLS'],[15,16,'SUPPLIES'],
    [16,17,'DEPENDS_ON'],[17,18,'CONTROLS'],[18,19,'SUPPLIES']
  ];
  // Cross-links: thematic connections between non-adjacent domains
  var cross = [
    [19,0,'SUPPLIES',0.8],   // Intelligence -> Governance (closing loop)
    [3,5,'SUPPLIES',0.7],    // Energy -> Industry
    [6,9,'TRANSFORMS',0.8],  // Science -> Technology
    [8,6,'SUPPLIES',0.7],    // Education -> Science
    [17,0,'CONTROLS',0.8],   // Law -> Governance
    [18,1,'CONTROLS',0.8],   // Finance -> Economy
    [7,15,'SUPPLIES',0.7],   // Medicine -> Population
    [4,15,'SUPPLIES',0.8],   // Agriculture -> Population
    [19,12,'SUPPLIES',0.8],  // Intelligence -> Defense
    [13,3,'DEPENDS_ON',0.7], // Environment -> Energy
    [9,18,'SUPPLIES',0.6]    // Technology -> Finance
  ];
  for (var i=0;i<spine.length;i++) EDGES.push({ai:spine[i][0],bi:spine[i][1],type:spine[i][2],weight:0.7,color:EDGE_COLORS[spine[i][2]],chain:true});
  for (var i=0;i<cross.length;i++) EDGES.push({ai:cross[i][0],bi:cross[i][1],type:cross[i][2],weight:cross[i][3],color:EDGE_COLORS[cross[i][2]],chain:false});
}

function enforceDegreeCap() {
  var changed = true;
  while (changed) { changed = false;
    var deg = {}; for (var i=0;i<NODES.length;i++) deg[i]=0;
    for (var i=0;i<EDGES.length;i++) { deg[EDGES[i].ai]++; deg[EDGES[i].bi]++; }
    for (var i=0;i<NODES.length;i++) if (deg[i]>4) {
      var worst=-1, worstW=Infinity;
      for (var j=0;j<EDGES.length;j++) if (!EDGES[j].chain && (EDGES[j].ai===i||EDGES[j].bi===i) && EDGES[j].weight<worstW) { worstW=EDGES[j].weight; worst=j; }
      if (worst>=0) { EDGES.splice(worst,1); changed=true; break; }
    }
  }
}

function computeSizing() {
  neighborMap = {};
  var deg = {};
  for (var i=0;i<NODES.length;i++) { deg[i]=0; neighborMap[i]={}; }
  for (var i=0;i<EDGES.length;i++) {
    var a=EDGES[i].ai, b=EDGES[i].bi;
    if (a>=0&&b>=0) { deg[a]++; deg[b]++; neighborMap[a][b]=true; neighborMap[b][a]=true; }
  }
  for (var i=0;i<NODES.length;i++) {
    var w = NODES[i].dataWeight;
    var d = Math.max(deg[i], 1);
    NODES[i].r = 4 + (w * 3) * Math.sqrt(d);
    NODES[i].degree = deg[i];
  }
  var k = Math.max(Math.ceil(EDGES.length * 0.4), 3);
  var sorted = [];
  for (var i = 0; i < EDGES.length; i++) sorted.push({idx: i, w: EDGES[i].weight});
  sorted.sort(function(a, b) { return b.w - a.w; });
  topKSet = {};
  for (var i = 0; i < Math.min(k, sorted.length); i++) topKSet[sorted[i].idx] = true;
}

function generateSatellites() {
  satellites = [];
  for (var i=0;i<NODES.length;i++) {
    var n = NODES[i], w = n.dataWeight;
    var count;
    if (_miniMode) {
      count = 1 + Math.floor(Math.random() * 2);
    } else {
      count = w >= 0.85 ? (8+Math.floor(Math.random()*4)) : w >= 0.65 ? (5+Math.floor(Math.random()*3)) : (2+Math.floor(Math.random()*3));
    }
    var placed = [];
    for (var j=0;j<count;j++) {
      var sx,sy,att=0;
      do { var ang=Math.random()*Math.PI*2, dist=14+Math.random()*16;
        sx=Math.cos(ang)*dist; sy=Math.sin(ang)*dist;
        var bad=false;
        for (var k=0;k<placed.length;k++) { var dx=sx-placed[k].ox,dy=sy-placed[k].oy; if (Math.sqrt(dx*dx+dy*dy)<6){bad=true;break;} }
        att++;
      } while (bad && att<20);
      var sat = { parentIdx:i, ox:sx, oy:sy, r:1+Math.random(), opacity:0.12+Math.random()*0.1,
        driftAngle:Math.random()*Math.PI*2, driftAmp:3, driftPeriod:6+Math.random()*6 };
      placed.push(sat); satellites.push(sat);
    }
  }
}

function generateActionPotentials() {
  actionPotentials = [];
  for (var i=0;i<EDGES.length;i++) {
    var e = EDGES[i];
    var neural = EDGE_NEURAL_MAP[e.type] || EDGE_NEURAL_MAP.SUPPLIES;
    var pulseCount = neural.myelinated ? 3 : 2;
    for (var j=0;j<pulseCount;j++) {
      // Compute phase color from connected nodes
      var na = NODES[e.ai], nb = NODES[e.bi];
      var phaseA = na ? na.phase : 'P0', phaseB = nb ? nb.phase : 'P0';
      var ca = PHASE_PULSE_COLORS[phaseA] || PHASE_PULSE_COLORS.P0;
      var cb = PHASE_PULSE_COLORS[phaseB] || PHASE_PULSE_COLORS.P0;
      var blendColor = {r:Math.round((ca.r+cb.r)/2), g:Math.round((ca.g+cb.g)/2), b:Math.round((ca.b+cb.b)/2)};

      var sMin = neural.speedRange[0], sMax = neural.speedRange[1];
      actionPotentials.push({
        edgeIdx:i, offset:Math.random(),
        speed: sMin + Math.random() * (sMax - sMin),
        myelinated: neural.myelinated,
        brightness: neural.brightness,
        color: blendColor,
        size: neural.myelinated ? (0.8 + Math.random()*0.6) : (1.2 + Math.random()*1.0)
      });
    }
  }
}

function loadData() {
  fetch('assets/data/civilization.top.json')
    .then(function(r){return r.json()})
    .then(function(data){DATA=data;buildGraph(data)})
    .catch(function(){buildFallback()});
}

function buildGraph(data) {
  NODES = [];
  for (var i=0;i<data.nodes.length;i++) {
    var n = data.nodes[i];
    var dw = typeof n.weight==='number' ? n.weight : (HUB_WEIGHTS[n.id]!==undefined ? HUB_WEIGHTS[n.id] : 0.4);
    NODES.push({ id:n.id, label:n.label, description:n.description, childUniverse:n.childUniverse,
      addr:n.addr, group:n.group, phaseColor:hexToRgb(NODE_COLORS[n.id]||'#B4C8DC'),
      phaseHex:NODE_COLORS[n.id]||'#B4C8DC', phase:((window.LIMENPhaseAnnotations&&window.LIMENPhaseAnnotations[n.id])?window.LIMENPhaseAnnotations[n.id].phase.toUpperCase():(NODE_PHASES[n.id]||'P0')), dataWeight:dw, x:0, y:0, tx:0, ty:0, r:6, degree:0,
      phase_vector:{}, dominant_phase:'', stress_vector:{legal:0,liquidity:0,funding:0,solvency:0,demand:0,ops:0,people:0}, total_stress:0, instability:0, upward_impact:0 });
  }
  buildLifecycleEdges(); enforceDegreeCap(); computeSizing();
  for (var i = 0; i < NODES.length; i++) {
    NODES[i].phase_vector = initPhaseVector(NODES[i].phase);
    NODES[i].dominant_phase = getDominantPhase(NODES[i].phase_vector);
    NODES[i].instability = computeInstability(NODES[i].phase_vector);
    seedStressCivilization(NODES[i], i);
  }
  computeUpwardImpact();
  spiralLayout(NODES);
  generateSatellites(); generateActionPotentials();
  entryFadeStart = performance.now();
  applyFocusDomain();
}

function buildFallback() {
  var ids=['governance','economy','infrastructure','energy','agriculture','industry','science','medicine','education','technology','communication','culture','defense','environment','religion','population','trade','law','finance','intelligence'];
  var labels=['Governance','Economy','Infrastructure','Energy','Agriculture','Industry','Science','Medicine','Education','Technology','Communication','Culture','Defense','Environment','Religion / Symbolic Systems','Population / Demographics','Trade & Logistics','Law & Regulation','Finance','Intelligence & Data'];
  var descs=['State authority, executive, legislative, judicial functions.','Production, consumption, GDP, labor markets, monetary systems.','Built environment, utilities, transport networks, urban planning.','Generation, distribution, fossil fuels, renewables, nuclear.','Crop production, livestock, aquaculture, food processing.','Manufacturing, materials processing, fabrication, chemistry.','Research institutions, basic and applied science, peer review.','Healthcare delivery, pharmaceuticals, public health, biotech.','K-12, higher education, vocational training, knowledge transfer.','Computing, AI, software, hardware, cybersecurity, digital infra.','Media, telecommunications, internet, broadcasting, info flow.','Arts, humanities, heritage, entertainment, social identity.','Military, national security, strategic deterrence, civil defense.','Ecosystems, biodiversity, climate systems, conservation.','Theology, spiritual institutions, philosophical frameworks.','Birth rates, migration, aging, urbanization, labor force.','Supply chains, freight, shipping, customs, international commerce.','Legal codes, regulatory bodies, enforcement, compliance.','Banking, capital markets, insurance, investment, credit systems.','Data collection, analytics, national intelligence, surveillance.'];
  NODES = [];
  for (var i=0;i<20;i++) {
    var dw = HUB_WEIGHTS[ids[i]]!==undefined ? HUB_WEIGHTS[ids[i]] : 0.5;
    NODES.push({ id:ids[i], label:labels[i], description:descs[i], childUniverse:ids[i],
      addr:'civilization.'+ids[i], group:ids[i], phaseColor:hexToRgb(NODE_COLORS[ids[i]]||'#B4C8DC'),
      phaseHex:NODE_COLORS[ids[i]]||'#B4C8DC', phase:((window.LIMENPhaseAnnotations&&window.LIMENPhaseAnnotations[ids[i]])?window.LIMENPhaseAnnotations[ids[i]].phase.toUpperCase():(NODE_PHASES[ids[i]]||'P0')), dataWeight:dw, x:0, y:0, tx:0, ty:0, r:6, degree:0,
      phase_vector:{}, dominant_phase:'', stress_vector:{legal:0,liquidity:0,funding:0,solvency:0,demand:0,ops:0,people:0}, total_stress:0, instability:0, upward_impact:0 });
  }
  buildLifecycleEdges(); enforceDegreeCap(); computeSizing();
  for (var i = 0; i < NODES.length; i++) {
    NODES[i].phase_vector = initPhaseVector(NODES[i].phase);
    NODES[i].dominant_phase = getDominantPhase(NODES[i].phase_vector);
    NODES[i].instability = computeInstability(NODES[i].phase_vector);
    seedStressCivilization(NODES[i], i);
  }
  computeUpwardImpact();
  spiralLayout(NODES);
  generateSatellites(); generateActionPotentials();
  entryFadeStart = performance.now();
  applyFocusDomain();
}

function applyFocusDomain() {
  if (!_focusDomain) return;
  for (var i = 0; i < NODES.length; i++) {
    if (NODES[i].id === _focusDomain) {
      hoveredNode = i;
      break;
    }
  }
}

function w2s(wx,wy) { return {x:(wx-camX)*camZ+CX, y:(wy-camY)*camZ+CY}; }

function hitTest(mx,my) {
  for (var i=NODES.length-1;i>=0;i--) {
    var p=w2s(NODES[i].x,NODES[i].y), dx=mx-p.x, dy=my-p.y;
    var hitR=Math.max(NODES[i].r+12,20)*camZ;
    if (dx*dx+dy*dy < hitR*hitR) return i;
  }
  return -1;
}

// === LAYER 3: BACKGROUND ===
function drawBackground() {
  var maxR = Math.sqrt(CX*CX+CY*CY);
  ctx.clearRect(0,0,W,H); // transparent — the galaxy photo backdrop shows through
  if (noiseCanvas) { ctx.globalAlpha=0.03; ctx.drawImage(noiseCanvas,0,0); ctx.globalAlpha=1; }
  for (var i=0;i<bgParticles.length;i++) {
    var bp=bgParticles[i]; ctx.beginPath(); ctx.arc(bp.x,bp.y,bp.r,0,Math.PI*2);
    ctx.fillStyle='rgba(139,184,212,'+bp.a+')'; ctx.fill();
  }
  for (var i=0;i<wanderers.length;i++) {
    var wp=wanderers[i]; wp.x+=wp.vx; wp.y+=wp.vy;
    if(wp.x<0||wp.x>W){wp.vx*=-1;wp.x=Math.max(0,Math.min(W,wp.x));}
    if(wp.y<0||wp.y>H){wp.vy*=-1;wp.y=Math.max(0,Math.min(H,wp.y));}
    ctx.beginPath(); ctx.arc(wp.x,wp.y,1,0,Math.PI*2);
    ctx.fillStyle='rgba(100,150,180,0.15)'; ctx.fill();
  }
}

function drawVignette() {
  var maxR=Math.sqrt(CX*CX+CY*CY);
  var grad=ctx.createRadialGradient(CX,CY,maxR*0.75,CX,CY,maxR);
  grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
}

function drawWatermark() {
  ctx.save(); ctx.font='500 '+Math.max(10,W*0.011)+'px monospace';
  ctx.textAlign='center'; ctx.fillStyle='rgba(140,170,200,0.025)';
  ctx.fillText('CIVILIZATION \u00b7 DOMAIN CONNECTOME \u00b7 20 SECTORS',CX,CY); ctx.restore();
}

// === SATELLITES ===
function drawSatellites(fa) {
  for (var i=0;i<satellites.length;i++) {
    var s=satellites[i], n=NODES[s.parentIdx]; if(!n) continue;
    var dp=(t/s.driftPeriod)*Math.PI*2;
    var drift=Math.sin(dp+s.driftAngle)*s.driftAmp;
    var dX=Math.cos(s.driftAngle)*drift, dY=Math.sin(s.driftAngle)*drift;
    var sp=w2s(n.x+s.ox+dX, n.y+s.oy+dY);
    ctx.beginPath(); ctx.arc(sp.x,sp.y,s.r*camZ,0,Math.PI*2);
    ctx.fillStyle='rgba(140,170,200,'+(s.opacity*fa)+')'; ctx.fill();
  }
}


// === NEURAL IMPULSE PARTICLES — phase-colored, biologically accurate ===
function drawActionPotentials(fa) {
  for (var i=0;i<actionPotentials.length;i++) {
    var ap=actionPotentials[i], e=EDGES[ap.edgeIdx]; if(!e) continue;
    var na=NODES[e.ai], nb=NODES[e.bi]; if(!na||!nb) continue;
    var pa=w2s(na.x,na.y), pb=w2s(nb.x,nb.y);
    var mx2=(pa.x+pb.x)/2, my2=(pa.y+pb.y)/2;
    var ddx=pb.x-pa.x, ddy=pb.y-pa.y, len=Math.sqrt(ddx*ddx+ddy*ddy)||1;
    var nx2=-ddy/len, ny2=ddx/len;
    var bend=35*camZ;
    var cx1=mx2+nx2*bend, cy1=my2+ny2*bend;
    var prog=((t*ap.speed)+ap.offset)%1;
    var mt=1-prog;
    var px=mt*mt*pa.x+2*mt*prog*cx1+prog*prog*pb.x;
    var py=mt*mt*pa.y+2*mt*prog*cy1+prog*prog*pb.y;
    var fadeA; if(prog<0.15) fadeA=prog/0.15; else if(prog>0.85) fadeA=(1-prog)/0.15; else fadeA=1;
    var c = ap.color;
    var alpha = fadeA * fa * ap.brightness;
    var sz = ap.size * camZ;

    if (ap.myelinated) {
      // Myelinated: sharp spark with bright core
      ctx.beginPath(); ctx.arc(px,py,sz,0,Math.PI*2);
      ctx.fillStyle='rgba('+c.r+','+c.g+','+c.b+','+alpha+')'; ctx.fill();
      if (alpha > 0.3) {
        ctx.beginPath(); ctx.arc(px,py,sz*0.35,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,'+(alpha*0.5)+')'; ctx.fill();
      }
    } else {
      // Unmyelinated: diffuse glow
      var glowR = sz * 2.5;
      var grad = ctx.createRadialGradient(px,py,0,px,py,glowR);
      grad.addColorStop(0,'rgba('+c.r+','+c.g+','+c.b+','+(alpha*0.7)+')');
      grad.addColorStop(0.5,'rgba('+c.r+','+c.g+','+c.b+','+(alpha*0.25)+')');
      grad.addColorStop(1,'rgba('+c.r+','+c.g+','+c.b+',0)');
      ctx.beginPath(); ctx.arc(px,py,glowR,0,Math.PI*2);
      ctx.fillStyle=grad; ctx.fill();
    }
  }
}

// === NODE RENDERING ===
function drawNode(n, idx, nodeAlpha) {
  var p=w2s(n.x,n.y), isH=idx===hoveredNode;
  var r=n.r*camZ, pc=getPhaseColor(n), a=nodeAlpha;
  // L1 cortex view: +15% brightness boost — ambient glow always present
  var ambR = r * 2.2;
  var ambG = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,ambR);
  ambG.addColorStop(0,'rgba('+pc.r+','+pc.g+','+pc.b+','+(0.08*a)+')');
  ambG.addColorStop(1,'rgba('+pc.r+','+pc.g+','+pc.b+',0)');
  ctx.beginPath(); ctx.arc(p.x,p.y,ambR,0,Math.PI*2); ctx.fillStyle=ambG; ctx.fill();
  if (isH) {
    var gR=r*3, gg=ctx.createRadialGradient(p.x,p.y,r*0.5,p.x,p.y,gR);
    gg.addColorStop(0,'rgba(180,220,255,'+(0.4*a)+')'); gg.addColorStop(1,'rgba(180,220,255,0)');
    ctx.beginPath(); ctx.arc(p.x,p.y,gR,0,Math.PI*2); ctx.fillStyle=gg; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle='rgba(20,28,40,'+(0.9*a)+')'; ctx.fill();
  // Inner gradient — boosted from 0.25 -> 0.30
  var ig=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
  ig.addColorStop(0,'rgba('+pc.r+','+pc.g+','+pc.b+','+(0.30*a)+')');
  ig.addColorStop(1,'rgba('+pc.r+','+pc.g+','+pc.b+',0)');
  ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fillStyle=ig; ctx.fill();
  // Border stroke — boosted from 0.2 -> 0.25
  ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.strokeStyle='rgba('+pc.r+','+pc.g+','+pc.b+','+((isH?0.55:0.25)*a)+')';
  ctx.lineWidth=0.5; ctx.stroke();
  // Layer 2: stress ring segments
  drawStressRing(p.x, p.y, r, n, a);
  if (n.childUniverse) {
    ctx.font=(6*camZ)+'px monospace'; ctx.textAlign='center';
    ctx.fillStyle='rgba(180,200,220,'+(0.45*a)+')';
    ctx.fillText('\u25be',p.x,p.y+r+(3*camZ));
  }
  {
    var lSz=isH?8:7, lA=isH?0.95:0.55;
    ctx.font=(lSz*camZ)+'px monospace'; ctx.textAlign='center';
    ctx.fillStyle='rgba(180,200,220,'+(lA*a)+')';
    var sn=SHORT_NAMES[n.id]||n.id;
    var lY=n.childUniverse?(p.y+r+(12*camZ)):(p.y+r+(9*camZ));
    ctx.fillText(sn, p.x, lY);
  }
}

// === TOOLTIP ===
function showTooltip(idx,mx,my) {
  if (_miniMode) return;
  var n=NODES[idx];
  _ttPhase.textContent=NODE_TAGLINES[n.id]||'';
  _ttPhase.style.color=n.phaseHex; _ttName.textContent=n.label; _ttTagline.textContent=n.description;
  if(_ttCounts){ var _c=_DOMAIN_COUNTS[n.id];
    _ttCounts.innerHTML = _c ? ('<b>'+_c.p.toLocaleString()+'</b> portals &middot; <b>'+_c.dx.toLocaleString()+'</b> diagnoses &middot; <b>'+_c.tx.toLocaleString()+'</b> treatments') : ''; }
  var ttE=document.getElementById('ttEnter');
  if(DOMAIN_PORTALS[n.id]) ttE.textContent='View portals \u2192';
  else if(n.childUniverse && PORTAL_ROUTES[n.childUniverse]) ttE.textContent='Enter portal \u2192';
  else ttE.textContent='Portal coming soon';
  _tooltip.style.display='block';
  var tw=_tooltip.offsetWidth, th=_tooltip.offsetHeight;
  var tx=mx+20, ty=my-10;
  if(tx+tw>W-10) tx=mx-tw-20; if(ty+th>H-10) ty=H-th-10; if(ty<10) ty=10;
  _tooltip.style.left=tx+'px'; _tooltip.style.top=ty+'px';
}
function hideTooltip() { if (_miniMode || !_tooltip) return; _tooltip.style.display='none'; }

function showSubMenu(idx) {
  if (_miniMode) return;
  var n = NODES[idx], subs = DOMAIN_PORTALS[n.id];
  var p = w2s(n.x, n.y);
  var html = '<div class="sm-title">' + (SHORT_NAMES[n.id]||n.id) + '</div>';
  var domainUrl = PORTAL_ROUTES[n.childUniverse];
  if (domainUrl) html += '<a class="sm-main" href="'+domainUrl+'">'+n.label+' Portal &rarr;</a>';
  html += '<div class="sm-sep"></div>';
  for (var i = 0; i < subs.length; i++) html += '<a href="'+subs[i].url+'">'+subs[i].name+'</a>';
  _subMenu.innerHTML = html;
  _subMenu.style.display = 'block';
  var mx = p.x + 20, my = p.y - 10;
  var mw = _subMenu.offsetWidth, mh = _subMenu.offsetHeight;
  if (mx + mw > W - 10) mx = p.x - mw - 20;
  if (my + mh > H - 10) my = H - mh - 10;
  if (my < 10) my = 10;
  _subMenu.style.left = mx + 'px'; _subMenu.style.top = my + 'px';
}
function hideSubMenu() { if (_miniMode || !_subMenu) return; _subMenu.style.display = 'none'; }

function navigateToUniverse(idx) {
  var n=NODES[idx]; if(!n||!n.childUniverse) return;
  if (_onNodeClick) { _onNodeClick(n); return; }
  if (_miniMode) { window.location.href = '/connectome.html'; return; }
  if (DOMAIN_PORTALS[n.id]) { hideTooltip(); showSubMenu(idx); return; }
  var targetUrl = PORTAL_ROUTES[n.childUniverse];
  if (!targetUrl) return;
  if (window.LIMENUIState) window.LIMENUIState.save({ focusDomain: n.id, navigatedAt: Date.now() });
  transitioning=true; transitionStart=performance.now();
  transitionTarget=n; clickFadeNode=idx;
  canvas.style.cursor='default';
  canvas.style.transition='opacity 150ms';
  canvas.style.opacity='0';
  setTimeout(function() { window.location.href = targetUrl; }, 150);
}
function checkTransition() {}

// === MAIN DRAW LOOP ===
function draw() {
  t += 0.016;
  spiralAngle += spiralSpeed;
  if (!_miniMode) {
    camX+=(targetX-camX)*0.08; camY+=(targetY-camY)*0.08; camZ+=(targetZ-camZ)*0.08;
  }
  // Rotate civilization nodes around spiral center
  var last = Math.max(NODES.length - 1, 1);
  for (var i = 0; i < NODES.length; i++) {
    var r = spiralMaxR * (0.38 + 0.62 * (i / last));
    if (NODES[i]._spin === undefined) {
      NODES[i]._spin = i * GOLDEN_ANGLE;
      var _rf = 0.38 + 0.62 * (i / last); // orbital radius (fraction): inner 0.38 .. outer 1.0
      NODES[i]._spd = 0.00078 / Math.pow(_rf, 1.5); // Kepler's 3rd law: ω ∝ r^-1.5 (inner orbits faster)
    }
    NODES[i]._spin += NODES[i]._spd;
    var theta = NODES[i]._spin;
    NODES[i].x = r * Math.cos(theta);
    NODES[i].y = r * Math.sin(theta);
  }
  checkTransition();

  var entryA = 1;
  if (entryFadeStart > 0) {
    var ee = performance.now() - entryFadeStart;
    entryA = Math.min(1, ee/400);
    if (ee >= 400) entryFadeStart = -1;
  }

  var transA = 1;
  var fa = entryA * transA;

  drawBackground();
  ctx.globalAlpha = fa;
  drawSpiralGuide(fa);
  drawMasterBrainSun(fa);
  drawWatermark();

  var hoverActive = hoveredNode >= 0;
  var hoverN = {};
  if (hoverActive) { hoverN[hoveredNode]=true; var nm=neighborMap[hoveredNode]; if(nm) for(var k in nm) hoverN[k]=true; }

  drawSatellites(fa);

  drawActionPotentials(fa);
  drawSpinePulse(fa);

  for (var i=0;i<NODES.length;i++) {
    var na = fa;
    if (clickFadeNode>=0 && transitioning && i!==clickFadeNode) {
      var cf=Math.min(1,(performance.now()-transitionStart)/200);
      na *= 1 - cf*0.85;
    }
    if (hoverActive && !hoverN[i]) na *= 0.25;
    drawNode(NODES[i], i, na);
  }

  ctx.globalAlpha = 1;
  drawVignette();
  _animFrameId = requestAnimationFrame(draw);
}

// === EVENT BINDING ===
function bindFullEvents() {
  canvas.addEventListener('mousemove', function(e) {
    var hit=hitTest(e.clientX,e.clientY);
    if(hit!==hoveredNode) {
      hoveredNode=hit;
      if(hit>=0&&NODES[hit].childUniverse&&PORTAL_ROUTES[NODES[hit].childUniverse]) canvas.style.cursor='pointer';
      else if(hitSun(e.clientX,e.clientY)) canvas.style.cursor='pointer';
      else canvas.style.cursor='default';
      if(hit>=0) showTooltip(hit,e.clientX,e.clientY); else hideTooltip();
    } else if(hit>=0) showTooltip(hit,e.clientX,e.clientY);
    if(hit<0){ canvas.style.cursor = hitSun(e.clientX,e.clientY) ? 'pointer' : 'default'; }
    if(isDragging&&dragStart) { targetX-=(e.clientX-dragStart.x)/camZ; targetY-=(e.clientY-dragStart.y)/camZ; dragStart={x:e.clientX,y:e.clientY}; }
  });
  canvas.addEventListener('mousedown', function(e) {
    if(transitioning) return;
    mouseDownPos={x:e.clientX,y:e.clientY};
    dragStart={x:e.clientX,y:e.clientY}; isDragging=true;
  });
  canvas.addEventListener('mouseup', function(e) {
    var wasDrag=false;
    if(mouseDownPos){var dx=e.clientX-mouseDownPos.x,dy=e.clientY-mouseDownPos.y;wasDrag=Math.sqrt(dx*dx+dy*dy)>=5;}
    isDragging=false; dragStart=null; mouseDownPos=null;
    if(!wasDrag&&_subMenu&&_subMenu.style.display==='block'){hideSubMenu();return;}
    if(!wasDrag&&!transitioning){var hit=hitTest(e.clientX,e.clientY);if(hit>=0){hideTooltip();navigateToUniverse(hit);return;}}
    if(hoveredNode>=0&&NODES[hoveredNode].childUniverse&&PORTAL_ROUTES[NODES[hoveredNode].childUniverse]) canvas.style.cursor='pointer';
    else canvas.style.cursor='default';
  });
  canvas.addEventListener('mouseleave', function(){hoveredNode=-1;hideTooltip();isDragging=false;dragStart=null;mouseDownPos=null;});
  canvas.addEventListener('wheel', function(e){e.preventDefault();targetZ=Math.max(0.3,Math.min(5,targetZ*(e.deltaY>0?0.9:1.1)));},{passive:false});

  // === TOUCH ===
  canvas.addEventListener('touchstart', function(e){
    if(transitioning) return;
    if(e.touches.length===1){
      touchStartPos={x:e.touches[0].clientX,y:e.touches[0].clientY};
      dragStart={x:e.touches[0].clientX,y:e.touches[0].clientY}; isDragging=true;
    }
    if(e.touches.length===2){var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;lastTouchDist=Math.sqrt(dx*dx+dy*dy);}
  },{passive:true});
  canvas.addEventListener('touchmove', function(e){e.preventDefault();
    if(e.touches.length===1&&isDragging&&dragStart){targetX-=(e.touches[0].clientX-dragStart.x)/camZ;targetY-=(e.touches[0].clientY-dragStart.y)/camZ;dragStart={x:e.touches[0].clientX,y:e.touches[0].clientY};}
    if(e.touches.length===2){var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;var dist=Math.sqrt(dx*dx+dy*dy);if(lastTouchDist>0) targetZ=Math.max(0.3,Math.min(5,targetZ*(dist/lastTouchDist)));lastTouchDist=dist;}
  },{passive:false});
  canvas.addEventListener('touchend', function(e){
    var wasDrag=false;
    if(touchStartPos&&e.changedTouches.length>0){
      var dx=e.changedTouches[0].clientX-touchStartPos.x,dy=e.changedTouches[0].clientY-touchStartPos.y;
      wasDrag=Math.sqrt(dx*dx+dy*dy)>=5;
      if(!wasDrag&&_subMenu&&_subMenu.style.display==='block'){hideSubMenu();}
      else if(!wasDrag&&!transitioning){var hit=hitTest(e.changedTouches[0].clientX,e.changedTouches[0].clientY);if(hit>=0) navigateToUniverse(hit);}
    }
    isDragging=false;dragStart=null;lastTouchDist=0;touchStartPos=null;
  });
}

function bindMiniEvents() {
  canvas.addEventListener('click', function(e) {
    var hit = hitTest(e.clientX, e.clientY);
    if (hit >= 0) {
      navigateToUniverse(hit);
    } else {
      if (_onNodeClick) {
        _onNodeClick(null);
      } else {
        window.location.href = '/connectome.html';
      }
    }
  });
}

// === PUBLIC API ===
function init(canvasId, opts) {
  opts = opts || {};
  _miniMode = !!opts.miniMode;
  _focusDomain = opts.focusDomain || null;
  _onNodeClick = opts.onNodeClick || null;

  resetState();

  if (_miniMode) {
    spiralSpeed = 0.00015;
  }

  DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  canvas = document.getElementById(canvasId);
  ctx = canvas.getContext('2d');

  if (!_miniMode) {
    _tooltip = document.getElementById('tooltip');
    _ttPhase = document.getElementById('ttPhase');
    _ttName = document.getElementById('ttName');
    _ttTagline = document.getElementById('ttTagline');
    _ttCounts = document.getElementById('ttCounts');
    _subMenu = document.getElementById('subMenu');
  }

  resize();
  window.addEventListener('resize', resize);

  if (_miniMode) {
    bindMiniEvents();
  } else {
    bindFullEvents();
  }

  loadData();
  draw();
}

window.CivilizationConnectome = { init: init };

})();
