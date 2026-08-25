'use strict';

var Commissioning = require('./finance-sandbox-commissioning.js');
var MotorReceipt = require('./product-domain-motor-receipt.js');

var SLOT_KEY = 'finance_paper_developmental_slot:1';

function held(reason, detail) {
  return { authorized: false, status: 'HELD', reason: reason, detail: detail || null };
}

async function authorize(store, packetId, env, now) {
  if (!Commissioning.enabled(env)) return held('finance-paper-commissioning-switch-off');
  store.assertDurable();
  var proof = await store.get(Commissioning.KEY);
  if (!proof || proof.status !== 'VERIFIED_ZERO_EFFECT_ROLLBACK' || proof.effectExecuted !== false) {
    return held('zero-effect-sandbox-rollback-proof-missing', proof);
  }
  var motor = await store.get(MotorReceipt.receiptKey('finance'));
  if (!motor || motor.schemaVersion !== MotorReceipt.SCHEMA || motor.productDomain !== 'finance' ||
      motor.ownerDomain !== 'finance' || motor.contractId !== 'finance-motor/1' || motor.lane !== 'broker/order') {
    return held('finance-motor-receipt-identity-invalid', motor);
  }
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var slot = {
    schemaVersion: 'finance-paper-developmental-authority/1.0',
    slot: 1,
    packetId: packetId,
    status: 'CLAIMED',
    claimedAt: new Date(at).toISOString(),
    commissioningCommandId: proof.commandId,
    maxDevelopmentalOrders: 1,
    paperOnly: true,
    liveMoney: false
  };
  var created = await store.setIfAbsent(SLOT_KEY, slot);
  if (!created) {
    var existing = await store.get(SLOT_KEY);
    if (!existing || existing.packetId !== packetId) return held('developmental-paper-order-cap-reached', existing);
    slot = existing;
  }
  return {
    ok: true,
    authorized: true,
    status: 'AUTHORIZED_DEVELOPMENTAL_PAPER',
    authorizationMode: 'developmental-paper-commissioning',
    receiptId: 'finance-developmental-slot-1',
    productDomain: 'finance',
    ownerDomain: 'finance',
    contractId: motor.contractId,
    lane: motor.lane,
    commissioningCommandId: proof.commandId,
    slot: slot,
    paperOnly: true,
    liveMoney: false
  };
}

module.exports = { SLOT_KEY: SLOT_KEY, authorize: authorize };
