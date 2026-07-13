/**
 * lib/youtube.js — shared YouTube Data API v3 signal source (system-wide, optional).
 *
 * YouTube is ONE signal option any domain can pull, not a backbone. It surfaces public
 * ENGAGEMENT velocity (views/day + likes) on recent videos for an arbitrary query — the
 * lens most domain feeds lack. Culture/Wave Radar was the first consumer (music); any
 * other domain gets its own signal by calling signal() with its own query + cacheKey.
 *
 * Key-gated: with no YOUTUBE_API_KEY, configured() is false and signal() returns
 * { on:false } so callers hide their panel — never a hard error.
 *
 * Quota discipline (10,000 units/day free): search.list = 100 units, videos.list = 1.
 * One snapshot ~= 101 units; signal() throttles snapshots per cacheKey (default 3h) and
 * stores ONE Redis doc per cacheKey, so a caller's page view is ~1 read. Budget across
 * domains accordingly — ~8 snapshots/day/query fits many queries under the daily cap.
 */
const db = require('./limen-db');

const KEY = process.env.YOUTUBE_API_KEY || '';
const API = 'https://www.googleapis.com/youtube/v3';
const DAY = 86400000;
const HIST_CAP = 48;
const PRUNE_MS = 21 * DAY;

function configured() { return !!KEY; }

async function fetchJSON(url) {
  try { const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}

// search.list → recent videos for a query (100 quota units). category '10' = Music; omit for any.
async function search(opts) {
  opts = opts || {};
  if (!KEY) return [];
  const days = opts.days || 21, max = Math.min(opts.max || 25, 50);
  const publishedAfter = new Date(Date.now() - days * DAY).toISOString();
  let url = API + '/search?part=snippet&type=video&order=' + (opts.order || 'viewCount')
    + '&maxResults=' + max + '&relevanceLanguage=' + (opts.lang || 'en')
    + '&publishedAfter=' + encodeURIComponent(publishedAfter) + '&key=' + KEY;
  if (opts.category) url += '&videoCategoryId=' + encodeURIComponent(opts.category);
  if (opts.channelId) url += '&channelId=' + encodeURIComponent(opts.channelId);
  if (opts.query) url += '&q=' + encodeURIComponent(opts.query);
  const j = await fetchJSON(url);
  return ((j && Array.isArray(j.items)) ? j.items : []).map(function (it) {
    const id = it.id && it.id.videoId, s = it.snippet || {};
    return id ? { id: id, title: s.title || '', channel: s.channelTitle || '', publishedAt: s.publishedAt || '',
      thumb: (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default) || {}).url || '' } : null;
  }).filter(Boolean);
}

// videos.list → live statistics for ids (1 quota unit, up to 50 ids/call).
async function stats(ids) {
  if (!KEY || !ids || !ids.length) return {};
  const url = API + '/videos?part=statistics,snippet&id=' + ids.slice(0, 50).join(',') + '&key=' + KEY;
  const j = await fetchJSON(url);
  const out = {};
  ((j && Array.isArray(j.items)) ? j.items : []).forEach(function (it) {
    const st = it.statistics || {}, s = it.snippet || {};
    out[it.id] = { views: Number(st.viewCount || 0) || 0, likes: Number(st.likeCount || 0) || 0,
      title: s.title || '', channel: s.channelTitle || '', publishedAt: s.publishedAt || '',
      thumb: (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default) || {}).url || '' };
  });
  return out;
}

// A channel's recent uploads + live stats (~101 units). Returns null if no channelId/key.
async function channel(channelId, max) {
  if (!KEY || !channelId) return null;
  const found = await search({ channelId: channelId, order: 'date', max: max || 10, days: 3650 });
  const s = await stats(found.map(function (f) { return f.id; }));
  const videos = found.map(function (f) {
    const v = s[f.id]; if (!v) return null;
    return { id: f.id, title: v.title, views: v.views, likes: v.likes, publishedAt: v.publishedAt,
      thumb: v.thumb, url: 'https://www.youtube.com/watch?v=' + f.id };
  }).filter(Boolean).sort(function (a, b) { return b.views - a.views; });
  return { channelId: channelId, totalViews: videos.reduce(function (a, v) { return a + v.views; }, 0), videos: videos };
}

// views/day velocity between the last two snapshots + phase. Thresholds are overridable
// (view scale differs wildly by domain); defaults are tuned for a broad music query.
function analyze(hist, thr) {
  thr = thr || { emerge: 50000, rise: 8000, cool: -2000 };
  const n = hist.length, cur = hist[n - 1];
  const views = cur ? cur.v : 0, likes = cur ? cur.l : 0;
  if (n < 2) return { views: views, likes: likes, velocity: 0, phase: 'baseline', points: n };
  const a = hist[n - 2], b = hist[n - 1], days = Math.max((b.t - a.t) / DAY, 0.04);
  const vel = Math.round((b.v - a.v) / days);
  let accel = 0;
  if (n >= 3) { const p = hist[n - 3], d0 = Math.max((a.t - p.t) / DAY, 0.04); accel = vel - Math.round((a.v - p.v) / d0); }
  let phase;
  if (vel > thr.emerge && accel > 0) phase = 'emerging';
  else if (vel > thr.rise) phase = 'rising';
  else if (vel < thr.cool) phase = 'cooling';
  else phase = 'steady';
  return { views: views, likes: likes, velocity: vel, accel: accel, phase: phase, points: n };
}

/**
 * signal(opts) — the shared cached velocity engine. Any domain calls this with its own
 * query + cacheKey and gets an emergence readout, warming until a 2nd snapshot lands.
 *
 * opts: { query, cacheKey, category, days, max, throttleMs, force, thresholds, limit }
 * returns { ok, on, warming, tracked, lastSnapshot, snapshotTaken, items:[...] }
 */
async function signal(opts) {
  opts = opts || {};
  if (!KEY) return { ok: true, on: false, items: [], note: 'YOUTUBE_API_KEY not set' };
  const cacheKey = opts.cacheKey || ('yt:sig:' + (opts.query ? opts.query.slice(0, 40) : 'default'));
  const throttleMs = opts.throttleMs || 3 * 60 * 60 * 1000;

  let doc = null; try { doc = await db.get(cacheKey); } catch (e) {}
  if (!doc || typeof doc !== 'object') doc = { lastsnap: 0, vids: {} };

  let snapshotTaken = false;
  try {
    if (opts.force || (Date.now() - Number(doc.lastsnap || 0)) > throttleMs) {
      const ts = Date.now();
      const found = await search({ query: opts.query, category: opts.category, days: opts.days, max: opts.max });
      if (found.length) {
        const s = await stats(found.map(function (f) { return f.id; }));
        const vids = doc.vids || {};
        found.forEach(function (f) {
          const v = s[f.id]; if (!v) return;
          const rec = vids[f.id] || { meta: {}, hist: [] };
          rec.meta = { title: v.title || f.title, channel: v.channel || f.channel, publishedAt: v.publishedAt || f.publishedAt, thumb: v.thumb || f.thumb };
          rec.hist.push({ t: ts, v: v.views, l: v.likes });
          if (rec.hist.length > HIST_CAP) rec.hist = rec.hist.slice(rec.hist.length - HIST_CAP);
          vids[f.id] = rec;
        });
        for (const id in vids) { const h = vids[id].hist; if (!h || !h.length || (ts - h[h.length - 1].t) > PRUNE_MS) delete vids[id]; }
        doc = { lastsnap: ts, vids: vids };
        snapshotTaken = true;
        try { await db.set(cacheKey, doc); } catch (e) {}
      }
    }
  } catch (e) {}

  const vids = doc.vids || {};
  const rows = Object.keys(vids).filter(function (id) { return vids[id].hist && vids[id].hist.length; })
    .map(function (id) { return Object.assign({ id: id, url: 'https://www.youtube.com/watch?v=' + id }, vids[id].meta || {}, analyze(vids[id].hist, opts.thresholds)); });
  const warming = !rows.length || rows.every(function (r) { return r.points < 2; });
  const limit = opts.limit || 12;
  const ranked = warming
    ? rows.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, limit)
    : rows.filter(function (r) { return r.phase === 'emerging' || r.phase === 'rising'; }).sort(function (a, b) { return b.velocity - a.velocity; }).slice(0, limit);
  const slim = function (r) { return { id: r.id, title: r.title, channel: r.channel, thumb: r.thumb, url: r.url,
    views: r.views, likes: r.likes, velocity: r.velocity || 0, phase: r.phase, points: r.points }; };

  return {
    ok: true, on: true, warming: warming, tracked: rows.length,
    lastSnapshot: doc.lastsnap || null, snapshotTaken: snapshotTaken,
    items: ranked.map(slim),
    note: warming ? 'YouTube signal is warming up — view-velocity appears once a second snapshot lands (a few hours).' : null
  };
}

module.exports = { configured, search, stats, channel, signal };
