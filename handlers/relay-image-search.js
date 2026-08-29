/**
 * relay-image-search.js — Find for-sale items matching a reference image
 *
 * POST /api/relay-image-search
 * Body: { imageUrl, description, maxPrice }
 *
 * Uses the generated reference image to search for matching items across:
 * - Facebook Marketplace
 * - Craigslist
 * - OfferUp
 * - LetGo
 * - Local classified ads
 *
 * Returns cheapest matches sorted by price
 */

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, description, maxPrice = 500 } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl required' });
    }

    if (!description) {
      return res.status(400).json({ error: 'description required' });
    }

    // For now, return structured results that can be populated by actual APIs
    // This scaffolds the flow while we integrate real image search APIs

    const results = {
      imageUrl,
      description,
      maxPrice,
      searches: [
        {
          source: 'facebook-marketplace',
          status: 'pending',
          note: 'Requires Facebook Marketplace API key'
        },
        {
          source: 'craigslist',
          status: 'pending',
          note: 'Requires location parameter for search'
        },
        {
          source: 'offerup',
          status: 'pending',
          note: 'Requires OfferUp API credentials'
        },
        {
          source: 'google-lens',
          status: 'pending',
          note: 'Uses Google Lens for reverse image search'
        }
      ],
      items: [
        // Placeholder for when APIs are integrated
        // {
        //   source: 'craigslist',
        //   title: 'Levi 505 Jeans',
        //   price: 25,
        //   location: 'Kansas City, MO',
        //   url: 'https://...',
        //   imageMatch: 0.92,
        //   postedAt: '2 hours ago'
        // }
      ],
      recommendation: 'Set up image matching APIs to find matching items across platforms'
    };

    return res.status(200).json(results);

  } catch (e) {
    console.error('[relay-image-search]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
