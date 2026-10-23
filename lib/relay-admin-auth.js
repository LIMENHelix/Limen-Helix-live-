'use strict';

/**
 * lib/relay-admin-auth.js — server-only relay administrator credential check.
 *
 * This module is shared by the catch-all router and the relay CSV import
 * handler so there is exactly one credential rule. It is not browser code:
 * it lives under lib/, imports node:crypto and never reads query strings.
 *
 * Rule:
 *   - The server credential is RELAY_ADMIN_KEY. Unset means no access at all.
 *   - The client credential is the x-relay-admin-key header, never ?key=.
 *   - Missing is 401; wrong is 403; unset server configuration is a neutral 503.
 *   - Comparison is timing-safe over fixed-length SHA-256 digests.
 */

const crypto = require('node:crypto');

const ADMIN_HEADER = 'x-relay-admin-key';

function headerValue(req, name) {
  const headers = (req && req.headers) || {};
  const wanted = String(name).toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() !== wanted) continue;
    const value = headers[keys[i]];
    if (Array.isArray(value)) return value.length ? String(value[0]) : '';
    return value == null ? '' : String(value);
  }
  return '';
}

function timingSafeTextEqual(a, b) {
  /* Hash first so the comparison is fixed-length and does not throw on a
     length mismatch. This is a credential comparison, not a general hash. */
  const ha = crypto.createHash('sha256').update(String(a || ''), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b || ''), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkRelayAdmin(req) {
  const expected = process.env.RELAY_ADMIN_KEY || '';
  if (!expected) {
    /* Fail closed. Do not name the missing variable or reveal configuration. */
    return { ok: false, status: 503, error: 'service unavailable' };
  }
  const supplied = headerValue(req, ADMIN_HEADER);
  if (!supplied) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  if (!timingSafeTextEqual(supplied, expected)) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, status: 200, error: null };
}

module.exports = {
  ADMIN_HEADER: ADMIN_HEADER,
  headerValue: headerValue,
  timingSafeTextEqual: timingSafeTextEqual,
  checkRelayAdmin: checkRelayAdmin
};
