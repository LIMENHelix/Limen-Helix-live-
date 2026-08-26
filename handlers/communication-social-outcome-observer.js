'use strict';

/** Read-only-provider observer for Communication's public social outcomes. */

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Social = require('../lib/social-post.js');
var Observer = require('../lib/communication-social-outcome-observer.js');

function createHandler(deps) {
  deps = deps || {};
  var cronAuth = deps.cronAuth || CronAuth;
  var store = deps.store || Store;
  var social = deps.social || Social;
  var observer = deps.observer || Observer;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    if (!cronAuth.enforce(req, res)) return;
    try {
      store.assertDurable();
      var pending = await store.lrange('communication_social_pending_log', 0, 99);
      var reconciliation = await observer.reconcilePending(store, pending, process.env.BLUESKY_HANDLE, Date.now(), { fetch: deps.fetch || global.fetch });
      var posts = await social.recentPosts(20);
      reconciliation.receipts.forEach(function (receipt) {
        if (!posts.some(function (post) { return post && post.uri === receipt.uri; })) posts.unshift(receipt);
      });
      var result = await observer.observeRecent(store, posts, Date.now(), { fetch: deps.fetch || global.fetch });
      result.reconciliation = reconciliation;
      res.statusCode = result.ok ? 200 : 207;
      return res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'communication-social-observer-unavailable', detail: String(error && error.message || error), liveMoney: false }));
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('communication-social-outcome-observer', handler);
module.exports.createHandler = createHandler;
