# What Men Carry Setup Guide

## Overview

**What Men Carry** is a revenue stream dedicated to powerful 15-second cinematic silent videos about men's invisible burdens: mental health, trauma, PTSD, custody, stress, depression, and vulnerability.

- **Watch**: Free for all users
- **Copy taglines**: Buy per video ($0.99 one-time)
- **Taglines only**: Descriptions (cinematic briefs) are metadata only—never shown to users
- **Model**: Impulse-friendly, honor each share, volume-based recurring revenue

## Files

- `what-men-carry.html` — Main gallery page (served at `/what-men-carry`)
- `handlers/what-men-carry.js` — API handler
- `what-men-carry-manifest.js` — Video library manifest
- `api/[...route].js` — Hono router (updated to include what-men-carry)

## How to Add Videos

Edit `what-men-carry-manifest.js` and add entries:

```javascript
{
  id: 'wmc-NNN-topic',
  title: 'Video Title',
  duration: '0:15',
  topic: 'Custody / Mental Health / PTSD / etc',
  tagline: 'The single powerful sentence users copy and share.',
  description: 'Full cinematic visual brief (NOT shown to users, metadata only)',
  url: '/videos/wmc-NNN-topic.mp4'
}
```

- **id**: Format: `wmc-NNN-topic` (NNN = number, topic = slug)
- **title**: Display title
- **duration**: Always 0:15 (15 seconds)
- **topic**: Category for filtering (e.g., "Custody & Presence", "PTSD & Trauma")
- **tagline**: ONE powerful sentence. This is what people copy, share, and remember.
- **description**: The cinematic brief used to generate the video (AI, human filmmaker, director). NOT exposed via API.
- **url**: Path to video file (local or CDN)

## Video Hosting

### Option 1: Local Storage (Testing)
1. Create `/public/videos/` directory
2. Place `.mp4` files there
3. URLs: `/videos/wmc-NNN-topic.mp4`

### Option 2: CDN (Production scale)
- Upload to Vercel Blob, S3, or your CDN
- Update `url` field with CDN URL
- Scales to 100+ videos without repo bloat

## Pricing Strategy

**Current default**: $4.99/month (499 cents)

### Options to Consider

#### Option A: Flat Monthly ($4.99)
- **Pros**: Simple, impulse-friendly, low friction
- **Cons**: Same price for 1 video or 100 videos

#### Option B: Topic Tiers
```
"Mental Health Awareness" tier: $4.99/mo
"PTSD & Trauma" tier: $4.99/mo
"Fatherhood" tier: $4.99/mo
All topics: $9.99/mo
```
- **Pros**: Segment by relevance, upsell to "all topics"
- **Cons**: More complex checkout flow

#### Option C: One-Time Purchase
```
$1.99 per video (copy once)
$4.99 topic bundle (all in that topic)
$19.99 lifetime all videos
```
- **Pros**: No recurring billing friction, lower entry price
- **Cons**: Revenue unpredictable, lower LTV

#### Option D: Freemium
```
Free: Watch all videos
$2.99/mo: Copy 5 taglines/month
$9.99/mo: Unlimited copying + email digest
```
- **Pros**: Lower barrier to paid, viral potential
- **Cons**: Cannibalize higher tiers

#### Option E: Pay-What-You-Want + Subscription
```
Free: Watch all
$0.99+ one-time per tagline (optional donation)
$4.99/mo: Unlimited + support creators
```
- **Pros**: Honors the mission, community-driven
- **Cons**: Revenue volatility

---

## API Reference

### List All Videos
```
GET /api/what-men-carry?action=list
→ { ok: true, videos: [{id, title, duration, topic, tagline}], count: 6 }
```

### Search
```
GET /api/what-men-carry?action=search&q=custody
→ { ok: true, videos: [...], count: 1 }
```

### Get Topics
```
GET /api/what-men-carry?action=topics
→ { ok: true, topics: ["Custody & Presence", "PTSD & Trauma", ...] }
```

### Start Checkout (Buy One Video)
```
POST /api/what-men-carry?action=checkout
Body: { email: "user@example.com", videoId: "wmc-001-custody" }
→ { ok: true, url: "https://buy.stripe.com/..." }
```

### Check if User Has Purchased
```
POST /api/what-men-carry?action=verify
Body: { email: "user@example.com", videoId: "wmc-001-custody" }
→ { ok: true, purchased: true, email: "user@example.com", videoId: "wmc-001-custody" }
```

## Database

Purchases and intents stored in `limen-db`:
- `what-men-carry:purchases:v1` — purchased videos by user (email + videoId + timestamp)
- `what-men-carry:intents:v1` — checkout intents (leads)

Query these to:
- Revenue per video (which taglines drive sales?)
- Customer lifetime value (how many videos does each buyer purchase?)
- Repeat buyers (who came back for more?)
- Email campaigns (reach out to first-time buyers)
- Analytics

## Current Videos (6 seeded)

1. **She Held His Hand** — Custody & Presence
2. **The Weight He Carries** — PTSD & Trauma
3. **Drowning in Plain Sight** — Mental Health
4. **The Unspoken** — Vulnerability & Silence
5. **The Weight Accumulates** — Stress & Burden
6. **Still Here** — Fatherhood & Presence

---

## Pricing: $0.99 per Video

**Why this model:**
- **Impulse-friendly**: $0.99 is low enough to buy without thinking twice
- **Honor each share**: Each tagline costs $0.99, feels intentional
- **Volume revenue**: 10 videos × 100 buyers = $1,000 MRR (scaling)
- **No churn risk**: One-time purchase, not recurring billing
- **Social proof**: "I paid for this" drives sharing

**Metrics to track:**
- Average videos purchased per buyer (target: 2-3)
- Customer LTV (sum of all purchases per email)
- Repeat purchase rate (% who buy 2+ videos)
- Revenue per video (which topics perform best?)
- Conversion rate (gallery views → purchases)

**Growth levers:**
- Add more videos (broader topics = broader audience)
- Email first-time buyers: "You bought X. You'll love Y."
- Social badges: "Share your tagline" → viral loop
- Topic bundles: "Buy all Custody videos for $2.99" (later)
- Gift purchases: "Buy for a friend"

---

## Next Steps

1. **Decide pricing** — what's your model?
2. **Add videos** — edit manifest with your 15-second content
3. **Test checkout** — make sure Stripe integration works
4. **Soft launch** — share link with close group
5. **Monitor** — track subs, retention, feedback
6. **Iterate** — adjust pricing/tiers based on data

---

This is a lean MVP. The infrastructure scales: add 100+ videos to the manifest. For mission-driven, high-engagement content like this, focus on quality over quantity first.
