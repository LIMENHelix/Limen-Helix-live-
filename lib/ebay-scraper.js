/**
 * lib/ebay-scraper.js — Scrape eBay listings using Browse API
 *
 * Uses eBay's public Browse API (no authentication required for basic searches)
 * Fetches active listings, extracts product data, creates Relay listings
 */

const marketplace = require('./relay-marketplace');

const EBAY_API = 'https://api.ebay.com/buy/browse/v1';

// Map eBay categories to Relay categories
const CATEGORY_MAP = {
  '15687': 'fashion',     // Women's clothing
  '15688': 'fashion',     // Men's clothing
  '15689': 'fashion',     // Kids clothing
  '3034': 'shoes',        // Shoes & accessories
  '11450': 'accessories', // Jewelry & watches
  '266': 'home',          // Home & garden
  '220': 'home',          // Home improvement
};

// Condition mapping
const CONDITION_MAP = {
  'NEW': 'like-new',
  'NEW_OTHER': 'like-new',
  'NEW_WITH_DEFECTS': 'good',
  'CERTIFIED_REFURBISHED': 'good',
  'USED': 'good',
  'VERY_GOOD': 'good',
  'GOOD': 'good',
  'ACCEPTABLE': 'fair',
  'FOR_PARTS_OR_NOT_WORKING': 'fair'
};

async function searchEbay(query, options) {
  options = options || {};
  const limit = Math.min(options.limit || 50, 200);

  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit,
      sort: 'newlyListed',
      fieldgroups: 'FULL'
    });

    const url = EBAY_API + '/item_summary/search?' + params.toString();
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
      }
    });

    if (!r.ok) {
      console.warn('[ebay-scraper] Search failed:', r.status);
      return { ok: false, error: 'eBay search failed: ' + r.status };
    }

    const data = await r.json();
    const items = [];

    (data.itemSummaries || []).forEach(function(item) {
      try {
        const title = item.title || '';
        const price = item.price && item.price.value ? parseFloat(item.price.value) : 0;
        const condition = item.condition || 'USED';
        const image = (item.image && item.image.imageUrl) || '';
        const itemWebUrl = item.itemWebUrl || '';
        const categoryId = item.categoryId || '';

        if (title && price > 0) {
          items.push({
            title: title.slice(0, 100),
            price: price,
            condition: CONDITION_MAP[condition] || 'good',
            category: CATEGORY_MAP[categoryId] || 'home',
            image: image,
            link: itemWebUrl,
            source: 'ebay',
            itemId: item.itemId,
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('[ebay-scraper] Error parsing item:', e.message);
      }
    });

    return { ok: true, items: items, query: query };
  } catch (e) {
    console.error('[ebay-scraper] Search error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function downloadImage(url) {
  try {
    if (!url || !url.startsWith('http')) return null;

    const r = await fetch(url);
    if (!r.ok) return null;

    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return 'data:image/jpeg;base64,' + base64;
  } catch (e) {
    console.warn('[ebay-scraper] Image download failed:', url, e.message);
    return null;
  }
}

async function createRelayListing(ebayItem, marketplaceId, sellerId, options) {
  options = options || {};

  try {
    const images = [];
    if (ebayItem.image) {
      const img = await downloadImage(ebayItem.image);
      if (img) images.push(img);
    }

    const title = ebayItem.title.slice(0, 100);
    const description = (options.includeSource ? 'Originally from eBay: ' : '') +
                        (ebayItem.link || '');

    const listing = await marketplace.createListing({
      marketplaceId: marketplaceId,
      sellerId: sellerId,
      title: title,
      price: Math.round(ebayItem.price * 100) / 100,
      condition: ebayItem.condition,
      category: ebayItem.category,
      description: description,
      quantity: 1,
      images: images,
      metadata: {
        source: 'ebay',
        ebayLink: ebayItem.link,
        ebayItemId: ebayItem.itemId,
        ebayFetchedAt: ebayItem.fetchedAt
      }
    });

    return { ok: true, listing: listing };
  } catch (e) {
    console.error('[ebay-scraper] Create listing error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  options = options || {};

  const searchResult = await searchEbay(query, { limit: options.maxItems || 20 });
  if (!searchResult.ok) {
    return { ok: false, error: 'Search failed: ' + searchResult.error };
  }

  const items = searchResult.items || [];
  const created = [];
  const failed = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await createRelayListing(item, marketplaceId, sellerId, options);

    if (result.ok) {
      created.push({ item: item, listing: result.listing });
    } else {
      failed.push({ item: item, error: result.error });
    }

    if (options.delayMs) {
      await new Promise(r => setTimeout(r, options.delayMs));
    }
  }

  return {
    ok: true,
    query: query,
    created: created.length,
    failed: failed.length,
    createdListings: created,
    failedItems: failed,
    source: 'ebay'
  };
}

module.exports = {
  searchEbay,
  createRelayListing,
  scrapeAndPost,
  downloadImage,
  CATEGORY_MAP,
  CONDITION_MAP
};
