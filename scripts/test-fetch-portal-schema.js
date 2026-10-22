/**
 * test-fetch-portal-schema.js — portal proxy schema regressions.
 *
 * Covers the PR406 blockers:
 *   - registry-declared hierarchy labels (PVN -> HYPO) are declared topology
 *     and must not be treated as undeclared nodes or rewritten;
 *   - authored {from,to} edges are accepted alongside {source,target} and {a,b};
 *   - present circuits/_authored collections must be arrays, because portal
 *     rendering calls array methods on them.
 *
 * RUN: node scripts/test-fetch-portal-schema.js
 */
'use strict';

var assert = require('assert');
var PORTAL = require('../handlers/fetch-portal');

var failures = 0, tests = 0;
function check(name, fn) {
  tests++;
  try {
    fn();
    console.log('  pass: ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL: ' + name + ' — ' + (e && e.message));
  }
}

function validPortal(overrides) {
  var base = {
    domainId: 'energy',
    title: 'Portal fixture',
    phase: 'p4',
    activations: [{ brainNodeId: 'HYPO' }],
    issues: [],
    edges: []
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

console.log('fetch-portal schema');

check('a baseline portal validates', function () {
  assert.equal(PORTAL.validatePortalSchema(validPortal(), 'energy'), null);
});

check('registry hierarchy labels are declared nodes', function () {
  assert.equal(PORTAL.isDeclaredNode('PVN'), true, 'PVN hierarchy label rejected');
  assert.equal(PORTAL.isDeclaredNode('Paraventricular Nucleus'), true, 'named hierarchy label rejected');
  assert.equal(PORTAL.isDeclaredNode('HYPO'), true, 'canonical aggregate rejected');
  assert.equal(PORTAL.isDeclaredNode('NOT_DECLARED'), false, 'undeclared node accepted');
});

check('authored activation labels outside the canonical registry validate', function () {
  /* finance.json serves AMY and INS. They are authored display labels, not
     edge endpoints, so the canonical gate must not reject the file. */
  var portal = validPortal({
    domainId: 'finance',
    activations: [{ brainNodeId: 'AMY' }, { brainNodeId: 'INS' }, { brainNodeId: 'HYPO' }]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'finance'), null);
});

check('energy PVN -> HYPO edge validates at its authored index', function () {
  var edges = [];
  for (var i = 0; i < 30; i++) edges.push({ from: 'HYPO', to: 'HYPO' });
  edges.push({ from: 'PVN', to: 'HYPO' });
  var portal = validPortal({ edges: edges });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), null);
  assert.equal(portal.edges[30].from, 'PVN', 'authored topology was rewritten');
  assert.equal(portal.edges[30].to, 'HYPO', 'authored topology was rewritten');
});

check('business {from,to} edges with canonical endpoints validate', function () {
  var portal = validPortal({
    domainId: 'business',
    edges: [
      { from: 'SN', to: 'SNIG' },
      { from: 'HYPO', to: 'PVN' }
    ]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'business'), null);
});

check('legacy source/target and a/b edge shapes still validate', function () {
  var portal = validPortal({
    edges: [
      { source: 'HYPO', target: 'PVN' },
      { a: 'SN', b: 'SNIG' }
    ]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), null);
});

check('a genuinely undeclared edge endpoint still fails closed', function () {
  var portal = validPortal({ edges: [{ from: 'PVN', to: 'NOT_DECLARED' }] });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), 'edge-undeclared-node@0');
});

check('an edge with no recognized endpoint pair still fails closed', function () {
  var portal = validPortal({ edges: [{ note: 'not an edge' }] });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), 'edge-undeclared-node@0');
});

check('object-valued circuits is rejected', function () {
  var portal = validPortal({ issues: [{ circuits: { nodeId: 'HYPO' } }] });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), 'issue-circuits-not-array@0');
});

check('object-valued _authored is rejected', function () {
  var portal = validPortal({ issues: [{ _authored: { nodeId: 'HYPO' } }] });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), 'issue-authored-not-array@0');
});

check('array-valued issue collections still validate', function () {
  var portal = validPortal({
    issues: [{
      circuits: [{ nodeId: 'HYPO' }],
      _authored: [{ nodeId: 'PVN' }]
    }]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), null);
});

check('an edge may reference a portal-authored node label', function () {
  var portal = validPortal({
    domainId: 'defense',
    activations: [{ brainNodeId: 'FPN' }, { brainNodeId: 'EMG' }],
    edges: [{ source: 'FPN', target: 'EMG', type: 'SUPPLIES' }]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'defense'), null);
});

check('authored issue labels validate without canonical registry membership', function () {
  var portal = validPortal({
    domainId: 'education',
    issues: [{ circuits: [{ nodeId: 'FUND' }, { nodeId: 'AIns' }] }]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'education'), null);
});

check('an issue element with no nodeId still fails', function () {
  var portal = validPortal({ issues: [{ circuits: [{}] }] });
  assert.equal(PORTAL.validatePortalSchema(portal, 'energy'), 'issue-circuit-node-id@0:0');
});

check('an undeclared edge endpoint still fails', function () {
  var portal = validPortal({
    domainId: 'defense',
    edges: [{ source: 'FPN', target: 'NOT_DECLARED' }]
  });
  assert.equal(PORTAL.validatePortalSchema(portal, 'defense'), 'edge-undeclared-node@0');
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('fetch-portal schema: ' + (tests - failures) + '/' + tests + ' passed');
