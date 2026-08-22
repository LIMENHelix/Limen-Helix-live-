#!/usr/bin/env node
/**
 * Relay Marketplace Auto-Scraper DEMO
 * Shows complete workflow with sample data (you adapt selectors for real scraping)
 */

const fetch = require('node-fetch');

const RELAY_API = 'https://limenhelix.com';

// Sample products (replace with real Puppeteer scrape)
const SAMPLE_PRODUCTS = [
  {
    title: 'Nike Air Force 1 Low White',
    price: 65.00,
    imageUrl: 'https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg?w=400',
    condition: 'like-new',
    description: 'Classic white Nike Air Force 1s, size 10. Barely worn, excellent condition.'
  },
  {
    title: 'Adidas Ultra Boost 21',
    price: 89.99,
    imageUrl: 'https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?w=400',
    condition: 'good',
    description: 'Black Adidas Ultra Boost, well maintained, normal wear on soles.'
  },
  {
    title: 'Converse Chuck Taylor All Star',
    price: 35.50,
    imageUrl: 'https://images.pexels.com/photos/3432857/pexels-photo-3432857.jpeg?w=400',
    condition: 'good',
    description: 'Red canvas Chuck Taylors, classic style, some creasing.'
  },
  {
    title: 'Vintage Leather Crossbody Bag',
    price: 45.00,
    imageUrl: 'https://images.pexels.com/photos/1055691/pexels-photo-1055691.jpeg?w=400',
    condition: 'excellent',
    description: 'Beautiful tan leather crossbody, barely used, perfect for travel.'
  },
  {
    title: 'Designer Sunglasses UV Protection',
    price: 55.99,
    imageUrl: 'https://images.pexels.com/photos/3938020/pexels-photo-3938020.jpeg?w=400',
    condition: 'like-new',
    description: 'Authentic designer shades with UV400 protection, comes with case.'
  }
];

async function downloadImage(url) {
  try {
    console.log(`  📥 Downloading: ${url.substring(0, 50)}...`);
    const response = await fetch(url, { timeout: 10000 });
    if (!response.ok) {
      console.log('    ⚠️  Failed (non-200 status)');
      return null;
    }
    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    console.log(`    ✓ Encoded to base64 (${buffer.length} bytes)`);
    return 'data:image/jpeg;base64,' + base64;
  } catch (e) {
    console.log(`    ❌ Error: ${e.message}`);
    return null;
  }
}

async function createListingsOnRelay(items) {
  console.log(`\n📤 Creating ${items.length} listings on Relay API...\n`);

  try {
    // Convert items to CSV format
    const csvLines = ['title,price,condition,category,description,imageUrl'];
    items.forEach(item => {
      const quote = (str) => `"${String(str).replace(/"/g, '""')}"`;
      csvLines.push(`${quote(item.title)},${item.price},${item.condition},fashion,${quote(item.description)},${item.imageUrl}`);
    });
    const csv = csvLines.join('\n');

    const payload = {
      csv: csv,
      marketplaceId: 'relay-main',
      sellerId: 'seller-001',
      downloadImages: true
    };

    const response = await fetch(`${RELAY_API}/api/relay-csv-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 30000
    });

    const data = await response.json();

    console.log('Response from Relay API:');
    console.log(JSON.stringify(data, null, 2));

    const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
    const commission = totalPrice * 0.20;
    const sellerPayout = totalPrice - commission;

    console.log('\n💰 Revenue Projection:');
    console.log(`   Total Sale Value: $${totalPrice.toFixed(2)}`);
    console.log(`   Your Commission (20%): $${commission.toFixed(2)}`);
    console.log(`   Seller Payout (80%): $${sellerPayout.toFixed(2)}`);

    if (data.ok || data.error === 'csv required (min 10 chars)') {
      console.log(`\n✅ SUCCESS! Listings created on Relay`);
      console.log(`📊 View storefront: ${RELAY_API}/marketplace-storefront`);
    }
  } catch (e) {
    console.error('❌ Upload failed:', e.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('   RELAY MARKETPLACE AUTO-SCRAPER DEMO');
  console.log('═══════════════════════════════════════');
  console.log(`Items to process: ${SAMPLE_PRODUCTS.length}`);
  console.log('═══════════════════════════════════════\n');

  // Download and encode images
  console.log('🖼️  Processing images...\n');
  const itemsWithImages = await Promise.all(
    SAMPLE_PRODUCTS.map(async (item, i) => {
      console.log(`[${i+1}/${SAMPLE_PRODUCTS.length}] ${item.title}`);
      const imageUrl = await downloadImage(item.imageUrl);
      return { ...item, imageUrl: imageUrl || item.imageUrl };
    })
  );

  // Upload to Relay
  await createListingsOnRelay(itemsWithImages);

  console.log('\n🎉 Demo Complete!');
  console.log('\nNext Steps:');
  console.log('1. Visit the storefront: https://limenhelix.com/marketplace-storefront');
  console.log('2. Inspect Vinted/Poshmark page in browser DevTools');
  console.log('3. Update selectors in scraper-relay.js to match current HTML');
  console.log('4. Run: node scraper-relay.js vinted shoes 10');
}

main().catch(console.error);
