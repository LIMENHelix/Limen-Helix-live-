/**
 * relay-autonomous-purchase.js — Triggered when customer buys on Relay
 *
 * Called from relay-marketplace-checkout when payment succeeds.
 *
 * Loop:
 *   1. Get listing details (source marketplace, source item ID, source cost)
 *   2. Check spend budget (can we afford to buy from source?)
 *   3. Autonomously buy from source (Vinted/Poshmark/eBay API)
 *   4. Route purchase to buyer's address (seller ships directly to customer)
 *   5. Record seller payout (85% in USDC to seller wallet)
 *   6. Capture Relay margin (15% stays with Relay)
 */

const db = require('../lib/limen-db');
const marketplace = require('../lib/relay-marketplace');
const cryptoPayout = require('../lib/relay-crypto-payout');
const spendTracker = require('../lib/relay-spend-tracker');

async function buyFromSource(listing, buyerAddress) {
  if (!listing.sourceMarketplace || !listing.sourceId) {
    throw new Error('No source marketplace info on listing');
  }

  const sourceCost = listing.sourceCost || listing.price * 0.75;  // fallback

  // Check budget before buying
  const canBuy = await spendTracker.canSpend(listing.sourceMarketplace, sourceCost);
  if (!canBuy) {
    throw new Error(`Insufficient budget for ${listing.sourceMarketplace}: need $${sourceCost}`);
  }

  // TODO: Integrate with source marketplace APIs
  // - Vinted: POST /api/v2/orders/create (authenticated)
  // - Poshmark: POST /api/posh-api/offers (authenticated)
  // - eBay: POST /api/v1/buy/order/v1/orders (OAuth)
  //
  // For MVP: record intent, manual fulfillment
  //
  // const sourceBuy = await sourceMarketplaceAPI.purchase({
  //   itemId: listing.sourceId,
  //   shippingAddress: buyerAddress,
  //   autoAccept: true
  // });

  // Record in purchase log
  let purchases = await db.get('relay:autonomous-purchases') || [];
  const purchase = {
    id: 'apurchase_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    listingId: listing.id,
    sourceMarketplace: listing.sourceMarketplace,
    sourceItemId: listing.sourceId,
    sourceCost: sourceCost,
    retailPrice: listing.price,
    buyerAddress: buyerAddress,
    status: 'pending',  // pending → purchased → shipped → delivered
    ts: new Date().toISOString()
  };
  purchases.push(purchase);
  await db.set('relay:autonomous-purchases', purchases);

  // Deduct from budget
  await spendTracker.recordSpend(
    listing.sourceMarketplace,
    sourceCost,
    listing.sourceId,
    listing.title
  );

  return purchase;
}

async function initiateCryptoPayout(listing, buyerPrice) {
  // Get seller (system seller or listing creator)
  const seller = await marketplace.getUser(listing.sellerId);
  if (!seller || !seller.walletAddress) {
    throw new Error('Seller has no wallet address');
  }

  // Calculate split
  const commission = buyerPrice * 0.15;  // Relay keeps 15%
  const sellerPayout = buyerPrice * 0.85;  // Seller gets 85% in USDC

  // Initiate crypto payout
  const payout = await cryptoPayout.sendUSDCToSeller(
    listing.sellerId,
    sellerPayout,
    'polygon'  // or 'solana'
  );

  return {
    commission: Math.round(commission * 100) / 100,
    sellerPayout: Math.round(sellerPayout * 100) / 100,
    payoutId: payout.id
  };
}

async function handleCheckoutSuccess(orderId, buyerId, listingId, buyerPrice, buyerShippingAddress) {
  const result = {
    orderId: orderId,
    status: 'processing',
    steps: []
  };

  try {
    // Get listing
    const listing = await marketplace.getListing(listingId);
    if (!listing) throw new Error('Listing not found');

    result.steps.push({ name: 'listing-retrieved', ok: true });

    // Buy from source marketplace
    const sourcePurchase = await buyFromSource(listing, buyerShippingAddress);
    result.steps.push({ name: 'source-purchase-initiated', ok: true, purchase: sourcePurchase.id });

    // Initiate seller crypto payout
    const cryptoPayment = await initiateCryptoPayout(listing, buyerPrice);
    result.steps.push({ name: 'seller-payout-queued', ok: true, payout: cryptoPayment });

    // Record order with full details
    let orders = await db.get('relay:autonomous-orders') || [];
    orders.push({
      orderId: orderId,
      buyerId: buyerId,
      buyerAddress: buyerShippingAddress,
      listingId: listingId,
      sourceMarketplace: listing.sourceMarketplace,
      sourceCost: listing.sourceCost,
      buyerPaid: buyerPrice,
      relayMargin: cryptoPayment.commission,
      sellerPayoutUSDC: cryptoPayment.sellerPayout,
      payoutId: cryptoPayment.payout,
      status: 'pending-fulfillment',  // pending-fulfillment → shipped → delivered
      ts: new Date().toISOString()
    });
    await db.set('relay:autonomous-orders', orders);

    result.status = 'success';
    result.margin = {
      buyerPaid: buyerPrice,
      sourceCost: listing.sourceCost,
      relayMargin: cryptoPayment.commission,
      profitPercent: ((cryptoPayment.commission / listing.sourceCost) * 100).toFixed(1) + '%'
    };

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
