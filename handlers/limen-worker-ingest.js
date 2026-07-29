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
/**
 * WIDENED 2026-07-29 FROM 10 DOMAINS TO 20.
 *
 * The four queries below the divider are the original set: geopolitical, energy, food and
 * military. Everything they can produce maps, through DOMAIN_MAP, onto ten domain names, so
 * communication, culture, economy, education, environment, intelligence, law, population,
 * religion and research could NEVER be tagged by this path no matter what happened in the
 * world. Not "rarely" — structurally never, because no keyword in the map emitted their names.
 *
 * Worth being precise about what that cost, because it was overstated in earlier notes: this
 * is the second of TWO afferent paths. handlers/domain-snapshot.js carries 275 per-domain
 * sources and always reached all 20. What the missing ten actually lost was the `feed_*` typed
 * content channels, which are built from this ingest's output — measured 2026-07-29, feed
 * channels were present on 8 of the 10 tagged domains and 0 of the 10 untagged. One channel
 * family, not their afferent supply.
 */
var FEED_URLS = [
  // ── original four (defense / energy / supply / military) ────────────────
  'https://news.google.com/rss/search?q=iran+OR+israel+OR+hormuz+OR+missile+OR+refinery+OR+tanker+OR+naval+attack&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=oil+price+OR+energy+crisis+OR+shipping+disruption+OR+port+attack&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=food+shortage+OR+grain+export+OR+fertilizer+crisis+OR+supply+chain+disruption&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=military+escalation+OR+war+OR+invasion+OR+nato+OR+nuclear+threat&hl=en-US&gl=US&ceid=US:en',
  // ── added, one per previously-unreachable domain ───────────────────────
  'https://news.google.com/rss/search?q=inflation+OR+recession+OR+interest+rate+decision+OR+unemployment+rate+OR+GDP+growth&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=climate+change+OR+wildfire+OR+flooding+OR+drought+OR+emissions+OR+biodiversity+loss&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=court+ruling+OR+lawsuit+filed+OR+antitrust+OR+indictment+OR+regulatory+enforcement&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=university+enrollment+OR+school+closure+OR+education+funding+OR+student+debt+OR+teacher+shortage&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=press+freedom+OR+disinformation+OR+media+layoffs+OR+censorship+OR+telecom+outage&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=espionage+OR+surveillance+program+OR+intelligence+agency+OR+classified+leak+OR+cyber+espionage&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=migration+surge+OR+refugee+crisis+OR+census+data+OR+housing+shortage+OR+birth+rate&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=religious+persecution+OR+interfaith+OR+church+closure+OR+faith+leaders+OR+sectarian+violence&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=research+funding+cut+OR+scientific+study+OR+clinical+trial+results+OR+laboratory+discovery&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=arts+funding+OR+museum+OR+film+industry+OR+music+industry+OR+cultural+heritage&hl=en-US&gl=US&ceid=US:en'
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
  CYBER_ATTACK: ['cyber attack', 'cyberattack', 'infrastructure hack'],

  // ── added 2026-07-29 for the ten domains that had no reachable event type ──
  // Phrases are preferred over bare words throughout. A single common word behaves
  // very differently once matching is word-boundary aware (see the matcher below),
  // and a two-word phrase is far less likely to be a coincidence in a headline.
  MONETARY_SHOCK: ['interest rate hike', 'rate cut', 'inflation surge', 'recession warning',
    'unemployment rises', 'gdp contraction', 'credit crunch', 'bond selloff'],
  CLIMATE_EVENT: ['wildfire', 'flooding', 'drought', 'heat wave', 'hurricane', 'emissions rise',
    'biodiversity loss', 'deforestation', 'oil spill'],
  LEGAL_ACTION: ['court ruling', 'lawsuit filed', 'antitrust', 'class action', 'indictment',
    'consent decree', 'regulatory enforcement', 'appeals court'],
  EDUCATION_STRESS: ['school closure', 'university enrollment', 'education funding', 'student debt',
    'teacher shortage', 'campus protest', 'accreditation'],
  MEDIA_PRESSURE: ['press freedom', 'disinformation', 'media layoffs', 'censorship',
    'journalist detained', 'telecom outage', 'network outage'],
  // 'cyberespionage' is listed separately because the closed-up spelling is common in this
  // beat and a leading \b will not find 'espionage' inside it. Same convention CYBER_ATTACK
  // already uses for 'cyberattack' vs 'cyber attack'. Found by auditing what the boundary
  // matcher dropped: 2 of the 81 dropped hits were real signal, and this recovers both.
  ESPIONAGE: ['espionage', 'cyberespionage', 'surveillance program', 'classified leak',
    'intelligence agency', 'counterintelligence', 'spy ring'],
  POPULATION_PRESSURE: ['refugee crisis', 'migration surge', 'housing shortage', 'birth rate',
    'population decline', 'displacement', 'aging population'],
  RELIGIOUS_TENSION: ['religious persecution', 'sectarian violence', 'church closure',
    'interfaith', 'blasphemy', 'religious freedom'],
  RESEARCH_DISRUPTION: ['research funding', 'grant cut', 'clinical trial', 'retraction',
    'laboratory closure', 'scientific breakthrough'],
  CULTURAL_SHIFT: ['arts funding', 'museum closure', 'film industry', 'music industry',
    'cultural heritage', 'box office']
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
  CYBER_ATTACK: { domains: ['technology', 'defense', 'infrastructure', 'energy'], magnitude: 0.7 },

  // ── added 2026-07-29. Every previously-unreachable domain now has at least one
  // event type that can name it. Magnitudes are deliberately LOWER than the
  // geopolitical set above: a court ruling is a real signal, but it is not a strait
  // closure, and inflating it would let routine news outrank an actual shock in
  // domainSignals[].totalMag. Secondary domains are listed only where the coupling is
  // direct enough to defend, not to make the graph look connected.
  MONETARY_SHOCK:      { domains: ['economy', 'finance', 'population'], magnitude: 0.6 },
  CLIMATE_EVENT:       { domains: ['environment', 'agriculture', 'infrastructure'], magnitude: 0.55 },
  LEGAL_ACTION:        { domains: ['law', 'governance', 'finance'], magnitude: 0.45 },
  EDUCATION_STRESS:    { domains: ['education', 'population'], magnitude: 0.45 },
  MEDIA_PRESSURE:      { domains: ['communication', 'governance'], magnitude: 0.5 },
  ESPIONAGE:           { domains: ['intelligence', 'defense', 'technology'], magnitude: 0.6 },
  POPULATION_PRESSURE: { domains: ['population', 'infrastructure', 'economy'], magnitude: 0.5 },
  RELIGIOUS_TENSION:   { domains: ['religion', 'culture'], magnitude: 0.55 },
  RESEARCH_DISRUPTION: { domains: ['research', 'health', 'education'], magnitude: 0.45 },
  CULTURAL_SHIFT:      { domains: ['culture', 'communication'], magnitude: 0.4 }
};

/**
 * WORD-BOUNDARY MATCHING, compiled once.
 *
 * Classification used `text.indexOf(keyword) !== -1`, a raw substring test. With `war` among
 * MILITARY_ESCALATION's keywords that fires on "warehouse", "warning", "award", "forward" and
 * "wartime" — so an article about a warehouse fire could raise a military-escalation signal
 * across defense, finance, energy and governance. Same defect class as lib/feed-fractal.js
 * classifying "Federal Bureau of Investigation" as litigation.
 *
 * That mattered less while the keyword set was thirteen geopolitical types; it matters a lot
 * more now that ten more event types feed ten more domains, because a false positive here does
 * not just mis-tag one article, it injects a signal into every domain the event type maps to.
 *
 * A PLAIN \b ON BOTH ENDS IS WRONG, and measuring caught it before this shipped. Anchoring
 * "airstrike" that way stops matching "airstrikes"; likewise "strike"/"strikes" and
 * "oil price"/"oil prices". Against a live run it silently dropped 9 hits, and the ones I
 * inspected were plurals in real headlines — trading a false-positive problem for a
 * false-negative one, on a system whose whole difficulty is too little signal.
 *
 * So: leading \b to stop mid-word matches (award, forward, reward), and a trailing optional
 * inflection before the closing \b. "war" matches war and wars but not warehouse, warning or
 * wartime. "oil price" matches oil prices. Suffixes are enumerated rather than using \w* on
 * purpose — \w* would readmit warehouse through the front door.
 *
 * Regexes are built at module load, not per article: the classifier tests every keyword
 * against every article, and recompiling inside that loop would be the expensive way to do
 * identical work.
 */
var KEYWORD_RE = (function () {
  var out = {};
  for (var et in EVENT_KEYWORDS) {
    if (!EVENT_KEYWORDS.hasOwnProperty(et)) continue;
    out[et] = EVENT_KEYWORDS[et].map(function (kw) {
      var esc = String(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('\\b' + esc + '(?:s|es|ed|ing)?\\b', 'i');
    });
  }
  return out;
})();

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
    for (var et in KEYWORD_RE) {
      for (var ki = 0; ki < KEYWORD_RE[et].length; ki++) {
        if (KEYWORD_RE[et][ki].test(text)) {
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

  // TTL 1200s (20m) > the 15m ingest cadence, same fix/rationale as console_snapshot: a 300s (5m) TTL
  // expired ~10 min before the next ingest run, right around when limen-worker-snapshot (fires ~5m after
  // ingest) tried to read it — a race that made downstream consumers (the energy feed fractal) silently
  // see a stale/missing key most of the time. Found while wiring real ingest headlines into the estimator.
  await db.set('latest_ingest', ingestResult, 1200);
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

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('limen-worker-ingest', module.exports);
