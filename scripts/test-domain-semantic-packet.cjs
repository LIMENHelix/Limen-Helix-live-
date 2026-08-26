'use strict';

const assert = require('node:assert/strict');
const packet = require('../lib/domain-semantic-packet');

const now = Date.parse('2026-08-26T17:00:00Z');
const set = (domain, feed, hash, offset) => ({
  t: now - offset,
  d: domain,
  f: feed,
  ck: 'headline_title',
  hh: hash,
  items: [{
    i: 0,
    ti: domain + ' observed source event',
    au: 'https://example.test/' + domain + '/' + hash,
    pa: now - offset - 1000,
    pl: 'Example Publisher'
  }]
});

const science = packet.build([set('research', 'PubMed', 1, 1000)], 'research', now);
assert.equal(science.meta.status, 'OBSERVED');
assert.equal(science.meta.authority, 'observation-only');
assert.equal(science.observations.length, 1);
assert.match(science.observations[0].sourceIdentity.value, /^research:PubMed:/);
assert.equal(science.observations[0].publisherIndependence, 'unassessed');
assert.equal(science.observations[0].canonicalUrl, null);
assert.match(science.observations[0].aggregatorItemUrl, /^https:\/\/example\.test\//);

assert.equal(packet.sourceDomainFor('science'), 'research');
assert.equal(packet.sourceDomainFor('medicine'), 'health');
assert.equal(packet.sourceDomainFor('trade'), 'supplyChain');
assert.equal(packet.sourceDomainFor('religion'), 'religion');

const empty = packet.build([], 'economy', now);
assert.equal(empty.meta.status, 'ABSTAINED');
assert.equal(empty.meta.reason, 'no-valid-persisted-title-observations');
assert.deepEqual(empty.observations, []);

const many = packet.build(Array.from({ length: 10 }, (_, i) => set('health', 'Feed ' + i, i, i)), 'health', now);
assert.equal(many.meta.setsRead, packet.MAX_SETS);
assert.equal(many.meta.truncated, true);

console.log('domain semantic packet tests passed');
