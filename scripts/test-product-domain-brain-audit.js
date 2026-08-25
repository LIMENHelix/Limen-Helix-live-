#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var AUDIT = require('../lib/product-domain-brain-audit.js');
var report = AUDIT.audit();

assert.equal(report.layer, 'assets/js/domain-brains');
assert.equal(report.domains.length, 20);
assert.equal(new Set(report.domains.map(function (row) { return row.product; })).size, 20);
assert.equal(new Set(report.domains.map(function (row) { return row.file; })).size, 20);
assert.equal(report.coreComplete, 20, JSON.stringify(report.domains.filter(function (row) { return !row.coreComplete; })));
assert.equal(report.authorityParityComplete, 20,
  JSON.stringify(report.domains.filter(function (row) { return row.authorityGaps.length; })));
assert(report.domains.every(function (row) {
  return row.bytes > 100000 && row.constructor && row.identityMatches && row.parts.authoritySurface;
}));

var aliases = Object.fromEntries(report.domains.filter(function (row) {
  return ['medicine', 'science', 'trade'].indexOf(row.product) >= 0;
}).map(function (row) { return [row.product, row.runtime]; }));
assert.deepEqual(aliases, { medicine: 'health', science: 'research', trade: 'supplyChain' });

var finance = report.domains.find(function (row) { return row.product === 'finance'; });
var energy = report.domains.find(function (row) { return row.product === 'energy'; });
assert.equal(finance.authority.flags.servo, true);
assert.equal(finance.authority.flags.phase, true);
assert.equal(energy.authority.flags.plasticityLive, true);
assert.equal(energy.authority.flags.metaplasticityLive, true);

console.log('product domain brain audit: 20 separate brains, common core and authority parity passed');
