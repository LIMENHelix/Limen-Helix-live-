/**
 * relay-finance-bridge.js — the ONE place Relay is allowed to touch money.
 *
 * Relay lives inside the connectome and does transmit funds to the finance portal. That
 * is deliberate. What is not acceptable is Relay reaching into finance from a dozen call
 * sites, because then a Relay bug is a finance bug. Every payment link Relay creates and
 * every income event Relay reports goes through this file, so the blast radius of
 * anything Relay does wrong is this file and no further.
 *
 * ── THE SEAM, IN FULL ───────────────────────────────────────────────────────────────
 * OUTBOUND (Relay -> rest of system), the complete list:
 *   lib/stripe-rail       createPaymentLink, hasKey     take money IN from a customer
 *   lib/finance-ledger    record                        tell finance that income arrived
 *   Stripe API (direct)   GET /v1/checkout/sessions     ask whether a link was paid
 *
 * The third is a read. It is a direct call rather than a stripe-rail one because
 * stripe-rail has a _post helper and no retrieve, and teaching a file shared with the
 * whole system a new trick for Relay's benefit is the coupling this seam exists to
 * prevent. It reads; it moves nothing. See paymentStatus().
 *
 * That is all. Relay does not call proposeFee, proposeLending, the capital engine, any
 * payout rail, or anything that moves money OUT. Paying a source seller is a purchase
 * made on a marketplace by lib/relay-buy under lib/relay-autonomy's caps, and paying a
 * person is not something Relay does at all.
 *
 * INBOUND (rest of system -> Relay): nothing. No module outside Relay imports Relay.
 * scripts/test-relay-firewall.js fails the build if either direction changes.
 *
 * ── FAIL SOFT ON THE LEDGER, FAIL HARD ON THE CHARGE ────────────────────────────────
 * These two failures are not the same and must not be treated the same:
 *
 *   A payment link that cannot be created  -> the sale MUST fail. Never tell a customer
 *   an order is placed when no charge exists.
 *
 *   A ledger write that fails              -> the sale MUST still stand. The customer has
 *   paid; refusing the order because our own bookkeeping hiccuped loses a real sale and
 *   strands real money. The event is queued in Relay's own namespace and retried, so the
 *   income is never lost, only late.
 *
 * Getting that pair backwards is how a storefront either charges for nothing or throws
 * away paid orders.
 */

const db = require('./limen-db');

const PENDING_KEY = 'relay:finance:unreported';   // Relay's namespace, not finance's
const STREAM_ID = 'relay-order';                  // how Relay income is tagged in the ledger
const PAYMENT_READ_TIMEOUT_MS = parseInt(process.env.RELAY_HTTP_TIMEOUT_MS || '12000', 10);

/** Loaded lazily so a require-time failure in finance cannot take Relay's page down. */
function _stripe() { return require('./stripe-rail'); }
function _ledger() { return require('./finance-ledger'); }

function paymentsEnabled() {
  try { return _stripe().hasKey(); } catch (e) { return false; }
}

/**
 * Take money in. Returns { ok, url, paymentLinkId } or { ok:false, error }.
 * Callers MUST treat ok:false as "no order was placed".
 */
async function createPayment(opts) {
  opts = opts || {};
  const amount = Math.round((parseFloat(opts.amount) || 0) * 100) / 100;
  if (!(amount > 0)) return { ok: false, error: 'amount must be greater than zero' };
  if (!opts.orderId) return { ok: false, error: 'orderId is required so a payment can be traced to an order' };

  let stripe;
  try { stripe = _stripe(); } catch (e) {
    return { ok: false, error: 'payment rail unavailable: ' + e.message };
  }
  if (!stripe.hasKey()) return { ok: false, error: 'payments not enabled yet', needsKey: true };

  try {
    const link = await stripe.createPaymentLink({
      name: opts.name || 'Relay order',
      amount: amount,
      streamId: STREAM_ID,
      currency: opts.currency || 'usd',
      metadata: Object.assign({ orderId: opts.orderId, source: 'relay' }, opts.metadata || {})
    });
    if (!link || !link.ok) return { ok: false, error: (link && link.error) || 'payment link refused' };
    return { ok: true, url: link.url, paymentLinkId: link.paymentLinkId, amount: amount };
  } catch (e) {
    return { ok: false, error: 'payment link failed: ' + e.message };
  }
}

/**
 * Did the customer actually pay for this payment link?
 *   → { ok:true, paid:true,  sessionId, paymentIntentId, amount }
 *   → { ok:true, paid:false }                       asked, and the answer is no
 *   → { ok:false, error }                           could NOT ask; never read as unpaid
 *
 * WHY RELAY ASKS INSTEAD OF BEING TOLD
 * A payment link is long-lived and a customer may open it minutes or days later. Nothing
 * marked a relay-store order paid, so a real charge left the order sitting in
 * 'awaiting-payment' while relay-engine only ever sweeps 'paid' — the customer was billed
 * and nothing was ever ordered from the supplier.
 *
 * The obvious fix is an inbound webhook. This asks Stripe instead, because asking is
 * strictly better here: no endpoint to register in the dashboard, no webhook secret, no
 * inbound claim to authenticate or spoof, and a delivery Stripe failed to make is simply
 * retried on the next cycle rather than stranding a paid order for good. The cost is
 * latency bounded by the cron interval, which for goods that ship in days is not a cost.
 *
 * The ok:false / paid:false distinction is the whole safety of it. A network failure that
 * reads as "not paid" is harmless (retry). A network failure that read as "paid" would
 * order stock against money nobody sent, so an error is NEVER a payment.
 *
 * TRANSPORT: this is the one read-only GET Relay makes to the payment rail, and it is
 * here because lib/relay-finance-bridge is the single money seam the firewall permits to
 * touch it (scripts/test-relay-firewall.js F6). lib/stripe-rail exposes only a _post
 * helper and no retrieve, and adding one there would mean editing a file shared with the
 * rest of the system for Relay's benefit — the exact coupling this seam exists to avoid.
 */
async function paymentStatus(paymentLinkId) {
  const id = String(paymentLinkId || '').trim();
  if (!id) return { ok: false, error: 'no paymentLinkId on that order' };

  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) return { ok: false, error: 'payments not enabled yet' };

  const url = 'https://api.stripe.com/v1/checkout/sessions' +
              '?payment_link=' + encodeURIComponent(id) + '&limit=10';

  let r, j;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, PAYMENT_READ_TIMEOUT_MS);
    try {
      r = await fetch(url, {
        headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
        signal: ctl.signal
      });
      j = await r.json().catch(function () { return {}; });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, error: 'could not reach the payment rail: ' + e.message };
  }
  if (!r.ok) {
    return { ok: false, error: 'payment rail refused: HTTP ' + r.status +
                              ((j && j.error && j.error.message) ? ' ' + j.error.message : '') };
  }

  const sessions = Array.isArray(j && j.data) ? j.data : [];
  // payment_status is the field that means money moved. `status: 'complete'` alone can
  // describe a completed flow that was not actually paid, so both are required.
  const settled = sessions.find(function (s) {
    return s && s.payment_status === 'paid' && s.status === 'complete';
  });
  if (!settled) return { ok: true, paid: false };

  return {
    ok: true,
    paid: true,
    sessionId: settled.id || null,
    paymentIntentId: typeof settled.payment_intent === 'string'
      ? settled.payment_intent
      : (settled.payment_intent && settled.payment_intent.id) || null,
    amount: settled.amount_total != null ? Math.round(settled.amount_total) / 100 : null,
    currency: settled.currency || null
  };
}

/**
 * Tell finance that a Relay sale was paid. Fails soft: on any error the event is queued
 * in Relay's own namespace and reported as queued, never as lost, and never as a reason
 * to fail the customer's order.
 */
async function reportIncome(evt) {
  evt = evt || {};
  const entry = {
    type: 'income',
    streamId: STREAM_ID,
    amount: Math.round((parseFloat(evt.amount) || 0) * 100) / 100,
    source: evt.source || 'stripe',
    meta: {
      orderId: evt.orderId || null,
      buyer: evt.buyerId || null,
      lines: evt.lineCount || 1,
      sourceCostTotal: evt.sourceCostTotal != null ? evt.sourceCostTotal : null,
      margin: evt.margin != null ? evt.margin : null
    }
  };
  if (!(entry.amount > 0)) return { ok: false, error: 'income amount must be greater than zero' };

  try {
    await _ledger().record(entry);
    return { ok: true, recorded: true };
  } catch (e) {
    const queued = await _queue(entry, e.message);
    return { ok: true, recorded: false, queued: queued.ok, error: e.message };
  }
}

async function _queue(entry, why) {
  try {
    let pending = await db.get(PENDING_KEY) || [];
    pending.push({ entry: entry, failedAt: new Date().toISOString(), reason: why || null });
    if (pending.length > 1000) pending = pending.slice(-1000);
    await db.set(PENDING_KEY, pending);
    return { ok: true, depth: pending.length };
  } catch (e) {
    // Both the ledger and Relay's own store are down. Say so loudly; do not pretend.
    console.error('[relay-finance-bridge] income event could not be recorded OR queued:', JSON.stringify(entry));
    return { ok: false, error: e.message };
  }
}

/** Retry queued income. Safe to call repeatedly; drains what it can and keeps the rest. */
async function drainQueue(limit) {
  let pending;
  try { pending = await db.get(PENDING_KEY) || []; } catch (e) { return { ok: false, error: e.message }; }
  if (!pending.length) return { ok: true, drained: 0, remaining: 0 };

  const take = Math.min(pending.length, limit || 50);
  const keep = [];
  let drained = 0;

  for (let i = 0; i < take; i++) {
    try {
      await _ledger().record(pending[i].entry);
      drained++;
    } catch (e) {
      keep.push(pending[i]);
    }
  }
  const remaining = keep.concat(pending.slice(take));
  try { await db.set(PENDING_KEY, remaining); } catch (e) { /* next drain retries */ }
  return { ok: true, drained: drained, remaining: remaining.length };
}

async function queueDepth() {
  try { return ((await db.get(PENDING_KEY)) || []).length; } catch (e) { return null; }
}

module.exports = {
  STREAM_ID,
  PENDING_KEY,
  paymentsEnabled,
  createPayment,
  paymentStatus,
  reportIncome,
  drainQueue,
  queueDepth
};
