/**
 * customer-portal.js — self-serve cancellation. The front door to Stripe's Customer Portal.
 *
 *   POST /api/customer-portal  { email, domain }   → 200 { ok, message }  (we EMAIL the link)
 *   GET  /api/customer-portal?token=…              → 302 to a fresh Stripe portal session
 *
 * THE ONE RULE OF THIS ROUTE: a portal session reaches ONLY the inbox of the email that the
 * strict subscriber store (lib/subscriptions.js, subs:v1 via lib/autofire-efference-store —
 * no process-memory fallback) confirms is an ACTIVE subscriber on the domain named. Knowing
 * an email+domain pair is not ownership — breach dumps carry both — so the session URL is
 * never returned to the requester (FIX-0068, customer-portal portion of FIX-0115). Instead
 * the subscriber is emailed a signed, expiring link (lib/customer-portal-link.js), and the
 * Stripe session is minted only when that link is clicked, after a fresh strict-store check
 * that the token's email still maps to the token's Stripe customer. Cancellation itself
 * happens Stripe-side; the resulting customer.subscription.deleted event lands on the
 * existing webhook's deactivateStrict path, which is what actually stops delivery.
 *
 * FAIL CLOSED, in both directions:
 *   unknown / inactive / wrong-domain email  → the SAME 200 body as a real subscriber, so
 *                                              the route cannot be used to enumerate who
 *                                              subscribes to what — by body, status OR
 *                                              timing. Subscriber-specific failures
 *                                              (transport down, send failed, no customer
 *                                              reference) are logged to function logs
 *                                              (operator-only) and still answer 200.
 *   store unreachable                        → 503 subscription-lookup-unavailable; an
 *                                              unreadable store is NOT "no such subscriber"
 *   link secret missing                      → 503 with the named reason, before any lookup
 *   Stripe portal not activated (dashboard)  → 503 with the named reason, at redeem time
 *
 * TIMING. The response never waits on the email transport: delivery is handed to the
 * serverless waitUntil keep-alive when the runtime offers one (the invocation stays alive
 * until the send settles — reliable), and is awaited inline where it does not (local dev —
 * slower, never lost). Awaiting the transport in the response path would leak subscriber
 * status through latency: only a matching subscriber has an email to send.
 *
 * No money moves here. A portal session is read-safe: minting one changes nothing.
 */
var subs = require('../lib/subscriptions');
var rail = require('../lib/stripe-rail');
var link = require('../lib/customer-portal-link');
var crm = require('../lib/crm-send');

var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';
var LINK_TTL_MS = 30 * 60 * 1000;

/* One string for every well-formed POST, whether or not the email subscribes to anything.
   The response must be indistinguishable, or the status/body split is itself an oracle. */
var GENERIC_MESSAGE = 'If an active subscription exists for that email on that domain, a sign-in link is on its way to that inbox. It expires in 30 minutes.';

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

/* Redeem is a browser click, so its answers are pages, not JSON. */
function page(res, title, detail, code) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">' +
    '<title>' + title + ' · LIMEN Helix</title></head>' +
    '<body style="font:16px/1.6 sans-serif;max-width:560px;margin:80px auto;padding:0 20px;color:#cdd6e4;background:#0a0e15">' +
    '<h1 style="color:#e8eef7">' + title + '</h1><p>' + detail + '</p>' +
    '<p><a style="color:#7eb3e8" href="/cancel">Request a new sign-in link</a></p></body></html>');
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 20000) data = data.slice(0, 20000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

/* Transactional billing email on the existing Resend transport. sendToLead is NOT used: its
   marketing suppression list must never stand between a subscriber and the only cancellation
   path we promise, and a portal link is not marketing. */
async function defaultMailer(to, subject, body) {
  var cfg = crm.emailConfig();
  if (!cfg.ready) return { ok: false, notReady: true, reason: cfg.reason || 'email transport not configured' };
  return crm.sendEmailResend(cfg, to, subject, body, { transactional: true });
}

function linkEmail(domain, redeemUrl) {
  return {
    subject: 'Your LIMEN Helix customer portal link',
    body: 'You asked to manage your LIMEN Helix ' + domain + ' subscription.\n\n' +
      'Open your customer portal to update payment details or cancel:\n' + redeemUrl + '\n\n' +
      'This link expires in 30 minutes. Cancellation takes effect at the end of the current paid period — nothing further is charged.\n\n' +
      'If you did not ask for this, ignore this email: no one can open your portal without access to this inbox.'
  };
}

/* The serverless keep-alive, when the runtime offers one: the invocation stays alive until
   the delivery promise settles even though the response has already gone out. Absent the
   hook (local dev, non-Vercel), callers await the send inline — slower, never lost. */
function runtimeWaitUntil() {
  try { return require('@vercel/functions').waitUntil || null; } catch (e) { return null; }
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store;                       // test seam; production uses the strict store
  var portal = deps.createPortalSession || rail.createPortalSession.bind(rail);
  var mailer = deps.mailer || defaultMailer;
  var env = deps.env || process.env;
  var now = deps.now || function () { return Date.now(); };
  var site = deps.site || SITE;
  var waitUntil = Object.prototype.hasOwnProperty.call(deps, 'waitUntil') ? deps.waitUntil : runtimeWaitUntil();
  var logger = Object.prototype.hasOwnProperty.call(deps, 'logger') ? deps.logger : console;

  function secret() { return String(env.CUSTOMER_PORTAL_LINK_SECRET || '').trim() || null; }

  /* Subscriber-specific causes go ONLY here. Function logs are operator-only; the public
     response must carry nothing that distinguishes a subscriber from a stranger. */
  function diagnose(msg) {
    try { (logger.error || logger.log).call(logger, '[customer-portal] ' + msg); } catch (e) { /* diagnostics must never break the route */ }
  }

  async function requestLink(req, res) {
    var body = await readBody(req);
    var email = subs.norm(body.email);
    var domain = String(body.domain || '').trim().toLowerCase();
    if (!subs.validEmail(email) || !domain) {
      return send(res, { ok: false, error: 'A valid email and domain are required.' }, 400);
    }

    if (!secret()) {
      return send(res, { ok: false, error: 'customer-portal-link-not-configured: CUSTOMER_PORTAL_LINK_SECRET must be set before sign-in links can be issued' }, 503);
    }

    var sub;
    try {
      sub = await subs.getStrict(email, store || undefined);
    } catch (e) {
      /* The strict store THROWS rather than guesses. An unreachable store must never be
         read as "no such subscriber" (that would refuse real subscribers) nor waved through
         to link issuance (that would mail a portal link for an unverified email). */
      return send(res, { ok: false, error: 'subscription-lookup-unavailable' }, 503);
    }

    if (!sub || sub.active !== true || (sub.domain && sub.domain !== domain)) {
      return send(res, { ok: true, message: GENERIC_MESSAGE });
    }
    if (!sub.customerId) {
      /* Subscriber-specific cause: operator diagnostics only, never the public response. */
      diagnose('customer-portal-unavailable: no-customer-reference-on-record');
      return send(res, { ok: true, message: GENERIC_MESSAGE });
    }

    var token = link.sign({ email: email, domain: domain, customerId: sub.customerId }, secret(), now(), LINK_TTL_MS);
    var redeemUrl = site + '/api/customer-portal?token=' + encodeURIComponent(token);
    var message = linkEmail(domain, redeemUrl);

    /* Only a matching subscriber reaches this point, so the send is the one branch that
       could differ in latency. Run it off the response path and report every
       subscriber-specific cause through protected diagnostics. */
    var delivery = (async function () {
      try {
        var sent = await mailer(sub.email || email, message.subject, message.body);
        if (sent && sent.notReady) {
          diagnose('customer-portal-email-unavailable: ' + (sent.reason || 'email transport not configured'));
        } else if (!sent || !sent.ok) {
          diagnose('portal-link-email-failed: ' + ((sent && (sent.error || sent.reason)) || 'email transport failed'));
        }
      } catch (e) {
        diagnose('portal-link-email-failed: ' + (e && e.message ? e.message : 'email transport threw'));
      }
    })();

    /* Hand delivery to the runtime keep-alive so the public response never waits on the
       transport. If the runtime cannot register the task, await inline as the safe
       fallback: slower, but the email is never lost. */
    if (waitUntil) {
      try {
        waitUntil(delivery);
      } catch (e) {
        diagnose('customer-portal-waitUntil-unavailable: ' + (e && e.message ? e.message : 'registration failed'));
        await delivery;
      }
    } else {
      await delivery;
    }

    return send(res, { ok: true, message: GENERIC_MESSAGE });
  }

  async function redeem(req, res) {
    /* Vercel populates req.query; the local catch-all passes req through untouched, so
       fall back to parsing the URL — the redeem must not depend on who parsed the query. */
    var q = req.query || {};
    if (!q.token && req.url) {
      try {
        var params = new URL(String(req.url), 'http://local').searchParams;
        if (params.get('token')) q = { token: params.get('token') };
      } catch (e) { /* malformed URL falls through to the 400 below */ }
    }
    var token = q.token ? String(q.token) : '';
    if (!token) return page(res, 'That sign-in link is not valid', 'No token was supplied.', 400);

    if (!secret()) {
      return page(res, 'Customer portal unavailable', 'customer-portal-link-not-configured: CUSTOMER_PORTAL_LINK_SECRET must be set before sign-in links can be redeemed.', 503);
    }

    var v = link.verify(token, secret(), now());
    if (!v.ok && v.reason === 'expired') {
      return page(res, 'That sign-in link has expired', 'Portal links live for 30 minutes. Request a fresh one below.', 410);
    }
    if (!v.ok) {
      return page(res, 'That sign-in link is not valid', 'The link is malformed or was altered. Request a fresh one below.', 400);
    }

    var sub;
    try {
      sub = await subs.getStrict(v.email, store || undefined);
    } catch (e) {
      return page(res, 'Customer portal unavailable', 'subscription-lookup-unavailable: the subscriber store could not be read. Try again shortly.', 503);
    }
    /* The token's claims alone never mint a session: the strict store must STILL bind this
       email to this exact Stripe customer. A record that moved to a new customer (or is
       gone) invalidates every outstanding link. */
    if (!sub || sub.customerId !== v.customerId) {
      return page(res, 'That sign-in link is not valid', 'The subscription this link was issued for has changed. Request a fresh one below.', 400);
    }

    var session = await portal({
      customerId: v.customerId,
      returnUrl: site + '/' + v.domain
    });
    if (!session.ok) {
      if (session.portalNotConfigured) {
        return page(res, 'Customer portal unavailable', 'stripe-customer-portal-not-configured: the Customer Portal must be activated in the Stripe dashboard before self-serve cancellation works.', 503);
      }
      return page(res, 'Customer portal unavailable', 'Could not open the customer portal: ' + (session.error || 'stripe error'), 502);
    }
    res.statusCode = 302;
    res.setHeader('Location', session.url);
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  return async function handler(req, res) {
    if (req.method === 'POST') return requestLink(req, res);
    if (req.method === 'GET') return redeem(req, res);
    return send(res, { ok: false, error: 'POST or GET only' }, 405);
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
