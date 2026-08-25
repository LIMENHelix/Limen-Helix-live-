#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var vm = require('node:vm');

var source = fs.readFileSync('assets/js/domain-brains/domain-brain-base.js', 'utf8');
var window = { addEventListener: function () {}, dispatchEvent: function () {} };
var context = {
  window: window,
  console: { warn: function () {}, log: function () {} },
  fetch: function () { return Promise.resolve({ ok: false }); },
  setInterval: function () { return 1; },
  clearInterval: function () {},
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  CustomEvent: function (name, opts) { return { type: name, detail: opts && opts.detail }; },
  Date: Date,
  Math: Math,
  Promise: Promise
};
vm.runInNewContext(source, context, { filename: 'domain-brain-base.js' });
var Base = window.LIMENDomainBrainBase;
assert(Base);

function authority(domain) {
  return {
    ownerDomain: domain,
    policyId: domain + '-resource/1',
    lanes: ['research'],
    budgets: { computeUnitsPerCycle: 20, queueCapacity: 4 },
    switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false }
  };
}

var finance = new Base({ domainId: 'finance', label: 'Finance' });
var energy = new Base({ domainId: 'energy', label: 'Energy' });
finance.resourceAuthority = authority('finance');
energy.resourceAuthority = authority('energy');
finance.state.feeds = [{}, {}];
energy.state.feeds = [{}];

var f = finance._computeResourceMetabolism();
var e = energy._computeResourceMetabolism();
assert.equal(f.ownerDomain, 'finance');
assert.equal(e.ownerDomain, 'energy');
assert.equal(f.state, 'AVAILABLE');
assert.equal(f.gates.mayEmitInternal, true);
assert.equal(f.gates.mayActExternally, false);
assert.equal(f.gates.maySpend, false);
assert.notEqual(finance.state.resourceMetabolism, energy.state.resourceMetabolism);

finance.state.opportunities = [{}, {}, {}, {}, {}];
var pressure = finance._computeResourceMetabolism();
assert.equal(pressure.state, 'CONSERVE');
assert.equal(pressure.gates.mayEmitInternal, false);
assert(pressure.blockers.includes('domain_resource_pressure_high'));
assert.equal(energy.state.resourceMetabolism.state, 'AVAILABLE', 'one domain pressure must not mutate another brain');

var wrong = new Base({ domainId: 'law', label: 'Law' });
wrong.resourceAuthority = authority('finance');
var inhibited = wrong._computeResourceMetabolism();
assert.equal(inhibited.state, 'INHIBITED');
assert.equal(inhibited.gates.mayRunInternalCycle, false);
assert(inhibited.blockers.includes('resource_authority_missing_or_wrong_owner'));

console.log('product domain resource metabolism: separate state, authority, inhibition, and recovery passed');
