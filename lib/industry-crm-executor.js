"use strict";
var crypto = require("node:crypto"),
  Decision = require("./industry-crm-decision.js"),
  Motor = require("./product-domain-motor-authorization.js"),
  Learning = require("./industry-crm-learning.js"),
  AdapterGuard = require("./civilization-adapter-guard.js");
var SCHEMA = "industry-crm-command/1.0",
  LOG_KEY = "industry_crm_command_log",
  PENDING_KEY = "industry_crm_pending_log",
  PREFIX = "industry_crm_command:",
  ACTION = "industry_crm_action:",
  MOTOR = "industry_crm_motor_claim:",
  BUDGET = "industry_crm_budget_slot:",
  SUPPRESSION_KEY = "industry_crm_suppression_catalog";
function hash(v) {
  return crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
function commandKey(id) {
  return PREFIX + id;
}
function actionKey(id) {
  return ACTION + id;
}
function motorKey(id) {
  return MOTOR + id;
}
function held(reason, x) {
  return Object.assign(
    {
      ok: true,
      status: "HELD",
      accepted: 0,
      reason: reason,
      providerCalls: 0,
      productDomain: "industry",
      ownerDomain: "industry",
      lane: "crm",
      liveMoney: false,
    },
    x || {},
  );
}
async function save(s, v) {
  await s.set(commandKey(v.commandId), v);
  var r = await s.get(commandKey(v.commandId));
  if (!r || r.status !== v.status)
    throw new Error("industry crm command readback invalid");
  return r;
}
async function slot(s, actionId, slots, now, cost) {
  var day = new Date(now).toISOString().slice(0, 10);
  for (var i = 1; i <= slots; i++) {
    var k = BUDGET + day + ":" + i,
      v = {
        schemaVersion: SCHEMA,
        actionId: actionId,
        day: day,
        slot: i,
        estimatedCostUsd: cost,
        claimedAt: now,
      },
      created = await s.setIfAbsent(k, v),
      r = await s.get(k);
    if (r && r.actionId === actionId)
      return { ok: true, slot: i, duplicate: !created };
  }
  return { ok: false, reason: "industry-crm-daily-budget-exhausted" };
}
async function execute(i) {
  i = i || {};
  var s = i.store,
    v = i.candidate,
    d = i.decision,
    now = Number(i.now) || Date.now();
  if (!Decision.validateReceipt(d, v, now))
    return held("industry-crm-exact-b10-decision-required");
  var cost = Number(i.operationCostUsd),
    budget = Number(i.dailyBudgetUsd),
    cap = Math.max(0, Math.min(100, Number(i.dailyOperationCap) || 0));
  if (i.operationCostUsd == null || !Number.isFinite(cost) || cost < 0)
    return held("industry-crm-operation-cost-not-configured");
  if (!cap) return held("industry-crm-daily-operation-cap-zero");
  if (cost > 0 && (!Number.isFinite(budget) || budget < cost))
    return held("industry-crm-daily-dollar-budget-not-configured-or-too-small");
  var slots = Math.min(
    cap,
    cost === 0 ? cap : Math.floor((budget + 1e-12) / cost),
  );
  try {
    s.assertDurable();
    var sup = await s.get(SUPPRESSION_KEY);
    if (sup && sup[v.companyHash] && sup[v.companyHash].suppressed)
      return held("industry-crm-company-suppressed");
    var auth = await (i.motorAuthorization || Motor).authorize(
      s,
      "industry",
      "crm",
      now,
    );
    if (!auth || !auth.authorized)
      return held((auth && auth.reason) || "industry-crm-motor-held", {
        motorReceiptId: (auth && auth.receiptId) || null,
      });
    var prior = await s.get(actionKey(d.actionId));
    if (prior)
      return Object.assign(
        {
          ok: prior.status === "ACCEPTED",
          accepted: prior.status === "ACCEPTED" ? 1 : 0,
          replayed: true,
        },
        prior,
      );
    var commandId =
        "icc_" +
        hash({ action: d.actionId, motor: auth.receiptId }).slice(0, 24),
      c = {
        schemaVersion: SCHEMA,
        commandId: commandId,
        actionId: d.actionId,
        decisionReceiptId: d.decisionReceiptId,
        status: "COMMANDING",
        productDomain: "industry",
        ownerDomain: "industry",
        lane: "crm",
        productMotorReceiptId: auth.receiptId,
        warnKeyHash: v.warnKeyHash,
        companyHash: v.companyHash,
        sourceIdentityHash: v.sourceIdentityHash,
        predictedOutcome: d.predictedOutcome,
        initialLifecycleStage: "lead",
        operationCostUsd: cost,
        dailyBudgetUsd: cost === 0 ? 0 : budget,
        dailyOperationCap: cap,
        providerCalls: 0,
        commandedAt: now,
        liveMoney: false,
      };
    if (!(await s.setIfAbsent(commandKey(commandId), c)))
      return s.get(commandKey(commandId));
    c = await s.get(commandKey(commandId));
    if (!c || c.status !== "COMMANDING")
      throw new Error("industry crm pre-dispatch readback invalid");
    if (
      !(await s.setIfAbsent(motorKey(auth.receiptId), {
        schemaVersion: SCHEMA,
        commandId: commandId,
        productMotorReceiptId: auth.receiptId,
        claimedAt: now,
      }))
    ) {
      c.status = "REFUSED";
      c.reason = "industry-crm-motor-receipt-already-consumed";
      return save(s, c);
    }
    var mc = await s.get(motorKey(auth.receiptId));
    if (!mc || mc.commandId !== commandId)
      throw new Error("industry crm motor claim readback invalid");
    var bs = await slot(s, d.actionId, slots, now, cost);
    if (!bs.ok) {
      c.status = "HELD_BUDGET";
      c.reason = bs.reason;
      return save(s, c);
    }
    c.budgetSlot = bs.slot;
    await s.lpush(PENDING_KEY, c);
    await s.ltrim(PENDING_KEY, 0, 999);
    var a = {
      schemaVersion: SCHEMA,
      actionId: d.actionId,
      commandId: commandId,
      status: "DISPATCHING",
      claimedAt: now,
    };
    if (!(await s.setIfAbsent(actionKey(d.actionId), a)))
      return s.get(actionKey(d.actionId));
    c.status = "DISPATCHING";
    c = await save(s, c);
    await Learning.recordCommand(s, c);
    if (!i.provider || typeof i.provider.create !== "function")
      throw new Error("industry crm provider missing");
    var result;
    try {
      c.adapterGuard = await (i.adapterGuard || AdapterGuard).checkpoint(
        s,
        "industry:crm",
        "hubspot-company-create",
      );
      result = await i.provider.create(v);
    } catch (e) {
      result = {
        ok: false,
        providerCalled: e && e.code === AdapterGuard.INHIBITED ? false : true,
        definitiveFailure: e && e.code === AdapterGuard.INHIBITED,
        ambiguous: e && e.code !== AdapterGuard.INHIBITED,
        error: String((e && e.message) || e),
      };
    }
    c.providerCalls = result && result.providerCalled === false ? 0 : 1;
    c.hubspotCompanyId = (result && result.id) || null;
    c.status =
      result && result.ok && result.id
        ? "ACCEPTED"
        : result && result.definitiveFailure
          ? "FAILED"
          : "AMBIGUOUS";
    c.failure =
      result && !result.ok
        ? String(result.error || "hubspot-unresolved").slice(0, 240)
        : null;
    c.resolvedAt = Date.now();
    c.readbackVerified = true;
    a.status = c.status;
    a.hubspotCompanyId = c.hubspotCompanyId;
    a.resolvedAt = c.resolvedAt;
    await s.set(actionKey(d.actionId), a);
    var ar = await s.get(actionKey(d.actionId));
    if (!ar || ar.status !== c.status)
      throw new Error("industry crm action receipt readback invalid");
    c = await save(s, c);
    await s.lpush(LOG_KEY, c);
    await s.ltrim(LOG_KEY, 0, 999);
    return Object.assign(
      {
        ok: c.status === "ACCEPTED",
        accepted: c.status === "ACCEPTED" ? 1 : 0,
      },
      c,
    );
  } catch (e) {
    return {
      ok: false,
      status: "REFUSED",
      accepted: 0,
      reason: "industry-crm-strict-boundary-unavailable",
      detail: String((e && e.message) || e),
      providerCalls: 0,
      liveMoney: false,
    };
  }
}
module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  PENDING_KEY: PENDING_KEY,
  SUPPRESSION_KEY: SUPPRESSION_KEY,
  commandKey: commandKey,
  actionKey: actionKey,
  motorKey: motorKey,
  execute: execute,
};
