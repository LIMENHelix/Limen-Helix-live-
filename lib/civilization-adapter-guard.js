'use strict';

/**
 * Last-moment inhibition for an irreversible external adapter.
 *
 * Route admission and B10/B14 authorization happen earlier in a request.  A
 * NUKE or local valve may close while command/efference state is being made
 * durable.  Every external side effect therefore re-reads the same durable
 * valve immediately before dispatch.  This module selects no action and opens
 * no valve; it can only pass an already-authorized effect or inhibit it.
 */

var Registry = require('./civilization-valve-registry.js');

var SCHEMA = 'civilization-adapter-checkpoint/1.0';
var INHIBITED = 'CIVILIZATION_ADAPTER_INHIBITED';

function investmentValve(ownerDomain) {
  var owner = String(ownerDomain || '').trim().toLowerCase();
  if (owner === 'finance') return 'finance:broker-order';
  if (owner === 'economy' || owner === 'energy' || owner === 'technology') return owner + ':investments';
  return null;
}

async function checkpoint(store, valveId, effect, now) {
  if (!store || typeof store.assertDurable !== 'function') {
    var missing = new Error('strict durable store required at external adapter checkpoint');
    missing.code = INHIBITED; missing.providerCalled = false; throw missing;
  }
  store.assertDurable();
  var line = Registry.get(valveId);
  if (!line) {
    var unknown = new Error('unknown external adapter valve ' + String(valveId || ''));
    unknown.code = INHIBITED; unknown.providerCalled = false; throw unknown;
  }
  // Resolve after the caller's control-plane modules have initialized. Several
  // executor graphs load the valve registry while the control module is still
  // establishing its own commissioning dependencies; retaining that partial
  // CommonJS export would turn an open valve into a runtime TypeError.
  var Control = require('./civilization-valve-control.js');
  var result = await Control.authorize(valveId, store);
  if (!result || result.allowed !== true) {
    var held = new Error(result && result.reason || 'external adapter valve unavailable');
    held.code = INHIBITED;
    held.providerCalled = false;
    held.valveId = valveId;
    held.valveReason = result && result.reason || 'external-adapter-valve-unavailable';
    held.valveReceiptId = result && result.receipt && result.receipt.receiptId || null;
    throw held;
  }
  return {
    schemaVersion: SCHEMA,
    valveId: valveId,
    productDomain: line.productDomain,
    ownerDomain: line.ownerDomain,
    lane: line.lane,
    effect: String(effect || 'external-effect'),
    checkedAt: new Date(Number.isFinite(Number(now)) ? Number(now) : Date.now()).toISOString(),
    allowed: true,
    valveReceiptId: result.receipt && result.receipt.receiptId || null,
    authority: 'last-moment-inhibition-only'
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  INHIBITED: INHIBITED,
  investmentValve: investmentValve,
  checkpoint: checkpoint
};
