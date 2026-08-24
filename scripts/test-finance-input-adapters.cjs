#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Semantic = require('../lib/finance-semantic-evidence.js');
const Market = require('../lib/finance-market-snapshot.js');
const Network = require('../lib/finance-network-snapshot.js');

const semantic = Semantic.assemble([{
  t: '2026-08-24T12:00:00Z', d: 'finance', f: 'Finance Feed', ck: 'headline_title', hh: 'h1',
  items: [{ i: 0, ti: 'Acme reports quarterly results', au: 'https://example.test/a',
    pa: '2026-08-24T11:00:00Z', pl: 'Acme IR' }]
}], 'finance');
assert.equal(semantic.observations.length, 1);
assert.equal(semantic.observations[0].publisherIndependence, 'unassessed');
assert.equal(semantic.observations[0].sourceIdentity.value, 'finance:Finance Feed:h1:0');

// Production recorder rows use epoch milliseconds for t/pa and numeric hh;
// publisher/date tags may legitimately be absent on an RSS adapter. Those
// rows must survive with recordedAt provenance and a null sourceUpdatedAt.
const numeric = Semantic.assemble([{
  t: Date.parse('2026-08-24T12:00:00Z'), d: 'finance', f: 'Fed H.4.1 Balance Sheet',
  ck: 'headline_title', hh: 12345,
  items: [{ i: 0, ti: 'Federal Reserve data update', au: 'https://example.test/fed', pa: null, pl: null }]
}], 'finance');
assert.equal(numeric.observations.length, 1);
assert.equal(numeric.abstentions.length, 0);
assert.equal(numeric.observations[0].recordedAt, '2026-08-24T12:00:00.000Z');
assert.equal(numeric.observations[0].sourceUpdatedAt, null);
assert.equal(numeric.observations[0].feedName, 'Fed H.4.1 Balance Sheet');

const dropped = Semantic.assemble([{ t: '2026-08-24T12:00:00Z', f: 'Feed', hh: 'h2', items: [{ ti: 'No provenance' }] }], 'finance');
assert.equal(dropped.observations.length, 0);
assert.equal(dropped.abstentions.length, 1);

const market = Market.assemble({ updated: Date.parse('2026-08-24T12:00:00Z'), quotes: {
  GIS: { live: true, price: 55.2, prevClose: 54.9 },
  BAD: { live: false, reason: 'no data' }
} }, ['GIS', 'BAD']);
assert.equal(market.quotes.length, 1);
assert.equal(market.quotes[0].symbol, 'GIS');
assert.deepEqual(market.missing, ['BAD']);
assert.equal(market.sources[0], 'asset-quote/yahoo-chart');

const network = Network.assemble({ generatedAt: '2026-08-24T12:00:00Z', bySlug: {
  acme: { induced: 1.4, total: 2.1, rank: 'MILD', hub: false, pushed: true }
} }, 'acme');
assert.equal(network.asOf, '2026-08-24T12:00:00.000Z');
assert.equal(network.value, 2.1);
assert.equal(network.sourceIdentity.value, 'limen-stress-slim');
assert.equal(Network.assemble({ generatedAt: Date.now(), bySlug: {} }, 'missing'), null);

console.log('finance input adapters: 18/18 passed');
