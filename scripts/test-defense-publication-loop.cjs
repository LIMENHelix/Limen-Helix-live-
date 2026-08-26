#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var Source = require('../lib/defense-publication-source.js');
var Decision = require('../lib/defense-publication-decision.js');
var Executor = require('../lib/defense-publication-executor.js');
var Publisher = require('../lib/defense-publication-publisher.js');
var Observer = require('../lib/defense-publication-observer.js');
var Learning = require('../lib/defense-publication-learning.js');
var Recovery = require('../lib/defense-publication-recovery.js');

function memory() {
  var data = new Map(), lists = new Map();
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  return {
    assertDurable: function () { return true; },
    get: async function (key) { return data.has(key) ? clone(data.get(key)) : null; },
    set: async function (key, value) { data.set(key, clone(value)); return true; },
    setIfAbsent: async function (key, value) { if (data.has(key)) return false; data.set(key, clone(value)); return true; },
    del: async function (key) { return data.delete(key) ? 1 : 0; },
    lpush: async function (key, value) { var list = lists.get(key) || []; list.unshift(clone(value)); lists.set(key, list); return list.length; },
    ltrim: async function (key, start, end) { lists.set(key, (lists.get(key) || []).slice(start, end + 1)); return true; },
    lrange: async function (key, start, end) { return clone((lists.get(key) || []).slice(start, end + 1)); }
  };
}

function titleSets(now) {
  return [
    { t: now - 1000, d: 'defense', f: 'CISA', hh: 11, items: [
      { i: 0, ti: 'CISA publishes a new public advisory', au: 'https://example.test/cisa-1', pa: now - 2000, pl: 'CISA' },
      { i: 1, ti: 'A second public cyber record', au: 'https://example.test/cisa-2', pa: now - 2500, pl: 'CISA' }
    ] },
    { t: now - 2000, d: 'defense', f: 'NATO', hh: 22, items: [
      { i: 0, ti: 'NATO posts a readiness update', au: 'https://example.test/nato-1', pa: now - 3000, pl: 'NATO' },
      { i: 1, ti: 'An alliance exercise record', au: 'https://example.test/nato-2', pa: now - 3500, pl: 'NATO' }
    ] }
  ];
}

function cognition(now) {
  return {
    ts: now,
    c: {
      domain: 'defense',
      immune: { immuneState: 'clear' },
      awareness: { humanReviewRequired: false },
      brainOrgans: {
        autonomousInternalEmission: { holdReason: null, emittedCount: 1 },
        resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } }
      },
      serverPacket: {
        schemaVersion: 'civilization-domain-packet/1.0', domainId: 'defense', packetId: 'defense:7:snapshot-1',
        generatedAt: new Date(now).toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' },
        truth: {
          stressScore: 0.42, phase: 'WATCH', feedHealth: { live: 6 },
          activeDiagnoses: [{ id: 'CYBER_ATTACK', label: 'Cyber attack', relevance: 0.7 }],
          opportunities: [{ id: 'def-research-1', title: 'Review cyber readiness sources', path: 'RESEARCHABLE', held: false }]
        }
      }
    }
  };
}

(async function () {
  var now = Date.now(), store = memory(), brain = cognition(now);
  assert.equal(Source.build([titleSets(now)[0]], brain, now), null, 'one feed cannot author the brief');
  var candidate = Source.build(titleSets(now), brain, now);
  assert(Source.validate(candidate));
  assert.equal(candidate.sources.length, 4);
  assert.match(candidate.disclaimer, /does not independently verify events/);
  assert.equal(candidate.brainSelection.id, 'def-research-1');

  var decision = await Decision.decide(store, candidate, now, brain);
  assert.equal(decision.status, 'RELEASED');
  var held = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 1,
    motorAuthorization: { authorize: async function () { throw new Error('cost gate must precede motor'); } },
    dailyBudgetUsd: 0, dailyPublicationCap: 1 });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'defense-publication-operation-cost-not-configured');

  var motorNumber = 0;
  var motor = { authorize: async function () { return { authorized: true, receiptId: 'def_motor_' + (++motorNumber) }; } };
  var command = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 2,
    motorAuthorization: motor, operationCostUsd: 0, dailyBudgetUsd: 0, dailyPublicationCap: 1 });
  assert.equal(command.status, 'PUBLISHED');
  assert.equal(command.durableReceiptReadbackVerified, true);
  assert.equal(command.providerCalls, 0);
  var article = await Publisher.getPublic(store, command.articleId);
  assert.equal(article.contentHash, candidate.contentHash);
  assert.equal((await Publisher.listPublic(store, 20)).length, 1);

  var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 3,
    motorAuthorization: motor, operationCostUsd: 0, dailyBudgetUsd: 0, dailyPublicationCap: 1 });
  assert.equal(replay.replayed, true);
  assert.equal((await Publisher.listPublic(store, 20)).length, 1, 'same source fingerprint must not publish twice');

  var presence = await Observer.observePresence(store, command, async function (url, options) {
    assert.match(url, /defense-publication-public\?id=/);
    assert.equal(options.method, 'GET');
    return { ok: true, status: 200, json: async function () { return { ok: true, article: { articleId: command.articleId, contentHash: command.contentHash } }; } };
  }, 'https://limenhelix.test');
  assert.equal(presence.status, 'PUBLIC_PRESENCE_OBSERVED');
  var presenceAgain = await Observer.observePresence(store, command, async function () {
    return { ok: true, status: 200, json: async function () { return { ok: true, article: { articleId: command.articleId, contentHash: command.contentHash } }; } };
  }, 'https://limenhelix.test');
  assert.equal(presenceAgain.observationId, presence.observationId);
  assert.equal((await store.lrange(Observer.LOG_KEY, 0, 99)).filter(function (row) { return row.status === 'PUBLIC_PRESENCE_OBSERVED'; }).length, 1,
    'hourly public-presence reads must not duplicate the observation log');
  var presenceLearning = await Learning.recordObservation(store, presence);
  assert.equal(presenceLearning.ok, false, 'public presence is a receipt, not engagement');

  var bot = await Observer.recordSourceClick(store, article, 0, 'visitor-bot', { 'user-agent': 'curl/8', accept: '*/*' }, now + 4);
  assert.equal(bot.event.engagementEligible, false);
  assert.equal(bot.event.trafficClassification, 'non-eligible-automated-or-unverified-request');
  var byAction = {}; byAction[command.actionId] = command;
  var botObservation = await Observer.observeEngagement(store, bot.event, byAction);
  assert.equal((await Learning.recordObservation(store, botObservation)).ok, false, 'bot-like clicks must not train Defense');

  var click = await Observer.recordSourceClick(store, article, 1, 'visitor-human', {
    'user-agent': 'Mozilla/5.0 (Test Browser)', accept: 'text/html,application/xhtml+xml',
    'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'sec-fetch-user': '?1'
  }, now + 5);
  assert.equal(click.event.engagementEligible, true);
  assert.equal(click.event.trafficClassification, 'user-activated-browser-request-unverified-human');
  assert.equal(click.redirectUrl, article.sources[1].url);
  var clickObservation = await Observer.observeEngagement(store, click.event, byAction);
  assert.equal(clickObservation.status, 'SOURCE_CLICK_OBSERVED');
  assert.equal(clickObservation.independentOfPublishResponse, true);
  assert.equal(clickObservation.trafficClassification, 'user-activated-browser-request-unverified-human');
  var learned = await Learning.recordObservation(store, clickObservation);
  assert.equal(learned.resolvedCount, 1);
  assert.equal((await Learning.readForBrain(store)).learningGate.ready, false);

  var ambiguousStore = memory(), ambiguousDecision = await Decision.decide(ambiguousStore, candidate, now, brain), attempts = 0;
  var ambiguous = await Executor.execute({ store: ambiguousStore, candidate: candidate, decision: ambiguousDecision, now: now + 5,
    motorAuthorization: motor, operationCostUsd: 0, dailyBudgetUsd: 0, dailyPublicationCap: 9,
    publisher: { publish: async function () { attempts++; throw new Error('storage acknowledgement lost'); } } });
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  var ambiguousReplay = await Executor.execute({ store: ambiguousStore, candidate: candidate, decision: ambiguousDecision, now: now + 6,
    motorAuthorization: motor, operationCostUsd: 0, dailyBudgetUsd: 0, dailyPublicationCap: 9,
    publisher: { publish: async function () { attempts++; return { ok: true, articleId: 'should-not-run' }; } } });
  assert.equal(ambiguousReplay.replayed, true);
  assert.equal(attempts, 1, 'ambiguous public writes must not be retried blindly');

  var recovery = await Recovery.recover({ store: store, command: command, observation: presence,
    trigger: { type: 'defense-publication-policy', id: 'policy-test' }, now: now + 6, motorAuthorization: motor,
    observePublicAbsence: async function (articleId) { assert.equal(articleId, command.articleId); return true; } });
  assert.equal(recovery.status, 'UNPUBLISHED_VERIFIED');
  assert.equal(recovery.independentPublicAbsenceVerified, true);
  assert.equal(await Publisher.getPublic(store, command.articleId), null);

  var page = fs.readFileSync('defense-briefs.html', 'utf8');
  assert.match(page, /defense-publication-public/);
  assert.match(page, /defense-publication-engagement/);
  assert.match(page, /do not independently verify events/);
  console.log('defense publication: sovereign evidence, B10/B14 public receipt, independent human-like click learning, and verified unpublish passed');
})().catch(function (error) { console.error(error); process.exit(1); });
