/**
 * api/api-keys-config.js
 * Vercel serverless — API key status endpoint
 *
 * Returns which environment variables are configured (not the keys themselves).
 * Used by the front end to show feed readiness per domain.
 *
 * GET /api/api-keys-config → { configured: [...], missing: [...], summary }
 */

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

  // ─── All API keys the system can use ──────────────────────────────
  var ALL_KEYS = {
    // Group A: Financial / macro (existing live)
    FRED_API_KEY:              { group: 'financial',    domains: ['economy', 'energy', 'industry'] },
    EIA_API_KEY:               { group: 'financial',    domains: ['energy', 'supplyChain'] },

    // Group A: Financial / macro (new)
    ALPHA_VANTAGE_API_KEY:     { group: 'financial',    domains: ['finance'] },
    POLYGON_API_KEY:           { group: 'financial',    domains: ['finance'] },
    FINNHUB_API_KEY:           { group: 'financial',    domains: ['finance'] },

    // Group B: Knowledge / research
    NEWS_API_KEY:              { group: 'knowledge',    domains: ['communication'] },
    GNEWS_API_KEY:             { group: 'knowledge',    domains: ['communication'] },
    TAVILY_API_KEY:            { group: 'knowledge',    domains: ['intelligence'] },
    SERPAPI_API_KEY:            { group: 'knowledge',    domains: ['intelligence'] },
    EVENT_REGISTRY_API_KEY:    { group: 'knowledge',    domains: ['culture', 'religion'] },

    // Group C: Medical / research (existing live)
    NOAA_TOKEN:                { group: 'science',      domains: ['environment'] },
    USPTO_API_KEY:             { group: 'science',      domains: ['technology'] },

    // Group C: Medical / research (new)
    NCBI_API_KEY:              { group: 'science',      domains: ['research'] },
    SEMANTIC_SCHOLAR_API_KEY:  { group: 'science',      domains: ['research', 'health'] },

    // Group D: Geopolitical / defense
    ACLED_API_KEY:             { group: 'geopolitical', domains: ['defense'] },
    // World Bank Indicators API v2 is public — no key required

    // Group E: Agriculture
    USDA_API_KEY:              { group: 'agriculture',  domains: ['agriculture'] },

    // Group F: Law / regulation
    REGULATIONS_GOV_API_KEY:   { group: 'legal',        domains: ['law'] },

    // Group G: AI / narration
    OPENAI_API_KEY:            { group: 'ai',           domains: ['*'] },
    ELEVENLABS_API_KEY:        { group: 'ai',           domains: ['*'] }
  };

  var configured = [];
  var missing = [];

  for (var key in ALL_KEYS) {
    if (!ALL_KEYS.hasOwnProperty(key)) continue;
    var entry = {
      key: key,
      group: ALL_KEYS[key].group,
      domains: ALL_KEYS[key].domains
    };

    if (process.env[key]) {
      entry.status = 'configured';
      entry.length = process.env[key].length;  // length only, not the key
      configured.push(entry);
    } else {
      entry.status = 'missing';
      missing.push(entry);
    }
  }

  return res.status(200).json({
    configured: configured,
    missing: missing,
    summary: {
      total: configured.length + missing.length,
      configured: configured.length,
      missing: missing.length,
      groups: _groupSummary(configured, missing)
    }
  });
};

function _groupSummary(configured, missing) {
  var groups = {};
  var all = configured.concat(missing);
  for (var i = 0; i < all.length; i++) {
    var g = all[i].group;
    if (!groups[g]) groups[g] = { total: 0, configured: 0, missing: 0 };
    groups[g].total++;
    groups[g][all[i].status]++;
  }
  return groups;
}
