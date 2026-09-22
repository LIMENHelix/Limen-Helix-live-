/**
 * test-relay-order-redirect.js — Relay payment links land the buyer on /relay-order, and
 * the rail's Customer Portal helper mints portal sessions on the SUBSCRIPTION key.
 *
 * WHY. Before PR-006 a Relay buyer paid and landed on Stripe's generic page with no order
 * number; the confirmation page only works because newly created links carry
 * after_completion. And the portal helper is the one path into Stripe's Customer Portal —
 * it must run on the subscriptions key (the customers live on that account) and it must
 * surface "portal not configured" as a distinct, named failure.
 *
 * NO NETWORK. Stripe is a fetch stub that records every request body; the bridge's rail is
 * injected through require.cache (the pattern scripts/test-relay-firewall.js F8 uses).
 *
 * RUN: node scripts/test-relay-order-redirect.js
 */
'use strict';

var assert = require('assert');

process.env.STRIPE_SECRET_KEY = 'sk_test_pr006_shared';
process.env.STRIPE_SECRET_KEY_SUBS = 'sk_test_pr006_subs';

var rail = require('../lib/stripe-rail.js');

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
  );
}

/* A Stripe stub that records calls and answers the three creations createPaymentLink makes. */
function stripeFetch(record, opts) {
  opts = opts || {};
  return async function (url, init) {
    record.push({ url: url, body: init && init.body, auth: init && init.headers && init.headers.Authorization });
    var path = String(url).replace('https://api.stripe.com/v1', '');
    if (opts.errorOn && path.indexOf(opts.errorOn) === 0) {
      return { ok: false, status: 400, json: async function () { return { error: { message: opts.errorMessage || 'stripe error' } }; } };
    }
    if (path === '/products') return { ok: true, json: async function () { return { id: 'prod_1' }; } };
    if (path === '/prices') return { ok: true, json: async function () { return { id: 'price_1' }; } };
    if (path === '/payment_links') return { ok: true, json: async function () { return { id: 'plink_1', url: 'https://buy.stripe.com/test' }; } };
    if (path === '/billing_portal/sessions') return { ok: true, json: async function () { return { id: 'bps_1', url: 'https://billing.stripe.com/session/test' }; } };
    throw new Error('unexpected stripe path ' + path);
  };
}

async function main() {
  console.log('relay order redirect + portal helper');

  var realFetch = global.fetch;

  await check('afterCompletionUrl adds after_completion redirect to a new payment link', async function () {
    var calls = [];
    global.fetch = stripeFetch(calls);
    try {
      var r = await rail.createPaymentLink({
        name: 'Relay order', amount: 25, streamId: 'relay-order',
        afterCompletionUrl: 'https://limenhelix.com/relay-order?session_id={CHECKOUT_SESSION_ID}'
      });
      assert.equal(r.ok, true);
      var linkCall = calls.filter(function (c) { return /payment_links$/.test(c.url); })[0];
      assert.ok(linkCall, 'a payment link was created');
      assert.ok(/after_completion%5Btype%5D=redirect/.test(linkCall.body), 'type=redirect present: ' + linkCall.body);
      assert.ok(/after_completion%5Bredirect%5D%5Burl%5D=/.test(linkCall.body), 'redirect url present');
      assert.ok(/relay-order/.test(decodeURIComponent(linkCall.body)), 'the url is the confirmation page');
      assert.ok(decodeURIComponent(linkCall.body).indexOf('{CHECKOUT_SESSION_ID}') !== -1, 'the session template survives encoding');
    } finally { global.fetch = realFetch; }
  });

  await check('omitting afterCompletionUrl keeps the legacy link shape byte-identical', async function () {
    var calls = [];
    global.fetch = stripeFetch(calls);
    try {
      var r = await rail.createPaymentLink({ name: 'X', amount: 10 });
      assert.equal(r.ok, true);
      var linkCall = calls.filter(function (c) { return /payment_links$/.test(c.url); })[0];
      assert.ok(!/after_completion/.test(linkCall.body), 'no after_completion on a legacy link');
    } finally { global.fetch = realFetch; }
  });

  await check('relay-finance-bridge.createPayment sends every buyer to /relay-order', async function () {
    var bridgePath = require.resolve('../lib/relay-finance-bridge.js');
    var stripePath = require.resolve('../lib/stripe-rail.js');
    var realStripe = require('../lib/stripe-rail.js');
    var seen = [];
    require.cache[stripePath].exports = {
      hasKey: function () { return true; },
      createPaymentLink: async function (o) {
        seen.push(o);
        return { ok: true, url: 'https://buy.stripe.com/test', paymentLinkId: 'plink_1' };
      }
    };
    delete require.cache[bridgePath];
    try {
      var bridge = require('../lib/relay-finance-bridge.js');
      var r = await bridge.createPayment({ amount: 25, orderId: 'o-1' });
      assert.equal(r.ok, true);
      assert.equal(seen.length, 1);
      assert.equal(seen[0].afterCompletionUrl, bridge.ORDER_CONFIRMATION_URL, 'the bridge names the confirmation URL');
      assert.ok(/^https:\/\/limenhelix\.com\/relay-order\?session_id=\{CHECKOUT_SESSION_ID\}$/.test(seen[0].afterCompletionUrl),
        'default URL is the confirmation page with the session template: ' + seen[0].afterCompletionUrl);
    } finally {
      require.cache[stripePath].exports = realStripe;
      delete require.cache[bridgePath];
    }
  });

  await check('the C2C marketplace checkout also redirects to /relay-order', async function () {
    var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'handlers', 'relay-marketplace-checkout.js'), 'utf8');
    assert.ok(/afterCompletionUrl: ORDER_CONFIRMATION_URL/.test(src));
    assert.ok(/\/relay-order\?session_id=\{CHECKOUT_SESSION_ID\}/.test(src));
  });

  await check('createPortalSession posts to billing_portal/sessions on the SUBSCRIPTION key', async function () {
    var calls = [];
    global.fetch = stripeFetch(calls);
    try {
      var r = await rail.createPortalSession({ customerId: 'cus_1', returnUrl: 'https://limenhelix.com/finance' });
      assert.equal(r.ok, true);
      assert.equal(r.url, 'https://billing.stripe.com/session/test');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].auth, 'Bearer sk_test_pr006_subs', 'portal customers live on the subs account');
      assert.ok(/customer=cus_1/.test(calls[0].body));
      assert.ok(/return_url=/.test(calls[0].body));
    } finally { global.fetch = realFetch; }
  });

  await check('an unactivated portal is flagged portalNotConfigured for the 503 path', async function () {
    var calls = [];
    global.fetch = stripeFetch(calls, {
      errorOn: '/billing_portal/sessions',
      errorMessage: 'No configuration provided and no default configuration has been set for the customer portal'
    });
    try {
      var r = await rail.createPortalSession({ customerId: 'cus_1', returnUrl: 'https://limenhelix.com/finance' });
      assert.equal(r.ok, false);
      assert.equal(r.portalNotConfigured, true);
    } finally { global.fetch = realFetch; }
  });

  await check('createPortalSession refuses a missing customerId before touching Stripe', async function () {
    var calls = [];
    global.fetch = stripeFetch(calls);
    try {
      var r = await rail.createPortalSession({ returnUrl: 'https://limenhelix.com/finance' });
      assert.equal(r.ok, false);
      assert.equal(calls.length, 0, 'no Stripe call without a customer');
    } finally { global.fetch = realFetch; }
  });

  await check('the relay-order route reads one session through the bridge and fails soft', async function () {
    var mod = require('../handlers/relay-order.js');
    function res() {
      return {
        statusCode: 0, headers: {}, body: null,
        setHeader: function (k, v) { this.headers[k] = v; },
        end: function (s) { this.body = JSON.parse(s); }
      };
    }
    function req(url) { return { method: 'GET', url: url, on: function () {} }; }

    var h = mod.createHandler({ orderConfirmation: async function () { return { ok: true, orderId: 'o-9', amount: 25, currency: 'usd', paid: true }; } });
    var r1 = res();
    await h(req('/api/relay-order?session_id=cs_test_1'), r1);
    assert.equal(r1.statusCode, 200);
    assert.equal(r1.body.orderId, 'o-9');
    assert.ok(!('email' in r1.body) && !('shippingAddress' in r1.body), 'no PII beyond the order reference');

    var r2 = res();
    await h(req('/api/relay-order'), r2);
    assert.equal(r2.statusCode, 400);

    var hDown = mod.createHandler({ orderConfirmation: async function () { return { ok: false, error: 'stripe unreachable' }; } });
    var r3 = res();
    await hDown(req('/api/relay-order?session_id=cs_test_1'), r3);
    assert.equal(r3.statusCode, 502);
    assert.equal(r3.body.ok, false);

    var hThrow = mod.createHandler({ orderConfirmation: async function () { throw new Error('boom'); } });
    var r4 = res();
    await hThrow(req('/api/relay-order?session_id=cs_test_1'), r4);
    assert.equal(r4.statusCode, 502, 'a throwing read still answers a clean fail-soft 502');
  });

  await check('bridge.orderConfirmation refuses junk ids before any network call', async function () {
    var bridge = require('../lib/relay-finance-bridge.js');
    var calls = 0;
    global.fetch = async function () { calls++; throw new Error('must not be called'); };
    try {
      var r = await bridge.orderConfirmation('../../etc/passwd');
      assert.equal(r.ok, false);
      assert.equal(calls, 0);
    } finally { global.fetch = realFetch; }
  });

  await check('the route is registered in the catch-all', async function () {
    var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'api', '[...route].js'), 'utf8');
    assert.ok(/'relay-order':\s*require\('\.\.\/handlers\/relay-order'\)/.test(src));
  });

  console.log('');
  if (failures) {
    console.error(failures + ' failure(s)');
    process.exit(1);
  }
  console.log('relay order redirect + portal helper: all checks passed');
}

main().catch(function (e) { console.error(e); process.exit(1); });
