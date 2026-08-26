'use strict';

var assert = require('node:assert/strict');
var K4 = require('../assets/js/limen-k4-selfconsistency.js');

assert.equal(K4.version, 2);
assert.equal(K4.externalRewardEligible('energy', 'feed-resolution'), true);
assert.equal(K4.externalRewardEligible('energy', 'independent-action-outcome'), false);
assert.equal(K4.externalRewardEligible('finance', 'feed-resolution'), true);
assert.equal(K4.externalRewardEligible('finance', 'independent-action-outcome'), true);
assert.equal(K4.externalRewardEligible('research', 'feed-resolution'), false);
assert.equal(K4.externalRewardEligible('research', 'independent-action-outcome'), true);
assert.equal(K4.externalRewardEligible('health', 'independent-action-outcome'), true);
assert.equal(K4.externalRewardEligible('agriculture', 'independent-action-outcome'), false);

var researchAction = K4.credit({ domain: 'research', externalOutcome: { hit: 0.8, sourceKind: 'independent-action-outcome' } });
assert.equal(researchAction.isReward, true);
assert.equal(researchAction.credit, 0.8);
var researchFeed = K4.credit({ domain: 'research', externalOutcome: { hit: 0.8, sourceKind: 'feed-resolution' } });
assert.equal(researchFeed.isReward, false);
assert.equal(researchFeed.tier, 0);
var agricultureForgery = K4.credit({ domain: 'agriculture', externalOutcome: { hit: 1, sourceKind: 'independent-action-outcome' } });
assert.equal(agricultureForgery.isReward, false);

console.log('K4 action-outcome authority: domain plus outcome-class gates passed');

