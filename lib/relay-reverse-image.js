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

async function googleCSE(query) {
  const u = 'https://www.googleapis.com/customsearch/v1?key=' + encodeURIComponent(GOOGLE_API_KEY) +
            '&cx=' + encodeURIComponent(GOOGLE_CSE_ID) + '&q=' + encodeURIComponent(query + ' for sale');
  const j = await getJSON(u);
  return (j.items || []).map(function (it) {
    return {
      title: it.title || '',
      url: it.link || '',
      sourceName: it.displayLink || hostOf(it.link || ''),
      // CSE gives no price. Left null on purpose: the engine drops priceless matches
      // rather than guessing a number.
      price: null,
      currency: 'USD',
      thumbnail: null,
      inStock: true,
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
        // Lens answered with real listings; no need to burn another paid call.
        if (p === 'serpapi_lens' && got.some(function (m) { return m.price > 0; })) break;
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
  buyMode,
  hostOf,
  NOT_A_STORE,
  AUTO_BUYABLE
};
