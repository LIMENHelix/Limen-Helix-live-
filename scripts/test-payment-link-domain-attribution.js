/**
 * test-payment-link-domain-attribution.js — a payment link pays into the domain that
 * sells the thing, and into no other.
 *
 * WHY. `createPaymentLink` hardcoded `domain: 'finance'` into the product AND the link
 * metadata on every link it had ever created. That was harmless while payment links only
 * fed the side-venture capital ledger, which keys on `streamId`. It stopped being harmless
 * the moment handlers/stripe-webhook.js began booking marked sessions into the twenty-domain
 * treasury: every domain's earnings would have been filed as Finance's, with a perfectly
 * valid-looking receipt.
 *
 * NO NETWORK. The attribution decision is a pure function precisely so this can run without
 * minting products, prices or links in what is a LIVE Stripe account.
 */
'use strict';

var assert = require('assert');
var rail = require('../lib/stripe-rail.js');
var Treasury = require('../lib/civilization-treasury-ledger.js');
var bridge = require('../lib/treasury-stripe-bridge.js');

var attribution = rail._paymentLinkAttribution;
var failures = 0;

function check(name, fn) {
  try { fn(); console.log('  pass: ' + name); }
  catch (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
}

console.log('payment link domain attribution');

check('omitting the domain preserves the legacy capital-engine shape exactly', function () {
  [undefined, null, '', '   '].forEach(function (v) {
    var a = attribution(v);
    assert.equal(a.ok, true, 'legacy must still be allowed');
    assert.equal(a.domain, 'finance', 'legacy links have always been stamped finance');
    assert.equal(a.limen, null, 'and must carry NO limen mark, or they would start booking to the treasury');
  });
});

check('a legacy link cannot book to a treasury account', function () {
  var a = attribution(undefined);
  var meta = { streamId: 'some-stream', domain: a.domain };
  if (a.limen) meta.limen = a.limen;
  assert.equal(bridge.isLimenProductSale(meta), false,
    'an unmarked legacy link must be invisible to the treasury bridge');
});

check('every one of the twenty domains can be named, and marks the session', function () {
  assert.equal(Treasury.DOMAINS.length, 20);
  Treasury.DOMAINS.forEach(function (d) {
    var a = attribution(d);
    assert.equal(a.ok, true, d + ' must be nameable');
    assert.equal(a.domain, d, d + ' must be stamped as itself, not as finance');
    assert.equal(a.limen, '1', d + ' must carry the mark that lets the webhook book it');
    var meta = { streamId: '', domain: a.domain, limen: a.limen };
    assert.equal(bridge.isLimenProductSale(meta), true, d + ' link must be bookable');
  });
});

check('the five that cannot sell today are still nameable', function () {
  /* The point of the whole change: a domain does not need a catalog offer to own a
     payment link. These five have no priced rung, and each can still mint a link for
     anything it decides to sell on a site it designs. */
  ['communication', 'culture', 'energy', 'industry', 'infrastructure'].forEach(function (d) {
    var a = attribution(d);
    assert.equal(a.ok, true, d + ' must be able to take money');
    assert.equal(a.domain, d);
    assert.equal(a.limen, '1');
  });
});

check('case and whitespace are normalised, not rejected', function () {
  ['  Medicine  ', 'MEDICINE', 'MeDiCiNe'].forEach(function (v) {
    var a = attribution(v);
    assert.equal(a.ok, true, JSON.stringify(v) + ' should normalise');
    assert.equal(a.domain, 'medicine');
  });
});

check('an unknown domain is refused, never defaulted to finance', function () {
  /* Defaulting is the dangerous behaviour: real money would land in the wrong account
     and the receipt would look entirely valid. */
  ['health', 'research', 'supplyChain', 'relay', 'nonsense', 'Finance Dept'].forEach(function (v) {
    var a = attribution(v);
    assert.equal(a.ok, false, JSON.stringify(v) + ' must be refused');
    assert.equal(a.domain, null, 'a refusal must not hand back a usable domain');
    assert.ok(/unknown product domain/.test(a.error), 'the error must name the cause: ' + a.error);
  });
});

check('the runtime aliases are refused by BOTH layers, consistently', function () {
  /* health/research/supplyChain are the snapshot runtime's keys for
     medicine/science/trade. A link minted under one would be refused at creation; if one
     ever reached the bridge it is refused there too. Neither layer guesses. */
  ['health', 'research', 'supplyChain'].forEach(function (v) {
    assert.equal(attribution(v).ok, false, v + ' refused at link creation');
    assert.equal(Treasury.DOMAINS.indexOf(v), -1, v + ' is not a treasury account');
  });
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('payment link domain attribution: all checks passed');
