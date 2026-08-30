/**
 * api/relay-marketplace-checkout — Marketplace checkout
 *
 * POST { marketplaceId, buyerId, listingId, quantity }
 *   → fetch listing + marketplace, calculate commission split
 *   → create Stripe payment link for buyer-pays-full amount
 *   → ledger records: commission → marketplace owner, payout pending → seller
 *   → return { ok, url, orderId, summary }
 *
 * Stripe webhook (relay-checkout-webhook) processes payment + records income
 * → auto-deposits commission to marketplace owner's account
 * → creates 'pending' seller payout (human approval needed for actual payout)
 */

const marketplace = require('../lib/relay-marketplace');
const stripe = require('../lib/stripe-rail');
const ledger = require('../lib/finance-ledger');
const policy = require('../lib/relay-policy');

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  if (!stripe.hasKey()) return sendJSON(res, 200, { ok: false, error: 'payments not configured', needsKey: true });

  const body = await readBody(req);
  const marketplaceId = body.marketplaceId || '';
  const buyerId = body.buyerId || '';
  const listingId = body.listingId || '';
  const quantity = Math.max(1, parseInt(body.quantity) || 1);

  if (!marketplaceId || !buyerId || !listingId) {
    return sendJSON(res, 400, { ok: false, error: 'marketplaceId, buyerId, listingId required' });
  }

  // All sales are final, so the confirmation is what makes that enforceable. No tick,
  // no order. The accepted version + hash are recorded on the order below.
  if (body.policyAccepted !== true) {
    const p = policy.getPolicy();
    return sendJSON(res, 400, {
      ok: false,
      error: 'policy not accepted',
      policy: { version: p.version, headline: p.headline, confirmLabel: p.confirmLabel, url: '/api/relay-policy' }
    });
  }

  // Load marketplace & listing
  const mkt = await marketplace.getMarketplace(marketplaceId);
  if (!mkt) return sendJSON(res, 404, { ok: false, error: 'marketplace not found' });

  const listing = await marketplace.getListing(listingId);
  if (!listing || listing.status !== 'active') {
    return sendJSON(res, 404, { ok: false, error: 'listing not found or inactive' });
  }
  if (listing.marketplaceId !== marketplaceId) {
    return sendJSON(res, 400, { ok: false, error: 'listing not in this marketplace' });
  }

  // Calculate order totals
  const subtotal = Math.round(listing.price * quantity * 100) / 100;
  const commission = Math.round(subtotal * (mkt.commissionRate || 0.15) * 100) / 100;
  const franchiseFee = Math.round(subtotal * (mkt.franchiseFeeRate || 0.05) * 100) / 100;
  const sellerPayout = subtotal - commission - franchiseFee;

  // Create order record (status = pending)
  const order = await marketplace.createOrder({
    marketplaceId: marketplaceId,
    buyerId: buyerId,
    sellerId: listing.sellerId,
    listingId: listingId,
    subtotal: subtotal
  });

  // Create Stripe payment link (buyer pays full subtotal)
  // Pass metadata so webhook can find the order
  const link = await stripe.createPaymentLink({
    name: 'Relay order · ' + listing.title.slice(0, 60) + ' × ' + quantity,
    amount: subtotal,
    streamId: 'relay-order',  // tagged in finance ledger
    currency: 'usd',
    metadata: {
      orderId: order.id,
      marketplace: marketplaceId,
      seller: listing.sellerId,
      buyer: buyerId
    }
  });
  if (!link.ok) {
    return sendJSON(res, 502, { ok: false, error: link.error });
  }

  // Record the final-sale confirmation against this order, with the request evidence a
  // card network asks for when a buyer disputes having agreed to it.
  const acceptance = await policy.recordAcceptance({
    accepted: true,
    buyerId: buyerId,
    orderId: order.id,
    ip: policy.clientIp(req),
    userAgent: (req.headers && req.headers['user-agent']) || null
  });
  if (!acceptance.ok) {
    return sendJSON(res, 500, { ok: false, error: 'could not record the policy confirmation: ' + acceptance.error });
  }

  // Update order with payment link
  await marketplace.updateOrder(order.id, {
    paymentLinkId: link.paymentLinkId,
    status: 'awaiting-payment',
    shippingAddress: body.shippingAddress || null,
    buyerEmail: body.buyerEmail || null,
    policyAcceptance: acceptance.acceptance
  });

  // Create pending payout record for seller (human approval later)
  const payout = await marketplace.createPayout({
    userId: listing.sellerId,
    marketplaceId: marketplaceId,
    type: 'seller',
    amount: sellerPayout,
    orderId: order.id,
    reason: 'Sale: ' + listing.title
  });

  // Pre-record ledger entries (will be confirmed by Stripe webhook)
  await ledger.record({
    type: 'income',
    streamId: 'relay-order',
    amount: subtotal,
    source: 'stripe-pending',
    meta: { orderId: order.id, marketplace: marketplaceId, buyer: buyerId, seller: listing.sellerId }
  });

  return sendJSON(res, 200, {
    ok: true,
    url: link.url,
    orderId: order.id,
    payoutId: payout.id,
    summary: {
      subtotal: subtotal,
      commission: commission,
      franchiseFee: franchiseFee,
      sellerPayout: sellerPayout,
      commissionRate: (mkt.commissionRate * 100).toFixed(1) + '%',
      franchiseFeeRate: (mkt.franchiseFeeRate * 100).toFixed(1) + '%'
    }
  });
};
