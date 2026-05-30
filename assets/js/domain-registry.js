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
        { name: 'FRED Unemployment', apiKey: 'FRED_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.stlouisfed.org/fred/series/observations' },
        { name: 'BLS Employment', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.bls.gov/publicAPI/v2/timeseries/data/' }
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
        { name: 'World Bank Infrastructure', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.worldbank.org/v2/country/all/indicator/IS.RRS.TOTL.KM?format=json' },
        { name: 'OECD Infrastructure', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'stats.oecd.org/restsdmx/sdmx.ashx/GetData/ITF_GOODS_TRANSPORT' },
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
        { name: 'NOAA Climate', apiKey: 'NOAA_TOKEN', status: FEED_STATUS.LIVE, endpoint: 'www.ncei.noaa.gov/cdo-web/api/v2/data' },
        { name: 'NOAA Alerts', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.weather.gov/alerts/active' }
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
        { name: 'GDELT Events', apiKey: null, status: FEED_STATUS.PUBLIC, endpoint: 'api.gdeltproject.org/api/v2/doc/doc' },
        { name: 'Tavily Search', apiKey: 'TAVILY_API_KEY', status: FEED_STATUS.LIVE, endpoint: 'api.tavily.com/search' }
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
