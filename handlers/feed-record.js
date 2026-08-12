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

/**
 * TITLE EVIDENCE, stored SEPARATELY from the numeric row, and why both of those matter.
 *
 * SEPARATE, because the numeric row is what every binder replays. `compactSource` below is
 * untouched by this: same fields, same order, same bytes, so brain replay, the pinned
 * READ_SHA and every measurement quoted against them are unaffected by titles existing.
 * Semantic evidence gets its own key, its own shape and its own retention, and a fault in
 * it cannot corrupt the spine.
 *
 * ON CHANGE ONLY, because the arithmetic does not survive doing otherwise. Measured
 * 2026-08-11 against production: a title record runs ~463 bytes (the Google News link alone
 * averages 297 characters and is 64% of it), and 496 titles exist across the twenty domains
 * per snapshot. Written every hour that is 224 KB per snapshot, which at the 90-day
 * retention the numeric rows use would be 473 MB. Measured over 200 real recorded rows,
 * only 39% of headline SETS are distinct — the count saturates but the stories turn over —
 * so writing a source's titles only when its set actually changes costs 39% of naive.
 *
 * That is still 184 MB at 90 days, on top of the ~84 MB the numeric rows already hold, so
 * retention is bounded HERE rather than inherited from CAP.
 *
 * COUNTED IN SETS, NOT TITLES. A cap on individual titles lets ltrim cut a headline set in
 * half, leaving a partial set that a reader cannot distinguish from a complete one. One
 * entry per changed set means trimming drops whole sets only.
 *
 * TUNABLE, with the arithmetic stated so the next person can re-derive it rather than guess:
 * a set is ~5 items x ~440 bytes ~= 2.2 KB, so sets-per-domain x 2.2 KB = storage per domain.
 * At 800: ~1.8 MB per domain, ~35 MB across twenty. Energy changes ~103 sets/day, so 800 is
 * roughly a week of its history; a quieter domain keeps proportionally longer.
 */
var TITLE_SET_CAP = 800;

/**
 * Upper bound on a stored title, as a guard against an unbounded upstream rather than an
 * expected path — the longest title measured live on Google News was 214 characters. Beyond
 * this the title is cut AND the cut is recorded on the item, because a silently shortened
 * string still reads as verbatim to everything downstream.
 */
var TITLE_MAX_CHARS = 2000;
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
  //
  // `updated` and `fetchedAt` are BOTH Date.now() at the point the snapshot is built
  // (handlers/domain-snapshot.js). They are OUR clock, not the source's, so `ua` measures
  // how stale our own fetch was and says nothing about whether the source published
  // anything new. It is kept because staleness is worth having, but nothing downstream
  // may count evidence from it.
  var stamp = isNum(s.updated) ? s.updated : (isNum(s.fetchedAt) ? s.fetchedAt : null);
  if (stamp !== null && isNum(rowT)) o.ua = Math.max(0, rowT - stamp);

  /**
   * ── su: THE SOURCE'S OWN OBSERVATION IDENTITY ──────────────────────────────────────
   *
   * THE ONE FIELD THAT MAKES A RECORDED ROW COUNTABLE AS EVIDENCE, and it was being
   * thrown away.
   *
   * `sourceUpdatedAt` is set by 26 fetchers in domain-snapshot.js from the UPSTREAM
   * record's own key — the FRED observation date, the EIA period, openFDA's
   * `meta.last_updated`. Unlike `updated`/`fetchedAt` it is not our clock: it changes
   * when, and only when, the source publishes a new observation. That is precisely the
   * question `core/channel.js sourceIdentity()` needs answered, and until now the
   * recorder computed `ua` from a DIFFERENT field and dropped this one entirely.
   *
   * The consequence was structural, not cosmetic. Every recorded fixture carried polls
   * with no way to tell a fresh observation from a re-read of a cached one, so the
   * divergence ledger could never accumulate independent observations — it could only
   * count polls, which is counting our own scheduler. SPEC row 10 has been blocked on
   * exactly this, and the information existed at record time the whole while.
   *
   * STORED RAW, AS A STRING. These are the source's own tokens ("2026-07-30", an EIA
   * period, an ISO stamp) and the token IS the identity: same token means same
   * observation, a new token means the source spoke. Parsing it to epoch ms would be
   * lossy for period-style keys and would invent precision the source never gave.
   * Truncated only to bound the row.
   */
  if (s.sourceUpdatedAt !== undefined && s.sourceUpdatedAt !== null && s.sourceUpdatedAt !== '') {
    o.su = String(s.sourceUpdatedAt).slice(0, 64);
  }

  // keep a source only if it carries at least a name or a number
  return (o.n || o.s !== undefined || o.a !== undefined || o.v !== undefined || o.hh !== undefined) ? o : null;
}

/**
 * IDENTITY COVERAGE, measured rather than assumed.
 *
 * Which sources actually supply their own observation key is a fact about 240 live
 * feeds that nobody can answer from the code: a fetcher may set `sourceUpdatedAt` from a
 * field the API only sometimes returns. So every write reports the per-domain count, and
 * after one run the answer is measured instead of guessed. Do not use this to decide a
 * channel is usable — it says a token was present, not that it changes.
 */
function identityCoverage(row) {
  var srcs = (row && row.src) || [];
  var withId = 0;
  for (var i = 0; i < srcs.length; i++) if (srcs[i].su !== undefined) withId++;
  return { sources: srcs.length, withSourceIdentity: withId };
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

  /**
   * ── TITLE MODE: recent title evidence for one domain, newest first ──
   *
   * Open, like the numeric read path beside it, and for the same reason: this records what
   * public feeds already published, so gating it would protect nothing while making the
   * store unverifiable from outside the process. Whether a title was preserved with its
   * provenance intact is exactly the thing a reviewer needs to be able to check.
   */
  if (q.titles) {
    var tn = Math.max(1, Math.min(500, parseInt(q.n, 10) || 48));
    try {
      var trows = await db.lrange('feedtitles:' + q.titles, 0, tn - 1);
      return res.status(200).json({ ok: true, domain: q.titles, count: (trows || []).length, titles: trows || [] });
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
  var titlesWritten = 0, titleSetsWritten = 0, titleErrors = 0;
  var coverage = {}, covTotal = 0, covWithId = 0;
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
    var cov = identityCoverage(row);
    coverage[dk] = cov;
    covTotal += cov.sources; covWithId += cov.withSourceIdentity;
    try {
      await db.lpush(key, row);       // newest at head
      await db.ltrim(key, 0, CAP - 1); // keep last ~90 days
      written++;
    } catch (e) { /* one domain failing must not abort the rest */ }

    /**
     * TITLE EVIDENCE — observational only, written to its OWN key, as WHOLE SETS.
     *
     * What this is: the titles this system already fetches, kept with the provenance the
     * feed already supplied, so a later reader can tell WHICH item a title was, WHEN it was
     * published and WHAT PUBLISHER LABEL it carried. Those are parsed and thrown away today,
     * which is why a title can currently only be counted, never cited.
     *
     * What this is NOT: nothing here classifies a title, scores it, derives stress from it,
     * creates a candidate, or touches a pathway. It moves text across the recorder boundary
     * and stops.
     *
     * ── THE CHECKPOINT IS THE TITLE STORE'S OWN, NOT THE NUMERIC ROW'S ────────────────
     *
     * The first version decided "has this set changed?" by comparing against the PREVIOUS
     * NUMERIC ROW's `hh`. That loses data permanently: if the numeric row is written and the
     * title write then fails, the next cycle compares against a numeric row that already
     * carries the new hash, concludes nothing changed, and never retries. The titles are
     * gone with no error and no gap anyone can see.
     *
     * So persistence is tracked separately and the checkpoint advances ONLY after the
     * corresponding write succeeded — per source, so one source failing cannot mark another
     * as persisted. A failed write leaves the checkpoint behind and the next cycle retries.
     *
     * ── WHOLE SETS, because ltrim counts entries, not meaning ─────────────────────────
     *
     * Storing one entry per title let the cap split a headline set down the middle, leaving
     * a partial set that looks complete. Each changed set is now ONE entry carrying its
     * items, so trimming can drop a whole set but never half of one, and each item still
     * records its index and the set's size.
     */
    try {
      var ckKey = 'feedtitles:ck:' + dk;
      var checkpoint = {};
      try { checkpoint = (await db.get(ckKey)) || {}; } catch (e) { checkpoint = {}; }

      var sources = domains[dk].sources || [];
      for (var si = 0; si < sources.length; si++) {
        var s = sources[si];
        if (!s || !Array.isArray(s.headlines) || !s.headlines.length) continue;
        var hh = headlineHash(s.headlines);
        /* Already persisted, by this store's own record of what it persisted. */
        if (checkpoint[s.name] === hh) continue;

        var links = Array.isArray(s.headlineLinks) ? s.headlineLinks : [];
        var pubAt = Array.isArray(s.headlinePublishedAt) ? s.headlinePublishedAt : [];
        var pubBy = Array.isArray(s.headlinePublishers) ? s.headlinePublishers : [];
        var items = [];
        for (var hi = 0; hi < s.headlines.length; hi++) {
          var title = s.headlines[hi];
          if (typeof title !== 'string' || !title.trim()) continue;
          var item = {
            i: hi,                               // position within the set
            ti: title,                           // the title, VERBATIM — not truncated
            /* AGGREGATOR ITEM URL. A news.google.com redirect: the only per-item identifier
               this feed supplies. Deliberately NOT named canonicalUrl and NOT a
               publisher-issued GUID, because it is neither. null where none parsed. */
            au: (typeof links[hi] === 'string' && links[hi]) ? links[hi] : null,
            pa: (typeof pubAt[hi] === 'number' && isFinite(pubAt[hi])) ? pubAt[hi] : null,
            /**
             * PUBLISHER LABEL, as the feed states it in <source>. A LABEL AND NOTHING MORE.
             *
             * It is not proof of ownership, not evidence of editorial independence, and not
             * evidence of syndication independence. Two labels differing does not make two
             * sources independent: both may be resyndicating one wire story, and this field
             * cannot tell you. Anything that later wants an independence verdict has to
             * establish it across evidence and record how — it may not read it off here.
             */
            pl: (typeof pubBy[hi] === 'string' && pubBy[hi]) ? pubBy[hi] : null
          };
          /* A pathological title is bounded rather than stored whole, but truncation is
             RECORDED rather than silent: `ti` alone would still read as verbatim. Measured
             on live Google News, the longest title seen was 214 characters, so this is a
             guard against the unbounded case and not an expected path. */
          if (item.ti.length > TITLE_MAX_CHARS) {
            item.tr = { truncated: true, originalLength: item.ti.length };
            item.ti = item.ti.slice(0, TITLE_MAX_CHARS);
          }
          items.push(item);
        }
        if (!items.length) continue;

        var setRec = {
          t: t,                                  // when WE recorded it — receipt only, our clock
          d: dk,
          f: s.name,                             // the FEED it arrived on, in full. Not the publisher.
          ck: 'headline_title',                  // contentKind: titles, never article bodies
          hh: hh,                                // ties this set to the numeric row's hash
          n: items.length,                       // set size, so a reader can see it is whole
          items: items
        };
        try {
          await db.lpush('feedtitles:' + dk, setRec);
          await db.ltrim('feedtitles:' + dk, 0, TITLE_SET_CAP - 1);
          /* ONLY NOW. The checkpoint records what was actually persisted. */
          checkpoint[s.name] = hh;
          titleSetsWritten++;
          titlesWritten += items.length;
        } catch (e) { titleErrors++; }   // checkpoint stays behind, so the next cycle retries
      }
      try { await db.set(ckKey, checkpoint); } catch (e) { titleErrors++; }
    } catch (e) { titleErrors++; }
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
    /* Title evidence written this run, and failures writing it. Reported separately from
       `written` because they are separate stores with separate retention: a run that
       recorded every numeric row and no titles is a different event from a clean one, and
       collapsing them would hide it. Zero titles is NORMAL on a run where no headline set
       changed; it is only a problem if it never moves. */
    titlesWritten: titlesWritten,
    titleErrors: titleErrors,
    titleSetsWritten: titleSetsWritten,
    titleSetCap: TITLE_SET_CAP,
    /* Per-domain: how many sources carried their own observation key this run. The
       number that matters for SPEC row 10 — a domain at 0 cannot accumulate independent
       observations no matter how long it records. */
    identityCoverage: coverage,
    identityCoverageTotal: covTotal ? covWithId + '/' + covTotal +
      ' sources carried a source-supplied observation key' : 'no sources recorded',
    processedIn: (Date.now() - start) + 'ms',
    note: written ? 'recorded' : (skipped ? 'idempotent-skip (already recorded this hour)' : 'no domains in snapshot')
  });
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('feed-record', module.exports);

/* The pure row-shaping helpers, exported for test. They touch no network and no db, so
   the recorder's contract can be verified offline against a synthetic snapshot — which
   is the only way to test it at all: the live path needs a deploy, a cron trigger and an
   hour to elapse before it writes anything. */
module.exports._compactSource = compactSource;
module.exports._compactRow = compactRow;
module.exports._identityCoverage = identityCoverage;
