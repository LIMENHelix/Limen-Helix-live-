/**
 * api/social-status.js — "are the credentials actually working?" without printing any.
 *
 *   GET /api/social-status          → which secrets the deployment can SEE (booleans only)
 *   GET /api/social-status?live=1   → also attempts a real Bluesky login and reports the
 *                                     authenticated handle + DID
 *
 * WHY THIS EXISTS. Vercel returns sensitive env values as empty to the CLI, so a credential
 * cannot be verified by reading it back — the only honest check is to USE it. This reports
 * presence as booleans and never echoes a value, so it is safe to hit from anywhere.
 *
 * The live check settles the handle question definitively: two plausible handles can both
 * resolve publicly, but only the account whose app password you hold will authenticate, and
 * the response names it.
 */
var T = require('../lib/tool-fetch');
var social = require('../lib/social-post');

// name -> what it unlocks. Presence only; values are never read into the response.
var EXPECTED = [
  { env: 'BLUESKY_HANDLE', platform: 'bluesky', secret: false, what: 'Your full Bluesky handle, e.g. limen.bsky.social' },
  { env: 'BLUESKY_APP_PASSWORD', platform: 'bluesky', secret: true, what: 'App password from bsky.app/settings/app-passwords' },
  { env: 'TELEGRAM_BOT_TOKEN', platform: 'telegram', secret: true, what: 'Token from @BotFather' },
  { env: 'TELEGRAM_CHANNEL', platform: 'telegram', secret: false, what: 'Channel the bot posts to, e.g. @limenhelix' },
  { env: 'REDDIT_CLIENT_ID', platform: 'reddit', secret: true, what: 'Script app id from reddit.com/prefs/apps' },
  { env: 'REDDIT_CLIENT_SECRET', platform: 'reddit', secret: true, what: 'Script app secret' },
  { env: 'REDDIT_USERNAME', platform: 'reddit', secret: false, what: 'Posting account' },
  { env: 'REDDIT_PASSWORD', platform: 'reddit', secret: true, what: 'Posting account password' },
  { env: 'X_API_KEY', platform: 'x', secret: true, what: 'From developer.x.com' },
  { env: 'X_API_SECRET', platform: 'x', secret: true, what: 'From developer.x.com' },
  { env: 'X_ACCESS_TOKEN', platform: 'x', secret: true, what: 'Generate AFTER setting Read+Write' },
  { env: 'X_ACCESS_SECRET', platform: 'x', secret: true, what: 'Generate AFTER setting Read+Write' },
  { env: 'DISCORD_WEBHOOK_URL', platform: 'discord', secret: true, what: 'Channel > Integrations > Webhooks' }
];

function presence() {
  var byPlatform = {};
  EXPECTED.forEach(function (e) {
    var set = !!(process.env[e.env] && String(process.env[e.env]).trim());
    var p = byPlatform[e.platform] || (byPlatform[e.platform] = { platform: e.platform, ready: true, vars: [] });
    // For a NON-secret var the value is safe to show, and seeing it is how a typo gets caught.
    p.vars.push({ env: e.env, set: set, what: e.what, value: (!e.secret && set) ? String(process.env[e.env]).trim() : null });
    if (!set) p.ready = false;
  });
  return Object.keys(byPlatform).map(function (k) { return byPlatform[k]; });
}

module.exports = async function handler(req, res) {
  var q = req.query || {};
  try {
    var platforms = presence();
    var out = {
      ok: true,
      platforms: platforms,
      readyPlatforms: platforms.filter(function (p) { return p.ready; }).map(function (p) { return p.platform; }),
      note: 'Presence only. Secret VALUES are never returned by this endpoint. Add missing variables in Vercel > Settings > Environment Variables, then redeploy.'
    };

    // WHY posting is or is not happening, in one place. Without this, a silent block looks
    // identical to a cron that never fired, which is exactly the confusion that cost a day of
    // posts when the AI kill switch was gating this path.
    var blockedReason = await social.postingBlocked();
    out.posting = {
      enabled: !blockedReason,
      blockedReason: blockedReason || null,
      envSwitch: process.env.SOCIAL_POSTING_ENABLED == null ? '(unset, defaults to on)' : String(process.env.SOCIAL_POSTING_ENABLED),
      // Is the cron secret actually usable? Reports LENGTH, never the value. Vercel redacts
      // every secret on `env pull`, so an empty or malformed write is otherwise undetectable
      // until a scheduled job starts failing. Once CRON_SECRET is set, every cron handler that
      // checks it REQUIRES the bearer, so a blank value would silently break autopilot too.
      cronSecret: {
        configured: !!process.env.CRON_SECRET,
        length: (process.env.CRON_SECRET || '').length,
        usable: (process.env.CRON_SECRET || '').trim().length >= 16
      },
      // reported for diagnosis only: posting no longer depends on it
      aiKillSwitchWouldBlock: await (async function () {
        try { var k = require('../lib/ai-kill-switch'); return !!(await k.spendDisabled()); } catch (e) { return null; }
      })()
    };

    var rate = await social.rateStatus('bluesky');
    if (rate.ok) out.blueskyRate = { usedToday: rate.used, capPerDay: rate.cap, remaining: rate.remaining };

    out.recentPosts = (await social.recentPosts(5)).map(function (p) {
      return { at: p.at, platform: p.platform, url: p.url, text: String(p.text || '').slice(0, 120) };
    });

    if (q.live === '1') {
      var handleSet = !!process.env.BLUESKY_HANDLE;
      out.blueskyLogin = { attempted: true, resolvedHandle: handleSet ? social.normalizeHandle(process.env.BLUESKY_HANDLE) : null };
      var s = await social.bskySession();
      if (s.ok) {
        out.blueskyLogin.ok = true;
        out.blueskyLogin.authenticatedAs = s.handle;   // settles which account the password belongs to
        out.blueskyLogin.did = s.did;
      } else {
        out.blueskyLogin.ok = false;
        out.blueskyLogin.reason = s.reason;            // message only, never the credential
      }
    }
    return T.send(res, out);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'handler error' }, 500);
  }
};
