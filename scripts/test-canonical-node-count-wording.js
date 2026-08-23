'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var files = [
  'assets/data/schemas/treatment-discovery-cell.schema.js',
  'scripts/build-brain-node-business-mapping.js',
  'handlers/enrich-portal-claude.js',
  'scripts/organ-binding-fidelity.mjs'
];
var stale = /124\s*[- ]\s*(?:node|taxonomy)|124\s+LIMEN\s+canonical\s+node/i;
files.forEach(function (file) {
  var text = fs.readFileSync(path.join(root, file), 'utf8');
  assert(!stale.test(text), 'stale 124-node wording remains in ' + file);
  assert(/123/.test(text), 'canonical count is not stated in ' + file);
});
var canonical = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/canonical-nodes.json'), 'utf8'));
assert.strictEqual(canonical._meta.total, 123);
assert.strictEqual(Object.keys(canonical.nodes).length, 123);
console.log('10/10 passed');

