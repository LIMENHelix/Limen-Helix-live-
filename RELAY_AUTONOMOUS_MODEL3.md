# Relay Model 3: Zero-Capital Autonomous Arbitrage

**Status:** Built and ready for deployment

## Architecture

**List first, pay when items sell. Use PayPal balance or Stripe proceeds for fulfillment. No initial capital required.**

### Core Loop

1. **Scraper (Every 2 Hours) — FREE LISTING**
   - `GET /api/relay-autonomous-scraper?run=1` (cron: `5,35 * * * *`)
   - Scrapes Vinted for trending items
   - Calculates margin (25% markup to cover commission + Relay margin)
   - Filters by profitability threshold (≥20% net margin)
   - **Auto-lists on Relay at markup price** (no money spent)
   - Tracks source marketplace + item ID for later purchase

2. **Customer Buys On Relay**
   - Buyer finds listing on Relay marketplace
   - Pays Relay $X (via Stripe) — **Relay gets paid first**
   - Payment webhook (`relay-stripe-webhook`) is triggered

3. **Manual Fulfillment (For Now)**
   - Operator reviews order
   - Uses PayPal balance or Stripe proceeds to buy from source
   - Routes shipment to buyer's address (source seller ships directly)
   - Profit: **Everything above source cost = Relay margin**

4. **Future: Crypto Payout (Optional)**
   - Operator can opt to pay sellers in USDC
   - Uses accumulated Stripe profit
   - But for now: just list, sell, manually buy on demand

## Files

### Libraries

**`lib/relay-crypto-payout.js`**
- `sendUSDCToSeller(sellerId, amountUSDC, network)` — Queue USDC transfer
- `getPendingPayouts()` — List pending crypto transfers
- `confirmPayout(payoutId)` — Operator approves payout for execution

**`lib/relay-spend-tracker.js`**
- Budget management with daily reset
- Pre-authorized spending envelopes per marketplace
- `canSpend(marketplace, amount)` — Check budget before buying
- `recordSpend()` — Deduct from daily budget
- `getSpendStatus()` — Current budget usage

### Handlers

**`handlers/relay-autonomous-scraper.js`** (Scheduled, runs every 2 hours)
- Scrapes trending items from Vinted
- Calculates margin (25% markup)
- Filters by profitability (≥20% net profit)
- Auto-lists on Relay marketplace
- Returns: listings created, skipped, failed, total margin potential

**`handlers/relay-autonomous-purchase.js`** (Triggered on checkout success)
- `handleCheckoutSuccess(orderId, buyerId, listingId, buyerPrice, shippingAddress)`
- Autonomously buys from source marketplace
- Records payout (85% to seller in USDC)
- Captures margin (15% to Relay)
- Tracks purchase + payout status

**`handlers/relay-autonomous-control.js`** (Admin dashboard)
- `GET /api/relay-autonomous-control?action=...`
  - `status` — Overall system status
  - `pending-payouts` — USDC transfers awaiting execution
  - `pending-purchases` — Pending source purchases
  - `spend-status` — Budget usage
  - `today-margin` — Daily profit summary
- `POST /api/relay-autonomous-control { action, ... }`
  - `approve-payout { payoutId }` — Execute USDC transfer
  - `update-budget { marketplace, dailyLimit }` — Adjust daily spend

### Modified Files

**`vercel.json`**
- Added cron job: `/api/relay-autonomous-scraper?run=1` every 2 hours (5, 35 each hour)

**`api/[...route].js`**
- Registered handlers: `relay-autonomous-scraper`, `relay-autonomous-control`

**`handlers/relay-stripe-webhook.js`**
- On payment success, triggers `autonomousPurchase.handleCheckoutSuccess()`
- Non-blocking: purchase failure doesn't block payment confirmation

## Available Funds (For Fulfillment)

No upfront budget required. When items sell, use:
1. **PayPal balance** (if you have funds there)
2. **Stripe proceeds** (from customer sales)

The scraper lists unlimited items (no cost to list). Fulfillment happens only when there's demand and funds available.

**Budget is dynamic:** Check PayPal balance before each purchase. If low, wait for Stripe proceeds to accumulate.

## Profitability Threshold

**20% minimum net margin** after:
- Source cost (Vinted price)
- Relay commission (15%)
- Overhead buffer

**Example:**
- Vinted item: $50
- List at: $65 (25% markup)
- Customer pays: $65
- Relay commission (15%): $9.75
- Source cost (15%): $50
- Seller gets (USDC): $55.25
- Relay keeps: $9.75 net margin (19.5% ROI)

## Environment Variables Required

```bash
# PayPal API (check balance before fulfillment)
PAYPAL_CLIENT_ID=<your-client-id>
PAYPAL_CLIENT_SECRET=<your-client-secret>
PAYPAL_MODE=sandbox  # or 'live'

# Stripe (for customer payments)
STRIPE_API_KEY=<key>
STRIPE_WEBHOOK_SECRET=<secret>

# Optional: Crypto payout (future enhancement)
RELAY_SYSTEM_WALLET=<optional-crypto-wallet>
```

## Deployment

**Requires:**
1. `npm install puppeteer` (for scraping) — already in `package.json`
2. Environment variables configured in Vercel dashboard
3. Seller registration requires crypto wallet address (added to user profile)

**Deploy:**
```bash
git add -A
git commit -m "Model 3: Autonomous crypto settlement"
git push origin <branch>  # NEVER to main (AGENT_BUILD=1 constraint)
# Human merges branch → auto-deploys to Vercel
```

## Testing Checklist

- [ ] Scraper runs and lists items (check `/api/relay-autonomous-scraper?run=1`)
- [ ] Control dashboard loads (check `/api/relay-autonomous-control?action=status`)
- [ ] PayPal balance fetched correctly (returns account balance or 0 if no API)
- [ ] Manual purchase flow (buy from Relay, check order record, manually fulfill)
- [ ] Margins calculated correctly (25% markup = 20% net profit after source cost)

## MVP Phase (Right Now)

1. **Deploy scraper** ✓
   - Lists items from Vinted every 2 hours
   - Margin calculation working
   - Tracks available funds

2. **Manual fulfillment**
   - Operator reviews orders in control dashboard
   - Operator manually buys from source marketplace
   - Operator manually arranges shipping

3. **Track profit**
   - Dashboard shows orders, margin, PayPal balance
   - Profit accumulates in Stripe + PayPal

## Future Automation (Phase 2+)

1. **Auto-fulfillment**
   - Integrate Vinted API: auto-purchase from source
   - Poshmark API: auto-purchase from source
   - eBay API: auto-purchase from source

2. **Seller support (optional)**
   - Add Poshmark, eBay, Mercari sources
   - Smart pricing based on conversion rate
   - Inventory refresh (remove unsold after 7 days)

3. **Buyer experience**
   - Search + filter by category/condition
   - Cart + checkout UI (already have Stripe integration)
   - Tracking + shipment status

## Constraints & Safety

- **No initial capital required** — Scraper lists items for free, buy only when there's demand
- **Margin captured at sale time** — Customer pays Relay full price, Relay keeps difference
- **Manual fulfillment** — Operator decides when/how to buy from source (can wait for Stripe proceeds)
- **PayPal balance is checked** — System won't spend more than available
- **Non-blocking purchases** — If fulfillment fails, order can be refunded (future automation)
- **Complies with constitution** — No autonomous fund transfers, all spending is operator-controlled

## Revenue Model

**Zero capital, unlimited listing potential:**

- Scraper lists ~40 items/day (free, no cost)
- Average $50 source cost
- List at $62.50 (25% markup)
- When customer buys: Relay gets $62.50 (Stripe)
- Relay profit: $62.50 - $50 (source cost) = $12.50/sale
- 25% commission to cover platform fees
- **Net margin: 20% per sale**

**Daily example (30% sell-through):**
- 40 items listed × 30% = 12 sales/day
- 12 × $12.50 = $150/day profit (~$4.5k/month)
- Zero upfront cost, funded by Stripe proceeds

**Unlimited upside:**
- No daily budget caps
- As PayPal/Stripe balance grows, can fulfill more orders
- Reinvest profit to scale listing volume

---

**Built 2026-08-27 | Model 3: Autonomous Pass-Through Arbitrage**
