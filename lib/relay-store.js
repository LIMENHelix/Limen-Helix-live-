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
// The listings and orders maps are mutated by checkout, fulfilment and the reconcile loop
// at once. A whole-map GET → mutate → SET drops the other writer's record, so the four
// writes below go through an atomic compare-and-replace with bounded retry instead, and
// fail closed when the store cannot guarantee one. See lib/relay-strict-store.js.
const strict = require('./relay-strict-store');

const LISTINGS_KEY = 'relay:store:listings';
const ORDERS_KEY = 'relay:store:orders';
const LISTINGS_PKEY = 'limen:' + LISTINGS_KEY;
const ORDERS_PKEY = 'limen:' + ORDERS_KEY;

function _id(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9); }
function _now() { return new Date().toISOString(); }
function _round(n) { return Math.round(n * 100) / 100; }

/**
 * Monotonic guards for updateOrder. A writer that computed its update from a stale
 * snapshot must not drag a record BACKwards: an order that reached 'paid' or 'shipped',
 * or a fulfilment that reached 'purchased', stays there even if a slower writer commits
 * after it. Ranks only name states this module actually transitions between; an
 * unrecognised state on either side is applied as-is, so older rows and future states
 * keep working.
 */
const STATUS_RANK = { pending: 0, 'awaiting-payment': 1, 'payment-failed': 1, 'payment-review': 2, paid: 3, shipped: 4 };
const FULFILL_RANK = { failed: 1, 'awaiting-approval': 1, 'manual-required': 1, partial: 2, purchased: 3 };

function _rank(table, v) { return Object.prototype.hasOwnProperty.call(table, v) ? table[v] : -1; }

function _applyOrderUpdate(existing, updates) {
  const next = Object.assign({}, existing, updates);
  const sNew = _rank(STATUS_RANK, updates && updates.status);
  const sOld = _rank(STATUS_RANK, existing && existing.status);
  if (updates && updates.status && sNew >= 0 && sOld >= 0 && sNew < sOld) {
    next.status = existing.status;
  }
  const fNew = updates && updates.fulfillment ? _rank(FULFILL_RANK, updates.fulfillment.state) : -1;
  const fOld = existing && existing.fulfillment ? _rank(FULFILL_RANK, existing.fulfillment.state) : -1;
  if (updates && updates.fulfillment && fNew >= 0 && fOld >= 0 && fNew < fOld) {
    next.fulfillment = existing.fulfillment;
  }
  return next;
}

async function _mutate(pkey, fn) {
  const out = await strict.mutate(pkey, fn, { attempts: 5 });
  if (!out.committed) {
    throw new Error('relay-store: ' + pkey + ' changed under every attempt; write refused');
  }
  return out.result;
}

// Reads stay forgiving (a shopper's catalogue degrades, a mutation never does): the strict
// store is asked first so a read observes what a mutation committed; on a strict-read
// failure the legacy db.get fallback preserves the pre-existing read behavior.
async function _readMap(pkey, shortKey) {
  try {
    return (await strict.read(pkey)) || {};
  } catch (e) {
    return (await db.get(shortKey)) || {};
  }
}

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
  await _mutate(LISTINGS_PKEY, function (lsIn) {
    const ls = lsIn && typeof lsIn === 'object' ? Object.assign({}, lsIn) : {};
    ls[l.id] = l;
    return { write: true, value: ls, result: l };
  });
  return l;
}

async function getListing(listingId) {
  const ls = await _readMap(LISTINGS_PKEY, LISTINGS_KEY);
  return ls[listingId] || null;
}

async function updateListing(listingId, updates) {
  return _mutate(LISTINGS_PKEY, function (lsIn) {
    const ls = lsIn && typeof lsIn === 'object' ? lsIn : {};
    if (!ls[listingId]) return { result: null };
    const updated = Object.assign({}, ls[listingId], updates);
    const next = Object.assign({}, ls);
    next[listingId] = updated;
    return { write: true, value: next, result: updated };
  });
}

async function activeListings(limit) {
  const ls = await _readMap(LISTINGS_PKEY, LISTINGS_KEY);
  return Object.values(ls)
    .filter(function (l) { return l.status === 'active'; })
    .sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, limit || 200);
}

async function allListings() {
  const ls = await _readMap(LISTINGS_PKEY, LISTINGS_KEY);
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
      title: l.title || '',
      // Supplier provenance revalidated for THIS order's address at checkout. Null when
      // the caller had nothing to add, in which case fulfilment falls back to the
      // listing's own. Dropping these here would silently undo the pre-charge
      // revalidation: relay-engine would authorise and order against the listing's
      // discovery-time quote to a default destination.
      sourceCost: l.sourceCost != null ? _round(parseFloat(l.sourceCost)) : null,
      sourceShipping: l.sourceShipping != null ? _round(parseFloat(l.sourceShipping)) : null,
      sourceCarrier: l.sourceCarrier || null,
      sourceFromCountry: l.sourceFromCountry || null
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

  await _mutate(ORDERS_PKEY, function (osIn) {
    const os = osIn && typeof osIn === 'object' ? Object.assign({}, osIn) : {};
    os[o.id] = o;
    return { write: true, value: os, result: o };
  });
  return o;
}

async function getOrder(orderId) {
  const os = await _readMap(ORDERS_PKEY, ORDERS_KEY);
  return os[orderId] || null;
}

async function updateOrder(orderId, updates) {
  return _mutate(ORDERS_PKEY, function (osIn) {
    const os = osIn && typeof osIn === 'object' ? osIn : {};
    if (!os[orderId]) return { result: null };
    // The guard runs against the FRESH row on every retry, so a stale writer re-reads
    // before it can overwrite a newer payment or fulfilment state.
    const updated = _applyOrderUpdate(os[orderId], updates);
    const next = Object.assign({}, os);
    next[orderId] = updated;
    return { write: true, value: next, result: updated };
  });
}

/**
 * @param opts.strict  demand a real read, and throw if the store cannot answer.
 *
 * The default read is deliberately forgiving: db.get() falls back to process memory and
 * returns null on a Redis failure, which becomes {} here and resolves to an empty array.
 * For a shopper-facing list that degrades sensibly. For the operator status counters it
 * was a silent lie - a cold instance with Redis down reported zero held orders, zero
 * stranded paid orders, and 'nothing needs attention', which is the exact reading the
 * alerting exists to prevent. Callers that report a COUNT to a human pass strict:true.
 *
 * A memory backend is a deliberate configuration, not an outage, so strict only bites
 * where there is a Redis to be strict about.
 */
async function ordersByStatus(status, limit, opts) {
  const strict = !!(opts && opts.strict) && db.getBackend() === 'redis';
  const os = (strict ? await db.getStrict(ORDERS_KEY) : await _readMap(ORDERS_PKEY, ORDERS_KEY)) || {};
  return Object.values(os)
    .filter(function (o) { return !status || o.status === status; })
    .sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, limit || 200);
}

// opts rides through, or a caller asking for a STRICT history silently got a
// forgiving read and an empty list during the outage it was meant to expose.
async function orderHistory(limit, opts) {
  return ordersByStatus(null, limit, opts);
}

module.exports = {
  LISTINGS_KEY,
  ORDERS_KEY,
  createListing, getListing, updateListing, activeListings, allListings,
  publicListing, publicListings,
  createOrder, getOrder, updateOrder, ordersByStatus, orderHistory
};
