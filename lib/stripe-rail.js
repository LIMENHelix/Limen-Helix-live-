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
/* The twenty product domains, taken from the treasury rather than restated here. A second
   copy of this list would drift, and the failure mode of a drifted copy is a payment link
   that mints fine and books to an account the ledger will refuse. */
const TREASURY_DOMAINS = require('./civilization-treasury-ledger.js').DOMAINS;

const API = 'https://api.stripe.com/v1';

function _key() { return process.env.STRIPE_SECRET_KEY || null; }

/**
 * The key the DOMAIN SUBSCRIPTION path uses.
 *
 * STRIPE_SECRET_KEY is a live key already carrying Relay and the real estate page, so it
 * cannot be swapped to a test key to try something out without stopping real revenue. Setting
 * STRIPE_SECRET_KEY_SUBS lets the subscription rungs run against a test key while everything
 * already earning keeps using the live one. Unset, it falls back and behaves exactly as before.
 *
 * Delete the variable when the rungs are ready to charge for real.
 */
function _subsKey() { return process.env.STRIPE_SECRET_KEY_SUBS || process.env.STRIPE_SECRET_KEY || null; }

function _mode(k) {
  if (!k) return null;
  if (k.indexOf('sk_live_') === 0 || k.indexOf('rk_live_') === 0) return 'live';
  if (k.indexOf('sk_test_') === 0 || k.indexOf('rk_test_') === 0) return 'test';
  return 'unknown';
}

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

async function _post(path, body, keyOverride) {
  const key = keyOverride || _key();
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
/**
 * A hosted Stripe Payment Link: a URL that sells one thing at one price.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS IS HOW A DOMAIN SELLS ANYTHING ON A SITE IT DESIGNS. There is no integration to
 * write: the link is a URL, so it drops into any page, button or email as an href, and
 * Stripe hosts the payment page. Price, name and amount all live on Stripe's side once
 * the link exists, so nothing about the buying page can alter what is charged.
 *
 * `domain` DECIDES WHICH ACCOUNT THE MONEY LANDS IN, and until 2026-09-05 it could not:
 * this function hardcoded `domain: 'finance'` into both the product and the link
 * metadata, on every link it had ever created. Wiring the treasury to payment links
 * without fixing that would have filed every domain's earnings as Finance's.
 *
 * TWO BEHAVIOURS, and the split is what makes this change carry no regression:
 *
 *   domain given     stamps that domain plus `limen:'1'`, so handlers/stripe-webhook.js
 *                    books the sale into THAT domain's treasury account.
 *   domain omitted   preserves the old behaviour EXACTLY — `domain:'finance'`, no
 *                    `limen` mark, so existing capital-engine links keep recording to
 *                    the side-venture capital ledger and book nothing to the treasury.
 *
 * An unknown domain is REFUSED rather than defaulted. Defaulting would put real money in
 * the wrong domain's account and the receipt would look perfectly valid.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */
/**
 * Which treasury account a payment link pays into. Pure, and exported for test, because
 * it is the part of link creation that decides where real money goes and it must be
 * exercisable without minting anything in a LIVE Stripe account.
 *
 * Returns `{ok, domain, limen, error}`. `limen` is the mark handlers/stripe-webhook.js
 * requires before it will book a session to a product domain; a legacy link gets none,
 * which is exactly why legacy links keep booking only to the capital ledger.
 */
function paymentLinkAttribution(requestedDomain) {
  if (requestedDomain == null || String(requestedDomain).trim() === '') {
    /* LEGACY SHAPE, PRESERVED BYTE FOR BYTE. capital-engine.json products call this with
       no domain and have always been stamped finance. Changing that default would
       silently re-attribute every existing link. */
    return { ok: true, domain: 'finance', limen: null };
  }
  const requested = String(requestedDomain).trim().toLowerCase();
  if (TREASURY_DOMAINS.indexOf(requested) < 0) {
    return {
      ok: false, domain: null, limen: null,
      error: 'unknown product domain "' + requested + '"; a payment link must name one of the twenty or omit it'
    };
  }
  return { ok: true, domain: requested, limen: '1' };
}

async function createPaymentLink(opts) {
  opts = opts || {};
  const name = opts.name || 'LIMEN Helix product';
  const amountCents = opts.amountCents != null
    ? Math.round(opts.amountCents)
    : Math.round((opts.amount || 0) * 100);
  if (!amountCents || amountCents < 50) return { ok: false, error: 'amount must be >= $0.50' };

  const attribution = paymentLinkAttribution(opts.domain);
  if (!attribution.ok) return { ok: false, error: attribution.error };
  const productDomain = attribution.domain;
  const limenMark = attribution.limen;

  const baseMeta = { streamId: opts.streamId || '', domain: productDomain };
  if (limenMark) baseMeta.limen = limenMark;

  const prod = await _post('/products', { name: name, metadata: baseMeta });
  if (!prod.ok) return prod;
  const price = await _post('/prices', { product: prod.data.id, unit_amount: amountCents, currency: opts.currency || 'usd' });
  if (!price.ok) return price;
  const linkMetadata = Object.assign({}, baseMeta, opts.metadata || {});
  const link = await _post('/payment_links', {
    line_items: [{ price: price.data.id, quantity: 1 }],
    metadata: linkMetadata
  });
  if (!link.ok) return link;
  return {
    ok: true, url: link.data.url, paymentLinkId: link.data.id,
    priceId: price.data.id, productId: prod.data.id,
    /* Reported so a caller can SEE which account this link will pay into, rather than
       trusting that it passed the argument it meant to. */
    domain: productDomain, amountCents: amountCents,
    booksToTreasury: limenMark === '1'
  };
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
  const key = _subsKey();
  if (!key) return { ok: false, error: 'no Stripe key set for subscriptions' };
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

  const s = await _post('/checkout/sessions', body, key);
  if (!s.ok) return s;
  return { ok: true, url: s.data.url, sessionId: s.data.id };
}

// ── RECORD INCOME from a verified Stripe webhook ──────────────────
const SIG_TOLERANCE_SEC = 300;   // Stripe's own recommendation

/**
 * EVERY Stripe endpoint has its OWN signing secret, and this project needs more than one
 * endpoint: /api/capital-engine?action=stripe-webhook books Relay income, and
 * /api/stripe-webhook grants domain subscriptions. Verifying against a single env var would
 * force a choice where both options fail silently. Overwrite the shared one and Relay's
 * income booking starts rejecting every event; leave it and subscriptions reject every event.
 *
 * So: try every configured secret. Adding an endpoint means adding a variable, and nothing
 * that already works has to change.
 */
const SECRET_VARS = ['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET_SUBS', 'STRIPE_WEBHOOK_SECRET_2'];

function _secrets() {
  const out = [];
  SECRET_VARS.forEach(function (n) {
    const v = process.env[n];
    if (v && String(v).trim()) out.push(String(v).trim());
  });
  return out;
}

/**
  * Which mode each key is in, from the PREFIX only. Never returns a key.
  * `keyMode()` answers the question that matters for the rungs: would a Subscribe click charge
  * real money right now? That is the SUBSCRIPTION key, which may differ from the shared one.
  */
function keyMode() { return _mode(_subsKey()); }
function keyModes() {
  return {
    subscriptions: _mode(_subsKey()),
    shared: _mode(_key()),
    usingSeparateSubsKey: !!process.env.STRIPE_SECRET_KEY_SUBS
  };
}

function verifySignature(rawBody, sigHeader, nowMs) {
  const secrets = _secrets();
  if (!secrets.length) return { ok: false, error: 'no Stripe webhook secret is set (' + SECRET_VARS.join(' or ') + ')' };
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

  // Any (secret, v1) pair matching is a valid signature: several secrets because there are
  // several endpoints, several v1s because a secret rotation sends more than one.
  // timingSafeEqual THROWS on a length mismatch, so a junk signature would 500 instead of
  // being rejected. Compare lengths first, then constant-time compare.
  for (let i = 0; i < secrets.length; i++) {
    const exp = Buffer.from(
      crypto.createHmac('sha256', secrets[i]).update(t + '.' + rawBody, 'utf8').digest('hex'), 'utf8');
    const hit = v1s.some(function (v) {
      const got = Buffer.from(v, 'utf8');
      return got.length === exp.length && crypto.timingSafeEqual(got, exp);
    });
    if (hit) return { ok: true, timestamp: ts, secretIndex: i };
  }
  return { ok: false, error: 'signature mismatch' };
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
  proposeFee, proposeLending, keyMode, keyModes,
  /* Exported so the money-attribution decision can be tested without minting anything in
     a live Stripe account. Underscored: it is a test seam, not part of the rail's API. */
  _paymentLinkAttribution: paymentLinkAttribution,
  hasKey: function () { return !!_subsKey(); }
};
