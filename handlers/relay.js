/**
 * relay.js — Relay's ONE door.
 *
 * ── WHY A FRONT CONTROLLER ──────────────────────────────────────────────────────────
 * Every route in this repo is registered by hand in api/[...route].js, which is shared
 * infrastructure and not Relay's file to edit: a mistake in that map takes out every
 * /api/* path on the site. Relay already owns exactly one entry there, 'relay', and that
 * is enough. Everything Relay serves is dispatched from here on ?view=, so Relay can grow
 * new surfaces forever without another line landing in shared code.
 *
 *   GET  /api/relay                          the storefront
 *   GET  /api/relay?view=catalog             customer-safe catalogue JSON
 *   GET  /api/relay?view=policy              sale terms page  (&format=json for the data)
 *   GET  /api/relay?view=control             operator console (needs RELAY_ADMIN_KEY)
 *   GET  /api/relay?view=tick&run=1          run one engine cycle (cron or admin key)
 *   POST /api/relay?view=cart-checkout       cart -> one order -> one payment
 *   POST /api/relay?view=search              describe an item; Relay sources it
 *   POST /api/relay?view=order               order a searched item
 *
 * The older dedicated routes (/api/relay-margin, /api/relay-checkout, and the rest that
 * already exist in the map) keep working. Nothing here removes them.
 *
 * ── THE FIREWALL ────────────────────────────────────────────────────────────────────
 * Relay's only outbound coupling to the rest of the system is lib/relay-finance-bridge
 * (money in) and lib/limen-db (storage, under relay: keys only). It does NOT use
 * lib/relay-marketplace: despite the name, that module is the TRADE domain's auction
 * store. scripts/test-relay-firewall.js fails the build if either rule is broken.
 */

const fs = require('fs');
const path = require('path');

function send(res, code, type, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function json(res, code, obj) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  send(res, code, 'application/json', JSON.stringify(obj));
}

/** Delegate to a handler module, passing the real req/res through untouched. */
function delegate(mod, req, res) {
  return require(mod)(req, res);
}

module.exports = async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }

  let q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  const view = (q.view || '').toLowerCase();

  try {
    switch (view) {
      case '':
      case 'store':
      case 'storefront':
      case 'catalog':
      case 'catalogue':
        // relay-storefront serves the page, or the catalogue when format=json.
        if (view === 'catalog' || view === 'catalogue') {
          req.url = (req.url || '/api/relay') + (req.url && req.url.indexOf('?') !== -1 ? '&' : '?') + 'format=json';
        }
        return await delegate('./relay-storefront', req, res);

      case 'policy':
      case 'terms':
        return await delegate('./relay-policy', req, res);

      case 'control':
      case 'admin':
        return await delegate('./relay-autonomous-control', req, res);

      case 'tick':
      case 'cycle':
        return await delegate('./relay-autonomous-scraper', req, res);

      case 'cart-checkout':
      case 'checkout':
        if (method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
        return await delegate('./relay-cart-checkout', req, res);

      case 'search':
        if (method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
        return await delegate('./relay-demand-search', req, res);

      case 'order':
      case 'demand-purchase':
        if (method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
        return await delegate('./relay-demand-purchase', req, res);

      case 'health':
        return json(res, 200, {
          ok: true,
          surface: 'relay',
          door: '/api/relay',
          views: ['store', 'catalog', 'policy', 'control', 'tick', 'cart-checkout', 'search', 'order', 'health']
        });

      default:
        return json(res, 404, {
          ok: false,
          error: 'unknown view: ' + view,
          views: ['store', 'catalog', 'policy', 'control', 'tick', 'cart-checkout', 'search', 'order', 'health']
        });
    }
  } catch (e) {
    console.error('[relay] view=' + view + ' failed:', e.message);
    return json(res, 500, { ok: false, error: e.message });
  }
};
