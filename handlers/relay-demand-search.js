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

    const found = await sourceSearch.searchAllSources({
      description: description,
      imageUrl: imageUrl,
      maxPrice: maxPrice,
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
          buyable: r.buyable === true
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
        url: '/api/relay-policy'
      }
    });
  } catch (e) {
    console.error('[relay-demand-search]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
