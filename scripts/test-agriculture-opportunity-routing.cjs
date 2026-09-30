#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Registry = require('../lib/civilization-valve-registry.js');
const Autofire = require('../handlers/limen-worker-autofire.js');
const audit = require('../lib/product-domain-business-executor-audit.js');

const root = path.resolve(__dirname, '..');
const router = fs.readFileSync(path.join(root, 'api', '[...route].js'), 'utf8');
const homestead = fs.readFileSync(path.join(root, 'handlers', 'homestead.js'), 'utf8');

assert.match(router, /'homestead': require\('\.\.\/handlers\/homestead'\)/,
  'the independent Homestead property catalog remains registered');
assert.doesNotMatch(router, /agriculture-homestead-(?:cycle|inbound|status|recovery)/,
  'Agriculture Homestead service-request routes remain retired');
assert.match(homestead, /realauction:deals/,
  'Homestead reads the property-availability inventory');
assert.equal(fs.existsSync(path.join(root, 'handlers', 'agriculture-homestead-cycle.js')), false);
assert.equal(fs.existsSync(path.join(root, 'lib', 'agriculture-homestead-learning.js')), false);

assert.equal(Registry.forCandidate({ domain: 'agriculture', recommendedLane: 'investment' }), 'finance:broker-order');
assert.equal(Registry.forCandidate({ domain: 'agriculture', recommendedLane: 'research' }), 'science:research-papers');
assert.equal(Registry.forCandidate({ domain: 'agriculture', recommendedLane: 'homestead' }), null);
assert.equal(Autofire.routedDomain({ domain: 'agriculture', recommendedLane: 'investment' }), 'agriculture');
assert.equal(Autofire.routedDomain({ domain: 'agriculture', recommendedLane: 'research' }), 'research');
assert.deepEqual(Autofire.selectionCandidate({ domain: 'agriculture', recommendedLane: 'investment', id: 'i1' }),
  { domain: 'agriculture', recommendedLane: 'investment', id: 'i1' });
assert.deepEqual(Autofire.selectionCandidate({ domain: 'agriculture', recommendedLane: 'research', id: 'r1' }),
  { domain: 'research', originDomain: 'agriculture', recommendedLane: 'research', id: 'r1' });

const report = audit.audit();
const agriculture = report.domains.find(row => row.productDomain === 'agriculture');
assert.deepEqual(agriculture.opportunityRouting, {
  investment: 'finance:broker-order',
  research: 'science:research-papers',
  homestead: null,
  implemented: true
});
assert.equal(agriculture.domainBoundExecutorImplemented, false);

console.log('agriculture opportunity routing: Homestead catalog is independent; investment and research route to their owning lanes');
