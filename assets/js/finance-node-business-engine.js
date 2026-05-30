/**
 * finance-node-business-engine.js — Finance Node-to-Business Assignment Engine
 *
 * FINANCE DOMAIN ONLY. Full-hierarchy inference layer.
 *
 * Architecture:
 *   - Covers 103 operational nodes (20 RI/framework nodes excluded)
 *   - Filters generic template treatments before inference
 *   - Compares existing companies against business-type directory
 *
 * Outputs 3 buckets:
 *   MAPPED     — already mapped and active in Finance system
 *   MISSING    — plausible but missing from current Finance mappings
 *   SPECULATIVE — low-confidence or novel suggestions
 *
 * Approval statuses:
 *   PROPOSED | APPROVED | DENIED | NEEDS_REVIEW
 *
 * Persistence: localStorage('limen_finance_business_approvals')
 *
 * Self-gates: only runs when ?domain=finance is in the URL.
 * Exposes: window.LIMENFinanceBusinessEngine
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'finance') return;

  var STORAGE_KEY = 'limen_finance_business_approvals';
  var HIERARCHY_CACHE_KEY = 'limen_finance_hierarchy_cache';
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
      fullName: 'Primary Motor Cortex', label: 'Commercial Banking', tier: 'top',
      neuroTranslation: { inNeurology: 'Final cortical output stage — sends direct commands for voluntary movement.', inBusiness: 'In finance, this is commercial banking. Raw deposits are converted into loans, credit facilities, and working capital that move the real economy.' },
      function: 'Converts deposits into loans, credit facilities, and commercial lending products',
      dysregulation: 'Credit crunch, loan default cascade, capital adequacy shortfall',
      expectedTypes: [
        { type: 'Commercial bank', reason: 'Core lending and deposit-taking institution serving businesses and consumers', confidence: 0.95 },
        { type: 'Business lending platform', reason: 'Online and alternative lending for small and mid-market businesses', confidence: 0.90 },
        { type: 'Credit union', reason: 'Member-owned cooperative providing banking services to specific communities', confidence: 0.85 },
        { type: 'Bank holding company', reason: 'Parent entity managing multiple banking subsidiaries and capital allocation', confidence: 0.80 }
      ]
    },
    'THAL': {
      fullName: 'Thalamus', label: 'Payment Processing', tier: 'top',
      neuroTranslation: { inNeurology: 'Relays nearly all sensory and motor signals between subcortical structures and cortex.', inBusiness: 'In finance, this is payment processing — routing money between payers and payees through payment networks, ACH, wires, and card rails.' },
      function: 'Routes and processes payments across card networks, ACH, wire, and real-time payment rails',
      dysregulation: 'Payment processing outage, settlement delay, interchange dispute',
      expectedTypes: [
        { type: 'Payment processor', reason: 'Operates card processing, ACH origination, and payment gateway services', confidence: 0.95 },
        { type: 'Payment network operator', reason: 'Visa, Mastercard-style network connecting issuers and acquirers', confidence: 0.90 },
        { type: 'Merchant acquiring service', reason: 'Enables merchants to accept card and digital payments', confidence: 0.85 },
        { type: 'Real-time payments platform', reason: 'FedNow, RTP, and instant settlement infrastructure', confidence: 0.82 }
      ]
    },
    'STRI': {
      fullName: 'Striatum', label: 'Investment Banking', tier: 'top',
      neuroTranslation: { inNeurology: 'Central to habit formation and reward-based learning through dopaminergic feedback.', inBusiness: 'In finance, this is investment banking — deeply entrenched deal-making habits, M&A advisory, and capital markets underwriting that form the reward loops of Wall Street.' },
      function: 'Advises on mergers, acquisitions, and underwriting of equity and debt securities',
      dysregulation: 'Deal pipeline collapse, IPO market freeze, advisory conflict of interest',
      expectedTypes: [
        { type: 'Investment bank', reason: 'Full-service M&A advisory, underwriting, and capital markets', confidence: 0.95 },
        { type: 'Boutique M&A advisory firm', reason: 'Specialized sector-focused merger and acquisition advisory', confidence: 0.90 },
        { type: 'Debt capital markets underwriter', reason: 'Bond issuance, syndicated lending, and structured finance', confidence: 0.85 },
        { type: 'Equity research firm', reason: 'Institutional equity research supporting capital markets activity', confidence: 0.78 }
      ]
    },
    'VTA': {
      fullName: 'Ventral Tegmental Area', label: 'Venture Capital & Growth Equity', tier: 'top',
      neuroTranslation: { inNeurology: 'Origin of mesolimbic dopamine pathway — drives reward-seeking and novelty exploration.', inBusiness: 'In finance, this is venture capital and growth equity — the novelty-seeking, high-risk, high-reward frontier of capital allocation.' },
      function: 'Invests in early-stage and growth companies seeking outsized returns from innovation',
      dysregulation: 'Valuation bubble, funding winter, portfolio concentration risk',
      expectedTypes: [
        { type: 'Venture capital fund', reason: 'Early-stage and Series A-C investing in high-growth companies', confidence: 0.95 },
        { type: 'Growth equity firm', reason: 'Late-stage minority investing in scaling companies', confidence: 0.90 },
        { type: 'Angel investor network', reason: 'Organized angel investing syndicates and platforms', confidence: 0.85 },
        { type: 'Corporate venture capital arm', reason: 'Strategic VC investing by large financial institutions', confidence: 0.80 }
      ]
    },
    'PAG': {
      fullName: 'Periaqueductal Gray', label: 'Insurance & Reinsurance', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates defensive responses and pain modulation under threat.', inBusiness: 'In finance, this is insurance and reinsurance — defensive financial products that protect against loss under threat of adverse events.' },
      function: 'Underwrites insurance policies and reinsurance treaties that transfer and pool risk',
      dysregulation: 'Catastrophic loss event, reserve inadequacy, reinsurance market hardening',
      expectedTypes: [
        { type: 'Property and casualty insurer', reason: 'Underwrites commercial and personal P&C insurance lines', confidence: 0.95 },
        { type: 'Reinsurance company', reason: 'Provides reinsurance capacity to primary carriers', confidence: 0.90 },
        { type: 'Life and annuity insurer', reason: 'Underwrites life insurance and retirement annuity products', confidence: 0.85 },
        { type: 'Insurtech platform', reason: 'Technology-driven insurance distribution and underwriting', confidence: 0.82 }
      ]
    },
    'HIPP': {
      fullName: 'Hippocampus', label: 'Asset Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Forms and consolidates new memories into long-term storage.', inBusiness: 'In finance, this is asset management — accumulating and preserving wealth over long time horizons through diversified portfolios.' },
      function: 'Manages investment portfolios across equities, fixed income, alternatives, and real assets',
      dysregulation: 'Portfolio drawdown, AUM outflow, benchmark underperformance, liquidity mismatch',
      expectedTypes: [
        { type: 'Asset management firm', reason: 'Manages mutual funds, ETFs, and institutional portfolios', confidence: 0.95 },
        { type: 'Hedge fund', reason: 'Alternative investment strategies seeking absolute returns', confidence: 0.90 },
        { type: 'Index fund and ETF provider', reason: 'Passive investment products tracking market benchmarks', confidence: 0.88 },
        { type: 'Real asset fund manager', reason: 'Manages real estate, infrastructure, and commodity funds', confidence: 0.82 }
      ]
    },
    'NTS': {
      fullName: 'Nucleus Tractus Solitarius', label: 'Treasury & Cash Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Primary relay for visceral sensory input — integrates cardiovascular and respiratory signals.', inBusiness: 'In finance, this is treasury and cash management — the vital flow of liquidity that keeps institutions solvent and operations funded.' },
      function: 'Manages corporate treasury operations, cash positions, and liquidity across accounts',
      dysregulation: 'Liquidity crisis, cash forecast miss, trapped cash in foreign subsidiaries',
      expectedTypes: [
        { type: 'Treasury management system vendor', reason: 'Cash visibility, forecasting, and bank connectivity platforms', confidence: 0.92 },
        { type: 'Corporate treasury advisory', reason: 'Treasury strategy, policy, and organizational design', confidence: 0.85 },
        { type: 'Cash management bank', reason: 'Provides sweep accounts, ZBAs, and concentration services', confidence: 0.88 },
        { type: 'Liquidity management platform', reason: 'Money market fund portal and short-term investment optimization', confidence: 0.80 }
      ]
    },
    'CC': {
      fullName: 'Corpus Callosum', label: 'Interbank Networks', tier: 'top',
      neuroTranslation: { inNeurology: 'Largest white matter tract connecting left and right hemispheres.', inBusiness: 'In finance, these are interbank networks — SWIFT, Fedwire, CHIPS, and correspondent banking that connect financial institutions across the globe.' },
      function: 'Connects financial institutions through interbank messaging, clearing, and settlement networks',
      dysregulation: 'SWIFT outage, correspondent banking de-risking, cross-border settlement failure',
      expectedTypes: [
        { type: 'Interbank network operator', reason: 'SWIFT messaging, Fedwire, and clearing network infrastructure', confidence: 0.95 },
        { type: 'Correspondent banking service', reason: 'Cross-border banking relationships and nostro/vostro management', confidence: 0.88 },
        { type: 'Cross-border payment provider', reason: 'International remittance and B2B cross-border transfers', confidence: 0.85 },
        { type: 'Financial messaging platform', reason: 'ISO 20022 migration, API banking, and real-time messaging', confidence: 0.80 }
      ]
    },
    'FORN': {
      fullName: 'Fornix', label: 'Credit Reporting & Scoring', tier: 'top',
      neuroTranslation: { inNeurology: 'Major white matter bundle carrying output from hippocampus — dedicated fiber pathway.', inBusiness: 'In finance, this is credit reporting and scoring — the dedicated data pipelines that carry borrower credit history from lenders to bureaus to decision engines.' },
      function: 'Collects, stores, and distributes consumer and commercial credit data for lending decisions',
      dysregulation: 'Credit bureau data error, score model bias, reporting lag',
      expectedTypes: [
        { type: 'Credit bureau', reason: 'Collects and distributes consumer and commercial credit files', confidence: 0.95 },
        { type: 'Credit scoring model provider', reason: 'FICO, VantageScore, and alternative scoring methodologies', confidence: 0.90 },
        { type: 'Alternative credit data vendor', reason: 'Rent, utility, and cash flow data for thin-file borrowers', confidence: 0.85 },
        { type: 'Credit decisioning platform', reason: 'Automated underwriting engines using credit bureau data', confidence: 0.82 }
      ]
    },
    'CBLM': {
      fullName: 'Cerebellum', label: 'Trading & Execution', tier: 'top',
      neuroTranslation: { inNeurology: 'Coordinates voluntary movement with precise timing and calibration.', inBusiness: 'In finance, this is trading and execution — precisely timed buy and sell orders across equities, fixed income, FX, and derivatives with microsecond calibration.' },
      function: 'Executes securities trades across asset classes with precise timing, routing, and best execution',
      dysregulation: 'Flash crash, execution latency, best execution failure, dark pool leakage',
      expectedTypes: [
        { type: 'Electronic trading platform', reason: 'Equities, FX, and fixed income electronic execution venues', confidence: 0.95 },
        { type: 'Algorithmic trading firm', reason: 'Quantitative and systematic trading strategies', confidence: 0.90 },
        { type: 'Execution management system vendor', reason: 'EMS and OMS for institutional order routing and execution', confidence: 0.85 },
        { type: 'Market maker', reason: 'Provides continuous bid-ask liquidity in listed and OTC markets', confidence: 0.88 }
      ]
    },
    'OFC': {
      fullName: 'Orbitofrontal Cortex', label: 'Wealth Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Assigns value to choices and outcomes — integrates reward for decision-making.', inBusiness: 'In finance, this is wealth management — assigning value to financial goals, integrating risk preferences, and guiding high-net-worth client portfolios.' },
      function: 'Provides comprehensive wealth advisory, financial planning, and portfolio management for HNW clients',
      dysregulation: 'Client attrition, suitability violation, fee compression',
      expectedTypes: [
        { type: 'Wealth management firm', reason: 'Holistic advisory for high-net-worth and ultra-HNW clients', confidence: 0.95 },
        { type: 'Registered investment advisor', reason: 'Fee-only fiduciary investment management', confidence: 0.90 },
        { type: 'Private bank', reason: 'Banking, lending, and investment services for wealthy clients', confidence: 0.88 },
        { type: 'Family office service provider', reason: 'Multi-generational wealth administration and governance', confidence: 0.82 }
      ]
    },
    'S1': {
      fullName: 'Primary Somatosensory Cortex', label: 'Financial Data & Market Data', tier: 'top',
      neuroTranslation: { inNeurology: 'Processes tactile, pressure, and temperature signals from the body.', inBusiness: 'In finance, this is market data and financial data — the raw sensory feeds of prices, volumes, fundamentals, and economic indicators that market participants consume.' },
      function: 'Provides real-time and historical market data, fundamentals, and economic data feeds',
      dysregulation: 'Data feed outage, stale prices, data quality errors, vendor lock-in',
      expectedTypes: [
        { type: 'Market data vendor', reason: 'Real-time and historical price, volume, and reference data', confidence: 0.95 },
        { type: 'Financial data aggregator', reason: 'Consolidated fundamental, alternative, and economic data', confidence: 0.90 },
        { type: 'Exchange data service', reason: 'Direct feed market data from stock and derivatives exchanges', confidence: 0.85 },
        { type: 'Alternative data provider', reason: 'Satellite, web scraping, and sentiment data for investment research', confidence: 0.82 }
      ]
    },
    'ENS': {
      fullName: 'Enteric Nervous System', label: 'Compliance & Regulatory Reporting', tier: 'top',
      neuroTranslation: { inNeurology: 'Autonomous nervous system of the gut — manages digestion independently.', inBusiness: 'In finance, this is compliance and regulatory reporting — the autonomous processing layer that handles KYC, AML, CTR, SAR, and regulatory filings.' },
      function: 'Manages regulatory compliance including KYC, AML, CTR/SAR filing, and regulatory reporting',
      dysregulation: 'Compliance failure, consent order, AML program deficiency, regulatory fine',
      expectedTypes: [
        { type: 'RegTech compliance platform', reason: 'Automated KYC, AML, sanctions screening, and regulatory reporting', confidence: 0.92 },
        { type: 'Anti-money laundering vendor', reason: 'Transaction monitoring, SAR filing, and AML case management', confidence: 0.90 },
        { type: 'Regulatory reporting service', reason: 'Call reports, CCAR, DFAST, and SEC/FINRA filing automation', confidence: 0.85 },
        { type: 'Compliance consulting firm', reason: 'BSA/AML program design, audit, and regulatory exam preparation', confidence: 0.80 }
      ]
    },
    'dlPFC': {
      fullName: 'Dorsolateral Prefrontal Cortex', label: 'Risk Management', tier: 'top',
      neuroTranslation: { inNeurology: 'Supports working memory, planning, and multi-goal coordination.', inBusiness: 'In finance, this is enterprise risk management — coordinating market risk, credit risk, operational risk, and liquidity risk across the institution.' },
      function: 'Measures and manages enterprise risk across market, credit, operational, and liquidity dimensions',
      dysregulation: 'Risk model failure, VaR breach, risk limit overrun, tail event underestimation',
      expectedTypes: [
        { type: 'Risk management platform vendor', reason: 'Enterprise risk, market risk, and credit risk analytics', confidence: 0.95 },
        { type: 'Credit risk analytics firm', reason: 'PD, LGD, EAD models and portfolio credit risk', confidence: 0.90 },
        { type: 'Operational risk consultancy', reason: 'OpRisk framework, RCSA, scenario analysis, and loss data', confidence: 0.85 },
        { type: 'Risk technology integrator', reason: 'Aggregated risk dashboards and regulatory capital calculation', confidence: 0.82 }
      ]
    },
    'dACC': {
      fullName: 'Dorsal Anterior Cingulate Cortex', label: 'Fraud Detection & Prevention', tier: 'top',
      neuroTranslation: { inNeurology: 'Detects conflicts and errors, signaling when corrective action is needed.', inBusiness: 'In finance, this is fraud detection — identifying anomalous transactions, account takeover attempts, and payment fraud requiring corrective intervention.' },
      function: 'Detects and prevents financial fraud across payments, accounts, and transactions',
      dysregulation: 'Fraud loss spike, false positive overload, account takeover wave',
      expectedTypes: [
        { type: 'Fraud detection platform', reason: 'Real-time transaction fraud scoring and prevention', confidence: 0.95 },
        { type: 'Identity verification vendor', reason: 'KYC identity proofing, document verification, and biometrics', confidence: 0.90 },
        { type: 'Payment fraud analytics firm', reason: 'Card fraud, ACH fraud, and wire fraud detection models', confidence: 0.88 },
        { type: 'Account takeover prevention vendor', reason: 'Behavioral biometrics and device intelligence for account security', confidence: 0.82 }
      ]
    },
    'vmPFC': {
      fullName: 'Ventromedial Prefrontal Cortex', label: 'Financial Regulation & Policy', tier: 'top',
      neuroTranslation: { inNeurology: 'Encodes subjective value and integrates emotional significance into decisions.', inBusiness: 'In finance, this is financial regulation and policy — the value-laden decisions about capital requirements, consumer protection, and systemic stability.' },
      function: 'Sets and enforces financial regulation including capital requirements, consumer protection, and market rules',
      dysregulation: 'Regulatory uncertainty, rule rollback, enforcement inconsistency, compliance cost spike',
      expectedTypes: [
        { type: 'Financial regulatory advisory firm', reason: 'SEC, FINRA, OCC, CFPB, and state regulatory guidance', confidence: 0.92 },
        { type: 'Government affairs and lobbying firm', reason: 'Financial services policy advocacy and legislative strategy', confidence: 0.82 },
        { type: 'Regulatory change management platform', reason: 'Tracks and implements regulatory changes across jurisdictions', confidence: 0.85 },
        { type: 'Consumer financial protection consultancy', reason: 'CFPB compliance, fair lending, and UDAAP analysis', confidence: 0.80 }
      ]
    },
    'BNST': {
      fullName: 'Bed Nucleus of the Stria Terminalis', label: 'Derivatives & Hedging', tier: 'top',
      neuroTranslation: { inNeurology: 'Mediates sustained anxiety and vigilance to uncertain threats.', inBusiness: 'In finance, this is derivatives and hedging — financial instruments addressing sustained uncertainty in rates, currencies, and commodities.' },
      function: 'Provides derivatives instruments for hedging interest rate, FX, commodity, and credit risk',
      dysregulation: 'Counterparty default, margin call cascade, basis risk blowup, derivatives mispricing',
      expectedTypes: [
        { type: 'Derivatives dealer', reason: 'OTC and listed derivatives market-making and structuring', confidence: 0.92 },
        { type: 'Derivatives clearing house', reason: 'Central counterparty clearing for OTC and listed derivatives', confidence: 0.88 },
        { type: 'Derivatives valuation vendor', reason: 'Pricing models, CVA/DVA calculation, and fair value services', confidence: 0.85 },
        { type: 'Corporate hedging advisory', reason: 'FX, interest rate, and commodity hedge program design', confidence: 0.80 }
      ]
    },
    'CAUD': {
      fullName: 'Caudate', label: 'Digital Assets & Crypto', tier: 'top',
      neuroTranslation: { inNeurology: 'Part of basal ganglia involved in goal-directed action selection and reward anticipation.', inBusiness: 'In finance, this is digital assets and cryptocurrency — goal-directed emerging financial instruments pursuing the reward of decentralized value transfer.' },
      function: 'Enables trading, custody, and settlement of digital assets, cryptocurrencies, and tokenized securities',
      dysregulation: 'Crypto exchange collapse, stablecoin depeg, smart contract exploit, regulatory ban',
      expectedTypes: [
        { type: 'Crypto exchange', reason: 'Digital asset trading and exchange platform', confidence: 0.90 },
        { type: 'Digital asset custodian', reason: 'Institutional-grade custody for cryptocurrencies and tokens', confidence: 0.88 },
        { type: 'Blockchain infrastructure provider', reason: 'Node services, staking, and blockchain data infrastructure', confidence: 0.85 },
        { type: 'Tokenization platform', reason: 'Real-world asset tokenization on distributed ledgers', confidence: 0.82 }
      ]
    },
    'FEF': {
      fullName: 'Frontal Eye Fields', label: 'Fintech & Neobanking', tier: 'top',
      neuroTranslation: { inNeurology: 'Controls voluntary eye movements directing visual attention.', inBusiness: 'In finance, this is fintech and neobanking — directed digital-first financial solutions for underserved and mobile-native markets.' },
      function: 'Delivers digital-first banking, lending, and financial services via mobile and API platforms',
      dysregulation: 'Neobank run, unit economics failure, regulatory crackdown on BaaS',
      expectedTypes: [
        { type: 'Neobank', reason: 'Digital-only bank with mobile-first consumer experience', confidence: 0.92 },
        { type: 'Banking-as-a-Service platform', reason: 'Enables non-banks to embed banking via APIs and sponsor bank partnerships', confidence: 0.88 },
        { type: 'Embedded finance platform', reason: 'Financial services embedded into non-financial products and platforms', confidence: 0.85 },
        { type: 'Financial super-app', reason: 'Integrated payments, banking, investing, and insurance in one app', confidence: 0.78 }
      ]
    },
    'EMP': {
      fullName: 'Empathy', label: 'ESG & Impact Investing', tier: 'top',
      neuroTranslation: { inNeurology: 'Neural basis of understanding others\' states and experiences.', inBusiness: 'In finance, this is ESG and impact investing — understanding social and environmental impacts and integrating them into investment and lending decisions.' },
      function: 'Integrates environmental, social, and governance factors into investment analysis and capital allocation',
      dysregulation: 'Greenwashing scandal, ESG data inconsistency, impact measurement failure',
      expectedTypes: [
        { type: 'ESG data and ratings provider', reason: 'ESG scores, climate data, and sustainability ratings for investors', confidence: 0.90 },
        { type: 'Impact investing fund', reason: 'Intentional social and environmental impact with financial returns', confidence: 0.88 },
        { type: 'ESG advisory firm', reason: 'ESG strategy, reporting, and framework implementation (TCFD, SASB)', confidence: 0.85 },
        { type: 'Green bond underwriter', reason: 'Issuance and certification of green, social, and sustainability bonds', confidence: 0.80 }
      ]
    },
    'BROCA': {
      fullName: 'Broca\'s Area', label: 'Financial Automation & RPA', tier: 'top',
      neuroTranslation: { inNeurology: 'Produces structured speech output — translates thought into articulated language.', inBusiness: 'In finance, this is financial automation — translating business rules and regulatory requirements into automated processing, straight-through processing, and RPA workflows.' },
      function: 'Automates financial workflows including trade processing, reconciliation, and regulatory filing',
      dysregulation: 'Automation script failure, STP breakdown, reconciliation error',
      expectedTypes: [
        { type: 'Financial RPA vendor', reason: 'Robotic process automation for banking, insurance, and capital markets', confidence: 0.90 },
        { type: 'Straight-through processing platform', reason: 'End-to-end trade and payment automation with zero manual touch', confidence: 0.88 },
        { type: 'Reconciliation automation vendor', reason: 'Automated matching and exception management for financial operations', confidence: 0.85 }
      ]
    },
    'CING': {
      fullName: 'Cingulum', label: 'Fund Administration', tier: 'top',
      neuroTranslation: { inNeurology: 'White matter bundle connecting frontal and temporal lobes — carries signals along a fixed pathway.', inBusiness: 'In finance, this is fund administration — the fixed operational pathway handling NAV calculation, investor reporting, and fund accounting for investment vehicles.' },
      function: 'Provides fund accounting, NAV calculation, investor reporting, and transfer agency for investment funds',
      dysregulation: 'NAV error, late investor reporting, transfer agency processing failure',
      expectedTypes: [
        { type: 'Fund administrator', reason: 'NAV calculation, fund accounting, and investor services for hedge and PE funds', confidence: 0.92 },
        { type: 'Transfer agent', reason: 'Shareholder record-keeping, distribution processing, and tax reporting', confidence: 0.85 },
        { type: 'Fund accounting platform', reason: 'Automated fund accounting and multi-currency book-keeping', confidence: 0.82 }
      ]
    },

    // ── OPERATIONAL NODES (83) ───────────────────────────────────────

    'A1': {
      fullName: 'Primary Auditory Cortex', label: 'Financial Intelligence & SIGINT', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes auditory signals from the environment.', inBusiness: 'In finance, this is financial intelligence — monitoring earnings calls, regulatory announcements, and market chatter for actionable signals.' },
      function: 'Monitors and analyzes financial communications, earnings calls, and regulatory signals',
      dysregulation: 'Missed material announcement, earnings surprise, regulatory signal misread',
      expectedTypes: [
        { type: 'Earnings call analytics platform', reason: 'NLP analysis of earnings calls, transcripts, and management tone', confidence: 0.88 },
        { type: 'Financial news analytics vendor', reason: 'Real-time news sentiment and event detection for trading', confidence: 0.85 },
        { type: 'Regulatory intelligence service', reason: 'Monitors federal register, rule proposals, and enforcement actions', confidence: 0.80 }
      ]
    },
    'ADR': {
      fullName: 'Adrenal', label: 'Crisis & Emergency Finance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Releases adrenaline and cortisol for rapid mobilization under stress.', inBusiness: 'In finance, this is crisis finance — emergency liquidity facilities, Fed discount window, and rapid capital raises during market stress.' },
      function: 'Mobilizes emergency capital and liquidity during financial crises and market dislocations',
      dysregulation: 'Slow crisis response, liquidity freeze, emergency facility access failure',
      expectedTypes: [
        { type: 'Crisis management advisory', reason: 'Financial institution crisis response, restructuring, and stabilization', confidence: 0.90 },
        { type: 'Distressed debt fund', reason: 'Invests in distressed securities during market dislocations', confidence: 0.85 },
        { type: 'Emergency lending facility operator', reason: 'Government and central bank emergency lending programs', confidence: 0.78 }
      ]
    },
    'AG': {
      fullName: 'Angular Gyrus', label: 'Financial Standards & Accounting', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates multimodal sensory input into unified concepts.', inBusiness: 'In finance, this is the standards layer — GAAP, IFRS, FASB, and accounting standards that unify financial reporting across institutions.' },
      function: 'Maintains financial reporting standards, accounting guidance, and audit frameworks',
      dysregulation: 'Accounting restatement, standards misapplication, audit failure',
      expectedTypes: [
        { type: 'Accounting and audit firm', reason: 'Financial statement audit, assurance, and accounting advisory', confidence: 0.92 },
        { type: 'Financial reporting platform', reason: 'Automated GAAP/IFRS reporting, consolidation, and close management', confidence: 0.85 },
        { type: 'Accounting standards advisory', reason: 'FASB/IASB implementation guidance and technical accounting', confidence: 0.78 }
      ]
    },
    'AI': {
      fullName: 'Anterior Insula', label: 'Financial Condition Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Generates conscious awareness of bodily states — interoception.', inBusiness: 'In finance, this is real-time financial health monitoring — capital ratios, liquidity metrics, and stress indicators across the institution.' },
      function: 'Provides real-time visibility into institutional financial health and stress indicators',
      dysregulation: 'Capital ratio blind spot, liquidity metric gap, delayed stress detection',
      expectedTypes: [
        { type: 'Bank financial health monitoring platform', reason: 'Real-time capital adequacy, liquidity, and earnings dashboards', confidence: 0.88 },
        { type: 'Stress testing vendor', reason: 'CCAR, DFAST, and custom scenario stress testing models', confidence: 0.85 },
        { type: 'Financial early warning system', reason: 'Predicts institutional distress from market and fundamental signals', confidence: 0.80 }
      ]
    },
    'ANT': {
      fullName: 'Anterior Thalamus', label: 'Trade Settlement & Clearing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays signals between hippocampus and cingulate cortex in the Papez circuit.', inBusiness: 'In finance, this is trade settlement and clearing — routing executed trades through clearinghouses to final settlement and ownership transfer.' },
      function: 'Clears and settles securities trades through central counterparties and depositories',
      dysregulation: 'Settlement failure, clearing fund shortfall, T+1 transition disruption',
      expectedTypes: [
        { type: 'Clearing house operator', reason: 'Central counterparty clearing for equities, derivatives, and fixed income', confidence: 0.92 },
        { type: 'Central securities depository', reason: 'Holds securities in book-entry form and processes settlement', confidence: 0.88 },
        { type: 'Post-trade processing vendor', reason: 'Trade confirmation, affirmation, and settlement instruction matching', confidence: 0.82 }
      ]
    },
    'ARC': {
      fullName: 'Arcuate Fasciculus', label: 'Financial Messaging & APIs', tier: 'operational',
      neuroTranslation: { inNeurology: 'White matter connecting Broca and Wernicke areas for language.', inBusiness: 'In finance, this is financial messaging infrastructure — FIX protocol, ISO 20022, and open banking APIs connecting trading, banking, and payment systems.' },
      function: 'Connects financial systems through standardized messaging protocols and APIs',
      dysregulation: 'FIX connection drop, API gateway failure, message format mismatch',
      expectedTypes: [
        { type: 'Financial API platform', reason: 'Open banking APIs, account aggregation, and data connectivity', confidence: 0.90 },
        { type: 'FIX protocol connectivity vendor', reason: 'FIX engine, order routing, and market connectivity services', confidence: 0.85 },
        { type: 'Financial data integration platform', reason: 'ETL, data normalization, and cross-system integration for finance', confidence: 0.82 }
      ]
    },
    'BDNF': {
      fullName: 'BDNF / Plasticity', label: 'Financial Innovation & Modernization', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports neuronal growth, synaptic plasticity, and adaptive rewiring.', inBusiness: 'In finance, this is financial system modernization — core banking transformation, legacy system migration, and digital transformation.' },
      function: 'Drives financial system modernization, core banking replacement, and digital transformation',
      dysregulation: 'Core system failure, digital transformation stall, legacy technology debt',
      expectedTypes: [
        { type: 'Core banking platform vendor', reason: 'Modern core banking systems replacing legacy mainframes', confidence: 0.92 },
        { type: 'Financial digital transformation consultancy', reason: 'Bank and insurer digital strategy and implementation', confidence: 0.88 },
        { type: 'Cloud migration for financial services', reason: 'AWS, Azure, and GCP cloud adoption for regulated institutions', confidence: 0.82 }
      ]
    },
    'BLA': {
      fullName: 'Basolateral Amygdala', label: 'Financial Risk Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Evaluates threat significance and assigns emotional valence.', inBusiness: 'In finance, this is credit and counterparty risk assessment — evaluating the threat of borrower default and counterparty failure.' },
      function: 'Assesses credit risk, counterparty risk, and concentration risk across portfolios',
      dysregulation: 'Underestimated credit risk, ignored counterparty exposure, concentration blindspot',
      expectedTypes: [
        { type: 'Credit risk analytics firm', reason: 'Probability of default, loss given default, and exposure modeling', confidence: 0.92 },
        { type: 'Counterparty risk platform', reason: 'CVA, bilateral margin, and counterparty exposure calculation', confidence: 0.85 },
        { type: 'Credit rating agency', reason: 'Issuer and issue credit ratings for debt securities', confidence: 0.88 }
      ]
    },
    'CARD': {
      fullName: 'Cardiac', label: 'Core Processing Systems', tier: 'operational',
      neuroTranslation: { inNeurology: 'Autonomic cardiac regulation.', inBusiness: 'In finance, this is the core processing heart — account processing, general ledger, and transaction engines that must operate 24/7 without interruption.' },
      function: 'Runs core account processing, general ledger, and real-time transaction engines',
      dysregulation: 'Core system outage, transaction processing failure, GL reconciliation error',
      expectedTypes: [
        { type: 'Core banking processor', reason: 'Real-time deposit, loan, and GL processing engines', confidence: 0.92 },
        { type: 'Card processing platform', reason: 'Credit and debit card authorization, clearing, and settlement', confidence: 0.88 },
        { type: 'Insurance policy administration system', reason: 'Policy issuance, billing, and claims processing core system', confidence: 0.82 }
      ]
    },
    'CLAUST': {
      fullName: 'Claustrum', label: 'Financial System Integration', tier: 'operational',
      neuroTranslation: { inNeurology: 'Hypothesized to integrate information across cortical areas into unified experience.', inBusiness: 'In finance, this is system integration — connecting trading, banking, risk, and compliance into a unified operating platform.' },
      function: 'Integrates trading, banking, risk, and compliance systems into unified financial operations',
      dysregulation: 'Data silo between front and back office, integration failure, system fragmentation',
      expectedTypes: [
        { type: 'Financial middleware vendor', reason: 'Enterprise service bus and integration platform for financial institutions', confidence: 0.88 },
        { type: 'Wealth platform integrator', reason: 'Unified advisor desktop connecting portfolio, CRM, and planning', confidence: 0.85 },
        { type: 'Insurance platform integrator', reason: 'Connects underwriting, policy admin, claims, and billing systems', confidence: 0.80 }
      ]
    },
    'CMZ': {
      fullName: 'Cerebellar Motor Zone', label: 'Financial Hardware & Infrastructure', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fine-tunes motor output for precision execution.', inBusiness: 'In finance, this is specialized financial infrastructure — ATM networks, POS terminals, trading floor hardware, and secure data centers.' },
      function: 'Provides physical financial infrastructure including ATMs, POS terminals, and trading floor systems',
      dysregulation: 'ATM network outage, POS terminal failure, trading floor hardware malfunction',
      expectedTypes: [
        { type: 'ATM network operator', reason: 'ATM deployment, management, and cash replenishment services', confidence: 0.88 },
        { type: 'POS terminal manufacturer', reason: 'Card reader, payment terminal, and mPOS hardware', confidence: 0.85 },
        { type: 'Financial data center operator', reason: 'Colocation, connectivity, and disaster recovery for financial firms', confidence: 0.82 }
      ]
    },
    'CON': {
      fullName: 'Cingulo-Opercular Network', label: 'Financial Operations & Back Office', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustains attention and task-set maintenance during prolonged operations.', inBusiness: 'In finance, this is sustained back-office operations — trade reconciliation, corporate actions processing, and daily NAV computation that must run reliably every business day.' },
      function: 'Executes daily financial operations including reconciliation, corporate actions, and settlement',
      dysregulation: 'Reconciliation break, missed corporate action, operational error accumulation',
      expectedTypes: [
        { type: 'Financial operations outsourcing firm', reason: 'Back-office, middle-office, and operations managed services', confidence: 0.90 },
        { type: 'Corporate actions processing vendor', reason: 'Automated corporate actions notification and processing', confidence: 0.85 },
        { type: 'Financial operations consultancy', reason: 'OpModel design, process optimization, and efficiency improvement', confidence: 0.80 }
      ]
    },
    'CeA': {
      fullName: 'Central Amygdala', label: 'Financial Crime Prevention', tier: 'operational',
      neuroTranslation: { inNeurology: 'Outputs fear and threat responses — triggers defensive behaviors.', inBusiness: 'In finance, this is financial crime prevention — triggering defensive responses to money laundering, terrorist financing, and sanctions violations.' },
      function: 'Prevents and investigates financial crime including money laundering, sanctions evasion, and terrorist financing',
      dysregulation: 'AML program failure, sanctions breach, financial crime undetected',
      expectedTypes: [
        { type: 'Financial crime investigation platform', reason: 'Case management, link analysis, and SAR filing for financial crime', confidence: 0.90 },
        { type: 'Sanctions screening vendor', reason: 'OFAC, EU, and UN sanctions list screening for transactions and customers', confidence: 0.88 },
        { type: 'Financial intelligence unit service', reason: 'Suspicious activity investigation and FinCEN reporting', confidence: 0.82 }
      ]
    },
    'DAN': {
      fullName: 'Dorsal Attention Network', label: 'Financial Due Diligence', tier: 'operational',
      neuroTranslation: { inNeurology: 'Top-down voluntary attention directed toward selected stimuli.', inBusiness: 'In finance, this is targeted due diligence — deep investigation of acquisition targets, borrowers, and investment opportunities.' },
      function: 'Conducts targeted financial due diligence on M&A targets, borrowers, and investment opportunities',
      dysregulation: 'Inadequate due diligence, missed red flags, incomplete financial analysis',
      expectedTypes: [
        { type: 'Financial due diligence firm', reason: 'Quality of earnings, working capital, and financial analysis for M&A', confidence: 0.92 },
        { type: 'Forensic accounting firm', reason: 'Fraud investigation, litigation support, and dispute quantification', confidence: 0.88 },
        { type: 'Background check and KYB vendor', reason: 'Business verification, beneficial ownership, and adverse media screening', confidence: 0.82 }
      ]
    },
    'DISS': {
      fullName: 'Dissolution', label: 'Corporate Restructuring & Liquidation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Dissolution of coherent network states.', inBusiness: 'In finance, this is corporate restructuring and liquidation — Chapter 11, asset sales, and wind-down of failed financial entities.' },
      function: 'Restructures distressed companies, liquidates failed institutions, and resolves insolvencies',
      dysregulation: 'Disorderly liquidation, creditor value destruction, resolution plan failure',
      expectedTypes: [
        { type: 'Restructuring advisory firm', reason: 'Chapter 11 advisory, DIP financing, and creditor negotiation', confidence: 0.92 },
        { type: 'Liquidation service provider', reason: 'Orderly asset disposition and wind-down services', confidence: 0.85 },
        { type: 'Bankruptcy law firm', reason: 'Chapter 7, 11, and 15 bankruptcy legal representation', confidence: 0.88 }
      ]
    },
    'DMN': {
      fullName: 'Default Mode Network', label: 'Financial Planning & Forecasting', tier: 'operational',
      neuroTranslation: { inNeurology: 'Active during rest and self-referential thought — mental simulation and future planning.', inBusiness: 'In finance, this is long-range financial planning — budgeting, forecasting, capital planning, and strategic financial modeling.' },
      function: 'Develops financial plans, budgets, forecasts, and strategic capital allocation models',
      dysregulation: 'Budget miss, forecast error, capital misallocation, planning-reality gap',
      expectedTypes: [
        { type: 'Financial planning and analysis platform', reason: 'FP&A budgeting, forecasting, and scenario modeling software', confidence: 0.92 },
        { type: 'Strategic financial advisory', reason: 'Long-range capital planning, M&A strategy, and portfolio optimization', confidence: 0.85 },
        { type: 'Corporate performance management vendor', reason: 'Close management, consolidation, and management reporting', confidence: 0.82 }
      ]
    },
    'DV': {
      fullName: 'Dorsal Vagal', label: 'Trading Halts & Circuit Breakers', tier: 'operational',
      neuroTranslation: { inNeurology: 'Triggers freeze/shutdown under extreme threat.', inBusiness: 'In finance, this is trading halts and circuit breakers — automated market shutdowns during extreme volatility to prevent cascading losses.' },
      function: 'Implements trading halts, circuit breakers, and market-wide protective stops',
      dysregulation: 'Circuit breaker trigger causing panic, halt mechanism failure, flash crash',
      expectedTypes: [
        { type: 'Market surveillance system vendor', reason: 'Exchange surveillance, circuit breaker logic, and halt management', confidence: 0.88 },
        { type: 'Volatility risk management firm', reason: 'Portfolio protection, tail hedging, and volatility surface modeling', confidence: 0.85 },
        { type: 'Market microstructure consultancy', reason: 'Circuit breaker design, tick size, and market structure analysis', confidence: 0.78 }
      ]
    },
    'EC': {
      fullName: 'Entorhinal Cortex', label: 'Financial Geography & Branch Networks', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gateway to hippocampus with grid cells for spatial navigation.', inBusiness: 'In finance, this is branch and distribution geography — mapping service territories, branch locations, and ATM coverage areas.' },
      function: 'Optimizes branch locations, ATM placement, and geographic financial service coverage',
      dysregulation: 'Branch location inefficiency, financial desert, coverage gap',
      expectedTypes: [
        { type: 'Branch analytics and optimization firm', reason: 'Branch profitability, consolidation analysis, and site selection', confidence: 0.85 },
        { type: 'Financial services geospatial platform', reason: 'CRA mapping, market penetration, and competitive landscape', confidence: 0.82 },
        { type: 'Digital branch transformation vendor', reason: 'Interactive teller machines, video banking, and branch technology', confidence: 0.78 }
      ]
    },
    'ECN': {
      fullName: 'Executive Control Network', label: 'Financial Program Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Manages top-down cognitive control and executive decision-making.', inBusiness: 'In finance, this is program management — PMOs overseeing core system conversions, merger integrations, and regulatory implementations.' },
      function: 'Manages large-scale financial programs including system conversions, mergers, and regulatory implementations',
      dysregulation: 'Conversion failure, merger integration delay, regulatory deadline miss',
      expectedTypes: [
        { type: 'Financial services PMO firm', reason: 'Program management for bank mergers, conversions, and regulatory programs', confidence: 0.90 },
        { type: 'Merger integration specialist', reason: 'Day 1 readiness, system conversion, and operational integration', confidence: 0.88 },
        { type: 'Regulatory implementation consultancy', reason: 'CECL, LIBOR transition, T+1, and Basel III implementation', confidence: 0.85 }
      ]
    },
    'EI': {
      fullName: 'Excitatory/Inhibitory Ratio', label: 'Monetary Policy & Interest Rates', tier: 'operational',
      neuroTranslation: { inNeurology: 'Balance between excitatory and inhibitory signaling maintaining network stability.', inBusiness: 'In finance, this is monetary policy and interest rate management — the Fed funds rate, quantitative easing, and yield curve management that balance growth and inflation.' },
      function: 'Transmits monetary policy through interest rate changes, reserve requirements, and open market operations',
      dysregulation: 'Rate shock, yield curve inversion, policy miscommunication, taper tantrum',
      expectedTypes: [
        { type: 'Fixed income analytics vendor', reason: 'Yield curve modeling, rate sensitivity, and duration analytics', confidence: 0.90 },
        { type: 'Interest rate risk management platform', reason: 'ALM, NII simulation, and EVE analysis for banks', confidence: 0.88 },
        { type: 'Monetary policy research firm', reason: 'Central bank policy analysis and rate path forecasting', confidence: 0.80 }
      ]
    },
    'ENDO': {
      fullName: 'Endocannabinoid', label: 'Financial Shock Absorbers', tier: 'operational',
      neuroTranslation: { inNeurology: 'Modulates synaptic transmission to dampen excessive activity.', inBusiness: 'In finance, this is shock absorption — deposit insurance, market stabilization funds, and liquidity backstops that dampen excessive volatility.' },
      function: 'Provides financial stability backstops including deposit insurance, stabilization funds, and liquidity facilities',
      dysregulation: 'Deposit insurance fund depletion, stabilization mechanism failure',
      expectedTypes: [
        { type: 'Deposit insurance system operator', reason: 'FDIC-style deposit insurance and bank resolution authority', confidence: 0.85 },
        { type: 'Market stabilization fund manager', reason: 'Exchange stabilization, sovereign wealth, and crisis intervention funds', confidence: 0.82 },
        { type: 'Financial guarantee insurer', reason: 'Bond insurance, mortgage guarantee, and credit enhancement', confidence: 0.78 }
      ]
    },
    'FG': {
      fullName: 'Fusiform Gyrus', label: 'Financial AI & Machine Learning', tier: 'operational',
      neuroTranslation: { inNeurology: 'Specialized for visual pattern recognition.', inBusiness: 'In finance, this is AI and ML applied to financial services — algorithmic credit scoring, anomaly detection, and automated document processing.' },
      function: 'Applies AI and machine learning to credit scoring, fraud detection, and financial document processing',
      dysregulation: 'Model bias, algorithmic discrimination, explainability failure',
      expectedTypes: [
        { type: 'Financial AI platform', reason: 'ML models for credit, fraud, compliance, and customer analytics', confidence: 0.92 },
        { type: 'Document intelligence for finance', reason: 'Automated extraction from financial statements, contracts, and filings', confidence: 0.88 },
        { type: 'Explainable AI vendor for finance', reason: 'Model interpretability and fairness testing for regulated financial models', confidence: 0.82 }
      ]
    },
    'FPN': {
      fullName: 'Frontoparietal Network', label: 'Financial Cybersecurity', tier: 'operational',
      neuroTranslation: { inNeurology: 'Executive control managing task-switching and adaptive control.', inBusiness: 'In finance, this is cybersecurity — protecting banking systems, trading platforms, and customer data from cyber threats.' },
      function: 'Protects financial systems and customer data from cyber threats and unauthorized access',
      dysregulation: 'Data breach, ransomware attack on bank, trading system compromise',
      expectedTypes: [
        { type: 'Financial cybersecurity vendor', reason: 'Banking and capital markets specific security monitoring and response', confidence: 0.92 },
        { type: 'Financial penetration testing firm', reason: 'Red team exercises on banking, trading, and payment systems', confidence: 0.88 },
        { type: 'FFIEC cybersecurity assessment vendor', reason: 'CAT assessment, NIST CSF, and financial sector security frameworks', confidence: 0.85 }
      ]
    },
    'GABA_GLU': {
      fullName: 'GABA/Glutamate Balance', label: 'Financial Controls & SOX', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fundamental excitatory/inhibitory balance controlling neural stability.', inBusiness: 'In finance, these are internal controls — SOX compliance, segregation of duties, and approval workflows that prevent unauthorized transactions.' },
      function: 'Maintains internal financial controls including SOX compliance, authorization matrices, and dual-control procedures',
      dysregulation: 'Control failure, unauthorized transaction, SOX material weakness',
      expectedTypes: [
        { type: 'SOX compliance platform', reason: 'Internal control testing, evidence management, and deficiency tracking', confidence: 0.90 },
        { type: 'Internal audit firm for financial services', reason: 'Independent assessment of controls, processes, and risk management', confidence: 0.88 },
        { type: 'Access governance vendor', reason: 'Identity management, entitlement review, and segregation of duties', confidence: 0.85 }
      ]
    },
    'GBA': {
      fullName: 'Gut-Brain Axis', label: 'Underground Economy & Cash Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Bidirectional communication between gut and brain.', inBusiness: 'In finance, this is the cash and physical currency layer — armored transport, cash vault management, and currency processing that operates invisibly beneath digital systems.' },
      function: 'Manages physical cash distribution, vault operations, and currency processing',
      dysregulation: 'Cash shortage, counterfeit circulation, armored car service disruption',
      expectedTypes: [
        { type: 'Armored transport and cash logistics firm', reason: 'Cash pickup, delivery, and vault services for banks and retail', confidence: 0.88 },
        { type: 'Currency processing vendor', reason: 'High-speed currency counting, sorting, and counterfeit detection', confidence: 0.82 },
        { type: 'Cash management advisory', reason: 'Cash cycle optimization and cash inventory management', confidence: 0.75 }
      ]
    },
    'GP': {
      fullName: 'Globus Pallidus', label: 'Licensing & Chartering', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates voluntary movement by selecting which programs to release or inhibit.', inBusiness: 'In finance, this is licensing and chartering — regulatory gates that release or block financial institutions from operating based on charter, license, and registration review.' },
      function: 'Gates financial institutions through chartering, licensing, and registration requirements',
      dysregulation: 'License revocation, charter application denial, registration deficiency',
      expectedTypes: [
        { type: 'Bank chartering consultancy', reason: 'De novo bank charter applications, OCC and state chartering', confidence: 0.88 },
        { type: 'Broker-dealer registration firm', reason: 'FINRA membership, SEC registration, and state licensing', confidence: 0.85 },
        { type: 'Insurance licensing service', reason: 'State insurance license applications and surplus lines compliance', confidence: 0.82 }
      ]
    },
    'HAB': {
      fullName: 'Habenula', label: 'Loss Analysis & Write-offs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Encodes negative outcomes — suppresses unrewarding actions.', inBusiness: 'In finance, this is loss analysis — investigating loan losses, trading losses, and operational losses to prevent recurrence.' },
      function: 'Investigates and analyzes financial losses across credit, trading, and operational domains',
      dysregulation: 'Repeated losses without root cause correction, loss reserve inadequacy',
      expectedTypes: [
        { type: 'Loan loss analysis firm', reason: 'Charge-off analysis, recovery optimization, and CECL reserve modeling', confidence: 0.88 },
        { type: 'Trading loss investigation service', reason: 'Rogue trader detection, P&L attribution, and loss event analysis', confidence: 0.85 },
        { type: 'Operational loss database vendor', reason: 'OpRisk loss data consortium and benchmark services', confidence: 0.78 }
      ]
    },
    'HPA': {
      fullName: 'HPA Axis', label: 'Systemic Risk Governance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Sustained stress response system.', inBusiness: 'In finance, this is systemic risk governance — the sustained oversight structure during financial crises including FSOC coordination and SIFI supervision.' },
      function: 'Governs systemic risk through FSOC coordination, SIFI designation, and macroprudential oversight',
      dysregulation: 'Systemic contagion, too-big-to-fail unresolved, macroprudential gap',
      expectedTypes: [
        { type: 'Systemic risk analytics firm', reason: 'Network analysis, contagion modeling, and interconnectedness metrics', confidence: 0.88 },
        { type: 'Macroprudential policy advisory', reason: 'Countercyclical buffers, SIFI designation, and systemic risk assessment', confidence: 0.82 },
        { type: 'Resolution planning consultancy', reason: 'Living wills, resolution plans, and TLAC/MREL compliance', confidence: 0.80 }
      ]
    },
    'HYPO': {
      fullName: 'Hypothalamus', label: 'Central Banking & Monetary Authority', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates homeostasis — temperature, hunger, thirst, and hormones.', inBusiness: 'In finance, this is central banking — Federal Reserve, ECB, and monetary authorities that regulate the homeostasis of money supply, interest rates, and financial stability.' },
      function: 'Manages monetary policy, bank supervision, and financial system stability as lender of last resort',
      dysregulation: 'Monetary policy error, inflation spiral, deflationary trap',
      expectedTypes: [
        { type: 'Central bank advisory service', reason: 'Monetary policy analysis, FX reserve management, and central bank operations', confidence: 0.85 },
        { type: 'CBDC technology vendor', reason: 'Central bank digital currency platform development and testing', confidence: 0.82 },
        { type: 'Monetary economics research firm', reason: 'Inflation forecasting, money supply analysis, and policy impact modeling', confidence: 0.78 }
      ]
    },
    'IC': {
      fullName: 'Inferior Colliculus', label: 'Transaction Monitoring', tier: 'operational',
      neuroTranslation: { inNeurology: 'Subcortical auditory processing relay.', inBusiness: 'In finance, this is transaction monitoring — the data relay layer streaming payment and trading data through compliance filters and fraud rules.' },
      function: 'Monitors financial transactions in real-time against compliance rules, fraud patterns, and risk thresholds',
      dysregulation: 'Monitoring gap, rule tuning failure, alert fatigue',
      expectedTypes: [
        { type: 'Transaction monitoring platform', reason: 'Real-time AML, fraud, and sanctions monitoring of payment flows', confidence: 0.92 },
        { type: 'Trade surveillance vendor', reason: 'Market abuse detection, insider trading, and manipulation alerts', confidence: 0.88 },
        { type: 'Alert management platform', reason: 'Alert triage, disposition, and quality assurance for compliance teams', confidence: 0.82 }
      ]
    },
    'IPS': {
      fullName: 'Intraparietal Sulcus', label: 'Financial Valuation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes numerical magnitude and spatial quantities.', inBusiness: 'In finance, this is valuation — discounted cash flow analysis, comparable transactions, and mark-to-market calculations for securities and businesses.' },
      function: 'Performs financial valuations for M&A, portfolio marking, and regulatory capital purposes',
      dysregulation: 'Valuation error, mark-to-market dispute, goodwill impairment',
      expectedTypes: [
        { type: 'Valuation advisory firm', reason: 'Business valuation, fairness opinions, and purchase price allocation', confidence: 0.92 },
        { type: 'Securities pricing service', reason: 'End-of-day pricing, evaluated pricing, and fair value hierarchy', confidence: 0.88 },
        { type: 'Real estate appraisal for financial institutions', reason: 'Collateral valuation, portfolio review, and appraisal management', confidence: 0.82 }
      ]
    },
    'LANG': {
      fullName: 'Language Network', label: 'Financial Reporting & Disclosure', tier: 'operational',
      neuroTranslation: { inNeurology: 'Distributed network supporting language comprehension and production.', inBusiness: 'In finance, this is financial reporting and disclosure — 10-K, 10-Q, proxy statements, and regulatory filings that communicate financial information to stakeholders.' },
      function: 'Produces and distributes financial reports, SEC filings, and regulatory disclosures',
      dysregulation: 'Filing deadline miss, material misstatement, disclosure deficiency',
      expectedTypes: [
        { type: 'SEC filing and reporting platform', reason: 'XBRL tagging, EDGAR filing, and disclosure management', confidence: 0.90 },
        { type: 'Investor relations platform', reason: 'Earnings releases, investor presentations, and shareholder communications', confidence: 0.85 },
        { type: 'Financial printing and filing service', reason: 'Prospectus printing, SEC filing, and virtual data rooms', confidence: 0.78 }
      ]
    },
    'LAR': {
      fullName: 'Laryngeal', label: 'Financial Customer Communications', tier: 'operational',
      neuroTranslation: { inNeurology: 'Controls laryngeal muscles for voice production.', inBusiness: 'In finance, this is customer communications — account statements, regulatory notices, and financial product disclosures.' },
      function: 'Delivers account statements, regulatory disclosures, and financial product communications to customers',
      dysregulation: 'Missing disclosure, statement delivery failure, regulatory notice deficiency',
      expectedTypes: [
        { type: 'Customer communications management vendor', reason: 'Automated statement generation, e-delivery, and document composition', confidence: 0.88 },
        { type: 'Financial notification platform', reason: 'Real-time alerts for transactions, balances, and account activity', confidence: 0.82 },
        { type: 'Regulatory disclosure management', reason: 'Truth in Lending, TILA-RESPA, and privacy notice compliance', confidence: 0.78 }
      ]
    },
    'LC': {
      fullName: 'Locus Coeruleus', label: 'Market Alerts & Signals', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary norepinephrine source modulating arousal and vigilance.', inBusiness: 'In finance, this is the alert layer — price alerts, margin calls, covenant breach notifications, and regulatory deadline warnings.' },
      function: 'Triggers financial alerts for price movements, margin calls, covenant breaches, and regulatory deadlines',
      dysregulation: 'Alert fatigue, missed margin call, covenant monitoring failure',
      expectedTypes: [
        { type: 'Financial alert and notification platform', reason: 'Price triggers, limit monitoring, and cross-asset alerting', confidence: 0.88 },
        { type: 'Covenant monitoring service', reason: 'Loan covenant compliance tracking and early warning', confidence: 0.85 },
        { type: 'Margin management system', reason: 'Real-time margin calculation, call issuance, and collateral management', confidence: 0.82 }
      ]
    },
    'LGN': {
      fullName: 'Lateral Geniculate Nucleus', label: 'Financial Document Review', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary relay for visual information to visual cortex.', inBusiness: 'In finance, this is document review — first-pass examination of loan documents, financial statements, and compliance filings.' },
      function: 'Reviews and validates financial documents including loan packages, statements, and regulatory filings',
      dysregulation: 'Missed document deficiency, incomplete loan file, filing error',
      expectedTypes: [
        { type: 'Loan document preparation service', reason: 'Mortgage and commercial loan document generation and review', confidence: 0.88 },
        { type: 'Financial document automation platform', reason: 'Contract analysis, clause extraction, and compliance checking', confidence: 0.85 },
        { type: 'Quality control and prefunding review firm', reason: 'Mortgage QC, prefunding review, and post-closing audit', confidence: 0.82 }
      ]
    },
    'MAMM': {
      fullName: 'Mammillary Bodies', label: 'Financial Archives & Record Retention', tier: 'operational',
      neuroTranslation: { inNeurology: 'Part of Papez memory circuit — relays hippocampal memory output.', inBusiness: 'In finance, this is record retention — account histories, trading records, and regulatory archives required by SEC Rule 17a-4, FINRA, and banking regulations.' },
      function: 'Preserves financial records, trading archives, and regulatory documentation per retention requirements',
      dysregulation: 'Records destruction violation, missing trade records, retention policy gap',
      expectedTypes: [
        { type: 'Financial records management vendor', reason: 'SEC 17a-4, FINRA, and banking record retention solutions', confidence: 0.85 },
        { type: 'Communications archiving platform', reason: 'Email, chat, and voice archiving for broker-dealer compliance', confidence: 0.88 },
        { type: 'Financial data archival service', reason: 'Long-term storage and retrieval of historical financial data', confidence: 0.78 }
      ]
    },
    'MDT': {
      fullName: 'Mediodorsal Thalamus', label: 'Investment Decision Support', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays information to prefrontal cortex for higher-order decisions.', inBusiness: 'In finance, this is decision support — portfolio analytics, factor models, and scenario analysis that inform investment and allocation decisions.' },
      function: 'Provides analytics and modeling for investment, allocation, and strategic financial decisions',
      dysregulation: 'Analysis paralysis, model-dependent decisions, scenario blindness',
      expectedTypes: [
        { type: 'Portfolio analytics platform', reason: 'Risk attribution, factor exposure, and performance analysis', confidence: 0.92 },
        { type: 'Quantitative research platform', reason: 'Factor models, backtesting, and systematic strategy development', confidence: 0.88 },
        { type: 'Scenario analysis vendor', reason: 'Multi-scenario simulation for investment and risk decisions', confidence: 0.82 }
      ]
    },
    'MGN': {
      fullName: 'Medial Geniculate Nucleus', label: 'Financial Measurement & Accounting', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays auditory information to auditory cortex.', inBusiness: 'In finance, this is precise financial measurement — revenue recognition, fair value measurement, and CECL expected loss calculations.' },
      function: 'Performs precise financial measurements including revenue recognition, fair value, and expected credit losses',
      dysregulation: 'Revenue recognition error, fair value dispute, CECL model inaccuracy',
      expectedTypes: [
        { type: 'CECL model vendor', reason: 'Current expected credit loss modeling and validation', confidence: 0.90 },
        { type: 'Revenue recognition advisory', reason: 'ASC 606 implementation and complex revenue arrangement analysis', confidence: 0.82 },
        { type: 'Fair value measurement service', reason: 'Level 2 and Level 3 asset valuation and model validation', confidence: 0.85 }
      ]
    },
    'MICRO': {
      fullName: 'Microbiome', label: 'Market Microstructure', tier: 'operational',
      neuroTranslation: { inNeurology: 'Gut microbiome affecting neural function through metabolic pathways.', inBusiness: 'In finance, this is market microstructure — the invisible ecosystem of order types, tick sizes, and trading venue rules that determine how prices form.' },
      function: 'Analyzes and designs market microstructure including order types, tick sizes, and venue rules',
      dysregulation: 'Toxic order flow, adverse selection, market fragmentation',
      expectedTypes: [
        { type: 'Market microstructure analytics firm', reason: 'Transaction cost analysis, execution quality, and venue analysis', confidence: 0.88 },
        { type: 'Execution algorithm vendor', reason: 'VWAP, TWAP, and adaptive execution algorithms', confidence: 0.85 },
        { type: 'Exchange technology vendor', reason: 'Matching engine, order book, and market data distribution technology', confidence: 0.82 }
      ]
    },
    'NAcc': {
      fullName: 'Nucleus Accumbens', label: 'Financial Incentive Programs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Core of reward circuit driving motivated behavior.', inBusiness: 'In finance, these are incentive programs — cashback rewards, deposit bonuses, referral fees, and loyalty programs that drive customer acquisition.' },
      function: 'Designs and administers financial reward programs, loyalty schemes, and incentive structures',
      dysregulation: 'Reward program cost overrun, perverse incentive, loyalty program abuse',
      expectedTypes: [
        { type: 'Financial loyalty and rewards platform', reason: 'Credit card rewards, cashback programs, and points management', confidence: 0.90 },
        { type: 'Deposit pricing and bonus platform', reason: 'Promotional rate management and deposit gathering incentives', confidence: 0.82 },
        { type: 'Sales incentive compensation vendor', reason: 'Financial advisor and banker compensation plan management', confidence: 0.78 }
      ]
    },
    'NBM': {
      fullName: 'Nucleus Basalis of Meynert', label: 'Financial Workforce Development', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary source of cortical acetylcholine supporting attention and learning.', inBusiness: 'In finance, this is workforce development — Series licensing, CFA preparation, compliance training, and banker development programs.' },
      function: 'Develops skilled financial workforce through licensing, certification, and continuing education',
      dysregulation: 'Licensing gap, talent shortage, compliance training deficiency',
      expectedTypes: [
        { type: 'Financial licensing exam preparation', reason: 'Series 7, 63, 66, CPA, CFA, and CFP exam training', confidence: 0.88 },
        { type: 'Financial compliance training vendor', reason: 'AML, ethics, suitability, and regulatory CE requirements', confidence: 0.85 },
        { type: 'Financial talent and recruiting firm', reason: 'Banking, asset management, and fintech executive search', confidence: 0.80 }
      ]
    },
    'NEOCER': {
      fullName: 'Neocerebellum', label: 'Financial Quality Assurance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Cognitive functions, planning, and error correction beyond motor coordination.', inBusiness: 'In finance, this is quality assurance — model validation, QC on loan originations, and independent review of financial calculations.' },
      function: 'Validates financial models, reviews loan origination quality, and independently verifies calculations',
      dysregulation: 'Unvalidated model in production, loan defect, calculation error propagation',
      expectedTypes: [
        { type: 'Model validation firm', reason: 'Independent validation of credit, market, and operational risk models', confidence: 0.92 },
        { type: 'Loan quality control service', reason: 'Pre-funding, post-closing, and servicing QC for mortgage and commercial loans', confidence: 0.88 },
        { type: 'Financial data quality vendor', reason: 'Data integrity, reconciliation, and golden source management', confidence: 0.82 }
      ]
    },
    'OLF': {
      fullName: 'Olfactory', label: 'Market Sentiment & Surveys', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes airborne chemical signals.', inBusiness: 'In finance, this is market sentiment — consumer confidence surveys, investor sentiment indices, and fear/greed indicators.' },
      function: 'Measures and distributes market sentiment, consumer confidence, and investor mood indicators',
      dysregulation: 'Sentiment extreme, survey bias, sentiment-fundamental divergence',
      expectedTypes: [
        { type: 'Sentiment analytics platform', reason: 'Social media, news, and options-derived sentiment for markets', confidence: 0.88 },
        { type: 'Consumer confidence survey firm', reason: 'Michigan, Conference Board, and custom financial sentiment surveys', confidence: 0.82 },
        { type: 'Behavioral finance analytics vendor', reason: 'Investor positioning, flow data, and behavioral bias measurement', confidence: 0.78 }
      ]
    },
    'OPIOID': {
      fullName: 'Opioid System', label: 'Financial Bottleneck Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Endogenous pain modulation system.', inBusiness: 'In finance, this is bottleneck resolution — targeted fixes for the most acute operational constraints like settlement backlogs or margin call cascades.' },
      function: 'Resolves acute operational bottlenecks in settlement, margin, and payment processing',
      dysregulation: 'Chronic settlement backlog, persistent margin deficit, payment queue congestion',
      expectedTypes: [
        { type: 'Financial operations turnaround firm', reason: 'Rapid remediation of operational backlogs and processing failures', confidence: 0.85 },
        { type: 'Collateral optimization vendor', reason: 'Cheapest-to-deliver collateral selection and margin efficiency', confidence: 0.82 },
        { type: 'Payment operations consulting', reason: 'Payment processing bottleneck analysis and throughput optimization', confidence: 0.78 }
      ]
    },
    'OSC': {
      fullName: 'Oscillatory', label: 'Market Cycles & Timing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Neural oscillations synchronize activity at specific frequencies.', inBusiness: 'In finance, this is market cycles and timing — business cycles, credit cycles, and seasonal patterns that drive financial markets.' },
      function: 'Analyzes and forecasts market cycles, credit cycles, and seasonal financial patterns',
      dysregulation: 'Cycle timing error, late-cycle overextension, early tightening',
      expectedTypes: [
        { type: 'Business cycle analytics firm', reason: 'Leading indicators, cycle dating, and recession probability models', confidence: 0.85 },
        { type: 'Credit cycle research service', reason: 'Credit conditions, default rate forecasting, and cycle positioning', confidence: 0.82 },
        { type: 'Seasonal trading analytics vendor', reason: 'Calendar effects, sector rotation, and seasonal pattern analysis', confidence: 0.75 }
      ]
    },
    'OXY': {
      fullName: 'Oxytocin', label: 'Financial Partnerships & JVs', tier: 'operational',
      neuroTranslation: { inNeurology: 'Promotes social bonding, trust, and cooperative behavior.', inBusiness: 'In finance, this is partnerships — co-lending arrangements, syndicated loans, and JVs between financial institutions.' },
      function: 'Structures financial partnerships including loan syndications, co-investments, and banking JVs',
      dysregulation: 'Syndication failure, partnership dispute, co-investment misalignment',
      expectedTypes: [
        { type: 'Loan syndication platform', reason: 'Syndicated loan origination, distribution, and settlement', confidence: 0.90 },
        { type: 'Financial partnership advisory', reason: 'JV structuring, co-investment agreements, and alliance strategy', confidence: 0.82 },
        { type: 'Participation lending platform', reason: 'Community bank loan participation and inter-bank lending', confidence: 0.80 }
      ]
    },
    'PBN': {
      fullName: 'Parabrachial Nucleus', label: 'Consumer Financial Experience', tier: 'operational',
      neuroTranslation: { inNeurology: 'Relays visceral sensory information about temperature and comfort.', inBusiness: 'In finance, this is consumer financial experience — the UX of mobile banking, account opening, and day-to-day financial interactions.' },
      function: 'Delivers consumer financial services through intuitive UX, mobile apps, and self-service portals',
      dysregulation: 'Poor mobile UX, high abandonment, customer frustration with financial products',
      expectedTypes: [
        { type: 'Financial UX design firm', reason: 'Mobile banking, account opening, and digital financial experience design', confidence: 0.88 },
        { type: 'Digital account opening platform', reason: 'Frictionless online and mobile account origination', confidence: 0.85 },
        { type: 'Financial wellness platform', reason: 'Budgeting, saving, and financial health tools for consumers', confidence: 0.78 }
      ]
    },
    'PCC': {
      fullName: 'Posterior Cingulate Cortex', label: 'Financial Performance Benchmarking', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-referential processing and internal evaluation.', inBusiness: 'In finance, this is performance benchmarking — comparing fund performance, bank efficiency ratios, and insurance combined ratios against peers.' },
      function: 'Benchmarks financial performance against indices, peer groups, and industry standards',
      dysregulation: 'Benchmark gaming, peer group mismatch, self-serving performance attribution',
      expectedTypes: [
        { type: 'Investment performance measurement firm', reason: 'GIPS compliance, composite construction, and attribution analysis', confidence: 0.88 },
        { type: 'Bank performance benchmarking service', reason: 'Efficiency ratio, ROA, NIM, and peer group comparison', confidence: 0.85 },
        { type: 'Insurance benchmarking platform', reason: 'Combined ratio, loss ratio, and expense ratio benchmarking', confidence: 0.78 }
      ]
    },
    'PI': {
      fullName: 'Posterior Insula', label: 'Financial Loss Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes pain and damage signals.', inBusiness: 'In finance, this is loss detection — identifying loan impairments, trading losses, and insurance claims before they escalate.' },
      function: 'Detects early signs of financial loss including loan impairment, trading loss, and claims deterioration',
      dysregulation: 'Late loss recognition, hidden trading loss, claims leakage',
      expectedTypes: [
        { type: 'Loan watchlist and early warning system', reason: 'Early detection of borrower deterioration and default probability', confidence: 0.90 },
        { type: 'Trading P&L surveillance vendor', reason: 'Real-time P&L monitoring and unauthorized loss detection', confidence: 0.85 },
        { type: 'Insurance claims analytics platform', reason: 'Claims severity prediction, fraud scoring, and leakage detection', confidence: 0.82 }
      ]
    },
    'PIN': {
      fullName: 'Pineal', label: 'Financial Product Lifecycle', tier: 'operational',
      neuroTranslation: { inNeurology: 'Produces melatonin regulating circadian rhythm and seasonal timing.', inBusiness: 'In finance, this is product lifecycle management — determining when to launch, reprice, or retire financial products based on market conditions and profitability.' },
      function: 'Manages financial product lifecycle from launch through repricing to sunset',
      dysregulation: 'Product cannibalization, late retirement of unprofitable products, pricing lag',
      expectedTypes: [
        { type: 'Product pricing analytics firm', reason: 'Deposit pricing, loan pricing, and insurance rate optimization', confidence: 0.88 },
        { type: 'Financial product management platform', reason: 'Product catalog, feature management, and lifecycle tracking', confidence: 0.82 },
        { type: 'Product profitability analytics', reason: 'FTP, cost allocation, and product-level P&L for financial institutions', confidence: 0.85 }
      ]
    },
    'PIT': {
      fullName: 'Pituitary', label: 'Capital Markets Origination', tier: 'operational',
      neuroTranslation: { inNeurology: 'Master gland releasing hormones that trigger downstream cascades.', inBusiness: 'In finance, this is capital markets origination — IPOs, bond issuances, and securitizations that release capital into the economy.' },
      function: 'Originates and distributes securities including IPOs, bond offerings, and securitizations',
      dysregulation: 'IPO failure, bond deal collapse, securitization pipeline freeze',
      expectedTypes: [
        { type: 'Capital markets origination platform', reason: 'IPO and debt issuance origination, bookbuilding, and allocation', confidence: 0.92 },
        { type: 'Securitization advisory firm', reason: 'ABS, MBS, CLO structuring and placement', confidence: 0.88 },
        { type: 'Equity capital markets advisory', reason: 'IPO readiness, valuation, and investor marketing', confidence: 0.85 }
      ]
    },
    'PPN': {
      fullName: 'Pedunculopontine Nucleus', label: 'Financial Product Launch', tier: 'operational',
      neuroTranslation: { inNeurology: 'Initiates locomotion and activates motor programs.', inBusiness: 'In finance, this is product launch — activating new account types, fund vehicles, and financial products for market.' },
      function: 'Launches new financial products including accounts, funds, and insurance products into market',
      dysregulation: 'Product launch failure, regulatory approval delay, market timing miss',
      expectedTypes: [
        { type: 'Financial product launch consultancy', reason: 'New product development, regulatory approval, and go-to-market', confidence: 0.85 },
        { type: 'Fund launch service provider', reason: 'Fund formation, seed capital, and distribution setup for new funds', confidence: 0.88 },
        { type: 'Insurance product development firm', reason: 'New policy form filing, rate development, and actuarial support', confidence: 0.82 }
      ]
    },
    'PRECUNEUS': {
      fullName: 'Precuneus', label: 'Financial Self-Assessment & Maturity', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-awareness, mental imagery, and episodic memory retrieval.', inBusiness: 'In finance, this is organizational self-assessment — CAMELS ratings, maturity models, and capability reviews for financial institutions.' },
      function: 'Evaluates financial institution maturity, capability, and management effectiveness',
      dysregulation: 'No self-assessment, CAMELS downgrade surprise, governance failure',
      expectedTypes: [
        { type: 'Bank management assessment firm', reason: 'CAMELS readiness, management effectiveness, and governance review', confidence: 0.82 },
        { type: 'Financial services maturity assessment', reason: 'Digital maturity, risk maturity, and operational maturity models', confidence: 0.78 },
        { type: 'Board governance advisory', reason: 'Board effectiveness, committee structure, and director education for banks', confidence: 0.75 }
      ]
    },
    'PULV': {
      fullName: 'Pulvinar', label: 'Trading Floor & Operations Center', tier: 'operational',
      neuroTranslation: { inNeurology: 'Largest thalamic nucleus — visual attention and relevant stimulus filtering.', inBusiness: 'In finance, this is the trading floor and operations center — the displays, dashboards, and visualization systems that maintain real-time market visibility.' },
      function: 'Provides trading floor displays, operations dashboards, and real-time market visualization',
      dysregulation: 'Display failure, stale market data on screens, information overload on trading desk',
      expectedTypes: [
        { type: 'Trading floor technology vendor', reason: 'Multi-monitor displays, market data terminals, and turret systems', confidence: 0.88 },
        { type: 'Financial dashboard platform', reason: 'Real-time portfolio, risk, and P&L visualization for trading desks', confidence: 0.85 },
        { type: 'Operations command center integrator', reason: 'NOC and operations center design for financial back-office', confidence: 0.78 }
      ]
    },
    'PUT': {
      fullName: 'Putamen', label: 'Loan Processing & Origination', tier: 'operational',
      neuroTranslation: { inNeurology: 'Executes habitual motor sequences.', inBusiness: 'In finance, this is loan processing — the repetitive workflow of application intake, underwriting, approval, documentation, and funding.' },
      function: 'Processes loan applications through intake, underwriting, documentation, and funding workflows',
      dysregulation: 'Processing backlog, underwriting error, documentation deficiency',
      expectedTypes: [
        { type: 'Loan origination system vendor', reason: 'Mortgage, commercial, and consumer loan origination platforms', confidence: 0.95 },
        { type: 'Mortgage processing outsourcing firm', reason: 'Loan processing, underwriting support, and closing services', confidence: 0.88 },
        { type: 'Automated underwriting engine', reason: 'AI-driven credit decisioning and automated loan approval', confidence: 0.85 }
      ]
    },
    'RAPHE': {
      fullName: 'Raphe Nuclei', label: 'Financial Service Quality', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary serotonin source — modulates mood and regulation.', inBusiness: 'In finance, this is service quality — customer satisfaction, complaint resolution, and the overall quality of financial service delivery.' },
      function: 'Measures and improves financial service quality, complaint resolution, and customer satisfaction',
      dysregulation: 'Declining customer satisfaction, complaint volume spike, service degradation',
      expectedTypes: [
        { type: 'Financial customer experience platform', reason: 'NPS measurement, journey analytics, and experience optimization', confidence: 0.85 },
        { type: 'Complaint management system vendor', reason: 'CFPB complaint tracking, resolution, and root cause analysis', confidence: 0.82 },
        { type: 'Mystery shopping for financial services', reason: 'Branch and call center service quality evaluation', confidence: 0.75 }
      ]
    },
    'RF': {
      fullName: 'Reticular Formation', label: 'Financial Operational Readiness', tier: 'operational',
      neuroTranslation: { inNeurology: 'Maintains wakefulness and arousal.', inBusiness: 'In finance, this is operational readiness — disaster recovery, business continuity, and standby systems for financial operations.' },
      function: 'Maintains disaster recovery, business continuity, and operational readiness for financial institutions',
      dysregulation: 'DR test failure, BCP gap, standby system unavailable during outage',
      expectedTypes: [
        { type: 'Financial business continuity consultancy', reason: 'BIA, BCP, and DR planning for banks, brokers, and insurers', confidence: 0.88 },
        { type: 'DR-as-a-service for financial services', reason: 'Hot site, warm site, and cloud-based DR for regulated institutions', confidence: 0.85 },
        { type: 'Operational resilience platform', reason: 'Important business services mapping and impact tolerance testing', confidence: 0.82 }
      ]
    },
    'RSC': {
      fullName: 'Retrosplenial Cortex', label: 'Financial Wayfinding & Onboarding', tier: 'operational',
      neuroTranslation: { inNeurology: 'Spatial orientation and reference frame transition.', inBusiness: 'In finance, this is client onboarding and wayfinding — guiding customers through account opening, KYC, and product selection.' },
      function: 'Guides customers through financial onboarding, KYC verification, and product selection',
      dysregulation: 'Onboarding abandonment, KYC friction, product selection confusion',
      expectedTypes: [
        { type: 'Digital onboarding platform', reason: 'End-to-end digital account opening with KYC and identity verification', confidence: 0.90 },
        { type: 'KYC orchestration vendor', reason: 'Multi-source identity verification, document collection, and risk scoring', confidence: 0.88 },
        { type: 'Financial product recommendation engine', reason: 'Personalized product matching based on customer needs and profile', confidence: 0.78 }
      ]
    },
    'SC': {
      fullName: 'Superior Colliculus', label: 'Rapid Financial Assessment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Rapid visual orienting and reflexive gaze shifts.', inBusiness: 'In finance, this is rapid assessment — quick credit checks, instant prequalification, and real-time risk screening.' },
      function: 'Performs rapid financial assessments including instant credit checks and real-time risk screening',
      dysregulation: 'Slow prequalification, delayed credit check, screening bottleneck',
      expectedTypes: [
        { type: 'Instant credit decisioning vendor', reason: 'Real-time credit bureau pull, scoring, and prequalification', confidence: 0.92 },
        { type: 'Real-time risk screening platform', reason: 'Instant sanctions, PEP, and adverse media screening', confidence: 0.88 },
        { type: 'Rapid financial health assessment', reason: 'Bank account verification, income verification, and instant affordability', confidence: 0.82 }
      ]
    },
    'SEPT': {
      fullName: 'Septal Nuclei', label: 'Financial Safe Harbors & Protection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Involved in pleasure and suppression of fear responses.', inBusiness: 'In finance, these are safe harbors — FDIC insurance, SIPC protection, and regulatory safe harbor provisions that suppress consumer fear.' },
      function: 'Provides financial safety nets including deposit insurance, investor protection, and regulatory safe harbors',
      dysregulation: 'Insurance limit confusion, SIPC coverage gap, safe harbor misapplication',
      expectedTypes: [
        { type: 'Deposit insurance consulting firm', reason: 'FDIC coverage analysis, pass-through insurance, and trust account structuring', confidence: 0.82 },
        { type: 'Investor protection advisory', reason: 'SIPC coverage, fiduciary duty, and customer protection analysis', confidence: 0.78 },
        { type: 'Financial consumer protection platform', reason: 'Fraud alert, identity theft protection, and account monitoring services', confidence: 0.80 }
      ]
    },
    'SMA': {
      fullName: 'Supplementary Motor Area', label: 'Financial Pre-Trade & Pre-Deal', tier: 'operational',
      neuroTranslation: { inNeurology: 'Plans complex motor sequences before M1 executes them.', inBusiness: 'In finance, this is pre-trade and pre-deal planning — compliance pre-clearance, pre-trade risk checks, and deal structuring before execution.' },
      function: 'Performs pre-trade compliance checks, pre-deal structuring, and execution planning',
      dysregulation: 'Failed pre-trade check, compliance pre-clearance miss, deal structure deficiency',
      expectedTypes: [
        { type: 'Pre-trade compliance platform', reason: 'Real-time pre-trade limit checking, restricted list, and best execution', confidence: 0.90 },
        { type: 'Deal structuring advisory', reason: 'M&A deal structure, tax optimization, and regulatory consideration', confidence: 0.85 },
        { type: 'Trade simulation and testing vendor', reason: 'Pre-trade impact analysis, TCA prediction, and execution simulation', confidence: 0.78 }
      ]
    },
    'SMN': {
      fullName: 'Somatomotor Network', label: 'Financial Field Operations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Integrates sensory input with motor output for coordinated movement.', inBusiness: 'In finance, this is field operations — bank examiners, insurance adjusters, and field auditors who physically visit institutions and sites.' },
      function: 'Coordinates financial field operations including bank examinations, insurance adjustments, and site audits',
      dysregulation: 'Examiner shortage, adjuster backlog, field audit delay',
      expectedTypes: [
        { type: 'Bank examination support service', reason: 'Supplemental examiners and examination support for regulators', confidence: 0.85 },
        { type: 'Insurance claims adjusting firm', reason: 'Field adjusters, desk adjusters, and catastrophe response teams', confidence: 0.88 },
        { type: 'Financial field audit service', reason: 'Dealer floor plan audits, collateral inspections, and site verifications', confidence: 0.82 }
      ]
    },
    'SN': {
      fullName: 'Salience Network', label: 'Financial Priority & Triage', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects salient events and switches attention.', inBusiness: 'In finance, this is priority detection — identifying which market events, client needs, or regulatory actions require immediate resource reallocation.' },
      function: 'Identifies highest-priority financial events and triggers resource reallocation',
      dysregulation: 'Wrong priority, overreaction to minor market move, missed critical client need',
      expectedTypes: [
        { type: 'Financial event management platform', reason: 'Real-time event classification, priority scoring, and workflow routing', confidence: 0.88 },
        { type: 'Client priority management vendor', reason: 'Client segmentation, tier assignment, and service level management', confidence: 0.82 },
        { type: 'Regulatory priority assessment service', reason: 'MRA/MRIA tracking, exam finding remediation, and priority ranking', confidence: 0.80 }
      ]
    },
    'SNIG': {
      fullName: 'Substantia Nigra', label: 'Loan Servicing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Primary dopamine source to striatum — essential for initiating movement.', inBusiness: 'In finance, this is loan servicing — the ongoing collection of payments, escrow management, and investor reporting that fuels the lending cycle.' },
      function: 'Services loans through payment collection, escrow management, and investor reporting',
      dysregulation: 'Servicing error, escrow shortage, investor reporting failure',
      expectedTypes: [
        { type: 'Mortgage servicing platform', reason: 'Payment processing, escrow, and default management for mortgage loans', confidence: 0.92 },
        { type: 'Commercial loan servicing firm', reason: 'Commercial and CRE loan administration and covenant monitoring', confidence: 0.85 },
        { type: 'Student loan servicing platform', reason: 'Federal and private student loan servicing and repayment management', confidence: 0.78 }
      ]
    },
    'SNS': {
      fullName: 'Sympathetic Nervous System', label: 'Rapid Capital Deployment', tier: 'operational',
      neuroTranslation: { inNeurology: 'Fight-or-flight activation.', inBusiness: 'In finance, this is rapid capital deployment — emergency fundraising, bridge loans, and fast-close financing for time-sensitive opportunities.' },
      function: 'Deploys capital rapidly through bridge loans, emergency facilities, and fast-close financing',
      dysregulation: 'Slow capital deployment, missed opportunity window, funding commitment failure',
      expectedTypes: [
        { type: 'Bridge lending firm', reason: 'Short-term bridge loans for acquisitions and real estate', confidence: 0.90 },
        { type: 'Hard money lender', reason: 'Asset-based rapid lending with minimal documentation', confidence: 0.85 },
        { type: 'Emergency capital advisory', reason: 'Rapid fundraising for distressed companies and urgent capital needs', confidence: 0.80 }
      ]
    },
    'STN': {
      fullName: 'Subthalamic Nucleus', label: 'Financial Enforcement', tier: 'operational',
      neuroTranslation: { inNeurology: 'Excitatory brake on inappropriate actions.', inBusiness: 'In finance, this is enforcement — SEC enforcement actions, CFPB consent orders, and FINRA disciplinary proceedings that stop non-compliant financial activity.' },
      function: 'Enforces financial regulations through SEC actions, CFPB orders, and FINRA disciplinary proceedings',
      dysregulation: 'Unenforced violations, regulatory capture, weak enforcement deterrent',
      expectedTypes: [
        { type: 'SEC enforcement defense firm', reason: 'Defense representation in SEC investigations and enforcement actions', confidence: 0.90 },
        { type: 'Regulatory examination preparation', reason: 'OCC, FDIC, and state exam preparation and response', confidence: 0.88 },
        { type: 'FINRA disciplinary defense', reason: 'FINRA enforcement proceedings, arbitration, and expungement', confidence: 0.82 }
      ]
    },
    'STS': {
      fullName: 'Superior Temporal Sulcus', label: 'Client Behavior Analytics', tier: 'operational',
      neuroTranslation: { inNeurology: 'Processes social perception — understanding intentions from behavior.', inBusiness: 'In finance, this is client behavior analytics — understanding how customers use financial products through transaction patterns, channel preferences, and product adoption.' },
      function: 'Analyzes client financial behavior including transaction patterns, channel usage, and product adoption',
      dysregulation: 'Customer churn surprise, product adoption failure, channel migration misread',
      expectedTypes: [
        { type: 'Customer analytics platform for banking', reason: 'Transaction analysis, churn prediction, and cross-sell modeling', confidence: 0.90 },
        { type: 'Wealth client analytics vendor', reason: 'AUM movement prediction, wallet share, and client engagement scoring', confidence: 0.85 },
        { type: 'Insurance policyholder analytics', reason: 'Retention prediction, coverage gap analysis, and upsell modeling', confidence: 0.80 }
      ]
    },
    'TPJ': {
      fullName: 'Temporoparietal Junction', label: 'Financial Stakeholder Relations', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports theory of mind — understanding others\' perspectives.', inBusiness: 'In finance, this is stakeholder relations — understanding diverse needs of shareholders, regulators, customers, and communities in financial decisions.' },
      function: 'Incorporates diverse stakeholder perspectives into financial institution strategy and governance',
      dysregulation: 'Ignored community needs, shareholder activism surprise, regulatory relationship breakdown',
      expectedTypes: [
        { type: 'Financial investor relations firm', reason: 'Shareholder engagement, proxy advisory, and earnings communication', confidence: 0.88 },
        { type: 'CRA compliance advisory', reason: 'Community Reinvestment Act compliance, assessment area analysis, and strategic plan', confidence: 0.85 },
        { type: 'Financial public affairs firm', reason: 'Community relations, financial inclusion advocacy, and public perception', confidence: 0.78 }
      ]
    },
    'TPOLE': {
      fullName: 'Temporal Pole', label: 'Financial Heritage & Brand', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports semantic memory and social-emotional associations.', inBusiness: 'In finance, this is heritage and brand — the centuries-old banking brands, institutional reputation, and trust capital built over generations.' },
      function: 'Preserves and leverages institutional brand equity, trust, and reputation in financial markets',
      dysregulation: 'Brand erosion, trust destruction from scandal, reputation crisis',
      expectedTypes: [
        { type: 'Financial brand strategy firm', reason: 'Bank and insurer brand positioning, naming, and brand architecture', confidence: 0.82 },
        { type: 'Financial reputation management', reason: 'Crisis communications, media relations, and digital reputation for financial firms', confidence: 0.85 },
        { type: 'Trust and fiduciary services', reason: 'Personal trust, estate administration, and fiduciary management', confidence: 0.80 }
      ]
    },
    'TrkB': {
      fullName: 'TrkB Receptor', label: 'Financial Innovation Adoption', tier: 'operational',
      neuroTranslation: { inNeurology: 'BDNF receptor enabling neuroplasticity when activated.', inBusiness: 'In finance, this is innovation adoption — the willingness of financial institutions to adopt blockchain, AI, open banking, and new financial technologies.' },
      function: 'Evaluates and adopts emerging financial technologies including AI, blockchain, and open banking',
      dysregulation: 'Innovation resistance, failed pilot programs, technology paralysis',
      expectedTypes: [
        { type: 'Financial innovation lab', reason: 'Fintech scouting, proof-of-concept, and innovation strategy', confidence: 0.85 },
        { type: 'Regulatory sandbox advisory', reason: 'Navigating regulatory sandboxes for financial innovation testing', confidence: 0.78 },
        { type: 'Financial technology accelerator', reason: 'Bank-fintech partnership programs and innovation incubation', confidence: 0.75 }
      ]
    },
    'UNC': {
      fullName: 'Uncinate Fasciculus', label: 'Cross-Border Finance', tier: 'operational',
      neuroTranslation: { inNeurology: 'Connects frontal and temporal lobes across the Sylvian fissure.', inBusiness: 'In finance, this is cross-border finance — international capital flows, FX transactions, and multi-jurisdictional regulatory compliance.' },
      function: 'Facilitates cross-border capital flows, FX transactions, and multi-jurisdictional compliance',
      dysregulation: 'FX settlement failure, cross-border regulatory conflict, capital flow restriction',
      expectedTypes: [
        { type: 'International banking advisory', reason: 'Cross-border banking, multi-jurisdiction compliance, and FX management', confidence: 0.88 },
        { type: 'FX trading platform', reason: 'Spot, forward, and options FX execution for institutional clients', confidence: 0.85 },
        { type: 'Global tax compliance firm', reason: 'FATCA, CRS, and withholding tax compliance for cross-border finance', confidence: 0.82 }
      ]
    },
    'V1': {
      fullName: 'Primary Visual Cortex', label: 'Financial Data Visualization', tier: 'operational',
      neuroTranslation: { inNeurology: 'First cortical stage of visual processing.', inBusiness: 'In finance, this is data visualization — charts, dashboards, and visual tools that present financial data in comprehensible form.' },
      function: 'Transforms raw financial data into visual charts, dashboards, and interactive analytics',
      dysregulation: 'Misleading charts, dashboard overload, visualization without insight',
      expectedTypes: [
        { type: 'Financial data visualization platform', reason: 'Interactive charts, dashboards, and visual analytics for financial data', confidence: 0.90 },
        { type: 'Bloomberg terminal alternative', reason: 'Professional-grade financial data display and analysis workstation', confidence: 0.85 },
        { type: 'Regulatory reporting visualization', reason: 'Visual dashboards for regulatory metrics, capital ratios, and compliance KPIs', confidence: 0.78 }
      ]
    },
    'VAN': {
      fullName: 'Ventral Attention Network', label: 'Financial Black Swan Detection', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects unexpected salient stimuli — bottom-up surprise detection.', inBusiness: 'In finance, this is black swan detection — identifying unexpected market crashes, flash events, and unforeseen risks not captured by standard models.' },
      function: 'Detects unexpected financial events, tail risks, and emerging threats not predicted by standard models',
      dysregulation: 'Missed tail event, complacent risk models, undetected emerging risk',
      expectedTypes: [
        { type: 'Tail risk analytics firm', reason: 'Extreme event modeling, fat-tail distribution analysis, and stress testing', confidence: 0.88 },
        { type: 'Geopolitical risk intelligence', reason: 'Geopolitical event impact on financial markets and portfolio exposure', confidence: 0.85 },
        { type: 'Financial anomaly detection platform', reason: 'ML-based detection of unusual patterns in financial data streams', confidence: 0.82 }
      ]
    },
    'VERM': {
      fullName: 'Vermis', label: 'Financial Balance & Equilibrium', tier: 'operational',
      neuroTranslation: { inNeurology: 'Midline cerebellum for postural balance and equilibrium.', inBusiness: 'In finance, this is balance sheet management — maintaining equilibrium between assets and liabilities, duration matching, and ALM.' },
      function: 'Maintains balance sheet equilibrium through asset-liability management and duration matching',
      dysregulation: 'Duration mismatch, ALM gap, unhedged interest rate exposure',
      expectedTypes: [
        { type: 'Asset-liability management platform', reason: 'ALM modeling, NII simulation, and EVE analysis for banks and insurers', confidence: 0.92 },
        { type: 'Balance sheet optimization firm', reason: 'Capital efficiency, RWA optimization, and balance sheet restructuring', confidence: 0.88 },
        { type: 'Liability-driven investment advisor', reason: 'Pension and insurance LDI strategy and implementation', confidence: 0.82 }
      ]
    },
    'VEST': {
      fullName: 'Vestibular', label: 'Portfolio Rebalancing', tier: 'operational',
      neuroTranslation: { inNeurology: 'Detects head position and movement for balance.', inBusiness: 'In finance, this is portfolio rebalancing — detecting drift from target allocation and executing trades to restore portfolio balance.' },
      function: 'Detects portfolio drift and executes rebalancing trades to maintain target allocations',
      dysregulation: 'Excessive drift, rebalancing delay, tax-inefficient rebalancing',
      expectedTypes: [
        { type: 'Portfolio rebalancing platform', reason: 'Automated rebalancing, tax-loss harvesting, and model portfolio management', confidence: 0.90 },
        { type: 'Robo-advisor platform', reason: 'Automated investment management with algorithmic rebalancing', confidence: 0.88 },
        { type: 'Tax-aware trading vendor', reason: 'Tax-lot management, wash sale avoidance, and transition management', confidence: 0.82 }
      ]
    },
    'VP': {
      fullName: 'Ventral Pallidum', label: 'Financial Resilience', tier: 'operational',
      neuroTranslation: { inNeurology: 'Reward circuitry involved in motivational drive.', inBusiness: 'In finance, this is institutional resilience — capital buffers, liquidity reserves, and recovery planning that maintain financial stability under stress.' },
      function: 'Strengthens institutional resilience through capital buffers, liquidity reserves, and recovery planning',
      dysregulation: 'Insufficient capital buffer, liquidity reserve depletion, recovery plan untested',
      expectedTypes: [
        { type: 'Capital planning advisory', reason: 'CCAR, ICAAP, and capital adequacy planning for banks', confidence: 0.88 },
        { type: 'Liquidity risk management vendor', reason: 'LCR, NSFR, and intraday liquidity monitoring and forecasting', confidence: 0.85 },
        { type: 'Recovery and resolution planning firm', reason: 'Living will preparation, recovery triggers, and resolution strategies', confidence: 0.82 }
      ]
    },
    'VV': {
      fullName: 'Ventral Vagal', label: 'Community Banking & Financial Inclusion', tier: 'operational',
      neuroTranslation: { inNeurology: 'Supports social engagement and safe connection.', inBusiness: 'In finance, this is community banking and financial inclusion — CDFIs, community banks, and programs connecting underbanked populations to financial services.' },
      function: 'Provides community banking, CDFI lending, and financial inclusion programs for underserved populations',
      dysregulation: 'Community bank closure, CDFI funding gap, financial desert expansion',
      expectedTypes: [
        { type: 'Community development financial institution', reason: 'CDFI lending, technical assistance, and community investment', confidence: 0.90 },
        { type: 'Financial inclusion platform', reason: 'Underbanked account access, microloans, and financial literacy tools', confidence: 0.85 },
        { type: 'Community bank technology consortium', reason: 'Shared technology, compliance, and product development for small banks', confidence: 0.78 }
      ]
    },
    'WERN': {
      fullName: 'Wernicke\'s Area', label: 'Financial Data Interpretation', tier: 'operational',
      neuroTranslation: { inNeurology: 'Comprehends spoken and written language — extracts meaning from input.', inBusiness: 'In finance, this is data interpretation — making sense of market data, economic indicators, and financial statements into actionable investment intelligence.' },
      function: 'Interprets financial data, market signals, and economic indicators into actionable intelligence',
      dysregulation: 'Misinterpreted economic data, unused analytics, information overload',
      expectedTypes: [
        { type: 'Investment research platform', reason: 'Fundamental, technical, and quantitative research for investment professionals', confidence: 0.90 },
        { type: 'Economic research and forecasting firm', reason: 'GDP, employment, and inflation forecasting for financial institutions', confidence: 0.85 },
        { type: 'Financial business intelligence vendor', reason: 'Executive dashboards, KPI tracking, and management reporting for banks', confidence: 0.80 }
      ]
    },
    'mPFC': {
      fullName: 'Medial Prefrontal Cortex', label: 'Financial Strategy', tier: 'operational',
      neuroTranslation: { inNeurology: 'Self-referential processing and value-based decision-making.', inBusiness: 'In finance, this is high-level strategy — corporate strategy for banks, insurance company M&A, and fintech competitive positioning.' },
      function: 'Sets corporate strategy, M&A direction, and competitive positioning for financial institutions',
      dysregulation: 'Strategy drift, failed acquisition, competitive positioning error',
      expectedTypes: [
        { type: 'Financial services strategy consultancy', reason: 'Corporate strategy, M&A advisory, and competitive analysis for banks and insurers', confidence: 0.92 },
        { type: 'Fintech strategy advisory', reason: 'Build vs buy, partnership strategy, and digital transformation roadmap', confidence: 0.85 },
        { type: 'Insurance strategy firm', reason: 'Line of business strategy, distribution optimization, and underwriting strategy', confidence: 0.80 }
      ]
    },
    'rACC': {
      fullName: 'Rostral Anterior Cingulate Cortex', label: 'Financial Dispute Resolution', tier: 'operational',
      neuroTranslation: { inNeurology: 'Regulates emotional responses to conflict.', inBusiness: 'In finance, this is dispute resolution — FINRA arbitration, insurance claim disputes, and banking complaint mediation.' },
      function: 'Resolves financial disputes through arbitration, mediation, and regulatory complaint processes',
      dysregulation: 'Protracted arbitration, unresolved customer complaint, regulatory consent order',
      expectedTypes: [
        { type: 'FINRA arbitration and mediation firm', reason: 'Securities arbitration, customer dispute resolution, and expungement', confidence: 0.88 },
        { type: 'Insurance dispute resolution service', reason: 'Claims dispute mediation, appraisal, and bad faith litigation', confidence: 0.85 },
        { type: 'Banking ombudsman and complaint service', reason: 'OCC and CFPB complaint response and resolution management', confidence: 0.78 }
      ]
    },
    'vlPFC': {
      fullName: 'Ventrolateral Prefrontal Cortex', label: 'Financial Contract Management', tier: 'operational',
      neuroTranslation: { inNeurology: 'Response inhibition and rule-based decision-making.', inBusiness: 'In finance, this is contract management — enforcing ISDA master agreements, loan covenants, and insurance policy terms.' },
      function: 'Manages financial contracts including ISDA agreements, loan documents, and insurance policies',
      dysregulation: 'Contract breach, covenant violation undetected, ISDA close-out dispute',
      expectedTypes: [
        { type: 'Financial contract management platform', reason: 'ISDA, CSA, loan agreement, and insurance policy lifecycle management', confidence: 0.90 },
        { type: 'Legal documentation automation for finance', reason: 'Automated generation of financial agreements, amendments, and confirmations', confidence: 0.85 },
        { type: 'Covenant compliance monitoring vendor', reason: 'Real-time loan covenant testing and breach notification', confidence: 0.82 }
      ]
    }
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
    var brain = brains.get('finance');
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

  function getFinanceState() {
    var brains = window.LIMENDomainBrains;
    if (!brains) return null;
    var brain = brains.get('finance');
    return brain ? brain.getState() : null;
  }

  function runInference(hierarchyData) {
    var state = getFinanceState();
    if (!state) return { mapped: [], missing: [], speculative: [], error: 'No brain state available' };

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var approvals = loadApprovals();

    var nodeCompanyIndex = {};
    if (hierarchyData && hierarchyData.nodeCompanies) {
      nodeCompanyIndex = hierarchyData.nodeCompanies;
    } else {
      var brains = window.LIMENDomainBrains;
      var brain = brains ? brains.get('finance') : null;
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
          if (expected.confidence >= 0.85) consequence = 'If approved: this business type becomes eligible for opportunity generation and operator queue inclusion for Finance tied to ' + dir.label + '.';
          else if (expected.confidence >= 0.75) consequence = 'If approved: eligible for future portal path mapping and audit tracking within Finance.';
          else consequence = 'If approved: recorded as valid Finance mapping for audit tracking. Requires further validation.';
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

  window.LIMENFinanceBusinessEngine = {
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
    console.log('[FinanceBusinessEngine] Hierarchy loaded');
  });

  console.log('[FinanceBusinessEngine] Loaded \u2014 103-node full-hierarchy finance business assignment engine');

})();
