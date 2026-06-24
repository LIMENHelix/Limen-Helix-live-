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
        { name: 'USDA NASS', apiKey: 'USDA_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'quickstats.nass.usda.gov/api/api_GET/' },
        { name: 'FAO FAOSTAT', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'fenixservices.fao.org/faostat/api/v1/en/data/' }
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
        { name: 'World Bank Education', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/SE.XPD.TOTL.GD.ZS?format=json' },
        { name: 'OpenAlex Institutions', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.openalex.org/institutions' },
        { name: 'ED.gov News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.ed.gov/feed' },
        { name: 'NCES News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'nces.ed.gov/whatsnew/whatsnew.rss' },
        { name: 'EdWeek News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.edweek.org/feed' },
        { name: 'IES News', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'ies.ed.gov/whatsnew/whatsnew.rss' },
        { name: 'Chronicle of Higher Ed', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'www.chronicle.com/feed' }
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
        { name: 'NewsAPI Headlines', apiKey: 'NEWS_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'newsapi.org/v2/top-headlines' },
        { name: 'RSS Media', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'multi-source-rss-aggregator' },
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
        { name: 'World Bank Population', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json' },
        { name: 'UN Population', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'population.un.org/dataportalapi/api/v1/data/indicators/' }
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
