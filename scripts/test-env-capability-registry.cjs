'use strict';

/**
 * Env-matrix test for lib/env-capability-registry.js: gate states per domain,
 * cap values surfaced verbatim (caps are policy, not secrets), and a canary
 * proof that no credential or address VALUE ever leaks into the output.
 */
var assert = require('node:assert/strict');
var Registry = require('../lib/env-capability-registry.js');

var CANARY = {
  RESEND_API_KEY: 're_canary_SECRET_api_key_9f8e7d',
  RESEND_FROM_EMAIL: 'LIMEN <outreach@canary-from-domain.example>',
  CRM_SENDER_ADDRESS: '123 Canary Street, Suite 45, Canary City, KS 66000',
  CRM_REPLY_TO: 'reply-canary@canary-from-domain.example',
  ADMIN_MASTER: 'admin-master-CANARY-value',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token-CANARY'
};

function envWith(overrides) {
  return Object.assign({}, CANARY, overrides || {});
}

function financeRow(report) {
  return report.domains.find(function (d) { return d.productDomain === 'finance'; });
}

var FINANCE_ON = {
  FINANCE_SUBSCRIBER_EMAIL_ENABLED: '1',
  FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED: '1',
  FINANCE_SUBSCRIBER_MAX_SENDS: '50',
  FINANCE_SUBSCRIBER_EMAIL_USD: '0.001',
  FINANCE_SUBSCRIBER_DAILY_BUDGET_USD: '1.00',
  FINANCE_SUBSCRIBER_DAILY_SEND_CAP: '100'
};

(function () {
  // 1. Beachhead: finance lane fully configured + transport ready → GREEN.
  var report = Registry.report(envWith(FINANCE_ON));
  assert.equal(report.schemaVersion, Registry.SCHEMA);
  assert.equal(report.summary.total, 20);
  var finance = financeRow(report);
  assert.equal(finance.status, 'GREEN');
  assert.equal(finance.missing.length, 0);
  assert.equal(finance.capabilityPairRequired, false);
  assert.equal(finance.actionRoute, 'finance-subscriber-cycle');
  assert.deepEqual(finance.missing, []);
  // Cap VALUES are reported verbatim — they are operator policy, not secrets.
  assert.equal(finance.caps.maxSends.value, 50);
  assert.equal(finance.caps.emailCostUsd.value, 0.001);
  assert.equal(finance.caps.dailyBudgetUsd.value, 1.0);
  assert.equal(finance.caps.dailySendCap.value, 100);
  assert.equal(finance.caps.effectiveDailySlots, 100);
  assert.equal(finance.caps.maxSends.source, 'domain');

  // Every other lane is held with the transport ready but switches closed.
  var others = report.domains.filter(function (d) { return d.productDomain !== 'finance'; });
  assert.equal(others.length, 19);
  others.forEach(function (d) {
    assert.equal(d.status, 'HELD', d.productDomain);
    assert.ok(d.holdReasons.indexOf(d.productDomain + '-subscriber-email-switch-closed') >= 0, d.productDomain);
    assert.ok(d.missing.some(function (m) { return m.indexOf(d.envNames.enabled) === 0; }), d.productDomain + ' names its enabled var');
  });
  assert.equal(report.summary.green, 1);
  assert.equal(report.summary.held, 19);

  // 2. Global switches open every lane at once; a domain '0' still wins.
  var globalOn = envWith({
    SUBSCRIBER_EMAIL_AUTONOMY_ENABLED: '1',
    SUBSCRIBER_EMAIL_OUTCOME_OBSERVER_ENABLED: '1',
    SUBSCRIBER_EMAIL_MAX_SENDS: '10',
    SUBSCRIBER_EMAIL_USD: '0.001',
    SUBSCRIBER_EMAIL_DAILY_BUDGET_USD: '0.50',
    SUBSCRIBER_EMAIL_DAILY_SEND_CAP: '25',
    CULTURE_SUBSCRIBER_EMAIL_ENABLED: '0'
  });
  var globalReport = Registry.report(globalOn);
  assert.equal(globalReport.summary.green, 19);
  var culture = globalReport.domains.find(function (d) { return d.productDomain === 'culture'; });
  assert.equal(culture.status, 'HELD');
  assert.equal(culture.switches.enabled.open, false);
  assert.equal(culture.switches.enabled.source, 'closed-explicitly');
  assert.ok(!culture.missing.some(function (m) { return m.indexOf('CULTURE_SUBSCRIBER_EMAIL_ENABLED') === 0; }),
    'an explicit closed switch is a hold reason, not a missing var');
  var medicine = globalReport.domains.find(function (d) { return d.productDomain === 'medicine'; });
  assert.equal(medicine.status, 'GREEN');
  assert.equal(medicine.caps.maxSends.source, 'global');
  assert.equal(medicine.capabilityPairRequired, true);

  // 3. Caps set but budget below unit cost → named missing pair, HELD.
  var thinBudget = Registry.report(envWith(Object.assign({}, FINANCE_ON, {
    FINANCE_SUBSCRIBER_DAILY_BUDGET_USD: '0.0005'
  })));
  var thinFinance = financeRow(thinBudget);
  assert.equal(thinFinance.status, 'HELD');
  assert.ok(thinFinance.missing.some(function (m) { return m.indexOf('FINANCE_SUBSCRIBER_DAILY_BUDGET_USD') === 0; }));
  assert.equal(thinFinance.caps.effectiveDailySlots, 0);

  // 4. Religion's historical cap name is reported, not "fixed".
  var religionRow = report.domains.find(function (d) { return d.productDomain === 'religion'; });
  assert.equal(religionRow.envNames.maxSends, 'SUBSCRIBER_DIGEST_MAX_SENDS');

  // 5. Transport: sandbox from-address blocks GREEN even with all lane envs set.
  var sandbox = Registry.report(envWith(Object.assign({}, FINANCE_ON, {
    RESEND_FROM_EMAIL: 'onboarding@resend.dev'
  })));
  assert.equal(sandbox.transport.ready, false);
  assert.equal(sandbox.transport.fromEmail.deliverableClass, 'undeliverable-sandbox-or-free-mail');
  assert.equal(financeRow(sandbox).status, 'HELD');
  assert.ok(financeRow(sandbox).holdReasons.some(function (r) { return r.indexOf('resend-transport-not-ready') === 0; }));

  // 6. Missing postal address is a compliance block on GREEN, named.
  var noPostal = Registry.report(envWith(Object.assign({}, FINANCE_ON, { CRM_SENDER_ADDRESS: '' })));
  assert.equal(financeRow(noPostal).status, 'HELD');
  assert.deepEqual(financeRow(noPostal).complianceMissing, ['CRM_SENDER_ADDRESS (CAN-SPAM postal footer)']);

  // 7. Commissioning section: switch closed + address unset by default; complete when set.
  assert.equal(report.commissioning.developmentalSwitch.open, false);
  assert.ok(report.commissioning.missing.indexOf('INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED=1') >= 0);
  var commissioningReady = Registry.report(envWith({
    INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED: '1',
    INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL: 'ops-canary@canary-from-domain.example',
    INTELLIGENCE_AUTOPILOT_EMAIL_USD: '0.001',
    INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD: '0.01',
    INTELLIGENCE_AUTOPILOT_DAILY_EMAIL_CAP: '1'
  }));
  assert.equal(commissioningReady.commissioning.missing.length, 0);
  assert.equal(commissioningReady.commissioning.spendWithinCapabilityBound, true);
  assert.equal(commissioningReady.commissioning.projection.targetDomains, 19);
  assert.equal(commissioningReady.commissioning.projection.financeExempt, true);

  // 8. CANARY PROOF: no secret or address VALUE appears anywhere in the output.
  var serialized = JSON.stringify(Registry.report(envWith(FINANCE_ON))) +
    JSON.stringify(commissioningReady) + JSON.stringify(sandbox);
  Object.keys(CANARY).forEach(function (name) {
    assert.ok(serialized.indexOf(CANARY[name]) === -1, 'leaked value of ' + name);
  });
  assert.ok(serialized.indexOf('outreach@canary-from-domain.example') === -1, 'leaked from-address');
  assert.ok(serialized.indexOf('ops-canary@canary-from-domain.example') === -1, 'leaked commissioning address');
  assert.ok(serialized.indexOf('canary-from-domain.example') === -1, 'leaked from-domain');
  // Env var NAMES and cap values are present by design.
  assert.ok(serialized.indexOf('RESEND_API_KEY') >= 0);
  assert.ok(serialized.indexOf('CRM_SENDER_ADDRESS') >= 0);

  console.log('env capability registry: env matrix → gate states, cap values visible, zero secret leakage: PASS');
})();
