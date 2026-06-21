/**
 * api/wave-radar.js — LIMEN Wave Radar (music emergence engine).
 *
 * Emergence = ACCELERATION, not size. We sample live music charts over time, store
 * a per-track time-series, and compute velocity (rank change/day) + acceleration to
 * surface what's CLIMBING FAST off a low base (P1 emerging) vs already PEAKING (P7).
 *
 * v1 signal: Deezer's free, keyless charts API (by genre). The radar "warms up" —
 * velocity/emergence only exist once ≥2 snapshots accrue. Upgrade path: add Shazam
 * (discovery), Last.fm (geo velocity), Spotify popularity, YouTube view velocity.
 *
 * Storage: ONE Redis doc (wave:db) — { lastsnap, tracks:{ id:{meta, hist:[{t,p,g}]} } }
 * so a page view is ~1 read (cost-safe; no per-track fan-out). Snapshots are taken on
 * view, throttled to every few hours, and accrue history from real traffic.
 */
const db = require('../lib/limen-db');

const SOURCES = [
  { genre: 0,   key: 'all',    label: 'Overall' },
  { genre: 116, key: 'hiphop', label: 'Hip-Hop / Rap' },
  { genre: 132, key: 'pop',    label: 'Pop' },
  { genre: 113, key: 'dance',  label: 'Dance / Electronic' },
  { genre: 165, key: 'rnb',    label: 'R&B' },
  { genre: 152, key: 'rock',   label: 'Rock' }
];
const SNAP_THROTTLE_MS = 3 * 60 * 60 * 1000; // snapshot at most every 3h
const HIST_CAP = 48;                          // keep last 48 points per track
const PRUNE_MS = 16 * 24 * 60 * 60 * 1000;    // drop tracks unseen for 16 days
const DAY = 86400000;

async function fetchChart(genre) {
  try {
    const r = await fetch('https://api.deezer.com/chart/' + genre + '/tracks?limit=50', { headers: { accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j && Array.isArray(j.data)) ? j.data : [];
  } catch (e) { return []; }
}

async function takeSnapshot(doc) {
  const ts = Date.now();
  const best = {}; // id -> best (lowest) position across genres this snapshot
  for (const src of SOURCES) {
    const tracks = await fetchChart(src.genre);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]; if (!t || !t.id) continue;
      const id = String(t.id), pos = i + 1;
      if (!best[id] || pos < best[id].pos) {
        best[id] = {
          pos: pos, g: src.key, glabel: src.label,
          title: t.title || '', artist: (t.artist && t.artist.name) || '',
          cover: (t.album && (t.album.cover_small || t.album.cover)) || '', link: t.link || ''
        };
      }
    }
  }
  if (!Object.keys(best).length) return doc; // all sources failed — keep prior doc untouched
  const tracks = doc.tracks || {};
  for (const id in best) {
    const b = best[id];
    const rec = tracks[id] || { meta: {}, hist: [] };
    rec.meta = { title: b.title, artist: b.artist, cover: b.cover, link: b.link, genre: b.g, glabel: b.glabel };
    rec.hist.push({ t: ts, p: b.pos, g: b.g });
    if (rec.hist.length > HIST_CAP) rec.hist = rec.hist.slice(rec.hist.length - HIST_CAP);
    tracks[id] = rec;
  }
  // prune stale tracks to bound the doc size
  for (const id in tracks) {
    const h = tracks[id].hist;
    if (!h || !h.length || (ts - h[h.length - 1].t) > PRUNE_MS) delete tracks[id];
  }
  return { lastsnap: ts, tracks: tracks };
}

function analyze(hist) {
  const n = hist.length, cur = hist[n - 1];
  if (n < 2) return { phase: 'baseline', velocity: 0, accel: 0, emergence: 0, cur: cur.p, points: n };
  const vel = (a, b) => { const dt = Math.max((b.t - a.t) / DAY, 0.04); return (a.p - b.p) / dt; }; // p smaller = better → + = climbing
  const vRecent = vel(hist[n - 2], hist[n - 1]);
  let accel = 0;
  if (n >= 3) accel = vRecent - vel(hist[n - 3], hist[n - 2]);
  const room = Math.min(1, cur.p / 50);                       // more room to grow at higher rank #
  const emergence = Math.max(0, vRecent) * (0.5 + 0.5 * room) + Math.max(0, accel) * 0.6;
  let phase;
  if (vRecent > 1.5 && cur.p > 12) phase = 'emerging';        // P1
  else if (vRecent > 0.4) phase = 'rising';                   // P6
  else if (cur.p <= 10 && vRecent <= 0.4) phase = 'peaking';  // P7
  else if (vRecent < -0.8) phase = 'cooling';                 // P3
  else phase = 'steady';
  return { phase: phase, velocity: +vRecent.toFixed(2), accel: +accel.toFixed(2), emergence: +emergence.toFixed(2), cur: cur.p, points: n };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300');
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  const force = u.searchParams.get('force') === '1';

  let doc = null;
  try { doc = await db.get('wave:db'); } catch (e) {}
  if (!doc || typeof doc !== 'object') doc = { lastsnap: 0, tracks: {} };

  // Snapshot if stale (or forced) — this is what accrues the time-series.
  let snapshotTaken = false;
  try {
    if (force || (Date.now() - Number(doc.lastsnap || 0)) > SNAP_THROTTLE_MS) {
      const next = await takeSnapshot(doc);
      if (next.lastsnap) { doc = next; await db.set('wave:db', doc); snapshotTaken = true; }
    }
  } catch (e) {}

  try {
    const rows = [];
    const tracks = doc.tracks || {};
    for (const id in tracks) {
      const rec = tracks[id]; if (!rec || !rec.hist || !rec.hist.length) continue;
      rows.push(Object.assign({ id: id }, rec.meta || {}, analyze(rec.hist)));
    }
    const warming = !rows.length || rows.every(r => r.points < 2);
    const rising = rows.filter(r => r.phase === 'emerging' || r.phase === 'rising').sort((a, b) => b.emergence - a.emergence).slice(0, 20);
    const peaking = rows.filter(r => r.phase === 'peaking').sort((a, b) => a.cur - b.cur).slice(0, 12);
    const cooling = rows.filter(r => r.phase === 'cooling').sort((a, b) => a.velocity - b.velocity).slice(0, 10);
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, warming: warming, tracked: rows.length,
      lastSnapshot: doc.lastsnap || null, snapshotTaken: snapshotTaken,
      rising: rising, peaking: peaking, cooling: cooling,
      note: warming
        ? 'Radar is warming up — it just set a baseline. Velocity and emergence appear once a second snapshot lands (a few hours). It sharpens every day.'
        : null
    }));
  } catch (e) {
    res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
