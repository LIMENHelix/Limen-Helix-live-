/**
 * relay-cart-checkout — a whole cart becomes one order and one payment.
 *
 * Reached through Relay's one door: POST /api/relay?view=cart-checkout
 * (this handler has no route of its own; see handlers/relay.js)
 *
 * POST {
 *   items: [{ listingId, qty }],
 *   buyerId?, buyerEmail,
 *   shippingAddress: { name, line1, line2?, city, state, postalCode, country },
 *   policyAccepted: true
 * }
 *   → { ok, orderId, total, url }
 *
 * WHY A SEPARATE ROUTE FROM relay-marketplace-checkout: that one sells exactly one
 * listing. The storefront has a cart, and a cart of second-hand goods is several
 * distinct items from several different source sellers. Splitting it into one order per
 * item would charge the customer several times for one basket, so the order carries
 * `lines` and fulfilment authorises and buys each line on its own.
 *
 * EVERY PRICE IS RECOMPUTED HERE from the stored listing. The client sends listing ids
 * and quantities, never prices. Shipping matches the original Relay storefront: free
 * over $75, otherwise $5.99.
 *
 * THREE REFUSALS, all before any money is involved:
 *   - no final-sale confirmation
 *   - an incomplete shipping address (we cannot ship to a partial address, and eBay's
 *     order API rejects one outright)
 *   - a listing that is inactive, missing, or has no source we could buy it from
 */

const store = require('../lib/relay-store');
const policy = require('../lib/relay-policy');
// The ONLY money call in this file. Relay never imports stripe-rail or finance-ledger
// directly; see the seam described in lib/relay-finance-bridge.js.
const finance = require('../lib/relay-finance-bridge');
// Stock, freight and supplier reachability, rechecked per line before the cart is paid.
const supplier = require('../lib/relay-supplier-quote');
// The same limits fulfilment will apply, asked per line before the cart is paid.
const autonomy = require('../lib/relay-autonomy');




/**
 * WHAT THE SHOPPER IS TOLD, KEYED BY CODE.
 *
 * The 409 used to carry the supplier and gate text verbatim, which leaked landed cost and
 * margin; that was closed by genericising it, and the cost was that every refusal collapsed
 * into one sentence saying nothing actionable. A real customer read "Nothing has been
 * charged. Remove these and try again" with no item named and left.
 *
 * One sentence per code, written for the person who is trying to buy something. Each says
 * what happened and what they can do, and none of them contains a figure, a wallet, a
 * committed total or the word margin. The code stays alongside for the UI to branch on.
 *
 * Anything unrecognised falls back to the honest generic rather than to silence, because a
 * code added later must not render as an empty line.
 */
const CUSTOMER_MESSAGE = {
  'out-of-stock': 'Sold out at our supplier. Remove it to continue.',
  'no-quote': 'We cannot ship this to your address. Try a different address, or remove it.',
  'cost-drift': 'Shipping to your address costs more than when this was listed, so we have not charged you. Remove it to continue.',
  'not-fulfillable': 'We cannot fulfil this item right now. Nothing has been charged.',
  'unconfigured': 'Our supplier is unreachable right now. Please try again shortly.',
  'stale-quote': 'This listing is out of date and needs re-checking. Remove it to continue.',
  'inactive': 'No longer available.',
  'unsourceable': 'No longer available.',
  'over-stock': 'We do not have that many. Lower the quantity to continue.'
};
function customerMessage(code) {
  return CUSTOMER_MESSAGE[code] || 'We cannot sell this right now. Nothing has been charged.';
}
function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function missingAddressFields(a) {
  return ['name', 'line1', 'city', 'state', 'postalCode', 'country']
    .filter(function (k) { return !a || !String(a[k] || '').trim(); });
}

function round(n) { return Math.round(n * 100) / 100; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  const body = await readBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return sendJSON(res, 400, { ok: false, error: 'empty cart' });

  // ── final-sale confirmation ──
  if (body.policyAccepted !== true) {
    const p = policy.getPolicy();
    return sendJSON(res, 400, {
      ok: false,
      error: 'policy not accepted',
      policy: { version: p.version, headline: p.headline, confirmLabel: p.confirmLabel, url: '/api/relay?view=policy' }
    });
  }

  // ── shipping address ──
  const addr = body.shippingAddress || {};
  const missing = missingAddressFields(addr);
  if (missing.length) {
    return sendJSON(res, 400, { ok: false, error: 'shipping address incomplete', missing: missing });
  }
  if (!body.buyerEmail || String(body.buyerEmail).indexOf('@') === -1) {
    return sendJSON(res, 400, { ok: false, error: 'a valid email is required for order updates' });
  }

  // ── resolve every line against the stored listing ──
  const lines = [];
  const unavailable = [];
  let subtotal = 0;
  // What this cart has already committed the day's ceiling to, line by line.
  let plannedSpend = 0;

  // Collapse repeats FIRST. Two entries of the same listing at qty 1 each passed the
  // stock and quantity checks independently, and together asked the supplier for two of
  // something there may be one of. The customer is charged for both.
  const merged = new Map();
  for (const raw of items) {
    const id = raw.listingId || raw.id;
    if (!id) continue;
    const q = Math.max(1, parseInt(raw.qty, 10) || 1);
    merged.set(id, (merged.get(id) || 0) + q);
  }

  for (const [listingId, qty] of merged) {
    const listing = await store.getListing(listingId);

    if (!listing || listing.status !== 'active') {
      unavailable.push({ listingId: listingId, code: 'inactive', reason: customerMessage('inactive') });
      continue;
    }
    // Every Relay listing is sourced. No source URL means nobody can buy it for the
    // customer, so it must not be sold.
    if (!listing.sourceUrl) {
      unavailable.push({ listingId: listingId, code: 'unsourceable', reason: customerMessage('unsourceable') });
      continue;
    }
    if (qty > (listing.quantity || 1)) {
      unavailable.push({ listingId: listingId, code: 'over-stock', reason: customerMessage('over-stock') });
      continue;
    }

    // The listing was published against a freight quote to the supplier's DEFAULT
    // destination and a stock level from whenever the engine discovered it. Neither is a
    // statement about this buyer's address or about today. Charging on them means
    // fulfilment is the first thing to find out (lib/relay-buy.js:199-207 refuses past
    // 10%, and placeOrder is what discovers a sold-out variant), and by then the money is
    // taken. Refusing the line here costs nothing and says so before the cart is paid.
    const check = await supplier.revalidate({
      source: listing.sourceMarketplace,
      sourceId: listing.sourceId,
      sourceCost: listing.sourceCost,
      sourceShipping: listing.sourceShipping,
      sourceCarrier: listing.sourceCarrier,
      sourceFromCountry: listing.sourceFromCountry,
      quantity: qty,
      shippingAddress: addr
    });
    if (!check.ok) {
      // Same rule as the gate below, same reason. cost-drift spells out the per-unit
      // freight quoted against the freight on record, which is our landed cost, and this
      // endpoint takes no key. The CODE stays: unconfigured / stale-quote / out-of-stock /
      // no-quote / cost-drift carry no internal detail and are what the UI branches on.
      // The cost is that 'sold out' and 'only 2 left with the supplier' collapse into one
      // generic line; a caller wanting those words should render them from the code.
      console.warn('[relay-cart] line refused by supplier requote: ' + JSON.stringify({
        listingId: listingId, code: check.code, reason: check.reason
      }));
      unavailable.push({ listingId: listingId, code: check.code, reason: customerMessage(check.code) });
      continue;
    }

    // The same limits fulfilment will apply to this line, asked before the cart is paid.
    // Selling a spread that fails the margin floor means the customer pays and
    // relay-engine.fulfillLine marks the line blocked; asking the real gate in dry-run
    // mode keeps one implementation of those rules instead of a copy that drifts.
    const lineCost = round((check.effectiveCost != null ? check.effectiveCost : listing.sourceCost) * qty);
    const limits = await autonomy.authorize({
      amount: lineCost,
      salePrice: round(listing.price * qty),
      marketplace: listing.sourceMarketplace,
      note: listing.title,
      // A dry run reserves nothing, so every line would otherwise see the same untouched
      // ledger: two $60 lines both pass against $100 remaining, the customer is charged
      // for the cart, and the second REAL authorisation during fulfilment is what finds
      // out — on a paid, half-fulfillable order. Carry what this cart has already
      // committed to so the ceiling is checked against the whole basket.
      plannedToday: plannedSpend,
      // The COUNT as well as the dollars. A dry run writes no ledger row, so every line of
      // a cart saw the same empty window: a four-line cart passed checkout, took the
      // money, and had its fourth line blocked at fulfilment. The basket is refused now,
      // not its tail.
      plannedOrders: lines.length,
      dryRun: true
    });
    if (!limits.allowed) {
      // THE INTERNAL REASON NEVER ENTERS THE RESPONSE.
      //
      // limits.reason is authorize()'s operator text. Depending on which gate refused, it
      // carries the CJ wallet balance, supplier spend already committed, the remaining
      // ceiling, the margin floor, and this item's private acquisition cost. This endpoint
      // is unauthenticated, so forwarding it let any shopper read the supplier margin on
      // any listing by putting it in a cart and reading the 409.
      //
      // Withheld BY CONSTRUCTION, not by redaction. Nothing here inspects the string, so a
      // refusal reason added to authorize() later cannot reintroduce this. The other
      // entries on this path (lines 124-134) already answer the customer in these terms;
      // this was the one that did not.
      //
      // Destination for the detail: the server log, and only the server log. There is no
      // order record to attach it to (store.createOrder is below, after this block
      // returns), so it cannot travel to an order-status surface even in principle.
      console.warn('[relay-cart] line refused by autonomy: ' + JSON.stringify({
        listingId: listingId, reason: limits.reason
      }));
      unavailable.push({ listingId: listingId, code: 'not-fulfillable', reason: customerMessage('not-fulfillable') });
      continue;
    }
    plannedSpend = round(plannedSpend + lineCost);

    subtotal += listing.price * qty;
    lines.push({
      listingId: listing.id, qty: qty, unitPrice: listing.price, title: listing.title,
      // Carried per LINE, not written back to the listing: this is what the supplier
      // quoted for THIS buyer's address, and the listing is a shared catalogue entry that
      // must not inherit one customer's warehouse. relay-engine prefers these over the
      // listing's own when it builds the purchase, so stock that moved to another
      // warehouse ships from the one it was actually quoted and costed against.
      sourceCost: check.effectiveCost != null ? check.effectiveCost : null,
      sourceShipping: check.shipping != null ? check.shipping : null,
      sourceCarrier: check.carrier || null,
      sourceFromCountry: check.fromCountry || null
    });
  }

  if (unavailable.length) {
    return sendJSON(res, 409, {
      ok: false,
      error: 'some items are no longer available',
      message: 'Nothing has been charged. Remove these and try again.',
      unavailable: unavailable
    });
  }
  if (!lines.length || subtotal <= 0) {
    return sendJSON(res, 400, { ok: false, error: 'no valid items in cart' });
  }

  subtotal = round(subtotal);
  // FREIGHT IS ALREADY IN THE PRICE, SO IT IS NOT CHARGED AGAIN HERE.
  //
  // Every source folds supplier freight into the acquisition cost before the engine
  // prices it (lib/relay-cj.js:334 returns product + freight as `price`), and the listing
  // is priced off that landed number. Adding $5.99 on top charged the customer supplier
  // freight a second time, under a name that made it look like a pass-through.
  //
  // Zero, not a smaller number: this also makes the two checkout routes agree, since
  // relay-demand-purchase has always created its orders with shipping: 0. Two routes to
  // the same catalogue quoting different shipping was its own defect.
  //
  // The removed FREE_SHIPPING_OVER threshold went with it. It only existed to waive
  // FLAT_SHIPPING above $75, so with the fee gone it had no remaining reader.
  const shipping = 0;
  const total = round(subtotal + shipping);

  if (!finance.paymentsEnabled()) {
    return sendJSON(res, 200, { ok: false, error: 'payments not enabled yet', needsKey: true });
  }

  // The order exists before the payment link, so a customer who pays is always
  // attached to something we can fulfil.
  const order = await store.createOrder({
    buyerId: body.buyerId || ('guest_' + Date.now().toString(36)),
    buyerEmail: body.buyerEmail,
    lines: lines,
    shipping: shipping,
    shippingAddress: addr
  });
  if (order.error) return sendJSON(res, 409, { ok: false, error: order.error });

  const itemCount = lines.reduce(function (s, l) { return s + l.qty; }, 0);
  const payment = await finance.createPayment({
    name: 'Relay order · ' + itemCount + ' item' + (itemCount === 1 ? '' : 's'),
    amount: total,
    orderId: order.id,
    metadata: { lines: String(lines.length), buyer: order.buyerId }
  });
  // A charge that could not be created must fail the sale. Never tell a customer their
  // order is placed when no payment exists.
  if (!payment.ok) {
    await store.updateOrder(order.id, { status: 'payment-failed', failureReason: payment.error });
    return sendJSON(res, payment.needsKey ? 200 : 502, {
      ok: false, error: payment.error, needsKey: payment.needsKey || false
    });
  }

  const acceptance = await policy.recordAcceptance({
    accepted: true,
    buyerId: order.buyerId,
    orderId: order.id,
    ip: policy.clientIp(req),
    userAgent: (req.headers && req.headers['user-agent']) || null
  });
  if (!acceptance.ok) {
    return sendJSON(res, 500, { ok: false, error: 'could not record the policy confirmation: ' + acceptance.error });
  }

  await store.updateOrder(order.id, {
    status: 'awaiting-payment',
    paymentLinkId: payment.paymentLinkId,
    policyAcceptance: acceptance.acceptance
  });

  return sendJSON(res, 200, {
    ok: true,
    orderId: order.id,
    subtotal: subtotal,
    shipping: shipping,
    total: total,
    url: payment.url,
    policyVersion: acceptance.acceptance.policyVersion
  });
};
