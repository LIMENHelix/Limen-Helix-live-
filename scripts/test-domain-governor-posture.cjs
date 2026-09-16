'use strict';

var assert = require('node:assert/strict');
var Posture = require('../lib/domain-governor-posture.js');

var steadyInput = {
  stress: 0.2,
  predictedStress: 0.25,
  predictionError: 0.1,
  regulation: 'stable',
  regulationControl: { gain: 0.7, inhibition: 0.2, outputScale: 0.8 },
  immune: 'clear',
  immuneSeverity: 0.05,
  awareness: { selfState: 'stable', selfNarrative: 'Culture is stable.', humanReviewRequired: false },
  interoception: { divergence: 0.1, uncertainty: 0.1, salience: 'stable' }
};
var steadyA = Posture.derive(steadyInput, 0.2);
var steadyB = Posture.derive(JSON.parse(JSON.stringify(steadyInput)), 0.2);
assert.deepEqual(steadyA, steadyB, 'the same local brain state must produce the same posture');
assert.equal(steadyA.state, 'steady');
assert.equal(steadyA.authority.role, 'presentation-and-deliberation-modulation-only');
assert(steadyA.authority.mayNotChange.includes('motor-selection'));
assert(steadyA.authority.mayNotChange.includes('budget'));

var guarded = Posture.derive(Object.assign({}, steadyInput, {
  immune: 'alert',
  immuneSeverity: 0.8,
  awareness: { selfState: 'guarded', selfNarrative: 'Finance is guarded.', humanReviewRequired: true }
}), 0.4);
assert.equal(guarded.state, 'guarded');
assert.equal(guarded.modulation.tone, 'cautious-explicit');
assert.equal(guarded.modulation.exploration, 'suppressed');
assert.equal(guarded.appraisal.urgency, 0.9);

var activeImmune = Posture.derive(Object.assign({}, steadyInput, {
  immune: 'active', immuneSeverity: 0.5
}), 0.2);
assert.notEqual(activeImmune.state, 'guarded',
  'medium immune activity is pressure, not the local brain\'s alert-level veto');
assert.equal(activeImmune.appraisal.threat, 0.5);

var surprised = Posture.derive(Object.assign({}, steadyInput, {
  predictionError: 0.61,
  regulation: 'surprised',
  regulationControl: { gain: 0.8, inhibition: 0.2, outputScale: 0.8, surprised: true },
  interoception: { divergence: 0.5, uncertainty: 0.55, salience: 'blind-channel' }
}), 0.35);
assert.equal(surprised.state, 'surprised');
assert.equal(surprised.modulation.attentionWidth, 'broadened');
assert.equal(surprised.modulation.exploration, 'elevated');
assert.equal(surprised.appraisal.rewardExpectation, null, 'unobserved appraisal channels must not be invented');

var regulationStateSurprised = Posture.derive(Object.assign({}, steadyInput, {
  predictionError: 0.3,
  regulation: 'surprised',
  regulationControl: { gain: 0.8, inhibition: 0.2, outputScale: 0.8 }
}), 0.35);
assert.equal(regulationStateSurprised.state, 'surprised',
  'the domain brain regulation state must drive posture even without a duplicate control flag');

var overloaded = Posture.derive(Object.assign({}, steadyInput, {
  regulation: 'flooding',
  regulationControl: { gain: 1, inhibition: 0.7, outputScale: 0.3, flooding: true }
}), 0.88);
assert.equal(overloaded.state, 'overloaded');
assert.equal(overloaded.modulation.persistence, 'reduce-and-stabilize');

var unavailable = Posture.derive({ present: false, stale: true }, 0.9);
assert.equal(unavailable.state, 'unavailable', 'server stress cannot impersonate a missing local brain state');
assert.equal(unavailable.reason, 'domain-cognition-absent');
assert.equal(unavailable.appraisal.threat, null);

var freshnessUnavailable = Posture.derive(steadyInput, 0.9, false);
assert.equal(freshnessUnavailable.state, 'unavailable');
assert.equal(freshnessUnavailable.reason, 'domain-cognition-stale');

console.log('domain governor posture: deterministic local neurology modulates demeanor without receiving motor authority');
