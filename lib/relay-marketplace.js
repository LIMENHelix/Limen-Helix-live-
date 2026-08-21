/**
 * relay-marketplace.js — Relay C2C Marketplace engine
 *
 * Manages:
 *   - Marketplaces (franchise instances with their own commission rates & fee structures)
 *   - Users (sellers & buyers)
 *   - Listings (items for sale by sellers)
 *   - Orders (buyer purchases, commission split, seller payout)
 *   - Payouts (track seller & franchise earnings, pending approvals)
 *
 * All data persisted to Redis via limen-db (JSON serialized, prefixed with 'relay:').
 */

const db = require('./limen-db');

// ═══════════════════════════════════════════════════════════════════════
// SCHEMA & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const MARKETPLACE_KEY = 'relay:marketplaces';              // list of { id, name, commissionRate, franchiseFeeRate, domain, owner }
const USERS_KEY = 'relay:users';                           // { userId: { id, email, name, role, stripeAccountId, phone, ts } }
const LISTINGS_KEY = 'relay:listings';                     // { listingId: { id, marketplaceId, sellerId, title, price, description, images, category, ts } }
const ORDERS_KEY = 'relay:orders';                         // list of { id, marketplaceId, buyerId, sellerId, listingId, subtotal, commission, sellerPayout, franchiseFee, status, ts }
const PAYOUTS_KEY = 'relay:payouts';                       // list of { id, userId, type, amount, marketplaceId, status, ts }

function _id(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
function _now() { return new Date().toISOString(); }

// ═══════════════════════════════════════════════════════════════════════
// MARKETPLACES
// ═══════════════════════════════════════════════════════════════════════

async function createMarketplace(data) {
  data = data || {};
  const m = {
    id: _id('mkt'),
    name: data.name || 'Unnamed Marketplace',
    commissionRate: typeof data.commissionRate === 'number' ? data.commissionRate : 0.15,  // 15% default
    franchiseFeeRate: typeof data.franchiseFeeRate === 'number' ? data.franchiseFeeRate : 0.05,  // 5% franchise fee
    owner: data.owner || null,  // userId of owner
    domain: data.domain || null,  // limenhelix.com domain if any
    status: 'active',
    ts: _now()
  };
  let mks = await db.get(MARKETPLACE_KEY) || {};
  mks[m.id] = m;
  await db.set(MARKETPLACE_KEY, mks);
  return m;
}

async function getMarketplace(marketplaceId) {
  const mks = await db.get(MARKETPLACE_KEY) || {};
  return mks[marketplaceId] || null;
}

async function updateMarketplaceCommission(marketplaceId, rate) {
  const mks = await db.get(MARKETPLACE_KEY) || {};
  if (mks[marketplaceId]) {
    mks[marketplaceId].commissionRate = Math.max(0, Math.min(1, rate));  // 0-100%
    await db.set(MARKETPLACE_KEY, mks);
  }
  return mks[marketplaceId] || null;
}

async function listMarketplaces() {
  const mks = await db.get(MARKETPLACE_KEY) || {};
  return Object.values(mks).sort(function(a, b) { return new Date(b.ts) - new Date(a.ts); });
}

// ═══════════════════════════════════════════════════════════════════════
// USERS (Sellers & Buyers)
// ═══════════════════════════════════════════════════════════════════════

async function createUser(data) {
  data = data || {};
  const u = {
    id: _id('usr'),
    email: data.email || '',
    name: data.name || '',
    role: data.role || 'buyer',  // 'seller', 'buyer', 'admin'
    stripeAccountId: data.stripeAccountId || null,  // for seller payouts
    phone: data.phone || '',
    balance: 0,  // seller available balance
    ts: _now()
  };
  let us = await db.get(USERS_KEY) || {};
  us[u.id] = u;
  await db.set(USERS_KEY, us);
  return u;
}

async function getUser(userId) {
  const us = await db.get(USERS_KEY) || {};
  return us[userId] || null;
}

async function getUserByEmail(email) {
  const us = await db.get(USERS_KEY) || {};
  for (const id in us) {
    if (us[id].email === email) return us[id];
  }
  return null;
}

async function updateUser(userId, updates) {
  const us = await db.get(USERS_KEY) || {};
  if (us[userId]) {
    us[userId] = Object.assign(us[userId], updates);
    await db.set(USERS_KEY, us);
  }
  return us[userId] || null;
}

// ═══════════════════════════════════════════════════════════════════════
// LISTINGS (Items for Sale)
// ═══════════════════════════════════════════════════════════════════════

async function createListing(data) {
  data = data || {};
  const l = {
    id: _id('lst'),
    marketplaceId: data.marketplaceId || null,
    sellerId: data.sellerId || null,
    title: data.title || '',
    price: Math.max(0.5, parseFloat(data.price) || 0),  // USD, min $0.50
    description: data.description || '',
    images: Array.isArray(data.images) ? data.images : [],
    category: data.category || 'other',
    condition: data.condition || 'used',  // 'like-new', 'good', 'fair', 'used'
    quantity: parseInt(data.quantity) || 1,
    status: 'active',
    ts: _now()
  };
  let ls = await db.get(LISTINGS_KEY) || {};
  ls[l.id] = l;
  await db.set(LISTINGS_KEY, ls);
  return l;
}

async function getListing(listingId) {
  const ls = await db.get(LISTINGS_KEY) || {};
  return ls[listingId] || null;
}

async function listingsByMarketplace(marketplaceId, limit) {
  const ls = await db.get(LISTINGS_KEY) || {};
  return Object.values(ls)
    .filter(function(l) { return l.marketplaceId === marketplaceId && l.status === 'active'; })
    .sort(function(a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, limit || 100);
}

async function listingsBySeller(sellerId) {
  const ls = await db.get(LISTINGS_KEY) || {};
  return Object.values(ls)
    .filter(function(l) { return l.sellerId === sellerId; })
    .sort(function(a, b) { return new Date(b.ts) - new Date(a.ts); });
}

async function updateListing(listingId, updates) {
  const ls = await db.get(LISTINGS_KEY) || {};
  if (ls[listingId]) {
    ls[listingId] = Object.assign(ls[listingId], updates);
    await db.set(LISTINGS_KEY, ls);
  }
  return ls[listingId] || null;
}

// ═══════════════════════════════════════════════════════════════════════
// ORDERS (Transactions)
// ═══════════════════════════════════════════════════════════════════════

async function createOrder(data) {
  data = data || {};
  const mkt = await getMarketplace(data.marketplaceId);
  if (!mkt) return { error: 'marketplace not found' };

  const commissionRate = mkt.commissionRate || 0.15;
  const franchiseFeeRate = mkt.franchiseFeeRate || 0.05;

  const subtotal = parseFloat(data.subtotal) || 0;
  const commission = Math.round(subtotal * commissionRate * 100) / 100;
  const franchiseFee = Math.round(subtotal * franchiseFeeRate * 100) / 100;
  const sellerPayout = subtotal - commission - franchiseFee;

  const o = {
    id: _id('ord'),
    marketplaceId: data.marketplaceId,
    buyerId: data.buyerId || null,
    sellerId: data.sellerId || null,
    listingId: data.listingId || null,
    subtotal: subtotal,
    commission: commission,
    franchiseFee: franchiseFee,
    sellerPayout: sellerPayout,
    paymentLinkId: data.paymentLinkId || null,
    stripePaymentId: data.stripePaymentId || null,
    status: 'pending',  // 'pending' → 'paid' → 'shipped' (optional) → 'completed'
    ts: _now()
  };
  await db.lpush(ORDERS_KEY, o);
  return o;
}

async function getOrder(orderId) {
  const orders = await db.lrange(ORDERS_KEY, 0, -1);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) return orders[i];
  }
  return null;
}

async function updateOrder(orderId, updates) {
  const orders = await db.lrange(ORDERS_KEY, 0, -1);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) {
      orders[i] = Object.assign(orders[i], updates);
      // Re-write entire list (inefficient, but acceptable for now with limit cap)
      await db.del(ORDERS_KEY);
      for (let j = orders.length - 1; j >= 0; j--) {
        await db.lpush(ORDERS_KEY, orders[j]);
      }
      return orders[i];
    }
  }
  return null;
}

async function orderHistory(limit) {
  return await db.lrange(ORDERS_KEY, 0, (limit || 500) - 1);
}

// ═══════════════════════════════════════════════════════════════════════
// PAYOUTS (Seller Earnings & Franchise Fees)
// ═══════════════════════════════════════════════════════════════════════

async function createPayout(data) {
  data = data || {};
  const p = {
    id: _id('pyt'),
    userId: data.userId || null,
    marketplaceId: data.marketplaceId || null,
    type: data.type || 'seller',  // 'seller', 'franchise-fee', 'refund'
    amount: Math.max(0, parseFloat(data.amount) || 0),
    orderId: data.orderId || null,
    stripePayoutId: data.stripePayoutId || null,
    status: 'pending',  // 'pending' → 'approved' → 'processing' → 'completed'
    reason: data.reason || '',
    ts: _now()
  };
  await db.lpush(PAYOUTS_KEY, p);
  return p;
}

async function payoutHistory(userId, limit) {
  const payouts = await db.lrange(PAYOUTS_KEY, 0, (limit || 500) - 1);
  if (userId) {
    return payouts.filter(function(p) { return p.userId === userId; });
  }
  return payouts;
}

async function getPendingPayouts(limit) {
  const payouts = await db.lrange(PAYOUTS_KEY, 0, (limit || 100) - 1);
  return payouts.filter(function(p) { return p.status === 'pending'; });
}

async function updatePayout(payoutId, updates) {
  const payouts = await db.lrange(PAYOUTS_KEY, 0, -1);
  for (let i = 0; i < payouts.length; i++) {
    if (payouts[i].id === payoutId) {
      payouts[i] = Object.assign(payouts[i], updates);
      // Re-write entire list
      await db.del(PAYOUTS_KEY);
      for (let j = payouts.length - 1; j >= 0; j--) {
        await db.lpush(PAYOUTS_KEY, payouts[j]);
      }
      return payouts[i];
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// ANALYTICS (Marketplace Health)
// ═══════════════════════════════════════════════════════════════════════

async function marketplaceStats(marketplaceId) {
  const orders = await orderHistory(1000);
  const payouts = await payoutHistory(null, 1000);

  let gmv = 0, commissionTotal = 0, franchiseFeeTotal = 0, completedOrders = 0;
  orders.forEach(function(o) {
    if (o.marketplaceId === marketplaceId) {
      gmv += o.subtotal;
      commissionTotal += o.commission;
      franchiseFeeTotal += o.franchiseFee;
      if (o.status === 'completed') completedOrders++;
    }
  });

  let sellerPayoutsPending = 0, sellerPayoutsCompleted = 0;
  payouts.forEach(function(p) {
    if (p.marketplaceId === marketplaceId && p.type === 'seller') {
      if (p.status === 'pending') sellerPayoutsPending += p.amount;
      if (p.status === 'completed') sellerPayoutsCompleted += p.amount;
    }
  });

  return {
    marketplaceId: marketplaceId,
    gmv: Number(gmv.toFixed(2)),
    commissionEarned: Number(commissionTotal.toFixed(2)),
    franchiseFeeEarned: Number(franchiseFeeTotal.toFixed(2)),
    totalOrders: orders.filter(function(o) { return o.marketplaceId === marketplaceId; }).length,
    completedOrders: completedOrders,
    sellerPayoutsPending: Number(sellerPayoutsPending.toFixed(2)),
    sellerPayoutsCompleted: Number(sellerPayoutsCompleted.toFixed(2))
  };
}

module.exports = {
  // Marketplaces
  createMarketplace, getMarketplace, updateMarketplaceCommission, listMarketplaces,
  // Users
  createUser, getUser, getUserByEmail, updateUser,
  // Listings
  createListing, getListing, listingsByMarketplace, listingsBySeller, updateListing,
  // Orders
  createOrder, getOrder, updateOrder, orderHistory,
  // Payouts
  createPayout, payoutHistory, getPendingPayouts, updatePayout,
  // Analytics
  marketplaceStats
};
