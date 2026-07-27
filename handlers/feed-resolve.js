/**
 * handlers/feed-resolve.js — the RESOLVER endpoint (hippocampus component 2).
 *
 *   GET  /api/feed-resolve?emit=1   (CRON, hourly)
 *        → derive a forecast SERVER-SIDE from each recorded domain's history and store it
 *          durably. Tab-independent + token-independent, so the forecast ledger accrues on its
 *          own without a browser open. This is the primary forecast source.
 *   GET  /api/feed-resolve?domain=energy
 *        → grade the stored forecasts against the RECORDER (feedhist) via lib/feed-resolver:
 *          forward-only, returns { externalHitRate, resolvedCount, pendingCount }.
 *   POST /api/feed-resolve  {domain, forecast:{...}}
 *        → (optional) store a client-brain forecast directly (token-gated, hourly-idempotent).
 *          Redundant with the cron; whichever lands first that hour wins (dedup).
 *
 * WHY: the plasticity modulator was self-consistency (the brain grading its own stress calls).
 * This provides a GENUINE external outcome — the brain's forecast vs the recorded realized feed
 * value — so the shadow weights can learn from reality, not from an echo. Data-starved until
 * forecasts age past the horizon: externalHitRate stays null and the modulator abstains.
 *
 * SECURITY: POST reuses BRAIN_WEIGHTS_TOKEN (the same operator opt-in that gates weight
 * persistence — durable learning is one switch), fail-closed. GET is open (low-sensitivity
 * calibration state). Guardrail: stores + grades forecasts only; acts on nothing.
 */

var db = require('../lib/limen-db');
var resolver = require('../lib/feed-resolver');

var CAP = 720;                    // ~30 days of hourly forecasts per domain
var HOUR_MS = 60 * 60 * 1000;
var MAX_BYTES = 4 * 1024;
var DOMAIN_RE = /^[a-z][a-zA-Z]{1,23}$/;
var TOKEN = process.env.BRAIN_WEIGHTS_TOKEN || '';   // reuse the durable-learning opt-in; fail-closed when unset

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var d = '';
    req.on('data', function (c) { d += c; if (d.length > MAX_BYTES * 2) { try { req.destroy(); } catch (e) {} resolve({}); } });
    req.on('end', function () { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-brain-token');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();
  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  // ── EMIT MODE (cron): derive a forecast server-side from each domain's recorded history and
  // store it durably. Tab-independent + token-independent (forecasts come from recorded truth,
  // not user input), so the resolver accrues on its own. Idempotent per hour. ──
  if (m === 'GET' && q.emit) {
    try {
      var idx = (await db.get('feedhist:index')) || [];
      var nowE = Date.now(), bucketE = Math.floor(nowE / HOUR_MS);
      var emitted = [], skipped = 0;
      for (var ei = 0; ei < idx.length; ei++) {
        var dom = idx[ei];
        if (!DOMAIN_RE.test(dom)) { skipped++; continue; }
        var fkey = 'forecasthist:' + dom;
        var fhead = await db.lrange(fkey, 0, 0);
        if (fhead && fhead[0] && fhead[0].madeAt && Math.floor(fhead[0].madeAt / HOUR_MS) === bucketE) { skipped++; continue; }  // already this hour
        var rows = (await db.lrange('feedhist:' + dom, 0, 24)) || [];
        var fc = resolver.deriveForecast(rows);
        if (!fc) { skipped++; continue; }        // too little history to call a direction
        await db.lpush(fkey, { madeAt: nowE, direction: fc.direction, currentStress: fc.currentStress, projectedStress: fc.projectedStress, src: 'server-cron' });
        await db.ltrim(fkey, 0, CAP - 1);
        emitted.push(dom);
      }
      return res.end(JSON.stringify({ ok: true, mode: 'emit', emitted: emitted.length, skipped: skipped, domains: emitted, backend: db.getBackend() }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  if (m === 'GET') {
    var domain = String(q.domain || '');
    if (!DOMAIN_RE.test(domain)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad domain' })); }
    try {
      var forecasts = (await db.lrange('forecasthist:' + domain, 0, CAP - 1)) || [];
      var recorder = (await db.lrange('feedhist:' + domain, 0, 2160)) || [];
      var out = resolver.resolve(forecasts, recorder, { now: Date.now() });
      // keep the response small: drop the per-forecast detail unless explicitly asked
      var body = { ok: true, domain: domain, externalHitRate: out.externalHitRate, resolvedCount: out.resolvedCount,
        pendingCount: out.pendingCount, storedForecasts: forecasts.length, recorderRows: recorder.length,
        horizonMs: out.horizonMs, note: out.note, backend: db.getBackend() };
      if (q.detail) body.resolved = out.resolved.slice(0, 50);
      return res.end(JSON.stringify(body));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  if (m === 'POST') {
    var reqBody = await readBody(req);
    if (typeof reqBody === 'string') { try { reqBody = JSON.parse(reqBody); } catch (e) { reqBody = {}; } }
    var tok = req.headers['x-brain-token'] || (reqBody && reqBody.token);
    if (!TOKEN || tok !== TOKEN) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: 'unauthorized' })); }

    var dom = String((reqBody && reqBody.domain) || '');
    var f = reqBody && reqBody.forecast;
    if (!DOMAIN_RE.test(dom)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad domain' })); }
    if (!f || ['rising', 'falling', 'stable'].indexOf(f.direction) === -1 || typeof f.currentStress !== 'number') {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'forecast{direction,currentStress} required' }));
    }
    var key = 'forecasthist:' + dom;
    var now = Date.now(), hourBucket = Math.floor(now / HOUR_MS);
    try {
      // idempotent per hour: at most one forecast per domain per hour (matches recorder cadence)
      var head = await db.lrange(key, 0, 0);
      if (head && head[0] && head[0].madeAt && Math.floor(head[0].madeAt / HOUR_MS) === hourBucket) {
        return res.end(JSON.stringify({ ok: true, domain: dom, stored: false, note: 'idempotent-skip (already stored this hour)' }));
      }
      var row = { madeAt: now, direction: f.direction, currentStress: Math.round(f.currentStress * 10000) / 10000,
        projectedStress: (typeof f.projectedStress === 'number') ? Math.round(f.projectedStress * 10000) / 10000 : null };
      await db.lpush(key, row);
      await db.ltrim(key, 0, CAP - 1);
      return res.end(JSON.stringify({ ok: true, domain: dom, stored: true, backend: db.getBackend() }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};

// Every run records itself. lib/heartbeat is the spike log the /brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('feed-resolve', module.exports);
