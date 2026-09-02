/**
 * api/relay-stripe-webhook — Stripe webhook for Relay marketplace payments
 *
 * Listens for successful Stripe payment events:
 * - charge.succeeded (payment confirmed)
 * - checkout.session.completed (payment session complete)
 *
 * On success:
 * 1. Confirm order (mark as 'paid')
 * 2. Record commission income (finance ledger, streamId: 'relay-commission')
 * 3. Create pending seller payout (for operator approval + Stride Connect)
 * 4. Record franchise fee income (streamId: 'relay-franchise-fee')
 */

const crypto = require('crypto');
const marketplace = require('../lib/relay-marketplace');
const ledger = require('../lib/finance-ledger');
const autonomousPurchase = require('../handlers/relay-autonomous-purchase');

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// Verify Stripe webhook signature
function verifyWebhookSignature(req, body) {
  const sig = req.headers['stripe-signature'] || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) {
    console.warn('[relay-webhook] STRIPE_WEBHOOK_SECRET not set');
    return true; // Allow through if no secret (dev mode)
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const tolerance = 300; // 5 minutes

    // Parse signature header: t=timestamp,v1=signature
    const parts = sig.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});

    const sigTs = parseInt(parts.t, 10);
    if (Math.abs(timestamp - sigTs) > tolerance) {
      console.warn('[relay-webhook] Webhook signature timestamp outside tolerance');
      return false;
    }

    const toSign = sigTs + '.' + body;
    const computed = crypto.createHmac('sha256', secret).update(toSign).digest('hex');
    return computed === parts.v1;
  } catch (e) {
    console.error('[relay-webhook] Signature verification failed:', e.message);
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if ((req.method || 'GET') === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJSON(res, 405, { error: 'POST only' });
  }

  // Read raw body for signature verification
  let body = '';
  await new Promise(function (resolve) {
    req.on('data', function (chunk) { body += chunk.toString(); });
    req.on('end', resolve);
    req.on('error', resolve);
  });

  // FAILS CLOSED. This used to read
  //   if (process.env.STRIPE_WEBHOOK_SECRET && !verifyWebhookSignature(req, body))
  // so with the secret unset the check was skipped entirely and ANY unauthenticated POST
  // reached handleCheckoutSuccess -> relay-engine.fulfillPaidOrder -> cj.placeOrder,
  // which spends from the prepaid wallet. The autonomy gate and queue mode limited the
  // damage, but those are configuration, not authentication.
  //
  // A webhook with no configured secret cannot be authenticated, so it is refused.
  // Matches relay-autonomous-control.js:293-299.
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[relay-webhook] refused: STRIPE_WEBHOOK_SECRET is not set');
    return sendJSON(res, 503, { error: 'webhook not configured' });
  }
  if (!verifyWebhookSignature(req, body)) {
    return sendJSON(res, 403, { error: 'invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch (e) {
    return sendJSON(res, 400, { error: 'invalid JSON' });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      // payment_intent.succeeded is most reliable for payment_links
      await handlePaymentIntentSucceeded(event.data.object);
    } else if (event.type === 'charge.succeeded') {
      await handleChargeSucceeded(event.data.object);
    } else if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event.data.object);
    } else {
      console.log('[relay-webhook] Ignoring event type:', event.type);
    }

    return sendJSON(res, 200, { ok: true, eventId: event.id });
  } catch (e) {
    console.error('[relay-webhook] Error processing event:', e.message);
    return sendJSON(res, 500, { error: 'processing failed', msg: e.message });
  }
};

async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('[relay-webhook] payment_intent.succeeded:', paymentIntent.id, paymentIntent.amount / 100);

  // payment_intent.metadata has our order info
  const orderId = paymentIntent.metadata && paymentIntent.metadata.orderId;
  const marketplaceId = paymentIntent.metadata && paymentIntent.metadata.marketplace;

  if (!orderId || !marketplaceId) {
    console.warn('[relay-webhook] payment_intent.succeeded missing orderId or marketplaceId', paymentIntent.id);
    return;
  }

  // Get the order to extract commission/payout info
  const order = await marketplace.getOrder(orderId);
  if (!order) {
    console.warn('[relay-webhook] order not found:', orderId);
    return;
  }

  // Mark order as paid
  await marketplace.updateOrder(orderId, { status: 'paid', stripePaymentId: paymentIntent.id });

  // Record commission income to ledger
  await ledger.record({
    type: 'income',
    streamId: 'relay-commission',
    amount: order.commission,
    source: 'stripe-payment-intent',
    meta: { paymentIntentId: paymentIntent.id, orderId: orderId, marketplace: marketplaceId }
  });

  // Record franchise fee income
  await ledger.record({
    type: 'income',
    streamId: 'relay-franchise-fee',
    amount: order.franchiseFee,
    source: 'stripe-payment-intent',
    meta: { paymentIntentId: paymentIntent.id, orderId: orderId, marketplace: marketplaceId }
  });

  // Mark payout as ready (next step: Stride Connect will execute it after operator approval)
  // Find and update the pending payout record created during checkout
  console.log('[relay-webhook] Order', orderId, 'confirmed: commission=$' + order.commission.toFixed(2) + ', seller-payout=$' + order.sellerPayout.toFixed(2));

  // Model 3: Trigger autonomous purchase + crypto payout
  try {
    const listing = await marketplace.getListing(order.listingId);
    const buyer = await marketplace.getUser(order.buyerId);
    if (listing && buyer) {
      const purchaseResult = await autonomousPurchase.handleCheckoutSuccess(
        orderId,
        order.buyerId,
        order.listingId,
        order.subtotal,
        buyer.shippingAddress || 'pending'
      );
      console.log('[relay-webhook] Autonomous purchase initiated:', purchaseResult.status);
    }
  } catch (e) {
    console.error('[relay-webhook] Autonomous purchase failed (non-blocking):', e.message);
  }
}

async function handleChargeSucceeded(charge) {
  console.log('[relay-webhook] charge.succeeded:', charge.id, charge.amount_captured / 100);

  // Try to get order info from charge metadata (might not be propagated by Stripe)
  // Fall back to looking in the payment_intent metadata
  let orderId = charge.metadata && charge.metadata.orderId;
  let marketplaceId = charge.metadata && charge.metadata.marketplace;

  if (!orderId && charge.payment_intent) {
    // Payment intent might have the metadata
    // In a full implementation, we'd fetch the payment_intent from Stripe API
    console.warn('[relay-webhook] charge metadata missing, would need to fetch payment_intent');
    return;
  }

  if (!orderId || !marketplaceId) {
    console.warn('[relay-webhook] charge.succeeded missing orderId or marketplaceId', charge.id);
    return;
  }

  // Get the order to extract commission/payout info
  const order = await marketplace.getOrder(orderId);
  if (!order) {
    console.warn('[relay-webhook] order not found:', orderId);
    return;
  }

  // Mark order as paid
  await marketplace.updateOrder(orderId, { status: 'paid', stripePaymentId: charge.id });

  // Record commission income to ledger
  await ledger.record({
    type: 'income',
    streamId: 'relay-commission',
    amount: order.commission,
    source: 'stripe-charge',
    meta: { chargeId: charge.id, orderId: orderId, marketplace: marketplaceId }
  });

  // Record franchise fee income
  await ledger.record({
    type: 'income',
    streamId: 'relay-franchise-fee',
    amount: order.franchiseFee,
    source: 'stripe-charge',
    meta: { chargeId: charge.id, orderId: orderId, marketplace: marketplaceId }
  });

  // Update pending payout to mark as 'ready' (waiting for operator approval)
  // In a real system, we'd find the payout record and mark it as approved/processing
  console.log('[relay-webhook] Order', orderId, 'confirmed: commission=$' + order.commission.toFixed(2) + ', seller-payout=$' + order.sellerPayout.toFixed(2));
}

async function handleCheckoutSessionCompleted(session) {
  console.log('[relay-webhook] checkout.session.completed:', session.id, session.amount_total / 100);

  // For payment_links, the metadata is stored differently
  // This is a fallback in case we use checkout sessions instead
  const orderId = session.metadata && session.metadata.orderId;
  if (orderId) {
    const order = await marketplace.getOrder(orderId);
    if (order) {
      await marketplace.updateOrder(orderId, { status: 'paid', stripePaymentId: session.payment_intent });
      console.log('[relay-webhook] Order', orderId, 'marked as paid via checkout session');
    }
  }
}
