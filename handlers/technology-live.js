/**
 * api/technology-live.js — REAL cyber threats: the flaws hackers are exploiting now (free, no key).
 *
 * GET /api/technology-live         → CISA actively-exploited vulnerabilities + tech news
 * GET /api/technology-live?fresh=1 → bypass cache (ops)
 *
 * Source: CISA Known Exploited Vulnerabilities catalog (cisa.gov) — keyless, official,
 * the flaws confirmed to be under active attack. Headlines via Google News RSS (links
 * only). Redis-cached ~3 h. Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'tech:live:v1';
var TTL_MS = 3 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function cap(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function getJSON(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-Helix-TechWatch (limenhelix.com)', 'Accept': 'application/json' } }); if (!r.ok) throw new Error('kev ' + r.status); return r.json(); }
function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '(cybersecurity OR hack OR "data breach" OR ransomware OR "zero-day" OR "software vulnerability" OR CVE OR "AI" OR patch OR exploit)';
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

  var kev = [];
  try { var d = await getJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'); kev = (d.vulnerabilities || []).slice(); out.sources.push({ name: 'CISA KEV', live: true }); } catch (e) {}

  if (kev.length) {
    kev.sort(function (a, b) { return String(b.dateAdded).localeCompare(String(a.dateAdded)); });
    var monthStart = new Date().toISOString().slice(0, 7);
    var addedThisMonth = kev.filter(function (v) { return String(v.dateAdded).slice(0, 7) === monthStart; }).length;
    var ransom = kev.filter(function (v) { return /known/i.test(v.knownRansomwareCampaignUse || ''); }).length;
    var newest = kev[0];

    out.stats.push({ n: kev.length.toLocaleString(), k: 'Flaws under active attack', c: 'in CISA’s exploited-vuln catalog', hot: true });
    out.stats.push({ n: String(addedThisMonth), k: 'Added this month', c: 'newly seen being exploited' });
    out.stats.push({ n: ransom.toLocaleString(), k: 'Used in ransomware', c: 'linked to known campaigns', hot: ransom > 0 });
    if (newest) out.stats.push({ n: newest.cveID, k: 'Newest exploited flaw', c: cap((newest.vendorProject || '') + ' ' + (newest.product || ''), 26) });

    out.wow.push(kev.length.toLocaleString() + ' software vulnerabilities are being actively exploited by attackers right now, catalogued by CISA.');
    if (newest) out.wow.push('The newest confirmed exploit: ' + newest.cveID + ' in ' + (newest.vendorProject || '') + ' ' + (newest.product || '') + ', added ' + newest.dateAdded + '.');
    if (ransom) out.wow.push(ransom.toLocaleString() + ' of these flaws are tied to known ransomware campaigns, the ones locking up hospitals and cities.');
    if (addedThisMonth) out.wow.push(addedThisMonth + ' new actively-exploited flaws were added just this month; each is a patch you likely need now.');

    out.sections.push({
      title: 'Patch these now: actively exploited', note: 'CISA',
      sub: 'The most recently confirmed vulnerabilities under active attack. Red means it is tied to known ransomware.',
      rows: kev.slice(0, 14).map(function (v) { return { name: (v.vendorProject || '') + ' ' + cap(v.product, 30), value: v.cveID, vsub: v.dateAdded, dir: /known/i.test(v.knownRansomwareCampaignUse || '') ? 'neg' : '' }; })
    });
    out.cards = kev.slice(0, 10).map(function (v) { return { title: v.vulnerabilityName || (v.vendorProject + ' ' + v.product), meta: v.cveID + ' · ' + (v.vendorProject || '') + ' · added ' + v.dateAdded, body: cap(v.shortDescription, 170), href: 'https://nvd.nist.gov/vuln/detail/' + v.cveID }; });
  }

  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Turn on automatic updates', d: 'Most of these attacks hit devices that skipped a patch. Enable auto-update on your phone, computer, router, and apps, it closes the exact holes in the list above.' },
    { t: 'Use a password manager + 2FA', d: 'Reused passwords are how one breach becomes ten. A manager makes every login unique; two-factor stops a stolen password from being enough.' },
    { t: 'Check if you’ve been breached', d: 'Enter your email at haveibeenpwned.com (free) to see which breaches exposed you, then change those passwords first.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the technology domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: CISA Known Exploited Vulnerabilities catalog, the U.S. cyber agency’s list of flaws confirmed to be under active attack, keyless and official. Headlines via Google News (links to original sources).';
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
