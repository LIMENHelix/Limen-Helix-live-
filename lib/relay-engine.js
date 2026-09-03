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
// Relay's OWN store. NOT lib/relay-marketplace: that module is the TRADE domain's
// auction listing store and is off limits. See the firewall note in lib/relay-store.js.
const store = require('./relay-store');
const sourceSearch = require('./relay-source-search');
const autonomy = require('./relay-autonomy');
const buy = require('./relay-buy');
// Reading whether a payment link was actually paid. The bridge is the only file allowed
// to touch the payment rail; see reconcilePayments().
const finance = require('./relay-finance-bridge');

// How many awaiting-payment orders to read before picking the oldest to work on. Abandoned
// carts accumulate in that status forever, so the read has to be wider than the batch.
const ORDER_SCAN = 500;

const MARGIN_KEY = 'relay_margin';
const MARGIN_DEFAULT = 0.35;
const CYCLES_KEY = 'relay:engine-cycles';
const CONCEPT_CURSOR_KEY = 'relay:engine-cursor';

const XAI_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
const XAI_IMAGE_MODEL = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-quality';

/** Discovery bounds. Per-call overridable; see discoverAndList. */
const MAX_LISTINGS_PER_CYCLE = 3;
const MAX_SOURCE_PRICE = 75;

/**
 * Cold-start concepts. Only used when no real customer demand has been recorded yet.
 *
 * These MUST match what the buyable supplier actually stocks. The previous list was
 * vintage leather jacket, retro sneakers, mechanical wristwatch, film camera, vinyl
 * records, first edition books — all secondhand, branded, one-of-a-kind goods from the
 * eBay-arbitrage model. CJ is a dropship supplier of NEW, generic, unbranded stock, so
 * every one of those returned nothing and the loop published zero for hours while
 * appearing to run perfectly.
 *
 * New goods, generic, no brand names, the categories CJ actually carries.
 */
const SEED_CONCEPTS = [
  'phone case',
  'led strip lights',
  'car phone mount',
  'resistance bands set',
  'kitchen storage containers',
  'pet grooming brush',
  'wireless earbuds case',
  'makeup brush set',
  'yoga mat',
  'desk organizer',
  'water bottle insulated',
  'jewelry storage box'
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

const MISSES_KEY = 'relay:engine-misses';
const GIVE_UP_AFTER = 3;

/** How many cycles in a row a concept has been tried and published nothing. */
async function _misses() {
  try { return (await db.get(MISSES_KEY)) || {}; } catch (e) { return {}; }
}

/** Record the outcome of a cycle so a dead concept stops being retried forever. */
async function recordOutcome(concept, published) {
  if (!concept) return;
  const key = concept.trim().toLowerCase();
  try {
    const m = await _misses();
    if (published > 0) delete m[key];
    else m[key] = (m[key] || 0) + 1;
    await db.set(MISSES_KEY, m);
  } catch (e) { /* the next cycle simply retries */ }
}

/**
 * Customer searches that found nothing are the strongest signal of unmet demand — but
 * only until the engine has tried and failed to supply them.
 *
 * The unmet bonus used to be permanent, so a term nothing could satisfy pinned itself to
 * rank one and was re-picked every single cycle. Observed in production: "levi 505 jeans"
 * chosen at 14:05, 14:35, 15:05 and 15:35, publishing nothing each time, while every
 * other recorded term went untried. Demand that we have repeatedly failed to source is
 * not a better lead than demand we have not tried yet.
 */
async function pickConcept() {
  try {
    const searches = await db.get('relay:searches') || [];
    const misses = await _misses();
    const recent = searches.slice(-200).reverse();
    const counts = {};
    recent.forEach(function (s) {
      const d = (s.description || '').trim().toLowerCase();
      if (d.length < 3) return;
      if ((misses[d] || 0) >= GIVE_UP_AFTER) return;   // tried enough; leave it alone
      counts[d] = (counts[d] || 0) + 1 + (s.resultCount === 0 ? 2 : 0);
    });
    // Each failed attempt costs a point, so a term we cannot supply sinks below one we
    // have not tried, instead of blocking the queue.
    const ranked = Object.keys(counts).sort(function (a, b) {
      return (counts[b] - (misses[b] || 0)) - (counts[a] - (misses[a] || 0));
    });
    if (ranked.length) {
      return {
        concept: ranked[0],
        origin: 'demand',
        demandScore: counts[ranked[0]],
        priorMisses: misses[ranked[0]] || 0
      };
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
  // Names BOTH accepted variables. Reporting only XAI_API_KEY reads as a fault when the
  // operator has deliberately moved to GROK_API_KEY, which is the supported way to
  // replace a compromised key without touching this code.
  if (!XAI_KEY) return { ok: false, reason: 'no Grok key: set XAI_API_KEY or GROK_API_KEY' };
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
  // Deliberately constants, not env vars. A new operational env gate has to be
  // registered in the civilization control inventory, which is not Relay's file to
  // edit; both of these are overridable per call, so the Relay console can move them
  // without introducing a deploy-time control.
  const maxPerCycle = parseInt(opts.maxPerCycle, 10) > 0 ? parseInt(opts.maxPerCycle, 10) : MAX_LISTINGS_PER_CYCLE;
  const maxSourcePrice = parseFloat(opts.maxSourcePrice) > 0 ? parseFloat(opts.maxSourcePrice) : MAX_SOURCE_PRICE;

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
    // Nothing sourceable: count it against this concept so it is not re-picked forever.
    await recordOutcome(picked.concept, 0);
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
    const live = await store.activeListings(300);
    live.forEach(function (l) { if (l.sourceUrl) existingUrls.add(l.sourceUrl); });
  } catch (e) { /* an empty set just means we might duplicate once */ }

  const published = [];
  for (const item of found.items) {
    if (published.length >= maxPerCycle) break;
    if (existingUrls.has(item.url)) continue;

    const price = _round(item.price * (1 + margin));
    if (!(price > item.price)) continue;   // a non-positive spread is not a listing

    try {
      const listing = await store.createListing({
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
        sourceCarrier: item.carrier || null,
        sourceFromCountry: item.fromCountry || null,
        sourceShipping: item.shipping != null ? item.shipping : null,
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

  await recordOutcome(picked.concept, published.length);

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
 * Source ONE line of an order.
 * Order of operations matters: re-verify price, THEN authorise, THEN spend. Authorising
 * against a stale price is how an autonomous buyer overpays.
 */
async function fulfillLine(order, line, shippingAddress, opts) {
  const listing = await store.getListing(line.listingId);
  if (!listing) {
    return { listingId: line.listingId, ok: false, state: 'failed', error: 'listing not found' };
  }
  if (!listing.sourceUrl) {
    return {
      listingId: line.listingId,
      ok: false,
      state: 'failed',
      error: 'listing has no source URL; it was not created by the engine and cannot be auto-sourced'
    };
  }

  const qty = Math.max(1, parseInt(line.qty, 10) || 1);
  // The line wins over the listing where it has an opinion. A cart checkout revalidates
  // the supplier against the buyer's own address and records what it found on the line;
  // the listing still carries the discovery-time quote to a default destination, and
  // authorising or ordering against that would undo the check that was just made.
  const src = {
    cost: line.sourceCost != null ? parseFloat(line.sourceCost) : parseFloat(listing.sourceCost),
    shipping: line.sourceShipping != null ? parseFloat(line.sourceShipping)
      : (listing.sourceShipping != null ? parseFloat(listing.sourceShipping) : null),
    carrier: line.sourceCarrier || listing.sourceCarrier || null,
    fromCountry: line.sourceFromCountry || listing.sourceFromCountry || null
  };
  const sourceCost = _round((src.cost || 0) * qty);
  const salePrice = _round((parseFloat(line.unitPrice) || parseFloat(listing.price) || 0) * qty);

  const decision = await autonomy.authorize({
    amount: sourceCost,
    salePrice: salePrice,
    marketplace: listing.sourceMarketplace,
    orderId: order.id,
    listingId: listing.id,
    note: listing.title
  });

  if (!decision.allowed) {
    let taskId = null;
    // Queued still needs the human-facing task, so the work is visible somewhere.
    if (decision.queued) {
      const filed = await buy.fileManualTask({
        orderId: order.id,
        listingId: listing.id,
        sourceMarketplace: listing.sourceMarketplace,
        sourceUrl: listing.sourceUrl,
        maxCost: sourceCost,
        quantity: qty,
        shippingAddress: shippingAddress,
        decisionId: decision.decisionId
      }, 'queued for approval: ' + decision.reason);
      taskId = (filed.task && filed.task.id) || null;
    }
    return {
      listingId: line.listingId,
      ok: false,
      state: decision.queued ? 'awaiting-approval' : 'blocked',
      decisionId: decision.decisionId,
      reason: decision.reason,
      mode: decision.mode,
      taskId: taskId
    };
  }

  const result = await buy.execute({
    orderId: order.id,
    listingId: listing.id,
    sourceMarketplace: listing.sourceMarketplace,
    sourceId: listing.sourceId,
    sourceUrl: listing.sourceUrl,
    carrier: src.carrier,
    fromCountry: src.fromCountry,
    // AGGREGATE, to match maxCost. src.shipping is per unit, because that is what the
    // listing and the line record and what the drift check compares like for like; but
    // buyFromCJ computes maxCost - sourceShipping + requote.price, where maxCost is the
    // line total and cj.freight() quotes the whole quantity. Passing one unit of freight
    // there subtracts one and adds all of them, so even an unchanged two-unit quote can
    // clear the 10% drift threshold and strand a PAID order.
    sourceShipping: src.shipping != null ? _round(src.shipping * qty) : null,
    maxCost: sourceCost,
    quantity: qty,
    shippingAddress: shippingAddress,
    contactEmail: (opts && opts.contactEmail) || order.buyerEmail || null,
    decisionId: decision.decisionId
  });

  if (result.ok) {
    await autonomy.settle(decision.decisionId, { amount: result.amount, sourceOrderId: result.sourceOrderId });
    return {
      listingId: line.listingId,
      ok: true,
      state: 'purchased',
      decisionId: decision.decisionId,
      provider: result.provider,
      sourceOrderId: result.sourceOrderId,
      actualCost: result.amount,
      // The supplier charged more than authorised but the goods ARE bought. Flagged, not
      // reversed: releasing the reservation here would understate the day's spend and
      // invite a second purchase of something already paid for.
      needsReview: result.needsReview === true,
      reviewReason: result.reviewReason || null,
      margin: _round(salePrice - (result.amount || sourceCost))
    };
  }

  // Could not spend. Give the ceiling headroom back so a blocked line does not
  // silently eat the day's budget.
  await autonomy.release(decision.decisionId, result.error || 'purchase did not complete');
  return {
    listingId: line.listingId,
    ok: false,
    state: result.mode === 'manual' ? 'manual-required' : 'failed',
    decisionId: decision.decisionId,
    error: result.error || null,
    taskId: (result.task && result.task.id) || null
  };
}

/**
 * A paid order becomes purchases from the sources.
 *
 * A cart order carries several lines, each a different item from a different seller, so
 * each is authorised and bought on its own. One line failing must not roll back a line
 * that already shipped, so the order ends in one of: purchased (all), partial (some),
 * awaiting-approval, manual-required, or failed.
 */
async function fulfillPaidOrder(opts) {
  opts = opts || {};
  const orderId = opts.orderId;
  if (!orderId) return { ok: false, error: 'orderId required' };

  const order = await store.getOrder(orderId);
  if (!order) return { ok: false, error: 'order not found' };
  if (order.status !== 'paid' && !opts.force) {
    return { ok: false, error: 'order is ' + order.status + ', not paid' };
  }
  if (order.fulfillment && order.fulfillment.state === 'purchased') {
    return { ok: true, already: true, fulfillment: order.fulfillment };
  }

  const shippingAddress = opts.shippingAddress || order.shippingAddress || null;
  if (!shippingAddress) {
    return { ok: false, error: 'no shipping address on the order; cannot buy' };
  }

  // Single-listing orders predate `lines`; treat them as a one-line cart.
  const lines = (Array.isArray(order.lines) && order.lines.length)
    ? order.lines
    : [{ listingId: order.listingId, qty: 1, unitPrice: order.subtotal }];

  // A line already bought on an earlier attempt must not be bought twice.
  const doneBefore = {};
  if (order.fulfillment && Array.isArray(order.fulfillment.lines)) {
    order.fulfillment.lines.forEach(function (l) {
      if (l.state === 'purchased') doneBefore[l.listingId] = l;
    });
  }

  const results = [];
  for (const line of lines) {
    if (doneBefore[line.listingId]) { results.push(doneBefore[line.listingId]); continue; }
    results.push(await fulfillLine(order, line, shippingAddress, opts));
  }

  const purchased = results.filter(function (r) { return r.state === 'purchased'; });
  const queued = results.filter(function (r) { return r.state === 'awaiting-approval'; });
  const manual = results.filter(function (r) { return r.state === 'manual-required'; });

  let state;
  if (purchased.length === results.length) state = 'purchased';
  else if (purchased.length > 0) state = 'partial';
  else if (queued.length) state = 'awaiting-approval';
  else if (manual.length) state = 'manual-required';
  else state = 'failed';

  const firstProblem = results.find(function (r) { return !r.ok; }) || {};
  const fulfillment = {
    state: state,
    lines: results,
    margin: _round(purchased.reduce(function (s, r) { return s + (r.margin || 0); }, 0)),
    // Kept at the top level for the single-line callers and the admin board.
    decisionId: results[0] ? results[0].decisionId || null : null,
    taskId: firstProblem.taskId || null,
    reason: firstProblem.reason || firstProblem.error || null,
    ts: new Date().toISOString()
  };

  const update = { fulfillment: fulfillment };
  if (state === 'purchased') update.status = 'shipped';
  await store.updateOrder(orderId, update);

  return {
    ok: state === 'purchased',
    state: state,
    lines: results,
    margin: fulfillment.margin,
    error: state === 'purchased' ? null : (fulfillment.reason || null),
    task: firstProblem.taskId ? { id: firstProblem.taskId } : null
  };
}

/**
 * What this order cost us, per line, resolving from the listing when the line does not
 * carry it. relay-cart-checkout writes sourceCost onto the line because it revalidated
 * against the buyer's address; relay-demand-purchase does not, because that cost lives on
 * the listing it just created. Reducing over the line alone therefore reported a zero
 * cost and a null margin for every order from an entire checkout route — the finance
 * metadata looked present and was empty. Fulfilment already resolves it this way
 * (fulfillLine reads the listing), so this matches rather than invents.
 */
async function _sourceCostOf(order) {
  const lines = Array.isArray(order.lines) ? order.lines : [];
  let total = 0;
  for (const l of lines) {
    const qty = parseInt(l.qty, 10) || 1;
    let unit = parseFloat(l.sourceCost);
    if (!isFinite(unit) || unit <= 0) {
      try {
        const listing = l.listingId ? await store.getListing(l.listingId) : null;
        unit = listing ? parseFloat(listing.sourceCost) : NaN;
      } catch (e) { unit = NaN; }
    }
    if (isFinite(unit) && unit > 0) total += unit * qty;
  }
  return _round(total);
}

/**
 * Book a paid order's income, at most once across every path that could book it.
 *   → { recorded, queued, skipped }
 *
 * `skipped` is not a failure. Relay is not the only thing that can book one of its
 * payments: /api/capital-engine?action=stripe-webhook hands checkout.session.completed to
 * stripe-rail.recordWebhook, which writes an income event carrying the Stripe object id.
 * If that webhook is live on this account, reporting here as well would book the same
 * dollar twice and inflate net income and lendable surplus downstream. The ledger is
 * asked first, which also settles the cron-versus-manual race: the second reconcile sees
 * the first one's ledger entry, not a stale flag on the order.
 *
 * The order is marked reported for a skip as well as a write, because "someone already
 * booked this" and "we booked this" are the same outcome for the retry loop.
 */
async function _bookIncome(order, amount) {
  if (order.incomeReportedAt) return { recorded: false, queued: false, skipped: 'already-marked' };
  if (!(amount > 0)) return { recorded: false, queued: false, skipped: 'no-amount' };

  const already = await finance.incomeAlreadyBooked({
    sessionId: order.stripeSessionId,
    paymentIntentId: order.stripePaymentId,
    orderId: order.id
  });
  // null means the ledger could not be read. Not evidence of anything, so do not write:
  // a missed booking is recoverable next cycle, a double booking is not.
  if (already === null) return { recorded: false, queued: false, skipped: 'ledger-unreadable' };
  if (already === true) {
    await store.updateOrder(order.id, { incomeReportedAt: new Date().toISOString(), incomeBookedBy: 'webhook' });
    return { recorded: false, queued: false, skipped: 'already-booked-elsewhere' };
  }

  const sourceCostTotal = await _sourceCostOf(order);
  const income = await finance.reportIncome({
    amount: amount,
    orderId: order.id,
    buyerId: order.buyerId,
    lineCount: (order.lines || []).length,
    sourceCostTotal: sourceCostTotal || null,
    margin: sourceCostTotal ? _round(amount - sourceCostTotal) : null,
    source: 'stripe'
  });
  if (income && income.ok) {
    await store.updateOrder(order.id, {
      incomeReportedAt: new Date().toISOString(),
      incomeBookedBy: 'reconcile'
    });
  }
  return {
    recorded: !!(income && income.recorded),
    queued: !!(income && income.queued),
    skipped: null
  };
}

/**
 * reconcilePayments({ limit }) → { ok, checked:[ {orderId, paid, reason} ] }
 *
 * THE GAP THIS CLOSES
 * Both checkout routes create a Stripe payment link and write the order as
 * 'awaiting-payment'. Nothing then ever marked a relay-store order 'paid':
 * relay-stripe-webhook writes the trade-shared marketplace store, relay-demand-webhook
 * reads a legacy array, and this engine only sweeps 'paid'. So a customer could be
 * charged and the supplier never asked to ship anything, indefinitely.
 *
 * Rather than adding an inbound webhook — a dashboard endpoint to register, a secret to
 * hold, a claim to authenticate, and a stranded order whenever a delivery fails — Relay
 * asks Stripe about its own links on the cron it already runs. Stripe is the source of
 * truth, there is nothing inbound to spoof, and a cycle that could not reach Stripe
 * simply asks again next time.
 *
 * FOUR RULES, each of which costs real money if broken:
 *   1. An error is NEVER a payment. paymentStatus() distinguishes "asked, not paid" from
 *      "could not ask", and only the first is a fact about the customer.
 *   2. The status is re-read immediately before the write, so a manual reconcile racing
 *      the cron cannot mark one order paid twice.
 *   3. Income is reported once, guarded by incomeReportedAt, because the ledger has no
 *      idea this ran twice.
 *   4. A ledger failure does NOT un-pay the order. The customer paid; that fact does not
 *      depend on our bookkeeping. It queues and drains, exactly as reportIncome intends.
 */
async function reconcilePayments(opts) {
  opts = opts || {};
  const limit = Math.max(1, parseInt(opts.limit, 10) || 25);
  const checked = [];

  // OLDEST FIRST, and read past the batch size before slicing. ordersByStatus sorts
  // newest-first and slices (lib/relay-store.js:198-203), so taking the newest N meant
  // that once more than N orders sat unpaid — abandoned carts accumulate forever — the
  // same newest N were rechecked every cycle and an older customer who finally paid was
  // never looked at again. Oldest-first means the longest-waiting customer is served
  // first and nothing can starve.
  let waiting;
  try {
    const all = await store.ordersByStatus('awaiting-payment', ORDER_SCAN);
    waiting = all.sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); }).slice(0, limit);
  } catch (e) {
    return { ok: false, error: 'could not read orders: ' + e.message, checked: checked };
  }

  for (const o of waiting) {
    if (!o.paymentLinkId) {
      // Nothing to ask about. Not an error: an order can reach this state only if the
      // payment link was never created, which the checkout already refused the sale over.
      checked.push({ orderId: o.id, paid: false, reason: 'no payment link on the order' });
      continue;
    }

    const st = await finance.paymentStatus(o.paymentLinkId);
    if (!st.ok) {
      checked.push({ orderId: o.id, paid: false, reason: st.error, asked: false });
      continue;
    }
    if (!st.paid) {
      checked.push({ orderId: o.id, paid: false, asked: true });
      continue;
    }

    // Re-read: another pass may have settled this one between the list and here.
    const fresh = await store.getOrder(o.id);
    if (!fresh || fresh.status !== 'awaiting-payment') {
      checked.push({ orderId: o.id, paid: true, alreadySettled: true });
      continue;
    }

    const collected = st.amount != null ? st.amount : fresh.total;
    const update = {
      status: 'paid',
      paidAt: new Date().toISOString(),
      stripeSessionId: st.sessionId || null,
      stripePaymentId: st.paymentIntentId || null,
      // What Stripe actually took, recorded on the order. The orphan recovery below runs
      // precisely when this loop crashed before reporting income, so it must not fall back
      // to the order's expected total and book a number the customer never paid.
      collectedAmount: collected,
      paidVia: 'reconcile'
    };
    // Worth recording rather than reconciling away: it means the link was paid for an
    // amount the order did not ask for, and a human should look at it.
    if (st.amount != null && fresh.total != null && Math.abs(st.amount - fresh.total) > 0.005) {
      update.amountMismatch = { charged: st.amount, expected: fresh.total };
    }
    await store.updateOrder(o.id, update);

    const income = await _bookIncome(Object.assign({}, fresh, update), collected);

    checked.push({
      orderId: o.id,
      paid: true,
      amount: collected,
      sessionId: st.sessionId || null,
      incomeRecorded: income.recorded,
      incomeSkipped: income.skipped || null
    });
  }

  // Orders that got as far as 'paid' but whose income was never reported. The status is
  // written before the ledger call, deliberately — a customer's payment is a fact that
  // must survive our bookkeeping failing — but that leaves a window where a crash between
  // the two loses the income silently, because the loop above only ever looks at
  // 'awaiting-payment' and would never visit this order again. This is what makes
  // incomeReportedAt a real guard rather than decoration.
  let orphans = [];
  try {
    orphans = (await store.ordersByStatus('paid', limit)).filter(function (o) {
      return !o.incomeReportedAt && o.total > 0;
    });
  } catch (e) { /* the awaiting-payment work above still stands */ }

  for (const o of orphans) {
    // What was actually collected, not what the order asked for. These are exactly the
    // orders whose income write was interrupted, and some of them are interrupted BECAUSE
    // the amount was unusual; booking the expected total here would quietly launder a
    // mismatch the paid-status write had already recorded.
    const amount = o.collectedAmount != null ? o.collectedAmount
      : (o.amountMismatch && o.amountMismatch.charged != null ? o.amountMismatch.charged : o.total);
    const income = await _bookIncome(o, amount);
    if (income.recorded || income.queued || income.skipped) {
      checked.push({ orderId: o.id, paid: true, incomeBackfilled: true, incomeSkipped: income.skipped || null });
    }
  }

  return { ok: true, checked: checked };
}

/**
 * Reconcile, and drain any income the ledger was too unwell to take earlier. Never
 * throws: it runs above the autonomy gate and must not be able to take the cycle down.
 *
 * The drain matters more than it looks. reportIncome fails SOFT — a ledger error queues
 * the event in relay:finance:unreported and still returns ok, which is right, because a
 * customer's payment must not depend on our bookkeeping. But nothing in production ever
 * called drainQueue: the only caller was the firewall test. So a queued event was marked
 * handled on the order and then sat in that queue forever. Fail-soft without a drain is
 * not resilience, it is a slow leak.
 */
async function _reconcileQuietly() {
  let checked = [];
  try {
    checked = (await reconcilePayments({ limit: 25 })).checked || [];
  } catch (e) {
    console.error('[relay-engine] payment reconcile failed:', e.message);
  }
  try {
    const depth = await finance.queueDepth();
    if (depth) await finance.drainQueue(50);
  } catch (e) {
    console.error('[relay-engine] income drain failed:', e.message);
  }
  return checked;
}

/** The 24/7 tick. Safe to call repeatedly; does nothing expensive when autonomy is off. */
async function runCycle(opts) {
  opts = opts || {};
  const started = Date.now();
  const cfg = await autonomy.getConfig();

  // BEFORE the autonomy gate, on purpose. Autonomy off means "buy nothing" — it does not
  // and must not mean "stop noticing that customers paid". A payment link stays live after
  // the switch is flipped, so a customer can pay during an off period; returning here
  // first left that order awaiting-payment for the whole outage, and the money sitting
  // with nothing recorded against it. Reconciling reads Stripe and writes our own order
  // status. It spends nothing and buys nothing, which is the only reason it belongs on
  // this side of the gate.
  const reconciledEarly = await _reconcileQuietly();
  if (cfg.mode === 'off' && !opts.force) {
    return {
      ok: false,
      skipped: true,
      reason: 'autonomy mode is off',
      mode: cfg.mode,
      paymentsReconciled: reconciledEarly
    };
  }

  const discovery = await discoverAndList(opts);

  // Already done above the autonomy gate, so the sweep below sees anything paid since the
  // last cycle without waiting an extra one.
  const reconciled = reconciledEarly;

  // Sweep paid orders that have not been sourced yet. This is also the retry path for a
  // purchase that failed transiently, which is what makes the loop self-healing.
  const swept = [];
  try {
    const orders = await store.ordersByStatus('paid', 50);
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
    paymentsReconciled: reconciled,
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
  recordOutcome,
  discoverAndList,
  fulfillLine,
  fulfillPaidOrder,
  reconcilePayments,
  pickConcept,
  referenceImage,
  getMargin,
  recentCycles,
  SEED_CONCEPTS
};
