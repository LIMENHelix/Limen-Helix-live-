/**
 * test-customer-portal.js — self-serve cancellation opens a Stripe Customer Portal session
 * for a VERIFIED active subscriber, and for nobody else.
 *
 * WHY. The portal is the only cancellation channel the legal pages promise, so this route
 * is the whole promise. Its two failure modes are opposite and both matter: minting a
 * session for an unverified email hands a stranger control of someone's subscription, and
 * refusing a real subscriber (or 500ing because the store hiccuped) breaks the one
 * cancellation path we publish. Fail closed, and fail with a named reason when the cause
 * is operator-side (portal not activated in the Stripe dashboard).
 *
 * NO NETWORK, NO STRIPE. The rail's portal helper is injected; the subscriber lookup runs
 * against an in-memory strict store shaped like lib/autofire-efference-store.
 *
 * RUN: node scripts/test-customer-portal.js
 */
'use strict';

var assert = require('assert');
var mod = require('../handlers/customer-portal.js');

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
  );
}

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = JSON.parse(s); }
  };
}
function fakeReq(method, body) {
  return { method: method, url: '/api/customer-portal', body: body || undefined, on: function () {} };
}
/* Shaped like the strict store subscriptions.getStrict drives: assertDurable + get. */
function memStrict(subsMap, opts) {
  opts = opts || {};
  return {
    assertDurable: function () { if (opts.notDurable) throw new Error('not durable'); },
    get: async function (k) {
      if (opts.down) throw new Error('redis unreachable');
      assert.equal(k, 'subs:v1', 'the subscriber store key must not drift');
      return subsMap;
    }
  };
}
function portalSpy(opts) {
  opts = opts || {};
  var calls = [];
  var fn = async function (o) {
    calls.push(o);
    if (opts.notConfigured) return { ok: false, error: 'No configuration provided for the customer portal', portalNotConfigured: true };
    if (opts.fail) return { ok: false, error: 'stripe said no' };
    return { ok: true, url: 'https://billing.stripe.com/session/test_123' };
  };
  fn.calls = calls;
  return fn;
}

var ACTIVE = {
  'buyer@example.com': {
    email: 'buyer@example.com', domain: 'finance', active: true,
    customerId: 'cus_123', subscriptionId: 'sub_123'
  }
};

async function main() {
  console.log('customer portal');

  await check('an unknown email gets the generic refusal and NO portal session', async function () {
    var portal = portalSpy();
    var h = mod.createHandler({ store: memStrict({}), createPortalSession: portal });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'stranger@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 404);
    assert.ok(!/stranger@example\.com/.test(res.body.error), 'the refusal must not echo the email back');
    assert.equal(portal.calls.length, 0, 'never mint a session for an unverified email');
  });

  await check('an INACTIVE subscriber gets the same generic refusal as a stranger', async function () {
    var portal = portalSpy();
    var map = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { active: false }) };
    var h = mod.createHandler({ store: memStrict(map), createPortalSession: portal });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(portal.calls.length, 0);
  });

  await check('the refusal is byte-identical for unknown vs inactive (no account enumeration)', async function () {
    var h1 = mod.createHandler({ store: memStrict({}), createPortalSession: portalSpy() });
    var map = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { active: false }) };
    var h2 = mod.createHandler({ store: memStrict(map), createPortalSession: portalSpy() });
    var r1 = fakeRes(), r2 = fakeRes();
    await h1(fakeReq('POST', { email: 'a@b.co', domain: 'finance' }), r1);
    await h2(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), r2);
    assert.equal(r1.body.error, r2.body.error, 'identical error text');
    assert.equal(r1.statusCode, r2.statusCode, 'identical status');
  });

  await check('the right email on the WRONG domain is refused', async function () {
    var portal = portalSpy();
    var h = mod.createHandler({ store: memStrict(ACTIVE), createPortalSession: portal });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'law' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(portal.calls.length, 0);
  });

  await check('an unreachable store fails CLOSED with 503, never as "no such subscriber"', async function () {
    var portal = portalSpy();
    var h = mod.createHandler({ store: memStrict(ACTIVE, { down: true }), createPortalSession: portal });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'subscription-lookup-unavailable');
    assert.equal(portal.calls.length, 0, 'an unreadable store must never become a session');
  });

  await check('a verified ACTIVE subscriber gets a portal session for their Stripe customer', async function () {
    var portal = portalSpy();
    var h = mod.createHandler({ store: memStrict(ACTIVE), createPortalSession: portal, site: 'https://limenhelix.com' });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'Buyer@Example.com ', domain: 'finance' }), res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.url, 'https://billing.stripe.com/session/test_123');
    assert.equal(portal.calls.length, 1);
    assert.equal(portal.calls[0].customerId, 'cus_123', 'the session is for the subscriber\'s Stripe customer');
    assert.equal(portal.calls[0].returnUrl, 'https://limenhelix.com/finance', 'and returns them to their domain');
  });

  await check('an active record with no Stripe customer reference cannot mint a session', async function () {
    var portal = portalSpy();
    var map = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { customerId: null }) };
    var h = mod.createHandler({ store: memStrict(map), createPortalSession: portal });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.ok(/no-customer-reference/.test(res.body.error));
    assert.equal(portal.calls.length, 0);
  });

  await check('portal not activated in the Stripe dashboard → 503 with the named operator reason', async function () {
    var portal = portalSpy({ notConfigured: true });
    var h = mod.createHandler({ store: memStrict(ACTIVE), createPortalSession: portal });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.ok(/stripe-customer-portal-not-configured/.test(res.body.error), res.body.error);
  });

  await check('a generic Stripe failure is a 502, not a refusal and not a 500', async function () {
    var h = mod.createHandler({ store: memStrict(ACTIVE), createPortalSession: portalSpy({ fail: true }) });
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, false);
  });

  await check('malformed input is a 400 before any lookup', async function () {
    var portal = portalSpy();
    var h = mod.createHandler({ store: memStrict(ACTIVE), createPortalSession: portal });
    var r1 = fakeRes();
    await h(fakeReq('POST', { email: 'not-an-email', domain: 'finance' }), r1);
    assert.equal(r1.statusCode, 400);
    var r2 = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com' }), r2);
    assert.equal(r2.statusCode, 400);
    assert.equal(portal.calls.length, 0);
  });

  await check('GET is refused', async function () {
    var h = mod.createHandler({ store: memStrict(ACTIVE), createPortalSession: portalSpy() });
    var res = fakeRes();
    await h(fakeReq('GET'), res);
    assert.equal(res.statusCode, 405);
  });

  await check('the route is registered in the catch-all', async function () {
    var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'api', '[...route].js'), 'utf8');
    assert.ok(/'customer-portal':\s*require\('\.\.\/handlers\/customer-portal'\)/.test(src));
  });

  console.log('');
  if (failures) {
    console.error(failures + ' failure(s)');
    process.exit(1);
  }
  console.log('customer portal: all checks passed');
}

main().catch(function (e) { console.error(e); process.exit(1); });
