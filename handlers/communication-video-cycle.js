'use strict';

/** Convert current exact-domain video manifests into dual-brain B14 commands. */

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/domain-commercial-lanes.js');
var Release = require('../lib/domain-commercial-video-release.js');
var Command = require('../lib/communication-video-command.js');

async function one(store, domain, now, deps) {
  var subject = await Release.releaseSubject(store, domain, now, deps);
  if (!subject || subject.released !== true) return { domain: domain, stage: 'subject-decision',
    status: subject && subject.status || 'NO_ACTION', reason: subject && subject.reason || 'subject-release-unavailable',
    commandId: null, providerCalled: false, externalEffectAuthorized: false };
  var channel = await Release.releaseChannel(store, subject, now, deps);
  if (!channel || channel.released !== true) return { domain: domain, stage: 'communication-decision',
    status: channel && channel.status || 'NO_ACTION', reason: channel && channel.reason || 'channel-release-unavailable',
    commandId: null, providerCalled: false, externalEffectAuthorized: false };
  var command = await Command.prepare(store, subject, channel, now);
  return { domain: domain, stage: 'b14-command', status: command.status, reason: command.reason || null,
    commandId: command.commandId || null, manifestId: command.manifestId || null,
    providerCalled: false, externalEffectAuthorized: false };
}

async function run(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var now = Number.isFinite(Number(deps.now)) ? Number(deps.now) : Date.now();
  store.assertDurable();
  var rows = await Promise.all(Lanes.DOMAINS.map(function (domain) { return one(store, domain, now, deps); }));
  var commanded = rows.filter(function (row) { return row.status === 'AWAITING_LOCAL_RENDERER'; }).length;
  var failed = rows.filter(function (row) { return row.status === 'FAILED'; }).length;
  return { ok: failed === 0, schemaVersion: 'communication-video-cycle/1.0', evaluatedAt: now,
    domains: rows.length, commanded: commanded, abstained: rows.length - commanded - failed, failed: failed, rows: rows,
    homology: { afferent: 'twenty-domain-feed-and-stress-state',
      subjectB10: 'exact-domain-short-video-selection', channelB10: 'communication-video-channel-selection',
      b14: 'durable-command-and-efference-copy', motor: 'LOCAL_RENDERER_STILL_INHIBITED',
      reafference: 'AWAITING_INDEPENDENT_YOUTUBE_OUTCOME' },
    boundaries: { modelCalled: false, rendererCalled: false, uploaderCalled: false,
      providerCalled: false, externalEffectAuthorized: false, liveMoney: false } };
}

function createHandler(deps) {
  deps = deps || {};
  var auth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405; res.setHeader('Allow', 'GET');
      return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
    }
    if (!auth.enforce(req, res)) return;
    try {
      var result = await run(deps); res.statusCode = result.ok ? 200 : 503;
      return res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'communication-video-cycle-unavailable',
        detail: String(error && error.message || error), providerCalled: false, liveMoney: false }));
    }
  };
}

var handler = createHandler();
var wrapped = require('../lib/heartbeat').wrap('communication-video-cycle', handler);
wrapped.createHandler = createHandler; wrapped.run = run; wrapped.one = one;
module.exports = wrapped;
