# Relay Marketplace Auto-Scraper Setup

## Quick Start

This scraper runs **locally on your machine** (not on Vercel) to pull products from Vinted with images and automatically create listings on Relay.

### Installation

```bash
# 1. Install Puppeteer locally
npm install puppeteer node-fetch

# 2. Run the scraper
node scraper-relay.js <marketplace> <search-query> <number-of-items>
```

### Examples

```bash
# Scrape 15 vintage items from Vinted
node scraper-relay.js vinted "vintage" 15

# Scrape 10 shoes
node scraper-relay.js vinted "shoes" 10

# Scrape Poshmark dresses
node scraper-relay.js poshmark "dresses" 12
```

### What It Does

1. **Launches Puppeteer** - Opens headless Chrome locally
2. **Scrapes Marketplace** - Searches Vinted/Poshmark for your query
3. **Extracts Data** - Title, price, image URL from each listing
4. **Downloads Images** - Converts to base64 (embedded in listing)
5. **Posts to Relay** - Auto-creates listings via `/api/relay-csv-import`
6. **Shows Revenue** - Calculates 20% commission you'd earn

### Real-World Workflow

```bash
# Run daily at 8am to refresh inventory
# macOS/Linux: add to crontab
0 8 * * * cd /path/to/relay && node scraper-relay.js vinted "leather bags" 20

# Windows: use Task Scheduler
# Create task: `node C:\path\to\scraper-relay.js vinted "leather bags" 20`
```

### Sample Output

```
═══════════════════════════════════════
   RELAY MARKETPLACE AUTO-SCRAPER
═══════════════════════════════════════
Marketplace: vinted
Query: "shoes"
Max items: 10
═══════════════════════════════════════

🔍 Scraping Vinted for "shoes"...
✓ Found 10 items

📦 Converting to Relay format...
  [1/10] Vintage Nike Air Force 1... ✓
  [2/10] Adidas Ultra Boost... ✓
  [3/10] Converse Chuck Taylor... ✓
  ...

📤 Creating 10 listings on Relay...
✅ Success! Created 10 listings
💰 Estimated revenue at 20% commission: $125.50

✨ Done!
View your storefront: https://limenhelix.com/marketplace-storefront
```

## System Requirements

- **Node.js** 16+
- **Chromium** (Puppeteer downloads automatically on first run)
- **2GB RAM** free

## How Revenue Works

For each item you scrape and list:

```
Selling Price: $50
Commission (20%):
  - 15% Relay marketplace fee
  - 5% franchise fee
Your Payout: $40

Monthly Example (100 items @ $50 avg):
  Gross: $5,000
  Your Commission: $1,000
  Relay gets: $4,000
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Puppeteer not found" | Run `npm install puppeteer` |
| "Chromium binary missing" | Puppeteer downloads it (~200MB) on first run |
| Scraper hangs | Marketplace may have changed selectors, update the selectors in the script |
| Images fail to download | Some sites block remote downloads - that's ok, listing created without image |

## Advanced: Schedule with pm2

```bash
npm install pm2 -g

# Create ecosystem.config.js
pm2 start scraper-relay.js --name "relay-scraper" --cron "0 8 * * *"
```

## Next Steps

1. Install Puppeteer: `npm install puppeteer node-fetch`
2. Run a test scrape: `node scraper-relay.js vinted "shoes" 5`
3. Check https://limenhelix.com/marketplace-storefront for your listings
4. Set up cron job for daily syncs

---

**Questions?** The scraper is production-ready. Run it as often as you want!
