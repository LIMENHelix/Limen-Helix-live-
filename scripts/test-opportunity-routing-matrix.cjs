#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Policy = require('../brain-v2/core/outward-action-policy.js');
const Autofire = require('../handlers/limen-worker-autofire.js');

const DOMAINS = [
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy',
  'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'
];

for (const domain of DOMAINS) {
  assert.equal(Policy.ownerFor('investment', domain), 'finance', domain + ' investment must route to Finance');
  assert.equal(Autofire.schedulerGroup({ domain, recommendedLane: 'investment' }), 'investment:finance', domain + ' investment scheduler must use Finance');
}

assert.equal(Policy.ownerFor('research', 'agriculture'), null, 'Agriculture does not own a research motor');
assert.equal(Autofire.routedDomain({ domain: 'agriculture', recommendedLane: 'research' }), 'research');
assert.equal(Autofire.schedulerGroup({ domain: 'agriculture', recommendedLane: 'research' }), 'research:science');
assert.equal(Policy.ownerFor('research', 'science'), 'research');
assert.equal(Policy.ownerFor('research', 'medicine'), 'health');
assert.equal(Policy.ownerFor('research', 'education'), 'education');
assert.equal(Policy.ownerFor('research', 'environment'), 'environment');
assert.equal(Autofire.schedulerGroup({ domain: 'science', recommendedLane: 'research' }), 'research:science');
assert.equal(Autofire.schedulerGroup({ domain: 'medicine', recommendedLane: 'research' }), 'research:medicine');
assert.equal(Autofire.schedulerGroup({ domain: 'education', recommendedLane: 'research' }), 'research:education');
assert.equal(Autofire.schedulerGroup({ domain: 'environment', recommendedLane: 'research' }), 'research:environment');
assert.equal(Autofire.schedulerGroup({ domain: 'homestead', recommendedLane: 'research' }), 'unowned');

console.log('opportunity routing matrix: all 20 domains send investment to Finance; Agriculture research sends to Science/research; only registered research owners receive research motors');
