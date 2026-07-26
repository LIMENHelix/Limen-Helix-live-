/**
 * api/stripe-webhook.js — the ONLY thing that grants or revokes paid access.
 *
 *   POST /api/stripe-webhook   (called by Stripe, verified by HMAC signature)
 *
 * Nothing in our own UI can activate a subscriber. Access is a fact about whether Stripe has
 * been paid, so it is set from Stripe's events and nowhere else. The moment a page can grant
 * access, a bug in that page becomes free product.
 *
 * Events handled:
 *   checkout.session.completed        → activate, capture the buyer, send what they bought
 *   customer.subscription.deleted     → stop delivery
 *   invoice.payment_failed            → stop delivery (they stopped paying)
 *   customer.subscription.updated     → follow Stripe's status; past_due/unpaid stops delivery
 *
 * RAW BODY IS REQUIRED. The signature is computed over the exact bytes Stripe sent, so this
 * reads the stream itself and never lets anything parse it first. api/[...route].js passes
 * native Node req/res with no Fetch shim precisely so this works.
 *
 * IDEMPOTENT. Stripe retries until it gets a 2xx, so the same event arrives more than once.
 * Processed event ids are remembered and replays are acknowledged without acting twice.
 *
 * Set STRIPE_WEBHOOK_SECRET from the endpoint's signing secret in the Stripe dashboard.
 */
var stripe = require('../lib/stripe-rail');
var subs = require('../lib/subscriptions');
var db = require('../lib/limen-db');
var catalog = require('../lib/offer-catalog');
var crm = require('../lib/crm-send');

var SEEN_KEY = 'stripe:events:seen:v1';
var SEEN_CAP = 400;
var SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// Read the EXACT bytes. Buffer concat, not string concatenation, so a multi-byte character
// split across two chunks cannot corrupt the payload the HMAC is computed over.
function readRaw(req) {
  return new Promise(function (resolve) {
    if (typeof req.body === 'string') return resolve(req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
    var chunks = [];
    var size = 0;
    req.on('data', function (c) {
      var b = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += b.length;
      if (size <= 1048576) chunks.push(b);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', function () { resolve(''); });
  });
}

async function alreadyHandled(id) {
  if (!id) return false;
  try {
    var seen = await db.get(SEEN_KEY);
    return Array.isArray(seen) && seen.indexOf(id) !== -1;
  } catch (e) { return false; }
}
async function markHandled(id) {
  if (!id) return;
  try {
    var seen = await db.get(SEEN_KEY);
    if (!Array.isArray(seen)) seen = [];
    seen.unshift(id);
    await db.set(SEEN_KEY, seen.slice(0, SEEN_CAP));
  } catch (e) {}
}

/** Book the sale into the 5-stage funnel as an enrollment, matching handlers/sales.js keys. */
async function recordEnrollment(domain, cents) {
  try {
    var agg = await db.get('sales:agg');
    if (!agg || typeof agg !== 'object') agg = {};
    var t = agg['shows>enrollments'] || (agg['shows>enrollments'] = {});
    var u = t['subscriptions'] || (t['subscriptions'] = { attempts: 0, wins: 0, costCents: 0 });
    u.attempts += 1;
    u.wins += 1;
    u.revenueCents = (u.revenueCents || 0) + (cents || 0);
    await db.set('sales:agg', agg);

    if (domain) {
      var bd = await db.get('sales:leads:by-domain');
      if (!bd || typeof bd !== 'object') bd = {};
      var d = bd[domain] || (bd[domain] = { leads: 0, byChannel: {} });
      d.enrollments = (d.enrollments || 0) + 1;
      d.revenueCents = (d.revenueCents || 0) + (cents || 0);
      await db.set('sales:leads:by-domain', bd);
    }
  } catch (e) {}
}

/** Stripe returns the answers to custom_fields as an array; pull the one we asked for. */
function customField(obj, key) {
  var f = obj && obj.custom_fields;
  if (!Array.isArray(f)) return null;
  for (var i = 0; i < f.length; i++) {
    if (f[i] && f[i].key === key) {
      return (f[i].text && f[i].text.value) || (f[i].dropdown && f[i].dropdown.value) || null;
    }
  }
  return null;
}

function welcomeEmail(sub, offer) {
  var watchLine = sub.watch ? ('We are watching: ' + sub.watch + '\n\n') : '';
  return {
    subject: 'You are on: ' + (offer ? offer.name : 'your LIMEN watch'),
    body:
      'Thanks for subscribing.\n\n' +
      (offer ? (offer.name + '\n' + offer.line + '\n\n') : '') +
      watchLine +
      (offer && offer.cadence ? ('How often it moves: ' + offer.cadence + '\n\n') : '') +
      'Your first briefing arrives on the next run. Every figure in it comes from the federal ' +
      'source named beside it, and you can check any of them yourself at ' + SITE + '/' + sub.domain + '\n\n' +
      'If a source has nothing new, we send nothing rather than padding it out.\n\n' +
      'To cancel, reply to this email and we will stop the subscription.\n'
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, { ok: false, error: 'POST only' }, 405);

  var raw = await readRaw(req);
  var sig = req.headers && (req.headers['stripe-signature'] || req.headers['Stripe-Signature']);

  var ver = stripe.verifySignature(raw, sig);
  if (!ver.ok) {
    // 400 tells Stripe not to retry a request that can never verify.
    return send(res, { ok: false, error: 'signature: ' + ver.error }, 400);
  }

  var evt;
  try { evt = JSON.parse(raw); } catch (e) { return send(res, { ok: false, error: 'invalid json' }, 400); }

  if (await alreadyHandled(evt.id)) {
    return send(res, { ok: true, duplicate: true, id: evt.id });
  }

  var obj = (evt.data && evt.data.object) || {};
  var meta = obj.metadata || {};
  var out = { ok: true, id: evt.id, type: evt.type, handled: false };

  try {
    if (evt.type === 'checkout.session.completed') {
      // Only our own subscription checkouts. Other products on this Stripe account (the Relay
      // storefront books through the same rail) must not create LIMEN subscribers.
      if (meta.limen === '1' && obj.mode === 'subscription') {
        var email = (obj.customer_details && obj.customer_details.email) || obj.customer_email || null;
        var offer = catalog.lookup(meta.domain, meta.rung);
        var act = await subs.activate({
          email: email,
          domain: meta.domain, rung: meta.rung, offer: meta.offer,
          watch: customField(obj, 'watch'),
          priceCents: obj.amount_total != null ? obj.amount_total : (offer ? offer.priceCents : null),
          subscriptionId: obj.subscription || null,
          customerId: obj.customer || null
        });
        out.handled = true;
        out.activated = act.ok;
        if (!act.ok) out.activateError = act.reason;

        if (act.ok) {
          await recordEnrollment(meta.domain, obj.amount_total || 0);
          // Deliver immediately: they paid, so they should hear from us now, not on the cron.
          try {
            var mail = welcomeEmail(act.subscriber, offer);
            await crm.sendToLead(act.subscriber.email, mail.subject, mail.body);
            out.welcomeSent = true;
          } catch (e) { out.welcomeSent = false; out.welcomeError = e.message; }
        }
      }
      // Book the income to the finance ledger regardless of which product it was.
      try { await stripe.recordWebhook(raw, sig); } catch (e) {}
    }

    else if (evt.type === 'customer.subscription.deleted') {
      var d = await subs.deactivate({ subscriptionId: obj.id, customerId: obj.customer }, 'cancelled');
      out.handled = true; out.deactivated = d.changed || 0;
    }

    else if (evt.type === 'invoice.payment_failed') {
      var f = await subs.deactivate({ subscriptionId: obj.subscription, customerId: obj.customer }, 'payment-failed');
      out.handled = true; out.deactivated = f.changed || 0;
    }

    else if (evt.type === 'customer.subscription.updated') {
      // Follow Stripe's status rather than guessing: anything not active/trialing stops delivery.
      var st = String(obj.status || '');
      if (st && ['active', 'trialing'].indexOf(st) === -1) {
        var u = await subs.deactivate({ subscriptionId: obj.id, customerId: obj.customer }, 'status:' + st);
        out.handled = true; out.deactivated = u.changed || 0;
      }
      out.status = st;
    }

    else if (evt.type === 'payment_intent.succeeded') {
      try { await stripe.recordWebhook(raw, sig); } catch (e) {}
      out.handled = true;
    }

    await markHandled(evt.id);
    return send(res, out);
  } catch (e) {
    // 500 makes Stripe retry, which is what we want for a transient storage failure.
    return send(res, { ok: false, id: evt.id, error: e.message || 'handler error' }, 500);
  }
};
