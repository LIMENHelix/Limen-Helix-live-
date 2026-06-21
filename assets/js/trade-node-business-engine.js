/**
 * trade-node-business-engine.js — Trade Node-to-Business Assignment Engine
 *
 * TRADE / SUPPLY CHAIN DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture (deeper than Energy baseline):
 *   - Recursively traverses ALL child portal JSONs (depth 0–5, 18,508 files)
 *   - Covers 103 operational nodes (72 company-mapped + 31 treatment-only)
 *   - Excludes 20 RI/framework nodes from business generation
 *   - Filters generic template treatments before inference
 *   - Compares existing companies at ALL depth levels against business-type directory
 *
 * Outputs 3 buckets:
 *   MAPPED     — already mapped and active in Trade system
 *   MISSING    — plausible but missing from current Trade mappings
 *   SPECULATIVE — low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_trade_business_approvals')
 *
 * Self-gates: only runs when ?domain=supplyChain or ?domain=trade
 * Exposes: window.LIMENTradeBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var _dom = params.get('domain');
  if (_dom !== 'supplyChain' && _dom !== 'trade') return;

  var STORAGE_KEY = 'limen_trade_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_trade_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000; // 10 minutes

  // ══════════════════════════════════════════════════════════════════════
  // RI/FRAMEWORK NODES — excluded from business generation
  // ══════════════════════════════════════════════════════════════════════

  var RI_NODES = {
    'ACC': true, 'ASTRO': true, 'BBB': true, 'DMNMTL': true, 'EBA': true,
    'FPC': true, 'IPL': true, 'MFC': true, 'MI': true, 'PMC': true,
    'PPA': true, 'PRC': true, 'S2': true, 'SCN': true, 'SDH': true,
    'SPL': true, 'V4V5': true, 'VIA': true, 'rPFC': true, 'sgACC': true
  };

  // ══════════════════════════════════════════════════════════════════════
  // GENERIC TREATMENT FILTER — treatments appearing in >50 nodes
  // These are infrastructure, NOT business-generating signals
  // ══════════════════════════════════════════════════════════════════════

  var GENERIC_TREATMENT_PATTERNS = [
    'Deploy Technology Integration Integrated Technology Platform',
    'Deploy KPI Tracking Integrated Technology Platform',
    'Deploy Innovation Pipeline Integrated Technology Platform',
    'Deploy Trend Analysis Integrated Technology Platform',
    'Deploy Scalability Integrated Technology Platform',
    'Deploy Baseline Assessment Integrated Technology Platform',
    'Deploy Reporting Integrated Technology Platform',
    'Deploy Sustainability Integrated Technology Platform',
    'Deploy Cost Optimization Integrated Technology Platform',
    'Deploy Process Improvement Integrated Technology Platform',
    'Deploy Benchmarking Integrated Technology Platform',
    'Deploy Data Collection Integrated Technology Platform',
    'Deploy Delivery Integrated Technology Platform',
    'Deploy Risk Mitigation Integrated Technology Platform',
    'Deploy Resource Planning Integrated Technology Platform',
    'Deploy Execution Integrated Technology Platform',
    'Deploy Stakeholder Coordination Integrated Technology Platform',
    'Deploy Timeline Management Integrated Technology Platform'
  ];
  var _genericSet = {};
  for (var gi = 0; gi < GENERIC_TREATMENT_PATTERNS.length; gi++) {
    _genericSet[GENERIC_TREATMENT_PATTERNS[gi]] = true;
  }

  function isGenericTreatment(label) {
    if (_genericSet[label]) return true;
    // Also filter template-generated framework labels
    // Pattern: "Verb + PortalLabel + Framework Noun" where framework noun is generic
    var lower = (label || '').toLowerCase();
    if (lower.indexOf('integrated technology platform') !== -1) return true;
    if (lower.indexOf('diagnostic classification') !== -1 && lower.indexOf('protocol') !== -1) return true;
    if (lower.indexOf('signal ingestion') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal filtering') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('signal correlation') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('intervention planning') !== -1 && lower.indexOf('assessment') !== -1) return true;
    if (lower.indexOf('root cause analysis') !== -1 && lower.indexOf('assessment') !== -1) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CANONICAL NODE BUSINESS DIRECTORY — 103 operational nodes
  // Depth 0 (top-level trade.json) nodes get full neuroTranslation + expectedTypes
  // Depth 1+ nodes get function/dysregulation + expectedTypes derived from role
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {
    // ── DEPTH-0 TOP-LEVEL NODES (20) — full detail ──
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Container Shipping', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary brainstem relay for visceral sensory input — routes autonomic signals to appropriate targets.', inBusiness: 'In trade, container shipping routes bulk cargo through autonomic global maritime systems connecting production to consumption.' },
      function: 'Routes bulk cargo through maritime systems connecting global production to consumption',
      dysregulation: 'Freight cost spike, carrier capacity constraint, vessel queue congestion',
      expectedTypes: [
        { type: 'Container shipping line', reason: 'Operates vessel fleets on fixed trade lanes', confidence: 0.95 },
        { type: 'NVOCC (non-vessel operating carrier)', reason: 'Books container space without owning vessels', confidence: 0.90 },
        { type: 'Container leasing company', reason: 'Owns and leases intermodal containers', confidence: 0.85 },
        { type: 'Maritime booking platform', reason: 'Digital freight marketplace for container slots', confidence: 0.80 },
        { type: 'Container tracking / visibility provider', reason: 'Real-time location and status tracking', confidence: 0.75 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Fields', label: 'Air Freight', tier: 'top',
      neuroTranslation: { inNeurology: 'Controls voluntary saccadic eye movements — rapid targeted attention to specific locations.', inBusiness: 'In trade, air freight provides rapid targeted delivery for time-critical and high-value cargo.' },
      function: 'Rapid delivery of time-critical and high-value cargo via air transport',
      dysregulation: 'Belly capacity shortage, fuel surcharge spike, airport congestion',
      expectedTypes: [
        { type: 'Air cargo carrier', reason: 'Operates freighter aircraft and belly cargo', confidence: 0.95 },
        { type: 'Air freight forwarder', reason: 'Consolidates shipments and books air cargo space', confidence: 0.90 },
        { type: 'Airport ground handling company', reason: 'Loads, unloads, and processes cargo at airports', confidence: 0.85 },
        { type: 'Express / integrator service', reason: 'Door-to-door express delivery', confidence: 0.88 },
        { type: 'Air cargo management platform', reason: 'Digital booking and optimization for air freight', confidence: 0.75 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum', label: 'Rail Transport', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates timing and precision of complex motor sequences with rapid error correction.', inBusiness: 'In trade, rail transport requires precisely sequenced operations — switching, coupling, scheduling across fixed infrastructure.' },
      function: 'High-volume, long-haul freight movement on fixed rail infrastructure',
      dysregulation: 'Track congestion, service disruption, intermodal handoff delay',
      expectedTypes: [
        { type: 'Class I railroad operator', reason: 'Operates mainline rail freight network', confidence: 0.95 },
        { type: 'Intermodal terminal operator', reason: 'Manages container transfer between rail and truck', confidence: 0.90 },
        { type: 'Railcar leasing company', reason: 'Owns and leases specialized freight cars', confidence: 0.85 },
        { type: 'Short-line railroad', reason: 'First/last mile rail service', confidence: 0.78 },
        { type: 'Rail scheduling / optimization software', reason: 'Capacity planning and train scheduling', confidence: 0.72 }
      ]
    },
    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Trucking', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage where planned actions become physical execution.', inBusiness: 'In trade, trucking is the final physical execution — first and last mile connecting every mode to actual delivery.' },
      function: 'Door-to-door freight movement and first/last mile connectivity',
      dysregulation: 'Driver shortage, drayage bottleneck, chassis imbalance',
      expectedTypes: [
        { type: 'Truckload carrier (TL)', reason: 'Full trailer loads for dedicated shipments', confidence: 0.95 },
        { type: 'Less-than-truckload carrier (LTL)', reason: 'Consolidated partial loads', confidence: 0.92 },
        { type: 'Drayage provider', reason: 'Short-haul container moves between port and warehouse', confidence: 0.90 },
        { type: 'Freight brokerage', reason: 'Matches loads with available capacity', confidence: 0.88 },
        { type: 'Fleet management / telematics vendor', reason: 'GPS, ELD compliance, route optimization', confidence: 0.78 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'Port Operations', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays nearly all sensory and motor signals — gates and routes information to processing regions.', inBusiness: 'In trade, ports are the central relay hub where cargo transfers between ocean, rail, and truck modes.' },
      function: 'Intermodal cargo transfer hub connecting ocean, rail, and road transport',
      dysregulation: 'Berth congestion, crane downtime, gate queue overflow',
      expectedTypes: [
        { type: 'Port terminal operator', reason: 'Operates container terminals — berths, cranes, yard', confidence: 0.95 },
        { type: 'Port authority / infrastructure owner', reason: 'Develops port infrastructure and access', confidence: 0.90 },
        { type: 'Terminal operating system (TOS) vendor', reason: 'Yard planning, vessel ops, gate management software', confidence: 0.85 },
        { type: 'Port equipment manufacturer', reason: 'Cranes, straddle carriers, reach stackers, AGVs', confidence: 0.82 },
        { type: 'Marine pilotage and tugboat service', reason: 'Vessel navigation in port waters', confidence: 0.72 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Customs & Tariffs', tier: 'top',
      neuroTranslation: { inNeurology: 'Evaluates subjective value of options and updates expectations based on changing outcomes.', inBusiness: 'In trade, customs evaluates goods, classifies them, assigns duty rates, and updates as tariff schedules change.' },
      function: 'Classification, valuation, and duty assessment for cross-border goods',
      dysregulation: 'Classification dispute, clearance delay, duty rate volatility',
      expectedTypes: [
        { type: 'Licensed customs broker', reason: 'Files entries and manages customs compliance', confidence: 0.95 },
        { type: 'Customs technology / automation platform', reason: 'Automated classification and filing software', confidence: 0.90 },
        { type: 'Trade compliance consulting', reason: 'Tariff engineering and duty optimization advisory', confidence: 0.85 },
        { type: 'Duty drawback specialist', reason: 'Recovers overpaid duties on re-exports', confidence: 0.78 },
        { type: 'HS classification service', reason: 'Expert tariff classification', confidence: 0.75 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Supply Chain Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and coordination of multiple simultaneous goals.', inBusiness: 'In trade, supply chain management holds demand forecasts, inventory, lead times, and capacity simultaneously.' },
      function: 'End-to-end coordination of procurement, production, and distribution',
      dysregulation: 'Demand-supply mismatch, bullwhip amplification, supplier collapse',
      expectedTypes: [
        { type: 'Supply chain planning software (SCP)', reason: 'Demand forecasting, S&OP, inventory optimization', confidence: 0.95 },
        { type: 'Supply chain visibility platform', reason: 'Real-time tracking across tiers', confidence: 0.92 },
        { type: 'Procurement / sourcing platform', reason: 'Supplier discovery and contract management', confidence: 0.88 },
        { type: 'Supply chain consulting firm', reason: 'Network design and risk assessment', confidence: 0.82 },
        { type: 'Supplier risk monitoring service', reason: 'Financial health and disruption alerts', confidence: 0.78 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Warehousing', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes new memories and consolidates short-term to long-term storage.', inBusiness: 'In trade, warehouses store goods between production and consumption, holding inventory until needed.' },
      function: 'Physical storage, consolidation, and order fulfillment',
      dysregulation: 'Capacity shortage, fulfillment error, inventory shrinkage',
      expectedTypes: [
        { type: 'Third-party logistics warehouse (3PL)', reason: 'Outsourced warehousing and distribution', confidence: 0.95 },
        { type: 'Warehouse management system (WMS) vendor', reason: 'Inventory tracking and labor management', confidence: 0.92 },
        { type: 'Warehouse automation / robotics', reason: 'AS/RS, goods-to-person, conveyors', confidence: 0.88 },
        { type: 'Industrial real estate / warehouse REIT', reason: 'Develops distribution center space', confidence: 0.85 },
        { type: 'Fulfillment-as-a-service platform', reason: 'eCommerce fulfillment with distributed inventory', confidence: 0.80 }
      ]
    },
    'S1': {
      fullName: 'Primary Somatosensory Cortex', label: 'Last-Mile Delivery', tier: 'top',
      neuroTranslation: { inNeurology: 'First cortical stage for interpreting physical contact with the environment.', inBusiness: 'In trade, last-mile delivery is where the supply chain physically touches the end customer.' },
      function: 'Final delivery from distribution center to end customer',
      dysregulation: 'Delivery failure, route inefficiency, customer complaint surge',
      expectedTypes: [
        { type: 'Last-mile delivery carrier', reason: 'Package delivery from hub to doorstep', confidence: 0.95 },
        { type: 'Route optimization software', reason: 'Dynamic routing for delivery fleets', confidence: 0.88 },
        { type: 'Parcel locker / pickup point network', reason: 'Alternative delivery endpoints', confidence: 0.82 },
        { type: 'Crowdsourced delivery platform', reason: 'Gig-economy delivery for peak demand', confidence: 0.78 },
        { type: 'Proof-of-delivery / signature capture', reason: 'Digital delivery confirmation', confidence: 0.70 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Cold Chain', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates body temperature, hunger, thirst — maintains homeostatic balance within survival ranges.', inBusiness: 'In trade, cold chain maintains precise thermal conditions for perishable goods throughout transit.' },
      function: 'Temperature-controlled transport and storage for perishable goods',
      dysregulation: 'Temperature excursion, cold storage shortage, spoilage event',
      expectedTypes: [
        { type: 'Refrigerated transport carrier', reason: 'Reefer trucks and containers', confidence: 0.95 },
        { type: 'Cold storage warehouse operator', reason: 'Temperature-controlled facilities', confidence: 0.92 },
        { type: 'Temperature monitoring / IoT provider', reason: 'Real-time thermal sensors', confidence: 0.88 },
        { type: 'Pharmaceutical logistics specialist', reason: 'GDP-compliant cold chain', confidence: 0.85 },
        { type: 'Cold chain packaging manufacturer', reason: 'Insulated containers and thermal materials', confidence: 0.78 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Trade Agreements', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates emotional valuation with long-term consequence assessment.', inBusiness: 'In trade, negotiators weigh competing interests to set long-term rules governing cross-border commerce.' },
      function: 'Bilateral and multilateral frameworks governing cross-border commerce',
      dysregulation: 'Agreement withdrawal, renegotiation uncertainty, non-tariff barrier proliferation',
      expectedTypes: [
        { type: 'International trade law firm', reason: 'FTA, WTO disputes, trade remedies', confidence: 0.90 },
        { type: 'FTA utilization consulting', reason: 'Maximizes preferential tariff benefits', confidence: 0.85 },
        { type: 'Trade policy research / think tank', reason: 'Analyzes trade agreement impact', confidence: 0.82 },
        { type: 'Government affairs / trade lobbying', reason: 'Industry representation in negotiations', confidence: 0.75 }
      ]
    },
    'NAcc': {
      fullName: 'Nucleus Accumbens', label: 'Commodity Exchanges', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes reward signals and motivates approach behavior toward high-value outcomes.', inBusiness: 'In trade, commodity exchanges drive price discovery and resource allocation for raw materials.' },
      function: 'Price discovery, hedging, and resource allocation for traded commodities',
      dysregulation: 'Price manipulation, liquidity collapse, speculative bubble',
      expectedTypes: [
        { type: 'Commodity exchange / trading platform', reason: 'Futures and spot markets', confidence: 0.92 },
        { type: 'Commodity trading house', reason: 'Physical procurement and risk management', confidence: 0.90 },
        { type: 'Commodity risk management (CTRM) vendor', reason: 'Trade capture and hedging software', confidence: 0.85 },
        { type: 'Commodity market data / analytics', reason: 'Price feeds and forecasting', confidence: 0.80 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'Freight Forwarding', tier: 'top',
      neuroTranslation: { inNeurology: 'Largest white matter tract connecting left and right hemispheres.', inBusiness: 'In trade, freight forwarders bridge shippers and carriers across all modes.' },
      function: 'Multimodal shipment coordination connecting shippers to carriers',
      dysregulation: 'Booking failure, documentation error, mode connection breakdown',
      expectedTypes: [
        { type: 'International freight forwarder', reason: 'End-to-end multimodal coordination', confidence: 0.95 },
        { type: 'Digital freight forwarding platform', reason: 'Tech-driven instant quoting and booking', confidence: 0.90 },
        { type: 'Customs documentation service', reason: 'Bills of lading, invoices, certificates', confidence: 0.82 },
        { type: 'Freight rate management / benchmarking', reason: 'Rate comparison across carriers', confidence: 0.78 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Inventory Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates goal-directed attention and cognitive resource allocation.', inBusiness: 'In trade, inventory management allocates limited stock across competing demand channels.' },
      function: 'Stock level optimization, demand allocation, and replenishment',
      dysregulation: 'Stockout cascade, overstock write-off, demand forecast error',
      expectedTypes: [
        { type: 'Inventory optimization software', reason: 'AI-driven forecasting and replenishment', confidence: 0.92 },
        { type: 'Distributed order management (DOM)', reason: 'Routes orders to optimal locations', confidence: 0.88 },
        { type: 'RFID / barcode tracking system', reason: 'Automated inventory counting', confidence: 0.85 },
        { type: 'Excess inventory liquidation marketplace', reason: 'Secondary market for overstock', confidence: 0.72 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Cross-Border Commerce', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates multiple sensory modalities and supports theory of mind.', inBusiness: 'In trade, cross-border transactions require understanding multiple regulatory regimes simultaneously.' },
      function: 'Multi-jurisdiction trade execution across regulatory and currency boundaries',
      dysregulation: 'Sanctions violation risk, currency volatility, regulatory divergence',
      expectedTypes: [
        { type: 'Cross-border payment / FX platform', reason: 'Currency conversion and FX hedging', confidence: 0.92 },
        { type: 'Trade finance provider', reason: 'Letters of credit and supply chain financing', confidence: 0.90 },
        { type: 'Cross-border eCommerce platform', reason: 'Localized checkout and international fulfillment', confidence: 0.85 },
        { type: 'Sanctions / export control screening', reason: 'Denied party screening', confidence: 0.88 },
        { type: 'Market entry consulting', reason: 'Advises on international market entry', confidence: 0.72 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Logistics Technology', tier: 'top',
      neuroTranslation: { inNeurology: 'Dynamically allocates cognitive resources and switches between tasks.', inBusiness: 'In trade, logistics technology dynamically allocates resources and reconfigures supply chains.' },
      function: 'Digital infrastructure for visibility, optimization, and automation',
      dysregulation: 'Integration failure, data silo, platform outage',
      expectedTypes: [
        { type: 'Transportation management system (TMS)', reason: 'Carrier selection, route optimization, freight audit', confidence: 0.95 },
        { type: 'Supply chain control tower platform', reason: 'End-to-end visibility and exception management', confidence: 0.92 },
        { type: 'EDI / API integration provider', reason: 'System-to-system connectivity', confidence: 0.85 },
        { type: 'Logistics AI / ML platform', reason: 'Predictive analytics for demand and disruption', confidence: 0.82 }
      ]
    },
    'PIN': {
      fullName: 'Pineal', label: 'Trade Policy', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates circadian rhythms and seasonal biological cycles.', inBusiness: 'In trade, policy cycles through tariff regimes, protectionist waves, and liberalization periods.' },
      function: 'Government trade interventions including tariffs, quotas, subsidies, and sanctions',
      dysregulation: 'Tariff escalation, retaliatory cycle, subsidy distortion',
      expectedTypes: [
        { type: 'Trade policy advisory / government relations', reason: 'Navigates tariff and sanctions changes', confidence: 0.88 },
        { type: 'Tariff engineering consultant', reason: 'Restructures to minimize duty impact', confidence: 0.82 },
        { type: 'Foreign trade zone (FTZ) operator', reason: 'Deferred duties through zone processing', confidence: 0.78 },
        { type: 'Trade adjustment assistance provider', reason: 'Helps firms impacted by policy changes', confidence: 0.70 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\'s Area', label: 'Trade Zones', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes and comprehends language — extracts meaning from symbolic communication.', inBusiness: 'In trade, special economic zones have their own rules and incentive language.' },
      function: 'Special economic zones, free trade zones, and bonded areas',
      dysregulation: 'Zone abuse, regulatory arbitrage, investment incentive expiry',
      expectedTypes: [
        { type: 'Free trade zone developer / operator', reason: 'Develops and manages FTZ infrastructure', confidence: 0.88 },
        { type: 'Bonded warehouse operator', reason: 'Customs-bonded storage deferring duty', confidence: 0.85 },
        { type: 'SEZ investment advisory', reason: 'Zone location and incentive advice', confidence: 0.78 },
        { type: 'Zone compliance / audit service', reason: 'Ensures regulatory requirements met', confidence: 0.72 }
      ]
    },
    'LANG': {
      fullName: 'Language Network', label: 'WTO & Multilateral Governance', tier: 'top',
      neuroTranslation: { inNeurology: 'Integrates syntax, semantics, and pragmatics for complex communication.', inBusiness: 'In trade, the WTO provides the structured rule system governing international commerce.' },
      function: 'Rules-based multilateral trade system including dispute settlement',
      dysregulation: 'Appellate body paralysis, rule erosion, bilateral bypass',
      expectedTypes: [
        { type: 'WTO dispute resolution specialist', reason: 'Legal representation in trade disputes', confidence: 0.85 },
        { type: 'Trade statistics / data provider', reason: 'International trade flow data', confidence: 0.82 },
        { type: 'Multilateral trade negotiation advisor', reason: 'Supports government delegations', confidence: 0.78 },
        { type: 'Trade compliance training', reason: 'Educates on WTO rules', confidence: 0.70 }
      ]
    },
    'CARD': {
      fullName: 'Cardiac Autonomic Centers', label: 'Services Trade', tier: 'top',
      neuroTranslation: { inNeurology: 'Regulates heart rate and vascular tone — maintains steady rhythmic output.', inBusiness: 'In trade, services flow as continuous streams sustaining modern economies.' },
      function: 'Cross-border trade in IT, finance, consulting, and professional services',
      dysregulation: 'Market access restriction, data localization mandate, credential non-recognition',
      expectedTypes: [
        { type: 'IT / business process outsourcing (BPO)', reason: 'Cross-border technology and business services', confidence: 0.90 },
        { type: 'Global professional services firm', reason: 'Consulting, audit, legal across jurisdictions', confidence: 0.88 },
        { type: 'Digital services trade platform', reason: 'Marketplace for international service providers', confidence: 0.82 },
        { type: 'Professional credential recognition service', reason: 'Mutual recognition across borders', confidence: 0.72 }
      ]
    },

    // ── DEPTH-1+ OPERATIONAL NODES (83) — functional roles in trade hierarchy ──
    // These appear at depth 1–5 across child portals. They have treatments and
    // many have companies. Business types derive from their functional role.

    'A1': { fullName: 'Primary Auditory Cortex', label: 'Metric Design', tier: 'operational', function: 'Designs and calibrates performance metrics for trade operations', dysregulation: 'Metric misalignment, KPI drift', expectedTypes: [{ type: 'Supply chain analytics / BI vendor', reason: 'Metric dashboards and KPI frameworks', confidence: 0.82 }, { type: 'Trade performance benchmarking service', reason: 'Cross-industry trade metric comparison', confidence: 0.75 }] },
    'ADR': { fullName: 'Adrenal', label: 'Outcome Tracking', tier: 'operational', function: 'Tracks and validates outcomes of trade interventions', dysregulation: 'Outcome tracking failure, intervention drift', expectedTypes: [{ type: 'Supply chain outcome tracking platform', reason: 'Measures intervention effectiveness', confidence: 0.78 }, { type: 'Trade program evaluation consultant', reason: 'Assesses ROI of trade initiatives', confidence: 0.72 }] },
    'AG': { fullName: 'Angular Gyrus', label: 'Resource Planning', tier: 'operational', function: 'Plans and allocates resources across trade operations', dysregulation: 'Resource misallocation, planning gap', expectedTypes: [{ type: 'Enterprise resource planning (ERP) vendor', reason: 'Integrated resource management', confidence: 0.88 }, { type: 'Workforce planning platform', reason: 'Labor and resource allocation for logistics', confidence: 0.80 }] },
    'AI': { fullName: 'Anterior Insula', label: 'Diagnostic Classification', tier: 'operational', function: 'Classifies and categorizes trade disruptions for triage', dysregulation: 'Misclassification, delayed triage', expectedTypes: [{ type: 'Supply chain risk classification platform', reason: 'Automated disruption categorization', confidence: 0.80 }, { type: 'Trade disruption analytics service', reason: 'Real-time event classification', confidence: 0.75 }] },
    'ANT': { fullName: 'Anterior Thalamus', label: 'Workforce Alignment', tier: 'operational', function: 'Aligns workforce capabilities with trade operation demands', dysregulation: 'Skills mismatch, labor shortage', expectedTypes: [{ type: 'Logistics staffing agency', reason: 'Temporary and permanent logistics workforce', confidence: 0.85 }, { type: 'Supply chain training platform', reason: 'Upskilling for trade operations', confidence: 0.78 }] },
    'ARC': { fullName: 'Arcuate Fasciculus', label: 'Comparative Analysis', tier: 'operational', function: 'Compares trade performance across carriers, routes, and regions', dysregulation: 'Analysis bias, comparison gap', expectedTypes: [{ type: 'Freight benchmarking platform', reason: 'Carrier and route performance comparison', confidence: 0.82 }, { type: 'Trade lane analysis service', reason: 'Comparative cost and time analysis', confidence: 0.78 }] },
    'BDNF': { fullName: 'BDNF / Plasticity', label: 'Adaptive Iteration', tier: 'operational', function: 'Drives continuous improvement and adaptation in trade processes', dysregulation: 'Stagnation, change resistance', expectedTypes: [{ type: 'Continuous improvement consulting (lean/six sigma)', reason: 'Process optimization for logistics', confidence: 0.82 }, { type: 'Supply chain agility platform', reason: 'Rapid adaptation to disruptions', confidence: 0.78 }] },
    'BLA': { fullName: 'Basolateral Amygdala', label: 'Comparative Analysis Governance', tier: 'operational', function: 'Governs standards and protocols for trade performance comparison', dysregulation: 'Governance gap, standard drift', expectedTypes: [{ type: 'Trade standards body / certification', reason: 'Sets comparison and compliance standards', confidence: 0.78 }, { type: 'Audit and assurance for logistics', reason: 'Independent verification of trade metrics', confidence: 0.75 }] },
    'BNST': { fullName: 'Bed Nucleus of Stria Terminalis', label: 'Workforce Governance', tier: 'operational', function: 'Governs workforce policies and labor standards in trade', dysregulation: 'Policy gap, labor compliance failure', expectedTypes: [{ type: 'Labor compliance consulting', reason: 'Trade labor standards and regulations', confidence: 0.78 }, { type: 'Workforce management software', reason: 'Scheduling, compliance, and payroll for logistics', confidence: 0.82 }] },
    'BROCA': { fullName: 'Broca\'s Area', label: 'Baseline Calibration', tier: 'operational', function: 'Establishes operational baselines for trade performance measurement', dysregulation: 'Baseline drift, measurement error', expectedTypes: [{ type: 'Supply chain baselining service', reason: 'Establishes performance benchmarks', confidence: 0.78 }, { type: 'Trade data normalization platform', reason: 'Standardizes data across sources', confidence: 0.75 }] },
    'CAUD': { fullName: 'Caudate Nucleus', label: 'Cost Optimization', tier: 'operational', function: 'Optimizes costs across trade operations and logistics', dysregulation: 'Cost overrun, margin erosion', expectedTypes: [{ type: 'Freight audit and payment service', reason: 'Identifies billing errors and overcharges', confidence: 0.90 }, { type: 'Logistics cost optimization platform', reason: 'Rate analysis and spend management', confidence: 0.85 }] },
    'CING': { fullName: 'Cingulum Bundle', label: 'Innovation', tier: 'operational', function: 'Drives innovation in trade operations and logistics technology', dysregulation: 'Innovation stagnation, technology lag', expectedTypes: [{ type: 'Logistics innovation lab / accelerator', reason: 'Incubates new trade technologies', confidence: 0.78 }, { type: 'Supply chain R&D consulting', reason: 'Applied research for logistics', confidence: 0.75 }] },
    'CLAUST': { fullName: 'Claustrum', label: 'Diagnostic Mapping', tier: 'operational', function: 'Maps and diagnoses systemic issues across trade networks', dysregulation: 'Diagnostic gap, issue propagation', expectedTypes: [{ type: 'Supply chain diagnostic platform', reason: 'Maps systemic issues across networks', confidence: 0.78 }, { type: 'Trade network analysis service', reason: 'Graph-based supply chain diagnostics', confidence: 0.75 }] },
    'CMZ': { fullName: 'Cerebellar Marginal Zone', label: 'Performance Tuning', tier: 'operational', function: 'Fine-tunes operational performance in trade logistics', dysregulation: 'Performance degradation, tuning failure', expectedTypes: [{ type: 'Logistics process optimization vendor', reason: 'Fine-tunes warehouse and transport performance', confidence: 0.82 }, { type: 'Carrier performance management platform', reason: 'Scorecards and SLA tracking', confidence: 0.78 }] },
    'CON': { fullName: 'Cingulo-Opercular Network', label: 'Comparative Innovation', tier: 'operational', function: 'Compares and adopts innovative practices across trade domains', dysregulation: 'Innovation blindness, adoption lag', expectedTypes: [{ type: 'Trade technology advisory', reason: 'Evaluates and recommends logistics innovations', confidence: 0.78 }, { type: 'Best practice benchmarking service', reason: 'Cross-industry logistics comparison', confidence: 0.75 }] },
    'CeA': { fullName: 'Central Amygdala', label: 'Metric Operations', tier: 'operational', function: 'Operates metric collection and reporting systems for trade', dysregulation: 'Data collection failure, reporting gap', expectedTypes: [{ type: 'Trade data management platform', reason: 'Collects and reports logistics metrics', confidence: 0.80 }, { type: 'EDI / data integration service', reason: 'Automates trade data exchange', confidence: 0.78 }] },
    'DAN': { fullName: 'Dorsal Attention Network', label: 'Risk Profiling', tier: 'operational', function: 'Profiles and prioritizes risks across trade operations', dysregulation: 'Risk blindness, priority misalignment', expectedTypes: [{ type: 'Supply chain risk intelligence platform', reason: 'Real-time risk profiling and alerts', confidence: 0.88 }, { type: 'Trade insurance / surety provider', reason: 'Risk transfer for logistics operations', confidence: 0.82 }] },
    'DISS': { fullName: 'Dissolution Network', label: 'Contingency Planning', tier: 'operational', function: 'Plans contingencies for trade disruptions and failures', dysregulation: 'No contingency, response gap', expectedTypes: [{ type: 'Business continuity consulting for logistics', reason: 'Disruption recovery planning', confidence: 0.82 }, { type: 'Supply chain resilience platform', reason: 'Automated contingency triggering', confidence: 0.78 }] },
    'DMN': { fullName: 'Default Mode Network', label: 'Stakeholder Assessment', tier: 'operational', function: 'Assesses stakeholder impacts and dependencies in trade networks', dysregulation: 'Stakeholder blindness, dependency miss', expectedTypes: [{ type: 'Stakeholder mapping platform', reason: 'Maps supply chain dependencies', confidence: 0.78 }, { type: 'ESG / sustainability assessment for supply chains', reason: 'Stakeholder impact reporting', confidence: 0.82 }] },
    'DV': { fullName: 'Dorsal Vagal Complex', label: 'Quality Gates', tier: 'operational', function: 'Enforces quality checkpoints across trade processes', dysregulation: 'Quality escape, gate bypass', expectedTypes: [{ type: 'Quality management system (QMS) vendor', reason: 'Enforces quality gates in logistics', confidence: 0.82 }, { type: 'Inspection and certification body', reason: 'Third-party quality verification', confidence: 0.85 }] },
    'EC': { fullName: 'Entorhinal Cortex', label: 'Workforce Systems', tier: 'operational', function: 'Manages workforce systems and labor coordination', dysregulation: 'System fragmentation, coordination failure', expectedTypes: [{ type: 'Logistics workforce management platform', reason: 'Scheduling and labor coordination', confidence: 0.82 }, { type: 'Driver management system', reason: 'DOT compliance and driver scheduling', confidence: 0.80 }] },
    'EI': { fullName: 'Excitation/Inhibition Ratio', label: 'Data Validation', tier: 'operational', function: 'Validates data integrity across trade systems', dysregulation: 'Data corruption, validation failure', expectedTypes: [{ type: 'Trade data quality platform', reason: 'Validates and cleanses logistics data', confidence: 0.80 }, { type: 'Master data management for supply chain', reason: 'Single source of truth for trade data', confidence: 0.82 }] },
    'EMP': { fullName: 'Empathy Circuit', label: 'Cross-Domain Learning', tier: 'operational', function: 'Transfers insights across trade domains and adjacent industries', dysregulation: 'Siloed learning, knowledge loss', expectedTypes: [{ type: 'Supply chain knowledge management platform', reason: 'Cross-domain insight sharing', confidence: 0.75 }, { type: 'Trade industry association', reason: 'Facilitates cross-sector learning', confidence: 0.72 }] },
    'ENDO': { fullName: 'Endocannabinoid System', label: 'Diagnostic Mapping Operations', tier: 'operational', function: 'Operates diagnostic mapping systems for trade disruptions', dysregulation: 'Mapping failure, blind spots', expectedTypes: [{ type: 'Supply chain mapping software', reason: 'Visualizes and maps disruption pathways', confidence: 0.80 }, { type: 'Trade flow visualization tool', reason: 'Real-time trade flow mapping', confidence: 0.78 }] },
    'ENS': { fullName: 'Enteric Nervous System', label: 'Process Improvement', tier: 'operational', function: 'Drives continuous process improvement in trade operations', dysregulation: 'Process decay, inefficiency creep', expectedTypes: [{ type: 'Process mining software', reason: 'Discovers bottlenecks in logistics workflows', confidence: 0.85 }, { type: 'Lean logistics consulting', reason: 'Eliminates waste in trade operations', confidence: 0.80 }] },
    'FG': { fullName: 'Fusiform Gyrus', label: 'KPI Tracking', tier: 'operational', function: 'Tracks key performance indicators across trade operations', dysregulation: 'KPI drift, tracking failure', expectedTypes: [{ type: 'Logistics KPI dashboard platform', reason: 'Real-time performance monitoring', confidence: 0.82 }, { type: 'Trade reporting automation service', reason: 'Automated KPI report generation', confidence: 0.78 }] },
    'FORN': { fullName: 'Fornix', label: 'Change Management', tier: 'operational', function: 'Manages organizational change across trade operations', dysregulation: 'Change resistance, adoption failure', expectedTypes: [{ type: 'Change management consulting for logistics', reason: 'Guides organizational transformation', confidence: 0.78 }, { type: 'Digital adoption platform', reason: 'Drives technology adoption in logistics', confidence: 0.75 }] },
    'GABA_GLU': { fullName: 'E/I Balance', label: 'Baseline Assessment', tier: 'operational', function: 'Assesses baseline capabilities and readiness for trade operations', dysregulation: 'Assessment gap, readiness blindness', expectedTypes: [{ type: 'Trade readiness assessment service', reason: 'Evaluates supply chain maturity', confidence: 0.78 }, { type: 'Logistics capability audit firm', reason: 'Assesses operational readiness', confidence: 0.75 }] },
    'GBA': { fullName: 'Gut-Brain Axis', label: 'Stakeholder Systems', tier: 'operational', function: 'Systems for stakeholder engagement and feedback in trade', dysregulation: 'Feedback breakdown, stakeholder disconnect', expectedTypes: [{ type: 'Supply chain collaboration platform', reason: 'Stakeholder engagement and feedback loops', confidence: 0.78 }, { type: 'Vendor management system (VMS)', reason: 'Manages supplier relationships', confidence: 0.82 }] },
    'GP': { fullName: 'Globus Pallidus', label: 'Contingency Operations', tier: 'operational', function: 'Executes contingency operations when trade disruptions occur', dysregulation: 'Response failure, contingency gap', expectedTypes: [{ type: 'Emergency logistics provider', reason: 'Rapid response freight and warehousing', confidence: 0.85 }, { type: 'Supply chain war room platform', reason: 'Real-time crisis coordination', confidence: 0.80 }] },
    'HAB': { fullName: 'Habenula', label: 'Baseline Operations', tier: 'operational', function: 'Operates baseline monitoring and calibration for trade', dysregulation: 'Baseline drift, calibration failure', expectedTypes: [{ type: 'Operational monitoring platform', reason: 'Continuous baseline monitoring for logistics', confidence: 0.78 }, { type: 'Trade operations calibration service', reason: 'Periodic recalibration of trade processes', confidence: 0.72 }] },
    'HPA': { fullName: 'HPA Axis', label: 'Stress Response', tier: 'operational', function: 'Manages stress responses and escalation in trade systems', dysregulation: 'Chronic stress, escalation failure', expectedTypes: [{ type: 'Supply chain stress testing platform', reason: 'Simulates disruptions to test resilience', confidence: 0.82 }, { type: 'Trade crisis management consulting', reason: 'Manages escalation and response', confidence: 0.78 }] },
    'IC': { fullName: 'Inferior Colliculus', label: 'Change Governance', tier: 'operational', function: 'Governs change processes and approval workflows', dysregulation: 'Uncontrolled change, governance gap', expectedTypes: [{ type: 'Trade compliance change management', reason: 'Governs regulatory change adoption', confidence: 0.78 }, { type: 'Logistics SOP management platform', reason: 'Version-controlled procedures', confidence: 0.75 }] },
    'IPS': { fullName: 'Intraparietal Sulcus', label: 'Reporting', tier: 'operational', function: 'Generates reports and insights across trade operations', dysregulation: 'Reporting gap, insight delay', expectedTypes: [{ type: 'Trade reporting / BI platform', reason: 'Automated logistics reporting', confidence: 0.82 }, { type: 'Customs reporting automation', reason: 'Regulatory and compliance reporting', confidence: 0.80 }] },
    'LAR': { fullName: 'Laryngeal Motor Cortex', label: 'Predictive Modeling', tier: 'operational', function: 'Builds predictive models for trade demand and disruption', dysregulation: 'Model failure, prediction error', expectedTypes: [{ type: 'Demand forecasting platform', reason: 'AI-driven trade demand prediction', confidence: 0.85 }, { type: 'Disruption prediction service', reason: 'Early warning for supply chain events', confidence: 0.82 }] },
    'LC': { fullName: 'Locus Coeruleus', label: 'Regulation Strategy', tier: 'operational', function: 'Develops regulatory strategy and compliance approaches for trade', dysregulation: 'Regulatory exposure, compliance failure', expectedTypes: [{ type: 'Trade regulatory consulting', reason: 'Navigates complex compliance landscapes', confidence: 0.85 }, { type: 'Regulatory technology (regtech) for trade', reason: 'Automated compliance monitoring', confidence: 0.82 }] },
    'LGN': { fullName: 'Lateral Geniculate Nucleus', label: 'Capacity Assessment', tier: 'operational', function: 'Assesses capacity across trade nodes and transport modes', dysregulation: 'Capacity blindness, assessment gap', expectedTypes: [{ type: 'Capacity planning platform', reason: 'Assesses and forecasts logistics capacity', confidence: 0.82 }, { type: 'Carrier capacity marketplace', reason: 'Real-time capacity visibility across modes', confidence: 0.85 }] },
    'MAMM': { fullName: 'Mammillary Bodies', label: 'Data Validation Operations', tier: 'operational', function: 'Operates data validation and integrity checks for trade', dysregulation: 'Data integrity failure, validation gap', expectedTypes: [{ type: 'Data integrity monitoring service', reason: 'Continuous trade data validation', confidence: 0.78 }, { type: 'Trade document verification platform', reason: 'Validates shipping documents and invoices', confidence: 0.82 }] },
    'MDT': { fullName: 'Mediodorsal Thalamus', label: 'Metric Governance', tier: 'operational', function: 'Governs metric standards and definitions across trade operations', dysregulation: 'Metric inconsistency, standard erosion', expectedTypes: [{ type: 'Trade standards consulting', reason: 'Defines and governs logistics metrics', confidence: 0.75 }, { type: 'Supply chain data governance platform', reason: 'Manages metric definitions and standards', confidence: 0.78 }] },
    'MGN': { fullName: 'Medial Geniculate Nucleus', label: 'Performance Operations', tier: 'operational', function: 'Operates performance monitoring across trade systems', dysregulation: 'Performance blindness, monitoring gap', expectedTypes: [{ type: 'Logistics performance management platform', reason: 'Real-time performance monitoring', confidence: 0.80 }, { type: 'SLA management service', reason: 'Tracks and enforces service levels', confidence: 0.78 }] },
    'MICRO': { fullName: 'Microbiome', label: 'Diagnostic Governance', tier: 'operational', function: 'Governs diagnostic protocols and standards', dysregulation: 'Diagnostic inconsistency, protocol drift', expectedTypes: [{ type: 'Quality audit and inspection service', reason: 'Governs diagnostic standards in logistics', confidence: 0.78 }, { type: 'Compliance audit platform', reason: 'Automated diagnostic protocol enforcement', confidence: 0.75 }] },
    'NBM': { fullName: 'Nucleus Basalis', label: 'Metric Evaluation', tier: 'operational', function: 'Evaluates metric effectiveness and adjusts measurement', dysregulation: 'Evaluation gap, metric staleness', expectedTypes: [{ type: 'Analytics consulting for supply chain', reason: 'Evaluates and improves measurement systems', confidence: 0.78 }, { type: 'Trade KPI evaluation service', reason: 'Periodic metric effectiveness review', confidence: 0.72 }] },
    'NEOCER': { fullName: 'Neocerebellum', label: 'Shipping Capacity Assessment', tier: 'operational', function: 'Assesses shipping capacity across vessel and container markets', dysregulation: 'Capacity assessment failure, market blindness', expectedTypes: [{ type: 'Vessel capacity analytics platform', reason: 'Monitors global shipping capacity', confidence: 0.85 }, { type: 'Container market intelligence service', reason: 'Tracks container availability and pricing', confidence: 0.82 }] },
    'OLF': { fullName: 'Olfactory Cortex', label: 'Stakeholder Governance', tier: 'operational', function: 'Governs stakeholder engagement policies and protocols', dysregulation: 'Governance gap, stakeholder neglect', expectedTypes: [{ type: 'Supplier governance platform', reason: 'Manages supplier compliance and engagement', confidence: 0.78 }, { type: 'Trade partner management service', reason: 'Governs relationships across trade partners', confidence: 0.75 }] },
    'OPIOID': { fullName: 'Opioid System', label: 'Contingency Systems', tier: 'operational', function: 'Systems for contingency management and disruption response', dysregulation: 'System failure, response delay', expectedTypes: [{ type: 'Supply chain incident management platform', reason: 'Automated disruption response', confidence: 0.82 }, { type: 'Business continuity management system', reason: 'Contingency plan activation and tracking', confidence: 0.78 }] },
    'OSC': { fullName: 'Oscillatory Networks', label: 'Contingency Innovation', tier: 'operational', function: 'Innovates contingency approaches and resilience strategies', dysregulation: 'Innovation stagnation in resilience', expectedTypes: [{ type: 'Supply chain resilience consulting', reason: 'Develops novel contingency approaches', confidence: 0.78 }, { type: 'Disruption simulation platform', reason: 'Innovative scenario modeling', confidence: 0.75 }] },
    'OXY': { fullName: 'Oxytocin System', label: 'Compliance Innovation', tier: 'operational', function: 'Innovates compliance processes and automation for trade', dysregulation: 'Compliance lag, automation gap', expectedTypes: [{ type: 'Trade compliance automation platform', reason: 'Automates compliance workflows', confidence: 0.82 }, { type: 'Regulatory innovation consulting', reason: 'Develops new compliance approaches', confidence: 0.75 }] },
    'PAG': { fullName: 'Periaqueductal Gray', label: 'Predictive Assessment', tier: 'operational', function: 'Assesses predictive model accuracy and reliability', dysregulation: 'Model degradation, prediction failure', expectedTypes: [{ type: 'Model validation service', reason: 'Validates supply chain prediction models', confidence: 0.78 }, { type: 'Forecast accuracy monitoring platform', reason: 'Tracks and improves prediction accuracy', confidence: 0.75 }] },
    'PBN': { fullName: 'Parabrachial Nucleus', label: 'Sensitivity Analysis', tier: 'operational', function: 'Tests sensitivity of trade operations to parameter changes', dysregulation: 'Fragility blindness, sensitivity gap', expectedTypes: [{ type: 'Supply chain scenario analysis platform', reason: 'Tests parameter sensitivity', confidence: 0.78 }, { type: 'Trade simulation consulting', reason: 'What-if analysis for logistics operations', confidence: 0.75 }] },
    'PCC': { fullName: 'Posterior Cingulate Cortex', label: 'Diagnostic Evaluation', tier: 'operational', function: 'Evaluates diagnostic effectiveness and accuracy', dysregulation: 'Diagnostic drift, evaluation gap', expectedTypes: [{ type: 'Diagnostic audit service', reason: 'Evaluates supply chain diagnostic accuracy', confidence: 0.75 }, { type: 'Trade health check platform', reason: 'Periodic diagnostic evaluation', confidence: 0.72 }] },
    'PI': { fullName: 'Posterior Insula', label: 'Stakeholder Evaluation', tier: 'operational', function: 'Evaluates stakeholder performance and relationship health', dysregulation: 'Evaluation gap, relationship decay', expectedTypes: [{ type: 'Supplier performance evaluation platform', reason: 'Scores and ranks supplier performance', confidence: 0.82 }, { type: 'Trade partner satisfaction survey service', reason: 'Measures relationship health', confidence: 0.72 }] },
    'PIT': { fullName: 'Pituitary', label: 'Workforce Innovation', tier: 'operational', function: 'Innovates workforce management and development in trade', dysregulation: 'Workforce stagnation, innovation gap', expectedTypes: [{ type: 'Logistics workforce technology platform', reason: 'Innovative workforce management', confidence: 0.78 }, { type: 'Trade skills development program', reason: 'Next-gen logistics training', confidence: 0.72 }] },
    'PPN': { fullName: 'Pedunculopontine Nucleus', label: 'Capacity Assessment & Diagnostics', tier: 'operational', function: 'Assesses and diagnoses capacity issues across trade', dysregulation: 'Capacity diagnostic failure', expectedTypes: [{ type: 'Capacity diagnostic platform', reason: 'Identifies capacity bottlenecks', confidence: 0.80 }, { type: 'Transport capacity assessment service', reason: 'Evaluates modal capacity', confidence: 0.78 }] },
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Compliance Analysis', tier: 'operational', function: 'Analyzes compliance posture across trade operations', dysregulation: 'Compliance blindness, exposure gap', expectedTypes: [{ type: 'Trade compliance analytics platform', reason: 'Analyzes compliance across operations', confidence: 0.82 }, { type: 'Customs compliance audit service', reason: 'Identifies compliance gaps', confidence: 0.80 }] },
    'PULV': { fullName: 'Pulvinar', label: 'Outcome Innovation', tier: 'operational', function: 'Innovates outcome measurement and tracking methods', dysregulation: 'Measurement stagnation, outcome blindness', expectedTypes: [{ type: 'Supply chain outcome analytics', reason: 'Advanced outcome measurement', confidence: 0.78 }, { type: 'Trade impact assessment platform', reason: 'Measures real-world outcomes', confidence: 0.75 }] },
    'PUT': { fullName: 'Putamen', label: 'Diagnostic Analysis', tier: 'operational', function: 'Performs deep diagnostic analysis on trade disruptions', dysregulation: 'Analysis failure, root cause miss', expectedTypes: [{ type: 'Supply chain root cause analysis platform', reason: 'Deep diagnostic analytics', confidence: 0.82 }, { type: 'Trade disruption forensics service', reason: 'Post-incident analysis', confidence: 0.78 }] },
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Stakeholder Analysis', tier: 'operational', function: 'Analyzes stakeholder networks and power dynamics in trade', dysregulation: 'Analysis gap, network blindness', expectedTypes: [{ type: 'Supply chain network analysis platform', reason: 'Maps stakeholder relationships', confidence: 0.80 }, { type: 'Trade ecosystem mapping service', reason: 'Visualizes stakeholder networks', confidence: 0.78 }] },
    'RF': { fullName: 'Reticular Formation', label: 'Metric Governance', tier: 'operational', function: 'Governs metric standards and reporting protocols', dysregulation: 'Standard erosion, governance gap', expectedTypes: [{ type: 'Logistics reporting standard body', reason: 'Defines trade reporting standards', confidence: 0.72 }, { type: 'Compliance reporting platform', reason: 'Standardized trade reporting', confidence: 0.78 }] },
    'RSC': { fullName: 'Retrosplenial Cortex', label: 'Comparative Systems', tier: 'operational', function: 'Operates systems for cross-carrier and cross-route comparison', dysregulation: 'Comparison failure, system gap', expectedTypes: [{ type: 'Carrier comparison / procurement platform', reason: 'Multi-carrier rate and service comparison', confidence: 0.85 }, { type: 'Trade route optimization service', reason: 'Compares and optimizes routing', confidence: 0.82 }] },
    'SC': { fullName: 'Superior Colliculus', label: 'Technology Deployment', tier: 'operational', function: 'Deploys and manages technology across trade operations', dysregulation: 'Deployment failure, technology gap', expectedTypes: [{ type: 'Logistics technology implementation service', reason: 'Deploys TMS, WMS, and integration', confidence: 0.82 }, { type: 'Supply chain IT consulting', reason: 'Technology strategy and deployment', confidence: 0.78 }] },
    'SEPT': { fullName: 'Septal Nuclei', label: 'Risk Analysis', tier: 'operational', function: 'Analyzes risk factors and exposure across trade operations', dysregulation: 'Risk blindness, analysis failure', expectedTypes: [{ type: 'Trade risk analytics platform', reason: 'Quantifies supply chain risk exposure', confidence: 0.85 }, { type: 'Cargo insurance analytics', reason: 'Risk-based insurance pricing', confidence: 0.80 }] },
    'SMA': { fullName: 'Supplementary Motor Area', label: 'Adaptive Analysis', tier: 'operational', function: 'Analyzes adaptation patterns and change readiness', dysregulation: 'Adaptation failure, rigidity', expectedTypes: [{ type: 'Supply chain maturity assessment', reason: 'Evaluates adaptation readiness', confidence: 0.78 }, { type: 'Logistics change readiness platform', reason: 'Assesses organizational agility', confidence: 0.75 }] },
    'SMN': { fullName: 'Somatomotor Network', label: 'Stakeholder Operations', tier: 'operational', function: 'Operates day-to-day stakeholder coordination', dysregulation: 'Coordination failure, communication breakdown', expectedTypes: [{ type: 'Supply chain collaboration hub', reason: 'Multi-party coordination platform', confidence: 0.82 }, { type: 'Trade partner portal', reason: 'Self-service for suppliers and customers', confidence: 0.78 }] },
    'SN': { fullName: 'Salience Network', label: 'Outcome Operations', tier: 'operational', function: 'Operates outcome tracking and validation systems', dysregulation: 'Tracking failure, outcome drift', expectedTypes: [{ type: 'Supply chain outcome tracking system', reason: 'Operational outcome monitoring', confidence: 0.78 }, { type: 'Trade intervention audit service', reason: 'Validates intervention outcomes', confidence: 0.75 }] },
    'SNIG': { fullName: 'Substantia Nigra', label: 'Predictive Evaluation', tier: 'operational', function: 'Evaluates predictive model performance and accuracy', dysregulation: 'Evaluation failure, model drift', expectedTypes: [{ type: 'Forecast evaluation platform', reason: 'Measures and improves prediction accuracy', confidence: 0.78 }, { type: 'Model performance monitoring', reason: 'Continuous prediction quality tracking', confidence: 0.75 }] },
    'SNS': { fullName: 'Sympathetic Nervous System', label: 'Compliance Systems', tier: 'operational', function: 'Operates compliance monitoring systems for trade', dysregulation: 'System failure, compliance gap', expectedTypes: [{ type: 'Automated compliance monitoring platform', reason: 'Continuous trade compliance tracking', confidence: 0.82 }, { type: 'Customs compliance management system', reason: 'Manages declarations and duties', confidence: 0.85 }] },
    'STN': { fullName: 'Subthalamic Nucleus', label: 'Compliance Governance', tier: 'operational', function: 'Governs compliance standards and enforcement', dysregulation: 'Governance failure, enforcement gap', expectedTypes: [{ type: 'Trade compliance governance consulting', reason: 'Designs compliance frameworks', confidence: 0.80 }, { type: 'Regulatory affairs management platform', reason: 'Tracks regulations and requirements', confidence: 0.78 }] },
    'STRI': { fullName: 'Striatum', label: 'Baseline Evaluation', tier: 'operational', function: 'Evaluates baseline performance and identifies deviations', dysregulation: 'Evaluation drift, deviation blindness', expectedTypes: [{ type: 'Performance deviation detection platform', reason: 'Identifies baseline departures', confidence: 0.78 }, { type: 'Trade operations audit service', reason: 'Evaluates against established baselines', confidence: 0.75 }] },
    'STS': { fullName: 'Superior Temporal Sulcus', label: 'Compliance Evaluation', tier: 'operational', function: 'Evaluates compliance effectiveness and coverage', dysregulation: 'Evaluation gap, coverage blindness', expectedTypes: [{ type: 'Compliance effectiveness assessment', reason: 'Measures compliance program quality', confidence: 0.78 }, { type: 'Trade compliance benchmarking', reason: 'Compares compliance across peers', confidence: 0.75 }] },
    'TPOLE': { fullName: 'Temporal Pole', label: 'Trend Analysis', tier: 'operational', function: 'Analyzes trends in trade flows, volumes, and disruptions', dysregulation: 'Trend blindness, analysis lag', expectedTypes: [{ type: 'Trade trend analytics platform', reason: 'Identifies emerging logistics trends', confidence: 0.82 }, { type: 'Freight market intelligence service', reason: 'Market trend reports and forecasts', confidence: 0.85 }] },
    'TrkB': { fullName: 'TrkB Receptor', label: 'Baseline Analysis', tier: 'operational', function: 'Analyzes baseline data to identify patterns and anomalies', dysregulation: 'Pattern miss, analysis failure', expectedTypes: [{ type: 'Anomaly detection platform', reason: 'Identifies unusual patterns in trade data', confidence: 0.80 }, { type: 'Trade data analysis service', reason: 'Deep analysis of logistics baselines', confidence: 0.78 }] },
    'UNC': { fullName: 'Uncinate Fasciculus', label: 'Data Collection', tier: 'operational', function: 'Collects and aggregates data across trade systems', dysregulation: 'Data gap, collection failure', expectedTypes: [{ type: 'Trade data aggregation platform', reason: 'Collects data across logistics systems', confidence: 0.80 }, { type: 'IoT sensor network for supply chain', reason: 'Real-time condition monitoring', confidence: 0.82 }] },
    'V1': { fullName: 'Primary Visual Cortex', label: 'Sensitivity Analysis', tier: 'operational', function: 'Performs sensitivity analysis on trade parameters', dysregulation: 'Sensitivity blindness, fragility miss', expectedTypes: [{ type: 'What-if analysis platform', reason: 'Tests parameter sensitivity for logistics', confidence: 0.78 }, { type: 'Trade scenario planning service', reason: 'Models impact of parameter changes', confidence: 0.75 }] },
    'VAN': { fullName: 'Ventral Attention Network', label: 'Workforce Operations', tier: 'operational', function: 'Operates workforce allocation and deployment', dysregulation: 'Allocation failure, deployment gap', expectedTypes: [{ type: 'Logistics labor marketplace', reason: 'On-demand warehouse and driver staffing', confidence: 0.85 }, { type: 'Workforce deployment platform', reason: 'Real-time labor allocation', confidence: 0.82 }] },
    'VERM': { fullName: 'Cerebellar Vermis', label: 'Core Operations', tier: 'operational', function: 'Manages core operational processes for trade', dysregulation: 'Operational failure, process breakdown', expectedTypes: [{ type: 'Logistics operations management platform', reason: 'End-to-end operations control', confidence: 0.82 }, { type: 'Trade operations consulting', reason: 'Optimizes core logistics processes', confidence: 0.78 }] },
    'VEST': { fullName: 'Vestibular System', label: 'Comparative Analysis', tier: 'operational', function: 'Maintains balance and comparison across trade metrics', dysregulation: 'Imbalance, comparison failure', expectedTypes: [{ type: 'Multi-modal logistics comparison platform', reason: 'Compares performance across transport modes', confidence: 0.82 }, { type: 'Trade balance analytics', reason: 'Analyzes trade flow equilibrium', confidence: 0.78 }] },
    'VP': { fullName: 'Ventral Pallidum', label: 'Change Analysis', tier: 'operational', function: 'Analyzes impact of changes across trade operations', dysregulation: 'Change blindness, impact miss', expectedTypes: [{ type: 'Change impact analysis platform', reason: 'Models downstream effects of trade changes', confidence: 0.78 }, { type: 'Supply chain change advisory', reason: 'Analyzes and guides operational changes', confidence: 0.75 }] },
    'VTA': { fullName: 'Ventral Tegmental Area', label: 'Cross-Domain Learning', tier: 'operational', function: 'Drives cross-domain learning and knowledge transfer', dysregulation: 'Learning failure, knowledge silo', expectedTypes: [{ type: 'Cross-industry benchmarking platform', reason: 'Transfers best practices across sectors', confidence: 0.78 }, { type: 'Logistics knowledge base', reason: 'Centralized trade operations knowledge', confidence: 0.75 }] },
    'VV': { fullName: 'Ventral Vagal Complex', label: 'Operational Integration', tier: 'operational', function: 'Integrates operational systems across trade functions', dysregulation: 'Integration failure, system fragmentation', expectedTypes: [{ type: 'Supply chain integration platform', reason: 'Connects logistics systems end-to-end', confidence: 0.82 }, { type: 'iPaaS for trade', reason: 'Integration-platform-as-a-service for logistics', confidence: 0.80 }] },
    'dACC': { fullName: 'Dorsal Anterior Cingulate', label: 'Infrastructure & Capacity', tier: 'operational', function: 'Manages infrastructure planning and capacity allocation', dysregulation: 'Infrastructure gap, capacity shortfall', expectedTypes: [{ type: 'Infrastructure planning platform', reason: 'Models and plans logistics infrastructure', confidence: 0.82 }, { type: 'Capacity allocation optimization', reason: 'Optimizes resource allocation across nodes', confidence: 0.80 }] },
    'mPFC': { fullName: 'Medial Prefrontal Cortex', label: 'Quality Operations', tier: 'operational', function: 'Operates quality management across trade systems', dysregulation: 'Quality failure, operations gap', expectedTypes: [{ type: 'Quality management platform for logistics', reason: 'Manages quality across trade operations', confidence: 0.80 }, { type: 'Trade quality certification body', reason: 'Certifies logistics quality standards', confidence: 0.78 }] },
    'rACC': { fullName: 'Rostral Anterior Cingulate', label: 'Quality Analysis', tier: 'operational', function: 'Analyzes quality metrics and identifies improvement areas', dysregulation: 'Analysis gap, quality blindness', expectedTypes: [{ type: 'Quality analytics platform', reason: 'Analyzes trade quality metrics', confidence: 0.78 }, { type: 'Root cause analysis for logistics quality', reason: 'Identifies quality failure sources', confidence: 0.80 }] },
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Compliance Operations', tier: 'operational', function: 'Operates day-to-day compliance processes', dysregulation: 'Operational compliance failure', expectedTypes: [{ type: 'Customs operations platform', reason: 'Day-to-day entry filing and compliance', confidence: 0.85 }, { type: 'Trade compliance operations service', reason: 'Outsourced compliance operations', confidence: 0.82 }] }
  };

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function loadApprovals() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveApprovals(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function approvalKey(nodeId, businessType) {
    return nodeId + '::' + businessType.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);
  }

  function getApprovalStatus(nodeId, businessType) {
    var approvals = loadApprovals();
    return approvals[approvalKey(nodeId, businessType)] || null;
  }

  function setApprovalStatus(nodeId, businessType, status, reason, reviewerRole) {
    var approvals = loadApprovals();
    var key = approvalKey(nodeId, businessType);
    var existing = approvals[key] || {};
    approvals[key] = {
      status: status,
      reason: reason || '',
      nodeId: nodeId,
      businessType: businessType,
      submitted_by: existing.submitted_by || 'operator',
      submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(),
      reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  // ══════════════════════════════════════════════════════════════════════
  // FULL HIERARCHY TRAVERSAL — loads ALL child portal data, not just top-level
  // ══════════════════════════════════════════════════════════════════════

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    // Check cache
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) {
      return callback(_hierarchyCache);
    }

    // Also check sessionStorage for persistence across re-renders
    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached;
        _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}

    // Start from brain portal cache (top-level)
    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('supplyChain');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {},    // nodeId -> [{name, ticker, reason, strength}]
      nodeTreatments: {},   // nodeId -> [{label, type, evidence}] (filtered)
      nodeDiagnoses: {},    // nodeId -> [diagnosisId]
      nodeLabels: {},       // nodeId -> first meaningful label
      nodeDepths: {},       // nodeId -> Set of depths seen
      allActivations: []    // flat list of all activations from all depths
    };

    // Process activations from any portal data
    function processActivations(acts, depth) {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var nid = a.brainNodeId;
        if (RI_NODES[nid]) continue; // Skip framework nodes

        if (!result.nodeCompanies[nid]) result.nodeCompanies[nid] = {};
        if (!result.nodeTreatments[nid]) result.nodeTreatments[nid] = {};
        if (!result.nodeDiagnoses[nid]) result.nodeDiagnoses[nid] = {};
        if (!result.nodeLabels[nid]) result.nodeLabels[nid] = a.domainLabel || nid;
        if (!result.nodeDepths[nid]) result.nodeDepths[nid] = {};
        result.nodeDepths[nid][depth] = true;

        // Companies — dedupe by ticker
        var cos = a.companies || [];
        for (var ci = 0; ci < cos.length; ci++) {
          var tk = cos[ci].ticker_or_id || cos[ci].name;
          if (!result.nodeCompanies[nid][tk]) {
            result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
          }
        }

        // Treatments — dedupe by label+type, filter generics
        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) {
            result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
          }
        }

        // Diagnoses
        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) {
          result.nodeDiagnoses[nid][dx[di]] = true;
        }

        result.allActivations.push({ brainNodeId: nid, depth: depth, label: a.domainLabel, companiesCount: cos.length });
      }
    }

    // Process top-level first
    processActivations(topLevel.activations || [], 0);

    // For now, we work with the top-level cache plus any child portals
    // we can fetch. Child portal fetching is async — we use the API.
    // Since child portals may not all be fetchable client-side, we
    // also embed the pre-computed counts from the registry.
    result._age = Date.now();
    _hierarchyCache = result;
    _hierarchyCacheAge = Date.now();

    try { sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(result)); } catch (e) {}

    callback(result);
  }

  // ══════════════════════════════════════════════════════════════════════
  // INFERENCE ENGINE — compares directory against full hierarchy
  // ══════════════════════════════════════════════════════════════════════

  function getTradeState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('supplyChain');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getTradeState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    // Build company index from hierarchy (or fall back to top-level portal)
    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      // Fallback: use top-level portal cache
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('supplyChain') : null;
      var portal = brain ? brain._portalCache : null;
      if (portal && portal.activations) {
        for (var ai = 0; ai < portal.activations.length; ai++) {
          var act = portal.activations[ai];
          var nid = act.brainNodeId;
          if (!nodeCompanyIndex[nid]) nodeCompanyIndex[nid] = {};
          var cos = act.companies || [];
          for (var ci = 0; ci < cos.length; ci++) {
            var tk = cos[ci].ticker_or_id || cos[ci].name;
            nodeCompanyIndex[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason };
          }
        }
      }
    }

    var mapped = [];
    var missing = [];
    var speculative = [];

    // For each node in the 103-node directory
    for (var nodeId in NODE_BUSINESS_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_BUSINESS_DIRECTORY[nodeId];
      var expectedTypes = dir.expectedTypes || [];
      var nodeActive = false;

      // Check if this node is in an active diagnosis circuit
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var cci = 0; cci < circuits.length; cci++) {
          if (circuits[cci].nodeId === nodeId) { nodeActive = true; break; }
        }
        if (nodeActive) break;
      }

      // Get existing companies for this node from full hierarchy
      var existingCos = nodeCompanyIndex[nodeId] || {};
      var mappedCompanyNames = [];
      for (var tk in existingCos) {
        mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')');
      }

      for (var ti = 0; ti < expectedTypes.length; ti++) {
        var expected = expectedTypes[ti];
        var key = approvalKey(nodeId, expected.type);
        var approval = approvals[key] || null;

        // Check if this business type is already represented
        var alreadyMapped = false;
        var typeWords = expected.type.toLowerCase().split(/\s+/);
        for (var mi = 0; mi < mappedCompanyNames.length; mi++) {
          var compLower = mappedCompanyNames[mi].toLowerCase();
          var matchCount = 0;
          for (var wi = 0; wi < typeWords.length; wi++) {
            if (typeWords[wi].length > 3 && compLower.indexOf(typeWords[wi]) !== -1) matchCount++;
          }
          if (matchCount >= 2) { alreadyMapped = true; break; }
        }

        // Also check by functional_reason overlap
        if (!alreadyMapped) {
          for (var ck in existingCos) {
            var fr = (existingCos[ck].reason || '').toLowerCase();
            var matchCount2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) matchCount2++;
            }
            if (matchCount2 >= 2) { alreadyMapped = true; break; }
          }
        }

        // Approval consequence
        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) {
            consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Trade. It will appear as a valid investment and research target tied to ' + dir.label + '.';
          } else if (expected.confidence >= 0.75) {
            consequence = 'If approved: this business type becomes eligible for future portal path mapping and audit tracking within Trade.';
          } else {
            consequence = 'If approved: this business type is recorded as a valid Trade mapping for audit tracking. Requires further validation.';
          }
        }

        // Variant state
        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) {
          variantState = 'MISSING';
        } else if (!alreadyMapped) {
          variantState = 'PROPOSED';
        } else {
          variantState = 'MAPPED';
        }
        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey,
          nodeId: nodeId,
          nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label,
          nodeFunction: dir.function,
          plainFunction: dir.function,
          dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type,
          reason: expected.reason,
          confidence: expected.confidence,
          nodeActive: nodeActive,
          alreadyMapped: alreadyMapped,
          existingCompanies: mappedCompanyNames,
          approval: approval,
          approvalRequired: showButtons,
          variantState: variantState,
          approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' +
            (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) {
          entry.bucket = 'MAPPED';
          mapped.push(entry);
        } else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) {
            setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence');
            entry.approval = getApprovalStatus(nodeId, expected.type);
          }
          speculative.push(entry);
        }
      }
    }

    // Dedup
    function dedupeExact(arr) {
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped);
    missing = dedupeExact(missing);
    speculative = dedupeExact(speculative);

    // Sort: top-tier first, then active nodes, then confidence
    var sortFn = function (a, b) {
      var tierOrder = { 'top': 0, 'operational': 1 };
      var ta = tierOrder[a.tier] || 1, tb = tierOrder[b.tier] || 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn);
    missing.sort(sortFn);
    speculative.sort(sortFn);

    return { mapped: mapped, missing: missing, speculative: speculative, error: null };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function getApprovedMappings() {
    var result = runInference(null);
    var approved = [];
    var all = result.missing.concat(result.speculative);
    for (var i = 0; i < all.length; i++) {
      if (all[i].approval && all[i].approval.status === 'APPROVED') {
        approved.push(all[i]);
      }
    }
    return approved;
  }

  window.LIMENTradeBusinessEngine = {
    runInference: function () { return runInference(_hierarchyCache); },
    runInferenceWithHierarchy: runInference,
    loadFullHierarchy: loadFullHierarchy,
    getApprovedMappings: getApprovedMappings,
    setApprovalStatus: setApprovalStatus,
    getApprovalStatus: getApprovalStatus,
    loadApprovals: loadApprovals,
    NODE_DIRECTORY: NODE_BUSINESS_DIRECTORY,
    RI_NODES: RI_NODES,
    isGenericTreatment: isGenericTreatment
  };

  // Auto-load hierarchy on init
  loadFullHierarchy(function () {
    console.log('[TradeBusinessEngine] Hierarchy loaded');
  });

  console.log('[TradeBusinessEngine] Loaded \u2014 103-node full-hierarchy trade business assignment engine');

})();
