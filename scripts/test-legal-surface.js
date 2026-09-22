/**
 * test-legal-surface.js — the legal surface exists and every money-taking page links to it.
 *
 * WHY. PR-006's externally-meaningful result is structural: every page that takes recurring
 * money must link to the privacy/terms/refund documents, and the cancellation path those
 * documents promise must be the one the code implements. This test pins that structure so a
 * later edit cannot quietly unlink a front, rename a route, or reintroduce the "reply to
 * this email" cancellation language that had no listener.
 *
 * WHAT IT DOES NOT CHECK: the legal TEXT. Every sentence of it is operator-reviewed before
 * merge; this test only pins the facts that are also locked program parameters (entity name,
 * support address, final-sale policy, self-serve cancellation via the Stripe portal).
 *
 * RUN: node scripts/test-legal-surface.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var failures = 0;
function check(name, fn) {
  try { fn(); console.log('  pass: ' + name); }
  catch (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
}

var DOMAINS = require('../lib/civilization-treasury-ledger.js').DOMAINS;

console.log('legal surface');

check('exactly the twenty treasury domains have fronts, and each front exists', function () {
  assert.equal(DOMAINS.length, 20);
  DOMAINS.forEach(function (d) {
    assert.ok(fs.existsSync(path.join(ROOT, d + '.html')), d + '.html missing');
  });
});

check('every domain front includes the checkout-result banner script', function () {
  DOMAINS.forEach(function (d) {
    var html = read(d + '.html');
    assert.ok(html.indexOf('/assets/js/checkout-result.js') !== -1, d + '.html does not include checkout-result.js');
  });
});

check('every domain front links all four legal/support destinations', function () {
  DOMAINS.forEach(function (d) {
    var html = read(d + '.html');
    ['/privacy', '/terms', '/refunds', '/cancel'].forEach(function (href) {
      assert.ok(html.indexOf('href="' + href + '"') !== -1, d + '.html does not link ' + href);
    });
  });
});

check('the legal pages exist and carry the locked operator parameters', function () {
  ['privacy.html', 'terms.html', 'refunds.html'].forEach(function (p) {
    var html = read(p);
    assert.ok(html.indexOf('LIMEN Helix Transformational Sciences LLC') !== -1, p + ' must name the entity');
    assert.ok(html.indexOf('chris@limenhelix.com') !== -1, p + ' must name the support contact');
  });
});

check('the refunds page states final sale plainly', function () {
  var html = read('refunds.html');
  assert.ok(/final sale/i.test(html), 'final-sale policy present');
  assert.ok(/bank and Stripe/.test(html), 'disputes are named as bank/Stripe-handled');
  assert.ok(html.indexOf('/cancel') !== -1, 'points at self-serve cancellation as the remedy');
});

check('the terms page promises cancellation at period end via the portal, and nothing else', function () {
  var html = read('terms.html');
  assert.ok(html.indexOf('/cancel') !== -1);
  assert.ok(/end of the current paid period/.test(html), 'cancel timing is period-end');
  assert.ok(!/reply to/i.test(html), 'no reply-to-cancel language');
});

check('the privacy page claims only data practices that exist in the code', function () {
  var html = read('privacy.html');
  assert.ok(/Stripe-hosted pages/.test(html), 'payment processing named as Stripe-hosted');
  assert.ok(/Resend/.test(html), 'email delivery named as Resend');
  assert.ok(/watch/.test(html), 'the checkout watch field is disclosed');
});

check('cancel.html posts to the portal route and explains period-end cancellation', function () {
  var html = read('cancel.html');
  assert.ok(html.indexOf('/api/customer-portal') !== -1, 'posts to the portal route');
  assert.ok(/end of the current paid period/.test(html));
  assert.ok(html.indexOf('chris@limenhelix.com') !== -1);
});

check('the welcome and renewal emails point at the portal, not at a reply nobody reads', function () {
  var src = read('handlers/stripe-webhook.js');
  assert.ok(!/reply to this email/i.test(src), '"reply to this email" is gone');
  var hits = src.match(/SITE \+ '\/cancel/g) || [];
  assert.ok(hits.length >= 2, 'welcome AND renewal templates both link the cancel page (' + hits.length + ' found)');
});

check('relay-order.html exists, reads the session through its route, and fails soft', function () {
  var html = read('relay-order.html');
  assert.ok(html.indexOf('/api/relay-order?session_id=') !== -1);
  assert.ok(/receipt email is your confirmation/i.test(html), 'the fail-soft copy is present');
});

console.log('');
if (failures) {
  console.error(failures + ' failure(s)');
  process.exit(1);
}
console.log('legal surface: all checks passed');
