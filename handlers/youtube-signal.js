/**
 * handlers/youtube-signal.js — YouTube emergence signal for Wave Radar (Culture front).
 *
 * The radar reads chart RANK (Deezer) + geo/tag signal (Last.fm). YouTube adds the one
 * thing those miss: real audience ENGAGEMENT velocity — views/day + likes on music videos.
 * Same emergence thesis as wave-radar.js (acceleration, not size), pointed at YouTube.
 *
 * Two lanes, both cheap and both optional:
 *   1. LANE TREND — recent music videos in DMAD's rap/hip-hop lane, ranked by view velocity.
 *   2. HIS CHANNEL — DMAD's own uploads + live view/like counts, IF a channel is configured
 *      (env DMAD_YT_CHANNEL or ?channel=UC...). Skipped entirely when unset — no guessing.
 *
 * Key-gated: with no YOUTUBE_API_KEY it returns { ok:true, on:false } so the UI hides the
 * panel — never a hard error, same discipline as the Last.fm lane in wave-radar.js.
 *
 * Cost/quota discipline (YouTube Data API v3 = 10,000 units/day free):
 *   - search.list = 100 units, videos.list = 1 unit/call. One snapshot ~= 101 units.
 *   - Snapshots are throttled to once / 3h (cron-forceable), so ~8/day ~= ~800 units/day.
 *   - ONE Redis doc `wave:youtube` holds the whole time-series → a page view is ~1 read.
 *
 * GET /api/youtube-signal            → cached lane trend (+ channel block if configured)
 * GET /api/youtube-signal?force=1    → force a fresh snapshot (also auto-forced for vercel-cron)
 */
const db = require('../lib/limen-db');

const KEY = process.env.YOUTUBE_API_KEY || '';
const DMAD_CHANNEL = process.env.DMAD_YT_CHANNEL || '';   // e.g. UCxxxx…; unset = channel lane off
// DMAD's lane. Music category = 10. Query is tuned to his sound; override via env if needed.
const LANE_QUERY = process.env.YT_LANE_QUERY || 'rap hip hop new music 2026 official';
const API = 'https://www.googleapis.com/youtube/v3';

const DOC_KEY = 'wave:youtube';
const SNAP_THROTTLE_MS = 3 * 60 * 60 * 1000;   // 3h — matches the radar's cadence
const HIST_CAP = 48;
const PRUNE_MS = 21 * 24 * 60 * 60 * 1000;
const SEARCH_MAX = 25;                          // videos pulled per lane snapshot (bounded cost)
const DAY = 86400000;

async function fetchJSON(url) {
  try { const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}

// search.list → recent music videos in the lane, most-viewed first (100 quota units).
async function searchLane() {
  const publishedAfter = new Date(Date.now() - 21 * DAY).toISOString();
  const url = API + '/search?part=snippet&type=video&videoCategoryId=10&order=viewCount'
    + '&maxResults=' + SEARCH_MAX + '&relevanceLanguage=en&publishedAfter=' + encodeURIComponent(publishedAfter)
    + '&q=' + encodeURIComponent(LANE_QUERY) + '&key=' + KEY;
  const j = await fetchJSON(url);
  const items = (j && Array.isArray(j.items)) ? j.items : [];
  return items.map(function (it) {
    const id = it.id && it.id.videoId; const s = it.snippet || {};
    return id ? { id: id, title: s.title || '', channel: s.channelTitle || '', publishedAt: s.publishedAt || '',
      thumb: (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default) || {}).url || '' } : null;
  }).filter(Boolean);
}

// videos.list → live statistics for a set of ids (1 quota unit, up to 50 ids per call).
async function videoStats(ids) {
  if (!ids.length) return {};
  const url = API + '/videos?part=statistics,snippet&id=' + ids.slice(0, 50).join(',') + '&key=' + KEY;
  const j = await fetchJSON(url);
  const out = {};
  ((j && Array.isArray(j.items)) ? j.items : []).forEach(function (it) {
    const st = it.statistics || {}, s = it.snippet || {};
    out[it.id] = {
      views: Number(st.viewCount || 0) || 0, likes: Number(st.likeCount || 0) || 0,
      title: s.title || '', channel: s.channelTitle || '', publishedAt: s.publishedAt || '',
      thumb: (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default) || {}).url || ''
    };
  });
  return out;
}

// DMAD's own recent uploads (search on his channel, then live stats). ~101 units, only if configured.
async function channelBlock() {
  if (!DMAD_CHANNEL) return null;
  const url = API + '/search?part=snippet&type=video&order=date&maxResults=10&channelId=' + encodeURIComponent(DMAD_CHANNEL) + '&key=' + KEY;
  const j = await fetchJSON(url);
  const ids = ((j && Array.isArray(j.items)) ? j.items : []).map(function (it) { return it.id && it.id.videoId; }).filter(Boolean);
  const stats = await videoStats(ids);
  const vids = ids.map(function (id) {
    const s = stats[id]; if (!s) return null;
    return { id: id, title: s.title, views: s.views, likes: s.likes, publishedAt: s.publishedAt,
      thumb: s.thumb, url: 'https://www.youtube.com/watch?v=' + id };
  }).filter(Boolean).sort(function (a, b) { return b.views - a.views; });
  const totalViews = vids.reduce(function (a, v) { return a + v.views; }, 0);
  return { channelId: DMAD_CHANNEL, totalViews: totalViews, videos: vids.slice(0, 6) };
}

// One snapshot: refresh the lane time-series in place, prune stale entries.
async function takeSnapshot(doc) {
  const ts = Date.now();
  const found = await searchLane();
  if (!found.length) return doc;
  const stats = await videoStats(found.map(function (f) { return f.id; }));
  const vids = doc.vids || {};
  found.forEach(function (f) {
    const s = stats[f.id]; if (!s) return;
    const rec = vids[f.id] || { meta: {}, hist: [] };
    rec.meta = { title: s.title || f.title, channel: s.channel || f.channel, publishedAt: s.publishedAt || f.publishedAt, thumb: s.thumb || f.thumb };
    rec.hist.push({ t: ts, v: s.views, l: s.likes });
    if (rec.hist.length > HIST_CAP) rec.hist = rec.hist.slice(rec.hist.length - HIST_CAP);
    vids[f.id] = rec;
  });
  for (const id in vids) { const h = vids[id].hist; if (!h || !h.length || (ts - h[h.length - 1].t) > PRUNE_MS) delete vids[id]; }
  return Object.assign({}, doc, { lastsnap: ts, vids: vids });
}

// views/day velocity between the last two snapshots + phase. Warming until a 2nd snapshot lands.
function analyze(hist) {
  const n = hist.length, cur = hist[n - 1];
  const views = cur ? cur.v : 0, likes = cur ? cur.l : 0;
  if (n < 2) return { views: views, likes: likes, velocity: 0, phase: 'baseline', points: n };
  const a = hist[n - 2], b = hist[n - 1];
  const days = Math.max((b.t - a.t) / DAY, 0.04);
  const vel = Math.round((b.v - a.v) / days);          // views gained per day
  let accel = 0;
  if (n >= 3) { const p = hist[n - 3]; const d0 = Math.max((a.t - p.t) / DAY, 0.04); accel = vel - Math.round((a.v - p.v) / d0); }
  let phase;
  if (vel > 50000 && accel > 0) phase = 'emerging';
  else if (vel > 8000) phase = 'rising';
  else if (vel < -2000) phase = 'cooling';
  else phase = 'steady';
  return { views: views, likes: likes, velocity: vel, accel: accel, phase: phase, points: n };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  if (!KEY) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, on: false, items: [], note: 'YOUTUBE_API_KEY not set' })); }

  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  const ua = String((req.headers && (req.headers['user-agent'] || req.headers['User-Agent'])) || '');
  const force = u.searchParams.get('force') === '1' || /vercel-cron/i.test(ua);

  let doc = null; try { doc = await db.get(DOC_KEY); } catch (e) {}
  if (!doc || typeof doc !== 'object') doc = { lastsnap: 0, vids: {} };

  let snapshotTaken = false;
  try {
    if (force || (Date.now() - Number(doc.lastsnap || 0)) > SNAP_THROTTLE_MS) {
      const next = await takeSnapshot(doc);
      if (next.lastsnap) { doc = next; snapshotTaken = true; try { await db.set(DOC_KEY, doc); } catch (e) {} }
    }
  } catch (e) {}

  const vids = doc.vids || {};
  let rows = Object.keys(vids).filter(function (id) { return vids[id].hist && vids[id].hist.length; })
    .map(function (id) { return Object.assign({ id: id, url: 'https://www.youtube.com/watch?v=' + id }, vids[id].meta || {}, analyze(vids[id].hist)); });

  const warming = !rows.length || rows.every(function (r) { return r.points < 2; });
  // Rising = by velocity once we have it; while warming, fall back to raw view count so it's never empty.
  const rising = warming
    ? rows.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, 12)
    : rows.filter(function (r) { return r.phase === 'emerging' || r.phase === 'rising'; }).sort(function (a, b) { return b.velocity - a.velocity; }).slice(0, 12);
  const slim = function (r) { return { id: r.id, title: r.title, channel: r.channel, thumb: r.thumb, url: r.url,
    views: r.views, likes: r.likes, velocity: r.velocity || 0, phase: r.phase, points: r.points }; };

  let channel = null; try { if (force || snapshotTaken || u.searchParams.get('channel')) channel = await channelBlock(); } catch (e) {}

  res.statusCode = 200;
  return res.end(JSON.stringify({
    ok: true, on: true, warming: warming, tracked: rows.length,
    lastSnapshot: doc.lastsnap || null, snapshotTaken: snapshotTaken,
    items: rising.map(slim), channel: channel,
    note: warming ? 'YouTube signal is warming up — a baseline is set. View-velocity appears once a second snapshot lands (a few hours).' : null
  }));
};
