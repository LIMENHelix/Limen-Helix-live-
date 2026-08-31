/**
 * relay-vinted-scraper.js — the Vinted sourcing console.
 *
 *   GET  /api/relay-vinted-scraper   → the page
 *   POST /api/relay-vinted-scraper   → { action: 'search' | 'scrape-and-post', ... }
 *
 * FIXED 2026-08-30, two faults. It read '../pages/relay-vinted-scraper.html' when the
 * file is at the repo root, so every request 500'd; and it only ever handled GET, while
 * its own page POSTs to this same route for both buttons, so neither button could work
 * even once the page loaded.
 *
 * Both HTML paths are written out as literal strings on purpose: Vercel's file tracer
 * only bundles a file it can see as a static string, so a computed path would deploy a
 * function with no HTML in it.
 *
 * Vinted has no public API and blocks logged-out scraping, so 'search' answers honestly
 * that it cannot run rather than returning invented items. Real Vinted supply needs
 * either the CSV import at /api/relay-csv-import or a human-run browser session.
 */

const fs = require('fs');
const path = require('path');
const vinted = require('../lib/vinted-scraper');

function loadPage() {
  try {
    return fs.readFileSync(path.join(__dirname, '../relay-vinted-scraper.html'), 'utf8');
  } catch (e) {
    return fs.readFileSync(path.join(__dirname, '../pages/relay-vinted-scraper.html'), 'utf8');
  }
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async (req, res) => {
  const method = req.method || 'GET';

  if (method === 'GET') {
    try {
      const html = loadPage();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(html);
    } catch (err) {
      console.error('[relay-vinted-scraper] page load failed:', err.message);
      return res.status(500).json({ error: 'Page load failed', message: err.message });
    }
  }

  if (method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = await readBody(req);
  const action = body.action || 'search';

  try {
    if (action === 'search') {
      const r = await vinted.searchVinted(body.query || '', { maxItems: parseInt(body.maxItems, 10) || 20 });
      return res.status(200).json(r);
    }
    if (action === 'scrape-and-post') {
      const r = await vinted.scrapeAndPost(
        body.query || '',
        body.marketplaceId || '',
        body.sellerId || '',
        {
          maxItems: parseInt(body.maxItems, 10) || 20,
          includeSource: body.includeSource !== false,
          delayMs: parseInt(body.delayMs, 10) || 0
        }
      );
      return res.status(200).json(r);
    }
    return res.status(400).json({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    console.error('[relay-vinted-scraper] ' + action + ' failed:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
