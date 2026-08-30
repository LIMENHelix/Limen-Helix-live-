/**
 * relay-autonomous-purchase.js — a paid Relay order becomes a real purchase from the source.
 *
 * Not an HTTP route. Called by the Stripe webhook path and by the engine's order sweep.
 * The export surface is unchanged so existing callers keep working.
 *
 * REWRITTEN 2026-08-30. Three things were wrong with the previous version:
 *
 *  1. It never bought anything. buyFromSource() had the purchase commented out as a TODO
 *     and wrote a 'pending' row, but it returned as though the buy had happened, so the
 *     caller recorded a successful fulfilment for an item nobody had ordered.
 *
 *  2. It paid out 85% of the sale in USDC to listing.sellerId on EVERY order. On an
 *     auto-sourced listing the seller is Relay's own house account: there is no third
 *     party owed anything, because the money owed goes to the SOURCE marketplace when we
 *     buy the item. Firing that payout on an arbitrage order sends 85% of the sale out
 *     the door and then still owes the source cost. That path now runs only for a
 *     genuine third-party seller listing (one with no sourceUrl).
 *
 *  3. Nothing capped the spend. Every purchase now passes lib/relay-autonomy first.
 */

const db = require('../lib/limen-db');
const marketplace = require('../lib/relay-marketplace');
const engine = require('../lib/relay-engine');
const cryptoPayout = require('../lib/relay-crypto-payout');

/**
 * Source an order. Thin wrapper over the engine so the gate, the price re-check and the
 * ledger settle all happen in one place.
 */
async function buyFromSource(listing, buyerAddress, orderId) {
  if (!listing) throw new Error('listing required');
  if (!orderId) throw new Error('orderId required: purchases are authorised per order');
  return await engine.fulfillPaidOrder({ orderId: orderId, shippingAddress: buyerAddress });
}

/**
 * Pay a real third-party seller. Only valid when the listing is somebody's own item.
 * An auto-sourced listing has no seller to pay, and calling this on one is a straight loss.
 */
async function initiateCryptoPayout(listing, buyerPrice) {
  if (listing.sourceUrl) {
    return { skipped: true, reason: 'auto-sourced listing: the counterparty is the source marketplace, not a seller' };
  }
  const seller = await marketplace.getUser(listing.sellerId);
  if (!seller || !seller.walletAddress) {
    throw new Error('Seller has no wallet address');
  }
  const commission = Math.round(buyerPrice * 0.15 * 100) / 100;
  const sellerPayout = Math.round(buyerPrice * 0.85 * 100) / 100;
  const payout = await cryptoPayout.sendUSDCToSeller(listing.sellerId, sellerPayout, 'polygon');
  return { commission: commission, sellerPayout: sellerPayout, payoutId: payout.id };
}

/**
 * The full post-payment sequence for one order.
 * Returns { status: 'success' | 'queued' | 'manual-required' | 'failed', steps, margin }.
 * 'success' is only ever returned when money actually moved at the source.
 */
async function handleCheckoutSuccess(orderId, buyerId, listingId, buyerPrice, buyerShippingAddress) {
  const result = { orderId: orderId, status: 'processing', steps: [] };

  try {
    const listing = await marketplace.getListing(listingId);
    if (!listing) throw new Error('Listing not found');
    result.steps.push({ name: 'listing-retrieved', ok: true });

    if (listing.sourceUrl) {
      // Arbitrage path: buy the item, keep the spread. No seller payout.
      const f = await engine.fulfillPaidOrder({
        orderId: orderId,
        shippingAddress: buyerShippingAddress
      });

      result.steps.push({
        name: 'source-purchase',
        ok: f.ok,
        state: f.state || null,
        error: f.error || null
      });

      const sourceCost = parseFloat(listing.sourceCost) || 0;
      result.margin = {
        buyerPaid: buyerPrice,
        sourceCost: sourceCost,
        relayMargin: Math.round((buyerPrice - sourceCost) * 100) / 100,
        marginPercent: buyerPrice > 0
          ? (((buyerPrice - sourceCost) / buyerPrice) * 100).toFixed(1) + '%'
          : '0%'
      };

      if (f.ok) {
        result.status = 'success';
      } else if (f.state === 'awaiting-approval') {
        result.status = 'queued';
      } else if (f.state === 'manual-required') {
        result.status = 'manual-required';
        result.task = f.task || null;
      } else {
        result.status = 'failed';
        result.error = f.error || 'purchase did not complete';
      }
    } else {
      // Peer-to-peer path: a real person sold their own item, so they get paid.
      const payoutInfo = await initiateCryptoPayout(listing, buyerPrice);
      result.steps.push({ name: 'seller-payout-queued', ok: true, payout: payoutInfo });
      result.status = 'success';
      result.margin = {
        buyerPaid: buyerPrice,
        relayMargin: payoutInfo.commission,
        sellerPayout: payoutInfo.sellerPayout
      };
    }

    let orders = await db.get('relay:autonomous-orders') || [];
    orders.push({
      orderId: orderId,
      buyerId: buyerId,
      buyerAddress: buyerShippingAddress,
      listingId: listingId,
      sourceMarketplace: listing.sourceMarketplace || null,
      sourceCost: listing.sourceCost || null,
      buyerPaid: buyerPrice,
      relayMargin: (result.margin && result.margin.relayMargin) || 0,
      status: result.status,
      ts: new Date().toISOString()
    });
    if (orders.length > 2000) orders = orders.slice(-2000);
    await db.set('relay:autonomous-orders', orders);
  } catch (e) {
    console.error('[relay-autonomous-purchase]', e.message);
    result.status = 'failed';
    result.error = e.message;
  }

  return result;
}

module.exports = {
  buyFromSource,
  initiateCryptoPayout,
  handleCheckoutSuccess
};
