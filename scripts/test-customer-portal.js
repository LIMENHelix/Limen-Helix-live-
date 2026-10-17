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
 * REVIEW ROUND 2 (Codex P2s): the response must not enumerate subscribers by ANY channel.
 *   - Failure responses: transport-not-ready, send-failed and no-customer-reference used to
 *     return subscriber-specific 503/502s. All well-formed POSTs now return the identical
 *     body; subscriber-specific causes go to protected diagnostics (function logs).
 *   - Timing: the response never waits on the email transport. Delivery runs through the
 *     serverless waitUntil (reliable: the invocation stays alive until the send settles);
 *     without that runtime hook the send is awaited — slow locally, never lost.
 *
 * FAIL CLOSED, in both directions:
 *   unknown / inactive / wrong-domain email → the SAME 200 body as a real subscriber, so the
 *                                             route cannot enumerate who subscribes to what
 *   store unreachable                       → 503 subscription-lookup-unavailable (identical
 *                                             for every requester — not an account oracle)
 *   link secret missing                     → 503 with the named reason, before any lookup
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
/* The public contract, pinned verbatim: every well-formed POST returns exactly this. */
var GENERIC_MESSAGE = 'If an active subscription exists for that email on that domain, a sign-in link is on its way to that inbox. It expires in 30 minutes.';

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
  var captured = { pending: [], logs: [] };
  var d = Object.assign({
    store: memStrict(ACTIVE), createPortalSession: portalSpy(), mailer: mailSpy(),
    env: ENV, now: function () { return NOW; }, site: 'https://limenhelix.com',
    waitUntil: function (p) { captured.pending.push(p); },
    logger: { error: function (m) { captured.logs.push(String(m)); } }
  }, over || {});
  d.captured = captured;
  return d;
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
    assert.deepEqual(res.body, { ok: true, message: GENERIC_MESSAGE });
    assert.ok(!('url' in res.body), 'the response must never carry a portal URL');
    assert.equal(portal.calls.length, 0, 'never mint a session at request time');
    assert.equal(mailer.calls.length, 0, 'no email for an unknown address');
  });

  await check('EVERY well-formed POST is byte-identical: unknown, inactive, wrong-domain, transport-down, send-failed, no-customer-ref, subscriber', async function () {
    var inactive = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { active: false }) };
    var noCust = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { customerId: null }) };
    var cases = [
      deps({ store: memStrict({}) }),                                        // unknown email
      deps({ store: memStrict(inactive) }),                                  // inactive
      deps({ store: memStrict(ACTIVE) }),                                    // wrong domain (below)
      deps({ store: memStrict(ACTIVE), mailer: mailSpy({ notReady: true }) }),   // transport down
      deps({ store: memStrict(ACTIVE), mailer: mailSpy({ fail: true }) }),       // send failed
      deps({ store: memStrict(noCust) }),                                    // no customer reference
      deps({ store: memStrict(ACTIVE) })                                     // the real subscriber
    ];
    var bodies = [];
    for (var i = 0; i < cases.length; i++) {
      var domain = i === 2 ? 'law' : 'finance';
      var h = mod.createHandler(cases[i]);
      var res = fakeRes();
      await h(fakeReq('POST', { email: i === 0 ? 'a@b.co' : 'buyer@example.com', domain: domain }), res);
      await Promise.all(cases[i].captured.pending);   // let background delivery settle
      bodies.push({ code: res.statusCode, body: JSON.stringify(res.body) });
    }
    for (var j = 1; j < bodies.length; j++) {
      assert.deepEqual(bodies[j], bodies[0], 'case ' + j + ' must be indistinguishable from case 0: ' + JSON.stringify(bodies));
    }
    assert.deepEqual(bodies[0], { code: 200, body: JSON.stringify({ ok: true, message: GENERIC_MESSAGE }) });
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

  await check('the response does NOT wait on the email transport, and delivery still completes (timing oracle closed)', async function () {
    var resolveSend;
    var gate = new Promise(function (resolve) { resolveSend = resolve; });
    var calls = 0;
    var mailer = async function () { calls++; await gate; return { ok: true, id: 'e1' }; };
    var d = deps({ mailer: mailer });
    var h = mod.createHandler(d);
    var res = fakeRes();
    var responded = false;
    var p = h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res)
      .then(function () { responded = true; });
    /* Give the handler every chance to respond; the send is still blocked on the gate. */
    await new Promise(function (r) { setTimeout(r, 25); });
    assert.equal(calls, 1, 'the send started');
    assert.equal(responded, true, 'the response must not wait on the transport (188ms-vs-0ms oracle)');
    assert.deepEqual(res.body, { ok: true, message: GENERIC_MESSAGE });
    assert.equal(d.captured.pending.length, 1, 'delivery was handed to the runtime keep-alive');
    resolveSend();                                   // let the transport finish
    await p;
    await Promise.all(d.captured.pending);           // reliable: delivery really settles
    assert.equal(d.captured.logs.length, 0, 'a clean send logs nothing');
  });

  await check('without a waitUntil hook the send is awaited — slow, never lost (local fallback)', async function () {
    var order = [];
    var mailer = async function () {
      order.push('send-start');
      await new Promise(function (r) { setTimeout(r, 5); });
      order.push('send-end');
      return { ok: true, id: 'e1' };
    };
    var d = deps({ mailer: mailer, waitUntil: null });
    var h = mod.createHandler(d);
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(order, ['send-start', 'send-end'], 'the send settled before the response');
  });

  await check('a runtime that cannot register waitUntil: delivery still happens inline, failure logged', async function () {
    var d = deps({ waitUntil: function () { throw new Error('no request context'); } });
    var h = mod.createHandler(d);
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.deepEqual(res.body, { ok: true, message: GENERIC_MESSAGE });
    assert.equal(d.mailer.calls.length, 1, 'the email is never dropped');
    assert.ok(d.captured.logs.some(function (m) { return /waitUntil-unavailable/.test(m); }),
      'registration failure is operator-visible: ' + JSON.stringify(d.captured.logs));
  });

  await check('transport not ready: generic body publicly, named reason in protected diagnostics', async function () {
    var portal = portalSpy();
    var d = deps({ mailer: mailSpy({ notReady: true }), createPortalSession: portal });
    var h = mod.createHandler(d);
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.deepEqual(res.body, { ok: true, message: GENERIC_MESSAGE });
    await Promise.all(d.captured.pending);
    assert.ok(d.captured.logs.some(function (m) { return /customer-portal-email-unavailable/.test(m); }),
      'the operator can still see why: ' + JSON.stringify(d.captured.logs));
    assert.equal(portal.calls.length, 0);
  });

  await check('a failed send: generic body publicly, named reason in protected diagnostics', async function () {
    var portal = portalSpy();
    var d = deps({ mailer: mailSpy({ fail: true }), createPortalSession: portal });
    var h = mod.createHandler(d);
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.deepEqual(res.body, { ok: true, message: GENERIC_MESSAGE });
    await Promise.all(d.captured.pending);
    assert.ok(d.captured.logs.some(function (m) { return /portal-link-email-failed/.test(m); }),
      'the operator can still see why: ' + JSON.stringify(d.captured.logs));
    assert.equal(portal.calls.length, 0);
  });

  await check('an active record with no Stripe customer reference: generic body publicly, named reason logged, nothing sent', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var map = { 'buyer@example.com': Object.assign({}, ACTIVE['buyer@example.com'], { customerId: null }) };
    var d = deps({ store: memStrict(map), createPortalSession: portal, mailer: mailer });
    var h = mod.createHandler(d);
    var res = fakeRes();
    await h(fakeReq('POST', { email: 'buyer@example.com', domain: 'finance' }), res);
    assert.deepEqual(res.body, { ok: true, message: GENERIC_MESSAGE });
    assert.ok(d.captured.logs.some(function (m) { return /no-customer-reference-on-record/.test(m); }),
      'the operator can still see why: ' + JSON.stringify(d.captured.logs));
    assert.equal(portal.calls.length, 0);
    assert.equal(mailer.calls.length, 0);
  });

  await check('the emailed token redeems: strict-store recheck, session minted for the token\'s customer, 302', async function () {
    var portal = portalSpy(), mailer = mailSpy();
    var d = deps({ createPortalSession: portal, mailer: mailer });
    var h = mod.createHandler(d);
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
    var forged = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    forged.customerId = 'cus_ATTACKER';
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

  await check('the declared waitUntil dependency resolves (deployed registration still needs a runtime check)', async function () {
    var pkg = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'package.json'), 'utf8'));
    assert.ok(pkg.dependencies && pkg.dependencies['@vercel/functions'],
      '@vercel/functions must be a declared dependency, not an assumed runtime global');
    var fn = require('@vercel/functions').waitUntil;
    assert.equal(typeof fn, 'function', 'the installed dependency must export waitUntil');
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
