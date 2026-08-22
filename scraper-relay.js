#!/usr/bin/env node
/**
 * Relay Marketplace Auto-Scraper
 * Runs locally with Puppeteer, scrapes products, auto-lists them
 * Usage: node scraper-relay.js <marketplace> <query> <count>
 */

const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const RELAY_API = 'https://limenhelix.com';
const MARKETPLACES = {
  vinted: {
    url: (q) => `https://www.vinted.com/catalog?search_text=${encodeURIComponent(q)}`,
    selectors: {
      cards: '[data-testid="catalogItemCard"]',
      title: '[data-testid="itemCardTitle"]',
      price: '[data-testid="itemCardPrice"]',
      image: 'img',
    }
  },
  poshmark: {
    url: (q) => `https://poshmark.com/search?query=${encodeURIComponent(q)}&type=listings`,
    selectors: {
      cards: '[data-testid="tile"]',
      title: '[data-testid="tile-title"]',
      price: '[data-testid="tile-price"]',
      image: 'img',
    }
  }
};

async function scrapeVinted(query, maxItems = 10) {
  console.log(`\n🔍 Scraping Vinted for "${query}"...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(MARKETPLACES.vinted.url(query), {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const items = await page.evaluate(() => {
      // Try multiple selector strategies
      let cards = Array.from(document.querySelectorAll('[data-testid="catalogItemCard"]'));
      if (cards.length === 0) cards = Array.from(document.querySelectorAll('a[href*="/items/"]'));
      if (cards.length === 0) cards = Array.from(document.querySelectorAll('[class*="ItemCard"]'));
      if (cards.length === 0) cards = Array.from(document.querySelectorAll('article'));

      return cards.slice(0, 50)
        .map(card => {
          // Try multiple title selectors
          let title = card.querySelector('[data-testid="itemCardTitle"]')?.textContent?.trim() ||
                     card.querySelector('[class*="title"]')?.textContent?.trim() ||
                     card.querySelector('h2')?.textContent?.trim() ||
                     card.textContent?.split('\n')[0]?.trim();

          // Try multiple price selectors
          let priceText = card.querySelector('[data-testid="itemCardPrice"]')?.textContent ||
                         card.querySelector('[class*="price"]')?.textContent ||
                         Array.from(card.querySelectorAll('*')).find(el => /\$|€|£/.test(el.textContent))?.textContent;
          let price = priceText ? parseFloat(priceText.replace(/[^\d.]/g, '')) : 0;

          // Try multiple image selectors
          let imageUrl = card.querySelector('img')?.src ||
                        card.querySelector('[style*="background-image"]')?.style.backgroundImage?.match(/url\("?([^"?]*)/)?.[1];

          let url = card.querySelector('a')?.href || card.href || '';

          return (title && title.length > 3 && price > 0 && imageUrl) ? { title, price, imageUrl, url } : null;
        })
        .filter(Boolean);
    });

    await browser.close();
    console.log(`✓ Found ${items.length} items`);
    return items.slice(0, maxItems);

  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    console.error('❌ Scrape failed:', e.message);
    return [];
  }
}

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.buffer();
    return 'data:image/jpeg;base64,' + buffer.toString('base64');
  } catch (e) {
    console.warn('  ⚠️  Image download failed for:', url);
    return null;
  }
}

async function createRelayCsvPayload(items) {
  console.log('\n📦 Converting to Relay format...');

  const rows = await Promise.all(items.map(async (item, i) => {
    process.stdout.write(`  [${i+1}/${items.length}] ${item.title.substring(0, 40)}... `);

    const image = await downloadImage(item.imageUrl);
    if (!image) {
      console.log('(image failed)');
      return null;
    }
    console.log('✓');

    return {
      title: item.title.substring(0, 100),
      price: item.price.toString(),
      condition: 'good',
      category: 'fashion',
      description: `Sourced from Vinted. Price: $${item.price}. ${item.url}`,
      imageUrl: image
    };
  }));

  return rows.filter(Boolean);
}

async function createListingsOnRelay(rows) {
  if (rows.length === 0) {
    console.log('❌ No items to upload');
    return;
  }

  console.log(`\n📤 Creating ${rows.length} listings on Relay...`);

  try {
    const payload = {
      action: 'import',
      rows: rows
    };

    const response = await fetch(`${RELAY_API}/api/relay-csv-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`✅ Success! Created ${rows.length} listings`);
      console.log(`💰 Estimated revenue at 20% commission: $${(rows.reduce((sum, r) => sum + parseFloat(r.price), 0) * 0.2).toFixed(2)}`);
    } else {
      console.log('⚠️  Response:', data);
    }
  } catch (e) {
    console.error('❌ Upload failed:', e.message);
  }
}

async function main() {
  const marketplace = process.argv[2] || 'vinted';
  const query = process.argv[3] || 'shoes';
  const count = parseInt(process.argv[4]) || 10;

  console.log('═══════════════════════════════════════');
  console.log('   RELAY MARKETPLACE AUTO-SCRAPER');
  console.log('═══════════════════════════════════════');
  console.log(`Marketplace: ${marketplace}`);
  console.log(`Query: "${query}"`);
  console.log(`Max items: ${count}`);
  console.log('═══════════════════════════════════════');

  // Scrape
  const items = await scrapeVinted(query, count);
  if (items.length === 0) {
    console.log('No items found');
    process.exit(1);
  }

  // Convert
  const rows = await createRelayCsvPayload(items);

  // Upload
  await createListingsOnRelay(rows);

  console.log('\n✨ Done!');
  console.log(`View your storefront: ${RELAY_API}/marketplace-storefront`);
}

main().catch(console.error);
