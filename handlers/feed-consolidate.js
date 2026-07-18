/**
 * handlers/feed-consolidate.js — the CONSOLIDATOR endpoint (hippocampus component 3).
 *
 *   GET /api/feed-consolidate?run=1
 *        → for every recorded domain: grade its stored forecasts (resolver) against the recorder,
 *          read its persisted weight history, and write a REVIEWABLE calibration/drift PROPOSAL to
 *          consolidation:report:<domain> (latest) + consolidation:hist:<domain> (append). Runnable
 *          on demand or from a (recommended, not-yet-added) low-frequency cron. Idempotent per day.
 *   GET /api/feed-consolidate?domain=energy
 *        → read the latest stored proposal for one domain.
 *
 * PROPOSE-ONLY: this endpoint reads and proposes. It NEVER applies a weight, arms a layer, changes
 * a live forecast, spends, sends, or touches the kill-switch/brakes. Every proposal carries
 * applied:false + requiresHumanReview:true. Applying a proposal is a separate, human-gated step.
 *
 * SECURITY: GET is open (low-sensitivity calibration state, same class as feed-resolve GET). There
 * is no write-to-live path here at all, so nothing to token-gate beyond what it already can't do.
 */

var db = require('../lib/limen-db');
var resolver = require('../lib/feed-resolver');
var consolidator = require('../lib/consolidator');

var FCAP = 720;                     // forecast rows to grade
var RCAP = 2160;                    // recorder rows (~90d hourly)
var WHIST = 60;                     // weight-history snapshots to scan for drift
var HISTCAP = 90;                   // consolidation proposals retained per domain
var DAY_MS = 24 * 60 * 60 * 1000;
var DOMAIN_RE = /^[a-z][a-zA-Z]{1,23}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('content-type', 'application/json');
  var m = (req.method || 'GET').toUpperCase();
  if (m === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (m !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'method not allowed (read-only, propose-only)' })); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  // ── READ one domain's latest proposal ──
  if (!q.run) {
    var domain = String(q.domain || '');
    if (!DOMAIN_RE.test(domain)) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bad domain (or pass ?run=1)' })); }
    try {
      var rep = await db.get('consolidation:report:' + domain);
      return res.end(JSON.stringify({ ok: true, domain: domain, report: rep || null, backend: db.getBackend() }));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }

  // ── RUN: consolidate every recorded domain into a reviewable proposal ──
  try {
    var idx = (await db.get('feedhist:index')) || [];
    var now = Date.now(), dayBucket = Math.floor(now / DAY_MS);
    var built = [], skipped = 0;
    for (var i = 0; i < idx.length; i++) {
      var dom = idx[i];
      if (!DOMAIN_RE.test(dom)) { skipped++; continue; }
      // idempotent per day: skip if a proposal already exists for this day bucket
      var head = await db.lrange('consolidation:hist:' + dom, 0, 0);
      if (head && head[0] && head[0].generatedAt && Math.floor(head[0].generatedAt / DAY_MS) === dayBucket) { skipped++; continue; }

      var forecasts = (await db.lrange('forecasthist:' + dom, 0, FCAP - 1)) || [];
      var recorder = (await db.lrange('feedhist:' + dom, 0, RCAP)) || [];
      var weightHist = (await db.lrange('brainwts:hist:' + dom, 0, WHIST - 1)) || [];

      var resolved = resolver.resolve(forecasts, recorder, { now: now });
      var calib = consolidator.calibration(forecasts, resolved);
      var drift = consolidator.weightDrift(weightHist);
      var proposal = consolidator.buildProposal(dom, calib, drift, { now: now });

      await db.set('consolidation:report:' + dom, proposal);           // latest (read endpoint serves this)
      await db.lpush('consolidation:hist:' + dom, proposal);           // append-only-ish history
      await db.ltrim('consolidation:hist:' + dom, 0, HISTCAP - 1);
      built.push({ domain: dom, status: proposal.status, recs: proposal.recommendations.length, resolved: calib.resolvedCount });
    }
    return res.end(JSON.stringify({ ok: true, mode: 'run', built: built.length, skipped: skipped, proposals: built, appliedAnything: false, backend: db.getBackend() }));
  } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: e.message })); }
};
