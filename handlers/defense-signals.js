/**
 * api/defense-signals.js
 * Vercel serverless — Defense + macro shock signal detection
 *
 * GET /api/defense-signals
 *
 * Fetches multiple RSS news feeds, classifies events by keyword,
 * clusters by time window, maps to LIMEN domains, returns structured signals.
 *
 * No auth required. Uses Google News RSS + fallback sources.
 * Stateless — client handles ingestion + audit.
 */

var FEED_URLS = [
  // Google News RSS queries — most reliable, no auth
  'https://news.google.com/rss/search?q=iran+OR+israel+OR+hormuz+OR+missile+OR+refinery+OR+tanker+OR+naval+attack&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=oil+price+OR+energy+crisis+OR+shipping+disruption+OR+port+attack&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=food+shortage+OR+grain+export+OR+fertilizer+crisis+OR+supply+chain+disruption&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=military+escalation+OR+war+OR+invasion+OR+nato+OR+nuclear+threat&hl=en-US&gl=US&ceid=US:en'
];

var TIMEOUT = 8000;
var CLUSTER_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
var MAX_ARTICLES = 100;

// Event classification keywords
var EVENT_KEYWORDS = {
  AIRSTRIKE:         ['airstrike', 'bombing', 'strike', 'airstrikes', 'bombed', 'air strike'],
  MISSILE_ATTACK:    ['missile', 'rocket', 'drone attack', 'drone strike', 'ballistic', 'cruise missile', 'intercept'],
  NAVAL_THREAT:      ['naval', 'warship', 'fleet', 'carrier', 'destroyer', 'submarine', 'navy deploys'],
  STRAIT_DISRUPTION: ['hormuz', 'strait', 'shipping route', 'shipping lane', 'blockade', 'maritime chokepoint'],
  REFINERY_ATTACK:   ['refinery', 'oil facility', 'petrochemical', 'oil infrastructure', 'pipeline attack'],
  DEPOT_ATTACK:      ['depot', 'fuel storage', 'ammunition depot', 'weapons depot'],
  PORT_DISRUPTION:   ['port attack', 'port closure', 'terminal disruption', 'harbor', 'shipping terminal'],
  TANKER_THREAT:     ['tanker', 'tanker seized', 'tanker attack', 'oil tanker'],
  FORCE_MAJEURE:     ['force majeure', 'emergency declaration', 'state of emergency'],
  OIL_SHOCK:         ['oil price', 'oil surge', 'crude spike', 'brent crude', 'oil soar', 'oil jump'],
  FOOD_CRISIS:       ['food shortage', 'grain export', 'wheat price', 'fertilizer', 'famine', 'food insecurity'],
  MILITARY_ESCALATION: ['military buildup', 'troops deployed', 'mobilization', 'invasion', 'ground offensive', 'war', 'declared war'],
  NUCLEAR_THREAT:    ['nuclear', 'nuclear threat', 'nuclear weapon', 'nuclear strike', 'nuclear posture'],
  SANCTIONS:         ['sanctions', 'embargo', 'trade ban', 'economic sanctions', 'asset freeze'],
  CYBER_ATTACK:      ['cyber attack', 'cyberattack', 'infrastructure hack', 'grid attack', 'power grid']
};

// Domain mapping: event type → affected LIMEN domains + base magnitude
var DOMAIN_MAP = {
  AIRSTRIKE:          { domains: ['defense', 'energy'], magnitude: 0.7 },
  MISSILE_ATTACK:     { domains: ['defense', 'energy', 'finance'], magnitude: 0.8 },
  NAVAL_THREAT:       { domains: ['defense', 'supplyChain', 'energy'], magnitude: 0.6 },
  STRAIT_DISRUPTION:  { domains: ['energy', 'supplyChain', 'defense', 'finance', 'agriculture'], magnitude: 0.9 },
  REFINERY_ATTACK:    { domains: ['energy', 'finance', 'industry'], magnitude: 0.85 },
  DEPOT_ATTACK:       { domains: ['defense', 'energy'], magnitude: 0.6 },
  PORT_DISRUPTION:    { domains: ['supplyChain', 'energy', 'agriculture', 'industry'], magnitude: 0.75 },
  TANKER_THREAT:      { domains: ['energy', 'supplyChain', 'finance'], magnitude: 0.7 },
  FORCE_MAJEURE:      { domains: ['energy', 'finance', 'supplyChain', 'industry'], magnitude: 0.85 },
  OIL_SHOCK:          { domains: ['energy', 'finance', 'supplyChain', 'industry', 'agriculture'], magnitude: 0.8 },
  FOOD_CRISIS:        { domains: ['agriculture', 'health', 'supplyChain', 'finance'], magnitude: 0.75 },
  MILITARY_ESCALATION:{ domains: ['defense', 'finance', 'energy', 'governance'], magnitude: 0.9 },
  NUCLEAR_THREAT:     { domains: ['defense', 'governance', 'finance', 'energy', 'health'], magnitude: 0.95 },
  SANCTIONS:          { domains: ['finance', 'supplyChain', 'energy', 'industry'], magnitude: 0.6 },
  CYBER_ATTACK:       { domains: ['technology', 'defense', 'infrastructure', 'energy'], magnitude: 0.7 }
};

// Simple RSS XML parser (no dependencies)
function parseRSS(xml) {
  var items = [];
  var itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  var match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < MAX_ARTICLES) {
    var itemXml = match[1];
    var title = _extractTag(itemXml, 'title');
    var description = _extractTag(itemXml, 'description');
    var pubDate = _extractTag(itemXml, 'pubDate');
    var link = _extractTag(itemXml, 'link');
    items.push({
      title: _stripHtml(title),
      description: _stripHtml(description),
      pubDate: pubDate ? new Date(pubDate).getTime() : Date.now(),
      link: link
    });
  }
  return items;
}

function _extractTag(xml, tag) {
  var re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>', 'i');
  var m = re.exec(xml);
  if (m) return m[1];
  re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  m = re.exec(xml);
  return m ? m[1] : '';
}

function _stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// Classify article by keywords
function classifyArticle(article) {
  var text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  var matches = [];
  for (var eventType in EVENT_KEYWORDS) {
    var keywords = EVENT_KEYWORDS[eventType];
    for (var ki = 0; ki < keywords.length; ki++) {
      if (text.indexOf(keywords[ki]) !== -1) {
        matches.push(eventType);
        break;
      }
    }
  }
  return matches;
}

// Cluster articles by event type + time window
function clusterSignals(articles) {
  var clusters = {}; // eventType → { articles, earliest, latest }
  var now = Date.now();

  for (var ai = 0; ai < articles.length; ai++) {
    var article = articles[ai];
    var types = classifyArticle(article);
    if (types.length === 0) continue;

    // Only include recent articles (last 24h)
    if (now - article.pubDate > 24 * 60 * 60 * 1000) continue;

    for (var ti = 0; ti < types.length; ti++) {
      var type = types[ti];
      if (!clusters[type]) {
        clusters[type] = { type: type, articles: [], earliest: article.pubDate, latest: article.pubDate };
      }
      clusters[type].articles.push({
        title: article.title,
        pubDate: article.pubDate,
        link: article.link
      });
      if (article.pubDate < clusters[type].earliest) clusters[type].earliest = article.pubDate;
      if (article.pubDate > clusters[type].latest) clusters[type].latest = article.pubDate;
    }
  }

  // Compute confidence per cluster
  var signals = [];
  for (var ct in clusters) {
    var cluster = clusters[ct];
    var count = cluster.articles.length;
    var confidence = count >= 4 ? 'HIGH' : (count >= 2 ? 'MEDIUM' : 'LOW');
    var confValue = count >= 4 ? 0.85 : (count >= 2 ? 0.55 : 0.25);

    var mapping = DOMAIN_MAP[ct] || { domains: ['defense'], magnitude: 0.5 };

    signals.push({
      eventType: ct,
      articleCount: count,
      confidence: confidence,
      confidenceValue: confValue,
      magnitude: mapping.magnitude,
      affectedDomains: mapping.domains,
      titles: cluster.articles.slice(0, 5).map(function(a) { return a.title; }),
      earliest: cluster.earliest,
      latest: cluster.latest,
      clusterSpanMinutes: Math.round((cluster.latest - cluster.earliest) / 60000)
    });
  }

  signals.sort(function(a, b) { return b.confidenceValue - a.confidenceValue || b.magnitude - a.magnitude; });
  return signals;
}

// Detect systemic shock
function detectMacroShock(signals) {
  var allDomains = {};
  var hasEnergy = false;
  var hasShipping = false;

  for (var si = 0; si < signals.length; si++) {
    var s = signals[si];
    if (s.confidence === 'LOW') continue;
    for (var di = 0; di < s.affectedDomains.length; di++) {
      allDomains[s.affectedDomains[di]] = true;
      if (s.affectedDomains[di] === 'energy') hasEnergy = true;
      if (s.affectedDomains[di] === 'supplyChain') hasShipping = true;
    }
  }

  var domainCount = Object.keys(allDomains).length;
  return {
    detected: domainCount >= 3 && hasEnergy && hasShipping,
    affectedDomainCount: domainCount,
    domains: Object.keys(allDomains),
    hasEnergy: hasEnergy,
    hasShipping: hasShipping
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  var allArticles = [];
  var feedResults = [];

  // Fetch all RSS feeds in parallel
  var fetchPromises = FEED_URLS.map(function(url, idx) {
    return fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'LIMEN-Helix/1.0 (defense-signal-monitor)' }
    })
    .then(function(r) { return r.text(); })
    .then(function(xml) {
      var items = parseRSS(xml);
      feedResults.push({ feed: idx, status: 'ok', articles: items.length });
      return items;
    })
    .catch(function(err) {
      feedResults.push({ feed: idx, status: 'error', error: err.message });
      return [];
    });
  });

  var results = await Promise.all(fetchPromises);
  for (var ri = 0; ri < results.length; ri++) {
    allArticles = allArticles.concat(results[ri]);
  }

  // Dedupe by title
  var seen = {};
  var deduped = [];
  for (var di = 0; di < allArticles.length; di++) {
    var key = allArticles[di].title.toLowerCase().substring(0, 60);
    if (!seen[key]) {
      seen[key] = true;
      deduped.push(allArticles[di]);
    }
  }

  // Classify + cluster
  var signals = clusterSignals(deduped);
  var macroShock = detectMacroShock(signals);

  // Build domain-level signal summaries for ingestion
  var domainSignals = {};
  for (var si = 0; si < signals.length; si++) {
    var sig = signals[si];
    for (var dsi = 0; dsi < sig.affectedDomains.length; dsi++) {
      var dom = sig.affectedDomains[dsi];
      if (!domainSignals[dom]) {
        domainSignals[dom] = { domain: dom, events: [], totalMagnitude: 0, maxConfidence: 'LOW', maxConfidenceValue: 0 };
      }
      domainSignals[dom].events.push({
        type: sig.eventType,
        confidence: sig.confidence,
        magnitude: sig.magnitude,
        articleCount: sig.articleCount
      });
      domainSignals[dom].totalMagnitude += sig.magnitude * sig.confidenceValue;
      if (sig.confidenceValue > domainSignals[dom].maxConfidenceValue) {
        domainSignals[dom].maxConfidence = sig.confidence;
        domainSignals[dom].maxConfidenceValue = sig.confidenceValue;
      }
    }
  }

  // Normalize domain magnitudes to [0, 1]
  var domainList = Object.keys(domainSignals).map(function(dk) {
    var ds = domainSignals[dk];
    ds.normalizedMagnitude = Math.min(1, Math.round(ds.totalMagnitude * 100) / 100);
    return ds;
  }).sort(function(a, b) { return b.normalizedMagnitude - a.normalizedMagnitude; });

  res.status(200).json({
    timestamp: Date.now(),
    totalArticles: deduped.length,
    feedsQueried: FEED_URLS.length,
    feedResults: feedResults,
    signals: signals,
    domainSignals: domainList,
    macroShock: macroShock,
    source: 'RSS_NEWS_CLUSTER'
  });
};
