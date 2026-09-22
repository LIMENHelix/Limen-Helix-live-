'use strict';

/**
 * Read-only registry for the paid-subscriber delivery lanes: which env
 * switches are open, which cap values are configured, and exactly which named
 * env vars are still missing per domain.
 *
 * SECRET SAFETY IS STRUCTURAL, NOT CONVENTIONAL. This module never copies an
 * env VALUE into its output. Credential-shaped variables (RESEND_API_KEY,
 * tokens, admin keys) are reduced to presence booleans; the sender identity
 * variables (RESEND_FROM_EMAIL et al.) are reduced to presence + deliverability
 * class; only cap/budget numbers — operator-chosen policy, not secrets — and
 * env var NAMES are reported verbatim. The unit test proves this with canary
 * values.
 *
 * Gate semantics mirror the executors exactly:
 *   - lib/subscriber-email-policy.js          (local switch overrides global;
 *                                              '1' opens, anything else closes)
 *   - lib/sovereign-subscriber-lane.js        (cap arithmetic + HARD_MAX_SENDS)
 *   - lib/finance-subscriber-executor.js      (finance's custom caps)
 *   - lib/finance-subscriber-motor-authorization.js (finance needs NO
 *     capability pair; its authorization is switches + fresh brain state)
 *   - lib/product-domain-motor-authorization.js + religion-subscriber-executor
 *     (the other 19 lanes additionally need a persisted capability pair,
 *     projected from the Intelligence owned-destination commissioning proof by
 *     lib/subscriber-email-capability-verifier.js)
 *   - lib/crm-send.js                         (transport readiness + CAN-SPAM
 *                                              postal footer)
 */

var SubscriberPolicy = require('./subscriber-email-policy.js');
var ValveRegistry = require('./civilization-valve-registry.js');
var Lanes = require('./sovereign-domain-subscriber-lanes.js');
var Capability = require('./product-domain-motor-capability.js');
var Crm = require('./crm-send.js');

var SCHEMA = 'subscriber-delivery-env-capability-registry/1.0';
var HARD_MAX_SENDS = 100;
var COMMISSIONING_CAP_LIMIT_USD = 0.01; // product-domain-motor-capability bound

var FINANCE_ENV_NAMES = Object.freeze({
  enabled: 'FINANCE_SUBSCRIBER_EMAIL_ENABLED',
  observerEnabled: 'FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED',
  maxSends: 'FINANCE_SUBSCRIBER_MAX_SENDS',
  emailCostUsd: 'FINANCE_SUBSCRIBER_EMAIL_USD',
  dailyBudgetUsd: 'FINANCE_SUBSCRIBER_DAILY_BUDGET_USD',
  dailySendCap: 'FINANCE_SUBSCRIBER_DAILY_SEND_CAP'
});

// religion-revenue-fulfillment.js:27-30 + subscriber-digest.js:39-41 — note the
// historical SUBSCRIBER_DIGEST_MAX_SENDS name for the per-run cap.
var RELIGION_ENV_NAMES = Object.freeze({
  enabled: 'RELIGION_SUBSCRIBER_EMAIL_ENABLED',
  observerEnabled: 'RELIGION_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED',
  maxSends: 'SUBSCRIBER_DIGEST_MAX_SENDS',
  emailCostUsd: 'RELIGION_SUBSCRIBER_EMAIL_USD',
  dailyBudgetUsd: 'RELIGION_SUBSCRIBER_DAILY_BUDGET_USD',
  dailySendCap: 'RELIGION_SUBSCRIBER_DAILY_SEND_CAP'
});

function descriptors() {
  var rows = [{
    productDomain: 'finance', ownerDomain: 'finance',
    envNames: FINANCE_ENV_NAMES, capabilityPairRequired: false,
    capabilityNote: 'finance-local authorization (finance-subscriber-motor-authorization): switches + fresh brain state only; no capability pair gate'
  }, {
    productDomain: 'religion', ownerDomain: 'religion',
    envNames: RELIGION_ENV_NAMES, capabilityPairRequired: true,
    capabilityNote: 'religion executor authorizes via product-domain-motor-authorization; capability pair projected from the Intelligence commissioning proof'
  }];
  Lanes.DOMAINS.forEach(function (domain) {
    var lane = Lanes.get(domain);
    rows.push({
      productDomain: lane.config.productDomain, ownerDomain: lane.config.ownerDomain,
      envNames: lane.config.envNames, capabilityPairRequired: true,
      capabilityNote: 'sovereign lane authorization verifies the projected capability pair (6h TTL, refreshed by the subscriber-email-capability cron)'
    });
  });
  rows.forEach(function (row) {
    var valveId = row.productDomain + ':subscriber-email';
    var line = ValveRegistry.get(valveId);
    row.valveId = valveId;
    row.actionRoute = line && line.actionRoute || null;
    row.observerRoute = line && line.observerRoute || null;
    row.recoveryRoute = line && line.recoveryRoute || null;
    row.schedule = line && line.schedule || null;
  });
  return rows;
}

function switchState(env, localName, globalName) {
  var localPresent = SubscriberPolicy.present(env, localName);
  var open = SubscriberPolicy.switchOpen(env, localName, globalName);
  return {
    env: localName,
    globalFallback: globalName,
    open: open,
    source: !open ? (localPresent ? 'closed-explicitly' : 'closed-default')
      : (localPresent ? 'domain' : 'global')
  };
}

function capState(env, localName, globalName, resolved) {
  var localPresent = SubscriberPolicy.present(env, localName);
  var globalPresent = SubscriberPolicy.present(env, globalName);
  return {
    env: localName,
    globalFallback: globalName,
    configured: localPresent || globalPresent,
    source: localPresent ? 'domain' : (globalPresent ? 'global' : null),
    value: resolved
  };
}

function transportReport(env) {
  // crm-send.emailConfig() returns the API key among its fields; pick ONLY the
  // boolean/classification fields here. Never spread cfg into the output.
  var cfg = Crm.emailConfig();
  if (env !== process.env) {
    // A test-supplied env matrix: emailConfig reads process.env, so classify
    // from the supplied env instead, with the same rules as crm-send.
    var from = env.RESEND_FROM_EMAIL || env.CRM_FROM_EMAIL || env.LEAD_FROM_EMAIL || '';
    var m = String(from).match(/<([^>]+)>/);
    var fromEmail = (m ? m[1] : from || '').trim();
    var validFrom = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail);
    var sandbox = !validFrom || /resend\.dev/i.test(fromEmail) ||
      /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|pm|gmx|zoho|mail|yandex|fastmail)\.[a-z.]+>?\s*$/i.test(fromEmail);
    var reason = !env.RESEND_API_KEY ? 'RESEND_API_KEY not set'
      : !from ? 'RESEND_FROM_EMAIL not set'
      : !validFrom ? 'RESEND_FROM_EMAIL is not a valid email address'
      : sandbox ? 'from-address is a resend.dev sandbox or free-mail domain — verify your own domain in Resend'
      : null;
    return {
      resendApiKey: { env: 'RESEND_API_KEY', configured: !!env.RESEND_API_KEY },
      fromEmail: {
        env: env.RESEND_FROM_EMAIL ? 'RESEND_FROM_EMAIL' : (env.CRM_FROM_EMAIL ? 'CRM_FROM_EMAIL' : (env.LEAD_FROM_EMAIL ? 'LEAD_FROM_EMAIL' : 'RESEND_FROM_EMAIL')),
        configured: !!from,
        deliverableClass: !from ? 'missing' : (!validFrom ? 'invalid' : (sandbox ? 'undeliverable-sandbox-or-free-mail' : 'own-domain-assumed-verified'))
      },
      replyTo: { env: 'CRM_REPLY_TO', configured: !!(env.CRM_REPLY_TO || env.LEAD_NOTIFY_EMAIL) },
      postalAddress: { env: 'CRM_SENDER_ADDRESS', configured: !!env.CRM_SENDER_ADDRESS, compliance: 'CAN-SPAM postal footer' },
      ready: !!env.RESEND_API_KEY && !sandbox,
      reason: reason
    };
  }
  return {
    resendApiKey: { env: 'RESEND_API_KEY', configured: cfg.hasKey },
    fromEmail: {
      env: process.env.RESEND_FROM_EMAIL ? 'RESEND_FROM_EMAIL' : (process.env.CRM_FROM_EMAIL ? 'CRM_FROM_EMAIL' : (process.env.LEAD_FROM_EMAIL ? 'LEAD_FROM_EMAIL' : 'RESEND_FROM_EMAIL')),
      configured: !!cfg.from,
      deliverableClass: !cfg.from ? 'missing' : (cfg.sandbox ? 'undeliverable-sandbox-or-free-mail-or-invalid' : 'own-domain-assumed-verified')
    },
    replyTo: { env: 'CRM_REPLY_TO', configured: !!cfg.replyTo },
    postalAddress: { env: 'CRM_SENDER_ADDRESS', configured: !!cfg.addr, compliance: 'CAN-SPAM postal footer' },
    ready: cfg.ready,
    reason: cfg.reason
  };
}

function domainReport(desc, env, transport) {
  var GLOBAL = SubscriberPolicy.GLOBAL;
  var names = desc.envNames;
  var policy = SubscriberPolicy.resolve(env, names);
  var missing = [];
  var holdReasons = [];

  var enabled = switchState(env, names.enabled, GLOBAL.enabled);
  var observer = switchState(env, names.observerEnabled, GLOBAL.observerEnabled);
  if (!enabled.open) {
    holdReasons.push(desc.productDomain + '-subscriber-email-switch-closed');
    if (enabled.source !== 'closed-explicitly') missing.push(names.enabled + '=1 (or global ' + GLOBAL.enabled + '=1)');
  }
  if (!observer.open) {
    holdReasons.push(desc.productDomain + '-subscriber-outcome-observer-switch-closed');
    if (observer.source !== 'closed-explicitly') missing.push(names.observerEnabled + '=1 (or global ' + GLOBAL.observerEnabled + '=1)');
  }

  var maxSends = capState(env, names.maxSends, GLOBAL.maxSends, policy.maxSends);
  var emailCostUsd = capState(env, names.emailCostUsd, GLOBAL.emailCostUsd, policy.emailCostUsd);
  var dailyBudgetUsd = capState(env, names.dailyBudgetUsd, GLOBAL.dailyBudgetUsd, policy.dailyBudgetUsd);
  var dailySendCap = capState(env, names.dailySendCap, GLOBAL.dailySendCap, policy.dailySendCap);

  if (!(policy.maxSends > 0)) {
    holdReasons.push(desc.productDomain + '-subscriber-send-cap-zero');
    if (!maxSends.configured) missing.push(names.maxSends + ' (or global ' + GLOBAL.maxSends + ')');
    else holdReasons.push(names.maxSends + ' resolves to 0');
  }
  if (policy.emailCostUsd === null) {
    holdReasons.push(desc.productDomain + '-subscriber-email-unit-cost-not-configured');
    missing.push(names.emailCostUsd + ' (or global ' + GLOBAL.emailCostUsd + ')');
  }
  if (!(policy.dailySendCap > 0)) {
    holdReasons.push(desc.productDomain + '-subscriber-daily-send-cap-zero');
    if (!dailySendCap.configured) missing.push(names.dailySendCap + ' (or global ' + GLOBAL.dailySendCap + ')');
  }
  var cost = policy.emailCostUsd;
  if (cost !== null && cost > 0 && !(policy.dailyBudgetUsd !== null && policy.dailyBudgetUsd >= cost)) {
    holdReasons.push(desc.productDomain + '-subscriber-daily-dollar-budget-not-configured-or-too-small');
    missing.push(names.dailyBudgetUsd + ' >= ' + names.emailCostUsd + ' (or global ' + GLOBAL.dailyBudgetUsd + ')');
  }

  var dailySlots = 0;
  if (cost !== null && policy.dailySendCap > 0) {
    dailySlots = Math.min(policy.dailySendCap, cost === 0 ? policy.dailySendCap : Math.floor((policy.dailyBudgetUsd + 1e-12) / cost));
    if (!dailySlots) holdReasons.push(desc.productDomain + '-subscriber-daily-budget-zero');
  }

  if (!transport.ready) holdReasons.push('resend-transport-not-ready: ' + (transport.reason || 'from-address undeliverable'));
  var complianceMissing = [];
  if (!transport.postalAddress.configured) complianceMissing.push('CRM_SENDER_ADDRESS (CAN-SPAM postal footer)');

  var green = enabled.open && observer.open && policy.maxSends > 0 && cost !== null &&
    policy.dailySendCap > 0 && dailySlots > 0 && transport.ready && transport.postalAddress.configured;

  return {
    productDomain: desc.productDomain,
    ownerDomain: desc.ownerDomain,
    lane: 'subscriber-email',
    valveId: desc.valveId,
    actionRoute: desc.actionRoute,
    observerRoute: desc.observerRoute,
    recoveryRoute: desc.recoveryRoute,
    schedule: desc.schedule,
    status: green ? 'GREEN' : 'HELD',
    envNames: names,
    switches: { enabled: enabled, observerEnabled: observer },
    caps: {
      maxSends: maxSends, emailCostUsd: emailCostUsd,
      dailyBudgetUsd: dailyBudgetUsd, dailySendCap: dailySendCap,
      hardMaxSends: HARD_MAX_SENDS,
      effectiveDailySlots: dailySlots
    },
    capabilityPairRequired: desc.capabilityPairRequired,
    capabilityNote: desc.capabilityNote,
    missing: missing,
    complianceMissing: complianceMissing,
    holdReasons: holdReasons
  };
}

function commissioningReport(env) {
  var enabled = String(env.INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED || '').trim() === '1';
  var address = SubscriberPolicy.present(env, 'INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL');
  function cap(name) {
    var raw = env[name], n = Number(raw);
    return { env: name, configured: SubscriberPolicy.present(env, name), value: Number.isFinite(n) && n >= 0 ? n : null };
  }
  var emailCostUsd = cap('INTELLIGENCE_AUTOPILOT_EMAIL_USD');
  var dailyBudgetUsd = cap('INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD');
  var dailyEmailCap = cap('INTELLIGENCE_AUTOPILOT_DAILY_EMAIL_CAP');
  var missing = [];
  if (!enabled) missing.push('INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED=1');
  if (!address) missing.push('INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL=<owned consented address>');
  if (!emailCostUsd.configured) missing.push('INTELLIGENCE_AUTOPILOT_EMAIL_USD (must be <= ' + COMMISSIONING_CAP_LIMIT_USD + ')');
  if (!dailyBudgetUsd.configured) missing.push('INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD');
  if (!dailyEmailCap.configured) missing.push('INTELLIGENCE_AUTOPILOT_DAILY_EMAIL_CAP');
  var spendBounded = emailCostUsd.value !== null && emailCostUsd.value <= COMMISSIONING_CAP_LIMIT_USD;
  return {
    mechanism: 'Intelligence owned-destination commissioning proof (one real email, independent Resend read, durable suppression) projected to every subscriber lane by subscriber-email-capability-verifier',
    developmentalSwitch: { env: 'INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED', open: enabled },
    commissioningAddress: { env: 'INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL', configured: address },
    caps: { emailCostUsd: emailCostUsd, dailyBudgetUsd: dailyBudgetUsd, dailyEmailCap: dailyEmailCap },
    spendWithinCapabilityBound: spendBounded,
    missing: missing,
    projection: {
      verifier: 'subscriber-email-capability-verifier',
      targetDomains: 19,
      capabilityTtlSeconds: 6 * 60 * 60,
      refreshedByCron: '/api/subscriber-email-capability (8,23,38,53 * * * *)',
      financeExempt: true
    }
  };
}

function report(env, now) {
  env = env || process.env;
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var transport = transportReport(env);
  var domains = descriptors().map(function (desc) { return domainReport(desc, env, transport); });
  return {
    ok: true,
    schemaVersion: SCHEMA,
    measuredAt: new Date(at).toISOString(),
    readOnly: true,
    liveMoney: false,
    transport: transport,
    commissioning: commissioningReport(env),
    domains: domains,
    summary: {
      total: domains.length,
      green: domains.filter(function (d) { return d.status === 'GREEN'; }).length,
      held: domains.filter(function (d) { return d.status === 'HELD'; }).length
    }
  };
}

/**
 * Optional read-only store probe: presence/lifecycle of the persisted
 * capability receipts. Only receipt metadata (presence, status, timestamps)
 * is returned — never evidence internals. Absent/expired receipts mean the
 * lane's authorization holds even when every env gate is GREEN.
 */
async function probeCapabilities(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  function shape(record) {
    if (!record) return { present: false };
    return {
      present: true,
      status: record.status || null,
      verifiedAt: record.verifiedAt ? new Date(Number(record.verifiedAt)).toISOString() : null,
      expiresAt: record.expiresAt ? new Date(Number(record.expiresAt)).toISOString() : null,
      expired: Number.isFinite(Number(record.expiresAt)) ? at >= Number(record.expiresAt) : null
    };
  }
  var rows = {};
  var domains = descriptors();
  for (var i = 0; i < domains.length; i++) {
    var d = domains[i];
    if (!d.capabilityPairRequired) {
      rows[d.productDomain] = { required: false };
      continue;
    }
    var lane = Lanes.get(d.productDomain);
    var executorKey = lane ? lane.config.keys.executorCapability : Capability.capabilityKey(d.productDomain, Capability.EXECUTOR);
    var observerKey = lane ? lane.config.keys.observerCapability : Capability.capabilityKey(d.productDomain, Capability.OBSERVER);
    rows[d.productDomain] = {
      required: true,
      executor: shape(await store.get(executorKey)),
      observer: shape(await store.get(observerKey))
    };
  }
  return {
    measuredAt: new Date(at).toISOString(),
    intelligenceAutopilotSource: {
      executor: shape(await store.get(Capability.capabilityKey('intelligence', Capability.EXECUTOR))),
      observer: shape(await store.get(Capability.capabilityKey('intelligence', Capability.OBSERVER)))
    },
    domains: rows
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  HARD_MAX_SENDS: HARD_MAX_SENDS,
  COMMISSIONING_CAP_LIMIT_USD: COMMISSIONING_CAP_LIMIT_USD,
  FINANCE_ENV_NAMES: FINANCE_ENV_NAMES,
  RELIGION_ENV_NAMES: RELIGION_ENV_NAMES,
  descriptors: descriptors,
  commissioningReport: commissioningReport,
  report: report,
  probeCapabilities: probeCapabilities
};
