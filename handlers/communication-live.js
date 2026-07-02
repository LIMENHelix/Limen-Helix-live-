/**
 * api/communication-live.js — REAL: how the pipes and the press are regulated + covered (free, no key).
 *
 * GET /api/communication-live         → recent FCC actions + communication news by theme
 * GET /api/communication-live?fresh=1 → bypass cache (ops)
 *
 * Sources (free, no key): Federal Register (FCC documents, keyless) + Google News RSS
 * across communication themes. Redis-cached ~1 h. Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'comm:live:v1';
var TTL_MS = 60 * 60 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function cap(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-CommWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('fr ' + r.status); return r.json(); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
function typeLabel(t) { return ({ RULE: 'Final rule', PRORULE: 'Proposed rule', NOTICE: 'Notice', PRESDOCU: 'Presidential doc' })[t] || t || 'Document'; }

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
  return { label: label, count: (body.split('<item>').length - 1), items: items };
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [{ name: 'Google News', live: true }] };

  // FCC regulatory actions (Federal Register)
  var fccCount = 0, fccDocs = [];
  try {
    var wk = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    var d = await getJSON('https://www.federalregister.gov/api/v1/documents.json?per_page=8&order=newest&conditions%5Bagencies%5D%5B%5D=federal-communications-commission&conditions%5Bpublication_date%5D%5Bgte%5D=' + wk + '&fields%5B%5D=title&fields%5B%5D=type&fields%5B%5D=publication_date&fields%5B%5D=html_url');
    fccCount = d.count || 0;
    fccDocs = (d.results || []).map(function (x) { return { title: cap(x.title, 90), meta: 'FCC · ' + typeLabel(x.type) + (x.publication_date ? ' · ' + x.publication_date : ''), href: x.html_url }; });
    out.sources.push({ name: 'Federal Register (FCC)', live: true });
  } catch (e) {}

  var THEMES = [
    { k: 'Broadband & access', q: '(broadband OR "internet access" OR "digital divide" OR fiber OR "net neutrality")' },
    { k: 'Telecom & 5G', q: '(5G OR telecom OR wireless OR spectrum OR "phone carrier" OR satellite internet)' },
    { k: 'Press & platforms', q: '("press freedom" OR journalist OR "social media" OR misinformation OR "content moderation" OR censorship)' }
  ];
  var themes = [];
  await Promise.all(THEMES.map(function (t) { return fetchTheme(t.k, t.q).then(function (r) { themes.push(r); }).catch(function () {}); }));
  themes.sort(function (a, b) { return b.count - a.count; });
  var total = themes.reduce(function (s, t) { return s + t.count; }, 0);

  if (fccCount) out.stats.push({ n: String(fccCount), k: 'FCC actions this month', c: 'rules & notices, last 30 days', hot: true });
  if (themes[0]) out.stats.push({ n: themes[0].count.toLocaleString(), k: 'Top comms story', c: themes[0].label + ', most coverage' });
  if (total) out.stats.push({ n: total.toLocaleString(), k: 'Stories tracked', c: 'broadband, telecom & press' });
  if (fccDocs[0]) out.stats.push({ n: 'Live', k: 'Latest FCC move', c: cap(fccDocs[0].title, 26) });

  if (fccCount) out.wow.push('The FCC has taken ' + fccCount + ' formal actions in the last 30 days, the rules that shape your internet, phone, and TV.');
  if (themes[0]) out.wow.push('In communication news right now, the loudest theme is ' + themes[0].label.toLowerCase() + ' (' + themes[0].count.toLocaleString() + ' stories).');
  out.wow.push('Roughly 1 in 5 rural Americans still lacks access to fast home broadband, the "digital divide" the FCC tracks and funds.');

  if (themes.length) out.sections.push({
    title: 'Communication in the news by theme', note: 'Google News',
    sub: 'How much the press is covering each corner of communication right now. A rough read on attention, not importance.',
    rows: themes.map(function (t) { return { name: t.label, value: t.count.toLocaleString() + ' stories', dir: t.count >= 80 ? 'neg' : '' }; })
  });
  if (fccDocs.length) out.sections.push({
    title: 'The FCC’s recent moves', note: 'Federal Register',
    sub: 'The newest formal actions from the agency that regulates broadband, wireless, and broadcast.',
    rows: fccDocs.slice(0, 8).map(function (x) { return { name: x.title, value: x.meta.split(' · ')[1] || 'FCC', vsub: (x.meta.split(' · ')[2] || '') }; })
  });

  var maxRounds = 3;
  for (var round = 0; round < maxRounds; round++) themes.forEach(function (t) { if (t.items[round]) out.cards.push(t.items[round]); });
  out.cards = fccDocs.concat(out.cards);

  out.todo = [
    { t: 'Check your real broadband options', d: 'The FCC’s National Broadband Map (broadbandmap.fcc.gov) shows every provider and speed actually available at your address, often more than the one you were sold.' },
    { t: 'If money is tight, ask about Lifeline', d: 'The federal Lifeline program discounts phone or internet for low-income households. See if you qualify at lifelinesupport.org.' },
    { t: 'Slow the misinformation', d: 'Before you share, check the source and date. A five-second pause on a shocking post is the single most effective thing any one person can do about misinformation.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the communication domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: Federal Register (FCC documents, keyless and official) and Google News RSS across communication themes (coverage counts are a rough attention signal, not a measure of importance). Headlines link to original sources.';
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
