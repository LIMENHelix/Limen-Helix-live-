/**
 * cross-domain-detector.js
 * LIMEN HELIX — Cross-Domain Pattern Detector
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Detects correlated stress patterns across domains using live feed data.
 * Requires 2 consecutive ticks above threshold to trigger.
 * Factors in stress value, trend direction, freshness, and source confidence.
 *
 * Depends on: window.LIMENDomains, window.LIMENSourceAudit
 * Listens: limen:domain-update
 * Emits: limen:cross-domain-signal, limen:opportunity-detected
 *
 * Renders: compact SYSTEMIC SIGNALS panel (top 3 active patterns)
 *
 * Load order: after domain-signal-engine.js
 */

(function () {
  'use strict';

  // ─── Pattern definitions ─────────────────────────────────────────────────

  var PATTERNS = [
    {
      id: 'energy_supply',
      domains: ['energy', 'supplyChain'],
      threshold: 0.45,
      pattern: 'logistics disruption',
      drivers: ['oil price pressure', 'freight cost elevation', 'fuel supply stress'],
      options: [
        { label: 'trace supply chain exposure', type: 'analysis' },
        { label: 'investigate energy drivers', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'economy_liquidity',
      domains: ['economy', 'supplyChain'],
      threshold: 0.50,
      pattern: 'financial tightening',
      drivers: ['employment contraction', 'logistics cost pressure', 'demand-supply imbalance'],
      options: [
        { label: 'analyze liquidity indicators', type: 'analysis' },
        { label: 'monitor credit conditions', type: 'monitoring' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'health_research',
      domains: ['health', 'research'],
      threshold: 0.40,
      pattern: 'medical innovation cluster',
      drivers: ['adverse event reporting surge', 'publication rate acceleration', 'clinical activity spike', 'biotech-breakthrough pipeline delay / gene-therapy / CAR-T development latency (ABBV/GILD/TMO advanced-therapy manufacturing)', 'drug-discovery success-rate decline / clinical-validation cycle elongation (Phase-II-to-Phase-III transition delay, FDA breakthrough-designation backlog)', 'real-world-evidence generation lag / post-market surveillance data scarcity (EHR-derived outcomes tracking, pharmacovigilance data quality)', 'orphan-disease research-funding scarcity / rare-indication development disincentive (NIH NCATS rare-disease grants, development-cost recovery challenges)'],
      options: [
        { label: 'explore emerging treatments', type: 'discovery' },
        { label: 'trace research-clinical pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'environment_energy',
      domains: ['environment', 'energy'],
      threshold: 0.45,
      pattern: 'climate-resource pressure',
      drivers: ['weather disruption', 'energy demand volatility', 'infrastructure strain'],
      options: [
        { label: 'map climate-energy exposure', type: 'analysis' },
        { label: 'investigate renewable transition', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'tech_research',
      domains: ['technology', 'research'],
      threshold: 0.35,
      pattern: 'innovation acceleration',
      drivers: ['patent activity surge', 'research volume spike', 'disruption cycle signal'],
      options: [
        { label: 'explore technology frontiers', type: 'discovery' },
        { label: 'trace research-to-market pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'economy_health',
      domains: ['economy', 'health'],
      threshold: 0.55,
      pattern: 'economic-health stress',
      drivers: ['labor market pressure', 'healthcare system load', 'public health expenditure stress'],
      options: [
        { label: 'investigate health-economy linkage', type: 'analysis' },
        { label: 'monitor workforce health indicators', type: 'monitoring' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Patterns from civilization connectome (new 13 domains) ────────
    {
      id: 'governance_economy',
      domains: ['governance', 'economy'],
      threshold: 0.45,
      pattern: 'policy-market feedback',
      drivers: ['regulatory intervention', 'fiscal policy shift', 'institutional instability'],
      options: [
        { label: 'trace governance-market linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_energy',
      domains: ['infrastructure', 'energy'],
      threshold: 0.45,
      pattern: 'infrastructure-energy dependency',
      drivers: ['grid strain', 'utility capacity pressure', 'transport-energy coupling'],
      options: [
        { label: 'map infrastructure-energy exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_environment',
      domains: ['infrastructure', 'environment'],
      threshold: 0.45,
      pattern: 'infrastructure-environment coupling',
      drivers: ['water main failure', 'treatment plant capacity', 'flood mitigation deficit', 'climate adaptation barrier', 'stormwater overflow'],
      options: [
        { label: 'map infrastructure-environment exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_governance',
      domains: ['infrastructure', 'governance'],
      threshold: 0.50,
      pattern: 'infrastructure-governance stress',
      drivers: ['permitting delay', 'regulatory constraint', 'funding gap', 'deferred maintenance mandate', 'zoning conflict'],
      options: [
        { label: 'trace infrastructure-governance linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_law',
      domains: ['infrastructure', 'law'],
      threshold: 0.45,
      pattern: 'infrastructure-legal coupling',
      drivers: ['liability exposure', 'compliance violation', 'contract dispute', 'enforcement action', 'bond covenant breach'],
      options: [
        { label: 'trace infrastructure-law linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_economy',
      domains: ['infrastructure', 'economy'],
      threshold: 0.50,
      pattern: 'infrastructure-economic transmission',
      drivers: ['construction employment decline', 'material cost pressure', 'capital unavailable', 'deferred maintenance cost shadow', 'project cancellation'],
      options: [
        { label: 'trace infrastructure-economy linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_agriculture',
      domains: ['infrastructure', 'agriculture'],
      threshold: 0.45,
      pattern: 'infrastructure-agriculture coupling',
      drivers: ['irrigation capacity decline', 'drainage system failure', 'rural road deterioration', 'storage capacity shortage', 'transport access loss'],
      options: [
        { label: 'map infrastructure-agriculture exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_research',
      domains: ['infrastructure', 'research'],
      threshold: 0.40,
      pattern: 'infrastructure innovation cluster',
      drivers: ['research funding pressure', 'aging-asset data scarcity', 'resilience solution gap', 'sensor-tech adoption lag', 'infrastructure modeling lag', 'materials-science research (concrete-durability / recycled-steel / composite-alternative R&D for bridges, materials-innovation adoption lag, CAT/DE/EMR materials dependency)', 'structural-health-monitoring R&D (sensor-network / digital-twin development for infrastructure, monitoring-tech research funding)', 'resilience-engineering research (flood-modeling / seismic-design innovation, resilience-design-standard development velocity)', 'water-treatment & wastewater-system research (treatment-process innovation, contaminant-removal materials R&D)'],
      options: [
        { label: 'trace infrastructure-research pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'infrastructure_education',
      domains: ['infrastructure', 'education'],
      threshold: 0.45,
      pattern: 'infrastructure workforce pipeline stress',
      drivers: ['engineer shortage', 'technician training gap', 'skill mismatch', 'curriculum lag', 'apprenticeship enrollment decline'],
      options: [
        { label: 'trace infrastructure-education pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'agriculture_population',
      domains: ['agriculture', 'population'],
      threshold: 0.45,
      pattern: 'food-population pressure',
      drivers: ['crop yield decline', 'population growth', 'food distribution stress'],
      options: [
        { label: 'analyze food security indicators', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'industry_economy',
      domains: ['industry', 'economy'],
      threshold: 0.50,
      pattern: 'industrial-economic contraction',
      drivers: ['manufacturing decline', 'demand erosion', 'employment contraction'],
      options: [
        { label: 'trace industrial output drivers', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'finance_economy',
      domains: ['finance', 'economy'],
      threshold: 0.50,
      pattern: 'financial-economic coupling',
      drivers: ['credit tightening', 'market volatility', 'capital flow disruption'],
      options: [
        { label: 'investigate financial contagion', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'defense_intelligence',
      domains: ['defense', 'intelligence'],
      threshold: 0.40,
      pattern: 'security-intelligence escalation',
      drivers: ['threat level elevation', 'information warfare signals', 'surveillance spike'],
      options: [
        { label: 'assess strategic posture', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'law_governance',
      domains: ['law', 'governance'],
      threshold: 0.45,
      pattern: 'regulatory-governance stress',
      drivers: ['compliance burden', 'legislative instability', 'enforcement pressure'],
      options: [
        { label: 'trace regulatory impact chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'communication_culture',
      domains: ['communication', 'culture'],
      threshold: 0.40,
      pattern: 'media-cultural fragmentation',
      drivers: ['narrative divergence', 'misinformation pressure', 'social cohesion strain'],
      options: [
        { label: 'analyze information ecosystem', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'education_research',
      domains: ['education', 'research'],
      threshold: 0.35,
      pattern: 'knowledge pipeline stress',
      drivers: ['funding pressure', 'enrollment shifts', 'research output variance'],
      options: [
        { label: 'trace education-research pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (affiliation, congregations, belief-system vitality); population
      // is the COUPLING — affiliation demographics & generational transition. Indicator-based
      // (Pew Religious Landscape Study, ARDA, Gallup, PRRI affiliation & "nones" trend data).
      id: 'religion_population',
      domains: ['religion', 'population'],
      threshold: 0.40,
      pattern: 'demographic-moral tension',
      drivers: ['religious-affiliation decline & "nones" rise (Pew Religious Landscape Study, PRRI affiliation-trend series, generational disaffiliation)', 'congregation membership & attendance contraction (Gallup church-attendance series, ARDA congregation-census decline)', 'generational belief-transmission gap (Pew youth-vs-elder affiliation divergence, faith-retention drop across cohorts)', 'demographic transition vs faith-community composition (immigration-driven religious-pluralism shift, aging-congregation succession risk)', 'institutional trust erosion (declining confidence in religious institutions, Gallup institution-trust series)'],
      options: [
        { label: 'investigate social cohesion & affiliation trend', type: 'analysis' },
        { label: 'trace congregation demographic resilience', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'supplyChain_agriculture',
      domains: ['supplyChain', 'agriculture'],
      threshold: 0.45,
      pattern: 'food logistics disruption',
      drivers: ['freight cost spike', 'cold chain stress', 'distribution bottleneck'],
      options: [
        { label: 'map food supply chain exposure', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'intelligence_governance',
      domains: ['intelligence', 'governance'],
      threshold: 0.40,
      pattern: 'intelligence-governance loop',
      drivers: ['data integrity pressure', 'policy information gap', 'surveillance-state tension'],
      options: [
        { label: 'assess information-policy coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'finance_law',
      domains: ['finance', 'law'],
      threshold: 0.45,
      pattern: 'financial-regulatory coupling',
      drivers: ['compliance cost escalation', 'enforcement activity surge', 'market regulation pressure'],
      options: [
        { label: 'trace financial regulatory impact', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Culture pairs (parity port; mirrors energy/infrastructure structure) ──
    {
      id: 'culture_research',
      domains: ['culture', 'research'],
      threshold: 0.35,
      pattern: 'creative innovation acceleration',
      drivers: ['production-tool breakthrough', 'sonic innovation spike', 'critical-discourse surge', 'taste-making acceleration', 'scene-maturation lag'],
      options: [
        { label: 'explore emerging genres & creators', type: 'discovery' },
        { label: 'trace research-to-creation pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_technology',
      domains: ['culture', 'technology'],
      threshold: 0.45,
      pattern: 'creative-technology dependency',
      drivers: ['distribution-platform strain', 'streaming codec failure', 'production hardware shortage', 'venue-tech capacity loss', 'new-tool adoption surge'],
      options: [
        { label: 'map creative-technology exposure', type: 'analysis' },
        { label: 'investigate virality acceleration', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_finance',
      domains: ['culture', 'finance'],
      threshold: 0.50,
      pattern: 'creative-economy capital coupling',
      drivers: ['arts funding contraction', 'patronage collapse', 'crowdfunding platform stress', 'creative-institution failure', 'capital flow disruption'],
      options: [
        { label: 'investigate creative-finance feedback', type: 'analysis' },
        { label: 'trace scene-expansion capital', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_population',
      domains: ['culture', 'population'],
      threshold: 0.45,
      pattern: 'cultural-participation shift',
      drivers: ['fanbase composition shift', 'generational taste change', 'participation decay', 'heritage loss', 'audience youth bulge'],
      options: [
        { label: 'analyze audience & fanbase indicators', type: 'analysis' },
        { label: 'investigate participation surge', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_governance',
      domains: ['culture', 'governance'],
      threshold: 0.50,
      pattern: 'culture-governance stress',
      drivers: ['arts funding cuts', 'censorship pressure', 'creative-freedom policy shift', 'permit/venue denial', 'institutional legitimacy erosion'],
      options: [
        { label: 'trace culture-governance linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_education',
      domains: ['culture', 'education'],
      threshold: 0.45,
      pattern: 'creative-literacy pipeline stress',
      drivers: ['artist-training gap', 'music-education deficit', 'taste-formation decline', 'media literacy erosion', 'norm-transmission failure'],
      options: [
        { label: 'trace culture-education pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      id: 'culture_economy',
      domains: ['culture', 'economy'],
      threshold: 0.50,
      pattern: 'creative-economy transmission',
      drivers: ['venue employment collapse', 'artist revenue decline', 'streaming-royalty pressure', 'sponsorship erosion', 'label/venue closure spike'],
      options: [
        { label: 'trace culture-economy linkage', type: 'analysis' },
        { label: 'investigate creator income growth', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the COUPLING here (faith/belief/worship); culture identity stays secular
      // content/scenes/movements. Religion-side signals are indicator-based (Pew religion-and-
      // public-life, PRRI cultural-values data, ARDA tradition participation).
      id: 'culture_religion',
      domains: ['culture', 'religion'],
      threshold: 0.40,
      pattern: 'cultural-moral identity tension',
      drivers: ['secular-vs-sacred value conflict (Pew religion-and-public-life tension data, PRRI cultural-values polarization)', 'ritual & tradition participation decay (ARDA observance-rate decline, waning religious-holiday cultural salience)', 'religious-vs-cultural identity fracture (faith-identity erosion amid secularizing culture, hybrid-identity strain)', 'sacred-music & liturgical-arts participation decay (declining choral / sacred-music engagement, worship-arts attrition)', 'moral-coherence strain (interfaith / secular value-framework contestation, shared-norm erosion)'],
      options: [
        { label: 'investigate culture-religion feedback', type: 'analysis' },
        { label: 'trace sacred-vs-secular participation shift', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Finance pairs (parity port; mirrors energy/infrastructure/culture structure) ──
    // Financial identity only: capital markets, credit & lending, banking, liquidity
    // & solvency, investment & funding, M&A, payments & fintech, corporate distress,
    // systemic financial risk. Real tickers (JPM, BAC, GS, MS, BLK, V, MA, SCHW, C,
    // WFC, KKR, BX). ADDITIVE — does not touch any validated scoring path.
    {
      // Mirrors 'energy_supply' (capital access stress) + 'infrastructure_economy'
      // (capital unavailable, deferred-maintenance cost shadow) translated to banking.
      id: 'finance_infrastructure',
      domains: ['finance', 'infrastructure'],
      threshold: 0.45,
      pattern: 'infrastructure-capital transmission',
      drivers: ['capital unavailable', 'municipal bond spread widening (JPM/BAC/WFC credit exposure)', 'deferred-maintenance funding gap', 'bond covenant breach', 'local-government credit rating downgrade'],
      options: [
        { label: 'trace infrastructure-capital exposure', type: 'analysis' },
        { label: 'investigate liquidity stress coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Direct parity to 'energy_supply' → logistics disruption; extends 'finance_economy'.
      id: 'finance_supplyChain',
      domains: ['finance', 'supplyChain'],
      threshold: 0.45,
      pattern: 'credit-logistics transmission',
      drivers: ['liquidity crunch (TED spread / LIBOR-OIS widening)', 'commercial paper stress', 'trade-finance disruption (letter-of-credit delays)', 'working-capital loans unavailable', 'fintech payment processing stress (V/MA/SCHW)', 'LBO refinancing risk (KKR/BX)'],
      options: [
        { label: 'trace credit-supply chain exposure', type: 'analysis' },
        { label: 'monitor liquidity & trade-finance conditions', type: 'monitoring' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Triple-domain: mirrors 'infrastructure_core' (capital ↔ governance/finance)
      // + parallels 'culture_education' (pipeline) and 'culture_economy' (venue/income).
      id: 'culture_finance_infrastructure',
      domains: ['culture', 'finance', 'infrastructure'],
      threshold: 0.48,
      pattern: 'creator-capital venue coupling',
      drivers: ['creator-capital funding gap', 'IP securitization stress (franchise/copyright collateral)', 'cultural-institution bond pricing pressure (theaters/halls/museums)', 'venue-operator franchise economics strain', 'venue permitting/maintenance/resilience deficit', 'artist-development fund liquidity contraction'],
      options: [
        { label: 'trace creator-capital-venue exposure', type: 'analysis' },
        { label: 'investigate scene-expansion capital access', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_intelligence' (escalation) + extends 'intelligence_governance'
      // (policy info gap) to supervisory/regulatory gaps — financial-stability intelligence.
      id: 'finance_defense',
      domains: ['finance', 'defense'],
      threshold: 0.42,
      pattern: 'systemic financial-stability intelligence coupling',
      drivers: ['credit-default cascade risk (JPM/BAC/GS/MS stress)', 'counterparty concentration spike', 'bank-run / deposit-flight signals', 'Fed stress-test elevation', 'regulatory-capture / enforcement-action delay signals', 'information asymmetry in supervision'],
      options: [
        { label: 'assess systemic financial-instability posture', type: 'analysis' },
        { label: 'trace counterparty-risk transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Parity to 'culture_technology' (distribution-platform strain, codec failure,
      // hardware shortage) applied to fintech infrastructure; mirrors cyber-cluster logic.
      // EXPANDED (technology-parity port): adds the deeper finance-tech surface —
      // core-banking patch cycles, trade-execution latency, stress-test compute,
      // settlement custody, FIX-protocol compliance. Technology identity stays
      // chips/software/cloud (the coupling); finance identity stays capital/payments.
      id: 'finance_technology',
      domains: ['finance', 'technology'],
      threshold: 0.45,
      pattern: 'fintech-technology coupling',
      drivers: ['payment processing outage (V/MA downtime, ACH delays)', 'crypto exchange/wallet hack & settlement failure', 'algorithmic-trading system failure', 'cloud-banking infrastructure outage (AWS/Azure payment dependencies)', 'core-banking platform reliability stress', 'core-banking software patch cycle lag (ORCL/CRM platform versioning)', 'algorithmic-trading latency degradation (datacenter/fiber-path constraint)', 'stress-test compute capacity constraint (NVDA/AMD GPU availability for credit-default modeling)', 'blockchain-settlement custody lag', 'FIX-protocol upgrade compliance gap (trade-execution standard divergence)'],
      options: [
        { label: 'map fintech-technology exposure', type: 'analysis' },
        { label: 'investigate payment-system disruption', type: 'analysis' },
        { label: 'investigate trade-execution latency coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Economy pairs (parity port; mirrors energy/infrastructure/culture/finance structure) ──
    // MACRO AGGREGATE identity ONLY — distinct from finance (capital markets/credit/banks).
    // Binds to broad macro indicators: GDP & growth, inflation (CPI/PCE), employment &
    // labor markets, consumer & business sentiment, fiscal & monetary policy (central
    // banks, rates), the recession/expansion business cycle, productivity, money supply.
    // Real FRED series ids (GDP, GDPC1, CPIAUCSL, PCEPI, UNRATE, PAYEMS, FEDFUNDS, DGS10,
    // UMCSENT, INDPRO) + broad-market proxies (SPY, DIA, TLT, GLD) — never single-company
    // tickers, never fabricated. ADDITIVE — does not touch any validated scoring path.
    {
      // Mirrors 'infrastructure_research' (innovation-cluster structure) translated to
      // macro-econometric research/data-infrastructure pipelines.
      id: 'economy_research',
      domains: ['economy', 'research'],
      threshold: 0.45,
      pattern: 'macro-research infrastructure stress',
      drivers: ['research funding contraction', 'economic forecast model lag', 'statistical infrastructure underinvestment'],
      options: [
        { label: 'trace economy-research pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Parity to 'culture_technology' / 'finance_technology' (platform-dependency,
      // payment-processing stress) applied to the macro labor/demand transmission layer.
      id: 'economy_technology',
      domains: ['economy', 'technology'],
      threshold: 0.50,
      pattern: 'macro-technology transmission',
      drivers: ['automation-driven employment displacement (PAYEMS/UNRATE shift)', 'fintech payment-processing capacity stress', 'high-frequency-trading systemic transmission', 'digital-infrastructure downtime affecting demand measurement'],
      options: [
        { label: 'map economy-technology exposure', type: 'analysis' },
        { label: 'investigate automation labor-market impact', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'supplyChain_agriculture' / 'agriculture_population' translated to the
      // macro CPI / real-wage / aggregate-demand channel.
      id: 'economy_agriculture',
      domains: ['economy', 'agriculture'],
      threshold: 0.45,
      pattern: 'food-inflation macro feedback',
      drivers: ['food-price inflation feedback (CPIAUCSL/PCEPI)', 'crop yield volatility demand destruction', 'farm-income collapse aggregate-demand loss'],
      options: [
        { label: 'trace food-inflation macro feedback', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_education' / 'culture_education' (workforce-pipeline stress)
      // translated to the macro labor-market / disposable-income channel.
      id: 'economy_education',
      domains: ['economy', 'education'],
      threshold: 0.50,
      pattern: 'workforce-pipeline macro stress',
      drivers: ['student-debt delinquency surge', 'tuition-inflation erosion of disposable income (CPIAUCSL)', 'workforce-skill mismatch labor-market friction (UNRATE/PAYEMS)'],
      options: [
        { label: 'trace economy-education pipeline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Parity to 'infrastructure_environment' (climate adaptation/coupling) translated to
      // the macro capital-allocation / inflation / GDP channel.
      id: 'economy_environment',
      domains: ['economy', 'environment'],
      threshold: 0.50,
      pattern: 'climate-macro transmission',
      drivers: ['climate-adaptation capex diversion (INDPRO/GDPC1 drag)', 'natural-disaster economic loss', 'carbon-tax incidence on cost-of-living (CPIAUCSL)'],
      options: [
        { label: 'trace climate-macro transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_culture' (narrative fragmentation) translated to the macro
      // consumer-confidence / sentiment-driven demand channel (UMCSENT).
      id: 'economy_communication',
      domains: ['economy', 'communication'],
      threshold: 0.50,
      pattern: 'sentiment-confidence macro stress',
      drivers: ['consumer-confidence collapse from misinformation (UMCSENT)', 'policy-credibility erosion reducing fiscal-multiplier', 'retail-spending hesitation from narrative fragmentation'],
      options: [
        { label: 'trace sentiment-confidence macro linkage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Technology pairs (parity port; mirrors energy/infra/culture/finance/economy structure) ──
    // TECHNOLOGY identity ONLY — semiconductors & compute, AI/ML, software & cloud,
    // hardware & devices, cybersecurity, R&D & innovation pipelines, platform networks,
    // data infrastructure. Real tech tickers (AAPL, MSFT, NVDA, GOOGL, META, AMZN, AVGO,
    // ORCL, CRM, AMD, INTC, TSM, ASML, PLTR, CRWD, PANW) — never fabricated. Technology
    // COUPLES to energy via compute demand (datacenter draw) but the domain's OWN content
    // stays chips/software/AI/cyber — NOT grid/oil/gas. DISTINCT from finance (fintech is a
    // coupling, not the identity). ADDITIVE — does not touch any validated scoring path.
    {
      // Mirrors 'infrastructure_energy' (dependency coupling) + 'culture_technology'
      // (hardware/platform strain) → cyber-physical attack surface in the actual tech
      // layers (embedded systems, legacy platforms, firmware). Roots the CISA-KEV cyber
      // cluster in real tech vendors rather than as a reactive signal only.
      id: 'infrastructure_technology',
      domains: ['infrastructure', 'technology'],
      threshold: 0.45,
      pattern: 'cyber-physical attack surface coupling',
      drivers: ['protocol-vulnerability surge (SCADA/ICS exposure)', 'zero-day disclosure (actively exploited, CISA KEV)', 'ICS-firmware obsolescence / legacy embedded-systems lag', 'supply-chain tech-dependency failure (AVGO/INTC/TSM chipset lead time)', 'SCADA-server compute demand outstripping refresh cycle'],
      options: [
        { label: 'map cyber-physical exposure across tech layers', type: 'analysis' },
        { label: 'trace ICS-firmware obsolescence chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Parity to 'infrastructure_energy' / 'environment_energy' translated to the
      // compute-demand / datacenter coupling. Technology identity = GPUs/chips/cloud
      // capacity (NVDA/AMD/ORCL/MSFT); energy is the COUPLING (grid draw), not the content.
      id: 'energy_technology',
      domains: ['energy', 'technology'],
      threshold: 0.45,
      pattern: 'compute-demand grid coupling',
      drivers: ['GPU training capacity surge (NVDA/AMD data-center demand)', 'data-center power density spike (MSFT Azure / AMZN AWS / ORCL cloud buildout)', 'cooling-water scarcity for compute clusters', 'renewable-grid stability under AI/ML training load', 'semiconductor fab energy intensity (TSM/INTC node ramp)'],
      options: [
        { label: 'map compute-demand grid exposure', type: 'analysis' },
        { label: 'investigate datacenter buildout coupling', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_intelligence' (escalation) + 'finance_defense' (systemic
      // coupling) → cyber-attack surface as a systematic technology edge (vulnerability
      // disclosure, exploit propagation, APT tooling). Real cyber-tech tickers.
      id: 'defense_technology',
      domains: ['defense', 'technology'],
      threshold: 0.42,
      pattern: 'vulnerability-propagation attack surface',
      drivers: ['CVE publication surge (disclosure velocity)', 'exploit-kit weaponization lag (defender patching velocity, CRWD EDR coverage)', 'zero-day premium spike (dark-web markets)', 'ransomware affiliate network growth (PANW detection telemetry)', 'APT tooling adoption / supply-chain attack vectors (PLTR threat graph)'],
      options: [
        { label: 'assess cyber-attack-surface posture', type: 'analysis' },
        { label: 'trace vulnerability-propagation chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Parity to 'supplyChain_agriculture' / 'finance_supplyChain' (logistics
      // transmission) translated to the automation / logistics-software layer.
      // Technology identity = robotics/ML/IoT software (AMZN/INTC/NVDA edge), not fuel.
      id: 'supplyChain_technology',
      domains: ['supplyChain', 'technology'],
      threshold: 0.45,
      pattern: 'logistics-automation technology coupling',
      drivers: ['robotic-process-automation deployment delay', 'GPS/tracking-system outage (IoT fleet visibility loss)', 'warehouse-automation bottleneck (robotics/ML integration pace)', 'last-mile-delivery software crash', 'customs-clearance digitization lag'],
      options: [
        { label: 'map logistics-automation exposure', type: 'analysis' },
        { label: 'investigate warehouse-robotics bottleneck', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' / 'infrastructure_governance' (regulatory stress)
      // translated to the regulatory-technology / e-governance platform layer. Technology
      // identity = compliance/identity/permitting software (ORCL/CRM/PLTR govtech), not policy.
      id: 'governance_technology',
      domains: ['governance', 'technology'],
      threshold: 0.45,
      pattern: 'regtech-governance coupling',
      drivers: ['compliance-software version lag (audit-automation underinvestment)', 'permitting-system outage (e-governance platform downtime)', 'digital-ID standard divergence (identity-verification infrastructure)', 'audit-trail infrastructure underinvestment', 'regulatory-tech adoption lag stalling infrastructure permitting'],
      options: [
        { label: 'trace regtech-governance linkage', type: 'analysis' },
        { label: 'investigate permitting-platform modernization', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Defense pairs (parity port; mirrors energy/infra/culture/finance/economy/tech structure) ──
    // DEFENSE identity ONLY — military spending & procurement, the defense industrial base,
    // geopolitical conflict & deterrence, weapons systems, military readiness, alliances &
    // basing, electronic/kinetic warfare, strategic deterrence. Real defense tickers
    // (LMT, RTX, NOC, GD, BA, LHX, HII, LDOS, BAH, KTOS, AVAV) — never fabricated. Defense
    // COUPLES to energy via military fuel / strategic-reserve drawdown, to supplyChain via
    // embargo/sanctions denial, to industry via munitions-production capacity, to
    // infrastructure via base/ICS hardening, to governance via doctrine/alliances, and to
    // agriculture via force-provisioning food security — but the domain's OWN content stays
    // kinetic/procurement/readiness, NOT oil/grid (energy is a fuel coupling). DISTINCT from
    // intelligence (defense = kinetic/industrial/readiness; intelligence = collection/
    // analysis/espionage) and from technology (cyber is a coupling, not the identity).
    // ADDITIVE — does not touch any validated scoring path.
    {
      // Mirrors 'energy_supply' (logistics disruption / fuel supply stress) translated to
      // military fuel cycles, SPR coordination, NATO fuel agreements. Energy is the COUPLING
      // (strategic-fuel consequence); defense identity stays readiness/sustained-operations.
      id: 'defense_energy',
      domains: ['defense', 'energy'],
      threshold: 0.42,
      pattern: 'sustained-operations fuel exposure',
      drivers: ['military fuel supply stress (sustained-operations burn rate)', 'strategic petroleum reserve drawdown coordination', 'NATO fuel-agreement logistics strain', 'forward-base refueling chokepoint', 'JP-8 / aviation-fuel procurement cost elevation (LMT/RTX/NOC platform readiness)'],
      options: [
        { label: 'trace military-fuel exposure', type: 'analysis' },
        { label: 'investigate strategic-reserve drawdown coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'supplyChain_agriculture' / 'finance_supplyChain' (logistics transmission)
      // translated to defense procurement: embargo/sanctions, dual-use components, rare-earth
      // dependencies, allied supply locks. Trade coupling = strategic-denial consequence.
      id: 'defense_supplyChain',
      domains: ['defense', 'supplyChain'],
      threshold: 0.45,
      pattern: 'strategic-denial procurement transmission',
      drivers: ['embargo / sanctions munitions-component scarcity', 'rare-earth dependency lock (magnet/guidance supply)', 'Taiwan chip embargo → missile-guidance shortfall (RTX/LMT/KTOS)', 'allied supply-lock / export-control denial', 'CONUS munitions-production component bottleneck (GD/NOC industrial base)'],
      options: [
        { label: 'trace strategic-denial procurement exposure', type: 'analysis' },
        { label: 'investigate dual-use component scarcity', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'industry_economy' (contraction) inverted to attrition-driven demand SURGE:
      // munitions / replacement-vehicle / sustainment production stress. Industrial coupling
      // = production-capacity consequence; defense identity stays kinetic/procurement.
      id: 'defense_industry',
      domains: ['defense', 'industry'],
      threshold: 0.48,
      pattern: 'industrial-base munitions production stress',
      drivers: ['attrition-driven munitions burn rate (Ukraine 155mm replenishment, GD/NOC capacity)', 'tank / combat-vehicle replacement backlog (GD ground systems)', 'missile replenishment line constraint (RTX/LMT/KTOS)', 'carrier air-group / shipbuilding throughput (HII/BA sustainment)', 'sustainment & depot maintenance surge (LHX/LDOS readiness)'],
      options: [
        { label: 'trace munitions-production capacity exposure', type: 'analysis' },
        { label: 'investigate attrition-driven demand surge', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_technology' (cyber-physical attack surface) anchored to
      // military-specific risk: base power grids, CONUS logistics depots, strategic-comms
      // facilities, SCADA/ICS hardening, COOP/continuity-of-operations. Infrastructure
      // coupling = attack-surface consequence; defense identity stays readiness.
      id: 'defense_infrastructure',
      domains: ['defense', 'infrastructure'],
      threshold: 0.45,
      pattern: 'military attack-surface infrastructure stress',
      drivers: ['base power-grid / ICS vulnerability (SCADA hardening lag)', 'CONUS logistics-depot resilience decay', 'strategic-comms facility infrastructure obsolescence (LHX/LDOS systems)', 'embedded-systems / supply-chain firmware lag in weapons platforms', 'COOP / continuity-of-operations basing resilience deficit'],
      options: [
        { label: 'map military attack-surface exposure', type: 'analysis' },
        { label: 'trace base-infrastructure resilience chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' (regulatory/governance stress) made explicit for defense:
      // strategic doctrine, policy, alliances, deterrence posture. Governance coupling =
      // policy/alliance consequence; defense identity stays kinetic/readiness/warfare.
      id: 'defense_governance',
      domains: ['defense', 'governance'],
      threshold: 0.40,
      pattern: 'deterrence-posture policy stress',
      drivers: ['NATO expansion / alliance realignment', 'deterrence-doctrine revision', 'treaty withdrawal / arms-control breakdown', 'defense-authorization / procurement-policy shift (NDAA budget posture)', 'basing-rights / force-posture agreement strain'],
      options: [
        { label: 'trace deterrence-policy linkage', type: 'analysis' },
        { label: 'assess strategic-decision posture', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'agriculture_population' (food-supply pressure) translated to military
      // nutrition / force-provisioning / overseas-base food security. Agriculture coupling =
      // supply-consequence; defense identity stays kinetic/readiness.
      id: 'defense_agriculture',
      domains: ['defense', 'agriculture'],
      threshold: 0.44,
      pattern: 'force-provisioning food-security shock',
      drivers: ['Ukraine grain disruption → NATO force-provisioning strain', 'global food inflation → deployed-force ration cost surge', 'overseas-base provisioning supply shock', 'military nutrition supply-chain bottleneck', 'deployed-force ration sustainability risk'],
      options: [
        { label: 'trace force-provisioning food-security exposure', type: 'analysis' },
        { label: 'investigate ration supply-shock coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Intelligence pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense structure) ──
    // INTELLIGENCE identity ONLY — collection (SIGINT/HUMINT/GEOINT/OSINT), all-source
    // analysis & assessment, espionage & counterintelligence, surveillance & reconnaissance,
    // threat warning, covert action, information & influence operations, security clearance
    // & insider risk. Real intel-sector tickers (PLTR, BAH, LDOS, CACI, SAIC, KBR, VRNT,
    // NICE, VRSK) — never fabricated. Each PAIRED domain is a COLLECTION TARGET / coupling
    // (the thing intelligence is collecting on), NEVER intelligence's own content; the
    // domain's OWN identity stays collection/analysis/espionage. DISTINCT from defense
    // (defense = kinetic/industrial/readiness; intelligence = collection/analysis/espionage)
    // and from technology (cyber tooling is a coupling, not the identity). Mirrors
    // 'energy_supply' (logistics disruption) applied to intelligence transmission lanes.
    // ADDITIVE — does not touch any validated scoring path. ('defense_intelligence' and
    // 'intelligence_governance' already cover defense↔intel and intel↔governance.)
    {
      // Mirrors 'energy_supply' (logistics disruption / fuel supply stress) applied to
      // illicit-finance transmission: finint feed velocity vs. banking-compliance pressure.
      id: 'intelligence_finance',
      domains: ['intelligence', 'finance'],
      threshold: 0.45,
      pattern: 'finint-surveillance banking-compliance coupling',
      drivers: ['illicit-finance detection lag (TBLM shell-company networks, beneficial-ownership tracing)', 'sanctions-evasion indicator signals (cryptoasset / cross-border transactions)', 'AML/CFT investigation backlog (BAH compliance-intel staffing)', 'counterparty-intelligence concentration (high-net-worth / politically-exposed-persons watch)', 'transaction-trace velocity under surveillance pressure (PLTR all-source finint, VRSK transaction-risk analytics)'],
      options: [
        { label: 'trace finint-banking-compliance exposure', type: 'analysis' },
        { label: 'investigate sanctions-evasion detection lag', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_technology' (vulnerability-propagation attack surface) anchored in
      // cyber-INTEL collection: CVE attribution, APT-tooling, post-quantum obsolescence.
      // Cyber tooling is the COUPLING; intel identity stays collection/attribution/espionage.
      id: 'intelligence_technology',
      domains: ['intelligence', 'technology'],
      threshold: 0.42,
      pattern: 'cyber-intel vulnerability-attribution coupling',
      drivers: ['CVE publication surge (disclosure velocity)', 'APT-tooling adoption / supply-chain attack vectors (PLTR threat graph)', 'firmware-obsolescence in legacy platforms', 'zero-day premium spike (dark-web markets, CRWD cyber-threat intel)', 'crypto-algorithm-migration pressure (post-quantum readiness)', 'ransomware-affiliate-network growth (PANW threat telemetry)', 'encryption-key-recovery advances (BAH/LDOS cyber-intel services)'],
      options: [
        { label: 'assess cyber-intel attribution posture', type: 'analysis' },
        { label: 'trace vulnerability-attribution chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'health_research' (innovation cluster) inverted to bioINTEL collection:
      // biointel collection velocity vs. health-system diagnostic readiness. Biointel is an
      // intelligence collecting discipline (surveillance of biotech/health flows), not health.
      id: 'intelligence_health',
      domains: ['intelligence', 'health'],
      threshold: 0.42,
      pattern: 'biointel-surveillance biosecurity-threat coupling',
      drivers: ['emerging-pathogen detection lag (sequence-database turnaround, epidemiological-alert velocity)', 'gain-of-function research disclosure (dual-use publication monitoring)', 'lab-safety incident underreporting', 'pandemic-surveillance intelligence gaps (early-warning indicator velocity, LDOS biosecurity analysis)', 'biosecurity-threat assessment updates (BAH health-intelligence services)', 'biodefense R&D pipeline visibility (SAIC biodefense intelligence)', 'agribusiness-biotech-intelligence collection (crop-threat monitoring)'],
      options: [
        { label: 'trace biointel-biosecurity exposure', type: 'analysis' },
        { label: 'investigate pandemic-surveillance gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'energy_supply' / 'defense_supplyChain' (logistics transmission) applied to
      // collection-targeting of supply-chain dependencies. Distinct from defense_supplyChain
      // (kinetic readiness) and defense_intelligence (threat escalation).
      id: 'intelligence_supplyChain',
      domains: ['intelligence', 'supplyChain'],
      threshold: 0.45,
      pattern: 'collection-targeting logistics-surveillance coupling',
      drivers: ['sanctions-evasion logistics intelligence (transhipment detection, front-company routing)', 'dual-use-component procurement tracking (semiconductor / electronics intelligence)', 'rare-earth supply-chain intelligence (mining → refining → fab tracing, LDOS geospatial)', 'critical-commodity tracing (strategic-material supply visibility, PLTR supply-chain visibility)', 'customs-intelligence integration (border-interception effectiveness)', 'export-control-evasion detection (illicit procurement networks, SAIC sanctions-evasion intelligence)'],
      options: [
        { label: 'trace collection-targeting logistics exposure', type: 'analysis' },
        { label: 'investigate dual-use procurement tracking', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_culture' (narrative divergence / misinformation pressure) but
      // anchored in OSINT collection rather than cultural impact: OSINT feed velocity vs.
      // communication-platform transparency.
      id: 'intelligence_communication',
      domains: ['intelligence', 'communication'],
      threshold: 0.42,
      pattern: 'OSINT-collection influence-operation-attribution coupling',
      drivers: ['OSINT feed velocity (media-analysis cadence, discourse-monitoring updates, PLTR OSINT platforms)', 'foreign-influence-operation detection (troll-network attribution, state-sponsored-narrative campaigns)', 'misinformation-propagation tracking (false-narrative spread velocity, coordinated-inauthentic-behavior detection)', 'narrative-influence attribution (state / non-state actor identification, VRNT SIGINT on communications)', 'social-media-threat-signal velocity (trending-narrative anomaly detection, NICE social-media surveillance)'],
      options: [
        { label: 'analyze OSINT influence-operation exposure', type: 'analysis' },
        { label: 'trace narrative-attribution chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'energy_supply' / 'infrastructure_energy' translated to collection on energy
      // infrastructure (SIGINT/GEOINT). Distinct from defense_energy (fuel-supply readiness)
      // and energy_technology (compute-grid coupling). Energy is the COLLECTION TARGET, not
      // intelligence's own content.
      id: 'intelligence_energy',
      domains: ['intelligence', 'energy'],
      threshold: 0.44,
      pattern: 'collection-targeting energy-infrastructure-surveillance coupling',
      drivers: ['SIGINT on grid control systems (SCADA intelligence)', 'GEOINT on energy-production facilities (refinery / pipeline monitoring, LDOS geospatial)', 'sanctions-evasion detection on energy supply (oil-trading-network intelligence, dual-use-fuel-shipment tracking)', 'critical-energy-infrastructure-threat assessment (power-grid attack-surface intelligence, PLTR critical-infrastructure mapping)', 'strategic-petroleum-reserve surveillance (reserve drawdown visibility)', 'renewable-transition intelligence (cleantech supply-chain tracking, SAIC energy-security intelligence)'],
      options: [
        { label: 'trace energy-infrastructure collection exposure', type: 'analysis' },
        { label: 'investigate SIGINT/GEOINT surveillance coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'education_research' (knowledge-pipeline stress) but anchored in intelligence
      // collection of research: collection-targeting cadence vs. research-pipeline transparency.
      id: 'intelligence_research',
      domains: ['intelligence', 'research'],
      threshold: 0.40,
      pattern: 'collection-targeting academic-security coupling',
      drivers: ['dual-use-publication monitoring (disclosure lag, research-sensitivity detection)', 'foreign-researcher-acquisition intelligence (talent-targeting networks, IP-theft risk assessment, PLTR researcher networks)', 'IP-targeting detection (hostile-takeover of university research programs)', 'research-facility-threat assessment (lab-security intelligence, LDOS research-security intelligence)', 'academic-freedom-security-balance tensions (export-control vs. openness friction, BAH academic counterintelligence)', 'quantum-computing-breakthrough tracking (transformative-tech early-warning)'],
      options: [
        { label: 'trace collection-targeting research exposure', type: 'analysis' },
        { label: 'investigate academic-security coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_industry' (attrition-driven production stress) but anchored in
      // intelligence collection of industry threats: collection-targeting cadence vs.
      // industrial-security pressure.
      id: 'intelligence_industry',
      domains: ['intelligence', 'industry'],
      threshold: 0.46,
      pattern: 'collection-targeting counterintelligence coupling',
      drivers: ['industrial-facility GEOINT monitoring (manufacturing-capacity visibility, LDOS industrial geospatial)', 'industrial-control-system SIGINT (SCADA security intelligence)', 'foreign-acquisition intelligence (hostile-takeover detection)', 'insider-threat signals (employee-vetting intelligence, clearance-investigation backlog, BAH insider-threat detection)', 'sanctions-evasion detection in procurement (dual-use-component trafficking)', 'critical-capacity counterintelligence (semiconductor-fab / pharmaceutical-line espionage, CACI counterintelligence services, PLTR critical-capacity mapping)'],
      options: [
        { label: 'trace industrial collection-targeting exposure', type: 'analysis' },
        { label: 'investigate insider-threat counterintelligence coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'agriculture_population' (food-supply pressure) but anchored in intelligence
      // collection: collection-targeting cadence vs. agricultural-capacity pressure.
      id: 'intelligence_agriculture',
      domains: ['intelligence', 'agriculture'],
      threshold: 0.44,
      pattern: 'collection-targeting food-security-surveillance coupling',
      drivers: ['crop-production GEOINT monitoring (yield-forecasting intelligence, drought-impact visibility, LDOS agricultural geospatial)', 'food-security intelligence (supply-chain vulnerability assessment, SAIC food-security intelligence)', 'sanctions-evasion detection on agricultural supplies (fertilizer / seed / grain smuggling)', 'foreign-acquisition intelligence (farmland / asset-ownership tracking)', 'agribusiness espionage detection (biotech IP-theft, genetic-resource misappropriation)', 'strategic-commodity-supply tracking (grain, fertilizer, seeds, PLTR commodity-supply visibility)'],
      options: [
        { label: 'trace agricultural collection-targeting exposure', type: 'analysis' },
        { label: 'investigate food-security surveillance coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_technology' (cyber-physical attack surface) but anchored in
      // intelligence collection of threats: collection-targeting cadence vs.
      // infrastructure-resilience pressure.
      id: 'intelligence_infrastructure',
      domains: ['intelligence', 'infrastructure'],
      threshold: 0.45,
      pattern: 'collection-targeting critical-infrastructure-protection coupling',
      drivers: ['critical-infrastructure SIGINT monitoring (control-system surveillance)', 'GEOINT facility tracking (grid / water / transport operations, LDOS infrastructure geospatial)', 'attack-surface-threat assessment (vulnerability intelligence, PLTR critical-infrastructure mapping)', 'insider-threat signals (facility-employee clearance intelligence)', 'counterintelligence on infrastructure espionage (foreign-intelligence targeting, CACI counterintelligence)', 'cyber-attack-readiness intelligence (APT TTPs targeting infrastructure, BAH infrastructure-threat assessment)'],
      options: [
        { label: 'map infrastructure collection-targeting exposure', type: 'analysis' },
        { label: 'trace critical-infrastructure-protection coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'religion_population' (demographic-moral tension) but anchored in intelligence
      // collection: collection-targeting cadence vs. population-dynamics pressure.
      id: 'intelligence_population',
      domains: ['intelligence', 'population'],
      threshold: 0.43,
      pattern: 'collection-targeting surveillance-deployment coupling',
      drivers: ['population-surveillance-system deployment (facial-recognition, movement-tracking, NICE surveillance analytics)', 'migration-intelligence collection (border-crossing pattern analysis, PLTR population-flow mapping)', 'unrest early-warning signals (social-upheaval detection velocity)', 'demographic-shift intelligence (population-composition-change assessment, VRSK demographic risk modeling)', 'identity-tracking capability (facial-match accuracy, biometric-database expansion)', 'insider-threat signals in mass movements (infiltration readiness, VRNT SIGINT on population movement)'],
      options: [
        { label: 'trace population collection-targeting exposure', type: 'analysis' },
        { label: 'investigate surveillance-deployment coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' (regulatory stress) but anchored in intelligence collection
      // of legal-system threats: collection-targeting cadence vs. legal-system pressure.
      id: 'intelligence_law',
      domains: ['intelligence', 'law'],
      threshold: 0.43,
      pattern: 'collection-targeting legal-enforcement-intelligence coupling',
      drivers: ['sanctions-enforcement intelligence (violation-detection velocity, evasion-routing tracking, SAIC sanctions intelligence)', 'export-control-violations detection (strategic-technology-transfer interdiction)', 'law-enforcement-corruption counterintelligence (insider-threat detection in agencies, BAH law-enforcement intelligence)', 'legal-system-threat assessment (judge / prosecutor targeting intelligence)', 'arms-control-compliance monitoring (treaty-violation indicators)', 'compliance-intelligence sharing (inter-agency information flow, PLTR compliance-violation detection)'],
      options: [
        { label: 'trace legal-enforcement collection exposure', type: 'analysis' },
        { label: 'investigate sanctions-enforcement intelligence coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'environment_energy' (climate-resource pressure) but anchored in intelligence
      // collection of environmental threats: collection-targeting cadence vs.
      // environmental-system pressure.
      id: 'intelligence_environment',
      domains: ['intelligence', 'environment'],
      threshold: 0.42,
      pattern: 'collection-targeting environmental-threat-assessment coupling',
      drivers: ['climate-change intelligence (threat-assessment velocity, PLTR environmental-threat mapping)', 'natural-disaster early-warning (prediction-accuracy improvement, LDOS geospatial environmental monitoring)', 'environmental-policy intelligence (sanctions / trade impacts on environmental compliance)', 'foreign-environmental-warfare capability assessment', 'ecosystem-threat indicators (deforestation, pollution intelligence)', 'environmental-justice-threat assessment (VRSK environmental risk intelligence)'],
      options: [
        { label: 'trace environmental-threat collection exposure', type: 'analysis' },
        { label: 'investigate climate-intelligence coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_culture' (media-cultural fragmentation) but anchored in OSINT
      // collection of cultural threats: OSINT collection cadence vs. cultural-institution
      // pressure.
      id: 'intelligence_culture',
      domains: ['intelligence', 'culture'],
      threshold: 0.40,
      pattern: 'OSINT-collection cultural-threat-surveillance coupling',
      drivers: ['cultural-movement OSINT velocity (emerging-scene early-warning, artist-network tracking, PLTR OSINT on cultural movements)', 'foreign-cultural-influence-operation detection (state-sponsored cultural-narrative campaigns, NICE cultural-influence-operation detection)', 'cultural-institution-threat assessment (insider-risk in heritage organizations)', 'identity-movement intelligence (radicalization-pathway analysis, BAH cultural-threat assessment)', 'cultural-identity-as-espionage targeting'],
      options: [
        { label: 'analyze cultural-threat OSINT exposure', type: 'analysis' },
        { label: 'trace cultural-institution insider-threat coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'education_research' (knowledge-pipeline stress) but anchored in intelligence
      // collection of education threats: collection-targeting cadence vs. education-system
      // pressure.
      id: 'intelligence_education',
      domains: ['intelligence', 'education'],
      threshold: 0.40,
      pattern: 'collection-targeting academic-security education coupling',
      drivers: ['foreign-student-security vetting (enrollment-background-investigation velocity, LDOS student-vetting intelligence)', 'academic-counterintelligence (IP-theft detection in schools, BAH academic-security intelligence)', 'insider-threat signals (trusted-insider targeting of student / faculty, PLTR insider-threat detection in institutions)', 'curriculum-targeting intelligence (critical-skill-area assessment)', 'educational-AI-model espionage (foundation-model theft intelligence)'],
      options: [
        { label: 'trace education collection-targeting exposure', type: 'analysis' },
        { label: 'investigate academic-security coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Trade & Supply Chain pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense/intelligence structure) ──
    // TRADE / SUPPLY-CHAIN identity ONLY (runtime key 'supplyChain', URL/portal key
    // 'trade' per domain-identity.js) — international trade & commerce, exports/imports,
    // tariffs & trade policy, shipping & logistics, supply chains, trade balance, customs,
    // trade agreements, sanctions/embargoes, freight & ports. Real trade/logistics tickers
    // (FDX, UPS, EXPD, CHRW, ZIM, MATX, XPO, GXO, AMKBY, DSDVY, ODFL, JBHT, SAIA, ARC) —
    // never fabricated. Each PAIRED domain couples to supplyChain via a POLICY / ENFORCEMENT /
    // PHYSICAL-PLANT / WORKFORCE / DATA / COMPLIANCE regime; supplyChain is NOT that domain's
    // OWN content (policy is institutional, jurisprudence is legal, physical assets are infra,
    // demographics are population, etc.). DISTINCT from economy (macro aggregate) and industry
    // (production). Energy oil/gas/grid is NEVER trade's own content. ADDITIVE — does not touch
    // any validated scoring path. ('energy_supply', 'economy_liquidity', 'finance_supplyChain',
    // 'supplyChain_agriculture', 'supplyChain_technology', 'defense_supplyChain',
    // 'intelligence_supplyChain' already cover those couplings.)
    {
      // Mirrors 'law_governance' / 'infrastructure_governance' (policy-regime stress)
      // applied to trade policy: tariffs, export controls, trade agreements, USMCA/WTO.
      // Governance is the COUPLING (policy regime); supplyChain is logistics, not policy.
      id: 'governance_supplyChain',
      domains: ['governance', 'supplyChain'],
      threshold: 0.45,
      pattern: 'trade-policy transmission',
      drivers: ['tariff shock (25% rate escalation)', 'export-control list expansion (semiconductor / dual-use)', 'trade-agreement negotiation delay (USMCA renegotiation)', 'regional-trade-bloc divergence (CPTPP vs. RCEP)', 'WTO-compliance dispute pressure (CHRW/EXPD tariff-impact exposure, JBHT trade-policy compliance cost)'],
      options: [
        { label: 'trace trade-policy transmission exposure', type: 'analysis' },
        { label: 'investigate tariff / export-control escalation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_law' / 'law_governance' (enforcement-regime stress) applied to
      // trade-law enforcement: customs, sanctions-evasion, CFIUS, FCPA. Law is the COUPLING
      // (regulatory/enforcement regime); supplyChain is logistics operations, not jurisprudence.
      id: 'law_supplyChain',
      domains: ['law', 'supplyChain'],
      threshold: 0.45,
      pattern: 'trade-enforcement transmission',
      drivers: ['customs audit backlog surge', 'sanctions-evasion fine escalation (Huawei / ZTE supply-chain penalties)', 'CFIUS review timeline extension', 'FCPA / anti-bribery trade-compliance burden', 'trade-compliance litigation spike (CHRW tariff-classification disputes, SAIA customs compliance, EXPD customs brokerage exposure)'],
      options: [
        { label: 'trace trade-enforcement transmission exposure', type: 'analysis' },
        { label: 'investigate customs / sanctions enforcement velocity', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_energy' (physical-plant dependency coupling) applied to the
      // transport plant (ports/rail/roads). DISTINCT from 'energy_supply' (fuel coupling):
      // infrastructure is the physical-transport asset; supplyChain is logistics operations.
      id: 'infrastructure_supplyChain',
      domains: ['infrastructure', 'supplyChain'],
      threshold: 0.45,
      pattern: 'transport-infrastructure capacity transmission',
      drivers: ['port congestion (Long Beach / Rotterdam queue depth)', 'rail-yard equipment shortage (intermodal yard saturation)', 'bridge weight-restriction enforcement (I-35 corridor choke)', 'dredging-maintenance backlog degrading channel depth (Mississippi low-water events)', 'port terminal closure / capacity strain (ZIM port-slot availability, MATX port-automation handling, ODFL road-capacity pressure)'],
      options: [
        { label: 'map transport-infrastructure capacity exposure', type: 'analysis' },
        { label: 'trace port / rail / road bottleneck chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_research' / 'culture_research' (innovation-cluster structure)
      // applied to logistics-optimization R&D. Research is the COUPLING (innovation substrate);
      // supplyChain is operational logistics, not academic methodology.
      id: 'research_supplyChain',
      domains: ['research', 'supplyChain'],
      threshold: 0.40,
      pattern: 'logistics-research innovation transmission',
      drivers: ['autonomous-port-equipment deployment lag (Port Authority trials)', 'ML route-optimization accuracy plateau (congestion-prediction drag)', 'blockchain-customs pilot scalability delay', 'supply-chain-visibility mapping gap', 'autonomous-warehouse R&D deployment lag (AMZN logistics R&D, MSFT Azure supply-chain AI, PLTR supply-chain visibility)'],
      options: [
        { label: 'trace logistics-research pipeline exposure', type: 'analysis' },
        { label: 'investigate autonomous-port / route-optimization gap', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_education' / 'culture_education' (workforce-pipeline stress)
      // applied to logistics workforce. Education is the COUPLING (workforce pipeline);
      // supplyChain is logistics operations, not pedagogy.
      id: 'education_supplyChain',
      domains: ['education', 'supplyChain'],
      threshold: 0.45,
      pattern: 'logistics-workforce pipeline transmission',
      drivers: ['port-operator apprenticeship intake lag', 'CDL truck-driver training capacity bottleneck (driver shortage intensity)', 'customs-broker licensing exam backlog surge', 'rail-logistics apprenticeship-enrollment decline', 'logistics workforce skill gap (JBHT training pipeline, CHRW customs-broker hiring, ARC driver-training programs)'],
      options: [
        { label: 'trace logistics-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate CDL / customs-broker shortage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_culture' / 'finance_technology' (real-time data-infrastructure
      // stress) applied to customs/visibility data exchange. Communication is the COUPLING
      // (real-time data infra); supplyChain is logistics operations, not signals/platforms.
      id: 'communication_supplyChain',
      domains: ['communication', 'supplyChain'],
      threshold: 0.45,
      pattern: 'supply-chain data-infrastructure transmission',
      drivers: ['customs eManifest API downtime (CBP processing lag)', 'shipping-visibility platform outage', 'blockchain-customs network partition / node sync failure', 'shipping-tracker reliability degradation', 'customs document-API availability stress (FDX Track & Trace uptime, UPS tracking reliability, DHL customs-document API)'],
      options: [
        { label: 'trace supply-chain data-infrastructure exposure', type: 'analysis' },
        { label: 'investigate customs-API / tracker outage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_environment' / 'economy_environment' (compliance-regime stress)
      // applied to carbon-accounting & green-shipping. Environment is the COUPLING (carbon /
      // compliance regime); supplyChain is logistics operations, not physical emissions.
      id: 'environment_supplyChain',
      domains: ['environment', 'supplyChain'],
      threshold: 0.45,
      pattern: 'green-shipping compliance transmission',
      drivers: ['IMO 2030 bunker-fuel regulation compliance-cost spike', 'EU carbon-border-adjustment mechanism (CBAM) tariff on imports', 'port-emission-zone expansion (EU ETS / California clean-air rules)', 'intermodal-route carbon-intensity reporting burden', 'clean-fuel transition capex pressure (ZIM shipping-fuel cost, AMKBY clean-fuel transition, MATX port-equipment emissions)'],
      options: [
        { label: 'trace green-shipping compliance exposure', type: 'analysis' },
        { label: 'investigate IMO 2030 / CBAM cost transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Environment pairs (parity port; mirrors energy/supplyChain/finance/defense structure) ──
    // ENVIRONMENT identity ONLY — climate & emissions, air/water/soil pollution & quality,
    // ecosystems & biodiversity, natural resources & conservation, environmental regulation &
    // compliance, climate risk & adaptation, waste management & remediation, carbon markets.
    // Real environmental-sector tickers (WM, RSG, WCN, CWST, AWK, WTRG, XYL, ECL, LIN, APD,
    // DAR, AY, MNRO) — never fabricated. Each PAIRED domain couples to environment via an
    // INPUT-SUPPLY/EMISSIONS, POLICY, LEGAL, R&D, MONITORING-TECH, KINETIC, CAPITAL, NARRATIVE,
    // CREATIVE, WORKFORCE, EPIDEMIOLOGY, MIGRATION, or MORAL regime; environment's OWN content
    // stays climate / pollution / ecosystems / natural resources. Energy oil/gas/grid is NEVER
    // environment's own content — environment couples to energy via emissions/carbon. Kept
    // DISTINCT from agriculture (land/water use is a coupling). ADDITIVE — does not touch any
    // validated scoring path. ('environment_energy', 'environment_supplyChain' already exist.)
    {
      // Mirrors 'energy_supply' (commodity input stress → consequence) applied to fertilizer/
      // pesticide carbon footprint and land-use-change emission. Agriculture is the COUPLING
      // (input-supply / crop-livestock output); environment identity stays emissions/carbon/water.
      id: 'environment_agriculture',
      domains: ['environment', 'agriculture'],
      threshold: 0.45,
      pattern: 'agricultural-emissions farming-intensity coupling',
      drivers: ['crop-input GHG footprint (fertilizer/pesticide manufacturing emissions)', 'livestock-methane intensity surge', 'land-use-change carbon release (deforestation for farmland)', 'soil-carbon loss (tillage / monoculture degradation)', 'agricultural-runoff eutrophication (nitrogen/phosphorus water pollution: AWK water-quality exposure, WTRG essential-water utility, WCN environmental-waste, ECL water solutions, MNRO farm-linked emissions tracking)'],
      options: [
        { label: 'map agricultural-emissions exposure', type: 'analysis' },
        { label: 'investigate land-use-change / runoff transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' (compliance-regime stress) applied to environmental-regulation
      // enforcement and carbon-policy implementation. Governance is the COUPLING (policy regime);
      // environment identity stays climate/pollution/ecosystems, not legislation.
      id: 'environment_governance',
      domains: ['environment', 'governance'],
      threshold: 0.50,
      pattern: 'environmental-policy transmission',
      drivers: ['emissions-regulation tightening (Clean Air Act / GHGRP)', 'carbon-tax incidence / cap-and-trade pricing shift', 'environmental-permit processing delay', 'climate-adaptation-spending allocation shift', 'EPA / state environmental-agency enforcement-priority shift (WM waste-management regulation, RSG emissions compliance, CWST waste-emissions policy, ECL environmental-compliance solutions, XYL water/environmental solutions)'],
      options: [
        { label: 'trace environmental-policy exposure', type: 'analysis' },
        { label: 'investigate carbon-tax / permitting transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_law' (enforcement-regime stress) applied to environmental-liability and
      // pollution-control compliance burden. Law is the COUPLING (legal/enforcement regime);
      // environment identity stays pollution/climate/ecosystems, not jurisprudence.
      id: 'environment_law',
      domains: ['environment', 'law'],
      threshold: 0.45,
      pattern: 'environmental-legal liability transmission',
      drivers: ['environmental-liability lawsuit surge (CERCLA / RCRA)', 'EPA enforcement-action velocity', 'state environmental-violation fines', 'groundwater-contamination litigation', 'wetlands-destruction / ozone-particulate-pollution-damage claims (WM landfill liability, ECL industrial-cleaning compliance, LIN industrial-emissions exposure, CWST waste-compliance, WTRG water-utility liability)'],
      options: [
        { label: 'trace environmental-legal liability exposure', type: 'analysis' },
        { label: 'investigate CERCLA / RCRA enforcement transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'education_research' (knowledge-pipeline stress) applied to environmental-science
      // R&D and climate-adaptation technology pipelines. Research is the COUPLING (innovation
      // substrate); environment identity stays climate/pollution/ecosystems, not academic structure.
      id: 'environment_research',
      domains: ['environment', 'research'],
      threshold: 0.40,
      pattern: 'environmental-research innovation transmission',
      drivers: ['climate-research funding availability', 'biodiversity-monitoring technology lag', 'remediation-innovation adoption lag', 'green-tech patent publication rate', 'climate-model refinement velocity (ECL environmental-science R&D, XYL water research, university partnership pipelines)'],
      options: [
        { label: 'trace environmental-research pipeline exposure', type: 'analysis' },
        { label: 'investigate remediation / biodiversity innovation gap', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_technology' (cyber-physical attack surface) applied to
      // environmental-monitoring networks and emissions-tracking infrastructure. Technology is
      // the COUPLING (chips/software/cloud); environment identity stays climate/pollution/ecosystems.
      id: 'environment_technology',
      domains: ['environment', 'technology'],
      threshold: 0.45,
      pattern: 'environmental-monitoring tech coupling',
      drivers: ['emissions-monitoring-sensor deployment lag (satellites / IoT)', 'carbon-capture system efficiency plateau', 'satellite-imagery processing latency for deforestation-tracking', 'environmental-data-platform outage', 'climate-model compute demand (ECL environmental-tech solutions, XYL water-tech, AAPL/MSFT/GOOGL/AMZN cloud for climate-data & ESG-scoring platforms)'],
      options: [
        { label: 'map environmental-monitoring tech exposure', type: 'analysis' },
        { label: 'investigate sensor / carbon-capture deployment gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_energy' (fuel-supply coupling) applied to DOD environmental footprint and
      // rare-earth supply-chain emissions. Defense is the COUPLING (kinetic/industrial); environment
      // identity stays emissions/pollution/natural resources, not military readiness.
      id: 'environment_defense',
      domains: ['environment', 'defense'],
      threshold: 0.42,
      pattern: 'military-emissions environmental exposure',
      drivers: ['military-base Superfund cleanup', 'DOD facility emissions under Clean Air Act', 'rare-earth mining environmental-damage (China dominance)', 'strategic-mineral supply-chain environmental-impact (coltan/cobalt mining)', 'base-remediation spend / sustainable-sourcing pressure (LIN rare-earth/industrial exposure, LMT/RTX/NOC/GD base-remediation & sourcing pressure)'],
      options: [
        { label: 'map military-emissions environmental exposure', type: 'analysis' },
        { label: 'investigate rare-earth / base-remediation transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_infrastructure' (capital-transmission stress) applied to climate-risk asset
      // valuation and green-financing supply. Finance is the COUPLING (capital markets/credit);
      // environment identity stays climate/emissions/natural resources, not banking.
      id: 'environment_finance',
      domains: ['environment', 'finance'],
      threshold: 0.45,
      pattern: 'climate-risk financial transmission',
      drivers: ['climate-risk-weighted asset impairment (fossil-fuel stranded assets)', 'green-bond market stress (ESG-fund outflow)', 'climate-litigation insurance premium spike', 'transition-risk credit-spread widening', 'climate-adaptation-capex financing tightness (WM ESG-fund exposure, RSG green-debt issuance, CWST sustainable-finance, JPM/BAC/GS climate-risk pricing, BLK iShares ESG funds, V/MA ESG-linked flows)'],
      options: [
        { label: 'trace climate-risk financial exposure', type: 'analysis' },
        { label: 'investigate stranded-asset / green-bond transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_culture' (narrative divergence) applied to climate-communication
      // fragmentation and environmental-awareness campaigns. Communication is the COUPLING
      // (narrative/media infra); environment identity stays climate/pollution/ecosystems.
      id: 'environment_communication',
      domains: ['environment', 'communication'],
      threshold: 0.40,
      pattern: 'environmental-narrative information transmission',
      drivers: ['climate-news volume spike', 'conflicting climate-science narratives (misinformation)', 'greenwashing-narrative propagation', 'environmental-justice-movement visibility surge', 'climate-crisis discourse tone shift'],
      options: [
        { label: 'analyze environmental-narrative ecosystem', type: 'analysis' },
        { label: 'investigate greenwashing / misinformation transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_finance' (creative-economy capital coupling) applied to sustainability-
      // themed creative production. Culture is the COUPLING (creative expression); environment
      // identity stays climate/pollution/ecosystems, not creative output.
      id: 'environment_culture',
      domains: ['environment', 'culture'],
      threshold: 0.38,
      pattern: 'cultural-climate narrative coupling',
      drivers: ['climate-crisis as art/music theme surge', 'environmental-justice art-movement visibility', 'heritage-site flood/damage-risk (UNESCO sites)', 'creator-economy carbon-footprint awareness', 'cultural-institution climate-commitment visibility (ECL cultural-sustainability initiatives, META/GOOGL environmental-content platform reach)'],
      options: [
        { label: 'map cultural-climate narrative exposure', type: 'analysis' },
        { label: 'investigate heritage-site / sustainability-theme coupling', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_education' (workforce-pipeline stress) applied to environmental-
      // science and green-careers training. Education is the COUPLING (pedagogy/workforce);
      // environment identity stays climate/pollution/natural resources, not pedagogy.
      id: 'environment_education',
      domains: ['environment', 'education'],
      threshold: 0.40,
      pattern: 'environmental-literacy workforce pipeline',
      drivers: ['climate-curriculum integration pace', 'environmental-science university enrollment trends', 'K-12 environmental-education budget', 'STEM-workforce gap in environmental engineering', 'climate-scientist talent pipeline (ECL educational partnerships, XYL water-engineering workforce)'],
      options: [
        { label: 'trace environmental-literacy workforce exposure', type: 'analysis' },
        { label: 'investigate STEM / climate-talent pipeline gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'health_research' (innovation cluster) applied to environmental-epidemiology and
      // pollution-health research. Health is the COUPLING (medicine/epidemiology); environment
      // identity stays pollution/air-quality/water-quality, not medicine.
      id: 'environment_health',
      domains: ['environment', 'health'],
      threshold: 0.50,
      pattern: 'environmental-health impact transmission',
      drivers: ['air-pollution-linked respiratory disease surge (pediatric asthma incidence, EPA AQI)', 'drinking-water contamination health alerts (PFOA / lead)', 'heat-wave mortality elevation', 'wildfire-smoke respiratory-emergency surge', 'chemical-facility-accident health exposure (AWK water-quality→health, ECL cleaning-for-health, WCN waste→health exposure)'],
      options: [
        { label: 'trace environmental-health impact exposure', type: 'analysis' },
        { label: 'investigate air/water-quality → disease transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'agriculture_population' (food-supply pressure) applied to environmental-disaster
      // displacement and pollution-zone migration. Population is the COUPLING (demographics/
      // migration); environment identity stays climate/pollution/natural resources, not demographics.
      id: 'environment_population',
      domains: ['environment', 'population'],
      threshold: 0.45,
      pattern: 'environmental-migration population coupling',
      drivers: ['climate-disaster displacement (hurricane / flood)', 'environmental-contamination-zone population flight', 'agricultural-land-degradation migration pressure', 'air-pollution-zone population turnover', 'environmental-justice community exposure (Superfund / refinery proximity: WCN waste-site population exposure)'],
      options: [
        { label: 'trace environmental-migration exposure', type: 'analysis' },
        { label: 'investigate disaster-displacement / pollution-zone transmission', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'religion_population' (demographic-moral tension) applied to faith-community
      // environmental responsibility. Religion is the COUPLING (faith/moral system); environment
      // identity stays climate/pollution/ecosystems, not theology.
      id: 'environment_religion',
      domains: ['environment', 'religion'],
      threshold: 0.35,
      pattern: 'spiritual-environmental moral coupling',
      drivers: ['religious-institution climate-commitment visibility', 'faith-leader advocacy on environmental justice', 'spiritual-ecological theology adoption', 'indigenous-sacred-site environmental-damage', 'religious-community climate-migration displacement'],
      options: [
        { label: 'investigate spiritual-environmental moral coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'agriculture_population' / 'religion_population' (labor-supply / demographic
      // pressure) applied to logistics labor. Population is the COUPLING (labor supply);
      // supplyChain is logistics operations, not demographics.
      id: 'population_supplyChain',
      domains: ['population', 'supplyChain'],
      threshold: 0.45,
      pattern: 'logistics labor-supply transmission',
      drivers: ['migrant-worker visa restriction (H-2B cap exhaustion)', 'border-crossing delay reducing cross-border-driver availability', 'port-automation layoffs displacing casual labor', 'distribution-hub labor-availability decline', 'international-labor-movement barriers (JBHT driver-availability stress, CHRW international-labor-supply pressure, DSDVY logistics workforce composition)'],
      options: [
        { label: 'trace logistics labor-supply exposure', type: 'analysis' },
        { label: 'investigate visa / cross-border-driver constraint', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'industry_economy' (output-cycle contraction) applied to direct
      // industry↔supplyChain operational coupling. DISTINCT from 'industry_economy'
      // (macro real-economy): this is manufacturing-capacity → logistics-readiness.
      // Industry is the COUPLING (production output); supplyChain is logistics operations.
      id: 'industry_supplyChain',
      domains: ['industry', 'supplyChain'],
      threshold: 0.50,
      pattern: 'manufacturing-logistics readiness transmission',
      drivers: ['manufacturing-capacity utilization peak straining logistics (near-100% inventory surge)', 'manufacturing-employment cliff cascading demand destruction to logistics', 'industrial-output surge requiring inventory/logistics surge', 'industrial-supply-chain services strain (FDX manufacturing-output-dependent volume, XPO industrial-supply-chain services, GXO manufacturing supply-chain spinoff)'],
      options: [
        { label: 'trace manufacturing-logistics readiness exposure', type: 'analysis' },
        { label: 'investigate industrial-output cycle coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Industry pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense/intelligence/trade structure) ──
    // INDUSTRY identity ONLY — manufacturing & industrial production, factory output &
    // capacity utilization, automation & robotics, heavy industry & capital goods,
    // industrial supply chains, machinery & equipment, industrial maintenance. Real
    // industrial-manufacturing tickers (CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK,
    // DOV, GEV) — never fabricated. Each PAIRED domain couples to industry via a
    // POWER/THERMAL, AUTOMATION-TECH, FACILITY, EMISSIONS, POLICY, LEGAL/IP, R&D,
    // WORKFORCE, MATERIAL-INPUT, CAPITAL, LABOR, REPUTATION, or HERITAGE regime;
    // industry's OWN content stays factory output / capacity / automation / equipment /
    // maintenance. DISTINCT from trade (logistics/commerce), economy (macro aggregate),
    // and technology (automation is a coupling, not the identity). Energy oil/gas/grid is
    // NEVER industry's own content — energy is a power/thermal coupling. ADDITIVE — does
    // not touch any validated scoring path. ('industry_economy', 'industry_supplyChain',
    // 'defense_industry', 'intelligence_industry' already cover those couplings.)
    {
      // Direct parity to 'energy_supply' (logistics disruption / fuel supply stress) +
      // 'infrastructure_energy' (dependency coupling) translated to factory power/thermal.
      // Energy is the COUPLING (grid/power consequence); industry identity stays
      // factory load / kiln-furnace-compressor uptime / capacity utilization.
      id: 'industry_energy',
      domains: ['industry', 'energy'],
      threshold: 0.45,
      pattern: 'manufacturing-grid coupling',
      drivers: ['factory peak-demand pricing pressure (energy-intensive load: steel/chemicals/cement)', 'power-outage duration/frequency elevation degrading plant uptime', 'process-cooling water scarcity (kiln/furnace thermal-capacity strain)', 'compressed-air / process-heating bottleneck (CAT/EMR/ETN equipment downtime)', 'backup-generator fuel supply strain under grid-stability stress (HON/GEV power systems)'],
      options: [
        { label: 'map factory power-demand exposure', type: 'analysis' },
        { label: 'investigate thermal / cooling-capacity strain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Direct parity to 'infrastructure_technology' / 'culture_technology' / 'defense_technology'
      // (cyber-physical attack surface) anchored in factory automation / ICS. Technology is the
      // COUPLING (embedded chips/AI/automation systems); industry identity stays factory uptime /
      // capacity / equipment lifecycle — NOT chips/AI/cloud (that's technology's native content).
      id: 'industry_technology',
      domains: ['industry', 'technology'],
      threshold: 0.45,
      pattern: 'factory-automation control-system coupling',
      drivers: ['automation-system outage (PLC/SCADA/ICS failure, ROK/EMR control downtime)', 'robotics-deployment bottleneck degrading cycle-time variance', 'firmware obsolescence in legacy equipment (GE/ITW embedded controllers)', 'zero-day SCADA exposure (actively exploited, CISA KEV) on manufacturing-control protocols', 'industrial-controller chipset lead time (TSM/AVGO supply-chain tech-dependency)', 'AI-predictive-maintenance adoption lag (CAT digital-equipment uptake)'],
      options: [
        { label: 'map ICS/SCADA attack-surface exposure', type: 'analysis' },
        { label: 'trace automation-downtime cycle-time chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_core' / 'finance_core' / 'technology_core' / 'defense_core'
      // (institutional envelope) translated to the manufacturing-facility envelope:
      // utility reliability, building envelope, permitting, deferred-maintenance shadow.
      // Infrastructure is the COUPLING (physical facility); industry identity stays
      // production capacity / equipment replacement / plant uptime.
      id: 'industry_infrastructure',
      domains: ['industry', 'infrastructure'],
      threshold: 0.45,
      pattern: 'manufacturing-facility infrastructure coupling',
      drivers: ['facility utility-system failure (HVAC/power/water/waste downtime)', 'building-envelope deterioration / equipment-installation space constraint', 'facility-permitting delay (zoning / environmental) stalling expansion', 'deferred-maintenance capital shadow (equipment-replacement backlog cost, CAT/DE/HON facility ops)', 'environmental-compliance citation spike with capital unavailable for facility upkeep (EMR/ITW)'],
      options: [
        { label: 'map facility-downtime exposure', type: 'analysis' },
        { label: 'trace deferred-maintenance capital chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'environment_energy' / 'economy_environment' (climate/compliance-regime stress)
      // translated to manufacturing emissions / pollution load. Environment is the COUPLING
      // (emissions/waste/water regime); industry identity stays production output / compliance
      // capital — NOT climate/ecosystem (that's environment's native content).
      id: 'industry_environment',
      domains: ['industry', 'environment'],
      threshold: 0.45,
      pattern: 'manufacturing-emissions pollution-load coupling',
      drivers: ['emissions-compliance cost spike (Clean Air Act / GHGRP industrial inventory)', 'waste-disposal capacity strain (hazardous-waste economics)', 'process-water-use restriction under drought (facility water-stress index)', 'soil/groundwater contamination liability with environmental-violation frequency', 'climate-adaptation capex for flood/heat-resilience on facility location (CAT/GE/MMM/ETN emissions-intensive ops)'],
      options: [
        { label: 'trace emissions-compliance capital exposure', type: 'analysis' },
        { label: 'investigate waste / water-stress coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' / 'infrastructure_governance' (policy-regime stress) applied to
      // industrial regulation & capital allocation: tariffs, standards, antitrust, industrial
      // policy. Governance is the COUPLING (policy regime); industry identity stays input-cost
      // structure / capacity / compliance capital.
      id: 'industry_governance',
      domains: ['industry', 'governance'],
      threshold: 0.50,
      pattern: 'manufacturing-regulation capital-allocation coupling',
      drivers: ['tariff / trade-policy impact on input costs (US ITC rate change)', 'regulatory-standard tightening velocity (emissions/labor/safety, EPA/OSHA/CPSC)', 'antitrust action on industrial consolidation', 'industrial-policy subsidy availability (CHIPS Act / manufacturing-competitiveness grants, DOC/DOE)', 'permitting delay for facility expansion (CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV exposure)'],
      options: [
        { label: 'trace manufacturing-regulation linkage', type: 'analysis' },
        { label: 'investigate tariff / industrial-policy impact', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' / 'finance_law' (enforcement & IP-licensing regime) applied to
      // manufacturing legal / IP. Law is the COUPLING (regulatory/IP regime); industry identity
      // stays product-liability reserve / IP-protection spend / compliance audit.
      id: 'industry_law',
      domains: ['industry', 'law'],
      threshold: 0.45,
      pattern: 'manufacturing-legal IP-licensing coupling',
      drivers: ['product-liability lawsuit surge / recall frequency (NHTSA/CPSC databases)', 'IP-patent dispute / licensing-cost spike (USPTO litigation caseload)', 'labor-law compliance violation (OSHA/DOL enforcement)', 'trade-secret theft (insider threat / foreign acquisition)', 'antitrust investigation / supply-contract dispute escalation (CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK IP-intensive exposure)'],
      options: [
        { label: 'trace product-liability / IP exposure', type: 'analysis' },
        { label: 'investigate trade-secret / antitrust coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'education_research' / 'technology_research' / 'culture_research' (innovation
      // cluster) applied to manufacturing process-improvement. Research is the COUPLING
      // (innovation substrate); industry identity stays process-innovation pipeline /
      // equipment modernization.
      id: 'industry_research',
      domains: ['industry', 'research'],
      threshold: 0.40,
      pattern: 'manufacturing-innovation process-improvement coupling',
      drivers: ['industrial R&D spending volatility (% of revenue)', 'process-patent publication lag (USPTO manufacturing-patent rate)', 'industrial-research partnership stress (universities / national labs, DOE/NIST)', 'process-innovation adoption lag (lean / six-sigma / additive manufacturing)', 'measurement/test-equipment modernization backlog (CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK R&D-intensive)'],
      options: [
        { label: 'trace process-innovation pipeline exposure', type: 'analysis' },
        { label: 'investigate R&D-partnership health', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_education' / 'culture_education' (workforce-pipeline stress)
      // applied to manufacturing skill pipeline. Education is the COUPLING (workforce pipeline);
      // industry identity stays apprenticeship funding / technician-talent acquisition.
      id: 'industry_education',
      domains: ['industry', 'education'],
      threshold: 0.45,
      pattern: 'manufacturing-workforce skill-pipeline coupling',
      drivers: ['vocational-training enrollment decline (NAM/NECA/IEC apprenticeship intake)', 'technician-wage pressure (BLS OES wage-premium elevation)', 'engineer-shortage severity / job-opening duration (unfilled positions)', 'training-equipment obsolescence (outdated CNC/PLC simulators)', 'curriculum-lag in advanced manufacturing (CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK talent competition)'],
      options: [
        { label: 'trace manufacturing-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate apprenticeship / technician shortage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'supplyChain_agriculture' / 'defense_agriculture' (supply-chain input stress)
      // applied to MATERIAL input (distinct from the economy macro layer). Agriculture is the
      // COUPLING (material-input supply); industry identity stays input-cost hedging /
      // substitution R&D.
      id: 'industry_agriculture',
      domains: ['industry', 'agriculture'],
      threshold: 0.45,
      pattern: 'manufacturing-input material-supply coupling',
      drivers: ['commodity-input price spike (steel/aluminum/timber/chemicals, USDA/NYMEX index)', 'agricultural-supply-derived input scarcity (grain-based inputs / bio-plastic feedstock / fertilizer-based process chemicals)', 'seasonal input-demand volatility', 'input-inventory days-of-supply decline (corporate guidance)', 'input-substitution material-cost lag (CAT/DE agricultural-equipment, GE/HON/MMM/EMR/ITW/ETN/PH/ROK material exposure)'],
      options: [
        { label: 'trace material-input cost exposure', type: 'analysis' },
        { label: 'investigate input-substitution lag', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_economy' / 'finance_infrastructure' (credit / capital-structure stress)
      // applied to manufacturing working-capital & equipment financing. Finance is the COUPLING
      // (credit channel); industry identity stays working-capital efficiency / equipment-financing
      // cost / covenant compliance.
      id: 'industry_finance',
      domains: ['industry', 'finance'],
      threshold: 0.45,
      pattern: 'manufacturing-credit capital-structure coupling',
      drivers: ['working-capital stress (inventory-financing gap / payables stretch, working-capital-days trend)', 'capital-equipment financing tightening (syndicated-loan / LBO spread widening)', 'covenant-breach risk (debt-service-coverage pressure, credit-rating headroom)', 'M&A / refinancing-risk elevation (maturity concentration)', 'supplier-financing stress (payables extension, CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV capital-intensive exposure)'],
      options: [
        { label: 'trace working-capital / equipment-financing exposure', type: 'analysis' },
        { label: 'investigate covenant / refinancing-risk coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_population' / 'agriculture_population' / 'health_population'
      // (employment / labor-force pressure) applied to manufacturing employment. Population is
      // the COUPLING (labor force); industry identity stays workforce-retention strategy /
      // wage-competitiveness vs automation.
      id: 'industry_population',
      domains: ['industry', 'population'],
      threshold: 0.50,
      pattern: 'manufacturing-employment labor-force coupling',
      drivers: ['manufacturing-employment trend (job losses/gains, BLS PAYEMS by industry)', 'workforce-composition shift (age/skill)', 'unemployment-rate spike in manufacturing regions (BLS LAUS)', 'manufacturing-wage premium erosion (BLS OES)', 'migration-out-of-manufacturing-region / labor-force-participation decline (CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV regional dependency)'],
      options: [
        { label: 'trace manufacturing-employment exposure', type: 'analysis' },
        { label: 'investigate regional labor-force coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_culture' (narrative fragmentation) applied to manufacturing
      // reputation / brand risk. Communication is the COUPLING (narrative/media channel);
      // industry identity stays brand reputation / supply-chain transparency.
      id: 'industry_communication',
      domains: ['industry', 'communication'],
      threshold: 0.45,
      pattern: 'manufacturing-reputation brand-risk coupling',
      drivers: ['product-quality-issue public disclosure (recalls / outages, news-volume tracking)', 'supply-chain-disruption negative-vendor news', 'environmental-incident news (pollution / accident)', 'labor-dispute narrative amplification (strike / wage pressure, social-media discourse)', 'cyber-incident / IP-theft disclosure (CAT/DE/GE/HON/MMM/EMR/ITW/ETN/PH/ROK/DOV reputation-sensitive)'],
      options: [
        { label: 'trace brand-reputation exposure', type: 'analysis' },
        { label: 'investigate recall / labor-dispute narrative coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_economy' / 'culture_governance' (second-order cultural expression)
      // applied to manufacturing cultural identity. Culture is the COUPLING (heritage / artisanal
      // / maker identity); industry identity stays heritage-site / artisanal-brand / regional
      // marketing. [LOWER PRIORITY — speculative / second-order.]
      id: 'industry_culture',
      domains: ['industry', 'culture'],
      threshold: 0.40,
      pattern: 'manufacturing cultural-identity coupling',
      drivers: ['manufacturing-heritage-site preservation pressure (local preservation societies)', 'artisanal-manufacturing market growth (maker-movement premium)', 'regional-identity attachment to industrial legacy', 'craft / precision-manufacturing brand premium (ROK automation, ITW specialty, EMR industrial-precision)'],
      options: [
        { label: 'investigate manufacturing cultural-identity feedback', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Governance pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense/intelligence/trade/industry/environment structure) ──
    // GOVERNANCE identity ONLY — government & public administration, public policy &
    // rulemaking, regulation & oversight, elections & democratic institutions, public
    // finance & budgets, rule-of-law & institutional integrity, public-services delivery,
    // political stability & legitimacy. Governance binds mostly to INSTITUTIONS & INDICATORS,
    // not single companies; where entities are needed use REAL govtech / public-sector
    // identifiers (TYL Tyler Technologies, MMS Maximus, BAH Booz Allen, LDOS Leidos, ACN
    // Accenture, GDIT) and policy/governance indices (World Bank WGI, V-Dem, OECD, GAO, CBO,
    // Federal Register, FSOC, FISA court, IG reports) — never fabricated. Governance is the
    // POLICY-TASKING / RULEMAKING / OVERSIGHT / LEGITIMACY / PUBLIC-FINANCE source in each
    // pair, NOT the paired domain's own content. Kept DISTINCT from economy (macro aggregate),
    // finance (capital markets/credit/banks), law (judicial / legal-system is the law domain),
    // and intelligence (collection/analysis/espionage). Energy oil/gas/grid is NEVER
    // governance's own content. ADDITIVE — does not touch any validated scoring path.
    // ('governance_economy', 'law_governance', 'intelligence_governance', 'defense_governance',
    // 'environment_governance', 'governance_supplyChain', 'governance_technology',
    // 'infrastructure_governance', 'industry_governance', 'culture_governance' already cover
    // those couplings; the rules below add the MISSING institutional-capacity & legitimacy paths.)
    {
      // Mirrors 'defense_governance' (policy-stress) + 'intelligence_governance' (info-policy loop)
      // anchored in INTELLIGENCE-OVERSIGHT institutional capacity: collection-authorization vs
      // oversight-effectiveness vs clearance-investigation backlog. Governance is the policy-tasking
      // SOURCE (priorities, FISA reauthorization, transparency demand); intelligence is the
      // collection target/coupling, NOT governance's own content. DISTINCT from the basic
      // 'intelligence_governance' loop (data-integrity / surveillance-state tension).
      id: 'intelligence_governance_oversight',
      domains: ['intelligence', 'governance'],
      threshold: 0.42,
      pattern: 'intelligence-oversight institutional-capacity coupling',
      drivers: ['collection-authorization vs capability gap (policy-tasking & priority misalignment)', 'oversight-effectiveness vs transparency-demand tension (Congressional intelligence-committee oversight-hearing frequency, IG oversight-findings surge)', 'FISA reauthorization-cycle status / FISA-court petition volume', 'clearance-investigation backlog vs threat escalation (security-clearance throughput, BAH/LDOS clearance-investigation capacity)', 'foreign-policy constraint escalation on collection priorities', 'public-trust credibility feedback (FOIA-litigation counts, GAO delays, declassification-pressure cadence)'],
      options: [
        { label: 'trace intelligence-oversight capacity exposure', type: 'analysis' },
        { label: 'investigate FISA-reauthorization / clearance-backlog coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'religion_population' (demographic-legitimacy tension) + 'governance_economy'
      // (institutional feedback) anchored in INSTITUTIONAL-LEGITIMACY transmission: public
      // confidence → voter-turnout stress → policy-prioritization fragmentation → institutional
      // incoherence. Governance is institutions↔legitimacy; DISTINCT from culture↔population
      // (taste/identity). Population is the COUPLING (legitimacy/service-quality feedback), not
      // governance's own content. Real public-sector service-delivery vendors where needed.
      id: 'population_governance',
      domains: ['population', 'governance'],
      threshold: 0.45,
      pattern: 'institutional-legitimacy transmission',
      drivers: ['public-confidence collapse (approval-rating tracking, Pew/Gallup public-satisfaction surveys, World Bank WGI voice-and-accountability)', 'electoral-accessibility stress (voting-age registration-rate delta, turnout anomaly, early-vote / registration metrics)', 'public-service equity gap (healthcare-access / education-access inequality, infrastructure-maintenance equity disparity, GAO service-delivery audits, MMS/TYL service-platform throughput)', 'food-security equity feedback in service delivery', 'policy-prioritization fragmentation under legitimacy erosion (V-Dem electoral-democracy index, agency-responsiveness benchmarks)'],
      options: [
        { label: 'trace institutional-legitimacy exposure', type: 'analysis' },
        { label: 'investigate turnout-stress / service-equity coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'environment_governance' (policy-transmission) + 'infrastructure_governance'
      // (regulatory/funding stress) applied to PUBLIC-HEALTH POLICY coordination: health-system
      // capacity stress → regulatory-enforcement pressure → policy-coordination friction →
      // institutional incoherence. Governance is the policy-tasking / regulatory regime (HHS
      // direction, FDA/CMS enforcement); health is the system coupling, not governance's content.
      id: 'health_governance',
      domains: ['health', 'governance'],
      threshold: 0.50,
      pattern: 'public-health policy-coordination coupling',
      drivers: ['HHS policy-guidance clarity / revision cadence', 'state health-policy adoption-cycle stress', 'CMS regulatory-action count / healthcare-system regulatory burden', 'pandemic-preparedness mandate vs health-system readiness (CDC / state health-assessment reports)', 'health-equity policy-adoption friction', 'public-health-agency coordination stress (HHS/CDC inter-agency policy-coordination, GAO health-program audits)'],
      options: [
        { label: 'trace public-health policy-coordination exposure', type: 'analysis' },
        { label: 'investigate HHS / CMS regulatory-coordination coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_law' (regulatory-coupling) + 'governance_economy' (policy-market feedback)
      // anchored in FINANCIAL-REGULATORY policy regime: governance policy-shift → financial-
      // regulatory uncertainty → capital-market repricing → credit-condition contagion → macro
      // drag. Governance is the policy / fiscal-authority / oversight regime; finance (capital
      // markets/credit/banks) is the coupling, NOT governance's content. DISTINCT from isolated
      // credit stress ('finance_economy') or regulatory burden ('finance_law').
      id: 'finance_governance',
      domains: ['finance', 'governance'],
      threshold: 0.48,
      pattern: 'financial-regulatory policy-credibility coupling',
      drivers: ['central-bank policy-clarity stress (Fed policy-clarity metrics, Treasury yield-curve signal)', 'prudential-supervision authority / bank-supervision enforcement-action cadence', 'systemic-risk elevation (FSOC elevated-threat cadence, deposit-insurance credibility)', 'capital-requirement enforcement / regulatory-rewrite volume (Federal Register prudential-rule cadence)', 'fiscal-authority credibility (CBO projections, debt-ceiling / appropriation status)', 'regulatory-authority clarity vs financial-stability mandate (co-elevated = systemic-financial-credibility risk)'],
      options: [
        { label: 'trace financial-regulatory credibility exposure', type: 'analysis' },
        { label: 'investigate FSOC / prudential-policy coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Complements the existing 'defense_governance' (deterrence-DOCTRINE/alliance stress) with the
      // GOVERNANCE-SIDE institutional-execution friction: policy-authorization capacity, NDAA
      // clarity, civilian-oversight coherence, budget-timeline. Pattern is procurement-execution
      // feedback: defense readiness stress → policy-authorization pressure → governance-coordination
      // friction → procurement-timeline slip → readiness degradation. ADDITIVE — leaves
      // 'defense_governance' untouched. Surfaces the policy-authorization-capability gap.
      id: 'defense_governance_capacity',
      domains: ['defense', 'governance'],
      threshold: 0.44,
      pattern: 'policy-authorization institutional-capacity stress',
      drivers: ['Congressional authorization delay (defense-committee hearing frequency, continuing-resolution exposure)', 'NDAA clarity gap (Federal Register defense-rule / authorization-document volume)', 'civilian-military coordination friction (civilian-oversight board effectiveness)', 'budget-constraint on doctrine implementation (CBO defense-outlay projections, procurement-timeline coherence)', 'IG oversight-findings surge on DoD (GAO DoD-program audits)', 'institutional-execution friction when defense elevated but governance/law/intelligence proxy-heavy (policy-authorization-capability gap)'],
      options: [
        { label: 'trace policy-authorization capacity exposure', type: 'analysis' },
        { label: 'investigate NDAA-clarity / oversight-coordination coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Complements the existing 'law_governance' (one-directional regulatory burden) with the
      // REVERSE institutional-integrity binding: governance → law enforcement-capacity stress
      // (underfunded courts, docket backlog) AND law → governance policy-clarity constraint
      // (constitutional / deference doctrine). Both elevated = institutional-incoherence cascade.
      // ADDITIVE — leaves 'law_governance' untouched. Law identity stays judicial/legal-system;
      // governance stays policy-coordination / institutional oversight / public administration.
      id: 'law_governance_integrity',
      domains: ['law', 'governance'],
      threshold: 0.46,
      pattern: 'institutional-integrity bidirectional coupling',
      drivers: ['legal-enforcement capacity stress (federal/state court docket aging & delays, DOJ enforcement / staffing backlog)', 'regulatory-litigation volume consuming enforcement capacity (regulatory-litigation appeals surge)', 'policy-incoherence → conflicting enforcement directives (regulatory-fragmentation, IG audit backlogs)', 'constitutional-constraint / judicial-deference doctrine limiting policy clarity', 'policy-revision cadence vs enforcement throughput (Federal Register clarity metrics)', 'both elevated = institutional-incoherence cascade (policy-execution constraint ↔ enforcement-backlog feedback)'],
      options: [
        { label: 'trace institutional-integrity feedback exposure', type: 'analysis' },
        { label: 'investigate docket-backlog / policy-coherence coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Agriculture pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense/intelligence/trade/industry/environment/governance structure) ──
    // AGRICULTURE identity ONLY — farming & crops, livestock & animal protein, agribusiness &
    // food production, food security & supply, fertilizers & crop inputs, irrigation &
    // agricultural water, commodity crops (corn/soy/wheat), agricultural technology & precision
    // ag, farm economics. Real agriculture tickers (ADM, BG, CTVA, DE, NTR, MOS, CF, TSN, CAG,
    // INGR, AGCO, FMC) + ag commodity refs (CBOT corn/soy/wheat, USDA WASDE) — never fabricated.
    // Each PAIRED domain couples to agriculture via an INPUT-ENERGY, CREDIT, AUTOMATION-TECH,
    // R&D, LEGAL/COMPLIANCE, POLICY, WORKFORCE, EPIDEMIOLOGY, NARRATIVE, HERITAGE, or MORAL
    // regime; agriculture's OWN content stays farming / crops / livestock / inputs / food
    // production. Energy oil/gas/grid is NEVER agriculture's own content — biofuel feedstock &
    // fertilizer-energy is a COUPLING. Kept DISTINCT from environment (land/water/climate is a
    // coupling), trade (export logistics is a coupling), and economy (food prices is a coupling).
    // ADDITIVE — does not touch any validated scoring path. ('agriculture_population',
    // 'supplyChain_agriculture', 'economy_agriculture', 'infrastructure_agriculture',
    // 'defense_agriculture', 'intelligence_agriculture', 'environment_agriculture',
    // 'industry_agriculture' already cover those couplings.)
    {
      // Mirrors 'energy_supply' (fuel commodity transmission) + 'infrastructure_energy' (grid
      // demand). Agriculture couples biofuel feedstock supply OUT to energy, and couples
      // energy-input COST (fertilizer synthesis, irrigation electric) IN. Energy is the COUPLING
      // (fuel/fertilizer-energy consequence); agriculture identity stays crops/inputs/farm ops.
      id: 'agriculture_energy',
      domains: ['agriculture', 'energy'],
      threshold: 0.45,
      pattern: 'agriculture-energy input-cost coupling',
      drivers: ['fertilizer cost spike from energy input prices (NH3 synthesis, fuel oil heating: NTR/MOS/CF energy-intensive nitrogen)', 'irrigation energy cost elevation (pump electricity + fuel for diesel rigs)', 'biofuel feedstock demand surge (corn/soy to ethanol/biodiesel, CBOT commodity-price transmission, ADM/BG crush margins)', 'cold-chain energy demand (refrigerated transport + processing facilities, TSN/CAG cold storage)', 'farm equipment fuel cost (diesel tractor fuel, combine harvest fuel: DE/AGCO operating cost)', 'grain-drying energy cost (propane + natural gas for corn/wheat drying, USDA WASDE harvest moisture)'],
      options: [
        { label: 'trace fertilizer / fuel input-cost exposure', type: 'analysis' },
        { label: 'investigate biofuel feedstock demand coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_economy' (credit-tightening transmission) + 'finance_infrastructure'
      // (capital unavailable for deferred maintenance). Agriculture's working-capital access +
      // deferred-equipment financing couples to macro credit conditions. Finance is the COUPLING
      // (credit channel); agriculture identity stays farm income / collateral / debt service.
      id: 'agriculture_finance',
      domains: ['agriculture', 'finance'],
      threshold: 0.50,
      pattern: 'farm-credit collateral-repricing coupling',
      drivers: ['farm-credit spread widening (ag-lending prime rate elevation, syndicated-loan stress, AGM Farmer Mac exposure)', 'working-capital line reduction (seasonal commodity-sale financing contraction)', 'commodity-collateral repricing (crop-value decline reducing loan-advance capacity, CBOT corn/soy/wheat)', 'farm-debt-service coverage ratio decline (income / debt-service, USDA ERS farm-income)', 'farm-bankruptcy / debt-restructuring spike (FSA loan-delinquency, Chapter 12 filings)', 'livestock-production credit stress (cattle/dairy borrow-to-feed surge, TSN feed-cost financing)', 'land-collateral repricing (farmland value / REIT portfolio stress for LAND/FPI)'],
      options: [
        { label: 'trace farm-credit / collateral exposure', type: 'analysis' },
        { label: 'investigate working-capital / debt-service coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'technology_infrastructure' (platform strain) + 'defense_technology' (autonomy &
      // precision-systems coupling). Precision ag couples technology hardware/software INTO farm
      // operations; ag data couples INTO weather/yield-prediction research. Technology is the
      // COUPLING (chips/software/automation); agriculture identity stays farm ops / crops / yield.
      id: 'agriculture_technology',
      domains: ['agriculture', 'technology'],
      threshold: 0.45,
      pattern: 'precision-ag automation coupling',
      drivers: ['precision-ag hardware supply (drone/sensor/automation equipment lead-time, DE equipment shortage)', 'genetic-seed R&D & IP licensing lag (CTVA/Bayer biotech pipeline, gene-editing patent delays)', 'autonomous-equipment standardization (tractor/harvester automation platform adoption friction, AGCO interoperability gaps)', 'agricultural-data-integration bottleneck (IoT soil sensor deployment pace, weather-data fusion reliability)', 'satellite-imagery processing lag (NDVI/plant-stress detection, crop-acreage forecasting accuracy)', 'machinery-software update cycle (tractor OS patches, remote-diagnostics uptime, DE/AGCO connected fleet)'],
      options: [
        { label: 'map precision-ag hardware exposure', type: 'analysis' },
        { label: 'investigate autonomous-equipment / data-integration coupling', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'technology_research' (innovation pipeline) + 'education_research' (knowledge
      // infrastructure). Agricultural research produces genetics/agronomy knowledge that couples
      // INTO farm operations. Research is the COUPLING (innovation substrate); agriculture
      // identity stays crops / genetics-deployment / yield.
      id: 'agriculture_research',
      domains: ['agriculture', 'research'],
      threshold: 0.40,
      pattern: 'crop-genetics innovation pipeline coupling',
      drivers: ['crop-genetics research funding pressure (USDA NRCS grant slowdown, university ag-research budget squeeze)', 'yield-improvement innovation pipeline lag (2-5 year breeding cycle delays, gene-editing patent resolution pace)', 'agricultural-science publication rate acceleration (climate-adaptation agronomy, precision-breeding breakthroughs)', 'climate-scenario crop-modeling research gap (yield forecasting under extreme-weather stress, USDA WASDE)', 'drought-tolerance / salt-tolerance genetics commercialization delay (CTVA new-variety rollout timeline)', 'disease-resistance breeding pipeline acceleration (emerging-pest response time, fungicide-resistance breeding, FMC crop-protection R&D)', 'crop-genetics IP pipeline (CRISPR / gene-editing patent backlog, trait-licensing resolution pace, CTVA seed-trait portfolio)', 'precision-ag tech research (IoT field-sensor networks, ML yield-prediction model accuracy, AGCO precision-equipment R&D)', 'soil-carbon research velocity (regenerative-agriculture / soil-microbiome science, carbon-farming measurement-protocol development)', 'agricultural-biotech startup funding scarcity (ag-biotech VC capital gap, gene-editing spinout deep-science financing)'],
      options: [
        { label: 'trace crop-genetics research pipeline exposure', type: 'analysis' },
        { label: 'investigate yield-improvement / climate-modeling gap', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_law' (compliance + liability coupling) + 'defense_law'
      // (regulatory constraint on operations). The agricultural compliance regime (EPA/USDA/state)
      // creates legal-enforcement burden for farm operations. Law is the COUPLING (regulatory/
      // enforcement regime); agriculture identity stays crops / inputs / food production.
      id: 'agriculture_law',
      domains: ['agriculture', 'law'],
      threshold: 0.45,
      pattern: 'agricultural-compliance liability transmission',
      drivers: ['crop-insurance claim dispute rate (coverage denial / payment-delay litigation)', 'pesticide-regulatory compliance cost (EPA label restrictions, dicamba drift liability, neonicotinoid restrictions, FMC/CTVA exposure)', 'water-rights litigation spike (basin-wide drought triggers, riparian-doctrine disputes, groundwater-allocation suits)', 'land-use zoning conflict (agricultural-zoning preservation vs residential expansion, farmland-conservation easement disputes)', 'food-safety liability & recall enforcement (FSMA inspections, pathogen-traceability liability, TSN/CAG Salmonella/E.coli litigation)', 'farm-employment lawsuit risk (labor-wage litigation, contractor-classification disputes, H-2A labor-compliance penalties)'],
      options: [
        { label: 'trace agricultural-compliance liability exposure', type: 'analysis' },
        { label: 'investigate pesticide / water-rights / food-safety enforcement coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'governance_economy' (policy-regime institutional envelope) + 'defense_governance'
      // (policy-authority coupling). The agriculture subsidy & trade regime directly shapes farm
      // income & planting decisions. Governance is the COUPLING (policy/subsidy/trade regime);
      // agriculture identity stays crops / farm income / planting.
      id: 'agriculture_governance',
      domains: ['agriculture', 'governance'],
      threshold: 0.50,
      pattern: 'farm-subsidy trade-policy transmission',
      drivers: ['farm-subsidy policy change (CRP enrollment, USDA payment-program restructuring, conservation-program funding shifts)', 'commodity-price-support program design (crop-insurance subsidy level, commodity-loan programs)', 'tariff & trade-policy impacts (China soybean tariffs, EU sugar quotas, USMCA rule-of-origin on commodity trade, ADM/BG export exposure)', 'agricultural-zoning policy (farmland-preservation mandates, rural development ordinance changes)', 'water-allocation & irrigation-subsidy policy (federal irrigation-water pricing, state groundwater-extraction limits)', 'agricultural-workforce policy (H-2A visa limits, labor-standard enforcement frequency, immigrant-worker policy shifts)'],
      options: [
        { label: 'trace farm-subsidy / trade-policy exposure', type: 'analysis' },
        { label: 'investigate tariff / water-allocation policy coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_education' (workforce-pipeline stress) + 'culture_education'
      // (talent-formation pipeline). Agricultural workforce training couples education INTO farm
      // labor supply. Education is the COUPLING (workforce pipeline); agriculture identity stays
      // farm labor / mechanization-ready operations.
      id: 'agriculture_education',
      domains: ['agriculture', 'education'],
      threshold: 0.45,
      pattern: 'agricultural-workforce skills pipeline coupling',
      drivers: ['agricultural-extension service capacity decline (state funding pressure, agronomist/soil-scientist staffing lag)', 'vocational-agriculture enrollment decline (high-school ag programs closing, FFA membership erosion)', 'precision-ag literacy gap (farmer training in data-analytics, IoT systems, autonomous-equipment operation, DE/AGCO operator training)', 'agricultural-genetics training lag (post-secondary breeding/genetics curriculum expansion vs demand)', 'soil-science / soil-health education gap (sustainable-farming curriculum adoption, carbon-farming training availability)', 'equipment-operator certification backlog (pesticide-applicator certification, heavy-equipment operator training capacity)'],
      options: [
        { label: 'trace agricultural-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate extension-capacity / precision-ag literacy coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'health_research' (clinical/epidemiological coupling) + 'environment_health'
      // (environmental-health enforcement). Agricultural operations have occupational-health
      // (pesticide) and nutritional-access (food supply) coupling to health outcomes. Health is
      // the COUPLING (epidemiology/occupational-health); agriculture identity stays crops /
      // farmworkers / food production.
      id: 'agriculture_health',
      domains: ['agriculture', 'health'],
      threshold: 0.45,
      pattern: 'agricultural occupational-health nutrition coupling',
      drivers: ['pesticide-exposure health impact studies (EPA health assessments, farmworker neurological / reproductive effects, drinking-water contamination)', 'farmworker occupational-health & safety (heat-stress during harvests, pesticide-handler protective-equipment compliance, field-sanitation access)', 'nutrition-security from crop-production disruption (food-price inflation → nutrition-access decline, farm-to-food-bank supply disruption)', 'livestock-disease spillover surveillance (zoonotic-disease emergence risk, dairy/beef pathogen detection, avian-influenza monitoring in poultry, TSN flock exposure)', 'agricultural-product-contamination health events (produce-recall pathogen detection, foodborne-illness outbreak investigation, pesticide-residue testing, CAG/TSN recall exposure)'],
      options: [
        { label: 'trace pesticide-exposure / farmworker-health exposure', type: 'analysis' },
        { label: 'investigate nutrition-security / livestock-spillover coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_communication' (narrative fragmentation) + 'communication_culture'
      // (virality & trend-making). Agricultural-practice narrative (GMO debate, pesticide
      // discourse, supply-chain transparency) shapes consumer purchasing. Communication is the
      // COUPLING (narrative/media channel); agriculture identity stays crops / inputs / food
      // production.
      id: 'agriculture_communication',
      domains: ['agriculture', 'communication'],
      threshold: 0.45,
      pattern: 'agricultural-narrative consumer-trust coupling',
      drivers: ['GMO/pesticide discourse campaign intensity (social-media amplification of anti-ag narratives, influencer food-safety claims, CTVA/FMC reputation exposure)', 'agricultural-supply-chain transparency demand (farm-to-table narrative, supply-chain provenance communication, organic-certification discourse)', 'food-origin & agricultural-practice misinformation (false pesticide claims, non-GMO marketing pressure, "natural" farming narrative adoption)', 'agricultural-worker-condition narrative (fair-trade & labor-standard discourse, corporate-accountability campaigns)', 'climate-adaptation agricultural-practice communication (regenerative-agriculture narrative, carbon-farming claims, sustainable-certification discourse)'],
      options: [
        { label: 'analyze agricultural-narrative ecosystem exposure', type: 'analysis' },
        { label: 'investigate GMO/pesticide discourse / transparency coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_population' (fanbase/audience identity) + 'culture_economy' (venue
      // revenue + creator income). Agricultural heritage and rural-community culture couple into
      // food-narrative identity & agritourism revenue. Culture is the COUPLING (heritage/identity);
      // agriculture identity stays farming / rural-community / food production.
      id: 'agriculture_culture',
      domains: ['agriculture', 'culture'],
      threshold: 0.40,
      pattern: 'agricultural-heritage rural-identity coupling',
      drivers: ['agricultural-heritage loss (farm-community traditions, farmstead architecture preservation, agricultural-craft skills erosion)', 'farmer-identity narrative change (rural-legacy transmission decline, farm-family cultural continuity)', 'food-culture authenticity demand (local-food narrative, agricultural-origin storytelling, farmer-market cultural significance)', 'rural-community cohesion decline (agricultural-extension event participation, county-fair attendance, rural-socialization infrastructure erosion)', 'agritourism & farm-experience commodification (agritourism venue emergence, farm-stay cultural experience, educational farm-tour demand)'],
      options: [
        { label: 'analyze agricultural-heritage / rural-identity exposure', type: 'analysis' },
        { label: 'investigate agritourism / food-culture coupling', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'religion_population' (demographic-moral tension) + 'culture_religion'
      // (cultural-moral identity tension). Religious stewardship doctrine and faith-based
      // agricultural ethics couple into the sustainable-agriculture movement. Religion is the
      // COUPLING (faith/moral system); agriculture identity stays farming / land-stewardship /
      // food production.
      id: 'agriculture_religion',
      domains: ['agriculture', 'religion'],
      threshold: 0.40,
      pattern: 'agricultural-stewardship moral coupling',
      drivers: ['stewardship theology & sustainable-agriculture doctrine (religious-community commitment to regenerative agriculture, carbon-farming faith-based framing)', 'agricultural-labor ethical framework (fair-wages / worker-dignity moral theology, migrant-farmworker pastoral care)', 'pastoral-tradition & agricultural-symbolism (pastoral imagery in scripture, agricultural-calendar religious observances, harvest-blessing ceremonies)', 'food-blessing & sacramental agriculture (Eucharist bread origin, agricultural-product sacramental use, blessing-ceremony agricultural-product focus)', 'religious-community farmland ownership (monastery/temple agriculture, religious-order farming operations, faith-based farmland preservation)'],
      options: [
        { label: 'investigate agricultural-stewardship moral coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Communication pairs (parity port; mirrors energy/infrastructure/culture structure) ──
    // COMMUNICATION identity ONLY — telecommunications & networks, connectivity & broadband,
    // internet infrastructure (towers/fiber/spectrum), media & broadcasting CHANNELS, journalism
    // & news flow, information dissemination, social-media platforms as DISTRIBUTION, public-discourse
    // infrastructure. Real telecom/media tickers (VZ, T, TMUS, CMCSA, CHTR, CSCO, ANET, AMT, CCI,
    // SBAC, NWSA, NYT, META, GOOGL, AMZN, NET, AKAM) — never fabricated. Each PAIRED domain couples
    // to communication via a PHYSICAL-PLANT / PLATFORM / POLICY / CAPITAL / ENFORCEMENT / MACRO /
    // COLLECTION / RESEARCH / DEFENSE / PEDAGOGY regime; communication is NOT that domain's OWN
    // content. DISTINCT from culture (culture = content/movements/scenes; communication = the
    // CHANNELS / networks / information-flow), technology (chips/software is a coupling), and
    // intelligence (signals collection is a coupling). Energy oil/gas/grid is NEVER communication's
    // own content. ADDITIVE — does not touch any validated scoring path. ('communication_culture',
    // 'communication_supplyChain', 'economy_communication', 'intelligence_communication',
    // 'environment_communication', 'industry_communication', 'agriculture_communication' already
    // cover those couplings.)
    {
      // Mirrors 'infrastructure_energy' (dependency coupling / grid strain) → telecom physical-plant
      // resilience. Infrastructure is the ASSET (poles/towers/conduits); communication is the
      // COUPLING (fiber/spectrum/backhaul as connectivity), not the physical real-estate.
      id: 'communication_infrastructure',
      domains: ['communication', 'infrastructure'],
      threshold: 0.45,
      pattern: 'connectivity-infrastructure resilience transmission',
      drivers: ['fiber-cut MTTR elevation (backbone splice-restore lag)', '5G-tower deployment pace stall (small-cell siting backlog, AMT/CCI/SBAC tower-lease cycle)', 'submarine-cable capacity strain (subsea repair-ship queue)', 'backhaul congestion (middle-mile saturation, ANET switch-fabric load)', 'last-mile build-out delay (VZ/T/TMUS/CHTR/CMCSA network capex deferral)'],
      options: [
        { label: 'map connectivity-infrastructure exposure', type: 'analysis' },
        { label: 'investigate fiber/tower-capacity early-warning', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_technology' (distribution-platform strain, codec failure) → media-distribution
      // platform layer (CDNs, APIs, DNS, codec standards). Technology is the COUPLING (chips/software/
      // cloud); communication stays platforms/distribution/information-flow, not the silicon itself.
      id: 'communication_technology',
      domains: ['communication', 'technology'],
      threshold: 0.45,
      pattern: 'media-platform dependency transmission',
      drivers: ['CDN outage (NET Cloudflare / AKAM Akamai edge failover)', 'codec standardization lag (AV1/H.266 adoption velocity)', 'DNS / BGP cascade (route-leak propagation)', 'social-media API stability (META/GOOGL/AMZN platform-API rate-limit / deprecation)', 'streaming-delivery degradation (origin-shield saturation, multi-CDN failover gap)'],
      options: [
        { label: 'map media-platform dependency exposure', type: 'analysis' },
        { label: 'investigate codec / CDN / DNS-cascade detection', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_governance' (permitting delay / regulatory constraint) → spectrum &
      // platform policy regime. Governance is the COUPLING (policy/oversight); communication stays
      // telecom/spectrum/platforms, not the policy apparatus.
      id: 'communication_governance',
      domains: ['communication', 'governance'],
      threshold: 0.50,
      pattern: 'spectrum-policy transmission',
      drivers: ['FCC spectrum-auction policy volatility (band-clearing / re-auction delay)', 'net-neutrality rulemaking reversal (Title II reclassification litigation)', 'telecom-merger antitrust bottleneck (TMUS/VZ/CHTR deal-review friction)', 'broadband-mandate compliance (universal-service obligation cost)', 'digital-platform regulation (EU DSA / UK OSB transmission to META/GOOGL)'],
      options: [
        { label: 'trace spectrum-policy transmission exposure', type: 'analysis' },
        { label: 'investigate net-neutrality / merger bottleneck', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_finance' / 'finance_infrastructure' (capital unavailable, deferred
      // maintenance) → telecom-capex & platform-valuation layer. Finance is the COUPLING (capital/
      // credit/liquidity); communication stays spectrum/fiber/platforms/distribution.
      id: 'communication_finance',
      domains: ['communication', 'finance'],
      threshold: 0.45,
      pattern: 'telecom-capital transmission',
      drivers: ['5G capex refinancing stress (VZ/T/TMUS leverage / dividend-coverage strain)', 'broadband-subsidy funding velocity (BEAD disbursement lag)', 'streaming-platform ad-revenue concentration collapse (META/GOOGL ad-market sensitivity)', 'telecom-debt spread widening (high-yield bond covenant pressure)', 'tower-REIT cost-of-capital shock (AMT/CCI/SBAC rate sensitivity, JPM/BAC/GS/WFC credit exposure)'],
      options: [
        { label: 'trace telecom-capital exposure', type: 'analysis' },
        { label: 'investigate capex refinancing / subsidy dependency', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_law' / 'infrastructure_law' (enforcement-regime stress) → telecom & platform
      // liability. Law is the COUPLING (judicial/enforcement); communication stays telecom/platforms/
      // journalism, not the courtroom.
      id: 'communication_law',
      domains: ['communication', 'law'],
      threshold: 0.45,
      pattern: 'telecom-law enforcement transmission',
      drivers: ['net-neutrality litigation docket growth (circuit-split escalation)', 'platform-liability surge (Section 230 reform / state-law preemption fights)', 'free-speech injunction velocity (compelled-carriage / take-down disputes)', 'trademark/copyright enforcement (DMCA take-down backlog, news-content licensing suits, NWSA/NYT litigation)', 'DNS-seizure backlog (domain-forfeiture enforcement lag)'],
      options: [
        { label: 'trace telecom-law enforcement exposure', type: 'analysis' },
        { label: 'investigate platform-liability / Section 230 impact', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_economy' (transport-access GDP impact / employment cascade) →
      // broadband-access macro demand. Economy is the COUPLING (macro aggregate GDP/inflation/
      // employment); communication stays telecom/broadband/platforms/media. Macro indices ONLY
      // (UNRATE, PCE, FCC broadband stats) — NEVER single-firm tickers in the economy coupling.
      id: 'communication_economy',
      domains: ['communication', 'economy'],
      threshold: 0.50,
      pattern: 'broadband-access macro transmission',
      drivers: ['broadband-adoption employment-opportunity gap (UNRATE divergence by broadband-access region)', 'streaming-consumption elasticity (BEA PCE digital-media-spend detail, CPIAUCSL communication-services index)', 'digital-divide regional GDP drag (FCC broadband-availability stats vs. local output)', 'remote-work connectivity dependency (labor-force participation by broadband tier)', 'telecom-services price pass-through (communication-services CPI to household budget)'],
      options: [
        { label: 'trace broadband-access macro exposure', type: 'analysis' },
        { label: 'investigate digital-divide employment drag', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'intelligence_supplyChain' (collection-targeting of logistics) → collection-targeting
      // of MEDIA-INFRASTRUCTURE / OSINT platforms. Distinct from 'intelligence_communication' (which
      // is narrative-output / influence-attribution); HERE communication-infrastructure IS the
      // collection ASSET. Intelligence is the COUPLING (collection/analysis); communication stays
      // platforms/media/distribution.
      id: 'communication_intelligence',
      domains: ['communication', 'intelligence'],
      threshold: 0.44,
      pattern: 'collection-targeting media-infrastructure transmission',
      drivers: ['OSINT-platform API access degradation (X / Reddit / Discord query-restriction tightening, PLTR OSINT ingest impact)', 'social-media-archive accessibility loss (Wayback Machine / news-archive retrieval gaps)', 'foreign-influence-operation platform-targeting detection velocity (coordinated-network attribution, VRNT SIGINT on comms)', 'spectrum-intelligence SIGINT capacity (signal-collection bandwidth strain, NICE social-media surveillance)', 'media-infrastructure collection-surface change (platform-encryption / closed-API shift)'],
      options: [
        { label: 'trace media-infrastructure collection exposure', type: 'analysis' },
        { label: 'investigate OSINT-API / archive availability coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_research' (creative-innovation) → journalism / media-literacy / information-
      // ecosystem research pipeline. Research is the COUPLING (R&D / knowledge-production);
      // communication stays journalism/media/information-flow, not the academic apparatus.
      id: 'communication_research',
      domains: ['communication', 'research'],
      threshold: 0.40,
      pattern: 'information-ecosystem research transmission',
      drivers: ['journalism-research funding pressure (Knight Foundation / news-innovation grant velocity)', 'media-literacy curriculum-development lag', 'misinformation-detection algorithm publication rate (peer-review cadence)', 'news-archive digitization backlog (newspaper / broadcast-archive access)', 'information-ecosystem research-infrastructure gap (NSF media/information-science grant flow)', 'peer-review system capacity bottleneck (reviewer availability, review-cycle lag, Nature / journal review-queue backlog)', 'preprint-archive growth vs journal-legitimacy crisis (arXiv / bioRxiv server capacity & permanence, preprint-to-journal time lag)', 'scientific-publishing consolidation (Elsevier / Springer market power vs open-access adoption barriers, OpenAlex / open-metadata uptake)', 'impact-factor gaming & predatory-journal proliferation (publication-integrity erosion, citation-metric distortion)'],
      options: [
        { label: 'trace information-ecosystem research pipeline', type: 'analysis' },
        { label: 'investigate misinformation-detection innovation', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_industry' (attrition-driven production stress) → defense's INSTITUTIONAL
      // communication layer (strategic messaging, allied-interoperability, PSYOPS infrastructure).
      // NOT cyber-attack surface (that is tech_defense). Defense is the COUPLING (kinetic/industrial/
      // readiness); communication stays telecom/media/information-flow.
      id: 'communication_defense',
      domains: ['communication', 'defense'],
      threshold: 0.42,
      pattern: 'strategic-communication readiness transmission',
      drivers: ['military-comms modernization delay (tactical-radio / encryption-upgrade schedule slip, LMT/RTX/NOC/GD comms programs)', 'NATO-STANAG compliance timeline lag (allied-interoperability certification)', 'PSYOPS / strategic-messaging platform deployment readiness (BAH/LDOS support-contract throughput)', 'military-streaming / information-access policy friction', 'defense-media-relations staffing shortfall (public-affairs capacity strain)'],
      options: [
        { label: 'assess strategic-communication readiness posture', type: 'analysis' },
        { label: 'trace allied-interoperability / STANAG coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_education' (creative-literacy pipeline) → media-literacy & journalism-training
      // pedagogy. Education is the COUPLING (curriculum/pedagogy/workforce); communication stays
      // journalism/media/information-literacy, not the schoolhouse apparatus.
      id: 'communication_education',
      domains: ['communication', 'education'],
      threshold: 0.45,
      pattern: 'media-literacy pipeline transmission',
      drivers: ['K-12 media-literacy adoption velocity (state-curriculum standard rollout)', 'journalism-school enrollment decline (program-viability pressure)', 'information-literacy university-program gap', 'fact-checking-skills training deficit (workforce-readiness lag)', 'norm-transmission failure in information consumption (critical-evaluation pedagogy erosion)'],
      options: [
        { label: 'trace media-literacy pipeline exposure', type: 'analysis' },
        { label: 'investigate journalism-training / fact-check-skills gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Medicine pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense/intelligence/communication structure) ──
    // MEDICINE identity ONLY — healthcare & medicine, pharmaceuticals & biotech, hospitals
    // & care providers, medical devices & diagnostics, public health & disease control,
    // clinical research & trials, health systems & insurance, drug development. RUNTIME KEY
    // = 'health' (medicine↔health dual-naming via domain-identity.js; PATTERNS use the
    // snapshot/runtime key, so medicine pairs are keyed 'health'). Real healthcare tickers
    // (UNH, JNJ, PFE, MRK, ABBV, LLY, TMO, ABT, MDT, ISRG, HCA, CVS, AMGN, GILD) — never
    // fabricated, never energy oil/gas/grid content. Each PAIRED domain is a COUPLING; the
    // domain's OWN content stays healthcare/pharma/medtech/hospitals/public-health. DISTINCT
    // from science (basic research is the 'health_research' coupling), population (disease-
    // burden demographics is a coupling), and economy (macro is a coupling). ADDITIVE — does
    // not touch any validated scoring path. ('health_research'/'economy_health' already exist.)
    {
      // Mirrors 'finance_infrastructure' (capital unavailable, municipal-bond spread) +
      // 'finance_supplyChain' (liquidity crunch, trade-finance) translated to healthcare:
      // pharma/medtech capex, hospital bond markets, health-insurance leverage cycles.
      id: 'medicine_finance',
      domains: ['health', 'finance'],
      threshold: 0.50,
      pattern: 'healthcare-capital transmission',
      drivers: ['pharmaceutical R&D funding pressure / drug-development capex squeeze (JNJ/PFE/MRK/LLY clinical-trial funding)', 'hospital capital constraint / deferred-maintenance backlog (HCA balance-sheet stress)', 'health insurance industry solvency / medical-loss-ratio pressure (UNH/CI/HUM earnings impact)', 'medtech venture funding contraction / startup financing gap (ISRG/VEEV/NRAD private equity exposure)', 'pharmaceutical patent-cliff cash-flow collapse → R&D reinvestment shortfall'],
      options: [
        { label: 'trace healthcare-capital exposure', type: 'analysis' },
        { label: 'investigate pharma/medtech capex squeeze', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_technology' (cyber-physical attack surface, firmware
      // obsolescence) + 'energy_technology' (compute-demand coupling) translated to
      // healthcare: genomics computing, medtech AI, hospital IT resilience, device hardening.
      id: 'medicine_technology',
      domains: ['health', 'technology'],
      threshold: 0.45,
      pattern: 'healthcare-technology coupling',
      drivers: ['genomics-sequencing compute capacity stress / gene-therapy manufacturing IT lag (TMO sequencing platforms)', 'pharma-AI drug-discovery acceleration / ML-training compute demand (LLY, PFE AI-drug programs)', 'electronic-health-record system outage / hospital IT infrastructure failure (Epic/Cerner cloud platform stress)', 'medical-imaging AI deployment lag / diagnostic-AI model-versioning (ISRG robotic-surgery platform updates)', 'medtech firmware-obsolescence / legacy clinical-device security gap (FDA recalled-device tracking, CVE disclosure velocity on hospital equipment)', 'telemedicine platform availability / telehealth video-conferencing infrastructure (AWS/Azure health-cloud availability)'],
      options: [
        { label: 'map healthcare-technology exposure', type: 'analysis' },
        { label: 'investigate clinical-IT resilience coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'industry_economy' (production-capability stress, capacity-utilization
      // bottleneck) translated to healthcare: pharma/biologics/medtech manufacturing
      // throughput, GMP capacity utilization, outsourced (CMO/CDMO) manufacturing dependency.
      id: 'medicine_industry',
      domains: ['health', 'industry'],
      threshold: 0.50,
      pattern: 'pharmaceutical-manufacturing production stress',
      drivers: ['pharmaceutical manufacturing capacity utilization / drug-production throughput (GMP facility stress, JNJ/PFE/MRK production lines)', 'biologics manufacturing ramp / cell-therapy GMP capacity (monoclonal-antibody manufacturing, ABBV biologics production)', 'generic-drug manufacturing margin compression / volume shift to India/China (pharmaceutical supply-chain concentration)', 'medtech assembly bottleneck / surgical-implant production constraint (ISRG/MDT manufacturing utilization, hip/knee-implant backlogs)', 'contract-manufacturing organization (CMO) capacity / third-party pharmaceutical manufacturing stress (CDMOs, outsourced manufacturing partners)', 'medical-device sourcing / supply-chain component availability (MDT/ABT/ISRG raw-material / subcomponent lead times)'],
      options: [
        { label: 'trace pharma-manufacturing capacity exposure', type: 'analysis' },
        { label: 'investigate GMP / CMO capacity bottleneck', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_core' (permitting/funding/deferred-maintenance) +
      // 'infrastructure_energy' (grid strain, utility-capacity) translated to healthcare:
      // hospital utility-dependency, clinical-facility resilience, cold-chain, biotech labs.
      id: 'medicine_infrastructure',
      domains: ['health', 'infrastructure'],
      threshold: 0.50,
      pattern: 'hospital-infrastructure resilience stress',
      drivers: ['hospital water-main failure / clinical-facility utility outage (emergency-department operational resilience, HCA hospital infrastructure)', 'vaccine-storage cold-chain failure / pharmaceutical-warehouse climate-control loss (CDC vaccine inventory, drug-storage capacity)', 'hospital power-grid dependency / backup-generator capacity strain (surgical-suite uptime, ICU ventilator power)', 'hospital IT data-center facility / Epic-EHR infrastructure site-downtime (clinical-records access, lab-order routing)', 'biotech laboratory facility resilience / R&D facility HVAC/utilities (biohazard containment, cleanroom pressure, equipment environmental controls)', 'telehealth facility infrastructure / remote-care delivery center buildout (video-conferencing bandwidth, clinic space)'],
      options: [
        { label: 'map hospital-infrastructure exposure', type: 'analysis' },
        { label: 'trace cold-chain / facility resilience chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' (compliance burden, enforcement pressure) +
      // 'infrastructure_law' (liability exposure, enforcement action) translated to
      // healthcare: FDA approval coupling, healthcare-compliance, clinical-trial liability.
      id: 'medicine_law',
      domains: ['health', 'law'],
      threshold: 0.45,
      pattern: 'healthcare-regulatory coupling',
      drivers: ['FDA regulatory-approval bottleneck / drug-review-timeline elongation (NDA/ANDA backlog, Hatch-Waxman delays)', 'healthcare-compliance investigation surge / CMS/HHS enforcement-action velocity (Anti-Kickback Statute, Stark Law enforcement)', 'clinical-trial liability exposure / adverse-event litigation cascade (drug-injury class actions, medtech-failure recalls)', 'pharmaceutical-patent litigation / intellectual-property dispute (drug-exclusivity challenges, generic-challenge settlements)', 'healthcare-fraud-investigation backlog / OIG audit-trail integrity (healthcare-claims audit, billing-compliance scrutiny)', 'medical-malpractice settlement reserve / healthcare-liability insurance rate shock (med-mal claim inflation, hospital-liability pressure)'],
      options: [
        { label: 'trace healthcare-regulatory linkage', type: 'analysis' },
        { label: 'investigate FDA-approval / liability coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'energy_supply' (logistics disruption, freight-cost) + 'supplyChain_agriculture'
      // (cold-chain, distribution bottleneck) + 'defense_supplyChain' (embargo, dual-use,
      // rare-earth) translated to healthcare: pharma supply-chain concentration, cold-chain
      // networks, medtech distribution, API sourcing dependency.
      id: 'medicine_supplyChain',
      domains: ['health', 'supplyChain'],
      threshold: 0.50,
      pattern: 'pharmaceutical-logistics transmission',
      drivers: ['pharmaceutical supply-chain disruption / drug-shipment delay (India/China API sourcing, port congestion for pharma exports)', 'medtech logistics bottleneck / surgical-implant distribution constraint (single-use device supply, sterile-packaging availability)', 'cold-chain distribution stress / vaccine/biologics transport failure (ultra-cold supply chain, dry-ice supply, 2-8C/cold-room capacity)', 'generic-drug export embargo / strategic-material dependency (API sourcing from China/India, active-pharmaceutical-ingredient scarcity)', 'medical-device tariff impact / pharmaceutical-import cost elevation (supply-chain tariff exposure, cross-border logistics cost)', 'orphan-drug / rare-disease pharmaceutical sourcing scarcity (limited-manufacturer products, specialized-facility access)'],
      options: [
        { label: 'trace pharmaceutical-supply chain exposure', type: 'analysis' },
        { label: 'monitor cold-chain & API-sourcing conditions', type: 'monitoring' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'agriculture_population' (yield/distribution-demographic pressure) +
      // 'culture_population' (composition/generational shift, participation decay) translated
      // to healthcare: disease-prevalence demographics, aging burden, pandemic mortality.
      id: 'medicine_population',
      domains: ['health', 'population'],
      threshold: 0.50,
      pattern: 'disease-burden population pressure',
      drivers: ['disease-prevalence surge / chronic-disease epidemic (obesity, diabetes, opioid-addiction trend acceleration)', 'aging-population disease burden / elderly care-system strain (Medicare utilization, skilled-nursing facility capacity)', 'pandemic-related mortality surge / infectious-disease outbreak propagation (COVID, influenza, RSV seasonal waves)', 'workforce health decline / occupational-disease emergence (healthcare-worker burnout, environmental-disease cluster)', 'life-expectancy contraction / mortality excess above baseline (CDC/NVSS excess-death reporting, actuarial stress)', 'health-equity disparity widening / social-determinant-driven disease segregation (geographic health inequity, access-to-care gaps)'],
      options: [
        { label: 'analyze disease-burden & population-health indicators', type: 'analysis' },
        { label: 'investigate aging / pandemic mortality coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_energy' (strategic-reserve drawdown) + 'defense_supplyChain'
      // (embargo, dual-use) + 'defense_agriculture' (force-provisioning shock) translated to
      // healthcare: biodefense readiness, medical-supply mobilization, pandemic-response.
      id: 'medicine_defense',
      domains: ['health', 'defense'],
      threshold: 0.48,
      pattern: 'biodefense medical-readiness stress',
      drivers: ['biodefense research-program capacity / pathogen-surveillance readiness (CDC/BARDA biodefense funding, select agent oversight)', 'military medical-capability degradation / combat-casualty care readiness (field-hospital throughput, combat-medic training)', 'pandemic-response stockpile adequacy / medical-supply mobilization lag (Strategic National Stockpile vaccine/PPE reserves, wartime pharmaceutical production)', 'biological-threat assessment / biosecurity intelligence posture (laboratory-safety incident reporting, gain-of-function research oversight)', 'medical-countermeasure development / MCM acquisition-authority modernization (BARDA contract velocity, FDA emergency-authorization pathway)', 'allied force-provisioning medical capacity / NATO medical-readiness interoperability (forward-hospital logistics, casualty-evacuation capability)'],
      options: [
        { label: 'assess biodefense medical-readiness posture', type: 'analysis' },
        { label: 'trace medical-supply mobilization chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'infrastructure_education' / 'culture_education' / 'economy_education'
      // (workforce-pipeline stress, skill mismatch, student-debt) translated to healthcare:
      // medical-workforce pipeline, nursing shortage, physician-training bottleneck.
      id: 'medicine_education',
      domains: ['health', 'education'],
      threshold: 0.45,
      pattern: 'medical-workforce pipeline stress',
      drivers: ['medical-school enrollment / physician-training pipeline lag (AAMC match statistics, GME residency positions)', 'nursing-school capacity constraint / nurse-graduate shortage (Board of Nursing exam pass rates, RN training bottleneck)', 'healthcare-professional burnout / medical-education curriculum stress (physician-training environment, residency work-hour restrictions)', 'medical-education cost inflation / student-debt burden for healthcare professionals (medical-school tuition, loan-repayment pressure)', 'specialty-shortage transmission / mismatch between training capacity and practice demand (psychiatry/primary-care/rural-medicine fellows)', 'continuing-education compliance / healthcare-professional licensing-maintenance stress (CME credit requirements, professional-development funding)'],
      options: [
        { label: 'trace medical-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate nursing/physician shortage coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Education pairs (parity port; mirrors energy/infra/culture/finance/economy/tech/defense/intelligence/trade/industry/medicine structure) ──
    // EDUCATION identity ONLY — schools & universities (K-12 + higher ed), edtech & online
    // learning, student outcomes & literacy, teaching & curriculum, education funding &
    // access/equity, workforce training & skills, credentialing & enrollment, student debt.
    // Real education-sector tickers (CHGG, COUR, DUOL, LRN, ATGE, LOPE, STRA, LAUR, TWOU,
    // UTI) — never fabricated, never energy oil/gas/grid content. Each PAIRED domain is a
    // COUPLING (the sector whose workforce/financing/policy education trains, funds, or
    // serves); education's OWN content stays schools/curriculum/enrollment/credentialing/
    // student-outcomes/training. DISTINCT from science (research is the 'education_research'
    // coupling), population (demographics is a coupling), technology (edtech tooling is a
    // coupling), and economy (workforce is a coupling). ADDITIVE — does not touch any
    // validated scoring path. ('infrastructure_education', 'culture_education',
    // 'economy_education', 'education_research', 'education_supplyChain', 'intelligence_education',
    // 'medicine_education' already cover those couplings.)
    {
      // Mirrors 'defense_technology' (vulnerability-propagation) + 'defense_energy'
      // (sustained-operations exposure) translated to the defense technical-workforce
      // pipeline. Defense is the COUPLING (the sector whose STEM talent / training capacity
      // education supplies); education identity stays enrollment / curriculum / credentialing.
      id: 'defense_education',
      domains: ['defense', 'education'],
      threshold: 0.45,
      pattern: 'military-workforce pipeline stress',
      drivers: ['defense-STEM recruiting shortfall (weapons-systems engineering talent for LMT/RTX/NOC/GD primes, STRA/LOPE workforce programs)', 'ROTC / service-academy enrollment decline (military-workforce intake velocity)', 'acquisition-authority technical-certification gap (program-management credentialing backlog, ATGE skills-training capacity)', 'defense-science university-partnership lag (MIT Lincoln Lab / national-lab fellowship pipeline thinning)', 'security-clearance-eligible graduate scarcity (cleared-workforce training bottleneck)'],
      options: [
        { label: 'trace military-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate defense-STEM recruiting shortfall', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'energy_supply' (logistics disruption) + 'infrastructure_education'
      // (engineer shortage, curriculum lag) translated to the energy-sector workforce.
      // Energy is the COUPLING (the sector whose technicians education certifies); education
      // identity stays apprenticeship / certification / training capacity — NOT grid/oil/gas.
      id: 'energy_education',
      domains: ['energy', 'education'],
      threshold: 0.45,
      pattern: 'energy-workforce pipeline stress',
      drivers: ['clean-energy technician certification bottleneck (solar-installer / IREC credential intake, UTI technical-training capacity)', 'electrical-engineering / power-systems enrollment decline (grid-modernization talent thinning)', 'utility-operator licensing exam pass-rate drag (technician-training capacity strain)', 'lineworker / electrician wage-premium pressure signaling apprenticeship-intake shortfall (IBEW apprenticeship pipeline)', 'legacy oil/gas workforce reskilling lag (energy-transition training-program scale, STRA/LRN reskilling programs)'],
      options: [
        { label: 'trace energy-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate technician-certification bottleneck', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_technology' (fintech-infrastructure coupling) + 'finance_supplyChain'
      // (credit-logistics transmission) translated to the finance-sector workforce. Finance is
      // the COUPLING (the sector whose credentialed staff education certifies); education
      // identity stays credentialing / enrollment / exam pass-rates — NOT capital/credit/banking.
      id: 'finance_education',
      domains: ['finance', 'education'],
      threshold: 0.45,
      pattern: 'finance-workforce credentialing stress',
      drivers: ['CPA / CFA credentialing-pipeline drag (exam pass-rate decline, candidate-flow contraction, COUR/CHGG exam-prep demand)', 'accounting-program enrollment decline (AICPA talent-pipeline thinning)', 'Series 7 / Series 65 exam-registration backlog (financial-advisor credentialing velocity)', 'compliance / AML-specialist training capacity gap (FINRA continuing-education throughput, STRA professional programs)', 'actuarial-science / risk-management graduate scarcity (quantitative-finance talent pipeline)'],
      options: [
        { label: 'trace finance-workforce credentialing exposure', type: 'analysis' },
        { label: 'investigate CPA/CFA pipeline drag', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'governance_technology' (regtech-governance coupling) + 'law_governance'
      // (institutional-envelope stress) translated to the public-sector workforce. Governance
      // is the COUPLING (the sector whose administrators education trains); education identity
      // stays MPA/MGA enrollment / civil-service exam / fellowship throughput.
      id: 'governance_education',
      domains: ['governance', 'education'],
      threshold: 0.45,
      pattern: 'public-administration workforce stress',
      drivers: ['MPA / MGA enrollment decline (public-administration talent-pipeline thinning, Maxwell/Kennedy-School fills)', 'civil-service exam pass-rate / OPM recruitment backlog (agency-staffing intake velocity)', 'regulatory-analyst recruitment gap (EPA/FCC/SEC technical-staff pipeline, STRA/LOPE public-service programs)', 'policy-fellowship pipeline contraction (White House / OECD fellow throughput)', 'Senior-Executive-Service continuity gap (agency-leadership succession / institutional-continuity stress)'],
      options: [
        { label: 'trace public-administration workforce exposure', type: 'analysis' },
        { label: 'investigate civil-service recruitment backlog', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' (regulatory/enforcement stress) translated to the legal-sector
      // workforce. Law is the COUPLING (the sector whose attorneys education trains); education
      // identity stays law-school enrollment / bar-passage / clerkship fills.
      id: 'law_education',
      domains: ['law', 'education'],
      threshold: 0.40,
      pattern: 'legal-workforce pipeline stress',
      drivers: ['law-school enrollment volatility (ABA matriculation trend, applicant-pool swing)', 'bar-exam passage-rate decline by jurisdiction (credentialing bottleneck, CHGG/COUR bar-prep demand)', 'judicial-clerkship / court-administration recruitment gap (legal-workforce intake velocity)', 'legal-aid attorney retention collapse (Legal Services Corporation staffing, access-to-justice pipeline)', 'paralegal / legal-admin training-program capacity strain (LAUR/STRA professional programs)'],
      options: [
        { label: 'trace legal-workforce pipeline exposure', type: 'analysis' },
        { label: 'investigate bar-passage / clerkship gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'technology_core' (institutional-envelope) + 'tech_research' (innovation
      // acceleration via workforce) translated to the technology-sector workforce. Technology
      // is the COUPLING (the sector whose engineers education trains); education identity stays
      // CS/EE enrollment / bootcamp placement / certification throughput — NOT chips/AI/cloud.
      id: 'technology_education',
      domains: ['technology', 'education'],
      threshold: 0.40,
      pattern: 'technology-workforce STEM pipeline stress',
      drivers: ['CS / EE enrollment plateau (NSF/NCES degree-production drag, software-engineer pipeline thinning)', 'coding-bootcamp placement-rate decline / market saturation (job-placement velocity, DUOL/COUR/CHGG learning demand)', 'cybersecurity-certification supply gap (CompTIA / CISSP / ISC2 throughput vs. demand)', 'AI/ML specialist scarcity (graduate-program fills, foundation-model talent pipeline)', 'software-developer wage-premium pressure signaling talent-shortage drag (TWOU/COUR enterprise-reskilling demand)'],
      options: [
        { label: 'trace technology-workforce STEM exposure', type: 'analysis' },
        { label: 'investigate CS/EE pipeline & cert-supply gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Triple-domain: mirrors 'culture_finance_infrastructure' (creator-capital-venue coupling)
      // translated to the biotech-startup workforce node — academic biomedical training
      // (education), venture/biotech financing (finance), and healthcare-product development
      // (health) co-bearing the talent pipeline. Education identity stays graduate-program
      // production / credentialing; finance + health are the couplings.
      id: 'health_finance_education',
      domains: ['health', 'finance', 'education'],
      threshold: 0.46,
      pattern: 'biotech-startup workforce-capital coupling',
      drivers: ['chemistry / pharmacology PhD production drag entering biotech (graduate-program fills, drug-discovery talent pipeline)', 'medical-device engineering enrollment gap (mechanical-engineering pipeline for device-startup financing)', 'bioinformatics / computational-biology specialist scarcity (program throughput vs. venture-backed demand)', 'clinical-research-associate (CRA) recruitment gap from allied-health programs (LOPE/ATGE health-professions training)', 'biotech-venture funding contraction tightening academic-research-to-startup talent flow (research-grant-to-commercialization pipeline)'],
      options: [
        { label: 'trace biotech-startup workforce-capital exposure', type: 'analysis' },
        { label: 'investigate research-to-startup talent flow', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Triple-domain: mirrors 'culture_finance_infrastructure' (triple coupling) anchored to
      // the academic-security node — collection-targeting (intelligence), visa/IP legal regime
      // (law), and researcher-security training (education) co-bearing the surface. Education
      // identity stays curriculum / vetting-throughput / academic-integrity training;
      // intelligence + law are the couplings.
      id: 'intelligence_law_education',
      domains: ['intelligence', 'law', 'education'],
      threshold: 0.44,
      pattern: 'academic-security intelligence-law coupling',
      drivers: ['foreign-student security-vetting backlog (enrollment-background-investigation velocity, LDOS/BAH vetting services)', 'academic-IP-theft enforcement gap (DOJ IP-prosecution + university-counsel coordination lag)', 'researcher security-clearance / facility-access vetting backlog (NSF/DOE sensitive-program access)', 'research-ethics & IP-protection curriculum lag (academic-integrity training throughput, STRA/LOPE compliance programs)', 'CFIUS review of foreign academic partnerships (sensitive-field collaboration-screening timeline extension)'],
      options: [
        { label: 'trace academic-security exposure', type: 'analysis' },
        { label: 'investigate foreign-vetting / IP-enforcement coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_population' (composition/generational shift) + 'agriculture_population'
      // (supply-demand pressure) translated to the demographic-education transmission. Population
      // is the COUPLING (cohort composition driving demand); education identity stays K-12 /
      // university enrollment-cohort & training-demand — NOT demographics/disease-burden itself.
      id: 'population_education',
      domains: ['population', 'education'],
      threshold: 0.45,
      pattern: 'demographic-enrollment transmission',
      drivers: ['K-12 enrollment volatility (Census cohort-aging forecast, district-consolidation pressure)', 'university-bound cohort contraction (18-year-old population projection / demographic-cliff undergrad squeeze, LAUR/STRA/LOPE enrollment exposure)', 'graduate-program demand vs. shrinking cohort size (higher-ed cost-structure stress)', 'aging-driven career-shift training demand (reskilling-cohort surge, COUR/CHGG/TWOU adult-learner demand)', 'skill-demand forecast mismatch (cohort-aging vs. STEM/healthcare workforce-training pipeline)'],
      options: [
        { label: 'trace demographic-enrollment exposure', type: 'analysis' },
        { label: 'investigate demographic-cliff cohort squeeze', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'culture_religion' (cultural-moral identity tension) + 'religion_population'
      // (demographic-moral tension) translated to the religious-education institutional coupling.
      // Religion is the COUPLING (the faith institutions operating schools); education identity
      // stays seminary / religious-school enrollment & funding / educator-workforce capacity.
      id: 'religion_education',
      domains: ['religion', 'education'],
      threshold: 0.40,
      pattern: 'faith-education institutional stress',
      drivers: ['seminary enrollment decline (ATS theological-school matriculation contraction)', 'religious-school K-12 enrollment & funding strain (NCES religious-sector data, parochial-school closure spike)', 'divinity-school / theological PhD production drag (clergy-educator pipeline thinning)', 'religious-studies university enrollment decline (comparative-religion / religious-literacy program contraction)', 'interfaith-education & religious-literacy curriculum-adoption lag (teacher-training capacity for religious literacy)'],
      options: [
        { label: 'trace faith-education institutional exposure', type: 'analysis' },
        { label: 'investigate seminary / religious-school decline', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Population pairs (parity port; mirrors energy/infra/culture/finance/economy structure) ──
    // POPULATION / DEMOGRAPHIC identity ONLY — demographics & population dynamics, migration
    // & immigration, urbanization & settlement, fertility & mortality, aging & generational
    // shifts, labor-force & human-capital supply, household formation & housing demand,
    // social structure & inequality. Population binds mostly to INDICATORS (US Census, ACS,
    // UN World Population Prospects, Pew Research, BLS, IRS migration) — NOT single-company
    // tickers; where demographic-exposed entities are needed, only real proxies (WELL/VTR
    // senior-living REITs; housing/migration-exposed names). Each PAIRED domain is the
    // COUPLING; population's OWN content stays demographics/settlement/migration/aging/
    // household-formation/inequality. DISTINCT from economy (labor MARKET is a coupling),
    // medicine (mortality/health is a coupling), education (enrollment is a coupling), and
    // governance (legitimacy is a coupling). NEVER energy oil/gas/grid content. ADDITIVE —
    // does not touch any validated scoring path. (population_supplyChain / population_governance
    // / population_education / *_population already cover those couplings.)
    {
      // Mirrors 'agriculture_population' (supply-demand settlement pressure) + 'environment_population'
      // (displacement/migration) translated to the BUILT-ENVIRONMENT settlement & household channel:
      // urbanization → housing-demand → infrastructure capacity/permitting stress. Infrastructure is
      // the COUPLING (capacity/permitting); population identity stays settlement & household formation.
      id: 'population_infrastructure',
      domains: ['population', 'infrastructure'],
      threshold: 0.50,
      pattern: 'urbanization-infrastructure capacity coupling',
      drivers: ['urban-density growth rate / housing-demand surge (Census urban/metro population % change)', 'household-formation rate / housing-unit supply mismatch (Census ACS new-household formation vs housing-completions)', 'internal-migration inflow / local-infrastructure strain (Census IRS tax-return migration signals, ACS in-migration by MSA)', 'aging-in-place housing-adaptation demand / accessibility-infrastructure lag (Census age-composition & disability prevalence, AARP aging-readiness; WELL/VTR senior-housing exposure)', 'gentrification-driven displacement / community-infrastructure dislocation (Census tract demographic turnover, eviction/stability metrics)'],
      options: [
        { label: 'map urbanization-infrastructure capacity exposure', type: 'analysis' },
        { label: 'investigate household-formation / housing-supply mismatch', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'economy_technology' (automation-driven employment displacement / PAYEMS shift) +
      // 'industry_technology' (automation-displacement) translated to POPULATION-LEVEL labor-force
      // composition & skill-readiness. Technology is the COUPLING (automation adoption); population
      // identity stays age-cohort / human-capital supply / skill-readiness — DISTINCT from economy's
      // macro labor MARKET (that's the coupling lens).
      id: 'population_technology',
      domains: ['population', 'technology'],
      threshold: 0.50,
      pattern: 'demographic-automation labor-displacement coupling',
      drivers: ['automation-adoption rate correlated with regional labor-force composition (BLS regional employment by sector vs FRED technological-adoption indices)', 'age-cohort distribution vs retraining-readiness / digital-literacy gap (Census age pyramid / ACS digital-access % by demographic)', 'migration-selectivity bias / brain-drain from automation-exposed regions (Census IRS-return outflow from manufacturing-dense vs tech-hub regions)', 'household-income volatility / skill-wage premium divergence / inequality widening (Census household-income distribution / BLS wage-premium trend)', 'education-credential mismatch vs automation-driven skill-demand shift (Census educational attainment / NSF STEM-degree production vs BLS occupational demand)'],
      options: [
        { label: 'map demographic-automation displacement exposure', type: 'analysis' },
        { label: 'investigate cohort skill-readiness / digital-divide coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'energy_supply' (fuel-cost / supply stress) + 'environment_population' (vulnerable-zone
      // migration) translated to HOUSEHOLD energy-affordability / fuel-poverty vulnerability stratified
      // by demographic group. Energy is the COUPLING (affordability/access); population identity stays
      // demographic vulnerability (age/income/geography) — NEVER oil/gas/grid as its own content.
      id: 'population_energy',
      domains: ['population', 'energy'],
      threshold: 0.45,
      pattern: 'energy-affordability demographic-vulnerability coupling',
      drivers: ['household-energy-cost burden by income quintile / fuel-poverty prevalence (EIA residential-energy-expenditure survey by income)', 'aging-population heating/cooling vulnerability / elderly-health risk under energy-access stress (Census age-composition + CDC heat/cold mortality by age)', 'rural-population energy-access scarcity / grid-connectivity gaps (Census rural-population % + EIA rural-electrification access, broadband-proxy)', 'low-income housing stock energy-efficiency deficit / rental-tenant heating-cooling burden (Census housing-unit efficiency distribution, tenant-homeowner gap)', 'climate-migration pressure from energy-cost-shock in vulnerable regions (Census IRS out-migration from high-cost energy regions to lower-cost destinations)'],
      options: [
        { label: 'map energy-affordability vulnerability exposure', type: 'analysis' },
        { label: 'investigate fuel-poverty / aging heating-cooling coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_economy' (credit-tightening / demand loss) + 'finance_systemic' (default
      // cascade) translated to HOUSEHOLD-LEVEL credit stress & wealth-inequality by demographic.
      // Finance is the COUPLING (credit/debt markets); population identity stays household
      // debt-burden / credit-access stratification / wealth-inequality — DISTINCT from economy's
      // macro aggregate.
      id: 'population_finance',
      domains: ['population', 'finance'],
      threshold: 0.50,
      pattern: 'household-debt demographic credit-access coupling',
      drivers: ['household-debt-to-income ratio surge by demographic quintile (Census household-debt distribution / Federal Reserve Consumer Credit data by age/income)', 'student-loan default rate by demographic cohort / education-debt burden (ED National Student Loan Data System delinquency by age-cohort / Census education-attainment debt)', 'mortgage-delinquency stratification by race/ethnicity / credit-access disparity (Federal Reserve mortgage-delinquency by demographic, CFPB lending-discrimination signals)', 'retirement-savings adequacy gap / wealth-inequality expansion (Census household-wealth / retirement-account ownership by age/race)', 'household-credit-access / banking-service access by geography (unbanked/underbanked Census prevalence + FDIC deposit-access by region)'],
      options: [
        { label: 'trace household-debt / credit-access exposure', type: 'analysis' },
        { label: 'investigate student-debt / wealth-inequality coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'law_governance' (compliance/enforcement-regime stress) + 'governance_core'
      // (institutional-legitimacy crisis) translated to POPULATION-LEVEL differential legal-system
      // exposure & access-to-justice stratification. Law is the COUPLING (legal-system/enforcement);
      // population identity stays demographic differential exposure — DISTINCT from governance's
      // institutional-legitimacy lens.
      id: 'population_law',
      domains: ['population', 'law'],
      threshold: 0.45,
      pattern: 'legal-access equity enforcement demographic coupling',
      drivers: ['incarceration rate surge by demographic / criminal-justice disparity (DOJ BJS incarceration rates by race/age, recidivism by demographic)', 'civil-rights violation concentration by geography / racial-discrimination enforcement activity (DOJ civil-rights cases filed + EEOC discrimination charges by demographic)', 'legal-aid attorney availability / access-to-justice gap (Legal Services Corporation legal-aid caseload + ABA legal-access surveys by region/income)', 'immigration-enforcement intensity / deportation-rate by origin demographic (DHS ICE deportation data by country-of-origin / demographic)', 'domestic-violence victimization rate / protective-order backlog by demographic (DOJ NCVS victimization by age/gender, state court protective-order processing)'],
      options: [
        { label: 'trace legal-access equity exposure', type: 'analysis' },
        { label: 'investigate incarceration / civil-rights enforcement coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'communication_core' (media-institutional sustainability) + 'narrative_infrastructure'
      // (attention-fragmentation) translated to POPULATION-LEVEL information-access disparity &
      // digital-divide stratification. Communication is the COUPLING (media/information ecosystem);
      // population identity stays demographic access disparity (race/income/geography/cohort).
      id: 'population_communication',
      domains: ['population', 'communication'],
      threshold: 0.45,
      pattern: 'information-access demographic digital-divide coupling',
      drivers: ['broadband-access disparity by race/income/geography (Census broadband-availability, FCC broadband-deployment gap maps by demographic)', 'digital-literacy gap / social-media-platform usage stratification (Pew Research digital-literacy survey by age/income/education)', 'misinformation-exposure concentration by demographic / information-ecosystem fragmentation (Pew misinformation-exposure surveys by demographic cohort)', 'news-consumption collapse in younger cohorts / generational media-diet shift (Pew news-consumption trends by age-cohort)', 'media-desert underserving rural/low-income populations / local-news collapse by geography (Hussman Institute local-news desert mapping + Census population coverage)'],
      options: [
        { label: 'trace information-access digital-divide exposure', type: 'analysis' },
        { label: 'investigate misinformation-exposure / media-desert coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'knowledge_arc' (research-education-technology knowledge pipeline) + 'education_research'
      // coupling translated to POPULATION-LEVEL human-capital science production & research-equity
      // stratification. Research is the COUPLING (science production / pipeline); population identity
      // stays demographic representation / diversity in the research-labor-force.
      id: 'population_research',
      domains: ['population', 'research'],
      threshold: 0.40,
      pattern: 'research-capacity demographic equity pipeline coupling',
      drivers: ['STEM-degree production by demographic / PhD-program diversity in pipeline (NSF Survey of Earned Doctorates demographic composition by field)', 'postdoctoral researcher diversity / minority-researcher mentorship capacity (NIH K-award / R-award by investigator-race trend)', 'research-opportunity access / NSF-grant award disparity by demographic (NSF grant-success rates by race/gender, NIH funding disparity analysis)', 'immigrant-scientist visa-restriction impact on research-talent supply (NSF Survey of Earned Doctorates foreign-citizen % by field / visa-category)', 'underrepresented-minority attrition in STEM pipeline / leaky-pipeline dynamics (NSF data on minority-student degree-completion rates vs enrollment)'],
      options: [
        { label: 'trace research-equity pipeline exposure', type: 'analysis' },
        { label: 'investigate STEM-diversity / leaky-pipeline coupling', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Research / Science pairs (parity port; mirrors energy/infra/finance/defense structure) ──
    // RESEARCH (science) identity ONLY — basic & applied research, R&D pipelines, academic &
    // lab science, peer review & publication, research funding & grants, scientific instruments
    // & methods, the innovation pipeline. Runtime key is 'research' (snapshotKey; science is the
    // URL/portal alias — see domain-identity.js). Real research-sector tickers (TMO, DHR, A, MTD,
    // WAT, ILMN, BIO, RVTY, BRKR, IQV, ICLR) + research authorities (NSF, NIH, arXiv, Nature,
    // OpenAlex, NASA) — never fabricated, never energy oil/gas/grid content. Each PAIRED domain
    // is the COUPLING; research's OWN identity stays discovery/grants/publication/instruments.
    // DISTINCT from technology (applied product dev = coupling), medicine (clinical research =
    // coupling), education (academic teaching = coupling). ADDITIVE — touches no validated path.
    {
      // Mirrors 'governance_economy' (policy-market feedback) translated to evidence-based
      // policymaking: policy shapes the research agenda; research evidence shapes policy.
      // Governance is the COUPLING (policy/rulemaking authority); research stays grants/inquiry.
      id: 'governance_research',
      domains: ['governance', 'research'],
      threshold: 0.45,
      pattern: 'evidence-based-policy stress',
      drivers: ['research-funding policy shift (NSF grant-making authority, federal science-budget appropriation pressure)', 'science-advisory authority erosion (OSTP / advisory-panel independence, expert-committee staffing gap)', 'Federal Register rulemaking on research compliance (IRB human-subjects rules, data-privacy / data-sharing mandates)', 'governance-tasked research-priority redirection (politically-set agenda vs investigator-driven inquiry)', 'policy-evidence translation lag (peer-reviewed findings vs rulemaking adoption cadence)'],
      options: [
        { label: 'trace governance-research policy linkage', type: 'analysis' },
        { label: 'investigate evidence-to-rulemaking adoption lag', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_supplyChain' (credit-logistics transmission) translated to research
      // capital: grant instruments + deep-science VC funding. Finance is the COUPLING (capital
      // transmission); research stays the spinout / grant-funded discovery pipeline.
      id: 'research_finance',
      domains: ['research', 'finance'],
      threshold: 0.45,
      pattern: 'research-capital transmission',
      drivers: ['grant-award velocity / funding-rate pressure (NSF / NIH payline contraction, award-cycle lag)', 'biotech / cleantech VC funding gap (Series A/B capital for deep-science spinouts)', 'research-commercialization financing scarcity (tech-transfer / lab-to-market capital)', 'research-instrument capital-equipment financing (TMO / DHR / ILMN lab-equipment lease & credit exposure)', 'clinical-trial / CRO working capital (IQV / ICLR trial-financing pressure)', 'research-spinout capital scarcity (deep-science valuation gap, long-horizon ROI discount)'],
      options: [
        { label: 'trace research-capital exposure', type: 'analysis' },
        { label: 'investigate grant / VC funding-gap coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'finance_law' (financial-regulatory coupling) translated to the IP / compliance
      // regime over research. Law is the COUPLING (IP prosecution / enforcement / oversight);
      // research stays the discovery / lab-science pipeline.
      id: 'research_law',
      domains: ['research', 'law'],
      threshold: 0.45,
      pattern: 'IP-institutional stress',
      drivers: ['patent prosecution & IP-protection lag (USPTO patent-issuance backlog, patent-quality erosion on research output)', 'research-compliance burden (IRB review delay, data-privacy / HIPAA enforcement on research data)', 'lab-safety regulation & OSHA enforcement (biosafety / chemical-handling citation pressure)', 'scientific-misconduct investigation capacity (ORI / institutional integrity-office queue time)', 'research-litigation risk (IP-dispute / inventorship litigation, technology-transfer contract disputes)'],
      options: [
        { label: 'trace IP-institutional exposure', type: 'analysis' },
        { label: 'investigate patent-backlog / IRB-delay coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'defense_technology' (vulnerability-propagation / innovation edge) translated to
      // strategic R&D acceleration: DARPA / ONR / AFOSR contract velocity, dual-use research.
      // Defense is the COUPLING (sponsorship / strategic demand); research stays the discovery
      // pipeline. Defense primes (LMT/RTX/NOC/GD) sponsor research — they are couplings here.
      id: 'defense_research',
      domains: ['defense', 'research'],
      threshold: 0.42,
      pattern: 'strategic-R&D stress',
      drivers: ['defense-sponsored research contract velocity (DARPA / ONR / AFOSR award cadence)', 'classified-research pipeline throughput (clearance-gated lab capacity, compartmented-program lag)', 'dual-use technology R&D pressure (materials / computing / sensors for defense applications, RVTY / BRKR instrument supply)', 'technology-transition delay (research-to-program-of-record valley-of-death, prime-sponsored maturation lag, LMT/RTX/NOC/GD)', 'strategic-research advantage erosion (patent-velocity / publication-lead loss to peer competitors)', 'classified-research workforce pipeline (cleared-scientist supply, security-investigation backlog)'],
      options: [
        { label: 'assess strategic-R&D posture', type: 'analysis' },
        { label: 'trace defense-research transition chain', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'energy_technology' (compute-demand grid coupling) translated to energy-transition
      // R&D: battery / grid / renewable / fusion materials science. Energy is the COUPLING
      // (the transition that depends on the research); research stays the materials / modeling
      // / lab-science pipeline. Research instrument vendors (A / MTD / WAT / BRKR) are couplings.
      id: 'energy_research',
      domains: ['energy', 'research'],
      threshold: 0.45,
      pattern: 'energy-innovation stress',
      drivers: ['battery-chemistry & materials-science R&D lag (lithium / solid-state / quantum-dot research, characterization-instrument supply A/MTD/WAT)', 'grid-modeling & simulation research gap (distributed-control / demand-forecasting algorithm accuracy)', 'renewable-energy tech R&D delay (solar-cell efficiency, wind-blade composite materials, deployment-readiness lag)', 'fusion / advanced-reactor research pacing (long-horizon program milestones, NSF / national-lab funding cadence)', 'materials-supply constraint for energy R&D (rare-earth / critical-mineral availability for lab-scale prototyping)'],
      options: [
        { label: 'map energy-innovation exposure', type: 'analysis' },
        { label: 'investigate battery / grid / materials R&D coupling', type: 'discovery' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── LAW institutional-envelope pairs (parity port; mirrors energy/governance/medicine
    // structure) ── LAW identity ONLY — legal system & courts, judiciary & rule of law,
    // litigation & dispute resolution, regulation & compliance, contracts & enforcement,
    // intellectual-property law, criminal justice, legal services & access to justice. Each
    // PAIRED domain is a co-binding (the institution whose legitimacy the legal system stresses
    // when enforcement, litigation and compliance CO-ELEVATE); law's OWN content stays courts/
    // litigation/enforcement/IP/criminal-justice. Real legal-sector identifiers (RELX
    // LexisNexis, TRI Thomson Reuters/Westlaw, VRSK compliance-analytics, VERX tax-compliance,
    // CSGP) + legal authorities/indices (US Courts caseload, ABA, DOJ, SCOTUS, World Justice
    // Project Rule-of-Law Index) — indicator-based, never fabricated, never energy oil/gas/grid.
    // DISTINCT from governance (policy/administration/elections), intelligence, and finance.
    // ADDITIVE — does not touch any validated scoring path. ('medicine_law', 'environment_law',
    // 'communication_law', 'research_law', 'law_education', 'law_governance' already exist as
    // separate couplings.)
    {
      // Mirrors 'defense_infrastructure' (military attack-surface) + 'defense_governance'
      // (deterrence-posture policy) translated to the law↔defense rule-of-law regime: ITAR /
      // arms-control / use-of-force legal constraints on procurement, export licensing and
      // military conduct. Maps to the rule_of_law affinity (law+governance+defense+intelligence).
      id: 'defense_law',
      domains: ['defense', 'law'],
      threshold: 0.43,
      pattern: 'law-defense escalation',
      drivers: ['ITAR / export-control enforcement backlog (weapons-technology transfer risk, DDTC licensing pendency, DOJ National Security Division prosecutions; RELX/TRI export-compliance tooling)', 'arms-control treaty monitoring & compliance pressure (NPT / CTBT enforcement, State Dept verification regime stress)', 'use-of-force legal-authority gaps (war-powers litigation, rules-of-engagement / ROE challenges in federal courts, US Courts caseload)', 'military-contractor compliance burden (DFARS security requirements, False Claims Act defense-procurement enforcement on LMT/RTX/NOC/GD, VRSK/VERX compliance-analytics)', 'international-law-of-war enforcement pressure (ICC / Geneva-Convention litigation, war-crimes docket; World Justice Project Rule-of-Law Index strain)'],
      options: [
        { label: 'trace defense-law regulatory exposure', type: 'analysis' },
        { label: 'investigate export-control enforcement gap', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors the healthcare_core affinity (health+law+governance+finance co-bind) as an
      // institutional-envelope signal: FDA/CMS regulatory burden, compliance litigation and
      // payer-provider enforcement CO-ELEVATE → healthcare institutional-legitimacy crisis.
      // Distinct from 'medicine_law' (transactional single enforcement action). Law identity
      // stays courts/enforcement/compliance; governance/finance are couplings.
      id: 'healthcare_law_core',
      domains: ['health', 'law', 'governance', 'finance'],
      threshold: 0.48,
      pattern: 'healthcare-law institutional envelope',
      drivers: ['FDA approval / compliance backlog surge (drug-lag enforcement gap, warning-letter velocity)', 'CMS coverage / reimbursement litigation (appeals & disputes skyrocketing, administrative-law-judge docket)', 'healthcare-fraud enforcement caseload (False Claims Act velocity, DOJ Health Care Fraud Section, qui tam filings)', 'provider-license suspension / breach-of-contract litigation spike (state medical-board actions, payer-provider disputes)', 'medical-malpractice tort-reform pressure (jury-verdict & settlement trends, US Courts civil caseload)', 'HIPAA / privacy enforcement action volume (OCR breach-penalty velocity, patient-data-breach consequences; RELX/TRI compliance research)', 'hospital / payer consent-decree compliance monitoring (existing enforcement actions intensifying, bond-covenant stress on hospital networks)'],
      options: [
        { label: 'trace healthcare-law institutional exposure', type: 'analysis' },
        { label: 'investigate FDA / CMS / fraud-enforcement co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors the education_core affinity (education+law+governance+finance co-bind) as an
      // institutional-envelope signal: accreditation/Title-IV enforcement, civil-rights and
      // student-debt litigation CO-ELEVATE → education-system legitimacy crisis. Distinct from
      // 'law_education' (workforce-pipeline). Law identity stays courts/enforcement.
      id: 'education_law_core',
      domains: ['education', 'law', 'governance', 'finance'],
      threshold: 0.47,
      pattern: 'education-law institutional envelope',
      drivers: ['accreditor-authority enforcement pressure (loss-of-accreditation threat, recognition-review litigation)', 'Title IV compliance litigation surge (for-profit oversight, gainful-employment rules, ED Office of Inspector General actions)', 'student-rights civil-rights enforcement (discrimination claims, due-process litigation, US Courts caseload)', 'student-debt collection litigation (FCRA violations, predatory-lending claims, CFPB student-debt enforcement)', 'institutional-closure bankruptcy litigation (financial-aid clawback disputes, teach-out obligations)', 'faculty-labor litigation & union enforcement pressure (NLRA, wage-and-hour claims, NLRB docket)', 'state education-law enforcement (charter-authorization revocation, teacher-certification disputes, state attorneys-general litigation; RELX/TRI legal-research demand)'],
      options: [
        { label: 'trace education-law institutional exposure', type: 'analysis' },
        { label: 'investigate accreditation / Title-IV / debt enforcement co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors the research_core affinity (research+law+governance+finance co-bind) as an
      // institutional-envelope signal: patent enforcement, IRB/misconduct oversight and
      // grant-compliance pressure CO-ELEVATE → knowledge-production legitimacy crisis. Distinct
      // from 'research_law' (transactional IP/IRB lag). Law identity stays courts/IP/enforcement.
      id: 'research_law_core',
      domains: ['research', 'law', 'governance', 'finance'],
      threshold: 0.46,
      pattern: 'research-law institutional envelope',
      drivers: ['patent-office backlog & quality-erosion enforcement (USPTO pendency, PTAB inter-partes review velocity, overbroad-patent litigation; RELX/TRI patent-research tooling)', 'IP-theft litigation (university-vs-researcher disputes, hostile acquisition of research programs, inventorship suits)', 'IRB-misconduct enforcement & research-integrity compliance pressure (NSF / NIH Office of Inspector General misconduct investigations, ORI queue)', 'research-compliance litigation (FERPA / HIPAA on research data, export-control on dual-use research, BIS/EAR)', 'grant-fraud & false-certification enforcement (False Claims Act on research grants, DOJ / OIG prosecution)', 'university-patent licensing disputes (Bayh-Dole compliance, tech-transfer litigation)', 'researcher-visa / export-control compliance pressure (OFAC / EAR on foreign researchers, VEVRAA enforcement)'],
      options: [
        { label: 'trace research-law institutional exposure', type: 'analysis' },
        { label: 'investigate patent / misconduct / grant-fraud co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors the technology_core affinity (technology+law+governance+research co-bind) as an
      // institutional-envelope signal: antitrust, IP, data-privacy and securities enforcement
      // CO-ELEVATE → tech-sector legitimacy crisis. Law identity stays courts/antitrust/IP/
      // enforcement; technology/research are couplings (no chips/AI/cloud content in law's core).
      id: 'technology_law_core',
      domains: ['technology', 'law', 'governance', 'research'],
      threshold: 0.47,
      pattern: 'technology-law institutional envelope',
      drivers: ['antitrust litigation (FTC / DOJ Antitrust enforcement against AAPL/MSFT/GOOGL/META, US Courts docket)', 'IP / patent litigation surge (PTAB inter-partes reviews, patent-assertion-entity suits, design-patent disputes; RELX/TRI litigation analytics)', 'cybersecurity-breach / data-privacy enforcement (FTC, state attorneys-general, GDPR / CCPA fines, VRSK compliance-analytics)', 'securities litigation (shareholder suits on data-breach, cybersecurity material-weakness disclosure, SEC enforcement)', 'software-patent validity challenges (patent-quality erosion, overbroad-patent litigation)', 'export-control enforcement on AI / chip tech (EAR / ITAR on semiconductors, BIS foundry-access restrictions, CFIUS reviews)', 'technology-standards regulatory pressure (spectrum policy, platform-liability / Section 230 litigation)'],
      options: [
        { label: 'trace technology-law institutional exposure', type: 'analysis' },
        { label: 'investigate antitrust / IP / privacy enforcement co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors the culture_core affinity (culture+law+governance+communication co-bind) as an
      // institutional-envelope signal: copyright/IP enforcement, heritage litigation, censorship
      // and civil-rights suits CO-ELEVATE → culture-sector legitimacy crisis. Distinct from
      // 'communication_law' (telecom/platform). Law identity stays courts/IP/civil-rights enforcement.
      id: 'culture_law_core',
      domains: ['culture', 'law', 'governance', 'communication'],
      threshold: 0.46,
      pattern: 'culture-law institutional envelope',
      drivers: ['copyright / IP enforcement on creative works (RIAA / MPAA litigation, fair-use disputes, DRM challenges; RELX/TRI rights-clearance research)', 'heritage-site litigation (UNESCO site-damage claims, cultural-property repatriation, cleanup disputes on cultural sites)', 'artists-rights litigation (labor disputes, residual-payment claims, moral-rights / VARA enforcement)', 'censorship / arts-funding civil-rights litigation (NEA funding challenges, First-Amendment exhibit-content disputes)', 'cultural-institution fraud / misconduct enforcement (museum-board malfeasance, grant-misuse investigations, state attorneys-general actions)', 'youth / civil-rights litigation in arts orgs (First-Amendment on educational materials, US Courts civil-rights caseload)', 'hate-speech / incitement platform-liability litigation (venue-as-platform liability, defamation from cultural events)'],
      options: [
        { label: 'trace culture-law institutional exposure', type: 'analysis' },
        { label: 'investigate copyright / heritage / civil-rights co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors 'environment_law' (CERCLA/RCRA liability) extended to environmental-JUSTICE:
      // when enforcement, civil-rights litigation, consent-decree violations and environmental-
      // racism challenges CO-ELEVATE → environmental-justice legitimacy crisis. Population
      // vulnerability stratification (vulnerable-group legal standing) is the LOAD-BEARING source
      // dimension. Law identity stays courts/enforcement/civil-rights; environment/population couple.
      id: 'environment_justice_law',
      domains: ['environment', 'law', 'population', 'governance'],
      threshold: 0.48,
      pattern: 'environmental-justice institutional envelope',
      drivers: ['environmental-justice civil-rights litigation (disparate-impact under Title VI, Clean Air Act citizen suits, EPA Civil Rights Office docket)', 'community-consent-decree enforcement (EPA-violation suits, communities litigating non-compliance)', 'Superfund / remediation-site civil-rights litigation (disproportionate exposure in low-income zones, CERCLA standing)', 'tribal-sovereignty environmental disputes (Native-lands water rights, mining on reservations, tribal-court litigation)', 'environmental-racism litigation (lead-poisoning, pollution-zone proximity claims, US Courts caseload)', 'selective-enforcement-bias investigations (low-income-vs-affluent enforcement disparity, DOJ Environment & Natural Resources Division)', 'right-to-know / transparency litigation (CERCLA information-access, EPA data-disclosure delays; World Justice Project Rule-of-Law Index strain)'],
      options: [
        { label: 'trace environmental-justice legal exposure', type: 'analysis' },
        { label: 'investigate consent-decree / civil-rights enforcement co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Mirrors the communication_core affinity (communication+law+governance+finance co-bind)
      // as an institutional-envelope signal: press-freedom erosion, platform-liability, broadcast-
      // licensing enforcement and media-merger antitrust CO-ELEVATE → journalism-institutional
      // legitimacy crisis. Distinct from 'communication_law' (telecom/platform transmission).
      // Law identity stays courts/enforcement/defamation; communication/finance are couplings.
      id: 'communication_law_core',
      domains: ['communication', 'law', 'governance', 'finance'],
      threshold: 0.47,
      pattern: 'media-law institutional envelope',
      drivers: ['press-freedom & journalist-protection litigation (subpoena resistance, shield-law enforcement, reporter-imprisonment cases; RELX/TRI legal research)', 'platform-liability litigation (Section 230 interpretation, defamation suits against social platforms)', 'broadcast-licensing & spectrum enforcement (FCC license revocation, rule-violation forfeitures)', 'media-merger antitrust (DOJ / FTC consolidation review, local-media ownership limits)', 'libel / slander / defamation litigation (rising costs, chilling effect on journalism, US Courts caseload)', 'FOIA / sunshine-law litigation (media suing for government-transparency access)', 'digital-media tax / regulation litigation (state social-media regulation, platform ad-revenue tax challenges)'],
      options: [
        { label: 'trace media-law institutional exposure', type: 'analysis' },
        { label: 'investigate press-freedom / platform / antitrust co-elevation', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    // ─── Religion pairs (parity port; mirrors energy/culture/population/law structure) ──
    // RELIGION / FAITH identity ONLY — religious institutions & faith communities, belief
    // systems & worldviews, religious practice & affiliation, congregations & houses of
    // worship, spiritual movements, religious freedom & pluralism, secularization &
    // disaffiliation, interfaith dynamics. Religion binds almost ENTIRELY to INDICATORS /
    // INSTITUTIONS (Pew Religious Landscape Study, ARDA Association of Religion Data Archives,
    // Gallup, PRRI, World Values Survey, USCIRF religious-freedom, ATS theological-school data,
    // NCES religious-sector enrollment) — NOT single-company tickers; never fabricate tickers.
    // Each PAIRED domain is the COUPLING; religion's OWN content stays faith/belief/worship/
    // congregation/affiliation. DISTINCT from culture (culture = secular content/scenes), from
    // population (affiliation demographics is the coupling), and from governance (religious-
    // freedom policy is the coupling). NEVER energy oil/gas/grid content. ADDITIVE — does not
    // touch any validated scoring path.
    {
      // Religion is the IDENTITY (faith-community autonomy & legitimacy); law is the regulatory
      // envelope (courts, enforcement, statute) constraining congregation autonomy.
      id: 'religion_law',
      domains: ['religion', 'law'],
      threshold: 0.38,
      pattern: 'religious-liberty-litigation coupling',
      drivers: ['religious-liberty litigation volume (establishment-clause / free-exercise case load, USCIRF & US Courts docket)', 'faith-based-org tax-exempt-status challenges (IRS 501(c)(3) church-status disputes, parsonage-exemption litigation)', 'religious-discrimination enforcement (EEOC faith-bias charges, DOJ Civil Rights Division Title VII / RLUIPA filings)', 'faith-org legal-compliance burden (Pew Global Restrictions on Religion legal-barrier index, land-use / zoning conflicts under RLUIPA)', 'religious-accommodation dispute load (workplace / institutional accommodation litigation, conscience-clause cases)'],
      options: [
        { label: 'trace religious-freedom legal exposure', type: 'analysis' },
        { label: 'investigate faith-org legal-burden coupling', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (congregation viability & faith-institutional legitimacy);
      // governance is the COUPLING — religious-freedom policy & faith-based-services funding.
      id: 'religion_governance',
      domains: ['religion', 'governance'],
      threshold: 0.42,
      pattern: 'religious-freedom-policy coupling',
      drivers: ['religious-freedom index deterioration (Pew Global Restrictions on Religion — Government Restrictions Index & Social Hostilities Index rise)', 'faith-based-services funding volatility (Faith-Based & Neighborhood Partnerships grant flow, federal social-service contracting)', 'religious-school enrollment & funding pressure (voucher-policy shifts, parochial-school public-funding disputes)', 'government-hostility signals (USCIRF Annual Report Tier-1/Tier-2 monitoring, Countries of Particular Concern designations)', 'secularization policy pressure (Gallup / PRRI affiliation decline, declining religious-institution policy trust)', 'interfaith-coalition fragmentation (faith-advocacy network cohesion, civic religious-pluralism strain)'],
      options: [
        { label: 'investigate religious-freedom policy exposure', type: 'analysis' },
        { label: 'trace faith-community institutional resilience', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-org institutional resilience & social-service capacity);
      // finance is the COUPLING — capital access, endowments, giving patterns, nonprofit funding.
      // No tickers — faith-org finance is indicator/institution-based (Pew congregation finances,
      // Giving USA / Lake Institute on Faith & Giving, ECFA accountability data).
      id: 'religion_finance',
      domains: ['religion', 'finance'],
      threshold: 0.40,
      pattern: 'faith-institutional-capital coupling',
      drivers: ['faith-org endowment & asset-allocation stress (Pew congregation financial-health data, denominational endowment drawdown)', 'donor-base fragility (Giving USA religious-giving share decline, generational tithing erosion, Lake Institute on Faith & Giving signals)', 'faith-based-social-service capacity (food banks / housing / family services funding, faith-charity operating-reserve strain)', 'religious-nonprofit solvency & credit access (ECFA-accredited-org liquidity, congregation mortgage / capital-campaign debt)', 'capital-campaign delays (seminary / religious-school construction funding, deferred sanctuary capital projects)'],
      options: [
        { label: 'analyze faith-org financial resilience', type: 'analysis' },
        { label: 'investigate donor-base sustainability', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (belief-system / faith-community understanding); research is the
      // COUPLING — empirical religiosity measurement & knowledge production. Pure indicator base
      // (ARDA data infrastructure, Pew / Gallup / PRRI survey programs, NEH / NSF religion grants).
      id: 'religion_research',
      domains: ['religion', 'research'],
      threshold: 0.35,
      pattern: 'faith-knowledge-production stress',
      drivers: ['religious-studies funding collapse (NEH / NSF religion-research grant contraction, humanities-funding pressure)', 'ARDA database maintenance & continuity (Association of Religion Data Archives infrastructure, longitudinal data-series gaps)', 'theological-scholarship impact & methodology erosion (divinity-school research output, peer-review capacity)', 'empirical-religiosity-research capacity (Pew Religious Landscape Study / Gallup / PRRI survey-program sustainability)', 'secularization-dynamics understanding gap (World Values Survey religion-module coverage, disaffiliation-measurement lag)'],
      options: [
        { label: 'investigate religiosity-research infrastructure', type: 'analysis' },
        { label: 'trace theological-scholarship funding', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-community engagement & spiritual-care capacity); health is
      // the COUPLING — disease burden & care delivery straining congregation capacity.
      id: 'religion_health',
      domains: ['religion', 'health'],
      threshold: 0.38,
      pattern: 'spiritual-care-capacity stress',
      drivers: ['pandemic faith-community closure & disengagement (Pew post-pandemic attendance decline, in-person-worship recovery lag)', 'mental-health crisis vs chaplaincy / spiritual-care capacity (clergy-counseling load, spiritual-care workforce gap)', 'addiction-recovery faith-based-program funding & access (faith-rooted recovery-ministry capacity, referral demand)', 'end-of-life spiritual-care infrastructure (hospital / hospice chaplaincy staffing, palliative spiritual-support access)', 'health-equity faith-community response capacity (congregation health-ministry reach in underserved areas, Pew religion-and-health data)'],
      options: [
        { label: 'investigate faith-community mental-health response', type: 'analysis' },
        { label: 'trace chaplaincy capacity', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-community engagement & belief-transmission); technology is
      // the COUPLING — digital platforms & infrastructure congregations depend on for worship.
      id: 'religion_technology',
      domains: ['religion', 'technology'],
      threshold: 0.36,
      pattern: 'faith-digital-engagement coupling',
      drivers: ['digital-worship platform reliability (livestream / streaming-service dependency for hybrid congregations)', 'online-congregation engagement sustainability (post-pandemic digital-attendance retention, virtual-fellowship drop-off)', 'faith-app adoption & deprecation (devotional / scripture / giving-app continuity, congregation-management software risk)', 'digital-identity & access systems for religious communities (member-database access, online-giving onboarding friction)', 'cybersecurity & data-privacy for faith-community databases (congregation PII exposure, donor-record breach risk)'],
      options: [
        { label: 'investigate online-congregation resilience', type: 'analysis' },
        { label: 'trace digital-worship capacity', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (belief-system coherence & faith narrative); communication is the
      // COUPLING — media platforms & discourse infrastructure carrying faith narrative.
      id: 'religion_communication',
      domains: ['religion', 'communication'],
      threshold: 0.37,
      pattern: 'faith-narrative-integrity coupling',
      drivers: ['anti-religious misinformation & narrative fragmentation (Pew religion-in-media coverage, faith-disinformation spread)', 'faith-leader platform access & authority erosion (clergy public-discourse reach, de-platforming / deamplification risk)', 'interfaith-dialogue media representation (interfaith-coverage balance, religious-pluralism narrative carriage)', 'religious-literacy & canon-transmission gap (media religious-illiteracy, seminary / religious-school narrative-coherence strain)', 'faith-community social-media engagement fragmentation (congregation digital-discourse splintering, algorithmic reach decline)'],
      options: [
        { label: 'investigate faith-narrative resilience', type: 'analysis' },
        { label: 'trace interfaith-dialogue media coverage', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-based social-service capacity); supplyChain is the COUPLING
      // — logistics & material flows faith-charity services depend on.
      id: 'religion_supplyChain',
      domains: ['religion', 'supplyChain'],
      threshold: 0.36,
      pattern: 'faith-social-service logistics stress',
      drivers: ['faith-based-charity logistics constraints (food-bank supply disruption, congregation pantry inventory gaps)', 'mission-supply chains (faith-org humanitarian / relief material flows, cross-border mission logistics)', 'religious-nonprofit supply-chain access (humanitarian aid for displaced congregations, refugee-resettlement supply coordination)', 'disaster-relief supply-chain coordination (faith-org rapid-response capacity, volunteer-logistics surge)'],
      options: [
        { label: 'investigate faith-charity logistics resilience', type: 'analysis' },
        { label: 'trace disaster-relief supply-chain coordination', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-community physical presence & sacred space); infrastructure
      // is the COUPLING — physical plant, utilities & buildings congregations depend on.
      id: 'religion_infrastructure',
      domains: ['religion', 'infrastructure'],
      threshold: 0.35,
      pattern: 'sacred-space-resilience coupling',
      drivers: ['religious-building & worship-space maintenance backlog (aging sanctuaries, deferred capital-repair, heritage-site deterioration)', 'disaster-resilience for sacred sites (flood / fire / seismic exposure of houses of worship, congregation continuity risk)', 'utility access & costs for congregation operations (worship-facility energy / water operating burden)', 'religious-cemetery & burial-infrastructure maintenance (faith-managed burial-ground upkeep, perpetual-care funding strain)'],
      options: [
        { label: 'investigate worship-space capital resilience', type: 'analysis' },
        { label: 'trace heritage-site preservation capacity', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-institutional moral authority & legitimacy); defense is the
      // COUPLING — military readiness, chaplaincy & moral legitimacy.
      id: 'religion_defense',
      domains: ['religion', 'defense'],
      threshold: 0.34,
      pattern: 'faith-military-legitimacy coupling',
      drivers: ['military-chaplaincy capacity & faith-community integration (DoD chaplain-corps staffing, denominational endorser supply)', 'religious-freedom protections for military personnel (servicemember accommodation enforcement, free-exercise compliance in ranks)', 'faith-community positions on military doctrine & alliances (moral-authority erosion on use-of-force questions)', 'faith-based peace-movement influence on deterrence-posture legitimacy (religious civil-society pressure on defense policy)'],
      options: [
        { label: 'investigate military-chaplaincy faith-community resilience', type: 'analysis' },
        { label: 'trace religious-freedom compliance in defense', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    },
    {
      // Religion is the IDENTITY (faith-community trust & belief-system legitimacy); intelligence is
      // the COUPLING — collection, surveillance & insider-trust touching faith communities.
      id: 'religion_intelligence',
      domains: ['religion', 'intelligence'],
      threshold: 0.33,
      pattern: 'faith-surveillance-legitimacy coupling',
      drivers: ['religious-community surveillance & FISA targeting (faith-minority monitoring exposure, mosque / congregation surveillance disputes)', 'faith-based intelligence-community cooperation (community-liaison trust, source-network sensitivity)', 'religious-leader / organization material-support regulations & enforcement (charity terror-finance screening, faith-org compliance burden)', 'faith-community trust erosion & COINTELPRO legacy (perceived unjust surveillance degrading faith-institutional authority)'],
      options: [
        { label: 'investigate faith-community intelligence-authority trust', type: 'analysis' },
        { label: 'trace religious-freedom FISA compliance', type: 'analysis' },
        { label: 'hold', type: 'monitoring' }
      ]
    }
  ];

  // ─── State ───────────────────────────────────────────────────────────────

  var _prevAbove = {};          // curated pairs (index-keyed)
  var _sessionTriggered = {};   // curated pairs (index-keyed)
  var _meshAbove = {};          // mesh pairs + clusters (string-keyed)
  var _meshTrig = {};           // mesh pairs + clusters (string-keyed)
  var _activePatterns = [];
  var _idCounter = 0;
  var _panelEl = null;

  for (var p = 0; p < PATTERNS.length; p++) {
    _prevAbove[p] = false;
  }

  // ─── Mesh config: full-web sensing beyond the curated pairs ───────────────
  var DOMAIN_LIST = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var MESH_THRESHOLD = 0.6;   // any non-curated pair both above this co-stresses (the web)
  var CLUSTER_MIN = 3;        // a shared-driver cluster needs >= N co-affected domains
  var CYBER_RE = /\b(cve|kev|ransomware|vulnerab|exploit|cyber)\b/i;

  function _pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  var _curatedPairKey = {};
  for (var _ci = 0; _ci < PATTERNS.length; _ci++) { _curatedPairKey[_pairKey(PATTERNS[_ci].domains[0], PATTERNS[_ci].domains[1])] = true; }

  // Truth-preferred stress reader (module-scope twin of detect()'s inner reader).
  function _stressOf(domainId, slot, packets) {
    var pk = packets[domainId];
    if (pk && pk.truth && typeof pk.truth.stressScore === 'number') return pk.truth.stressScore;
    if (pk && typeof pk.stressScore === 'number') return pk.stressScore;
    if (slot && typeof slot.brainStress === 'number') return slot.brainStress;
    if (slot && typeof slot.stress === 'number') return slot.stress;
    return 0;
  }
  // A live cyber feed in this domain's sources/feeds, or a cyber keyword in its signals.
  function _cyberHit(slot) {
    var srcs = slot.sources || slot.brainFeeds || slot._channels || [];
    if (Array.isArray(srcs)) {
      for (var i = 0; i < srcs.length; i++) {
        var s = srcs[i]; if (!s) continue;
        var idt = ((s.name || '') + ' ' + (s.label || '')).trim();
        if (s.live !== false && CYBER_RE.test(idt)) return { label: (s.label || s.name || '').slice(0, 60) };
      }
    }
    var sigs = slot.signals || [];
    if (Array.isArray(sigs)) {
      for (var j = 0; j < sigs.length; j++) {
        var t = (typeof sigs[j] === 'string') ? sigs[j] : (sigs[j] && (sigs[j].signal || sigs[j].label) || '');
        if (CYBER_RE.test(t)) return { label: String(t).slice(0, 60) };
      }
    }
    return null;
  }

  // ─── Detection logic ──────────────────────────────────────────────────

  function detect() {
    var domains = window.LIMENDomains || {};
    var audit = window.LIMENSourceAudit || {};
    var packets = (window.LIMENCivilizationAdapter && window.LIMENCivilizationAdapter.getAll())
                || window.LIMENCivilizationPackets || {};
    var newActive = [];

    // Truth-preferred stress reader: brain via packet truth.stressScore wins
    // over the flat LIMENDomains[id].stress (which can be civ-side / older).
    function _truthStress(domainId, slot) {
      var p = packets[domainId];
      if (p && p.truth && typeof p.truth.stressScore === 'number') return p.truth.stressScore;
      if (p && typeof p.stressScore === 'number') return p.stressScore;
      if (slot && typeof slot.brainStress === 'number') return slot.brainStress;
      if (slot && typeof slot.stress === 'number') return slot.stress;
      return 0;
    }

    for (var i = 0; i < PATTERNS.length; i++) {
      var pat = PATTERNS[i];
      var dA = domains[pat.domains[0]];
      var dB = domains[pat.domains[1]];

      var stressA = _truthStress(pat.domains[0], dA);
      var stressB = _truthStress(pat.domains[1], dB);

      // Both domains must be materially elevated
      var isAbove = stressA >= pat.threshold && stressB >= pat.threshold;

      // Factor in trend — co-rising amplifies, divergent dampens
      var trendA = (dA && dA.trend) || 0;
      var trendB = (dB && dB.trend) || 0;
      var coRising = trendA > 0.02 && trendB > 0.02;

      // Factor in source confidence
      var confA = (dA && dA.confidence) || 0;
      var confB = (dB && dB.confidence) || 0;
      var avgConf = (confA + confB) / 2;

      // Compute severity: average stress weighted by confidence
      var rawSeverity = (stressA + stressB) / 2;
      var severity = _clamp(Math.round(rawSeverity * avgConf * 100) / 100, 0, 1);
      // Boost if co-rising
      if (coRising) severity = _clamp(severity + 0.08, 0, 1);

      // Combined confidence from source confidence and co-trend
      var patternConf = _clamp(Math.round(avgConf * (coRising ? 1.1 : 0.9) * 100) / 100, 0, 1);

      // Require 2 consecutive ticks above threshold
      if (isAbove && _prevAbove[i]) {
        // Build drivers from actual domain signals
        var liveDrivers = _buildLiveDrivers(pat, dA, dB);

        var signal = {
          id: pat.id + '_' + (++_idCounter),
          patternId: pat.id,
          domains: pat.domains.slice(),
          pattern: pat.pattern,
          severity: severity,
          confidence: patternConf,
          drivers: liveDrivers,
          options: pat.options,
          stressA: stressA,
          stressB: stressB,
          sourceStatusA: (audit[pat.domains[0]] && audit[pat.domains[0]].status) || 'FALLBACK',
          sourceStatusB: (audit[pat.domains[1]] && audit[pat.domains[1]].status) || 'FALLBACK',
          updated: Date.now()
        };

        newActive.push(signal);

        // Emit only on first trigger per session
        if (!_sessionTriggered[i]) {
          _sessionTriggered[i] = true;
          _dispatch('limen:cross-domain-signal', signal);
          // Also emit legacy event for narrator compatibility
          _dispatch('limen:opportunity-detected', {
            type: 'systemic',
            domains: pat.domains.slice(),
            label: pat.pattern,
            description: pat.domains[0] + ' and ' + pat.domains[1] + ' show correlated stress',
            confidence: patternConf,
            signal: signal,
            timestamp: Date.now()
          });
        }
      } else if (!isAbove) {
        _sessionTriggered[i] = false;
      }

      _prevAbove[i] = isAbove;
    }

    // ── 2) DYNAMIC MESH + 3) SHARED-DRIVER CLUSTER — full-web sensing ──
    _detectMesh(domains, packets, audit, newActive);
    _detectCyberCluster(domains, packets, audit, newActive);

    // Sort by severity descending
    newActive.sort(function (a, b) { return b.severity - a.severity; });
    _activePatterns = newActive.slice(0, 8);

    window.LIMENCrossDomain = {
      active: _activePatterns,
      all: newActive.slice(),
      patterns: PATTERNS,
      timestamp: Date.now()
    };

    _renderPanel();
  }

  function _buildLiveDrivers(pat, dA, dB) {
    var drivers = [];
    // Pull real signals from domain data
    var sigA = (dA && dA.signals) || [];
    var sigB = (dB && dB.signals) || [];
    for (var a = 0; a < sigA.length && drivers.length < 2; a++) {
      drivers.push(sigA[a]);
    }
    for (var b = 0; b < sigB.length && drivers.length < 3; b++) {
      drivers.push(sigB[b]);
    }
    // Fallback to pattern template drivers if no live signals
    if (drivers.length === 0) {
      for (var f = 0; f < pat.drivers.length && drivers.length < 3; f++) {
        drivers.push(pat.drivers[f]);
      }
    }
    return drivers;
  }

  // ─── Mesh + shared-driver cluster (additive; same emit contract) ──────────

  // 2-tick stability + once-per-session emit, string-keyed (mesh/cluster).
  function _considerKeyed(key, isAbove, buildSignal, legacyDesc, newActive) {
    if (isAbove && _meshAbove[key]) {
      var sig = buildSignal();
      newActive.push(sig);
      if (!_meshTrig[key]) {
        _meshTrig[key] = true;
        _dispatch('limen:cross-domain-signal', sig);
        _dispatch('limen:opportunity-detected', {
          type: 'systemic', domains: sig.domains.slice(), label: sig.pattern,
          description: legacyDesc, confidence: sig.confidence, signal: sig, timestamp: Date.now()
        });
      }
    } else if (!isAbove) {
      _meshTrig[key] = false;
    }
    _meshAbove[key] = isAbove;
  }

  // Any non-curated domain pair both above MESH_THRESHOLD = a sensed web strand.
  function _detectMesh(domains, packets, audit, newActive) {
    function status(id) { return (audit[id] && audit[id].status) || 'FALLBACK'; }
    for (var a = 0; a < DOMAIN_LIST.length; a++) {
      for (var b = a + 1; b < DOMAIN_LIST.length; b++) {
        var idA = DOMAIN_LIST[a], idB = DOMAIN_LIST[b];
        if (_curatedPairKey[_pairKey(idA, idB)]) continue;
        var dA = domains[idA], dB = domains[idB];
        var sA = _stressOf(idA, dA, packets), sB = _stressOf(idB, dB, packets);
        var isAbove = sA >= MESH_THRESHOLD && sB >= MESH_THRESHOLD;
        var confA = (dA && dA.confidence) || 0, confB = (dB && dB.confidence) || 0, avgConf = (confA + confB) / 2;
        var sev = _clamp(Math.round(((sA + sB) / 2) * avgConf * 100) / 100, 0, 1);
        _considerKeyed('mesh:' + _pairKey(idA, idB), isAbove,
          _mkMeshSignal(idA, idB, dA, dB, sA, sB, sev, avgConf, status(idA), status(idB)),
          idA + ' and ' + idB + ' co-stressing (mesh)', newActive);
      }
    }
  }
  function _mkMeshSignal(idA, idB, dA, dB, sA, sB, sev, avgConf, statA, statB) {
    return function () {
      return {
        id: 'mesh_' + idA + '_' + idB + '_' + (++_idCounter), patternId: 'mesh:' + _pairKey(idA, idB),
        domains: [idA, idB], pattern: idA + '–' + idB + ' co-stress', mesh: true,
        severity: sev, confidence: _clamp(Math.round(avgConf * 100) / 100, 0, 1),
        drivers: _buildLiveDrivers({ drivers: [] }, dA, dB),
        options: [{ label: 'trace ' + idA + '–' + idB + ' exposure', type: 'analysis' }, { label: 'hold', type: 'monitoring' }],
        stressA: sA, stressB: sB, sourceStatusA: statA, sourceStatusB: statB, updated: Date.now()
      };
    };
  }

  // One live feed (cyber/CISA KEV) elevated across many domains = the convergence.
  function _detectCyberCluster(domains, packets, audit, newActive) {
    var members = [], labels = {};
    for (var k = 0; k < DOMAIN_LIST.length; k++) {
      var id = DOMAIN_LIST[k], slot = domains[id]; if (!slot) continue;
      var hit = _cyberHit(slot);
      if (hit) { members.push(id); if (hit.label) labels[hit.label] = true; }
    }
    var isAbove = members.length >= CLUSTER_MIN;
    _considerKeyed('cluster:cyber', isAbove,
      _mkCyberSignal(members.slice(), Object.keys(labels), domains, packets, audit),
      members.length + ' domains co-stressing on a live cyber threat (CISA KEV)', newActive);
  }
  function _mkCyberSignal(members, labels, domains, packets, audit) {
    return function () {
      function status(id) { return (audit[id] && audit[id].status) || 'LIVE'; }
      var sorted = members.slice().sort(function (x, y) { return _stressOf(y, domains[y], packets) - _stressOf(x, domains[x], packets); });
      var avg = 0; for (var m = 0; m < sorted.length; m++) avg += _stressOf(sorted[m], domains[sorted[m]], packets);
      avg = sorted.length ? avg / sorted.length : 0;
      var sev = _clamp(Math.round((avg * 0.6 + Math.min(1, sorted.length / 8) * 0.4) * 100) / 100, 0, 1);
      var drv = labels.slice(0, 3); if (!drv.length) drv = ['actively exploited CVEs (CISA KEV)', 'critical-infrastructure cyber threat'];
      return {
        id: 'cluster_cyber_' + (++_idCounter), patternId: 'cluster:cyber', cluster: true,
        domains: sorted.slice(), members: sorted.slice(),
        pattern: 'critical-infrastructure cyber convergence', severity: sev, confidence: 0.7, drivers: drv,
        options: [
          { label: 'find companies exposed across ' + sorted.length + ' domains', type: 'discovery' },
          { label: 'trace cyber-infrastructure transmission', type: 'analysis' },
          { label: 'hold', type: 'monitoring' }
        ],
        stressA: _stressOf(sorted[0], domains[sorted[0]], packets),
        stressB: sorted[1] ? _stressOf(sorted[1], domains[sorted[1]], packets) : 0,
        sourceStatusA: status(sorted[0]), sourceStatusB: sorted[1] ? status(sorted[1]) : 'LIVE', updated: Date.now()
      };
    };
  }

  // ─── Systemic Signals panel ──────────────────────────────────────────────

  var _isConsolePage = (function() {
    var p = location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    return p === '' || p === 'civilization' || p === 'connectome';
  })();

  function _ensurePanel() {
    if (!_isConsolePage) return;
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-systemic-panel';
    _panelEl.style.cssText = [
      'position:fixed',
      'top:60px',
      'left:12px',
      'background:rgba(8,9,12,0.92)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:8px 12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.48rem',
      'letter-spacing:1.5px',
      'z-index:9996',
      'border-radius:2px',
      'pointer-events:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.8',
      'min-width:180px',
      'display:none'
    ].join(';');
    document.body.appendChild(_panelEl);
  }

  function _renderPanel() {
    if (!_isConsolePage) return;
    _ensurePanel();

    // Phase 2 Patch B residual — SYSTEMIC SIGNALS panel suppressed to complete
    // the floating-surface removal begun in commits c0d42b6d58a + 564aeb5493b.
    // DOM node preserved via _ensurePanel so ui-mode-manager PANEL_MAP lookups
    // keep resolving. Render output and display:block toggles short-circuited.
    if (_panelEl) _panelEl.style.display = 'none';
    return;

    if (_activePatterns.length === 0) {
      _panelEl.style.display = 'none';
      return;
    }

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.4)';
    var red = '#e85454';
    var orange = '#d4a44e';

    var html = '<div style="color:' + gold + ';font-size:0.50rem;margin-bottom:4px">SYSTEMIC SIGNALS</div>';

    for (var i = 0; i < _activePatterns.length; i++) {
      var pat = _activePatterns[i];
      var sevColor = teal;
      if (pat.severity > 0.65) sevColor = red;
      else if (pat.severity > 0.40) sevColor = orange;

      var sevPct = Math.round(pat.severity * 100);

      html += '<div style="color:' + dim + ';margin-bottom:2px">';
      html += '<span style="color:' + sevColor + '">\u2022</span> ';
      html += '<span style="color:rgba(200,195,184,0.6)">' + pat.pattern + '</span>';
      var confPct = Math.round(pat.confidence * 100);
      html += '<span style="color:' + dim + ';font-size:0.40rem"> ' + sevPct + '%</span>';
      html += '<span style="color:' + dim + ';font-size:0.38rem"> conf:' + confPct + '%</span>';

      // Source status badges + freshness
      var badgeA = pat.sourceStatusA;
      var badgeB = pat.sourceStatusB;
      var badgeColorA = badgeA === 'LIVE' ? teal : (badgeA === 'PARTIAL' ? orange : red);
      var badgeColorB = badgeB === 'LIVE' ? teal : (badgeB === 'PARTIAL' ? orange : red);
      var patFresh = _freshness(pat.updated);
      html += '<br><span style="font-size:0.38rem;color:' + dim + ';margin-left:10px">';
      html += pat.domains[0] + ':<span style="color:' + badgeColorA + '">' + badgeA + '</span>';
      html += ' ' + pat.domains[1] + ':<span style="color:' + badgeColorB + '">' + badgeB + '</span>';
      html += ' \u2022 ' + patFresh;
      html += '</span>';
      html += '</div>';
    }

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-systemic-panel')) {
      return;
    }
    _panelEl.style.display = 'block';
    _panelEl.innerHTML = html;
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    detect();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        window.addEventListener('limen:world-signals-updated', _onDomainUpdate);
        detect();
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      window.addEventListener('limen:world-signals-updated', _onDomainUpdate);
      detect();
    }
  }

  function stop() {
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:world-signals-updated', _onDomainUpdate);
    _activePatterns = [];
    if (_panelEl) _panelEl.style.display = 'none';
  }

  function getActive() {
    return _activePatterns.slice();
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function _freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENCrossDomain = { active: [], patterns: PATTERNS, timestamp: null };

  window.LIMENCrossDomainDetector = {
    start: start,
    stop: stop,
    detect: detect,
    getActive: getActive
  };

})();
