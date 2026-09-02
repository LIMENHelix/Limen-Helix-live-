/**
 * relay-demand-search.js — a customer describes what they want; we find it for sale.
 *
 * POST /api/relay-demand-search
 * Body: { description, imageUrl?, maxPrice?, category?, condition? }
 *
 * Returns real listings priced at the operator's live margin, with source cost, source
 * URL and seller stripped out. Records the search, which is also the demand signal
 * relay-engine uses to decide what to stock next.
 *
 * UPDATED 2026-08-30 for the rewritten sourcing layer. Two behaviour changes worth
 * knowing: searchAllSources now returns { ok, items, reason } instead of a bare array,
 * and it returns real listings or none at all. Before this, a search that found nothing
 * still came back full of invented items, so a "no results" answer was impossible to get
 * and every result was unbuyable.
 */

const db = require('../lib/limen-db');
const sourceSearch = require('../lib/relay-source-search');
const marginCalc = require('../lib/relay-margin-calculator');
const policy = require('../lib/relay-policy');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const description = (body.description || '').trim();
    const imageUrl = body.imageUrl || '';
    const maxPrice = parseFloat(body.maxPrice) || 500;
    const category = body.category || null;
    const condition = body.condition || null;

    if (!description && !imageUrl) {
      return res.status(400).json({ error: 'description or imageUrl required' });
    }

    // The box is labelled "Max Price", so the customer means the price THEY pay. The
    // search filters on acquisition cost, so a $100 maximum was admitting a $90 item and
    // then showing it at $121.50 under the default 35% margin — over the budget they set.
    // Convert their number to a cost ceiling using the same live margin the purchase will
    // charge on, and hand the original through so the refusal quotes their figure.
    const liveMargin = await marginCalc.getMargin();
    // FLOOR, not round. Rounding to the nearest cent rounds UP half the time, and a cost
    // ceiling a cent too high displays a price a cent over the maximum: at 35%, a $7 max
    // rounds to a $5.19 ceiling, and $5.19 sells for $7.01. The purchase endpoint then
    // refuses an item the search had just offered, with nothing having changed.
    const costCeiling = Math.floor((maxPrice / (1 + liveMargin)) * 100) / 100;

    const found = await sourceSearch.searchAllSources({
      description: description,
      imageUrl: imageUrl,
      maxPrice: costCeiling,
      maxPriceLabel: maxPrice,
      category: category,
      condition: condition
    });

    const items = found.items || [];
    const withMargins = await marginCalc.applyMarginToSearchResults(items);

    // Record the search even when it found nothing. A miss is the most useful signal
    // there is: it tells the engine what customers want that we cannot yet supply.
    const searchId = 'search_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    let searches = await db.get('relay:searches') || [];
    searches.push({
      searchId: searchId,
      ts: new Date().toISOString(),
      description: description,
      imageUrl: imageUrl || null,
      maxPrice: maxPrice,
      category: category,
      condition: condition,
      resultCount: withMargins.length,
      sources: found.sources || [],
      // Internal only. This is how a later purchase resolves back to something buyable.
      sourceMapping: items.map(function (r) {
        return {
          itemId: r.itemId,
          source: r.source,
          sourceCost: r.price,
          sourceUrl: r.url,
          buyable: r.buyable === true,
          // Freight provenance. Dropping these was a live money defect: buyFromCJ only
          // requotes shipping to the customer's real country when sourceShipping is
          // present (lib/relay-buy.js:185), so a customer-initiated purchase skipped the
          // requote and ordered at a cost quoted to CJ's DEFAULT destination, and with
          // fromCountry null it asked the default CN warehouse to ship a variant that may
          // have been quoted from US or EU stock. The engine's own path recorded them all
          // along (lib/relay-engine.js:251-253); only this path lost them.
          sourceShipping: r.shipping != null ? r.shipping : null,
          sourceCarrier: r.carrier || null,
          sourceFromCountry: r.fromCountry || null,
          sourceProvider: r.provider || null,
          // The title the customer actually clicked, and the condition of the thing that
          // will ship. Without them relay-demand-purchase labelled the listing, the order
          // line and the payment with the raw search text: someone who chose
          // "Case - Blue / iPhone 15" paid for an order that read "phone case", while the
          // hidden variant id decided what arrived. Condition was worse than cosmetic —
          // it stamped the REQUESTED condition on the listing, so a new CJ product could
          // be described to the buyer as used.
          title: r.title || null,
          sourceVariantKey: r.variantKey || null,
          sourceCondition: r.condition || null,
          // The price the customer actually saw next to this item. relay-demand-purchase
          // refuses to charge above it, so a dearer destination requote or a margin change
          // between the search and the confirmation cannot quietly raise the bill.
          displayedPrice: marginCalc.calculateMargin(r.price, liveMargin).customerPrice
        };
      })
    });
    if (searches.length > 1000) searches = searches.slice(-1000);
    await db.set('relay:searches', searches);

    if (!withMargins.length) {
      return res.status(200).json({
        searchId: searchId,
        description: description,
        maxPrice: maxPrice,
        resultCount: 0,
        results: [],
        message: 'Nothing found for sale under $' + maxPrice + ' right now. The search was ' +
                 'recorded and Relay will keep looking.',
        reason: found.reason || null
      });
    }

    return res.status(200).json({
      searchId: searchId,
      description: description,
      maxPrice: maxPrice,
      resultCount: withMargins.length,
      results: withMargins,
      // Surfaced with the results so the buyer sees the terms before, not after, they pick.
      policy: {
        version: policy.POLICY_VERSION,
        headline: policy.getPolicy().headline,
        url: '/api/relay?view=policy'
      }
    });
  } catch (e) {
    console.error('[relay-demand-search]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
