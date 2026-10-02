#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Decision = require('../lib/communication-social-decision.js');
var Executor = require('../lib/communication-social-executor.js');
var Observer = require('../lib/communication-social-outcome-observer.js');
var Learning = require('../lib/communication-social-learning.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.deleteIfValue = async function (key, value) {
  if (!this.map.has(key) || JSON.stringify(this.map.get(key)) !== JSON.stringify(value)) return 0;
  this.map.delete(key); return 1;
};
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: JSON.parse(JSON.stringify(value)) }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };
Store.prototype.lrange = async function (key, start, stop) { return structuredClone(this.log.filter(function (row) { return row.key === key; }).slice(start, stop < 0 ? undefined : stop + 1).map(function (row) { return row.value; })); };

function brain(domain, now) {
  return { ts: now, c: {
    domain: domain,
    immune: { immuneState: 'clear' },
    awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 } },
    serverPacket: {
      schemaVersion: 'civilization-domain-packet/1.0', packetId: domain + '-packet-' + now,
      domainId: domain, sourceType: 'server-cognition-refresh', generatedAt: new Date(now).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { stressScore: 0.4, activeDiagnoses: [], opportunities: [{ id: domain + '-opportunity' }], feedHealth: { live: 2 } }
    }
  } };
}

function candidate(now, text) {
  return {
    subjectDomain: 'law', text: text,
    sourceIdentity: { kind: 'limen-live-tool-response', value: 'https://limenhelix.com/api/law-tools',
      subjectDomain: 'law', retrievedAt: new Date(now).toISOString(), responseHash: 'a'.repeat(64) }
  };
}

function responsePost(likes) {
  return async function () {
    return { status: 200, json: async function () { return { posts: [{
      uri: 'at://did:plc:test/app.bsky.feed.post/communication-loop', cid: 'cid-loop',
      replyCount: 0, repostCount: 0, likeCount: likes, quoteCount: 0,
      indexedAt: '2026-09-29T02:01:30.470Z'
    }] }; } };
  };
}

(async function () {
  var now = Date.now(), store = new Store();
  var unsavedReads = 0;
  var unsaved = await Observer.observeOne(store, { uri: 'at://did:plc:test/app.bsky.feed.post/unsaved', cid: 'local-cid', commandId: 'unsaved' }, now, {
    fetch: async function () { unsavedReads++; return { status: 200, json: async function () { return { posts: [{ uri: 'at://did:plc:test/app.bsky.feed.post/unsaved', cid: 'local-cid' }] }; } }; }
  });
  assert.equal(unsaved.status, 'REFUSED'); assert.equal(unsavedReads, 0); assert.equal(store.map.size, 0);
  var firstCandidate = candidate(now, 'First source-backed fact.\nhttps://limenhelix.com/law');
  var cognition = { communication: brain('communication', now), law: brain('law', now) };
  var firstDecision = await Decision.decide(store, firstCandidate, now, { cognition: cognition });
  assert.equal(firstDecision.status, 'RELEASED');
  assert.equal(firstDecision.returnedOutcome.effect, 'NO_RETURNED_OUTCOME_YET');

  var posted = await Executor.execute({
    store: store,
    spec: { subjectDomain: 'law', text: firstCandidate.text, decisionReceipt: firstDecision },
    motorAuthorization: { authorize: async function () { return {
      authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'communication-loop-motor'
    }; } },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return {
      ok: true, uri: 'at://did:plc:test/app.bsky.feed.post/communication-loop', cid: 'cid-loop',
      url: 'https://bsky.app/profile/limenhelix/post/communication-loop'
    }; } },
    now: now + 1, nowFn: function () { return now + 1; }
  });
  assert.equal(posted.status, 'POSTED');
  assert.equal(posted.published, true);
  var command = await store.get(Executor.commandKey(posted.commandId));
  assert(command);
  now = Date.now();

  var commandPost = { uri: posted.uri, cid: posted.cid, commandId: posted.commandId }, noReads = 0;
  for (var bad of [
    [Executor.commandKey(command.commandId), { ownerDomain: 'culture' }],
    [Executor.commandKey(command.commandId), { status: 'DISPATCHING' }],
    [Executor.commandKey(command.commandId), { liveMoney: true }],
    [Executor.commandKey(command.commandId), { receipt: Object.assign({}, command.receipt, { readbackVerified: false }) }],
    [Decision.decisionKey(command.decisionReceiptId), { subjectDomain: 'finance' }],
    [Decision.decisionKey(command.decisionReceiptId), { contentHash: 'foreign' }],
    [Decision.decisionKey(command.decisionReceiptId), { status: 'NO_ACTION' }],
    [Decision.decisionKey(command.decisionReceiptId), { expiresAt: command.commandedAt }],
    [Learning.causeKey(command.commandId), { domain: 'law' }],
    [Learning.causeKey(command.commandId), { contentHash: 'foreign' }],
    [Executor.motorClaimKey(command.productMotorReceiptId), { commandId: 'foreign' }]
  ]) {
    var saved = structuredClone(await store.get(bad[0])); await store.set(bad[0], Object.assign({}, saved, bad[1]));
    var declined = await Observer.observeOne(store, commandPost, Date.now(), { fetch: async function () { noReads++; throw Error('invalid causal join reached AppView'); } });
    assert.equal(declined.status, 'REFUSED'); await store.set(bad[0], saved);
  }
  assert.equal(noReads, 0);
  var corrupt = new Store(); corrupt.map = new Map(Array.from(store.map, function (row) { return [row[0], structuredClone(row[1])]; }));
  var baseGet = corrupt.get; corrupt.get = async function (key) { var value = await baseGet.call(this, key); return key === Observer.observationKey(posted.uri) && value ? Object.assign({}, value, { engagementDelta: 999 }) : value; };
  await assert.rejects(Observer.observeOne(corrupt, commandPost, Date.now(), { fetch: responsePost(10) }), /receipt readback invalid/);
  assert.equal(corrupt.log.filter(function (row) { return row.key === Observer.LEARNING_PENDING_LOG_KEY; }).length, 0, 'failed observer readback cannot enqueue learning');
  for (var invalidPublic of [{ likeCount: -1 }, { indexedAt: new Date(Date.now() + 60000).toISOString() }]) {
    var before = store.log.length;
    var held = await Observer.observeOne(store, commandPost, Date.now(), { fetch: async function () { return { status: 200, json: async function () { return { posts: [Object.assign({ uri: posted.uri, cid: posted.cid }, invalidPublic)] }; } }; } });
    assert.equal(held.status, 'HELD'); assert.equal(store.log.length, before);
  }
  assert.equal((await Learning.recordObservation(store, command, { status: 'OBSERVED', observationId: 'forged', commandId: command.commandId, sourceIdentity: { kind: 'bluesky-appview-snapshot' }, postReceipt: command.receipt })).ok, false);
  now = Date.now();
  var firstObservation = await Observer.observeOne(store,
    { uri: posted.uri, cid: posted.cid, commandId: posted.commandId }, now,
    { fetch: responsePost(10) });
  assert.equal(firstObservation.status, 'OBSERVED');
  assert.equal((await Learning.recordObservation(store, command, firstObservation.receipt)).ok, true);

  await new Promise(function (resolve) { setTimeout(resolve, 2); });
  now = Date.now();
  var readonlyLearning = Object.create(store); readonlyLearning.set = async function () { throw Error('refused observation wrote learning'); };
  for (var changed of [{ commandId: 'foreign' }, { ownerDomain: 'law' }, { observedAt: Date.now() + 60000 },
    { observationId: 'forged' }, { engagementDelta: 999 }, { postReceipt: { uri: posted.uri, cid: 'foreign' } },
    { sourceIdentity: Object.assign({}, firstObservation.receipt.sourceIdentity, { endpointHost: 'foreign.invalid' }) },
    { metrics: Object.assign({}, firstObservation.receipt.metrics, { total: 999 }) }]) {
    var invalid = Object.assign({}, firstObservation.receipt, changed);
    assert.equal((await Learning.recordObservation(readonlyLearning, command, invalid)).ok, false);
    var savedObservation = structuredClone(await store.get(Observer.observationKey(posted.uri)));
    await store.set(Observer.observationKey(posted.uri), invalid);
    assert.equal((await Learning.recordObservation(readonlyLearning, command, invalid)).ok, false);
    await store.set(Observer.observationKey(posted.uri), savedObservation);
  }
  for (var priorChange of [{ commandId: 'foreign' }, { ownerDomain: 'law' }, { observedAt: Date.now() + 60000 },
    { metrics: Object.assign({}, firstObservation.receipt.metrics, { total: 300 }) },
    { postReceipt: { uri: posted.uri, cid: 'foreign' } },
    { sourceIdentity: Object.assign({}, firstObservation.receipt.sourceIdentity, { endpointHost: 'foreign.invalid' }) }]) {
    var priorKey = Observer.observationKey(posted.uri), originalPrior = structuredClone(await store.get(priorKey));
    await store.set(priorKey, Object.assign({}, originalPrior, priorChange));
    var before = JSON.stringify(Array.from(store.map)), beforeLogs = store.log.length;
    var baselineHeld = await Observer.observeOne(store, commandPost, Date.now(), { fetch: async function () { throw Error('invalid baseline reached public read'); } });
    assert.equal(baselineHeld.status, 'HELD'); assert.equal(baselineHeld.reason, 'prior-public-observation-invalid');
    assert.equal(JSON.stringify(Array.from(store.map)), before); assert.equal(store.log.length, beforeLogs);
    await store.set(priorKey, originalPrior);
  }
  now = firstObservation.receipt.observedAt;
  var negativeObservation = await Observer.observeOne(store,
    { uri: posted.uri, cid: posted.cid, commandId: posted.commandId }, now,
    { fetch: responsePost(0) });
  assert.equal(negativeObservation.status, 'OBSERVED');
  assert.equal(negativeObservation.receipt.engagementDelta, -10);
  assert.notEqual(negativeObservation.receipt.observationId, firstObservation.receipt.observationId, 'same-clock changed metrics must retain a distinct consequence');
  var learned = await Learning.recordObservation(store, command, negativeObservation.receipt);
  assert.equal(learned.ok, true);
  assert.equal(learned.signal.outcome, 'ENGAGEMENT_DECREASED');
  assert.equal(negativeObservation.receipt.identityVersion, 2);
  var recordsBeforeReplay = JSON.stringify(Array.from(store.map)), logsBeforeReplay = store.log.length;
  var exactReplay = await Observer.observeOne(store, commandPost, now, { fetch: responsePost(0) });
  assert.equal(exactReplay.duplicate, true); assert.deepEqual(exactReplay.receipt, negativeObservation.receipt);
  assert.equal(JSON.stringify(Array.from(store.map)), recordsBeforeReplay); assert.equal(store.log.length, logsBeforeReplay);
  assert.equal((await Learning.recordObservation(store, command, exactReplay.receipt)).duplicate, true);
  var legacy = structuredClone(firstObservation.receipt); delete legacy.identityVersion;
  legacy.observationId = 'cso_' + require('node:crypto').createHash('sha256').update(JSON.stringify({ uri: legacy.postReceipt.uri, cid: legacy.postReceipt.cid, indexedAt: legacy.indexedAt, at: legacy.observedAt })).digest('hex').slice(0, 24);
  var compatibility = new Store(); compatibility.map = new Map(Array.from(store.map, function (row) { return [row[0], structuredClone(row[1])]; }));
  compatibility.map.delete('communication_social_learning_state');
  await compatibility.set(Observer.observationKey(posted.uri), legacy);
  assert.equal((await Learning.recordObservation(compatibility, command, legacy)).ok, true);
  var legacyReplay = await Observer.observeOne(compatibility, commandPost, legacy.observedAt, { fetch: responsePost(10) });
  assert.equal(legacyReplay.duplicate, true); assert.deepEqual(legacyReplay.receipt, legacy);
  await compatibility.set(Observer.observationKey(posted.uri), negativeObservation.receipt);
  await compatibility.lpush(Observer.LEARNING_PENDING_LOG_KEY, legacy);
  assert.equal((await Learning.recordObservation(compatibility, command, legacy)).duplicate, true);
  var unknown = Object.assign({}, negativeObservation.receipt, { identityVersion: 99 });
  assert.equal((await Learning.recordObservation(store, command, unknown)).ok, false);
  assert.equal((await Learning.recordObservation(store, command, firstObservation.receipt)).duplicate, true, 'older exact pending snapshot remains replayable after current observation advances');
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 2);

  var nextDecision = await Decision.decide(store,
    candidate(now + 4, 'Revised source-backed fact after observed consequence.\nhttps://limenhelix.com/law'),
    now + 4, { cognition: { communication: brain('communication', now + 4), law: brain('law', now + 4) } });
  assert.equal(nextDecision.status, 'NO_ACTION');
  assert(nextDecision.blockers.includes('communication-returned-outcome-requires-reassessment'));
  assert.equal(nextDecision.returnedOutcome.status, 'OBSERVED');
  assert.equal(nextDecision.returnedOutcome.signalOutcome, 'ENGAGEMENT_DECREASED');
  assert.equal(nextDecision.returnedOutcome.effect, 'HOLD_FOR_NEW_COMMUNICATION_EVIDENCE');
  assert.equal(nextDecision.returnedOutcome.actionId, command.commandId);

  await require('./assert-business-trace.cjs')(store, 'communication', command, 'PLATFORM-POST', now + 1000, nextDecision.communicationPacketId);
  // Actual executor ambiguity: reconciliation reads the public record without posting again.
  var ambiguityStore = new Store(), at = Date.now(), recoveryCandidate = candidate(at, 'LOCAL ambiguous source-backed post.\nhttps://limenhelix.com/law');
  var recoveryDecision = await Decision.decide(ambiguityStore, recoveryCandidate, at, { cognition: { communication: brain('communication', at), law: brain('law', at) } });
  var postAttempts = 0;
  var ambiguous = await Executor.execute({ store: ambiguityStore, now: at, spec: { subjectDomain: 'law', text: recoveryCandidate.text, decisionReceipt: recoveryDecision },
    motorAuthorization: { authorize: async function () { return { authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'LOCAL-reconcile-motor' }; } },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { postAttempts++; return { ok: false, reason: 'LOCAL ambiguous network response' }; } } });
  assert.equal(ambiguous.status, 'DISPATCHING');
  var pendingCommand = structuredClone(await ambiguityStore.get(Executor.commandKey(ambiguous.commandId))), authorReads = 0;
  var recoveredPost = { uri: 'at://did:plc:local/app.bsky.feed.post/reconciled', cid: 'LOCAL-reconciled', record: { text: recoveryCandidate.text, createdAt: new Date(at).toISOString() } };
  var readFeed = async function () { authorReads++; return { status: 200, json: async function () { return { feed: [{ post: recoveredPost }] }; } }; };
  for (var mismatch of [
    [Executor.commandKey(pendingCommand.commandId), { ownerDomain: 'law' }],
    [Executor.commandKey(pendingCommand.commandId), { liveMoney: true }],
    [Executor.commandKey(pendingCommand.commandId), { commandedAt: Date.now() + 60000 }],
    [Decision.decisionKey(pendingCommand.decisionReceiptId), { subjectDomain: 'culture' }],
    [Learning.causeKey(pendingCommand.commandId), { contentHash: 'foreign' }],
    [Executor.motorClaimKey(pendingCommand.productMotorReceiptId), { commandId: 'foreign' }]
  ]) {
    var original = structuredClone(await ambiguityStore.get(mismatch[0])); await ambiguityStore.set(mismatch[0], Object.assign({}, original, mismatch[1]));
    var declined = await Observer.reconcilePending(ambiguityStore, [pendingCommand], 'LOCAL-handle', Date.now(), { fetch: readFeed });
    assert.equal(declined.reconciled, 0); await ambiguityStore.set(mismatch[0], original);
  }
  assert.equal(authorReads, 0);
  var duplicateMatches = await Observer.reconcilePending(ambiguityStore, [pendingCommand], 'LOCAL-handle', Date.now(), { fetch: async function () { return { status: 200, json: async function () { return { feed: [{ post: recoveredPost }, { post: Object.assign({}, recoveredPost, { uri: recoveredPost.uri + '-other' }) }] }; } }; } });
  assert.equal(duplicateMatches.reconciled, 0);
  var futureMatch = await Observer.reconcilePending(ambiguityStore, [pendingCommand], 'LOCAL-handle', Date.now(), { fetch: async function () { return { status: 200, json: async function () { return { feed: [{ post: Object.assign({}, recoveredPost, { record: { text: recoveryCandidate.text, createdAt: new Date(Date.now() + 10000).toISOString() } }) }] }; } }; } });
  assert.equal(futureMatch.reconciled, 0);
  var raceStore = new Store(); raceStore.map = new Map(Array.from(ambiguityStore.map, function (row) { return [row[0], structuredClone(row[1])]; }));
  var raced = await Observer.reconcilePending(raceStore, [pendingCommand], 'LOCAL-handle', Date.now(), { fetch: async function () {
    await raceStore.set(Executor.commandKey(pendingCommand.commandId), Object.assign({}, pendingCommand, { status: 'FAILED' }));
    return { status: 200, json: async function () { return { feed: [{ post: recoveredPost }] }; } };
  } });
  assert.equal(raced.reconciled, 0); assert.equal((await raceStore.get(Executor.commandKey(pendingCommand.commandId))).status, 'FAILED');
  var readbackStore = new Store(); readbackStore.map = new Map(Array.from(ambiguityStore.map, function (row) { return [row[0], structuredClone(row[1])]; }));
  var originalGet = readbackStore.get; readbackStore.get = async function (key) { var value = await originalGet.call(this, key);
    return key === Executor.commandKey(pendingCommand.commandId) && value && value.status === 'POSTED' ? Object.assign({}, value, { subjectDomain: 'foreign' }) : value; };
  await assert.rejects(Observer.reconcilePending(readbackStore, [pendingCommand], 'LOCAL-handle', Date.now(), { fetch: readFeed }), /reconciled command readback invalid/);
  assert.equal(readbackStore.log.length, 0, 'bad recovered readback cannot append a posted command index');
  authorReads = 0;
  var recovered = await Observer.reconcilePending(ambiguityStore, [pendingCommand, pendingCommand], 'LOCAL-handle', Date.now(), { fetch: readFeed });
  assert.equal(recovered.reconciled, 1); assert.equal(authorReads, 1); assert.equal(recovered.commands.length, 1);
  var recoveredCommand = structuredClone(await ambiguityStore.get(Executor.commandKey(pendingCommand.commandId)));
  assert.equal(recoveredCommand.receipt.reconciledFromPublicAppView, true);
  var replay = await Observer.reconcilePending(ambiguityStore, [pendingCommand], 'LOCAL-handle', Date.now(), { fetch: async function () { throw Error('confirmed pending replay reread provider'); } });
  assert.equal(replay.commands.length, 1); assert.equal(replay.reconciled, 0); assert.equal(postAttempts, 1);
  var independentlyObserved = await Observer.observeOne(ambiguityStore, recovered.receipts[0], Date.now(), { fetch: async function () { return { status: 200, json: async function () { return { posts: [Object.assign({}, recoveredPost, { likeCount: 1, indexedAt: new Date(at).toISOString() })] }; } }; } });
  assert.equal(independentlyObserved.status, 'OBSERVED'); assert.equal((await Learning.recordObservation(ambiguityStore, recoveredCommand, independentlyObserved.receipt)).ok, true);
  var qualifiedStore = new Store(), qualifiedReads = 0, notReady;
  var storePath = require.resolve('../lib/autofire-efference-store.js'), handlerPath = require.resolve('../handlers/product-domain-learning-state.js');
  var oldStoreModule = require.cache[storePath], oldHandlerModule = require.cache[handlerPath];
  async function readEndpoint(proofStore) {
    var readonly = Object.create(proofStore);
    ['set','setIfAbsent','lpush','ltrim','del'].forEach(function (method) { readonly[method] = async function () { throw Error('Communication endpoint attempted write'); }; });
    require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: readonly }; delete require.cache[handlerPath];
    var body, res = { setHeader: function () {}, end: function (text) { body = JSON.parse(text); } };
    await require(handlerPath)({ method: 'GET', url: '/api/product-domain-learning-state?domain=communication' }, res);
    assert.equal(res.statusCode, 200); return body;
  }
  try {
    for (var i = 0; i < 5; i++) {
      var at = Date.now(), proofCandidate = candidate(at, 'LOCAL independent post ' + i + '.\nhttps://limenhelix.com/law');
      var decision = await Decision.decide(qualifiedStore, proofCandidate, at, { cognition: { communication: brain('communication', at), law: brain('law', at) } });
      assert.equal(decision.status, 'RELEASED');
      var uri = 'at://did:plc:local/app.bsky.feed.post/qualified-' + i, cid = 'LOCAL-cid-' + i;
      var issued = await Executor.execute({ store: qualifiedStore, spec: { subjectDomain: 'law', text: proofCandidate.text, decisionReceipt: decision }, now: at,
        motorAuthorization: { authorize: async function () { return { authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'LOCAL-motor-' + i }; } },
        adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
        platform: { postToBluesky: async function () { return { ok: true, uri: uri, cid: cid, url: 'https://bsky.app/profile/local/post/qualified-' + i }; } } });
      assert.equal(issued.status, 'POSTED'); var proofCommand = await qualifiedStore.get(Executor.commandKey(issued.commandId));
      var observed = await Observer.observeOne(qualifiedStore, { uri: uri, cid: cid, commandId: issued.commandId }, Date.now(), {
        fetch: async function () { qualifiedReads++; return { status: 200, json: async function () { return { posts: [{ uri: uri, cid: cid, likeCount: 1, indexedAt: new Date(at).toISOString() }] }; } }; } });
      assert.equal(observed.status, 'OBSERVED'); assert.equal((await Learning.recordObservation(qualifiedStore, proofCommand, observed.receipt)).ok, true);
      assert.equal((await Learning.recordObservation(qualifiedStore, proofCommand, observed.receipt)).duplicate, true);
      if (i === 0) notReady = await readEndpoint(qualifiedStore);
    }
    var ready = await readEndpoint(qualifiedStore), empty = await readEndpoint(new Store());
    assert.equal(qualifiedReads, 5); assert.equal(ready.resolvedCount, 5); assert.equal(ready.learningGate.ready, true);
    assert.equal(ready.learningGate.distinctPosts, 5); assert.equal(ready.learningGate.minimumDistinctPosts, 2); assert.equal(ready.learningGate.distinctSources, undefined);
    assert.equal(notReady.learningGate.ready, false); assert.equal(empty.signal, null);
    var nativeCycle = require('./fixtures/publication-native-cycle.cjs'), fixedAt = Date.now() + 1000;
    var admittedNative = await nativeCycle('communication', ready, fixedAt), emptyNative = await nativeCycle('communication', empty, fixedAt), notReadyNative = await nativeCycle('communication', notReady, fixedAt);
    assert.equal(admittedNative.externalRewardEligible, false); assert.deepEqual(admittedNative.learning.learningGate, ready.learningGate);
    for (var result of [admittedNative, emptyNative, notReadyNative]) assert.equal(result.plasticity.rewardActive, false);
    assert.deepEqual(admittedNative.evaluated, emptyNative.evaluated); assert.deepEqual(notReadyNative.evaluated, emptyNative.evaluated);
    for (var view of [ready, notReady, empty]) {
      var output = { innerHTML: '' }, ui = { addEventListener: function () {} }, projected = require('../lib/brain-cognition-compact.js').learningReadout(view);
      require('node:vm').runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname, '../assets/js/civilization/execution-observatory.js'), 'utf8'), {
        window: ui, document: { readyState: 'loading', addEventListener: function () {}, getElementById: function (id) { return id === 'execution-observatory' ? output : null; } },
        Date: Date, setInterval: function () {}, fetch: async function (url) { return { ok: true, json: async function () { return url.includes('brain-cognition') ? { cognition: { communication: { ts: Date.now(), c: { brainOrgans: { externalActionLearning: projected } } } } } : {}; } }; }
      });
      await ui.LIMENExecutionObservatory.refresh();
      var card = output.innerHTML.split('<span class="exo-domain-name">communication</span>')[1].split('</article>')[0];
      assert.match(card, new RegExp('distinct posts ' + view.learningGate.distinctPosts + '/2')); assert.doesNotMatch(card, /distinct sources/);
    }
    console.log('Communication actual qualified native return', JSON.stringify({ evidence: 'LOCAL/FIXTURE', commands: 5, resolved: ready.resolvedCount, posts: ready.learningGate.distinctPosts, ready: true, rewardActive: false, sameEvaluation: true }));
  } finally {
    if (oldStoreModule) require.cache[storePath] = oldStoreModule; else delete require.cache[storePath];
    if (oldHandlerModule) require.cache[handlerPath] = oldHandlerModule; else delete require.cache[handlerPath];
  }
  console.log('communication social loop: decision -> posted receipt -> independent AppView observation -> returned negative learning -> next decision hold and business trace PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
