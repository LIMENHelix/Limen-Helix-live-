/**
 * api/social-cron.js — generate a post from live data and publish it.
 *
 *   GET /api/social-cron?key=...            → PREVIEW. Builds the post, publishes nothing.
 *   GET /api/social-cron?key=...&post=1     → actually publishes.
 *   GET /api/social-cron?key=...&domain=law → force a specific domain (preview or post).
 *
 * DEFAULTS TO PREVIEW ON PURPOSE. Publishing requires post=1, so a stray hit on this URL,
 * a browser prefetch, or a misconfigured cron cannot put something on a public timeline. The
 * one irreversible action in this system should need an explicit argument.
 *
 * Every other guard lives in lib/social-post.js and applies here unchanged: operator kill
 * switch first, then the daily rate cap, then the post; failures release the rate slot; every
 * published post records its AT URI so it can be deleted.
 *
 * Rotation is persisted so the same domain does not repeat back to back across invocations.
 */
var T = require('../lib/tool-fetch');
var db = require('../lib/limen-db');
var gen = require('../lib/social-generator');
var social = require('../lib/social-post');

var LAST_KEY = 'social:lastDomain:v1';

// Any operator-level admin key opens this. They already gate lead PII, which is more
// sensitive than a post preview, and accepting them means the admin console can use the key
// it has already prompted for instead of asking for a second one.
var KEY_VARS = ['SOCIAL_CRON_KEY', 'ADMIN_MASTER', 'ADMIN_MASTER_KEY', 'SALES_ADMIN_KEY', 'LEAD_ADMIN_KEY'];

function authorized(req) {
  var q = req.query || {};
  var supplied = q.key ? String(q.key) : '';
  var configured = KEY_VARS.map(function (n) { return process.env[n] ? String(process.env[n]).trim() : ''; })
                           .filter(Boolean);
  if (!configured.length) return false;          // no key configured anywhere = closed, not open
  if (supplied && configured.indexOf(supplied) !== -1) return true;
  // Vercel's scheduler sends this header; it cannot set a query string on a cron path.
  var h = req.headers || {};
  return !!(h['x-vercel-cron'] || h['X-Vercel-Cron']);
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

    if (q.post !== '1') {
      preview.published = false;
      preview.note = 'Preview only. Add &post=1 to publish. Publishing is never the default.';
      return T.send(res, preview);
    }

    var r = await social.postToBluesky(post.text);
    if (!r.ok) {
      preview.published = false;
      preview.reason = r.reason;
      preview.rateLimited = !!r.rateLimited;
      preview.blocked = !!r.blocked;
      return T.send(res, preview);
    }

    try { await db.set(LAST_KEY, { domain: post.domain, at: new Date().toISOString(), uri: r.uri }); } catch (e) {}

    preview.published = true;
    preview.url = r.url;
    preview.uri = r.uri;   // keep this: it is what deleteBlueskyPost needs to undo the post
    preview.rate = { usedToday: r.used, capPerDay: r.cap, remaining: Math.max(0, r.cap - r.used) };
    return T.send(res, preview);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
