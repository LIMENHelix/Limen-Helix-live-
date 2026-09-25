/**
 * handlers/orb-voice.js — xAI Grok TTS for text the orbs are saying right now.
 *
 *   GET  /api/orb-voice?voice=<id>&text=<urlencoded>     (used by the page: CDN-cacheable)
 *   POST /api/orb-voice   {voice, text}                  (used by the firewalled bench)
 *
 * WHY THIS EXISTS AT ALL, given that the twenty solo briefings are pre-rendered.
 * A meeting's words are assembled live from whoever is in the room and what the instruments
 * read at that second, so there is no fixed set of sentences to render ahead of time. The
 * alternative was the browser voice, which throws away the entire point of casting twenty
 * voices by measurement. So meetings synthesise on demand and the cast voices carry through.
 *
 * THE SHAPE OF THE RISK IS NOT THE UNIT PRICE, IT IS THAT THIS IS A PUBLIC ENDPOINT HOLDING
 * A PAID KEY. Three guards, in order of how much they actually protect:
 *
 *   1. The global AI kill switch plus an ATOMIC daily dollar reservation. If the durable
 *      ledger cannot be read or written, this refuses before xAI is called. A worst case
 *      costs the local ceiling, not the account. This is the guard that bounds a determined
 *      caller even across concurrent serverless instances.
 *   2. GET responses are CDN-cacheable by URL and the URL contains the exact text, so the
 *      same sentence in the same voice is synthesised once and served from the edge after
 *      that. This is what makes ordinary traffic nearly free rather than linear.
 *   3. An allowlisted voice and a length cap, so a caller cannot pick an unmetered voice or
 *      post a novel.
 *
 * A refusal is never fatal to the caller: the page falls back to the browser voice, so a
 * capped day degrades the showcase instead of breaking it.
 */

/* The module load is deliberately defensive. Every route in this app is served by one Hono
   catch-all, and a require that throws at load time takes down ALL of /api/*, not just this
   route. That has happened here before. A hardcoded allowlist is the floor. */
var CAST = ['zagan','iris','sal','sirius','luna','perseus','eve','leo','lux','carina',
            'naksh','rigel','helios','atlas','celeste','ursa','ara','kepler','zenith','altair'];
try {
  var ORB = require('../assets/js/orb-briefing.js');
  if (ORB && ORB.VOICE) {
    var live = Object.keys(ORB.VOICE).map(function (k) { return ORB.VOICE[k]; }).filter(Boolean);
    if (live.length) CAST = live;
  }
} catch (e) { /* keep the hardcoded floor; never take the router down over a voice list */ }

var crypto = require('crypto');
var paidProvider = require('../lib/paid-provider-boundary');

var MAX_CHARS = 1400;            // one meeting turn is ~400-700; this is headroom, not a target
var MIN_CHARS = 8;
var USD_PER_MILLION_CHARS = 15;
var DEFAULT_DAILY_CAP_USD = 6;

// Per-instance memo. Serverless instances are short-lived, so this only catches bursts on one
// warm instance — the CDN is what does the real deduplication. Bounded so it cannot grow.
var memo = new Map();
var MEMO_MAX = 40;

function dailyCapUsd() {
  var configured = Number(process.env.LIMEN_ORB_VOICE_DAILY_CAP_USD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_CAP_USD;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(function (resolve) {
    var raw = '';
    req.on('data', function (c) { raw += c; if (raw.length > 20000) raw = raw.slice(0, 20000); });
    req.on('end', function () { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  var method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') { res.status(204).end(); return; }
  if (method !== 'GET' && method !== 'POST') {
    res.status(405).json({ ok: false, error: 'GET or POST only' });
    return;
  }

  var KEY = process.env.XAI_API_KEY;
  if (!KEY) {
    // Fail closed and say so plainly. The caller falls back to the browser voice.
    res.status(503).json({ ok: false, error: 'no TTS key configured' });
    return;
  }

  var voice, text;
  if (method === 'GET') {
    voice = req.query && req.query.voice;
    text = req.query && req.query.text;
  } else {
    var body = await readBody(req);
    voice = body.voice; text = body.text;
  }

  if (typeof voice !== 'string' || CAST.indexOf(voice) === -1) {
    res.status(400).json({ ok: false, error: 'unknown voice' });
    return;
  }
  if (typeof text !== 'string') { res.status(400).json({ ok: false, error: 'text required' }); return; }
  text = text.trim();
  if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
    res.status(400).json({ ok: false, error: 'text must be ' + MIN_CHARS + '-' + MAX_CHARS + ' characters' });
    return;
  }

  var hash = crypto.createHash('sha1').update(voice + ' ' + text).digest('hex').slice(0, 16);

  function sendAudio(buf, cached) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('X-Orb-Voice', voice);
    res.setHeader('X-Orb-Cache', cached ? 'hit' : 'miss');
    /* The URL contains the exact text, so identical text in the same voice is the same URL
       and the edge can serve it without touching this function or the key again. */
    if (method === 'GET')
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    else
      res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buf);
  }

  if (memo.has(hash)) { sendAudio(memo.get(hash), true); return; }

  var estimatedUsd = text.length * USD_PER_MILLION_CHARS / 1000000;
  var budget = await paidProvider.reserve({
    kind: 'external',
    costUsd: estimatedUsd,
    label: 'Orb voice / xAI TTS',
    scope: 'atlas:orb-voice',
    scopeDailyCapUsd: dailyCapUsd(),
    idempotencyKey: 'atlas:orb-voice:' + hash
  });
  if (!budget.ok) {
    res.status(budget.disabled ? 503 : 429).json({ ok: false, error: 'voice budget: ' + budget.reason });
    return;
  }

  var r;
  try {
    r = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      // `language` is REQUIRED and is absent from the public docs summary; omitting it 422s.
      body: JSON.stringify({ voice: voice, language: 'en', text: text, format: 'mp3' })
    });
  } catch (e) {
    await paidProvider.settle(budget, { costUsd: estimatedUsd });
    res.status(502).json({ ok: false, error: 'tts unreachable' });
    return;
  }
  if (!r.ok) {
    await paidProvider.settle(budget, { costUsd: estimatedUsd });
    var detail = '';
    try { detail = (await r.text()).slice(0, 200); } catch (e) {}
    res.status(502).json({ ok: false, error: 'tts ' + r.status, detail: detail });
    return;
  }

  var buf;
  try { buf = Buffer.from(await r.arrayBuffer()); }
  catch (e) {
    await paidProvider.settle(budget, { costUsd: estimatedUsd });
    res.status(502).json({ ok: false, error: 'tts body unreadable' }); return;
  }

  // A short body is a failure that arrived with a 200. Do not cache it and do not play it.
  if (!buf || buf.length < 2000) {
    await paidProvider.settle(budget, { costUsd: estimatedUsd });
    res.status(502).json({ ok: false, error: 'tts returned an empty clip' });
    return;
  }

  var settled = await paidProvider.settle(budget, { costUsd: estimatedUsd });
  if (!settled.ok) {
    res.status(503).json({ ok: false, error: 'voice spend settlement unavailable' });
    return;
  }

  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
  memo.set(hash, buf);
  sendAudio(buf, false);
};
