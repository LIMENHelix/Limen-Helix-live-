/**
 * api/relay-vinted-scraper — Scrape Vinted and post to Relay marketplace
 *
 * POST { action, query, marketplaceId, sellerId, maxItems, includeSource, delayMs }
 *   → Scrape Vinted listings and create Relay listings
 *   → Return created/failed counts
 *
 * Actions:
 * - search: Search Vinted without posting
 * - scrape-and-post: Search and create Relay listings
 */

const vinted = require('../lib/vinted-scraper');

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  const body = await readBody(req);
  const action = body.action || 'search';
  const query = body.query || '';
  const marketplaceId = body.marketplaceId || '';
  const sellerId = body.sellerId || '';
  const maxItems = Math.min(parseInt(body.maxItems) || 20, 100);
  const includeSource = body.includeSource !== false;
  const delayMs = Math.max(500, parseInt(body.delayMs) || 1000);

  if (!query || query.length < 2) {
    return sendJSON(res, 400, { ok: false, error: 'query required (min 2 chars)' });
  }

  if (action === 'search') {
    const result = await vinted.searchVinted(query, { maxItems: maxItems });
    if (!result.ok) {
      return sendJSON(res, 502, { ok: false, error: result.error });
    }
    return sendJSON(res, 200, { ok: true, action: 'search', items: result.items });
  }

  if (action === 'scrape-and-post') {
    if (!marketplaceId || !sellerId) {
      return sendJSON(res, 400, { ok: false, error: 'marketplaceId and sellerId required' });
    }

    const result = await vinted.scrapeAndPost(query, marketplaceId, sellerId, {
      maxItems: maxItems,
      includeSource: includeSource,
      delayMs: delayMs
    });

    if (!result.ok) {
      return sendJSON(res, 502, { ok: false, error: result.error });
    }

    return sendJSON(res, 200, {
      ok: true,
      action: 'scrape-and-post',
      query: result.query,
      created: result.created,
      failed: result.failed,
      createdListings: result.createdListings,
      failedItems: result.failedItems
    });
  }

  return sendJSON(res, 400, { ok: false, error: 'Unknown action: ' + action });
};
