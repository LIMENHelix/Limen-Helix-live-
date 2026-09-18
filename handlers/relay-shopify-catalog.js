// Read only public, published merchandise. No Admin credentials, carts or supplier writes.
const SHOP = 'https://0abp5n-dy.myshopify.com';
const COLLECTIONS = [
  { handle: 'coffee', title: 'Coffee & Custard' },
  { handle: 'clothing', title: 'Clothing' },
  { handle: 'sensory-play', title: 'Sensory & Comfort' },
  { handle: 'home-seasonal', title: 'Home & Seasonal' }
];
let cached = null;
let expires = 0;
let pending = null;

function product(p) {
  if (!p || !/^[a-z0-9][a-z0-9-]*$/.test(p.handle || '')) return null;
  const variants = (Array.isArray(p.variants) ? p.variants : []).filter(v => v.available === true);
  const prices = variants.map(v => Number(v.price)).filter(n => Number.isFinite(n) && n >= 0);
  if (!prices.length) return null;
  let image = null;
  try {
    const u = new URL(p.images && p.images[0] && p.images[0].src);
    if (u.protocol === 'https:' && u.hostname === 'cdn.shopify.com') image = u.href;
  } catch (_) {}
  return {
    title: String(p.title || '').slice(0, 250), vendor: String(p.vendor || '').slice(0, 150),
    url: SHOP + '/products/' + p.handle, image,
    price: Math.min(...prices), priceVaries: new Set(prices).size > 1,
    options: (Array.isArray(p.options) ? p.options : [])
      .map((o,index) => ({ name: String(o.name).slice(0, 80), values: [...new Set(variants.map(v => v['option' + (index + 1)]).filter(Boolean).map(String))].slice(0, 30) }))
      .filter(o => o.name !== 'Title' && o.values.length)
  };
}

async function load() {
  const collections = await Promise.all(COLLECTIONS.map(async c => {
    try {
      const r = await fetch(SHOP + '/collections/' + c.handle + '/products.json?limit=12', {
        signal: AbortSignal.timeout(6500), redirect: 'error', headers: { Accept: 'application/json' }
      });
      if (!r.ok) throw new Error('catalog unavailable');
      const body = await r.json();
      if (!Array.isArray(body.products)) throw new Error('invalid catalog');
      const pool = body.products.map(product).filter(Boolean);
      const selected = [];
      if (c.handle === 'coffee') {
        for (const pattern of [/espresso maker|espresso machine|manual espresso|coffee maker/i, /whole bean|ground coffee/i]) {
          const match = pool.find(p => pattern.test(p.title) && !selected.includes(p));
          if (match) selected.push(match);
        }
      }
      for (const p of pool) if (selected.length < 3 && !selected.includes(p)) selected.push(p);
      return { ...c, url: SHOP + '/collections/' + c.handle, products: selected, available: true };
    } catch (_) {
      return { ...c, url: SHOP + '/collections/' + c.handle, products: [], available: false };
    }
  }));
  return { collections, currency: 'USD', fetchedAt: new Date().toISOString() };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method && req.method !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'GET only' })); }
  if (!cached || Date.now() >= expires) {
    if (!pending) pending = load().then(value => {
      cached = value;
      expires = Date.now() + (value.collections.every(c => c.available) ? 60000 : 10000);
    }).finally(() => { pending = null; });
    await pending;
  }
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
  res.end(JSON.stringify(cached));
};
module.exports.product = product;
