'use strict';

/** Read-only-provider observer for Communication's public social outcomes. */

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Social = require('../lib/social-post.js');
var Observer = require('../lib/communication-social-outcome-observer.js');
var Learning = require('../lib/communication-social-learning.js');
var DomainLearning = require('../lib/domain-commercial-social-learning.js');

function commandPost(command) {
  return command && command.status === 'POSTED' && command.receipt && command.receipt.readbackVerified === true &&
    command.receipt.uri && command.receipt.cid
    ? { uri: command.receipt.uri, cid: command.receipt.cid } : null;
}

function mergePosts(commands, reconciliation, bestEffort, limit) {
  var seen = Object.create(null), rows = [];
  function add(post) {
    if (!post || !post.uri || !post.cid) return;
    var id = post.uri + '\u0000' + post.cid;
    if (seen[id]) return;
    seen[id] = true; rows.push(post);
  }
  (commands || []).forEach(function (command) { add(commandPost(command)); });
  ((reconciliation && reconciliation.receipts) || []).forEach(add);
  (bestEffort || []).forEach(add);
  return rows.slice(0, limit || 20);
}

function mergeCommands(primary, recovered) {
  var seen = Object.create(null), rows = [];
  (primary || []).concat(recovered || []).forEach(function (command) {
    if (!command || !command.commandId || seen[command.commandId]) return;
    seen[command.commandId] = true; rows.push(command);
  });
  return rows;
}

function mergeObservationReceipts(current, durable) {
  var seen = Object.create(null), rows = [];
  (current || []).concat(durable || []).forEach(function (receipt) {
    if (!receipt || receipt.status !== 'OBSERVED' || !receipt.observationId || seen[receipt.observationId]) return;
    seen[receipt.observationId] = true; rows.push(receipt);
  });
  return rows;
}

function createHandler(deps) {
  deps = deps || {};
  var cronAuth = deps.cronAuth || CronAuth;
  var store = deps.store || Store;
      var social = deps.social || Social;
      var observer = deps.observer || Observer;
      var learning = deps.learning || Learning;
      var domainLearning = deps.domainLearning || DomainLearning;
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
      // The strict executor log is authoritative for successful writes. The
      // social helper's historical log is intentionally best-effort and may be
      // absent even when the durable command receipt exists.
      var commands = mergeCommands(await store.lrange('communication_social_command_log', 0, 99),
        reconciliation.commands);
      var posts = mergePosts(commands, reconciliation, await social.recentPosts(20), 20);
      var result = await observer.observeRecent(store, posts, Date.now(), { fetch: deps.fetch || global.fetch });
      // Observation receipts are the independent sensory record. Replay recent
      // durable receipts until each learning ledger accepts their observation
      // IDs; a later zero-delta poll must not erase an earlier unlearned delta.
      var observations = mergeObservationReceipts(result.results.map(function (row) { return row && row.receipt; }),
        await store.lrange(Observer.LOG_KEY, 0, 99));
      var learned = 0, domainLearned = 0, learningFailures = [];
      for (var i = 0; i < observations.length; i++) {
        var receipt = observations[i];
        var command = commands.find(function (row) { return row && row.receipt && row.receipt.uri === receipt.postReceipt.uri && row.receipt.cid === receipt.postReceipt.cid; });
        if (!command) continue;
        var learnedResult;
        try { learnedResult = await learning.recordObservation(store, command, receipt); }
        catch (error) { learnedResult = { ok: false, reason: String(error && error.message || error) }; }
        if (learnedResult && learnedResult.ok) { if (!learnedResult.duplicate) learned++; }
        else learningFailures.push({ observationId: receipt.observationId, reason: learnedResult && learnedResult.reason || 'communication-learning-failed' });
        if (command.sourceArtifactId) {
          var domainResult;
          try { domainResult = await domainLearning.recordObservation(store, command, receipt); }
          catch (error) { domainResult = { ok: false, reason: String(error && error.message || error) }; }
          if (domainResult && domainResult.ok) { if (!domainResult.duplicate) domainLearned++; }
          else learningFailures.push({ observationId: receipt.observationId, subjectDomain: command.subjectDomain,
            reason: domainResult && domainResult.reason || 'subject-domain-learning-failed' });
        }
      }
      result.learning = { communicationRecorded: learned, subjectDomainRecorded: domainLearned, failures: learningFailures };
      if (learningFailures.length) result.ok = false;
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
module.exports.commandPost = commandPost;
module.exports.mergePosts = mergePosts;
module.exports.mergeCommands = mergeCommands;
module.exports.mergeObservationReceipts = mergeObservationReceipts;
