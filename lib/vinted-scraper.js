/**
 * lib/vinted-scraper.js — Scrape Vinted listings and repost to Relay
 *
 * Fetches listings from Vinted, extracts product data, downloads images,
 * and creates listings in the Relay marketplace.
 */

const { JSDOM } = require('jsdom');
const marketplace = require('./relay-marketplace');

const VINTED_BASE = 'https://www.vinted.com';
const VINTED_SEARCH = VINTED_BASE + '/catalog';

// Map Vinted categories to Relay categories
const CATEGORY_MAP = {
  'women': 'fashion',
  'men': 'fashion',
  'kids': 'fashion',
  'shoes': 'shoes',
  'accessories': 'accessories',
  'home': 'home',
  'beauty': 'accessories',
  'sport': 'home'
};

// Map Vinted condition to Relay condition
const CONDITION_MAP = {
  'good': 'good',
  'very_good': 'like-new',
  'excellent': 'like-new',
  'never_worn': 'like-new',
  'never_worn_with_tag': 'like-new',
  'fair': 'fair'
};

async function searchVinted(query, options) {
  options = options || {};
  const page = options.page || 0;
  const perPage = options.perPage || 50;

  try {
    const url = VINTED_SEARCH + '?search_text=' + encodeURIComponent(query) + '&page=' + page;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!r.ok) {
      console.warn('[vinted-scraper] Search request failed:', r.status);
      return { ok: false, error: 'Search failed: ' + r.status };
    }

    const html = await r.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const items = [];
    const itemCards = doc.querySelectorAll('[data-testid="itemCard"]');

    itemCards.forEach(function(card) {
      try {
        const title = card.querySelector('[data-testid="itemCardTitle"]')?.textContent || '';
        const priceText = card.querySelector('[data-testid="itemCardPrice"]')?.textContent || '0';
        const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
        const conditionEl = card.querySelector('[data-testid="itemCardCondition"]');
        const condition = conditionEl?.textContent || 'good';
        const imageEl = card.querySelector('img');
        const image = imageEl?.src || '';
        const linkEl = card.querySelector('a');
        const link = linkEl?.href || '';

        if (title && price > 0) {
          items.push({
            title: title.trim(),
            price: price,
            condition: CONDITION_MAP[condition.toLowerCase().replace(/\s+/g, '_')] || 'good',
            image: image,
            link: link,
            source: 'vinted',
            fetchedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('[vinted-scraper] Error parsing card:', e.message);
      }
    });

    return { ok: true, items: items, page: page, totalFound: items.length };
  } catch (e) {
    console.error('[vinted-scraper] Search error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function downloadImage(url) {
  try {
    if (!url) return null;

    const r = await fetch(url);
    if (!r.ok) return null;

    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return 'data:image/jpeg;base64,' + base64;
  } catch (e) {
    console.warn('[vinted-scraper] Image download failed:', url, e.message);
    return null;
  }
}

async function createRelayListing(vintedItem, marketplaceId, sellerId, options) {
  options = options || {};

  try {
    const images = [];
    if (vintedItem.image) {
      const img = await downloadImage(vintedItem.image);
      if (img) images.push(img);
    }

    const category = CATEGORY_MAP[vintedItem.category] || 'home';
    const title = vintedItem.title.slice(0, 100);
    const description = (options.includeSource ? 'Originally from Vinted: ' : '') +
                        (vintedItem.link || '');

    const listing = await marketplace.createListing({
      marketplaceId: marketplaceId,
      sellerId: sellerId,
      title: title,
      price: Math.round(vintedItem.price * 100) / 100,
      condition: vintedItem.condition,
      category: category,
      description: description,
      quantity: 1,
      images: images,
      metadata: {
        source: 'vinted',
        vintedLink: vintedItem.link,
        vintedFetchedAt: vintedItem.fetchedAt
      }
    });

    return { ok: true, listing: listing };
  } catch (e) {
    console.error('[vinted-scraper] Create listing error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  options = options || {};

  const searchResult = await searchVinted(query, { page: 0, perPage: options.maxItems || 20 });
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
    source: 'vinted'
  };
}

module.exports = {
  searchVinted,
  createRelayListing,
  scrapeAndPost,
  downloadImage,
  CATEGORY_MAP,
  CONDITION_MAP
};
