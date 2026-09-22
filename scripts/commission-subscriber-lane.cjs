#!/usr/bin/env node
'use strict';

/**
 * scripts/commission-subscriber-lane.cjs — run the EXISTING Intelligence
 * owned-destination commissioning chain, whose proof the subscriber-email
 * capability verifier then projects onto every paid-subscriber lane.
 *
 * Nothing here is a second verifier. The chain is the production one:
 *
 *   intelligence-autopilot-decision        (B10 decision on the exact candidate)
 *   intelligence-autopilot-executor        (ONE send via lib/crm-send → Resend,
 *                                           then durable suppression of the
 *                                           commissioning address)
 *   intelligence-autopilot-outcome-observer (independent Resend READ API receipt)
 *   intelligence-autopilot-capability-verifier.verifyAndPersist
 *   subscriber-email-capability-verifier.run({ persist: true })
 *                                           (projects executor+observer
 *                                           capability receipts to 19 lanes)
 *
 * MODES
 *   dry-run (default): the full chain runs against an in-memory store with a
 *     stubbed provider (send acceptance and read API are simulated). Nothing
 *     leaves the process; nothing is persisted; the permanent one-shot
 *     developmental slot is NOT touched.
 *   --live: the same chain against the durable store, sending exactly ONE real
 *     email to the operator-supplied address. Requires --address AND --live
 *     AND --consent, plus the commissioning env vars (see
 *     ops/subscriber-enablement.md). The address must equal
 *     INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL.
 *
 * USAGE
 *   node scripts/commission-subscriber-lane.cjs --address=ops@example.com
 *   node scripts/commission-subscriber-lane.cjs --address=ops@example.com --live --consent
 */

var Decision = require('../lib/intelligence-autopilot-decision.js');
var Executor = require('../lib/intelligence-autopilot-executor.js');
var Observer = require('../lib/intelligence-autopilot-outcome-observer.js');
var IntelligenceVerifier = require('../lib/intelligence-autopilot-capability-verifier.js');
var SubscriberVerifier = require('../lib/subscriber-email-capability-verifier.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Crm = require('../lib/crm-send.js');
var Registry = require('../lib/env-capability-registry.js');

var COMMISSIONING_MAIL = {
  // Same copy the autopilot uses for its commissioning action
  // (handlers/autopilot.js emailFor, kind 'commissioning').
  subject: 'LIMEN Intelligence motor commissioning',
  body: 'Internal LIMEN owned-destination commissioning. No prospect outreach, offer, or sales-stage transition is authorized by this message.'
};

function MemoryStore() { this.values = new Map(); this.lists = new Map(); }
MemoryStore.prototype.assertDurable = function () { return true; };
MemoryStore.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
MemoryStore.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
MemoryStore.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
MemoryStore.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
MemoryStore.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
MemoryStore.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };

function simulatedBrain(now) {
  return { ts: now, c: { domain: 'intelligence', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'intelligence', packetId: 'dry-run-intelligence-packet', generatedAt: new Date(now).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 1, live: 1 } } } } };
}

function simulatedIntelligenceMotor(now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'pdmr_dry_run_intelligence', productDomain: 'intelligence', ownerDomain: 'intelligence',
    contractId: 'intelligence-motor/1', lane: 'autopilot', status: 'HELD',
    contracts: { decision: 'bounded-command-decision/1', budget: 'intelligence-autopilot-budget/1',
      receipt: 'command-receipt', independentOutcome: 'independent-world-measurement', rollback: 'kill-and-compensate' },
    gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: false },
    safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 }, persistedAt: now };
}

function simulatedReligionMotor(now) {
  return { schemaVersion: Motor.SCHEMA, receiptId: 'pdmr_dry_run_religion', productDomain: 'religion', ownerDomain: 'religion',
    contractId: 'religion-motor/1', lane: 'subscriber-email', status: 'EXECUTOR_PENDING', persistedAt: now,
    contracts: { decision: 'religion-decision/1', budget: 'religion-budget/1', receipt: 'religion-subscriber-command/1.0',
      independentOutcome: 'religion-subscriber-observation/1.0', rollback: 'religion-subscriber-recovery/1.0' },
    verification: { executorVerified: true, independentOutcomeObserverVerified: true },
    gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: true }, blockers: [],
    safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 } };
}

function fail(code, detail, extra) {
  var error = new Error(code + (detail ? ': ' + detail : ''));
  error.code = code;
  error.report = Object.assign({ ok: false, status: 'REFUSED', reason: code, detail: detail || null, providerCalled: false, liveMoney: false }, extra || {});
  return error;
}

async function runCommissioning(options, deps) {
  options = options || {};
  deps = deps || {};
  var env = options.env || process.env;
  var now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  var live = options.live === true;
  var address = String(options.address || '').trim().toLowerCase();

  if (!address) throw fail('COMMISSIONING_ADDRESS_REQUIRED', 'pass --address=<owned consented email>');
  if (!Crm.validEmail(address)) throw fail('COMMISSIONING_ADDRESS_INVALID', address + ' is not a valid email address');
  if (live && options.consent !== true) {
    throw fail('COMMISSIONING_CONTEST_ATTESTATION_REQUIRED', 'pass --consent to attest you own this address and consent to receive the commissioning email');
  }

  // Preflight against the registry so the refusal names the exact env vars.
  var commissioning = Registry.commissioningReport(env);
  if (commissioning.missing.length) {
    throw fail('COMMISSIONING_ENV_INCOMPLETE', 'set: ' + commissioning.missing.join('; '), { missing: commissioning.missing });
  }
  var configuredAddress = String(env.INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL || '').trim().toLowerCase();
  if (configuredAddress !== address) {
    throw fail('COMMISSIONING_ADDRESS_MISMATCH', '--address must equal INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL');
  }
  var costUsd = commissioning.caps.emailCostUsd.value;
  if (!(costUsd <= Registry.COMMISSIONING_CAP_LIMIT_USD)) {
    throw fail('COMMISSIONING_SPEND_ABOVE_CAPABILITY_BOUND', 'INTELLIGENCE_AUTOPILOT_EMAIL_USD must be <= ' + Registry.COMMISSIONING_CAP_LIMIT_USD);
  }
  if (costUsd > 0 && !(commissioning.caps.dailyBudgetUsd.value >= costUsd)) {
    throw fail('COMMISSIONING_BUDGET_BELOW_UNIT_COST', 'INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD must be >= INTELLIGENCE_AUTOPILOT_EMAIL_USD');
  }

  var store, transport, providerSendAttempted = false;
  var cognitionDeps = {};
  if (live) {
    store = deps.store || require('../lib/autofire-efference-store.js');
    try { store.assertDurable(); } catch (error) {
      throw fail('COMMISSIONING_STORE_UNCONFIGURED', 'UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN required', { detail: String(error && error.message || error) });
    }
    var emailCfg = Crm.emailConfig();
    if (!emailCfg.ready) throw fail('COMMISSIONING_TRANSPORT_NOT_READY', emailCfg.reason || 'resend transport not ready');
    transport = deps.transport || { send: function (email, subject, body, opts) { return Crm.sendToLead(email, subject, body, opts); } };
  } else {
    store = deps.store || new MemoryStore();
    if (!(await store.get(Motor.receiptKey('intelligence')))) {
      await store.set(Motor.receiptKey('intelligence'), simulatedIntelligenceMotor(now));
    }
    if (!(await store.get(Motor.receiptKey('religion')))) {
      await store.set(Motor.receiptKey('religion'), simulatedReligionMotor(now));
    }
    cognitionDeps.cognition = deps.cognition || { intelligence: simulatedBrain(now) };
    transport = deps.transport || { send: async function () { return { ok: true, id: 'dry-run-simulated-provider-acceptance', providerCalled: true }; } };
  }

  var candidate = Decision.candidate(
    { leadId: 'commissioning:' + address, email: address, domain: 'intelligence', consent: true, tier: 'commissioning' },
    { kind: 'commissioning', channel: 'email', transition: 'internal>motor-proof' },
    COMMISSIONING_MAIL);
  if (!candidate) throw fail('COMMISSIONING_CANDIDATE_INVALID');

  var decision = await Decision.decide(store, candidate, now, cognitionDeps);
  if (decision.status !== 'RELEASED') {
    return { ok: false, status: 'HELD', stage: 'b10-decision', mode: live ? 'live' : 'dry-run',
      reason: decision.reason, blockers: decision.blockers || [], providerCalled: false, liveMoney: false };
  }

  var wrappedTransport = { send: async function (email, subject, body, opts) {
    providerSendAttempted = true;
    return transport.send(email, subject, body, opts);
  } };
  var command = await Executor.execute({
    store: store, candidate: candidate, decision: decision, now: now,
    emailCostUsd: costUsd,
    dailyBudgetUsd: commissioning.caps.dailyBudgetUsd.value,
    dailyEmailCap: 1,
    env: env,
    transport: wrappedTransport
  });
  if (command.status !== 'ACCEPTED') {
    return { ok: false, status: command.status || 'HELD', stage: 'executor', mode: live ? 'live' : 'dry-run',
      reason: command.reason || command.failure || null, commandId: command.commandId || null,
      providerCalled: providerSendAttempted, liveMoney: false };
  }

  // Independent observation via the Resend READ API (never the send response).
  var observation = null;
  var attempts = Math.max(1, Math.min(6, Number(options.pollAttempts) || 3));
  for (var i = 0; i < attempts; i++) {
    observation = await Observer.observe(store, command, {
      apiKey: live ? env.RESEND_API_KEY : 'dry-run',
      fetch: deps.fetch || (live ? undefined : async function () {
        return { ok: true, status: 200, json: async function () {
          return { id: command.providerEmailId, last_event: 'delivered', created_at: new Date(now).toISOString() };
        } };
      })
    });
    if (!observation || observation.status !== 'PENDING_OBSERVED') break;
    if (i + 1 < attempts && live) await new Promise(function (resolve) { setTimeout(resolve, Math.max(1000, Number(options.pollIntervalMs) || 10000)); });
    else if (!live) break;
  }

  var suppression = await store.get(Executor.SUPPRESSION_KEY);
  var suppressionConfirmed = !!(suppression && suppression[candidate.emailHash] && suppression[candidate.emailHash].suppressed === true);

  var intelligenceCapability = await IntelligenceVerifier.verifyAndPersist(store, now + 1);
  var projection = null;
  if (intelligenceCapability.status === 'VERIFIED') {
    projection = await SubscriberVerifier.run(store, now + 2, { persist: true });
  }

  return {
    ok: intelligenceCapability.status === 'VERIFIED' && !!(projection && projection.persisted),
    status: projection ? projection.status : intelligenceCapability.status,
    mode: live ? 'live' : 'dry-run',
    address: address,
    providerSendAttempted: providerSendAttempted,
    realProviderCalls: live ? (command.providerCalls || 0) : 0,
    simulatedProviderAcceptance: !live,
    decisionReceiptId: decision.decisionReceiptId,
    commandId: command.commandId,
    providerEmailId: command.providerEmailId || null,
    observation: observation ? {
      observationId: observation.observationId || null,
      status: observation.status || null,
      lastEvent: observation.lastEvent || null,
      independentOfSendResponse: observation.independentOfSendResponse === true,
      sendEndpointCalled: observation.sendEndpointCalled === true
    } : null,
    suppressionConfirmed: suppressionConfirmed,
    intelligenceCapability: {
      status: intelligenceCapability.status,
      persisted: intelligenceCapability.persisted === true
    },
    projection: projection ? {
      status: projection.status,
      persisted: projection.persisted === true,
      verified: projection.verified,
      total: projection.total,
      held: projection.domains.filter(function (d) { return d.status !== 'VERIFIED'; })
        .map(function (d) { return { productDomain: d.productDomain, reason: d.reason }; })
    } : null,
    capabilityTtlSeconds: SubscriberVerifier.TTL_SECONDS,
    capabilityRefreshCron: '/api/subscriber-email-capability (8,23,38,53 * * * *) keeps projected pairs alive from this durable evidence',
    liveMoney: false,
    nextSteps: live ? [
      'confirm the registry: GET /api/env-capability-registry?key=<ADMIN_MASTER> — finance row GREEN once FINANCE_SUBSCRIBER_* envs are set',
      'leave INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED=1 off again unless re-commissioning (the one-shot slot is consumed)',
      'the commissioning address is durably suppressed; that is permanent and intended'
    ] : ['dry-run only: rerun with --live --consent to execute the real one-shot commissioning send']
  };
}

function parseArgs(argv) {
  var out = { live: false, consent: false };
  (argv || []).forEach(function (arg) {
    if (arg === '--live') out.live = true;
    else if (arg === '--consent') out.consent = true;
    else if (arg.indexOf('--address=') === 0) out.address = arg.slice('--address='.length);
    else if (arg === '--help' || arg === '-h') out.help = true;
  });
  return out;
}

async function main() {
  var options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('usage: node scripts/commission-subscriber-lane.cjs --address=<owned consented email> [--live --consent]');
    console.log('default is dry-run: full chain in memory, stubbed provider, nothing sent, nothing persisted.');
    return;
  }
  try {
    var report = await runCommissioning(options);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
  } catch (error) {
    console.log(JSON.stringify(error.report || { ok: false, status: 'REFUSED', reason: String(error && error.message || error), providerCalled: false, liveMoney: false }, null, 2));
    process.exit(error.report ? 1 : 2);
  }
}

if (require.main === module) main();

module.exports = { runCommissioning: runCommissioning, MemoryStore: MemoryStore, parseArgs: parseArgs, COMMISSIONING_MAIL: COMMISSIONING_MAIL };
