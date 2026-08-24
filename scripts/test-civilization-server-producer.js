'use strict';

var assert = require('node:assert/strict');
var packet = require('../lib/civilization-server-packet');
var passed = 0;
function ok(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function rejects(name, fn, code) {
  assert.throws(fn, function (err) { return err && err.code === code; });
  passed++; console.log('PASS ' + name);
}

var state = {
  label: 'Science', stress: 0.4, confidence: 0.7, activityLevel: 'medium',
  phase: 'p2', phaseLabel: 'RHYTHM', updated: 1787537800000,
  cognition: { model: { cycle: 9 } },
  diagnoses: [{ id: 'active', active: true }, { id: 'inactive', active: false }],
  treatments: [{ id: 't1' }], opportunities: [{ id: 'o1', path: 'RESEARCHABLE' }], directives: [],
  feeds: [{ live: true }, { live: false }]
};
var meta = { snapshotId: '1787537812473-242', fetchedAt: 1787537812473 };
var out;
ok('builds from trusted brain state', function () {
  out = packet.fromBrainState('science', state, meta, 'refresh-1', '2026-08-24T02:00:00Z');
  assert.equal(out.schemaVersion, packet.PACKET_SCHEMA);
  assert.equal(out.cycleId, '9');
  assert.equal(out.truth.activeDiagnoses.length, 1);
  assert.equal(out.truth.feedHealth.live, 1);
  assert.equal(out.sourceIdentity.snapshotId, meta.snapshotId);
});
ok('maps only the explicit research path to a canonical lane', function () {
  assert.equal(out.truth.opportunities[0].lane, 'research-papers');
  assert.equal(out.truth.opportunities[0].laneProvenance.schema, 'domain-opportunity-path-map/1.0');
});
ok('preserves a deterministic source packet identity', function () {
  assert.equal(out.packetId, 'science:9:1787537812473-242');
  assert.equal(out.sourceIdentity.refreshId, 'refresh-1');
});
ok('carries optional source-preserving semantic evidence', function () {
  var withEvidence = packet.fromBrainState('finance', state, meta, 'refresh-2', '2026-08-24T02:00:00Z', {
    semanticEvidence: [{ sourceIdentity: { kind: 'headline-title', value: 'finance:1' }, title: 'Observed filing' }],
    semanticEvidenceMeta: { status: 'OBSERVED', truncated: false }
  });
  assert.equal(withEvidence.truth.semanticEvidence.length, 1);
  assert.equal(withEvidence.truth.semanticEvidenceMeta.status, 'OBSERVED');
});
rejects('abstains without snapshot identity', function () { packet.fromBrainState('science', state, {}, 'refresh-1', '2026-08-24T02:00:00Z'); }, 'REQUIRED_SNAPSHOTMETA.SNAPSHOTID');
rejects('abstains without cognition cycle', function () { packet.fromBrainState('science', Object.assign({}, state, { cognition: {} }), meta, 'refresh-1', '2026-08-24T02:00:00Z'); }, 'CYCLE_ID_REQUIRED');
rejects('abstains without refresh identity', function () { packet.fromBrainState('science', state, meta, '', '2026-08-24T02:00:00Z'); }, 'REQUIRED_REFRESHID');
console.log(passed + '/7 passed');
