'use strict';

/**
 * Resolve one product brain's external-action eligibility from its own declared
 * valve line. This is shared control-plane physiology, not shared cognition:
 * the overlay cannot select an action, move money, spend, or alter another
 * brain. Commissioned lanes remain available while their provider/budget gates
 * and circuit breakers are healthy; missing or mismatched evidence fails closed.
 */

var Registry = require('./civilization-valve-registry.js');
var Control = require('./civilization-valve-control.js');

function held(productDomain, reason, extras) {
  return Object.assign({
    ok: true,
    productDomain: productDomain || null,
    declared: false,
    eligible: false,
    externalValveId: null,
    ownerDomain: null,
    lane: null,
    hardGatesOpen: false,
    runtimeValveOpen: false,
    reason: reason
  }, extras || {});
}

function gateEvidence(state) {
  return (state && Array.isArray(state.gates) ? state.gates : []).map(function (gate) {
    return { name: gate.name, configured: gate.configured === true, open: gate.open === true };
  });
}

function clear(brain) {
  if (brain && brain.resourceAuthority && brain.resourceAuthority.switches) {
    brain.resourceAuthority.switches.externalAction = false;
  }
  if (brain && brain.motorAuthority && brain.motorAuthority.switches) {
    brain.motorAuthority.switches.external = false;
  }
}

async function inspect(store, productDomain, brain, env) {
  try {
    if (!store || typeof store.assertDurable !== 'function') {
      return held(productDomain, 'strict-store-required');
    }
    store.assertDurable();
    if (!brain || !brain.resourceAuthority || !brain.motorAuthority) {
      return held(productDomain, 'product-brain-authority-missing');
    }
    var resource = brain.resourceAuthority;
    var motor = brain.motorAuthority;
    var valveId = typeof motor.externalValveId === 'string' ? motor.externalValveId : '';
    if (!valveId) return held(productDomain, 'domain-external-valve-undeclared');

    var line = Registry.get(valveId);
    var base = {
      declared: true,
      externalValveId: valveId,
      ownerDomain: motor.ownerDomain || null,
      lane: motor.lane || null
    };
    if (!line) return held(productDomain, 'domain-external-valve-unknown', base);
    if (line.productDomain !== productDomain) return held(productDomain, 'domain-external-product-mismatch', base);
    if (line.ownerDomain !== motor.ownerDomain || line.ownerDomain !== resource.ownerDomain || line.ownerDomain !== brain.domainId) {
      return held(productDomain, 'domain-external-owner-mismatch', base);
    }
    if (line.lane !== motor.lane) return held(productDomain, 'domain-external-lane-mismatch', base);
    if (!resource.switches || !motor.switches) return held(productDomain, 'domain-external-switch-structure-missing', base);

    var hard = Registry.hardGateState(line, env || process.env);
    base.hardGates = gateEvidence(hard);
    base.hardGatesOpen = hard.open === true;
    if (!hard.open) return held(productDomain, 'domain-external-hard-gates-closed', base);

    var runtime = await Control.authorize(valveId, store);
    base.runtimeValveOpen = runtime && runtime.allowed === true;
    base.runtimeValveReceiptId = runtime && runtime.receipt && runtime.receipt.receiptId || null;
    if (!runtime || runtime.allowed !== true) {
      return held(productDomain, runtime && runtime.reason || 'domain-runtime-valve-unavailable', base);
    }

    return Object.assign({}, base, {
      ok: true,
      eligible: true,
      reason: null
    });
  } catch (error) {
    return held(productDomain, 'external-valve-overlay-unavailable:' + String(error && error.message || error));
  }
}

async function apply(store, productDomain, brain, env) {
  // Clear first so a previous positive cannot survive a closed budget/provider
  // gate, a circuit-breaker event, a declaration mismatch, or storage failure.
  clear(brain);
  var result = await inspect(store, productDomain, brain, env);
  if (result.eligible === true) {
    brain.resourceAuthority.switches.externalAction = true;
    brain.motorAuthority.switches.external = true;
  }
  if (brain && brain.state && typeof brain._computeResourceMetabolism === 'function') {
    brain._computeResourceMetabolism();
  }
  if (brain && brain.state && typeof brain._computeMotorReadiness === 'function') {
    brain._computeMotorReadiness();
  }
  return result;
}

module.exports = { held: held, inspect: inspect, apply: apply };
