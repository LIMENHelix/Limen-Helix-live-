/**
 * lib/mercari-scraper.js — Scrape Mercari listings via public API
 *
 * Mercari's search API is semi-public and used by their frontend.
 * This implementation uses similar approach to eBay scraper.
 */

const marketplace = require('./relay-marketplace');

const CATEGORY_MAP = {
  '1': 'fashion',
  '2': 'fashion',
  '3': 'accessories',
  '4': 'shoes',
  '100': 'home',
  '101': 'home'
};

const CONDITION_MAP = {
  '1': 'like-new',
  '2': 'like-new',
  '3': 'good',
  '4': 'good',
  '5': 'fair'
};

async function searchMercari(query, options) {
  options = options || {};
  const limit = Math.min(options.limit || 50, 200);

  try {
    const params = new URLSearchParams({
      keyword: query,
      limit: limit,
      sort_order: 'new'
    });

    const url = 'https://api.mercari.com/v2/items?' + params.toString();
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Platform': 'web'
      }
    });

    if (!r.ok) {
      console.warn('[mercari-scraper] Search failed:', r.status);
      return { ok: false, error: 'Mercari search failed: ' + r.status };
    }

    const data = await r.json();
    const items = [];

    (data.items || []).forEach(function(item) {
      try {
        const title = item.name || '';
        const price = item.price ? parseInt(item.price) : 0;
        const condition = item.status || '3';
        const image = item.photos && item.photos[0] ? item.photos[0].url : '';
        const category = item.category_id || '100';

        if (title && price > 0) {
          items.push({
            title: title.slice(0, 100),
            price: price / 100, // Mercari uses cents
            condition: CONDITION_MAP[condition] || 'good',
            category: CATEGORY_MAP[category] || 'home',
            image: image,
            link: 'https://mercari.com/i/' + item.id,
            source: 'mercari',
            itemId: item.id,
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('[mercari-scraper] Error parsing item:', e.message);
      }
    });

    return { ok: true, items: items, query: query };
  } catch (e) {
    console.error('[mercari-scraper] Search error:', e.message);
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
    console.warn('[mercari-scraper] Image download failed:', url);
    return null;
  }
}

async function createRelayListing(mercariItem, marketplaceId, sellerId, options) {
  options = options || {};

  try {
    const images = [];
    if (mercariItem.image) {
      const img = await downloadImage(mercariItem.image);
      if (img) images.push(img);
    }

    const title = mercariItem.title.slice(0, 100);
    const description = (options.includeSource ? 'Originally from Mercari: ' : '') +
                        (mercariItem.link || '');

    const listing = await marketplace.createListing({
      marketplaceId: marketplaceId,
      sellerId: sellerId,
      title: title,
      price: mercariItem.price,
      condition: mercariItem.condition,
      category: mercariItem.category,
      description: description,
      quantity: 1,
      images: images,
      metadata: {
        source: 'mercari',
        mercariLink: mercariItem.link,
        mercariItemId: mercariItem.itemId,
        mercariFetchedAt: mercariItem.fetchedAt
      }
    });

    return { ok: true, listing: listing };
  } catch (e) {
    console.error('[mercari-scraper] Create listing error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  options = options || {};

  const searchResult = await searchMercari(query, { limit: options.maxItems || 20 });
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
    source: 'mercari'
  };
}

module.exports = {
  searchMercari,
  createRelayListing,
  scrapeAndPost,
  downloadImage,
  CATEGORY_MAP,
  CONDITION_MAP
};
