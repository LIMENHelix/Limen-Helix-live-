# Relay Stripe Webhook Setup

## What It Does

When a customer completes payment for a Relay marketplace order:

1. ✅ **Payment confirmed** — Order marked as `paid`
2. 💰 **Commission recorded** — Commission income recorded to finance ledger (`streamId: 'relay-commission'`)
3. 🏷️ **Franchise fee recorded** — Franchise fee recorded to ledger (`streamId: 'relay-franchise-fee'`)
4. 🤝 **Seller payout created** — Pending payout record created for seller (awaits operator approval + Stride Connect execution)

## Webhook Endpoint

```
POST https://limenhelix.com/api/relay-stripe-webhook
```

## Configuration Steps

### 1. Set Webhook Secret (Required)

Add to Vercel environment variables:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Get this from Stripe Dashboard:
- Go to **Developers** → **Webhooks**
- Click the endpoint URL ending in `/api/relay-stripe-webhook`
- Copy the **Signing secret** (starts with `whsec_`)
- Add to project env vars

### 2. Configure Webhook Events in Stripe Dashboard

Go to **Developers** → **Webhooks** → **Add endpoint**

**Endpoint URL:**
```
https://limenhelix.com/api/relay-stripe-webhook
```

**Events to listen for:**
- ✅ `payment_intent.succeeded` (PRIMARY — use for payment_links)
- ✅ `charge.succeeded` (fallback)
- ✅ `checkout.session.completed` (alternative checkout)

## How It Works

### Checkout Flow

1. **Buyer adds items to cart** → `POST /api/relay-marketplace-checkout`
   - Creates order record with `status: 'pending'`
   - Creates pending payout record for seller
   - Returns Stripe payment link URL

2. **Buyer pays on Stripe** → Stripe processes payment

3. **Payment succeeds** → Stripe sends webhook event

4. **Webhook handler** → `/api/relay-stripe-webhook`
   - Finds order by `payment_intent.metadata.orderId`
   - Updates order: `status: 'paid'`
   - Records commission income to finance ledger
   - Records franchise fee income to finance ledger
   - Seller payout stays pending (operator approves + Stride Connect executes)

### Data Flow

```
Order Created (pending)
  ↓
Payment Link generated
  ├─ metadata.orderId
  ├─ metadata.marketplace
  ├─ metadata.seller
  └─ metadata.buyer
  ↓
Customer → Stripe Checkout → Payment Succeeded
  ↓
payment_intent.succeeded webhook
  ├─ Extract metadata
  ├─ Find order in Redis
  ├─ Mark order: status='paid'
  ├─ Record commission income
  ├─ Record franchise fee income
  └─ Seller payout stays 'pending' (for operator approval)
```

## Testing Webhook Locally

### Using Stripe CLI

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login and forward events to localhost
stripe listen --forward-to localhost:3000/api/relay-stripe-webhook

# Get signing secret for .env
# Copy the signing secret from CLI output

# Trigger test event
stripe trigger payment_intent.succeeded
```

### Test Payload

```json
{
  "id": "evt_test_123",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_test_123",
      "amount": 4599,
      "metadata": {
        "orderId": "lst_test_order_123",
        "marketplace": "mkt_test_123",
        "seller": "usr_seller_123",
        "buyer": "usr_buyer_123"
      }
    }
  }
}
```

## Finance Ledger Records

### Commission Income
```javascript
{
  type: 'income',
  streamId: 'relay-commission',
  amount: 6.90,  // 15% of $46
  source: 'stripe-payment-intent',
  meta: { paymentIntentId: 'pi_...', orderId: 'ord_...', marketplace: 'mkt_...' }
}
```

### Franchise Fee Income
```javascript
{
  type: 'income',
  streamId: 'relay-franchise-fee',
  amount: 2.30,  // 5% of $46
  source: 'stripe-payment-intent',
  meta: { paymentIntentId: 'pi_...', orderId: 'ord_...', marketplace: 'mkt_...' }
}
```

### Seller Payout Record (Pending Operator Approval)
```javascript
{
  id: 'pyt_...',
  userId: 'usr_seller_123',
  marketplaceId: 'mkt_...',
  type: 'seller',
  amount: 36.80,  // subtotal - commission - franchise fee
  status: 'pending',  // → 'approved' → 'processing' (Stride Connect) → 'completed'
  orderId: 'ord_...'
}
```

## Next Step: Stride Connect

Once webhook confirms payment and records ledger, the seller payout is created as `status: 'pending'`.

The operator views pending payouts in **Relay Marketplace Control Panel** and approves them. Once approved, **Stride Connect** executes the bank transfer to the seller's account.

See: `STRIDE_CONNECT_SETUP.md` (to be created)

## Debugging

### Check if webhook is being called:
```bash
# Tail logs (depends on your logging setup)
tail -f logs/relay-webhook.log

# Or check Stripe Dashboard → Developers → Webhooks → Endpoint
# Look for "Recent Events" and verify they're being delivered (green checkmarks)
```

### If webhook fails:

1. Check Stripe Dashboard for delivery status
2. Verify env var `STRIPE_WEBHOOK_SECRET` is set
3. Check order exists in Redis: `curl https://limenhelix.com/api/relay-marketplace?action=seller-stats&sellerId=...`
4. Check ledger: `curl https://limenhelix.com/api/capital-engine?action=ledger-summary`

## Security Notes

- Webhook signature verification is enabled (validates `Stripe-Signature` header)
- If `STRIPE_WEBHOOK_SECRET` is not set, webhooks are allowed through (dev mode) — **set it in production**
- Metadata is passed through Stripe, so use only non-sensitive order IDs
- Seller payout execution requires explicit operator approval (not automatic)

## Commits

- **Webhook Handler:** `handlers/relay-stripe-webhook.js`
- **Checkout Metadata:** `handlers/relay-marketplace-checkout.js`
- **Stripe Rail Update:** `lib/stripe-rail.js`
- **API Router:** `api/[...route].js`

## Related Files

- Owner Control Panel: `/relay-marketplace-control.html` (approve payouts)
- Checkout Handler: `/handlers/relay-marketplace-checkout.js`
- Marketplace Library: `/lib/relay-marketplace.js`
- Finance Ledger: `/lib/finance-ledger.js`
