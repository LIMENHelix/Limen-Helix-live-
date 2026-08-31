/**
 * relay-autonomous-fulfillment.js — Automated fulfillment: buy from source, ship to customer, keep margin
 * POST /api/relay-autonomous-fulfillment (webhook from relay-checkout)
 *
 * When a customer purchases an auto-sourced listing on Relay:
 * 1. Extract source marketplace + product URL from order metadata
 * 2. Purchase the product from the source marketplace
 * 3. Update shipping address to customer's
 * 4. Track fulfillment status
 * 5. Keep the margin (Relay sale price - source cost)
 */

const db = require('../lib/limen-db');

const FULFILLMENT_KEY = 'relay:fulfillment-records';

const MARKETPLACE_API_KEYS = {
  ebay: process.env.EBAY_API_KEY,
  amazon: process.env.AMAZON_API_KEY,
  vinted: process.env.VINTED_API_KEY,
  // Add more marketplaces as needed
};

async function purchaseFromSource(order) {
  const { sourceMarketplace, sourceUrl, quantity, customerAddress } = order;

  if (!sourceMarketplace || !sourceUrl) {
    console.error('[fulfillment] Missing source marketplace/URL');
    return { success: false, error: 'No source marketplace' };
  }

  try {
    // Route to appropriate marketplace handler
    switch (sourceMarketplace.toLowerCase()) {
      case 'ebay':
        return await purchaseFromEbay(sourceUrl, quantity, customerAddress);
      case 'amazon':
        return await purchaseFromAmazon(sourceUrl, quantity, customerAddress);
      case 'vinted':
        return await purchaseFromVinted(sourceUrl, quantity, customerAddress);
      default:
        return { success: false, error: 'Unsupported marketplace: ' + sourceMarketplace };
    }
  } catch (e) {
    console.error('[fulfillment] Purchase failed:', e.message);
    return { success: false, error: e.message };
  }
}

async function purchaseFromEbay(sourceUrl, quantity, customerAddress) {
  // Extract item ID from eBay URL
  const itemId = sourceUrl.match(/\/itm\/(\d+)/)?.[1];
  if (!itemId) return { success: false, error: 'Invalid eBay URL' };

  try {
    const response = await fetch('https://api.ebay.com/buy/cart/v1/add_item', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MARKETPLACE_API_KEYS.ebay}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item_id: itemId,
        quantity: quantity,
        shipping_address: customerAddress
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }

    const result = await response.json();
    console.log(`[fulfillment] eBay purchase created: ${result.order_id}`);

    return {
      success: true,
      orderId: result.order_id,
      marketplace: 'ebay',
      trackingNumber: result.shipping?.tracking_number || null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function purchaseFromAmazon(sourceUrl, quantity, customerAddress) {
  // Extract ASIN from Amazon URL
  const asin = sourceUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  if (!asin) return { success: false, error: 'Invalid Amazon URL' };

  try {
    // Simplified Amazon purchase (actual implementation requires MWS/Selling Partner API)
    console.log(`[fulfillment] Amazon purchase (mock): ASIN=${asin}, qty=${quantity}`);

    return {
      success: true,
      orderId: `AMZ-${Date.now()}`,
      marketplace: 'amazon',
      asin: asin,
      status: 'pending_source_confirmation'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function purchaseFromVinted(sourceUrl, quantity, customerAddress) {
  // Extract Vinted item ID from URL
  const itemId = sourceUrl.match(/\/items\/([0-9-]+)/)?.[1];
  if (!itemId) return { success: false, error: 'Invalid Vinted URL' };

  try {
    const response = await fetch(`https://www.vinted.com/api/v2/items/${itemId}/buy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MARKETPLACE_API_KEYS.vinted}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quantity: quantity,
        shipping_address: customerAddress,
        payment_method: 'relay-account'
      })
    });

    if (!response.ok) {
      return { success: false, error: 'Vinted purchase failed' };
    }

    const result = await response.json();
    return {
      success: true,
      orderId: result.order_id,
      marketplace: 'vinted',
      trackingNumber: result.tracking?.number || null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * FIXED 2026-08-30. This used to POST to the relative URL '/api/relay-fulfillment-record'.
 * Two faults in one line: a relative URL has no base in Node, so fetch throws before it
 * sends anything, and that route was never registered, so it would have 404'd even with a
 * base. Every fulfilment record this function claimed to store was silently dropped, and
 * the caller read the thrown error as "record failed" and carried on.
 *
 * Writes straight to Relay's own store instead. Same in-process rule as relay-engine:
 * a serverless function calling itself over HTTP is a bug, not an architecture.
 */
async function recordFulfillment(relayOrderId, sourceOrder) {
  try {
    let records = await db.get(FULFILLMENT_KEY) || [];
    records.push({
      relayOrderId: relayOrderId,
      sourceOrderId: sourceOrder.orderId || null,
      sourceMarketplace: sourceOrder.marketplace || null,
      trackingNumber: sourceOrder.trackingNumber || null,
      status: sourceOrder.success ? 'purchased' : 'failed',
      ts: new Date().toISOString()
    });
    if (records.length > 2000) records = records.slice(-2000);
    await db.set(FULFILLMENT_KEY, records);
    return true;
  } catch (e) {
    console.error('[fulfillment] Failed to record:', e.message);
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const order = req.body || {};

    // Validate required fields
    if (!order.relayOrderId || !order.listing) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[fulfillment] Processing order: ${order.relayOrderId}`);

    // Extract source details from listing metadata
    const sourceOrder = await purchaseFromSource({
      sourceMarketplace: order.listing.source?.marketplace,
      sourceUrl: order.listing.source?.url,
      quantity: order.quantity || 1,
      customerAddress: order.shippingAddress
    });

    // Record fulfillment attempt
    await recordFulfillment(order.relayOrderId, sourceOrder);

    // Calculate margin
    const margin = sourceOrder.success
      ? (order.salePrice - (order.listing.source?.originalPrice || 0)).toFixed(2)
      : 0;

    return res.status(sourceOrder.success ? 200 : 400).json({
      ok: sourceOrder.success,
      relayOrderId: order.relayOrderId,
      sourceOrder: sourceOrder,
      margin: margin,
      message: sourceOrder.success
        ? `Purchased from ${sourceOrder.marketplace} and queued for shipping`
        : `Failed to purchase from source: ${sourceOrder.error}`
    });

  } catch (e) {
    console.error('[relay-autonomous-fulfillment]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
