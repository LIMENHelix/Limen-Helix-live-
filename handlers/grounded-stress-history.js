/**
 * grounded-stress-history.js — READ-ONLY view of the grounded-stress baseline series.
 *
 * WHY THIS EXISTS. `grounded_stress_memory` is the rolling per-channel baseline the CISS-style
 * grounded stress ranks against (written by handlers/limen-worker-snapshot.js, hourly append,
 * cap 300, 30d TTL). Until now nothing exposed it: the worker emitted only `baselineDepth` (a
 * single max-length integer) on stressGroundingStats, so the SERIES itself was unreadable from
 * outside the worker. It could not be read locally either — the Upstash credential is a Vercel
 * *sensitive* env var, which is write-only by design and cannot be retrieved through the CLI or
 * the dashboard (verified 2026-07-25: `vercel env pull` returns every user-defined var as an
 * empty string). The server holds the credential at runtime, so the read has to happen here.
 *
 * WHAT IT UNBLOCKS. The deciding measurement on the adaptation-vs-set-point question: each
 * domain's stress autocorrelation time against the baseline window. If autocorrelation >= the
 * window, that domain sits in a masking regime and its CDF rank hides its own chronic state.
 * That number orders the emission-layer work; it cannot be computed without the series.
 *
 * NOT GATED, deliberately. The payload is aggregate stress telemetry: floats per domain per
 * channel. No credentials, no company identifiers, no PII. /api/limen-snapshot is already fully
 * public and carries strictly more (domain summaries, phase beliefs, company joins), so gating
 * this while that stays open would be theatre. Revisit if the payload ever widens.
 *
 * STRICTLY READ-ONLY. GET only; never writes, never mutates the memory. A malformed or missing
 * key returns ok:true with empty domains rather than an error — absence of baseline is a normal
 * state (the worker builds it up over hours), not a fault.
 *
 * Sampling caveat, carried in the response so a consumer cannot miss it: entries are bare
 * numbers with NO per-entry timestamp. Append is gated on `>= 1h since lastAppendTs` AND the
 * worker actually running (15m cron) AND the domain grounding that cycle. So the series is
 * APPROXIMATELY hourly with possible gaps, not a regular time series. Any autocorrelation
 * computed from it is an estimate over irregular samples — treat lags as "samples", not "hours".
 *
 * GET /api/grounded-stress-history            -> distress channel for all domains
 * GET /api/grounded-stress-history?all=1      -> every channel for all domains
 * GET /api/grounded-stress-history?domain=energy
 * GET /api/grounded-stress-history?channel=marketScore
 */
var db = require('../lib/limen-db');

var MEM_KEY = 'grounded_stress_memory';
var HISTORY_CAP = 300;          // mirrors GS_HISTORY_CAP in limen-worker-snapshot.js
var APPEND_MS = 60 * 60 * 1000; // mirrors GS_APPEND_MS

function j(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');   // hourly append; 5m is plenty fresh
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return j(res, 405, { ok: false, error: 'GET only. This endpoint never writes.' });
  }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  var wantAll = q.all === '1' || q.all === 'true';
  var wantDomain = q.domain ? String(q.domain) : null;
  var wantChannel = q.channel ? String(q.channel) : (wantAll ? null : 'distress');

  var mem = null;
  try { mem = await db.get(MEM_KEY); } catch (e) { mem = null; }
  if (!mem || typeof mem !== 'object' || !mem.domains) {
    return j(res, 200, {
      ok: true, present: false, domains: {},
      note: 'No grounded_stress_memory yet. The worker builds it hourly; this is a normal cold state, not a fault.'
    });
  }

  var out = {};
  var maxDepth = 0;
  for (var k in mem.domains) {
    if (!mem.domains.hasOwnProperty(k)) continue;
    if (wantDomain && k !== wantDomain) continue;
    var slot = mem.domains[k] || {};
    var hist = slot.history || {};
    var channels = {};
    for (var ch in hist) {
      if (!hist.hasOwnProperty(ch)) continue;
      if (wantChannel && ch !== wantChannel) continue;
      var series = Array.isArray(hist[ch]) ? hist[ch] : [];
      channels[ch] = series;
      if (series.length > maxDepth) maxDepth = series.length;
    }
    out[k] = {
      channels: channels,
      channelNames: Object.keys(hist),
      lastAppendTs: slot.lastAppendTs || 0
    };
  }

  return j(res, 200, {
    ok: true,
    present: true,
    updatedAt: mem.updatedAt || 0,
    historyCap: HISTORY_CAP,
    appendIntervalMs: APPEND_MS,
    maxDepth: maxDepth,
    domainCount: Object.keys(out).length,
    filter: { domain: wantDomain, channel: wantChannel, all: wantAll },
    sampling: 'APPROXIMATELY hourly, irregular. Entries are bare numbers with no per-entry timestamp; ' +
              'append requires >=1h elapsed AND a worker run AND the domain grounding that cycle. ' +
              'Lags are SAMPLES, not guaranteed hours.',
    domains: out
  });
};
