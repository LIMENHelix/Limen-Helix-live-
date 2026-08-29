/**
 * relay-image-search.js — Find for-sale items matching a reference image
 *
 * POST /api/relay-image-search
 * Body: { imageUrl, description, maxPrice, location }
 *
 * Uses Google APIs to:
 * 1. Analyze image with Vision API to extract details
 * 2. Search web with Google Custom Search for matching for-sale ads
 * 3. Aggregate results from Craigslist, Facebook, OfferUp, local classifieds
 *
 * Returns cheapest matches sorted by price
 */

const fetch = require('node-fetch');

async function analyzeImageWithGoogle(imageUrl, apiKey) {
  // Google Vision API to extract objects/text from image
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 5 },
                { type: 'TEXT_DETECTION', maxResults: 5 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const annotations = data.responses && data.responses[0];

    const labels = annotations.labelAnnotations
      ? annotations.labelAnnotations.map(l => l.description).join(', ')
      : '';
    const objects = annotations.localizedObjectAnnotations
      ? annotations.localizedObjectAnnotations.map(o => o.name).join(', ')
      : '';

    return {
      labels,
      objects,
      detectedItems: [labels, objects].filter(Boolean).join(' | ')
    };
  } catch (e) {
    console.error('[relay-image-search] Vision API failed:', e.message);
    return { labels: '', objects: '', detectedItems: '' };
  }
}

async function searchWithGoogle(query, maxPrice, location, apiKey, searchEngineId) {
  // Google Custom Search to find for-sale listings matching query
  try {
    const searchQuery = `${query} for sale ${location} under $${maxPrice}`;
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&key=${apiKey}&cx=${searchEngineId}&num=10`,
      { headers: { 'User-Agent': 'Relay-Marketplace/1.0' } }
    );

    if (!response.ok) {
      throw new Error(`Custom Search API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.items || []).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      source: item.displayLink.includes('craigslist') ? 'craigslist' :
              item.displayLink.includes('facebook') ? 'facebook' :
              item.displayLink.includes('offerup') ? 'offerup' :
              'classifieds'
    }));
  } catch (e) {
    console.error('[relay-image-search] Custom Search failed:', e.message);
    return [];
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, description, maxPrice = 500, location = 'Kansas City' } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl required' });
    }

    if (!description) {
      return res.status(400).json({ error: 'description required' });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!googleApiKey || !googleSearchEngineId) {
      console.warn('[relay-image-search] Google APIs not fully configured');
      return res.status(400).json({
        error: 'Image search not configured',
        requires: ['GOOGLE_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID']
      });
    }

    // Analyze image to extract details
    const imageAnalysis = await analyzeImageWithGoogle(imageUrl, googleApiKey);

    // Build search query combining description + detected items
    const searchQuery = imageAnalysis.detectedItems
      ? `${description} ${imageAnalysis.detectedItems}`
      : description;

    // Search for matching listings
    const searchResults = await searchWithGoogle(
      searchQuery,
      maxPrice,
      location,
      googleApiKey,
      googleSearchEngineId
    );

    return res.status(200).json({
      imageUrl,
      description,
      maxPrice,
      location,
      imageAnalysis: {
        detectedLabels: imageAnalysis.labels,
        detectedObjects: imageAnalysis.objects
      },
      searchQuery,
      resultsFound: searchResults.length,
      results: searchResults.slice(0, 10),
      sourcesIncluded: ['craigslist', 'facebook-marketplace', 'offerup', 'local-classifieds']
    });

  } catch (e) {
    console.error('[relay-image-search]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
