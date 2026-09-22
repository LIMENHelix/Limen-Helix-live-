/**
 * customer-portal.js — self-serve cancellation. The front door to Stripe's Customer Portal.
 *
 *   POST /api/customer-portal  { email, domain }   → { ok, url }   (send the subscriber there)
 *
 * THE ONE RULE OF THIS ROUTE: a portal session is minted ONLY for an email that the strict
 * subscriber store (lib/subscriptions.js, subs:v1 via lib/autofire-efference-store — no
 * process-memory fallback) confirms is an ACTIVE subscriber, on the domain named. Anyone can
 * type any email into the form; only a verified subscriber gets a portal. Cancellation itself
 * happens Stripe-side; the resulting customer.subscription.deleted event lands on the existing
 * webhook's deactivateStrict path, which is what actually stops delivery.
 *
 * FAIL CLOSED, in both directions:
 *   unknown / inactive / wrong-domain email  → 404 with one generic line, identical in every
 *                                              case, so the route cannot be used to enumerate
 *                                              who subscribes to what
 *   store unreachable                        → 503 subscription-lookup-unavailable; an
 *                                              unreadable store is NOT "no such subscriber"
 *   Stripe portal not activated (dashboard)  → 503 with the named reason, so the failure
 *                                              reads as an operator task, not a bug
 *
 * No money moves here. A portal session is read-safe: minting one changes nothing.
 */
var subs = require('../lib/subscriptions');
var rail = require('../lib/stripe-rail');

var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';

/* One string for every refusal that must not distinguish "no account" from "not active"
   from "wrong domain". */
var GENERIC_REFUSAL = 'No active subscription was found for that email on that domain.';

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
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

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store;                       // test seam; production uses the strict store
  var portal = deps.createPortalSession || rail.createPortalSession.bind(rail);
  var site = deps.site || SITE;

  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, { ok: false, error: 'POST only' }, 405);

    var body = await readBody(req);
    var email = subs.norm(body.email);
    var domain = String(body.domain || '').trim().toLowerCase();
    if (!subs.validEmail(email) || !domain) {
      return send(res, { ok: false, error: 'A valid email and domain are required.' }, 400);
    }

    var sub;
    try {
      sub = await subs.getStrict(email, store || undefined);
    } catch (e) {
      /* The strict store THROWS rather than guesses. An unreachable store must never be
         read as "no such subscriber" (that would refuse real subscribers) nor waved through
         to session creation (that would mint a portal for an unverified email). */
      return send(res, { ok: false, error: 'subscription-lookup-unavailable' }, 503);
    }

    if (!sub || sub.active !== true || (sub.domain && sub.domain !== domain)) {
      return send(res, { ok: false, error: GENERIC_REFUSAL }, 404);
    }
    if (!sub.customerId) {
      return send(res, { ok: false, error: 'customer-portal-unavailable: no-customer-reference-on-record' }, 503);
    }

    var session = await portal({
      customerId: sub.customerId,
      returnUrl: site + '/' + domain
    });
    if (!session.ok) {
      if (session.portalNotConfigured) {
        return send(res, {
          ok: false,
          error: 'stripe-customer-portal-not-configured: the Customer Portal must be activated in the Stripe dashboard before self-serve cancellation works'
        }, 503);
      }
      return send(res, { ok: false, error: 'Could not open the customer portal: ' + (session.error || 'stripe error') }, 502);
    }
    return send(res, { ok: true, url: session.url });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
