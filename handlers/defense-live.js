/**
 * api/defense-live.js — REAL U.S. defense spending + who's getting the contracts (free, no key).
 *
 * GET /api/defense-live         → DoD budget, biggest recent contracts, defense headlines
 * GET /api/defense-live?fresh=1 → bypass cache (ops)
 *
 * Source: USAspending.gov (api.usaspending.gov) — keyless, official federal spending.
 * Headlines via Google News RSS (links only). Redis-cached ~3 h. Stale-on-failure.
 */
var db = require('../lib/limen-db');
var KEY = 'def:live:v1';
var TTL_MS = 3 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function usd(n) { var a = Math.abs(n); if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'; if (a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'; if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; return '$' + Math.round(n).toLocaleString(); }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-DefenseWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('usa ' + r.status); return r.json(); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(military OR Pentagon OR defense OR NATO OR troops OR "national security" OR missile OR warship OR "arms deal" OR conflict)';
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

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [{ name: 'USAspending.gov', live: true }] };

  var dod = null;
  try {
    var d = await getJSON('https://api.usaspending.gov/api/v2/references/toptier_agencies/');
    var row = (d.results || []).filter(function (r) { return /Department of Defense/i.test(r.agency_name); })[0];
    if (row) dod = { ba: num(row.budget_authority_amount), ob: num(row.obligated_amount) };
  } catch (e) {}

  var awards = [];
  try {
    var end = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    var body = { filters: { award_type_codes: ['A', 'B', 'C', 'D'], agencies: [{ type: 'awarding', tier: 'toptier', name: 'Department of Defense' }], time_period: [{ start_date: start, end_date: end }] }, fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Description'], sort: 'Award Amount', order: 'desc', limit: 15 };
    var r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'LIMEN-Helix-DefenseWatch (limenhelix.com)' }, body: JSON.stringify(body) });
    if (r.ok) { var jd = await r.json(); awards = (jd.results || []).map(function (a) { return { name: a['Recipient Name'] || 'Unknown', amt: num(a['Award Amount']), desc: a['Description'] || '' }; }); }
  } catch (e) {}

  if (dod) {
    out.stats.push({ n: usd(dod.ba), k: 'Defense budget authority', c: 'Dept. of Defense, this fiscal year', hot: true });
    out.stats.push({ n: usd(dod.ob), k: 'Obligated so far', c: 'committed this year' });
    out.wow.push('The Department of Defense holds ' + usd(dod.ba) + ' in budget authority this year, about ' + usd(dod.ba / 335893238) + ' for every American.');
  }
  if (awards.length) {
    var biggest = awards[0];
    out.stats.push({ n: usd(biggest.amt), k: 'Biggest recent contract', c: biggest.name.slice(0, 30) });
    out.stats.push({ n: String(awards.length), k: 'Top contracts shown', c: 'last 90 days, by size' });
    out.wow.push('The largest recent defense contract: ' + usd(biggest.amt) + ' to ' + biggest.name + '.');
    out.wow.push('The ' + awards.length + ' biggest defense contracts of the last 90 days total ' + usd(awards.reduce(function (s, a) { return s + a.amt; }, 0)) + '.');
    out.sections.push({ title: 'Biggest recent defense contracts', note: 'USAspending', sub: 'The largest Department of Defense contract awards in the last 90 days, by dollar value.', rows: awards.slice(0, 12).map(function (a, i) { return { rank: i + 1, name: a.name.slice(0, 42), value: usd(a.amt) }; }) });
    out.cards = awards.slice(0, 10).map(function (a) { return { title: a.name, meta: 'Contract ' + usd(a.amt), body: (a.desc || '').slice(0, 170), href: 'https://www.usaspending.gov/' }; });
  }

  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Follow the contracts', d: 'Every defense dollar is public. Search USAspending.gov by state to see which companies near you win Pentagon work, and for how much.' },
    { t: 'Veterans: claim what’s yours', d: 'If you or a family member served, VA benefits (health, education, disability, home loans) go unclaimed constantly. Start at va.gov/find-forms.' },
    { t: 'Watch the hotspots', d: 'Conflict abroad moves oil, food, and shipping prices at home. When defense news spikes, expect knock-on effects at the pump and the store.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the defense domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: USAspending.gov, the U.S. government’s official open-data source for federal spending, keyless and official. Budget and contract figures are current-fiscal-year. Headlines via Google News (links to original sources).';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=10800');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
