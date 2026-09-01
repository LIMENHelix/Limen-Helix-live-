/**
 * relay-store.js — Relay's OWN listings and orders. Nothing else reads or writes these.
 *
 * ── WHY THIS EXISTS: THE FIREWALL ───────────────────────────────────────────────────
 * lib/relay-marketplace.js is named for Relay but it is NOT Relay's alone. The TRADE
 * domain uses it as its auction listing store (handlers/trade-auction-cycle.js and
 * trade-auction-recovery.js pass it in as `marketplace`), and lib/trade-auction-observer.js
 * independently verifies its own published auctions by reading
 * /api/relay-marketplace?action=list-listings and checking contentHash, saleMode,
 * bindingSaleAuthorized, orderAcceptanceAuthorized and paymentAuthorized on each row.
 *
 * That was found the hard way: adding a customer-safe allow-list to that shared module
 * dropped four of those five fields, which would have made the trade observer report
 * PUBLIC_LISTING_ABSENCE_OR_MISMATCH_OBSERVED for every auction it had just successfully
 * published. A Relay feature would have silently broken a different domain's verification
 * loop.
 *
 * So Relay stops sharing. This module owns:
 *   relay:store:listings     Relay listings, with sourcing provenance
 *   relay:store:orders       Relay orders, with multi-line carts
 * Distinct keys from relay:listings / relay:orders, which stay entirely trade's.
 *
 * RULES THIS MODULE KEEPS:
 *   1. It never touches a key outside the relay:store: namespace.
 *   2. Nothing outside Relay imports it. If that ever changes, the firewall is gone.
 *   3. publicListing is an ALLOW-list. Source cost and source URL cannot leave by accident.
 *   4. It knows nothing about money. Payments go through lib/relay-finance-bridge.
 */

const db = require('./limen-db');

const LISTINGS_KEY = 'relay:store:listings';
const ORDERS_KEY = 'relay:store:orders';

function _id(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
function _now() { return new Date().toISOString(); }
function _round(n) { return Math.round(n * 100) / 100; }

// ── listings ────────────────────────────────────────────────────────────────

async function createListing(data) {
  data = data || {};
  const l = {
    id: _id('rls'),
    marketplaceId: data.marketplaceId || null,
    sellerId: data.sellerId || null,
    title: String(data.title || '').slice(0, 200),
    price: Math.max(0.5, parseFloat(data.price) || 0),
    description: data.description || '',
    images: Array.isArray(data.images) ? data.images : [],
    category: data.category || 'other',
    condition: data.condition || 'used',
    quantity: parseInt(data.quantity, 10) || 1,

    // Sourcing provenance. PRIVATE: never returned by publicListing.
    sourceMarketplace: data.sourceMarketplace || null,
    sourceId: data.sourceId || null,
    sourceUrl: data.sourceUrl || null,
    sourceCost: data.sourceCost != null ? parseFloat(data.sourceCost) : null,
    sourceProvider: data.sourceProvider || null,
    // The carrier the freight quote was based on. Ordering without it lets the supplier
    // pick a different service at a different price than the one we authorised.
    sourceCarrier: data.sourceCarrier || null,
    sourceFromCountry: data.sourceFromCountry || null,
    sourceShipping: data.sourceShipping != null ? parseFloat(data.sourceShipping) : null,
    sourceVerifiedAt: data.sourceVerifiedAt || null,
    marginAtListing: data.marginAtListing != null ? parseFloat(data.marginAtListing) : null,
    referenceImage: data.referenceImage || null,

    status: 'active',
    ts: _now()
  };
  const ls = await db.get(LISTINGS_KEY) || {};
  ls[l.id] = l;
  await db.set(LISTINGS_KEY, ls);
  return l;
}

async function getListing(listingId) {
  const ls = await db.get(LISTINGS_KEY) || {};
  return ls[listingId] || null;
}

async function updateListing(listingId, updates) {
  const ls = await db.get(LISTINGS_KEY) || {};
  if (!ls[listingId]) return null;
  ls[listingId] = Object.assign(ls[listingId], updates);
  await db.set(LISTINGS_KEY, ls);
  return ls[listingId];
}

async function activeListings(limit) {
  const ls = await db.get(LISTINGS_KEY) || {};
  return Object.values(ls)
    .filter(function (l) { return l.status === 'active'; })
    .sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, limit || 200);
}

async function allListings() {
  const ls = await db.get(LISTINGS_KEY) || {};
  return Object.values(ls);
}

/**
 * The ONLY shape a listing may take on its way to a browser.
 *
 * ALLOW-list, not a deny-list: a field added to createListing later stays private until
 * someone deliberately adds it here. Getting this backwards publishes what we paid and
 * where we bought it, which ends the business.
 */
function publicListing(l) {
  if (!l) return null;
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    description: l.description,
    images: Array.isArray(l.images) ? l.images : [],
    category: l.category,
    condition: l.condition,
    quantity: l.quantity,
    status: l.status,
    ts: l.ts
  };
}

function publicListings(list) {
  return (Array.isArray(list) ? list : []).map(publicListing);
}

// ── orders ──────────────────────────────────────────────────────────────────

/**
 * A cart is one order with several lines, because each second-hand item is bought from
 * a different seller but the customer pays once. Fulfilment authorises each line on its
 * own; see lib/relay-engine.
 */
async function createOrder(data) {
  data = data || {};
  const lines = (Array.isArray(data.lines) ? data.lines : []).map(function (l) {
    return {
      listingId: l.listingId,
      qty: parseInt(l.qty, 10) || 1,
      unitPrice: _round(parseFloat(l.unitPrice) || 0),
      title: l.title || ''
    };
  });
  if (!lines.length) return { error: 'an order needs at least one line' };

  const subtotal = _round(lines.reduce(function (s, l) { return s + l.unitPrice * l.qty; }, 0));
  const shipping = _round(parseFloat(data.shipping) || 0);

  const o = {
    id: _id('rord'),
    buyerId: data.buyerId || null,
    buyerEmail: data.buyerEmail || null,
    lines: lines,
    subtotal: subtotal,
    shipping: shipping,
    total: _round(subtotal + shipping),
    shippingAddress: data.shippingAddress || null,
    policyAcceptance: data.policyAcceptance || null,
    paymentLinkId: data.paymentLinkId || null,
    status: 'pending',        // pending -> awaiting-payment -> paid -> shipped
    fulfillment: null,
    ts: _now()
  };

  const os = await db.get(ORDERS_KEY) || {};
  os[o.id] = o;
  await db.set(ORDERS_KEY, os);
  return o;
}

async function getOrder(orderId) {
  const os = await db.get(ORDERS_KEY) || {};
  return os[orderId] || null;
}

async function updateOrder(orderId, updates) {
  const os = await db.get(ORDERS_KEY) || {};
  if (!os[orderId]) return null;
  os[orderId] = Object.assign(os[orderId], updates);
  await db.set(ORDERS_KEY, os);
  return os[orderId];
}

async function ordersByStatus(status, limit) {
  const os = await db.get(ORDERS_KEY) || {};
  return Object.values(os)
    .filter(function (o) { return !status || o.status === status; })
    .sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, limit || 200);
}

async function orderHistory(limit) {
  return ordersByStatus(null, limit);
}

module.exports = {
  LISTINGS_KEY,
  ORDERS_KEY,
  createListing, getListing, updateListing, activeListings, allListings,
  publicListing, publicListings,
  createOrder, getOrder, updateOrder, ordersByStatus, orderHistory
};
