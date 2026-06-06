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

// ── RECORD INCOME from a verified Stripe webhook ──────────────────
function verifySignature(rawBody, sigHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: 'STRIPE_WEBHOOK_SECRET not set' };
  if (!sigHeader) return { ok: false, error: 'missing stripe-signature header' };
  const parts = {};
  sigHeader.split(',').forEach(function (p) { const kv = p.split('='); parts[kv[0]] = kv[1]; });
  if (!parts.t || !parts.v1) return { ok: false, error: 'malformed signature' };
  const signedPayload = parts.t + '.' + rawBody;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  return ok ? { ok: true } : { ok: false, error: 'signature mismatch' };
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

module.exports = { createPaymentLink, recordWebhook, verifySignature, proposeFee, proposeLending, hasKey: function () { return !!_key(); } };
