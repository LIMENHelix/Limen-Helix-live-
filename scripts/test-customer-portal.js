/**
 * test-customer-portal.js — self-serve cancellation. A Stripe Customer Portal session reaches
 * ONLY the inbox of the verified active subscriber it belongs to, and nobody else.
 *
 * WHY THE CONTRACT CHANGED (FIX-0068, customer-portal portion of FIX-0115). The old route
 * returned the portal session URL in the POST response to anyone who presented an {email,
 * domain} pair matching an active subscriber. Knowing a victim's email and domain is not
 * ownership of the account — breach dumps carry both — so a stranger could read the victim's
 * invoices and cancel their subscription. Email is the identity (lib/subscriptions.js), so
 * proof of ownership is control of the inbox:
 *
 *   POST /api/customer-portal  { email, domain }  → 200 { ok, message }   ALWAYS the same body;
 *                                  a verified subscriber is EMAILED a signed, expiring link.
 *                                  No portal session is minted at request time.
 *   GET  /api/customer-portal?token=…             → 302 to a freshly minted Stripe portal
 *                                  session, after signature + expiry + a fresh strict-store
 *                                  check that the token's email still maps to the token's
 *                                  Stripe customer.
 *
 * FAIL CLOSED, in both directions:
 *   unknown / inactive / wrong-domain email → the SAME 200 body as a real subscriber, so the
 *                                             route cannot enumerate who subscribes to what
 *   store unreachable                       → 503 subscription-lookup-unavailable
 *   link secret / email transport missing   → 503 with the named operator reason
 *   Stripe portal not activated (dashboard) → 503 with the named reason, at redeem time
 *
 * NO NETWORK, NO STRIPE, NO RESEND. The rail's portal helper and the mail transport are
 * injected; the subscriber lookup runs against an in-memory strict store shaped like
 * lib/autofire-efference-store.
 *
 * RUN: node scripts/test-customer-portal.js
 */
'use strict';

var assert = require('assert');
var mod = require('../handlers/customer-portal.js');
var link = require('../lib/customer-portal-link.js');

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
  );
}

var SECRET = 'route-test-secret';
var NOW = 1730000000000;
var ENV = { CUSTOMER_PORTAL_LINK_SECRET: SECRET };

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
    end: function (s) {
      try { this.body = JSON.parse(s); } catch (e) { this.body = s; }
    }
  };
}
function fakeReq(method, body, query) {
  return { method: method, url: '/api/customer-portal', query: query || {}, body: body || undefined, on: function () {} };
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
function mailSpy(opts) {
  opts = opts || {};
  var calls = [];
  var fn = async function (to, subject, body) {
    calls.push({ to: to, subject: subject, body: body });
    if (opts.notReady) return { ok: false, notReady: true, reason: 'RESEND_API_KEY not set' };
    if (opts.fail) return { ok: false, error: 'resend 500' };
    return { ok: true, id: 'email_test_1' };
  };
  fn.calls = calls;
  return fn;
}
function deps(over) {
  return Object.assign({ store: memStrict(ACTIVE), createPortalSession: portalSpy(), mailer: mailSpy(), env: ENV, now: function () { return NOW; }, site: 'https://limenhelix.com' }, over || {});
}

var ACTIVE = {
  'buyer@example.com': {
    email: 'buyer@example.com', domain: 'finance', active: true,
    customerId: 'cus_123', subscriptionId: 'sub_123'
  }
};

async function main() {
  console.log('customer portal');

  await check('an unknown email gets the generic 200 and NOTHING else — no session, no email', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var h = mod.createHandler(deps({ store: memStrict({}), createPortalSession: portal, mailer: mailer }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'stranger@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(!('url' in res.body), 'the response must never carry a portal URL');
    assert.ok(!/stranger@example\.com/.test(JSON.stringify(res.body)), 'the reply must not echo the email back');
    assert.equal(portal.calls.length, 0, 'never mint a session at request time');
    assert.equal(mailer.calls.length, 0, 'no email for an unknown address');
  });

  await check('unknown, inactive and wrong-domain are byte-identical to a real subscriber (no enumeration)', async function () {
    var bodies = [];
    var mk = function (map) {
      return mod.createHandler(deps({ store: memStrict(map) }));
    };
    var inactive = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { active: false }) };
    var cases = [
      [mk({}), { email: 'a@b.co', domain: 'finance' }],
      [mk(inactive), { email: 'buyer@example.com', domain: 'finance' }],
      [mk(ACTIVE), { email: 'buyer@example.com', domain: 'law' }],
      [mk(ACTIVE), { email: 'buyer@example.com', domain: 'finance' }]   // the real subscriber
    ];
    for (var i = 0; i < cases.length; i++) {
      var res = fakeRes();
      await cases[i][0](fakeReq('POST', cases[i][1]), res);
      bodies.push({ code: res.statusCode, body: JSON.stringify(res.body) });
    }
    for (var j = 1; j < bodies.length; j++) {
      assert.deepEqual(bodies[j], bodies[0], 'case ' + j + ' must be indistinguishable from case 0: ' + JSON.stringify(bodies));
    }
  });

  /* THE FIX-0068 DEFECT: the requester is a stranger; the only place a portal link may go
     is the subscriber's own inbox. */
  await check('a stranger presenting a victim\'s email+domain gets no session — the link goes only to the victim\'s inbox', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var h = mod.createHandler(deps({ createPortalSession: portal, mailer: mailer }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 200);
    var raw = JSON.stringify(res.body);
    assert.ok(!/billing\.stripe\.com/.test(raw), 'no Stripe session URL may reach the requester');
    assert.ok(!('url' in res.body), 'no url field at all');
    assert.equal(portal.calls.length, 0, 'no session is minted at request time');
    assert.equal(mailer.calls.length, 1, 'exactly one email');
    assert.equal(mailer.calls[0].to, 'buyer@example.com', 'and it goes to the subscriber, not the requester');
    assert.ok(mailer.calls[0].body.indexOf('https://limenhelix.com/api/customer-portal?token=') !== -1,
      'the email carries the signed redeem link');
  });

  await check('the emailed token redeems: strict-store recheck, session minted for the token\'s customer, 302', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var h = mod.createHandler(deps({ createPortalSession: portal, mailer: mailer }));
    var req = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), req);
    var token = mailer.calls[0].body.match(/token=([^\s]+)/)[1];

    var res = fakeRes();
    await h(fakeReq('GET', undefined, { token: token }), res);
    assert.equal(res.statusCode, 302, JSON.stringify(res.body));
    assert.equal(res.headers.location, 'https://billing.stripe.com/session/test_123');
    assert.equal(portal.calls.length, 1);
    assert.equal(portal.calls[0].customerId, 'cus_123', 'the session is for the subscriber\'s Stripe customer');
    assert.equal(portal.calls[0].returnUrl, 'https://limenhelix.com/finance', 'and returns them to their domain');
  });

  await check('a tampered token redeems nothing', async function () {
    var portal = portalSpy();
    var h = mod.createHandler(deps({ createPortalSession: portal }));
    var token = link.sign({ email: 'buyer@example.com', domain: 'finance', customerId: 'cus_123' }, SECRET, NOW, 1800000);
    var parts = token.split('.');
    var forged = Object.assign({}, JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')), { customerId: 'cus_ATTACKER' });
    parts[1] = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
    var res = fakeRes();
    await h(fakeReq('GET', undefined, { token: parts.join('.') }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(portal.calls.length, 0);
  });

  await check('an expired token redeems nothing, with a named reason', async function () {
    var portal = portalSpy();
    var h = mod.createHandler(deps({ createPortalSession: portal }));
    var stale = link.sign({ email: 'buyer@example.com', domain: 'finance', customerId: 'cus_123' }, SECRET, NOW - 3600000, 1800000);
    var res = fakeRes();
    await h(fakeReq('GET', undefined, { token: stale }), res);
    assert.equal(res.statusCode, 410, 'expired links get 410 Gone');
    assert.ok(/expired/.test(String(res.body)), 'the page says why');
    assert.equal(portal.calls.length, 0);
  });

  await check('cross-customer: a token whose email no longer maps to its Stripe customer redeems nothing', async function () {
    var portal = portalSpy();
    /* The record changed since the link was issued (re-subscribe on a new customer, or the
       token was minted for someone else entirely). customerId comes from the token AND the
       store; a mismatch is a refusal, never a session for the token's claims alone. */
    var moved = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { customerId: 'cus_NEW' }) };
    var h = mod.createHandler(deps({ store: memStrict(moved), createPortalSession: portal }));
    var token = link.sign({ email: 'buyer@example.com', domain: 'finance', customerId: 'cus_123' }, SECRET, NOW, 1800000);
    var res = fakeRes();
    await h(fakeReq('GET', undefined, { token: token }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(portal.calls.length, 0, 'never mint for a customer the store no longer binds to this email');
  });

  await check('redeem with an unreachable store fails closed, never mints', async function () {
    var portal = portalSpy();
    var h = mod.createHandler(deps({ store: memStrict(ACTIVE, { down: true }), createPortalSession: portal }));
    var token = link.sign({ email: 'buyer@example.com', domain: 'finance', customerId: 'cus_123' }, SECRET, NOW, 1800000);
    var res = fakeRes();
    await h(fakeReq('GET', undefined, { token: token }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(portal.calls.length, 0);
  });

  await check('redeem surfaces the operator reasons: portal-not-configured 503, generic stripe failure 502', async function () {
    var token = link.sign({ email: 'buyer@example.com', domain: 'finance', customerId: 'cus_123' }, SECRET, NOW, 1800000);
    var h1 = mod.createHandler(deps({ createPortalSession: portalSpy({ notConfigured: true }) }));
    var r1 = fakeRes();
    await h1(fakeReq('GET', undefined, { token: token }), r1);
    assert.equal(r1.statusCode, 503);
    assert.ok(/stripe-customer-portal-not-configured/.test(String(r1.body)), String(r1.body));

    var h2 = mod.createHandler(deps({ createPortalSession: portalSpy({ fail: true }) }));
    var r2 = fakeRes();
    await h2(fakeReq('GET', undefined, { token: token }), r2);
    assert.equal(r2.statusCode, 502);
  });

  await check('an unreachable store fails CLOSED with 503 at request time, nothing sent or minted', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var h = mod.createHandler(deps({ store: memStrict(ACTIVE, { down: true }), createPortalSession: portal, mailer: mailer }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'subscription-lookup-unavailable');
    assert.equal(portal.calls.length, 0);
    assert.equal(mailer.calls.length, 0);
  });

  await check('no link secret configured → 503 with the named operator reason, fail closed', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var h = mod.createHandler(deps({ env: {}, createPortalSession: portal, mailer: mailer }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.ok(/customer-portal-link-not-configured/.test(res.body.error), res.body.error);
    assert.equal(portal.calls.length, 0);
    assert.equal(mailer.calls.length, 0);
  });

  await check('email transport not ready → 503 named reason, no session minted', async function () {
    var portal = portalSpy();
    var h = mod.createHandler(deps({ mailer: mailSpy({ notReady: true }), createPortalSession: portal }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.ok(/customer-portal-email-unavailable/.test(res.body.error), res.body.error);
    assert.equal(portal.calls.length, 0);
  });

  await check('a failed send is a 502, not a fake success and not a session', async function () {
    var portal = portalSpy();
    var h = mod.createHandler(deps({ mailer: mailSpy({ fail: true }), createPortalSession: portal }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, false);
    assert.equal(portal.calls.length, 0);
  });

  await check('an active record with no Stripe customer reference cannot send a link', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var map = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { customerId: null }) };
    var h = mod.createHandler(deps({ store: memStrict(map), createPortalSession: portal, mailer: mailer }));
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 503);
    assert.ok(/no-customer-reference/.test(res.body.error));
    assert.equal(portal.calls.length, 0);
    assert.equal(mailer.calls.length, 0);
  });

  await check('malformed input is a 400 before any lookup, send or mint', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var h = mod.createHandler(deps({ createPortalSession: portal, mailer: mailer }));
    var r1 = fakeRes();
    await h(fakeReq('POST', { email: 'not-an-email', domain: 'finance' }), r1);
    assert.equal(r1.statusCode, 400);
    var r2 = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com' }), r2);
    assert.equal(r2.statusCode, 400);
    assert.equal(portal.calls.length, 0);
    assert.equal(mailer.calls.length, 0);
  });

  await check('GET without a token is a 400, not a session', async function () {
    var portal = portalSpy();
    var h = mod.createHandler(deps({ createPortalSession: portal }));
    var res = fakeRes();
    await h(fakeReq('GET'), res);
    assert.equal(res.statusCode, 400);
    assert.equal(portal.calls.length, 0);
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
