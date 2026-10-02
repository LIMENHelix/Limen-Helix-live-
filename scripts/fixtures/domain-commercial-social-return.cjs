'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Lanes = require('../../lib/domain-commercial-lanes.js');
const Artifact = require('../../lib/domain-commercial-artifact.js');
const Candidate = require('../../lib/domain-commercial-social-candidate.js');
const SubjectDecision = require('../../lib/domain-commercial-distribution-decision.js');
const ChannelDecision = require('../../lib/communication-social-decision.js');
const Executor = require('../../lib/communication-social-executor.js');
const Observer = require('../../lib/communication-social-outcome-observer.js');
const Learning = require('../../lib/domain-commercial-social-learning.js');
const ROOT = path.resolve(__dirname, '../..');

function cognition(domain, at, suffix) {
  return { ts: at, c: { domain: Lanes.get(domain).contract.ownerDomain, stress: 0.72, phase: 'P4', interoception: { divergence: 0.22 },
    immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
    serverPacketPersistence: { ok: true }, serverPacket: {
      schemaVersion: 'civilization-domain-packet/1.0', domainId: domain, packetId: 'LOCAL-' + domain + '-packet-' + suffix,
      sourceType: 'server-cognition-refresh', sourceIdentity: { producer: 'brain-cognition-refresh/1' }, generatedAt: new Date(at - 1000).toISOString(),
      truth: { stressScore: 0.72, phase: 'p4', feedHealth: { live: 2 }, opportunities: [],
        semanticEvidenceMeta: { status: 'OBSERVED', ownerDomain: domain, sourceDomain: domain },
        semanticEvidence: [0, 1].map(index => ({ sourceIdentity: { kind: 'LOCAL-headline-title', value: domain + '-' + suffix + '-' + index },
          title: 'LOCAL ' + domain + ' attributed title ' + suffix + '-' + index, publisher: 'LOCAL Publisher', feedName: 'LOCAL Feed',
          sourceUpdatedAt: new Date(at - 1000).toISOString(), recordedAt: new Date(at).toISOString(),
          sourceRecordId: 'https://example.test/' + domain + '/' + suffix + '/' + index })) }
    } } };
}
// Evaluate the production projection expression itself, rather than reproducing its fields in the fixture.
function hostedProjection(readout) {
  const source = fs.readFileSync(path.join(ROOT, 'handlers/brain-cognition-refresh.js'), 'utf8');
  const start = source.indexOf('publicSocialOutcome: _commercialSocial ? {');
  const end = source.indexOf('} : null,', start);
  assert(start >= 0 && end > start);
  const expression = source.slice(start + 'publicSocialOutcome: '.length, end + '} : null'.length);
  const compact = require('../../lib/brain-cognition-compact.js');
  return vm.runInNewContext('(' + expression + ')', { _commercialSocial: readout, val: compact.val, num: compact.num });
}
module.exports = async function proveSubjectReturn(Store, domain = 'culture') {
  const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try {
  const lane = Lanes.get(domain), store = new Store();
  let prior = null, posts = 0, reads = 0, immature, lastCommand, lastObservation;
  const historyStart = Date.now() - 3 * 60 * 60 * 1000;
  for (let index = 0; index < 2; index++) {
    const at = index === 0 ? historyStart : realNow() - 10000; clock = at + 3;
    const record = cognition(domain, at, index);
    const plan = lane.evaluate(record, prior, at); assert.equal(plan.status, 'PLANNED', plan.reason);
    prior = await lane.persist(store, plan); assert.equal(prior.readbackVerified, true);
    const prepared = Artifact.build(lane.contract, prior, at + 1); assert.equal(prepared.status, 'ARTIFACT_PREPARED');
    const artifact = await Artifact.persist(store, lane.contract, prepared);
    const candidate = await Candidate.read(store, domain, at + 2); assert.equal(candidate.ok, true);
    const subject = await SubjectDecision.decide(store, candidate, at + 3, { cognition: { [domain]: record } });
    assert.equal(subject.status, 'RELEASED'); candidate.domainDecisionReceipt = subject;
    const decision = await ChannelDecision.decide(store, candidate, at + 3, { cognition: { [domain]: record, communication: cognition('communication', at, index) } });
    assert.equal(decision.status, 'RELEASED');
    const uri = 'at://did:plc:local/app.bsky.feed.post/subject-return-' + index, cid = 'LOCAL-subject-cid-' + index;
    const posted = await Executor.execute({ store, now: at + 3, spec: { subjectDomain: domain, text: candidate.text, decisionReceipt: decision,
      sourceArtifactId: candidate.sourceArtifactId, sourceIntentId: candidate.sourceIntentId, sourcePacketId: candidate.sourcePacketId,
      candidateHash: candidate.candidateHash, selectedProgram: candidate.selectedProgram, domainDecisionReceipt: subject },
      motorAuthorization: { authorize: async () => ({ authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'LOCAL-subject-motor-' + index }) },
      adapterGuard: { checkpoint: async () => ({ allowed: true }) },
      platform: { postToBluesky: async () => { posts++; return { ok: true, uri, cid, url: 'https://bsky.app/profile/local/post/subject-return-' + index }; } } });
    assert.equal(posted.status, 'POSTED', posted.reason);
    clock = at + 10;
    const command = await store.get(Executor.commandKey(posted.commandId));
    for (const likes of index === 0 ? [1, 2, 0] : [1, 0]) {
      clock++;
      const observed = await Observer.observeOne(store, { uri, cid, commandId: command.commandId }, Date.now(), {
        fetch: async () => { reads++; return { status: 200, json: async () => ({ posts: [{ uri, cid, likeCount: likes, indexedAt: new Date(at + 3).toISOString() }] }) }; } });
      assert.equal(observed.status, 'OBSERVED'); lastCommand = command; lastObservation = observed.receipt;
      assert.equal((await Learning.recordObservation(store, command, observed.receipt)).ok, true);
      assert.equal((await Learning.recordObservation(store, command, observed.receipt)).duplicate, true);
      if (!immature) immature = await Learning.readForBrain(store, domain);
    }
    assert.equal((await Learning.readForBrain(store, domain)).signal.sourceArtifactId, artifact.artifactId);
  }
  clock = realNow();
  const ready = await Learning.readForBrain(store, domain), empty = await Learning.readForBrain(new Store(), domain);
  assert.equal(posts, 2); assert.equal(reads, 5); assert.equal(ready.resolvedCount, 5);
  assert.equal(ready.learningGate.ready, true); assert.equal(ready.learningGate.distinctArtifacts, 2);
  assert.equal(immature.learningGate.ready, false); assert.equal(empty.signal, null);
  assert.equal(ready.signal.outcome, 'ENGAGEMENT_DECREASED'); assert.equal(ready.signal.normalizedCredit, 0);

  const learnedStateKey = Learning.stateKey(domain), savedState = structuredClone(await store.get(learnedStateKey));
  async function refusesRead(mutate) {
    const damaged = mutate(structuredClone(savedState)); await store.set(learnedStateKey, damaged);
    const before = JSON.stringify({ values: Array.from(store.values), logs: store.logs });
    await assert.rejects(() => Learning.readForBrain(store, domain), /domain commercial social learning/);
    assert.equal(JSON.stringify({ values: Array.from(store.values), logs: store.logs }), before, 'read refusal must not repair or write stored history');
    await assert.rejects(() => Learning.recordObservation(store, lastCommand, lastObservation), /domain commercial social learning/);
    assert.equal(JSON.stringify({ values: Array.from(store.values), logs: store.logs }), before, 'invalid state cannot be acknowledged as a duplicate or rewritten');
    await store.set(learnedStateKey, savedState);
  }
  await refusesRead(row => { row.productDomain = 'finance'; row.ownerDomain = 'finance'; return row; });
  for (const mutate of [
    row => { row.ownerDomain = 'finance'; }, row => { row.lane = 'investment'; },
    row => { row.signals[0].ownerDomain = 'finance'; }, row => { row.latestSignal.productDomain = 'finance'; },
    row => { row.latestSignal.normalizedCredit = 1; }, row => { row.latestSignal.sourceIdentity.provider = 'LOCAL-unverified'; },
    row => { row.latestSignal.observedAt = Date.now() + 1; }, row => { row.resolvedCount++; },
    row => { row.distinctArtifacts++; }, row => { row.processedObservationIds[1] = row.processedObservationIds[0]; },
    row => { row.artifactIds.push(row.artifactIds[0]); }, row => { row.signals = null; },
    row => { row.signals[1] = structuredClone(row.signals[0]); },
    row => { row.artifactIds.push('LOCAL-fake-distinct-artifact'); row.distinctArtifacts++; }
  ]) await refusesRead(row => { mutate(row); return row; });
  const returnedCauseKey = Learning.causeKey(domain, ready.signal.actionId);
  const cause = structuredClone(await store.get(returnedCauseKey));
  await store.set(returnedCauseKey, Object.assign({}, cause, { ownerDomain: 'finance' }));
  await assert.rejects(() => Learning.readForBrain(store, domain), /returned cause invalid/);
  await store.set(returnedCauseKey, cause);
  // Completed graded history remains readable after acknowledged observations leave the pending queue.
  const pendingKey = Observer.LEARNING_PENDING_LOG_KEY;
  assert.equal(typeof pendingKey, 'string'); assert(store.logs[pendingKey].length > 0);
  const pending = structuredClone(store.logs[pendingKey] || []); store.logs[pendingKey] = [];
  assert.deepEqual(await Learning.readForBrain(store, domain), ready); store.logs[pendingKey] = pending;

  const readonly = Object.create(store);
  for (const method of ['set', 'setIfAbsent', 'replaceIfValue', 'lpush', 'ltrim', 'deleteIfValue']) readonly[method] = async () => { throw Error('subject readout wrote'); };
  const statusHandler = require('../../handlers/domain-commercial-status.js').createHandler({ store: readonly,
    gate: { reqKey: () => 'LOCAL', hasDomain: () => true } });
  let body; const response = { setHeader() {}, end(text) { body = JSON.parse(text); } };
  await statusHandler({ method: 'GET', url: '/api/domain-commercial-status?domain=' + domain }, response);
  assert.equal(response.statusCode, 200); assert.equal(body.readOnly, true); assert.deepEqual(body.domains[0].publicSocialOutcome, ready);
  const malformed = structuredClone(savedState); malformed.ownerDomain = 'finance'; await store.set(learnedStateKey, malformed);
  const malformedBefore = JSON.stringify({ values: Array.from(store.values), logs: store.logs });
  await statusHandler({ method: 'GET', url: '/api/domain-commercial-status?domain=' + domain }, response);
  assert.equal(response.statusCode, 503); assert.equal(body.error, 'domain-commercial-status-unavailable');
  const failedBriefing = await require('../../lib/domain-governor-briefing.js').commercialReflex(domain, readonly, Date.now());
  assert.equal(failedBriefing.status, 'UNOBSERVED'); assert.equal(failedBriefing.publicSocialOutcome, undefined);
  assert.equal(JSON.stringify({ values: Array.from(store.values), logs: store.logs }), malformedBefore);
  await store.set(learnedStateKey, savedState);

  const briefing = await require('../../lib/domain-governor-briefing.js').commercialReflex(domain, readonly, Date.now());
  assert.equal(briefing.status, 'OBSERVED'); assert.deepEqual(briefing.publicSocialOutcome, ready); assert.equal(briefing.selectsExternalEffect, false);

  // Preserve the real cadence and daily cap. The next independent evaluation is after both have elapsed.
  const nextAt = Date.now() + 24 * 60 * 60 * 1000 + 1;
  const evaluations = [ready, immature, empty].map(view => {
    const record = cognition(domain, nextAt, 'next'); record.c.brainOrgans.commercialReflex = { publicSocialOutcome: hostedProjection(view) };
    const result = lane.evaluate(record, prior, nextAt); assert.equal(result.status, 'PLANNED', result.reason);
    assert.equal(result.externalEffectAuthorized, false); assert.equal(result.providerCalled, false); return result;
  });
  assert.equal(evaluations[0].intent.adaptationContext.policyChangeEligible, true);
  assert.equal(evaluations[0].intent.adaptationContext.publicSocialOutcome.latestSignalId, ready.signal.signalId);
  assert.equal(evaluations[0].homology.predictionError, 1);
  for (const result of evaluations.slice(1)) { assert.equal(result.intent.adaptationContext.policyChangeEligible, false); assert.equal(result.homology.predictionError, 0.22); }
  assert(evaluations[0].priority > evaluations[2].priority, 'qualified own negative outcome affects the existing commercial salience calculation');
  assert.equal(require('../../lib/domain-commercial-reflex.js').evaluate(lane.contract, cognition(domain, Date.now(), 'cadence-held'), prior, Date.now()).reason, 'commercial-cadence-inhibited');
  for (const view of [ready, immature, empty]) {
    const output = { innerHTML: '' }, ui = { addEventListener() {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/js/civilization/execution-observatory.js'), 'utf8'), {
      window: ui, document: { readyState: 'loading', addEventListener() {}, getElementById: id => id === 'execution-observatory' ? output : null },
      Date, setInterval() {}, fetch: async url => ({ ok: true, json: async () => String(url).includes('brain-cognition') ? {
        cognition: { [domain]: { ts: Date.now(), c: { brainOrgans: { commercialReflex: { status: 'PLANNED', publicSocialOutcome: hostedProjection(view) } } } } }
      } : {} })
    });
    await ui.LIMENExecutionObservatory.refresh();
    const card = output.innerHTML.split('<span class="exo-domain-name">' + domain + '</span>')[1].split('</article>')[0];
    assert(card.includes('subject social gate <b>' + (view.learningGate.ready ? 'READY' : 'HELD') + '</b>'));
    assert(card.includes('distinct artifacts ' + view.learningGate.distinctArtifacts + '/2'));
    assert(card.includes('resolved ' + view.resolvedCount + '/5'));
    assert(card.includes('subject social outcome <b>' + view.status + '</b>'));
    assert(card.includes('signal ' + (view.signal ? view.signal.signalId : 'UNOBSERVED')));
    assert(card.includes('returned learning <b>UNOBSERVED</b>'), 'subject evidence must not populate the primary motor learner');
    assert(card.includes('exo-chain-label">REVENUE</span><span class="exo-badge exo-unobserved">UNOBSERVED'));
  }
  console.log('Subject commercial native return', JSON.stringify({ evidence: 'LOCAL/FIXTURE', domain, commands: posts, observations: reads,
    resolved: ready.resolvedCount, distinctArtifacts: ready.learningGate.distinctArtifacts, policyChangeEligible: true, priorityChanged: true, externalActions: 0 }));
  } finally { Date.now = realNow; }
};
