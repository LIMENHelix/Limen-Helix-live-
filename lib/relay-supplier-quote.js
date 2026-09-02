/**
 * relay-supplier-quote.js — confirm, before any money moves, that the supplier will
 * still sell this thing, to THIS address, at a cost the sale was priced on.
 *
 * WHY THIS EXISTS AS ONE MODULE
 * Relay takes money down two routes: relay-demand-purchase (a customer searches, picks a
 * result, confirms) and relay-cart-checkout (a customer buys a listing the engine already
 * published). Both end at relay-engine.fulfillPaidOrder → lib/relay-buy, and both were
 * charging against numbers quoted earlier, to somewhere else:
 *
 *   - freight was quoted to CJ's DEFAULT destination during discovery, not to the buyer's
 *     address. buyFromCJ requotes and refuses past 10% (lib/relay-buy.js:199-207), which
 *     runs AFTER the charge, so the correct outcome was a paid order needing a human.
 *   - stock was checked during discovery. A variant that sold out since is still quotable
 *     for freight, so a freight quote proves nothing about inventory, and placeOrder is
 *     the first thing that finds out — again after the money.
 *   - the supplier credential can go away between the search and the confirmation.
 *
 * Every one of those is cheap to refuse here and expensive to discover after a charge.
 * Two handlers with two copies of that logic is how one of them ends up a version behind,
 * so it lives here once.
 *
 * WHAT IT DOES NOT DO
 * It does not price the margin, does not decide what the customer is shown, and does not
 * touch the ledger. It answers one question: what does this actually cost us right now,
 * and can we still get it.
 */

const cj = require('./relay-cj');

/** buyFromCJ refuses past this, so selling past it is selling what fulfilment will refuse. */
const COST_DRIFT_TOLERANCE = 0.10;

function _round(n) { return Math.round(n * 100) / 100; }

/**
 * revalidate({ source, sourceId, sourceCost, sourceShipping, sourceFromCountry,
 *              quantity, shippingAddress })
 *   → { ok:true, effectiveCost, shipping, carrier, fromCountry, requoted }
 *   → { ok:false, reason, code }
 *
 * `code` is stable and meant to be branched on:
 *   unconfigured   the supplier credential is gone
 *   stale-quote    the record predates freight provenance; the freight inside sourceCost
 *                  cannot be separated out, so it cannot be revalidated
 *   out-of-stock   the variant is no longer available in the quantity asked for
 *   no-quote       the supplier would not price shipping to this address
 *   cost-drift     it now costs so much more that fulfilment would refuse it anyway
 *
 * A source Relay does not order through directly passes through unchanged: there is
 * nothing to requote, and pretending otherwise would refuse sales for no reason.
 */
async function revalidate(input) {
  const o = input || {};
  const source = o.source || o.sourceMarketplace || null;
  const cost = parseFloat(o.sourceCost);
  const qty = Math.max(1, parseInt(o.quantity, 10) || 1);
  const addr = o.shippingAddress || {};

  if (source !== 'cj') {
    return {
      ok: true,
      effectiveCost: isFinite(cost) ? cost : null,
      shipping: o.sourceShipping != null ? parseFloat(o.sourceShipping) : null,
      carrier: o.sourceCarrier || null,
      fromCountry: o.sourceFromCountry || null,
      requoted: false
    };
  }

  if (!cj.configured()) {
    return { ok: false, code: 'unconfigured', reason: 'the supplier is not reachable right now' };
  }
  if (o.sourceShipping == null || !isFinite(cost)) {
    return { ok: false, code: 'stale-quote', reason: 'this price is too old to confirm' };
  }
  const vid = o.sourceId;
  if (!vid) {
    return { ok: false, code: 'stale-quote', reason: 'this item has no supplier variant to confirm' };
  }

  const country = String(addr.country || 'US').toUpperCase();

  // Stock first: a sold-out variant still returns a freight quote, so quoting first and
  // trusting it is exactly the mistake that lets someone pay for nothing.
  const held = await cj.stock(vid, country, qty);
  if (!held || !(held.qty >= qty)) {
    return {
      ok: false,
      code: 'out-of-stock',
      reason: qty > 1 ? 'only ' + ((held && held.qty) || 0) + ' left with the supplier' : 'sold out'
    };
  }

  const from = held.from || o.sourceFromCountry || null;
  const q = await cj.freight(vid, qty, country, addr.postalCode, from);
  if (!q) {
    return { ok: false, code: 'no-quote', reason: 'shipping to this address could not be priced' };
  }

  // PER UNIT, both sides. `cost` is one unit's product-plus-freight, and cj.freight()
  // quotes the whole requested quantity, so adding the quote whole compares a two-unit
  // freight against a one-unit cost in the drift gate below, and hands fulfilment a
  // per-unit cost it then multiplies by qty a second time.
  const freightPerUnit = q.price / qty;
  const effectiveCost = _round(cost - parseFloat(o.sourceShipping) + freightPerUnit);
  if (effectiveCost > cost * (1 + COST_DRIFT_TOLERANCE)) {
    return {
      ok: false,
      code: 'cost-drift',
      reason: 'shipping to this address costs $' + freightPerUnit.toFixed(2) + ' a unit against $' +
              parseFloat(o.sourceShipping).toFixed(2) + ' quoted',
      effectiveCost: effectiveCost
    };
  }

  return {
    ok: true,
    effectiveCost: effectiveCost,
    // Per unit, matching listing.sourceShipping, which is what fulfilment compares against.
    shipping: _round(freightPerUnit),
    shippingTotal: _round(q.price),
    carrier: q.carrier || o.sourceCarrier || null,
    fromCountry: from,
    requoted: true
  };
}

module.exports = { revalidate, COST_DRIFT_TOLERANCE };
