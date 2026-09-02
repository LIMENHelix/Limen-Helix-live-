/**
 * relay-demand-purchase.js — the customer confirms, and this creates the real payment.
 *
 * POST /api/relay-demand-purchase
 * Body: { searchId, itemId, buyerId, shippingAddress, policyAccepted, buyerEmail? }
 *
 * REWRITTEN 2026-08-30. The previous version minted a fake Stripe id
 * (`cs_${Date.now()}_${random}`), pointed the customer at a local page carrying that id
 * in the query string, and recorded the order as though a payment existed. No money could
 * ever have been collected through this route. It now creates a genuine Stripe payment
 * link through the same rail the rest of LIMEN uses.
 *
 * TWO GATES, both hard:
 *   1. policyAccepted must be exactly true. All sales are final, so the confirmation is
 *      the thing that makes that enforceable; without it there is no sale.
 *   2. The source price is re-read from the recorded search. The customer is charged
 *      source cost x (1 + the live margin), computed here and never taken from the client.
 *
 * The order it writes is a normal marketplace order backed by a listing that carries the
 * source URL and cost, so the autonomous fulfilment path (relay-engine.fulfillPaidOrder)
 * can source it exactly like an engine-published item.
 */

const db = require('../lib/limen-db');
const store = require('../lib/relay-store');
const marginCalc = require('../lib/relay-margin-calculator');
const policy = require('../lib/relay-policy');
// The only money call here. Relay does not import stripe-rail or finance-ledger; see
// the seam in lib/relay-finance-bridge.js.
const finance = require('../lib/relay-finance-bridge');
// Stock, freight and supplier reachability, all rechecked before the charge. See gate 2.
const supplier = require('../lib/relay-supplier-quote');
// The same limits fulfilment will apply, asked before charging. See gate 5.
const autonomy = require('../lib/relay-autonomy');

const HOUSE_MARKETPLACE = process.env.RELAY_MARKETPLACE_ID || 'mkt_relay';
const HOUSE_SELLER = process.env.RELAY_HOUSE_SELLER_ID || 'usr_relay_house';

function requiredAddressFields(a) {
  return ['name', 'line1', 'city', 'state', 'postalCode', 'country']
    .filter(function (k) { return !a || !a[k]; });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { searchId, itemId, buyerId, shippingAddress } = body;

    if (!searchId || !itemId || !buyerId || !shippingAddress) {
      return res.status(400).json({ error: 'searchId, itemId, buyerId, shippingAddress required' });
    }

    const missing = requiredAddressFields(shippingAddress);
    if (missing.length) {
      return res.status(400).json({ error: 'shipping address missing: ' + missing.join(', ') });
    }

    // ── gate 1: the final-sale confirmation ──
    if (body.policyAccepted !== true) {
      const p = policy.getPolicy();
      return res.status(400).json({
        error: 'policy not accepted',
        message: 'This order cannot be placed until the final-sale terms are confirmed.',
        policy: { version: p.version, headline: p.headline, confirmLabel: p.confirmLabel, url: '/api/relay?view=policy' }
      });
    }

    // ── resolve the item back to something real ──
    const searches = await db.get('relay:searches') || [];
    const search = searches.find(function (s) { return s.searchId === searchId; });
    if (!search) return res.status(404).json({ error: 'Search not found or expired' });

    const sourceItem = (search.sourceMapping || []).find(function (m) { return m.itemId === itemId; });
    if (!sourceItem) return res.status(404).json({ error: 'Item not found in that search' });
    if (!sourceItem.sourceUrl || !(sourceItem.sourceCost > 0)) {
      return res.status(409).json({ error: 'that item is no longer sourceable' });
    }

    // ── gate 2: freight priced to THIS buyer, before any money moves ──
    // The search quoted CJ freight to CJ's default destination, not to the address in
    // front of us. Pricing and charging on that number means buyFromCJ discovers the
    // difference only after the customer has paid, and refuses to order when it exceeds
    // the recorded cost by more than 10% (lib/relay-buy.js:199-207) — a paid order that
    // now needs a human. Requoting here costs nothing to refuse.
    const check = await supplier.revalidate({
      source: sourceItem.source,
      sourceId: sourceItem.itemId,
      sourceCost: sourceItem.sourceCost,
      sourceShipping: sourceItem.sourceShipping,
      sourceCarrier: sourceItem.sourceCarrier,
      sourceFromCountry: sourceItem.sourceFromCountry,
      quantity: 1,
      shippingAddress: shippingAddress
    });
    if (!check.ok) {
      return res.status(409).json({
        error: check.reason,
        code: check.code,
        message: 'Nothing was charged. Search again to get a current price.'
      });
    }
    const effectiveCost = check.effectiveCost;
    const quotedShipping = check.shipping;
    const quotedCarrier = check.carrier;
    const quotedFrom = check.fromCountry;

    // ── gate 3: price computed server-side from the live margin ──
    const priced = marginCalc.calculateMargin(effectiveCost, await marginCalc.getMargin());
    const customerPrice = priced.customerPrice;
    if (!(customerPrice > effectiveCost)) {
      return res.status(409).json({ error: 'pricing error: no positive spread on that item' });
    }

    // ── gate 4: never charge more than the price they clicked ──
    // The customer chose this item at a price the search displayed, under a maximum they
    // set. A dearer destination requote, or an operator margin change since the search,
    // can push the real price above both. pages/relay.html:825-837 sends them straight to
    // Stripe without showing a revised figure, so a silent increase is charged before it
    // is ever seen. Refuse instead; a fresh search shows the true price honestly.
    const shownPrice = sourceItem.displayedPrice != null ? parseFloat(sourceItem.displayedPrice) : null;
    const searchMax = search.maxPrice != null ? parseFloat(search.maxPrice) : null;
    const cap = Math.min(
      shownPrice != null && isFinite(shownPrice) ? shownPrice : Infinity,
      searchMax != null && isFinite(searchMax) ? searchMax : Infinity
    );
    // Half a cent of tolerance for the rounding, not for a real increase.
    if (isFinite(cap) && customerPrice > cap + 0.005) {
      return res.status(409).json({
        error: 'the price for your address is higher than the price shown',
        message: 'Shipping to this address costs more than the quote you were shown, so the ' +
                 'order was not placed and nothing was charged. Search again to see the ' +
                 'current price for your address.',
        shownPrice: isFinite(cap) ? Math.round(cap * 100) / 100 : null,
        currentPrice: customerPrice
      });
    }

    // ── gate 5: don't sell what the loop will refuse to buy ──
    // relay-engine.fulfillLine authorises every purchase against the same margin floors
    // and spend caps. A $2 spread on a $7.72 sale clears the positive-spread check above
    // and then fails the $8 floor, so the customer pays and fulfilment marks the order
    // blocked. Asking the real gate in dry-run mode, rather than reimplementing its rules
    // here where they would drift, refuses that sale before the charge.
    const limits = await autonomy.authorize({
      amount: effectiveCost,
      salePrice: customerPrice,
      marketplace: sourceItem.source,
      note: sourceItem.title || search.description || null,
      dryRun: true
    });
    if (!limits.allowed) {
      return res.status(409).json({
        error: 'this item cannot be fulfilled at that price',
        message: 'Nothing was charged.',
        reason: limits.reason
      });
    }

    if (!finance.paymentsEnabled()) {
      return res.status(200).json({ ok: false, error: 'payments not enabled yet', needsKey: true });
    }

    // A listing carrying the source provenance, so fulfilment can buy it later.
    const listing = await store.createListing({
      marketplaceId: HOUSE_MARKETPLACE,
      sellerId: HOUSE_SELLER,
      // The chosen item's own title, not the search text. See the note in
      // relay-demand-search.js on why the raw query was the wrong label to charge against.
      title: (sourceItem.title || search.description || 'Relay sourced item').slice(0, 140),
      price: customerPrice,
      description: 'Sourced on demand for this order. All sales final.',
      category: search.category || 'other',
      // The condition of the item being bought, not the condition that was asked for.
      // 'unspecified' is what an open-web match reports and is not a description we can
      // put in front of a buyer, so it falls through to the request.
      condition: (sourceItem.sourceCondition && sourceItem.sourceCondition !== 'unspecified'
        ? sourceItem.sourceCondition
        : (search.condition || 'used')),
      quantity: 1,
      sourceMarketplace: sourceItem.source,
      sourceId: sourceItem.itemId,
      sourceUrl: sourceItem.sourceUrl,
      // The cost this order was actually priced and authorised against, freight to THIS
      // address included. Recording the search-time number here would hand buyFromCJ a
      // ceiling the order was never priced on.
      sourceCost: effectiveCost,
      // The freight actually quoted to this buyer's address at gate 2, and the warehouse
      // it ships from. Null only for a search recorded before these fields existed, which
      // is the old behaviour, not a new one: buyFromCJ then skips its own requote as
      // it already did.
      sourceShipping: quotedShipping,
      sourceCarrier: quotedCarrier,
      sourceFromCountry: quotedFrom || sourceItem.sourceFromCountry || null,
      sourceProvider: sourceItem.sourceProvider || null,
      marginAtListing: priced.marginFraction,
      sourceVerifiedAt: search.ts || null
    });

    const order = await store.createOrder({
      buyerId: buyerId,
      buyerEmail: body.buyerEmail || null,
      lines: [{ listingId: listing.id, qty: 1, unitPrice: customerPrice, title: listing.title }],
      shipping: 0,
      shippingAddress: shippingAddress
    });
    if (order.error) return res.status(409).json({ error: order.error });

    const payment = await finance.createPayment({
      name: 'Relay · ' + listing.title.slice(0, 60),
      amount: customerPrice,
      orderId: order.id,
      metadata: { listingId: listing.id, buyer: buyerId, searchId: searchId }
    });
    if (!payment.ok) {
      await store.updateOrder(order.id, { status: 'payment-failed', failureReason: payment.error });
      return res.status(payment.needsKey ? 200 : 502).json({ ok: false, error: payment.error, needsKey: payment.needsKey || false });
    }

    // Record the acceptance against this specific order, with the request evidence.
    const acceptance = await policy.recordAcceptance({
      accepted: true,
      buyerId: buyerId,
      orderId: order.id,
      ip: policy.clientIp(req),
      userAgent: (req.headers && req.headers['user-agent']) || null
    });
    if (!acceptance.ok) {
      return res.status(500).json({ error: 'could not record the policy confirmation: ' + acceptance.error });
    }

    await store.updateOrder(order.id, {
      status: 'awaiting-payment',
      paymentLinkId: payment.paymentLinkId,
      policyAcceptance: acceptance.acceptance
    });

    return res.status(200).json({
      ok: true,
      orderId: order.id,
      listingId: listing.id,
      amount: customerPrice,
      url: payment.url,
      policyVersion: acceptance.acceptance.policyVersion,
      // Source cost, source URL and margin are deliberately not in this response.
      message: 'All sales final. Pay at the link to confirm the order.'
    });
  } catch (e) {
    console.error('[relay-demand-purchase]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
