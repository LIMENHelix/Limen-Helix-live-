/**
 * api/feed-status.js
 * Vercel serverless — Feed diagnostics endpoint
 *
 * GET /api/feed-status
 *
 * Runs a live diagnostic fetch for every domain source.
 * Returns per-source status without exposing secrets.
 *
 * Output per source:
 *   domain, source, requires_auth, env_var_required, env_var_present,
 *   fetch_success, HTTP_status, parse_success, status, failure_reason
 */

var TIMEOUT = 8000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');

  var diagnostics = [];
  var envAudit = [];

  // ─── Env var audit ──────────────────────────────────────────────────
  var ENV_VARS = [
    { name: 'FRED_API_KEY',              domains: ['economy', 'energy', 'industry'] },
    { name: 'EIA_API_KEY',               domains: ['energy', 'supplyChain'] },
    { name: 'NOAA_TOKEN',                domains: ['environment'] },
    { name: 'USPTO_API_KEY',             domains: ['technology'] },
    { name: 'USDA_API_KEY',              domains: ['agriculture'] },
    { name: 'NEWS_API_KEY',              domains: ['communication'] },
    { name: 'EVENT_REGISTRY_API_KEY',    domains: ['culture', 'religion'] },
    { name: 'ACLED_API_KEY',             domains: ['defense'] },
    { name: 'REGULATIONS_GOV_API_KEY',   domains: ['law'] },
    { name: 'ALPHA_VANTAGE_API_KEY',     domains: ['finance'] },
    { name: 'FINNHUB_API_KEY',           domains: ['finance'] },
    { name: 'TAVILY_API_KEY',            domains: ['intelligence'] },
    { name: 'OPENAI_API_KEY',            domains: ['narration'] },
    { name: 'ELEVENLABS_API_KEY',        domains: ['voice'] },
    { name: 'NCBI_API_KEY',              domains: ['research'] },
    { name: 'DATA_GOV_KEY',              domains: ['law'] },
    { name: 'CONGRESS_API_KEY',          domains: ['governance'] },
    { name: 'CENSUS_API_KEY',            domains: ['population'] },
    { name: 'ACLED_EMAIL',               domains: ['defense'] }
  ];

  for (var ei = 0; ei < ENV_VARS.length; ei++) {
    var ev = ENV_VARS[ei];
    envAudit.push({
      env_var: ev.name,
      used_in_adapter: true,
      detected_in_runtime: !!process.env[ev.name],
      domain_using_it: ev.domains,
      status: process.env[ev.name] ? 'configured' : 'missing'
    });
  }

  // ─── Source definitions ─────────────────────────────────────────────
  var SOURCES = [
    // Governance
    { domain: 'governance', source: 'World Bank Governance', requires_auth: false, env_var_required: null, url: 'https://api.worldbank.org/v2/country/USA/indicator/CC.EST?format=json&date=2015:2024&per_page=5', method: 'GET', parser: 'worldbank' },
    { domain: 'governance', source: 'GDELT Governance', requires_auth: false, env_var_required: null, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=governance%20policy&mode=ArtList&maxrecords=3&format=json', method: 'GET', parser: 'gdelt' },
    // Infrastructure
    { domain: 'infrastructure', source: 'World Bank Infrastructure', requires_auth: false, env_var_required: null, url: 'https://api.worldbank.org/v2/country/USA/indicator/IS.RRS.TOTL.KM?format=json&date=2010:2024&per_page=5', method: 'GET', parser: 'worldbank' },
    { domain: 'infrastructure', source: 'OECD Infrastructure', requires_auth: false, env_var_required: null, url: 'https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_NAMAIN1@DF_QNA_EXPENDITURE_USD,1.0/USA.B1GQ.V..Q?lastNObservations=1', method: 'GET', parser: 'oecd', headers: { Accept: 'application/json' } },
    // Agriculture
    { domain: 'agriculture', source: 'USDA NASS', requires_auth: true, env_var_required: 'USDA_API_KEY', url: null, method: 'GET', parser: 'usda' },
    { domain: 'agriculture', source: 'FAO FAOSTAT', requires_auth: false, env_var_required: null, url: 'https://www.fao.org/faostat/api/v1/en/data/QCL?area_code=231&element_code=5510&item_code=15&year_code=' + (new Date().getFullYear() - 2), method: 'GET', parser: 'fao' },
    // Industry
    { domain: 'industry', source: 'FRED Industrial Production', requires_auth: true, env_var_required: 'FRED_API_KEY', url: null, method: 'GET', parser: 'fred' },
    { domain: 'industry', source: 'BLS Manufacturing PPI', requires_auth: false, env_var_required: null, url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/', method: 'POST', parser: 'bls', body: JSON.stringify({ seriesid: ['PCUOMFG--OMFG--'], startyear: String(new Date().getFullYear()), endyear: String(new Date().getFullYear()) }) },
    // Education
    { domain: 'education', source: 'World Bank Education', requires_auth: false, env_var_required: null, url: 'https://api.worldbank.org/v2/country/USA/indicator/SE.XPD.TOTL.GD.ZS?format=json&date=2015:2024&per_page=5', method: 'GET', parser: 'worldbank' },
    { domain: 'education', source: 'OpenAlex Institutions', requires_auth: false, env_var_required: null, url: 'https://api.openalex.org/institutions?filter=country_code:US&sort=works_count:desc&per_page=1&mailto=limen@limenhelix.com', method: 'GET', parser: 'openalex' },
    // Communication
    { domain: 'communication', source: 'NewsAPI Headlines', requires_auth: true, env_var_required: 'NEWS_API_KEY', url: null, method: 'GET', parser: 'newsapi' },
    { domain: 'communication', source: 'GDELT Media', requires_auth: false, env_var_required: null, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=media%20communication&mode=ArtList&maxrecords=3&format=json', method: 'GET', parser: 'gdelt' },
    // Culture
    { domain: 'culture', source: 'Event Registry', requires_auth: true, env_var_required: 'EVENT_REGISTRY_API_KEY', url: null, method: 'GET', parser: 'eventregistry' },
    { domain: 'culture', source: 'GDELT Tone', requires_auth: false, env_var_required: null, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=culture%20society&mode=ArtList&maxrecords=3&format=json', method: 'GET', parser: 'gdelt' },
    // Defense
    { domain: 'defense', source: 'ACLED Conflict', requires_auth: true, env_var_required: 'ACLED_API_KEY', url: null, method: 'GET', parser: 'acled' },
    { domain: 'defense', source: 'GDELT Conflict', requires_auth: false, env_var_required: null, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=conflict%20military%20security&mode=ArtList&maxrecords=3&format=json', method: 'GET', parser: 'gdelt' },
    // Religion
    { domain: 'religion', source: 'GDELT Religion', requires_auth: false, env_var_required: null, url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=religion%20faith%20theology&mode=ArtList&maxrecords=3&format=json', method: 'GET', parser: 'gdelt' },
    { domain: 'religion', source: 'Event Registry Religion', requires_auth: true, env_var_required: 'EVENT_REGISTRY_API_KEY', url: null, method: 'GET', parser: 'eventregistry' },
    // Population
    { domain: 'population', source: 'World Bank Population', requires_auth: false, env_var_required: null, url: 'https://api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL?format=json&date=2015:2024&per_page=5', method: 'GET', parser: 'worldbank' },
    { domain: 'population', source: 'UN Population', requires_auth: false, env_var_required: null, url: 'https://population.un.org/dataportalapi/api/v1/data/indicators/49/locations/840/start/2020/end/2025?pageSize=1', method: 'GET', parser: 'un' },
    // Law
    { domain: 'law', source: 'Federal Register', requires_auth: false, env_var_required: null, url: 'https://www.federalregister.gov/api/v1/documents.json?per_page=3&order=newest&conditions%5Btype%5D=RULE', method: 'GET', parser: 'federalregister' },
    { domain: 'law', source: 'Regulations.gov', requires_auth: true, env_var_required: 'REGULATIONS_GOV_API_KEY', url: null, method: 'GET', parser: 'regulationsgov' },
  ];

  // ─── Run all diagnostics ────────────────────────────────────────────
  var promises = SOURCES.map(function (s) { return diagnoseSource(s); });
  diagnostics = await Promise.all(promises);

  // ─── Compute per-domain status ──────────────────────────────────────
  var domainStatus = {};
  for (var i = 0; i < diagnostics.length; i++) {
    var d = diagnostics[i];
    if (!domainStatus[d.domain]) domainStatus[d.domain] = { sources: [], liveCount: 0, failCount: 0 };
    domainStatus[d.domain].sources.push(d);
    if (d.fetch_success && d.parse_success) domainStatus[d.domain].liveCount++;
    else domainStatus[d.domain].failCount++;
  }

  for (var dk in domainStatus) {
    if (!domainStatus.hasOwnProperty(dk)) continue;
    var ds = domainStatus[dk];
    if (ds.liveCount >= 2) ds.final_status = 'LIVE';
    else if (ds.liveCount === 1) ds.final_status = 'PARTIAL';
    else ds.final_status = 'FALLBACK';
  }

  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    sources: diagnostics,
    domainStatus: domainStatus,
    envAudit: envAudit
  });
};

// ─── Diagnose a single source ───────────────────────────────────────────

async function diagnoseSource(sourceDef) {
  var result = {
    domain: sourceDef.domain,
    source: sourceDef.source,
    requires_auth: sourceDef.requires_auth,
    env_var_required: sourceDef.env_var_required,
    env_var_present: sourceDef.env_var_required ? !!process.env[sourceDef.env_var_required] : true,
    fetch_success: false,
    HTTP_status: null,
    parse_success: false,
    status: 'FALLBACK',
    failure_reason: null
  };

  // Skip if auth required but key missing
  if (sourceDef.requires_auth && sourceDef.env_var_required && !process.env[sourceDef.env_var_required]) {
    result.failure_reason = sourceDef.env_var_required + ' not set in environment';
    return result;
  }

  // Build URL for keyed sources
  var url = sourceDef.url;
  if (!url) {
    url = buildKeyedUrl(sourceDef);
    if (!url) {
      result.failure_reason = 'could not build URL for ' + sourceDef.parser;
      return result;
    }
  }

  var controller;
  var timer;
  try {
    controller = new AbortController();
    timer = setTimeout(function () { controller.abort(); }, TIMEOUT);

    var fetchOpts = { signal: controller.signal, method: sourceDef.method || 'GET' };
    if (sourceDef.headers) fetchOpts.headers = sourceDef.headers;
    if (sourceDef.body) {
      fetchOpts.body = sourceDef.body;
      fetchOpts.headers = Object.assign({ 'Content-Type': 'application/json' }, fetchOpts.headers || {});
    }

    var resp = await fetch(url, fetchOpts);
    clearTimeout(timer);
    result.HTTP_status = resp.status;
    result.fetch_success = resp.ok;

    if (!resp.ok) {
      result.failure_reason = 'HTTP ' + resp.status;
      // If public source got data even with non-200, still count as attempted
      return result;
    }

    var text = await resp.text();
    var data;
    try {
      data = JSON.parse(text);
      result.parse_success = true;
    } catch (pe) {
      // Some APIs return XML or plain text
      if (text && text.length > 0) {
        result.parse_success = true; // got data, just not JSON
        result.failure_reason = 'response is not JSON (' + text.substring(0, 50) + '...)';
      } else {
        result.failure_reason = 'empty response body';
      }
      result.status = result.fetch_success ? 'PARTIAL' : 'FALLBACK';
      return result;
    }

    // Validate data has expected structure
    var valid = validateParse(sourceDef.parser, data);
    if (!valid.ok) {
      result.parse_success = false;
      result.failure_reason = valid.reason;
      result.status = 'PARTIAL';
      return result;
    }

    // Success
    result.status = sourceDef.requires_auth ? 'LIVE' : 'PUBLIC';
    return result;

  } catch (e) {
    if (timer) clearTimeout(timer);
    result.failure_reason = e.name === 'AbortError' ? 'timeout (' + TIMEOUT + 'ms)' : e.message;
    return result;
  }
}

function buildKeyedUrl(sourceDef) {
  var key;
  switch (sourceDef.parser) {
    case 'usda':
      key = process.env.USDA_API_KEY;
      return 'https://quickstats.nass.usda.gov/api/api_GET/?key=' + key + '&commodity_desc=CORN&statisticcat_desc=YIELD&year__GE=' + (new Date().getFullYear() - 2) + '&agg_level_desc=NATIONAL&format=JSON';
    case 'fred':
      key = process.env.FRED_API_KEY;
      return 'https://api.stlouisfed.org/fred/series/observations?series_id=INDPRO&api_key=' + key + '&file_type=json&limit=1&sort_order=desc';
    case 'newsapi':
      key = process.env.NEWS_API_KEY;
      return 'https://newsapi.org/v2/top-headlines?country=us&pageSize=3&apiKey=' + key;
    case 'eventregistry':
      key = process.env.EVENT_REGISTRY_API_KEY;
      return 'https://eventregistry.org/api/v1/article/getArticles?apiKey=' + key + '&keyword=culture&articlesCount=3&resultType=articles';
    case 'acled':
      key = process.env.ACLED_API_KEY;
      var email = process.env.ACLED_EMAIL || '';
      return 'https://api.acleddata.com/acled/read?key=' + key + '&email=' + encodeURIComponent(email) + '&limit=5';
    case 'regulationsgov':
      key = process.env.REGULATIONS_GOV_API_KEY;
      return 'https://api.regulations.gov/v4/documents?api_key=' + key + '&page[size]=3';
    default:
      return null;
  }
}

function validateParse(parser, data) {
  switch (parser) {
    case 'worldbank':
      if (!data || !Array.isArray(data) || data.length < 2) return { ok: false, reason: 'World Bank: expected [meta, data] array, got ' + typeof data };
      if (!data[1] || !Array.isArray(data[1]) || data[1].length === 0) return { ok: false, reason: 'World Bank: data[1] empty or missing' };
      // Walk to find first non-null value
      var found = false;
      for (var i = 0; i < data[1].length; i++) { if (data[1][i].value !== null) { found = true; break; } }
      if (!found) return { ok: false, reason: 'World Bank: all values null in response (data gap for recent years)' };
      return { ok: true };
    case 'gdelt':
      if (!data || !data.articles) return { ok: false, reason: 'GDELT: no articles field' };
      if (!Array.isArray(data.articles) || data.articles.length === 0) return { ok: false, reason: 'GDELT: articles array empty' };
      return { ok: true };
    case 'oecd':
      if (!data) return { ok: false, reason: 'OECD: empty response' };
      return { ok: true };
    case 'usda':
      if (!data || !data.data || !Array.isArray(data.data)) return { ok: false, reason: 'USDA: no data array' };
      if (data.data.length === 0) return { ok: false, reason: 'USDA: data array empty' };
      return { ok: true };
    case 'fao':
      if (!data) return { ok: false, reason: 'FAO: empty response' };
      return { ok: true };
    case 'fred':
      if (!data || !data.observations) return { ok: false, reason: 'FRED: no observations' };
      if (data.observations.length === 0) return { ok: false, reason: 'FRED: observations empty' };
      return { ok: true };
    case 'bls':
      if (!data || data.status !== 'REQUEST_SUCCEEDED') return { ok: false, reason: 'BLS: status ' + (data ? data.status : 'null') };
      return { ok: true };
    case 'openalex':
      if (!data || !data.results) return { ok: false, reason: 'OpenAlex: no results' };
      return { ok: true };
    case 'newsapi':
      if (!data || data.status !== 'ok') return { ok: false, reason: 'NewsAPI: status ' + (data ? data.status : 'null') + ' — ' + (data ? data.message || '' : '') };
      return { ok: true };
    case 'eventregistry':
      if (!data || !data.articles) return { ok: false, reason: 'EventRegistry: no articles' };
      return { ok: true };
    case 'acled':
      if (!data) return { ok: false, reason: 'ACLED: null response' };
      if (data.error) return { ok: false, reason: 'ACLED: ' + (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) };
      if (!data.data) return { ok: false, reason: 'ACLED: no data field' };
      return { ok: true };
    case 'un':
      if (!data) return { ok: false, reason: 'UN: empty response' };
      return { ok: true };
    case 'federalregister':
      if (!data || !data.results) return { ok: false, reason: 'FedReg: no results' };
      return { ok: true };
    case 'regulationsgov':
      if (!data || !data.data) return { ok: false, reason: 'Regulations.gov: no data' };
      return { ok: true };
    default:
      return { ok: true };
  }
}
