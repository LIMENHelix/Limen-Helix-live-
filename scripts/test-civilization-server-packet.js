'use strict';

var assert = require('node:assert/strict');
var contract = require('../lib/civilization-server-packet');
var passed = 0;

function ok(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function rejects(name, fn, code) {
  assert.throws(fn, function (err) { return err && err.code === code; });
  passed++;
  console.log('PASS ' + name);
}

var input = {
  schemaVersion: contract.PACKET_SCHEMA,
  sourceType: 'server-cognition-refresh',
  domainId: 'science',
  domainLabel: 'Science',
  cycleId: 'cycle-17',
  generatedAt: '2026-08-24T02:00:00Z',
  sourceIdentity: {
    snapshotId: 'snapshot-123',
    retrievedAt: '2026-08-24T01:59:58Z',
    refreshId: 'refresh-17',
    producer: 'brain-cognition-refresh/1'
  },
  truth: {
    stressScore: 0.3,
    confidence: 0.8,
    activityLevel: 'medium',
    phase: 'p2',
    phaseLabel: 'RHYTHM',
    activeDiagnoses: [{ id: 'dx-1', label: 'signal' }],
    treatments: [{ id: 'tx-1', label: 'observe' }],
    opportunities: [{ id: 'opp-1', title: 'study' }],
    directives: [],
    feedHealth: { live: 2, configured: 3 }
  },
  civAudit: { role: 'observer', sourceType: 'domain-brain' }
};

var packet;
ok('builds a versioned server packet', function () {
  packet = contract.buildPacket(input);
  assert.equal(packet.schemaVersion, contract.PACKET_SCHEMA);
  assert.equal(packet.packetId, 'science:cycle-17:snapshot-123');
  assert.equal(packet.sourceIdentity.refreshId, 'refresh-17');
  assert.equal(packet.truth.activeDiagnoses.length, 1);
});

ok('build is immutable with respect to source arrays', function () {
  packet.truth.treatments[0].label = 'changed';
  assert.equal(input.truth.treatments[0].label, 'observe');
});

ok('builds only active investment handoff', function () {
  var handoff = contract.toHandoff(packet, 'investments', { id: 'opp-1', motorClaim: { variable: 'paper-position' } });
  assert.equal(handoff.schemaVersion, contract.HANDOFF_SCHEMA);
  assert.equal(handoff.handoffId, 'science:cycle-17:snapshot-123:investments:opp-1');
  assert.equal(handoff.sourceIdentity.snapshotId, 'snapshot-123');
});

rejects('rejects wrong packet schema', function () { contract.buildPacket(Object.assign({}, input, { schemaVersion: '1' })); }, 'SCHEMA_REQUIRED');
rejects('rejects browser source type', function () { contract.buildPacket(Object.assign({}, input, { sourceType: 'browser' })); }, 'SOURCE_TYPE_REQUIRED');
rejects('rejects missing source refresh identity', function () { contract.buildPacket(Object.assign({}, input, { sourceIdentity: Object.assign({}, input.sourceIdentity, { refreshId: '' }) })); }, 'REQUIRED_SOURCEIDENTITY.REFRESHID');
rejects('rejects invalid timestamp', function () { contract.buildPacket(Object.assign({}, input, { generatedAt: 'later' })); }, 'INVALID_GENERATEDAT');
rejects('rejects missing active diagnoses array', function () { contract.buildPacket(Object.assign({}, input, { truth: Object.assign({}, input.truth, { activeDiagnoses: null }) })); }, 'INVALID_TRUTH.ACTIVEDIAGNOSES');
rejects('rejects bounded-array overflow', function () { contract.buildPacket(Object.assign({}, input, { truth: Object.assign({}, input.truth, { directives: new Array(contract.MAX_ITEMS + 1).fill({}) }) })); }, 'OVERFLOW_TRUTH.DIRECTIVES');
rejects('rejects oversized packet', function () { contract.buildPacket(Object.assign({}, input, { truth: Object.assign({}, input.truth, { opportunities: [{ payload: 'x'.repeat(contract.MAX_PACKET_BYTES * 2) }] }) })); }, 'PACKET_TOO_LARGE');
rejects('rejects retired lane', function () { contract.toHandoff(packet, 'patents', { id: 'x' }); }, 'LANE_UNSUPPORTED');
rejects('rejects missing opportunity id', function () { contract.toHandoff(packet, 'research-papers', {}); }, 'REQUIRED_OPPORTUNITY.ID');

console.log(passed + '/12 passed');
