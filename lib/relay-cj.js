/**
 * relay-cj.js — CJ Dropshipping. The supplier that closes the automation loop.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────
 * eBay denied the Buy API application, and that was the last sanctioned way to buy
 * programmatically from a consumer marketplace. Every other one (Vinted, Poshmark,
 * Mercari, Depop) has no buy API at all, so an order sourced there needs a human.
 *
 * CJ is a supplier, not a marketplace, and its whole purpose is machine-placed orders:
 *
 *   - self-serve API key, no application, no approval queue
 *   - createOrderV2 with payType=2 deducts from a PREPAID WALLET, so a purchase needs
 *     no card entry, no checkout page and no CAPTCHA
 *   - CJ ships to the end customer directly, which is the shape Relay already assumes
 *
 * That makes the buy step genuinely autonomous and within the supplier's terms, which
 * scripting a logged-in marketplace account never was.
 *
 * ── COST IS ITEM + FREIGHT, ALWAYS ──────────────────────────────────────────────────
 * CJ quotes the product price and the shipping separately. Code review already caught
 * this exact class of bug once: an understated acquisition cost passes the spend cap and
 * the margin floor on a number we had not fully counted, and the margin evaporates on
 * delivery. Nothing here returns a price without freight resolved, or it returns null.
 *
 * ── LIMITS ──────────────────────────────────────────────────────────────────────────
 * CJ rate-limits every endpoint. Calls are serialised through a minimum interval rather
 * than fired in parallel, because a 429 mid-checkout is a paid order that never placed.
 * The access token lives 15 days and the refresh token 180; both are cached in Relay's
 * own db namespace so a cold lambda does not re-authenticate on every request.
 */

const db = require('./limen-db');

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const API_KEY = process.env.CJ_API_KEY || '';
const TOKEN_KEY = 'relay:cj:token';
const TIMEOUT_MS = parseInt(process.env.RELAY_HTTP_TIMEOUT_MS || '20000', 10);
const MIN_INTERVAL_MS = 1100;      // CJ throttles roughly per second

let _lastCall = 0;
// Real serialisation. Reading a shared _lastCall let two concurrent callers compute the
// same delay, sleep together and then burst the endpoint anyway, which is how a rate
// limit gets hit mid-checkout. Each call chains onto the previous one instead.
let _queue = Promise.resolve();

function configured() { return !!API_KEY; }

function _throttle() {
  const mine = _queue.then(async function () {
    const wait = MIN_INTERVAL_MS - (Date.now() - _lastCall);
    if (wait > 0) await new Promise(function (r) { setTimeout(r, wait); });
    _lastCall = Date.now();
  });
  _queue = mine.catch(function () {});   // one failure must not stall the queue
  return mine;
}

async function _call(path, opts) {
  opts = opts || {};
  await _throttle();
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  try {
    const headers = { Accept: 'application/json' };
    if (opts.token) headers['CJ-Access-Token'] = opts.token;
    if (opts.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctl.signal
    });
    const j = await r.json().catch(function () { return {}; });
    // CJ answers 200 with result:false on business errors, so HTTP status alone is not
    // a success test.
    if (!r.ok || j.result === false) {
      return { ok: false, error: 'CJ ' + r.status + ': ' + (j.message || 'request failed'), code: j.code };
    }
    return { ok: true, data: j.data, raw: j };
  } catch (e) {
    return { ok: false, error: 'CJ request failed: ' + e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── auth ────────────────────────────────────────────────────────────────────

/** Fingerprint of the configured key, so a rotated credential invalidates the cache. */
function _keyPrint() {
  return require('crypto').createHash('sha256').update(API_KEY).digest('hex').slice(0, 16);
}

async function _cachedToken() {
  try {
    const t = await db.get(TOKEN_KEY);
    if (!t || !t.accessToken || !t.expiresAt) return null;
    // A token records which key minted it. Without this, rotating CJ_API_KEY or moving
    // to another CJ account leaves every process using the previous account's token for
    // up to 14 days.
    if (t.keyPrint !== _keyPrint()) return null;
    if (Date.now() >= t.expiresAt) return null;
    return t.accessToken;
  } catch (e) { /* fall through and mint a new one */ }
  return null;
}

/** A live CJ-Access-Token, minted and cached. Returns null when unusable. */
async function token() {
  if (!configured()) return null;
  const cached = await _cachedToken();
  if (cached) return cached;

  const r = await _call('/authentication/getAccessToken', {
    method: 'POST',
    body: { apiKey: API_KEY }
  });
  if (!r.ok || !r.data || !r.data.accessToken) {
    console.error('[relay-cj] auth failed:', r.error || 'no accessToken in response');
    return null;
  }
  try {
    await db.set(TOKEN_KEY, {
      keyPrint: _keyPrint(),
      accessToken: r.data.accessToken,
      refreshToken: r.data.refreshToken || null,
      // Refresh a day early rather than racing a 15-day expiry mid-order.
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
    });
  } catch (e) { /* an uncached token still works for this invocation */ }
  return r.data.accessToken;
}

// ── catalogue ───────────────────────────────────────────────────────────────

function _num(v) {
  const n = parseFloat(v);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Freight for one variant to one destination, in USD, or null when CJ will not quote.
 * Null is never treated as zero by callers: an unquotable item is not sourceable.
 */
async function freight(vid, quantity, countryCode, zip) {
  const t = await token();
  if (!t) return null;
  const r = await _call('/logistic/freightCalculate', {
    method: 'POST',
    token: t,
    body: {
      startCountryCode: 'CN',
      endCountryCode: countryCode || 'US',
      zip: zip || undefined,
      products: [{ vid: vid, quantity: Math.max(1, parseInt(quantity, 10) || 1) }]
    }
  });
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;

  // Cheapest quote that actually carries a price. CJ returns several carriers.
  let best = null;
  r.data.forEach(function (o) {
    const p = _num(o.logisticPrice);
    if (p == null) return;
    if (!best || p < best.price) {
      best = { price: p, carrier: o.logisticName || null, days: o.logisticAging || null };
    }
  });
  return best;
}

/** Stock for a variant in a country. 0 when unknown, so callers fail closed. */
async function stock(vid, countryCode) {
  const t = await token();
  if (!t) return 0;
  const r = await _call('/product/stock/queryByVid?vid=' + encodeURIComponent(vid), { token: t });
  if (!r.ok || !Array.isArray(r.data)) return 0;
  const want = (countryCode || 'US').toUpperCase();
  let total = 0, anywhere = 0;
  r.data.forEach(function (w) {
    const n = parseInt(w.totalInventoryNum != null ? w.totalInventoryNum : w.cjInventoryNum, 10) || 0;
    anywhere += n;
    if (String(w.countryCode || '').toUpperCase() === want) total += n;
  });
  // Prefer in-country stock; fall back to global, which just ships slower.
  return total > 0 ? total : anywhere;
}

/** First variant of a product, with its own price. Products without one are unusable. */
async function firstVariant(pid) {
  const t = await token();
  if (!t) return null;
  const r = await _call('/product/variant/query?pid=' + encodeURIComponent(pid), { token: t });
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  const v = r.data.find(function (x) { return _num(x.variantSellPrice) != null; }) || r.data[0];
  return {
    vid: v.vid,
    sku: v.variantSku || null,
    price: _num(v.variantSellPrice),
    key: v.variantKey || null
  };
}

/**
 * search({ keyword, maxPrice, countryCode, zip, limit })
 *   → { ok, items:[...], reason }
 *
 * Every item returned is buyable: it has a variant id, stock, and a total cost of
 * product + freight. Anything CJ will not fully price or cannot ship is dropped rather
 * than published at a cost we would discover only after selling it.
 */
async function search(opts) {
  opts = opts || {};
  if (!configured()) {
    return { ok: false, items: [], reason: 'CJ_API_KEY not set' };
  }
  const keyword = (opts.keyword || '').trim();
  if (!keyword) return { ok: false, items: [], reason: 'keyword required' };

  const maxPrice = opts.maxPrice != null ? parseFloat(opts.maxPrice) : Infinity;
  const country = (opts.countryCode || 'US').toUpperCase();
  const limit = Math.min(parseInt(opts.limit, 10) || 5, 20);

  const t = await token();
  if (!t) return { ok: false, items: [], reason: 'CJ authentication failed; check CJ_API_KEY' };

  const q = new URLSearchParams({ keyWord: keyword, page: '1', size: String(Math.min(limit * 4, 40)) });
  if (isFinite(maxPrice)) q.set('endSellPrice', String(maxPrice));
  const r = await _call('/product/listV2?' + q.toString(), { token: t });
  if (!r.ok) return { ok: false, items: [], reason: r.error };

  const list = (r.data && r.data.content && r.data.content[0] && r.data.content[0].productList) ||
               (r.data && r.data.list) || [];
  if (!list.length) return { ok: false, items: [], reason: 'CJ has nothing matching "' + keyword + '"' };

  const items = [];
  for (const p of list) {
    if (items.length >= limit) break;
    if ((parseInt(p.warehouseInventoryNum, 10) || 0) < 1) continue;

    const variant = await firstVariant(p.id || p.pid);
    if (!variant || variant.price == null) continue;

    const inStock = await stock(variant.vid, country);
    if (inStock < 1) continue;

    const ship = await freight(variant.vid, 1, country, opts.zip);
    // No freight quote means no known cost. Publishing it would put an unpriced
    // shipping charge straight through the margin floor.
    if (!ship) continue;

    const total = Math.round((variant.price + ship.price) * 100) / 100;
    if (total > maxPrice) continue;

    // A CJ product usually has size/colour/model variants. Ordering picks ONE of them, so
    // the variant must be named in what the customer buys; otherwise they order "the
    // product" and fulfilment ships an arbitrary size.
    const baseName = p.nameEn || p.productNameEn || keyword;
    const variantName = variant.key ? baseName + ' — ' + variant.key : baseName;

    items.push({
      itemId: String(variant.vid),
      source: 'cj',
      title: variantName,
      variantKey: variant.key || null,
      price: total,                 // acquisition cost: product + freight
      productPrice: variant.price,
      shipping: ship.price,
      shippingKnown: true,
      carrier: ship.carrier,
      deliveryDays: ship.days,
      condition: 'new',
      url: 'https://www.cjdropshipping.com/product/-p-' + encodeURIComponent(p.id || p.pid) + '.html',
      image: p.bigImage || p.productImage || null,
      seller: 'CJ Dropshipping',
      vid: variant.vid,
      sku: variant.sku,
      stock: inStock,
      // The only source Relay can actually buy from without a human.
      buyable: true,
      provider: 'cj'
    });
  }

  if (!items.length) {
    return { ok: false, items: [], reason: 'CJ matched "' + keyword + '" but nothing was in stock and fully quotable under $' + maxPrice };
  }
  return { ok: true, items: items, reason: null };
}

// ── purchase ────────────────────────────────────────────────────────────────

/**
 * placeOrder({ orderNumber, vid, quantity, shippingAddress })
 *   → { ok, sourceOrderId, amount } | { ok:false, error }
 *
 * payType 2 is balance payment: CJ deducts from the prepaid wallet and the order is
 * placed outright. No card, no checkout page, no CAPTCHA. If the wallet is empty CJ
 * refuses and this reports that plainly rather than leaving a half-placed order.
 */
async function placeOrder(opts) {
  opts = opts || {};
  if (!configured()) return { ok: false, error: 'CJ_API_KEY not set' };

  const addr = opts.shippingAddress || {};
  const missing = ['name', 'line1', 'city', 'state', 'postalCode', 'country']
    .filter(function (k) { return !String(addr[k] || '').trim(); });
  if (missing.length) return { ok: false, error: 'shipping address missing: ' + missing.join(', ') };
  if (!opts.vid) return { ok: false, error: 'vid required' };
  if (!opts.orderNumber) return { ok: false, error: 'orderNumber required for idempotency' };

  const t = await token();
  if (!t) return { ok: false, error: 'CJ authentication failed' };

  const r = await _call('/shopping/order/createOrderV2', {
    method: 'POST',
    token: t,
    body: {
      orderNumber: String(opts.orderNumber),
      shippingCountryCode: String(addr.country).toUpperCase(),
      shippingCountry: addr.countryName || String(addr.country).toUpperCase(),
      shippingProvince: addr.state,
      shippingCity: addr.city,
      shippingAddress: [addr.line1, addr.line2].filter(Boolean).join(', '),
      shippingCustomerName: addr.name,
      shippingZip: addr.postalCode,
      shippingPhone: addr.phone || undefined,
      remark: 'Relay order ' + opts.orderNumber,
      fromCountryCode: 'CN',
      logisticName: opts.carrier || undefined,
      // 2 = pay from the prepaid CJ balance. This is the whole reason CJ can be
      // automated: no interactive checkout exists in this path.
      payType: 2,
      products: [{ vid: String(opts.vid), quantity: Math.max(1, parseInt(opts.quantity, 10) || 1) }]
    }
  });

  if (!r.ok) {
    const insufficient = /balance|insufficient|not enough/i.test(r.error || '');
    return {
      ok: false,
      error: r.error,
      insufficientBalance: insufficient
    };
  }
  const id = (r.data && (r.data.orderId || r.data.orderNum || r.data.cjOrderId)) || null;
  if (!id) return { ok: false, error: 'CJ accepted the order but returned no order id' };
  return {
    ok: true,
    sourceOrderId: String(id),
    amount: _num(r.data.orderAmount) != null ? _num(r.data.orderAmount) : null,
    raw: r.data
  };
}

module.exports = {
  configured,
  token,
  search,
  freight,
  stock,
  firstVariant,
  placeOrder,
  BASE,
  TOKEN_KEY
};
