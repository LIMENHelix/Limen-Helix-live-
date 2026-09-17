'use strict';

var assert = require('node:assert/strict');
var Policy = require('../lib/subscriber-email-policy.js');

var names = {
  enabled: 'ENERGY_SUBSCRIBER_EMAIL_ENABLED',
  observerEnabled: 'ENERGY_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED',
  maxSends: 'ENERGY_SUBSCRIBER_MAX_SENDS',
  emailCostUsd: 'ENERGY_SUBSCRIBER_EMAIL_USD',
  dailyBudgetUsd: 'ENERGY_SUBSCRIBER_DAILY_BUDGET_USD',
  dailySendCap: 'ENERGY_SUBSCRIBER_DAILY_SEND_CAP'
};

var closed = Policy.resolve({}, names);
assert.equal(closed.enabled, false);
assert.equal(closed.observerEnabled, false);
assert.equal(closed.maxSends, 0);
assert.equal(closed.emailCostUsd, null);
assert.equal(closed.dailyBudgetUsd, null);
assert.equal(closed.dailySendCap, 0);

var global = Policy.resolve({
  SUBSCRIBER_EMAIL_AUTONOMY_ENABLED: '1',
  SUBSCRIBER_EMAIL_OUTCOME_OBSERVER_ENABLED: '1',
  SUBSCRIBER_EMAIL_MAX_SENDS: '2',
  SUBSCRIBER_EMAIL_USD: '0',
  SUBSCRIBER_EMAIL_DAILY_BUDGET_USD: '0',
  SUBSCRIBER_EMAIL_DAILY_SEND_CAP: '3'
}, names);
assert.deepEqual(global, { enabled: true, observerEnabled: true, maxSends: 2,
  emailCostUsd: 0, dailyBudgetUsd: 0, dailySendCap: 3 });

var inhibited = Policy.resolve({
  SUBSCRIBER_EMAIL_AUTONOMY_ENABLED: '1',
  SUBSCRIBER_EMAIL_OUTCOME_OBSERVER_ENABLED: '1',
  SUBSCRIBER_EMAIL_MAX_SENDS: '2',
  SUBSCRIBER_EMAIL_USD: '0',
  SUBSCRIBER_EMAIL_DAILY_BUDGET_USD: '0',
  SUBSCRIBER_EMAIL_DAILY_SEND_CAP: '3',
  ENERGY_SUBSCRIBER_EMAIL_ENABLED: '0',
  ENERGY_SUBSCRIBER_MAX_SENDS: '1'
}, names);
assert.equal(inhibited.enabled, false);
assert.equal(inhibited.observerEnabled, true);
assert.equal(inhibited.maxSends, 1);

console.log('subscriber email policy: one civilization valve with domain-local override precedence passed');
