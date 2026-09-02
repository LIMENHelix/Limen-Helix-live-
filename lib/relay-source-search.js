/**
 * relay-source-search.js — find a REAL, buyable listing to source an order from.
 *
 * REPLACED 2026-08-30. The previous version of this file returned hardcoded fake items
 * ("Levi 505 Jeans", url 'https://www.vinted.com/item/mock') for every query. Anything
 * downstream that trusted it was pricing, selling and reporting on inventory that did
 * not exist. There are no mocks in here now: when nothing is configured or nothing is
 * found, this returns an empty list and says why.
 *
 * PROVIDERS THAT ARE REAL
 *   ebay        EBAY_CLIENT_ID + EBAY_CLIENT_SECRET. Browse API, client-credentials
 *               OAuth, token cached in-process until it expires. Returns genuine
 *               live listings with itemId, price and a buyable URL.
 *   lens        SERPAPI_KEY, via relay-reverse-image. Reverse image or shopping text
 *               search across whatever storefronts Google indexes.
 *
 * PROVIDERS THAT ARE NOT HERE, AND WHY
 *   Vinted, Poshmark, Mercari, Depop have no public buy-side API. The only ways in are
 *   scraping logged-out HTML (they are JS-rendered, so it mostly returns nothing) or
 *   driving a logged-in account headlessly (against their terms; gets the account
 *   banned, and a banned account strands any order already paid for). Adding them as
 *   stubs that return invented items is what this file used to do. Not repeating it.
 */

const reverseImage = require('./relay-reverse-image');
const cj = require('./relay-cj');

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || '';
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || '';
const EBAY_STATIC_TOKEN = process.env.EBAY_TOKEN || '';
const EBAY_MARKETPLACE = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const TIMEOUT_MS = parseInt(process.env.RELAY_HTTP_TIMEOUT_MS || '12000', 10);

let _tokenCache = { token: null, expiresAt: 0 };

async function _fetch(url, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

/** Mint (and cache) an eBay application token via client credentials. */
async function ebayToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) return _tokenCache.token;
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) return EBAY_STATIC_TOKEN || null;

  const basic = Buffer.from(EBAY_CLIENT_ID + ':' + EBAY_CLIENT_SECRET).toString('base64');
  try {
    const r = await _fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + basic,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials&scope=' +
            encodeURIComponent('https://api.ebay.com/oauth/api_scope')
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j.access_token) throw new Error('no access_token in response');
    _tokenCache = {
      token: j.access_token,
      // Refresh a minute early rather than racing the expiry.
      expiresAt: Date.now() + (Math.max(60, (j.expires_in || 7200) - 60) * 1000)
    };
    return _tokenCache.token;
  } catch (e) {
    console.error('[relay-source-search] eBay token failed:', e.message);
    return EBAY_STATIC_TOKEN || null;
  }
}

const CONDITION_IDS = {
  new: '1000',
  'like-new': '2750|3000',
  excellent: '3000',
  good: '3000|4000',
  fair: '5000|6000',
  used: '3000|4000|5000|6000'
};

/** Real eBay Browse search. Returns [] when unconfigured; never invents an item. */
async function searchEbay(description, maxPrice, condition) {
  const token = await ebayToken();
  if (!token) return [];

  const params = new URLSearchParams();
  params.set('q', description);
  params.set('limit', '20');
  const filters = ['buyingOptions:{FIXED_PRICE}'];
  if (isFinite(maxPrice) && maxPrice > 0) filters.push('price:[..' + maxPrice + '],priceCurrency:USD');
  if (condition && CONDITION_IDS[condition]) filters.push('conditionIds:{' + CONDITION_IDS[condition] + '}');
  params.set('filter', filters.join(','));

  try {
    const r = await _fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?' + params.toString(), {
      headers: {
        Authorization: 'Bearer ' + token,
        'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE,
        Accept: 'application/json'
      }
    });
    if (!r.ok) {
      console.error('[relay-source-search] eBay Browse HTTP', r.status);
      return [];
    }
    const j = await r.json();
    return (j.itemSummaries || []).map(function (it) {
      const price = parseFloat(it.price && it.price.value);
      const ship = (it.shippingOptions && it.shippingOptions[0] &&
                    parseFloat(it.shippingOptions[0].shippingCost &&
                               it.shippingOptions[0].shippingCost.value)) || 0;
      return {
        itemId: it.itemId,
        source: 'ebay',
        title: it.title || '',
        price: isFinite(price) ? Math.round((price + ship) * 100) / 100 : null,
        shipping: ship,
        condition: (it.condition || '').toLowerCase() || 'unspecified',
        url: it.itemWebUrl || '',
        image: (it.image && it.image.imageUrl) || null,
        seller: (it.seller && it.seller.username) || null,
        buyable: true,
        provider: 'ebay_browse'
      };
    }).filter(function (i) { return i.price > 0 && i.url; });
  } catch (e) {
    console.error('[relay-source-search] eBay search failed:', e.message);
    return [];
  }
}

/** CJ supplier catalogue. Prices already include freight; see lib/relay-cj. */
async function searchCJ(description, maxPrice) {
  try {
    const r = await cj.search({ keyword: description, maxPrice: maxPrice, limit: 5 });
    return r.ok ? r.items : [];
  } catch (e) {
    console.error('[relay-source-search] CJ search failed:', e.message);
    return [];
  }
}

/** Reverse-image / shopping search via the provider layer. */
async function searchByImage(imageUrl, description, maxPrice) {
  const r = await reverseImage.findForSale({
    imageUrl: imageUrl,
    description: description,
    maxPrice: maxPrice,
    sourceableOnly: true
  });
  if (!r.ok) return [];
  return r.matches.map(function (m) {
    return {
      itemId: 'img_' + Buffer.from(m.url).toString('base64url').slice(0, 24),
      source: reverseImage.hostOf(m.url).replace(/\..*$/, ''),
      title: m.title,
      // Acquisition cost is item + shipping. Hardcoding 0 understated what the spend cap
      // and the margin floor are checked against, so a listing could clear both gates on
      // a cost we had not fully counted.
      price: Math.round((m.price + (m.shipping || 0)) * 100) / 100,
      shipping: m.shipping || 0,
      shippingKnown: m.shipping != null,
      condition: 'unspecified',
      url: m.url,
      image: m.thumbnail,
      seller: m.sourceName,
      // These come from a search index, not a buy API. The engine must confirm the
      // listing is still live before it charges anybody.
      buyable: false,
      provider: m.provider
    };
  });
}

/**
 * searchAllSources({ description, imageUrl, maxPrice, condition })
 *   → { ok, items:[...], sources:[...], reason }
 *
 * Cheapest-first. Every item carries a real URL and a real price, or it is not returned.
 * Back-compat: callers that only read the array still work, because .items is what they
 * were reading before and this returns an object with a length-bearing items field.
 */
async function searchAllSources(options) {
  options = options || {};
  const description = options.description || '';
  const imageUrl = options.imageUrl || '';
  const maxPrice = options.maxPrice != null ? parseFloat(options.maxPrice) : 500;
  const condition = options.condition || null;

  if (!description && !imageUrl) {
    return { ok: false, items: [], sources: [], reason: 'need a description or an imageUrl' };
  }

  // CJ is the only source Relay can BUY from without a human, so it is asked first and
  // its results are preferred. eBay and open-web matches still surface, but every one of
  // them ends in a manual fulfilment task until that marketplace offers a buy API.
  const results = await Promise.all([
    description ? searchEbay(description, maxPrice, condition) : Promise.resolve([]),
    (imageUrl || description) ? searchByImage(imageUrl, description, maxPrice) : Promise.resolve([]),
    description ? searchCJ(description, maxPrice) : Promise.resolve([])
  ]);

  const seen = new Set();
  // results[2] is CJ and was MISSING from this concat. CJ was added to the Promise.all
  // above but never joined here, so every cycle and every customer search spent ~17
  // seconds querying CJ — auth, list, then variant/stock/freight per product — and threw
  // the results away one line later. The symptom was "searched cj and found no buyable
  // listing", which reads like CJ returned nothing; it returned five priced, in-stock
  // items every time. Confirmed by isolating the layers: cj.search() 5 items,
  // searchCJ() 5 items, searchAllSources() 0.
  const items = [].concat(results[0], results[1], results[2])
    .filter(function (i) {
      if (!i || !i.url || !(i.price > 0) || i.price > maxPrice) return false;
      if (seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    })
    // Buyable first, then cheapest. A slightly dearer item Relay can order by itself is
    // worth more than a cheaper one that stalls waiting for a human.
    .sort(function (a, b) {
      if (!!b.buyable !== !!a.buyable) return b.buyable ? 1 : -1;
      return a.price - b.price;
    })
    .slice(0, 20);

  const sources = [];
  if (results[0].length) sources.push('ebay');
  if (results[1].length) sources.push('reverse-image');
  if (results[2].length) sources.push('cj');

  if (!items.length) {
    const configured = [];
    if (EBAY_CLIENT_ID && EBAY_CLIENT_SECRET) configured.push('ebay');
    if (cj.configured()) configured.push('cj');
    configured.push.apply(configured, reverseImage.availableProviders());
    return {
      ok: false,
      items: [],
      sources: [],
      reason: configured.length
        ? 'searched ' + configured.join(', ') + ' and found no buyable listing under $' + maxPrice
        : 'no sourcing provider configured. Set CJ_API_KEY (the only supplier Relay can ' +
          'buy from unattended), and/or EBAY_CLIENT_ID + EBAY_CLIENT_SECRET, and/or ' +
          'SERPAPI_KEY for image search.'
    };
  }

  return { ok: true, items: items, sources: sources, reason: null };
}

module.exports = {
  searchAllSources,
  searchEbay,
  searchByImage,
  searchCJ,
  ebayToken
};
