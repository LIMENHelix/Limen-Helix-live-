/**
 * LIMEN HELIX — Domain Registry
 *
 * Canonical 20-domain registry that drives all analyst reporting.
 * Reports start HERE, not from UI cards.
 *
 * Structure:
 *   Global → 20 domains → portals → diagnosis → treatments
 *
 * Each domain maps to:
 *   - civilization.top.json node (connectome identity)
 *   - runtime domain key (used in LIMENDomains, feeds, signal-router)
 *   - feed sources (live or pending)
 *   - connectome node IDs (brain mapping)
 *   - API key requirements
 *
 * The runtimeKey handles the 3 name mismatches between
 * civilization.top.json IDs and the runtime domain keys:
 *   science  → research   (has live PubMed + arXiv feeds)
 *   medicine → health     (has live openFDA feeds)
 *   trade    → supplyChain (has live BLS + EIA feeds)
 *
 * Exposes: window.LIMENDomainRegistry
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // Feed status enum
  // ═══════════════════════════════════════════════════════════════════════

  var FEED_STATUS = {
    LIVE:     'live',      // API key configured, feed returning data
    PENDING:  'pending',   // API key not yet configured
    PUBLIC:   'public',    // No key required, public endpoint
    FALLBACK: 'fallback'   // Using heuristic model
  };

  // ═══════════════════════════════════════════════════════════════════════
  // The 20-domain registry
  // ═══════════════════════════════════════════════════════════════════════

  var DOMAINS = [

    // ─── 1. Governance ────────────────────────────────────────────────
    {
      id: 'governance',
      runtimeKey: 'governance',
      label: 'Governance',
      group: 'control',
      description: 'State authority, executive, legislative, and judicial functions, international diplomacy, policy formation.',
      analystEnabled: true,
      connectomeNodes: [12, 9],  // DLPFC + ACC
      feeds: [
        // ── Institutional-quality "price/cost" anchors (real quantitative governance metrics) ──
        // Governance equivalent of energy's EIA/FRED commodity anchors: instead of oil/gas
        // spot prices, governance's signal is the measured STATE OF INSTITUTIONS — the
        // quantitative quality of public administration, rule of law, regulatory capacity,
        // democratic systems, and fiscal governance. Governance binds to INSTITUTIONS &
        // INDICATORS (not single companies). Every World Bank WGI series_id, V-Dem index,
        // OECD dataset, and federal-oversight series is REAL (never fabricated). This closes
        // the registry asymmetry where governance had only qualitative news/legislative RSS
        // and no live institutional-quality anchor like energy's commodity price.
        // -- World Bank Worldwide Governance Indicators (the "crude price" of governance) --
        // WGI's 6 dimensions are the canonical institutional-quality baseline; each series_id
        // is REAL (CC/RL/RQ/PV/VA/GE .EST). These mirror EIA Petroleum's price-anchor role.
        { name: 'WGI Control of Corruption', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/CC.EST?format=json', feedClass: 'institutional_quality', seriesId: 'CC.EST' },   // control of corruption — institutional-integrity anchor (mirrors EIA Petroleum LIVE)
        { name: 'WGI Rule of Law', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/RL.EST?format=json', feedClass: 'institutional_quality', seriesId: 'RL.EST' },        // rule of law — legal-system confidence / contract enforcement anchor (mirrors FRED Crude Oil LIVE)
        { name: 'WGI Regulatory Quality', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/RQ.EST?format=json', feedClass: 'institutional_quality', seriesId: 'RQ.EST' }, // regulatory quality — sound-policy capacity anchor
        { name: 'WGI Political Stability', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/PV.EST?format=json', feedClass: 'institutional_quality', seriesId: 'PV.EST' }, // political stability & absence of violence — legitimacy / stability anchor
        { name: 'WGI Voice & Accountability', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/VA.EST?format=json', feedClass: 'institutional_quality', seriesId: 'VA.EST' }, // voice & accountability — democratic-participation anchor
        { name: 'WGI Government Effectiveness', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/GE.EST?format=json', feedClass: 'institutional_quality', seriesId: 'GE.EST' }, // government effectiveness — public-service delivery / state-capacity anchor
        // -- V-Dem (Varieties of Democracy) democratic-systems indices (real public API) --
        // V-Dem (University of Gothenburg) is a REAL governance-indicator database distinct
        // from WGI; country-year panel data on democratic institutions across 202+ countries.
        { name: 'V-Dem Electoral Democracy Index', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'v-dem.net/api/v1/indicator/v2x_polyarchy', feedClass: 'democratic_quality', seriesId: 'v2x_polyarchy' },        // electoral democracy (polyarchy) index — core democratic-systems anchor
        { name: 'V-Dem Liberal Principles', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'v-dem.net/api/v1/indicator/v2x_liberal', feedClass: 'democratic_quality', seriesId: 'v2x_liberal' },               // liberal principles index — checks-on-power / civil-liberties protection
        { name: 'V-Dem Participatory Democracy', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'v-dem.net/api/v1/indicator/v2x_partipdem', feedClass: 'democratic_quality', seriesId: 'v2x_partipdem' },        // participatory democracy index — civic engagement / direct participation
        { name: 'V-Dem Deliberative Component', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'v-dem.net/api/v1/indicator/v2xdl_delib', feedClass: 'democratic_quality', seriesId: 'v2xdl_delib' },            // deliberative component index — reasoned-discourse / public-justification quality
        { name: 'V-Dem Civil Liberties', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'v-dem.net/api/v1/indicator/v2x_civlib', feedClass: 'democratic_quality', seriesId: 'v2x_civlib' },                  // civil liberties index — individual-rights protection
        // -- OECD governance & public-services indicators (real OECD.Stat / data API) --
        // OECD provides multilateral institutional-quality metrics to balance the registry's
        // U.S.-legislative bias; every dataset code is REAL and documented.
        { name: 'OECD Government at a Glance', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'sdmx.oecd.org/public/rest/data/OECD.GOV.GIP,DSD_GOV@DF_GOV/', feedClass: 'public_management' },    // government-at-a-glance — public-sector management / institutional trust
        { name: 'OECD General Government Expenditure (COFOG)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NASEC10@DF_TABLE11/', feedClass: 'public_finance' }, // government expenditure by function (COFOG) — fiscal-governance / public-finance anchor
        { name: 'OECD Regulatory Policy (iREG)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'sdmx.oecd.org/public/rest/data/OECD.GOV.REG,DSD_IREG@DF_IREG/', feedClass: 'regulatory_policy' },  // indicators of regulatory policy & governance — RIA / stakeholder-engagement quality
        { name: 'OECD Tax Revenue', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_REV_COMP@DF_RSGLO/', feedClass: 'public_finance' },             // tax revenue / fiscal capacity — public-finance state-capacity signal
        // -- CBO structured fiscal & budgetary data (the federal fiscal-governance anchor) --
        { name: 'CBO Budget & Economic Outlook Data', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cbo.gov/about/products/budget-economic-data', feedClass: 'public_finance' },           // CBO baseline projections / deficit & debt trajectory — fiscal-governance quantitative anchor
        { name: 'CBO Long-Term Budget Outlook', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cbo.gov/data/budget-economic-data#4', feedClass: 'public_finance' },                          // long-term fiscal sustainability projections — structural budget signal
        // -- GAO structured oversight & program-evaluation findings (federal-accountability anchor) --
        { name: 'GAO High-Risk List', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.gao.gov/high-risk-list', feedClass: 'oversight' },                                                    // GAO High-Risk programs — federal-agency vulnerability / institutional-integrity findings
        { name: 'GAO Open Recommendations', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.gao.gov/reports-testimonies/recommendations-database', feedClass: 'oversight' },                  // GAO open priority recommendations — program-evaluation / accountability throughput
        // -- Govtech / public-sector industrial base (REAL listed equities, never fabricated) --
        // Governance's INDUSTRIAL-BASE analogue to energy's commodity anchors: the public-sector
        // technology & services firms that build/run government systems. Tickers are REAL:
        // MMS (Maximus) / TYL (Tyler Technologies) / BAH (Booz Allen) / LDOS (Leidos) /
        // ACN (Accenture) / GIB (CGI/GDIT-adjacent IT). MMS 0.95-binds Executive Authority in
        // governance.json; these mirror defense's per-name contractor bindings.
        { name: 'Polygon.io MMS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/MMS/prev', feedClass: 'govtech', ticker: 'MMS' },   // Maximus — prime (government program administration / public-benefits delivery)
        { name: 'Polygon.io TYL', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TYL/prev', feedClass: 'govtech', ticker: 'TYL' },   // Tyler Technologies — prime (public-sector software / courts / civic ERP)
        { name: 'Polygon.io BAH', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/BAH/prev', feedClass: 'govtech', ticker: 'BAH' },   // Booz Allen Hamilton — prime (federal advisory / digital government)
        { name: 'Polygon.io LDOS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LDOS/prev', feedClass: 'govtech', ticker: 'LDOS' }, // Leidos — prime (federal IT / systems integration)
        { name: 'Polygon.io ACN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ACN/prev', feedClass: 'govtech', ticker: 'ACN' },   // Accenture (incl. Accenture Federal Services) — prime (public-sector digital transformation)
        { name: 'Polygon.io GIB', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/GIB/prev', feedClass: 'govtech', ticker: 'GIB' },   // CGI Inc. — prime (government IT / public-sector services; GDIT-adjacent public proxy)
        // ── Rulemaking / governance-agency policy context (Federal Register, agency-filtered) ──
        // Federal Register API agency filters scoped to GOVERNANCE institutions (executive
        // capacity, civil-service integrity, procurement, merit protection) — parallel to the
        // infrastructure & intelligence registry's agency-filtered Federal Register feeds.
        { name: 'Federal Register OMB/GSA/OPM/MSPB', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=management-and-budget-office&conditions[agencies][]=general-services-administration&conditions[agencies][]=personnel-management-office&conditions[agencies][]=merit-systems-protection-board', feedClass: 'rulemaking' }, // OMB/GSA/OPM/MSPB rulemakings — executive capacity / civil-service integrity / procurement governance
        // ── Existing institutional & legislative anchors (kept) ──
        { name: 'World Bank Governance', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/CC.EST?format=json' },
        { name: 'RSS Governance', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'news.google.com/rss/search' },
        { name: 'GovTrack', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.govtrack.us/events/events.rss' },
        { name: 'Congress.gov', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.congress.gov/rss/most-viewed-bills.xml' },
        { name: 'GAO Reports', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.gao.gov/rss/reports.xml' },
        { name: 'CBO Publications', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cbo.gov/publications/all/rss.xml' },
        { name: 'OMB Releases', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.whitehouse.gov/omb/feed/' },
        { name: 'Brennan Center', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.brennancenter.org/rss.xml' },
        { name: 'POGO', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.pogo.org/feed' },
        { name: 'Mother Jones', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.motherjones.com/politics/feed/' },
        { name: 'HuffPost Politics', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.huffpost.com/section/politics/feed' },
        { name: 'The Nation', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.thenation.com/feed/?post_type=article' },
        { name: 'Breitbart', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'feeds.feedburner.com/breitbart' },
        { name: 'Washington Times', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.washingtontimes.com/rss/headlines/news/politics/' },
        { name: 'National Review', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.nationalreview.com/feed/' },
        { name: 'Daily Caller', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'dailycaller.com/feed/' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 2. Economy ───────────────────────────────────────────────────
    {
      id: 'economy',
      runtimeKey: 'economy',
      label: 'Economy',
      group: 'exchange',
      description: 'Production, consumption, GDP, labor markets, monetary systems, economic cycles.',
      analystEnabled: true,
      connectomeNodes: [6, 12],  // OFC + DLPFC
      feeds: [
        // ── Macro indicators (real FRED series — the economy's "price/cost" anchors) ──
        // Macroeconomic equivalent of energy's EIA/FRED commodity anchors: instead of
        // oil/gas spot prices, the economy's signal is the MACRO AGGREGATE — output,
        // prices, labor, policy, and the business cycle. Every series_id is a REAL
        // FRED identifier (never fabricated), distinct from finance's company tickers.
        { name: 'FRED GDP', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=GDP', feedClass: 'output' },            // nominal GDP (quarterly) — macro "price" anchor (mirrors EIA Petroleum LIVE)
        { name: 'FRED Real GDP', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=GDPC1', feedClass: 'output' },      // real GDP, chained 2012 $ (quarterly) — growth anchor (mirrors FRED Crude Oil LIVE)
        { name: 'FRED CPI', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL', feedClass: 'inflation' },     // CPI all items (monthly) — headline inflation
        { name: 'FRED PCE Price Index', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=PCEPI', feedClass: 'inflation' }, // PCE price index (monthly) — Fed's preferred inflation gauge
        { name: 'FRED Unemployment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=UNRATE', feedClass: 'labor' },   // unemployment rate (monthly)
        { name: 'FRED Nonfarm Payrolls', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=PAYEMS', feedClass: 'labor' }, // total nonfarm payroll employment (monthly)
        { name: 'FRED Fed Funds Rate', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS', feedClass: 'policy' }, // effective federal funds rate (monthly/daily) — monetary policy
        { name: 'FRED 10Y Treasury', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=DGS10', feedClass: 'policy' },     // 10-year Treasury constant maturity (daily) — yield-curve / policy
        { name: 'FRED Consumer Sentiment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=UMCSENT', feedClass: 'sentiment' }, // U. Michigan consumer sentiment (monthly)
        { name: 'FRED Industrial Production', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=INDPRO', feedClass: 'output' }, // industrial production index (monthly) — business-cycle proxy
        // ── Broad-market proxies (macro aggregate, NOT single-company tickers) ──
        // Index-tracking ETFs stand in for whole-market regime (risk-on/off), keeping
        // the economy domain a MACRO observer distinct from finance's per-name quotes.
        { name: 'Polygon.io SPY', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/SPY/prev', feedClass: 'market_proxy' },  // S&P 500 — broad equity regime
        { name: 'Polygon.io DIA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/DIA/prev', feedClass: 'market_proxy' },  // Dow 30 — large-cap industrial regime
        { name: 'Polygon.io TLT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TLT/prev', feedClass: 'market_proxy' },  // 20+yr Treasuries — long-bond / rate regime
        { name: 'Polygon.io GLD', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/GLD/prev', feedClass: 'market_proxy' },  // gold — safe-haven / inflation hedge
        // ── Labor cross-check (kept from prior economy registry) ──
        { name: 'BLS Employment', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.bls.gov/publicAPI/v2/timeseries/data/', feedClass: 'labor' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 3. Infrastructure ────────────────────────────────────────────
    {
      id: 'infrastructure',
      runtimeKey: 'infrastructure',
      label: 'Infrastructure',
      group: 'structure',
      description: 'Built environment, utilities, transport networks, water systems, urban planning.',
      analystEnabled: true,
      connectomeNodes: [73, 31],  // ENS + Hypothalamus
      feeds: [
        // ── Institutional context (price/cost + macro footprint) ──
        // Civil equivalent of energy's EIA/FRED price anchors: instead of oil/gas
        // spot prices, infrastructure's "price" is the cost of building and
        // maintaining the built environment (construction + transport capital).
        { name: 'World Bank Infrastructure', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/IS.RRS.TOTL.KM?format=json', feedClass: 'institutional' },
        { name: 'OECD Infrastructure', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'stats.oecd.org/restsdmx/sdmx.ashx/GetData/ITF_GOODS_TRANSPORT', feedClass: 'institutional' },
        { name: 'FRED Construction Spending', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=TTLCONS', feedClass: 'price_cost' },     // total construction spending — civil "price" anchor (mirrors EIA Petroleum LIVE)
        { name: 'FRED Transportation Spending', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=A192RC1Q027SBEA', feedClass: 'price_cost' }, // public transportation/infra investment — civil "crude" anchor (mirrors FRED Crude Oil LIVE)
        // ── Operational metrics (transport / congestion throughput) ──
        { name: 'INRIX Congestion Index', apiKey: 'INRIX_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'api.inrix.com/v1/congestion', feedClass: 'operational' },     // roadway congestion — LIVE once operator key provided; falls back to heuristic
        { name: 'FHWA Traffic Volume', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.fhwa.dot.gov/policyinformation/travel_monitoring/tvt.cfm', feedClass: 'operational' }, // traffic volume trends — throughput on the road network
        { name: 'APTA Transit Statistics', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.apta.com/research-technical-resources/transit-statistics/ridership-report/', feedClass: 'operational' }, // transit ridership — public works throughput
        // ── Electric GRID operational feeds (transmission / distribution reliability) ──
        // Mirror energy's directional market signals, but capture the civil electric
        // GRID specifically (NERC/FERC/ISO-RTO), so grid-stress propagates through
        // civilization as an infrastructure signal, not a generic one.
        { name: 'NERC Reliability Metrics', apiKey: 'NERC_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'api.nerc.net/reliability/metrics', feedClass: 'grid_operational' }, // grid reliability — LIVE once operator SCADA bridge / key provided
        { name: 'FERC Transmission Adequacy', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ferc.gov/rss/news.xml', feedClass: 'grid_operational' },          // transmission adequacy — public FERC endpoint
        { name: 'ISO/RTO Supply Adequacy', apiKey: 'ISO_RTO_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'internal:iso-rto-state-aggregator', feedClass: 'grid_operational' }, // MISO/PJM/ISO supply adequacy — PENDING until operator API keys added
        // ── Reliability / hazard alerts (weather + seismic + cyber-physical) ──
        { name: 'NOAA NWS Alerts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.weather.gov/alerts/active', feedClass: 'reliability' },        // weather hazards to roads/grid/water (reused civil hazard channel)
        { name: 'USGS Earthquake Alerts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson', feedClass: 'reliability' }, // seismic risk to bridges/dams/levees
        { name: 'CISA Infrastructure Alerts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cisa.gov/cybersecurity-advisories/all.xml', feedClass: 'reliability' }, // cyber-physical / SCADA / ICS / KEV advisories
        { name: 'PHMSA Incident Database', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.phmsa.dot.gov/data-and-statistics/pipeline/pipeline-incident-flagged-files', feedClass: 'reliability' }, // pipeline/hazmat incidents — physical infra failure signal
        // ── Regulatory / governance context ──
        { name: 'Federal Register FERC/DOT/HUD', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=federal-energy-regulatory-commission&conditions[agencies][]=transportation-department&conditions[agencies][]=housing-and-urban-development-department', feedClass: 'regulatory' }, // rulemakings governing civil infrastructure
        { name: 'USACE Water Resources', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'water.usace.army.mil/a2w/CWMS_CRREL.cwms_data_api', feedClass: 'regulatory' }, // dams / levees / waterways — federal water resource status
        // ── Internal cross-domain arcs (civilization propagation, unchanged) ──
        { name: 'Cross-Domain Pressure Feed', apiKey: null, status: FEED_STATUS.LIVE, endpoint: 'internal:cross-domain-emissions', arc: 'shortArc' },
        { name: 'Asset Condition Feed', apiKey: null, status: FEED_STATUS.LIVE, endpoint: 'internal:activity-stress-ratio', arc: 'longArc' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 4. Energy ────────────────────────────────────────────────────
    {
      id: 'energy',
      runtimeKey: 'energy',
      label: 'Energy',
      group: 'power',
      description: 'Generation, distribution, fossil fuels, renewables, nuclear, grid management.',
      analystEnabled: true,
      connectomeNodes: [31, 8],  // Hypothalamus + AI
      feeds: [
        { name: 'EIA Petroleum', apiKey: 'EIA_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.eia.gov/v2/petroleum/pri/spt/data/' },
        { name: 'FRED Crude Oil', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 5. Agriculture ───────────────────────────────────────────────
    {
      id: 'agriculture',
      runtimeKey: 'agriculture',
      label: 'Agriculture',
      group: 'nourishment',
      description: 'Crop production, livestock, aquaculture, food processing, supply and distribution.',
      analystEnabled: true,
      connectomeNodes: [31, 73],  // Hypothalamus + ENS
      feeds: [
        // ── Commodity price / cost anchors (the agriculture "crude price" baseline) ──
        // Agriculture equivalent of energy's EIA/FRED commodity anchors: instead of
        // oil/gas spot prices, agriculture's quantitative spine is the GRAIN COMPLEX —
        // CBOT corn/soy/wheat futures price discovery (the daily "crude" of farming),
        // USDA WASDE monthly supply/demand balance (the directional forecast trend), and
        // USDA NASS commodity-price series. Every endpoint is a REAL public/government or
        // exchange source and every ticker is a REAL listed agribusiness/ag-input equity
        // (never fabricated). This closes the registry asymmetry where agriculture had
        // only production volume (NASS) + global stats (FAOSTAT) and no live commodity-
        // market price discovery or supply-forecast anchor like energy. Biofuel /
        // fertilizer-energy and land/water/climate remain COUPLINGS, not ag's own content.
        // -- Grain-complex price discovery (CBOT corn/soy/wheat — the "crude price" of agriculture) --
        { name: 'CBOT Corn Futures (ZC)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cmegroup.com/markets/agriculture/grains/corn.quotes.html', feedClass: 'price_cost', commodity: 'corn' },   // CBOT corn front-month spot — grain "crude" anchor (mirrors EIA Petroleum LIVE role)
        { name: 'CBOT Soybean Futures (ZS)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cmegroup.com/markets/agriculture/oilseeds/soybean.quotes.html', feedClass: 'price_cost', commodity: 'soybean' }, // CBOT soybean front-month spot — oilseed price baseline
        { name: 'CBOT Wheat Futures (ZW)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cmegroup.com/markets/agriculture/grains/wheat.quotes.html', feedClass: 'price_cost', commodity: 'wheat' }, // CBOT wheat front-month spot — bread-grain price baseline
        { name: 'FRED Corn Price', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=PMAIZMTUSDM', feedClass: 'price_cost', commodity: 'corn' },     // global corn price index — corn trend anchor (mirrors FRED Crude Oil LIVE)
        { name: 'FRED Soybean Price', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=PSOYBUSDM', feedClass: 'price_cost', commodity: 'soybean' }, // global soybean price index — oilseed trend anchor
        { name: 'FRED Wheat Price', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=PWHEAMTUSDM', feedClass: 'price_cost', commodity: 'wheat' },    // global wheat price index — bread-grain trend anchor
        { name: 'FRED Producer Price Farm Products', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=WPU01', feedClass: 'price_cost' }, // PPI farm products — aggregate farm-gate price level
        // -- Supply/demand forecasting (USDA WASDE — the directional supply-balance signal) --
        { name: 'USDA WASDE', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.usda.gov/oce/commodity/wasde/latest.xml', feedClass: 'supply_forecast' }, // monthly World Ag Supply & Demand Estimates — production/stocks/use balance forecast (mirrors FRED Crude Oil directional trend)
        { name: 'USDA NASS QuickStats (Prices)', apiKey: 'USDA_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'quickstats.nass.usda.gov/api/api_GET/?statisticcat_desc=PRICE+RECEIVED', feedClass: 'price_cost' }, // NASS commodity prices-received series — farm-gate price discovery (expands the production-only NASS feed)
        { name: 'USDA ERS Farm Income', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ers.usda.gov/data-products/farm-income-and-wealth-statistics/', feedClass: 'farm_economics' }, // ERS net farm income / cost of production — farm-economics health anchor
        { name: 'USDA NASS Crop Progress', apiKey: 'USDA_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'quickstats.nass.usda.gov/api/api_GET/?statisticcat_desc=PROGRESS', feedClass: 'crop_cycle' }, // weekly planting/condition/harvest progress — crop-cycle phase signal
        { name: 'USDA NASS', apiKey: 'USDA_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'quickstats.nass.usda.gov/api/api_GET/' }, // production volume — original baseline (retained)
        { name: 'FAO FAOSTAT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'fenixservices.fao.org/faostat/api/v1/en/data/' }, // global food-balance context (retained)
        // ── Agribusiness & ag-input industrial base (REAL listed equities, never fabricated) ──
        // Per-name equities for the agriculture industrial base; the company analogue of
        // energy's commodity anchors. Tickers are REAL: ADM/BG/CTVA/DE/NTR/MOS/CF/TSN/CAG/INGR/AGCO/FMC.
        { name: 'Polygon.io ADM', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ADM/prev', feedClass: 'agribusiness', ticker: 'ADM' },   // Archer-Daniels-Midland — prime (grain trading / oilseed processing / food)
        { name: 'Polygon.io BG', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/BG/prev', feedClass: 'agribusiness', ticker: 'BG' },     // Bunge — prime (global oilseed processing / grain merchandising)
        { name: 'Polygon.io INGR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/INGR/prev', feedClass: 'agribusiness', ticker: 'INGR' }, // Ingredion — prime (corn/starch ingredient processing)
        { name: 'Polygon.io CTVA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CTVA/prev', feedClass: 'crop_inputs', ticker: 'CTVA' }, // Corteva — prime (seed genetics / crop protection)
        { name: 'Polygon.io FMC', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/FMC/prev', feedClass: 'crop_inputs', ticker: 'FMC' },   // FMC — prime (crop-protection chemistry / insecticides / herbicides)
        { name: 'Polygon.io NTR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NTR/prev', feedClass: 'fertilizer', ticker: 'NTR' },   // Nutrien — prime (potash / nitrogen / ag-retail crop nutrients)
        { name: 'Polygon.io MOS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/MOS/prev', feedClass: 'fertilizer', ticker: 'MOS' },   // Mosaic — prime (phosphate / potash crop nutrients)
        { name: 'Polygon.io CF', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CF/prev', feedClass: 'fertilizer', ticker: 'CF' },      // CF Industries — prime (nitrogen fertilizer / ammonia)
        { name: 'Polygon.io DE', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/DE/prev', feedClass: 'ag_machinery', ticker: 'DE' },    // Deere & Co — prime (farm machinery / precision-ag technology)
        { name: 'Polygon.io AGCO', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/AGCO/prev', feedClass: 'ag_machinery', ticker: 'AGCO' }, // AGCO — prime (agricultural equipment / Fendt / Massey Ferguson)
        { name: 'Polygon.io TSN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TSN/prev', feedClass: 'animal_protein', ticker: 'TSN' }, // Tyson Foods — prime (livestock / animal-protein processing)
        { name: 'Polygon.io CAG', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CAG/prev', feedClass: 'food_production', ticker: 'CAG' }, // Conagra Brands — prime (packaged food production)
        { name: 'Polygon.io MOO', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/MOO/prev', feedClass: 'sector_proxy', ticker: 'MOO' },  // VanEck Agribusiness ETF — agriculture industrial-base regime proxy
        // ── Qualitative signals (USDA / sector news / food-security context) ──
        { name: 'USDA Newsroom', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.usda.gov/rss/home.xml', feedClass: 'sector_news' }, // USDA releases — policy / crop reports / disease (e.g. avian influenza)
        { name: 'USDA FAS Global Ag', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'fas.usda.gov/rss.xml', feedClass: 'sector_news' }, // Foreign Ag Service — global production / food-security context
        { name: 'Successful Farming', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.agriculture.com/rss.xml', feedClass: 'sector_news' } // farm-operator trade press — sentiment / on-farm conditions
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 6. Industry ──────────────────────────────────────────────────
    {
      id: 'industry',
      runtimeKey: 'industry',
      label: 'Industry',
      group: 'formation',
      description: 'Manufacturing, materials processing, fabrication, industrial chemistry, quality systems.',
      analystEnabled: true,
      connectomeNodes: [6, 12],  // OFC + DLPFC
      feeds: [
        { name: 'FRED Industrial Production', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=INDPRO' },
        { name: 'BLS Manufacturing PPI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.bls.gov/publicAPI/v2/timeseries/data/' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 7. Research (civilization: Science) ──────────────────────────
    {
      id: 'science',
      runtimeKey: 'research',
      label: 'Science & Research',
      group: 'discovery',
      description: 'Research institutions, basic and applied science, peer review, knowledge generation.',
      analystEnabled: true,
      connectomeNodes: [20, 12],  // HIPP + DLPFC
      feeds: [
        { name: 'PubMed', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi' },
        { name: 'arXiv All', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'export.arxiv.org/api/query' },
        // ── Science feed expansion (research integrity / funding / press) ──
        { name: 'NSF Awards', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.nsf.gov/news/news_list.jsp' },
        { name: 'Retraction Watch', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'retractionwatch.com/feed/' },
        { name: 'NIH Grants', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.nih.gov/news-events/news-releases/feed' },
        { name: 'Nature / Science Press', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.nature.com/nature.rss' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 8. Health (civilization: Medicine) ───────────────────────────
    {
      id: 'medicine',
      runtimeKey: 'health',
      label: 'Medicine & Health',
      group: 'repair',
      description: 'Healthcare delivery, pharmaceuticals, public health, mental health, biotech.',
      analystEnabled: true,
      connectomeNodes: [1, 17],  // mPFC + BLA
      feeds: [
        { name: 'openFDA Events', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.fda.gov/drug/event.json' },
        { name: 'openFDA Recalls', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.fda.gov/drug/enforcement.json' },
        // ── Medicine feed expansion (public-health surveillance / supply / clinical R&D) ──
        { name: 'CDC MMWR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'tools.cdc.gov/api/v2/resources/media/316422.rss' },
        { name: 'WHO Disease Outbreak', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.who.int/feeds/entity/csr/don/en/rss.xml' },
        { name: 'FDA Drug Shortages', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.fda.gov/drug/shortages.json' },
        { name: 'ClinicalTrials.gov', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'clinicaltrials.gov/api/v2/studies' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 9. Education ─────────────────────────────────────────────────
    {
      id: 'education',
      runtimeKey: 'education',
      label: 'Education',
      group: 'transmission',
      description: 'K-12, higher education, vocational training, knowledge transmission across generations.',
      analystEnabled: true,
      connectomeNodes: [20, 12],  // HIPP + DLPFC
      feeds: [
        // ── Enrollment / cost / outcome anchors (the education "crude price" baseline) ──
        // Education equivalent of energy's EIA/FRED commodity anchors: instead of oil/gas
        // spot prices, education's quantitative spine is the FEDERAL EDUCATION DATA COMPLEX —
        // NCES IPEDS institution-level enrollment/completion/debt/earnings (the daily "crude"
        // of education), NAEP proficiency trend (the directional outcome signal), and FRED
        // student-loan / federal-aid time series (the cost / debt-level anchor). Every
        // endpoint is a REAL public/government or exchange source and every ticker is a REAL
        // listed education-sector equity (never fabricated). This closes the registry
        // asymmetry where education had only news/qualitative anchors (ED.gov/NCES/EdWeek) and
        // no live enrollment/outcome/cost price-discovery anchor like energy. Workforce/skills
        // (economy), research output (science), demographics (population) and edtech tooling
        // (technology) remain COUPLINGS, not education's own content.
        // -- Enrollment / completion / debt / earnings discovery (NCES IPEDS — the "crude price" of education) --
        { name: 'NCES IPEDS Data', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'nces.ed.gov/ipeds/use-the-data', feedClass: 'enrollment_outcome', metric: 'ipeds' },        // IPEDS institution-level enrollment/completion/debt/earnings — the education "crude" anchor (mirrors EIA Petroleum LIVE role)
        { name: 'Urban Institute Education Data API (IPEDS)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'educationdata.urban.org/api/v1/college-university/ipeds/enrollment-full-time-equivalent/', feedClass: 'enrollment_outcome', metric: 'enrollment' }, // machine-readable IPEDS enrollment/completion mirror — programmatic enrollment trend-line
        { name: 'College Scorecard (Dept of Ed)', apiKey: 'DATA_GOV_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.data.gov/ed/collegescorecard/v1/schools', feedClass: 'enrollment_outcome', metric: 'cost_debt_earnings' }, // institution-level net price / debt / post-grad earnings — cost & outcome price discovery
        { name: 'NCES NAEP Data (proficiency)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.nationsreportcard.gov/ndecore/xplore/NDE', feedClass: 'outcome_quality', metric: 'naep' }, // National Assessment of Educational Progress reading/math proficiency by state — directional student-outcome signal (mirrors USDA WASDE supply-balance trend)
        { name: 'NCES CCD (K-12)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'educationdata.urban.org/api/v1/schools/ccd/enrollment/', feedClass: 'enrollment_outcome', metric: 'k12_enrollment' }, // Common Core of Data — K-12 public-school enrollment/staffing headcount
        // -- Cost / debt / aid level (FRED student-loan & federal-aid series — the directional cost anchor) --
        { name: 'FRED Student Loans Outstanding', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SLOAS', feedClass: 'cost_debt', metric: 'student_debt' }, // total student loans owned & securitized — student-debt level anchor (mirrors FRED Crude Oil LIVE)
        { name: 'FRED Tuition CPI', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CUSR0000SEEB', feedClass: 'cost_debt', metric: 'tuition_cpi' }, // CPI college tuition & fees — tuition cost-level trend
        { name: 'FRED State & Local Education Spending', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SLEXPND', feedClass: 'education_finance', metric: 'public_spend' }, // state & local govt education expenditures — per-pupil / appropriations macro anchor (mirrors FRED macro anchors)
        { name: 'FRED Education Services Employment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=USEDU', feedClass: 'education_finance', metric: 'sector_employment' }, // private education-services payroll employment — sector capacity level
        // -- Teacher / education-sector labor demand (BLS — workforce capacity signal) --
        { name: 'BLS Education Employment Projections', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.bls.gov/publicAPI/v2/timeseries/data/', feedClass: 'labor_demand', metric: 'teacher_demand' }, // BLS education-occupation employment projections — teacher/paraprofessional demand trend
        // ── Education-sector industrial base (REAL listed equities, never fabricated) ──
        // Per-name equities for the education industrial base; the company analogue of
        // energy's commodity anchors. Tickers are REAL: CHGG/COUR/DUOL/LRN/ATGE/LOPE/STRA/LAUR/TWOU/UTI.
        { name: 'Polygon.io CHGG', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CHGG/prev', feedClass: 'edtech', ticker: 'CHGG' },  // Chegg — prime (online learning / homework & study support)
        { name: 'Polygon.io COUR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/COUR/prev', feedClass: 'edtech', ticker: 'COUR' },  // Coursera — prime (MOOC / online higher-ed & professional certificates)
        { name: 'Polygon.io DUOL', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/DUOL/prev', feedClass: 'edtech', ticker: 'DUOL' },  // Duolingo — prime (mobile language learning / consumer edtech)
        { name: 'Polygon.io TWOU', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TWOU/prev', feedClass: 'edtech', ticker: 'TWOU' },  // 2U — prime (online program management / university partnerships)
        { name: 'Polygon.io LRN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LRN/prev', feedClass: 'k12_provider', ticker: 'LRN' },    // Stride (K12 Inc) — prime (online K-12 / virtual schools)
        { name: 'Polygon.io ATGE', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ATGE/prev', feedClass: 'higher_ed', ticker: 'ATGE' }, // Adtalem Global Education — prime (medical/healthcare/professional higher-ed)
        { name: 'Polygon.io LOPE', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LOPE/prev', feedClass: 'higher_ed', ticker: 'LOPE' }, // Grand Canyon Education — prime (university services / online higher-ed)
        { name: 'Polygon.io STRA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/STRA/prev', feedClass: 'higher_ed', ticker: 'STRA' }, // Strategic Education — prime (Strayer/Capella / working-adult degrees)
        { name: 'Polygon.io LAUR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LAUR/prev', feedClass: 'higher_ed', ticker: 'LAUR' }, // Laureate Education — prime (international higher-ed networks)
        { name: 'Polygon.io UTI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/UTI/prev', feedClass: 'vocational', ticker: 'UTI' },     // Universal Technical Institute — prime (vocational / skilled-trade training)
        // ── Regulatory / compliance / accreditation anchors (institutional-quality framework) ──
        // The education analogue of energy's FERC/NERC rulemaking + reliability feeds: federal
        // Dept-of-Ed rulemaking, Office of Federal Student Aid (Title-IV) compliance, and
        // accreditor enforcement notices — the "institutional-quality" composite (mirrors
        // governance's WGI/V-Dem and energy's NERC/ISO-RTO institutional anchors).
        { name: 'Federal Register Dept of Education', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=education-department', feedClass: 'regulatory', metric: 'ed_rulemaking' }, // ED rulemaking incl. gainful-employment / Title-IV (mirrors FERC rulemaking feeds)
        { name: 'Federal Student Aid (Title-IV)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'studentaid.gov/data-center/school', feedClass: 'compliance', metric: 'title_iv' }, // OFSA Title-IV program-participation / compliance & cohort default rates — federal-aid pipeline integrity
        { name: 'CHEA Accreditation Database', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.chea.org/search-institutions', feedClass: 'accreditation', metric: 'accreditor_status' }, // CHEA recognized accreditor / institution status — accreditation institutional-quality anchor (mirrors NERC reliability)
        { name: 'HLC Accreditation Actions', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.hlcommission.org/Student-Resources/directory-of-hlc-institutions.html', feedClass: 'accreditation', metric: 'probation_revocation' }, // Higher Learning Commission probation/revocation actions — accreditor enforcement signal
        // ── Qualitative signals (govt / sector news / global context — retained) ──
        { name: 'World Bank Education', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/SE.XPD.TOTL.GD.ZS?format=json', feedClass: 'global_context' }, // global education-spend % GDP context (retained)
        { name: 'OpenAlex Institutions', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.openalex.org/institutions', feedClass: 'institution_registry' }, // institution registry / scholarly footprint (retained)
        { name: 'ED.gov News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ed.gov/feed', feedClass: 'sector_news' }, // Dept of Education releases — policy / regulation (retained)
        { name: 'NCES News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'nces.ed.gov/whatsnew/whatsnew.rss', feedClass: 'sector_news' }, // NCES statistics releases (retained)
        { name: 'EdWeek News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.edweek.org/feed', feedClass: 'sector_news' }, // K-12 trade press — sentiment / on-ground conditions (retained)
        { name: 'IES News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'ies.ed.gov/whatsnew/whatsnew.rss', feedClass: 'sector_news' }, // Institute of Education Sciences research releases (retained)
        { name: 'Chronicle of Higher Ed', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.chronicle.com/feed', feedClass: 'sector_news' } // higher-ed trade press — sector sentiment (retained)
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 10. Technology ───────────────────────────────────────────────
    {
      id: 'technology',
      runtimeKey: 'technology',
      label: 'Technology',
      group: 'coordination',
      description: 'Computing, AI, software, hardware, cybersecurity, digital infrastructure.',
      analystEnabled: true,
      connectomeNodes: [12, 15],  // DLPFC + FPCN
      feeds: [
        { name: 'USPTO Patents', apiKey: 'USPTO_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.uspto.gov/api/v1/patent/applications/search' },
        { name: 'arXiv CS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'export.arxiv.org/api/query?search_query=cat:cs.*' },
        { name: 'CISA KEV', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json' },
        { name: 'NVD Recent CVEs', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'services.nvd.nist.gov/rest/json/cves/2.0' },
        { name: 'Krebs Security', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'krebsonsecurity.com/feed' },
        { name: 'Hacker News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'hacker-news.firebaseio.com/v0/topstories.json' },
        { name: 'GitHub Security Advisories', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'github.blog/category/security/feed' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 11. Communication ────────────────────────────────────────────
    {
      id: 'communication',
      runtimeKey: 'communication',
      label: 'Communication',
      group: 'signal',
      description: 'Media, telecommunications, internet, broadcasting, information flow and narrative.',
      analystEnabled: true,
      connectomeNodes: [8, 15],  // AI + FPCN
      feeds: [
        // ── Institutional-quality "price/cost" anchors (real quantitative connectivity metrics) ──
        // Communication equivalent of energy's EIA/FRED commodity anchors: instead of oil/gas
        // spot prices, communication's quantitative spine is the CONNECTIVITY & DISTRIBUTION
        // backbone — the price discovery and demand signals of the CHANNELS that carry
        // information (towers / fiber / spectrum / broadband / broadcast / streaming), plus the
        // financial health of the journalism institutions that produce the news flow. This
        // closes the registry asymmetry where communication had only qualitative news/press-
        // freedom RSS and no live institutional-quality anchor like energy's commodity price.
        // Communication binds to the NETWORKS & INFORMATION FLOW (distinct from culture's
        // content/scenes, technology's chips/software coupling, and intelligence's signals-
        // collection coupling). Every FRED series_id is REAL and every ticker is a REAL listed
        // telecom/media equity (never fabricated).
        // -- Spectrum / connectivity price discovery (the telecom "crude price") --
        // FCC spectrum auction clearing prices = the price discovery of wireless frequency,
        // the communication equivalent of an oil-barrel spot price (mirrors EIA Petroleum LIVE).
        { name: 'FCC Spectrum Auction Clearing Data', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.fcc.gov/auctions/summary', feedClass: 'spectrum_pricing', commodity: 'wireless_spectrum' }, // FCC spectrum auction clearing prices — wireless-frequency price discovery (mirrors EIA Petroleum LIVE role)
        { name: 'OOKLA Broadband Speed Index', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.speedtest.net/global-index', feedClass: 'connectivity_quality', commodity: 'broadband_throughput' }, // Ookla median fixed/mobile speeds — connectivity throughput/quality baseline
        { name: 'FCC Broadband Coverage (BDC)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'broadbandmap.fcc.gov/data-download', feedClass: 'connectivity_quality', commodity: 'broadband_coverage' }, // FCC Broadband Data Collection — coverage/availability map — connectivity reach signal
        // -- Macro connectivity price/cost trend (real FRED series — the directional anchor) --
        { name: 'FRED CPI Telephone Services', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CUUR0000SEED', feedClass: 'price_cost', seriesId: 'CUUR0000SEED' }, // CPI telephone services — consumer connectivity price trend (mirrors FRED Crude Oil LIVE)
        { name: 'FRED CPI Internet Services', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CUUR0000SEEE03', feedClass: 'price_cost', seriesId: 'CUUR0000SEEE03' }, // CPI internet services & electronic information providers — broadband price trend
        { name: 'FRED PPI Wired Telecom Carriers', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=PCU5171515171511', feedClass: 'price_cost', seriesId: 'PCU5171515171511' }, // PPI wired telecommunications carriers — wholesale connectivity price level
        { name: 'FRED Telecom Sector Employment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CES5051700001', feedClass: 'industry_health', seriesId: 'CES5051700001' }, // telecommunications sector employment — network-industry capacity health
        // -- Journalism / media industry financial health (the news-flow institutional anchor) --
        // Institutional-quality anchor for the JOURNALISM capacity that produces the news flow
        // (the communication analogue of governance's WGI institutional-quality metrics): media
        // employment + sector financial health as the structural quality of the information supply.
        { name: 'FRED Publishing & Broadcasting Employment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CES5051000001', feedClass: 'institutional_quality', seriesId: 'CES5051000001' }, // information-sector (publishing/broadcasting) employment — journalism-capacity anchor
        { name: 'FRED Newspaper Publishers Employment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CES5051110001', feedClass: 'institutional_quality', seriesId: 'CES5051110001' }, // newspaper publishers employment — newsroom-headcount / journalism-supply trend
        { name: 'Pew State of the News Media', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.pewresearch.org/journalism/fact-sheet/newspapers/', feedClass: 'institutional_quality' }, // Pew newsroom revenue / profitability / headcount — news-industry structural health
        { name: 'Reuters Institute Digital News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'reutersinstitute.politics.ox.ac.uk/digital-news-report', feedClass: 'institutional_quality' }, // Reuters Institute — global news consumption / trust — information-flow demand & quality
        // ── Telecom / media / network industrial base (REAL listed equities, never fabricated) ──
        // Per-name equities for the communication industrial base; the company analogue of
        // energy's commodity anchors. Tickers are REAL: VZ/T/TMUS/LUMN (carriers), AMT/CCI/SBAC
        // (tower/infra REITs), CMCSA/CHTR (cable/distribution), NFLX (streaming distribution),
        // CSCO/ANET/ERIC/NOK (network equipment), QCOM (wireless silicon — connectivity coupling),
        // NWSA/NYT (news institutions), META/GOOGL (social-media distribution platforms).
        { name: 'Polygon.io VZ', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/VZ/prev', feedClass: 'carrier', ticker: 'VZ' },       // Verizon — prime (wireless/wireline carrier — subscriber/ARPU demand signal)
        { name: 'Polygon.io T', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/T/prev', feedClass: 'carrier', ticker: 'T' },         // AT&T — prime (wireless/fiber carrier — net-adds / churn demand signal)
        { name: 'Polygon.io TMUS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TMUS/prev', feedClass: 'carrier', ticker: 'TMUS' }, // T-Mobile US — prime (wireless carrier — spectrum depth / net-adds)
        { name: 'Polygon.io LUMN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LUMN/prev', feedClass: 'carrier', ticker: 'LUMN' }, // Lumen Technologies — prime (fixed-line / fiber backbone capacity)
        { name: 'Polygon.io AMT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/AMT/prev', feedClass: 'infrastructure_reit', ticker: 'AMT' },   // American Tower — prime (cell-tower infrastructure REIT — tower utilization)
        { name: 'Polygon.io CCI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CCI/prev', feedClass: 'infrastructure_reit', ticker: 'CCI' },   // Crown Castle — prime (towers + fiber/small-cell infrastructure REIT)
        { name: 'Polygon.io SBAC', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/SBAC/prev', feedClass: 'infrastructure_reit', ticker: 'SBAC' }, // SBA Communications — prime (wireless-tower infrastructure REIT)
        { name: 'Polygon.io CMCSA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CMCSA/prev', feedClass: 'distribution', ticker: 'CMCSA' }, // Comcast — prime (cable broadband + NBCU media distribution)
        { name: 'Polygon.io CHTR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CHTR/prev', feedClass: 'distribution', ticker: 'CHTR' },   // Charter Communications — prime (Spectrum cable broadband distribution)
        { name: 'Polygon.io NFLX', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NFLX/prev', feedClass: 'distribution', ticker: 'NFLX' },   // Netflix — prime (streaming video distribution — bandwidth/subscriber demand)
        { name: 'Polygon.io CSCO', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CSCO/prev', feedClass: 'network_equipment', ticker: 'CSCO' }, // Cisco Systems — prime (routing/switching network equipment)
        { name: 'Polygon.io ANET', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ANET/prev', feedClass: 'network_equipment', ticker: 'ANET' }, // Arista Networks — prime (data-center/cloud network switching)
        { name: 'Polygon.io ERIC', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ERIC/prev', feedClass: 'network_equipment', ticker: 'ERIC' }, // Ericsson — prime (radio-access / 5G network infrastructure)
        { name: 'Polygon.io NOK', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NOK/prev', feedClass: 'network_equipment', ticker: 'NOK' },   // Nokia — prime (mobile/fixed network infrastructure)
        { name: 'Polygon.io QCOM', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/QCOM/prev', feedClass: 'wireless_silicon', ticker: 'QCOM' }, // Qualcomm — coupling (wireless modem/connectivity silicon — distinct from technology chips)
        { name: 'Polygon.io NWSA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NWSA/prev', feedClass: 'news_institution', ticker: 'NWSA' }, // News Corp — prime (news publishing institution — journalism capacity)
        { name: 'Polygon.io NYT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NYT/prev', feedClass: 'news_institution', ticker: 'NYT' },   // New York Times — prime (digital news subscription / journalism institution)
        { name: 'Polygon.io META', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/META/prev', feedClass: 'platform_distribution', ticker: 'META' }, // Meta Platforms — prime (social-media distribution channel for information flow)
        { name: 'Polygon.io GOOGL', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/GOOGL/prev', feedClass: 'platform_distribution', ticker: 'GOOGL' }, // Alphabet — prime (search/YouTube distribution channel for information flow)
        { name: 'Polygon.io FCOM', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/FCOM/prev', feedClass: 'sector_proxy', ticker: 'FCOM' },   // Fidelity Communication Services ETF — communication industrial-base regime proxy
        // ── Operational status / infrastructure-dependency / regulatory feeds (mirror infrastructure registry) ──
        // The communication analogue of infrastructure's NERC/FERC/ISO-RTO grid feeds: the
        // operational reliability of the CHANNELS — network/SCADA security, submarine/fiber
        // cable status, satellite-constellation health, and the regulatory throughput governing
        // telecom. These are the connectivity equivalent of grid-reliability metrics.
        { name: 'CISA Telecom ICS Alerts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cisa.gov/cybersecurity-advisories/all.xml', feedClass: 'security_alert' }, // cyber-physical / ICS / SCADA advisories affecting telecom network management
        { name: 'FCC Enforcement Bureau Actions', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.fcc.gov/enforcement/orders/rss', feedClass: 'regulatory' },          // FCC enforcement actions — telecom rule violations / compliance throughput
        { name: 'FCC Rulemaking (Federal Register)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=federal-communications-commission', feedClass: 'regulatory' }, // FCC rulemakings — spectrum/broadband/media-ownership regulatory context
        { name: 'TeleGeography Submarine Cable Status', apiKey: 'TELEGEOGRAPHY_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'www.submarinecablemap.com', feedClass: 'infrastructure_status' }, // submarine/international fiber cable status — LIVE once operator key provided; falls back to heuristic
        { name: 'CelesTrak Satellite Catalog', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json', feedClass: 'infrastructure_status' }, // active communications-satellite constellation health / conjunction proximity (NORAD TLEs)
        { name: 'NERC Reliability (Telecom Load)', apiKey: 'NERC_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'api.nerc.net/reliability/metrics', feedClass: 'infrastructure_dependency' }, // grid power feeding telecom/data-center infrastructure — LIVE once operator key provided
        { name: 'Telecom Net Subscriber Adds', apiKey: 'CARRIER_REPORTING_API', status: FEED_STATUS.PENDING, endpoint: 'internal:carrier-nacs-reporting', feedClass: 'demand_signal' }, // aggregate carrier net-adds / churn / ARPU — connectivity demand signal; PENDING until carrier reporting bridge added
        // ── News / narrative / press-freedom signals (kept — qualitative information-flow channel) ──
        { name: 'NewsAPI Headlines', apiKey: 'NEWS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'newsapi.org/v2/top-headlines' },
        { name: 'RSS Media', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'multi-source-rss-aggregator' },
        { name: 'NewsGuard Media Trust Index', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.newsguardtech.com/ratings/rating-process-criteria/', feedClass: 'institutional_quality' }, // NewsGuard credibility ratings — institutional-quality proxy for journalism trust
        { name: 'Reporters Without Borders', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'rsf.org/en/rss.xml' },
        { name: 'CPJ Press Freedom', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'cpj.org/feed' },
        { name: 'Snopes Fact Checks', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'snopes.com/feed' },
        { name: 'Poynter Media News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'poynter.org/feed' },
        { name: 'Nieman Lab', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'niemanlab.org/feed' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 12. Culture ──────────────────────────────────────────────────
    {
      id: 'culture',
      runtimeKey: 'culture',
      label: 'Culture',
      group: 'identity',
      description: 'Arts, humanities, heritage, entertainment, social identity, creative expression.',
      analystEnabled: true,
      connectomeNodes: [1, 2],  // mPFC + PCC
      feeds: [
        { name: 'Event Registry', apiKey: 'EVENT_REGISTRY_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'eventregistry.org/api/v1/article/getArticles' },
        { name: 'GDELT Tone', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.gdeltproject.org/api/v2/summary/summary' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 13. Defense ──────────────────────────────────────────────────
    {
      id: 'defense',
      runtimeKey: 'defense',
      label: 'Defense',
      group: 'protection',
      description: 'Military, national security, strategic deterrence, civil defense, force projection.',
      analystEnabled: true,
      connectomeNodes: [17, 18],  // BLA + CeA
      feeds: [
        // ── Industrial-base "price/cost" anchors (real quantitative metrics) ──
        // Defense equivalent of energy's EIA/FRED commodity anchors: instead of
        // oil/gas spot prices, defense's signal is the DEFENSE INDUSTRIAL BASE —
        // prime-contractor financial health (order backlog / capex / margins) plus
        // federal procurement authority and obligations. Every FRED series_id is a
        // REAL identifier and every ticker is a REAL listed defense prime (never
        // fabricated). This closes the registry asymmetry where defense had only
        // qualitative news/analysis and no live price/cost anchor like energy.
        // -- Federal procurement & budget authority (the "crude price" of defense) --
        { name: 'FRED National Defense Outlays', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=FDEFX', feedClass: 'price_cost' },          // federal national defense consumption + investment — defense "crude" anchor (mirrors EIA Petroleum LIVE)
        { name: 'FRED Defense Gross Investment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=A997RC1Q027SBEA', feedClass: 'price_cost' }, // national defense gross investment (procurement/RDT&E capital) — capex anchor (mirrors FRED Crude Oil LIVE)
        { name: 'FRED Defense Consumption Expenditures', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=DGDEFX', feedClass: 'price_cost' }, // real national defense consumption expenditures — readiness spend trend
        { name: 'FRED Defense Share of GDP', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=A824RE1Q156NBEA', feedClass: 'price_cost' }, // national defense as % of GDP — strategic burden anchor
        // -- Procurement pipeline (contracts, obligations, budget authority) --
        { name: 'SAM.gov Contract Opportunities', apiKey: 'SAM_GOV_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'api.sam.gov/opportunities/v2/search?ptype=o&deptname=DEPT+OF+DEFENSE', feedClass: 'procurement' }, // active DoD solicitations — procurement pipeline; LIVE once operator key provided, falls back to heuristic
        { name: 'USAspending DoD Awards', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.usaspending.gov/api/v2/search/spending_by_award/', feedClass: 'procurement' },        // obligated DoD contract awards — backlog / obligation throughput
        { name: 'USAspending DoD Budget Authority', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.usaspending.gov/api/v2/agency/097/budgetary_resources/', feedClass: 'procurement' }, // DoD (agency 097) FY budget authority — appropriated procurement capacity
        // -- Prime-contractor financial health (REAL listed defense primes, never fabricated) --
        // Per-name equities for the defense industrial base; the company analogue of
        // energy's commodity anchors. Tickers are REAL: LMT/RTX/NOC/GD/BA/LHX/HII/LDOS/BAH/KTOS/AVAV.
        { name: 'Polygon.io LMT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LMT/prev', feedClass: 'contractor', ticker: 'LMT' },   // Lockheed Martin — prime (air dominance / missiles)
        { name: 'Polygon.io RTX', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/RTX/prev', feedClass: 'contractor', ticker: 'RTX' },   // RTX (Raytheon) — prime (missiles / sensors)
        { name: 'Polygon.io NOC', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NOC/prev', feedClass: 'contractor', ticker: 'NOC' },   // Northrop Grumman — prime (strategic / space / B-21)
        { name: 'Polygon.io GD', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/GD/prev', feedClass: 'contractor', ticker: 'GD' },      // General Dynamics — prime (combat systems / submarines)
        { name: 'Polygon.io BA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/BA/prev', feedClass: 'contractor', ticker: 'BA' },      // Boeing — prime (defense/space/security segment)
        { name: 'Polygon.io LHX', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LHX/prev', feedClass: 'contractor', ticker: 'LHX' },   // L3Harris — prime (C4ISR / electronic warfare)
        { name: 'Polygon.io HII', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/HII/prev', feedClass: 'contractor', ticker: 'HII' },   // Huntington Ingalls — prime (naval shipbuilding / carriers)
        { name: 'Polygon.io LDOS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LDOS/prev', feedClass: 'contractor', ticker: 'LDOS' }, // Leidos — prime (defense IT / systems integration)
        { name: 'Polygon.io BAH', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/BAH/prev', feedClass: 'contractor', ticker: 'BAH' },   // Booz Allen Hamilton — prime (defense advisory / analytics)
        { name: 'Polygon.io KTOS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/KTOS/prev', feedClass: 'contractor', ticker: 'KTOS' }, // Kratos — emerging prime (unmanned / hypersonics / drones)
        { name: 'Polygon.io AVAV', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/AVAV/prev', feedClass: 'contractor', ticker: 'AVAV' }, // AeroVironment — emerging prime (loitering munitions / UAS)
        { name: 'Polygon.io ITA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ITA/prev', feedClass: 'sector_proxy', ticker: 'ITA' },  // iShares Aerospace & Defense ETF — industrial-base regime proxy
        // -- Strategic reserves / industrial-base supply-chain status (CSIS + federal stock) --
        { name: 'CSIS Defense Industrial Base', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'csis.org/programs/defense-industrial-initiatives-group/rss', feedClass: 'industrial_base' }, // DIB analysis — production rates / supply-chain KPIs / munitions stockpile reports
        { name: 'USGS Defense-Critical Minerals', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.usgs.gov/centers/national-minerals-information-center/rss.xml', feedClass: 'industrial_base' }, // strategic & critical materials (rare earths, titanium) — DIB supply anchor
        { name: 'GAO Defense Reports', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.gao.gov/rss/topic/national-defense.xml', feedClass: 'industrial_base' }, // GAO program/readiness oversight — production-rate & sustainment findings
        // ── Qualitative signals (news / analysis / conflict & geopolitical context) ──
        { name: 'RSS Defense Signals', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'multi-source-defense-rss' },
        { name: 'RSS Defense Conflict', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'multi-source-conflict-rss' },
        { name: 'Defense News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'defensenews.com/arc/outboundfeeds/rss' },
        { name: 'Breaking Defense', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'breakingdefense.com/feed' },
        { name: 'ISW Daily Updates', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'understandingwar.org/rss.xml' },
        { name: 'RUSI Commentary', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'rusi.org/rss.xml' },
        { name: 'NATO News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'nato.int/cps/en/natohq/news.rss' },
        { name: 'Defense One', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'defenseone.com/rss/all' },
        { name: 'The War Zone', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'twz.com/feed' },
        { name: 'CSIS Analysis', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'csis.org/rss/analysis' },
        { name: 'SIPRI Arms Trade', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'sipri.org/rss/news.xml' },
        { name: 'TASS (Russia)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'tass.com/rss/all.xml', feedClass: 'adversary_state', country: 'RU' },
        { name: 'Xinhua (China)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'xinhuanet.com/english/rss/worldrss.xml', feedClass: 'adversary_state', country: 'CN' },
        { name: 'Global Times (China)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'globaltimes.cn/rss/outbrain.xml', feedClass: 'adversary_state', country: 'CN' },
        { name: 'Press TV (Iran)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'presstv.ir/rss.xml', feedClass: 'adversary_state', country: 'IR' },
        { name: 'KCNA Watch (DPRK)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'kcnawatch.org/feed', feedClass: 'adversary_state', country: 'KP' },
        { name: 'South China Morning Post', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'scmp.com/rss/91/feed', feedClass: 'regional_perspective', country: 'HK' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 14. Environment ──────────────────────────────────────────────
    {
      id: 'environment',
      runtimeKey: 'environment',
      label: 'Environment',
      group: 'substrate',
      description: 'Ecosystems, biodiversity, climate systems, pollution control, conservation.',
      analystEnabled: true,
      connectomeNodes: [31, 73],  // Hypothalamus + ENS
      feeds: [
        // ── Climate / weather observation anchors (the environment "crude price" baseline) ──
        // Environment's quantitative spine is NOT a commodity price but the physical
        // state of the planet (temperature anomaly, emissions load, air/water quality)
        // plus the financial health of the environmental-services & water-infrastructure
        // industrial base. Every endpoint is a REAL public/government source and every
        // ticker is a REAL listed environmental-sector equity (never fabricated). This
        // closes the registry asymmetry where environment had only 2 NOAA weather feeds
        // and no emissions, carbon-market, biodiversity, or industrial-base anchor.
        { name: 'NOAA Climate', apiKey: 'NOAA_TOKEN', status: FEED_STATUS.LIVE, endpoint: 'www.ncei.noaa.gov/cdo-web/api/v2/data', feedClass: 'climate_observation' },
        { name: 'NOAA Alerts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.weather.gov/alerts/active', feedClass: 'climate_observation' },
        { name: 'NOAA Global Temperature Anomaly', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series', feedClass: 'climate_observation' }, // planetary warming trend — environment "set-point" anchor
        { name: 'NOAA GML CO2 (Mauna Loa)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv', feedClass: 'climate_observation' }, // atmospheric CO2 concentration — the canonical emissions-load signal
        // ── Emissions & pollution inventory (EPA — the regulatory "price/cost" of environment) ──
        { name: 'EPA GHG Inventory (GHGI)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.epa.gov/ghgreporting/data-sets', feedClass: 'emissions' }, // national greenhouse gas inventory — emissions-load anchor (mirrors EIA Petroleum LIVE role)
        { name: 'EPA FLIGHT GHGRP', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'ghgdata.epa.gov/ghgp/service/facilityDetail', feedClass: 'emissions' }, // facility-level reported emissions — point-source emitter detection
        { name: 'EPA AirNow AQI', apiKey: 'AIRNOW_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'www.airnowapi.org/aq/observation/zipCode/current/', feedClass: 'air_quality' }, // real-time PM2.5/ozone AQI — air-quality stress; LIVE once operator key provided
        { name: 'EPA ECHO Enforcement', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'echodata.epa.gov/echo/cwa_rest_services.get_facilities', feedClass: 'enforcement' }, // Clean Water/Air Act violations & enforcement — pollution-control conflict signal
        { name: 'EPA Superfund (SEMS)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'data.epa.gov/efservice/SEMS_ACTIVE_SITES/JSON', feedClass: 'remediation' }, // active Superfund/NPL remediation sites — cleanup pipeline anchor
        // ── Water stress / hydrology (USGS + NOAA — freshwater system state) ──
        { name: 'USGS Water Services', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'waterservices.usgs.gov/nwis/iv/', feedClass: 'water_stress' }, // real-time streamflow / groundwater levels — water-stress index
        { name: 'USGS Drought Monitor', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'droughtmonitor.unl.edu/DmData/GISData.aspx', feedClass: 'water_stress' }, // U.S. drought severity — freshwater scarcity signal
        // ── Carbon markets (compliance-market price indices — environment's traded anchor) ──
        { name: 'CARB Cap-and-Trade Auction', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'ww2.arb.ca.gov/our-work/programs/cap-and-trade-program/auction-information', feedClass: 'carbon_market' }, // California carbon allowance clearing price — compliance carbon anchor
        { name: 'RGGI Allowance Auction', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.rggi.org/auctions/auction-results', feedClass: 'carbon_market' }, // Northeast RGGI CO2 allowance price — regional carbon market signal
        { name: 'EU ETS Carbon Price (EEX)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.eex.com/en/market-data/environmental-markets/spot-market', feedClass: 'carbon_market' }, // EU emissions-trading allowance price — global compliance-carbon benchmark
        // ── Biodiversity / habitat (ecosystem-health indices) ──
        { name: 'GBIF Occurrence', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.gbif.org/v1/occurrence/search', feedClass: 'biodiversity' }, // global species occurrence records — biodiversity baseline / range-shift detection
        { name: 'IUCN Red List', apiKey: 'IUCN_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'apiv3.iucnredlist.org/api/v3/species', feedClass: 'biodiversity' }, // species extinction-risk status — biodiversity-credit & mass-extinction signal; LIVE once operator key provided
        { name: 'NASA FIRMS Active Fire', apiKey: 'NASA_FIRMS_KEY', status: FEED_STATUS.PENDING, endpoint: 'firms.modaps.eosdis.nasa.gov/api/area/csv/', feedClass: 'biodiversity' }, // satellite active-fire / deforestation detection — habitat-loss signal; LIVE once operator key provided
        // ── Remediation / cleanup procurement (federal environmental contract pipeline) ──
        { name: 'SAM.gov Environmental Remediation', apiKey: 'SAM_GOV_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'api.sam.gov/opportunities/v2/search?ptype=o&ncode=562910', feedClass: 'procurement' }, // active environmental remediation solicitations (NAICS 562910) — cleanup pipeline; LIVE once operator key provided
        { name: 'USAspending EPA Awards', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.usaspending.gov/api/v2/search/spending_by_award/', feedClass: 'procurement' }, // obligated EPA / federal environmental contract awards — remediation throughput
        // ── Environmental-services & water-infrastructure industrial base (REAL listed equities, never fabricated) ──
        // Per-name equities for the environmental industrial base; the company analogue of
        // energy's commodity anchors. Tickers are REAL: WM/RSG/WCN/CWST/AWK/WTRG/XYL/ECL/LIN/APD/DAR/AY/CLH/TTEK.
        { name: 'Polygon.io WM', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/WM/prev', feedClass: 'enviro_services', ticker: 'WM' },     // Waste Management — prime (waste / landfill / recycling)
        { name: 'Polygon.io RSG', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/RSG/prev', feedClass: 'enviro_services', ticker: 'RSG' },   // Republic Services — prime (waste / environmental solutions)
        { name: 'Polygon.io WCN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/WCN/prev', feedClass: 'enviro_services', ticker: 'WCN' },   // Waste Connections — prime (solid waste / resource recovery)
        { name: 'Polygon.io CWST', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CWST/prev', feedClass: 'enviro_services', ticker: 'CWST' }, // Casella Waste — regional waste / recycling operator
        { name: 'Polygon.io CLH', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CLH/prev', feedClass: 'remediation', ticker: 'CLH' },     // Clean Harbors — prime (hazardous-waste / remediation / spill response)
        { name: 'Polygon.io TTEK', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TTEK/prev', feedClass: 'remediation', ticker: 'TTEK' }, // Tetra Tech — prime (environmental consulting / remediation engineering)
        { name: 'Polygon.io AWK', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/AWK/prev', feedClass: 'water_utility', ticker: 'AWK' },   // American Water Works — prime (regulated water/wastewater utility)
        { name: 'Polygon.io WTRG', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/WTRG/prev', feedClass: 'water_utility', ticker: 'WTRG' }, // Essential Utilities (Aqua) — prime (regulated water utility)
        { name: 'Polygon.io XYL', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/XYL/prev', feedClass: 'water_tech', ticker: 'XYL' },     // Xylem — prime (water technology / treatment / smart water)
        { name: 'Polygon.io ECL', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ECL/prev', feedClass: 'water_tech', ticker: 'ECL' },     // Ecolab — prime (water treatment / hygiene / pollution prevention)
        { name: 'Polygon.io LIN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LIN/prev', feedClass: 'carbon_removal', ticker: 'LIN' },  // Linde — industrial gases / carbon-capture & clean-hydrogen infrastructure
        { name: 'Polygon.io APD', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/APD/prev', feedClass: 'carbon_removal', ticker: 'APD' },  // Air Products — industrial gases / carbon capture / clean-hydrogen
        { name: 'Polygon.io DAR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/DAR/prev', feedClass: 'circular_economy', ticker: 'DAR' }, // Darling Ingredients — rendering / waste-to-resource / renewable feedstock
        { name: 'Polygon.io AY', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/AY/prev', feedClass: 'sector_proxy', ticker: 'AY' },       // Atlantica Sustainable Infrastructure — clean/sustainable infrastructure proxy
        { name: 'Polygon.io ICLN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/ICLN/prev', feedClass: 'sector_proxy', ticker: 'ICLN' }  // iShares Global Clean Energy ETF — environmental-transition regime proxy
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 15. Religion ─────────────────────────────────────────────────
    {
      id: 'religion',
      runtimeKey: 'religion',
      label: 'Religion & Symbolic Systems',
      group: 'meaning',
      description: 'Theology, spiritual institutions, philosophical frameworks, moral order, ritual.',
      analystEnabled: true,
      connectomeNodes: [1, 9],  // mPFC + ACC
      feeds: [
        { name: 'GDELT Religion', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.gdeltproject.org/api/v2/doc/doc' },
        { name: 'Event Registry Religion', apiKey: 'EVENT_REGISTRY_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'eventregistry.org/api/v1/article/getArticles' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 16. Population ───────────────────────────────────────────────
    {
      id: 'population',
      runtimeKey: 'population',
      label: 'Population & Demographics',
      group: 'organism',
      description: 'Birth rates, migration, aging, urbanization, labor force, demographic transition.',
      analystEnabled: true,
      connectomeNodes: [31, 1],  // Hypothalamus + mPFC
      feeds: [
        // ── Demographic "price/cost" discovery anchors (the population "crude price" baseline) ──
        // Population equivalent of energy's EIA/FRED commodity anchors: instead of oil/gas
        // spot prices, population's quantitative spine is the VITAL-RATE COMPLEX — fertility
        // (crude birth rate / total fertility rate = the "crude oil" primary input), mortality
        // (crude death rate / mortality by cause = the "refining" output), and net migration
        // (= the "trading" flow). These three identity rates need quantitative high-frequency
        // discovery, plus a supply/demand-balance forecast (population projections, dependency
        // ratios, age structure = the demographic dividend/burden). Every endpoint is a REAL
        // public/government or institutional source (US Census, UN WPP, CDC NCHS, FRED, BLS,
        // DHS, Pew). Population binds to INDICATORS not single companies. This closes the
        // asymmetry where population had only World Bank total + a generic UN stub and no live
        // vital-rate price-discovery, projection-forecast, or institutional-quality anchor like
        // energy. Labor market (economy), mortality/health (medicine), enrollment (education)
        // and governance remain COUPLINGS, not population's own content.
        // -- Fertility & mortality identity: vital-rate price discovery (the "crude oil + refining" of population) --
        { name: 'CDC WONDER Natality', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'wonder.cdc.gov/controller/datarequest/D149', feedClass: 'fertility', metric: 'births' }, // CDC NCHS births by age/race/state — US birth-rate discovery (mirrors EIA Petroleum LIVE role)
        { name: 'CDC WONDER Mortality', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'wonder.cdc.gov/controller/datarequest/D158', feedClass: 'mortality', metric: 'deaths' }, // CDC NCHS deaths by cause/age/state — US mortality discovery (the "refining" output)
        { name: 'CDC NCHS Vital Statistics Rapid Release', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cdc.gov/nchs/nvss/vsrr.htm', feedClass: 'vital_rates' }, // monthly provisional births/deaths — high-frequency vital-rate trend (mirrors WASDE directional cadence)
        { name: 'UN Demographic Yearbook', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'unstats.un.org/unsd/demographic-social/products/dyb/', feedClass: 'vital_rates' }, // global births/deaths by country — international vital-rate context
        { name: 'DHS Program API', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.dhsprogram.com/rest/dhs/data?indicatorIds=FE_FRTR_W_TFR,FE_FRTR_W_CBR', feedClass: 'fertility' }, // Demographic & Health Surveys — TFR/CBR by country (fertility "crude" for the developing world)
        { name: 'Guttmacher Institute Data', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.guttmacher.org/data', feedClass: 'fertility' }, // family-planning / fertility-determinant research — fertility input context
        // -- FRED demographic macro series (real series_ids — analogue to economy's FRED depth) --
        { name: 'FRED US Crude Birth Rate', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SPDYNCBRTINUSA', feedClass: 'fertility', metric: 'crude_birth_rate' }, // crude birth rate, US (annual) — fertility trend anchor (mirrors FRED Crude Oil LIVE)
        { name: 'FRED US Crude Death Rate', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SPDYNCDRTINUSA', feedClass: 'mortality', metric: 'crude_death_rate' }, // crude death rate, US (annual) — mortality trend anchor
        { name: 'FRED US Total Fertility Rate', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SPDYNTFRTINUSA', feedClass: 'fertility', metric: 'tfr' }, // total fertility rate, US (annual) — births-per-woman replacement signal
        { name: 'FRED US Age Dependency Ratio', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SPPOPDPNDUSA', feedClass: 'dependency', metric: 'dependency_ratio' }, // age dependency ratio, US (annual) — demographic-dividend/burden balance (the supply/demand forecast)
        { name: 'FRED US Population 65+', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SPPOP65UPTOZSUSA', feedClass: 'aging', metric: 'pct_65_plus' }, // population ages 65+ % of total, US (annual) — aging / generational-shift signal
        { name: 'FRED US Net Migration', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=SMPOPNETMUSA', feedClass: 'migration', metric: 'net_migration' }, // net migration, US (5-yr) — migration-flow trend (the "trading flow")
        { name: 'FRED US Total Households', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=TTLHHM156N', feedClass: 'household_formation', metric: 'total_households' }, // total US households (monthly) — household-formation / housing-demand driver
        { name: 'FRED US Labor Force Participation', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=CIVPART', feedClass: 'labor_supply', metric: 'lfpr' }, // civilian labor force participation rate (monthly) — labor-supply / human-capital signal
        // -- Demographics & population dynamics: census + projection supply/demand balance --
        { name: 'US Census ACS 1-Year', apiKey: 'CENSUS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.census.gov/data/2022/acs/acs1', feedClass: 'demographics' }, // American Community Survey 1-yr — rolling population/age/income/household discovery
        { name: 'US Census ACS 5-Year', apiKey: 'CENSUS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.census.gov/data/2022/acs/acs5', feedClass: 'demographics' }, // ACS 5-yr — small-area demographic detail
        { name: 'US Census Population Estimates', apiKey: 'CENSUS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.census.gov/data/2023/pep/population', feedClass: 'demographics' }, // annual population estimates by geography — between-decennial population trend
        { name: 'US Census Decennial', apiKey: 'CENSUS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.census.gov/data/2020/dec/pl', feedClass: 'demographics' }, // 2020 decennial — population baseline / apportionment
        { name: 'UN World Population Prospects', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'population.un.org/dataportalapi/api/v1/data/indicators/47/locations/all', feedClass: 'projection' }, // UN WPP projections by country/age (annual) — the supply/demand-balance forecast (mirrors USDA WASDE)
        { name: 'World Bank Population', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json', feedClass: 'demographics' }, // total population (annual) — original baseline (retained)
        { name: 'UN Population Data Portal', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'population.un.org/dataportalapi/api/v1/data/indicators/', feedClass: 'demographics' }, // UN population indicators — generic baseline (retained)
        // -- Migration & immigration + urbanization & settlement flows --
        { name: 'IOM World Migration Report', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'worldmigrationreport.iom.int/', feedClass: 'migration' }, // IOM bilateral migration flows / stocks — international migration-flow discovery
        { name: 'UN-Habitat Urban Data', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'data.unhabitat.org/', feedClass: 'urbanization' }, // urban population / settlement indicators — urbanization & settlement signal
        { name: 'US Census Migration Flows', apiKey: 'CENSUS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.census.gov/data/2022/acs/flows', feedClass: 'migration' }, // county-to-county migration flows — internal-migration discovery
        // -- Labor force supply projections (BLS — human-capital supply by demographic) --
        { name: 'BLS Labor Force Projections', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.bls.gov/emp/tables/civilian-labor-force-summary.htm', feedClass: 'labor_supply' }, // BLS labor force projections by age/sex/race — labor-supply forecast
        { name: 'BLS Labor Force Statistics (CPS)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.bls.gov/publicAPI/v2/timeseries/data/', feedClass: 'labor_supply' }, // CPS labor force by demographic — participation / unemployment by group
        // ── Demographic-exposed REAL proxies (never fabricated; indicators-bound domain, proxies only where housing/aging demand needs a price) ──
        // Population mostly binds to indicators; where demographic demand needs a tradable
        // price the proxies are REAL listed senior-living / housing / aging-exposed names mapped
        // to the relevant vital rate (aging → senior-living occupancy; household formation →
        // housing demand). Tickers are REAL: WELL/VTR/OHI/SBRA/HCM-class healthcare REITs +
        // housing/migration-exposed names. These are DEMAND proxies, not population's identity.
        { name: 'Polygon.io WELL', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/WELL/prev', feedClass: 'senior_living', ticker: 'WELL' },  // Welltower — senior-living / aging-population housing-demand proxy
        { name: 'Polygon.io VTR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/VTR/prev', feedClass: 'senior_living', ticker: 'VTR' },    // Ventas — senior housing / healthcare REIT (aging demand)
        { name: 'Polygon.io OHI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/OHI/prev', feedClass: 'senior_living', ticker: 'OHI' },    // Omega Healthcare — skilled-nursing REIT (oldest-old demand)
        { name: 'Polygon.io SBRA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/SBRA/prev', feedClass: 'senior_living', ticker: 'SBRA' }, // Sabra Health Care — senior-care REIT (aging demand)
        { name: 'Polygon.io AVB', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/AVB/prev', feedClass: 'household_formation', ticker: 'AVB' }, // AvalonBay — apartment REIT (household-formation / migration housing demand)
        { name: 'Polygon.io INVH', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/INVH/prev', feedClass: 'household_formation', ticker: 'INVH' }, // Invitation Homes — single-family rental (family-formation housing demand)
        { name: 'Polygon.io LEN', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LEN/prev', feedClass: 'household_formation', ticker: 'LEN' }, // Lennar — homebuilder (household-formation / new-household demand)
        { name: 'Zillow Research Data', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.zillow.com/research/data/', feedClass: 'household_formation' }, // Zillow housing / migration indices — housing-demand & migration-flow proxy
        // ── Institutional-quality anchors (census coverage / vital-registration completeness) ──
        // Analogue of education's CHEA accreditation + energy's NERC reliability + governance's
        // WGI: data-system quality is itself a signal. Census coverage error and vital-
        // registration completeness gate how trustworthy every rate above is.
        { name: 'US Census Coverage Measurement', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.census.gov/programs-surveys/decennial-census/decade/coverage-estimation.html', feedClass: 'data_quality' }, // census coverage / undercount by geography — population-count reliability anchor
        { name: 'World Bank Vital Registration Completeness', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/SP.REG.BRTH.ZS?format=json', feedClass: 'data_quality' }, // birth-registration completeness by country — vital-rate reliability anchor
        { name: 'WHO Excess Mortality / Mortality Database', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.who.int/data/data-collection-tools/who-mortality-database', feedClass: 'data_quality' }, // WHO mortality-data completeness / excess-mortality — death-data reliability anchor
        // ── Qualitative signals (demographic research / sector context) ──
        { name: 'Pew Research Demographics', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.pewresearch.org/topic/population-trends/feed/', feedClass: 'sector_research' }, // Pew demographic research / surveys — generational & social-structure context
        { name: 'US Census Newsroom', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.census.gov/newsroom/press-releases.rss', feedClass: 'sector_news' }, // Census releases — estimates / ACS / migration announcements
        { name: 'PRB Population Reference Bureau', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.prb.org/feed/', feedClass: 'sector_research' } // PRB — global population dynamics / aging / household analysis
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 17. Supply Chain (civilization: Trade) ───────────────────────
    {
      id: 'trade',
      runtimeKey: 'supplyChain',
      label: 'Trade & Logistics',
      group: 'movement',
      description: 'Supply chains, freight, shipping, customs, international commerce, last-mile delivery.',
      analystEnabled: true,
      connectomeNodes: [73, 6],  // ENS + OFC
      feeds: [
        { name: 'BLS Freight PPI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.bls.gov/publicAPI/v2/timeseries/data/' },
        { name: 'EIA Supply', apiKey: 'EIA_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.eia.gov/v2/petroleum/sum/sndw/data/' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 18. Law ──────────────────────────────────────────────────────
    {
      id: 'law',
      runtimeKey: 'law',
      label: 'Law & Regulation',
      group: 'order',
      description: 'Legal codes, regulatory bodies, enforcement, compliance, standards, due process.',
      analystEnabled: true,
      connectomeNodes: [12, 13],  // DLPFC + vlPFC
      feeds: [
        // ── Judicial-system capacity "price/cost" anchors (real quantitative legal-system metrics) ──
        // Law equivalent of energy's EIA/FRED commodity anchors and governance's WGI/V-Dem
        // institutional-quality indices: instead of oil/gas spot prices, law's quantitative
        // spine is the measured STATE OF THE JUDICIAL SYSTEM — caseload throughput, docket-
        // processing latency, rule-of-law index, litigation pace, incarceration baseline, and
        // appellate/sentencing outcomes. The identity is the JUDICIARY / COURTS / RULE OF LAW
        // / ENFORCEMENT — distinct from governance (policy/administration/elections/public
        // finance). Caseload & throughput = energy grid demand & dispatch; rule-of-law index
        // degradation = grid frequency/voltage instability (early system-breakdown warning).
        // Every index/series is REAL (WJP, US Courts, USSC, BJS, NCSC) — never fabricated. This
        // closes the asymmetry where law had only qualitative docket/enforcement RSS and no
        // institutional-quality anchor like energy's commodity price or governance's WGI.
        // -- World Justice Project Rule of Law Index (the "crude price" of the legal system) --
        // WJP's annual country-level index scores judicial independence, civil & criminal
        // procedural fairness, and contract/property enforcement; the native judicial-system
        // anchor (NOT borrowed from governance's WGI RL.EST). Mirrors EIA Petroleum's role.
        { name: 'WJP Rule of Law Index', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'worldjusticeproject.org/rule-of-law-index/global/2024', feedClass: 'judicial_quality', seriesId: 'WJP_RULEOFLAWINDEX' },                        // overall rule-of-law index — legal-system capacity anchor (mirrors EIA Petroleum LIVE)
        { name: 'WJP Civil Justice Factor', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'worldjusticeproject.org/rule-of-law-index/factors/2024/Civil%20Justice', feedClass: 'judicial_quality', seriesId: 'WJP_CIVILJUSTICE' },       // civil justice subindex — access/no-delay/effective-enforcement
        { name: 'WJP Criminal Justice Factor', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'worldjusticeproject.org/rule-of-law-index/factors/2024/Criminal%20Justice', feedClass: 'judicial_quality', seriesId: 'WJP_CRIMINALJUSTICE' }, // criminal justice subindex — effective/impartial adjudication & due process
        { name: 'WJP Order & Security Factor', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'worldjusticeproject.org/rule-of-law-index/factors/2024/Order%20and%20Security', feedClass: 'judicial_quality', seriesId: 'WJP_ORDERSECURITY' }, // order & security subindex — rule-of-law stability anchor (frequency/voltage analogue)
        // -- US Courts caseload & docket-throughput (federal judicial dispatch/demand) --
        // Administrative Office of the U.S. Courts Judicial Business / Judiciary Data tables:
        // filings, terminations, pending caseload, and median case-resolution time by district
        // & circuit. The throughput anchor = energy grid demand & dispatch. Series are REAL.
        { name: 'ABA Federal Caseload (Judicial Business)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.uscourts.gov/data-news/judicial-business', feedClass: 'caseload', seriesId: 'ABA_CASELOAD_FEDERAL' },                 // AO/Judicial Conference annual federal district & appellate caseload — filings/dispositions throughput anchor
        { name: 'US Courts Federal Court Management Statistics', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.uscourts.gov/data-news/data-tables', feedClass: 'caseload', seriesId: 'USCOURTS_FCMS_MEDIANTIME' },              // Federal Court Management Statistics — median months filing-to-disposition (docket latency / resolution-time anchor)
        { name: 'US Courts Appellate Reversal Rates', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.uscourts.gov/data-news/data-tables/2024/12/31/judicial-business-2024/b-5', feedClass: 'caseload', seriesId: 'USCOURTS_APPEALS_REVERSAL' }, // courts-of-appeals dispositions / affirm-reverse-remand rates — appellate-outcome signal
        // -- Sentencing & criminal-justice outcomes (US Sentencing Commission, REAL datafiles) --
        { name: 'US Sentencing Commission Datafiles', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ussc.gov/research/datafiles/commission-datafiles', feedClass: 'sentencing', seriesId: 'SENTENCING_COMMISSION_DATAFILES' }, // USSC individual-offender datafiles — conviction/sentence-length trends by offense (sentencing-outcome anchor)
        { name: 'US Sentencing Commission Quick Facts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ussc.gov/research/quick-facts', feedClass: 'sentencing', seriesId: 'USSC_QUICKFACTS' },                                  // USSC Quick Facts — per-offense sentencing summaries (criminal-justice throughput context)
        // -- Incarceration & corrections baseline (Bureau of Justice Statistics, DOJ) --
        { name: 'BJS Incarceration Rate', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'bjs.ojp.gov/data-collection/national-prisoner-statistics-nps-program', feedClass: 'corrections', seriesId: 'INCARCERATION_RATE' },         // BJS National Prisoner Statistics — incarceration per 100k baseline (corrections-system load anchor)
        { name: 'BJS Federal Justice Statistics', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'bjs.ojp.gov/data-collection/federal-justice-statistics-program-fjsp', feedClass: 'corrections', seriesId: 'BJS_FEDERAL_JUSTICE' }, // BJS Federal Justice Statistics — arrest-to-conviction pipeline volumes (enforcement throughput)
        // -- Civil litigation pace (National Center for State Courts — state-court resolution time) --
        { name: 'NCSC Court Statistics (Civil Litigation Pace)', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.courtstatistics.org/court-statistics', feedClass: 'caseload', seriesId: 'CIVIL_LITIGATION_PACE' },             // NCSC Court Statistics Project — state-court case resolution time / time-to-disposition (civil docket-pace anchor)
        // -- Legal-services & compliance industrial base (REAL listed equities, never fabricated) --
        // Law's INDUSTRIAL-BASE analogue to energy's commodity anchors and governance's govtech
        // primes: the firms that supply legal research, court/compliance software, and tax-
        // regulatory enforcement tooling. Tickers are REAL: RELX (RELX plc — LexisNexis legal
        // research & risk), TRI (Thomson Reuters — Westlaw / legal & regulatory), VERX (Vertex —
        // tax/regulatory compliance automation), CSGP (CoStar — property/contract data analogue).
        { name: 'Polygon.io RELX', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/RELX/prev', feedClass: 'legal_services', ticker: 'RELX' },  // RELX plc — LexisNexis (legal research / litigation analytics / risk & compliance data)
        { name: 'Polygon.io TRI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/TRI/prev', feedClass: 'legal_services', ticker: 'TRI' },    // Thomson Reuters — Westlaw (legal research / case law / regulatory intelligence)
        { name: 'Polygon.io VERX', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/VERX/prev', feedClass: 'legal_services', ticker: 'VERX' }, // Vertex Inc. — tax & regulatory compliance automation (enforcement/compliance tooling)
        { name: 'Polygon.io CSGP', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CSGP/prev', feedClass: 'legal_services', ticker: 'CSGP' }, // CoStar Group — property/contract data & analytics (real-property-rights enforcement analogue)
        // ── Existing rulemaking / judicial / enforcement anchors (kept) ──
        { name: 'Federal Register', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.federalregister.gov/api/v1/documents.json' },
        { name: 'Regulations.gov', apiKey: 'REGULATIONS_GOV_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.regulations.gov/v4/documents' },
        // ── Law feed expansion (judicial / enforcement / compliance) ──
        // Each feed maps directly to a Law diagnosis evidence family and is
        // consumed by law-pulse-engine.js SOURCE_TYPES.
        { name: 'CourtListener', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.courtlistener.com/api/rest/v3/dockets/' },             // judicial_event / docket_event
        { name: 'PACER Docket Activity', apiKey: 'PACER_API_KEY', status: FEED_STATUS.PUBLIC, endpoint: 'pcl.uscourts.gov/pcl-public-api/rest' }, // judicial_event / docket_event
        { name: 'DOJ Press Releases', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.justice.gov/api/v1/press_release.json' },          // enforcement_event
        { name: 'SEC Enforcement Actions', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'efts.sec.gov/LATEST/search-index?forms=AAER' },   // enforcement_event / regulatory_event
        { name: 'CFPB Enforcement', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.consumerfinance.gov/api/enforcement-actions' },      // enforcement_event
        // ── Civil / Family / Federal expansion ──
        { name: 'U.S. Courts Federal Caseload', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.uscourts.gov/rss/news' },                // civil + federal docket_event / judicial_event (all 94 districts incl. civil + criminal + bankruptcy)
        { name: 'HHS AFCARS Family Court', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.acf.hhs.gov/cb/data-research/adoption-fostercare' }, // family law signals — foster care, parental rights termination, child welfare
        { name: 'Supreme Court Opinions', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.supremecourt.gov/opinions/slipopinion' }       // federal constitutional / landmark rulings
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 19. Finance ──────────────────────────────────────────────────
    {
      id: 'finance',
      runtimeKey: 'finance',
      label: 'Finance',
      group: 'capital',
      description: 'Banking, capital markets, insurance, investment, credit systems, monetary policy.',
      analystEnabled: true,
      connectomeNodes: [6, 24],  // OFC + NAc
      feeds: [
        { name: 'Alpha Vantage Market', apiKey: 'ALPHA_VANTAGE_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'www.alphavantage.co/query' },
        { name: 'Finnhub Market', apiKey: 'FINNHUB_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'finnhub.io/api/v1/quote' }
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    },

    // ─── 20. Intelligence ─────────────────────────────────────────────
    {
      id: 'intelligence',
      runtimeKey: 'intelligence',
      label: 'Intelligence & Data',
      group: 'awareness',
      description: 'Data collection, analytics, national intelligence, surveillance, information warfare.',
      analystEnabled: true,
      connectomeNodes: [8, 12],  // AI + DLPFC
      feeds: [
        // ── Operational throughput "price/cost" anchors (real quantitative metrics) ──
        // Intelligence equivalent of energy's EIA/FRED commodity anchors and defense's
        // industrial-base anchors: instead of oil/gas spot prices or contractor backlog,
        // intelligence's signal is the rate at which COLLECTION + PRODUCTION capacity is
        // EXERCISED — IC budget authority (NIPF total via DNI/congressional docs), SIGINT
        // collection volume, HUMINT network health, GEOINT exploitation rate, counterintel
        // incident baseline, and analyst retention. These are the domain's "price/cost"
        // equivalent: throughput KPIs of the collection-to-assessment cycle. The identity
        // is COLLECTION/ANALYSIS/ESPIONAGE — distinct from defense (kinetic/industrial/
        // readiness) and technology (cyber tooling is a coupling, not the identity). Every
        // FRED series_id is REAL and every ticker is a REAL listed intelligence-sector firm
        // (never fabricated). This closes the registry asymmetry where intelligence had only
        // 2 generic search/event feeds and no live collection/production anchor like energy.
        // -- IC budget authority (the "crude price" of intelligence: appropriated capacity) --
        { name: 'USAspending ODNI Budget Authority', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.usaspending.gov/api/v2/agency/056/budgetary_resources/', feedClass: 'production' }, // ODNI (agency 056) FY budget authority — NIP/MIP appropriated collection+production capacity (mirrors EIA Petroleum LIVE)
        { name: 'FRED Federal Nondefense Outlays', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations?series_id=FNDEFX', feedClass: 'production' },     // federal nondefense consumption+investment — civil-IC budget envelope proxy (mirrors FRED Crude Oil LIVE)
        { name: 'DNI Budget & NIPF Statements', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.dni.gov/index.php/newsroom/rss.xml', feedClass: 'production' }, // DNI public budget justifications / NIPF total authority statements — IC budget authority anchor
        { name: 'Congressional Intel Appropriations', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.congress.gov/rss/most-viewed-bills.xml', feedClass: 'production' }, // intelligence authorization / appropriations bills — budget authority pipeline
        // -- Collection management & tasking pipeline (NIPF DARs, collection KPIs; PENDING operator key) --
        { name: 'NIPF Collection Tasking', apiKey: 'ODNI_NIPF_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'internal:nipf-dar-tasking-aggregator', feedClass: 'collection' }, // NIPF DARs / collection management tasking orders — LIVE once operator key/bridge provided; falls back to heuristic analyst-workload trending
        { name: 'SIGINT Collection Volume', apiKey: 'NSA_COLLECTION_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'internal:sigint-collection-volume', feedClass: 'collection' }, // NSA SIGINT collection volume KPI — collection-satisfaction "throughput" anchor (PENDING; fallback=heuristic)
        { name: 'HUMINT Network Health', apiKey: 'CIA_HUMINT_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'internal:humint-network-health', feedClass: 'collection' }, // CIA HUMINT network assessment — source-network coverage/health (PENDING; fallback=heuristic)
        { name: 'GEOINT Exploitation Rate', apiKey: 'NGA_GEOINT_API_KEY', status: FEED_STATUS.PENDING, endpoint: 'internal:geoint-exploitation-rate', feedClass: 'collection' }, // NGA GEOINT exploitation rate — imagery/GMTI processing throughput (PENDING; fallback=heuristic)
        // -- Classified production & threat warning (NSA/CIA/DIA assessments; escalation signal) --
        { name: 'DIA Threat Assessments', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.dia.mil/News/Articles/rss/', feedClass: 'production' }, // DIA worldwide threat assessment summaries — all-source production / threat escalation
        { name: 'CIA Press & Statements', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.cia.gov/stories/feed/', feedClass: 'production' }, // CIA public briefing summaries — production / assessment output channel
        { name: 'NSA/CSS Press Releases', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.nsa.gov/_layouts/15/feed.aspx', feedClass: 'production' }, // NSA/CSS cybersecurity + SIGINT product advisories — production output
        { name: 'ODNI Worldwide Threat Assessment', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.dni.gov/index.php/newsroom/reports-publications/rss.xml', feedClass: 'production' }, // annual threat assessment + ICD 203 analytic-standards production — threat-warning escalation anchor
        // -- Counterintelligence / insider-risk baseline (breaches per year; the "incident price") --
        { name: 'FBI Counterintelligence', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.fbi.gov/feeds/counterintelligence/rss.xml', feedClass: 'oversight' }, // FBI counterintel incidents — CI breach baseline / espionage-arrest signal
        { name: 'NCSC Insider-Threat Reporting', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.dni.gov/index.php/ncsc/rss.xml', feedClass: 'oversight' }, // ODNI/NCSC insider-threat + supply-chain CI advisories — insider-risk baseline
        { name: 'DOJ National Security Division', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.justice.gov/api/v1/press_release.json?component=National+Security+Division', feedClass: 'oversight' }, // espionage / Espionage Act prosecutions — counterintel incident reporting
        // -- Intelligence oversight & reform (congressional intel committees, IG, PIAB) --
        { name: 'House Intelligence Committee', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'intelligence.house.gov/news/rss.aspx', feedClass: 'oversight' }, // HPSCI press releases — oversight / reform signal
        { name: 'Senate Intelligence Committee', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.intelligence.senate.gov/rss/press.xml', feedClass: 'oversight' }, // SSCI press releases — oversight / accountability
        { name: 'IC Inspector General Findings', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.dni.gov/index.php/who-we-are/organizations/icig/rss.xml', feedClass: 'oversight' }, // IC IG reports + whistleblower-retaliation cases — accountability findings
        { name: 'PIAB / PFIAB Statements', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.whitehouse.gov/piab/feed/', feedClass: 'oversight' }, // President's Intelligence Advisory Board statements — oversight / reform
        { name: 'PCLOB Reports', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.pclob.gov/Newsroom/rss', feedClass: 'oversight' }, // Privacy & Civil Liberties Oversight Board — FISA / surveillance accountability
        // -- Intelligence-sector contractor equities (REAL listed firms, never fabricated) --
        // Per-name equities for the intelligence industrial base; the company analogue of
        // energy's commodity anchors. Tickers are REAL and map to the intelligence identity:
        // PLTR (fusion) / BAH (analysis) / LDOS (collection IT) / CACI (operations) /
        // SAIC (R&D) / KBR (logistics) / VRNT (data) / NICE (CI) / VRSK (threat).
        { name: 'Polygon.io PLTR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/PLTR/prev', feedClass: 'contractor', ticker: 'PLTR' }, // Palantir — all-source data fusion / mission analytics
        { name: 'Polygon.io BAH', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/BAH/prev', feedClass: 'contractor', ticker: 'BAH' },   // Booz Allen Hamilton — all-source analysis / advisory
        { name: 'Polygon.io LDOS', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/LDOS/prev', feedClass: 'contractor', ticker: 'LDOS' }, // Leidos — collection systems / IC IT integration
        { name: 'Polygon.io CACI', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/CACI/prev', feedClass: 'contractor', ticker: 'CACI' }, // CACI International — intelligence operations / SIGINT support
        { name: 'Polygon.io SAIC', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/SAIC/prev', feedClass: 'contractor', ticker: 'SAIC' }, // SAIC — IC R&D / systems engineering
        { name: 'Polygon.io KBR', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/KBR/prev', feedClass: 'contractor', ticker: 'KBR' },     // KBR — intelligence mission logistics / sustainment
        { name: 'Polygon.io VRNT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/VRNT/prev', feedClass: 'contractor', ticker: 'VRNT' }, // Verint — intelligence data / lawful-intercept analytics
        { name: 'Polygon.io NICE', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/NICE/prev', feedClass: 'contractor', ticker: 'NICE' }, // NICE Ltd — counterintel / interaction analytics
        { name: 'Polygon.io VRSK', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.polygon.io/v2/aggs/ticker/VRSK/prev', feedClass: 'contractor', ticker: 'VRSK' }, // Verisk Analytics — threat / risk data analytics
        // ── Policy / collection-environment context ──
        { name: 'Federal Register ODNI/FISA', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=national-intelligence-office-of-the-director', feedClass: 'policy' }, // ODNI rulemakings / FISA + surveillance authority changes — collection-environment policy
        // ── Qualitative signals (open-source intelligence / events / search) ──
        { name: 'GDELT Events', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.gdeltproject.org/api/v2/doc/doc', feedClass: 'collection' },        // OSINT event stream — open-source collection channel
        { name: 'Tavily Search', apiKey: 'TAVILY_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.tavily.com/search', feedClass: 'collection' }              // OSINT live search — open-source collection channel
      ],
      diagnostics: [],
      treatments: [],
      portals: []
    }
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // Index maps (built once)
  // ═══════════════════════════════════════════════════════════════════════

  var _byId = {};
  var _byRuntimeKey = {};
  for (var i = 0; i < DOMAINS.length; i++) {
    _byId[DOMAINS[i].id] = DOMAINS[i];
    _byRuntimeKey[DOMAINS[i].runtimeKey] = DOMAINS[i];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Query methods
  // ═══════════════════════════════════════════════════════════════════════

  function getAll() {
    return DOMAINS.slice();
  }

  function getEnabled() {
    return DOMAINS.filter(function (d) { return d.analystEnabled; });
  }

  function getById(id) {
    return _byId[id] || null;
  }

  function getByRuntimeKey(runtimeKey) {
    return _byRuntimeKey[runtimeKey] || null;
  }

  /** Map a civilization.top.json node ID to the runtime domain key */
  function toRuntimeKey(civilizationId) {
    var d = _byId[civilizationId];
    return d ? d.runtimeKey : civilizationId;
  }

  /** Map a runtime domain key back to the civilization node ID */
  function toCivilizationId(runtimeKey) {
    var d = _byRuntimeKey[runtimeKey];
    return d ? d.id : runtimeKey;
  }

  /** Get all unique API keys required across all domains */
  function getRequiredApiKeys() {
    var keys = {};
    for (var i = 0; i < DOMAINS.length; i++) {
      var feeds = DOMAINS[i].feeds;
      for (var f = 0; f < feeds.length; f++) {
        if (feeds[f].apiKey) {
          keys[feeds[f].apiKey] = {
            envVar: feeds[f].apiKey,
            usedBy: (keys[feeds[f].apiKey] ? keys[feeds[f].apiKey].usedBy : [])
          };
          keys[feeds[f].apiKey].usedBy.push({
            domain: DOMAINS[i].id,
            feed: feeds[f].name
          });
        }
      }
    }
    return keys;
  }

  /** Get feed status summary: how many live, pending, public, fallback */
  function getFeedStatusSummary() {
    var counts = { live: 0, pending: 0, public: 0, fallback: 0, total: 0 };
    for (var i = 0; i < DOMAINS.length; i++) {
      var feeds = DOMAINS[i].feeds;
      for (var f = 0; f < feeds.length; f++) {
        counts[feeds[f].status] = (counts[feeds[f].status] || 0) + 1;
        counts.total++;
      }
    }
    return counts;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════

  window.LIMENDomainRegistry = {
    DOMAINS:             DOMAINS,
    FEED_STATUS:         FEED_STATUS,
    getAll:              getAll,
    getEnabled:          getEnabled,
    getById:             getById,
    getByRuntimeKey:     getByRuntimeKey,
    toRuntimeKey:        toRuntimeKey,
    toCivilizationId:    toCivilizationId,
    getRequiredApiKeys:  getRequiredApiKeys,
    getFeedStatusSummary: getFeedStatusSummary
  };

})();
