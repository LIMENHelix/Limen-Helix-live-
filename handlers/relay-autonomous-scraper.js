/**
 * relay-autonomous-scraper.js — Scheduled scraper (runs via vercel.json cron)
 *
 * Triggered: every 2 hours (8 times/day)
 * Path: /api/relay-autonomous-scraper?run=1
 *
 * Loop:
 *   1. Scrape Vinted (top trending items)
 *   2. Filter by margin (only list if >20% profit after commission)
 *   3. Auto-list on Relay marketplace
 *   4. Track source item ID for purchase later
 *   5. Report daily margin potential
 */

const puppeteer = require('puppeteer');
const db = require('../lib/limen-db');
const marketplace = require('../lib/relay-marketplace');
const spendTracker = require('../lib/relay-spend-tracker');
const paypalBalance = require('../lib/relay-paypal-balance');

const MARGIN_THRESHOLD = 0.20;  // 20% minimum profit
const ITEMS_PER_RUN = 20;
const ITEM_TTL = 604800000;  // 7 days in ms

async function scrapeVinted(query = 'shoes', limit = 20) {
  const items = [];
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(`https://www.vinted.com/catalog?search_text=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const data = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="catalogItemCard"]'));
      return cards.slice(0, 50).map(card => {
        const title = card.querySelector('[data-testid="itemCardTitle"]')?.textContent?.trim() || '';
        const priceText = card.querySelector('[data-testid="itemCardPrice"]')?.textContent || '';
        const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
        const image = card.querySelector('img')?.src || '';
        const link = card.querySelector('a')?.href || '';

        return (title && price > 0 && image && link) ? { title, price, image, link } : null;
      }).filter(Boolean);
    });

    await browser.close();
    return data.slice(0, limit);
  } catch (e) {
    console.error('[relay-scraper]', e.message);
    if (browser) await browser.close().catch(() => {});
    return [];
  }
}

async function calculateMargin(sourceCost, commissionRate = 0.15) {
  // List at 25% markup to account for commission + Relay margin
  const margin = sourceCost * 0.25;
  const listPrice = sourceCost + margin;
  const relayMargin = listPrice * commissionRate;
  const netMargin = margin - relayMargin;
  const profitPercent = netMargin / sourceCost;

  return {
    sourceCost,
    listPrice: Math.round(listPrice * 100) / 100,
    relayMargin: Math.round(relayMargin * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
    profitPercent: (profitPercent * 100).toFixed(1) + '%',
    profitable: profitPercent >= MARGIN_THRESHOLD
  };
}

async function autoListItem(item, source = 'vinted') {
  const margin = await calculateMargin(item.price);

  if (!margin.profitable) {
    return { ok: false, reason: 'below margin threshold', item: item.title };
  }

  // Create Relay listing
  // First, ensure default marketplace exists
  let mks = await marketplace.listMarketplaces();
  let defaultMkt = mks[0];
  if (!defaultMkt) {
    defaultMkt = await marketplace.createMarketplace({
      name: 'Relay Arbitrage',
      commissionRate: 0.15,
      franchiseFeeRate: 0.05
    });
  }

  // Create system seller if not exists
  let sellers = await db.get('relay:system-sellers') || {};
  let systemSeller = sellers['relay-auto'];
  if (!systemSeller) {
    systemSeller = await marketplace.createUser({
      email: 'relay-autonomous@limenhelix.com',
      name: 'Relay Autonomous',
      role: 'seller',
      walletAddress: process.env.RELAY_SYSTEM_WALLET || null
    });
    sellers['relay-auto'] = systemSeller;
    await db.set('relay:system-sellers', sellers);
  }

  // Create listing
  const listing = await marketplace.createListing({
    marketplaceId: defaultMkt.id,
    sellerId: systemSeller.id,
    title: item.title,
    price: margin.listPrice,
    description: `Sourced from ${source}. Original: $${item.price}. ${item.link}`,
    images: [item.image],
    category: 'fashion',
    condition: 'good',
    quantity: 1,
    sourceId: item.sourceId || item.link,
    sourceMarketplace: source,
    sourceCost: item.price,
    listedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ITEM_TTL).toISOString()
  });

  return {
    ok: true,
    listing: listing.id,
    title: item.title,
    listPrice: margin.listPrice,
    sourceCost: item.price,
    profitPercent: margin.profitPercent,
    relayMargin: margin.relayMargin
  };
}

async function runScrape() {
  const status = {
    timestamp: new Date().toISOString(),
    listed: 0,
    skipped: 0,
    failed: 0,
    totalMargin: 0,
    items: []
  };

  try {
    // Scrape trending items (no budget requirement, we list first and buy on demand)
    const items = await scrapeVinted('trending', ITEMS_PER_RUN);

    for (const item of items) {
      try {
        const result = await autoListItem(item, 'vinted');
        if (result.ok) {
          status.listed++;
          status.totalMargin += parseFloat(result.relayMargin);
          status.items.push(result);
        } else {
          status.skipped++;
        }
      } catch (e) {
        status.failed++;
        console.error('[relay-scraper] list error:', e.message);
      }
    }
  } catch (e) {
    console.error('[relay-scraper] fatal:', e.message);
    status.error = e.message;
  }

  return status;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
  }

  const q = {};
  try {
    Object.assign(q, Object.fromEntries(new URL(req.url, 'http://h').searchParams));
  } catch (e) {}

  if (q.run !== '1') {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'pass ?run=1' }));
  }

  try {
    const result = await runScrape();
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, result }));
  } catch (e) {
    console.error('[relay-autonomous-scraper]', e.message);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
