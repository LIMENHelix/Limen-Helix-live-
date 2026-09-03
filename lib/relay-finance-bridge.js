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
 *   Stripe API (direct)   POST /v1/payment_links/:id    close a link once its order settled
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
// 100 sessions a page. Ten pages is a thousand attempts against one link, far past any
// honest customer, and the bound stops a pathological link burning the whole cycle.
const PAYMENT_READ_MAX_PAGES = 10;
// How far back to look for an existing booking of the same charge. The ledger holds 5000
// events; a reconcile runs within an hour of the webhook, so this is generous.
const LEDGER_SCAN = 2000;
// finance-ledger's own key. Read directly and STRICTLY, because its events() helper falls
// back to process memory on a Redis failure and a money write cannot be authorised by a
// guess. See incomeAlreadyBooked().
const LEDGER_KEY = 'finance:ledger';

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

  // PAGINATE. A payment link is reusable, so abandoned and retried attempts pile up
  // against it; reading only the first page and calling that "unpaid" leaves a customer
  // who paid on their fourteenth attempt stranded forever. Walk until a paid session is
  // found or Stripe says there are no more.
  let settled = null;
  let paidSessions = [];
  let exhausted = false;
  let after = null;
  for (let page = 0; page < PAYMENT_READ_MAX_PAGES; page++) {
    const url = 'https://api.stripe.com/v1/checkout/sessions' +
                '?payment_link=' + encodeURIComponent(id) + '&limit=100' +
                (after ? '&starting_after=' + encodeURIComponent(after) : '');

    let r, j;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(function () { ctl.abort(); }, PAYMENT_READ_TIMEOUT_MS);
      try {
        r = await fetch(url, {
          headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
          signal: ctl.signal
        });
        // NOT caught into {}. A 2xx carrying a body we cannot parse is an UNKNOWN answer,
        // and swallowing it into an empty object turned it into "no paid session here",
        // i.e. a confident "unpaid" derived from having understood nothing.
        j = await r.json();
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      return { ok: false, error: 'payment rail answer could not be read: ' + e.message };
    }
    if (!r.ok) {
      return { ok: false, error: 'payment rail refused: HTTP ' + r.status +
                                ((j && j.error && j.error.message) ? ' ' + j.error.message : '') };
    }
    if (!j || !Array.isArray(j.data)) {
      return { ok: false, error: 'payment rail returned an unrecognised body' };
    }

    const sessions = j.data;
    // payment_status is the field that means money moved. `status: 'complete'` alone can
    // describe a completed flow that was not actually paid, so both are required.
    const paidHere = sessions.filter(function (s) {
      return s && s.payment_status === 'paid' && s.status === 'complete';
    });
    paidSessions = paidSessions.concat(paidHere);
    // Keep walking even after a hit: a reusable link can be paid more than once, and
    // stopping at the first success is what makes a second charge invisible.
    if (!j.has_more || !sessions.length) { exhausted = true; break; }
    after = sessions[sessions.length - 1].id;
  }
  settled = paidSessions[0] || null;
  // Ran out of pages with Stripe still saying there is more, and nothing paid found. That
  // is UNKNOWN, not unpaid: the payment could be on the page we did not read, and
  // answering "not paid" would leave a charged customer stranded on a confident guess.
  if (!settled && !exhausted) {
    return { ok: false, error: 'more sessions than this read covers; payment state unknown' };
  }
  if (!settled) return { ok: true, paid: false };

  return {
    ok: true,
    paid: true,
    sessionId: settled.id || null,
    paymentIntentId: typeof settled.payment_intent === 'string'
      ? settled.payment_intent
      : (settled.payment_intent && settled.payment_intent.id) || null,
    amount: settled.amount_total != null ? Math.round(settled.amount_total) / 100 : null,
    currency: settled.currency || null,
    // A reusable link paid more than once. The caller must NOT quietly fulfil one and
    // ignore the rest: every extra charge is a customer owed either goods or a refund,
    // and once the order leaves awaiting-payment nothing inspects the link again.
    duplicatePayments: paidSessions.length > 1
      ? paidSessions.map(function (s) {
          return { sessionId: s.id, amount: s.amount_total != null ? Math.round(s.amount_total) / 100 : null };
        })
      : null
  };
}

/**
 * Close a payment link once its order is settled. → { ok } or { ok:false, error }
 *
 * A Stripe Payment Link is REUSABLE by default, and an order leaves 'awaiting-payment'
 * the moment it settles, after which nothing looks at that link again. So a customer who
 * opens their emailed link a second time can be charged again into silence: no second
 * delivery, no refund, no flag. Detecting the duplicate at settlement only covers the
 * sessions that exist in the poll that settles it.
 *
 * Deactivating removes the class instead of reporting it. This is a WRITE, and the only
 * one this seam makes besides creating the link: it moves no money and can take none, it
 * withdraws the ability to take more.
 */
async function closePaymentLink(paymentLinkId) {
  const id = String(paymentLinkId || '').trim();
  if (!id) return { ok: false, error: 'no paymentLinkId' };
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) return { ok: false, error: 'payments not enabled yet' };

  try {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, PAYMENT_READ_TIMEOUT_MS);
    try {
      const r = await fetch('https://api.stripe.com/v1/payment_links/' + encodeURIComponent(id), {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'active=false',
        signal: ctl.signal
      });
      if (!r.ok) return { ok: false, error: 'payment rail refused: HTTP ' + r.status };
      return { ok: true };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    // Not fatal. The order is settled either way; the link staying open is a risk to
    // manage, not a reason to unwind a completed sale.
    return { ok: false, error: e.message };
  }
}

/**
 * Has this exact charge already been booked as income by ANYONE?
 *   → true / false / null (could not read the ledger — treat as "do not write")
 *
 * Relay is not the only thing that can book one of its payments. Every payment link
 * Relay creates carries streamId 'relay-order', and /api/capital-engine?action=stripe-webhook
 * hands checkout.session.completed to stripe-rail.recordWebhook (lib/stripe-rail.js:238-244),
 * which writes an income event with meta.id set to the Stripe object id. If that webhook is
 * registered on this Stripe account, reconciliation reporting the same charge again
 * inflates net income and, downstream of that, lendable surplus. Two books of the same
 * dollar is worse than booking it late.
 *
 * So the ledger itself is the deduplication key: it is asked whether an event already
 * carries this Stripe session or payment-intent id, or this order id. That also settles
 * the cron-versus-manual race — two reconciles cannot both write, because the second one
 * sees the first one's entry rather than a stale flag on the order.
 *
 * NULL, not false, when the ledger cannot be read. An unreadable ledger is not evidence
 * that nothing was booked, and writing on that assumption is how the double-book happens.
 */
async function incomeAlreadyBooked(ids) {
  ids = ids || {};
  const wanted = [ids.sessionId, ids.paymentIntentId, ids.orderId].filter(Boolean).map(String);
  if (!wanted.length) return false;

  // STRICT read, not finance-ledger.events(). That helper goes through limen-db.lrange,
  // which CATCHES a Redis failure and answers from process-local memory instead — so a
  // temporarily unreadable Redis returned an empty-but-successful list, this concluded
  // "nothing booked", and the webhook's durable entry sitting in Redis got booked a
  // second time once writes recovered. lrangeStrict throws instead of guessing, which is
  // the only answer that can be trusted to authorise a money write.
  let events;
  try {
    events = await db.lrangeStrict(LEDGER_KEY, 0, LEDGER_SCAN - 1);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(events)) return null;

  return events.some(function (e) {
    if (!e || e.type !== 'income') return false;
    const m = e.meta || {};
    return wanted.indexOf(String(m.id)) !== -1 ||
           wanted.indexOf(String(m.orderId)) !== -1 ||
           wanted.indexOf(String(m.sessionId)) !== -1;
  });
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
  closePaymentLink,
  incomeAlreadyBooked,
  reportIncome,
  drainQueue,
  queueDepth
};
