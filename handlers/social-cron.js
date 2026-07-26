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

function authorized(req) {
  var q = req.query || {};
  var want = process.env.SOCIAL_CRON_KEY || process.env.ADMIN_MASTER || process.env.ADMIN_MASTER_KEY || '';
  if (!want) return false;                       // no key configured = closed, not open
  if (q.key && String(q.key) === String(want)) return true;
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
