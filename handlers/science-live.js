/**
 * api/science-live.js — REAL science: asteroids passing Earth + newest research (free, no key).
 *
 * GET /api/science-live         → near-Earth asteroids this week + newest arXiv papers + news
 * GET /api/science-live?fresh=1 → bypass cache (ops)
 *
 * Sources (free): NASA NeoWs near-Earth-object feed (DEMO_KEY, no signup), arXiv API
 * (newest preprints, keyless), Google News RSS (links only). Redis-cached ~4 h.
 * Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'sci:live:v1';
var TTL_MS = 4 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function comma(n) { return Math.round(n).toLocaleString('en-US'); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }

async function fetchNews() {
  var q = '(NASA OR "new study" OR research OR discovery OR physics OR "space telescope" OR scientists OR breakthrough OR quantum)';
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text(), chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 10; i++) {
    var c = chunks[i];
    var rawTitle = decode(m1(/<title>([\s\S]*?)<\/title>/, c)), link = decode(m1(/<link>([\s\S]*?)<\/link>/, c));
    var pub = decode(m1(/<pubDate>([\s\S]*?)<\/pubDate>/, c)), source = decode(m1(/<source[^>]*>([\s\S]*?)<\/source>/, c));
    var title = rawTitle;
    if (source && title.indexOf(' - ' + source) !== -1) title = title.slice(0, title.lastIndexOf(' - ' + source));
    else { var dash = title.lastIndexOf(' - '); if (dash > 30) { if (!source) source = title.slice(dash + 3); title = title.slice(0, dash); } }
    if (title && link) items.push({ title: title, meta: (source || 'News') + (pub ? ' · ' + pub.slice(0, 16) : ''), href: link });
  }
  return items;
}

async function fetchArxiv() {
  var qy = 'cat:cs.AI+OR+cat:astro-ph.EP+OR+cat:q-bio.NC+OR+cat:cond-mat.mtrl-sci+OR+cat:physics.gen-ph';
  var url = 'http://export.arxiv.org/api/query?search_query=' + qy + '&sortBy=submittedDate&sortOrder=descending&max_results=12';
  var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-ScienceWatch (limenhelix.com)' } }); if (!r.ok) throw new Error('arxiv ' + r.status);
  var body = await r.text(), chunks = body.split('<entry>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 12; i++) {
    var c = chunks[i];
    var title = decode(m1(/<title>([\s\S]*?)<\/title>/, c)), id = m1(/<id>([\s\S]*?)<\/id>/, c);
    var cat = m1(/<arxiv:primary_category[^>]*term="([^"]+)"/, c) || m1(/<category[^>]*term="([^"]+)"/, c);
    var pub = m1(/<published>([^<]+)/, c), summary = decode(m1(/<summary>([\s\S]*?)<\/summary>/, c));
    if (title && id) items.push({ title: title, meta: 'arXiv · ' + (cat || 'preprint') + (pub ? ' · ' + pub.slice(0, 10) : ''), body: summary.slice(0, 170), href: id.trim() });
  }
  return items;
}

async function fetchNeo() {
  var start = new Date().toISOString().slice(0, 10), end = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  var r = await fetch('https://api.nasa.gov/neo/rest/v1/feed?start_date=' + start + '&end_date=' + end + '&api_key=DEMO_KEY', { headers: { 'User-Agent': 'LIMEN-Helix-ScienceWatch (limenhelix.com)' } });
  if (!r.ok) throw new Error('neo ' + r.status);
  var jd = await r.json(), byDate = jd.near_earth_objects || {}, list = [];
  Object.keys(byDate).forEach(function (d) {
    (byDate[d] || []).forEach(function (o) {
      var ca = (o.close_approach_data || [])[0] || {};
      list.push({
        name: String(o.name || '').replace(/[()]/g, ''),
        dia: (((o.estimated_diameter || {}).meters || {}).estimated_diameter_max) || 0,
        miss: parseFloat(((ca.miss_distance || {}).miles) || 0),
        vel: parseFloat(((ca.relative_velocity || {}).miles_per_hour) || 0),
        haz: !!o.is_potentially_hazardous_asteroid, date: d
      });
    });
  });
  return list;
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [] };

  var neo = [];
  try { neo = await fetchNeo(); out.sources.push({ name: 'NASA NeoWs', live: true }); } catch (e) {}
  if (neo.length) {
    neo.sort(function (a, b) { return a.miss - b.miss; });
    var closest = neo[0], haz = neo.filter(function (n) { return n.haz; }).length;
    var largest = neo.slice().sort(function (a, b) { return b.dia - a.dia; })[0];
    out.stats.push({ n: comma(neo.length), k: 'Asteroids passing this week', c: 'tracked near-Earth objects', hot: true });
    out.stats.push({ n: comma(closest.miss) + ' mi', k: 'Closest approach', c: closest.name });
    out.stats.push({ n: String(haz), k: 'Potentially hazardous', c: 'by NASA’s size/orbit criteria', hot: haz > 0 });
    if (largest) out.stats.push({ n: Math.round(largest.dia) + ' m', k: 'Largest this week', c: 'estimated diameter' });

    out.wow.push(comma(neo.length) + ' near-Earth asteroids pass by this week, tracked by NASA.');
    out.wow.push('The closest, ' + closest.name + ', skims within ' + comma(closest.miss) + ' miles of Earth' + (closest.dia ? ', and it is about ' + Math.round(closest.dia) + ' meters across' : '') + '.');
    if (haz) out.wow.push(haz + ' of this week’s asteroids are flagged “potentially hazardous” by size and orbit, none on a collision course.');
    if (largest && largest.dia) out.wow.push('The largest is roughly ' + Math.round(largest.dia) + ' meters wide, ' + (largest.dia > 300 ? 'bigger than most skyscrapers are tall' : 'about the length of a football field') + '.');

    out.sections.push({
      title: 'Closest approaches this week', note: 'NASA',
      sub: 'Near-Earth asteroids by how close they come. Distance in miles; none are on a path to hit Earth.',
      rows: neo.slice(0, 12).map(function (n, i) { return { rank: i + 1, name: n.name + (n.haz ? ' (hazardous class)' : ''), value: comma(n.miss) + ' mi', vsub: n.dia ? Math.round(n.dia) + ' m wide' : '', dir: n.haz ? 'neg' : '' }; })
    });
  }

  try { out.cards = await fetchArxiv(); out.sources.push({ name: 'arXiv', live: true }); } catch (e) {}
  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Read the source, not the hype', d: 'Headlines exaggerate. The papers in the feed above are the primary research, open access on arXiv. Skim the abstract before you trust the take.' },
    { t: 'Look up tonight', d: 'None of this week’s asteroids are a threat, but many meteor showers and passes are visible. Check a free sky app for what’s overhead where you are.' },
    { t: 'Back real science', d: 'Citizen-science projects (Zooniverse, eBird, NASA’s GLOBE) let anyone contribute to actual research from a phone. It is a real way to help.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the science domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: NASA NeoWs near-Earth-object feed and arXiv (newest preprints), both free. Headlines via Google News (links to original sources). Asteroid distances and sizes are NASA estimates.';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=14400');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
