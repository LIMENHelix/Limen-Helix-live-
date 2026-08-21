/**
 * lib/poshmark-scraper.js — Scrape Poshmark listings
 *
 * Note: Poshmark requires browser rendering. This is a placeholder that documents
 * the approach. Use Puppeteer for actual implementation.
 */

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

async function searchPoshmark(query, options) {
  options = options || {};

  console.warn('[poshmark-scraper] Poshmark requires browser rendering. Use Puppeteer implementation.');

  return {
    ok: false,
    error: 'Poshmark scraping requires Puppeteer (browser-based). See SCRAPER_STATUS.md for setup.',
    items: []
  };
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  return {
    ok: false,
    error: 'Poshmark scraping requires Puppeteer. Install and configure browser-based scraper.',
    created: 0,
    failed: 0
  };
}

module.exports = {
  searchPoshmark,
  scrapeAndPost,
  CATEGORY_MAP,
  CONDITION_MAP,
  status: 'placeholder-requires-puppeteer'
};
