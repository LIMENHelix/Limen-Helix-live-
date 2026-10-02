'use strict';
const assert = require('node:assert/strict');
const Bridge = require('../lib/autofire-domain-bridge.js');
const Worker = require('../handlers/limen-worker-autofire.js');
const Learning = require('../lib/autofire-learning.js');
const Efference = require('../lib/autofire-efference.js');
const Intake = require('../lib/research-evaluation-intake.js');
const Reader = require('../lib/research-business-trace-readout.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rendererSource = fs.readFileSync(path.join(__dirname, '../assets/js/civilization/execution-observatory.js'), 'utf8');
async function renderProjection(origin, projected, now) {
  const el = { innerHTML: '' };
  const window = { addEventListener() {} };
  const document = { readyState: 'loading', addEventListener() {}, getElementById: id => id === 'execution-observatory' ? el : null };
  const payload = JSON.parse(JSON.stringify({ count: 1, newest: now, cognition: { [origin]: { ts: now, c: projected } } }));
  vm.runInNewContext(rendererSource, { window, document, Date, setInterval() {},
    fetch: async url => ({ ok: true, json: async () => url.includes('brain-cognition') ? payload : {} }) });
  await window.LIMENExecutionObservatory.refresh();
  return el.innerHTML.split('<span class="exo-domain-name">' + origin + '</span>')[1].split('</article>')[0];
}
// Execute the existing refresh projection block with real read-only readers.
// This is a projection join proof, not a complete cron invocation.
const refreshSource = fs.readFileSync(path.join(__dirname, '../handlers/brain-cognition-refresh.js'), 'utf8');
const projectionStart = refreshSource.indexOf('c.businessTrace = await productDomainBusinessTrace.read(');
const projectionEnd = refreshSource.indexOf('if (_motorReceipt.ok)', projectionStart);
assert(projectionStart >= 0 && projectionEnd > projectionStart);
const project = new (Object.getPrototypeOf(async function () {}).constructor)(
  'c', 'dom', 'efferenceStore', 'productDomainBusinessTrace', 'researchBusinessTrace', 'Date',
  refreshSource.slice(projectionStart, projectionEnd) + '\nreturn c;');
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
class Store {
  constructor() { this.values = new Map(); this.lists = new Map(); }
  assertDurable() {}
  async get(key) { return clone(this.values.get(key)); }
  async set(key, value) { this.values.set(key, clone(value)); return true; }
  async setIfAbsent(key, value) { if (this.values.has(key)) return false; return this.set(key, value); }
  async lpush(key, value) { const rows = this.lists.get(key) || []; rows.unshift(clone(value)); this.lists.set(key, rows); }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); }
  async lrange(key, start, end) { return clone((this.lists.get(key) || []).slice(start, end < 0 ? undefined : end + 1)); }
}
(async () => {
  for (const origin of ['science', 'medicine', 'education', 'environment']) {
    const store = new Store();
    const candidate = { domain: origin, recommendedLane: 'research', source: 'domain-packet-research',
      subjectId: origin + ':subject', sourcePacketId: origin + ':packet', sourceArtifactRef: origin + ':window' };
    const before = JSON.stringify(candidate);
    const routed = Worker.selectionCandidate(candidate);
    const spec = { lane: 'research', candidate: routed, domainCycle: null, at: 1790899000000 };
    const first = await Bridge.select(store, spec);
    assert.equal(first.ok, true);
    assert.equal(first.receipt.ownerDomain, 'research');
    assert.equal(first.receipt.status, 'HELD');
    assert.equal(first.receipt.routing.originDomain, origin);
    assert.equal(first.receipt.routing.sourcePacketId, candidate.sourcePacketId);
    assert.equal(first.receipt.routing.observationOnly, true);
    assert.deepEqual(await store.get('autofire_selection:' + first.receipt.id), first.receipt);
    const replay = await Bridge.select(store, spec);
    assert.equal(replay.receipt.id, first.receipt.id);
    assert.equal(JSON.stringify(candidate), before);
    const readonly = Object.create(store);
    for (const name of ['set', 'setIfAbsent', 'lpush', 'ltrim']) readonly[name] = async () => { throw Error('readout attempted a write'); };
    const readout = await Reader.read(readonly, 'science', spec.at + 1);
    assert.equal(readout.status, 'RECORDED', readout.reason);
    assert.equal(readout.decision.originDomain, origin);
    assert.equal(readout.decision.packetId, candidate.sourcePacketId);
    assert.equal(readout.ownerDomain, 'research');
    assert.equal(readout.command, null);
    assert.equal(readout.externalActionAuthorized, false);
    const originReadout = await Reader.readOrigin(readonly, origin, spec.at + 1);
    assert.equal(originReadout.originDomain, origin);
    assert.equal(originReadout.destinationOwner, 'research');
    assert.equal(originReadout.observationOnly, true);
    assert.equal(originReadout.externalActionAuthorized, false);
    assert.equal(originReadout.routes[0].decisionId, first.receipt.id);
    assert.equal(originReadout.routes[0].sourcePacketId, candidate.sourcePacketId);
    assert.equal(originReadout.command, null);
    const ownBefore = await Reader.read(readonly, origin, spec.at + 1);
    const projected = await project({}, origin, readonly, Reader, Reader, { now: () => spec.at + 1 });
    assert.deepEqual(projected.businessTrace, ownBefore);
    assert.deepEqual(projected.researchOriginTrace, originReadout);
    const projectedBeforeRender = JSON.stringify(projected);
    const rendered = await renderProjection(origin, projected, spec.at + 1);
    assert.match(rendered, /papers routed to Science/);
    assert(rendered.includes(first.receipt.id), 'durable Science decision absent from rendered source card');
    assert(rendered.includes(candidate.sourcePacketId), 'source packet absent from rendered source card');
    assert.match(rendered, /HELD/);
    assert.equal(JSON.stringify(projected), projectedBeforeRender, 'render must preserve projection');
    const outcomeStore = new Store();
    const released = await Bridge.select(outcomeStore, { ...spec, candidate: { ...spec.candidate, masterGate: { confidence: 0.95, readiness: 0.95, salience: 0.95, completeness: 1 } }, domainCycle: { domain: 'research', ok: true, startedAt: 100, cursorAfter: 99,
      domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } } } });
    assert.equal(released.receipt.status, 'RELEASED', JSON.stringify(released.receipt.reasons));
    const commanded = await Efference.command(outcomeStore, { lane: 'research', subjectId: released.receipt.candidate.subjectId,
      sourceIdentity: released.receipt.candidate.sourceIdentity, emittedAt: spec.at + 1 });
    assert.equal(commanded.ok, true);
    assert.equal((await Learning.recordCommand(outcomeStore, { selection: released.receipt, efferenceCopy: commanded.copy })).ok, true);
    await Efference.resolve(outcomeStore, commanded.copy, { ok: true, skipped: false, outputId: origin + ':output', wordCount: 900 }, spec.at + 2);
    const fixtureSource = fs.readFileSync(path.join(__dirname, 'test-research-evaluation-intake.cjs'), 'utf8');
    const inputStart = fixtureSource.indexOf('const input =');
    const inputEnd = fixtureSource.indexOf('(async function', inputStart);
    const evaluationInput = new Function(fixtureSource.slice(inputStart, inputEnd) + 'return input;')();
    Object.assign(evaluationInput.publication, { actionId: commanded.copy.actionId, outputId: origin + ':output',
      observationId: origin + ':evaluation', observedAt: new Date(spec.at + 3).toISOString() });
    const admitted = await Intake.persist(outcomeStore, evaluationInput, spec.at + 3);
    assert.equal(admitted.ok, true);
    const outcomeEvent = { ...admitted.record.event, ownerDomain: 'research', eventId: origin + ':event', ts: spec.at + 3 };
    assert.equal((await Learning.recordOutcome(outcomeStore, outcomeEvent)).ok, true);
    const returned = await Reader.readOrigin(outcomeStore, origin, spec.at + 4);
    assert.equal(returned.status, 'RECORDED', returned.reason);
    assert.equal(returned.outcomes.length, 1, returned.reason);
    assert.equal(returned.outcomes[0].sourcePacketId, candidate.sourcePacketId);
    assert.equal(returned.outcomes[0].originRewardAuthorized, false);
    const returnProjection = await project({}, origin, outcomeStore, Reader, Reader, { now: () => spec.at + 4 });
    const returnedCard = await renderProjection(origin, returnProjection, spec.at + 4);
    assert.match(returnedCard, /Science evaluated outcome/);
    assert(returnedCard.includes(origin + ':evaluation'));
    assert.match(returnedCard, /Science retains learning/);
    assert.equal(await outcomeStore.get(Learning.stateKey(origin === 'science' ? 'unused-science' : origin)), null);
    const copyKey = Efference.recordKey(commanded.copy.id);
    const originalCopy = clone(await outcomeStore.get(copyKey));
    const lateReceipt = clone(originalCopy); lateReceipt.resolvedAt = spec.at + 4;
    await outcomeStore.set(copyKey, lateReceipt);
    const earlyEvaluation = await Reader.readOrigin(outcomeStore, origin, spec.at + 4);
    assert.equal(earlyEvaluation.status, 'UNAVAILABLE', 'evaluation before artifact persistence must be suppressed');
    assert.equal(earlyEvaluation.outcomes.length, 0);
    await outcomeStore.set(copyKey, originalCopy);
    assert.equal((await Reader.readOrigin(outcomeStore, origin, spec.at + 4)).outcomes.length, 1);
    const recordKey = Intake.key(outcomeEvent.observationId);
    const originalAdmission = clone(await outcomeStore.get(recordKey));
    const corruptedAdmission = clone(originalAdmission); corruptedAdmission.event.outputId = 'unrelated-output';
    await outcomeStore.set(recordKey, corruptedAdmission);
    const refusedReturn = await Reader.readOrigin(outcomeStore, origin, spec.at + 4);
    assert.equal(refusedReturn.status, 'UNAVAILABLE');
    assert.equal(refusedReturn.outcomes.length, 0);
    await outcomeStore.set(recordKey, originalAdmission);
    const otherOrigin = origin === 'education' ? 'medicine' : 'education';
    assert.equal((await Reader.readOrigin(readonly, otherOrigin, spec.at + 1)).routes.length, 0);
    assert.equal((await Reader.readOrigin(readonly, 'homestead', spec.at + 1)).status, 'UNAVAILABLE');
    const key = 'autofire_selection:' + first.receipt.id;
    for (const change of [{ ownerDomain: 'health' }, { sourcePacketId: 'unrelated-packet' }, { observationOnly: false }, { originDomain: 'homestead' }]) {
      const corrupt = clone(first.receipt);
      Object.assign(corrupt.routing, change);
      store.values.set(key, corrupt);
      store.lists.set(Bridge.LOG_KEY, [corrupt]);
      assert.equal((await Reader.read(readonly, 'science', spec.at + 1)).status, 'UNAVAILABLE');
      const corruptedOrigin = await Reader.readOrigin(readonly, origin, spec.at + 1);
      assert.equal(corruptedOrigin.status, change.originDomain ? 'UNOBSERVED' : 'UNAVAILABLE');
      assert.equal(corruptedOrigin.routes.length, 0);
    }
    const legacy = clone(first.receipt);
    delete legacy.routing;
    store.values.set(key, legacy);
    store.lists.set(Bridge.LOG_KEY, [legacy]);
    const legacyReadout = await Reader.read(readonly, 'science', spec.at + 1);
    assert.equal(legacyReadout.status, 'RECORDED');
    assert.equal(legacyReadout.decision.originDomain, null, 'legacy origin must not be invented');
    assert.equal((await Reader.readOrigin(readonly, origin, spec.at + 1)).status, 'UNOBSERVED');
    for (const change of [{ source: 'master-inbox' }, { originDomain: 'homestead' }, { sourcePacketId: null }]) {
      const rejected = await Bridge.select(new Store(), Object.assign({}, spec, { candidate: Object.assign({}, routed, change) }));
      assert.equal(rejected.ok, true);
      assert.equal(rejected.receipt.routing, undefined, 'unqualified input must not acquire native provenance');
      assert.equal(rejected.receipt.status, 'HELD');
    }
  }
  console.log('research routing provenance: four native origins, Science ownership, durable replay and negative metadata boundaries passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
