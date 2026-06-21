/**
 * api/wave-radar.js — LIMEN Wave Radar (music emergence + hit-anatomy engine).
 *
 * Emergence = ACCELERATION, not size. We sample live music charts over time, store a
 * per-track time-series, and compute velocity (rank change/day) + acceleration to surface
 * what's CLIMBING FAST off a low base (P1 emerging) vs already PEAKING (P7).
 *
 * Hit anatomy: we enrich charting tracks with real BPM + a 30s preview (Deezer, keyless),
 * and aggregate the TEMPO PATTERNS hits are using right now (by genre). Key/energy need a
 * free key (GetSongBPM) — Spotify killed audio-features for new apps in late 2024 — added next.
 *
 * Storage: ONE Redis doc `wave:db` = { lastsnap, tracks:{ id:{meta, hist:[{t,p,g}]} } } so a
 * page view is ~1 read (cost-safe). BPM is cached per track (static) so we fetch each at most once.
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
const SNAP_THROTTLE_MS = 3 * 60 * 60 * 1000;
const HIST_CAP = 48;
const PRUNE_MS = 16 * 24 * 60 * 60 * 1000;
const ENRICH_PER_CALL = 16;   // max Deezer /track lookups per request (bounds cost/latency)
const DAY = 86400000;
const BANDS = [
  { label: '<90', min: 0, max: 90 }, { label: '90–110', min: 90, max: 110 },
  { label: '110–130', min: 110, max: 130 }, { label: '130–150', min: 130, max: 150 },
  { label: '150–170', min: 150, max: 170 }, { label: '170+', min: 170, max: 9999 }
];

async function fetchJSON(url) {
  try { const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}
async function fetchChart(genre) { const j = await fetchJSON('https://api.deezer.com/chart/' + genre + '/tracks?limit=50'); return (j && Array.isArray(j.data)) ? j.data : []; }

async function takeSnapshot(doc) {
  const ts = Date.now();
  const best = {};
  for (const src of SOURCES) {
    const tracks = await fetchChart(src.genre);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i]; if (!t || !t.id) continue;
      const id = String(t.id), pos = i + 1;
      if (!best[id] || pos < best[id].pos) {
        best[id] = {
          pos: pos, g: src.key, glabel: src.label, title: t.title || '',
          artist: (t.artist && t.artist.name) || '', cover: (t.album && (t.album.cover_small || t.album.cover)) || '',
          link: t.link || '', preview: t.preview || '', bpm: (t.bpm && t.bpm > 0) ? Math.round(t.bpm) : 0
        };
      }
    }
  }
  if (!Object.keys(best).length) return doc;
  const tracks = doc.tracks || {};
  for (const id in best) {
    const b = best[id], rec = tracks[id] || { meta: {}, hist: [] }, prev = rec.meta || {};
    rec.meta = {
      title: b.title, artist: b.artist, cover: b.cover, link: b.link, genre: b.g, glabel: b.glabel,
      preview: b.preview || prev.preview || '', bpm: prev.bpm || b.bpm || 0, bpmTried: prev.bpmTried || b.bpm > 0
    };
    rec.hist.push({ t: ts, p: b.pos, g: b.g });
    if (rec.hist.length > HIST_CAP) rec.hist = rec.hist.slice(rec.hist.length - HIST_CAP);
    tracks[id] = rec;
  }
  for (const id in tracks) { const h = tracks[id].hist; if (!h || !h.length || (ts - h[h.length - 1].t) > PRUNE_MS) delete tracks[id]; }
  return { lastsnap: ts, tracks: tracks };
}

// Fill BPM/preview for up to ENRICH_PER_CALL displayed tracks that haven't been looked up yet.
async function enrich(doc, ids) {
  const todo = ids.filter(id => doc.tracks[id] && !doc.tracks[id].meta.bpmTried).slice(0, ENRICH_PER_CALL);
  if (!todo.length) return false;
  const results = await Promise.all(todo.map(id => fetchJSON('https://api.deezer.com/track/' + id)));
  for (let i = 0; i < todo.length; i++) {
    const m = doc.tracks[todo[i]].meta, j = results[i];
    m.bpmTried = true;
    if (j) { if (j.bpm && j.bpm > 0) m.bpm = Math.round(j.bpm); if (!m.preview && j.preview) m.preview = j.preview; }
  }
  return true;
}

function analyze(hist) {
  const n = hist.length, cur = hist[n - 1];
  if (n < 2) return { phase: 'baseline', velocity: 0, accel: 0, emergence: 0, cur: cur.p, points: n };
  const vel = (a, b) => { const dt = Math.max((b.t - a.t) / DAY, 0.04); return (a.p - b.p) / dt; };
  const vRecent = vel(hist[n - 2], hist[n - 1]);
  let accel = 0; if (n >= 3) accel = vRecent - vel(hist[n - 3], hist[n - 2]);
  const room = Math.min(1, cur.p / 50);
  const emergence = Math.max(0, vRecent) * (0.5 + 0.5 * room) + Math.max(0, accel) * 0.6;
  let phase;
  if (vRecent > 1.5 && cur.p > 12) phase = 'emerging';
  else if (vRecent > 0.4) phase = 'rising';
  else if (cur.p <= 10 && vRecent <= 0.4) phase = 'peaking';
  else if (vRecent < -0.8) phase = 'cooling';
  else phase = 'steady';
  return { phase: phase, velocity: +vRecent.toFixed(2), accel: +accel.toFixed(2), emergence: +emergence.toFixed(2), cur: cur.p, points: n };
}

function tempoPatterns(rows) {
  const byGenre = {};
  function bucket(g) { return byGenre[g] || (byGenre[g] = { genre: g, n: 0, bpms: [], bands: BANDS.map(b => ({ label: b.label, n: 0 })) }); }
  rows.forEach(r => {
    if (!r.bpm || r.bpm <= 0) return;
    const targets = r.genre && r.genre !== 'all' ? [bucket('all'), bucket(r.genre)] : [bucket('all')];
    targets.forEach(bk => {
      bk.n++; bk.bpms.push(r.bpm);
      const bi = BANDS.findIndex(b => r.bpm >= b.min && r.bpm < b.max); if (bi >= 0) bk.bands[bi].n++;
    });
  });
  return Object.keys(byGenre).map(g => {
    const bk = byGenre[g]; const sorted = bk.bpms.slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    let dom = bk.bands[0]; bk.bands.forEach(b => { if (b.n > dom.n) dom = b; });
    return { genre: g, glabel: (rowsGlabel[g] || g), n: bk.n, median: median, dominantBand: dom.label, bands: bk.bands };
  }).filter(p => p.n >= 3).sort((a, b) => (a.genre === 'all' ? -1 : b.genre === 'all' ? 1 : b.n - a.n));
}
const rowsGlabel = { all: 'Overall', hiphop: 'Hip-Hop / Rap', pop: 'Pop', dance: 'Dance / Electronic', rnb: 'R&B', rock: 'Rock' };

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=180');
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  const force = u.searchParams.get('force') === '1';

  let doc = null; try { doc = await db.get('wave:db'); } catch (e) {}
  if (!doc || typeof doc !== 'object') doc = { lastsnap: 0, tracks: {} };

  let snapshotTaken = false;
  try {
    if (force || (Date.now() - Number(doc.lastsnap || 0)) > SNAP_THROTTLE_MS) {
      const next = await takeSnapshot(doc);
      if (next.lastsnap) { doc = next; snapshotTaken = true; }
    }
  } catch (e) {}

  try {
    const tracks = doc.tracks || {};
    let rows = Object.keys(tracks).filter(id => tracks[id].hist && tracks[id].hist.length)
      .map(id => Object.assign({ id: id }, tracks[id].meta || {}, analyze(tracks[id].hist)));

    // enrich the tracks we'll actually SHOW (cost-bounded), then persist + recompute
    const displayIds = rows.slice().sort((a, b) => a.cur - b.cur).slice(0, 40).map(r => r.id);
    let changed = snapshotTaken;
    if (await enrich(doc, displayIds)) changed = true;
    if (changed) { try { await db.set('wave:db', doc); } catch (e) {} }
    if (changed) rows = Object.keys(tracks).filter(id => tracks[id].hist && tracks[id].hist.length)
      .map(id => Object.assign({ id: id }, tracks[id].meta || {}, analyze(tracks[id].hist)));

    const slim = r => ({ id: r.id, title: r.title, artist: r.artist, glabel: r.glabel, genre: r.genre, cur: r.cur, bpm: r.bpm || 0, preview: r.preview || '', link: r.link || '', phase: r.phase, velocity: r.velocity, emergence: r.emergence, points: r.points });
    const warming = !rows.length || rows.every(r => r.points < 2);
    const rising = rows.filter(r => r.phase === 'emerging' || r.phase === 'rising').sort((a, b) => b.emergence - a.emergence).slice(0, 20).map(slim);
    const peaking = rows.filter(r => r.phase === 'peaking').sort((a, b) => a.cur - b.cur).slice(0, 12).map(slim);
    const cooling = rows.filter(r => r.phase === 'cooling').sort((a, b) => a.velocity - b.velocity).slice(0, 10).map(slim);
    const currentTop = rows.slice().sort((a, b) => a.cur - b.cur).slice(0, 24).map(slim);
    const patterns = tempoPatterns(rows);

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, warming: warming, tracked: rows.length, withBpm: rows.filter(r => r.bpm > 0).length,
      lastSnapshot: doc.lastsnap || null, snapshotTaken: snapshotTaken,
      patterns: patterns, currentTop: currentTop, rising: rising, peaking: peaking, cooling: cooling,
      note: warming ? 'Radar is warming up — it set a baseline. Velocity/emergence appear once a second snapshot lands (a few hours). Tempo patterns below are live now.' : null
    }));
  } catch (e) {
    res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
