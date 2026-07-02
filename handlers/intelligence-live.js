/**
 * api/intelligence-live.js — REAL global watch: flashpoints + major world events (free, no key).
 *
 * GET /api/intelligence-live         → world flashpoints by coverage + major quakes + feed
 * GET /api/intelligence-live?fresh=1 → bypass cache (ops)
 *
 * Sources (free, no key): Google News RSS across intelligence themes (conflict, cyber,
 * sanctions, unrest) and USGS earthquake feed (major world events). Headlines link to
 * original sources. Redis-cached ~45 min. Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'intel:live:v1';
var TTL_MS = 45 * 60 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }

async function fetchTheme(label, query) {
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text(), chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 8; i++) {
    var c = chunks[i];
    var rawTitle = decode(m1(/<title>([\s\S]*?)<\/title>/, c)), link = decode(m1(/<link>([\s\S]*?)<\/link>/, c));
    var pub = decode(m1(/<pubDate>([\s\S]*?)<\/pubDate>/, c)), source = decode(m1(/<source[^>]*>([\s\S]*?)<\/source>/, c));
    var title = rawTitle;
    if (source && title.indexOf(' - ' + source) !== -1) title = title.slice(0, title.lastIndexOf(' - ' + source));
    else { var dash = title.lastIndexOf(' - '); if (dash > 30) { if (!source) source = title.slice(dash + 3); title = title.slice(0, dash); } }
    if (title && link) items.push({ title: title, meta: label + ' · ' + (source || 'News') + (pub ? ' · ' + pub.slice(0, 12) : ''), href: link });
  }
  return { label: label, count: (body.split('<item>').length - 1), items: items };
}

async function fetchQuakes() {
  var r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson', { headers: { 'User-Agent': 'LIMEN-Helix-IntelWatch (limenhelix.com)' } });
  if (!r.ok) throw new Error('usgs ' + r.status);
  var d = await r.json(), f = (d.features || []).map(function (x) { return { mag: x.properties.mag, place: x.properties.place || 'unknown location' }; });
  f.sort(function (a, b) { return b.mag - a.mag; });
  return f;
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [{ name: 'Google News', live: true }] };

  var THEMES = [
    { k: 'Armed conflict', q: '(war OR conflict OR airstrike OR offensive OR ceasefire OR "front line")' },
    { k: 'Cyber & espionage', q: '(cyberattack OR hacking OR espionage OR "data breach" OR spyware OR surveillance)' },
    { k: 'Sanctions & tensions', q: '(sanctions OR "trade war" OR diplomatic OR tensions OR embargo OR standoff)' },
    { k: 'Terror & unrest', q: '(terrorism OR insurgency OR coup OR "mass protest" OR militant OR uprising)' }
  ];
  var themes = [];
  await Promise.all(THEMES.map(function (t) { return fetchTheme(t.k, t.q).then(function (r) { themes.push(r); }).catch(function () {}); }));

  if (themes.length) {
    themes.sort(function (a, b) { return b.count - a.count; });
    var total = themes.reduce(function (s, t) { return s + t.count; }, 0);
    var top = themes[0];
    out.stats.push({ n: total.toLocaleString(), k: 'Global stories tracked', c: 'conflict, cyber, sanctions & unrest', hot: true });
    if (top) out.stats.push({ n: top.count.toLocaleString(), k: 'Top flashpoint', c: top.label + ', most coverage now', hot: true });

    out.sections.push({
      title: 'World flashpoints by coverage', note: 'Google News',
      sub: 'How much the global press is covering each theme right now, a rough read on where the world’s attention is. Red marks the heaviest coverage.',
      rows: themes.map(function (t) { return { name: t.label, value: t.count.toLocaleString() + ' stories', dir: t.count >= 80 ? 'neg' : '' }; })
    });

    // merge top items across themes for the feed
    var maxRounds = 4;
    for (var round = 0; round < maxRounds; round++) { themes.forEach(function (t) { if (t.items[round]) out.cards.push(t.items[round]); }); }

    if (top) out.wow.push('Right now the world’s attention is on ' + top.label.toLowerCase() + ': ' + top.count.toLocaleString() + ' stories in the global press.');
    out.wow.push('Across conflict, cyber, sanctions, and unrest, about ' + total.toLocaleString() + ' stories are moving through the world news cycle.');
  }

  try {
    var q = await fetchQuakes();
    out.sources.push({ name: 'USGS', live: true });
    if (q.length) {
      var strong = q[0], big = q.filter(function (x) { return x.mag >= 6; }).length;
      out.stats.push({ n: String(q.length), k: 'Major quakes this week', c: 'magnitude 4.5+, worldwide' });
      out.stats.push({ n: 'M' + strong.mag, k: 'Strongest quake', c: (strong.place || '').replace(/^\d+\s*km\s*/, '') });
      out.wow.push(q.length + ' earthquakes of magnitude 4.5 or greater struck the planet this week; the strongest, M' + strong.mag + ', near ' + (strong.place || 'an unknown location') + (big ? ', and ' + big + ' topped magnitude 6' : '') + '.');
      out.sections.push({
        title: 'Major earthquakes worldwide this week', note: 'USGS',
        sub: 'Every magnitude 4.5+ quake on Earth in the last seven days, strongest first.',
        rows: q.slice(0, 12).map(function (x) { return { name: (x.place || 'unknown').replace(/^\d+\s*km\s*/, ''), value: 'M' + x.mag, dir: x.mag >= 6 ? 'neg' : '' }; })
      });
    }
  } catch (e) {}

  out.todo = [
    { t: 'Read laterally', d: 'One outlet is one angle. On a big story, open two or three sources from different countries before you decide what happened, the gaps between them are the real story.' },
    { t: 'Watch the second-order effects', d: 'A conflict or sanction abroad shows up at home as fuel, food, and shipping prices weeks later. When a region heats up, check what it exports.' },
    { t: 'Coverage is not importance', d: 'The loudest story is not always the most consequential. Volume (above) measures attention, not impact, keep an eye on the quiet, structural shifts too.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the intelligence domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: Google News RSS across four intelligence themes (coverage counts are a rough attention signal, not a measure of importance) and the USGS earthquake feed for major world events. Headlines link to original sources.';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=2700');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
