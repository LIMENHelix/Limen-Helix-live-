'use strict';

/**
 * One operator-facing valve for the shared paid-subscriber transport.
 *
 * This is motor physiology, not shared cognition. Every domain still owns a
 * separate decision, command, budget namespace, entitlement, observation,
 * learning state and recovery path. A domain-specific variable, when present,
 * always overrides the civilization default so one injured lane can be
 * inhibited without anesthetising the other nineteen.
 */

var GLOBAL = Object.freeze({
  enabled: 'SUBSCRIBER_EMAIL_AUTONOMY_ENABLED',
  observerEnabled: 'SUBSCRIBER_EMAIL_OUTCOME_OBSERVER_ENABLED',
  maxSends: 'SUBSCRIBER_EMAIL_MAX_SENDS',
  emailCostUsd: 'SUBSCRIBER_EMAIL_USD',
  dailyBudgetUsd: 'SUBSCRIBER_EMAIL_DAILY_BUDGET_USD',
  dailySendCap: 'SUBSCRIBER_EMAIL_DAILY_SEND_CAP'
});

function present(env, name) {
  return !!(env && Object.prototype.hasOwnProperty.call(env, name) &&
    String(env[name]).trim() !== '');
}

function switchOpen(env, localName, globalName) {
  env = env || process.env;
  if (present(env, localName)) return String(env[localName]).trim() === '1';
  return String(env[globalName] || '').trim() === '1';
}

function number(env, localName, globalName, fallback) {
  env = env || process.env;
  var raw = present(env, localName) ? env[localName] : env[globalName];
  var value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function resolve(env, names) {
  return {
    enabled: switchOpen(env, names.enabled, GLOBAL.enabled),
    observerEnabled: switchOpen(env, names.observerEnabled, GLOBAL.observerEnabled),
    maxSends: number(env, names.maxSends, GLOBAL.maxSends, 0),
    emailCostUsd: number(env, names.emailCostUsd, GLOBAL.emailCostUsd, null),
    dailyBudgetUsd: number(env, names.dailyBudgetUsd, GLOBAL.dailyBudgetUsd, null),
    dailySendCap: number(env, names.dailySendCap, GLOBAL.dailySendCap, 0)
  };
}

module.exports = {
  GLOBAL: GLOBAL,
  present: present,
  switchOpen: switchOpen,
  number: number,
  resolve: resolve
};
