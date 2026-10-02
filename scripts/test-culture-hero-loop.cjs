'use strict';
var assert = require('node:assert/strict');
var Policy = require('../lib/culture-hero-policy.js');
var Decision = require('../lib/culture-hero-decision.js');
var Executor = require('../lib/culture-hero-executor.js');
var Observer = require('../lib/culture-hero-outcome-observer.js');
var Recovery = require('../lib/culture-hero-recovery.js');
var Learning = require('../lib/culture-hero-learning.js');
var Trace = require('../lib/culture-business-trace-readout.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };
function cognition(now) { return { ts: now, c: { domain: 'culture', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
  brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'culture', packetId: 'culture-packet-1', generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 16, live: 15 } } } } }; }
function motor(receipt) { return { authorize: async function () { return { authorized: true, receiptId: receipt, productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image' }; } }; }

(async function () {
  var now = Date.now(), candidate = Policy.candidate('culture', 'test-model', 'missing-public-hero');
  var unsavedReads = 0, unsavedStore = new Store();
  var unsaved = await Observer.observe(unsavedStore, { schemaVersion: Executor.SCHEMA, status: 'GENERATED', commandId: 'LOCAL-unsaved',
    assetDomain: 'culture', receipt: { url: 'https://x.ai/LOCAL-image' } }, { fetch: async function () {
      unsavedReads++; return { status: 200, headers: { get: function () { return 'image/png'; } }, arrayBuffer: async function () { return Buffer.from('LOCAL-image'); } };
    } });
  assert.equal(unsaved.status, 'REFUSED'); assert.equal(unsavedReads, 0); assert.equal(unsavedStore.values.size, 0);
  assert.equal(Policy.validate(candidate), true);
  assert.equal(Policy.validate(Object.assign({}, candidate, { prompt: 'arbitrary prompt' })), false);

  var store = new Store();
  var stale = await Decision.decide(store, candidate, now, { cognition: cognition(now - Decision.MAX_COGNITION_AGE_MS - 1) });
  assert.equal(stale.status, 'NO_ACTION');
  assert.equal(stale.providerCalled, false);
  var released = await Decision.decide(store, candidate, now, { cognition: cognition(now) });
  assert.equal(released.status, 'RELEASED');
  assert.equal(Decision.validateReceipt(released, candidate, now), true);
  assert.equal(released.immuneRouting.route,'PASS');
  const legacy={...released};delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy,candidate,now),false);
  for(const scenario of [
    {route:'HOLD',immune:{immuneState:'watch',allowedWithWarning:true}},
    {route:'HOLD',immune:{immuneState:'clear',quarantines:['untrusted-source']}},
    {route:'QUARANTINE',immune:{immuneState:'alert'}},
    {route:'QUARANTINE',immune:{immuneState:'clear',candidateQuarantined:true}},
    {route:'REJECT',immune:null}
  ]) {
    const isolated=new Store();const current=cognition(now);current.c.immune=scenario.immune;
    const held=await Decision.decide(isolated,candidate,now,{cognition:current});
    assert.equal(held.immuneRouting.route,scenario.route);assert.equal(held.status,'NO_ACTION');
    assert.equal(held.immuneRouting.candidatePreserved,true);assert.equal(Decision.validateReceipt(held,candidate,now),false);
    assert.deepEqual(await Decision.decide(isolated,candidate,now,{cognition:current}),held);
    assert.equal((await isolated.lrange(Decision.LOG_KEY,0,19)).length,1);
    const observed=await Trace.read(isolated,now);assert.equal(observed.decision.immuneRoute,scenario.route);
    assert.equal(observed.command,null);assert.equal(observed.externalActionAuthorized,false);
    assert.equal((await Decision.decide(isolated,candidate,now+1,{cognition:cognition(now+1)})).status,'RELEASED');
    assert.equal((await isolated.get(Decision.key(held.decisionReceiptId))).immuneRouting.route,scenario.route);
  }


  var heldStore = new Store(), heldDecision = await Decision.decide(heldStore, candidate, now, { cognition: cognition(now) });
  var heldProviderCalls = 0;
  var motorHeld = await Executor.execute({ store: heldStore, candidate: candidate, decision: heldDecision, now: now,
    motorAuthorization: { authorize: async function () { return { authorized: false, reason: 'culture-switch-off', receiptId: 'held-motor' }; } },
    provider: { generate: async function () { heldProviderCalls++; } } });
  assert.equal(motorHeld.status, 'HELD'); assert.equal(heldProviderCalls, 0);

  var calls = 0, sawCommandBeforeCall = false;
  var executed = await Executor.execute({ store: store, candidate: candidate, decision: released, now: now,
    motorAuthorization: motor('culture-motor-1'), provider: { generate: async function () {
      calls++; sawCommandBeforeCall = Array.from(store.values.values()).some(function (v) { return v && v.status === 'DISPATCHING'; });
      return { ok: true, url: 'https://assets.example/culture.jpg', requestId: 'provider-1', spentUsd: 0.02 };
    } } });
  assert.equal(executed.status, 'GENERATED');
  assert.equal(executed.readbackVerified, true);
  assert.equal(sawCommandBeforeCall, true);
  assert(await store.get(Learning.causeKey(executed.commandId)));
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: released, now: now,
    motorAuthorization: motor('culture-motor-1'), provider: { generate: async function () { calls++; } } });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);

  var savedCommand = await store.get(Executor.commandKey(executed.commandId));
  var savedCause = await store.get(Learning.causeKey(executed.commandId));
  var savedMotor = await store.get(Executor.motorClaimKey(executed.productMotorReceiptId));
  var publicReads = 0;
  var publicFetch = async function () { publicReads++; return { status: 200,
    headers: { get: function (name) { return name === 'content-type' ? 'image/jpeg' : null; } }, arrayBuffer: async function () { return Buffer.from('image-bytes'); } }; };
  for (var entry of [
    [Executor.commandKey(executed.commandId), savedCommand, [{ ownerDomain: 'finance' }, { status: 'AMBIGUOUS' }, { liveMoney: true }, { readbackVerified: false }, { providerAccepted: false }, { receipt: { url: 'https://assets.example/foreign.jpg' } }]],
    [Decision.key(released.decisionReceiptId), released, [{ ownerDomain: 'finance' }, { assetDomain: 'energy' }, { promptHash: 'wrong' }, { status: 'NO_ACTION' }, { expiresAt: savedCommand.commandedAt }]],
    [Learning.causeKey(executed.commandId), savedCause, [{ schemaVersion: 'foreign/1' }, { domain: 'finance' }, { promptHash: 'wrong' }, { assetDomain: 'energy' }, { decisionReceiptId: 'wrong' }]],
    [Executor.motorClaimKey(executed.productMotorReceiptId), savedMotor, [{ commandId: 'wrong' }, { decisionReceiptId: 'wrong' }, { productMotorReceiptId: 'wrong' }]]
  ]) {
    for (var changed of entry[2]) {
      await store.set(entry[0], Object.assign({}, entry[1], changed));
      var beforeRefusal = JSON.stringify([Array.from(store.values), Array.from(store.lists)]), oldReads = publicReads;
      var refusedObservation = await Observer.observe(store, executed, { allowAnyHttpsForTest: true, fetch: publicFetch });
      assert.equal(refusedObservation.reason, 'culture-hero-command-causal-join-invalid');
      assert.equal(publicReads, oldReads); assert.equal(JSON.stringify([Array.from(store.values), Array.from(store.lists)]), beforeRefusal);
    }
    await store.set(entry[0], entry[1]);
  }
  var forged = { observationId: 'LOCAL-forged', commandId: executed.commandId, status: 'OBSERVED_PRESENT', assetDomain: 'culture',
    observedAt: Date.now(), publicUrl: executed.receipt.url, contentSha256: 'a'.repeat(64) };
  assert.equal((await Learning.recordObservation(store, forged)).ok, false);
  assert.equal(await store.get(Learning.STATE_KEY), null, 'cause existence alone cannot admit learning');

  var observed = await Observer.observe(store, executed, { allowAnyHttpsForTest: true, fetch: publicFetch });
  assert.equal(observed.status, 'OBSERVED_PRESENT');
  assert.equal(observed.independentReadPath, true);
  assert.equal(observed.generationEndpointCalled, false);
  var noWrites = Object.create(store); ['set', 'setIfAbsent', 'lpush', 'ltrim'].forEach(function (method) {
    noWrites[method] = async function () { throw Error('unadmitted observation reached learning write'); };
  });
  for (var change of [{ observationId: 'wrong' }, { commandId: 'wrong' }, { assetDomain: 'energy' }, { publicUrl: 'https://assets.example/foreign.jpg' },
    { observedAt: Date.now() + 60000 }, { independentReadPath: false }, { generationEndpointCalled: true }, { contentSha256: 'wrong' }, { bytes: observed.bytes + 1 }]) {
    var invalid = Object.assign({}, observed, change);
    assert.equal((await Learning.recordObservation(noWrites, invalid)).ok, false, JSON.stringify(change));
    await store.set(Observer.key(executed.commandId), invalid);
    assert.equal((await Learning.recordObservation(noWrites, invalid)).ok, false, 'corrupt persisted observation cannot qualify');
    await store.set(Observer.key(executed.commandId), observed);
  }
  var wrongCause = Object.assign({}, savedCause, { assetDomain: 'energy' }); await store.set(Learning.causeKey(executed.commandId), wrongCause);
  assert.equal((await Learning.recordObservation(noWrites, observed)).ok, false);
  await store.set(Learning.causeKey(executed.commandId), savedCause);
  var corruptReadback = Object.create(store); corruptReadback.get = async function (k) { var row = await store.get(k); return k === Observer.key(executed.commandId) && row ? Object.assign({}, row, { assetDomain: 'energy' }) : row; };
  var oldPublicReads = publicReads;
  assert.equal((await Observer.observe(corruptReadback, executed, { allowAnyHttpsForTest: true, fetch: publicFetch })).reason, 'culture-hero-observation-readback-invalid');
  assert.equal(publicReads, oldPublicReads);
  assert.deepEqual(await Observer.observe(store, executed, { allowAnyHttpsForTest: true, fetch: publicFetch }), observed);
  assert.equal(publicReads, oldPublicReads, 'valid cached observation replays without another read');
  assert.equal((await Learning.recordObservation(store, observed)).ok, true);
  assert.equal((await Learning.recordObservation(store, observed)).duplicate, true);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 1);
  assert.equal((await Learning.readForBrain(store)).status, 'ELIGIBLE');
  var reaffirmed = await Decision.decide(store, candidate, now + 1, { cognition: cognition(now + 1) });
  assert.equal(reaffirmed.status, 'RELEASED');
  assert.equal(reaffirmed.returnedOutcome.status, 'OBSERVED');
  assert.equal(reaffirmed.returnedOutcome.signalOutcome, 'PUBLIC_ASSET_RETRIEVABLE');
  assert.equal(reaffirmed.returnedOutcome.effect, 'CONSUMED_AS_CULTURE_AFFERENT');

  var invalidCandidate = Policy.candidate('culture', 'test-model', 'missing-public-hero-2');
  var invalidDecision = await Decision.decide(store, invalidCandidate, now + 2, { cognition: cognition(now + 2) });
  assert.equal(invalidDecision.status, 'RELEASED');
  var invalidGenerated = await Executor.execute({ store: store, candidate: invalidCandidate, decision: invalidDecision, now: now + 2,
    motorAuthorization: motor('culture-motor-4'), provider: { generate: async function () {
      return { ok: true, url: 'https://assets.example/culture-invalid.jpg', requestId: 'provider-invalid', spentUsd: 0.02 };
    } } });
  assert.equal(invalidGenerated.status, 'GENERATED');
  var invalidObserved = await Observer.observe(store, invalidGenerated, { allowAnyHttpsForTest: true, fetch: async function () { return {
    status: 404, headers: { get: function (name) { return name === 'content-type' ? 'text/plain' : null; } },
    arrayBuffer: async function () { return Buffer.from('not an image'); }
  }; } });
  assert.equal(invalidObserved.status, 'OBSERVED_ABSENT_OR_INVALID');
  assert.equal((await Learning.recordObservation(store, invalidObserved)).ok, true);
  var heldAfterNegative = await Decision.decide(store,
    Policy.candidate('culture', 'test-model', 'missing-public-hero-3'), now + 3, { cognition: cognition(now + 3) });
  assert.equal(heldAfterNegative.status, 'NO_ACTION');
  assert(heldAfterNegative.blockers.includes('culture-returned-outcome-requires-reassessment'));
  assert.equal(heldAfterNegative.returnedOutcome.signalOutcome, 'PUBLIC_ASSET_INVALID_OR_ABSENT');
  assert.equal(heldAfterNegative.returnedOutcome.effect, 'HOLD_FOR_NEW_CULTURE_EVIDENCE');

  var recovered = await Recovery.recover({ store: store, command: executed, observation: observed,
    trigger: { type: 'culture-policy', id: 'policy-event-1' }, motorAuthorization: motor('culture-motor-2'), now: now + 1,
    observePublicCatalog: async function () { return { ok: true, images: {} }; } });
  assert.equal(recovered.status, 'SUPPRESSED');
  assert.equal(recovered.strictSuppressionReadback, true);
  assert.equal(recovered.independentPublicAbsenceVerified, true);
  var catalog = await store.get(Recovery.CATALOG_KEY); assert.equal(catalog.culture.suppressed, true);

  var ambiguousStore = new Store();
  var decision2 = await Decision.decide(ambiguousStore, candidate, now, { cognition: cognition(now) });
  var ambiguousCalls = 0;
  var ambiguous = await Executor.execute({ store: ambiguousStore, candidate: candidate, decision: decision2, now: now,
    motorAuthorization: motor('culture-motor-3'), provider: { generate: async function () { ambiguousCalls++; throw new Error('response lost'); } } });
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  var noRetry = await Executor.execute({ store: ambiguousStore, candidate: candidate, decision: decision2, now: now,
    motorAuthorization: motor('culture-motor-3'), provider: { generate: async function () { ambiguousCalls++; } } });
  assert.equal(noRetry.replayed, true); assert.equal(noRetry.status, 'AMBIGUOUS'); assert.equal(ambiguousCalls, 1);

  var beforeTrace = JSON.stringify([Array.from(store.values), Array.from(store.lists)]);
  var trace = await Trace.read(store, now + 10);
  assert.equal(trace.status, 'RECORDED');
  assert.equal(trace.decision.id, heldAfterNegative.decisionReceiptId);
  assert.equal(trace.decision.status, 'NO_ACTION');
  assert.equal(trace.command.id, invalidGenerated.commandId);
  assert.equal(trace.command.decisionId, invalidDecision.decisionReceiptId);
  assert.equal(trace.command.providerReceiptId, 'provider-invalid');
  assert.equal(trace.externalActionAuthorized, false);
  assert.equal(JSON.stringify([Array.from(store.values), Array.from(store.lists)]), beforeTrace, 'trace reader must not mutate any ledger');
  assert(!JSON.stringify(trace).includes('https://assets.example'), 'public projection excludes asset URLs');
  var ambiguousTrace = await Trace.read(ambiguousStore, now + 10);
  assert.equal(ambiguousTrace.command.status, 'AMBIGUOUS');
  assert.equal(ambiguousTrace.command.providerReceiptId, null);
  var emptyTrace = await Trace.read(new Store(), now + 10);
  assert.equal(emptyTrace.status, 'UNOBSERVED');
  var heldTrace = await Trace.read(heldStore, now + 10);
  assert.equal(heldTrace.decision.status, 'RELEASED');
  assert.equal(heldTrace.command, null, 'a released decision with held motor is not a command');
  var original = await store.get(Executor.commandKey(invalidGenerated.commandId));
  await store.set(Executor.commandKey(original.commandId), Object.assign({}, original, { ownerDomain: 'finance' }));
  var bad = await Trace.read(store, now + 10);
  assert.equal(bad.status, 'UNAVAILABLE'); assert.equal(bad.command, null); assert.equal(bad.decision, null);
  await store.set(Executor.commandKey(original.commandId), Object.assign({}, original, { decisionReceiptId: 'missing' }));
  assert.equal((await Trace.read(store, now + 10)).reason, 'command-decision-link-invalid');
  await store.set(Executor.commandKey(original.commandId), Object.assign({}, original, { promptHash: null }));
  assert.equal((await Trace.read(store, now + 10)).reason, 'command-readback-invalid');
  await store.set(Executor.commandKey(original.commandId), original);
  var originalCause = await store.get(Decision.key(original.decisionReceiptId));
  await store.set(Decision.key(original.decisionReceiptId), Object.assign({}, originalCause, { expiresAt: original.commandedAt }));
  assert.equal((await Trace.read(store, now + 10)).reason, 'command-decision-link-invalid');
  await store.set(Decision.key(original.decisionReceiptId), originalCause);
  assert.equal((await Trace.read(store, now + 10)).status, 'RECORDED');
  var pendingOnly = new Store();
  await pendingOnly.set(Decision.key(released.decisionReceiptId), released);
  var dispatching = Object.assign({}, executed, { status: 'DISPATCHING', providerAccepted: false, receipt: null });
  await pendingOnly.set(Executor.commandKey(dispatching.commandId), dispatching);
  await pendingOnly.lpush(Executor.PENDING_LOG_KEY, dispatching);
  assert.equal((await Trace.read(pendingOnly, now + 10)).command.status, 'DISPATCHING');
  assert.equal((await Trace.read(store, now - 1)).status, 'UNAVAILABLE', 'future-dated records cannot be presented as proof');
  // Five real LOCAL decision/command/public-observation admissions across two
  // canonical image subjects qualify the unchanged Culture gate.
  var qualifiedStore = new Store(), qualifyingReads = 0;
  var storePath = require.resolve('../lib/autofire-efference-store.js'), handlerPath = require.resolve('../handlers/product-domain-learning-state.js');
  var oldStoreModule = require.cache[storePath], oldHandlerModule = require.cache[handlerPath];
  async function readEndpoint(proofStore) {
    var readonly = Object.create(proofStore);
    ['set','setIfAbsent','lpush','ltrim','del'].forEach(function (method) { readonly[method] = async function () { throw Error('Culture endpoint attempted write'); }; });
    require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: readonly }; delete require.cache[handlerPath];
    var body, res = { setHeader: function () {}, end: function (text) { body = JSON.parse(text); } };
    await require(handlerPath)({ method: 'GET', url: '/api/product-domain-learning-state?domain=culture' }, res);
    assert.equal(res.statusCode, 200); return body;
  }
  try {
    var notReady;
    for (var i = 0; i < 5; i++) {
      var at = Date.now(), asset = i % 2 ? 'energy' : 'culture';
      var selected = Policy.candidate(asset, 'test-model', 'LOCAL/FIXTURE missing-public-hero-' + i);
      var exactDecision = await Decision.decide(qualifiedStore, selected, at, { cognition: cognition(at) }); assert.equal(exactDecision.status, 'RELEASED');
      var exactCommand = await Executor.execute({ store: qualifiedStore, candidate: selected, decision: exactDecision, now: at,
        motorAuthorization: motor('LOCAL-qualified-culture-' + i), provider: { generate: async function () {
          return { ok: true, url: 'https://x.ai/LOCAL-qualified-image-' + i, requestId: 'LOCAL-image-' + i, spentUsd: 0.02 };
        } } }); assert.equal(exactCommand.status, 'GENERATED');
      var exactObservation = await Observer.observe(qualifiedStore, exactCommand, { fetch: async function () {
        qualifyingReads++; return { status: 200, headers: { get: function (name) { return name === 'content-type' ? 'image/png' : null; } }, arrayBuffer: async function () { return Buffer.from('LOCAL-image-' + i); } };
      } }); assert.equal(exactObservation.status, 'OBSERVED_PRESENT');
      assert.equal((await Learning.recordObservation(qualifiedStore, exactObservation)).ok, true);
      assert.equal((await Learning.recordObservation(qualifiedStore, exactObservation)).duplicate, true);
      if (i === 0) { notReady = await readEndpoint(qualifiedStore); assert.equal(notReady.learningGate.ready, false); }
    }
    var ready = await readEndpoint(qualifiedStore), empty = await readEndpoint(new Store());
    assert.equal(qualifyingReads, 5); assert.equal(ready.resolvedCount, 5); assert.equal(ready.learningGate.ready, true);
    assert.equal((await Learning.readForBrain(qualifiedStore)).learningGate.distinctAssets, 2);
    assert.equal(ready.learningGate.distinctAssets, 2); assert.equal(ready.learningGate.minimumDistinctAssets, 2);
    assert.equal(ready.learningGate.distinctSources, undefined);
    assert.equal(notReady.learningGate.distinctAssets, 1); assert.equal(notReady.learningGate.ready, false);
    var compact = require('../lib/brain-cognition-compact.js').learningReadout(ready);
    assert.deepEqual(compact.learningGate, ready.learningGate);
    for (var view of [ready, notReady, empty]) {
      var output = { innerHTML: '' }, ui = { addEventListener: function () {} };
      var projected = require('../lib/brain-cognition-compact.js').learningReadout(view);
      require('node:vm').runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname, '../assets/js/civilization/execution-observatory.js'), 'utf8'), {
        window: ui, document: { readyState: 'loading', addEventListener: function () {}, getElementById: function (id) { return id === 'execution-observatory' ? output : null; } },
        Date: Date, setInterval: function () {}, fetch: async function (url) { return { ok: true, json: async function () { return url.includes('brain-cognition') ? { cognition: { culture: { ts: Date.now(), c: { brainOrgans: { externalActionLearning: projected } } } } } : {}; } }; }
      });
      await ui.LIMENExecutionObservatory.refresh();
      var card = output.innerHTML.split('<span class="exo-domain-name">culture</span>')[1].split('</article>')[0];
      assert.match(card, new RegExp('learner gate <b>' + (view.learningGate.ready ? 'READY' : 'HELD')));
      assert.match(card, new RegExp('distinct assets ' + view.learningGate.distinctAssets + '/2'));
      assert.doesNotMatch(card, /distinct sources/);
    } assert.equal(empty.signal, null); assert.equal(empty.resolvedCount, 0);
    var nativeCycle = require('./fixtures/publication-native-cycle.cjs'), fixedAt = Date.now() + 1000;
    var admittedNative = await nativeCycle('culture', ready, fixedAt), emptyNative = await nativeCycle('culture', empty, fixedAt), notReadyNative = await nativeCycle('culture', notReady, fixedAt);
    assert.deepEqual(admittedNative.learning.learningGate, ready.learningGate);
    assert.deepEqual(notReadyNative.learning.learningGate, notReady.learningGate);
    assert.equal(admittedNative.externalRewardEligible, false);
    for (var result of [admittedNative, emptyNative, notReadyNative]) assert.equal(result.plasticity.rewardActive, false);
    assert.deepEqual(admittedNative.evaluated, emptyNative.evaluated); assert.deepEqual(notReadyNative.evaluated, emptyNative.evaluated);
    console.log('Culture qualified native return', JSON.stringify({ evidence: 'LOCAL/FIXTURE', commands: 5, resolved: ready.resolvedCount, distinctAssets: 2, ready: true, rewardActive: false, sameEvaluation: true }));
  } finally {
    if (oldStoreModule) require.cache[storePath] = oldStoreModule; else delete require.cache[storePath];
    if (oldHandlerModule) require.cache[handlerPath] = oldHandlerModule; else delete require.cache[handlerPath];
  }
  console.log('culture hero sovereign B10/B14/observer/recovery loop and read-only business trace: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
