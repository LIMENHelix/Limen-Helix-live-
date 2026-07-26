/**
 * api/religion-live.js — the world's faiths + how belief is in the news (free, no key).
 *
 * GET /api/religion-live         → global religious make-up + faith news by theme
 * GET /api/religion-live?fresh=1 → bypass cache (ops)
 *
 * The demographic make-up is stable reference data from Pew Research (Global Religious
 * Landscape). The live layer is Google News RSS across faith themes (links only).
 * Redis-cached ~1 h. Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
// v2: the theme rows gained a `vsub` and capped themes now render as "100+". Without moving
// the key, Redis serves the old shape for a full hour and the fix looks like it did nothing.
var KEY = 'rel:live:v2';
var TTL_MS = 60 * 60 * 1000;

// Pew Research, Global Religious Landscape (share of world population). Reference data.
var FAITHS = [
  { name: 'Christianity', pct: 31.1, pop: '2.4 billion' },
  { name: 'Islam', pct: 24.9, pop: '1.9 billion' },
  { name: 'Religiously unaffiliated', pct: 15.6, pop: '1.2 billion' },
  { name: 'Hinduism', pct: 15.2, pop: '1.2 billion' },
  { name: 'Buddhism', pct: 6.6, pop: '500 million' },
  { name: 'Folk & traditional', pct: 5.6, pop: '430 million' },
  { name: 'Other religions', pct: 0.8, pop: '60 million' },
  { name: 'Judaism', pct: 0.2, pop: '15 million' }
];

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }

var RSS_CAP = 100;   // Google News RSS hard limit per query

async function fetchTheme(label, query) {
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text(), chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 6; i++) {
    var c = chunks[i];
    var rawTitle = decode(m1(/<title>([\s\S]*?)<\/title>/, c)), link = decode(m1(/<link>([\s\S]*?)<\/link>/, c));
    var pub = decode(m1(/<pubDate>([\s\S]*?)<\/pubDate>/, c)), source = decode(m1(/<source[^>]*>([\s\S]*?)<\/source>/, c));
    var title = rawTitle;
    if (source && title.indexOf(' - ' + source) !== -1) title = title.slice(0, title.lastIndexOf(' - ' + source));
    else { var dash = title.lastIndexOf(' - '); if (dash > 30) { if (!source) source = title.slice(dash + 3); title = title.slice(0, dash); } }
    if (title && link) items.push({ title: title, meta: label + ' · ' + (source || 'News') + (pub ? ' · ' + pub.slice(0, 12) : ''), href: link });
  }
  // Google News RSS returns AT MOST 100 items per query. A theme that comes back with 100 is
  // at the ceiling, so the number is a floor, not a count, and two themes at 100 cannot be
  // ranked against each other. Carry that fact rather than pretending 100 is a measurement.
  var n = body.split('<item>').length - 1;
  return { label: label, count: n, capped: n >= RSS_CAP, items: items };
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [{ name: 'Pew Research', live: false }, { name: 'Google News', live: true }] };

  // static demographic backbone
  out.stats.push({ n: '31%', k: 'World’s largest faith', c: 'Christianity, ~2.4 billion people', hot: true });
  out.stats.push({ n: '25%', k: 'Muslim', c: 'Islam, ~1.9 billion and growing fastest' });
  out.stats.push({ n: '16%', k: 'Religiously unaffiliated', c: 'the "nones", ~1.2 billion' });

  out.sections.push({
    title: 'The world by faith', note: 'Pew Research',
    sub: 'Share of humanity by religion, from Pew Research’s Global Religious Landscape. Reference data, not a live feed.',
    rows: FAITHS.map(function (f) { return { name: f.name, value: f.pct + '%', vsub: f.pop }; })
  });

  out.wow.push('About 31% of humanity, some 2.4 billion people, identify as Christian, the world’s largest religion.');
  out.wow.push('1.9 billion people are Muslim, and Islam is the world’s fastest-growing major religion (Pew Research).');
  out.wow.push('Around 1.2 billion people, roughly 1 in 6 worldwide, are religiously unaffiliated, the group researchers call the "nones".');
  out.wow.push('More than 8 in 10 people on Earth identify with a religious group, belief is still the global norm, not the exception.');

  var THEMES = [
    { k: 'Faith & society', q: '(religion OR faith OR church OR "religious community" OR clergy OR worship)' },
    { k: 'Religious freedom', q: '("religious freedom" OR "religious persecution" OR "religious minority" OR blasphemy OR "faith-based")' },
    { k: 'Belief & politics', q: '(evangelical OR Vatican OR "religious right" OR secular OR "faith and politics" OR interfaith)' }
  ];
  var themes = [];
  await Promise.all(THEMES.map(function (t) { return fetchTheme(t.k, t.q).then(function (r) { themes.push(r); }).catch(function () {}); }));
  themes.sort(function (a, b) { return b.count - a.count; });

  if (themes.length) {
    // When every theme is at the feed ceiling, the ranking is an artefact of the cap, not a
    // reading of attention: sort() picks an arbitrary winner among ties and the copy then
    // claims it has "most coverage". Suppress the ranked claims entirely in that case.
    var allCapped = themes.every(function (t) { return t.capped; });
    var topTied = themes.length > 1 && themes[0].capped && themes[1].capped;

    if (!allCapped && !topTied && themes[0]) {
      out.stats.push({ n: themes[0].count.toLocaleString(), k: 'Top faith story now', c: themes[0].label + ', most coverage' });
      out.wow.push('In the news right now, the most-covered religious theme is ' + themes[0].label.toLowerCase() + ' (' + themes[0].count.toLocaleString() + ' stories).');
    }

    out.sections.push({
      title: 'Faith in the news by theme', note: 'Google News',
      sub: allCapped
        ? 'Every theme is at the feed ceiling of ' + RSS_CAP + ' items, so these are floors rather than counts and cannot be ranked against each other. All it tells you is that all three are busy.'
        : 'How much the press is covering each side of religious life right now. A rough read on attention, not importance. ' + RSS_CAP + ' is the feed ceiling, so a theme showing ' + RSS_CAP + '+ is not measured.',
      rows: themes.map(function (t) {
        return {
          name: t.label,
          value: t.capped ? (RSS_CAP + '+ stories') : (t.count.toLocaleString() + ' stories'),
          vsub: t.capped ? 'at feed limit' : '',
          dir: (!t.capped && t.count >= 80) ? 'neg' : ''
        };
      })
    });
    var maxRounds = 3;
    for (var round = 0; round < maxRounds; round++) themes.forEach(function (t) { if (t.items[round]) out.cards.push(t.items[round]); });
  }

  out.todo = [
    { t: 'Meet a tradition on its own terms', d: 'The fastest way past a stereotype is a primary source or a real person. Visit a service, read a faith’s own explainer, or ask someone who practices it.' },
    { t: 'Watch for freedom, not just belief', d: 'Religious persecution is one of the most common and least-covered human-rights issues. Groups like USCIRF and Open Doors track where it is worst.' },
    { t: 'Separate faith from the loudest voices', d: 'The believers who make the news are rarely the average ones. Coverage volume above measures noise, not the quiet majority of any tradition.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the religion domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: Pew Research (Global Religious Landscape) for the demographic make-up, stable reference data, and Google News RSS across faith themes for the live layer (coverage counts are a rough attention signal). Headlines link to original sources.';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
