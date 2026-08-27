'use strict';
var crypto = require('node:crypto'), Decision = require('./intelligence-autopilot-decision.js'), Motor = require('./product-domain-motor-authorization.js'), Developmental = require('./intelligence-autopilot-developmental-authority.js'), Learning = require('./intelligence-autopilot-learning.js'), AdapterGuard = require('./civilization-adapter-guard.js');
var SCHEMA = 'intelligence-autopilot-command/1.0', LOG_KEY = 'intelligence_autopilot_command_log', PENDING_KEY = 'intelligence_autopilot_pending_log';
var PREFIX = 'intelligence_autopilot_command:', ACTION = 'intelligence_autopilot_action:', MOTOR = 'intelligence_autopilot_motor_claim:', BUDGET = 'intelligence_autopilot_budget_slot:';
var SUPPRESSION_KEY = 'intelligence_autopilot_suppression_catalog';
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); } function commandKey(id) { return PREFIX + id; } function actionKey(id) { return ACTION + id; } function motorKey(id) { return MOTOR + id; }
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason, providerCalls: 0, productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot', liveMoney: false }, extra || {}); }
async function save(store, v) { await store.set(commandKey(v.commandId), v); var r = await store.get(commandKey(v.commandId)); if (!r || r.status !== v.status) throw new Error('intelligence autopilot command readback invalid'); return r; }
async function budgetSlot(store, actionId, slots, now, cost) { var day = new Date(now).toISOString().slice(0, 10);
  for (var i = 1; i <= slots; i++) { var k = BUDGET + day + ':' + i, v = { schemaVersion: SCHEMA, actionId: actionId, day: day, slot: i, estimatedCostUsd: cost, claimedAt: now };
    var created = await store.setIfAbsent(k, v), r = await store.get(k); if (r && r.actionId === actionId) return { ok: true, slot: i, duplicate: !created }; } return { ok: false, reason: 'intelligence-autopilot-daily-budget-exhausted' }; }
async function execute(input) { input = input || {}; var store = input.store, v = input.candidate, decision = input.decision, now = Number(input.now) || Date.now();
  if (!Decision.validateReceipt(decision, v, now)) return held('intelligence-autopilot-exact-b10-decision-required');
  var cost = Number(input.emailCostUsd), budget = Number(input.dailyBudgetUsd), cap = Math.max(0, Math.min(200, Number(input.dailyEmailCap) || 0));
  if (input.emailCostUsd == null || !Number.isFinite(cost) || cost < 0) return held('intelligence-autopilot-email-cost-not-configured');
  if (!cap) return held('intelligence-autopilot-daily-email-cap-zero');
  if (cost > 0 && (!Number.isFinite(budget) || budget < cost)) return held('intelligence-autopilot-daily-dollar-budget-not-configured-or-too-small');
  var slots = Math.min(cap, cost === 0 ? cap : Math.floor((budget + 1e-12) / cost)); if (!slots) return held('intelligence-autopilot-daily-budget-zero');
  try { store.assertDurable(); var suppression = await store.get(SUPPRESSION_KEY); if (suppression && suppression[v.emailHash] && suppression[v.emailHash].suppressed) return held('intelligence-autopilot-recipient-suppressed');
    var auth = await (input.motorAuthorization || Motor).authorize(store, 'intelligence', 'autopilot', now);
    if (!auth || !auth.authorized) auth = await (input.developmentalAuthorization || Developmental).authorize(store, v, decision, input.env || process.env, now);
    if (!auth || !auth.authorized) return held(auth && auth.reason || 'intelligence-autopilot-motor-held', { motorReceiptId: auth && auth.receiptId || null, motorBlockers: auth && auth.blockers || [] });
    var prior = await store.get(actionKey(decision.actionId)); if (prior) return Object.assign({ ok: prior.status === 'ACCEPTED', accepted: prior.status === 'ACCEPTED' ? 1 : 0, replayed: true }, prior);
    var commandId = 'iac_' + hash({ actionId: decision.actionId, motor: auth.receiptId }).slice(0, 24), command = { schemaVersion: SCHEMA, commandId: commandId, actionId: decision.actionId,
      decisionReceiptId: decision.decisionReceiptId, status: 'COMMANDING', productDomain: 'intelligence', ownerDomain: 'intelligence', lane: 'autopilot', productMotorReceiptId: auth.receiptId,
      leadHash: v.leadHash, emailHash: v.emailHash, subjectDomain: v.subjectDomain, actionKind: v.actionKind, transition: v.transition, subjectHash: v.subjectHash, contentHash: v.contentHash,
      predictedOutcome: decision.predictedOutcome, emailCostUsd: cost, dailyBudgetUsd: cost === 0 ? 0 : budget, dailyEmailCap: cap,
      authorizationReceiptId: auth.receiptId, authorizationMode: auth.authorizationMode || 'mature-production-capability',
      commissioningOnly: auth.commissioningOnly === true, ownedDestinationVerified: auth.ownedDestinationVerified === true,
      recipientConsentVerified: auth.recipientConsentVerified === true, businessStateTransitionSuppressed: auth.commissioningOnly === true,
      providerCalls: 0, commandedAt: now, liveMoney: false };
    var existing = await store.get(commandKey(commandId)); if (existing) return Object.assign({ ok: existing.status === 'ACCEPTED', accepted: existing.status === 'ACCEPTED' ? 1 : 0, replayed: true }, existing);
    if (!(await store.setIfAbsent(commandKey(commandId), command))) return store.get(commandKey(commandId)); command = await store.get(commandKey(commandId)); if (!command || command.status !== 'COMMANDING') throw new Error('intelligence autopilot pre-dispatch command readback invalid');
    if (!(await store.setIfAbsent(motorKey(auth.receiptId), { schemaVersion: SCHEMA, commandId: commandId, productMotorReceiptId: auth.receiptId, claimedAt: now }))) { command.status = 'REFUSED'; command.reason = 'intelligence-autopilot-motor-receipt-already-consumed'; return save(store, command); }
    var mc = await store.get(motorKey(auth.receiptId)); if (!mc || mc.commandId !== commandId) throw new Error('intelligence autopilot motor claim readback invalid');
    var bc = await budgetSlot(store, decision.actionId, slots, now, cost); if (!bc.ok) { command.status = 'HELD_BUDGET'; command.reason = bc.reason; return save(store, command); } command.budgetSlot = bc.slot;
    await store.lpush(PENDING_KEY, command); await store.ltrim(PENDING_KEY, 0, 999); var idem = 'intelligence-autopilot/' + decision.actionId;
    var action = { schemaVersion: SCHEMA, actionId: decision.actionId, commandId: commandId, status: 'DISPATCHING', idempotencyKey: idem, claimedAt: now };
    if (!(await store.setIfAbsent(actionKey(decision.actionId), action))) return store.get(actionKey(decision.actionId)); var ar = await store.get(actionKey(decision.actionId)); if (!ar || ar.status !== 'DISPATCHING') throw new Error('intelligence autopilot action claim readback invalid');
    command.status = 'DISPATCHING'; command.idempotencyKey = idem; command = await save(store, command); await Learning.recordCommand(store, command); if (!input.transport || typeof input.transport.send !== 'function') throw new Error('intelligence autopilot transport missing');
    var result; try { command.adapterGuard = await (input.adapterGuard || AdapterGuard).checkpoint(store, 'intelligence:autopilot', 'resend-autopilot-email'); result = await input.transport.send(v.email, v.subject, v.body, { idempotencyKey: idem }); } catch (e) { result = { ok: false, providerCalled: e && e.code === AdapterGuard.INHIBITED ? false : true, definitiveFailure: e && e.code === AdapterGuard.INHIBITED, ambiguous: e && e.code !== AdapterGuard.INHIBITED, error: String(e && e.message || e) }; }
    command.providerCalls = result && result.providerCalled === false ? 0 : 1; command.providerEmailId = result && result.id || null;
    command.status = result && result.ok && result.id ? 'ACCEPTED' : result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS'; command.failure = result && !result.ok ? String(result.error || 'send-unresolved').slice(0, 240) : null; command.resolvedAt = Date.now(); command.readbackVerified = true;
    if (command.status === 'ACCEPTED' && command.commissioningOnly === true) {
      var catalog = await store.get(SUPPRESSION_KEY); if (!catalog || typeof catalog !== 'object') catalog = {};
      catalog[v.emailHash] = { suppressed: true, reason: 'owned-destination-commissioning-complete', actionId: command.actionId,
        authorizationReceiptId: command.authorizationReceiptId, at: command.resolvedAt };
      await store.set(SUPPRESSION_KEY, catalog); var restoredCatalog = await store.get(SUPPRESSION_KEY);
      if (!restoredCatalog || !restoredCatalog[v.emailHash] || restoredCatalog[v.emailHash].actionId !== command.actionId) throw new Error('intelligence commissioning suppression readback invalid');
      command.futureSuppressionRecoveryVerified = true;
      command.suppressionReceiptId = 'intelligence-autopilot-suppression:' + v.emailHash;
    }
    action.status = command.status; action.providerEmailId = command.providerEmailId; action.resolvedAt = command.resolvedAt; await store.set(actionKey(decision.actionId), action); ar = await store.get(actionKey(decision.actionId)); if (!ar || ar.status !== command.status) throw new Error('intelligence autopilot action receipt readback invalid');
    command = await save(store, command); await store.lpush(LOG_KEY, command); await store.ltrim(LOG_KEY, 0, 999); return Object.assign({ ok: command.status === 'ACCEPTED', accepted: command.status === 'ACCEPTED' ? 1 : 0 }, command);
  } catch (error) { return { ok: false, status: 'REFUSED', accepted: 0, reason: 'intelligence-autopilot-strict-boundary-unavailable', detail: String(error && error.message || error), providerCalls: 0, liveMoney: false }; } }
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_KEY: PENDING_KEY, SUPPRESSION_KEY: SUPPRESSION_KEY, commandKey: commandKey, actionKey: actionKey, motorKey: motorKey, execute: execute };
