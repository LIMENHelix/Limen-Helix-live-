/**
 * economy-node-business-engine.js — Economy Node-to-Business Assignment Engine
 *
 * ECONOMY DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture:
 *   - Covers 103 operational nodes (20 RI/framework nodes excluded)
 *   - Filters generic template treatments before inference
 *   - Compares existing companies against business-type directory
 *
 * Outputs 3 buckets:
 *   MAPPED     — already mapped and active in Economy system
 *   MISSING    — plausible but missing from current Economy mappings
 *   SPECULATIVE — low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_economy_business_approvals')
 *
 * Self-gates: only runs when ?domain=economy is in the URL.
 * Exposes: window.LIMENEconomyBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'economy') return;

  var STORAGE_KEY = 'limen_economy_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_economy_hierarchy_cache';
  var HIERARCHY_TTL = 10 * 60 * 1000;

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
  // GENERIC TREATMENT FILTER
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
  // ══════════════════════════════════════════════════════════════════════

  var NODE_BUSINESS_DIRECTORY = {

    // ── TOP-TIER (20 portal-active) ──────────────────────────────────

    'M1': {
      fullName: 'Primary Motor Cortex', label: 'Industrial Production', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage — sends direct commands for voluntary movement.', inBusiness: 'In the economy, this is industrial production. Raw inputs are converted into manufactured goods, factory output, and physical economic activity that moves GDP.' },
      function: 'Converts raw materials and labor into manufactured output, factory production, and industrial capacity',
      dysregulation: 'Production slowdown, manufacturing recession, capacity utilization collapse',
      expectedTypes: [
        { type: 'Industrial production analytics firm', reason: 'Tracks factory output, capacity utilization, and manufacturing PMI for economic forecasting', confidence: 0.95 },
        { type: 'Manufacturing economics consultancy', reason: 'Advises on reshoring decisions, industrial policy impact, and factory location economics', confidence: 0.88 },
        { type: 'Supply chain economics platform', reason: 'Models input-output relationships, production bottlenecks, and industrial multiplier effects', confidence: 0.85 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'GDP Measurement & National Accounts', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays nearly all sensory and motor signals between subcortical structures and cortex.', inBusiness: 'In the economy, this is GDP measurement — the central relay of economic activity data from all sectors into national income and product accounts.' },
      function: 'Measures and reports GDP, national income, and economic output across all sectors',
      dysregulation: 'GDP measurement revision, statistical discrepancy, delayed economic assessment',
      expectedTypes: [
        { type: 'GDP nowcasting platform', reason: 'Real-time GDP estimation using high-frequency economic indicators', confidence: 0.95 },
        { type: 'National accounts advisory', reason: 'SNA methodology, GDP composition analysis, and economic measurement consulting', confidence: 0.88 },
        { type: 'Economic data aggregation service', reason: 'Consolidates BEA, BLS, Census, and Fed data into unified economic dashboards', confidence: 0.85 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Consumer Spending & Demand', tier: 'top',
      neuroTranslation: { inNeurology: 'Central to habit formation and reward-based learning through dopaminergic feedback.', inBusiness: 'In the economy, this is consumer spending — the habitual consumption patterns and reward-seeking purchases that drive 70% of US GDP.' },
      function: 'Drives consumer spending, retail sales, and household consumption that constitutes the largest GDP component',
      dysregulation: 'Consumer spending collapse, retail recession, demand shock',
      expectedTypes: [
        { type: 'Consumer economics research firm', reason: 'Tracks household spending patterns, consumer confidence, and retail economics', confidence: 0.95 },
        { type: 'Retail analytics platform', reason: 'Real-time consumer spending data from card transactions, POS, and e-commerce', confidence: 0.90 },
        { type: 'Demand forecasting consultancy', reason: 'Models consumer demand elasticity, substitution effects, and spending multipliers', confidence: 0.85 }
      ]
    },
    'VTA': {
      fullName: 'Ventral Tegmental Area', label: 'Economic Growth & Innovation', tier: 'top',
      neuroTranslation: { inNeurology: 'Origin of mesolimbic dopamine pathway — drives reward-seeking and novelty exploration.', inBusiness: 'In the economy, this is growth and innovation — the entrepreneurial drive, R&D investment, and Schumpeterian creative destruction that propel economic expansion.' },
      function: 'Drives economic growth through innovation, entrepreneurship, R&D investment, and productivity gains',
      dysregulation: 'Growth stagnation, innovation drought, productivity plateau',
      expectedTypes: [
        { type: 'Innovation economics advisory', reason: 'R&D policy impact, technology transfer economics, and innovation ecosystem design', confidence: 0.92 },
        { type: 'Productivity analytics firm', reason: 'Total factor productivity measurement, growth accounting, and efficiency analysis', confidence: 0.88 },
        { type: 'Entrepreneurship economics platform', reason: 'Startup ecosystem analytics, venture formation rates, and business dynamism metrics', confidence: 0.82 }
      ]
    },
    'PAG': {
      fullName: 'Periaqueductal Gray', label: 'Economic Risk & Insurance Economics', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates defensive responses and pain modulation under threat.', inBusiness: 'In the economy, this is economic risk management — catastrophe modeling, insurance economics, and systemic risk assessment that protect against economic shocks.' },
      function: 'Assesses and manages macroeconomic risks including recession probability, systemic shocks, and catastrophe impact',
      dysregulation: 'Unpriced systemic risk, catastrophe loss cascade, risk model failure',
      expectedTypes: [
        { type: 'Macroeconomic risk analytics firm', reason: 'Recession probability models, stress testing, and economic tail risk assessment', confidence: 0.92 },
        { type: 'Insurance economics consultancy', reason: 'Catastrophe loss modeling, actuarial economics, and insurable risk analysis', confidence: 0.85 },
        { type: 'Economic scenario planning service', reason: 'Multi-scenario economic modeling for corporate and government planning', confidence: 0.82 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Economic History & Long-Run Trends', tier: 'top',
      neuroTranslation: { inNeurology: 'Forms and consolidates new memories into long-term storage.', inBusiness: 'In the economy, this is economic history — the accumulation of long-run data, business cycle records, and secular trend analysis that inform current policy.' },
      function: 'Preserves and analyzes long-run economic data, business cycle history, and secular trends',
      dysregulation: 'Historical amnesia leading to policy repeat errors, trend misidentification',
      expectedTypes: [
        { type: 'Economic history research institute', reason: 'Long-run datasets, historical business cycle analysis, and economic precedent research', confidence: 0.88 },
        { type: 'Secular trend analytics platform', reason: 'Demographic shifts, technological waves, and structural economic change analysis', confidence: 0.85 },
        { type: 'Business cycle dating service', reason: 'NBER-style recession dating, expansion analysis, and cycle comparison tools', confidence: 0.80 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Government Revenue & Taxation', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary relay for visceral sensory input — integrates cardiovascular and respiratory signals.', inBusiness: 'In the economy, this is government revenue — the vital flow of tax receipts, fees, and transfers that fund public services and fiscal operations.' },
      function: 'Collects and analyzes government tax revenue, fiscal receipts, and public sector income across jurisdictions',
      dysregulation: 'Revenue shortfall, tax base erosion, collection lag, fiscal cliff',
      expectedTypes: [
        { type: 'Tax policy economics firm', reason: 'Tax structure design, revenue forecasting, and tax incidence analysis', confidence: 0.92 },
        { type: 'Government revenue analytics platform', reason: 'Real-time tax receipt tracking, revenue forecasting, and fiscal gap analysis', confidence: 0.88 },
        { type: 'Tax burden and competitiveness advisory', reason: 'Cross-jurisdictional tax comparison, effective rate analysis, and incentive economics', confidence: 0.82 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'International Trade & Globalization', tier: 'top',
      neuroTranslation: { inNeurology: 'Largest white matter tract connecting left and right hemispheres.', inBusiness: 'In the economy, this is international trade — the flows of goods, services, and capital that connect national economies across the globe.' },
      function: 'Connects national economies through trade flows, capital movements, and globalization dynamics',
      dysregulation: 'Trade war, protectionism wave, supply chain decoupling, balance of payments crisis',
      expectedTypes: [
        { type: 'International trade analytics platform', reason: 'Trade flow visualization, tariff impact modeling, and trade balance analysis', confidence: 0.95 },
        { type: 'Globalization economics advisory', reason: 'Supply chain restructuring, nearshoring economics, and trade agreement analysis', confidence: 0.88 },
        { type: 'Cross-border economic intelligence firm', reason: 'FDI tracking, capital flow analysis, and international economic comparison', confidence: 0.85 }
      ]
    },
    'FORN': {
      fullName: 'Fornix', label: 'Economic Data Infrastructure', tier: 'top',
      neuroTranslation: { inNeurology: 'Major white matter bundle carrying output from hippocampus — dedicated fiber pathway.', inBusiness: 'In the economy, this is economic data infrastructure — the dedicated pipelines carrying BLS, BEA, Census, and Fed data to analysts and policymakers.' },
      function: 'Provides core economic data infrastructure including statistical pipelines, APIs, and dissemination systems',
      dysregulation: 'Data delay, statistical revision, methodology change disruption',
      expectedTypes: [
        { type: 'Economic data API platform', reason: 'Unified API access to BLS, BEA, Census, FRED, and international economic data', confidence: 0.92 },
        { type: 'Economic statistics consultancy', reason: 'Statistical methodology, seasonal adjustment, and data quality advisory', confidence: 0.85 },
        { type: 'Alternative economic data vendor', reason: 'Satellite imagery, credit card, and web-scraped high-frequency economic indicators', confidence: 0.88 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum', label: 'Monetary Policy & Central Banking', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates voluntary movement with precise timing and calibration.', inBusiness: 'In the economy, this is monetary policy — precisely calibrated interest rate decisions, open market operations, and quantitative tools that steer the macroeconomy.' },
      function: 'Implements monetary policy through interest rates, reserve requirements, and balance sheet operations',
      dysregulation: 'Policy rate miscalibration, inflation overshoot, deflation trap, yield curve inversion',
      expectedTypes: [
        { type: 'Monetary policy analytics firm', reason: 'Fed watch, rate path forecasting, and monetary transmission analysis', confidence: 0.95 },
        { type: 'Central bank advisory service', reason: 'Monetary policy strategy, CBDC design, and reserve management consulting', confidence: 0.88 },
        { type: 'Interest rate economics platform', reason: 'Yield curve modeling, rate sensitivity analysis, and monetary condition indices', confidence: 0.85 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Economic Valuation & Pricing', tier: 'top',
      neuroTranslation: { inNeurology: 'Assigns value to choices and outcomes — integrates reward for decision-making.', inBusiness: 'In the economy, this is price formation — how markets assign value to goods, services, and assets through supply-demand dynamics and price discovery.' },
      function: 'Analyzes price formation, inflation dynamics, and economic valuation across markets',
      dysregulation: 'Price distortion, asset bubble, deflation, stagflation',
      expectedTypes: [
        { type: 'Inflation economics consultancy', reason: 'CPI decomposition, inflation forecasting, and price dynamics analysis', confidence: 0.95 },
        { type: 'Asset valuation economics firm', reason: 'Fundamental value analysis, bubble detection, and market efficiency assessment', confidence: 0.88 },
        { type: 'Pricing analytics platform', reason: 'Commodity pricing models, hedonic price indices, and cost-of-living analysis', confidence: 0.82 }
      ]
    },
    'S1': {
      fullName: 'Primary Somatosensory Cortex', label: 'Economic Indicators & Surveys', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes tactile, pressure, and temperature signals from the body.', inBusiness: 'In the economy, this is the raw sensory layer — PMI, jobless claims, retail sales, housing starts, and other leading/coincident indicators.' },
      function: 'Collects and disseminates raw economic indicators including employment, output, and sentiment data',
      dysregulation: 'Indicator revision, survey response decline, measurement methodology shift',
      expectedTypes: [
        { type: 'Economic indicator analytics platform', reason: 'Real-time economic indicator tracking, composite indices, and recession probability', confidence: 0.95 },
        { type: 'Survey economics firm', reason: 'Consumer and business sentiment surveys, expectations measurement, and behavioral economics', confidence: 0.85 },
        { type: 'High-frequency economic data vendor', reason: 'Daily and weekly economic activity indicators from non-traditional sources', confidence: 0.88 }
      ]
    },
    'ENS': {
      fullName: 'Enteric Nervous System', label: 'Government Spending & Fiscal Policy', tier: 'top',
      neuroTranslation: { inNeurology: 'Autonomous nervous system of the gut — manages digestion independently.', inBusiness: 'In the economy, this is government spending — the autonomous fiscal processing layer handling budgets, appropriations, and expenditures.' },
      function: 'Plans and executes government spending including budgets, appropriations, and public investment',
      dysregulation: 'Budget crisis, government shutdown, fiscal cliff, spending inefficiency',
      expectedTypes: [
        { type: 'Fiscal policy economics firm', reason: 'Government spending analysis, fiscal multiplier estimation, and budget impact modeling', confidence: 0.92 },
        { type: 'Public finance advisory', reason: 'Municipal and state budget optimization, debt management, and capital planning', confidence: 0.88 },
        { type: 'Government spending analytics platform', reason: 'Federal and state expenditure tracking, contract analysis, and procurement economics', confidence: 0.82 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Economic Planning & Forecasting', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and multi-goal coordination.', inBusiness: 'In the economy, this is economic planning — macroeconomic forecasting, scenario analysis, and multi-objective policy optimization.' },
      function: 'Develops economic forecasts, scenario analyses, and policy optimization models',
      dysregulation: 'Forecast error cascade, planning horizon blindness, multi-objective policy conflict',
      expectedTypes: [
        { type: 'Macroeconomic forecasting firm', reason: 'GDP, employment, and inflation forecasting for institutional clients', confidence: 0.95 },
        { type: 'Economic scenario modeling platform', reason: 'Monte Carlo simulation, stress testing, and multi-scenario economic planning', confidence: 0.88 },
        { type: 'Policy optimization consultancy', reason: 'Fiscal-monetary policy interaction, welfare economics, and optimal policy design', confidence: 0.82 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Economic Anomaly Detection', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflicts and errors, signaling when corrective action is needed.', inBusiness: 'In the economy, this is anomaly detection — identifying data irregularities, structural breaks, and economic regime changes that require corrective response.' },
      function: 'Detects economic anomalies, structural breaks, and regime changes in macroeconomic data',
      dysregulation: 'Undetected structural break, regime change blindness, false signal proliferation',
      expectedTypes: [
        { type: 'Economic regime detection platform', reason: 'Statistical change-point detection, regime-switching models, and structural break analysis', confidence: 0.90 },
        { type: 'Economic fraud and manipulation detection', reason: 'Statistical manipulation of economic data, sanctions evasion analytics', confidence: 0.82 },
        { type: 'Economic early warning system', reason: 'Leading indicator composite scoring and recession probability alerts', confidence: 0.88 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Economic Regulation & Standards', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes subjective value and integrates emotional significance into decisions.', inBusiness: 'In the economy, this is economic regulation — antitrust, consumer protection, and market regulation that sets the rules of economic competition.' },
      function: 'Sets and enforces economic regulations including antitrust, consumer protection, and market competition rules',
      dysregulation: 'Regulatory capture, antitrust failure, market concentration abuse',
      expectedTypes: [
        { type: 'Regulatory economics consultancy', reason: 'Antitrust analysis, market concentration measurement, and regulatory impact assessment', confidence: 0.92 },
        { type: 'Competition economics firm', reason: 'Merger analysis, market definition, and competitive effects modeling (HHI, SSNIP)', confidence: 0.90 },
        { type: 'Economic regulation advisory', reason: 'Utility rate design, natural monopoly regulation, and public interest economics', confidence: 0.82 }
      ]
    },
    'BNST': {
      fullName: 'Bed Nucleus of the Stria Terminalis', label: 'Economic Uncertainty & Volatility', tier: 'top',
      neuroTranslation: { inNeurology: 'Mediates sustained anxiety and vigilance to uncertain threats.', inBusiness: 'In the economy, this is economic uncertainty — policy uncertainty indices, geopolitical risk, and the sustained ambiguity that suppresses investment and hiring.' },
      function: 'Measures and manages economic uncertainty including policy risk, geopolitical exposure, and investment hesitancy',
      dysregulation: 'Elevated uncertainty freezing investment, confidence collapse, policy paralysis',
      expectedTypes: [
        { type: 'Economic uncertainty analytics firm', reason: 'EPU index construction, geopolitical risk scoring, and uncertainty impact modeling', confidence: 0.90 },
        { type: 'Geopolitical risk economics advisory', reason: 'Sanctions impact, trade war modeling, and geopolitical scenario analysis', confidence: 0.88 },
        { type: 'Investment confidence analytics platform', reason: 'Business and consumer confidence tracking, investment intentions, and capex forecasting', confidence: 0.82 }
      ]
    },
    'CAUD': {
      fullName: 'Caudate', label: 'Digital Economy & Platform Economics', tier: 'top',
      neuroTranslation: { inNeurology: 'Part of basal ganglia involved in goal-directed action selection and reward anticipation.', inBusiness: 'In the economy, this is the digital economy — platform economics, gig economy measurement, and the goal-directed pursuit of network effects and digital value creation.' },
      function: 'Measures and analyzes digital economy activity including platform economics, e-commerce, and digital GDP',
      dysregulation: 'Digital measurement gap, platform monopoly, gig economy misclassification',
      expectedTypes: [
        { type: 'Digital economy measurement firm', reason: 'Digital GDP estimation, e-commerce analytics, and platform economic impact assessment', confidence: 0.90 },
        { type: 'Platform economics consultancy', reason: 'Two-sided market analysis, network effects modeling, and digital antitrust economics', confidence: 0.88 },
        { type: 'Gig economy analytics platform', reason: 'Independent worker measurement, alternative work arrangement economics, and labor market disruption analysis', confidence: 0.82 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Fields', label: 'Economic Development & Zones', tier: 'top',
      neuroTranslation: { inNeurology: 'Controls voluntary eye movements directing visual attention.', inBusiness: 'In the economy, this is directed economic development — enterprise zones, opportunity zones, and targeted industrial policy directing resources to specific regions.' },
      function: 'Designs and evaluates targeted economic development programs, enterprise zones, and industrial policy',
      dysregulation: 'Misallocated development funds, opportunity zone abuse, industrial policy failure',
      expectedTypes: [
        { type: 'Economic development consultancy', reason: 'Opportunity zone analysis, enterprise zone design, and incentive program evaluation', confidence: 0.92 },
        { type: 'Regional economics analytics platform', reason: 'Metro-level economic tracking, regional competitive advantage, and site selection economics', confidence: 0.88 },
        { type: 'Industrial policy advisory', reason: 'Sector targeting, cluster development, and strategic industry support economics', confidence: 0.82 }
      ]
    },
    'EMP': {
      fullName: 'Empathy', label: 'Inequality & Distributional Economics', tier: 'top',
      neuroTranslation: { inNeurology: 'Neural basis of understanding others\' states and experiences.', inBusiness: 'In the economy, this is inequality and distributional economics — understanding how economic gains and losses are distributed across income groups, regions, and demographics.' },
      function: 'Measures and analyzes economic inequality, income distribution, and social mobility',
      dysregulation: 'Rising inequality, social mobility collapse, distributional blind spot in policy',
      expectedTypes: [
        { type: 'Inequality economics research firm', reason: 'Gini coefficient analysis, income distribution tracking, and wealth gap measurement', confidence: 0.92 },
        { type: 'Social mobility analytics platform', reason: 'Intergenerational mobility measurement, opportunity index construction, and access gap analysis', confidence: 0.85 },
        { type: 'Distributional impact advisory', reason: 'Policy distributional analysis, progressive/regressive impact scoring, and equity assessment', confidence: 0.82 }
      ]
    },
    'BROCA': {
      fullName: 'Broca\'s Area', label: 'Economic Report Generation', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured speech output — translates thought into articulated language.', inBusiness: 'In the economy, this is economic report production — translating raw economic data and models into structured analysis, policy briefs, and economic commentary.' },
      function: 'Produces structured economic reports, policy briefs, and analytical commentary from data',
      dysregulation: 'Report delay, analytical bias, communication failure between data and policy',
      expectedTypes: [
        { type: 'Economic research publication platform', reason: 'Automated economic report generation, data visualization, and policy brief production', confidence: 0.88 },
        { type: 'Economic communication advisory', reason: 'Central bank communication strategy, Fed-speak analysis, and market guidance economics', confidence: 0.82 },
        { type: 'Economic journalism analytics', reason: 'Economic narrative tracking, media sentiment analysis, and public understanding measurement', confidence: 0.78 }
      ]
    },
    'CING': {
      fullName: 'Cingulum', label: 'Supply Chain Economics', tier: 'top',
      neuroTranslation: { inNeurology: 'White matter bundle connecting frontal and temporal lobes — carries signals along a fixed pathway.', inBusiness: 'In the economy, this is supply chain economics — the fixed pathways of goods flow from raw material to consumer, including logistics costs and inventory economics.' },
      function: 'Analyzes supply chain economics including logistics costs, inventory dynamics, and goods flow optimization',
      dysregulation: 'Supply chain disruption, bullwhip effect, logistics cost spike, inventory imbalance',
      expectedTypes: [
        { type: 'Supply chain economics consultancy', reason: 'Logistics cost modeling, inventory optimization, and supply chain resilience assessment', confidence: 0.90 },
        { type: 'Freight economics analytics platform', reason: 'Shipping rate forecasting, transport economics, and freight demand modeling', confidence: 0.85 },
        { type: 'Inventory economics research firm', reason: 'Just-in-time vs just-in-case analysis, stockpile optimization, and buffer stock economics', confidence: 0.78 }
      ]
    },

    // ── OPERATIONAL NODES (83) ───────────────────────────────────────

    'A1': { fullName: 'Primary Auditory Cortex', label: 'Economic Intelligence & SIGINT', tier: 'operational', function: 'Monitors economic communications, policy announcements, and market signals for actionable intelligence', dysregulation: 'Missed policy signal, earnings season surprise, regulatory announcement misread', expectedTypes: [
      { type: 'Economic signal intelligence platform', reason: 'NLP analysis of FOMC statements, earnings calls, and policy announcements', confidence: 0.88 },
      { type: 'Policy announcement analytics', reason: 'Real-time parsing and impact scoring of government economic releases', confidence: 0.82 }
    ]},
    'ADR': { fullName: 'Adrenal', label: 'Crisis Economics & Emergency Response', tier: 'operational', function: 'Mobilizes emergency economic response during crises and recessions', dysregulation: 'Slow fiscal response, stimulus misallocation, emergency spending waste', expectedTypes: [
      { type: 'Crisis economics advisory', reason: 'Recession response design, emergency fiscal stimulus modeling, and economic disaster assessment', confidence: 0.88 },
      { type: 'Economic disaster impact firm', reason: 'Natural disaster economic loss estimation and recovery trajectory modeling', confidence: 0.82 }
    ]},
    'AG': { fullName: 'Angular Gyrus', label: 'Economic Standards & Classification', tier: 'operational', function: 'Maintains economic classification standards (NAICS, SOC, HS codes) and statistical methodology', dysregulation: 'Classification obsolescence, cross-country comparison failure, methodology inconsistency', expectedTypes: [
      { type: 'Economic classification consultancy', reason: 'NAICS, SOC, HS code mapping and industry classification advisory', confidence: 0.85 },
      { type: 'Statistical methodology advisory', reason: 'Economic measurement standards, seasonal adjustment, and data quality improvement', confidence: 0.80 }
    ]},
    'AI': { fullName: 'Anterior Insula', label: 'Economic Health Monitoring', tier: 'operational', function: 'Provides real-time visibility into economic health through composite indicators and dashboards', dysregulation: 'Economic health blind spot, delayed recession recognition, false prosperity signal', expectedTypes: [
      { type: 'Economic health dashboard platform', reason: 'Composite economic health indices, heat maps, and real-time monitoring', confidence: 0.88 },
      { type: 'Recession probability service', reason: 'Yield curve analysis, leading indicator models, and downturn probability estimation', confidence: 0.85 }
    ]},
    'ANT': { fullName: 'Anterior Thalamus', label: 'Economic Transaction Settlement', tier: 'operational', function: 'Facilitates economic transaction clearing and settlement across markets', dysregulation: 'Settlement backlog, clearing system failure, transaction recording error', expectedTypes: [
      { type: 'Economic transaction analytics', reason: 'Payment flow economics, settlement efficiency, and transaction cost analysis', confidence: 0.82 },
      { type: 'Market microstructure economics firm', reason: 'Bid-ask spread analysis, price discovery economics, and trading cost modeling', confidence: 0.78 }
    ]},
    'ARC': { fullName: 'Arcuate Fasciculus', label: 'Economic Data Pipelines & APIs', tier: 'operational', function: 'Connects economic data systems through standardized pipelines and APIs', dysregulation: 'Data pipeline failure, API version mismatch, integration breakdown', expectedTypes: [
      { type: 'Economic data integration platform', reason: 'Multi-source economic data aggregation, normalization, and API delivery', confidence: 0.88 },
      { type: 'Statistical data interchange service', reason: 'SDMX implementation, cross-agency data sharing, and interoperability consulting', confidence: 0.78 }
    ]},
    'BDNF': { fullName: 'BDNF / Plasticity', label: 'Economic Modernization & Reform', tier: 'operational', function: 'Drives economic system modernization, statistical reform, and institutional transformation', dysregulation: 'Institutional ossification, reform resistance, modernization failure', expectedTypes: [
      { type: 'Economic modernization advisory', reason: 'Statistical system modernization, economic institution reform, and digital government economics', confidence: 0.85 },
      { type: 'Economic transformation consultancy', reason: 'Post-industrial transition, green economy transition, and structural reform design', confidence: 0.82 }
    ]},
    'BLA': { fullName: 'Basolateral Amygdala', label: 'Credit Risk & Debt Economics', tier: 'operational', function: 'Assesses credit risk, sovereign debt sustainability, and leverage dynamics', dysregulation: 'Sovereign debt crisis, credit bubble, leverage cycle blowup', expectedTypes: [
      { type: 'Sovereign debt analytics firm', reason: 'Debt sustainability analysis, fiscal space estimation, and default probability modeling', confidence: 0.90 },
      { type: 'Credit cycle economics platform', reason: 'Private sector debt dynamics, leverage ratio tracking, and credit impulse measurement', confidence: 0.85 }
    ]},
    'CARD': { fullName: 'Cardiac', label: 'Core Economic Systems', tier: 'operational', function: 'Runs core economic processing systems including payment networks and transaction engines', dysregulation: 'Payment system outage, economic processing failure, systemic infrastructure breakdown', expectedTypes: [
      { type: 'Economic infrastructure analytics', reason: 'Payment system economics, financial plumbing assessment, and infrastructure resilience scoring', confidence: 0.82 },
      { type: 'Core economic systems consultancy', reason: 'Central bank operations, payment system design, and economic infrastructure modernization', confidence: 0.78 }
    ]},
    'CLAUST': { fullName: 'Claustrum', label: 'Economic System Integration', tier: 'operational', function: 'Integrates diverse economic data streams into unified economic intelligence', dysregulation: 'Data fragmentation, siloed economic analysis, inconsistent measurement', expectedTypes: [
      { type: 'Economic data fusion platform', reason: 'Cross-agency economic data integration, unified dashboards, and holistic economic views', confidence: 0.85 },
      { type: 'Economic intelligence integration firm', reason: 'Combines micro and macro data for comprehensive economic assessment', confidence: 0.80 }
    ]},
    'CMZ': { fullName: 'Cerebellar Motor Zone', label: 'Economic Infrastructure & Capacity', tier: 'operational', function: 'Provides physical economic infrastructure including ports, roads, and utility capacity', dysregulation: 'Infrastructure bottleneck, capacity constraint, physical capital underinvestment', expectedTypes: [
      { type: 'Infrastructure economics firm', reason: 'Cost-benefit analysis, infrastructure multiplier estimation, and public investment prioritization', confidence: 0.90 },
      { type: 'Capacity utilization analytics', reason: 'Industrial capacity measurement, bottleneck identification, and capital stock estimation', confidence: 0.82 }
    ]},
    'CON': { fullName: 'Cingulo-Opercular Network', label: 'Economic Operations & Monitoring', tier: 'operational', function: 'Sustains daily economic monitoring operations and data collection processes', dysregulation: 'Survey response decline, data collection disruption, monitoring gap', expectedTypes: [
      { type: 'Economic survey operations firm', reason: 'Survey design, data collection methodology, and response rate optimization', confidence: 0.82 },
      { type: 'Continuous economic monitoring platform', reason: 'Always-on economic tracking with automated anomaly detection', confidence: 0.80 }
    ]},
    'CeA': { fullName: 'Central Amygdala', label: 'Economic Crime & Sanctions', tier: 'operational', function: 'Prevents and investigates economic crime including sanctions evasion, money laundering, and trade fraud', dysregulation: 'Sanctions evasion undetected, trade-based money laundering, economic crime wave', expectedTypes: [
      { type: 'Economic sanctions analytics firm', reason: 'Sanctions impact modeling, evasion detection, and compliance economics', confidence: 0.88 },
      { type: 'Trade fraud economics platform', reason: 'Trade misinvoicing detection, transfer pricing abuse, and illicit financial flows analysis', confidence: 0.82 }
    ]},
    'DAN': { fullName: 'Dorsal Attention Network', label: 'Economic Due Diligence', tier: 'operational', function: 'Conducts targeted economic due diligence on markets, sectors, and policy proposals', dysregulation: 'Inadequate economic analysis, missed structural weakness, superficial assessment', expectedTypes: [
      { type: 'Economic due diligence firm', reason: 'Market entry economics, sector analysis, and economic feasibility assessment', confidence: 0.88 },
      { type: 'Policy impact analysis consultancy', reason: 'Regulatory impact analysis, CBA for policy proposals, and economic burden estimation', confidence: 0.85 }
    ]},
    'DISS': { fullName: 'Dissolution', label: 'Economic Restructuring & Decline', tier: 'operational', function: 'Manages economic decline, industrial restructuring, and community transition', dysregulation: 'Disorderly industrial decline, community economic collapse, stranded asset crisis', expectedTypes: [
      { type: 'Economic transition advisory', reason: 'Coal community transition, industrial restructuring economics, and economic base diversification', confidence: 0.88 },
      { type: 'Stranded asset economics firm', reason: 'Fossil fuel asset stranding, technology obsolescence economics, and transition cost estimation', confidence: 0.82 }
    ]},
    'DMN': { fullName: 'Default Mode Network', label: 'Long-Range Economic Planning', tier: 'operational', function: 'Develops long-range economic plans, demographic projections, and fiscal sustainability models', dysregulation: 'Short-termism, demographic blindness, fiscal unsustainability', expectedTypes: [
      { type: 'Demographic economics firm', reason: 'Population projections, aging economics, and labor force forecasting', confidence: 0.90 },
      { type: 'Fiscal sustainability advisory', reason: 'Long-run fiscal projections, Social Security/Medicare actuarial analysis, and generational accounting', confidence: 0.85 }
    ]},
    'DV': { fullName: 'Dorsal Vagal', label: 'Economic Circuit Breakers & Stabilizers', tier: 'operational', function: 'Implements automatic economic stabilizers and circuit breakers during downturns', dysregulation: 'Stabilizer inadequacy, automatic spending trigger failure, safety net gaps', expectedTypes: [
      { type: 'Automatic stabilizer economics firm', reason: 'Unemployment insurance design, SNAP economics, and counter-cyclical program analysis', confidence: 0.85 },
      { type: 'Economic safety net analytics', reason: 'Safety net adequacy scoring, benefit cliff analysis, and social insurance economics', confidence: 0.80 }
    ]},
    'EC': { fullName: 'Entorhinal Cortex', label: 'Economic Geography & Spatial Economics', tier: 'operational', function: 'Maps economic activity across geographic space including clusters, agglomerations, and spatial inequality', dysregulation: 'Spatial mismatch, geographic inequality, agglomeration dysfunction', expectedTypes: [
      { type: 'Spatial economics analytics platform', reason: 'Economic heat maps, cluster identification, and agglomeration analysis', confidence: 0.88 },
      { type: 'Economic geography consultancy', reason: 'Location economics, urban-rural divide analysis, and economic corridor assessment', confidence: 0.82 }
    ]},
    'ECN': { fullName: 'Executive Control Network', label: 'Economic Program Management', tier: 'operational', function: 'Manages large-scale economic programs including stimulus implementation and reform execution', dysregulation: 'Program implementation failure, stimulus distribution delay, reform stall', expectedTypes: [
      { type: 'Economic program management firm', reason: 'Stimulus distribution design, economic program implementation, and outcome measurement', confidence: 0.85 },
      { type: 'Reform implementation advisory', reason: 'Economic reform sequencing, institutional change management, and transition planning', confidence: 0.80 }
    ]},
    'EI': { fullName: 'Excitatory/Inhibitory Ratio', label: 'Interest Rate & Credit Economics', tier: 'operational', function: 'Analyzes the balance between easy and tight monetary conditions and their economic effects', dysregulation: 'Rate shock, credit crunch, excessive easing leading to bubble', expectedTypes: [
      { type: 'Interest rate economics platform', reason: 'Yield curve economics, rate transmission analysis, and credit condition indices', confidence: 0.90 },
      { type: 'Credit economics consultancy', reason: 'Credit availability measurement, lending standards analysis, and financial conditions impact', confidence: 0.85 }
    ]},
    'ENDO': { fullName: 'Endocannabinoid', label: 'Economic Shock Absorbers', tier: 'operational', function: 'Provides economic shock absorption through stabilization funds, reserves, and buffer mechanisms', dysregulation: 'Insufficient fiscal buffers, reserve depletion, pro-cyclical fiscal policy', expectedTypes: [
      { type: 'Sovereign wealth fund advisory', reason: 'SWF investment strategy, fiscal stabilization fund design, and reserve adequacy analysis', confidence: 0.85 },
      { type: 'Fiscal buffer analytics', reason: 'Rainy day fund optimization, fiscal space estimation, and counter-cyclical capacity scoring', confidence: 0.78 }
    ]},
    'FG': { fullName: 'Fusiform Gyrus', label: 'Economic AI & Machine Learning', tier: 'operational', function: 'Applies AI and ML to economic forecasting, pattern recognition, and automated analysis', dysregulation: 'Model overfitting, AI bias in economic prediction, black-box economic recommendations', expectedTypes: [
      { type: 'Economic AI platform', reason: 'ML-based economic forecasting, NLP for economic text, and automated indicator construction', confidence: 0.90 },
      { type: 'Econometric innovation firm', reason: 'New econometric methods, causal inference tools, and computational economics', confidence: 0.82 }
    ]},
    'FPN': { fullName: 'Frontoparietal Network', label: 'Economic Cybersecurity', tier: 'operational', function: 'Protects economic data systems and statistical infrastructure from cyber threats', dysregulation: 'Economic data breach, statistical system compromise, data manipulation attack', expectedTypes: [
      { type: 'Economic data security firm', reason: 'Statistical system cybersecurity, economic data integrity, and confidential data protection', confidence: 0.82 },
      { type: 'Critical infrastructure economics', reason: 'Cyber-economic risk modeling and critical system interdependency analysis', confidence: 0.78 }
    ]},
    'GABA_GLU': { fullName: 'GABA/Glutamate Balance', label: 'Economic Regulation & Deregulation', tier: 'operational', function: 'Balances regulatory burden against market freedom to maintain economic stability', dysregulation: 'Over-regulation stifling growth, under-regulation enabling crisis, regulatory asymmetry', expectedTypes: [
      { type: 'Regulatory burden economics firm', reason: 'Regulatory cost estimation, compliance burden measurement, and deregulation impact analysis', confidence: 0.88 },
      { type: 'Market structure economics advisory', reason: 'Competition policy, market entry barriers, and regulatory sandbox economics', confidence: 0.82 }
    ]},
    'GBA': { fullName: 'Gut-Brain Axis', label: 'Informal & Underground Economy', tier: 'operational', function: 'Measures and analyzes informal economic activity, cash economy, and unrecorded transactions', dysregulation: 'Shadow economy expansion, tax gap widening, statistical undercount', expectedTypes: [
      { type: 'Informal economy measurement firm', reason: 'Shadow economy estimation, tax gap analysis, and unrecorded economic activity measurement', confidence: 0.82 },
      { type: 'Cash economy analytics', reason: 'Currency demand modeling, cash usage trends, and financial inclusion economics', confidence: 0.75 }
    ]},
    'GP': { fullName: 'Globus Pallidus', label: 'Licensing & Market Entry Economics', tier: 'operational', function: 'Analyzes occupational licensing, market entry barriers, and regulatory gates on economic activity', dysregulation: 'Excessive licensing blocking labor mobility, market entry barriers reducing competition', expectedTypes: [
      { type: 'Occupational licensing economics firm', reason: 'Licensing burden analysis, labor mobility impact, and deregulation benefit estimation', confidence: 0.85 },
      { type: 'Market entry barrier analytics', reason: 'Entry cost measurement, competitive dynamics, and startup formation barrier analysis', confidence: 0.80 }
    ]},
    'HAB': { fullName: 'Habenula', label: 'Economic Loss & Waste Analysis', tier: 'operational', function: 'Investigates economic losses, deadweight loss, and allocative inefficiency', dysregulation: 'Persistent economic waste, unaddressed deadweight loss, subsidized inefficiency', expectedTypes: [
      { type: 'Economic efficiency analytics firm', reason: 'Deadweight loss estimation, allocative efficiency measurement, and waste identification', confidence: 0.85 },
      { type: 'Subsidy economics advisory', reason: 'Subsidy cost-benefit, economic distortion analysis, and reform recommendation', confidence: 0.80 }
    ]},
    'HPA': { fullName: 'HPA Axis', label: 'Systemic Economic Governance', tier: 'operational', function: 'Governs systemic economic stability through international coordination and macroprudential oversight', dysregulation: 'Systemic contagion, international coordination failure, macroprudential gap', expectedTypes: [
      { type: 'International economic governance advisory', reason: 'IMF/World Bank policy, G20 coordination, and international economic architecture', confidence: 0.85 },
      { type: 'Systemic risk economics firm', reason: 'Cross-border contagion modeling, global imbalance analysis, and systemic stability assessment', confidence: 0.82 }
    ]},
    'HYPO': { fullName: 'Hypothalamus', label: 'Central Economic Authority', tier: 'operational', function: 'Maintains economic homeostasis through coordinated monetary and fiscal authority', dysregulation: 'Policy coordination failure, monetary-fiscal conflict, economic stabilization breakdown', expectedTypes: [
      { type: 'Monetary-fiscal coordination advisory', reason: 'Policy mix optimization, central bank-treasury coordination, and economic stabilization design', confidence: 0.85 },
      { type: 'Economic governance consultancy', reason: 'Institutional design, economic council structure, and policy coordination mechanisms', confidence: 0.78 }
    ]},
    'IC': { fullName: 'Inferior Colliculus', label: 'Economic Transaction Monitoring', tier: 'operational', function: 'Monitors economic transactions in real-time for compliance, patterns, and anomalies', dysregulation: 'Monitoring gap, transaction pattern misread, compliance failure', expectedTypes: [
      { type: 'Economic activity monitoring platform', reason: 'Real-time transaction flow analysis, economic activity tracking, and compliance monitoring', confidence: 0.85 },
      { type: 'Trade compliance economics', reason: 'Export control economics, tariff compliance monitoring, and customs valuation analysis', confidence: 0.80 }
    ]},
    'IPS': { fullName: 'Intraparietal Sulcus', label: 'Economic Measurement & Quantification', tier: 'operational', function: 'Performs precise economic measurements including GDP components, price indices, and welfare metrics', dysregulation: 'Measurement error, GDP mismeasurement, welfare metric inadequacy', expectedTypes: [
      { type: 'Economic measurement innovation firm', reason: 'Beyond-GDP metrics, well-being indices, and economic welfare measurement', confidence: 0.85 },
      { type: 'Price index consultancy', reason: 'CPI/PPI methodology, hedonic pricing, and purchasing power parity calculation', confidence: 0.82 }
    ]},
    'LANG': { fullName: 'Language Network', label: 'Economic Reporting & Disclosure', tier: 'operational', function: 'Produces and distributes economic reports, statistical releases, and policy communications', dysregulation: 'Report delay, communication failure, data release methodology shift', expectedTypes: [
      { type: 'Economic reporting platform', reason: 'Automated economic report generation, data release tracking, and revision monitoring', confidence: 0.85 },
      { type: 'Economic communication advisory', reason: 'Central bank communication strategy, forward guidance economics, and market expectation management', confidence: 0.80 }
    ]},
    'LAR': { fullName: 'Laryngeal', label: 'Economic Public Communication', tier: 'operational', function: 'Delivers economic information to public audiences through accessible formats', dysregulation: 'Economic illiteracy, public misunderstanding, communication gap between economists and public', expectedTypes: [
      { type: 'Economic literacy platform', reason: 'Public economic education, data visualization for non-experts, and economic explainer content', confidence: 0.82 },
      { type: 'Economic journalism consultancy', reason: 'Media training for economists, data journalism support, and economic narrative advisory', confidence: 0.75 }
    ]},
    'LC': { fullName: 'Locus Coeruleus', label: 'Economic Alert Systems', tier: 'operational', function: 'Triggers economic alerts for data releases, threshold breaches, and policy changes', dysregulation: 'Alert fatigue, missed economic threshold, delayed policy change notification', expectedTypes: [
      { type: 'Economic alert platform', reason: 'Real-time economic data release alerts, threshold monitoring, and policy change notifications', confidence: 0.88 },
      { type: 'Economic event calendar service', reason: 'Comprehensive economic release calendar, forecast consensus, and surprise scoring', confidence: 0.82 }
    ]},
    'LGN': { fullName: 'Lateral Geniculate Nucleus', label: 'Economic Document Analysis', tier: 'operational', function: 'Reviews and analyzes economic documents including policy papers, statistical releases, and regulatory text', dysregulation: 'Missed policy detail, document analysis backlog, regulatory text misinterpretation', expectedTypes: [
      { type: 'Economic document intelligence platform', reason: 'NLP extraction from economic reports, policy papers, and regulatory documents', confidence: 0.85 },
      { type: 'Policy document analysis service', reason: 'Legislative scoring, regulation cost analysis, and economic text mining', confidence: 0.78 }
    ]},
    'MAMM': { fullName: 'Mammillary Bodies', label: 'Economic Archives & Historical Data', tier: 'operational', function: 'Preserves historical economic data, statistical archives, and long-run datasets', dysregulation: 'Historical data loss, archive inaccessibility, long-run series discontinuity', expectedTypes: [
      { type: 'Economic data archive service', reason: 'Long-run economic dataset curation, historical data digitization, and time series preservation', confidence: 0.82 },
      { type: 'Historical economics research platform', reason: 'Economic history databases, historical national accounts, and long-run comparative data', confidence: 0.78 }
    ]},
    'MDT': { fullName: 'Mediodorsal Thalamus', label: 'Economic Decision Support', tier: 'operational', function: 'Provides analytics and modeling for economic policy and investment decisions', dysregulation: 'Analysis paralysis, model-dependent policy, scenario blindness', expectedTypes: [
      { type: 'Economic decision support platform', reason: 'Policy simulation, scenario modeling, and cost-benefit analysis tools', confidence: 0.88 },
      { type: 'Economic modeling consultancy', reason: 'DSGE, CGE, and microsimulation models for policy analysis', confidence: 0.85 }
    ]},
    'MGN': { fullName: 'Medial Geniculate Nucleus', label: 'Precise Economic Measurement', tier: 'operational', function: 'Performs precise economic calculations including deflators, adjustments, and index construction', dysregulation: 'Deflator error, seasonal adjustment failure, index methodology weakness', expectedTypes: [
      { type: 'Economic index construction firm', reason: 'Custom economic indices, composite indicator design, and weighting methodology', confidence: 0.85 },
      { type: 'Seasonal adjustment consultancy', reason: 'X-13 ARIMA-SEATS implementation, calendar effect analysis, and seasonal pattern detection', confidence: 0.78 }
    ]},
    'MICRO': { fullName: 'Microbiome', label: 'Microeconomic Foundations', tier: 'operational', function: 'Analyzes microeconomic behavior underlying macroeconomic phenomena', dysregulation: 'Micro-macro disconnect, aggregation fallacy, behavioral anomaly', expectedTypes: [
      { type: 'Behavioral economics firm', reason: 'Consumer choice modeling, nudge economics, and behavioral policy design', confidence: 0.88 },
      { type: 'Microeconomic analytics platform', reason: 'Firm-level dynamics, household economics, and market-level analysis from micro data', confidence: 0.82 }
    ]},
    'NAcc': { fullName: 'Nucleus Accumbens', label: 'Economic Incentive Design', tier: 'operational', function: 'Designs economic incentive programs including tax credits, subsidies, and performance-based contracts', dysregulation: 'Perverse incentive, subsidy capture, incentive program cost overrun', expectedTypes: [
      { type: 'Incentive design economics firm', reason: 'Tax credit impact analysis, subsidy design optimization, and incentive program evaluation', confidence: 0.88 },
      { type: 'Performance economics advisory', reason: 'Pay-for-success contracts, social impact bonds, and outcomes-based funding design', confidence: 0.80 }
    ]},
    'NBM': { fullName: 'Nucleus Basalis of Meynert', label: 'Economic Workforce Development', tier: 'operational', function: 'Develops economic analytical workforce through training, certification, and education', dysregulation: 'Economist shortage, skills gap in economic analysis, training deficiency', expectedTypes: [
      { type: 'Economics education platform', reason: 'Applied economics training, econometric bootcamps, and policy analysis certification', confidence: 0.82 },
      { type: 'Economic talent analytics', reason: 'Economics labor market analysis, salary benchmarking, and workforce planning for economic agencies', confidence: 0.75 }
    ]},
    'NEOCER': { fullName: 'Neocerebellum', label: 'Economic Quality Assurance', tier: 'operational', function: 'Validates economic models, verifies data quality, and audits analytical methodology', dysregulation: 'Unvalidated economic model, data quality failure, methodology error propagation', expectedTypes: [
      { type: 'Economic model validation firm', reason: 'Independent model review, forecast accuracy auditing, and methodology assessment', confidence: 0.88 },
      { type: 'Economic data quality platform', reason: 'Data integrity monitoring, revision tracking, and statistical quality assurance', confidence: 0.82 }
    ]},
    'OLF': { fullName: 'Olfactory', label: 'Economic Sentiment & Expectations', tier: 'operational', function: 'Measures economic sentiment, consumer expectations, and business confidence', dysregulation: 'Sentiment-reality divergence, expectations unanchoring, confidence collapse', expectedTypes: [
      { type: 'Economic sentiment analytics platform', reason: 'Consumer and business confidence tracking, expectations surveys, and sentiment indices', confidence: 0.90 },
      { type: 'Inflation expectations firm', reason: 'Breakeven inflation analysis, survey-based expectations, and expectations anchoring measurement', confidence: 0.85 }
    ]},
    'OPIOID': { fullName: 'Opioid System', label: 'Economic Bottleneck Resolution', tier: 'operational', function: 'Resolves acute economic bottlenecks in supply chains, labor markets, and infrastructure', dysregulation: 'Chronic bottleneck, persistent shortage, unresolved constraint', expectedTypes: [
      { type: 'Economic bottleneck analytics firm', reason: 'Constraint identification, shortage economics, and bottleneck impact quantification', confidence: 0.85 },
      { type: 'Shortage economics advisory', reason: 'Labor shortage analysis, materials shortage impact, and capacity constraint resolution', confidence: 0.80 }
    ]},
    'OSC': { fullName: 'Oscillatory', label: 'Business Cycle Economics', tier: 'operational', function: 'Analyzes and forecasts business cycles, credit cycles, and economic oscillations', dysregulation: 'Cycle timing error, late-cycle overextension, early-cycle hesitation', expectedTypes: [
      { type: 'Business cycle analytics firm', reason: 'Cycle dating, phase identification, and recession probability modeling', confidence: 0.90 },
      { type: 'Credit cycle research service', reason: 'Credit conditions tracking, financial cycle analysis, and cycle-adjusted metrics', confidence: 0.85 }
    ]},
    'OXY': { fullName: 'Oxytocin', label: 'Economic Cooperation & Trade Agreements', tier: 'operational', function: 'Structures economic cooperation agreements, trade pacts, and international partnerships', dysregulation: 'Trade agreement collapse, cooperation failure, economic isolation', expectedTypes: [
      { type: 'Trade agreement economics firm', reason: 'Trade deal impact modeling, USMCA/EU analysis, and FTA cost-benefit assessment', confidence: 0.90 },
      { type: 'Economic cooperation advisory', reason: 'Bilateral economic agreements, development partnerships, and economic diplomacy', confidence: 0.82 }
    ]},
    'PBN': { fullName: 'Parabrachial Nucleus', label: 'Consumer Economic Experience', tier: 'operational', function: 'Measures consumer economic experience including purchasing power, cost of living, and financial stress', dysregulation: 'Cost-of-living crisis, purchasing power erosion, consumer financial distress', expectedTypes: [
      { type: 'Cost of living analytics platform', reason: 'Regional cost-of-living indices, purchasing power measurement, and living wage analysis', confidence: 0.88 },
      { type: 'Consumer financial stress advisory', reason: 'Household balance sheet analysis, debt burden assessment, and financial fragility scoring', confidence: 0.82 }
    ]},
    'PCC': { fullName: 'Posterior Cingulate Cortex', label: 'Economic Benchmarking & Comparison', tier: 'operational', function: 'Benchmarks economic performance against peers, historical periods, and international standards', dysregulation: 'Benchmark gaming, peer comparison mismatch, self-serving economic narrative', expectedTypes: [
      { type: 'Economic benchmarking platform', reason: 'Cross-country economic comparison, peer group analysis, and performance ranking', confidence: 0.85 },
      { type: 'Economic competitiveness advisory', reason: 'National competitiveness scoring, ease-of-doing-business analysis, and institutional quality rating', confidence: 0.82 }
    ]},
    'PI': { fullName: 'Posterior Insula', label: 'Economic Pain & Hardship Detection', tier: 'operational', function: 'Detects economic pain signals including job losses, foreclosures, and business failures', dysregulation: 'Late hardship detection, invisible economic suffering, statistical undercount of pain', expectedTypes: [
      { type: 'Economic hardship monitoring platform', reason: 'Real-time tracking of layoffs, foreclosures, bankruptcies, and food insecurity', confidence: 0.88 },
      { type: 'Economic distress analytics', reason: 'Community economic distress scoring, poverty measurement, and deprivation indices', confidence: 0.85 }
    ]},
    'PIN': { fullName: 'Pineal', label: 'Economic Timing & Seasonality', tier: 'operational', function: 'Manages economic seasonality, timing of releases, and cyclical pattern recognition', dysregulation: 'Seasonal adjustment failure, calendar effect confusion, timing mismatch', expectedTypes: [
      { type: 'Economic seasonality analytics', reason: 'Seasonal pattern detection, holiday effect modeling, and calendar adjustment consulting', confidence: 0.82 },
      { type: 'Economic timing advisory', reason: 'Optimal policy timing, fiscal year economics, and budget cycle analysis', confidence: 0.75 }
    ]},
    'PIT': { fullName: 'Pituitary', label: 'Capital Formation & Investment', tier: 'operational', function: 'Originates capital formation through business investment, housing construction, and infrastructure spending', dysregulation: 'Investment drought, capital formation collapse, crowding-out effect', expectedTypes: [
      { type: 'Capital formation analytics firm', reason: 'Business investment tracking, capex forecasting, and gross fixed capital formation analysis', confidence: 0.90 },
      { type: 'Investment economics advisory', reason: 'FDI economics, capital allocation efficiency, and investment multiplier estimation', confidence: 0.85 }
    ]},
    'PPN': { fullName: 'Pedunculopontine Nucleus', label: 'Economic Program Launch', tier: 'operational', function: 'Launches new economic programs, initiatives, and policy interventions', dysregulation: 'Program launch failure, implementation delay, stakeholder misalignment', expectedTypes: [
      { type: 'Economic program design firm', reason: 'New economic initiative design, pilot program economics, and implementation planning', confidence: 0.82 },
      { type: 'Policy pilot analytics', reason: 'RCT design for economic programs, pilot evaluation, and scale-up economics', confidence: 0.78 }
    ]},
    'PRECUNEUS': { fullName: 'Precuneus', label: 'Economic Self-Assessment', tier: 'operational', function: 'Evaluates national and regional economic maturity, institutional quality, and development stage', dysregulation: 'No self-assessment, development stage misidentification, institutional quality decline', expectedTypes: [
      { type: 'Economic development assessment firm', reason: 'Development stage analysis, institutional quality scoring, and economic maturity evaluation', confidence: 0.82 },
      { type: 'Governance quality analytics', reason: 'Rule of law metrics, institutional effectiveness, and economic freedom indices', confidence: 0.78 }
    ]},
    'PULV': { fullName: 'Pulvinar', label: 'Economic Dashboard & Visualization', tier: 'operational', function: 'Provides economic dashboards, visualization systems, and real-time monitoring displays', dysregulation: 'Dashboard overload, visualization without insight, stale economic display', expectedTypes: [
      { type: 'Economic dashboard platform', reason: 'Interactive economic visualization, real-time monitoring, and custom indicator displays', confidence: 0.88 },
      { type: 'Economic data visualization firm', reason: 'Data-driven economic storytelling, infographic production, and interactive chart systems', confidence: 0.82 }
    ]},
    'PUT': { fullName: 'Putamen', label: 'Economic Process Automation', tier: 'operational', function: 'Automates repetitive economic data processing, report generation, and analytical workflows', dysregulation: 'Processing backlog, manual error accumulation, automation failure', expectedTypes: [
      { type: 'Economic automation platform', reason: 'Automated data ingestion, report generation, and economic indicator calculation', confidence: 0.85 },
      { type: 'Statistical production consultancy', reason: 'National statistical office modernization, automated production systems, and workflow optimization', confidence: 0.78 }
    ]},
    'RAPHE': { fullName: 'Raphe Nuclei', label: 'Economic Service Quality', tier: 'operational', function: 'Measures quality of economic services, policy delivery, and public sector economics', dysregulation: 'Declining public service quality, economic advisory degradation, institutional capacity erosion', expectedTypes: [
      { type: 'Public service economics firm', reason: 'Government efficiency measurement, public service cost-effectiveness, and performance benchmarking', confidence: 0.82 },
      { type: 'Economic advisory quality platform', reason: 'Forecast accuracy scoring, advisory value measurement, and analytical quality assessment', confidence: 0.75 }
    ]},
    'RF': { fullName: 'Reticular Formation', label: 'Economic Operational Readiness', tier: 'operational', function: 'Maintains economic system operational readiness and continuity planning', dysregulation: 'Economic data system failure, statistical agency disruption, continuity gap', expectedTypes: [
      { type: 'Economic continuity planning firm', reason: 'Statistical agency BCP, economic data system resilience, and critical infrastructure planning', confidence: 0.80 },
      { type: 'Economic resilience analytics', reason: 'Community economic resilience scoring, adaptive capacity measurement, and recovery readiness', confidence: 0.78 }
    ]},
    'RSC': { fullName: 'Retrosplenial Cortex', label: 'Economic Navigation & Onboarding', tier: 'operational', function: 'Guides users through economic data systems, methodology understanding, and analytical tools', dysregulation: 'Data access confusion, methodology misunderstanding, tool underutilization', expectedTypes: [
      { type: 'Economic data literacy platform', reason: 'Economic data navigation tools, methodology explainers, and analytical tool tutorials', confidence: 0.82 },
      { type: 'Economic onboarding service', reason: 'New analyst training, data access setup, and economic tool orientation', confidence: 0.75 }
    ]},
    'SC': { fullName: 'Superior Colliculus', label: 'Rapid Economic Assessment', tier: 'operational', function: 'Performs rapid economic assessments including flash GDP estimates and quick-turnaround analysis', dysregulation: 'Slow initial assessment, delayed flash estimate, assessment bottleneck', expectedTypes: [
      { type: 'Flash economic assessment platform', reason: 'Same-day economic release analysis, rapid impact scoring, and instant policy assessment', confidence: 0.88 },
      { type: 'Quick-turnaround economic analysis firm', reason: 'Rapid-response economic briefs, overnight analysis, and real-time commentary', confidence: 0.82 }
    ]},
    'SEPT': { fullName: 'Septal Nuclei', label: 'Economic Safety Nets & Protection', tier: 'operational', function: 'Provides economic safety net analysis including unemployment insurance, SNAP, and social security', dysregulation: 'Safety net inadequacy, benefit cliff, coverage gap', expectedTypes: [
      { type: 'Social insurance economics firm', reason: 'Unemployment insurance design, SNAP economics, and social safety net optimization', confidence: 0.85 },
      { type: 'Economic protection analytics', reason: 'Coverage gap analysis, benefit adequacy scoring, and safety net cost-effectiveness', confidence: 0.80 }
    ]},
    'SMA': { fullName: 'Supplementary Motor Area', label: 'Economic Pre-Planning & Feasibility', tier: 'operational', function: 'Performs economic feasibility analysis, pre-project assessment, and planning economics', dysregulation: 'Infeasible project approval, pre-planning bypass, economic justification gap', expectedTypes: [
      { type: 'Economic feasibility consultancy', reason: 'Project CBA, infrastructure feasibility, and economic justification analysis', confidence: 0.88 },
      { type: 'Pre-development economics firm', reason: 'Site economic analysis, demand projections, and financial feasibility modeling', confidence: 0.82 }
    ]},
    'SMN': { fullName: 'Somatomotor Network', label: 'Economic Field Operations', tier: 'operational', function: 'Coordinates economic field operations including surveys, censuses, and on-ground data collection', dysregulation: 'Survey response decline, census undercount, field data quality issue', expectedTypes: [
      { type: 'Economic survey operations firm', reason: 'Field survey design, enumeration economics, and response optimization', confidence: 0.82 },
      { type: 'Census economics advisory', reason: 'Census planning, undercount estimation, and census data utilization consulting', confidence: 0.78 }
    ]},
    'SN': { fullName: 'Salience Network', label: 'Economic Priority Detection', tier: 'operational', function: 'Identifies highest-priority economic issues requiring immediate attention and resource allocation', dysregulation: 'Wrong economic priority, resource misallocation, crisis underweight', expectedTypes: [
      { type: 'Economic priority assessment platform', reason: 'Issue severity scoring, resource allocation optimization, and economic triage analytics', confidence: 0.82 },
      { type: 'Economic agenda advisory', reason: 'Policy priority sequencing, economic reform ordering, and attention allocation consulting', confidence: 0.78 }
    ]},
    'SNIG': { fullName: 'Substantia Nigra', label: 'Labor Market Economics', tier: 'operational', function: 'Analyzes labor market dynamics including employment, wages, participation, and productivity', dysregulation: 'Labor market dysfunction, wage stagnation, participation decline, skills mismatch', expectedTypes: [
      { type: 'Labor economics analytics platform', reason: 'Employment forecasting, wage dynamics, and labor market tightness measurement', confidence: 0.95 },
      { type: 'Workforce economics consultancy', reason: 'Skills gap analysis, labor supply modeling, and human capital economics', confidence: 0.88 }
    ]},
    'SNS': { fullName: 'Sympathetic Nervous System', label: 'Rapid Economic Deployment', tier: 'operational', function: 'Rapidly deploys economic resources for time-sensitive opportunities and emergencies', dysregulation: 'Slow resource deployment, missed economic window, emergency fund delay', expectedTypes: [
      { type: 'Emergency economics advisory', reason: 'Rapid-response economic analysis, crisis economics, and time-sensitive policy design', confidence: 0.82 },
      { type: 'Economic rapid deployment firm', reason: 'Fast-turnaround impact analysis, emergency grant economics, and disaster economic response', confidence: 0.78 }
    ]},
    'STN': { fullName: 'Subthalamic Nucleus', label: 'Economic Enforcement & Compliance', tier: 'operational', function: 'Enforces economic regulations including antitrust, trade compliance, and sanctions enforcement', dysregulation: 'Unenforced antitrust, trade violation, sanctions breach undetected', expectedTypes: [
      { type: 'Economic enforcement analytics', reason: 'Antitrust enforcement support, merger analysis, and competitive effects estimation', confidence: 0.88 },
      { type: 'Trade enforcement advisory', reason: 'Dumping analysis, countervailing duty calculation, and safeguard investigation support', confidence: 0.82 }
    ]},
    'STS': { fullName: 'Superior Temporal Sulcus', label: 'Economic Behavior Analytics', tier: 'operational', function: 'Analyzes economic agent behavior including consumer choice, firm decision-making, and market participant actions', dysregulation: 'Behavioral prediction failure, agent model error, choice architecture dysfunction', expectedTypes: [
      { type: 'Economic behavior analytics platform', reason: 'Consumer choice modeling, firm decision analysis, and market participant behavior tracking', confidence: 0.85 },
      { type: 'Nudge economics consultancy', reason: 'Choice architecture design, behavioral intervention evaluation, and nudge program assessment', confidence: 0.80 }
    ]},
    'TPJ': { fullName: 'Temporoparietal Junction', label: 'Economic Stakeholder Relations', tier: 'operational', function: 'Incorporates diverse economic stakeholder perspectives into policy and planning', dysregulation: 'Ignored stakeholder interests, economic policy backlash, community opposition', expectedTypes: [
      { type: 'Economic stakeholder analysis firm', reason: 'Stakeholder impact assessment, distributional analysis, and community economic engagement', confidence: 0.82 },
      { type: 'Economic public affairs advisory', reason: 'Economic policy communication, public engagement, and stakeholder consensus building', confidence: 0.78 }
    ]},
    'TPOLE': { fullName: 'Temporal Pole', label: 'Economic Identity & Brand', tier: 'operational', function: 'Preserves national economic identity, brand competitiveness, and soft economic power', dysregulation: 'National brand erosion, economic identity crisis, soft power decline', expectedTypes: [
      { type: 'National brand economics firm', reason: 'Country brand valuation, economic identity positioning, and soft power measurement', confidence: 0.78 },
      { type: 'Economic narrative advisory', reason: 'National economic story, growth narrative construction, and investor perception management', confidence: 0.75 }
    ]},
    'TrkB': { fullName: 'TrkB Receptor', label: 'Economic Innovation Adoption', tier: 'operational', function: 'Evaluates adoption of economic innovations including new measurement methods and analytical tools', dysregulation: 'Innovation resistance, methodology stagnation, tool adoption failure', expectedTypes: [
      { type: 'Economic innovation advisory', reason: 'New methodology adoption, analytical tool evaluation, and economic tech transfer', confidence: 0.78 },
      { type: 'Economic technology platform', reason: 'Emerging economic tools, computational economics resources, and method innovation tracking', confidence: 0.75 }
    ]},
    'UNC': { fullName: 'Uncinate Fasciculus', label: 'Cross-Border Economics', tier: 'operational', function: 'Facilitates cross-border economic analysis including trade, migration, and capital flow economics', dysregulation: 'Cross-border data gap, international comparison failure, capital flow restriction', expectedTypes: [
      { type: 'Cross-border economics platform', reason: 'International economic comparison, migration economics, and cross-border capital flow analysis', confidence: 0.88 },
      { type: 'International development economics firm', reason: 'Aid effectiveness, development impact, and emerging market economic analysis', confidence: 0.82 }
    ]},
    'V1': { fullName: 'Primary Visual Cortex', label: 'Economic Data Visualization', tier: 'operational', function: 'Transforms raw economic data into visual charts, maps, and interactive dashboards', dysregulation: 'Misleading charts, visualization without context, display overload', expectedTypes: [
      { type: 'Economic visualization platform', reason: 'Interactive economic charts, data-driven maps, and real-time economic display systems', confidence: 0.88 },
      { type: 'Economic cartography firm', reason: 'Economic heat maps, choropleth design, and spatial economic visualization', confidence: 0.78 }
    ]},
    'VAN': { fullName: 'Ventral Attention Network', label: 'Economic Black Swan Detection', tier: 'operational', function: 'Detects unexpected economic events, tail risks, and unforeseen structural changes', dysregulation: 'Missed tail event, complacent economic models, undetected emerging risk', expectedTypes: [
      { type: 'Economic tail risk analytics', reason: 'Fat-tail distribution modeling, extreme event economics, and black swan scenario analysis', confidence: 0.85 },
      { type: 'Emerging risk economics firm', reason: 'Novel risk identification, cascading failure modeling, and systemic surprise detection', confidence: 0.80 }
    ]},
    'VERM': { fullName: 'Vermis', label: 'Economic Balance & Equilibrium', tier: 'operational', function: 'Maintains macroeconomic balance through analysis of trade balances, savings-investment equilibrium, and fiscal balance', dysregulation: 'Twin deficits, savings-investment imbalance, macroeconomic disequilibrium', expectedTypes: [
      { type: 'Macroeconomic balance analytics', reason: 'Current account analysis, savings-investment balance, and sectoral balance measurement', confidence: 0.88 },
      { type: 'External balance advisory', reason: 'Balance of payments analysis, FX reserve adequacy, and external sustainability assessment', confidence: 0.82 }
    ]},
    'VEST': { fullName: 'Vestibular', label: 'Economic Rebalancing', tier: 'operational', function: 'Detects economic imbalances and models rebalancing pathways', dysregulation: 'Persistent imbalance, delayed rebalancing, adjustment overshoot', expectedTypes: [
      { type: 'Economic rebalancing advisory', reason: 'Structural adjustment economics, rebalancing pathway modeling, and transition cost estimation', confidence: 0.85 },
      { type: 'Global imbalance analytics platform', reason: 'Current account imbalance tracking, capital flow rebalancing, and exchange rate adjustment analysis', confidence: 0.80 }
    ]},
    'VP': { fullName: 'Ventral Pallidum', label: 'Economic Resilience', tier: 'operational', function: 'Strengthens economic resilience through diversification, buffer building, and adaptive capacity', dysregulation: 'Economic fragility, concentration risk, resilience gap', expectedTypes: [
      { type: 'Economic resilience analytics firm', reason: 'Resilience scoring, economic diversification analysis, and vulnerability assessment', confidence: 0.85 },
      { type: 'Economic diversification advisory', reason: 'Economic base diversification strategy, concentration risk analysis, and resilience planning', confidence: 0.80 }
    ]},
    'VV': { fullName: 'Ventral Vagal', label: 'Community Economics & Inclusion', tier: 'operational', function: 'Provides community-level economic analysis, inclusion metrics, and grassroots economic development', dysregulation: 'Community economic neglect, inclusion gap, grassroots economic failure', expectedTypes: [
      { type: 'Community economics platform', reason: 'Neighborhood-level economic data, community development analytics, and grassroots impact measurement', confidence: 0.88 },
      { type: 'Economic inclusion advisory', reason: 'Financial inclusion economics, access gap analysis, and underserved community economic development', confidence: 0.82 }
    ]},
    'WERN': { fullName: 'Wernicke\'s Area', label: 'Economic Data Interpretation', tier: 'operational', function: 'Interprets economic data, market signals, and policy text into actionable economic intelligence', dysregulation: 'Misinterpreted economic release, unused data, analytical paralysis', expectedTypes: [
      { type: 'Economic interpretation service', reason: 'Data release commentary, economic signal interpretation, and policy implications analysis', confidence: 0.88 },
      { type: 'Economic research and analysis firm', reason: 'Fundamental economic research, thematic analysis, and investment-grade economic intelligence', confidence: 0.85 }
    ]},
    'mPFC': { fullName: 'Medial Prefrontal Cortex', label: 'Economic Strategy', tier: 'operational', function: 'Sets high-level economic strategy including national economic policy, growth strategy, and competitive positioning', dysregulation: 'Strategy drift, failed economic initiative, competitive decline', expectedTypes: [
      { type: 'National economic strategy firm', reason: 'Growth strategy, competitiveness planning, and economic vision development', confidence: 0.88 },
      { type: 'Economic strategy consultancy', reason: 'Corporate economic strategy, market positioning economics, and competitive intelligence', confidence: 0.82 }
    ]},
    'rACC': { fullName: 'Rostral Anterior Cingulate Cortex', label: 'Economic Dispute Resolution', tier: 'operational', function: 'Resolves economic disputes including trade disputes, tax controversies, and regulatory disagreements', dysregulation: 'Protracted trade dispute, unresolved economic conflict, regulatory impasse', expectedTypes: [
      { type: 'Economic dispute resolution firm', reason: 'WTO dispute analysis, trade remedy investigation, and economic damages estimation', confidence: 0.88 },
      { type: 'Tax controversy economics advisory', reason: 'Transfer pricing economics, tax dispute valuation, and economic substance analysis', confidence: 0.82 }
    ]},
    'vlPFC': { fullName: 'Ventrolateral Prefrontal Cortex', label: 'Economic Contract & Agreement Management', tier: 'operational', function: 'Manages economic agreements including trade contracts, bilateral pacts, and economic partnership terms', dysregulation: 'Agreement breach, contract renegotiation failure, partnership dissolution', expectedTypes: [
      { type: 'Economic agreement analytics', reason: 'Trade agreement compliance, economic partnership evaluation, and contract economics', confidence: 0.82 },
      { type: 'Economic negotiation advisory', reason: 'Trade negotiation support, economic terms modeling, and deal structure optimization', confidence: 0.78 }
    ]}
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIERARCHY CACHE
  // ══════════════════════════════════════════════════════════════════════

  var _hierarchyCache = null;
  var _hierarchyCacheAge = 0;

  function loadFullHierarchy(callback) {
    if (_hierarchyCache && (Date.now() - _hierarchyCacheAge) < HIERARCHY_TTL) {
      return callback(_hierarchyCache);
    }
    try {
      var cached = JSON.parse(sessionStorage.getItem(HIERARCHY_CACHE_KEY));
      if (cached && cached._age && (Date.now() - cached._age) < HIERARCHY_TTL) {
        _hierarchyCache = cached;
        _hierarchyCacheAge = cached._age;
        return callback(cached);
      }
    } catch (e) {}

    var brains = window.LIMENDomainBrains;
    if (!brains) return callback(null);
    var brain = brains.get('economy');
    if (!brain || !brain._portalCache) return callback(null);

    var topLevel = brain._portalCache;
    var result = {
      nodeCompanies: {}, nodeTreatments: {}, nodeDiagnoses: {},
      nodeLabels: {}, nodeDepths: {}, allActivations: []
    };

    function processActivations(acts, depth) {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var nid = a.brainNodeId;
        if (RI_NODES[nid]) continue;
        if (!result.nodeCompanies[nid]) result.nodeCompanies[nid] = {};
        if (!result.nodeTreatments[nid]) result.nodeTreatments[nid] = {};
        if (!result.nodeDiagnoses[nid]) result.nodeDiagnoses[nid] = {};
        if (!result.nodeLabels[nid]) result.nodeLabels[nid] = a.domainLabel || nid;
        if (!result.nodeDepths[nid]) result.nodeDepths[nid] = {};
        result.nodeDepths[nid][depth] = true;
        var cos = a.companies || [];
        for (var ci = 0; ci < cos.length; ci++) {
          var tk = cos[ci].ticker_or_id || cos[ci].name;
          if (!result.nodeCompanies[nid][tk]) {
            result.nodeCompanies[nid][tk] = { name: cos[ci].name, ticker: tk, reason: cos[ci].functional_reason, strength: cos[ci].binding_strength };
          }
        }
        var treats = a.treatments || [];
        for (var ti = 0; ti < treats.length; ti++) {
          var t = treats[ti];
          if (isGenericTreatment(t.label)) continue;
          var tKey = (t.label || '') + '|' + (t.type || '');
          if (!result.nodeTreatments[nid][tKey]) {
            result.nodeTreatments[nid][tKey] = { label: t.label, type: t.type, evidence: t.evidence };
          }
        }
        var dx = a.diagnosticTriggers || [];
        for (var di = 0; di < dx.length; di++) { result.nodeDiagnoses[nid][dx[di]] = true; }
        result.allActivations.push({ brainNodeId: nid, depth: depth, label: a.domainLabel, companiesCount: cos.length });
      }
    }

    processActivations(topLevel.activations || [], 0);
    result._age = Date.now();
    _hierarchyCache = result;
    _hierarchyCacheAge = Date.now();
    try { sessionStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify(result)); } catch (e) {}
    callback(result);
  }

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
      status: status, reason: reason || '', nodeId: nodeId, businessType: businessType,
      submitted_by: existing.submitted_by || 'operator', submitted_at: existing.submitted_at || Date.now(),
      reviewed_by: (status !== 'PROPOSED') ? (reviewerRole || 'operator') : (existing.reviewed_by || null),
      reviewed_at: (status !== 'PROPOSED') ? Date.now() : (existing.reviewed_at || null),
      review_note: (status !== 'PROPOSED') ? (reason || '') : (existing.review_note || ''),
      timestamp: Date.now(), reviewer: reviewerRole || 'operator'
    };
    saveApprovals(approvals);
    return approvals[key];
  }

  // ══════════════════════════════════════════════════════════════════════
  // INFERENCE ENGINE
  // ══════════════════════════════════════════════════════════════════════

  function getEconomyState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('economy');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getEconomyState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('economy') : null;
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

    var mapped = [], missing = [], speculative = [];

    for (var nodeId in NODE_BUSINESS_DIRECTORY) {
      if (RI_NODES[nodeId]) continue;
      var dir = NODE_BUSINESS_DIRECTORY[nodeId];
      var expectedTypes = dir.expectedTypes || [];
      var nodeActive = false;
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var cci = 0; cci < circuits.length; cci++) {
          if (circuits[cci].nodeId === nodeId) { nodeActive = true; break; }
        }
        if (nodeActive) break;
      }
      var existingCos = nodeCompanyIndex[nodeId] || {};
      var mappedCompanyNames = [];
      for (var tk in existingCos) { mappedCompanyNames.push(existingCos[tk].name + ' (' + tk + ')'); }

      for (var ti = 0; ti < expectedTypes.length; ti++) {
        var expected = expectedTypes[ti];
        var key = approvalKey(nodeId, expected.type);
        var approval = approvals[key] || null;
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
        if (!alreadyMapped) {
          for (var ck in existingCos) {
            var fr = (existingCos[ck].reason || '').toLowerCase();
            var mc2 = 0;
            for (var w2 = 0; w2 < typeWords.length; w2++) {
              if (typeWords[w2].length > 3 && fr.indexOf(typeWords[w2]) !== -1) mc2++;
            }
            if (mc2 >= 2) { alreadyMapped = true; break; }
          }
        }

        var consequence = '';
        if (!alreadyMapped) {
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Economy tied to ' + dir.label + '.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: eligible for future portal path mapping and audit tracking within Economy.';
          else consequence = 'If approved: recorded as valid Economy mapping for audit tracking. Requires further validation.';
        }

        var variantState = 'ACTIVE';
        if (approval) {
          if (approval.status === 'DENIED') variantState = 'REJECTED';
          else if (approval.status === 'APPROVED') variantState = 'ACTIVE';
          else variantState = 'PROPOSED';
        } else if (!alreadyMapped && expected.confidence >= 0.75) variantState = 'MISSING';
        else if (!alreadyMapped) variantState = 'PROPOSED';
        else variantState = 'MAPPED';

        var showButtons = !!approval || variantState === 'PROPOSED' || variantState === 'MISSING';
        var cardKey = nodeId + '::' + (expected.type || '').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 50);

        var entry = {
          cardKey: cardKey, nodeId: nodeId, nodeFullName: dir.fullName || nodeId,
          nodeLabel: dir.label, nodeFunction: dir.function,
          plainFunction: dir.function, dysregulation: dir.dysregulation || '',
          plainDysregulation: dir.dysregulation || '',
          neuroTranslation: dir.neuroTranslation || null,
          businessType: expected.type, reason: expected.reason,
          confidence: expected.confidence, nodeActive: nodeActive,
          alreadyMapped: alreadyMapped, existingCompanies: mappedCompanyNames,
          approval: approval, approvalRequired: showButtons,
          variantState: variantState, approvalConsequence: consequence,
          tier: dir.tier || 'operational',
          reasoning: nodeId + ' (' + (dir.fullName || '') + ') \u2014 ' + dir.label + '\n' +
            dir.function + '\n' + (dir.dysregulation ? 'When dysregulated: ' + dir.dysregulation + '\n' : '') +
            'This creates demand for: ' + expected.type + '. ' + expected.reason + '.'
        };

        if (alreadyMapped) { entry.bucket = 'MAPPED'; mapped.push(entry); }
        else if (expected.confidence >= 0.75) {
          entry.bucket = 'MISSING';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed by inference engine'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          missing.push(entry);
        } else {
          entry.bucket = 'SPECULATIVE';
          if (!approval) { setApprovalStatus(nodeId, expected.type, 'PROPOSED', 'Auto-proposed \u2014 low confidence'); entry.approval = getApprovalStatus(nodeId, expected.type); }
          speculative.push(entry);
        }
      }
    }

    function dedupeExact(arr) {
      var seen = {}; var out = [];
      for (var i = 0; i < arr.length; i++) {
        var dk = arr[i].cardKey + '|' + arr[i].bucket + '|' + arr[i].variantState;
        if (!seen[dk]) { seen[dk] = true; out.push(arr[i]); }
      }
      return out;
    }
    mapped = dedupeExact(mapped); missing = dedupeExact(missing); speculative = dedupeExact(speculative);

    var sortFn = function (a, b) {
      var ta = a.tier === 'top' ? 0 : 1, tb = b.tier === 'top' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      if (a.nodeActive !== b.nodeActive) return a.nodeActive ? -1 : 1;
      return b.confidence - a.confidence;
    };
    mapped.sort(sortFn); missing.sort(sortFn); speculative.sort(sortFn);

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
      if (all[i].approval && all[i].approval.status === 'APPROVED') approved.push(all[i]);
    }
    return approved;
  }

  window.LIMENEconomyBusinessEngine = {
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

  loadFullHierarchy(function () {
    console.log('[EconomyBusinessEngine] Hierarchy loaded');
  });

  console.log('[EconomyBusinessEngine] Loaded \u2014 103-node full-hierarchy economy business assignment engine');

})();
