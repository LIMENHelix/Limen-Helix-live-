#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Observer = require('../lib/communication-social-outcome-observer.js');
var Handler = require('../handlers/communication-social-outcome-observer.js');
var Strict = require('../lib/autofire-efference-store.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: JSON.parse(JSON.stringify(value)) }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

var post = { uri: 'at://did:plc:test/app.bsky.feed.post/r1', cid: 'bafy-test' };
function responsePost(count) {
  return async function () {
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

  var store = new Store();
  var first = await Observer.observeOne(store, post, 1000, { fetch: responsePost(3) });
  assert.equal(first.status, 'OBSERVED');
  assert.equal(first.receipt.metrics.total, 10);
  assert.equal(first.receipt.engagementDelta, 10);
  assert.equal(first.receipt.sourceIdentity.endpointHost, 'public.api.bsky.app');
  assert.equal(first.receipt.sourceIdentity.independentOfAdapterId, 'bluesky-pds-write-adapter/1');
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
  assert.equal(handlerStore.log.length, 1);

  console.log('communication social outcome observer: public AppView identity, strict receipt readback, engagement deltas, and cron-only writes passed');
})().catch(function (error) { console.error(error); process.exit(1); });
