# Grok Movies Setup Guide

## Overview

Grok Movies is a revenue stream within LIMEN Helix. Users can:
- **Watch** all 10-second educational videos about Grok AI for free
- **Search** and filter videos by topic
- **Subscribe** ($4.99/month) to copy and paste video transcripts

## Files

- `grok-movies.html` — The main gallery page (served at `/grok-movies`)
- `handlers/grok-movies.js` — API handler for listing, searching, subscription checks, and checkout
- `grok-movies-manifest.js` — Video library manifest (edit this to add/remove videos)
- `api/[...route].js` — Hono router (now includes grok-movies route)

## How to Add Videos

Edit `grok-movies-manifest.js` and add a new entry:

```javascript
{
  id: 'grok-unique-id-001',
  title: 'Video Title',
  duration: '0:10',
  topic: 'Topic Name',
  url: '/videos/grok-unique-id-001.mp4',
  transcript: 'Full text transcript of the video...'
}
```

- **id**: Unique identifier (use format: `grok-[topic]-[number]`)
- **title**: Display name
- **duration**: Length in MM:SS format
- **topic**: Category (e.g., "Introduction", "Capabilities", "Comparison")
- **url**: Path to the video file (can be local or CDN URL)
- **transcript**: Full text that users can copy

## Video Files

Currently, videos are referenced by URL path (`/videos/...`). You have two options:

### Option 1: Local Storage (Simple, for testing)
1. Create a `/public/videos/` directory
2. Place `.mp4` files there
3. URLs will be `/videos/filename.mp4`

### Option 2: CDN Storage (Recommended for scale)
1. Upload videos to a CDN (Vercel Blob, S3, etc.)
2. Update the `url` field in manifest with the CDN URL
3. You can serve hundreds of videos without bloating the repo

## Subscription System

### Pricing
Currently set to **$4.99/month** (499 cents). Edit `PRICE_CENTS` in `handlers/grok-movies.js` to change.

### Flow
1. User enters email and clicks "Subscribe $4.99/month"
2. Redirects to Stripe checkout (powered by existing LIMEN Stripe integration)
3. After payment, Stripe webhook records the subscription
4. User can check their subscription status and copy transcripts

### Manual Subscription Testing

If STRIPE_SECRET_KEY is not set or using test mode:
- Subscription check will always return false
- Checkout button shows "Payments are not enabled yet"
- You can still demo the UI without processing real payments

## API Endpoints

All endpoints are at `/api/grok-movies`:

### List All Videos
```
GET /api/grok-movies?action=list
→ { ok: true, videos: [...], count: 3 }
```

### Search Videos
```
GET /api/grok-movies?action=search&q=grok
→ { ok: true, videos: [...], count: 1 }
```

### Get All Topics
```
GET /api/grok-movies?action=topics
→ { ok: true, topics: ["Introduction", "Capabilities", ...] }
```

### Start Checkout
```
POST /api/grok-movies?action=checkout
Body: { email: "user@example.com" }
→ { ok: true, url: "https://checkout.stripe.com/..." }
```

### Check Subscription Status
```
POST /api/grok-movies?action=verify
Body: { email: "user@example.com" }
→ { ok: true, subscribed: true, email: "user@example.com" }
```

## Rate Limiting & Anti-Abuse

Currently:
- No daily copy quota (once subscribed, unlimited)
- No per-IP rate limits
- Subscriptions stored in `limen-db` (persistent)

To add rate limiting later:
1. Track copies per email per day
2. Add quota checks in the copy-transcript handler
3. Store quota state in `limen-db`

## Pricing Strategy Options

### Current: Flat Monthly ($4.99)
Simple, impulse-friendly, good for discovery.

### Alternative: Tiered (by topic)
```javascript
{
  'intro': { priceCents: 299, name: 'Intro Topics' },
  'advanced': { priceCents: 699, name: 'Advanced Topics' }
}
```
Allows segmented pricing but requires UI changes.

### Alternative: One-Time Purchase Per Topic
```javascript
{ price: 199, name: 'One Topic Bundle' }
```
No recurring billing complexity.

## Deployment Notes

- The page is static HTML (`grok-movies.html`) and will be served at `https://limenhelix.com/grok-movies`
- The API handler is registered in Hono (via `api/[...route].js`)
- Stripe integration uses existing `STRIPE_SECRET_KEY` and `STRIPE_SECRET_KEY_SUBS` environment variables
- No new dependencies added (uses existing libs: `stripe-rail`, `limen-db`, etc.)

## Future Enhancements

- Video playback (currently shows alert)
- Playlist/collection grouping
- User dashboard showing copy history
- Email digest of new videos
- Analytics on which transcripts are copied most
- Revenue sharing for contributor creators
- Bulk export options for subscribers

## Admin Management

Subscriptions and purchase intents are stored in:
- `grok-movies:subscriptions:v1` — active subscriptions
- `grok-movies:intents:v1` — checkout intents/leads

To view/manage:
1. Query `limen-db` directly (via admin console or API)
2. Export subscriber list for email outreach
3. Monitor conversion from intent → subscription

---

**Questions?** This is a minimal MVP. The infrastructure scales: add 100s of videos to the manifest, they'll all load. For video serving at scale, migrate to a CDN but keep the same API.
