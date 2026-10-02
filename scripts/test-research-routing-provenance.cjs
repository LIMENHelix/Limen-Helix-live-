'use strict';
const assert = require('node:assert/strict');
const Bridge = require('../lib/autofire-domain-bridge.js');
const Worker = require('../handlers/limen-worker-autofire.js');
const Reader = require('../lib/research-business-trace-readout.js');
const fs = require('node:fs');
const path = require('node:path');
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
