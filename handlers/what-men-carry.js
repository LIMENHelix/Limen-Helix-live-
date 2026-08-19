/**
 * api/what-men-carry — "What Men Carry" video library: 15s cinematic videos about men's invisible burdens.
 *
 *   GET  /api/what-men-carry?action=list          → { ok, videos: [{id, title, duration, topic, tagline}] }
 *   GET  /api/what-men-carry?action=search&q=...  → { ok, videos: [...] }
 *   GET  /api/what-men-carry?action=topics        → { ok, topics: [...] }
 *   POST /api/what-men-carry?action=checkout       → { ok, url } (Stripe checkout)
 *   POST /api/what-men-carry?action=verify         → { ok, subscribed, email } (check subscription)
 *
 * Descriptions are NOT exposed via API. Only taglines are copyable.
 */

const manifest = require('../what-men-carry-manifest');
const stripe = require('../lib/stripe-rail');
const db = require('../lib/limen-db');

const SITE = process.env.PUBLIC_SITE_URL || 'https://limenhelix.com';
const SUBSCRIPTION_KEY = 'what-men-carry:subscriptions:v1';
const INTENT_KEY = 'what-men-carry:intents:v1';
const MAX_INTENTS = 500;
const PRICE_CENTS = 499; // $4.99/month (adjustable)

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
    req.on('data', function (c) { data += c; if (data.length > 50000) data = data.slice(0, 50000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || ''); }

async function recordIntent(rec) {
  try {
    var list = await db.get(INTENT_KEY);
    if (!Array.isArray(list)) list = [];
    list.unshift(rec);
    await db.set(INTENT_KEY, list.slice(0, MAX_INTENTS));
  } catch (e) {}
}

async function recordSubscription(email, stripeSessionId) {
  try {
    var subs = await db.get(SUBSCRIPTION_KEY);
    if (!Array.isArray(subs)) subs = [];
    subs.unshift({
      email: email,
      stripeSessionId: stripeSessionId,
      subscribedAt: new Date().toISOString(),
      active: true
    });
    await db.set(SUBSCRIPTION_KEY, subs);
  } catch (e) {}
}

async function isSubscribed(email) {
  try {
    var subs = await db.get(SUBSCRIPTION_KEY);
    if (!Array.isArray(subs)) return false;
    return subs.some(s => s.email === email && s.active);
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  try {
    const action = req.query?.action || 'list';

    if (action === 'list') {
      const videos = manifest.map(v => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        topic: v.topic,
        tagline: v.tagline
      }));
      return send(res, { ok: true, videos: videos, count: videos.length });
    }

    if (action === 'search') {
      const q = String(req.query?.q || '').toLowerCase().trim();
      if (!q) return send(res, { ok: true, videos: [] });
      const videos = manifest.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.topic.toLowerCase().includes(q) ||
        v.tagline.toLowerCase().includes(q)
      ).map(v => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        topic: v.topic,
        tagline: v.tagline
      }));
      return send(res, { ok: true, videos: videos, count: videos.length });
    }

    if (action === 'topics') {
      const topics = [...new Set(manifest.map(v => v.topic))].sort();
      return send(res, { ok: true, topics: topics });
    }

    if (action === 'checkout') {
      const body = await readBody(req);
      const email = String(body.email || '').toLowerCase().trim();

      if (!validEmail(email)) {
        return send(res, { ok: false, error: 'Valid email required' }, 400);
      }

      if (!stripe.hasKey()) {
        await recordIntent({
          at: new Date().toISOString(),
          email: email,
          action: 'checkout',
          blocked: 'payments-not-enabled'
        });
        return send(res, {
          ok: false, enabled: false,
          error: 'Payments are not enabled yet.'
        }, 503);
      }

      const session = await stripe.createSubscriptionCheckout({
        domain: 'what-men-carry',
        rung: 'p1',
        name: 'What Men Carry Monthly',
        line: 'Access to powerful cinematic 15-second videos and copyable taglines about men\'s invisible burdens.',
        priceCents: PRICE_CENTS,
        email: email,
        successUrl: SITE + '/what-men-carry?subscribed=true&session={CHECKOUT_SESSION_ID}',
        cancelUrl: SITE + '/what-men-carry?checkout=cancelled'
      });

      if (!session.ok) {
        return send(res, {
          ok: false,
          error: 'Could not start checkout: ' + (session.error || 'unknown error')
        }, 502);
      }

      await recordIntent({
        at: new Date().toISOString(),
        email: email,
        action: 'checkout',
        sessionId: session.sessionId
      });

      return send(res, { ok: true, url: session.url });
    }

    if (action === 'verify') {
      const body = await readBody(req);
      const email = String(body.email || '').toLowerCase().trim();

      if (!validEmail(email)) {
        return send(res, { ok: false, error: 'Valid email required' }, 400);
      }

      const subscribed = await isSubscribed(email);
      return send(res, { ok: true, subscribed: subscribed, email: email });
    }

    return send(res, { ok: false, error: 'Unknown action: ' + action }, 400);
  } catch (e) {
    return send(res, { ok: false, error: e.message || 'what-men-carry error' }, 500);
  }
};
