/**
 * relay-storefront.js — Relay Supply storefront + customer-safe catalogue.
 *
 * Relay has two public businesses:
 *   /relay                   Supply: Relay sources and ships, keeping the spread.
 *   /marketplace-storefront  Marketplace: C2C sellers list and ship their own goods.
 */
const fs = require('fs');
const path = require('path');
const store = require('../lib/relay-store');

const HOUSE_SELLER = process.env.RELAY_HOUSE_SELLER_ID || 'usr_relay_house';

function loadPage() {
  let html = fs.readFileSync(path.join(__dirname, '../pages/relay-store.html'), 'utf8');
  // Keep the existing battle-tested page, but make its public identity match the business
  // it actually implements. These are presentation-only substitutions: price/order logic
  // stays in the server handlers and cannot be changed by this page.
  html = html.replace('<title>Relay — secondhand &amp; surplus, shipped</title>', '<title>Relay Supply · sourced goods for people &amp; businesses</title>');
  html = html.replace('>Relay<b>.</b><small>by LIMEN Helix</small>', '>Relay Supply<b>.</b><small>sourced by LIMEN Helix</small>');
  html = html.replace('Secondhand &amp; surplus goods, sourced and shipped', 'Goods sourced to order for people and businesses');
  html = html.replace("' in stock'", "' available to source'");
  // Supplier freight is already included in every house listing price and checkout adds
  // no shipping line. The old >$75 badge therefore contradicted the cart for cheaper items.
  html = html.replace("(i.price > 75 ? '<span class=\"free\">Free shipping</span>' : '')", "'<span class=\"free\">Shipping included</span>'");
  html = html.replace("(i.price > 75 ? ' · Free shipping' : '')", "' · Shipping included'");
  // Give the customer a visible route to the other Relay business without mixing stores.
  html = html.replace('<div class="wrap">', '<div class="wrap"><div style="font-size:.82rem;color:var(--soft);margin-bottom:12px">Buying from another person instead? <a href="/marketplace-storefront">Open Relay Marketplace →</a></div>');
  return html;
}

module.exports = async function handler(req, res) {
  if ((req.method || 'GET') !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }

  let q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (_) {}

  if (q.format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const raw = await store.activeListings(Math.min(parseInt(q.limit, 10) || 120, 300));
      const sellable = raw.filter(function (l) {
        if (l.status !== 'active') return false;
        if ((l.quantity || 0) < 1) return false;
        if (l.sellerId === HOUSE_SELLER && !l.sourceUrl) return false;
        return true;
      });
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, count: sellable.length, listings: store.publicListings(sellable) }));
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
    return res.end(JSON.stringify({ ok: false, error: 'storefront unavailable' }));
  }
};
