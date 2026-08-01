/**
 * handlers/feed-record.js — THE RECORDER (hippocampus, component 1 of 3)
 *
 * GET /api/feed-record            → cron write: append one compact row per domain
 *                                    to durable per-domain feed history.
 * GET /api/feed-record?read=energy&n=48  → read back recent rows (verify / future resolver)
 * GET /api/feed-record?stats=1    → per-domain row counts + span (cheap health check)
 *
 * WHY THIS EXISTS
 *   The system has 240 live feeds and NO durable memory of them: readings flow through
 *   the 15-min snapshot worker and evaporate. Nothing can LEARN because nothing hears
 *   back from reality. This turns the feed RIVER into a RESERVOIR — the highest-leverage
 *   ~40 MB in the system, and the prerequisite for the resolver + consolidator
 *   (see HIPPOCAMPUS_CONSOLIDATION_SPEC.md, firewalled).
 *
 * DESIGN (v1, deliberately minimal)
 *   - Reads the SAME live snapshot the console worker uses (/api/domain-snapshot).
 *   - Records the guaranteed domain-level scalars (stress/activity/confidence/maturity)
 *     PLUS any numeric per-source fields present (stress/activity/value + live/channel),
 *     defensively — if a source carries no numerics, the domain row is still real data.
 *   - Compact rows (rounded, nulls dropped) so a year stays cheap.
 *   - Append via db.lpush, cap via db.ltrim (Redis list = purpose-fit for capped
 *     append-only time series; past Redis cost pain was BANDWIDTH, weekly reads only).
 *   - IDEMPOTENT PER HOUR: if the newest stored row is in the same hour bucket, skip.
 *     This neutralizes accidental/malicious re-triggers AND makes cron retries safe,
 *     with no new secret required.
 *
 * NOT here (later components, per spec): forecast resolution, offline weight fitting.
 * This only records. Additive; touches nothing in the scoring spine.
 */

var db = require('../lib/limen-db');

var CAP = 2160;                 // ~90 days at hourly cadence, per domain (fits Upstash free storage)
var HOUR_MS = 60 * 60 * 1000;
var SNAPSHOT_URL = 'https://www.limenhelix.com/api/domain-snapshot';

function r4(n) { return Math.round(n * 10000) / 10000; }
function isNum(n) { return typeof n === 'number' && isFinite(n); }

/**
 * Pull whatever numeric fields a source object actually carries (shape-tolerant).
 *
 * FIXED 2026-08-01 — `value` SATURATES, so recording it alone recorded nothing.
 *
 * Measured over the 362 hours this recorder had already stored for energy: of 18 sources,
 * 10 produced exactly ONE distinct value across the whole fortnight and 2 produced none.
 * The cause is that news-backed sources report `value` = article count, and a Google News
 * query returns a full page, so `value` is pinned at 100 forever. The recorder was faithfully
 * storing a constant and the history looked flat because the field was flat, not the world.
 *
 * Downstream this is not cosmetic: anything learning from this history sees ten dead series
 * and correctly refuses to use them, so most of the domain is unreadable by construction.
 *
 * The fix is to stop betting on one field. `value` is kept exactly as before (nothing that
 * reads `v` changes), and the fields that move are recorded alongside it:
 *
 *   hc  headline count        — differs from `value` when the feed returns fewer than a page
 *   hh  headline-set hash     — CHANGES WHENEVER THE STORIES CHANGE, even at value=100.
 *                               This is the one that rescues the ten dead channels: the
 *                               article count is pinned but the articles themselves turn over.
 *   r7  rss.recent7d          — recorded when present; it is the un-saturated recency count
 *   ua  age of the reading    — ms between the source's own update stamp and this row
 *   q   quality               — already computed upstream, never stored until now
 *
 * All additive. Every existing field keeps its name and meaning, so old rows stay readable
 * and nothing that parses them needs to change.
 */
function headlineHash(list) {
  // Cheap stable 32-bit hash of the joined headline set. Not cryptographic: it only has to
  // change when the set changes, which is the entire requirement.
  var s = list.join('');
  var h = 5381;
  for (var i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
  return h;
}

function compactSource(s, rowT) {
  if (!s || typeof s !== 'object') return null;
  var o = {};
  if (s.name) o.n = String(s.name).slice(0, 48);
  if (s.channel) o.ch = String(s.channel);
  if (typeof s.live === 'boolean') o.l = s.live ? 1 : 0;
  if (isNum(s.stress)) o.s = r4(s.stress);
  if (isNum(s.activity)) o.a = r4(s.activity);
  if (isNum(s.value)) o.v = r4(s.value);

  if (isNum(s.quality)) o.q = r4(s.quality);

  if (Array.isArray(s.headlines) && s.headlines.length) {
    o.hc = s.headlines.length;
    o.hh = headlineHash(s.headlines);
  }
  if (s.rss && typeof s.rss === 'object') {
    if (isNum(s.rss.recent7d)) o.r7 = s.rss.recent7d;
    if (isNum(s.rss.recent24h)) o.r1 = s.rss.recent24h;
    if (isNum(s.rss.medianAgeDays)) o.ma = r4(s.rss.medianAgeDays);
  }
  // Staleness, as a number rather than a timestamp: how old was this reading when recorded.
  var stamp = isNum(s.updated) ? s.updated : (isNum(s.fetchedAt) ? s.fetchedAt : null);
  if (stamp !== null && isNum(rowT)) o.ua = Math.max(0, rowT - stamp);

  // keep a source only if it carries at least a name or a number
  return (o.n || o.s !== undefined || o.a !== undefined || o.v !== undefined || o.hh !== undefined) ? o : null;
}

/**
 * NEVER RECORD A SIMULATED STRESS VALUE.
 *
 * A domain with no live sources at all gets `stress = 0.15 + sin(clock) * 0.05`
 * (handlers/domain-snapshot.js, the FALLBACK branch). That is honest at the source: it
 * ships a 'simulated - no live sources' signal alongside. But this recorder used to
 * store it with no check, so a sine wave of the wall clock would enter the durable
 * history indistinguishable from a reading, and everything downstream would forecast
 * and grade it as though it were the world.
 *
 * No domain is on that path today, so this closes a latent hole rather than an active
 * leak. It is the only stress value dropped here. Everything else is recorded, and the
 * decision about whether a series carries enough signal to forecast is made downstream
 * by lib/feed-resolver.deriveForecast, which measures the actual variance of the actual
 * window. That belongs there and not here: a value can be perfectly real and still have
 * nothing to predict, and only the history can tell you which.
 */
function compactRow(t, d) {
  var row = { t: t };
  var fabricated = d.stressBasis === 'simulated';
  if (isNum(d.stress) && !fabricated) row.s = r4(d.stress);
  else if (isNum(d.stress)) { row.sx = r4(d.stress); row.sb = 'simulated'; }
  if (isNum(d.activity)) row.a = r4(d.activity);
  if (isNum(d.confidence)) row.c = r4(d.confidence);
  if (d.maturity) row.m = String(d.maturity);
  if (isNum(d.liveCount)) row.lc = d.liveCount;
  var srcs = Array.isArray(d.sources) ? d.sources : [];
  var comp = [];
  for (var i = 0; i < srcs.length; i++) { var cs = compactSource(srcs[i], t); if (cs) comp.push(cs); }
  if (comp.length) row.src = comp;
  return row;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var start = Date.now();

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  // ── READ MODE: recent rows for one domain (newest first) ──
  if (q.read) {
    var n = Math.max(1, Math.min(500, parseInt(q.n, 10) || 48));
    try {
      var rows = await db.lrange('feedhist:' + q.read, 0, n - 1);
      return res.status(200).json({ ok: true, domain: q.read, count: (rows || []).length, rows: rows || [] });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── STATS MODE: per-domain span/count ──
  if (q.stats) {
    try {
      var idx = (await db.get('feedhist:index')) || [];
      var out = {};
      for (var si = 0; si < idx.length; si++) {
        var dom = idx[si];
        var recent = await db.lrange('feedhist:' + dom, 0, 0);
        var oldest = await db.lrange('feedhist:' + dom, -1, -1);
        out[dom] = {
          newest: (recent && recent[0] && recent[0].t) || null,
          oldest: (oldest && oldest[0] && oldest[0].t) || null
        };
      }
      return res.status(200).json({ ok: true, backend: db.getBackend(), domains: out });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── WRITE MODE (cron): fetch live snapshot, append one row per domain ──
  var snap;
  try {
    var resp = await fetch(SNAPSHOT_URL);
    snap = await resp.json();
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'domain-snapshot fetch failed: ' + e.message });
  }

  var domains = (snap && snap.domains) || {};
  var t = Date.now();
  var hourBucket = Math.floor(t / HOUR_MS);

  var written = 0, skipped = 0, domainKeys = [];
  for (var dk in domains) {
    if (!domains.hasOwnProperty(dk)) continue;
    domainKeys.push(dk);
    var key = 'feedhist:' + dk;

    // IDEMPOTENT PER HOUR: skip if newest row is already in this hour bucket
    try {
      var head = await db.lrange(key, 0, 0);
      if (head && head[0] && head[0].t && Math.floor(head[0].t / HOUR_MS) === hourBucket) {
        skipped++;
        continue;
      }
    } catch (e) { /* if the peek fails, fall through and write */ }

    var row = compactRow(t, domains[dk]);
    try {
      await db.lpush(key, row);       // newest at head
      await db.ltrim(key, 0, CAP - 1); // keep last ~90 days
      written++;
    } catch (e) { /* one domain failing must not abort the rest */ }
  }

  // Maintain a small index of which domain lists exist (for stats/resolver discovery)
  if (domainKeys.length) {
    try { await db.set('feedhist:index', domainKeys); } catch (e) {}
  }

  return res.status(200).json({
    ok: true,
    backend: db.getBackend(),
    written: written,
    skipped: skipped,
    domains: domainKeys.length,
    cap: CAP,
    processedIn: (Date.now() - start) + 'ms',
    note: written ? 'recorded' : (skipped ? 'idempotent-skip (already recorded this hour)' : 'no domains in snapshot')
  });
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('feed-record', module.exports);
