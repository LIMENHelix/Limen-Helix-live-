/**
 * api/governance-live.js — REAL federal spending: where your tax money goes (free, no key).
 *
 * GET /api/governance-live         → total budget authority, top agencies, obligated
 *                                    + gov/congress headlines
 * GET /api/governance-live?fresh=1 → bypass cache (ops)
 *
 * Source: USAspending.gov API (api.usaspending.gov) — keyless, official federal spending.
 * Headlines via Google News RSS (links only). Redis-cached ~6 h (annual budget data).
 * Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'gov:live:v1';
var TTL_MS = 6 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function usd(n) {
  var a = Math.abs(n);
  if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(n).toLocaleString();
}
function shortName(s) { return String(s || '').replace(/^Department of (the )?/, 'Dept. of ').replace(/^U\.S\. /, ''); }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-GovernanceWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('usa ' + r.status); return r.json(); }

function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(Congress OR "the White House" OR "executive order" OR Senate OR "House vote" OR legislation OR "federal budget" OR "government shutdown" OR appropriations)';
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
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], cards: [], todo: [], sources: [{ name: 'USAspending.gov', live: true }] };

  var total = 0, obligated = 0, agencies = [], fy = '';
  try {
    var d = await getJSON('https://api.usaspending.gov/api/v2/references/toptier_agencies/');
    var rows = d.results || [];
    if (rows.length) {
      total = num(rows[0].current_total_budget_authority_amount);
      fy = rows[0].active_fy || '';
      rows.forEach(function (r) { obligated += num(r.obligated_amount); });
      agencies = rows.map(function (r) { return { name: r.agency_name, ba: num(r.budget_authority_amount), ob: num(r.obligated_amount) }; })
        .sort(function (a, b) { return b.ba - a.ba; });
    }
  } catch (e) {}

  if (total) {
    var top = agencies[0], pctOb = total ? Math.round((obligated / total) * 100) : 0;
    out.stats.push({ n: usd(total), k: 'Federal budget authority', c: 'total for FY' + fy, hot: true });
    out.stats.push({ n: usd(obligated), k: 'Obligated so far', c: pctOb + '% committed this year' });
    if (top) out.stats.push({ n: usd(top.ba), k: shortName(top.name) + ' (largest)', c: 'biggest single agency budget' });
    out.stats.push({ n: String(agencies.length), k: 'Federal agencies', c: 'each with its own budget' });

    out.wow.push('The federal government holds ' + usd(total) + ' in budget authority this fiscal year, about ' + usd(total / 335893238) + ' for every American.');
    if (top) out.wow.push('The single biggest agency budget: ' + shortName(top.name) + ' at ' + usd(top.ba) + '.');
    out.wow.push(usd(obligated) + ' has already been obligated (legally committed to spend) this year, ' + pctOb + '% of the total.');
    if (agencies[1] && agencies[2]) out.wow.push('After the top agency come ' + shortName(agencies[1].name) + ' (' + usd(agencies[1].ba) + ') and ' + shortName(agencies[2].name) + ' (' + usd(agencies[2].ba) + ').');

    out.sections = [{
      title: 'Where the money goes: biggest agency budgets', note: 'USAspending',
      sub: 'The 12 largest federal agencies by budget authority this fiscal year, with how much each has already obligated (committed to spend).',
      rows: agencies.slice(0, 12).map(function (a, i) { return { rank: i + 1, name: a.name, value: usd(a.ba), vsub: 'obl ' + usd(a.ob) }; })
    }];
  }

  try { var nw = await fetchNews(); out.cards = nw; out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'See where it goes', d: 'Every federal dollar is traceable. Search any agency, program, or contractor at usaspending.gov and follow the money down to individual awards.' },
    { t: 'Tell your reps', d: 'Budgets and appropriations are set by Congress. Find and contact your senators and representative at congress.gov/members; a short, specific message gets logged.' },
    { t: 'Follow a contract', d: 'Wondering who won a federal contract near you? Filter awards by state and agency on USAspending, the recipients and amounts are public.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the governance domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: USAspending.gov, the U.S. government’s official open-data source for federal spending, keyless and official. Budget authority and obligations are current-fiscal-year figures. Headlines via Google News (links to original sources).';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
