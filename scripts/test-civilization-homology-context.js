'use strict';

var assert = require('node:assert/strict');
var homology = require('../lib/civilization-homology-context');
var packet = require('../lib/civilization-server-packet');
var cases = require('../lib/civilization-case-record');
var passed = 0;

function ok(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function rejects(name, fn, code) {
  assert.throws(fn, function (err) { return err && err.code === code; });
  passed++;
  console.log('PASS ' + name);
}

var source = { snapshotId: 'snap-h1', retrievedAt: '2026-08-24T00:00:00Z', refreshId: 'refresh-h1', producer: 'test' };

ok('builds a complete observational context without converting it to a verdict', function () {
  var out = homology.normalize({
    schemaVersion: homology.SCHEMA,
    status: homology.STATUS,
    identity: { domainId: 'finance', domainLabel: 'Finance', joinStatus: 'joined', companies: [{ name: 'Example', ticker: 'EX', cik: '1' }], issues: [] },
    phase: { value: 'p7a', label: 'TERMINAL', evidence: [{ source: 'company-phase-scorer', phase: 'p7a' }] },
    regulation: { state: 'DYSREGULATED', direction: 'hyper', regulatedVariable: 'credit availability', evidence: [{ id: 'e1' }], source: 'brain-v2' },
    brainNodes: [{ id: 'GP', role: 'action-gating', state: 'active', diagnosisIds: ['CREDIT_FREEZE'], evidence: [] }],
    mappings: { neurology_to_business_homology: { status: 'PRESENT', source: 'domain-bridge-pattern', patternId: 'recovery_entry' } },
    recovery: { status: 'UNOBSERVED', regulatedVariable: 'credit availability', evidence: [], note: 'no later window yet' },
    provenance: { sourceIdentity: source },
    abstentions: ['business-to-neurology mapping not supplied']
  });
  assert.equal(out.status, 'OBSERVATIONAL');
  assert.equal(out.contextOnly, true);
  assert.equal(out.phase.value, 'p7a');
  assert.equal(out.regulation.state, 'DYSREGULATED');
  assert.equal(out.mappings.neurology_to_business_homology.status, 'PRESENT');
  assert.equal(out.mappings.business_to_neurology_homology.status, 'UNESTABLISHED');
});

ok('builds context from explicit domain state and records missing fields as abstentions', function () {
  var out = homology.buildFromBrainState('science', {
    label: 'Science', phase: 'p2', phaseLabel: 'RHYTHM', stress: 0.9,
    companies: [{ name: 'Lab Co', ticker: 'LAB', cik: '2' }],
    diagnoses: [{ id: 'dx', nodeId: 'THAL', active: true }]
  }, source, {
    phaseEvidence: [{ source: 'feed', id: 'f1' }],
    bridgePattern: { patternId: 'research-recovery', businessSignature: 'instrument-demand' }
  });
  assert.equal(out.identity.companies.length, 1);
  assert.equal(out.brainNodes[0].id, 'THAL');
  assert.equal(out.phase.value, 'p2');
  assert.equal(out.mappings.neurology_to_business_homology.status, 'PRESENT');
  assert.ok(out.abstentions.includes('regulated-dysregulated-state-not-explicitly-supplied'));
  assert.ok(out.abstentions.includes('recovery-evidence-not-explicitly-supplied'));
  assert.ok(!out.abstentions.includes('phase-evidence-not-explicitly-supplied'));
});

ok('packet preserves context through the handoff and case record', function () {
  var p = packet.fromBrainState('finance', {
    label: 'Finance', phase: 'p0', phaseLabel: 'SOURCE', stress: 0.2, confidence: 0.7,
    cognition: { model: { cycle: 1 } },
    feeds: [], diagnoses: [{ id: 'dx', nodeId: 'GP', active: true }], treatments: [], opportunities: [], directives: [],
    companies: [{ name: 'Example Bank', ticker: 'EXB', cik: '3' }], updated: 1
  }, { snapshotId: source.snapshotId, fetchedAt: Date.parse(source.retrievedAt) }, source.refreshId, source.retrievedAt, {
    phaseEvidence: [{ source: 'company-phase-scorer', phase: 'p0' }],
    bridgePattern: { patternId: 'capital-preservation', businessSignature: 'credit-recovery' }
  });
  var h = packet.toHandoff(p, 'investments', { id: 'opp-h', title: 'Observe' });
  assert.equal(p.homologyContext.schemaVersion, homology.SCHEMA);
  assert.equal(h.homologyContext.schemaVersion, homology.SCHEMA);
  assert.equal(h.caseRecord.evidence.homologyContext.schemaVersion, homology.SCHEMA);
  assert.equal(h.caseRecord.reviewChecklist.find(function (x) { return x.item.indexOf('homology') >= 0; }).status, 'PRESENT_CONTEXT_ONLY');
  assert.deepEqual(h.caseRecord.evidence.mappingCoverage, {
    neurology_to_business_homology: false,
    business_to_neurology_homology: false,
    kernel_dynamics: false,
    p0_p10_proof_and_effects: false
  });
});

rejects('rejects a non-P0-P10 phase', function () {
  homology.normalize({ schemaVersion: homology.SCHEMA, status: homology.STATUS, identity: { domainId: 'finance' }, phase: { value: 'validated' } });
}, 'HOMOLOGY_PHASE_INVALID');

rejects('rejects a non-observational status', function () {
  homology.normalize({ schemaVersion: homology.SCHEMA, status: 'READY_TO_FIRE', identity: { domainId: 'finance' } });
}, 'HOMOLOGY_STATUS_REQUIRED');

console.log(passed + '/5 passed');
