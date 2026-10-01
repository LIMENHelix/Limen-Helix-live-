'use strict';

// Transport-only fixtures. The layer outputs come from the separately verified
// actual optional loaders/builders; canonical markers below are deliberately
// injected to test isolation, not to claim native cognition or motor execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const packetContract = require('../lib/civilization-server-packet.js');
const handoffConsumer = require('../lib/civilization-handoff-consumer.js');
const retiredExpander = require('../handlers/expand-artifact.js');
const clone = value => JSON.parse(JSON.stringify(value));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixturePath = 'docs/audits/continuity-supplemental-provenance-20261001.json';
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const fixedTime = '2026-10-01T22:00:00.000Z';
const source = { snapshotId: 'fixture-transport-only', fetchedAt: Date.parse(fixedTime) };

function memoryStore() {
  const records = new Map();
  return {
    records, packetKey: id => 'packet:' + id, handoffKey: id => 'handoff:' + id,
    packetIndexKey: 'packet-index', handoffIndexKey: 'handoff-index',
    async setNx(key, value) { if (records.has(key)) return false; records.set(key, clone(value)); return true; },
    async get(key) { return records.has(key) ? clone(records.get(key)) : null; },
    async add() { return true; }
  };
}

async function check(row) {
  assert.equal(hash(row.file), row.sourceSha256, 'Saved layer evidence must match the current protected consumer');
  for (const input of row.inputs) if (input.status === 200) {
    assert.equal(hash('.' + input.path), input.sourceSha256, 'Existing source-file bytes must match the saved fixture');
  }
  const canonicalOpportunity = { id: 'canonical-transport-marker', title: 'Transport fixture only', path: 'RESEARCHABLE' };
  const baselineState = {
    cognition: { model: { cycle: 1 } }, stress: null, confidence: null,
    diagnoses: [{ id: 'canonical-diagnosis-marker', label: 'Canonical transport marker', active: true }],
    opportunities: [canonicalOpportunity], treatments: [], directives: [], feeds: []
  };
  const state = clone(baselineState);
  state[row.field] = clone(row.layer);
  const before = JSON.stringify(state);
  const baseline = packetContract.fromBrainState(row.domain, baselineState, source, 'fixture-transport', fixedTime);
  const augmented = packetContract.fromBrainState(row.domain, state, source, 'fixture-transport', fixedTime);
  assert.deepEqual(augmented, baseline, 'Supplemental state cannot change the normalized server packet');
  assert.equal(JSON.stringify(state), before, 'Server producer does not mutate source state');
  assert.equal(augmented.truth.activeDiagnoses.length, 1);
  assert.equal(augmented.truth.opportunities.length, 1);
  const handoff = packetContract.toHandoff(augmented, 'research-papers', augmented.truth.opportunities[0]);
  assert.deepEqual(handoff, packetContract.toHandoff(baseline, 'research-papers', baseline.truth.opportunities[0]));
  const store = memoryStore();
  const consumer = handoffConsumer.createConsumer({ store });
  const recorded = await consumer.consumePacket(augmented);
  assert.equal(recorded.ok, true);
  assert.equal(recorded.handoffsCreated, 1, 'Only the explicit canonical transport opportunity is handed off');
  const replay = await consumer.consumePacket(augmented);
  assert.equal(replay.ok, true);
  assert.equal(replay.handoffsCreated, 0);
  const persisted = [...store.records.entries()].filter(([key]) => key.startsWith('handoff:'));
  assert.equal(persisted.length, 1);
  assert.deepEqual(persisted[0][1], handoff);
  // A populated optional layer alone must not create an opportunity or handoff.
  const optionalOnly = clone(state);
  optionalOnly.diagnoses = [];
  optionalOnly.opportunities = [];
  const alone = packetContract.fromBrainState(row.domain, optionalOnly,
    { ...source, snapshotId: 'fixture-optional-only' }, 'fixture-transport', fixedTime);
  assert.deepEqual(alone.truth.activeDiagnoses, []);
  assert.deepEqual(alone.truth.opportunities, []);
  const aloneStore = memoryStore();
  const absent = await handoffConsumer.createConsumer({ store: aloneStore }).consumePacket(alone);
  assert.equal(absent.ok, true);
  assert.equal(absent.handoffsCreated, 0);
  assert.equal([...aloneStore.records.keys()].filter(key => key.startsWith('handoff:')).length, 0);
  return { domain: row.domain, mode: row.mode, field: row.field, supplementalLoaded: row.layer.loaded,
    supplementalSourceMode: row.layer.sourceMode || null, packetUnchanged: true,
    canonicalHandoffs: 1, replayHandoffs: 0, optionalOnlyHandoffs: 0 };
}

(async () => {
  assert.equal(fixture.rows.length, 36);
  const results = [];
  for (const row of fixture.rows) results.push(await check(row));
  assert.equal(typeof retiredExpander._extractSafeInput, 'undefined', 'Historical finalizer helper must not be treated as a current consumer');
  const response = { statusCode: 0, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; }, end() {} };
  await retiredExpander({ method: 'POST', body: { deepBrain: { promptView: { sourceMode: 'hand-authored' } } } }, response);
  assert.equal(response.statusCode, 410);
  assert.equal(response.body.error, 'LANE_RETIRED');
  console.log('PASS 36 current server packet/handoff cases: canonical truth unchanged, exact persistence/replay, optional-only creates zero handoffs');
  console.log('PASS current retired expander: historical helper absent, POST returns explicit HTTP 410, no provider execution');
  if (process.argv.includes('--write-evidence')) {
    fs.writeFileSync('docs/audits/continuity-supplemental-transport-20261001.json', JSON.stringify({
      level: 'LOCAL/TRANSPORT FIXTURE', nativeCognitionProof: false, providerCalls: 0, runtimeChanged: false,
      fixturePath, fixtureSha256: hash(fixturePath),
      sources: ['lib/civilization-server-packet.js', 'lib/civilization-handoff-consumer.js',
        'handlers/expand-artifact.js', 'handlers/brain-cognition-refresh.js',
        'assets/js/domain-brain-adapter.js', 'assets/js/civilization/domain-packet-adapter.js',
        'assets/js/civilization/handoff-contract.js', 'assets/js/civilization/artifact-packet-builder.js'
      ].map(file => ({ file, sha256: hash(file) })),
      results, retiredExpander: { status: response.statusCode, error: response.body.error, historicalHelperPresent: false }
    }, null, 2) + '\n');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
