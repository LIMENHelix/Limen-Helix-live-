'use strict';

const assert = require('node:assert/strict');
const packet = require('../lib/finance-semantic-packet.js');

function set(n, t) {
  return {
    t, d: 'finance', f: 'SEC EDGAR', ck: 'headline_title', hh: n,
    items: [{ i: 0, ti: 'Official filing ' + n, au: 'https://example.test/' + n, pa: t, pl: 'SEC' }]
  };
}

const first = packet.build([set(1, 1787584353880), set(2, 1787584353000)], 'finance', 1787584354000);
assert.equal(first.schemaVersion, packet.SCHEMA);
assert.equal(first.observations.length, 2);
assert.equal(first.meta.status, 'OBSERVED');
assert.equal(first.meta.truncated, false);
assert.equal(first.meta.sourceKey, 'feedtitles:finance');
assert.equal(first.observations[0].sourceIdentity.kind, 'headline-title');
assert.equal(first.observations[0].publisherIndependence, 'unassessed');
assert.equal(first.meta.retrievedAt, '2026-08-24T15:12:34.000Z');

const many = Array.from({ length: 9 }, (_, i) => set(i + 1, 1787584354000 - i));
const bounded = packet.build(many, 'finance', 1787584354000);
assert.equal(bounded.observations.length, 8);
assert.equal(bounded.meta.setsRead, packet.MAX_SETS);
assert.equal(bounded.meta.truncated, true);

const empty = packet.build([], 'finance', 1787584354000);
assert.equal(empty.observations.length, 0);
assert.equal(empty.meta.status, 'ABSTAINED');
assert.equal(empty.meta.reason, 'no-valid-persisted-title-observations');

console.log('finance semantic packet: 14/14 passed');
