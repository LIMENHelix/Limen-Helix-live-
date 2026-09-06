/**
 * api/checkout.js — turn a domain rung into a real Stripe subscription checkout.
 *
 *   POST /api/checkout  { domain, rung, email? }   → { ok, url }   (redirect the buyer there)
 *   GET  /api/checkout                             → { ok, enabled, rungs }  (is buying live?)
 *   GET  /api/checkout?start=1&domain=&rung=       → 303 to Stripe Checkout (Watch-page CTA)
 *
 * THE PRICE IS NEVER TAKEN FROM THE REQUEST. The body names a domain and a rung; the amount
 * is looked up in lib/offer-catalog.js on the server. A tampered client can therefore ask for
 * a rung that exists or be rejected, and has no way to ask for a cheaper one.
 *
 * THE BUYER IS CAPTURED BEFORE THEY PAY. An intent is recorded the moment checkout starts,
 * with the campaign that brought them, so an abandoned checkout is still a lead we can see and
 * follow up rather than a silent loss. Access is a separate matter and is granted only by the
 * Stripe webhook.
 *
 * Until STRIPE_SECRET_KEY is set this answers a clean "payments are not enabled yet" instead
 * of failing obscurely, so the page can say something true to a visitor who clicks Buy.
 */
var catalog = require('../lib/offer-catalog');
var stripe = require('../lib/stripe-rail');
var db = require('../lib/limen-db');
var leadPipeline = require('../lib/lead-pipeline-bridge');

var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';
var INTENT_KEY = 'subs:intents:v1';
var MAX_INTENTS = 300;

// What we ask for at checkout so the alert can be about THEIR situation. Only asked where the
// product is genuinely per-subject; a domain absent from here sells an unpersonalised digest
// and should not pretend otherwise by asking a question it will ignore.
var WATCH_PROMPT = {
  agriculture:  'Which state do you farm or buy in?',
  environment:  'Which ZIP code should we watch?',
  medicine:     'Which drug should we watch for you?',
  education:    'Which schools are on your shortlist?',
  population:   'Which states are you comparing?',
  religion:     'Which organisations do you give to?',
  finance:      'Which bank or banks hold your money?',
  technology:   'Which vendors or products do you run?',
  defense:      'Which agency, programme or competitor?',
  governance:   'Which state or district?',
  intelligence: 'Which counterparty names should we screen?',
  trade:        'Which trading partner or product?',
  law:          'Which agency or topic?',
  economy:      'Which state do you file in?',
  industry:     'Which products or plants should we watch?',
  energy:       'Which utility or state?',
  infrastructure: 'Which airport, corridor or facility?',
  communication:  'Which proceeding, licence or band?',
  culture:        'Which platforms or genres should we watch?'
};

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

function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }

function queryOf(req) {
  if (req.query && typeof req.query === 'object' && !Array.isArray(req.query)) return req.query;
  try {
    var u = new URL(req.url, 'http://localhost');
    var out = {};
    u.searchParams.forEach(function (v, k) { out[k] = v; });
    return out;
  } catch (e) { return {}; }
}

function preferRung(domain, requested) {
  var rung = String(requested || '').toLowerCase().trim();
  if (rung && catalog.lookup(domain, rung)) return rung;
  var pref = ['p2', 'p1', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
  for (var i = 0; i < pref.length; i++) {
    if (catalog.lookup(domain, pref[i])) return pref[i];
  }
  return null;
}

// Record that someone started checkout. Best effort: a storage failure must never block a
// purchase, because losing the sale is worse than losing the analytics row.
async function recordIntent(rec) {
  try {
    var list = await db.get(INTENT_KEY);
    if (!Array.isArray(list)) list = [];
    list.unshift(rec);
    await db.set(INTENT_KEY, list.slice(0, MAX_INTENTS));
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  try {
    if ((req.method || 'GET') === 'GET') {
      var q = queryOf(req);
      // A Watch-page CTA can be a real link: /api/checkout?start=1&domain=religion&rung=p2
      // Without start=1 this stays the catalog probe (enabled/mode/rungs).
      if (String(q.start || '') === '1') {
        req._checkoutFromQuery = q;
      } else {
        var rungs = [];
        catalog.domains().forEach(function (d) {
          ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'].forEach(function (r) {
            var o = catalog.lookup(d, r);
            if (o) rungs.push({ domain: d, rung: r, name: o.name, priceCents: o.priceCents, cadence: o.cadence });
          });
        });
        return send(res, {
          ok: true,
          enabled: stripe.hasKey(),
          // test vs live, derived from the key PREFIX. Never returns the key itself. This is
          // the only safe way to answer "can this take real money right now?" since Vercel
          // will not read a sensitive value back.
          mode: stripe.keyMode(),
          keys: stripe.keyModes(),
          reason: stripe.hasKey() ? null : 'Payments are not enabled yet: STRIPE_SECRET_KEY is not set on this deployment.',
          count: rungs.length,
          rungs: rungs
        });
      }
    } else if (req.method !== 'POST') {
      return send(res, { ok: false, error: 'POST or GET only' }, 405);
    }

    var body = req._checkoutFromQuery || await readBody(req);
    var domain = String(body.domain || '').toLowerCase().trim();
    var rung = preferRung(domain, body.rung);

    var offer = rung ? catalog.lookup(domain, rung) : null;
    if (!offer) return send(res, { ok: false, error: 'That is not a plan we sell.' }, 400);

    if (!stripe.hasKey()) {
      // Still capture the intent: someone tried to buy, and that is worth knowing even, or
      // especially, when we could not take the money.
      await recordIntent({
        at: new Date().toISOString(), domain: domain, rung: rung,
        email: validEmail(body.email) ? String(body.email).trim().toLowerCase() : null,
        priceCents: offer.priceCents, blocked: 'payments-not-enabled',
        utm: body.utm || null
      });
      return send(res, {
        ok: false, enabled: false,
        error: 'Payments are not switched on yet. Leave your email on this page and you will be first on when they are.'
      }, 503);
    }

    var email = validEmail(body.email) ? String(body.email).trim().toLowerCase() : null;
    var back = SITE + '/' + domain;

    var session = await stripe.createSubscriptionCheckout({
      domain: domain, rung: rung,
      name: offer.name, line: offer.line,
      priceCents: offer.priceCents,
      email: email,
      watchLabel: WATCH_PROMPT[domain] || null,
      successUrl: back + '?bought=' + encodeURIComponent(rung) + '&session={CHECKOUT_SESSION_ID}',
      cancelUrl: back + '?checkout=cancelled'
    });

    if (!session.ok) {
      return send(res, { ok: false, error: 'Stripe could not start the checkout.', detail: session.error }, 502);
    }

    await recordIntent({
      at: new Date().toISOString(), domain: domain, rung: rung, email: email,
      priceCents: offer.priceCents, sessionId: session.sessionId,
      utm: body.utm || null, referrer: (body.referrer || '').slice(0, 300) || null
    });

    if (email && body.consent === true) {
      try {
        await leadPipeline.capture({ eventId: 'checkout-session:' + session.sessionId, name: body.name,
          email: email, domain: domain, rung: rung, source: 'stripe-checkout-start', consent: body.consent === true,
          note: offer.name, recordAcquisition: true });
      } catch (e) {}
    }

    if (req._checkoutFromQuery) {
      res.statusCode = 303;
      res.setHeader('Location', session.url);
      res.setHeader('Cache-Control', 'no-store');
      return res.end();
    }

    return send(res, { ok: true, url: session.url, priceCents: offer.priceCents, name: offer.name });
  } catch (e) {
    return send(res, { ok: false, error: e.message || 'checkout error' }, 500);
  }
};
