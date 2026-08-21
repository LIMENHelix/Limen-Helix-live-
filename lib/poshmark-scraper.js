/**
 * lib/poshmark-scraper.js — Poshmark marketplace scraper using Puppeteer
 */

const puppeteer = require('puppeteer');
const marketplace = require('./relay-marketplace');

const CATEGORY_MAP = {
  'women': 'fashion',
  'men': 'fashion',
  'kids': 'fashion',
  'shoes': 'shoes',
  'accessories': 'accessories',
  'home': 'home',
  'electronics': 'home'
};

const CONDITION_MAP = {
  'New': 'like-new',
  'Like New': 'like-new',
  'Good': 'good',
  'Fair': 'fair'
};

async function downloadImage(url) {
  try {
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return 'data:image/jpeg;base64,' + base64;
  } catch (e) {
    console.warn('[poshmark] Image download failed:', url);
    return null;
  }
}

async function searchPoshmark(query, options) {
  options = options || {};
  const maxItems = options.maxItems || 20;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(`https://poshmark.com/search?query=${encodeURIComponent(query)}&type=listings`, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    const listings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid="tile"]'))
        .slice(0, 50)
        .map(card => {
          const title = card.querySelector('[data-testid="tile-title"]')?.textContent?.trim();
          const priceText = card.querySelector('[data-testid="tile-price"]')?.textContent;
          const price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;
          const imageUrl = card.querySelector('img')?.src;
          const linkEl = card.querySelector('a');
          const url = linkEl?.href || '';

          return (title && price > 0) ? { title, price, imageUrl, url } : null;
        })
        .filter(Boolean);
    });

    await browser.close();

    return {
      ok: true,
      items: listings.slice(0, maxItems).map(item => ({
        id: item.url.split('/').pop(),
        title: item.title,
        price: item.price,
        source: 'poshmark',
        url: item.url,
        image: item.imageUrl,
        condition: 'good'
      }))
    };
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    console.error('[poshmark] Scrape error:', e.message);
    return { ok: false, error: 'Poshmark scrape failed: ' + e.message };
  }
}

async function createRelayListing(poshmarkItem, marketplaceId, sellerId, options) {
  try {
    const images = [];
    if (poshmarkItem.image) {
      const img = await downloadImage(poshmarkItem.image);
      if (img) images.push(img);
    }

    const listing = await marketplace.createListing({
      marketplaceId,
      sellerId,
      title: poshmarkItem.title.slice(0, 100),
      price: poshmarkItem.price,
      condition: poshmarkItem.condition || 'good',
      category: 'fashion',
      description: (options?.includeSource ? 'Originally from Poshmark: ' : '') + (poshmarkItem.url || ''),
      quantity: 1,
      images,
      metadata: { source: 'poshmark', poshmarkUrl: poshmarkItem.url }
    });

    return { ok: true, listing };
  } catch (e) {
    console.error('[poshmark] Create listing error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  options = options || {};
  const searchResult = await searchPoshmark(query, { maxItems: options.maxItems || 20 });
  if (!searchResult.ok) return { ok: false, error: searchResult.error };

  const items = searchResult.items || [];
  const created = [];
  const failed = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await createRelayListing(item, marketplaceId, sellerId, options);
    if (result.ok) created.push({ item, listing: result.listing });
    else failed.push({ item, error: result.error });
    if (options.delayMs) await new Promise(r => setTimeout(r, options.delayMs));
  }

  return {
    ok: true,
    query,
    created: created.length,
    failed: failed.length,
    createdListings: created,
    failedItems: failed
  };
}

module.exports = {
  searchPoshmark,
  createRelayListing,
  scrapeAndPost,
  CATEGORY_MAP,
  CONDITION_MAP
};
