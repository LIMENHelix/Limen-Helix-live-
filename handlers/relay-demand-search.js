/**
 * relay-demand-search.js — Customer searches for items they want
 *
 * POST /api/relay-demand-search
 * Body: { description, maxPrice, category, condition }
 *
 * Returns: top items from all sources with 25% margin applied (source cost hidden)
 * Also records search for fulfillment tracking
 */

const db = require('../lib/limen-db');
const sourceSearch = require('../lib/relay-source-search');
const marginCalc = require('../lib/relay-margin-calculator');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { description, maxPrice = 500, category, condition } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description required' });
    }

    // Search all sources
    const results = await sourceSearch.searchAllSources({
      description,
      maxPrice,
      category,
      condition
    });

    if (!results || results.length === 0) {
      return res.status(404).json({
        message: 'No items found',
        searchId: null,
        results: []
      });
    }

    // Apply 25% margin, hide source prices
    const withMargins = marginCalc.applyMarginToSearchResults(results);

    // Record search for tracking
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const searches = await db.get('relay:searches') || [];
    searches.push({
      searchId,
      ts: new Date().toISOString(),
      description,
      maxPrice,
      category,
      condition,
      resultCount: withMargins.length,
      sourceMapping: results.map(r => ({
        itemId: r.itemId,
        source: r.source,
        sourceCost: r.price,
        sourceUrl: r.url
      }))
    });

    // Keep last 1000 searches
    if (searches.length > 1000) {
      searches.splice(0, searches.length - 1000);
    }

    await db.set('relay:searches', searches);

    return res.status(200).json({
      searchId,
      description,
      maxPrice,
      resultCount: withMargins.length,
      results: withMargins
    });

  } catch (e) {
    console.error('[relay-demand-search]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
