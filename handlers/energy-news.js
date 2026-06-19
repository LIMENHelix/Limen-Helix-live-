/**
 * api/energy-news.js — cached energy/utility news headlines (free, aggregated).
 *
 * GET /api/energy-news → { ok, updated, items:[{title, link, source, pubDate}] }
 *
 * Source: Google News RSS search (public, no key). We aggregate HEADLINES + LINKS to
 * the original sources — we do NOT republish article bodies (copyright). Fetched
 * server-side (Google News RSS has no CORS) and cached in Redis 30 min so each page
 * load is one cheap GET; the feed is hit at most ~2x/hour. Stale-on-failure.
 */
var db = require('../lib/limen-db');

var CACHE_KEY = 'energy:news:v1';
var TTL_MS = 30 * 60 * 1000;
var QUERY = '("electricity bill" OR "energy prices" OR "utility rates" OR "power grid" OR "data center power" OR "nuclear power" OR "oil prices" OR "natural gas" OR "renewable energy")';

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) { try { return String.fromCharCode(+n); } catch (e) { return ''; } })
    .trim();
}
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }

async function fetchNews() {
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(QUERY) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text();
  var chunks = body.split('<item>').slice(1);
  var items = [];
  for (var i = 0; i < chunks.length && items.length < 16; i++) {
    var c = chunks[i];
    var rawTitle = decode(m1(/<title>([\s\S]*?)<\/title>/, c));
    var link = decode(m1(/<link>([\s\S]*?)<\/link>/, c));
    var pub = decode(m1(/<pubDate>([\s\S]*?)<\/pubDate>/, c));
    var source = decode(m1(/<source[^>]*>([\s\S]*?)<\/source>/, c));
    // Google News titles are "Headline - Source"; split the source off the title
    var title = rawTitle;
    if (source && title.indexOf(' - ' + source) !== -1) title = title.slice(0, title.lastIndexOf(' - ' + source));
    else { var dash = title.lastIndexOf(' - '); if (dash > 30) { if (!source) source = title.slice(dash + 3); title = title.slice(0, dash); } }
    if (title && link) items.push({ title: title, link: link, source: source || 'News', pubDate: pub });
  }
  return items;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
  var now = Date.now();

  try {
    var cached = await db.get(CACHE_KEY);
    if (cached && cached.updatedMs && (now - cached.updatedMs) < TTL_MS && cached.items) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, cached: true, updated: cached.updated, items: cached.items }));
    }
  } catch (e) {}

  var items = [];
  try { items = await fetchNews(); } catch (e) {}

  if (!items.length) {
    try {
      var stale = await db.get(CACHE_KEY);
      if (stale && stale.items) {
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, cached: true, stale: true, updated: stale.updated, items: stale.items }));
      }
    } catch (e) {}
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, cached: false, items: [] }));
  }

  var payload = { updated: new Date().toISOString(), updatedMs: now, items: items };
  try { await db.set(CACHE_KEY, payload); } catch (e) {}
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, cached: false, updated: payload.updated, items: items }));
};
