/**
 * api/relay-marketplace-scraper — Unified scraper for multiple marketplaces
 *
 * POST { source, action, query, marketplaceId, sellerId, ... }
 *
 * Supported sources: ebay, mercari, vinted, poshmark, csv
 */

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

async function getScraper(source) {
  switch (source) {
    case 'ebay': return ebay;
    case 'mercari': return mercari;
    case 'vinted': return vinted;
    case 'poshmark': return poshmark;
    default: return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  const body = await readBody(req);
  const source = (body.source || 'ebay').toLowerCase();

  let scraper;
  try {
    switch (source) {
      case 'ebay': scraper = require('../lib/ebay-scraper'); break;
      case 'mercari': scraper = require('../lib/mercari-scraper'); break;
      case 'vinted': scraper = require('../lib/vinted-scraper'); break;
      case 'poshmark': scraper = require('../lib/poshmark-scraper'); break;
      default: return sendJSON(res, 400, { ok: false, error: 'Unknown source: ' + source });
    }
  } catch (e) {
    console.error('[marketplace-scraper] Failed to load scraper:', e.message);
    return sendJSON(res, 503, { ok: false, error: 'Service unavailable: ' + e.message });
  }
  const action = body.action || 'search';
  const query = body.query || '';
  const marketplaceId = body.marketplaceId || '';
  const sellerId = body.sellerId || '';
  const maxItems = Math.min(parseInt(body.maxItems) || 20, 100);
  const includeSource = body.includeSource !== false;
  const delayMs = Math.max(100, parseInt(body.delayMs) || 500);

  if (!query || query.length < 2) {
    return sendJSON(res, 400, { ok: false, error: 'query required (min 2 chars)' });
  }

  try {
    if (action === 'search') {
      let result;
      if (source === 'vinted') result = await scraper.searchVinted(query, { maxItems });
      else if (source === 'mercari') result = await scraper.searchMercari(query, { limit: maxItems });
      else if (source === 'poshmark') result = await scraper.searchPoshmark(query, { maxItems });
      else result = await scraper.searchEbay(query, { limit: maxItems });

      if (!result.ok) return sendJSON(res, 502, { ok: false, error: result.error });
      return sendJSON(res, 200, { ok: true, action: 'search', source: source, items: result.items });
    }

    if (action === 'scrape-and-post') {
      if (!marketplaceId || !sellerId) return sendJSON(res, 400, { ok: false, error: 'marketplaceId and sellerId required' });
      const result = await scraper.scrapeAndPost(query, marketplaceId, sellerId, { maxItems, includeSource, delayMs });
      if (!result.ok) return sendJSON(res, 502, { ok: false, error: result.error });
      return sendJSON(res, 200, { ok: true, action: 'scrape-and-post', source, query: result.query, created: result.created, failed: result.failed, createdListings: result.createdListings, failedItems: result.failedItems });
    }
    return sendJSON(res, 400, { ok: false, error: 'Unknown action: ' + action });
  } catch (e) {
    console.error('[marketplace-scraper] Error:', e.message);
    return sendJSON(res, 500, { ok: false, error: e.message });
  }
};
