'use strict';

/**
 * lib/energy-e2e-verifier.js — server-side verification channel.
 *
 * A measured independent customer outcome must not be self-certified by the
 * caller. The HMAC key and trusted issuer come only from the server
 * environment, never from a request, cycle input, outcome object or CLI flag.
 *
 * Test-only keys and fixtures can never authorize a measured outcome. A
 * measured outcome additionally requires an explicitly external trust mode and
 * an issuer binding to the expected customer and order.
 *
 * If the channel is not configured, current() returns null and the measured
 * gate stays closed. No fallback key, no default issuer.
 */

function splitList(value) {
  return String(value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function current() {
  const key = process.env.ENERGY_E2E_VERIFIER_KEY || '';
  const issuer = process.env.ENERGY_E2E_VERIFIER_ISSUER || '';
  const trust = process.env.ENERGY_E2E_VERIFIER_TRUST || '';
  if (!key || !issuer) return null;
  const looksLikeTestKey = /^(test|fixture)[-_]/i.test(key);
  const measuredCapable = trust === 'external' && !looksLikeTestKey;
  return {
    key: key,
    issuer: issuer,
    trust: trust || null,
    channel: measuredCapable ? 'external' : 'test-fixture',
    authority: measuredCapable
      ? 'EXTERNALLY_AUTHORIZED_VERIFIER_CHANNEL'
      : 'SIMULATED_TEST_ONLY',
    measuredCapable: measuredCapable,
    testOnly: !measuredCapable,
    customerRefs: splitList(process.env.ENERGY_E2E_VERIFIER_CUSTOMER_REFS),
    orderIds: splitList(process.env.ENERGY_E2E_VERIFIER_ORDER_IDS)
  };
}

module.exports = { current: current, channel: 'server-env' };
