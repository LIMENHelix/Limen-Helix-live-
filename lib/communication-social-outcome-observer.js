'use strict';

/**
 * Communication-owned independent outcome observer for Bluesky posts.
 *
 * The executor writes through the authenticated PDS API. This observer reads
 * the public AppView API on a different host and persists its own receipt in
 * the strict actuator namespace. A create response is never treated as an
 * outcome. Public presence and engagement counters must be independently read.
 */

var crypto = require('node:crypto');

var SCHEMA = 'communication-social-outcome/1.0';
var LOG_KEY = 'communication_social_observation_log';
var KEY_PREFIX = 'communication_social_observation:';
var LOG_CAP = 1000;
var APPVIEW = 'https://public.api.bsky.app';
var TIMEOUT_MS = 15000;
var RECONCILE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
var COMMAND_MATCH_LAG_MS = 5 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function postIdentity(post) {
  var uri = text(post && post.uri);
  var cid = text(post && post.cid);
  if (!uri || !cid || uri.indexOf('at://') !== 0 || uri.indexOf('/app.bsky.feed.post/') < 0) return null;
  return { uri: uri, cid: cid };
}

function observationKey(uri) {
  var id = text(uri);
  if (!id) throw new Error('communication social observer: post uri required');
  return KEY_PREFIX + hash(id).slice(0, 32);
}

async function appviewRead(uri, fetchFn) {
  var runFetch = fetchFn || global.fetch;
  if (typeof runFetch !== 'function') throw new Error('communication social observer: fetch unavailable');
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    var response = await runFetch(APPVIEW + '/xrpc/app.bsky.feed.getPosts?uris=' + encodeURIComponent(uri), {
      method: 'GET', signal: controller.signal, headers: { accept: 'application/json' }
    });
    var body = await response.json().catch(function () { return null; });
    if (!response || response.status !== 200 || !body || !Array.isArray(body.posts)) {
      throw new Error('communication social observer: AppView returned HTTP ' + (response && response.status));
    }
    var found = body.posts.filter(function (row) { return row && row.uri === uri; })[0] || null;
    return { found: !!found, post: found };
  } finally {
    clearTimeout(timer);
  }
}

async function authorFeed(handle, fetchFn) {
  var actor = text(handle);
  if (!actor) throw new Error('communication social observer: public handle required');
  var runFetch = fetchFn || global.fetch;
  if (typeof runFetch !== 'function') throw new Error('communication social observer: fetch unavailable');
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
  try {
    var response = await runFetch(APPVIEW + '/xrpc/app.bsky.feed.getAuthorFeed?actor=' + encodeURIComponent(actor) + '&filter=posts_no_replies&limit=50', {
      method: 'GET', signal: controller.signal, headers: { accept: 'application/json' }
    });
    var body = await response.json().catch(function () { return null; });
    if (!response || response.status !== 200 || !body || !Array.isArray(body.feed)) {
      throw new Error('communication social observer: author feed returned HTTP ' + (response && response.status));
    }
    return body.feed.map(function (row) { return row && row.post; }).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

function contentHash(value) { return hash(String(value || '')); }

async function reconcilePending(store, pending, handle, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var rows = Array.isArray(pending) ? pending : [];
  var unresolved = [];
  for (var i = 0; i < rows.length; i++) {
    var indexed = rows[i];
    if (!indexed || indexed.schemaVersion !== 'communication-social-command/1.0' || !text(indexed.commandId)) continue;
    var current = await store.get('communication_social_command:' + indexed.commandId);
    if (current && current.status === 'DISPATCHING' && at >= Number(current.commandedAt) &&
        at - Number(current.commandedAt) <= RECONCILE_WINDOW_MS) unresolved.push(current);
  }
  if (!unresolved.length) return { inspected: rows.length, unresolved: 0, reconciled: 0, receipts: [] };
  var posts = await authorFeed(handle, deps.fetch || global.fetch);
  var receipts = [];
  for (var j = 0; j < unresolved.length; j++) {
    var command = unresolved[j];
    var matches = posts.filter(function (post) {
      var record = post && post.record || {};
      var createdAt = Date.parse(record.createdAt);
      return text(post && post.uri) && text(post && post.cid) && text(record.text) &&
        contentHash(record.text) === command.contentHash && Number.isFinite(createdAt) &&
        createdAt >= Number(command.commandedAt) - 60000 &&
        createdAt <= Number(command.commandedAt) + COMMAND_MATCH_LAG_MS;
    });
    if (matches.length !== 1) continue;
    var match = matches[0];
    var rkey = match.uri.split('/').pop();
    var resolved = Object.assign({}, command, {
      status: 'POSTED', providerCalled: true, resolvedAt: at,
      receipt: {
        uri: match.uri, cid: match.cid,
        url: 'https://bsky.app/profile/' + String(handle).replace(/^@/, '') + '/post/' + rkey,
        used: null, cap: null,
        reconciledFromPublicAppView: true,
        readbackVerified: true
      }
    });
    var key = 'communication_social_command:' + command.commandId;
    await store.set(key, resolved);
    var restored = await store.get(key);
    if (!restored || restored.status !== 'POSTED' || !restored.receipt ||
        restored.receipt.uri !== match.uri || restored.receipt.cid !== match.cid ||
        restored.receipt.reconciledFromPublicAppView !== true) {
      throw new Error('communication social observer: reconciled command readback invalid');
    }
    await store.lpush('communication_social_command_log', restored);
    await store.ltrim('communication_social_command_log', 0, LOG_CAP - 1);
    receipts.push({ commandId: restored.commandId, uri: match.uri, cid: match.cid });
  }
  return { inspected: rows.length, unresolved: unresolved.length, reconciled: receipts.length, receipts: receipts };
}

function normalizeCount(value) {
  var n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function observeOne(store, post, now, deps) {
  deps = deps || {};
  var identity = postIdentity(post);
  if (!identity) return { ok: false, status: 'REFUSED', reason: 'platform-post-identity-invalid' };
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var read = await appviewRead(identity.uri, deps.fetch);
  var publicPost = read.post;
  if (!publicPost || publicPost.cid !== identity.cid) {
    return { ok: true, status: 'HELD', reason: publicPost ? 'public-post-cid-mismatch' : 'public-post-not-indexed', uri: identity.uri };
  }
  var metrics = {
    replies: normalizeCount(publicPost.replyCount),
    reposts: normalizeCount(publicPost.repostCount),
    likes: normalizeCount(publicPost.likeCount),
    quotes: normalizeCount(publicPost.quoteCount)
  };
  metrics.total = metrics.replies + metrics.reposts + metrics.likes + metrics.quotes;
  var prior = await store.get(observationKey(identity.uri));
  var priorTotal = prior && prior.metrics ? normalizeCount(prior.metrics.total) : 0;
  var receipt = {
    schemaVersion: SCHEMA,
    observationId: 'cso_' + hash({ uri: identity.uri, cid: identity.cid, indexedAt: publicPost.indexedAt, at: at }).slice(0, 24),
    productDomain: 'communication',
    ownerDomain: 'communication',
    lane: 'social',
    status: 'OBSERVED',
    postReceipt: { uri: identity.uri, cid: identity.cid },
    sourceIdentity: {
      kind: 'bluesky-appview-snapshot',
      value: identity.uri + '@' + String(publicPost.indexedAt || 'unknown'),
      provider: 'bluesky-public-appview',
      endpointHost: 'public.api.bsky.app',
      independentOfAdapterId: 'bluesky-pds-write-adapter/1'
    },
    metrics: metrics,
    priorEngagementTotal: priorTotal,
    engagementDelta: metrics.total - priorTotal,
    indexedAt: text(publicPost.indexedAt),
    observedAt: at,
    paperOnly: false,
    liveMoney: false
  };
  await store.set(observationKey(identity.uri), receipt);
  var restored = await store.get(observationKey(identity.uri));
  if (!restored || restored.schemaVersion !== SCHEMA || restored.observationId !== receipt.observationId ||
      restored.postReceipt.uri !== identity.uri || restored.postReceipt.cid !== identity.cid) {
    throw new Error('communication social observer: receipt readback invalid');
  }
  await store.lpush(LOG_KEY, receipt);
  await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
  return { ok: true, status: 'OBSERVED', receipt: restored };
}

async function observeRecent(store, posts, now, deps) {
  var rows = Array.isArray(posts) ? posts : [];
  var results = [];
  for (var i = 0; i < rows.length; i++) {
    try { results.push(await observeOne(store, rows[i], now, deps)); }
    catch (error) {
      results.push({ ok: false, status: 'FAILED', reason: 'communication-social-observation-failed', detail: String(error && error.message || error) });
    }
  }
  return {
    ok: results.every(function (row) { return row.ok; }),
    schemaVersion: SCHEMA,
    productDomain: 'communication',
    ownerDomain: 'communication',
    lane: 'social',
    inspected: rows.length,
    observed: results.filter(function (row) { return row.status === 'OBSERVED'; }).length,
    results: results,
    liveMoney: false
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  KEY_PREFIX: KEY_PREFIX,
  APPVIEW: APPVIEW,
  postIdentity: postIdentity,
  observationKey: observationKey,
  appviewRead: appviewRead,
  authorFeed: authorFeed,
  contentHash: contentHash,
  reconcilePending: reconcilePending,
  observeOne: observeOne,
  observeRecent: observeRecent
};
