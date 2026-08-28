'use strict';

var MotorReceipt = require('./product-domain-motor-receipt.js');
var Commissioning = require('./finance-sandbox-commissioning.js');
var SLOT_KEY = 'economy_investment_developmental_slot:1';

function enabled(env) {
  var value = env && env.LIMEN_ECONOMY_INVESTMENT_DEVELOPMENTAL_ENABLED;
  return value === '1' || value === 'true' || value === 'TRUE';
}
function held(reason, detail) { return { authorized: false, status: 'HELD', reason: reason, detail: detail || null }; }
async function authorize(store, requestId, env, now) {
  if (!enabled(env)) return held('economy-investment-developmental-switch-off');
  store.assertDurable();
  var proof = await store.get(Commissioning.KEY);
  if (!proof || proof.status !== 'VERIFIED_ZERO_EFFECT_ROLLBACK' || proof.effectExecuted !== false) {
    return held('shared-tradier-sandbox-zero-effect-proof-missing', proof);
  }
  var motor = await store.get(MotorReceipt.receiptKey('economy'));
  if (!motor || motor.schemaVersion !== MotorReceipt.SCHEMA || motor.productDomain !== 'economy' || motor.ownerDomain !== 'economy' ||
      motor.contractId !== 'economy-motor/1' || motor.lane !== 'investments') return held('economy-motor-receipt-identity-invalid', motor);
  var at = Number(now) || Date.now();
  var slot = { schemaVersion: 'economy-investment-developmental-authority/1.0', slot: 1, requestId: requestId,
    status: 'CLAIMED', claimedAt: new Date(at).toISOString(), commissioningCommandId: proof.commandId,
    maxDevelopmentalOrders: 1, paperOnly: true, liveMoney: false };
  var made = await store.setIfAbsent(SLOT_KEY, slot);
  if (!made) {
    slot = await store.get(SLOT_KEY);
    if (!slot || slot.requestId !== requestId) return held('economy-developmental-paper-order-cap-reached', slot);
  }
  return { ok: true, authorized: true, status: 'AUTHORIZED_DEVELOPMENTAL_PAPER', authorizationMode: 'developmental-paper-commissioning',
    receiptId: 'economy-developmental-slot-1', productDomain: 'economy', ownerDomain: 'economy', contractId: motor.contractId,
    lane: motor.lane, commissioningCommandId: proof.commandId, slot: slot, paperOnly: true, liveMoney: false };
}

module.exports = { SLOT_KEY: SLOT_KEY, enabled: enabled, authorize: authorize };
