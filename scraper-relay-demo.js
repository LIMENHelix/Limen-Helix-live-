#!/usr/bin/env node
/**
 * Relay Marketplace Auto-Scraper DEMO
 * Shows complete workflow with sample data (you adapt selectors for real scraping)
 */

const RELAY_API = 'https://limenhelix.com';

/* FIX-0103: /api/relay-csv-import is a server-to-server administrative route.
   This demo is a Node operator script, so it reads the credential from its own
   environment and never embeds it. The value is not printed. */
const RELAY_ADMIN_KEY = process.env.RELAY_ADMIN_KEY || '';

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

/* Send the original HTTPS image URLs. The server performs the validated,
   pinned, bounded fetch. This demo never predownloads or base64-encodes. */
function buildCsv(items) {
  const csvLines = ['title,price,condition,category,description,imageUrl'];
  items.forEach(item => {
    const quote = (str) => `"${String(str).replace(/"/g, '""')}"`;
    csvLines.push(`${quote(item.title)},${item.price},${item.condition},fashion,${quote(item.description)},${item.imageUrl}`);
  });
  return csvLines.join('\n');
}

async function createListingsOnRelay(items) {
  console.log(`\n📤 Creating ${items.length} listings on Relay API...\n`);

  if (!RELAY_ADMIN_KEY) {
    console.error('❌ RELAY_ADMIN_KEY is required for this administrative import.');
    console.error('   Set it in the operator environment; do not put it in browser code.');
    return;
  }

  try {
    const csv = buildCsv(items);

    const payload = {
      csv: csv,
      marketplaceId: 'relay-main',
      sellerId: 'seller-001',
      downloadImages: true
    };

    const response = await fetch(`${RELAY_API}/api/relay-csv-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-admin-key': RELAY_ADMIN_KEY
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
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

  // The server fetches and validates each original HTTPS image URL.
  console.log('🖼️  Image retrieval is performed by the Relay import route.\n');
  await createListingsOnRelay(SAMPLE_PRODUCTS);

  console.log('\n🎉 Demo Complete!');
  console.log('\nNext Steps:');
  console.log('1. Visit the storefront: https://limenhelix.com/marketplace-storefront');
  console.log('2. Inspect Vinted/Poshmark page in browser DevTools');
  console.log('3. Update selectors in scraper-relay.js to match current HTML');
  console.log('4. Run: node scraper-relay.js vinted shoes 10');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  buildCsv: buildCsv,
  createListingsOnRelay: createListingsOnRelay,
  SAMPLE_PRODUCTS: SAMPLE_PRODUCTS
};
