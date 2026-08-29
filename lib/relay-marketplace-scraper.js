/**
 * relay-marketplace-scraper.js — Scrape real prices from marketplace listings
 *
 * Takes search results and extracts actual prices from:
 * - Craigslist
 * - OfferUp
 * - Facebook Marketplace
 * - Local classifieds
 */

async function scrapeCraiglist(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Relay-Bot/1.0)' }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Extract price from Craigslist page
    // Craigslist format: <span class="price">$XXX</span>
    const priceMatch = html.match(/\$[\d,]+(?:\.\d{2})?/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace('$', '').replace(',', '')) : null;

    // Extract title
    const titleMatch = html.match(/<span class="postingtitle".*?>(.*?)<\/span>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Craigslist Item';

    return price ? { price, title, source: 'craigslist', url } : null;
  } catch (e) {
    console.error('[scraper] Craigslist scrape failed:', e.message);
    return null;
  }
}

async function scrapeOfferUp(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Relay-Bot/1.0)' }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // OfferUp stores price in data attributes or meta tags
    // Try multiple patterns
    let price = null;

    // Pattern 1: data-price attribute
    const dataPriceMatch = html.match(/data-price="(\d+(?:\.\d{2})?)"/);
    if (dataPriceMatch) price = parseFloat(dataPriceMatch[1]);

    // Pattern 2: price in meta tag
    if (!price) {
      const metaPriceMatch = html.match(/"price":\s*"?\$?([\d.]+)/);
      if (metaPriceMatch) price = parseFloat(metaPriceMatch[1]);
    }

    // Pattern 3: direct price in HTML
    if (!price) {
      const htmlPriceMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      if (htmlPriceMatch) price = parseFloat(htmlPriceMatch[1].replace(',', ''));
    }

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : 'OfferUp Item';

    return price ? { price, title, source: 'offerup', url } : null;
  } catch (e) {
    console.error('[scraper] OfferUp scrape failed:', e.message);
    return null;
  }
}

async function scrapeFacebookMarketplace(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Relay-Bot/1.0)' }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Facebook format varies, try extracting from common patterns
    const priceMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Facebook Marketplace Item';

    return price ? { price, title, source: 'facebook-marketplace', url } : null;
  } catch (e) {
    console.error('[scraper] Facebook scrape failed:', e.message);
    return null;
  }
}

async function scrapeListingPage(url, source) {
  if (!url) return null;

  // Route to appropriate scraper based on source
  if (source.includes('craigslist')) {
    return scrapeCraiglist(url);
  } else if (source.includes('offerup')) {
    return scrapeOfferUp(url);
  } else if (source.includes('facebook') || source.includes('marketplace')) {
    return scrapeFacebookMarketplace(url);
  } else {
    // Generic scraper for other sources
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Relay-Bot/1.0)' }
      });

      if (!response.ok) return null;

      const html = await response.text();
      const priceMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

      return price ? { price, title: 'Marketplace Item', source, url } : null;
    } catch (e) {
      return null;
    }
  }
}

async function scrapeSearchResults(searchResults) {
  // Take Google search results and scrape real prices from each URL
  const scraped = [];

  for (const result of searchResults.slice(0, 5)) {
    try {
      const itemData = await scrapeListingPage(result.url, result.displayLink);

      if (itemData && itemData.price > 0) {
        scraped.push({
          title: itemData.title || result.title,
          price: itemData.price,
          source: itemData.source,
          url: result.url,
          displayLink: result.displayLink,
          snippet: result.snippet
        });
      }
    } catch (e) {
      console.error('[scraper] Failed to scrape:', result.url, e.message);
    }
  }

  // Sort by price (cheapest first)
  return scraped.sort((a, b) => a.price - b.price);
}

module.exports = {
  scrapeSearchResults,
  scrapeListingPage,
  scrapeCraiglist,
  scrapeOfferUp,
  scrapeFacebookMarketplace
};
