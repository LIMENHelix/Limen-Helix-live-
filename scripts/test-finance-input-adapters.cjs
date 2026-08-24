#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Semantic = require('../lib/finance-semantic-evidence.js');
const Market = require('../lib/finance-market-snapshot.js');

const semantic = Semantic.assemble([{
  t: '2026-08-24T12:00:00Z', d: 'finance', f: 'Finance Feed', ck: 'headline_title', hh: 'h1',
  items: [{ i: 0, ti: 'Acme reports quarterly results', au: 'https://example.test/a',
    pa: '2026-08-24T11:00:00Z', pl: 'Acme IR' }]
}], 'finance');
assert.equal(semantic.observations.length, 1);
assert.equal(semantic.observations[0].publisherIndependence, 'unassessed');
assert.equal(semantic.observations[0].sourceIdentity.value, 'finance:Finance Feed:h1:0');

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

console.log('finance input adapters: 10/10 passed');
