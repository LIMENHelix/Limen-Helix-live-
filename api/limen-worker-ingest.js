/**
 * api/limen-worker/ingest.js — Server-side ingestion worker
 *
 * GET /api/limen-worker/ingest
 *
 * Runs the defense RSS signal engine server-side.
 * Classifies, clusters, maps to domains, stores results.
 * Called by cron every 2 minutes.
 *
 * No browser needed. No localStorage. Uses limen-db.
 */

var db = require('../lib/limen-db');

// Import defense signal logic (same as api/defense-signals.js core)
var FEED_URLS = [
  'https://news.google.com/rss/search?q=iran+OR+israel+OR+hormuz+OR+missile+OR+refinery+OR+tanker+OR+naval+attack&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=oil+price+OR+energy+crisis+OR+shipping+disruption+OR+port+attack&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=food+shortage+OR+grain+export+OR+fertilizer+crisis+OR+supply+chain+disruption&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=military+escalation+OR+war+OR+invasion+OR+nato+OR+nuclear+threat&hl=en-US&gl=US&ceid=US:en'
];

var EVENT_KEYWORDS = {
  AIRSTRIKE: ['airstrike', 'bombing', 'strike', 'airstrikes', 'bombed'],
  MISSILE_ATTACK: ['missile', 'rocket', 'drone attack', 'drone strike', 'ballistic'],
  NAVAL_THREAT: ['naval', 'warship', 'fleet', 'carrier', 'destroyer'],
  STRAIT_DISRUPTION: ['hormuz', 'strait', 'shipping route', 'blockade'],
  REFINERY_ATTACK: ['refinery', 'oil facility', 'petrochemical', 'pipeline attack'],
  PORT_DISRUPTION: ['port attack', 'port closure', 'terminal disruption'],
  TANKER_THREAT: ['tanker seized', 'tanker attack', 'oil tanker'],
  OIL_SHOCK: ['oil price', 'oil surge', 'crude spike', 'brent crude', 'oil soar'],
  FOOD_CRISIS: ['food shortage', 'grain export', 'wheat price', 'famine', 'food insecurity'],
  MILITARY_ESCALATION: ['military buildup', 'troops deployed', 'mobilization', 'invasion', 'war'],
  NUCLEAR_THREAT: ['nuclear', 'nuclear threat', 'nuclear weapon', 'nuclear strike'],
  SANCTIONS: ['sanctions', 'embargo', 'trade ban', 'economic sanctions'],
  CYBER_ATTACK: ['cyber attack', 'cyberattack', 'infrastructure hack']
};

var DOMAIN_MAP = {
  AIRSTRIKE: { domains: ['defense', 'energy'], magnitude: 0.7 },
  MISSILE_ATTACK: { domains: ['defense', 'energy', 'finance'], magnitude: 0.8 },
  NAVAL_THREAT: { domains: ['defense', 'supplyChain', 'energy'], magnitude: 0.6 },
  STRAIT_DISRUPTION: { domains: ['energy', 'supplyChain', 'defense', 'finance', 'agriculture'], magnitude: 0.9 },
  REFINERY_ATTACK: { domains: ['energy', 'finance', 'industry'], magnitude: 0.85 },
  PORT_DISRUPTION: { domains: ['supplyChain', 'energy', 'agriculture', 'industry'], magnitude: 0.75 },
  TANKER_THREAT: { domains: ['energy', 'supplyChain', 'finance'], magnitude: 0.7 },
  OIL_SHOCK: { domains: ['energy', 'finance', 'supplyChain', 'industry', 'agriculture'], magnitude: 0.8 },
  FOOD_CRISIS: { domains: ['agriculture', 'health', 'supplyChain', 'finance'], magnitude: 0.75 },
  MILITARY_ESCALATION: { domains: ['defense', 'finance', 'energy', 'governance'], magnitude: 0.9 },
  NUCLEAR_THREAT: { domains: ['defense', 'governance', 'finance', 'energy', 'health'], magnitude: 0.95 },
  SANCTIONS: { domains: ['finance', 'supplyChain', 'energy', 'industry'], magnitude: 0.6 },
  CYBER_ATTACK: { domains: ['technology', 'defense', 'infrastructure', 'energy'], magnitude: 0.7 }
};

function _extractTag(xml, tag) {
  var re = new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>', 'i');
  var m = re.exec(xml);
  if (m) return m[1];
  re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  m = re.exec(xml);
  return m ? m[1] : '';
}

function _stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var start = Date.now();

  // Fetch all RSS feeds
  var allArticles = [];
  var feedStatus = [];

  var results = await Promise.allSettled(FEED_URLS.map(function(url, idx) {
    return fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'LIMEN-Helix-Worker/1.0' }
    }).then(function(r) { return r.text(); }).then(function(xml) {
      var items = [];
      var re = /<item>([\s\S]*?)<\/item>/gi;
      var m;
      while ((m = re.exec(xml)) !== null && items.length < 100) {
        items.push({
          title: _stripHtml(_extractTag(m[1], 'title')),
          description: _stripHtml(_extractTag(m[1], 'description')),
          pubDate: new Date(_extractTag(m[1], 'pubDate') || Date.now()).getTime()
        });
      }
      feedStatus.push({ feed: idx, ok: true, count: items.length });
      return items;
    }).catch(function(e) {
      feedStatus.push({ feed: idx, ok: false, error: e.message });
      return [];
    });
  }));

  for (var ri = 0; ri < results.length; ri++) {
    if (results[ri].status === 'fulfilled') allArticles = allArticles.concat(results[ri].value);
  }

  // Dedupe by title
  var seen = {};
  var deduped = [];
  for (var di = 0; di < allArticles.length; di++) {
    var key = allArticles[di].title.toLowerCase().substring(0, 60);
    if (!seen[key]) { seen[key] = true; deduped.push(allArticles[di]); }
  }

  // Classify + cluster
  var clusters = {};
  var now = Date.now();
  for (var ai = 0; ai < deduped.length; ai++) {
    var text = (deduped[ai].title + ' ' + deduped[ai].description).toLowerCase();
    if (now - deduped[ai].pubDate > 24 * 3600000) continue;
    for (var et in EVENT_KEYWORDS) {
      for (var ki = 0; ki < EVENT_KEYWORDS[et].length; ki++) {
        if (text.indexOf(EVENT_KEYWORDS[et][ki]) !== -1) {
          if (!clusters[et]) clusters[et] = { type: et, count: 0, titles: [] };
          clusters[et].count++;
          if (clusters[et].titles.length < 5) clusters[et].titles.push(deduped[ai].title);
          break;
        }
      }
    }
  }

  // Build signals
  var signals = [];
  for (var ct in clusters) {
    var c = clusters[ct];
    var confidence = c.count >= 4 ? 'HIGH' : (c.count >= 2 ? 'MEDIUM' : 'LOW');
    var mapping = DOMAIN_MAP[ct] || { domains: ['defense'], magnitude: 0.5 };
    signals.push({
      eventType: ct, articleCount: c.count, confidence: confidence,
      confidenceValue: c.count >= 4 ? 0.85 : (c.count >= 2 ? 0.55 : 0.25),
      magnitude: mapping.magnitude, affectedDomains: mapping.domains,
      titles: c.titles
    });
  }
  signals.sort(function(a, b) { return b.confidenceValue - a.confidenceValue; });

  // Macro shock detection
  var allDomains = {};
  var hasEnergy = false, hasSupply = false;
  for (var si = 0; si < signals.length; si++) {
    if (signals[si].confidence === 'LOW') continue;
    signals[si].affectedDomains.forEach(function(d) {
      allDomains[d] = true;
      if (d === 'energy') hasEnergy = true;
      if (d === 'supplyChain') hasSupply = true;
    });
  }
  var macroShock = {
    detected: Object.keys(allDomains).length >= 3 && hasEnergy && hasSupply,
    domains: Object.keys(allDomains),
    affectedDomainCount: Object.keys(allDomains).length
  };

  // Domain signal summaries
  var domainSignals = {};
  for (var dsi = 0; dsi < signals.length; dsi++) {
    var sig = signals[dsi];
    for (var ddi = 0; ddi < sig.affectedDomains.length; ddi++) {
      var dom = sig.affectedDomains[ddi];
      if (!domainSignals[dom]) domainSignals[dom] = { domain: dom, totalMag: 0, maxConf: 'LOW', maxConfVal: 0, events: [] };
      domainSignals[dom].totalMag += sig.magnitude * sig.confidenceValue;
      domainSignals[dom].events.push({ type: sig.eventType, count: sig.articleCount, confidence: sig.confidence });
      if (sig.confidenceValue > domainSignals[dom].maxConfVal) {
        domainSignals[dom].maxConf = sig.confidence;
        domainSignals[dom].maxConfVal = sig.confidenceValue;
      }
    }
  }

  var domainList = Object.keys(domainSignals).map(function(dk) {
    var ds = domainSignals[dk];
    ds.normalizedMagnitude = Math.min(1, Math.round(ds.totalMag * 100) / 100);
    return ds;
  }).sort(function(a, b) { return b.normalizedMagnitude - a.normalizedMagnitude; });

  // Store results in DB
  var ingestResult = {
    timestamp: now,
    totalArticles: deduped.length,
    signals: signals,
    domainSignals: domainList,
    macroShock: macroShock,
    feedStatus: feedStatus,
    processedIn: Date.now() - start
  };

  await db.set('latest_ingest', ingestResult, 300); // 5 min TTL
  await db.set('macro_shock', macroShock, 300);

  // Store domain deltas for aggregation worker
  var domainDeltas = {};
  for (var dli = 0; dli < domainList.length; dli++) {
    var dl = domainList[dli];
    domainDeltas[dl.domain] = {
      delta: Math.min(0.25, dl.normalizedMagnitude * 0.3),
      confidence: dl.maxConf,
      source: 'rss_defense',
      events: dl.events.slice(0, 3)
    };
  }
  await db.set('domain_deltas', domainDeltas, 300);

  // Log ingest event
  await db.lpush('ingest_log', { timestamp: now, articles: deduped.length, signals: signals.length, macroShock: macroShock.detected });
  await db.ltrim('ingest_log', 0, 499); // keep last 500

  res.status(200).json({
    ok: true,
    backend: db.getBackend(),
    articles: deduped.length,
    signals: signals.length,
    macroShock: macroShock.detected,
    domains: domainList.length,
    processedIn: Date.now() - start + 'ms'
  });
};
