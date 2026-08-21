/**
 * lib/poshmark-scraper.js — Poshmark scraper (Puppeteer not available in Vercel)
 *
 * Puppeteer browser automation requires system-level dependencies (chromium, libraries)
 * that are not available in Vercel's serverless environment.
 *
 * WORKAROUND: Use CSV import instead, or implement via API-based approach if Poshmark
 * provides a public API.
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
  return {
    ok: false,
    error: 'Poshmark scraping requires Puppeteer which needs browser binary and system dependencies not available in Vercel serverless. Use CSV import instead or provide a local API that can handle browser automation.'
  };
}

async function createRelayListing(poshmarkItem, marketplaceId, sellerId, options) {
  return {
    ok: false,
    error: 'Poshmark scraping not available in serverless environment'
  };
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  return {
    ok: false,
    error: 'Poshmark scraping requires browser automation, not available in Vercel. Use CSV import.',
    created: 0,
    failed: 0
  };
}

module.exports = {
  searchPoshmark,
  createRelayListing,
  scrapeAndPost,
  CATEGORY_MAP,
  CONDITION_MAP
};
