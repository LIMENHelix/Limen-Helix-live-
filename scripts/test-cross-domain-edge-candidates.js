'use strict';

var assert = require('node:assert/strict');
var report = require('./audit-cross-domain-edge-candidates.js');
var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, '..', 'assets', 'data', 'deep', 'cross-domain-edge-candidates.json');
var saved = JSON.parse(fs.readFileSync(file, 'utf8'));

assert.equal(saved.schemaVersion, 'cross-domain-edge-candidates/1.0');
assert.equal(saved.readOnly, true);
assert.equal(saved.domains, 20);
assert.equal(saved.channels, 275);
assert.equal(saved.overlapPairs, 75);
assert.equal(saved.sharedProviderPairs, 75);
assert.equal(saved.distinctProviderCandidates, 0);
assert.equal(report.overlapPairs, saved.overlapPairs);
assert(saved.pairs.every(function (p) { return p.status === 'REJECTED_SHARED_PROVIDER'; }));
console.log('9/9 passed');
