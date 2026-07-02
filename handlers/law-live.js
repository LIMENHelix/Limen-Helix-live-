/**
 * api/law-live.js — REAL federal rulemaking, live (free, no key).
 *
 * GET /api/law-live            → new rules today + this week's counts + newest feed
 * GET /api/law-live?fresh=1    → bypass cache (ops)
 *
 * Source: Federal Register API (federalregister.gov/api/v1) — keyless, official;
 * the U.S. government's daily journal of rules, proposed rules and notices. Headlines
 * via Google News RSS (links only). Redis-cached ~30 min. Stale-on-failure.
 */
var db = require('../lib/limen-db');
var KEY = 'law:live:v1';
var TTL_MS = 30 * 60 * 1000;
var FR = 'https://www.federalregister.gov/api/v1';

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-LawWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('fr ' + r.status); return r.json(); }
function ymd(d) { return d.toISOString().slice(0, 10); }
function typeLabel(t) { return ({ RULE: 'Final rule', PRORULE: 'Proposed rule', NOTICE: 'Notice', PRESDOCU: 'Presidential document' })[t] || t || 'Document'; }

function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '("Supreme Court" OR lawsuit OR "federal rule" OR regulation OR "executive order" OR ruling OR "class action" OR settlement OR "Department of Justice")';
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

async function countDocs(params) { var d = await getJSON(FR + '/documents.json?per_page=1&' + params); return d.count || 0; }

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], cards: [], todo: [], sources: [{ name: 'Federal Register', live: true }] };
  var today = new Date(), weekAgo = new Date(Date.now() - 7 * 86400000);
  var tYmd = ymd(today), wYmd = ymd(weekAgo), yearStart = today.getUTCFullYear() + '-01-01';

  var rulesWeek = 0, docsWeek = 0, propWeek = 0, eoYear = 0;
  try { rulesWeek = await countDocs('conditions[type][]=RULE&conditions[publication_date][gte]=' + wYmd); } catch (e) {}
  try { docsWeek = await countDocs('conditions[publication_date][gte]=' + wYmd); } catch (e) {}
  try { propWeek = await countDocs('conditions[type][]=PRORULE&conditions[publication_date][gte]=' + wYmd); } catch (e) {}
  try { eoYear = await countDocs('conditions[presidential_document_type][]=executive_order&conditions[publication_date][gte]=' + yearStart); } catch (e) {}

  var newest = [];
  try {
    var d = await getJSON(FR + '/documents.json?per_page=20&order=newest&fields[]=title&fields[]=type&fields[]=publication_date&fields[]=html_url&fields[]=agencies&fields[]=abstract');
    newest = (d.results || []).map(function (x) {
      var ag = (x.agencies || []).map(function (a) { return a.name; }).filter(Boolean).slice(0, 2).join(', ');
      return { title: x.title, meta: typeLabel(x.type) + (ag ? ' · ' + ag : '') + (x.publication_date ? ' · ' + x.publication_date : ''), body: x.abstract || '', href: x.html_url };
    });
  } catch (e) {}

  out.stats.push({ n: docsWeek.toLocaleString(), k: 'Federal documents this week', c: 'rules, proposals & notices', hot: docsWeek > 0 });
  out.stats.push({ n: String(rulesWeek), k: 'New federal rules this week', c: 'final rules, last 7 days' });
  out.stats.push({ n: String(propWeek), k: 'Proposed rules this week', c: 'open for public comment' });
  out.stats.push({ n: String(eoYear), k: 'Executive orders this year' });

  if (docsWeek) out.wow.push('The federal government published ' + docsWeek.toLocaleString() + ' documents in the Federal Register this week, rules, proposals and notices.');
  if (rulesWeek) out.wow.push(rulesWeek + ' new federal rule' + (rulesWeek === 1 ? '' : 's') + ' published this week.');
  if (newest[0]) out.wow.push('Newest in the Federal Register: “' + newest[0].title + '”.');
  if (propWeek) out.wow.push(propWeek + ' proposed rules opened for public comment this week; you can weigh in on each before it becomes law.');
  if (eoYear) out.wow.push(eoYear + ' executive order' + (eoYear === 1 ? '' : 's') + ' have been signed so far this year.');

  out.cards = newest;
  try { var nw = await fetchNews(); out.cards = newest.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Comment before it’s law', d: 'Proposed rules have public comment windows. Open the docket on regulations.gov and file a comment; agencies must respond to substantive ones.' },
    { t: 'Know the effective date', d: 'Every final rule lists an effective date. If one touches your business, that date is your compliance deadline.' },
    { t: 'Follow your agencies', d: 'Pick the agencies that regulate you (IRS, EPA, DOL, FTC…) and scan their new documents weekly; the feed above is live and filterable at federalregister.gov.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the law domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: Federal Register (federalregister.gov), the U.S. government’s official daily journal of rules, proposed rules and notices, keyless and official. Headlines via Google News (links to original sources).';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
