'use strict';

/**
 * lib/energy-e2e-verifier.js — server-side verification channel.
 *
 * A measured independent customer outcome must not be self-certified by the
 * caller. The HMAC key and trusted issuer come only from the server
 * environment, never from a request, cycle input, outcome object or CLI flag.
 *
 * If the channel is not configured, current() returns null and the measured
 * outcome gate stays closed. No fallback key, no default issuer.
 */

function current() {
  const key = process.env.ENERGY_E2E_VERIFIER_KEY || '';
  const issuer = process.env.ENERGY_E2E_VERIFIER_ISSUER || '';
  if (!key || !issuer) return null;
  return {
    key: key,
    issuer: issuer,
    channel: 'server-env',
    authority: 'EXTERNALLY_AUTHORIZED_VERIFIER_CHANNEL'
  };
}

module.exports = { current: current, channel: 'server-env' };
