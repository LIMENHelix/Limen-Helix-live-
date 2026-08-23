/**
 * api/relay-marketplace — Marketplace operations
 *
 * GET  /api/relay-marketplace?action=list-marketplace&marketplaceId=X
 *        → { ok, marketplace, stats }
 *
 * GET  /api/relay-marketplace?action=list-listings&marketplaceId=X&limit=50
 *        → { ok, listings: [...] }
 *
 * GET  /api/relay-marketplace?action=user&userId=X
 *        → { ok, user }
 *
 * POST /api/relay-marketplace { action, ...payload }
 *   action = 'create-seller' { name, email } → { ok, user }
 *   action = 'create-listing' { marketplaceId, sellerId, title, price, description, images, category, condition } → { ok, listing }
 *   action = 'seller-stats' { sellerId } → { ok, earnings, listings, pendingPayouts }
 */

const marketplace = require('../lib/relay-marketplace');

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

function checkAdminKey(q) {
  const key = q.key || '';
  const validKey = process.env.RELAY_ADMIN_KEY || 'relay-admin-demo';
  return key === validKey && key.length > 0;
}

async function handleGET(req, res, q) {
  if (q.action === 'list-marketplace') {
    if (!checkAdminKey(q)) {
      return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
    }
    const limit = parseInt(q.limit) || 50;
    const id = q.id || q.marketplaceId;

    if (id) {
      const mkt = await marketplace.getMarketplace(id);
      if (!mkt) return sendJSON(res, 404, { ok: false, error: 'marketplace not found' });
      const stats = await marketplace.marketplaceStats(id);
      return sendJSON(res, 200, { ok: true, marketplaces: [mkt], stats: stats });
    } else {
      const mktList = await marketplace.listMarketplaces();
      return sendJSON(res, 200, { ok: true, marketplaces: mktList.slice(0, limit) });
    }
  }

  if (q.action === 'list-listings') {
    const listings = await marketplace.listingsByMarketplace(q.marketplaceId, parseInt(q.limit) || 50);
    return sendJSON(res, 200, { ok: true, listings: listings });
  }

  if (q.action === 'user') {
    const user = await marketplace.getUser(q.userId);
    if (!user) return sendJSON(res, 404, { ok: false, error: 'user not found' });
    return sendJSON(res, 200, { ok: true, user: user });
  }

  if (q.action === 'seller-listings') {
    const listings = await marketplace.listingsBySeller(q.sellerId);
    return sendJSON(res, 200, { ok: true, listings: listings });
  }

  if (q.action === 'seller-stats') {
    const user = await marketplace.getUser(q.sellerId);
    if (!user) return sendJSON(res, 404, { ok: false, error: 'seller not found' });
    const listings = await marketplace.listingsBySeller(q.sellerId);
    const payouts = await marketplace.payoutHistory(q.sellerId);
    const earnings = payouts.reduce(function(sum, p) {
      return sum + (p.type === 'seller' ? p.amount : 0);
    }, 0);
    const pendingPayouts = payouts.filter(function(p) { return p.status === 'pending'; });
    return sendJSON(res, 200, {
      ok: true,
      user: user,
      earnings: Number(earnings.toFixed(2)),
      listingsCount: listings.length,
      pendingPayoutsCount: pendingPayouts.length,
      pendingPayoutsAmount: pendingPayouts.reduce(function(sum, p) { return sum + p.amount; }, 0)
    });
  }

  if (q.action === 'marketplace-stats') {
    if (!checkAdminKey(q)) {
      return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
    }
    const stats = await marketplace.marketplaceStats(q.marketplaceId);
    return sendJSON(res, 200, { ok: true, stats: stats });
  }

  if (q.action === 'list-payouts') {
    if (!checkAdminKey(q)) {
      return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
    }
    const allPayouts = await marketplace.payoutHistory();
    const filtered = allPayouts.filter(function(p) { return p.marketplaceId === q.marketplaceId; });
    return sendJSON(res, 200, { ok: true, payouts: filtered });
  }

  if (q.action === 'verify-admin-key') {
    const key = q.key || '';
    const validKey = process.env.RELAY_ADMIN_KEY || 'relay-admin-demo';
    const isValid = key === validKey && key.length > 0;
    return sendJSON(res, isValid ? 200 : 401, { ok: isValid });
  }

  return sendJSON(res, 400, { ok: false, error: 'unknown action' });
}

async function handlePOST(req, res, body) {
  const action = body.action || '';

  if (action === 'create-marketplace') {
    if (!checkAdminKey({ key: body.key })) {
      return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
    }
    const mkt = await marketplace.createMarketplace({
      name: body.name || 'Marketplace',
      commissionRate: body.commissionRate || 0.15,
      franchiseFeeRate: body.franchiseFeeRate || 0.05,
      owner: body.owner || null,
      domain: body.domain || null
    });
    return sendJSON(res, 201, { ok: true, marketplace: mkt });
  }

  if (action === 'create-seller') {
    const email = (body.email || '').toLowerCase();
    if (!email) return sendJSON(res, 400, { ok: false, error: 'email required' });

    const existing = await marketplace.getUserByEmail(email);
    if (existing) return sendJSON(res, 409, { ok: false, error: 'user already exists' });

    const user = await marketplace.createUser({
      email: email,
      name: body.name || 'Seller',
      role: 'seller'
    });
    return sendJSON(res, 201, { ok: true, user: user });
  }

  if (action === 'create-listing') {
    const marketplaceId = body.marketplaceId || '';
    const sellerId = body.sellerId || '';
    if (!marketplaceId || !sellerId) return sendJSON(res, 400, { ok: false, error: 'marketplaceId, sellerId required' });

    const mkt = await marketplace.getMarketplace(marketplaceId);
    if (!mkt) return sendJSON(res, 404, { ok: false, error: 'marketplace not found' });

    const seller = await marketplace.getUser(sellerId);
    if (!seller || seller.role !== 'seller') return sendJSON(res, 403, { ok: false, error: 'not a seller' });

    const listing = await marketplace.createListing({
      marketplaceId: marketplaceId,
      sellerId: sellerId,
      title: body.title || 'Untitled',
      price: body.price || 0,
      description: body.description || '',
      images: body.images || [],
      category: body.category || 'other',
      condition: body.condition || 'used',
      quantity: body.quantity || 1
    });
    return sendJSON(res, 201, { ok: true, listing: listing });
  }

  if (action === 'update-listing') {
    const listingId = body.listingId || '';
    const sellerId = body.sellerId || '';
    if (!listingId || !sellerId) return sendJSON(res, 400, { ok: false, error: 'listingId, sellerId required' });

    const listing = await marketplace.getListing(listingId);
    if (!listing) return sendJSON(res, 404, { ok: false, error: 'listing not found' });
    if (listing.sellerId !== sellerId) return sendJSON(res, 403, { ok: false, error: 'not the seller' });

    const updated = await marketplace.updateListing(listingId, {
      title: body.title !== undefined ? body.title : listing.title,
      price: body.price !== undefined ? body.price : listing.price,
      description: body.description !== undefined ? body.description : listing.description,
      images: Array.isArray(body.images) ? body.images : listing.images,
      category: body.category !== undefined ? body.category : listing.category,
      condition: body.condition !== undefined ? body.condition : listing.condition,
      status: body.status !== undefined ? body.status : listing.status
    });
    return sendJSON(res, 200, { ok: true, listing: updated });
  }

  if (action === 'seller-stats') {
    const sellerId = body.sellerId || '';
    if (!sellerId) return sendJSON(res, 400, { ok: false, error: 'sellerId required' });

    const user = await marketplace.getUser(sellerId);
    if (!user) return sendJSON(res, 404, { ok: false, error: 'seller not found' });

    const listings = await marketplace.listingsBySeller(sellerId);
    const payouts = await marketplace.payoutHistory(sellerId);
    const earnings = payouts.reduce(function(sum, p) {
      return sum + (p.type === 'seller' ? p.amount : 0);
    }, 0);
    const pendingPayouts = payouts.filter(function(p) { return p.status === 'pending'; });

    return sendJSON(res, 200, {
      ok: true,
      user: user,
      earnings: Number(earnings.toFixed(2)),
      listingsCount: listings.length,
      pendingPayoutsCount: pendingPayouts.length,
      pendingPayoutsAmount: Number(pendingPayouts.reduce(function(sum, p) { return sum + p.amount; }, 0).toFixed(2))
    });
  }

  if (action === 'update-payout') {
    if (!checkAdminKey({ key: body.key })) {
      return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
    }
    const payoutId = body.payoutId || '';
    const status = body.status || '';
    if (!payoutId || !status) return sendJSON(res, 400, { ok: false, error: 'payoutId, status required' });

    const updated = await marketplace.updatePayout(payoutId, { status: status });
    return sendJSON(res, 200, { ok: true, payout: updated });
  }

  return sendJSON(res, 400, { ok: false, error: 'unknown action' });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  try {
    const q = {};
    try { Object.assign(q, Object.fromEntries(new URL(req.url, 'http://h').searchParams)); } catch (e) {}

    if (req.method === 'GET') {
      return await handleGET(req, res, q);
    } else if (req.method === 'POST') {
      const body = await readBody(req);
      return await handlePOST(req, res, body);
    } else {
      return sendJSON(res, 405, { ok: false, error: 'method not allowed' });
    }
  } catch (e) {
    console.error('[relay-marketplace]', e.message);
    return sendJSON(res, 500, { ok: false, error: 'server error' });
  }
};
