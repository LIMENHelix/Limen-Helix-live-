/**
 * handlers/youtube-signal.js — thin HTTP wrapper over lib/youtube.js.
 *
 * YouTube is a SHARED, optional signal source. This endpoint lets ANY domain pull its own
 * view-velocity readout with zero new code — just a query string. The core engine, caching,
 * and quota discipline live in lib/youtube.js.
 *
 *   GET /api/youtube-signal                       → default: DMAD music lane (Culture, back-compat)
 *   GET /api/youtube-signal?domain=technology     → a domain's turnkey default query
 *   GET /api/youtube-signal?q=<any query>&ns=<id>  → an arbitrary query, cached under ns
 *   GET /api/youtube-signal?force=1               → force a fresh snapshot (auto for vercel-cron)
 *
 * Key-gated: no YOUTUBE_API_KEY → { on:false } so the caller hides its panel.
 */
const yt = require('../lib/youtube');

// The music lane keeps its original cache doc so the live warming history isn't lost.
const MUSIC = { cacheKey: 'wave:youtube', category: '10', query: process.env.YT_LANE_QUERY || 'rap hip hop new music 2026 official' };
const DMAD_CHANNEL = process.env.DMAD_YT_CHANNEL || '';

// Turnkey per-domain defaults so ?domain=<name> works out of the box. Callers wanting
// precision pass ?q= instead. Music category (10) only where it fits; else broad.
const DOMAIN_QUERIES = {
  culture: MUSIC,
  music: MUSIC,
  technology: { query: 'new technology launch demo 2026', category: '28' },
  science: { query: 'science research breakthrough 2026', category: '28' },
  medicine: { query: 'medical health breakthrough 2026' },
  finance: { query: 'stock market finance analysis 2026' },
  economy: { query: 'economy inflation markets 2026' },
  energy: { query: 'energy grid renewable oil gas 2026' },
  environment: { query: 'climate environment disaster 2026' },
  education: { query: 'education edtech classroom 2026', category: '27' },
  governance: { query: 'policy government legislation 2026', category: '25' },
  defense: { query: 'defense military conflict 2026', category: '25' },
  law: { query: 'law court ruling legal 2026', category: '25' }
};

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');

  if (!yt.configured()) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, on: false, items: [], note: 'YOUTUBE_API_KEY not set' })); }

  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  const ua = String((req.headers && (req.headers['user-agent'] || req.headers['User-Agent'])) || '');
  const force = u.searchParams.get('force') === '1' || /vercel-cron/i.test(ua);
  const domain = (u.searchParams.get('domain') || '').toLowerCase();
  const q = u.searchParams.get('q');
  const ns = u.searchParams.get('ns');

  // Resolve which query/cache to use: explicit q > known domain > default music lane.
  let cfg;
  if (q) cfg = { query: q.slice(0, 120), cacheKey: 'yt:sig:' + (ns ? ns.slice(0, 40) : q.slice(0, 40)) };
  else if (domain && DOMAIN_QUERIES[domain]) cfg = DOMAIN_QUERIES[domain];
  else cfg = MUSIC;

  const out = await yt.signal(Object.assign({ force: force }, cfg));

  // Culture-only extra: DMAD's own channel traction, when configured (music lane only).
  if (cfg === MUSIC && DMAD_CHANNEL) {
    try {
      if (force || out.snapshotTaken || u.searchParams.get('channel')) {
        const ch = await yt.channel(DMAD_CHANNEL, 6);
        if (ch) { ch.videos = (ch.videos || []).slice(0, 6); out.channel = ch; }
      }
    } catch (e) {}
  }

  res.statusCode = 200;
  return res.end(JSON.stringify(out));
};
