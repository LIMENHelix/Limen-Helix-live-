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
const ORDER_SCAN = 100000;
// How long a booking claim is honoured before another cycle may take it. Long enough that
// a slow ledger write is not stolen mid-flight, short enough that a crash cannot wedge an
// order out of income recovery.
const INCOME_CLAIM_STALE_MS = 60 * 1000;
// When each awaiting-payment order was last asked about. Kept OUT of the orders map so
// the rotation does not add a whole-map rewrite per order per cycle. See reconcilePayments.
const PAYMENT_CHECK_KEY = 'relay:payment-checks';
// Wall-clock budget for one reconcile pass. Well inside the function's maxDuration, so
// the rotation map is always persisted and progress is never thrown away.
const RECONCILE_DEADLINE_MS = 120 * 1000;

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
  // The floor comes from the LIVE autonomy config, never a constant here: this number and
  // the one the purchase gate enforces have to be the same number, and a second copy of it
  // in this file is exactly how the publish gate drifted from the purchase gate before.
  const gateCfg = await autonomy.getConfig();
  const floorUsd = parseFloat(gateCfg.minMarginUsd) || 0;

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
  const refusedByGate = [];
  for (const item of found.items) {
    if (published.length >= maxPerCycle) break;
    if (existingUrls.has(item.url)) continue;

    // PRICE TO THE FLOOR, NOT JUST THE MARKUP.
    //
    // item.price is LANDED cost: every source folds freight in before the engine sees it
    // (lib/relay-cj.js:334 product + freight, relay-source-search.js:121 and :200 the
    // same), and CJ drops anything it cannot fully price rather than publishing an
    // unpriced shipping charge. So the old `item.price * (1 + margin)` was already
    // pricing landed cost. That was never the defect.
    //
    // The defect is arithmetic. The purchase gate needs salePrice - landed >= minMarginUsd,
    // and with a markup of m that difference is exactly cost * m. At the default 35% a
    // flat $8 floor is therefore unreachable for any item under $22.86 landed: the entire
    // cheap catalogue was published and then refused at checkout, by construction, and no
    // amount of repricing at 35% could have fixed it. A real customer hit this on a $11.50
    // phone case whose landed cost was $8.52.
    //
    // Pricing to the greater of the markup and the floor keeps those items sellable. A
    // cheap item carries a higher effective percentage, which is the right shape for what
    // is really a flat handling cost.
    const price = _round(Math.max(item.price * (1 + margin), item.price + floorUsd));

    // THE SAME GATE THE BUYER WILL MEET, ASKED NOW.
    //
    // The old test was `price > item.price`: any positive spread. The purchase path
    // demands the greater of minMarginUsd and minMarginPct on landed cost, so the
    // storefront listed items the checkout was always going to refuse. That is one rule
    // with two implementations, which is the same shape as the double-purchase P1 this
    // repo has already been bitten by; asking the real gate is the only version that
    // cannot drift.
    //
    // dryRun takes no reservation and writes no ledger row (the dryRun return in
    // lib/relay-autonomy.js precedes the reserve block). skipFunds is explained there and
    // is honoured only in combination with dryRun.
    const gate = await autonomy.authorize({
      amount: item.price,
      salePrice: price,
      marketplace: item.source,
      note: item.title,
      dryRun: true,
      skipFunds: true
    });
    if (!gate.allowed) {
      // Logged, not surfaced: this is our margin policy, and it never belongs in front of
      // a customer. Counted so a cycle that publishes nothing can say why.
      refusedByGate.push({ url: item.url, reason: gate.reason });
      console.warn('[relay-engine] not listing: ' + JSON.stringify({ title: item.title.slice(0, 60), reason: gate.reason }));
      continue;
    }

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
    refusedByGate: refusedByGate.length,
    refusedReasons: refusedByGate.slice(0, 5),
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

  // A human's approval is spent HERE, or nowhere. Before this, approve() stamped the
  // reservation and fulfilment called authorize() again regardless — in queue mode that
  // took a second reservation, re-queued, and bought nothing, while both reservations sat
  // 'reserved' burning the day's ceiling. consumeApproved re-checks everything authorize
  // would (mode, degraded, funds, amount, binding, day) and refuses to the same fallback
  // if any of it fails, so this is a gate the operator opens, not a way around one.
  let decision = null;
  if (opts && opts.decisionId) {
    const consumed = await autonomy.consumeApproved({
      decisionId: opts.decisionId,
      orderId: order.id,
      listingId: listing.id,
      amount: sourceCost
    });
    if (consumed.allowed) decision = consumed;
    // A REFUSED APPROVAL IS AN ANSWER, NOT A REASON TO BUY. Every non-allowed branch
    // returns here. Falling through to authorize() meant an operator's click on a row
    // consumeApproved had just rejected started a SECOND purchase of a line that already
    // held a live reservation: pending() listed auto-mode rows, clicking one refused with
    // 'that reservation was not queued for approval', and the fresh authorize() bought it
    // again. The refusal was stored and then only ever read on the failure path, so when
    // the re-authorisation SUCCEEDED the operator was told nothing at all.
    //
    // The state is 'awaiting-approval' for every refusal, including ones that read more
    // like 'blocked' (autonomy off, ledger unreachable). That is a safety choice, not a
    // cosmetic one. 'blocked' aggregates to fulfillment.state 'failed', and the reconcile
    // sweep re-buys any paid order in that state by calling fulfillPaidOrder WITHOUT a
    // decisionId, straight into authorize(). Labelling these 'failed' would hand the
    // duplicate purchase to the next cycle instead of stopping it. 'awaiting-approval' is
    // not swept, and _unfulfilledLines still counts the line, so the console shows it.
    else {
      return {
        listingId: line.listingId,
        ok: false,
        state: 'awaiting-approval',
        decisionId: null,
        // Another line's approval is 'not this line', not a refusal of this one.
        reason: consumed.mismatch
          ? 'not the approved line; left queued'
          : 'approval not used: ' + (consumed.reason || 'refused'),
        approvalRefused: consumed.mismatch ? null : (consumed.reason || 'refused'),
        skipped: true
      };
    }
  }

  if (!decision) {
    decision = await autonomy.authorize({
      amount: sourceCost,
      salePrice: salePrice,
      marketplace: listing.sourceMarketplace,
      orderId: order.id,
      listingId: listing.id,
      note: listing.title
    });
  }

  if (!decision.allowed) {
    let taskId = null;
    // Queued still needs the human-facing task, so the work is visible somewhere.
    if (decision.queued) {
      const filed = await buy.fileManualTask({
        orderId: order.id,
        listingId: listing.id,
        sourceMarketplace: listing.sourceMarketplace,
        sourceUrl: listing.sourceUrl,
        // The variant and the name travel with the task: a CJ product page lists every
        // size and colour, and sourceId is the only thing that says which one to buy.
        sourceId: listing.sourceId,
        title: listing.title,
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
      // When an approval was offered and refused, THAT is the answer the operator needs.
      // Reporting only the fresh gate's "queued for human approval" after their click was
      // rejected tells them to click again, which is what they were already doing.
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
const INCOME_CLAIM_KEY = 'relay:income-claims';

/**
 * Best-effort claim on booking one order's income. Write a token, read it back, and only
 * proceed if it is still ours. limen-db offers no compare-and-set, so this is not a
 * transaction; it narrows the double-book window from the whole read-then-write gap to
 * two writes landing simultaneously, and the ledger check behind it catches the rest.
 * A claim older than the stale window is reclaimable, so a crash mid-booking cannot
 * wedge an order out of recovery forever.
 */
async function _claimIncome(orderId) {
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  try {
    const claims = (await db.get(INCOME_CLAIM_KEY)) || {};
    const held = claims[orderId];
    if (held && (Date.now() - (held.at || 0)) < INCOME_CLAIM_STALE_MS) {
      return { ok: false, heldBy: held.token };
    }
    claims[orderId] = { token: token, at: Date.now() };
    // Old claims are dropped so this map cannot grow without bound.
    for (const k of Object.keys(claims)) {
      if (Date.now() - (claims[k].at || 0) > INCOME_CLAIM_STALE_MS * 20) delete claims[k];
    }
    await db.set(INCOME_CLAIM_KEY, claims);
    const back = (await db.get(INCOME_CLAIM_KEY)) || {};
    return { ok: !!(back[orderId] && back[orderId].token === token), token: token };
  } catch (e) {
    // Cannot claim, cannot be sure. The ledger check still guards the write, and a
    // missed booking is recoverable next cycle.
    return { ok: false, error: e.message };
  }
}

/** Give a claim back, so a decision not to write does not also block the retry. */
async function _releaseIncomeClaim(orderId) {
  try {
    const claims = (await db.get(INCOME_CLAIM_KEY)) || {};
    delete claims[orderId];
    await db.set(INCOME_CLAIM_KEY, claims);
  } catch (e) { /* the claim expires on its own */ }
}

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

  // CLAIM FIRST, then check, then write. The ledger read and the ledger write are two
  // operations, so two overlapping reconciles could both read "not booked" and both
  // append. limen-db has no compare-and-set, so this is a write-then-verify claim: whoever
  // reads back their own token owns the booking, and the loser stands down. It is not a
  // transaction and does not pretend to be — it closes the window from "the whole gap
  // between read and write" to "two writes landing in the same instant", and the ledger
  // check behind it still catches anything that slips through.
  const claim = await _claimIncome(order.id);
  if (!claim.ok) return { recorded: false, queued: false, skipped: 'claimed-elsewhere' };

  const already = await finance.incomeAlreadyBooked({
    sessionId: order.stripeSessionId,
    paymentIntentId: order.stripePaymentId,
    orderId: order.id
  });
  // null means the ledger could not be read. Not evidence of anything, so do not write:
  // a missed booking is recoverable next cycle, a double booking is not.
  if (already === null) {
    // Hand the claim back. Holding it would make a transient ledger blip block the retry
    // for the whole claim window, when the entire point of declining to write was that
    // the booking should be tried again.
    await _releaseIncomeClaim(order.id);
    return { recorded: false, queued: false, skipped: 'ledger-unreadable' };
  }
  if (already === true) {
    // 'already-booked', not 'webhook'. A boolean deduplication result says the charge is
    // in the books; it does NOT say who put it there. A previous reconcile that wrote the
    // ledger and then crashed before marking the order looks identical from here, and
    // recording 'webhook' for that would be a false audit trail on a financial event.
    await store.updateOrder(order.id, { incomeReportedAt: new Date().toISOString(), incomeBookedBy: 'already-booked' });
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
  // RECORDED OR QUEUED, not merely ok. reportIncome returns ok:true even when the ledger
  // write AND the fallback queue write both failed (lib/relay-finance-bridge.js:253-255),
  // so marking on ok alone stamped "handled" on an event that exists nowhere, and every
  // later orphan pass then skipped that order permanently. Losing the income silently is
  // worse than reporting it late.
  // `recorded` is not the same as durable: finance-ledger.record writes through
  // limen-db.lpush, which falls back to process memory on a Redis failure and still
  // reports success. So a "recorded" event can exist only in a lambda that is about to
  // disappear. Confirm it with the strict read before calling it handled; if the read
  // cannot confirm, leave the order unmarked and let a later cycle try again. A queued
  // event is different — the queue is Relay's own and drains on the cycle — so that one
  // is taken at its word.
  // Read the write back where we can, but MARK EITHER WAY.
  //
  // The first attempt at this refused to mark unless the strict read confirmed the event,
  // which is worse than the problem: when confirmation is unavailable — the same Redis
  // outage that made the write non-durable — the order is never marked and every
  // subsequent cycle books it again. The tests caught it doing exactly that. Booking one
  // payment repeatedly is a certain corruption of the ledger; a single write that might
  // have landed in process memory is a possible loss. Between a certainty and a
  // possibility, take the possibility, and make it visible instead of silent.
  let unconfirmed = false;
  if (income && income.ok && income.recorded) {
    const confirmed = await finance.incomeAlreadyBooked({
      sessionId: order.stripeSessionId,
      paymentIntentId: order.stripePaymentId,
      orderId: order.id
    });
    unconfirmed = confirmed !== true;
  }
  if (income && income.ok && (income.recorded || income.queued)) {
    await store.updateOrder(order.id, {
      incomeReportedAt: new Date().toISOString(),
      incomeBookedBy: 'reconcile',
      // Set when the ledger could not confirm its own write. Not a failure, and not a
      // reason to book again: a flag for an operator or an audit to chase.
      incomeDurabilityUnconfirmed: unconfirmed || null
    });
  } else {
    // Nothing was booked, so nothing is owned. Keeping the claim would make a failed
    // write block its own retry for the whole claim window — the claim exists to stop a
    // SECOND booking, not to stop a first one from ever happening.
    await _releaseIncomeClaim(order.id);
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

  // Rotation state, in Relay's own key rather than on each order. See where it is written.
  let checkedAt = {};
  try { checkedAt = (await db.get(PAYMENT_CHECK_KEY)) || {}; } catch (e) { checkedAt = {}; }

  // OLDEST FIRST, and read past the batch size before slicing. ordersByStatus sorts
  // newest-first and slices (lib/relay-store.js:198-203), so taking the newest N meant
  // that once more than N orders sat unpaid — abandoned carts accumulate forever — the
  // same newest N were rechecked every cycle and an older customer who finally paid was
  // never looked at again. Oldest-first means the longest-waiting customer is served
  // first and nothing can starve.
  // LEAST-RECENTLY-CHECKED first, not simply oldest. Sorting by age alone only reversed
  // the starvation: a batch of old abandoned carts would sort to the front every cycle
  // and a newer customer who actually paid would never be queried. Ordering by when we
  // last asked about each order makes the queue rotate — every order is revisited, and an
  // abandoned one drifts to the back on its own after being checked.
  let waiting;
  try {
    const all = await store.ordersByStatus('awaiting-payment', ORDER_SCAN);
    waiting = all.sort(function (a, b) {
      const ca = checkedAt[a.id] || 0;
      const cb = checkedAt[b.id] || 0;
      if (ca !== cb) return ca - cb;                       // never-checked first
      return new Date(a.ts) - new Date(b.ts);              // then the longest waiting
    }).slice(0, limit);
  } catch (e) {
    return { ok: false, error: 'could not read orders: ' + e.message, checked: checked };
  }

  const deadline = Date.now() + RECONCILE_DEADLINE_MS;
  for (const o of waiting) {
    // A per-request timeout does not bound a loop: ten pages per order across a batch can
    // outlive the function, and because the rotation map is persisted after the loop, a
    // termination discards every timestamp and the next cron picks the same slow links
    // again — starving the paid orders behind them indefinitely. Stop early and KEEP the
    // progress instead.
    if (Date.now() > deadline) {
      checked.push({ orderId: o.id, paid: false, asked: false, reason: 'reconcile deadline reached' });
      break;
    }
    if (!o.paymentLinkId) {
      // Nothing to ask about. Not an error: an order can reach this state only if the
      // payment link was never created, which the checkout already refused the sale over.
      checked.push({ orderId: o.id, paid: false, reason: 'no payment link on the order' });
      continue;
    }

    const st = await finance.paymentStatus(o.paymentLinkId);
    // Recorded in Relay's OWN key, not written back onto the order.
    //
    // relay-store.updateOrder rewrites the ENTIRE relay:store:orders map, and so does
    // createOrder. Two callers reading separate snapshots means the later write can drop
    // the other's order outright — a checkout's brand-new order vanishing because a
    // reconcile committed an older snapshot over it, leaving a customer holding a payment
    // link for an order that no longer exists. That hazard is in the store already; what
    // is NOT acceptable is this loop adding a recurring whole-map write per unpaid order
    // per cycle and widening the window every 30 minutes.
    //
    // Rotation state is this loop's business, not the order's, so it lives in one small
    // key only this loop touches. Unpaid orders now cause zero writes to the orders map.
    checkedAt[o.id] = Date.now();
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

    // The ORDER'S charge, not the sum of every charge against the link.
    //
    // Booking the aggregate was wrong twice over. The webhook books per SESSION, so if it
    // had already booked one of the duplicates, adding the total on top double-books that
    // session — and incomeAlreadyBooked answers per order, so it cannot see the half of a
    // sum that was already taken. And a duplicate charge is money on its way back to the
    // customer: recording it as income inflates net income and lendable surplus for
    // whatever the refund takes to happen.
    //
    // So one charge is booked, the extras are recorded on the order, and the order is held
    // for review. A second charge is a refund decision, not revenue.
    const collected = st.amount != null ? st.amount : fresh.total;
    // Income is what the sale EARNED, capped at what the order asked for. An overpayment
    // is money owed back, so booking the whole amount records revenue that is about to
    // leave again and inflates net income and lendable surplus until the refund happens.
    // The excess is recorded on the order (amountMismatch) and the order is held, which
    // is where a refund decision belongs.
    const bookable = fresh.total != null && collected > fresh.total ? fresh.total : collected;
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

    // UNDERPAYMENT AND DOUBLE PAYMENT DO NOT GO TO THE AUTOMATIC QUEUE.
    // Fulfilment authorises against the order's expected sale price, not against what was
    // actually collected, so an order paid short would be bought at a margin that no
    // longer exists — possibly at a loss — and shipped, on the same cycle. A link paid
    // twice is a customer owed either a second delivery or a refund, and neither is a
    // decision a loop should make alone. Both leave the money recorded and the order out
    // of the paid sweep, which only ever asks for 'paid'.
    // EVERY material mismatch, not only short payments. An overpayment is money the
    // customer is owed back; letting the loop buy and ship on it leaves the excess with no
    // path to a refund and nobody looking. Wrong in the other direction is still wrong.
    const mismatched = st.amount != null && fresh.total != null &&
                       Math.abs(st.amount - fresh.total) > 0.005;
    const doublePaid = Array.isArray(st.duplicatePayments) && st.duplicatePayments.length > 1;
    if (mismatched || doublePaid) {
      update.status = 'payment-review';
      update.reviewReason = doublePaid
        ? 'this payment link was paid ' + st.duplicatePayments.length + ' times'
        : 'paid $' + Number(st.amount).toFixed(2) + ' against $' + Number(fresh.total).toFixed(2) + ' owed';
      if (doublePaid) update.duplicatePayments = st.duplicatePayments;
    }
    await store.updateOrder(o.id, update);

    // The link has done its job. Leaving it open lets the same customer be charged again
    // into silence, because nothing revisits a settled order's link. A settled sale is not
    // unwound because Stripe would not close a link — but a failure here is RECORDED, not
    // shrugged off, so the retry below reaches it on a later cycle. "Best effort" that
    // never tries twice is just a failure with better manners.
    try {
      const closed = await finance.closePaymentLink(o.paymentLinkId);
      await store.updateOrder(o.id, closed.ok
        ? { paymentLinkClosedAt: new Date().toISOString() }
        : { paymentLinkCloseError: closed.error || 'unknown' });
    } catch (e) {
      try { await store.updateOrder(o.id, { paymentLinkCloseError: e.message }); } catch (e2) {}
    }

    const income = await _bookIncome(Object.assign({}, fresh, update), bookable);

    checked.push({
      orderId: o.id,
      paid: true,
      amount: collected,
      sessionId: st.sessionId || null,
      incomeRecorded: income.recorded,
      incomeSkipped: income.skipped || null,
      review: update.status === 'payment-review' ? update.reviewReason : null
    });
  }

  // Orders that got as far as 'paid' but whose income was never reported. The status is
  // written before the ledger call, deliberately — a customer's payment is a fact that
  // must survive our bookkeeping failing — but that leaves a window where a crash between
  // the two loses the income silently, because the loop above only ever looks at
  // 'awaiting-payment' and would never visit this order again. This is what makes
  // incomeReportedAt a real guard rather than decoration.
  // FILTER, THEN limit. ordersByStatus slices the newest N before returning, so taking N
  // paid orders and then filtering meant that once N newer orders sat in 'paid' — which
  // they do whenever fulfilment is failing or awaiting approval — an older order missing
  // its income marker was never in the window and its income was never backfilled.
  let orphans = [];
  try {
    // 'payment-review' as well as 'paid'. An order held for review is one where money
    // definitely arrived, so its income still has to be booked; scanning only 'paid' left
    // exactly the orders with a payment problem as the ones whose payment was never
    // recorded, which is the wrong way round.
    // 'shipped' as well: an order fulfilled before its income write succeeded moves on to
    // that status and would otherwise never be scanned again, losing the income of a sale
    // that actually completed.
    const paidish = (await store.ordersByStatus('paid', ORDER_SCAN))
      .concat(await store.ordersByStatus('payment-review', ORDER_SCAN))
      .concat(await store.ordersByStatus('shipped', ORDER_SCAN));
    orphans = paidish
      // EVIDENCE of payment, not merely a status. A status can be set by hand — an
      // operator marking something shipped, a repair script — and booking income for one
      // of those invents revenue nobody paid. Something Stripe told us has to be on the
      // order before its money is recorded.
      .filter(function (o) {
        return !o.incomeReportedAt && o.total > 0 &&
               !!(o.stripeSessionId || o.stripePaymentId || o.paidAt || o.collectedAmount != null);
      })
      .slice(0, limit);
  } catch (e) { /* the awaiting-payment work above still stands */ }

  for (const o of orphans) {
    // What was actually collected, not what the order asked for. These are exactly the
    // orders whose income write was interrupted, and some of them are interrupted BECAUSE
    // the amount was unusual; booking the expected total here would quietly launder a
    // mismatch the paid-status write had already recorded.
    const amount = o.collectedAmount != null ? o.collectedAmount
      : (o.amountMismatch && o.amountMismatch.charged != null ? o.amountMismatch.charged : o.total);
    // Capped the same way as the live settle path: an overpayment's excess is owed back,
    // not earned, and recovery must not book what the settle deliberately did not.
    const income = await _bookIncome(o, (o.total != null && amount > o.total) ? o.total : amount);
    // A backfill is only a backfill if income actually moved. 'claimed-elsewhere' and
    // 'ledger-unreadable' are reasons NOTHING happened, and reporting them as repaired
    // told the operator a bookkeeping gap had been closed while it is still open.
    if (income.recorded || income.queued) {
      checked.push({ orderId: o.id, paid: true, incomeBackfilled: true });
    } else if (income.skipped) {
      checked.push({ orderId: o.id, paid: true, incomeBackfilled: false, incomeSkipped: income.skipped });
    }
  }

  // One write for the whole cycle's rotation, into a key nothing else touches. Entries
  // for orders that have left awaiting-payment are dropped so it cannot grow unbounded.
  try {
    const live = {};
    for (const o of waiting) if (checkedAt[o.id]) live[o.id] = checkedAt[o.id];
    await db.set(PAYMENT_CHECK_KEY, Object.assign({}, live, Object.fromEntries(
      Object.entries(checkedAt).filter(function (e) { return Date.now() - e[1] < 30 * 24 * 3600 * 1000; })
    )));
  } catch (e) { /* rotation restarts from zero next cycle, which is harmless */ }

  // Links that settled but would not close. Until one closes, that customer can still be
  // charged again through it, so this retries every cycle rather than leaving a one-shot
  // attempt to stand as the final word.
  try {
    // 'shipped' too. An order that fulfilled before its link closed still has a live link
    // the customer can be charged through, and that was the one status this retry missed.
    const unclosed = (await store.ordersByStatus('paid', ORDER_SCAN))
      .concat(await store.ordersByStatus('payment-review', ORDER_SCAN))
      .concat(await store.ordersByStatus('shipped', ORDER_SCAN))
      // Only links whose order was actually PAID. An order forced to 'shipped' by hand
      // has an unpaid link, and closing it takes away the customer's only way to pay —
      // turning a bookkeeping shortcut into a sale nobody can complete.
      .filter(function (o) {
        return o.paymentLinkId && !o.paymentLinkClosedAt &&
               !!(o.stripeSessionId || o.stripePaymentId || o.paidAt || o.collectedAmount != null);
      })
      // Rotate, for the same reason the payment queue does: a link Stripe keeps refusing
      // to close would otherwise sit at the front of every cycle and starve the ones
      // behind it — which are the links still open to a second charge.
      .sort(function (a, b) {
        const aa = a.lastCloseAttemptAt ? new Date(a.lastCloseAttemptAt).getTime() : 0;
        const bb = b.lastCloseAttemptAt ? new Date(b.lastCloseAttemptAt).getTime() : 0;
        return aa - bb;
      })
      .slice(0, limit);
    for (const o of unclosed) {
      const closed = await finance.closePaymentLink(o.paymentLinkId);
      await store.updateOrder(o.id, closed.ok
        ? { paymentLinkClosedAt: new Date().toISOString(), paymentLinkCloseError: null, lastCloseAttemptAt: new Date().toISOString() }
        : { lastCloseAttemptAt: new Date().toISOString(), paymentLinkCloseError: closed.error || 'unknown' });
    }
  } catch (e) { /* retried next cycle */ }

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
  let cfg = await autonomy.getConfig();

  // BEFORE the autonomy gate, on purpose. Autonomy off means "buy nothing" — it does not
  // and must not mean "stop noticing that customers paid". A payment link stays live after
  // the switch is flipped, so a customer can pay during an off period; returning here
  // first left that order awaiting-payment for the whole outage, and the money sitting
  // with nothing recorded against it. Reconciling reads Stripe and writes our own order
  // status. It spends nothing and buys nothing, which is the only reason it belongs on
  // this side of the gate.
  const reconciledEarly = await _reconcileQuietly();
  // RE-READ the mode. Reconciling talks to Stripe and can take a while; an operator who
  // flips the switch to off during it means off, and buying on a mode read before that
  // decision spends against an instruction already given.
  cfg = await autonomy.getConfig();
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
    // Filter, THEN limit. Taking the newest 50 and filtering after meant that once 50
    // newer paid orders were already fulfilled, an older one still waiting to be bought
    // was never in the window — the same slice-before-filter shape as the income scan.
    const orders = await store.ordersByStatus('paid', ORDER_SCAN);
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
