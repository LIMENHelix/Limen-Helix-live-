#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var projection = require('../lib/brain-cognition-compact.js');

assert.equal(projection.reviewRequired([]), false);
assert.equal(projection.reviewRequired(['source-needs-review']), true);
assert.equal(projection.reviewRequired(true), true);
assert.equal(projection.reviewRequired(false), false);
assert.equal(projection.reviewRequired(null), false);

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

console.log('brain cognition compact: review arrays and booleans preserve domain gate truth');
