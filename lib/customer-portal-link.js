/**
 * customer-portal-link.js — the signed, expiring token that turns "control of the
 * subscriber's inbox" into "may open this subscriber's Stripe Customer Portal".
 *
 * WHY. Email is the subscriber identity (lib/subscriptions.js). handlers/customer-portal.js
 * no longer hands a portal session to whoever POSTs a matching {email, domain}; it emails a
 * redeem link instead. This token is what the link carries: HMAC-signed with a server-only
 * secret (CUSTOMER_PORTAL_LINK_SECRET), bound to the exact email, domain and Stripe customer
 * the strict store verified, and dead after its TTL. Minting the Stripe session itself is
 * deferred to the click, so a stranger spraying requests at the route mints nothing.
 *
 * FORMAT: v1.<base64url(json claims)>.<hex hmac-sha256 over "v1.<claims>">
 * CLAIMS:  { email, domain, customerId, exp }   (email/domain normalized: trim + lowercase)
 *
 * verify() never throws and never reports WHICH check failed beyond 'malformed' vs
 * 'bad-signature' vs 'expired' — enough for the route to pick 400 vs 410, not enough to
 * help a forger.
 */
'use strict';

var crypto = require('node:crypto');

var VERSION = 'v1';

function normEmail(email) { return String(email || '').trim().toLowerCase(); }
function normDomain(domain) { return String(domain || '').trim().toLowerCase(); }

function hmac(secret, signed) {
  return crypto.createHmac('sha256', String(secret)).update(signed, 'utf8').digest('hex');
}

/** claims: { email, domain, customerId }. Returns the token string. Throws without a secret. */
function sign(claims, secret, now, ttlMs) {
  if (!secret) throw new Error('customer-portal-link: a server secret is required');
  var payload = {
    email: normEmail(claims && claims.email),
    domain: normDomain(claims && claims.domain),
    customerId: String(claims && claims.customerId || ''),
    exp: Number(now) + Number(ttlMs)
  };
  var body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  var signed = VERSION + '.' + body;
  return signed + '.' + hmac(secret, signed);
}

/**
 * Returns { ok: true, email, domain, customerId, exp } or
 * { ok: false, reason: 'malformed' | 'bad-signature' | 'expired' }.
 */
function verify(token, secret, now) {
  if (!secret) return { ok: false, reason: 'malformed' };
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
  var parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION || !parts[1] || !parts[2]) {
    return { ok: false, reason: 'malformed' };
  }
  var claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    return { ok: false, reason: 'malformed' };
  }
  if (!claims || typeof claims !== 'object' ||
      typeof claims.email !== 'string' || !claims.email ||
      typeof claims.domain !== 'string' || !claims.domain ||
      typeof claims.customerId !== 'string' || !claims.customerId ||
      !Number.isFinite(claims.exp)) {
    return { ok: false, reason: 'malformed' };
  }
  var expected = Buffer.from(hmac(secret, parts[0] + '.' + parts[1]), 'utf8');
  var got = Buffer.from(String(parts[2]), 'utf8');
  /* timingSafeEqual THROWS on a length mismatch — compare lengths first (codebase idiom). */
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }
  if (Number(now) > claims.exp) return { ok: false, reason: 'expired' };
  return {
    ok: true,
    email: claims.email,
    domain: claims.domain,
    customerId: claims.customerId,
    exp: claims.exp
  };
}

module.exports = { sign: sign, verify: verify };
