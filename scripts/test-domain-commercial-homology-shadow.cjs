'use strict';

var assert = require('node:assert/strict');
var Shadow = require('../lib/domain-commercial-homology-shadow.js');

function context() {
  return {
    schemaVersion: Shadow.CONTEXT_SCHEMA,
    status: 'OBSERVATIONAL',
    contextOnly: true,
    identity: { domainId: 'finance', companies: [{ cik: '1601548' }] },
    phase: { value: 'p8', evidence: [{ source: 'company-phase-scorer' }] },
    brainNodes: [{ id: 'vmPFC' }],
    regulation: { state: 'DYSREGULATED', regulatedVariable: 'capital-allocation-error' },
    mappings: {
      neurology_to_business_homology: { status: 'PRESENT' },
      business_to_neurology_homology: { status: 'PRESENT' },
      p0_p10_proof_and_effects: { status: 'PRESENT' }
    }
  };
}

(function () {
  var incomplete = context();
  incomplete.mappings.business_to_neurology_homology.status = 'UNESTABLISHED';
  var held = Shadow.compare({ domainId: 'finance', homologyContext: incomplete }, { status: 'PLANNED' });
  assert.equal(held.mode, 'SHADOW_ONLY');
  assert.equal(held.currentDecision, 'PLANNED');
  assert.equal(held.shadowDecision, 'ABSTAINED');
  assert.equal(held.wouldChange, true);
  assert.ok(held.blockers.includes('business-to-neurology-mapping-unestablished'));
  assert.equal(held.externalEffectAuthorized, false);

  var admitted = Shadow.compare({ domainId: 'finance', homologyContext: context() }, { status: 'PLANNED' });
  assert.equal(admitted.eligible, true);
  assert.equal(admitted.shadowDecision, 'PLANNED');
  assert.equal(admitted.wouldChange, false);

  console.log('domain commercial homology shadow: all tests passed');
})();
