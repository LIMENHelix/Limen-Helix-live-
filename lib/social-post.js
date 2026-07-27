/**
 * lib/social-post.js — outward posting, rate-limited and revertible.
 *
 * Per CLAUDE.md, publishing is REACH, not metered spend: the risk is exposure and churn, not
 * dollars, so this is capped by RATE (posts per day) rather than by a budget. Every post
 * records its URI so it can be deleted, because "revertible" is the other half of the rule.
 *
 * ORDER OF GATES, deliberately: kill switch, then rate limit, then post. The operator's pause
 * must stop posting even when the day's quota is untouched.
 *
 * FAILS CLOSED. If the rate ledger cannot be read, posting is refused. An unreachable Redis
 * must not become an unlimited megaphone.
 *
 * Bluesky (AT Protocol) is the first platform. Two details that silently degrade posts if
 * missed, both handled here:
 *   - A bare URL in the text is NOT clickable. Links require a `facet` carrying UTF-8 BYTE
 *     offsets (not character offsets), so a post with any non-ASCII character earlier in the
 *     string will link the wrong span if you use string indices.
 *   - The 300 limit is GRAPHEMES, not characters or bytes.
 */
var db = require('./limen-db');

var BSKY_PDS = 'https://bsky.social';
var RATE_KEY = 'social:rate:v1';
var DEFAULT_MAX_PER_DAY = 8;
var POST_LOG_KEY = 'social:posted:v1';
var PAUSE_KEY = 'social:paused';
var MAX_GRAPHEMES = 300;

function todayKey() { return new Date().toISOString().slice(0, 10); }
function maxPerDay() {
  var n = parseInt(process.env.SOCIAL_MAX_POSTS_PER_DAY, 10);
  return isFinite(n) && n >= 0 ? n : DEFAULT_MAX_PER_DAY;
}

/** Bluesky handles are domains. A bare name means the default PDS domain. */
function normalizeHandle(h) {
  var s = String(h || '').trim().replace(/^@/, '').toLowerCase();
  if (!s) return '';
  return s.indexOf('.') === -1 ? s + '.bsky.social' : s;
}

/** Grapheme count, so emoji and combining marks are not miscounted as several characters. */
function graphemeLength(s) {
  s = String(s || '');
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      var n = 0;
      var it = seg.segment(s)[Symbol.iterator]();
      while (!it.next().done) n++;
      return n;
    }
  } catch (e) {}
  return Array.from(s).length;   // still better than .length for surrogate pairs
}

/**
 * Build link facets with UTF-8 BYTE offsets. Using string indices here is the classic bug:
 * any emoji or accented character before a URL shifts the byte offset and the link lands on
 * the wrong span (or fails to render).
 */
function buildFacets(text) {
  var facets = [];
  var re = /https?:\/\/[^\s<>()\[\]]+[^\s<>()\[\].,;:!?'"]/g;
  var enc = new TextEncoder();
  var m;
  while ((m = re.exec(text)) !== null) {
    var before = text.slice(0, m.index);
    var byteStart = enc.encode(before).length;
    var byteEnd = byteStart + enc.encode(m[0]).length;
    facets.push({
      index: { byteStart: byteStart, byteEnd: byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }]
    });
  }
  return facets;
}

function creds() {
  return {
    handle: normalizeHandle(process.env.BLUESKY_HANDLE),
    password: process.env.BLUESKY_APP_PASSWORD || ''
  };
}

async function bskySession() {
  var c = creds();
  if (!c.handle || !c.password) {
    return { ok: false, reason: 'BLUESKY_HANDLE or BLUESKY_APP_PASSWORD is not set on this deployment.' };
  }
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 15000);
  try {
    var r = await fetch(BSKY_PDS + '/xrpc/com.atproto.server.createSession', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: c.handle, password: c.password })
    });
    clearTimeout(tid);
    var j = await r.json().catch(function () { return null; });
    if (r.status !== 200 || !j || !j.accessJwt) {
      // Never echo the password or the raw body; the message alone is enough to debug.
      return { ok: false, status: r.status, reason: (j && j.message) || ('Bluesky auth returned ' + r.status), handle: c.handle };
    }
    return { ok: true, jwt: j.accessJwt, did: j.did, handle: j.handle || c.handle };
  } catch (e) {
    clearTimeout(tid);
    return { ok: false, reason: 'Bluesky auth unreachable: ' + (e.message || 'timeout'), handle: c.handle };
  }
}


/**
 * Is posting paused right now, and why?
 *
 * THIS DELIBERATELY DOES NOT USE THE AI KILL SWITCH. It used to, and that was wrong: posting
 * runs zero AI. The generator is deterministic code reading free federal APIs, so a post costs
 * nothing but reach. Gating it on `spendDisabled()` meant that pausing AI to control token
 * spend also silently switched off the marketing channel, with no error anywhere and no posts
 * for a day.
 *
 * CLAUDE.md already draws this line: AI tokens are METERED SPEND (budgeted), publishing is
 * REACH (rate-limited). Two different risks, so two different switches.
 *
 *   SOCIAL_POSTING_ENABLED=0   env-level off switch
 *   social:paused (Redis)      operator's runtime pause, flippable from the console
 *
 * Fails CLOSED: if the pause flag cannot be read, refuse. An unreachable Redis must not become
 * an unattended megaphone.
 */
async function postingBlocked() {
  if (String(process.env.SOCIAL_POSTING_ENABLED == null ? '1' : process.env.SOCIAL_POSTING_ENABLED).trim() === '0') {
    return 'SOCIAL_POSTING_ENABLED is set to 0.';
  }
  try {
    var p = await db.get(PAUSE_KEY);
    if (p === true || (p && typeof p === 'object' && p.paused)) {
      return 'the operator paused posting (' + PAUSE_KEY + ').';
    }
  } catch (e) {
    return 'the pause flag could not be read, so posting is refused.';
  }
  return null;
}

/**
 * Read and write that pause flag.
 *
 * The flag has been read on every post attempt since it was written, and until
 * now NOTHING in the repo set it. The comment above promised it was "flippable
 * from the console" and there was no console and no writer, so the operator's
 * pause on outbound posting could never actually be engaged. These two make it
 * real, and /api/harness exposes them.
 *
 * Shape matches what postingBlocked() already accepts: an object with .paused.
 */
async function isPaused() {
  try {
    var p = await db.get(PAUSE_KEY);
    return { ok: true, paused: p === true || !!(p && typeof p === 'object' && p.paused),
             at: (p && p.at) || null, reason: (p && p.reason) || null };
  } catch (e) {
    // Unreadable is not "not paused". postingBlocked() fails closed on the same
    // condition, so report the uncertainty rather than a comfortable default.
    return { ok: false, paused: null, unreadable: true };
  }
}

async function setPaused(paused, reason) {
  var row = { paused: !!paused, at: Date.now(), reason: reason ? String(reason).slice(0, 200) : null };
  try { await db.set(PAUSE_KEY, row); }
  catch (e) { return { ok: false, error: 'could not write ' + PAUSE_KEY + ': ' + (e.message || 'unknown') }; }
  return { ok: true, key: PAUSE_KEY, state: row };
}

/** Rate ledger. Returns { ok } or { ok:false, reason } and never silently allows on error. */
async function claimRateSlot(platform) {
  var cap = maxPerDay();
  if (cap === 0) return { ok: false, reason: 'Posting is disabled (SOCIAL_MAX_POSTS_PER_DAY is 0).' };
  var l;
  try { l = await db.get(RATE_KEY); } catch (e) {
    return { ok: false, reason: 'Rate ledger unreachable, refusing to post: ' + (e.message || 'unknown') };
  }
  if (!l || typeof l !== 'object') l = {};
  var k = platform + ':' + todayKey();
  var used = parseInt(l[k], 10) || 0;
  if (used >= cap) {
    return { ok: false, rateLimited: true, reason: 'Daily post cap reached for ' + platform + ': ' + used + ' of ' + cap + '.', used: used, cap: cap };
  }
  l[k] = used + 1;
  // keep only recent days
  var keys = Object.keys(l).sort().slice(-30);
  var trimmed = {}; keys.forEach(function (x) { trimmed[x] = l[x]; });
  try { await db.set(RATE_KEY, trimmed); } catch (e) {
    return { ok: false, reason: 'Could not record the rate slot, refusing to post.' };
  }
  return { ok: true, used: used + 1, cap: cap };
}

/**
 * Give a claimed slot back when the post did not actually publish.
 *
 * The slot is claimed BEFORE auth so two concurrent runs cannot both slip past the cap. But
 * without this release, a failure still consumes quota: three attempts against a bad password
 * burned an entire day's cap in testing while publishing nothing. Claim for race safety,
 * release on failure so only real posts count.
 */
async function releaseRateSlot(platform) {
  try {
    var l = await db.get(RATE_KEY);
    if (!l || typeof l !== 'object') return;
    var k = platform + ':' + todayKey();
    var used = parseInt(l[k], 10) || 0;
    if (used > 0) { l[k] = used - 1; await db.set(RATE_KEY, l); }
  } catch (e) {}
}

async function logPost(rec) {
  try {
    var log = await db.get(POST_LOG_KEY);
    if (!Array.isArray(log)) log = [];
    log.unshift(rec);
    await db.set(POST_LOG_KEY, log.slice(0, 200));
  } catch (e) {}
}

/**
 * Post to Bluesky.
 * @param {string} text
 * @param {object} [o] { dryRun:true } builds and validates the record without publishing.
 */
async function postToBluesky(text, o) {
  o = o || {};
  text = String(text || '').trim();
  if (!text) return { ok: false, reason: 'Empty post.' };

  var len = graphemeLength(text);
  if (len > MAX_GRAPHEMES) {
    return { ok: false, reason: 'Post is ' + len + ' graphemes; Bluesky allows ' + MAX_GRAPHEMES + '.', length: len };
  }

  // 1. Operator pause first: it outranks any remaining quota.
  var blocked = await postingBlocked();
  if (blocked) return { ok: false, blocked: true, reason: 'Posting blocked: ' + blocked };

  var facets = buildFacets(text);
  var record = {
    $type: 'app.bsky.feed.post',
    text: text,
    createdAt: new Date().toISOString()
  };
  if (facets.length) record.facets = facets;

  if (o.dryRun) {
    return { ok: true, dryRun: true, length: len, facets: facets.length, record: record };
  }

  // 2. Rate limit.
  var slot = await claimRateSlot('bluesky');
  if (!slot.ok) return { ok: false, reason: slot.reason, rateLimited: !!slot.rateLimited };

  // 3. Auth + publish.
  var s = await bskySession();
  if (!s.ok) { await releaseRateSlot('bluesky'); return { ok: false, reason: s.reason }; }

  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 20000);
  try {
    var r = await fetch(BSKY_PDS + '/xrpc/com.atproto.repo.createRecord', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.jwt },
      body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record: record })
    });
    clearTimeout(tid);
    var j = await r.json().catch(function () { return null; });
    if (r.status !== 200 || !j || !j.uri) {
      await releaseRateSlot('bluesky');
      return { ok: false, reason: (j && j.message) || ('Bluesky createRecord returned ' + r.status) };
    }
    var rkey = String(j.uri).split('/').pop();
    var url = 'https://bsky.app/profile/' + s.handle + '/post/' + rkey;
    await logPost({ at: new Date().toISOString(), platform: 'bluesky', uri: j.uri, cid: j.cid, url: url, text: text.slice(0, 300) });
    return { ok: true, uri: j.uri, cid: j.cid, url: url, used: slot.used, cap: slot.cap };
  } catch (e) {
    clearTimeout(tid);
    await releaseRateSlot('bluesky');
    return { ok: false, reason: 'Bluesky post failed: ' + (e.message || 'timeout') };
  }
}

/** Delete a post by AT URI. "Revertible" is part of the rule, so it ships with the poster. */
async function deleteBlueskyPost(uri) {
  var s = await bskySession();
  if (!s.ok) return { ok: false, reason: s.reason };
  var rkey = String(uri || '').split('/').pop();
  if (!rkey) return { ok: false, reason: 'Bad post URI.' };
  try {
    var r = await fetch(BSKY_PDS + '/xrpc/com.atproto.repo.deleteRecord', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.jwt },
      body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', rkey: rkey })
    });
    return r.status === 200 ? { ok: true } : { ok: false, reason: 'delete returned ' + r.status };
  } catch (e) { return { ok: false, reason: e.message || 'delete failed' }; }
}

async function rateStatus(platform) {
  var cap = maxPerDay();
  var l = null;
  try { l = await db.get(RATE_KEY); } catch (e) { return { ok: false, reason: 'rate ledger unreachable' }; }
  var used = (l && parseInt(l[(platform || 'bluesky') + ':' + todayKey()], 10)) || 0;
  return { ok: true, used: used, cap: cap, remaining: Math.max(0, cap - used) };
}

async function recentPosts(n) {
  try {
    var log = await db.get(POST_LOG_KEY);
    return Array.isArray(log) ? log.slice(0, n || 10) : [];
  } catch (e) { return []; }
}

module.exports = {
  postToBluesky: postToBluesky, postingBlocked: postingBlocked, deleteBlueskyPost: deleteBlueskyPost,
  bskySession: bskySession, rateStatus: rateStatus, recentPosts: recentPosts,
  normalizeHandle: normalizeHandle, buildFacets: buildFacets, graphemeLength: graphemeLength,
  isPaused: isPaused, setPaused: setPaused, PAUSE_KEY: PAUSE_KEY,
  MAX_GRAPHEMES: MAX_GRAPHEMES
};
