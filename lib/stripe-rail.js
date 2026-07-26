/**
 * stripe-rail.js — the payment rail. ACCEPTS income; never sends money on its own.
 *
 *   createPaymentLink()  → product+price+payment_link via Stripe API. ACCEPTING money.
 *                          Requires STRIPE_SECRET_KEY in the project env.
 *   recordWebhook()      → verifies Stripe signature, records income into the ledger.
 *   proposeFee()         → records a 'fee-proposed' event and HALTS (single-signature).
 *   proposeLending()     → records a 'lend-proposed' event and HALTS (single-signature).
 *
 * Outflows (fees, lending, transfers) are NEVER executed here — they return
 * blocked-on-human and wait for a signature per FINANCE_PORTAL_SIGNOFF.md.
 */
const crypto = require('node:crypto');
const ledger = require('./finance-ledger');

const API = 'https://api.stripe.com/v1';

function _key() { return process.env.STRIPE_SECRET_KEY || null; }

function _form(obj, prefix) {
  // Stripe wants application/x-www-form-urlencoded with bracketed nesting
  const parts = [];
  for (const k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    const v = obj[k];
    if (v && typeof v === 'object') parts.push(_form(v, key));
    else parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
  }
  return parts.join('&');
}

async function _post(path, body) {
  const key = _key();
  if (!key) return { ok: false, error: 'STRIPE_SECRET_KEY not set in this project env' };
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: _form(body)
  });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: 'stripe ' + r.status + ': ' + (j.error && j.error.message || JSON.stringify(j)).slice(0, 300) };
  return { ok: true, data: j };
}

// ── ACCEPT INCOME: create a reusable payment link for a stream/product ──
async function createPaymentLink(opts) {
  opts = opts || {};
  const name = opts.name || 'LIMEN Helix product';
  const amountCents = Math.round((opts.amount || 0) * 100);
  if (!amountCents || amountCents < 50) return { ok: false, error: 'amount must be >= $0.50' };

  const prod = await _post('/products', { name: name, metadata: { streamId: opts.streamId || '', domain: 'finance' } });
  if (!prod.ok) return prod;
  const price = await _post('/prices', { product: prod.data.id, unit_amount: amountCents, currency: opts.currency || 'usd' });
  if (!price.ok) return price;
  const link = await _post('/payment_links', {
    line_items: [{ price: price.data.id, quantity: 1 }],
    metadata: { streamId: opts.streamId || '', domain: 'finance' }
  });
  if (!link.ok) return link;
  return { ok: true, url: link.data.url, paymentLinkId: link.data.id, priceId: price.data.id, productId: prod.data.id };
}

// ── ACCEPT RECURRING INCOME: a Checkout Session for one domain rung ──
/**
 * Monthly subscription checkout, priced INLINE from the server catalogue.
 *
 * Inline price_data means no Product or Price objects have to be created in the Stripe
 * dashboard first, so a price change is a code change and nothing has to be reconciled by
 * hand. The caller passes cents it looked up server-side; this never sees a client price.
 *
 * `watchLabel` becomes a required question on Stripe's own checkout page ("which state?",
 * "which drug?"). Collecting it there rather than on our form means the one thing the product
 * needs to personalise the alert arrives already attached to the payment, and we never hold a
 * half-finished signup for someone who did not pay.
 */
async function createSubscriptionCheckout(opts) {
  opts = opts || {};
  const cents = Math.round(opts.priceCents || 0);
  if (!cents || cents < 50) return { ok: false, error: 'priceCents must be >= 50' };
  if (!opts.successUrl || !opts.cancelUrl) return { ok: false, error: 'successUrl and cancelUrl are required' };

  const meta = {
    limen: '1',
    domain: opts.domain || '',
    rung: opts.rung || '',
    offer: opts.name || ''
  };

  const body = {
    mode: 'subscription',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: 'true',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents,
        recurring: { interval: 'month' },
        product_data: {
          name: (opts.name || 'LIMEN watch') + ' — ' + (opts.domain || ''),
          description: (opts.line || '').slice(0, 300)
        }
      }
    }],
    metadata: meta,
    // Put it on the subscription too: the webhook for a cancellation or a failed renewal only
    // sees the subscription, not the original checkout session.
    subscription_data: { metadata: meta }
  };

  if (opts.email) body.customer_email = opts.email;

  if (opts.watchLabel) {
    body.custom_fields = [{
      key: 'watch',
      label: { type: 'custom', custom: String(opts.watchLabel).slice(0, 50) },
      type: 'text',
      optional: 'false'
    }];
  }

  const s = await _post('/checkout/sessions', body);
  if (!s.ok) return s;
  return { ok: true, url: s.data.url, sessionId: s.data.id };
}

// ── RECORD INCOME from a verified Stripe webhook ──────────────────
const SIG_TOLERANCE_SEC = 300;   // Stripe's own recommendation

function verifySignature(rawBody, sigHeader, nowMs) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: 'STRIPE_WEBHOOK_SECRET not set' };
  if (!sigHeader) return { ok: false, error: 'missing stripe-signature header' };

  // A header can carry SEVERAL v1 signatures during a secret rotation; any one matching is
  // valid. Collect them rather than keeping only the last, or rotation breaks every webhook.
  let t = null;
  const v1s = [];
  String(sigHeader).split(',').forEach(function (p) {
    const i = p.indexOf('=');
    if (i < 0) return;
    const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1s.push(v);
  });
  if (!t || !v1s.length) return { ok: false, error: 'malformed signature' };

  // Reject replays of an old but genuinely-signed payload.
  const ts = parseInt(t, 10);
  if (!isFinite(ts)) return { ok: false, error: 'malformed timestamp' };
  const ageSec = Math.abs(Math.floor((nowMs || Date.now()) / 1000) - ts);
  if (ageSec > SIG_TOLERANCE_SEC) {
    return { ok: false, error: 'timestamp outside tolerance (' + ageSec + 's)' };
  }

  const expected = crypto.createHmac('sha256', secret).update(t + '.' + rawBody, 'utf8').digest('hex');
  const exp = Buffer.from(expected, 'utf8');
  // timingSafeEqual THROWS on a length mismatch, so a junk signature would 500 instead of
  // being rejected. Compare lengths first, then constant-time compare.
  const ok = v1s.some(function (v) {
    const got = Buffer.from(v, 'utf8');
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
  return ok ? { ok: true, timestamp: ts } : { ok: false, error: 'signature mismatch' };
}

async function recordWebhook(rawBody, sigHeader) {
  const ver = verifySignature(rawBody, sigHeader);
  if (!ver.ok) return { ok: false, error: ver.error };
  let evt;
  try { evt = JSON.parse(rawBody); } catch (e) { return { ok: false, error: 'invalid json' }; }

  const t = evt.type;
  if (t === 'checkout.session.completed' || t === 'payment_intent.succeeded') {
    const obj = evt.data && evt.data.object || {};
    const amount = (obj.amount_total || obj.amount_received || obj.amount || 0) / 100;
    const streamId = (obj.metadata && obj.metadata.streamId) || null;
    await ledger.record({ type: 'income', streamId: streamId, amount: amount, currency: obj.currency || 'usd', source: 'stripe:' + t, meta: { id: obj.id } });
    return { ok: true, recorded: true, amount: amount, streamId: streamId };
  }
  return { ok: true, recorded: false, ignored: t };
}

// ── OUTFLOWS: propose only, NEVER execute (single-signature halt) ──
async function proposeFee(opts) {
  await ledger.record({ type: 'fee-proposed', streamId: opts.streamId || null, amount: opts.amount || 0, source: 'engine', meta: { reason: opts.reason || '' } });
  return { ok: true, executed: false, status: 'blocked-on-human', message: 'Fee payment proposed and recorded. Halts for single-signature sign-off (FINANCE_PORTAL_SIGNOFF.md §7).' };
}
async function proposeLending(opts) {
  await ledger.record({ type: 'lend-proposed', streamId: null, amount: opts.amount || 0, source: 'engine', meta: { toDomain: opts.toDomain, reason: opts.reason || '' } });
  return { ok: true, executed: false, status: 'blocked-on-human', message: 'Inter-domain loan to "' + opts.toDomain + '" proposed and recorded. Halts for single-signature sign-off (§7).' };
}

module.exports = {
  createPaymentLink, createSubscriptionCheckout, recordWebhook, verifySignature,
  proposeFee, proposeLending, hasKey: function () { return !!_key(); }
};
