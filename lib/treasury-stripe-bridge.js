'use strict';

/**
 * treasury-stripe-bridge.js — the one place a real Stripe payment becomes a treasury receipt.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS. `lib/civilization-treasury-ledger.js` is a complete double-entry
 * substrate for the twenty product domains, and until now its ONLY consumer in the repo
 * was its own read route. Money landed in Stripe, was counted into `sales:leads:by-domain`,
 * and the accounting substrate never saw the cash event. So every domain balance that
 * endpoint reported was an empty projection rather than a claim about real money.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * DEPOSIT ONLY, AND THAT IS A PROPERTY OF THE LEDGER, NOT A PROMISE MADE HERE.
 *
 * The only receipt this module can produce is SALE_CAPTURED, whose single movement is
 * `external('stripe-clearing') -> cash(domain, 'pending')`. Money moves INTO a domain and
 * there is no code path in this file that can move it anywhere else. The ledger itself
 * carries `OUTBOUND_MONEY_AUTHORIZED = false` and holds no payment, payout or transfer
 * adapter, so an accounting entry here can never become a money movement.
 *
 * THIS IS NOT THE SAME BOOK AS `lib/stripe-rail.recordWebhook`, and they must not be
 * merged. That one records `{type:'income'}` in DOLLARS against a `metadata.streamId` for
 * the side-venture capital ledger. This one records double-entry CENTS against an
 * `ownerDomain` for the civilization treasury. Two books, two questions, both correct.
 * Consolidating them would silently halve one and double-count the other.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT WIRED, so a reader does not mistake absence for completeness.
 *
 *   SALE_SETTLED. Settlement requires fee + tax + levy + net to equal gross EXACTLY, and
 *   the fee is only knowable from the Stripe balance transaction, which none of the events
 *   this bridge sees carries. So captured money sits in the domain's `pending` bucket and
 *   `available` stays at zero. READING `available: 0` AS "NO REVENUE" IS THE MISREADING
 *   THIS PARAGRAPH EXISTS TO PREVENT. Look at `pendingCashCents`.
 *
 *   DISPUTE. The operator's policy is no refunds, so REFUND is genuinely out of scope. A
 *   chargeback is not a refund: it is the cardholder's bank reversing the payment, and it
 *   happens regardless of a merchant's policy. Nothing here books one, so a disputed sale
 *   leaves the ledger overstating that domain until DISPUTE_HOLD is wired. Known and open.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

var DEFAULT_TREASURY = require('./civilization-treasury-ledger.js');

/* Money facts that could not be booked. Capped, because an unbounded failure log is a
   second outage. Visible on purpose: a lost cash receipt must never be silent. */
var UNBOOKED_KEY = 'civilization_treasury_unbooked_log';
var UNBOOKED_CAP = 500;

/**
 * A LIMEN product sale is identified by BOTH marks, and the pair is the whole guard.
 *
 * The Relay storefront books through the SAME Stripe account. Its sessions carry
 * `{surface, items}`, `{lines, buyer}` and similar, and never `limen`. Only
 * `stripe-rail.createSubscriptionCheckout` sets `limen:'1'` alongside a domain. Booking on
 * `metadata.domain` alone would therefore be one stray metadata key away from filing
 * marketplace revenue as a product domain's earnings.
 */
function isLimenProductSale(metadata) {
  return !!metadata && String(metadata.limen) === '1';
}

function positiveCents(value) {
  var n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * Book one captured Stripe payment to one product domain.
 *
 * NEVER THROWS, AND THAT IS THE CONTRACT, NOT AN OVERSIGHT. This is called from
 * handlers/stripe-webhook.js, whose own header says it is "the ONLY thing that grants or
 * revokes paid access". A storage blip in the accounting layer must not be able to fail
 * that handler, because a 500 makes Stripe redeliver the event and re-run activation and
 * customer email. Access provisioning outranks bookkeeping at the moment of payment.
 *
 * The cost of that choice is that a failure would vanish, so it does not: every refusal
 * and every error is returned to the caller with a reason AND appended to the unbooked
 * log, so the gap is countable and replayable later rather than inferred from a shortfall.
 *
 * @returns {Promise<{booked:boolean, duplicate:boolean, receiptId:(string|null), reason:(string|null)}>}
 */
async function bookCapturedSale(opts) {
  opts = opts || {};
  var treasury = opts.treasury || DEFAULT_TREASURY;
  var store = opts.store;
  var eventId = opts.eventId ? String(opts.eventId) : '';
  var domainName = String(opts.domain || '').trim().toLowerCase();
  var grossCents = positiveCents(opts.grossCents);

  var refuse = function (reason) {
    return recordUnbooked(store, {
      eventId: eventId || null, domain: domainName || null,
      grossCents: opts.grossCents == null ? null : opts.grossCents, reason: reason
    }).then(function () {
      return { booked: false, duplicate: false, receiptId: null, reason: reason };
    });
  };

  /* `externalRef` is required by saleCaptured and is the audit thread back to Stripe.
     Without it there is no way to prove which payment a receipt describes. */
  if (!eventId) return refuse('no-stripe-event-id');
  if (!store) return refuse('no-store');

  /* An unknown domain is refused rather than defaulted. `treasury.post` would throw on it
     anyway, but refusing here names the cause instead of surfacing 'unknown treasury
     product domain' from two layers down. Four of the twenty (communication, culture,
     energy, infrastructure) have no offers in the catalog yet, so they legitimately never
     appear; that is an empty account, not a fault. */
  if (!domainName) return refuse('no-domain-on-payment');
  if (treasury.DOMAINS.indexOf(domainName) < 0) return refuse('not-a-product-domain:' + domainName);

  /* Zero and negative are refused. A zero-amount checkout (a 100% promotion code) is a real
     event that moved no money, and `cents()` rejects it, so it is named rather than thrown. */
  if (grossCents === null) return refuse('non-positive-amount');

  try {
    /* IDEMPOTENCY IS THE LEDGER'S, NOT OURS. `post` derives the receiptId from a digest of
       this key, claims it with setIfAbsent, compares content digests on collision and
       verifies the readback. The webhook's own `alreadyHandled(evt.id)` cache is capped at
       400 events and is a fast path, not a guarantee; this is the guarantee. Prefixed
       because one Stripe event must map to exactly one treasury receipt of one kind. */
    var idempotencyKey = 'stripe-sale-captured:' + eventId;
    var spec = treasury.saleCaptured(domainName, grossCents, idempotencyKey, eventId);
    var posted = await treasury.post(store, spec, opts.now);
    return {
      booked: true,
      duplicate: posted.duplicate === true,
      receiptId: posted.receipt && posted.receipt.receiptId || null,
      reason: null
    };
  } catch (e) {
    return refuse('post-failed:' + (e && e.message ? e.message : 'unknown'));
  }
}

/**
 * Append a money fact that did not reach the ledger.
 *
 * Swallows its own errors deliberately: if the store is the thing that is broken, the
 * failure log cannot be the thing that reports it, and throwing here would defeat the
 * non-throwing contract this module exists to keep.
 */
async function recordUnbooked(store, entry) {
  if (!store || typeof store.lpush !== 'function') return false;
  try {
    await store.lpush(UNBOOKED_KEY, Object.assign({ at: new Date().toISOString() }, entry));
    if (typeof store.ltrim === 'function') await store.ltrim(UNBOOKED_KEY, 0, UNBOOKED_CAP - 1);
    return true;
  } catch (_) {
    return false;
  }
}

async function unbooked(store, cap) {
  if (!store || typeof store.lrange !== 'function') return [];
  try {
    return await store.lrange(UNBOOKED_KEY, 0, Math.max(1, Number(cap) || UNBOOKED_CAP) - 1);
  } catch (_) {
    return [];
  }
}

module.exports = {
  bookCapturedSale: bookCapturedSale,
  isLimenProductSale: isLimenProductSale,
  unbooked: unbooked,
  UNBOOKED_KEY: UNBOOKED_KEY,
  UNBOOKED_CAP: UNBOOKED_CAP
};
