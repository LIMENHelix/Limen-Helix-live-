/**
 * api/trade-live.js — REAL global trade: who exports, who imports, who's in deficit (free, no key).
 *
 * GET /api/trade-live         → U.S. trade balance, top exporters, biggest surpluses/deficits + news
 * GET /api/trade-live?fresh=1 → bypass cache (ops)
 *
 * Source: World Bank Open Data (api.worldbank.org) — keyless. Exports/imports of goods
 * and services (current US$), latest year per country. Headlines via Google News RSS
 * (links only). Redis-cached ~12 h (annual data). Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'trade:live:v1';
var TTL_MS = 12 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function usd(n) { var a = Math.abs(n); if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (n / 1e9).toFixed(0) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M'; return '$' + Math.round(n).toLocaleString(); }
function bal(n) { return (n >= 0 ? '+' : '-') + usd(Math.abs(n)); }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-TradeWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('wb ' + r.status); return r.json(); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(tariff OR "trade deal" OR imports OR exports OR "supply chain" OR "trade deficit" OR shipping OR customs OR WTO OR "trade war")';
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text(), chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 12; i++) {
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

async function realCountrySet() {
  var set = {};
  try {
    var d = await getJSON('https://api.worldbank.org/v2/country?format=json&per_page=400');
    (d[1] || []).forEach(function (c) { if (c.region && c.region.value && c.region.value !== 'Aggregates') set[c.id] = c.name; });
  } catch (e) {}
  return set;
}
async function indicator(code) {
  var d = await getJSON('https://api.worldbank.org/v2/country/all/indicator/' + code + '?format=json&mrnev=1&per_page=400');
  var map = {}, world = 0;
  (d[1] || []).forEach(function (r) {
    if (!r.value) return;
    if (r.countryiso3code === 'WLD') { world = r.value; return; }
    map[r.countryiso3code] = { value: r.value, year: r.date, name: (r.country || {}).value };
  });
  return { map: map, world: world };
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [{ name: 'World Bank', live: true }] };

  var real = await realCountrySet();
  var exp = null, imp = null;
  try { exp = await indicator('NE.EXP.GNFS.CD'); } catch (e) {}
  try { imp = await indicator('NE.IMP.GNFS.CD'); } catch (e) {}

  if (exp) {
    var expList = Object.keys(exp.map).filter(function (k) { return real[k]; }).map(function (k) { return { iso: k, name: exp.map[k].name, exp: exp.map[k].value, year: exp.map[k].year }; }).sort(function (a, b) { return b.exp - a.exp; });

    // U.S. balance
    var us = exp.map['USA'], usi = imp && imp.map['USA'];
    if (us && usi) {
      var b = us.value - usi.value;
      out.stats.push({ n: bal(b), k: 'U.S. trade balance', c: b < 0 ? 'deficit (' + us.year + ')' : 'surplus (' + us.year + ')', hot: true });
      out.stats.push({ n: usd(us.value), k: 'U.S. exports', c: 'goods & services, ' + us.year });
      out.stats.push({ n: usd(usi.value), k: 'U.S. imports', c: 'goods & services, ' + us.year });
      out.wow.push('The U.S. runs a trade ' + (b < 0 ? 'deficit' : 'surplus') + ' of about ' + usd(Math.abs(b)) + ': it exports ' + usd(us.value) + ' and imports ' + usd(usi.value) + ' of goods and services a year.');
    }
    if (exp.world) { out.stats.push({ n: usd(exp.world), k: 'World exports', c: 'total, all countries' }); out.wow.push('Global exports total about ' + usd(exp.world) + ' a year across all economies.'); }
    if (expList[0]) out.wow.push('The world’s biggest exporter is ' + expList[0].name + ' at ' + usd(expList[0].exp) + ' a year.');

    out.sections.push({
      title: 'Top exporting economies', note: 'World Bank',
      sub: 'Exports of goods and services, current US dollars, latest year available per country.',
      rows: expList.slice(0, 12).map(function (c, i) { return { rank: i + 1, name: c.name, value: usd(c.exp), vsub: String(c.year) }; })
    });

    if (imp) {
      var balances = expList.filter(function (c) { return imp.map[c.iso]; }).map(function (c) { return { name: c.name, b: c.exp - imp.map[c.iso].value }; }).sort(function (a, b2) { return b2.b - a.b; });
      var top = balances.slice(0, 6), bottom = balances.slice(-6).reverse();
      out.sections.push({
        title: 'Biggest trade balances', note: 'World Bank',
        sub: 'Exports minus imports. Green economies sell the world more than they buy (surplus); red buy more than they sell (deficit).',
        rows: top.map(function (c) { return { name: c.name, value: bal(c.b), dir: 'pos' }; }).concat(bottom.map(function (c) { return { name: c.name, value: bal(c.b), dir: 'neg' }; }))
      });
    }
  }

  try { out.cards = await fetchNews(); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Tariffs are a tax you pay', d: 'Import tariffs get passed to shoppers as higher prices. When trade news heats up on a category you buy (electronics, cars, food), expect it to cost more soon.' },
    { t: 'Diversify what you rely on', d: 'A supply chain routed through one country is fragile. For a business, a second supplier in a second region is cheap insurance against the next disruption.' },
    { t: 'Buy ahead of a shock', d: 'If a tariff or strike is telegraphed weeks out, big planned purchases (appliances, a car) are often cheaper before it lands than after.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the trade domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: World Bank Open Data, exports and imports of goods and services (current US$), keyless. Values are the latest year each country has reported, so years can differ. Headlines via Google News (links to original sources).';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=43200');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
