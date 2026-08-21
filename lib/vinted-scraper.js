/**
 * lib/vinted-scraper.js — Vinted scraper (Puppeteer not available in Vercel)
 *
 * Puppeteer browser automation requires system-level dependencies (chromium, libraries)
 * that are not available in Vercel's serverless environment.
 *
 * WORKAROUND: Use CSV import instead, or implement via API-based approach if Vinted
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
  'beauty': 'accessories',
  'sport': 'fashion'
};

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
    ok: false,
    error: 'Vinted scraping requires Puppeteer which needs browser binary and system dependencies not available in Vercel serverless. Use CSV import instead or provide a local API that can handle browser automation.'
  };
}

async function createRelayListing(vintedItem, marketplaceId, sellerId, options) {
  return {
    ok: false,
    error: 'Vinted scraping not available in serverless environment'
  };
}

async function scrapeAndPost(query, marketplaceId, sellerId, options) {
  return {
    ok: false,
    error: 'Vinted scraping requires browser automation, not available in Vercel. Use CSV import.',
    created: 0,
    failed: 0
  };
}

module.exports = {
  searchVinted,
  createRelayListing,
  scrapeAndPost,
  CATEGORY_MAP,
  CONDITION_MAP
};
