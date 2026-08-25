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

function resource(domain, external) {
  return {
    ownerDomain: domain,
    policyId: domain + '-resource/1',
    lanes: ['research'],
    budgets: { computeUnitsPerCycle: 20, queueCapacity: 4 },
    switches: { internalCycle: true, internalEmission: true, externalAction: external === true, spend: false, capital: false }
  };
}
function motor(domain, lane) {
  return {
    ownerDomain: domain,
    contractId: domain + '-motor/1',
    lane: lane,
    decisionContract: 'domain-motor-decision/1',
    budgetId: domain + '-budget/1',
    receiptClass: 'durable-receipt',
    outcomeClass: 'independent-outcome',
    rollbackClass: 'bounded-rollback',
    executorVerified: false,
    outcomeObserverVerified: false,
    switches: { prepare: true, simulate: true, external: false }
  };
}

var finance = new Base({ domainId: 'finance', label: 'Finance' });
var energy = new Base({ domainId: 'energy', label: 'Energy' });
finance.resourceAuthority = resource('finance', false);
energy.resourceAuthority = resource('energy', false);
finance.motorAuthority = motor('finance', 'broker/order');
energy.motorAuthority = motor('energy', 'investments');
finance._computeResourceMetabolism();
energy._computeResourceMetabolism();
var f = finance._computeMotorReadiness();
var e = energy._computeMotorReadiness();
assert.equal(f.state, 'SANDBOX_READY');
assert.equal(e.state, 'SANDBOX_READY');
assert.equal(f.gates.mayPrepare, true);
assert.equal(f.gates.maySimulate, true);
assert.equal(f.gates.mayDispatchExternal, false);
assert(f.blockers.includes('domain_external_motor_switch_off'));
assert(f.blockers.includes('production_executor_unverified'));
assert(f.blockers.includes('independent_outcome_observer_unverified'));
assert.notEqual(finance.state.motorReadiness, energy.state.motorReadiness);

finance.motorAuthority.switches.external = true;
var forged = finance._computeMotorReadiness();
assert.equal(forged.gates.mayDispatchExternal, false, 'a switch alone cannot bypass executor and outcome verification');

finance.motorAuthority.executorVerified = true;
finance.motorAuthority.outcomeObserverVerified = true;
var resourceHeld = finance._computeMotorReadiness();
assert.equal(resourceHeld.gates.mayDispatchExternal, false, 'motor readiness cannot bypass the domain resource external-action gate');

var wrong = new Base({ domainId: 'law', label: 'Law' });
wrong.resourceAuthority = resource('law', false);
wrong.motorAuthority = motor('finance', 'broker/order');
wrong._computeResourceMetabolism();
var inhibited = wrong._computeMotorReadiness();
assert.equal(inhibited.state, 'INHIBITED');
assert(inhibited.blockers.includes('motor_authority_missing_or_wrong_owner'));

console.log('product domain motor readiness: separate authority, contract, inhibition, and anti-bypass passed');
