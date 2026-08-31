/**
 * relay-autonomous-purchase.js — a paid Relay order becomes a real purchase from source.
 *
 * Not an HTTP route. Called after payment and by the engine's order sweep.
 *
 * REWRITTEN 2026-08-30, then narrowed for the firewall. Three faults in the original:
 *
 *  1. It never bought anything. buyFromSource() had the purchase commented out as a TODO
 *     but returned as though it had happened, so the caller recorded a successful
 *     fulfilment for an item nobody had ordered.
 *
 *  2. It paid out 85% of every sale in USDC to listing.sellerId. On a sourced listing the
 *     seller is Relay itself: there is no third party owed anything, because what is owed
 *     goes to the source marketplace when we buy the item. Firing that payout sent 85% of
 *     the sale out and still owed the source cost.
 *
 *  3. Nothing capped the spend.
 *
 * THE PAYOUT PATH IS GONE, NOT FIXED. Relay is an arbitrage storefront: it buys an item
 * and resells it. It has no third-party sellers to pay, so it has no business importing a
 * payout rail at all. Dropping it removes an outbound edge from Relay to the rest of the
 * system, which is the point of the firewall. Money only ever moves through
 * lib/relay-finance-bridge (in) and lib/relay-buy under lib/relay-autonomy's caps (out).
 */

const db = require('./../lib/limen-db');
const store = require('../lib/relay-store');
const engine = require('../lib/relay-engine');

/**
 * Source an order. Thin wrapper over the engine so the gate, the price re-check and the
 * ledger settle all happen in one place.
 */
async function buyFromSource(listing, buyerAddress, orderId) {
  if (!orderId) throw new Error('orderId required: purchases are authorised per order');
  return await engine.fulfillPaidOrder({ orderId: orderId, shippingAddress: buyerAddress });
}

/**
 * The full post-payment sequence for one order.
 * Returns { status: 'success' | 'queued' | 'manual-required' | 'partial' | 'failed' }.
 * 'success' is only ever returned when money actually moved at the source.
 */
async function handleCheckoutSuccess(orderId, buyerId, listingId, buyerPrice, buyerShippingAddress) {
  const result = { orderId: orderId, status: 'processing', steps: [] };

  try {
    const order = await store.getOrder(orderId);
    if (!order) throw new Error('order not found');
    result.steps.push({ name: 'order-retrieved', ok: true, lines: (order.lines || []).length });

    const f = await engine.fulfillPaidOrder({
      orderId: orderId,
      shippingAddress: buyerShippingAddress || order.shippingAddress
    });

    result.steps.push({ name: 'source-purchase', ok: f.ok, state: f.state || null, error: f.error || null });

    // Source cost is summed from the listings, never from anything the client sent.
    let sourceCostTotal = 0;
    for (const line of (order.lines || [])) {
      const l = await store.getListing(line.listingId);
      if (l && l.sourceCost) sourceCostTotal += l.sourceCost * (line.qty || 1);
    }
    sourceCostTotal = Math.round(sourceCostTotal * 100) / 100;
    const paid = parseFloat(buyerPrice) || order.total || 0;

    result.margin = {
      buyerPaid: paid,
      sourceCost: sourceCostTotal,
      relayMargin: Math.round((paid - sourceCostTotal) * 100) / 100,
      marginPercent: paid > 0 ? (((paid - sourceCostTotal) / paid) * 100).toFixed(1) + '%' : '0%'
    };

    if (f.ok) result.status = 'success';
    else if (f.state === 'awaiting-approval') result.status = 'queued';
    else if (f.state === 'manual-required') { result.status = 'manual-required'; result.task = f.task || null; }
    else if (f.state === 'partial') result.status = 'partial';
    else { result.status = 'failed'; result.error = f.error || 'purchase did not complete'; }

    let log = await db.get('relay:autonomous-orders') || [];
    log.push({
      orderId: orderId,
      buyerId: buyerId || order.buyerId,
      listingId: listingId || (order.lines && order.lines[0] && order.lines[0].listingId) || null,
      buyerPaid: paid,
      sourceCost: sourceCostTotal,
      relayMargin: result.margin.relayMargin,
      status: result.status,
      ts: new Date().toISOString()
    });
    if (log.length > 2000) log = log.slice(-2000);
    await db.set('relay:autonomous-orders', log);
  } catch (e) {
    console.error('[relay-autonomous-purchase]', e.message);
    result.status = 'failed';
    result.error = e.message;
  }

  return result;
}

module.exports = { buyFromSource, handleCheckoutSuccess };
