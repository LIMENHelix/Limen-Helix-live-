#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Observer = require('../lib/communication-social-outcome-observer.js');
var Handler = require('../handlers/communication-social-outcome-observer.js');
var Strict = require('../lib/autofire-efference-store.js');
var Learning = require('../lib/communication-social-learning.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; return this.set(key, value); };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: JSON.parse(JSON.stringify(value)) }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };
Store.prototype.lrange = async function (key, start, stop) {
  var rows = this.log.filter(function (row) { return row.key === key; });
  return rows.slice(start, stop < 0 ? undefined : stop + 1).map(function (row) { return row.value; });
};
Store.prototype.lrem = async function (key, _count, value) {
  var before = this.log.length;
  this.log = this.log.filter(function (row) { return row.key !== key || JSON.stringify(row.value) !== JSON.stringify(value); });
  return before - this.log.length;
};

var post = { uri: 'at://did:plc:test/app.bsky.feed.post/r1', cid: 'bafy-test' };
function responsePost(count) {
  return async function (url) {
    if (String(url).includes('app.bsky.feed.getAuthorFeed')) {
      return { status: 200, json: async function () { return { feed: [{ post: {
        uri: post.uri, cid: post.cid, replyCount: 1, repostCount: 2, likeCount: count, quoteCount: 4,
        indexedAt: '2026-08-25T02:01:30.470Z',
        record: { text: 'public post text', createdAt: '2026-08-25T02:01:00.000Z' }
      } }] }; } };
    }
    return { status: 200, json: async function () { return { posts: [{ uri: post.uri, cid: post.cid, replyCount: 1, repostCount: 2, likeCount: count, quoteCount: 4, indexedAt: '2026-08-25T02:01:30.470Z' }] }; } };
  };
}
function response() {
  return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, end: function (body) { this.json = JSON.parse(body); } };
}

(async function () {
  assert.equal(Strict.assertKey(Observer.LOG_KEY), Observer.LOG_KEY);
  assert.equal(Strict.assertKey(Observer.observationKey(post.uri)), Observer.observationKey(post.uri));
  assert.equal(Observer.postIdentity({ uri: 'bad', cid: post.cid }), null);

  var reconcileStore = new Store();
  var pendingCommand = {
    schemaVersion: 'communication-social-command/1.0', commandId: 'csc_pending', status: 'DISPATCHING',
    contentHash: Observer.contentHash('reconcile me'), commandedAt: 1000
  };
  await reconcileStore.set('communication_social_command:csc_pending', pendingCommand);
  var reconciled = await Observer.reconcilePending(reconcileStore, [pendingCommand], 'limenhelix.bsky.social', 5000, {
    fetch: async function (url) {
      assert(url.includes('app.bsky.feed.getAuthorFeed'));
      return { status: 200, json: async function () { return { feed: [{ post: {
        uri: 'at://did/app.bsky.feed.post/reconciled', cid: 'cid-reconciled',
        record: { text: 'reconcile me', createdAt: new Date(2000).toISOString() }
      } }] }; } };
    }
  });
  assert.equal(reconciled.reconciled, 1);
  var reconciledCommand = await reconcileStore.get('communication_social_command:csc_pending');
  assert.equal(reconciledCommand.receipt.reconciledFromPublicAppView, true);

  var store = new Store();
  var first = await Observer.observeOne(store, post, 1000, { fetch: responsePost(3) });
  assert.equal(first.status, 'OBSERVED');
  assert.equal(first.receipt.metrics.total, 10);
  assert.equal(first.receipt.engagementDelta, 10);
  assert.equal(first.receipt.sourceIdentity.endpointHost, 'public.api.bsky.app');
  assert.equal(first.receipt.sourceIdentity.independentOfAdapterId, 'bluesky-pds-write-adapter/1');
  var learningCommand = { ownerDomain: 'communication', lane: 'social', commandId: 'command-learning-1', decisionReceiptId: 'decision-learning-1',
    subjectDomain: 'finance', contentHash: 'content-hash', predictedOutcome: { measurable: 'engagement-or-conversion' }, commandedAt: 900 };
  assert.equal((await Learning.recordCommand(store, learningCommand)).ok, true);
  assert.equal((await Learning.recordObservation(store, learningCommand, first.receipt)).ok, true);
  assert.equal((await Learning.readForBrain(store)).status, 'ELIGIBLE');
  var second = await Observer.observeOne(store, post, 2000, { fetch: responsePost(5) });
  assert.equal(second.receipt.metrics.total, 12);
  assert.equal(second.receipt.engagementDelta, 2);
  assert.equal(store.log.length, 2);

  var mismatch = await Observer.observeOne(new Store(), post, 3000, { fetch: async function () { return { status: 200, json: async function () { return { posts: [{ uri: post.uri, cid: 'wrong' }] }; } }; } });
  assert.equal(mismatch.status, 'HELD');
  assert.equal(mismatch.reason, 'public-post-cid-mismatch');

  var handlerStore = new Store();
  var handler = Handler.createHandler({
    store: handlerStore,
    cronAuth: { enforce: function (req, res) { if (req.headers.authorization === 'Bearer cron') return true; res.statusCode = 401; res.end('{}'); return false; } },
    social: { recentPosts: async function () { return [post]; } },
    observer: Observer,
    handle: 'limenhelix.bsky.social',
    fetch: responsePost(1)
  });
  var denied = response();
  await handler({ method: 'GET', headers: {} }, denied);
  assert.equal(denied.statusCode, 401);
  assert.equal(handlerStore.log.length, 0);
  var accepted = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer cron' } }, accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.json.observed, 1);
  assert.equal((await handlerStore.lrange(Observer.LOG_KEY, 0, -1)).length, 1);
  assert.equal(accepted.json.externalObservations.observed, 1);
  assert.equal(accepted.json.externalObservations.eligibleForLearning, false);

  var externalStore = new Store();
  var knownCommand = { receipt: { uri: post.uri, cid: post.cid } };
  var externalPost = { uri: 'at://did:plc:test/app.bsky.feed.post/external', cid: 'external-cid',
    replyCount: 0, repostCount: 1, likeCount: 2, quoteCount: 0,
    record: { text: 'posted outside the LIMEN motor', createdAt: '2026-09-15T16:55:53.000Z' } };
  var external = await Observer.observeExternalFeed(externalStore, 'limenhelix.bsky.social', [knownCommand], 5000, {
    fetch: async function () { return { status: 200, json: async function () {
      return { feed: [{ post: Object.assign({}, post, { record: { text: 'known', createdAt: '2026-08-25T02:01:00.000Z' } }) },
        { post: externalPost }] };
    } }; }
  });
  assert.equal(external.inspected, 2);
  assert.equal(external.observedExternal, 1);
  assert.equal(external.receipts[0].status, 'OBSERVED_EXTERNAL');
  assert.equal(external.receipts[0].attribution, 'UNJOINED');
  assert.equal(external.receipts[0].eligibleForExecutionProof, false);
  assert.equal(external.receipts[0].eligibleForLearning, false);
  assert.equal(external.receipts[0].text, undefined);
  assert.equal((await externalStore.lrange(Observer.LEARNING_PENDING_LOG_KEY, 0, -1)).length, 0);

  var strictStore = new Store();
  var strictCommand = Object.assign({}, learningCommand, {
    schemaVersion: 'communication-social-command/1.0', status: 'POSTED',
    receipt: { uri: post.uri, cid: post.cid, readbackVerified: true }
  });
  await strictStore.lpush('communication_social_command_log', strictCommand);
  assert.equal((await Learning.recordCommand(strictStore, strictCommand)).ok, true);
  var strictHandler = Handler.createHandler({
    store: strictStore,
    cronAuth: { enforce: function () { return true; } },
    social: { recentPosts: async function () { return []; } },
    observer: Observer,
    fetch: responsePost(2)
  });
  var strictResponse = response();
  await strictHandler({ method: 'GET', headers: {} }, strictResponse);
  assert.equal(strictResponse.statusCode, 200);
  assert.equal(strictResponse.json.observed, 1,
    'durable POSTED command is observed even when the best-effort social log is empty');
  assert.equal(Handler.mergePosts([strictCommand], { receipts: [] }, [], 20)[0].uri, post.uri);

  var pendingOnlyStore = new Store();
  var pendingOnlyCommand = Object.assign({}, strictCommand, { commandId: 'pending-only-posted-command' });
  await pendingOnlyStore.set('communication_social_command:' + pendingOnlyCommand.commandId, pendingOnlyCommand);
  await pendingOnlyStore.lpush('communication_social_pending_log', Object.assign({}, pendingOnlyCommand, {
    status: 'DISPATCHING', receipt: null
  }));
  assert.equal((await Learning.recordCommand(pendingOnlyStore, pendingOnlyCommand)).ok, true);
  var pendingOnlyHandler = Handler.createHandler({
    store: pendingOnlyStore, cronAuth: { enforce: function () { return true; } },
    social: { recentPosts: async function () { return []; } }, observer: Observer, fetch: responsePost(2)
  });
  var pendingOnlyResponse = response();
  await pendingOnlyHandler({ method: 'GET', headers: {} }, pendingOnlyResponse);
  assert.equal(pendingOnlyResponse.statusCode, 200);
  assert.equal(pendingOnlyResponse.json.observed, 1,
    'a POSTED command remains observable from its pre-dispatch pending index when final log append failed');
  assert.equal(pendingOnlyResponse.json.learning.communicationRecorded, 1);

  var replayStore = new Store();
  var replayCommand = Object.assign({}, strictCommand, {
    sourceArtifactId: 'finance-artifact-replay', sourceIntentId: 'finance-intent-replay',
    sourcePacketId: 'finance-packet-replay', domainDecisionReceiptId: 'finance-release-replay'
  });
  await replayStore.lpush('communication_social_command_log', replayCommand);
  await replayStore.lpush(Observer.LEARNING_PENDING_LOG_KEY,
    Object.assign({}, first.receipt, { commandId: replayCommand.commandId }));
  var domainAttempts = 0;
  var replayHandler = Handler.createHandler({
    store: replayStore, cronAuth: { enforce: function () { return true; } },
    social: { recentPosts: async function () { return []; } }, observer: Object.assign({}, Observer, {
      reconcilePending: async function () { return { receipts: [], commands: [] }; },
      observeRecent: async function () { return { ok: true, results: [], observed: 0 }; }
    }),
    learning: { recordObservation: async function () { return { ok: true, duplicate: true }; } },
    domainLearning: { recordObservation: async function () { domainAttempts++; return { ok: true }; } }
  });
  var replayResponse = response();
  await replayHandler({ method: 'GET', headers: {} }, replayResponse);
  assert.equal(replayResponse.statusCode, 200);
  assert.equal(domainAttempts, 1,
    'an observation receipt is replayed from the durable log when the prior domain-learning write did not land');

  console.log('communication social outcome observer: public AppView identity, strict receipt readback, ambiguous-command reconciliation, engagement deltas, and cron-only writes passed');
})().catch(function (error) { console.error(error); process.exit(1); });
