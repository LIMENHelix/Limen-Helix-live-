const store = require('../lib/relay-store');
const cj = require('../lib/relay-cj');
const presentation = require('../lib/relay-product-presentation');
const cache = new Map();
const inflight = new Map();

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  function reply(code, body) { res.statusCode = code; res.end(JSON.stringify(body)); }
  if (req.method && req.method !== 'GET') return reply(405, { ok: false, error: 'GET only' });
  const id = new URL(req.url, 'https://relay.invalid').searchParams.get('id');
  if (!id || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) return reply(400, { ok: false, error: 'Invalid product' });
  try {
    const listing = await store.getListing(id);
    if (!listing || listing.status !== 'active' || listing.quantity < 1 || listing.sourceProvider !== 'cj' || !listing.sourceId) {
      return reply(404, { ok: false, error: 'Product details unavailable' });
    }
    const key = String(listing.sourceId);
    let hit = cache.get(key);
    if (!hit || hit.expires < Date.now()) {
      if (!inflight.has(key)) {
        // Limit concurrent browsing enrichment so it cannot flood the supplier queue.
        if (inflight.size >= 3) return reply(503, { ok: false, error: 'Please try product details again shortly' });
        inflight.set(key, cj.productDetails(key).then(raw => {
          const value = raw ? presentation.normalize(raw) : null;
          if (cache.size >= 300) cache.delete(cache.keys().next().value);
          hit = { value, expires: Date.now() + (value ? 21600000 : 60000) };
          cache.set(key, hit);
          return hit;
        }).finally(() => inflight.delete(key)));
      }
      hit = await inflight.get(key);
    }
    if (!hit.value) return reply(503, { ok: false, error: 'Supplier details are temporarily unavailable' });
    return reply(200, { ok: true, listingId: id, details: hit.value });
  } catch (_) {
    return reply(503, { ok: false, error: 'Product details are temporarily unavailable' });
  }
};
