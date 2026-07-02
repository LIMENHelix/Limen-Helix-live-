/**
 * api/industry-live.js — REAL product recalls: what just got pulled off shelves (free, no key).
 *
 * GET /api/industry-live         → recent FDA food/drug + CPSC product recalls + industry news
 * GET /api/industry-live?fresh=1 → bypass cache (ops)
 *
 * Sources (free, no key): openFDA enforcement (food + drug recalls, api.fda.gov),
 * CPSC recalls (saferproducts.gov), Google News RSS (links only). Redis-cached ~2 h.
 * Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'ind:live:v1';
var TTL_MS = 2 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function fdaDate(s) { s = String(s || ''); return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8) : s; }
function cap(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-IndustryWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('ind ' + r.status); return r.json(); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(recall OR "product safety" OR factory OR manufacturing OR "supply chain" OR strike OR automaker OR shortage OR plant closure)';
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
  var recalls = [];

  try {
    var f = await getJSON('https://api.fda.gov/food/enforcement.json?sort=report_date:desc&limit=20');
    (f.results || []).forEach(function (r) { recalls.push({ title: cap(r.product_description, 70), cls: r.classification || '', firm: r.recalling_firm || '', reason: cap(r.reason_for_recall, 120), date: fdaDate(r.report_date), src: 'FDA food' }); });
    out.sources.push({ name: 'openFDA', live: true });
  } catch (e) {}
  try {
    var g = await getJSON('https://api.fda.gov/drug/enforcement.json?sort=report_date:desc&limit=12');
    (g.results || []).forEach(function (r) { recalls.push({ title: cap(r.product_description, 70), cls: r.classification || '', firm: r.recalling_firm || '', reason: cap(r.reason_for_recall, 120), date: fdaDate(r.report_date), src: 'FDA drug' }); });
  } catch (e) {}
  try {
    var start = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    var c = await getJSON('https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=' + start);
    (Array.isArray(c) ? c : []).forEach(function (r) { var hz = (r.Hazards || [])[0]; recalls.push({ title: cap(r.Title, 80), cls: '', firm: '', reason: hz ? cap(hz.Name, 120) : '', date: (r.RecallDate || '').slice(0, 10), src: 'CPSC', href: r.URL }); });
    out.sources.push({ name: 'CPSC', live: true });
  } catch (e) {}

  recalls.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  var classI = recalls.filter(function (r) { return /Class I\b/i.test(r.cls); }).length;
  var fdaCount = recalls.filter(function (r) { return /FDA/.test(r.src); }).length;
  var cpscCount = recalls.filter(function (r) { return r.src === 'CPSC'; }).length;

  if (recalls.length) {
    out.stats.push({ n: String(recalls.length), k: 'Recalls tracked now', c: 'FDA + CPSC, recent', hot: true });
    out.stats.push({ n: String(classI), k: 'Class I (most serious)', c: 'reasonable chance of serious harm', hot: classI > 0 });
    out.stats.push({ n: String(fdaCount), k: 'Food & drug recalls', c: 'from the FDA' });
    out.stats.push({ n: String(cpscCount), k: 'Product recalls', c: 'from the CPSC (last 60 days)' });

    out.wow.push(recalls.length + ' product recalls are active right now across the FDA and CPSC, everyday food, drugs, and household goods.');
    if (classI) out.wow.push(classI + ' of them are Class I, the FDA’s most serious tier: a reasonable chance the product causes serious harm or death.');
    var firstFda = recalls.filter(function (r) { return /FDA/.test(r.src) && r.reason; })[0];
    if (firstFda) out.wow.push('A recent one: ' + firstFda.title + ' pulled by ' + (firstFda.firm || 'the maker') + ', for ' + firstFda.reason.toLowerCase() + '.');

    out.sections.push({
      title: 'Recently recalled', note: 'FDA + CPSC',
      sub: 'The newest recalls across food, drugs, and consumer products. Red marks the FDA’s most serious (Class I) recalls.',
      rows: recalls.slice(0, 14).map(function (r) { return { name: r.title, value: r.cls || r.src, vsub: r.date, dir: /Class I\b/i.test(r.cls) ? 'neg' : '' }; })
    });
    out.cards = recalls.slice(0, 10).map(function (r) { return { title: r.title, meta: r.src + (r.cls ? ' · ' + r.cls : '') + (r.date ? ' · ' + r.date : ''), body: (r.firm ? r.firm + '. ' : '') + r.reason, href: r.href || 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts' }; });
  }

  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Check your kitchen and medicine cabinet', d: 'Recalls move fast and quietly. Search the product name at fda.gov/recalls or cpsc.gov, if it matches your lot or model, stop using it and follow the refund or replace instructions.' },
    { t: 'Register the things you buy', d: 'Fill out the registration card (or online form) on appliances, car seats, and electronics. It is the only way the maker can reach you directly when they recall it.' },
    { t: 'Report a problem', d: 'If something you own is unsafe, report it at SaferProducts.gov (CPSC) or the FDA. Reports are what trigger investigations and recalls in the first place.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the industry domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: openFDA (FDA food and drug recall enforcement) and CPSC (SaferProducts.gov consumer-product recalls), both free and official. Headlines via Google News (links to original sources).';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var cc = await db.get(KEY); if (cc && cc.updatedMs && (now - cc.updatedMs) < TTL_MS) data = cc; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
