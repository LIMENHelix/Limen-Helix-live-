/**
 * test-customer-portal-link.js — the signed, expiring link token that binds a customer-portal
 * redeem to one subscriber's email, domain and Stripe customer.
 *
 * WHY. handlers/customer-portal.js used to hand the Stripe portal URL to whoever POSTed a
 * matching {email, domain} (FIX-0068 / FIX-0115). The repair emails a link instead; this token
 * is what makes that link proof of inbox ownership rather than another guessable bearer. It
 * must be unforgeable without the server secret, bound to the exact customer, and dead after
 * its TTL — a link forwarded a day later must do nothing.
 *
 * RUN: node scripts/test-customer-portal-link.js
 */
'use strict';

var assert = require('assert');
var link = require('../lib/customer-portal-link.js');

var failures = 0;
function check(name, fn) {
  try { fn(); console.log('  pass: ' + name); }
  catch (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
}

var SECRET = 'unit-test-secret';
var NOW = 1730000000000;
var TTL = 30 * 60 * 1000;
var CLAIMS = { email: 'buyer@example.com', domain: 'finance', customerId: 'cus_123' };

console.log('customer portal link token');

check('sign/verify round-trips the exact claims and expiry', function () {
  var token = link.sign(CLAIMS, SECRET, NOW, TTL);
  var v = link.verify(token, SECRET, NOW + 1000);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.email, CLAIMS.email);
  assert.equal(v.domain, CLAIMS.domain);
  assert.equal(v.customerId, CLAIMS.customerId);
  assert.equal(v.exp, NOW + TTL);
});

check('a token verified with the WRONG secret fails closed', function () {
  var token = link.sign(CLAIMS, SECRET, NOW, TTL);
  var v = link.verify(token, 'attacker-does-not-know-this', NOW + 1000);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'bad-signature');
});

check('a token past its expiry is dead', function () {
  var token = link.sign(CLAIMS, SECRET, NOW, TTL);
  var v = link.verify(token, SECRET, NOW + TTL + 1);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'expired');
});

check('a token at exactly its expiry still verifies (boundary is inclusive)', function () {
  var token = link.sign(CLAIMS, SECRET, NOW, TTL);
  var v = link.verify(token, SECRET, NOW + TTL);
  assert.equal(v.ok, true, JSON.stringify(v));
});

check('a tampered payload is a signature failure, not a different claim set', function () {
  var token = link.sign(CLAIMS, SECRET, NOW, TTL);
  var parts = token.split('.');
  /* Attacker rewrites the victim's customerId to their own, keeping the old signature. */
  var forged = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  forged.customerId = 'cus_ATTACKER';
  parts[1] = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
  var v = link.verify(parts.join('.'), SECRET, NOW + 1000);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'bad-signature');
});

check('malformed tokens fail closed with a named reason, never throw', function () {
  ['', 'abc', 'v1', 'v1.', '..', 'v1.not-base64.sig', null, undefined, 42].forEach(function (t) {
    var v;
    try { v = link.verify(t, SECRET, NOW); } catch (e) {
      throw new Error('verify threw on ' + JSON.stringify(t) + ': ' + e.message);
    }
    assert.equal(v.ok, false, 'token ' + JSON.stringify(t) + ' must not verify');
    assert.equal(v.reason, 'malformed', 'token ' + JSON.stringify(t) + ' reason=' + v.reason);
  });
});

check('claims are normalized the way the route normalizes (trim + lowercase email)', function () {
  var token = link.sign({ email: ' Buyer@Example.com ', domain: 'Finance', customerId: 'cus_123' }, SECRET, NOW, TTL);
  var v = link.verify(token, SECRET, NOW + 1000);
  assert.equal(v.ok, true);
  assert.equal(v.email, 'buyer@example.com');
  assert.equal(v.domain, 'finance');
});

check('the signature covers every claim field (each field tamper fails)', function () {
  var token = link.sign(CLAIMS, SECRET, NOW, TTL);
  var sig = token.split('.')[2];
  ['email', 'domain', 'customerId', 'exp'].forEach(function (field) {
    var forged = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    forged[field] = field === 'exp' ? forged.exp + 999999 : 'tampered';
    var rejoined = 'v1.' + Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url') + '.' + sig;
    var v = link.verify(rejoined, SECRET, NOW + 1000);
    assert.equal(v.ok, false, 'tampering ' + field + ' must fail');
  });
});

console.log('');
if (failures) { console.error(failures + ' failure(s)'); process.exit(1); }
console.log('customer portal link token: all checks passed');
