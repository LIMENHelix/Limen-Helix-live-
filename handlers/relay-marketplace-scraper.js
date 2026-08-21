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

  let ebay, mercari, vinted, poshmark;
  try {
    ebay = require('../lib/ebay-scraper');
    mercari = require('../lib/mercari-scraper');
    vinted = require('../lib/vinted-scraper');
    poshmark = require('../lib/poshmark-scraper');
  } catch (e) {
    console.error('[marketplace-scraper] Failed to load scrapers:', e.message);
    return sendJSON(res, 503, { ok: false, error: 'Service temporarily unavailable: ' + e.message });
  }
  const body = await readBody(req);
  const source = (body.source || 'ebay').toLowerCase();
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

  const scraper = await getScraper(source);
  if (!scraper) {
    return sendJSON(res, 400, { ok: false, error: 'Unknown source: ' + source + '. Supported: ebay, mercari, vinted, poshmark' });
  }

  try {
    if (action === 'search') {
      let result;
      switch (source) {
        case 'ebay':
          result = await ebay.searchEbay(query, { limit: maxItems });
          break;
        case 'mercari':
          result = await mercari.searchMercari(query, { limit: maxItems });
          break;
        case 'vinted':
          result = await vinted.searchVinted(query, { maxItems: maxItems });
          break;
        case 'poshmark':
          result = await poshmark.searchPoshmark(query, { maxItems: maxItems });
          break;
        default:
          return sendJSON(res, 400, { ok: false, error: 'Unknown source' });
      }

      if (!result.ok) {
        return sendJSON(res, 502, { ok: false, error: result.error });
      }
      return sendJSON(res, 200, { ok: true, action: 'search', source: source, items: result.items });
    }

    if (action === 'scrape-and-post') {
      if (!marketplaceId || !sellerId) {
        return sendJSON(res, 400, { ok: false, error: 'marketplaceId and sellerId required' });
      }

      let result;
      switch (source) {
        case 'ebay':
          result = await ebay.scrapeAndPost(query, marketplaceId, sellerId, { maxItems, includeSource, delayMs });
          break;
        case 'mercari':
          result = await mercari.scrapeAndPost(query, marketplaceId, sellerId, { maxItems, includeSource, delayMs });
          break;
        case 'vinted':
          result = await vinted.scrapeAndPost(query, marketplaceId, sellerId, { maxItems, includeSource, delayMs });
          break;
        case 'poshmark':
          result = await poshmark.scrapeAndPost(query, marketplaceId, sellerId, { maxItems, includeSource, delayMs });
          break;
        default:
          return sendJSON(res, 400, { ok: false, error: 'Unknown source' });
      }

      if (!result.ok) {
        return sendJSON(res, 502, { ok: false, error: result.error });
      }

      return sendJSON(res, 200, {
        ok: true,
        action: 'scrape-and-post',
        source: source,
        query: result.query,
        created: result.created,
        failed: result.failed,
        createdListings: result.createdListings,
        failedItems: result.failedItems
      });
    }

    return sendJSON(res, 400, { ok: false, error: 'Unknown action: ' + action });
  } catch (e) {
    console.error('[marketplace-scraper] Error:', e.message);
    return sendJSON(res, 500, { ok: false, error: e.message });
  }
};
