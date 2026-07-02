/**
 * api/education-live.js — REAL college cost vs. payoff (free, no signup).
 *
 * GET /api/education-live         → net price, grad earnings & debt across big colleges + news
 * GET /api/education-live?fresh=1 → bypass cache (ops)
 *
 * Source: U.S. Dept. of Education College Scorecard (api.data.gov, DEMO_KEY, no signup).
 * Headlines via Google News RSS (links only). Redis-cached ~12 h. Stale-on-failure.
 */
var db = require('../lib/limen-db');
var KEY = 'edu:live:v1';
var TTL_MS = 12 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function money(n) { return '$' + Math.round(n).toLocaleString(); }
function cap(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-EducationWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('edu ' + r.status); return r.json(); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(college OR tuition OR "student debt" OR university OR "student loans" OR "higher education" OR FAFSA OR "school funding")';
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

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [] };

  var schools = [];
  try {
    var f = 'school.name,latest.cost.avg_net_price.overall,latest.earnings.10_yrs_after_entry.median,latest.aid.median_debt.completers.overall,latest.student.size';
    var d = await getJSON('https://api.data.gov/ed/collegescorecard/v1/schools?api_key=DEMO_KEY&fields=' + f + '&sort=latest.student.size:desc&per_page=100&school.operating=1');
    schools = (d.results || []).map(function (s) {
      return { name: s['school.name'], price: s['latest.cost.avg_net_price.overall'], earn: s['latest.earnings.10_yrs_after_entry.median'], debt: s['latest.aid.median_debt.completers.overall'], size: s['latest.student.size'] };
    });
    out.sources.push({ name: 'College Scorecard (Dept. of Education)', live: true });
  } catch (e) {}

  var withPrice = schools.filter(function (s) { return s.price > 0; });
  var withEarn = schools.filter(function (s) { return s.earn > 0; });
  var withDebt = schools.filter(function (s) { return s.debt > 0; });
  var avg = function (arr, k) { return arr.length ? arr.reduce(function (a, s) { return a + s[k]; }, 0) / arr.length : 0; };

  if (schools.length) {
    var aPrice = avg(withPrice, 'price'), aEarn = avg(withEarn, 'earn'), aDebt = avg(withDebt, 'debt');
    out.stats.push({ n: money(aPrice) + '/yr', k: 'Net price after aid', c: 'avg across the largest colleges', hot: true });
    out.stats.push({ n: money(aEarn), k: 'Median grad earnings', c: '10 years after starting' });
    out.stats.push({ n: money(aDebt), k: 'Median student debt', c: 'federal loans, at graduation', hot: aDebt > 0 });
    out.stats.push({ n: schools[0] ? cap(schools[0].name, 22) : 'n/a', k: 'Biggest U.S. college', c: schools[0] ? Math.round(schools[0].size).toLocaleString() + ' students' : '' });

    out.wow.push('At the largest U.S. colleges, the average student pays about ' + money(aPrice) + ' a year after grants and scholarships.');
    out.wow.push('Ten years after starting college, the typical graduate earns around ' + money(aEarn) + ' a year.');
    if (aDebt) out.wow.push('The median graduate leaves with about ' + money(aDebt) + ' in federal student debt.');
    if (schools[0]) out.wow.push('The biggest college in the country is ' + schools[0].name + ', with roughly ' + Math.round(schools[0].size).toLocaleString() + ' students.');

    var payoff = withEarn.filter(function (s) { return s.price > 0; }).slice(0, 40).sort(function (a, b) { return b.earn - a.earn; });
    out.sections.push({
      title: 'Big colleges: cost vs. payoff', note: 'College Scorecard',
      sub: 'Large U.S. colleges ranked by what graduates earn ten years out, with the yearly net price after aid.',
      rows: payoff.slice(0, 12).map(function (s, i) { return { rank: i + 1, name: cap(s.name, 40), value: money(s.earn), vsub: money(s.price) + '/yr', dir: 'pos' }; })
    });
    out.cards = schools.slice(0, 8).filter(function (s) { return s.price > 0; }).map(function (s) {
      return { title: s.name, meta: Math.round(s.size).toLocaleString() + ' students', body: 'Net price ' + money(s.price) + '/yr · grads earn ' + (s.earn ? money(s.earn) : 'n/a') + ' · median debt ' + (s.debt ? money(s.debt) : 'n/a') + '.', href: 'https://collegescorecard.ed.gov/' };
    });
  }

  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Compare payoff, not prestige', d: 'Look up any school at collegescorecard.ed.gov: net price, graduation rate, and what grads actually earn. A cheaper school with strong earnings often beats a famous, pricey one.' },
    { t: 'Fill out the FAFSA, always', d: 'It is free and it is the gate to grants, work-study, and low-rate federal loans, even families who think they earn too much often qualify for something. Do it at studentaid.gov.' },
    { t: 'Borrow federal before private', d: 'Federal loans have fixed rates, income-based repayment, and forgiveness options private loans do not. Exhaust federal aid first.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the education domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: U.S. Department of Education College Scorecard, official data on cost, debt, and earnings for U.S. colleges (free, no signup). Averages here are across the largest colleges by enrollment, not a national mean of every school. Headlines via Google News (links to original sources).';
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
