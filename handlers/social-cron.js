/**
 * api/social-cron.js — generate a post from live data and publish it.
 *
 *   GET /api/social-cron?key=...            → PREVIEW. Builds the post, publishes nothing.
 *   GET /api/social-cron?key=...&post=1     → actually publishes.
 *   GET /api/social-cron?key=...&domain=law → force a specific domain (preview or post).
 *
 * DEFAULTS TO PREVIEW FOR HUMANS. A hit with an admin key publishes nothing unless post=1, so
 * a stray click or a browser prefetch cannot put something on a public timeline.
 *
 * A SCHEDULED run publishes without it. Requiring post=1 from the scheduler is fragile, because
 * Vercel can strip the query string off a cron path, and a schedule that quietly previews
 * forever looks exactly like one that never fired.
 *
 * Every other guard lives in lib/social-post.js and applies here unchanged: the operator's
 * posting pause first, then the daily rate cap, then the post; failures release the rate slot;
 * every published post records its AT URI so it can be deleted.
 *
 * Rotation is persisted so the same domain does not repeat back to back across invocations.
 */
var T = require('../lib/tool-fetch');
var db = require('../lib/limen-db');
var gen = require('../lib/social-generator');
var social = require('../lib/social-post');
var motorStore = require('../lib/autofire-efference-store');
var socialExecutor = require('../lib/communication-social-executor');

var LAST_KEY = 'social:lastDomain:v1';

// Any operator-level admin key opens this. They already gate lead PII, which is more
// sensitive than a post preview, and accepting them means the admin console can use the key
// it has already prompted for instead of asking for a second one.
function cronHit(req) {
  var h = req.headers || {};
  // Matches the pattern already proven by handlers/autopilot.js. CRON_SECRET is spoof-proof
  // and wins when set; otherwise Vercel identifies itself with a header. It sends
  // x-vercel-signature, NOT x-vercel-cron, on this project, and checking only the latter is
  // why every scheduled run returned 401 while the endpoint looked perfectly healthy.
  if (process.env.CRON_SECRET) return h['authorization'] === 'Bearer ' + process.env.CRON_SECRET;
  return !!(h['x-vercel-cron'] || h['x-vercel-signature']);
}

var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

function authorized(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; })
                           .filter(Boolean);
  if (!configured.length) return false;          // no key configured anywhere = closed, not open
  if (supplied && configured.indexOf(supplied) !== -1) return true;
  return cronHit(req);
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    if (!authorized(req)) {
      return T.send(res, { ok: false, error: 'Not authorized. Pass ?key= (SOCIAL_CRON_KEY) or call from the Vercel scheduler.' }, 401);
    }

    // Review board: every domain at once. Read-only, and cannot publish by any argument.
    if (q.all === '1') {
      var rateAll = await social.rateStatus('bluesky');
      var lastAll = null;
      try { lastAll = await db.get(LAST_KEY); } catch (e) { lastAll = null; }
      var posts = await gen.previewAll();
      return T.send(res, {
        ok: true, published: false, mode: 'preview-all',
        generatedAt: new Date().toISOString(),
        lastPosted: lastAll || null,
        ready: posts.filter(function (p) { return p.ok; }).length,
        total: posts.length,
        posts: posts,
        rate: rateAll.ok ? { usedToday: rateAll.used, capPerDay: rateAll.cap, remaining: rateAll.remaining } : null
      });
    }

    var last = null;
    try { last = await db.get(LAST_KEY); } catch (e) { last = null; }

    var post = await gen.generate({ after: last && last.domain, domain: q.domain });
    if (post.ok === false) {
      return T.send(res, { ok: false, published: false, reason: post.reason, tried: post.tried, skipped: post.skipped });
    }

    var rate = await social.rateStatus('bluesky');
    var preview = {
      ok: true, domain: post.domain, length: post.length, text: post.text,
      links: social.buildFacets(post.text).length,
      skipped: post.skipped,
      rate: rate.ok ? { usedToday: rate.used, capPerDay: rate.cap, remaining: rate.remaining } : null
    };

    // A SCHEDULED run publishes. Requiring ?post=1 here would be fragile: Vercel can strip the
    // query string from a cron path (autopilot carries the same warning), and a schedule that
    // silently previews forever is indistinguishable from one that never fired. A human or a
    // browser still has to ask for it explicitly.
    var wantPost = q.post === '1' || cronHit(req);
    if (!wantPost) {
      preview.published = false;
      preview.note = 'Preview only. Add &post=1 to publish. Publishing is never the default.';
      return T.send(res, preview);
    }

    // Cron/admin identity can request evaluation, but only the Communication
    // brain owns the public social effector. Its fresh restored motor receipt
    // must independently release this lane before Bluesky authentication.
    var r = await socialExecutor.execute({
      store: motorStore,
      spec: { subjectDomain: post.domain, text: post.text },
      now: Date.now()
    });
    if (!r || r.status === 'HELD') {
      preview.published = false;
      preview.motorHeld = true;
      preview.reason = r && r.reason || 'communication-social-motor-held';
      preview.motorReceiptId = r && r.motorReceiptId || null;
      preview.motorBlockers = r && r.motorBlockers || [];
      return T.send(res, preview);
    }
    if (!r.ok) {
      preview.published = false;
      preview.reason = r.reason;
      preview.rateLimited = !!r.rateLimited;
      preview.blocked = !!r.blocked;
      return T.send(res, preview);
    }

    try { await db.set(LAST_KEY, { domain: post.domain, at: new Date().toISOString(), uri: r.uri }); } catch (e) {}

    preview.published = true;
    preview.commandId = r.commandId;
    preview.url = r.url;
    preview.uri = r.uri;   // keep this: it is what deleteBlueskyPost needs to undo the post
    preview.rate = { usedToday: r.used, capPerDay: r.cap, remaining: Math.max(0, r.cap - r.used) };
    return T.send(res, preview);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};

// Outward-acting: this sends something into the world on a timer. Records every
// run AND consults the veto first, which is a separate structure that can cancel
// it without this handler being changed or redeployed.
module.exports = require('../lib/heartbeat').guard('social-cron', module.exports);
