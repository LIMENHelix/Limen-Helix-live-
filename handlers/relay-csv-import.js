/**
 * api/relay-csv-import — Import listings from CSV
 *
 * POST { csv, marketplaceId, sellerId }
 *   → Parse CSV, create Relay listings
 *   → Return created/failed counts
 *
 * CSV Format:
 * title,price,condition,category,description,imageUrl
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

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { ok: false, error: 'CSV must have header and at least 1 row' };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const titleIdx = headers.indexOf('title');
  const priceIdx = headers.indexOf('price');
  const conditionIdx = headers.indexOf('condition');
  const categoryIdx = headers.indexOf('category');
  const descIdx = headers.indexOf('description');
  const imgIdx = headers.indexOf('imageurl');

  if (titleIdx < 0 || priceIdx < 0) {
    return { ok: false, error: 'CSV must have title and price columns' };
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (!values[titleIdx] || !values[priceIdx]) continue;

    rows.push({
      title: values[titleIdx],
      price: parseFloat(values[priceIdx]) || 0,
      condition: conditionIdx >= 0 ? values[conditionIdx] : 'good',
      category: categoryIdx >= 0 ? values[categoryIdx] : 'home',
      description: descIdx >= 0 ? values[descIdx] : '',
      imageUrl: imgIdx >= 0 ? values[imgIdx] : ''
    });
  }

  return { ok: true, rows: rows };
}

async function downloadImage(url) {
  try {
    if (!url) return null;

    // If already a base64 data URI, return as-is
    if (url.startsWith('data:')) {
      return url;
    }

    // Otherwise fetch and convert
    if (!url.startsWith('http')) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const buffer = await r.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return 'data:image/jpeg;base64,' + base64;
  } catch (e) {
    console.warn('[csv-import] Image download failed:', url);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'POST only' });

  let marketplace;
  try {
    marketplace = require('../lib/relay-marketplace');
  } catch (e) {
    console.error('[csv-import] Failed to load marketplace:', e.message);
    return sendJSON(res, 503, { ok: false, error: 'Service temporarily unavailable: ' + e.message });
  }
  const body = await readBody(req);
  const csv = body.csv || '';
  const marketplaceId = body.marketplaceId || '';
  const sellerId = body.sellerId || '';
  const downloadImages = body.downloadImages !== false;
  const delayMs = Math.max(100, parseInt(body.delayMs) || 500);

  if (!csv || csv.length < 10) {
    return sendJSON(res, 400, { ok: false, error: 'csv required (min 10 chars)' });
  }

  if (!marketplaceId || !sellerId) {
    return sendJSON(res, 400, { ok: false, error: 'marketplaceId and sellerId required' });
  }

  const parseResult = parseCSV(csv);
  if (!parseResult.ok) {
    return sendJSON(res, 400, { ok: false, error: parseResult.error });
  }

  const rows = parseResult.rows || [];
  const created = [];
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const images = [];
      if (row.imageUrl && downloadImages) {
        const img = await downloadImage(row.imageUrl);
        if (img) images.push(img);
      }

      const listing = await marketplace.createListing({
        marketplaceId: marketplaceId,
        sellerId: sellerId,
        title: row.title.slice(0, 100),
        price: row.price,
        condition: row.condition,
        category: row.category,
        description: row.description,
        quantity: 1,
        images: images,
        metadata: {
          source: 'csv-import',
          importedAt: new Date().toISOString()
        }
      });

      created.push({ row: row, listing: listing });
    } catch (e) {
      failed.push({ row: row, error: e.message });
    }

    if (delayMs) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return sendJSON(res, 200, {
    ok: true,
    created: created.length,
    failed: failed.length,
    createdListings: created,
    failedRows: failed,
    source: 'csv-import'
  });
};
