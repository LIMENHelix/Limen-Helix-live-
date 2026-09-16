#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var projection = require('../lib/brain-cognition-compact.js');

assert.equal(projection.reviewRequired([]), false);
assert.equal(projection.reviewRequired(['source-needs-review']), true);
assert.equal(projection.reviewRequired(true), true);
assert.equal(projection.reviewRequired(false), false);
assert.equal(projection.reviewRequired(null), false);
assert.equal(projection.num(0), 0);
assert.equal(projection.num('0'), null);
assert.equal(projection.scalar({ total: 0.42 }), 0.42);
assert.equal(projection.scalar(0.18), 0.18);
assert.equal(projection.scalar({ other: 1 }), null);
assert.deepEqual(projection.arr(['one']), ['one']);
assert.deepEqual(projection.arr(null), []);
assert.equal(projection.val(false), false);
assert.equal(projection.val(null), null);

function project(value) {
  return projection.compact({
    domain: 'industry',
    awareness: { humanReviewRequired: value }
  }).awareness.humanReviewRequired;
}

assert.equal(project([]), false, 'an empty domain review list must not become a false veto');
assert.equal(project(['unresolved-review']), true, 'a non-empty domain review list must inhibit');
assert.equal(project(true), true, 'a boolean veto must remain a veto');
assert.equal(project(false), false, 'a clear boolean gate must remain clear');

var control = projection.compact({
  domain: 'finance',
  model: {
    cycle: 9,
    predictionError: { total: 0.42 },
    predictedStress: 0.71,
    regulation: { state: 'surprised', gain: 0.8, inhibition: 0.2, outputScale: 0.8, surprised: true }
  },
  awareness: { selfState: 'guarded', selfNarrative: 'Finance is reassessing.', knowns: ['x'], uncertainties: ['y'] }
});
assert.equal(control.model.predictionError, 0.42, 'object prediction error must preserve its total');
assert.equal(control.model.regulation, 'surprised');
assert.equal(control.model.regulationControl.gain, 0.8);
assert.equal(control.model.regulationControl.surprised, true);
assert.equal(control.awareness.selfState, 'guarded');
assert.equal(control.awareness.knownCount, 1);
assert.equal(control.awareness.uncertaintyCount, 1);

console.log('brain cognition compact: projection helpers, local control state, and review gates preserve source truth');
