/**
 * api/infrastructure-live.js — REAL national infrastructure status (free, no key).
 *
 * GET /api/infrastructure-live         → live FAA airport delays / ground stops / closures
 *                                        + infrastructure headlines
 * GET /api/infrastructure-live?fresh=1 → bypass cache (ops)
 *
 * Source: FAA National Airspace System status (nasstatus.faa.gov) — keyless, official,
 * updates minute-to-minute. Headlines via Google News RSS (links only). Redis-cached
 * ~10 min. Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');
var KEY = 'infra:live:v1';
var TTL_MS = 10 * 60 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
function blocks(xml, tag) { var re = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g'), out = [], m; while ((m = re.exec(xml))) out.push(m[1]); return out; }

function decode(s) { return String(s == null ? '' : s).replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim(); }
async function fetchNews() {
  var q = '("power grid" OR blackout OR "power outage" OR "bridge" OR infrastructure OR "water main" OR "flight delays" OR transit OR "traffic" OR dam OR pipeline)';
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

async function fetchFAA() {
  var r = await fetch('https://nasstatus.faa.gov/api/airport-status-information', { headers: { 'User-Agent': 'LIMEN-Helix-InfraWatch (limenhelix.com)' } });
  if (!r.ok) throw new Error('faa ' + r.status);
  var xml = await r.text();
  var stops = blocks(xml, 'Ground_Stop').map(function (b) { return { arpt: m1(/<ARPT>([^<]+)/, b), reason: m1(/<Reason>([^<]+)/, b), kind: 'Ground stop' }; });
  var delays = blocks(xml, 'Ground_Delay').map(function (b) { return { arpt: m1(/<ARPT>([^<]+)/, b), reason: m1(/<Reason>([^<]+)/, b), avg: m1(/<Avg>([^<]+)/, b), kind: 'Ground delay' }; });
  var closures = blocks(xml, 'Airport_Closure').map(function (b) { return { arpt: m1(/<ARPT>([^<]+)/, b), reason: m1(/<Reason>([^<]+)/, b), kind: 'Closure' }; });
  var arrdep = blocks(xml, 'Delay').map(function (b) { return { arpt: m1(/<ARPT>([^<]+)/, b), reason: m1(/<Reason>([^<]+)/, b), kind: 'Arrival/departure delay' }; }).filter(function (d) { return d.arpt; });
  return { stops: stops, delays: delays, closures: closures, arrdep: arrdep };
}

async function build() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now(), stats: [], wow: [], cards: [], todo: [], sources: [{ name: 'FAA (NAS status)', live: true }] };

  var faa = null;
  try { faa = await fetchFAA(); } catch (e) {}
  if (faa) {
    var totalAir = faa.stops.length + faa.delays.length + faa.closures.length + faa.arrdep.length;
    out.stats.push({ n: String(totalAir), k: 'Airports disrupted now', c: 'FAA ground stops, delays & closures', hot: totalAir > 0 });
    out.stats.push({ n: String(faa.stops.length), k: 'Active ground stops', c: 'flights held on the ground' });
    out.stats.push({ n: String(faa.delays.length), k: 'Ground delay programs', c: 'metered arrivals' });
    out.stats.push({ n: String(faa.closures.length), k: 'Airport closures' });

    out.wow.push(totalAir > 0 ? (totalAir + ' major U.S. airport' + (totalAir === 1 ? ' has' : 's have') + ' active FAA delays, ground stops or closures right now.') : 'No major FAA ground stops or delays are active right now; the national airspace is running clean.');
    var gd = faa.delays.find(function (d) { return d.avg; });
    if (gd) out.wow.push(gd.arpt + ' is running an average ' + gd.avg + ' ground delay right now (FAA)' + (gd.reason ? ', due to ' + gd.reason : '') + '.');
    if (faa.stops.length) out.wow.push(faa.stops.length + ' airport' + (faa.stops.length === 1 ? ' is' : 's are') + ' under a full ground stop this hour, no departures until it lifts.');

    var all = faa.stops.concat(faa.closures).concat(faa.delays).concat(faa.arrdep);
    out.cards = all.slice(0, 12).map(function (a) {
      return { title: a.arpt + ' · ' + a.kind, meta: a.reason ? 'Reason: ' + a.reason : 'FAA', body: a.avg ? 'Average delay ' + a.avg + '.' : '', href: 'https://nasstatus.faa.gov/' };
    });
  }

  try { var nw = await fetchNews(); out.cards = out.cards.concat(nw); out.sources.push({ name: 'Google News', live: true }); } catch (e) {}

  out.todo = [
    { t: 'Flying today? Check first', d: 'FAA delays cascade fast. Before you leave for the airport, check your flight with the airline and the live board, a ground stop upstream can hold your plane even in clear weather.' },
    { t: 'Report what’s broken', d: 'Potholes, downed lines, water-main breaks and outages get fixed faster when reported. Call your city 311 or use its app, most now track the ticket for you.' },
    { t: 'Prep for outages', d: 'Aging grids fail under heat and storms. A few days of water, a battery bank, and a full tank turn a multi-day outage from a crisis into an inconvenience.' },
    { t: 'Track this domain', d: 'Watch this page (top) and we email you when the infrastructure domain’s LIMEN phase shifts.' }
  ];
  out.cite = 'Source: FAA National Airspace System status (nasstatus.faa.gov), keyless and official, updated minute-to-minute. Headlines via Google News (links to original sources).';
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
