/**
 * relay-storefront.js — the Relay storefront, and the catalogue behind it.
 *
 * Reached through Relay's one door (handlers/relay.js):
 *   GET /api/relay                           the store page
 *   GET /api/relay?view=catalog    the catalogue the page reads
 *
 * The catalogue is the engine-published board for the house marketplace, sanitised
 * through marketplace.publicListings so source cost, source URL and the applied margin
 * never leave the server. That sanitiser is an allow-list, so a field added to a listing
 * later stays private until someone deliberately publishes it.
 *
 * Only listings that can actually be sold appear: active, in stock, and (for house
 * listings) still carrying a source we could buy them from. An item on the shelf that
 * cannot be sourced is a customer paying for something nobody can ship.
 */

const fs = require('fs');
const path = require('path');
const store = require('../lib/relay-store');

const HOUSE_MARKETPLACE = process.env.RELAY_MARKETPLACE_ID || 'mkt_relay';
const HOUSE_SELLER = process.env.RELAY_HOUSE_SELLER_ID || 'usr_relay_house';

function loadPage() {
  return fs.readFileSync(path.join(__dirname, '../pages/relay-store.html'), 'utf8');
}

module.exports = async function handler(req, res) {
  if ((req.method || 'GET') !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  let q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  if (q.format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const raw = await store.activeListings(Math.min(parseInt(q.limit, 10) || 120, 300));
      const sellable = raw.filter(function (l) {
        if (l.status !== 'active') return false;
        if ((l.quantity || 0) < 1) return false;
        // A house listing exists only because the engine sourced it. No source means
        // there is nothing to buy on the customer's behalf.
        if (l.sellerId === HOUSE_SELLER && !l.sourceUrl) return false;
        return true;
      });
      res.statusCode = 200;
      return res.end(JSON.stringify({
        ok: true,
        count: sellable.length,
        listings: store.publicListings(sellable)
      }));
    } catch (e) {
      console.error('[relay-storefront] catalogue failed:', e.message);
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: 'could not load the catalogue' }));
    }
  }

  try {
    const html = loadPage();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
  } catch (e) {
    console.error('[relay-storefront] page load failed:', e.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Page load failed', message: e.message }));
  }
};
