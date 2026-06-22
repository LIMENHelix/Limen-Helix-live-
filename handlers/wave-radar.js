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
// Last.fm = the LEADING signal (geo velocity + your-lane). Key is operator-provided (Sensitive
// Vercel env); tolerate the common names so a rename doesn't silently disable it.
const LFM_KEY = process.env.LASTFM_API_KEY || process.env.LASTFM_KEY || process.env.LAST_FM_API_KEY || process.env.LASTFM || '';
const LFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const LFM_SOURCES = [
  { key: 'rap',     label: 'Rap',     method: 'tag.gettoptracks',   q: 'tag=rap',                 lane: 'you' },
  { key: 'hiphop2', label: 'Hip-Hop', method: 'tag.gettoptracks',   q: 'tag=hip-hop',             lane: 'you' },
  { key: 'us',      label: 'US',      method: 'geo.gettoptracks',   q: 'country=United%20States', lane: 'geo' },
  { key: 'global',  label: 'Global',  method: 'chart.gettoptracks', q: '',                        lane: 'geo' }
];
const NF_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;   // refresh the "sounds like NF" neighborhood weekly
const DMAD_ARTIST = '13573429';                  // DMAD on Deezer (fresh previews fetched per view)
const DMAD_PREF = { '1583652152': 0, '1583652022': 1 };  // World Is Spinning, Nothing Less first

// Eras Radar — "what's coming back". We read the Last.fm tags of what's charting now,
// bucket them into eras/sounds, and track each bucket's SHARE of new hits over time.
// A comeback = an old sound whose share among rising music is accelerating (emergence,
// same engine — just pointed at sounds instead of tracks). `adj` = adjacent to DMAD's
// rap lane → candidates for "closest uncrowded wave".
const ERA_BUCKETS = [
  { key: '80s',    label: '80s · Synthwave', adj: false, tags: ['80s', 'synthwave', 'synth-pop', 'synthpop', 'new wave'] },
  { key: '90s',    label: '90s', adj: true,  tags: ['90s', 'g-funk', 'new jack swing'] },
  { key: '2000s',  label: '2000s', adj: true, tags: ['2000s', '00s', 'crunk', 'snap'] },
  { key: 'disco',  label: 'Disco · Funk', adj: false, tags: ['disco', 'funk', 'nu-disco', 'nu disco'] },
  { key: 'boombap',label: 'Boom-bap', adj: true, tags: ['boom bap', 'boom-bap', 'old school hip hop', 'old-school'] },
  { key: 'drill',  label: 'Drill', adj: true, tags: ['drill', 'uk drill'] },
  { key: 'phonk',  label: 'Phonk', adj: true, tags: ['phonk'] },
  { key: 'trap',   label: 'Trap', adj: true, tags: ['trap'] },
  { key: 'emo',    label: 'Emo-rap', adj: true, tags: ['emo rap', 'emo-rap', 'emo', 'pop punk', 'pop-punk'] },
  { key: 'afro',   label: 'Afrobeats · Amapiano', adj: false, tags: ['afrobeats', 'afrobeat', 'amapiano'] },
  { key: 'rnb',    label: 'R&B · Neo-soul', adj: true, tags: ['contemporary r&b', 'neo-soul', 'neo soul', 'alternative r&b'] },
  { key: 'house',  label: 'House · Dance', adj: false, tags: ['house', 'edm', 'tech house', 'deep house'] }
];
const ERA_SAMPLE = 24;   // how many charting tracks to tag-sample per snapshot (bounded cost)

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

function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64); }

// Last.fm tags for one track → lowercased list (for the Eras Radar bucketing).
async function fetchTrackTags(artist, title) {
  if (!LFM_KEY || !artist || !title) return [];
  const j = await fetchJSON(LFM_BASE + '?method=track.gettoptags&artist=' + encodeURIComponent(artist) + '&track=' + encodeURIComponent(title) + '&autocorrect=1&api_key=' + LFM_KEY + '&format=json');
  const list = (j && j.toptags && Array.isArray(j.toptags.tag)) ? j.toptags.tag : [];
  return list.map(t => String(t.name || '').toLowerCase().trim()).filter(Boolean).slice(0, 12);
}

// A bucket's share-of-charting series → velocity + phase (emergence on SHARE, not rank).
function analyzeShare(hist) {
  const pts = (hist || []).filter(h => h.n > 0).map(h => ({ t: h.t, s: h.c / h.n }));
  const n = pts.length, cur = pts[n - 1];
  const share = cur ? cur.s : 0;
  if (n < 2) return { share: share, phase: 'baseline', velocity: 0, points: n };
  const vel = (a, b) => { const dt = Math.max((b.t - a.t) / DAY, 0.04); return (b.s - a.s) / dt; };
  const vRecent = vel(pts[n - 2], pts[n - 1]);
  let phase;
  if (vRecent > 0.03) phase = 'emerging';
  else if (vRecent > 0.008) phase = 'rising';
  else if (vRecent < -0.02) phase = 'cooling';
  else phase = 'steady';
  return { share: share, phase: phase, velocity: +vRecent.toFixed(3), points: n };
}

// One Last.fm chart → normalized rows (rank = list order). No previews/BPM (Deezer owns audio).
async function fetchLfmTracks(src) {
  if (!LFM_KEY) return [];
  const url = LFM_BASE + '?method=' + src.method + (src.q ? '&' + src.q : '') + '&api_key=' + LFM_KEY + '&format=json&limit=50';
  const j = await fetchJSON(url);
  const list = (j && j.tracks && Array.isArray(j.tracks.track)) ? j.tracks.track : [];
  return list.map(t => ({
    name: t.name || '', artist: (t.artist && t.artist.name) || '', url: t.url || '',
    listeners: Number(t.listeners || 0) || 0,
    image: (t.image && t.image.length ? (t.image[t.image.length - 1]['#text'] || '') : '')
  })).filter(r => r.name && r.artist);
}

// DMAD's sonic neighborhood — seeded from who he actually rates (NF + the artists he
// loves), merged via Last.fm similarity, cached weekly. The seeds are his taste, the
// neighbors are who to study / chase / pitch.
const NF_SEEDS = ['NF', 'Mac Miller', 'Lecrae', 'Kid Cudi'];

// Last.fm bios are wiki HTML with a trailing "Read more" link — strip to a clean,
// short "their story" blurb (often opens with where they're from / how they came up).
function cleanBio(s) {
  s = String(s || '')
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-fA-F]+);?/g, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return ' '; } })
    .replace(/&#(\d+);?/g, (m, d) => { try { return String.fromCodePoint(+d); } catch (e) { return ' '; } })
    .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
  if (/^(User-contributed text|This article uses material)/i.test(s)) return '';
  if (s.length > 320) s = s.slice(0, 320).replace(/\s+\S*$/, '') + '…';
  return s;
}

async function refreshNeighborhood(doc) {
  if (!LFM_KEY) return doc;
  const nf = doc.nf;
  // refresh weekly OR once to upgrade an older cache that predates the bio field
  if (nf && nf.t && (Date.now() - nf.t) < NF_REFRESH_MS && nf.artists && nf.artists.length && nf.artists[0].bio !== undefined) return doc;
  const merged = {};
  for (const seed of NF_SEEDS) {
    const j = await fetchJSON(LFM_BASE + '?method=artist.getsimilar&artist=' + encodeURIComponent(seed) + '&autocorrect=1&api_key=' + LFM_KEY + '&format=json&limit=30');
    const list = (j && j.similarartists && Array.isArray(j.similarartists.artist)) ? j.similarartists.artist : [];
    list.forEach(a => { const n = (a.name || '').trim(); if (!n) return; const m = +a.match || 0; if (!(n in merged) || m > merged[n]) merged[n] = m; });
  }
  NF_SEEDS.forEach(s => { delete merged[s]; });  // don't recommend his own seeds back to him
  const names = Object.keys(merged).sort((a, b) => merged[b] - merged[a]).slice(0, 16);
  // each neighbor's story + stats (bounded, weekly — bios don't expire so we cache them)
  const infos = await Promise.all(names.map(n => fetchJSON(LFM_BASE + '?method=artist.getinfo&artist=' + encodeURIComponent(n) + '&autocorrect=1&api_key=' + LFM_KEY + '&format=json')));
  const artists = names.map((n, i) => {
    const a = infos[i] && infos[i].artist;
    return {
      name: n, match: merged[n],
      bio: a ? cleanBio((a.bio && a.bio.summary) || '') : '',
      listeners: (a && a.stats && +a.stats.listeners) || 0,
      tags: (a && a.tags && Array.isArray(a.tags.tag)) ? a.tags.tag.map(t => t.name).filter(Boolean).slice(0, 2) : [],
      url: (a && a.url) || ''
    };
  });
  if (artists.length) doc.nf = { t: Date.now(), artists: artists, loves: NF_SEEDS };
  return doc;
}

// Lazy lookup: a fresh, hearable Deezer track for one artist (neighbor ▶ on demand —
// avoids per-view fan-out and the preview-URL expiry of caching them).
async function lookupArtist(name) {
  const j = await fetchJSON('https://api.deezer.com/search?q=' + encodeURIComponent('artist:"' + name + '"') + '&limit=1');
  const d = (j && Array.isArray(j.data)) ? j.data : [];
  if (!d.length) return null;
  const t = d[0];
  return { title: t.title || '', preview: t.preview || '', link: t.link || '',
    cover: (t.album && (t.album.cover_small || t.album.cover)) || '',
    artist: (t.artist && t.artist.name) || name, artistLink: (t.artist && t.artist.link) || '' };
}

// DMAD's tracks (Deezer, fetched live — preview URLs carry a short-lived exp= token).
// /top misses some singles, so explicitly pull the operator-named tracks too and merge.
const DMAD_PINNED = ['1583652152', '1583652022'];  // World Is Spinning, Nothing Less
function dzTrack(t) {
  return { id: 'dz:' + t.id, title: t.title || '', artist: (t.artist && t.artist.name) || 'DMAD',
    preview: t.preview || '', link: t.link || '', cover: (t.album && (t.album.cover_small || t.album.cover)) || '', genre: 'rap', bpm: 0 };
}
async function fetchFeatured() {
  const [top, ...pinned] = await Promise.all([
    fetchJSON('https://api.deezer.com/artist/' + DMAD_ARTIST + '/top?limit=8'),
    ...DMAD_PINNED.map(id => fetchJSON('https://api.deezer.com/track/' + id))
  ]);
  const byId = {};
  pinned.forEach(t => { if (t && t.id) byId['dz:' + t.id] = dzTrack(t); });
  ((top && Array.isArray(top.data)) ? top.data : []).forEach(t => { const r = dzTrack(t); if (!byId[r.id]) byId[r.id] = r; });
  return Object.values(byId).sort((a, b) => {
    const ai = DMAD_PREF[a.id.slice(3)] != null ? DMAD_PREF[a.id.slice(3)] : 9;
    const bi = DMAD_PREF[b.id.slice(3)] != null ? DMAD_PREF[b.id.slice(3)] : 9;
    return ai - bi;
  });
}

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
  // Last.fm sources (rap / hip-hop / US / global) flow through the SAME engine. Distinct id
  // space (lfm:<src>:<slug>) so a song can chart in several lanes without colliding with Deezer.
  if (LFM_KEY) {
    for (const s of LFM_SOURCES) {
      const rows = await fetchLfmTracks(s);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], id = 'lfm:' + s.key + ':' + slug(r.artist + '-' + r.name), pos = i + 1;
        if (!best[id] || pos < best[id].pos) {
          best[id] = { pos: pos, g: s.key, glabel: s.label, title: r.name, artist: r.artist,
            cover: r.image || '', link: r.url || '', preview: '', bpm: 0, src: 'lfm', lane: s.lane, listeners: r.listeners || 0 };
        }
      }
    }
  }

  if (!Object.keys(best).length) return doc;
  const tracks = doc.tracks || {};
  for (const id in best) {
    const b = best[id], rec = tracks[id] || { meta: {}, hist: [] }, prev = rec.meta || {};
    rec.meta = {
      title: b.title, artist: b.artist, cover: b.cover, link: b.link, genre: b.g, glabel: b.glabel,
      preview: b.preview || prev.preview || '', bpm: prev.bpm || b.bpm || 0, bpmTried: prev.bpmTried || b.bpm > 0,
      src: b.src || 'deezer', lane: b.lane || '', listeners: b.listeners || prev.listeners || 0
    };
    rec.hist.push({ t: ts, p: b.pos, g: b.g });
    if (rec.hist.length > HIST_CAP) rec.hist = rec.hist.slice(rec.hist.length - HIST_CAP);
    tracks[id] = rec;
  }
  for (const id in tracks) { const h = tracks[id].hist; if (!h || !h.length || (ts - h[h.length - 1].t) > PRUNE_MS) delete tracks[id]; }

  // Eras Radar: tag-sample the top charting tracks, bucket into eras/sounds, append this
  // snapshot's counts so each bucket's share-of-charting accrues a time-series.
  let eras = doc.eras || { b: {} };
  if (LFM_KEY) {
    const sample = Object.keys(best).map(id => best[id]).sort((a, b) => a.pos - b.pos).slice(0, ERA_SAMPLE);
    const tagLists = await Promise.all(sample.map(s => fetchTrackTags(s.artist, s.title)));
    const counts = {}; ERA_BUCKETS.forEach(b => { counts[b.key] = 0; });
    let nTagged = 0;
    tagLists.forEach(tags => {
      if (!tags.length) return; nTagged++;
      ERA_BUCKETS.forEach(b => { if (b.tags.some(bt => tags.some(t => t === bt || t.indexOf(bt) >= 0))) counts[b.key]++; });
    });
    if (nTagged >= 4) {
      const b = eras.b || {};
      ERA_BUCKETS.forEach(bk => {
        const arr = b[bk.key] || [];
        arr.push({ t: ts, c: counts[bk.key], n: nTagged });
        if (arr.length > HIST_CAP) arr.splice(0, arr.length - HIST_CAP);
        b[bk.key] = arr;
      });
      eras = { lastsnap: ts, n: nTagged, b: b };
    }
  }

  return Object.assign({}, doc, { lastsnap: ts, tracks: tracks, eras: eras });
}

function readBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
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
  // The warm-up cron (vercel.json) hits this on a cadence so velocity accrues without
  // depending on page traffic. Vercel cron requests carry user-agent vercel-cron/1.0 →
  // treat them as a forced snapshot (bypass the 3h throttle). Public views never force.
  const ua = String((req.headers && (req.headers['user-agent'] || req.headers['User-Agent'])) || '');
  const isCron = /vercel-cron/i.test(ua);
  const force = u.searchParams.get('force') === '1' || isCron;

  let doc = null; try { doc = await db.get('wave:db'); } catch (e) {}
  if (!doc || typeof doc !== 'object') doc = { lastsnap: 0, tracks: {} };

  // POST: cache client-detected BPMs (from preview-audio analysis) so tempo patterns
  // accrue over time and every visitor benefits.
  if ((req.method || 'GET').toUpperCase() === 'POST') {
    const body = await readBody(req);
    const list = (body && Array.isArray(body.bpms)) ? body.bpms : [];
    let updated = 0;
    for (const it of list) {
      const id = String((it && it.id) || ''); const bpm = Math.round(Number(it && it.bpm) || 0);
      if (id && bpm >= 60 && bpm <= 200 && doc.tracks[id]) { doc.tracks[id].meta.bpm = bpm; doc.tracks[id].meta.bpmTried = true; updated++; }
    }
    if (updated) { try { await db.set('wave:db', doc); } catch (e) {} }
    res.statusCode = 200; res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ ok: true, updated: updated }));
  }

  // Neighbor ▶: fresh hearable track for one artist (called on click, not per view).
  const artistQ = u.searchParams.get('artist');
  if (artistQ) {
    let track = null; try { track = await lookupArtist(artistQ.slice(0, 80)); } catch (e) {}
    res.statusCode = 200; res.setHeader('Cache-Control', 's-maxage=86400');
    return res.end(JSON.stringify({ ok: !!track, track: track }));
  }

  let snapshotTaken = false;
  try {
    if (force || (Date.now() - Number(doc.lastsnap || 0)) > SNAP_THROTTLE_MS) {
      const next = await takeSnapshot(doc);
      if (next.lastsnap) { doc = next; snapshotTaken = true; }
      try { doc = await refreshNeighborhood(doc); } catch (e) {}
    }
  } catch (e) {}

  // DMAD's catalog, fetched live (previews expire); cheap external call, no Redis cost.
  let featured = []; try { featured = await fetchFeatured(); } catch (e) {}

  try {
    const tracks = doc.tracks || {};
    let rows = Object.keys(tracks).filter(id => tracks[id].hist && tracks[id].hist.length)
      .map(id => Object.assign({ id: id }, tracks[id].meta || {}, analyze(tracks[id].hist)));

    // enrich the tracks we'll actually SHOW (cost-bounded), then persist + recompute
    if (snapshotTaken) { try { await db.set('wave:db', doc); } catch (e) {} }

    const slim = r => ({ id: r.id, title: r.title, artist: r.artist, glabel: r.glabel, genre: r.genre, cur: r.cur, bpm: r.bpm || 0, preview: r.preview || '', link: r.link || '', phase: r.phase, velocity: r.velocity, emergence: r.emergence, points: r.points });

    // Main radar = Deezer chart-rank waves. Last.fm = a separate leading lens (geo + your lane).
    const dz = rows.filter(r => r.src !== 'lfm');
    const lfm = rows.filter(r => r.src === 'lfm');
    const nbset = new Set(((doc.nf && doc.nf.artists) || []).map(a => String(a.name || '').toLowerCase()));
    const slimL = r => ({ id: r.id, title: r.title, artist: r.artist, glabel: r.glabel, cur: r.cur, listeners: r.listeners || 0, link: r.link || '', phase: r.phase, velocity: r.velocity, emergence: r.emergence, points: r.points, mine: nbset.has(String(r.artist || '').toLowerCase()) });
    const laneFor = (which) => {
      const pool = lfm.filter(r => r.lane === which);
      const rising = pool.filter(r => r.phase === 'emerging' || r.phase === 'rising').sort((a, b) => b.emergence - a.emergence).slice(0, 14);
      // While warming (no velocity yet) fall back to current top of the lane so it's never empty.
      const items = rising.length ? rising : pool.slice().sort((a, b) => a.cur - b.cur).slice(0, 14);
      return { items: items.map(slimL), rising: rising.length > 0 };
    };

    const warming = !dz.length || dz.every(r => r.points < 2);
    const rising = dz.filter(r => r.phase === 'emerging' || r.phase === 'rising').sort((a, b) => b.emergence - a.emergence).slice(0, 20).map(slim);
    const peaking = dz.filter(r => r.phase === 'peaking').sort((a, b) => a.cur - b.cur).slice(0, 12).map(slim);
    const cooling = dz.filter(r => r.phase === 'cooling').sort((a, b) => a.velocity - b.velocity).slice(0, 10).map(slim);
    const currentTop = dz.slice().sort((a, b) => a.cur - b.cur).slice(0, 24).map(slim);
    const patterns = tempoPatterns(rows);

    // Eras Radar — share + trend per era/sound bucket; plus the "closest uncrowded wave"
    // (rap-adjacent bucket that's emerging/rising but not yet crowded).
    const erasDoc = doc.eras || { b: {} };
    let eras = ERA_BUCKETS.map(bk => {
      const a = analyzeShare(erasDoc.b && erasDoc.b[bk.key]);
      return { key: bk.key, label: bk.label, adj: bk.adj, share: Math.round(a.share * 100), phase: a.phase, velocity: a.velocity, points: a.points };
    }).filter(e => e.points > 0).sort((x, y) => y.share - x.share);
    const erasWarming = !eras.length || eras.every(e => e.points < 2);
    let openLane = null;
    const adjPool = eras.filter(e => e.adj);
    const climbing = adjPool.filter(e => e.phase === 'emerging' || e.phase === 'rising').sort((a, b) => b.velocity - a.velocity);
    if (climbing.length) openLane = Object.assign({}, climbing[0], { warming: false });
    else if (adjPool.length) openLane = Object.assign({}, adjPool.slice().sort((a, b) => a.share - b.share)[0], { warming: true });

    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true, warming: warming, tracked: dz.length, withBpm: dz.filter(r => r.bpm > 0).length,
      lastSnapshot: doc.lastsnap || null, snapshotTaken: snapshotTaken,
      patterns: patterns, currentTop: currentTop, rising: rising, peaking: peaking, cooling: cooling,
      lfmOn: !!LFM_KEY, featured: featured,
      neighborhood: ((doc.nf && doc.nf.artists) || []).slice(0, 16),
      loves: (doc.nf && doc.nf.loves) || NF_SEEDS,
      lane: { you: laneFor('you'), geo: laneFor('geo') },
      eras: eras, erasWarming: erasWarming, erasSample: erasDoc.n || 0, openLane: openLane,
      note: warming ? 'Radar is warming up — it set a baseline. Velocity/emergence appear once a second snapshot lands (a few hours). Tempo patterns below are live now.' : null
    }));
  } catch (e) {
    res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};
