/**
 * api/finance-live.js — REAL markets + rates + fresh SEC filings (free, no key).
 *
 * GET /api/finance-live         → index levels, Treasury yields, curve, VIX, BTC/gold,
 *                                 + newest SEC 8-K filings + finance headlines
 * GET /api/finance-live?fresh=1 → bypass cache (ops)
 *
 * Sources (all free, no key): Yahoo Finance v8 chart (index/rate/commodity levels),
 * SEC EDGAR current filings (getcurrent atom, requires a contact User-Agent), Google
 * News RSS (links only). Redis-cached ~15 min. Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'fin:live:v1';
var TTL_MS = 15 * 60 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function pct(a, b) { return b ? ((a - b) / b) * 100 : 0; }
function signed(n, d) { return (n >= 0 ? '+' : '') + n.toFixed(d == null ? 2 : d); }
function comma(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

async function yahoo(sym) {
  var r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('yh ' + r.status);
  var jd = await r.json(); var m = jd.chart.result[0].meta;
  var price = m.regularMarketPrice, prev = m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose;
  return { price: price, prev: prev, chg: pct(price, prev) };
}

function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(stock market OR "the Fed" OR "interest rates" OR inflation OR Treasury OR "bank" OR earnings OR "S&P 500" OR bitcoin OR recession)';
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

async function fetchFilings() {
  var r = await fetch('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=15&output=atom', { headers: { 'User-Agent': 'LIMEN Helix chrishubbel72@gmail.com', 'Accept': 'application/atom+xml' } });
  if (!r.ok) throw new Error('edgar ' + r.status);
  var body = await r.text(), chunks = body.split('<entry>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 12; i++) {
    var c = chunks[i];
    var title = decode(m1(/<title>([\s\S]*?)<\/title>/, c)), href = m1(/<link[^>]*href="([^"]+)"/, c), upd = m1(/<updated>([^<]+)/, c);
    // title like "8-K - COMPANY NAME (0001234567) (Filer)"
    var name = title.replace(/^8-K\s*-\s*/, '').replace(/\s*\(\d+\)\s*\(Filer\)\s*$/, '').replace(/\s*\(Filer\)\s*$/, '');
    if (title && href) items.push({ title: name, meta: 'SEC 8-K filing' + (upd ? ' · ' + upd.slice(0, 10) : ''), body: 'A company just filed a material-event disclosure with the SEC.', href: href });
  }
  return items;
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], sections: [], cards: [], todo: [], sources: [{ name: 'Yahoo Finance', live: true }] };
  var syms = ['^GSPC', '^IXIC', '^DJI', '^VIX', '^TNX', '^IRX', 'BTC-USD', 'GC=F'];
  var vals = {};
  await Promise.all(syms.map(function (s) { return yahoo(s).then(function (v) { vals[s] = v; }).catch(function () {}); }));

  var sp = vals['^GSPC'], nq = vals['^IXIC'], dj = vals['^DJI'], vix = vals['^VIX'], tnx = vals['^TNX'], irx = vals['^IRX'], btc = vals['BTC-USD'], gold = vals['GC=F'];

  var inv = (tnx && irx) ? irx.price > tnx.price : false;
  // headline KPI tiles
  if (sp) { out.stats.push({ n: comma(sp.price), k: 'S&P 500', c: signed(sp.chg) + '% today', hot: true }); out.wow.push('The S&P 500 is at ' + comma(sp.price) + ', ' + signed(sp.chg) + '% on the day.'); }
  if (tnx) out.stats.push({ n: tnx.price.toFixed(2) + '%', k: '10-year Treasury yield', c: 'the benchmark rate' });
  if (vix) out.stats.push({ n: vix.price.toFixed(1), k: 'VIX (fear gauge)', c: vix.price > 20 ? 'elevated, nervous' : 'low, calm' });
  if (tnx && irx) out.stats.push({ n: (tnx.price - irx.price).toFixed(2) + ' pts', k: 'Yield curve (10yr vs 3mo)', c: inv ? 'INVERTED, a recession signal' : 'normal' });

  if (tnx && irx) out.wow.push('The 10-year Treasury yields ' + tnx.price.toFixed(2) + '% while the 3-month pays ' + irx.price.toFixed(2) + '%. ' + (inv ? 'That inversion, short rates above long, has preceded most U.S. recessions.' : 'A normal, upward-sloping curve.'));
  if (vix) out.wow.push('The VIX, Wall Street’s fear gauge, sits at ' + vix.price.toFixed(1) + ' right now (' + (vix.price > 20 ? 'nervous' : 'calm') + ').');
  if (btc || gold) out.wow.push((btc ? 'Bitcoin trades near $' + comma(btc.price) : '') + (btc && gold ? '; ' : '') + (gold ? 'gold is about $' + comma(gold.price) + ' an ounce' : '') + '.');

  // ranked detail tables (comprehensive view)
  var mkt = [];
  function mrow(v, name, dollar, neutral) { if (!v) return; mkt.push({ name: name, value: (dollar ? '$' : '') + comma(v.price), vsub: signed(v.chg) + '%', dir: neutral ? '' : (v.chg >= 0 ? 'pos' : 'neg') }); }
  mrow(sp, 'S&P 500'); mrow(nq, 'Nasdaq Composite'); mrow(dj, 'Dow Jones'); mrow(vix, 'VIX (volatility)', false, true); mrow(btc, 'Bitcoin', true); mrow(gold, 'Gold / oz', true);
  if (mkt.length) out.sections.push({ title: 'Markets right now', note: 'Yahoo Finance', sub: 'Latest level and change on the day. Green is up, red is down.', rows: mkt });
  var rr = [];
  if (tnx) rr.push({ name: '10-year Treasury', value: tnx.price.toFixed(2) + '%', vsub: 'benchmark' });
  if (irx) rr.push({ name: '3-month Treasury', value: irx.price.toFixed(2) + '%', vsub: 'short-term' });
  if (tnx && irx) rr.push({ name: 'Yield curve (10yr minus 3mo)', value: (tnx.price - irx.price).toFixed(2) + ' pts', vsub: inv ? 'inverted' : 'normal', dir: inv ? 'neg' : 'pos' });
  if (rr.length) out.sections.push({ title: 'Rates and the yield curve', sub: 'When short-term rates climb above long-term (a negative spread), the curve is inverted, a pattern that has preceded most U.S. recessions.', rows: rr });

  try { out.cards = await fetchFilings(); out.sources.push({ name: 'SEC EDGAR', live: true }); } catch (e) {}
  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Watch the yield curve', d: 'When short-term rates rise above long-term (an inverted curve), a slowdown has often followed within a year or so. It is a heads-up to build a cash cushion, not a reason to panic.' },
    { t: 'Check your bank’s health', d: 'Deposits are FDIC-insured to $250k per depositor, per bank. If you hold more, spread it across banks so every dollar stays covered.' },
    { t: 'Don’t time it, spread it', d: 'Steady, automatic investing across a broad low-cost index beats guessing tops and bottoms. General education, not advice.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the finance domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Sources: Yahoo Finance (index, rate and commodity levels), SEC EDGAR (newest 8-K material-event filings), Google News (headlines linking to original sources). Market data is delayed; figures are the latest available.';
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) { try { data = await build(); await db.set(KEY, data); } catch (e) { try { data = await db.get(KEY); } catch (e2) {} } }
  if (!data) return j(res, 503, { error: 'warming up' });
  return j(res, 200, data);
};
