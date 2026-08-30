/**
 * relay-engine.js — the Relay loop, in process.
 *
 *   discovery tick (cron, every 35 min)
 *     pick a concept  ->  reference image (Grok)  ->  reverse-image / marketplace search
 *     ->  real listing with a real price  ->  apply the LIMEN-set margin  ->  publish
 *
 *   order tick (on payment)
 *     paid order  ->  re-verify the source is still live at the price we sold at
 *     ->  autonomy gate  ->  buy from source, ship to customer  ->  settle the margin
 *
 * WHY THIS FILE EXISTS: the previous cron handler POSTed to http://localhost:3000 to
 * create its listings, which in a Vercel function connects to nothing. The loop has been
 * firing every 35 minutes into a dead socket. Everything here runs in-process against the
 * same libraries the API handlers use, so there is no localhost, no self-HTTP, and no
 * silent no-op.
 *
 * CONCEPT SELECTION IS DEMAND-FIRST. What customers actually searched for beats a
 * hardcoded list of things we guessed they might want, and it is free: the searches are
 * already recorded. The seed list is only the cold-start fallback.
 */

const db = require('./limen-db');
const marketplace = require('./relay-marketplace');
const sourceSearch = require('./relay-source-search');
const autonomy = require('./relay-autonomy');
const buy = require('./relay-buy');

const MARGIN_KEY = 'relay_margin';
const MARGIN_DEFAULT = 0.35;
const CYCLES_KEY = 'relay:engine-cycles';
const CONCEPT_CURSOR_KEY = 'relay:engine-cursor';

const XAI_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
const XAI_IMAGE_MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';

/** Cold-start concepts. Only used when no real customer demand has been recorded yet. */
const SEED_CONCEPTS = [
  'vintage leather jacket',
  'retro running sneakers',
  'mechanical wristwatch',
  'film camera 35mm',
  'vinyl record classic rock',
  'designer leather handbag',
  'first edition hardcover book',
  'vintage denim jacket'
];

function _round(n) { return Math.round(n * 100) / 100; }

/** The margin the operator set in LIMEN's cockpit. One source of truth. */
async function getMargin() {
  try {
    const v = await db.get(MARGIN_KEY);
    if (typeof v === 'number' && isFinite(v) && v >= 0 && v <= 5) return v;
  } catch (e) { /* fall through to default */ }
  return MARGIN_DEFAULT;
}

/** Customer searches that found nothing are the strongest signal of unmet demand. */
async function pickConcept() {
  try {
    const searches = await db.get('relay:searches') || [];
    const recent = searches.slice(-200).reverse();
    const counts = {};
    recent.forEach(function (s) {
      const d = (s.description || '').trim().toLowerCase();
      if (d.length < 3) return;
      counts[d] = (counts[d] || 0) + 1 + (s.resultCount === 0 ? 2 : 0);  // unmet demand weighs more
    });
    const ranked = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (ranked.length) {
      return { concept: ranked[0], origin: 'demand', demandScore: counts[ranked[0]] };
    }
  } catch (e) { /* fall through to seeds */ }

  let cursor = 0;
  try { cursor = parseInt(await db.get(CONCEPT_CURSOR_KEY), 10) || 0; } catch (e) {}
  const concept = SEED_CONCEPTS[cursor % SEED_CONCEPTS.length];
  try { await db.set(CONCEPT_CURSOR_KEY, cursor + 1); } catch (e) {}
  return { concept: concept, origin: 'seed', demandScore: 0 };
}

/** Grok reference image. Optional: sourcing works from text alone when this is off. */
async function referenceImage(concept) {
  if (!XAI_KEY) return { ok: false, reason: 'XAI_API_KEY not set' };
  try {
    const r = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + XAI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: XAI_IMAGE_MODEL,
        prompt: 'Product photograph of ' + concept + '. Studio lighting, plain neutral ' +
                'background, sharp focus, catalogue style, no text, no watermark.',
        n: 1
      })
    });
    if (!r.ok) {
      const t = await r.text().catch(function () { return ''; });
      return { ok: false, reason: 'xAI ' + r.status + ': ' + t.slice(0, 200) };
    }
    const j = await r.json();
    const url = (j.data && j.data[0] && (j.data[0].url || j.data[0].b64_json)) || null;
    if (!url) return { ok: false, reason: 'xAI returned no image' };
    return { ok: true, imageUrl: url };
  } catch (e) {
    return { ok: false, reason: 'xAI error: ' + e.message };
  }
}

/**
 * One discovery pass: concept -> image -> real for-sale listings -> published listings.
 * Publishes at sourceCost x (1 + margin). Never publishes an item it could not price.
 */
async function discoverAndList(opts) {
  opts = opts || {};
  const marketplaceId = opts.marketplaceId || process.env.RELAY_MARKETPLACE_ID || 'mkt_relay';
  const sellerId = opts.sellerId || process.env.RELAY_HOUSE_SELLER_ID || 'usr_relay_house';
  const maxPerCycle = parseInt(opts.maxPerCycle || process.env.RELAY_MAX_LISTINGS_PER_CYCLE || '3', 10);
  const maxSourcePrice = parseFloat(opts.maxSourcePrice || process.env.RELAY_MAX_SOURCE_PRICE || '75');

  const picked = opts.concept
    ? { concept: opts.concept, origin: 'explicit', demandScore: 0 }
    : await pickConcept();

  const img = await referenceImage(picked.concept);
  const margin = await getMargin();

  const found = await sourceSearch.searchAllSources({
    description: picked.concept,
    imageUrl: img.ok ? img.imageUrl : '',
    maxPrice: maxSourcePrice
  });

  if (!found.ok) {
    return {
      ok: false,
      concept: picked.concept,
      conceptOrigin: picked.origin,
      imageOk: img.ok,
      imageReason: img.ok ? null : img.reason,
      published: [],
      reason: found.reason
    };
  }

  // Do not re-publish something already on the board from the same source URL.
  let existingUrls = new Set();
  try {
    const live = await marketplace.listingsByMarketplace(marketplaceId, 300);
    live.forEach(function (l) { if (l.sourceUrl) existingUrls.add(l.sourceUrl); });
  } catch (e) { /* an empty set just means we might duplicate once */ }

  const published = [];
  for (const item of found.items) {
    if (published.length >= maxPerCycle) break;
    if (existingUrls.has(item.url)) continue;

    const price = _round(item.price * (1 + margin));
    if (!(price > item.price)) continue;   // a non-positive spread is not a listing

    try {
      const listing = await marketplace.createListing({
        marketplaceId: marketplaceId,
        sellerId: sellerId,
        title: item.title.slice(0, 140),
        price: price,
        description: 'Sourced on demand. ' + (item.condition !== 'unspecified' ? 'Condition: ' + item.condition + '. ' : '') +
                     'All sales final: no returns or exchanges.',
        images: item.image ? [item.image] : (img.ok ? [img.imageUrl] : []),
        category: opts.category || 'other',
        condition: item.condition === 'unspecified' ? 'used' : item.condition,
        quantity: 1,
        // Everything fulfilment needs, recorded at publish time. Without these the
        // order cannot be sourced later.
        sourceMarketplace: item.source,
        sourceId: item.itemId,
        sourceUrl: item.url,
        sourceCost: item.price,
        sourceProvider: item.provider,
        sourceVerifiedAt: new Date().toISOString(),
        marginAtListing: margin,
        referenceImage: img.ok ? img.imageUrl : null
      });
      published.push({
        listingId: listing.id,
        title: listing.title,
        price: price,
        sourceCost: item.price,
        spread: _round(price - item.price),
        source: item.source,
        sourceUrl: item.url
      });
      existingUrls.add(item.url);
    } catch (e) {
      console.error('[relay-engine] publish failed:', e.message);
    }
  }

  return {
    ok: published.length > 0,
    concept: picked.concept,
    conceptOrigin: picked.origin,
    imageOk: img.ok,
    imageReason: img.ok ? null : img.reason,
    margin: margin,
    candidates: found.items.length,
    sources: found.sources,
    published: published,
    reason: published.length ? null : 'candidates found but none produced a positive spread or all were duplicates'
  };
}

/**
 * A paid order becomes a purchase from the source.
 * Order of operations matters: re-verify price, THEN authorise, THEN spend. Authorising
 * against a stale price is how an autonomous buyer overpays.
 */
async function fulfillPaidOrder(opts) {
  opts = opts || {};
  const orderId = opts.orderId;
  if (!orderId) return { ok: false, error: 'orderId required' };

  const order = await marketplace.getOrder(orderId);
  if (!order) return { ok: false, error: 'order not found' };
  if (order.status !== 'paid' && !opts.force) {
    return { ok: false, error: 'order is ' + order.status + ', not paid' };
  }
  if (order.fulfillment && order.fulfillment.state === 'purchased') {
    return { ok: true, already: true, fulfillment: order.fulfillment };
  }

  const listing = await marketplace.getListing(order.listingId);
  if (!listing) return { ok: false, error: 'listing not found for order' };
  if (!listing.sourceUrl) {
    return { ok: false, error: 'listing has no source URL; it was not created by the engine and cannot be auto-sourced' };
  }

  const shippingAddress = opts.shippingAddress || order.shippingAddress || null;
  if (!shippingAddress) {
    return { ok: false, error: 'no shipping address on the order; cannot buy' };
  }

  const sourceCost = parseFloat(listing.sourceCost) || 0;
  const salePrice = parseFloat(order.subtotal) || parseFloat(listing.price) || 0;

  const decision = await autonomy.authorize({
    amount: sourceCost,
    salePrice: salePrice,
    marketplace: listing.sourceMarketplace,
    orderId: orderId,
    listingId: listing.id,
    note: listing.title
  });

  if (!decision.allowed) {
    const state = decision.queued ? 'awaiting-approval' : 'blocked';
    await marketplace.updateOrder(orderId, {
      fulfillment: {
        state: state,
        decisionId: decision.decisionId,
        reason: decision.reason,
        mode: decision.mode,
        ts: new Date().toISOString()
      }
    });
    // Queued still needs the human-facing task, so the work is visible somewhere.
    if (decision.queued) {
      await buy.fileManualTask({
        orderId: orderId,
        listingId: listing.id,
        sourceMarketplace: listing.sourceMarketplace,
        sourceUrl: listing.sourceUrl,
        maxCost: sourceCost,
        quantity: 1,
        shippingAddress: shippingAddress,
        decisionId: decision.decisionId
      }, 'queued for approval: ' + decision.reason);
    }
    return { ok: false, state: state, decision: decision };
  }

  const result = await buy.execute({
    orderId: orderId,
    listingId: listing.id,
    sourceMarketplace: listing.sourceMarketplace,
    sourceId: listing.sourceId,
    sourceUrl: listing.sourceUrl,
    maxCost: sourceCost,
    quantity: 1,
    shippingAddress: shippingAddress,
    contactEmail: opts.contactEmail || order.buyerEmail || null,
    decisionId: decision.decisionId
  });

  if (result.ok) {
    await autonomy.settle(decision.decisionId, { amount: result.amount, sourceOrderId: result.sourceOrderId });
    await marketplace.updateOrder(orderId, {
      status: 'shipped',
      fulfillment: {
        state: 'purchased',
        decisionId: decision.decisionId,
        provider: result.provider,
        sourceOrderId: result.sourceOrderId,
        actualCost: result.amount,
        margin: _round(salePrice - (result.amount || sourceCost)),
        ts: new Date().toISOString()
      }
    });
    return { ok: true, state: 'purchased', sourceOrderId: result.sourceOrderId, margin: _round(salePrice - (result.amount || sourceCost)) };
  }

  // Could not spend. Give the ceiling headroom back so a blocked order does not
  // silently eat the day's budget.
  await autonomy.release(decision.decisionId, result.error || 'purchase did not complete');
  await marketplace.updateOrder(orderId, {
    fulfillment: {
      state: result.mode === 'manual' ? 'manual-required' : 'failed',
      decisionId: decision.decisionId,
      reason: result.error || null,
      taskId: (result.task && result.task.id) || null,
      ts: new Date().toISOString()
    }
  });
  return { ok: false, state: result.mode === 'manual' ? 'manual-required' : 'failed', error: result.error, task: result.task || null };
}

/** The 24/7 tick. Safe to call repeatedly; does nothing expensive when autonomy is off. */
async function runCycle(opts) {
  opts = opts || {};
  const started = Date.now();
  const cfg = await autonomy.getConfig();

  if (cfg.mode === 'off' && !opts.force) {
    return { ok: false, skipped: true, reason: 'autonomy mode is off', mode: cfg.mode };
  }

  const discovery = await discoverAndList(opts);

  // Sweep any paid orders that have not been sourced yet. A webhook can be missed;
  // the cron is the backstop that makes the loop self-healing.
  const swept = [];
  try {
    const orders = await marketplace.orderHistory(200);
    const pendingOrders = orders.filter(function (o) {
      return o.status === 'paid' && (!o.fulfillment || o.fulfillment.state === 'failed');
    }).slice(0, 5);
    for (const o of pendingOrders) {
      const r = await fulfillPaidOrder({ orderId: o.id });
      swept.push({ orderId: o.id, ok: r.ok, state: r.state || null, error: r.error || null });
    }
  } catch (e) {
    console.error('[relay-engine] order sweep failed:', e.message);
  }

  const report = {
    ts: new Date().toISOString(),
    ms: Date.now() - started,
    mode: cfg.mode,
    concept: discovery.concept,
    conceptOrigin: discovery.conceptOrigin,
    publishedCount: discovery.published.length,
    published: discovery.published,
    candidates: discovery.candidates || 0,
    sources: discovery.sources || [],
    imageOk: discovery.imageOk,
    reason: discovery.reason,
    ordersSwept: swept
  };

  try {
    let cycles = await db.get(CYCLES_KEY) || [];
    cycles.push(report);
    if (cycles.length > 200) cycles = cycles.slice(-200);
    await db.set(CYCLES_KEY, cycles);
  } catch (e) { /* the report is still returned to the caller */ }

  return Object.assign({ ok: discovery.ok || swept.some(function (s) { return s.ok; }) }, report);
}

async function recentCycles(limit) {
  try {
    const cycles = await db.get(CYCLES_KEY) || [];
    return cycles.slice(-(limit || 20)).reverse();
  } catch (e) {
    return [];
  }
}

module.exports = {
  runCycle,
  discoverAndList,
  fulfillPaidOrder,
  pickConcept,
  referenceImage,
  getMargin,
  recentCycles,
  SEED_CONCEPTS
};
