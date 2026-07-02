/**
 * api/economy-live.js — REAL U.S. economy numbers (free, no key).
 *
 * GET /api/economy-live            → national debt, per-person, interest + headlines
 * GET /api/economy-live?fresh=1    → bypass cache (ops)
 *
 * Source: U.S. Treasury FiscalData (Debt to the Penny, Average Interest Rates) —
 * keyless, official (api.fiscaldata.treasury.gov). Headlines via Google News RSS
 * (links to original sources, no body republished). Redis-cached ~30 min.
 * Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'econ:live:v1';
var TTL_MS = 30 * 60 * 1000;
var US_POP = 335893238; // U.S. Census 2024 estimate
var FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function usd(n) {
  var a = Math.abs(n);
  if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(n).toLocaleString();
}
function money0(n) { return '$' + Math.round(n).toLocaleString(); }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-EconomyWatch (limenhelix.com)' } }); if (!r.ok) throw new Error('fd ' + r.status); return r.json(); }

function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(inflation OR "interest rates" OR "the Fed" OR "jobs report" OR unemployment OR recession OR "national debt" OR GDP OR economy)';
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text(), chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 18; i++) {
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
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], cards: [], todo: [], sources: [] };

  var debt = null, prev = null, prevDate = null;
  try {
    var d = await getJSON(FD + '/v2/accounting/od/debt_to_penny?sort=-record_date&fields=record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt&page%5Bsize%5D=40');
    var rows = d.data || [];
    if (rows.length) {
      debt = { date: rows[0].record_date, total: num(rows[0].tot_pub_debt_out_amt), pub: num(rows[0].debt_held_public_amt), intra: num(rows[0].intragov_hold_amt) };
      var last = rows[rows.length - 1]; prev = num(last.tot_pub_debt_out_amt); prevDate = last.record_date;
    }
  } catch (e) {}

  var rate = null;
  try {
    var ir = await getJSON(FD + '/v2/accounting/od/avg_interest_rates?sort=-record_date&fields=record_date,security_desc,avg_interest_rate_amt&page%5Bsize%5D=25');
    var rr = (ir.data || []);
    for (var i = 0; i < rr.length; i++) { if (/Total Interest-bearing Debt/i.test(rr[i].security_desc)) { rate = num(rr[i].avg_interest_rate_amt); break; } }
  } catch (e) {}

  if (debt) {
    var perPerson = debt.total / US_POP;
    out.stats.push({ n: usd(debt.total), k: 'U.S. national debt', c: 'total public debt · ' + debt.date, hot: true });
    out.stats.push({ n: money0(perPerson), k: 'Per person in America', c: 'debt ÷ ' + (US_POP / 1e6).toFixed(1) + 'M people' });
    out.stats.push({ n: usd(debt.pub), k: 'Held by the public', c: 'the rest the government owes itself' });
    out.wow.push('The U.S. national debt is ' + usd(debt.total) + ', about ' + money0(perPerson) + ' for every person in America.');
    out.wow.push(usd(debt.pub) + ' of the debt is held by the public; the other ' + usd(debt.intra) + ' the government owes itself.');
    if (prev && debt.total > prev) {
      var chg = debt.total - prev;
      var days = 1; try { days = Math.max(1, Math.round((Date.parse(debt.date) - Date.parse(prevDate)) / 86400000)); } catch (e) {}
      var perSec = chg / (days * 86400);
      out.stats.push({ n: '+' + usd(chg), k: 'Added recently', c: 'since ' + prevDate + ' (~' + days + ' days)' });
      out.wow.push('The debt has grown about ' + usd(chg) + ' since ' + prevDate + ', roughly ' + money0(perSec) + ' every second.');
    }
  }
  if (rate != null) {
    out.stats.push({ n: rate.toFixed(2) + '%', k: 'Avg interest on the debt', c: 'weighted across all Treasury securities' });
    out.wow.push('Washington pays about ' + rate.toFixed(2) + '% average interest on its debt; the interest bill now rivals major federal programs.');
  }

  out.sources.push({ name: 'U.S. Treasury (FiscalData)', live: true });
  try { out.cards = await fetchNews(); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Guard your buying power', d: 'A rising debt and money supply erode the dollar over time. Assets that have historically held value, broad index funds, I-bonds, real estate, are the usual hedges. General education, not advice.' },
    { t: 'Lock in fixed rates', d: 'When rates are elevated, fixed-rate debt (mortgage, auto) shields you from future increases; variable-rate balances only get more expensive.' },
    { t: 'Watch the interest line', d: 'Interest on the debt now competes with Social Security and defense for the budget. When it crowds them out, expect pressure on taxes and spending, so time big decisions accordingly.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the economy’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: U.S. Treasury FiscalData (Debt to the Penny, Average Interest Rates), keyless and official. Headlines via Google News (links to original sources). The debt updates each business day.';
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
