/**
 * relay-reverse-image.js — "given this image, who is selling this thing and for how much"
 *
 * ONE interface, several providers, tried in order of how good their answer is.
 * The engine calls findForSale() and does not care which provider answered.
 *
 * FAILS CLOSED. If no provider is configured or every provider errors, this returns
 * { ok:false, matches:[] } with a reason. It NEVER invents a listing. A fabricated
 * source URL here would make the system buy nothing and ship nothing while reporting
 * a sale, which is the single worst failure this pipeline can have.
 *
 * PROVIDERS AND WHAT THEY COST (checked against each vendor's public pricing page,
 * 2026-08-30 — re-check before relying on a number):
 *   serpapi_lens   SERPAPI_KEY          Google Lens results incl. "visual matches" with
 *                                       merchant + price. ~$0.01-0.015 per search on the
 *                                       entry plan. This is the only provider that does
 *                                       true reverse-image-to-storefront.
 *   serpapi_shopping SERPAPI_KEY        Text -> Google Shopping. Used when we have a good
 *                                       text description but Lens found nothing for sale.
 *   google_cse     GOOGLE_API_KEY +     NOT reverse image. Vision labels the picture, then
 *                  GOOGLE_CSE_ID        Custom Search runs those labels as TEXT. Weakest
 *                                       match quality, but it is the cheapest path and it
 *                                       uses keys this project may already hold.
 *                                       100 queries/day free, then $5 per 1000.
 *
 * Google has no official reverse-image API. Scraping images.google.com or lens.google.com
 * directly is against their Terms of Service and breaks whenever they change markup; this
 * module deliberately does not do it.
 */

const SERPAPI_KEY = process.env.SERPAPI_KEY || process.env.SERP_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_VISION_KEY || '';
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || process.env.GOOGLE_SEARCH_ENGINE_ID || '';

const TIMEOUT_MS = parseInt(process.env.RELAY_HTTP_TIMEOUT_MS || '12000', 10);

/**
 * WHICH RESULTS COUNT AS "FOR SALE"
 *
 * This was an ALLOW-list of 16 hand-picked marketplaces. That was backwards. The whole
 * point of searching the open web is that anything with a price and a product page is a
 * potential source: Walmart, REI, Reverb, AbeBooks, a one-person Shopify store. The
 * allow-list rejected every one of them, and it even rejected shop.goodwill.com because
 * the list said shopgoodwill.com, a different host.
 *
 * It is now a DENY-list of places that show products but do not sell them, plus the
 * requirement (enforced in findForSale) that a result carry a real parseable price. A
 * page with a price and a product URL is a lead; everything else is noise.
 *
 * Purchasing is a separate question from finding. Only eBay can be bought
 * programmatically (see lib/relay-buy.js), and everything else becomes a human
 * fulfilment task, so narrowing the SEARCH buys nothing and costs supply. buyMode()
 * below records which is which without filtering anything out.
 */
const NOT_A_STORE = [
  // pin boards and social
  'pinterest.com', 'pinterest.co.uk', 'reddit.com', 'instagram.com', 'tiktok.com',
  'twitter.com', 'x.com', 'tumblr.com', 'flickr.com',
  // reference and wikis
  'wikipedia.org', 'wikimedia.org', 'fandom.com', 'wikihow.com',
  // video
  'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
  // q&a and forums
  'quora.com', 'stackexchange.com', 'stackoverflow.com', 'answers.com',
  // publishing platforms and news
  'medium.com', 'substack.com', 'blogspot.com', 'wordpress.com', 'nytimes.com',
  'bbc.co.uk', 'bbc.com', 'cnn.com', 'theguardian.com', 'forbes.com', 'buzzfeed.com',
  // reviews and listings that do not transact
  'yelp.com', 'tripadvisor.com', 'glassdoor.com',
  // price comparison: the link is a redirect, not a product page we can buy
  'shopping.google.com', 'pricegrabber.com', 'shopzilla.com', 'nextag.com',
  // our own storefront: never source from ourselves
  'limenhelix.com', 'broker-one-tau.vercel.app'
];

/** Marketplaces with a real purchase API. Informational: does NOT filter results. */
const AUTO_BUYABLE = ['ebay.com', 'ebay.co.uk', 'ebay.ca', 'ebay.com.au'];

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

function matches(host, list) {
  return list.some(function (d) { return host === d || host.endsWith('.' + d); });
}

/** True unless the host is a place that shows products without selling them. */
function isSourceable(url) {
  const h = hostOf(url);
  if (!h) return false;
  return !matches(h, NOT_A_STORE);
}

/** 'auto' when we can buy it by API, 'manual' when a human completes the purchase. */
function buyMode(url) {
  return matches(hostOf(url), AUTO_BUYABLE) ? 'auto' : 'manual';
}

/** Pull a USD amount out of whatever shape the provider used. */
function parsePrice(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'object') {
    if (typeof v.extracted_value === 'number') return v.extracted_value;
    if (v.value != null) return parsePrice(v.value);
    return null;
  }
  const m = String(v).replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isFinite(n) && n > 0 ? n : null;
}

async function getJSON(url) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function postJSON(url, body) {
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── provider 1: SerpAPI Google Lens (true reverse image) ─────────────────────
async function serpapiLens(imageUrl) {
  const u = 'https://serpapi.com/search.json?engine=google_lens&url=' +
            encodeURIComponent(imageUrl) + '&api_key=' + encodeURIComponent(SERPAPI_KEY);
  const j = await getJSON(u);
  if (j.error) throw new Error('serpapi: ' + j.error);

  const raw = [].concat(j.visual_matches || [], j.shopping_results || []);
  return raw.map(function (m) {
    return {
      title: m.title || '',
      url: m.link || m.product_link || '',
      sourceName: m.source || hostOf(m.link || ''),
      price: parsePrice(m.price),
      currency: (m.price && m.price.currency) || 'USD',
      thumbnail: m.thumbnail || null,
      inStock: m.in_stock !== false,
      provider: 'serpapi_lens'
    };
  });
}

// ── provider 2: SerpAPI Google Shopping (text -> for-sale listings) ──────────
async function serpapiShopping(query) {
  const u = 'https://serpapi.com/search.json?engine=google_shopping&q=' +
            encodeURIComponent(query) + '&api_key=' + encodeURIComponent(SERPAPI_KEY);
  const j = await getJSON(u);
  if (j.error) throw new Error('serpapi: ' + j.error);

  return (j.shopping_results || []).map(function (m) {
    return {
      title: m.title || '',
      url: m.product_link || m.link || '',
      sourceName: m.source || hostOf(m.link || ''),
      price: parsePrice(m.extracted_price != null ? m.extracted_price : m.price),
      currency: 'USD',
      thumbnail: m.thumbnail || null,
      inStock: true,
      // Google Shopping lists fixed-price offers only; an auction lot never appears here.
      // Lens visual matches carry no such guarantee, which is why they do not set this.
      fixedPriceConfirmed: true,
      provider: 'serpapi_shopping'
    };
  });
}

// ── provider 3: Google Vision labels -> Custom Search (weakest; not reverse image) ──
async function visionLabels(imageUrl) {
  const j = await postJSON(
    'https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(GOOGLE_API_KEY),
    {
      requests: [{
        image: { source: { imageUri: imageUrl } },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 6 },
          { type: 'LOGO_DETECTION', maxResults: 3 },
          { type: 'TEXT_DETECTION', maxResults: 3 }
        ]
      }]
    }
  );
  const a = (j.responses && j.responses[0]) || {};
  const labels = (a.labelAnnotations || []).map(function (l) { return l.description; });
  const logos = (a.logoAnnotations || []).map(function (l) { return l.description; });
  // Logos first: a brand name is worth more than "clothing", "fashion", "product".
  return logos.concat(labels).slice(0, 5).join(' ');
}

/**
 * Pull a real, published price out of a Custom Search result.
 *
 * CSE returns no price field, which is why this provider used to yield nothing usable:
 * the engine drops any match it cannot price, so with only CSE configured the loop found
 * pages every 30 minutes and published zero listings. Verified in production, three
 * consecutive cycles: "searched google_cse and found no buyable listing under $75".
 *
 * But CSE DOES return `pagemap`, which is the structured data the merchant published on
 * their own page (schema.org Offer/Product, Open Graph product tags). Reading that is not
 * guessing a price, it is reading the price the seller stated in machine-readable form.
 * Anything we cannot read this way stays unpriced and gets dropped, exactly as before.
 */
/**
 * Parse a money amount that is UNAMBIGUOUS, or return null.
 *
 * Stripping every non-digit is wrong and expensive: the localized form "1.299,00"
 * collapses to "1.29900" and reads as $1.30 instead of $1,299 — a 1000x mis-price that
 * the spend cap would happily approve. Exponent forms like "1.2e2" break the same way.
 * Only the two canonical shapes are accepted; anything else is refused.
 */
function parseAmount(raw) {
  if (raw == null) return null;
  let t = String(raw).trim().replace(/[\s ]/g, '');
  if (/e/i.test(t)) return null;                       // exponent form is never a real price tag
  t = t.replace(/^[^0-9.,-]+/, '').replace(/[^0-9.,-]+$/, '');   // drop currency symbols
  if (/[,.]\d{1,2}$/.test(t) && /[,.]/.test(t.slice(0, -3))) {
    // has both a group separator and a decimal separator
    const lastDot = t.lastIndexOf('.'), lastComma = t.lastIndexOf(',');
    if (lastComma > lastDot) return null;              // 1.299,00 -> European, refuse
    t = t.replace(/,/g, '');
  } else if (/,\d{1,2}$/.test(t)) {
    return null;                                       // 1299,00 -> decimal comma, refuse
  } else {
    t = t.replace(/,/g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = parseFloat(t);
  return isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

/** schema.org availability values that mean we cannot buy it right now. */
function unavailable(v) {
  return /outofstock|soldout|discontinued|preorder|backorder|instoreonly/i.test(String(v || ''));
}

/**
 * A price the MERCHANT published, or null. Never inferred, never converted.
 *
 * Hardened after review found seven ways this quietly produced a wrong number:
 *   - a missing currency field was treated as USD, so a GBP shop priced as dollars
 *   - out-of-stock offers still returned a price
 *   - twitter:data1 was read as money without checking twitter:label1, and that field
 *     commonly holds "5 minutes", an SKU or a stock count
 *   - category and comparison pages carry several products, and the first price found
 *     was attached to whichever result the search returned
 *   - localized and exponent number formats mis-parsed by orders of magnitude
 * Every one of those understates or overstates the acquisition cost that the spend cap
 * and the margin floor are checked against, so each is a money bug, not a cosmetic one.
 */
function priceFromPagemap(pm) {
  if (!pm) return null;
  const found = [];

  const offer = function (o, amount, currency) {
    if (amount == null) return;
    if (unavailable(o && (o.availability || o.itemavailability))) return;
    // Currency must be stated and must be USD. Silence is not USD.
    if (!currency || String(currency).toUpperCase() !== 'USD') return;
    const n = parseAmount(amount);
    if (n != null) found.push(n);
  };

  (pm.offer || []).forEach(function (o) { offer(o, o.price, o.pricecurrency || o.priceCurrency); });
  (pm.product || []).forEach(function (o) { offer(o, o.price, o.pricecurrency || o.priceCurrency); });
  (pm.aggregateoffer || []).forEach(function (o) {
    offer(o, o.lowprice != null ? o.lowprice : o.price, o.pricecurrency || o.priceCurrency);
  });
  (pm.metatags || []).forEach(function (m) {
    const cur = m['og:price:currency'] || m['product:price:currency'];
    offer(m, m['og:price:amount'] || m['product:price:amount'], cur);
    // twitter:data1 is a generic slot. Only money when its label says so.
    if (/price|cost/i.test(m['twitter:label1'] || '')) offer(m, m['twitter:data1'], cur);
  });

  if (!found.length) return null;
  // A category or comparison page carries several distinct products. There is no way to
  // tell which one the result URL is about, so refuse rather than pick one.
  const distinct = Array.from(new Set(found));
  if (distinct.length > 1) return null;
  return distinct[0];
}

/**
 * True only when the merchant explicitly published InStock availability. Absence is not
 * a yes: on a marketplace that runs auctions too, silence is exactly the ambiguous case.
 */
function buyNowSignal(pm) {
  if (!pm) return false;
  return (pm.offer || []).concat(pm.product || []).some(function (o) {
    return /instock|onlineonly|limitedavailability/i.test(String(o.availability || o.itemavailability || ''));
  });
}

/** Shipping the merchant published, when it is separate from the item price. */
function shippingFromPagemap(pm) {
  if (!pm) return null;
  let out = null;
  (pm.offer || []).concat(pm.product || []).forEach(function (o) {
    const v = o.shippingrate || o.shippingRate || o.deliveryprice;
    const n = parseAmount(v);
    if (n != null && out === null) out = n;
  });
  return out;
}

/** Auction hosts: you bid and wait, you do not buy. Never sourceable on demand. */
const AUCTION_ONLY = [
  'govdeals.com', 'publicsurplus.com', 'gsaauctions.gov', 'municibid.com', 'allsurplus.com',
  'propertyroom.com', 'storagetreasures.com', 'bid13.com', 'estatesales.net', 'auctionzip.com',
  'hibid.com', 'proxibid.com', 'k-bid.com', 'bidspotter.com', 'invaluable.com',
  'liveauctioneers.com', 'catawiki.com', 'ha.com', 'ebth.com', 'shopgoodwill.com',
  'liquidation.com', 'bstock.com'
];

/**
 * True when the listing can be bought right now at a stated price.
 *
 * An auction cannot. Publishing a lot we might not win means taking a customer's money
 * for something we cannot guarantee obtaining, which is the never-arrives refund case
 * manufactured on purpose. Those sites are excellent for buying stock ahead of time and
 * reselling from inventory; they are wrong for sourcing on demand.
 */
function isFixedPrice(url) {
  return !matches(hostOf(url), AUCTION_ONLY);
}

/**
 * Marketplaces that run BOTH auctions and buy-it-now on the same domain.
 * A hostname test cannot separate them, and on an auction page the number on display is
 * the current BID, not a price we can pay. Treating it as a purchase price is how the
 * engine would sell something it has not bought and might never win.
 */
const MIXED_FORMAT = ['ebay.com', 'ebay.co.uk', 'ebay.ca', 'ebay.com.au', 'catawiki.com', 'etsy.com'];

function looksLikeAuction(m) {
  const hay = [m && m.title, m && m.url, m && m.snippet].join(' ').toLowerCase();
  if (/auction|current bid|bids?|reserve met|time left|bidding/.test(hay)) return true;
  if (/\/auction|\/bid|auctionid=/.test(String((m && m.url) || '').toLowerCase())) return true;
  return false;
}

/** Buyable at a stated price right now: not an auction host, and not an auction listing. */
function isBuyableNow(m) {
  if (!m || !m.url) return false;
  if (!isFixedPrice(m.url)) return false;
  if (looksLikeAuction(m)) return false;
  // On a mixed-format marketplace, absence of auction wording is not proof. Require the
  // merchant's own structured buy-now signal.
  if (matches(hostOf(m.url), MIXED_FORMAT) && m.fixedPriceConfirmed !== true) return false;
  return true;
}

async function googleCSE(query) {
  const u = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(GOOGLE_API_KEY) +
            '&cx=' + encodeURIComponent(GOOGLE_CSE_ID) + '&q=' + encodeURIComponent(query + ' for sale');
  const j = await getJSON(u);
  return (j.items || []).map(function (it) {
    const pm = it.pagemap || {};
    const img = (pm.cse_thumbnail && pm.cse_thumbnail[0] && pm.cse_thumbnail[0].src) ||
                (pm.cse_image && pm.cse_image[0] && pm.cse_image[0].src) || null;
    return {
      title: it.title || '',
      snippet: it.snippet || '',
      url: it.link || '',
      sourceName: it.displayLink || hostOf(it.link || ''),
      // A price the merchant published in structured data, or null. Never inferred.
      price: priceFromPagemap(pm),
      // Separate shipping, when stated. Left null when unknown so the engine can treat
      // unknown shipping as a risk rather than as zero.
      shipping: shippingFromPagemap(pm),
      currency: 'USD',
      thumbnail: img,
      inStock: buyNowSignal(pm),
      fixedPriceConfirmed: buyNowSignal(pm),
      provider: 'google_cse'
    };
  });
}

/** Which providers are usable right now, in preference order. */
function availableProviders() {
  const out = [];
  if (SERPAPI_KEY) out.push('serpapi_lens', 'serpapi_shopping');
  if (GOOGLE_API_KEY && GOOGLE_CSE_ID) out.push('google_cse');
  return out;
}

/**
 * findForSale({ imageUrl, description, maxPrice, sourceableOnly })
 *   → { ok, matches:[{title,url,sourceName,price,provider,...}], provider, tried, reason }
 *
 * matches are sorted cheapest-first and every one carries a real, resolvable URL and a
 * real price. Anything without both is dropped, because the engine cannot buy it.
 */
async function findForSale(opts) {
  opts = opts || {};
  const imageUrl = opts.imageUrl || '';
  const description = opts.description || '';
  const maxPrice = typeof opts.maxPrice === 'number' ? opts.maxPrice : Infinity;
  const sourceableOnly = opts.sourceableOnly !== false;

  const providers = availableProviders();
  if (!providers.length) {
    return {
      ok: false,
      matches: [],
      provider: null,
      tried: [],
      reason: 'no reverse-image provider configured. Set SERPAPI_KEY (Google Lens, the only ' +
              'true reverse-image option), or GOOGLE_API_KEY + GOOGLE_CSE_ID for the weaker ' +
              'label-to-text fallback.'
    };
  }

  const tried = [];
  let all = [];
  let usedProvider = null;

  for (const p of providers) {
    try {
      let got = [];
      if (p === 'serpapi_lens') {
        if (!imageUrl) { tried.push({ provider: p, skipped: 'no imageUrl' }); continue; }
        got = await serpapiLens(imageUrl);
      } else if (p === 'serpapi_shopping') {
        if (!description) { tried.push({ provider: p, skipped: 'no description' }); continue; }
        got = await serpapiShopping(description);
      } else if (p === 'google_cse') {
        const q = description || (imageUrl ? await visionLabels(imageUrl) : '');
        if (!q) { tried.push({ provider: p, skipped: 'nothing to query' }); continue; }
        got = await googleCSE(q);
      }
      tried.push({ provider: p, returned: got.length });
      if (got.length) {
        all = all.concat(got);
        if (!usedProvider) usedProvider = p;
        // Stop only when Lens produced something that survives the SAME filters applied
        // below. Breaking on `price > 0` alone meant one priced auction result ended the
        // search, and the later filter then discarded it, leaving nothing when Shopping
        // or CSE would have had a real answer.
        if (p === 'serpapi_lens' && got.some(function (m) {
          return m.price > 0 && (!sourceableOnly || isSourceable(m.url)) && isBuyableNow(m);
        })) break;
      }
    } catch (e) {
      tried.push({ provider: p, error: e.message });
    }
  }

  const seen = new Set();
  const matches = all.filter(function (m) {
    if (!m.url || !m.price || m.price <= 0) return false;   // cannot buy it -> not a match
    if (m.price > maxPrice) return false;
    if (sourceableOnly && !isSourceable(m.url)) return false;
    // Full automation means we must be able to BUY it, now, at this price.
    if (!isBuyableNow(m)) return false;
    if (seen.has(m.url)) return false;
    seen.add(m.url);
    return true;
  }).sort(function (a, b) { return a.price - b.price; });

  if (!matches.length) {
    return {
      ok: false,
      matches: [],
      provider: usedProvider,
      tried: tried,
      reason: all.length
        ? 'providers answered but no result had both a resolvable price and a sourceable ' +
          'marketplace URL (' + all.length + ' raw results dropped)'
        : 'no provider returned any result'
    };
  }

  return { ok: true, matches: matches, provider: usedProvider, tried: tried, reason: null };
}

module.exports = {
  findForSale,
  availableProviders,
  isSourceable,
  isFixedPrice,
  isBuyableNow,
  looksLikeAuction,
  priceFromPagemap,
  shippingFromPagemap,
  parseAmount,
  buyMode,
  hostOf,
  NOT_A_STORE,
  AUTO_BUYABLE,
  AUCTION_ONLY
};
