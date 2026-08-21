/**
 * lib/vinted-scraper.js — Vinted marketplace scraper
 *
 * Vinted requires either:
 * 1. API authentication (token in headers)
 * 2. Puppeteer (browser automation)
 * 3. CSV import
 *
 * NOTE: Removed JSDOM due to ESM/CommonJS compatibility issues in Vercel.
 * Use CSV import or Puppeteer-based scraper instead.
 */

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
  return {
    ok: true,
    items: [],
    message: 'Vinted scraping requires authentication or Puppeteer. Use CSV import instead.'
  };
}

async function createRelayListing(vintedItem, marketplaceId, sellerId, options) {
  return { ok: false, error: 'Vinted requires auth or Puppeteer' };
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  return {
    ok: true,
    query: query,
    created: 0,
    failed: 0,
    createdListings: [],
    failedItems: [],
    message: 'Vinted scraping requires authentication or Puppeteer. Use CSV import instead.'
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
